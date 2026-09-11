import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getTurnView,
  latestSnapshot,
  previewOption,
  replay,
  applyDecision,
  diffSnapshots,
  computeMetrics,
  type DecisionView,
  type GameEvent,
  type GameState,
  type InstitutionState,
  type MetricDelta,
  type ScenarioDefinition,
} from '../engine'
import { loadScenario } from '../scenarios'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, Button, StatusBadge } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { formatDelta, formatMetric } from '../lib/format'

/** The scenario the tour is built from, and the historical choice that gets it to its second turn. */
const DEMO = { scenarioId: 'svb-2023', firstDecision: 't0-d1', firstChoice: 't0-a' }

const STEPS = [
  { id: 'situation', label: '상황', hint: '지금 무슨 일이 일어났는지 한 건으로 읽습니다.' },
  { id: 'metrics', label: '지표', hint: '그 일이 우리 숫자에 무엇을 했는지 봅니다.' },
  { id: 'decision', label: '결정', hint: '요청받은 것을 고릅니다. 고르면 영향이 미리 보입니다.' },
  { id: 'result', label: '결과', hint: '고른 것이 무엇을 바꿨는지 확인합니다.' },
] as const

type StepId = (typeof STEPS)[number]['id']

interface DemoState {
  scenario: ScenarioDefinition<InstitutionState>
  state: GameState<InstitutionState>
}

function headlineOf(events: GameEvent[]): { title: string; body: string; time?: string } | undefined {
  const e = events[0]
  if (!e) return undefined
  const time = e.time
  if (e.kind === 'newswire') return { title: e.headline, body: e.body, time }
  if (e.kind === 'memo') return { title: e.subject, body: e.body, time }
  if (e.kind === 'board' || e.kind === 'regulator') return { title: e.headline, body: e.body, time }
  if (e.kind === 'rumor') return { title: e.headline, body: e.body, time }
  if (e.kind === 'call' || e.kind === 'dialogue') {
    const first = e.lines[0]
    return {
      title: e.kind === 'call' ? `${e.caller} 통화` : e.title,
      body: first ? `${first.speaker}: ${first.text}` : '',
      time,
    }
  }
  if (e.kind === 'market') return { title: e.headline, body: '', time }
  return { title: e.title, body: '', time }
}

/** Four metric rows, primary first, read straight off the snapshot. */
function useDemoMetrics(demo: DemoState | undefined) {
  return useMemo(() => {
    if (!demo) return []
    const snap = latestSnapshot(demo.state)
    const primary = demo.scenario.kpis.filter((k) => k.primary)
    const specs = (primary.length > 0 ? primary : demo.scenario.kpis).slice(0, 4)
    return specs.map((spec) => ({ spec, m: snap.metrics[spec.metric] }))
  }, [demo])
}

