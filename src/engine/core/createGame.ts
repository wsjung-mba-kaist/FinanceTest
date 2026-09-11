import type { GameState, InstitutionState, ScenarioDefinition } from '../types'
import { seedToState } from './rng'
import { startTurn } from './startTurn'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function createGame<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  seed = 1,
): GameState<S> {
  const init = scenario.initialState
  const base: GameState<S> = {
    scenarioId: scenario.meta.id,
    scenarioVersion: scenario.meta.version,
    seed,
    rng: seedToState(seed),
    turnIndex: 0,
    phase: 'deciding',
    institution: clone(init.institution),
    market: clone(init.market),
    confidence: clone(init.confidence),
    regulator: { level: init.regulatorLevel ?? 0, notes: [] },
    flags: { ...(init.flags ?? {}) },
    flagTurns: {},
    counters: { ...(init.counters ?? {}) },
    pending: [],
    decisions: [],
    metricsHistory: [],
    feed: [],
    log: [],
  }
  return startTurn(base, scenario)
}
