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
import type { Competency } from '../../engine/types'
import { formatNumber } from '../../lib/format'
import {
  COMPETENCIES,
  DIMENSION_HELP,
  DIMENSION_LABELS,
  DIMENSION_LABELS_SHORT,
  MASTERY_LEVEL_LABELS,
  MODE_LABELS,
  shortDate,
} from '../../lib/labels'
import type { CompetencyMastery } from '../../lib/mastery'
import { getScenarioSummary } from '../../scenarios'
import { Badge, Button, type Tone } from '../ui'
import { InfoTip } from '../ui/InfoTip'

const LEVEL_TONE: Record<CompetencyMastery['level'], Tone> = {
  none: 'neutral',
  basic: 'info',
  proficient: 'warning',
  expert: 'positive',
}

interface Row {
  competency: Competency
  label: string
  short: string
  value: number
  level: CompetencyMastery['level']
  n: number
}

function MapTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-border bg-surface p-2 text-sm shadow-lg">
      <div className="font-semibold">{row.label}</div>
      <div className="num">
        {row.level === 'none'
          ? '미평가'
          : `${formatNumber(row.value, 0)} · ${MASTERY_LEVEL_LABELS[row.level]}`}{' '}
        <span className="text-muted">(근거 {row.n}건)</span>
      </div>
    </div>
  )
}

function EvidenceList({ m }: { m: CompetencyMastery }) {
  const [open, setOpen] = useState(false)
  if (m.evidence.length === 0)
    return (
      <p className="text-sm text-muted">아직 근거가 없습니다. 시나리오를 완료하면 반영됩니다.</p>
    )
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="border-0 bg-transparent p-0 text-sm text-accent underline-offset-2 hover:underline"
      >
        {open ? '근거 접기' : '근거 보기'} <span className="num">({m.evidence.length}건)</span>
      </button>
      {open && (
        <ul className="mt-1 list-none space-y-0.5 p-0 m-0 text-xs text-muted">
          {m.evidence.map((e) => (
            <li key={`${e.runId}-${e.scenarioId}`} className="num">
              {getScenarioSummary(e.scenarioId)?.title ?? e.scenarioId} · {MODE_LABELS[e.mode]} ·{' '}
              {formatNumber(e.score, 0)}점{e.forked && ' · 포크(×0.8)'} · {shortDate(e.completedAt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProgressMap({ mastery }: { mastery: Record<Competency, CompetencyMastery> }) {
  const [table, setTable] = useState(false)
  const rows: Row[] = COMPETENCIES.map((c) => ({
    competency: c,
    label: DIMENSION_LABELS[c],
    short: DIMENSION_LABELS_SHORT[c],
    value: Math.round(mastery[c].mastery ?? 0),
    level: mastery[c].level,
    n: mastery[c].evidence.length,
  }))
  const summary = rows
    .map(
      (r) =>
        `${r.label} ${r.level === 'none' ? '미평가' : `${r.value}(${MASTERY_LEVEL_LABELS[r.level]})`}`,
    )
    .join(', ')
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">역량 맵</h3>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
          >
            {table ? '차트로 보기' : '표로 보기'}
          </Button>
        </div>
        {table ? (
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">역량별 숙련도</caption>
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-1 pr-2 font-medium">역량</th>
                <th className="py-1 pr-2 font-medium num">숙련도</th>
                <th className="py-1 pr-2 font-medium">레벨</th>
                <th className="py-1 font-medium num">근거</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.competency} className="border-b border-border/60 last:border-0">
                  <td className="py-1 pr-2">{r.label}</td>
                  <td className="py-1 pr-2 num">{r.level === 'none' ? '—' : r.value}</td>
                  <td className="py-1 pr-2">{MASTERY_LEVEL_LABELS[r.level]}</td>
                  <td className="py-1 num">{r.n}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <figure className="m-0 mt-2" role="img" aria-label={`역량 맵 레이더: ${summary}`}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={rows} outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="short"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                />
                <Radar
                  name="숙련도"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="var(--accent)"
                  fillOpacity={0.15}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                  isAnimationActive={false}
                />
                <Tooltip content={<MapTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
            <figcaption className="sr-only">{summary}</figcaption>
          </figure>
        )}
      </div>
      <ul className="m-0 list-none space-y-2 p-0">
        {COMPETENCIES.map((c) => {
          const m = mastery[c]
          const v = m.mastery ?? 0
          return (
            <li key={c} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{DIMENSION_LABELS[c]}</span>
                <InfoTip label={`${DIMENSION_LABELS[c]} 설명`}>{DIMENSION_HELP[c]}</InfoTip>
                <Badge tone={LEVEL_TONE[m.level]}>{MASTERY_LEVEL_LABELS[m.level]}</Badge>
                <span className="ml-auto num text-sm text-muted">
                  {m.mastery === undefined ? '—' : `${formatNumber(v, 0)} / 100`}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(v)}
                aria-label={`${DIMENSION_LABELS[c]} 숙련도`}
              >
                <div
                  className="h-full rounded bg-accent"
                  style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted num">
                시나리오 {m.scenarioCount}개 · 전문가 모드 {m.hasExpertRun ? '있음' : '없음'}
              </div>
              <div className="mt-1">
                <EvidenceList m={m} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
