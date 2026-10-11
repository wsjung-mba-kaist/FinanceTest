import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type { BankState, Effect, GameState } from '@/engine'
import { createGame } from '@/engine'
import { EMPTY_SNAPSHOT, applyEffects, makeEffectContext } from '@/engine/core/effects'
import { bankFx } from '@/engine/fx/bank'
import { miniBank } from '../../fixtures/miniBank'

/**
 * 효과 빌더는 작은 회계 전표다 — 차변과 대변이 맞아야 한다. 이 파일은 시나리오를 거치지 않고
 * 빌더 하나를 상태에 직접 적용해 계정 사이의 항등식을 단언한다. HTM tainting이 잔여 HTM 시가
 * 전체를 "미실현손실"로 둔갑시키던 산술(한 계정만 움직인 전표)이 시나리오 경로 테스트를 전부
 * 통과한 채 살아남았던 것이 이 파일이 생긴 이유다.
 */
function apply(state: GameState<BankState>, effect: Effect<BankState>): GameState<BankState> {
  return produce(state, (d) => {
    applyEffects(d, [effect], makeEffectContext(d, EMPTY_SNAPSHOT))
  })
}

const unrealized = (b: BankState) =>
  b.securities.afs.bookValue -
  b.securities.afs.marketValue +
  (b.securities.htm.bookValue - b.securities.htm.marketValue)

function fresh(): GameState<BankState> {
  return createGame(miniBank, 1, { variance: 0 })
}

describe('bankFx.sellSecurities', () => {
  it('AFS sale: cash rises by the proceeds, CET1 falls by the after-tax loss, HTM untouched', () => {
    const before = fresh()
    const b0 = before.institution
    const after = apply(before, bankFx.sellSecurities({ book: 'afs', fraction: 0.5 }))
    const b1 = after.institution

    const amount = b0.securities.afs.marketValue * 0.5
    const bookSold = b0.securities.afs.bookValue * 0.5
    const proceeds = b1.cash - b0.cash
    expect(proceeds).toBeGreaterThan(0)
    expect(proceeds).toBeLessThanOrEqual(amount)
    // 전표: 매각 장부가가 빠지고 대금이 들어온다; 그 차이가 세전 손실이다.
    const preTaxLoss = bookSold - proceeds
    expect(b0.capital.cet1 - b1.capital.cet1).toBeCloseTo(preTaxLoss * (1 - b0.taxRate), 9)
    expect(after.counters.realizedLoss).toBeCloseTo(preTaxLoss * (1 - b0.taxRate), 9)
    expect(b1.securities.afs.marketValue).toBeCloseTo(b0.securities.afs.marketValue - amount, 9)
    expect(b1.securities.afs.bookValue).toBeCloseTo(b0.securities.afs.bookValue - bookSold, 9)
    expect(b1.securities.htm).toEqual(b0.securities.htm)
    expect(b1.htmTainted).toBe(false)
  })

  it('HTM sale taints: the remaining book moves to AFS at carrying amount, loss stays visible once', () => {
    const before = fresh()
    const b0 = before.institution
    const share = 0.3
    const after = apply(before, bankFx.sellSecurities({ book: 'htm', fraction: share }))
    const b1 = after.institution

    expect(b1.htmTainted).toBe(true)
    // 재분류 뒤 HTM은 비어 있다 — 장부가가 남아 "장부가 − 0"이 손실로 읽히는 일이 없어야 한다.
    expect(b1.securities.htm.bookValue).toBe(0)
    expect(b1.securities.htm.marketValue).toBe(0)

    const htmLoss0 = b0.securities.htm.bookValue - b0.securities.htm.marketValue
    const remainingLoss = htmLoss0 * (1 - share)
    // 항등식 1: 두 장부의 장부가 합은 매각분만큼만 줄어든다 (시가가 장부가로 둔갑하지 않는다).
    expect(b1.securities.afs.bookValue + b1.securities.htm.bookValue).toBeCloseTo(
      b0.securities.afs.bookValue + b0.securities.htm.bookValue * (1 - share),
      9,
    )
    // 항등식 2: 두 장부의 시가 합도 매각분만큼만 줄어든다.
    expect(b1.securities.afs.marketValue + b1.securities.htm.marketValue).toBeCloseTo(
      b0.securities.afs.marketValue + b0.securities.htm.marketValue * (1 - share),
      9,
    )
    // 항등식 3: 미실현손실 총액 = AFS 기존 손실 + 잔여 HTM 손실. 두 번 세지도, 사라지지도 않는다.
    expect(unrealized(b1)).toBeCloseTo(
      b0.securities.afs.bookValue - b0.securities.afs.marketValue + remainingLoss,
      9,
    )
    expect(after.counters.htmTaintLoss).toBeCloseTo(remainingLoss, 9)
    // 병합 장부의 듀레이션은 시가 가중 평균이다.
    const afsMv = b0.securities.afs.marketValue
    const htmMv = b0.securities.htm.marketValue * (1 - share)
    expect(b1.securities.afs.modDuration).toBeCloseTo(
      (b0.securities.afs.modDuration * afsMv + b0.securities.htm.modDuration * htmMv) /
        (afsMv + htmMv),
      9,
    )
    // 보수적 병합: 두 장부 중 낮은 HQLA 등급을 따른다.
    expect(b1.securities.afs.hqlaLevel).toBe('L2A')
    // AOCI 옵트아웃 은행: 잔여 손실은 AOCI에 머물고 CET1은 매각 손실만큼만 줄어든다.
    expect(b0.capital.aociInCet1).toBe(false)
    expect(b0.capital.cet1 - b1.capital.cet1).toBeCloseTo(after.counters.realizedLoss!, 9)
  })

  it('HTM sale at a bank that keeps AOCI in CET1 also charges the remaining loss to CET1', () => {
    const before = produce(fresh(), (d) => {
      d.institution.capital.aociInCet1 = true
    })
    const b0 = before.institution
    const after = apply(before, bankFx.sellSecurities({ book: 'htm', fraction: 0.3 }))
    const b1 = after.institution
    const remainingLoss = (b0.securities.htm.bookValue - b0.securities.htm.marketValue) * 0.7
    expect(b0.capital.cet1 - b1.capital.cet1).toBeCloseTo(
      after.counters.realizedLoss! + remainingLoss * (1 - b0.taxRate),
      9,
    )
  })

  it('a second HTM sale after tainting is a no-op (the book is already AFS)', () => {
    const once = apply(fresh(), bankFx.sellSecurities({ book: 'htm', fraction: 0.3 }))
    const twice = apply(once, bankFx.sellSecurities({ book: 'htm', fraction: 0.5 }))
    expect(twice.institution).toEqual(once.institution)
  })
})

