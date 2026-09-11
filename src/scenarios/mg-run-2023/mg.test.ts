import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  applyDecision,
  autoplay,
  computeScore,
  createGame,
  validateScenario,
  type BankState,
  type GameState,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import scenario from './scenario'

type State = GameState<BankState>

function series(state: State, key: string, digits = 2): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  const snap = state.metricsHistory.find((m) => m.turnIndex === turnIndex)
  return snap?.metrics[key]?.value ?? NaN
}

/** Drives a hand-picked path: { turnIndex: [[decisionId, optionIds], ...] }. Stops when the game ends. */
function drive(perTurn: Record<number, [string, string[]][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    for (const [decisionId, optionIds] of perTurn[s.turnIndex] ?? []) {
      s = applyDecision(s, scenario, decisionId, optionIds)
      if (s.phase === 'ended') break
    }
    if (s.phase === 'ended') break
    s = advanceTurn(s, scenario)
  }
  return s
}

function logScore(label: string, s: State) {
  const score = computeScore(s, scenario)
  console.log(
    `[${label}] score`,
    score.total,
    score.grade,
    Object.fromEntries(Object.entries(score.dimensions).map(([k, v]) => [k, Math.round(v.score)])),
  )
  return score
}

/** 사후정보 토큰: 엔딩·디브리핑 이전(턴 텍스트)에는 등장하면 안 된다. */
const FORBIDDEN_IN_TURNS = ['2024', '2025', 'MOU', '1억원']

/** 식별자·참조 키(출처 id 등 플레이어에게 텍스트로 노출되지 않는 값)는 사후정보 검사에서 제외한다. */
const NON_TEXT_KEYS = new Set([
  'id',
  'sourceRefs',
  'cardRefs',
  'requiredConcepts',
  'remediationCard',
  'relatedCards',
  'relatedMetrics',
  'decisionId',
  'defaultOptionId',
  'exclusive',
  'key',
  'path',
  'name',
  'metric',
  'flag',
  'notFlag',
  'params',
  'when',
  'requires',
  'time',
  'dimensions',
])

function collectTurnText(node: unknown, out: string[], key?: string): void {
  if (key !== undefined && NON_TEXT_KEYS.has(key)) return
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((v) => collectTurnText(v, out, key))
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) collectTurnText(v, out, k)
}

