import { describe, expect, it } from 'vitest'
import { IRRBB_DEFAULT_SHOCKS_BP, computeIrrbb, irrbbShockKey } from './irrbb'

const bucket = { label: '5y', midDurationYears: 5, assets: 1000, liabilities: 900 }

describe('computeIrrbb', () => {
  it('reference: assets 1000 D5 vs liabilities 900 D2, +200bp → ΔEVE −64 → 64% of Tier 1 → outlier', () => {
    const r = computeIrrbb({
      buckets: [
        { label: 'assets', midDurationYears: 5, assets: 1000, liabilities: 0 },
        { label: 'liabilities', midDurationYears: 2, assets: 0, liabilities: 900 },
      ],
      tier1: 100,
    })
    expect(r.deltaEve['+200']).toBeCloseTo(-64, 10)
    expect(r.deltaEve['-200']).toBeCloseTo(64, 10)
    expect(r.worstDeltaEve).toBeCloseTo(-64, 10)
    expect(r.worstPctTier1).toBeCloseTo(64, 10)
    expect(r.outlier).toBe(true)
  })

  it('uses ±200bp by default and honours custom shocks', () => {
    expect(IRRBB_DEFAULT_SHOCKS_BP).toEqual([200, -200])
    expect(Object.keys(computeIrrbb({ buckets: [bucket], tier1: 100 }).deltaEve)).toEqual([
      '+200',
      '-200',
    ])
    const r = computeIrrbb({ buckets: [bucket], tier1: 1000, shocksBp: [100, 300, -50] })
    // gap = 100 × 5 = 500
    expect(r.deltaEve['+100']).toBeCloseTo(-5, 10)
    expect(r.deltaEve['+300']).toBeCloseTo(-15, 10)
    expect(r.deltaEve['-50']).toBeCloseTo(2.5, 10)
    expect(r.worstDeltaEve).toBeCloseTo(-15, 10)
    expect(r.worstPctTier1).toBeCloseTo(1.5, 10)
    expect(r.outlier).toBe(false)
  })

  it('liability-sensitive book: a fall in rates is the loss scenario', () => {
    const r = computeIrrbb({
      buckets: [{ label: '3y', midDurationYears: 3, assets: 100, liabilities: 400 }],
      tier1: 100,
    })
    expect(r.deltaEve['+200']).toBeCloseTo(18, 10)
    expect(r.deltaEve['-200']).toBeCloseTo(-18, 10)
    expect(r.worstDeltaEve).toBeCloseTo(-18, 10)
    expect(r.worstPctTier1).toBeCloseTo(18, 10)
    expect(r.outlier).toBe(true)
  })

  it('outlier boundary is strictly greater than 15%', () => {
    // gap 750 × 0.02 = 15 loss on Tier 1 100 → exactly 15% → not an outlier
    const r = computeIrrbb({
      buckets: [{ label: '1', midDurationYears: 1, assets: 750, liabilities: 0 }],
      tier1: 100,
    })
    expect(r.worstPctTier1).toBeCloseTo(15, 10)
    expect(r.outlier).toBe(false)
  })

  it('tier1 0 → NaN and not an outlier; empty buckets / shocks are well defined', () => {
    const noTier1 = computeIrrbb({ buckets: [bucket], tier1: 0 })
    expect(noTier1.worstPctTier1).toBeNaN()
    expect(noTier1.outlier).toBe(false)

    const noBuckets = computeIrrbb({ buckets: [], tier1: 100 })
    expect(noBuckets.deltaEve['+200']).toBe(0)
    expect(noBuckets.worstDeltaEve).toBe(0)
    expect(noBuckets.worstPctTier1).toBe(0)

    const noShocks = computeIrrbb({ buckets: [bucket], tier1: 100, shocksBp: [] })
    expect(noShocks.deltaEve).toEqual({})
    expect(noShocks.worstDeltaEve).toBe(0)
    expect(noShocks.outlier).toBe(false)
  })

  it('irrbbShockKey signs the key', () => {
    expect(irrbbShockKey(200)).toBe('+200')
    expect(irrbbShockKey(-200)).toBe('-200')
    expect(irrbbShockKey(0)).toBe('+0')
  })
})
