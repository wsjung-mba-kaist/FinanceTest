/**
 * Card surfaces, kept out of `index.tsx` so `cardClass` can be imported without dragging a
 * component module into a fast-refresh boundary. Same split as `buttonStyles`.
 *
 * Three loudnesses, one mechanism.
 *
 * These used to be `@utility card-surface / card-key / card-quiet`, which could never work:
 * Tailwind emits custom utilities at the *top* of `@layer utilities`, so `border`, `background`,
 * `border-radius` and `box-shadow` all lost to any built-in utility on the same element.
 * `card-key` never once drew its stronger border. One rule owning the look means there is nothing
 * to lose to. See docs/ui-conventions.md §2.
 *
 * `tier="base"` is byte-identical to what `Card` has always rendered.
 */
export type CardTier = 'quiet' | 'base' | 'key'

export const tierClass: Record<CardTier, string> = {
  quiet: 'rounded-lg bg-surface-2',
  base: 'rounded-lg border border-border bg-surface',
  key: 'rounded-lg border border-border-strong bg-surface shadow-card',
}

/**
 * The card surface as a class string, for elements `Card` cannot be — a react-router `<Link>`,
 * whose client-side navigation would be lost if it rendered as a plain tag. Same escape hatch as
 * `buttonClass`, and the same reason: one definition of the look, whatever carries it.
 */
export function cardClass(tier: CardTier = 'base', className = ''): string {
  return `${tierClass[tier]} ${className}`
}
