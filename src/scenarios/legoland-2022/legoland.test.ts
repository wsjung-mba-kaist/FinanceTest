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
  replay,
  validateScenario,
} from '../../engine'
import type { GameState, ScenarioDefinition, SecuritiesState, Turn } from '../../engine/types'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { legoFx } from './localFx'
import scenario from './scenario'
import { T3_CP_PROFILE } from './turnsA'
import { T5_CP_PROFILE } from './turnsB'

type State = GameState<SecuritiesState>

function series(state: State, key: string, digits = 0): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  const snap = state.metricsHistory.find((m) => m.turnIndex === turnIndex)
  return snap?.metrics[key]?.value ?? NaN
}

function metricMin(state: State, key: string): number {
  return Math.min(...state.metricsHistory.map((m) => m.metrics[key]?.value ?? Infinity))
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

/**
 * 사후정보 토큰: 플레이어가 결정 전에 읽는 텍스트(이벤트·프롬프트·옵션 라벨/설명·힌트·결과 서사)에
 * 공표 시점 이전 턴에서 등장하면 안 되는 토큰과 최초 허용 턴. expert.rationale·trapExplanation은
 * 사후 평가 텍스트이므로 제외한다.
 */
const HINDSIGHT_TOKENS: [token: string, firstTurn: number][] = [
  ['50조', 4],
  ['채안펀드', 4],
  ['흥국', 5],
  ['95조', 5],
  ['12월 15일', 5],
  ['32%', 6],
  ['4.92', 6],
  ['매입프로그램', 7],
  ['1.8조', 7],
  ['3.25%', 7],
  ['5.54', 8],
  ['45일 연속', 7],
]

function playerVisibleText(turn: Turn<SecuritiesState>): string {
  const parts: string[] = [turn.title ?? '', turn.timeLabel]
  for (const ev of turn.events) {
    const e = ev as unknown as Record<string, unknown>
    for (const k of ['headline', 'body', 'subject', 'title'])
      if (typeof e[k] === 'string') parts.push(e[k] as string)
    if (Array.isArray(e.lines)) for (const l of e.lines as { text: string }[]) parts.push(l.text)
    if (Array.isArray(e.items))
      for (const i of e.items as { label: string; value: string; change?: string }[])
        parts.push(i.label, i.value, i.change ?? '')
    if (Array.isArray(e.rows))
      for (const r of e.rows as { label: string; value: string }[]) parts.push(r.label, r.value)
  }
  for (const d of turn.decisions) {
    parts.push(d.title, d.prompt, d.context ?? '')
    for (const o of d.options)
      parts.push(o.label, o.description, o.unavailableReason ?? '', o.consequences)
  }
  for (const h of turn.advisorHints ?? []) parts.push(h.text)
  for (const ce of turn.entryEffects ?? []) parts.push(ce.description ?? '')
  return parts.join('\n')
}

describe('legoland-2022 scenario', () => {
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

  it('every learning objective is practised in ≥2 decisions that exist', () => {
    const ids = new Set(scenario.turns.flatMap((t) => t.decisions.map((d) => d.id)))
    for (const lo of scenario.meta.learningObjectives) {
      expect(lo.decisionIds.length, lo.id).toBeGreaterThanOrEqual(2)
      for (const d of lo.decisionIds) expect(ids.has(d), `${lo.id} → ${d}`).toBe(true)
    }
  })

  it('contains no hindsight tokens in player-visible turn text before the announcement turn', () => {
    const problems: string[] = []
    scenario.turns.forEach((turn, ti) => {
      const text = playerVisibleText(turn)
      for (const [token, firstTurn] of HINDSIGHT_TOKENS) {
        if (ti < firstTurn && text.includes(token))
          problems.push(`T${ti} (${turn.id}): "${token}" (허용 T${firstTurn}+)`)
      }
    })
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('exogenous market path is invariant to decisions (CP91 / spread series)', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    const expert = autoplay(scenario, 'expert', { seed: 1 }).state
    for (const t of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(metricAt(hist, t, 'market.cp91')).toBe(metricAt(expert, t, 'market.cp91'))
      expect(metricAt(hist, t, 'market.creditSpreadAA')).toBe(
        metricAt(expert, t, 'market.creditSpreadAA'),
      )
    }
    expect(metricAt(hist, 6, 'market.cp91')).toBe(492)
    expect(metricAt(hist, 8, 'market.cp91')).toBe(554)
    expect(metricAt(hist, 0, 'market.cp91')).toBe(315)
  })

  it('historical path survives with NCR pressure (trough 100–150%, R2 reached, no settlement failure)', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] cash    ', series(s, 'cash'))
    console.log('[historical] NCR     ', series(s, 'ncr'))
    console.log('[historical] LR      ', series(s, 'liquidityRatio'))
    console.log('[historical] held    ', series(s, 'abcpHeld'))
    console.log('[historical] roll    ', series(s, 'rollRate'))
    console.log('[historical] CI      ', series(s, 'confidence'))
    console.log('[historical] reg     ', series(s, 'regulatorLevel'))
    console.log('[historical] mat30   ', series(s, 'abcpMaturing30'))
    console.log('[historical] ownCp   ', series(s, 'ownCpRate', 1))
    console.log('[historical] g/e     ', series(s, 'guaranteeToEquity'))
    console.log('[historical] cp91    ', series(s, 'market.cp91'))
    console.log(
      '[historical] bought  ',
      s.counters.abcpBought,
      'cpRunoff',
      s.counters.cpRunoff,
      'ended',
      s.ended?.reason,
      s.ended?.title,
    )
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('특례')
    // no settlement failure: cash at every turn start ≥ 0
    for (const m of s.metricsHistory) expect(m.metrics.cash!.value).toBeGreaterThanOrEqual(0)
    const ncrMin = metricMin(s, 'ncr')
    expect(ncrMin).toBeGreaterThan(100)
    expect(ncrMin).toBeLessThan(150)
    expect(Math.max(...s.metricsHistory.map((m) => m.metrics.regulatorLevel!.value))).toBe(2)
    // self-purchase cumulative within the CAL band
    expect(s.counters.abcpBought).toBeGreaterThanOrEqual(1900)
    expect(s.counters.abcpBought).toBeLessThanOrEqual(2900)
    // programme used, call honoured
    expect(s.flags.programme_used).toBe(true)
    expect(s.flags.call_exercised).toBe(true)
    expect(s.flags.call_skipped).toBeUndefined()
    logScore('historical', s)
  })

  it('expert path reaches the soft landing and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] cash    ', series(s, 'cash'))
    console.log('[expert] NCR     ', series(s, 'ncr'))
    console.log('[expert] LR      ', series(s, 'liquidityRatio'))
    console.log('[expert] held    ', series(s, 'abcpHeld'))
    console.log('[expert] roll    ', series(s, 'rollRate'))
    console.log('[expert] CI      ', series(s, 'confidence'))
    console.log('[expert] reg     ', series(s, 'regulatorLevel'))
    console.log('[expert] mat30   ', series(s, 'abcpMaturing30'))
    console.log('[expert] ownCp   ', series(s, 'ownCpRate', 1))
    console.log('[expert] g/e     ', series(s, 'guaranteeToEquity'))
    console.log(
      '[expert] bought  ',
      s.counters.abcpBought,
      'extended',
      s.counters.abcpExtended,
      'ended',
      s.ended?.reason,
      s.ended?.title,
    )
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('연착륙')
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(metricMin(s, 'ncr')).toBeGreaterThan(metricMin(hist, 'ncr'))
    expect(metricMin(s, 'liquidityRatio')).toBeGreaterThan(metricMin(hist, 'liquidityRatio'))
    expect(s.counters.abcpBought!).toBeLessThan(hist.counters.abcpBought!)
    const expert = logScore('expert', s)
    expect(expert.total).toBeGreaterThan(computeScore(hist, scenario).total)
  })

  it('trap: skipping the call (흥국생명) closes the CP market and scores below the historical path', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 })
    const choices: Record<string, string | string[]> = {
      ...scenario.paths.historical.choices,
      't5-d3': ['t5-d3-b'],
    }
    const perTurn: Record<number, [string, string[]][]> = {}
    scenario.turns.forEach((t, ti) => {
      perTurn[ti] = t.decisions
        .filter((d) => choices[d.id] !== undefined)
        .map((d) => [d.id, [choices[d.id]!].flat()])
    })
    const s = drive(perTurn)
    console.log('[trap:call] CI   ', series(s, 'confidence'))
    console.log('[trap:call] cash ', series(s, 'cash'))
    console.log('[trap:call] ended', s.ended?.reason, s.ended?.title)
    expect(s.flags.call_skipped).toBe(true)
    expect(s.ended?.title).not.toContain('연착륙')
    expect(metricAt(s, 5, 'confidence')).toBeLessThan(metricAt(hist.state, 5, 'confidence') - 15)
    expect(s.counters.cpRunoff!).toBeGreaterThan(hist.state.counters.cpRunoff!)
    expect(computeScore(s, scenario).total).toBeLessThan(computeScore(hist.state, scenario).total)
  })

  it('trap: abandoning the purchase commitment leads to market exit (game over reachable)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-e']]],
      1: [
        ['t1-d1', ['t1-d1-c']],
        ['t1-d2', ['t1-d2-d']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-d2', ['t2-d2-b']],
      ],
      3: [
        ['t3-d1', ['t3-d1-c']],
        ['t3-d2', ['t3-d2-b']],
        ['t3-d3', ['t3-d3-c']],
      ],
    })
    console.log('[trap:abandon] CI   ', series(s, 'confidence'))
    console.log('[trap:abandon] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.flags.abcp_default).toBe(true)
    expect(s.ended?.reason).toBe('market_exit')
    expect(s.ended?.failed).toBe(true)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('collapse path: fire sale + prop bet + buyback + skipped call breaches NCR / cash (game over reachable)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-e']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-d']],
      ],
      2: [
        ['t2-d1', ['t2-d1-a']],
        ['t2-d2', ['t2-d2-c', 't2-d2-e']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-c']],
        ['t3-d3', ['t3-d3-e', 't3-d3-c']],
      ],
      4: [
        ['t4-d1', ['t4-d1-a']],
        ['t4-d2', ['t4-d2-d', 't4-d2-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-d2', ['t5-d2-e']],
        ['t5-d3', ['t5-d3-b']],
      ],
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-d']],
      ],
      7: [
        ['t7-d1', ['t7-d1-a']],
        ['t7-d2', ['t7-d2-c']],
      ],
      8: [
        ['t8-d1', ['t8-d1-a']],
        ['t8-d2', ['t8-d2-b']],
      ],
    })
    console.log('[collapse] cash ', series(s, 'cash'))
    console.log('[collapse] NCR  ', series(s, 'ncr'))
    console.log('[collapse] LR   ', series(s, 'liquidityRatio'))
    console.log('[collapse] CI   ', series(s, 'confidence'))
    console.log('[collapse] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.failed).toBe(true)
    expect(['pca_recommend', 'pca_require', 'insolvent']).toContain(s.ended?.reason)
  })

  it('collapse path: redeeming the sub-debt in cash at an NCR trough triggers 경영개선요구 (NCR < 50)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-e']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-d']],
      ],
      2: [
        ['t2-d1', ['t2-d1-a']],
        ['t2-d2', ['t2-d2-c', 't2-d2-e']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-c']],
        ['t3-d3', ['t3-d3-e', 't3-d3-c']],
      ],
      4: [
        ['t4-d1', ['t4-d1-a']],
        ['t4-d2', ['t4-d2-d', 't4-d2-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-d2', ['t5-d2-e']],
        ['t5-d3', ['t5-d3-c']],
      ],
    })
    console.log('[pca_require] NCR  ', series(s, 'ncr'))
    console.log('[pca_require] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('pca_require')
    expect(s.ended?.turnIndex).toBe(5)
  })

  it('collapse path: overnight-call dependence + skipped call ends in a settlement failure (insolvent)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-e']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-d']],
      ],
      2: [
        ['t2-d1', ['t2-d1-a']],
        ['t2-d2', ['t2-d2-d']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-b']],
        ['t3-d3', ['t3-d3-c']],
      ],
      4: [
        ['t4-d1', ['t4-d1-a']],
        ['t4-d2', ['t4-d2-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-d2', ['t5-d2-e']],
        ['t5-d3', ['t5-d3-b']],
      ],
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    console.log('[insolvent] cash ', series(s, 'cash'))
    console.log('[insolvent] NCR  ', series(s, 'ncr'))
    console.log('[insolvent] CI   ', series(s, 'confidence'))
    console.log('[insolvent] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('insolvent')
    expect(s.flags.insolvent).toBe(true)
  })

  it('policy windows are gated: 증권금융 before 10/26 and 한은 RP are unavailable', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-e'])
    s = advanceTurn(s, scenario)
    expect(() => applyDecision(s, scenario, 't1-d2', ['t1-d2-e'])).toThrow()
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = applyDecision(s, scenario, 't1-d2', ['t1-d2-a'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-d'])
    s = advanceTurn(s, scenario)
    expect(() => applyDecision(s, scenario, 't3-d3', ['t3-d3-a'])).toThrow()
  })

  // ------------------------------------------------------------------ L2: 틱 · 인터럽트 · 대화

  /** 같은 시나리오의 T3을 틱 이전 형태(하루치 단일 `cpRollStep`)로 되돌린 변형. */
  function untickedT3(): ScenarioDefinition<SecuritiesState> {
    return {
      ...scenario,
      turns: scenario.turns.map((t) => {
        if (t.id !== 't3') return t
        const { ticks, tickLabels, eachTick, tickEffects, ticker, interrupts, ...rest } = t
        void ticks
        void tickLabels
        void eachTick
        void tickEffects
        void ticker
        void interrupts
        return {
          ...rest,
          entryEffects: [
            ...(t.entryEffects ?? []),
            {
              id: 't3-cp-single',
              description: 'CP 만기(잔액 8%) 재발행 — 틱 이전 단일 호출',
              effects: [legoFx.cpRollStep({ share: 0.08 })],
            },
            {
              id: 't3-settle-single',
              description: '결제일 점검',
              effects: [legoFx.settlementCheck()],
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

  /** 역사 경로를 `turnIndex` 끝까지만 재생한 상태 (체크포인트 헬퍼와 같은 방식). */
  function stateAtTurnEnd(def: ScenarioDefinition<SecuritiesState>, turnIndex: number): State {
    const full = autoplay(def, 'historical', { seed: 1 })
    const log = full.decisions.filter((d) => d.turnIndex <= turnIndex)
    return replay(def, { seed: 1, decisions: log, turnIndex }).state
  }

  it('T3 CP tick slices sum exactly to the un-ticked single call at variance 0', () => {
    const ticked = stateAtTurnEnd(scenario, 3)
    const single = stateAtTurnEnd(untickedT3(), 3)
    console.log(
      '[ticks] T3 cpRunoff sliced',
      ticked.counters.cpRunoff,
      'single',
      single.counters.cpRunoff,
    )
    expect(Math.abs(ticked.counters.cpRunoff! - single.counters.cpRunoff!)).toBeLessThan(1e-9)
    expect(Math.abs(ticked.institution.funding.cp - single.institution.funding.cp)).toBeLessThan(
      1e-9,
    )
    expect(
      Math.abs(ticked.institution.liquidity.cash - single.institution.liquidity.cash),
    ).toBeLessThan(1e-9)
    // 프로필 합은 정확히 1이어야 한다 (린트가 길이만 검사하므로 저자 책임).
    const sum = (p: number[]) => p.reduce((x, y) => x + y, 0)
    expect(sum(T3_CP_PROFILE)).toBeCloseTo(1, 12)
    expect(sum(T5_CP_PROFILE)).toBeCloseTo(1, 12)
    expect(T3_CP_PROFILE).toHaveLength(4)
    expect(T5_CP_PROFILE).toHaveLength(4)
  })

  it('the T3 ticker walks the real ECOS closes and lands exactly on them', () => {
    const s = stateAtTurnEnd(scenario, 3)
    expect(s.market.custom.corpAA3y).toBe(574) // 회사채 AA- 3년 10/21 5.736%
    expect(s.market.custom.govt3y).toBe(450) // 국고채 3년 10/21 4.495%
    expect(s.market.custom.cp91).toBe(430) // CP(91일) 10/21 4.30%
    expect(s.market.custom.cd91).toBe(390) // CD(91일) 10/21 3.90%
    const s5 = stateAtTurnEnd(scenario, 5)
    expect(s5.market.custom.corpAA3y).toBe(549) // 11/1 5.486%
    expect(s5.market.custom.govt3y).toBe(407) // 11/1 4.068%
    expect(s5.market.custom.cd91).toBe(397) // 11/1 3.97%
    expect(s5.market.custom.creditSpreadAA).toBe(142)
  })

  it('an unanswered interrupt times out to its default option (historical choice)', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-e'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = applyDecision(s, scenario, 't1-d2', ['t1-d2-c'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-a'])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(3)
    s = applyDecision(s, scenario, 't3-d2', ['t3-d2-b'])
    s = applyDecision(s, scenario, 't3-d3', ['t3-d3-d'])
    s = advanceTick(s, scenario) // 11:00 — 주관사 전화가 도착한다
    expect(s.openInterrupts).toContain('t3-i1-arranger')
    s = advanceTick(s, scenario) // 14:00 — 마감 스윕이 기본 옵션으로 확정한다
    expect(s.openInterrupts).not.toContain('t3-i1-arranger')
    const rec = s.decisions.find((d) => d.decisionId === 't3-i1-arranger')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t3-i1-a'])
    expect(rec!.timedOut).toBe(true)
    expect(rec!.interrupt).toBe(true)
    // 기본 옵션 = 역사 선택이므로 무응답 플레이는 역사 경로로 수렴한다 (차환률 불변).
    const it3 = scenario.turns[3]!.interrupts!.find((i) => i.id === 't3-i1-arranger')!
    expect(it3.options.find((o) => o.id === it3.defaultOptionId)?.historical).toBe(true)
    expect(s.institution.pf.rollRate).toBeCloseTo(0.35, 10)
  })

  it('the T4 증권금융 dialogue walks and replays exactly (ksfcRequested is committed)', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const rec = r.decisions.find((d) => d.decisionId === 't4-d3')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t4-d3-a'])
    expect(rec!.path).toEqual(['coll-full', 'ksfcRequested-1000', 'time-today'])
    expect(r.state.counters.ksfcRequested).toBe(1000)
    expect(r.state.flags.ksfc_collateral_ready).toBe(true)
    expect(r.state.flags.ksfc_over_requested).toBeUndefined()
    const back = replay(scenario, { seed: 1, decisions: r.decisions })
    expect(back.state.counters.ksfcRequested).toBe(1000)
    expect(back.state.decisions.find((d) => d.decisionId === 't4-d3')!.path).toEqual(rec!.path)
    expect(back.state.counters.abcpBought).toBeCloseTo(r.state.counters.abcpBought!, 10)
  })

  it('over-requesting the 증권금융 line (2,000억) is judged one turn later (ΔCI −3)', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-e'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = applyDecision(s, scenario, 't1-d2', ['t1-d2-c'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-a'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't3-d2', ['t3-d2-b'])
    s = applyDecision(s, scenario, 't3-d3', ['t3-d3-d'])
    s = fastForwardTicks(s, scenario)
    s = applyDecision(s, scenario, 't3-d1', ['t3-d1-a'])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(4)
    s = applyDecision(s, scenario, 't4-d1', ['t4-d1-a'])
    s = applyDecision(s, scenario, 't4-d2', ['t4-d2-a'])
    s = applyDecision(s, scenario, 't4-d3', ['t4-d3-a'], {
      path: ['coll-full', 'ksfcRequested-2000', 'time-today'],
    })
    expect(s.counters.ksfcRequested).toBe(2000)
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(5)
    expect(s.flags.ksfc_over_requested).toBe(true)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(metricAt(s, 5, 'confidence')).toBeLessThan(metricAt(hist, 5, 'confidence'))
  })

  it('worst and random policies complete without NaN and with scores in [0,100]', () => {
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
