import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  autoplay,
  computeScore,
  createGame,
  decisionRegrets,
  evalCurve,
  gradeFor,
  replay,
  SCORE_DIMENSIONS,
  type Curve,
  type Policy,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'
import { findNonFinite } from '../helpers/scan'
import { asGeneric, drive, type Step } from '../helpers/scenario'

const HISTORICAL: Record<number, Step[]> = {
  0: [{ decision: 'd0_disclosure', options: ['opt_b_unbackstopped'] }],
  1: [
    {
      decision: 'd1_funding',
      options: ['draw_fhlb', 'sell_afs'],
      meta: { elapsedMs: 1234, hintsUsed: 1 },
    },
  ],
  2: [{ decision: 'd2_comms', options: ['ceo_calm_call'], meta: { timedOut: true, memo: '메모' } }],
  3: [{ decision: 'd3_weekend', options: ['reject_help'] }],
}

describe('replay', () => {
  it('rebuilds a live run from seed + decision log (including meta and an RNG-consuming option)', () => {
    const live = drive(miniBank, 11, HISTORICAL, { stopBeforeEnd: true })
    const pre = live.state
    expect(pre.phase).toBe('deciding')
    expect(pre.turnIndex).toBe(3)
    expect(pre.counters.boardRoll).toBeDefined()

    const r = replay(miniBank, { seed: 11, decisions: pre.decisions, turnIndex: pre.turnIndex })
    expect(r.state).toEqual(pre)
    expect(advanceTurn(r.state, miniBank)).toEqual(advanceTurn(pre, miniBank))
  })

  it('history holds one snapshot per turn start', () => {
    const live = drive(miniBank, 11, HISTORICAL, { stopBeforeEnd: true })
    const r = replay(miniBank, { seed: 11, decisions: live.state.decisions, turnIndex: 3 })
    expect(r.history).toHaveLength(miniBank.turns.length)
    r.history.forEach((h, i) => {
      expect(h.turnIndex).toBe(i)
      expect(h.phase).toBe('deciding')
      // start-of-turn: no decision has been recorded for the turn itself yet
      expect(h.decisions.filter((d) => d.turnIndex === i)).toEqual([])
      expect(h.metricsHistory).toHaveLength(i + 1)
    })
    expect(r.history[0]).toEqual(createGame(miniBank, 11))
    expect(r.history).toEqual(live.turnStarts)
  })

  it('a partial log stops at the requested turn; omitting turnIndex stops at the last decision turn', () => {
    const firstOnly = replay(miniBank, {
      seed: 1,
      decisions: [{ turnIndex: 0, decisionId: 'd0_disclosure', optionIds: ['opt_a_backstopped'] }],
      turnIndex: 1,
    })
    expect(firstOnly.state.turnIndex).toBe(1)
    expect(firstOnly.state.decisions).toHaveLength(1)
    expect(firstOnly.history).toHaveLength(2)

    const noTarget = replay(miniBank, {
      seed: 1,
      decisions: [{ turnIndex: 0, decisionId: 'd0_disclosure', optionIds: ['opt_a_backstopped'] }],
    })
    expect(noTarget.state.turnIndex).toBe(0)
    expect(noTarget.history).toHaveLength(1)
  })

  it('reproduces a run that ended early through a game-over rule', () => {
    const worst = autoplay(miniBank, 'worst')
    expect(worst.state.ended?.reason).toBe('lcr')
    const r = replay(miniBank, {
      seed: 1,
      decisions: worst.decisions,
      turnIndex: worst.state.turnIndex,
    })
    expect(r.state).toEqual(worst.state)
    expect(r.state.phase).toBe('ended')
    expect(r.history).toHaveLength(worst.state.turnIndex + 1)
  })
})

