import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  computeScore,
  createGame,
  getNumberPath,
  latestSnapshot,
  replay,
  validateScenario,
  type Checkpoint,
  type InstitutionState,
  type ScenarioDefinition,
  type Turn,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import typed from './scenario'
import { PROFILE_T4, PROFILE_T5, PROFILE_T6 } from './turnsB'
import { REDEMPTION_BASE } from './turnsA'

/** The engine's autoplay/score helpers are written against the generic definition. */
const scenario = typed as unknown as ScenarioDefinition<InstitutionState>

type State = ReturnType<typeof autoplay>['state']

function metricAt(state: State, turnIndex: number, key: string): number {
  const snap = state.metricsHistory.find((m) => m.turnIndex === turnIndex)
  return snap?.metrics[key]?.value ?? NaN
}

function minOf(state: State, key: string): number {
  return Math.min(...state.metricsHistory.map((m) => m.metrics[key]?.value ?? Infinity))
}

function maxOf(state: State, key: string): number {
  return Math.max(...state.metricsHistory.map((m) => m.metrics[key]?.value ?? -Infinity))
}

function series(state: State, key: string, digits = 2): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function dump(label: string, s: State) {
  for (const k of [
    'navIndex',
    'cashBufferPct',
    'weeklyLiquidityPct',
    'illiquidSharePct',
    'dilutionBp',
    'redemptionsCumulativePct',
    'confidence',
  ])
    console.log(`[${label}] ${k.padEnd(26)}`, series(s, k, k === 'dilutionBp' ? 1 : 2))
  console.log(`[${label}] ended`, s.ended?.reason, 'T', s.ended?.turnIndex, s.ended?.title)
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

/** Drives a hand-picked path: { turnIndex: [[decisionId, optionIds], ...] }. Stops when the game ends. */
function drive(perTurn: Record<number, [string, string[]][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    for (const [decisionId, optionIds] of perTurn[s.turnIndex] ?? []) {
      // A decision with `availableFrom` only becomes answerable mid-turn.
      const turn = scenario.turns[s.turnIndex]!
      const d = turn.decisions.find((x) => x.id === decisionId)
      while (d?.availableFrom !== undefined && s.tick < d.availableFrom && s.phase !== 'ended')
        s = advanceTick(s, scenario)
      if (s.phase === 'ended') break
      s = applyDecision(s, scenario, decisionId, optionIds)
      if (s.phase === 'ended') break
    }
    if (s.phase === 'ended') break
    s = advanceTurn(s, scenario)
  }
  return s
}

/** 대화 경로까지 지정해 구동한다: { turnIndex: [[decisionId, optionIds, path?], ...] }. */
function driveWithPaths(perTurn: Record<number, [string, string[], string[]?][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    for (const [decisionId, optionIds, path] of perTurn[s.turnIndex] ?? []) {
      const turn = scenario.turns[s.turnIndex]!
      const d = turn.decisions.find((x) => x.id === decisionId)
      const it = turn.interrupts?.find((x) => x.id === decisionId)
      const from = d?.availableFrom ?? it?.atTick
      while (from !== undefined && s.tick < from && s.phase !== 'ended')
        s = advanceTick(s, scenario)
      if (s.phase === 'ended') break
      s = applyDecision(s, scenario, decisionId, optionIds, path ? { path } : {})
      if (s.phase === 'ended') break
    }
    if (s.phase === 'ended') break
    s = advanceTurn(s, scenario)
  }
  return s
}

/** Same semantics as tests/autoplay: value after the decisions of `turnId` on the historical path. */
function checkpointActual(cp: Checkpoint): number | undefined {
  const turnIndex = scenario.turns.findIndex((t) => t.id === cp.turnId)
  if (turnIndex < 0) return undefined
  const full = autoplay(scenario, 'historical', { seed: 1 })
  const log = full.decisions.filter((d) => d.turnIndex <= turnIndex)
  const { state } = replay(scenario, { seed: 1, decisions: log, turnIndex })
  if (state.turnIndex !== turnIndex) return undefined
  if (cp.metric) return latestSnapshot(state).metrics[cp.metric]?.value
  if (cp.counter) return state.counters[cp.counter] ?? 0
  if (cp.path) return getNumberPath(state, cp.path)
  return undefined
}

function findNonFinite(value: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown, p: string) => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) out.push(p || '<root>')
      return
    }
    if (v === null || typeof v !== 'object') return
    for (const [k, item] of Object.entries(v as Record<string, unknown>))
      walk(item, p ? `${p}.${k}` : k)
  }
  walk(value, '')
  return out
}

