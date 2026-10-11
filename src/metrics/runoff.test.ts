import { describe, expect, it } from 'vitest'
import type { DepositSegment } from '../engine/types/state'
import { svbInitialBank } from '../scenarios/svb-2023/initialState'
import { lcrInputFromBank, projectRunoff, runStateFromCi, totalDeposits } from './runoff'

/**
 * Reference cases for the run-off model. The other calculators in this directory each carry a
 * cited case; the run-off table did not, although the file header names its anchors. Those
 * anchors are reproduced here against the SVB T0 book the table was calibrated on:
 *
 * - 2023-03-09: $42bn withdrawn ≈ 25% of deposits (DFPI order 2023-03-10; Fed Barr review 2023-04)
 * - 2023-03-10: ≈ $100bn requested of ≈ $123bn remaining ≈ 80% (Barr review)
 *
 * The T0 book (after the −8 trend outflow at T1 entry) holds 173; S2 with no amplifiers projects
 * 26.0% and S3 81.2%. A calibration change that moves either outside its anchor band fails here,
 * not three turns into the scenario test.
 */
const seg = (p: Partial<DepositSegment> & { id: string; balance: number }): DepositSegment => ({
  label: p.id,
  insured: false,
  runoffByState: [0, 0.02, 0.2, 0.8],
  lcrCategory: 'corporateUninsured',
  ...p,
})

describe('runStateFromCi', () => {
  it('maps the confidence index to the four documented bands (70 / 50 / 30)', () => {
    expect(runStateFromCi(100)).toBe(0)
    expect(runStateFromCi(70)).toBe(0)
    expect(runStateFromCi(69.9)).toBe(1)
    expect(runStateFromCi(50)).toBe(1)
    expect(runStateFromCi(49.9)).toBe(2)
    expect(runStateFromCi(30)).toBe(2)
    expect(runStateFromCi(29.9)).toBe(3)
    expect(runStateFromCi(0)).toBe(3)
  })
})

describe('projectRunoff — SVB anchors', () => {
  const book = svbInitialBank.deposits
  const total = totalDeposits(svbInitialBank)

  it('reference: open run (S2), no amplifiers ≈ 25% — the 3/9 day ($42bn)', () => {
    const r = projectRunoff({ segments: book, runState: 2, amplifier: 1, dampener: 1 })
    const pct = (r.total / total) * 100
    expect(pct).toBeGreaterThan(22)
    expect(pct).toBeLessThan(29)
  })

  it('reference: collapse (S3), no amplifiers ≈ 80% — the 3/10 day (~$100bn of ~$123bn)', () => {
    const r = projectRunoff({ segments: book, runState: 3, amplifier: 1, dampener: 1 })
    const pct = (r.total / total) * 100
    expect(pct).toBeGreaterThan(75)
    expect(pct).toBeLessThan(86)
  })

  it('calm (S0) loses well under 1% a day; concern (S1) low single digits', () => {
    const s0 = projectRunoff({ segments: book, runState: 0, amplifier: 1, dampener: 1 })
    const s1 = projectRunoff({ segments: book, runState: 1, amplifier: 1, dampener: 1 })
    expect((s0.total / total) * 100).toBeLessThan(1)
    expect((s1.total / total) * 100).toBeGreaterThan(1)
    expect((s1.total / total) * 100).toBeLessThan(5)
  })
})

describe('projectRunoff — mechanics', () => {
  it('rate = base × amplifier × dampener, applied to the balance', () => {
    const r = projectRunoff({
      segments: [seg({ id: 'a', balance: 100 })],
      runState: 2,
      amplifier: 1.5,
      dampener: 0.5,
    })
    expect(r.bySegment[0]!.rate).toBeCloseTo(0.2 * 1.5 * 0.5, 12)
    expect(r.total).toBeCloseTo(15, 12)
    expect(r.bySegment[0]!.remaining).toBeCloseTo(85, 12)
  })

  it('the network amplifier reaches networked segments only', () => {
    const r = projectRunoff({
      segments: [
        seg({ id: 'vc', balance: 100, networked: true }),
        seg({ id: 'corp', balance: 100 }),
      ],
      runState: 2,
      amplifier: 1,
      dampener: 1,
      networkAmplifier: 1.5,
    })
    expect(r.bySegment[0]!.rate).toBeCloseTo(0.3, 12)
    expect(r.bySegment[1]!.rate).toBeCloseTo(0.2, 12)
  })

  it('a daily cap binds before the window fraction; the rate never exceeds 1 or the balance', () => {
    const capped = projectRunoff({
      segments: [seg({ id: 'r', balance: 100, dailyCap: 0.1 })],
      runState: 3,
      amplifier: 3,
      dampener: 1,
      windowFraction: 0.5,
    })
    expect(capped.bySegment[0]!.rate).toBeCloseTo(0.05, 12)
    const over = projectRunoff({
      segments: [seg({ id: 'u', balance: 100 })],
      runState: 3,
      amplifier: 10,
      dampener: 1,
    })
    expect(over.bySegment[0]!.rate).toBe(1)
    expect(over.total).toBe(100)
  })

  it('a window fraction prorates the day', () => {
    const full = projectRunoff({ segments: book(), runState: 2, amplifier: 1, dampener: 1 })
    const half = projectRunoff({
      segments: book(),
      runState: 2,
      amplifier: 1,
      dampener: 1,
      windowFraction: 0.5,
    })
    expect(half.total).toBeCloseTo(full.total / 2, 12)
    function book() {
      return [seg({ id: 'a', balance: 100 }), seg({ id: 'b', balance: 50 })]
    }
  })
})

describe('lcrInputFromBank', () => {
  it('maps deposits by LCR category and wholesale lines to the Basel buckets', () => {
    const input = lcrInputFromBank(svbInitialBank)
    const byCat: Record<string, number> = {}
    for (const s of svbInitialBank.deposits)
      byCat[s.lcrCategory] = (byCat[s.lcrCategory] ?? 0) + s.balance
    for (const [cat, bal] of Object.entries(byCat))
      if (cat !== 'financialInstitution') expect(input.outflows[cat as never]).toBeCloseTo(bal, 9)
    expect(input.outflows.committedCredit).toBe(svbInitialBank.committed.creditToCorporates)
    expect(input.outflows.committedLiquidityToNonBankFIs).toBe(
      svbInitialBank.committed.liquidityToFIs,
    )
    // HQLA: cash is L1; the books land in their declared level net of pledged share.
    expect(input.hqla.l1).toBeCloseTo(
      svbInitialBank.cash + svbInitialBank.securities.afs.marketValue,
      9,
    )
    expect(input.hqla.l2a).toBeCloseTo(svbInitialBank.securities.htm.marketValue, 9)
  })
})
