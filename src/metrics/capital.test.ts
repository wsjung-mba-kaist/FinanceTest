import { describe, expect, it } from 'vitest'
import { computeCapital } from './capital'

describe('computeCapital', () => {
  it('cet1 100 / rwa 1000 → 10%; tier1, total and leverage ratios', () => {
    const r = computeCapital({
      cet1: 100,
      at1: 20,
      tier2: 30,
      rwa: 1000,
      leverageExposure: 2000,
      aociInCet1: true,
    })
    expect(r.cet1Ratio).toBeCloseTo(10, 10)
    expect(r.tier1Ratio).toBeCloseTo(12, 10)
    expect(r.totalRatio).toBeCloseTo(15, 10)
    expect(r.leverageRatio).toBeCloseTo(6, 10)
    expect(r.cet1RatioAfsAdjusted).toBeCloseTo(10, 10)
    expect(r.economicTceRatio).toBeCloseTo(5, 10)
  })

  it('AOCI opt-out (aociInCet1 false) with AFS loss 30 → adjusted CET1 ratio 7%', () => {
    const r = computeCapital({
      cet1: 100,
      at1: 0,
      tier2: 0,
      rwa: 1000,
      leverageExposure: 2000,
      aociInCet1: false,
      unrealizedAfsLoss: 30,
    })
    expect(r.cet1Ratio).toBeCloseTo(10, 10)
    expect(r.cet1RatioAfsAdjusted).toBeCloseTo(7, 10)
    expect(r.economicTceRatio).toBeCloseTo(3.5, 10)
  })

  it('AOCI already in CET1 → adjusted ratio equals cet1Ratio even when an AFS loss is given', () => {
    const r = computeCapital({
      cet1: 100,
      at1: 0,
      tier2: 0,
      rwa: 1000,
      leverageExposure: 2000,
      aociInCet1: true,
      unrealizedAfsLoss: 30,
      unrealizedHtmLoss: 10,
    })
    expect(r.cet1RatioAfsAdjusted).toBe(r.cet1Ratio)
    expect(r.economicTceRatio).toBeCloseTo(4.5, 10)
  })

  it('SVB-like sanity: economic TCE ratio is negative (≈ −2.3%)', () => {
    const r = computeCapital({
      cet1: 12.7,
      at1: 3.6,
      tier2: 0,
      rwa: 105,
      leverageExposure: 212,
      aociInCet1: false,
      unrealizedAfsLoss: 2.5,
      unrealizedHtmLoss: 15.1,
    })
    expect(r.cet1Ratio).toBeCloseTo(12.095, 3)
    expect(r.leverageRatio).toBeCloseTo(7.689, 3)
    expect(r.cet1RatioAfsAdjusted).toBeCloseTo(9.714, 3)
    expect(r.economicTceRatio).toBeCloseTo(-2.311, 3)
    expect(r.economicTceRatio).toBeLessThan(0)
  })

  it('zero denominators → NaN (no throw)', () => {
    const r = computeCapital({
      cet1: 10,
      at1: 0,
      tier2: 0,
      rwa: 0,
      leverageExposure: 0,
      aociInCet1: true,
    })
    expect(r.cet1Ratio).toBeNaN()
    expect(r.tier1Ratio).toBeNaN()
    expect(r.totalRatio).toBeNaN()
    expect(r.leverageRatio).toBeNaN()
    expect(r.cet1RatioAfsAdjusted).toBeNaN()
    expect(r.economicTceRatio).toBeNaN()
  })
})
