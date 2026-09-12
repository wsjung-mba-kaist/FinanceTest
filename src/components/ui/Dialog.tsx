import { useRef, type ReactNode } from 'react'
import { Card } from './index'
import { useFocusTrap } from './useFocusTrap'

/**
 * The modal shell: backdrop, centred panel, focus trap, Esc.
 *
 * Three copies of this existed — the confirm dialog, the shortcuts sheet and the interrupt
 * overlay — and each had drifted. `SideSheet` was the only one that got focus containment and
 * focus return right; the others had Esc and an initial focus, or neither. `useFocusTrap` already
 * unified the behaviour; this unifies the markup that carries it, so a `z-index`, a backdrop tint
 * or a `data-noprint` is decided once.
 *
 * **Not a portal.** The debrief prints, and a portal moves the dialog out of the printed document.
 * The limitation that follows is real and stated in `useFocusTrap`: a screen reader's virtual
 * cursor can still reach the background. Tab, Esc and focus return are what this guarantees.
 */
export function Dialog({
  open,
  role = 'dialog',
  labelledBy,
  describedBy,
  onClose,
  onDismiss,
  size = 'md',
  align = 'center',
  className = '',
  children,
}: {
  open: boolean
  /** `alertdialog` for a decision that cannot be dismissed — the interrupt overlay. */
  role?: 'dialog' | 'alertdialog'
  labelledBy: string
  describedBy?: string
  /**
   * Esc handler. Omit it for a forced decision: Esc then neither dismisses the dialog nor is
   * swallowed on its way to anything else listening.
   */
  onClose?: () => void
  /** Clicking the backdrop. Omit to make the backdrop inert. */
  onDismiss?: () => void
  size?: 'md' | 'lg'
  /** Mobile sheets sit at the bottom edge; everything else is centred. */
  align?: 'center' | 'bottom-on-mobile'
  className?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(open, panelRef, onClose)
  if (!open) return null

  const box = size === 'lg' ? 'max-w-xl' : 'max-w-md'
  const place = align === 'bottom-on-mobile' ? 'items-end sm:items-center' : 'items-center'

  return (
    <div
      className={`fixed inset-0 z-50 flex ${place} justify-center bg-black/40 p-3 sm:p-4`}
      onClick={onDismiss}
      data-noprint
    >
      <Card
        as="div"
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        tier="key"
        className={`max-h-[92dvh] w-full overflow-y-auto p-4 shadow-xl ${box} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Card>
    </div>
  )
}
