import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import type { BankState, GameState } from '../engine/types'
import svb from '../scenarios/svb-2023/scenario'
import { computeMetricsFor } from './byInstitution'
import { computeCapital } from './capital'
import { BCBS_LCR_PARAMS, computeLcr, KR_LCR_PARAMS } from './lcr'
import { lcrInputFromBank, totalDeposits, uninsuredDeposits } from './runoff'
import { mergeThresholds } from './thresholds'

/**
 * The registry is where calculator outputs become the numbers on screen. Each row is checked
 * against the calculator it wraps, so a wiring slip (the wrong field, a stale counter key) cannot
 * hide behind a plausible-looking value.
 */
function bankState(): GameState<BankState> {
  return createGame(svb, 1, { variance: 0 })
}

function rows(state: GameState<BankState>) {
  return computeMetricsFor(state as GameState, mergeThresholds(svb.thresholds)).metrics
}

describe('bank rows', () => {
  it('LCR, HQLA and capital rows equal the calculators they wrap', () => {
    const s = bankState()
    const b = s.institution
    const m = rows(s)
    const lcr = computeLcr(lcrInputFromBank(b), BCBS_LCR_PARAMS)
    expect(m.lcr!.value).toBeCloseTo(lcr.lcr, 9)
    expect(m.hqla!.value).toBeCloseTo(lcr.hqla, 9)
    const afsLoss = b.securities.afs.bookValue - b.securities.afs.marketValue
    const htmLoss = b.securities.htm.bookValue - b.securities.htm.marketValue
    const cap = computeCapital({
      cet1: b.capital.cet1,
      at1: b.capital.at1,
      tier2: b.capital.tier2,
      rwa: b.rwa,
      leverageExposure: b.leverageExposure,
      aociInCet1: b.capital.aociInCet1,
      unrealizedAfsLoss: afsLoss,
      unrealizedHtmLoss: htmLoss,
    })
    expect(m.cet1Ratio!.value).toBeCloseTo(cap.cet1Ratio, 9)
    expect(m.economicTce!.value).toBeCloseTo(cap.economicTceRatio, 9)
    expect(m.unrealizedLoss!.value).toBeCloseTo(afsLoss + htmLoss, 9)
    expect(m.deposits!.value).toBeCloseTo(totalDeposits(b), 9)
    expect(m.uninsuredShare!.value).toBeCloseTo((uninsuredDeposits(b) / totalDeposits(b)) * 100, 9)
  })

  it('outflow percentages are against the deposits at the start of the run, not the shrinking base', () => {
    const s = produce(bankState(), (d) => {
      d.counters.startDeposits = 200
      d.counters.lastOutflow = 10
      d.counters.cumulativeOutflow = 50
    })
    const m = rows(s)
    expect(m.dailyOutflowPct!.value).toBeCloseTo(5, 9)
    expect(m.cumulativeOutflowPct!.value).toBeCloseTo(25, 9)
    expect(m.cumulativeOutflow!.value).toBe(50)
  })

  it("a metric without a band reports 'na', and a custom figure appears as its own row", () => {
    const s = produce(bankState(), (d) => {
      d.institution.custom.minimumCash = 2
    })
    const m = rows(s)
    expect(m.cumulativeOutflow!.status).toBe('na')
    expect(m.minimumCash!.value).toBe(2)
  })

  it('KR_LCR_PARAMS is identical to BCBS_LCR_PARAMS — the `useKrLcr` switch is a documented no-op', () => {
    // Korea's stable-deposit run-off is the Basel default 5%; the switch exists so a future
    // divergence has somewhere to go. Until then a difference here is an unexplained change.
    expect(KR_LCR_PARAMS).toEqual(BCBS_LCR_PARAMS)
    const s = produce(bankState(), (d) => {
      d.counters.useKrLcr = 1
    })
    expect(rows(s).lcr!.value).toBeCloseTo(rows(bankState()).lcr!.value, 9)
  })
})
