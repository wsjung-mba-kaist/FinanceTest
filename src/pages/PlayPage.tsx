import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GameState, ScenarioDefinition } from '../engine'
import { BalanceSheetMini } from '../components/dashboard/BalanceSheetMini'
import { Dashboard } from '../components/dashboard/Dashboard'
import { DecisionDock } from '../components/play/DecisionDock'
import { InterruptOverlay } from '../components/play/InterruptOverlay'
import { LiquidityStrip } from '../components/play/LiquidityStrip'
import { LogPanel } from '../components/play/LogPanel'
import { PlayLayout, type InfoTab, type MobileTab } from '../components/play/PlayLayout'
import { ShortcutsSheet } from '../components/play/ShortcutsSheet'
import { SituationPanel } from '../components/play/SituationPanel'
import { StatusBar } from '../components/play/StatusBar'
import { TerminalCard } from '../components/play/TerminalCard'
import { TurnIntroCard } from '../components/play/TurnIntroCard'
import { UndoToast } from '../components/play/UndoToast'
import { WireFeed } from '../components/play/WireFeed'
import { PlayContext, type PlayContextValue } from '../components/play/playContext'
import {
  safeTurnView,
  tickLabelOf,
  turnEntries,
  type PreviewState,
} from '../components/play/playHelpers'
import { ConfirmDialog, LiveRegion } from '../components/ui'
import { useHelp } from '../components/help/helpContext'
import { HelpProvider } from '../components/help'
import { focusZone, useKeyboardShortcuts, type Zone } from '../lib/keyboard'
import { useSimulationClock } from '../lib/useSimulationClock'
import { useBreakpoint } from '../lib/useMediaQuery'
import { loadScenario } from '../scenarios'
import { useGameStore, type ClockSpeed, type RunInfo } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'

const SPEED_STEPS: ClockSpeed[] = [1, 2, 4]

const ZONE_TO_TAB: Record<Zone, InfoTab | 'decide'> = {
  1: 'situation',
  2: 'decide',
  3: 'dashboard',
  4: 'feed',
  5: 'log',
}

