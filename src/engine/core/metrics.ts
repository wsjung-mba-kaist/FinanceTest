import { produce } from 'immer'
import type {
  GameState,
  InstitutionState,
  MetricDelta,
  MetricSnapshot,
  ScenarioDefinition,
} from '../types'
import { computeMetricsFor } from '../../metrics/byInstitution'
import { mergeThresholds } from '../../metrics/thresholds'
import { EMPTY_SNAPSHOT } from './effects'

export function computeMetrics<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): MetricSnapshot {
  return computeMetricsFor(state as GameState, mergeThresholds(scenario.thresholds))
}

export function latestSnapshot(state: GameState): MetricSnapshot {
  return state.metricsHistory[state.metricsHistory.length - 1] ?? EMPTY_SNAPSHOT
}

/** Metric-by-metric difference between two snapshots (non-finite and unchanged keys dropped). */
export function diffSnapshots(before: MetricSnapshot, after: MetricSnapshot): MetricDelta[] {
  const out: MetricDelta[] = []
  for (const [key, a] of Object.entries(after.metrics)) {
    const b = before.metrics[key]
    if (!b) continue
    if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) continue
    const delta = a.value - b.value
    if (Math.abs(delta) < 1e-9) continue
    out.push({
      key,
      label: a.label,
      unit: a.unit,
      before: b.value,
      after: a.value,
      delta,
      statusBefore: b.status,
      statusAfter: a.status,
    })
  }
  return out
}

/** Maximum number of intra-turn samples kept in `tickHistory` (oldest dropped). */
export const TICK_HISTORY_CAP = 240

/**
 * Recomputes metrics and stores them as the current turn's snapshot (**one entry per turn index** —
 * scoring, conditions and the debrief all rely on that) plus one intra-turn sample per
 * `(turnIndex, tick)` in `tickHistory` for live sparklines and tickers.
 */
export function snapshotMetrics<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  const snap = computeMetrics(state, scenario)
  const values: Record<string, number> = {}
  // every finite value (including `status: 'na'` metrics, which are raw numbers without a threshold)
  for (const [key, m] of Object.entries(snap.metrics)) {
    if (Number.isFinite(m.value)) values[key] = m.value
  }
  return produce(state, (d) => {
    const idx = d.metricsHistory.findIndex((m) => m.turnIndex === d.turnIndex)
    if (idx >= 0) d.metricsHistory[idx] = snap
    else d.metricsHistory.push(snap)
    const sample = { turnIndex: d.turnIndex, tick: d.tick, values }
    const ti = d.tickHistory.findIndex((t) => t.turnIndex === d.turnIndex && t.tick === d.tick)
    if (ti >= 0) d.tickHistory[ti] = sample
    else d.tickHistory.push(sample)
    if (d.tickHistory.length > TICK_HISTORY_CAP)
      d.tickHistory.splice(0, d.tickHistory.length - TICK_HISTORY_CAP)
  })
}
