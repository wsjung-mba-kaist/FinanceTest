import type { Draft } from 'immer'
import type { BankState, Effect, GameState } from '../../engine/types'
import { clamp } from '../../engine/core/paths'
import { fnEffect } from '../../engine/fx/common'

/**
 * lehman-2008 시나리오 전용 효과 빌더. 투자은행의 조달 메커니즘(트라이파티 레포 헤어컷·롤오프, 청산은행 담보 콜,
 * 비유동 자산 할인 매각, 자산운용 자회사 매각, bad-bank 스핀오프, PDCF 담보 확대)을 BankState 위에 표현한다.
 * 모든 현금 유출은 counters.cumulativeOutflow / lastOutflow 에 합산되어 "누적 자금 유출" KPI·체크포인트에 잡힌다.
 * 산식·앵커는 calibration.md 참조.
 */
type D = Draft<GameState<BankState>>
type RepoBook = 'repoL1' | 'repoL2A' | 'repoOther'

function recordOutflow(d: D, amount: number): void {
  d.counters.cumulativeOutflow = (d.counters.cumulativeOutflow ?? 0) + amount
  d.counters.lastOutflow = (d.counters.lastOutflow ?? 0) + amount
}

function updateRepoRollRate(d: D): void {
  const w = d.institution.wholesale
  const start = d.institution.custom.repoBookStart || 1
  d.institution.custom.repoRollRate = clamp(
    ((w.repoL1 + w.repoL2A + w.repoOther) / start) * 100,
    0,
    100,
  )
}

