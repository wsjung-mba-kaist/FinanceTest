import { useMemo, useState } from 'react'
import type { DecisionView, FeedItem, MetricDelta } from '../../engine'
import { diffSnapshots, latestSnapshot } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Badge, Button, Card, LiveRegion } from '../ui'
import { DecisionCard } from './DecisionCard'
import { RationalePanel } from './RationalePanel'
import { usePlay } from './playContext'
import { letterFor, rationaleTiming, type PreviewState, type RevealTiming } from './playHelpers'

function ResolvedDecision({
  dv,
  index,
  timing,
  showRationale,
  feedItems,
  turnDeltas,
}: {
  dv: DecisionView
  index: number
  timing: RevealTiming
  showRationale: boolean
  feedItems: FeedItem[]
  turnDeltas: MetricDelta[]
}) {
  const { state } = usePlay()
  const record = state.decisions.find(
    (r) => r.turnIndex === state.turnIndex && r.decisionId === dv.decision.id,
  )
  const chosen = dv.chosen.map((id) => ({
    id,
    letter: letterFor(dv.options.findIndex((o) => o.option.id === id)),
    label: dv.decision.options.find((o) => o.id === id)?.label ?? id,
  }))
  return (
    <Card as="article" aria-labelledby={`resolved-${dv.decision.id}`} className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <span>결정 {index + 1}</span>
        <Badge tone="positive">확정됨</Badge>
        {record?.timedOut && <Badge tone="warning">시간 초과 · 기본 선택</Badge>}
        {record?.hintsUsed ? <Badge tone="neutral">힌트 {record.hintsUsed}단계</Badge> : null}
      </div>
      <h3 id={`resolved-${dv.decision.id}`} className="text-[14px] font-semibold leading-tight">
        {dv.decision.title}
      </h3>
      <ul className="space-y-0.5 text-[13px]">
        {chosen.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span
              className="num inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-accent bg-accent text-[11px] font-semibold text-white"
              aria-hidden="true"
            >
              {c.letter}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      {record?.memo && (
        <p className="rounded border border-border bg-surface-2 px-2 py-1 text-[12px]">
          <span className="text-muted">메모 · </span>
          {record.memo}
        </p>
      )}
      {showRationale ? (
        <RationalePanel dv={dv} feedItems={feedItems} turnDeltas={turnDeltas} />
      ) : (
        <p className="text-[12px] text-muted">
          {timing === 'endOfTurn'
            ? '결정 근거는 이 턴의 결정이 모두 확정되면 공개됩니다.'
            : '결정 근거는 시나리오 종료 후 디브리핑에서 공개됩니다.'}
        </p>
      )}
    </Card>
  )
}

/** Decision zone: `결정 n/m`, unresolved cards, resolved summaries with rationale, and the next-turn control. */
export function DecisionPanel({
  onPreview,
  sticky,
}: {
  onPreview: (p: PreviewState | null) => void
  sticky: boolean
}) {
  const { scenario, state, history, mode, view } = usePlay()
  const next = useGameStore((s) => s.next)
  const lastError = useGameStore((s) => s.lastError)
  const rationaleSetting = useSettingsStore((s) => s.rationaleReveal)
  const [announce, setAnnounce] = useState('')
  const [nextFailed, setNextFailed] = useState(false)

  const timing = rationaleTiming(rationaleSetting, mode)
  const showRationale = timing === 'immediate' || (timing === 'endOfTurn' && view.allResolved)
  const total = view.decisions.length
  const resolvedCount = view.decisions.filter((d) => d.resolved).length
  const turnStart = history[state.turnIndex]
  const turnDeltas = useMemo(
    () => (turnStart ? diffSnapshots(latestSnapshot(turnStart), latestSnapshot(state)) : []),
    [turnStart, state],
  )
  const isLast = state.turnIndex >= scenario.turns.length - 1

  const onNext = () => {
    const ok = next()
    setNextFailed(!ok)
    if (ok) setAnnounce(isLast ? '시나리오가 종료되었습니다' : '다음 턴으로 이동했습니다')
  }

  return (
    <div className="space-y-3 p-3">
      <LiveRegion message={announce} />
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-semibold">
          결정{' '}
          <span className="num">
            {resolvedCount}/{total}
          </span>
        </h2>
        {total > 0 && (
          <Badge tone={view.allResolved ? 'positive' : 'neutral'}>
            {view.allResolved ? '모두 확정' : `${total - resolvedCount}건 대기`}
          </Badge>
        )}
      </div>
      {total === 0 && (
        <p className="text-[12px] text-muted">
          이번 턴에는 내려야 할 결정이 없습니다. 상황을 읽고 다음 턴으로 넘어가 주세요.
        </p>
      )}
      {view.decisions.map((dv, i) =>
        dv.resolved ? (
          <ResolvedDecision
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            timing={timing}
            showRationale={showRationale}
            feedItems={view.feed.filter((f) => f.cause?.decisionId === dv.decision.id)}
            turnDeltas={turnDeltas}
          />
        ) : (
          <DecisionCard
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            onPreview={onPreview}
            onConfirmed={(m) => setAnnounce(m)}
            sticky={sticky}
          />
        ),
      )}
      <div
        className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 ${sticky && view.allResolved ? 'sticky bottom-0 z-10' : ''}`}
      >
        {nextFailed && lastError && (
          <p role="alert" className="w-full text-[12px] text-critical">
            {lastError}
          </p>
        )}
        <span className="text-[12px] text-muted">
          {view.allResolved
            ? isLast
              ? '마지막 턴입니다'
              : '다음 턴으로 넘어갈 수 있습니다'
            : '필수 결정을 모두 확정하면 넘어갈 수 있습니다'}
        </span>
        <Button
          variant="primary"
          className="ml-auto min-h-[44px] sm:min-h-0"
          disabled={!view.allResolved}
          onClick={onNext}
        >
          {isLast ? '시나리오 마무리' : '다음 턴으로'}
        </Button>
      </div>
    </div>
  )
}
