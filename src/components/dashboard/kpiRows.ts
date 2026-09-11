import type {
  GameState,
  KpiSpec,
  MetricValue,
  Mode,
  ScenarioDefinition,
  Threshold,
} from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'

export interface KpiRow {
  spec: KpiSpec
  /** Value shown (possibly lagged in expert mode). */
  current?: MetricValue
  /** Value one turn before `current`. */
  previous?: MetricValue
  delta?: number
  /** History up to the shown turn, oldest first. */
  series: number[]
  /** Turns of staleness applied (expert `lagTurns`), 0 otherwise. */
  lag: number
  threshold?: Threshold
}

export type Direction = 'better' | 'worse' | 'neutral'

/** Whether a change of the given sign moves the metric toward or away from its breach band. */
export function directionOf(sign: number, t?: Threshold): Direction {
  if (!t || sign === 0) return 'neutral'
  const up = sign > 0
  return (t.direction === 'below') === up ? 'better' : 'worse'
}

export const DIR_CLASS: Record<Direction, string> = {
  better: 'text-positive',
  worse: 'text-critical',
  neutral: 'text-muted',
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
    const series: number[] = []
    for (const snap of hist) {
      if (snap.turnIndex > shownTurn) break
      const v = snap.metrics[spec.metric]?.value
      if (v !== undefined && Number.isFinite(v)) series.push(v)
    }
    return { spec, current, previous, delta, series, lag, threshold: thresholds[spec.metric] }
  })
}
