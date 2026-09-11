import { useEffect, useRef } from 'react'
import type { Decision } from '../../engine'
import { Badge, Button, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { usePlay } from './playContext'
import { tickLabelOf } from './playHelpers'

/**
 * 이 턴의 과제 — the gate a ticked turn opens on. The clock is paused while this is up, so the
 * player reads the brief before real time starts moving. `시작 ▶` (Space) hands the turn over.
 *
 * Turns without sub-turn ticks never render it: those behave exactly as they did before L2.
 */
export function TurnIntroCard({ onStart }: { onStart: () => void }) {
  const { scenario, state, view } = usePlay()
  const startRef = useRef<HTMLButtonElement>(null)
  const turn = view.turn

  useEffect(() => {
    startRef.current?.focus()
  }, [])

  // Every decision the turn authors, with the ones the player already sees first.
  const open = new Set(view.decisions.map((d) => d.decision.id))
  const shown: Decision[] = [
    ...view.decisions.map((d) => d.decision),
    ...turn.decisions.filter((d) => !open.has(d.id)),
  ]
  const newsCount = view.events.length
  const interrupts = turn.interrupts?.length ?? 0

  return (
    <section
      aria-labelledby="turn-intro-title"
      className="card-key border-l-4 border-l-accent p-3"
      data-turn-intro={turn.id}
    >
      <LiveRegion message={`${turn.label} ${turn.timeLabel} · 시작하려면 시작 버튼을 눌러 주세요`} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps">이 턴의 과제</span>
        <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-sm">{turn.label}</span>
        <span className="text-sm text-muted">{turn.timeLabel}</span>
        <Badge tone="neutral">{view.ticks}틱</Badge>
      </div>
      <h2 id="turn-intro-title" className="prose-col mt-1 text-lg font-semibold">
        {turn.title ?? turn.timeLabel}
      </h2>
      <ul className="mt-2 list-none space-y-1 p-0 text-base">
        <li className="flex items-center gap-1.5">
          <Icon name="list" size={14} className="text-muted" />새 소식 {newsCount}건
        </li>
        {interrupts > 0 && (
          <li className="flex items-center gap-1.5">
            <Icon name="phone" size={14} className="text-muted" />
            연락이 올 수 있습니다
          </li>
        )}
      </ul>
      {shown.length > 0 && (
        <ul className="mt-2 list-none space-y-1 p-0">
          {shown.map((d) => {
            const from = d.availableFrom ?? 0
            const deadline = d.deadlineTick
            return (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-2 text-base">
                <span className="font-medium">{d.title}</span>
                {from > 0 && (
                  <span className="text-sm text-muted">
                    {tickLabelOf(turn, from)} 이후 선택 가능
                  </span>
                )}
                {deadline !== undefined && (
                  <span className="num text-sm text-warning">
                    마감 {tickLabelOf(turn, deadline)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {shown.length === 0 && (
        <p className="mt-2 text-base text-muted">이번 턴에 미리 요청받은 결정은 없습니다.</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button
          ref={startRef}
          variant="primary"
          className="min-h-[44px] sm:min-h-0"
          aria-keyshortcuts="Space"
          onClick={onStart}
        >
          시작
          <Icon name="play" size={14} />
        </Button>
        <span className="text-sm text-muted">
          시작하면 {scenario.meta.institutionName}의 시계가 흐릅니다 (Space)
        </span>
      </div>
      <p className="sr-only">현재 턴 {state.turnIndex + 1}번째</p>
    </section>
  )
}
