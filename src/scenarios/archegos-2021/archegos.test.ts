import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  computeScore,
  createGame,
  getTurnView,
  latestSnapshot,
  replay,
  validateScenario,
  type Checkpoint,
  type GameState,
  type InstitutionState,
  type ScenarioDefinition,
  type Turn,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { BASE_BOOK, BASELINE_DEFECTORS, PEER_BANKS, STANDSTILL_HELD_MAX } from './fx'
import { T3_DAY_FACTOR } from './turnsA'
import { T4_DAY_FACTOR, T5_DAY_FACTOR } from './turnsB'
import typed from './scenario'

/** The engine's autoplay/score helpers are written against the generic definition (mirrors tests/helpers). */
const scenario = typed as unknown as ScenarioDefinition<InstitutionState>

type State = GameState<InstitutionState>

/** One step of a hand-driven path: which options to commit for a decision, with an optional dialogue path. */
type Step = [decisionId: string, optionIds: string[], path?: string[]]

/**
 * Drives a hand-picked path. Unlike a flat loop this advances ticks until each decision's
 * `availableFrom` window opens, so ticked turns (T3·T4·T5) can be driven at all. Interrupts that are
 * not named are left to the deadline sweep — which is exactly how a player who says nothing is handled.
 */
function drive(perTurn: Record<number, Step[]>, seed = 1): State {
  let s = createGame(scenario, seed)
  let guard = 0
  while (s.phase !== 'ended' && guard++ < 400) {
    const wanted = (perTurn[s.turnIndex] ?? []).filter(
      (step) => !s.decisions.some((r) => r.decisionId === step[0]),
    )
    const view = getTurnView(s, scenario, { mode: 'standard' })
    const openNow = wanted.find(
      (step) =>
        view.decisions.some((d) => d.decision.id === step[0] && !d.resolved) ||
        view.interrupts.some((d) => d.decision.id === step[0] && !d.resolved),
    )
    if (openNow) {
      s = applyDecision(s, scenario, openNow[0], openNow[1], openNow[2] ? { path: openNow[2] } : {})
      continue
    }
    if (wanted.length > 0 && canAdvanceTick(s, scenario)) {
      s = advanceTick(s, scenario)
      continue
    }
    // 이름을 주지 않은 필수 결정은 역사 경로로 채운다 (지정한 분기만 비교하기 위해).
    const unresolved = view.decisions.filter((d) => (d.decision.required ?? true) && !d.resolved)
    if (unresolved.length > 0) {
      const d = unresolved[0]!.decision
      const fallback = scenario.paths.historical.choices[d.id]
      const ids = fallback
        ? [fallback].flat()
        : d.options.filter((o) => o.historical).map((o) => o.id)
      if (ids.length > 0) {
        s = applyDecision(s, scenario, d.id, ids)
        continue
      }
    }
    s = advanceTurn(s, scenario)
  }
  return s
}

const HISTORICAL_STEPS: Record<number, Step[]> = {
  0: [
    ['t0-d1', ['t0-a']],
    ['t0-d2', ['t0-d2-a']],
  ],
  1: [
    ['t1-d1', ['t1-a']],
    ['t1-d2', ['t1-d2-a']],
    ['t1-d3', ['t1-d3-a']],
  ],
  2: [['t2-d1', ['t2-a']]],
  3: [
    ['t3-d1', ['t3-c'], ['t3-mc-r-grace']],
    ['t3-i1-client', ['t3-i1-defer']],
  ],
}

function metricAt(s: State, turnIndex: number, key: string): number {
  return s.metricsHistory.find((m) => m.turnIndex === turnIndex)?.metrics[key]?.value ?? NaN
}

function pbCustom(s: State, key: string): number {
  return s.institution.custom[key] ?? NaN
}

