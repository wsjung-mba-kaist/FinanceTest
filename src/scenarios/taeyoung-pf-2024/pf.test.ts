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
  type Checkpoint,
  type InstitutionState,
  type ScenarioDefinition,
  type Turn,
} from '../../engine'
import type { BankState } from '../../engine/types'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import typed from './scenario'
import { T2_CONSENT_PROFILE, T2_CONSENT_TOTAL } from './turnsA'
import { T5_CONSENT_PROFILE } from './turnsB'
import { PF_FACTS } from './facts'

/** 엔진의 autoplay/score 헬퍼는 제네릭 정의를 대상으로 쓰인다. */
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
    'consentPct',
    'securedConsentPct',
    'cet1Ratio',
    'provisionsCum',
    'pfExposure',
    'pfCdSharePct',
    'selfRescueDelivered',
    'confidence',
    'regulatorLevel',
  ])
    console.log(`[${label}] ${k.padEnd(20)}`, series(s, k))
  console.log(
    `[${label}] counters`,
    'realizedLoss',
    (s.counters.realizedLoss ?? 0).toFixed(3),
    'deferCost',
    (s.counters.deferCost ?? 0).toFixed(3),
    'auctionLoss',
    (s.counters.auctionLoss ?? 0).toFixed(3),
  )
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

/**
 * 지정한 경로로 구동한다: { turnIndex: [[decisionId, optionIds, path?], ...] }.
 * 틱이 있는 턴에서는 결정이 열리는 첫 틱까지 시계를 진행한 뒤 답한다 — 플레이어가 만나는 순서와 같다.
 */
function drive(perTurn: Record<number, [string, string[], string[]?][]>): State {
  let s = createGame(scenario, 1)
  while (s.phase !== 'ended') {
    const queue = [...(perTurn[s.turnIndex] ?? [])]
    let guard = 0
    while (queue.length > 0 && s.phase !== 'ended' && guard++ < 64) {
      const turn = scenario.turns[s.turnIndex]!
      const i = queue.findIndex(([id]) => {
        const d = turn.decisions.find((x) => x.id === id)
        const it = turn.interrupts?.find((x) => x.id === id)
        const from = d?.availableFrom ?? it?.atTick ?? 0
        return (d !== undefined || it !== undefined) && from <= s.tick
      })
      if (i < 0) {
        if (!canAdvanceTick(s, scenario)) break
        s = advanceTick(s, scenario)
        continue
      }
      const [decisionId, optionIds, path] = queue.splice(i, 1)[0]!
      s = applyDecision(s, scenario, decisionId, optionIds, path ? { path } : {})
    }
    if (s.phase === 'ended') break
    s = advanceTurn(s, scenario)
  }
  return s
}

/** tests/autoplay와 같은 의미: 역사 경로에서 해당 턴의 결정을 적용한 뒤의 값. */
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

/**
 * 사후정보 토큰: 플레이어가 결정 전에 읽는 텍스트에 공표 시점 이전 턴에서 등장하면 안 되는 토큰과
 * 최초 허용 턴. expert.rationale·trapExplanation은 사후 평가 텍스트이므로 제외한다.
 */
const HINDSIGHT_TOKENS: [token: string, firstTurn: number][] = [
  ['135.6', 5],
  ['2.70%', 5],
  ['6.94%', 5],
  ['13.73%', 5],
  ['부실우려', 6],
  ['사업성 평가 4단계', 6],
  ['경기대응완충자본', 6],
  ['230조', 6],
  ['17.57', 8],
  ['216.5', 8],
  ['21.0조', 8],
  ['28.05', 8],
]

function playerVisibleText(turn: Turn<BankState>): string {
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
  for (const d of [...turn.decisions, ...(turn.interrupts ?? [])]) {
    parts.push(d.title, d.prompt, d.context ?? '')
    for (const st of d.steps ?? []) {
      for (const l of st.lines) parts.push(l.text)
      parts.push(st.note ?? '')
      for (const r of st.replies) parts.push(r.label)
    }
    for (const o of d.options)
      parts.push(o.label, o.description, o.unavailableReason ?? '', o.consequences)
  }
  for (const h of turn.advisorHints ?? []) parts.push(h.text)
  for (const ce of turn.entryEffects ?? []) parts.push(ce.description ?? '')
  for (const ce of turn.tickEffects ?? []) parts.push(ce.description ?? '')
  return parts.join('\n')
}