describe('mg-run-2023 scenario', () => {
  it('passes integrity lint (errors) with shared cards/sources', () => {
    const issues = validateScenario(scenario, { cardIds: cardIds(), sourceIds: sourceIds() })
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    const warnings = issues.filter((i) => i.level === 'warning')
    if (warnings.length) console.log('[warnings]\n' + formatIssues(warnings))
  })

  it('passes integrity lint standalone (scenario-local sources only)', () => {
    const errors = validateScenario(scenario).filter((i) => i.level === 'error')
    expect(errors).toEqual([])
  })

  it('contains no hindsight tokens in turn text (endings/debrief exempt)', () => {
    const strings: string[] = []
    collectTurnText(scenario.turns, strings)
    expect(strings.length).toBeGreaterThan(100)
    for (const token of FORBIDDEN_IN_TURNS) {
      const hits = strings.filter((s) => s.includes(token))
      expect(hits, `forbidden token "${token}" in turn text`).toEqual([])
    }
    // 브리핑(플레이 전 텍스트)도 같은 규칙을 따른다.
    const briefing: string[] = []
    collectTurnText(scenario.briefing, briefing)
    for (const token of FORBIDDEN_IN_TURNS) {
      const hits = briefing.filter((s) => s.includes(token) && !s.includes('디브리핑에서만'))
      expect(hits, `forbidden token "${token}" in briefing`).toEqual([])
    }
  })

  it('historical path reproduces the 7/5–7/17 outflow profile without a liquidity failure', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] cash   ', series(s, 'cash', 1))
    console.log('[historical] daily  ', series(s, 'dailyOutflow'))
    console.log('[historical] cumOut ', series(s, 'cumulativeOutflow'))
    console.log('[historical] CI     ', series(s, 'confidence', 0))
    console.log('[historical] runSt  ', series(s, 'runState', 0))
    console.log('[historical] ended  ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('진정')
    // peak day (7/5–7/6) within the 1~2조 band
    const peak = Math.max(metricAt(s, 1, 'dailyOutflow'), metricAt(s, 2, 'dailyOutflow'))
    expect(peak).toBeGreaterThanOrEqual(1)
    expect(peak).toBeLessThanOrEqual(2)
    // 7/7 drop of roughly 1조 vs 7/6
    expect(metricAt(s, 2, 'dailyOutflow') - metricAt(s, 3, 'dailyOutflow')).toBeGreaterThan(0.6)
    // 7/17 daily outflow 0.6~0.7조 (dossier) — allow the checkpoint tolerance
    const t6 = metricAt(s, 6, 'dailyOutflow')
    expect(t6).toBeGreaterThanOrEqual(0.5)
    expect(t6).toBeLessThanOrEqual(0.8)
    // cumulative July outflow 6~10조 band
    const cum = metricAt(s, 6, 'cumulativeOutflow')
    expect(cum).toBeGreaterThanOrEqual(6)
    expect(cum).toBeLessThanOrEqual(10)
    // cash never negative on the historical path
    for (const m of s.metricsHistory) expect(m.metrics.cash!.value).toBeGreaterThanOrEqual(0)
    logScore('historical', s)
  })

  it('expert path survives, calms the run and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] cash   ', series(s, 'cash', 1))
    console.log('[expert] daily  ', series(s, 'dailyOutflow'))
    console.log('[expert] cumOut ', series(s, 'cumulativeOutflow'))
    console.log('[expert] CI     ', series(s, 'confidence', 0))
    console.log('[expert] headrm ', series(s, 'facilityHeadroom', 1))
    console.log('[expert] ended  ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('진정')
    const expert = logScore('expert', s)
    const hist = computeScore(autoplay(scenario, 'historical', { seed: 1 }).state, scenario)
    expect(expert.total).toBeGreaterThan(hist.total)
    expect(metricAt(s, 6, 'cumulativeOutflow')).toBeLessThan(
      metricAt(autoplay(scenario, 'historical', { seed: 1 }).state, 6, 'cumulativeOutflow'),
    )
  })

  it('conditional "no more bad 금고" reassurance collapses at T4 (amplifier ×1.5, CI −20)', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-b']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-a']],
      ],
      4: [
        ['t4-d1', ['t4-d1-a']],
        ['t4-d2', ['t4-d2-a']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-d2', ['t5-d2-b']],
      ],
      6: [['t6-d1', ['t6-d1-a']]],
    })
    console.log('[trap:reassurance] CI    ', series(s, 'confidence', 0))
    console.log('[trap:reassurance] daily ', series(s, 'dailyOutflow'))
    expect(s.flags.reassurance_contradicted).toBe(true)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(metricAt(s, 4, 'dailyOutflow')).toBeGreaterThan(metricAt(hist, 4, 'dailyOutflow'))
    expect(metricAt(s, 4, 'confidence')).toBeLessThan(metricAt(hist, 4, 'confidence'))
    expect(computeScore(s, scenario).total).toBeLessThan(computeScore(hist, scenario).total)
  })

  it('payment deferral (illegal option) ends the run immediately via R4', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [['t1-d1', ['t1-d1-b']]],
    })
    expect(s.ended?.reason).toBe('unsafe_act')
    expect(s.ended?.failed).toBe(true)
    expect(s.ended?.turnIndex).toBe(1)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('a collapse path exhausts the reserve fund (cash < 0 → 지급정지) — game-over reachable', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-c']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-c']],
        ['t1-d2', ['t1-d2-b']],
      ],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-b']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d']],
        ['t3-d2', ['t3-d2-b']],
      ],
      4: [
        ['t4-d1', ['t4-d1-b']],
        ['t4-d2', ['t4-d2-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-e']],
        ['t5-d2', ['t5-d2-a']],
      ],
      6: [['t6-d1', ['t6-d1-c']]],
    })
    console.log('[collapse] cash  ', series(s, 'cash', 1))
    console.log('[collapse] daily ', series(s, 'dailyOutflow'))
    console.log('[collapse] CI    ', series(s, 'confidence', 0))
    console.log('[collapse] ended ', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('suspension')
    expect(s.ended?.failed).toBe(true)
  })

  it('bank RP line: pre-arranged at T0 settles next day and is drawn at T2; total capped at 6.2', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-b']],
        ['t0-d2', ['t0-d2-b']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-a']],
        ['t2-d2', ['t2-d2-c']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-a']],
      ],
      4: [
        ['t4-d1', ['t4-d1-a']],
        ['t4-d2', ['t4-d2-a']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-d2', ['t5-d2-b']],
      ],
      6: [['t6-d1', ['t6-d1-b', 't6-d1-d']]],
    })
    expect(metricAt(s, 1, 'facilityHeadroom')).toBeCloseTo(6, 5)
    expect(s.counters.rpArranged).toBeCloseTo(6.2, 5)
    expect(s.institution.wholesale.cbAdvances).toBeCloseTo(6.2, 5)
    expect(s.counters.realizedLoss ?? 0).toBe(0)
  })

  it('a pre-arranged RP line is auto-drawn to cover a settlement shortfall (collapse path survives longer)', () => {
    const collapse = (prefund: string) =>
      drive({
        0: [
          ['t0-d1', ['t0-d1-c']],
          ['t0-d2', [prefund]],
        ],
        1: [
          ['t1-d1', ['t1-d1-c']],
          ['t1-d2', ['t1-d2-b']],
        ],
        2: [
          ['t2-d1', ['t2-d1-d']],
          ['t2-d2', ['t2-d2-d']],
        ],
        3: [
          ['t3-d1', ['t3-d1-d']],
          ['t3-d2', ['t3-d2-b']],
        ],
        4: [
          ['t4-d1', ['t4-d1-b']],
          ['t4-d2', ['t4-d2-b']],
        ],
        5: [
          ['t5-d1', ['t5-d1-e']],
          ['t5-d2', ['t5-d2-a']],
        ],
        6: [['t6-d1', ['t6-d1-c']]],
      })
    const bare = collapse('t0-d2-a')
    const withLine = collapse('t0-d2-b')
    console.log(
      '[collapse:bare]  cash',
      series(bare, 'cash', 1),
      '→',
      bare.ended?.reason,
      'T',
      bare.ended?.turnIndex,
    )
    console.log(
      '[collapse:line]  cash',
      series(withLine, 'cash', 1),
      '→',
      withLine.ended?.reason,
      'T',
      withLine.ended?.turnIndex,
    )
    expect(bare.ended?.reason).toBe('suspension')
    // the line is drawn automatically when settlement would otherwise fail
    expect(withLine.institution.wholesale.cbAdvances).toBeGreaterThan(0)
    expect(withLine.institution.wholesale.cbFacilityCapacity).toBeCloseTo(0, 5)
    expect(withLine.log.some((l) => l.includes('자동 인출'))).toBe(true)
    // 6조 buys time but cannot stop a collapse-state run on its own
    const cashMin = (st: State) => Math.min(...st.metricsHistory.map((m) => m.metrics.cash!.value))
    expect(cashMin(withLine)).toBeGreaterThan(cashMin(bare))
  })

  it('worst and random policies complete without NaN', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
        expect(r.state.ended).toBeDefined()
        const score = computeScore(r.state, scenario)
        expect(score.total).toBeGreaterThanOrEqual(0)
        expect(score.total).toBeLessThanOrEqual(100)
        console.log(
          `[${policy}#${rngSeed}]`,
          r.state.ended?.reason,
          'T',
          r.state.ended?.turnIndex,
          'score',
          score.total,
        )
      }
    }
  })
})
