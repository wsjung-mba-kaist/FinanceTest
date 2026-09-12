import { describe, expect, it } from 'vitest'
import type { Units } from '../engine/types/common'
import { formatAt, scaleFor, splitMetric } from './format'

/**
 * A column is only a comparable axis if every cell in it shares a unit. `formatCurrency` picks the
 * unit per value — right for a figure standing alone, wrong the moment two of them stack, because
 * `3.2조원` over `8,500억원` over `920억원` is three axes pretending to be one.
 */
const KRW: Units = { currency: 'KRW', scale: 1e8, display: '억원' }
const USD: Units = { currency: 'USD', scale: 1e9, display: 'B' }

describe('scaleFor', () => {
  it('picks one unit for the whole set, from its largest value', () => {
    // 3.2조 · 8,500억 · 920억, written in 억원 units.
    const scale = scaleFor([32_000, 8_500, 920], KRW)
    expect(scale.label).toBe('조원')
    expect(scale.divisor).toBe(1e12)
  })

  it('keeps the smallest value in the set legible', () => {
    const scale = scaleFor([32_000, 8_500, 920], KRW)
    // 920억 is 0.092조: rounding to one decimal would print 0.1 for every small row alike.
    expect(scale.decimals).toBe(2)
    expect(splitMetric(920, 'ccy', KRW, { scale }).value).toBe('0.09')
  })

  it('does not pad a column that does not need decimals', () => {
    const scale = scaleFor([142, 121, 80], KRW)
    expect(scale.label).toBe('억원')
    expect(scale.decimals).toBe(0)
    expect(splitMetric(80, 'ccy', KRW, { scale }).value).toBe('80')
  })

  it('carries the currency symbol for non-KRW scenarios', () => {
    expect(scaleFor([42, 12], USD).label).toBe('$B')
    expect(scaleFor([0.004], USD).label).toBe('$M')
  })

  it('ignores zeroes and non-finite values when choosing', () => {
    const scale = scaleFor([0, Number.NaN, 32_000], KRW)
    expect(scale.label).toBe('조원')
  })

  /**
   * A metric still sitting at zero has no magnitude of its own, but it is not on a different axis
   * from the rest of the screen. Falling back to the base unit printed `$0.0` next to `$14.0B`.
   */
  it("falls back to the scenario's own unit when there is nothing to measure", () => {
    expect(scaleFor([0, 0], KRW).label).toBe('억원')
    expect(scaleFor([], KRW).label).toBe('억원')
    expect(scaleFor([], USD).label).toBe('$B')
    expect(formatAt(0, 'ccy', USD, { scale: scaleFor([], USD) })).toBe('$0.0B')
  })
})

describe('a fixed scale across a run', () => {
  /**
   * The point of pinning: a metric that collapses during a crisis must not change axis while the
   * reader is watching it. Every value below is rendered against the scale chosen from the peak.
   */
  it('holds its unit as the value collapses', () => {
    const run = [32_000, 18_000, 4_200, 900, 120]
    const scale = scaleFor(run, KRW)
    const units = run.map((v) => splitMetric(v, 'ccy', KRW, { scale }).unit)
    expect(new Set(units).size, `단위가 런 도중 바뀝니다: ${units.join(' → ')}`).toBe(1)
    expect(units[0]).toBe('조원')
  })

  it('would have hopped without one', () => {
    // The behaviour this replaces, stated so the difference is visible.
    const hopping = [32_000, 900].map((v) => splitMetric(v, 'ccy', KRW).unit)
    expect(new Set(hopping).size).toBe(2)
  })
})

describe('splitMetric', () => {
  it('separates the number from its unit so a column can align on the decimal point', () => {
    expect(splitMetric(104.2, '%', KRW)).toEqual({ value: '104.2', unit: '%' })
    expect(splitMetric(-35, 'bp', KRW)).toEqual({ value: '−35', unit: 'bp' })
    expect(splitMetric(2.5, 'days', KRW)).toEqual({ value: '2.5', unit: '일' })
    expect(splitMetric(3, 'count', KRW)).toEqual({ value: '3', unit: '개' })
  })

  it('splits a per-value currency figure at the unit too', () => {
    expect(splitMetric(8_500, 'ccy', KRW)).toEqual({ value: '8,500', unit: '억원' })
    expect(splitMetric(42, 'ccy', USD)).toEqual({ value: '$42.0', unit: 'B' })
  })

  it('keeps the 99+ ceiling a value, not a unit', () => {
    expect(splitMetric(120, 'days', KRW)).toEqual({ value: '99+', unit: '일' })
  })

  it('renders a non-finite value as an em dash with no unit', () => {
    expect(splitMetric(Number.NaN, '%', KRW)).toEqual({ value: '—', unit: '' })
  })

  it('uses the typographic minus, not a hyphen', () => {
    expect(splitMetric(-4.2, '%', KRW).value.startsWith('\u2212')).toBe(true)
  })
})

describe('formatAt', () => {
  it('joins the two parts back up for labels and plain-text export', () => {
    const scale = scaleFor([32_000, 920], KRW)
    expect(formatAt(920, 'ccy', KRW, { scale })).toBe('0.09조원')
    expect(formatAt(104.2, '%', KRW)).toBe('104.2%')
  })

  /**
   * `$` goes before the figure and `억원` after it. Treating the whole unit as a suffix printed
   * `90$M`, which is how the strip's `누적 / 예상` cell read the first time a scale was pinned to it.
   */
  it('keeps the currency symbol in front of the figure', () => {
    const scale = scaleFor([0, 0.09], USD)
    expect(scale.label).toBe('$M')
    expect(formatAt(0.09, 'ccy', USD, { scale })).toBe('$90M')
    expect(formatAt(0, 'ccy', USD, { scale })).toBe('$0M')
    expect(formatAt(-0.09, 'ccy', USD, { scale })).toBe('−$90M')
  })
})
