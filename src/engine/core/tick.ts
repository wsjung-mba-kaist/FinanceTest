import { produce, type Draft } from 'immer'
import type { EffectContext, GameState, InstitutionState, ScenarioDefinition, Turn } from '../types'
import { applyDecision, DecisionError, isDecisionResolved } from './applyDecision'
import { buildConditionContext, evaluate } from './conditions'
import { fireDuePending } from './delayed'
import { applyEffects, makeEffectContext } from './effects'
import { applyGameOver, checkGameOver } from './gameOver'
import { latestSnapshot, snapshotMetrics } from './metrics'
import { DEFAULT_NOISE, gaussian, noiseFactor } from './noise'
import { getNumberPath, setNumberPath } from './paths'
import { buildReel, withReel } from './reel'
import { tickCount } from './lookup'

export { tickCount } from './lookup'

/** True while the current turn still has an unplayed tick. */
export function canAdvanceTick<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): boolean {
  if (state.phase === 'ended') return false
  const turn = scenario.turns[state.turnIndex]
  if (!turn) return false
  return state.tick < tickCount(turn) - 1
}

/** Captures the `market.*` anchors the turn's ticker series move away from. */
export function captureTickerBase<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  turn: Turn<S>,
): void {
  const base: Record<string, number> = {}
  for (const series of turn.ticker?.series ?? []) {
    const v = getNumberPath(draft, series.path)
    if (v !== undefined) base[series.path] = v
  }
  draft.tickerBase = base
}

function tickerNoiseBp(ctx: EffectContext): number {
  if (ctx.variance === 0) return 0
  const sigmaBp = ctx.noise?.tickerSigmaBp ?? DEFAULT_NOISE.tickerSigmaBp
  return gaussian(ctx.rng) * sigmaBp * ctx.variance
}

/**
 * Moves each ticker series one tick: `relative` multiplies the target path by `values[k]/values[k-1]`,
 * `absolute` adds `values[k] - values[k-1]`. `values[0]` is the tick-0 anchor, so tick 0 moves nothing.
 * The ticker never touches `confidence` — ΔCI events already price the move.
 */
function applyTicker<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  turn: Turn<S>,
  ctx: EffectContext,
): void {
  if (!turn.ticker || ctx.tick === 0) return
  for (const series of turn.ticker.series) {
    const prev = series.values[ctx.tick - 1]
    const cur = series.values[ctx.tick]
    if (prev === undefined || cur === undefined) continue
    const v = getNumberPath(draft, series.path)
    if (v === undefined) {
      ctx.log(`[warn] 티커 경로가 숫자가 아닙니다: ${series.path}`)
      continue
    }
    if (series.mode === 'relative') {
      if (prev === 0) continue
      const factor =
        (cur / prev) * noiseFactor(ctx, ctx.noise?.tickerSigma ?? DEFAULT_NOISE.tickerSigma, 0.1)
      setNumberPath(draft, series.path, v * factor)
    } else {
      setNumberPath(draft, series.path, v + (cur - prev) + tickerNoiseBp(ctx))
    }
  }
}

function openScheduledInterrupts<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  turn: Turn<S>,
  ctx: EffectContext,
): void {
  for (const it of turn.interrupts ?? []) {
    const at = draft.tickSchedule[it.id] ?? it.atTick
    if (at !== draft.tick) continue
    if (draft.openInterrupts.includes(it.id)) continue
    if (isDecisionResolved(draft as unknown as GameState, it.id)) continue
    if (!evaluate(it.when, buildConditionContext(draft as unknown as GameState))) continue
    draft.openInterrupts.push(it.id)
    draft.feed.push({
      id: `f${draft.turnIndex}-${draft.feed.length}`,
      turnIndex: draft.turnIndex,
      ...(draft.tick ? { tick: draft.tick } : {}),
      kind: 'system',
      severity: it.source.tone === 'urgent' ? 'warning' : 'info',
      channel: 'internal',
      title: `${it.source.caller}${it.source.agency ? ` (${it.source.agency})` : ''} 연결`,
      body: it.lines[0]?.text ?? it.prompt,
    })
    ctx.log(`인터럽트 개시: ${it.id} (${it.source.caller})`)
  }
}

/**
 * The per-tick body shared by `startTurn` (tick 0, after `entryEffects`) and `advanceTick`:
 * `eachTick` → `tickEffects` → scheduled events → ticker → interrupts.
 */
export function runTickPhase<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  turn: Turn<S>,
  ctx: EffectContext,
): void {
  for (const ce of turn.eachTick ?? []) {
    if (!evaluate(ce.when, buildConditionContext(draft as unknown as GameState))) continue
    if (ce.description) ctx.log(`틱 ${draft.tick}: ${ce.description}`)
    applyEffects(draft, ce.effects, ctx)
  }
  for (const ce of turn.tickEffects ?? []) {
    if (ce.atTick !== draft.tick) continue
    if (!evaluate(ce.when, buildConditionContext(draft as unknown as GameState))) continue
    if (ce.description) ctx.log(`틱 ${draft.tick}: ${ce.description}`)
    applyEffects(draft, ce.effects, ctx)
  }
  for (const ev of turn.events) {
    if (!ev.effects || ev.effects.length === 0) continue
    const at = draft.tickSchedule[ev.id] ?? ev.atTick ?? 0
    if (at !== draft.tick) continue
    if (!evaluate(ev.when, buildConditionContext(draft as unknown as GameState))) continue
    applyEffects(draft, ev.effects, ctx)
  }
  applyTicker(draft, turn, ctx)
  openScheduledInterrupts(draft, turn, ctx)
}

