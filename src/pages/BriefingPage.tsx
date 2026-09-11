import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConceptPreview } from '../components/briefing/ConceptPreview'
import { Dossier } from '../components/briefing/Dossier'
import { ExecutiveSummary } from '../components/briefing/ExecutiveSummary'
import { PreflightChecklist } from '../components/briefing/PreflightChecklist'
import { Badge, Button, EmptyState } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { latestSnapshot } from '../engine'
import type { Mode, ScenarioDefinition, ScenarioSummary } from '../engine/types'
import { baselineGame, deriveBriefingSummary } from '../lib/briefingSummary'
import { HelpProvider } from '../components/help'
import {
  DIFFICULTY_LABELS,
  INSTITUTION_TYPE_LABELS,
  REGION_LABELS,
  TURN_UNIT_LABELS,
} from '../lib/labels'
import { useScenarioDef } from '../lib/useScenario'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'

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
        <EmptyState title="준비 중인 시나리오입니다">
          <p>아직 플레이할 수 없습니다. 시작 가능한 시나리오를 먼저 살펴보세요.</p>
          <p className="mt-2">
            <Link to="/">카탈로그로 돌아가기</Link>
          </p>
        </EmptyState>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <Header summary={summary} />
      {loading && (
        <p className="text-muted" role="status">
          브리핑을 불러오는 중…
        </p>
      )}
      {error && <p className="text-critical">시나리오를 불러오지 못했습니다: {error}</p>}
      {def && <BriefingBody scenario={def} />}
    </div>
  )
}

function BriefingBody({ scenario }: { scenario: ScenarioDefinition }) {
  return (
    <HelpProvider context={{ page: 'briefing', scenario }}>
      <BriefingBodyInner scenario={scenario} />
    </HelpProvider>
  )
}

function BriefingBodyInner({ scenario }: { scenario: ScenarioDefinition }) {
  const defaultMode = useSettingsStore((s) => s.defaultMode)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [dossierOpen, setDossierOpen] = useState(false)

  const baselineState = useMemo(() => baselineGame(scenario), [scenario])
  const baseline = useMemo(
    () => (baselineState ? latestSnapshot(baselineState) : undefined),
    [baselineState],
  )
  const summary = useMemo(() => deriveBriefingSummary(scenario, baseline), [scenario, baseline])

  return (
    <div className="space-y-6">
      <ExecutiveSummary
        scenario={scenario}
        summary={summary}
        baseline={baseline}
        baselineState={baselineState}
        mode={mode}
        setMode={setMode}
      />

      <ConceptPreview cardIds={summary.concepts} onView={markCardViewed} />

      <PreflightChecklist items={summary.preflight} scenario={scenario} baseline={baseline} />

      <section aria-labelledby="bf-dossier-h">
        <h2 id="bf-dossier-h" className="m-0">
          <Button
            variant="secondary"
            aria-expanded={dossierOpen}
            aria-controls="bf-dossier-panel"
            onClick={() => setDossierOpen((v) => !v)}
          >
            <Icon name={dossierOpen ? 'chevron-down' : 'chevron-right'} size={16} />
            전체 도시에 {dossierOpen ? '접기' : '펼치기'}
          </Button>
        </h2>
        <p className="mt-1 text-sm text-muted">
          기관 현황·시장 배경·이해관계자·규제·평가 기준·출처 8개 절. 플레이 중에도 도움 시트에서 볼
          수 있습니다.
        </p>
        <div id="bf-dossier-panel" hidden={!dossierOpen} className="mt-3">
          <Dossier scenario={scenario} />
        </div>
      </section>
    </div>
  )
}

function Header({ summary }: { summary: ScenarioSummary }) {
  return (
    <header className="space-y-2">
      <nav aria-label="경로" className="text-sm text-muted">
        <Link to="/">시나리오</Link> <span aria-hidden="true">›</span> 브리핑
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{summary.title}</h1>
          {summary.subtitle && <p className="text-muted">{summary.subtitle}</p>}
          <p className="mt-1 text-sm">
            {summary.roleTitle} · {summary.institutionName}
          </p>
        </div>
        {import.meta.env.DEV && (
          <Link to={`/dev/scenario/${summary.id}`} className="text-sm">
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
