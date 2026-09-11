import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type Tone = 'info' | 'warning' | 'critical' | 'positive' | 'neutral'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'secondary', size = 'md', className = '', ...rest },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-1 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const v = {
    primary: 'bg-accent text-accent-fg border-accent hover:opacity-90',
    secondary: 'bg-surface text-text border-border hover:bg-surface-2',
    ghost: 'bg-transparent text-text border-transparent hover:bg-surface-2',
    danger: 'bg-critical-bg text-critical border-critical/40 hover:opacity-90',
  }[variant]
  const s = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-1.5 text-base',
    lg: 'px-4 py-2.5 text-md',
  }[size]
  return (
    <button ref={ref} className={`${base} ${v} ${s} ${className}`} {...rest}>
      {children}
    </button>
  )
})

const toneClass: Record<Tone, string> = {
  info: 'bg-info-bg text-info border-info/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  critical: 'bg-critical-bg text-critical border-critical/30',
  positive: 'bg-positive-bg text-positive border-positive/30',
  neutral: 'bg-surface-2 text-muted border-border',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'ok' | 'warn' | 'breach' | 'na' }) {
  if (status === 'ok') return <Badge tone="positive">● 정상</Badge>
  if (status === 'warn') return <Badge tone="warning">⚠ 경고</Badge>
  if (status === 'breach') return <Badge tone="critical">■ 위험</Badge>
  return <Badge tone="neutral">기준 없음</Badge>
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-lg border border-border bg-surface ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { id: T; label: ReactNode; badge?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`px-3 py-2 text-base border-b-2 -mb-px ${value === t.id ? 'border-accent text-text font-medium' : 'border-transparent text-muted hover:text-text'}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge != null && <span className="ml-1">{t.badge}</span>}
        </button>
      ))}
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
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) {
      setTyped('')
      first.current?.focus()
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  const ok = !typeToConfirm || typed === typeToConfirm
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-md font-semibold mb-2">
          {title}
        </h2>
        <div className="text-base text-muted mb-3">{body}</div>
        {typeToConfirm && (
          <label className="block text-sm mb-3">
            계속하려면 <code className="font-mono">{typeToConfirm}</code> 을(를) 입력하세요
            <input
              className="mt-1 w-full rounded border border-border bg-bg px-2 py-1"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button ref={first} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} disabled={!ok} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Polite live region for announcements. */
export function LiveRegion({ message, assertive }: { message: string; assertive?: boolean }) {
  return (
    <div className="sr-only" aria-live={assertive ? 'assertive' : 'polite'} aria-atomic="true">
      {message}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
      <div className="font-medium text-text">{title}</div>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  )
}
