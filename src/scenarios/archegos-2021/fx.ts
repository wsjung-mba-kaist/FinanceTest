import type { Draft } from 'immer'
import type { Effect, GameState, PrimeBrokerState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'

/**
 * archegos-2021 시나리오 전용 효과 빌더. 엔진에는 `prime_broker` 공용 fx 모듈이 없으므로
 * (이 시나리오가 `PrimeBrokerState`를 쓰는 첫 시나리오다) 여기서 프라임브로커 회계를 정의한다.
 * 산식·앵커는 전부 `calibration.md`에 대응 절이 있다.
 *
 * ───────────────────────── 회계 규약 (calibration.md §1·§4) ─────────────────────────
 * 1. **책(book)**: `clients[0].positions[].notional`이 현재 시가 기준 명목이다. 항상
 *    `BASE_NOTIONAL[ticker] × counters.bookScale × (1 − counters.unwoundFraction) × markIndex/100`
 *    으로 다시 계산된다(`remark`). 이 한 줄이 마크·청산·한도 변경을 모두 흡수한다.
 * 2. **담보**: `clients[0].marginPosted`(정산 담보) + `custom.excessCollateral`(초과 담보).
 *    초과 담보는 고객이 반환을 요구할 수 있고, 반환하면 디폴트 시 그만큼 손실이 커진다.
 * 3. **청구권**: `custom.settledValue` = 담보가 마지막으로 정산된 시점의 책 평가액. 디폴트 손실은
 *    `settledValue − 청산대금 − 담보`이며, 부분 청산에서는 청산 비율로 안분한다.
 * 4. **미회수 익스포저**(`custom.marginShortfall`) = max(0, settledValue − 현재 평가액 − 담보).
 *    마진콜이 납입되지 않는 동안 이 값이 쌓이는 것이 곧 프라임브로커의 실질 익스포저다.
 * 5. **자기 체결가에만 할인**: 시장 시계열(티커·`market.custom.*`)은 외생으로 고정하고, 플레이어의
 *    매각 속도와 타 PB 이탈은 **알파인의 체결가**(slippage)와 **잔여 처분 가격**에만 영향을 준다
 *    (docs/authoring-guide.md §6.6).
 */

type PbDraft = Draft<GameState<PrimeBrokerState>>

// ───────────────────────────── 상수: 책 구성 ─────────────────────────────

/** 2021-03-22 종가 기준 명목($B). 합계 20.0 = 계획서 부록 B-3의 "고객 익스포저 $20bn". */
export const BASE_NOTIONAL: Record<string, number> = {
  VIAC: 5.0,
  DISCA: 3.0,
  BIDU: 4.5,
  GSX: 2.0,
  TME: 2.5,
  VIPS: 3.0,
}
export const BASE_BOOK = 20.0

/** 같은 기준 시점의 종목별 유통주식 비중(%). 명목과 같은 비율로 커지고 줄어든다. */
export const BASE_FLOAT_PCT: Record<string, number> = {
  VIAC: 7.0,
  DISCA: 12.0,
  BIDU: 2.0,
  GSX: 11.0,
  TME: 5.0,
  VIPS: 4.0,
}

/** 시나리오 전체의 기준 통화 단위는 $B (units.scale = 1e9). */
export const DEFAULT_STATIC_MARGIN_PCT = 7.5

// ───────────────────────────── 상수: 타 프라임브로커 ─────────────────────────────

export interface PeerBank {
  id: string
  name: string
  /** 2021-03-22 기준 명목 익스포저($B). 합계 140 + 알파인 20 = 160 (SEC PR 2022-70). */
  exposure: number
  /** 담보율. CS(알파인)의 7.5%가 업계 최저였다는 기록을 수치로 옮긴 것이다. */
  marginRate: number
  /** 이탈(선매도) 임계 압력. 낮을수록 먼저 판다. */
  threshold: number
  /** 이탈일에 블록으로 처리한 명목($B). 보도된 규모에서 역산. */
  blockNotional: number
}

/**
 * 실명 은행. 익스포저·담보율·임계값은 공개 기록(손실 규모, 매각 시점, 마진 관행)에서 역산한
 * **보정값**이며 각 은행의 실제 내부 수치가 아니다 (calibration.md §5).
 */
export const PEER_BANKS: PeerBank[] = [
  {
    id: 'ms',
    name: '모건스탠리',
    exposure: 28,
    marginRate: 0.13,
    threshold: 45,
    blockNotional: 8.0,
  },
  {
    id: 'gs',
    name: '골드만삭스',
    exposure: 34,
    marginRate: 0.25,
    threshold: 60,
    blockNotional: 10.5,
  },
  { id: 'ubs', name: 'UBS', exposure: 18, marginRate: 0.18, threshold: 65, blockNotional: 3.5 },
  { id: 'wf', name: '웰스파고', exposure: 14, marginRate: 0.25, threshold: 68, blockNotional: 2.0 },
  {
    id: 'others',
    name: '기타 프라임브로커(도이체·미즈호 등)',
    exposure: 23,
    marginRate: 0.275,
    threshold: 80,
    blockNotional: 4.0,
  },
  {
    id: 'nomura',
    name: '노무라',
    exposure: 20,
    marginRate: 0.275,
    threshold: 95,
    blockNotional: 0,
  },
  {
    id: 'mufg',
    name: '미쓰비시UFJ',
    exposure: 3,
    marginRate: 0.32,
    threshold: 100,
    blockNotional: 0,
  },
]

/** 이탈 시점 코드. 0 = 미이탈. */
export const EXIT_NONE = 0
export const EXIT_NIGHT = 1 // 3/25 야간(디폴트 통지 직후)
export const EXIT_OPEN = 2 // 3/26 개장
export const EXIT_MID = 3 // 3/26 장중
export const EXIT_CLOSE = 4 // 3/26 종가

export type ExitPoint = 'night' | 'open' | 'mid' | 'close'
const EXIT_CODE: Record<ExitPoint, number> = { night: 1, open: 2, mid: 3, close: 4 }

/** 시점 자체가 만드는 압력(시간이 갈수록 「먼저 팔자」가 이긴다). calibration.md §5. */
export const DAY_PRESSURE: Record<ExitPoint, number> = { night: 25, open: 45, mid: 55, close: 60 }

/**
 * 역사 경로에서 각 시점까지 누적 이탈한 은행 수. 알파인의 체결 할인은 **이 기준선과의 차이**에만
 * 반응하므로, 역사 경로에서는 peerFactor가 정확히 1.0이 되어 체크포인트가 보존된다.
 */
export const BASELINE_DEFECTORS: Record<ExitPoint, number> = { night: 1, open: 4, mid: 5, close: 5 }

/** 이탈 시점별 기본 손실률(정산 마크 대비). calibration.md §5. */
export const EXIT_LOSS_RATE: Record<ExitPoint, number> = {
  night: 0.16,
  open: 0.19,
  mid: 0.26,
  close: 0.3,
}
/** 끝까지 이탈하지 않은 은행의 손실률: 무질서 청산 vs 스탠드스틸이 유지된 질서 있는 정리. */
export const HELD_RATE_DISORDERLY = 0.42
export const HELD_RATE_ORDERLY = 0.18
/** 같은 시점에 함께 팔수록 값이 더 깨진다(동시 청산의 혼잡 비용). */
export const CROWD_RATE = 0.02
/** 플레이어가 먼저 팔면 이후 모든 이탈의 체결가가 더 나빠진다. */
export const SOLD_FIRST_PENALTY = 0.05
/**
 * 스탠드스틸이 「유지되었다」고 볼 이탈 은행 수 상한. 3곳 이하가 이탈했다는 것은 알파인을 포함한
 * 여덟 곳 중 다섯 곳이 합의를 지켰다는 뜻이며, 그 경우 잔여 정리는 질서 있게 진행된다.
 */
export const STANDSTILL_HELD_MAX = 3

// ───────────────────────────── 상수: 알파인의 체결 ─────────────────────────────

/** 슬리피지 계수: slip = slipK × (매각비율 / 0.15) × peerFactor. calibration.md §4. */
export const SLIP_K_INTRADAY = 0.012
export const SLIP_K_RESIDUAL = 0.002
/** 이탈 은행 1곳당 체결 할인 배수 증가분. */
export const PEER_SLIP = 0.18
/** 잔여 물량을 그 다음 주 이후에 처분할 때의 기준 마크(2021-03-22 = 1.0). */
export const RESIDUAL_BASE_MARK = 0.5925

// ───────────────────────────── 헬퍼 ─────────────────────────────

function pb(d: PbDraft): Draft<PrimeBrokerState> {
  return d.institution
}

function client(d: PbDraft) {
  return pb(d).clients[0]
}

function addCounter(d: PbDraft, key: string, v: number): void {
  d.counters[key] = (d.counters[key] ?? 0) + v
}

function setFlagOnce(d: PbDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function f2(n: number): string {
  return n.toFixed(2)
}

/** 현재 책 평가액($B). */
export function bookValue(s: PrimeBrokerState): number {
  const c = s.clients[0]
  if (!c) return 0
  return c.positions.reduce((sum, p) => sum + Math.abs(p.notional), 0)
}

/** 보유 담보 합계($B) = 정산 담보 + 초과 담보. */
export function collateralHeld(s: PrimeBrokerState): number {
  const c = s.clients[0]
  return (c?.marginPosted ?? 0) + (s.custom.excessCollateral ?? 0)
}

/** 최악 종목의 청산 소요일(엔진 `computePbExposure`와 같은 20% 참여율). */
export function worstDaysToLiquidate(s: PrimeBrokerState): number {
  const c = s.clients[0]
  if (!c) return 0
  let worst = 0
  for (const p of c.positions) {
    const cap = p.advNotional * 0.2
    if (cap <= 0) continue
    worst = Math.max(worst, Math.abs(p.notional) / cap)
  }
  return worst
}

/**
 * 책·파생 지표를 상태로부터 다시 계산한다. 마크·청산·한도 변경 뒤에는 항상 이것을 호출한다.
 * 명목 = BASE × bookScale × (1 − unwound) × markIndex/100.
 */
export function remark(d: PbDraft): void {
  const s = pb(d)
  const c = client(d)
  if (!c) return
  const scale = d.counters.bookScale ?? 1
  const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
  const mark = (s.custom.markIndex ?? 100) / 100
  for (const p of c.positions) {
    const base = BASE_NOTIONAL[p.ticker] ?? 0
    p.notional = base * scale * (1 - unwound) * mark
    // 유통주식 비중은 명목과 같은 비율로 커지고 줄어들지만 가격 마크에는 영향받지 않는다
    // (주식 수는 그대로이고 가격만 떨어지므로).
    p.pctOfFloat = (BASE_FLOAT_PCT[p.ticker] ?? 0) * scale * (1 - unwound)
  }
  const value = bookValue(s)
  const settled = s.custom.settledValue ?? value
  s.custom.marginShortfall = Math.max(0, settled * (1 - unwound) - value - collateralHeld(s))
  s.custom.maxPctOfFloat = c.positions.reduce((m, p) => Math.max(m, p.pctOfFloat ?? 0), 0)
  c.creditLimit = Math.max(c.creditLimit, 0)
  s.custom.knownOtherPbCount = c.otherPbCount ?? 0
}

// ───────────────────────────── 효과 빌더 ─────────────────────────────

export const archegosFx = {
  /**
   * 일별 마크(틱이 없는 턴). `moves`는 종목별 일간 수익률(−0.0906 = −9.06%)이며, 포지션은
   * 가치가중 평균으로, `market.custom.<ticker>` 지수는 종목별로 각각 움직인다.
   */
  markDaily(p: { moves: Record<string, number>; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'markDaily',
      { label: p.label, names: Object.keys(p.moves).join('/') },
      (d, ctx) => {
        const s = pb(d)
        const scale = d.counters.bookScale ?? 1
        const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
        const mark = (s.custom.markIndex ?? 100) / 100
        let before = 0
        let after = 0
        for (const [ticker, base] of Object.entries(BASE_NOTIONAL)) {
          const held = base * scale * (1 - unwound) * mark
          const mv = p.moves[ticker] ?? 0
          before += held
          after += held * (1 + mv)
          const idx = d.market.custom[ticker.toLowerCase()]
          if (idx !== undefined) d.market.custom[ticker.toLowerCase()] = idx * (1 + mv)
        }
        const factor = before > 0 ? after / before : 1
        s.custom.markIndex = (s.custom.markIndex ?? 100) * factor
        remark(d)
        ctx.log(
          `${p.label}: 책 마크 ${((factor - 1) * 100).toFixed(2)}% → 지수 ${f2(s.custom.markIndex)}, 평가액 ${f2(bookValue(s))}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 틱 턴의 일중 마크. `dayFactor`는 그날의 가치가중 종가 배수(예: 0.7204 = −27.96%),
   * `shape`는 누적 일중 분포(길이 = ticks, shape[0] = 0, 마지막 = 1). 틱 k의 목표 누적 배수는
   * `1 − (1 − dayFactor) × shape[k]`이며, 매 틱 그 비율만큼만 추가로 적용한다.
   * 티커(`market.custom.*`)는 엔진이 따로 움직이므로 여기서는 **포지션만** 건드린다.
   */
  markStep(p: { dayFactor: number; shape: number[]; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'markStep',
      { dayFactor: p.dayFactor, shape: p.shape.join('/'), label: p.label },
      (d, ctx) => {
        const k = ctx.tick
        const prevShape = k === 0 ? 0 : (p.shape[k - 1] ?? 0)
        const curShape = p.shape[k] ?? 0
        const drop = 1 - p.dayFactor
        const prevCum = 1 - drop * prevShape
        const curCum = 1 - drop * curShape
        if (prevCum <= 0) return
        const factor = curCum / prevCum
        if (Math.abs(factor - 1) < 1e-12) return
        const s = pb(d)
        s.custom.markIndex = (s.custom.markIndex ?? 100) * factor
        remark(d)
        ctx.log(
          `${p.label} 틱 ${k}: ${((factor - 1) * 100).toFixed(2)}% → 지수 ${f2(s.custom.markIndex)}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 마진 체계 변경. 동적 마진·집중도 가산을 도입하면 고객이 일부 물량을 다른 프라임브로커로
   * 옮기므로 책이 줄고(`bookScale`) 수수료가 줄지만, 담보율이 올라 꼬리위험이 줄어든다.
   */
  setMarginPolicy(p: {
    staticPct: number
    dynamic: boolean
    concentrationAddOn: boolean
    bookScale: number
    feeDelta: number
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'setMarginPolicy',
      {
        staticPct: p.staticPct,
        dynamic: p.dynamic,
        concentrationAddOn: p.concentrationAddOn,
        bookScale: p.bookScale,
      },
      (d, ctx) => {
        const s = pb(d)
        const c = client(d)
        s.marginPolicy.staticMarginPct = p.staticPct
        s.marginPolicy.dynamicMargin = p.dynamic
        s.marginPolicy.concentrationAddOn = p.concentrationAddOn
        s.custom.annualFeeRevenue = Math.max(0, (s.custom.annualFeeRevenue ?? 0) + p.feeDelta)
        if (c) c.marginPct = p.staticPct / 100
        if (p.dynamic) setFlagOnce(d, 'dynamic_margin')
        if (p.concentrationAddOn) setFlagOnce(d, 'concentration_add_on')
        // 디폴트 이후(사후 재설계)에는 책 배율·정산 기준을 건드리지 않는다 — 손익은 이미 확정되었다.
        if (d.flags.default_declared || p.bookScale < 0) {
          ctx.log(`${p.label}: 마진 정책만 변경(책·정산 기준 불변)`)
          return
        }
        d.counters.bookScale = p.bookScale
        remark(d)
        // 정책을 바꾸면 그 시점의 평가액으로 담보를 다시 맞춘다(정산).
        const value = bookValue(s)
        if (c) c.marginPosted = value * (p.staticPct / 100)
        s.custom.settledValue = value
        remark(d)
        ctx.log(
          `${p.label}: 마진 ${p.staticPct}%${p.dynamic ? ' + 동적' : ''}${p.concentrationAddOn ? ' + 집중도 가산' : ''}, 책 ${f2(value)}, 담보 ${f2(collateralHeld(s))}, 수수료 ${f2((s.custom.annualFeeRevenue ?? 0) * 1000)}M`,
        )
      },
      p.label,
    )
  },

  /** 한도만 올린다(FINMA: "초과된 한도는 반복해서 상향되었다"). 책이 커지고 담보율은 그대로다. */
  raiseLimit(p: { bookScale: number; feeDelta: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'raiseLimit',
      { bookScale: p.bookScale, feeDelta: p.feeDelta },
      (d, ctx) => {
        const s = pb(d)
        const c = client(d)
        addCounter(d, 'limitRaises', 1)
        s.custom.annualFeeRevenue = Math.max(0, (s.custom.annualFeeRevenue ?? 0) + p.feeDelta)
        if (d.flags.default_declared || p.bookScale < 0) {
          ctx.log(`${p.label}: 수수료만 조정(책·정산 기준 불변)`)
          return
        }
        d.counters.bookScale = p.bookScale
        remark(d)
        const value = bookValue(s)
        if (c) c.marginPosted = value * (s.marginPolicy.staticMarginPct / 100)
        if (c) c.creditLimit = value
        s.custom.settledValue = value
        remark(d)
        ctx.log(
          `${p.label}: 한도 상향(누적 ${d.counters.limitRaises ?? 0}회) → 책 ${f2(value)}, 담보 ${f2(collateralHeld(s))}`,
        )
      },
      p.label,
    )
  },

  /**
   * 초과 담보 반환. FINMA는 붕괴 2주 전 USD 24억 지급을 「대안 검토 없이」 이뤄진 위반으로 적시했다.
   * 반환하면 디폴트 시 손실이 그만큼 그대로 커진다.
   */
  returnExcessCollateral(p: { fraction: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'returnExcessCollateral',
      { fraction: p.fraction },
      (d, ctx) => {
        const s = pb(d)
        const excess = s.custom.excessCollateral ?? 0
        const returned = excess * clamp(p.fraction, 0, 1)
        if (returned <= 0) {
          ctx.log('반환할 초과 담보 없음')
          return
        }
        s.custom.excessCollateral = excess - returned
        addCounter(d, 'collateralReturned', returned)
        setFlagOnce(d, 'excess_returned')
        remark(d)
        ctx.log(
          `${p.label}: 초과 담보 ${f2(returned)} 반환 → 잔여 담보 ${f2(collateralHeld(s))}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /** 초과 담보를 붙잡아 둔다(집중도 가산의 담보 형태). */
  retainExcessCollateral(p: { add: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('retainExcessCollateral', { add: p.add }, (d, ctx) => {
      const s = pb(d)
      s.custom.excessCollateral = (s.custom.excessCollateral ?? 0) + p.add
      setFlagOnce(d, 'excess_retained')
      remark(d)
      ctx.log(`${p.label}: 초과 담보 유지 → 담보 ${f2(collateralHeld(s))}`)
    })
  },

  /**
   * 마진콜 발행.
   *   평가손실 D = 정산기준 × (1 − 청산비율) − 현재 평가액
   *   요구액     = max(0, 현재 평가액 × 요구담보율 + D − 보유 담보)
   * `requiredPct < 0`이면 현행 마진 정책(`marginPolicy.staticMarginPct`)을 쓴다.
   */
  issueMarginCall(p: { requiredPct: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'issueMarginCall',
      { requiredPct: p.requiredPct },
      (d, ctx) => {
        const s = pb(d)
        remark(d)
        const pct = (p.requiredPct < 0 ? s.marginPolicy.staticMarginPct : p.requiredPct) / 100
        const value = bookValue(s)
        const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
        const decline = (s.custom.settledValue ?? value) * (1 - unwound) - value
        const call = Math.max(0, value * pct + decline - collateralHeld(s))
        s.custom.marginCallOutstanding = call
        addCounter(d, 'marginCallsIssued', 1)
        if (call > 0) setFlagOnce(d, 'margin_call_issued')
        ctx.log(
          `${p.label}: 마진콜 ${f2(call)} 발행 (요구 담보율 ${(pct * 100).toFixed(1)}%, 평가액 ${f2(value)}, 평가손실 ${f2(decline)}, 담보 ${f2(collateralHeld(s))})`,
        )
      },
      p.label,
    )
  },

  /**
   * 마진 수령·정산. `fraction`(또는 `fractionCounter`가 가리키는 카운터의 %)만큼 요구액을 받는다.
   * 전액을 받으면 정산 기준(`settledValue`)을 현재 평가액으로 다시 세워 미회수 익스포저를 0으로
   * 만들고 담보를 요구 수준으로 재설정한다. 부분 수령은 정산 기준을 그대로 두고 담보만 늘린다.
   */
  settleMarginCall(p: {
    fraction?: number
    fractionCounter?: string
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'settleMarginCall',
      { fraction: p.fraction ?? -1, fractionCounter: p.fractionCounter ?? '' },
      (d, ctx) => {
        const s = pb(d)
        const c = client(d)
        if (!c) return
        const raw =
          p.fraction !== undefined ? p.fraction : (d.counters[p.fractionCounter ?? ''] ?? 0) / 100
        const f = clamp(raw, 0, 1)
        const call = s.custom.marginCallOutstanding ?? 0
        const received = call * f
        addCounter(d, 'marginReceived', received)
        if (f >= 1) {
          remark(d)
          const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
          const value = bookValue(s)
          c.marginPosted = value * (s.marginPolicy.staticMarginPct / 100)
          s.custom.settledValue = unwound < 1 ? value / (1 - unwound) : value
          s.custom.marginCallOutstanding = 0
        } else {
          c.marginPosted += received
          s.custom.marginCallOutstanding = call - received
        }
        remark(d)
        ctx.log(
          `${p.label}: 요구액 ${f2(call)} 중 ${(f * 100).toFixed(0)}%(${f2(received)}) 수령 → 담보 ${f2(collateralHeld(s))}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}`,
        )
      },
      p.label,
    )
  },

  /** 납입 유예. 담보는 들어오지 않고 미회수 익스포저만 하루 더 커진다. */
  grantGrace(p: { hours: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('grantGrace', { hours: p.hours }, (d, ctx) => {
      d.counters.graceHours = p.hours
      if (p.hours > 0) setFlagOnce(d, 'grace_granted')
      addCounter(d, 'marginReceived', 0)
      ctx.log(`${p.label}: 납입 유예 ${p.hours}시간 — 수령액 0`)
    })
  },

  /** 디폴트 선언. 청구 기준을 고정하고 청산을 연다. */
  declareDefault(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('declareDefault', {}, (d, ctx) => {
      const s = pb(d)
      if (d.flags.default_declared) return
      setFlagOnce(d, 'default_declared')
      remark(d)
      ctx.log(
        `${p.label}: 디폴트 선언 — 청구 기준 ${f2(s.custom.settledValue ?? 0)}, 담보 ${f2(collateralHeld(s))}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}`,
      )
    })
  },

  /**
   * 청산 슬라이스. `fraction`(전체 책 대비)을 현재 마크에서 체결한다.
   *   slip = slipK × (fraction / 0.15) × peerFactor,  peerFactor = 1 + 0.18 × (이탈수 − 기준선)
   * 체결 할인은 **알파인의 체결가에만** 적용되고 시장 시계열은 건드리지 않는다.
   */
  liquidateSlice(p: {
    fraction: number
    slipK?: number
    /** 지정하면 현재 마크 대신 이 배수(2021-03-22 = 1.0)로 체결한다 — 잔여 처분용. */
    markOverride?: number
    countAsBlock?: boolean
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'liquidateSlice',
      { fraction: p.fraction, slipK: p.slipK ?? SLIP_K_INTRADAY, label: p.label },
      (d, ctx) => {
        const s = pb(d)
        const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
        const f = Math.min(Math.max(0, p.fraction), 1 - unwound)
        if (f <= 1e-9) {
          ctx.log(`${p.label}: 청산할 잔량 없음`)
          return
        }
        const baseline = d.counters.peerBaseline ?? 0
        const defectors = s.custom.pbDefectors ?? 0
        const peerFactor = clamp(1 + PEER_SLIP * (defectors - baseline), 0.4, 3)
        const slipK = p.slipK ?? SLIP_K_INTRADAY
        const slip = clamp(slipK * (f / 0.15) * peerFactor, 0, 0.35)
        const mark = p.markOverride ?? (s.custom.markIndex ?? 100) / 100
        const exitMark = mark * (1 - slip)
        const scale = d.counters.bookScale ?? 1
        const sliceNotional = BASE_BOOK * scale * f
        const proceeds = sliceNotional * exitMark
        addCounter(d, 'liquidationProceeds', proceeds)
        addCounter(d, 'unwoundFraction', f)
        addCounter(d, 'soldToday', f)
        addCounter(d, 'soldNotional', sliceNotional * mark)
        if (p.countAsBlock) addCounter(d, 'blockSoldNotional', sliceNotional * mark)
        d.market.custom.blockDiscountBp = slip * 10000
        remark(d)
        recomputePnl(d)
        ctx.log(
          `${p.label}: ${(f * 100).toFixed(0)}% 청산 (마크 ${(mark * 100).toFixed(1)}, 할인 ${(slip * 100).toFixed(2)}%, 이탈 ${defectors}곳) → 대금 ${f2(proceeds)}, 누적 실현손실 ${f2(s.firm.realizedLoss)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 공동 정리에서 약속한 일일 매각 상한까지만 판다. 오늘 이미 판 만큼을 빼고 남은 여유만 체결하므로
   * 상한을 넘기지 않는다(여유가 없으면 아무것도 팔지 않는다).
   */
  liquidateToCap(p: { maxFraction: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'liquidateToCap',
      { maxFraction: p.maxFraction },
      (d, ctx) => {
        const cap = (d.counters.dailySellCapPct ?? 100) / 100
        const sold = d.counters.soldToday ?? 0
        const room = clamp(cap - sold, 0, p.maxFraction)
        if (room <= 1e-9) {
          ctx.log(`${p.label}: 오늘 상한 ${(cap * 100).toFixed(0)}%를 이미 채웠다 — 추가 매각 없음`)
          return
        }
        const inner = archegosFx.liquidateSlice({
          fraction: room,
          countAsBlock: true,
          label: `${p.label} (${(room * 100).toFixed(1)}%)`,
        })
        if (inner.kind === 'fn') inner.apply(d, ctx)
      },
    )
  },

  /**
   * 잔여 물량의 사후 처분(다음 주 이후). 기준 마크는 `RESIDUAL_BASE_MARK`에서 출발해
   * 자기 매도 속도·이탈 은행 수·스탠드스틸 유지 여부로 조정된다.
   */
  liquidateResidual(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('liquidateResidual', {}, (d, ctx) => {
      const s = pb(d)
      const remaining = 1 - clamp(d.counters.unwoundFraction ?? 0, 0, 1)
      if (remaining <= 1e-9) {
        ctx.log(`${p.label}: 잔여 물량 없음`)
        recomputePnl(d)
        return
      }
      const soldToday = d.counters.soldToday ?? 0
      const defectors = s.custom.pbDefectors ?? 0
      const held = d.flags.standstill_signed && defectors <= STANDSTILL_HELD_MAX
      const mark = clamp(
        RESIDUAL_BASE_MARK -
          0.12 * Math.max(0, soldToday - 0.35) -
          0.02 * Math.max(0, defectors - BASELINE_DEFECTORS.close) +
          (held ? 0.05 : 0),
        0.35,
        0.8,
      )
      const inner = archegosFx.liquidateSlice({
        fraction: remaining,
        slipK: SLIP_K_RESIDUAL,
        markOverride: mark,
        label: `${p.label} (기준 마크 ${(mark * 100).toFixed(1)})`,
      })
      if (inner.kind === 'fn') inner.apply(d, ctx)
      setFlagOnce(d, 'book_closed')
    })
  },

  /**
   * 타 프라임브로커의 반응. 압력이 각 은행의 임계값을 넘으면 그 시점에 이탈(선매도)한다.
   * 압력은 플레이어의 선택으로만 움직인다 — 고정 대본이 아니다.
   */
  peerReactionStep(p: { point: ExitPoint; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('peerReactionStep', { point: p.point }, (d, ctx) => {
      const s = pb(d)
      const pressure = peerPressure(d)
      const code = EXIT_CODE[p.point]
      const total = pressure + DAY_PRESSURE[p.point]
      const newly: PeerBank[] = []
      for (const bank of PEER_BANKS) {
        const key = `pbExit_${bank.id}`
        if ((d.counters[key] ?? EXIT_NONE) !== EXIT_NONE) continue
        if (total < bank.threshold) continue
        d.counters[key] = code
        newly.push(bank)
      }
      let defectors = 0
      let blocks = 0
      let msGs = 0
      for (const bank of PEER_BANKS) {
        const at = d.counters[`pbExit_${bank.id}`] ?? EXIT_NONE
        if (at === EXIT_NONE) continue
        defectors++
        blocks += bank.blockNotional
        if (bank.id === 'ms' || bank.id === 'gs') msGs += bank.blockNotional
      }
      s.custom.pbDefectors = defectors
      d.counters.peerBaseline = BASELINE_DEFECTORS[p.point]
      d.counters.peerBlockNotional = blocks
      d.counters.msGsBlockNotional = msGs
      d.counters[`pbCrowd_${code}`] = (d.counters[`pbCrowd_${code}`] ?? 0) + newly.length
      if (newly.length > 0) {
        addCounter(d, 'peerDefectionEvents', 1)
        ctx.log(
          `${p.label}: 압력 ${total.toFixed(0)} → 이탈 ${newly.map((b) => b.name).join(', ')} (누적 ${defectors}곳, 블록 누계 ${f2(blocks)})`,
        )
      } else {
        ctx.log(`${p.label}: 압력 ${total.toFixed(0)} → 신규 이탈 없음 (누적 ${defectors}곳)`)
      }
    })
  },

  /** 업계 합산 손실 확정(각 은행의 이탈 시점·담보율·혼잡도로 계산). */
  finaliseIndustryLoss(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('finaliseIndustryLoss', {}, (d, ctx) => {
      const s = pb(d)
      const defectors = s.custom.pbDefectors ?? 0
      const orderly = Boolean(d.flags.standstill_signed) && defectors <= STANDSTILL_HELD_MAX
      const penalty = d.flags.sold_first ? SOLD_FIRST_PENALTY : 0
      let peerLoss = 0
      const lines: string[] = []
      for (const bank of PEER_BANKS) {
        const at = d.counters[`pbExit_${bank.id}`] ?? EXIT_NONE
        let rate: number
        if (at === EXIT_NONE) {
          rate = orderly ? HELD_RATE_ORDERLY : HELD_RATE_DISORDERLY
        } else {
          const point = (['night', 'open', 'mid', 'close'] as ExitPoint[])[at - 1] ?? 'close'
          const crowd = d.counters[`pbCrowd_${at}`] ?? 1
          rate = EXIT_LOSS_RATE[point] + CROWD_RATE * Math.max(0, crowd - 1)
        }
        rate += penalty
        const loss = Math.max(0, bank.exposure * (rate - bank.marginRate))
        peerLoss += loss
        lines.push(`${bank.name} ${f2(loss)}`)
      }
      d.counters.peerLoss = peerLoss
      s.custom.industryLoss = peerLoss + s.firm.realizedLoss
      s.custom.industryExposure = PEER_BANKS.reduce((a, b) => a + b.exposure, 0) + BASE_BOOK
      ctx.log(
        `${p.label}: 타 PB 손실 ${f2(peerLoss)} (${lines.join(' · ')}) + 알파인 ${f2(s.firm.realizedLoss)} = 업계 ${f2(s.custom.industryLoss)}`,
      )
    })
  },

  /** 타 프라임브로커 노출 집계 요구(정보 결핍의 해소 시도). */
  aggregateOtherPbs(p: {
    revealedCount: number
    revealedExposure: number
    shareData: boolean
    label: string
  }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>(
      'aggregateOtherPbs',
      {
        revealedCount: p.revealedCount,
        revealedExposure: p.revealedExposure,
        shareData: p.shareData,
      },
      (d, ctx) => {
        const s = pb(d)
        const c = client(d)
        if (c) c.otherPbCount = p.revealedCount
        s.custom.knownOtherPbCount = p.revealedCount
        s.custom.industryExposure = p.revealedExposure
        setFlagOnce(d, 'other_pb_probed')
        if (p.shareData) setFlagOnce(d, 'pb_data_shared')
        remark(d)
        ctx.log(
          `${p.label}: 타 PB ${p.revealedCount}곳 확인, 업계 총익스포저 추정 ${f2(p.revealedExposure)}${p.shareData ? ' (동종 PB와 집계 공유)' : ''}`,
        )
      },
      p.label,
    )
  },

  /** 수수료 수입 조정(고객이 물량을 옮기거나 사업을 축소할 때). */
  feeImpact(p: { delta: number; label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('feeImpact', { delta: p.delta }, (d, ctx) => {
      const s = pb(d)
      s.custom.annualFeeRevenue = Math.max(0, (s.custom.annualFeeRevenue ?? 0) + p.delta)
      addCounter(d, 'feeDelta', p.delta)
      ctx.log(`${p.label}: 연간 수수료 ${f2((s.custom.annualFeeRevenue ?? 0) * 1000)}M`)
    })
  },

  /** 하루짜리 카운터를 리셋한다(일일 매각 상한·당일 수령액 판정을 위해 턴 진입 시 호출). */
  resetDaily(): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('resetDaily', {}, (d) => {
      d.counters.soldToday = 0
      d.counters.marginReceived = 0
    })
  },

  /** 약속한 일일 매각 상한 초과분을 기록한다(스탠드스틸 이행 판정). */
  checkSellCap(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('checkSellCap', {}, (d, ctx) => {
      if (!d.flags.standstill_signed) return
      const cap = (d.counters.dailySellCapPct ?? 100) / 100
      const sold = d.counters.soldToday ?? 0
      const breach = Math.max(0, sold - cap)
      d.counters.capBreachPct = Math.max(d.counters.capBreachPct ?? 0, breach * 100)
      if (breach > 1e-9) {
        setFlagOnce(d, 'cap_breached')
        ctx.log(
          `${p.label}: 약속한 일일 상한 ${(cap * 100).toFixed(0)}% 대비 ${(sold * 100).toFixed(0)}% 매각 — 초과 ${(breach * 100).toFixed(1)}%p`,
        )
      } else {
        ctx.log(
          `${p.label}: 일일 상한 ${(cap * 100).toFixed(0)}% 준수 (${(sold * 100).toFixed(0)}%)`,
        )
      }
    })
  },

  /** 손익·지표를 다시 계산한다(턴 마감·사후 정리용). */
  settleBooks(p: { label: string }): Effect<PrimeBrokerState> {
    return fnEffect<PrimeBrokerState>('settleBooks', {}, (d, ctx) => {
      remark(d)
      recomputePnl(d)
      const s = pb(d)
      ctx.log(
        `${p.label}: 실현손실 ${f2(s.firm.realizedLoss)}, 미회수 ${f2(s.custom.marginShortfall ?? 0)}, 잔여 ${((1 - (d.counters.unwoundFraction ?? 0)) * 100).toFixed(0)}%`,
      )
    })
  },
}

// ───────────────────────────── 내부 계산 ─────────────────────────────

/**
 * 타 프라임브로커에게 가해지는 압력. 전부 플레이어의 선택에서 나온다 (calibration.md §5).
 *   기저 8 (고객 디폴트 자체)
 *   + 100  플레이어가 먼저 팔았다
 *   + 30   공동 정리 합의가 없다
 *   + 15   합의는 했으나 검증 장치가 없다
 *   + 10/4 약속한 일일 매각 상한이 느슨하다(>15% / >8%)
 *   − 5    타 PB 노출 집계를 주도하고 데이터를 공유했다
 *   − 4    심야 통화에서 합의 준수를 확인해 주었다
 *   + 12   이미 약속한 상한을 어긴 것이 드러났다
 */
export function peerPressure(d: PbDraft): number {
  let p = 8
  if (d.flags.sold_first) p += 100
  if (!d.flags.standstill_signed) {
    p += 30
  } else {
    if (!d.flags.standstill_verified) p += 15
    const cap = d.counters.dailySellCapPct ?? 25
    if (cap > 15) p += 10
    else if (cap > 8) p += 4
  }
  if (d.flags.pb_data_shared) p -= 5
  if (d.flags.standstill_reaffirmed) p -= 4
  if (d.flags.cap_breached) p += 12
  return Math.max(0, p)
}

/**
 * 실현 손실 = max(0, 청구권 안분 − 청산대금 − 담보 안분).
 * 청구권은 마지막 정산 평가액(`settledValue`), 안분 비율은 누적 청산 비율이다.
 */
export function recomputePnl(d: PbDraft): void {
  const s = pb(d)
  const unwound = clamp(d.counters.unwoundFraction ?? 0, 0, 1)
  if (unwound <= 0) {
    s.firm.realizedLoss = 0
    return
  }
  const claim = (s.custom.settledValue ?? BASE_BOOK) * unwound
  const proceeds = d.counters.liquidationProceeds ?? 0
  const collateral = collateralHeld(s) * unwound
  s.firm.realizedLoss = Math.max(0, claim - proceeds - collateral)
  s.firm.capital = Math.max(0.01, s.firm.capital)
}
