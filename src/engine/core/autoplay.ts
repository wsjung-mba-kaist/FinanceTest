import type {
  DecisionRecord,
  GameState,
  InstitutionState,
  Interrupt,
  ScenarioDefinition,
} from '../types'
import { advanceTurn } from './advanceTurn'
import { applyDecision } from './applyDecision'
import { buildConditionContext } from './conditions'
import { hasDialogue, walkByPolicy } from './dialogue'
import { createGame } from './createGame'
import { makeRng } from './rng'
import { advanceTick, canAdvanceTick } from './tick'
import { getTurnView, type DecisionView } from './view'

export type Policy = 'historical' | 'expert' | 'worst' | 'random'

export interface AutoplayOptions {
  seed?: number
  rngSeed?: number
  maxSteps?: number
  /** Volatility of the run (default 0 = canonical, no RNG draws inside the engine). */
  variance?: number
  /** How interrupts are answered; defaults to the main policy. */
  interruptPolicy?: 'default' | Policy
}

export interface AutoplayResult<S extends InstitutionState> {
  state: GameState<S>
  history: GameState<S>[]
  decisions: DecisionRecord[]
  /** Path choices that could not be honoured (hidden/unavailable) and what was chosen instead. */
  deviations: { decisionId: string; wanted: string[]; chosen: string[]; reason: string }[]
}

function pickForPolicy<S extends InstitutionState>(
  dv: DecisionView<S>,
  policy: Policy,
  scenario: ScenarioDefinition<S>,
  rng: () => number,
): { ids: string[]; wanted?: string[]; reason?: string } {
  const decision = dv.decision
  const sel = decision.select ?? { min: 1, max: 1 }
  const available = dv.options.filter((o) => o.available).map((o) => o.option)
  if (available.length === 0) return { ids: [] }

  const honourPath = (
    choices: Record<string, string | string[]> | undefined,
    fallbackFlag?: 'historical',
  ) => {
    let wanted: string[] | undefined =
      choices?.[decision.id] !== undefined ? [choices[decision.id]!].flat() : undefined
    if (!wanted && fallbackFlag === 'historical') {
      const flagged = decision.options.filter((o) => o.historical).map((o) => o.id)
      if (flagged.length) wanted = flagged
    }
    if (!wanted) return undefined
    const ok = wanted.filter((id) => available.some((o) => o.id === id))
    if (ok.length >= sel.min && ok.length <= sel.max && ok.length === wanted.length)
      return { ids: ok }
    return {
      ids: ok,
      wanted,
      reason: ok.length === wanted.length ? '선택 개수 불일치' : '경로 옵션이 비활성',
    }
  }

  const byRating = [...available].sort((a, b) => b.expert.rating - a.expert.rating)
  const respectExclusive = (ordered: typeof available, count: number): string[] => {
    const chosen: string[] = []
    for (const o of ordered) {
      if (chosen.length >= count) break
      const clash = (decision.exclusive ?? []).some(
        (g) => g.includes(o.id) && chosen.some((c) => g.includes(c)),
      )
      if (!clash) chosen.push(o.id)
    }
    return chosen
  }

  if (policy === 'historical') {
    const r = honourPath(scenario.paths.historical.choices, 'historical')
    if (r && r.ids.length >= sel.min && !r.reason) return r
    const fallback = respectExclusive(byRating, sel.min)
    return {
      ids: fallback,
      wanted: r?.wanted ?? [],
      reason: r?.reason ?? '역사 경로 지정 없음(전문가 대체)',
    }
  }
  if (policy === 'expert') {
    const r = honourPath(scenario.paths.expert?.choices)
    if (r && r.ids.length >= sel.min && !r.reason) return r
    const n = Math.max(
      sel.min,
      Math.min(sel.max, byRating.filter((o) => o.expert.rating >= 60).length || sel.min),
    )
    return {
      ids: respectExclusive(byRating, n),
      ...(r ? { wanted: r.wanted ?? [], reason: r.reason ?? '' } : {}),
    }
  }
  if (policy === 'worst') {
    return { ids: respectExclusive([...byRating].reverse(), sel.min) }
  }
  // random
  const shuffled = [...available].sort(() => rng() - 0.5)
  const count = sel.min + Math.floor(rng() * (sel.max - sel.min + 1))
  return { ids: respectExclusive(shuffled, Math.max(sel.min, count)) }
}

/** Answers an interrupt: path/historical option, best or worst rating, or the authored default. */
function pickInterrupt<S extends InstitutionState>(
  dv: DecisionView<S>,
  policy: 'default' | Policy,
  scenario: ScenarioDefinition<S>,
  rng: () => number,
): string[] {
  const it = dv.decision as Interrupt<S>
  const available = dv.options.filter((o) => o.available).map((o) => o.option)
  const fallback = available.some((o) => o.id === it.defaultOptionId)
    ? [it.defaultOptionId]
    : available[0]
      ? [available[0].id]
      : []
  if (policy === 'default' || available.length === 0) return fallback
  if (policy === 'historical') {
    const named = scenario.paths.historical.choices[it.id]
    const wanted =
      named !== undefined ? [named].flat() : available.filter((o) => o.historical).map((o) => o.id)
    const ok = wanted.filter((id) => available.some((o) => o.id === id))
    return ok.length > 0 ? [ok[0]!] : fallback
  }
  const byRating = [...available].sort((a, b) => b.expert.rating - a.expert.rating)
  if (policy === 'expert') return [byRating[0]!.id]
  if (policy === 'worst') return [byRating[byRating.length - 1]!.id]
  return [available[Math.min(available.length - 1, Math.floor(rng() * available.length))]!.id]
}

