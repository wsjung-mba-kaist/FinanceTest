import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  applyDecision,
  autoplay,
  computeScore,
  createGame,
  fastForwardTicks,
  validateScenario,
} from '../../engine'
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
    // 체크포인트 게이트: 3/9 유출 $42B ±15% · 3/9 마감 연준 잔고 −$958M
    console.log(
      '[historical] CHECKPOINT T4 cumulativeOutflow =',
      t4.metrics.cumulativeOutflow!.value.toFixed(3),
      '(expected 42 ±15%) · T5 cash =',
      t5.metrics.cash!.value.toFixed(3),
      '(expected -0.958)',
    )
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

  it('t3-c (HTM 매각) taints the book without inflating the unrealized loss', () => {
    // T0~T2는 역사 선택으로 진행하고 T3에서 함정 옵션 t3-c를 고른다.
    let s = createGame(scenario, 1, { variance: 0 })
    for (let t = 0; t < 3; t++) {
      s = fastForwardTicks(s, scenario)
      for (const d of scenario.turns[t]!.decisions) {
        if (s.decisions.some((r) => r.decisionId === d.id)) continue
        const hist = d.options.find((o) => o.historical) ?? d.options[0]!
        s = applyDecision(s, scenario, d.id, [hist.id])
      }
      s = advanceTurn(s, scenario)
    }
    const d3 = scenario.turns[3]!.decisions.find((d) => d.options.some((o) => o.id === 't3-c'))!
    const before = s.institution
    const totalBefore =
      before.securities.afs.bookValue -
      before.securities.afs.marketValue +
      (before.securities.htm.bookValue - before.securities.htm.marketValue)
    s = applyDecision(s, scenario, d3.id, ['t3-c'])
    const b = s.institution
    const m = s.metricsHistory.at(-1)!.metrics
    // 재분류 뒤 HTM은 비어 있고, 미실현손실 KPI는 병합된 AFS의 시가 차이와 같다.
    expect(b.securities.htm.bookValue).toBe(0)
    expect(b.securities.htm.marketValue).toBe(0)
    expect(m.unrealizedLoss!.value).toBeCloseTo(
      b.securities.afs.bookValue - b.securities.afs.marketValue,
      6,
    )
    // 매각분의 손실은 실현되어 빠졌으니 총 미실현손실은 매각 전보다 작아야 한다 — 잔여 HTM
    // 시가 전체(≈50)가 손실로 둔갑하던 산술에서는 세 배로 뛰었다.
    expect(m.unrealizedLoss!.value).toBeLessThan(totalBefore)
    expect(m.unrealizedLoss!.value).toBeGreaterThan(0)
    expect(s.counters.htmTaintLoss).toBeGreaterThan(0)
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
