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
  latestSnapshot,
  replay,
  validateScenario,
  type CentralBankState,
  type Checkpoint,
  type GameState,
  type ScenarioDefinition,
  type Turn,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { CS_FACTS } from './facts'
import { csFx } from './fx'
import scenario from './scenario'

type State = GameState<CentralBankState>
type Def = ScenarioDefinition<CentralBankState>

function series(state: State, key: string, digits = 1): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  return state.metricsHistory.find((m) => m.turnIndex === turnIndex)?.metrics[key]?.value ?? NaN
}

/** 경로 선택만 바꾼 시나리오 사본 — 자동플레이의 `historical` 정책으로 임의 경로를 걷게 한다. */
function withChoices(choices: Record<string, string | string[]>): Def {
  return {
    ...scenario,
    paths: { ...scenario.paths, historical: { ...scenario.paths.historical, choices } },
  }
}

/** 역사 경로의 선택에 일부만 덮어쓴 경로. */
function variant(overrides: Record<string, string | string[]>): Def {
  return withChoices({ ...scenario.paths.historical.choices, ...overrides })
}

/**
 * tests/autoplay/autoplayer.test.ts의 checkpointActual과 같은 절차(리플레이로 해당 턴까지 되감기).
 * 이 테스트가 자기 디렉터리 밖의 테스트를 고치지 않고도 체크포인트를 검증하도록 여기에 옮겨 둔다.
 */
function checkpointActual(def: Def, cp: Checkpoint, seed = 1): number | undefined {
  const turnIndex = def.turns.findIndex((t) => t.id === cp.turnId)
  if (turnIndex < 0) return undefined
  const full = autoplay(def, 'historical', { seed })
  const log = full.decisions.filter(
    (d) =>
      d.turnIndex < turnIndex ||
      (d.turnIndex === turnIndex && (cp.tick === undefined || (d.tick ?? 0) <= cp.tick)),
  )
  const { state } = replay(def, { seed, decisions: log, turnIndex, tick: cp.tick })
  if (state.turnIndex !== turnIndex) return undefined
  if (cp.metric) return latestSnapshot(state).metrics[cp.metric]?.value
  if (cp.counter) return state.counters[cp.counter] ?? 0
  if (cp.path) return getNumberPath(state, cp.path)
  return undefined
}

/** 사후정보 토큰: 엔딩·디브리핑 이전(턴 텍스트·브리핑)에는 등장하면 안 된다. */
const FORBIDDEN_IN_TURNS = ['2024', '2025', '2026', '연방행정법원', '연방대법원', '조사위원회']

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
  'counter',
  'resolvesTo',
  'next',
  'idPrefix',
])

function collectText(node: unknown, out: string[], key?: string): void {
  if (key !== undefined && NON_TEXT_KEYS.has(key)) return
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((v) => collectText(v, out, key))
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) collectText(v, out, k)
}

