import { useCallback, type KeyboardEvent } from 'react'

/**
 * APG keyboard behaviour for a tab list, without owning its markup.
 *
 * The play screen has three tab lists and they are genuinely three different shapes: the info
 * column's tabs carry `aria-keyshortcuts` and point at zone ids, the 더보기 sub-row is a 3-of-5
 * slice, and the bottom bar is a navigation strip with badges. Forcing all three through one
 * `<Tabs>` component would need a `variant` prop per caller and would make the primitive worse.
 *
 * What they *do* share — and all three were missing — is the keyboard contract: arrows move
 * between tabs, Home/End jump to the ends, and the list is **one** tab stop rather than one per
 * tab. Without roving `tabIndex`, reaching the panel behind a five-tab bar costs five presses of
 * Tab, and the arrow keys a screen-reader user reaches for first do nothing at all.
 *
 * So the behaviour is shared and the markup is not. Callers spread `tabIndex` themselves via
 * `isActive`, which is the one line they each already have.
 */
export function useTabListKeys<T>(
  ids: readonly T[],
  value: T,
  onChange: (id: T) => void,
  opts?: {
    /** Focus the newly selected tab after React commits. Needs the DOM id of each tab. */
    idFor?: (id: T) => string
  },
): (e: KeyboardEvent) => void {
  const idFor = opts?.idFor
  return useCallback(
    (e: KeyboardEvent) => {
      const i = ids.indexOf(value)
      if (i < 0) return
      let next: T | undefined
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = ids[(i + 1) % ids.length]
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = ids[(i - 1 + ids.length) % ids.length]
      else if (e.key === 'Home') next = ids[0]
      else if (e.key === 'End') next = ids[ids.length - 1]
      if (next === undefined) return
      e.preventDefault()
      onChange(next)
      // Selection follows focus (APG automatic activation), so focus goes with it. The node does
      // not exist until React commits, hence the deferral.
      const domId = idFor?.(next)
      if (domId)
        requestAnimationFrame(() => document.getElementById(domId)?.focus({ preventScroll: true }))
    },
    [ids, value, onChange, idFor],
  )
}
