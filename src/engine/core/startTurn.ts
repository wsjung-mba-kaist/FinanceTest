import { produce } from 'immer'
import type { GameState, InstitutionState, ScenarioDefinition } from '../types'
import { buildConditionContext, evaluate } from './conditions'
import { fireDuePending } from './delayed'
import { applyEffects, makeEffectContext } from './effects'
import { applyGameOver, checkGameOver } from './gameOver'
import { latestSnapshot, snapshotMetrics } from './metrics'

/**
 * Turn start pipeline:
 *  1. fire due delayed effects (re-evaluating their conditions)
 *  2. apply exogenous entry effects (conditional)
 *  3. apply effects attached to visible events
 *  4. snapshot metrics
 *  5. check game-over rules
 */
export function startTurn<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  const turn = scenario.turns[state.turnIndex]
  if (!turn) throw new Error(`턴 인덱스 ${state.turnIndex}가 시나리오 범위를 벗어났습니다`)

  let s = state
  s = produce(s, (d) => {
    d.log.push(`[T${d.turnIndex}] ── ${turn.label} ${turn.timeLabel} ──`)
    const ctx = makeEffectContext(d, latestSnapshot(s as GameState))
    fireDuePending(d, scenario, ctx)
  })

  if (turn.entryEffects && turn.entryEffects.length > 0) {
    const entry = turn.entryEffects
    s = produce(s, (d) => {
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState))
      for (const ce of entry) {
        if (!evaluate(ce.when, buildConditionContext(d as unknown as GameState))) continue
        if (ce.description) ctx.log(`외생: ${ce.description}`)
        applyEffects(d, ce.effects, ctx)
      }
    })
  }

  const eventsWithEffects = turn.events.filter((e) => e.effects && e.effects.length > 0)
  if (eventsWithEffects.length > 0) {
    s = produce(s, (d) => {
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState))
      for (const ev of eventsWithEffects) {
        if (!evaluate(ev.when, buildConditionContext(d as unknown as GameState))) continue
        applyEffects(d, ev.effects ?? [], ctx)
      }
    })
  }

  s = snapshotMetrics(s, scenario)
  const rule = checkGameOver(s, scenario)
  if (rule) s = applyGameOver(s, rule)
  return s
}
