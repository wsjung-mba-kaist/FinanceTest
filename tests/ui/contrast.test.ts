import { describe, expect, it } from 'vitest'
import { contrast, parseBlocks, readStylesheet, tokensOf } from '../helpers/css'

/**
 * Contrast is a property of *pairs*, and this project has three palettes — light, dark and print —
 * declared in one file where only two of them are obvious. Reading the token table tells you
 * nothing about whether `--sev-positive` is legible on `--sev-positive-bg`; this computes it.
 *
 * The print palette is the one that had actually broken. `@media print { :root { … } }` is
 * specificity (0,1,0) while `:root[data-theme='dark']` is (0,2,0), so a dark-mode user printing a
 * debrief got the *dark* tokens on white paper. `coversDark` below is the assertion that closed it.
 */
const blocks = parseBlocks(readStylesheet())

function blockBody(prelude: string, ancestors: string[] = []): string {
  const b = blocks.find(
    (x) => x.prelude === prelude && x.ancestors.join('|') === ancestors.join('|'),
  )
  if (!b) throw new Error(`블록을 찾을 수 없습니다: ${[...ancestors, prelude].join(' > ')}`)
  return b.body
}

const light = tokensOf(blockBody(':root'))
const dark = tokensOf(blockBody(":root[data-theme='dark']"))
const printOverrides = tokensOf(blockBody(":root, :root[data-theme='dark']", ['@media print']))

/** What a printed page actually resolves to, from either theme. */
const print = { ...light, ...printOverrides }

const PALETTES = { light, dark, print } as const
type PaletteName = keyof typeof PALETTES

/** WCAG 1.4.3 for text, 1.4.11 for boundaries that identify a control or carry meaning. */
interface Pair {
  fg: string
  bg: string
  min: number
  why: string
}

const TEXT = 4.5
const NONTEXT = 3
const HAIRLINE = 1.25

const PAIRS: Pair[] = [
  { fg: 'text', bg: 'bg', min: TEXT, why: '본문' },
  { fg: 'text', bg: 'surface', min: TEXT, why: '카드 본문' },
  { fg: 'text', bg: 'surface-2', min: TEXT, why: '조용한 패널 본문' },
  { fg: 'text-muted', bg: 'bg', min: TEXT, why: '보조 설명' },
  { fg: 'text-muted', bg: 'surface', min: TEXT, why: '카드 보조 설명' },
  { fg: 'text-muted', bg: 'surface-2', min: TEXT, why: '라벨·캡션' },
  { fg: 'accent', bg: 'bg', min: TEXT, why: '링크' },
  { fg: 'accent', bg: 'surface', min: TEXT, why: '카드 안 링크' },
  { fg: 'accent-fg', bg: 'accent', min: TEXT, why: '주 버튼 라벨' },
  { fg: 'accent', bg: 'accent-soft', min: TEXT, why: '선택된 칩' },
  { fg: 'sev-info', bg: 'surface', min: TEXT, why: '정보 텍스트' },
  { fg: 'sev-warning', bg: 'surface', min: TEXT, why: '경고 텍스트' },
  { fg: 'sev-critical', bg: 'surface', min: TEXT, why: '위험 텍스트' },
  { fg: 'sev-positive', bg: 'surface', min: TEXT, why: '양호 텍스트' },
  { fg: 'sev-none', bg: 'surface', min: TEXT, why: '기준 없음 텍스트' },
  { fg: 'sev-info', bg: 'sev-info-bg', min: TEXT, why: '정보 배지' },
  { fg: 'sev-warning', bg: 'sev-warning-bg', min: TEXT, why: '경고 배지' },
  { fg: 'sev-critical', bg: 'sev-critical-bg', min: TEXT, why: '위험 배지' },
  { fg: 'sev-positive', bg: 'sev-positive-bg', min: TEXT, why: '양호 배지' },
  { fg: 'sev-none', bg: 'sev-none-bg', min: TEXT, why: '기준 없음 배지' },
  { fg: 'sev-critical', bg: 'bg', min: NONTEXT, why: '차트 선·임계 밴드' },
  { fg: 'sev-warning', bg: 'bg', min: NONTEXT, why: '차트 선·임계 밴드' },
  { fg: 'sev-positive', bg: 'bg', min: NONTEXT, why: '차트 선·임계 밴드' },
  { fg: 'sev-none', bg: 'bg', min: NONTEXT, why: '상태 점' },
  { fg: 'border-control', bg: 'surface', min: NONTEXT, why: '입력·토글·선택 가능한 행의 경계' },
  { fg: 'border-control', bg: 'bg', min: NONTEXT, why: '입력·토글·선택 가능한 행의 경계' },
  { fg: 'border-control', bg: 'surface-2', min: NONTEXT, why: '조용한 패널 위의 컨트롤' },
  { fg: 'border-strong', bg: 'surface', min: NONTEXT, why: '강조 패널의 경계' },
  { fg: 'border-strong', bg: 'bg', min: NONTEXT, why: '강조 패널의 경계' },
  { fg: 'disabled-fg', bg: 'disabled-bg', min: TEXT, why: '비활성 컨트롤의 라벨' },
  { fg: 'accent-border', bg: 'surface', min: NONTEXT, why: '선택된 컨트롤의 경계' },
  { fg: 'sev-info-border', bg: 'surface', min: NONTEXT, why: '정보 배지 경계' },
  { fg: 'sev-warning-border', bg: 'surface', min: NONTEXT, why: '경고 배지 경계' },
  { fg: 'sev-critical-border', bg: 'surface', min: NONTEXT, why: '위험 배지 경계' },
  { fg: 'sev-positive-border', bg: 'surface', min: NONTEXT, why: '양호 배지 경계' },
  { fg: 'sev-none-border', bg: 'surface', min: NONTEXT, why: '기준 없음 배지 경계' },
  { fg: 'sev-none-bg', bg: 'surface-2', min: 1.03, why: '조용한 패널 위의 중립 배지 (구분만)' },
  /**
   * `--border` is deliberately *not* held to 3:1. 1.4.11 applies to boundaries that identify a
   * control or convey information; pushing the 166 decorative card hairlines to 3:1 would turn the
   * app into a spreadsheet. It still has to be visible at all, which is what this floor says.
   */
  { fg: 'border', bg: 'surface', min: HAIRLINE, why: '장식용 헤어라인' },
  { fg: 'border', bg: 'bg', min: HAIRLINE, why: '장식용 헤어라인' },
  { fg: 'border', bg: 'surface-2', min: HAIRLINE, why: '조용한 패널의 헤어라인' },
]

