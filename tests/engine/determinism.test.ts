import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  applyDecision,
  createGame,
  previewOption,
  seedToState,
  type Effect,
  type BankState,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'
import { drive, withOptionEffects, type Step } from '../helpers/scenario'

const HISTORICAL: Record<number, Step[]> = {
  0: [{ decision: 'd0_disclosure', options: ['opt_b_unbackstopped'] }],
  1: [{ decision: 'd1_funding', options: ['draw_fhlb', 'sell_afs'] }],
  2: [{ decision: 'd2_comms', options: ['ceo_calm_call'] }],
  // `reject_help` consumes one RNG draw, so this path is seed-sensitive.
  3: [{ decision: 'd3_weekend', options: ['reject_help'] }],
}

const EXPERT: Record<number, Step[]> = {
  0: [{ decision: 'd0_disclosure', options: ['opt_a_backstopped'] }],
  1: [{ decision: 'd1_funding', options: ['draw_fhlb', 'seek_guarantee'] }],
  3: [{ decision: 'd3_weekend', options: ['accept_consortium'] }],
}

const rngEffect: Effect<BankState> = {
  kind: 'fn',
  name: 'roll',
  apply: (d, ctx) => {
    d.counters.roll = ctx.rng()
  },
}

describe('determinism', () => {
  it('same seed + same decision sequence → identical states (run twice)', () => {
    const a = drive(miniBank, 42, HISTORICAL)
    const b = drive(miniBank, 42, HISTORICAL)
    expect(a.state).toEqual(b.state)
    expect(a.turnStarts).toEqual(b.turnStarts)
    expect(a.state.phase).toBe('ended')
    expect(a.state.counters.boardRoll).toBeDefined()
  })

  it('a different seed changes the RNG-dependent outcome but nothing else about the path', () => {
    const a = drive(miniBank, 1, HISTORICAL).state
    const b = drive(miniBank, 2, HISTORICAL).state
    expect(a.decisions).toEqual(b.decisions)
    expect(a.seed).not.toBe(b.seed)
    expect(a.rng).not.toBe(b.rng)
    // The path without RNG use is seed-independent apart from the seed/rng bookkeeping fields.
    const x = drive(miniBank, 1, EXPERT).state
    const y = drive(miniBank, 2, EXPERT).state
    expect(x.rng).toBe(seedToState(1))
    expect(y.rng).toBe(seedToState(2))
    expect({ ...x, seed: 0, rng: 0 }).toEqual({ ...y, seed: 0, rng: 0 })
  })

  it('createGame seeds the RNG state from the seed and starts at T0 deciding', () => {
    const s = createGame(miniBank, 7)
    expect(s.seed).toBe(7)
    expect(s.rng).toBe(seedToState(7))
    expect(s.turnIndex).toBe(0)
    expect(s.phase).toBe('deciding')
    expect(s.metricsHistory).toHaveLength(1)
    expect(s.metricsHistory[0]!.turnIndex).toBe(0)
  })

  it('applyDecision and advanceTurn do not mutate their input state', () => {
    const s0 = createGame(miniBank, 3)
    const before = structuredClone(s0)
    const s1 = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_b_unbackstopped'])
    expect(s0).toEqual(before)
    expect(s1).not.toBe(s0)
    expect(s1.decisions).toHaveLength(1)
    expect(s0.decisions).toHaveLength(0)

    const before1 = structuredClone(s1)
    const s2 = advanceTurn(s1, miniBank)
    expect(s1).toEqual(before1)
    expect(s2.turnIndex).toBe(1)
  })

  it('previewOption leaves state and rng untouched and reports non-empty deltas', () => {
    const s0 = createGame(miniBank, 5)
    const before = structuredClone(s0)
    const preview = previewOption(s0, miniBank, 'd0_disclosure', ['opt_b_unbackstopped'])
    expect(s0).toEqual(before)
    expect(s0.rng).toBe(before.rng)
    expect(preview.error).toBeUndefined()
    expect(preview.deltas.length).toBeGreaterThan(0)
    const keys = preview.deltas.map((d) => d.key)
    expect(keys).toContain('confidence')
    expect(keys).toContain('ownStock')
    const ci = preview.deltas.find((d) => d.key === 'confidence')!
    expect(ci.before).toBe(72)
    expect(ci.after).toBe(52)
    expect(ci.delta).toBe(-20)
    expect(preview.delayed).toEqual([{ afterTurns: 2, description: '신용등급 검토 → 1노치 강등' }])
    expect(preview.feed.length).toBeGreaterThan(0)
    expect(preview.wouldEnd).toBeUndefined()
  })

  it('previewOption of an RNG-consuming option still leaves state.rng untouched; invalid selections yield an error', () => {
    const sc = withOptionEffects(miniBank, 'd0_disclosure', 'opt_c_silent', [rngEffect])
    const s0 = createGame(sc, 5)
    const before = structuredClone(s0)
    const preview = previewOption(s0, sc, 'd0_disclosure', ['opt_c_silent'])
    expect(preview.error).toBeUndefined()
    expect(s0).toEqual(before)

    const bad = previewOption(s0, sc, 'd0_disclosure', ['does_not_exist'])
    expect(bad.error).toBeTruthy()
    expect(bad.deltas).toEqual([])
  })

  it('rng advances only when ctx.rng() is called', () => {
    const s0 = createGame(miniBank, 9)
    const plain = applyDecision(s0, miniBank, 'd0_disclosure', ['opt_c_silent'])
    expect(plain.rng).toBe(s0.rng)

    const sc = withOptionEffects(miniBank, 'd0_disclosure', 'opt_c_silent', [rngEffect])
    const rolled = applyDecision(createGame(sc, 9), sc, 'd0_disclosure', ['opt_c_silent'])
    expect(rolled.rng).not.toBe(s0.rng)
    expect(rolled.counters.roll).toBeGreaterThanOrEqual(0)
    expect(rolled.counters.roll).toBeLessThan(1)

    // Two draws advance twice as far and are reproducible.
    const sc2 = withOptionEffects(miniBank, 'd0_disclosure', 'opt_c_silent', [rngEffect, rngEffect])
    const twice = applyDecision(createGame(sc2, 9), sc2, 'd0_disclosure', ['opt_c_silent'])
    expect(twice.rng).not.toBe(rolled.rng)
    expect(applyDecision(createGame(sc2, 9), sc2, 'd0_disclosure', ['opt_c_silent'])).toEqual(twice)
  })
})
