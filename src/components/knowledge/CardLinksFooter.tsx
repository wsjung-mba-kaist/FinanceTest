import { Link } from 'react-router-dom'
import type { KnowledgeCard } from '../../content/types'
import { cardLinks } from '../../lib/knowledgeGraph'
import { ROLE_SHORT } from '../../lib/labels'

/**
 * Ways out of a concept card.
 *
 * A card used to be a dead end: frameworks, KPI help, the glossary and the scenario catalogue all
 * link *into* it, and it linked nowhere. Someone who read one to the bottom had to go back the
 * way they came. Every row here is an edge the content already declared — only the reverse
 * direction was missing.
 *
 * Rendered as a definition list because that is what it is: four kinds of relation, each with its
 * own set of destinations.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="label-caps whitespace-nowrap">{label}</dt>
      <dd className="m-0 flex flex-wrap gap-x-3 gap-y-1">{children}</dd>
    </>
  )
}

export function CardLinksFooter({ card }: { card: KnowledgeCard }) {
  const { frameworks, terms, scenarios, similar } = cardLinks(card)
  if (
    frameworks.length === 0 &&
    terms.length === 0 &&
    scenarios.length === 0 &&
    similar.length === 0
  )
    return null

  return (
    <nav aria-label={`${card.title} 관련 항목`} className="mt-3 border-t border-border pt-2">
      <dl className="m-0 grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        {scenarios.length > 0 && (
          <Row label="이 개념이 나오는 시나리오">
            {scenarios.map((s) => (
              <Link key={s.id} to={`/scenarios/${s.id}`}>
                {s.title}
                <span className="text-muted"> — {ROLE_SHORT[s.role]}</span>
              </Link>
            ))}
          </Row>
        )}
        {frameworks.length > 0 && (
          <Row label="더 깊이">
            {frameworks.map((f) => (
              <Link key={f.id} to={`/knowledge/frameworks/${f.id}`}>
                {f.title}
              </Link>
            ))}
          </Row>
        )}
        {terms.length > 0 && (
          <Row label="관련 용어">
            {terms.map((t) => (
              <Link key={t.id} to={`/knowledge/glossary#term-${t.id}`}>
                {t.term.ko}
              </Link>
            ))}
          </Row>
        )}
        {similar.length > 0 && (
          <Row label="비슷한 카드">
            {similar.map((c) => (
              <Link key={c.id} to={`/knowledge#card-${c.id}`}>
                {c.title}
              </Link>
            ))}
          </Row>
        )}
      </dl>
    </nav>
  )
}
