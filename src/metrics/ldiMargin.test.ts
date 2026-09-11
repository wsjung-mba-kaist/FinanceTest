import { describe, expect, it } from 'vitest'
import { LDI_STANDARD_BUFFER_BP, computeLdiMargin } from './ldiMargin'

const base = { exposure: 300, equity: 100, modDuration: 20, collateral: 60 }

describe('computeLdiMargin', () => {
  it('reference: 3x leverage, pv01 0.6, 100bp buffer; +130bp → loss 78, shortfall 18', () => {
    const r = computeLdiMargin({ ...base, deltaYieldBp: 130 })
    expect(r.leverage).toBeCloseTo(3, 10)
    expect(r.pv01).toBeCloseTo(0.6, 10)
    expect(r.bufferBp).toBeCloseTo(100, 10)
    expect(r.loss).toBeCloseTo(78, 10)
    expect(r.marginCall).toBeCloseTo(78, 10)
    expect(r.shortfall).toBeCloseTo(18, 10)
    expect(r.recapNeeded).toBeCloseTo(18, 10)
    expect(r.postMoveLeverage).toBeCloseTo(300 / 22, 10)
    expect(r.postMoveLeverage).toBeCloseTo(13.64, 2)
  })

  it('a move inside the buffer has no shortfall; the 250bp standard is exported', () => {
    const r = computeLdiMargin({ ...base, deltaYieldBp: 50 })
    expect(r.loss).toBeCloseTo(30, 10)
    expect(r.shortfall).toBe(0)
    expect(r.postMoveLeverage).toBeCloseTo(300 / 70, 10)
    expect(LDI_STANDARD_BUFFER_BP).toBe(250)
    // A 250bp move would need 150 of collateral against 60 held.
    expect(computeLdiMargin({ ...base, deltaYieldBp: 250 }).shortfall).toBeCloseTo(90, 10)
  })

  it('yield fall → negative loss / margin call (collateral flows back), no shortfall', () => {
    const r = computeLdiMargin({ ...base, deltaYieldBp: -100 })
    expect(r.loss).toBeCloseTo(-60, 10)
    expect(r.marginCall).toBeCloseTo(-60, 10)
    expect(r.shortfall).toBe(0)
    expect(r.postMoveLeverage).toBeCloseTo(300 / 160, 10)
  })

  it('loss wiping out equity → postMoveLeverage Infinity (documented sentinel)', () => {
    // pv01 0.6 × 200bp = 120 > equity 100
    const r = computeLdiMargin({ ...base, deltaYieldBp: 200 })
    expect(r.loss).toBeCloseTo(120, 10)
    expect(r.postMoveLeverage).toBe(Infinity)
    // Exactly wiped out is also Infinity.
    const exact = computeLdiMargin({ ...base, deltaYieldBp: 100 / 0.6 })
    expect(exact.loss).toBeCloseTo(100, 10)
    expect(exact.postMoveLeverage).toBe(Infinity)
  })

  it('zero denominators → NaN (no throw)', () => {
    const noEquity = computeLdiMargin({ ...base, equity: 0, deltaYieldBp: 10 })
    expect(noEquity.leverage).toBeNaN()
    expect(noEquity.postMoveLeverage).toBe(Infinity)
    const noDuration = computeLdiMargin({ ...base, modDuration: 0, deltaYieldBp: 10 })
    expect(noDuration.pv01).toBe(0)
    expect(noDuration.bufferBp).toBeNaN()
    expect(noDuration.loss).toBe(0)
    expect(noDuration.shortfall).toBe(0)
  })
})
