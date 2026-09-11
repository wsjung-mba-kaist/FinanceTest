import { useMemo } from 'react'
import type { MetricDelta } from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'
import { usePlay } from '../play/playContext'
import type { PreviewState } from '../play/playHelpers'
import { BalanceSheetMini } from './BalanceSheetMini'
import { KpiChip, KpiTile } from './KpiTile'
import { buildKpiRows, sortedKpis } from './kpiRows'
import { MarketStrip } from './MarketStrip'
import { TimeSeriesChart } from './TimeSeriesChart'

/** Right zone: market strip, KPI tiles (primary first), time series, balance sheet. */
export function Dashboard({ preview }: { preview: PreviewState | null }) {
  const { scenario, state, mode } = usePlay()
  const rows = useMemo(() => buildKpiRows(scenario, state, mode), [scenario, state, mode])
  const thresholds = useMemo(() => mergeThresholds(scenario.thresholds), [scenario])
  const kpis = useMemo(() => sortedKpis(scenario), [scenario])
  const projected = useMemo(
    () =>
      new Map<string, MetricDelta>(preview ? preview.deltas.map((d) => [d.key, d] as const) : []),
    [preview],
  )
  return (
    <div className="space-y-3 p-3">
      <MarketStrip />
      {preview && preview.fidelity !== 'none' && preview.deltas.length > 0 && (
        <p className="text-[11px] text-muted">점선 칩은 현재 살펴보는 선택지의 예상 변화입니다.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <KpiTile
            key={r.spec.metric}
            row={r}
            units={scenario.units}
            projected={projected.get(r.spec.metric)}
            fidelity={preview?.fidelity ?? 'none'}
          />
        ))}
      </div>
      <TimeSeriesChart
        kpis={kpis}
        history={state.metricsHistory}
        units={scenario.units}
        thresholds={thresholds}
      />
      <BalanceSheetMini />
    </div>
  )
}

/** Sticky strip of the 3 primary KPIs (tablet/mobile). */
export function KpiStrip({ onSelect }: { onSelect?: () => void }) {
  const { scenario, state, mode } = usePlay()
  const rows = useMemo(() => buildKpiRows(scenario, state, mode), [scenario, state, mode])
  const top = rows.filter((r) => r.spec.primary).slice(0, 3)
  const shown = top.length > 0 ? top : rows.slice(0, 3)
  return (
    <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="핵심 지표">
      {shown.map((r) => (
        <KpiChip key={r.spec.metric} row={r} units={scenario.units} onClick={onSelect} />
      ))}
    </div>
  )
}
