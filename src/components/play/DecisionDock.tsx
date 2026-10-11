import { useEffect, useMemo, useState } from 'react'
import { buildConditionContext, diffSnapshots, evaluate, latestSnapshot } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Badge } from '../ui'
import { ConsequenceReel } from './ConsequenceReel'
import { DecisionBlock } from './DecisionBlock'
import { EMPTY_DRAFT, type DecisionDraft } from './decisionDraft'
import { PendingRow, ResolvedRow, UpcomingRow, type ReelBinding } from './DockRows'
import { usePlay } from './playContext'
import { rationaleTiming, type PreviewState } from './playHelpers'

export { DockActionBar } from './DockRows'
export type { DecisionDraft } from './decisionDraft'
export type { ReelBinding } from './DockRows'

/**
 * The permanently docked decision column: 지금 요청받은 것 → options → 확정(1클릭) → 결과 릴 →
 * 다음 턴. The reel is whatever `state.lastReel` the engine produced last (a decision, an answered
 * interrupt or a tick), played once per `lastReel.id`.
 */
export function DecisionDock({
  sticky,
  onPreview,
  onCommitted,
  skipSignal,
}: {
  sticky: boolean
  onPreview: (p: PreviewState | null) => void
  onCommitted: (message: string) => void
  skipSignal: number
}) {
  const { scenario, state, history, mode, view } = usePlay()
  const playedReelId = useGameStore((s) => s.playedReelId)
  const markReelPlayed = useGameStore((s) => s.markReelPlayed)
  const rationaleSetting = useSettingsStore((s) => s.rationaleReveal)

  const timing = rationaleTiming(rationaleSetting, mode)
  const showRationale = timing === 'immediate' || (timing === 'endOfTurn' && view.allResolved)
  const total = view.decisions.length
  const resolvedCount = view.decisions.filter((d) => d.resolved).length
  const turnStart = history[state.turnIndex]
  const turnDeltas = useMemo(
    () => (turnStart ? diffSnapshots(latestSnapshot(turnStart), latestSnapshot(state)) : []),
    [turnStart, state],
  )
  const firstUnresolved = view.decisions.find((d) => !d.resolved)?.decision.id

  /**
   * One unresolved decision is expanded at a time.
   *
   * Every pending decision used to be open at once: the dock opened at 740px of content on a turn
   * with three decisions, the 확정 bar of the first was already below the fold, and the reader had
   * to decide which of three half-read questions to answer first. Opening one — whichever the
   * player picks, defaulting to the first that is due — halves the first paint and makes "there is
   * exactly one primary action on screen" true by construction.
   */
  const [openId, setOpenId] = useState<string | undefined>()

  /**
   * 결정별 초안은 독이 들고 있는다 — `DecisionBlock` 이 결정마다 새로 마운트되기 때문이다.
   * 턴이 넘어가면 비운다: 다음 턴의 결정은 다른 질문이고, 남은 초안은 남의 답이다.
   */
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({})
  useEffect(() => setDrafts({}), [state.turnIndex])
  const draftOf = (id: string) => drafts[id] ?? EMPTY_DRAFT
  const patchDraft = (id: string, patch: Partial<DecisionDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY_DRAFT), ...patch } }))

  const openDecisionId =
    openId && view.decisions.some((d) => !d.resolved && d.decision.id === openId)
      ? openId
      : firstUnresolved

  // Decisions the turn authors but has not opened yet (`availableFrom` beyond the current tick).
  const upcoming = useMemo(() => {
    if (view.ticks <= 1) return []
    const ctx = buildConditionContext(state)
    return view.turn.decisions.filter(
      (d) => (d.availableFrom ?? 0) > state.tick && evaluate(d.when, ctx),
    )
  }, [view.turn, view.ticks, state])

  const reel: ReelBinding | undefined = useMemo(() => {
    const last = state.lastReel
    if (!last || last.steps.length === 0) return undefined
    // A turn-start reel repeats what the situation panel already shows: never played as a reel.
    if (last.cause.kind === 'turn') return undefined
    return {
      id: last.id,
      steps: last.steps,
      played: last.id === playedReelId,
      decisionId: last.cause.decisionId,
    }
  }, [state.lastReel, playedReelId])
  const onReelDone = () => {
    if (reel && !reel.played) markReelPlayed(reel.id)
  }
  const resolvedIds = new Set(view.decisions.filter((d) => d.resolved).map((d) => d.decision.id))
  // A reel caused by a tick or an answered interrupt has no resolved row to live under.
  const standaloneReel =
    reel && (reel.decisionId === undefined || !resolvedIds.has(reel.decisionId)) ? reel : undefined

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-md font-semibold">지금 요청받은 것</h2>
        {total > 0 && (
          <>
            <span className="num text-base text-muted">
              결정 {resolvedCount}/{total}
            </span>
            <Badge tone={view.allResolved ? 'positive' : 'neutral'}>
              {view.allResolved ? '모두 확정' : `${total - resolvedCount}건 대기`}
            </Badge>
          </>
        )}
      </div>
      {standaloneReel && (
        <ConsequenceReel
          key={standaloneReel.id}
          steps={standaloneReel.steps}
          units={scenario.units}
          skipSignal={skipSignal}
          immediate={standaloneReel.played}
          onDone={onReelDone}
        />
      )}
      {total === 0 && upcoming.length === 0 && (
        <p className="rounded-lg bg-surface-2 p-3 text-base text-muted">
          이번 턴에는 내려야 할 결정이 없습니다. 상황을 읽고 다음 턴으로 넘어가 주세요.
        </p>
      )}
      {view.decisions.map((dv, i) =>
        dv.resolved ? (
          <ResolvedRow
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            timing={timing}
            showRationale={showRationale}
            feedItems={view.feed.filter((f) => f.cause?.decisionId === dv.decision.id)}
            turnDeltas={turnDeltas}
            reel={reel?.decisionId === dv.decision.id ? reel : undefined}
            skipSignal={skipSignal}
            onReelDone={onReelDone}
          />
        ) : dv.decision.id === openDecisionId ? (
          <DecisionBlock
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            total={total}
            due={
              dv.decision.id === firstUnresolved &&
              (dv.decision.deadlineTick === undefined || state.tick >= dv.decision.deadlineTick)
            }
            sticky={sticky}
            onPreview={onPreview}
            onCommitted={onCommitted}
            draft={draftOf(dv.decision.id)}
            onDraft={(patch) => patchDraft(dv.decision.id, patch)}
          />
        ) : (
          <PendingRow
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            onOpen={() => setOpenId(dv.decision.id)}
          />
        ),
      )}
      {upcoming.map((d) => (
        <UpcomingRow key={`${state.turnIndex}:${d.id}`} decision={d} tick={state.tick} />
      ))}
    </div>
  )
}
