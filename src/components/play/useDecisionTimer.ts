import { useEffect, useMemo, useRef, useState } from 'react'
import type { Decision, Mode } from '../../engine'
import { useResponseCountdown } from '../../lib/useResponseCountdown'
import type { DecisionDraft } from './decisionDraft'
import { timerConfig } from './playHelpers'

export interface DecisionTimerConfig {
  limitMs: number
  pausable: boolean
}

/**
 * The response budget of one decision: the countdown, the 30s/10s warnings, and the bookkeeping
 * that lets the player leave a decision and come back to the budget they had left (`burnedMs`)
 * with the time they spent on it so far (`elapsedMs`) — the debrief's «소요 N초».
 *
 * It is a hook of its own because the undo bug lived exactly here: the unmount bookkeeping wrote
 * `burnedMs = limit − remaining` after a timed-out commit, so an undone decision re-mounted with a
 * budget of zero and timed out again. Isolated, the hook can be tested without the dock.
 */
export function useDecisionTimer({
  decision,
  mode,
  timersEnabled,
  due,
  draft,
  onDraft,
  hold,
  onExpired,
}: {
  decision: Decision
  mode: Mode
  timersEnabled: boolean
  /** True once this is the decision actually being asked for (the budget only burns then). */
  due: boolean
  draft: DecisionDraft
  onDraft: (patch: Partial<DecisionDraft>) => void
  /** Pause the budget (help sheet open). */
  hold: boolean
  /** The budget ran out while `due`. */
  onExpired: (timer: DecisionTimerConfig) => void
}) {
  const timer = useMemo(
    () => timerConfig(decision, mode, timersEnabled),
    [decision, mode, timersEnabled],
  )
  const [timerMsg, setTimerMsg] = useState('')
  const startedAt = useRef(Date.now())
  const draftRef = useRef(draft)
  draftRef.current = draft
  const onDraftRef = useRef(onDraft)
  onDraftRef.current = onDraft
  const onExpiredRef = useRef(onExpired)
  onExpiredRef.current = onExpired

  // 남은 예산으로 재개한다 — 다른 결정을 잠깐 보고 왔다고 시간이 되돌아가지도, 사라지지도 않는다.
  const budgetMs = Math.max(0, (timer?.limitMs ?? 0) - draft.burnedMs)
  const { remainingMs, paused, stopped, togglePause, expired } = useResponseCountdown(
    budgetMs,
    Boolean(timer) && due,
    () => {
      if (timer) onExpiredRef.current(timer)
    },
    hold,
  )

  const remainingRef = useRef(remainingMs)
  remainingRef.current = remainingMs
  const timerRef = useRef(timer)
  timerRef.current = timer
  // 이 결정을 떠날 때, 머문 시간과 태운 예산을 초안에 남긴다.
  useEffect(
    () => () => {
      const limit = timerRef.current?.limitMs ?? 0
      onDraftRef.current({
        elapsedMs: draftRef.current.elapsedMs + (Date.now() - startedAt.current),
        burnedMs: limit > 0 ? limit - remainingRef.current : 0,
      })
    },
    [],
  )

  const warned = useRef<{ 30?: boolean; 10?: boolean }>({})
  useEffect(() => {
    if (!timer || !due) return
    const s = Math.ceil(remainingMs / 1000)
    if (s <= 10 && s > 0 && !warned.current[10] && timer.limitMs > 11_000) {
      warned.current[10] = true
      setTimerMsg('남은 시간 10초')
    } else if (s <= 30 && s > 10 && !warned.current[30] && timer.limitMs > 31_000) {
      warned.current[30] = true
      setTimerMsg('남은 시간 30초')
    }
  }, [remainingMs, timer, due])

  /** Time spent on this decision so far, earlier visits included. */
  const elapsedNow = () => draftRef.current.elapsedMs + (Date.now() - startedAt.current)

  return {
    timer,
    remainingMs,
    paused,
    stopped,
    togglePause,
    expired,
    timerMsg,
    setTimerMsg,
    elapsedNow,
  }
}
