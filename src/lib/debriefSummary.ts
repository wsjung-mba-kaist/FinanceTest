import { decisionRegrets, findDecision, findOption } from '../engine'
import type { GameState, KpiSpec, Option, ScenarioDefinition } from '../engine/types'

export type Regret = ReturnType<typeof decisionRegrets>[number]

export interface DebriefHeadline {
  failed: boolean
  orderly: boolean
  /** 생존·완료 / 질서 있는 정리 / 폐쇄·실패 */
  outcomeLabel: string
  tone: 'positive' | 'warning' | 'critical'
  title: string
  /** First sentence of the ending narrative. */
  lead: string
  turnLabel: string | undefined
  timeLabel: string | undefined
  /** Machine-readable ending reason (`ended.reason`). */
  reason: string | undefined
}

export interface KpiComparisonRow {
  kpi: KpiSpec
  player: number | undefined
  historical: number | undefined
  expert: number | undefined
}

export interface DecisionHighlightOption {
  id: string
  label: string
  rating: number
  trap: boolean
  trapExplanation: string | undefined
}

export interface DecisionHighlight {
  decisionId: string
  turnIndex: number
  turnLabel: string
  timeLabel: string | undefined
  decisionTitle: string
  chosen: DecisionHighlightOption[]
  /** Average expert rating of the chosen option(s). */
  chosenRating: number
  regret: number
  /** Highest-rated option of the decision (only meaningful for the worst decision). */
  best: { id: string; label: string; rating: number; why: string } | undefined
  /** Trap explanation of the chosen option, when it was a trap. */
  trapExplanation: string | undefined
}

/** First sentence of a block of prose (a period only ends a sentence before whitespace/end). */
export function firstSentence(text: string | undefined): string {
  const t = (text ?? '').trim()
  if (!t) return ''
  const m = /^[\s\S]*?[.!?。！？](?=\s|$)/.exec(t)
  return (m ? m[0] : t).trim()
}

export function headline(state: GameState, scenario: ScenarioDefinition): DebriefHeadline {
  const ended = state.ended
  const failed = Boolean(ended?.failed)
  const orderly = Boolean(ended?.orderly)
  const turn = ended ? scenario.turns[ended.turnIndex] : undefined
  return {
    failed,
    orderly,
    outcomeLabel: failed ? (orderly ? '질서 있는 정리' : '폐쇄·실패') : '생존·완료',
    tone: failed ? (orderly ? 'warning' : 'critical') : 'positive',
    title: ended?.title ?? '시나리오 종료',
    lead: firstSentence(ended?.narrative),
    turnLabel: turn?.label,
    timeLabel: turn?.timeLabel,
    reason: ended?.reason,
  }
}

/**
 * Last value recorded for `metric`. `status: 'na'` now means "no threshold band" rather than
 * "no value", so only finiteness may be used to reject a reading — filtering on the status would
 * silently drop unbanded KPIs such as 누적 예금 유출.
 */
function finalValue(state: GameState | undefined, metric: string): number | undefined {
  if (!state) return undefined
  for (let i = state.metricsHistory.length - 1; i >= 0; i--) {
    const m = state.metricsHistory[i]?.metrics[metric]
    if (m && Number.isFinite(m.value)) return m.value
  }
  return undefined
}

/** Top three primary KPIs with the final value on each of the three paths. */
export function kpiComparison(
  scenario: ScenarioDefinition,
  player: GameState,
  historical?: GameState,
  expert?: GameState,
): KpiComparisonRow[] {
  const primary = scenario.kpis.filter((k) => k.primary)
  const kpis = (primary.length > 0 ? primary : scenario.kpis).slice(0, 3)
  return kpis.map((kpi) => ({
    kpi,
    player: finalValue(player, kpi.metric),
    historical: finalValue(historical, kpi.metric),
    expert: finalValue(expert, kpi.metric),
  }))
}

function toHighlightOption(o: Option): DecisionHighlightOption {
  return {
    id: o.id,
    label: o.label,
    rating: o.expert.rating,
    trap: Boolean(o.trap),
    trapExplanation: o.trapExplanation,
  }
}

function buildHighlight(
  scenario: ScenarioDefinition,
  r: Regret,
  withBest: boolean,
): DecisionHighlight | undefined {
  const found = findDecision(scenario, r.decisionId)
  if (!found) return undefined
  const { decision, turn } = found
  const chosen = r.chosen
    .map((id) => findOption(decision, id))
    .filter((o): o is Option => Boolean(o))
    .map(toHighlightOption)
  const best = withBest ? findOption(decision, r.best) : undefined
  const trapped = chosen.find((c) => c.trap && c.trapExplanation)
  return {
    decisionId: r.decisionId,
    turnIndex: r.turnIndex,
    turnLabel: turn.label,
    timeLabel: turn.timeLabel,
    decisionTitle: decision.title,
    chosen,
    chosenRating: chosen.length ? chosen.reduce((a, c) => a + c.rating, 0) / chosen.length : 0,
    regret: r.regret,
    best: best
      ? {
          id: best.id,
          label: best.label,
          rating: best.expert.rating,
          why: firstSentence(best.expert.rationale),
        }
      : undefined,
    trapExplanation: trapped?.trapExplanation,
  }
}

function regretsOf(scenario: ScenarioDefinition, state: GameState, regrets?: Regret[]): Regret[] {
  return regrets ?? decisionRegrets(state, scenario)
}

/** The decision where the player matched the expert choice with the highest rating. */
export function bestDecision(
  scenario: ScenarioDefinition,
  state: GameState,
  regrets?: Regret[],
): DecisionHighlight | undefined {
  const list = regretsOf(scenario, state, regrets)
  const perfect = list.filter((r) => r.regret <= 0)
  if (perfect.length === 0) return undefined
  const ranked = [...perfect]
    .map((r) => ({ r, h: buildHighlight(scenario, r, false) }))
    .filter((x): x is { r: Regret; h: DecisionHighlight } => Boolean(x.h))
    .sort((a, b) => b.h.chosenRating - a.h.chosenRating || a.r.turnIndex - b.r.turnIndex)
  return ranked[0]?.h
}

/** The decision with the largest gap to the best available option. */
export function worstDecision(
  scenario: ScenarioDefinition,
  state: GameState,
  regrets?: Regret[],
): DecisionHighlight | undefined {
  const list = regretsOf(scenario, state, regrets).filter((r) => r.regret > 0)
  if (list.length === 0) return undefined
  const top = [...list].sort((a, b) => b.regret - a.regret || a.turnIndex - b.turnIndex)[0]!
  return buildHighlight(scenario, top, true)
}
