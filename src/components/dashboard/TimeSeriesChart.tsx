import { useContext, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { KpiSpec, MetricSnapshot, ThresholdMap, Units } from '../../engine'
import { formatMetric } from '../../lib/format'
import { useReducedMotion } from '../../lib/useMediaQuery'
import { PlayContext } from '../play/playContext'
import { Button, Card, StatusBadge } from '../ui'
import { useChartType } from './useChartType'

/**
 * One selectable KPI across the run, with warn/breach reference lines and a table alternative.
 *
 * During play it also offers a 틱 단위 view drawn from `state.tickHistory`, which is the only
 * place the intraday shape of a ticked turn can be read; the per-turn snapshots stay the default
 * because scoring, conditions and the debrief are all defined on them.
 */
export function TimeSeriesChart({
  kpis,
  history,
  units,
  thresholds,
}: {
  kpis: KpiSpec[]
  history: MetricSnapshot[]
  units: Units
  thresholds: ThresholdMap
}) {
  // Chart labels follow the reader's type scale; Recharts takes numbers, not CSS.
  const chart = useChartType()
  const play = useContext(PlayContext)
  const [metric, setMetric] = useState(kpis[0]?.metric ?? '')
  const [table, setTable] = useState(false)
  const [intraday, setIntraday] = useState(false)
  const reduced = useReducedMotion()
  const spec = kpis.find((k) => k.metric === metric) ?? kpis[0]
  const tickHistory = play?.state.tickHistory ?? []
  const hasIntraday = tickHistory.some((s) => s.tick > 0)
  if (!spec) return null
  const t = thresholds[spec.metric]
  const fmt = (v: number) => formatMetric(v, spec.unit, units, spec.decimals)
  const data =
    intraday && hasIntraday
      ? tickHistory.map((s) => {
          const v = s.values[spec.metric]
          return {
            turn: s.tick > 0 ? `T+${s.turnIndex}.${s.tick}` : `T+${s.turnIndex}`,
            value: v !== undefined && Number.isFinite(v) ? v : null,
            status: 'na' as const,
          }
        })
      : history.map((s) => {
          const mv = s.metrics[spec.metric]
          const v = mv && Number.isFinite(mv.value) ? mv.value : null
          return { turn: `T+${s.turnIndex}`, value: v, status: mv?.status ?? 'na' }
        })
  const nums = data.map((d) => d.value).filter((v): v is number => v !== null)
  if (t) nums.push(t.warn, t.breach)
  const lo = nums.length ? Math.min(...nums) : 0
  const hi = nums.length ? Math.max(...nums) : 1
  const pad = (hi - lo || 1) * 0.08
  // A metric whose observed values *and* thresholds are all non-negative has no negative region to
  // show, and padding the axis below zero invented one: the 생존 일수 chart carried a `−6.8일` tick,
  // which is not a quantity that exists. Metrics that do go negative (경제적 TCE, a negative cash
  // balance) have `lo < 0` and keep their headroom.
  const domain: [number, number] = [lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad]

  return (
    <Card as="section" aria-labelledby="ts-title" className="p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="ts-title" className="text-sm font-semibold">
          지표 시계열
        </h3>
        <select
          aria-label="지표 선택"
          className="rounded-sm border border-border-control bg-bg px-1.5 py-0.5 text-sm"
          value={spec.metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {kpis.map((k) => (
            <option key={k.metric} value={k.metric}>
              {k.label}
            </option>
          ))}
        </select>
        {hasIntraday && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            aria-pressed={intraday}
            onClick={() => setIntraday((v) => !v)}
          >
            {intraday ? '턴 단위' : '틱 단위'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className={hasIntraday ? '' : 'ml-auto'}
          aria-pressed={table}
          onClick={() => setTable((v) => !v)}
        >
          {table ? '차트로 보기' : '표로 보기'}
        </Button>
      </div>
      {table ? (
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{spec.label} 턴별 값</caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-0.5 font-normal">
                  턴
                </th>
                <th scope="col" className="py-0.5 text-right font-normal">
                  {spec.label}
                </th>
                <th scope="col" className="py-0.5 text-right font-normal">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.turn} className="border-t border-border">
                  <td className="num py-0.5">{d.turn}</td>
                  <td className="num py-0.5 text-right">{d.value === null ? '—' : fmt(d.value)}</td>
                  <td className="py-0.5 text-right">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {t && (
            <p className="mt-1 text-xs text-muted">
              경고 {fmt(t.warn)} · 위험 {fmt(t.breach)} (
              {t.direction === 'below' ? '낮을수록 위험' : '높을수록 위험'})
            </p>
          )}
        </div>
      ) : (
        <div
          className="mt-2 h-44"
          role="img"
          aria-label={`${spec.label} 시계열 차트. 표로 보기 버튼으로 값을 확인할 수 있습니다.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="turn"
                tick={{ fontSize: chart.tick, fill: 'var(--text-muted)' }}
                stroke="var(--border)"
                tickLine={false}
              />
              <YAxis
                domain={domain}
                width={56}
                tick={{ fontSize: chart.tick, fill: 'var(--text-muted)' }}
                stroke="var(--border)"
                tickLine={false}
                tickFormatter={(v) => fmt(Number(v))}
              />
              <Tooltip
                formatter={(v) => [fmt(Number(v)), spec.label]}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: chart.label,
                  color: 'var(--text)',
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                isAnimationActive={false}
              />
              {t && (
                <ReferenceLine
                  y={t.warn}
                  stroke="var(--sev-warning)"
                  strokeDasharray="4 2"
                  label={{
                    value: '경고',
                    position: 'insideTopRight',
                    fontSize: chart.tick,
                    fill: 'var(--sev-warning)',
                  }}
                />
              )}
              {t && (
                <ReferenceLine
                  y={t.breach}
                  stroke="var(--sev-critical)"
                  strokeDasharray="4 2"
                  label={{
                    value: '위험',
                    position: 'insideBottomRight',
                    fontSize: chart.tick,
                    fill: 'var(--sev-critical)',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 2, fill: 'var(--accent)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={!reduced}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
