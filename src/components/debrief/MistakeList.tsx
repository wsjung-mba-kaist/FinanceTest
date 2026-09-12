import { useEffect, useMemo, useState } from 'react'
import { advanceTurn, applyDecision, findDecision, findOption, getTurnView } from '../../engine'
import type { GameState, KpiSpec, ScenarioDefinition } from '../../engine/types'
import type { decisionRegrets } from '../../engine'
import { formatMetric } from '../../lib/format'
import { Badge, Button, Card } from '../ui'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

type Regret = ReturnType<typeof decisionRegrets>[number]

interface WhatIfRow {
  kpi: KpiSpec
  actualMin: number | undefined
  whatIfMin: number | undefined
}

interface WhatIf {
  rows: WhatIfRow[]
  ended: GameState['ended']
}

/** `status: 'na'` means "no threshold band", not "no value" — only finiteness may reject a point. */
function minOf(state: GameState, metric: string): number | undefined {
  let min: number | undefined
  for (const s of state.metricsHistory) {
    const m = s.metrics[metric]
    if (!m || !Number.isFinite(m.value)) continue
    min = min === undefined ? m.value : Math.min(min, m.value)
  }
  return min
}

/** Fills unresolved required decisions with the top-rated available option(s), then advances to the end. */
function completeRun(start: GameState, scenario: ScenarioDefinition): GameState {
  let s = start
  let steps = 0
  while (s.phase !== 'ended' && steps++ < 300) {
    const view = getTurnView(s, scenario, { mode: 'standard' })
    const pending = view.decisions.find((d) => !d.resolved && (d.decision.required ?? true))
    if (!pending) {
      s = advanceTurn(s, scenario)
      continue
    }
    const sel = pending.decision.select ?? { min: 1, max: 1 }
    const ids = pending.options
      .filter((o) => o.available)
      .sort((a, b) => b.option.expert.rating - a.option.expert.rating)
      .slice(0, sel.min)
      .map((o) => o.option.id)
    if (ids.length < sel.min) throw new Error('선택 가능한 옵션 부족')
    s = applyDecision(s, scenario, pending.decision.id, ids)
  }
  return s
}

/**
 * Replays from the turn-start snapshot with the best option substituted for the regretted decision,
 * then continues with the player's later choices where still valid.
 */
function computeWhatIf(
  scenario: ScenarioDefinition,
  state: GameState,
  history: GameState[],
  regret: Regret,
  kpis: KpiSpec[],
): WhatIf | undefined {
  try {
    const start = history[regret.turnIndex]
    if (!start) return undefined
    let s = start
    const later = state.decisions.filter((d) => d.turnIndex >= regret.turnIndex)
    for (const rec of later) {
      while (s.turnIndex < rec.turnIndex && s.phase !== 'ended') s = advanceTurn(s, scenario)
      if (s.phase === 'ended') break
      const substitute = rec.decisionId === regret.decisionId && rec.turnIndex === regret.turnIndex
      if (substitute) {
        s = applyDecision(s, scenario, rec.decisionId, [regret.best])
      } else {
        try {
          s = applyDecision(s, scenario, rec.decisionId, rec.optionIds)
        } catch {
          /* no longer valid on the new path → let completeRun fill it in */
        }
      }
    }
    s = completeRun(s, scenario)
    return {
      rows: kpis.map((kpi) => ({
        kpi,
        actualMin: minOf(state, kpi.metric),
        whatIfMin: minOf(s, kpi.metric),
      })),
      ended: s.ended,
    }
  } catch {
    return undefined
  }
}

