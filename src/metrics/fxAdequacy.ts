/**
 * Foreign-exchange reserve adequacy — IMF ARA metric, Greenspan-Guidotti, import cover, M2.
 *
 * Sources
 * - IMF, "Assessing Reserve Adequacy" (Feb 2011) and "Assessing Reserve Adequacy — Specific
 *   Proposals" (Apr 2015): the ARA EM metric and its weights (2015 revision):
 *     fixed / pegged   : 30% short-term debt + 20% other liabilities + 10% broad money + 10% exports
 *     floating         : 30% short-term debt + 15% other liabilities +  5% broad money +  5% exports
 *   Adequate range: reserves 100–150% of the ARA metric. A managed float is treated with the
 *   fixed-regime weights (conservative, as the IMF does for de facto pegs / heavily managed).
 * - Greenspan (1999) / Guidotti rule: usable reserves should cover 100% of short-term external
 *   debt (residual maturity ≤ 1y).
 * - Traditional import cover rule: ≥ 3 months of imports.
 *
 *   guidottiRatio     = usableReserves / shortTermDebt × 100
 *   importCoverMonths = usableReserves / monthlyImports
 *   reservesToM2      = usableReserves / broadMoneyUsd × 100
 *   imfAra            = w.exports × exports + w.broadMoney × M2 + w.shortTermDebt × STD
 *                       + w.otherLiabilities × otherLiabilities (default 0)
 *   imfAraPct         = usableReserves / imfAra × 100
 *
 * Every ratio with a 0 denominator is NaN. Never throws.
 */
import type { FxAdequacyInput, FxAdequacyResult } from './types'

export interface AraWeights {
  exports: number
  broadMoney: number
  shortTermDebt: number
  otherLiabilities: number
}

/** IMF ARA EM weights (2015 revision) by exchange-rate regime. */
export const IMF_ARA_WEIGHTS: Record<'float' | 'fixed', AraWeights> = {
  float: { exports: 0.05, broadMoney: 0.05, shortTermDebt: 0.3, otherLiabilities: 0.15 },
  fixed: { exports: 0.1, broadMoney: 0.1, shortTermDebt: 0.3, otherLiabilities: 0.2 },
}

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? NaN : numerator / denominator

export function computeFxAdequacy(
  input: FxAdequacyInput,
  weights: Record<'float' | 'fixed', AraWeights> = IMF_ARA_WEIGHTS,
): FxAdequacyResult {
  const w = input.regime === 'float' ? weights.float : weights.fixed
  const otherLiabilities = input.otherLiabilities ?? 0
  const imfAra =
    w.exports * input.annualExportsUsd +
    w.broadMoney * input.broadMoneyUsd +
    w.shortTermDebt * input.shortTermDebt +
    w.otherLiabilities * otherLiabilities

  return {
    guidottiRatio: ratio(input.usableReserves, input.shortTermDebt) * 100,
    importCoverMonths: ratio(input.usableReserves, input.monthlyImports),
    reservesToM2: ratio(input.usableReserves, input.broadMoneyUsd) * 100,
    imfAra,
    imfAraPct: ratio(input.usableReserves, imfAra) * 100,
  }
}
