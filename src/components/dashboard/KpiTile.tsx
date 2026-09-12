import type { MetricDelta, MetricStatus, Units } from '../../engine'
import { KPI_EXPLAIN } from '../../content/kpiExplain'
import { formatDelta, formatMetric } from '../../lib/format'
import { useHelp } from '../help/helpContext'
import type { PreviewFidelity } from '../play/playHelpers'
import { Badge, Card, StatusBadge } from '../ui'
import { Icon } from '../ui/Icon'
import { DIR_CLASS, DIR_TEXT, directionOf, type KpiRow } from './kpiRows'
import { Sparkline } from './Sparkline'
import { ThresholdBand } from './ThresholdBand'

const STATUS_TEXT: Record<MetricStatus, string> = {
  ok: '정상',
  warn: '경고',
  breach: '위험',
  na: '기준 없음',
}

/**
 * 임계값이 없는 지표는 '정상'이 아니라 중립 회색 '기준 없음'으로 표시한다.
 * (누적 예금 유출처럼 구간이 정의되지 않은 지표가 뱅크런 내내 초록 배지를 다는 문제.)
 */
export function NoThresholdChip() {
  return (
    <Badge tone="none" title="이 지표에는 경고·위험 구간이 정의되어 있지 않습니다">
      기준 없음
    </Badge>
  )
}

/** 델타는 색만으로 말하지 않는다 — 화살표 + 개선/악화 단어를 함께 붙인다. */
function DeltaText({
  text,
  dir,
  className = '',
}: {
  text: string
  dir: 'better' | 'worse' | 'neutral'
  className?: string
}) {
  return (
    <span className={`num inline-flex items-center gap-0.5 text-sm ${DIR_CLASS[dir]} ${className}`}>
      <span>{text}</span>
      <span className="text-xs">{DIR_TEXT[dir]}</span>
    </span>
  )
}

/**
 * 대시보드 타일: 한글 라벨 + 영문 부라벨(실제로 보이게), 값(`num-lg`), 전 턴 대비 델타,
 * 임계 구간 막대, 스파크라인, 그리고 `?`(지표 설명 시트).
 */
export function KpiTile({
  row,
  units,
  projected,
  fidelity,
  compact = false,
}: {
  row: KpiRow
  units: Units
  projected?: MetricDelta
  fidelity: PreviewFidelity
  /** 2차 지표 묶음: 구간 막대·스파크라인 없이 한 줄로. */
  compact?: boolean
}) {
  const help = useHelp()
  const { spec, current, delta, series, lag, threshold } = row
  const status: MetricStatus = current?.status ?? 'na'
  const value = current ? formatMetric(current.value, spec.unit, units, spec.decimals) : '—'
  const deltaText = delta !== undefined ? formatDelta(delta, spec.unit, units) : undefined
  const dir = delta !== undefined ? directionOf(Math.sign(delta), threshold) : 'neutral'
  const explain = KPI_EXPLAIN[spec.metric]
  const tip = spec.description ?? explain?.why

  let projectedText: string | undefined
  let projectedDir: 'better' | 'worse' | 'neutral' = 'neutral'
  if (projected && fidelity !== 'none') {
    projectedDir = directionOf(Math.sign(projected.delta), threshold)
    projectedText =
      fidelity === 'numeric'
        ? `→ ${formatMetric(projected.after, spec.unit, units, spec.decimals)} (${formatDelta(projected.delta, spec.unit, units)})`
        : `${projected.delta > 0 ? '▲' : '▼'} 예상 ${DIR_TEXT[projectedDir]}`
  }

  const aria = [
    spec.label,
    spec.labelEn,
    value,
    STATUS_TEXT[status],
    deltaText ? `전 턴 대비 ${deltaText} ${DIR_TEXT[dir]}` : '',
    lag > 0 ? `${lag}턴 지연 값` : '',
    projectedText ? `예상 ${projectedText}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  const openHelp = () => help.open({ tab: 'kpis', anchor: spec.metric })

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0"
        aria-label={aria}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base">{spec.label}</span>
          {spec.labelEn && (
            <span className="block truncate text-xs text-muted">{spec.labelEn}</span>
          )}
        </span>
        <span className="num shrink-0 font-semibold">{value}</span>
        {deltaText && <DeltaText text={deltaText} dir={dir} className="shrink-0" />}
        <span className="shrink-0">
          {status === 'na' ? <NoThresholdChip /> : <StatusBadge status={status} />}
        </span>
        <HelpButton onClick={openHelp} label={spec.label} />
      </div>
    )
  }

  return (
    <Card as="div" tier={spec.primary ? 'key' : 'base'} className="p-2">
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug">{spec.label}</span>
          {spec.labelEn && (
            <span className="block truncate text-xs text-muted" title={spec.labelEn}>
              {spec.labelEn}
            </span>
          )}
        </span>
        {lag > 0 && (
          <span className="shrink-0">
            <Badge tone="neutral">T−{lag} 기준</Badge>
          </span>
        )}
        <span className="shrink-0">
          {status === 'na' ? <NoThresholdChip /> : <StatusBadge status={status} />}
        </span>
        <HelpButton onClick={openHelp} label={spec.label} />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2" aria-label={aria}>
        <span className="num-lg">{value}</span>
        {deltaText && <DeltaText text={deltaText} dir={dir} />}
      </div>

      {threshold ? (
        <ThresholdBand
          value={current?.value}
          threshold={threshold}
          unit={spec.unit}
          units={units}
          decimals={spec.decimals}
          label={spec.label}
          status={status}
        />
      ) : (
        <div className="mt-1 text-xs text-muted">
          {spec.referenceLabel ?? '경고·위험 구간이 정의되지 않은 지표입니다'}
        </div>
      )}
      {threshold && spec.referenceLabel && (
        <div className="text-xs text-muted">{spec.referenceLabel}</div>
      )}

      {spec.sparkline && series.length >= 2 && (
        <div className="mt-1">
          <Sparkline
            values={series}
            threshold={threshold?.warn}
            ariaLabel={`${spec.label} 추이 ${series.length}개 표본, 최근 ${value}`}
          />
        </div>
      )}

      {projectedText && (
        <div
          className={`num mt-1 inline-block rounded-sm border border-dashed border-accent px-1.5 py-0.5 text-xs ${DIR_CLASS[projectedDir]}`}
        >
          {projectedText}
        </div>
      )}
      {tip && <p className="sr-only">{tip}</p>}
    </Card>
  )
}

function HelpButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-tap-dense min-w-tap-dense shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icon name="help" size={14} label={`${label} 설명 보기`} />
    </button>
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
  const status: MetricStatus = current?.status ?? 'na'
  const value = current ? formatMetric(current.value, spec.unit, units, spec.decimals) : '—'
  const dot = status === 'breach' ? '■' : status === 'warn' ? '⚠' : status === 'ok' ? '●' : '–'
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
      className="flex min-h-tap-min items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-sm"
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
