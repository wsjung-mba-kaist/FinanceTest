import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Small "?" affordance that explains a label, metric or score dimension.
 * Opens on hover and focus, closes on Esc; reachable by keyboard and touch.
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
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full p-0.5 text-muted hover:bg-surface-2 hover:text-text"
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
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
          role="tooltip"
          id={id}
          className={`absolute top-full z-40 mt-1 w-72 max-w-[80vw] rounded-md border border-border bg-surface p-2 text-sm leading-snug text-text shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
          {onOpenMore && (
            <button
              type="button"
              className="mt-1.5 block text-accent"
              onMouseDown={(e) => e.preventDefault()}
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
