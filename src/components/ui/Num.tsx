import type { MetricUnit, Units } from '../../engine/types'
import { splitMetric, type CcyScale } from '../../lib/format'

/**
 * A figure and its unit, rendered as two elements rather than one string.
 *
 * `104.2%` and `3.2조원` are each fine on their own; right-aligned under one another they are not,
 * because the unit is what ends the line and the units differ in width — so the decimal points,
 * the one thing a reader scans a column for, land wherever the suffix leaves them. Keeping the
 * parts apart lets a column align on the number and park the unit in its own lane.
 *
 * In a table the unit belongs in the header and every cell passes `showUnit={false}`; standing
 * alone in a tile it is rendered inline, smaller and muted, because the number is the content and
 * the unit is a label for it.
 */
export function Num({
  value,
  unit,
  units,
  scale,
  decimals,
  showUnit = true,
  className = 'num',
  unitClassName = 'text-sm text-muted',
}: {
  value: number
  unit: MetricUnit
  units: Units
  /** Pin a currency figure to a column's shared unit; omit to let the value pick its own. */
  scale?: CcyScale
  decimals?: number
  showUnit?: boolean
  className?: string
  unitClassName?: string
}) {
  const parts = splitMetric(value, unit, units, { scale, decimals })
  return (
    <>
      <span className={className}>{parts.value}</span>
      {showUnit && parts.unit && (
        <span className={`${unitClassName} ml-0.5`}>{parts.unit}</span>
      )}
      {/* The unit is never dropped from the accessible name, only from the visible column. */}
      {!showUnit && parts.unit && <span className="sr-only">{parts.unit}</span>}
    </>
  )
}
