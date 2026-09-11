/**
 * Bond price change from a parallel yield move — duration / convexity approximation.
 *
 * Source: second-order Taylor expansion of price in yield, e.g. Tuckman & Serrat, "Fixed Income
 * Securities" (3rd ed.), ch. 4; Fabozzi, "Bond Markets, Analysis and Strategies", duration and
 * convexity chapters. Used for the SVB (Mar 2023) AFS / HTM mark-to-market arithmetic.
 *
 *   Δy        = deltaYieldBp / 10 000
 *   ΔP/P      ≈ −D_mod × Δy + ½ × C × Δy²
 *   pnl       = ΔP/P × marketValue
 *   pctChange = ΔP/P × 100
 *
 * Convexity defaults to 0 (pure duration). pctChange is derived from the return itself (no
 * division by market value), so it is well defined when marketValue is 0 (pnl is then 0).
 * Never throws.
 */
import type { BondPnlInput, BondPnlResult } from './types'

export function computeBondPnl(input: BondPnlInput): BondPnlResult {
  const { marketValue, modDuration, deltaYieldBp } = input
  const convexity = input.convexity ?? 0
  const dy = deltaYieldBp / 10_000
  const pctReturn = 0 - modDuration * dy + 0.5 * convexity * dy * dy
  return { pnl: pctReturn * marketValue, pctChange: pctReturn * 100 }
}
