import { useMemo, useState } from 'react'
import type { MetricDelta } from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'
import { useHelp } from '../help/helpContext'
import { usePlay } from '../play/playContext'
import type { PreviewState } from '../play/playHelpers'
import { Icon } from '../ui/Icon'
import { BalanceSheetMini } from './BalanceSheetMini'
import { KpiTile } from './KpiTile'
import { buildKpiRows, sortedKpis } from './kpiRows'
import { MarketStrip } from './MarketStrip'
import { TimeSeriesChart } from './TimeSeriesChart'
import { StatusBoard } from '../play/StatusBoard'

/**
 * 우측 지표 존: 시장 스트립 → **핵심 지표(큰 타일)** → `전체 지표` 토글 뒤의 나머지 → 추이 → 대차대조표.
 *
 * KPI 13개를 같은 비중으로 늘어놓으면 무엇을 먼저 볼지 알 수 없다. 1차 지표(`KpiSpec.primary`)만
 * 큰 타일로 두고 나머지는 접어 둔다. 시그니처는 `Dashboard({ preview })` 그대로다.
 */
export function Dashboard({ preview }: { preview: PreviewState | null }) {
  const { scenario, state, mode } = usePlay()
  const help = useHelp()
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => buildKpiRows(scenario, state, mode), [scenario, state, mode])
  const thresholds = useMemo(() => mergeThresholds(scenario.thresholds), [scenario])
  const kpis = useMemo(() => sortedKpis(scenario), [scenario])
  const projected = useMemo(
    () =>
      new Map<string, MetricDelta>(preview ? preview.deltas.map((d) => [d.key, d] as const) : []),
    [preview],
  )
  const primary = rows.filter((r) => r.spec.primary)
  const key = primary.length > 0 ? primary : rows.slice(0, 4)
  const rest = rows.filter((r) => !key.includes(r))

  return (
    <div className="space-y-3 p-3">
      <MarketStrip />
      {preview && preview.fidelity !== 'none' && preview.deltas.length > 0 && (
        <p className="text-xs text-muted">점선 칩은 현재 살펴보는 선택지의 예상 변화입니다.</p>
      )}

      <section aria-label="핵심 지표">
        <div className="grid grid-cols-2 gap-2">
          {key.map((r) => (
            <KpiTile
              key={r.spec.metric}
              row={r}
              units={scenario.units}
              projected={projected.get(r.spec.metric)}
              fidelity={preview?.fidelity ?? 'none'}
            />
          ))}
        </div>
      </section>

      {rest.length > 0 && (
        <section aria-label="전체 지표">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-base hover:bg-surface-2"
          >
            <Icon name={showAll ? 'chevron-down' : 'chevron-right'} size={14} />
            전체 지표
            <span className="num text-muted">({rest.length})</span>
            <span className="ml-auto text-sm text-muted">
              {showAll ? '접기' : '나머지 지표 펼치기'}
            </span>
          </button>
          {showAll && (
            <div className="mt-2 rounded-md border border-border bg-surface">
              {rest.map((r) => (
                <KpiTile
                  key={r.spec.metric}
                  row={r}
                  units={scenario.units}
                  projected={projected.get(r.spec.metric)}
                  fidelity={preview?.fidelity ?? 'none'}
                  compact
                />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-sm">
        <button type="button" className="text-accent" onClick={() => help.open({ tab: 'kpis' })}>
          지표 설명 전체 보기 →
        </button>
      </p>

      <TimeSeriesChart
        kpis={kpis}
        history={state.metricsHistory}
        units={scenario.units}
        thresholds={thresholds}
      />
      <BalanceSheetMini />
      {/* Moved off the situation column: ~460px of slow-changing reference was pushing
          최근 결과 — the outcome of the decision just made — below the fold every turn. */}
      <StatusBoard />
    </div>
  )
}
