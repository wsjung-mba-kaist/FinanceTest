import { useEffect, type RefObject } from 'react'

export type DismissReason = 'outside' | 'escape'

/**
 * Closes a popup on a click outside `ref` or on Escape. Three components carried this effect by
 * hand (two menus and the citation chip), each wiring and unwiring the same two listeners.
 * `onClose` receives why, so a caller can return focus to its trigger on Escape and leave it
 * where the user clicked otherwise.
 */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: (reason: DismissReason) => void,
): void {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('escape')
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}
