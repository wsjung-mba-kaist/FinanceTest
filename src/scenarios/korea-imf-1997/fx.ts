import type { Draft } from 'immer'
import type { CentralBankState, Effect, EffectContext, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../../engine/core/noise'
import { fnEffect } from '../../engine/fx/common'

/**
 * korea-imf-1997 전용 효과 빌더. 공유 `central_bank` fx 모듈이 없으므로 mg-run-2023/fx.ts,
 * uk-ldi-2022/ldiFx.ts와 같은 방식으로 시나리오 안에 둔다. 산식·앵커는
 * docs/scenarios/korea-imf-1997.md §2.3·§4에 표로 기록했다.
 *
 * ── 보유액 회계 규약 (이 시나리오의 전부다) ──
 *  · `reserves.gross`  총외환보유액 — 매월 공표되는 숫자
 *  · `reserves.usable` 가용외환보유액 — 오늘 결제에 쓸 수 있는 숫자
 *  · `reserves.forwardCommitments` 선물환 매도·스왑 미결제 잔액 — 나중에 갚아야 할 숫자
 *
 *  네 가지 움직임이 이 셋을 서로 다르게 건드린다.
 *   intervene            가용 −X, 총액 −0.4X, 선물환 +0.6X   (현물 매도의 60%는 스왑으로 조달했다)
 *   runoffStep           가용 −X, 총액 −X                    (외채 상환·무역결제로 실제 나간 돈)
 *   depositAtBranches    가용 −X, 총액 불변                   (해외점포 예치 — 괴리를 만드는 바로 그 행위)
 *   disburse             가용 +X, 총액 +X                    (IMF·양자 인출)
 *
 *  개입의 40% 규칙은 역사 앵커에서 역산했다: 10~11월에 약 151억달러를 쓰는 동안 공표 보유액은
 *  305.1 → 244로 61억 줄었다(61/151 ≈ 0.40). 같은 기간 가용은 223.0 → 72.6으로 전액 줄었다.
 *
 * ── 유출 계수(`counters.drainMultiplier`)의 규약 ──
 * 각 턴의 `runoffStep({ total })`은 **역사 경로에서 실제로 빠져나간 금액**이다. 따라서 유출 계수는
 * 역사 경로에서 항상 정확히 1.0이며, **역사와 다른 선택만** 이를 움직인다(더 나은 선택 <1, 나쁜 선택 >1).
 * 역사 옵션(`historical: true`)과 외생 진입 효과는 이 계수를 건드리지 않는다 — 그래야 체크포인트가
 * 정확히 재현된다. `imf.test.ts`가 매 턴 계수 1.0을 검증한다. 같은 이유로 금리·종금사 정지 효과는
 * **역사 기준값 대비 편차**로만 계수를 움직인다(`setPolicyRate.baselinePct`, `suspendMerchantBanks.drainFactor`).
 */

type CbDraft = Draft<GameState<CentralBankState>>

/** 현물 개입 중 스왑·차입으로 조달되어 총외환보유액에는 남는 비중 [CAL, 앵커: 61/151 ≈ 0.40]. */
export const SWAP_SHARE = 0.6
/** 개입 1억달러당 완화되는 환율 압력(%p) [CAL, 앵커: T3 62억달러 개입 ≈ 3.7%p 방어]. */
export const FX_RELIEF_PER_UNIT = 0.06
/** 하루 한도 이상으로 원화가 절상되지 않도록 하는 안전장치(전일 대비 −30%). */
const APPRECIATION_FLOOR = 0.7

function cb(d: CbDraft): Draft<CentralBankState> {
  return d.institution
}

function addCounter(d: CbDraft, key: string, v: number): void {
  d.counters[key] = (d.counters[key] ?? 0) + v
}

function setFlagOnce(d: CbDraft, key: string): void {
  if (!d.flags[key]) {
    d.flags[key] = true
    d.flagTurns[key] ??= d.turnIndex
  }
}

function ci(d: CbDraft, delta: number): void {
  d.confidence.index = clamp(d.confidence.index + delta, 0, 100)
}

function counterparties(d: CbDraft, delta: number): void {
  d.confidence.counterparties = clamp(d.confidence.counterparties + delta, 0, 100)
}

function f1(n: number): string {
  return n.toFixed(1)
}

/** `custom`은 Record<string, number>라 인덱스 접근이 optional로 좁혀진다 — 읽기는 이 헬퍼로 통일한다. */
function cnum(s: Draft<CentralBankState>, key: string, fallback = 0): number {
  return s.custom[key] ?? fallback
}

/** 대시보드 표시용 사본을 상태와 맞춘다. 모든 효과의 마지막 줄에서 호출된다. */
export function sync(d: CbDraft): void {
  const s = cb(d)
  s.custom.grossReserves = s.reserves.gross
  s.custom.reserveGap = s.reserves.gross - s.reserves.usable
  s.custom.forwardCommitments = s.reserves.forwardCommitments
  s.custom.interventionCumulative = d.counters.interventionTotal ?? 0
  d.market.fxUsdLocal = s.fx.spot
  d.market.policyRateBp = s.policy.rateBp
  d.market.ownCdsBp = s.sovereign.spreadBp
}

/** 가용보유액이 1개월 내 만기 도래 단기외채보다 적은 상태(= 오늘 방어할 돈이 내일 갚을 돈보다 적다). */
export function belowMonthlyDebt(s: Draft<CentralBankState>): boolean {
  return s.reserves.usable < cnum(s, 'stDebtDue30d')
}

export const imfFx = {
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
   * 현물환 시장 개입. 가용보유액에서만 나가며, 스왑으로 조달된 몫(60%)은 총외환보유액에 남고
   * 선물환 약정으로 쌓인다. 가용이 1개월 만기 단기외채보다 적은데도 개입하면 시장은 그것을 알아챈다
   * (ΔCI −4, 채권은행 신뢰 −5) — 이 시나리오의 함정 옵션이 기계적으로 벌을 받는 지점이다.
   */
  intervene(p: { amount: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'intervene',
      { amount: p.amount },
      (d, ctx) => {
        const s = cb(d)
        const spend = clamp(p.amount, 0, Math.max(0, s.reserves.usable))
        if (spend <= 0) {
          ctx.log('개입 불가: 가용외환보유액이 남아 있지 않다')
          sync(d)
          return
        }
        const wasBelow = belowMonthlyDebt(s)
        s.reserves.usable -= spend
        s.reserves.gross -= spend * (1 - SWAP_SHARE)
        s.reserves.forwardCommitments += spend * SWAP_SHARE
        s.fx.interventionToday += spend
        addCounter(d, 'interventionThisTurn', spend)
        addCounter(d, 'interventionTotal', spend)
        ctx.log(
          `현물환 개입 ${f1(spend)}억달러 — 가용 ${f1(s.reserves.usable)} / 총액 ${f1(s.reserves.gross)} (괴리 ${f1(s.reserves.gross - s.reserves.usable)}), 선물환 잔액 ${f1(s.reserves.forwardCommitments)}`,
        )
        if (wasBelow || belowMonthlyDebt(s)) {
          ci(d, -4)
          counterparties(d, -5)
          setFlagOnce(d, 'intervened_below_st_debt')
          addCounter(d, 'interventionsBelowStDebt', 1)
          ctx.log(
            `가용 ${f1(s.reserves.usable)} < 1개월 만기 단기외채 ${f1(cnum(s, 'stDebtDue30d'))} — 개입 사실이 알려지며 ΔCI −4, 채권은행 신뢰 −5`,
          )
        }
        if (spend < p.amount)
          d.log.push(
            `[T${d.turnIndex}] 개입 미집행 ${f1(p.amount - spend)}억달러: 가용외환보유액 소진`,
          )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 대외 유출(단기외채 순상환·무역결제·비거주자 원화자금 회수)을 턴 내 `profile`대로 배분한다.
   * 이름을 `runoffStep`으로 둔 것은 무결성 린트(`tick-profile`)가 profile 길이 = ticks를 검사하기
   * 때문이다. 틱이 없는 턴은 `profile: [1]`로 전량을 한 번에 적용한다 — 분산 0에서 슬라이스 합은
   * 정확히 `total × drainMultiplier`이므로 틱 유무가 결과를 바꾸지 않는다.
   */
  runoffStep(p: { total: number; profile: number[]; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'runoffStep',
      { total: p.total, profile: p.profile.join('/') },
      (d, ctx) => {
        const s = cb(d)
        const share = p.profile[ctx.tick] ?? (ctx.ticks === 1 ? 1 : 0)
        if (share <= 0) return
        const mult =
          d.counters.drainMultiplier && d.counters.drainMultiplier > 0
            ? d.counters.drainMultiplier
            : 1
        const noise = noiseFactor(
          ctx,
          ctx.noise?.runoffSigma ?? DEFAULT_NOISE.runoffSigma,
          ctx.noise?.runoffCap ?? DEFAULT_NOISE.runoffCap,
        )
        const slice = p.total * share * mult * noise
        s.reserves.usable -= slice
        s.reserves.gross -= slice
        addCounter(d, 'drainThisTurn', slice)
        addCounter(d, 'drainTotal', slice)
        ctx.log(
          `대외 유출 ${f1(slice)}억달러 (틱 ${ctx.tick}, 배분 ${(share * 100).toFixed(0)}% × 계수 ${mult.toFixed(2)}) — 가용 ${f1(s.reserves.usable)}`,
        )
        if (s.reserves.usable < 0)
          d.log.push(
            `[T${d.turnIndex}] 결제 부족: 가용외환보유액 ${f1(s.reserves.usable)}억달러 (대외지급 불능)`,
          )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 국내은행·종금사 해외점포에 외화를 예치해 외화 자금난을 막는다. 총외환보유액은 그대로인데
   * 가용만 줄어드는 유일한 행위이며, 1997년의 가용·총액 괴리를 만든 장본인이다.
   */
  depositAtBranches(p: {
    amount: number
    reason: string
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'depositAtBranches',
      { amount: p.amount, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        const amt = clamp(p.amount, 0, Math.max(0, s.reserves.usable))
        if (amt <= 0) {
          ctx.log('해외점포 예치 불가: 가용외환보유액이 없다')
          sync(d)
          return
        }
        s.reserves.usable -= amt
        s.bankingSystem.liquiditySupport += amt
        addCounter(d, 'branchDeposits', amt)
        setFlagOnce(d, 'branch_deposits_used')
        ctx.log(
          `해외점포 외화예치 ${f1(amt)}억달러 (${p.reason}) — 총외환보유액 ${f1(s.reserves.gross)}는 그대로, 가용 ${f1(s.reserves.usable)}, 괴리 ${f1(s.reserves.gross - s.reserves.usable)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 예치금 환류(만기연장 합의·국가보증으로 해외점포가 스스로 조달하게 되었을 때). */
  releaseBranchDeposits(p: { amount: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'releaseBranchDeposits',
      { amount: p.amount },
      (d, ctx) => {
        const s = cb(d)
        const gap = Math.max(0, s.reserves.gross - s.reserves.usable)
        const amt = clamp(p.amount, 0, gap)
        if (amt <= 0) return
        s.reserves.usable += amt
        s.bankingSystem.liquiditySupport = Math.max(0, s.bankingSystem.liquiditySupport - amt)
        addCounter(d, 'branchDepositsReleased', amt)
        ctx.log(
          `해외점포 예치금 환류 ${f1(amt)}억달러 — 가용 ${f1(s.reserves.usable)}, 괴리 ${f1(s.reserves.gross - s.reserves.usable)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** IMF·IBRD·ADB·양자 인출. 가용과 총액이 함께 늘어난다. */
  disburse(p: {
    amount: number
    source: string
    imf?: boolean
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'disburse',
      { amount: p.amount, source: p.source, imf: p.imf ?? false },
      (d, ctx) => {
        const s = cb(d)
        s.reserves.usable += p.amount
        s.reserves.gross += p.amount
        if (p.imf) {
          s.imf.disbursed += p.amount
          s.imf.stage = 'disbursed'
        }
        addCounter(d, 'externalSupportDrawn', p.amount)
        ctx.log(
          `${p.source} 인출 ${f1(p.amount)}억달러 — 가용 ${f1(s.reserves.usable)} / 총액 ${f1(s.reserves.gross)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 일일변동폭 변경. `pct: 0`은 변동폭 폐지(완전 자유변동환율)를 뜻한다. */
  setBand(p: { pct: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setBand',
      { pct: p.pct },
      (d, ctx) => {
        const s = cb(d)
        if (p.pct <= 0) {
          s.fx.regime = 'float'
          s.fx.bandPct = 0
          setFlagOnce(d, 'fx_floated')
          ctx.log('환율 일일변동폭 폐지 — 완전 자유변동환율제 이행')
        } else {
          s.fx.regime = 'managed'
          s.fx.bandPct = p.pct
          if (p.pct >= 9) setFlagOnce(d, 'band_widened')
          ctx.log(`환율 일일변동폭 ±${p.pct}%로 조정`)
        }
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 틱이 없는 턴의 환율 결정. `close`는 **역사적 개입 규모(`baseline`)를 전제로 한 그 턴의 종가**이며,
   * 플레이어가 더 쓰거나 덜 쓴 만큼만 움직인다 — 그래서 역사 경로는 체크포인트를 정확히 재현한다.
   *   target = close × (1 − (개입 − baseline) × 0.06 / 100)
   * 변동폭이 살아 있으면 전일 종가 × (1 + band)^bandDays가 상한이 되고, 상한에 걸리면 매도 주문이
   * 체결되지 않는다(거래 불성립) — 무역금융이 마비되고 롤오버율이 더 떨어진다.
   */
  fxStep(p: {
    close: number
    baseline: number
    bandDays: number
    freeFloatPremiumPct?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'fxStep',
      {
        close: p.close,
        baseline: p.baseline,
        bandDays: p.bandDays,
        freeFloatPremiumPct: p.freeFloatPremiumPct ?? 0,
      },
      (d, ctx) => {
        settleFx(d, ctx, {
          close: p.close,
          baseline: p.baseline,
          bandDays: p.bandDays,
          freeFloatPremiumPct: p.freeFloatPremiumPct ?? 0,
          anchor: cb(d).fx.spot,
        })
      },
      p.label,
    )
  },

  /**
   * 틱이 있는 턴의 마지막 틱에서 종가를 확정한다. 장중 경로는 `Turn.ticker`가 그렸고, 여기서는
   * 그 종가를 플레이어의 개입·제도 선택으로 보정한다. 변동폭 상한은 **그날의 시가**(tickerBase)를
   * 기준으로 판정한다.
   */
  fxSettle(p: {
    close: number
    baseline: number
    bandDays: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'fxSettle',
      { close: p.close, baseline: p.baseline, bandDays: p.bandDays },
      (d, ctx) => {
        const anchor = d.tickerBase['institution.fx.spot'] ?? cb(d).fx.spot
        settleFx(d, ctx, {
          close: p.close,
          baseline: p.baseline,
          bandDays: p.bandDays,
          freeFloatPremiumPct: 0,
          anchor,
        })
      },
      p.label,
    )
  },

  /**
   * 콜금리 조정. 고금리는 외화 유출을 늦추지만 실물 비용을 남긴다.
   * `baselinePct`는 그 턴의 역사적 금리 수준이며, 유출 계수는 **기준 대비 편차**로만 움직인다
   * (역사 경로 = 편차 0 = 계수 불변). 실물 비용은 절대 수준으로 누적되므로 역사 경로도 대가를 치른다.
   */
  setPolicyRate(p: { pct: number; baselinePct: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setPolicyRate',
      { pct: p.pct, baselinePct: p.baselinePct },
      (d, ctx) => {
        const s = cb(d)
        const beforePct = s.policy.rateBp / 100
        s.policy.rateBp = Math.round(p.pct * 100)
        // 기준 대비 1%p당 대외 유출 계수 −1.2%, 롤오버율 +0.4%p [CAL]
        const dev = p.pct - p.baselinePct
        if (dev !== 0) {
          d.counters.drainMultiplier = clamp(
            (d.counters.drainMultiplier ?? 1) * (1 - 0.012 * dev),
            0.4,
            2.5,
          )
          s.custom.rolloverRatePct = clamp(cnum(s, 'rolloverRatePct') + 0.4 * dev, 5, 100)
          counterparties(d, clamp(dev * 0.4, -8, 6))
        }
        addCounter(d, 'realEconomyCost', Math.max(0, p.pct - 12.5) * 0.5)
        ctx.log(
          `콜금리 ${beforePct.toFixed(1)}% → ${p.pct.toFixed(1)}% (역사 기준 ${p.baselinePct.toFixed(1)}%) — 유출 계수 ${(d.counters.drainMultiplier ?? 1).toFixed(2)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** IMF 프로그램 단계. `committed`를 주면 약정액을 설정한다. */
  imfStage(p: {
    stage: 'none' | 'requested' | 'negotiating' | 'agreed' | 'disbursed'
    committed?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'imfStage',
      { stage: p.stage, committed: p.committed ?? -1 },
      (d, ctx) => {
        const s = cb(d)
        s.imf.stage = p.stage
        if (p.committed !== undefined) s.imf.committed = p.committed
        if (p.stage === 'requested') setFlagOnce(d, 'imf_requested')
        if (p.stage === 'agreed') setFlagOnce(d, 'imf_agreed')
        ctx.log(
          `IMF 프로그램 단계: ${p.stage}${p.committed !== undefined ? ` (약정 ${f1(p.committed)}억달러)` : ''}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 종금사 업무정지. 부실을 끊어 내면 나머지 종금사의 외화 유출 계수가 내려가지만, 정지 자체가
   * 단기적으로는 해외 채권은행의 롤오버 거부를 부른다 — 정지가 늦을수록 후자가 커진다.
   */
  suspendMerchantBanks(p: {
    count: number
    rolloverShockPct: number
    drainFactor: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'suspendMerchantBanks',
      { count: p.count, rolloverShockPct: p.rolloverShockPct, drainFactor: p.drainFactor },
      (d, ctx) => {
        const s = cb(d)
        s.bankingSystem.failedBanks += p.count
        s.bankingSystem.distressedBanks = Math.max(0, s.bankingSystem.distressedBanks - p.count)
        s.custom.rolloverRatePct = clamp(cnum(s, 'rolloverRatePct') - p.rolloverShockPct, 5, 100)
        d.counters.drainMultiplier = clamp(
          (d.counters.drainMultiplier ?? 1) * p.drainFactor,
          0.4,
          2.5,
        )
        addCounter(d, 'suspendedMerchantBanks', p.count)
        setFlagOnce(d, 'merchant_banks_suspended')
        ctx.log(
          `종합금융회사 ${p.count}개사 업무정지 — 누계 ${s.bankingSystem.failedBanks}개, 롤오버율 ${cnum(s, 'rolloverRatePct').toFixed(0)}%, 유출 계수 ${(d.counters.drainMultiplier ?? 1).toFixed(2)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 종금사 외화 유동성 지원. `viaBranches`면 해외점포 예치(가용만 감소), 아니면 직접 인출. */
  supportMerchantBanks(p: {
    amount: number
    viaBranches: boolean
    drainFactor: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'supportMerchantBanks',
      { amount: p.amount, viaBranches: p.viaBranches, drainFactor: p.drainFactor },
      (d, ctx) => {
        const s = cb(d)
        const amt = clamp(p.amount, 0, Math.max(0, s.reserves.usable))
        s.reserves.usable -= amt
        if (!p.viaBranches) s.reserves.gross -= amt
        s.bankingSystem.liquiditySupport += amt
        s.custom.merchantBankFxDebt = Math.max(0, cnum(s, 'merchantBankFxDebt') - amt * 0.5)
        d.counters.drainMultiplier = clamp(
          (d.counters.drainMultiplier ?? 1) * p.drainFactor,
          0.4,
          2.5,
        )
        addCounter(d, 'merchantBankSupport', amt)
        if (p.viaBranches) setFlagOnce(d, 'branch_deposits_used')
        ctx.log(
          `종금사 외화 지원 ${f1(amt)}억달러 (${p.viaBranches ? '해외점포 예치 — 총액 불변, 가용만 감소' : '직접 지원 — 총액·가용 동시 감소'}) — 가용 ${f1(s.reserves.usable)}, 괴리 ${f1(s.reserves.gross - s.reserves.usable)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 단기외채 롤오버율과 1개월 만기 도래액을 외생적으로 갱신한다(턴 진입 효과). */
  setExternalStress(p: {
    rolloverPct?: number
    dueThisMonth?: number
    shortTermDebt?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setExternalStress',
      {
        rolloverPct: p.rolloverPct ?? -1,
        dueThisMonth: p.dueThisMonth ?? -1,
        shortTermDebt: p.shortTermDebt ?? -1,
      },
      (d, ctx) => {
        const s = cb(d)
        // 턴별 기준 롤오버율에 누적 정책 보너스(`rolloverBonus`)를 더한다 — 역사 경로에서는 보너스 0.
        if (p.rolloverPct !== undefined)
          s.custom.rolloverRatePct = clamp(p.rolloverPct + (d.counters.rolloverBonus ?? 0), 5, 100)
        if (p.dueThisMonth !== undefined) s.custom.stDebtDue30d = Math.max(0, p.dueThisMonth)
        if (p.shortTermDebt !== undefined) s.external.shortTermDebt = Math.max(1, p.shortTermDebt)
        ctx.log(
          `단기외채: 1개월 만기 ${f1(cnum(s, 'stDebtDue30d'))}억달러, 롤오버율 ${cnum(s, 'rolloverRatePct').toFixed(0)}%, 잔액 ${f1(s.external.shortTermDebt)}억달러`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 국가신용등급 조치. 보정 규칙 §6.8: 1노치 ΔCI −5, 다노치·정크 −15. */
  ratingAction(p: {
    to: string
    notches: number
    junk?: boolean
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'ratingAction',
      { to: p.to, notches: p.notches, junk: p.junk ?? false },
      (d, ctx) => {
        const s = cb(d)
        const before = s.sovereign.rating
        s.sovereign.rating = p.to
        s.sovereign.spreadBp += p.notches * 90 + (p.junk ? 250 : 0)
        ci(d, p.notches > 1 || p.junk ? -10 : -5)
        counterparties(d, p.junk ? -12 : -5)
        if (p.junk) {
          setFlagOnce(d, 'junk_rating')
          // 투자부적격 강등은 투자적격 채권만 보유할 수 있는 해외 투자자의 강제 매도를 부른다.
          s.custom.rolloverRatePct = clamp(cnum(s, 'rolloverRatePct') - 8, 5, 100)
        }
        ctx.log(
          `국가신용등급 ${before} → ${p.to} (${p.notches}노치${p.junk ? ', 투자부적격' : ''}) — 가산금리 ${s.sovereign.spreadBp}bp`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 단기외채 만기연장 합의. 롤오버가 회복되고 예치금이 환류하며 단기외채가 중장기로 전환된다.
   *
   * `pledgeCounter`를 주면 **협상에서 약속한 보증 규모**(대화의 `commitReplies`가 쓴 카운터)에
   * 비례해 전환액·환류액·신뢰 회복이 결정된다. 카운터가 없으면 `amount` 전액을 약속한 것으로 본다
   * (대화를 건너뛴 경우 = 역사적 합의). 역사 경로는 240억달러를 약속하므로 비율 1.0이다.
   */
  rolloverAgreement(p: {
    amount: number
    converted: number
    releaseBranches: number
    pledgeCounter?: string
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'rolloverAgreement',
      {
        amount: p.amount,
        converted: p.converted,
        releaseBranches: p.releaseBranches,
        pledgeCounter: p.pledgeCounter ?? '',
      },
      (d, ctx) => {
        const s = cb(d)
        const pledge = p.pledgeCounter ? (d.counters[p.pledgeCounter] ?? p.amount) : p.amount
        const ratio = clamp(pledge / Math.max(1, p.amount), 0, 1)
        const converted = p.converted * ratio
        s.custom.rolloverRatePct = clamp(40 + 60 * ratio, 5, 100)
        s.custom.stDebtDue30d = Math.max(5, cnum(s, 'stDebtDue30d') - p.amount * 0.5 * ratio)
        s.external.shortTermDebt = Math.max(1, s.external.shortTermDebt - converted)
        d.counters.drainMultiplier = clamp(
          (d.counters.drainMultiplier ?? 1) * (1 - 0.65 * ratio),
          0.2,
          2.5,
        )
        const gap = Math.max(0, s.reserves.gross - s.reserves.usable)
        const released = clamp(p.releaseBranches * ratio, 0, gap)
        s.reserves.usable += released
        s.bankingSystem.liquiditySupport = Math.max(0, s.bankingSystem.liquiditySupport - released)
        ci(d, 12 * ratio)
        counterparties(d, 25 * ratio)
        if (ratio >= 0.999) setFlagOnce(d, 'rollover_agreed')
        addCounter(d, 'rolloverConverted', converted)
        ctx.log(
          `단기외채 ${f1(p.amount)}억달러 만기연장 합의 — 약속한 보증 ${f1(pledge)}억달러(비율 ${(ratio * 100).toFixed(0)}%), 정부보증 전환 ${f1(converted)}억달러, 예치금 환류 ${f1(released)}, 가용 ${f1(s.reserves.usable)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 표시용 시장 지표 이동(주가·가산금리·조달 스트레스). 엔진 계산에는 쓰이지 않는다. */
  marketMove(p: {
    equityPct?: number
    spreadBp?: number
    fundingStressBp?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'marketMove',
      {
        equityPct: p.equityPct ?? 0,
        spreadBp: p.spreadBp ?? 0,
        fundingStressBp: p.fundingStressBp ?? 0,
      },
      (d) => {
        if (p.equityPct)
          d.market.equityIndex = Math.max(50, d.market.equityIndex * (1 + p.equityPct / 100))
        if (p.spreadBp)
          cb(d).sovereign.spreadBp = Math.max(10, cb(d).sovereign.spreadBp + p.spreadBp)
        if (p.fundingStressBp)
          d.market.fundingStressBp = Math.max(0, d.market.fundingStressBp + p.fundingStressBp)
        sync(d)
      },
      p.label,
    )
  },

  /** 대외 유출 계수를 직접 조정한다(정책 패키지·커뮤니케이션의 2차 효과). */
  adjustDrain(p: { factor: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'adjustDrain',
      { factor: p.factor, reason: p.reason },
      (d, ctx) => {
        d.counters.drainMultiplier = clamp((d.counters.drainMultiplier ?? 1) * p.factor, 0.4, 2.5)
        ctx.log(
          `대외 유출 계수 ×${p.factor.toFixed(2)} (${p.reason}) → ${(d.counters.drainMultiplier ?? 1).toFixed(2)}`,
        )
      },
      p.label,
    )
  },

  /**
   * 롤오버율을 움직인다(채권은행 커뮤니케이션·공시의 효과). 보너스는 누적되어 이후 턴의 기준
   * 롤오버율에도 더해진다. 역사 경로의 옵션은 이 효과를 쓰지 않는다(역사 기준값이 곧 baseline이므로).
   */
  adjustRollover(p: {
    deltaPct: number
    reason: string
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'adjustRollover',
      { deltaPct: p.deltaPct, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        d.counters.rolloverBonus = (d.counters.rolloverBonus ?? 0) + p.deltaPct
        s.custom.rolloverRatePct = clamp(cnum(s, 'rolloverRatePct') + p.deltaPct, 5, 100)
        ctx.log(
          `롤오버율 ${p.deltaPct > 0 ? '+' : ''}${p.deltaPct}%p (${p.reason}) → ${cnum(s, 'rolloverRatePct').toFixed(0)}%`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 대외지급 정지(모라토리엄) 선언. 게임오버 규칙 `moratorium`을 발동시킨다. */
  declareMoratorium(label?: string): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'declareMoratorium',
      {},
      (d, ctx) => {
        setFlagOnce(d, 'moratorium_declared')
        ci(d, -40)
        counterparties(d, -50)
        cb(d).sovereign.spreadBp += 2000
        cb(d).sovereign.rating = 'SD'
        ctx.log('대외지급 정지 선언 — 국가신용등급 선택적 디폴트')
        sync(d)
      },
      label,
    )
  },
}

/** fxStep / fxSettle의 공통 몸통. `anchor`는 변동폭 상한을 재는 기준(전일 종가 또는 당일 시가). */
function settleFx(
  d: CbDraft,
  ctx: EffectContext,
  p: {
    close: number
    baseline: number
    bandDays: number
    freeFloatPremiumPct: number
    anchor: number
  },
): void {
  const s = cb(d)
  const spent = d.counters.interventionThisTurn ?? 0
  const relief = (spent - p.baseline) * FX_RELIEF_PER_UNIT
  let target = p.close * (1 - relief / 100)
  if (s.fx.regime === 'float' && p.freeFloatPremiumPct > 0) {
    target *= 1 + p.freeFloatPremiumPct / 100
  }
  if (s.fx.regime !== 'float' && (s.fx.bandPct ?? 0) > 0 && p.bandDays > 0) {
    const cap = p.anchor * Math.pow(1 + (s.fx.bandPct ?? 0) / 100, p.bandDays)
    if (target > cap) {
      const unfilled = ((target - cap) / p.anchor) * 100
      target = cap
      d.counters.bandLockedDays = (d.counters.bandLockedDays ?? 0) + p.bandDays
      d.counters.unfilledFxDemandPct = (d.counters.unfilledFxDemandPct ?? 0) + unfilled
      s.custom.rolloverRatePct = clamp(cnum(s, 'rolloverRatePct') - 5, 5, 100)
      d.counters.drainMultiplier = clamp((d.counters.drainMultiplier ?? 1) * 1.12, 0.4, 2.5)
      ci(d, -3)
      counterparties(d, -4)
      if (!d.flags.band_locked) {
        d.flags.band_locked = true
        d.flagTurns.band_locked ??= d.turnIndex
      }
      ctx.log(
        `일일변동폭 상한 도달 — ${p.bandDays}영업일 거래 불성립, 미체결 달러 수요 ${unfilled.toFixed(1)}%. 무역금융이 막히고 롤오버율이 5%p 더 내려간다`,
      )
    }
  }
  target = Math.max(target, p.anchor * APPRECIATION_FLOOR)
  const before = s.fx.spot
  s.fx.spot = target
  s.fx.interventionToday = 0
  d.counters.interventionThisTurn = 0
  d.counters.drainThisTurn = 0
  ctx.log(
    `원/달러 ${before.toFixed(1)} → ${target.toFixed(1)} (개입 ${f1(spent)}억달러, 기준 개입 ${f1(p.baseline)}억달러)`,
  )
  sync(d)
}
