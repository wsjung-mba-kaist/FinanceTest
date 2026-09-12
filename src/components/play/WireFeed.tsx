import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, LiveRegion } from '../ui'
import { usePlay } from './playContext'
import {
  dayKeyOf,
  previousTurnEntries,
  tickLabelOf,
  tickOfEntry,
  turnEntries,
  type WireEntry,
} from './playHelpers'
import { WireItem } from './WireItem'

function TurnSeparator({
  turnIndex,
  label,
  timeLabel,
  title,
  current,
}: {
  turnIndex: number
  label: string
  timeLabel: string
  title?: string
  current?: boolean
}) {
  return (
    <h3
      id={current ? 'turn-header-current' : `turn-header-${turnIndex}`}
      tabIndex={-1}
      className="flex items-center gap-2 pt-2 text-sm font-semibold text-muted"
    >
      <span className="num rounded-sm bg-surface-2 px-1.5 py-0.5 text-text">{label}</span>
      <span>{timeLabel}</span>
      {title && <span className="text-text">· {title}</span>}
      <span className="ml-2 h-px flex-1 bg-border" aria-hidden="true" />
    </h3>
  )
}

/** `09:00` rule between feed items belonging to different sub-turn ticks. */
function TickSeparator({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 pt-1 text-xs text-muted"
      role="separator"
      aria-label={`${label} 시각`}
      data-tick-separator={label}
    >
      <span className="num rounded-sm bg-surface-2 px-1.5 py-0.5">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  )
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 pt-3 text-xs uppercase tracking-wide text-muted"
      role="separator"
      aria-label={label}
    >
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  )
}

/**
 * Chronological situation feed: previous turns (collapsed) + this turn's visible events and engine feed items.
 * Unread ids are tracked locally; `onUnreadChange` reports the count for the mobile tab badge.
 */
export function WireFeed({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const { scenario, state, history, mode, view } = usePlay()
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const [showPrevious, setShowPrevious] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [urgent, setUrgent] = useState('')

  const current = useMemo(() => turnEntries(view), [view])
  const previous = useMemo(
    () => previousTurnEntries(history, state, scenario, mode),
    [history, state, scenario, mode],
  )
  const previousCount = previous.reduce((a, t) => a + t.entries.length, 0)

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Batched announcement per turn (and for feed items that arrive mid-turn).
  const announcedTurn = useRef(-1)
  const announcedCount = useRef(0)
  useEffect(() => {
    if (announcedTurn.current !== state.turnIndex) {
      announcedTurn.current = state.turnIndex
      announcedCount.current = current.length
      setAnnounce(current.length > 0 ? `T+${state.turnIndex} 새 소식 ${current.length}건` : '')
      // Previous turns' entries count as read once the turn has passed.
      setReadIds((prev) => {
        const next = new Set(prev)
        for (const t of previous) for (const e of t.entries) next.add(e.id)
        return next
      })
    } else if (current.length > announcedCount.current) {
      const added = current.length - announcedCount.current
      announcedCount.current = current.length
      setAnnounce(`새 소식 ${added}건`)
    }
    const critical = current.filter(
      (e) => (e.event?.severity ?? e.feed?.severity) === 'critical' && !readIds.has(e.id),
    )
    setUrgent(
      critical.length > 0
        ? `치명 이벤트 ${critical.length}건: ${critical.map((e) => e.feed?.title ?? titleOf(e)).join(', ')}`
        : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnIndex, current.length])

  const unreadCount = current.filter((e) => !readIds.has(e.id)).length
  useEffect(() => {
    onUnreadChange?.(unreadCount)
  }, [unreadCount, onUnreadChange])

  const currentTurn = view.turn
  // Tick rules only make sense on a turn that actually has sub-turn ticks.
  const ticked = view.ticks > 1
  const prevTurnDef = state.turnIndex > 0 ? scenario.turns[state.turnIndex - 1] : undefined
  const showDayForCurrent = !prevTurnDef || dayKeyOf(prevTurnDef) !== dayKeyOf(currentTurn)

  return (
    <div className="space-y-2 p-3">
      <LiveRegion message={announce} />
      <LiveRegion message={urgent} assertive />
      {previousCount > 0 && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showPrevious}
            onClick={() => setShowPrevious((s) => !s)}
          >
            {showPrevious ? '이전 턴 접기' : `이전 턴 ${previousCount}건 펼치기`}
          </Button>
        </div>
      )}
      {showPrevious &&
        previous.map((t, idx) => {
          const def = scenario.turns[t.turnIndex]
          if (!def) return null
          const before = idx > 0 ? scenario.turns[t.turnIndex - 1] : undefined
          const newDay = !before || dayKeyOf(before) !== dayKeyOf(def)
          return (
            <section
              key={t.turnIndex}
              aria-label={`${def.label} ${def.timeLabel}`}
              className="space-y-2 opacity-90"
            >
              {newDay && <DaySeparator label={dayKeyOf(def)} />}
              <TurnSeparator
                turnIndex={t.turnIndex}
                label={def.label}
                timeLabel={def.timeLabel}
                title={def.title}
              />
              {t.entries.length === 0 && (
                <p className="text-sm text-muted">이 턴에는 소식이 없었습니다.</p>
              )}
              {t.entries.map((e) => (
                <WireItem
                  key={e.id}
                  entry={e}
                  unread={false}
                  onRead={markRead}
                  sources={scenario.meta.sources}
                />
              ))}
            </section>
          )
        })}
      <section
        aria-label={`${currentTurn.label} ${currentTurn.timeLabel} (현재 턴)`}
        className="space-y-2"
      >
        {showDayForCurrent && <DaySeparator label={dayKeyOf(currentTurn)} />}
        <TurnSeparator
          turnIndex={state.turnIndex}
          label={currentTurn.label}
          timeLabel={currentTurn.timeLabel}
          title={currentTurn.title}
          current
        />
        {current.length === 0 && <p className="text-sm text-muted">아직 새 소식이 없습니다.</p>}
        {current.map((e, i) => {
          const tick = tickOfEntry(e, state)
          const prevTick = i > 0 ? tickOfEntry(current[i - 1]!, state) : -1
          return (
            <Fragment key={e.id}>
              {ticked && tick !== prevTick && (
                <TickSeparator label={tickLabelOf(currentTurn, tick)} />
              )}
              <WireItem
                entry={e}
                unread={!readIds.has(e.id)}
                onRead={markRead}
                sources={scenario.meta.sources}
              />
            </Fragment>
          )
        })}
      </section>
    </div>
  )
}

function titleOf(e: WireEntry): string {
  const ev = e.event
  if (!ev) return ''
  switch (ev.kind) {
    case 'memo':
      return ev.subject
    case 'call':
      return `${ev.caller} 통화`
    case 'data':
    case 'dialogue':
      return ev.title
    default:
      return ev.headline
  }
}
