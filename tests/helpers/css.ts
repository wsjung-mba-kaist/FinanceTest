import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A very small CSS reader for the one stylesheet this project hand-writes
 * (`src/styles/index.css`). It is deliberately *not* a general parser: it walks braces, keeps the
 * prelude of every block, and tracks the chain of at-rules a block sits under. That is exactly
 * what the stylesheet guardrails need and nothing more.
 *
 * Why hand-rolled: the project has no PostCSS dependency of its own (Tailwind's Vite plugin owns
 * that), and adding one to assert four structural facts would be a worse trade than 60 lines here.
 */

/**
 * Read from disk, not through Vite: `?raw` on a `.css` file is swallowed by Tailwind's Vite plugin
 * and silently yields an empty string, which would make every assertion below vacuously pass.
 * Vitest runs with the project root as cwd (`vite.config.ts` sets no other root).
 */
export const STYLESHEET_PATH = resolve(process.cwd(), 'src/styles/index.css')

export function readStylesheet(): string {
  const css = readFileSync(STYLESHEET_PATH, 'utf8')
  if (css.length < 1000) throw new Error(`스타일시트를 읽지 못했습니다: ${STYLESHEET_PATH}`)
  return css
}

export interface CssBlock {
  /** Everything before `{`, whitespace-collapsed: a selector list or an at-rule prelude. */
  prelude: string
  /** Raw text between the braces. */
  body: string
  /** Preludes of the enclosing blocks, outermost first. `[]` for a top-level block. */
  ancestors: string[]
  /** 1-based line of the prelude, for failure messages that point at the source. */
  line: number
}

/** `@layer base { … }`, `@media print { … }`, `:root { … }` — anything with a prelude and a body. */
export function parseBlocks(css: string): CssBlock[] {
  const out: CssBlock[] = []
  const stack: string[] = []
  let i = 0
  let preludeStart = 0
  let line = 1
  let preludeLine = 1

  const flushPrelude = (end: number): string => {
    const raw = css.slice(preludeStart, end)
    return raw
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  while (i < css.length) {
    const ch = css[i]
    if (ch === '\n') {
      line++
      i++
      if (preludeStart === i - 1) {
        preludeStart = i
        preludeLine = line
      }
      continue
    }
    if (ch === '/' && css[i + 1] === '*') {
      const atPreludeStart = preludeStart === i
      const end = css.indexOf('*/', i + 2)
      const skipped = css.slice(i, end === -1 ? css.length : end + 2)
      line += (skipped.match(/\n/g) ?? []).length
      i = end === -1 ? css.length : end + 2
      // A comment that *begins* a pending prelude is not part of it; keep `line` on real code.
      if (atPreludeStart) {
        preludeStart = i
        preludeLine = line
      }
      continue
    }
    if (ch === '{') {
      const prelude = flushPrelude(i)
      const bodyStart = i + 1
      // Find the matching close brace, so `body` is the complete nested text.
      let depth = 1
      let j = bodyStart
      while (j < css.length && depth > 0) {
        if (css[j] === '/' && css[j + 1] === '*') {
          const end = css.indexOf('*/', j + 2)
          j = end === -1 ? css.length : end + 2
          continue
        }
        if (css[j] === '{') depth++
        else if (css[j] === '}') depth--
        j++
      }
      out.push({
        prelude,
        body: css.slice(bodyStart, j - 1),
        ancestors: [...stack],
        line: preludeLine,
      })
      stack.push(prelude)
      i = bodyStart
      preludeStart = i
      preludeLine = line
      continue
    }
    if (ch === '}') {
      stack.pop()
      i++
      preludeStart = i
      preludeLine = line
      continue
    }
    if (ch === ';') {
      i++
      preludeStart = i
      preludeLine = line
      continue
    }
    if (preludeStart === i && /\s/.test(ch!)) {
      // Keep `preludeLine` on the first non-space character of the prelude.
      i++
      preludeStart = i
      preludeLine = line
      continue
    }
    i++
  }
  return out
}

/** Declarations directly inside a body — nested blocks are skipped. */
export function declarationsOf(body: string): { prop: string; value: string }[] {
  const out: { prop: string; value: string }[] = []
  let depth = 0
  let buf = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2)
      i = end === -1 ? body.length : end + 1
      continue
    }
    if (ch === '{') {
      depth++
      buf = ''
      continue
    }
    if (ch === '}') {
      depth--
      buf = ''
      continue
    }
    if (depth > 0) continue
    if (ch === ';') {
      const idx = buf.indexOf(':')
      if (idx > 0) out.push({ prop: buf.slice(0, idx).trim(), value: buf.slice(idx + 1).trim() })
      buf = ''
      continue
    }
    buf += ch
  }
  const idx = buf.indexOf(':')
  if (idx > 0 && buf.trim())
    out.push({ prop: buf.slice(0, idx).trim(), value: buf.slice(idx + 1).trim() })
  return out
}

/** Custom-property declarations of a block, keyed without the leading `--`. */
export function tokensOf(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { prop, value } of declarationsOf(body)) {
    if (prop.startsWith('--')) out[prop.slice(2)] = value
  }
  return out
}

/* ---- colour maths (WCAG 2.x relative luminance) --------------------------- */

export function parseHex(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`hex가 아닙니다: ${hex}`)
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, rounded to 2 decimals so failure messages stay readable. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  return Math.round(ratio * 100) / 100
}
