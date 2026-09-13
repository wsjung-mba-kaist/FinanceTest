import { describe, expect, it } from 'vitest'
import { CUMULATIVE_HINT_COST, HINT_COSTS, hintCostBetween } from '@/engine'

/**
 * 감점표는 하나다.
 *
 * 세 자리에 각각 적혀 있었다. 화면에 «−2/−4/−8점» 이라고 찍는 `DecisionHelp` 는 `HINT_COSTS`
 * (증분)를, 실제로 깎는 `gameStore` 와 구형 기록을 되살리는 `replay()` 는 `[0, 2, 6, 14]`(누적)를
 * 각자 적어 뒀다. 같은 수를 다르게 적은 것이라 하나만 고치면 나머지가 조용히 어긋난다 — 그것도
 * 점수 경로에서. 화면이 −2 라고 약속하고 −3 을 깎는 것은 훈련 도구에서 그냥 버그다.
 */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('hint deductions', () => {
  it('derive the cumulative table from the incremental one', () => {
    expect(CUMULATIVE_HINT_COST).toEqual([
      0,
      HINT_COSTS[1],
      HINT_COSTS[1] + HINT_COSTS[2],
      HINT_COSTS[1] + HINT_COSTS[2] + HINT_COSTS[3],
    ])
  })

  /**
   * 단계를 건너뛰어도 총액이 같다. 3단계를 바로 열든 1 → 3 으로 열든 −14 다. 증분표만 들고
   * `HINT_COSTS[level]` 로 깎으면 건너뛴 사람이 덜 내는데, 그게 원래 있던 버그다.
   */
  it('charge the same total however the player gets there', () => {
    expect(hintCostBetween(0, 3)).toBe(14)
    expect(hintCostBetween(0, 1) + hintCostBetween(1, 3)).toBe(14)
    expect(hintCostBetween(0, 2) + hintCostBetween(2, 3)).toBe(14)
  })

  it('never charge for going nowhere, or backwards', () => {
    expect(hintCostBetween(2, 2)).toBe(0)
    expect(hintCostBetween(3, 1)).toBe(0)
    expect(hintCostBetween(0, 0)).toBe(0)
  })

  it('are not written down a second time anywhere in src', () => {
    const literal = CUMULATIVE_HINT_COST.join(', ')
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/core/hintCost.ts'))
      .filter(([, src]) => src.includes(`[${literal}]`))
      .map(([path]) => path.replace('../../', ''))
    expect(
      offenders,
      `누적 감점표를 다시 적으면 증분표와 어긋납니다 — \`hintCostBetween\` 을 쓰세요:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
