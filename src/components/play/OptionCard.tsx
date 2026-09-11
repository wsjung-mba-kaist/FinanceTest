import type { ReactNode } from 'react'
import type { OptionView } from '../../engine'
import { Badge } from '../ui'

/**
 * One selectable option (A–E). Rendered as a radio/checkbox button with roving tabindex.
 * Unavailable options stay focusable (aria-disabled) so the reason can be read.
 */
export function OptionCard({
  ov,
  letter,
  role,
  checked,
  tabIndex,
  buttonRef,
  onSelect,
  onHoverChange,
  onFocusChange,
  children,
}: {
  ov: OptionView
  letter: string
  role: 'radio' | 'checkbox'
  checked: boolean
  tabIndex: number
  buttonRef: (el: HTMLButtonElement | null) => void
  onSelect: () => void
  onHoverChange: (hover: boolean) => void
  onFocusChange: (focused: boolean) => void
  children?: ReactNode
}) {
  const { option, available, reason } = ov
  const descId = `opt-${option.id}-desc`
  return (
    <div
      className={`rounded-md border ${checked ? 'border-accent bg-accent-soft' : 'border-border bg-surface'} ${available ? '' : 'opacity-75'}`}
    >
      <button
        ref={buttonRef}
        type="button"
        role={role}
        aria-checked={checked}
        aria-disabled={available ? undefined : true}
        aria-describedby={descId}
        tabIndex={tabIndex}
        className="flex min-h-[44px] w-full items-start gap-2 rounded-md px-3 py-2 text-left"
        onClick={() => {
          if (available) onSelect()
        }}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
      >
        <span
          className={`num mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-semibold ${checked ? 'border-accent bg-accent text-white' : 'border-border bg-surface-2 text-muted'}`}
          aria-hidden="true"
        >
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-medium">{option.label}</span>
            {option.irreversible && <Badge tone="warning">되돌릴 수 없음</Badge>}
            {option.illegal && <Badge tone="critical">규정 위반 소지</Badge>}
            {!available && <Badge tone="neutral">선택 불가</Badge>}
          </span>
          <span id={descId} className="mt-0.5 block text-[12px] leading-snug text-muted">
            {option.description}
            {!available && reason ? ` — ${reason}` : ''}
          </span>
        </span>
        <span className="mt-0.5 shrink-0 text-[12px] text-muted" aria-hidden="true">
          {role === 'checkbox' ? (checked ? '☑' : '☐') : checked ? '●' : '○'}
        </span>
      </button>
      {children}
    </div>
  )
}
