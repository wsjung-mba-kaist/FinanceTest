import type { Draft } from 'immer'
import type { Effect, GameState, PensionState } from '../types'
import { clamp } from '../core/paths'
import { fnEffect } from './common'

type PDraft = Draft<GameState<PensionState>>

function pen(d: PDraft): Draft<PensionState> {
  return d.institution
}

/**
 * Pension / LDI effect builders (BoE FSR 2022-12 LDI box; TPR 2023 guidance; IMF WP 2023/210).
 * Units: scenario currency (e.g. £M). Yields in bp. Collateral = ldi.collateral.cash + eligibleGilts.
 */
export const pensionFx = {
  /**
   * Applies a yield move to gilts, corporate bonds, liabilities and the LDI pool.
   * LDI loss = PV01 × Δbp where PV01 = exposure × modDuration / 10,000. A positive loss becomes an
   * outstanding margin (collateral) call; a fall in yields releases collateral back to cash.
   */
  yieldShock(p: { deltaBp: number; label?: string }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'yieldShock',
      { deltaBp: p.deltaBp },
      (d, ctx) => {
        const s = pen(d)
        const dy = p.deltaBp / 10000
        for (const book of [s.assets.gilts, s.assets.corporateBonds]) {
          book.marketValue = Math.max(0, book.marketValue * (1 - book.modDuration * dy))
        }
        s.liabilities.pv = Math.max(0, s.liabilities.pv * (1 - s.liabilities.modDuration * dy))
        s.liabilities.discountRateBp += p.deltaBp
        const ldi = s.assets.ldi
        const pv01 = (ldi.exposure * ldi.modDuration) / 10000
        const loss = pv01 * p.deltaBp
        if (loss > 0) {
          ldi.marginCallOutstanding += loss
          ldi.equity -= loss
        } else {
          const release = -loss
          ldi.collateral.cash += release
          ldi.equity += release
        }
        d.market.govt30yBp += p.deltaBp
        ctx.log(
          `금리 ${p.deltaBp > 0 ? '+' : ''}${p.deltaBp}bp: LDI PV01 ${pv01.toFixed(2)} → ${loss > 0 ? `마진콜 +${loss.toFixed(1)}` : `담보 반환 ${(-loss).toFixed(1)}`}`,
        )
      },
      p.label,
    )
  },

  /**
   * Meets the outstanding margin call from a source. Sales in a stressed market suffer `discount`
   * (fraction) and settle with `settlementTurns` delay unless `immediate` (cash / gilts held in the pool).
   */
  meetMarginCall(p: {
    source: 'cash' | 'gilts' | 'corporateBonds' | 'equities' | 'sponsor'
    amount?: number
    discount?: number
  }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'meetMarginCall',
      { source: p.source, amount: p.amount ?? 0, discount: p.discount ?? 0 },
      (d, ctx) => {
        const s = pen(d)
        const ldi = s.assets.ldi
        const need = p.amount ?? ldi.marginCallOutstanding
        if (need <= 0) return
        let paid = 0
        const disc = p.discount ?? 0
        switch (p.source) {
          case 'cash': {
            paid = Math.min(need, s.assets.cash + ldi.collateral.cash)
            const fromPool = Math.min(paid, ldi.collateral.cash)
            ldi.collateral.cash -= fromPool
            s.assets.cash -= paid - fromPool
            break
          }
          case 'gilts': {
            const gross = Math.min(need / (1 - disc), s.assets.gilts.marketValue)
            s.assets.gilts.marketValue -= gross
            paid = gross * (1 - disc)
            d.counters.giltsSold = (d.counters.giltsSold ?? 0) + gross
            d.counters.fireSaleLoss = (d.counters.fireSaleLoss ?? 0) + gross * disc
            break
          }
          case 'corporateBonds': {
            const gross = Math.min(need / (1 - disc), s.assets.corporateBonds.marketValue)
            s.assets.corporateBonds.marketValue -= gross
            paid = gross * (1 - disc)
            d.counters.fireSaleLoss = (d.counters.fireSaleLoss ?? 0) + gross * disc
            break
          }
          case 'equities': {
            const gross = Math.min(need / (1 - disc), s.assets.equities)
            s.assets.equities -= gross
            paid = gross * (1 - disc)
            d.counters.fireSaleLoss = (d.counters.fireSaleLoss ?? 0) + gross * disc
            break
          }
          case 'sponsor': {
            paid = Math.min(need, s.sponsor.contributionCapacity)
            s.sponsor.contributionCapacity -= paid
            d.counters.sponsorCash = (d.counters.sponsorCash ?? 0) + paid
            break
          }
        }
        ldi.marginCallOutstanding = Math.max(0, ldi.marginCallOutstanding - paid)
        ldi.equity += paid
        ctx.log(
          `마진콜 충당 ${paid.toFixed(1)} (${p.source}${disc ? `, 할인 ${(disc * 100).toFixed(0)}%` : ''}), 잔여 ${ldi.marginCallOutstanding.toFixed(1)}`,
        )
      },
    )
  },

  /** Cuts hedge exposure by a fraction; releases collateral pro rata and lowers the hedge ratio. */
  reduceHedge(p: { fraction: number; reason?: string }): Effect<PensionState> {
    return fnEffect<PensionState>('reduceHedge', { fraction: p.fraction }, (d, ctx) => {
      const s = pen(d)
      const ldi = s.assets.ldi
      const cut = clamp(p.fraction, 0, 1)
      const released = ldi.collateral.eligibleGilts * cut
      ldi.exposure *= 1 - cut
      ldi.collateral.eligibleGilts -= released
      s.assets.gilts.marketValue += released
      s.hedgeRatio = clamp(s.hedgeRatio * (1 - cut), 0, 1.5)
      d.counters.hedgeCut = (d.counters.hedgeCut ?? 0) + cut
      ctx.log(
        `헤지 축소 ${(cut * 100).toFixed(0)}%${p.reason ? ` (${p.reason})` : ''} → 헤지비율 ${(s.hedgeRatio * 100).toFixed(0)}%`,
      )
    })
  },

  /** Adds equity (collateral) to the LDI pool from scheme cash or gilts (recapitalisation). */
  recapitalisePool(p: { amount: number; source: 'cash' | 'gilts' }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'recapitalisePool',
      { amount: p.amount, source: p.source },
      (d, ctx) => {
        const s = pen(d)
        const ldi = s.assets.ldi
        const amt = Math.min(
          p.amount,
          p.source === 'cash' ? s.assets.cash : s.assets.gilts.marketValue,
        )
        if (p.source === 'cash') {
          s.assets.cash -= amt
          ldi.collateral.cash += amt
        } else {
          s.assets.gilts.marketValue -= amt
          ldi.collateral.eligibleGilts += amt
        }
        ldi.equity += amt
        ctx.log(`LDI 풀 재자본화 ${amt.toFixed(1)} (${p.source})`)
      },
    )
  },

  /**
   * Forced deleveraging: if the outstanding call exceeds pool collateral, the manager cuts exposure
   * to bring leverage back within `maxLeverage` and sells gilts to settle (fire-sale discount).
   */
  forcedDeleverage(p: { maxLeverage: number; discount: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'forcedDeleverage',
      { maxLeverage: p.maxLeverage, discount: p.discount },
      (d, ctx) => {
        const s = pen(d)
        const ldi = s.assets.ldi
        const collateral = ldi.collateral.cash + ldi.collateral.eligibleGilts
        if (
          ldi.marginCallOutstanding <= collateral &&
          ldi.equity > 0 &&
          ldi.exposure / Math.max(1e-9, ldi.equity) <= p.maxLeverage
        )
          return
        const targetExposure = Math.max(0, ldi.equity) * p.maxLeverage
        const cut = ldi.exposure > 0 ? clamp(1 - targetExposure / ldi.exposure, 0, 1) : 0
        const sold = ldi.collateral.eligibleGilts * cut
        ldi.collateral.eligibleGilts -= sold
        const proceeds = sold * (1 - p.discount)
        ldi.marginCallOutstanding = Math.max(0, ldi.marginCallOutstanding - proceeds)
        ldi.exposure *= 1 - cut
        s.hedgeRatio = clamp(s.hedgeRatio * (1 - cut), 0, 1.5)
        d.counters.fireSaleLoss = (d.counters.fireSaleLoss ?? 0) + sold * p.discount
        d.counters.forcedDeleverage = (d.counters.forcedDeleverage ?? 0) + cut
        d.flags.forced_deleverage = true
        d.flagTurns.forced_deleverage ??= d.turnIndex
        ctx.log(
          `강제 디레버리징: 익스포저 −${(cut * 100).toFixed(0)}%, 길트 매도 ${sold.toFixed(1)}(할인 ${(p.discount * 100).toFixed(0)}%)`,
        )
      },
    )
  },

  /** Sponsor injects cash into the scheme (or directly into the pool). */
  sponsorContribution(p: { amount: number; toPool?: boolean }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'sponsorContribution',
      { amount: p.amount, toPool: p.toPool ?? false },
      (d, ctx) => {
        const s = pen(d)
        const amt = Math.min(p.amount, s.sponsor.contributionCapacity)
        s.sponsor.contributionCapacity -= amt
        if (p.toPool) {
          s.assets.ldi.collateral.cash += amt
          s.assets.ldi.equity += amt
        } else s.assets.cash += amt
        d.counters.sponsorCash = (d.counters.sponsorCash ?? 0) + amt
        ctx.log(`스폰서 출연 ${amt.toFixed(1)}`)
      },
    )
  },
}
