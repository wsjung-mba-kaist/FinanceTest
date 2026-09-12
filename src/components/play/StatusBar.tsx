import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RUN_STATE_LABELS, runStateFromCi } from '../../metrics/runoff'
import { useHelp } from '../help/helpContext'
import { Badge, Button, CountPill, type Tone } from '../ui'
import { Icon } from '../ui/Icon'
import { ClockControl, type ClockState } from './ClockControl'
import { usePlay } from './playContext'
import { MODE_LABELS, REGULATOR_LABELS } from './playHelpers'

function RunStateChip({ ci, compact }: { ci: number; compact: boolean }) {
  const run = runStateFromCi(ci)
  const tone: Tone = run >= 2 ? 'critical' : run === 1 ? 'warning' : 'positive'
  const label = RUN_STATE_LABELS[run]
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      {compact ? `S${run}` : `런 ${label}`}
    </Badge>
  )
}

function RegulatorChip({ level, compact }: { level: number; compact: boolean }) {
  const tone: Tone =
    level >= 3 ? 'critical' : level === 2 ? 'warning' : level === 1 ? 'info' : 'neutral'
  const label = REGULATOR_LABELS[level] ?? `R${level}`
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      {compact ? `R${level}` : `감독 ${label.replace(/^R\d\s/, '')}`}
    </Badge>
  )
}

/**
 * Top bar (48px): back link, scenario · role · mode, the scenario clock, the two escalation
 * chips that used to be buried in the dashboard (런 상태 S0–S3, 감독 단계 R0–R4), 도움 and the menu.
 */
export function StatusBar({
  compact,
  onShortcuts,
  onRewind,
  onAbandon,
  clock,
}: {
  /** Tablet/mobile: chips and labels shorten. */
  compact: boolean
  onShortcuts: () => void
  onRewind: (turnIndex: number) => void
  onAbandon: () => void
  clock?: ClockState
}) {
  const { scenario, state, history, mode } = usePlay()
  const help = useHelp()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const ended = state.phase === 'ended'
  const canRewind = !ended && mode !== 'expert' && state.turnIndex > 0
  const turn = scenario.turns[state.turnIndex]

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 text-base">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-muted no-underline hover:bg-surface-2 hover:text-text"
      >
        <Icon name="arrow-left" size={14} />
        {compact ? '' : '카탈로그'}
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap">
        <span className="min-w-0 truncate font-semibold">{scenario.meta.title}</span>
        {!compact && (
          <span className="min-w-0 truncate text-muted">· {scenario.meta.roleTitle}</span>
        )}
        <Badge tone={mode === 'expert' ? 'warning' : mode === 'guided' ? 'info' : 'neutral'}>
          {MODE_LABELS[mode]}
        </Badge>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {turn && (
          <ClockControl
            timeLabel={turn.timeLabel}
            turnLabel={turn.label}
            turnIndex={state.turnIndex}
            durationTurns={scenario.meta.durationTurns}
            compact={compact}
            clock={clock}
          />
        )}
        <RunStateChip ci={state.confidence.index} compact={compact} />
        <RegulatorChip level={state.regulator.level} compact={compact} />
        <Button
          size="sm"
          variant={help.isOpen ? 'primary' : 'secondary'}
          aria-keyshortcuts="?"
          aria-expanded={help.isOpen}
          onClick={() => (help.isOpen ? help.close() : help.open())}
          title="도움 (?)"
        >
          <Icon name="help" size={14} />
          도움
          <CountPill count={help.badge} label="새 도움말" className="ml-0.5" />
        </Button>
        <div className="relative" ref={menuRef}>
          <Button
            size="sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            메뉴
            <Icon name="chevron-down" size={14} />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="플레이 메뉴"
              className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-surface p-1 shadow-lg"
            >
              {canRewind && (
                <>
                  <div className="px-2 py-1 text-xs text-muted">되감기 (기록에 남습니다)</div>
                  {history.slice(0, state.turnIndex).map((_, i) => {
                    const t = scenario.turns[i]
                    return (
                      <button
                        key={i}
                        type="button"
                        role="menuitem"
                        className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-surface-2"
                        onClick={() => {
                          setMenuOpen(false)
                          onRewind(i)
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
                <div className="px-2 py-1 text-xs text-muted">
                  전문가 모드에서는 되감기를 사용할 수 없습니다
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-surface-2"
                onClick={() => {
                  setMenuOpen(false)
                  onShortcuts()
                }}
              >
                키보드 단축키
              </button>
              <Link
                role="menuitem"
                to="/settings"
                className="block w-full rounded-sm px-2 py-1.5 text-left text-text no-underline hover:bg-surface-2"
              >
                설정
              </Link>
              <div className="my-1 h-px bg-border" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded-sm px-2 py-1.5 text-left text-critical hover:bg-surface-2"
                onClick={() => {
                  setMenuOpen(false)
                  onAbandon()
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
}
