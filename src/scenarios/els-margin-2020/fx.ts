import type { Draft } from 'immer'
import type { Effect, GameState, Option, SecuritiesState, Turn } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'

/**
 * els-margin-2020 전용 효과 빌더. `src/engine/fx/securities.ts`에 없는 동작(해외 지수선물 증거금,
 * 통화별 유동성, FX 스왑·현물·한은 통화스와프, CP 차환, 헤지 구성 변경)을 시나리오 로컬로 정의한다.
 * 공유 모듈은 건드리지 않는다. 단위 억원. 보정 근거: src/scenarios/els-margin-2020/calibration.md
 */
type D = Draft<GameState<SecuritiesState>>
const sec = (d: D): Draft<SecuritiesState> => d.institution

export type T = Turn<SecuritiesState>
export type O = Option<SecuritiesState>

/** 출처 id 단축 (sources.ts / 공유 서지). */
export const S = {
  mpb: 'bok-mpb-2020-03-16',
  swap: 'bok-swap-2020-03-19',
  bokRp: 'bok-rp-2020-03-26',
  swapAuction: 'bok-swap-auction-2020-03-31',
  swapTerms: 'bok-swap-terms-2020-03-29',
  fsr: 'bok-fsr-2020-06',
  bokAct: 'bok-act',
  em1: 'govt-emergency-1-2020-03-19',
  em2: 'govt-emergency-2-2020-03-24',
  shortSell: 'fsc-shortselling-2020-03-13',
  regFlex: 'fsc-regflex-2020-04-16',
  dlsPlan: 'fsc-dls-plan-2020',
  fss: 'fss-dls-2019',
  lr2027: 'fsc-86917',
  kcmiLee: 'kcmi-lee-2020-07-28',
  kcmiHwang: 'kcmi-hwang-2020-04-22',
  fsb: 'fsb-holistic-review-2020',
  bcbs144: 'bcbs-144',
  cgfs: 'cgfs-36',
  bcbs555: 'bcbs-d555',
  wb: 'worldbank-cse-handbook-2023',
  ecosRate: 'ecos-817Y002',
  ecosEquity: 'ecos-802Y001',
  ecosFx: 'ecos-731Y001',
  sp500: 'fred-sp500',
  vix: 'fred-vixcls',
  kofia: 'kofia-bond',
  seibro: 'ksd-seibro-els',
  assembly: 'assembly-2020-finance',
  pMargin: 'press-margin-2020-03',
  pCp: 'press-cp-2020-03',
} as const

/** 턴별 증거금 산출 입력. turnsA/B와 els.test.ts가 함께 참조한다(재계산 검증). */
export interface MarginStep {
  /** 직전 턴 이후 해외지수 순변동률(음수 = 하락). calibration.md §3 */
  indexMovePct: number
  /** 개시증거금률 인상분(헤지 명목 대비, 소수). */
  imDeltaPct: number
  /** 환율 환산 기준(원/달러). T0 = 1,202원 고정. */
  fxBase: number
  /** 턴 시작 시점의 환율(원/달러) — 환산계수 = fxTurn / fxBase. */
  fxTurn: number
  /** 일중 분배 프로필(합 = 1). 틱이 없는 턴은 생략. */
  profile?: number[]
}

export const FX_BASE = 1202

/**
 * 자체헤지 ELS의 해외 지수선물 증거금 소요.
 *
 *   헤지 명목 N   = elsSelfHedged × hedgeDelta
 *   변동증거금 VM = N × (−indexMovePct) × (fxTurn / fxBase)
 *   개시증거금 IM = N × imDeltaPct × (fxTurn / fxBase)
 *
 * `profile`이 있으면 틱별로 share를 곱해 분배하되, 명목·환산계수는 **턴 시작 값으로 고정**한다
 * (`counters.marginWindowBase`). 그래서 variance 0에서 슬라이스 합계가 단일 호출과 정확히 같다.
 * 일중 환율 변동은 별도의 `marginFxDrift`가 잔액에 반영한다.
 */
