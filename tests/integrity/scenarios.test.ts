import { describe, expect, it } from 'vitest'
import { allDecisions, type InstitutionState, type ScenarioDefinition } from '@/engine'
import { formatIssues, validateScenario } from '@/engine/validate/scenarioIntegrity'
import { miniBank } from '../fixtures/miniBank'
import { loadAvailableScenariosSafe, loadContentSafe } from '../helpers/load'
import { asGeneric } from '../helpers/scenario'

// Registry scenarios and the knowledge content are authored concurrently: when either module
// cannot be loaded yet we skip the dependent cases (with a console.warn) instead of failing.
const registry = await loadAvailableScenariosSafe()
const content = await loadContentSafe()

const cases: [id: string, def: ScenarioDefinition<InstitutionState>][] = [
  ['mini-bank (fixture)', asGeneric(miniBank)],
  ...registry.map((d): [string, ScenarioDefinition<InstitutionState>] => [d.meta.id, d]),
]

describe('scenario integrity', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  it.skipIf(registry.length === 0)('every registered scenario loaded with a unique id', () => {
    const ids = registry.map((d) => d.meta.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('svb-2023')
  })

  describe.each(cases)('%s', (id, def) => {
    it('has zero error-level integrity issues', () => {
      const issues = validateScenario(def, {
        cardIds: content?.cardIds(),
        sourceIds: content?.sourceIds(),
      })
      const errors = issues.filter((i) => i.level === 'error')
      const warnings = issues.filter((i) => i.level === 'warning')
      if (warnings.length > 0)
        console.warn(`[integrity] ${id}: ${warnings.length} warning(s)\n${formatIssues(warnings)}`)
      if (!content)
        console.warn(
          `[integrity] ${id}: card/source ids were not checked against the content module`,
        )
      expect(errors, `\n${formatIssues(errors)}`).toEqual([])
    })

    it('declares consistent meta and covers every decision in the historical path', () => {
      expect(def.meta.durationTurns).toBe(def.turns.length)
      expect(def.meta.sources.some((s) => s.kind === 'primary' || s.kind === 'regulatory')).toBe(
        true,
      )
      // Decisions in turns the historical path never reaches (e.g. the institution was closed) need no historical choice.
      const histMaxTurn = allDecisions(def)
        .filter(({ decision }) => def.paths.historical.choices[decision.id] !== undefined)
        .reduce((m, { turnIndex }) => Math.max(m, turnIndex), -1)
      for (const { decision, turnIndex } of allDecisions(def)) {
        if (histMaxTurn >= 0 && turnIndex > histMaxTurn) continue
        const choice = def.paths.historical.choices[decision.id]
        const flagged = decision.options.filter((o) => o.historical).map((o) => o.id)
        expect(
          choice !== undefined || flagged.length > 0,
          `decision ${decision.id} has no historical choice`,
        ).toBe(true)
        if (choice !== undefined) {
          for (const o of [choice].flat())
            expect(
              decision.options.map((x) => x.id),
              `historical option ${o} of ${decision.id}`,
            ).toContain(o)
        }
      }
      for (const [decisionId, choice] of Object.entries(def.paths.expert?.choices ?? {})) {
        const found = allDecisions(def).find((d) => d.decision.id === decisionId)
        expect(found, `expert path decision ${decisionId}`).toBeDefined()
        for (const o of [choice].flat())
          expect(
            found!.decision.options.map((x) => x.id),
            `expert option ${o} of ${decisionId}`,
          ).toContain(o)
      }
    })
  })
})
