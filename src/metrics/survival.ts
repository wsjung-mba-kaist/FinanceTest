/**
 * Survival horizon (days) — contingency funding plan practice
 * (BCBS 144 "Principles for Sound Liquidity Risk Management and Supervision", 2008, Principle 11).
 *
 * survivalDays = (cash + same-day secured capacity) / projected daily net outflow.
 * Pending capacity (collateral in transit) is reported separately and NOT counted.
 */
export interface SurvivalInput {
  cash: number
  sameDayCapacity: number
  projectedDailyOutflow: number
  /** Minimum operating cash the institution cannot run below (e.g. reserve requirement). */
  minimumCash?: number
}

export interface SurvivalResult {
  available: number
  survivalDays: number
}

export const SURVIVAL_CAP = 99

export function computeSurvival(input: SurvivalInput): SurvivalResult {
  const available =
    Math.max(0, input.cash - (input.minimumCash ?? 0)) + Math.max(0, input.sameDayCapacity)
  if (input.projectedDailyOutflow <= 0) return { available, survivalDays: SURVIVAL_CAP }
  return {
    available,
    survivalDays: Math.min(SURVIVAL_CAP, available / input.projectedDailyOutflow),
  }
}
