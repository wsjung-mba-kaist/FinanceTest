import type { GameState, InstitutionState, ScenarioDefinition } from '../types'
import { seedToState } from './rng'
import { startTurn } from './startTurn'

/**
 * `structuredClone`, not `JSON.parse(JSON.stringify())`: the JSON round trip turns `Infinity` and
 * `NaN` into `null` and drops `undefined` keys, so an authored non-finite figure became a silent
 * `null` that `getNumberPath` then read as "unknown path". A non-finite initial value is a
 * scenario error, and the integrity linter reports it as one; the clone must not hide it.
 */
function clone<T>(v: T): T {
  return structuredClone(v)
}

/**
 * Creates a run at T0. `variance` defaults to 0 — the canonical, fully reproducible mode in which
 * the engine never draws from the RNG on its own (live play passes 0.5 / 1).
 */
export function createGame<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  seed = 1,
  opts: { variance?: number } = {},
): GameState<S> {
  const init = scenario.initialState
  const base: GameState<S> = {
    scenarioId: scenario.meta.id,
    scenarioVersion: scenario.meta.version,
    seed,
    rng: seedToState(seed),
    turnIndex: 0,
    tick: 0,
    variance: opts.variance ?? 0,
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
    tickHistory: [],
    tickSchedule: {},
    tickerBase: {},
    openInterrupts: [],
    feed: [],
    log: [],
  }
  return startTurn(base, scenario)
}
