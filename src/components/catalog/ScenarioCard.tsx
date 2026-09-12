import { Link } from 'react-router-dom'
import type { ScenarioSummary } from '../../engine/types'
import type { ScenarioProgress } from '../../persistence/schema'
import { catalogStatusOf, catalogStatusText } from '../../lib/catalog'
import { DIFFICULTY_LABELS, ROLE_SHORT } from '../../lib/labels'
import { Badge, type Tone } from '../ui'
import { cardClass } from '../ui/cardStyles'

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
  const cls = cardClass('base', 'block h-full p-4 transition-colors')
  if (planned) {
    return (
      <article className={`${cls} bg-disabled-bg text-disabled-fg`} aria-disabled="true">
        {body}
        <span className="sr-only"> — 준비 중</span>
      </article>
    )
  }
  return (
    <Link
      to={`/scenarios/${summary.id}`}
      className={`${cls} text-text no-underline hover:border-accent focus-visible:border-accent`}
    >
      {/*
        No `aria-label` on the card. An `aria-label` *replaces* an element's contents in the
        accessibility tree, so "SVB 브리핑으로 이동" was all a screen-reader user ever heard —
        the role, the running time, the difficulty and the completion badge, all of which are on
        screen, were erased by the label meant to help. The card reads itself; only the action
        needs adding.
      */}
      {body}
      <span className="sr-only"> — 브리핑으로 이동</span>
    </Link>
  )
}
