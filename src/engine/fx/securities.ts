import type { Draft } from 'immer'
import type { Effect, GameState, SecuritiesState } from '../types'
import { clamp } from '../core/paths'
import { fnEffect } from './common'

type SDraft = Draft<GameState<SecuritiesState>>

function sec(d: SDraft): Draft<SecuritiesState> {
  return d.institution
}

/**
 * 한국 증권사 효과 빌더 (금융투자업규정 NCR, PF-ABCP 매입확약, 자금조달 채널).
 * 단위: 억원 등 시나리오 단위. 신용위험액 가중치는 파라미터(2022.11.9 특례: 자체매입 ABCP 32%).
 */
export const securitiesFx = {
  /**
   * One rollover period: the maturing tranche (index 0) rolls at `rollRate`; the failed part must be
   * bought under the purchase commitment (cash → abcpHeld, credit risk += held × riskWeight) unless
   * `honourCommitment` is false (default). Then the maturity ladder shifts by one.
   */
  rolloverStep(p: {
    honourCommitment?: boolean
    riskWeight?: number
    label?: string
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'rolloverStep',
      { honourCommitment: p.honourCommitment ?? true, riskWeight: p.riskWeight ?? 1 },
      (d, ctx) => {
        const s = sec(d)
        const maturing = s.pf.abcpMaturing[0] ?? 0
        const failed = maturing * (1 - clamp(s.pf.rollRate, 0, 1))
        const rolled = maturing - failed
        if (failed > 0) {
          if (p.honourCommitment ?? true) {
            s.liquidity.cash -= failed
            s.pf.abcpHeld += failed
            s.risk.credit += failed * (p.riskWeight ?? 1)
            d.counters.abcpBought = (d.counters.abcpBought ?? 0) + failed
          } else {
            d.counters.abcpDefaulted = (d.counters.abcpDefaulted ?? 0) + failed
            d.flags.abcp_default = true
            d.flagTurns.abcp_default ??= d.turnIndex
            d.confidence.index = clamp(d.confidence.index - 20, 0, 100)
          }
        }
        s.pf.abcpGuaranteed = Math.max(0, s.pf.abcpGuaranteed - failed)
        s.pf.abcpMaturing = [...s.pf.abcpMaturing.slice(1), 0]
        d.counters.lastRolloverFailed = failed
        d.counters.cumulativeRolloverFailed = (d.counters.cumulativeRolloverFailed ?? 0) + failed
        ctx.log(
          `차환: 만기 ${maturing.toFixed(0)} 중 성공 ${rolled.toFixed(0)}, 실패 ${failed.toFixed(0)} (${(p.honourCommitment ?? true) ? '자체 매입' : '부도 처리'})`,
        )
      },
      p.label,
    )
  },

  /** Sets the market-wide rollover success rate (0..1). */
  setRollRate(rate: number, reason?: string): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('setRollRate', { rate }, (d, ctx) => {
      sec(d).pf.rollRate = clamp(rate, 0, 1)
      ctx.log(`차환 성공률 → ${(rate * 100).toFixed(0)}%${reason ? ` (${reason})` : ''}`)
    })
  },

  /**
   * Raises funding through a channel. Constraints: call ≤ callLimit; repo ≤ sellableSecurities × (1 − haircut);
   * cp/bank availability scales with confidence; bok (한은 RP) needs `bok_window_open` flag.
   */
  raiseFunding(p: {
    channel: 'call' | 'repo' | 'cp' | 'bank' | 'bok' | 'ksfc'
    amount: number
    rateBp?: number
    callLimit?: number
    repoHaircut?: number
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'raiseFunding',
      { channel: p.channel, amount: p.amount, rateBp: p.rateBp ?? 0 },
      (d, ctx) => {
        const s = sec(d)
        let got = 0
        switch (p.channel) {
          case 'call': {
            const limit = p.callLimit ?? Infinity
            got = Math.max(0, Math.min(p.amount, limit - s.funding.call))
            s.funding.call += got
            break
          }
          case 'repo': {
            const cap =
              s.liquidity.sellableSecurities * (1 - (p.repoHaircut ?? 0.1)) - s.funding.repo
            got = Math.max(0, Math.min(p.amount, cap))
            s.funding.repo += got
            break
          }
          case 'cp': {
            const ci = d.confidence.index
            const avail = ci >= 60 ? p.amount : ci >= 40 ? p.amount * 0.5 : 0
            got = avail
            s.funding.cp += got
            break
          }
          case 'bank': {
            got = Math.max(
              0,
              Math.min(p.amount, s.liquidity.creditLines - s.liquidity.creditLinesDrawn),
            )
            s.liquidity.creditLinesDrawn += got
            break
          }
          case 'bok':
          case 'ksfc': {
            if (!d.flags[p.channel === 'bok' ? 'bok_window_open' : 'ksfc_window_open']) {
              ctx.log(`${p.channel === 'bok' ? '한은 RP' : '증권금융'} 창구가 아직 열리지 않음`)
              return
            }
            got = p.amount
            s.funding.repo += got
            break
          }
        }
        s.liquidity.cash += got
        d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + got
        if (p.rateBp) d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
        ctx.log(`${p.channel} 조달 ${got.toFixed(0)} (요청 ${p.amount})`)
        if (got < p.amount)
          d.log.push(
            `[T${d.turnIndex}] ${p.channel} 조달 부족: ${(p.amount - got).toFixed(0)} 미조달`,
          )
      },
    )
  },

  /** Sells securities from the sellable book at a discount; realised loss hits equity. */
  sellSecurities(p: {
    amount: number
    discount: number
    marketRiskRelief?: number
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'sellSecurities',
      { amount: p.amount, discount: p.discount },
      (d, ctx) => {
        const s = sec(d)
        const gross = Math.min(p.amount, s.liquidity.sellableSecurities)
        const proceeds = gross * (1 - p.discount)
        s.liquidity.sellableSecurities -= gross
        s.liquidity.cash += proceeds
        s.equityCapital -= gross * p.discount
        s.risk.market = Math.max(0, s.risk.market - gross * (p.marketRiskRelief ?? 0.05))
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + gross * p.discount
        ctx.log(
          `보유증권 매각 ${gross.toFixed(0)} (할인 ${(p.discount * 100).toFixed(1)}%) → 현금 +${proceeds.toFixed(0)}`,
        )
      },
    )
  },

  /** Re-weights the credit risk on self-purchased ABCP (e.g. regulatory relief 100% → 32%). */
  reweightHeldAbcp(p: { from: number; to: number; reason?: string }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('reweightHeldAbcp', { from: p.from, to: p.to }, (d, ctx) => {
      const s = sec(d)
      const delta = s.pf.abcpHeld * (p.to - p.from)
      s.risk.credit = Math.max(0, s.risk.credit + delta)
      ctx.log(
        `자체매입 ABCP 위험값 ${(p.from * 100).toFixed(0)}%→${(p.to * 100).toFixed(0)}%${p.reason ? ` (${p.reason})` : ''}: 신용위험액 ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`,
      )
    })
  },

  /** Sells held ABCP into a support programme (e.g. 종투사 PF-ABCP 매입프로그램) at a price. */
  sellHeldAbcp(p: {
    amount: number
    priceDiscount: number
    riskWeight: number
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'sellHeldAbcp',
      { amount: p.amount, priceDiscount: p.priceDiscount },
      (d, ctx) => {
        const s = sec(d)
        const sold = Math.min(p.amount, s.pf.abcpHeld)
        s.pf.abcpHeld -= sold
        s.liquidity.cash += sold * (1 - p.priceDiscount)
        s.equityCapital -= sold * p.priceDiscount
        s.risk.credit = Math.max(0, s.risk.credit - sold * p.riskWeight)
        ctx.log(`보유 ABCP 매각 ${sold.toFixed(0)} (할인 ${(p.priceDiscount * 100).toFixed(1)}%)`)
      },
    )
  },

  /** Pays outstanding margin calls from cash / FX liquid assets. */
  payMarginCall(p: { fx?: boolean }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('payMarginCall', { fx: p.fx ?? false }, (d, ctx) => {
      const s = sec(d)
      const need = s.hedge.marginCallPending
      if (need <= 0) return
      const pool = p.fx ? s.liquidity.fxLiquid : s.liquidity.cash
      const paid = Math.min(need, Math.max(0, pool))
      if (p.fx) s.liquidity.fxLiquid -= paid
      else s.liquidity.cash -= paid
      s.hedge.marginCallPending -= paid
      d.counters.marginPaid = (d.counters.marginPaid ?? 0) + paid
      ctx.log(
        `마진콜 납입 ${paid.toFixed(0)} (${p.fx ? '외화' : '원화'}), 미납 ${s.hedge.marginCallPending.toFixed(0)}`,
      )
    })
  },

  /** Repays a funding channel from cash. */
  repay(p: { channel: 'call' | 'repo' | 'cp' | 'bank'; amount: number }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'repay',
      { channel: p.channel, amount: p.amount },
      (d, ctx) => {
        const s = sec(d)
        const owed = p.channel === 'bank' ? s.liquidity.creditLinesDrawn : s.funding[p.channel]
        const amt = Math.min(p.amount, owed, Math.max(0, s.liquidity.cash))
        if (p.channel === 'bank') s.liquidity.creditLinesDrawn -= amt
        else s.funding[p.channel] -= amt
        s.liquidity.cash -= amt
        ctx.log(`${p.channel} 상환 ${amt.toFixed(0)}`)
      },
    )
  },
}
