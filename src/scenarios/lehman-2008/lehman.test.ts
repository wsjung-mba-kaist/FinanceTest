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
  type GameState,
  type Turn,
} from '../../engine'
import type { BankState, ScenarioDefinition } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import { op } from '../../engine/fx/common'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import scenario from './scenario'

type S = GameState<BankState>

function series(state: S, key: string): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(1)}`)
    .join(' ')
}

/**
 * Plays with explicit choices per decision; unspecified decisions fall back to the best available
 * rating. Sub-turn ticks are walked exactly as the store and `autoplay` walk them, so a decision
 * that opens mid-turn (`availableFrom`) is answered at the tick it actually arrives. Interrupts are
 * left to the deadline sweep, which commits each one's authored (historical) default.
 */
function play(choices: Record<string, string[]>): S {
  let s = createGame(scenario, 1)
  let steps = 0
  while (s.phase !== 'ended' && steps++ < 400) {
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
    const available = dv.options.filter((o) => o.available).map((o) => o.option)
    const wanted = (choices[dv.decision.id] ?? []).filter((id) =>
      available.some((o) => o.id === id),
    )
    const pick =
      wanted.length > 0
        ? wanted
        : [[...available].sort((a, b) => b.expert.rating - a.expert.rating)[0]!.id]
    s = applyDecision(s, scenario, dv.decision.id, pick)
  }
  return s
}

const EXPERT = scenario.paths.expert!.choices as Record<string, string[]>
const HIST = scenario.paths.historical.choices as Record<string, string[]>

/** Player-visible text of a turn (excludes debrief-only fields: expert rationale, notes, trap explanations). */
function visibleText(turn: Turn<BankState>): string {
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
 * The same scenario with T2 collapsed back to a single tick: the five intraday run-off slices become
 * one `runoffStep` and the ticker's net moves are applied as plain ops. Used to assert that the
 * sub-turn conversion is **exactly** additive at `variance: 0` (calibration.md §7.1).
 */
function untickedT2(): ScenarioDefinition<BankState> {
  const turns = scenario.turns.map((t) => {
    if (t.id !== 't2') return t
    const flat: Turn<BankState> = {
      ...t,
      ticks: undefined,
      tickLabels: undefined,
      ticker: undefined,
      interrupts: undefined,
      entryEffects: [
        ...(t.entryEffects ?? []),
        {
          id: 't2-ticker-single',
          description: '비교용: 티커의 하루치 순이동을 한 번에 적용',
          effects: [
            op('market.ownStock', 'mul', 0.725),
            op('market.custom.tedBp', 'add', 4),
            op('market.ownCdsBp', 'add', 225),
          ],
        },
      ],
      eachTick: [
        {
          id: 't2-runoff-single',
          description: '비교용: 9/11 유출을 한 번에',
          effects: [bankFx.runoffStep({ windowFraction: 1, label: '9/11 유출(단일)' })],
        },
      ],
      tickEffects: (t.tickEffects ?? []).map((e) => ({ ...e, atTick: 0 })),
      decisions: t.decisions.map((d) => ({ ...d, availableFrom: 0, deadlineTick: undefined })),
    }
    return flat
  })
  return { ...scenario, turns }
}

function metricAt(state: S, turnIndex: number, key: string): number {
  return state.metricsHistory.find((m) => m.turnIndex === turnIndex)?.metrics[key]?.value ?? NaN
}

describe('lehman-2008 scenario', () => {
  it('passes integrity lint (errors)', () => {
    const issues = validateScenario(scenario)
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    const warnings = issues.filter((i) => i.level === 'warning')
    if (warnings.length) console.log('[warnings]\n' + formatIssues(warnings))
  })

  it('has no hindsight tokens before their public release', () => {
    const turns = scenario.turns
    // AIG $85B (9/16 evening), Reserve Primary (9/16), AMLF·MMF guarantee (9/19), TARP (10/3), TLGP (10/14), CPFF (10/7)
    for (let i = 0; i <= 5; i++) {
      expect(visibleText(turns[i]!), `turn ${turns[i]!.id}`).not.toMatch(
        /AIG|Reserve Primary|AMLF|TARP|TLGP|CPFF|브레이크 더 벅/,
      )
    }
    // T6 (9/15) may not mention the 9/16+ events either
    expect(visibleText(turns[6]!)).not.toMatch(/AIG|Reserve Primary|AMLF|TARP|TLGP|CPFF/)
    // The PDCF collateral expansion is announced Sunday 9/14 evening (T5): no announcement text before T5.
    for (let i = 0; i <= 4; i++) {
      expect(visibleText(turns[i]!), `turn ${turns[i]!.id}`).not.toMatch(
        /담보 확대 발표|적격 담보 전체로 확대|담보를 확대 발표/,
      )
    }
    expect(visibleText(turns[5]!)).toMatch(/적격 담보 전체로/)
  })

  it('historical path reproduces the Friday pool collapse and the 9/15 Chapter 11', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] cash     ', series(s, 'cash'))
    console.log('[historical] cumOut   ', series(s, 'cumulativeOutflow'))
    console.log('[historical] CI       ', series(s, 'confidence'))
    console.log('[historical] runState ', series(s, 'runState'))
    console.log('[historical] repoRoll ', series(s, 'repoRollRate'))
    console.log(
      '[historical] ended    ',
      s.ended?.reason,
      s.ended?.title,
      'at T',
      s.ended?.turnIndex,
    )
    expect(r.deviations).toEqual([])
    const t3 = s.metricsHistory.find((m) => m.turnIndex === 3)!
    expect(t3.metrics.cumulativeOutflow!.value).toBeGreaterThanOrEqual(35)
    expect(Math.abs(t3.metrics.cumulativeOutflow!.value - 38) / 38).toBeLessThan(0.3)
    expect(t3.metrics.cash!.value).toBeGreaterThanOrEqual(0)
    expect(t3.metrics.cash!.value).toBeLessThan(5)
    expect(s.ended?.reason).toBe('chapter11')
    expect(s.ended?.turnIndex).toBe(6)
    expect(s.ended?.failed).toBe(true)
    expect(s.ended?.orderly).toBeFalsy()
    const score = computeScore(s, scenario)
    console.log(
      '[historical] score',
      score.total,
      score.grade,
      Object.fromEntries(
        Object.entries(score.dimensions).map(([k, v]) => [k, Math.round(v.score)]),
      ),
    )
    expect(score.total).toBeLessThanOrEqual(40)
  })

  it('expert path ends in an orderly pre-packaged Chapter 11 and outscores the historical path', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] cash     ', series(s, 'cash'))
    console.log('[expert] cumOut   ', series(s, 'cumulativeOutflow'))
    console.log('[expert] CI       ', series(s, 'confidence'))
    console.log('[expert] headroom ', series(s, 'facilityHeadroom'))
    console.log('[expert] TCE      ', series(s, 'economicTce'))
    console.log('[expert] leverage ', series(s, 'leverageRatio'))
    console.log('[expert] ended    ', s.ended?.reason, s.ended?.title, 'at T', s.ended?.turnIndex)
    expect(r.deviations).toEqual([])
    expect(s.ended?.reason).toBe('chapter11')
    expect(s.ended?.orderly).toBe(true)
    expect(s.ended?.turnIndex).toBe(6)
    // the pool never went negative on the expert path
    for (const m of s.metricsHistory) expect(m.metrics.cash!.value).toBeGreaterThan(0)
    const score = computeScore(s, scenario)
    console.log(
      '[expert] score',
      score.total,
      score.grade,
      Object.fromEntries(
        Object.entries(score.dimensions).map(([k, v]) => [k, Math.round(v.score)]),
      ),
    )
    const hist = computeScore(autoplay(scenario, 'historical', { seed: 1 }).state, scenario)
    expect(score.total).toBeGreaterThan(hist.total)
  })

  it('independent-survival branch is reachable only with T0 preparation + T4 spin-off (counterfactual)', () => {
    const s = play({
      ...EXPERT,
      't5-d1': ['t5-e'],
      't6-d1': ['t6-d1-a', 't6-d1-b'],
      't6-d2': ['t6-d2-a'],
      't7-d1': ['t7-d1-a'],
    })
    console.log('[survivor] cash     ', series(s, 'cash'))
    console.log('[survivor] CI       ', series(s, 'confidence'))
    console.log('[survivor] ended    ', s.ended?.reason, s.ended?.title)
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.title).toMatch(/생존/)
    console.log('[survivor] score', computeScore(s, scenario).total)

    // without T0 preparation the option is unavailable → falls back to the best available (pre-pack)
    const noPrep = play({
      ...EXPERT,
      't0-d1': ['t0-c', 't0-d'],
      't2-d1': ['t2-a'],
      't3-d2': ['t3-d2-e'],
      't5-d1': ['t5-e'],
    })
    expect(noPrep.ended?.reason).toBe('chapter11')
  })

  it('sale-with-government-support branch is reachable and marked as counterfactual partial credit', () => {
    const s = play({ ...EXPERT, 't4-d1': ['t4-a'], 't5-d1': ['t5-d'] })
    expect(s.ended?.reason).toBe('completed')
    expect(s.ended?.title).toMatch(/정부 지원부 매각/)
    const score = computeScore(s, scenario)
    console.log('[sold] score', score.total)
  })

  it('every game-over rule is reachable', () => {
    // clearing-bank refusal (T2 trap)
    const refuse = play({ ...HIST, 't2-d1': ['t2-b'] })
    expect(refuse.ended?.reason).toBe('closure_liquidity')
    expect(refuse.ended?.turnIndex).toBe(2)
    // unsafe act: PB transfer slow-walk → R4 next morning
    const unsafe = play({ ...HIST, 't1-d2': ['t1-d2-b'] })
    expect(unsafe.ended?.reason).toBe('unsafe_act')
    expect(unsafe.ended?.turnIndex).toBe(2)
    // capital: Friday fire sale of the real-estate book
    const fire = play({ ...HIST, 't3-d2': ['t3-d2-c'] })
    expect(fire.ended?.reason).toBe('capital')
    expect(fire.ended?.turnIndex).toBe(3)
    // liquidity: historical path but silence + haircut spiral + unsafe-free → pool negative with no PDCF capacity
    const dry = play({
      ...HIST,
      't0-d1': ['t0-a', 't0-f'],
      't1-d1': ['t1-d'],
      't1-d2': ['t1-d2-c'],
      't2-d1': ['t2-d'],
      't2-d2': ['t2-d2-a', 't2-d2-d'],
      't3-d1': ['t3-d'],
    })
    console.log('[dry] cash', series(dry, 'cash'), dry.ended?.reason, 'T', dry.ended?.turnIndex)
    expect(dry.ended?.reason).toBe('closure_liquidity')
    expect(dry.ended!.turnIndex).toBeLessThanOrEqual(3)
    // unprepared delay (T5 trap) → Monday unwind refusal
    const delay = play({ ...HIST, 't5-d1': ['t5-f'] })
    expect(delay.ended?.reason).toBe('closure_liquidity')
    expect(delay.ended?.turnIndex).toBe(6)
  })

  it('9/11의 일중 유출 슬라이스 합계는 variance 0에서 단일 호출과 정확히 일치한다', () => {
    const ticked = autoplay(scenario, 'historical', { seed: 1 }).state
    const flat = autoplay(untickedT2(), 'historical', { seed: 1 }).state
    const drift: string[] = []
    for (const k of [
      'cash',
      'cumulativeOutflow',
      'dailyOutflow',
      'deposits',
      'repoRollRate',
      'confidence',
      'ownStock',
      'leverageRatio',
      'economicTce',
    ]) {
      const a = metricAt(ticked, 2, k)
      const b = metricAt(flat, 2, k)
      if (!(Math.abs(a - b) < 1e-9)) drift.push(`${k}: 틱 ${a} vs 단일 ${b}`)
    }
    expect(drift, `\n${drift.join('\n')}`).toEqual([])
    // 체크포인트가 걸린 T3 종료 시점까지도 같아야 한다
    for (const k of ['cash', 'cumulativeOutflow']) {
      expect(Math.abs(metricAt(ticked, 3, k) - metricAt(flat, 3, k))).toBeLessThan(1e-9)
    }
  })

  it('9/11 인터럽트는 무응답 시 역사적 기본 선택으로 자동 확정된다', () => {
    const full = autoplay(scenario, 'historical', { seed: 1 })
    const log = full.decisions.filter((d) => d.turnIndex < 2)
    const { state } = replay(scenario, { seed: 1, decisions: log, turnIndex: 2 })
    const pb = state.decisions.find((d) => d.decisionId === 't2-i1-pb')
    expect(pb, 'PB 인터럽트가 확정되지 않았습니다').toBeDefined()
    expect(pb!.interrupt).toBe(true)
    expect(pb!.timedOut).toBe(true)
    expect(pb!.optionIds).toEqual(['t2-i1-asis'])
    const desk = state.decisions.find((d) => d.decisionId === 't2-i2-clearing')
    expect(desk?.timedOut).toBe(true)
    expect(desk?.optionIds).toEqual(['t2-i2-confirm'])
    // 무응답이 역사로 수렴한다: 모든 인터럽트의 기본 선택이 역사 옵션이다
    for (const turn of scenario.turns) {
      for (const it of turn.interrupts ?? []) {
        const def = it.options.find((o) => o.id === it.defaultOptionId)!
        expect(def.historical, `${it.id}의 기본 선택이 역사 옵션이 아닙니다`).toBe(true)
      }
    }
  })

  it('주말 협상 대화는 걸어간 응답 경로 그대로 재현된다', () => {
    const full = autoplay(scenario, 'historical', { seed: 1 })
    const rec = full.decisions.find((d) => d.decisionId === 't4-d1')
    expect(rec, 't4-d1이 확정되지 않았습니다').toBeDefined()
    expect(rec!.path).toEqual(['t4-neg-r-package', 't4-neg-pledge-30', 't4-neg-r-fsa-joint'])
    expect(rec!.optionIds).toEqual(['t4-a'])
    const again = replay(scenario, { seed: 1, decisions: full.decisions })
    expect(again.state.counters.consortiumPledgeB).toBe(30)
    expect(latestSnapshot(again.state).metrics).toEqual(latestSnapshot(full.state).metrics)
    // 시나리오가 허용하지 않는 경로는 조용히 통과하지 않는다
    const broken = full.decisions.map((d) =>
      d.decisionId === 't4-d1' ? { ...d, path: ['t4-neg-r-fsa-joint'] } : d,
    )
    expect(() => replay(scenario, { seed: 1, decisions: broken })).toThrow()
  })

  it('출자 약속액이 분리 대상 북에 못 미치면 일요일에 인수 협상이 후퇴한다', () => {
    const walkTo5 = (path: string[]) => {
      const full = autoplay(scenario, 'historical', { seed: 1 })
      const log = full.decisions
        .filter((d) => d.turnIndex <= 5)
        .map((d) => (d.decisionId === 't4-d1' ? { ...d, optionIds: ['t4-a'], path } : d))
      return replay(scenario, { seed: 1, decisions: log, turnIndex: 5 }).state
    }
    const full30 = walkTo5(['t4-neg-r-package', 't4-neg-pledge-30', 't4-neg-r-fsa-joint'])
    const short10 = walkTo5(['t4-neg-r-package', 't4-neg-pledge-10', 't4-neg-r-fsa-joint'])
    expect(full30.counters.consortiumPledgeB).toBe(30)
    expect(short10.counters.consortiumPledgeB).toBe(10)
    expect(metricAt(short10, 5, 'confidence')).toBeLessThan(metricAt(full30, 5, 'confidence'))
  })

  it('라이브 플레이(variance 1): 엔진 시드 10개에서 9/12 체크포인트 두 개가 모두 허용폭 안에 있다', () => {
    // `tests/engine/variance.test.ts`는 `rngSeed`(정책 난수)만 바꾸므로 엔진 노이즈 스트림은 한 가지다.
    // 여기서는 `seed`(엔진 난수 시드)를 바꿔 슬라이스 노이즈의 실제 분포를 확인한다.
    const canonical = autoplay(scenario, 'historical', { seed: 1, variance: 0 })
    const problems: string[] = []
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const r = autoplay(scenario, 'historical', { seed, rngSeed: 7, variance: 1 })
      if (r.state.ended?.reason !== canonical.state.ended?.reason)
        problems.push(`seed ${seed}: 종료 사유 ${r.state.ended?.reason}`)
      for (const cp of scenario.checkpoints ?? []) {
        const v = metricAt(r.state, 3, cp.metric!)
        const err = Math.abs(v - cp.expected) / cp.expected
        if (err > cp.tolerance)
          problems.push(
            `seed ${seed}: ${cp.metric} ${v.toFixed(3)} (기대 ${cp.expected} ±${cp.tolerance * 100}%)`,
          )
      }
      if (metricAt(r.state, 3, 'cash') < 0)
        problems.push(`seed ${seed}: 9/12 풀이 음수 — 노이즈가 결과를 뒤집었습니다`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('worst and random policies complete without NaN', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
        expect(json.includes('NaN')).toBe(false)
        expect(r.state.ended).toBeDefined()
        console.log(
          `[${policy}#${rngSeed}]`,
          r.state.ended?.reason,
          'T',
          r.state.ended?.turnIndex,
          'score',
          computeScore(r.state, scenario).total,
        )
      }
    }
  })
})