export function marginCallStep(p: MarginStep & { label?: string }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'marginCallStep',
    {
      indexMovePct: p.indexMovePct,
      imDeltaPct: p.imDeltaPct,
      profile: (p.profile ?? [1]).join('/'),
    },
    (d, ctx) => {
      const s = sec(d)
      if (ctx.tick === 0) {
        d.counters.marginWindowBase =
          s.hedge.elsSelfHedged * (s.custom.hedgeDelta ?? 0) * (p.fxTurn / p.fxBase)
      }
      const base = d.counters.marginWindowBase ?? 0
      const share = p.profile ? (p.profile[ctx.tick] ?? 0) : 1
      if (share === 0 || base <= 0) return
      const need = base * (-p.indexMovePct + p.imDeltaPct) * share
      if (need >= 0) {
        s.hedge.marginCallPending += need
        d.counters.marginCalled = (d.counters.marginCalled ?? 0) + need
        ctx.log(
          `증거금 통지 ${need.toFixed(0)} (명목 ${base.toFixed(0)}, 지수 ${(p.indexMovePct * 100).toFixed(2)}%, 개시증거금 +${(p.imDeltaPct * 100).toFixed(1)}%p)`,
        )
      } else {
        const release = -need
        const fromPending = Math.min(s.hedge.marginCallPending, release)
        s.hedge.marginCallPending -= fromPending
        const posted = d.counters.marginPosted ?? 0
        const back = Math.min(release - fromPending, posted)
        s.liquidity.fxLiquid += back
        d.counters.marginPosted = posted - back
        d.counters.marginReleased = (d.counters.marginReleased ?? 0) + fromPending + back
        ctx.log(
          `증거금 환급 ${(fromPending + back).toFixed(0)} (외화 유동자산 +${back.toFixed(0)})`,
        )
      }
      if (ctx.isLastTick) d.counters.marginWindowBase = 0
    },
    p.label,
  )
}

/** 일중 환율 변동을 미납 증거금 잔액에 반영한다(외화 표시 채무의 원화 환산). */
export function marginFxDrift(p: { fxAtTurnStart: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'marginFxDrift',
    { fxAtTurnStart: p.fxAtTurnStart },
    (d, ctx) => {
      const s = sec(d)
      if (s.hedge.marginCallPending <= 0) return
      const factor = d.market.fxUsdLocal / p.fxAtTurnStart
      if (!Number.isFinite(factor) || factor === 1) return
      const delta = s.hedge.marginCallPending * (factor - 1)
      s.hedge.marginCallPending += delta
      d.counters.marginFxRevalue = (d.counters.marginFxRevalue ?? 0) + delta
      ctx.log(
        `환율 재평가: 미납 증거금 ${delta >= 0 ? '+' : ''}${delta.toFixed(0)} (원/달러 ${p.fxAtTurnStart.toFixed(0)} → ${d.market.fxUsdLocal.toFixed(0)})`,
      )
    },
  )
}

/**
 * 증거금 납입 — **외화 유동자산에서만** 나간다. 원화 현금이 아무리 많아도 달러가 없으면 미납이다.
 * 납입액은 청산회사 예치금(`counters.marginPosted`)으로 쌓이고, 지수 반등 시 환급된다.
 */
export function payMarginFx(p: { label?: string } = {}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'payMarginFx',
    {},
    (d, ctx) => {
      const s = sec(d)
      const need = s.hedge.marginCallPending
      if (need <= 0) return
      const paid = Math.min(need, Math.max(0, s.liquidity.fxLiquid))
      s.liquidity.fxLiquid -= paid
      s.hedge.marginCallPending -= paid
      d.counters.marginPaid = (d.counters.marginPaid ?? 0) + paid
      d.counters.marginPosted = (d.counters.marginPosted ?? 0) + paid
      ctx.log(
        `증거금 납입 ${paid.toFixed(0)} (외화 유동자산 잔액 ${s.liquidity.fxLiquid.toFixed(0)}), 미납 ${s.hedge.marginCallPending.toFixed(0)}`,
      )
    },
    p.label,
  )
}

/**
 * 해외 증거금 마감 점검. 미납이 `tolerance`를 넘으면 청산회원이 헤지 포지션을 강제 청산한다:
 * 청산손실(미납액 × `closeOutMultiple`)이 자본에서 빠지고, 헤지가 사라져 시장위험액이 급증한다.
 * `margin_default` 플래그는 게임오버 규칙이 읽는다.
 */
