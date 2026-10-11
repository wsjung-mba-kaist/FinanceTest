import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import type { InstitutionState, ScenarioDefinition } from '../engine/types'
import { loadAllAvailable } from '../scenarios'
import { DEFAULT_THRESHOLDS, mergeThresholds, statusFor } from './thresholds'

describe('statusFor', () => {
  const below = { warn: 100, breach: 80, direction: 'below' as const }
  const above = { warn: 3, breach: 10, direction: 'above' as const }

  it("'below' bands: under breach → breach, under warn → warn, else ok; the boundary is not a breach", () => {
    expect(statusFor(79.9, below)).toBe('breach')
    expect(statusFor(80, below)).toBe('warn')
    expect(statusFor(99.9, below)).toBe('warn')
    expect(statusFor(100, below)).toBe('ok')
  })

  it("'above' bands mirror it", () => {
    expect(statusFor(10.1, above)).toBe('breach')
    expect(statusFor(10, above)).toBe('warn')
    expect(statusFor(3, above)).toBe('ok')
  })

  it("a metric with no band, or no finite value, is 'na' — never a green 정상", () => {
    expect(statusFor(50)).toBe('na')
    expect(statusFor(NaN, below)).toBe('na')
    expect(statusFor(Infinity, above)).toBe('na')
  })

  it('mergeThresholds lets a scenario override a band without losing the others', () => {
    const merged = mergeThresholds({ lcr: { warn: 120, breach: 100, direction: 'below' } })
    expect(merged.lcr!.warn).toBe(120)
    expect(merged.survivalDays).toEqual(DEFAULT_THRESHOLDS.survivalDays)
  })
})

describe('DEFAULT_THRESHOLDS', () => {
  it('every default band names a metric some registered scenario actually produces', async () => {
    const produced = new Set<string>()
    for (const def of await loadAllAvailable()) {
      const s = createGame(def as ScenarioDefinition<InstitutionState>, 1)
      for (const k of Object.keys(s.metricsHistory[0]?.metrics ?? {})) produced.add(k)
    }
    const stale = Object.keys(DEFAULT_THRESHOLDS).filter((k) => !produced.has(k))
    expect(stale, `어떤 시나리오도 만들지 않는 지표의 기본 임계값: ${stale.join(', ')}`).toEqual([])
  })

  it('bands are internally ordered: breach is on the worse side of warn', () => {
    for (const [key, t] of Object.entries(DEFAULT_THRESHOLDS)) {
      if (t.direction === 'below') expect(t.breach, key).toBeLessThanOrEqual(t.warn)
      else expect(t.breach, key).toBeGreaterThanOrEqual(t.warn)
    }
  })
})
