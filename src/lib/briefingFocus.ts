import type {
  Competency,
  Decision,
  GameState,
  KpiSpec,
  MetricSnapshot,
  ScenarioDefinition,
} from '../engine/types'
import { PREFLIGHT_BY_FAMILY, ROLE_FRAMES, roleFamilyOf } from '../content/roleFrames'
import { DIMENSION_LABELS } from './labels'

/**
 * The two things a briefing has to answer that it did not: **what will I have to decide**, and
 * **what do I watch while I decide it**.
 *
 * It answered neither. «중요한 판단» listed `learningObjectives`, which are written as "…을
 * 이해한다" — a statement about what the player should come away knowing, not about anything they
 * will be asked to do. And "what to watch" was asked twice in two different chromes: the role
 * frame ("이 네 가지는 매 턴 확인합니다") and the pre-flight checklist ("첫 턴에서 가장 먼저 찾게
 * 되는 숫자들"), each printing the same T0 figures.
 */

/** The briefing lays out exactly this many of each. */
const KEY_DECISION_COUNT = 3
const WATCHPOINT_COUNT = 4

export interface KeyDecision {
  id: string
  title: string
  turnLabel: string
  turnIndex: number
  /** Why it matters, from the learning objective that names this decision. */
  why?: string
  competencyLabel?: string
  /** Best minus worst expert rating among the options — how much the choice is worth. */
  spread: number
  optionCount: number
}

/**
 * The three decisions that most divide the experts.
 *
 * Ranking by the *spread* of `expert.rating` is the point: a decision whose options are all rated
 * 4 is one the scenario has already made for you, and a decision rated 5 / 3 / 1 is where the run
 * is actually won or lost. That is what a briefing should name in advance.
 *
 * Interrupts are excluded — they are the ones you cannot prepare for by definition.
 */
export function keyDecisionsOf(scenario: ScenarioDefinition): KeyDecision[] {
  const objectiveFor = new Map<string, { text: string; competency: Competency }>()
  for (const lo of scenario.meta.learningObjectives)
    for (const id of lo.decisionIds)
      if (!objectiveFor.has(id)) objectiveFor.set(id, { text: lo.text, competency: lo.competency })

  const rows: KeyDecision[] = []
  scenario.turns.forEach((turn, turnIndex) => {
    for (const d of turn.decisions ?? []) {
      if (d.required === false) continue
      const spread = ratingSpread(d)
      if (spread <= 0) continue
      const lo = objectiveFor.get(d.id)
      rows.push({
        id: d.id,
        title: d.title,
        turnLabel: turn.label,
        turnIndex,
        why: lo?.text,
        competencyLabel: lo ? DIMENSION_LABELS[lo.competency] : undefined,
        spread,
        optionCount: d.options.length,
      })
    }
  })

  // A scenario can pose the same question on two turns (a rollover that fails twice), and both
  // copies score identically. Listing "차환 실패분 처리" twice reads as a bug, so the first
  // occurrence stands for the pair.
  const seenTitle = new Set<string>()
  return rows
    .sort((a, b) => b.spread - a.spread || a.turnIndex - b.turnIndex)
    .filter((r) => {
      if (seenTitle.has(r.title)) return false
      seenTitle.add(r.title)
      return true
    })
    .slice(0, KEY_DECISION_COUNT)
    .sort((a, b) => a.turnIndex - b.turnIndex) // read in the order they will be met
}

function ratingSpread(decision: Decision): number {
  const ratings = decision.options.map((o) => o.expert.rating).filter(Number.isFinite)
  if (ratings.length < 2) return 0
  return Math.max(...ratings) - Math.min(...ratings)
}

export interface Watchpoint {
  id: string
  label: string
  /** The question to ask, in one line. */
  question: string
  /** KPI specs this scenario publishes that answer it. */
  kpis: KpiSpec[]
  cardRef?: string
  frameworkRef?: string
}

/**
 * One list of what to watch, joined on the metrics each item reads.
 *
 * The role frame and the pre-flight checklist were two views of the same question. Joining them on
 * `metrics` merges the pairs that overlap and keeps the ones that do not, so nothing is lost and
 * the T0 figures are printed once.
 */
export function watchpointsOf(scenario: ScenarioDefinition): Watchpoint[] {
  const family = roleFamilyOf(scenario.meta.role)
  const kpiByMetric = new Map(scenario.kpis.map((k) => [k.metric, k]))

  const frameItems = ROLE_FRAMES[family].items
  const relevant = frameItems.filter((i) => i.metrics.some((m) => kpiByMetric.has(m)))
  const base = relevant.length > 0 ? relevant : frameItems

  // A metric can answer more than one of these questions (신뢰지수 matters to both the backstop
  // and the communication item), but printing its T0 value twice in one list is exactly the noise
  // this section exists to remove. The first watchpoint that reads a metric keeps the figure; the
  // later ones still ask their question, which is what a checklist is for.
  const covered = new Set<string>()
  const out: Watchpoint[] = base.map((item) => {
    const kpis: KpiSpec[] = []
    for (const m of item.metrics) {
      const kpi = kpiByMetric.get(m)
      if (!kpi || covered.has(m)) continue
      covered.add(m)
      kpis.push(kpi)
    }
    return {
      id: item.id,
      label: item.label,
      question: item.question,
      kpis,
      cardRef: item.cardRef,
      frameworkRef: item.frameworkRef,
    }
  })

  // Pre-flight checks whose metric no role-frame item already covers. A check with no metric at
  // all cannot be joined, so it is kept only if there is room — the frame is the spine.
  for (const check of PREFLIGHT_BY_FAMILY[family] ?? []) {
    if (out.length >= WATCHPOINT_COUNT) break
    if (!check.metric || !kpiByMetric.has(check.metric) || covered.has(check.metric)) continue
    out.push({
      id: check.id,
      label: check.label,
      question: check.hint,
      kpis: [kpiByMetric.get(check.metric)!],
    })
    covered.add(check.metric)
  }

  return out.slice(0, WATCHPOINT_COUNT)
}

/** Baseline value of a watchpoint's KPI at T0, for the one place the briefing prints figures. */
export function watchpointValues(
  w: Watchpoint,
  baseline: MetricSnapshot | undefined,
): { kpi: KpiSpec; value: number | undefined }[] {
  return w.kpis.map((kpi) => ({ kpi, value: baseline?.metrics[kpi.metric]?.value }))
}

/** Convenience for callers that already hold the T0 game state rather than its snapshot. */
export type BaselineState = GameState | undefined
