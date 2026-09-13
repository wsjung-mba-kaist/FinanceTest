import { Link } from 'react-router-dom'
import type { GameState, Mode, ScenarioDefinition, ScoreReport } from '../../engine/types'
import { formatAt, formatNumber, scaleFor } from '../../lib/format'
import { MODE_LABELS } from '../../lib/labels'
import { mergeThresholds } from '../../metrics/thresholds'
import {
  bestDecision,
  headline,
  kpiComparison,
  largestExpertGap,
  worstDecision,
  type DecisionHighlight,
  type Regret,
} from '../../lib/debriefSummary'
import { Badge, Button, Card } from '../ui'
import { buttonClass } from '../ui/buttonStyles'
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
  const border = tone === 'positive' ? 'border-positive-border' : 'border-warning-border'
  return (
    <Card as="article" className={`p-3 ${border}`}>
      <h3 className="flex items-center gap-2 text-md font-semibold">
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
            <p className="mt-2 rounded-md border border-warning-border bg-warning-bg p-2 text-sm text-warning">
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
  const gap = largestExpertGap(rows, mergeThresholds(scenario.thresholds))
  const gapScale =
    gap && gap.row.kpi.unit === 'ccy'
      ? scaleFor([gap.player, gap.expert], scenario.units)
      : undefined

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
        <Card tier="key" className="px-4 py-3 text-right" aria-label="종합 점수">
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

      {/*
        One sentence where a three-column table used to be. The table is still on the page — it
        moved to 경로 비교, where comparing is the tab's whole job — but the summary's job is to
        answer "how did it go" before the reader has to scan anything. Fixed height so the
        headline does not jump when the background autoplays land.
      */}
      <p className="prose-col min-h-[3.2em] text-base" role="status">
        {computing ? (
          <span className="text-muted">전문가 경로와 비교하는 중…</span>
        ) : gap ? (
          <>
            전문가 경로와 가장 크게 갈린 지표는{' '}
            <span className="font-semibold">{gap.row.kpi.label}</span>입니다 — 귀하{' '}
            {/*
              비교표와 같은 스케일로 쓴다. 값마다 단위를 고르면 같은 사실이 한 페이지에서
              「−$959.7M」과 「−$1.0B」 두 번 적히고, 독자는 둘이 같은 수치인지 확인해야 한다.
            */}
            <span className="num font-semibold">
              {formatAt(gap.player, gap.row.kpi.unit, scenario.units, {
                scale: gapScale,
                decimals: gap.row.kpi.decimals,
              })}
            </span>
            , 전문가{' '}
            <span className="num">
              {formatAt(gap.expert, gap.row.kpi.unit, scenario.units, {
                scale: gapScale,
                decimals: gap.row.kpi.decimals,
              })}
            </span>
            .{' '}
            {/*
              어느 쪽이 더 나은지를 말하지 않던 것은 `KpiSpec`에 방향이 없어서였는데,
              `Threshold.direction`에는 있다. 임계값이 있는 지표에서만 말하고 없으면 침묵한다.
            */}
            {gap.direction !== 'neutral' && (
              <span className={gap.direction === 'better' ? 'text-positive' : 'text-critical'}>
                {gap.direction === 'better'
                  ? '비교 시점의 귀하 지표가 경고선에서 더 여유가 있습니다. '
                  : '비교 시점의 전문가 지표가 경고선에서 더 여유가 있습니다. '}
              </span>
            )}
            <Link to="#paths">경로 비교에서 나머지 지표 보기</Link>
          </>
        ) : (
          <>비교 시점의 핵심 지표는 전문가 경로와 사실상 같습니다.</>
        )}
      </p>

      <section aria-labelledby="dbf-highlights-h">
        <h2 id="dbf-highlights-h" className="text-lg font-semibold">
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

      {/* Where to go next, named — a debrief that ends in a full stop ends the session. */}
      <nav aria-label="다음 단계" className="flex flex-wrap gap-2" data-noprint>
        {worst && (
          <Button variant="primary" onClick={() => onFork(worst.turnIndex)}>
            {worst.turnLabel}부터 다시 하기
          </Button>
        )}
        <Link to="#mistakes" className={buttonClass({ variant: 'secondary' })}>
          실수와 what-if 보기
        </Link>
        <Link to="#lessons" className={buttonClass({ variant: 'secondary' })}>
          교훈 읽기
        </Link>
      </nav>
    </div>
  )
}
