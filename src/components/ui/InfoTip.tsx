import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Small "?" affordance that explains a label, metric or score dimension.
 * Opens on hover and focus, closes on Esc; reachable by keyboard and touch.
 *
 * Two shapes, because a tooltip and a disclosure are not the same control:
 *  - no `onOpenMore` ⇒ a real `role="tooltip"`, described by `aria-describedby`. A tooltip holds
 *    text and nothing else, which is exactly what it holds here.
 *  - with `onOpenMore` ⇒ a **disclosure** (`aria-expanded`). A tooltip that contains a button is
 *    a contradiction: it dismisses itself on blur, so the button inside it can never be reached
 *    by keyboard. That is what the `onMouseDown` preventDefault was papering over — it kept the
 *    panel alive for a *mouse* click and left keyboard users with a button they could see and
 *    never press.
 */
export function InfoTip({
  children,
  label = '설명 보기',
  align = 'left',
  size = 14,
  onOpenMore,
  moreLabel,
}: {
  children: ReactNode
  label?: string
  align?: 'left' | 'right'
  size?: number
  /** Optional "자세히" action (e.g. open the metric explain sheet). */
  onOpenMore?: () => void
  moreLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const disclosure = Boolean(onOpenMore)
  // A disclosure stays open until it is dismissed; a tooltip follows hover and focus.
  const hoverProps = disclosure
    ? {}
    : {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
      }
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex min-h-tap-dense min-w-tap-dense items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
        aria-describedby={!disclosure && open ? id : undefined}
        aria-expanded={disclosure ? open : undefined}
        aria-controls={disclosure ? id : undefined}
        aria-label={label}
        {...hoverProps}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        <Icon name="help" size={size} />
      </button>
      {open && (
        <span
          role={disclosure ? undefined : 'tooltip'}
          id={id}
          className={`absolute top-full z-40 mt-1 w-72 max-w-[80vw] rounded-md border border-border bg-surface p-2 text-sm leading-snug text-text shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          {children}
          {onOpenMore && (
            <button
              type="button"
              className="mt-1.5 inline-flex min-h-tap-dense items-center text-accent"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onOpenMore()
              }}
            >
              {moreLabel ?? '자세히'} →
            </button>
          )}
        </span>
      )}
    </span>
  )
}
