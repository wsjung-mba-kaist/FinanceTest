/**
 * Prime-broker exposure to a concentrated client — Archegos-style liquidation risk.
 *
 * Sources
 * - Credit Suisse Group AG, "Report on Archegos Capital Management" by the Special Committee
 *   of the Board (Paul, Weiss, Rifkind, Wharton & Garrison LLP, 29 Jul 2021): margin,
 *   concentration and liquidation-horizon failures (potential exposure vs. days to liquidate
 *   at a share of ADV).
 * - Parametric liquidation VaR with square-root-of-time scaling (e.g. Jorion, "Value at
 *   Risk", 3rd ed., ch. 5 / ch. 13 liquidity-adjusted VaR).
 *
 * Per position (notional and ADV in the same currency unit; |notional| for shorts):
 *   daysToLiquidate = |notional| / (advNotional × participation)   (NaN when ADV × rate is 0)
 *   var             = z × dailyVolPct × √daysToLiquidate × |notional|
 * Totals:
 *   grossNotional     = Σ |notional|
 *   daysToLiquidate   = max over positions (0 when there are none; NaN if any position is NaN)
 *   liquidationVaR    = Σ var (conservative — no diversification benefit)
 *   shortfall         = max(0, liquidationVaR − marginPosted)
 *   marginCoverage    = marginPosted / liquidationVaR × 100 (NaN when VaR is 0)
 *   concentrationFlag = any position needs more than `concentrationDays` (10) days
 *
 * Defaults: participation 0.2 (20% of ADV), z 2.33 (one-sided 99%). Never throws.
 */
import type { PbExposureInput, PbExposureResult } from './types'

export const PB_EXPOSURE_DEFAULTS = {
  participation: 0.2,
  z: 2.33,
  concentrationDays: 10,
} as const

export function computePbExposure(input: PbExposureInput): PbExposureResult {
  const participation = input.participation ?? PB_EXPOSURE_DEFAULTS.participation
  const z = input.z ?? PB_EXPOSURE_DEFAULTS.z

  const perPosition = input.positions.map((p) => {
    const notional = Math.abs(p.notional)
    const dailyCapacity = p.advNotional * participation
    const daysToLiquidate = dailyCapacity === 0 ? NaN : notional / dailyCapacity
    return {
      ticker: p.ticker,
      daysToLiquidate,
      var: z * p.dailyVolPct * Math.sqrt(daysToLiquidate) * notional,
    }
  })

  const grossNotional = input.positions.reduce((sum, p) => sum + Math.abs(p.notional), 0)
  const daysToLiquidate =
    perPosition.length === 0 ? 0 : Math.max(...perPosition.map((p) => p.daysToLiquidate))
  const liquidationVaR = perPosition.reduce((sum, p) => sum + p.var, 0)
  const shortfall = Math.max(0, liquidationVaR - input.marginPosted)
  const marginCoverage = liquidationVaR === 0 ? NaN : (input.marginPosted / liquidationVaR) * 100
  const concentrationFlag = perPosition.some(
    (p) => p.daysToLiquidate > PB_EXPOSURE_DEFAULTS.concentrationDays,
  )

  return {
    grossNotional,
    daysToLiquidate,
    liquidationVaR,
    shortfall,
    marginCoverage,
    concentrationFlag,
    perPosition,
  }
}
