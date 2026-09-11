import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  CHANNEL_ORDER,
  createGame,
  fastForwardTicks,
  formatIssues,
  getTurnView,
  replay,
  seedToState,
  TICK_HISTORY_CAP,
  tickCount,
  validateScenario,
  type ConsequenceReel,
  type GameState,
  type BankState,
  type ScenarioDefinition,
} from '@/engine'
import type { ReelStep as UiReelStep } from '@/components/play/reelSteps'
import svb from '@/scenarios/svb-2023/scenario'
import { miniBank } from '../fixtures/miniBank'
import { miniManyTicks, miniTicks, TICKED_TURN_INDEX, TICKS } from '../fixtures/miniTicks'
import { findNonFinite } from '../helpers/scan'
import { decisionErrorCode } from '../helpers/scenario'

type Bank = ScenarioDefinition<BankState>

/** Plays the ticked fixture end to end under a policy (no UI clock involved). */
function autoplayTicked(policy: 'historical' | 'expert') {
  return autoplay(miniTicks, policy, { seed: 1 })
}

/** State at the start of T1 (the ticked turn), after the T0 decision. */
function atT1(sc: Bank, t0: string, seed = 1, variance = 0): GameState<BankState> {
  const s = applyDecision(createGame(sc, seed, { variance }), sc, 'd0_disclosure', [t0])
  return advanceTurn(s, sc)
}

function outflow(s: GameState<BankState>): number {
  return s.counters.cumulativeOutflow ?? 0
}

