import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  computeScore,
  createGame,
  isDecisionResolved,
  latestSnapshot,
  makeEffectContext,
  validateScenario,
  type CentralBankState,
  type GameState,
} from '../../engine'
import { validateDialogue } from '../../engine/core/dialogue'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { imfFx } from './fx'
import scenario from './scenario'

type State = GameState<CentralBankState>
/** [decisionId, optionIds, 대화 경로(선택)] */
type DriveStep = [string, string[]] | [string, string[], string[]]

function series(state: State, key: string, digits = 1): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  const snap = state.metricsHistory.find((m) => m.turnIndex === turnIndex)
  return snap?.metrics[key]?.value ?? NaN
}

function tickValue(state: State, turnIndex: number, tick: number, key: string): number {
  return (
    state.tickHistory.find((t) => t.turnIndex === turnIndex && t.tick === tick)?.values[key] ?? NaN
  )
}

/**
 * Drives a hand-picked path: { turnIndex: [[decisionId, optionIds], ...] }. Decisions with an
 * `availableFrom` tick are answered once the turn's clock reaches them, so ticked turns behave the
 * way a player would experience them. Stops when the game ends.
 */
function drive(perTurn: Record<number, DriveStep[]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    const wanted = perTurn[s.turnIndex] ?? []
    let guard = 0
    for (;;) {
      const turn = scenario.turns[s.turnIndex]!
      let applied = false
      for (const [decisionId, optionIds, path] of wanted) {
        if (isDecisionResolved(s as GameState, decisionId)) continue
        const decision = turn.decisions.find((d) => d.id === decisionId)
        if (!decision || (decision.availableFrom ?? 0) > s.tick) continue
        s = applyDecision(s, scenario, decisionId, optionIds, path ? { path } : {})
        applied = true
        if (s.phase === 'ended') break
      }
      if (s.phase === 'ended') break
      const pending = wanted.some(([id]) => !isDecisionResolved(s as GameState, id))
      if (!pending || !canAdvanceTick(s, scenario)) break
      if (!applied) s = advanceTick(s, scenario)
      if (++guard > 32) break
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

/** 사후정보 토큰: 턴 텍스트(엔딩·디브리핑 제외)에는 등장하면 안 된다. */
const FORBIDDEN_IN_TURNS = [
  '1998년 4월',
  '1998년 5월',
  '1998년 6월',
  '공적자금',
  '금융감독위원회',
  '인가취소',
  '뉴브리지',
  '한아름',
]

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

/** Applies `runoffStep` tick by tick against a fresh game, so slices can be compared with one call. */
function applyRunoffSlices(total: number, profile: number[]): State {
  const base = createGame(scenario, 1)
  let s: State = base
  const ticks = profile.length
  for (let t = 0; t < ticks; t++) {
    s = produce(s, (d) => {
      d.tick = t
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState), { ticks })
      const e = imfFx.runoffStep({ total, profile })
      if (e.kind === 'fn') e.apply(d, ctx)
    })
  }
  return s
}

