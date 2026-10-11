import { useState } from 'react'
import type { Decision, DecisionView, FeedItem, MetricDelta } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { splitOptionLabel } from '../../lib/text'
import { Badge, Button, Card } from '../ui'
import { Icon } from '../ui/Icon'
import { ConsequenceReel } from './ConsequenceReel'
import { RationalePanel } from './RationalePanel'
import type { ReelStep } from './reelSteps'
import { usePlay } from './playContext'
import { deadlineCaption, letterFor, tickLabelOf, type RevealTiming } from './playHelpers'

/** A resolved decision: one line, the reel it produced, and the rationale below it. */
export function ResolvedRow({
  dv,
  index,
  timing,
  showRationale,
  feedItems,
  turnDeltas,
  reel,
  skipSignal,
  onReelDone,
}: {
  dv: DecisionView
  index: number
  timing: RevealTiming
  showRationale: boolean
  feedItems: FeedItem[]
  turnDeltas: MetricDelta[]
  /** The engine reel to play under this row (only when it was caused by this decision). */
  reel?: ReelBinding
  skipSignal: number
  onReelDone: () => void
}) {
  const { scenario, state } = usePlay()
  const [open, setOpen] = useState(false)
  const record = state.decisions.find(
    (r) => r.turnIndex === state.turnIndex && r.decisionId === dv.decision.id,
  )
  const chosen = dv.chosen.map((id) => ({
    id,
    letter: letterFor(dv.options.findIndex((o) => o.option.id === id)),
    title: splitOptionLabel(dv.decision.options.find((o) => o.id === id)?.label ?? id).title,
  }))
  return (
    <Card
      as="article"
      className="p-3"
      aria-labelledby={`resolved-${dv.decision.id}`}
      data-resolved={dv.decision.id}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="label-caps">결정 {index + 1}</span>
        <h3 id={`resolved-${dv.decision.id}`} className="text-base font-semibold">
          {dv.decision.title}
        </h3>
        <Badge tone="positive">확정</Badge>
        {record?.timedOut && <Badge tone="warning">시간 초과 · 기본 선택</Badge>}
        {record?.hintsUsed ? <Badge tone="neutral">힌트 {record.hintsUsed}단계</Badge> : null}
        <span className="w-full text-base text-muted">
          {chosen.map((c) => `${c.letter}. ${c.title}`).join(' · ')}
        </span>
      </div>
      {dv.dialogue && dv.dialogue.transcript.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm text-muted">
            대화 기록 {dv.dialogue.transcript.length}단계
          </summary>
          <ol className="mt-1 space-y-0.5 pl-4 text-sm text-muted">
            {dv.dialogue.transcript.map(({ step, reply }) => (
              <li key={step.id}>{reply.label}</li>
            ))}
          </ol>
        </details>
      )}
      {record?.memo && (
        <p className="mt-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-sm">
          <span className="text-muted">메모 · </span>
          {record.memo}
        </p>
      )}
      {reel && reel.steps.length > 0 && (
        <div className="mt-2">
          <ConsequenceReel
            key={reel.id}
            steps={reel.steps}
            units={scenario.units}
            skipSignal={skipSignal}
            immediate={reel.played}
            onDone={onReelDone}
          />
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          aria-expanded={open}
          className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
          onClick={() => setOpen((o) => !o)}
        >
          근거 보기
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
        {open &&
          (showRationale ? (
            <RationalePanel dv={dv} feedItems={feedItems} turnDeltas={turnDeltas} />
          ) : (
            <p className="text-sm text-muted">
              {timing === 'endOfTurn'
                ? '결정 근거는 이 턴의 결정이 모두 확정되면 공개됩니다.'
                : '결정 근거는 시나리오 종료 후 디브리핑에서 공개됩니다.'}
            </p>
          ))}
      </div>
    </Card>
  )
}

/** A decision the turn will ask for, but not at this tick yet. */
export function UpcomingRow({ decision, tick }: { decision: Decision; tick: number }) {
  const { view } = usePlay()
  const from = decision.availableFrom ?? 0
  return (
    <article
      className="rounded-lg bg-disabled-bg p-3 text-disabled-fg"
      aria-disabled="true"
      data-upcoming={decision.id}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-semibold">{decision.title}</h3>
        <span className="num text-sm text-muted">
          {tickLabelOf(view.turn, from)} 이후 선택 가능
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {deadlineCaption(view.turn, decision, tick) || '지금은 아직 요청받지 않았습니다'}
      </p>
    </article>
  )
}

/** The engine reel the dock is currently showing, with whether it has already been played out. */
export interface ReelBinding {
  id: string
  steps: ReelStep[]
  played: boolean
  decisionId?: string
}

/**
 * An unresolved decision that is not the open one: title, deadline and a way in.
 *
 * The player chooses the order — this is not a wizard. What it is not is three fully expanded
 * question blocks competing for the same screen.
 */
export function PendingRow({
  dv,
  index,
  onOpen,
}: {
  dv: DecisionView
  index: number
  onOpen: () => void
}) {
  const { view } = usePlay()
  const deadline =
    dv.decision.deadlineTick !== undefined
      ? tickLabelOf(view.turn, dv.decision.deadlineTick)
      : undefined
  return (
    <article className="rounded-lg border border-border-control bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-tap-min w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
        aria-label={`결정 ${index + 1} ${dv.decision.title} 열기`}
      >
        <span className="label-caps shrink-0">결정 {index + 1}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{dv.decision.title}</span>
        {deadline && <span className="num shrink-0 text-sm text-warning">{deadline}까지</span>}
        <Icon name="chevron-right" size={16} />
      </button>
    </article>
  )
}

/**
 * The dock's action bar, rendered into the zone's non-scrolling footer.
 *
 * It used to be the last child of the scrolled list, held down by `sticky bottom-0` — which an
 * ancestor's `overflow-hidden` silently disabled, so on a 1280×800 screen the 다음 턴 button
 * started every turn below the fold. Living outside the scroll box is the fix: there is nothing
 * left for a stray `overflow` to break.
 */
export function DockActionBar({ onNext }: { onNext: () => boolean }) {
  const { scenario, state, view } = usePlay()
  const lastError = useGameStore((s) => s.lastError)
  const [nextFailed, setNextFailed] = useState(false)
  const isLast = state.turnIndex >= scenario.turns.length - 1
  const handleNext = () => setNextFailed(!onNext())

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      {nextFailed && lastError && (
        <p role="alert" className="w-full text-sm text-critical">
          {lastError}
        </p>
      )}
      <span className="text-sm text-muted">
        {view.allResolved
          ? isLast
            ? '마지막 턴입니다'
            : '다음 턴으로 넘어갈 수 있습니다'
          : '필수 결정을 모두 확정하면 넘어갈 수 있습니다'}
      </span>
      <Button
        variant={view.allResolved ? 'primary' : 'secondary'}
        className="ml-auto"
        disabled={!view.allResolved}
        aria-keyshortcuts="N"
        onClick={handleNext}
      >
        {isLast ? '시나리오 마무리' : '다음 턴으로'}
        <Icon name="arrow-right" size={14} />
      </Button>
    </div>
  )
}