export function marginCutoffCheck(
  p: { tolerance?: number; closeOutMultiple?: number } = {},
): Effect<SecuritiesState> {
  const tol = p.tolerance ?? 50
  const mult = p.closeOutMultiple ?? 1.5
  return fnEffect<SecuritiesState>(
    'marginCutoffCheck',
    { tolerance: tol, closeOutMultiple: mult },
    (d, ctx) => {
      const s = sec(d)
      if (s.hedge.marginCallPending <= tol) return
      const shortfall = s.hedge.marginCallPending
      d.counters.marginShortfall = Math.max(d.counters.marginShortfall ?? 0, shortfall)
      d.flags.margin_default = true
      d.flagTurns.margin_default ??= d.turnIndex
      s.equityCapital -= shortfall * mult
      s.risk.market += s.hedge.elsSelfHedged * (s.custom.hedgeDelta ?? 0) * 0.5
      s.custom.hedgeDelta = 0
      d.confidence.index = clamp(d.confidence.index - 25, 0, 100)
      d.regulator.level = 3
      ctx.log(
        `해외 증거금 마감 미납 ${shortfall.toFixed(0)} → 청산회원 강제 청산, 청산손실 ${(shortfall * mult).toFixed(0)}`,
      )
    },
  )
}

/**
 * 원화 담보를 주고 달러를 조달하는 FX 스왑. 체결 가능액은 상대방 한도(`capacityShare`)에 걸리며,
 * 비용은 스왑 베이시스(음수 = 달러 프리미엄)를 3개월 기준으로 자본에서 차감한다.
 */
export function fxSwapDraw(p: {
  amount: number
  capacityShare: number
  label?: string
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'fxSwapDraw',
    { amount: p.amount, capacityShare: p.capacityShare },
    (d, ctx) => {
      const s = sec(d)
      const want = Math.min(p.amount, Math.max(0, s.liquidity.cash))
      const got = want * clamp(p.capacityShare, 0, 1)
      if (got <= 0) {
        ctx.log('FX 스왑 데스크 한도 소진 — 체결 없음')
        return
      }
      const basis = Math.abs(d.market.custom.swapBasisBp ?? 0)
      const cost = got * (basis / 10000) * 0.25
      s.liquidity.cash -= got
      s.liquidity.fxLiquid += got
      s.equityCapital -= cost
      d.counters.fxSwapUsed = (d.counters.fxSwapUsed ?? 0) + got
      d.counters.fxCost = (d.counters.fxCost ?? 0) + cost
      ctx.log(
        `FX 스왑 ${got.toFixed(0)} 체결 (신청 ${p.amount}, 한도 소화율 ${(p.capacityShare * 100).toFixed(0)}%, 베이시스 −${basis}bp, 비용 ${cost.toFixed(0)})`,
      )
    },
    p.label,
  )
}

/**
 * 현물시장에서 달러를 산다. 공표 환율(외생 시계열)은 움직이지 않고 **자기 체결가에만** 슬리피지가
 * 붙는다(가이드 6.6). 규모가 클수록 슬리피지가 커지며, 누적 매입은 시장 압력 카운터로 기록된다.
 */
export function spotBuyUsd(p: {
  amount: number
  slippageBp: number
  label?: string
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'spotBuyUsd',
    { amount: p.amount, slippageBp: p.slippageBp },
    (d, ctx) => {
      const s = sec(d)
      const got = Math.min(p.amount, Math.max(0, s.liquidity.cash))
      if (got <= 0) return
      const slip = p.slippageBp * (1 + got / 10000)
      const cost = got * (slip / 10000)
      s.liquidity.cash -= got + cost
      s.liquidity.fxLiquid += got
      s.equityCapital -= cost
      d.counters.fxSpotBought = (d.counters.fxSpotBought ?? 0) + got
      d.counters.fxCost = (d.counters.fxCost ?? 0) + cost
      ctx.log(
        `현물 달러 매입 ${got.toFixed(0)} (체결 슬리피지 ${slip.toFixed(0)}bp, 비용 ${cost.toFixed(0)})`,
      )
    },
    p.label,
  )
}

