import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  applyDecision,
  autoplay,
  computeScore,
  createGame,
  getTurnView,
  validateScenario,
  type GameState,
  type Turn,
} from '../../engine'
import type { BankState } from '../../engine/types'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import scenario from './scenario'

type S = GameState<BankState>

function series(state: S, key: string): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(1)}`)
    .join(' ')
}

/** Plays with explicit choices per decision; unspecified decisions fall back to the best available rating. */
function play(choices: Record<string, string[]>): S {
  let s = createGame(scenario, 1)
  let steps = 0
  while (s.phase !== 'ended' && steps++ < 200) {
    const view = getTurnView(s, scenario)
    const pending = view.decisions.filter((d) => !d.resolved && (d.decision.required ?? true))
    if (pending.length === 0) {
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
