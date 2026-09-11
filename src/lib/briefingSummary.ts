import { createGame, latestSnapshot } from '../engine'
import type {
  Competency,
  ExecutiveSummarySpec,
  GameState,
  KpiSpec,
  MetricSnapshot,
  MetricStatus,
  ScenarioDefinition,
} from '../engine/types'
import { PREFLIGHT_BY_FAMILY, roleFamilyOf } from '../content/roleFrames'
import { DIMENSION_LABELS } from './labels'

export type { ExecutiveSummarySpec }

export interface KeyJudgement {
  id: string
  text: string
  competency: Competency
  competencyLabel: string
  /** Scenario weight of the competency (0~3); the ordering key. */
  weight: number
  /** How many decisions in the scenario hang on this objective. */
  decisionCount: number
}

export interface SummaryKpi {
  kpi: KpiSpec
  value: number | undefined
  status: MetricStatus
}

export interface PreflightItem {
  id: string
  label: string
  /** What to check, in one line (`PreflightCheck.hint`). */
  question: string
  /** Metric ids that answer it and exist in this scenario's KPI list. */
  metrics: string[]
}

export interface BriefingSummary {
  situation: string
  mandate: string
  objective: string
  keyJudgements: KeyJudgement[]
  kpis: SummaryKpi[]
  /** Card ids to preview (first three of `briefing.cardRefs`). */
  concepts: string[]
  preflight: PreflightItem[]
}

/** Max length of the situation paragraph shown above the fold. */
const SITUATION_MAX = 220

/** The one-page summary's layout takes exactly this many key judgements. */
const KEY_JUDGEMENT_COUNT = 3

const MANDATE_RE = /\*\*권한\*\*[:：]/
const OBJECTIVE_RE = /\*\*목표\*\*[:：]/

/** First block of a markdown string (paragraphs are separated by a blank line). */
export function firstParagraph(md: string): string {
  return (
    md
      .trim()
      .split(/\n\s*\n/)[0]
      ?.trim() ?? ''
  )
}

/**
 * Trims to at most `max` characters on a sentence boundary. A period only ends a sentence when it
 * is followed by whitespace or the end of the string, so `3.59%` and `v1.2` stay intact.
 */
export function trimToSentence(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const parts = t.split(/(?<=[.!?。！？])\s+/)
  let out = ''
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p
    if (next.length > max) break
    out = next
  }
  if (out) return out
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/** T0 game state. Returns `undefined` when the scenario cannot be instantiated. */
export function baselineGame(scenario: ScenarioDefinition): GameState | undefined {
  try {
    return createGame(scenario, 1)
  } catch {
    return undefined
  }
}

/** Baseline metric snapshot at T0. */
export function baselineSnapshot(scenario: ScenarioDefinition): MetricSnapshot | undefined {
  const state = baselineGame(scenario)
  return state ? latestSnapshot(state) : undefined
}

function parseMandate(mandate: string): { mandate: string; objective: string } {
  const mStart = mandate.search(MANDATE_RE)
  const oStart = mandate.search(OBJECTIVE_RE)
  const mMatch = MANDATE_RE.exec(mandate)
  const oMatch = OBJECTIVE_RE.exec(mandate)
  if (mStart < 0 || oStart < 0 || !mMatch || !oMatch) {
    // Unexpected shape → show the whole block as the mandate rather than dropping content.
    return { mandate: mandate.trim(), objective: '' }
  }
  const mFrom = mStart + mMatch[0].length
  const oFrom = oStart + oMatch[0].length
  const mandateText = (oStart > mStart ? mandate.slice(mFrom, oStart) : mandate.slice(mFrom)).trim()
  const objectiveText = mandate.slice(oFrom).trim()
  return { mandate: mandateText, objective: objectiveText }
}

function keyJudgementsOf(scenario: ScenarioDefinition): KeyJudgement[] {
  const weights = scenario.meta.competencies
  return [...scenario.meta.learningObjectives]
    .map((lo, i) => ({ lo, i, weight: weights[lo.competency] ?? 0 }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .slice(0, KEY_JUDGEMENT_COUNT)
    .map(({ lo, weight }) => ({
      id: lo.id,
      text: lo.text,
      competency: lo.competency,
      competencyLabel: DIMENSION_LABELS[lo.competency],
      weight,
      decisionCount: lo.decisionIds.length,
    }))
}

function preflightOf(scenario: ScenarioDefinition): PreflightItem[] {
  const family = roleFamilyOf(scenario.meta.role)
  const all = PREFLIGHT_BY_FAMILY[family] ?? []
  const metrics = new Set(scenario.kpis.map((k) => k.metric))
  // Keep the checks this scenario can actually answer; a check without a metric always applies.
  const matched = all.filter((item) => !item.metric || metrics.has(item.metric))
  const list = matched.length > 0 ? matched : all
  return list.map((item) => ({
    id: item.id,
    label: item.label,
    question: item.hint,
    metrics: item.metric && metrics.has(item.metric) ? [item.metric] : [],
  }))
}

/**
 * Builds the one-page briefing summary out of the existing scenario content so no scenario file
 * has to change. `briefing.executiveSummary` (optional, authored) overrides any field.
 */
export function deriveBriefingSummary(
  scenario: ScenarioDefinition,
  baseline?: MetricSnapshot,
): BriefingSummary {
  const override = scenario.briefing.executiveSummary
  const kpiMetrics = new Set(scenario.kpis.map((k) => k.metric))
  const parsed = parseMandate(scenario.briefing.mandate)
  const primary = scenario.kpis.filter((k) => k.primary)
  const kpiSpecs = (primary.length > 0 ? primary : scenario.kpis).slice(0, 4)

  const derivedJudgements = keyJudgementsOf(scenario)
  // The one-page summary lays out exactly three judgements, so an authored list is capped here
  // rather than trusted — the invariant belongs to the layout, not to each scenario's author.
  const keyJudgements = override?.keyJudgements?.length
    ? override.keyJudgements.slice(0, KEY_JUDGEMENT_COUNT).map((text, i) => ({
        id: derivedJudgements[i]?.id ?? `kj${i + 1}`,
        text,
        competency: derivedJudgements[i]?.competency ?? ('liquidity' as Competency),
        competencyLabel: derivedJudgements[i]?.competencyLabel ?? '',
        weight: derivedJudgements[i]?.weight ?? 0,
        decisionCount: derivedJudgements[i]?.decisionCount ?? 0,
      }))
    : derivedJudgements

  return {
    situation:
      override?.situation ??
      trimToSentence(firstParagraph(scenario.briefing.situation), SITUATION_MAX),
    mandate: override?.mandate ?? parsed.mandate,
    objective: override?.objective ?? parsed.objective,
    keyJudgements,
    kpis: kpiSpecs.map((kpi) => {
      const m = baseline?.metrics[kpi.metric]
      return { kpi, value: m?.value, status: m?.status ?? 'na' }
    }),
    concepts: scenario.briefing.cardRefs.slice(0, 3),
    // An authored check may name a metric this scenario does not publish; the briefing can only
    // show a baseline for one it does, so the list is narrowed to what actually resolves.
    preflight: override?.preflight
      ? override.preflight.map((p) => ({
          ...p,
          metrics: (p.metrics ?? []).filter((m) => kpiMetrics.has(m)),
        }))
      : preflightOf(scenario),
  }
}
