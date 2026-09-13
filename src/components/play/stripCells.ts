import type {
  Currency,
  GameState,
  MetricStatus,
  MetricValue,
  ScenarioDefinition,
  Units,
} from '../../engine'
import { latestSnapshot } from '../../engine'
import { formatAt, formatBp, formatDelta, formatNumber, type CcyScale } from '../../lib/format'
import { isWindowMetric } from '../../lib/metricContext'
import { mergeThresholds } from '../../metrics/thresholds'
import { directionOf, metricScale, type Direction } from '../dashboard/kpiRows'

export interface MetricCell {
  kind: 'metric'
  id: string
  /** Metric id used as the help anchor (`useHelp().open({ tab: 'kpis', anchor })`). */
  metric: string
  label: string
  value: string
  raw: number
  status: MetricStatus
  delta?: string
  direction: Direction
  /** The change moved the metric across a threshold band — the one case a delta earns colour. */
  crossed: boolean
  /** Secondary line, e.g. 익일 담보 여력. */
  sub?: string
  /** Intraday sparkline values from `tickHistory` (empty on an un-ticked run). */
  series: number[]
}

export interface LegendCell {
  kind: 'legend'
  id: 'legend'
  legend: string
  figures: { label: string; value: string; direction: Direction }[]
}

export type StripCell = MetricCell | LegendCell

const CURRENCY_WORD: Record<Currency, string> = {
  USD: '달러',
  KRW: '원',
  GBP: '파운드',
  EUR: '유로',
  CHF: '스위스프랑',
}

function scaleWord(scale: number): string {
  if (scale >= 1e12) return '1조'
  if (scale >= 1e9) return '10억'
  if (scale >= 1e8) return '1억'
  if (scale >= 1e6) return '100만'
  if (scale >= 1e4) return '1만'
  return '1'
}

/**
 * `$B = 10억 달러` / `억원 = 1억 원`. Local to the strip: `lib/format.ts` is shared with
 * other screens and is not edited by this milestone.
 */
export function unitsLegend(units: Units): string {
  return `${units.display} = ${scaleWord(units.scale)} ${CURRENCY_WORD[units.currency]}`
}

interface Ctx {
  scenario: ScenarioDefinition
  current: Record<string, MetricValue>
  previous?: Record<string, MetricValue>
  units: Units
  /** Live values of the current turn only, so the strip shows what moved *today*. */
  seriesFor: (metric: string) => number[]
  /**
   * The currency unit a metric keeps for the whole run. Without it the headline figure re-scales
   * itself as it falls — 3.2조원 → 8,500억원 → 920억원 — and the reader has to notice the *unit*
   * changed before they can see the number did.
   */
  scaleFor: (metric: string) => CcyScale | undefined
}

function metricCell(
  ctx: Ctx,
  metric: string,
  opts: { label?: string; sub?: string; decimals?: number } = {},
): MetricCell | undefined {
  const mv = ctx.current[metric]
  if (!mv || !Number.isFinite(mv.value)) return undefined
  const spec = ctx.scenario.kpis.find((k) => k.metric === metric)
  const scale = ctx.scaleFor(metric)
  const prev = ctx.previous?.[metric]
  const thresholds = mergeThresholds(ctx.scenario.thresholds)
  const delta =
    !isWindowMetric(metric) &&
    prev &&
    Number.isFinite(prev.value) &&
    Math.abs(mv.value - prev.value) > 1e-9
      ? mv.value - prev.value
      : undefined
  return {
    kind: 'metric',
    id: metric,
    metric,
    label: opts.label ?? spec?.label ?? mv.label,
    value: formatAt(mv.value, mv.unit, ctx.units, {
      scale,
      decimals: opts.decimals ?? spec?.decimals,
    }),
    raw: mv.value,
    status: mv.status,
    delta: delta !== undefined ? formatDelta(delta, mv.unit, ctx.units) : undefined,
    direction: directionOf(delta ? Math.sign(delta) : 0, thresholds[metric]),
    crossed: Boolean(prev && prev.status !== mv.status),
    sub: opts.sub,
    series: ctx.seriesFor(metric),
  }
}

