import { Link } from 'react-router-dom'
import type { ScenarioSummary } from '../../engine/types'
import type { ScenarioProgress } from '../../persistence/schema'
import { catalogStatusOf, catalogStatusText } from '../../lib/catalog'
import { DIFFICULTY_LABELS, ROLE_SHORT } from '../../lib/labels'
import { Badge, type Tone } from '../ui'

const STATUS_TONE: Record<ReturnType<typeof catalogStatusOf>, Tone> = {
  available: 'info',
  'in-progress': 'warning',
  completed: 'positive',
  planned: 'neutral',
}

/**
 * Catalog card, reduced to what a reader needs to pick: 제목 · 한 줄 전제 · 역할 · 소요 시간 ·
 * 난이도 · 상태. Competency dots, tags and the institution name live on the briefing page.
 */
export function ScenarioCard({
  summary,
  progress,
}: {
  summary: ScenarioSummary
  progress: ScenarioProgress | undefined
}) {
  const status = catalogStatusOf(summary, progress)
  const planned = status === 'planned'
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-md font-semibold leading-tight">{summary.title}</h3>
        <Badge tone={STATUS_TONE[status]} className="num shrink-0 whitespace-nowrap">
          {catalogStatusText(summary, progress)}
        </Badge>
      </div>
      {summary.subtitle && <p className="mt-1 text-sm text-muted">{summary.subtitle}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span>{ROLE_SHORT[summary.role]}</span>
        <span aria-hidden="true">·</span>
        <span className="num">약 {summary.estMinutes}분</span>
        <span aria-hidden="true">·</span>
        <span>{DIFFICULTY_LABELS[summary.difficulty]}</span>
      </p>
    </>
  )
  const cls = 'block h-full rounded-lg border border-border bg-surface p-4 transition-colors'
  if (planned) {
    return (
      <article
        className={`${cls} opacity-60`}
        aria-disabled="true"
        aria-label={`${summary.title} — 준비 중`}
      >
        {body}
      </article>
    )
  }
  return (
    <Link
      to={`/scenarios/${summary.id}`}
      className={`${cls} text-text no-underline hover:border-accent focus-visible:border-accent`}
      aria-label={`${summary.title} 브리핑으로 이동`}
    >
      {body}
    </Link>
  )
}
