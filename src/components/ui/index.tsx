import { forwardRef, useEffect, useId, useState, type ReactNode } from 'react'
import {
  BUTTON_BASE,
  buttonSize,
  buttonVariant,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles'
import { tierClass, type CardTier } from './cardStyles'
import { chipClass, type ChipSize } from './chipStyles'
import { Dialog } from './Dialog'
import { useTabListKeys } from './useTabListKeys'

export type { ButtonSize, ButtonVariant }
export type { CardTier }
export type { ChipSize }
export { Num } from './Num'
export { DataTable, type Column } from './DataTable'

export type Tone = 'info' | 'warning' | 'critical' | 'positive' | 'neutral' | 'none'

type ButtonOwnProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * Render as an anchor instead. Look and meaning are separate choices: a link that should read as
   * a button is `<Button as="a" href>`, and a button that should read as a link is
   * `variant="link"`. Swapping the *element* to get the look is what breaks `toBeDisabled()` and
   * keyboard semantics — see docs/ui-conventions.md §9.
   */
  as?: 'button' | 'a'
}

// Based on `HTMLAttributes<HTMLElement>` rather than the button/anchor attribute types, because
// those two disagree about the element type of every event handler and their intersection is
// uninhabited. The handful of attributes that actually differ are listed explicitly.
type ButtonProps = ButtonOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    href?: string
    target?: string
    rel?: string
    download?: boolean | string
    name?: string
    value?: string | number
    form?: string
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'secondary', size = 'md', as = 'button', className = '', ...rest },
  ref,
) {
  const s = variant === 'link' ? 'text-inherit' : buttonSize[size]
  const cls = `${BUTTON_BASE} ${buttonVariant[variant]} ${s} ${className}`
  if (as === 'a') {
    const { type: _t, disabled: _d, name: _n, value: _v, form: _f, ...anchorRest } = rest
    return (
      <a ref={ref as unknown as React.Ref<HTMLAnchorElement>} className={cls} {...anchorRest}>
        {children}
      </a>
    )
  }
  const { href: _h, target: _tg, rel: _r, download: _dl, type, ...buttonRest } = rest
  return (
    <button ref={ref} type={type ?? 'button'} className={cls} {...buttonRest}>
      {children}
    </button>
  )
})

/**
 * A toggle chip: one expression of "selected", not three.
 *
 * The app had `bg-accent text-accent-fg` in the catalog, `bg-accent-soft text-text` in the log
 * panel and the regulation reference, and a third in the demo — so "chosen" looked like a
 * different state depending on which screen you were on. `--accent-soft` is now reserved for
 * exactly this meaning, and the filled accent stays a *button* treatment.
 *
 * `aria-pressed` is the caller's to pass and is never rewritten here.
 */
export const Chip = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; size?: ChipSize }
>(function Chip({ selected, size = 'md', className = '', children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={chipClass({ selected, size, className })} {...rest}>
      {children}
    </button>
  )
})

