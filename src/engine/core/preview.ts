import type {
  FeedItem,
  GameState,
  InstitutionState,
  MetricDelta,
  MetricSnapshot,
  ScenarioDefinition,
} from '../types'
import { applyDecision, DecisionError } from './applyDecision'
import { latestSnapshot } from './metrics'

export interface PreviewResult {
  deltas: MetricDelta[]
  delayed: { afterTurns: number; description: string }[]
  feed: FeedItem[]
  wouldEnd?: { title: string; failed: boolean }
  error?: string
}

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

/**
 * Runs the option's immediate effects on a throw-away copy and reports metric deltas.
 * The engine is pure, so the original state and its RNG are untouched.
 */
export function previewOption<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  decisionId: string,
  optionIds: string[],
): PreviewResult {
  try {
    const next = applyDecision(state, scenario, decisionId, optionIds)
    const turn = scenario.turns[state.turnIndex]
    const decision = turn?.decisions.find((d) => d.id === decisionId)
    const delayed: PreviewResult['delayed'] = []
    for (const id of optionIds) {
      const o = decision?.options.find((x) => x.id === id)
      o?.delayedEffects?.forEach((d) =>
        delayed.push({ afterTurns: d.afterTurns, description: d.description }),
      )
    }
    return {
      deltas: diffSnapshots(latestSnapshot(state as GameState), latestSnapshot(next as GameState)),
      delayed,
      feed: next.feed.slice(state.feed.length),
      ...(next.ended ? { wouldEnd: { title: next.ended.title, failed: next.ended.failed } } : {}),
    }
  } catch (e) {
    const msg = e instanceof DecisionError ? e.message : e instanceof Error ? e.message : String(e)
    return { deltas: [], delayed: [], feed: [], error: msg }
  }
}
