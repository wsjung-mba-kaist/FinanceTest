import type {
  GameState,
  KpiSpec,
  MetricValue,
  Mode,
  ScenarioDefinition,
  Threshold,
  Units,
} from '../../engine'
import { directionOf, type Direction } from '../../lib/direction'
import { scaleFor, type CcyScale } from '../../lib/format'
import { mergeThresholds } from '../../metrics/thresholds'

export { directionOf, type Direction }

export interface KpiRow {
  spec: KpiSpec
  /** Value shown (possibly lagged in expert mode). */
  current?: MetricValue
  /** Value one turn before `current`. */
  previous?: MetricValue
  delta?: number
  /**
   * Sparkline series up to the shown turn, oldest first. Drawn from `state.tickHistory` so a
   * ticked turn moves the line within the turn; falls back to the per-turn snapshots. The
   * delta beside it always stays 전 턴 대비 — an intraday wiggle is not a turn-over-turn move.
   */
  series: number[]
  /** Turns of staleness applied (expert `lagTurns`), 0 otherwise. */
  lag: number
  threshold?: Threshold
  /** One currency scale for this metric, held for the whole run. `undefined` for non-currency. */
  scale?: CcyScale
}

/**
 * Colour says one thing on this screen: **what state the metric is in now**.
 *
 * It used to say two. A status badge is coloured by `ok | warn | breach`, and a delta was coloured
 * by `better | worse` — so one row could carry a green delta beside a red badge, and the reader had
 * to work out which green meant what. Worse, a delta's colour was the *only* channel carrying its
 * direction for the ~8% of men with a red-green deficiency, on a screen whose other greens and reds
 * mean something else entirely.
 *
 * So direction is spoken by shape and word — `formatDelta`'s ▲/▼ plus 개선/악화 — and keeps its
 * colour for exactly one case: a change that crossed a threshold band. That is the moment the eye
 * is supposed to be pulled, and reserving the colour for it is what makes the pull work.
 */
export function dirClass(dir: Direction, crossed: boolean): string {
  if (!crossed || dir === 'neutral') return 'text-muted'
  return dir === 'better' ? 'text-positive' : 'text-critical'
}
export const DIR_TEXT: Record<Direction, string> = {
  better: '개선',
  worse: '악화',
  neutral: '변화',
}

/** Primary KPIs first, authored order otherwise. */
export function sortedKpis(scenario: ScenarioDefinition): KpiSpec[] {
  return [...scenario.kpis].sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)))
}

export function buildKpiRows(scenario: ScenarioDefinition, state: GameState, mode: Mode): KpiRow[] {
  const thresholds = mergeThresholds(scenario.thresholds)
  const hist = state.metricsHistory
  const byTurn = (t: number) => hist.find((m) => m.turnIndex === t)
  return sortedKpis(scenario).map((spec) => {
    const wantedLag = mode === 'expert' && spec.lagTurns ? spec.lagTurns : 0
    const shownTurn = Math.max(0, state.turnIndex - wantedLag)
    const lag = state.turnIndex - shownTurn
    const currentSnap = lag > 0 ? (byTurn(shownTurn) ?? hist[0]) : hist[hist.length - 1]
    const previousSnap = byTurn(shownTurn - 1)
    const current = currentSnap?.metrics[spec.metric]
    const previous = previousSnap?.metrics[spec.metric]
    const delta =
      current && previous && Number.isFinite(current.value) && Number.isFinite(previous.value)
        ? current.value - previous.value
        : undefined
    return {
      spec,
      current,
      previous,
      delta,
      series: metricSeries(state, spec.metric, shownTurn),
      lag,
      threshold: thresholds[spec.metric],
      scale: metricScale(state, spec, scenario.units),
    }
  })
}

/**
 * The currency scale a metric keeps for the whole run, chosen from every value observed so far.
 *
 * Per-value scaling is what makes a falling number unreadable: cash that goes 3.2조원 → 8,500억원 →
 * 920억원 has changed axis twice, and the reader has to notice the *unit* changed before they can
 * see the *number* fell. Choosing once from the peak means the same figure reads 3.20 → 0.85 → 0.09
 * 조원 — three points on one axis, which is the shape of the event.
 */
export function metricScale(
  state: GameState,
  spec: KpiSpec,
  units: Units,
): CcyScale | undefined {
  if (spec.unit !== 'ccy') return undefined
  const seen = metricSeries(state, spec.metric, state.turnIndex)
  return scaleFor(seen, units)
}

/**
 * Live sparkline values for one metric up to (and including) `throughTurn`.
 * `tickHistory` carries one sample per (turn, tick), so an un-ticked run produces exactly the
 * per-turn series it did before L2 while a ticked turn adds its intraday points.
 */
export function metricSeries(state: GameState, metric: string, throughTurn: number): number[] {
  const out: number[] = []
  if (state.tickHistory.length > 0) {
    for (const sample of state.tickHistory) {
      if (sample.turnIndex > throughTurn) break
      const v = sample.values[metric]
      if (v !== undefined && Number.isFinite(v)) out.push(v)
    }
    if (out.length > 0) return out
  }
  for (const snap of state.metricsHistory) {
    if (snap.turnIndex > throughTurn) break
    const v = snap.metrics[metric]?.value
    if (v !== undefined && Number.isFinite(v)) out.push(v)
  }
  return out
}
