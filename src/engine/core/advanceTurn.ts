import { produce } from 'immer'
import type { Decision, GameState, InstitutionState, ScenarioDefinition } from '../types'
import { isDecisionResolved } from './applyDecision'
import { buildConditionContext, evaluate } from './conditions'
import { pickEnding } from './gameOver'
import { startTurn } from './startTurn'
import { fastForwardTicks } from './tick'

export function activeDecisions<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): Decision<S>[] {
  const turn = scenario.turns[state.turnIndex]
  if (!turn) return []
  const ctx = buildConditionContext(state as GameState)
  return turn.decisions.filter((d) => evaluate(d.when, ctx) && (d.availableFrom ?? 0) <= state.tick)
}

export function unresolvedRequiredDecisions<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): Decision<S>[] {
  return activeDecisions(state, scenario).filter(
    (d) => (d.required ?? true) && !isDecisionResolved(state as GameState, d.id),
  )
}

export function isLastTurn(state: GameState, scenario: ScenarioDefinition): boolean {
  return state.turnIndex >= scenario.turns.length - 1
}

/**
 * Ends the current turn. Any unplayed ticks are fast-forwarded first (so autoplay, replay and the
 * store's "next turn" button never need a UI clock), which also runs the deadline sweep.
 */
export function advanceTurn<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  if (state.phase === 'ended') throw new Error('시나리오가 이미 종료되었습니다')
  const s = fastForwardTicks(state, scenario)
  if (s.phase === 'ended') return s
  const unresolved = unresolvedRequiredDecisions(s, scenario)
  if (unresolved.length > 0) {
    throw new Error(`미확정 결정이 있습니다: ${unresolved.map((d) => d.id).join(', ')}`)
  }
  if (isLastTurn(s as GameState, scenario as unknown as ScenarioDefinition)) {
    const ending = pickEnding(s, scenario)
    return produce(s, (d) => {
      d.phase = 'ended'
      d.ended = {
        reason: 'completed',
        turnIndex: d.turnIndex,
        title: ending?.title ?? '시나리오 종료',
        narrative: ending?.narrative ?? '',
        failed: false,
      }
      d.feed.push({
        id: `f${d.turnIndex}-${d.feed.length}`,
        turnIndex: d.turnIndex,
        ...(d.tick ? { tick: d.tick } : {}),
        kind: 'system',
        severity: 'positive',
        title: d.ended.title,
        body: d.ended.narrative,
      })
      d.log.push(`[T${d.turnIndex}] 시나리오 완료: ${ending?.id ?? 'default'}`)
    })
  }
  const next = produce(s, (d) => {
    d.turnIndex += 1
  })
  return startTurn(next, scenario)
}
