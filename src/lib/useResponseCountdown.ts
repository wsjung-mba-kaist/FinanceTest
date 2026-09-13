import { useEffect, useRef, useState } from 'react'

/** Wall-clock response budget, independent of the simulated scenario clock. */
export function useResponseCountdown(
  limitMs: number,
  enabled: boolean,
  onExpire: () => void,
  held = false,
) {
  const [remainingMs, setRemaining] = useState(limitMs)
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const fired = useRef(false)
  const expire = useRef(onExpire)
  expire.current = onExpire
  useEffect(() => {
    const changed = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  useEffect(() => {
    setRemaining(limitMs)
    fired.current = false
  }, [limitMs])
  const stopped = paused || hidden || held
  useEffect(() => {
    if (!enabled || stopped) return
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const dt = now - last
      last = now
      // Check visibility here too: no background time is charged before React commits the hold.
      if (!document.hidden) setRemaining((prev) => Math.max(0, prev - dt))
    }, 250)
    return () => window.clearInterval(id)
  }, [enabled, stopped, limitMs])
  useEffect(() => {
    if (enabled && !stopped && remainingMs <= 0 && !fired.current) {
      fired.current = true
      expire.current()
    }
  }, [enabled, stopped, remainingMs])
  return {
    remainingMs,
    paused,
    stopped,
    togglePause: () => setPaused((p) => !p),
    expired: enabled && remainingMs <= 0,
  }
}
