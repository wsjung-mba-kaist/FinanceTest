import { useEffect, useMemo, useRef } from 'react'
import type { DecisionView, DialogueView } from '../../engine'
import { dialogueView } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { Button, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { usePlay } from './playContext'
import { replyKeyFor } from './playHelpers'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

const EMPTY: string[] = []

/**
 * A multi-step conversation with a counterparty (supervisor, acquirer, desk), rendered as a
 * transcript that grows as the exchange proceeds: what they said, what you answered, what they
 * said next. The current step's replies are large buttons (숫자키 1–4), and `한 단계 되돌리기`
 * takes the last answer back as long as the dialogue has not resolved.
 *
 * The in-progress path lives in the **store**, never in `GameState` — an unfinished conversation is
 * UI state. When the walk reaches a `resolvesTo`, the panel hands that option id to `onResolve`,
 * which is the ordinary commit flow: the undo toast, the consequence reel, the log and the replay
 * all keep working, because what is committed is still one of the decision's own options.
 */
export function DialoguePanel({
  dv,
  onResolve,
  onClose,
  autoFocus = true,
}: {
  dv: DecisionView
  /** Commit the resolved option. The `path` belongs on the `DecisionRecord`. */
  onResolve: (optionId: string, path: string[]) => void
  /** Called on Esc **only before the first reply** — a conversation already under way is not a dialog you dismiss. */
  onClose?: () => void
  autoFocus?: boolean
}) {
  const { state } = usePlay()
  const decision = dv.decision
  const path = useGameStore((s) => s.dialoguePaths[decision.id]) ?? EMPTY
  const dialogueReply = useGameStore((s) => s.dialogueReply)
  const dialogueBack = useGameStore((s) => s.dialogueBack)

  // Always built from the store's in-progress path: `dv.dialogue` is whatever the page-level
  // `getTurnView` happened to know, and only carries a path once the decision is in the log.
  const view: DialogueView | undefined = useMemo(
    () => dialogueView(state, decision, path),
    [state, decision, path],
  )

  const groupRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const resolvedRef = useRef<string | null>(null)
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  const stepId = view?.step?.id
  const resolvedOptionId = view?.resolvedOptionId

  // Hand the resolved option to the commit flow exactly once per resolution.
  useEffect(() => {
    if (!resolvedOptionId) {
      resolvedRef.current = null
      return
    }
    const key = `${resolvedOptionId}:${path.join('/')}`
    if (resolvedRef.current === key) return
    resolvedRef.current = key
    onResolveRef.current(resolvedOptionId, [...path])
  }, [resolvedOptionId, path])

  // Each new beat moves focus to its first reply, so the keyboard never falls out of the dialogue.
  useEffect(() => {
    if (!autoFocus || !stepId) return
    buttons.current[0]?.focus()
  }, [stepId, autoFocus])

  if (!view) return null
  const started = view.path.length > 0
  const resolvedLabel = resolvedOptionId
    ? (decision.options.find((o) => o.id === resolvedOptionId)?.label ?? resolvedOptionId)
    : undefined

  const answer = (replyId: string) => dialogueReply(decision.id, replyId)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Guard the host modal: only an untouched conversation can be walked away from.
      if (started) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      onClose?.()
      return
    }
    if (e.key === 'Backspace') {
      if (!started || resolvedOptionId) return
      e.preventDefault()
      dialogueBack(decision.id)
      return
    }
    if (/^[1-4]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const reply = view.replies[Number(e.key) - 1]
      if (!reply) return
      e.preventDefault()
      answer(reply.id)
    }
  }

  const titleId = `dialogue-${decision.id}-title`
  return (
    <section
      ref={groupRef}
      className="space-y-2"
      aria-labelledby={titleId}
      data-dialogue={decision.id}
      onKeyDown={onKeyDown}
    >
      <h4 id={titleId} className="label-caps">
        대화 {view.transcript.length + (resolvedOptionId ? 0 : 1)}/{decision.steps?.length ?? 1}단계
      </h4>

      <div
        role="log"
        aria-live="polite"
        aria-label="대화 기록"
        className="space-y-2 rounded-md border border-border bg-surface-2 px-3 py-2"
      >
        {view.transcript.map(({ step, reply }) => (
          <div key={step.id} className="space-y-1">
            {step.lines.map((l, i) => (
              <p key={`${step.id}-${i}`} className="prose-col text-base">
                <span className="font-semibold text-muted">{l.speaker}</span>{' '}
                <InlineMarkdown>{l.text}</InlineMarkdown>
              </p>
            ))}
            <p className="prose-col rounded-sm bg-accent-soft px-2 py-1 text-base">
              <span className="font-semibold text-muted">나</span> {reply.label}
            </p>
          </div>
        ))}
        {view.step && (
          <div className="space-y-1">
            {view.step.lines.map((l, i) => (
              <p key={`${view.step!.id}-${i}`} className="prose-col text-base">
                <span className="font-semibold text-muted">{l.speaker}</span>{' '}
                <InlineMarkdown>{l.text}</InlineMarkdown>
              </p>
            ))}
          </div>
        )}
        {resolvedLabel && (
          <p className="prose-col text-base text-muted">대화가 끝났습니다 — {resolvedLabel}</p>
        )}
      </div>

      {view.invalid && (
        <p role="alert" className="text-sm text-warning">
          이전 대화를 이어갈 수 없어 처음부터 다시 시작합니다.
        </p>
      )}

      {view.step && (
        <div role="group" aria-labelledby={titleId} className="space-y-2">
          {view.step.note && (
            <p className="text-sm text-muted">
              <InlineMarkdown>{view.step.note}</InlineMarkdown>
            </p>
          )}
          <p className="text-sm text-muted">숫자키 1–{Math.min(4, view.replies.length)}로 응답</p>
          {view.replies.map((reply, i) => (
            <button
              key={reply.id}
              type="button"
              ref={(el) => {
                buttons.current[i] = el
              }}
              data-reply={reply.id}
              className="flex min-h-tap-min w-full items-start gap-2 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-accent hover:bg-surface-2"
              onClick={() => answer(reply.id)}
            >
              <span
                className="num mt-0.5 shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 text-sm"
                aria-hidden="true"
              >
                {replyKeyFor(i)}
              </span>
              <span className="min-w-0 flex-1 text-base font-medium">{reply.label}</span>
            </button>
          ))}
          {view.replies.length === 0 && (
            <p className="text-sm text-warning">
              지금 조건에서는 답할 수 있는 말이 없습니다. 한 단계 되돌려 주세요.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={!started || Boolean(resolvedOptionId)}
          aria-keyshortcuts="Backspace"
          onClick={() => dialogueBack(decision.id)}
        >
          <Icon name="chevron-left" size={14} />한 단계 되돌리기
        </Button>
        {resolvedLabel && (
          <Button variant="primary" onClick={() => onResolve(resolvedOptionId!, [...path])}>
            이대로 확정
          </Button>
        )}
      </div>
      <LiveRegion message={resolvedLabel ? `대화 종료 — ${resolvedLabel}` : ''} />
    </section>
  )
}