export const ibFx = {
  /** Generic cash outflow from the liquidity pool (optionally paying down a repo book). */
  fundingOutflow(p: { amount: number; book?: RepoBook; label: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'fundingOutflow',
      { amount: p.amount, book: p.book ?? '' },
      (d, ctx) => {
        const b = d.institution
        let amount = p.amount
        if (p.book) {
          amount = Math.min(amount, b.wholesale[p.book])
          b.wholesale[p.book] -= amount
        }
        if (amount <= 0) return
        const before = b.cash
        b.cash -= amount
        b.leverageExposure = Math.max(0, b.leverageExposure - amount)
        recordOutflow(d, amount)
        updateRepoRollRate(d)
        ctx.log(
          `${p.label}: 유동성 풀 ${before.toFixed(1)} → ${b.cash.toFixed(1)} (−${amount.toFixed(1)})`,
        )
      },
      p.label,
    )
  },

  /** Cash inflow into the pool (sale proceeds, consortium funding, rehypothecation) — not counted as outflow. */
  fundingInflow(p: { amount: number; label: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'fundingInflow',
      { amount: p.amount },
      (d, ctx) => {
        const b = d.institution
        const before = b.cash
        b.cash += p.amount
        b.leverageExposure += p.amount
        ctx.log(
          `${p.label}: 유동성 풀 ${before.toFixed(1)} → ${b.cash.toFixed(1)} (+${p.amount.toFixed(1)})`,
        )
      },
      p.label,
    )
  },

  /** Repo counterparties refuse to roll a fraction of a book: the cash leg must be returned. */
  repoRollOff(p: { book: RepoBook; fraction: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'repoRollOff',
      { book: p.book, fraction: p.fraction },
      (d, ctx) => {
        const b = d.institution
        const amount = b.wholesale[p.book] * clamp(p.fraction, 0, 1)
        if (amount <= 0) return
        b.wholesale[p.book] -= amount
        const before = b.cash
        b.cash -= amount
        b.leverageExposure = Math.max(0, b.leverageExposure - amount)
        recordOutflow(d, amount)
        updateRepoRollRate(d)
        ctx.log(
          `레포 롤오버 거부(${p.book} ${(p.fraction * 100).toFixed(0)}%): 현금 반환 ${amount.toFixed(1)} — 풀 ${before.toFixed(1)} → ${b.cash.toFixed(1)}, 롤오버율 ${(b.custom.repoRollRate ?? 0).toFixed(0)}%`,
        )
      },
      p.label,
    )
  },

  /**
   * Haircut increase on a repo book: lenders advance `deltaPct` less cash against the same collateral, so the
   * dealer must fund the gap from its pool (CGFS 36 haircut spiral).
   */
  haircutShock(p: { book: RepoBook; deltaPct: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'haircutShock',
      { book: p.book, deltaPct: p.deltaPct },
      (d, ctx) => {
        const b = d.institution
        const amount = b.wholesale[p.book] * clamp(p.deltaPct, 0, 1)
        if (amount <= 0) return
        b.wholesale[p.book] -= amount
        const before = b.cash
        b.cash -= amount
        b.leverageExposure = Math.max(0, b.leverageExposure - amount)
        recordOutflow(d, amount)
        updateRepoRollRate(d)
        ctx.log(
          `헤어컷 +${(p.deltaPct * 100).toFixed(0)}pp(${p.book}): 조달 감소분 ${amount.toFixed(1)} 현금 충당 — 풀 ${before.toFixed(1)} → ${b.cash.toFixed(1)}`,
        )
      },
      p.label,
    )
  },

  /** Clearing bank (tri-party agent) demands additional collateral / comfort deposit: cash leaves the pool. */
  clearingBankCollateralCall(p: { amount: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'clearingBankCollateralCall',
      { amount: p.amount },
      (d, ctx) => {
        const b = d.institution
        const before = b.cash
        b.cash -= p.amount
        b.custom.clearingBankCalls = (b.custom.clearingBankCalls ?? 0) + p.amount
        recordOutflow(d, p.amount)
        ctx.log(
          `청산은행 담보 콜 ${p.amount.toFixed(1)} 예치: 풀 ${before.toFixed(1)} → ${b.cash.toFixed(1)} (누적 콜 ${b.custom.clearingBankCalls.toFixed(1)})`,
        )
      },
      p.label,
    )
  },

  /**
   * Sells illiquid inventory (CRE/CMBS/mortgages) at a discount to the already-marked value; the loss hits
   * common equity, and `remarkPct` re-marks the remaining book (buyers now see the clearing price).
   */
  sellIlliquid(p: {
    amount: number
    discount: number
    remarkPct?: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'sellIlliquid',
      { amount: p.amount, discount: p.discount, remarkPct: p.remarkPct ?? 0 },
      (d, ctx) => {
        const b = d.institution
        const book = b.securities.htm
        const amount = clamp(p.amount, 0, book.marketValue)
        if (amount <= 0) return
        const share = amount / book.marketValue
        const bvSold = book.bookValue * share
        const proceeds = amount * (1 - p.discount)
        const loss = bvSold - proceeds
        book.marketValue -= amount
        book.bookValue -= bvSold
        b.cash += proceeds
        b.capital.cet1 -= loss
        b.leverageExposure = Math.max(0, b.leverageExposure - (bvSold - proceeds))
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + loss
        if (p.remarkPct && book.marketValue > 0) {
          const before = book.marketValue
          book.marketValue *= 1 - p.remarkPct
          ctx.log(
            `잔여 비유동 북 재마크 −${(p.remarkPct * 100).toFixed(0)}%: ${before.toFixed(1)} → ${book.marketValue.toFixed(1)}`,
          )
        }
        ctx.log(
          `비유동 자산 매각 ${amount.toFixed(1)} (할인 ${(p.discount * 100).toFixed(0)}%) → 현금 +${proceeds.toFixed(1)}, 실현손실 ${loss.toFixed(2)}`,
        )
      },
      p.label,
    )
  },

  /** Sells the asset-management unit (Neuberger Berman analogue) for cash; gain over book adds to equity. */
  sellNeuberger(p: { price: number; bookValue: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'sellNeuberger',
      { price: p.price, bookValue: p.bookValue },
      (d, ctx) => {
        const b = d.institution
        if (d.flags.nb_sold) {
          ctx.log('자산운용 자회사는 이미 매각됨')
          return
        }
        const gain = p.price - p.bookValue
        b.cash += p.price
        b.otherAssets = Math.max(0, b.otherAssets - p.bookValue)
        b.capital.cet1 += gain
        b.leverageExposure += gain
        b.custom.neubergerValue = 0
        d.flags.nb_sold = true
        d.flagTurns.nb_sold ??= d.turnIndex
        ctx.log(
          `자산운용 자회사 매각 종결: 현금 +${p.price.toFixed(1)}, 자본 +${gain.toFixed(1)} (장부가 ${p.bookValue})`,
        )
      },
      p.label,
    )
  },

  /**
   * Bad-bank spin-off: the illiquid real-estate book leaves the balance sheet with its CMBS repo financing;
   * the firm contributes `equityContribution` of equity (loss share) and stops funding the book.
   */
  spinoffBadBank(p: { equityContribution: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'spinoffBadBank',
      { equityContribution: p.equityContribution },
      (d, ctx) => {
        const b = d.institution
        const book = b.securities.htm
        const removed = book.bookValue
        const repoMoved = b.wholesale.repoOther
        b.leverageExposure = Math.max(0, b.leverageExposure - removed)
        b.otherLiabilities = Math.max(
          0,
          b.otherLiabilities - (removed - repoMoved - p.equityContribution),
        )
        book.bookValue = 0
        book.marketValue = 0
        b.wholesale.repoOther = 0
        b.capital.cet1 -= p.equityContribution
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + p.equityContribution
        b.custom.repoBookStart = Math.max(1, (b.custom.repoBookStart ?? 185) - repoMoved)
        updateRepoRollRate(d)
        d.flags.badbank_spinoff_agreed = true
        d.flagTurns.badbank_spinoff_agreed ??= d.turnIndex
        ctx.log(
          `bad-bank 스핀오프: 비유동 북 ${removed.toFixed(1)} 및 CMBS 레포 ${repoMoved.toFixed(1)} 분리, 자본 기여 ${p.equityContribution}`,
        )
      },
      p.label,
    )
  },

  /** 9/14 PDCF collateral expansion: broker-dealer capacity rises by `base` (or `prepared` if the list was ready). */
  pdcfExpansion(p: { base: number; prepared: number }): Effect<BankState> {
    return fnEffect<BankState>(
      'pdcfExpansion',
      { base: p.base, prepared: p.prepared },
      (d, ctx) => {
        const add = d.flags.weekend_collateral_prepared ? p.prepared : p.base
        d.institution.wholesale.cbFacilityCapacity += add
        d.flags.pdcf_expanded = true
        d.flagTurns.pdcf_expanded ??= d.turnIndex
        ctx.log(
          `PDCF 담보 확대(트라이파티 적격 전체): 브로커딜러 여력 +${add} (지주는 여전히 부적격)`,
        )
      },
    )
  },

  /**
   * Verifiable-capacity disclosure: works only if (pool + PDCF-eligible capacity) ≥ share × runnable funding.
   * Otherwise the number confirms the shortfall (calibration table: contradiction ×amp).
   */
  verifiableLiquidityDisclosure(p: {
    share: number
    ciUp: number
    ciDown: number
    dampen: number
    amp: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'verifiableLiquidityDisclosure',
      { share: p.share, ciUp: p.ciUp, ciDown: p.ciDown, dampen: p.dampen, amp: p.amp },
      (d, ctx) => {
        const b = d.institution
        const runnable = b.deposits.reduce((a, s) => a + s.balance, 0)
        const capacity = b.cash + b.wholesale.cbFacilityCapacity
        if (capacity >= p.share * runnable) {
          d.confidence.index = clamp(d.confidence.index + p.ciUp, 0, 100)
          d.counters.dampener = Math.max(0.3, (d.counters.dampener || 1) * p.dampen)
          d.flags.verified_disclosure = true
          d.flagTurns.verified_disclosure ??= d.turnIndex
          ctx.log(
            `검증 가능 유동성 공표: 여력 ${capacity.toFixed(1)} ≥ 도주성 조달 ${(p.share * 100).toFixed(0)}%(${(p.share * runnable).toFixed(1)}) → ΔCI +${p.ciUp}, 완화 ×${p.dampen}`,
          )
        } else {
          d.confidence.index = clamp(d.confidence.index - p.ciDown, 0, 100)
          d.counters.amplifier = (d.counters.amplifier || 1) * p.amp
          d.flags.disclosure_backfired = true
          d.flagTurns.disclosure_backfired ??= d.turnIndex
          ctx.log(
            `공표한 여력 ${capacity.toFixed(1)} < ${(p.share * runnable).toFixed(1)} — 수치가 부족을 확인시킴: ΔCI −${p.ciDown}, 증폭 ×${p.amp}`,
          )
        }
      },
      p.label,
    )
  },

  /** Resets the per-turn outflow counter (weekend turns have no wire window). */
  resetDailyOutflow(): Effect<BankState> {
    return fnEffect<BankState>('resetDailyOutflow', {}, (d) => {
      d.counters.lastOutflow = 0
    })
  },
}