function realizedLoss(s: State): number {
  return s.institution.kind === 'prime_broker' ? s.institution.firm.realizedLoss : NaN
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

/** Player-visible text of a turn before any decision is committed (expert rationale excluded). */
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
  const pushDecision = (d: Turn<InstitutionState>['decisions'][number]) => {
    push([d.title, d.prompt, d.context])
    for (const st of d.steps ?? []) {
      push(st.lines)
      push(st.note)
      for (const r of st.replies) push([r.label, r.trapExplanation])
    }
    for (const o of d.options) {
      push([o.label, o.description, o.consequences, o.unavailableReason, o.trapExplanation])
      for (const de of o.delayedEffects ?? []) push(de.description)
    }
  }
  turn.decisions.forEach(pushDecision)
  for (const it of turn.interrupts ?? []) {
    push([it.title, it.prompt, it.context])
    push(it.lines)
    pushDecision(it)
  }
  for (const h of turn.advisorHints ?? []) push(h.text)
  return out.join('\n')
}

/** 사후정보 토큰: 실제로 알려진 시각 이전 턴의 플레이어 가시 텍스트에 등장하면 안 된다. */
const HINDSIGHT: { untilTurn: number; tokens: string[] }[] = [
  // 2020년 프롤로그에는 2021년 3월의 사실이 전혀 등장할 수 없다
  {
    untilTurn: 1,
    tokens: ['비아콤CBS', '디스커버리', '$105억', '블록 매각', '공동 통화', '스탠드스틸'],
  },
  // 3/25 저녁 공동 통화 이전에는 업계 합산 익스포저·스탠드스틸이 알려지지 않았다
  { untilTurn: 3, tokens: ['1,200억', '$105억', '$5.5bn', '55억 달러', 'Paul Weiss'] },
  // 3/26 블록이 돌기 전에는 골드만 $105억이 알려지지 않았다
  { untilTurn: 4, tokens: ['$105억', '$66억'] },
  // 사후 제재·조사 결과는 T6에서만 등장한다
  {
    untilTurn: 5,
    tokens: ['$268.5m', '2억6,850만', '£8,700만', '23명', '$70m 환수', '프라임서비스 철수'],
  },
]