/** 역사 경로를 drive()로 재현하기 위한 표. */
const HISTORICAL: Record<number, [string, string[], string[]?][]> = {
  0: [
    ['t0-d1', ['t0-d1-a']],
    ['t0-d2', ['t0-d2-a']],
  ],
  1: [
    ['t1-d1', ['t1-d1-b']],
    ['t1-d2', ['t1-d2-a'], ['t1-d2-r-share', 't1-d2-target-75', 't1-d2-r-plain-standstill']],
  ],
  2: [
    ['t2-d1', ['t2-d1-a']],
    ['t2-i1', ['t2-i1-c']],
    ['t2-d2', ['t2-d2-a']],
  ],
  3: [
    ['t3-d1', ['t3-d1-b'], ['t3-d1-r-all', 't3-d1-size-12000', 't3-d1-r-time-later']],
    ['t3-d2', ['t3-d2-a']],
  ],
  4: [
    ['t4-d2', ['t4-d2-b']],
    ['t4-i1', ['t4-i1-c']],
    ['t4-d1', ['t4-d1-b']],
  ],
  5: [
    ['t5-d1', ['t5-d1-b']],
    ['t5-i1', ['t5-i1-c']],
    ['t5-d2', ['t5-d2-b']],
  ],
  6: [
    ['t6-d1', ['t6-d1-b']],
    ['t6-d2', ['t6-d2-b']],
  ],
  7: [
    ['t7-d1', ['t7-d1-a']],
    ['t7-d2', ['t7-d2-a']],
  ],
}

