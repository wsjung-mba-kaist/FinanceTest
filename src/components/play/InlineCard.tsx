import { useEffect, useState } from 'react'
import { getCard } from '../../content'
import type { CardLevel } from '../../content/types'
import { Badge } from '../ui'
import { Citation } from '../knowledge/Citation'
import { Markdown } from '../knowledge/Markdown'

const LEVEL_LABEL: Record<CardLevel, string> = { intro: '입문', core: '핵심', advanced: '심화' }

/** Collapsible inline knowledge card; reports the id when expanded (progress tracking). */
export function InlineCard({
  cardId,
  prefix,
  defaultOpen,
  onOpen,
  viewed,
}: {
  cardId: string
  prefix?: string
  defaultOpen?: boolean
  onOpen?: (id: string) => void
  /** Shows a "열람" marker (progress). */
  viewed?: boolean
}) {
  const card = getCard(cardId)
  const [open, setOpen] = useState(Boolean(defaultOpen))
  useEffect(() => {
    if (open) onOpen?.(cardId)
  }, [open, cardId, onOpen])
  if (!card) return null
  return (
    <div className="rounded-md border border-border bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[36px] w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12px]"
      >
        {prefix && <span className="text-muted">{prefix}</span>}
        <span className="font-medium">{card.title}</span>
        <Badge tone="neutral">{LEVEL_LABEL[card.level]}</Badge>
        {viewed && <Badge tone="positive">열람</Badge>}
        <span className="ml-auto text-muted" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          <Markdown className="text-[12px] leading-relaxed">{card.body}</Markdown>
          {card.sources.length > 0 && (
            <div className="mt-1 text-[11px] text-muted">
              출처
              <Citation ids={card.sources} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
