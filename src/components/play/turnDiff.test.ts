import { describe, expect, it } from 'vitest'
import type { GameState, MetricSnapshot, MetricValue, ScenarioDefinition } from '../../engine'
import { turnDiff } from './turnDiff'

/**
 * "무엇이 바뀌었나" had no lasting home on the play screen. The consequence reel says it once, over a
 * few seconds, and is then gone — a reader who looked away had no way to ask again, and the
 * dashboard answers a different question (where the numbers *are*, not what they just did).
 *
 * The ordering is the whole design: a reader has a handful of lines of attention, and the row that
 * crossed a threshold band is the one they must not miss.
 */
function metric(key: string, value: number, status: MetricValue['status']): MetricValue {
  return { key, value, unit: '%', status, label: key }
}

function snapshot(turnIndex: number, metrics: MetricValue[]): MetricSnapshot {
  return { turnIndex, metrics: Object.fromEntries(metrics.map((m) => [m.key, m])) }
}

function state(history: MetricSnapshot[]): GameState {
  return { turnIndex: history[history.length - 1]!.turnIndex, metricsHistory: history } as GameState
}

const scenario = { kpis: [{ metric: 'lcr', label: 'LCR', unit: '%' }] } as ScenarioDefinition

describe('turnDiff', () => {
  it('is empty on the first turn, when there is nothing to compare against', () => {
    expect(turnDiff(scenario, state([snapshot(0, [metric('lcr', 120, 'ok')])]))).toEqual([])
  })

  it('reports only what actually moved', () => {
    const rows = turnDiff(
      scenario,
      state([
        snapshot(0, [metric('lcr', 120, 'ok'), metric('cet1', 11, 'ok')]),
        snapshot(1, [metric('lcr', 104, 'warn'), metric('cet1', 11, 'ok')]),
      ]),
    )
    expect(rows.map((r) => r.key)).toEqual(['lcr'])
    expect(rows[0]).toMatchObject({ before: 120, after: 104, delta: -16, statusAfter: 'warn' })
  })

  it('puts a band crossing above a larger move that crossed nothing', () => {
    const rows = turnDiff(
      scenario,
      state([
        snapshot(0, [metric('lcr', 101, 'ok'), metric('nsfr', 200, 'ok')]),
        // nsfr moved 50%, lcr moved 2% — but only lcr changed what it *means*.
        snapshot(1, [metric('lcr', 99, 'warn'), metric('nsfr', 100, 'ok')]),
      ]),
    )
    expect(rows.map((r) => r.key)).toEqual(['lcr', 'nsfr'])
  })

  it('ranks the worse state first among crossings', () => {
    const rows = turnDiff(
      scenario,
      state([
        snapshot(0, [metric('a', 10, 'ok'), metric('b', 10, 'ok')]),
        snapshot(1, [metric('a', 9, 'warn'), metric('b', 9, 'breach')]),
      ]),
    )
    expect(rows.map((r) => r.key)).toEqual(['b', 'a'])
  })

  it('prefers the authored KPI label over the engine label', () => {
    const rows = turnDiff(
      scenario,
      state([snapshot(0, [metric('lcr', 120, 'ok')]), snapshot(1, [metric('lcr', 104, 'warn')])]),
    )
    expect(rows[0]!.label).toBe('LCR')
  })

  it('caps the list so it stays scannable', () => {
    const before = Array.from({ length: 12 }, (_, i) => metric(`m${i}`, 100, 'ok'))
    const after = Array.from({ length: 12 }, (_, i) => metric(`m${i}`, 100 - i - 1, 'ok'))
    expect(turnDiff(scenario, state([snapshot(0, before), snapshot(1, after)]))).toHaveLength(6)
  })

  it('ignores non-finite values rather than rendering NaN', () => {
    const rows = turnDiff(
      scenario,
      state([
        snapshot(0, [metric('lcr', Number.NaN, 'na')]),
        snapshot(1, [metric('lcr', 104, 'warn')]),
      ]),
    )
    expect(rows).toEqual([])
  })
})