describe('credit-suisse-2023 scenario', () => {
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
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
  })

  it('the fact ledger covers every initial-state number and matches it', () => {
    // tests/integrity/facts.test.ts가 아직 이 시나리오를 열거하지 않으므로 같은 검사를 여기서 돌린다.
    const roots = ['institution', 'market', 'confidence', 'counters', 'regulatorLevel']
    const init = {
      ...scenario.initialState,
      regulatorLevel: scenario.initialState.regulatorLevel ?? 0,
    }
    const resolve = (obj: unknown, path: string): unknown => {
      let cur: unknown = obj
      for (const seg of path.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined
        cur = (cur as Record<string, unknown>)[seg]
      }
      return cur
    }
    const drift: string[] = []
    const unresolved: string[] = []
    let checked = 0
    for (const f of CS_FACTS) {
      if (!roots.includes(f.path.split('.')[0]!)) continue
      const actual = resolve(init, f.path)
      if (typeof actual !== 'number') {
        unresolved.push(`${f.path} → ${String(actual)}`)
        continue
      }
      checked++
      if (Math.abs(actual - f.value) > 1e-9)
        drift.push(`${f.path}: 원장 ${f.value} vs 초기 상태 ${actual}`)
    }
    // 반대 방향: 상태에는 있는데 원장에 없는 숫자 리프
    const covered = new Set(CS_FACTS.map((f) => f.path))
    const missing: string[] = []
    const walk = (obj: unknown, prefix: string): void => {
      if (obj === null || typeof obj !== 'object') return
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const p = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'number') {
          if (!covered.has(p)) missing.push(p)
        } else if (v && typeof v === 'object') walk(v, p)
      }
    }
    walk({ institution: init.institution, market: init.market, confidence: init.confidence }, '')
    console.log('[facts] checked', checked, 'leaves')
    expect(unresolved, `해석되지 않는 경로: ${unresolved.join(' / ')}`).toEqual([])
    expect(drift, `원장과 초기 상태가 다릅니다: ${drift.join(' / ')}`).toEqual([])
    expect(missing, `원장에 없는 초기 상태 숫자: ${missing.join(' / ')}`).toEqual([])
    expect(checked).toBeGreaterThan(20)
  })

  it('contains no hindsight tokens in turn text or briefing', () => {
    const turnText: string[] = []
    collectText(scenario.turns, turnText)
    expect(turnText.length).toBeGreaterThan(200)
    for (const token of FORBIDDEN_IN_TURNS) {
      expect(
        turnText.filter((s) => s.includes(token)),
        `forbidden token "${token}" in turn text`,
      ).toEqual([])
    }
    // 브리핑도 같은 규칙을 따른다. 단 `disclaimer`와 `simplificationNotes`는 **플레이 정보가 아니라
    // 출처·단순화에 관한 고지**이며, 저작 가이드가 사후 자료의 사용 사실을 밝히도록 요구하므로 제외한다.
    const briefing: string[] = []
    collectText({ ...scenario.briefing, disclaimer: '', simplificationNotes: [] }, briefing)
    for (const token of FORBIDDEN_IN_TURNS) {
      expect(
        briefing.filter((s) => s.includes(token) && !s.includes('디브리핑에서만')),
        `forbidden token "${token}" in briefing`,
      ).toEqual([])
    }
  })

  it('historical path reproduces every checkpoint and never runs the bank dry', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] csLiq   ', series(s, 'csLiquidity'))
    console.log('[historical] outflow ', series(s, 'dailyOutflow'))
    console.log('[historical] support ', series(s, 'supportDrawn', 0))
    console.log('[historical] usable  ', series(s, 'usableReserves', 0))
    console.log('[historical] CDS     ', series(s, 'csCdsBp', 0))
    console.log('[historical] stock   ', series(s, 'ownStock'))
    console.log('[historical] CI      ', series(s, 'confidence', 0))
    console.log('[historical] ended   ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)

    const failures: string[] = []
    for (const cp of scenario.checkpoints ?? []) {
      const actual = checkpointActual(scenario, cp)
      if (actual === undefined || !Number.isFinite(actual)) {
        failures.push(`${cp.label}: 값 없음`)
        continue
      }
      const rel =
        cp.expected === 0
          ? Math.abs(actual)
          : Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      const abs = Math.abs(actual - cp.expected)
      const ok = rel <= cp.tolerance || (cp.absTolerance !== undefined && abs <= cp.absTolerance)
      console.log(
        `[checkpoint] ${ok ? 'OK ' : 'FAIL'} ${cp.turnId} ${cp.metric ?? cp.counter ?? cp.path} = ${actual.toFixed(2)} (기대 ${cp.expected}, 오차 ${(rel * 100).toFixed(1)}%)`,
      )
      if (!ok) failures.push(`${cp.label}: ${actual} vs ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])

    // 유출 계수는 역사 경로에서 항상 1.0이어야 한다 (calibration.md §4의 규약)
    expect(s.counters.drainMultiplier).toBeCloseTo(1, 10)
    for (const m of s.metricsHistory) expect(m.metrics.csLiquidity!.value).toBeGreaterThan(0)
    console.log('[historical] score', computeScore(s, scenario).total)
  })

  it('expert path outscores the historical path and leaves less AT1 market damage', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] csLiq  ', series(s, 'csLiquidity'))
    console.log('[expert] usable ', series(s, 'usableReserves', 0))
    console.log('[expert] CI     ', series(s, 'confidence', 0))
    console.log('[expert] ended  ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.failed).toBe(false)
    const expert = computeScore(s, scenario)
    const historical = computeScore(hist, scenario)
    console.log(
      '[score] expert',
      expert.total,
      expert.grade,
      '| historical',
      historical.total,
      historical.grade,
    )
    expect(expert.total).toBeGreaterThan(historical.total)
    expect(s.counters.at1MarketDamage ?? 0).toBeLessThan(hist.counters.at1MarketDamage ?? 0)
    expect(s.flags.at1_basis_published).toBe(true)
    expect(s.flags.track_dual).toBe(true)
  })

  it('worst and random policies finish with a finite score in [0,100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null'), `${policy}#${rngSeed} serialises a NaN/Infinity`).toBe(false)
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

  it('game over: refusing the Friday ELA+ drives liquidity below zero (insolvency)', () => {
    const r = autoplay(variant({ 't3-d1': 't3-d1-refuse' }), 'historical', { seed: 1 })
    console.log('[insolvency] csLiq', series(r.state, 'csLiquidity'))
    expect(r.state.ended?.reason).toBe('insolvency')
    expect(r.state.ended?.failed).toBe(true)
    expect(r.state.ended?.turnIndex).toBe(3)
    expect(computeScore(r.state, scenario).total).toBeLessThanOrEqual(40)
  })

  it('game over: the bankruptcy branch of the weekend dialogue ends in disorderly failure', () => {
    const r = autoplay(variant({ 't4-d1': 't4-d1-bankruptcy' }), 'historical', { seed: 1 })
    const rec = r.state.decisions.find((d) => d.decisionId === 't4-d1')
    console.log('[bankruptcy] dialogue path', rec?.path, '→', rec?.optionIds)
    expect(rec?.optionIds).toEqual(['t4-d1-bankruptcy'])
    expect(rec?.path).toEqual(['r-open-sale', 't4-d1-guarantee-0', 'r-walk-bankruptcy'])
    expect(r.state.ended?.reason).toBe('disorderly_failure')
    expect(r.state.ended?.failed).toBe(true)
  })

  it('game over: a silent, unprepared authority collapses confidence (system contagion)', () => {
    const r = autoplay(
      variant({
        't0-d1': 't0-d1-none',
        't0-d2': 't0-d2-none',
        't1-d1': 't1-d1-silent',
        't1-d2': 't1-d2-nothing',
      }),
      'historical',
      { seed: 1 },
    )
    console.log('[contagion] CI', series(r.state, 'confidence', 0), '→', r.state.ended?.reason)
    expect(r.state.ended?.reason).toBe('system_contagion')
    expect(r.state.ended?.failed).toBe(true)
  })

  it('the resolution branch is reachable and materially different from the forced sale', () => {
    const merger = autoplay(scenario, 'historical', { seed: 1 }).state
    const resolution = autoplay(
      variant({ 't4-d1': 't4-d1-resolution', 't3-d2': 't3-d2-dual' }),
      'historical',
      { seed: 1 },
    ).state
    const rec = resolution.decisions.find((d) => d.decisionId === 't4-d1')
    console.log('[resolution] path', rec?.path, '→', rec?.optionIds, '|', resolution.ended?.title)
    expect(rec?.optionIds).toEqual(['t4-d1-resolution'])
    expect(resolution.ended?.failed).toBe(false)
    expect(resolution.ended?.title).toContain('정리 실행')
    expect(merger.ended?.title).toContain('월요일 아침')
    // 주주 대가가 사라지고 서열이 지켜진다 — 이것이 두 경로의 실질적 차이다
    expect(metricAt(resolution, 5, 'shareholderConsideration')).toBe(0)
    expect(metricAt(merger, 5, 'shareholderConsideration')).toBeCloseTo(3, 6)
    expect(resolution.flags.hierarchy_respected).toBe(true)
    expect(merger.flags.hierarchy_respected).toBeUndefined()
    // 정리는 자본을 만들지만(베일인) 납세자 보증은 손실보전분만큼 덜 쓴다
    expect(resolution.counters.bailInCapital).toBe(73)
    expect(metricAt(resolution, 5, 'federalGuarantee')).toBeLessThan(
      metricAt(merger, 5, 'federalGuarantee'),
    )
    expect(metricAt(resolution, 5, 'csCet1Pct')).toBeGreaterThan(metricAt(merger, 5, 'csCet1Pct'))
  })

  it('an unanswered interrupt is swept to its default option', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-d1-daily'])
    s = applyDecision(s, scenario, 't0-d2', ['t0-d2-list'])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(1)
    // 인터럽트는 틱 2에 열리고, 마감 스윕은 그 다음 틱에 돈다
    while (canAdvanceTick(s, scenario) && s.tick < 3) s = advanceTick(s, scenario)
    const rec = s.decisions.find((d) => d.decisionId === 't1-i1-at1')
    console.log('[interrupt] swept record', rec)
    expect(rec).toBeDefined()
    expect(rec?.timedOut).toBe(true)
    expect(rec?.optionIds).toEqual(['t1-i1-noComment'])
    expect(rec?.interrupt).toBe(true)
  })

  it('a ticked turn slices to exactly the un-ticked equivalent at variance 0', () => {
    // T1(3/15)의 틱을 없애고 유출을 한 번에 적용하는 사본
    const untickedT1: Turn<CentralBankState> = {
      ...scenario.turns[1]!,
      ticks: undefined,
      tickLabels: undefined,
      ticker: undefined,
      interrupts: undefined,
      eachTick: [
        {
          id: 't1-outflow-single',
          description: '3월 15일 고객자금 유출(단일 호출)',
          effects: [csFx.runoffStep({ total: 13.2, profile: [1], label: '3/15 고객자금 유출' })],
        },
      ],
      tickEffects: (scenario.turns[1]!.tickEffects ?? []).map((e) => ({ ...e, atTick: 0 })),
      decisions: scenario.turns[1]!.decisions.map((d) => ({
        ...d,
        availableFrom: undefined,
        deadlineTick: undefined,
      })),
    }
    const unticked: Def = {
      ...scenario,
      turns: scenario.turns.map((t, i) => (i === 1 ? untickedT1 : t)),
    }
    const ticked = autoplay(scenario, 'historical', { seed: 1, variance: 0 }).state
    const flat = autoplay(unticked, 'historical', { seed: 1, variance: 0 }).state
    const a = metricAt(ticked, 1, 'cumulativeOutflow')
    const b = metricAt(flat, 1, 'cumulativeOutflow')
    console.log('[ticks] cumulativeOutflow ticked', a, 'unticked', b)
    expect(a).toBeCloseTo(b, 9)
    expect(metricAt(ticked, 1, 'dailyOutflow')).toBeCloseTo(13.2, 9)
    expect(metricAt(flat, 1, 'dailyOutflow')).toBeCloseTo(13.2, 9)
    // 유동성도 같은 자리에서 끝난다
    expect(metricAt(ticked, 1, 'csLiquidity')).toBeCloseTo(metricAt(flat, 1, 'csLiquidity'), 9)
  })

  it('a walked dialogue path replays exactly', () => {
    const run = autoplay(scenario, 'expert', { seed: 1 })
    const route = run.decisions.find((d) => d.decisionId === 't4-d1')
    const at1 = run.decisions.find((d) => d.decisionId === 't4-d2')
    console.log('[dialogue] route', route?.path, '→', route?.optionIds)
    console.log('[dialogue] at1  ', at1?.path, '→', at1?.optionIds)
    expect(route?.path).toEqual(['r-open-sale', 't4-d1-guarantee-9', 'r-terms-plb'])
    expect(at1?.path).toEqual(['r-at1-accept', 'r-legal-ordinance', 'r-comms-explain-eu'])
    const replayed = replay(scenario, { seed: 1, decisions: run.decisions })
    expect(replayed.state.counters.lossGuaranteeBn).toBe(9)
    expect(JSON.stringify(replayed.state.institution)).toBe(JSON.stringify(run.state.institution))
    expect(replayed.state.confidence.index).toBeCloseTo(run.state.confidence.index, 9)
  })

  it('the loss-guarantee promise is judged later by a delayed effect', () => {
    const promised25 = autoplay(variant({ 't4-i1-buyer': 't4-i1-raise' }), 'historical', {
      seed: 1,
    }).state
    const promised9 = autoplay(scenario, 'historical', { seed: 1 }).state
    console.log(
      '[promise] lossGuaranteeBn 9 →',
      metricAt(promised9, 5, 'federalGuarantee'),
      '| 25 →',
      metricAt(promised25, 5, 'federalGuarantee'),
    )
    expect(promised9.counters.lossGuaranteeBn).toBe(9)
    expect(promised25.counters.lossGuaranteeBn).toBe(25)
    // 인터럽트가 대화 뒤에 카운터를 덮어써도, 판정은 지연효과가 T5에 한다
    expect(promised25.confidence.board).toBeLessThan(promised9.confidence.board)
  })

  it('the emergency ordinance gates the Friday facility and the Monday opening', () => {
    const noOrdinance = autoplay(variant({ 't2-d2': 't2-d2-wait' }), 'historical', { seed: 1 })
    const s = noOrdinance.state
    console.log('[no-ordinance] deviations', noOrdinance.deviations)
    console.log('[no-ordinance] csLiq', series(s, 'csLiquidity'), '→', s.ended?.reason)
    // 긴급명령이 없으면 ELA+ 옵션 자체가 비활성이라 경로가 이탈한다
    expect(noOrdinance.deviations.some((d) => d.decisionId === 't3-d1')).toBe(true)
    expect(s.flags.emergency_ordinance).toBeUndefined()
    expect(s.flags.monday_open_met).toBeUndefined()
  })
})
