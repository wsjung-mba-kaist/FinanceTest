import { useMemo } from 'react'
import type { GameState, ScenarioDefinition } from '../../engine'
import { formatAt, formatDelta, scaleFor } from '../../lib/format'
import { mergeThresholds } from '../../metrics/thresholds'
import { DIR_TEXT, dirClass, directionOf, metricScale } from '../dashboard/kpiRows'
import { StatusBadge } from '../ui'
import { turnDiff } from './turnDiff'

export function TurnChanges({
  scenario,
  state,
  onSeeAll,
}: {
  scenario: ScenarioDefinition
  state: GameState
  onSeeAll: () => void
}) {
  const rows = useMemo(() => turnDiff(scenario, state), [scenario, state])
  const decimalsOf = useMemo(() => {
    const m = new Map(scenario.kpis.map((k) => [k.metric, k.decimals]))
    return (metric: string) => m.get(metric)
  }, [scenario.kpis])
  const thresholds = useMemo(() => mergeThresholds(scenario.thresholds), [scenario.thresholds])
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="turn-changes-title">
      <div className="flex items-baseline gap-2">
        <h3 id="turn-changes-title" className="label-caps">
          전 턴 대비 변화
        </h3>
        <button
          type="button"
          className="ml-auto min-h-tap-dense text-sm text-accent"
          onClick={onSeeAll}
        >
          전체 지표 →
        </button>
      </div>
      <ul className="mt-1 list-none space-y-0.5 p-0">
        {rows.map((d) => {
          const crossed = d.statusBefore !== d.statusAfter
          const dir = directionOf(Math.sign(d.delta), thresholds[d.key])
          const scale =
            d.unit === 'ccy'
              ? (metricScale(state, { metric: d.key, label: d.label, unit: 'ccy' }, scenario.units) ??
                scaleFor([d.before, d.after], scenario.units))
              : undefined
          return (
            <li key={d.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-base">
              <span className="text-muted">{d.label}</span>
              <span className="num ml-auto">
                {formatAt(d.before, d.unit, scenario.units, { scale, decimals: decimalsOf(d.key) })} →{' '}
                <span className="font-semibold">
                  {formatAt(d.after, d.unit, scenario.units, { scale, decimals: decimalsOf(d.key) })}
                </span>
              </span>
              <span className={`num inline-flex items-baseline gap-0.5 ${dirClass(dir, crossed)}`}>
                {formatDelta(d.delta, d.unit, scenario.units, {
                  scale,
                  decimals: decimalsOf(d.key),
                })}
                {dir !== 'neutral' && <span className="text-xs">{DIR_TEXT[dir]}</span>}
              </span>
              {crossed && (
                <span className="flex items-center gap-1">
                  <StatusBadge status={d.statusBefore} />
                  <span aria-hidden="true">→</span>
                  <StatusBadge status={d.statusAfter} />
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