describe('archegos-2021 scenario', () => {
  it('passes integrity lint (errors) with shared cards/sources', () => {
    const issues = validateScenario(scenario, { cardIds: cardIds(), sourceIds: sourceIds() })
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    const warnings = issues.filter((i) => i.level === 'warning')
    if (warnings.length) console.log('[warnings]\n' + formatIssues(warnings))
  })

  it('passes integrity lint standalone (scenario-local sources only)', () => {
    expect(validateScenario(scenario).filter((i) => i.level === 'error')).toEqual([])
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

  it('historical path reproduces the 3/22–3/26 record and survives with a $5.5bn loss', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    expect(r.deviations).toEqual([])
    // 프롤로그의 선택이 위기 당일의 책을 만든다: $3bn → $20bn
    expect(metricAt(s, 0, 'grossExposure')).toBeCloseTo(7.0, 6)
    expect(metricAt(s, 1, 'grossExposure')).toBeCloseTo(20.0, 6)
    // 정적 마진 7.5%는 청산 VaR의 5분의 1도 덮지 못한다
    expect(metricAt(s, 1, 'marginCoverage')).toBeLessThan(20)
    expect(metricAt(s, 1, 'concentrationDays')).toBeGreaterThan(30)
    // 3/24 유예 → 미회수 익스포저가 쌓이고, 3/25에 디폴트가 선언된다
    expect(s.flags.grace_granted).toBe(true)
    expect(s.counters.marginReceived).toBe(0)
    expect(metricAt(s, 4, 'marginShortfall')).toBeGreaterThan(1)
    expect(s.flags.default_declared).toBe(true)
    expect(s.flagTurns.default_declared).toBe(4)
    // 검증 없는 구두 합의 → 3/26 종료 시점까지 다섯 곳 이탈, 노무라·미쓰비시UFJ는 남는다
    expect(s.flags.standstill_signed).toBe(true)
    expect(s.flags.standstill_verified).toBeUndefined()
    expect(pbCustom(s, 'pbDefectors')).toBe(5)
    expect(s.counters.pbExit_nomura ?? 0).toBe(0)
    expect(s.counters.pbExit_mufg ?? 0).toBe(0)
    // 손실과 생존
    expect(realizedLoss(s)).toBeCloseTo(5.5, 0)
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toContain('청구서')
    console.log(
      '[historical] loss',
      realizedLoss(s).toFixed(3),
      'industry',
      pbCustom(s, 'industryLoss').toFixed(3),
      'defectors',
      pbCustom(s, 'pbDefectors'),
      'score',
      computeScore(s, scenario).total,
    )
  })

  it('reproduces every checkpoint on the historical path within tolerance', () => {
    const failures: string[] = []
    for (const cp of scenario.checkpoints ?? []) {
      const actual = checkpointActual(cp)
      if (actual === undefined || !Number.isFinite(actual)) {
        failures.push(`${cp.label}: no value`)
        continue
      }
      const err =
        cp.expected === 0
          ? Math.abs(actual)
          : Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      const absErr = Math.abs(actual - cp.expected)
      console.log(
        `[checkpoint] ${cp.label.slice(0, 48)} → ${actual.toFixed(3)} vs ${cp.expected} (${(err * 100).toFixed(1)}%)`,
      )
      if (err > cp.tolerance && !(cp.absTolerance !== undefined && absErr <= cp.absTolerance))
        failures.push(`${cp.label}: ${actual} vs ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })

  it('expert path keeps the book small, holds the standstill and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    expect(r.deviations).toEqual([])
    // 위기 이전에 책이 작아진다 (동적 마진 + 집중도 가산 → 고객이 물량을 옮긴다)
    expect(metricAt(s, 1, 'grossExposure')).toBeLessThan(15)
    expect(metricAt(s, 1, 'marginCoverage')).toBeGreaterThan(
      metricAt(autoplay(scenario, 'historical', { seed: 1 }).state, 1, 'marginCoverage'),
    )
    expect(s.flags.dynamic_margin).toBe(true)
    expect(s.flagTurns.dynamic_margin).toBeLessThanOrEqual(1)
    expect(s.flags.excess_returned).toBeUndefined()
    // 3/24 전액 수령 → 미회수 익스포저가 0으로 유지된다
    expect(metricAt(s, 3, 'marginShortfall')).toBe(0)
    expect(metricAt(s, 4, 'marginShortfall')).toBe(0)
    // 검증 있는 낮은 상한 → 이탈 최소, 상한 준수
    expect(s.flags.standstill_signed).toBe(true)
    expect(s.flags.standstill_verified).toBe(true)
    expect(s.counters.dailySellCapPct).toBe(5)
    expect(s.counters.capBreachPct).toBe(0)
    expect(pbCustom(s, 'pbDefectors')).toBeLessThanOrEqual(STANDSTILL_HELD_MAX)
    // 결과
    expect(realizedLoss(s)).toBeLessThan(1.5)
    expect(pbCustom(s, 'industryLoss')).toBeLessThan(6)
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.title).toContain('담보가 만든 결과')
    const expert = computeScore(s, scenario)
    const hist = computeScore(autoplay(scenario, 'historical', { seed: 1 }).state, scenario)
    console.log(
      '[expert] loss',
      realizedLoss(s).toFixed(3),
      'industry',
      pbCustom(s, 'industryLoss').toFixed(3),
      'defectors',
      pbCustom(s, 'pbDefectors'),
      'score',
      expert.total,
      expert.grade,
      'vs historical',
      hist.total,
    )
    expect(expert.total).toBeGreaterThan(hist.total)
    expect(expert.total - hist.total).toBeGreaterThan(20)
  })

  it('standstill vs sell-first: defecting is cheaper for the firm and far worse for the system', () => {
    const sellFirst = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-a'], ['t4-sa-r-sell']]],
      5: [['t5-d1', ['t5-a']]],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    const standstill = drive({
      ...HISTORICAL_STEPS,
      4: [
        ['t4-d1', ['t4-b'], ['t4-sa-r-join', 't4-sa-cap-5', 't4-sa-v-third']],
        ['t4-i2-peer', ['t4-i2-hold']],
      ],
      5: [
        ['t5-i1-desk', ['t5-i1-negotiate']],
        ['t5-d1', ['t5-b']],
      ],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    const sfLoss = realizedLoss(sellFirst)
    const ssLoss = realizedLoss(standstill)
    const sfIndustry = pbCustom(sellFirst, 'industryLoss')
    const ssIndustry = pbCustom(standstill, 'industryLoss')
    console.log(
      '[divergence] sell-first loss',
      sfLoss.toFixed(3),
      'industry',
      sfIndustry.toFixed(3),
      'defectors',
      pbCustom(sellFirst, 'pbDefectors'),
      '| standstill loss',
      ssLoss.toFixed(3),
      'industry',
      ssIndustry.toFixed(3),
      'defectors',
      pbCustom(standstill, 'pbDefectors'),
    )
    // 죄수의 딜레마: 배신이 자사에는 싸고 시스템에는 비싸다
    expect(sfLoss).toBeLessThan(ssLoss)
    expect(sfIndustry).toBeGreaterThan(ssIndustry * 1.8)
    // 다른 은행들의 행동이 플레이어의 선택에 반응한다 — 고정 대본이 아니다
    expect(pbCustom(sellFirst, 'pbDefectors')).toBe(PEER_BANKS.length)
    expect(sellFirst.counters.pbExit_nomura).toBe(1) // 3/25 야간에 전원 이탈
    expect(pbCustom(standstill, 'pbDefectors')).toBeLessThanOrEqual(STANDSTILL_HELD_MAX)
    expect(standstill.counters.pbExit_ms ?? 0).toBeGreaterThan(1) // 야간이 아니라 개장 이후
    // 그리고 감독·평판 비용은 배신한 쪽에 남는다
    expect(sellFirst.regulator.level).toBeGreaterThan(standstill.regulator.level)
    expect(computeScore(standstill, scenario).total).toBeGreaterThan(
      computeScore(sellFirst, scenario).total,
    )
  })

  it('peer behaviour responds to the committed sell cap and to verification, not to a script', () => {
    const base: Record<number, Step[]> = {
      ...HISTORICAL_STEPS,
      5: [['t5-d1', ['t5-a']]],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    }
    const tight = drive({
      ...base,
      4: [['t4-d1', ['t4-b'], ['t4-sa-r-join', 't4-sa-cap-5', 't4-sa-v-third']]],
    })
    const loose = drive({
      ...base,
      4: [['t4-d1', ['t4-c'], ['t4-sa-r-join', 't4-sa-cap-25', 't4-sa-l-sign']]],
    })
    const none = drive({ ...base, 4: [['t4-d1', ['t4-d'], ['t4-sa-r-declare']]] })
    const d = (s: State) => pbCustom(s, 'pbDefectors')
    console.log('[peer] tight', d(tight), 'loose', d(loose), 'no standstill', d(none))
    expect(d(tight)).toBeLessThan(d(loose))
    expect(d(loose)).toBeLessThanOrEqual(d(none))
    // 역사 경로(느슨한 상한 + 검증 없음)에서는 기준선 이탈 수와 정확히 일치해 체결 할인이 1.0배가 된다
    expect(d(loose)).toBe(BASELINE_DEFECTORS.close)
    expect(loose.counters.peerBaseline).toBe(BASELINE_DEFECTORS.close)
  })

  it('a broken sell cap is judged later by the delayed effect the dialogue wrote', () => {
    const kept = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-b'], ['t4-sa-r-join', 't4-sa-cap-5', 't4-sa-v-third']]],
      5: [
        ['t5-i1-desk', ['t5-i1-negotiate']],
        ['t5-d1', ['t5-b']],
      ],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    const broken = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-b'], ['t4-sa-r-join', 't4-sa-cap-5', 't4-sa-v-third']]],
      5: [
        ['t5-i1-desk', ['t5-i1-full']],
        ['t5-d1', ['t5-c']],
      ],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    expect(kept.counters.dailySellCapPct).toBe(5)
    expect(kept.counters.capBreachPct).toBe(0)
    expect(kept.flags.cap_breached).toBeUndefined()
    expect(broken.counters.dailySellCapPct).toBe(5)
    expect(broken.counters.capBreachPct ?? 0).toBeGreaterThan(20)
    expect(broken.flags.cap_breached).toBe(true)
    // 약속을 깨면 신뢰와 감독 단계로 돌아온다 (t4-b의 afterTurns:2 지연효과)
    expect(broken.confidence.index).toBeLessThan(kept.confidence.index)
    expect(broken.regulator.level).toBeGreaterThan(kept.regulator.level)
    console.log(
      '[cap] kept breach',
      kept.counters.capBreachPct,
      'CI',
      kept.confidence.index,
      '| broken breach',
      (broken.counters.capBreachPct ?? 0).toFixed(1),
      'CI',
      broken.confidence.index,
    )
  })

  it('every game-over rule is reachable', () => {
    // 1) 배정자본 소진: 마진 인하 → 한도 상향 → 유예 → 종가 일괄 처분
    const capital = drive({
      0: [
        ['t0-d1', ['t0-e']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d']],
        ['t1-d2', ['t1-d2-a']],
        ['t1-d3', ['t1-d3-a']],
      ],
      2: [['t2-d1', ['t2-d']]],
      3: [['t3-d1', ['t3-c'], ['t3-mc-r-grace']]],
      4: [['t4-d1', ['t4-d'], ['t4-sa-r-declare']]],
      5: [['t5-d1', ['t5-d']]],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    expect(capital.ended?.reason).toBe('capital_breach')
    expect(capital.ended?.failed).toBe(true)
    expect(realizedLoss(capital)).toBeGreaterThanOrEqual(6.5)

    // 2) 디폴트 미선언: 3/25에 기다리기를 선택하면 청산 권한 없이 익스포저만 커진다
    const unmanaged = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-e'], ['t4-sa-r-wait']]],
      5: [['t5-d1', ['t5-a']]],
    })
    expect(unmanaged.ended?.reason).toBe('unmanaged_default')
    expect(unmanaged.flags.default_declared).toBeUndefined()

    // 3) 행위 위반: 고객 청산 정보를 자기계정 데스크에 넘기면 즉시 R4
    const conduct = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-c'], ['t4-sa-r-join', 't4-sa-cap-25', 't4-sa-l-sign']]],
      5: [['t5-d1', ['t5-e']]],
    })
    expect(conduct.ended?.reason).toBe('conduct_order')
    expect(conduct.regulator.level).toBe(4)

    // 4) 질서 있는 실패: 손실 공표와 동시에 사업 전면 철수를 발표
    const surrender = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-c'], ['t4-sa-r-join', 't4-sa-cap-25', 't4-sa-l-sign']]],
      5: [['t5-d1', ['t5-a']]],
      6: [['t6-d1', ['t6-d']]],
    })
    expect(surrender.ended?.reason).toBe('franchise_surrender')
    expect(surrender.ended?.orderly).toBe(true)
    expect(computeScore(surrender, scenario).total).toBeLessThanOrEqual(58)

    for (const rule of scenario.gameOver) {
      const hit = [capital, unmanaged, conduct, surrender].some((s) => s.ended?.reason === rule.id)
      expect(hit, `게임오버 규칙 ${rule.id}에 도달하는 경로가 없습니다`).toBe(true)
    }
  })

  it('an unanswered interrupt times out to its authored default', () => {
    // 3/26 07:00 데스크 블록 오퍼를 아무도 받지 않으면 마감 스윕이 기본 옵션을 확정한다
    const s = drive({
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-c'], ['t4-sa-r-join', 't4-sa-cap-25', 't4-sa-l-sign']]],
      5: [['t5-d1', ['t5-a']]],
      6: [
        ['t6-d1', ['t6-a']],
        ['t6-d2', ['t6-d2-c']],
      ],
    })
    const desk = s.decisions.find((d) => d.decisionId === 't5-i1-desk')
    expect(desk, '데스크 인터럽트 기록이 없습니다').toBeDefined()
    expect(desk!.optionIds).toEqual(['t5-i1-partial'])
    expect(desk!.timedOut).toBe(true)
    expect(desk!.interrupt).toBe(true)
    // 같은 방식으로 3/24 고객 통화와 3/25 동종 PB 통화도 기본값으로 확정된다
    for (const id of ['t3-i1-client', 't4-i2-peer']) {
      const rec = s.decisions.find((d) => d.decisionId === id)
      expect(rec, `${id} 기록이 없습니다`).toBeDefined()
    }
    const peer = s.decisions.find((d) => d.decisionId === 't4-i2-peer')!
    expect(peer.optionIds).toEqual(['t4-i2-silent'])
    expect(peer.timedOut).toBe(true)
  })

  it('ticked turns: the per-tick mark slices multiply exactly to the single-day factor', () => {
    const s = autoplay(scenario, 'historical', { seed: 1 }).state
    // markIndex는 청산 비율과 무관하므로 틱 분할의 정확성을 그대로 보여준다.
    const idx = (t: number) => metricAt(s, t, 'grossExposure')
    // T2는 틱이 없는 턴: markDaily 한 번. T3·T4·T5는 5틱으로 쪼갠 같은 하루.
    // grossExposure는 청산으로도 줄어들므로 markIndex 자체를 상태에서 읽어 비교한다.
    const marks: number[] = []
    let g = createGame(scenario, 1)
    const stepsByTurn: Record<number, Step[]> = {
      ...HISTORICAL_STEPS,
      4: [['t4-d1', ['t4-c'], ['t4-sa-r-join', 't4-sa-cap-25', 't4-sa-l-sign']]],
      5: [['t5-d1', ['t5-a']]],
    }
    let guard = 0
    let lastTurn = -1
    while (g.phase !== 'ended' && guard++ < 400) {
      if (g.turnIndex !== lastTurn && g.tick === 0) {
        lastTurn = g.turnIndex
        marks.push(g.institution.custom.markIndex ?? NaN)
      }
      const wanted = (stepsByTurn[g.turnIndex] ?? []).filter(
        (step) => !g.decisions.some((r) => r.decisionId === step[0]),
      )
      const view = getTurnView(g, scenario, { mode: 'standard' })
      const openNow = wanted.find((step) =>
        view.decisions.some((d) => d.decision.id === step[0] && !d.resolved),
      )
      if (openNow) {
        g = applyDecision(
          g,
          scenario,
          openNow[0],
          openNow[1],
          openNow[2] ? { path: openNow[2] } : {},
        )
        continue
      }
      if (wanted.length > 0 && canAdvanceTick(g, scenario)) {
        g = advanceTick(g, scenario)
        continue
      }
      const pending = view.decisions.filter((d) => (d.decision.required ?? true) && !d.resolved)
      if (pending.length > 0) {
        const d0 = pending[0]!.decision
        const fb = scenario.paths.historical.choices[d0.id]
        const ids = fb ? [fb].flat() : d0.options.filter((o) => o.historical).map((o) => o.id)
        if (ids.length > 0) {
          g = applyDecision(g, scenario, d0.id, ids)
          continue
        }
      }
      g = advanceTurn(g, scenario)
    }
    // marks[i] = 각 턴 진입 직후(틱 0)의 지수. T3 진입 → T4 진입 사이가 3/24 하루다.
    expect(marks.length).toBeGreaterThanOrEqual(6)
    const ratio = (a: number, b: number) => marks[b]! / marks[a]!
    expect(ratio(3, 4)).toBeCloseTo(T3_DAY_FACTOR, 12)
    expect(ratio(4, 5)).toBeCloseTo(T4_DAY_FACTOR, 12)
    // T5는 마지막 틱이 종가이므로 턴 종료 후의 지수와 비교한다
    expect((g.institution.custom.markIndex ?? NaN) / marks[5]!).toBeCloseTo(T5_DAY_FACTOR, 12)
    console.log(
      '[ticks] markIndex by turn entry',
      marks.map((m) => m.toFixed(4)).join(' → '),
      '→ close',
      (g.institution.custom.markIndex ?? NaN).toFixed(4),
    )
    expect(idx(0)).toBeCloseTo(BASE_BOOK * 0.35, 6)
  })

  it('a dialogue path replays exactly and a tampered path is rejected', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const log = r.decisions
    const walked = log.filter((d) => d.path && d.path.length > 0)
    expect(walked.map((d) => d.decisionId)).toEqual(['t3-d1', 't4-d1'])
    expect(walked[0]!.path).toEqual(['t3-mc-r-negotiate', 't3-mc-c-cash', 't3-mc-amt-100'])
    expect(walked[1]!.path).toEqual(['t4-sa-r-join', 't4-sa-cap-5', 't4-sa-v-third'])

    const { state } = replay(scenario, { seed: 1, decisions: log })
    expect(realizedLoss(state)).toBeCloseTo(realizedLoss(r.state), 9)
    expect(state.counters.dailySellCapPct).toBe(r.state.counters.dailySellCapPct)
    expect(state.decisions.map((d) => d.path ?? null)).toEqual(log.map((d) => d.path ?? null))

    // 시나리오가 더 이상 허용하지 않는 경로는 조용히 통과하지 않는다
    const tampered = log.map((d) =>
      d.decisionId === 't4-d1' ? { ...d, path: ['t4-sa-r-join', 't4-sa-v-third'] } : d,
    )
    expect(() => replay(scenario, { seed: 1, decisions: tampered })).toThrow()
  })

  it('the margin dialogue turns the accepted share into recovered collateral', () => {
    const full = drive({
      ...HISTORICAL_STEPS,
      3: [['t3-d1', ['t3-a'], ['t3-mc-r-negotiate', 't3-mc-c-cash', 't3-mc-amt-100']]],
    })
    const half = drive({
      ...HISTORICAL_STEPS,
      3: [['t3-d1', ['t3-b'], ['t3-mc-r-negotiate', 't3-mc-c-cash', 't3-mc-amt-50']]],
    })
    expect(full.counters.marginDemandPct).toBe(100)
    expect(half.counters.marginDemandPct).toBe(50)
    // 전액을 받으면 정산 기준이 당일 개장가로 재설정되어 미회수 익스포저가 사라진다.
    expect(metricAt(full, 3, 'marginShortfall')).toBe(0)
    expect(metricAt(half, 3, 'marginShortfall')).toBeGreaterThan(0)
    expect(metricAt(full, 4, 'marginShortfall')).toBeLessThan(metricAt(half, 4, 'marginShortfall'))
    expect(realizedLoss(full)).toBeLessThan(realizedLoss(half))
    console.log(
      '[margin dialogue] 100% loss',
      realizedLoss(full).toFixed(3),
      '| 50% loss',
      realizedLoss(half).toFixed(3),
    )
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
          'loss',
          realizedLoss(r.state).toFixed(2),
          'score',
          score.total,
        )
      }
    }
  })
})
