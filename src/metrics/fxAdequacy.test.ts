import { describe, expect, it } from 'vitest'
import { IMF_ARA_WEIGHTS, computeFxAdequacy } from './fxAdequacy'
import type { FxAdequacyInput } from './types'

// Korea, December 1997 (stylised, USD bn): usable reserves collapsed to single digits against
// ~63bn of short-term external debt.
const korea1997: FxAdequacyInput = {
  usableReserves: 8.9,
  shortTermDebt: 63,
  monthlyImports: 12,
  broadMoneyUsd: 300,
  annualExportsUsd: 136,
  regime: 'managed',
}

describe('computeFxAdequacy', () => {
  it('Korea Dec 1997: Guidotti ≈ 14.1%, import cover ≈ 0.74 months, far below ARA', () => {
    const r = computeFxAdequacy(korea1997)
    expect(r.guidottiRatio).toBeCloseTo(14.127, 3)
    expect(r.importCoverMonths).toBeCloseTo(0.742, 3)
    expect(r.reservesToM2).toBeCloseTo(2.967, 3)
    // managed → fixed weights: 0.1×136 + 0.1×300 + 0.3×63 + 0.2×0 = 62.5
    expect(r.imfAra).toBeCloseTo(62.5, 10)
    expect(r.imfAraPct).toBeCloseTo(14.24, 10)
    expect(r.imfAraPct).toBeLessThan(100)
  })

  it('float regime uses the lighter weights and includes other liabilities', () => {
    const r = computeFxAdequacy({ ...korea1997, regime: 'float', otherLiabilities: 20 })
    // 0.05×136 + 0.05×300 + 0.3×63 + 0.15×20 = 6.8 + 15 + 18.9 + 3 = 43.7
    expect(r.imfAra).toBeCloseTo(43.7, 10)
    expect(r.imfAraPct).toBeCloseTo((8.9 / 43.7) * 100, 10)
  })

  it('peg and managed share the fixed-regime weights', () => {
    const peg = computeFxAdequacy({ ...korea1997, regime: 'peg', otherLiabilities: 20 })
    const managed = computeFxAdequacy({ ...korea1997, regime: 'managed', otherLiabilities: 20 })
    expect(peg.imfAra).toBeCloseTo(managed.imfAra, 10)
    expect(peg.imfAra).toBeCloseTo(62.5 + 0.2 * 20, 10)
    expect(IMF_ARA_WEIGHTS.fixed).toEqual({
      exports: 0.1,
      broadMoney: 0.1,
      shortTermDebt: 0.3,
      otherLiabilities: 0.2,
    })
    expect(IMF_ARA_WEIGHTS.float).toEqual({
      exports: 0.05,
      broadMoney: 0.05,
      shortTermDebt: 0.3,
      otherLiabilities: 0.15,
    })
  })

  it('adequate reserves land in the 100–150% ARA band with Guidotti above 100%', () => {
    const r = computeFxAdequacy({
      usableReserves: 400,
      shortTermDebt: 150,
      monthlyImports: 50,
      broadMoneyUsd: 2000,
      annualExportsUsd: 600,
      otherLiabilities: 200,
      regime: 'float',
    })
    // ARA = 30 + 100 + 45 + 30 = 205 → 400 / 205 = 195%
    expect(r.imfAra).toBeCloseTo(205, 10)
    expect(r.imfAraPct).toBeCloseTo(195.122, 3)
    expect(r.guidottiRatio).toBeCloseTo(266.667, 3)
    expect(r.importCoverMonths).toBeCloseTo(8, 10)
  })

  it('zero denominators → NaN (no throw)', () => {
    const r = computeFxAdequacy({
      usableReserves: 10,
      shortTermDebt: 0,
      monthlyImports: 0,
      broadMoneyUsd: 0,
      annualExportsUsd: 0,
      regime: 'float',
    })
    expect(r.guidottiRatio).toBeNaN()
    expect(r.importCoverMonths).toBeNaN()
    expect(r.reservesToM2).toBeNaN()
    expect(r.imfAra).toBe(0)
    expect(r.imfAraPct).toBeNaN()
  })
})
