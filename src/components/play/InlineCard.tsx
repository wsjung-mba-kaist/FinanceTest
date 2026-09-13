import { RestrictedKnowledgeContext } from '../knowledge/knowledgeAccess'
import { useContext, useEffect, useState } from 'react'
import { getCard } from '../../content'
import type { CardLevel } from '../../content/types'
import { firstSentence } from '../../lib/text'
import { Badge } from '../ui'
import { Citation } from '../knowledge/Citation'
import { Markdown } from '../knowledge/Markdown'

const LEVEL_LABEL: Record<CardLevel, string> = { intro: '입문', core: '핵심', advanced: '심화' }

/**
 * Collapsible inline knowledge card; reports the id when expanded (progress tracking).
 *
 * `lead` is the shape guided mode needs. Opening the whole card by default was measured at 2,813px
 * of reference material sitting above the first option in the decision dock — on a 712px column,
 * which meant a guided-mode reader met a document where the task should be and **none of the six
 * options were on screen at all**. The nudge was right and the cost was wrong: the first sentence
 * says what the card is about in one line, which is a better nudge than a wall of text the reader
 * scrolls past, and the full card stays one click away.
 */
export function InlineCard({
  cardId,
  prefix,
  defaultOpen,
  lead,
  onOpen,
  viewed,
}: {
  cardId: string
  prefix?: string
  defaultOpen?: boolean
  /** Show the card's first sentence under the header instead of opening the whole body. */
  lead?: boolean
  onOpen?: (id: string) => void
  /** Shows a "열람" marker (progress). */
  viewed?: boolean
}) {
  const restricted = useContext(RestrictedKnowledgeContext)
  const card = getCard(cardId)
  const [open, setOpen] = useState(Boolean(defaultOpen) && !lead)
  useEffect(() => {
    if (open) onOpen?.(cardId)
  }, [open, cardId, onOpen])
  if (!card || restricted) return null
  const head = lead && !open ? firstSentence(card.body, 110).head : ''
  return (
    <div className="rounded-md border border-border bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-tap-min w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm"
      >
        {prefix && <span className="text-muted">{prefix}</span>}
        <span className="font-medium">{card.title}</span>
        <Badge tone="neutral">{LEVEL_LABEL[card.level]}</Badge>
        {viewed && <Badge tone="positive">열람</Badge>}
        <span className="ml-auto shrink-0 text-muted">{open ? '접기' : '자세히'}</span>
      </button>
      {head && (
        <p className="px-3 pb-2 text-base text-muted" aria-hidden="true">
          {head}
        </p>
      )}
      {open && (
        <div className="border-t border-border px-3 py-2">
          <Markdown className="text-base">{card.body}</Markdown>
          {card.sources.length > 0 && (
            <div className="mt-1 text-xs text-muted">
              출처
              <Citation ids={card.sources} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
