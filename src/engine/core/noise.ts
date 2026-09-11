import type { Draft } from 'immer'
import type {
  EffectContext,
  GameState,
  InstitutionState,
  NoiseSpec,
  ScenarioDefinition,
  Turn,
} from '../types'
import { clamp } from './paths'
import { rngNext } from './rng'

/**
 * Magnitude-only volatility. Noise never branches an outcome — it only scales a move that would
 * have happened anyway — so the canonical run (`variance: 0`) stays exactly reproducible.
 *
 * Contract: **at `variance === 0` nothing here draws from the RNG**, so `state.rng` advances
 * exactly as it did before sub-turn ticks existed.
 */
export const DEFAULT_NOISE: Required<Omit<NoiseSpec, 'eventJitter'>> & { eventJitter: number } = {
  runoffSigma: 0.15,
  runoffCap: 0.3,
  tickerSigma: 0.01,
  tickerSigmaBp: 2,
  eventJitter: 0,
}

/** Box–Muller standard normal (consumes two draws). */
export function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Log-normal multiplier around 1 for a magnitude (an outflow slice, a ticker move).
 * Returns `1` **without touching the RNG** when variance or σ is 0.
 */
export function noiseFactor(ctx: EffectContext, sigma?: number, cap?: number): number {
  const s = sigma ?? 0
  if (ctx.variance === 0 || s === 0) return 1
  const c = cap ?? DEFAULT_NOISE.runoffCap
  return clamp(Math.exp(s * ctx.variance * gaussian(ctx.rng)), 1 - c, 1 + c)
}

/** Uniform integer tick offset in ±`jitter`, scaled by variance and clamped into the turn. */
export function jitterTick(
  rng: () => number,
  base: number,
  jitter: number | undefined,
  ticks: number,
  variance: number,
): number {
  const j = jitter ?? 0
  if (variance === 0 || j <= 0 || ticks <= 1)
    return clamp(Math.round(base), 0, Math.max(0, ticks - 1))
  const offset = Math.floor(rng() * (2 * j + 1)) - j
  return clamp(Math.round(base + offset * variance), 0, ticks - 1)
}

function draftRng<S extends InstitutionState>(draft: Draft<GameState<S>>): () => number {
  return () => {
    const r = rngNext(draft.rng)
    draft.rng = r.next
    return r.value
  }
}

/**
 * Resolves the tick at which each jitterable event / interrupt of `turn` fires and stores it in
 * `state.tickSchedule`. Jitter is only drawn when `variance > 0`.
 */
export function scheduleTurn<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  turn: Turn<S>,
  scenario: ScenarioDefinition<S>,
  ticks: number,
): void {
  const rng = draftRng(draft)
  const variance = draft.variance
  const fallbackJitter = scenario.noise?.eventJitter
  const schedule: Record<string, number> = {}
  for (const ev of turn.events) {
    if (ev.atTick === undefined && ev.jitter === undefined) continue
    schedule[ev.id] = jitterTick(rng, ev.atTick ?? 0, ev.jitter ?? fallbackJitter, ticks, variance)
  }
  for (const it of turn.interrupts ?? []) {
    schedule[it.id] = jitterTick(rng, it.atTick, it.jitter ?? fallbackJitter, ticks, variance)
  }
  draft.tickSchedule = schedule
}
