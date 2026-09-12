import type { GameState, ScenarioDefinition } from '../../engine/types'
import { scaleFor } from '../../lib/format'
import { kpiComparison, type KpiComparisonRow } from '../../lib/debriefSummary'
import { DataTable, Num, type Column } from '../ui'

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
  const rows = kpiComparison(scenario, state, historical, expert)

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
