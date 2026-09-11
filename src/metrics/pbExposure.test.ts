import { describe, expect, it } from 'vitest'
import { PB_EXPOSURE_DEFAULTS, computePbExposure } from './pbExposure'

const bigPosition = { ticker: 'VIAC', notional: 10_000, dailyVolPct: 0.03, advNotional: 500 }

describe('computePbExposure', () => {
  it('reference: $10bn position, 3% vol, ADV 500, 20% participation → 100 days, VaR 6990', () => {
    const r = computePbExposure({ positions: [bigPosition], marginPosted: 1000 })
    expect(r.grossNotional).toBe(10_000)
    expect(r.daysToLiquidate).toBeCloseTo(100, 10)
    expect(r.liquidationVaR).toBeCloseTo(6990, 10)
    expect(r.shortfall).toBeCloseTo(5990, 10)
    expect(r.marginCoverage).toBeCloseTo(14.306, 3)
    expect(r.concentrationFlag).toBe(true)
    expect(r.perPosition).toHaveLength(1)
    expect(r.perPosition[0]?.ticker).toBe('VIAC')
    expect(r.perPosition[0]?.daysToLiquidate).toBeCloseTo(100, 10)
    expect(r.perPosition[0]?.var).toBeCloseTo(6990, 10)
  })

  it('defaults are participation 0.2 and z 2.33; explicit overrides are honoured', () => {
    expect(PB_EXPOSURE_DEFAULTS.participation).toBe(0.2)
    expect(PB_EXPOSURE_DEFAULTS.z).toBe(2.33)
    const r = computePbExposure({
      positions: [bigPosition],
      marginPosted: 1000,
      participation: 0.5,
      z: 1.645,
    })
    expect(r.daysToLiquidate).toBeCloseTo(40, 10)
    expect(r.liquidationVaR).toBeCloseTo(1.645 * 0.03 * Math.sqrt(40) * 10_000, 10)
  })

  it('aggregates: max days, summed VaR (no diversification), |notional| for shorts', () => {
    const r = computePbExposure({
      positions: [
        { ticker: 'A', notional: 1000, dailyVolPct: 0.02, advNotional: 1000 }, // 5 days
        { ticker: 'B', notional: -400, dailyVolPct: 0.04, advNotional: 500 }, // 4 days (short)
      ],
      marginPosted: 500,
    })
    const varA = 2.33 * 0.02 * Math.sqrt(5) * 1000
    const varB = 2.33 * 0.04 * Math.sqrt(4) * 400
    expect(r.grossNotional).toBe(1400)
    expect(r.daysToLiquidate).toBeCloseTo(5, 10)
    expect(r.liquidationVaR).toBeCloseTo(varA + varB, 10)
    expect(r.shortfall).toBeCloseTo(Math.max(0, varA + varB - 500), 10)
    expect(r.concentrationFlag).toBe(false)
    expect(r.perPosition.map((p) => p.ticker)).toEqual(['A', 'B'])
  })

  it('margin above VaR → no shortfall, coverage above 100%', () => {
    const r = computePbExposure({
      positions: [{ ticker: 'A', notional: 100, dailyVolPct: 0.01, advNotional: 500 }],
      marginPosted: 50,
    })
    expect(r.shortfall).toBe(0)
    expect(r.marginCoverage).toBeGreaterThan(100)
  })

  it('concentration flag is strictly greater than 10 days', () => {
    const at10 = { ticker: 'X', notional: 1000, dailyVolPct: 0.02, advNotional: 500 } // 10 days
    expect(computePbExposure({ positions: [at10], marginPosted: 0 }).concentrationFlag).toBe(false)
    const over = { ...at10, notional: 1001 }
    expect(computePbExposure({ positions: [over], marginPosted: 0 }).concentrationFlag).toBe(true)
  })

  it('zero ADV → NaN days / VaR; empty book → zeros and NaN coverage (no throw)', () => {
    const illiquid = computePbExposure({
      positions: [{ ticker: 'Z', notional: 100, dailyVolPct: 0.02, advNotional: 0 }],
      marginPosted: 10,
    })
    expect(illiquid.perPosition[0]?.daysToLiquidate).toBeNaN()
    expect(illiquid.liquidationVaR).toBeNaN()
    expect(illiquid.marginCoverage).toBeNaN()

    const empty = computePbExposure({ positions: [], marginPosted: 10 })
    expect(empty.grossNotional).toBe(0)
    expect(empty.daysToLiquidate).toBe(0)
    expect(empty.liquidationVaR).toBe(0)
    expect(empty.shortfall).toBe(0)
    expect(empty.marginCoverage).toBeNaN()
    expect(empty.concentrationFlag).toBe(false)
    expect(empty.perPosition).toEqual([])
  })
})
