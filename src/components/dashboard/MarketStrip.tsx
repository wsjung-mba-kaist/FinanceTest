import { latestSnapshot } from '../../engine'
import { formatBp, formatDelta, formatNumber } from '../../lib/format'
import { usePlay } from '../play/playContext'
import { StatusBadge } from '../ui'
import { metricSeries } from './kpiRows'
import { Sparkline } from './Sparkline'

function Chip({
  label,
  children,
  ariaLabel,
}: {
  label: string
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-sm"
      aria-label={ariaLabel}
    >
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}

/**
 * 시장 수치만 남긴 스트립: 자사 주가 · CDS · 시장 신뢰지수.
 *
 * 런 상태(S0~S3)와 감독 단계(R0~R4)는 대시보드 깊숙한 곳이 아니라 플레이 상태바로 옮겼다 —
 * 상시 보여야 하는 상태 칩이지 지표 존의 항목이 아니다.
 *
 * 스파크라인은 `tickHistory`(틱 단위)로 그리고, 옆의 델타는 그대로 **전 턴 대비**다.
 */
export function MarketStrip() {
  const { scenario, state } = usePlay()
  const snap = latestSnapshot(state)
  const prev = state.metricsHistory.find((m) => m.turnIndex === state.turnIndex - 1)
  const stock = state.market.ownStock
  const stockPrev = prev?.metrics.ownStock?.value
  const stockDelta = stockPrev !== undefined ? stock - stockPrev : undefined
  const stockSeries = metricSeries(state, 'ownStock', state.turnIndex)
  const ci = state.confidence.index
  const ciStatus = snap.metrics.confidence?.status ?? 'na'
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="시장 지표">
      <Chip label="자사 주가">
        <span className="num font-semibold">{formatNumber(stock, 1)}</span>
        {stockDelta !== undefined && (
          <span
            className={`num ${stockDelta < 0 ? 'text-critical' : stockDelta > 0 ? 'text-positive' : 'text-muted'}`}
          >
            {formatDelta(stockDelta, 'index', scenario.units)}
            <span className="sr-only"> 전 턴 대비</span>
          </span>
        )}
        {stockSeries.length >= 2 && (
          <Sparkline
            values={stockSeries}
            width={52}
            height={16}
            ariaLabel={`자사 주가 추이 ${stockSeries.length}개 표본, 현재 ${formatNumber(stock, 1)}`}
          />
        )}
      </Chip>
      <Chip label="CDS">
        <span className="num font-semibold">{formatBp(state.market.ownCdsBp)}</span>
      </Chip>
      <Chip label="신뢰지수">
        <span className="num font-semibold">{formatNumber(ci, 0)}</span>
        <StatusBadge status={ciStatus} />
      </Chip>
    </div>
  )
}
