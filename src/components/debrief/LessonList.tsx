import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getCard } from '../../content'
import { buildConditionContext, evaluate } from '../../engine'
import type { GameState, Lesson, ScenarioDefinition } from '../../engine/types'
import { Citation } from '../knowledge/Citation'
import { Markdown } from '../knowledge/Markdown'

export function LessonList({
  scenario,
  state,
  lessons,
}: {
  scenario: ScenarioDefinition
  state: GameState
  lessons: Lesson[]
}) {
  const visible = useMemo(() => {
    const ctx = buildConditionContext(state)
    return lessons.filter((l) => evaluate(l.when, ctx))
  }, [lessons, state])
  if (visible.length === 0)
    return <p className="text-sm text-muted">이 플레이에 해당하는 교훈이 없습니다.</p>
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {visible.map((l, i) => (
        <li key={l.id} className="rounded-lg border border-border bg-surface p-3">
          <h4 className="m-0 text-base font-semibold">
            <span className="num text-muted">{i + 1}.</span> {l.title}
            {l.sourceRefs.length > 0 && (
              <Citation ids={l.sourceRefs} local={scenario.meta.sources} />
            )}
          </h4>
          <Markdown className="mt-1 text-base">{l.body}</Markdown>
          {l.cardRefs && l.cardRefs.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              관련 카드:{' '}
              {l.cardRefs.map((c, j) => {
                const card = getCard(c)
                return (
                  <span key={c}>
                    {j > 0 && ', '}
                    <Link to={`/knowledge#card-${c}`}>{card?.title ?? c}</Link>
                  </span>
                )
              })}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
