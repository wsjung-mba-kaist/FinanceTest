/**
 * Button visuals, kept out of `index.tsx` so `buttonClass` can be imported without dragging a
 * component module into a fast-refresh boundary.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Disabled is painted with tokens, not `opacity-50`: a translucent button composites against
// whatever is behind it, so the same rule measured 1.50:1 on one surface and passed on another.
export const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg disabled:border-border disabled:shadow-none'

export const buttonVariant: Record<ButtonVariant, string> = {
  // `active:` on every variant. The app had five `active:` rules in 15k lines, which is most of
  // why pressing things felt like nothing happened.
  primary: 'bg-accent text-accent-fg border-accent hover:opacity-90 active:opacity-80',
  secondary: 'bg-surface text-text border-border hover:bg-surface-2 active:bg-border',
  ghost: 'bg-transparent text-text border-transparent hover:bg-surface-2 active:bg-border',
  danger: 'bg-critical-bg text-critical border-critical-border hover:opacity-90 active:opacity-80',
  link: 'border-transparent bg-transparent text-accent underline underline-offset-2 hover:opacity-80 active:opacity-70',
}

/**
 * `md`/`lg` clear the 44px pointer target; `sm` is the 32px compact control for dense toolbars.
 * `link` opts out of the box entirely — padding on an inline link would put a gap in the sentence.
 */
export const buttonSize: Record<ButtonSize, string> = {
  sm: 'min-h-tap-compact px-2 py-1 text-sm',
  md: 'min-h-tap-min px-3 py-1.5 text-base',
  lg: 'min-h-tap-min px-4 py-2.5 text-md',
}

/**
 * The button look as a class string, for elements `Button` cannot be: a react-router `<Link>`,
 * whose client-side navigation would be lost if it were rendered as a plain `<a href>`.
 *
 * Eight links across the app drew the primary button by hand, each with its own idea of the
 * padding and the hover — this is the same look from the same place, without changing what the
 * element is. See docs/ui-conventions.md §9.
 */
export function buttonClass(opts?: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}): string {
  const { variant = 'secondary', size = 'md', className = '' } = opts ?? {}
  const s = variant === 'link' ? 'text-inherit' : buttonSize[size]
  return `${BUTTON_BASE} ${buttonVariant[variant]} ${s} no-underline ${className}`
}
