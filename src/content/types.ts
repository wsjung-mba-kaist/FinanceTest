import type { Condition } from '../engine/types/conditions'
import type { Source } from '../engine/types/common'

export type CardLevel = 'intro' | 'core' | 'advanced'

/** Frontmatter + body of a knowledge card (`src/content/cards/<id>.md`). */
export interface KnowledgeCard {
  id: string
  title: string
  titleEn?: string
  tags: string[]
  level: CardLevel
  relatedMetrics: string[]
  /** Ids into the shared bibliography (`sources.ts`). */
  sources: string[]
  /** Markdown body (after frontmatter). */
  body: string
}

/** Long-form framework document (`src/content/frameworks/<id>.md`). */
export interface FrameworkDoc {
  id: string
  title: string
  titleEn?: string
  tags: string[]
  sources: string[]
  relatedCards: string[]
  /** Loaded lazily. */
  load: () => Promise<string>
}

export interface GlossaryEntry {
  id: string
  term: { ko: string; en: string }
  aliases?: string[]
  definition: { ko: string; en?: string }
  cardRef?: string
  sourceRef?: string
}

export interface CardTrigger {
  cardId: string
  when: Condition
  /** Institution types this trigger applies to (omit = all). */
  institutionTypes?: string[]
  reason: string
}

export interface ReadingItem {
  title: string
  publisher: string
  year: string
  url?: string
  tags: string[]
  note?: string
}

export type { Source }
