import type { Competency, Mode, ScenarioSummary } from '../engine/types'
import type { AttemptSave, ScenarioProgress } from '../persistence/schema'
import { COMPETENCIES } from './labels'

export const MODE_MULTIPLIER: Record<Mode, number> = { guided: 0.7, standard: 1.0, expert: 1.2 }
export const FORK_WEIGHT = 0.8
export const RECENT_RUNS = 5

export type MasteryLevel = 'none' | 'basic' | 'proficient' | 'expert'

export interface MasteryEvidence {
  scenarioId: string
  runId: string
  mode: Mode
  /** Raw dimension score of the run (0..100). */
  score: number
  /** Score × mode multiplier (what enters the average). */
  adjusted: number
  weight: number
  forked: boolean
  completedAt: string
}

export interface CompetencyMastery {
  competency: Competency
  /** undefined when there is no evidence. */
  mastery: number | undefined
  level: MasteryLevel
  evidence: MasteryEvidence[]
  scenarioCount: number
  hasExpertRun: boolean
}

function levelFor(
  mastery: number | undefined,
  scenarioCount: number,
  hasExpertRun: boolean,
): MasteryLevel {
  if (mastery === undefined) return 'none'
  if (mastery >= 75 && scenarioCount >= 3 && hasExpertRun) return 'expert'
  if (mastery >= 50 && scenarioCount >= 2) return 'proficient'
  return 'basic'
}

/**
 * mastery = weightedAvg(last N runs' dimension score × mode multiplier; forks weighted ×0.8), capped at 100.
 * Levels: 미평가 → 기초(<50) → 숙련(50–75, ≥2 scenarios) → 전문(≥75, ≥3 scenarios incl. one expert run).
 */
export function computeMastery(
  scenarios: Record<string, ScenarioProgress>,
  opts: { recentN?: number } = {},
): Record<Competency, CompetencyMastery> {
  const n = opts.recentN ?? RECENT_RUNS
  const runs: { scenarioId: string; attempt: AttemptSave }[] = []
  for (const [scenarioId, p] of Object.entries(scenarios)) {
    for (const attempt of p.attempts) runs.push({ scenarioId, attempt })
  }
  runs.sort((a, b) => b.attempt.completedAt.localeCompare(a.attempt.completedAt))

  const out = {} as Record<Competency, CompetencyMastery>
  for (const c of COMPETENCIES) {
    const evidence: MasteryEvidence[] = []
    for (const { scenarioId, attempt } of runs) {
      const score = attempt.dimensions[c]
      if (score === undefined || !Number.isFinite(score)) continue
      if (evidence.length >= n) break
      const forked = Boolean(attempt.forkedFrom)
      evidence.push({
        scenarioId,
        runId: attempt.runId,
        mode: attempt.mode,
        score,
        adjusted: Math.min(100, score * MODE_MULTIPLIER[attempt.mode]),
        weight: forked ? FORK_WEIGHT : 1,
        forked,
        completedAt: attempt.completedAt,
      })
    }
    const wsum = evidence.reduce((a, e) => a + e.weight, 0)
    const mastery =
      wsum > 0
        ? Math.min(100, evidence.reduce((a, e) => a + e.adjusted * e.weight, 0) / wsum)
        : undefined
    const scenarioCount = new Set(evidence.map((e) => e.scenarioId)).size
    const hasExpertRun = evidence.some((e) => e.mode === 'expert')
    out[c] = {
      competency: c,
      mastery,
      level: levelFor(mastery, scenarioCount, hasExpertRun),
      evidence,
      scenarioCount,
      hasExpertRun,
    }
  }
  return out
}

/** Competency with the least evidence (ties → lowest mastery), then an available scenario emphasising it. */
export function recommendNext(
  mastery: Record<Competency, CompetencyMastery>,
  summaries: ScenarioSummary[],
  scenarios: Record<string, ScenarioProgress>,
): { competency: Competency; scenario: ScenarioSummary | undefined } {
  const ranked = [...COMPETENCIES].sort((a, b) => {
    const ea = mastery[a].evidence.length
    const eb = mastery[b].evidence.length
    if (ea !== eb) return ea - eb
    return (mastery[a].mastery ?? -1) - (mastery[b].mastery ?? -1)
  })
  const competency = ranked[0]!
  const available = summaries.filter((s) => s.status === 'available')
  const emphasis = (s: ScenarioSummary) => s.competencies[competency] ?? 0
  const notPlayed = (s: ScenarioSummary) => (scenarios[s.id]?.attempts.length ?? 0) === 0
  const candidates = [...available]
    .filter((s) => emphasis(s) > 0)
    .sort((a, b) => {
      const d = emphasis(b) - emphasis(a)
      if (d !== 0) return d
      return Number(notPlayed(b)) - Number(notPlayed(a))
    })
  return { competency, scenario: candidates[0] ?? available[0] }
}
