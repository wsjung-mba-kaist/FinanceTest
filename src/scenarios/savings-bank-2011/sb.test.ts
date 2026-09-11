import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  canAdvanceTick,
  computeScore,
  createGame,
  latestSnapshot,
  replay,
  validateScenario,
  type CentralBankState,
  type GameState,
  type ScenarioDefinition,
} from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { cardIds, sourceIds } from '../../content'
import { affiliateSpill, sbFx } from './fx'
import scenario from './scenario'
import { T2_QUEUE_PROFILE, T3_QUEUE_PROFILE } from './turnsA'
import { T6_QUEUE_PROFILE } from './turnsB'

type State = GameState<CentralBankState>

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
const FORBIDDEN_IN_TURNS = ['2012', '2013', '2014', '2026', '27.2조', '대법원']

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
  'label',
])

function collectTurnText(node: unknown, out: string[], key?: string): void {
  if (key !== undefined && NON_TEXT_KEYS.has(key)) return
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((v) => collectTurnText(v, out, key))
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) collectTurnText(v, out, k)
}

/** Evaluates every authored checkpoint against a finished run. */
function checkpointReport(s: State): { label: string; expected: number; actual: number; ok: boolean }[] {
  return (scenario.checkpoints ?? []).map((c) => {
    const turnIndex = scenario.turns.findIndex((t) => t.id === c.turnId)
    const snap = s.metricsHistory.find((m) => m.turnIndex === turnIndex)
    const actual = c.metric
      ? (snap?.metrics[c.metric]?.value ?? NaN)
      : c.counter
        ? (s.counters[c.counter] ?? NaN)
        : NaN
    const diff = Math.abs(actual - c.expected)
    const ok =
      Number.isFinite(actual) &&
      (diff <= Math.abs(c.expected) * c.tolerance ||
        (c.absTolerance !== undefined && diff <= c.absTolerance))
    return { label: c.label, expected: c.expected, actual, ok }
  })
}

