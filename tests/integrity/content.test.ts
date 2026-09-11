import { describe, expect, it } from 'vitest'
import { loadContentSafe } from '../helpers/load'

// `src/content/glossary.ts` / `sources.ts` / `readingList.ts` are authored concurrently; until they
// exist the content module cannot be imported and these checks are skipped (with a console.warn).
const content = await loadContentSafe()

const TERM_LINK = /\]\(term:([^)\s]+)\)/g

describe('knowledge content integrity', () => {
  it.skipIf(content !== undefined)('content module is not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  describe.skipIf(content === undefined)('cards', () => {
    it('every card has a unique id, a non-empty body and sources that resolve', () => {
      const { CARDS, SOURCES } = content!
      const sourceIds = new Set(SOURCES.map((s) => s.id))
      const ids = CARDS.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
      const problems: string[] = []
      for (const card of CARDS) {
        if (!card.id) problems.push('card without id')
        if (!card.body || card.body.trim().length === 0) problems.push(`${card.id}: empty body`)
        if (!card.title) problems.push(`${card.id}: empty title`)
        for (const s of card.sources)
          if (!sourceIds.has(s)) problems.push(`${card.id}: unknown source ${s}`)
      }
      expect(problems, `\n${problems.join('\n')}`).toEqual([])
    })

    it('every [text](term:id) link in card bodies resolves in GLOSSARY', () => {
      const { CARDS, GLOSSARY } = content!
      const termIds = new Set(GLOSSARY.map((g) => g.id))
      const problems: string[] = []
      for (const card of CARDS) {
        for (const m of card.body.matchAll(TERM_LINK)) {
          const id = m[1]!
          if (!termIds.has(id)) problems.push(`${card.id}: unknown term link ${id}`)
        }
      }
      expect(problems, `\n${problems.join('\n')}`).toEqual([])
    })

    it('helpers resolve cards and expose id sets', () => {
      const { CARDS, cardIds, getCard } = content!
      expect(cardIds().size).toBe(CARDS.length)
      for (const c of CARDS) expect(getCard(c.id)).toBe(c)
      expect(getCard('__missing__')).toBeUndefined()
    })
  })

  describe.skipIf(content === undefined)('glossary', () => {
    it('ids are unique and cardRef / sourceRef resolve', () => {
      const { GLOSSARY, cardIds, sourceIds, getTerm } = content!
      const ids = GLOSSARY.map((g) => g.id)
      expect(new Set(ids).size).toBe(ids.length)
      const cards = cardIds()
      const sources = sourceIds()
      const problems: string[] = []
      for (const g of GLOSSARY) {
        if (!g.term.ko || !g.term.en) problems.push(`${g.id}: missing ko/en term`)
        if (!g.definition.ko) problems.push(`${g.id}: missing ko definition`)
        if (g.cardRef && !cards.has(g.cardRef))
          problems.push(`${g.id}: unknown cardRef ${g.cardRef}`)
        if (g.sourceRef && !sources.has(g.sourceRef))
          problems.push(`${g.id}: unknown sourceRef ${g.sourceRef}`)
        if (getTerm(g.id) !== g) problems.push(`${g.id}: getTerm does not resolve`)
      }
      expect(problems, `\n${problems.join('\n')}`).toEqual([])
    })

    it('findTerm matches by id, ko/en term and alias (case-insensitive)', () => {
      const { GLOSSARY, findTerm } = content!
      for (const g of GLOSSARY) {
        expect(findTerm(g.id)).toBe(g)
        expect(findTerm(g.term.en.toUpperCase())?.id).toBeDefined()
        for (const a of g.aliases ?? []) expect(findTerm(a)?.id).toBeDefined()
      }
    })
  })

  describe.skipIf(content === undefined)('sources and reading list', () => {
    it('source ids are unique and every source has title/publisher/kind', () => {
      const { SOURCES, getSource } = content!
      const ids = SOURCES.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const s of SOURCES) {
        expect(s.title, s.id).toBeTruthy()
        expect(s.publisher, s.id).toBeTruthy()
        expect(s.kind, s.id).toBeTruthy()
        expect(getSource(s.id)).toBe(s)
      }
    })

    it('reading list items carry a title and publisher', () => {
      const { READING_LIST } = content!
      for (const r of READING_LIST) {
        expect(r.title).toBeTruthy()
        expect(r.publisher).toBeTruthy()
      }
    })
  })
})
