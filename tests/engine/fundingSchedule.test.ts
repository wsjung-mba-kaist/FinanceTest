import { describe, expect, it } from 'vitest'
import { advanceTick, applyDecision, autoplay, replay, type GameState } from '@/engine'
import { buildFundingSchedule } from '@/lib/fundingSchedule'
import { validateFundingPlan } from '@/engine/validate/fundingPlan'
import svb from '@/scenarios/svb-2023/scenario'
import { decisionRecordSchema } from '@/persistence/schema'
import { asGeneric } from '../helpers/scenario'

const scenario = asGeneric(svb)
const historical = autoplay(scenario, 'historical', { seed: 3, variance: 0 })
function at(turnIndex: number, tick = 0) {
  return replay(scenario, {
    seed: 3,
    variance: 0,
    turnIndex,
    tick,
    decisions: historical.decisions.filter(
      (d) => d.turnIndex < turnIndex || (d.turnIndex === turnIndex && (d.tick ?? 0) < tick),
    ),
  }).state
}

describe('SVB operational funding schedule', () => {
  it.each([3, 4])(
    'matches the engine for remaining T%s slices when current conditions stay fixed',
    (turnIndex) => {
      const state = at(turnIndex)
      const view = buildFundingSchedule(state, scenario)!
      expect(view.projection!.rows.map((r) => r.tick)).toEqual([1, 2, 3, 4])
      // Isolate runoff: the estimate explicitly excludes subsequent choices, news, and pending effects.
      const frozen = {
        ...scenario,
        gameOver: [],
        turns: scenario.turns.map((t, i) =>
          i === turnIndex
            ? {
                ...t,
                decisions: [],
                interrupts: [],
                events: [],
                tickEffects: [],
                ticker: undefined,
              }
            : t,
        ),
      }
      let actual: GameState = { ...state, variance: 0, pending: [], openInterrupts: [] }
      for (const row of view.projection!.rows) {
        const before = actual.institution.kind === 'bank' ? actual.institution.cash : NaN
        actual = advanceTick(actual, frozen)
        expect(actual.institution.kind).toBe('bank')
        if (actual.institution.kind !== 'bank') throw new Error('bank expected')
        expect(row.estimatedCash).toBeCloseTo(actual.institution.cash, 10)
        expect(row.estimatedPayment).toBeCloseTo(before - actual.institution.cash, 10)
      }
      expect(view.cash - view.projection!.remainingPayments).toBeCloseTo(
        view.projection!.closingCash,
        10,
      )
    },
  )

  it('keeps capacity out of cash until a draw decision is committed', () => {
    const state = at(3)
    if (state.institution.kind !== 'bank') throw new Error('bank expected')
    const unfunded = {
      ...state,
      institution: {
        ...state.institution,
        cash: -1,
        wholesale: {
          ...state.institution.wholesale,
          cbFacilityCapacity: 100,
          cbFacilityPending: 60,
        },
      },
    }
    const before = buildFundingSchedule(unfunded, scenario)!
    expect(before.cash).toBe(-1)
    expect(before.projection!.firstShortfall).toBe('현재')
    expect(before.projection!.closingCash).toBeLessThan(-1)
    expect(before.pendingAt).toContain('3월 10일')
    expect(before.pendingAt).toContain('05:00')
    const drawn = applyDecision(unfunded, scenario, 't3-d1', ['t3-a'])
    const after = buildFundingSchedule(drawn, scenario)!
    expect(after.cash - before.cash).toBe(10)
    expect(after.undrawn).toBe(90)
    expect(after.pending).toBe(60)
    expect(after.projection!.closingCash - before.projection!.closingCash).toBeCloseTo(10, 10)
  })

  it('neither consumes RNG nor reveals future effects, and reproduces after JSON replay', () => {
    const run = autoplay(scenario, 'historical', { seed: 3, variance: 1 })
    const log = {
      seed: 3,
      variance: 1,
      turnIndex: 4,
      tick: 1,
      decisions: run.decisions.filter(
        (d) => d.turnIndex < 4 || (d.turnIndex === 4 && (d.tick ?? 0) < 1),
      ),
    }
    const state = replay(scenario, log).state
    const original = JSON.stringify(state)
    const view = buildFundingSchedule(state, scenario)
    expect(JSON.stringify(state)).toBe(original)
    const futureChanged = {
      ...scenario,
      turns: scenario.turns.map((t, i) =>
        i > 4 ? { ...t, events: [], decisions: [], entryEffects: [] } : t,
      ),
    }
    expect(buildFundingSchedule(state, futureChanged)).toEqual(view)
    const restored = replay(scenario, {
      ...log,
      decisions: decisionRecordSchema.array().parse(JSON.parse(JSON.stringify(log.decisions))),
    }).state
    expect(buildFundingSchedule(restored, scenario)).toEqual(view)
  })

  it('shows the pre-overnight closing record separately from current cash', () => {
    const state = at(5, 1)
    const before = buildFundingSchedule(state, scenario)!
    expect(before.projection).toBeUndefined()
    expect(before.checkpoints[0]!.reached).toBe(true)
    const changed = {
      ...state,
      institution:
        state.institution.kind === 'bank'
          ? {
              ...state.institution,
              cash: state.institution.cash + 60,
            }
          : state.institution,
    }
    const after = buildFundingSchedule(changed, scenario)!
    expect(after.cash - before.cash).toBe(60)
    expect(after.checkpoints[0]!.recordedCash).toBe(before.checkpoints[0]!.recordedCash)
    expect(after.checkpoints[0]!.recordedCash).toBe(
      state.tickHistory.find((s) => s.turnIndex === 4 && s.tick === 4)!.values.cash,
    )
  })

  it('distinguishes unavailable windows and missing records from zero, and gates checkpoints by time', () => {
    expect(buildFundingSchedule(at(0), scenario)!.checkpoints).toEqual([])
    expect(buildFundingSchedule(at(0), scenario)!.projection).toBeUndefined()
    expect(buildFundingSchedule(at(4, 4), scenario)!.projection!.rows).toEqual([])
    expect(
      buildFundingSchedule({ ...at(5), tickHistory: [] }, scenario)!.checkpoints[0]!.recordedCash,
    ).toBeUndefined()
    expect(buildFundingSchedule(at(4), { ...scenario, fundingPlan: undefined })).toBeUndefined()
  })

  it('validates the actual runoff and capacity processing references, dates and provenance', () => {
    const sources = new Set(scenario.meta.sources.map((s) => s.id))
    expect(validateFundingPlan(scenario, sources)).toEqual([])
    const plan = scenario.fundingPlan!
    const invalid = {
      ...scenario,
      fundingPlan: {
        ...plan,
        windows: [{ ...plan.windows[0]!, effectId: 'missing', sourceRefs: ['unknown'] }],
        pendingCapacity: { ...plan.pendingCapacity, at: { turnId: 't4', tick: 0 } },
        checkpoints: [{ ...plan.checkpoints[0]!, knownFrom: { turnId: 't8', tick: 0 } }],
      },
    }
    const issues = validateFundingPlan(invalid, sources)
    expect(issues.some((i) => i.where.includes('windows'))).toBe(true)
    expect(issues.some((i) => i.where.includes('pendingCapacity'))).toBe(true)
    expect(issues.some((i) => i.where.includes('checkpoints'))).toBe(true)
    expect(issues.some((i) => i.message.includes('출처'))).toBe(true)
  })
})