/**
 * Pairs that do not meet their requirement yet, with the token change that would close each. A
 * pair listed here must **still fail** — fixing one without deleting its line fails this suite, so
 * the list cannot rot into a permanent excuse. It is empty, and staying empty is the point.
 */
const PENDING: Record<PaletteName, string[]> = {
  light: [],
  dark: [],
  print: [],
}

function key(p: Pair): string {
  return `${p.fg} / ${p.bg}`
}

describe.each(Object.keys(PALETTES) as PaletteName[])('%s palette', (name) => {
  const palette = PALETTES[name]
  const pending = PENDING[name]

  it('declares every token the pairs below reference', () => {
    const missing = [...new Set(PAIRS.flatMap((p) => [p.fg, p.bg]))].filter((t) => !palette[t])
    expect(missing, `선언되지 않은 토큰: ${missing.join(', ')}`).toEqual([])
  })

  it('meets its contrast requirements', () => {
    const failures = PAIRS.filter((p) => !pending.includes(key(p)))
      .map((p) => ({ p, ratio: contrast(palette[p.fg]!, palette[p.bg]!) }))
      .filter(({ p, ratio }) => ratio < p.min)
      .map(({ p, ratio }) => `${key(p)} = ${ratio}:1 (필요 ${p.min}:1 — ${p.why})`)
    expect(failures, `대비 미달:\n${failures.join('\n')}`).toEqual([])
  })

  it('has no stale entries on the pending list', () => {
    const fixed = PAIRS.filter((p) => pending.includes(key(p)))
      .filter((p) => contrast(palette[p.fg]!, palette[p.bg]!) >= p.min)
      .map(key)
    expect(
      fixed,
      `이 쌍은 이제 기준을 만족합니다 — PENDING.${name} 에서 지우세요: ${fixed.join(', ')}`,
    ).toEqual([])
    const unknown = pending.filter((k) => !PAIRS.some((p) => key(p) === k))
    expect(unknown, `PAIRS 에 없는 PENDING 항목: ${unknown.join(', ')}`).toEqual([])
  })
})

describe('print palette isolation', () => {
  it('overrides both :root and the dark theme', () => {
    // Without the second selector the dark block's (0,2,0) wins and the page prints dark tokens.
    const selector = blocks.find(
      (b) => b.ancestors.join('|') === '@media print' && b.prelude.includes(':root'),
    )?.prelude
    expect(selector).toBe(":root, :root[data-theme='dark']")
  })

  it('redeclares every token the dark theme redefines', () => {
    // Any token dark redefines but print does not is a token that leaks onto paper.
    const leaks = Object.keys(dark).filter((t) => !(t in printOverrides))
    expect(
      leaks,
      `다크 모드로 인쇄하면 이 토큰이 그대로 새어 나옵니다: ${leaks.join(', ')}`,
    ).toEqual([])
  })

  it('prints on white', () => {
    expect(print.bg).toBe('#fff')
    expect(print.surface).toBe('#fff')
    expect(contrast(print.text!, print.bg!)).toBeGreaterThan(15)
  })
})
