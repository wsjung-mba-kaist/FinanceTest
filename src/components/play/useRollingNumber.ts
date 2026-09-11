import { useEffect, useRef, useState } from 'react'

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Rolls a figure from its previous value to `target` over `durationMs`.
 * Returns `target` immediately when disabled (reduced motion) or when rAF is unavailable,
 * so the number is always readable and never gets stuck mid-roll.
 */
export function useRollingNumber(
  target: number,
  opts: { durationMs?: number; enabled?: boolean } = {},
): number {
  const { durationMs = 600, enabled = true } = opts
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (!enabled || typeof requestAnimationFrame !== 'function' || from === target) {
      fromRef.current = target
      setValue(target)
      return
    }
    let raf = 0
    const start = Date.now()
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs)
      setValue(from + (target - from) * easeOut(t))
      if (t < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = target
    }
  }, [target, durationMs, enabled])

  return value
}