/**
 * Commits anything whose deadline has passed: active unresolved decisions with
 * `deadlineTick < tick` and an authored `defaultOptionId`, then open interrupts past their
 * deadline. Each is applied through `applyDecision` with `{ timedOut: true }`, so effects,
 * delayed effects, scoring and the timeout counter behave exactly like a player answer.
 */
export function sweepDeadlines<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  turn: Turn<S>,
): GameState<S> {
  let s = state
  const commit = (id: string, optionId: string): void => {
    try {
      s = applyDecision(s, scenario, id, [optionId], { timedOut: true })
    } catch (e) {
      const msg =
        e instanceof DecisionError ? e.message : e instanceof Error ? e.message : String(e)
      s = produce(s, (d) => {
        d.log.push(`[T${d.turnIndex}] 마감 자동 확정 실패 ${id}: ${msg}`)
      })
    }
  }
  for (const decision of turn.decisions) {
    if (s.phase === 'ended') return s
    const deadline = decision.deadlineTick
    if (deadline === undefined || deadline >= s.tick) continue
    if (!decision.defaultOptionId) continue
    if (isDecisionResolved(s as GameState, decision.id)) continue
    if (!evaluate(decision.when, buildConditionContext(s as GameState))) continue
    commit(decision.id, decision.defaultOptionId)
  }
  for (const id of [...s.openInterrupts]) {
    if (s.phase === 'ended') return s
    const it = turn.interrupts?.find((x) => x.id === id)
    if (!it) continue
    const deadline = it.deadlineTick ?? s.tickSchedule[id] ?? it.atTick
    if (deadline >= s.tick) continue
    commit(id, it.defaultOptionId)
  }
  return s
}

/**
 * Commits every still-open interrupt with its `defaultOptionId`, regardless of deadline. Used once
 * at the end of a turn, where there is no later tick for the ordinary sweep to run on.
 */
export function sweepOpenInterrupts<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  turn: Turn<S>,
): GameState<S> {
  let s = state
  for (const id of [...s.openInterrupts]) {
    if (s.phase === 'ended') return s
    const it = turn.interrupts?.find((x) => x.id === id)
    if (!it) continue
    try {
      s = applyDecision(s, scenario, id, [it.defaultOptionId], { timedOut: true })
    } catch (e) {
      const msg = e instanceof DecisionError ? e.message : e instanceof Error ? e.message : String(e)
      s = produce(s, (d) => {
        d.log.push(`[T${d.turnIndex}] 턴 마감 자동 확정 실패 ${id}: ${msg}`)
      })
    }
  }
  return s
}

/**
 * Advances the simulated clock by one sub-turn tick:
 *  1. tick += 1
 *  2. fire pending delayed effects that are due at (turn, tick)
 *  3. `eachTick` → 4. `tickEffects` → 5. scheduled events → 6. ticker → 7. interrupts
 *  8. metric snapshot (one `metricsHistory` entry per turn + one `tickHistory` sample per tick)
 *  9. game-over check → 10. deadline sweep → 11. consequence reel
 */
export function advanceTick<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  if (state.phase === 'ended') throw new Error('시나리오가 이미 종료되었습니다')
  const turn = scenario.turns[state.turnIndex]
  if (!turn) throw new Error(`턴 인덱스 ${state.turnIndex}가 시나리오 범위를 벗어났습니다`)
  const ticks = tickCount(turn)
  if (state.tick >= ticks - 1) throw new Error(`턴 ${turn.id}의 마지막 틱입니다`)

  const before = state
  let s = produce(state, (d) => {
    d.tick += 1
    const ctx = makeEffectContext(d, latestSnapshot(state as GameState), {
      ticks,
      noise: scenario.noise,
    })
    fireDuePending(d, scenario, ctx)
    runTickPhase(d, turn, ctx)
  })
  s = snapshotMetrics(s, scenario)
  const rule = checkGameOver(s, scenario)
  if (rule) s = applyGameOver(s, rule)
  s = sweepDeadlines(s, scenario, turn)
  return withReel(s, buildReel(before, s, { kind: 'tick' }, { interrupts: turn.interrupts }))
}

/** Plays out every remaining tick of the current turn (used by `advanceTurn`, autoplay and replay). */
export function fastForwardTicks<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameState<S> {
  let s = state
  let guard = 0
  while (canAdvanceTick(s, scenario)) {
    s = advanceTick(s, scenario)
    if (++guard > 512) throw new Error('fastForwardTicks: 최대 틱 초과')
  }
  // The per-tick sweep runs at the tick *after* a deadline, so an interrupt that opens on the last
  // tick of a turn would never auto-commit — its required `defaultOptionId` would be unreachable and
  // the turn could not resolve. Closing the day is the last chance to answer, so sweep here too.
  // Decisions are deliberately not swept: an unanswered decision blocks the turn, which is correct.
  if (s.phase !== 'ended' && s.openInterrupts.length > 0) {
    const turn = scenario.turns[s.turnIndex]
    if (turn) s = sweepOpenInterrupts(s, scenario, turn)
  }
  return s
}
