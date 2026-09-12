import type { GameState, ScenarioDefinition } from '../../engine/types'
import { formatMetric } from '../../lib/format'
import { kpiComparison } from '../../lib/debriefSummary'
import { Card } from '../ui'

/**
 * 귀하 / 역사 / 전문가 side by side.
 *
 * This used to sit in the one-page summary, where it was the tallest thing on a page meant to be
 * read in one screen — and where "계산 중…" appeared in its cells while the background autoplays
 * ran, directly under the headline. Comparing paths is the 경로 비교 tab's entire job, so it
 * lives there; the summary states the single biggest divergence in a sentence instead.
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
  const fmt = (v: number | undefined, kpi: (typeof rows)[number]['kpi']) =>
    v === undefined
      ? computing
        ? '계산 중…'
        : '—'
      : formatMetric(v, kpi.unit, scenario.units, kpi.decimals)

  return (
    <section aria-labelledby="dbf-kpi-h">
      <h2 id="dbf-kpi-h" className="text-lg font-semibold">
        핵심 지표 — 귀하 / 역사 / 전문가
      </h2>
      <Card as="div" className="mt-2 overflow-x-auto">
        <table className="w-full text-base">
          <caption className="sr-only">
            핵심 지표 최종값을 플레이어·역사 경로·전문가 경로로 비교
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-3 py-2 font-medium">지표</th>
              <th className="num px-3 py-2 font-medium">귀하</th>
              <th className="num px-3 py-2 font-medium">역사</th>
              <th className="num px-3 py-2 font-medium">전문가</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kpi.metric} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">{r.kpi.label}</td>
                <td className="num px-3 py-2 font-semibold">{fmt(r.player, r.kpi)}</td>
                <td className="num px-3 py-2 text-muted">{fmt(r.historical, r.kpi)}</td>
                <td className="num px-3 py-2 text-muted">{fmt(r.expert, r.kpi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
