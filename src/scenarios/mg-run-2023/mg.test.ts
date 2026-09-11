import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  computeScore,
  createGame,
  fastForwardTicks,
  latestSnapshot,
  replay,
  validateScenario,
  type BankState,
  type GameState,
  type ScenarioDefinition,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { mgFx } from './fx'
import scenario from './scenario'
import { T1_QUEUE_PROFILE, T2_QUEUE_PROFILE } from './turnsA'
import { T4_QUEUE_PROFILE } from './turnsB'

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

/**
 * Drives a hand-picked path: { turnIndex: [[decisionId, optionIds], ...] }. Stops when the game
 * ends. On a ticked turn each decision is answered at the first tick it is available, advancing the
 * clock in between — the same order a player would meet them.
 */
function drive(perTurn: Record<number, [string, string[]][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    const queue = [...(perTurn[s.turnIndex] ?? [])]
    let guard = 0
    while (queue.length > 0 && s.phase !== 'ended' && guard++ < 64) {
      const turn = scenario.turns[s.turnIndex]!
      const i = queue.findIndex(([id]) => {
        const d = turn.decisions.find((x) => x.id === id)
        return d !== undefined && (d.availableFrom ?? 0) <= s.tick
      })
      if (i < 0) {
        if (!canAdvanceTick(s, scenario)) break
        s = advanceTick(s, scenario)
        continue
      }
      const [decisionId, optionIds] = queue.splice(i, 1)[0]!
      s = applyDecision(s, scenario, decisionId, optionIds)
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

  // ------------------------------------------------------------------ L2: 틱 · 인터럽트 · 대화

  /** 같은 시나리오의 T1을 틱 이전 형태(하루치 단일 `runoffDays`)로 되돌린 변형. */
  function untickedT1(): ScenarioDefinition<BankState> {
    return {
      ...scenario,
      turns: scenario.turns.map((t) => {
        if (t.id !== 't1') return t
        const { ticks, tickLabels, eachTick, ticker, interrupts, ...rest } = t
        void ticks
        void tickLabels
        void eachTick
        void ticker
        void interrupts
        return {
          ...rest,
          entryEffects: [
            ...(t.entryEffects ?? []),
            {
              id: 't1-runoff-single',
              description: '7/5 당일 인출 (틱 이전 단일 호출)',
              effects: [mgFx.runoffDays({ days: 1, label: '7/5 인출' })],
            },
          ],
          decisions: t.decisions.map((d) => {
            const { availableFrom, deadlineTick, ...rd } = d
            void availableFrom
            void deadlineTick
            return rd
          }),
        }
      }),
    }
  }

  it('T1 tick slices sum exactly to the un-ticked single-day run-off at variance 0', () => {
    const ticked = autoplay(scenario, 'historical', { seed: 1, variance: 0 }).state
    const single = autoplay(untickedT1(), 'historical', { seed: 1, variance: 0 }).state
    const a = metricAt(ticked, 1, 'dailyOutflow')
    const b = metricAt(single, 1, 'dailyOutflow')
    console.log('[ticks] T1 daily outflow sliced', a, 'single', b)
    expect(Math.abs(a - b)).toBeLessThan(1e-9)
    expect(
      Math.abs(metricAt(ticked, 1, 'cumulativeOutflow') - metricAt(single, 1, 'cumulativeOutflow')),
    ).toBeLessThan(1e-9)
    expect(Math.abs(metricAt(ticked, 1, 'cash') - metricAt(single, 1, 'cash'))).toBeLessThan(1e-9)
    // 프로필 합은 정확히 1이어야 한다 (린트가 길이만 검사하므로 저자 책임).
    const sum = (p: number[]) => p.reduce((x, y) => x + y, 0)
    expect(sum(T1_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(sum(T2_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(sum(T4_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(T1_QUEUE_PROFILE).toHaveLength(4)
    expect(T2_QUEUE_PROFILE).toHaveLength(4)
    expect(T4_QUEUE_PROFILE).toHaveLength(4)
  })

  it('an unanswered interrupt times out to its default option (historical choice)', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-d1-a'])
    s = applyDecision(s, scenario, 't0-d2', ['t0-d2-a'])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(1)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = advanceTick(s, scenario) // 11:00 — 이사장 전화가 도착한다
    expect(s.openInterrupts).toContain('t1-i1-branch')
    s = advanceTick(s, scenario) // 14:00 — 마감 스윕이 기본 옵션으로 확정한다
    expect(s.openInterrupts).not.toContain('t1-i1-branch')
    const rec = s.decisions.find((d) => d.decisionId === 't1-i1-branch')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t1-i1-a'])
    expect(rec!.timedOut).toBe(true)
    expect(rec!.interrupt).toBe(true)
    expect(s.counters.timeouts).toBe(1)
    // 기본 옵션 = 역사 선택이므로 무응답 플레이는 역사 경로로 수렴한다.
    const it1 = scenario.turns[1]!.interrupts!.find((i) => i.id === 't1-i1-branch')!
    expect(it1.options.find((o) => o.id === it1.defaultOptionId)?.historical).toBe(true)
  })

  it('the T2 briefing dialogue walks and replays exactly (pledgedSupport is committed)', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const rec = r.decisions.find((d) => d.decisionId === 't2-d1')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t2-d1-a'])
    expect(rec!.path).toEqual(['forum-joint', 'pledgedSupport-30', 'promise-legal'])
    expect(rec!.tick).toBe(3)
    expect(r.state.counters.pledgedSupport).toBe(30)
    // 30조는 담보차입 여력 없이도 설명되는 값이므로 다음 턴 판정(≥70조)이 걸리지 않는다.
    expect(r.state.flags.figures_disclosed).toBe(true)
    const back = replay(scenario, { seed: 1, decisions: r.decisions })
    expect(back.state.counters.pledgedSupport).toBe(30)
    expect(latestSnapshot(back.state).metrics).toEqual(latestSnapshot(r.state).metrics)
    expect(back.state.decisions.find((d) => d.decisionId === 't2-d1')!.path).toEqual(rec!.path)
  })

  it('promising the full 77조 without a drawable line is judged at T3 (ΔCI −5, amplifier ×1.15)', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-d1-a'])
    s = applyDecision(s, scenario, 't0-d2', ['t0-d2-a'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = advanceTick(s, scenario)
    s = advanceTick(s, scenario) // 14:00 — 대응 체계 결정이 열린다
    s = applyDecision(s, scenario, 't1-d2', ['t1-d2-a'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-a'])
    s = fastForwardTicks(s, scenario)
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'], {
      path: ['forum-joint', 'pledgedSupport-77', 'promise-legal'],
    })
    expect(s.counters.pledgedSupport).toBe(77)
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(3)
    // 지연효과는 T3 진입 시 발화하고, 증폭 ×1.15는 그날의 인출에 쓰인 뒤 창이 끝나며 1로 리셋된다.
    expect(s.log.some((l) => l.includes('즉시 가용성 미입증'))).toBe(true)
    expect(s.log.some((l) => l.includes('공표 규모와 당일 가용액의 괴리'))).toBe(true)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(metricAt(s, 3, 'dailyOutflow')).toBeGreaterThan(metricAt(hist, 3, 'dailyOutflow'))
    expect(metricAt(s, 3, 'confidence')).toBeLessThan(metricAt(hist, 3, 'confidence'))
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
