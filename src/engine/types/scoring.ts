import type { ScoreDimension } from './common'

/** Piecewise-linear curve mapping x → score (0..100), clamped at both ends. */
export type Curve = [x: number, score: number][]

export type ScoreComponent =
  | {
      kind: 'metric'
      metric: string
      aggregate: 'final' | 'min' | 'max' | 'avg' | 'turnsBelow' | 'turnsAbove'
      threshold?: number
      curve: Curve
      weight: number
      label?: string
    }
  | { kind: 'counter'; key: string; curve: Curve; weight: number; label?: string }
  /** Average expert rating of chosen options on decisions tagged with this dimension. */
  | { kind: 'expert'; weight: number; label?: string }
  | {
      kind: 'flag'
      key: string
      byTurn?: number
      ifSet: number
      ifNot: number
      weight: number
      label?: string
    }
  /** Σ option.scoreAdjust[dim], centred at 50. */
  | { kind: 'adjust'; weight: number; label?: string }
  /** Outcome contribution: alive / orderly failure / disorderly failure. */
  | {
      kind: 'survival'
      alive: number
      orderlyFail: number
      disorderlyFail: number
      weight: number
      label?: string
    }

export interface ScoringSpec {
  /** Must sum to 100. */
  weights: Record<ScoreDimension, number>
  rules: Partial<Record<ScoreDimension, { components: ScoreComponent[] }>>
  /** Max total if the run ended in failure (default 40); orderly failures use failureCapOrderly (default 60). */
  failureCap?: number
  failureCapOrderly?: number
}

export interface DimensionScore {
  score: number
  weight: number
  explanation: string[]
}

export interface ScoreReport {
  total: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: Record<ScoreDimension, DimensionScore>
  /** Average expert rating across all decisions (0..100). */
  expertAlignment: number
  hintPenalty: number
  timeoutCount: number
  ended?: { failed: boolean; orderly?: boolean; reason: string }
}
