import { describe, expect, it } from 'vitest'

/**
 * One idiom for "there is more here", not nine.
 *
 * The play screen alone offered 더 보기 · 자세히 · 펼치기 · 배경 · 근거 보기 · 전체 지표 ·
 * 이전 턴 N건 펼치기 · 표로 보기 · a bare `<details>`. Each is legible on its own; together they
 * stop a reader from ever learning what a control will do before clicking it, which is the entire
 * value of having a convention.
 *
 * Three forms now, and they mean different things:
 *
 *   자세히 ⇄ 접기   detail that is hidden — an option's full description, a knowledge card
 *   더 보기 ⇄ 접기   content that is truncated — a clipped paragraph, a capped list
 *   … →            navigation: the control goes somewhere else, so nothing closes
 *
 * Named sections keep their names (배경, 근거 보기, 표로 보기): naming *what* opens tells the
 * reader more than a generic verb, and those carry `aria-expanded`, not mystery.
 */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const files = Object.entries(SOURCES).filter(
  ([path]) =>
    !path.endsWith('.test.ts') && !path.endsWith('.test.tsx') && !path.includes('__tests__'),
)

/**
 * `자세히 →` goes somewhere; `자세히` opens in place. Only the second needs a way back.
 * The quote and brace between verb and arrow are the JSX around it (`{moreLabel ?? '자세히'} →`).
 */
const NAVIGATION = /(자세히|더 보기)['} ]*→/
const navigates = (src: string) => NAVIGATION.test(src)

describe('disclosure vocabulary', () => {
  it('has retired 펼치기 in favour of 자세히 / 더 보기', () => {
    const offenders = files
      .filter(([, src]) => src.includes('펼치기'))
      .map(([path]) => path.replace('../../', ''))
    expect(
      offenders,
      '펼치기 는 세 번째 동사입니다. 숨은 상세는 «자세히», 잘린 내용은 «더 보기» 입니다.',
    ).toEqual([])
  })

  it('always pairs an in-place opener with 접기', () => {
    const openers = files
      .filter(([, src]) => src.includes("'자세히'") || src.includes("'더 보기'"))
      .filter(([, src]) => !navigates(src))
    expect(openers.length, '여는 컨트롤이 하나도 없습니다').toBeGreaterThan(0)
    for (const [path, src] of openers)
      expect(src, `${path.replace('../../', '')} 가 여는 말만 있고 «접기» 가 없습니다`).toContain(
        '접기',
      )
  })

  it('marks navigation with an arrow rather than borrowing a disclosure verb', () => {
    const navigators = files.filter(([, src]) => navigates(src))
    expect(navigators.length, '이동을 뜻하는 컨트롤이 하나도 없습니다').toBeGreaterThan(0)
  })
})
