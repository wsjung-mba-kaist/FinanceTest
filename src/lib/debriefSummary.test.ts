import { describe, expect, it } from 'vitest'
import { autoplay, decisionRegrets } from '../engine'
import { loadAvailableScenariosSafe } from '../../tests/helpers/load'
import {
  bestDecision,
  firstSentence,
  headline,
  kpiComparison,
  largestExpertGap,
  worstDecision,
  type KpiComparisonRow,
} from './debriefSummary'

const registry = await loadAvailableScenariosSafe()

describe('firstSentence', () => {
  it('takes the text up to the first terminator followed by whitespace', () => {
    expect(firstSentence('첫 문장입니다. 둘째 문장입니다.')).toBe('첫 문장입니다.')
  })
  it('ignores a period inside a number', () => {
    expect(firstSentence('유출은 1.5조원이었습니다. 다음.')).toBe('유출은 1.5조원이었습니다.')
  })
  it('returns the whole string when there is no terminator', () => {
    expect(firstSentence('종결 부호 없음')).toBe('종결 부호 없음')
  })
  it('handles undefined', () => {
    expect(firstSentence(undefined)).toBe('')
  })
})

describe('debrief summary derivations', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  for (const scenario of registry) {
    describe(scenario.meta.id, () => {
      const historicalRun = autoplay(scenario, 'historical', { seed: 1 })
      const expertRun = autoplay(scenario, 'expert', { seed: 1 })
      const player = historicalRun.state
      const regrets = decisionRegrets(player, scenario)

      it('ends the historical autoplay so a headline can be derived', () => {
        expect(player.phase).toBe('ended')
        const h = headline(player, scenario)
        expect(h.title.length).toBeGreaterThan(0)
        expect(['생존·완료', '질서 있는 정리', '폐쇄·실패']).toContain(h.outcomeLabel)
        expect(h.tone).toBe(h.failed ? (h.orderly ? 'warning' : 'critical') : 'positive')
      })

      it('compares at most three primary KPIs across the three paths', () => {
        const rows = kpiComparison(scenario, player, historicalRun.state, expertRun.state)
        expect(rows.length).toBeGreaterThan(0)
        expect(rows.length).toBeLessThanOrEqual(3)
        for (const r of rows) {
          expect(scenario.kpis.some((k) => k.metric === r.kpi.metric)).toBe(true)
        }
        // The player run IS the historical run here, so the two columns must agree.
        for (const r of rows) expect(r.player).toBe(r.historical)
      })

      it('finds the decision with the largest regret on the historical path', () => {
        const worst = worstDecision(scenario, player, regrets)
        expect(worst).toBeDefined()
        expect(worst!.regret).toBeGreaterThan(0)
        expect(worst!.chosen.length).toBeGreaterThan(0)
        expect(worst!.best).toBeDefined()
        expect(worst!.best!.rating).toBeGreaterThanOrEqual(worst!.chosenRating)
        expect(worst!.turnLabel.length).toBeGreaterThan(0)
        // The largest regret in the list, by construction.
        const max = Math.max(...regrets.map((r) => r.regret))
        expect(worst!.regret).toBeCloseTo(max, 6)
      })

      it('best decision, when present, has zero regret and no expert alternative to show', () => {
        const best = bestDecision(scenario, player, regrets)
        if (!best) {
          expect(regrets.every((r) => r.regret > 0)).toBe(true)
          return
        }
        expect(best.regret).toBeLessThanOrEqual(0)
        expect(best.best).toBeUndefined()
      })
    })
  }
})

describe('largestExpertGap', () => {
  const row = (metric: string, player?: number, expert?: number): KpiComparisonRow => ({
    kpi: { metric, label: metric, unit: '%' },
    player,
    historical: undefined,
    expert,
  })

  it('picks the biggest *relative* divergence, not the biggest absolute one', () => {
    // 2 vs 4 is a 50% divergence; 1000 vs 1100 is 9%. The small metric moved further.
    const got = largestExpertGap([row('ratio', 2, 4), row('krw', 1000, 1100)])
    expect(got?.row.kpi.metric).toBe('ratio')
  })

  it('says nothing when the paths effectively agree', () => {
    expect(largestExpertGap([row('lcr', 100, 100.5)])).toBeUndefined()
  })

  it('ignores metrics that have no value on one of the paths', () => {
    // The expert autoplay has not finished, so nothing can be compared yet.
    expect(largestExpertGap([row('lcr', 100, undefined)])).toBeUndefined()
    expect(largestExpertGap([row('lcr', undefined, 100)])).toBeUndefined()
  })

  it('survives a zero on the expert path without dividing by it', () => {
    const got = largestExpertGap([row('outflow', 12, 0)])
    expect(got?.row.kpi.metric).toBe('outflow')
    expect(Number.isFinite(got!.relative)).toBe(true)
  })
})