const toneClass: Record<Tone, string> = {
  info: 'bg-info-bg text-info border-info-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  critical: 'bg-critical-bg text-critical border-critical-border',
  positive: 'bg-positive-bg text-positive border-positive-border',
  neutral: 'bg-surface-2 text-muted border-border',
  // 'none' is not 'neutral': neutral is "no particular tone", none is the *stated* fact that this
  // metric has no warning/breach band at all. They read differently and are coloured differently.
  none: 'bg-sev-none-bg text-sev-none border-sev-none-border',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
  ...rest
}: {
  tone?: Tone
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-none ${toneClass[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}

/**
 * The small accent-filled count beside a label — unread wire items, pending decisions, help hints.
 *
 * Four copies of `rounded-full bg-accent px-1.5 text-xs text-accent-fg` had drifted apart: one
 * carried `font-semibold`, one `ml-0.5`, one `ml-1`, one neither. They are the same thing, so the
 * margin belongs to the caller and the pill belongs here.
 *
 * `label` is what a screen reader hears — "12" alone says nothing about what there are twelve of.
 */
export function CountPill({
  count,
  label,
  className = '',
}: {
  count: number
  label: string
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      className={`num inline-flex min-w-[1.5em] justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg ${className}`}
      aria-label={`${label} ${count}건`}
    >
      {count}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'ok' | 'warn' | 'breach' | 'na' }) {
  if (status === 'ok') return <Badge tone="positive">● 정상</Badge>
  if (status === 'warn') return <Badge tone="warning">⚠ 경고</Badge>
  if (status === 'breach') return <Badge tone="critical">■ 위험</Badge>
  // `none`, not `neutral` — see the note on `toneClass`. 'no threshold defined' is a stated fact
  // about the metric, and `NoThresholdChip` has always rendered the same words in that tone; the
  // two disagreeing meant the same sentence changed colour depending on which surface said it.
  return (
    <Badge tone="none" title="이 지표에는 경고·위험 구간이 정의되어 있지 않습니다">
      기준 없음
    </Badge>
  )
}

type CardProps = {
  children: ReactNode
  className?: string
  /**
   * `li` matters more than it looks: a card inside a list *is* a list item, and the four
   * hand-rolled `<li>` cards in the debrief were getting no `break-inside: avoid` on paper —
   * the print rule targets `[data-card]`, `section` and `table`, and an `<li>` is none of those.
   * Lessons and mistakes were splitting across page breaks because of it.
   */
  as?: 'section' | 'div' | 'article' | 'li' | 'nav'
  tier?: CardTier
} & React.HTMLAttributes<HTMLElement>

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { children, className = '', as: Tag = 'section', tier = 'base', ...rest },
  ref,
) {
  return (
    // `data-card` is what the print stylesheet targets for `break-inside: avoid`.
    <Tag
      ref={ref as React.Ref<never>}
      data-card={tier}
      className={`${tierClass[tier]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
})

/**
 * APG tabs: one tab stop for the whole list, arrows to move between tabs.
 *
 * Without roving `tabIndex` every tab is its own tab stop, so reaching the panel behind a
 * five-tab bar costs five presses of Tab and the arrow keys — which is what a screen-reader user
 * will actually reach for — do nothing at all.
 *
 * `idFor` lets a caller wire `aria-controls`/`aria-labelledby` to its panels. Callers that do not
 * pass it get no wiring rather than dangling ids, which is the safer default: `aria-controls`
 * pointing at a missing element is worse than its absence.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idFor,
}: {
  tabs: { id: T; label: ReactNode; badge?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  idFor?: (id: T) => { tab: string; panel: string }
}) {
  const onKeyDown = useTabListKeys(
    tabs.map((t) => t.id),
    value,
    onChange,
    { idFor: idFor ? (id) => idFor(id).tab : undefined },
  )
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex border-b border-border"
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const selected = value === t.id
        const ids = idFor?.(t.id)
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={ids?.tab}
            aria-controls={ids?.panel}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`min-h-tap-min px-3 py-2 text-base border-b-2 -mb-px ${selected ? 'border-accent text-text font-medium' : 'border-transparent text-muted hover:text-text'}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.badge != null && <span className="ml-1">{t.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive,
  typeToConfirm,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  typeToConfirm?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const titleId = useId()
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  const ok = !typeToConfirm || typed === typeToConfirm
  return (
    <Dialog open={open} labelledBy={titleId} onClose={onCancel} onDismiss={onCancel}>
      <h2 id={titleId} className="text-md font-semibold mb-2">
        {title}
      </h2>
      <div className="text-base text-muted mb-3">{body}</div>
      {typeToConfirm && (
        <label className="block text-sm mb-3">
          계속하려면 <code className="font-mono">{typeToConfirm}</code> 을(를) 입력하세요
          <input
            className="mt-1 w-full rounded-sm border border-border-control bg-bg px-2 py-1"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} disabled={!ok} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

/** Polite live region for announcements. */
export function LiveRegion({
  message,
  assertive,
  seq,
}: {
  message: string
  assertive?: boolean
  /**
   * Bump this to re-announce the same string. A screen reader speaks a live region when its text
   * *changes*, so two identical messages in a row are heard once — `key` forces a fresh node.
   * See `useAnnouncer`.
   */
  seq?: number
}) {
  return (
    <div
      key={seq}
      className="sr-only"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </div>
  )
}

/**
 * A search box whose focus ring lives on the border wrapper.
 *
 * Both search inputs in the app carried `outline-none` to stop a ring appearing *inside* the
 * bordered box — which removed the only visible focus indicator on them (WCAG 2.4.7). The fix is
 * not to put the outline back on the input but to move it out one level: `focus-within` on the
 * wrapper rings the whole control, which is what the user perceives as "the search box" anyway.
 */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; icon?: ReactNode }
>(function SearchField({ label, icon, className = '', ...rest }, ref) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-1.5 rounded-md border border-border-control bg-bg px-2 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        {icon}
        <input
          ref={ref}
          type="search"
          aria-label={label}
          className={`w-full bg-transparent text-base outline-none ${className}`}
          {...rest}
        />
      </span>
    </label>
  )
})

/**
 * `headingLevel` exists because an empty state is sometimes the *only* thing on a screen. When it
 * is, its title is that screen's heading and rendering it as a styled `<div>` leaves the page with
 * no heading at all. Callers that sit inside a populated page leave it unset and get a `<div>`,
 * which is the right thing there — a heading for an aside would fragment the page outline.
 */
export function EmptyState({
  title,
  headingLevel,
  children,
}: {
  title: string
  headingLevel?: 1 | 2 | 3
  children?: ReactNode
}) {
  const Heading = headingLevel ? (`h${headingLevel}` as 'h1' | 'h2' | 'h3') : 'div'
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
      <Heading className="text-md font-medium text-text">{title}</Heading>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  )
}
