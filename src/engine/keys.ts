/**
 * The counter and flag keys that more than one layer agrees on.
 *
 * `state.counters` and `state.flags` are string-keyed bags. That is right for a scenario's own
 * bookkeeping (`drainMultiplier`, `consentAccrued`, …), which only that scenario's `fx.ts`,
 * conditions and scoring read. It is wrong for the keys the **engine writes and the metrics
 * registry reads** — or the other way round — because a typo on either side compiles, reads back
 * as `undefined`, and `?? 0` / `|| 1` turns it into a plausible number. Three layers sharing an
 * implicit protocol need an explicit one.
 *
 * Every key here names who writes it and who reads it. `tests/engine/counterKeys.test.ts` checks
 * that every `counters.<key>` / `flags.<key>` the shared layers (engine, metrics, lib) touch is
 * listed, and that every listed key is still used somewhere — so this file can neither drift
 * behind the code nor collect dead entries. Scenario-local keys are not listed and not checked.
 */
export const COUNTER = {
  // --- deposit run dynamics (written by bankFx, read by metrics/byInstitution)
  /** Product of one-period run amplifiers; reset to 1 at the end of each run-off window. */
  amplifier: 'amplifier',
  /** Persistent run dampener (≤ 1, floored at 0.3). */
  dampener: 'dampener',
  /** Extra multiplier on networked deposit segments; reset each window. */
  networkAmplifier: 'networkAmplifier',
  /** Deposits at the start of the run — the denominator of every outflow percentage. */
  startDeposits: 'startDeposits',
  /** Outflow of the current window (accumulates across the window's ticks). */
  lastOutflow: 'lastOutflow',
  /** Lifetime outflow. */
  cumulativeOutflow: 'cumulativeOutflow',
  /** Negative settlement balance after the last run-off step (0 when cash covered it). */
  settlementShortfall: 'settlementShortfall',
  // --- capital and sales (bankFx / securitiesFx → scoring)
  realizedLoss: 'realizedLoss',
  htmTaintLoss: 'htmTaintLoss',
  dilution: 'dilution',
  // --- funding (bankFx / securitiesFx → lib/fundingSchedule, scoring)
  fundingDrawn: 'fundingDrawn',
  fundingCostBp: 'fundingCostBp',
  /** Set to 1 by a scenario to pick the Korean LCR parameter set in the registry. */
  useKrLcr: 'useKrLcr',
  // --- play bookkeeping (core/applyDecision → scoring, debrief)
  hintPenalty: 'hintPenalty',
  hintsUsed: 'hintsUsed',
  timeouts: 'timeouts',
  // --- pension / LDI (pensionFx → scoring)
  fireSaleLoss: 'fireSaleLoss',
  giltsSold: 'giltsSold',
  sponsorCash: 'sponsorCash',
  hedgeCut: 'hedgeCut',
  forcedDeleverage: 'forcedDeleverage',
  // --- securities (securitiesFx → metrics/byInstitution, scoring)
  abcpBought: 'abcpBought',
  abcpDefaulted: 'abcpDefaulted',
  lastRolloverFailed: 'lastRolloverFailed',
  cumulativeRolloverFailed: 'cumulativeRolloverFailed',
  marginPaid: 'marginPaid',
  /** Written by the ELS scenario, read by lib/fundingSchedule as "settlement pending". */
  bokRpPending: 'bokRpPending',
  bokSwapPending: 'bokSwapPending',
} as const

export type KnownCounter = keyof typeof COUNTER

export const FLAG = {
  /** bankFx.raiseEquity outcome. */
  raise_closed: 'raise_closed',
  raise_failed: 'raise_failed',
  /** A scenario sets it so the run amplifier is not reset at the end of the window. */
  persistentAmplifier: 'persistentAmplifier',
  /** pensionFx.forcedDeleverage fired. */
  forced_deleverage: 'forced_deleverage',
  /** securitiesFx.rolloverStep refused the purchase commitment. */
  abcp_default: 'abcp_default',
  /** Written by the ELS scenario, read by lib/fundingSchedule. */
  april_refinance_planned: 'april_refinance_planned',
} as const

export type KnownFlag = keyof typeof FLAG