describe('autoplay', () => {
  const runs: [label: string, policy: Policy, rngSeed: number][] = [
    ['historical', 'historical', 7],
    ['expert', 'expert', 7],
    ['worst', 'worst', 7],
    ['random#1', 'random', 1],
    ['random#2', 'random', 2],
    ['random#3', 'random', 3],
  ]

  it.each(runs)('%s completes with a finite, ended state', (_label, policy, rngSeed) => {
    const r = autoplay(miniBank, policy, { seed: 1, rngSeed })
    expect(r.state.phase).toBe('ended')
    expect(r.state.ended).toBeDefined()
    expect(findNonFinite(r.state)).toEqual([])
    expect(r.history[0]!.turnIndex).toBe(0)
    expect(r.history[r.history.length - 1]).toBe(r.state)
    expect(r.decisions).toBe(r.state.decisions)
    expect(r.decisions.length).toBeGreaterThan(0)
    for (const h of r.history) expect(findNonFinite(h)).toEqual([])
  })

  it('historical and expert policies honour their paths without deviations', () => {
    const hist = autoplay(miniBank, 'historical')
    expect(hist.deviations).toEqual([])
    expect(hist.decisions.map((d) => d.optionIds)).toEqual([
      ['opt_b_unbackstopped'],
      ['draw_fhlb', 'sell_afs'],
      ['ceo_calm_call'],
      ['reject_help'],
    ])
    expect(hist.state.ended?.failed).toBe(false)

    const expert = autoplay(miniBank, 'expert')
    expect(expert.deviations).toEqual([])
    expect(expert.decisions.map((d) => d.optionIds)).toEqual([
      ['opt_a_backstopped'],
      ['draw_fhlb', 'seek_guarantee'],
      ['accept_consortium'],
    ])
    expect(expert.state.ended).toMatchObject({
      reason: 'completed',
      title: '신뢰 회복',
      failed: false,
    })
  })

  it('the worst policy walks into the game-over rule', () => {
    const worst = autoplay(miniBank, 'worst')
    expect(worst.state.ended).toMatchObject({ reason: 'lcr', failed: true })
    expect(worst.decisions.map((d) => d.optionIds)).toEqual([
      ['opt_b_unbackstopped'],
      ['sell_htm'],
      ['ceo_calm_call'],
    ])
  })

  it('random policy is reproducible per rngSeed and differs across seeds', () => {
    const a = autoplay(miniBank, 'random', { rngSeed: 1 })
    const b = autoplay(miniBank, 'random', { rngSeed: 1 })
    expect(a.state).toEqual(b.state)
    const picks = [1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(
        autoplay(miniBank, 'random', { rngSeed: s }).decisions.map((d) => d.optionIds),
      ),
    )
    expect(new Set(picks).size).toBeGreaterThan(1)
  })

  it('expert total ≥ historical total', () => {
    const hist = computeScore(autoplay(miniBank, 'historical').state, miniBank)
    const expert = computeScore(autoplay(miniBank, 'expert').state, miniBank)
    expect(expert.total).toBeGreaterThanOrEqual(hist.total)
    expect(expert.expertAlignment).toBeGreaterThan(hist.expertAlignment)
  })
})

describe('computeScore', () => {
  it.each(['historical', 'expert', 'worst', 'random'] as Policy[])(
    '%s: total ∈ [0,100], 7 dimensions, grade consistent with gradeFor',
    (policy) => {
      const state = autoplay(miniBank, policy).state
      const report = computeScore(state, miniBank)
      expect(report.total).toBeGreaterThanOrEqual(0)
      expect(report.total).toBeLessThanOrEqual(100)
      expect(Object.keys(report.dimensions).sort()).toEqual([...SCORE_DIMENSIONS].sort())
      for (const dim of SCORE_DIMENSIONS) {
        const d = report.dimensions[dim]
        expect(d.score).toBeGreaterThanOrEqual(0)
        expect(d.score).toBeLessThanOrEqual(100)
        expect(d.weight).toBe(miniBank.scoring.weights[dim])
        expect(Array.isArray(d.explanation)).toBe(true)
      }
      expect(report.grade).toBe(gradeFor(report.total))
      expect(report.expertAlignment).toBeGreaterThanOrEqual(0)
      expect(report.expertAlignment).toBeLessThanOrEqual(100)
      expect(report.ended).toEqual({
        failed: state.ended!.failed,
        orderly: state.ended!.orderly,
        reason: state.ended!.reason,
      })
      // weighted sum of dimension scores reproduces the total (before hint penalty / failure cap)
      const weighted = SCORE_DIMENSIONS.reduce(
        (a, dim) => a + (report.dimensions[dim].weight * report.dimensions[dim].score) / 100,
        0,
      )
      if (!state.ended?.failed) expect(report.total).toBeCloseTo(weighted, 1)
      else expect(report.total).toBeLessThanOrEqual(miniBank.scoring.failureCap!)
    },
  )

  it('every scoring component kind produces an explanation line', () => {
    const report = computeScore(autoplay(miniBank, 'expert').state, miniBank)
    expect(report.dimensions.liquidity.explanation.some((e) => e.includes('생존'))).toBe(true)
    expect(report.dimensions.liquidity.explanation.some((e) => e.includes('최저 생존 일수'))).toBe(
      true,
    )
    expect(report.dimensions.compliance.explanation.some((e) => e.includes('시간 초과'))).toBe(true)
    expect(report.dimensions.policy.explanation.some((e) => e.includes('옵션 보정'))).toBe(true)
    expect(report.dimensions.timeliness.explanation.some((e) => e.includes('T1에 달성'))).toBe(true)
    expect(report.dimensions.solvency.explanation.length).toBeGreaterThan(0)
  })

  it('gradeFor boundaries', () => {
    expect(gradeFor(100)).toBe('S')
    expect(gradeFor(90)).toBe('S')
    expect(gradeFor(89.99)).toBe('A')
    expect(gradeFor(80)).toBe('A')
    expect(gradeFor(79.99)).toBe('B')
    expect(gradeFor(70)).toBe('B')
    expect(gradeFor(60)).toBe('C')
    expect(gradeFor(50)).toBe('D')
    expect(gradeFor(49.99)).toBe('F')
    expect(gradeFor(0)).toBe('F')
  })
})

