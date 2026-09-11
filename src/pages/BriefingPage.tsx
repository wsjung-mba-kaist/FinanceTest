import { Link, useParams } from 'react-router-dom'
import { Dossier } from '../components/briefing/Dossier'
import { Badge, EmptyState } from '../components/ui'
import {
  DIFFICULTY_LABELS,
  INSTITUTION_TYPE_LABELS,
  REGION_LABELS,
  TURN_UNIT_LABELS,
} from '../lib/labels'
import { useScenarioDef } from '../lib/useScenario'

export default function BriefingPage() {
  const { scenarioId } = useParams()
  const { summary, def, loading, error } = useScenarioDef(scenarioId)

  if (!summary) {
    return (
      <EmptyState title="시나리오를 찾을 수 없습니다">
        <Link to="/">카탈로그로 돌아가기</Link>
      </EmptyState>
    )
  }
  if (summary.status === 'planned') {
    return (
      <div className="space-y-4">
        <Header summary={summary} />
        <EmptyState title="준비 중인 시나리오입니다 (M2/M3)">
          아직 플레이할 수 없습니다. <Link to="/">카탈로그로 돌아가기</Link>
        </EmptyState>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <Header summary={summary} />
      {loading && (
        <p className="text-muted" role="status">
          브리핑을 불러오는 중…
        </p>
      )}
      {error && <p className="text-critical">시나리오를 불러오지 못했습니다: {error}</p>}
      {def && <Dossier scenario={def} />}
    </div>
  )
}

function Header({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useScenarioDef>['summary']>
}) {
  return (
    <header className="space-y-2">
      <nav aria-label="경로" className="text-[12px] text-muted">
        <Link to="/">시나리오</Link> <span aria-hidden="true">›</span> 브리핑
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{summary.title}</h1>
          {summary.subtitle && <p className="text-muted">{summary.subtitle}</p>}
          <p className="mt-1 text-[12px]">
            {summary.roleTitle} · {summary.institutionName}
          </p>
        </div>
        {import.meta.env.DEV && (
          <Link to={`/dev/scenario/${summary.id}`} className="text-[12px]">
            DEV 인스펙터
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone="neutral">{summary.era}</Badge>
        <Badge tone="neutral">{REGION_LABELS[summary.region]}</Badge>
        <Badge tone="neutral">{INSTITUTION_TYPE_LABELS[summary.institutionType]}</Badge>
        <Badge tone="neutral">{DIFFICULTY_LABELS[summary.difficulty]}</Badge>
        <Badge tone="neutral" className="num">
          {summary.durationTurns}턴 × 1{TURN_UNIT_LABELS[summary.turnUnit]}
        </Badge>
        <Badge tone="neutral" className="num">
          약 {summary.estMinutes}분
        </Badge>
      </div>
    </header>
  )
}
