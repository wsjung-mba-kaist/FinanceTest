import type { KpiSpec, MetricDelta, Option, PreviewResult, ThresholdMap, Units } from '../../engine'
import { formatAt, formatDelta, scaleFor } from '../../lib/format'
import { StatusBadge } from '../ui'
import { DIR_TEXT, dirClass, directionOf } from '../dashboard/kpiRows'
import type { PreviewFidelity } from './playHelpers'

/** Relative size bucket → 1..3 arrows. */
function bucketOf(d: MetricDelta): 1 | 2 | 3 {
  const rel = d.before !== 0 ? Math.abs(d.delta / d.before) : Number.POSITIVE_INFINITY
  if (rel < 0.02) return 1
  if (rel < 0.1) return 2
  return 3
}

function rankOf(d: MetricDelta): number {
  const status = d.statusBefore !== d.statusAfter ? 10 : 0
  const rel = d.before !== 0 ? Math.abs(d.delta / d.before) : 1
  return status + Math.min(rel, 5)
}

function arrows(sign: number, n: number): string {
  if (sign === 0) return '→'
  return (sign > 0 ? '▲' : '▼').repeat(n)
}

/**
 * Impact preview under an option: numeric (guided), directional (standard) or none (expert).
 * Only metrics on the dashboard (`scenario.kpis`) are listed; at most 6, largest first.
 */
export function ImpactPreview({
  fidelity,
  option,
  result,
  kpis,
  units,
  thresholds,
}: {
  fidelity: PreviewFidelity
  option: Option
  result?: PreviewResult
  kpis: KpiSpec[]
  units: Units
  thresholds: ThresholdMap
}) {
  if (fidelity === 'none') {
    return (
      <p className="border-t border-border px-3 py-1.5 text-sm text-muted">예상 영향: 자체 판단</p>
    )
  }
  const kpiByMetric = new Map(kpis.map((k) => [k.metric, k]))
  const deltas = result
    ? result.deltas
        .filter((d) => kpiByMetric.has(d.key))
        .sort((a, b) => rankOf(b) - rankOf(a))
        .slice(0, 6)
    : []

  return (
    <div className="space-y-1.5 border-t border-border px-3 py-2 text-sm" aria-label="예상 영향">
      <div className="font-medium text-muted">
        예상 영향{fidelity === 'directional' ? ' (방향만)' : ''}
      </div>
      {!result && <p className="text-muted">계산 중…</p>}
      {result?.error && <p className="text-muted">{result.error}</p>}
      {result && !result.error && fidelity === 'numeric' && (
        <ul className="space-y-1">
          {deltas.length === 0 && (
            <li className="text-muted">대시보드 지표에 즉각적인 변화가 없습니다</li>
          )}
          {deltas.map((d) => {
            const spec = kpiByMetric.get(d.key)
            const decimals = spec?.decimals
            const dir = directionOf(Math.sign(d.delta), thresholds[d.key])
            const changed = d.statusBefore !== d.statusAfter
            return (
              <li key={d.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted">{spec?.label ?? d.label}</span>
                <span className="num ml-auto">
                  {/* Both halves on one scale: `before → after` is a comparison, and a row that
                      changes unit halfway across compares nothing. */}
                  {(() => {
                    const scale = d.unit === 'ccy' ? scaleFor([d.before, d.after], units) : undefined
                    return (
                      <>
                        {formatAt(d.before, d.unit, units, { scale, decimals })} →{' '}
                        {formatAt(d.after, d.unit, units, { scale, decimals })}
                      </>
                    )
                  })()}
                </span>
                <span className={`num inline-flex items-center gap-0.5 ${dirClass(dir, changed)}`}>
                  {formatDelta(d.delta, d.unit, units)}
                  {/* Visible, not sr-only: with colour reserved for band crossings this word is
                      what tells a sighted reader whether the move was the good direction. */}
                  {dir !== 'neutral' && <span className="text-xs">{DIR_TEXT[dir]}</span>}
                </span>
                {changed && (
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
      )}
      {result && !result.error && fidelity === 'directional' && (
        <ul className="space-y-1">
          {option.preview && option.preview.length > 0
            ? option.preview.map((h, i) => {
                const sign = h.direction === 'up' ? 1 : h.direction === 'down' ? -1 : 0
                const dir = directionOf(sign, thresholds[h.metric])
                return (
                  <li key={`${h.metric}-${i}`} className="flex flex-wrap items-center gap-x-2">
                    <span className="text-muted">
                      {kpiByMetric.get(h.metric)?.label ?? h.metric}
                    </span>
                    <span className={`num ml-auto inline-flex items-center gap-1 ${dirClass(dir, false)}`}>
                      {arrows(sign, h.magnitude)}
                      {dir !== 'neutral' && <span className="text-xs">{DIR_TEXT[dir]}</span>}
                      <span className="sr-only"> (강도 {h.magnitude})</span>
                    </span>
                    {h.note && <span className="w-full text-muted">{h.note}</span>}
                  </li>
                )
              })
            : deltas.map((d) => {
                const sign = Math.sign(d.delta)
                const dir = directionOf(sign, thresholds[d.key])
                const n = bucketOf(d)
                return (
                  <li key={d.key} className="flex items-center gap-x-2">
                    <span className="text-muted">{kpiByMetric.get(d.key)?.label ?? d.label}</span>
                    <span className={`num ml-auto inline-flex items-center gap-1 ${dirClass(dir, false)}`}>
                      {arrows(sign, n)}
                      {dir !== 'neutral' && <span className="text-xs">{DIR_TEXT[dir]}</span>}
                      <span className="sr-only"> (강도 {n})</span>
                    </span>
                  </li>
                )
              })}
          {deltas.length === 0 && !(option.preview && option.preview.length > 0) && (
            <li className="text-muted">대시보드 지표에 즉각적인 변화가 없습니다</li>
          )}
        </ul>
      )}
      {result && result.delayed.length > 0 && (
        <ul className="space-y-0.5 text-muted">
          {result.delayed.map((d, i) => (
            <li key={i}>
              지연 효과 (T+{d.afterTurns}): {d.description}
            </li>
          ))}
        </ul>
      )}
      {/* `wouldEnd` is shown by `OptionRow` itself — see the comment there. Repeating it inside
          the disclosure would say the same thing twice to whoever opened it. */}
    </div>
  )
}
