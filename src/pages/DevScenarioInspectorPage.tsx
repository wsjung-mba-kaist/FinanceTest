import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, EmptyState } from '../components/ui'
import { CARDS, SOURCES } from '../content'
import { autoplay, computeScore, describeCondition } from '../engine'
import type { Decision, Effect, GameEvent, Option, ScenarioDefinition } from '../engine/types'
import { validateScenario } from '../engine/validate/scenarioIntegrity'
import { formatNumber } from '../lib/format'
import { useScenarioDef } from '../lib/useScenario'

function effectText(e: Effect): string {
  switch (e.kind) {
    case 'op':
      return `op ${e.path} ${e.op} ${e.value}${e.label ? ` — ${e.label}` : ''}`
    case 'flag':
      return `flag ${e.key} = ${String(e.value)}`
    case 'counter':
      return `counter ${e.key} ${e.add >= 0 ? '+' : ''}${e.add}`
    case 'confidence':
      return `confidence ${e.target ?? 'index'} ${e.delta >= 0 ? '+' : ''}${e.delta}${e.reason ? ` — ${e.reason}` : ''}`
    case 'regulator':
      return `regulator ${e.set !== undefined ? `set R${e.set}` : `${(e.add ?? 0) >= 0 ? '+' : ''}${e.add ?? 0}`}${e.reason ? ` — ${e.reason}` : ''}`
    case 'feed':
      return `feed [${e.item.kind}/${e.item.severity}] ${e.item.title}`
    case 'fn':
      return `fn ${e.name}${e.params ? ` ${JSON.stringify(e.params)}` : ''}${e.label ? ` — ${e.label}` : ''}`
  }
}

function eventTitle(ev: GameEvent): string {
  switch (ev.kind) {
    case 'newswire':
      return `[${ev.outlet}] ${ev.headline}`
    case 'market':
    case 'board':
    case 'regulator':
    case 'rumor':
      return ev.headline
    case 'memo':
      return `${ev.from} → ${ev.to}: ${ev.subject}`
    case 'call':
      return `${ev.caller} → ${ev.callee}`
    case 'data':
    case 'dialogue':
      return ev.title
  }
}

function EffectList({ effects }: { effects: Effect[] | undefined }) {
  if (!effects || effects.length === 0) return <span className="text-muted">효과 없음</span>
  return (
    <ul className="m-0 list-disc pl-4 font-mono text-xs">
      {effects.map((e, i) => (
        <li key={i}>{effectText(e)}</li>
      ))}
    </ul>
  )
}

