import { describe, expect, it } from 'vitest'
import { BCBS_LCR_PARAMS, BCBS_REDUCED_RUNOFF_PARAMS, KR_LCR_PARAMS, computeLcr } from './lcr'
import type { LcrInput } from './types'

const hqlaOnly = (l1: number, l2a: number, l2b: number): LcrInput => ({
  hqla: { l1, l2a, l2b },
  outflows: {},
  inflows: {},
})

describe('computeLcr', () => {
  it('reference (a): caps not binding, inflow cap not binding → LCR ≈ 40.93', () => {
    const r = computeLcr({
      hqla: { l1: 80, l2a: 30, l2b: 10 },
      outflows: { corporateUninsured: 925 },
      inflows: { financialInstitution: 100 },
    })
    expect(r.l1).toBe(80)
    expect(r.l2aAdjusted).toBeCloseTo(25.5, 10)
    expect(r.l2bAdjusted).toBeCloseTo(5, 10)
    expect(r.capAdjustment).toBeCloseTo(0, 10)
    expect(r.hqla).toBeCloseTo(110.5, 10)
    expect(r.totalOutflows).toBeCloseTo(370, 10)
    expect(r.totalInflows).toBeCloseTo(100, 10)
    expect(r.inflowsCapped).toBeCloseTo(100, 10)
    expect(r.netOutflows).toBeCloseTo(270, 10)
    expect(r.lcr).toBeCloseTo(40.926, 3)
  })

  it('reference (b): 40% cap binds → HQLA = L1 / 0.6', () => {
    const r = computeLcr(hqlaOnly(10, 100, 0))
    expect(r.l2aAdjusted).toBeCloseTo(85, 10)
    expect(r.capAdjustment).toBeCloseTo(85 - 20 / 3, 10)
    expect(r.hqla).toBeCloseTo(10 / 0.6, 10)
    // Level 2 share of HQLA is exactly the 40% cap.
    expect((r.hqla - r.l1) / r.hqla).toBeCloseTo(BCBS_LCR_PARAMS.capL2, 10)
  })

  it('reference (c): 15% cap binds → HQLA = L1 / 0.85, L2B share exactly 15%', () => {
    const r = computeLcr(hqlaOnly(100, 0, 100))
    expect(r.l2bAdjusted).toBeCloseTo(50, 10)
    expect(r.capAdjustment).toBeCloseTo(50 - (15 / 85) * 100, 10)
    expect(r.hqla).toBeCloseTo(100 / 0.85, 10)
    expect((r.l2bAdjusted - r.capAdjustment) / r.hqla).toBeCloseTo(BCBS_LCR_PARAMS.capL2b, 10)
  })

  it('both caps bind → HQLA = L1 / 0.6 and remaining L2B = 15% of HQLA', () => {
    const r = computeLcr(hqlaOnly(10, 100, 100))
    const hqla = 10 / 0.6
    const adj15 = 47.5 // second Annex-1 term: 50 − 15/60 × 10
    const adj40 = 85 + 50 - adj15 - 20 / 3
    expect(r.hqla).toBeCloseTo(hqla, 10)
    expect(r.capAdjustment).toBeCloseTo(adj15 + adj40, 10)
    expect(r.l2bAdjusted - adj15).toBeCloseTo(0.15 * hqla, 10)
  })

  it('reference (d): inflow cap binds at 75% of outflows', () => {
    const r = computeLcr({
      hqla: { l1: 80, l2a: 30, l2b: 10 },
      outflows: { corporateUninsured: 925 },
      inflows: { financialInstitution: 500 },
    })
    expect(r.totalInflows).toBeCloseTo(500, 10)
    expect(r.inflowsCapped).toBeCloseTo(277.5, 10)
    expect(r.netOutflows).toBeCloseTo(92.5, 10)
    expect(r.lcr).toBeCloseTo((110.5 / 92.5) * 100, 10)
  })

  it('reference (e): netOutflows 0 → lcr NaN (no throw)', () => {
    const r = computeLcr(hqlaOnly(100, 0, 0))
    expect(r.netOutflows).toBe(0)
    expect(r.lcr).toBeNaN()
    expect(computeLcr(hqlaOnly(0, 0, 0)).hqla).toBe(0)
  })

  it('applies every run-off and inflow rate; missing categories count as 0', () => {
    const outflows = Object.fromEntries(
      Object.keys(BCBS_LCR_PARAMS.runoff).map((k) => [k, 100]),
    ) as LcrInput['outflows']
    const inflows = Object.fromEntries(
      Object.keys(BCBS_LCR_PARAMS.inflowRates).map((k) => [k, 100]),
    ) as LcrInput['inflows']
    const r = computeLcr({ hqla: { l1: 0, l2a: 0, l2b: 0 }, outflows, inflows })
    expect(r.totalOutflows).toBeCloseTo(690, 10)
    expect(r.totalInflows).toBeCloseTo(300, 10)
    expect(r.inflowsCapped).toBeCloseTo(300, 10)
    expect(computeLcr(hqlaOnly(1, 1, 1)).totalOutflows).toBe(0)
  })

  it('stable retail / SME use 5% by default; the conditional 3% regime is explicit', () => {
    const input: LcrInput = {
      hqla: { l1: 10, l2a: 0, l2b: 0 },
      outflows: { retailStable: 100, smeStable: 100, retailLessStable: 100 },
      inflows: {},
    }
    expect(computeLcr(input).totalOutflows).toBeCloseTo(20, 10)
    expect(computeLcr(input, BCBS_REDUCED_RUNOFF_PARAMS).totalOutflows).toBeCloseTo(16, 10)
    expect(computeLcr(input, KR_LCR_PARAMS).totalOutflows).toBeCloseTo(20, 10)
    expect(KR_LCR_PARAMS.runoff.retailStable).toBe(0.05)
    expect(KR_LCR_PARAMS.runoff.smeStable).toBe(0.05)
    expect(KR_LCR_PARAMS.runoff.corporateUninsured).toBe(BCBS_LCR_PARAMS.runoff.corporateUninsured)
    expect(KR_LCR_PARAMS.haircuts).toEqual(BCBS_LCR_PARAMS.haircuts)
    expect(BCBS_LCR_PARAMS.runoff.retailStable).toBe(0.05)
  })
})