function legendCell(ctx: Ctx, state: GameState): LegendCell {
  const stockPrev = ctx.previous?.ownStock?.value
  const stock = state.market.ownStock
  const stockDelta = stockPrev !== undefined ? stock - stockPrev : 0
  return {
    kind: 'legend',
    id: 'legend',
    legend: unitsLegend(ctx.units),
    figures: [
      {
        label: '자사 주가',
        value: formatNumber(stock, 1),
        direction: stockDelta === 0 ? 'neutral' : stockDelta > 0 ? 'better' : 'worse',
      },
      { label: 'CDS', value: formatBp(state.market.ownCdsBp), direction: 'neutral' },
      { label: '신뢰지수', value: formatNumber(state.confidence.index, 0), direction: 'neutral' },
    ],
  }
}

/**
 * Role-specific headline numbers for the liquidity strip: the three or four figures a crisis
 * desk reads first (cash position → borrowing capacity → today's outflow → runway), plus a
 * units legend and the market mini-figures. Cells whose metric is absent are omitted.
 */
export function buildStripCells(scenario: ScenarioDefinition, state: GameState): StripCell[] {
  const snap = latestSnapshot(state)
  const prevSnap = state.metricsHistory.find((m) => m.turnIndex === state.turnIndex - 1)
  const intraday = state.tickHistory.filter((t) => t.turnIndex === state.turnIndex)
  const ctx: Ctx = {
    scenario,
    current: snap.metrics,
    previous: prevSnap?.metrics,
    units: scenario.units,
    scaleFor: (metric) => {
      const spec = scenario.kpis.find((k) => k.metric === metric)
      const unit = snap.metrics[metric]?.unit
      if (unit !== 'ccy') return undefined
      return metricScale(state, spec ?? { metric, label: metric, unit: 'ccy' }, scenario.units)
    },
    seriesFor: (metric) => {
      if (intraday.length < 2) return []
      return intraday
        .map((t) => t.values[metric])
        .filter((v): v is number => v !== undefined && Number.isFinite(v))
    },
  }
  const cells: (MetricCell | undefined)[] = []

  switch (state.institution.kind) {
    case 'bank': {
      const pending = ctx.current.facilityPending
      cells.push(
        metricCell(ctx, 'cash'),
        metricCell(ctx, 'facilityHeadroom', {
          sub:
            pending && Number.isFinite(pending.value) && pending.value > 0
              ? `다음 구간 +${formatAt(pending.value, pending.unit, ctx.units, { scale: ctx.scaleFor('facilityHeadroom') })}`
              : undefined,
        }),
        metricCell(ctx, 'dailyOutflow', {
          label: '현재 구간 유출',
          sub: '구간 시작부터 누적 · 구간마다 초기화',
        }),
        metricCell(ctx, 'survivalDays'),
      )
      break
    }
    case 'pension':
      cells.push(
        metricCell(ctx, 'collateralHeadroomBp'),
        metricCell(ctx, 'marginCallPending'),
        metricCell(ctx, 'hedgeRatio'),
        metricCell(ctx, 'liquidAssets'),
      )
      break
    case 'securities':
      cells.push(
        metricCell(ctx, 'ncr'),
        metricCell(ctx, 'abcpMaturing30'),
        metricCell(ctx, 'cash'),
        metricCell(ctx, 'liquidityRatio'),
      )
      break
    default:
      break
  }

  let out = cells.filter((c): c is MetricCell => Boolean(c))
  if (out.length === 0) {
    const primary = scenario.kpis.filter((k) => k.primary)
    const fallback = (primary.length > 0 ? primary : scenario.kpis).slice(0, 4)
    out = fallback.map((k) => metricCell(ctx, k.metric)).filter((c): c is MetricCell => Boolean(c))
  }
  return [...out, legendCell(ctx, state)]
}
