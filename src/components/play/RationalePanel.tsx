import type { ReactNode } from 'react'
import type { DecisionView, FeedItem, MetricDelta } from '../../engine'
import { formatDelta, formatMetric } from '../../lib/format'
import { useProgressStore } from '../../store/progressStore'
import { Badge, StatusBadge } from '../ui'
import { Citation } from '../knowledge/Citation'
import { Markdown } from '../knowledge/Markdown'
import { InlineCard } from './InlineCard'
import { usePlay } from './playContext'
import { letterFor } from './playHelpers'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-semibold text-muted">{title}</h4>
      {children}
    </section>
  )
}

/**
 * Four-block rationale shown after a decision is resolved (timing depends on mode/settings):
 * 결과 · 역사적 대응 · 전문가 관점 · 왜 중요한가.
 */
export function RationalePanel({
  dv,
  feedItems,
  turnDeltas,
}: {
  dv: DecisionView
  /** Engine feed items caused by this decision. */
  feedItems: FeedItem[]
  /** Metric deltas since the start of the turn (attributed to this turn's decisions). */
  turnDeltas: MetricDelta[]
}) {
  const { scenario } = usePlay()
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const { decision } = dv
  const chosen = decision.options.filter((o) => dv.chosen.includes(o.id))
  const historical = decision.options.filter((o) => o.historical)
  const visibleIds = dv.options.map((o) => o.option.id)
  const letterOf = (id: string) => {
    const i = visibleIds.indexOf(id)
    return i >= 0 ? letterFor(i) : '·'
  }
  const best = [...decision.options].sort((a, b) => b.expert.rating - a.expert.rating)[0]
  const kpiByMetric = new Map(scenario.kpis.map((k) => [k.metric, k]))
  const deltas = turnDeltas
    .filter((d) => kpiByMetric.has(d.key))
    .sort(
      (a, b) =>
        Math.abs(b.before !== 0 ? b.delta / b.before : b.delta) -
        Math.abs(a.before !== 0 ? a.delta / a.before : a.delta),
    )
    .slice(0, 8)
  const chosenHistorical = chosen.some((o) => o.historical)
  const why = chosen.filter(
    (o) => o.trap || o.remediationCard || o.calibrationNote || o.feasibility,
  )

  return (
    <div
      className="space-y-4 rounded-md border border-border bg-surface-2 p-3"
      aria-label="결정 근거"
    >
      <Block title="결과">
        {chosen.map((o) => (
          <div key={o.id} className="text-sm">
            <span className="num mr-1 font-semibold">{letterOf(o.id)}</span>
            <span className="font-medium">{o.label}</span>
            <Markdown className="mt-0.5 text-base leading-relaxed">{o.consequences}</Markdown>
          </div>
        ))}
        {feedItems.map((f) => (
          <div key={f.id} className="flex items-start gap-1.5 text-sm">
            <Badge tone={f.severity === 'info' ? 'neutral' : f.severity}>[결과]</Badge>
            <div>
              <div className="font-medium">{f.title}</div>
              <Markdown className="text-base leading-relaxed">{f.body}</Markdown>
            </div>
          </div>
        ))}
        {deltas.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm">
            {deltas.map((d) => {
              const spec = kpiByMetric.get(d.key)
              return (
                <li key={d.key} className="flex flex-wrap items-center gap-x-2">
                  <span className="text-muted">{spec?.label ?? d.label}</span>
                  <span className="num ml-auto">
                    {formatMetric(d.before, d.unit, scenario.units, spec?.decimals)} →{' '}
                    {formatMetric(d.after, d.unit, scenario.units, spec?.decimals)}
                  </span>
                  <span className="num text-muted">
                    {formatDelta(d.delta, d.unit, scenario.units)}
                  </span>
                  {d.statusBefore !== d.statusAfter && <StatusBadge status={d.statusAfter} />}
                </li>
              )
            })}
          </ul>
        )}
      </Block>

      <Block title="역사적 대응">
        {historical.length > 0 ? (
          <p className="text-sm">
            실제로는{' '}
            {historical.map((o) => (
              <span key={o.id}>
                <span className="num font-semibold">{letterOf(o.id)}</span> {o.label}
              </span>
            ))}
            {chosenHistorical ? ' — 실제 대응과 같은 선택입니다.' : ' 쪽으로 대응했습니다.'}
          </p>
        ) : (
          <p className="text-sm text-muted">이 결정에는 역사적 대응이 표시되지 않습니다.</p>
        )}
        {chosen
          .filter((o) => o.expert.historicalNote)
          .map((o) => (
            <Markdown key={o.id} className="text-base leading-relaxed">
              {o.expert.historicalNote ?? ''}
            </Markdown>
          ))}
      </Block>

      <Block title="전문가 관점">
        {chosen.map((o) => (
          <div key={o.id} className="space-y-0.5 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="num font-semibold">{letterOf(o.id)}</span>
              <span className="font-medium">{o.label}</span>
              <Badge
                tone={
                  o.expert.rating >= 70
                    ? 'positive'
                    : o.expert.rating >= 40
                      ? 'warning'
                      : 'critical'
                }
              >
                전문가 평점 {o.expert.rating}/100
              </Badge>
              {o.expert.sourceRefs && o.expert.sourceRefs.length > 0 && (
                <Citation ids={o.expert.sourceRefs} local={scenario.meta.sources} />
              )}
            </div>
            <Markdown className="text-base leading-relaxed">{o.expert.rationale}</Markdown>
          </div>
        ))}
        {best && !chosen.includes(best) && (
          <p className="text-sm text-muted">
            가장 높은 평점의 선택지:{' '}
            <span className="num font-semibold text-text">{letterOf(best.id)}</span> {best.label} (
            {best.expert.rating}/100)
          </p>
        )}
      </Block>

      <Block title="왜 중요한가">
        {why.length === 0 && (
          <p className="text-sm text-muted">이 선택에는 추가 설명이 없습니다.</p>
        )}
        {chosen.map((o) => (
          <div key={o.id} className="space-y-1.5">
            {o.trap && (
              <div className="rounded border border-warning/40 bg-warning-bg px-2 py-1 text-sm">
                <Badge tone="warning">함정 선택지</Badge>
                {o.trapExplanation && (
                  <Markdown className="mt-1 text-base leading-relaxed">
                    {o.trapExplanation}
                  </Markdown>
                )}
              </div>
            )}
            {o.remediationCard && (
              <InlineCard cardId={o.remediationCard} prefix="보완 학습:" onOpen={markCardViewed} />
            )}
            {o.feasibility && (
              <p className="text-sm text-muted">
                실행 가능성 근거: {o.feasibility.basis}
                {o.feasibility.sourceRefs && o.feasibility.sourceRefs.length > 0 && (
                  <Citation ids={o.feasibility.sourceRefs} local={scenario.meta.sources} />
                )}
              </p>
            )}
            {o.calibrationNote && (
              <p className="text-sm text-muted">보정 노트: {o.calibrationNote}</p>
            )}
          </div>
        ))}
      </Block>
    </div>
  )
}
