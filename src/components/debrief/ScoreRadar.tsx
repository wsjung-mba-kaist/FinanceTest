import { useState } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts'
import type { ScoreReport } from '../../engine/types'
import { SCORE_DIMENSIONS } from '../../engine/types/common'
import { formatNumber } from '../../lib/format'
import { DIMENSION_LABELS } from '../../lib/labels'
import { Button } from '../ui'

interface Row {
  dim: string
  label: string
  score: number
  weight: number
  explanation: string[]
}

function RadarTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  return (
    <div className="max-w-xs rounded-md border border-border bg-surface p-2 text-[12px] shadow-lg">
      <div className="font-semibold">
        {row.label} <span className="text-muted font-normal num">가중치 {row.weight}%</span>
      </div>
      <div className="num">{formatNumber(row.score, 0)}점</div>
      {row.explanation.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-muted">
          {row.explanation.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ScoreRadar({ report }: { report: ScoreReport }) {
  const [table, setTable] = useState(false)
  const rows: Row[] = SCORE_DIMENSIONS.map((d) => ({
    dim: d,
    label: DIMENSION_LABELS[d],
    score: Math.round(report.dimensions[d].score),
    weight: report.dimensions[d].weight,
    explanation: report.dimensions[d].explanation,
  }))
  const summary = rows.map((r) => `${r.label} ${r.score}점`).join(', ')
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">7차원 점수</h3>
        <Button size="sm" variant="ghost" aria-pressed={table} onClick={() => setTable((v) => !v)}>
          {table ? '차트로 보기' : '표로 보기'}
        </Button>
      </div>
      {table ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12px]">
            <caption className="sr-only">차원별 점수</caption>
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-1 pr-2 font-medium">차원</th>
                <th className="py-1 pr-2 font-medium num">점수</th>
                <th className="py-1 pr-2 font-medium num">가중치</th>
                <th className="py-1 font-medium">산출 근거</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dim} className="border-b border-border/60 last:border-0 align-top">
                  <td className="py-1 pr-2">{r.label}</td>
                  <td className="py-1 pr-2 num">{r.score}</td>
                  <td className="py-1 pr-2 num">{r.weight}%</td>
                  <td className="py-1 text-muted">
                    {r.explanation.map((e, i) => (
                      <div key={i}>{e}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure className="m-0 mt-2" role="img" aria-label={`7차원 점수 레이더: ${summary}`}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={rows} outerRadius="70%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
              />
              <Radar
                name="점수"
                dataKey="score"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="var(--accent)"
                fillOpacity={0.15}
                dot={{ r: 3, fill: 'var(--accent)' }}
                isAnimationActive={false}
              />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <figcaption className="sr-only">{summary}</figcaption>
        </figure>
      )}
    </div>
  )
}