/** 은행 외화 크레딧라인 인출(한도 내). */
export function drawFxLine(p: {
  amount: number
  rateBp: number
  label?: string
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'drawFxLine',
    { amount: p.amount, rateBp: p.rateBp },
    (d, ctx) => {
      const s = sec(d)
      const room = (s.custom.fxCreditLines ?? 0) - (s.custom.fxCreditLinesDrawn ?? 0)
      const got = Math.max(0, Math.min(p.amount, room))
      s.custom.fxCreditLinesDrawn = (s.custom.fxCreditLinesDrawn ?? 0) + got
      s.liquidity.fxLiquid += got
      d.counters.fxLineDrawn = (d.counters.fxLineDrawn ?? 0) + got
      d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
      ctx.log(
        `외화 크레딧라인 인출 ${got.toFixed(0)} / 신청 ${p.amount} (잔여 한도 ${(room - got).toFixed(0)})`,
      )
    },
    p.label,
  )
}

/** 거래은행을 통한 외화차입 약정. 직접 입찰 대상은 은행이며, 현금은 4/2 결제 때 들어온다. */
export function bokSwapBid(p: {
  amount: number
  allocationCap: number
  rateBp: number
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('bokSwapBid', { ...p }, (d, ctx) => {
    if (!d.flags.bok_swap_open || d.flags.bok_swap_used) {
      ctx.log('거래은행 연계 외화차입 신청이 열리지 않았거나 이미 약정되었습니다')
      return
    }
    const got = Math.max(0, Math.min(p.amount, p.allocationCap))
    d.counters.bokSwapPending = got
    d.counters.bokSwapRateBp = p.rateBp
    d.flags.bok_swap_used = true
    d.flagTurns.bok_swap_used ??= d.turnIndex
    ctx.log(
      `거래은행 외화차입 ${got.toFixed(0)} 약정 (신청 ${p.amount}, 모형 한도 ${p.allocationCap}); 4/2 입금 전 사용 불가`,
    )
  })
}

/** 4/2 정책자금 결제: 약정·예약 잔액을 한 번만 현금과 실제 차입 잔액으로 전환한다. */
export function settleAprilPolicyFunding(): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('settleAprilPolicyFunding', {}, (d, ctx) => {
    const s = sec(d)
    const fx = Math.max(0, d.counters.bokSwapPending ?? 0)
    const rp = Math.max(0, d.counters.bokRpPending ?? 0)
    s.liquidity.fxLiquid += fx
    s.liquidity.cash += rp
    s.funding.repo += rp
    d.counters.bokSwapDrawn = (d.counters.bokSwapDrawn ?? 0) + fx
    d.counters.policyFunding = (d.counters.policyFunding ?? 0) + rp
    if (fx > 0 || rp > 0) {
      d.counters.fundingCostBp = Math.max(
        d.counters.fundingCostBp ?? 0,
        fx > 0 ? (d.counters.bokSwapRateBp ?? 0) : 0,
        rp > 0 ? (d.counters.bokRpRateBp ?? 0) : 0,
      )
      ctx.log(`4/2 결제: 거래은행 외화차입 ${fx.toFixed(0)}, 한국은행 RP ${rp.toFixed(0)} 입금`)
    }
    d.counters.bokSwapPending = 0
    d.counters.bokRpPending = 0
  })
}

/**
 * 함정: 원화·외화 확정 라인을 한 번에 전액 인출한다. 오늘의 결제는 해결되지만 주거래은행 전부가
 * 같은 날 같은 신호를 읽는다 — 신뢰지수가 떨어지고 다음 턴 한도가 축소된다.
 */
