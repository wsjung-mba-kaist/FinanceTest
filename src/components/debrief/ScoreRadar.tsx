import { Fragment, useState } from 'react'
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
import type { ScoreDimension, ScoreReport } from '../../engine/types'
import { SCORE_DIMENSIONS } from '../../engine/types/common'
import { formatNumber } from '../../lib/format'
import { DIMENSION_HELP, DIMENSION_LABELS, DIMENSION_LABELS_SHORT } from '../../lib/labels'
import { Button } from '../ui'
import { InfoTip } from '../ui/InfoTip'
import { useChartType } from '../dashboard/useChartType'

interface Row {
  dim: ScoreDimension
  label: string
  short: string
  score: number
  weight: number
  explanation: string[]
}

function RadarTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  return (
    <div className="max-w-xs rounded-md border border-border bg-surface p-2 text-sm shadow-lg">
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

export function ScoreRadar({
  report,
  forceTable,
}: {
  report: ScoreReport
  /** Printing: render the table so the chart is never measured at zero width. */
  forceTable?: boolean
}) {
  // Chart labels follow the reader's type scale; Recharts takes numbers, not CSS.
  const chart = useChartType()
  const [table, setTable] = useState(false)
  const showTable = forceTable || table
  const rows: Row[] = SCORE_DIMENSIONS.map((d) => ({
    dim: d,
    label: DIMENSION_LABELS[d],
    short: DIMENSION_LABELS_SHORT[d],
    score: Math.round(report.dimensions[d].score),
    weight: report.dimensions[d].weight,
    explanation: report.dimensions[d].explanation,
  }))
  const summary = rows.map((r) => `${r.label} ${r.score}점`).join(', ')
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">7차원 점수</h3>
        {!forceTable && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
          >
            {table ? '차트로 보기' : '표로 보기'}
          </Button>
        )}
      </div>
      {showTable ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
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
                  <td className="py-1 pr-2">
                    <span className="inline-flex items-center gap-1">
                      {r.label}
                      <InfoTip label={`${r.label} 설명`}>{DIMENSION_HELP[r.dim]}</InfoTip>
                    </span>
                  </td>
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
              <PolarAngleAxis
                dataKey="short"
                tick={{ fill: 'var(--text-muted)', fontSize: chart.label }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fill: 'var(--text-muted)', fontSize: chart.tick }}
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
      {/*
        점수의 산출 근거는 엔진이 이미 사람이 읽을 문장으로 만들어 둔다 — 「생존 일수(min) = 0.63
        → 14점」처럼. 그런데 차트 보기에서는 호버 툴팁 안에만 있어서, 마우스로 점 일곱 개를 찾아가며
        하나씩 짚어보지 않는 한 「왜 이 점수인가」에 답할 길이 없었다. 점수를 납득하는 것이 이 페이지의
        일인데 근거는 기본 상태에서 읽혀야 한다. 표 보기에서는 이미 자기 열에 있으므로 중복하지 않는다.
      */}
      {!showTable && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {rows.map((r) => (
            <Fragment key={r.dim}>
              <dt className="text-muted">
                {r.short} <span className="num">{r.score}</span>
              </dt>
              <dd className="m-0 text-muted">{r.explanation.join(' · ')}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}
