import { describe, expect, it } from 'vitest'
import { NCR_ACTION_THRESHOLDS, computeNcr, ncrActionLevel } from './ncr'
import type { NcrInput } from './types'

const withEquity = (equityCapital: number, overrides: Partial<NcrInput> = {}): NcrInput => ({
  equityCapital,
  deductions: 0,
  additions: 0,
  risk: { market: 1000, credit: 1500, operational: 500 },
  requiredCapital: 2000,
  ...overrides,
})

describe('computeNcr', () => {
  it('reference: NOC 8000, risk 3000, required 2000 → NCR 250, old NCR ≈ 266.67, no action', () => {
    const r = computeNcr(withEquity(8000))
    expect(r.netOperatingCapital).toBe(8000)
    expect(r.totalRisk).toBe(3000)
    expect(r.ncr).toBeCloseTo(250, 10)
    expect(r.ncrOld).toBeCloseTo(266.667, 3)
    expect(r.actionLevel).toBe('none')
  })

  it('deductions and additions flow into 영업용순자본', () => {
    const r = computeNcr(withEquity(8000, { deductions: 1200, additions: 200 }))
    expect(r.netOperatingCapital).toBe(7000)
    expect(r.ncr).toBeCloseTo(200, 10)
  })

  it('적기시정조치 단계: 80 → recommend, 30 → require, −10 → order', () => {
    expect(computeNcr(withEquity(4600)).ncr).toBeCloseTo(80, 10)
    expect(computeNcr(withEquity(4600)).actionLevel).toBe('recommend')
    expect(computeNcr(withEquity(3600)).ncr).toBeCloseTo(30, 10)
    expect(computeNcr(withEquity(3600)).actionLevel).toBe('require')
    expect(computeNcr(withEquity(2800)).ncr).toBeCloseTo(-10, 10)
    expect(computeNcr(withEquity(2800)).actionLevel).toBe('order')
  })

  it('thresholds are "미만" (strictly below): 100 → none, 50 → recommend, 0 → require', () => {
    expect(NCR_ACTION_THRESHOLDS).toEqual({ recommend: 100, require: 50, order: 0 })
    expect(ncrActionLevel(100)).toBe('none')
    expect(ncrActionLevel(99.99)).toBe('recommend')
    expect(ncrActionLevel(50)).toBe('recommend')
    expect(ncrActionLevel(49.99)).toBe('require')
    expect(ncrActionLevel(0)).toBe('require')
    expect(ncrActionLevel(-0.01)).toBe('order')
    expect(ncrActionLevel(NaN)).toBe('none')
  })

  it('zero denominators → NaN (no throw)', () => {
    const noRequired = computeNcr(withEquity(8000, { requiredCapital: 0 }))
    expect(noRequired.ncr).toBeNaN()
    expect(noRequired.ncrOld).toBeCloseTo(266.667, 3)
    expect(noRequired.actionLevel).toBe('none')

    const noRisk = computeNcr(withEquity(8000, { risk: { market: 0, credit: 0, operational: 0 } }))
    expect(noRisk.totalRisk).toBe(0)
    expect(noRisk.ncrOld).toBeNaN()
    expect(noRisk.ncr).toBeCloseTo(400, 10)
  })
})
