import { describe, expect, it } from 'vitest'
import { loadAvailableScenariosSafe } from '../../tests/helpers/load'
import { keyDecisionsOf, watchpointsOf } from './briefingFocus'

const registry = await loadAvailableScenariosSafe()

describe.skipIf(registry.length === 0)('keyDecisionsOf', () => {
  for (const scenario of registry) {
    describe(scenario.meta.id, () => {
      const decisions = keyDecisionsOf(scenario)

      it('names something to decide', () => {
        // The section this replaced showed learning objectives — "…을 이해한다" — which answer a
        // different question entirely. Every scenario must be able to say what will be *decided*.
        expect(decisions.length).toBeGreaterThan(0)
        expect(decisions.length).toBeLessThanOrEqual(3)
      })

      it('picks decisions the experts actually disagree about', () => {
        for (const d of decisions) expect(d.spread, d.id).toBeGreaterThan(0)
      })

      it('names each decision once', () => {
        // A rollover that fails on two turns is one question asked twice; listing it twice reads
        // as a bug.
        const titles = decisions.map((d) => d.title)
        expect(new Set(titles).size).toBe(titles.length)
      })

      it('lists them in the order they will be met', () => {
        const turns = decisions.map((d) => d.turnIndex)
        expect(turns).toEqual([...turns].sort((a, b) => a - b))
      })

      it('points at decisions that exist in the scenario', () => {
        const ids = new Set(scenario.turns.flatMap((t) => (t.decisions ?? []).map((d) => d.id)))
        for (const d of decisions) expect(ids, d.id).toContain(d.id)
      })
    })
  }
})

describe.skipIf(registry.length === 0)('watchpointsOf', () => {
  for (const scenario of registry) {
    describe(scenario.meta.id, () => {
      const points = watchpointsOf(scenario)

      it('gives the player between one and four things to watch', () => {
        expect(points.length).toBeGreaterThan(0)
        expect(points.length).toBeLessThanOrEqual(4)
      })

      it('only names metrics this scenario actually publishes', () => {
        // The merged list is the one place the briefing prints a T0 figure; a metric the scenario
        // does not publish would render as a permanent '—'.
        const published = new Set(scenario.kpis.map((k) => k.metric))
        for (const w of points)
          for (const kpi of w.kpis) expect(published, `${w.id}/${kpi.metric}`).toContain(kpi.metric)
      })

      it('does not ask the same question twice', () => {
        const ids = points.map((w) => w.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('does not print the same metric under two watchpoints', () => {
        // This is what the merge exists to prevent: the role frame and the pre-flight checklist
        // each printed the same figure, so a KPI appeared up to four times on one screen.
        const metrics = points.flatMap((w) => w.kpis.map((k) => k.metric))
        expect(new Set(metrics).size, metrics.join(', ')).toBe(metrics.length)
      })
    })
  }
})
