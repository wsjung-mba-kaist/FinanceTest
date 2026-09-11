import { formatMetric } from '../../lib/format'
import { latestSnapshot } from '../../engine'
import { Badge, Button, Card, StatusBadge } from '../ui'
import { Markdown } from '../knowledge/Markdown'
import { usePlay } from './playContext'

const RULE_RE = /\n*발동 규칙:\s*([\s\S]+)$/

/** Shown when `state.phase === 'ended'`: title, narrative, the rule that fired, and the only way forward. */
export function TerminalCard({ onDebrief }: { onDebrief: () => void }) {
  const { scenario, state } = usePlay()
  const ended = state.ended
  const last = [...state.feed].reverse().find((f) => f.kind === 'gameover' || f.kind === 'system')
  const rule = ended
    ? (scenario.gameOver.find((r) => r.reason === ended.reason && r.title === ended.title) ??
      scenario.gameOver.find((r) => r.reason === ended.reason))
    : undefined
  const bodyRule = last ? RULE_RE.exec(last.body)?.[1]?.trim() : undefined
  const ruleText = rule?.ruleText ?? bodyRule
  const narrative = ended?.narrative || (last ? last.body.replace(RULE_RE, '') : '')
  const title = ended?.title ?? last?.title ?? '시나리오 종료'
  const failed = ended?.failed ?? last?.severity === 'critical'
  const orderly = ended?.orderly
  const turnIndex = ended?.turnIndex ?? state.turnIndex
  const turn = scenario.turns[turnIndex]
  const snap = latestSnapshot(state)
  const primary = scenario.kpis.filter((k) => k.primary).slice(0, 4)

  return (
    <Card
      as="section"
      aria-labelledby="terminal-title"
      className="mx-auto w-full max-w-2xl space-y-4 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {failed ? (
          <Badge tone={orderly ? 'warning' : 'critical'}>
            {orderly ? '■ 질서 있는 실패' : '■ 실패'}
          </Badge>
        ) : (
          <Badge tone="positive">● 완료</Badge>
        )}
        <span className="num text-sm text-muted">
          T+{turnIndex}/{Math.max(0, scenario.meta.durationTurns - 1)}
          {turn ? ` · ${turn.timeLabel}` : ''}
        </span>
      </div>
      <h2 id="terminal-title" className="text-lg font-semibold leading-tight">
        {title}
      </h2>
      {narrative && <Markdown className="text-base leading-relaxed">{narrative}</Markdown>}
      {ruleText && (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="font-semibold text-muted">발동 규칙</span>
          <p className="mt-0.5">{ruleText}</p>
        </div>
      )}
      {primary.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {primary.map((k) => {
            const mv = snap.metrics[k.metric]
            return (
              <div key={k.metric} className="rounded-md border border-border px-2 py-1.5">
                <dt className="text-muted">{k.label}</dt>
                <dd className="num mt-0.5 flex items-center justify-between gap-1 text-base">
                  {mv ? formatMetric(mv.value, k.unit, scenario.units, k.decimals) : '—'}
                  {mv && <StatusBadge status={mv.status} />}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      <p className="text-sm text-muted">
        이 시점부터는 결정을 내릴 수 없습니다. 디브리핑에서 경로 비교와 점수를 확인하실 수 있습니다.
      </p>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={onDebrief} autoFocus>
          디브리핑으로
        </Button>
      </div>
    </Card>
  )
}
