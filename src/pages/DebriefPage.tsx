import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DebriefTimeline } from '../components/debrief/DebriefTimeline'
import { LessonList } from '../components/debrief/LessonList'
import { MistakeList } from '../components/debrief/MistakeList'
import { PathComparison } from '../components/debrief/PathComparison'
import { Quiz } from '../components/debrief/Quiz'
import { ScoreRadar } from '../components/debrief/ScoreRadar'
import { SourcesList } from '../components/debrief/SourcesList'
import { Citation } from '../components/knowledge/Citation'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, Button, EmptyState, StatusBadge } from '../components/ui'
import {
  advanceTurn,
  autoplay,
  computeScore,
  decisionRegrets,
  findTurn,
  latestSnapshot,
  replay,
} from '../engine'
import type { GameState, Mode, ScenarioDefinition } from '../engine/types'
import type { AttemptSave } from '../persistence/schema'
import { decisionAnchorId } from '../lib/catalog'
import { formatMetric, formatNumber } from '../lib/format'
import { MODE_LABELS, shortDate } from '../lib/labels'
import { useScenarioDef } from '../lib/useScenario'
import { useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'

interface DebriefRun {
  runId: string
  mode: Mode
  seed: number
  hintPenalty: number
  forkedFrom?: { runId: string; turnIndex: number }
}

interface DebriefData {
  state: GameState
  history: GameState[]
  run: DebriefRun
  source: 'live' | 'attempt'
  attempt?: AttemptSave
}

function rebuildFromAttempt(
  scenario: ScenarioDefinition,
  attempt: AttemptSave,
): DebriefData | undefined {
  try {
    const { state, history } = replay(scenario, {
      seed: attempt.seed,
      decisions: attempt.decisions,
      turnIndex: scenario.turns.length - 1,
    })
    let s = state
    if (s.phase !== 'ended') {
      try {
        s = advanceTurn(s, scenario)
      } catch {
        /* unresolved decisions → cannot finish */
      }
    }
    if (s.phase !== 'ended') return undefined
    return {
      state: s,
      history,
      run: {
        runId: attempt.runId,
        mode: attempt.mode,
        seed: attempt.seed,
        hintPenalty: attempt.hintPenalty,
        forkedFrom: attempt.forkedFrom,
      },
      source: 'attempt',
      attempt,
    }
  } catch {
    return undefined
  }
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 text-[16px] font-semibold tracking-tight scroll-mt-4">
      {children}
    </h2>
  )
}

