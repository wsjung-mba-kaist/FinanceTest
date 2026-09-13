import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCard } from '../../content'
import { Markdown } from '../knowledge/Markdown'
import { Badge, Card } from '../ui'
import { Icon } from '../ui/Icon'
import { gridClass } from '../../lib/grid'

const LEVEL_LABELS: Record<string, string> = { intro: '입문', core: '핵심', advanced: '심화' }

function firstParagraph(md: string): string {
  return (
    md
      .trim()
      .split(/\n\s*\n/)
      .find((block) => !/^\s*#{1,6}\s/.test(block) && !/^\s*>/.test(block))
      ?.trim() ?? ''
  )
}

function ConceptItem({ cardId, onView }: { cardId: string; onView: (id: string) => void }) {
  const card = getCard(cardId)
  const [open, setOpen] = useState(false)
  const panelId = `concept-${cardId}-panel`
  if (!card) {
    return (
      <Card as="article" className="p-3 text-sm text-muted">
        카드 <code className="font-mono">{cardId}</code> 을(를) 찾을 수 없습니다.
      </Card>
    )
  }
  const lead = firstParagraph(card.body)
  return (
    <Card as="article" className="flex h-full flex-col p-3">
      <h3 className="text-md font-semibold">
        {card.title}
        {card.titleEn && <span className="font-normal text-muted"> ({card.titleEn})</span>}
      </h3>
      <div className="mt-1">
        <Badge tone="neutral">{LEVEL_LABELS[card.level] ?? card.level}</Badge>
      </div>
      {!open && <Markdown className="md-compact mt-2 text-sm text-muted">{lead}</Markdown>}
      <div id={panelId} hidden={!open} className="mt-2">
        <Markdown className="md-compact text-sm">{card.body}</Markdown>
        <p className="mt-2 text-sm">
          <Link to={`/knowledge#card-${card.id}`}>지식 베이스에서 보기</Link>
        </p>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onView(card.id)
        }}
        className="mt-auto inline-flex items-center gap-1 self-start border-0 bg-transparent p-0 pt-2 text-sm text-accent"
      >
        {open ? '접기' : '자세히'}
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
      </button>
    </Card>
  )
}

/**
 * The scenario's concept cards: title + first paragraph, expandable in place.
 *
 * The dossier used to list the same cards again in a different card shape. One shape, one place,
 * all of them — the summary is where a reader looks before starting, so that is where they live.
 */
export function ConceptPreview({
  cardIds,
  onView,
}: {
  cardIds: string[]
  onView: (cardId: string) => void
}) {
  if (cardIds.length === 0) return null
  return (
    <section aria-labelledby="bf-concepts-h">
      <h2 id="bf-concepts-h" className="text-lg font-semibold">
        미리 알아 둘 개념
      </h2>
      <ul className={`mt-2 grid list-none gap-2 p-0 m-0 ${gridClass('prose', cardIds.length)}`}>
        {cardIds.map((id) => (
          <li key={id}>
            <ConceptItem cardId={id} onView={onView} />
          </li>
        ))}
      </ul>
    </section>
  )
}
