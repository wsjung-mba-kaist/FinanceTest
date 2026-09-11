import { describe, expect, it } from 'vitest'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  autoplay,
  buildConditionContext,
  canAdvanceTick,
  computeScore,
  createGame,
  getTurnView,
  hasDialogue,
  latestSnapshot,
  replay,
  validateScenario,
  walkByPolicy,
  type Checkpoint,
  type GameState,
  type Turn,
} from '../../engine'
import type { PrimeBrokerState, ScenarioDefinition } from '../../engine/types'
import { getNumberPath } from '../../engine/core/paths'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import { ltcmFx, resolvePeers, settleShareM, DEAL_MIN_M } from './fx'
import scenario from './scenario'

type S = GameState<PrimeBrokerState>

const HIST = scenario.paths.historical.choices as Record<string, string[]>

function series(state: S, key: string): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(2)}`)
    .join(' ')
}

function metricAt(state: S, turnIndex: number, key: string): number {
  return state.metricsHistory.find((m) => m.turnIndex === turnIndex)?.metrics[key]?.value ?? NaN
}

/**
 * Commits one decision, walking its dialogue toward the wanted option the same way `autoplay` does
 * (so a `steps` decision records its reply path and its `commitReplies` counters, instead of being
 * skipped as if it had timed out).
 */
function commit<T extends S>(state: T, decisionId: string, optionIds: string[]): S {
  const decision = scenario.turns
    .flatMap((t) => [...t.decisions, ...(t.interrupts ?? [])])
    .find((d) => d.id === decisionId)
  if (decision && hasDialogue(decision) && optionIds.length === 1) {
    const walk = walkByPolicy(decision, buildConditionContext(state), {
      target: optionIds[0],
      prefer: 'rating',
    })
    if (walk && walk.optionId === optionIds[0]) {
      return applyDecision(state, scenario, decisionId, [walk.optionId], { path: walk.path })
    }
  }
  return applyDecision(state, scenario, decisionId, optionIds)
}

/**
 * Plays with explicit choices per decision. Unlike the plain autoplay policies this also answers
 * **interrupts** when a choice is given for them (otherwise they are left to the deadline sweep,
 * which commits each one's authored historical default).
 */
function play(
  choices: Record<string, string[]>,
  dialogues: Record<string, { path: string[]; optionId: string }> = {},
): S {
  let s = createGame(scenario, 1)
  let steps = 0
  while (s.phase !== 'ended' && steps++ < 400) {
    for (const id of [...s.openInterrupts]) {
      const wanted = choices[id]
      if (!wanted || s.phase === 'ended') continue
      s = commit(s, id, wanted)
    }
    if (s.phase === 'ended') break
    const view = getTurnView(s, scenario)
    const pending = view.decisions.filter((d) => !d.resolved && (d.decision.required ?? true))
    if (pending.length === 0) {
      if (canAdvanceTick(s, scenario)) {
        s = advanceTick(s, scenario)
        continue
      }
      s = advanceTurn(s, scenario)
      continue
    }
    const dv = pending[0]!
    const forced = dialogues[dv.decision.id]
    if (forced) {
      s = applyDecision(s, scenario, dv.decision.id, [forced.optionId], { path: forced.path })
      continue
    }
    const available = dv.options.filter((o) => o.available).map((o) => o.option)
    const wanted = (choices[dv.decision.id] ?? []).filter((id) =>
      available.some((o) => o.id === id),
    )
    const pick =
      wanted.length > 0
        ? wanted
        : [[...available].sort((a, b) => b.expert.rating - a.expert.rating)[0]!.id]
    s = commit(s, dv.decision.id, pick)
  }
  return s
}

function checkpointValue(state: S, cp: Checkpoint): number {
  if (cp.metric !== undefined) return metricAt(state, turnIndexOf(cp.turnId), cp.metric)
  if (cp.counter !== undefined) return state.counters[cp.counter] ?? NaN
  if (cp.path !== undefined) return getNumberPath(state, cp.path) ?? NaN
  return NaN
}

function turnIndexOf(turnId: string): number {
  return scenario.turns.findIndex((t) => t.id === turnId)
}

function checkpointOk(state: S, cp: Checkpoint): { ok: boolean; value: number } {
  const v = checkpointValue(state, cp)
  if (!Number.isFinite(v)) return { ok: false, value: v }
  const rel = cp.expected === 0 ? Infinity : Math.abs(v - cp.expected) / Math.abs(cp.expected)
  const abs = Math.abs(v - cp.expected)
  return {
    ok: rel <= cp.tolerance || (cp.absTolerance !== undefined && abs <= cp.absTolerance),
    value: v,
  }
}

/** Player-visible text of a turn (excludes debrief-only fields). */
function visibleText(turn: Turn<PrimeBrokerState>): string {
  const strip = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(strip)
    if (o && typeof o === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (
          ['expert', 'trapExplanation', 'calibrationNote', 'feasibility', 'sourceRefs'].includes(k)
        )
          continue
        if (typeof v === 'function') continue
        out[k] = strip(v)
      }
      return out
    }
    return o
  }
  return JSON.stringify(strip(turn))
}

/**
 * The same scenario with T3 collapsed back to a single tick: the five intraday convergence slices
 * become one jump to the day's close and the ticker's net moves are applied as plain ops. Used to
 * assert the sub-turn conversion is **exactly** additive at `variance: 0` (calibration.md §6.2).
 */
function untickedT3(): ScenarioDefinition<PrimeBrokerState> {
  const turns = scenario.turns.map((t) => {
    if (t.id !== 't3') return t
    const flat: Turn<PrimeBrokerState> = {
      ...t,
      ticks: undefined,
      tickLabels: undefined,
      ticker: undefined,
      interrupts: undefined,
      eachTick: [
        {
          id: 't3-convergence-single',
          description: '비교용: 9/21 수렴지수를 한 번에 152로',
          effects: [ltcmFx.convergenceStep({ values: [152], label: '9/21 수렴지수(단일)' })],
        },
      ],
      tickEffects: (t.tickEffects ?? []).map((e) => ({ ...e, atTick: 0 })),
      events: t.events.map((e) => ({ ...e, atTick: 0 })),
      decisions: t.decisions.map((d) => ({ ...d, availableFrom: 0, deadlineTick: undefined })),
    }
    return flat
  })
  return { ...scenario, turns }
}

describe('ltcm-1998 scenario', () => {
  it('passes the integrity lint with zero errors', () => {
    const issues = validateScenario(scenario)
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    const warnings = issues.filter((i) => i.level === 'warning')
    if (warnings.length) console.log('[warnings]\n' + formatIssues(warnings))
  })

  it('has no hindsight tokens before the events they describe', () => {
    // 컨소시엄·출자 총액·지분 90%·12:30 시한·불참 기관 이름은 9/22~23 이전 턴에 등장할 수 없다.
    for (let i = 0; i <= 2; i++) {
      expect(visibleText(scenario.turns[i]!), `turn ${scenario.turns[i]!.id}`).not.toMatch(
        /컨소시엄|3,625|3\.625|지분 90|12:30|12시 30분|베어스턴스|크레디아그리콜|공동 출자/,
      )
    }
    // 10/15 정례 회의 밖 인하는 플레이 중 어떤 턴에도 등장하지 않는다(디브리핑 전용).
    for (const t of scenario.turns) {
      expect(visibleText(t), `turn ${t.id}`).not.toMatch(/10월 15일|10\/15/)
    }
    // 외부 투자자 제안은 9/23(T5)에만 등장한다.
    for (let i = 0; i <= 4; i++) {
      expect(visibleText(scenario.turns[i]!), `turn ${scenario.turns[i]!.id}`).not.toMatch(
        /외부 투자자/,
      )
    }
    expect(visibleText(scenario.turns[5]!)).toMatch(/외부 투자자/)
  })

  it('historical path reproduces every checkpoint', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] netExp   ', series(s, 'netExposureB'))
    console.log('[historical] closeout ', series(s, 'closeoutLossB'))
    console.log('[historical] margin%  ', series(s, 'marginCoverage'))
    console.log('[historical] peerCoop ', series(s, 'peerCooperation'))
    console.log('[historical] loss     ', series(s, 'realizedLoss'))
    console.log('[historical] capital  ', series(s, 'firmCapital'))
    console.log('[historical] ended    ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])

    const failures: string[] = []
    for (const cp of scenario.checkpoints ?? []) {
      const { ok, value } = checkpointOk(s, cp)
      console.log(`[checkpoint] ${cp.label} → ${value}`)
      if (!ok) failures.push(`${cp.label}: 실제 ${value}, 기대 ${cp.expected}`)
    }
    expect(failures, `\n${failures.join('\n')}`).toEqual([])

    expect(s.ended?.failed).toBe(false)
    expect(s.flags.deal_closed).toBe(true)
    expect(s.flags.joined_consortium).toBe(true)
  })

  it('expert path also closes the deal and outscores the historical path', () => {
    const e = autoplay(scenario, 'expert', { seed: 1 })
    const h = autoplay(scenario, 'historical', { seed: 1 })
    console.log('[expert] deviations', e.deviations)
    console.log('[expert] netExp   ', series(e.state, 'netExposureB'))
    console.log('[expert] margin%  ', series(e.state, 'marginCoverage'))
    console.log('[expert] peerCoop ', series(e.state, 'peerCooperation'))
    console.log('[expert] loss     ', series(e.state, 'realizedLoss'))
    expect(e.deviations).toEqual([])
    expect(e.state.flags.deal_closed).toBe(true)
    expect(e.state.flags.aggregate_known).toBe(true)

    const es = computeScore(e.state, scenario)
    const hs = computeScore(h.state, scenario)
    const fmt = (r: ReturnType<typeof computeScore>) =>
      Object.fromEntries(Object.entries(r.dimensions).map(([k, v]) => [k, Math.round(v.score)]))
    console.log('[expert] score', es.total, es.grade, fmt(es))
    console.log('[historical] score', hs.total, hs.grade, fmt(hs))
    expect(es.total).toBeGreaterThan(hs.total)
  })

  it('worst and random policies finish with a finite score in [0,100]', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('NaN'), `${policy}#${rngSeed} NaN`).toBe(false)
        expect(json.includes('null'), `${policy}#${rngSeed} null`).toBe(false)
        expect(json.includes('Infinity'), `${policy}#${rngSeed} Infinity`).toBe(false)
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

  it('every game-over rule is reachable', () => {
    // 1) 계약 근거 없는 담보 처분 → R4 즉시 조치
    const seize = play({ ...HIST, 't3-d1': ['t3-seize'] })
    expect(seize.ended?.reason).toBe('unsafe_act')
    expect(seize.ended?.turnIndex).toBe(3)

    // 2) 납입 가능액을 넘는 청구 → 다음 날 아침 조기 디폴트
    const early = play(HIST, {
      't3-d1': {
        path: ['t3-r-explain', 'marginCallM-700', 't3-r-terms-daily'],
        optionId: 't3-strict',
      },
    })
    console.log('[early default] loss', early.institution.firm.realizedLoss.toFixed(3))
    expect(early.ended?.reason).toBe('client_default')
    expect(early.ended?.turnIndex).toBe(4)

    // 3) 공동 출자 결렬 → 무질서한 동시 청산
    const failed = play({ ...HIST, 't5-d1': ['t5-out'] })
    console.log(
      '[disorderly] total',
      failed.institution.custom.consortiumTotalM,
      'joiners',
      failed.institution.custom.peerJoinCount,
      'loss',
      failed.institution.firm.realizedLoss.toFixed(3),
    )
    expect(failed.ended?.reason).toBe('disorderly_closeout')

    // 4) 자본 잠식 — 유예 + 자기 북 확대 + 양자 청산 + 불참
    const wiped = play({
      ...HIST,
      't1-d1': ['t1-a'],
      't2-d1': ['t2-a'],
      't3-d1': ['t3-forbearance'],
      't3-i1-desk': ['t3-i1-add'],
      't4-d1': ['t4-bilateral'],
      't5-i1-peer': ['t5-i1-wait'],
      't5-d1': ['t5-out'],
    })
    console.log(
      '[capital] capital',
      wiped.institution.firm.capital.toFixed(3),
      'loss',
      wiped.institution.firm.realizedLoss.toFixed(3),
      'reason',
      wiped.ended?.reason,
    )
    expect(wiped.ended?.reason).toBe('capital')
  })

  it('joining versus staying out produces the designed loss gap', () => {
    const joined = play(HIST)
    const out = play({ ...HIST, 't5-d1': ['t5-out'] })
    const joinedLoss = joined.institution.firm.realizedLoss
    const outLoss = out.institution.firm.realizedLoss
    console.log(
      '[gap] joined',
      joinedLoss.toFixed(3),
      'out',
      outLoss.toFixed(3),
      'gap',
      (outLoss - joinedLoss).toFixed(3),
    )
    // 같은 협조도에서 코어그룹 참가사가 빠지면 총액이 성립선에 닿지 않는다.
    expect(joined.flags.deal_closed).toBe(true)
    expect(out.flags.deal_failed).toBe(true)
    // PWG: 무질서한 청산 시 일부 개별사 손실 $300M~$500M. 설계된 격차는 그 하단 이상이어야 한다.
    expect(outLoss - joinedLoss).toBeGreaterThan(0.3)
    // 출자로 묶은 자본($300M)보다 결렬의 비용이 크다 — 그것이 9/23 회의실의 계산이었다.
    expect(outLoss - joinedLoss).toBeGreaterThan(joined.institution.custom.pledgedCapitalB!)
  })

  it("other dealers' behaviour responds to the player's choice and timing", () => {
    // (a) 협조도가 같아도 출자 제시액이 참여 총액을 바꾼다.
    const high = play(HIST)
    const lowState = play(HIST, {
      't5-d1': {
        path: ['t5-r-equal', 'consortiumPledgeM-100', 't5-r-sign-orderly'],
        optionId: 't5-join-orderly',
      },
    })
    console.log(
      '[peers] 250→300M total',
      high.institution.custom.consortiumTotalM,
      '| 100M total',
      lowState.institution.custom.consortiumTotalM,
    )
    expect(high.institution.custom.consortiumTotalM).toBeGreaterThan(
      lowState.institution.custom.consortiumTotalM!,
    )
    // 소액 제시여도 다른 기관이 충분하면 합의는 성립한다 — 결렬과는 다른 결말이다.
    expect(lowState.flags.deal_closed).toBe(true)
    expect(lowState.flags.deal_failed).toBeFalsy()

    // (b) 같은 소액 제시라도 협조도가 낮으면 결렬된다.
    const lowTrust = play({
      ...HIST,
      't2-d1': ['t2-e'],
      't4-i1-frbny': ['t4-i1-decline'],
      't4-d1': ['t4-observe'],
      't5-i1-peer': ['t5-i1-wait'],
    })
    console.log(
      '[peers] low trust coop',
      lowTrust.institution.custom.peerCooperation,
      'total',
      lowTrust.institution.custom.consortiumTotalM,
      'joiners',
      lowTrust.institution.custom.peerJoinCount,
    )
    expect(lowTrust.institution.custom.peerCooperation!).toBeLessThan(
      high.institution.custom.peerCooperation!,
    )
    expect(lowTrust.institution.custom.peerJoinCount!).toBeLessThan(
      high.institution.custom.peerJoinCount!,
    )

    // (c) 순수 함수 수준에서도 단조적으로 반응한다.
    expect(resolvePeers(68, true, 350).totalM).toBeGreaterThan(resolvePeers(68, true, 100).totalM)
    expect(resolvePeers(80, false, 0).totalM).toBeGreaterThan(resolvePeers(40, false, 0).totalM)
    expect(settleShareM(250)).toBe(300)
    expect(resolvePeers(68, true, 250).totalM).toBe(3625)
    expect(resolvePeers(68, true, 250).joinCount).toBe(14)
    expect(resolvePeers(68, false, 0).totalM).toBeLessThan(DEAL_MIN_M)
  })

  it('an interrupt times out to its authored (historical) default', () => {
    const full = autoplay(scenario, 'historical', { seed: 1 })
    const log = full.decisions.filter((d) => d.turnIndex < 4)
    const { state } = replay(scenario, { seed: 1, decisions: log, turnIndex: 4 })
    const fed = state.decisions.find((d) => d.decisionId === 't4-i1-frbny')
    expect(fed, '연준 소집 인터럽트가 확정되지 않았습니다').toBeDefined()
    expect(fed!.interrupt).toBe(true)
    expect(fed!.timedOut).toBe(true)
    expect(fed!.optionIds).toEqual(['t4-i1-attend'])
    // 무응답이 역사로 수렴한다: 모든 인터럽트의 기본 선택이 역사 옵션이다.
    for (const turn of scenario.turns) {
      for (const it of turn.interrupts ?? []) {
        const def = it.options.find((o) => o.id === it.defaultOptionId)!
        expect(def.historical, `${it.id}의 기본 선택이 역사 옵션이 아닙니다`).toBe(true)
        expect(it.scoreWeight).toBe(0.5)
        expect(it.timeoutSec).toBeGreaterThan(0)
        for (const o of it.options) expect(o.preview, `${it.id}.${o.id} preview`).toBeDefined()
      }
    }
  })

  it('9/21의 일중 슬라이스 합계는 variance 0에서 단일 호출과 정확히 일치한다', () => {
    const ticked = autoplay(scenario, 'historical', { seed: 1 }).state
    const flat = autoplay(untickedT3(), 'historical', { seed: 1 }).state
    const drift: string[] = []
    for (const k of [
      'netExposureB',
      'closeoutLossB',
      'replacementCostB',
      'ownConvergencePnlB',
      'marginCoverage',
      'grossExposure',
      'liquidationVaR',
      'realizedLoss',
      'firmCapital',
      'peerCooperation',
    ]) {
      const a = metricAt(ticked, 3, k)
      const b = metricAt(flat, 3, k)
      if (!(Math.abs(a - b) < 1e-9)) drift.push(`${k}: 틱 ${a} vs 단일 ${b}`)
    }
    expect(drift, `\n${drift.join('\n')}`).toEqual([])
    // 체크포인트가 걸린 T5 종료 시점까지도 같아야 한다.
    for (const k of ['realizedLoss', 'netExposureB']) {
      expect(Math.abs(metricAt(ticked, 5, k) - metricAt(flat, 5, k))).toBeLessThan(1e-9)
    }
    expect(ticked.counters.consortiumPledgeM).toBe(flat.counters.consortiumPledgeM)
  })

  it('두 다단계 대화는 걸어간 응답 경로 그대로 재현된다', () => {
    const full = autoplay(scenario, 'historical', { seed: 1 })
    const margin = full.decisions.find((d) => d.decisionId === 't3-d1')
    expect(margin, 't3-d1이 확정되지 않았습니다').toBeDefined()
    expect(margin!.path).toEqual(['t3-r-explain', 'marginCallM-400', 't3-r-terms-daily'])
    expect(margin!.optionIds).toEqual(['t3-strict'])

    const pledge = full.decisions.find((d) => d.decisionId === 't5-d1')
    expect(pledge, 't5-d1이 확정되지 않았습니다').toBeDefined()
    expect(pledge!.path).toEqual(['t5-r-equal', 'consortiumPledgeM-250', 't5-r-sign-orderly'])
    expect(pledge!.optionIds).toEqual(['t5-join-orderly'])

    const again = replay(scenario, { seed: 1, decisions: full.decisions })
    expect(again.state.counters.marginCallM).toBe(400)
    expect(again.state.counters.consortiumPledgeM).toBe(250)
    expect(latestSnapshot(again.state).metrics).toEqual(latestSnapshot(full.state).metrics)

    // 시나리오가 허용하지 않는 경로는 조용히 통과하지 않는다.
    const broken = full.decisions.map((d) =>
      d.decisionId === 't5-d1' ? { ...d, path: ['t5-r-sign-orderly'] } : d,
    )
    expect(() => replay(scenario, { seed: 1, decisions: broken })).toThrow()
  })

  it('명목과 순익스포저는 시나리오 내내 자릿수가 다르다', () => {
    const s = play(HIST)
    const gross = metricAt(s, 0, 'grossExposure')
    const net = metricAt(s, 0, 'netExposureB')
    const notional = s.institution.custom.ltcmNotionalB!
    console.log('[scale] 명목(LTCM 전체)', notional, '우리 총명목', gross, '순익스포저', net)
    expect(notional).toBe(1400)
    expect(gross).toBeGreaterThan(90)
    expect(net).toBeLessThan(gross / 100)
    // 청산 손실은 순익스포저보다 크고 총명목보다 두 자릿수 작다.
    const closeout = metricAt(s, 4, 'closeoutLossB')
    expect(closeout).toBeGreaterThan(0.1)
    expect(closeout).toBeLessThan(gross / 50)
  })

  it('틱이 있는 턴의 모든 결정에 결정 창이 저작되어 있다', () => {
    const problems: string[] = []
    for (const turn of scenario.turns) {
      const ticks = turn.ticks ?? 1
      if (ticks <= 1) continue
      expect(turn.tickLabels?.length, `${turn.id} tickLabels`).toBe(ticks)
      for (const d of turn.decisions) {
        if (d.availableFrom === undefined) problems.push(`${turn.id}.${d.id}: availableFrom 없음`)
        if (d.deadlineTick === undefined) problems.push(`${turn.id}.${d.id}: deadlineTick 없음`)
        if (d.deadlineTick !== undefined && d.deadlineTick >= ticks - 1)
          problems.push(`${turn.id}.${d.id}: deadlineTick이 마지막 틱 — 자동 확정이 일어나지 않음`)
        if (!d.defaultOptionId) problems.push(`${turn.id}.${d.id}: defaultOptionId 없음`)
      }
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
    // 틱이 걸린 턴은 정확히 세 개(9/21 · 9/22 · 9/23)다.
    expect(scenario.turns.filter((t) => (t.ticks ?? 1) > 1).map((t) => t.id)).toEqual([
      't3',
      't4',
      't5',
    ])
  })

  it('라이브 플레이(variance 1): 엔진 시드 10개에서 결말과 체크포인트가 유지된다', () => {
    const canonical = autoplay(scenario, 'historical', { seed: 1, variance: 0 })
    const problems: string[] = []
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const r = autoplay(scenario, 'historical', { seed, rngSeed: 7, variance: 1 })
      if (r.state.ended?.reason !== canonical.state.ended?.reason)
        problems.push(`seed ${seed}: 종료 사유 ${r.state.ended?.reason}`)
      for (const cp of scenario.checkpoints ?? []) {
        const { ok, value } = checkpointOk(r.state, cp)
        if (!ok) problems.push(`seed ${seed}: ${cp.label} → ${value}`)
      }
      if (JSON.stringify(r.state).includes('NaN')) problems.push(`seed ${seed}: NaN`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('합산을 알기 전과 후의 청산 손실 추정치가 다르다', () => {
    const before = play({ ...HIST, 't4-i1-frbny': ['t4-i1-quiet'], 't3-d1': ['t3-strict'] })
    const after = play(HIST)
    const bEst = metricAt(before, 4, 'closeoutLossB')
    const aEst = metricAt(after, 4, 'closeoutLossB')
    console.log('[aggregate] 모른 채', bEst.toFixed(3), '→ 알고 난 뒤', aEst.toFixed(3))
    expect(before.flags.aggregate_known).toBeFalsy()
    expect(after.flags.aggregate_known).toBe(true)
    expect(aEst).toBeGreaterThan(bEst)
  })
})
