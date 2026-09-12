import type { Draft } from 'immer'
import type { CentralBankState, Effect, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../../engine/core/noise'
import { fnEffect } from '../../engine/fx/common'
import { runStateFromCi } from '../../metrics/runoff'

/**
 * savings-bank-2011 전용 효과 빌더.
 *
 * 공유 `central_bank` fx 모듈은 없다 — korea-imf-1997/fx.ts, credit-suisse-2023/fx.ts와 같은 방식으로
 * 시나리오 안에 둔다. 산식·앵커는 전부 `calibration.md`에 표로 기록했고, 이 파일의 주석은 그 표가
 * **왜** 그 모양인지만 적는다.
 *
 * ── 이 시나리오의 상태 매핑 (calibration.md §1) ──
 * `CentralBankState`는 원래 외환당국용이다. 2011년 금융당국을 그 위에 올리면서 필드를 다음과 같이
 * 재해석했다. 매핑은 바꾸지 않으며, 대시보드 라벨은 `kpis`에서 다시 붙인다.
 *   reserves.usable            예금보험기금 저축은행계정 가용재원(조원)
 *   reserves.gross             예금보험기금 전 계정 합계(조원)
 *   reserves.forwardCommitments  이미 확정된 지원 확약(가교·계약이전 예상 소요)
 *   external.shortTermDebt     향후 1년 내 예상 정리소요액 → guidottiRatio = 정리재원 커버리지
 *   external.monthlyImports    월평균 예금대지급 소요 → importCoverMonths = 재원 커버 개월
 *   bankingSystem.failedBanks  영업정지 누계 기관 수
 *   bankingSystem.distressedBanks  BIS 5% 미만 등 부실 징후 기관 수
 *   imf.stage / imf.committed  구조조정특별계정의 입법 단계와 약정 재원(조원)
 *   sovereign.spreadBp         회사채 AA− 3년 − 국고채 3년 신용스프레드(bp). CentralBankState에
 *                              다른 스프레드 칸이 없어 재사용했다 — KPI로 노출하지 않는다.
 *
 * ── 전염 모형 (이 시나리오의 심장) ──
 * 예금은 세 무리로 나뉜다: `busan`(부산저축은행 계열), `peer`(BIS 5% 미만 취약 저축은행),
 * `sound`(나머지). **한 곳을 먼저 정지하면 같은 계열의 남은 곳으로 인출이 옮겨 간다.**
 *   같은 계열 잔여분  spill ×= 1 + 1.6 × (정지된 계열 수신 비중)   ← 잔여가 0이면 적용되지 않는다
 *   다른 무리         spill ×= 1 + 0.35 (peer) / 1 + 0.21 (sound)
 * 계열을 한 번에 전부 정지하면 "다음 곳"이 없으므로 같은 계열 항이 사라지고 교차 항만 남는다.
 * 그것이 2011년 2월 17일과 19일 사이에 실제로 일어난 일의 모형이다.
 */

type SbDraft = Draft<GameState<CentralBankState>>

export type SbGroup = 'busan' | 'peer' | 'sound'

/** 같은 계열 잔여 기관으로 옮겨 가는 인출 압력의 최대 배수(정지 비중 100%일 때 +160%) [CAL]. */
export const SAME_GROUP_SPILL = 1.6
/**
 * 계열이 아닌 같은 무리(BIS 5% 미만 등 취약군) 안에서 옮겨 가는 압력 [CAL].
 * 계열은 자금·전산·평판을 공유하므로 압력이 훨씬 크다 — 그 차이가 이 시나리오의 요점이다.
 */
export const SAME_BUCKET_SPILL = 0.7
/** 다른 취약 저축은행으로 번지는 교차 압력 [CAL]. */
export const CROSS_GROUP_SPILL = 0.35
/** 건전 저축은행으로 번지는 교차 압력 — 취약군의 60% [CAL]. */
export const SOUND_SPILL_SHARE = 0.6
/** 전염 계수의 상한. 이 위로는 어떤 조합도 올라가지 않는다 [CAL]. */
export const SPILL_CAP = 3.2
/** 턴이 바뀔 때 전염 계수가 1을 향해 줄어드는 비율 [CAL]. */
export const SPILL_DECAY = 0.18
/** 유동성 백스톱이 감당하는 인출 비중(나머지는 저축은행 자체 현금) [CAL]. */
export const BACKSTOP_COVERAGE = 0.6

/** 무리별 · 런 상태별 일일 인출률(해당 무리 수신 대비, 분수). calibration.md §3. */
export const BASE_RATE: Record<SbGroup, [number, number, number, number]> = {
  busan: [0.002, 0.007, 0.02, 0.05],
  peer: [0.001, 0.003, 0.0085, 0.022],
  sound: [0.0002, 0.0006, 0.0016, 0.0045],
}

const DEP_KEY: Record<SbGroup, string> = {
  busan: 'depBusan',
  peer: 'depPeer',
  sound: 'depSound',
}
const SPILL_KEY: Record<SbGroup, string> = {
  busan: 'spillBusan',
  peer: 'spillPeer',
  sound: 'spillSound',
}
const OUT_KEY: Record<SbGroup, string> = {
  busan: 'outflowBusan',
  peer: 'outflowPeer',
  sound: 'outflowSound',
}
const WINDOW_KEY: Record<SbGroup, string> = {
  busan: 'wbBusan',
  peer: 'wbPeer',
  sound: 'wbSound',
}

export const GROUPS: SbGroup[] = ['busan', 'peer', 'sound']

/**
 * 같은 계열 안에서 옮겨 가는 압력. 잔여 기관이 없으면(계열 일괄 정지) 1 — "다음 곳"이 없기 때문이다.
 * 이 한 줄이 이 시나리오가 가르치려는 상충의 전부다.
 */
export function affiliateSpill(suspendedShare: number, remainingDeposits: number): number {
  if (remainingDeposits <= 1e-9) return 1
  return 1 + SAME_GROUP_SPILL * clamp(suspendedShare, 0, 1)
}

function cb(d: SbDraft): Draft<CentralBankState> {
  return d.institution
}

function cnum(s: Draft<CentralBankState>, key: string, fallback = 0): number {
  return s.custom[key] ?? fallback
}

function counterOf(d: SbDraft, key: string, fallback = 0): number {
  const v = d.counters[key]
  return v === undefined ? fallback : v
}

function addCounter(d: SbDraft, key: string, v: number): void {
  d.counters[key] = counterOf(d, key) + v
}

function setFlagOnce(d: SbDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function ci(d: SbDraft, delta: number): void {
  d.confidence.index = clamp(d.confidence.index + delta, 0, 100)
}

function depositors(d: SbDraft, delta: number): void {
  d.confidence.depositors = clamp(d.confidence.depositors + delta, 0, 100)
}

function f2(n: number): string {
  return n.toFixed(2)
}

function multiplySpill(d: SbDraft, group: SbGroup, factor: number): void {
  const key = SPILL_KEY[group]
  d.counters[key] = clamp(counterOf(d, key, 1) * factor, 1, SPILL_CAP)
}

/** 대시보드 표시용 사본을 상태와 맞춘다. 모든 효과의 마지막 줄에서 호출된다. */
export function sync(d: SbDraft): void {
  const s = cb(d)
  s.custom.depositsSector = cnum(s, 'depBusan') + cnum(s, 'depPeer') + cnum(s, 'depSound')
  s.custom.suspendedBanks = s.bankingSystem.failedBanks
  s.custom.specialAccountTn = s.imf.committed
  s.custom.backstopRemaining = Math.max(0, cnum(s, 'backstopRemaining'))
  s.custom.spillBusan = counterOf(d, 'spillBusan', 1)
  s.custom.spillPeer = counterOf(d, 'spillPeer', 1)
  // `bankingSystem`·`external`의 두 값은 엔진이 지표 행으로 내보내지 않으므로 표시용 사본을 둔다.
  s.custom.capitalShortfall = s.bankingSystem.capitalShortfall
  s.custom.resolutionNeed = s.external.shortTermDebt
  d.market.policyRateBp = s.policy.rateBp
  d.market.fxUsdLocal = s.fx.spot
  s.sovereign.spreadBp = Math.max(0, Math.round(d.market.creditSpreadIgBp))
}

export const sbFx = {
  /** 표시용 사본만 갱신한다(수치를 바꾸지 않는 턴의 entryEffects 마지막에 둔다). */
  refresh(label?: string): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'refresh',
      {},
      (d) => {
        sync(d)
      },
      label ?? '지표 갱신',
    )
  },

  /**
   * 창구 인출을 무리별로 계산해 `profile`대로 틱에 배분한다.
   *
   * 슬라이스는 **줄어드는 잔액이 아니라 턴 시작 잔액**(`counters.wb*`)에 몫을 곱한다. 그래서
   * variance 0에서 슬라이스 합계가 틱 없는 단일 호출(`profile: [1]`)과 정확히 일치한다.
   * 반대로 런 상태·전염 계수·완화 계수는 **매 틱 실시간으로** 읽으므로, 틱 중간에 확정된 정지나
   * 발표는 남은 슬라이스에만 걸린다.
   *
   * 이름이 `runoffStep`인 것은 무결성 린트(`tick-profile`)가 이 이름의 `profile` 길이를 검사하기
   * 때문이다. `days`는 한 턴이 덮는 영업일 수다(T3의 2/18·2/21처럼 주말을 낀 턴은 2).
   */
  runoffStep(p: { days: number; profile: number[]; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'runoffStep',
      { days: p.days, profile: p.profile.join('/') },
      (d, ctx) => {
        const s = cb(d)
        const share = p.profile[ctx.tick] ?? (ctx.ticks === 1 ? 1 : 0)
        if (ctx.tick === 0) {
          for (const g of GROUPS) d.counters[WINDOW_KEY[g]] = cnum(s, DEP_KEY[g])
          d.counters.outflowThisTurn = 0
        }
        if (share <= 0) {
          sync(d)
          return
        }
        const runState = runStateFromCi(d.confidence.index)
        const damp = clamp(counterOf(d, 'dampener', 1), 0.35, 1)
        const noise = noiseFactor(
          ctx,
          ctx.noise?.runoffSigma ?? DEFAULT_NOISE.runoffSigma,
          ctx.noise?.runoffCap ?? DEFAULT_NOISE.runoffCap,
        )
        let total = 0
        const parts: string[] = []
        for (const g of GROUPS) {
          const base = counterOf(d, WINDOW_KEY[g], cnum(s, DEP_KEY[g]))
          if (base <= 0) continue
          const spill = clamp(counterOf(d, SPILL_KEY[g], 1), 1, SPILL_CAP)
          const rate = BASE_RATE[g][runState] * spill * damp
          const slice = Math.min(cnum(s, DEP_KEY[g]), base * rate * p.days * share * noise)
          if (slice <= 0) continue
          s.custom[DEP_KEY[g]] = Math.max(0, cnum(s, DEP_KEY[g]) - slice)
          s.custom[OUT_KEY[g]] = cnum(s, OUT_KEY[g]) + slice
          total += slice
          parts.push(`${g} ${f2(slice)}(율 ${(rate * 100).toFixed(3)}%×${p.days}일)`)
          if (g === 'busan') s.custom.busanRateToday = rate
        }
        s.custom.outflowToday = ctx.tick === 0 ? total : cnum(s, 'outflowToday') + total
        s.custom.depositOutflowCum = cnum(s, 'depositOutflowCum') + total
        addCounter(d, 'outflowThisTurn', total)
        d.counters.peakDailyOutflow = Math.max(
          counterOf(d, 'peakDailyOutflow'),
          cnum(s, 'outflowToday'),
        )
        // 백스톱은 인출의 일부를 대신 결제한다. 바닥나는 순간이 곧 "다음 정지"의 시작이다.
        const remaining = cnum(s, 'backstopRemaining')
        if (remaining > 0) {
          const drawn = Math.min(remaining, total * BACKSTOP_COVERAGE)
          s.custom.backstopRemaining = remaining - drawn
          s.custom.backstopDrawn = cnum(s, 'backstopDrawn') + drawn
          if (s.custom.backstopRemaining <= 1e-9 && !d.flags.backstop_exhausted) {
            setFlagOnce(d, 'backstop_exhausted')
            ci(d, -5)
            for (const g of GROUPS) multiplySpill(d, g, 1.25)
            ctx.log('유동성 백스톱 소진 — 잔여 저축은행이 자체 현금으로 버텨야 한다 (전염 ×1.25)')
          }
        } else if (total > 0 && cnum(s, 'backstopTotal') > 0) {
          setFlagOnce(d, 'backstop_exhausted')
        }
        ctx.log(
          `창구 인출 슬라이스 ${(share * 100).toFixed(0)}% → ${f2(total)}조 (당일 누계 ${f2(cnum(s, 'outflowToday'))}조, 누적 ${f2(cnum(s, 'depositOutflowCum'))}조) [${['S0', 'S1', 'S2', 'S3'][runState]} × 완화 ${damp.toFixed(2)}] ${parts.join(' · ')}`,
        )
        if (ctx.isLastTick) {
          for (const g of GROUPS) delete d.counters[WINDOW_KEY[g]]
        }
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 영업정지(부실금융기관 결정 + 영업정지 명령). 정지된 기관의 예금은 그 자리에서 얼어붙고,
   * **남은 계열사로 인출이 옮겨 간다** — 잔여가 0이면 옮겨 갈 곳이 없다.
   *
   * `payout`은 예금보험기금 저축은행계정에서 즉시 빠져나가는 가지급금·대지급 소요다.
   * `forbearanceCost`(적기시정조치 유예로 커진 손실)가 쌓여 있으면 그만큼 더 나간다.
   */
  suspend(p: {
    group: SbGroup
    count: number
    deposits: number
    excessDeposits: number
    subDebt: number
    payout: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'suspend',
      {
        group: p.group,
        count: p.count,
        deposits: p.deposits,
        excessDeposits: p.excessDeposits,
        subDebt: p.subDebt,
        payout: p.payout,
      },
      (d, ctx) => {
        const s = cb(d)
        const key = DEP_KEY[p.group]
        const before = cnum(s, key)
        const frozen = Math.min(before, p.deposits)
        const remaining = Math.max(0, before - frozen)
        const share = before > 0 ? frozen / before : 0

        s.custom[key] = remaining
        s.custom.depFrozen = cnum(s, 'depFrozen') + frozen
        s.custom.excessDeposits = cnum(s, 'excessDeposits') + p.excessDeposits
        s.custom.subDebt = cnum(s, 'subDebt') + p.subDebt
        s.bankingSystem.failedBanks += p.count
        s.bankingSystem.distressedBanks = Math.max(0, s.bankingSystem.distressedBanks - p.count)

        const inflation = 1 + clamp(counterOf(d, 'forbearanceCost'), 0, 1.2)
        const payout = p.payout * inflation
        s.reserves.usable -= payout
        s.reserves.gross -= payout
        s.bankingSystem.liquiditySupport += payout
        s.custom.supportCum = cnum(s, 'supportCum') + payout
        s.external.shortTermDebt = Math.max(0.5, s.external.shortTermDebt - p.payout * 0.4)

        // 계열(`busan`)만 자금·전산·평판을 공유한다. 취약군은 같은 무리일 뿐이므로 압력이 훨씬 작고,
        // "계열을 나눠 정지했다"는 기록(`partialSuspensions`)도 계열에만 남는다.
        const affiliated = p.group === 'busan'
        const sameGroup =
          remaining <= 1e-9
            ? 1
            : 1 + (affiliated ? SAME_GROUP_SPILL : SAME_BUCKET_SPILL) * clamp(share, 0, 1)
        if (sameGroup > 1) {
          multiplySpill(d, p.group, sameGroup)
          if (affiliated) {
            setFlagOnce(d, 'partial_affiliate_suspension')
            addCounter(d, 'partialSuspensions', 1)
          }
        }
        for (const g of GROUPS) {
          if (g === p.group) continue
          multiplySpill(d, g, 1 + CROSS_GROUP_SPILL * (g === 'sound' ? SOUND_SPILL_SHARE : 1))
        }
        // 정지 기관 수에 체감하는 신뢰 충격 — 한 번에 여러 곳을 닫는 것이 같은 수를 나눠 닫는 것보다 낫다.
        const shock = Math.min(8, 2 + 0.8 * (p.count - 1))
        ci(d, -shock)
        depositors(d, -shock * 1.2)
        addCounter(d, 'suspendEvents', 1)
        setFlagOnce(d, 'suspension_done')
        if (s.bankingSystem.failedBanks > p.count + 1) setFlagOnce(d, 'more_suspensions')

        ctx.log(
          `영업정지 ${p.count}개사 (${p.group}) — 예금 ${f2(frozen)}조 지급정지, 누계 ${s.bankingSystem.failedBanks}개사. ` +
            `5천만원 초과 예금 누계 ${f2(cnum(s, 'excessDeposits'))}조 · 후순위채 누계 ${f2(cnum(s, 'subDebt'))}조. ` +
            `대지급 소요 ${f2(payout)}조(유예 가산 ×${inflation.toFixed(2)}) → 저축은행계정 잔여 ${f2(s.reserves.usable)}조. ` +
            (remaining > 0
              ? `계열 잔여 ${f2(remaining)}조로 인출이 옮겨 간다 (전염 ×${sameGroup.toFixed(2)})`
              : '계열을 한 번에 정지해 옮겨 갈 다음 창구가 없다'),
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 적기시정조치 유예. 오늘의 줄은 짧아지지만(완화 ×0.9, ΔCI +3) 손실은 자란다.
   * `forbearanceCost`는 이후 모든 `suspend`의 대지급 소요를 그만큼 부풀린다 — 유예의 값은
   * 미루는 순간이 아니라 정리하는 순간에 청구된다.
   */
  forbear(p: {
    count: number
    months: number
    lossGrowthPerMonth: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'forbear',
      { count: p.count, months: p.months, lossGrowthPerMonth: p.lossGrowthPerMonth },
      (d, ctx) => {
        const s = cb(d)
        const growth = p.months * p.lossGrowthPerMonth
        s.custom.forbearanceCount = cnum(s, 'forbearanceCount') + p.count
        s.bankingSystem.capitalShortfall *= 1 + growth
        s.external.shortTermDebt *= 1 + growth
        addCounter(d, 'forbearanceCost', growth)
        d.counters.dampener = clamp(counterOf(d, 'dampener', 1) * 0.9, 0.35, 1)
        ci(d, 3)
        setFlagOnce(d, 'forbearance_used')
        ctx.log(
          `적기시정조치 ${p.count}개사 ${p.months}개월 유예 — 오늘의 인출은 완화 ×0.9로 줄지만 ` +
            `자본부족액이 ${(growth * 100).toFixed(0)}% 자라 ${f2(s.bankingSystem.capitalShortfall)}조가 되고, ` +
            `앞으로의 대지급 소요가 같은 비율로 부풀어 오른다`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 유동성 백스톱 약정(중앙회 지급준비예탁금·정책금융공사·은행 크레딧라인·증권금융).
   * 규모가 클수록 인출이 완화되지만, 약정은 약정일 뿐 — 인출의 60%를 결제하는 동안 줄어든다.
   */
  backstop(p: { amount: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'backstop',
      { amount: p.amount },
      (d, ctx) => {
        const s = cb(d)
        s.custom.backstopTotal = cnum(s, 'backstopTotal') + p.amount
        s.custom.backstopRemaining = cnum(s, 'backstopRemaining') + p.amount
        d.counters.dampener = clamp(
          counterOf(d, 'dampener', 1) * (1 - Math.min(0.25, p.amount / 24)),
          0.35,
          1,
        )
        setFlagOnce(d, 'backstop_ready')
        ctx.log(
          `유동성 백스톱 ${f2(p.amount)}조 약정 — 누계 ${f2(cnum(s, 'backstopTotal'))}조, 완화 계수 ${counterOf(d, 'dampener', 1).toFixed(2)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 구조조정 특별계정의 입법·집행 단계. `CentralBankState.imf`를 그대로 쓴다 — 두 제도 모두
   * "외부 재원을 쓰려면 먼저 합의가 있어야 하고, 합의에는 시간이 걸린다"는 같은 구조다.
   */
  specialAccount(p: {
    stage: 'none' | 'requested' | 'negotiating' | 'agreed' | 'disbursed'
    committed?: number
    draw?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'specialAccount',
      { stage: p.stage, committed: p.committed ?? -1, draw: p.draw ?? 0 },
      (d, ctx) => {
        const s = cb(d)
        s.imf.stage = p.stage
        if (p.committed !== undefined) s.imf.committed = p.committed
        if (p.draw) {
          s.imf.disbursed += p.draw
          s.reserves.usable += p.draw
          s.reserves.gross += p.draw
        }
        if (p.stage === 'requested') setFlagOnce(d, 'special_account_requested')
        if (p.stage === 'agreed' || p.stage === 'disbursed') {
          setFlagOnce(d, 'special_account_agreed')
          ci(d, 4)
        }
        ctx.log(
          `구조조정 특별계정 단계: ${p.stage}` +
            (p.committed !== undefined ? ` (약정 재원 ${f2(p.committed)}조)` : '') +
            (p.draw ? ` — 인출 ${f2(p.draw)}조, 저축은행계정 ${f2(s.reserves.usable)}조` : ''),
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 예금보험기금 저축은행계정의 직접 지원(자금지원·가지급금·출연). */
  supportFund(p: { amount: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'supportFund',
      { amount: p.amount, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        s.reserves.usable -= p.amount
        s.reserves.gross -= p.amount
        s.bankingSystem.liquiditySupport += p.amount
        s.custom.supportCum = cnum(s, 'supportCum') + p.amount
        ctx.log(
          `예금보험기금 저축은행계정 지원 ${f2(p.amount)}조 (${p.reason}) — 잔여 ${f2(s.reserves.usable)}조, 누계 ${f2(cnum(s, 'supportCum'))}조`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 보호 범위의 공표. 법이 보장하는 범위에서 멈추면 아무것도 뒤집히지 않고, 그 너머를 약속하면
   * 오늘은 조용해지지만 다음 라운드의 기대가 바뀐다 — 그 판정은 지연효과가 한다.
   */
  promiseProtection(p: {
    scope: 'legal' | 'mediation' | 'full'
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'promiseProtection',
      { scope: p.scope },
      (d, ctx) => {
        if (p.scope === 'legal') {
          setFlagOnce(d, 'protection_legal')
          ci(d, 1)
          ctx.log('보호 범위: 예금자보호법 한도(1인당 5천만원)까지만 공표 — 뒤집힐 수 없는 약속')
        } else if (p.scope === 'mediation') {
          setFlagOnce(d, 'protection_mediation')
          d.counters.protectionPledge = 1
          ci(d, 3)
          ctx.log(
            '보호 범위: 한도는 그대로 두되 후순위채 불완전판매는 분쟁조정·검사로 다루겠다고 공표',
          )
        } else {
          setFlagOnce(d, 'protection_full')
          d.counters.protectionPledge = 2
          ci(d, 8)
          depositors(d, 10)
          ctx.log(
            '보호 범위: 5천만원 초과 예금까지 보전을 시사 — 오늘의 줄은 짧아지지만 법적 근거가 없다',
          )
        }
        sync(d)
      },
      p.label,
    )
  },

  /** 전염 계수를 직접 조정한다(커뮤니케이션·검사 공표·합동 대응의 2차 효과). */
  adjustContagion(p: {
    factor: number
    reason: string
    groups?: SbGroup[]
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'adjustContagion',
      { factor: p.factor, reason: p.reason, groups: (p.groups ?? GROUPS).join('/') },
      (d, ctx) => {
        for (const g of p.groups ?? GROUPS) multiplySpill(d, g, p.factor)
        ctx.log(
          `전염 계수 ×${p.factor.toFixed(2)} (${p.reason}) → 계열 ${counterOf(d, 'spillBusan', 1).toFixed(2)} · 취약 ${counterOf(d, 'spillPeer', 1).toFixed(2)} · 건전 ${counterOf(d, 'spillSound', 1).toFixed(2)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 턴이 바뀔 때 전염 계수가 1을 향해 줄어든다(진정). entryEffects 첫 줄에 둔다. */
  decaySpill(label?: string): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'decaySpill',
      { decay: SPILL_DECAY },
      (d, ctx) => {
        for (const g of GROUPS) {
          const key = SPILL_KEY[g]
          const cur = counterOf(d, key, 1)
          d.counters[key] = clamp(1 + (cur - 1) * (1 - SPILL_DECAY), 1, SPILL_CAP)
        }
        const s = cb(d)
        s.custom.outflowToday = 0
        ctx.log(
          `전염 계수 감쇠 −${(SPILL_DECAY * 100).toFixed(0)}% → 계열 ${counterOf(d, 'spillBusan', 1).toFixed(2)} · 취약 ${counterOf(d, 'spillPeer', 1).toFixed(2)} · 건전 ${counterOf(d, 'spillSound', 1).toFixed(2)}`,
        )
        sync(d)
      },
      label ?? '전염 계수 감쇠',
    )
  },

  /** 완화 계수(검사 공표·합동 대응·재예치 유인 등)를 곱한다. */
  setDampener(p: { factor: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setDampener',
      { factor: p.factor, reason: p.reason },
      (d, ctx) => {
        d.counters.dampener = clamp(counterOf(d, 'dampener', 1) * p.factor, 0.35, 1)
        ctx.log(
          `완화 계수 ×${p.factor.toFixed(2)} (${p.reason}) → ${counterOf(d, 'dampener', 1).toFixed(2)}`,
        )
      },
      p.label,
    )
  },

  /** 업권 건전성 지표의 외생 갱신(검사 결과·경영진단 공표). */
  setSectorStress(p: {
    pfDelinqPct?: number
    bisSector?: number
    distressed?: number
    capitalShortfall?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setSectorStress',
      {
        pfDelinqPct: p.pfDelinqPct ?? -1,
        bisSector: p.bisSector ?? -1,
        distressed: p.distressed ?? -1,
        capitalShortfall: p.capitalShortfall ?? -1,
      },
      (d, ctx) => {
        const s = cb(d)
        if (p.pfDelinqPct !== undefined) s.custom.pfDelinqPct = p.pfDelinqPct
        if (p.bisSector !== undefined) s.custom.bisSector = p.bisSector
        if (p.distressed !== undefined) s.bankingSystem.distressedBanks = Math.max(0, p.distressed)
        if (p.capitalShortfall !== undefined) {
          s.bankingSystem.capitalShortfall =
            p.capitalShortfall * (1 + clamp(counterOf(d, 'forbearanceCost'), 0, 1.2))
        }
        ctx.log(
          `업권 지표 갱신 — PF 연체율 ${cnum(s, 'pfDelinqPct').toFixed(1)}% · 평균 BIS ${cnum(s, 'bisSector').toFixed(1)}% · ` +
            `부실 징후 ${s.bankingSystem.distressedBanks}개사 · 자본부족 ${f2(s.bankingSystem.capitalShortfall)}조`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 표시용 시장 지표 이동(주가지수·신용스프레드·조달 스트레스). 엔진 계산에는 쓰이지 않는다. */
  marketMove(p: {
    equityPct?: number
    creditSpreadBp?: number
    fundingStressBp?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'marketMove',
      {
        equityPct: p.equityPct ?? 0,
        creditSpreadBp: p.creditSpreadBp ?? 0,
        fundingStressBp: p.fundingStressBp ?? 0,
      },
      (d) => {
        if (p.equityPct)
          d.market.equityIndex = Math.max(100, d.market.equityIndex * (1 + p.equityPct / 100))
        if (p.creditSpreadBp)
          d.market.creditSpreadIgBp = Math.max(10, d.market.creditSpreadIgBp + p.creditSpreadBp)
        if (p.fundingStressBp)
          d.market.fundingStressBp = Math.max(0, d.market.fundingStressBp + p.fundingStressBp)
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 대지급 개시를 늦추는 등 예금자보호법이 허용하지 않는 조치. 감독당국 반응표의 R4에 해당한다.
   * 옵션에 `illegal: true`와 함께 쓴다.
   */
  unsafeAct(p: { reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'unsafeAct',
      { reason: p.reason },
      (d, ctx) => {
        setFlagOnce(d, 'unsafe_act')
        d.regulator.level = 4
        d.regulator.notes.push(p.reason)
        ci(d, -25)
        depositors(d, -30)
        for (const g of GROUPS) multiplySpill(d, g, 1.6)
        ctx.log(`불건전 조치: ${p.reason} — 대응 단계 R4, 전염 ×1.6`)
        sync(d)
      },
      p.label,
    )
  },
}
