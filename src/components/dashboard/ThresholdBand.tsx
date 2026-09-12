import type { MetricStatus, MetricUnit, Threshold, Units } from '../../engine'
import { formatAt, type CcyScale } from '../../lib/format'

/**
 * 임계 구간 막대 — 위험 / 경고 / 정상 구간을 6px 바로 그리고 현재 값에 표식을 둔다.
 *
 * 색만으로 구간을 말하지 않는다: 아래에 `위험 <$0 · 경고 <$10B` 형태의 캡션을 두고,
 * `aria-label`에는 경고·위험 수치와 현재 값을 문장으로 넣는다.
 */
export function ThresholdBand({
  value,
  threshold,
  unit,
  units,
  decimals,
  label,
  status,
  showCaption = true,
  scale,
}: {
  value?: number
  threshold: Threshold
  unit: MetricUnit
  units: Units
  decimals?: number
  label: string
  status?: MetricStatus
  showCaption?: boolean
  /** The scale the metric's own figure is pinned to, so the caption agrees with it. */
  scale?: CcyScale
}) {
  const fmt = (v: number) => formatAt(v, unit, units, { scale, decimals })
  const { warn, breach, direction } = threshold
  const spread = Math.abs(warn - breach)
  const pad = spread > 0 ? spread : Math.max(Math.abs(warn), 1) * 0.25

  // 축은 항상 왼쪽이 나쁨 → 오른쪽이 좋음이 되도록 그린다.
  const lowIsBad = direction === 'below'
  const rawMin = lowIsBad ? breach - pad * 1.2 : warn - pad * 1.6
  const rawMax = lowIsBad ? warn + pad * 1.6 : breach + pad * 1.2
  const min =
    value !== undefined && Number.isFinite(value) ? Math.min(rawMin, value - pad * 0.2) : rawMin
  const max =
    value !== undefined && Number.isFinite(value) ? Math.max(rawMax, value + pad * 0.2) : rawMax
  const span = max - min || 1
  const at = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100))

  const breachPos = at(breach)
  const warnPos = at(warn)
  // 구간 경계(왼쪽부터). direction에 따라 나쁨/좋음의 좌우가 반대다.
  const stops = lowIsBad
    ? [
        { color: 'var(--sev-critical)', to: breachPos },
        { color: 'var(--sev-warning)', to: warnPos },
        { color: 'var(--sev-positive)', to: 100 },
      ]
    : [
        { color: 'var(--sev-positive)', to: warnPos },
        { color: 'var(--sev-warning)', to: breachPos },
        { color: 'var(--sev-critical)', to: 100 },
      ]

  const caption = lowIsBad
    ? `위험 <${fmt(breach)} · 경고 <${fmt(warn)}`
    : `경고 >${fmt(warn)} · 위험 >${fmt(breach)}`
  const statusWord =
    status === 'breach' ? '위험' : status === 'warn' ? '경고' : status === 'ok' ? '정상' : undefined
  const aria =
    `${label} 기준 — 경고 ${fmt(warn)}, 위험 ${fmt(breach)}` +
    (value !== undefined && Number.isFinite(value)
      ? `. 현재 ${fmt(value)}${statusWord ? ` (${statusWord})` : ''}`
      : '')

  let left = 0
  let prev = 0
  const segments = stops.map((s) => {
    left = prev
    prev = s.to
    return { color: s.color, left, width: Math.max(0, s.to - left) }
  })

  return (
    <div className="mt-1" role="img" aria-label={aria}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        {segments.map((s, i) => (
          <span
            key={i}
            className="absolute inset-y-0"
            style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.color, opacity: 0.85 }}
          />
        ))}
        {value !== undefined && Number.isFinite(value) && (
          <span
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm bg-text"
            style={{ left: `calc(${at(value)}% - 1px)` }}
          />
        )}
      </div>
      {showCaption && (
        <div className="mt-0.5 text-xs text-muted" aria-hidden="true">
          {caption}
        </div>
      )}
    </div>
  )
}
