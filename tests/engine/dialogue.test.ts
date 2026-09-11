import { describe, expect, it } from 'vitest'
import {
  applyDecision,
  autoplay,
  availableReplies,
  buildConditionContext,
  commitReplies,
  createGame,
  DecisionError,
  dialogueView,
  entryStep,
  getTurnView,
  hasDialogue,
  replay,
  stepById,
  validateDialogue,
  validateScenario,
  walk,
  type BankState,
  type Decision,
  type DialogueReply,
  type DialogueStep,
  type GameState,
  type Policy,
  type ScenarioDefinition,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'
import {
  BACKSTOP_COUNTER,
  DIALOGUE_DECISION_ID,
  DIALOGUE_INTERRUPT_ID,
  EXPERT_PATH,
  HISTORICAL_PATH,
  miniDialogue,
  miniDialogueInterrupt,
} from '../fixtures/miniDialogue'
import { TICKED_TURN_INDEX } from '../fixtures/miniTicks'

const scenario = miniDialogue
const plain = miniBank

function start(sc: ScenarioDefinition<BankState> = scenario): GameState<BankState> {
  return createGame(sc, 1)
}

function decisionOf(sc: ScenarioDefinition<BankState>): Decision<BankState> {
  return sc.turns[0]!.decisions.find((d) => d.id === DIALOGUE_DECISION_ID)!
}

/** Strips the fields that legitimately differ between two runs of the same log. */
function comparable(s: GameState<BankState>) {
  const { log: _log, lastReel: _reel, ...rest } = s
  return rest
}

describe('dialogue graph primitives', () => {
  it('reports no dialogue for a decision without steps', () => {
    const d = decisionOf(plain)
    expect(hasDialogue(d)).toBe(false)
    expect(entryStep(d)).toBeUndefined()
    expect(walk(d, [])).toEqual({ replies: [], steps: [] })
    expect(walk(d, ['whatever']).invalid).toBeTruthy()
  })

  it('walks a full path to the option it resolves to', () => {
    const d = decisionOf(scenario)
    expect(hasDialogue(d)).toBe(true)
    expect(entryStep(d)?.id).toBe('dlg-open')
    const w = walk(d, EXPERT_PATH)
    expect(w.optionId).toBe('opt_a_backstopped')
    expect(w.invalid).toBeUndefined()
    expect(w.replies.map((r) => r.id)).toEqual(EXPERT_PATH)
    expect(w.steps.map((s) => s.id)).toEqual(['dlg-open', 'dlg-backstop', 'dlg-full'])
  })

  it('stops at the step an incomplete path has reached', () => {
    const w = walk(decisionOf(scenario), ['r-exact'])
    expect(w.optionId).toBeUndefined()
    expect(w.step?.id).toBe('dlg-backstop')
  })

  it('rejects a reply that does not exist at the reached step', () => {
    expect(walk(decisionOf(scenario), ['r-full-announce']).invalid).toMatch(/dlg-open/)
    expect(walk(decisionOf(scenario), ['r-defer', 'r-exact']).invalid).toMatch(/이미 끝났/)
  })

  it('filters replies by `when` against the supplied context', () => {
    const d: Decision<BankState> = {
      ...decisionOf(scenario),
      steps: [
        {
          id: 'dlg-open',
          lines: [{ speaker: '감독관', text: 'q' }],
          replies: [
            { id: 'always', label: 'a', resolvesTo: 'opt_c_silent' },
            {
              id: 'gated',
              label: 'b',
              when: { flag: 'backstop' },
              resolvesTo: 'opt_a_backstopped',
            },
          ],
        },
      ],
    }
    const ctx = buildConditionContext(start() as GameState)
    expect(availableReplies(d, 'dlg-open').map((r) => r.id)).toEqual(['always', 'gated'])
    expect(availableReplies(d, 'dlg-open', ctx).map((r) => r.id)).toEqual(['always'])
    expect(walk(d, ['gated'], ctx).invalid).toBeTruthy()
    expect(walk(d, ['gated']).optionId).toBe('opt_a_backstopped')
  })

  it('commitReplies builds one set-the-counter reply per discrete value', () => {
    const replies = commitReplies<BankState>('haircutPct', [10, 25, 40], {
      unit: '%',
      next: 'dlg-next',
    })
    expect(replies.map((r) => r.id)).toEqual(['haircutPct-10', 'haircutPct-25', 'haircutPct-40'])
    expect(replies.map((r) => r.label)).toEqual(['10%', '25%', '40%'])
    expect(replies.every((r) => r.next === 'dlg-next')).toBe(true)
    expect(replies[0]!.effects?.[0]).toMatchObject({
      kind: 'fn',
      name: 'commitCounter',
      params: { counter: 'haircutPct', value: 10 },
    })
  })
})

describe('applyDecision without steps is unchanged', () => {
  it('produces a byte-identical state and record', () => {
    const before = start(plain)
    const after = applyDecision(before, plain, DIALOGUE_DECISION_ID, ['opt_a_backstopped'])
    expect(after.decisions).toEqual([
      { turnIndex: 0, decisionId: DIALOGUE_DECISION_ID, optionIds: ['opt_a_backstopped'] },
    ])
    expect('path' in after.decisions[0]!).toBe(false)
  })

  it('refuses a path for a decision that has no dialogue', () => {
    const before = start(plain)
    expect(() =>
      applyDecision(before, plain, DIALOGUE_DECISION_ID, ['opt_a_backstopped'], {
        path: ['r-exact'],
      }),
    ).toThrow(DecisionError)
  })

  it('a dialogue decision committed without a path behaves like the bare option list', () => {
    const bare = applyDecision(start(plain), plain, DIALOGUE_DECISION_ID, ['opt_a_backstopped'])
    const viaOption = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'])
    expect(viaOption.decisions[0]).toEqual(bare.decisions[0])
    expect(viaOption.institution).toEqual(bare.institution)
    expect(viaOption.confidence).toEqual(bare.confidence)
    expect(viaOption.counters).toEqual(bare.counters)
  })
})

describe('applyDecision with a dialogue path', () => {
  it('applies reply effects in path order, then the resolved option’s', () => {
    const before = start()
    const after = applyDecision(before, scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'], {
      path: EXPERT_PATH,
    })
    // The promise the numeric reply wrote survives on the counter.
    expect(after.counters[BACKSTOP_COUNTER]).toBe(100)
    // The resolved option's own effects still ran (backstopped raise sets the flag).
    expect(after.flags.backstop).toBe(true)
    expect(after.decisions[0]).toEqual({
      turnIndex: 0,
      decisionId: DIALOGUE_DECISION_ID,
      optionIds: ['opt_a_backstopped'],
      path: EXPERT_PATH,
    })
    // The transcript is in the engine log, reply lines before the option line.
    const lines = after.log.filter((l) => l.includes(DIALOGUE_DECISION_ID))
    expect(lines[0]).toContain('대화')
    expect(lines[lines.length - 1]).toContain('결정')
  })

  it('two different promises land on the same option with different counters', () => {
    const a = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], {
      path: ['r-exact', `${BACKSTOP_COUNTER}-0`, 'r-plain-hold'],
    })
    const b = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], {
      path: ['r-exact', `${BACKSTOP_COUNTER}-50`, 'r-plain-hold'],
    })
    expect(a.counters[BACKSTOP_COUNTER]).toBe(0)
    expect(b.counters[BACKSTOP_COUNTER]).toBe(50)
    expect(a.institution.wholesale.cbFacilityCapacity).toBe(
      b.institution.wholesale.cbFacilityCapacity,
    )
  })

  it('judges the promise later, through a delayed effect on the counter', () => {
    const kept = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], {
      path: ['r-defer'],
    })
    const promised = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], {
      path: ['r-exact', `${BACKSTOP_COUNTER}-50`, 'r-plain-hold'],
    })
    const next = (s: GameState<BankState>) =>
      replay(scenario, { seed: 1, decisions: s.decisions, turnIndex: 1 }).state
    expect(next(kept).confidence.index).toBeGreaterThan(next(promised).confidence.index)
  })

  it('throws invalid-path when the path no longer validates', () => {
    const before = start()
    const cases: string[][] = [
      ['r-nonexistent'],
      ['r-exact'], // unfinished
      ['r-exact', `${BACKSTOP_COUNTER}-100`, 'r-plain-announce'], // wrong step
      ['r-defer', 'r-exact'], // walks past a resolution
    ]
    for (const path of cases) {
      expect(() =>
        applyDecision(before, scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], { path }),
      ).toThrow(DecisionError)
    }
    try {
      applyDecision(before, scenario, DIALOGUE_DECISION_ID, ['opt_c_silent'], { path: ['r-bogus'] })
    } catch (e) {
      expect((e as DecisionError).code).toBe('invalid-path')
    }
  })

  it('throws when the walk resolves somewhere other than the committed option', () => {
    expect(() =>
      applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_b_unbackstopped'], {
        path: EXPERT_PATH,
      }),
    ).toThrow(/귀결한 옵션/)
  })
})