describe('evalCurve', () => {
  const curve: Curve = [
    [0, 0],
    [1, 40],
    [3, 80],
    [5, 100],
  ]

  it('interpolates linearly between points', () => {
    expect(evalCurve(curve, 0.5)).toBeCloseTo(20, 10)
    expect(evalCurve(curve, 2)).toBeCloseTo(60, 10)
    expect(evalCurve(curve, 4)).toBeCloseTo(90, 10)
    expect(evalCurve(curve, 1)).toBe(40)
    expect(evalCurve(curve, 3)).toBe(80)
  })

  it('clamps outside the x-range to the end values', () => {
    expect(evalCurve(curve, -10)).toBe(0)
    expect(evalCurve(curve, 0)).toBe(0)
    expect(evalCurve(curve, 5)).toBe(100)
    expect(evalCurve(curve, 99)).toBe(100)
  })

  it('handles unsorted input, descending curves, out-of-range scores, duplicates and empty curves', () => {
    const shuffled: Curve = [
      [3, 80],
      [0, 0],
      [5, 100],
      [1, 40],
    ]
    expect(evalCurve(shuffled, 2)).toBeCloseTo(60, 10)
    const descending: Curve = [
      [0, 100],
      [4, 0],
    ]
    expect(evalCurve(descending, 1)).toBeCloseTo(75, 10)
    expect(evalCurve(descending, 10)).toBe(0)
    const overflow: Curve = [
      [0, -50],
      [1, 150],
    ]
    expect(evalCurve(overflow, -1)).toBe(0)
    expect(evalCurve(overflow, 2)).toBe(100)
    expect(evalCurve(overflow, 0.5)).toBeCloseTo(50, 10)
    const dup: Curve = [
      [1, 10],
      [1, 90],
    ]
    expect(evalCurve(dup, 1)).toBeGreaterThanOrEqual(0)
    expect(evalCurve(dup, 1)).toBeLessThanOrEqual(100)
    expect(evalCurve([], 3)).toBe(0)
    expect(evalCurve([[2, 55]], 1)).toBe(55)
    expect(evalCurve([[2, 55]], 3)).toBe(55)
  })
})

describe('decisionRegrets', () => {
  it('computes best-minus-chosen per decision and sorts descending', () => {
    const hist = autoplay(miniBank, 'historical').state
    const regrets = decisionRegrets(hist, asGeneric(miniBank))
    expect(regrets.map((r) => r.decisionId)).toEqual([
      'd0_disclosure',
      'd3_weekend',
      'd2_comms',
      'd1_funding',
    ])
    expect(regrets.map((r) => r.regret)).toEqual([70, 50, 45, 10])
    expect(regrets[0]).toEqual({
      decisionId: 'd0_disclosure',
      turnIndex: 0,
      chosen: ['opt_b_unbackstopped'],
      best: 'opt_a_backstopped',
      regret: 70,
    })
    for (let i = 1; i < regrets.length; i++)
      expect(regrets[i]!.regret).toBeLessThanOrEqual(regrets[i - 1]!.regret)

    const expert = decisionRegrets(autoplay(miniBank, 'expert').state, asGeneric(miniBank))
    expect(expert.map((r) => r.decisionId)).toEqual(['d1_funding', 'd0_disclosure', 'd3_weekend'])
    expect(expert.map((r) => r.regret)).toEqual([2.5, 0, 0])
    expect(decisionRegrets(createGame(miniBank, 1), asGeneric(miniBank))).toEqual([])
  })
})
