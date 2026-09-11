import { describe, expect, it } from 'vitest'
import { BCBS_NSFR_PARAMS, computeNsfr } from './nsfr'
import type { NsfrInput } from './types'

// ASF: 200 + 380 + 180 + 200 + 0 + 240 = 1200
// RSF: 0 + 10 + 15 + 50 + 10 + 100 + 390 + 340 + 40 + 10 = 965
const reference: NsfrInput = {
  asf: {
    capital: 200,
    retailStable: 400,
    retailLessStable: 200,
    corporateUnder1y: 400,
    otherUnder6m: 300,
    over1y: 240,
  },
  rsf: {
    cash: 100,
    l1: 200,
    l2a: 100,
    l2b: 100,
    loansFiUnder6m: 100,
    otherUnder1y: 200,
    mortgagesOver1y: 600,
    otherLoans: 400,
    otherAssets: 40,
    offBalance: 200,
  },
}

const zeroAsf: NsfrInput['asf'] = {
  capital: 0,
  retailStable: 0,
  retailLessStable: 0,
  corporateUnder1y: 0,
  otherUnder6m: 0,
  over1y: 0,
}
const zeroRsf: NsfrInput['rsf'] = {
  cash: 0,
  l1: 0,
  l2a: 0,
  l2b: 0,
  loansFiUnder6m: 0,
  otherUnder1y: 0,
  mortgagesOver1y: 0,
  otherLoans: 0,
  otherAssets: 0,
  offBalance: 0,
}

describe('computeNsfr', () => {
  it('reference: ASF 1200 / RSF 965 → NSFR ≈ 124.35%', () => {
    const r = computeNsfr(reference)
    expect(r.asf).toBeCloseTo(1200, 10)
    expect(r.rsf).toBeCloseTo(965, 10)
    expect(r.nsfr).toBeCloseTo(124.352, 3)
  })

  it('RSF 0 → NaN (no throw)', () => {
    const r = computeNsfr({ asf: reference.asf, rsf: zeroRsf })
    expect(r.rsf).toBe(0)
    expect(r.nsfr).toBeNaN()
  })

  it('cash and short-term FI funding carry a 0% factor', () => {
    const r = computeNsfr({
      asf: { ...zeroAsf, otherUnder6m: 500 },
      rsf: { ...zeroRsf, cash: 500 },
    })
    expect(r.asf).toBe(0)
    expect(r.rsf).toBe(0)
  })

  it('accepts custom params without mutating the defaults', () => {
    const params = { ...BCBS_NSFR_PARAMS, rsf: { ...BCBS_NSFR_PARAMS.rsf, offBalance: 0.1 } }
    expect(computeNsfr(reference, params).rsf).toBeCloseTo(975, 10)
    expect(BCBS_NSFR_PARAMS.rsf.offBalance).toBe(0.05)
  })
})
