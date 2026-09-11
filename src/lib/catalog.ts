import type { ScenarioSummary } from '../engine/types'
import type { ScenarioProgress } from '../persistence/schema'

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

/** DOM id of a decision block in the debrief path comparison (timeline markers scroll to it). */
export function decisionAnchorId(decisionId: string): string {
  return `decision-${decisionId}`
}