/** Player-visible text of a turn before any decision is committed. */
function visibleText(turn: Turn<InstitutionState>): string {
  const out: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(push)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(push)
  }
  for (const ce of turn.entryEffects ?? []) push(ce.description)
  for (const ce of turn.eachTick ?? []) push(ce.description)
  for (const ce of turn.tickEffects ?? []) push(ce.description)
  for (const ev of turn.events) {
    const { effects: _e, sourceRefs: _s, cardRefs: _c, id: _i, ...rest } = ev
    push(rest)
  }
  for (const d of [...turn.decisions, ...(turn.interrupts ?? [])]) {
    push([d.title, d.prompt, d.context])
    for (const o of d.options) {
      push([o.label, o.description, o.consequences, o.unavailableReason, o.trapExplanation])
      for (const de of o.delayedEffects ?? []) push(de.description)
    }
  }
  for (const h of turn.advisorHints ?? []) push(h.text)
  return out.join('\n')
}

/**
 * 사후정보 토큰: 실제 공표 시각 이전 턴의 플레이어 가시 텍스트에 등장하면 안 된다.
 * (전문가 rationale·엔딩·디브리핑·브리핑의 규제 설명은 제외 — 학습용 메타 텍스트다.)
 */
const HINDSIGHT: { untilTurn: number; tokens: string[] }[] = [
  // 3/17 CPFF·PDCF, 3/18 MMLF → T3(3/16)까지 금지
  { untilTurn: 3, tokens: ['CPFF', 'PDCF', 'MMLF', 'CP 매입기구', '유동성 지원기구'] },
  // 3/19 9개 중앙은행 통화스와프 확대 → T4(3/18)까지 금지 (3/15 성명의 '기존 통화스와프 가격 인하'는 허용)
  { untilTurn: 4, tokens: ['9개 중앙은행', '한국은행'] },
  // 3/23 회사채 매입기구·무제한 QE → T5(3/20)까지 금지
  {
    untilTurn: 5,
    tokens: ['PMCCF', 'SMCCF', 'TALF', '회사채 매입기구', '무제한', '매입 한도 철폐'],
  },
  // 3/24 이후 결과 → T6까지 금지
  { untilTurn: 6, tokens: ['$625bn', '발행 사상 최대'] },
  // 사후 규제(FSB 2023.12 / SEC 2023)는 게임 중 어디에도 등장하지 않는다
  { untilTurn: 7, tokens: ['2023년 MMF 개혁', '2023년 12월', '의무 유동성 수수료'] },
]

/** 역사 경로의 결정 시퀀스(테스트 가독용). */
const HISTORICAL: Record<number, [string, string[]][]> = {
  0: [['t0-d1', ['t0-d1-a']]],
  1: [
    ['t1-d1', ['t1-d1-a']],
    ['t1-d2', ['t1-d2-a']],
  ],
  2: [
    ['t2-d1', ['t2-d1-d']],
    ['t2-d2', ['t2-d2-a']],
  ],
  3: [['t3-d1', ['t3-d1-c']]],
}

