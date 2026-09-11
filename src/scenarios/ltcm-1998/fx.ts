import type { Draft } from 'immer'
import type { Effect, GameState, PrimeBrokerState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'
import { computePbExposure } from '../../metrics/pbExposure'

/**
 * ltcm-1998 시나리오 전용 효과 빌더.
 *
 * 엔진에는 `prime_broker` 공용 fx 모듈이 없다(아케고스 시나리오도 자기 폴더에 따로 둔다). 여기서는
 * **1998년 딜러의 카운터파티 회계**를 `PrimeBrokerState` 위에 정의한다. 모든 산식은 calibration.md에
 * 대응 절이 있다.
 *
 * ───────────── 회계 규약 (calibration.md §2·§4) ─────────────
 * 1. **책(book)**: `clients[0].positions[].notional`은 우리와 LTCM 사이의 **상품군별 총명목**이며
 *    항상 `BASE_NOTIONAL × bookScale × (1 − unwoundFraction)`로 다시 계산된다(`remark`).
 *    일간 변동성도 `BASE_VOL × volMultiplier`로 다시 계산된다.
 * 2. **대체원가(replacement cost)**: 수렴 스프레드 종합지수 한 포인트당 `ourPv01B`. 명목이 $96B여도
 *    순대체원가는 수억 달러다 — **명목과 순익스포저의 자릿수 차이**가 이 시나리오의 핵심이다.
 * 3. **담보**: `clients[0].marginPosted`. 1998년 관행대로 초기증거금은 0에서 시작하고, 담보는 오직
 *    **현재 대체원가**만 덮는다(PWG). 순익스포저 = max(0, 대체원가 − 담보).
 * 4. **청산 손실**: `순익스포저 + 청산VaR × 군집계수`. 군집계수는 **동시에 청산에 나서는 딜러 수**로
 *    커진다(McDonough: "Markets would have moved sharply and losses would have been exaggerated").
 *    표시되는 `closeoutLossB`는 **우리가 아는 거래상대 수**로 계산되므로 실제보다 작다 —
 *    정보 결핍이 지표 자체를 틀리게 만든다는 것이 의도된 설계다.
 * 5. **자기 체결가에만 영향**: 시장 시계열(티커·`market.custom.*`)은 외생이고, 플레이어의 선택은
 *    자사의 손익·담보·타 딜러 협조도만 움직인다(docs/authoring-guide.md §6.6). 예외는 컨소시엄
 *    성립/결렬과 청산 속도인데, 이는 1998년 9월의 기록이 실제로 시장 결과를 갈랐던 분기다.
 */

type PbDraft = Draft<GameState<PrimeBrokerState>>

// ───────────────────────────── 상수: 우리 책 ─────────────────────────────

/** 상품군별 총명목($B, 1998-08-14 기준). 합계 96 = LTCM 전체 명목 ≈1,400의 6.9%. */
export const BASE_NOTIONAL: Record<string, number> = {
  SWAPSPD: 42,
  OFFRUN: 26,
  EQVOL: 14,
  EMSOV: 9,
  RISKARB: 5,
}

/** 상품군 한글 라벨(로그·서사용). */
export const POSITION_LABEL: Record<string, string> = {
  SWAPSPD: '스왑 스프레드 수렴',
  OFFRUN: '국채 온·오프더런 베이시스',
  EQVOL: '주가지수 변동성 매도',
  EMSOV: '신흥국 국채 베이시스',
  RISKARB: '합병차익 주식 스왑',
}

/** 명목 대비 일간 σ(volMultiplier 1.0 = 1998-08-14). */
export const BASE_VOL: Record<string, number> = {
  SWAPSPD: 0.0001,
  OFFRUN: 0.00009,
  EQVOL: 0.00032,
  EMSOV: 0.00052,
  RISKARB: 0.00035,
}

export const BASE_BOOK_B = 96
/** 수렴 스프레드 종합지수의 기준점(1998-08-14 = 100). */
export const CONVERGENCE_BASE = 100
/** 자사 수렴 북의 기준 규모($B) — ownPv01B가 이 규모에 대한 값이다. */
export const OWN_BOOK_BASE_B = 18

// ───────────────────────────── 상수: 군집 청산 ─────────────────────────────

/** 동시에 청산에 나서는 딜러 한 곳당 체결 손실 배수 증가분. */
export const CROWD_PER_DEALER = 0.05
/** 동시 청산자 수의 상한 = PWG가 손실을 추정한 "top 17 counterparties". */
export const MAX_LIQUIDATORS = 17

// ───────────────────────────── 상수: 타 딜러 ─────────────────────────────

export interface PeerDealer {
  id: string
  name: string
  /** 1998-09-23 실제 분담액($M). 0 = 불참. */
  pledgeM: number
  /** 참여 임계값. `peerCooperation + 선도 효과`가 이 값 이상이어야 들어온다. */
  reluctance: number
  /** 9/22 코어그룹(GS·ML·JPM + UBS) 여부. 플레이어가 메릴린치 자리를 대신한다. */
  core?: boolean
  /** 끝까지 불참한 두 곳(베어스턴스·크레디아그리콜). 플레이어가 바꿀 수 없다. */
  fixedOut?: boolean
}

/**
 * 실명 기관. 분담액은 GAO 명단 + McDonough "three firms contributing smaller amounts than the
 * other eleven" + Fed History 총액 $3,625M에서 역산한 것이며(11 × $300M + $125M + $100M + $100M),
 * **참여 임계값(reluctance)은 게임 보정값**이다(calibration.md §5.1). 플레이어(합성 딜러)가
 * 메릴린치의 자리를 대신하므로 핵심 $300M 그룹은 여기 10곳만 남는다.
 */
export const PEER_DEALERS: PeerDealer[] = [
  { id: 'gs', name: '골드만삭스', pledgeM: 300, reluctance: 20, core: true },
  { id: 'jpm', name: 'J.P.모건', pledgeM: 300, reluctance: 22, core: true },
  { id: 'ubs', name: 'UBS', pledgeM: 300, reluctance: 26, core: true },
  { id: 'chase', name: '체이스맨해튼', pledgeM: 300, reluctance: 30 },
  { id: 'ms', name: '모건스탠리 딘위터', pledgeM: 300, reluctance: 34 },
  { id: 'ssb', name: '살로몬스미스바니(트래블러스)', pledgeM: 300, reluctance: 38 },
  { id: 'csfb', name: '크레디스위스 퍼스트보스턴', pledgeM: 300, reluctance: 41 },
  { id: 'db', name: '도이체방크', pledgeM: 300, reluctance: 44 },
  { id: 'barc', name: '바클레이스', pledgeM: 300, reluctance: 46 },
  { id: 'bt', name: '뱅커스트러스트', pledgeM: 300, reluctance: 48 },
  { id: 'sg', name: '소시에테제네랄', pledgeM: 125, reluctance: 58 },
  { id: 'paribas', name: '파리바', pledgeM: 100, reluctance: 62 },
  { id: 'leh', name: '리먼브라더스', pledgeM: 100, reluctance: 66 },
  { id: 'bear', name: '베어스턴스', pledgeM: 0, reluctance: 999, fixedOut: true },
  { id: 'ca', name: '크레디아그리콜', pledgeM: 0, reluctance: 999, fixedOut: true },
]

/** 타 딜러 협조도의 상한. 베어스턴스·크레디아그리콜의 불참은 플레이어가 되돌릴 수 없다. */
export const PEER_COOP_CAP = 90
/** 컨소시엄 성립 최소 총액($M). 문서화된 $3,625M의 91% [CAL]. */
export const DEAL_MIN_M = 3300
/** 핵심 11개사의 균등 분담액($M). */
export const CORE_SHARE_M = 300

// ───────────────────────────── 헬퍼 ─────────────────────────────

function cu(d: PbDraft): Record<string, number> {
  return d.institution.custom
}

function num(rec: Record<string, number>, key: string, fallback: number): number {
  const v = rec[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function setFlagOnce(d: PbDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function addCounter(d: PbDraft, key: string, v: number): void {
  d.counters[key] = (d.counters[key] ?? 0) + v
}

function f2(n: number): string {
  return n.toFixed(2)
}

function f0(n: number): string {
  return n.toFixed(0)
}

/** 손익을 자본과 누적손실에 동시에 반영한다(양수 = 손실). */
function bookLoss(d: PbDraft, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return
  d.institution.firm.capital -= amount
  d.institution.firm.realizedLoss += amount
}

/** 현재 책의 청산 VaR($B) — 지표 행(`liquidationVaR`)과 같은 계산기를 쓴다. */
export function liquidationVaR(s: PrimeBrokerState): number {
  const c = s.clients[0]
  if (!c) return 0
  const r = computePbExposure({ positions: c.positions, marginPosted: c.marginPosted })
  return Number.isFinite(r.liquidationVaR) ? r.liquidationVaR : 0
}

/** 동시 청산자 수 → 체결 손실 배수. */
export function crowdFactor(liquidators: number): number {
  const n = clamp(liquidators, 1, MAX_LIQUIDATORS)
  return 1 + CROWD_PER_DEALER * (n - 1)
}

/**
 * **실제** 청산 손실($B). 표시 지표(`closeoutLossB`)와 달리 아는 거래상대 수가 아니라
 * PWG가 손실을 추정한 상위 17개 카운터파티 전부가 동시에 움직인다고 본다.
 */
export function actualCloseoutLoss(s: PrimeBrokerState): number {
  return num(s.custom, 'netExposureB', 0) + liquidationVaR(s) * crowdFactor(MAX_LIQUIDATORS)
}

/**
 * 자사 수렴 북의 **증분 마크**. 지수가 움직인 만큼만 손익을 인식하므로, 북 규모를 줄이면 그때까지의
 * 손실은 확정된 채로 남고 이후 민감도만 줄어든다(되돌려지지 않는다).
 */
function markOwnBook(d: PbDraft): void {
  const s = d.institution
  const idx = num(d.market.custom, 'convergenceIdx', CONVERGENCE_BASE)
  const prev = num(s.custom, 'ownMarkIdx', CONVERGENCE_BASE)
  if (Math.abs(idx - prev) < 1e-12) return
  const eff =
    num(s.custom, 'ownPv01B', 0.004) * (num(s.custom, 'ownConvergenceB', 0) / OWN_BOOK_BASE_B)
  const pnl = -eff * (idx - prev)
  s.custom.ownConvergencePnlB = num(s.custom, 'ownConvergencePnlB', 0) + pnl
  s.custom.ownMarkIdx = idx
  bookLoss(d, -pnl)
}

/**
 * 책·담보·익스포저 지표를 상태로부터 다시 계산한다. 마크·담보·한도·정보가 바뀐 뒤에는 항상 호출한다.
 */
export function remark(d: PbDraft): void {
  const s = d.institution
  const c = s.clients[0]
  if (!c) return
  const scale = num(s.custom, 'bookScale', 1)
  const unwound = clamp(num(s.custom, 'unwoundFraction', 0), 0, 1)
  const vol = num(s.custom, 'volMultiplier', 1)
  const live = scale * (1 - unwound)
  for (const p of c.positions) {
    p.notional = (BASE_NOTIONAL[p.ticker] ?? 0) * live
    p.dailyVolPct = (BASE_VOL[p.ticker] ?? 0) * vol
  }
  s.custom.ourNotionalB = c.positions.reduce((a, p) => a + Math.abs(p.notional), 0)

  const idx = num(d.market.custom, 'convergenceIdx', CONVERGENCE_BASE)
  s.custom.replacementCostB = num(s.custom, 'ourPv01B', 0.01) * (idx - CONVERGENCE_BASE) * live
  s.custom.netExposureB = Math.max(0, s.custom.replacementCostB - c.marginPosted)
  c.marginPct = s.custom.replacementCostB > 0 ? c.marginPosted / s.custom.replacementCostB : 0

  s.custom.knownCounterpartyCount = c.otherPbCount ?? 0
  const believed =
    num(s.custom, 'aggregateLeverageKnown', 0) >= 1
      ? Math.max(num(s.custom, 'trueCounterpartyCount', MAX_LIQUIDATORS), 1)
      : Math.max(c.otherPbCount ?? 1, 1)
  s.custom.crowdFactorEst = crowdFactor(believed)
  s.custom.closeoutLossB = s.custom.netExposureB + liquidationVaR(s) * s.custom.crowdFactorEst
}

/** 협조도를 움직이고 상한(90)·하한(0)으로 자른다. */
function bumpPeers(d: PbDraft, delta: number): number {
  const before = num(cu(d), 'peerCooperation', 50)
  const after = clamp(before + delta, 0, PEER_COOP_CAP)
  cu(d).peerCooperation = after
  return after
}

/** 컨소시엄 협상에서 부른 금액($M) → 확정 분담액($M). calibration.md §5.2. */
export function settleShareM(pledgeM: number): number {
  if (pledgeM <= 0) return 0
  // 핵심 11개사가 균등 분담($300M)을 전제로 협상하고 있으므로, 그 언저리를 부르면 표준으로 수렴한다.
  if (pledgeM >= 200 && pledgeM < CORE_SHARE_M) return CORE_SHARE_M
  return pledgeM
}

/** 컨소시엄 참여 여부와 확정 분담액이 타 딜러에게 주는 신호. */
export function leadershipEffect(joined: boolean, shareM: number): number {
  return joined ? 0.03 * shareM : -10
}

export interface ConsortiumOutcome {
  joined: boolean
  shareM: number
  peerPledgeM: number
  totalM: number
  joinCount: number
  closed: boolean
  joiners: PeerDealer[]
}

/** 순수 함수로 분리해 테스트가 시나리오를 돌리지 않고도 반응을 확인할 수 있게 한다. */
export function resolvePeers(
  peerCooperation: number,
  joined: boolean,
  pledgeM: number,
): ConsortiumOutcome {
  const shareM = joined ? settleShareM(pledgeM) : 0
  const score = peerCooperation + leadershipEffect(joined, shareM)
  const joiners = PEER_DEALERS.filter((p) => !p.fixedOut && p.reluctance <= score)
  const peerPledgeM = joiners.reduce((a, p) => a + p.pledgeM, 0)
  const totalM = peerPledgeM + shareM
  return {
    joined,
    shareM,
    peerPledgeM,
    totalM,
    joinCount: joiners.length + (joined ? 1 : 0),
    closed: totalM >= DEAL_MIN_M,
    joiners,
  }
}

// ───────────────────────────── 효과 빌더 ─────────────────────────────

export const ltcmFx = {
  /**
   * 턴 진입 시 그날의 외생 상태를 세운다: 수렴 스프레드 종합지수, 변동성 배수, LTCM의 자본·유동성.
   * 시장 금리·스프레드·VIX는 `op` 효과로 따로 세우고, 여기서는 **회계만** 다시 계산한다.
   */
  setDay(p: {
    convergenceIdx: number
    volMultiplier: number
    ltcmCapitalB: number
    ltcmLiquidityB: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'setDay',
      {
        convergenceIdx: p.convergenceIdx,
        volMultiplier: p.volMultiplier,
        ltcmCapitalB: p.ltcmCapitalB,
        ltcmLiquidityB: p.ltcmLiquidityB,
      },
      (d, ctx) => {
        d.market.custom.convergenceIdx = p.convergenceIdx
        const s = d.institution
        s.custom.volMultiplier = p.volMultiplier
        s.custom.ltcmCapitalB = p.ltcmCapitalB
        // 자본은 문서화된 외생 경로지만, 유동성은 **우리가 부른 담보만큼 더 마른다**.
        // 그래서 상한으로만 적용한다: 이미 더 낮아져 있으면 그 값을 유지한다.
        s.custom.ltcmLiquidityB = Math.min(
          num(s.custom, 'ltcmLiquidityB', p.ltcmLiquidityB),
          p.ltcmLiquidityB,
        )
        markOwnBook(d)
        remark(d)
        ctx.log(
          `${p.label}: 수렴지수 ${f0(p.convergenceIdx)}, 대체원가 ${f2(s.custom.replacementCostB ?? 0)}, ` +
            `순익스포저 ${f2(s.custom.netExposureB ?? 0)}, 청산손실 추정 ${f2(s.custom.closeoutLossB ?? 0)}, ` +
            `LTCM 자본 ${f2(p.ltcmCapitalB)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 일중 틱에서 수렴지수를 걷는다(티커가 시장 표시 계열을 움직이는 동안 회계는 여기서 따라간다).
   * `values[tick]`을 그대로 세우므로 variance 0에서 슬라이스 합이 단일 호출과 정확히 일치한다.
   */
  convergenceStep(p: { values: number[]; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'convergenceStep',
      { values: p.values.join('/') },
      (d, ctx) => {
        const v = p.values[ctx.tick]
        if (v === undefined) return
        d.market.custom.convergenceIdx = v
        markOwnBook(d)
        remark(d)
        ctx.log(
          `${p.label} 틱 ${ctx.tick}: 수렴지수 ${f0(v)} → 대체원가 ${f2(d.institution.custom.replacementCostB ?? 0)}, ` +
            `순익스포저 ${f2(d.institution.custom.netExposureB ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 담보 재산정 한 라운드. `markPct`는 대체원가에 적용하는 마크 배수다 —
   * 1.0 = 중간값 마크, 1.25 = **청산가치 마크**(PWG: "in many cases by seeking to apply possible
   * liquidation values to mark-to-market valuations").
   * `floorM`(또는 `useFloorCounter`로 읽는 `counters.marginCallM`)은 **당일 최소 청구액($M)**이며,
   * 마크가 만드는 청구액보다 클 수 있다 — 그 초과분이 곧 고객의 유동성을 직접 겨누는 압박이다.
   */
  remargin(p: {
    markPct: number
    floorM?: number
    /** 참이면 T3 대화에서 부른 `counters.marginCallM`을 최소 청구액으로 쓴다. */
    useFloorCounter?: boolean
    peerDelta?: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'remargin',
      {
        markPct: p.markPct,
        floorM: p.floorM ?? 0,
        useFloorCounter: p.useFloorCounter ?? false,
        peerDelta: p.peerDelta ?? 0,
      },
      (d, ctx) => {
        const s = d.institution
        const c = s.clients[0]
        if (!c) return
        remark(d)
        const required = Math.max(0, num(s.custom, 'replacementCostB', 0) * p.markPct)
        let call = Math.max(0, required - c.marginPosted)
        const floorM = p.useFloorCounter ? (d.counters.marginCallM ?? 0) : (p.floorM ?? 0)
        if (floorM > 0) call = Math.max(call, floorM / 1000)
        addCounter(d, 'remarginRounds', 1)
        if (call <= 1e-9) {
          remark(d)
          ctx.log(`${p.label}: 추가 청구 없음 (담보 ${f2(c.marginPosted)} ≥ 요구 ${f2(required)})`)
          if (p.peerDelta) bumpPeers(d, p.peerDelta)
          return
        }
        const liquidity = num(s.custom, 'ltcmLiquidityB', 0)
        const paid = Math.min(call, Math.max(0, liquidity))
        c.marginPosted += paid
        s.custom.ltcmLiquidityB = Math.max(0, liquidity - paid)
        s.custom.settledValueB = required
        s.custom.marginCalledB = num(s.custom, 'marginCalledB', 0) + call
        s.custom.marginPaidB = num(s.custom, 'marginPaidB', 0) + paid
        if (paid + 1e-9 < call) {
          setFlagOnce(d, 'ltcm_missed_call')
          ctx.log(`${p.label}: 청구 ${f2(call)} 중 ${f2(paid)}만 납입 — 미납 발생`)
        }
        if (p.peerDelta) bumpPeers(d, p.peerDelta)
        remark(d)
        ctx.log(
          `${p.label}: 마크 ×${p.markPct.toFixed(2)} → 청구 ${f2(call)}, 납입 ${f2(paid)}, ` +
            `담보 ${f2(c.marginPosted)}, 순익스포저 ${f2(s.custom.netExposureB ?? 0)}, ` +
            `LTCM 잔여 유동성 ${f2(s.custom.ltcmLiquidityB ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 초기증거금·집중도 가산을 도입한다. 담보율이 올라 꼬리위험이 줄지만, 고객은 일부 물량을 다른
   * 거래상대로 옮기므로 책이 줄고(bookScale) 수수료도 줄어든다. BCBS 46의 "sound practices" 방향.
   */
  setMarginPolicy(p: {
    staticPct: number
    dynamic: boolean
    concentrationAddOn: boolean
    bookScale: number
    /**
     * 실제로 예치되는 초기증거금($B). 기존 계약은 소급 변경할 수 없으므로 **신규 거래분에만**
     * 걸리며, 그래서 명목의 몇 %가 아니라 신규 회전분에 대한 금액으로 저작한다(calibration.md §4.2).
     */
    imB?: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'setMarginPolicy',
      {
        staticPct: p.staticPct,
        dynamic: p.dynamic,
        concentrationAddOn: p.concentrationAddOn,
        bookScale: p.bookScale,
        imB: p.imB ?? 0,
      },
      (d, ctx) => {
        const s = d.institution
        const c = s.clients[0]
        s.marginPolicy.staticMarginPct = p.staticPct
        s.marginPolicy.dynamicMargin = p.dynamic
        s.marginPolicy.concentrationAddOn = p.concentrationAddOn
        s.custom.bookScale = p.bookScale
        if (p.dynamic) setFlagOnce(d, 'dynamic_margin')
        if (p.concentrationAddOn) setFlagOnce(d, 'concentration_add_on')
        // 초기증거금은 대체원가와 무관하게 예치되는 완충이므로 담보에 바로 더한다.
        if (c && p.imB && p.imB > 0) {
          const liquidity = num(s.custom, 'ltcmLiquidityB', 0)
          const paid = Math.min(p.imB, Math.max(0, liquidity))
          c.marginPosted += paid
          s.custom.ltcmLiquidityB = Math.max(0, liquidity - paid)
          ctx.log(`초기증거금(신규 거래분) 예치: ${f2(paid)} (요구 ${f2(p.imB)})`)
        }
        remark(d)
        ctx.log(
          `${p.label}: 마진 ${p.staticPct}%${p.dynamic ? ' + 동적' : ''}` +
            `${p.concentrationAddOn ? ' + 집중도 가산' : ''}, 책 ${f2(s.custom.ourNotionalB ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 계약상 근거 없이 담보를 일방적으로 압류·처분한다. 오늘의 익스포저는 사라지지만 감독당국과
   * 다른 딜러가 즉시 안다. 불건전 행위(R4)이자 고객의 즉시 디폴트 유발.
   */
  seizeCollateral(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'seizeCollateral',
      {},
      (d, ctx) => {
        const s = d.institution
        const c = s.clients[0]
        if (!c) return
        const grab = Math.max(0, num(s.custom, 'ltcmLiquidityB', 0))
        c.marginPosted += grab
        s.custom.ltcmLiquidityB = 0
        setFlagOnce(d, 'unilateral_seizure')
        setFlagOnce(d, 'ltcm_early_default')
        bumpPeers(d, -25)
        remark(d)
        ctx.log(
          `${p.label}: 잔여 담보 ${f2(grab)} 일방 압류 → 고객 즉시 디폴트, 타 딜러 협조도 ${f0(num(s.custom, 'peerCooperation', 0))}`,
        )
      },
      p.label,
    )
  },

  /**
   * 익스포저 정보를 공유·교환한다. `revealTrue`면 LTCM의 실제 거래상대 수와 합산 레버리지를 알게 되고,
   * 그 순간 `closeoutLossB` 추정치가 **위로** 점프한다(지표가 비로소 맞아진다).
   */
  shareExposure(p: {
    peerDelta: number
    knownCount?: number
    revealTrue?: boolean
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'shareExposure',
      { peerDelta: p.peerDelta, knownCount: p.knownCount ?? 0, revealTrue: p.revealTrue ?? false },
      (d, ctx) => {
        const s = d.institution
        const c = s.clients[0]
        addCounter(d, 'infoShared', 1)
        const coop = bumpPeers(d, p.peerDelta)
        if (p.knownCount && c) c.otherPbCount = Math.max(c.otherPbCount ?? 0, p.knownCount)
        if (p.revealTrue) {
          s.custom.trueCounterpartyCount = 75
          s.custom.aggregateLeverageKnown = 1
          setFlagOnce(d, 'aggregate_known')
          if (c) c.otherPbCount = 75
        }
        const before = num(s.custom, 'closeoutLossB', 0)
        remark(d)
        ctx.log(
          `${p.label}: 협조도 ${f0(coop)}, 파악된 거래상대 ${f0(c?.otherPbCount ?? 0)}곳, ` +
            `청산손실 추정 ${f2(before)} → ${f2(s.custom.closeoutLossB ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /** 타 딜러 협조도만 움직인다(회의 참석·불참·조건부 서명 등). */
  peerSignal(p: { delta: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'peerSignal',
      { delta: p.delta },
      (d, ctx) => {
        const after = bumpPeers(d, p.delta)
        ctx.log(`${p.label}: 타 딜러 협조도 ${p.delta > 0 ? '+' : ''}${p.delta} → ${f0(after)}`)
      },
      p.label,
    )
  },

  /** 자사 수렴 북의 규모를 바꾼다. 지금까지의 손익은 확정된 채 남고 이후 민감도만 바뀐다. */
  resizeOwnBook(p: { scale: number; slippageB?: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'resizeOwnBook',
      { scale: p.scale, slippageB: p.slippageB ?? 0 },
      (d, ctx) => {
        const s = d.institution
        markOwnBook(d)
        const before = num(s.custom, 'ownConvergenceB', 0)
        s.custom.ownConvergenceB = before * p.scale
        if (p.slippageB && p.slippageB > 0) bookLoss(d, p.slippageB)
        ctx.log(
          `${p.label}: 자사 수렴 북 ${f2(before)} → ${f2(s.custom.ownConvergenceB)}` +
            `${p.slippageB ? `, 체결 비용 ${f2(p.slippageB)}` : ''}, 누적 손익 ${f2(num(s.custom, 'ownConvergencePnlB', 0))}`,
        )
      },
      p.label,
    )
  },

  /**
   * LTCM 북의 일부를 조기 종료(양자 청산)한다. 우리 익스포저는 줄지만 다른 딜러가 곧 알게 되고,
   * 고객의 유동성은 그만큼 더 빨리 마른다 — 죄수의 딜레마의 배신 수.
   */
  unwindBilateral(p: {
    fraction: number
    peerDelta: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'unwindBilateral',
      { fraction: p.fraction, peerDelta: p.peerDelta },
      (d, ctx) => {
        const s = d.institution
        const c = s.clients[0]
        if (!c) return
        const f = clamp(p.fraction, 0, 1)
        const rc = num(s.custom, 'replacementCostB', 0)
        // 종료분의 대체원가는 담보에서 정산된다. 담보가 모자라면 그만큼 손실이다.
        const settle = rc * f
        const fromCollateral = Math.min(settle, c.marginPosted)
        c.marginPosted -= fromCollateral
        const shortfall = settle - fromCollateral
        if (shortfall > 0) bookLoss(d, shortfall)
        s.custom.unwoundFraction = clamp(num(s.custom, 'unwoundFraction', 0) + f, 0, 1)
        s.custom.ltcmLiquidityB = Math.max(0, num(s.custom, 'ltcmLiquidityB', 0) - shortfall)
        bumpPeers(d, p.peerDelta)
        setFlagOnce(d, 'bilateral_unwind')
        remark(d)
        ctx.log(
          `${p.label}: 북의 ${(f * 100).toFixed(0)}% 조기 종료, 정산 ${f2(settle)}` +
            `(담보 ${f2(fromCollateral)} + 손실 ${f2(shortfall)}), 협조도 ${f0(num(s.custom, 'peerCooperation', 0))}`,
        )
      },
      p.label,
    )
  },

  /** LTCM의 조기 디폴트를 확정하고 단독·동시 청산 손실을 계상한다(게임오버 규칙이 받는다). */
  triggerEarlyDefault(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'triggerEarlyDefault',
      {},
      (d, ctx) => {
        const s = d.institution
        setFlagOnce(d, 'ltcm_early_default')
        d.market.custom.convergenceIdx = num(d.market.custom, 'convergenceIdx', 100) + 45
        markOwnBook(d)
        remark(d)
        const loss = actualCloseoutLoss(s)
        bookLoss(d, loss)
        s.custom.ltcmCapitalB = 0
        remark(d)
        ctx.log(
          `${p.label}: LTCM 디폴트 — 동시 청산 손실 ${f2(loss)} 확정, 자본 ${f2(s.firm.capital)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 9월 23일의 결말. 타 딜러의 참여는 **플레이어의 협조도와 출자 신호에 반응**하며, 총액이
   * 성립 최소선($3,300M)에 못 미치면 회의는 결렬되고 LTCM은 디폴트한다.
   */
  resolveConsortium(p: {
    joined: boolean
    orderly: boolean
    conditional?: boolean
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'resolveConsortium',
      { joined: p.joined, orderly: p.orderly, conditional: p.conditional ?? false },
      (d, ctx) => {
        const s = d.institution
        // 조건부 서명은 회의장에서 이탈 신호로 읽힌다.
        if (p.conditional) bumpPeers(d, -10)
        const coop = num(s.custom, 'peerCooperation', 50)
        // 대화를 걷지 않고 옵션이 바로 확정된 경우(마감 스윕·타임아웃)에는 협상에 참여하지 않은
        // 것이므로 회의가 제시하는 **핵심 참가사 표준 분담액**을 받아들인 것으로 본다.
        const pledgeM = d.counters.consortiumPledgeM || (p.joined ? CORE_SHARE_M : 0)
        const out = resolvePeers(coop, p.joined, pledgeM)

        s.custom.consortiumTotalM = out.totalM
        s.custom.peerJoinCount = out.joinCount
        s.custom.pledgedCapitalB = out.shareM / 1000
        setFlagOnce(d, 'consortium_resolved')
        ctx.log(
          `${p.label}: 협조도 ${f0(coop)} · 제시 ${f0(pledgeM)}M → 확정 분담 ${f0(out.shareM)}M, ` +
            `참여 ${out.joinCount}개사, 총액 ${f0(out.totalM)}M (성립선 ${DEAL_MIN_M}M)`,
        )

        if (!out.closed) {
          setFlagOnce(d, 'deal_failed')
          d.market.custom.convergenceIdx = num(d.market.custom, 'convergenceIdx', 100) + 45
          markOwnBook(d)
          remark(d)
          const loss = actualCloseoutLoss(s)
          bookLoss(d, loss)
          s.custom.ltcmCapitalB = 0
          remark(d)
          ctx.log(
            `회의 결렬 — LTCM 디폴트, 상위 17개 카운터파티 동시 청산. 자사 손실 ${f2(loss)}, 자본 ${f2(s.firm.capital)}`,
          )
          return
        }

        setFlagOnce(d, 'deal_closed')
        if (p.orderly) setFlagOnce(d, 'orderly_unwind')
        if (p.joined) {
          setFlagOnce(d, 'joined_consortium')
          s.firm.liquidityPool -= out.shareM / 1000
          // 질서 있는 청산이면 출자금은 대체로 회수되고, 서두르면 그만큼 값이 깨진다.
          bookLoss(d, (out.shareM / 1000) * (p.orderly ? 0.06 : 0.22))
          // 표준 분담에 못 미치는 소액 참여는 운영위원회에서 발언권이 제한된다.
          if (out.shareM < 200) {
            setFlagOnce(d, 'minor_participation')
            bumpPeers(d, -6)
          }
        } else {
          setFlagOnce(d, 'stayed_out')
          bumpPeers(d, -18)
        }
        // 인수 후 LTCM은 자본이 다시 채워진다(원소유자 10%는 그대로 남는다).
        s.custom.ltcmPostMoneyB = num(s.custom, 'ltcmCapitalB', 0.4) + out.totalM / 1000
        // 컨소시엄이 인수하면 우리 익스포저는 재자본화된 펀드에 대한 것이 되어 담보가 채워진다.
        const c = s.clients[0]
        if (c) c.marginPosted = Math.max(c.marginPosted, num(s.custom, 'replacementCostB', 0))
        // 시장 반응: 질서 있는 인수는 수렴 스프레드를 되돌리고, 서두르면 오히려 벌린다.
        const move = p.orderly ? -10 : 8
        d.market.custom.convergenceIdx = num(d.market.custom, 'convergenceIdx', 100) + move
        markOwnBook(d)
        remark(d)
        ctx.log(
          `컨소시엄 성립 — 참여 ${out.joinCount}개사 $${f0(out.totalM)}M(지분 90%). ` +
            `수렴지수 ${move > 0 ? '+' : ''}${move}, 자사 누적 손실 ${f2(s.firm.realizedLoss)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 에필로그. 컨소시엄 성립·청산 속도에 따라 수렴 스프레드가 더 움직이고, 자사 수렴 북 중
   * `keepFraction`만 그 움직임에 노출된다. 처분분에는 체결 비용이 붙는다.
   */
  settleOwnBook(p: {
    keepFraction: number
    slippagePerUnit: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'settleOwnBook',
      { keepFraction: p.keepFraction, slippagePerUnit: p.slippagePerUnit },
      (d, ctx) => {
        const s = d.institution
        markOwnBook(d)
        const keep = clamp(p.keepFraction, 0, 1)
        const book = num(s.custom, 'ownConvergenceB', 0)
        const sold = book * (1 - keep)
        if (sold > 0) bookLoss(d, sold * p.slippagePerUnit)
        s.custom.ownConvergenceB = book * keep
        // 결말별 사후 스프레드 이동. 10/15 정례 회의 밖 인하까지의 경로를 한 번에 반영한다.
        const epilogue = d.flags.deal_failed
          ? 30
          : d.flags.orderly_unwind
            ? -22
            : d.flags.deal_closed
              ? -6
              : 10
        d.market.custom.convergenceIdx = num(d.market.custom, 'convergenceIdx', 100) + epilogue
        markOwnBook(d)
        remark(d)
        ctx.log(
          `${p.label}: 잔여 북 ${f2(s.custom.ownConvergenceB)} (처분 ${f2(sold)}, 비용 ${f2(sold * p.slippagePerUnit)}), ` +
            `사후 수렴지수 ${epilogue > 0 ? '+' : ''}${epilogue} → ${f0(num(d.market.custom, 'convergenceIdx', 0))}, ` +
            `누적 손실 ${f2(s.firm.realizedLoss)}`,
        )
      },
      p.label,
    )
  },
}
