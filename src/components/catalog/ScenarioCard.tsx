import { Link } from 'react-router-dom'
import type { Competency, ScenarioSummary } from '../../engine/types'
import type { ScenarioProgress } from '../../persistence/schema'
import { catalogStatusOf } from '../../lib/catalog'
import { formatNumber } from '../../lib/format'
import {
  COMPETENCIES,
  DIFFICULTY_LABELS,
  DIMENSION_LABELS,
  MODE_LABELS,
  REGION_LABELS,
  TURN_UNIT_LABELS,
  turnProgressLabel,
} from '../../lib/labels'
import { Badge, type Tone } from '../ui'

function progressChip(
  summary: ScenarioSummary,
  progress: ScenarioProgress | undefined,
): { tone: Tone; text: string } {
  const status = catalogStatusOf(summary, progress)
  if (status === 'planned') return { tone: 'neutral', text: '준비 중 (M2/M3)' }
  if (status === 'in-progress' && progress?.inProgress) {
    return {
      tone: 'info',
      text: `진행 중 ${turnProgressLabel(progress.inProgress.turnIndex, summary.durationTurns)}`,
    }
  }
  if (status === 'completed' && progress) {
    const best = progress.best
    if (best)
      return {
        tone: 'positive',
        text: `완료 · ${MODE_LABELS[best.mode]} ${formatNumber(best.total, 1)}점 (${best.grade})`,
      }
    const last = progress.attempts[0]
    if (last)
      return {
        tone: 'positive',
        text: `완료 · ${MODE_LABELS[last.mode]} ${formatNumber(last.total, 1)}점`,
      }
  }
  return { tone: 'neutral', text: '미시작' }
}

function CompetencyDots({ competencies }: { competencies: ScenarioSummary['competencies'] }) {
  const entries = COMPETENCIES.filter((c) => (competencies[c] ?? 0) > 0)
    .map((c) => [c, competencies[c] ?? 0] as [Competency, number])
    .sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="역량 비중">
      {entries.map(([c, w]) => (
        <li key={c} className="flex items-center gap-1">
          <span>{DIMENSION_LABELS[c]}</span>
          <span className="font-mono tracking-tight" aria-label={`${w}/3`}>
            {'●'.repeat(Math.min(3, w))}
            <span className="opacity-30">{'●'.repeat(Math.max(0, 3 - w))}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ScenarioCard({
  summary,
  progress,
}: {
  summary: ScenarioSummary
  progress: ScenarioProgress | undefined
}) {
  const planned = summary.status === 'planned'
  const chip = progressChip(summary, progress)
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight">{summary.title}</h3>
          {summary.subtitle && <p className="text-[12px] text-muted mt-0.5">{summary.subtitle}</p>}
        </div>
        <Badge tone={chip.tone} className="shrink-0 whitespace-nowrap">
          {chip.text}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
        <dt className="text-muted">역할</dt>
        <dd>{summary.roleTitle}</dd>
        <dt className="text-muted">기관</dt>
        <dd>{summary.institutionName}</dd>
        <dt className="text-muted">분량</dt>
        <dd className="num">
          {summary.durationTurns}턴 × 1{TURN_UNIT_LABELS[summary.turnUnit]} · 약{' '}
          {summary.estMinutes}분
        </dd>
      </dl>
      <div className="mt-3">
        <CompetencyDots competencies={summary.competencies} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Badge tone="neutral">{summary.era}</Badge>
        <Badge tone="neutral">{REGION_LABELS[summary.region]}</Badge>
        <Badge tone="neutral">{DIFFICULTY_LABELS[summary.difficulty]}</Badge>
        {summary.tags.map((t) => (
          <Badge key={t} tone="neutral" className="opacity-80">
            #{t}
          </Badge>
        ))}
      </div>
    </>
  )
  const cls = 'block h-full rounded-lg border border-border bg-surface p-4 transition-colors'
  if (planned) {
    return (
      <article
        className={`${cls} opacity-55`}
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