export function MistakeList({
  scenario,
  state,
  history,
  regrets,
  onFork,
}: {
  scenario: ScenarioDefinition
  state: GameState
  history: GameState[]
  regrets: Regret[]
  onFork: (turnIndex: number) => void
}) {
  const kpis = useMemo(() => {
    const primary = scenario.kpis.filter((k) => k.primary)
    return (primary.length > 0 ? primary : scenario.kpis).slice(0, 3)
  }, [scenario])
  const top = useMemo(() => regrets.filter((r) => r.regret > 0).slice(0, 3), [regrets])
  // Each what-if re-simulates the rest of the run; defer it so the list paints first.
  const [whatIfs, setWhatIfs] = useState<(WhatIf | undefined)[] | undefined>()
  useEffect(() => {
    let cancelled = false
    setWhatIfs(undefined)
    if (top.length === 0) {
      setWhatIfs([])
      return
    }
    const t = setTimeout(() => {
      const out = top.map((r) => computeWhatIf(scenario, state, history, r, kpis))
      if (!cancelled) setWhatIfs(out)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [top, scenario, state, history, kpis])

  if (top.length === 0) {
    return (
      <p className="text-sm text-muted">
        모든 결정에서 최선의 옵션을 선택했습니다. 실수로 분류된 결정이 없습니다.
      </p>
    )
  }
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {top.map((r, i) => {
        const found = findDecision(scenario, r.decisionId)
        if (!found) return null
        const { decision, turn } = found
        const chosen = r.chosen
          .map((id) => findOption(decision, id))
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
        const best = findOption(decision, r.best)
        const wi = whatIfs?.[i]
        return (
          <Card as="li" key={r.decisionId} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-md font-semibold text-muted">#{i + 1}</span>
              <Badge tone="neutral" className="num">
                {turn.label}
              </Badge>
              <span className="font-medium">{decision.title}</span>
              <Badge tone="critical" className="num">
                후회 {Math.round(r.regret)}점
              </Badge>
              <span className="ml-auto">
                <Button size="sm" variant="secondary" onClick={() => onFork(r.turnIndex)}>
                  T+{r.turnIndex}부터 다시 하기
                </Button>
              </span>
            </div>
            <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">선택</dt>
              <dd>
                {chosen.map((o) => (
                  <div key={o.id}>
                    {o.label} <span className="num text-muted">({o.expert.rating}점)</span>
                    {o.trap && o.trapExplanation && (
                      <div className="text-warning">
                        <InlineMarkdown>{o.trapExplanation}</InlineMarkdown>
                      </div>
                    )}
                  </div>
                ))}
              </dd>
              <dt className="text-muted">최선</dt>
              <dd>
                {best ? (
                  <>
                    {best.label} <span className="num text-muted">({best.expert.rating}점)</span>
                    <div className="text-muted">
                      <InlineMarkdown>{best.expert.rationale}</InlineMarkdown>
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            {wi ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="text-left text-xs text-muted mb-1">
                    만약 최선을 택했다면 (이후 선택은 가능한 한 동일하게 유지, 실행 중 최저값 기준)
                    {wi.ended && wi.ended.failed !== Boolean(state.ended?.failed) && (
                      <span className={wi.ended.failed ? ' text-critical' : ' text-positive'}>
                        {' '}
                        · 대안 경로 결과: {wi.ended.failed ? '실패' : '생존'}
                      </span>
                    )}
                  </caption>
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-1 pr-2 font-medium">지표</th>
                      <th className="py-1 pr-2 font-medium num">실제(최저)</th>
                      <th className="py-1 pr-2 font-medium num">대안(최저)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wi.rows.map((row) => (
                      <tr key={row.kpi.metric} className="border-b border-border/60 last:border-0">
                        <td className="py-1 pr-2">{row.kpi.label}</td>
                        <td className="py-1 pr-2 num">
                          {row.actualMin === undefined
                            ? '—'
                            : formatMetric(
                                row.actualMin,
                                row.kpi.unit,
                                scenario.units,
                                row.kpi.decimals,
                              )}
                        </td>
                        <td className="py-1 pr-2 num">
                          {row.whatIfMin === undefined
                            ? '—'
                            : formatMetric(
                                row.whatIfMin,
                                row.kpi.unit,
                                scenario.units,
                                row.kpi.decimals,
                              )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : whatIfs === undefined ? (
              <p className="mt-2 text-sm text-muted" role="status">
                대안 경로를 계산 중…
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                대안 경로를 재실행할 수 없어 what-if 수치는 생략합니다.
              </p>
            )}
          </Card>
        )
      })}
    </ol>
  )
}
