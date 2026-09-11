/**
 * Leveraged LDI fund margin / collateral mechanics (UK gilt crisis, Sep–Oct 2022).
 *
 * Sources
 * - Bank of England, Financial Stability Report, December 2022 — "LDI funds and the gilt
 *   market dysfunction" (section 5 / box on the September 2022 LDI stress).
 * - BoE Financial Policy Committee, March 2023 — recommendation that LDI funds hold resilience
 *   to at least a 250bp yield shock (steady-state minimum).
 * - The Pensions Regulator, "Using leveraged liquidity-driven investment" guidance (Apr 2023):
 *   250bp standard, operational buffer on top.
 *
 *   leverage         = exposure / equity                          (NaN when equity is 0)
 *   pv01             = exposure × modDuration / 10 000             (loss per +1bp)
 *   bufferBp         = collateral / pv01                           (NaN when pv01 is 0)
 *   loss             = pv01 × deltaYieldBp                         (positive for a yield rise)
 *   marginCall       = loss                                        (negative = collateral returned)
 *   shortfall        = max(0, loss − collateral)
 *   postMoveLeverage = exposure / (equity − loss)                  (Infinity when equity ≤ loss)
 *   recapNeeded      = shortfall
 *
 * Never throws.
 */
import type { LdiMarginInput, LdiMarginResult } from './types'

/** Minimum yield-shock resilience (bp) per BoE FPC March 2023 / TPR April 2023 guidance. */
export const LDI_STANDARD_BUFFER_BP = 250

export function computeLdiMargin(input: LdiMarginInput): LdiMarginResult {
  const { exposure, equity, modDuration, collateral, deltaYieldBp } = input
  const leverage = equity === 0 ? NaN : exposure / equity
  const pv01 = (exposure * modDuration) / 10_000
  const bufferBp = pv01 === 0 ? NaN : collateral / pv01
  const loss = pv01 * deltaYieldBp
  const shortfall = Math.max(0, loss - collateral)
  const equityAfter = equity - loss
  const postMoveLeverage = equityAfter <= 0 ? Infinity : exposure / equityAfter

  return {
    leverage,
    pv01,
    bufferBp,
    loss,
    marginCall: loss,
    shortfall,
    postMoveLeverage,
    recapNeeded: shortfall,
  }
}
