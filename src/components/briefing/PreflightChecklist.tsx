import { useState } from 'react'
import type { MetricSnapshot, ScenarioDefinition } from '../../engine/types'
import type { PreflightItem } from '../../lib/briefingSummary'
import { formatMetric } from '../../lib/format'
import { Card } from '../ui'
import { Icon } from '../ui/Icon'

/**
 * 시작 전 확인 체크리스트. Purely informational — nothing here gates the start button; ticking an
 * item is a reading aid, not a requirement, and the state is not persisted.
 */
export function PreflightChecklist({
  items,
  scenario,
  baseline,
}: {
  items: PreflightItem[]
  scenario: ScenarioDefinition
  baseline: MetricSnapshot | undefined
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  if (items.length === 0) return null
  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section aria-labelledby="bf-preflight-h">
      <h2 id="bf-preflight-h" className="text-md font-semibold">
        시작 전 확인
      </h2>
      <p className="prose-col mt-1 text-sm text-muted">
        답을 확인하지 않아도 시작할 수 있습니다. 첫 턴에서 가장 먼저 찾게 되는 숫자들입니다.
      </p>
      <Card className="mt-2 p-3">
        {/* Each item is a label, a one-line question and a figure or two — a single column left the
            right two-thirds of a full-width card empty. */}
        <ul className="m-0 grid list-none gap-x-6 gap-y-2 p-0 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const on = checked.has(item.id)
            return (
              <li key={item.id} className="min-w-0">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className={`font-medium ${on ? 'text-muted line-through' : ''}`}>
                      {item.label}
                    </span>
                    <span className="block text-muted">{item.question}</span>
                    {item.metrics.length > 0 && baseline && (
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted">
                        {item.metrics.map((metricId) => {
                          const kpi = scenario.kpis.find((k) => k.metric === metricId)
                          const m = baseline.metrics[metricId]
                          if (!kpi || !m) return null
                          return (
                            <span key={metricId} className="num">
                              {kpi.label}{' '}
                              {formatMetric(m.value, kpi.unit, scenario.units, kpi.decimals)}
                            </span>
                          )
                        })}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="info" size={14} />
          체크하지 않아도 시작 버튼은 그대로 동작합니다.
        </p>
      </Card>
    </section>
  )
}
