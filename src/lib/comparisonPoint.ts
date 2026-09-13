import { replay, type GameState, type ScenarioDefinition } from '../engine'

/** Rebuild a reference path at the player's horizon, excluding later decisions in the log. */
export function comparisonAt(
  scenario: ScenarioDefinition,
  path: GameState | undefined,
  target: Pick<GameState, 'turnIndex' | 'tick'>,
): GameState | undefined {
  if (!path) return undefined
  if (
    path.turnIndex < target.turnIndex ||
    (path.turnIndex === target.turnIndex && path.tick < target.tick)
  )
    return undefined
  if (path.turnIndex === target.turnIndex && path.tick === target.tick) return path
  const decisions = path.decisions.filter(
    (d) =>
      d.turnIndex < target.turnIndex ||
      (d.turnIndex === target.turnIndex && (d.tick ?? 0) <= target.tick),
  )
  try {
    const { state } = replay(scenario, {
      seed: path.seed,
      variance: path.variance,
      decisions,
      turnIndex: target.turnIndex,
      tick: target.tick,
    })
    return state.turnIndex === target.turnIndex && state.tick === target.tick ? state : undefined
  } catch {
    return undefined
  }
}
