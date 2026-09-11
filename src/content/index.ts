import type { GameState, InstitutionType } from '../engine/types'
import { buildConditionContext, evaluate } from '../engine/core/conditions'
import { GLOSSARY } from './glossary'
import { loadCards, loadFrameworks } from './loader'
import { READING_LIST } from './readingList'
import { SOURCES } from './sources'
import { CARD_TRIGGERS } from './triggers'
import type { FrameworkDoc, GlossaryEntry, KnowledgeCard, Source } from './types'

export const CARDS: KnowledgeCard[] = loadCards()
export const FRAMEWORKS: FrameworkDoc[] = loadFrameworks()
export { GLOSSARY, SOURCES, READING_LIST, CARD_TRIGGERS }

const cardMap = new Map(CARDS.map((c) => [c.id, c]))
const termMap = new Map(GLOSSARY.map((g) => [g.id, g]))
const sourceMap = new Map(SOURCES.map((s) => [s.id, s]))
const frameworkMap = new Map(FRAMEWORKS.map((f) => [f.id, f]))

export const getCard = (id: string): KnowledgeCard | undefined => cardMap.get(id)
export const getTerm = (id: string): GlossaryEntry | undefined => termMap.get(id)
export const getSource = (id: string): Source | undefined => sourceMap.get(id)
export const getFramework = (id: string): FrameworkDoc | undefined => frameworkMap.get(id)
export const cardIds = (): Set<string> => new Set(cardMap.keys())
export const sourceIds = (): Set<string> => new Set(sourceMap.keys())

/** Cards suggested by generic triggers for the current state. */
export function triggeredCards(
  state: GameState,
  institutionType: InstitutionType,
): { card: KnowledgeCard; reason: string }[] {
  const ctx = buildConditionContext(state)
  const out: { card: KnowledgeCard; reason: string }[] = []
  for (const t of CARD_TRIGGERS) {
    if (t.institutionTypes && !t.institutionTypes.includes(institutionType)) continue
    if (!evaluate(t.when, ctx)) continue
    const card = cardMap.get(t.cardId)
    if (card) out.push({ card, reason: t.reason })
  }
  return out
}

/** Finds a glossary entry by id, alias, ko or en term (case-insensitive). */
export function findTerm(query: string): GlossaryEntry | undefined {
  const q = query.trim().toLowerCase()
  return GLOSSARY.find(
    (g) =>
      g.id === q ||
      g.term.ko.toLowerCase() === q ||
      g.term.en.toLowerCase() === q ||
      (g.aliases ?? []).some((a) => a.toLowerCase() === q),
  )
}