describe('taeyoung-pf-2024 scenario', () => {
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

  it('the fact ledger covers the numeric leaves and declares every VERIFY item', () => {
    const paths = new Set(PF_FACTS.map((f) => f.path))
    for (const p of [
      'institution.cash',
      'institution.capital.cet1',
      'institution.rwa',
      'institution.custom.pfExposure',
      'institution.custom.claimBank',
      'market.creditSpreadIgBp',
      'market.custom.constructionPfSpreadBp',
    ])
      expect(paths.has(p), p).toBe(true)
    for (const f of PF_FACTS.filter((x) => x.tag === 'VERIFY'))
      expect(f.note, `${f.path} VERIFY note`).toBeTruthy()
  })

  it('contains no hindsight tokens in player-visible turn text before the announcement turn', () => {
    const problems: string[] = []
    scenario.turns.forEach((turn, ti) => {
      const text = playerVisibleText(turn as unknown as Turn<BankState>)
      for (const [token, firstTurn] of HINDSIGHT_TOKENS) {
        if (ti < firstTurn && text.includes(token))
          problems.push(`T${ti} (${turn.id}): "${token}" (허용 T${firstTurn}+)`)
      }
    })
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('exogenous market series are invariant to decisions', () => {
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    const expert = autoplay(scenario, 'expert', { seed: 1 }).state
    for (const t of [1, 2, 3, 4, 5, 6, 7]) {
      expect(metricAt(hist, t, 'market.corpAA3y')).toBe(metricAt(expert, t, 'market.corpAA3y'))
      expect(metricAt(hist, t, 'market.govt3y')).toBe(metricAt(expert, t, 'market.govt3y'))
    }
    expect(metricAt(hist, 5, 'market.pfSectorLoanTn')).toBe(135.6)
    expect(metricAt(hist, 5, 'market.pfSectorDelinqPct')).toBe(2.7)
  })

  it('historical path: the workout opens at 96.1% and completes with the MOU signed', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    dump('historical', s)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.flags.workout_open).toBe(true)
    expect(s.flags.plan_approved).toBe(true)
    expect(s.flags.mou_signed).toBe(true)
    // 개시 의결은 요건 75%를 크게 웃돈다
    expect(metricAt(s, 2, 'consentPct')).toBeGreaterThan(90)
    // 규제 최저선 위에서 완주한다 (2024.5.1부터 8.0%)
    expect(minOf(s, 'cet1Ratio')).toBeGreaterThan(8)
    expect(maxOf(s, 'regulatorLevel')).toBeLessThanOrEqual(2)
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
      const relErr = cp.expected === 0 ? 0 : Math.abs(actual - cp.expected) / Math.abs(cp.expected)
      const absErr = Math.abs(actual - cp.expected)
      console.log(
        `[checkpoint] ${cp.label}\n              actual ${actual.toFixed(3)} vs expected ${cp.expected} (rel ${(relErr * 100).toFixed(2)}%, abs ${absErr.toFixed(3)})`,
      )
      const ok =
        relErr <= cp.tolerance || (cp.absTolerance !== undefined && absErr <= cp.absTolerance)
      if (!ok) failures.push(`${cp.label}: ${actual} vs ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })

  it('expert path outscores the historical path and keeps more capital', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    dump('expert', s)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    const hist = autoplay(scenario, 'historical', { seed: 1 }).state
    // 자구안이 기한과 함께 들어와 더 많이 도착한다
    expect(metricAt(s, 7, 'selfRescueDelivered')).toBeGreaterThan(
      metricAt(hist, 7, 'selfRescueDelivered'),
    )
    // 이연 비용이 작다 — 브릿지론을 먼저 정리했기 때문이다
    expect(s.counters.deferCost ?? 0).toBeLessThan(hist.counters.deferCost ?? 0)
    expect(minOf(s, 'cet1Ratio')).toBeGreaterThan(8)
    const expert = logScore('expert', s)
    expect(expert.total).toBeGreaterThan(computeScore(hist, scenario).total)
  })

  it('the 동의율 mechanic decides the outcome: below 75% the workout is rejected', () => {
    // 채권액 41%의 은행권만 확보하고 나머지를 설득하지 않으면 요건을 넘지 못한다
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-c']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-c'], ['t1-d2-r-nothing']],
      ],
      2: [
        ['t2-d1', ['t2-d1-d']],
        ['t2-i1', ['t2-i1-c']],
        ['t2-d2', ['t2-d2-a']],
      ],
    })
    console.log('[vote-fail] consent', series(s, 'consentPct'), 'ended', s.ended?.reason)
    expect(s.flags.open_vote_held).toBe(true)
    expect(s.flags.open_vote_failed).toBe(true)
    expect(metricAt(s, 2, 'consentPct')).toBeLessThan(75)
    expect(s.ended?.reason).toBe('workout_failed')
    expect(s.ended?.failed).toBe(true)
    expect(computeScore(s, scenario).total).toBeLessThanOrEqual(58)
  })

  it('the secured-claim gate (제17조제2항) can reject a plan that clears the 3/4 total', () => {
    // 후순위 우선상환으로 개시 표를 사면 담보채권자가 계획 의결에서 이탈한다
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-b']],
        ['t1-d2', ['t1-d2-a'], ['t1-d2-r-priority', 't1-d2-target-75', 't1-d2-r-plain-standstill']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-i1', ['t2-i1-b']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d'], ['t3-d1-r-none']],
        ['t3-d2', ['t3-d2-a']],
      ],
      4: [
        ['t4-d2', ['t4-d2-b']],
        ['t4-i1', ['t4-i1-c']],
        ['t4-d1', ['t4-d1-b']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-i1', ['t5-i1-c']],
        ['t5-d2', ['t5-d2-c']],
      ],
    })
    console.log(
      '[secured-gate] total',
      series(s, 'consentPct'),
      '\n[secured-gate] secured',
      series(s, 'securedConsentPct'),
      '\n[secured-gate] ended',
      s.ended?.reason,
    )
    expect(s.flags.workout_open).toBe(true)
    expect(s.flags.plan_rejected).toBe(true)
    expect(s.ended?.reason).toBe('plan_rejected')
  })

  it('game over — capital buffer: freezing classification then paying the dividend breaches 8.0%', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-b']],
        ['t1-d2', ['t1-d2-b'], ['t1-d2-r-share', 't1-d2-target-85', 't1-d2-r-cost-newmoney']],
      ],
      2: [
        ['t2-d1', ['t2-d1-a']],
        ['t2-i1', ['t2-i1-a']],
        ['t2-d2', ['t2-d2-a']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d'], ['t3-d1-r-none']],
        ['t3-d2', ['t3-d2-c']],
      ],
      4: [
        ['t4-d2', ['t4-d2-d']],
        ['t4-i1', ['t4-i1-b']],
        ['t4-d1', ['t4-d1-d']],
      ],
      5: [
        ['t5-d1', ['t5-d1-a']],
        ['t5-i1', ['t5-i1-b']],
        ['t5-d2', ['t5-d2-a']],
      ],
      6: [
        ['t6-d1', ['t6-d1-d']],
        ['t6-d2', ['t6-d2-d']],
      ],
      7: [
        ['t7-d1', ['t7-d1-c']],
        ['t7-d2', ['t7-d2-c']],
      ],
    })
    console.log('[capital] cet1', series(s, 'cet1Ratio'), '\n[capital] ended', s.ended?.reason)
    expect(s.ended?.failed).toBe(true)
    expect(['capital_buffer_breach', 'regulator_order']).toContain(s.ended?.reason)
  })

  it('game over — regulator order is reachable from repeated classification freezes', () => {
    const s = drive({
      0: [
        ['t0-d1', ['t0-d1-b']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-b'], ['t1-d2-r-share', 't1-d2-target-85', 't1-d2-r-cost-newmoney']],
      ],
      2: [
        ['t2-d1', ['t2-d1-c']],
        ['t2-i1', ['t2-i1-b']],
        ['t2-d2', ['t2-d2-c']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d'], ['t3-d1-r-none']],
        ['t3-d2', ['t3-d2-c']],
      ],
      4: [
        ['t4-d2', ['t4-d2-c']],
        ['t4-i1', ['t4-i1-b']],
        ['t4-d1', ['t4-d1-c']],
      ],
      5: [
        ['t5-d1', ['t5-d1-c']],
        ['t5-i1', ['t5-i1-b']],
        ['t5-d2', ['t5-d2-d']],
      ],
      6: [
        ['t6-d1', ['t6-d1-c']],
        ['t6-d2', ['t6-d2-d']],
      ],
      7: [
        ['t7-d1', ['t7-d1-c']],
        ['t7-d2', ['t7-d2-c']],
      ],
    })
    console.log(
      '[regulator] level',
      series(s, 'regulatorLevel', 0),
      '\n[regulator] cet1',
      series(s, 'cet1Ratio'),
      '\n[regulator] ended',
      s.ended?.reason,
    )
    expect(s.ended?.failed).toBe(true)
    expect(['regulator_order', 'capital_buffer_breach', 'plan_rejected']).toContain(s.ended?.reason)
  })

  it('ticked turn: the per-tick consent slices sum to the un-ticked equivalent (variance 0)', () => {
    let s = createGame(scenario, 1)
    for (const ti of [0, 1]) {
      for (const [id, opts, path] of HISTORICAL[ti] ?? [])
        s = applyDecision(s, scenario, id, opts, path ? { path } : {})
      s = advanceTurn(s, scenario)
    }
    expect(s.turnIndex).toBe(2)
    expect(s.tick).toBe(0)
    const perTick: number[] = []
    let prev = 0
    for (let k = 0; k < T2_CONSENT_PROFILE.length; k++) {
      if (k > 0) s = advanceTick(s, scenario)
      const acc = s.counters.consentAccrued ?? 0
      perTick.push(acc - prev)
      prev = acc
    }
    const summed = perTick.reduce((a, b) => a + b, 0)
    console.log(
      '[ticks] T2 per-tick consent accrual (%p)',
      perTick.map((v) => v.toFixed(4)),
      'sum',
      summed.toFixed(6),
      'un-ticked equivalent',
      T2_CONSENT_TOTAL.toFixed(6),
    )
    expect(summed).toBeCloseTo(T2_CONSENT_TOTAL, 9)
    expect(perTick[0]! / summed).toBeCloseTo(T2_CONSENT_PROFILE[0]!, 9)
    expect(perTick[3]! / summed).toBeCloseTo(T2_CONSENT_PROFILE[3]!, 9)
    for (const p of [T2_CONSENT_PROFILE, T5_CONSENT_PROFILE])
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(s.tickHistory.filter((t) => t.turnIndex === 2).length).toBe(4)
  })

  it('an unanswered interrupt times out to its authored default', () => {
    let s = createGame(scenario, 1)
    for (const ti of [0, 1]) {
      for (const [id, opts, path] of HISTORICAL[ti] ?? [])
        s = applyDecision(s, scenario, id, opts, path ? { path } : {})
      s = advanceTurn(s, scenario)
    }
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-a'])
    s = advanceTick(s, scenario) // tick 1 — 인터럽트 개시
    expect(s.openInterrupts).toContain('t2-i1')
    s = advanceTick(s, scenario) // tick 2 — 마감 스윕이 기본 옵션으로 확정
    expect(s.openInterrupts).not.toContain('t2-i1')
    const rec = s.decisions.find((d) => d.decisionId === 't2-i1')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t2-i1-c'])
    expect(rec!.timedOut).toBe(true)
    expect(rec!.interrupt).toBe(true)
    expect(s.counters.timeouts).toBe(1)
  })

  it('dialogue: both conversations record a reply path and replay deterministically', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const negotiation = r.decisions.find((d) => d.decisionId === 't1-d2')
    expect(negotiation?.optionIds).toEqual(['t1-d2-a'])
    expect(negotiation?.path?.length).toBeGreaterThanOrEqual(2)
    const owner = r.decisions.find((d) => d.decisionId === 't3-d1')
    expect(owner?.optionIds).toEqual(['t3-d1-b'])
    expect(owner?.path?.length).toBeGreaterThanOrEqual(2)
    console.log('[dialogue] historical paths — t1-d2', negotiation?.path, '/ t3-d1', owner?.path)
    const again = replay(scenario, { seed: 1, decisions: r.decisions, turnIndex: 7 })
    expect(again.state.institution).toEqual(r.state.institution)
    expect(again.state.counters.workoutConsentTargetPct).toBe(
      r.state.counters.workoutConsentTargetPct,
    )
    expect(again.state.counters.selfRescuePledgedBn).toBe(r.state.counters.selfRescuePledgedBn)
  })

  it('dialogue: a consent target below the statutory 75% is judged the next turn', () => {
    const path = (target: string): Record<number, [string, string[], string[]?][]> => ({
      ...HISTORICAL,
      1: [
        ['t1-d1', ['t1-d1-b']],
        ['t1-d2', ['t1-d2-a'], ['t1-d2-r-share', target, 't1-d2-r-plain-standstill']],
      ],
    })
    const low = drive(path('t1-d2-target-67'))
    const ok = drive(path('t1-d2-target-75'))
    expect(low.counters.workoutConsentTargetPct).toBe(67)
    expect(ok.counters.workoutConsentTargetPct).toBe(75)
    // 약속한 날(T1)에는 차이가 없고, 다음 턴(T2)에 지연효과가 판정한다
    expect(metricAt(low, 1, 'consentPct')).toBeCloseTo(metricAt(ok, 1, 'consentPct'), 9)
    expect(metricAt(low, 2, 'consentPct')).toBeLessThan(metricAt(ok, 2, 'consentPct'))
    console.log(
      '[dialogue] target 67 vs 75 — T2 consent',
      metricAt(low, 2, 'consentPct').toFixed(2),
      '/',
      metricAt(ok, 2, 'consentPct').toFixed(2),
    )
  })

  it('trap: extending maturities while freezing classification is cheap now and dear later', () => {
    const base: Record<number, [string, string[], string[]?][]> = { ...HISTORICAL }
    const frozen = drive({
      ...base,
      3: [
        ['t3-d1', ['t3-d1-b'], ['t3-d1-r-all', 't3-d1-size-12000', 't3-d1-r-time-later']],
        ['t3-d2', ['t3-d2-c']],
      ],
    })
    const honest = drive(base)
    console.log(
      '[trap:freeze] frozen cet1',
      series(frozen, 'cet1Ratio'),
      '\n[trap:freeze] honest cet1',
      series(honest, 'cet1Ratio'),
    )
    expect(frozen.flags.classification_frozen).toBe(true)
    // 그 턴에는 충당금이 덜 쌓여 자본이 더 좋아 보인다
    expect(metricAt(frozen, 3, 'provisionsCum')).toBeLessThanOrEqual(
      metricAt(honest, 3, 'provisionsCum'),
    )
    // 재분류 지시가 온 뒤에는 총액이 역전되고 감독 단계가 오른다
    expect(metricAt(frozen, 6, 'provisionsCum')).toBeGreaterThan(
      metricAt(honest, 6, 'provisionsCum'),
    )
    expect(maxOf(frozen, 'regulatorLevel')).toBeGreaterThan(maxOf(honest, 'regulatorLevel'))
    expect(computeScore(frozen, scenario).total).toBeLessThan(computeScore(honest, scenario).total)
  })

  it('live-play volatility (variance 1) changes magnitudes but not the historical ending', () => {
    const canonical = autoplay(scenario, 'historical', { seed: 1, variance: 0 })
    for (const rngSeed of [1, 2, 3]) {
      const noisy = autoplay(scenario, 'historical', { seed: 1, rngSeed, variance: 1 })
      expect(findNonFinite(noisy.state)).toEqual([])
      expect(noisy.state.ended?.reason).toBe(canonical.state.ended?.reason)
      expect(noisy.state.flags.workout_open).toBe(true)
      expect(noisy.state.flags.mou_signed).toBe(true)
      const score = computeScore(noisy.state, scenario)
      expect(score.total).toBeGreaterThanOrEqual(0)
      expect(score.total).toBeLessThanOrEqual(100)
      console.log(
        `[variance1#${rngSeed}] consent T2`,
        metricAt(noisy.state, 2, 'consentPct').toFixed(2),
        'cet1 T7',
        metricAt(noisy.state, 7, 'cet1Ratio').toFixed(2),
        'score',
        score.total,
      )
    }
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