describe('getTurnView exposes the conversation', () => {
  it('has no dialogue field for a decision without steps', () => {
    const view = getTurnView(start(plain), plain)
    expect(view.decisions[0]!.dialogue).toBeUndefined()
  })

  it('reports the entry step, then the step an in-progress path has reached', () => {
    const s = start()
    const at = (path: string[]) =>
      getTurnView(s, scenario, { dialoguePaths: { [DIALOGUE_DECISION_ID]: path } }).decisions[0]!
        .dialogue!

    const fresh = at([])
    expect(fresh.step?.id).toBe('dlg-open')
    expect(fresh.replies.map((r) => r.id)).toEqual(['r-exact', 'r-range', 'r-defer'])
    expect(fresh.transcript).toHaveLength(0)

    const mid = at(['r-exact'])
    expect(mid.step?.id).toBe('dlg-backstop')
    expect(mid.transcript.map((t) => t.reply.id)).toEqual(['r-exact'])
    expect(mid.replies).toHaveLength(3)

    const done = at(EXPERT_PATH)
    expect(done.resolvedOptionId).toBe('opt_a_backstopped')
    expect(done.step).toBeUndefined()
    expect(done.transcript.map((t) => t.step.id)).toEqual(['dlg-open', 'dlg-backstop', 'dlg-full'])
  })

  it('rewinds to the entry step when the path went stale', () => {
    const v = dialogueView(start(), decisionOf(scenario), ['r-gone'])!
    expect(v.invalid).toBeTruthy()
    expect(v.path).toEqual([])
    expect(v.step?.id).toBe('dlg-open')
  })

  it('shows the walked path of a resolved decision', () => {
    const s = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'], {
      path: EXPERT_PATH,
    })
    const dv = getTurnView(s, scenario).decisions[0]!
    expect(dv.resolved).toBe(true)
    expect(dv.dialogue?.transcript.map((t) => t.reply.id)).toEqual(EXPERT_PATH)
  })
})

