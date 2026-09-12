import type { ReactNode } from 'react'
import type { KpiSpec, OptionView } from '../../engine'
import { splitOptionLabel } from '../../lib/text'
import { Badge } from '../ui'
import { Icon } from '../ui/Icon'
import { optionEffectLine } from './playHelpers'

/**
 * One selectable option: letter, ≤40-character title, a single 핵심 효과 line and its tags.
 * Details (설명 · 영향 미리보기 · 실행 가능성) expand **inside** the row, so choosing an option
 * never makes the list move under the pointer — the hover-injected preview is gone.
 */
export function OptionRow({
  ov,
  letter,
  kpis,
  role,
  checked,
  tabIndex,
  buttonRef,
  expanded,
  onSelect,
  onToggleExpand,
  onFocusChange,
  risk,
  children,
}: {
  ov: OptionView
  letter: string
  kpis: KpiSpec[]
  role: 'radio' | 'checkbox'
  checked: boolean
  tabIndex: number
  buttonRef: (el: HTMLButtonElement | null) => void
  expanded: boolean
  onSelect: () => void
  onToggleExpand: () => void
  onFocusChange: (focused: boolean) => void
  /** Shown on the row itself, never behind the disclosure: this option can end the scenario. */
  risk?: string
  /** Expanded detail block (description, ImpactPreview, feasibility). */
  children?: ReactNode
}) {
  const { option, available, reason } = ov
  const descId = `opt-${option.id}-effect`
  const { title } = splitOptionLabel(option.label)
  const effect = optionEffectLine(option, kpis)
  return (
    <div
      className={`rounded-md border ${checked ? 'border-accent bg-accent-soft' : 'border-border-control bg-surface'} ${available ? '' : 'opacity-80'}`}
    >
      <button
        ref={buttonRef}
        type="button"
        role={role}
        aria-checked={checked}
        aria-disabled={available ? undefined : true}
        aria-describedby={descId}
        tabIndex={tabIndex}
        className="flex min-h-tap-min w-full items-start gap-2 rounded-md px-3 py-2 text-left"
        onClick={() => {
          if (available) onSelect()
        }}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
      >
        <span
          className={`num mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-sm font-semibold ${checked ? 'border-accent bg-accent text-accent-fg' : 'border-border-control bg-surface-2 text-muted'}`}
          aria-hidden="true"
        >
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-semibold">{title}</span>
            {option.irreversible && <Badge tone="warning">되돌릴 수 없음</Badge>}
            {option.illegal && <Badge tone="critical">규정 위반 소지</Badge>}
            {!available && <Badge tone="neutral">선택 불가</Badge>}
          </span>
          <span id={descId} className="mt-0.5 block text-base leading-snug text-muted">
            {effect}
            {!available && reason ? ` — ${reason}` : ''}
          </span>
          {/*
            The most dangerous thing the product can tell you — "this choice can end the run" —
            used to live inside the 자세히 disclosure, one click away, next to the impact preview.
            It belongs on the row, where the choice is made.
          */}
          {risk && (
            <span className="mt-1 flex items-start gap-1 text-sm font-medium text-critical">
              <Icon name="alert" size={14} />
              {risk}
            </span>
          )}
        </span>
        <span className="mt-1 shrink-0 text-muted" aria-hidden="true">
          {role === 'checkbox' ? (checked ? '☑' : '☐') : checked ? '●' : '○'}
        </span>
      </button>
      <div className="flex items-center px-3 pb-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`opt-${option.id}-detail`}
          className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
          onClick={onToggleExpand}
        >
          {expanded ? '접기' : '자세히'}
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
      </div>
      {expanded && (
        <div id={`opt-${option.id}-detail`} className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}