export default function DebriefPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const { summary, def, loading, error } = useScenarioDef(scenarioId)
  const gScenario = useGameStore((s) => s.scenario)
  const gState = useGameStore((s) => s.state)
  const gHistory = useGameStore((s) => s.history)
  const gRun = useGameStore((s) => s.run)
  const progress = useProgressStore((s) => (scenarioId ? s.scenarios[scenarioId] : undefined))
  const attempts = progress?.attempts
  const [forkError, setForkError] = useState<string | undefined>()
  const finishedRef = useRef<string | undefined>()

  const live = useMemo<DebriefData | undefined>(() => {
    if (
      !gState ||
      !gRun ||
      !gScenario ||
      gScenario.meta.id !== scenarioId ||
      gState.phase !== 'ended'
    )
      return undefined
    return {
      state: gState,
      history: gHistory,
      run: {
        runId: gRun.runId,
        mode: gRun.mode,
        seed: gRun.seed,
        hintPenalty: gRun.hintPenalty,
        forkedFrom: gRun.forkedFrom,
      },
      source: 'live',
    }
  }, [gState, gRun, gScenario, gHistory, scenarioId])

  const scenario = live ? gScenario : def

  const rebuilt = useMemo<DebriefData | undefined>(() => {
    if (live || !scenario) return undefined
    const latest = attempts?.[0]
    return latest ? rebuildFromAttempt(scenario, latest) : undefined
  }, [live, scenario, attempts])

  const data = live ?? rebuilt

  // Record the live run once (idempotent: skip if already in the attempt list).
  useEffect(() => {
    if (!live) return
    if (finishedRef.current === live.run.runId) return
    const recorded = useProgressStore
      .getState()
      .scenarios[live.state.scenarioId]?.attempts.some((a) => a.runId === live.run.runId)
    finishedRef.current = live.run.runId
    if (!recorded) useGameStore.getState().finish()
  }, [live])

  // Nothing to debrief → back to the briefing.
  useEffect(() => {
    if (loading || !summary || summary.status !== 'available') return
    if (!scenario) return
    if (!live && (!attempts || attempts.length === 0))
      navigate(`/scenarios/${scenarioId}`, { replace: true })
  }, [loading, summary, scenario, live, attempts, navigate, scenarioId])

  const report = useMemo(
    () => (data && scenario ? computeScore(data.state, scenario) : undefined),
    [data, scenario],
  )
  const regrets = useMemo(
    () => (data && scenario ? decisionRegrets(data.state, scenario) : []),
    [data, scenario],
  )
  const historical = useMemo(() => {
    if (!data || !scenario) return undefined
    try {
      return autoplay(scenario, 'historical', { seed: data.run.seed }).state
    } catch {
      return undefined
    }
  }, [data, scenario])
  const expert = useMemo(() => {
    if (!data || !scenario) return undefined
    try {
      return autoplay(scenario, 'expert', { seed: data.run.seed }).state
    } catch {
      return undefined
    }
  }, [data, scenario])

  if (!summary) {
    return (
      <EmptyState title="시나리오를 찾을 수 없습니다">
        <Link to="/">카탈로그로 돌아가기</Link>
      </EmptyState>
    )
  }
  if (summary.status === 'planned') {
    return (
      <EmptyState title="준비 중인 시나리오입니다">
        <Link to="/">카탈로그로 돌아가기</Link>
      </EmptyState>
    )
  }
  if (loading || (!scenario && !error)) {
    return (
      <p className="text-muted" role="status">
        디브리핑을 준비하는 중…
      </p>
    )
  }
  if (error || !scenario)
    return <p className="text-critical">시나리오를 불러오지 못했습니다: {error}</p>
  if (!data || !report) {
    return (
      <EmptyState title="디브리핑할 기록이 없습니다">
        {attempts && attempts.length > 0
          ? '저장된 기록을 현재 시나리오 버전으로 재구성할 수 없습니다. '
          : ''}
        <Link to={`/scenarios/${scenarioId}`}>브리핑으로 이동</Link>
      </EmptyState>
    )
  }

  const { state, history, run } = data
  const ended = state.ended
  const snap = latestSnapshot(state)
  const primaryKpis = (() => {
    const p = scenario.kpis.filter((k) => k.primary)
    return (p.length > 0 ? p : scenario.kpis).slice(0, 4)
  })()

  const handleFork = (turnIndex: number) => {
    const g = useGameStore.getState()
    const isLive =
      g.run?.runId === run.runId &&
      g.scenario?.meta.id === scenarioId &&
      g.history.length > turnIndex
    if (!isLive) {
      const a = data.attempt
      if (!a) {
        setForkError('이 기록에서는 다시 시작할 수 없습니다.')
        return
      }
      const ok = g.restore(scenario, {
        runId: a.runId,
        seed: a.seed,
        mode: a.mode,
        scenarioVersion: a.scenarioVersion,
        decisions: a.decisions,
        turnIndex,
        rewinds: 0,
        hintPenalty: a.hintPenalty,
        hintsRevealed: {},
        startedAt: a.completedAt,
        updatedAt: a.completedAt,
        forkedFrom: a.forkedFrom,
      })
      if (!ok) {
        setForkError('저장된 기록이 현재 시나리오 버전과 맞지 않아 다시 시작할 수 없습니다.')
        return
      }
    }
    useGameStore.getState().forkFrom(turnIndex)
    navigate(`/play/${scenarioId}`)
  }

  const scrollToTurn = (turnIndex: number) => {
    const rec = state.decisions.find((d) => d.turnIndex === turnIndex)
    if (!rec) return
    const el = document.getElementById(decisionAnchorId(rec.decisionId))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  const outcomeTone = ended?.failed ? (ended.orderly ? 'warning' : 'critical') : 'positive'
  const outcomeText = ended?.failed ? (ended.orderly ? '질서 있는 정리' : '폐쇄·실패') : '생존·완료'

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <nav aria-label="경로" className="text-[12px] text-muted">
          <Link to="/">시나리오</Link> <span aria-hidden="true">›</span>{' '}
          <Link to={`/scenarios/${scenarioId}`}>{scenario.meta.title}</Link>{' '}
          <span aria-hidden="true">›</span> 디브리핑
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={outcomeTone}>{outcomeText}</Badge>
              <Badge tone="neutral">{MODE_LABELS[run.mode]} 모드</Badge>
              {run.forkedFrom && (
                <Badge tone="info">T+{run.forkedFrom.turnIndex}부터 포크 (최고 점수 미반영)</Badge>
              )}
              {data.source === 'attempt' && data.attempt && (
                <Badge tone="neutral">{shortDate(data.attempt.completedAt)} 기록에서 재구성</Badge>
              )}
            </div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
              {ended?.title ?? '시나리오 종료'}
            </h1>
            {ended?.narrative && <p className="mt-1 max-w-3xl text-muted">{ended.narrative}</p>}
            {ended && (
              <p className="mt-1 text-[12px] text-muted num">
                종료 시점 {scenario.turns[ended.turnIndex]?.label ?? `T${ended.turnIndex}`} ·{' '}
                {scenario.turns[ended.turnIndex]?.timeLabel}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-right">
            <div className="text-[11px] text-muted">종합 점수</div>
            <div className="num text-[28px] font-semibold leading-none">
              {formatNumber(report.total, 1)}
              <span className="ml-2 text-[16px] text-muted">{report.grade}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted num">
              전문가 정합 {formatNumber(report.expertAlignment, 0)} · 힌트 감점 −
              {formatNumber(report.hintPenalty, 0)} · 시간 초과 {report.timeoutCount}회
            </div>
          </div>
        </div>
        <ul
          className="grid list-none gap-2 p-0 m-0 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="최종 핵심 지표"
        >
          {primaryKpis.map((k) => {
            const m = snap.metrics[k.metric]
            return (
              <li key={k.metric} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="text-[11px] text-muted">{k.label}</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="num text-[18px] font-semibold">
                    {m ? formatMetric(m.value, k.unit, scenario.units, k.decimals) : '—'}
                  </span>
                  <StatusBadge status={m?.status ?? 'na'} />
                </div>
              </li>
            )
          })}
        </ul>
        {forkError && (
          <p className="text-[12px] text-critical" role="alert">
            {forkError}
          </p>
        )}
      </header>

      <section aria-labelledby="dbf-score" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3">
          <SectionHeading id="dbf-score">점수</SectionHeading>
          <ScoreRadar report={report} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <SectionHeading id="dbf-timeline">경로</SectionHeading>
          <DebriefTimeline
            scenario={scenario}
            state={state}
            historical={historical}
            expert={expert}
            onMarkerClick={scrollToTurn}
          />
        </div>
      </section>

      <section aria-labelledby="dbf-mistakes">
        <SectionHeading id="dbf-mistakes">주요 실수 Top 3</SectionHeading>
        <p className="mb-2 text-[12px] text-muted">
          후회 = 결정 내 최고 전문가 평점 − 선택한 옵션 평점.
        </p>
        <MistakeList
          scenario={scenario}
          state={state}
          history={history}
          regrets={regrets}
          onFork={handleFork}
        />
      </section>

      <section aria-labelledby="dbf-path">
        <SectionHeading id="dbf-path">결정별 경로 비교</SectionHeading>
        <PathComparison scenario={scenario} state={state} onFork={handleFork} />
      </section>

      <section aria-labelledby="dbf-history" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3">
          <SectionHeading id="dbf-history">역사적 결과</SectionHeading>
          <Markdown className="text-[12px]">{scenario.debrief.historical.summary}</Markdown>
          {scenario.debrief.historical.timeline.length > 0 && (
            <ol className="mt-2 list-none space-y-1 border-l border-border p-0 pl-3 text-[12px]">
              {scenario.debrief.historical.timeline.map((t, i) => {
                const turn = findTurn(scenario, t.turnId)
                return (
                  <li key={`${t.turnId}-${i}`}>
                    <span className="num font-medium">{turn?.label ?? t.turnId}</span>
                    {turn?.timeLabel && <span className="text-muted"> {turn.timeLabel}</span>}
                    <div>
                      {t.note}
                      {t.sourceRefs.length > 0 && (
                        <Citation ids={t.sourceRefs} local={scenario.meta.sources} />
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          <h3 className="mt-3 text-[13px] font-semibold">결과</h3>
          <Markdown className="text-[12px]">{scenario.debrief.historical.outcome}</Markdown>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <SectionHeading id="dbf-expert">전문가 관점</SectionHeading>
          <Markdown className="text-[12px]">{scenario.debrief.expert.summary}</Markdown>
          <h3 className="mt-3 text-[13px] font-semibold">근거</h3>
          <Markdown className="text-[12px]">{scenario.debrief.expert.rationale}</Markdown>
          {scenario.debrief.expert.caveats.length > 0 && (
            <>
              <h3 className="mt-3 text-[13px] font-semibold">유의점</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-muted">
                {scenario.debrief.expert.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {scenario.paths.expert?.note && (
            <p className="mt-2 text-[12px] text-muted">{scenario.paths.expert.note}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="dbf-lessons">
        <SectionHeading id="dbf-lessons">교훈</SectionHeading>
        <LessonList scenario={scenario} state={state} lessons={scenario.debrief.lessons} />
      </section>

      <section aria-labelledby="dbf-quiz">
        <SectionHeading id="dbf-quiz">퀴즈</SectionHeading>
        <Quiz
          scenarioId={scenario.meta.id}
          questions={scenario.debrief.quiz}
          localSources={scenario.meta.sources}
          previous={progress?.quiz}
        />
      </section>

      <section aria-labelledby="dbf-sources">
        <SectionHeading id="dbf-sources">출처</SectionHeading>
        <SourcesList sources={scenario.meta.sources} />
        <p className="mt-2 text-[11px] text-muted">
          모델 대상: {scenario.meta.modelledOn}. 기관명·수치·발언은 교육 목적으로
          단순화·각색되었습니다.
        </p>
      </section>

      <footer className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="primary" onClick={() => navigate(`/scenarios/${scenarioId}`)}>
          다시 플레이
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          카탈로그로
        </Button>
        <Button variant="ghost" onClick={() => navigate('/progress')}>
          진행 현황 보기
        </Button>
      </footer>
    </div>
  )
}
