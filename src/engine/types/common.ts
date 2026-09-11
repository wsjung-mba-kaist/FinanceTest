/**
 * Shared primitive types for the simulation engine.
 * 한국어 UI 라벨은 콘텐츠 계층에서 다루며, 엔진 타입은 영문 식별자를 사용한다.
 */
export type InstitutionType =
  'bank' | 'securities' | 'pension' | 'prime_broker' | 'central_bank' | 'asset_manager'

export type Role =
  | 'bank_cro'
  | 'bank_treasurer'
  | 'bank_credit_officer'
  | 'securities_risk_head'
  | 'securities_treasurer'
  | 'pension_cio'
  | 'ldi_manager'
  | 'pb_risk_head'
  | 'central_bank_official'
  | 'regulator_official'
  | 'asset_manager_pm'

export type Region = 'global' | 'korea'
export type Difficulty = 'intro' | 'standard' | 'advanced'
export type TurnUnit = 'hour' | 'day' | 'week'
export type Mode = 'guided' | 'standard' | 'expert'
export type Severity = 'info' | 'warning' | 'critical' | 'positive'

/** 6 competencies tracked across scenarios; 'timeliness' is a per-run modifier. */
export type Competency =
  'liquidity' | 'solvency' | 'marketRisk' | 'communication' | 'compliance' | 'policy'
export type ScoreDimension = Competency | 'timeliness'
export const SCORE_DIMENSIONS: readonly ScoreDimension[] = [
  'liquidity',
  'solvency',
  'marketRisk',
  'communication',
  'compliance',
  'policy',
  'timeliness',
] as const

export type FlagValue = boolean | number | string
export type Flags = Record<string, FlagValue>
export type Counters = Record<string, number>

export type SourceKind = 'primary' | 'regulatory' | 'academic' | 'press' | 'book' | 'data'
export interface Source {
  id: string
  title: string
  publisher: string
  date: string
  url?: string
  pages?: string
  kind: SourceKind
  /** What this source is used to support. */
  note?: string
}

export type Currency = 'USD' | 'KRW' | 'GBP' | 'CHF' | 'EUR'
export interface Units {
  currency: Currency
  /** Multiplier from stored numbers to base currency units, e.g. 1e9 for "$B", 1e8 for "억원". */
  scale: number
  /** Display suffix, e.g. 'B', '억원'. */
  display: string
}

/** Regulator escalation ladder (R0..R4) from the calibration rules. */
export type RegulatorLevel = 0 | 1 | 2 | 3 | 4
