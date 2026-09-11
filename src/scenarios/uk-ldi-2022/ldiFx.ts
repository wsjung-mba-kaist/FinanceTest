import type { Draft } from 'immer'
import type { Effect, EffectContext, GameState, PensionState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'
import { pensionFx } from '../../engine/fx/pension'

/**
 * uk-ldi-2022 시나리오 전용 효과 빌더. 엔진의 `pensionFx`(yieldShock · forcedDeleverage · reduceHedge ·
 * recapitalisePool · sponsorContribution)를 감싸서 풀드 LDI 펀드의 담보 회계를 일관되게 유지한다.
 *
 * 회계 규약 (calibration.md §1)
 * - `ldi.equity` = 풀 NAV. 금리 상승 손실은 NAV를 줄이고 미결 콜(`marginCallOutstanding`)을 만든다(엔진 yieldShock).
 * - 풀이 **자체 유동 담보**(collateral.cash → eligibleGilts)로 콜을 충당하면 NAV는 변하지 않는다(`postCollateral`).
 * - 스킴이 **신규 자본**(현금·매각대금·현물 길트·스폰서)을 넣으면 NAV와 담보가 함께 늘고, 즉시 잔여 콜에 충당된다.
 * - 강제 디레버리징·자발적 헤지 축소는 레포 언와인드용 길트 매도이며, 축소분 × 할인 = 파이어세일 손실(NAV 차감),
 *   축소 비율만큼 잔여 콜이 소멸한다.
 * - 익스포저 하한(초기의 1%)을 두어 pv01 = 0으로 인한 NaN을 막는다.
 */

type PDraft = Draft<GameState<PensionState>>
type Pool = Draft<PensionState>['assets']['ldi']
type SaleAsset = 'equities' | 'corporateBonds' | 'illiquid'

/** 익스포저 하한 (£M): 초기 익스포저 4,200의 1%. pv01 = 0 방지. */
export const EXPOSURE_FLOOR = 42

export function pv01Of(ldi: { exposure: number; modDuration: number }): number {
  return (ldi.exposure * ldi.modDuration) / 10000
}

export function bufferBpOf(ldi: {
  exposure: number
  modDuration: number
  collateral: { cash: number; eligibleGilts: number }
}): number {
  const p = pv01Of(ldi)
  return p > 0 ? (ldi.collateral.cash + ldi.collateral.eligibleGilts) / p : 0
}

function pool(d: PDraft): Pool {
  return d.institution.assets.ldi
}

function addCounter(d: PDraft, key: string, v: number): void {
  d.counters[key] = (d.counters[key] ?? 0) + v
}

function setFlagOnce(d: PDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function f1(n: number): string {
  return n.toFixed(1)
}

/** 풀이 보유한 유동 담보(현금 → 적격 길트)로 미결 콜을 충당한다. NAV 불변. 충당액을 반환. */
export function postCollateral(d: PDraft, ctx: EffectContext): number {
  const ldi = pool(d)
  let need = ldi.marginCallOutstanding
  if (need <= 0) return 0
  const fromCash = Math.min(need, ldi.collateral.cash)
  ldi.collateral.cash -= fromCash
  need -= fromCash
  const fromGilts = Math.min(need, ldi.collateral.eligibleGilts)
  ldi.collateral.eligibleGilts -= fromGilts
  need -= fromGilts
  const posted = fromCash + fromGilts
  ldi.marginCallOutstanding = Math.max(0, need)
  if (posted > 0) {
    addCounter(d, 'collateralPosted', posted)
    ctx.log(
      `풀 담보 충당 ${f1(posted)} (현금 ${f1(fromCash)} + 길트 ${f1(fromGilts)}) → 잔여 콜 ${f1(ldi.marginCallOutstanding)}, 버퍼 ${bufferBpOf(ldi).toFixed(0)}bp`,
    )
  }
  return posted
}

/** 신규 자본을 풀에 주입(NAV·담보 현금 증가)하고 즉시 잔여 콜에 충당한다. */
export function injectCash(d: PDraft, ctx: EffectContext, amount: number, source: string): void {
  if (amount <= 0) return
  const ldi = pool(d)
  ldi.collateral.cash += amount
  ldi.equity += amount
  addCounter(d, 'recapTotal', amount)
  ctx.log(`풀 재자본화 +${f1(amount)} (${source}) → NAV ${f1(ldi.equity)}`)
  postCollateral(d, ctx)
  markRecapComplete(d)
}

/** 잔여 콜이 없고 버퍼가 100bp 이상이면 '재자본화 완료' 플래그 (timeliness 채점). */
export function markRecapComplete(d: PDraft): void {
  const ldi = pool(d)
  if (ldi.marginCallOutstanding <= 0 && bufferBpOf(ldi) >= 100) setFlagOnce(d, 'recap_complete')
}

function floorExposure(d: PDraft, hedgeBefore: number, exposureBefore: number): void {
  const ldi = pool(d)
  if (ldi.exposure < EXPOSURE_FLOOR) {
    ldi.exposure = EXPOSURE_FLOOR
    d.institution.hedgeRatio = clamp(
      hedgeBefore * (EXPOSURE_FLOOR / Math.max(exposureBefore, EXPOSURE_FLOOR)),
      0,
      1.5,
    )
  }
  if (ldi.equity === 0) ldi.equity = 0.001
}

export const ldiFx = {
  /** 엔트리 효과: yieldShock 직후 풀 자체 버퍼로 콜 충당. */
  postFromBuffer(label?: string): Effect<PensionState> {
    return fnEffect<PensionState>(
      'postFromBuffer',
      {},
      (d, ctx) => {
        postCollateral(d, ctx)
        if (pool(d).equity === 0) pool(d).equity = 0.001
      },
      label,
    )
  },

  /**
   * 스킴 현금 → 풀. 운영 준비(`ops_ready`: 위임 권한·당일 딜링)가 되어 있으면 당일 반영,
   * 아니면 `counters.cashInstructed`에 적립되어 다음 턴 `settleInstructedCash`에서 반영(T+1).
   */
  instructCash(p: { amount: number }): Effect<PensionState> {
    return fnEffect<PensionState>('instructCash', { amount: p.amount }, (d, ctx) => {
      const s = d.institution
      const amt = Math.min(p.amount, Math.max(0, s.assets.cash))
      if (amt <= 0) {
        ctx.log('스킴 현금 없음 — 송금 불가')
        return
      }
      if (d.flags.ops_ready) {
        s.assets.cash -= amt
        injectCash(d, ctx, amt, '스킴 현금(당일)')
      } else {
        addCounter(d, 'cashInstructed', amt)
        ctx.log(`현금 송금 지시 ${f1(amt)} — 수탁자 승인·딜링 사이클로 다음 턴 반영(T+1)`)
      }
    })
  },

  settleInstructedCash(): Effect<PensionState> {
    return fnEffect<PensionState>('settleInstructedCash', {}, (d, ctx) => {
      const s = d.institution
      const amt = Math.min(d.counters.cashInstructed ?? 0, Math.max(0, s.assets.cash))
      d.counters.cashInstructed = 0
      if (amt <= 0) return
      s.assets.cash -= amt
      injectCash(d, ctx, amt, '스킴 현금(T+1 결제)')
    })
  },

  /** 직접보유 길트 매도(할인) → 대금 → 풀. 당일. */
  sellGiltsToPool(p: { amount: number; discount: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'sellGiltsToPool',
      { amount: p.amount, discount: p.discount },
      (d, ctx) => {
        const g = d.institution.assets.gilts
        const gross = Math.min(p.amount, Math.max(0, g.marketValue))
        if (gross <= 0) {
          ctx.log('매도할 직접보유 길트 없음')
          return
        }
        g.marketValue -= gross
        const proceeds = gross * (1 - p.discount)
        addCounter(d, 'giltsSold', gross)
        addCounter(d, 'giltsSoldDirect', gross)
        addCounter(d, 'fireSaleLoss', gross * p.discount)
        ctx.log(
          `직접보유 길트 매도 ${f1(gross)} (할인 ${(p.discount * 100).toFixed(1)}%) → 대금 ${f1(proceeds)}`,
        )
        injectCash(d, ctx, proceeds, '길트 매도 대금')
      },
    )
  },

  /** 직접보유 길트 현물 이전(in-specie) → 풀 적격 담보. 운영 준비가 필요(옵션 requires로 게이트). */
  giltsInSpecie(p: { amount: number }): Effect<PensionState> {
    const inner = pensionFx.recapitalisePool({ amount: p.amount, source: 'gilts' })
    return fnEffect<PensionState>('giltsInSpecie', { amount: p.amount }, (d, ctx) => {
      const before = pool(d).equity
      if (inner.kind === 'fn') inner.apply(d, ctx)
      const moved = pool(d).equity - before
      if (moved > 0) addCounter(d, 'recapTotal', moved)
      postCollateral(d, ctx)
      markRecapComplete(d)
    })
  },

  /** 주식·회사채·비유동자산 매각 지시(즉시 효과는 기록만; 결제는 delayedEffects의 settleSale). */
  instructSale(p: { asset: SaleAsset; amount: number; settleTurns: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'instructSale',
      { asset: p.asset, amount: p.amount, settleTurns: p.settleTurns },
      (d, ctx) => {
        addCounter(d, `saleInstructed_${p.asset}`, p.amount)
        ctx.log(
          `${assetLabel(p.asset)} ${f1(p.amount)} 매각 체결 — T+${p.settleTurns} 결제 후 풀 반영`,
        )
      },
    )
  },

  /** 매각 결제: 자산 차감, 대금(할인 반영) → 풀. */
  settleSale(p: { asset: SaleAsset; amount: number; discount: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'settleSale',
      { asset: p.asset, amount: p.amount, discount: p.discount },
      (d, ctx) => {
        const a = d.institution.assets
        const held =
          p.asset === 'equities'
            ? a.equities
            : p.asset === 'illiquid'
              ? a.illiquid
              : a.corporateBonds.marketValue
        const gross = Math.min(p.amount, Math.max(0, held))
        if (gross <= 0) return
        if (p.asset === 'equities') a.equities -= gross
        else if (p.asset === 'illiquid') a.illiquid -= gross
        else a.corporateBonds.marketValue -= gross
        const proceeds = gross * (1 - p.discount)
        addCounter(d, 'fireSaleLoss', gross * p.discount)
        addCounter(d, 'assetsSold', gross)
        ctx.log(
          `${assetLabel(p.asset)} 매각 결제 ${f1(gross)} (할인 ${(p.discount * 100).toFixed(1)}%) → 대금 ${f1(proceeds)}`,
        )
        injectCash(d, ctx, proceeds, `${assetLabel(p.asset)} 매각 대금`)
      },
    )
  },

  /** 회사채 레포(은행 경유, 10/10 TECRF 이후): 회사채를 담보로 현금 조달 → 풀. 레포 부채는 담보 차감으로 상계(STYLIZED). */
  corpRepoToPool(p: { collateral: number; haircut: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'corpRepoToPool',
      { collateral: p.collateral, haircut: p.haircut },
      (d, ctx) => {
        const cb = d.institution.assets.corporateBonds
        const pledged = Math.min(p.collateral, Math.max(0, cb.marketValue))
        const borrowed = pledged * (1 - p.haircut)
        if (borrowed <= 0) return
        cb.marketValue -= borrowed
        cb.pledgedShare = clamp(
          (cb.pledgedShare ?? 0) + pledged / Math.max(1, cb.marketValue + borrowed),
          0,
          1,
        )
        addCounter(d, 'repoBorrowed', borrowed)
        ctx.log(
          `회사채 레포 조달 ${f1(borrowed)} (담보 ${f1(pledged)}, 헤어컷 ${(p.haircut * 100).toFixed(0)}%)`,
        )
        injectCash(d, ctx, borrowed, '회사채 레포')
      },
    )
  },

  /**
   * 스폰서 출연 요청. 대기성 약정(`sponsor_standby`)이 있으면 당일 풀 반영, 아니면 이사회 승인으로
   * 다음 턴 `settleSponsor`에서 반영.
   */
  requestSponsor(p: { amount: number }): Effect<PensionState> {
    return fnEffect<PensionState>('requestSponsor', { amount: p.amount }, (d, ctx) => {
      const cap = d.institution.sponsor.contributionCapacity
      const amt = Math.min(p.amount, Math.max(0, cap))
      if (amt <= 0) {
        ctx.log('스폰서 출연 여력 없음')
        return
      }
      if (d.flags.sponsor_standby) {
        sponsorNow(d, ctx, amt)
      } else {
        addCounter(d, 'sponsorInstructed', amt)
        ctx.log(`스폰서 출연 요청 ${f1(amt)} — 스폰서 이사회 승인 후 다음 턴 반영`)
      }
    })
  },

  settleSponsor(): Effect<PensionState> {
    return fnEffect<PensionState>('settleSponsor', {}, (d, ctx) => {
      const amt = Math.min(
        d.counters.sponsorInstructed ?? 0,
        d.institution.sponsor.contributionCapacity,
      )
      d.counters.sponsorInstructed = 0
      if (amt <= 0) return
      sponsorNow(d, ctx, amt)
    })
  },

  /**
   * 강제 디레버리징(엔진 `pensionFx.forcedDeleverage` 래퍼). 트리거: 잔여 콜 > 풀 담보, NAV ≤ 0,
   * 또는 레버리지 > maxLeverage. 축소분은 레포 언와인드용 길트 매도(할인 손실), 잔여 콜은 비례 소멸.
   */
  forcedDelever(p: { maxLeverage: number; discount: number }): Effect<PensionState> {
    const inner = pensionFx.forcedDeleverage({ maxLeverage: p.maxLeverage, discount: p.discount })
    return fnEffect<PensionState>(
      'ldiForcedDelever',
      { maxLeverage: p.maxLeverage, discount: p.discount },
      (d, ctx) => {
        const ldi = pool(d)
        const expBefore = ldi.exposure
        const egBefore = ldi.collateral.eligibleGilts
        const callBefore = ldi.marginCallOutstanding
        const hedgeBefore = d.institution.hedgeRatio
        if (inner.kind === 'fn') inner.apply(d, ctx)
        if (ldi.exposure >= expBefore - 1e-9) return
        // 엔진이 매도한 풀 담보 길트: 콜 충당에 쓰이지 않은 대금은 담보 현금으로 환류, 할인은 NAV 차감
        const soldColl = Math.max(0, egBefore - ldi.collateral.eligibleGilts)
        const proceeds = soldColl * (1 - p.discount)
        const usedForCall = Math.max(0, callBefore - ldi.marginCallOutstanding)
        ldi.collateral.cash += Math.max(0, proceeds - usedForCall)
        ldi.equity -= soldColl * p.discount
        // 익스포저 축소분: 레포 언와인드 길트 매도
        const cut = 1 - ldi.exposure / expBefore
        const unwound = expBefore - ldi.exposure
        ldi.equity -= unwound * p.discount
        addCounter(d, 'fireSaleLoss', unwound * p.discount)
        addCounter(d, 'giltsSold', unwound + soldColl)
        ldi.marginCallOutstanding = Math.max(0, ldi.marginCallOutstanding * (1 - cut))
        floorExposure(d, hedgeBefore, expBefore)
        addCounter(d, 'forcedCutEvents', 1)
        d.confidence.index = clamp(d.confidence.index - 6, 0, 100)
        ctx.log(
          `강제 디레버리징 결과: 언와인드 ${f1(unwound)} (할인 손실 ${f1(unwound * p.discount)}), 헤지비율 ${(d.institution.hedgeRatio * 100).toFixed(0)}%, 잔여 콜 ${f1(ldi.marginCallOutstanding)}, 신뢰 −6`,
        )
      },
    )
  },

  /** 자발적 헤지 축소(엔진 `pensionFx.reduceHedge` 래퍼): 언와인드 길트 매도 손실, 잔여 콜 비례 소멸, 플래그. */
  cutHedge(p: { fraction: number; discount: number; reason?: string }): Effect<PensionState> {
    const inner = pensionFx.reduceHedge({ fraction: p.fraction, reason: p.reason })
    return fnEffect<PensionState>(
      'ldiCutHedge',
      { fraction: p.fraction, discount: p.discount },
      (d, ctx) => {
        const ldi = pool(d)
        const expBefore = ldi.exposure
        const hedgeBefore = d.institution.hedgeRatio
        if (inner.kind === 'fn') inner.apply(d, ctx)
        const cut = expBefore > 0 ? 1 - ldi.exposure / expBefore : 0
        const unwound = expBefore - ldi.exposure
        ldi.equity -= unwound * p.discount
        addCounter(d, 'fireSaleLoss', unwound * p.discount)
        addCounter(d, 'giltsSold', unwound)
        ldi.marginCallOutstanding = Math.max(0, ldi.marginCallOutstanding * (1 - cut))
        floorExposure(d, hedgeBefore, expBefore)
        setFlagOnce(d, 'hedge_cut_voluntary')
        ctx.log(`자발적 헤지 축소: 언와인드 ${f1(unwound)}, 할인 손실 ${f1(unwound * p.discount)}`)
      },
    )
  },

  /** 헤지 복원(재레버리지): 목표 헤지비율까지 익스포저 확대, NAV × maxLeverage 한도. */
  restoreHedge(p: { targetRatio: number; maxLeverage: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'restoreHedge',
      { targetRatio: p.targetRatio, maxLeverage: p.maxLeverage },
      (d, ctx) => {
        const s = d.institution
        const ldi = s.assets.ldi
        if (s.hedgeRatio >= p.targetRatio - 1e-6) {
          ctx.log('헤지비율이 이미 목표 이상 — 복원 불필요')
          return
        }
        const scale = p.targetRatio / Math.max(s.hedgeRatio, 1e-6)
        const cap = Math.max(0, ldi.equity) * p.maxLeverage
        const newExp = Math.min(ldi.exposure * scale, cap)
        if (newExp <= ldi.exposure + 1e-9) {
          ctx.log(`NAV ${f1(ldi.equity)} × ${p.maxLeverage}x 한도로 헤지 복원 불가`)
          return
        }
        const ratio = newExp / ldi.exposure
        s.hedgeRatio = clamp(s.hedgeRatio * ratio, 0, 1.5)
        addCounter(d, 'hedgeRestored', newExp - ldi.exposure)
        ldi.exposure = newExp
        ctx.log(
          `헤지 복원: 익스포저 ${f1(newExp)}, 헤지비율 ${(s.hedgeRatio * 100).toFixed(0)}%, 버퍼 ${bufferBpOf(ldi).toFixed(0)}bp`,
        )
      },
    )
  },

  /** 버퍼를 목표 bp까지 워터폴(스킴 현금 → 길트 → 회사채 → 주식)로 충당. 즉시. */
  topUpBuffer(p: {
    targetBp: number
    giltDiscount: number
    corpDiscount: number
    equityDiscount: number
  }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'topUpBuffer',
      {
        targetBp: p.targetBp,
        giltDiscount: p.giltDiscount,
        corpDiscount: p.corpDiscount,
        equityDiscount: p.equityDiscount,
      },
      (d, ctx) => {
        const s = d.institution
        const ldi = s.assets.ldi
        const p01 = pv01Of(ldi)
        let need =
          p.targetBp * p01 -
          (ldi.collateral.cash + ldi.collateral.eligibleGilts) +
          ldi.marginCallOutstanding
        if (need <= 0) {
          ctx.log(`버퍼 ${bufferBpOf(ldi).toFixed(0)}bp ≥ 목표 ${p.targetBp}bp — 추가 충당 불필요`)
          return
        }
        const take = Math.min(need, Math.max(0, s.assets.cash))
        if (take > 0) {
          s.assets.cash -= take
          injectCash(d, ctx, take, '스킴 현금')
          need -= take
        }
        const sell = (
          book: { marketValue: number } | null,
          eq: boolean,
          disc: number,
          label: string,
          counterKey?: string,
        ) => {
          if (need <= 0) return
          const held = eq ? s.assets.equities : (book?.marketValue ?? 0)
          const gross = Math.min(need / (1 - disc), Math.max(0, held))
          if (gross <= 0) return
          if (eq) s.assets.equities -= gross
          else if (book) book.marketValue -= gross
          const proceeds = gross * (1 - disc)
          addCounter(d, 'fireSaleLoss', gross * disc)
          if (counterKey) addCounter(d, counterKey, gross)
          if (counterKey === 'giltsSold') addCounter(d, 'giltsSoldDirect', gross)
          ctx.log(`${label} 매도 ${f1(gross)} (할인 ${(disc * 100).toFixed(1)}%)`)
          injectCash(d, ctx, proceeds, `${label} 매도 대금`)
          need -= proceeds
        }
        sell(s.assets.gilts, false, p.giltDiscount, '직접보유 길트', 'giltsSold')
        sell(s.assets.corporateBonds, false, p.corpDiscount, '회사채', 'assetsSold')
        sell(null, true, p.equityDiscount, '주식', 'assetsSold')
        d.counters.bufferTargetBp = p.targetBp
        ctx.log(`버퍼 목표 ${p.targetBp}bp → 현재 ${bufferBpOf(ldi).toFixed(0)}bp`)
      },
    )
  },

  /**
   * 영란은행 임시 매입 경매에 길트 매도(운용사 경유, 9/28~10/14). 직접보유 길트를 먼저 매도해 대금을 풀에
   * 납입하고, 없으면 풀 담보 길트를 현금 담보로 전환한다. 할인은 호가 스프레드 수준(파이어세일 아님).
   */
  sellIntoBoeAuction(p: { amount: number; discount: number }): Effect<PensionState> {
    return fnEffect<PensionState>(
      'sellIntoBoeAuction',
      { amount: p.amount, discount: p.discount },
      (d, ctx) => {
        const s = d.institution
        const ldi = s.assets.ldi
        let remaining = p.amount
        const fromDirect = Math.min(remaining, Math.max(0, s.assets.gilts.marketValue))
        if (fromDirect > 0) {
          s.assets.gilts.marketValue -= fromDirect
          remaining -= fromDirect
          addCounter(d, 'giltsSoldDirect', fromDirect)
          injectCash(
            d,
            ctx,
            fromDirect * (1 - p.discount),
            '영란은행 경매 매도 대금(직접보유 길트)',
          )
        }
        const fromPool = Math.min(remaining, Math.max(0, ldi.collateral.eligibleGilts))
        if (fromPool > 0) {
          ldi.collateral.eligibleGilts -= fromPool
          ldi.collateral.cash += fromPool * (1 - p.discount)
          ldi.equity -= fromPool * p.discount
        }
        const sold = fromDirect + fromPool
        if (sold <= 0) {
          ctx.log('경매에 매도할 길트 없음')
          return
        }
        addCounter(d, 'giltsSold', sold)
        addCounter(d, 'boeAuctionSold', sold)
        addCounter(d, 'fireSaleLoss', sold * p.discount)
        setFlagOnce(d, 'used_boe_window')
        markRecapComplete(d)
        ctx.log(
          `영란은행 경매 매도 ${f1(sold)} (직접보유 ${f1(fromDirect)} + 풀 담보 ${f1(fromPool)}, 할인 ${(p.discount * 100).toFixed(1)}%) → 버퍼 ${bufferBpOf(ldi).toFixed(0)}bp`,
        )
      },
    )
  },

  /** 풀 초과 담보를 목표 bp까지 환매해 스킴 주식에 재투자(NAV·담보 감소, 레버리지 상승). 잔여 콜이 있으면 불가. */
  releaseCollateral(p: { toBufferBp: number }): Effect<PensionState> {
    return fnEffect<PensionState>('releaseCollateral', { toBufferBp: p.toBufferBp }, (d, ctx) => {
      const s = d.institution
      const ldi = s.assets.ldi
      if (ldi.marginCallOutstanding > 0) {
        ctx.log('잔여 콜이 있어 담보 환매 불가')
        return
      }
      const target = p.toBufferBp * pv01Of(ldi)
      const cur = ldi.collateral.cash + ldi.collateral.eligibleGilts
      const excess = Math.max(0, cur - target)
      const fromCash = Math.min(excess, ldi.collateral.cash)
      ldi.collateral.cash -= fromCash
      const fromGilts = Math.min(excess - fromCash, ldi.collateral.eligibleGilts)
      ldi.collateral.eligibleGilts -= fromGilts
      const released = fromCash + fromGilts
      if (released <= 0) {
        ctx.log(`버퍼 ${bufferBpOf(ldi).toFixed(0)}bp ≤ 목표 ${p.toBufferBp}bp — 환매 없음`)
        return
      }
      ldi.equity -= released
      s.assets.equities += released
      addCounter(d, 'collateralReleased', released)
      setFlagOnce(d, 'released_collateral')
      d.counters.bufferTargetBp = p.toBufferBp
      ctx.log(
        `담보 환매 ${f1(released)} → 주식 재투자. 버퍼 ${bufferBpOf(ldi).toFixed(0)}bp, NAV ${f1(ldi.equity)}, 레버리지 ${(ldi.exposure / Math.max(ldi.equity, 1e-6)).toFixed(2)}x`,
      )
    })
  },

  /** 신뢰·감독 반응 등을 포함하지 않는 순수 시장 표시 갱신(2y/10y/스프레드). */
  marketMove(p: {
    govt2yBp?: number
    govt10yBp?: number
    creditSpreadIgBp?: number
    volIndex?: number
  }): Effect<PensionState> {
    return fnEffect<PensionState>('marketMove', { ...p } as Record<string, number>, (d) => {
      if (p.govt2yBp !== undefined) d.market.govt2yBp += p.govt2yBp
      if (p.govt10yBp !== undefined) d.market.govt10yBp += p.govt10yBp
      if (p.creditSpreadIgBp !== undefined) d.market.creditSpreadIgBp += p.creditSpreadIgBp
      if (p.volIndex !== undefined) d.market.volIndex = Math.max(5, d.market.volIndex + p.volIndex)
    })
  },
}

function sponsorNow(d: PDraft, ctx: EffectContext, amt: number): void {
  const inner = pensionFx.sponsorContribution({ amount: amt, toPool: true })
  const before = pool(d).equity
  if (inner.kind === 'fn') inner.apply(d, ctx)
  const moved = pool(d).equity - before
  if (moved > 0) addCounter(d, 'recapTotal', moved)
  postCollateral(d, ctx)
  markRecapComplete(d)
}

function assetLabel(a: SaleAsset): string {
  return a === 'equities' ? '주식' : a === 'corporateBonds' ? '회사채' : '비유동자산'
}
