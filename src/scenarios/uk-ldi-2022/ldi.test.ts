import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  applyDecision,
  autoplay,
  computeScore,
  createGame,
  latestSnapshot,
  replay,
  validateScenario,
  type Checkpoint,
  type InstitutionState,
  type ScenarioDefinition,
  type Turn,
} from '../../engine'
import type { PensionState } from '../../engine/types'
import { op } from '../../engine/fx/common'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { ldiFx } from './ldiFx'
import typed from './scenario'

/** The engine's autoplay/score helpers are written against the generic definition (mirrors tests/helpers). */
const scenario = typed as unknown as ScenarioDefinition<InstitutionState>

type State = ReturnType<typeof autoplay>['state']

function series(state: State, key: string, digits = 1): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(digits)}`)
    .join(' ')
}

function metricAt(state: State, turnIndex: number, key: string): number {
  const snap = state.metricsHistory.find((m) => m.turnIndex === turnIndex)
  return snap?.metrics[key]?.value ?? NaN
}

function minOf(state: State, key: string): number {
  return Math.min(...state.metricsHistory.map((m) => m.metrics[key]?.value ?? Infinity))
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

function dump(label: string, s: State) {
  for (const k of [
    'govt30y',
    'collateralHeadroomBp',
    'ldiLeverage',
    'hedgeRatio',
    'fundingRatio',
    'confidence',
  ])
    console.log(`[${label}] ${k.padEnd(20)}`, series(s, k, k === 'ldiLeverage' ? 2 : 1))
  console.log(`[${label}] ended`, s.ended?.reason, 'T', s.ended?.turnIndex, s.ended?.title)
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
  return undefined
}

function findNonFinite(value: unknown, path = ''): string[] {
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
  walk(value, path)
  return out
}

/** Player-visible text of a turn before any decision is committed (events, prompts, options, hints). */
function visibleText(turn: Turn<InstitutionState>): string {
  const out: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(push)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(push)
  }
  for (const ce of turn.entryEffects ?? []) push(ce.description)
  for (const ev of turn.events) {
    const { effects: _e, sourceRefs: _s, cardRefs: _c, id: _i, ...rest } = ev
    push(rest)
  }
  // Interrupts are decisions too, and a mid-turn call is as player-visible as a prompt.
  for (const d of [...turn.decisions, ...(turn.interrupts ?? [])]) {
    push([d.title, d.prompt, d.context])
    for (const o of d.options) {
      push([o.label, o.description, o.consequences, o.unavailableReason, o.trapExplanation])
      for (const de of o.delayedEffects ?? []) push(de.description)
      for (const pv of o.preview ?? []) push(pv.note)
    }
    for (const step of d.steps ?? []) {
      push([step.note, ...step.lines.map((l) => l.text)])
      for (const r of step.replies) push([r.label, r.trapExplanation])
    }
  }
  for (const it of turn.interrupts ?? []) push(it.lines.map((l) => l.text))
  for (const h of turn.advisorHints ?? []) push(h.text)
  return out.join('\n')
}

/** 사후정보 토큰: 실제 공표 시각 이전 턴의 플레이어 가시 텍스트에 등장하면 안 된다 (전문가 rationale·엔딩·디브리핑은 제외). */
const HINDSIGHT: { untilTurn: number; tokens: string[] }[] = [
  // 영란은행 임시 매입은 9/28 11:00 발표 → T4(9/28 08:30)까지 금지
  {
    untilTurn: 4,
    tokens: [
      '임시 매입',
      '경매',
      'TECRF',
      '담보 확대 레포',
      '£650억',
      '£193억',
      '−110bp',
      '10/14',
      '연동채 매입',
    ],
  },
  // 10/10 TECRF·회당 £100억, 10/11 연동채·"3일" → T5까지 금지
  {
    untilTurn: 5,
    tokens: ['TECRF', '담보 확대 레포', '£193억', '연동채 매입', '3일 남았', '£100억'],
  },
  // 10/14 결과 → T6까지 금지
  { untilTurn: 6, tokens: ['£193억', '재무장관 경질'] },
  // 사후 기준(FPC 2023.3 / TPR 2023.4)은 게임 중 어디에도 등장하지 않는다
  { untilTurn: 7, tokens: ['2023', 'FPC 권고', '최소 회복력', '250bp 기준'] },
]

/**
 * The same scenario with T5 collapsed back to a single tick: the four intraday −110bp slices become
 * one call and the ticker's net move is applied as a plain op. Used to assert that the sub-turn
 * conversion is **exactly** additive at `variance: 0` (calibration.md §12.1).
 */
function untickedT5(): ScenarioDefinition<InstitutionState> {
  const turns = typed.turns.map((t) => {
    if (t.id !== 't5') return t
    const flat: Turn<PensionState> = {
      ...t,
      ticks: undefined,
      tickLabels: undefined,
      ticker: undefined,
      interrupts: undefined,
      tickEffects: undefined,
      entryEffects: [
        ...(t.entryEffects ?? []),
        {
          id: 't5-boe-single',
          description: '비교용: 하루치 −110bp를 한 번에 적용',
          effects: [
            ldiFx.yieldTick({ deltaBp: -110, revalueBp: -110 }),
            ldiFx.postFromBuffer('반환 담보 정리'),
            op('market.govt30yBp', 'add', -110),
            op('market.govt10yBp', 'add', -50),
          ],
        },
      ],
      decisions: t.decisions.map((d) => ({ ...d, availableFrom: 0 })),
    }
    return flat
  })
  return { ...typed, turns } as unknown as ScenarioDefinition<InstitutionState>
}

/** Historical-path state at the start of `turnIndex`, then every remaining tick of it played out. */
function historicalThroughTurn(turnIndex: number): State {
  const full = autoplay(scenario, 'historical', { seed: 1 })
  const log = full.decisions.filter((d) => d.turnIndex < turnIndex)
  return replay(scenario, { seed: 1, decisions: log, turnIndex }).state
}

describe('uk-ldi-2022 scenario', () => {
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

  it('historical path reproduces the 9/23–27 spiral: forced deleveraging, gilt sales, survival with a wounded hedge', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    dump('historical', s)
    console.log(
      '[historical] forced cut events',
      s.counters.forcedCutEvents,
      'cumulative',
      s.counters.forcedDeleverage?.toFixed(2),
    )
    console.log(
      '[historical] gilts sold (direct / incl. unwinds)',
      s.counters.giltsSoldDirect?.toFixed(0),
      '/',
      s.counters.giltsSold?.toFixed(0),
    )
    expect(r.deviations).toEqual([])
    // 9/22→27 +130bp, 9/28 −110bp, 10/14 back above 5% (dossier yield path)
    expect(metricAt(s, 3, 'govt30y')).toBeCloseTo(5.1, 2)
    expect(metricAt(s, 5, 'govt30y')).toBeCloseTo(4.05, 2)
    expect(metricAt(s, 7, 'govt30y')).toBeCloseTo(5.1, 2)
    // pooled-fund mechanics: leverage band breached on Monday/Tuesday → forced exposure cuts
    expect(s.flags.forced_deleverage).toBe(true)
    expect(s.counters.forcedCutEvents).toBeGreaterThanOrEqual(2)
    expect(s.counters.forcedDeleverage!).toBeGreaterThan(0.2)
    expect(minOf(s, 'hedgeRatio')).toBeLessThan(60)
    expect(minOf(s, 'collateralHeadroomBp')).toBeLessThan(100)
    // the scheme survives (no scheme failed in 2022) and rebuilds a 300~400bp buffer after the window closes
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('상처 입은 헤지')
    expect(metricAt(s, 7, 'collateralHeadroomBp')).toBeGreaterThanOrEqual(250)
    expect(metricAt(s, 7, 'fundingRatio')).toBeGreaterThan(95)
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
      const err = Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      console.log(
        `[checkpoint] ${cp.label}: actual ${actual.toFixed(2)} vs expected ${cp.expected} (err ${(err * 100).toFixed(1)}%)`,
      )
      if (err > cp.tolerance) failures.push(`${cp.label}: ${actual} vs ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })

  it('expert path keeps the hedge, never gets force-deleveraged, ends resilient and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    dump('expert', s)
    expect(r.deviations).toEqual([])
    expect(s.flags.forced_deleverage).toBeUndefined()
    expect(s.counters.forcedCutEvents).toBeUndefined()
    expect(minOf(s, 'hedgeRatio')).toBeGreaterThanOrEqual(79)
    expect(minOf(s, 'collateralHeadroomBp')).toBeGreaterThan(150)
    expect(s.metricsHistory.every((m) => (m.metrics.marginCallPending?.value ?? 0) === 0)).toBe(
      true,
    )
    expect(metricAt(s, 7, 'collateralHeadroomBp')).toBeGreaterThanOrEqual(250)
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('준비가 만든 결과')
    expect(s.flags.recap_complete).toBe(true)
    expect(s.flagTurns.recap_complete).toBeLessThanOrEqual(3)
    const expert = logScore('expert', s)
    const histState = autoplay(scenario, 'historical', { seed: 1 }).state
    const hist = computeScore(histState, scenario)
    expect(expert.total).toBeGreaterThan(hist.total)
    expect(expert.grade).toMatch(/[SA]/)
    expect(s.counters.fireSaleLoss!).toBeLessThan(histState.counters.fireSaleLoss!)
  })

  it('trap: levering up to 4x then waiting → forced deleveraging → hedge collapse by Monday', () => {
    const s = drive({ 0: [['t0-d1', ['t0-d']]], 1: [['t1-d1', ['t1-a']]] })
    dump('trap:lever-up', s)
    expect(s.ended?.reason).toBe('hedge_collapse')
    expect(s.ended?.failed).toBe(true)
    expect(s.ended?.orderly).toBeFalsy()
    expect(s.ended?.turnIndex).toBeLessThanOrEqual(2)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('trap: "lock in the funding gain" hedge cut on 9/28 morning → −110bp reversal → funding collapse', () => {
    const s = drive({
      0: [['t0-d1', ['t0-a']]],
      1: [['t1-d1', ['t1-a']]],
      2: [
        ['t2-d1', ['t2-e', 't2-b']],
        ['t2-d2', ['t2-d2-b']],
      ],
      3: [['t3-d1', ['t3-a']]],
      4: [['t4-d1', ['t4-e']]],
    })
    dump('trap:lock-in', s)
    expect(s.flags.hedge_cut_voluntary).toBe(true)
    expect(metricAt(s, 4, 'hedgeRatio')).toBeLessThan(40)
    expect(s.ended?.reason).toBe('funding_collapse')
    expect(s.ended?.turnIndex).toBe(5)
    expect(metricAt(s, 5, 'fundingRatio')).toBeLessThan(90)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(40)
  })

  it('trap: voluntary 60% cut then a further 50% cut → orderly "hedge unwound" ending', () => {
    const s = drive({
      0: [['t0-d1', ['t0-b', 't0-c', 't0-e']]],
      1: [['t1-d1', ['t1-e', 't1-c']]],
      2: [
        ['t2-d1', ['t2-c', 't2-d']],
        ['t2-d2', ['t2-d2-c']],
      ],
      3: [['t3-d1', ['t3-d']]],
      4: [['t4-d1', ['t4-e']]],
    })
    dump('trap:unwind', s)
    expect(s.flags.forced_deleverage).toBeUndefined()
    expect(s.ended?.reason).toBe('hedge_unwound')
    expect(s.ended?.orderly).toBe(true)
    expect(s.ended?.turnIndex).toBe(4)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(55)
  })

  it('operational readiness is the binding constraint: in-specie transfer is unavailable without the T0 agreement', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-a'])
    s = advanceTurn(s, scenario)
    expect(() => applyDecision(s, scenario, 't1-d1', ['t1-e'])).toThrow(/현물 이전 약정/)
    // cash sent without delegated authority only reaches the pool next turn (T+1)
    s = applyDecision(s, scenario, 't1-d1', ['t1-b'])
    expect(s.counters.cashInstructed).toBeCloseTo(150, 5)
    expect(s.institution.kind === 'pension' ? s.institution.assets.cash : NaN).toBeCloseTo(150, 5)
    s = advanceTurn(s, scenario)
    expect(s.counters.cashInstructed).toBe(0)
    expect(s.institution.kind === 'pension' ? s.institution.assets.cash : NaN).toBeCloseTo(0, 5)
  })

  it('T5의 일중 슬라이스 합계는 variance 0에서 단일 호출과 정확히 일치한다', () => {
    const ticked = autoplay(scenario, 'historical', { seed: 1 }).state
    const flat = autoplay(untickedT5(), 'historical', { seed: 1 }).state
    const keys = [
      'govt30y',
      'collateralHeadroomBp',
      'marginCallPending',
      'ldiLeverage',
      'hedgeRatio',
      'fundingRatio',
      'liquidAssets',
    ]
    const drift: string[] = []
    for (const k of keys) {
      const a = metricAt(ticked, 5, k)
      const b = metricAt(flat, 5, k)
      if (!(Math.abs(a - b) < 1e-9)) drift.push(`${k}: 틱 ${a} vs 단일 ${b}`)
    }
    // the pool's own books, not just the derived metrics
    const poolOf = (st: State) =>
      st.institution.kind === 'pension' ? st.institution.assets.ldi : undefined
    const pa = poolOf(ticked)!
    const pb = poolOf(flat)!
    for (const [k, a, b] of [
      ['equity', pa.equity, pb.equity],
      ['collateral.cash', pa.collateral.cash, pb.collateral.cash],
      ['collateral.eligibleGilts', pa.collateral.eligibleGilts, pb.collateral.eligibleGilts],
      ['marginCallOutstanding', pa.marginCallOutstanding, pb.marginCallOutstanding],
    ] as [string, number, number][]) {
      if (!(Math.abs(a - b) < 1e-9)) drift.push(`ldi.${k}: 틱 ${a} vs 단일 ${b}`)
    }
    expect(drift, `\n${drift.join('\n')}`).toEqual([])
  })

  it('T4 인터럽트는 무응답 시 역사적 기본 선택으로 자동 확정된다', () => {
    const s = historicalThroughTurn(4)
    const manager = s.decisions.find((d) => d.decisionId === 't4-i1-manager')
    expect(manager, '마진콜 통지 인터럽트가 확정되지 않았습니다').toBeDefined()
    expect(manager!.interrupt).toBe(true)
    expect(manager!.timedOut).toBe(true)
    expect(manager!.optionIds).toEqual(['t4-i1-ack'])
    const custodian = s.decisions.find((d) => d.decisionId === 't4-i2-custodian')
    expect(custodian?.timedOut).toBe(true)
    expect(custodian?.optionIds).toEqual(['t4-i2-standard'])
    // 무응답이 역사로 수렴한다: 기본 선택은 역사 옵션이고 효과는 카운터뿐이다
    const t4 = typed.turns.find((t) => t.id === 't4')!
    for (const it of t4.interrupts ?? []) {
      const def = it.options.find((o) => o.id === it.defaultOptionId)!
      expect(def.historical, `${it.id}의 기본 선택이 역사 옵션이 아닙니다`).toBe(true)
    }
  })

  it('T4 스폰서 협상 대화는 걸어간 응답 경로 그대로 재현된다', () => {
    const full = autoplay(scenario, 'historical', { seed: 1 })
    const rec = full.decisions.find((d) => d.decisionId === 't4-d2')
    expect(rec, 't4-d2가 확정되지 않았습니다').toBeDefined()
    expect(rec!.path).toEqual(['t4-d2-r-escalate', 't4-d2-ask-300', 't4-d2-r-pack'])
    expect(rec!.optionIds).toEqual(['t4-d2-a'])
    const again = replay(scenario, { seed: 1, decisions: full.decisions })
    expect(again.state.counters.sponsorAskM).toBe(300)
    expect(latestSnapshot(again.state).metrics).toEqual(latestSnapshot(full.state).metrics)
    // a path the scenario does not allow is rejected, never silently downgraded
    const broken = full.decisions.map((d) =>
      d.decisionId === 't4-d2' ? { ...d, path: ['t4-d2-r-pack'] } : d,
    )
    expect(() => replay(scenario, { seed: 1, decisions: broken })).toThrow()
  })

  it('협상에서 커버넌트 한도를 넘겨 부르면 출연금이 한 턴 늦게 도착한다', () => {
    // `replay` only ever moves forward, so the log must be truncated at the turn we want to read.
    const walk = (path: string[]) => {
      const full = autoplay(scenario, 'historical', { seed: 1 })
      const log = full.decisions
        .filter((d) => d.turnIndex <= 5)
        .map((d) => (d.decisionId === 't4-d2' ? { ...d, path } : d))
      return replay(scenario, { seed: 1, decisions: log, turnIndex: 5 }).state
    }
    const onTime = walk(['t4-d2-r-escalate', 't4-d2-ask-300', 't4-d2-r-pack'])
    const late = walk(['t4-d2-r-escalate', 't4-d2-ask-500', 't4-d2-r-pack'])
    expect(onTime.counters.sponsorAskM).toBe(300)
    expect(late.counters.sponsorAskM).toBe(500)
    // 한도 안의 요청은 T5에 도착해 요청 잔액이 비고, 한도 초과 요청은 T5까지 남아 있다
    expect(onTime.counters.sponsorInstructed ?? 0).toBe(0)
    expect(late.counters.sponsorInstructed ?? 0).toBeGreaterThan(0)
    expect(metricAt(late, 5, 'collateralHeadroomBp')).toBeLessThan(
      metricAt(onTime, 5, 'collateralHeadroomBp'),
    )
  })

  it('라이브 플레이(variance 1): 엔진 시드 10개에서 종료 사유가 흔들리지 않고 9/28 종가가 허용폭 안에 있다', () => {
    // `tests/engine/variance.test.ts`는 `rngSeed`(정책 난수)만 바꾸므로 엔진 노이즈 스트림은 한 가지다.
    // 여기서는 `seed`(엔진 난수 시드) 자체를 바꿔 실제 노이즈 분포를 확인한다.
    const canonical = autoplay(scenario, 'historical', { seed: 1, variance: 0 })
    const cp = (scenario.checkpoints ?? []).find((c) => c.turnId === 't5')!
    const problems: string[] = []
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const r = autoplay(scenario, 'historical', { seed, rngSeed: 7, variance: 1 })
      if (r.state.ended?.reason !== canonical.state.ended?.reason)
        problems.push(`seed ${seed}: 종료 사유 ${r.state.ended?.reason}`)
      if (findNonFinite(r.state).length > 0) problems.push(`seed ${seed}: 유한하지 않은 값`)
      const v = metricAt(r.state, 5, 'govt30y')
      const err = Math.abs(v - cp.expected) / cp.expected
      if (err > cp.tolerance)
        problems.push(`seed ${seed}: 9/28 종가 ${v.toFixed(3)} (허용 ±${cp.tolerance * 100}%)`)
      // 노이즈는 크기만 바꾼다 — 헤지비율(결과 축)은 정본과 같아야 한다
      if (
        Math.abs(metricAt(r.state, 5, 'hedgeRatio') - metricAt(canonical.state, 5, 'hedgeRatio')) >
        1e-9
      )
        problems.push(`seed ${seed}: 헤지비율이 노이즈로 바뀌었습니다`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('worst and random policies complete without NaN/Infinity', () => {
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