export function drawAllLines(
  p: { ciPenalty: number } = { ciPenalty: 12 },
): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('drawAllLines', { ciPenalty: p.ciPenalty }, (d, ctx) => {
    const s = sec(d)
    const krw = Math.max(0, s.liquidity.creditLines - s.liquidity.creditLinesDrawn)
    const fx = Math.max(0, (s.custom.fxCreditLines ?? 0) - (s.custom.fxCreditLinesDrawn ?? 0))
    s.liquidity.creditLinesDrawn += krw
    s.liquidity.cash += krw
    s.custom.fxCreditLinesDrawn = (s.custom.fxCreditLinesDrawn ?? 0) + fx
    s.liquidity.fxLiquid += fx
    d.counters.fxLineDrawn = (d.counters.fxLineDrawn ?? 0) + fx
    d.counters.linesFullyDrawn = 1
    d.flags.lines_exhausted = true
    d.flagTurns.lines_exhausted ??= d.turnIndex
    d.confidence.index = clamp(d.confidence.index - p.ciPenalty, 0, 100)
    ctx.log(
      `확정 라인 일괄 인출: 원화 ${krw.toFixed(0)} + 외화 ${fx.toFixed(0)}, 신뢰지수 −${p.ciPenalty}`,
    )
  })
}

/** 다음 턴 은행이 라인 한도를 축소한다(일괄 인출의 후행 효과). */
export function cutCreditLines(p: { krwShare: number; fxShare: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('cutCreditLines', { ...p }, (d, ctx) => {
    const s = sec(d)
    const krwCut = Math.max(0, s.liquidity.creditLines - s.liquidity.creditLinesDrawn) * p.krwShare
    const fxCut =
      Math.max(0, (s.custom.fxCreditLines ?? 0) - (s.custom.fxCreditLinesDrawn ?? 0)) * p.fxShare
    s.liquidity.creditLines -= krwCut
    s.custom.fxCreditLines = (s.custom.fxCreditLines ?? 0) - fxCut
    ctx.log(`은행 라인 한도 축소: 원화 −${krwCut.toFixed(0)}, 외화 −${fxCut.toFixed(0)}`)
  })
}

/** CP·전단채 만기 차환. 실패분은 현금으로 상환하고 사다리를 한 칸 민다. */
export function cpRolloverStep(p: { label?: string } = {}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'cpRolloverStep',
    {},
    (d, ctx) => {
      const s = sec(d)
      const maturing = s.pf.abcpMaturing[0] ?? 0
      const roll = clamp(s.pf.rollRate, 0, 1)
      const shortfall = maturing * (1 - roll)
      s.funding.cp = Math.max(0, s.funding.cp - shortfall)
      s.liquidity.cash -= shortfall
      s.pf.abcpMaturing = [...s.pf.abcpMaturing.slice(1), 0]
      d.counters.cpShortfall = (d.counters.cpShortfall ?? 0) + shortfall
      d.counters.lastCpShortfall = shortfall
      ctx.log(
        `CP·전단채 만기 ${maturing.toFixed(0)} 중 차환 ${(roll * 100).toFixed(0)}% → 순상환 ${shortfall.toFixed(0)}`,
      )
    },
    p.label,
  )
}

/** 시장 차환 성공률을 기준값 + 자사 누적 조정치(`counters.rollAdj`)로 설정. */
export function setRollRate(base: number, reason?: string): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('setRollRate', { base }, (d, ctx) => {
    const adj = d.counters.rollAdj ?? 0
    sec(d).pf.rollRate = clamp(base + adj, 0.05, 1)
    ctx.log(
      `차환 성공률 → ${(sec(d).pf.rollRate * 100).toFixed(0)}% (시장 ${(base * 100).toFixed(0)}%${adj ? `, 자사 ${adj > 0 ? '+' : ''}${(adj * 100).toFixed(0)}%p` : ''})${reason ? ` — ${reason}` : ''}`,
    )
  })
}

/** 발행금리를 올려 차환률을 끌어올린다. 비용은 3개월 기준으로 자본에서 차감. */
export function payUpToRoll(p: { extraBp: number; rollGain: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('payUpToRoll', { ...p }, (d, ctx) => {
    const s = sec(d)
    d.counters.rollAdj = (d.counters.rollAdj ?? 0) + p.rollGain
    s.pf.rollRate = clamp(s.pf.rollRate + p.rollGain, 0.05, 1)
    d.counters.ownCpPremiumBp = (d.counters.ownCpPremiumBp ?? 0) + p.extraBp
    d.market.custom.ownCpRate = (d.market.custom.ownCpRate ?? 0) + p.extraBp / 100
    const cost = s.funding.cp * (p.extraBp / 10000) * 0.25
    s.equityCapital -= cost
    d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.extraBp)
    ctx.log(
      `발행금리 +${p.extraBp}bp → 차환률 +${(p.rollGain * 100).toFixed(0)}%p, 분기 조달비용 ${cost.toFixed(0)}`,
    )
  })
}

