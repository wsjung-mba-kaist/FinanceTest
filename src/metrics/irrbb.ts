/**
 * Interest rate risk in the banking book (IRRBB) — ΔEVE under parallel shocks and the
 * supervisory outlier test.
 *
 * Sources
 * - BCBS d368, "Interest rate risk in the banking book" (Apr 2016): Principle 12 and paras
 *   99–100 (outlier test: ΔEVE loss > 15% of Tier 1 capital), Annex 2 (shock scenarios;
 *   parallel up / down are the first two of the six).
 * - Basel Framework SRP31.12–31.14 (supervisory outlier / materiality test).
 * - BCBS "Principles for the management and supervision of interest rate risk" (Jul 2004):
 *   the original ±200bp parallel shock, kept here as the default scenario set.
 *
 * Duration-gap approximation, one bucket at a time:
 *   ΔEVE(shock) = Σ_buckets −(assets − liabilities) × midDurationYears × Δy,  Δy = bp / 10 000
 *   worstDeltaEve = min over shocks (most negative = largest loss; may be positive when every
 *                   shock is a gain)
 *   worstPctTier1 = −worstDeltaEve / tier1 × 100 (NaN when tier1 is 0)
 *   outlier       = worstPctTier1 > 15
 *
 * `deltaEve` is keyed by the signed shock in bp, e.g. '+200' / '-200' (see `irrbbShockKey`).
 * An empty shock list yields worstDeltaEve 0. Never throws.
 */
import type { IrrbbInput, IrrbbResult } from './types'

/** Default parallel shocks in bp (BCBS 2004 / d368 Annex 2 parallel up and down). */
export const IRRBB_DEFAULT_SHOCKS_BP: readonly number[] = [200, -200]

/** Outlier threshold: ΔEVE loss as a percentage of Tier 1 (BCBS d368 para 99). */
export const IRRBB_OUTLIER_PCT_TIER1 = 15

/** Key used in `IrrbbResult.deltaEve` for a shock, e.g. 200 → '+200', -200 → '-200'. */
export const irrbbShockKey = (bp: number): string => (bp < 0 ? `${bp}` : `+${bp}`)

export function computeIrrbb(input: IrrbbInput): IrrbbResult {
  const shocks = input.shocksBp ?? IRRBB_DEFAULT_SHOCKS_BP
  const durationGap = input.buckets.reduce(
    (sum, b) => sum + (b.assets - b.liabilities) * b.midDurationYears,
    0,
  )

  const deltaEve: Record<string, number> = {}
  for (const bp of shocks) deltaEve[irrbbShockKey(bp)] = 0 - durationGap * (bp / 10_000)

  const values = Object.values(deltaEve)
  const worstDeltaEve = values.length === 0 ? 0 : Math.min(...values)
  const worstPctTier1 = input.tier1 === 0 ? NaN : ((0 - worstDeltaEve) / input.tier1) * 100

  return {
    deltaEve,
    worstDeltaEve,
    worstPctTier1,
    outlier: worstPctTier1 > IRRBB_OUTLIER_PCT_TIER1,
  }
}
