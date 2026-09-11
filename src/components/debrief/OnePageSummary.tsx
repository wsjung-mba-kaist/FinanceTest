import type { GameState, Mode, ScenarioDefinition, ScoreReport } from '../../engine/types'
import { formatMetric, formatNumber } from '../../lib/format'
import { MODE_LABELS } from '../../lib/labels'
import {
  bestDecision,
  headline,
  kpiComparison,
  worstDecision,
  type DecisionHighlight,
  type Regret,
} from '../../lib/debriefSummary'
import { Badge, Button, Card } from '../ui'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

function HighlightCard({
  tone,
  title,
  highlight,
  empty,
  onFork,
}: {
  tone: 'positive' | 'warning'
  title: string
  highlight: DecisionHighlight | undefined
  empty: string
  onFork?: (turnIndex: number) => void
}) {
  const border = tone === 'positive' ? 'border-positive/40' : 'border-warning/40'
  return (
    <Card as="article" className={`p-3 ${border}`}>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Badge tone={tone}>{title}</Badge>
      </h3>
      {!highlight ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="num text-sm text-muted">{highlight.turnLabel}</span>
            <span className="font-medium">{highlight.decisionTitle}</span>
            {highlight.regret > 0 && (
              <Badge tone="critical" className="num">
                후회 {Math.round(highlight.regret)}점
              </Badge>
            )}
          </p>
          <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted">선택</dt>
            <dd className="m-0">
              {highlight.chosen.map((c) => (
                <div key={c.id}>
                  {c.label} <span className="num text-muted">({c.rating}점)</span>
                </div>
              ))}
            </dd>
            {highlight.best && (
              <>
                <dt className="text-muted">전문가</dt>
                <dd className="m-0">
                  {highlight.best.label}{' '}
                  <span className="num text-muted">({highlight.best.rating}점)</span>
                  {highlight.best.why && <div className="text-muted">{highlight.best.why}</div>}
                </dd>
              </>
            )}
          </dl>
          {highlight.trapExplanation && (
            <p className="mt-2 rounded-md border border-warning/40 bg-warning-bg p-2 text-sm text-warning">
              <InlineMarkdown>{highlight.trapExplanation}</InlineMarkdown>
            </p>
          )}
          {onFork && (
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={() => onFork(highlight.turnIndex)}>
                T+{highlight.turnIndex}부터 다시 하기
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

/**
 * The one screen a reader should get from a finished run: outcome, score, the three primary KPIs
 * against the historical and expert paths, and the two decisions that mattered most.
 */
export function OnePageSummary({
  scenario,
  state,
  report,
  mode,
  historical,
  expert,
  regrets,
  computing,
  onFork,
  badges,
}: {
  scenario: ScenarioDefinition
  state: GameState
  report: ScoreReport
  mode: Mode
  historical: GameState | undefined
  expert: GameState | undefined
  regrets: Regret[]
  /** The historical/expert autoplays are still running. */
  computing: boolean
  onFork: (turnIndex: number) => void
  badges?: React.ReactNode
}) {
  const h = headline(state, scenario)
  const rows = kpiComparison(scenario, state, historical, expert)
  const best = bestDecision(scenario, state, regrets)
  const worst = worstDecision(scenario, state, regrets)
  const fmt = (v: number | undefined, kpi: (typeof rows)[number]['kpi']) =>
    v === undefined
      ? computing
        ? '계산 중…'
        : '—'
      : formatMetric(v, kpi.unit, scenario.units, kpi.decimals)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={h.tone}>{h.outcomeLabel}</Badge>
            <Badge tone="neutral">{MODE_LABELS[mode]} 모드</Badge>
            {badges}
          </div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight">{h.title}</h1>
          {h.lead && <p className="prose-col mt-1 text-muted">{h.lead}</p>}
          {h.turnLabel && (
            <p className="num mt-1 text-sm text-muted">
              종료 시점 {h.turnLabel}
              {h.timeLabel ? ` · ${h.timeLabel}` : ''}
            </p>
          )}
        </div>
        <Card className="card-key px-4 py-3 text-right" aria-label="종합 점수">
          <div className="label-caps">종합 점수</div>
          <div className="num-lg mt-0.5">
            {formatNumber(report.total, 1)}
            <span className="ml-2 text-lg text-muted">{report.grade}</span>
          </div>
          <div className="num mt-1 text-sm text-muted">
            전문가 정합 {formatNumber(report.expertAlignment, 0)} · 힌트 −
            {formatNumber(report.hintPenalty, 0)} · 초과 {report.timeoutCount}회
          </div>
        </Card>
      </div>

      <section aria-labelledby="dbf-kpi-h">
        <h2 id="dbf-kpi-h" className="text-md font-semibold">
          핵심 지표 — 귀하 / 역사 / 전문가
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface">
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

      <section aria-labelledby="dbf-highlights-h">
        <h2 id="dbf-highlights-h" className="text-md font-semibold">
          결정 두 가지
        </h2>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <HighlightCard
            tone="positive"
            title="가장 잘한 결정"
            highlight={best}
            empty="전문가 권고와 일치한 결정이 없습니다."
          />
          <HighlightCard
            tone="warning"
            title="가장 아쉬운 결정"
            highlight={worst}
            empty="모든 결정에서 최선의 옵션을 선택했습니다."
            onFork={onFork}
          />
        </div>
      </section>
    </div>
  )
}
