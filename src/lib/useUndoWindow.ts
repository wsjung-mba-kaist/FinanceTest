import { useEffect, useState } from 'react'
import type { UndoableChoice } from '../store/gameStore'

export interface UndoWindow {
  active: boolean
  remainingMs: number
  secondsLeft: number
  totalMs: number
}

const CLOSED: UndoWindow = { active: false, remainingMs: 0, secondsLeft: 0, totalMs: 0 }

/**
 * Countdown for the 실행 취소 toast. The window length (5s, 8s for an `irreversible`
 * option) is decided by the store when the decision is committed; this hook only ticks
 * it down and calls `onExpire` once.
 */
export function useUndoWindow(
  undoable: UndoableChoice | undefined,
  onExpire: () => void,
  totalMs = 5_000,
): UndoWindow {
  const until = undoable?.until ?? 0
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!until) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [until])

  const remainingMs = until ? Math.max(0, until - now) : 0

  useEffect(() => {
    if (!until || remainingMs > 0) return
    onExpire()
    // onExpire is called once per window; it is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until, remainingMs > 0])

  if (!undoable || remainingMs <= 0) return CLOSED
  return {
    active: true,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    totalMs: Math.max(totalMs, remainingMs),
  }
}
