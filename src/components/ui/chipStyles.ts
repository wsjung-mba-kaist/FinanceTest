/**
 * Toggle-chip surface, kept out of `index.tsx` so `chipClass` can be imported without dragging a
 * component module into a fast-refresh boundary. Same split as `buttonStyles` and `cardStyles`.
 *
 * One expression of "selected", not three: the catalog filled the chip with `--accent`, the log
 * panel and the regulation reference tinted it with `--accent-soft`, and the demo had a third.
 * `--accent-soft` now means exactly this, and the filled accent stays a *button* treatment.
 */
export type ChipSize = 'sm' | 'md'

const chipBox: Record<ChipSize, string> = {
  sm: 'min-h-tap-dense px-2 py-0.5 text-xs',
  md: 'min-h-tap-compact px-2.5 py-1 text-sm',
}

export function chipClass(opts?: {
  selected?: boolean
  size?: ChipSize
  /** Non-interactive (a step you have not reached yet): no hover, no press. */
  inert?: boolean
  className?: string
}): string {
  const { selected = false, size = 'md', inert = false, className = '' } = opts ?? {}
  const tone = selected
    ? 'border-accent bg-accent-soft font-medium text-text'
    : inert
      ? 'border-border text-muted'
      : 'border-border-control bg-surface text-muted hover:text-text active:bg-surface-2'
  return `inline-flex items-center gap-1 rounded-full border transition-colors ${chipBox[size]} ${tone} ${className}`
}