/**
 * 헤지 축소: 델타를 `share`만큼 줄인다. 증거금 소요는 즉시 줄지만 지수 위험이 열린 채로 남아
 * 시장위험액이 늘고(`riskAddRate`), 이후 지수 변동이 그대로 자본 손익이 된다.
 */
export function reduceHedge(p: {
  share: number
  riskAddRate?: number
  label?: string
}): Effect<SecuritiesState> {
  const rate = p.riskAddRate ?? 0.13
  return fnEffect<SecuritiesState>(
    'reduceHedge',
    { share: p.share, riskAddRate: rate },
    (d, ctx) => {
      const s = sec(d)
      const share = clamp(p.share, 0, 1)
      s.custom.hedgeDelta = (s.custom.hedgeDelta ?? 0) * (1 - share)
      const open = (d.counters.unhedgedShare ?? 0) + share * (1 - (d.counters.unhedgedShare ?? 0))
      d.counters.unhedgedShare = clamp(open, 0, 1)
      s.risk.market += s.hedge.elsSelfHedged * share * rate
      d.flags.hedge_reduced = true
      d.flagTurns.hedge_reduced ??= d.turnIndex
      ctx.log(
        `헤지 축소 ${(share * 100).toFixed(0)}%: 델타 → ${((s.custom.hedgeDelta ?? 0) * 100).toFixed(0)}%, 시장위험액 +${(s.hedge.elsSelfHedged * share * rate).toFixed(0)}`,
      )
    },
    p.label,
  )
}

