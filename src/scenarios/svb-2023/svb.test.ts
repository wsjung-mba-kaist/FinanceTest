import { describe, expect, it } from 'vitest'
import { autoplay, computeScore, validateScenario } from '../../engine'
import { formatIssues } from '../../engine/validate/scenarioIntegrity'
import scenario from './scenario'

function series(state: ReturnType<typeof autoplay>['state'], key: string): string {
  return state.metricsHistory
    .map((m) => `T${m.turnIndex}:${(m.metrics[key]?.value ?? NaN).toFixed(1)}`)
    .join(' ')
}

describe('svb-2023 scenario', () => {
  it('passes integrity lint (errors)', () => {
    const issues = validateScenario(scenario)
    const errors = issues.filter((i) => i.level === 'error')
    if (errors.length) console.log(formatIssues(errors))
    expect(errors).toEqual([])
    const warnings = issues.filter((i) => i.level === 'warning')
    if (warnings.length) console.log('[warnings]\n' + formatIssues(warnings))
  })

  it('historical path reproduces 3/9 outflow, negative close and Friday closure', () => {
    const r = autoplay(scenario, 'historical', { seed: 1 })
    const s = r.state
    console.log('[historical] deviations', r.deviations)
    console.log('[historical] cash     ', series(s, 'cash'))
    console.log('[historical] cumOut   ', series(s, 'cumulativeOutflow'))
    console.log('[historical] CI       ', series(s, 'confidence'))
    console.log('[historical] runState ', series(s, 'runState'))
    console.log(
      '[historical] ended    ',
      s.ended?.reason,
      s.ended?.title,
      'at T',
      s.ended?.turnIndex,
    )
    const t4 = s.metricsHistory.find((m) => m.turnIndex === 4)!
    const t5 = s.metricsHistory.find((m) => m.turnIndex === 5)!
    expect(Math.abs(t4.metrics.cumulativeOutflow!.value - 42) / 42).toBeLessThan(0.15)
    expect(t5.metrics.cash!.value).toBeLessThan(0)
    expect(t5.metrics.cash!.value).toBeGreaterThan(-3)
    expect(s.ended?.reason).toBe('closure_liquidity')
    expect(s.ended?.turnIndex).toBe(6)
    const score = computeScore(s, scenario)
    console.log(
      '[historical] score',
      score.total,
      score.grade,
      Object.fromEntries(
        Object.entries(score.dimensions).map(([k, v]) => [k, Math.round(v.score)]),
      ),
    )
  })

  it('expert path survives to the end', () => {
    const r = autoplay(scenario, 'expert', { seed: 1 })
    const s = r.state
    console.log('[expert] deviations', r.deviations)
    console.log('[expert] cash     ', series(s, 'cash'))
    console.log('[expert] cumOut   ', series(s, 'cumulativeOutflow'))
    console.log('[expert] cumOut%  ', series(s, 'cumulativeOutflowPct'))
    console.log('[expert] CI       ', series(s, 'confidence'))
    console.log('[expert] headroom ', series(s, 'facilityHeadroom'))
    console.log('[expert] TCE      ', series(s, 'economicTce'))
    console.log('[expert] ended    ', s.ended?.reason, s.ended?.title)
    expect(r.deviations).toEqual([])
    expect(s.ended?.failed).toBe(false)
    expect(s.ended?.reason).toBe('completed')
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

  it('worst and random policies complete without NaN', () => {
    for (const policy of ['worst', 'random'] as const) {
      for (const rngSeed of [1, 2, 3]) {
        const r = autoplay(scenario, policy, { seed: 1, rngSeed })
        const json = JSON.stringify(r.state)
        expect(json.includes('null')).toBe(false)
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
