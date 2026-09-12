import { useState } from 'react'
import type { GameState, ScenarioDefinition } from '../../engine/types'
import { scaleFor } from '../../lib/format'
import { kpiComparison, type KpiComparisonRow } from '../../lib/debriefSummary'
import { Button, DataTable, Num, type Column } from '../ui'
import { Sparkline } from '../dashboard/Sparkline'

/**
 * 귀하 / 역사 / 전문가 side by side.
 *
 * This used to sit in the one-page summary, where it was the tallest thing on a page meant to be
 * read in one screen — and where "계산 중…" appeared in its cells while the background autoplays
 * ran, directly under the headline. Comparing paths is the 경로 비교 tab's entire job, so it
 * lives there; the summary states the single biggest divergence in a sentence instead.
 *
 * Each *row* fixes its own currency scale across the three paths it compares. Letting every cell
 * pick its own unit is what made this table unreadable as a comparison: 귀하 3.2조원 beside
 * 전문가 8,500억원 asks the reader to do the arithmetic the table exists to save them.
 */
export function KpiComparisonTable({
  scenario,
  state,
  historical,
  expert,
  computing,
}: {
  scenario: ScenarioDefinition
  state: GameState
  historical: GameState | undefined
  expert: GameState | undefined
  /** The historical/expert autoplays are still running. */
  computing: boolean
}) {
  // `all`: the primaries are the headline, and the rest are what a reader reaches for when the
  // headline raises a question. The timeline's <select> has had them all along; a table is the
  // shape for comparing ten metrics across three paths.
  const [showRest, setShowRest] = useState(false)
  const all = kpiComparison(scenario, state, historical, expert, { all: true })
  const primary = all.filter((r) => r.kpi.primary)
  const rows = primary.length > 0 ? primary : all.slice(0, 3)
  const rest = all.filter((r) => !rows.includes(r))

  /** One scale per row, chosen from whichever of the three paths ran furthest. */
  const scaleOf = (r: KpiComparisonRow) =>
    r.kpi.unit === 'ccy'
      ? scaleFor(
          [r.player, r.historical, r.expert].filter((v): v is number => v !== undefined),
          scenario.units,
        )
      : undefined

  const cell = (r: KpiComparisonRow, v: number | undefined, className: string) =>
    v === undefined ? (
      <span className={computing ? 'text-muted' : 'num text-muted'}>{computing ? '계산 중…' : '—'}</span>
    ) : (
      <span className={className}>
        <Num
          value={v}
          unit={r.kpi.unit}
          units={scenario.units}
          scale={scaleOf(r)}
          decimals={r.kpi.decimals}
        />
      </span>
    )

  const columns: Column<KpiComparisonRow>[] = [
    {
      key: 'kpi',
      label: '지표',
      render: (r) => (
        <>
          <span>{r.kpi.label}</span>
          {/* The reference the number is judged against — authored, and until now never shown here. */}
          {r.kpi.referenceLabel && (
            <span className="ml-1.5 text-xs text-muted">{r.kpi.referenceLabel}</span>
          )}
        </>
      ),
    },
    { key: 'player', label: '귀하', align: 'right', render: (r) => cell(r, r.player, 'font-semibold') },
    { key: 'historical', label: '역사', align: 'right', render: (r) => cell(r, r.historical, 'text-muted') },
    { key: 'expert', label: '전문가', align: 'right', render: (r) => cell(r, r.expert, 'text-muted') },
    {
      key: 'trend',
      label: '귀하의 경로',
      align: 'right',
      // A final value says where the run stopped; it cannot say whether the metric fell all the way
      // there or fell and was pulled back. The history is already in hand on this page.
      render: (r) =>
        r.series.length >= 2 ? (
          <Sparkline
            values={r.series}
            width={80}
            height={22}
            ariaLabel={`${r.kpi.label} 턴별 추이`}
          />
        ) : null,
    },
  ]

  return (
    <section aria-labelledby="dbf-kpi-h">
      <h2 id="dbf-kpi-h" className="text-lg font-semibold">
        핵심 지표 — 귀하 / 역사 / 전문가
      </h2>
      <div className="mt-2">
        <DataTable
          caption="핵심 지표 최종값을 플레이어·역사 경로·전문가 경로로 비교"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.kpi.metric}
        />
      </div>
      {rest.length > 0 && (
        <div className="mt-2">
          <Button size="sm" variant="ghost" aria-expanded={showRest} onClick={() => setShowRest((v) => !v)}>
            {showRest ? '접기' : `나머지 지표 ${rest.length}건 더 보기`}
          </Button>
          {showRest && (
            <div className="mt-1">
              <DataTable
                caption="보조 지표 최종값 비교"
                columns={columns}
                rows={rest}
                rowKey={(r) => r.kpi.metric}
              />
            </div>
          )}
        </div>
      )}
      {computing && (
        <p className="mt-1 text-sm text-muted" role="status">
          역사·전문가 경로를 계산 중…
        </p>
      )}
      {scenario.paths.historical.note && (
        <p className="prose-col mt-2 text-sm text-muted">
          <span className="font-medium">역사 경로:</span> {scenario.paths.historical.note}
        </p>
      )}
      {scenario.paths.expert?.note && (
        <p className="prose-col mt-1 text-sm text-muted">
          <span className="font-medium">전문가 경로:</span> {scenario.paths.expert.note}
        </p>
      )}
    </section>
  )
}
