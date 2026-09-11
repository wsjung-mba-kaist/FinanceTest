import type { ScenarioSummary } from '../engine/types'
import { SCENARIOS } from '../scenarios'
import type { ScenarioProgress } from '../persistence/schema'
import { formatNumber } from './format'
import { turnProgressLabel } from './labels'

export type CatalogStatus = 'planned' | 'available' | 'in-progress' | 'completed'

export const CATALOG_STATUS_LABELS: Record<CatalogStatus, string> = {
  available: '시작 가능',
  planned: '준비 중',
  'in-progress': '진행 중',
  completed: '완료',
}

export function catalogStatusOf(
  summary: ScenarioSummary,
  progress: ScenarioProgress | undefined,
): CatalogStatus {
  if (summary.status === 'planned') return 'planned'
  if (progress?.inProgress) return 'in-progress'
  if (progress && (progress.best || progress.attempts.length > 0)) return 'completed'
  return 'available'
}

/**
 * Status chip copy for a catalog card:
 * `시작 가능` / `진행 중 T+3/8` / `완료 · B 72점` / `준비 중`.
 * The internal milestone code (M2/M3) is deliberately not exposed.
 */
export function catalogStatusText(
  summary: ScenarioSummary,
  progress: ScenarioProgress | undefined,
): string {
  const status = catalogStatusOf(summary, progress)
  if (status === 'planned') return CATALOG_STATUS_LABELS.planned
  if (status === 'in-progress' && progress?.inProgress) {
    return `진행 중 ${turnProgressLabel(progress.inProgress.turnIndex, summary.durationTurns)}`
  }
  if (status === 'completed' && progress) {
    const best = progress.best
    if (best) return `완료 · ${best.grade} ${formatNumber(best.total, 0)}점`
    const last = progress.attempts[0]
    if (last) return `완료 · ${last.grade} ${formatNumber(last.total, 0)}점`
    return CATALOG_STATUS_LABELS.completed
  }
  return CATALOG_STATUS_LABELS.available
}

/** Sort order for the catalog: playable first, then in-progress, completed, planned last. */
const STATUS_RANK: Record<CatalogStatus, number> = {
  'in-progress': 0,
  available: 1,
  completed: 2,
  planned: 3,
}

export type CatalogSort = 'recommended' | 'year-asc' | 'year-desc' | 'duration'

export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  recommended: '추천순',
  'year-asc': '연도 오래된순',
  'year-desc': '연도 최신순',
  duration: '소요 시간 짧은순',
}

/**
 * Available-first ordering. Within the same status band an easier, shorter scenario comes first so
 * a first-time visitor lands on an 입문 card rather than the hardest one.
 */
const DIFFICULTY_RANK: Record<ScenarioSummary['difficulty'], number> = {
  intro: 0,
  standard: 1,
  advanced: 2,
}

export function sortCatalog(
  list: ScenarioSummary[],
  sort: CatalogSort,
  progressOf: (id: string) => ScenarioProgress | undefined,
): ScenarioSummary[] {
  const rank = (s: ScenarioSummary) => STATUS_RANK[catalogStatusOf(s, progressOf(s.id))]
  return [...list].sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    switch (sort) {
      case 'year-asc':
        return a.year - b.year || a.era.localeCompare(b.era)
      case 'year-desc':
        return b.year - a.year || b.era.localeCompare(a.era)
      case 'duration':
        return a.estMinutes - b.estMinutes || a.title.localeCompare(b.title, 'ko')
      default:
        return (
          DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
          a.estMinutes - b.estMinutes ||
          a.title.localeCompare(b.title, 'ko')
        )
    }
  })
}

/** Scenario ids whose briefing teaches any of `cardIds` (used by the framework/glossary pages). */
export function scenariosUsingCards(cardIds: readonly string[]): string[] {
  if (cardIds.length === 0) return []
  const wanted = new Set(cardIds)
  return SCENARIOS.filter((e) => e.summary.cardRefs?.some((r) => wanted.has(r))).map(
    (e) => e.summary.id,
  )
}

/** DOM id of a decision block in the debrief path comparison (timeline markers scroll to it). */
export function decisionAnchorId(decisionId: string): string {
  return `decision-${decisionId}`
}
