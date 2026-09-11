import { describe, expect, it } from 'vitest'
import { autoplay, computeScore, decisionRegrets } from '../engine'
import { loadAvailableScenariosSafe } from '../../tests/helpers/load'
import { buildDebriefText } from './debriefText'

const registry = await loadAvailableScenariosSafe()
const svb = registry.find((s) => s.meta.id === 'svb-2023')

describe('buildDebriefText', () => {
  it.skipIf(Boolean(svb))('svb-2023 is not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  it.skipIf(!svb)('renders a reproducible plain-text report', () => {
    const scenario = svb!
    const player = autoplay(scenario, 'historical', { seed: 1 }).state
    const expert = autoplay(scenario, 'expert', { seed: 1 }).state
    const text = buildDebriefText({
      scenario,
      state: player,
      report: computeScore(player, scenario),
      mode: 'standard',
      historical: player,
      expert,
      regrets: decisionRegrets(player, scenario),
    })
    expect(text).toMatchSnapshot()
  })

  it.skipIf(!svb)('omits the timestamp line unless one is supplied', () => {
    const scenario = svb!
    const player = autoplay(scenario, 'historical', { seed: 1 }).state
    const base = {
      scenario,
      state: player,
      report: computeScore(player, scenario),
      mode: 'standard' as const,
    }
    expect(buildDebriefText(base)).not.toMatch(/^작성: /m)
    expect(buildDebriefText({ ...base, generatedAt: '2026-01-02' })).toMatch(/^작성: 2026-01-02$/m)
  })

  it.skipIf(!svb)('contains every section heading', () => {
    const scenario = svb!
    const player = autoplay(scenario, 'historical', { seed: 1 }).state
    const text = buildDebriefText({
      scenario,
      state: player,
      report: computeScore(player, scenario),
      mode: 'expert',
    })
    for (const heading of [
      '[차원별 점수]',
      '[핵심 지표 — 귀하 / 역사 / 전문가]',
      '[가장 잘한 결정]',
      '[가장 아쉬운 결정]',
      '[결정 기록]',
    ]) {
      expect(text).toContain(heading)
    }
    expect(text).toContain(scenario.meta.title)
    expect(text).toContain('전문가 모드')
  })
})
