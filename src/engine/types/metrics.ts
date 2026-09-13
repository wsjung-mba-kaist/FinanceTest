export type MetricUnit = '%' | 'bp' | 'x' | 'ccy' | 'days' | 'count' | 'index' | 'rate' | 'fx'
export type MetricStatus = 'ok' | 'warn' | 'breach' | 'na'

export interface MetricValue {
  key: string
  value: number
  unit: MetricUnit
  status: MetricStatus
  label: string
  labelEn?: string
  /** Intermediate values for the "show working" panel. */
  detail?: Record<string, number>
}

export interface MetricSnapshot {
  turnIndex: number
  metrics: Record<string, MetricValue>
}

/** Threshold semantics: `direction: 'below'` means lower values are worse (breach when value < breach). */
export interface Threshold {
  /** Missing provenance is treated as a training band, never as a regulatory minimum. */
  basis?: 'simulation' | 'regulatory' | 'internal'
  asOf?: string
  sourceRefs?: string[]
  warn: number
  breach: number
  direction: 'above' | 'below'
}
export type ThresholdMap = Record<string, Threshold>

/** How a metric is displayed on the dashboard. */
export interface KpiSpec {
  metric: string
  label: string
  labelEn?: string
  unit: MetricUnit
  primary?: boolean
  sparkline?: boolean
  description?: string
  /** Expert mode: show value as of N turns ago. */
  lagTurns?: number
  /** Decimal places for display. */
  decimals?: number
  /** Optional reference line label (e.g. '규제 최저 100%'). */
  referenceLabel?: string
}

export interface MetricDelta {
  key: string
  label: string
  unit: MetricUnit
  before: number
  after: number
  delta: number
  statusBefore: MetricStatus
  statusAfter: MetricStatus
}

/**
 * One intra-turn metric sample. `metricsHistory` keeps exactly one snapshot per turn (scoring,
 * conditions and the debrief all rely on that); tick samples live here for live sparklines/tickers.
 */
export interface TickSample {
  turnIndex: number
  tick: number
  values: Record<string, number>
}
