import type {
  FeedItem,
  GameState,
  InstitutionState,
  MetricDelta,
  ScenarioDefinition,
  Turn,
} from '../types'
import { applyDecision, DecisionError } from './applyDecision'
import { diffSnapshots, latestSnapshot } from './metrics'
import { findTurnDecision } from './lookup'

export { diffSnapshots } from './metrics'

export interface PreviewResult {
  deltas: MetricDelta[]
  delayed: { afterTurns: number; description: string; conditional?: boolean }[]
  feed: FeedItem[]
  wouldEnd?: { title: string; failed: boolean }
  error?: string
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
    const decision = turn ? findTurnDecision(turn as unknown as Turn, decisionId) : undefined
    const delayed: PreviewResult['delayed'] = []
    for (const id of optionIds) {
      const o = decision?.options.find((x) => x.id === id)
      o?.delayedEffects?.forEach((d) =>
        delayed.push({
          afterTurns: d.afterTurns,
          description: d.description,
          ...(d.when ? { conditional: true } : {}),
        }),
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
