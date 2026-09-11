import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { DebriefTimeline } from '../components/debrief/DebriefTimeline'
import { LessonList } from '../components/debrief/LessonList'
import { MistakeList } from '../components/debrief/MistakeList'
import { OnePageSummary } from '../components/debrief/OnePageSummary'
import { PathComparison } from '../components/debrief/PathComparison'
import { Quiz } from '../components/debrief/Quiz'
import { ScoreRadar } from '../components/debrief/ScoreRadar'
import { SourcesList } from '../components/debrief/SourcesList'
import { Citation } from '../components/knowledge/Citation'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, Button, Card, EmptyState, Tabs } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { InfoTip } from '../components/ui/InfoTip'
import { advanceTurn, autoplay, computeScore, decisionRegrets, findTurn, replay } from '../engine'
import type { GameState, Mode, ScenarioDefinition } from '../engine/types'
import type { AttemptSave } from '../persistence/schema'
import { decisionAnchorId } from '../lib/catalog'
import { buildDebriefText, copyText } from '../lib/debriefText'
import { MODE_LABELS, shortDate } from '../lib/labels'
import { usePrintMode } from '../lib/usePrintMode'
import { useScenarioDef } from '../lib/useScenario'
import { useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'
import { HelpProvider } from '../components/help'

type TabId = 'paths' | 'mistakes' | 'lessons' | 'quiz' | 'sources'

const TABS: { id: TabId; label: string }[] = [
  { id: 'paths', label: '경로 비교' },
  { id: 'mistakes', label: '실수와 what-if' },
  { id: 'lessons', label: '교훈' },
  { id: 'quiz', label: '퀴즈' },
  { id: 'sources', label: '출처' },
]

function tabFromHash(hash: string): TabId {
  const id = hash.replace(/^#/, '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'paths'
}

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

function Panel({
  id,
  active,
  printAll,
  children,
}: {
  id: TabId
  active: TabId
  printAll: boolean
  children: ReactNode
}) {
  const shown = printAll || active === id
  const label = TABS.find((t) => t.id === id)?.label ?? id
  return (
    <div
      role="tabpanel"
      id={`dbf-panel-${id}`}
      aria-label={label}
      hidden={!shown}
      className="pt-4"
      tabIndex={shown ? 0 : -1}
    >
      {shown && (
        <>
          {printAll && <h3 className="mb-2 text-md font-semibold">{label}</h3>}
          {children}
        </>
      )}
    </div>
  )
}

export default function DebriefPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const loc = useLocation()
  const printing = usePrintMode()
  const { summary, def, loading, error } = useScenarioDef(scenarioId)
  const gScenario = useGameStore((s) => s.scenario)
  const gState = useGameStore((s) => s.state)
  const gHistory = useGameStore((s) => s.history)
  const gRun = useGameStore((s) => s.run)
  const progress = useProgressStore((s) => (scenarioId ? s.scenarios[scenarioId] : undefined))
  const attempts = progress?.attempts
  const [forkError, setForkError] = useState<string | undefined>()
  const [copied, setCopied] = useState<'ok' | 'fail' | undefined>()
  const finishedRef = useRef<string | undefined>()

  const tab = tabFromHash(loc.hash)
  const setTab = useCallback((id: TabId) => navigate({ hash: id }, { replace: true }), [navigate])

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

  // The historical/expert autoplays take tens of ms each; run them after first paint so the
  // summary renders immediately and the comparison cells fill in.
  const [paths, setPaths] = useState<{
    historical?: GameState
    expert?: GameState
    done: boolean
  }>({ done: false })
  const seed = data?.run.seed
  useEffect(() => {
    if (!scenario || seed === undefined) return
    let cancelled = false
    setPaths({ done: false })
    const t = setTimeout(() => {
      let historical: GameState | undefined
      let expert: GameState | undefined
      try {
        historical = autoplay(scenario, 'historical', { seed }).state
      } catch {
        /* path not reproducible on this version */
      }
      try {
        expert = autoplay(scenario, 'expert', { seed }).state
      } catch {
        /* path not reproducible on this version */
      }
      if (!cancelled) setPaths({ historical, expert, done: true })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [scenario, seed])

  const handleFork = useCallback(
    (turnIndex: number) => {
      if (!scenario || !data) return
      const g = useGameStore.getState()
      const isLive =
        g.run?.runId === data.run.runId &&
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
    },
    [data, navigate, scenario, scenarioId],
  )

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
  const topMistakeIds = regrets
    .filter((r) => r.regret > 0)
    .slice(0, 3)
    .map((r) => r.decisionId)

  const scrollToTurn = (turnIndex: number) => {
    const rec = state.decisions.find((d) => d.turnIndex === turnIndex)
    if (!rec) return
    setTab('paths')
    window.setTimeout(() => {
      const el = document.getElementById(decisionAnchorId(rec.decisionId))
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    }, 0)
  }

  const onCopy = () => {
    const text = buildDebriefText({
      scenario,
      state,
      report,
      mode: run.mode,
      historical: paths.historical,
      expert: paths.expert,
      regrets,
    })
    void copyText(text).then((ok) => {
      setCopied(ok ? 'ok' : 'fail')
      window.setTimeout(() => setCopied(undefined), 4000)
    })
  }

  return (
    <HelpProvider context={{ page: 'debrief', scenario, state }}>
      <div className="space-y-5" data-print-all={printing ? 'true' : undefined}>
        <nav aria-label="경로" className="text-sm text-muted" data-noprint>
          <Link to="/">시나리오</Link> <span aria-hidden="true">›</span>{' '}
          <Link to={`/scenarios/${scenarioId}`}>{scenario.meta.title}</Link>{' '}
          <span aria-hidden="true">›</span> 디브리핑
        </nav>

        <OnePageSummary
          scenario={scenario}
          state={state}
          report={report}
          mode={run.mode}
          historical={paths.historical}
          expert={paths.expert}
          regrets={regrets}
          computing={!paths.done}
          onFork={handleFork}
          badges={
            <>
              {run.forkedFrom && (
                <Badge tone="info">T+{run.forkedFrom.turnIndex}부터 포크 (최고 점수 미반영)</Badge>
              )}
              {data.source === 'attempt' && data.attempt && (
                <Badge tone="neutral">{shortDate(data.attempt.completedAt)} 기록에서 재구성</Badge>
              )}
            </>
          }
        />

        {forkError && (
          <p className="text-sm text-critical" role="alert">
            {forkError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2" data-noprint>
          <Button variant="secondary" onClick={onCopy}>
            <Icon name="copy" size={16} />
            텍스트로 복사
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="printer" size={16} />
            인쇄
          </Button>
          {copied && (
            <span
              className={copied === 'ok' ? 'text-sm text-positive' : 'text-sm text-critical'}
              role="status"
            >
              {copied === 'ok' ? '클립보드에 복사했습니다.' : '복사하지 못했습니다.'}
            </span>
          )}
        </div>

        <section aria-labelledby="dbf-detail-h">
          <h2 id="dbf-detail-h" className="sr-only">
            상세
          </h2>
          <div data-noprint>
            <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="디브리핑 상세" />
          </div>

          <Panel id="paths" active={tab} printAll={printing}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-3">
                <DebriefTimeline
                  scenario={scenario}
                  state={state}
                  historical={paths.historical}
                  expert={paths.expert}
                  onMarkerClick={scrollToTurn}
                  forceTable={printing}
                />
                {!paths.done && (
                  <p className="mt-1 text-sm text-muted" role="status">
                    역사·전문가 경로를 계산 중…
                  </p>
                )}
              </Card>
              <Card className="p-3">
                <ScoreRadar report={report} forceTable={printing} />
              </Card>
            </div>

            <h3 className="mt-4 text-md font-semibold">결정별 경로 비교</h3>
            <p className="mb-2 text-sm text-muted">
              주요 실수 3건은 펼쳐져 있고, 나머지는 머리글만 표시됩니다.
            </p>
            <PathComparison
              scenario={scenario}
              state={state}
              onFork={handleFork}
              expandedDecisionIds={topMistakeIds}
              forceExpanded={printing}
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-3">
                <h3 className="text-md font-semibold">역사적 결과</h3>
                <Markdown className="mt-1 text-base">
                  {scenario.debrief.historical.summary}
                </Markdown>
                {scenario.debrief.historical.timeline.length > 0 && (
                  <ol className="m-0 mt-2 list-none space-y-1 border-l border-border p-0 pl-3 text-sm">
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
                <h4 className="mt-3 text-base font-semibold">결과</h4>
                <Markdown className="mt-1 text-base">
                  {scenario.debrief.historical.outcome}
                </Markdown>
              </Card>
              <Card className="p-3">
                <h3 className="text-md font-semibold">전문가 관점</h3>
                <Markdown className="mt-1 text-base">{scenario.debrief.expert.summary}</Markdown>
                <h4 className="mt-3 text-base font-semibold">근거</h4>
                <Markdown className="mt-1 text-base">{scenario.debrief.expert.rationale}</Markdown>
                {scenario.debrief.expert.caveats.length > 0 && (
                  <>
                    <h4 className="mt-3 text-base font-semibold">유의점</h4>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
                      {scenario.debrief.expert.caveats.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>
          </Panel>

          <Panel id="mistakes" active={tab} printAll={printing}>
            <h3 className="flex items-center gap-1 text-md font-semibold">
              주요 실수 Top 3
              <InfoTip label="후회 점수 설명">
                후회 = 해당 결정에서 선택할 수 있었던 최고 전문가 평점 − 실제로 선택한 옵션의 평점.
                복수 선택이면 선택한 옵션 평점의 평균을 씁니다.
              </InfoTip>
            </h3>
            <div className="mt-2">
              <MistakeList
                scenario={scenario}
                state={state}
                history={history}
                regrets={regrets}
                onFork={handleFork}
              />
            </div>
          </Panel>

          <Panel id="lessons" active={tab} printAll={printing}>
            <LessonList scenario={scenario} state={state} lessons={scenario.debrief.lessons} />
          </Panel>

          <Panel id="quiz" active={tab} printAll={printing}>
            <Quiz
              scenarioId={scenario.meta.id}
              questions={scenario.debrief.quiz}
              localSources={scenario.meta.sources}
              previous={progress?.quiz}
            />
          </Panel>

          <Panel id="sources" active={tab} printAll={printing}>
            <SourcesList sources={scenario.meta.sources} />
            <p className="mt-2 text-sm text-muted">
              모델 대상: {scenario.meta.modelledOn}. 기관명·수치·발언은 교육 목적으로
              단순화·각색되었습니다.
            </p>
          </Panel>
        </section>

        <footer className="flex flex-wrap gap-2 border-t border-border pt-4" data-noprint>
          <Button variant="primary" onClick={() => navigate(`/scenarios/${scenarioId}`)}>
            다시 플레이
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            카탈로그로
          </Button>
          <Button variant="ghost" onClick={() => navigate('/progress')}>
            진행 현황 보기
          </Button>
          <span className="num ml-auto self-center text-sm text-muted">
            {MODE_LABELS[run.mode]} 모드 · seed {run.seed}
          </span>
        </footer>
      </div>
    </HelpProvider>
  )
}
