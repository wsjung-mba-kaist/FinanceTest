import { Link } from 'react-router-dom'
import type { MetricSnapshot, ScenarioDefinition } from '../../engine/types'
import { watchpointsOf } from '../../lib/briefingFocus'
import { getCard, getFramework } from '../../content'
import { formatMetric } from '../../lib/format'
import { gridClass } from '../../lib/grid'
import { Card, StatusBadge } from '../ui'

/**
 * «매 턴 확인할 N가지» — the merge of the role frame and the pre-flight checklist.
 *
 * Those were two sections asking one question in two different chromes, each printing the same T0
 * figures: "같은 질문을 같은 순서로. 상황이 바뀌어도 이 네 가지는 매 턴 확인합니다" next to
 * "첫 턴에서 가장 먼저 찾게 되는 숫자들입니다". Joined on the metrics they read, they are one
 * list — and it is the **only** place in the summary that prints a T0 number, which is what stops
 * the same figure appearing four times on one screen.
 */
export function Watchpoints({
  scenario,
  baseline,
  learningLinks = true,
}: {
  scenario: ScenarioDefinition
  learningLinks?: boolean
  baseline: MetricSnapshot | undefined
}) {
  const items = watchpointsOf(scenario)
  if (items.length === 0) return null

  return (
    <section aria-labelledby="bf-watch-h">
      <h2 id="bf-watch-h" className="text-lg font-semibold">
        매 턴 확인할 {items.length}가지
      </h2>
      <p className="prose-col mt-1 text-sm text-muted">
        같은 질문을 같은 순서로. 아래 값은 시작 시점(T0) 기준입니다.
      </p>
      <ol className={`m-0 mt-2 grid list-none gap-2 p-0 ${gridClass('question', items.length)}`}>
        {items.map((w, i) => {
          const card = w.cardRef ? getCard(w.cardRef) : undefined
          const framework = w.frameworkRef ? getFramework(w.frameworkRef) : undefined
          return (
            <Card as="li" key={w.id} className="flex min-w-0 flex-col p-3">
              <span className="flex items-center gap-1.5">
                <span className="num text-sm text-muted">{i + 1}</span>
                <span className="font-medium">{w.label}</span>
              </span>
              <span className="mt-0.5 min-w-0 flex-1 text-sm text-muted">{w.question}</span>
              {w.kpis.length > 0 && (
                <dl className="m-0 mt-2 space-y-1">
                  {w.kpis.map((kpi) => {
                    const m = baseline?.metrics[kpi.metric]
                    return (
                      <div key={kpi.metric} className="flex items-baseline justify-between gap-2">
                        <dt className="min-w-0 truncate text-sm text-muted">{kpi.label}</dt>
                        <dd className="num m-0 flex shrink-0 items-baseline gap-1.5 font-medium">
                          {m ? formatMetric(m.value, kpi.unit, scenario.units, kpi.decimals) : '—'}
                          {m && <StatusBadge status={m.status} />}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              )}
              {learningLinks && (card || framework) && (
                <span className="mt-2 flex flex-wrap gap-x-3 text-sm">
                  {card && <Link to={`/knowledge#card-${card.id}`}>{card.title}</Link>}
                  {framework && (
                    <Link to={`/knowledge/frameworks/${framework.id}`}>{framework.title}</Link>
                  )}
                </span>
              )}
            </Card>
          )
        })}
      </ol>
    </section>
  )
}