function OptionRow({
  o,
  scenario,
  decision,
}: {
  o: Option
  scenario: ScenarioDefinition
  decision: Decision
}) {
  const histPath = scenario.paths.historical.choices[decision.id]
  const expPath = scenario.paths.expert?.choices[decision.id]
  const inHist = histPath !== undefined ? [histPath].flat().includes(o.id) : Boolean(o.historical)
  const inExp = expPath !== undefined ? [expPath].flat().includes(o.id) : false
  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="px-2 py-1 font-mono">{o.id}</td>
      <td className="px-2 py-1">
        <div className="font-medium">{o.label}</div>
        <div className="text-muted">{o.description}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {inHist && <Badge tone="neutral">역사</Badge>}
          {inExp && <Badge tone="positive">전문가 경로</Badge>}
          {o.trap && <Badge tone="warning">함정</Badge>}
          {o.irreversible && <Badge tone="neutral">비가역</Badge>}
          {o.illegal && <Badge tone="critical">위법 소지</Badge>}
        </div>
        {o.when && (
          <div className="mt-1 text-muted">
            <span className="font-mono">when:</span> {describeCondition(o.when)}
          </div>
        )}
        {o.requires && (
          <div className="text-muted">
            <span className="font-mono">requires:</span> {describeCondition(o.requires)}
            {o.unavailableReason && ` (${o.unavailableReason})`}
          </div>
        )}
      </td>
      <td className="px-2 py-1 num">{o.expert.rating}</td>
      <td className="px-2 py-1">
        <div>{o.expert.rationale}</div>
        {o.expert.sourceRefs && o.expert.sourceRefs.length > 0 && (
          <div className="font-mono text-muted">{o.expert.sourceRefs.join(', ')}</div>
        )}
        {o.trapExplanation && <div className="text-warning">함정: {o.trapExplanation}</div>}
      </td>
      <td className="px-2 py-1">
        <EffectList effects={o.effects} />
        {o.setFlags && (
          <div className="font-mono text-xs text-muted">
            setFlags {JSON.stringify(o.setFlags)}
          </div>
        )}
        {o.delayedEffects?.map((de, i) => (
          <div key={i} className="mt-1 border-l border-border pl-2">
            <div className="text-muted">
              +{de.afterTurns}턴 후{de.when ? ` (조건: ${describeCondition(de.when)})` : ''}:{' '}
              {de.description}
            </div>
            <EffectList effects={de.effects} />
          </div>
        ))}
        {o.scoreAdjust && (
          <div className="font-mono text-xs text-muted">
            scoreAdjust {JSON.stringify(o.scoreAdjust)}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function DevScenarioInspectorPage() {
  const { scenarioId } = useParams()
  const { summary, def, loading, error } = useScenarioDef(scenarioId)

  const issues = useMemo(() => {
    if (!def) return []
    return validateScenario(def, {
      cardIds: new Set(CARDS.map((c) => c.id)),
      sourceIds: new Set(SOURCES.map((s) => s.id)),
    })
  }, [def])

  const runs = useMemo(() => {
    if (!def) return undefined
    const play = (policy: 'historical' | 'expert') => {
      try {
        const r = autoplay(def, policy, { seed: 1 })
        return { result: r, report: computeScore(r.state, def), error: undefined }
      } catch (e) {
        return {
          result: undefined,
          report: undefined,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
    return { historical: play('historical'), expert: play('expert') }
  }, [def])

  if (!summary) return <EmptyState title="시나리오를 찾을 수 없습니다" />
  if (summary.status === 'planned')
    return <EmptyState title="준비 중인 시나리오입니다 (정의 없음)" />
  if (loading) return <p className="text-muted">불러오는 중…</p>
  if (error || !def) return <p className="text-critical">불러오기 실패: {error}</p>

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  const decisionIds = def.turns.flatMap((t) => t.decisions.map((d) => d.id))

  return (
    <div className="space-y-6 text-sm">
      <header>
        <nav aria-label="경로" className="text-muted">
          <Link to={`/scenarios/${def.meta.id}`}>{def.meta.title}</Link>{' '}
          <span aria-hidden="true">›</span> DEV 인스펙터
        </nav>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {def.meta.title}{' '}
          <span className="font-mono text-sm text-muted">
            {def.meta.id} v{def.meta.version}
          </span>
        </h1>
        <p className="text-muted num">
          {def.turns.length}턴 · 결정 {decisionIds.length}개 · 옵션{' '}
          {def.turns.reduce((a, t) => a + t.decisions.reduce((b, d) => b + d.options.length, 0), 0)}
          개 · KPI {def.kpis.length}개 · 출처 {def.meta.sources.length}개
        </p>
      </header>

      <section aria-labelledby="dev-issues">
        <h2 id="dev-issues" className="mb-1 text-base font-semibold">
          무결성 검사{' '}
          <Badge tone={errors.length ? 'critical' : 'positive'}>오류 {errors.length}</Badge>{' '}
          <Badge tone={warnings.length ? 'warning' : 'neutral'}>경고 {warnings.length}</Badge>
        </h2>
        {issues.length === 0 ? (
          <p className="text-positive">이슈가 없습니다.</p>
        ) : (
          <ul className="m-0 list-none space-y-0.5 p-0 font-mono text-xs">
            {issues.map((i, k) => (
              <li key={k} className={i.level === 'error' ? 'text-critical' : 'text-warning'}>
                {i.level === 'error' ? '✖' : '⚠'} [{i.rule}] {i.where}: {i.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {runs && (
        <section aria-labelledby="dev-runs">
          <h2 id="dev-runs" className="mb-1 text-base font-semibold">
            자동 플레이 (seed 1)
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['historical', 'expert'] as const).map((p) => {
              const r = runs[p]
              return (
                <div key={p} className="rounded-md border border-border bg-surface p-2">
                  <div className="font-medium">
                    {p === 'historical' ? '역사 경로' : '전문가 경로'}
                  </div>
                  {r.error ? (
                    <div className="text-critical">실패: {r.error}</div>
                  ) : (
                    <>
                      <div className="num">
                        점수 {formatNumber(r.report!.total, 1)} ({r.report!.grade}) · 종료{' '}
                        {r.result!.state.ended?.title ?? '—'}{' '}
                        {r.result!.state.ended?.failed ? '(실패)' : ''}
                      </div>
                      {r.result!.deviations.length > 0 && (
                        <ul className="m-0 mt-1 list-disc pl-4 text-warning">
                          {r.result!.deviations.map((d, i) => (
                            <li key={i} className="font-mono text-xs">
                              {d.decisionId}: 원함 [{d.wanted.join(',')}] → 선택 [
                              {d.chosen.join(',')}] ({d.reason})
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {def.paths.expert?.expertMayNotBeatHistorical && (
            <p className="mt-1 text-muted">
              expertMayNotBeatHistorical: 전문가 경로가 역사 경로를 능가하지 않을 수 있음.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="dev-paths">
        <h2 id="dev-paths" className="mb-1 text-base font-semibold">
          경로 표
        </h2>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-2 py-1 font-medium">결정</th>
                <th className="px-2 py-1 font-medium">역사(paths / historical 플래그)</th>
                <th className="px-2 py-1 font-medium">전문가(paths / 최고 평점)</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {def.turns.flatMap((t, ti) =>
                t.decisions.map((d) => {
                  const hp = def.paths.historical.choices[d.id]
                  const ep = def.paths.expert?.choices[d.id]
                  const flagged = d.options.filter((o) => o.historical).map((o) => o.id)
                  const best = [...d.options].sort((a, b) => b.expert.rating - a.expert.rating)[0]
                  return (
                    <tr key={d.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1">
                        T{ti} {d.id}
                      </td>
                      <td className="px-2 py-1">
                        {hp !== undefined ? (
                          [hp].flat().join(', ')
                        ) : (
                          <span className="text-muted">—</span>
                        )}{' '}
                        /{' '}
                        {flagged.length ? (
                          flagged.join(', ')
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {ep !== undefined ? (
                          [ep].flat().join(', ')
                        ) : (
                          <span className="text-muted">—</span>
                        )}{' '}
                        / {best ? `${best.id}(${best.expert.rating})` : '—'}
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
        {def.paths.historical.note && (
          <p className="mt-1 text-muted">역사 경로 노트: {def.paths.historical.note}</p>
        )}
      </section>

      <section aria-labelledby="dev-gameover">
        <h2 id="dev-gameover" className="mb-1 text-base font-semibold">
          게임오버 규칙 · 엔딩
        </h2>
        <ul className="m-0 list-none space-y-1 p-0">
          {def.gameOver.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-surface p-2">
              <span className="font-mono">{r.id}</span>{' '}
              <Badge tone={r.failed ? (r.orderly ? 'warning' : 'critical') : 'positive'}>
                {r.failed ? (r.orderly ? '질서 있는 실패' : '실패') : '종료'}
              </Badge>{' '}
              {r.title}
              <div className="text-muted">조건: {describeCondition(r.when)}</div>
              <div className="text-muted">규칙: {r.ruleText}</div>
            </li>
          ))}
          {def.endings.map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-surface p-2">
              <span className="font-mono">{e.id}</span> <Badge tone="neutral">엔딩</Badge> {e.title}
              <div className="text-muted">조건: {describeCondition(e.when)}</div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dev-turns" className="space-y-4">
        <h2 id="dev-turns" className="text-base font-semibold">
          턴 · 결정 · 옵션
        </h2>
        {def.turns.map((t, ti) => (
          <article key={t.id} className="rounded-lg border border-border bg-surface p-3">
            <h3 className="m-0 text-base font-semibold">
              <span className="font-mono text-muted">[{ti}]</span> {t.label} {t.title ?? ''}{' '}
              <span className="font-normal text-muted">{t.timeLabel}</span>
            </h3>
            {t.entryEffects && t.entryEffects.length > 0 && (
              <div className="mt-2">
                <div className="font-medium">진입 효과</div>
                <ul className="m-0 list-none space-y-1 p-0">
                  {t.entryEffects.map((ce) => (
                    <li key={ce.id} className="border-l border-border pl-2">
                      <span className="font-mono">{ce.id}</span> {ce.description ?? ''}{' '}
                      <span className="text-muted">— {describeCondition(ce.when)}</span>
                      <EffectList effects={ce.effects} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {t.events.length > 0 && (
              <div className="mt-2">
                <div className="font-medium">이벤트 ({t.events.length})</div>
                <ul className="m-0 list-none space-y-1 p-0">
                  {t.events.map((ev) => (
                    <li key={ev.id} className="border-l border-border pl-2">
                      <span className="font-mono">{ev.id}</span>{' '}
                      <Badge tone="neutral">{ev.kind}</Badge>{' '}
                      {ev.severity && (
                        <Badge tone={ev.severity === 'positive' ? 'positive' : ev.severity}>
                          {ev.severity}
                        </Badge>
                      )}{' '}
                      {ev.expertOnly && <Badge tone="info">전문가 전용</Badge>}{' '}
                      {ev.reliability && ev.reliability !== 'confirmed' && (
                        <Badge tone="warning">{ev.reliability}</Badge>
                      )}{' '}
                      {eventTitle(ev)}
                      {ev.when && (
                        <div className="text-muted">조건: {describeCondition(ev.when)}</div>
                      )}
                      {ev.effects && ev.effects.length > 0 && <EffectList effects={ev.effects} />}
                      {(ev.cardRefs?.length || ev.sourceRefs?.length) && (
                        <div className="font-mono text-xs text-muted">
                          {ev.cardRefs?.length ? `cards: ${ev.cardRefs.join(', ')} ` : ''}
                          {ev.sourceRefs?.length ? `sources: ${ev.sourceRefs.join(', ')}` : ''}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {t.decisions.map((d) => (
              <div key={d.id} className="mt-3 rounded-md border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{d.id}</span>
                  <span className="font-medium">{d.title}</span>
                  {(d.required ?? true) ? (
                    <Badge tone="neutral">필수</Badge>
                  ) : (
                    <Badge tone="info">선택</Badge>
                  )}
                  <Badge tone="neutral" className="num">
                    선택 {d.select?.min ?? 1}~{d.select?.max ?? 1}
                  </Badge>
                  {d.timeLimitSec && (
                    <Badge tone="warning" className="num">
                      {d.timeLimitSec}초 · 기본 {d.defaultOptionId ?? '없음'}
                    </Badge>
                  )}
                  {d.dimensions && (
                    <span className="font-mono text-muted">dims: {d.dimensions.join(', ')}</span>
                  )}
                </div>
                <div className="mt-1 text-muted">{d.prompt}</div>
                {d.when && <div className="text-muted">조건: {describeCondition(d.when)}</div>}
                {d.exclusive && d.exclusive.length > 0 && (
                  <div className="font-mono text-xs text-muted">
                    exclusive: {d.exclusive.map((g) => `[${g.join(',')}]`).join(' ')}
                  </div>
                )}
                {(d.cardRefs?.length || d.requiredConcepts?.length) && (
                  <div className="font-mono text-xs text-muted">
                    {d.cardRefs?.length ? `cards: ${d.cardRefs.join(', ')} ` : ''}
                    {d.requiredConcepts?.length ? `required: ${d.requiredConcepts.join(', ')}` : ''}
                  </div>
                )}
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-muted border-b border-border">
                        <th className="px-2 py-1 font-medium">id</th>
                        <th className="px-2 py-1 font-medium">옵션</th>
                        <th className="px-2 py-1 font-medium num">평점</th>
                        <th className="px-2 py-1 font-medium">근거</th>
                        <th className="px-2 py-1 font-medium">효과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.options.map((o) => (
                        <OptionRow key={o.id} o={o} scenario={def} decision={d} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {t.advisorHints && t.advisorHints.length > 0 && (
              <div className="mt-2">
                <div className="font-medium">조언자 힌트</div>
                <ul className="m-0 list-disc pl-4 text-muted">
                  {t.advisorHints.map((h, i) => (
                    <li key={i}>
                      L{h.level}
                      {h.decisionId ? ` (${h.decisionId})` : ''}: {h.text}{' '}
                      {h.when && <span>— {describeCondition(h.when)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      {def.checkpoints && def.checkpoints.length > 0 && (
        <section aria-labelledby="dev-checkpoints">
          <h2 id="dev-checkpoints" className="mb-1 text-base font-semibold">
            체크포인트
          </h2>
          <ul className="m-0 list-disc pl-4 font-mono text-xs">
            {def.checkpoints.map((c, i) => (
              <li key={i}>
                {c.turnId} {c.metric ?? c.counter ?? c.path} ≈ {c.expected} ±
                {Math.round(c.tolerance * 100)}% — {c.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