function PlayView({
  scenario,
  state,
  history,
  run,
}: {
  scenario: ScenarioDefinition
  state: GameState
  history: GameState[]
  run: RunInfo
}) {
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const mobile = bp === 'mobile'
  const mode = run.mode
  const help = useHelp()
  const rewindTo = useGameStore((s) => s.rewindTo)
  const abandon = useGameStore((s) => s.abandon)
  const finish = useGameStore((s) => s.finish)
  const nextTurn = useGameStore((s) => s.next)
  const undoable = useGameStore((s) => s.undoable)
  const undoChoice = useGameStore((s) => s.undoChoice)
  const clearUndo = useGameStore((s) => s.clearUndo)
  const playedReelId = useGameStore((s) => s.playedReelId)
  const markReelPlayed = useGameStore((s) => s.markReelPlayed)
  const resume = useGameStore((s) => s.resume)
  const pauseClock = useGameStore((s) => s.pause)

  const view = useMemo(() => safeTurnView(state, scenario, mode), [state, scenario, mode])
  const ctx = useMemo<PlayContextValue | null>(
    () => (view ? { scenario, state, history, run, mode, view } : null),
    [scenario, state, history, run, mode, view],
  )

  const [infoTab, setInfoTab] = useState<InfoTab>('situation')
  const [mobileTab, setMobileTab] = useState<MobileTab>('situation')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [feedUnread, setFeedUnread] = useState(0)
  const [shortcuts, setShortcuts] = useState(false)
  const [rewindTarget, setRewindTarget] = useState<number | null>(null)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const [skipSignal, setSkipSignal] = useState(0)
  const [announce, setAnnounce] = useState('')
  const [undoLabel, setUndoLabel] = useState('')
  /** Turn index whose intro card the player has already dismissed with 시작 ▶. */
  const [startedTurn, setStartedTurn] = useState<number | null>(null)

  const ended = state.phase === 'ended'
  const ticked = (view?.ticks ?? 1) > 1
  // The intro gate only exists on a ticked turn: an un-ticked scenario behaves exactly as before.
  const introPending = Boolean(view) && ticked && !ended && startedTurn !== state.turnIndex
  // A reel the engine produced and the dock has not finished playing yet (turn reels never play).
  const reelPending = Boolean(
    state.lastReel &&
      state.lastReel.cause.kind !== 'turn' &&
      state.lastReel.steps.length > 0 &&
      state.lastReel.id !== playedReelId,
  )
  const clock = useSimulationClock({ helpOpen: help.isOpen, introPending })
  const interrupt = view?.interrupts[0]

  // A turn-start reel duplicates the situation panel, so it is retired without being played.
  useEffect(() => {
    const last = state.lastReel
    if (!last || last.id === playedReelId) return
    if (last.cause.kind === 'turn' || last.steps.length === 0) markReelPlayed(last.id)
  }, [state.lastReel, playedReelId, markReelPlayed])

  // 자동 일시정지는 조용히 일어나면 안 된다 — 왜 멈췄는지 스크린리더에도 알린다.
  const prevHold = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (clock.holdReason && clock.holdReason !== prevHold.current) setAnnounce(clock.holdReason)
    prevHold.current = clock.holdReason
  }, [clock.holdReason])
  const pendingCount = view
    ? view.decisions.filter((d) => !d.resolved && (d.decision.required ?? true)).length
    : 0
  const entryCount = view ? turnEntries(view).length : 0
  const unreadCount =
    infoTab === 'feed' && (!mobile || mobileTab === 'more')
      ? feedUnread
      : Math.max(0, entryCount - 4)

  // On a turn change (or rewind): clear the transient state, move focus to the new turn header.
  // `scrollResetKey` sends every zone back to the top inside PlayLayout.
  const prevTurn = useRef(state.turnIndex)
  useEffect(() => {
    if (prevTurn.current === state.turnIndex) return
    prevTurn.current = state.turnIndex
    setPreview(null)
    setStartedTurn(null)
    setInfoTab('situation')
    // The mobile tab only moves when something is actually being asked of the player.
    if (mobile && pendingCount > 0) setMobileTab('decide')
    const t = window.setTimeout(() => {
      const header = document.getElementById('turn-header-current')
      if (header) header.focus()
      else focusZone(2)
    }, 60)
    return () => window.clearTimeout(t)
  }, [state.turnIndex, mobile, pendingCount])

  const goZone = useCallback(
    (zone: Zone) => {
      const target = ZONE_TO_TAB[zone]
      if (target === 'decide') {
        if (mobile) setMobileTab('decide')
        window.setTimeout(() => focusZone(2), 30)
        return
      }
      setInfoTab(target)
      if (mobile)
        setMobileTab(
          target === 'situation' ? 'situation' : target === 'dashboard' ? 'metrics' : 'more',
        )
      window.setTimeout(() => focusZone(zone), 30)
    },
    [mobile],
  )

  const onNext = useCallback(() => {
    const isLast = state.turnIndex >= scenario.turns.length - 1
    const ok = nextTurn()
    if (ok) setAnnounce(isLast ? '시나리오가 종료되었습니다' : '다음 턴으로 이동했습니다')
    return ok
  }, [nextTurn, state.turnIndex, scenario.turns.length])

  const onUndo = useCallback(() => {
    if (!undoChoice()) return
    setPreview(null)
    setAnnounce('직전 결정을 실행 취소했습니다')
  }, [undoChoice])

  const onStartTurn = useCallback(() => {
    setStartedTurn(state.turnIndex)
    resume()
    setAnnounce('시계가 흐르기 시작했습니다')
  }, [state.turnIndex, resume])

  useKeyboardShortcuts(
    {
      onZone: goZone,
      onToggleHelp: () => (help.isOpen ? help.close() : help.open()),
      onNextTurn: () => {
        if (!ended && view?.allResolved) onNext()
      },
      onUndo: () => {
        if (undoable) onUndo()
      },
      onSkipReel: reelPending ? () => setSkipSignal((s) => s + 1) : undefined,
      onToggleClock: !ticked
        ? undefined
        : introPending
          ? onStartTurn
          : () => {
              clock.toggle()
              setAnnounce(clock.running ? '시계를 멈췄습니다' : '시계를 재개했습니다')
            },
      onSpeedStep: !ticked
        ? undefined
        : (delta) => {
            const i = SPEED_STEPS.indexOf(clock.speed)
            const next = SPEED_STEPS[Math.min(SPEED_STEPS.length - 1, Math.max(0, i + delta))]
            if (next === undefined) return
            clock.setSpeed(next)
            setAnnounce(`시계 속도 ×${next}`)
          },
    },
    !ended && !interrupt,
  )

  const onCommitted = useCallback((message: string) => {
    setSkipSignal(0)
    setAnnounce(message)
    setUndoLabel(message)
  }, [])

  const onDebrief = () => {
    const attempts = useProgressStore.getState().getScenario(scenario.meta.id).attempts
    if (!attempts.some((a) => a.runId === run.runId)) finish()
    navigate(`/debrief/${scenario.meta.id}`)
  }
  const onAbandon = () => {
    setAbandonOpen(false)
    abandon()
    navigate('/')
  }

  if (!ctx || !view) {
    return (
      <div className="flex h-full flex-col">
        <p className="p-6 text-muted" role="alert">
          턴 정보를 불러올 수 없습니다. 카탈로그로 돌아가 다시 시작해 주세요.
        </p>
      </div>
    )
  }

  return (
    <PlayContext.Provider value={ctx}>
      <HelpProvider context={{ page: 'play', scenario, state, view }} shortcuts={false}>
        <div className="flex h-full flex-col">
          <LiveRegion message={announce} />
          <StatusBar
            compact={bp !== 'desktop'}
            onShortcuts={() => setShortcuts(true)}
            onRewind={setRewindTarget}
            onAbandon={() => setAbandonOpen(true)}
            clock={
              ticked && !ended
                ? {
                    running: clock.intent,
                    speed: clock.speed,
                    tick: clock.tick,
                    ticks: clock.ticks,
                    tickLabel: view.tickLabel ?? tickLabelOf(view.turn, clock.tick),
                    progress: clock.progress,
                    holdReason: clock.holdReason,
                    onPause: pauseClock,
                    onResume: introPending ? onStartTurn : resume,
                    onSpeed: clock.setSpeed,
                  }
                : undefined
            }
          />
          {ended ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <TerminalCard onDebrief={onDebrief} />
            </div>
          ) : (
            <PlayLayout
              bp={bp}
              strip={<LiquidityStrip mobile={mobile} />}
              panels={{
                situation: (
                  <>
                    {introPending && (
                      <div className="p-3 pb-0">
                        <TurnIntroCard onStart={onStartTurn} />
                      </div>
                    )}
                    <SituationPanel onOpenFeed={() => goZone(4)} />
                  </>
                ),
                dashboard: <Dashboard preview={preview} />,
                feed: <WireFeed onUnreadChange={setFeedUnread} />,
                log: <LogPanel />,
                balance: (
                  <div className="p-3">
                    <BalanceSheetMini />
                  </div>
                ),
              }}
              dock={
                <DecisionDock
                  sticky={mobile}
                  onPreview={setPreview}
                  onCommitted={onCommitted}
                  skipSignal={skipSignal}
                  onNext={onNext}
                />
              }
              infoTab={infoTab}
              onInfoTab={setInfoTab}
              mobileTab={mobileTab}
              onMobileTab={setMobileTab}
              unreadCount={unreadCount}
              pendingCount={pendingCount}
              scrollResetKey={state.turnIndex}
            />
          )}
          {interrupt && !ended && (
            <InterruptOverlay
              key={interrupt.decision.id}
              dv={interrupt}
              onAnswered={() => setAnnounce('응답이 전달되었습니다')}
            />
          )}
          <UndoToast
            undoable={undoable}
            label={undoLabel || '결정을 확정했습니다'}
            onUndo={onUndo}
            onExpire={clearUndo}
          />
          <ShortcutsSheet open={shortcuts} onClose={() => setShortcuts(false)} />
          <ConfirmDialog
            open={rewindTarget !== null}
            title={`T+${rewindTarget ?? 0}으로 되감기`}
            body="이 턴 이후의 결정이 모두 지워집니다. 되감기 횟수는 기록에 남으며, 되감기한 런은 최고 점수 집계에서 제외됩니다."
            confirmLabel="되감기"
            onConfirm={() => {
              if (rewindTarget !== null) rewindTo(rewindTarget)
              setRewindTarget(null)
            }}
            onCancel={() => setRewindTarget(null)}
          />
          <ConfirmDialog
            open={abandonOpen}
            title="시나리오를 포기하시겠습니까"
            body="진행 중인 기록이 삭제되며 점수는 기록되지 않습니다."
            confirmLabel="포기"
            destructive
            onConfirm={onAbandon}
            onCancel={() => setAbandonOpen(false)}
          />
        </div>
      </HelpProvider>
    </PlayContext.Provider>
  )
}

