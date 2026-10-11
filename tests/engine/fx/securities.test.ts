import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type { Effect, GameState, SecuritiesState } from '@/engine'
import { createGame } from '@/engine'
import { EMPTY_SNAPSHOT, applyEffects, makeEffectContext } from '@/engine/core/effects'
import { securitiesFx } from '@/engine/fx/securities'
import { legoInitialSecurities } from '@/scenarios/legoland-2022/initialState'
import { miniBank } from '../../fixtures/miniBank'

/**
 * 증권사 전표: 현금·보유증권·자기자본·위험액·조달 잔액이 한 빌더 안에서 서로 맞아야 한다.
 * 매각은 «증권 −gross, 현금 +gross(1−할인), 자본 −gross×할인», 차환 실패분은 «현금 −, 보유 ABCP +,
 * 신용위험액 + × 위험값». 금액은 레고랜드 시나리오의 T0 장부(억원)를 그대로 쓴다.
 */
type S = GameState<SecuritiesState>

function fresh(): S {
  const base = createGame(miniBank, 1, { variance: 0 }) as unknown as S
  return { ...base, institution: structuredClone(legoInitialSecurities) }
}

function apply(state: S, effects: Effect<SecuritiesState>[]): S {
  return produce(state, (d) => {
    applyEffects(d, effects, makeEffectContext(d, EMPTY_SNAPSHOT))
  })
}

describe('securitiesFx.rolloverStep', () => {
  it('honouring the commitment buys the failed tranche onto the book', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.pf.rollRate = 0.6
    })
    const i0 = s0.institution
    const s1 = apply(s0, [securitiesFx.rolloverStep({ riskWeight: 0.32 })])
    const i1 = s1.institution
    const maturing = i0.pf.abcpMaturing[0]!
    const failed = maturing * 0.4
    expect(i1.liquidity.cash).toBeCloseTo(i0.liquidity.cash - failed, 9)
    expect(i1.pf.abcpHeld).toBeCloseTo(i0.pf.abcpHeld + failed, 9)
    expect(i1.risk.credit).toBeCloseTo(i0.risk.credit + failed * 0.32, 9)
    expect(i1.pf.abcpGuaranteed).toBeCloseTo(i0.pf.abcpGuaranteed - failed, 9)
    // The ladder shifts by one and keeps its length.
    expect(i1.pf.abcpMaturing).toEqual([...i0.pf.abcpMaturing.slice(1), 0])
    expect(s1.counters.abcpBought).toBeCloseTo(failed, 9)
    expect(s1.counters.lastRolloverFailed).toBeCloseTo(failed, 9)
  })

  it('refusing the commitment records a default and costs confidence, not cash', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.pf.rollRate = 0.5
    })
    const s1 = apply(s0, [securitiesFx.rolloverStep({ honourCommitment: false })])
    expect(s1.institution.liquidity.cash).toBe(s0.institution.liquidity.cash)
    expect(s1.institution.pf.abcpHeld).toBe(s0.institution.pf.abcpHeld)
    expect(s1.counters.abcpDefaulted).toBeCloseTo(s0.institution.pf.abcpMaturing[0]! * 0.5, 9)
    expect(s1.flags.abcp_default).toBe(true)
    expect(s1.confidence.index).toBe(s0.confidence.index - 20)
  })

  it('setRollRate clamps to 0..1', () => {
    const s1 = apply(fresh(), [securitiesFx.setRollRate(1.4)])
    expect(s1.institution.pf.rollRate).toBe(1)
  })
})

