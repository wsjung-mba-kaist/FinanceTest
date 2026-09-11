/**
 * Net Stable Funding Ratio (NSFR).
 *
 * Source: BCBS d295, "Basel III: the net stable funding ratio" (Oct 2014), paras 17–47;
 * Table 1 (ASF factors) and Table 2 (RSF factors). Basel Framework NSF30.
 *
 * ASF  = Σ liability / capital amount × ASF factor
 * RSF  = Σ asset / off-balance amount × RSF factor
 * NSFR = ASF / RSF × 100 (regulatory minimum 100%). NaN when RSF is 0 (never throws).
 *
 * Factor mapping (simplified buckets):
 *   ASF — regulatory capital 100%; stable retail/SME deposits 95%; less-stable 90%;
 *         non-financial corporate funding < 1y 50%; other funding < 6m (FI, central bank) 0%;
 *         any funding ≥ 1y 100%.
 *   RSF — cash / central-bank reserves 0%; Level 1 5%; Level 2A 15%; Level 2B 50%;
 *         loans to FIs < 6m secured by Level 1 10%; other loans / assets < 1y 50%;
 *         residential mortgages ≥ 1y (≤ 35% RW) 65%; other performing loans ≥ 1y 85%;
 *         all other assets 100%; off-balance sheet committed facilities 5%.
 */
import type { NsfrInput, NsfrParams, NsfrResult } from './types'

/** BCBS d295 ASF / RSF factors. */
export const BCBS_NSFR_PARAMS: NsfrParams = {
  asf: {
    capital: 1,
    retailStable: 0.95,
    retailLessStable: 0.9,
    corporateUnder1y: 0.5,
    otherUnder6m: 0,
    over1y: 1,
  },
  rsf: {
    cash: 0,
    l1: 0.05,
    l2a: 0.15,
    l2b: 0.5,
    loansFiUnder6m: 0.1,
    otherUnder1y: 0.5,
    mortgagesOver1y: 0.65,
    otherLoans: 0.85,
    otherAssets: 1,
    offBalance: 0.05,
  },
}

const weightedSum = <K extends string>(
  amounts: Record<K, number>,
  factors: Record<K, number>,
): number => (Object.keys(factors) as K[]).reduce((sum, k) => sum + amounts[k] * factors[k], 0)

export function computeNsfr(input: NsfrInput, params: NsfrParams = BCBS_NSFR_PARAMS): NsfrResult {
  const asf = weightedSum(input.asf, params.asf)
  const rsf = weightedSum(input.rsf, params.rsf)
  const nsfr = rsf === 0 ? NaN : (asf / rsf) * 100
  return { asf, rsf, nsfr }
}