describe('replay reproduces a dialogue exactly', () => {
  it('replays a log carrying a path to the identical state', () => {
    const live = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'], {
      path: EXPERT_PATH,
    })
    const { state } = replay(scenario, { seed: 1, decisions: live.decisions, turnIndex: 0 })
    expect(comparable(state)).toEqual(comparable(live))
    expect(state.decisions[0]!.path).toEqual(EXPERT_PATH)
  })

  it('refuses to replay a path the scenario no longer allows', () => {
    const live = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'], {
      path: EXPERT_PATH,
    })
    const edited: ScenarioDefinition<BankState> = {
      ...scenario,
      turns: scenario.turns.map((t, i) =>
        i !== 0
          ? t
          : {
              ...t,
              decisions: t.decisions.map((d) =>
                d.id !== DIALOGUE_DECISION_ID
                  ? d
                  : {
                      ...d,
                      steps: d.steps!.map((s) =>
                        s.id !== 'dlg-open'
                          ? s
                          : { ...s, replies: s.replies.filter((r) => r.id !== 'r-exact') },
                      ),
                    },
              ),
            },
      ),
    }
    expect(() => replay(edited, { seed: 1, decisions: live.decisions, turnIndex: 0 })).toThrow(
      DecisionError,
    )
  })

  it('replays a log where the same option was reached without a path', () => {
    const live = applyDecision(start(), scenario, DIALOGUE_DECISION_ID, ['opt_a_backstopped'])
    const { state } = replay(scenario, { seed: 1, decisions: live.decisions, turnIndex: 0 })
    expect(comparable(state)).toEqual(comparable(live))
  })
})

