import type { Draft } from 'immer'
import type { AssetManagerState, Effect, EffectContext, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'

/**
 * covid-2020-fund 전용 효과 빌더.
 *
 * 엔진에는 `asset_manager` 공용 fx 모듈이 없으므로(이 시나리오가 첫 사용자다) uk-ldi-2022의
 * `ldiFx.ts`와 같은 방식으로 시나리오 로컬 모듈을 둔다. 모든 함수는 순수하고 결정론적이며
 * `Math.random`·시계를 쓰지 않는다.
 *
 * ── 회계 규약 (docs/scenarios/covid-2020-fund.md §6) ────────────────────────────────
 * 자산 = liquidity.daily + weekly + monthly + illiquid (유동성 사다리 4구간)
 * NAV  = 자산 − custom.creditLineDrawn
 * 좌당 순자산 = NAV / fund.shares, navIndex = 좌당 순자산 / $10.00 × 100
 *
 * 시가평가: 구간별 유효 듀레이션으로 국채금리(Δy)와 신용스프레드(ΔOAS)를 반영한다.
 *   ΔP/P = −(rateDur × Δy + spreadDur × Δs) / 10,000
 * 여기에 **집중도 마크다운**을 더한다: 유동자산을 먼저 팔아 비유동 비중이 올라간 포트폴리오는
 * 같은 시장 충격에 더 크게 상각된다(Ma·Xiao·Zeng 2022의 "역(逆) 유동성 도피"의 귀결).
 *
 * 환매 충당: 슬라이싱 정책이 **순서**를 정하고, 구간별 **당일 처분 한도**가 실제 가능 금액을 정한다.
 * 한도를 다 쓰고도 모자라면 그날의 환매를 지급하지 못하고 강제 게이트가 발동한다.
 *
 * 희석: 잔존 투자자의 좌당 순자산 하락분을 bp로 누적한다. 스윙프라이싱이 거래비용을
 * 환매자에게 전가한 만큼 희석은 줄어든다. 스윙폭이 실제 비용과 같으면 희석은 정확히 0이다.
 */

type AmDraft = Draft<GameState<AssetManagerState>>
type Bucket = 'daily' | 'weekly' | 'monthly' | 'illiquid'
export type SlicingPolicy = 'horizontal' | 'vertical' | 'mixed' | 'illiquidFirst'

/** 기준일 좌당 순자산($). navIndex = 좌당 순자산 / 이 값 × 100. */
export const BASE_NAV_PER_SHARE = 10

/** 구간별 유효 듀레이션과 평시 왕복 거래비용(bp) [CAL facts.ts cal.duration.*]. */
export const BUCKETS: Record<
  Bucket,
  {
    rateDur: number
    igDur: number
    hyDur: number
    costBp: number
    capPerDay: number
    label: string
  }
> = {
  daily: { rateDur: 2.0, igDur: 0, hyDur: 0, costBp: 2, capPerDay: 1, label: '현금·국채(단기)' },
  weekly: {
    rateDur: 7.0,
    igDur: 2.5,
    hyDur: 0,
    costBp: 15,
    capPerDay: 0.3,
    label: '장기국채·벤치마크 IG',
  },
  monthly: {
    rateDur: 7.5,
    igDur: 5.5,
    hyDur: 0,
    costBp: 40,
    capPerDay: 0.08,
    label: '일반 IG 회사채',
  },
  illiquid: {
    rateDur: 4.0,
    igDur: 0,
    hyDur: 4.0,
    costBp: 120,
    capPerDay: 0.025,
    label: 'HY·오프벤치마크',
  },
}

export const BUCKET_ORDER: Bucket[] = ['daily', 'weekly', 'monthly', 'illiquid']

/** 집중도 마크다운 계수 [CAL facts.ts cal.concentrationDrag.k]. */
export const CONCENTRATION_K = 6
/** 집중도 마크다운이 시작되는 비유동 비중(%) — 기준일 포트폴리오 구성. */
export const CONCENTRATION_BASE_PCT = 34
/** 강제 게이트 판정을 위한 미지급 최소 금액($M). 반올림 오차를 흡수한다. */
export const SHORTFALL_TOLERANCE = 1

/**
 * ETF 할인폭 중 "기초자산 평가가격의 지연"으로 볼 수 있는 몫 [CAL].
 * 평가를 갱신하지 않은 채 환매를 지급하면 이만큼이 잔존 투자자 → 환매자로 이전된다.
 */
export const STALE_PRICING_SHARE = 0.6

// ─────────────────────────────────────────────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────────────────────────────────────────────

function am(d: AmDraft): Draft<AssetManagerState> {
  return d.institution
}

function f1(n: number): string {
  return n.toFixed(1)
}

function addCounter(d: AmDraft, key: string, v: number): void {
  d.counters[key] = (d.counters[key] ?? 0) + v
}

function setFlagOnce(d: AmDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function bucketValue(s: Draft<AssetManagerState>, b: Bucket): number {
  return s.liquidity[b]
}

function setBucket(s: Draft<AssetManagerState>, b: Bucket, v: number): void {
  s.liquidity[b] = Math.max(0, v)
}

export function totalAssets(s: { liquidity: Record<Bucket, number> }): number {
  return s.liquidity.daily + s.liquidity.weekly + s.liquidity.monthly + s.liquidity.illiquid
}

export function navPerShare(s: {
  liquidity: Record<Bucket, number>
  fund: { shares: number }
  custom: Record<string, number>
}): number {
  const nav = totalAssets(s) - (s.custom.creditLineDrawn ?? 0)
  return s.fund.shares > 0 ? nav / s.fund.shares : 0
}

/** 시장 스트레스 계수: 거래비용이 오를수록 당일 처분 가능 비율이 줄어든다. */
export function stressFactor(s: Draft<AssetManagerState>): number {
  const cost = s.custom.bidAskIgBp || 30
  return clamp(30 / cost, 0.15, 1)
}

/**
 * 파생값 재계산. 모든 상태 변경 함수의 마지막에 호출한다.
 * nav·navIndex·leverage·illiquidSharePct를 구간 잔고와 차입 잔액으로부터 다시 만든다.
 */
export function syncDerived(d: AmDraft): void {
  const s = am(d)
  const assets = totalAssets(s)
  const drawn = s.custom.creditLineDrawn ?? 0
  s.fund.nav = Math.max(0, assets - drawn)
  s.fund.leverage = s.fund.nav > 0 ? assets / s.fund.nav : 1
  s.custom.illiquidSharePct = assets > 0 ? (s.liquidity.illiquid / assets) * 100 : 0
  const nps = s.fund.shares > 0 ? s.fund.nav / s.fund.shares : 0
  s.custom.navIndex = (nps / BASE_NAV_PER_SHARE) * 100
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 시가평가
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * 마지막으로 마크한 시장 수준(counters.priced*) 대비 현재 시장 수준까지 포트폴리오를 시가평가한다.
 * 턴 진입(marketOpen)과 틱마다(eachTick) 호출하므로, 틱 티커가 움직인 스프레드도 곧바로 반영된다.
 */
export function markBook(d: AmDraft, ctx: EffectContext): void {
  const s = am(d)
  const pricedY = d.counters.pricedGovt10yBp ?? d.market.govt10yBp
  const pricedIg = d.counters.pricedIgBp ?? d.market.creditSpreadIgBp
  const pricedHy = d.counters.pricedHyBp ?? d.market.creditSpreadHyBp
  const dy = d.market.govt10yBp - pricedY
  const dig = d.market.creditSpreadIgBp - pricedIg
  const dhy = d.market.creditSpreadHyBp - pricedHy
  d.counters.pricedGovt10yBp = d.market.govt10yBp
  d.counters.pricedIgBp = d.market.creditSpreadIgBp
  d.counters.pricedHyBp = d.market.creditSpreadHyBp
  if (dy === 0 && dig === 0 && dhy === 0) return
  const navBefore = s.fund.nav
  // 집중도 마크다운: 비유동 비중이 기준(35%)을 넘는 만큼 HY 스프레드 확대에 더 크게 상각된다.
  const excess = Math.max(0, (s.custom.illiquidSharePct ?? 0) - CONCENTRATION_BASE_PCT) / 100
  const drag = excess > 0 && dhy > 0 ? (CONCENTRATION_K * excess * dhy) / 10000 : 0
  for (const b of BUCKET_ORDER) {
    const cfg = BUCKETS[b]
    const ret = -(cfg.rateDur * dy + cfg.igDur * dig + cfg.hyDur * dhy) / 10000
    const extra = b === 'monthly' || b === 'illiquid' ? -drag : 0
    setBucket(s, b, bucketValue(s, b) * (1 + ret + extra))
  }
  syncDerived(d)
  applyEtfMarkdown(d, ctx)
  const pnl = s.fund.nav - navBefore
  if (drag > 0) addCounter(d, 'concentrationDragUsd', navBefore * drag * 0.8)
  ctx.log(
    `시가평가 [10y ${dy >= 0 ? '+' : ''}${dy}bp · IG ${dig >= 0 ? '+' : ''}${dig}bp · HY ${dhy >= 0 ? '+' : ''}${dhy}bp${drag > 0 ? ` · 집중도 마크다운 ${(drag * 100).toFixed(2)}%` : ''}] → NAV ${f1(pnl)} (${f1(s.fund.nav)}), 기준가 ${(s.custom.navIndex ?? 0).toFixed(2)}`,
  )
}

/**
 * ETF 시사가 반영(가격 발견 수용)의 **가역적** 조정.
 *
 * 채택하면 그 시점의 할인폭 × 선택한 비율만큼 회사채 구간 평가를 낮추고, 할인폭이 좁아지면
 * 같은 식으로 되돌린다 — 마크다운은 손실의 인식이지 손실 자체가 아니기 때문이다.
 * 채택하지 않으면 `counters.etfMarkdownFraction`이 0이라 아무 일도 일어나지 않는다.
 */
export function applyEtfMarkdown(d: AmDraft, ctx: EffectContext): void {
  const s = am(d)
  const fraction = d.counters.etfMarkdownFraction ?? 0
  if (fraction <= 0) return
  const gap = Math.max(0, -(d.market.custom.etfDiscountPct ?? 0)) / 100
  const target = gap * fraction
  const applied = d.counters.etfMarkdownApplied ?? 0
  if (Math.abs(target - applied) < 1e-12) return
  const factor = (1 - target) / (1 - applied)
  s.liquidity.monthly *= factor
  s.liquidity.illiquid *= factor
  d.counters.etfMarkdownApplied = target
  syncDerived(d)
  ctx.log(
    `ETF 시사가 반영 ${(applied * 100).toFixed(2)}% → ${(target * 100).toFixed(2)}% (기준가 ${(s.custom.navIndex ?? 0).toFixed(2)})`,
  )
}

/** 갱신되지 않은 평가가격이 만들어내는 환매자↔잔존 투자자 이전 비율. */
export function staleGapOf(d: AmDraft): number {
  const gap = Math.max(0, -(d.market.custom.etfDiscountPct ?? 0)) / 100
  return Math.max(0, gap * STALE_PRICING_SHARE - (d.counters.etfMarkdownApplied ?? 0))
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 환매 충당
// ─────────────────────────────────────────────────────────────────────────────────────

interface RaiseResult {
  gross: number
  cost: number
  shortfall: number
  fromBucket: Record<Bucket, number>
}

/** 구간별 당일 처분 잔여 한도. `daily`는 현금이므로 한도가 없다. */
function remainingCapacity(d: AmDraft, b: Bucket): number {
  const s = am(d)
  if (b === 'daily') return bucketValue(s, b)
  if (d.flags.ringfence_liquid && b === 'weekly') return 0
  const base = d.counters[`window_${b}`] ?? bucketValue(s, b)
  const cap = base * BUCKETS[b].capPerDay * stressFactor(s)
  const used = d.counters[`sold_${b}`] ?? 0
  return Math.max(0, Math.min(bucketValue(s, b), cap - used))
}

function ringfenced(d: AmDraft, b: Bucket): boolean {
  return Boolean(d.flags.ringfence_liquid) && (b === 'daily' || b === 'weekly')
}

/** 한 구간에서 `want`만큼 조달했을 때의 거래비용(bp). 규모가 클수록 비싸진다. */
function costBpFor(d: AmDraft, b: Bucket, want: number): number {
  const s = am(d)
  const bal = Math.max(1e-9, bucketValue(s, b))
  const share = clamp(want / bal, 0, 1)
  const stress = b === 'daily' ? 1 : (s.custom.bidAskIgBp || 30) / 30
  return BUCKETS[b].costBp * stress * (1 + 2 * Math.sqrt(share))
}

/** 슬라이싱 정책이 정하는 목표 배분(합 1). 실제 금액은 처분 한도로 다시 깎인다. */
function targetWeights(d: AmDraft, policy: SlicingPolicy): Record<Bucket, number> {
  const s = am(d)
  const assets = totalAssets(s)
  const pro: Record<Bucket, number> = {
    daily: assets > 0 ? s.liquidity.daily / assets : 0,
    weekly: assets > 0 ? s.liquidity.weekly / assets : 0,
    monthly: assets > 0 ? s.liquidity.monthly / assets : 0,
    illiquid: assets > 0 ? s.liquidity.illiquid / assets : 0,
  }
  if (policy === 'vertical') return pro
  if (policy === 'mixed') {
    return {
      daily: 0.5 + 0.5 * pro.daily,
      weekly: 0.5 * pro.weekly,
      monthly: 0.5 * pro.monthly,
      illiquid: 0.5 * pro.illiquid,
    }
  }
  // horizontal / illiquidFirst 는 순서로만 표현한다 (앞 구간을 소진한 뒤 다음 구간).
  return { daily: 0, weekly: 0, monthly: 0, illiquid: 0 }
}

/**
 * 목표 배분으로 채우지 못한 잔여분을 어느 구간에서 가져올지의 순서.
 * 비례(vertical) 정책은 현금을 **마지막**에 쓴다 — 그렇지 않으면 처분 한도에 막힌 몫이 전부
 * 현금 구간으로 흘러 결국 수평 슬라이싱과 같아진다.
 */
function orderFor(policy: SlicingPolicy): Bucket[] {
  if (policy === 'illiquidFirst') return ['illiquid', 'monthly', 'weekly', 'daily']
  if (policy === 'vertical') return ['monthly', 'weekly', 'illiquid', 'daily']
  if (policy === 'mixed') return ['daily', 'monthly', 'weekly', 'illiquid']
  return ['daily', 'weekly', 'monthly', 'illiquid']
}

/**
 * `need`($M)만큼의 순현금을 만든다. 비용은 별도로 계산되어 총 처분액(gross)에 포함된다.
 * 목표 배분 → 한도 적용 → 잔여분을 순서대로 채우는 2단계다.
 */
function raiseCash(d: AmDraft, need: number, policy: SlicingPolicy): RaiseResult {
  const s = am(d)
  const from: Record<Bucket, number> = { daily: 0, weekly: 0, monthly: 0, illiquid: 0 }
  if (need <= 0) return { gross: 0, cost: 0, shortfall: 0, fromBucket: from }
  let remaining = need
  let cost = 0
  const take = (b: Bucket, want: number): void => {
    if (want <= 0 || remaining <= 0) return
    if (ringfenced(d, b)) return
    const cap = remainingCapacity(d, b)
    const amount = Math.min(want, cap, bucketValue(s, b) - from[b])
    if (amount <= 1e-9) return
    const bp = costBpFor(d, b, from[b] + amount)
    const c = (amount * bp) / 10000
    from[b] += amount
    cost += c
    remaining -= amount - c
    addCounter(d, `sold_${b}`, amount)
  }
  const weights = targetWeights(d, policy)
  const wsum = BUCKET_ORDER.reduce((a, b) => a + weights[b], 0)
  if (wsum > 0) for (const b of BUCKET_ORDER) take(b, need * (weights[b] / wsum))
  for (const b of orderFor(policy)) take(b, remaining)
  for (const b of BUCKET_ORDER) setBucket(s, b, bucketValue(s, b) - from[b])
  const gross = BUCKET_ORDER.reduce((a, b) => a + from[b], 0)
  return { gross, cost, shortfall: Math.max(0, remaining), fromBucket: from }
}

/**
 * 하루치 환매의 한 조각(틱)을 접수하고 충당한다.
 *
 * - `basePct`는 기준일 NAV 대비 그날의 외생 환매율(%)이고, `counters.redeemAmp`가 곱해진다.
 * - 틱이 있는 턴에서는 tick 0에 하루치 총액을 확정해 `profile`로 나눈다.
 *   따라서 **조각의 합은 틱이 없는 턴의 1회 호출과 정확히 같다**.
 * - 게이트 중이면 접수만 하고 지급하지 않는다(대기열에 쌓인다).
 */
export function redemptionSlice(
  d: AmDraft,
  ctx: EffectContext,
  p: { basePct: number; profile?: number[] },
): void {
  const s = am(d)
  const first = ctx.tick === 0
  const last = ctx.isLastTick
  const share = p.profile ? (p.profile[ctx.tick] ?? 0) : 1 / ctx.ticks
  if (first) {
    const amp = d.counters.redeemAmp || 1
    d.counters.redeemWindowBase = ((s.custom.initialNav || 8000) * p.basePct * amp) / 100
    d.counters.redeemPaidToday = 0
    s.redemptions.pendingPct = 0
    for (const b of BUCKET_ORDER) {
      d.counters[`window_${b}`] = bucketValue(s, b)
      d.counters[`sold_${b}`] = 0
    }
  }
  const slice = (d.counters.redeemWindowBase ?? 0) * share
  if (slice > 0) {
    s.redemptions.pendingPct += (slice / Math.max(1, s.fund.nav)) * 100
    s.redemptions.cumulativePct += (slice / (s.custom.initialNav || 8000)) * 100
  }
  if (s.redemptions.gated) {
    addCounter(d, 'gatedQueue', slice)
    if (last) ctx.log(`환매 중단 중 — 접수분 ${f1(d.counters.gatedQueue ?? 0)} 대기열 적립`)
    return
  }
  if (slice <= 0) return

  const policy = (d.flags.slicingPolicy as SlicingPolicy | undefined) ?? 'horizontal'
  const swingBp = s.redemptions.swingPricingBp
  const npsBefore = navPerShare(s)
  const payout = slice * (1 - swingBp / 10000)
  const pass1 = raiseCash(d, payout, policy)
  let res = pass1
  if (pass1.shortfall > SHORTFALL_TOLERANCE) {
    // 정책 순서를 지키고도 모자라면 남은 한도를 한 번 더 훑는다(가능한 곳 어디서든).
    const extra = raiseCash(d, pass1.shortfall, 'illiquidFirst')
    res = {
      gross: pass1.gross + extra.gross,
      cost: pass1.cost + extra.cost,
      shortfall: extra.shortfall,
      fromBucket: {
        daily: pass1.fromBucket.daily + extra.fromBucket.daily,
        weekly: pass1.fromBucket.weekly + extra.fromBucket.weekly,
        monthly: pass1.fromBucket.monthly + extra.fromBucket.monthly,
        illiquid: pass1.fromBucket.illiquid + extra.fromBucket.illiquid,
      },
    }
  }
  const paid = payout - res.shortfall
  const sharesCancelled = npsBefore > 0 ? (paid + (slice - payout)) / npsBefore : 0
  s.fund.shares = Math.max(1e-6, s.fund.shares - sharesCancelled)
  // 평가가격이 시장을 따라가지 못한 채 지급하면 그 차액은 잔존 투자자에게서 환매자에게 넘어간다.
  const staleGap = staleGapOf(d)
  const staleLoss = paid * staleGap
  if (staleLoss > 0) {
    const assets = totalAssets(s)
    const f = assets > 0 ? Math.max(0, 1 - staleLoss / assets) : 1
    for (const b of BUCKET_ORDER) setBucket(s, b, bucketValue(s, b) * f)
    addCounter(d, 'stalePricingTransfer', staleLoss)
  }
  addCounter(d, 'redeemPaidToday', paid)
  addCounter(d, 'redeemPaidTotal', paid)
  addCounter(d, 'tradingCost', res.cost)
  addCounter(d, 'swingRecovered', slice - payout)
  syncDerived(d)
  const npsAfter = navPerShare(s)
  const dil = npsBefore > 0 ? ((npsBefore - npsAfter) / npsBefore) * 10000 : 0
  if (dil > 0) {
    s.custom.dilutionBp = (s.custom.dilutionBp ?? 0) + dil
    addCounter(d, 'dilutionBp', dil)
  }
  ctx.log(
    `환매 ${f1(slice)} [${policy}] — 조달 ${f1(res.gross)} (현금 ${f1(res.fromBucket.daily)} · 주간 ${f1(res.fromBucket.weekly)} · 월간 ${f1(res.fromBucket.monthly)} · 비유동 ${f1(res.fromBucket.illiquid)}), 거래비용 ${f1(res.cost)}, 스윙 ${swingBp}bp, 희석 +${dil.toFixed(1)}bp`,
  )
  if (res.shortfall > SHORTFALL_TOLERANCE) {
    addCounter(d, 'redemptionShortfall', res.shortfall)
    s.redemptions.gated = true
    setFlagOnce(d, 'forced_gate')
    d.confidence.index = clamp(d.confidence.index - 25, 0, 100)
    ctx.log(`[강제 게이트] 당일 처분 한도를 다 써도 ${f1(res.shortfall)} 미지급 — 환매 중단 불가피`)
  }
  if (last) d.counters.redeemPaidDayEnd = d.counters.redeemPaidToday ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 효과 빌더
// ─────────────────────────────────────────────────────────────────────────────────────

export const fundFx = {
  /**
   * 장 시작(또는 마감) 시장 수준을 절대값으로 세우고 장부를 시가평가한다.
   * 지정하지 않은 항목은 그대로 둔다. 신뢰지수는 건드리지 않는다(ΔCI는 별도 이벤트).
   */
  marketOpen(p: {
    govt2yBp?: number
    govt10yBp?: number
    govt30yBp?: number
    igBp?: number
    hyBp?: number
    volIndex?: number
    equityIndex?: number
    fundingStressBp?: number
    etfDiscountPct?: number
    treasuryOffRunBp?: number
    bidAskIgBp?: number
    policyRateBp?: number
    label?: string
  }): Effect<AssetManagerState> {
    const params: Record<string, number> = {}
    for (const [k, v] of Object.entries(p)) if (typeof v === 'number') params[k] = v
    return fnEffect<AssetManagerState>(
      'marketOpen',
      params,
      (d, ctx) => {
        markBook(d, ctx) // 직전 틱까지의 미반영 움직임을 먼저 정리
        const m = d.market
        if (p.govt2yBp !== undefined) m.govt2yBp = p.govt2yBp
        if (p.govt10yBp !== undefined) m.govt10yBp = p.govt10yBp
        if (p.govt30yBp !== undefined) m.govt30yBp = p.govt30yBp
        if (p.igBp !== undefined) m.creditSpreadIgBp = p.igBp
        if (p.hyBp !== undefined) m.creditSpreadHyBp = p.hyBp
        if (p.volIndex !== undefined) m.volIndex = p.volIndex
        if (p.equityIndex !== undefined) m.equityIndex = p.equityIndex
        if (p.fundingStressBp !== undefined) m.fundingStressBp = p.fundingStressBp
        if (p.policyRateBp !== undefined) m.policyRateBp = p.policyRateBp
        if (p.etfDiscountPct !== undefined) m.custom.etfDiscountPct = p.etfDiscountPct
        if (p.treasuryOffRunBp !== undefined) m.custom.treasuryOffRunBp = p.treasuryOffRunBp
        if (p.bidAskIgBp !== undefined) d.institution.custom.bidAskIgBp = p.bidAskIgBp
        markBook(d, ctx)
      },
      p.label,
    )
  },

  /** 틱마다 호출: 티커가 움직인 스프레드·금리를 장부에 반영한다. */
  markToMarket(label?: string): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>(
      'markToMarket',
      {},
      (d, ctx) => {
        markBook(d, ctx)
      },
      label,
    )
  },

  /** 하루치 환매 접수·충당. 틱이 있는 턴에서는 `profile`로 일중 분포를 저작한다. */
  redemptionStep(p: {
    basePct: number
    profile?: number[]
    label?: string
  }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>(
      'redemptionStep',
      { basePct: p.basePct, ...(p.profile ? { profile: p.profile.join('/') } : {}) },
      (d, ctx) => {
        redemptionSlice(d, ctx, { basePct: p.basePct, profile: p.profile })
      },
      p.label,
    )
  },

  /** 매도 순서 정책을 정한다. 이후 모든 환매 충당에 적용된다. */
  setSlicing(p: { policy: SlicingPolicy }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('setSlicing', { policy: p.policy }, (d, ctx) => {
      d.flags.slicingPolicy = p.policy
      if (p.policy === 'vertical') setFlagOnce(d, 'vertical_policy')
      addCounter(d, `slicing_${p.policy}`, 1)
      ctx.log(`매도 순서 정책: ${p.policy}`)
    })
  },

  /** 유동 구간(현금·국채·벤치마크 IG)을 방어선으로 동결한다 — 처분 대상에서 제외된다. */
  ringfenceLiquid(p: { on: boolean }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('ringfenceLiquid', { on: p.on }, (d, ctx) => {
      if (p.on) setFlagOnce(d, 'ringfence_liquid')
      else delete d.flags.ringfence_liquid
      ctx.log(p.on ? '현금·국채 구간 동결(방어선)' : '현금·국채 구간 동결 해제')
    })
  },

  /**
   * 스윙프라이싱 적용. `swing_preset`(사전에 이사회가 임계·최대폭을 결의)이 있으면 당일 적용,
   * 없으면 이사회 승인·회계 처리로 **다음 영업일**에 적용된다(counter → settleSwing).
   */
  applySwing(p: { bp: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('applySwing', { bp: p.bp }, (d, ctx) => {
      if (d.flags.swing_preset) {
        d.institution.redemptions.swingPricingBp = p.bp
        setFlagOnce(d, 'swing_applied')
        d.flagTurns.swing_applied ??= d.turnIndex
        ctx.log(`스윙프라이싱 ${p.bp}bp 당일 적용 (사전 결의)`)
      } else {
        d.counters.swingPending = p.bp
        ctx.log(`스윙프라이싱 ${p.bp}bp — 이사회 승인·회계 처리로 익영업일 적용`)
      }
    })
  },

  settleSwing(): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('settleSwing', {}, (d, ctx) => {
      const bp = d.counters.swingPending ?? 0
      if (bp <= 0) return
      d.counters.swingPending = 0
      d.institution.redemptions.swingPricingBp = bp
      setFlagOnce(d, 'swing_applied')
      ctx.log(`스윙프라이싱 ${bp}bp 적용 개시(익영업일 반영)`)
    })
  },

  /** 스윙폭 해제·조정. */
  setSwing(p: { bp: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('setSwing', { bp: p.bp }, (d, ctx) => {
      d.institution.redemptions.swingPricingBp = p.bp
      ctx.log(`스윙폭 ${p.bp}bp로 조정`)
    })
  },

  /** 환매 유입 배수(누적 곱). 1보다 크면 증폭, 작으면 완화. */
  redeemAmp(p: { factor: number; reason?: string }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('redeemAmp', { factor: p.factor }, (d, ctx) => {
      const cur = d.counters.redeemAmp || 1
      d.counters.redeemAmp = Math.max(0, cur * p.factor)
      ctx.log(
        `환매 배수 ${cur.toFixed(2)} → ${d.counters.redeemAmp.toFixed(2)}${p.reason ? ` (${p.reason})` : ''}`,
      )
    })
  },

  /** 커밋 크레딧라인 인출. 현금 구간이 늘고 차입 잔액이 늘어 NAV는 변하지 않는다. */
  drawCreditLine(p: { amount: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('drawCreditLine', { amount: p.amount }, (d, ctx) => {
      const s = am(d)
      const room = Math.max(0, (s.custom.creditLineLimit ?? 0) - (s.custom.creditLineDrawn ?? 0))
      const amt = Math.min(p.amount, room)
      if (amt <= 0) {
        ctx.log('크레딧라인 여력 없음')
        return
      }
      s.liquidity.daily += amt
      s.custom.creditLineDrawn = (s.custom.creditLineDrawn ?? 0) + amt
      addCounter(d, 'creditDrawTotal', amt)
      setFlagOnce(d, 'credit_line_used')
      syncDerived(d)
      ctx.log(
        `크레딧라인 인출 ${f1(amt)} → 잔액 ${f1(s.custom.creditLineDrawn)} / 한도 ${f1(s.custom.creditLineLimit ?? 0)}`,
      )
    })
  },

  /** 크레딧라인 상환(현금 구간에서). */
  repayCreditLine(p: { amount: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('repayCreditLine', { amount: p.amount }, (d, ctx) => {
      const s = am(d)
      const amt = Math.min(p.amount, s.custom.creditLineDrawn ?? 0, s.liquidity.daily)
      if (amt <= 0) return
      s.liquidity.daily -= amt
      s.custom.creditLineDrawn = (s.custom.creditLineDrawn ?? 0) - amt
      syncDerived(d)
      ctx.log(`크레딧라인 상환 ${f1(amt)} → 잔액 ${f1(s.custom.creditLineDrawn)}`)
    })
  },

  /** 약정 한도 증액(사전 준비). */
  extendCreditLine(p: { amount: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('extendCreditLine', { amount: p.amount }, (d, ctx) => {
      const s = am(d)
      s.custom.creditLineLimit = (s.custom.creditLineLimit ?? 0) + p.amount
      setFlagOnce(d, 'credit_line_extended')
      ctx.log(`크레딧라인 약정 한도 +${f1(p.amount)} → ${f1(s.custom.creditLineLimit)}`)
    })
  },

  /** 환매 중단(게이트)·연기. 자발적 선택과 강제 발동을 구분해 기록한다. */
  gate(p: { voluntary: boolean; reason?: string }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('gate', { voluntary: p.voluntary }, (d, ctx) => {
      d.institution.redemptions.gated = true
      setFlagOnce(d, p.voluntary ? 'gated_voluntary' : 'forced_gate')
      d.confidence.index = clamp(d.confidence.index - (p.voluntary ? 18 : 25), 0, 100)
      d.regulator.level = Math.min(4, d.regulator.level + 2) as 0 | 1 | 2 | 3 | 4
      ctx.log(
        `환매 중단 발동 (${p.voluntary ? '자발적' : '강제'})${p.reason ? ` — ${p.reason}` : ''}`,
      )
    })
  },

  liftGate(): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('liftGate', {}, (d, ctx) => {
      if (!d.institution.redemptions.gated) return
      d.institution.redemptions.gated = false
      d.counters.gateTurns = 0
      ctx.log('환매 재개')
    })
  },

  /**
   * 현물 바스켓(in-kind) 경로: 회사채를 지정참가회사(AP)에 인도하고 ETF 지분을 받아 매도한다.
   * 시장충격 비용 대신 **ETF 할인폭 + 설정 수수료**를 치르며, 구간별 당일 처분 한도를 우회한다.
   * 2020년 3월 다수 운용사가 실제로 쓴 경로다.
   */
  sellViaEtfCreation(p: { amount: number; feeBp?: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>(
      'sellViaEtfCreation',
      { amount: p.amount, feeBp: p.feeBp ?? 25 },
      (d, ctx) => {
        const s = am(d)
        const want = p.amount
        const fromMonthly = Math.min(want * 0.6, s.liquidity.monthly)
        const fromIlliquid = Math.min(want - fromMonthly, s.liquidity.illiquid)
        const gross = fromMonthly + fromIlliquid
        if (gross <= 0) return
        const discountBp = Math.max(0, -(d.market.custom.etfDiscountPct ?? 0)) * 100
        const costBp = discountBp + (p.feeBp ?? 25)
        const cost = (gross * costBp) / 10000
        s.liquidity.monthly -= fromMonthly
        s.liquidity.illiquid -= fromIlliquid
        s.liquidity.daily += gross - cost
        addCounter(d, 'tradingCost', cost)
        addCounter(d, 'etfCreationUsed', gross)
        setFlagOnce(d, 'used_etf_primary')
        syncDerived(d)
        ctx.log(
          `현물 바스켓 설정 ${f1(gross)} (월간 ${f1(fromMonthly)} + 비유동 ${f1(fromIlliquid)}) — 비용 ${costBp.toFixed(0)}bp = ${f1(cost)} → 현금 구간 +${f1(gross - cost)}`,
        )
      },
    )
  },

  /** 할인 거래되는 회사채 ETF를 현금으로 매수한다(차익 베팅). 현금 구간이 비유동 구간으로 바뀐다. */
  buyEtf(p: { amount: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('buyEtf', { amount: p.amount }, (d, ctx) => {
      const s = am(d)
      const amt = Math.min(p.amount, s.liquidity.daily)
      if (amt <= 0) {
        ctx.log('현금 구간 부족 — ETF 매수 불가')
        return
      }
      const disc = Math.max(0, -(d.market.custom.etfDiscountPct ?? 0)) / 100
      s.liquidity.daily -= amt
      s.liquidity.illiquid += amt / (1 - disc)
      addCounter(d, 'etfBought', amt)
      setFlagOnce(d, 'bought_etf_discount')
      syncDerived(d)
      ctx.log(
        `ETF 매수 ${f1(amt)} (할인 ${(disc * 100).toFixed(2)}% → 기초 노출 ${f1(amt / (1 - disc))}) — 현금 구간 ${f1(s.liquidity.daily)}`,
      )
    })
  },

  /**
   * 평가가격을 ETF가 시사하는 수준까지 하향한다(가격 발견 수용).
   * 즉시 기준가가 내려가지만, 이후 매도 비용의 과소평가가 사라져 희석이 줄어든다.
   */
  markToEtfImplied(p: { fraction: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('markToEtfImplied', { fraction: p.fraction }, (d, ctx) => {
      d.counters.etfMarkdownFraction = p.fraction
      setFlagOnce(d, 'marks_current')
      // 평가가 현실화되면 같은 매도의 추가 충격이 줄어든다 [CAL].
      d.institution.custom.bidAskIgBp = Math.max(20, (d.institution.custom.bidAskIgBp ?? 30) * 0.9)
      applyEtfMarkdown(d, ctx)
    })
  },

  /** 레버리지 확대(리버스 레포·차입으로 비유동 자산 추가 매입). */
  leverUp(p: { pctOfNav: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('leverUp', { pctOfNav: p.pctOfNav }, (d, ctx) => {
      const s = am(d)
      const amt = (s.fund.nav * p.pctOfNav) / 100
      s.custom.creditLineDrawn = (s.custom.creditLineDrawn ?? 0) + amt
      s.liquidity.illiquid += amt
      setFlagOnce(d, 'levered_up')
      syncDerived(d)
      ctx.log(
        `레버리지 확대 ${f1(amt)} → 차입 ${f1(s.custom.creditLineDrawn)}, 비유동 비중 ${(s.custom.illiquidSharePct ?? 0).toFixed(1)}%`,
      )
    })
  },

  /**
   * 유동성 사다리 재건: 비유동·월간 구간을 팔아 현금·주간 구간을 목표 비중까지 채운다.
   * 당일 처분 한도를 따르며, 시장이 정상화된 뒤(거래비용 하락)에 효율적이다.
   */
  rebuildLadder(p: { targetDailyPct: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>(
      'rebuildLadder',
      { targetDailyPct: p.targetDailyPct },
      (d, ctx) => {
        const s = am(d)
        const assets = totalAssets(s)
        const need = Math.max(0, (assets * p.targetDailyPct) / 100 - s.liquidity.daily)
        if (need <= 0) {
          ctx.log(`현금 비중이 이미 ${p.targetDailyPct}% 이상 — 재건 불필요`)
          return
        }
        let remaining = need
        let cost = 0
        for (const b of ['illiquid', 'monthly'] as Bucket[]) {
          if (remaining <= 0) break
          const cap = remainingCapacity(d, b)
          const amount = Math.min(remaining, cap)
          if (amount <= 0) continue
          const c = (amount * costBpFor(d, b, amount)) / 10000
          setBucket(s, b, bucketValue(s, b) - amount)
          addCounter(d, `sold_${b}`, amount)
          remaining -= amount - c
          cost += c
        }
        s.liquidity.daily += need - remaining - cost
        addCounter(d, 'tradingCost', cost)
        setFlagOnce(d, 'ladder_rebuilt')
        syncDerived(d)
        ctx.log(
          `유동성 사다리 재건: 현금 비중 ${((s.liquidity.daily / totalAssets(s)) * 100).toFixed(1)}%, 비용 ${f1(cost)}`,
        )
      },
    )
  },

  /** 현금을 IG 회사채에 재투자(되돌림 국면). */
  reinvest(p: { amount: number }): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('reinvest', { amount: p.amount }, (d, ctx) => {
      const s = am(d)
      const amt = Math.min(p.amount, Math.max(0, s.liquidity.daily))
      if (amt <= 0) return
      const cost = (amt * costBpFor(d, 'monthly', amt)) / 10000
      s.liquidity.daily -= amt
      s.liquidity.monthly += amt - cost
      addCounter(d, 'tradingCost', cost)
      addCounter(d, 'reinvested', amt)
      syncDerived(d)
      ctx.log(`IG 회사채 재투자 ${f1(amt)} (비용 ${f1(cost)})`)
    })
  },

  /** 게이트가 유지된 영업일 수를 센다(턴 진입에서 호출). */
  countGateTurn(): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('countGateTurn', {}, (d, ctx) => {
      if (!d.institution.redemptions.gated) return
      addCounter(d, 'gateTurns', 1)
      ctx.log(`환매 중단 ${d.counters.gateTurns}영업일째`)
    })
  },

  /** 파생값만 다시 계산한다(선언적 op 효과 뒤에 붙일 때). */
  sync(): Effect<AssetManagerState> {
    return fnEffect<AssetManagerState>('sync', {}, (d) => {
      syncDerived(d)
    })
  },
}
