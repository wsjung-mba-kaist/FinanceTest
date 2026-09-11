import type { MetricStatus, Threshold, ThresholdMap } from '../engine/types/metrics'

/**
 * Default warn/breach bands per metric key. Scenarios override via `scenario.thresholds`.
 * direction 'below' ⇒ lower is worse (breach when value < breach); 'above' ⇒ higher is worse.
 */
export const DEFAULT_THRESHOLDS: ThresholdMap = {
  // bank
  lcr: { warn: 100, breach: 80, direction: 'below' },
  survivalDays: { warn: 3, breach: 1, direction: 'below' },
  cet1Ratio: { warn: 10.5, breach: 7, direction: 'below' },
  leverageRatio: { warn: 5, breach: 3, direction: 'below' },
  economicTce: { warn: 3, breach: 0, direction: 'below' },
  unrealizedLossPctCet1: { warn: 50, breach: 100, direction: 'above' },
  dailyOutflowPct: { warn: 3, breach: 10, direction: 'above' },
  cumulativeOutflowPct: { warn: 10, breach: 25, direction: 'above' },
  facilityHeadroom: { warn: 10, breach: 0, direction: 'below' },
  // securities (KR)
  ncr: { warn: 150, breach: 100, direction: 'below' },
  liquidityRatio: { warn: 110, breach: 100, direction: 'below' },
  rollRate: { warn: 90, breach: 60, direction: 'below' },
  guaranteeToEquity: { warn: 60, breach: 100, direction: 'above' },
  // pension / LDI
  ldiLeverage: { warn: 3, breach: 4.5, direction: 'above' },
  collateralHeadroomBp: { warn: 150, breach: 50, direction: 'below' },
  fundingRatio: { warn: 100, breach: 90, direction: 'below' },
  // prime broker
  marginCoverage: { warn: 150, breach: 100, direction: 'below' },
  concentrationDays: { warn: 3, breach: 10, direction: 'above' },
  // central bank
  guidottiRatio: { warn: 100, breach: 70, direction: 'below' },
  importCoverMonths: { warn: 3, breach: 1, direction: 'below' },
  sovereignSpreadBp: { warn: 100, breach: 300, direction: 'above' },
  distressedBanks: { warn: 1, breach: 4, direction: 'above' },
  // asset manager
  redemptionsPendingPct: { warn: 2, breach: 5, direction: 'above' },
  cashBufferPct: { warn: 7, breach: 3, direction: 'below' },
  // common
  confidence: { warn: 60, breach: 40, direction: 'below' },
  regulatorLevel: { warn: 1, breach: 3, direction: 'above' },
}

/**
 * Status of `value` against its band. A metric **without** a threshold has no band to breach,
 * so it returns `'na'` ("기준 없음"), never `'ok'` — a green 정상 badge on an unbanded metric
 * (누적 예금 유출, 현금 …) reads as reassurance through an entire bank run.
 */
export function statusFor(value: number, t?: Threshold): MetricStatus {
  if (!t || Number.isNaN(value) || !Number.isFinite(value)) return 'na'
  if (t.direction === 'below') {
    if (value < t.breach) return 'breach'
    if (value < t.warn) return 'warn'
    return 'ok'
  }
  if (value > t.breach) return 'breach'
  if (value > t.warn) return 'warn'
  return 'ok'
}

export function mergeThresholds(overrides?: ThresholdMap): ThresholdMap {
  return { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) }
}