describe('securitiesFx.raiseFunding', () => {
  it('call borrowing stops at the limit; what was raised is cash', () => {
    const s0 = fresh()
    const s1 = apply(s0, [
      securitiesFx.raiseFunding({ channel: 'call', amount: 2000, callLimit: 1500 }),
    ])
    const got = 1500 - s0.institution.funding.call
    expect(s1.institution.funding.call).toBe(1500)
    expect(s1.institution.liquidity.cash).toBe(s0.institution.liquidity.cash + got)
    expect(s1.counters.fundingDrawn).toBe(got)
  })

  it('repo is capped by sellable securities after the haircut, net of repo already out', () => {
    const s0 = fresh()
    const i0 = s0.institution
    const s1 = apply(s0, [
      securitiesFx.raiseFunding({ channel: 'repo', amount: 99999, repoHaircut: 0.1 }),
    ])
    const cap = i0.liquidity.sellableSecurities * 0.9 - i0.funding.repo
    expect(s1.institution.funding.repo).toBeCloseTo(i0.funding.repo + cap, 9)
    expect(s1.institution.liquidity.cash).toBeCloseTo(i0.liquidity.cash + cap, 9)
  })

  it('CP availability follows confidence: full ≥60, half ≥40, none below', () => {
    const at = (ci: number) =>
      apply(
        produce(fresh(), (d) => {
          d.confidence.index = ci
        }),
        [securitiesFx.raiseFunding({ channel: 'cp', amount: 100 })],
      ).counters.fundingDrawn ?? 0
    expect(at(70)).toBe(100)
    expect(at(50)).toBe(50)
    expect(at(30)).toBe(0)
  })

  it('bank lines draw what is undrawn; the central-bank window needs its flag', () => {
    const s0 = fresh()
    const bank = apply(s0, [securitiesFx.raiseFunding({ channel: 'bank', amount: 99999 })])
    expect(bank.institution.liquidity.creditLinesDrawn).toBe(s0.institution.liquidity.creditLines)
    const closed = apply(s0, [securitiesFx.raiseFunding({ channel: 'bok', amount: 500 })])
    expect(closed.institution.liquidity.cash).toBe(s0.institution.liquidity.cash)
    const open = apply(
      produce(s0, (d) => {
        d.flags.bok_window_open = true
      }),
      [securitiesFx.raiseFunding({ channel: 'bok', amount: 500 })],
    )
    expect(open.institution.liquidity.cash).toBe(s0.institution.liquidity.cash + 500)
    expect(open.institution.funding.repo).toBe(s0.institution.funding.repo + 500)
  })
})

describe('securitiesFx sales, margin and repayment', () => {
  it('sellSecurities: securities −gross, cash +net, equity −discount', () => {
    const s0 = fresh()
    const s1 = apply(s0, [securitiesFx.sellSecurities({ amount: 1000, discount: 0.02 })])
    expect(s1.institution.liquidity.sellableSecurities).toBe(
      s0.institution.liquidity.sellableSecurities - 1000,
    )
    expect(s1.institution.liquidity.cash).toBeCloseTo(s0.institution.liquidity.cash + 980, 9)
    expect(s1.institution.equityCapital).toBeCloseTo(s0.institution.equityCapital - 20, 9)
    expect(s1.counters.realizedLoss).toBeCloseTo(20, 9)
  })

  it('reweightHeldAbcp moves credit risk by held × Δweight; sellHeldAbcp unwinds it', () => {
    const held = produce(fresh(), (d) => {
      d.institution.pf.abcpHeld = 1000
    })
    const re = apply(held, [securitiesFx.reweightHeldAbcp({ from: 1, to: 0.32 })])
    expect(re.institution.risk.credit).toBeCloseTo(held.institution.risk.credit - 680, 9)
    const sold = apply(held, [
      securitiesFx.sellHeldAbcp({ amount: 400, priceDiscount: 0.05, riskWeight: 1 }),
    ])
    expect(sold.institution.pf.abcpHeld).toBe(600)
    expect(sold.institution.liquidity.cash).toBeCloseTo(held.institution.liquidity.cash + 380, 9)
    expect(sold.institution.equityCapital).toBeCloseTo(held.institution.equityCapital - 20, 9)
    expect(sold.institution.risk.credit).toBeCloseTo(held.institution.risk.credit - 400, 9)
  })

  it('payMarginCall pays from the pool asked, never more than it holds', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.hedge.marginCallPending = 500
      d.institution.liquidity.fxLiquid = 300
    })
    const fx = apply(s0, [securitiesFx.payMarginCall({ fx: true })])
    expect(fx.institution.liquidity.fxLiquid).toBe(0)
    expect(fx.institution.hedge.marginCallPending).toBe(200)
    expect(fx.institution.liquidity.cash).toBe(s0.institution.liquidity.cash)
    const krw = apply(s0, [securitiesFx.payMarginCall({})])
    expect(krw.institution.liquidity.cash).toBe(s0.institution.liquidity.cash - 500)
    expect(krw.institution.hedge.marginCallPending).toBe(0)
  })

  it('repay is bounded by what is owed and by cash', () => {
    const s0 = fresh()
    const s1 = apply(s0, [securitiesFx.repay({ channel: 'call', amount: 99999 })])
    expect(s1.institution.funding.call).toBe(0)
    expect(s1.institution.liquidity.cash).toBe(
      s0.institution.liquidity.cash - s0.institution.funding.call,
    )
    const broke = produce(s0, (d) => {
      d.institution.liquidity.cash = 100
    })
    const s2 = apply(broke, [securitiesFx.repay({ channel: 'cp', amount: 500 })])
    expect(s2.institution.liquidity.cash).toBe(0)
    expect(s2.institution.funding.cp).toBe(s0.institution.funding.cp - 100)
  })
})
