import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import type { GameState, ScenarioDefinition } from '../engine'
import { Dashboard, KpiStrip } from '../components/dashboard/Dashboard'
import { AdvisorDrawer, type DrawerTab } from '../components/drawer/AdvisorDrawer'
import { DecisionPanel } from '../components/play/DecisionPanel'
import { PlayLayout, type MobileTab } from '../components/play/PlayLayout'
import { ScenarioClock } from '../components/play/ScenarioClock'
import { TerminalCard } from '../components/play/TerminalCard'
import { WireFeed } from '../components/play/WireFeed'
import { PlayContext, type PlayContextValue } from '../components/play/playContext'
import { MODE_LABELS, safeTurnView, type PreviewState } from '../components/play/playHelpers'
import { Badge, Button, ConfirmDialog } from '../components/ui'
import { focusZone, SHORTCUTS, useKeyboardShortcuts, type Zone } from '../lib/keyboard'
import { useBreakpoint } from '../lib/useMediaQuery'
import { loadScenario } from '../scenarios'
import { useGameStore, type RunInfo } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'

function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shortcuts-title" className="mb-2 text-[15px] font-semibold">
          키보드 단축키
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="contents">
              <dt className="num whitespace-nowrap text-muted">{s.keys}</dt>
              <dd className="m-0">{s.label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex justify-end">
          <button
            ref={first}
            type="button"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] hover:bg-surface-2"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
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
  const rewindTo = useGameStore((s) => s.rewindTo)
  const abandon = useGameStore((s) => s.abandon)
  const finish = useGameStore((s) => s.finish)

  const view = useMemo(() => safeTurnView(state, scenario, mode), [state, scenario, mode])
  const ctx = useMemo<PlayContextValue | null>(
    () => (view ? { scenario, state, history, run, mode, view } : null),
    [scenario, state, history, run, mode, view],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('advisor')
  const [mobileTab, setMobileTab] = useState<MobileTab>('decide')
  const [dashboardExpanded, setDashboardExpanded] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [unread, setUnread] = useState(0)
  const [help, setHelp] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rewindTarget, setRewindTarget] = useState<number | null>(null)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const ended = state.phase === 'ended'
  const canRewind = !ended && mode !== 'expert' && state.turnIndex > 0

  // Move focus to the new turn header after the turn advances (or after a rewind).
  const prevTurn = useRef(state.turnIndex)
  useEffect(() => {
    if (prevTurn.current === state.turnIndex) return
    prevTurn.current = state.turnIndex
    setPreview(null)
    if (mobile) setMobileTab('feed')
    const t = window.setTimeout(() => document.getElementById('turn-header-current')?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [state.turnIndex, mobile])

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const openDrawer = (tab: DrawerTab) => {
    setDrawerTab(tab)
    setDrawerOpen(true)
  }
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const goZone = useCallback(
    (zone: Zone) => {
      if (bp === 'mobile') {
        setMobileTab(zone === 1 ? 'feed' : zone === 2 ? 'decide' : 'metrics')
        window.setTimeout(() => focusZone(zone), 30)
        return
      }
      if (bp === 'tablet' && zone === 3) {
        setDashboardExpanded(true)
        window.setTimeout(() => focusZone(zone), 30)
        return
      }
      focusZone(zone)
    },
    [bp],
  )
  useKeyboardShortcuts(
    {
      onZone: goZone,
      onToggleHelp: () => setHelp((h) => !h),
      onToggleAdvisor: () => {
        if (drawerOpen && drawerTab === 'advisor') setDrawerOpen(false)
        else openDrawer('advisor')
      },
    },
    !ended,
  )

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

  const turn = scenario.turns[state.turnIndex]
  const pendingCount = view
    ? view.decisions.filter((d) => !d.resolved && (d.decision.required ?? true)).length
    : 0

  const topBar = (
    <header className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3 text-[13px]">
      <Link
        to="/"
        className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-text"
      >
        ◀ 카탈로그
      </Link>
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <span className="truncate font-semibold">{scenario.meta.title}</span>
        {!mobile && <span className="truncate text-muted">· {scenario.meta.roleTitle}</span>}
        <Badge tone={mode === 'expert' ? 'warning' : mode === 'guided' ? 'info' : 'neutral'}>
          {MODE_LABELS[mode]} 모드
        </Badge>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {turn && (
          <ScenarioClock
            timeLabel={turn.timeLabel}
            turnIndex={state.turnIndex}
            durationTurns={scenario.meta.durationTurns}
            turnLabel={turn.label}
            compact={mobile}
          />
        )}
        {!ended && (
          <Button
            size="sm"
            variant={drawerOpen && drawerTab === 'advisor' ? 'primary' : 'secondary'}
            onClick={() => openDrawer('advisor')}
            aria-keyshortcuts="A"
            title="조언자 (A)"
          >
            조언자{mobile ? '' : ' (A)'}
          </Button>
        )}
        {!mobile && (
          <>
            <Button size="sm" onClick={() => openDrawer('cards')}>
              지식카드
            </Button>
            <Button size="sm" onClick={() => openDrawer('glossary')}>
              용어집
            </Button>
          </>
        )}
        <div className="relative" ref={menuRef}>
          <Button
            size="sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            메뉴 ▾
          </Button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="플레이 메뉴"
              className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-surface p-1 shadow-lg"
            >
              {mobile && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => {
                      setMenuOpen(false)
                      openDrawer('cards')
                    }}
                  >
                    지식카드
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => {
                      setMenuOpen(false)
                      openDrawer('glossary')
                    }}
                  >
                    용어집
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => {
                      setMenuOpen(false)
                      openDrawer('memos')
                    }}
                  >
                    메모
                  </button>
                  <div className="my-1 h-px bg-border" role="separator" />
                </>
              )}
              {canRewind && (
                <>
                  <div className="px-2 py-1 text-[11px] text-muted">되감기 (기록에 남습니다)</div>
                  {history.slice(0, state.turnIndex).map((_, i) => {
                    const t = scenario.turns[i]
                    return (
                      <button
                        key={i}
                        type="button"
                        role="menuitem"
                        className="block w-full rounded px-2 py-1.5 text-left hover:bg-surface-2"
                        onClick={() => {
                          setMenuOpen(false)
                          setRewindTarget(i)
                        }}
                      >
                        <span className="num">T+{i}</span> {t?.label} ·{' '}
                        <span className="text-muted">{t?.timeLabel}</span>
                      </button>
                    )
                  })}
                  <div className="my-1 h-px bg-border" role="separator" />
                </>
              )}
              {!ended && mode === 'expert' && (
                <div className="px-2 py-1 text-[11px] text-muted">
                  전문가 모드에서는 되감기를 사용할 수 없습니다
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-surface-2"
                onClick={() => {
                  setMenuOpen(false)
                  setHelp(true)
                }}
              >
                키보드 단축키 (?)
              </button>
              <Link
                role="menuitem"
                to="/settings"
                className="block w-full rounded px-2 py-1.5 text-left text-text no-underline hover:bg-surface-2"
              >
                설정
              </Link>
              <div className="my-1 h-px bg-border" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded px-2 py-1.5 text-left text-critical hover:bg-surface-2"
                onClick={() => {
                  setMenuOpen(false)
                  setAbandonOpen(true)
                }}
              >
                시나리오 포기
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )

  if (!ctx || !view) {
    return (
      <div className="flex h-full flex-col">
        {topBar}
        <p className="p-6 text-muted" role="alert">
          턴 정보를 불러올 수 없습니다. 카탈로그로 돌아가 다시 시작해 주세요.
        </p>
      </div>
    )
  }

  return (
    <PlayContext.Provider value={ctx}>
      <div className="flex h-full flex-col">
        {topBar}
        {ended ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <TerminalCard onDebrief={onDebrief} />
          </div>
        ) : (
          <PlayLayout
            bp={bp}
            feed={<WireFeed onUnreadChange={setUnread} />}
            decisions={<DecisionPanel onPreview={setPreview} sticky={mobile} />}
            dashboard={<Dashboard preview={preview} />}
            kpiStrip={
              <KpiStrip
                onSelect={mobile ? () => setMobileTab('metrics') : () => setDashboardExpanded(true)}
              />
            }
            mobileTab={mobileTab}
            onMobileTab={setMobileTab}
            unreadCount={unread}
            pendingCount={pendingCount}
            dashboardExpanded={dashboardExpanded}
            onToggleDashboard={() => setDashboardExpanded((v) => !v)}
          />
        )}
        <AdvisorDrawer
          open={drawerOpen}
          tab={drawerTab}
          onTab={setDrawerTab}
          onClose={closeDrawer}
          mobile={mobile}
        />
        <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
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
