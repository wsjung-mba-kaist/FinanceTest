/**
 * Liquidity Coverage Ratio (LCR).
 *
 * Sources
 * - BCBS 238, "Basel III: The Liquidity Coverage Ratio and liquidity risk monitoring tools"
 *   (Jan 2013): paras 45–54 (HQLA levels, haircuts), 69–141 (cash outflows), 142–160 (cash
 *   inflows, 75% cap), Annex 1 (formula for the 40% and 15% caps on Level 2 assets).
 * - Basel Framework LCR30 (HQLA) and LCR40 (cash inflows and outflows).
 * - 은행업감독업무시행세칙 (유동성커버리지비율 산출기준): 국내 안정적 소매·중소기업 예금에는
 *   BCBS 기본값과 같은 5% 이탈률을 적용한다(조건부 3% 체계와 구분) → `KR_LCR_PARAMS`.
 *
 * HQLA after caps (BCBS 238 Annex 1). The ratios are expressed with the cap parameters and
 * reduce to the published 15/85, 15/60 and 2/3 when capL2b = 0.15 and capL2 = 0.40:
 *   adjL2A = l2a × (1 − haircutL2A)
 *   adjL2B = l2b × (1 − haircutL2B)
 *   adj15  = max(adjL2B − 15/85 × (L1 + adjL2A), adjL2B − 15/60 × L1, 0)
 *   adj40  = max(adjL2A + adjL2B − adj15 − 2/3 × L1, 0)
 *   HQLA   = L1 + adjL2A + adjL2B − adj15 − adj40
 *
 * Haircut note: BCBS 238 para 54 applies 25% to Level 2B RMBS and 50% to other Level 2B
 * assets (equities, corporate debt A+ to BBB−). The input carries a single pre-haircut L2B
 * figure, so the conservative 50% haircut is used for all of it.
 *
 * Outflows = Σ balance × run-off rate; inflows = Σ amount × inflow rate, capped at
 * inflowCap × outflows; netOutflows = outflows − cappedInflows.
 * LCR = HQLA / netOutflows × 100. NaN when netOutflows is 0 (never throws).
 */
import type { LcrInflowCategory, LcrInput, LcrOutflowCategory, LcrParams, LcrResult } from './types'

/** BCBS 238 baseline rates. The optional 3% stable-deposit rate requires national approval. */
export const BCBS_LCR_PARAMS: LcrParams = {
  haircuts: { l2a: 0.15, l2b: 0.5 },
  capL2: 0.4,
  capL2b: 0.15,
  runoff: {
    retailStable: 0.05,
    retailLessStable: 0.1,
    smeStable: 0.05,
    smeLessStable: 0.1,
    operational: 0.25,
    operationalInsured: 0.05,
    corporateInsured: 0.2,
    corporateUninsured: 0.4,
    financialInstitution: 1,
    other: 1,
    securedL1: 0,
    securedL2A: 0.15,
    securedL2BRmbs: 0.25,
    securedL2BOther: 0.5,
    securedOther: 1,
    committedCredit: 0.1,
    committedLiquidity: 0.3,
    committedFacilitiesToBanks: 0.4,
    committedLiquidityToNonBankFIs: 1,
  },
  inflowRates: {
    retail: 0.5,
    corporate: 0.5,
    financialInstitution: 1,
    securedL1: 0,
    other: 1,
  },
  inflowCap: 0.75,
}

/** LCR40.11–12: use only where the jurisdiction permits 3% and deposit insurance meets the extra tests. */
export const BCBS_REDUCED_RUNOFF_PARAMS: LcrParams = {
  ...BCBS_LCR_PARAMS,
  runoff: { ...BCBS_LCR_PARAMS.runoff, retailStable: 0.03, smeStable: 0.03 },
}

/** Korean supervisory parameters: stable retail / SME deposits run off at 5%. */
export const KR_LCR_PARAMS: LcrParams = {
  ...BCBS_LCR_PARAMS,
  runoff: { ...BCBS_LCR_PARAMS.runoff, retailStable: 0.05, smeStable: 0.05 },
}

const weightedSum = <K extends string>(
  balances: Partial<Record<K, number>>,
  rates: Record<K, number>,
): number => (Object.keys(rates) as K[]).reduce((sum, k) => sum + (balances[k] ?? 0) * rates[k], 0)

export function computeLcr(input: LcrInput, params: LcrParams = BCBS_LCR_PARAMS): LcrResult {
  const { l1, l2a, l2b } = input.hqla
  const { capL2, capL2b } = params
  const l2aAdjusted = l2a * (1 - params.haircuts.l2a)
  const l2bAdjusted = l2b * (1 - params.haircuts.l2b)

  // BCBS 238 Annex 1 — 15% cap on Level 2B first, then the 40% cap on all Level 2.
  const adj15 = Math.max(
    l2bAdjusted - (capL2b / (1 - capL2b)) * (l1 + l2aAdjusted),
    l2bAdjusted - (capL2b / (1 - capL2)) * l1,
    0,
  )
  const adj40 = Math.max(l2aAdjusted + l2bAdjusted - adj15 - (capL2 / (1 - capL2)) * l1, 0)
  const capAdjustment = adj15 + adj40
  const hqla = l1 + l2aAdjusted + l2bAdjusted - capAdjustment

  const totalOutflows = weightedSum<LcrOutflowCategory>(input.outflows, params.runoff)
  const totalInflows = weightedSum<LcrInflowCategory>(input.inflows, params.inflowRates)
  const inflowsCapped = Math.min(totalInflows, params.inflowCap * totalOutflows)
  const netOutflows = totalOutflows - inflowsCapped
  const lcr = netOutflows === 0 ? NaN : (hqla / netOutflows) * 100

  return {
    l1,
    l2aAdjusted,
    l2bAdjusted,
    capAdjustment,
    hqla,
    totalOutflows,
    totalInflows,
    inflowsCapped,
    netOutflows,
    lcr,
  }
}
