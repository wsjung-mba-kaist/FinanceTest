import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FRAMEWORKS, getCard, triggeredCards } from '../../content'
import type { KnowledgeCard } from '../../content/types'
import type { GameState, ScenarioDefinition } from '../../engine'
import { useProgressStore } from '../../store/progressStore'
import { EmptyState } from '../ui'
import { InlineCard } from '../play/InlineCard'

/**
 * `관련 카드·프레임워크` 탭 — 이번 턴의 카드(`view.cards`)와 상태 기반 트리거 카드(사유 포함),
 * 그리고 그 카드들을 `relatedCards`로 참조하는 프레임워크 문서.
 */
export function CardsHelp({
  scenario,
  state,
  turnCards = [],
}: {
  scenario: ScenarioDefinition
  state?: GameState
  /** `view.cards` (플레이 중일 때). */
  turnCards?: string[]
}) {
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const cardsViewed = useProgressStore((s) => s.learning.cardsViewed)

  const list = useMemo(() => {
    const out: { card: KnowledgeCard; reason: string }[] = []
    const seen = new Set<string>()
    for (const id of turnCards) {
      const card = getCard(id)
      if (card && !seen.has(id)) {
        seen.add(id)
        out.push({ card, reason: '이번 턴과 관련된 카드' })
      }
    }
    if (state) {
      for (const t of triggeredCards(state, scenario.meta.institutionType)) {
        if (!seen.has(t.card.id)) {
          seen.add(t.card.id)
          out.push(t)
        }
      }
    }
    for (const id of scenario.briefing.cardRefs) {
      const card = getCard(id)
      if (card && !seen.has(id)) {
        seen.add(id)
        out.push({ card, reason: '브리핑 핵심 개념' })
      }
    }
    return out
  }, [turnCards, state, scenario])

  const frameworks = useMemo(() => {
    const ids = new Set(list.map((l) => l.card.id))
    return FRAMEWORKS.filter((f) => f.relatedCards.some((c) => ids.has(c)))
  }, [list])

  if (list.length === 0)
    return (
      <EmptyState title="지금 표시할 지식카드가 없습니다">
        지식 베이스에서 전체 카드를 볼 수 있습니다.
      </EmptyState>
    )

  return (
    <div className="space-y-3">
      <section aria-label="지식 카드" className="space-y-2">
        {list.map(({ card, reason }) => (
          <div key={card.id}>
            <p className="mb-1 text-xs text-muted">{reason}</p>
            <InlineCard
              cardId={card.id}
              onOpen={markCardViewed}
              viewed={cardsViewed.includes(card.id)}
            />
          </div>
        ))}
      </section>

      {frameworks.length > 0 && (
        <section aria-label="관련 프레임워크">
          <h3 className="mb-1 text-sm font-semibold text-muted">
            이 카드들을 다루는 프레임워크 문서
          </h3>
          <ul className="space-y-1">
            {frameworks.map((f) => (
              <li key={f.id} className="rounded-md border border-border bg-surface p-2">
                <Link to={`/knowledge/frameworks/${f.id}`} className="text-base font-medium">
                  {f.title}
                </Link>
                {f.titleEn && <div className="text-xs text-muted">{f.titleEn}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
