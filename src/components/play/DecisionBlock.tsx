import { useEffect, useMemo, useRef, useState } from 'react'
import type { DecisionView, PreviewResult } from '../../engine'
import { hasDialogue, previewOption } from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useHelp } from '../help/helpContext'
import { Button, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { Markdown } from '../knowledge/Markdown'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'
import { CountdownRing } from './CountdownRing'
import { DialoguePanel } from './DialoguePanel'
import { ImpactPreview } from './ImpactPreview'
import { InlineCard } from './InlineCard'
import { OptionComparison } from './OptionComparison'
import { OptionRow } from './OptionRow'
import { DecisionNotes } from './DecisionNotes'
import type { DecisionDraft } from './decisionDraft'
import { useDecisionTimer } from './useDecisionTimer'
import { useOptionSelection } from './useOptionSelection'
import { usePlay } from './playContext'
import { deadlineCaption, letterFor, previewFidelity, type PreviewState } from './playHelpers'

/**
 * An unresolved decision. Ports the whole selection model of the old `DecisionCard`
 * (radio/checkbox group by `select.max`, exclusive groups, roving tabindex, 1–5, Ctrl+Enter)
 * and drops the second confirmation step: 확정 is one click.
 */
export function DecisionBlock({
  dv,
  index,
  total,
  due,
  sticky,
  onPreview,
  onCommitted,
  draft,
  onDraft,
}: {
  dv: DecisionView
  index: number
  total: number
  draft: DecisionDraft
  onDraft: (patch: Partial<DecisionDraft>) => void
  /**
   * True once this is the decision actually being asked for. On a ticked turn that means the
   * deadline tick has arrived, so the `timeLimitSec` countdown no longer burns down while the
   * player is still reading (the U1 problem the audit flagged).
   */
  due: boolean
  sticky: boolean
  onPreview: (p: PreviewState | null) => void
  onCommitted: (message: string) => void
}) {
  const { scenario, state, mode, view } = usePlay()
  const help = useHelp()
  const choose = useGameStore((s) => s.choose)
  const lastError = useGameStore((s) => s.lastError)
  const timersEnabled = useSettingsStore((s) => s.timersEnabled)
  const cardsViewed = useProgressStore((s) => s.learning.cardsViewed)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)

  const { decision } = dv
  const sel = decision.select ?? { min: 1, max: 1 }
  const multi = sel.max > 1
  const fidelity = previewFidelity(mode)
  const thresholds = useMemo(() => mergeThresholds(scenario.thresholds), [scenario])
  const titleId = `decision-${decision.id}-title`
  // A dialogue decision is answered by talking, not by picking from the list: the conversation
  // resolves to one of these same options and commits through the very same `choose()`.
  const dialogue = hasDialogue(decision)

  const { memo, reasoning } = draft
  const setMemo = (v: string) => onDraft({ memo: v })
  const setReasoning = (patch: Partial<DecisionDraft['reasoning']>) =>
    onDraft({ reasoning: { ...draftRef.current.reasoning, ...patch } })
  const savedReasoning = () =>
    Object.values(draftRef.current.reasoning).some((v) => v.trim())
      ? { ...draftRef.current.reasoning }
      : undefined
  const written = Boolean(memo.trim()) || Object.values(reasoning).some((v) => v.trim())
  const [contextOpen, setContextOpen] = useState(mode === 'guided')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; result: PreviewResult } | null>(null)
  const [missingConcepts] = useState(() =>
    (decision.requiredConcepts ?? []).filter((id) => !cardsViewed.includes(id)),
  )

  const draftRef = useRef(draft)
  draftRef.current = draft
  const onDraftRef = useRef(onDraft)
  onDraftRef.current = onDraft
  const confirmBtn = useRef<HTMLButtonElement>(null)
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview

  // ---------------------------------------------------------------- selection
  const { selected, availability, toggle, focusIdx, setFocusIdx, onGroupKeyDown, buttons } =
    useOptionSelection(dv)

  // ------------------------------------------------------- preview (debounced)
  const lastSelected = selected[selected.length - 1] ?? null
  const activeId =
    [expandedId, focusId, lastSelected].find((id) => id && availability.get(id)) ?? null
  const previewIds = useMemo(() => {
    if (!activeId) return []
    if (!multi) return [activeId]
    if (selected.includes(activeId)) return selected
    const groups = (decision.exclusive ?? []).filter((g) => g.includes(activeId))
    const kept = selected.filter((x) => !groups.some((g) => g.includes(x)))
    return kept.length >= sel.max ? [activeId] : [...kept, activeId]
  }, [activeId, multi, selected, decision.exclusive, sel.max])
  const previewKey = previewIds.join(',')
  useEffect(() => {
    if (fidelity === 'none' || !activeId) {
      setPreview(null)
      onPreviewRef.current(null)
      return
    }
    const ids = previewKey.split(',').filter(Boolean)
    const t = window.setTimeout(() => {
      const result = previewOption(state, scenario, decision.id, ids)
      setPreview({ id: activeId, result })
      onPreviewRef.current({ fidelity, deltas: result.deltas })
    }, 120)
    return () => window.clearTimeout(t)
  }, [activeId, previewKey, fidelity, state, scenario, decision.id])
  useEffect(() => () => onPreviewRef.current(null), [])

  // ---------------------------------------------------------------- timer
  const {
    timer,
    remainingMs,
    paused,
    stopped,
    togglePause,
    expired,
    timerMsg,
    setTimerMsg,
    elapsedNow,
  } = useDecisionTimer({
    decision,
    mode,
    timersEnabled,
    due,
    draft,
    onDraft,
    // 도움 시트가 열려 있으면 예산을 멈춘다 — 모드와 무관하게 (사건 시계와 같은 규칙).
    hold: help.isOpen,
    onExpired: (t) => {
      const def = decision.defaultOptionId
      if (def) {
        const ok = choose(decision.id, [def], {
          timedOut: true,
          elapsedMs: t.limitMs,
          memo: draftRef.current.memo.trim() || undefined,
          reasoning: savedReasoning(),
        })
        if (ok) onCommitted('시간이 만료되어 기본 선택지로 확정되었습니다')
        else setTimerMsg('시간이 만료되었습니다')
      } else {
        setTimerMsg('시간이 만료되었습니다. 이 결정은 계속 확정하실 수 있습니다')
      }
    },
  })

  // ---------------------------------------------------------------- confirm
  const deadlocked = expired && !decision.defaultOptionId
  const canConfirm = selected.length >= sel.min && selected.length <= sel.max
  const illegalPicked = selected.some(
    (id) => dv.options.find((o) => o.option.id === id)?.option.illegal,
  )
  const doConfirm = () => {
    if (!canConfirm) return
    const ok = choose(decision.id, selected, {
      memo: memo.trim() || undefined,
      reasoning: savedReasoning(),
      elapsedMs: elapsedNow(),
    })
    setAttempted(true)
    if (!ok) return
    onCommitted('확정되었습니다')
  }
  /** The conversation reached a `resolvesTo`: commit that option, with the walked path. */
  const resolveDialogue = (optionId: string, path: string[]) => {
    const ok = choose(decision.id, [optionId], {
      memo: memo.trim() || undefined,
      reasoning: savedReasoning(),
      elapsedMs: elapsedNow(),
      path,
    })
    setAttempted(true)
    if (ok) onCommitted('확정되었습니다')
  }

  // ---------------------------------------------------------------- keyboard
  const onBlockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      doConfirm()
    }
  }

  const deadline = deadlineCaption(view.turn, decision, state.tick)
  const selectedLetters = selected
    .map((id) => letterFor(dv.options.findIndex((o) => o.option.id === id)))
    .filter((l) => l !== letterFor(-1))
  const groupHint = multi
    ? `${sel.min}개 이상 ${sel.max}개 이하 선택${decision.exclusive?.length ? ' · 일부 선택지는 함께 고를 수 없습니다' : ''}`
    : '하나만 선택'

  return (
    <article
      className="rounded-lg border border-border-strong bg-surface shadow-card"
      aria-labelledby={titleId}
      onKeyDown={onBlockKeyDown}
    >
      <LiveRegion
        message={timerMsg}
        assertive={timerMsg.includes('10초') || timerMsg.includes('만료')}
      />
      <header className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="label-caps">
              결정 {index + 1}/{total}
            </span>
            {view.ticks > 1 && deadline && (
              <span
                className={`num text-sm ${due ? 'text-critical' : 'text-warning'}`}
                title="마감 틱이 지나면 기본 선택지가 자동으로 확정됩니다"
              >
                {deadline}
              </span>
            )}
          </div>
          <h3 id={titleId} className="prose-col text-lg font-semibold leading-tight">
            {decision.title}
          </h3>
        </div>
        {timer && due && (
          <div className="flex shrink-0 items-center gap-1">
            <CountdownRing remainingMs={remainingMs} totalMs={timer.limitMs} paused={stopped} />
            {timer.pausable && !expired && (
              <Button size="sm" variant="ghost" aria-pressed={paused} onClick={togglePause}>
                {paused ? '재개' : '일시정지'}
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-2 px-3 pt-2">
        <p className="prose-col text-base font-medium">
          <InlineMarkdown>{decision.prompt}</InlineMarkdown>
        </p>
        {decision.context && (
          <div>
            <button
              type="button"
              aria-expanded={contextOpen}
              className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
              onClick={() => setContextOpen((o) => !o)}
            >
              배경
              <Icon name={contextOpen ? 'chevron-down' : 'chevron-right'} size={14} />
            </button>
            {contextOpen && (
              <Markdown className="md-compact prose-col text-base text-muted">
                {decision.context}
              </Markdown>
            )}
          </div>
        )}
        <button
          type="button"
          className="inline-flex min-h-tap-dense items-center gap-1 text-sm text-accent"
          onClick={() => help.open({ tab: 'decision', anchor: decision.id })}
        >
          <Icon name="help" size={14} />이 결정에서 전문가는 무엇을 보나
        </button>
        {mode !== 'expert' &&
          missingConcepts.map((id) => (
            <InlineCard
              key={id}
              cardId={id}
              prefix="이 결정에 앞서:"
              // Guided mode gets the lead sentence, not the whole card: see InlineCard.
              lead
              defaultOpen={mode === 'guided'}
              onOpen={markCardViewed}
            />
          ))}
      </div>

      {dialogue ? (
        <div className="px-3 pt-3">
          <DialoguePanel dv={dv} onResolve={resolveDialogue} />
        </div>
      ) : (
        <div
          role={multi ? 'group' : 'radiogroup'}
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-hint`}
          className="space-y-2 px-3 pt-3"
          onKeyDown={onGroupKeyDown}
        >
          <div id={`${titleId}-hint`} className="text-sm text-muted">
            {groupHint} · 숫자키 1–{Math.min(5, dv.options.length)}로 선택
          </div>
          {dv.options.map((ov, i) => (
            <OptionRow
              key={ov.option.id}
              ov={ov}
              letter={letterFor(i)}
              kpis={scenario.kpis}
              mode={mode}
              role={multi ? 'checkbox' : 'radio'}
              checked={selected.includes(ov.option.id)}
              tabIndex={i === focusIdx ? 0 : -1}
              expanded={expandedId === ov.option.id}
              risk={
                preview?.id === ov.option.id && preview.result.wouldEnd
                  ? `이 선택으로 시나리오가 종료될 수 있습니다: ${preview.result.wouldEnd.title}`
                  : undefined
              }
              buttonRef={(el) => {
                buttons.current[i] = el
              }}
              onSelect={() => {
                setFocusIdx(i)
                toggle(ov.option.id)
              }}
              onToggleExpand={() =>
                setExpandedId((cur) => (cur === ov.option.id ? null : ov.option.id))
              }
              onFocusChange={(f) => {
                if (f) setFocusIdx(i)
                setFocusId(f ? ov.option.id : null)
              }}
            >
              <div className="space-y-1.5 px-3 py-2">
                <Markdown className="md-compact prose-col text-base">
                  {ov.option.description}
                </Markdown>
                {ov.option.feasibility && (
                  <p className="text-sm text-muted">
                    실행 가능성 근거: {ov.option.feasibility.basis}
                  </p>
                )}
                {!ov.available && ov.reason && (
                  <p className="text-sm text-warning">선택 불가: {ov.reason}</p>
                )}
              </div>
              <ImpactPreview
                fidelity={fidelity}
                option={ov.option}
                result={preview?.id === ov.option.id ? preview.result : undefined}
                kpis={scenario.kpis}
                units={scenario.units}
                thresholds={thresholds}
              />
            </OptionRow>
          ))}
        </div>
      )}

      {!dialogue && <OptionComparison dv={dv} />}
      <DecisionNotes
        memo={memo}
        reasoning={reasoning}
        written={written}
        onMemo={setMemo}
        onReasoning={setReasoning}
      />

      <div
        className={`mt-2 rounded-b-lg border-t border-border bg-surface px-3 py-2 ${
          sticky || due ? 'sticky bottom-0 z-10' : ''
        }`}
      >
        {attempted && lastError && (
          <p
            role="alert"
            className="mb-2 rounded-sm border border-critical-border bg-critical-bg px-2 py-1 text-sm text-critical"
          >
            {lastError}
          </p>
        )}
        {deadlocked && (
          <p className="mb-2 text-sm text-warning">
            제한 시간이 지났습니다. 기본 선택지가 지정되어 있지 않으므로 계속 확정하실 수 있습니다.
          </p>
        )}
        {dialogue ? (
          <p className="text-sm text-muted">대화가 끝나면 선택한 답변이 그대로 확정됩니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">
              {selectedLetters.length > 0
                ? `선택: ${selectedLetters.join(', ')}`
                : '선택지를 골라 주세요'}
            </span>
            <Button
              ref={confirmBtn}
              variant="primary"
              className="ml-auto"
              disabled={!canConfirm}
              aria-keyshortcuts="Control+Enter"
              onClick={doConfirm}
            >
              {illegalPicked ? '규정 위반 소지를 인지하고 확정' : '결정 확정'}
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}
