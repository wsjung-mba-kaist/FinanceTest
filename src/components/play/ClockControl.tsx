import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useMediaQuery'
import { Icon } from '../ui/Icon'
import { ScenarioClock } from './ScenarioClock'

export type ClockSpeed = 1 | 2 | 4

/** Live-clock state owned by the store. Absent ⇒ the turn has no sub-turn ticks: render nothing. */
export interface ClockState {
  running: boolean
  speed: ClockSpeed
  tick: number
  ticks: number
  /** Clock label of the current tick, e.g. '09:00'. */
  tickLabel?: string
  /** 0..1 of the way through the current tick (drives the dot fill). */
  progress?: number
  /** Why the clock stopped on its own, shown next to the dots. */
  holdReason?: string
  onPause?: () => void
  onResume?: () => void
  onSpeed?: (speed: ClockSpeed) => void
}

const SPEEDS: ClockSpeed[] = [1, 2, 4]

/** `●●○○○` — filled up to the current tick, the current one breathing while the clock runs. */
function TickDots({
  tick,
  ticks,
  running,
  progress,
}: {
  tick: number
  ticks: number
  running: boolean
  progress: number
}) {
  const reduced = useReducedMotion()
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`틱 ${tick + 1}/${ticks}`}
      title={`틱 ${tick + 1}/${ticks}`}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const done = i < tick
        const current = i === tick
        const fill = current && !reduced ? 0.35 + 0.65 * Math.min(1, Math.max(0, progress)) : 1
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              done || current ? 'bg-accent' : 'bg-border-strong'
            }`}
            style={current && running && !reduced ? { opacity: fill } : undefined}
          />
        )
      })}
    </span>
  )
}

function SpeedMenu({
  speed,
  running,
  onSpeed,
  onPause,
}: {
  speed: ClockSpeed
  running: boolean
  onSpeed?: (s: ClockSpeed) => void
  onPause?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = running ? `×${speed}` : '수동'
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="num rounded-md border border-border px-1.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`시계 속도 ${label}`}
        aria-keyshortcuts="+ -"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="시계 속도"
          className="absolute right-0 top-full z-30 mt-1 w-32 rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={running && speed === s}
              className="block w-full rounded px-2 py-1.5 text-left text-base hover:bg-surface-2"
              onClick={() => {
                setOpen(false)
                onSpeed?.(s)
              }}
            >
              ×{s}
            </button>
          ))}
          <div className="my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!running}
            className="block w-full rounded px-2 py-1.5 text-left text-base hover:bg-surface-2"
            onClick={() => {
              setOpen(false)
              onPause?.()
            }}
          >
            수동
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Scenario clock in the status bar: the turn's time label, `T+n/N`, and — only on a turn that
 * actually has sub-turn ticks — a play/pause button, the tick label, tick dots and a speed menu.
 * A scenario without ticks passes no `clock` and keeps exactly the pre-L2 appearance.
 */
export function ClockControl({
  timeLabel,
  turnLabel,
  turnIndex,
  durationTurns,
  compact,
  clock,
}: {
  timeLabel: string
  turnLabel?: string
  turnIndex: number
  durationTurns: number
  compact?: boolean
  clock?: ClockState
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ScenarioClock
        timeLabel={timeLabel}
        turnIndex={turnIndex}
        durationTurns={durationTurns}
        turnLabel={turnLabel}
        compact={compact}
      />
      {clock && clock.ticks > 1 && (
        <div className="flex items-center gap-1" role="group" aria-label="시뮬레이션 시계">
          {clock.tickLabel && (
            <span className="num rounded border border-border bg-surface-2 px-1.5 py-0.5 text-sm text-text">
              {clock.tickLabel}
            </span>
          )}
          <button
            type="button"
            className="rounded-md border border-border px-1.5 py-1 text-muted hover:bg-surface-2 hover:text-text"
            aria-label={clock.running ? '시계 일시정지' : '시계 재개'}
            aria-pressed={clock.running}
            aria-keyshortcuts="Space"
            title={clock.holdReason ?? (clock.running ? '시계 일시정지' : '시계 재개')}
            onClick={() => (clock.running ? clock.onPause?.() : clock.onResume?.())}
          >
            <Icon name={clock.running ? 'pause' : 'play'} size={14} />
          </button>
          <TickDots
            tick={clock.tick}
            ticks={clock.ticks}
            running={clock.running && (clock.progress ?? 0) > 0}
            progress={clock.progress ?? 0}
          />
          <SpeedMenu
            speed={clock.speed}
            running={clock.running}
            onSpeed={clock.onSpeed}
            onPause={clock.onPause}
          />
        </div>
      )}
    </div>
  )
}
