import { describe, expect, it } from 'vitest'
import { CARDS, FRAMEWORKS } from '../content'
import { cardLinks, cardsOfFramework } from './knowledgeGraph'

/**
 * Concept cards were the terminus of every path through the knowledge base: frameworks, KPI help,
 * the glossary and the catalogue all link into them, and nothing linked out. These assertions are
 * about the *graph* rather than the rendering — that the reverse edges the footer walks are real
 * and non-empty for the content actually shipped.
 */
describe('cardLinks', () => {
  it('runs for every shipped card without throwing', () => {
    expect(CARDS.length).toBeGreaterThan(0)
    for (const c of CARDS) expect(() => cardLinks(c)).not.toThrow()
  })

  it('never lists the card itself as similar to itself', () => {
    for (const c of CARDS) {
      const ids = cardLinks(c).similar.map((x) => x.id)
      expect(ids, c.id).not.toContain(c.id)
    }
  })

  it('finds the reverse edge from every framework that names a card', () => {
    // The edge that mattered most: a framework lists `relatedCards`, and before this the card had
    // no idea. If a framework names a card, that card must offer the way back.
    for (const f of FRAMEWORKS) {
      for (const card of cardsOfFramework(f)) {
        const back = cardLinks(card).frameworks.map((x) => x.id)
        expect(back, `${card.id} → ${f.id}`).toContain(f.id)
      }
    }
  })

  it('gives most cards somewhere to go', () => {
    // Not all of them — a brand-new card with no tags and no references legitimately has none.
    // But a knowledge base where the majority of cards are dead ends is the state this fixed.
    const withLinks = CARDS.filter((c) => {
      const l = cardLinks(c)
      return l.frameworks.length + l.terms.length + l.scenarios.length + l.similar.length > 0
    })
    expect(withLinks.length / CARDS.length).toBeGreaterThan(0.8)
  })

  it('orders similar cards by how many tags they share', () => {
    for (const c of CARDS) {
      const tags = new Set(c.tags)
      const shared = cardLinks(c).similar.map((x) => x.tags.filter((t) => tags.has(t)).length)
      expect(shared, c.id).toEqual([...shared].sort((a, b) => b - a))
      // A "similar" card with nothing in common is noise, not a suggestion.
      for (const n of shared) expect(n).toBeGreaterThan(0)
    }
  })
})
