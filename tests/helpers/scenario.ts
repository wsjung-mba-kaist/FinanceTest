import {
  advanceTurn,
  applyDecision,
  createGame,
  DecisionError,
  type DecisionMeta,
  type Effect,
  type GameState,
  type InstitutionState,
  type ScenarioDefinition,
} from '@/engine'

/** Casts a typed scenario to the non-generic form used by a few engine helpers (mirrors the engine's own casts). */
export function asGeneric<S extends InstitutionState>(
  def: ScenarioDefinition<S>,
): ScenarioDefinition {
  return def as unknown as ScenarioDefinition
}

/** Returns a copy of the scenario with a different initial confidence index. */
export function withInitialConfidence<S extends InstitutionState>(
  def: ScenarioDefinition<S>,
  index: number,
): ScenarioDefinition<S> {
  return {
    ...def,
    initialState: { ...def.initialState, confidence: { ...def.initialState.confidence, index } },
  }
}

/** Returns a copy of the scenario where one option's immediate effects are replaced. */
export function withOptionEffects<S extends InstitutionState>(
  def: ScenarioDefinition<S>,
  decisionId: string,
  optionId: string,
  effects: Effect<S>[],
): ScenarioDefinition<S> {
  return {
    ...def,
    turns: def.turns.map((t) => ({
      ...t,
      decisions: t.decisions.map((d) =>
        d.id !== decisionId
          ? d
          : { ...d, options: d.options.map((o) => (o.id !== optionId ? o : { ...o, effects })) },
      ),
    })),
  }
}

export type Step = { decision: string; options: string[]; meta?: DecisionMeta }

export interface DriveResult<S extends InstitutionState> {
  /** State after the last step (before the final `advanceTurn` when `stopBeforeEnd`). */
  state: GameState<S>
  /** State at the start of each turn visited. */
  turnStarts: GameState<S>[]
}

/**
 * Drives a game turn by turn: applies the listed decisions for each turn index in order, then
 * advances. Stops when the game ends. With `stopBeforeEnd`, the final `advanceTurn` (the one that
 * would flip the last turn to `phase: 'ended'`) is not applied. With `stopAtTurn`, driving stops as
 * soon as that turn starts (before any of its decisions are applied).
 */
export function drive<S extends InstitutionState>(
  def: ScenarioDefinition<S>,
  seed: number,
  perTurn: Record<number, Step[]>,
  opts: { stopBeforeEnd?: boolean; stopAtTurn?: number } = {},
): DriveResult<S> {
  let s = createGame(def, seed)
  const turnStarts: GameState<S>[] = [s]
  for (;;) {
    if (s.phase === 'ended') break
    if (opts.stopAtTurn !== undefined && s.turnIndex >= opts.stopAtTurn) break
    for (const step of perTurn[s.turnIndex] ?? []) {
      s = applyDecision(s, def, step.decision, step.options, step.meta)
      if (s.phase === 'ended') break
    }
    if (s.phase === 'ended') break
    const last = s.turnIndex >= def.turns.length - 1
    if (last && opts.stopBeforeEnd) break
    s = advanceTurn(s, def)
    if (s.phase !== 'ended') turnStarts.push(s)
  }
  return { state: s, turnStarts }
}

/** Runs `fn` and returns the `DecisionError.code` it throws (or `undefined` when it does not throw a DecisionError). */
export function decisionErrorCode(fn: () => unknown): DecisionError['code'] | undefined {
  try {
    fn()
  } catch (e) {
    if (e instanceof DecisionError) return e.code
    throw e
  }
  return undefined
}
