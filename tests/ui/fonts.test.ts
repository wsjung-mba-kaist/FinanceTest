import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declarationsOf, parseBlocks, readStylesheet, tokensOf } from '../helpers/css'

/**
 * A font stack is a *promise*, and this suite is the only thing that checks it was kept.
 *
 * `--font-sans` named `Pretendard Variable` first from the beginning, but nothing ever shipped the
 * file: no `@font-face`, no `<link>`, an empty `public/fonts/`, no dependency. On Windows — the
 * primary environment for this project — Korean therefore rendered in 맑은 고딕 and every figure in
 * Consolas, and the settings toggle "시스템 글꼴 사용 — Pretendard 대신" switched between a font the
 * user did not have and the one they were already looking at.
 *
 * Nothing catches that. The stylesheet is valid, the cascade is correct, jsdom resolves no fonts at
 * all, and a screenshot only looks slightly worse than it should. So it is asserted here: the first
 * family of `--font-sans` must be declared by a stylesheet the entry module actually imports.
 */
const ENTRY = resolve(process.cwd(), 'src/app/main.tsx')

/** CSS the app pulls in at startup, both relative (`../styles/index.css`) and bare (npm packages). */
function entryStylesheets(): { specifier: string; path: string; css: string }[] {
  const entry = readFileSync(ENTRY, 'utf8')
  const specifiers = [...entry.matchAll(/^\s*import\s+'([^']+\.css)'/gm)].map((m) => m[1]!)
  return specifiers.map((specifier) => {
    const path = specifier.startsWith('.')
      ? resolve(dirname(ENTRY), specifier)
      : resolve(process.cwd(), 'node_modules', specifier)
    return { specifier, path, css: readFileSync(path, 'utf8') }
  })
}

/** `font-family: 'Pretendard Variable', Pretendard, …` → `Pretendard Variable`. */
function firstFamily(stack: string): string {
  return stack
    .split(',')[0]!
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

const blocks = parseBlocks(readStylesheet())

/** Base `:root` tokens, read with the shared helper rather than a hand-built RegExp. */
const rootTokens: Record<string, string> = {}
for (const b of blocks)
  if (b.prelude === ':root' && b.ancestors.length === 0) Object.assign(rootTokens, tokensOf(b.body))

function rootToken(name: string): string {
  const value = rootTokens[name]
  if (!value) throw new Error(`--${name} 을 :root 에서 찾지 못했습니다`)
  return value
}

/** The body of every `@utility <name>` block, keyed by name. */
const utilities = new Map(
  blocks
    .filter((b) => b.prelude.startsWith('@utility ') && b.ancestors.length === 0)
    .map((b) => [b.prelude.slice('@utility '.length).trim(), b.body]),
)

describe('font delivery', () => {
  it('the first family of --font-sans is shipped, not just named', () => {
    const family = firstFamily(rootToken('font-sans'))
    const sheets = entryStylesheets()
    const declaring = sheets.filter((s) => s.css.includes('@font-face') && s.css.includes(family))

    expect(
      declaring.map((s) => s.specifier),
      `--font-sans 의 첫 패밀리 «${family}» 를 선언하는 @font-face 가 없습니다.\n` +
        `이름만 적고 파일을 배달하지 않으면 그 선언은 주석이고, 설정의 글꼴 토글은 거짓말이 됩니다.\n` +
        `진입 모듈이 불러오는 스타일시트: ${sheets.map((s) => s.specifier).join(', ') || '(없음)'}`,
    ).not.toEqual([])
  })

  it('swaps rather than blocking, so first paint never waits on a font', () => {
    const family = firstFamily(rootToken('font-sans'))
    const sheet = entryStylesheets().find(
      (s) => s.css.includes('@font-face') && s.css.includes(family),
    )!
    // `font-display: auto` blocks text for up to 3s; the fallback chain exists to be used.
    expect(sheet.css, 'font-display: swap 이 없습니다').toMatch(/font-display\s*:\s*swap/)
  })

  it('keeps the fallback chain behind it', () => {
    // The webfont can fail (offline, blocked, a subset that 404s). What is behind it must still be
    // a Korean face, not a Latin default that renders Hangul in whatever the OS picks last.
    const stack = rootToken('font-sans')
    for (const fallback of ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'])
      expect(stack, `--font-sans 폴백에 ${fallback} 이 없습니다`).toContain(fallback)
  })
})

describe('numeric utilities', () => {
  /**
   * What makes a column of figures readable is *tabular*, not *monospace*. `--font-mono` resolves to
   * a code face — Consolas on Windows, since JetBrains Mono is not shipped either — whose x-height
   * and colour fight the Hangul label beside it at every one of ~230 call sites. Pretendard carries
   * `tnum`, so the sans stack lines the digits up in the same typeface as the label.
   */
  for (const name of ['num', 'num-lg', 'num-md']) {
    it(`${name} uses the sans stack with tabular figures`, () => {
      const body = utilities.get(name)
      expect(body, `@utility ${name} 이 없습니다`).toBeDefined()
      expect(body!, `${name} 이 코드 글꼴(--font-mono)을 씁니다`).toContain('var(--font-sans)')
      expect(body!).not.toContain('var(--font-mono)')
      expect(body!, `${name} 에 tabular-nums 가 없습니다`).toContain('tabular-nums')
    })
  }

  /**
   * A hardcoded rem here opts these two utilities out of any future change to the type scale —
   * silently, because nothing else in the app would move with them.
   */
  it('display figures read the type scale instead of restating it', () => {
    expect(utilities.get('num-lg')!, 'num-lg 이 --text-xl 을 읽지 않습니다').toContain(
      'font-size: var(--text-xl)',
    )
    expect(utilities.get('num-md')!, 'num-md 이 --text-lg 을 읽지 않습니다').toContain(
      'font-size: var(--text-lg)',
    )
    for (const name of ['num-lg', 'num-md'])
      expect(utilities.get(name)!, `${name} 이 글자 크기를 rem 으로 박아 두었습니다`).not.toMatch(
        /font-size:\s*[\d.]+rem/,
      )
  })

  /** `--font-mono` still has one job: text that is literally code. */
  it('reserves the mono stack for code', () => {
    // Declarations *directly* in a block — an ancestor's body contains its descendants' text, so
    // matching on `body` alone would report `@layer components` as a user of every token inside it.
    const users = blocks
      .filter(
        (b) =>
          !b.prelude.startsWith('@theme') &&
          declarationsOf(b.body).some((d) => d.value.includes('var(--font-mono)')),
      )
      .map((b) => b.prelude)
      .filter((p) => p !== ':root')

    expect(users, '--font-mono 를 쓰는 곳이 없습니다').not.toEqual([])
    const CODE_SELECTORS = ['.md code', '.md pre', '.md pre code']
    for (const selector of users)
      expect(
        CODE_SELECTORS,
        `«${selector}» 는 코드가 아닙니다 — --font-mono 는 코드 전용입니다`,
      ).toContain(selector)
  })
})
