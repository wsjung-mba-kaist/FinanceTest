import type { Draft } from 'immer'
import type { BankState, Effect, GameState } from '../types'
import { clamp } from '../core/paths'
import { DEFAULT_NOISE, noiseFactor } from '../core/noise'
import { projectRunoff, runStateFromCi, totalDeposits } from '../../metrics/runoff'
import { fnEffect } from './common'

type BankDraft = Draft<GameState<BankState>>

function bank(d: BankDraft): Draft<BankState> {
  return d.institution
}

/**
 * Bank effect builders. Each encodes one calibrated mechanism from docs/authoring-guide.md.
 * All amounts are in scenario units (e.g. $B).
 */
export const bankFx = {
  /**
   * Sells a fraction (or amount) of a securities book. AFS realises the AOCI mark; HTM sale taints the
   * whole HTM book (ASC 320-10-25-6) → reclassified to AFS at market, unrealized loss becomes visible,
   * ΔCI −30 (calibration table). Fire-sale discount `disc = k × (size/ADV)^0.5` is approximated by
   * `fireSaleDiscount × sqrt(amount / referenceSize)`.
   */
  sellSecurities(p: {
    book: 'afs' | 'htm'
    amount?: number
    fraction?: number
    fireSaleRef?: number
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'sellSecurities',
      { book: p.book, amount: p.amount ?? 0, fraction: p.fraction ?? 0 },
      (d, ctx) => {
        const b = bank(d)
        const book = b.securities[p.book]
        const amount = clamp(p.amount ?? book.marketValue * (p.fraction ?? 0), 0, book.marketValue)
        if (amount <= 0) return
        const share = amount / book.marketValue
        const bookValueSold = book.bookValue * share
        const ref = p.fireSaleRef ?? 20
        const fireSale = amount * b.fireSaleDiscount * Math.sqrt(amount / ref)
        const proceeds = amount - fireSale
        const preTaxLoss = bookValueSold - proceeds
        const afterTaxLoss = preTaxLoss * (1 - b.taxRate)
        book.marketValue -= amount
        book.bookValue -= bookValueSold
        b.cash += proceeds
        b.capital.cet1 -= afterTaxLoss
        // sold securities leave RWA (agency MBS ≈ 20% RW); stylised
        b.rwa = Math.max(0, b.rwa - bookValueSold * 0.2)
        b.leverageExposure = Math.max(0, b.leverageExposure - bookValueSold + proceeds)
        d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + afterTaxLoss
        ctx.log(
          `${p.book.toUpperCase()} 매각 ${amount.toFixed(1)} → 현금 +${proceeds.toFixed(1)}, 세후 손실 ${afterTaxLoss.toFixed(2)} (파이어세일 ${fireSale.toFixed(2)})`,
        )
        if (p.book === 'htm' && !b.htmTainted) {
          b.htmTainted = true
          // Tainting: remaining HTM reclassified at market value; the mark hits equity (AOCI → economic TCE).
          const remainingLoss = b.securities.htm.bookValue - b.securities.htm.marketValue
          b.securities.htm.bookValue = b.securities.htm.marketValue
          b.securities.afs.marketValue += b.securities.htm.marketValue
          b.securities.afs.bookValue += b.securities.htm.marketValue
          b.securities.htm.marketValue = 0
          // conservative: the merged book takes the lower HQLA level of the two
          const rank = { L1: 0, L2A: 1, L2B: 2, none: 3 } as const
          const htmLevel = b.securities.htm.hqlaLevel ?? 'none'
          const afsLevel = b.securities.afs.hqlaLevel ?? 'none'
          if (rank[htmLevel] > rank[afsLevel]) b.securities.afs.hqlaLevel = htmLevel
          b.capital.cet1 -= b.capital.aociInCet1 ? remainingLoss * (1 - b.taxRate) : 0
          d.counters.htmTaintLoss = remainingLoss
          d.confidence.index = clamp(d.confidence.index - 30, 0, 100)
          ctx.log(`HTM tainting: 잔여 HTM ${remainingLoss.toFixed(1)} 미실현손실 가시화, ΔCI −30`)
        }
      },
      p.label,
    )
  },

  /** Draws on established same-day secured capacity (FHLB / discount window / BTFP). */
  drawFacility(p: { amount: number; source: string; rateBp?: number }): Effect<BankState> {
    return fnEffect<BankState>('drawFacility', { amount: p.amount, source: p.source }, (d, ctx) => {
      const b = bank(d)
      const drawn = clamp(p.amount, 0, b.wholesale.cbFacilityCapacity)
      b.wholesale.cbFacilityCapacity -= drawn
      b.wholesale.cbAdvances += drawn
      b.cash += drawn
      d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + drawn
      if (p.rateBp) d.counters.fundingCostBp = Math.max(d.counters.fundingCostBp ?? 0, p.rateBp)
      ctx.log(
        `${p.source} 차입 ${drawn.toFixed(1)} (요청 ${p.amount}, 여력 부족분 ${(p.amount - drawn).toFixed(1)})`,
      )
      if (drawn < p.amount) {
        d.log.push(`[T${d.turnIndex}] 담보 여력 부족: ${(p.amount - drawn).toFixed(1)} 미조달`)
      }
    })
  },

  /**
   * Pledges collateral to a facility. Same-day capacity rises by `immediate`; the rest arrives next turn
   * (`pending`), modelling FHLB → Fed transfer latency. Haircuts per Fed/FHLB margins tables.
   */
  pledgeCollateral(p: { immediate: number; pending?: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'pledgeCollateral',
      { immediate: p.immediate, pending: p.pending ?? 0 },
      (d, ctx) => {
        const b = bank(d)
        b.wholesale.cbFacilityCapacity += p.immediate
        b.wholesale.cbFacilityPending += p.pending ?? 0
        ctx.log(`담보 설정: 당일 여력 +${p.immediate}, 익일 +${p.pending ?? 0}`)
      },
      p.label,
    )
  },

  /** Moves pending capacity into same-day capacity (call at turn start). */
  settlePendingCapacity(): Effect<BankState> {
    return fnEffect<BankState>('settlePendingCapacity', {}, (d, ctx) => {
      const b = bank(d)
      if (b.wholesale.cbFacilityPending > 0) {
        ctx.log(`담보 이전 완료: 여력 +${b.wholesale.cbFacilityPending.toFixed(1)}`)
        b.wholesale.cbFacilityCapacity += b.wholesale.cbFacilityPending
        b.wholesale.cbFacilityPending = 0
      }
    })
  },

  /**
   * Capital raise. Succeeds iff backstop = 100% OR (CI ≥ 45 and backstop ≥ 50%). Dilution
   * = X / (mktCap×(1−d) + X). Failure sets flag `raise_failed` and applies the ×2.0 run amplifier.
   */
  raiseEquity(p: {
    amount: number
    backstopPct: number
    discount: number
    marketCap: number
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'raiseEquity',
      { amount: p.amount, backstopPct: p.backstopPct, discount: p.discount },
      (d, ctx) => {
        const b = bank(d)
        const ci = d.confidence.index
        const success = p.backstopPct >= 100 || (ci >= 45 && p.backstopPct >= 50)
        if (success) {
          b.capital.cet1 += p.amount
          b.cash += p.amount
          b.leverageExposure += p.amount
          const dilution = p.amount / (p.marketCap * (1 - p.discount) + p.amount)
          d.counters.dilution = (d.counters.dilution ?? 0) + dilution
          d.flags.raise_closed = true
          d.flagTurns.raise_closed ??= d.turnIndex
          d.counters.dampener = Math.max(0.3, (d.counters.dampener || 1) * 0.7)
          ctx.log(`증자 성공 ${p.amount} (희석 ${(dilution * 100).toFixed(0)}%), 완화 ×0.7`)
        } else {
          d.flags.raise_failed = true
          d.flagTurns.raise_failed ??= d.turnIndex
          d.counters.amplifier = (d.counters.amplifier || 1) * 2
          d.confidence.index = clamp(ci - 25, 0, 100)
          ctx.log(`증자 실패 (CI ${ci.toFixed(0)}, 백스톱 ${p.backstopPct}%): 증폭 ×2.0, ΔCI −25`)
        }
      },
    )
  },

  /**
   * Runs one period of deposit outflow using the calibrated run-off model and pays it from the
   * liquidity waterfall: cash → same-day secured capacity → (shortfall recorded → settlement failure).
   * `windowFraction` prorates intraday turns.
   *
   * **Tick behaviour.** On a ticked turn (called from `Turn.eachTick`) each tick takes a slice of the
   * window — `profile[tick]`, or `1/ticks` without a profile — projected against the balance at the
   * start of the window (`seg.windowBase`), never against the shrinking balance. At `variance: 0`
   * the slices therefore sum **exactly** to the single-call result (Σ share = 1).
   *
   * Rate inputs (CI → run state, amplifier, dampener) are read **live at every tick**: an amplifier
   * set mid-window applies to the remaining slices and is reset only at the window's last tick.
   * With no `ticks` on the turn, tick 0 is both the first and the last tick, so this is exactly the
   * pre-tick behaviour.
   */
  runoffStep(p: {
    windowFraction?: number
    profile?: number[]
    label?: string
  }): Effect<BankState> {
    return fnEffect<BankState>(
      'runoffStep',
      {
        windowFraction: p.windowFraction ?? 1,
        ...(p.profile ? { profile: p.profile.join('/') } : {}),
      },
      (d, ctx) => {
        const b = bank(d)
        const first = ctx.tick === 0
        const last = ctx.isLastTick
        const share = p.profile ? (p.profile[ctx.tick] ?? 0) : 1 / ctx.ticks
        if (first && ctx.ticks > 1) for (const seg of b.deposits) seg.windowBase = seg.balance
        const runState = runStateFromCi(d.confidence.index)
        const amp = d.counters.amplifier || 1
        const damp = Math.max(0.3, d.counters.dampener || 1)
        const noise = noiseFactor(
          ctx,
          ctx.noise?.runoffSigma ?? DEFAULT_NOISE.runoffSigma,
          ctx.noise?.runoffCap ?? DEFAULT_NOISE.runoffCap,
        )
        const projected = projectRunoff({
          segments: b.deposits.map((seg) => ({ ...seg, balance: seg.windowBase ?? seg.balance })),
          runState,
          amplifier: amp,
          dampener: damp,
          windowFraction: (p.windowFraction ?? 1) * share * noise,
          networkAmplifier: d.counters.networkAmplifier || 1,
        })
        if (d.counters.startDeposits === undefined) d.counters.startDeposits = totalDeposits(b)
        for (const seg of b.deposits) {
          const row = projected.bySegment.find((r) => r.id === seg.id)
          if (row) seg.balance = Math.max(0, seg.balance - Math.min(seg.balance, row.outflow))
        }
        const out = projected.total
        // "당일 유출" accumulates across the intraday window; cumulative is lifetime.
        d.counters.lastOutflow = first ? out : (d.counters.lastOutflow ?? 0) + out
        d.counters.cumulativeOutflow = (d.counters.cumulativeOutflow ?? 0) + out
        // Outflows settle from cash only. Secured facilities must be drawn explicitly (an operational
        // step with cut-offs) — un-drawn capacity does not stop a negative settlement balance.
        const cashBefore = b.cash
        b.cash -= out
        const shortfall = b.cash < 0 ? -b.cash : 0
        d.counters.settlementShortfall = shortfall
        if (shortfall > 0)
          d.log.push(`[T${d.turnIndex}] 결제 부족: ${shortfall.toFixed(2)} (마감 잔고 음수)`)
        b.leverageExposure = Math.max(0, b.leverageExposure - Math.min(cashBefore, out))
        ctx.log(
          `예금 유출 ${out.toFixed(1)} [${['S0', 'S1', 'S2', 'S3'][runState]} × 증폭 ${amp.toFixed(2)} × 완화 ${damp.toFixed(2)}] — 현금 ${cashBefore.toFixed(1)} → ${b.cash.toFixed(1)}`,
        )
        if (last) {
          if (ctx.ticks > 1) for (const seg of b.deposits) delete seg.windowBase
          // amplifiers are one-period unless persistent flags say otherwise
          if (!d.flags.persistentAmplifier) d.counters.amplifier = 1
          d.counters.networkAmplifier = 1
        }
      },
      p.label,
    )
  },

  /** Applies a market move to both books via duration (ΔP ≈ −D·Δy·MV). Positive bp = yields up. */
  rateShock(p: { deltaBp: number; label?: string }): Effect<BankState> {
    return fnEffect<BankState>(
      'rateShock',
      { deltaBp: p.deltaBp },
      (d, ctx) => {
        const b = bank(d)
        for (const book of [b.securities.afs, b.securities.htm]) {
          const pnl = -book.modDuration * (p.deltaBp / 10000) * book.marketValue
          book.marketValue = Math.max(0, book.marketValue + pnl)
        }
        ctx.log(`금리 충격 ${p.deltaBp > 0 ? '+' : ''}${p.deltaBp}bp → 증권 평가액 조정`)
      },
      p.label,
    )
  },

  /** Converts a share of uninsured balances into insured (sweep programme). */
  insuredSweep(p: { share: number }): Effect<BankState> {
    return fnEffect<BankState>('insuredSweep', { share: p.share }, (d, ctx) => {
      const b = bank(d)
      const insured = b.deposits.find((s) => s.insured)
      if (!insured) return
      let moved = 0
      for (const seg of b.deposits) {
        if (seg.insured) continue
        const m = seg.balance * p.share
        seg.balance -= m
        moved += m
      }
      insured.balance += moved
      ctx.log(`보험 스윕: ${moved.toFixed(1)} 무보험 → 보험 전환`)
    })
  },

  /** Sets the run-off dampener (multiplicative, persistent until changed). */
  setDampener(factor: number, reason?: string): Effect<BankState> {
    return fnEffect<BankState>('setDampener', { factor }, (d, ctx) => {
      d.counters.dampener = Math.max(0.3, (d.counters.dampener || 1) * factor)
      ctx.log(
        `완화 계수 ×${factor}${reason ? ` (${reason})` : ''} → ${d.counters.dampener.toFixed(2)}`,
      )
    })
  },

  /** Sets a one-period run amplifier (multiplicative). */
  addAmplifier(
    factor: number,
    reason?: string,
    opts: { networked?: boolean } = {},
  ): Effect<BankState> {
    return fnEffect<BankState>(
      'addAmplifier',
      { factor, networked: opts.networked ?? false },
      (d, ctx) => {
        if (opts.networked)
          d.counters.networkAmplifier = (d.counters.networkAmplifier || 1) * factor
        else d.counters.amplifier = (d.counters.amplifier || 1) * factor
        ctx.log(`증폭 ×${factor}${reason ? ` (${reason})` : ''}`)
      },
    )
  },
}