describe('bankFx funding and capital', () => {
  it('drawFacility is clamped to capacity and moves it into advances and cash', () => {
    const s0 = fresh()
    const s1 = apply(s0, bankFx.drawFacility({ amount: 999, source: 'FHLB', rateBp: 520 }))
    const cap = s0.institution.wholesale.cbFacilityCapacity
    expect(s1.institution.wholesale.cbFacilityCapacity).toBe(0)
    expect(s1.institution.wholesale.cbAdvances).toBe(s0.institution.wholesale.cbAdvances + cap)
    expect(s1.institution.cash).toBe(s0.institution.cash + cap)
    expect(s1.counters.fundingDrawn).toBe(cap)
    expect(s1.counters.fundingCostBp).toBe(520)
  })

  it('pledged collateral arrives same-day or next turn, and settlePendingCapacity moves it', () => {
    const s0 = fresh()
    const s1 = apply(s0, bankFx.pledgeCollateral({ immediate: 5, pending: 7 }))
    expect(s1.institution.wholesale.cbFacilityCapacity).toBe(
      s0.institution.wholesale.cbFacilityCapacity + 5,
    )
    expect(s1.institution.wholesale.cbFacilityPending).toBe(7)
    const s2 = apply(s1, bankFx.settlePendingCapacity())
    expect(s2.institution.wholesale.cbFacilityCapacity).toBe(
      s0.institution.wholesale.cbFacilityCapacity + 12,
    )
    expect(s2.institution.wholesale.cbFacilityPending).toBe(0)
  })

  it('a backstopped raise adds the amount to CET1, cash and exposure and dampens the run', () => {
    const s0 = fresh()
    const s1 = apply(
      s0,
      bankFx.raiseEquity({ amount: 2, backstopPct: 100, discount: 0.1, marketCap: 10 }),
    )
    expect(s1.institution.capital.cet1).toBe(s0.institution.capital.cet1 + 2)
    expect(s1.institution.cash).toBe(s0.institution.cash + 2)
    expect(s1.institution.leverageExposure).toBe(s0.institution.leverageExposure + 2)
    expect(s1.counters.dilution).toBeCloseTo(2 / (10 * 0.9 + 2), 9)
    expect(s1.flags.raise_closed).toBe(true)
    expect(s1.counters.dampener).toBeCloseTo(0.7, 9)
  })

  it('an unbackstopped raise into low confidence fails: no capital, amplifier ×2, CI −25', () => {
    const s0 = produce(fresh(), (d) => {
      d.confidence.index = 40
    })
    const s1 = apply(
      s0,
      bankFx.raiseEquity({ amount: 2, backstopPct: 0, discount: 0.1, marketCap: 10 }),
    )
    expect(s1.institution.capital.cet1).toBe(s0.institution.capital.cet1)
    expect(s1.institution.cash).toBe(s0.institution.cash)
    expect(s1.flags.raise_failed).toBe(true)
    expect(s1.counters.amplifier).toBe(2)
    expect(s1.confidence.index).toBe(15)
  })
})

