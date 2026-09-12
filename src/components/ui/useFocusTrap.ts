import { useEffect, type RefObject } from 'react'

/**
 * Esc to close, Tab confined to the panel, focus returned to whatever opened it.
 *
 * Extracted from `SideSheet`, which was the only one of the app's four modal surfaces that got
 * all three right. `ConfirmDialog` had Esc and an initial focus but no containment;
 * `InterruptOverlay` and `ShortcutsSheet` had their own partial versions. One hook means a fix
 * lands everywhere at once.
 *
 * Deliberately **not** using a portal or `inert`:
 *  - a portal moves the dialog out of the printed document, and the debrief prints;
 *  - `inert` is not implemented in jsdom, so nothing here could test it.
 * The limitation that follows is real and worth writing down: a screen reader can still reach the
 * background with virtual-cursor navigation. Tab, Esc and focus return are what this guarantees.
 */
const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // `offsetParent === null` also catches `display: none` ancestors, which is what we want and
    // what `:visible` would have meant if CSS had it.
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * `onClose` omitted means Esc does nothing *and is not swallowed* — the shape a forced decision
 * needs (the interrupt overlay must not be dismissable, but it also must not eat the key).
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose?: () => void,
): void {
  // Move focus in on open, put it back on close.
  useEffect(() => {
    if (!open) return
    const restore = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel ? focusablesIn(panel)[0] : undefined
    // The panel itself is the fallback: a dialog with no controls still must not leave focus
    // sitting on a background element the user can no longer see.
    ;(first ?? panel ?? undefined)?.focus?.()
    return () => {
      restore?.focus?.()
    }
  }, [open, panelRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!onClose) return
        // Capture phase + stopPropagation so a nested sheet closes itself, not its parent.
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = focusablesIn(panel)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus?.()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, panelRef])
}
