/**
 * Render-time shortening for authored scenario text.
 *
 * Scenario content files are never edited to fit the screen; the play view folds them
 * instead — a headline shows its first sentence with `더 보기`, an option shows its
 * title plus a one-line 핵심 효과. Every helper here is pure so it can be unit-tested
 * against the real strings in `src/scenarios/**`.
 */

const BULLET_RE = /^\s*(?:[-*•]|\d+\.)\s+/
/** Characters that open/close a quoted run; a separator inside one is not a separator. */
const QUOTE_PAIRS: Record<string, string> = { '"': '"', '“': '”', '‘': '’', '「': '」', '『': '』' }

/** Removes emphasis, code ticks, links and `[출처: …]` chips. Line breaks are preserved. */
export function stripInlineMarkdown(s: string): string {
  return (s ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[출처:[^\]]*\]/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Bullet lines of a markdown body, inline markup stripped. Empty when the body is prose. */
export function bulletsOf(s: string): string[] {
  return stripInlineMarkdown(s)
    .split('\n')
    .filter((line) => BULLET_RE.test(line))
    .map((line) => line.replace(BULLET_RE, '').trim())
    .filter(Boolean)
}

/**
 * Truncates to `n` characters at a word boundary and appends `…`.
 * Korean has no inter-word spaces inside a 어절, so the boundary is only honoured when it
 * falls in the last 40% of the budget; otherwise the cut is hard.
 */
export function truncateKo(s: string, n: number): string {
  const t = (s ?? '').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const sp = cut.lastIndexOf(' ')
  const body = sp > n * 0.6 ? cut.slice(0, sp) : cut
  return `${body.replace(/[\s,·、:;]+$/, '')}…`
}

export interface SplitText {
  /** What is shown by default. */
  head: string
  /** What `더 보기` reveals; empty when the head is the whole text. */
  rest: string
}

/**
 * First sentence of a body, capped at `max` characters.
 * Cuts at `다.`, `。`, `. ` or a line break. A bullet-list body yields its first bullet.
 *
 * Leading markdown headings are skipped. A heading is a title, not a sentence: a knowledge card
 * that opens with `## 정의` summarised itself as the single word 「정의」, which told the reader
 * nothing at all. No caller wants the heading — they want the prose under it.
 */
export function firstSentence(s: string, max = 90): SplitText {
  const withoutHeadings = s.replace(/^(?:\s*#{1,6}[^\n]*\n+)+/, '')
  const text = stripInlineMarkdown(withoutHeadings)
  if (!text) return { head: '', rest: '' }

  const lines = text.split('\n')
  const firstLine = lines.find((l) => l.trim().length > 0) ?? ''
  if (BULLET_RE.test(firstLine)) {
    const bullets = bulletsOf(text)
    const head = bullets[0] ?? ''
    const rest = text.slice(text.indexOf(firstLine) + firstLine.length).trim()
    return capped(head, rest, max)
  }

  let end = -1
  for (const [needle, keep] of [
    ['다.', 2],
    ['。', 1],
    ['. ', 1],
    ['\n', 0],
  ] as const) {
    const idx = text.indexOf(needle)
    if (idx < 0) continue
    const candidate = idx + keep
    if (end < 0 || candidate < end) end = candidate
  }
  if (end < 0) end = text.length
  return capped(text.slice(0, end).trim(), text.slice(end).trim(), max)
}

function capped(head: string, rest: string, max: number): SplitText {
  if (head.length <= max) return { head, rest }
  const cut = truncateKo(head, max)
  const kept = cut.endsWith('…') ? cut.length - 1 : cut.length
  const spill = head.slice(kept).trim()
  return { head: cut, rest: [spill, rest].filter(Boolean).join(' ') }
}

export interface OptionLabelParts {
  /** ≤ 40 characters, the part the eye scans. */
  title: string
  /** What followed the separator; often a usable 핵심 효과 line. */
  tail: string
}

/**
 * Splits an authored option label at the first `: ` or ` — ` that is not inside quotes,
 * so `"빅뱅" 리스크 축소: AFS $21B 일괄 매각…` keeps its quoted prefix in the title.
 */
export function splitOptionLabel(label: string): OptionLabelParts {
  const text = stripInlineMarkdown(label).replace(/\n+/g, ' ').trim()
  if (!text) return { title: '', tail: '' }
  let closing = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string
    if (closing) {
      if (ch === closing) closing = ''
      continue
    }
    if (QUOTE_PAIRS[ch]) {
      closing = QUOTE_PAIRS[ch] as string
      continue
    }
    if (ch === ':' && text[i + 1] === ' ') {
      return { title: truncateKo(text.slice(0, i), 40), tail: text.slice(i + 2).trim() }
    }
    if (ch === ' ' && (text[i + 1] === '—' || text[i + 1] === '–') && text[i + 2] === ' ') {
      return { title: truncateKo(text.slice(0, i), 40), tail: text.slice(i + 3).trim() }
    }
  }
  return { title: truncateKo(text, 40), tail: '' }
}
