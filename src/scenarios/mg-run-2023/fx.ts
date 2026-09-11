import type { BankState, Effect } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'
import {
  projectRunoff,
  runStateFromCi,
  totalDeposits,
  uninsuredDeposits,
} from '../../metrics/runoff'

/**
 * mg-run-2023 전용 효과 빌더. 엔진의 `bankFx`와 같은 의미론을 따르되, 일 단위 턴 사이에 영업일이
 * 여러 날 끼는 경우(7/10→7/14 = 4영업일)를 처리하고, 새마을금고 고유 창구(은행 RP 우회 조달,
 * 수치 공개의 충분성 판정)를 인코딩한다. 산식·앵커는 calibration.md 참조.
 */

/** 5대 은행 + 산은·기은이 국고채·통안채 담보로 매입한 RP 상한 (6~6.2조, press-bank-rp-2023-07-11). */
export const RP_CAP = 6.2

export const mgFx = {
  /**
   * `days`영업일분 예금 유출을 하루씩 순차 적용한다(잔액 감소 반영). 증폭 계수는 창(window) 전체에
   * 유지되고 창이 끝나면 1로 리셋된다(bankFx.runoffStep과 동일). `lastOutflow`는 마지막 날 값이므로
   * KPI "당일 예금 순유출"은 항상 하루치를 보여 주고, `windowOutflow`에 창 합계를 따로 기록한다.
   * 결제는 현금(상환준비금·가용현금)에서만 이루어지며, 담보차입 여력은 명시적으로 인출해야 한다.
   */
  runoffDays(p: { days: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'runoffDays',
      { days: p.days },
      (d, ctx) => {
        const b = d.institution
        const amp = d.counters.amplifier || 1
        const damp = Math.max(0.3, d.counters.dampener || 1)
        if (d.counters.startDeposits === undefined) d.counters.startDeposits = totalDeposits(b)
        let windowTotal = 0
        let last = 0
        let stateLabel = 'S0'
        for (let i = 0; i < p.days; i++) {
          const runState = runStateFromCi(d.confidence.index)
          stateLabel = ['S0', 'S1', 'S2', 'S3'][runState] ?? 'S0'
          const projected = projectRunoff({
            segments: b.deposits,
            runState,
            amplifier: amp,
            dampener: damp,
            networkAmplifier: d.counters.networkAmplifier || 1,
          })
          for (const seg of b.deposits) {
            const row = projected.bySegment.find((r) => r.id === seg.id)
            if (row) seg.balance = Math.max(0, seg.balance - row.outflow)
          }
          last = projected.total
          windowTotal += last
        }
        d.counters.lastOutflow = last
        d.counters.windowOutflow = windowTotal
        d.counters.cumulativeOutflow = (d.counters.cumulativeOutflow ?? 0) + windowTotal
        d.counters.peakDailyOutflow = Math.max(d.counters.peakDailyOutflow ?? 0, last)
        const cashBefore = b.cash
        b.cash -= windowTotal
        // 사전 약정된 은행 RP 라인(당일 결제)은 결제 부족분만큼 자동 인출된다 — 약정의 존재 이유가 바로 이것이며,
        // 라인이 없거나(한은 창구 부재) 한도가 모자라면 부족분이 그대로 지급 정지 사유가 된다.
        if (b.cash < 0 && b.wholesale.cbFacilityCapacity > 0) {
          const auto = Math.min(-b.cash, b.wholesale.cbFacilityCapacity)
          b.wholesale.cbFacilityCapacity -= auto
          b.wholesale.cbAdvances += auto
          b.cash += auto
          d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + auto
          ctx.log(`은행 RP 라인 자동 인출 ${auto.toFixed(2)}조 (결제 부족분 충당)`)
        }
        const shortfall = b.cash < 0 ? -b.cash : 0
        d.counters.settlementShortfall = shortfall
        if (shortfall > 0)
          d.log.push(
            `[T${d.turnIndex}] 지급 부족: ${shortfall.toFixed(2)}조 (상환준비금·가용현금 소진)`,
          )
        b.leverageExposure = Math.max(0, b.leverageExposure - Math.min(cashBefore, windowTotal))
        ctx.log(
          `예금 유출 ${p.days}영업일 합계 ${windowTotal.toFixed(2)}조 (마지막 날 ${last.toFixed(2)}조) [${stateLabel} × 증폭 ${amp.toFixed(2)} × 완화 ${damp.toFixed(2)}] — 가용현금 ${cashBefore.toFixed(1)} → ${b.cash.toFixed(1)}`,
        )
        if (!d.flags.persistentAmplifier) d.counters.amplifier = 1
        d.counters.networkAmplifier = 1
      },
      p.label,
    )
  },

  /**
   * 브리핑에서 유동성 수치를 공개한다. 검증 가능한 여력(가용현금 + 담보차입 여력 + 미담보 채권 시가)이
   * 5천만원 초과 예금의 50% 이상이면 ΔCI +5, 미달이면 "부족이 드러남" ΔCI −5·증폭 ×1.3
   * (보정 규칙: 검증 가능 유동성 공표는 사실일 때만 작동, 모순 시 증폭).
   */
  discloseFigures(): Effect<BankState> {
    return fnEffect<BankState>('discloseFigures', {}, (d, ctx) => {
      const b = d.institution
      const unpledged = (mv: number, pledged?: number) => mv * (1 - (pledged ?? 0))
      const capacity =
        b.cash +
        b.wholesale.cbFacilityCapacity +
        unpledged(b.securities.afs.marketValue, b.securities.afs.pledgedShare) +
        unpledged(b.securities.htm.marketValue, b.securities.htm.pledgedShare)
      const uninsured = uninsuredDeposits(b)
      if (capacity >= 0.5 * uninsured) {
        d.confidence.index = clamp(d.confidence.index + 5, 0, 100)
        d.flags.figures_disclosed = true
        d.flagTurns.figures_disclosed ??= d.turnIndex
        ctx.log(
          `수치 공개: 가용 여력 ${capacity.toFixed(1)}조 ≥ 5천만원 초과 예금 50%(${(0.5 * uninsured).toFixed(1)}조) → ΔCI +5`,
        )
      } else {
        d.confidence.index = clamp(d.confidence.index - 5, 0, 100)
        d.counters.amplifier = (d.counters.amplifier || 1) * 1.3
        d.flags.figures_shortfall_exposed = true
        d.flagTurns.figures_shortfall_exposed ??= d.turnIndex
        ctx.log(
          `수치 공개: 가용 여력 ${capacity.toFixed(1)}조 < 5천만원 초과 예금 50% → 부족이 드러남, ΔCI −5, 증폭 ×1.3`,
        )
      }
    })
  },

  /**
   * 은행권 RP(국고채·통안채 담보) 우회 조달. 누적 체결액은 RP_CAP(6.2조)을 넘지 못한다.
   * settle='now'면 당일 여력에, 'next'면 익일 여력(pending)에 더한 뒤, 당일 여력은 전액 인출해 현금화한다
   * (은행이 RP를 매입하면 대금이 즉시 입금되므로).
   */
  bankRp(p: { amount: number; settle: 'now' | 'next'; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'bankRp',
      { amount: p.amount, settle: p.settle },
      (d, ctx) => {
        const b = d.institution
        const already = d.counters.rpArranged ?? 0
        const add = clamp(Math.min(p.amount, RP_CAP - already), 0, p.amount)
        d.counters.rpArranged = already + add
        if (p.settle === 'now') b.wholesale.cbFacilityCapacity += add
        else b.wholesale.cbFacilityPending += add
        const drawn = b.wholesale.cbFacilityCapacity
        if (drawn > 0) {
          b.wholesale.cbFacilityCapacity = 0
          b.wholesale.cbAdvances += drawn
          b.cash += drawn
          d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + drawn
        }
        ctx.log(
          `은행 RP: 신규 체결 ${add.toFixed(1)}조 (${p.settle === 'now' ? '당일' : '익일'} 결제, 누적 ${(already + add).toFixed(1)}/${RP_CAP}조) → 당일 현금화 ${drawn.toFixed(1)}조`,
        )
        if (add < p.amount)
          d.log.push(
            `[T${d.turnIndex}] 은행권 RP 매입 한도 도달: ${(p.amount - add).toFixed(1)}조 미체결`,
          )
      },
      p.label,
    )
  },

  /** 예금금리 인상 방어: 우려(S1) 상태에서만 완화 ×0.95, 이자 비용은 counters.nimCost에 누적. */
  depositRateDefense(p: { bp: number }): Effect<BankState> {
    return fnEffect<BankState>('depositRateDefense', { bp: p.bp }, (d, ctx) => {
      d.counters.nimCost = (d.counters.nimCost ?? 0) + (p.bp / 10000) * 40
      if (d.confidence.index >= 50 && d.confidence.index < 70) {
        d.counters.dampener = Math.max(0.3, (d.counters.dampener || 1) * 0.95)
        ctx.log(`특판 금리 +${p.bp}bp: 우려(S1) 상태에서만 소폭 완화 ×0.95`)
      } else ctx.log(`특판 금리 +${p.bp}bp: 현재 런 상태에서는 효과 없음`)
    })
  },
}
