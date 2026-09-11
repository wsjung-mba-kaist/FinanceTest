import { describe, expect, it } from 'vitest'
import { loadAvailableScenariosSafe } from '../../tests/helpers/load'
import { SCENARIOS, getScenarioSummary } from '../scenarios'
import { scenariosUsingCards } from './catalog'
import {
  baselineSnapshot,
  deriveBriefingSummary,
  firstParagraph,
  trimToSentence,
} from './briefingSummary'

const registry = await loadAvailableScenariosSafe()

describe('trimToSentence', () => {
  it('keeps short text untouched', () => {
    expect(trimToSentence('짧은 문장입니다.', 220)).toBe('짧은 문장입니다.')
  })

  it('cuts on a sentence boundary, not mid-word', () => {
    const text = '첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.'
    expect(trimToSentence(text, 12)).toBe('첫 문장입니다.')
    expect(trimToSentence(text, 20)).toBe('첫 문장입니다. 두 번째 문장입니다.')
  })

  it('does not treat a decimal point as a sentence end', () => {
    const text = '연체율은 3.59%에서 6%대로 올랐습니다. 다음 문장입니다.'
    const out = trimToSentence(text, 30)
    expect(out).toBe('연체율은 3.59%에서 6%대로 올랐습니다.')
  })

  it('falls back to a hard cut when the first sentence already exceeds the budget', () => {
    const out = trimToSentence('가'.repeat(300), 50)
    expect(out).toHaveLength(50)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('firstParagraph', () => {
  it('stops at the first blank line', () => {
    expect(firstParagraph('첫 문단.\n\n둘째 문단.')).toBe('첫 문단.')
  })
})

describe('ScenarioSummary.cardRefs', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  // The summary carries a copy of `briefing.cardRefs` so the knowledge base can answer
  // "이 프레임워크가 쓰인 시나리오" without loading every scenario module; this guards the copy
  // against drifting from the real briefing content.
  for (const scenario of registry) {
    it(`matches ${scenario.meta.id}'s briefing.cardRefs`, () => {
      expect(getScenarioSummary(scenario.meta.id)?.cardRefs).toEqual(scenario.briefing.cardRefs)
    })
  }

  it('every registered, available scenario declares its cards', () => {
    const missing = SCENARIOS.filter(
      (e) => e.summary.status === 'available' && !e.summary.cardRefs?.length,
    ).map((e) => e.summary.id)
    expect(missing).toEqual([])
  })

  it('resolves a framework back to the scenarios that teach it', () => {
    const card = registry[0]?.briefing.cardRefs[0]
    expect(card).toBeDefined()
    expect(scenariosUsingCards([card!])).toContain(registry[0]!.meta.id)
    expect(scenariosUsingCards([])).toEqual([])
  })
})

describe('deriveBriefingSummary', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  for (const scenario of registry) {
    describe(scenario.meta.id, () => {
      const baseline = baselineSnapshot(scenario)
      const summary = deriveBriefingSummary(scenario, baseline)

      it('parses 권한 and 목표 out of briefing.mandate', () => {
        expect(summary.mandate.length).toBeGreaterThan(10)
        expect(summary.objective.length).toBeGreaterThan(10)
        // The markers themselves must not leak into the parsed halves.
        expect(summary.mandate).not.toMatch(/\*\*권한\*\*/)
        expect(summary.mandate).not.toMatch(/\*\*목표\*\*/)
        expect(summary.objective).not.toMatch(/\*\*목표\*\*/)
      })

      it('produces three key judgements ordered by competency weight', () => {
        expect(summary.keyJudgements).toHaveLength(3)
        const weights = summary.keyJudgements.map((j) => j.weight)
        expect([...weights].sort((a, b) => b - a)).toEqual(weights)
        for (const j of summary.keyJudgements) {
          expect(j.text.length).toBeGreaterThan(0)
          expect(j.competencyLabel.length).toBeGreaterThan(0)
          expect(j.decisionCount).toBeGreaterThan(0)
        }
      })

      it('trims the situation to one readable block', () => {
        expect(summary.situation.length).toBeGreaterThan(0)
        expect(summary.situation.length).toBeLessThanOrEqual(220)
      })

      it('shows at most four primary KPIs with a baseline value', () => {
        expect(summary.kpis.length).toBeGreaterThan(0)
        expect(summary.kpis.length).toBeLessThanOrEqual(4)
        for (const k of summary.kpis) {
          expect(scenario.kpis.some((spec) => spec.metric === k.kpi.metric)).toBe(true)
          expect(k.value).toBeTypeOf('number')
        }
      })

      it('previews at most three concept cards from the briefing', () => {
        expect(summary.concepts.length).toBeLessThanOrEqual(3)
        for (const id of summary.concepts) {
          expect(scenario.briefing.cardRefs).toContain(id)
        }
      })

      it('offers a preflight checklist whose metrics exist in this scenario', () => {
        expect(summary.preflight.length).toBeGreaterThan(0)
        const metrics = new Set(scenario.kpis.map((k) => k.metric))
        for (const item of summary.preflight) {
          expect(item.question.length).toBeGreaterThan(0)
          for (const m of item.metrics) expect(metrics.has(m)).toBe(true)
        }
      })
    })
  }
})
