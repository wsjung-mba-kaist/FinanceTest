import { decisionRegrets, findDecision, findOption } from '../engine'
import type { GameState, KpiSpec, Option, ScenarioDefinition, ThresholdMap } from '../engine/types'
import { directionOf, type Direction } from './direction'

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
  /** The player's path for this metric, turn by turn — the shape a final value cannot show. */
  series: number[]
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

/** The player's per-turn values for one metric. */
function seriesOf(state: GameState, metric: string): number[] {
  const out: number[] = []
  for (const snap of state.metricsHistory) {
    const v = snap.metrics[metric]?.value
    if (v !== undefined && Number.isFinite(v)) out.push(v)
  }
  return out
}

/**
 * The primary KPIs with the final value on each of the three paths, plus the player's own path.
 *
 * `all` adds the secondary metrics. The headline callers stay on the primaries on purpose: the
 * sentence that names the biggest divergence must not be driven by a metric the scenario author
 * did not consider headline material.
 */
export function kpiComparison(
  scenario: ScenarioDefinition,
  player: GameState,
  historical?: GameState,
  expert?: GameState,
  opts: { all?: boolean } = {},
): KpiComparisonRow[] {
  const primary = scenario.kpis.filter((k) => k.primary)
  const base = primary.length > 0 ? primary : scenario.kpis.slice(0, 3)
  const kpis = opts.all ? [...base, ...scenario.kpis.filter((k) => !base.includes(k))] : base
  return kpis.map((kpi) => ({
    kpi,
    player: finalValue(player, kpi.metric),
    historical: finalValue(historical, kpi.metric),
    expert: finalValue(expert, kpi.metric),
    series: seriesOf(player, kpi.metric),
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

export interface ExpertGap {
  row: KpiComparisonRow
  player: number
  expert: number
  /** |player − expert| ÷ max(|expert|, |player|, ε) — relative so KPIs of different scale compare. */
  relative: number
  /**
   * Whether the player ended on the better side of the expert. `neutral` when the metric has no
   * threshold band, because then nothing in the model says which direction is good.
   */
  direction: Direction
}

/**
 * The KPI where the run diverged most from the expert path.
 *
 * A three-column table asks the reader to do this comparison themselves, on a page they are
 * reading once. One sentence naming the metric that actually differed is the answer the table was
 * being scanned for.
 *
 * It used to refuse to say *which way* the gap ran, on the grounds that `KpiSpec` carries no
 * direction. That was true of `KpiSpec` and false of the model: `Threshold.direction` says which
 * side of a band is the bad one, and `directionOf` has been reading it on the play screen all
 * along. So the verdict is stated where a threshold exists and withheld where none does — which is
 * the difference between a judgement and a guess dressed as one.
 */
export function largestExpertGap(
  rows: KpiComparisonRow[],
  thresholds: ThresholdMap = {},
): ExpertGap | undefined {
  let best: ExpertGap | undefined
  for (const row of rows) {
    const { player, expert } = row
    if (player === undefined || expert === undefined) continue
    const scale = Math.max(Math.abs(expert), Math.abs(player), 1e-9)
    const relative = Math.abs(player - expert) / scale
    const t = thresholds[row.kpi.metric]
    const direction = t ? directionOf(Math.sign(player - expert), t) : 'neutral'
    if (!best || relative > best.relative) best = { row, player, expert, relative, direction }
  }
  // A gap under 2% is the two paths agreeing; saying so is more useful than naming a rounding
  // difference as the headline divergence.
  return best && best.relative >= 0.02 ? best : undefined
}
