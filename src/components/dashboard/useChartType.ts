import { useEffect, useState } from 'react'

/**
 * Chart label sizes that follow the reader's type scale.
 *
 * Recharts takes numbers, not CSS, so every axis tick in this app carried a literal `fontSize: 10`
 * — which meant a reader on 1.3× type scale got everything larger *except* the charts, and the
 * axis labels they were already squinting at stayed at 10px. These are the same steps expressed
 * against the resolved root size, with a floor so the smallest tick never becomes unreadable in
 * the other direction either.
 *
 * Read once per mount and on resize: `--fs-root` only changes at a breakpoint or when the user
 * changes the setting, and the setting writes `--fs-scale` on `<html>`, which a resize does not
 * catch — so the returned object is also keyed to the scale attribute via the same listener.
 */
export interface ChartType {
  /** Axis ticks, the smallest label on a chart. */
  tick: number
  /** Legends and axis titles. */
  label: number
}

const BASE = 16
const MIN_TICK = 10

function rootPx(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return BASE
  const raw = window.getComputedStyle(document.documentElement).fontSize
  const px = Number.parseFloat(raw)
  return Number.isFinite(px) && px > 0 ? px : BASE
}

function compute(): ChartType {
  const px = rootPx()
  return {
    // 10/12 at the 14px base, scaling from there and never below the floor.
    tick: Math.max(MIN_TICK, Math.round((px * 10) / 14)),
    label: Math.max(MIN_TICK + 1, Math.round((px * 12) / 14)),
  }
}

export function useChartType(): ChartType {
  const [value, setValue] = useState<ChartType>(compute)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setValue(compute())
    update()
    window.addEventListener('resize', update)
    // The 글자 크기 setting writes `--fs-scale` onto <html>; no resize fires for that.
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [])
  return value
}