export default function DemoPage() {
  const [demo, setDemo] = useState<DemoState>()
  const [error, setError] = useState<string>()
  const [step, setStep] = useState<StepId>('situation')
  const [picked, setPicked] = useState<string>()
  const [committed, setCommitted] = useState<{ deltas: MetricDelta[]; consequences: string[] }>()

  useEffect(() => {
    let live = true
    loadScenario(DEMO.scenarioId)
      .then((scenario) => {
        if (!live) return
        if (!scenario) {
          setError('데모 시나리오를 불러오지 못했습니다.')
          return
        }
        // Real engine calls, exactly as play does — the tour is not a mock-up.
        const { state } = replay(scenario, {
          seed: 1,
          decisions: [
            {
              turnIndex: 0,
              decisionId: DEMO.firstDecision,
              optionIds: [DEMO.firstChoice],
            },
          ],
          turnIndex: 1,
        })
        setDemo({ scenario, state })
      })
      .catch(() => {
        if (live) setError('데모 시나리오를 불러오지 못했습니다.')
      })
    return () => {
      live = false
    }
  }, [])

  const view = useMemo(() => {
    if (!demo) return undefined
    try {
      return getTurnView(demo.state, demo.scenario, { mode: 'guided' })
    } catch {
      return undefined
    }
  }, [demo])

  const decision: DecisionView<InstitutionState> | undefined = view?.decisions.find((d) => !d.resolved)
  const metrics = useDemoMetrics(demo)
  const headline = view ? headlineOf(view.events as GameEvent[]) : undefined

  const preview = useMemo(() => {
    if (!demo || !decision || !picked) return undefined
    try {
      return previewOption(demo.state, demo.scenario, decision.decision.id, [picked])
    } catch {
      return undefined
    }
  }, [demo, decision, picked])

  const commit = useCallback(() => {
    if (!demo || !decision || !picked) return
    const before = computeMetrics(demo.state, demo.scenario)
    const next = applyDecision(demo.state, demo.scenario, decision.decision.id, [picked])
    const after = computeMetrics(next, demo.scenario)
    const option = decision.decision.options.find((o) => o.id === picked)
    setCommitted({
      deltas: diffSnapshots(before, after).slice(0, 5),
      consequences: option ? [option.consequences] : [],
    })
    setStep('result')
  }, [demo, decision, picked])

  const index = STEPS.findIndex((s) => s.id === step)
  const canAdvance =
    step === 'decision' ? picked !== undefined : step !== 'result' && index < STEPS.length - 1

  if (error)
    return (
      <div className="prose-col py-8">
        <h1 className="text-xl font-semibold">90초 둘러보기</h1>
        <p className="mt-3 text-muted">{error}</p>
        <Link className="mt-4 inline-block underline" to="/">
          시나리오 목록으로
        </Link>
      </div>
    )

  if (!demo || !view)
    return (
      <div className="prose-col py-8">
        <h1 className="text-xl font-semibold">90초 둘러보기</h1>
        <p className="mt-3 text-muted">불러오는 중입니다…</p>
      </div>
    )

  const units = demo.scenario.units
  const turn = view.turn

  return (
    <div className="mx-auto max-w-4xl py-6">
      <header className="prose-col">
        <p className="text-sm text-muted">{demo.scenario.meta.title} · 실제 엔진으로 재현됩니다</p>
        <h1 className="mt-1 text-xl font-semibold">90초 둘러보기</h1>
        <p className="mt-2 text-muted">
          한 턴을 네 단계로 나누어 보여 줍니다. 여기서 고른 것은 저장되지 않습니다.
        </p>
      </header>

      <ol className="mt-5 flex flex-wrap gap-2" aria-label="둘러보기 단계">
        {STEPS.map((s, i) => {
          const state = i === index ? 'current' : i < index ? 'done' : 'todo'
          return (
            <li key={s.id}>
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                  state === 'current'
                    ? 'border-accent bg-accent text-accent-fg'
                    : state === 'done'
                      ? 'border-border-strong text-muted'
                      : 'border-border text-muted'
                }`}
              >
                <span className="num">{i + 1}</span>
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-sm text-muted">{STEPS[index]?.hint}</p>

      <section className="mt-5 rounded-lg border border-border bg-surface p-4">
        {step === 'situation' && (
          <div className="prose-col">
            <p className="text-sm text-muted">
              {turn.label} · {turn.timeLabel}
              {headline?.time ? ` · ${headline.time}` : ''}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{headline?.title ?? turn.title}</h2>
            {headline?.body ? (
              <div className="md mt-2">
                <Markdown>{headline.body}</Markdown>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-muted">
              실제 화면에서는 이 자리에 새 소식이 시각 순서대로 쌓이고, 턴 안에서 시계가 흐릅니다.
            </p>
          </div>
        )}

        {step === 'metrics' && (
          <div>
            <h2 className="text-lg font-semibold">핵심 지표</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {metrics.map(({ spec, m }) => (
                <li key={spec.metric} className="rounded-lg border border-border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{spec.label}</span>
                    <StatusBadge status={m?.status ?? 'na'} />
                  </div>
                  <p className="num-lg mt-1">
                    {m ? formatMetric(m.value, spec.unit, units, spec.decimals) : '—'}
                  </p>
                  {spec.description ? (
                    <p className="mt-1 text-sm text-muted">{spec.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">
              실제 화면에서는 지표마다 임계 구간 막대와 &lsquo;왜 중요한가&rsquo;가 한 번의 클릭
              거리에 있습니다.
            </p>
          </div>
        )}

        {step === 'decision' && decision && (
          <div>
            <h2 className="text-lg font-semibold">{decision.decision.title}</h2>
            <p className="mt-1 text-muted">{decision.decision.prompt}</p>
            <ul className="mt-3 space-y-2">
              {decision.options.slice(0, 4).map((o) => {
                const on = picked === o.option.id
                return (
                  <li key={o.option.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(o.option.id)}
                      className={`block w-full rounded-lg border p-3 text-left ${
                        on ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong'
                      }`}
                    >
                      <span className="block font-medium">{o.option.label}</span>
                      <span className="mt-0.5 block text-sm text-muted">{o.option.description}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {preview && preview.deltas.length > 0 ? (
              <div className="mt-3 rounded-lg border border-border-strong p-3">
                <p className="text-sm font-medium">이 선택의 예상 영향</p>
                <ul className="mt-1.5 space-y-1">
                  {preview.deltas.slice(0, 4).map((d) => (
                    <li key={d.key} className="flex justify-between gap-3 text-sm">
                      <span>{d.label}</span>
                      <span className="num">{formatDelta(d.delta, d.unit, units)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {step === 'result' && committed && (
          <div>
            <h2 className="text-lg font-semibold">결과</h2>
            {committed.deltas.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {committed.deltas.map((d) => (
                  <li key={d.key} className="flex justify-between gap-3">
                    <span>{d.label}</span>
                    <span className="num">
                      {formatMetric(d.before, d.unit, units)} →{' '}
                      {formatMetric(d.after, d.unit, units)}{' '}
                      <span className="text-muted">({formatDelta(d.delta, d.unit, units)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">이 선택은 지표를 즉시 움직이지 않습니다.</p>
            )}
            {committed.consequences.map((c) => (
              <p key={c} className="mt-3">
                {c}
              </p>
            ))}
            <p className="mt-4 text-sm text-muted">
              실제 화면에서는 이 변화가 순서대로 펼쳐지고, 감독당국·이사회의 반응이 뒤따릅니다.
            </p>
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {index > 0 && step !== 'result' ? (
          <Button variant="ghost" onClick={() => setStep(STEPS[index - 1]!.id)}>
            이전
          </Button>
        ) : null}
        {step === 'decision' ? (
          <Button variant="primary" onClick={commit} disabled={!picked}>
            확정하고 결과 보기
          </Button>
        ) : step === 'result' ? (
          <>
            <Link
              to={`/scenarios/${DEMO.scenarioId}`}
              className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg"
            >
              이 시나리오 시작하기
            </Link>
            <Link className="text-sm underline" to="/">
              다른 시나리오 보기
            </Link>
          </>
        ) : (
          <Button variant="primary" onClick={() => setStep(STEPS[index + 1]!.id)} disabled={!canAdvance}>
            다음 <Icon name="chevron-right" />
          </Button>
        )}
        <Badge tone="neutral">저장되지 않는 둘러보기</Badge>
      </div>
    </div>
  )
}
