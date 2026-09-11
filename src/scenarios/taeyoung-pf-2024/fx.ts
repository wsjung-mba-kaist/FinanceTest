import type { Draft } from 'immer'
import type { BankState, Effect, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../../engine/core/noise'
import { fnEffect } from '../../engine/fx/common'

type PfDraft = Draft<GameState<BankState>>

/**
 * taeyoung-pf-2024 전용 효과 빌더. 산식·앵커는 calibration.md 참조.
 *
 * 세 가지가 이 시나리오의 엔진이다.
 *  ① **동의율 산식** — 기업구조조정 촉진법의 의결 요건은 "신고된 금융채권액의 4분의 3 이상"이다.
 *     즉 머릿수가 아니라 채권액 가중이며, 무엇을 신고 채권으로 세느냐(`claimBaseMode`)가 분모와
 *     분자를 동시에 바꾼다. `recomputeConsent`가 그 산식 자체다.
 *  ② **충당금 계단** — 자산건전성 분류 단계별 최저적립률(건설·부동산 차주 정상 0.9 · 요주의 7 · 고정 20 ·
 *     회수의문 50 · 추정손실 100%)을 익스포저 단위로 누적 관리한다. 이미 쌓은 만큼은 다시 쌓지
 *     않으므로, 먼저 쌓으면 오늘 자본이 깎이고 미루면 나중에 같은 금액을 한꺼번에 쌓는다.
 *  ③ **사업장 옥석 가리기** — 경·공매는 즉시 손실을 확정하고, 재구조화는 손실을 이연하되 이연
 *     구간마다 회수율이 떨어진다.
 */

/**
 * 자산건전성 분류 단계별 대손충당금 최저적립률 [bank-supervision-reg — 은행업감독규정 제29조제1항제1호].
 * `normal` 0.9%는 조문의 산업 단서다: "'정상'분류 자산의 100분의 0.85 이상, 다만, 통계법에 따른
 * 한국표준산업분류상 **건설업(F)**, 도매 및 소매업(G), 숙박 및 음식점업(H), **부동산 및 임대업(L)**
 * 은 100분의 0.9 이상". 이 시나리오의 익스포저는 전부 건설·부동산 차주이므로 0.9%가 최저선이다
 * (종전 0.85%는 단서를 빼놓은 값이었다 — calibration.md §4.1).
 */
export const PROVISION_RATE = {
  normal: 0.009,
  watch: 0.07,
  substandard: 0.2,
  doubtful: 0.5,
  loss: 1.0,
} as const
export type ProvisionBucket = keyof typeof PROVISION_RATE

/** 고정이하로 내려간 익스포저의 위험가중치 배수(연체·무담보 150%) [bcbs-cre20]. */
const RW_MULTIPLE: Record<ProvisionBucket, number> = {
  normal: 1,
  watch: 1,
  substandard: 1.5,
  doubtful: 1.5,
  loss: 0,
}

/** 충당금을 적립할 수 있는 익스포저 풀 (institution.custom의 경로명). */
export type ExposurePool = 'groupUnsecured' | 'groupSecured' | 'pfBridge' | 'pfMain' | 'pfGuarantee'

/** 신고 금융채권 산입 범위. 0 = 확정채무만 · 1 = 신고 기준 · 2 = 우발채무 전액 산입. */
export const CLAIM_BASE = { narrow: 0, standard: 1, broad: 2 } as const

/** 증권사 신고 채권 중 사업장 미확정 매입확약분 — narrow 모드에서 제외된다 [CAL]. */
const SECURITIES_UNCONFIRMED = 1.4
/** broad 모드에서 우발채무를 증권사/기타에 배분하는 비율 [CAL]. */
const CONTINGENT_SPLIT = { securities: 0.6, other: 0.4 }

export type ConsentGroup = 'Bank' | 'Nbfi' | 'Securities' | 'Insurance' | 'Other'
const CONSENT_GROUPS: ConsentGroup[] = ['Bank', 'Nbfi', 'Securities', 'Insurance', 'Other']

/**
 * 그룹별 채권 중 담보부 비중 [CAL]. 기업구조조정 촉진법 제17조제2항은 채무조정이 포함된
 * 기업개선계획에 대해 **담보채권 총액의 4분의 3 이상을 보유한 금융채권자의 찬성**을 별도로
 * 요구한다 — 총 금융채권액 3/4(제24조제2항)와 함께 문(gate)이 두 개인 셈이다.
 * 담보를 많이 쥔 은행권·보험이 이탈하면 총액 기준을 넘고도 계획이 부결된다.
 */
const SECURED_SHARE: Record<ConsentGroup, number> = {
  Bank: 0.72,
  Nbfi: 0.3,
  Securities: 0.12,
  Insurance: 0.55,
  Other: 0.18,
}

/** 산입 범위별 그룹 채권액(조원). 분모이자 분자의 가중치다. */
export function effectiveClaims(
  custom: Record<string, number>,
  mode: number,
): Record<ConsentGroup, number> {
  const contingent = mode === CLAIM_BASE.broad ? (custom.claimContingent ?? 0) : 0
  return {
    Bank: custom.claimBank ?? 0,
    Nbfi: custom.claimNbfi ?? 0,
    Securities:
      (custom.claimSecurities ?? 0) -
      (mode === CLAIM_BASE.narrow ? SECURITIES_UNCONFIRMED : 0) +
      contingent * CONTINGENT_SPLIT.securities,
    Insurance: custom.claimInsurance ?? 0,
    Other: (custom.claimOther ?? 0) + contingent * CONTINGENT_SPLIT.other,
  }
}

/**
 * 동의율 = 100 × Σ(그룹 채권액 × 그룹 동의비율) / Σ(그룹 채권액) + 협의회 당일 확정된 부동표.
 * 기촉법의 의결 요건이 채권액 기준이라는 사실이 그대로 산식이 된다.
 */
export function recomputeConsent(d: PfDraft): number {
  const c = d.institution.custom
  const mode = d.counters.claimBaseMode ?? CLAIM_BASE.standard
  const w = effectiveClaims(c, mode)
  let num = 0
  let den = 0
  for (const g of CONSENT_GROUPS) {
    const weight = Math.max(0, w[g])
    den += weight
    num += weight * clamp(d.counters[`consent${g}`] ?? 0, 0, 1)
  }
  const weighted = den > 0 ? (num / den) * 100 : 0
  const pct = clamp(weighted + (d.counters.consentAccrued ?? 0), 0, 100)
  c.consentPct = pct
  // 담보채권 기준 동의율 (기촉법 제17조제2항의 두 번째 문)
  let sNum = 0
  let sDen = 0
  for (const g of CONSENT_GROUPS) {
    const secured = Math.max(0, w[g]) * SECURED_SHARE[g]
    sDen += secured
    sNum += secured * clamp(d.counters[`consent${g}`] ?? 0, 0, 1)
  }
  c.securedConsentPct = clamp(
    sDen > 0 ? (sNum / sDen) * 100 + (d.counters.consentAccrued ?? 0) * 0.8 : 0,
    0,
    100,
  )
  return pct
}

export const pfFx = {
  /** 산식 결과를 상태에 반영한다(진입효과·정합성 확인용). */
  syncConsent(label?: string): Effect<BankState> {
    return fnEffect<BankState>(
      'syncConsent',
      {},
      (d, ctx) => {
        const pct = recomputeConsent(d)
        ctx.log(`동의율 재계산 → ${pct.toFixed(2)}%`)
      },
      label,
    )
  },

  /**
   * 그룹별 동의 확보 비율을 갱신한다. `set`은 절대값, `add`는 증분이며 둘 다 0~1로 클램프된다.
   * 채권액 가중이므로 같은 +0.10이라도 은행권(41%)과 기타(4%)의 효과가 10배 다르다.
   */
  pledgeConsent(p: {
    set?: Partial<Record<ConsentGroup, number>>
    add?: Partial<Record<ConsentGroup, number>>
    label?: string
  }): Effect<BankState> {
    const flat = Object.entries({ ...(p.set ?? {}) })
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return fnEffect<BankState>(
      'pledgeConsent',
      {
        set: flat,
        add: Object.entries(p.add ?? {})
          .map(([k, v]) => `${k}+${v}`)
          .join(','),
      },
      (d, ctx) => {
        for (const g of CONSENT_GROUPS) {
          const s = p.set?.[g]
          if (s !== undefined) d.counters[`consent${g}`] = clamp(s, 0, 1)
          const a = p.add?.[g]
          if (a !== undefined)
            d.counters[`consent${g}`] = clamp((d.counters[`consent${g}`] ?? 0) + a, 0, 1)
        }
        const pct = recomputeConsent(d)
        ctx.log(`동의 확보 갱신 → 동의율 ${pct.toFixed(2)}%`)
      },
      p.label,
    )
  },

  /** 신고 금융채권 산입 범위를 정한다 — 분모와 분자를 동시에 바꾼다. */
  setClaimBase(p: { mode: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'setClaimBase',
      { mode: p.mode },
      (d, ctx) => {
        d.counters.claimBaseMode = p.mode
        const w = effectiveClaims(d.institution.custom, p.mode)
        const den = CONSENT_GROUPS.reduce((a, g) => a + Math.max(0, w[g]), 0)
        const pct = recomputeConsent(d)
        ctx.log(
          `신고 채권 산입 범위 ${['확정채무', '신고 기준', '우발채무 포함'][p.mode] ?? '?'} → 분모 ${den.toFixed(2)}조, 동의율 ${pct.toFixed(2)}%`,
        )
      },
      p.label,
    )
  },

  /**
   * 협의회 당일 현장에서 확정되는 부동표. `profile`은 틱별 몫이며 합이 1이어야 한다.
   * 틱이 없는 턴에서는 한 번에 전량이 적용되므로, variance 0에서 슬라이스 합계는 단일 호출과
   * **정확히** 일치한다(runoffStep과 같은 계약).
   */
  accrueConsent(p: { total: number; profile?: number[]; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'accrueConsent',
      { total: p.total, ...(p.profile ? { profile: p.profile.join('/') } : {}) },
      (d, ctx) => {
        const share = p.profile ? (p.profile[ctx.tick] ?? 0) : 1 / ctx.ticks
        const noise = noiseFactor(
          ctx,
          ctx.noise?.runoffSigma ?? DEFAULT_NOISE.runoffSigma,
          ctx.noise?.runoffCap ?? DEFAULT_NOISE.runoffCap,
        )
        const slice = p.total * share * noise
        d.counters.consentAccrued = (d.counters.consentAccrued ?? 0) + slice
        const pct = recomputeConsent(d)
        ctx.log(`현장 확정 부동표 +${slice.toFixed(2)}pp → 동의율 ${pct.toFixed(2)}%`)
      },
      p.label,
    )
  },

  /**
   * 기업개선계획 의결을 앞두고 동의를 다시 묻는다. 개시 의결은 "시간을 달라"는 결의였지만
   * 계획 의결은 손실 배분을 확정하는 결의이므로, 현장에서 확보해 둔 부동표는 사라지고 그룹별
   * 동의 비율도 후퇴한다. 그 후퇴폭이 `adjust`다.
   */
  reopenConsent(p: {
    adjust: Partial<Record<ConsentGroup, number>>
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'reopenConsent',
      {
        adjust: Object.entries(p.adjust)
          .map(([k, v]) => `${k}${v}`)
          .join(','),
      },
      (d, ctx) => {
        d.counters.consentAccrued = 0
        for (const g of CONSENT_GROUPS) {
          const a = p.adjust[g]
          if (a !== undefined)
            d.counters[`consent${g}`] = clamp((d.counters[`consent${g}`] ?? 0) + a, 0, 1)
        }
        const pct = recomputeConsent(d)
        ctx.log(`계획 의결 동의 재집계(현장 확정분 초기화) → 동의율 ${pct.toFixed(2)}%`)
      },
      p.label,
    )
  },

  /**
   * 반대 채권자의 채권매수청구(기촉법 제27조)를 수용한다. 매수한 채권은 협의회 채권액에서 빠지고
   * 주채권은행의 채권으로 옮겨 오므로 분모가 줄고 분자가 는다 — 돈으로 동의율을 사는 셈이다.
   * 매수대금은 현금에서 나가고, 액면과 매수가의 차이는 그 자리에서 익스포저 증가로 남는다.
   */
  buyoutDissenters(p: {
    group: ConsentGroup
    amount: number
    priceRatio: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'buyoutDissenters',
      { group: p.group, amount: p.amount, priceRatio: p.priceRatio },
      (d, ctx) => {
        const b = d.institution
        const key = `claim${p.group === 'Securities' ? 'Securities' : p.group}`
        const available = b.custom[key] ?? 0
        const amount = clamp(p.amount, 0, available)
        if (amount <= 0) return
        const cost = amount * p.priceRatio
        b.custom[key] = available - amount
        b.custom.claimBank = (b.custom.claimBank ?? 0) + amount
        b.cash -= cost
        b.loans.corporate += cost
        b.custom.groupUnsecured = (b.custom.groupUnsecured ?? 0) + amount * 0.65
        b.custom.groupSecured = (b.custom.groupSecured ?? 0) + amount * 0.35
        b.rwa += cost
        d.counters.buyoutSpend = (d.counters.buyoutSpend ?? 0) + cost
        const pct = recomputeConsent(d)
        ctx.log(
          `매수청구 수용: ${p.group} 채권 ${amount.toFixed(2)}조를 액면의 ${(p.priceRatio * 100).toFixed(0)}%(${cost.toFixed(2)}조)에 매입 → 동의율 ${pct.toFixed(2)}%`,
        )
      },
      p.label,
    )
  },

  /**
   * 의결.
   *  - `kind: 'open'` — 공동관리절차 개시. 제1차 협의회 소집을 통보받은 금융채권자의 **총 금융채권액
   *    4분의 3 이상**(기촉법 제11조제4항).
   *  - `kind: 'plan'` — 기업개선계획 의결. 총 금융채권액 4분의 3(제24조제2항)에 더해, 채무조정이
   *    포함되면 **담보채권 총액의 4분의 3 이상을 보유한 금융채권자의 찬성**이 따로 필요하다
   *    (제17조제2항). 문이 두 개이므로 총액 기준을 넘고도 부결될 수 있다.
   *
   * 미달이면 절차가 중단되고 회생으로 간다(제13조제3항: 유예기간 내 미의결 시 절차 중단 간주).
   */
  workoutVote(p: {
    kind: 'open' | 'plan'
    threshold?: number
    securedThreshold?: number
    label?: string
  }): Effect<BankState> {
    const threshold = p.threshold ?? 75
    return fnEffect<BankState>(
      'workoutVote',
      { kind: p.kind, threshold, securedThreshold: p.securedThreshold ?? 0 },
      (d, ctx) => {
        const pct = recomputeConsent(d)
        const secured = d.institution.custom.securedConsentPct ?? 0
        const securedOk = p.securedThreshold === undefined ? true : secured >= p.securedThreshold
        if (p.securedThreshold !== undefined)
          ctx.log(
            `담보채권 기준 동의율 ${secured.toFixed(2)}% vs 요건 ${p.securedThreshold}% → ${securedOk ? '충족' : '미달'}`,
          )
        const passed = pct >= threshold && securedOk
        const heldFlag = p.kind === 'open' ? 'open_vote_held' : 'plan_vote_held'
        d.flags[heldFlag] = true
        d.flagTurns[heldFlag] ??= d.turnIndex
        d.counters[`${p.kind}VotePct`] = pct
        if (passed) {
          const okFlag = p.kind === 'open' ? 'workout_open' : 'plan_approved'
          d.flags[okFlag] = true
          d.flagTurns[okFlag] ??= d.turnIndex
          d.confidence.index = clamp(d.confidence.index + (p.kind === 'open' ? 6 : 8), 0, 100)
        } else {
          const failFlag = p.kind === 'open' ? 'open_vote_failed' : 'plan_rejected'
          d.flags[failFlag] = true
          d.flagTurns[failFlag] ??= d.turnIndex
          d.confidence.index = clamp(d.confidence.index - 18, 0, 100)
        }
        ctx.log(
          `${p.kind === 'open' ? '개시' : '기업개선계획'} 의결: 동의율 ${pct.toFixed(2)}% vs 요건 ${threshold}% → ${passed ? '가결' : '부결'}`,
        )
      },
      p.label,
    )
  },

  /**
   * 자산건전성 재분류 + 대손충당금 적립. 익스포저 풀별로 **이미 쌓은 금액을 기억**하므로 같은
   * 풀을 다시 부르면 목표 적립액과의 차액만 쌓인다 — 보수적으로 먼저 쌓으면 오늘 자본이 깎이고,
   * 미루면 같은 금액이 나중에 한꺼번에 온다.
   */
  provision(p: {
    pool: ExposurePool
    share: number
    bucket: ProvisionBucket
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'provision',
      { pool: p.pool, share: p.share, bucket: p.bucket },
      (d, ctx) => {
        const b = d.institution
        const pool = b.custom[p.pool] ?? 0
        const amount = pool * clamp(p.share, 0, 1)
        if (amount <= 0) return
        const target = amount * PROVISION_RATE[p.bucket]
        const bookedKey = `booked_${p.pool}`
        const booked = d.counters[bookedKey] ?? 0
        const delta = Math.max(0, target - booked)
        if (delta > 0) {
          d.counters[bookedKey] = target
          b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + delta
          b.capital.cet1 -= delta * (1 - b.taxRate)
          d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + delta * (1 - b.taxRate)
        }
        const rwaKey = `rwaAdd_${p.pool}`
        const rwaTarget = amount * (RW_MULTIPLE[p.bucket] - 1)
        const rwaBooked = d.counters[rwaKey] ?? 0
        b.rwa += rwaTarget - rwaBooked
        d.counters[rwaKey] = rwaTarget
        if (p.bucket === 'substandard' || p.bucket === 'doubtful' || p.bucket === 'loss') {
          const npKey = `np_${p.pool}`
          const npBooked = d.counters[npKey] ?? 0
          b.loans.nonPerforming += amount - npBooked
          d.counters[npKey] = amount
        }
        ctx.log(
          `${p.pool} ${(p.share * 100).toFixed(0)}% → ${p.bucket}: 목표 적립 ${target.toFixed(3)}조, 추가 적립 ${delta.toFixed(3)}조, CET1 ${b.capital.cet1.toFixed(2)}조`,
        )
      },
      p.label,
    )
  },

  /**
   * 사업장 옥석 가리기. 경·공매분은 즉시 손실이 확정되고(회수율만 남는다) 익스포저에서 빠지며,
   * 재구조화분은 손실이 이연되되 이연 구간마다 회수율이 떨어진다(`deferDecay`).
   * 정상진행분은 익스포저가 남고 신규자금 수요가 생긴다.
   */
  siteTriage(p: {
    bridgeAuction: number
    mainAuction: number
    bridgeRestructure: number
    mainRestructure: number
    sitesAuction: number
    sitesRestructure: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'siteTriage',
      {
        bridgeAuction: p.bridgeAuction,
        mainAuction: p.mainAuction,
        bridgeRestructure: p.bridgeRestructure,
        mainRestructure: p.mainRestructure,
      },
      (d, ctx) => {
        const b = d.institution
        // 회수율: 브릿지론은 토지만 남으므로 낮고, 본PF는 공정률·분양대금이 있어 높다 [CAL].
        // 사전 사업성 재평가(early_triage)를 해 둔 경우 경·공매 준비가 앞서 매각가가 5%p 높다 [CAL].
        const RECOVERY = { bridge: d.flags.early_triage ? 0.5 : 0.45, main: 0.72 }
        const bridge = b.custom.pfBridge ?? 0
        const main = b.custom.pfMain ?? 0
        const bA = bridge * clamp(p.bridgeAuction, 0, 1)
        const mA = main * clamp(p.mainAuction, 0, 1)
        const loss = bA * (1 - RECOVERY.bridge) + mA * (1 - RECOVERY.main)
        if (bA + mA > 0) {
          b.custom.pfBridge = bridge - bA
          b.custom.pfMain = main - mA
          b.custom.pfExposure = (b.custom.pfExposure ?? 0) - bA - mA
          b.loans.corporate = Math.max(0, b.loans.corporate - bA - mA)
          b.cash += bA + mA - loss
          b.rwa = Math.max(0, b.rwa - (bA + mA))
          b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + loss
          b.capital.cet1 -= loss * (1 - b.taxRate)
          d.counters.auctionLoss = (d.counters.auctionLoss ?? 0) + loss
          d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + loss * (1 - b.taxRate)
        }
        const deferredBridge = (b.custom.pfBridge ?? 0) * clamp(p.bridgeRestructure, 0, 1)
        const deferredMain = (b.custom.pfMain ?? 0) * clamp(p.mainRestructure, 0, 1)
        const deferred = deferredBridge + deferredMain
        d.counters.deferredBridge = deferredBridge
        d.counters.deferredMain = deferredMain
        d.counters.deferredExposure = deferred
        b.custom.sitesAuction = (b.custom.sitesAuction ?? 0) + p.sitesAuction
        b.custom.sitesRestructure = p.sitesRestructure
        b.custom.sitesNormal = Math.max(
          0,
          (b.custom.sitesTotal ?? 0) - (b.custom.sitesAuction ?? 0) - p.sitesRestructure,
        )
        ctx.log(
          `사업장 분류: 경·공매 ${p.sitesAuction}곳(${(bA + mA).toFixed(2)}조, 손실 ${loss.toFixed(3)}조) · 재구조화 ${p.sitesRestructure}곳(${deferred.toFixed(2)}조) · 정상 ${b.custom.sitesNormal}곳`,
        )
      },
      p.label,
    )
  },

  /**
   * 이연된 재구조화 사업장의 회수율 저하 — 끌수록 손실이 커진다. 브릿지론은 금융비용이 토지
   * 가치를 직접 잠식하므로 감쇠가 가파르고(`bridgeRate`), 본PF는 공정·분양이 이어지므로 완만하다
   * (`mainRate`). 앵커: 중소금융 토지담보대출 연체율 7.15%('23.12말) → 28.05%('25.3말).
   */
  deferDecay(p: { bridgeRate: number; mainRate: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'deferDecay',
      { bridgeRate: p.bridgeRate, mainRate: p.mainRate },
      (d, ctx) => {
        const b = d.institution
        const dBridge = d.counters.deferredBridge ?? 0
        const dMain = d.counters.deferredMain ?? 0
        if (dBridge + dMain <= 0) return
        const extra = dBridge * p.bridgeRate + dMain * p.mainRate
        if (extra <= 0) return
        b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + extra
        b.capital.cet1 -= extra * (1 - b.taxRate)
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + extra * (1 - b.taxRate)
        d.counters.deferCost = (d.counters.deferCost ?? 0) + extra
        ctx.log(
          `재구조화 이연 비용: 브릿지 ${dBridge.toFixed(2)}조×${(p.bridgeRate * 100).toFixed(0)}% + 본PF ${dMain.toFixed(2)}조×${(p.mainRate * 100).toFixed(1)}% = 추가 충당 ${extra.toFixed(3)}조`,
        )
      },
      p.label,
    )
  },

  /**
   * 금융감독원 사업성 평가(양호·보통·유의·부실우려)를 재구조화 이연 사업장에 적용한다.
   * 은행의 경우 유의 = 고정(20%), 부실우려 = 회수의문(50%)으로 적립하며, 평가 범위(`coverage`)가
   * 클수록 지금 자본이 깎이고 작을수록 감독당국의 재분류 여지가 남는다.
   */
  evaluateSites(p: {
    bucket: ProvisionBucket
    coverage: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'evaluateSites',
      { bucket: p.bucket, coverage: p.coverage },
      (d, ctx) => {
        const b = d.institution
        const deferred = d.counters.deferredExposure ?? 0
        const covered = deferred * clamp(p.coverage, 0, 1)
        const target = covered * PROVISION_RATE[p.bucket]
        const booked = d.counters.booked_sites ?? 0
        const delta = Math.max(0, target - booked)
        if (delta > 0) {
          d.counters.booked_sites = target
          b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + delta
          b.capital.cet1 -= delta * (1 - b.taxRate)
          d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + delta * (1 - b.taxRate)
        }
        const rwaTarget = covered * (RW_MULTIPLE[p.bucket] - 1)
        b.rwa += rwaTarget - (d.counters.rwaAdd_sites ?? 0)
        d.counters.rwaAdd_sites = rwaTarget
        b.custom.pfCdSharePct =
          (b.custom.pfExposure ?? 0) > 0 ? (covered / (b.custom.pfExposure ?? 1)) * 100 : 0
        d.flags.sites_evaluated = true
        d.flagTurns.sites_evaluated ??= d.turnIndex
        ctx.log(
          `사업성 평가 적용: 이연 ${deferred.toFixed(2)}조 중 ${covered.toFixed(2)}조를 ${p.bucket}으로 분류 → 추가 적립 ${delta.toFixed(3)}조, C·D 비중 ${(b.custom.pfCdSharePct ?? 0).toFixed(1)}%`,
        )
      },
      p.label,
    )
  },

  /** 자구안 약정(장부상). 실제 도착은 `deliverSelfRescue`가 시차를 두고 판정한다. */
  pledgeSelfRescue(p: { amount: number; kind: string; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'pledgeSelfRescue',
      { amount: p.amount, kind: p.kind },
      (d, ctx) => {
        const b = d.institution
        b.custom.selfRescuePledged = (b.custom.selfRescuePledged ?? 0) + p.amount
        ctx.log(
          `자구안 약정 ${p.kind} ${p.amount.toFixed(2)}조 → 장부상 합계 ${(b.custom.selfRescuePledged ?? 0).toFixed(2)}조`,
        )
      },
      p.label,
    )
  },

  /**
   * 약정한 자구안 중 실제로 도착한 금액. `realisation`은 실현율이며, 도착분은 그룹 채권을 상환해
   * 익스포저와 (이미 쌓은 범위 안에서) 충당금을 되돌린다. 장부상 충분한 자구안이 시차와 실현율
   * 때문에 무용해지는 경로가 바로 여기서 갈린다.
   */
  deliverSelfRescue(p: {
    amount: number
    realisation: number
    kind: string
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'deliverSelfRescue',
      { amount: p.amount, realisation: p.realisation, kind: p.kind },
      (d, ctx) => {
        const b = d.institution
        const arrived = Math.max(0, p.amount * clamp(p.realisation, 0, 1))
        b.custom.selfRescueDelivered = (b.custom.selfRescueDelivered ?? 0) + arrived
        if (arrived <= 0) {
          ctx.log(`자구안 ${p.kind}: 도착 없음 (실현율 0)`)
          return
        }
        // 도착분은 무담보 → 담보부 순으로 상환에 쓰인다
        const unsec = b.custom.groupUnsecured ?? 0
        const toUnsec = Math.min(unsec, arrived)
        b.custom.groupUnsecured = unsec - toUnsec
        const rest = arrived - toUnsec
        b.custom.groupSecured = Math.max(0, (b.custom.groupSecured ?? 0) - rest)
        b.cash += arrived
        b.loans.corporate = Math.max(0, b.loans.corporate - arrived)
        // 충당금 환입: 무담보분에 쌓아 둔 적립액 중 상환분 비율만큼
        const booked = d.counters.booked_groupUnsecured ?? 0
        if (booked > 0 && unsec > 0) {
          const back = booked * (toUnsec / unsec)
          d.counters.booked_groupUnsecured = booked - back
          b.custom.provisionsCum = Math.max(0, (b.custom.provisionsCum ?? 0) - back)
          b.capital.cet1 += back * (1 - b.taxRate)
        }
        d.confidence.index = clamp(d.confidence.index + 3, 0, 100)
        ctx.log(
          `자구안 ${p.kind} 도착 ${arrived.toFixed(2)}조 (약정 ${p.amount.toFixed(2)}조 × 실현율 ${(p.realisation * 100).toFixed(0)}%) → 그룹 익스포저 ${((b.custom.groupSecured ?? 0) + (b.custom.groupUnsecured ?? 0)).toFixed(2)}조`,
        )
      },
      p.label,
    )
  },

  /**
   * 만기연장을 하면서 자산건전성 분류를 그대로 두는 처리. 오늘은 충당금도 자본 영향도 없지만,
   * 감독당국의 재분류 지시가 오면 같은 금액을 한꺼번에 쌓게 된다(지연효과로 판정).
   */
  freezeClassification(p: { months: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'freezeClassification',
      { months: p.months },
      (d, ctx) => {
        d.flags.classification_frozen = true
        d.flagTurns.classification_frozen ??= d.turnIndex
        d.counters.extensionMonths = (d.counters.extensionMonths ?? 0) + p.months
        d.confidence.index = clamp(d.confidence.index + 2, 0, 100)
        ctx.log(
          `만기 ${p.months}개월 연장 + 건전성 분류 유지 — 당기 충당금 영향 없음(누적 연장 ${d.counters.extensionMonths}개월)`,
        )
      },
      p.label,
    )
  },

  /**
   * 감독당국 재분류 지시. 동결해 둔 익스포저를 지정 단계로 강제 재분류하고 감독 단계를 올린다.
   * `multiple`은 동결 기간이 길수록 커지는 가산(추가 손상)이다.
   */
  supervisorReclassify(p: {
    pools: ExposurePool[]
    bucket: ProvisionBucket
    share: number
    surcharge: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'supervisorReclassify',
      { bucket: p.bucket, share: p.share, surcharge: p.surcharge },
      (d, ctx) => {
        const b = d.institution
        let total = 0
        for (const pool of p.pools) {
          const amount = (b.custom[pool] ?? 0) * clamp(p.share, 0, 1)
          const target = amount * PROVISION_RATE[p.bucket] * (1 + p.surcharge)
          const bookedKey = `booked_${pool}`
          const booked = d.counters[bookedKey] ?? 0
          const delta = Math.max(0, target - booked)
          if (delta > 0) {
            d.counters[bookedKey] = target
            b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + delta
            b.capital.cet1 -= delta * (1 - b.taxRate)
            d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + delta * (1 - b.taxRate)
            total += delta
          }
          const rwaKey = `rwaAdd_${pool}`
          const rwaTarget = amount * (RW_MULTIPLE[p.bucket] - 1)
          b.rwa += rwaTarget - (d.counters[rwaKey] ?? 0)
          d.counters[rwaKey] = rwaTarget
        }
        d.regulator.level = Math.min(4, d.regulator.level + 1) as 0 | 1 | 2 | 3 | 4
        d.regulator.notes.push('부동산 PF 자산건전성 재분류 지시')
        d.confidence.index = clamp(d.confidence.index - 6, 0, 100)
        ctx.log(
          `감독당국 재분류 지시: 추가 적립 ${total.toFixed(3)}조, 감독 단계 R${d.regulator.level}`,
        )
      },
      p.label,
    )
  },

  /** 신규자금(신디케이트) 집행. 우선변제권이 있으면 손실률이 낮고, 없으면 그대로 위험에 노출된다. */
  newMoney(p: { amount: number; senior: boolean; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'newMoney',
      { amount: p.amount, senior: p.senior },
      (d, ctx) => {
        const b = d.institution
        b.cash -= p.amount
        b.loans.corporate += p.amount
        b.custom.newMoney = (b.custom.newMoney ?? 0) + p.amount
        b.rwa += p.amount * (p.senior ? 0.75 : 1.25)
        if (p.senior) {
          d.flags.new_money_senior = true
          d.flagTurns.new_money_senior ??= d.turnIndex
        }
        ctx.log(
          `신규자금 ${p.amount.toFixed(2)}조 집행 (${p.senior ? '우선변제권 확보' : '일반 채권'}) → 누적 ${(b.custom.newMoney ?? 0).toFixed(2)}조`,
        )
      },
      p.label,
    )
  },

  /**
   * 그룹이 회생절차로 넘어갔을 때의 파급. 담보부 회수율이 떨어지고 무담보는 전액 손상되며,
   * 같은 시공사의 사업장과 업권 전반으로 부실이 번진다(2025년 건설사 7곳 법정관리의 경로).
   */
  courtReceivership(p: {
    securedRecovery: number
    sectorLoss: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'courtReceivership',
      { securedRecovery: p.securedRecovery, sectorLoss: p.sectorLoss },
      (d, ctx) => {
        const b = d.institution
        const unsec = b.custom.groupUnsecured ?? 0
        const sec = b.custom.groupSecured ?? 0
        const target = unsec + sec * (1 - p.securedRecovery)
        const booked =
          (d.counters.booked_groupUnsecured ?? 0) + (d.counters.booked_groupSecured ?? 0)
        const delta = Math.max(0, target - booked)
        d.counters.booked_groupUnsecured = unsec
        d.counters.booked_groupSecured = sec * (1 - p.securedRecovery)
        const sector = (b.custom.pfExposure ?? 0) * p.sectorLoss
        const total = delta + sector
        b.custom.provisionsCum = (b.custom.provisionsCum ?? 0) + total
        b.capital.cet1 -= total * (1 - b.taxRate)
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + total * (1 - b.taxRate)
        b.loans.nonPerforming += unsec + sec
        b.rwa += (unsec + sec) * 0.5
        d.flags.court_receivership = true
        d.flagTurns.court_receivership ??= d.turnIndex
        d.confidence.index = clamp(d.confidence.index - 10, 0, 100)
        ctx.log(
          `회생절차 전환: 그룹 추가 충당 ${delta.toFixed(3)}조 + 업권 파급 ${sector.toFixed(3)}조 = ${total.toFixed(3)}조`,
        )
      },
      p.label,
    )
  },

  /** 자본확충(후순위채·조건부자본). Tier 2는 CET1을 올리지 않는다 — 그것이 이 선택의 한계다. */
  raiseTier2(p: { amount: number; costBp: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'raiseTier2',
      { amount: p.amount, costBp: p.costBp },
      (d, ctx) => {
        const b = d.institution
        b.capital.tier2 += p.amount
        b.cash += p.amount
        b.otherLiabilities += p.amount
        d.counters.tier2Raised = (d.counters.tier2Raised ?? 0) + p.amount
        ctx.log(
          `후순위채 ${p.amount.toFixed(2)}조 발행 (가산 ${p.costBp}bp) — 총자본비율만 오르고 CET1은 그대로`,
        )
      },
      p.label,
    )
  },

  /** 위험가중자산 축소(여신 매각·한도 회수). CET1 비율을 분모에서 올린다. */
  shrinkRwa(p: { amount: number; lossRate: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'shrinkRwa',
      { amount: p.amount, lossRate: p.lossRate },
      (d, ctx) => {
        const b = d.institution
        const loss = p.amount * p.lossRate
        b.rwa = Math.max(0, b.rwa - p.amount)
        b.loans.corporate = Math.max(0, b.loans.corporate - p.amount)
        b.cash += p.amount - loss
        b.capital.cet1 -= loss * (1 - b.taxRate)
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + loss * (1 - b.taxRate)
        ctx.log(
          `여신 ${p.amount.toFixed(2)}조 매각: RWA −${p.amount.toFixed(2)}조, 매각손 ${loss.toFixed(3)}조`,
        )
      },
      p.label,
    )
  },

  /** 업권 공표치 갱신(외생). 플레이어 결정과 무관하게 같은 시점에 같은 값이 들어온다. */
  setSectorData(p: {
    loanTn: number
    delinqPct: number
    securitiesPct: number
    savingsPct: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'setSectorData',
      { loanTn: p.loanTn, delinqPct: p.delinqPct },
      (d, ctx) => {
        d.market.custom.pfSectorLoanTn = p.loanTn
        d.market.custom.pfSectorDelinqPct = p.delinqPct
        d.market.custom.pfSecuritiesDelinqPct = p.securitiesPct
        d.market.custom.pfSavingsDelinqPct = p.savingsPct
        ctx.log(
          `업권 PF 공표치 갱신: 잔액 ${p.loanTn}조, 연체율 ${p.delinqPct}% (증권 ${p.securitiesPct}%, 저축은행 ${p.savingsPct}%)`,
        )
      },
      p.label,
    )
  },

  /** 자사 PF 연체율 갱신 — 사업장 처리 결과에서 결정론적으로 계산한다. */
  refreshDelinquency(p: { label?: string } = {}): Effect<BankState> {
    return fnEffect<BankState>(
      'refreshDelinquency',
      {},
      (d, ctx) => {
        const b = d.institution
        const exposure = b.custom.pfExposure ?? 0
        if (exposure <= 0) return
        const deferred = d.counters.deferredExposure ?? 0
        const frozen = d.flags.classification_frozen ? 0.6 : 1
        const pct = clamp(
          0.62 + ((deferred * 0.9 + (b.custom.pfBridge ?? 0) * 0.35) / exposure) * 100 * frozen,
          0,
          60,
        )
        b.custom.pfDelinquencyPct = pct
        ctx.log(`자사 부동산 PF 연체율 ${pct.toFixed(2)}%`)
      },
      p.label,
    )
  },
}
