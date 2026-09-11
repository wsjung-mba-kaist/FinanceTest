import { produce } from 'immer'
import type { GameState, InstitutionState, ScenarioDefinition } from '../types'
import { buildConditionContext, evaluate } from './conditions'
import { fireDuePending } from './delayed'
import { applyEffects, makeEffectContext } from './effects'
import { applyGameOver, checkGameOver } from './gameOver'
import { tickCount } from './lookup'
import { latestSnapshot, snapshotMetrics } from './metrics'
import { scheduleTurn } from './noise'
import { buildReel, withReel } from './reel'
import { captureTickerBase, runTickPhase } from './tick'

/**
 * Turn start pipeline (= tick 0 of the turn):
 *  1. fire due delayed effects (re-evaluating their conditions)
 *  2. apply exogenous entry effects (conditional)
 *  3. resolve the tick schedule (jitter is only drawn when `variance > 0`) and the ticker anchors
 *  4. run the tick-0 phase: `eachTick` → `tickEffects` → events scheduled at tick 0 → ticker → interrupts
 *  5. snapshot metrics
 *  6. check game-over rules
 *  7. build the consequence reel
 *
 * `eachTick` runs *after* `entryEffects` so a scenario can move `runoffStep` out of `entryEffects`
 * without changing the order in which the turn's effects land.
 */
export function startTurn<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  const turn = scenario.turns[state.turnIndex]
  if (!turn) throw new Error(`턴 인덱스 ${state.turnIndex}가 시나리오 범위를 벗어났습니다`)
  const ticks = tickCount(turn)
  const before = state

  let s = state
  s = produce(s, (d) => {
    d.tick = 0
    d.openInterrupts = []
    d.log.push(`[T${d.turnIndex}] ── ${turn.label} ${turn.timeLabel} ──`)
    const ctx = makeEffectContext(d, latestSnapshot(s as GameState), {
      ticks,
      noise: scenario.noise,
    })
    fireDuePending(d, scenario, ctx)
  })

  if (turn.entryEffects && turn.entryEffects.length > 0) {
    const entry = turn.entryEffects
    s = produce(s, (d) => {
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState), {
        ticks,
        noise: scenario.noise,
      })
      for (const ce of entry) {
        if (!evaluate(ce.when, buildConditionContext(d as unknown as GameState))) continue
        if (ce.description) ctx.log(`외생: ${ce.description}`)
        applyEffects(d, ce.effects, ctx)
      }
    })
  }

  s = produce(s, (d) => {
    scheduleTurn(d, turn, scenario, ticks)
    captureTickerBase(d, turn)
    const ctx = makeEffectContext(d, latestSnapshot(s as GameState), {
      ticks,
      noise: scenario.noise,
    })
    runTickPhase(d, turn, ctx)
  })

  s = snapshotMetrics(s, scenario)
  const rule = checkGameOver(s, scenario)
  if (rule) s = applyGameOver(s, rule)
  return withReel(s, buildReel(before, s, { kind: 'turn' }, { interrupts: turn.interrupts }))
}