/**
 * Walks a decision's dialogue under a policy and returns what to commit.
 *
 * `historical` / `expert` steer toward the option the policy already picked — the walker follows
 * the reply whose `resolvesTo` (possibly transitively) reaches it, preferring the highest
 * `expert.rating` among ties. `worst` walks freely, preferring a `trap` reply and then the lowest
 * rating; `random` draws each reply from the seeded RNG. A reply that cannot reach a committable
 * option is never taken, so the walk always ends somewhere `applyDecision` accepts.
 *
 * Returns `undefined` when no walk terminates — the caller then commits the option directly
 * (no path), exactly as the deadline sweep does.
 */
function walkDialogue<S extends InstitutionState>(
  state: GameState<S>,
  dv: DecisionView<S>,
  policy: Policy,
  wanted: string[],
  rng: () => number,
): { ids: string[]; path: string[]; missedTarget?: string } | undefined {
  if (!hasDialogue(dv.decision)) return undefined
  const availableIds = new Set(dv.options.filter((o) => o.available).map((o) => o.option.id))
  const steer = policy === 'historical' || policy === 'expert'
  const result = walkByPolicy(dv.decision, buildConditionContext(state as GameState), {
    ...(steer && wanted[0] !== undefined ? { target: wanted[0] } : {}),
    prefer: policy === 'worst' ? 'trap' : policy === 'random' ? 'random' : 'rating',
    rng,
    canCommit: (id) => availableIds.has(id),
  })
  if (!result) return undefined
  return {
    ids: [result.optionId],
    path: result.path,
    ...(result.missedTarget !== undefined ? { missedTarget: result.missedTarget } : {}),
  }
}

/**
 * Plays a scenario to completion under a policy. Only required decisions (and optional decisions
 * that a path explicitly names) are answered; open interrupts are answered at the tick they arrive,
 * and remaining ticks are played out before the turn advances — so no UI clock is involved.
 */
export function autoplay<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  policy: Policy,
  opts: AutoplayOptions = {},
): AutoplayResult<S> {
  const rng = makeRng(opts.rngSeed ?? 7)
  let s = createGame(scenario, opts.seed ?? 1, { variance: opts.variance ?? 0 })
  const history: GameState<S>[] = [s]
  const deviations: AutoplayResult<S>['deviations'] = []
  const interruptPolicy = opts.interruptPolicy ?? policy
  let steps = 0
  const maxSteps = opts.maxSteps ?? 500
  while (s.phase !== 'ended' && steps++ < maxSteps) {
    const view = getTurnView(s, scenario, { mode: 'standard' })
    const pathChoices =
      policy === 'historical'
        ? scenario.paths.historical.choices
        : policy === 'expert'
          ? scenario.paths.expert?.choices
          : undefined
    const pending = view.decisions.filter(
      (d) =>
        !d.resolved &&
        ((d.decision.required ?? true) || pathChoices?.[d.decision.id] !== undefined),
    )
    if (pending.length === 0) {
      const interrupt = view.interrupts.find((i) => !i.resolved)
      if (interrupt) {
        const ids = pickInterrupt(interrupt, interruptPolicy, scenario, rng)
        if (ids.length === 0)
          throw new Error(`인터럽트 ${interrupt.decision.id}: 선택 가능한 옵션이 없습니다`)
        const dialogue =
          interruptPolicy === 'default'
            ? undefined
            : walkDialogue(s, interrupt, interruptPolicy, ids, rng)
        s = applyDecision(
          s,
          scenario,
          interrupt.decision.id,
          dialogue?.ids ?? ids,
          dialogue ? { path: dialogue.path } : {},
        )
        continue
      }
      if (canAdvanceTick(s, scenario)) {
        s = advanceTick(s, scenario)
        continue
      }
      s = advanceTurn(s, scenario)
      history.push(s)
      continue
    }
    const dv = pending[0]!
    const pick = pickForPolicy(dv, policy, scenario, rng)
    if (pick.wanted && pick.reason) {
      deviations.push({
        decisionId: dv.decision.id,
        wanted: pick.wanted,
        chosen: pick.ids,
        reason: pick.reason,
      })
    }
    if (pick.ids.length === 0)
      throw new Error(`결정 ${dv.decision.id}: 선택 가능한 옵션이 없습니다`)
    const dialogue = walkDialogue(s, dv, policy, pick.ids, rng)
    if (dialogue?.missedTarget !== undefined) {
      deviations.push({
        decisionId: dv.decision.id,
        wanted: [dialogue.missedTarget],
        chosen: dialogue.ids,
        reason: '대화 경로가 해당 옵션에 도달하지 못함',
      })
    }
    s = applyDecision(
      s,
      scenario,
      dv.decision.id,
      dialogue?.ids ?? pick.ids,
      dialogue ? { path: dialogue.path } : {},
    )
  }
  if (steps >= maxSteps) throw new Error('autoplay: 최대 단계 초과 (무한 루프?)')
  return { state: s, history, decisions: s.decisions, deviations }
}
