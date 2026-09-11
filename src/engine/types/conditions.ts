import type { FlagValue } from './common'

export interface ConditionContext {
  turnIndex: number
  flags: Record<string, FlagValue>
  counters: Record<string, number>
  /** Metric value lookup for the current snapshot; undefined if missing. */
  metric: (key: string) => number | undefined
  /** Metric history lookup (most recent first). */
  metricHistory: (key: string) => number[]
  /** Numeric state path lookup. */
  path: (p: string) => number | undefined
  chose: (decisionId: string, optionId: string | string[]) => boolean
  regulatorLevel: number
  confidence: number
}

export type Condition =
  | { flag: string; is?: FlagValue }
  | { notFlag: string }
  | {
      metric: string
      lt?: number
      lte?: number
      gt?: number
      gte?: number
      /** Require the comparison to hold for N consecutive turns (including current). */
      consecutiveTurns?: number
    }
  | { counter: string; lt?: number; lte?: number; gt?: number; gte?: number }
  | { path: string; lt?: number; lte?: number; gt?: number; gte?: number; eq?: number }
  | { chose: { decision: string; option: string | string[] } }
  | { notChose: { decision: string; option: string | string[] } }
  | { turn: { gte?: number; lte?: number; eq?: number } }
  | { regulator: { gte?: number; lte?: number } }
  | { confidence: { gte?: number; lt?: number } }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { fn: (ctx: ConditionContext) => boolean; label: string }
