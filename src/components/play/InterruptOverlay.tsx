import { useCallback, useEffect, useRef, useState } from 'react'
import type { DecisionView, Interrupt } from '../../engine'
import { hasDialogue, isInterrupt } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { Badge, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { Dialog } from '../ui/Dialog'
import { CountdownRing } from './CountdownRing'
import { DialoguePanel } from './DialoguePanel'
import { usePlay } from './playContext'
import { letterFor, MODE_TIMEOUT_MULTIPLIER, optionEffectLine } from './playHelpers'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

const TONE_LABEL: Record<'routine' | 'concerned' | 'urgent', string> = {
  routine: '통상',
  concerned: '우려',
  urgent: '긴급',
}

const KIND_LABEL: Record<Interrupt['source']['kind'], string> = {
  call: '전화',
  regulator: '감독당국',
  board: '이사회',
  desk: '내부 데스크',
}

/**
 * A mid-turn interrupt: the caller, the transcript so far, 2–4 large replies and a real-seconds
 * countdown. The clock is already held by `useSimulationClock` while `openInterrupts` is not empty.
 *
 * On expiry the authored `defaultOptionId` is committed with `{ timedOut: true }`, exactly as the
 * engine's own deadline sweep would do — the player simply ran out of time to say it themselves.
 */
export function InterruptOverlay({ dv, onAnswered }: { dv: DecisionView; onAnswered: () => void }) {
  const { scenario, mode } = usePlay()
  const respondInterrupt = useGameStore((s) => s.respondInterrupt)
  const firedRef = useRef(false)
  const startedAt = useRef(Date.now())
  const [announce, setAnnounce] = useState('')
  const [notice, setNotice] = useState('')

  const decision = dv.decision
  const interrupt = isInterrupt(decision) ? decision : undefined
  const totalMs = interrupt
    ? Math.round(interrupt.timeoutSec * MODE_TIMEOUT_MULTIPLIER[mode] * 1000)
    : 0
  const [remainingMs, setRemaining] = useState(totalMs)

  const answer = useCallback(
    (optionIds: string[], timedOut: boolean, path?: string[]) => {
      if (firedRef.current) return
      firedRef.current = true
      const ok = respondInterrupt(decision.id, optionIds, {
        elapsedMs: Date.now() - startedAt.current,
        ...(timedOut ? { timedOut: true } : {}),
        ...(path && path.length > 0 ? { path } : {}),
      })
      // A refused answer must not lock the overlay: let the player try again.
      if (!ok) {
        firedRef.current = false
        return
      }
      onAnswered()
    },
    [decision.id, respondInterrupt, onAnswered],
  )

  // --------------------------------------------------------------- countdown
  useEffect(() => {
    if (!interrupt || totalMs <= 0 || typeof window === 'undefined') return
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const dt = now - last
      last = now
      setRemaining((prev) => Math.max(0, prev - dt))
    }, 250)
    return () => window.clearInterval(id)
  }, [interrupt, totalMs])

  const warned = useRef<{ 30?: boolean; 10?: boolean }>({})
  useEffect(() => {
    const s = Math.ceil(remainingMs / 1000)
    if (s <= 10 && s > 0 && !warned.current[10] && totalMs > 11_000) {
      warned.current[10] = true
      setNotice('남은 시간 10초')
    } else if (s <= 30 && s > 10 && !warned.current[30] && totalMs > 31_000) {
      warned.current[30] = true
      setNotice('남은 시간 30초')
    }
  }, [remainingMs, totalMs])

  useEffect(() => {
    if (!interrupt || totalMs <= 0 || remainingMs > 0) return
    answer([interrupt.defaultOptionId], true)
  }, [interrupt, totalMs, remainingMs, answer])

  useEffect(() => {
    if (!interrupt) return
    setAnnounce(
      `${interrupt.source.caller}${interrupt.source.agency ? ` (${interrupt.source.agency})` : ''} 연결 — ${decision.title}. 시계가 멈췄습니다.`,
    )
  }, [interrupt, decision.title])

  if (!interrupt) return null
  const tone = interrupt.source.tone ?? 'concerned'
  const titleId = `interrupt-${decision.id}-title`
  const descId = `interrupt-${decision.id}-desc`

  return (
    // No `onClose` and no `onDismiss`: an interrupt is a forced decision, so neither Esc nor a
    // click on the backdrop may dismiss it — and Esc must not be swallowed on its way elsewhere.
    <Dialog
      open
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descId}
      size="lg"
      align="bottom-on-mobile"
    >
      <LiveRegion message={announce} assertive />
      <LiveRegion message={notice} assertive={notice.includes('10초')} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={tone === 'urgent' ? 'critical' : tone === 'concerned' ? 'warning' : 'neutral'}
            >
              {KIND_LABEL[interrupt.source.kind]} · {TONE_LABEL[tone]}
            </Badge>
            <span className="text-base font-semibold">{interrupt.source.caller}</span>
            {interrupt.source.agency && (
              <span className="text-sm text-muted">{interrupt.source.agency}</span>
            )}
          </div>
          <h2 id={titleId} className="prose-col mt-1 text-lg font-semibold">
            {decision.title}
          </h2>
        </div>
        <CountdownRing remainingMs={remainingMs} totalMs={totalMs} size={56} />
      </div>

      <div id={descId} className="mt-2 space-y-1.5">
        {interrupt.lines.map((l, i) => (
          <p key={`${l.speaker}-${i}`} className="prose-col text-base">
            <span className="font-semibold text-muted">{l.speaker}</span>{' '}
            <InlineMarkdown>{l.text}</InlineMarkdown>
          </p>
        ))}
        <p className="prose-col text-base font-medium">
          <InlineMarkdown>{decision.prompt}</InlineMarkdown>
        </p>
      </div>

      {hasDialogue(decision) ? (
        <div className="mt-3">
          <DialoguePanel dv={dv} onResolve={(optionId, path) => answer([optionId], false, path)} />
        </div>
      ) : (
        <div role="group" aria-labelledby={titleId} className="mt-3 space-y-2">
          {dv.options.map((ov, i) => (
            <button
              key={ov.option.id}
              type="button"
              disabled={!ov.available}
              className="flex w-full min-h-tap-min items-start gap-2 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-accent hover:bg-surface-2 disabled:bg-disabled-bg disabled:text-disabled-fg"
              onClick={() => answer([ov.option.id], false)}
            >
              <span className="num mt-0.5 shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 text-sm">
                {letterFor(i)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{ov.option.label}</span>
                <span className="block text-sm text-muted">
                  {ov.available
                    ? optionEffectLine(ov.option, scenario.kpis)
                    : (ov.reason ?? '지금은 선택할 수 없습니다')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 flex items-center gap-1 text-sm text-muted">
        <Icon name="clock" size={14} />
        응답이 없으면 기본 응답으로 처리됩니다
      </p>
    </Dialog>
  )
}
