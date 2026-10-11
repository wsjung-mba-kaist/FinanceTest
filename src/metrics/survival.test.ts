import { describe, expect, it } from 'vitest'
import { computeSurvival, SURVIVAL_CAP } from './survival'

/**
 * BCBS 144 (2008) Principle 11: a bank holds a cushion of unencumbered, high-quality liquid
 * assets against a range of stress scenarios; the contingency funding plan expresses it as a
 * survival horizon — available liquidity over projected net outflow. Pending capacity (collateral
 * in transit) is not available liquidity and is not counted.
 */
describe('computeSurvival', () => {
  it('reference: (cash + same-day capacity) / daily outflow', () => {
    const r = computeSurvival({ cash: 14, sameDayCapacity: 10, projectedDailyOutflow: 8 })
    expect(r.available).toBe(24)
    expect(r.survivalDays).toBeCloseTo(3, 12)
  })

  it('minimum operating cash is not available; negative inputs do not add', () => {
    expect(
      computeSurvival({ cash: 14, sameDayCapacity: 10, projectedDailyOutflow: 8, minimumCash: 4 })
        .available,
    ).toBe(20)
    expect(
      computeSurvival({ cash: -3, sameDayCapacity: -5, projectedDailyOutflow: 8 }).available,
    ).toBe(0)
  })

  it('no projected outflow means the horizon is the cap, never Infinity', () => {
    const r = computeSurvival({ cash: 14, sameDayCapacity: 0, projectedDailyOutflow: 0 })
    expect(r.survivalDays).toBe(SURVIVAL_CAP)
    expect(Number.isFinite(r.survivalDays)).toBe(true)
    expect(
      computeSurvival({ cash: 1e6, sameDayCapacity: 0, projectedDailyOutflow: 1 }).survivalDays,
    ).toBe(SURVIVAL_CAP)
  })
})
