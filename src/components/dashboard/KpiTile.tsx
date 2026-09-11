import type { MetricDelta, Units } from '../../engine'
import { formatDelta, formatMetric } from '../../lib/format'
import type { PreviewFidelity } from '../play/playHelpers'
import { Badge, Card, StatusBadge } from '../ui'
import { DIR_CLASS, DIR_TEXT, directionOf, type KpiRow } from './kpiRows'
import { Sparkline } from './Sparkline'

const STATUS_TEXT = { ok: '정상', warn: '경고', breach: '위험', na: '해당없음' } as const

/** Dashboard tile: value, delta vs previous turn, status chip, sparkline and (while previewing) a projected chip. */
export function KpiTile({
  row,
  units,
  projected,
  fidelity,
}: {
  row: KpiRow
  units: Units
  projected?: MetricDelta
  fidelity: PreviewFidelity
}) {
  const { spec, current, delta, series, lag, threshold } = row
  const status = current?.status ?? 'na'
  const value = current ? formatMetric(current.value, spec.unit, units, spec.decimals) : '—'
  const deltaText = delta !== undefined ? formatDelta(delta, spec.unit, units) : undefined
  const dir = delta !== undefined ? directionOf(Math.sign(delta), threshold) : 'neutral'
  let projectedText: string | undefined
  let projectedDir: 'better' | 'worse' | 'neutral' = 'neutral'
  if (projected && fidelity !== 'none') {
    projectedDir = directionOf(Math.sign(projected.delta), threshold)
    projectedText =
      fidelity === 'numeric'
        ? `→ ${formatMetric(projected.after, spec.unit, units, spec.decimals)} (${formatDelta(projected.delta, spec.unit, units)})`
        : `${projected.delta > 0 ? '▲' : '▼'} 예상 ${DIR_TEXT[projectedDir]}`
  }
  const label = `${spec.label} ${value}, ${STATUS_TEXT[status]}${deltaText ? `, 전 턴 대비 ${deltaText}` : ''}${lag > 0 ? `, ${lag}턴 지연 값` : ''}${projectedText ? `, 예상 ${projectedText}` : ''}`
  return (
    <Card
      as="div"
      className={`p-2 ${spec.primary ? 'border-accent/40' : ''}`}
      title={spec.description}
      aria-label={label}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted">
        <span className="truncate" title={spec.labelEn}>
          {spec.label}
        </span>
        {lag > 0 && <Badge tone="neutral">T−{lag} 기준</Badge>}
        <span className="ml-auto shrink-0">
          <StatusBadge status={status} />
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="num text-[18px] font-semibold leading-tight">{value}</span>
        {deltaText && (
          <span className={`num text-[11px] ${DIR_CLASS[dir]}`}>
            {deltaText}
            <span className="sr-only"> ({DIR_TEXT[dir]})</span>
          </span>
        )}
      </div>
      {spec.referenceLabel && <div className="text-[10px] text-muted">{spec.referenceLabel}</div>}
      {spec.sparkline && series.length >= 2 && (
        <div className="mt-1">
          <Sparkline
            values={series}
            threshold={threshold?.warn}
            ariaLabel={`${spec.label} 추이 ${series.length}턴, 최근 ${value}`}
          />
        </div>
      )}
      {projectedText && (
        <div
          className={`num mt-1 inline-block rounded border border-dashed border-accent px-1.5 py-0.5 text-[11px] ${DIR_CLASS[projectedDir]}`}
        >
          {projectedText}
        </div>
      )}
    </Card>
  )
}

/** Compact chip for the sticky KPI strip (tablet/mobile). */
export function KpiChip({
  row,
  units,
  onClick,
}: {
  row: KpiRow
  units: Units
  onClick?: () => void
}) {
  const { spec, current } = row
  const status = current?.status ?? 'na'
  const value = current ? formatMetric(current.value, spec.unit, units, spec.decimals) : '—'
  const dot = status === 'breach' ? '■' : status === 'warn' ? '⚠' : '●'
  const tone =
    status === 'breach'
      ? 'text-critical'
      : status === 'warn'
        ? 'text-warning'
        : status === 'ok'
          ? 'text-positive'
          : 'text-muted'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
      aria-label={`${spec.label} ${value}, ${STATUS_TEXT[status]}`}
    >
      <span className={tone} aria-hidden="true">
        {dot}
      </span>
      <span className="text-muted">{spec.label}</span>
      <span className="num font-semibold">{value}</span>
    </button>
  )
}
