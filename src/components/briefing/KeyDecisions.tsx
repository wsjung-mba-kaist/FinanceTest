import type { ScenarioDefinition } from '../../engine/types'
import { keyDecisionsOf } from '../../lib/briefingFocus'
import { Badge, Card } from '../ui'
import { gridClass } from '../../lib/grid'

/**
 * «내려야 할 결정 3가지».
 *
 * The section this replaces was headed «중요한 판단» and listed learning objectives — sentences of
 * the form "…을 이해한다". Those describe what a player should come away knowing; they do not
 * answer the question a briefing exists to answer, which is *what will I be asked to decide*.
 *
 * Ranked by how far apart the expert ratings of the options sit: where the experts agree, the
 * scenario has already decided for you; where they split 5 / 3 / 1 is where the run turns. The
 * learning objective survives as the «왜 중요한가» line under each, which is where it belongs.
 */
export function KeyDecisions({ scenario }: { scenario: ScenarioDefinition }) {
  const decisions = keyDecisionsOf(scenario)
  if (decisions.length === 0) return null

  return (
    <section aria-labelledby="bf-decisions-h">
      <h2 id="bf-decisions-h" className="text-lg font-semibold">
        내려야 할 결정 {decisions.length}가지
      </h2>
      <p className="prose-col mt-1 text-sm text-muted">
        전문가 평가가 가장 크게 갈리는 결정들입니다 — 고르는 답에 따라 결과가 가장 많이 달라지는
        지점입니다.
      </p>
      <ol
        className={`m-0 mt-2 grid list-none gap-2 p-0 ${gridClass('question', decisions.length)}`}
      >
        {decisions.map((d) => (
          <Card as="li" key={d.id} className="flex min-w-0 flex-col p-3">
            <span className="num text-sm text-muted">{d.turnLabel}</span>
            <span className="mt-0.5 font-medium">{d.title}</span>
            {d.why && <span className="mt-1 min-w-0 flex-1 text-sm text-muted">{d.why}</span>}
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              {d.competencyLabel && <Badge tone="neutral">{d.competencyLabel}</Badge>}
              <span className="num text-sm text-muted">선택지 {d.optionCount}개</span>
            </span>
          </Card>
        ))}
      </ol>
    </section>
  )
}