describe('covid-2020-fund scenario', () => {
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

  it('contains no hindsight tokens in player-visible turn text', () => {
    const problems: string[] = []
    scenario.turns.forEach((turn, ti) => {
      const text = visibleText(turn)
      for (const rule of HINDSIGHT) {
        if (ti > rule.untilTurn) continue
        for (const token of rule.tokens)
          if (text.includes(token)) problems.push(`T${ti}: "${token}"`)
      }
    })
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('historical path: survives without a gate, but degrades the ladder and dilutes stayers', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    dump('historical', s)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    // 수평 슬라이싱의 귀결: 현금 버퍼 소진 + 비유동 비중 상승
    expect(minOf(s, 'cashBufferPct')).toBeLessThan(3)
    expect(maxOf(s, 'illiquidSharePct')).toBeGreaterThan(36)
    // 스윙 미적용 → 잔존 투자자가 비용을 부담
    expect(metricAt(s, 7, 'dilutionBp')).toBeGreaterThan(25)
    expect(s.flags.swing_applied).toBeUndefined()
    logScore('historical', s)
  })

  it('reproduces every checkpoint on the historical path within tolerance', () => {
    const failures: string[] = []
    for (const cp of scenario.checkpoints ?? []) {
      const actual = checkpointActual(cp)
      if (actual === undefined || !Number.isFinite(actual)) {
        failures.push(`${cp.label}: no value`)
        continue
      }
      const relErr = Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      const absErr = Math.abs(actual - cp.expected)
      console.log(
        `[checkpoint] ${cp.label}\n              actual ${actual.toFixed(3)} vs expected ${cp.expected} (rel ${(relErr * 100).toFixed(1)}%, abs ${absErr.toFixed(3)})`,
      )
      const ok =
        relErr <= cp.tolerance || (cp.absTolerance !== undefined && absErr <= cp.absTolerance)
      if (!ok) failures.push(`${cp.label}: ${actual} vs ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })

  it('expert path keeps the ladder, stops the dilution and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    dump('expert', s)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.flags.forced_gate).toBeUndefined()
    expect(s.flags.gated_voluntary).toBeUndefined()
    expect(s.flags.swing_preset).toBe(true)
    expect(s.flags.swing_applied).toBe(true)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    // 사다리와 잔존 포트폴리오의 질이 모두 낫다
    expect(minOf(s, 'cashBufferPct')).toBeGreaterThan(minOf(hist, 'cashBufferPct'))
    expect(maxOf(s, 'illiquidSharePct')).toBeLessThan(maxOf(hist, 'illiquidSharePct'))
    expect(metricAt(s, 7, 'dilutionBp')).toBeLessThan(metricAt(hist, 7, 'dilutionBp'))
    const expert = logScore('expert', s)
    const histScore = computeScore(hist, scenario)
    expect(expert.total).toBeGreaterThan(histScore.total)
  })

  it('vertical vs horizontal slicing: the divergence shows up later, not on the day', () => {
    const base: Record<number, [string, string[]][]> = {
      0: [['t0-d1', ['t0-d1-a']]],
      1: [['t1-d2', ['t1-d2-a']]],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [['t3-d1', ['t3-d1-c']]],
      4: [['t4-d1', ['t4-d1-a']]],
      5: [
        ['t5-d2', ['t5-d2-a']],
        ['t5-d1', ['t5-d1-a']],
      ],
      6: [['t6-d1', ['t6-d1-e']]],
      7: [['t7-d1', ['t7-d1-a']]],
    }
    const withPolicy = (opt: string, t3: string): Record<number, [string, string[]][]> => ({
      ...base,
      1: [['t1-d1', [opt]], ...base[1]!],
      3: [['t3-d1', [t3]]],
    })
    const horizontal = drive(withPolicy('t1-d1-a', 't3-d1-c'))
    const vertical = drive(withPolicy('t1-d1-b', 't3-d1-b'))
    dump('slice:horizontal', horizontal)
    dump('slice:vertical', vertical)
    // 정책은 다음 영업일(T2)부터 적용된다. 그날 수평 슬라이싱은 더 싸 보인다 — 비용이 거의 없기 때문이다.
    expect(metricAt(horizontal, 2, 'dilutionBp')).toBeLessThan(metricAt(vertical, 2, 'dilutionBp'))
    expect(metricAt(horizontal, 2, 'navIndex')).toBeGreaterThan(metricAt(vertical, 2, 'navIndex'))
    // 그러나 나중에 사다리와 잔존 포트폴리오의 질이 갈린다.
    // 3/18(최대 스트레스일)에 수평 경로는 현금이 이미 0이고, 비례 경로는 아직 남아 있다.
    expect(metricAt(horizontal, 4, 'cashBufferPct')).toBeLessThan(
      metricAt(vertical, 4, 'cashBufferPct'),
    )
    expect(minOf(horizontal, 'weeklyLiquidityPct')).toBeLessThan(
      minOf(vertical, 'weeklyLiquidityPct'),
    )
    expect(maxOf(horizontal, 'illiquidSharePct')).toBeGreaterThan(
      maxOf(vertical, 'illiquidSharePct'),
    )
    // 그리고 뒤늦게 비싼 것을 팔게 되므로 후반부 희석 증가분이 더 크다.
    const lateH = metricAt(horizontal, 7, 'dilutionBp') - metricAt(horizontal, 3, 'dilutionBp')
    const lateV = metricAt(vertical, 7, 'dilutionBp') - metricAt(vertical, 3, 'dilutionBp')
    expect(lateH).toBeGreaterThan(lateV)
    expect(metricAt(horizontal, 7, 'navIndex')).toBeLessThan(metricAt(vertical, 7, 'navIndex'))
    console.log(
      '[slice] T2 dilution h/v',
      metricAt(horizontal, 2, 'dilutionBp').toFixed(1),
      '/',
      metricAt(vertical, 2, 'dilutionBp').toFixed(1),
      '| late dilution h/v',
      lateH.toFixed(1),
      '/',
      lateV.toFixed(1),
      '| final navIndex h/v',
      metricAt(horizontal, 7, 'navIndex').toFixed(2),
      '/',
      metricAt(vertical, 7, 'navIndex').toFixed(2),
    )
  })

  it('ticked turns: the intraday slices sum to exactly the un-ticked total (variance 0)', () => {
    let s = createGame(scenario, 1)
    for (const ti of [0, 1, 2, 3]) {
      for (const [id, opts] of HISTORICAL[ti] ?? []) s = applyDecision(s, scenario, id, opts)
      s = advanceTurn(s, scenario)
    }
    expect(s.turnIndex).toBe(4)
    expect(s.tick).toBe(0)
    const inst = s.institution
    if (inst.kind !== 'asset_manager') throw new Error('asset_manager 상태가 아닙니다')
    const ampAtOpen = s.counters.redeemAmp ?? 1
    const cumBefore = s.counters.cumBeforeT4 ?? 0
    void cumBefore
    // T3 종료 시점의 누적치는 T4 tick0이 이미 한 조각을 처리한 뒤이므로, tick별 증분을 직접 확인한다.
    const perTick: number[] = []
    let prev = 0
    const read = (st: typeof s): number => {
      const i = st.institution
      return i.kind === 'asset_manager' ? i.redemptions.cumulativePct : NaN
    }
    // tick 0 은 이미 실행됐으므로 그 직전 값을 역산한다.
    const total = REDEMPTION_BASE[4]! * ampAtOpen
    const afterTick0 = read(s)
    prev = afterTick0 - total * PROFILE_T4[0]!
    perTick.push(afterTick0 - prev)
    let cur = s
    for (let k = 1; k < 4; k++) {
      cur = advanceTick(cur, scenario)
      const v = read(cur)
      perTick.push(v - (perTick.reduce((a, b) => a + b, 0) + prev))
    }
    const summed = perTick.reduce((a, b) => a + b, 0)
    console.log(
      '[ticks] T4 per-tick redemption %NAV',
      perTick.map((v) => v.toFixed(4)),
      'sum',
      summed.toFixed(6),
      'un-ticked equivalent',
      total.toFixed(6),
    )
    expect(summed).toBeCloseTo(total, 9)
    // 저작된 일중 분포가 그대로 나타난다 (균등 분할이 아니다)
    expect(perTick[0]! / summed).toBeCloseTo(PROFILE_T4[0]!, 6)
    expect(perTick[3]! / summed).toBeCloseTo(PROFILE_T4[3]!, 6)
    // 세 개의 일중 턴 프로파일은 모두 합이 1이다
    for (const p of [PROFILE_T4, PROFILE_T5, PROFILE_T6])
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    // 틱 표본이 틱마다 하나씩 쌓인다
    expect(cur.tickHistory.filter((t) => t.turnIndex === 4).length).toBe(4)
  })

  it('an unanswered interrupt times out to its authored default', () => {
    let s = createGame(scenario, 1)
    for (const ti of [0, 1, 2, 3]) {
      for (const [id, opts] of HISTORICAL[ti] ?? []) s = applyDecision(s, scenario, id, opts)
      s = advanceTurn(s, scenario)
    }
    s = applyDecision(s, scenario, 't4-d1', ['t4-d1-a'])
    s = advanceTick(s, scenario) // tick 1 — 인터럽트 개시
    expect(s.openInterrupts).toContain('t4-i1')
    s = advanceTick(s, scenario) // tick 2 — 마감 스윕이 기본 옵션으로 확정
    expect(s.openInterrupts).not.toContain('t4-i1')
    const rec = s.decisions.find((d) => d.decisionId === 't4-i1')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t4-i1-d'])
    expect(rec!.timedOut).toBe(true)
    expect(rec!.interrupt).toBe(true)
    expect(s.counters.timeouts).toBe(1)
  })

  it('an answered interrupt overrides the default and lands its effects', () => {
    let s = createGame(scenario, 1)
    for (const ti of [0, 1, 2, 3]) {
      for (const [id, opts] of HISTORICAL[ti] ?? []) s = applyDecision(s, scenario, id, opts)
      s = advanceTurn(s, scenario)
    }
    s = applyDecision(s, scenario, 't4-d1', ['t4-d1-a'])
    s = advanceTick(s, scenario)
    const before = s.counters.etfCreationUsed ?? 0
    s = applyDecision(s, scenario, 't4-i1', ['t4-i1-c'])
    expect(s.openInterrupts).not.toContain('t4-i1')
    expect(s.counters.etfCreationUsed ?? 0).toBeGreaterThan(before)
    expect(s.counters.timeouts ?? 0).toBe(0)
  })

  it('dialogue: both conversations record a reply path and replay deterministically', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const board = r.decisions.find((d) => d.decisionId === 't2-d2')
    expect(board?.optionIds).toEqual(['t2-d2-a'])
    expect(board?.path?.length).toBeGreaterThanOrEqual(1)
    const holder = r.decisions.find((d) => d.decisionId === 't5-i1')
    expect(holder?.optionIds).toEqual(['t5-i1-c'])
    expect(holder?.path).toEqual(['h-open-hedge'])
    console.log('[dialogue] historical paths — board', board?.path, '/ holder', holder?.path)
    // 같은 로그를 다시 걸으면 경로가 재검증되고 같은 상태가 나온다
    const again = replay(scenario, { seed: 1, decisions: r.decisions, turnIndex: 7 })
    expect(again.state.institution).toEqual(r.state.institution)
    expect(again.state.counters.swingPromisedBp).toBe(r.state.counters.swingPromisedBp)
  })

  it('dialogue: a swing level reported to the board and then deferred is judged the next day', () => {
    const path = (p: string[]): Record<number, [string, string[], string[]?][]> => ({
      0: [['t0-d1', ['t0-d1-a']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-a'], p],
      ],
      3: [['t3-d1', ['t3-d1-c']]],
      4: [['t4-d1', ['t4-d1-a']]],
      5: [
        ['t5-d2', ['t5-d2-a']],
        ['t5-d1', ['t5-d1-a']],
      ],
      6: [['t6-d1', ['t6-d1-a']]],
      7: [['t7-d1', ['t7-d1-a']]],
    })
    const breach = driveWithPaths(path(['sw-open-measure', 'swingPromisedBp-60', 'sw-time-defer']))
    const honest = driveWithPaths(path(['sw-open-noauth']))
    // 같은 옵션(t2-d2-a)으로 귀결하지만 약속의 유무가 카운터에 남는다
    expect(breach.counters.swingPromisedBp).toBe(60)
    expect(honest.counters.swingPromisedBp ?? 0).toBe(0)
    // 약속한 날(T2)에는 차이가 없고, 다음 날(T3)에 지연효과가 판정한다
    expect(metricAt(breach, 2, 'confidence')).toBe(metricAt(honest, 2, 'confidence'))
    expect(metricAt(breach, 3, 'confidence')).toBeLessThan(metricAt(honest, 3, 'confidence'))
    console.log(
      '[dialogue] swing promise — T3 confidence breach/honest',
      metricAt(breach, 3, 'confidence'),
      '/',
      metricAt(honest, 3, 'confidence'),
    )
  })

  it('dialogue: the fairness promise to the largest holder is judged two days later', () => {
    const path = (reply: string): Record<number, [string, string[], string[]?][]> => ({
      0: [['t0-d1', ['t0-d1-a']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-a'], ['sw-open-noauth']],
      ],
      3: [['t3-d1', ['t3-d1-c']]],
      4: [['t4-d1', ['t4-d1-a']]],
      5: [
        ['t5-d2', ['t5-d2-a']],
        ['t5-i1', ['t5-i1-a'], ['h-open-numbers', reply, 'h-size-full']],
        ['t5-d1', ['t5-d1-a']],
      ],
      6: [['t6-d1', ['t6-d1-a']]],
      7: [['t7-d1', ['t7-d1-a']]],
    })
    const promised = driveWithPaths(path('h-pf-commit'))
    const candid = driveWithPaths(path('h-pf-liquid'))
    expect(promised.flags.promised_fair_slicing).toBe(true)
    expect(candid.flags.promised_fair_slicing).toBeUndefined()
    // 약속한 날(T5)에는 결과가 같다 — 같은 옵션으로 귀결했기 때문이다
    expect(metricAt(promised, 5, 'confidence')).toBe(metricAt(candid, 5, 'confidence'))
    // 3/24(T7)에 비유동 비중이 오히려 올라가 약속이 반박된다
    expect(metricAt(promised, 7, 'illiquidSharePct')).toBeGreaterThanOrEqual(36)
    expect(metricAt(promised, 7, 'confidence')).toBeLessThan(metricAt(candid, 7, 'confidence'))
    console.log(
      '[dialogue] fairness promise — T7 confidence promised/candid',
      metricAt(promised, 7, 'confidence'),
      '/',
      metricAt(candid, 7, 'confidence'),
      '| T7 illiquid share',
      metricAt(promised, 7, 'illiquidSharePct').toFixed(2),
    )
  })

  it('game over — forced gate: ring-fencing the liquid buckets leaves nothing sellable', () => {
    const s = drive({
      0: [['t0-d1', ['t0-d1-e']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [['t3-d1', ['t3-d1-a']]],
      4: [['t4-d1', ['t4-d1-a']]],
      5: [
        ['t5-d2', ['t5-d2-a']],
        ['t5-d1', ['t5-d1-a']],
      ],
    })
    dump('gameover:forced-gate', s)
    expect(s.flags.forced_gate).toBe(true)
    expect(s.ended?.reason).toBe('forced_gate')
    expect(s.ended?.failed).toBe(true)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('game over — orderly wind-down: a voluntary gate held past two business days', () => {
    const s = drive({
      0: [['t0-d1', ['t0-d1-a']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [['t3-d1', ['t3-d1-c']]],
      4: [['t4-d1', ['t4-d1-a']]],
      5: [
        ['t5-d2', ['t5-d2-a']],
        ['t5-d1', ['t5-d1-d']],
      ],
      6: [['t6-d1', ['t6-d1-e']]],
      7: [['t7-d1', ['t7-d1-a']]],
    })
    dump('gameover:suspension', s)
    expect(s.flags.gated_voluntary).toBe(true)
    expect(s.ended?.reason).toBe('suspension_wind_down')
    expect(s.ended?.orderly).toBe(true)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(60)
  })

  it('game over — NAV break is reachable from the worst combination of choices', () => {
    const s = drive({
      0: [['t0-d1', ['t0-d1-e']]],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-c']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [['t3-d1', ['t3-d1-c']]],
      4: [['t4-d1', ['t4-d1-e']]],
      5: [
        ['t5-d2', ['t5-d2-d']],
        ['t5-d1', ['t5-d1-c']],
      ],
      6: [['t6-d1', ['t6-d1-c']]],
      7: [['t7-d1', ['t7-d1-a']]],
    })
    dump('gameover:nav-break', s)
    expect(s.ended?.reason).toBe('nav_break')
    expect(s.ended?.failed).toBe(true)
    expect(minOf(s, 'navIndex')).toBeLessThan(83)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('worst and random policies complete without NaN/Infinity and score inside [0,100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        expect(findNonFinite(r.state)).toEqual([])
        for (const h of r.history) expect(findNonFinite(h)).toEqual([])
        expect(r.state.ended).toBeDefined()
        const score = computeScore(r.state, scenario)
        expect(findNonFinite(score)).toEqual([])
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