describe('savings-bank-2011 scenario', () => {
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
      const hits = strings.filter((x) => x.includes(token))
      expect(hits, `forbidden token "${token}" in turn text`).toEqual([])
    }
  })

  it('historical path reproduces every checkpoint', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] fund   ', series(s, 'usableReserves'))
    console.log('[historical] cumOut ', series(s, 'depositOutflowCum'))
    console.log('[historical] failed ', series(s, 'failedBanks', 0))
    console.log('[historical] CI     ', series(s, 'confidence', 0))
    console.log('[historical] spillB ', series(s, 'spillBusan'))
    console.log('[historical] ended  ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    const report = checkpointReport(s)
    for (const row of report) {
      console.log(
        `[checkpoint] ${row.ok ? 'OK ' : 'FAIL'} expected ${row.expected} actual ${row.actual.toFixed(4)} — ${row.label}`,
      )
    }
    expect(report.filter((x) => !x.ok).map((x) => `${x.label}: ${x.actual}`)).toEqual([])
    // 발표가 이틀 만에 뒤집히는 역사적 사실이 엔진에서도 재현된다
    expect(s.flags.reassurance_contradicted).toBe(true)
    for (const m of s.metricsHistory) expect(m.metrics.usableReserves!.value).toBeGreaterThan(0)
    logScore('historical', s)
  })

  it('expert path avoids the contagion and outscores the historical path', () => {
    const e = autoplay(scenario, 'expert', { seed: 1 }).state
    const h = autoplay(scenario, 'historical', { seed: 1 }).state
    console.log('[expert] fund   ', series(e, 'usableReserves'))
    console.log('[expert] cumOut ', series(e, 'depositOutflowCum'))
    console.log('[expert] failed ', series(e, 'failedBanks', 0))
    console.log('[expert] CI     ', series(e, 'confidence', 0))
    console.log('[expert] ended  ', e.ended?.reason, e.ended?.title)
    expect(e.ended?.failed).toBe(false)
    const expert = logScore('expert', e)
    const hist = computeScore(h, scenario)
    expect(expert.total).toBeGreaterThan(hist.total)
    // 계열을 한 번에 닫았으므로 옮겨 갈 창구가 없었고 약속도 뒤집히지 않았다
    expect(e.flags.reassurance_contradicted).toBeUndefined()
    expect(e.counters.partialSuspensions ?? 0).toBe(0)
    expect(metricAt(e, 7, 'depositOutflowCum')).toBeLessThan(metricAt(h, 7, 'depositOutflowCum'))
  })

  // ------------------------------------------------------------------ 전염 모형
  it('the contagion model moves withdrawals to the next institution when one is suspended alone', () => {
    // affiliateSpill 그 자체: 잔여가 있으면 압력이 붙고, 계열을 한 번에 닫으면 1이다
    expect(affiliateSpill(0.4, 3.9)).toBeCloseTo(1 + 1.6 * 0.4, 10)
    expect(affiliateSpill(1, 0)).toBe(1)

    const partial = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d2', ['t2-d2-a']],
        ['t2-d1', ['t2-d1-b']],
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
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-a']],
      ],
      7: [
        ['t7-d1', ['t7-d1-a']],
        ['t7-d2', ['t7-d2-a']],
      ],
    })
    const simultaneous = drive({
      0: [
        ['t0-d1', ['t0-d1-b']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d2', ['t2-d2-a']],
        ['t2-d1', ['t2-d1-b']],
      ],
      3: [
        ['t3-d1', ['t3-d1-d']],
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
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-a']],
      ],
      7: [
        ['t7-d1', ['t7-d1-a']],
        ['t7-d2', ['t7-d2-a']],
      ],
    })
    const p = partial.institution.custom
    const q = simultaneous.institution.custom
    console.log(
      '[contagion] partial  spillBusan',
      partial.counters.spillBusan,
      'depBusan',
      p.depBusan!.toFixed(3),
      'outflowBusan',
      p.outflowBusan!.toFixed(4),
      'busanRateToday',
      p.busanRateToday!.toFixed(5),
    )
    console.log(
      '[contagion] together spillBusan',
      simultaneous.counters.spillBusan,
      'depBusan',
      q.depBusan!.toFixed(3),
      'outflowBusan',
      q.outflowBusan!.toFixed(4),
    )
    // 둘만 정지하면 남은 세 곳으로 인출이 옮겨 간다
    expect(partial.counters.partialSuspensions).toBe(1)
    expect(partial.flags.partial_affiliate_suspension).toBe(true)
    expect(p.outflowBusan!).toBeGreaterThan(0)
    // 계열을 한 번에 닫으면 옮겨 갈 창구가 없다 — 전염 계수가 붙지 않고 잔여 수신도 0이다
    expect(q.depBusan!).toBeCloseTo(0, 6)
    expect(simultaneous.counters.partialSuspensions ?? 0).toBe(0)
    expect(simultaneous.flags.partial_affiliate_suspension).toBeUndefined()
    // 두 경로의 계열 인출은 2/17 이전까지 같다. 그 뒤의 차이가 곧 "옮겨 간 인출"이다.
    expect(p.outflowBusan! - q.outflowBusan!).toBeGreaterThan(0.05)
    expect(partial.counters.spillBusan!).toBeGreaterThan(simultaneous.counters.spillBusan!)
  })

  // ------------------------------------------------------------------ 게임오버 도달성
  it('every game-over rule is reachable', () => {
    // 1) 법정 절차 밖의 지급 제한 → R4
    const unsafe = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [['t2-d2', ['t2-d2-d']]],
    })
    console.log('[gameover:unsafe]', unsafe.ended?.reason, 'T', unsafe.ended?.turnIndex)
    expect(unsafe.ended?.reason).toBe('unsafe_act')
    expect(computeScore(unsafe, scenario).total).toBeLessThanOrEqual(40)

    // 2) 유예를 거듭하고 재원을 만들지 않으면 저축은행계정이 마른다
    const drained = drive({
      0: [
        ['t0-d1', ['t0-d1-c']],
        ['t0-d2', ['t0-d2-c']],
      ],
      1: [
        ['t1-d1', ['t1-d1-b']],
        ['t1-d2', ['t1-d2-c']],
      ],
      2: [
        ['t2-d2', ['t2-d2-c']],
        ['t2-d1', ['t2-d1-d']],
      ],
      3: [
        ['t3-d1', ['t3-d1-e']],
        ['t3-d2', ['t3-d2-b']],
      ],
      4: [
        ['t4-d1', ['t4-d1-c']],
        ['t4-d2', ['t4-d2-c']],
      ],
      5: [
        ['t5-d1', ['t5-d1-c']],
        ['t5-d2', ['t5-d2-d']],
      ],
      6: [
        ['t6-d1', ['t6-d1-d']],
        ['t6-d2', ['t6-d2-b']],
      ],
      7: [
        ['t7-d1', ['t7-d1-b']],
        ['t7-d2', ['t7-d2-d']],
      ],
    })
    console.log(
      '[gameover:fund]',
      drained.ended?.reason,
      'T',
      drained.ended?.turnIndex,
      series(drained, 'usableReserves'),
    )
    expect(['fund_exhausted', 'sector_run']).toContain(drained.ended?.reason)

    // 3) 업권 전반의 인출 — 사전 공표와 무대책이 겹치는 경로
    const run = drive({
      0: [
        ['t0-d1', ['t0-d1-c']],
        ['t0-d2', ['t0-d2-c']],
      ],
      1: [
        ['t1-d1', ['t1-d1-c']],
        ['t1-d2', ['t1-d2-c']],
      ],
      2: [
        ['t2-d2', ['t2-d2-c']],
        ['t2-d1', ['t2-d1-b']],
      ],
      3: [
        ['t3-d1', ['t3-d1-b']],
        ['t3-d2', ['t3-d2-b']],
      ],
      4: [
        ['t4-d1', ['t4-d1-c']],
        ['t4-d2', ['t4-d2-c']],
      ],
      5: [
        ['t5-d1', ['t5-d1-c']],
        ['t5-d2', ['t5-d2-d']],
      ],
      6: [
        ['t6-d1', ['t6-d1-c']],
        ['t6-d2', ['t6-d2-c']],
      ],
      7: [
        ['t7-d1', ['t7-d1-d']],
        ['t7-d2', ['t7-d2-d']],
      ],
    })
    console.log(
      '[gameover:run]',
      run.ended?.reason,
      'T',
      run.ended?.turnIndex,
      series(run, 'depositOutflowCum'),
    )
    expect(run.ended?.failed).toBe(true)
    expect(['sector_run', 'fund_exhausted']).toContain(run.ended?.reason)
  })

  // ------------------------------------------------------------------ L2: 틱 · 인터럽트 · 대화
  /** 같은 시나리오의 T2를 틱 이전 형태(하루치 단일 runoffStep)로 되돌린 변형. */
  function untickedT2(): ScenarioDefinition<CentralBankState> {
    return {
      ...scenario,
      turns: scenario.turns.map((t) => {
        if (t.id !== 't2') return t
        const { ticks, tickLabels, eachTick, ticker, interrupts, ...rest } = t
        void ticks
        void tickLabels
        void eachTick
        void ticker
        void interrupts
        return {
          ...rest,
          events: t.events.map((e) => {
            const { atTick, ...ev } = e
            void atTick
            return ev
          }),
          entryEffects: [
            ...(t.entryEffects ?? []),
            {
              id: 't2-runoff-single',
              description: '2/17 당일 인출 (틱 이전 단일 호출)',
              effects: [sbFx.runoffStep({ days: 1, profile: [1], label: '2/17 인출' })],
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

  it('T2 tick slices sum exactly to the un-ticked single-day run-off at variance 0', () => {
    const sum = (p: number[]) => p.reduce((a, b) => a + b, 0)
    expect(sum(T2_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(sum(T3_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(sum(T6_QUEUE_PROFILE)).toBeCloseTo(1, 12)
    expect(T2_QUEUE_PROFILE).toHaveLength(5)
    expect(T3_QUEUE_PROFILE).toHaveLength(5)
    expect(T6_QUEUE_PROFILE).toHaveLength(5)

    const ticked = autoplay(scenario, 'historical', { seed: 1, variance: 0 }).state
    const single = autoplay(untickedT2(), 'historical', { seed: 1, variance: 0 }).state
    const a = metricAt(ticked, 2, 'depositOutflowCum')
    const b = metricAt(single, 2, 'depositOutflowCum')
    console.log('[ticks] T2 cumulative outflow sliced', a, 'single', b)
    expect(Math.abs(a - b)).toBeLessThan(1e-9)
    expect(
      Math.abs(metricAt(ticked, 2, 'usableReserves') - metricAt(single, 2, 'usableReserves')),
    ).toBeLessThan(1e-9)
  })

  it('an unanswered interrupt times out to its default option (the historical choice)', () => {
    let s = createGame(scenario, 1)
    s = applyDecision(s, scenario, 't0-d1', ['t0-d1-a'])
    s = applyDecision(s, scenario, 't0-d2', ['t0-d2-a'])
    s = advanceTurn(s, scenario)
    s = applyDecision(s, scenario, 't1-d1', ['t1-d1-a'])
    s = applyDecision(s, scenario, 't1-d2', ['t1-d2-a'])
    s = advanceTurn(s, scenario)
    expect(s.turnIndex).toBe(2)
    s = applyDecision(s, scenario, 't2-d2', ['t2-d2-a'])
    s = advanceTick(s, scenario) // 11:00
    s = applyDecision(s, scenario, 't2-d1', ['t2-d1-b'])
    s = advanceTick(s, scenario) // 14:00 — 업계 전화가 도착한다
    expect(s.openInterrupts).toContain('t2-i1-peer')
    s = advanceTick(s, scenario) // 16:00 — 마감 스윕이 기본 옵션으로 확정한다
    expect(s.openInterrupts).not.toContain('t2-i1-peer')
    const rec = s.decisions.find((d) => d.decisionId === 't2-i1-peer')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t2-i1-a'])
    expect(rec!.timedOut).toBe(true)
    expect(rec!.interrupt).toBe(true)
    expect(s.counters.timeouts).toBe(1)
    // 기본 옵션 = 역사 선택이므로 무응답 플레이는 역사 경로로 수렴한다
    const it2 = scenario.turns[2]!.interrupts!.find((i) => i.id === 't2-i1-peer')!
    expect(it2.options.find((o) => o.id === it2.defaultOptionId)?.historical).toBe(true)
  })

  it('the T2 announcement dialogue walks and replays exactly (promises are committed)', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const rec = r.decisions.find((d) => d.decisionId === 't2-d1')
    expect(rec).toBeDefined()
    expect(rec!.optionIds).toEqual(['t2-d1-b'])
    expect(rec!.path).toEqual([
      'forum-joint',
      'pledgedBackstopTn-6',
      'pledgedNoSuspensionDays-120',
    ])
    expect(r.state.counters.pledgedBackstopTn).toBe(6)
    expect(r.state.counters.pledgedNoSuspensionDays).toBe(120)
    const back = replay(scenario, { seed: 1, decisions: r.decisions })
    expect(back.state.counters.pledgedNoSuspensionDays).toBe(120)
    expect(latestSnapshot(back.state).metrics).toEqual(latestSnapshot(r.state).metrics)
    expect(back.state.decisions.find((d) => d.decisionId === 't2-d1')!.path).toEqual(rec!.path)
  })

  it('the T5 capital-raise dialogue records the promised size and deadline', () => {
    const h = autoplay(scenario, 'historical', { seed: 1 })
    const rec = h.decisions.find((d) => d.decisionId === 't5-d2')
    expect(rec!.optionIds).toEqual(['t5-d2-b'])
    expect(rec!.path).toEqual(['ask-capital', 'capitalDemandTn-0.8', 'capitalDeadlineDays-120'])
    expect(h.state.counters.capitalDeadlineDays).toBe(120)
    // 기한이 경영진단 이후라 자구계획이 도착하지 않고 정리 소요가 커진다
    expect(h.state.counters.forbearanceCost ?? 0).toBeGreaterThan(0)

    const e = autoplay(scenario, 'expert', { seed: 1 })
    const erec = e.decisions.find((d) => d.decisionId === 't5-d2')
    expect(erec!.optionIds).toEqual(['t5-d2-a'])
    expect(e.state.counters.capitalDeadlineDays).toBe(60)
  })

  it('the conditional reassurance collapses two days later (ΔCI −12, contagion ×1.35)', () => {
    const h = autoplay(scenario, 'historical', { seed: 1 }).state
    expect(h.flags.reassurance_contradicted).toBe(true)
    expect(h.log.some((l) => l.includes('추가 정지 없다던 발표가 뒤집힘'))).toBe(true)
    // 같은 경로에서 약속만 바꾸면 붕괴가 일어나지 않는다
    const noPledge = drive({
      0: [
        ['t0-d1', ['t0-d1-a']],
        ['t0-d2', ['t0-d2-a']],
      ],
      1: [
        ['t1-d1', ['t1-d1-a']],
        ['t1-d2', ['t1-d2-a']],
      ],
      2: [
        ['t2-d2', ['t2-d2-a']],
        ['t2-d1', ['t2-d1-a']],
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
      6: [
        ['t6-d1', ['t6-d1-a']],
        ['t6-d2', ['t6-d2-a']],
      ],
      7: [
        ['t7-d1', ['t7-d1-a']],
        ['t7-d2', ['t7-d2-a']],
      ],
    })
    expect(noPledge.flags.reassurance_contradicted).toBeUndefined()
    expect(metricAt(noPledge, 3, 'confidence')).toBeGreaterThan(metricAt(h, 3, 'confidence'))
  })

  it('forbearance grows the eventual payout (the trap costs more than it saves)', () => {
    // t0-d1만 다르고 나머지는 같은 두 경로 — 유예의 값은 미루는 날이 아니라 정리하는 날에 청구된다.
    const run = (scope: string) =>
      drive({
        0: [
          ['t0-d1', [scope]],
          ['t0-d2', ['t0-d2-b']],
        ],
        1: [
          ['t1-d1', ['t1-d1-a']],
          ['t1-d2', ['t1-d2-d']],
        ],
        2: [
          ['t2-d2', ['t2-d2-a']],
          ['t2-d1', ['t2-d1-a']],
        ],
        3: [
          ['t3-d1', ['t3-d1-a']],
          ['t3-d2', ['t3-d2-c']],
        ],
        4: [
          ['t4-d1', ['t4-d1-a']],
          ['t4-d2', ['t4-d2-a']],
        ],
        5: [
          ['t5-d1', ['t5-d1-a']],
          ['t5-d2', ['t5-d2-a']],
        ],
        6: [
          ['t6-d1', ['t6-d1-a']],
          ['t6-d2', ['t6-d2-a']],
        ],
        7: [
          ['t7-d1', ['t7-d1-a']],
          ['t7-d2', ['t7-d2-b', 't7-d2-c']],
        ],
      })
    const forbear = run('t0-d1-c')
    const clean = run('t0-d1-a')
    expect(forbear.counters.forbearanceCost!).toBeGreaterThan(0.15)
    expect(forbear.institution.custom.forbearanceCount!).toBeGreaterThanOrEqual(5)
    expect(forbear.log.some((l) => l.includes('유예 가산 ×1.3'))).toBe(true)
    // T6의 정지는 두 경로가 동일하다 — 그런데도 유예 경로에서 기금이 더 많이 빠져나간다.
    const drop = (st: State) =>
      metricAt(st, 5, 'usableReserves') - metricAt(st, 6, 'usableReserves')
    console.log('[forbearance] T6 fund drop — forbear', drop(forbear), 'clean', drop(clean))
    expect(drop(forbear)).toBeGreaterThan(drop(clean) * 1.2)
    expect(computeScore(forbear, scenario).total).toBeLessThan(
      computeScore(clean, scenario).total,
    )
  })

  it('worst and random policies complete without NaN and score within [0, 100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
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
