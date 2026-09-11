import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import {
  activeDecisions,
  advanceTurn,
  applyDecision,
  applyGameOver,
  checkGameOver,
  computeScore,
  createGame,
  DecisionError,
  getTurnView,
  isLastTurn,
  pickEnding,
  snapshotMetrics,
  unresolvedRequiredDecisions,
  validateSelection,
  type GameState,
  type MetricValue,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'
import {
  asGeneric,
  decisionErrorCode,
  drive,
  withInitialConfidence,
  type Step,
} from '../helpers/scenario'

const t0 = (option: string): Step[] => [{ decision: 'd0_disclosure', options: [option] }]
const t1 = (...options: string[]): Step[] => [{ decision: 'd1_funding', options }]

const depositTotal = (s: GameState) =>
  s.institution.kind === 'bank' ? s.institution.deposits.reduce((a, d) => a + d.balance, 0) : NaN

describe('startTurn pipeline', () => {
  it('delayed effect is queued on commit, fires at the due turn and honours its `when` (fires when flag absent)', () => {
    const s0 = createGame(miniBank, 1)
    const afterD0 = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_b_unbackstopped'])
    expect(afterD0.pending).toHaveLength(1)
    expect(afterD0.pending[0]).toMatchObject({
      dueTurn: 2,
      ref: { decisionId: 'd0_disclosure', optionId: 'opt_b_unbackstopped', index: 0 },
    })

    const atT1 = advanceTurn(afterD0, miniBank)
    expect(atT1.turnIndex).toBe(1)
    expect(atT1.pending).toHaveLength(1)
    expect(atT1.feed.filter((f) => f.kind === 'delayed')).toHaveLength(0)

    const ciBefore = atT1.confidence.index
    const atT2 = advanceTurn(applyDecision(atT1, miniBank, 'd1_funding', ['draw_fhlb']), miniBank)
    expect(atT2.turnIndex).toBe(2)
    expect(atT2.pending).toHaveLength(0)
    const delayed = atT2.feed.filter((f) => f.kind === 'delayed')
    expect(delayed).toHaveLength(1)
    expect(delayed[0]).toMatchObject({
      turnIndex: 2,
      cause: { decisionId: 'd0_disclosure', optionId: 'opt_b_unbackstopped' },
    })
    // the delayed batch also emitted its own feed item
    expect(atT2.feed.some((f) => f.title === '신용등급 강등' && f.turnIndex === 2)).toBe(true)
    // −10 (delayed downgrade) −5 (T2 newswire)
    expect(atT2.confidence.index).toBe(ciBefore - 15)
    expect(atT2.log.some((l) => l.includes('1노치 강등'))).toBe(true)
  })

  it('delayed effect is skipped when its `when` is false at fire time (flag set at T1)', () => {
    const s0 = createGame(miniBank, 1)
    const atT1 = advanceTurn(
      applyDecision(s0, miniBank, 'd0_disclosure', ['opt_b_unbackstopped']),
      miniBank,
    )
    const guaranteed = applyDecision(atT1, miniBank, 'd1_funding', ['seek_guarantee'])
    expect(guaranteed.flags.guarantee).toBe(true)
    expect(guaranteed.flagTurns.guarantee).toBe(1)
    const ciBefore = guaranteed.confidence.index
    const atT2 = advanceTurn(guaranteed, miniBank)
    expect(atT2.pending).toHaveLength(0)
    expect(atT2.feed.filter((f) => f.kind === 'delayed')).toHaveLength(0)
    expect(atT2.feed.some((f) => f.title === '신용등급 강등')).toBe(false)
    expect(atT2.log.some((l) => l.includes('지연 효과 조건 미충족'))).toBe(true)
    // only the T2 newswire (−5) applied
    expect(atT2.confidence.index).toBe(ciBefore - 5)
  })

  it('entry effects apply at turn start (settlement before run-off; conditional entry effects honour `when`)', () => {
    const s0 = createGame(miniBank, 1)
    // opt_c pledges 5 immediate + 10 pending; pending must settle at T1 before the run-off
    const afterC = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_c_silent'])
    expect(afterC.institution.wholesale.cbFacilityCapacity).toBe(15)
    expect(afterC.institution.wholesale.cbFacilityPending).toBe(10)
    const atT1 = advanceTurn(afterC, miniBank)
    expect(atT1.institution.wholesale.cbFacilityPending).toBe(0)
    expect(atT1.institution.wholesale.cbFacilityCapacity).toBe(25)
    expect(atT1.counters.cumulativeOutflow).toBeGreaterThan(0)
    expect(atT1.counters.lastOutflow).toBeCloseTo(atT1.counters.cumulativeOutflow!, 10)
    expect(depositTotal(atT1)).toBeLessThan(depositTotal(afterC))
    expect(atT1.institution.cash).toBeCloseTo(
      afterC.institution.cash - atT1.counters.lastOutflow!,
      10,
    )
    expect(atT1.log.some((l) => l.includes('외생: 담보 이전 완료'))).toBe(true)
    expect(atT1.log.some((l) => l.includes('외생: 1일차 예금 유출'))).toBe(true)

    // T2 peer amplifier only without the guarantee flag
    const noGuarantee = advanceTurn(
      applyDecision(atT1, miniBank, 'd1_funding', ['draw_fhlb']),
      miniBank,
    )
    expect(noGuarantee.log.some((l) => l.includes('외생: 피어 실패 증폭'))).toBe(true)
    const withGuarantee = advanceTurn(
      applyDecision(atT1, miniBank, 'd1_funding', ['seek_guarantee']),
      miniBank,
    )
    expect(withGuarantee.log.some((l) => l.includes('외생: 피어 실패 증폭'))).toBe(false)
  })

  it('event effects apply only when the event `when` holds, and hidden events are not in the view', () => {
    const s0 = createGame(miniBank, 1)
    const quiet = advanceTurn(
      applyDecision(s0, miniBank, 'd0_disclosure', ['opt_a_backstopped']),
      miniBank,
    )
    const quietView = getTurnView(quiet, miniBank)
    expect(quietView.events.map((e) => e.id)).not.toContain('e1_rumor')
    expect(quiet.regulator.level).toBe(0)
    expect(quiet.counters.amplifier ?? 1).toBe(1)
    expect(quiet.log.some((l) => l.includes('SNS 바이럴'))).toBe(false)

    const silent = advanceTurn(
      applyDecision(s0, miniBank, 'd0_disclosure', ['opt_c_silent']),
      miniBank,
    )
    const silentView = getTurnView(silent, miniBank)
    expect(silentView.events.map((e) => e.id)).toContain('e1_rumor')
    expect(silent.regulator.level).toBe(1)
    expect(silent.regulator.notes[0]).toContain('R0→R1')
    expect(silent.counters.amplifier).toBeCloseTo(1.2, 10)
    expect(silent.log.some((l) => l.includes('SNS 바이럴'))).toBe(true)
  })

  it('advanceTurn throws while a required decision is unresolved', () => {
    const s0 = createGame(miniBank, 1)
    expect(unresolvedRequiredDecisions(s0, miniBank).map((d) => d.id)).toEqual(['d0_disclosure'])
    expect(() => advanceTurn(s0, miniBank)).toThrow(/미확정 결정.*d0_disclosure/)
    const resolved = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_a_backstopped'])
    expect(unresolvedRequiredDecisions(resolved, miniBank)).toEqual([])
    expect(advanceTurn(resolved, miniBank).turnIndex).toBe(1)
  })

  it('advancing past the last turn ends the game with the matching ending', () => {
    const { state: pre } = drive(
      miniBank,
      1,
      {
        0: t0('opt_a_backstopped'),
        1: t1('draw_fhlb', 'seek_guarantee'),
        3: [{ decision: 'd3_weekend', options: ['accept_consortium'] }],
      },
      { stopBeforeEnd: true },
    )
    expect(pre.phase).toBe('deciding')
    expect(pre.turnIndex).toBe(3)
    expect(isLastTurn(pre, asGeneric(miniBank))).toBe(true)
    expect(pickEnding(pre, miniBank)?.id).toBe('ending_strong')

    const ended = advanceTurn(pre, miniBank)
    expect(ended.phase).toBe('ended')
    expect(ended.turnIndex).toBe(3)
    expect(ended.ended).toMatchObject({
      reason: 'completed',
      turnIndex: 3,
      title: '신뢰 회복',
      failed: false,
    })
    const last = ended.feed[ended.feed.length - 1]!
    expect(last).toMatchObject({ kind: 'system', severity: 'positive', title: '신뢰 회복' })
    expect(ended.log[ended.log.length - 1]).toContain('ending_strong')
    expect(() => advanceTurn(ended, miniBank)).toThrow()
    expect(
      decisionErrorCode(() => applyDecision(ended, miniBank, 'd3_weekend', ['accept_consortium'])),
    ).toBe('ended')

    // A bruised run (guarantee flag but low confidence) picks the second ending; nothing matching → default ending.
    // Endings read the `confidence` metric, so the snapshot must be refreshed after editing the state.
    const bruised = snapshotMetrics(
      produce(pre, (d) => {
        d.confidence.index = 30
      }),
      miniBank,
    )
    expect(pickEnding(bruised, miniBank)?.id).toBe('ending_bruised')
    const plain = produce(bruised, (d) => {
      delete d.flags.guarantee
    })
    expect(pickEnding(plain, miniBank)?.id).toBe('ending_default')
    const endedPlain = advanceTurn(plain, miniBank)
    expect(endedPlain.ended?.title).toBe('불확실한 월요일')
  })
})

describe('game over', () => {
  const lcr = (value: number): MetricValue => ({
    key: 'lcr',
    value,
    unit: '%',
    status: value < 80 ? 'breach' : 'ok',
    label: 'LCR',
  })

  it('consecutiveTurns: 2 → one breach is not enough, two consecutive breaches trigger, a recovery in between resets', () => {
    const s0 = createGame(miniBank, 1)
    const withHistory = (values: number[]) =>
      produce(s0, (d) => {
        d.metricsHistory = values.map((v, i) => ({ turnIndex: i, metrics: { lcr: lcr(v) } }))
        d.turnIndex = values.length - 1
      })
    expect(checkGameOver(withHistory([50]), miniBank)).toBeNull()
    expect(checkGameOver(withHistory([90, 50]), miniBank)).toBeNull()
    expect(checkGameOver(withHistory([50, 50]), miniBank)?.id).toBe('go_lcr')
    expect(checkGameOver(withHistory([50, 90, 50]), miniBank)).toBeNull()
    expect(checkGameOver(withHistory([90, 50, 59.9]), miniBank)?.id).toBe('go_lcr')
    expect(checkGameOver(withHistory([50, 60]), miniBank)).toBeNull()
    // an already-ended state never re-triggers
    const endedState = produce(withHistory([50, 50]), (d) => {
      d.phase = 'ended'
    })
    expect(checkGameOver(endedState, miniBank)).toBeNull()
  })

  it('through the real pipeline: the worst path breaches LCR at T2 (still deciding) and is closed at T3 start', () => {
    const s0 = createGame(miniBank, 1)
    const atT1 = advanceTurn(
      applyDecision(s0, miniBank, 'd0_disclosure', ['opt_b_unbackstopped']),
      miniBank,
    )
    const atT2 = advanceTurn(applyDecision(atT1, miniBank, 'd1_funding', ['sell_htm']), miniBank)
    expect(atT2.phase).toBe('deciding')
    expect(atT2.metricsHistory[2]!.metrics.lcr!.value).toBeLessThan(60)
    expect(atT2.metricsHistory[1]!.metrics.lcr!.value).toBeGreaterThanOrEqual(60)

    const atT3 = advanceTurn(applyDecision(atT2, miniBank, 'd2_comms', ['ceo_calm_call']), miniBank)
    expect(atT3.phase).toBe('ended')
    expect(atT3.turnIndex).toBe(3)
    expect(atT3.ended).toMatchObject({
      reason: 'lcr',
      failed: true,
      orderly: false,
      title: '감독당국 폐쇄',
    })
    expect(atT3.metricsHistory[3]!.metrics.lcr!.value).toBeLessThan(60)
  })

  it('applyGameOver sets ended.failed, appends a gameover feed item and blocks further play', () => {
    const s0 = createGame(miniBank, 1)
    const rule = miniBank.gameOver.find((r) => r.id === 'go_lcr')!
    const over = applyGameOver(s0, rule)
    expect(over.phase).toBe('ended')
    expect(over.ended).toEqual({
      reason: 'lcr',
      turnIndex: 0,
      title: rule.title,
      narrative: rule.narrative,
      failed: true,
      orderly: false,
    })
    expect(over.feed).toHaveLength(s0.feed.length + 1)
    const item = over.feed[over.feed.length - 1]!
    expect(item).toMatchObject({
      kind: 'gameover',
      severity: 'critical',
      title: rule.title,
      turnIndex: 0,
    })
    expect(item.body).toContain(rule.ruleText)
    expect(over.log[over.log.length - 1]).toContain('게임 종료: go_lcr')
    expect(
      decisionErrorCode(() =>
        applyDecision(over, miniBank, 'd0_disclosure', ['opt_a_backstopped']),
      ),
    ).toBe('ended')
    expect(() => advanceTurn(over, miniBank)).toThrow(/종료/)
    // s0 untouched
    expect(s0.phase).toBe('deciding')
    expect(s0.ended).toBeUndefined()

    const score = computeScore(over, miniBank)
    expect(score.ended).toEqual({ failed: true, orderly: false, reason: 'lcr' })
    expect(score.total).toBeLessThanOrEqual(miniBank.scoring.failureCap!)
  })
})

describe('getTurnView', () => {
  it('hides options whose `when` is false and marks `requires` failures as unavailable with the authored reason', () => {
    // sell_bank only appears when confidence < 50
    const strong = drive(
      miniBank,
      1,
      { 0: t0('opt_a_backstopped'), 1: t1('draw_fhlb', 'seek_guarantee') },
      { stopBeforeEnd: true },
    ).state
    expect(strong.turnIndex).toBe(3)
    expect(strong.confidence.index).toBeGreaterThanOrEqual(50)
    const strongView = getTurnView(strong, miniBank)
    const strongIds = strongView.decisions
      .find((d) => d.decision.id === 'd3_weekend')!
      .options.map((o) => o.option.id)
    expect(strongIds).toEqual(['accept_consortium', 'reject_help'])

    const weak = drive(
      miniBank,
      1,
      {
        0: t0('opt_b_unbackstopped'),
        1: t1('draw_fhlb', 'sell_afs'),
        2: [{ decision: 'd2_comms', options: ['ceo_calm_call'] }],
      },
      { stopBeforeEnd: true },
    ).state
    expect(weak.turnIndex).toBe(3)
    expect(weak.confidence.index).toBeLessThan(50)
    const weakIds = getTurnView(weak, miniBank)
      .decisions.find((d) => d.decision.id === 'd3_weekend')!
      .options.map((o) => o.option.id)
    expect(weakIds).toContain('sell_bank')
    expect(
      decisionErrorCode(() => applyDecision(strong, miniBank, 'd3_weekend', ['sell_bank'])),
    ).toBe('hidden_option')

    // opt_a requires confidence ≥ 40
    const lowCi = withInitialConfidence(miniBank, 30)
    const s0 = createGame(lowCi, 1)
    const view = getTurnView(s0, lowCi)
    const d0 = view.decisions.find((d) => d.decision.id === 'd0_disclosure')!
    const optA = d0.options.find((o) => o.option.id === 'opt_a_backstopped')!
    expect(optA.available).toBe(false)
    expect(optA.reason).toBe('신뢰지수 40 미만에서는 백스톱 투자자를 구할 수 없습니다')
    expect(d0.options.filter((o) => o.available).map((o) => o.option.id)).toEqual([
      'opt_b_unbackstopped',
      'opt_c_silent',
    ])
    expect(() => applyDecision(s0, lowCi, 'd0_disclosure', ['opt_a_backstopped'])).toThrow(
      DecisionError,
    )
    expect(() => applyDecision(s0, lowCi, 'd0_disclosure', ['opt_a_backstopped'])).toThrow(
      optA.reason,
    )
    expect(
      decisionErrorCode(() => applyDecision(s0, lowCi, 'd0_disclosure', ['opt_a_backstopped'])),
    ).toBe('unavailable')

    // with normal confidence every T0 option is available
    const okView = getTurnView(createGame(miniBank, 1), miniBank)
    expect(okView.decisions[0]!.options.every((o) => o.available && o.reason === undefined)).toBe(
      true,
    )
  })

  it('hides decisions whose `when` is false (chose-gated d2) and tracks resolution state', () => {
    const s0 = createGame(miniBank, 1)
    const v0 = getTurnView(s0, miniBank)
    expect(v0.turnIndex).toBe(0)
    expect(v0.allResolved).toBe(false)
    expect(v0.decisions[0]).toMatchObject({ resolved: false, chosen: [] })
    expect(v0.events.map((e) => e.id)).toEqual(['e0_wire', 'e0_memo', 'e0_market'])
    expect(v0.feed).toEqual([])

    const s1 = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_a_backstopped'])
    const v1 = getTurnView(s1, miniBank)
    expect(v1.allResolved).toBe(true)
    expect(v1.decisions[0]).toMatchObject({ resolved: true, chosen: ['opt_a_backstopped'] })
    expect(v1.feed.map((f) => f.kind)).toContain('consequence')

    const expertT2 = drive(
      miniBank,
      1,
      { 0: t0('opt_a_backstopped'), 1: t1('draw_fhlb') },
      { stopAtTurn: 2 },
    ).state
    expect(expertT2.turnIndex).toBe(2)
    expect(activeDecisions(expertT2, miniBank)).toEqual([])
    expect(getTurnView(expertT2, miniBank).decisions).toEqual([])
    expect(getTurnView(expertT2, miniBank).allResolved).toBe(true)
    expect(
      decisionErrorCode(() => applyDecision(expertT2, miniBank, 'd2_comms', ['publish_liquidity'])),
    ).toBe('inactive')

    const histT2 = drive(
      miniBank,
      1,
      { 0: t0('opt_b_unbackstopped'), 1: t1('draw_fhlb') },
      { stopAtTurn: 2 },
    ).state
    expect(histT2.turnIndex).toBe(2)
    expect(activeDecisions(histT2, miniBank).map((d) => d.id)).toEqual(['d2_comms'])
    expect(getTurnView(histT2, miniBank).allResolved).toBe(false)
  })
})

describe('multi-select validation', () => {
  const atT1 = () =>
    advanceTurn(
      applyDecision(createGame(miniBank, 1), miniBank, 'd0_disclosure', ['opt_a_backstopped']),
      miniBank,
    )
  const code = (ids: string[]) =>
    decisionErrorCode(() => applyDecision(atT1(), miniBank, 'd1_funding', ids))

  it('enforces min/max, duplicates, unknown and exclusive groups with the right DecisionError codes', () => {
    expect(code([])).toBe('select_count')
    expect(code(['draw_fhlb', 'sell_afs', 'seek_guarantee'])).toBe('select_count')
    expect(code(['draw_fhlb', 'draw_fhlb'])).toBe('duplicate')
    expect(code(['draw_fhlb', 'nope'])).toBe('unknown_option')
    expect(code(['sell_afs', 'sell_htm'])).toBe('exclusive')
    expect(code(['draw_fhlb'])).toBeUndefined()
    expect(code(['draw_fhlb', 'sell_afs'])).toBeUndefined()
    expect(code(['sell_htm', 'seek_guarantee'])).toBeUndefined()
    expect(() => applyDecision(atT1(), miniBank, 'd1_funding', ['sell_afs', 'sell_htm'])).toThrow(
      DecisionError,
    )
  })

  it('reports unknown decisions and double commits', () => {
    const s0 = createGame(miniBank, 1)
    expect(decisionErrorCode(() => applyDecision(s0, miniBank, 'd1_funding', ['draw_fhlb']))).toBe(
      'unknown_decision',
    )
    expect(decisionErrorCode(() => applyDecision(s0, miniBank, 'nope', ['x']))).toBe(
      'unknown_decision',
    )
    const once = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_c_silent'])
    expect(
      decisionErrorCode(() => applyDecision(once, miniBank, 'd0_disclosure', ['opt_c_silent'])),
    ).toBe('already_resolved')
    // single-select decisions reject two picks
    expect(
      decisionErrorCode(() =>
        applyDecision(s0, miniBank, 'd0_disclosure', ['opt_a_backstopped', 'opt_c_silent']),
      ),
    ).toBe('select_count')
  })

  it('validateSelection returns the option objects in order; a valid multi-select applies every option', () => {
    const s = atT1()
    const decision = miniBank.turns[1]!.decisions[0]!
    const options = validateSelection(s, decision, ['seek_guarantee', 'draw_fhlb'])
    expect(options.map((o) => o.id)).toEqual(['seek_guarantee', 'draw_fhlb'])

    const next = applyDecision(s, miniBank, 'd1_funding', ['draw_fhlb', 'seek_guarantee'])
    expect(next.decisions[next.decisions.length - 1]).toMatchObject({
      turnIndex: 1,
      decisionId: 'd1_funding',
      optionIds: ['draw_fhlb', 'seek_guarantee'],
    })
    expect(next.institution.cash).toBeCloseTo(s.institution.cash + 10, 10)
    expect(next.institution.wholesale.cbFacilityCapacity).toBe(0)
    expect(next.institution.wholesale.cbAdvances).toBe(10)
    expect(next.flags.guarantee).toBe(true)
    expect(next.confidence.index).toBe(s.confidence.index + 10)
    expect(next.feed.filter((f) => f.turnIndex === 1 && f.kind === 'consequence')).toHaveLength(2)
    expect(next.counters.fundingDrawn).toBe(10)
    expect(next.counters.fundingCostBp).toBe(520)
  })
})

describe('decision meta', () => {
  it('timedOut increments counters.timeouts and is recorded; hints accumulate; score applies the timeout penalty', () => {
    const s0 = createGame(miniBank, 1)
    const timed = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_c_silent'], {
      timedOut: true,
      elapsedMs: 60_000,
      memo: '늦음',
    })
    expect(timed.counters.timeouts).toBe(1)
    expect(timed.decisions[0]).toEqual({
      turnIndex: 0,
      decisionId: 'd0_disclosure',
      optionIds: ['opt_c_silent'],
      elapsedMs: 60_000,
      timedOut: true,
      memo: '늦음',
    })

    const atT1 = advanceTurn(timed, miniBank)
    const twice = applyDecision(atT1, miniBank, 'd1_funding', ['draw_fhlb'], {
      timedOut: true,
      hintsUsed: 2,
      hintPenalty: 3,
    })
    expect(twice.counters.timeouts).toBe(2)
    expect(twice.counters.hintsUsed).toBe(2)
    expect(twice.counters.hintPenalty).toBe(3)
    expect(twice.decisions[1]).toMatchObject({ timedOut: true, hintsUsed: 2 })
    expect(twice.decisions[1]).not.toHaveProperty('memo')

    const untimed = applyDecision(atT1, miniBank, 'd1_funding', ['draw_fhlb'])
    expect(untimed.counters.timeouts).toBe(1)
    expect(untimed.decisions[1]).not.toHaveProperty('timedOut')

    const withPenalty = computeScore(twice, miniBank)
    const without = computeScore(untimed, miniBank)
    expect(withPenalty.timeoutCount).toBe(2)
    expect(withPenalty.hintPenalty).toBe(3)
    expect(withPenalty.dimensions.timeliness.score).toBeCloseTo(
      without.dimensions.timeliness.score - 10,
      10,
    )
    expect(
      withPenalty.dimensions.timeliness.explanation.some((e) => e.includes('시간 초과 2회')),
    ).toBe(true)
  })

  it('the timed decision declares a default option that exists', () => {
    const d3 = miniBank.turns[3]!.decisions.find((d) => d.id === 'd3_weekend')!
    expect(d3.timeLimitSec).toBeGreaterThan(0)
    expect(d3.options.some((o) => o.id === d3.defaultOptionId)).toBe(true)
  })
})
