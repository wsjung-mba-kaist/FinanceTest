import type { Threshold } from '../engine/types'

/**
 * Whether a change moved a metric toward or away from trouble.
 *
 * This is a fact about the model, not about a screen: `Threshold.direction` records which side of a
 * band is the bad one, and everything that renders a change — a tile, a strip cell, a debrief
 * sentence — needs the same answer from it. It lived in `components/dashboard` until the debrief
 * summary needed it and `lib` ended up importing from `components`.
 *
 * The *presentation* of a direction (its colour, its word) stays in the component layer.
 */
export type Direction = 'better' | 'worse' | 'neutral'

/** Whether a change of the given sign moves the metric toward or away from its breach band. */
export function directionOf(sign: number, t?: Threshold): Direction {
  if (!t || sign === 0) return 'neutral'
  const up = sign > 0
  return (t.direction === 'below') === up ? 'better' : 'worse'
}
