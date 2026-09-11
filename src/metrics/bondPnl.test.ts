import { describe, expect, it } from 'vitest'
import { computeBondPnl } from './bondPnl'

describe('computeBondPnl', () => {
  it('MV 100, D 5, +100bp → pnl −5.00, pct −5%', () => {
    const r = computeBondPnl({ marketValue: 100, modDuration: 5, deltaYieldBp: 100 })
    expect(r.pnl).toBeCloseTo(-5, 10)
    expect(r.pctChange).toBeCloseTo(-5, 10)
  })

  it('convexity 50 adds back ½·C·Δy²·MV → −4.75', () => {
    const r = computeBondPnl({ marketValue: 100, modDuration: 5, deltaYieldBp: 100, convexity: 50 })
    expect(r.pnl).toBeCloseTo(-4.75, 10)
    expect(r.pctChange).toBeCloseTo(-4.75, 10)
  })

  it('SVB sanity: MV 91, D 6, +250bp → ≈ −13.65', () => {
    const r = computeBondPnl({ marketValue: 91, modDuration: 6, deltaYieldBp: 250 })
    expect(r.pnl).toBeCloseTo(-13.65, 10)
    expect(r.pctChange).toBeCloseTo(-15, 10)
  })

  it('yield fall is a gain; convexity helps in both directions', () => {
    const noConvexity = computeBondPnl({ marketValue: 100, modDuration: 5, deltaYieldBp: -100 })
    expect(noConvexity.pnl).toBeCloseTo(5, 10)
    const withConvexity = computeBondPnl({
      marketValue: 100,
      modDuration: 5,
      deltaYieldBp: -100,
      convexity: 50,
    })
    expect(withConvexity.pnl).toBeCloseTo(5.25, 10)
  })

  it('zero move and zero market value are well defined (no throw)', () => {
    const flat = computeBondPnl({ marketValue: 100, modDuration: 5, deltaYieldBp: 0 })
    expect(flat.pnl).toBeCloseTo(0, 10)
    expect(flat.pctChange).toBeCloseTo(0, 10)
    const empty = computeBondPnl({ marketValue: 0, modDuration: 5, deltaYieldBp: 100 })
    expect(empty.pnl).toBeCloseTo(0, 10)
    expect(empty.pctChange).toBeCloseTo(-5, 10)
  })
})