/** 헤지가 열린 만큼 지수 변동이 자본 손익이 된다. 매 턴 진입 시 적용. */
export function unhedgedMark(p: { indexMovePct: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('unhedgedMark', { indexMovePct: p.indexMovePct }, (d, ctx) => {
    const open = d.counters.unhedgedShare ?? 0
    if (open <= 0) return
    const s = sec(d)
    const pnl = s.hedge.elsSelfHedged * open * p.indexMovePct * 0.4
    s.equityCapital += pnl
    d.counters.unhedgedPnl = (d.counters.unhedgedPnl ?? 0) + pnl
    ctx.log(
      `무헤지 구간 손익 ${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} (개방 비중 ${(open * 100).toFixed(0)}%, 지수 ${(p.indexMovePct * 100).toFixed(2)}%)`,
    )
  })
}

/**
 * 자체헤지 잔액의 일부를 백투백으로 전환한다. 증거금 의무가 상대방으로 넘어가고 시장위험액이 줄지만
 * 전환 수수료를 한 번에 지불한다. 위기 한복판의 전환 비용이 평시보다 비싸다는 것이 이 옵션의 교훈이다.
 */
export function convertToBackToBack(p: {
  share: number
  costBp: number
  label?: string
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>(
    'convertToBackToBack',
    { share: p.share, costBp: p.costBp },
    (d, ctx) => {
      const s = sec(d)
      const moved = s.hedge.elsSelfHedged * clamp(p.share, 0, 1)
      if (moved <= 0) return
      s.hedge.elsSelfHedged -= moved
      s.custom.elsBackToBack = (s.custom.elsBackToBack ?? 0) + moved
      s.risk.market = Math.max(0, s.risk.market - moved * 0.05)
      const cost = moved * (p.costBp / 10000)
      s.equityCapital -= cost
      d.counters.b2bConverted = (d.counters.b2bConverted ?? 0) + moved
      d.counters.b2bCost = (d.counters.b2bCost ?? 0) + cost
      d.flags.b2b_converted = true
      d.flagTurns.b2b_converted ??= d.turnIndex
      ctx.log(
        `백투백 전환 ${moved.toFixed(0)} (수수료 ${p.costBp}bp = ${cost.toFixed(0)}), 자체헤지 잔액 ${s.hedge.elsSelfHedged.toFixed(0)}`,
      )
    },
    p.label,
  )
}

/** 외화 유동자산 상시 보유 목표를 설정한다(금융위 2020.7.30의 10~20% 규정을 선제 도입). */
export function setFxLiquidityPolicy(p: { targetShare: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('setFxLiquidityPolicy', { ...p }, (d, ctx) => {
    const s = sec(d)
    d.counters.fxPolicyTarget = p.targetShare
    d.flags.fx_policy_set = true
    d.flagTurns.fx_policy_set ??= d.turnIndex
    const target = s.hedge.elsSelfHedged * p.targetShare
    ctx.log(
      `외화 유동자산 상시 보유 목표 ${(p.targetShare * 100).toFixed(0)}% (= ${target.toFixed(0)}) 설정`,
    )
  })
}

/**
 * 정책 창구 조달. 범위 일치(`scopeShare`)만큼만 소화되고, 플래그가 없으면 창구 자체가 닫혀 있다.
 * 채안펀드는 상담만, 증권금융은 모형의 확정 대출, 한은 RP는 4/2 결제 전 담보 예약만 반영한다.
 */
export function policyFunding(p: {
  programme: 'bondfund' | 'ksfloan' | 'bokrp'
  amount: number
  scopeShare: number
  rateBp: number
}): Effect<SecuritiesState> {
  const flagOf = {
    bondfund: 'bond_fund_open',
    ksfloan: 'ksf_loan_open',
    bokrp: 'bok_rp_open',
  } as const
  return fnEffect<SecuritiesState>(
    'policyFunding',
    { programme: p.programme, amount: p.amount, scopeShare: p.scopeShare },
    (d, ctx) => {
      if (!d.flags[flagOf[p.programme]]) {
        ctx.log(`${p.programme} 창구가 아직 열리지 않았습니다`)
        return
      }
      const s = sec(d)
      if (p.programme === 'bondfund') {
        // Neither eligibility nor an executable purchase is established by an application.
        d.counters.bondFundRequested = (d.counters.bondFundRequested ?? 0) + p.amount
        ctx.log('채안펀드 적격성·매입 일정 확인 요청: 확정 매입이 없어 현금·차입에 미반영')
        return
      }
      let got = p.amount * clamp(p.scopeShare, 0, 1)
      if (p.programme === 'bokrp') {
        // Reserve unencumbered collateral now; cash and repo debt arise at the 4/2 settlement.
        const room = Math.max(0, s.liquidity.sellableSecurities * 0.95)
        got = Math.max(0, Math.min(got, room))
        s.liquidity.sellableSecurities -= got / 0.95
        d.counters.bokRpPending = (d.counters.bokRpPending ?? 0) + got
        d.counters.bokRpRateBp = p.rateBp
        d.flags.policy_window_used = true
        d.flagTurns.policy_window_used ??= d.turnIndex
        ctx.log(
          `한국은행 RP ${got.toFixed(0)} 신청·담보 예약; 첫 입찰·입금은 4/2, 오늘 현금에 미포함`,
        )
        return
      } else {
        // Securities-finance loan, not issuance of our own CP. Individual terms are calibrated.
        const collateral = Math.max(0, s.liquidity.sellableSecurities)
        got = Math.min(got, collateral * 0.95)
        s.liquidity.sellableSecurities -= got / 0.95
        s.custom.ksfLoanDrawn = (s.custom.ksfLoanDrawn ?? 0) + got
      }
      s.liquidity.cash += got
      d.counters.policyFunding = (d.counters.policyFunding ?? 0) + got
      d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
      d.flags.policy_window_used = true
      d.flagTurns.policy_window_used ??= d.turnIndex
      ctx.log(
        `정책 창구(${p.programme}) 조달 ${got.toFixed(0)} / 신청 ${p.amount} (범위 일치 ${(p.scopeShare * 100).toFixed(0)}%)`,
      )
    },
  )
}

/** 증권시장안정펀드 출자 — 현금이 나가고 출자금은 영업용순자본 차감항목이 된다. */
export function equityFundContribution(p: { amount: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('equityFundContribution', { amount: p.amount }, (d, ctx) => {
    const s = sec(d)
    const paid = Math.min(p.amount, Math.max(0, s.liquidity.cash))
    s.liquidity.cash -= paid
    s.deductions += paid
    d.counters.equityFundPaid = (d.counters.equityFundPaid ?? 0) + paid
    d.flags.equity_fund_joined = true
    d.flagTurns.equity_fund_joined ??= d.turnIndex
    ctx.log(`증권시장안정펀드 출자 ${paid.toFixed(0)} (영업용순자본 차감항목 +${paid.toFixed(0)})`)
  })
}

/** RP 매도 확대(담보부 원화 조달). 담보 여력 = 미담보 채권 × (1 − 헤어컷). */
export function repoRaise(p: {
  amount: number
  haircut: number
  rateBp: number
}): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('repoRaise', { ...p }, (d, ctx) => {
    const s = sec(d)
    const cap = s.liquidity.sellableSecurities * (1 - p.haircut)
    const got = Math.max(0, Math.min(p.amount, cap))
    s.funding.repo += got
    s.liquidity.sellableSecurities -= got / (1 - p.haircut)
    s.liquidity.cash += got
    d.counters.repoRaised = (d.counters.repoRaised ?? 0) + got
    d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
    ctx.log(
      `RP 매도 ${got.toFixed(0)} (헤어컷 ${(p.haircut * 100).toFixed(0)}%, 담보 소진 ${(got / (1 - p.haircut)).toFixed(0)})`,
    )
  })
}

/** 결제일(턴 시작) 점검: 원화 현금이 음수면 지급불능. entryEffects의 마지막에 둔다. */
export function settlementCheck(): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('settlementCheck', {}, (d, ctx) => {
    if (sec(d).liquidity.cash < 0) {
      d.flags.insolvent = true
      d.flagTurns.insolvent ??= d.turnIndex
      ctx.log(`결제 실패: 원화 현금 ${sec(d).liquidity.cash.toFixed(0)} < 0`)
    }
  })
}

/**
 * 외화 유동성 현황 공표. 직전 스냅샷의 외화 유동자산이 목표(미납 증거금 + 다음 턴 예상 소요)를
 * 넘으면 검증 가능한 여력으로 읽혀 신뢰가 오르고, 미달이면 부족이 드러난다(가이드 6.5 / 6.4).
 */
export function discloseFxPosition(p: { minCover: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('discloseFxPosition', { minCover: p.minCover }, (d, ctx) => {
    const s = sec(d)
    if (s.liquidity.fxLiquid >= p.minCover) {
      d.confidence.index = clamp(d.confidence.index + 7, 0, 100)
      d.counters.rollAdj = (d.counters.rollAdj ?? 0) + 0.04
      s.pf.rollRate = clamp(s.pf.rollRate + 0.04, 0.05, 1)
      d.flags.fx_disclosed_verified = true
      d.flagTurns.fx_disclosed_verified ??= d.turnIndex
      ctx.log(`외화 유동성 공표: ${s.liquidity.fxLiquid.toFixed(0)} ≥ ${p.minCover} → ΔCI +7`)
    } else {
      d.confidence.index = clamp(d.confidence.index - 6, 0, 100)
      d.flags.fx_disclosure_backfired = true
      d.flagTurns.fx_disclosure_backfired ??= d.turnIndex
      ctx.log(
        `외화 유동성 공표: ${s.liquidity.fxLiquid.toFixed(0)} < ${p.minCover} → 부족이 드러남, ΔCI −6`,
      )
    }
  })
}

/** 자사 CP 발행금리 갱신(시장 CP91 + 프리미엄). */
export function setOwnCpRate(p: { premiumBp: number }): Effect<SecuritiesState> {
  return fnEffect<SecuritiesState>('setOwnCpRate', { premiumBp: p.premiumBp }, (d) => {
    const own = d.counters.ownCpPremiumBp ?? 0
    d.market.custom.ownCpRate = ((d.market.custom.cp91 ?? 0) + p.premiumBp + own) / 100
  })
}
