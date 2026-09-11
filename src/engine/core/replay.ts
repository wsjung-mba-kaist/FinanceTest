import type { DecisionRecord, GameState, InstitutionState, ScenarioDefinition } from '../types'
import { advanceTurn } from './advanceTurn'
import { applyDecision, isDecisionResolved } from './applyDecision'
import { createGame } from './createGame'
import { advanceTick, canAdvanceTick, fastForwardTicks } from './tick'

export interface ReplayLog {
  seed: number
  decisions: DecisionRecord[]
  /** Turn index the run had reached (may be beyond the last decision's turn). */
  turnIndex?: number
  /** Tick within `turnIndex` to stop at; omitted ⇒ the last tick of that turn. */
  tick?: number
  /** Volatility the run was played at (default 0 = canonical). */
  variance?: number
}

export interface ReplayResult<S extends InstitutionState> {
  state: GameState<S>
  /** State at the start of each turn (index = turn index) for rewind. */
  history: GameState<S>[]
}

/** Deterministically rebuilds a run from its seed, variance and decision log. */
export function replay<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  log: ReplayLog,
): ReplayResult<S> {
  let s = createGame(scenario, log.seed, { variance: log.variance ?? 0 })
  const history: GameState<S>[] = [s]
  const tickTo = (from: GameState<S>, target: number): GameState<S> => {
    let cur = from
    while (cur.tick < target && canAdvanceTick(cur, scenario)) cur = advanceTick(cur, scenario)
    return cur
  }
  for (const rec of log.decisions) {
    while (s.turnIndex < rec.turnIndex && s.phase !== 'ended') {
      s = advanceTurn(s, scenario)
      history.push(s)
    }
    if (s.phase === 'ended') break
    s = tickTo(s, rec.tick ?? 0)
    if (s.phase === 'ended') break
    // The tick sweep may already have committed this record (a timed-out decision or interrupt).
    if (isDecisionResolved(s as GameState, rec.decisionId)) continue
    s = applyDecision(s, scenario, rec.decisionId, rec.optionIds, {
      elapsedMs: rec.elapsedMs,
      timedOut: rec.timedOut,
      memo: rec.memo,
      hintsUsed: rec.hintsUsed,
      // The dialogue path is part of the log: it is re-walked and re-verified, never assumed.
      path: rec.path,
    })
  }
  const target = log.turnIndex ?? s.turnIndex
  while (s.turnIndex < target && s.phase !== 'ended') {
    s = advanceTurn(s, scenario)
    history.push(s)
  }
  if (s.phase !== 'ended') {
    // Without an explicit tick a replay lands on the turn's last tick, so a `Checkpoint` keeps
    // meaning "end of turn, after its decisions" (un-ticked turns: last tick = 0 = turn start).
    if (log.tick !== undefined) s = tickTo(s, log.tick)
    else s = fastForwardTicks(s, scenario)
  }
  return { state: s, history }
}
