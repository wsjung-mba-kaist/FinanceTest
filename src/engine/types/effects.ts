import type { Draft } from 'immer'
import type { Flags, FlagValue, RegulatorLevel } from './common'
import type { Condition } from './conditions'
import type { MetricSnapshot } from './metrics'
import type { NoiseSpec } from './scenario'
import type { ConfidenceTarget, FeedItem, GameState, InstitutionState } from './state'

export interface EffectContext {
  turnIndex: number
  /** Deterministic PRNG in [0,1). Never called while `variance` is 0. */
  rng: () => number
  /** Metrics computed before this effect batch. */
  metrics: MetricSnapshot
  flags: Flags
  log: (msg: string) => void
  /** Sub-turn tick this batch runs at (0 for turns without `ticks`). */
  tick: number
  /** Number of ticks in the current turn (1 when the turn is not ticked). */
  ticks: number
  /** True on the final tick of the turn (always true when `ticks` is 1). */
  isLastTick: boolean
  /** 0 = canonical run (no RNG draws). */
  variance: number
  /** Scenario-level noise magnitudes, if authored. */
  noise?: NoiseSpec
}

export type NumericOp = 'set' | 'add' | 'mul' | 'min' | 'max'

/**
 * Hybrid effect model:
 *  - `op`: declarative numeric change on a dotted path under `institution.` or `market.`
 *  - `flag` / `counter` / `confidence` / `regulator`: typed state primitives
 *  - `feed`: engine-visible narrative item (e.g. delayed consequence)
 *  - `fn`: named, parameterised function for logic that needs arithmetic across fields
 */
export type Effect<S extends InstitutionState = InstitutionState> =
  | { kind: 'op'; path: string; op: NumericOp; value: number; label?: string }
  | { kind: 'flag'; key: string; value: FlagValue }
  | { kind: 'counter'; key: string; add: number }
  | { kind: 'confidence'; target?: ConfidenceTarget; delta: number; reason?: string }
  | { kind: 'regulator'; set?: RegulatorLevel; add?: number; reason?: string }
  | { kind: 'feed'; item: Omit<FeedItem, 'id' | 'turnIndex'> }
  | {
      kind: 'fn'
      name: string
      params?: Record<string, number | string | boolean>
      label?: string
      apply: (draft: Draft<GameState<S>>, ctx: EffectContext) => void
    }

export interface DelayedEffectSpec<S extends InstitutionState = InstitutionState> {
  afterTurns: number
  /** Extra offset inside the due turn (only meaningful on ticked turns). */
  afterTicks?: number
  when?: Condition
  effects: Effect<S>[]
  description: string
}

export interface PendingEffect {
  id: string
  dueTurn: number
  /** Tick within `dueTurn` at which the effect fires (defaults to 0 = turn start). */
  dueTick?: number
  description: string
  /** Reference to the option's delayed spec so state stays serialisable. */
  ref: { decisionId: string; optionId: string; index: number }
}

export interface ConditionalEffects<S extends InstitutionState = InstitutionState> {
  id: string
  when?: Condition
  effects: Effect<S>[]
  description?: string
}
