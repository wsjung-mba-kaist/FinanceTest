import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  computeScore,
  createGame,
  getNumberPath,
  getTurnView,
  latestSnapshot,
  replay,
  validateScenario,
} from '../../engine'
import type {
  Checkpoint,
  GameState,
  Interrupt,
  ScenarioDefinition,
  SecuritiesState,
  Turn,
} from '../../engine/types'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import scenario from './scenario'
import { ELS_FACTS } from './facts'
import { elsInitialConfidence, elsInitialMarket, elsInitialSecurities } from './initialState'
import { marginCallStep } from './fx'
import { MARGIN, T1_PROFILE } from './turnsA'

type State = GameState<SecuritiesState>

function series(state: State, key: string, digits = 0): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  return state.metricsHistory.find((m) => m.turnIndex === turnIndex)?.metrics[key]?.value ?? NaN
}

function metricMin(state: State, key: string): number {
  return Math.min(...state.metricsHistory.map((m) => m.metrics[key]?.value ?? Infinity))
}

/**
 * Drives a hand-picked path: { turnIndex: [[decisionId, optionIds], ...] }. Ticks are advanced until
 * each named decision opens (`availableFrom`), and interrupts are answered with their default option
 * unless the path names them. Stops when the game ends.
 */
function drive(perTurn: Record<number, [string, string[]][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    const wanted = perTurn[s.turnIndex] ?? []
    const done = new Set<string>()
    for (;;) {
      const view = getTurnView(s, scenario, { mode: 'standard' })
      const open = view.interrupts.find((i) => !i.resolved)
      if (open) {
        const named = wanted.find(([id]) => id === open.decision.id)
        const ids = named
          ? named[1]
          : [(open.decision as Interrupt<SecuritiesState>).defaultOptionId]
        s = applyDecision(s, scenario, open.decision.id, ids)
        if (named) done.add(named[0])
        if (s.phase === 'ended') break
        continue
      }
      let acted = false
      for (const [decisionId, optionIds] of wanted) {
        if (done.has(decisionId)) continue
        const dv = view.decisions.find((d) => d.decision.id === decisionId)
        if (!dv || dv.resolved) continue
        s = applyDecision(s, scenario, decisionId, optionIds)
        done.add(decisionId)
        acted = true
        break
      }
      if (s.phase === 'ended') break
      if (acted) continue
      if (done.size < wanted.length && canAdvanceTick(s, scenario)) {
        s = advanceTick(s, scenario)
        continue
      }
      break
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

/** Same evaluation the shared autoplay suite uses: replay the historical log up to the checkpoint. */
function checkpointActual(cp: Checkpoint): number | undefined {
  const def = scenario as unknown as ScenarioDefinition
  const turnIndex = def.turns.findIndex((t) => t.id === cp.turnId)
  const full = autoplay(def, 'historical', { seed: 1 })
  const log = full.decisions.filter(
    (d) =>
      d.turnIndex < turnIndex ||
      (d.turnIndex === turnIndex && (cp.tick === undefined || (d.tick ?? 0) <= cp.tick)),
  )
  const { state } = replay(def, { seed: 1, decisions: log, turnIndex, tick: cp.tick })
  if (state.turnIndex !== turnIndex) return undefined
  if (cp.metric) return latestSnapshot(state).metrics[cp.metric]?.value
  if (cp.counter) return state.counters[cp.counter] ?? 0
  if (cp.path) return getNumberPath(state, cp.path)
  return undefined
}

/**
 * 사후정보 토큰: 플레이어가 결정 전에 읽는 텍스트에 공표 시점 이전 턴에서 등장하면 안 되는 토큰과
 * 최초 허용 턴. expert.rationale·trapExplanation은 사후 평가 텍스트이므로 제외한다.
 */
const HINDSIGHT_TOKENS: [token: string, firstTurn: number][] = [
  ['공매도', 1],
  ['0.75%', 2],
  ['임시 금융통화위원회', 2],
  ['82.69', 2],
  ['1,285.7', 3],
  ['1,457.64', 3],
  ['비상경제회의', 3],
  ['통화스왑', 4],
  ['통화스와프', 4],
  ['100조', 5],
  ['채권시장안정펀드', 5],
  ['증권시장안정펀드', 5],
  ['무제한', 6],
  ['0.85%', 6],
  ['87.2억', 7],
  ['2.24%', 7],
  ['건전화 방안', 8],
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
  const decisions = [...turn.decisions, ...(turn.interrupts ?? [])]
  for (const d of decisions) {
    parts.push(d.title, d.prompt, d.context ?? '')
    for (const o of d.options)
      parts.push(o.label, o.description, o.unavailableReason ?? '', o.consequences)
    for (const st of d.steps ?? []) {
      for (const l of st.lines) parts.push(l.text)
      for (const r of st.replies) parts.push(r.label)
      parts.push(st.note ?? '')
    }
  }
  for (const it of turn.interrupts ?? []) for (const l of it.lines) parts.push(l.text)
  for (const h of turn.advisorHints ?? []) parts.push(h.text)
  for (const ce of turn.entryEffects ?? []) parts.push(ce.description ?? '')
  return parts.join('\n')
}

describe('els-margin-2020 scenario', () => {
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

  it('fact ledger matches the initial state it documents', () => {
    const init = {
      institution: elsInitialSecurities,
      market: elsInitialMarket,
      confidence: elsInitialConfidence,
    }
    const resolve = (path: string): unknown => {
      let cur: unknown = init
      for (const seg of path.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined
        cur = (cur as Record<string, unknown>)[seg]
      }
      return cur
    }
    const drift: string[] = []
    let checked = 0
    for (const f of ELS_FACTS) {
      const root = f.path.split('.')[0]!
      if (!['institution', 'market', 'confidence'].includes(root)) continue
      const actual = resolve(f.path)
      expect(typeof actual, `${f.path}는 숫자 리프여야 합니다`).toBe('number')
      checked++
      if (Math.abs((actual as number) - f.value) > 1e-9)
        drift.push(`${f.path}: 원장 ${f.value} vs 초기 상태 ${String(actual)}`)
    }
    expect(drift, `원장과 초기 상태가 다릅니다:\n${drift.join('\n')}`).toEqual([])
    expect(checked).toBeGreaterThan(30)
  })

  it('every learning objective is practised in ≥2 decisions that exist', () => {
    const ids = new Set(
      scenario.turns.flatMap((t) => [
        ...t.decisions.map((d) => d.id),
        ...(t.interrupts ?? []).map((i) => i.id),
      ]),
    )
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

  it('exogenous market path is invariant to decisions (KOSPI / FX / CP / CD)', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    const expert = autoplay(scenario, 'expert', { seed: 1 }).state
    for (const t of [1, 2, 3, 4, 5, 6, 7]) {
      expect(metricAt(hist, t, 'market.cp91')).toBe(metricAt(expert, t, 'market.cp91'))
      expect(metricAt(hist, t, 'market.cd91')).toBe(metricAt(expert, t, 'market.cd91'))
      expect(metricAt(hist, t, 'market.oseaIndex')).toBe(metricAt(expert, t, 'market.oseaIndex'))
    }
    expect(metricAt(hist, 7, 'market.cp91')).toBe(220)
    expect(metricAt(hist, 0, 'market.cd91')).toBe(139)
  })

  it('historical path reproduces every checkpoint', () => {
    const failures: string[] = []
    for (const cp of scenario.checkpoints ?? []) {
      const actual = checkpointActual(cp)
      const target = cp.metric ?? cp.counter ?? cp.path
      if (actual === undefined || !Number.isFinite(actual)) {
        failures.push(`${cp.label}: ${target} 값을 얻지 못했습니다`)
        continue
      }
      const rel =
        cp.expected === 0
          ? Math.abs(actual)
          : Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      const abs = Math.abs(actual - cp.expected)
      const ok = rel <= cp.tolerance || (cp.absTolerance !== undefined && abs <= cp.absTolerance)
      console.log(
        `[checkpoint] ${target}@${cp.turnId}: ${actual.toFixed(1)} vs ${cp.expected} (${(rel * 100).toFixed(1)}%)`,
      )
      if (!ok)
        failures.push(
          `${cp.label}: actual ${actual} vs expected ${cp.expected} (rel ${(rel * 100).toFixed(1)}% > ${(cp.tolerance * 100).toFixed(0)}%)`,
        )
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })

  it('historical path survives with the dollar squeeze visible (no settlement failure)', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] cash    ', series(s, 'cash'))
    console.log('[historical] fxLiquid', series(s, 'fxLiquid'))
    console.log('[historical] margin  ', series(s, 'marginCallPending'))
    console.log('[historical] NCR     ', series(s, 'ncr'))
    console.log('[historical] LR      ', series(s, 'liquidityRatio'))
    console.log('[historical] CI      ', series(s, 'confidence'))
    console.log('[historical] delta   ', series(s, 'hedgeDelta', 2))
    console.log('[historical] roll    ', series(s, 'rollRate'))
    console.log('[historical] mat30   ', series(s, 'abcpMaturing30'))
    console.log('[historical] ownCp   ', series(s, 'ownCpRate', 2))
    console.log(
      '[historical] called',
      s.counters.marginCalled?.toFixed(0),
      'paid',
      s.counters.marginPaid?.toFixed(0),
      'cpShortfall',
      s.counters.cpShortfall?.toFixed(0),
      'ended',
      s.ended?.reason,
      s.ended?.title,
    )
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.flags.margin_default).toBeUndefined()
    expect(s.flags.insolvent).toBeUndefined()
    for (const m of s.metricsHistory) expect(m.metrics.cash!.value).toBeGreaterThanOrEqual(0)
    // the squeeze is real: FX liquidity is nearly exhausted at least once
    expect(metricMin(s, 'fxLiquid')).toBeLessThan(600)
    // …while won liquidity never is
    expect(Math.min(...s.metricsHistory.map((m) => m.metrics.cash!.value))).toBeGreaterThan(3000)
    // NCR never becomes the binding constraint on the historical path
    expect(metricMin(s, 'ncr')).toBeGreaterThan(600)
    logScore('historical', s)
  })

  it('expert path keeps a dollar buffer and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] cash    ', series(s, 'cash'))
    console.log('[expert] fxLiquid', series(s, 'fxLiquid'))
    console.log('[expert] margin  ', series(s, 'marginCallPending'))
    console.log('[expert] NCR     ', series(s, 'ncr'))
    console.log('[expert] LR      ', series(s, 'liquidityRatio'))
    console.log('[expert] CI      ', series(s, 'confidence'))
    console.log('[expert] delta   ', series(s, 'hedgeDelta', 2))
    console.log(
      '[expert] b2b',
      s.counters.b2bConverted?.toFixed(0),
      'fxCost',
      s.counters.fxCost?.toFixed(0),
      'ended',
      s.ended?.reason,
      s.ended?.title,
    )
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.flags.margin_default).toBeUndefined()
    expect(s.flags.fx_policy_set).toBe(true)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(metricMin(s, 'fxLiquid')).toBeGreaterThan(metricMin(hist, 'fxLiquid'))
    expect(s.institution.hedge.elsSelfHedged).toBeLessThan(hist.institution.hedge.elsSelfHedged)
    const expert = logScore('expert', s)
    expect(expert.total).toBeGreaterThan(computeScore(hist, scenario).total)
  })

  it('won liquidity without dollars: KRW-heavy funding still fails the overseas margin cut-off', () => {
    const s = drive({
      0: [['t0-d1', ['t0-d']]],
      1: [['t1-d1', ['t1-d1-d']]],
      2: [
        ['t2-d1', ['t2-d1-b', 't2-d1-d']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [
        ['t3-i1', ['t3-i1-decline']],
        ['t3-d1', ['t3-d1-f']],
      ],
    })
    const lastCash = s.metricsHistory[s.metricsHistory.length - 1]!.metrics.cash!.value
    const lastFx = s.metricsHistory[s.metricsHistory.length - 1]!.metrics.fxLiquid!.value
    console.log('[krw-only] cash    ', series(s, 'cash'))
    console.log('[krw-only] fxLiquid', series(s, 'fxLiquid'))
    console.log('[krw-only] margin  ', series(s, 'marginCallPending'))
    console.log('[krw-only] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.flags.margin_default).toBe(true)
    expect(s.ended?.reason).toBe('margin_default')
    expect(s.ended?.failed).toBe(true)
    // the whole point: plenty of won, no dollars
    expect(lastCash).toBeGreaterThan(8000)
    expect(lastFx).toBeLessThan(200)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('game over is reachable: NCR breach after unwinding the hedge (경영개선권고)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-a', 't0-b']]],
      1: [['t1-d1', ['t1-d1-c', 't1-d1-e']]],
      2: [
        ['t2-d1', ['t2-d1-a', 't2-d1-c']],
        ['t2-d2', ['t2-d2-c']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d', 't3-d1-f']],
        ['t3-d2', ['t3-d2-b']],
      ],
      4: [
        ['t4-d1', ['t4-d1-c']],
        ['t4-d2', ['t4-d2-c']],
      ],
      5: [
        ['t5-d1', ['t5-d1-c']],
        ['t5-d2', ['t5-d2-a']],
      ],
    })
    console.log('[ncr] NCR  ', series(s, 'ncr'))
    console.log('[ncr] delta', series(s, 'hedgeDelta', 2))
    console.log('[ncr] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('pca_recommend')
    expect(s.ended?.failed).toBe(true)
  })

  it('game over is reachable: won settlement failure (insolvent)', () => {
    const s = drive({
      0: [['t0-d1', ['t0-a', 't0-c']]],
      1: [['t1-d1', ['t1-d1-a', 't1-d1-c']]],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-b', 't2-d2-a']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d', 't3-d1-b']],
        ['t3-d2', ['t3-d2-b']],
      ],
      4: [
        ['t4-d1', ['t4-d1-c']],
        ['t4-d2', ['t4-d2-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-d']],
        ['t5-d2', ['t5-d2-a']],
      ],
      6: [
        ['t6-d1', ['t6-d1-c']],
        ['t6-d2', ['t6-d2-a']],
      ],
    })
    console.log('[insolvent] cash ', series(s, 'cash'))
    console.log('[insolvent] ended', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('insolvent')
    expect(s.flags.insolvent).toBe(true)
  })

  it('policy windows are gated by their announcement date', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-e'])
    s = advanceTurn(s, scenario) // → T1 (틱 턴)
    // 틱이 열리기 전에는 결정 자체를 답할 수 없다
    expect(() => applyDecision(s, scenario, 't1-d1', ['t1-d1-d'])).toThrow()
    s = advanceTick(s, scenario)
    s = applyDecision(s, scenario, 't1-i1', ['t1-i1-check'])
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-d'])
    s = advanceTurn(s, scenario) // → T2
    // 증권사가 쓸 수 있는 한국은행 외화 공급 창구는 아직 없다
    expect(() => applyDecision(s, scenario, 't2-d2', ['t2-d2-d'])).toThrow()
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-b'])
    s = advanceTurn(s, scenario) // → T3
    s = advanceTick(s, scenario)
    expect(() => applyDecision(s, scenario, 't3-d1', ['t3-d1-a'])).toThrow()
  })

  it('ticks: the sliced margin call equals the un-ticked single call at variance 0', () => {
    const base = scenario as unknown as ScenarioDefinition<SecuritiesState>
    // A clone of T1 with no ticks and one un-sliced margin call.
    const flat: ScenarioDefinition<SecuritiesState> = {
      ...base,
      meta: { ...base.meta, id: 'els-margin-2020-flat' },
      turns: base.turns.map((t, i) => {
        if (i !== 1) return t
        const { ticks: _ticks, tickLabels: _l, ticker: _tk, ...rest } = t
        return {
          ...rest,
          eachTick: [
            {
              id: 't1-margin-flat',
              effects: [marginCallStep({ ...MARGIN.t1, label: '3/13 증거금 통지(단일)' })],
            },
          ],
          tickEffects: (t.tickEffects ?? []).map((ce) => ({ ...ce, atTick: 0 })),
          interrupts: [],
          decisions: t.decisions.map((d) => {
            const { availableFrom: _a, deadlineTick: _d, ...dr } = d
            return dr
          }),
          events: t.events.map((e) => ({ ...e, atTick: 0 })),
        }
      }),
    }
    const ticked = autoplay(scenario, 'historical', { seed: 1, variance: 0 })
    const single = autoplay(flat, 'historical', { seed: 1, variance: 0 })
    const tickedCalled = ticked.history[2]!.counters.marginCalled ?? 0
    const singleCalled = single.history[2]!.counters.marginCalled ?? 0
    console.log('[ticks] sliced', tickedCalled.toFixed(4), 'single', singleCalled.toFixed(4))
    expect(T1_PROFILE.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(tickedCalled).toBeCloseTo(singleCalled, 6)
  })

  it('interrupts: an unanswered interrupt times out to its default option', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-e'])
    s = advanceTurn(s, scenario) // → T1, tick 0
    expect(s.turnIndex).toBe(1)
    // advanceTurn fast-forwards every remaining tick, so the interrupt opens at tick 1 and the
    // deadline sweep commits its `defaultOptionId` without any answer (and without a dialogue path).
    s = advanceTick(s, scenario)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-d'])
    s = advanceTurn(s, scenario)
    const record = s.decisions.find((d) => d.decisionId === 't1-i1')
    console.log('[interrupt]', record)
    expect(record).toBeDefined()
    expect(record!.optionIds).toEqual(['t1-i1-check'])
    expect(record!.timedOut).toBe(true)
    expect(record!.interrupt).toBe(true)
  })

  it('dialogues: historical and expert walks reach their path options and record the reply path', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 })
    const expert = autoplay(scenario, 'expert', { seed: 1 })
    const swapHist = hist.decisions.find((d) => d.decisionId === 't3-i1')
    const swapExpert = expert.decisions.find((d) => d.decisionId === 't3-i1')
    console.log('[dialogue] historical', swapHist?.optionIds, swapHist?.path)
    console.log('[dialogue] expert    ', swapExpert?.optionIds, swapExpert?.path)
    expect(swapHist?.optionIds).toEqual(['t3-i1-half'])
    expect(swapExpert?.optionIds).toEqual(['t3-i1-full'])
    expect(swapExpert?.path?.length).toBeGreaterThan(0)
    // the numeric promise is recorded as a counter and judged by a delayed effect
    expect(expert.state.counters.fxSwapBidBp).toBe(120)
    expect(hist.state.counters.fxSwapBidBp).toBe(60)
  })

  it('worst and random policies complete without NaN and with scores in [0,100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
        expect(json.includes('Infinity')).toBe(false)
        expect(r.state.ended).toBeDefined()
        const score = computeScore(r.state, scenario)
        expect(Number.isFinite(score.total)).toBe(true)
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
