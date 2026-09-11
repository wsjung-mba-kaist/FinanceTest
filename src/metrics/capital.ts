/**
 * Risk-based capital, leverage and "economic" tangible-equity ratios.
 *
 * Sources
 * - BCBS 189, "Basel III: A global regulatory framework for more resilient banks and banking
 *   systems" (Dec 2010, rev. Jun 2011), paras 49–96 (CET1 / AT1 / Tier 2 definitions),
 *   paras 151–167 (leverage ratio). Basel Framework RBC20 (minimum requirements), CAP10–30,
 *   LEV20 (leverage ratio exposure measure).
 * - AOCI opt-out: US Regulation Q, 12 CFR 217.22(b)(2) — non-advanced-approaches banks may
 *   exclude unrealized AFS gains / losses from CET1 (the SVB case, March 2023).
 *
 *   cet1Ratio            = CET1 / RWA × 100
 *   tier1Ratio           = (CET1 + AT1) / RWA × 100
 *   totalRatio           = (CET1 + AT1 + Tier 2) / RWA × 100
 *   leverageRatio        = (CET1 + AT1) / leverageExposure × 100
 *   cet1RatioAfsAdjusted = (CET1 − afsLossNotYetRecognised) / RWA × 100
 *   economicTceRatio     = (CET1 − afsLossNotYetRecognised − unrealizedHtmLoss)
 *                          / leverageExposure × 100
 *
 * where afsLossNotYetRecognised = aociInCet1 ? 0 : unrealizedAfsLoss (the loss is already in
 * CET1 when the bank does not opt out, so the adjusted ratio then equals cet1Ratio).
 * Ratios may be negative. Any ratio with a 0 denominator is NaN (never throws).
 */
import type { CapitalInput, CapitalResult } from './types'

const pct = (numerator: number, denominator: number): number =>
  denominator === 0 ? NaN : (numerator / denominator) * 100

export function computeCapital(input: CapitalInput): CapitalResult {
  const { cet1, at1, tier2, rwa, leverageExposure, aociInCet1 } = input
  const afsLossNotYetRecognised = aociInCet1 ? 0 : (input.unrealizedAfsLoss ?? 0)
  const htmLoss = input.unrealizedHtmLoss ?? 0
  const tier1 = cet1 + at1

  return {
    cet1Ratio: pct(cet1, rwa),
    tier1Ratio: pct(tier1, rwa),
    totalRatio: pct(tier1 + tier2, rwa),
    leverageRatio: pct(tier1, leverageExposure),
    cet1RatioAfsAdjusted: pct(cet1 - afsLossNotYetRecognised, rwa),
    economicTceRatio: pct(cet1 - afsLossNotYetRecognised - htmLoss, leverageExposure),
  }
}
