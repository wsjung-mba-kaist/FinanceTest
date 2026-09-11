import type { Draft } from 'immer'
import type { Effect, GameState, SecuritiesState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../../engine/core/noise'
import { fnEffect } from '../../engine/fx/common'

/**
 * legoland-2022 전용 효과 빌더. `securitiesFx`에 없는 동작(CP·콜 롤오프, 결제일 점검, 만기연장 협상,
 * 만기 사다리 분산, 익스포저 공시, 콜옵션 처리)을 시나리오 로컬로 정의한다. 단위 억원.
 * 보정 근거: src/scenarios/legoland-2022/calibration.md
 */
type D = Draft<GameState<SecuritiesState>>
const sec = (d: D): Draft<SecuritiesState> => d.institution

/** CP 재발행률(신뢰지수 구간별). calibration.md §3 — 도매 무담보 조달은 런 상태에서 롤오프. */
export function cpRollFraction(ci: number, closed: boolean): number {
  if (closed) return 0
  if (ci >= 60) return 1
  if (ci >= 50) return 0.8
  if (ci >= 40) return 0.5
  if (ci >= 30) return 0.25
  return 0
}

export const legoFx = {
  /** 이번 턴 만기 CP(잔액 × share)의 미재발행분이 현금에서 빠져나간다. */
  cpRollStep(p: { share: number; label?: string }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'cpRollStep',
      { share: p.share },
      (d, ctx) => {
        const s = sec(d)
        const matured = s.funding.cp * p.share
        const closed = (d.counters.cpClosedUntil ?? -1) >= d.turnIndex
        const roll = cpRollFraction(d.confidence.index, closed)
        const shortfall = matured * (1 - roll)
        s.funding.cp -= shortfall
        s.liquidity.cash -= shortfall
        d.counters.cpRunoff = (d.counters.cpRunoff ?? 0) + shortfall
        ctx.log(
          `CP 만기 ${matured.toFixed(0)} 중 재발행 ${(roll * 100).toFixed(0)}%${closed ? ' (시장 폐쇄)' : ''} → 순상환 ${shortfall.toFixed(0)}`,
        )
      },
      p.label,
    )
  },

  /**
   * `cpRollStep`의 **틱 분할판**. 발행·상환이 하루 안에서 언제 확정되는지를 `profile`(합 = 1)로
   * 나눈다. 슬라이스는 줄어드는 잔액이 아니라 **개장 시점 CP 잔액**(`counters.cpWindowBase`)에
   * 투영되므로, variance 0에서 슬라이스 합계가 단일 호출 결과와 (부동소수점 오차 범위에서) 정확히
   * 일치한다 — 기존 체크포인트가 그대로 산다.
   *
   * 재발행률(`cpRollFraction`)은 **매 틱 실시간으로** 신뢰지수를 읽는다. 틱 중간에 신뢰지수가 구간
   * 경계(60/50/40/30)를 넘으면 남은 슬라이스부터 다른 재발행률이 적용된다.
   */
  cpRollTicks(p: { share: number; profile: number[]; label?: string }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'cpRollTicks',
      { share: p.share, profile: p.profile.join('/') },
      (d, ctx) => {
        const s = sec(d)
        if (ctx.tick === 0) d.counters.cpWindowBase = s.funding.cp
        const base = d.counters.cpWindowBase ?? s.funding.cp
        const slice = p.profile[ctx.tick] ?? 0
        const noise = noiseFactor(
          ctx,
          ctx.noise?.runoffSigma ?? DEFAULT_NOISE.runoffSigma,
          ctx.noise?.runoffCap ?? DEFAULT_NOISE.runoffCap,
        )
        const matured = base * p.share * slice * noise
        const closed = (d.counters.cpClosedUntil ?? -1) >= d.turnIndex
        const roll = cpRollFraction(d.confidence.index, closed)
        const shortfall = matured * (1 - roll)
        s.funding.cp -= shortfall
        s.liquidity.cash -= shortfall
        d.counters.cpRunoff = (d.counters.cpRunoff ?? 0) + shortfall
        ctx.log(
          `CP 청약 ${(slice * 100).toFixed(0)}% 구간: 만기 ${matured.toFixed(0)} 중 재발행 ${(roll * 100).toFixed(0)}%${closed ? ' (시장 폐쇄)' : ''} → 순상환 ${shortfall.toFixed(0)}`,
        )
      },
      p.label,
    )
  },

  /** 콜차입(익일물)은 신뢰지수가 낮으면 대여자가 한도를 회수한다. */
  callRollStep(label?: string): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'callRollStep',
      {},
      (d, ctx) => {
        const s = sec(d)
        const ci = d.confidence.index
        const cut = ci < 30 ? 0.6 : ci < 40 ? 0.3 : 0
        if (cut === 0) return
        const amt = s.funding.call * cut
        s.funding.call -= amt
        s.liquidity.cash -= amt
        d.counters.callRunoff = (d.counters.callRunoff ?? 0) + amt
        ctx.log(`콜 대여자 한도 회수 ${(cut * 100).toFixed(0)}% → 상환 ${amt.toFixed(0)}`)
      },
      label,
    )
  },

  /** 결제일(턴 시작) 점검: 현금이 음수면 지급불능 플래그. 항상 entryEffects의 마지막에 둔다. */
  settlementCheck(): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('settlementCheck', {}, (d, ctx) => {
      const s = sec(d)
      if (s.liquidity.cash < 0) {
        d.flags.insolvent = true
        d.flagTurns.insolvent ??= d.turnIndex
        ctx.log(`결제 실패: 현금 ${s.liquidity.cash.toFixed(0)} < 0`)
      }
    })
  },

  /** 시장 차환 성공률을 기준값 + 플레이어 누적 조정치(counters.rollRateAdj)로 설정. */
  setRollRateWithAdj(base: number, reason?: string): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('setRollRateWithAdj', { base }, (d, ctx) => {
      const adj = d.counters.rollRateAdj ?? 0
      sec(d).pf.rollRate = clamp(base + adj, 0.05, 1)
      ctx.log(
        `차환 성공률 → ${(sec(d).pf.rollRate * 100).toFixed(0)}% (시장 ${(base * 100).toFixed(0)}%${adj ? `, 자사 조정 ${adj > 0 ? '+' : ''}${(adj * 100).toFixed(0)}%p` : ''})${reason ? ` — ${reason}` : ''}`,
      )
    })
  },

  /** 자사 차환 성공률 조정(누적). 공시·콜옵션 등 자사 신용 이벤트. */
  adjustRollRate(delta: number, reason?: string): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('adjustRollRate', { delta }, (d, ctx) => {
      d.counters.rollRateAdj = (d.counters.rollRateAdj ?? 0) + delta
      sec(d).pf.rollRate = clamp(sec(d).pf.rollRate + delta, 0.05, 1)
      ctx.log(
        `자사 차환 성공률 ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%p${reason ? ` (${reason})` : ''}`,
      )
    })
  },

  /** 만기 사다리 index[from..to]의 fraction을 사다리 끝(게임 지평 밖)으로 이동. 연장 수수료는 자본 차감. */
  smoothMaturities(p: {
    fraction: number
    fromIdx: number
    toIdx: number
    feeRate: number
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('smoothMaturities', { ...p }, (d, ctx) => {
      const s = sec(d)
      const ladder = [...s.pf.abcpMaturing]
      let moved = 0
      for (let i = p.fromIdx; i <= p.toIdx; i++) {
        const amt = (ladder[i] ?? 0) * p.fraction
        ladder[i] = (ladder[i] ?? 0) - amt
        moved += amt
      }
      const last = ladder.length - 1
      ladder[last] = (ladder[last] ?? 0) + moved
      s.pf.abcpMaturing = ladder
      s.equityCapital -= moved * p.feeRate
      d.counters.abcpExtended = (d.counters.abcpExtended ?? 0) + moved
      ctx.log(
        `만기 분산: ${moved.toFixed(0)} 을 2023.1 이후로 연장 (수수료 ${(moved * p.feeRate).toFixed(0)})`,
      )
    })
  },

  /**
   * 만기연장 협상 차환: 실패분의 extendShare(신뢰지수 < ciFloor면 40%만)를 2턴 뒤로 연장하고
   * 나머지는 매입확약 이행(자체매입). 연장분에는 수수료(자본 차감)가 붙는다.
   */
  negotiatedRollover(p: {
    extendShare: number
    riskWeight: number
    ciFloor?: number
    feeRate?: number
    label?: string
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'negotiatedRollover',
      { extendShare: p.extendShare, riskWeight: p.riskWeight },
      (d, ctx) => {
        const s = sec(d)
        const maturing = s.pf.abcpMaturing[0] ?? 0
        const failed = maturing * (1 - clamp(s.pf.rollRate, 0, 1))
        const share = d.confidence.index >= (p.ciFloor ?? 40) ? p.extendShare : p.extendShare * 0.4
        const extended = failed * share
        const bought = failed - extended
        const fee = extended * (p.feeRate ?? 0.005)
        s.liquidity.cash -= bought
        s.pf.abcpHeld += bought
        s.risk.credit += bought * p.riskWeight
        s.equityCapital -= fee
        s.pf.abcpGuaranteed = Math.max(0, s.pf.abcpGuaranteed - bought)
        const ladder = [...s.pf.abcpMaturing.slice(1), 0]
        ladder[1] = (ladder[1] ?? 0) + extended
        s.pf.abcpMaturing = ladder
        d.counters.abcpBought = (d.counters.abcpBought ?? 0) + bought
        d.counters.abcpExtended = (d.counters.abcpExtended ?? 0) + extended
        d.counters.lastRolloverFailed = failed
        d.counters.cumulativeRolloverFailed = (d.counters.cumulativeRolloverFailed ?? 0) + failed
        ctx.log(
          `차환 협상: 만기 ${maturing.toFixed(0)} 중 실패 ${failed.toFixed(0)} → 연장 ${extended.toFixed(0)} (동의율 ${(share * 100).toFixed(0)}%), 자체매입 ${bought.toFixed(0)}, 수수료 ${fee.toFixed(0)}`,
        )
      },
      p.label,
    )
  },

  /** 신규 매입확약(진행 중이던 딜 클로징 등): 보증 잔액과 사다리에 추가. */
  addCommitments(p: { amount: number; atIndex: number; reason?: string }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'addCommitments',
      { amount: p.amount, atIndex: p.atIndex },
      (d, ctx) => {
        const s = sec(d)
        s.pf.abcpGuaranteed += p.amount
        const ladder = [...s.pf.abcpMaturing]
        while (ladder.length <= p.atIndex) ladder.push(0)
        ladder[p.atIndex] = (ladder[p.atIndex] ?? 0) + p.amount
        s.pf.abcpMaturing = ladder
        d.counters.newCommitments = (d.counters.newCommitments ?? 0) + p.amount
        ctx.log(`신규 매입확약 +${p.amount}${p.reason ? ` (${p.reason})` : ''}`)
      },
    )
  },

  /** 보유 ABCP 평가손(유통금리 상승). */
  markHeldAbcp(p: { pct: number; reason?: string }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('markHeldAbcp', { pct: p.pct }, (d, ctx) => {
      const s = sec(d)
      const loss = s.pf.abcpHeld * p.pct
      if (loss <= 0) return
      s.equityCapital -= loss
      d.counters.mtmLoss = (d.counters.mtmLoss ?? 0) + loss
      ctx.log(
        `보유 ABCP 평가손 ${loss.toFixed(0)} (${(p.pct * 100).toFixed(1)}%)${p.reason ? ` — ${p.reason}` : ''}`,
      )
    })
  },

  /**
   * PF 우발채무 상세 공시: 직전 스냅샷의 유동성비율이 minRatio 이상이면 검증 가능한 여력 공표(ΔCI +8,
   * 자사 차환률 +5%p), 미달이면 부족이 드러남(ΔCI −5). 가이드 6.5 완화표 / 6.4 증폭표 준용.
   */
  discloseExposure(p: { minRatio: number }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('discloseExposure', { minRatio: p.minRatio }, (d, ctx) => {
      const lr = ctx.metrics.metrics.liquidityRatio?.value ?? 0
      if (lr >= p.minRatio) {
        d.confidence.index = clamp(d.confidence.index + 8, 0, 100)
        d.counters.rollRateAdj = (d.counters.rollRateAdj ?? 0) + 0.05
        sec(d).pf.rollRate = clamp(sec(d).pf.rollRate + 0.05, 0.05, 1)
        d.flags.disclosure_verified = true
        d.flagTurns.disclosure_verified ??= d.turnIndex
        ctx.log(
          `익스포저 공시: 유동성비율 ${lr.toFixed(0)}% ≥ ${p.minRatio}% → ΔCI +8, 자사 차환률 +5%p`,
        )
      } else {
        d.confidence.index = clamp(d.confidence.index - 5, 0, 100)
        d.flags.disclosure_backfired = true
        d.flagTurns.disclosure_backfired ??= d.turnIndex
        ctx.log(
          `익스포저 공시: 유동성비율 ${lr.toFixed(0)}% < ${p.minRatio}% → 부족이 드러남, ΔCI −5`,
        )
      }
    })
  },

  /** 정책 매입 프로그램에 자사 CP 매각(=발행). 범위 일치도(scopeShare)만큼만 소화된다. */
  sellOwnCpToProgramme(p: {
    amount: number
    scopeShare: number
    rateBp: number
    label?: string
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>(
      'sellOwnCpToProgramme',
      { amount: p.amount, scopeShare: p.scopeShare, rateBp: p.rateBp },
      (d, ctx) => {
        const s = sec(d)
        const got = p.amount * p.scopeShare
        s.funding.cp += got
        s.liquidity.cash += got
        d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + got
        d.counters.programmeFunding = (d.counters.programmeFunding ?? 0) + got
        d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
        ctx.log(
          `프로그램 CP 매각 ${got.toFixed(0)} / 신청 ${p.amount} (범위 일치 ${(p.scopeShare * 100).toFixed(0)}%)`,
        )
      },
      p.label,
    )
  },

  /** 후순위채 콜 행사 + 차환 발행. 신뢰지수 ≥ ciFloor면 전액 차환, 아니면 절반만 사모로 소화(나머지 현금 상환·가산자본 감소). */
  exerciseCallRefinance(p: {
    amount: number
    ciFloor: number
    rateBp: number
  }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('exerciseCallRefinance', { ...p }, (d, ctx) => {
      const s = sec(d)
      s.liquidity.cash -= p.amount
      const placed = d.confidence.index >= p.ciFloor ? p.amount : p.amount * 0.5
      s.liquidity.cash += placed
      s.additions -= p.amount - placed
      d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
      d.flags.call_exercised = true
      d.flagTurns.call_exercised ??= d.turnIndex
      ctx.log(
        `후순위채 콜 행사 ${p.amount}, 차환 발행 ${placed.toFixed(0)} (신뢰지수 ${d.confidence.index.toFixed(0)})`,
      )
    })
  },

  /** 콜 행사 후 현금 상환(차환 없음): 가산자본(후순위) 감소. */
  redeemCallCash(p: { amount: number }): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('redeemCallCash', { amount: p.amount }, (d, ctx) => {
      const s = sec(d)
      s.liquidity.cash -= p.amount
      s.additions -= p.amount
      d.flags.call_exercised = true
      d.flagTurns.call_exercised ??= d.turnIndex
      ctx.log(`후순위채 콜 행사 ${p.amount} 현금 상환 — 영업용순자본 가산분 −${p.amount}`)
    })
  },

  /** 콜옵션 미행사(흥국생명 사례): ΔCI −20, CP 시장 2턴 폐쇄, 자사 차환률 −10%p, 주가 −10%. */
  skipCall(): Effect<SecuritiesState> {
    return fnEffect<SecuritiesState>('skipCall', {}, (d, ctx) => {
      d.confidence.index = clamp(d.confidence.index - 20, 0, 100)
      d.counters.cpClosedUntil = d.turnIndex + 2
      d.counters.rollRateAdj = (d.counters.rollRateAdj ?? 0) - 0.1
      sec(d).pf.rollRate = clamp(sec(d).pf.rollRate - 0.1, 0.05, 1)
      d.market.ownStock = Math.max(0.01, d.market.ownStock * 0.9)
      d.flags.call_skipped = true
      d.flagTurns.call_skipped ??= d.turnIndex
      ctx.log('콜옵션 미행사: ΔCI −20, CP 시장 2턴 폐쇄, 자사 차환률 −10%p, 주가 −10%')
    })
  },
}
