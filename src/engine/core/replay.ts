import type { DecisionRecord, GameState, InstitutionState, ScenarioDefinition } from '../types'
import { advanceTurn } from './advanceTurn'
import { applyDecision } from './applyDecision'
import { createGame } from './createGame'

export interface ReplayLog {
  seed: number
  decisions: DecisionRecord[]
  /** Turn index the run had reached (may be beyond the last decision's turn). */
  turnIndex?: number
}

export interface ReplayResult<S extends InstitutionState> {
  state: GameState<S>
  /** State at the start of each turn (index = turn index) for rewind. */
  history: GameState<S>[]
}

/** Deterministically rebuilds a run from its seed and decision log. */
export function replay<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  log: ReplayLog,
): ReplayResult<S> {
  let s = createGame(scenario, log.seed)
  const history: GameState<S>[] = [s]
  for (const rec of log.decisions) {
    while (s.turnIndex < rec.turnIndex && s.phase !== 'ended') {
      s = advanceTurn(s, scenario)
      history.push(s)
    }
    if (s.phase === 'ended') break
    s = applyDecision(s, scenario, rec.decisionId, rec.optionIds, {
      elapsedMs: rec.elapsedMs,
      timedOut: rec.timedOut,
      memo: rec.memo,
      hintsUsed: rec.hintsUsed,
    })
  }
  const target = log.turnIndex ?? s.turnIndex
  while (s.turnIndex < target && s.phase !== 'ended') {
    s = advanceTurn(s, scenario)
    history.push(s)
  }
  return { state: s, history }
}
