import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react'

const ITEMS = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]'

/**
 * APG keyboard behaviour for a `role="menu"` popup, without owning its markup.
 *
 * `role="menu"` is a contract: ↑/↓ move between items, Home/End jump to the ends, Escape closes,
 * and focus lands on the first item when the menu opens. Two menus on the play screen carried the
 * role and none of the behaviour — their items were reachable by Tab only, which is what the role
 * tells a screen reader *not* to expect. Same shape as `useTabListKeys`: callers keep their markup
 * and spread `onKeyDown` on the menu element.
 */
export function useMenuKeys(
  menuRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): (e: KeyboardEvent) => void {
  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLElement>(ITEMS)
    first?.focus()
  }, [open, menuRef])

  return useCallback(
    (e: KeyboardEvent) => {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
      if (items.length === 0) return
      const i = items.findIndex((el) => el === document.activeElement)
      let next: HTMLElement | undefined
      if (e.key === 'ArrowDown') next = items[(i + 1) % items.length]
      else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length]
      else if (e.key === 'Home') next = items[0]
      else if (e.key === 'End') next = items[items.length - 1]
      else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (!next) return
      e.preventDefault()
      next.focus()
    },
    [menuRef, onClose],
  )
}
