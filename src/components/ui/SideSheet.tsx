import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Desktop slide-over / mobile bottom sheet with Esc, focus containment and
 * focus return. Shared by the help sheet and the in-play advisor.
 */
export function SideSheet({
  open,
  title,
  onClose,
  mobile,
  width = 460,
  children,
  footer,
  labelledBy,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  mobile: boolean
  width?: number
  children: ReactNode
  footer?: ReactNode
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const autoId = useId()
  const titleId = labelledBy ?? `sheet-${autoId}`

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
    return () => {
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const panelClass = mobile
    ? 'fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t'
    : 'fixed right-0 top-12 bottom-0 border-l'

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
        aria-hidden="true"
        data-noprint
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${panelClass} z-50 flex flex-col border-border bg-surface shadow-xl`}
        style={mobile ? undefined : { width }}
        data-noprint
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h2 id={titleId} className="text-md font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
          >
            <Icon name="x" label="닫기" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-border px-3 py-2">{footer}</div>}
      </div>
    </>
  )
}