describe('korea-imf-1997 scenario', () => {
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

  it('contains no hindsight tokens in turn or briefing text', () => {
    const strings: string[] = []
    collectTurnText(scenario.turns, strings)
    expect(strings.length).toBeGreaterThan(200)
    for (const token of FORBIDDEN_IN_TURNS) {
      const hits = strings.filter((s) => s.includes(token))
      expect(hits, `forbidden token "${token}" in turn text`).toEqual([])
    }
    const briefing: string[] = []
    collectTurnText(scenario.briefing, briefing)
    for (const token of FORBIDDEN_IN_TURNS) {
      const hits = briefing.filter((s) => s.includes(token) && !s.includes('디브리핑에서만'))
      expect(hits, `forbidden token "${token}" in briefing`).toEqual([])
    }
  })

  it('keeps the usable/gross distinction wired to the dashboard', () => {
    // 선언된 초기값 (T0 진입 효과 이전)
    const init = scenario.initialState.institution
    expect(init.reserves.usable).toBeCloseTo(223.0, 9)
    expect(init.reserves.gross).toBeCloseTo(305.1, 9)
    expect(init.reserves.gross - init.reserves.usable).toBeCloseTo(82.1, 9)
    // T0 진입 직후의 대시보드 (진입 유출 0.2억달러 반영)
    const s = createGame(scenario, 1)
    const m = latestSnapshot(s as GameState).metrics
    expect(m.usableReserves!.value).toBeCloseTo(222.8, 6)
    expect(m.grossReserves!.value).toBeCloseTo(304.9, 6)
    expect(m.reserveGap!.value).toBeCloseTo(82.1, 6)
    // both are KPIs, and exactly one primary is flagged
    const kpiKeys = scenario.kpis.map((k) => k.metric)
    expect(kpiKeys).toContain('usableReserves')
    expect(kpiKeys).toContain('grossReserves')
    expect(scenario.kpis.filter((k) => k.primary)).toHaveLength(1)
    expect(scenario.kpis.length).toBeGreaterThanOrEqual(4)
    expect(scenario.kpis.length).toBeLessThanOrEqual(6)
  })

  it('historical path reproduces every checkpoint and never goes negative', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] usable ', series(s, 'usableReserves'))
    console.log('[historical] gross  ', series(s, 'grossReserves'))
    console.log('[historical] gap    ', series(s, 'reserveGap'))
    console.log('[historical] fx     ', series(s, 'fxSpot'))
    console.log('[historical] guidotti', series(s, 'guidottiRatio'))
    console.log('[historical] CI     ', series(s, 'confidence', 0))
    console.log('[historical] ended  ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)

    // 1) 11월 말 가용 72.6억달러 / 총액 244억달러
    expect(metricAt(s, 4, 'usableReserves')).toBeCloseTo(72.6, 1)
    expect(metricAt(s, 4, 'grossReserves')).toBeGreaterThan(244 * 0.85)
    expect(metricAt(s, 4, 'grossReserves')).toBeLessThan(244 * 1.15)
    // 2) 12/18 (T8 틱 1) 가용 39억달러
    const dec18 = tickValue(s, 8, 1, 'usableReserves')
    console.log('[historical] 12/18 usable', dec18)
    expect(dec18).toBeGreaterThan(39 * 0.85)
    expect(dec18).toBeLessThan(39 * 1.15)
    // 3) 12/23 종가 1,962원 (장중 고가 1,995원은 틱 4에서만 보인다)
    expect(metricAt(s, 8, 'fxSpot')).toBeCloseTo(1962.0, 1)
    expect(tickValue(s, 8, 4, 'fxSpot')).toBeCloseTo(1995.0, 1)
    // 4) IMF 승인 210억달러, 종금사 업무정지 누계 14개사
    expect(metricAt(s, 7, 'imfCommitted')).toBeCloseTo(210.0, 6)
    expect(s.counters.suspendedMerchantBanks).toBeCloseTo(14, 6)
    // 5) 정부보증 전환 218.4억달러
    expect(s.counters.rolloverConverted).toBeCloseTo(218.4, 6)
    // 누적 환율방어 소진 ≈ 151억달러 (도시에: 10~11월 약 151억달러)
    console.log('[historical] interventionTotal', s.counters.interventionTotal)
    expect(s.counters.interventionTotal).toBeGreaterThan(130)
    expect(s.counters.interventionTotal).toBeLessThan(165)
    // 가용보유액은 역사 경로에서 음수가 되지 않는다
    for (const t of s.tickHistory) expect(t.values.usableReserves).toBeGreaterThan(0)
    logScore('historical', s)
  })

  it('keeps the drain multiplier at exactly 1.0 on the historical path (calibration invariant)', () => {
    // 각 턴의 runoffStep total 은 "역사 경로에서 실제로 빠져나간 금액"이므로 계수는 1이어야 한다.
    const choices = scenario.paths.historical.choices
    const perTurn: Record<number, [string, string[]][]> = {}
    scenario.turns.forEach((turn, i) => {
      perTurn[i] = turn.decisions
        .filter((d) => choices[d.id] !== undefined)
        .map((d) => [d.id, [choices[d.id]!].flat()] as [string, string[]])
    })
    const seen: number[] = []
    let s = createGame(scenario, 1)
    while (s.phase !== 'ended') {
      seen.push(s.counters.drainMultiplier ?? 1)
      const turn = scenario.turns[s.turnIndex]!
      const wanted = perTurn[s.turnIndex] ?? []
      let guard = 0
      for (;;) {
        let applied = false
        for (const [id, opts] of wanted) {
          if (isDecisionResolved(s as GameState, id)) continue
          const decision = turn.decisions.find((d) => d.id === id)
          if (!decision || (decision.availableFrom ?? 0) > s.tick) continue
          s = applyDecision(s, scenario, id, opts)
          applied = true
          if (s.phase === 'ended') break
        }
        // 인터럽트도 역사 경로대로 답한다 (무응답 기본값은 역사 선택과 다를 수 있다)
        for (const id of [...s.openInterrupts]) {
          const pick = choices[id]
          if (pick === undefined) continue
          s = applyDecision(s, scenario, id, [pick].flat())
          applied = true
          if (s.phase === 'ended') break
        }
        if (s.phase === 'ended') break
        const pending = wanted.some(([id]) => !isDecisionResolved(s as GameState, id))
        if (!pending || !canAdvanceTick(s, scenario)) break
        if (!applied) s = advanceTick(s, scenario)
        if (++guard > 32) break
      }
      if (s.phase === 'ended') break
      s = advanceTurn(s, scenario)
    }
    console.log('[historical] drainMultiplier by turn', seen)
    for (const v of seen) expect(v).toBeCloseTo(1, 9)
    expect(s.counters.rolloverBonus ?? 0).toBeCloseTo(0, 9)
  })

  it('expert path preserves reserves and outscores the historical path', () => {
    const expertRun = autoplay(scenario, 'expert', { seed: 1 })
    const e = expertRun.state
    const h = autoplay(scenario, 'historical', { seed: 1 }).state
    console.log('[expert] deviations', expertRun.deviations)
    console.log('[expert] usable ', series(e, 'usableReserves'))
    console.log('[expert] gap    ', series(e, 'reserveGap'))
    console.log('[expert] fx     ', series(e, 'fxSpot'))
    console.log('[expert] CI     ', series(e, 'confidence', 0))
    console.log('[expert] ended  ', e.ended?.reason, e.ended?.title)
    expect(expertRun.deviations).toEqual([])
    expect(e.ended?.failed).toBe(false)
    const expert = logScore('expert', e)
    const hist = logScore('historical(for comparison)', h)
    expect(expert.total).toBeGreaterThan(hist.total)
    // 전문가 경로는 개입을 훨씬 덜 쓰고 가용보유액을 더 남긴다
    expect(e.counters.interventionTotal).toBeLessThan((h.counters.interventionTotal ?? 0) * 0.5)
    const minUsable = (st: State) =>
      Math.min(...st.metricsHistory.map((m) => m.metrics.usableReserves!.value))
    expect(minUsable(e)).toBeGreaterThan(minUsable(h))
  })

  it('worst and random policies complete without NaN and score inside [0,100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
        expect(json.includes('NaN')).toBe(false)
        expect(json.includes('Infinity')).toBe(false)
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

  // ------------------------------------------------------------------ game-over reachability

  it('game over: declaring a moratorium ends the run immediately', () => {
    const s = drive({
      ...HISTORICAL_DRIVE,
      8: [
        ['t8-d1', ['t8-d1-a']],
        ['t8-d2', ['t8-d2-moratorium']],
      ],
    })
    expect(s.ended?.reason).toBe('moratorium')
    expect(s.ended?.failed).toBe(true)
    expect(s.ended?.turnIndex).toBe(8)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('game over: spending usable reserves to the bone ends in 대외지급 불능', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-d']],
        ['t0-d2', ['t0-d2-d']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-d2', ['t2-d2-heavy']],
      ],
      3: [
        ['t3-d1', ['t3-d1-a']],
        ['t3-d2', ['t3-d2-a']],
        ['t3-d3', ['t3-d3-c']],
      ],
      4: [
        ['t4-d1', ['t4-d1-band10', 't4-d1-deposit']],
        ['t4-d2', ['t4-d2-a']],
        ['t4-d3', ['t4-d3-a']],
      ],
      5: [
        ['t5-d1', ['t5-d1-c']],
        ['t5-d2', ['t5-d2-a']],
        ['t5-d3', ['t5-d3-b']],
      ],
      6: [
        ['t6-d1', ['t6-d1-c']],
        ['t6-d2', ['t6-d2-c']],
        ['t6-d3', ['t6-d3-b']],
      ],
      7: [
        ['t7-d1', ['t7-d1-b']],
        ['t7-d2', ['t7-d2-c']],
        ['t7-d3', ['t7-d3-a']],
      ],
      8: [
        ['t8-d1', ['t8-d1-b']],
        ['t8-d2', ['t8-d2-intervene']],
      ],
      9: [
        ['t9-d1', ['t9-d1-c']],
        ['t9-d2', ['t9-d2-c']],
      ],
    })
    console.log('[default] usable', series(s, 'usableReserves'))
    console.log('[default] ended ', s.ended?.reason, 'T', s.ended?.turnIndex)
    expect(s.ended?.reason).toBe('sovereign_default')
    expect(s.ended?.failed).toBe(true)
  })

  it('game over: keeping the narrow band freezes trade finance (거래 불성립 누적)', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-b']],
      ],
      1: [
        ['t1-d1', ['t1-d1-b']],
        ['t1-d2', ['t1-d2-b']],
      ],
      2: [
        ['t2-d1', ['t2-d1-b']],
        ['t2-d2', ['t2-d2-stop']],
      ],
      3: [
        ['t3-d1', ['t3-d1-b']],
        ['t3-d2', ['t3-d2-b']],
        ['t3-d3', ['t3-d3-a']],
      ],
      4: [
        ['t4-d1', ['t4-d1-bandkeep', 't4-d1-deposit']],
        ['t4-d2', ['t4-d2-b']],
        ['t4-d3', ['t4-d3-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-b']],
        ['t5-d2', ['t5-d2-b']],
        ['t5-d3', ['t5-d3-a']],
      ],
      6: [
        ['t6-d1', ['t6-d1-b']],
        ['t6-d2', ['t6-d2-b']],
        ['t6-d3', ['t6-d3-a']],
      ],
      7: [
        ['t7-d1', ['t7-d1-a']],
        ['t7-d2', ['t7-d2-a', 't7-d2-b']],
        ['t7-d3', ['t7-d3-b']],
      ],
      8: [
        ['t8-d1', ['t8-d1-b']],
        ['t8-d2', ['t8-d2-hold']],
      ],
      9: [
        ['t9-d1', ['t9-d1-a']],
        ['t9-d2', ['t9-d2-a']],
      ],
    })
    console.log('[bandlock] bandLockedDays', s.counters.bandLockedDays, 'ended', s.ended?.reason)
    expect(s.counters.bandLockedDays ?? 0).toBeGreaterThanOrEqual(8)
    expect(s.ended?.reason).toBe('trade_freeze')
    expect(s.ended?.orderly).toBe(true)
  })

  // ------------------------------------------------------------------ ticks & interrupts

  it('a ticked drain sums to the same total as the un-ticked equivalent at variance 0', () => {
    const profile = [0.22, 0.19, 0.17, 0.15, 0.14, 0.13]
    const sliced = applyRunoffSlices(59.4, profile)
    const single = applyRunoffSlices(59.4, [1])
    expect(sliced.institution.reserves.usable).toBeCloseTo(single.institution.reserves.usable, 9)
    expect(sliced.institution.reserves.gross).toBeCloseTo(single.institution.reserves.gross, 9)
    // createGame 이 T0 진입 유출(0.2)을 이미 적용하므로 그만큼을 뺀다
    const base = createGame(scenario, 1).counters.drainTotal ?? 0
    expect((sliced.counters.drainTotal ?? 0) - base).toBeCloseTo(59.4, 9)
    expect((single.counters.drainTotal ?? 0) - base).toBeCloseTo(59.4, 9)
  })

  it('every ticked turn declares tickLabels, a ticker and a drain profile of the right length', () => {
    const ticked = scenario.turns.filter((t) => (t.ticks ?? 1) > 1)
    expect(ticked.map((t) => t.id)).toEqual(['t2', 't4', 't8'])
    for (const turn of ticked) {
      const n = turn.ticks!
      expect(turn.tickLabels).toHaveLength(n)
      expect(turn.ticker?.series.length).toBeGreaterThan(0)
      for (const sr of turn.ticker!.series) expect(sr.values).toHaveLength(n)
      const runoff = (turn.eachTick ?? [])
        .flatMap((ce) => ce.effects)
        .find((e) => e.kind === 'fn' && e.name === 'runoffStep')
      expect(runoff, `${turn.id} has no per-tick drain`).toBeDefined()
      const profile = String(
        (runoff as { params?: Record<string, unknown> }).params?.profile ?? '',
      ).split('/')
      expect(profile).toHaveLength(n)
      expect(profile.reduce((a, b) => a + Number(b), 0)).toBeCloseTo(1, 6)
    }
  })

  it('declares three interrupts, each with a default option and scoreWeight 0.5', () => {
    const interrupts = scenario.turns.flatMap((t) => t.interrupts ?? [])
    expect(interrupts.map((i) => i.id)).toEqual(['t2-i1', 't4-i1', 't8-i1'])
    for (const i of interrupts) {
      expect(i.interrupt).toBe(true)
      expect(i.scoreWeight).toBe(0.5)
      expect(i.timeoutSec).toBeGreaterThan(0)
      expect(i.options.map((o) => o.id)).toContain(i.defaultOptionId)
      expect(i.options.length).toBeGreaterThanOrEqual(2)
      expect(i.options.length).toBeLessThanOrEqual(4)
      expect(i.lines.length).toBeGreaterThan(0)
    }
  })

  it('an unanswered interrupt times out to its default option', () => {
    let s = createGame(scenario, 1)
    // T0, T1 — 역사 선택으로 진행
    for (const [id, opt] of [
      ['t0-d1', 't0-d1-a'],
      ['t0-d2', 't0-d2-a'],
    ] as const)
      s = applyDecision(s, scenario, id, [opt])
    s = advanceTurn(s, scenario)
    for (const [id, opt] of [
      ['t1-d1', 't1-d1-a'],
      ['t1-d2', 't1-d2-a'],
    ] as const)
      s = applyDecision(s, scenario, id, [opt])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(2)
    // T2: 틱 0에서 가능한 결정만 답하고 나머지는 마감 스윕에 맡긴다
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = advanceTurn(s, scenario)
    const interrupt = s.decisions.find((r) => r.decisionId === 't2-i1')
    expect(interrupt, 'interrupt record').toBeDefined()
    expect(interrupt!.optionIds).toEqual(['t2-i1-defer'])
    expect(interrupt!.timedOut).toBe(true)
    expect(interrupt!.interrupt).toBe(true)
    // availableFrom/deadlineTick 결정도 같은 스윕에서 기본값으로 확정된다
    const afternoon = s.decisions.find((r) => r.decisionId === 't2-d2')
    expect(afternoon!.optionIds).toEqual(['t2-d2-stop'])
    expect(afternoon!.timedOut).toBe(true)
    expect(s.counters.timeouts).toBeGreaterThanOrEqual(2)
  })

  it('the 12/23 ticker shows the intraday high above the close (1,995 → 1,962)', () => {
    const s = autoplay(scenario, 'historical', { seed: 1 }).state
    const path = [0, 1, 2, 3, 4, 5].map((t) => tickValue(s, 8, t, 'fxSpot'))
    console.log('[historical] T8 fx ticks', path)
    expect(Math.max(...path)).toBeCloseTo(1995.0, 1)
    expect(path[5]).toBeCloseTo(1962.0, 1)
    expect(path[5]!).toBeLessThan(Math.max(...path))
  })

  // ------------------------------------------------------------------ 협상 대화 (D3)

  it('the two negotiations are multi-step dialogues that resolve into existing options', () => {
    const withSteps = scenario.turns
      .flatMap((t) => t.decisions)
      .filter((d) => (d.steps?.length ?? 0) > 0)
    expect(withSteps.map((d) => d.id)).toEqual(['t6-d2', 't9-d1'])
    for (const d of withSteps) {
      expect(validateDialogue(d).filter((i) => i.level === 'error')).toEqual([])
      expect(d.select).toEqual({ min: 1, max: 1 })
      expect(d.options.map((o) => o.id)).toContain(d.defaultOptionId)
      expect(d.steps!.length).toBeGreaterThanOrEqual(2)
      expect(d.steps!.length).toBeLessThanOrEqual(4)
      for (const step of d.steps!) {
        expect(step.lines.length).toBeGreaterThan(0)
        expect(step.replies.length).toBeGreaterThanOrEqual(2)
        expect(step.replies.length).toBeLessThanOrEqual(4)
        // 모든 응답은 next 또는 resolvesTo 중 정확히 하나를 가진다
        for (const r of step.replies)
          expect(
            (r.next === undefined ? 0 : 1) + (r.resolvesTo === undefined ? 0 : 1),
            `${d.id}/${step.id}/${r.id}`,
          ).toBe(1)
      }
    }
  })

  it('autoplay walks both negotiations and records the reply path', () => {
    const s = autoplay(scenario, 'historical', { seed: 1 }).state
    const loi = s.decisions.find((r) => r.decisionId === 't6-d2')!
    const ny = s.decisions.find((r) => r.decisionId === 't9-d1')!
    console.log('[historical] LOI path', loi.path, '→', loi.optionIds)
    console.log('[historical] NY  path', ny.path, '→', ny.optionIds)
    expect(loi.optionIds).toEqual(['t6-d2-a'])
    expect(ny.optionIds).toEqual(['t9-d1-a'])
    expect(loi.path?.length).toBe(3)
    expect(ny.path?.length).toBe(3)
    // 숫자 약속은 역사 기준값으로 확정된다: 콜금리 상한 21%, 국가보증 240억달러
    expect(s.counters.loiRateCeilingPct).toBe(21)
    expect(s.counters.debtGuaranteeBn).toBe(240)
    // 협상 결과가 정부보증 전환액을 정한다
    expect(s.counters.rolloverConverted).toBeCloseTo(218.4, 6)
  })

  it('a smaller guarantee pledged in the New York dialogue converts proportionally less debt', () => {
    const half = drive({
      ...HISTORICAL_DRIVE,
      9: [
        ['t9-d1', ['t9-d1-a'], ['ny-r-collective', 'debtGuaranteeBn-120', 'ny-r-ladder']],
        ['t9-d2', ['t9-d2-a', 't9-d2-b']],
      ],
    })
    const full = drive(HISTORICAL_DRIVE)
    console.log(
      '[pledge 120] converted',
      half.counters.rolloverConverted,
      'usable',
      half.institution.reserves.usable,
    )
    expect(half.counters.debtGuaranteeBn).toBe(120)
    expect(half.counters.rolloverConverted).toBeCloseTo(218.4 * 0.5, 6)
    expect(half.institution.reserves.usable).toBeLessThan(full.institution.reserves.usable)
    // 약속 규모가 작으면 완전 합의 플래그가 서지 않는다
    expect(half.flags.rollover_agreed ?? false).toBe(false)
    expect(full.flags.rollover_agreed).toBe(true)
  })

  it('a rate ceiling below the programme level is judged one turn later, not at the reply', () => {
    const soft = drive({
      ...HISTORICAL_DRIVE,
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-a'], ['loi-r-fiscal-first', 'loiRateCeilingPct-15', 'loi-r-accept']],
        ['t6-d3', ['t6-d3-a']],
      ],
    })
    const base = drive(HISTORICAL_DRIVE)
    expect(soft.counters.loiRateCeilingPct).toBe(15)
    // 판정은 다음 턴(T7)에 지연 효과로 이루어진다 — 신뢰가 더 낮고 유출 계수가 더 높다
    expect(metricAt(soft, 7, 'confidence')).toBeLessThan(metricAt(base, 7, 'confidence'))
    expect(soft.counters.drainMultiplier ?? 1).toBeGreaterThan(base.counters.drainMultiplier ?? 1)
  })

  // ------------------------------------------------------------------ traps

  it('intervening below the month’s maturing short-term debt is punished mechanically', () => {
    const s = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(s.flags.intervened_below_st_debt).toBe(true)
    expect(s.counters.interventionsBelowStDebt).toBeGreaterThanOrEqual(2)
    const expert = autoplay(scenario, 'expert', { seed: 1 }).state
    expect(expert.flags.intervened_below_st_debt ?? false).toBe(false)
  })

  it('branch deposits widen the gross/usable gap without touching gross reserves', () => {
    let s = createGame(scenario, 1)
    const grossBefore = s.institution.reserves.gross
    const usableBefore = s.institution.reserves.usable
    s = produce(s, (d) => {
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState), { ticks: 1 })
      const e = imfFx.depositAtBranches({ amount: 10, reason: 'test' })
      if (e.kind === 'fn') e.apply(d, ctx)
    })
    expect(s.institution.reserves.gross).toBeCloseTo(grossBefore, 9)
    expect(s.institution.reserves.usable).toBeCloseTo(usableBefore - 10, 9)
    expect(s.institution.custom.reserveGap).toBeCloseTo(grossBefore - usableBefore + 10, 9)
  })

  it('spot intervention drains usable in full but gross only by the non-swap share', () => {
    let s = createGame(scenario, 1)
    const grossBefore = s.institution.reserves.gross
    const usableBefore = s.institution.reserves.usable
    s = produce(s, (d) => {
      const ctx = makeEffectContext(d, latestSnapshot(s as GameState), { ticks: 1 })
      const e = imfFx.intervene({ amount: 100 })
      if (e.kind === 'fn') e.apply(d, ctx)
    })
    expect(s.institution.reserves.usable).toBeCloseTo(usableBefore - 100, 9)
    expect(s.institution.reserves.gross).toBeCloseTo(grossBefore - 40, 9)
    expect(s.institution.reserves.forwardCommitments).toBeCloseTo(30 + 60, 9)
  })
})

