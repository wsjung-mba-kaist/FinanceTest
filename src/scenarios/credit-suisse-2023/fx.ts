import type { Draft } from 'immer'
import type { CentralBankState, Effect, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../../engine/core/noise'
import { fnEffect } from '../../engine/fx/common'

/**
 * credit-suisse-2023 전용 효과 빌더.
 *
 * 엔진에는 공유 `central_bank` fx 모듈이 없다. 그래서 mg-run-2023/fx.ts,
 * uk-ldi-2022/ldiFx.ts, korea-imf-1997/fx.ts와 같은 방식으로 시나리오 안에 둔다.
 * 산식·앵커·계수는 전부 calibration.md에 표로 남겼다.
 *
 * ── 이 시나리오의 회계 규약 (전부 여기 적는다) ──
 *  · `custom.csLiquidity`  크레디트스위스가 **오늘 결제에 쓸 수 있는** 유동성. 음수가 되면 지급불능이다.
 *  · `custom.supportDrawn` SNB가 실제로 내준 돈의 누계(= bankingSystem.liquiditySupport).
 *  · `reserves.usable`     당국이 **지금 내줄 수 있는** 여력. ELA는 적격담보가 있어야 나가고,
 *                          ELA+·PLB는 긴급명령이 있어야 나간다.
 *  · `reserves.gross`      법적으로 동원 가능한 총한도. 긴급명령이 50 → 250으로 올린다.
 *  · `reserves.forwardCommitments` 연방정부가 떠안은 보증 노출(= custom.federalGuarantee).
 *
 *  네 가지 움직임이 이것들을 서로 다르게 건드린다.
 *    runoffStep        csLiquidity −X, csDeposits −X                 (고객이 실제로 빼 간 돈)
 *    pressureDrain     csLiquidity −X                                 (담보 추가 요구·한도 축소·선납)
 *    provideLiquidity  csLiquidity +X, supportDrawn +X, usable −X     (ELA·LSFF·ELA+·PLB)
 *    lossGuarantee     forwardCommitments +X                          (돈은 나가지 않고 위험만 옮겨 간다)
 *
 * ── 유출 계수(`counters.drainMultiplier`)의 규약 ──
 * 각 턴의 `runoffStep({ total })`은 **FINMA 보고서가 적은 그날의 실제 유출액**이다. 따라서 유출 계수는
 * 역사 경로에서 항상 정확히 1.0이며, **역사와 다른 선택만** 이를 움직인다(더 나은 선택 <1, 나쁜 선택 >1).
 * 역사 옵션(`historical: true`)과 외생 진입 효과는 이 계수를 건드리지 않는다 — 그래야 체크포인트가
 * 정확히 재현된다. `cs.test.ts`가 매 턴 계수 1.0을 검증한다.
 */

type CbDraft = Draft<GameState<CentralBankState>>

/** 긴급명령 제정 시 열리는 한도: ELA+ 1,000억 + PLB 1,000억 [plb-eo-2023-135, snb-pr-2023-03-19]. */
export const ELA_PLUS_CAP = 100
export const PLB_CAP = 100

/** 지원 창구. `ela`·`lsff`는 통상법, `elaPlus`·`plb`는 긴급명령이 있어야 열린다. */
export type Facility = 'ela' | 'lsff' | 'elaPlus' | 'plb'

const FACILITY_LABEL: Record<Facility, string> = {
  ela: '긴급유동성지원(ELA)',
  lsff: '유동성부족자금조달창구(LSFF)',
  elaPlus: '추가 유동성지원대출(ELA+)',
  plb: '공적유동성백스톱(PLB)',
}

function cb(d: CbDraft): Draft<CentralBankState> {
  return d.institution
}

function cnum(s: Draft<CentralBankState>, key: string, fallback = 0): number {
  return s.custom[key] ?? fallback
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

function investors(d: CbDraft, delta: number): void {
  d.confidence.investors = clamp(d.confidence.investors + delta, 0, 100)
}

function counterparties(d: CbDraft, delta: number): void {
  d.confidence.counterparties = clamp(d.confidence.counterparties + delta, 0, 100)
}

function f1(n: number): string {
  return n.toFixed(1)
}

/** 대시보드 표시용 사본을 상태와 맞춘다. 모든 효과의 마지막 줄에서 호출된다. */
export function sync(d: CbDraft): void {
  const s = cb(d)
  s.custom.supportDrawn = s.bankingSystem.liquiditySupport
  s.custom.federalGuarantee = s.reserves.forwardCommitments
  d.market.fxUsdLocal = s.fx.spot
  d.market.policyRateBp = s.policy.rateBp
  // 보증을 떠안을수록 연방정부 자신의 신용 스프레드가 조금씩 벌어진다 [CAL].
  s.sovereign.spreadBp = 15 + Math.round(s.reserves.forwardCommitments * 0.05)
}

export const csFx = {
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
   * 그날의 고객자금 유출을 턴 내 `profile`대로 배분한다. 이름을 `runoffStep`으로 둔 것은 무결성
   * 린트(`tick-profile`)가 profile 길이 = ticks를 검사하기 때문이다. 틱이 없는 턴은 `profile: [1]`로
   * 전량을 한 번에 적용한다 — 분산 0에서 슬라이스 합은 정확히 `total × drainMultiplier`이므로
   * 틱 유무가 결과를 바꾸지 않는다(`cs.test.ts`의 '틱 합계 = 단일 호출' 검증).
   */
  runoffStep(p: { total: number; profile: number[]; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'runoffStep',
      { total: p.total, profile: p.profile.join('/') },
      (d, ctx) => {
        const s = cb(d)
        if (ctx.tick === 0) s.custom.dailyOutflow = 0
        const share = p.profile[ctx.tick] ?? (ctx.ticks === 1 ? 1 : 0)
        if (share <= 0) {
          sync(d)
          return
        }
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
        s.custom.csLiquidity = cnum(s, 'csLiquidity') - slice
        s.custom.csDeposits = Math.max(0, cnum(s, 'csDeposits') - slice)
        s.external.shortTermDebt = Math.max(1, s.external.shortTermDebt - slice)
        s.custom.dailyOutflow = cnum(s, 'dailyOutflow') + slice
        s.custom.cumulativeOutflow = cnum(s, 'cumulativeOutflow') + slice
        addCounter(d, 'cumulativeOutflow', slice)
        ctx.log(
          `고객자금 유출 ${f1(slice)}십억 프랑 (틱 ${ctx.tick}, 배분 ${(share * 100).toFixed(0)}% × 계수 ${mult.toFixed(2)}) — CS 가용 유동성 ${f1(cnum(s, 'csLiquidity'))}`,
        )
        if (cnum(s, 'csLiquidity') < 0)
          d.log.push(
            `[T${d.turnIndex}] 결제 부족: CS 가용 유동성 ${f1(cnum(s, 'csLiquidity'))}십억 프랑`,
          )
        sync(d)
      },
      p.label,
    )
  },

  /** 그날의 고객자금 유출을 0으로 되돌린다(주말처럼 창구가 없는 턴의 entryEffects에 둔다). */
  resetDailyOutflow(label?: string): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'resetDailyOutflow',
      {},
      (d) => {
        cb(d).custom.dailyOutflow = 0
        sync(d)
      },
      label ?? '창구 없음 — 당일 유출 0',
    )
  },

  /**
   * 예금 유출이 아닌 유동성 소모: 거래상대방의 추가 담보 요구, 한도 축소, 결제·청산기관의 선납 요구,
   * 코레스은행 해지. FINMA 보고서는 이것들을 유출과 나란히 "유동성 상황 악화"의 원인으로 적는다.
   */
  pressureDrain(p: { amount: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'pressureDrain',
      { amount: p.amount, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        s.custom.csLiquidity = cnum(s, 'csLiquidity') - p.amount
        addCounter(d, 'pressureDrainTotal', p.amount)
        counterparties(d, -2)
        ctx.log(
          `담보·한도 소요 ${f1(p.amount)}십억 프랑 (${p.reason}) — CS 가용 유동성 ${f1(cnum(s, 'csLiquidity'))}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 유동성 지원 공여. `ela`·`lsff`는 적격담보 여력(`reserves.usable`) 안에서만 나가고,
   * `elaPlus`·`plb`는 긴급명령(`flags.emergency_ordinance`) 없이는 한 푼도 나가지 않는다.
   * 연방정부 보증 노출은 여기서 세지 않는다 — 보증은 **약정액**으로 `lossGuarantee`가 따로 기록한다
   * (실제로도 재정대표단이 승인한 것은 인출액이 아니라 약정 신용 1,090억 프랑이다).
   */
  provideLiquidity(p: {
    amount: number
    facility: Facility
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'provideLiquidity',
      { amount: p.amount, facility: p.facility },
      (d, ctx) => {
        const s = cb(d)
        const emergency = p.facility === 'elaPlus' || p.facility === 'plb'
        if (emergency && !d.flags.emergency_ordinance) {
          ctx.log(
            `${FACILITY_LABEL[p.facility]} 공여 불가: 긴급명령이 없다 — 통상법에는 이 창구가 없다`,
          )
          setFlagOnce(d, 'support_blocked_no_ordinance')
          sync(d)
          return
        }
        const given = clamp(p.amount, 0, Math.max(0, s.reserves.usable))
        if (given <= 0) {
          ctx.log(`${FACILITY_LABEL[p.facility]} 공여 불가: 담보로 뒷받침되는 여력이 없다`)
          sync(d)
          return
        }
        s.reserves.usable -= given
        s.bankingSystem.liquiditySupport += given
        s.custom.csLiquidity = cnum(s, 'csLiquidity') + given
        addCounter(d, 'supportProvided', given)
        if (emergency) setFlagOnce(d, 'emergency_support_granted')
        ctx.log(
          `${FACILITY_LABEL[p.facility]} ${f1(given)}십억 프랑 공여 — 누계 ${f1(s.bankingSystem.liquiditySupport)}, 남은 공여 여력 ${f1(s.reserves.usable)}, CS 가용 유동성 ${f1(cnum(s, 'csLiquidity'))}`,
        )
        if (given < p.amount)
          d.log.push(
            `[T${d.turnIndex}] 공여 미집행 ${f1(p.amount - given)}십억 프랑: 공여 여력 소진`,
          )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 연방헌법 제184조 제3항·제185조 제3항에 근거한 긴급명령 제정. ELA+와 PLB를 창설하고 두 수단에
   * 파산 시 우선변제권을 붙인다. 이것이 없으면 3월 17일 이후의 어떤 지원도 법적으로 불가능하다.
   */
  enactOrdinance(p?: { label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'enactOrdinance',
      { elaPlusCap: ELA_PLUS_CAP, plbCap: PLB_CAP },
      (d, ctx) => {
        const s = cb(d)
        if (d.flags.emergency_ordinance) {
          sync(d)
          return
        }
        setFlagOnce(d, 'emergency_ordinance')
        s.reserves.gross += ELA_PLUS_CAP + PLB_CAP
        s.reserves.usable += ELA_PLUS_CAP + PLB_CAP
        ctx.log(
          `긴급명령 제정 — ELA+ ${ELA_PLUS_CAP} + PLB ${PLB_CAP}십억 프랑 창설, 총한도 ${f1(s.reserves.gross)}, 즉시 공여 여력 ${f1(s.reserves.usable)}`,
        )
        sync(d)
      },
      p?.label,
    )
  },

  /** ELA 적격담보 사전 배치. 담보가 SNB 계좌에 미리 가 있어야 그날 안에 돈이 나간다. */
  prePositionCollateral(p: { amount: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'prePositionCollateral',
      { amount: p.amount },
      (d, ctx) => {
        const s = cb(d)
        s.reserves.usable = Math.max(0, s.reserves.usable + p.amount)
        ctx.log(
          `적격담보 사전 배치 ${p.amount >= 0 ? '+' : ''}${f1(p.amount)}십억 프랑 — 즉시 공여 여력 ${f1(s.reserves.usable)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * AT1 상각. 계약상 존립사유(viability event) 조항과 긴급명령 제5a조가 근거다.
   * `explained`가 거짓이면 시장은 "주주는 대가를 받는데 AT1은 0"이라는 사실만 보고, 유럽 AT1 시장
   * 전체가 다시 가격을 매긴다 — `counters.at1MarketDamage`가 그 비용을 담는다.
   */
  at1Writedown(p: {
    amount: number
    explained: boolean
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'at1Writedown',
      { amount: p.amount, explained: p.explained },
      (d, ctx) => {
        const s = cb(d)
        const amount = clamp(p.amount, 0, cnum(s, 'csAt1Nominal'))
        s.custom.at1WrittenOff = amount
        s.custom.csAt1Nominal = cnum(s, 'csAt1Nominal') - amount
        // 상각분은 그대로 보통주자본으로 전환된다(FINMA 2023-03-19: "thus an increase in core capital").
        // 분모 250은 CS의 2022년 말 위험가중자산 약 2,505억 프랑이다 [VERIFY, facts.ts 참조].
        s.custom.csCet1Pct = cnum(s, 'csCet1Pct') + (amount / 250) * 100
        setFlagOnce(d, 'at1_written_off')
        const damage = p.explained ? amount * 0.35 : amount
        addCounter(d, 'at1MarketDamage', damage)
        investors(d, p.explained ? -6 : -14)
        ci(d, p.explained ? -2 : -6)
        if (p.explained) setFlagOnce(d, 'at1_explained')
        ctx.log(
          `AT1 ${f1(amount)}십억 프랑 상각 (${p.explained ? '계약 근거·긴급명령 조항·예외성 동시 공표' : '설명 없이 결과만 공표'}) — 시장 충격 계수 ${f1(damage)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /** 주주에게 지급되는 대가를 설정한다(합병 대가 또는 0). */
  setConsideration(p: { amount: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'setConsideration',
      { amount: p.amount },
      (d, ctx) => {
        cb(d).custom.shareholderConsideration = p.amount
        ctx.log(`주주 대가 ${f1(p.amount)}십억 프랑`)
        sync(d)
      },
      p.label,
    )
  },

  /** 연방정부 보증(PLB 이행보증·손실보전 보증). 돈은 나가지 않고 위험만 납세자에게 옮겨 간다. */
  lossGuarantee(p: { amount: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'lossGuarantee',
      { amount: p.amount, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        s.reserves.forwardCommitments += p.amount
        ctx.log(
          `연방정부 보증 +${f1(p.amount)}십억 프랑 (${p.reason}) — 보증 노출 누계 ${f1(s.reserves.forwardCommitments)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 협상 대화에서 약속한 손실보전 보증 규모(카운터)를 그대로 보증 노출로 옮긴다.
   * 대화를 건너뛰면 카운터의 초기값(역사 기준 90억 프랑)이 쓰이므로 역사 경로가 그대로 재현된다.
   */
  lossGuaranteeFromCounter(p: {
    counter: string
    fallback: number
    reason: string
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'lossGuaranteeFromCounter',
      { counter: p.counter, fallback: p.fallback, reason: p.reason },
      (d, ctx) => {
        const s = cb(d)
        const amount = d.counters[p.counter] ?? p.fallback
        s.reserves.forwardCommitments += amount
        ctx.log(
          `손실보전 보증 +${f1(amount)}십억 프랑 (${p.reason}, 협상에서 약속한 금액) — 보증 노출 누계 ${f1(s.reserves.forwardCommitments)}`,
        )
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 주말의 최종 선택. 다섯 갈래는 FINMA 2023.12 보고서 §5.5가 실제로 준비했던 선택지다
   * (합병·정리·국유화·파산 + 유동성만으로 독립 유지).
   */
  chooseRoute(p: {
    route: 'merger' | 'resolution' | 'nationalisation' | 'bankruptcy' | 'standalone'
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'chooseRoute',
      { route: p.route },
      (d, ctx) => {
        const s = cb(d)
        setFlagOnce(d, `route_${p.route}`)
        d.regulator.level = 4
        switch (p.route) {
          case 'merger':
            s.bankingSystem.distressedBanks = 0
            counterparties(d, 18)
            ci(d, 12)
            ctx.log('경로: UBS에 의한 흡수합병 — 민간 해법, 주주총회 없이 FINMA 승인으로 성립')
            break
          case 'resolution':
            s.bankingSystem.distressedBanks = 0
            s.bankingSystem.failedBanks += 1
            // 정리계획의 자본조치: 주식 전액 상각 + AT1 전액 상각 + 베일인 채권 주식 전환 ≈ 730억 프랑
            s.custom.csCet1Pct = cnum(s, 'csCet1Pct') + 20
            addCounter(d, 'bailInCapital', 73)
            counterparties(d, 6)
            ci(d, 4)
            ctx.log(
              '경로: FINMA 명령에 의한 정리(restructuring) — 주식 전액 상각, AT1 전액 상각, 베일인 채권 주식 전환, 자본 약 730억 프랑 증가',
            )
            break
          case 'nationalisation':
            s.bankingSystem.distressedBanks = 0
            ci(d, 6)
            counterparties(d, 10)
            ctx.log('경로: 연방정부 국유화 — 연방이 단독 주주가 되고 모든 위험을 떠안는다')
            break
          case 'bankruptcy':
            s.bankingSystem.distressedBanks = 0
            s.bankingSystem.failedBanks += 1
            setFlagOnce(d, 'disorderly_bankruptcy')
            ci(d, -30)
            counterparties(d, -35)
            ctx.log('경로: CS 그룹 파산 + 스위스 긴급계획 발동')
            break
          case 'standalone':
            ci(d, -18)
            counterparties(d, -20)
            d.counters.drainMultiplier = clamp((d.counters.drainMultiplier ?? 1) * 1.6, 0.3, 3)
            ctx.log('경로: 유동성만 더 넣고 독립 유지 — 구조적 해법 없음')
            break
        }
        sync(d)
      },
      p.label,
    )
  },

  /**
   * 주말에 확정된 유동성 약정 규모를 기록한다. `flagKey`가 서 있으면 `flagAmount`를 쓴다
   * (협상에서 연방 이행보증부 백스톱까지 열었는지 여부로 갈린다). 대화를 건너뛰어 기본 옵션이
   * 확정된 경우에는 `amount`가 쓰이므로, 약정 없이 발표만 한 경우와 구분된다.
   */
  commitFacility(p: {
    amount: number
    flagKey?: string
    flagAmount?: number
    label?: string
  }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'commitFacility',
      { amount: p.amount, flagKey: p.flagKey ?? '', flagAmount: p.flagAmount ?? p.amount },
      (d, ctx) => {
        const boosted = p.flagKey ? Boolean(d.flags[p.flagKey]) : false
        const value = boosted ? (p.flagAmount ?? p.amount) : p.amount
        d.counters.committedFacility = value
        ctx.log(`유동성 약정 확정 ${f1(value)}십억 프랑`)
      },
      p.label,
    )
  },

  /**
   * 월요일 개장 점검. CS 재무부가 추정한 "문제 없이 한 주를 시작하기 위해 필요한 현금"과
   * 실제로 **약정된** 유동성을 비교한다(FINMA 2023.12: 약 1,000억 프랑, 여러 통화).
   * 약정은 담보·법적 근거가 뒷받침하는 범위(`reserves.usable`)를 넘지 못한다 — 긴급명령 없이
   * 약정만 발표한 경우가 여기서 걸린다.
   */
  mondayOpen(p: { requirement: number; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'mondayOpen',
      { requirement: p.requirement },
      (d, ctx) => {
        const s = cb(d)
        s.custom.mondayCashRequirement = p.requirement
        const committed = Math.min(
          d.counters.committedFacility ?? 0,
          Math.max(0, s.reserves.usable),
        )
        const available = cnum(s, 'csLiquidity') + committed
        if (available >= p.requirement) {
          setFlagOnce(d, 'monday_open_met')
          ctx.log(
            `월요일 개장 요건 충족: 가용 ${f1(available)} ≥ 필요 ${f1(p.requirement)}십억 프랑`,
          )
        } else {
          setFlagOnce(d, 'monday_open_short')
          const gap = p.requirement - available
          addCounter(d, 'mondayShortfall', gap)
          ci(d, -12)
          counterparties(d, -15)
          d.counters.drainMultiplier = clamp((d.counters.drainMultiplier ?? 1) * 1.5, 0.3, 3)
          ctx.log(
            `월요일 개장 요건 미달: 가용 ${f1(available)} < 필요 ${f1(p.requirement)}십억 프랑 (부족 ${f1(gap)})`,
          )
        }
        sync(d)
      },
      p.label,
    )
  },

  /** CDS 수준을 절대값으로 옮긴다. 표시 경로(`market.ownCdsBp`)와 지표 사본을 함께 맞춘다. */
  cdsMove(p: { to: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'cdsMove',
      { to: p.to, reason: p.reason },
      (d, ctx) => {
        const before = d.market.ownCdsBp
        d.market.ownCdsBp = Math.max(10, p.to)
        cb(d).custom.csCdsBp = d.market.ownCdsBp
        ctx.log(`CS 5년 CDS ${before.toFixed(0)} → ${d.market.ownCdsBp.toFixed(0)}bp (${p.reason})`)
        sync(d)
      },
      p.label,
    )
  },

  /** 자사(크레디트스위스) 주가지수를 비율로 옮긴다. 2023-03-13 종가 = 100. */
  equityMove(p: { pct: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'equityMove',
      { pct: p.pct, reason: p.reason },
      (d, ctx) => {
        const before = d.market.ownStock
        d.market.ownStock = Math.max(0.5, before * (1 + p.pct))
        ctx.log(
          `CS 주가지수 ${before.toFixed(1)} → ${d.market.ownStock.toFixed(1)} (${(p.pct * 100).toFixed(1)}%, ${p.reason})`,
        )
      },
      p.label,
    )
  },

  /** 유출 계수를 직접 조정한다(커뮤니케이션·조건 부과·낙인의 2차 효과). */
  adjustDrain(p: { factor: number; reason: string; label?: string }): Effect<CentralBankState> {
    return fnEffect<CentralBankState>(
      'adjustDrain',
      { factor: p.factor, reason: p.reason },
      (d, ctx) => {
        d.counters.drainMultiplier = clamp((d.counters.drainMultiplier ?? 1) * p.factor, 0.3, 3)
        ctx.log(
          `유출 계수 ×${p.factor.toFixed(2)} (${p.reason}) → ${(d.counters.drainMultiplier ?? 1).toFixed(2)}`,
        )
      },
      p.label,
    )
  },
}
