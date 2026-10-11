export type RatingTone = 'positive' | 'warning' | 'critical'

/**
 * How an expert rating reads as a badge: ≥ 70 good, ≥ 40 mixed, below that poor. Two debrief
 * panels each kept the two thresholds inline; a change to one would have left the other saying
 * something different about the same option.
 */
export function ratingTone(rating: number): RatingTone {
  if (rating >= 70) return 'positive'
  if (rating >= 40) return 'warning'
  return 'critical'
}