describe('autoplay walks dialogues', () => {
  const policies: Policy[] = ['historical', 'expert', 'worst', 'random']

  it.each(policies)('%s records a path that resolves to the committed option', (policy) => {
    const run = autoplay(scenario, policy, { seed: 1, rngSeed: 7 })
    const rec = run.decisions.find((r) => r.decisionId === DIALOGUE_DECISION_ID)!
    expect(rec.path).toBeDefined()
    expect(rec.path!.length).toBeGreaterThan(0)
    const w = walk(decisionOf(scenario), rec.path!)
    expect(w.optionId).toBe(rec.optionIds[0])
  })

  it.each(policies)('%s replays its own log to the same state', (policy) => {
    const run = autoplay(scenario, policy, { seed: 1, rngSeed: 7 })
    const { state } = replay(scenario, {
      seed: 1,
      decisions: run.decisions,
      // One past the last turn so the replay reaches the same ending the run did.
      turnIndex: run.state.turnIndex + 1,
    })
    expect(comparable(state)).toEqual(comparable(run.state))
  })

  it('historical steers to the historical option by the highest-rated route', () => {
    const run = autoplay(scenario, 'historical', { seed: 1 })
    const rec = run.decisions.find((r) => r.decisionId === DIALOGUE_DECISION_ID)!
    expect(rec.optionIds).toEqual(['opt_b_unbackstopped'])
    expect(rec.path).toEqual(HISTORICAL_PATH)
  })

  it('expert steers to the expert option', () => {
    const run = autoplay(scenario, 'expert', { seed: 1 })
    const rec = run.decisions.find((r) => r.decisionId === DIALOGUE_DECISION_ID)!
    expect(rec.optionIds).toEqual(['opt_a_backstopped'])
    expect(rec.path).toEqual(EXPERT_PATH)
  })

  it('worst takes the trap reply first', () => {
    const run = autoplay(scenario, 'worst', { seed: 1 })
    const rec = run.decisions.find((r) => r.decisionId === DIALOGUE_DECISION_ID)!
    expect(rec.path?.[0]).toBe('r-range')
    expect(rec.path?.[1]).toBe(`${BACKSTOP_COUNTER}-0`)
    expect(rec.optionIds).toEqual(['opt_b_unbackstopped'])
  })

  it('random is reproducible for a given rng seed and differs across seeds', () => {
    const a = autoplay(scenario, 'random', { seed: 1, rngSeed: 3 })
    const b = autoplay(scenario, 'random', { seed: 1, rngSeed: 3 })
    const pathOf = (r: typeof a) =>
      r.decisions.find((x) => x.decisionId === DIALOGUE_DECISION_ID)?.path
    expect(pathOf(a)).toEqual(pathOf(b))
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (rngSeed) => pathOf(autoplay(scenario, 'random', { seed: 1, rngSeed }))?.join('/') ?? '',
    )
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('walks a dialogue attached to an interrupt too', () => {
    const run = autoplay(miniDialogueInterrupt, 'expert', { seed: 1 })
    const rec = run.decisions.find((r) => r.decisionId === DIALOGUE_INTERRUPT_ID)
    expect(rec?.path).toEqual(['c-open-numbers', 'c-num-disclose'])
    expect(rec?.optionIds).toEqual(['call_numbers'])
    const { state } = replay(miniDialogueInterrupt, {
      seed: 1,
      decisions: run.decisions,
      turnIndex: run.state.turnIndex + 1,
    })
    expect(comparable(state)).toEqual(comparable(run.state))
    expect(TICKED_TURN_INDEX).toBe(1)
  })
})

describe('dialogue lint', () => {
  const base = decisionOf(scenario)
  const lint = (steps: DialogueStep<BankState>[], extra: Partial<Decision<BankState>> = {}) =>
    validateDialogue({ ...base, ...extra, steps })
  const rules = (steps: DialogueStep<BankState>[], extra?: Partial<Decision<BankState>>) =>
    lint(steps, extra).map((i) => i.rule)

  const two = (
    id: string,
    a: Partial<DialogueReply<BankState>>,
    b: Partial<DialogueReply<BankState>>,
  ): DialogueStep<BankState> => ({
    id,
    lines: [{ speaker: 's', text: 't' }],
    replies: [
      { id: `${id}-1`, label: 'a', ...a },
      { id: `${id}-2`, label: 'b', ...b },
    ],
  })

  it('passes the authored fixture cleanly', () => {
    expect(validateDialogue(base)).toEqual([])
  })

  it('catches a reply with neither next nor resolvesTo, and with both', () => {
    expect(rules([two('s1', {}, { resolvesTo: 'opt_c_silent' })])).toContain(
      'dialogue-reply-target',
    )
    expect(
      rules([
        two('s1', { next: 's1', resolvesTo: 'opt_c_silent' }, { resolvesTo: 'opt_c_silent' }),
      ]),
    ).toContain('dialogue-reply-target')
  })

  it('catches a next that names no step', () => {
    expect(rules([two('s1', { next: 'nowhere' }, { resolvesTo: 'opt_c_silent' })])).toContain(
      'dialogue-next',
    )
  })

  it('catches a resolvesTo that names no option of the decision', () => {
    expect(
      rules([two('s1', { resolvesTo: 'not_an_option' }, { resolvesTo: 'opt_c_silent' })]),
    ).toContain('dialogue-resolves-to')
  })

  it('catches a step unreachable from steps[0]', () => {
    expect(
      rules([
        two('s1', { resolvesTo: 'opt_a_backstopped' }, { resolvesTo: 'opt_c_silent' }),
        two('s2', { resolvesTo: 'opt_b_unbackstopped' }, { resolvesTo: 'opt_c_silent' }),
      ]),
    ).toContain('dialogue-unreachable-step')
  })

  it('catches a cycle that never reaches a resolvesTo', () => {
    const r = rules([
      two('s1', { next: 's2' }, { next: 's2' }),
      two('s2', { next: 's1' }, { next: 's1' }),
    ])
    expect(r).toContain('dialogue-cycle')
  })

  it('warns about an option no dialogue path can reach', () => {
    const issues = lint([
      two('s1', { resolvesTo: 'opt_a_backstopped' }, { resolvesTo: 'opt_c_silent' }),
    ])
    const unreachable = issues.filter((i) => i.rule === 'dialogue-option-unreachable')
    expect(unreachable).toHaveLength(1)
    expect(unreachable[0]!.level).toBe('warning')
    expect(unreachable[0]!.where).toContain('opt_b_unbackstopped')
  })

  it('catches a step with fewer than 2 or more than 4 replies', () => {
    const one: DialogueStep<BankState> = {
      id: 's1',
      lines: [{ speaker: 's', text: 't' }],
      replies: [{ id: 'r', label: 'a', resolvesTo: 'opt_c_silent' }],
    }
    expect(rules([one])).toContain('dialogue-reply-count')
    const five: DialogueStep<BankState> = {
      ...one,
      replies: [0, 1, 2, 3, 4].map((i) => ({
        id: `r${i}`,
        label: 'a',
        resolvesTo: 'opt_c_silent',
      })),
    }
    expect(rules([five])).toContain('dialogue-reply-count')
  })

  it('requires a 1-of-1 selection', () => {
    expect(
      rules([two('s1', { resolvesTo: 'opt_a_backstopped' }, { resolvesTo: 'opt_c_silent' })], {
        select: { min: 1, max: 2 },
      }),
    ).toContain('dialogue-select')
  })

  it('runs inside the scenario integrity lint', () => {
    const clean = validateScenario(scenario).filter((i) => i.rule.startsWith('dialogue-'))
    expect(clean).toEqual([])
    const broken: ScenarioDefinition<BankState> = {
      ...scenario,
      turns: scenario.turns.map((t, i) =>
        i !== 0
          ? t
          : {
              ...t,
              decisions: t.decisions.map((d) =>
                d.id !== DIALOGUE_DECISION_ID
                  ? d
                  : {
                      ...d,
                      steps: d.steps!.map((s) =>
                        s.id !== 'dlg-full'
                          ? s
                          : {
                              ...s,
                              replies: s.replies.map((r) => ({ ...r, resolvesTo: 'ghost' })),
                            },
                      ),
                    },
              ),
            },
      ),
    }
    const issues = validateScenario(broken).filter((i) => i.rule === 'dialogue-resolves-to')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]!.where).toContain(DIALOGUE_DECISION_ID)
  })

  it('leaves scenarios without dialogues untouched', () => {
    expect(validateScenario(plain).filter((i) => i.rule.startsWith('dialogue-'))).toEqual([])
    expect(stepById(decisionOf(plain), 'dlg-open')).toBeUndefined()
  })
})