describe('bankFx run-off and market moves', () => {
  it('runoffStep pays the outflow from cash and books it in both counters', () => {
    const s0 = fresh()
    const deposits = (b: BankState) => b.deposits.reduce((a, s) => a + s.balance, 0)
    const s1 = apply(s0, bankFx.runoffStep({}))
    const out = deposits(s0.institution) - deposits(s1.institution)
    expect(out).toBeGreaterThan(0)
    expect(s0.institution.cash - s1.institution.cash).toBeCloseTo(out, 9)
    expect(s1.counters.lastOutflow).toBeCloseTo(out, 9)
    expect(s1.counters.cumulativeOutflow).toBeCloseTo(out, 9)
    expect(s1.counters.startDeposits).toBeCloseTo(deposits(s0.institution), 9)
    // A one-period amplifier is spent by the step; the dampener persists.
    const amped = apply(s0, bankFx.addAmplifier(2))
    expect(amped.counters.amplifier).toBe(2)
    const after = apply(amped, bankFx.runoffStep({}))
    expect(after.counters.amplifier).toBe(1)
    expect(deposits(amped.institution) - deposits(after.institution)).toBeGreaterThan(out)
  })

  it('a shortfall is recorded when the outflow exceeds cash — facilities are not drawn by themselves', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.cash = 1
      d.confidence.index = 10
    })
    const s1 = apply(s0, bankFx.runoffStep({}))
    expect(s1.institution.cash).toBeLessThan(0)
    expect(s1.counters.settlementShortfall).toBeCloseTo(-s1.institution.cash, 9)
    expect(s1.institution.wholesale.cbFacilityCapacity).toBe(
      s0.institution.wholesale.cbFacilityCapacity,
    )
  })

  it('rateShock marks both books by −D·Δy·MV', () => {
    const s0 = fresh()
    const s1 = apply(s0, bankFx.rateShock({ deltaBp: 50 }))
    for (const book of ['afs', 'htm'] as const) {
      const b0 = s0.institution.securities[book]
      expect(s1.institution.securities[book].marketValue).toBeCloseTo(
        b0.marketValue * (1 - b0.modDuration * 0.005),
        9,
      )
      expect(s1.institution.securities[book].bookValue).toBe(b0.bookValue)
    }
  })

  it('insuredSweep conserves total deposits while moving a share to the insured segment', () => {
    const s0 = fresh()
    const s1 = apply(s0, bankFx.insuredSweep({ share: 0.2 }))
    const total = (b: BankState) => b.deposits.reduce((a, s) => a + s.balance, 0)
    expect(total(s1.institution)).toBeCloseTo(total(s0.institution), 9)
    const uninsured0 = s0.institution.deposits
      .filter((s) => !s.insured)
      .reduce((a, s) => a + s.balance, 0)
    const insured = (b: BankState) => b.deposits.find((s) => s.insured)!.balance
    expect(insured(s1.institution)).toBeCloseTo(insured(s0.institution) + uninsured0 * 0.2, 9)
  })

  it('setDampener multiplies and floors at 0.3; addAmplifier multiplies the chosen channel', () => {
    const s0 = fresh()
    const d1 = apply(apply(s0, bankFx.setDampener(0.5)), bankFx.setDampener(0.1))
    expect(d1.counters.dampener).toBe(0.3)
    const net = apply(s0, bankFx.addAmplifier(1.5, 'SNS', { networked: true }))
    expect(net.counters.networkAmplifier).toBe(1.5)
    expect(net.counters.amplifier).toBeUndefined()
  })
})
