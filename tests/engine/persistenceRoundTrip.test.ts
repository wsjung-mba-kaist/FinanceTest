import { afterEach, describe, expect, it } from 'vitest'
import { applyDecision, autoplay, computeScore, createGame, latestSnapshot, replay } from '@/engine'
import { decisionRecordSchema, inProgressSchema } from '@/persistence/schema'
import { comparisonAt } from '@/lib/comparisonPoint'
import { useGameStore } from '@/store/gameStore'
import { useProgressStore } from '@/store/progressStore'
import { miniBank } from '../fixtures/miniBank'
import { EXPERT_PATH, miniDialogue, BACKSTOP_COUNTER } from '../fixtures/miniDialogue'
import { miniTicks } from '../fixtures/miniTicks'
import { asGeneric } from '../helpers/scenario'

afterEach(() => {
  useGameStore.getState().abandon()
  useProgressStore.getState().resetAll()
})

describe('saved training records', () => {
  it('retains dialogue effects, reasoning and hint deductions through JSON validation and replay', () => {
    const before = applyDecision(
      createGame(miniDialogue, 3),
      miniDialogue,
      'd0_disclosure',
      ['opt_a_backstopped'],
      {
        path: EXPERT_PATH,
        hintsUsed: 2,
        hintPenalty: 6,
        reasoning: {
          evidence: 'confirmed collateral',
          assumption: 'capacity remains open',
          reconsiderWhen: 'settlement delayed',
        },
      },
    )
    const decisions = decisionRecordSchema
      .array()
      .parse(JSON.parse(JSON.stringify(before.decisions)))
    const after = replay(miniDialogue, {
      seed: 3,
      decisions,
      turnIndex: 0,
      tick: 0,
      mode: 'standard',
    }).state
    expect(after.counters[BACKSTOP_COUNTER]).toBe(100)
    expect(after).toEqual(before)
    expect(computeScore(after, miniDialogue)).toEqual(computeScore(before, miniDialogue))
  })

  it.each(['standard', 'guided'] as const)(
    'preserves %s hint costs on store restoration',
    (mode) => {
      const scenario = asGeneric(miniBank)
      useGameStore.getState().start(scenario, mode, 9, 0)
      useGameStore.getState().revealHint('d0_disclosure', 2)
      expect(useGameStore.getState().choose('d0_disclosure', ['opt_a_backstopped'])).toBe(true)
      const before = useGameStore.getState().state!
      const raw = useProgressStore.getState().getScenario(scenario.meta.id).inProgress
      const saved = inProgressSchema.parse(JSON.parse(JSON.stringify(raw)))
      expect(saved.hintPenalty).toBe(mode === 'standard' ? 6 : 0)
      expect(useGameStore.getState().restore(scenario, saved)).toBe(true)
      expect(useGameStore.getState().state).toEqual(before)
    },
  )

  it('recovers old standard hint deductions but honors explicit zero', () => {
    const rec = {
      turnIndex: 0,
      decisionId: 'd0_disclosure',
      optionIds: ['opt_a_backstopped'],
      hintsUsed: 2,
    }
    const old = replay(miniBank, { seed: 1, decisions: [rec], mode: 'standard' }).state
    const zero = replay(miniBank, {
      seed: 1,
      decisions: [{ ...rec, hintPenalty: 0 }],
      mode: 'standard',
    }).state
    expect(old.counters.hintPenalty).toBe(6)
    expect(zero.counters.hintPenalty ?? 0).toBe(0)
  })

  it('compares reference paths at the requested turn and tick without future decisions', () => {
    const scenario = asGeneric(miniTicks)
    const path = autoplay(scenario, 'expert', { seed: 3, variance: 1 }).state
    const target = { turnIndex: 1, tick: 0 }
    const aligned = comparisonAt(scenario, path, target)!
    expect(aligned.turnIndex).toBe(1)
    expect(aligned.tick).toBe(0)
    expect(aligned.variance).toBe(1)
    expect(
      aligned.decisions.every((d) => d.turnIndex < 1 || (d.turnIndex === 1 && (d.tick ?? 0) === 0)),
    ).toBe(true)
    const expected = replay(scenario, {
      seed: 3,
      variance: 1,
      decisions: path.decisions.filter(
        (d) => d.turnIndex < 1 || (d.turnIndex === 1 && (d.tick ?? 0) === 0),
      ),
      ...target,
    }).state
    expect(latestSnapshot(aligned)).toEqual(latestSnapshot(expected))
    expect(comparisonAt(scenario, path, { turnIndex: path.turnIndex + 1, tick: 0 })).toBeUndefined()
  })
})
