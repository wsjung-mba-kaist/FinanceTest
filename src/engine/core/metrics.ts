import { produce } from 'immer'
import type { GameState, InstitutionState, MetricSnapshot, ScenarioDefinition } from '../types'
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

/** Recomputes metrics and stores them as the current turn's snapshot (one entry per turn index). */
export function snapshotMetrics<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  const snap = computeMetrics(state, scenario)
  return produce(state, (d) => {
    const idx = d.metricsHistory.findIndex((m) => m.turnIndex === d.turnIndex)
    if (idx >= 0) d.metricsHistory[idx] = snap
    else d.metricsHistory.push(snap)
  })
}
