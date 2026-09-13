import { replay, type GameState, type Mode, type ScenarioDefinition } from '../engine'
import { tickCount } from '../engine/core/lookup'

const cache = new WeakMap<GameState, WeakMap<ScenarioDefinition, Map<string, GameState>>>()

/** A turn-start snapshot cannot recover the later arrivals of a completed turn. Replay its own log. */
export function observedTurnState(
  scenario: ScenarioDefinition,
  state: GameState,
  history: GameState[] | undefined,
  turnIndex: number,
  mode: Mode,
): GameState | undefined {
  if (turnIndex === state.turnIndex) return state
  const turn = scenario.turns[turnIndex]
  if (!turn || turnIndex > state.turnIndex) return undefined
  if (!turn.events.some((e) => e.information)) return history?.[turnIndex]
  let byScenario = cache.get(state)
  if (!byScenario) {
    byScenario = new WeakMap()
    cache.set(state, byScenario)
  }
  let byTurn = byScenario.get(scenario)
  if (!byTurn) {
    byTurn = new Map()
    byScenario.set(scenario, byTurn)
  }
  const key = `${turnIndex}:${mode}`
  const cached = byTurn.get(key)
  if (cached) return cached
  try {
    const restored = replay(scenario, {
      seed: state.seed,
      variance: state.variance,
      mode,
      decisions: state.decisions.filter((d) => d.turnIndex <= turnIndex),
      turnIndex,
      tick: tickCount(turn) - 1,
    }).state
    if (restored.turnIndex !== turnIndex) return undefined
    byTurn.set(key, restored)
    return restored
  } catch {
    return history?.[turnIndex]
  }
}
