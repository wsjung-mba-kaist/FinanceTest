import { useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useFocusTrap } from './useFocusTrap'

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
  const autoId = useId()
  const titleId = labelledBy ?? `sheet-${autoId}`

  useFocusTrap(open, panelRef, onClose)

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
            className="ml-auto inline-flex min-h-tap-compact min-w-tap-compact items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
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
