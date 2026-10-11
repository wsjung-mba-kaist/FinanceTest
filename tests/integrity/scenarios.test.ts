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

/**
 * Warning ceilings — a ratchet, not a rule. Warnings used to go to stderr and nobody counted
 * them, so a new one was indistinguishable from the 132 already there (94 of which were one rule
 * reporting itself twice). Each scenario is held at today's count; lower a number when you clear a
 * warning, and a new warning fails the suite with the rule that raised it. Unlisted = 0.
 */
const WARNING_CEILING: Record<string, number> = {
  'svb-2023': 11,
  'lehman-2008': 5,
  'archegos-2021': 1,
  'legoland-2022': 1,
  'mg-run-2023': 1,
}

describe('scenario integrity', () => {
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
      const ceiling = WARNING_CEILING[id] ?? 0
      expect(
        warnings.length,
        `${id}: 경고 ${warnings.length}건 > 상한 ${ceiling}건\n${formatIssues(warnings)}`,
      ).toBeLessThanOrEqual(ceiling)
      expect(
        warnings.length,
        `${id}: 경고 ${warnings.length}건 < 상한 ${ceiling}건 — 상한을 ${warnings.length}으로 내려 적어 두세요`,
      ).toBe(ceiling)
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
