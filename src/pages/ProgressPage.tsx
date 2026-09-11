import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ProgressMap } from '../components/progress/ProgressMap'
import { Badge, Card, EmptyState } from '../components/ui'
import { formatNumber } from '../lib/format'
import {
  DIMENSION_LABELS,
  MASTERY_LEVEL_LABELS,
  MODE_LABELS,
  durationLabel,
  shortDate,
  turnProgressLabel,
} from '../lib/labels'
import { computeMastery, recentRuns, recommendNext } from '../lib/mastery'
import { SCENARIOS, getScenarioSummary } from '../scenarios'
import { useProgressStore } from '../store/progressStore'

export default function ProgressPage() {
  const scenarios = useProgressStore((s) => s.scenarios)
  const learning = useProgressStore((s) => s.learning)
  const lastSaveResult = useProgressStore((s) => s.lastSaveResult)

  const summaries = useMemo(() => SCENARIOS.map((s) => s.summary), [])
  const mastery = useMemo(() => computeMastery(scenarios), [scenarios])
  const next = useMemo(
    () => recommendNext(mastery, summaries, scenarios),
    [mastery, summaries, scenarios],
  )
  const recent = useMemo(() => recentRuns(scenarios, 5), [scenarios])
  const inProgress = useMemo(
    () => summaries.filter((s) => scenarios[s.id]?.inProgress),
    [summaries, scenarios],
  )
  const totalAttempts = Object.values(scenarios).reduce((a, p) => a + p.attempts.length, 0)
  const availableCount = summaries.filter((s) => s.status === 'available').length
  const playedCount = summaries.filter(
    (s) => (scenarios[s.id]?.attempts.length ?? 0) > 0 || scenarios[s.id]?.inProgress,
  ).length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">진행 현황</h1>
        <p className="num text-muted">
          완료 {totalAttempts}회 · 시나리오 {playedCount}/{availableCount}개 · 카드{' '}
          {learning.cardsViewed.length}장 · 용어 {learning.termsViewed.length}개 열람
        </p>
      </header>

      {lastSaveResult !== 'ok' && (
        <p
          className="rounded-md border border-warning/40 bg-warning-bg p-2 text-sm text-warning"
          role="alert"
        >
          {lastSaveResult === 'quota'
            ? '브라우저 저장 공간이 가득 차 진행 데이터를 저장하지 못했습니다. 설정에서 JSON으로 내보내 두세요.'
            : '브라우저 저장소를 사용할 수 없어 진행 데이터가 저장되지 않습니다.'}
        </p>
      )}

      <section aria-labelledby="pg-mastery">
        <h2 id="pg-mastery" className="mb-2 text-md font-semibold">
          역량 숙련도
        </h2>
        <p className="prose-col mb-2 text-sm text-muted">
          최근 5회 플레이의 차원 점수 가중평균 × 모드 계수(안내 0.7 / 표준 1.0 / 전문가 1.2), 포크
          런은 0.8 가중. 레벨: 미평가 → 기초(50 미만) → 숙련(50~75, 시나리오 2개 이상) → 전문(75
          이상, 시나리오 3개 이상, 전문가 모드 1회 포함).
        </p>
        <ProgressMap mastery={mastery} />
      </section>

      <section
        aria-labelledby="pg-next"
        className="rounded-lg border border-accent/40 bg-accent-soft p-3"
      >
        <h2 id="pg-next" className="text-md font-semibold">
          다음 추천
        </h2>
        <p className="prose-col mt-1 text-sm">
          근거가 가장 적은 역량은 <b>{DIMENSION_LABELS[next.competency]}</b>
          {mastery[next.competency].level !== 'none' && (
            <span className="num text-muted">
              {' '}
              ({MASTERY_LEVEL_LABELS[mastery[next.competency].level]},{' '}
              {formatNumber(mastery[next.competency].mastery ?? 0, 0)})
            </span>
          )}
          입니다.
          {next.scenario ? (
            <>
              {' '}
              이 역량을 강조하는 시나리오:{' '}
              <Link to={`/scenarios/${next.scenario.id}`}>{next.scenario.title}</Link> —{' '}
              {next.scenario.roleTitle}
            </>
          ) : (
            ' 플레이 가능한 시나리오가 없습니다.'
          )}
        </p>
      </section>

      {inProgress.length > 0 && (
        <section aria-labelledby="pg-inprogress">
          <h2 id="pg-inprogress" className="mb-2 text-md font-semibold">
            진행 중
          </h2>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {inProgress.map((s) => {
              const run = scenarios[s.id]!.inProgress!
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="font-medium">{s.title}</span>
                  <span className="num text-muted">
                    {turnProgressLabel(run.turnIndex, s.durationTurns)} · {MODE_LABELS[run.mode]}{' '}
                    모드 · 저장 {shortDate(run.updatedAt)}
                  </span>
                  <Link
                    to={`/play/${s.id}`}
                    className="ml-auto inline-flex items-center rounded-md border border-accent bg-accent px-3 py-1 text-sm font-medium text-accent-fg no-underline hover:opacity-90"
                  >
                    이어하기
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="pg-recent">
        <h2 id="pg-recent" className="mb-2 text-md font-semibold">
          최근 플레이 5회
        </h2>
        {recent.length === 0 ? (
          <EmptyState title="아직 완료한 플레이가 없습니다">
            <p>한 편을 끝내면 점수와 역량이 여기에 쌓입니다.</p>
            <p className="mt-2">
              <Link to="/">카탈로그에서 시나리오 고르기</Link>
            </p>
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">최근 완료한 플레이</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-3 py-2 font-medium">시나리오</th>
                  <th className="num px-3 py-2 font-medium">점수</th>
                  <th className="px-3 py-2 font-medium">모드</th>
                  <th className="num px-3 py-2 font-medium">소요</th>
                  <th className="num px-3 py-2 font-medium">완료</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map(({ scenarioId, attempt }) => {
                  const s = getScenarioSummary(scenarioId)
                  return (
                    <tr
                      key={`${attempt.runId}-${scenarioId}`}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="px-3 py-2">
                        <Link to={`/scenarios/${scenarioId}`}>{s?.title ?? scenarioId}</Link>
                      </td>
                      <td className="num px-3 py-2">
                        {formatNumber(attempt.total, 1)}{' '}
                        <span className="text-muted">({attempt.grade})</span>
                        {attempt.failed && (
                          <Badge tone="critical" className="ml-1">
                            실패
                          </Badge>
                        )}
                        {attempt.forkedFrom && (
                          <Badge tone="neutral" className="ml-1">
                            포크
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{MODE_LABELS[attempt.mode]}</td>
                      <td className="num px-3 py-2 text-muted">
                        {durationLabel(attempt.durationSec)}
                      </td>
                      <td className="num px-3 py-2 text-muted">{shortDate(attempt.completedAt)}</td>
                      <td className="px-3 py-2">
                        <Link to={`/debrief/${scenarioId}`}>디브리핑</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <p className="text-sm text-muted">
        모든 데이터는 이 브라우저에만 저장됩니다. 내보내기·가져오기·기록 삭제는{' '}
        <Link to="/settings">설정 › 데이터</Link>에 있습니다.
      </p>
    </div>
  )
}
