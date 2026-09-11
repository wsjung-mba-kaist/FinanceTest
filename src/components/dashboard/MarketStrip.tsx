import { latestSnapshot } from '../../engine'
import { formatBp, formatDelta, formatNumber } from '../../lib/format'
import { RUN_STATE_LABELS, runStateFromCi } from '../../metrics/runoff'
import { usePlay } from '../play/playContext'
import { REGULATOR_LABELS } from '../play/playHelpers'
import { Badge, StatusBadge, type Tone } from '../ui'

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
      className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px]"
      aria-label={ariaLabel}
    >
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}

/** Own stock · CDS · confidence index · regulator level · run state. */
export function MarketStrip() {
  const { scenario, state } = usePlay()
  const snap = latestSnapshot(state)
  const prev = state.metricsHistory.find((m) => m.turnIndex === state.turnIndex - 1)
  const stock = state.market.ownStock
  const stockPrev = prev?.metrics.ownStock?.value
  const stockDelta = stockPrev !== undefined ? stock - stockPrev : undefined
  const ci = state.confidence.index
  const ciStatus = snap.metrics.confidence?.status ?? 'na'
  const run = runStateFromCi(ci)
  const level = state.regulator.level
  const regTone: Tone =
    level >= 3 ? 'critical' : level === 2 ? 'warning' : level === 1 ? 'info' : 'neutral'
  const runTone: Tone = run >= 2 ? 'critical' : run === 1 ? 'warning' : 'positive'
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="시장·신뢰 스트립">
      <Chip label="자사 주가">
        <span className="num font-semibold">{formatNumber(stock, 1)}</span>
        {stockDelta !== undefined && (
          <span
            className={`num ${stockDelta < 0 ? 'text-critical' : stockDelta > 0 ? 'text-positive' : 'text-muted'}`}
          >
            {formatDelta(stockDelta, 'index', scenario.units)}
          </span>
        )}
      </Chip>
      <Chip label="CDS">
        <span className="num font-semibold">{formatBp(state.market.ownCdsBp)}</span>
      </Chip>
      <Chip label="신뢰지수">
        <span className="num font-semibold">{formatNumber(ci, 0)}</span>
        <StatusBadge status={ciStatus} />
      </Chip>
      <Chip label="감독당국">
        <Badge tone={regTone}>{REGULATOR_LABELS[level] ?? `R${level}`}</Badge>
      </Chip>
      <Chip label="런 상태">
        <Badge tone={runTone}>{RUN_STATE_LABELS[run]}</Badge>
      </Chip>
    </div>
  )
}
