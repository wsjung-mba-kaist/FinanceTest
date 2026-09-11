import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressMap } from '../components/progress/ProgressMap'
import { Badge, Button, ConfirmDialog, EmptyState } from '../components/ui'
import { downloadJson, stampedFilename } from '../lib/download'
import { formatNumber } from '../lib/format'
import {
  DIMENSION_LABELS,
  MASTERY_LEVEL_LABELS,
  MODE_LABELS,
  durationLabel,
  shortDate,
  turnProgressLabel,
} from '../lib/labels'
import { computeMastery, recommendNext } from '../lib/mastery'
import { progressStateSchema, type ProgressState } from '../persistence/schema'
import { SCENARIOS } from '../scenarios'
import { useProgressStore } from '../store/progressStore'

export default function ProgressPage() {
  const scenarios = useProgressStore((s) => s.scenarios)
  const learning = useProgressStore((s) => s.learning)
  const exportState = useProgressStore((s) => s.export)
  const importState = useProgressStore((s) => s.importState)
  const clearScenario = useProgressStore((s) => s.clearScenario)
  const lastSaveResult = useProgressStore((s) => s.lastSaveResult)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ProgressState | undefined>()
  const [importError, setImportError] = useState<string | undefined>()
  const [importOk, setImportOk] = useState(false)
  const [clearId, setClearId] = useState<string | undefined>()

  const summaries = useMemo(() => SCENARIOS.map((s) => s.summary), [])
  const mastery = useMemo(() => computeMastery(scenarios), [scenarios])
  const next = useMemo(
    () => recommendNext(mastery, summaries, scenarios),
    [mastery, summaries, scenarios],
  )
  const totalAttempts = Object.values(scenarios).reduce((a, p) => a + p.attempts.length, 0)
  const played = summaries.filter(
    (s) => (scenarios[s.id]?.attempts.length ?? 0) > 0 || scenarios[s.id]?.inProgress,
  )
  const quizRows = summaries.filter((s) => scenarios[s.id]?.quiz)

  const onExport = () => downloadJson(stampedFilename('fcs-progress'), exportState())

  const onFile = (file: File | undefined) => {
    setImportError(undefined)
    setImportOk(false)
    if (!file) return
    file
      .text()
      .then((text) => {
        const parsed = progressStateSchema.safeParse(JSON.parse(text))
        if (!parsed.success) {
          setImportError(
            `형식이 올바르지 않습니다: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}`,
          )
          return
        }
        setPendingImport(parsed.data)
      })
      .catch((e: unknown) =>
        setImportError(`파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : String(e)}`),
      )
      .finally(() => {
        if (fileRef.current) fileRef.current.value = ''
      })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">진행 현황</h1>
          <p className="text-muted num">
            완료 {totalAttempts}회 · 시나리오 {played.length}/
            {summaries.filter((s) => s.status === 'available').length}개 · 카드{' '}
            {learning.cardsViewed.length}장 · 용어 {learning.termsViewed.length}개 열람
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onExport}>
            내보내기 (JSON)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            가져오기 (JSON)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="진행 데이터 파일 선택"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </header>

      {lastSaveResult !== 'ok' && (
        <p
          className="rounded-md border border-warning/40 bg-warning-bg p-2 text-[12px] text-warning"
          role="alert"
        >
          {lastSaveResult === 'quota'
            ? '브라우저 저장 공간이 가득 차 진행 데이터를 저장하지 못했습니다. JSON으로 내보내 두세요.'
            : '브라우저 저장소를 사용할 수 없어 진행 데이터가 저장되지 않습니다.'}
        </p>
      )}
      {importError && (
        <p
          className="rounded-md border border-critical/40 bg-critical-bg p-2 text-[12px] text-critical"
          role="alert"
        >
          {importError}
        </p>
      )}
      {importOk && (
        <p
          className="rounded-md border border-positive/40 bg-positive-bg p-2 text-[12px] text-positive"
          role="status"
        >
          진행 데이터를 가져왔습니다.
        </p>
      )}

      <section aria-labelledby="pg-mastery">
        <h2 id="pg-mastery" className="mb-2 text-[16px] font-semibold">
          역량 숙련도
        </h2>
        <p className="mb-2 text-[12px] text-muted">
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
        <h2 id="pg-next" className="text-[14px] font-semibold">
          다음 추천
        </h2>
        <p className="mt-1 text-[12px]">
          근거가 가장 적은 역량은 <b>{DIMENSION_LABELS[next.competency]}</b>
          {mastery[next.competency].level !== 'none' && (
            <span className="text-muted num">
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

      <section aria-labelledby="pg-scenarios">
        <h2 id="pg-scenarios" className="mb-2 text-[16px] font-semibold">
          시나리오 기록
        </h2>
        {played.length === 0 ? (
          <EmptyState title="아직 플레이 기록이 없습니다">
            <Link to="/">카탈로그에서 시나리오를 선택하세요</Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-[12px]">
              <caption className="sr-only">시나리오별 최고 점수와 시도 횟수</caption>
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="px-3 py-2 font-medium">시나리오</th>
                  <th className="px-3 py-2 font-medium num">최고 점수</th>
                  <th className="px-3 py-2 font-medium">모드</th>
                  <th className="px-3 py-2 font-medium num">시도</th>
                  <th className="px-3 py-2 font-medium">최근</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {played.map((s) => {
                  const p = scenarios[s.id]
                  const last = p?.attempts[0]
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0 align-top">
                      <td className="px-3 py-2">
                        <Link to={`/scenarios/${s.id}`}>{s.title}</Link>
                        <div className="text-muted">{s.roleTitle}</div>
                      </td>
                      <td className="px-3 py-2 num">
                        {p?.best ? (
                          <>
                            {formatNumber(p.best.total, 1)}{' '}
                            <span className="text-muted">({p.best.grade})</span>
                            {p.best.scenarioVersion !== s.version && (
                              <Badge tone="neutral" className="ml-1">
                                v{p.best.scenarioVersion} 기준
                              </Badge>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p?.best ? MODE_LABELS[p.best.mode] : last ? MODE_LABELS[last.mode] : '—'}
                      </td>
                      <td className="px-3 py-2 num">{p?.attempts.length ?? 0}</td>
                      <td className="px-3 py-2 num text-muted">
                        {last ? (
                          <>
                            {shortDate(last.completedAt)} · {formatNumber(last.total, 1)}점 ·{' '}
                            {durationLabel(last.durationSec)}
                            {last.failed && (
                              <Badge tone="critical" className="ml-1">
                                실패
                              </Badge>
                            )}
                            {last.forkedFrom && (
                              <Badge tone="neutral" className="ml-1">
                                포크
                              </Badge>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p?.inProgress ? (
                          <Link to={`/play/${s.id}`}>
                            <Badge tone="info">
                              진행 중 {turnProgressLabel(p.inProgress.turnIndex, s.durationTurns)}
                            </Badge>
                          </Link>
                        ) : last ? (
                          <Link to={`/debrief/${s.id}`}>디브리핑</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setClearId(s.id)}
                          aria-label={`${s.title} 기록 삭제`}
                        >
                          삭제
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="pg-quiz">
        <h2 id="pg-quiz" className="mb-2 text-[16px] font-semibold">
          퀴즈 결과
        </h2>
        {quizRows.length === 0 ? (
          <p className="text-[12px] text-muted">디브리핑 퀴즈를 풀면 여기에 기록됩니다.</p>
        ) : (
          <ul className="m-0 list-none space-y-1 p-0 text-[12px]">
            {quizRows.map((s) => {
              const q = scenarios[s.id]!.quiz!
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <span className="font-medium">{s.title}</span>
                  <span className="num">
                    {q.correct}/{q.total}
                  </span>
                  <span className="text-muted num">{shortDate(q.completedAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-[12px] text-muted">
        모든 데이터는 이 브라우저에만 저장됩니다. 초기화는 <Link to="/settings">설정</Link>에서 할
        수 있습니다.
      </p>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="진행 데이터를 가져올까요?"
        body={
          pendingImport ? (
            <>
              현재 브라우저의 진행 데이터가 파일 내용으로 <b>대체</b>됩니다. 파일: 시나리오{' '}
              {Object.keys(pendingImport.scenarios).length}개, 생성일{' '}
              {shortDate(pendingImport.meta.createdAt)}. 먼저 현재 데이터를 내보내 두는 것을
              권장합니다.
            </>
          ) : null
        }
        confirmLabel="가져오기"
        destructive
        onCancel={() => setPendingImport(undefined)}
        onConfirm={() => {
          if (pendingImport) {
            importState(pendingImport)
            setImportOk(true)
          }
          setPendingImport(undefined)
        }}
      />
      <ConfirmDialog
        open={Boolean(clearId)}
        title="이 시나리오의 기록을 삭제할까요?"
        body="최고 점수, 시도 기록, 진행 중인 플레이, 퀴즈 결과가 모두 삭제됩니다."
        confirmLabel="삭제"
        destructive
        onCancel={() => setClearId(undefined)}
        onConfirm={() => {
          if (clearId) clearScenario(clearId)
          setClearId(undefined)
        }}
      />
    </div>
  )
}
