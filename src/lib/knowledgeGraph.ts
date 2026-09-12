import { CARDS, FRAMEWORKS, GLOSSARY, getCard } from '../content'
import type { FrameworkDoc, GlossaryEntry, KnowledgeCard } from '../content/types'
import { scenariosUsingCards } from './catalog'
import { getScenarioSummary } from '../scenarios'
import type { ScenarioSummary } from '../engine/types'

/**
 * Outbound edges from a knowledge card.
 *
 * Concept cards are the most linked-*to* thing in the app — frameworks list them, KPI help points
 * at them, glossary entries reference them, scenarios are tagged with them — and they were the
 * one place with nothing pointing *out*. Reading a card ended the session.
 *
 * Every edge below already existed in the content; none of it is new authoring. They were just
 * only traversable in one direction.
 */
export interface CardLinks {
  frameworks: FrameworkDoc[]
  terms: GlossaryEntry[]
  scenarios: ScenarioSummary[]
  similar: KnowledgeCard[]
}

/** `[…](term:lcr)` links written in the card body. */
function termIdsInBody(body: string): string[] {
  return [...body.matchAll(/\(term:([a-zA-Z0-9-_]+)\)/g)].map((m) => m[1]!)
}

export function cardLinks(card: KnowledgeCard): CardLinks {
  const frameworks = FRAMEWORKS.filter((f) => f.relatedCards.includes(card.id))

  // Terms the card links to, plus terms whose `cardRef` points back at it. Both directions,
  // deduplicated, in glossary order so the list is stable between renders.
  const wanted = new Set(termIdsInBody(card.body))
  const terms = GLOSSARY.filter((g) => wanted.has(g.id) || g.cardRef === card.id)

  const scenarios = scenariosUsingCards([card.id])
    .map((id) => getScenarioSummary(id))
    .filter((s): s is ScenarioSummary => Boolean(s))

  // "Similar" is shared tags, most-shared first. A card with no tags has no neighbours, which is
  // the right answer rather than a random three.
  const tags = new Set(card.tags)
  const similar =
    tags.size === 0
      ? []
      : CARDS.filter((c) => c.id !== card.id)
          .map((c) => ({ card: c, shared: c.tags.filter((t) => tags.has(t)).length }))
          .filter((x) => x.shared > 0)
          .sort((a, b) => b.shared - a.shared || a.card.title.localeCompare(b.card.title, 'ko'))
          .slice(0, 4)
          .map((x) => x.card)

  return { frameworks, terms, scenarios, similar }
}

/** Cards a framework lists, resolved and with the dangling ids dropped. */
export function cardsOfFramework(framework: FrameworkDoc): KnowledgeCard[] {
  return framework.relatedCards
    .map((id) => getCard(id))
    .filter((c): c is KnowledgeCard => Boolean(c))
}
