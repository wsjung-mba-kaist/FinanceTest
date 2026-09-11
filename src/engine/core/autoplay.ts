import type { DecisionRecord, GameState, InstitutionState, ScenarioDefinition } from '../types'
import { advanceTurn } from './advanceTurn'
import { applyDecision } from './applyDecision'
import { createGame } from './createGame'
import { makeRng } from './rng'
import { getTurnView, type DecisionView } from './view'

export type Policy = 'historical' | 'expert' | 'worst' | 'random'

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

/**
 * Plays a scenario to completion under a policy. Only required decisions (and optional decisions
 * that a path explicitly names) are answered.
 */
export function autoplay<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  policy: Policy,
  opts: { seed?: number; rngSeed?: number; maxSteps?: number } = {},
): AutoplayResult<S> {
  const rng = makeRng(opts.rngSeed ?? 7)
  let s = createGame(scenario, opts.seed ?? 1)
  const history: GameState<S>[] = [s]
  const deviations: AutoplayResult<S>['deviations'] = []
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
    s = applyDecision(s, scenario, dv.decision.id, pick.ids)
  }
  if (steps >= maxSteps) throw new Error('autoplay: 최대 단계 초과 (무한 루프?)')
  return { state: s, history, decisions: s.decisions, deviations }
}