describe('sub-turn ticks', () => {
  it('the ticked fixture passes the integrity lint with zero errors', () => {
    const issues = validateScenario(miniTicks)
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    expect(tickCount(miniTicks.turns[1])).toBe(TICKS)
    expect(tickCount(miniBank.turns[1])).toBe(1)
  })

  it('a turn without `ticks` has exactly one tick and never advances one', () => {
    const s = atT1(miniBank, 'opt_a_backstopped')
    expect(s.tick).toBe(0)
    expect(canAdvanceTick(s, miniBank)).toBe(false)
    expect(() => advanceTick(s, miniBank)).toThrow(/마지막 틱/)
    expect(fastForwardTicks(s, miniBank)).toBe(s)
    // records of un-ticked turns keep their historical shape (no `tick` key)
    const done = applyDecision(s, miniBank, 'd1_funding', ['draw_fhlb'])
    expect(done.decisions[1]).not.toHaveProperty('tick')
    expect(done.decisions[1]).not.toHaveProperty('interrupt')
  })

  it('same seed + variance reproduce identical states, tickHistory included', () => {
    const play = (variance: number, answer: boolean) => {
      let s = atT1(miniTicks, 'opt_c_silent', 42, variance)
      s = applyDecision(s, miniTicks, 'd1_funding', ['draw_fhlb'])
      s = advanceTick(s, miniTicks)
      if (answer) s = applyDecision(s, miniTicks, 'i1_partner_call', ['call_numbers'])
      return advanceTick(s, miniTicks)
    }
    const a = play(0, true)
    expect(a).toEqual(play(0, true))
    expect(a.tickHistory.map((t) => `${t.turnIndex}.${t.tick}`)).toEqual([
      '0.0',
      '1.0',
      '1.1',
      '1.2',
    ])
    expect(a.tickHistory[3]!.values.cash).toBeCloseTo(a.institution.cash, 9)

    const noisy = play(1, false)
    expect(noisy).toEqual(play(1, false))
    // variance > 0 consumes the RNG (schedule jitter + run-off noise); variance 0 never does
    expect(noisy.rng).not.toBe(a.rng)
    expect(findNonFinite(noisy)).toEqual([])
    // noise scales magnitudes only: the run-off is still within the authored cap (±30%)
    const ratio = (noisy.counters.cumulativeOutflow ?? 0) / (a.counters.cumulativeOutflow ?? 1)
    expect(ratio).toBeGreaterThan(0.7)
    expect(ratio).toBeLessThan(1.3)
  })

  it('advanceTurn from tick 0 ≡ advanceTick × (n−1) then advanceTurn', () => {
    const base = applyDecision(atT1(miniTicks, 'opt_c_silent'), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    const direct = advanceTurn(base, miniTicks)
    let stepped = base
    while (canAdvanceTick(stepped, miniTicks)) stepped = advanceTick(stepped, miniTicks)
    expect(stepped.tick).toBe(TICKS - 1)
    expect(advanceTurn(stepped, miniTicks)).toEqual(direct)
  })

  it('per-tick run-off sums exactly to the single-call result at variance 0', () => {
    const single = applyDecision(atT1(miniBank, 'opt_a_backstopped'), miniBank, 'd1_funding', [
      'draw_fhlb',
    ])
    let ticked = applyDecision(atT1(miniTicks, 'opt_a_backstopped'), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    const slices: number[] = [outflow(ticked)]
    while (canAdvanceTick(ticked, miniTicks)) {
      const before = outflow(ticked)
      ticked = advanceTick(ticked, miniTicks)
      slices.push(outflow(ticked) - before)
    }
    expect(slices).toHaveLength(TICKS)
    expect(Math.abs(outflow(ticked) - outflow(single))).toBeLessThan(1e-9)
    expect(Math.abs(slices.reduce((a, b) => a + b, 0) - outflow(single))).toBeLessThan(1e-9)
    // "당일 유출" accumulates across the window; the deposits and cash land on the same numbers
    expect(ticked.counters.lastOutflow).toBeCloseTo(single.counters.lastOutflow!, 9)
    expect(ticked.institution.cash).toBeCloseTo(single.institution.cash, 9)
    ticked.institution.deposits.forEach((d, i) => {
      expect(d.balance).toBeCloseTo(single.institution.deposits[i]!.balance, 9)
    })
    // the intraday window base is cleaned up at the last tick
    expect(ticked.institution.deposits.every((d) => d.windowBase === undefined)).toBe(true)
  })

  it('an amplifier set mid-window applies to the remaining slices and resets only on the last tick', () => {
    // the silent branch fires `e1_rumor` (×1.2 amplifier) at tick 1, after that tick's run-off
    let s = applyDecision(atT1(miniTicks, 'opt_c_silent'), miniTicks, 'd1_funding', ['draw_fhlb'])
    const ampBefore = s.counters.amplifier || 1
    const out0 = outflow(s)
    s = advanceTick(s, miniTicks)
    const slice1 = outflow(s) - out0
    // still un-reset mid-window, and now carrying the rumour's factor for the remaining slices
    expect(s.counters.amplifier).toBeCloseTo(ampBefore * 1.2, 10)
    const mid = outflow(s)
    s = advanceTick(s, miniTicks)
    const slice2 = outflow(s) - mid
    // profile is [0.5, 0.3, 0.2]; without the amplifier slice2/slice1 would be 0.2/0.3
    expect(slice2 / slice1).toBeGreaterThan(0.2 / 0.3)
    expect(s.counters.amplifier).toBe(1)
  })

  it('the deadline sweep commits stale decisions and unanswered interrupts', () => {
    let s = applyDecision(atT1(miniTicks, 'opt_a_backstopped'), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    expect(getTurnView(s, miniTicks).decisions.map((d) => d.decision.id)).toEqual(['d1_funding'])
    expect(decisionErrorCode(() => applyDecision(s, miniTicks, 'd1_desk', ['desk_report']))).toBe(
      'inactive',
    )
    expect(
      decisionErrorCode(() => applyDecision(s, miniTicks, 'i1_partner_call', ['call_defer'])),
    ).toBe('inactive')

    s = advanceTick(s, miniTicks) // tick 1: d1_desk becomes available, the call arrives
    expect(s.openInterrupts).toEqual(['i1_partner_call'])
    const view = getTurnView(s, miniTicks)
    expect(view.tick).toBe(1)
    expect(view.tickLabel).toBe('10:00')
    expect(view.decisions.map((d) => d.decision.id)).toEqual(['d1_funding', 'd1_desk'])
    expect(view.interrupts.map((d) => d.decision.id)).toEqual(['i1_partner_call'])
    expect(view.allResolved).toBe(false)

    s = advanceTick(s, miniTicks) // tick 2: both deadlines have passed
    expect(s.openInterrupts).toEqual([])
    expect(s.counters.timeouts).toBe(2)
    const desk = s.decisions.find((r) => r.decisionId === 'd1_desk')!
    expect(desk).toMatchObject({ turnIndex: 1, tick: 2, timedOut: true, optionIds: ['desk_hold'] })
    expect(desk).not.toHaveProperty('interrupt')
    const call = s.decisions.find((r) => r.decisionId === 'i1_partner_call')!
    expect(call).toMatchObject({
      turnIndex: 1,
      tick: 2,
      interrupt: true,
      timedOut: true,
      optionIds: ['call_defer'],
    })
    expect(s.counters.callDeferred).toBe(1)
    expect(s.counters.deskHeld).toBe(1)
  })

  it('an interrupt can only be answered while it is open, and is recorded with its tick', () => {
    let s = applyDecision(atT1(miniTicks, 'opt_a_backstopped'), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    s = advanceTick(s, miniTicks)
    s = applyDecision(s, miniTicks, 'i1_partner_call', ['call_numbers'])
    expect(s.openInterrupts).toEqual([])
    expect(s.counters.callNumbers).toBe(1)
    expect(s.flags.call_answered).toBe(true)
    expect(s.decisions[s.decisions.length - 1]).toMatchObject({
      decisionId: 'i1_partner_call',
      tick: 1,
      interrupt: true,
    })
    expect(s.decisions[s.decisions.length - 1]).not.toHaveProperty('timedOut')
    expect(
      decisionErrorCode(() => applyDecision(s, miniTicks, 'i1_partner_call', ['call_defer'])),
    ).toBe('inactive')
    // answered before the deadline ⇒ the sweep leaves it alone
    s = advanceTick(s, miniTicks)
    expect(s.counters.timeouts).toBe(1)
  })

  it('replay reproduces a ticked run, interrupt records included', () => {
    let live = applyDecision(atT1(miniTicks, 'opt_c_silent'), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    live = advanceTick(live, miniTicks)
    live = applyDecision(live, miniTicks, 'd1_desk', ['desk_report'])
    live = applyDecision(live, miniTicks, 'i1_partner_call', ['call_numbers'])
    live = advanceTick(live, miniTicks)

    const r = replay(miniTicks, {
      seed: 1,
      decisions: live.decisions,
      turnIndex: live.turnIndex,
      tick: live.tick,
    })
    expect(r.state).toEqual(live)
    expect(r.state.tickHistory).toEqual(live.tickHistory)
    expect(r.history).toHaveLength(2)

    // without an explicit tick a replay lands on the turn's last tick (= "end of turn")
    const toEnd = replay(miniTicks, { seed: 1, decisions: live.decisions, turnIndex: 1 })
    expect(toEnd.state.tick).toBe(TICKS - 1)
    expect(toEnd.state).toEqual(live)
    // a timed-out record replays through the sweep without a double commit
    const swept = advanceTick(
      advanceTick(
        applyDecision(atT1(miniTicks, 'opt_c_silent'), miniTicks, 'd1_funding', ['draw_fhlb']),
        miniTicks,
      ),
      miniTicks,
    )
    expect(replay(miniTicks, { seed: 1, decisions: swept.decisions, turnIndex: 1 }).state).toEqual(
      swept,
    )
  })

  it('tickHistory is capped at 240 samples', () => {
    const s = advanceTurn(
      applyDecision(atT1(miniManyTicks, 'opt_a_backstopped'), miniManyTicks, 'd1_funding', [
        'draw_fhlb',
      ]),
      miniManyTicks,
    )
    expect(TICK_HISTORY_CAP).toBe(240)
    expect(s.tickHistory.length).toBeLessThanOrEqual(TICK_HISTORY_CAP)
    expect(s.tickHistory.length).toBe(TICK_HISTORY_CAP)
    // the oldest samples are dropped, the newest kept
    expect(s.tickHistory[s.tickHistory.length - 1]).toMatchObject({ turnIndex: 2, tick: 0 })
  })

  it('variance 0 never draws from the RNG, with or without ticks', () => {
    const seed = 9
    const plain = applyDecision(atT1(miniBank, 'opt_c_silent', seed), miniBank, 'd1_funding', [
      'draw_fhlb',
    ])
    let ticked = applyDecision(atT1(miniTicks, 'opt_c_silent', seed), miniTicks, 'd1_funding', [
      'draw_fhlb',
    ])
    ticked = fastForwardTicks(ticked, miniTicks)
    expect(plain.rng).toBe(seedToState(seed))
    expect(ticked.rng).toBe(seedToState(seed))
    expect(ticked.variance).toBe(0)
    expect(createGame(miniTicks, seed, { variance: 1 }).variance).toBe(1)
  })

  it('autoplay plays ticked turns without a UI clock and stays fast on SVB', () => {
    const hist = autoplayTicked('historical')
    expect(hist.state.phase).toBe('ended')
    expect(hist.state.decisions.some((d) => d.decisionId === 'i1_partner_call')).toBe(true)
    const called = hist.state.decisions.find((d) => d.decisionId === 'i1_partner_call')!
    expect(called.optionIds).toEqual(['call_defer'])
    expect(called.interrupt).toBe(true)
    expect(
      autoplayTicked('expert').state.decisions.find((d) => d.decisionId === 'i1_partner_call')
        ?.optionIds,
    ).toEqual(['call_numbers'])

    autoplay(svb, 'expert', { seed: 1 }) // warm-up (module init + JIT)
    const t0 = Date.now()
    const r = autoplay(svb, 'expert', { seed: 1 })
    const elapsed = Date.now() - t0
    expect(r.state.phase).toBe('ended')
    expect(elapsed).toBeLessThan(300)
  })

  it('the engine reel matches the UI ReelStep contract and follows CHANNEL_ORDER', () => {
    let s = applyDecision(atT1(miniTicks, 'opt_c_silent'), miniTicks, 'd1_funding', ['draw_fhlb'])
    s = advanceTick(s, miniTicks)
    const tickReel = s.lastReel!
    expect(tickReel.cause).toEqual({ kind: 'tick' })
    expect(tickReel.turnIndex).toBe(1)
    expect(tickReel.tick).toBe(1)
    // the arriving call is announced as a counterparty reaction
    expect(
      tickReel.steps.some((x) => x.kind === 'reaction' && x.text.includes('파운더스 파트너')),
    ).toBe(true)

    s = applyDecision(s, miniTicks, 'd1_desk', ['desk_report'])
    const reel: ConsequenceReel = s.lastReel!
    expect(reel.cause).toEqual({
      kind: 'decision',
      decisionId: 'd1_desk',
      optionIds: ['desk_report'],
    })
    const consequence = reel.steps.find((x) => x.kind === 'consequence')
    expect(consequence?.kind).toBe('consequence')
    if (consequence?.kind !== 'consequence') throw new Error('no consequence step')
    expect(consequence.items.map((i) => i.title)).toEqual([
      '유출 현황을 채널별로 즉시 공유',
      '시장 반응',
      '감독당국 문의',
      '언론 문의',
    ])
    expect(CHANNEL_ORDER).toEqual([
      'result',
      'market',
      'depositors',
      'regulator',
      'board',
      'press',
      'internal',
    ])
    // beats are re-spaced at the UI cadence and the union is assignable to the UI's own type
    const uiSteps: UiReelStep[] = reel.steps
    expect(uiSteps.map((x) => x.delayMs)).toEqual(uiSteps.map((_, i) => i * 800))
  })
})

describe('an interrupt that opens on the last tick', () => {
  /** Same fixture, but the phone rings at the final tick — where no later tick can sweep it. */
  const lastTick: ScenarioDefinition<BankState> = {
    ...miniTicks,
    meta: { ...miniTicks.meta, id: 'mini-ticks-last' },
    turns: miniTicks.turns.map((t, i) =>
      i === TICKED_TURN_INDEX
        ? {
            ...t,
            interrupts: (t.interrupts ?? []).map((it) => ({
              ...it,
              atTick: TICKS - 1,
              jitter: 0,
              deadlineTick: undefined,
            })),
          }
        : t,
    ),
  }

  it('is flagged by the lint, because the per-tick sweep can never reach it', () => {
    const issues = validateScenario(lastTick).filter((x) => x.rule === 'interrupt-last-tick')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]!.level).toBe('warning')
  })

  it('still commits its default when the turn is closed, so the turn can resolve', () => {
    let s = createGame(lastTick, 1)
    s = applyDecision(s, lastTick, 'd0_disclosure', ['opt_a_backstopped'])
    s = advanceTurn(s, lastTick)
    expect(s.turnIndex).toBe(TICKED_TURN_INDEX)

    // Walk to the final tick by hand: the interrupt opens and nothing sweeps it.
    let atEnd = s
    while (canAdvanceTick(atEnd, lastTick)) atEnd = advanceTick(atEnd, lastTick)
    expect(atEnd.tick).toBe(TICKS - 1)

    // Closing the day answers it with the authored default, recorded as a timeout.
    const closed = fastForwardTicks(atEnd, lastTick)
    expect(closed.openInterrupts).toEqual([])
    const record = closed.decisions.find((d) => d.decisionId === 'i1_partner_call')
    expect(record?.optionIds).toEqual(['call_defer'])
    expect(record?.timedOut).toBe(true)
  })
})
