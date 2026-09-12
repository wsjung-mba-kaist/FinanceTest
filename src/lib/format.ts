import type { Currency, Units } from '../engine/types/common'
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

/* ---- one column, one scale -------------------------------------------------
 *
 * `formatCurrency` picks a unit per *value*, which is the right answer when a figure stands alone
 * and the wrong one the moment two figures sit in the same column: `3.2조원` above `8,500억원`
 * above `920억원` is three different axes stacked on top of each other, and the eye cannot compare
 * them without doing arithmetic first. A column is only a comparable axis if every cell shares a
 * unit — which is also why the unit belongs in the header rather than glued to each number.
 *
 * The scale is chosen once, from the largest magnitude in the set, and then held: a metric that
 * falls from 3.2조원 to 0.09조원 during a run keeps saying 조원 instead of switching axis mid-crisis.
 */

export interface CcyScale {
  /** Divide the *base-currency* amount by this. */
  divisor: number
  /**
   * The symbol that goes *before* the figure — `$`, `£`, `CHF `, and nothing at all for KRW.
   * Kept apart from `suffix` because `$90M` and `90억원` put their marks on opposite sides, and
   * treating the whole unit as a suffix prints `90$M`.
   */
  prefix: string
  /** The unit that follows the figure: `B` · `M` · `조원` · `억원`. */
  suffix: string
  /** The two together — what a column header says: `$B` · `조원`. */
  label: string
  /** Decimals that keep the smallest value in the set legible. */
  decimals: number
}

type Step = Omit<CcyScale, 'decimals'>

function step(divisor: number, prefix: string, suffix: string): Step {
  return { divisor, prefix, suffix, label: `${prefix}${suffix}`.trim() }
}

const KRW_STEPS: Step[] = [
  step(1e12, '', '조원'),
  step(1e8, '', '억원'),
  step(1e4, '', '만원'),
  step(1, '', '원'),
]

function latinSteps(sym: string): Step[] {
  return [step(1e9, sym, 'B'), step(1e6, sym, 'M'), step(1e3, sym, 'K'), step(1, sym, '')]
}

function symbolOf(currency: Currency): string {
  if (currency === 'USD') return '$'
  if (currency === 'GBP') return '£'
  if (currency === 'EUR') return '€'
  return 'CHF '
}

/**
 * Enough decimals for the *smallest* value in the set to keep two significant figures, and no more
 * than that — a column scaled to 조원 needs `0.09`, but one scaled to 억원 does not need `142.0`.
 */
function decimalsFor(smallest: number): number {
  if (!Number.isFinite(smallest) || smallest === 0) return 1
  if (smallest >= 10) return 0
  if (smallest >= 1) return 1
  return 2
}

/**
 * The one scale a set of currency figures shares. `values` are in scenario units (× `units.scale`
 * = base currency), the same as everywhere else.
 */
export function scaleFor(values: number[], units: Units): CcyScale {
  const magnitudes = values
    .filter((v) => Number.isFinite(v) && v !== 0)
    .map((v) => Math.abs(v) * units.scale)
  const steps = units.currency === 'KRW' ? KRW_STEPS : latinSteps(symbolOf(units.currency))
  if (magnitudes.length === 0) {
    // Nothing to measure — a metric still at zero, or one with no history yet. Falling back to the
    // base unit would print `$0.0` beside a `$14.0B` elsewhere on the same strip, as though the two
    // were on the same axis. The scenario's own `units` is the axis the whole run is written in.
    const declared = steps.find((st) => units.scale >= st.divisor) ?? steps[steps.length - 1]!
    return { ...declared, decimals: 1 }
  }

  const largest = Math.max(...magnitudes)
  // The step that puts the biggest number in [1, 1000); the last step is the floor.
  const step = steps.find((st) => largest >= st.divisor) ?? steps[steps.length - 1]!
  return { ...step, decimals: decimalsFor(Math.min(...magnitudes) / step.divisor) }
}

/** The numeric part and the unit part, kept apart so a column can align on the decimal point. */
export interface SplitValue {
  value: string
  unit: string
}

const UNIT_SUFFIX: Record<Exclude<MetricUnit, 'ccy' | 'fx'>, string> = {
  '%': '%',
  bp: 'bp',
  x: 'x',
  days: '일',
  count: '개',
  index: '',
  rate: '%',
}

/**
 * A metric rendered as {number, unit}. Pass `scale` for a currency metric to pin it to a column's
 * shared unit; without one it falls back to `formatCurrency`'s per-value choice.
 */
export function splitMetric(
  value: number,
  unit: MetricUnit,
  units: Units,
  opts: { scale?: CcyScale; decimals?: number } = {},
): SplitValue {
  if (!Number.isFinite(value)) return { value: '—', unit: '' }
  if (unit === 'ccy') {
    const { scale } = opts
    if (!scale) {
      // No column to agree with: `formatCurrency` already picks and appends a unit, so split its
      // output rather than duplicating the step table. The sign and any currency symbol are a
      // *prefix* of the number ('$42.0B', 'CHF 12.0B'), so they are skipped before the unit is
      // looked for — otherwise the very first character ends the number.
      const text = formatCurrency(value, units, { decimals: opts.decimals })
      const head = text.match(/^[^0-9]*/)![0]
      const rest = text.slice(head.length)
      const at = rest.search(/[^0-9.,]/)
      return at < 0
        ? { value: text, unit: '' }
        : { value: head + rest.slice(0, at), unit: rest.slice(at) }
    }
    const base = value * units.scale
    const d = opts.decimals ?? scale.decimals
    return {
      // Sign, then symbol, then figure — the order `formatCurrency` has always used (`−$90.0M`).
      value: `${sign(base)}${scale.prefix}${fixed(Math.abs(base) / scale.divisor, d)}`,
      unit: scale.suffix,
    }
  }
  if (unit === 'fx')
    return {
      value: formatNumber(value, opts.decimals ?? 1),
      unit: units.currency === 'KRW' ? '원/$' : '',
    }
  if (unit === 'days' && value >= 99) return { value: '99+', unit: '일' }
  const decimals =
    opts.decimals ?? (unit === 'rate' ? 2 : unit === 'bp' || unit === 'count' ? 0 : unit === 'index' ? 0 : 1)
  return { value: formatNumber(value, decimals), unit: UNIT_SUFFIX[unit] }
}

/** `splitMetric` joined back up, for aria labels, plain-text export and anywhere a column is not. */
export function formatAt(
  value: number,
  unit: MetricUnit,
  units: Units,
  opts: { scale?: CcyScale; decimals?: number } = {},
): string {
  const { value: v, unit: u } = splitMetric(value, unit, units, opts)
  return `${v}${u}`
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