/** Route `/play/:scenarioId`. Restores an in-progress run when the store is empty; otherwise sends the player to the briefing. */
export default function PlayPage() {
  const { scenarioId = '' } = useParams()
  const scenario = useGameStore((s) => s.scenario)
  const state = useGameStore((s) => s.state)
  const history = useGameStore((s) => s.history)
  const run = useGameStore((s) => s.run)
  const restore = useGameStore((s) => s.restore)
  const ready = Boolean(scenario && state && run && scenario.meta.id === scenarioId)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (ready || !scenarioId) return
    let cancelled = false
    setMissing(false)
    loadScenario(scenarioId).then(
      (def) => {
        if (cancelled) return
        const saved = def
          ? useProgressStore.getState().getScenario(scenarioId).inProgress
          : undefined
        const ok = def && saved ? restore(def, saved) : false
        if (!ok) setMissing(true)
      },
      () => {
        if (!cancelled) setMissing(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [ready, scenarioId, restore])

  if (!scenarioId) return <Navigate to="/" replace />
  if (missing) return <Navigate to={`/scenarios/${scenarioId}`} replace />
  if (!ready || !scenario || !state || !run) {
    return (
      <div className="p-8 text-muted" role="status">
        진행 상황을 불러오는 중…
      </div>
    )
  }
  return <PlayView key={run.runId} scenario={scenario} state={state} history={history} run={run} />
}
