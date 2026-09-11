import type { Units } from '../engine/types/common'
import type { MetricUnit } from '../engine/types/metrics'

const MINUS = '−'

function sign(n: number): string {
  return n < 0 ? MINUS : ''
}

function fixed(n: number, d: number): string {
  return Math.abs(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** KRW: 조/억/만 단위, USD/GBP/CHF/EUR: B/M/K. `value` is in scenario units (× units.scale = base currency). */
export function formatCurrency(
  value: number,
  units: Units,
  opts: { decimals?: number; compact?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return '—'
  const base = value * units.scale
  const abs = Math.abs(base)
  const d = opts.decimals
  if (units.currency === 'KRW') {
    if (abs >= 1e12)
      return `${sign(base)}${fixed(abs / 1e12, d ?? (abs / 1e12 >= 100 ? 0 : 1))}조원`
    if (abs >= 1e8) return `${sign(base)}${fixed(abs / 1e8, d ?? 0)}억원`
    if (abs >= 1e4) return `${sign(base)}${fixed(abs / 1e4, d ?? 0)}만원`
    return `${sign(base)}${fixed(abs, 0)}원`
  }
  const sym =
    units.currency === 'USD'
      ? '$'
      : units.currency === 'GBP'
        ? '£'
        : units.currency === 'EUR'
          ? '€'
          : 'CHF '
  if (abs >= 1e9) return `${sign(base)}${sym}${fixed(abs / 1e9, d ?? (abs / 1e9 >= 100 ? 0 : 1))}B`
  if (abs >= 1e6) return `${sign(base)}${sym}${fixed(abs / 1e6, d ?? 0)}M`
  if (abs >= 1e3) return `${sign(base)}${sym}${fixed(abs / 1e3, d ?? 1)}K`
  return `${sign(base)}${sym}${fixed(abs, d ?? 0)}`
}

export function formatPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${sign(value)}${fixed(value, decimals)}%`
}

export function formatPp(delta: number, decimals = 1): string {
  if (!Number.isFinite(delta)) return '—'
  return `${delta > 0 ? '+' : sign(delta)}${fixed(delta, decimals)}%p`
}

export function formatBp(value: number, withSign = false): string {
  if (!Number.isFinite(value)) return '—'
  return `${withSign && value > 0 ? '+' : sign(value)}${fixed(value, 0)}bp`
}

export function formatMultiple(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${sign(value)}${fixed(value, decimals)}x`
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—'
  return `${sign(value)}${fixed(value, decimals)}`
}

export function formatMetric(
  value: number,
  unit: MetricUnit,
  units: Units,
  decimals?: number,
): string {
  switch (unit) {
    case '%':
      return formatPct(value, decimals ?? 1)
    case 'bp':
      return formatBp(value)
    case 'x':
      return formatMultiple(value, decimals ?? 1)
    case 'ccy':
      return formatCurrency(value, units, { decimals })
    case 'days':
      return value >= 99 ? '99+일' : `${formatNumber(value, decimals ?? 1)}일`
    case 'count':
      return `${formatNumber(value, 0)}개`
    case 'index':
      return formatNumber(value, decimals ?? 0)
    case 'rate':
      return `${formatNumber(value, decimals ?? 2)}%`
    case 'fx':
      return `${formatNumber(value, decimals ?? 1)}${units.currency === 'KRW' ? '원/$' : ''}`
  }
}

export function formatDelta(delta: number, unit: MetricUnit, units: Units): string {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return '±0'
  const arrow = delta > 0 ? '▲' : '▼'
  switch (unit) {
    case '%':
    case 'rate':
      return `${arrow}${fixed(delta, 1)}%p`
    case 'bp':
      return `${arrow}${fixed(delta, 0)}bp`
    case 'x':
      return `${arrow}${fixed(delta, 2)}x`
    case 'ccy':
      return `${arrow}${formatCurrency(Math.abs(delta), units)}`
    case 'days':
      return `${arrow}${fixed(delta, 1)}일`
    default:
      return `${arrow}${fixed(delta, 1)}`
  }
}

export function formatDateTime(iso: string, timezone?: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}
