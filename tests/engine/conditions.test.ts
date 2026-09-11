import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import {
  applyDecision,
  buildConditionContext,
  createGame,
  describeCondition,
  evaluate,
  type Condition,
  type ConditionContext,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'

function makeCtx(overrides: Partial<ConditionContext> = {}): ConditionContext {
  const metrics: Record<string, number> = { lcr: 85, confidence: 55 }
  const history: Record<string, number[]> = { lcr: [85, 90, 50], confidence: [55, 58] }
  const paths: Record<string, number> = { 'institution.cash': 20, 'market.ownStock': 100 }
  return {
    turnIndex: 2,
    flags: { silent: true, mode: 'fast', level: 3, off: false },
    counters: { timeouts: 1, outflow: 12.5 },
    metric: (k) => metrics[k],
    metricHistory: (k) => history[k] ?? [],
    path: (p) => paths[p],
    chose: (d, o) => d === 'd0' && (Array.isArray(o) ? o.includes('b') : o === 'b'),
    regulatorLevel: 2,
    confidence: 55,
    ...overrides,
  }
}

type Row = [name: string, cond: Condition | undefined, expected: boolean]

const rows: Row[] = [
  ['undefined condition is always true', undefined, true],
  // flag
  ['flag set (truthy)', { flag: 'silent' }, true],
  ['flag false', { flag: 'off' }, false],
  ['flag missing', { flag: 'missing' }, false],
  ['flag is string', { flag: 'mode', is: 'fast' }, true],
  ['flag is string mismatch', { flag: 'mode', is: 'slow' }, false],
  ['flag is number', { flag: 'level', is: 3 }, true],
  ['flag is number mismatch', { flag: 'level', is: 4 }, false],
  ['flag is false matches a false flag', { flag: 'off', is: false }, true],
  // notFlag
  ['notFlag on false flag', { notFlag: 'off' }, true],
  ['notFlag on set flag', { notFlag: 'silent' }, false],
  ['notFlag on missing flag', { notFlag: 'missing' }, true],
  // metric
  ['metric lt', { metric: 'lcr', lt: 90 }, true],
  ['metric lt (not)', { metric: 'lcr', lt: 80 }, false],
  ['metric lte boundary', { metric: 'lcr', lte: 85 }, true],
  ['metric lt boundary is strict', { metric: 'lcr', lt: 85 }, false],
  ['metric gt boundary is strict', { metric: 'lcr', gt: 85 }, false],
  ['metric gte boundary', { metric: 'lcr', gte: 85 }, true],
  ['metric band', { metric: 'lcr', gt: 80, lt: 90 }, true],
  ['metric band (not)', { metric: 'lcr', gt: 80, lt: 85 }, false],
  ['metric missing → false', { metric: 'missing', lt: 1e9 }, false],
  ['metric no comparator → true when present', { metric: 'lcr' }, true],
  // consecutiveTurns (history is most-recent-first)
  ['consecutiveTurns 2 holds', { metric: 'lcr', lt: 95, consecutiveTurns: 2 }, true],
  [
    'consecutiveTurns 2 fails on previous turn',
    { metric: 'lcr', lt: 88, consecutiveTurns: 2 },
    false,
  ],
  ['consecutiveTurns 3 holds', { metric: 'lcr', lt: 95, consecutiveTurns: 3 }, true],
  [
    'consecutiveTurns 3 fails on oldest turn',
    { metric: 'lcr', gt: 60, consecutiveTurns: 3 },
    false,
  ],
  [
    'consecutiveTurns longer than history → false',
    { metric: 'confidence', lt: 60, consecutiveTurns: 3 },
    false,
  ],
  [
    'consecutiveTurns 1 uses the current value',
    { metric: 'lcr', lt: 90, consecutiveTurns: 1 },
    true,
  ],
  [
    'consecutiveTurns on missing metric → false',
    { metric: 'missing', lt: 1, consecutiveTurns: 2 },
    false,
  ],
  // counter
  ['counter gte', { counter: 'timeouts', gte: 1 }, true],
  ['counter gt', { counter: 'outflow', gt: 12 }, true],
  ['counter missing defaults to 0', { counter: 'missing', lt: 1 }, true],
  ['counter missing defaults to 0 (gt)', { counter: 'missing', gt: 0 }, false],
  // path
  ['path eq', { path: 'institution.cash', eq: 20 }, true],
  ['path eq mismatch', { path: 'institution.cash', eq: 21 }, false],
  ['path gte', { path: 'market.ownStock', gte: 100 }, true],
  ['path missing → false', { path: 'nope', gte: 0 }, false],
  // chose / notChose
  ['chose single', { chose: { decision: 'd0', option: 'b' } }, true],
  ['chose single (not)', { chose: { decision: 'd0', option: 'a' } }, false],
  ['chose array any-of', { chose: { decision: 'd0', option: ['a', 'b'] } }, true],
  ['chose array none-of', { chose: { decision: 'd0', option: ['a', 'c'] } }, false],
  ['chose unknown decision', { chose: { decision: 'd9', option: 'b' } }, false],
  ['notChose single', { notChose: { decision: 'd0', option: 'a' } }, true],
  ['notChose single (chosen)', { notChose: { decision: 'd0', option: 'b' } }, false],
  ['notChose array', { notChose: { decision: 'd0', option: ['a', 'b'] } }, false],
  ['notChose array none chosen', { notChose: { decision: 'd0', option: ['a', 'c'] } }, true],
  // turn
  ['turn eq', { turn: { eq: 2 } }, true],
  ['turn gte (not)', { turn: { gte: 3 } }, false],
  ['turn lte', { turn: { lte: 2 } }, true],
  // regulator / confidence
  ['regulator gte', { regulator: { gte: 2 } }, true],
  ['regulator lte (not)', { regulator: { lte: 1 } }, false],
  ['confidence gte', { confidence: { gte: 50 } }, true],
  ['confidence lt (not)', { confidence: { lt: 50 } }, false],
  // combinators
  ['all true', { all: [{ flag: 'silent' }, { turn: { eq: 2 } }] }, true],
  ['all with one false', { all: [{ flag: 'silent' }, { flag: 'off' }] }, false],
  ['all empty is vacuously true', { all: [] }, true],
  ['any with one true', { any: [{ flag: 'off' }, { flag: 'silent' }] }, true],
  ['any all false', { any: [{ flag: 'off' }, { flag: 'missing' }] }, false],
  ['any empty is false', { any: [] }, false],
  ['not true → false', { not: { flag: 'silent' } }, false],
  ['not false → true', { not: { flag: 'off' } }, true],
  [
    'nested combinators',
    { all: [{ any: [{ flag: 'off' }, { not: { flag: 'off' } }] }, { not: { any: [] } }] },
    true,
  ],
  // fn
  [
    'fn receives the context',
    { fn: (c) => c.turnIndex === 2 && c.regulatorLevel === 2, label: 'ctx check' },
    true,
  ],
  ['fn false', { fn: () => false, label: 'never' }, false],
]

describe('evaluate', () => {
  it.each(rows)('%s', (_name, cond, expected) => {
    expect(evaluate(cond, makeCtx())).toBe(expected)
  })

  it('unknown condition shape evaluates to false', () => {
    expect(evaluate({} as unknown as Condition, makeCtx())).toBe(false)
  })
})

describe('buildConditionContext', () => {
  it('exposes turn, flags, counters, metrics, paths, regulator and confidence from a real state', () => {
    const s0 = createGame(miniBank, 1)
    const ctx = buildConditionContext(s0)
    expect(ctx.turnIndex).toBe(0)
    expect(ctx.confidence).toBe(72)
    expect(ctx.regulatorLevel).toBe(0)
    expect(ctx.metric('lcr')).toBeTypeOf('number')
    expect(ctx.metric('does-not-exist')).toBeUndefined()
    expect(ctx.path('institution.cash')).toBe(60)
    expect(ctx.path('institution.deposits.1.balance')).toBe(100)
    expect(ctx.path('institution.kind')).toBeUndefined()
    expect(ctx.metricHistory('confidence')).toEqual([72])
  })

  it('chose reflects recorded decisions; metricHistory is most-recent-first and skips na/NaN', () => {
    const s1 = applyDecision(createGame(miniBank, 1), miniBank, 'd0_disclosure', [
      'opt_b_unbackstopped',
    ])
    const ctx = buildConditionContext(s1)
    expect(ctx.chose('d0_disclosure', 'opt_b_unbackstopped')).toBe(true)
    expect(ctx.chose('d0_disclosure', ['opt_a_backstopped', 'opt_b_unbackstopped'])).toBe(true)
    expect(ctx.chose('d0_disclosure', 'opt_a_backstopped')).toBe(false)
    expect(ctx.metric('confidence')).toBe(52)

    const faked = produce(s1, (d) => {
      d.metricsHistory.push({
        turnIndex: 1,
        metrics: {
          confidence: { key: 'confidence', value: 40, unit: 'index', status: 'ok', label: 'CI' },
        },
      })
      d.metricsHistory.push({
        turnIndex: 2,
        metrics: {
          confidence: { key: 'confidence', value: NaN, unit: 'index', status: 'na', label: 'CI' },
        },
      })
      d.metricsHistory.push({
        turnIndex: 3,
        metrics: {
          confidence: { key: 'confidence', value: 30, unit: 'index', status: 'ok', label: 'CI' },
        },
      })
    })
    const c2 = buildConditionContext(faked)
    expect(c2.metricHistory('confidence')).toEqual([30, 40, 52])
    const naOnly = produce(faked, (d) => {
      d.metricsHistory.push({
        turnIndex: 4,
        metrics: {
          confidence: { key: 'confidence', value: 10, unit: 'index', status: 'na', label: 'CI' },
        },
      })
    })
    expect(buildConditionContext(naOnly).metric('confidence')).toBeUndefined()
  })
})

describe('describeCondition', () => {
  const samples: [string, Condition | undefined][] = [
    ['undefined', undefined],
    ['flag', { flag: 'silent' }],
    ['flag is', { flag: 'mode', is: 'fast' }],
    ['notFlag', { notFlag: 'silent' }],
    ['metric', { metric: 'lcr', lt: 60 }],
    ['metric consecutive', { metric: 'lcr', lt: 60, consecutiveTurns: 2 }],
    ['counter', { counter: 'timeouts', gte: 1 }],
    ['path', { path: 'institution.cash', eq: 20 }],
    ['chose', { chose: { decision: 'd0', option: 'b' } }],
    ['chose array', { chose: { decision: 'd0', option: ['a', 'b'] } }],
    ['notChose', { notChose: { decision: 'd0', option: ['a', 'b'] } }],
    ['turn', { turn: { gte: 1, lte: 3 } }],
    ['regulator', { regulator: { gte: 2 } }],
    ['confidence', { confidence: { lt: 50 } }],
    ['all', { all: [{ flag: 'a' }, { flag: 'b' }] }],
    ['any', { any: [{ flag: 'a' }, { flag: 'b' }] }],
    ['not', { not: { flag: 'a' } }],
    ['fn', { fn: () => true, label: '사용자 정의' }],
  ]

  it.each(samples)('returns a non-empty string for %s', (_name, cond) => {
    const text = describeCondition(cond)
    expect(typeof text).toBe('string')
    expect(text.trim().length).toBeGreaterThan(0)
    expect(text).not.toBe('?')
  })

  it('includes the identifiers and comparators it describes', () => {
    expect(describeCondition(undefined)).toBe('항상')
    expect(describeCondition({ metric: 'lcr', lt: 60, consecutiveTurns: 2 })).toContain('lcr')
    expect(describeCondition({ metric: 'lcr', lt: 60, consecutiveTurns: 2 })).toContain('2')
    expect(describeCondition({ chose: { decision: 'd0', option: ['a', 'b'] } })).toContain('a/b')
    expect(describeCondition({ fn: () => true, label: '사용자 정의' })).toBe('사용자 정의')
    expect(describeCondition({ not: { flag: 'x' } })).toMatch(/^NOT\(/)
    expect(describeCondition({ all: [{ flag: 'a' }, { flag: 'b' }] })).toContain('그리고')
    expect(describeCondition({ any: [{ flag: 'a' }, { flag: 'b' }] })).toContain('또는')
  })
})
