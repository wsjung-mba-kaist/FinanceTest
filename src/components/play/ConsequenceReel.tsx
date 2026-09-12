import { useEffect, useMemo, useState } from 'react'
import type { MetricDelta, MetricUnit, Units } from '../../engine'
import { formatDelta, formatMetric } from '../../lib/format'
import { useReducedMotion } from '../../lib/useMediaQuery'
import { firstSentence } from '../../lib/text'
import { Badge, Button, Card, LiveRegion, StatusBadge } from '../ui'
import { Icon } from '../ui/Icon'
import { Markdown } from '../knowledge/Markdown'
import { useRollingNumber } from './useRollingNumber'
import { REACTION_LABELS, REEL_STEP_MS, REEL_STEP_TITLES, type ReelStep } from './reelSteps'

function RollingMetric({
  delta,
  units,
  animate,
}: {
  delta: MetricDelta
  units: Units
  animate: boolean
}) {
  const value = useRollingNumber(delta.after, { durationMs: 600, enabled: animate })
  const worse = delta.statusAfter === 'breach' || delta.statusAfter === 'warn'
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-base text-muted">{delta.label}</span>
      <span className="num ml-auto text-base">
        {formatMetric(delta.before, delta.unit, units)} →{' '}
        <span className="num-md">{formatMetric(value, delta.unit, units)}</span>
      </span>
      <span className={`num text-sm ${worse ? 'text-critical' : 'text-muted'}`}>
        {formatDelta(delta.delta, delta.unit, units)}
      </span>
      {delta.statusBefore !== delta.statusAfter && <StatusBadge status={delta.statusAfter} />}
    </li>
  )
}

function MarketRow({
  item,
  units,
  animate,
}: {
  item: { label: string; before: number; after: number; unit: MetricUnit }
  units: Units
  animate: boolean
}) {
  const value = useRollingNumber(item.after, { durationMs: 600, enabled: animate })
  const down = item.after < item.before
  return (
    <li className="flex items-baseline gap-2">
      <span className="text-base text-muted">{item.label}</span>
      <span className="num ml-auto text-base">
        {formatMetric(item.before, item.unit, units)} →{' '}
        <span className={down ? 'text-critical' : 'text-positive'}>
          {formatMetric(value, item.unit, units)}
        </span>
      </span>
    </li>
  )
}

function Step({ step, units, animate }: { step: ReelStep; units: Units; animate: boolean }) {
  return (
    <section
      className={`rounded-lg bg-surface-2 p-2.5 ${animate ? 'reel-step-in' : ''}`}
      aria-label={REEL_STEP_TITLES[step.kind]}
    >
      <h4 className="label-caps">{REEL_STEP_TITLES[step.kind]}</h4>
      {step.kind === 'metrics' && (
        <ul className="mt-1 list-none space-y-1 p-0">
          {step.deltas.map((d) => (
            <RollingMetric key={d.key} delta={d} units={units} animate={animate} />
          ))}
        </ul>
      )}
      {step.kind === 'consequence' && (
        <ul className="mt-1 list-none space-y-1.5 p-0">
          {step.items.map((it, i) => (
            <li key={`${it.title}-${i}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={it.severity === 'info' ? 'neutral' : it.severity}>결과</Badge>
                <span className="text-base font-medium">{firstSentence(it.title, 40).head}</span>
              </div>
              <Markdown className="md-compact prose-col mt-0.5 text-base">{it.body}</Markdown>
            </li>
          ))}
        </ul>
      )}
      {step.kind === 'market' && (
        <ul className="mt-1 list-none space-y-1 p-0">
          {step.items.map((it) => (
            <MarketRow key={it.label} item={it} units={units} animate={animate} />
          ))}
        </ul>
      )}
      {step.kind === 'reaction' && (
        <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-base">
          <Badge tone={step.from === 'regulator' ? 'warning' : 'neutral'}>
            {REACTION_LABELS[step.from]}
          </Badge>
          {step.text}
        </p>
      )}
    </section>
  )
}

/**
 * Plays the beats of a committed decision at 800 ms intervals with number roll-up,
 * `건너뛰기` (Space) and a summary that stays on screen. Under `prefers-reduced-motion`
 * every beat is rendered at once as a static list.
 */
export function ConsequenceReel({
  steps,
  units,
  skipSignal = 0,
  immediate = false,
  onDone,
}: {
  steps: ReelStep[]
  units: Units
  /** Incrementing this reveals every remaining step (Space / 건너뛰기). */
  skipSignal?: number
  /** Already-played reel (or reduced motion): render every beat at once, no animation. */
  immediate?: boolean
  onDone?: () => void
}) {
  const reducedMotion = useReducedMotion()
  const reduced = reducedMotion || immediate
  const [shown, setShown] = useState(() => (reduced ? steps.length : Math.min(1, steps.length)))

  useEffect(() => {
    setShown(reduced ? steps.length : Math.min(1, steps.length))
  }, [steps, reduced])

  useEffect(() => {
    if (skipSignal > 0) setShown(steps.length)
  }, [skipSignal, steps.length])

  useEffect(() => {
    if (reduced || shown >= steps.length) return
    const t = window.setTimeout(() => setShown((n) => Math.min(steps.length, n + 1)), REEL_STEP_MS)
    return () => window.clearTimeout(t)
  }, [shown, steps.length, reduced])

  const done = shown >= steps.length
  useEffect(() => {
    if (done) onDone?.()
    // onDone is a stable callback from the page; re-firing on identity changes is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const summary = useMemo(() => {
    const metrics = steps.find((s) => s.kind === 'metrics')
    if (metrics && metrics.kind === 'metrics') {
      const worst = metrics.deltas.find((d) => d.statusBefore !== d.statusAfter)
      if (worst) return `${worst.label} 상태가 바뀌었습니다`
      return `지표 ${metrics.deltas.length}건이 움직였습니다`
    }
    return '지표에는 즉각적인 변화가 없습니다'
  }, [steps])

  if (steps.length === 0) return null

  return (
    <Card as="div" className="space-y-2 p-3" aria-labelledby="reel-title">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="reel-title" className="text-md font-semibold">
          결과 요약
        </h3>
        <span className="text-sm text-muted">{summary}</span>
        {!done && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            aria-keyshortcuts="Space"
            onClick={() => setShown(steps.length)}
          >
            건너뛰기
            <Icon name="chevron-right" size={14} />
          </Button>
        )}
      </div>
      <LiveRegion message={done ? `결과 재생 완료 · ${summary}` : ''} />
      <div className="space-y-2">
        {steps.slice(0, shown).map((s, i) => (
          <Step key={`${s.kind}-${i}`} step={s} units={units} animate={!reduced} />
        ))}
      </div>
    </Card>
  )
}
