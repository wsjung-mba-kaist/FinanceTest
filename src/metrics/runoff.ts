import type { BankState, DepositSegment } from '../engine/types/state'
import type { LcrInput } from './types'

/**
 * Deposit run-off dynamics (calibration rules, docs/authoring-guide.md §보정 규칙).
 *
 * Run state is derived from the confidence index (CI):
 *   S0 Calm ≥ 70 · S1 Concern 50–69 · S2 Open run 30–49 · S3 Collapse < 30
 * Outflow_t(seg) = Bal(seg) × min(cap, r_base(seg, state) × Π amplifiers × Π dampeners) × window
 *
 * Anchors: SVB 2023-03-09 $42bn ≈ 25% (DFPI order; Fed Barr review), 2023-03-10 ≈ $100bn/$123bn ≈ 80%;
 * Signature 2023-03-10 $18.6bn ≈ 20% (FDIC OIG); Credit Suisse 2023-03-15..17 CHF 13.2/17.1/10.1bn/day (FINMA);
 * WaMu 2008-09 $16.7bn over 9 days ≈ 1%/day; Northern Rock 2007-09 ≈ 20% of retail over 3 days.
 */
export type RunState = 0 | 1 | 2 | 3

export function runStateFromCi(ci: number): RunState {
  if (ci >= 70) return 0
  if (ci >= 50) return 1
  if (ci >= 30) return 2
  return 3
}

export const RUN_STATE_LABELS: Record<RunState, string> = {
  0: '평온(S0)',
  1: '우려(S1)',
  2: '공개 런(S2)',
  3: '붕괴(S3)',
}

export interface RunoffInput {
  segments: DepositSegment[]
  runState: RunState
  /** Product of active amplifiers (≥ 1). */
  amplifier: number
  /** Product of active dampeners (≤ 1). */
  dampener: number
  /** Fraction of the wire window covered by this turn (1 = full day). */
  windowFraction?: number
  /** Extra multiplier for network-coordinated segments (e.g. 1.5 when VC advice is circulating). */
  networkAmplifier?: number
}

export interface RunoffResult {
  total: number
  bySegment: { id: string; label: string; outflow: number; rate: number; remaining: number }[]
}

export function projectRunoff(input: RunoffInput): RunoffResult {
  const window = input.windowFraction ?? 1
  const bySegment = input.segments.map((seg) => {
    const base = seg.runoffByState[input.runState] ?? 0
    const netAmp = seg.networked ? input.amplifier * (input.networkAmplifier ?? 1) : input.amplifier
    let rate = base * netAmp * input.dampener
    if (seg.dailyCap !== undefined) rate = Math.min(seg.dailyCap, rate)
    rate = Math.min(1, Math.max(0, rate)) * window
    const outflow = Math.min(seg.balance, seg.balance * rate)
    return { id: seg.id, label: seg.label, outflow, rate, remaining: seg.balance - outflow }
  })
  return { total: bySegment.reduce((a, b) => a + b.outflow, 0), bySegment }
}

/** Basel-lens mapping from a bank state to LCR calculator inputs. */
export function lcrInputFromBank(bank: BankState): LcrInput {
  const unpledged = (mv: number, pledged?: number) => mv * (1 - (pledged ?? 0))
  const hqla = { l1: bank.cash, l2a: 0, l2b: 0 }
  for (const book of [bank.securities.afs, bank.securities.htm]) {
    const mv = unpledged(book.marketValue, book.pledgedShare)
    if (book.hqlaLevel === 'L1') hqla.l1 += mv
    else if (book.hqlaLevel === 'L2A') hqla.l2a += mv
    else if (book.hqlaLevel === 'L2B') hqla.l2b += mv
  }
  const outflows: LcrInput['outflows'] = {}
  for (const seg of bank.deposits) {
    outflows[seg.lcrCategory] = (outflows[seg.lcrCategory] ?? 0) + seg.balance
  }
  outflows.financialInstitution =
    (outflows.financialInstitution ?? 0) + bank.wholesale.unsecuredShort
  outflows.securedL1 = bank.wholesale.repoL1
  outflows.securedL2A = bank.wholesale.repoL2A
  outflows.securedOther = bank.wholesale.repoOther
  outflows.committedCredit = bank.committed.creditToCorporates
  // The state has no bank/non-bank split. Conservatively treat this aggregate as liquidity
  // facilities to non-bank FIs (LCR40.64(6), 100%), not non-financial corporates (30%).
  outflows.committedLiquidityToNonBankFIs = bank.committed.liquidityToFIs
  const inflows: LcrInput['inflows'] = {
    // stylised: 1/12 of performing loans mature within 30 days
    corporate: (bank.loans.corporate + bank.loans.sme) / 12,
    retail: bank.loans.retail / 12,
    financialInstitution: bank.loans.fi / 12,
  }
  return { hqla, outflows, inflows }
}

export function totalDeposits(bank: BankState): number {
  return bank.deposits.reduce((a, s) => a + s.balance, 0)
}

export function uninsuredDeposits(bank: BankState): number {
  return bank.deposits.filter((s) => !s.insured).reduce((a, s) => a + s.balance, 0)
}