/** 역사 경로의 턴별 선택(게임오버 드라이브의 공통 서두). */
const HISTORICAL_DRIVE: Record<number, DriveStep[]> = {
  0: [
    ['t0-d1', ['t0-d1-a']],
    ['t0-d2', ['t0-d2-a']],
  ],
  1: [
    ['t1-d1', ['t1-d1-a']],
    ['t1-d2', ['t1-d2-a']],
  ],
  2: [
    ['t2-d1', ['t2-d1-a']],
    ['t2-d2', ['t2-d2-add']],
  ],
  3: [
    ['t3-d1', ['t3-d1-a']],
    ['t3-d2', ['t3-d2-a']],
    ['t3-d3', ['t3-d3-a']],
  ],
  4: [
    ['t4-d1', ['t4-d1-deposit', 't4-d1-band10', 't4-d1-npl']],
    ['t4-d2', ['t4-d2-a']],
    ['t4-d3', ['t4-d3-a']],
  ],
  5: [
    ['t5-d1', ['t5-d1-a']],
    ['t5-d2', ['t5-d2-a']],
    ['t5-d3', ['t5-d3-a']],
  ],
  6: [
    ['t6-d1', ['t6-d1-a']],
    ['t6-d2', ['t6-d2-a']],
    ['t6-d3', ['t6-d3-a']],
  ],
  7: [
    ['t7-d1', ['t7-d1-a']],
    ['t7-d2', ['t7-d2-a', 't7-d2-b']],
    ['t7-d3', ['t7-d3-a']],
  ],
  8: [
    ['t8-d1', ['t8-d1-a']],
    ['t8-d2', ['t8-d2-hold']],
  ],
  9: [
    ['t9-d1', ['t9-d1-a']],
    ['t9-d2', ['t9-d2-a', 't9-d2-b']],
  ],
}
