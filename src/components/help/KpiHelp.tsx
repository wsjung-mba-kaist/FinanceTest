import { useEffect, useMemo, useRef } from 'react'
import {
  latestSnapshot,
  type GameState,
  type MetricStatus,
  type ScenarioDefinition,
} from '../../engine'
import { getCard, getSource } from '../../content'
import { kpiExplanation } from '../../content/kpiExplain'
import { metricContext, metricLabel } from '../../lib/metricContext'
import { formatMetric } from '../../lib/format'
import { mergeThresholds } from '../../metrics/thresholds'
import { ThresholdBand } from '../dashboard/ThresholdBand'
import { kpiAnchorId } from './helpMeta'
import { Badge, StatusBadge } from '../ui'
import { Citation } from '../knowledge/Citation'
import { InlineCard } from '../play/InlineCard'

/**
 * `지표 설명` 탭 — 시나리오가 노출하는 **모든** KPI를 한 줄씩.
 * 한글(영문) 라벨 · 현재 값과 상태 · 왜 중요한가 · 산식 · 경고/위험 기준 · 관련 카드.
 */
export function KpiHelp({
  scenario,
  state,
  anchor,
  expertTraining = false,
}: {
  scenario: ScenarioDefinition
  state?: GameState
  anchor?: string
  expertTraining?: boolean
}) {
  const thresholds = useMemo(() => mergeThresholds(scenario.thresholds), [scenario])
  const snap = state ? latestSnapshot(state) : undefined
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!anchor) return
    const el = document.getElementById(kpiAnchorId(anchor))
    el?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [anchor])

  return (
    <div ref={scrollRef} className="space-y-2">
      <p className="text-sm text-muted">
        이 시나리오가 보여 주는 지표 <span className="num">{scenario.kpis.length}</span>개입니다.
        경고·위험 구간이 없는 지표는 &apos;정상&apos;이 아니라 &apos;기준 없음&apos;으로 표시합니다.
      </p>
      {scenario.kpis.map((spec) => {
        const explain = kpiExplanation(spec.metric, scenario.initialState.institution.kind)
        const shown =
          expertTraining && spec.lagTurns && state
            ? state.metricsHistory.find(
                (m) => m.turnIndex === Math.max(0, state.turnIndex - spec.lagTurns!),
              )
            : snap
        const value = shown?.metrics[spec.metric]
        const threshold = thresholds[spec.metric]
        const status: MetricStatus = value?.status ?? 'na'
        const highlighted = anchor === spec.metric
        return (
          <section
            key={spec.metric}
            id={kpiAnchorId(spec.metric)}
            aria-label={metricLabel(spec.metric, spec.label)}
            className={`scroll-mt-2 rounded-md border p-2 ${
              highlighted ? 'border-accent bg-accent-soft/40' : 'border-border bg-surface'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-base font-semibold">{metricLabel(spec.metric, spec.label)}</h3>
              {spec.labelEn && <span className="text-xs text-muted">{spec.labelEn}</span>}
              {spec.primary && <Badge tone="info">핵심</Badge>}
              <span className="ml-auto flex items-center gap-1.5">
                {value && (
                  <span className="num font-semibold">
                    {formatMetric(value.value, spec.unit, scenario.units, spec.decimals)}
                  </span>
                )}
                {status === 'na' ? (
                  <Badge tone="neutral">기준 없음</Badge>
                ) : (
                  <StatusBadge status={status} />
                )}
              </span>
            </div>

            {metricContext(spec.metric) && (
              <p className="mt-1 text-sm text-muted">{metricContext(spec.metric)}</p>
            )}
            {expertTraining && spec.lagTurns && shown && (
              <p className="text-xs text-muted">T+{shown.turnIndex} 관측값</p>
            )}
            {!expertTraining && (spec.description ?? explain?.why) && (
              <p className="mt-1 text-base leading-relaxed">{spec.description ?? explain?.why}</p>
            )}

            {explain?.formula && (
              <p className="num mt-1 rounded-sm bg-surface-2 px-1.5 py-1 text-sm">
                산식 · {explain.formula}
              </p>
            )}

            {threshold ? (
              <ThresholdBand
                value={value?.value}
                threshold={threshold}
                unit={spec.unit}
                units={scenario.units}
                decimals={spec.decimals}
                label={spec.label}
                status={status}
              />
            ) : (
              <p className="mt-1 text-sm text-muted">
                경고·위험 구간이 정의되지 않은 지표입니다 — 절대값과 변화 속도로 판단하세요.
                {spec.referenceLabel ? ` (${spec.referenceLabel})` : ''}
              </p>
            )}

            {/* `Threshold.asOf` · `sourceRefs` 를 저작한 시나리오는 아직 없다 — 두 줄 모두
                지금은 그려지지 않는다. 타입과 함께 남겨 두어 저작 경로를 열어 두되, 없는 근거를
                기본값으로 지어내지는 않는다(`ThresholdBand` 의 basis 와 같은 규칙). */}
            {threshold?.asOf && <p className="text-xs text-muted">기준일: {threshold.asOf}</p>}
            {!expertTraining && threshold?.sourceRefs && <Citation ids={threshold.sourceRefs} />}
            {value?.detail && Object.keys(value.detail).length > 0 && (
              <p className="num mt-1 text-xs text-muted">
                {Object.entries(value.detail)
                  .map(([k, v]) => `${k} ${formatMetric(v, 'ccy', scenario.units)}`)
                  .join(' · ')}
              </p>
            )}

            {!expertTraining && explain?.sourceRef && getSource(explain.sourceRef) && (
              <div className="mt-1 text-xs text-muted">
                근거
                <Citation ids={[explain.sourceRef]} />
              </div>
            )}

            {!expertTraining && (explain?.cards ?? []).filter((id) => getCard(id)).length > 0 && (
              <div className="mt-1 space-y-1">
                {(explain?.cards ?? [])
                  .filter((id) => getCard(id))
                  .map((id) => (
                    <InlineCard key={id} cardId={id} prefix="관련 카드:" />
                  ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
