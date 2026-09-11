import { useId, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import type { GameState, KpiSpec, ScenarioDefinition } from '../../engine/types'
import { formatMetric } from '../../lib/format'
import { Button } from '../ui'

interface Point {
  turn: number
  label: string
  player?: number
  historical?: number
  expert?: number
  decided: boolean
}

function seriesOf(state: GameState | undefined, metric: string): Map<number, number> {
  const out = new Map<number, number>()
  if (!state) return out
  for (const snap of state.metricsHistory) {
    const m = snap.metrics[metric]
    if (m && m.status !== 'na' && Number.isFinite(m.value)) out.set(snap.turnIndex, m.value)
  }
  return out
}

export function DebriefTimeline({
  scenario,
  state,
  historical,
  expert,
  onMarkerClick,
}: {
  scenario: ScenarioDefinition
  state: GameState
  historical: GameState | undefined
  expert: GameState | undefined
  onMarkerClick?: (turnIndex: number) => void
}) {
  const kpis = scenario.kpis
  const [metric, setMetric] = useState(
    () => kpis.find((k) => k.primary)?.metric ?? kpis[0]?.metric ?? 'confidence',
  )
  const [table, setTable] = useState(false)
  const selectId = useId()
  const kpi: KpiSpec = kpis.find((k) => k.metric === metric) ?? {
    metric,
    label: metric,
    unit: 'index',
  }
  const fmt = (v: number | undefined) =>
    v === undefined ? '—' : formatMetric(v, kpi.unit, scenario.units, kpi.decimals)

  const data = useMemo<Point[]>(() => {
    const p = seriesOf(state, metric)
    const h = seriesOf(historical, metric)
    const e = seriesOf(expert, metric)
    const decided = new Set(state.decisions.map((d) => d.turnIndex))
    return scenario.turns.map((t, i) => ({
      turn: i,
      label: t.label,
      player: p.get(i),
      historical: h.get(i),
      expert: e.get(i),
      decided: decided.has(i),
    }))
  }, [scenario, state, historical, expert, metric])

  const failed = Boolean(state.ended?.failed)
  const endTurn = state.ended?.turnIndex
  const lastTurn = scenario.turns.length - 1
  const threshold = scenario.thresholds?.[metric]
  const markers = data.filter((d) => d.decided && d.player !== undefined)

  const TimelineTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-md border border-border bg-surface p-2 text-[12px] shadow-lg">
        <div className="font-semibold">{label}</div>
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex justify-between gap-3">
            <span className="text-muted">{p.name}</span>
            <span className="num">{fmt(typeof p.value === 'number' ? p.value : undefined)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">경로 비교</h3>
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-[12px] text-muted">
            지표
          </label>
          <select
            id={selectId}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1 text-[12px]"
          >
            {kpis.map((k) => (
              <option key={k.metric} value={k.metric}>
                {k.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
          >
            {table ? '차트로 보기' : '표로 보기'}
          </Button>
        </div>
      </div>

      {table ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12px]">
            <caption className="sr-only">{kpi.label} 턴별 비교</caption>
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-1 pr-2 font-medium">턴</th>
                <th className="py-1 pr-2 font-medium num">플레이어</th>
                <th className="py-1 pr-2 font-medium num">역사</th>
                <th className="py-1 pr-2 font-medium num">전문가</th>
                <th className="py-1 font-medium">결정</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.turn} className="border-b border-border/60 last:border-0">
                  <td className="py-1 pr-2">{d.label}</td>
                  <td className="py-1 pr-2 num">{fmt(d.player)}</td>
                  <td className="py-1 pr-2 num">{fmt(d.historical)}</td>
                  <td className="py-1 pr-2 num">{fmt(d.expert)}</td>
                  <td className="py-1">
                    {d.decided && (
                      <button
                        type="button"
                        className="text-accent underline-offset-2 hover:underline bg-transparent border-0 p-0"
                        onClick={() => onMarkerClick?.(d.turn)}
                      >
                        결정 보기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <figure
            className="m-0 mt-2"
            role="img"
            aria-label={`${kpi.label} 턴별 추이: 플레이어·역사·전문가 경로 비교${failed && endTurn !== undefined ? `, 플레이어 경로는 ${scenario.turns[endTurn]?.label ?? `T${endTurn}`}에서 종료` : ''}`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => fmt(v)}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<TimelineTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {threshold && (
                  <ReferenceLine
                    y={threshold.breach}
                    stroke="var(--sev-critical)"
                    strokeDasharray="4 4"
                    label={{
                      value: '위험',
                      fill: 'var(--text-muted)',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                )}
                {threshold && (
                  <ReferenceLine
                    y={threshold.warn}
                    stroke="var(--sev-warning)"
                    strokeDasharray="4 4"
                    label={{
                      value: '경고',
                      fill: 'var(--text-muted)',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                )}
                {failed && endTurn !== undefined && endTurn < lastTurn && (
                  <ReferenceArea
                    x1={scenario.turns[endTurn]?.label}
                    x2={scenario.turns[lastTurn]?.label}
                    fill="var(--surface-2)"
                    fillOpacity={0.6}
                    label={{ value: '종료 이후', fill: 'var(--text-muted)', fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="historical"
                  name="역사"
                  stroke="var(--text-muted)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="expert"
                  name="전문가"
                  stroke="var(--sev-positive)"
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="player"
                  name="플레이어"
                  stroke={failed ? 'var(--sev-critical)' : 'var(--accent)'}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                  connectNulls
                />
                {markers.map((m) => (
                  <ReferenceDot
                    key={m.turn}
                    x={m.label}
                    y={m.player as number}
                    r={7}
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    onClick={() => onMarkerClick?.(m.turn)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </figure>
          {markers.length > 0 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-1 text-[12px]"
              role="group"
              aria-label="결정 지점"
            >
              <span className="text-muted">결정 지점:</span>
              {markers.map((m) => (
                <Button
                  key={m.turn}
                  size="sm"
                  variant="ghost"
                  onClick={() => onMarkerClick?.(m.turn)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
