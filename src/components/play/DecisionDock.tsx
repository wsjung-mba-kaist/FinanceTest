import { useEffect, useMemo, useRef, useState } from 'react'
import type { Decision, DecisionView, FeedItem, MetricDelta, PreviewResult } from '../../engine'
import {
  buildConditionContext,
  diffSnapshots,
  evaluate,
  hasDialogue,
  latestSnapshot,
  previewOption,
} from '../../engine'
import { useResponseCountdown } from '../../lib/useResponseCountdown'
import { splitOptionLabel } from '../../lib/text'
import { mergeThresholds } from '../../metrics/thresholds'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useHelp } from '../help/helpContext'
import { Badge, Button, Card, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { Markdown } from '../knowledge/Markdown'
import { ConsequenceReel } from './ConsequenceReel'
import { CountdownRing } from './CountdownRing'
import { DialoguePanel } from './DialoguePanel'
import { ImpactPreview } from './ImpactPreview'
import { InlineCard } from './InlineCard'
import { OptionComparison } from './OptionComparison'
import { OptionRow } from './OptionRow'
import { RationalePanel } from './RationalePanel'
import type { ReelStep } from './reelSteps'
import { usePlay } from './playContext'
import {
  deadlineCaption,
  letterFor,
  previewFidelity,
  rationaleTiming,
  tickLabelOf,
  timerConfig,
  type PreviewState,
  type RevealTiming,
} from './playHelpers'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

/**
 * 한 결정에 대해 플레이어가 «아직 확정하지 않고 적어 둔 것».
 *
 * `DecisionBlock` 은 열린 결정 하나만 마운트되고 `key` 가 결정 id 라, 다른 결정을 열었다 돌아오면
 * 통째로 새로 만들어진다. 예전에는 그래서 잃는 것이 메모 하나였는데, 판단 기록 세 칸이 생기면서
 * 한 번의 전환으로 네 칸이 사라지고 응답 시간까지 처음부터 다시 시작했다. 한 턴에 결정이 둘
 * 이상 열리는 시나리오에서 실제로 밟는 경로다. 그래서 초안은 독(dock)이 들고 있는다.
 */
export interface DecisionDraft {
  memo: string
  reasoning: { evidence: string; assumption: string; reconsiderWhen: string }
  /** 이 결정에 실제로 머문 시간의 합. 디브리핑의 «소요 N초» 가 이 값이다. */
  elapsedMs: number
  /** 이미 태운 응답 예산. 돌아왔을 때 처음부터가 아니라 남은 만큼으로 재개한다. */
  burnedMs: number
}

const EMPTY_DRAFT: DecisionDraft = {
  memo: '',
  reasoning: { evidence: '', assumption: '', reconsiderWhen: '' },
  elapsedMs: 0,
  burnedMs: 0,
}

/**
 * An unresolved decision. Ports the whole selection model of the old `DecisionCard`
 * (radio/checkbox group by `select.max`, exclusive groups, roving tabindex, 1–5, Ctrl+Enter)
 * and drops the second confirmation step: 확정 is one click.
 */
function DecisionBlock({
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

  const [selected, setSelected] = useState<string[]>([])
  const { memo, reasoning } = draft
  const setMemo = (v: string) => onDraft({ memo: v })
  const setReasoning = (patch: Partial<DecisionDraft['reasoning']>) =>
    onDraft({ reasoning: { ...draftRef.current.reasoning, ...patch } })
  const savedReasoning = () =>
    Object.values(draftRef.current.reasoning).some((v) => v.trim())
      ? { ...draftRef.current.reasoning }
      : undefined
  const written = Boolean(memo.trim()) || Object.values(reasoning).some((v) => v.trim())
  const [memoOpen, setMemoOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(mode === 'guided')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; result: PreviewResult } | null>(null)
  const [focusIdx, setFocusIdx] = useState(() =>
    Math.max(
      0,
      dv.options.findIndex((o) => o.available),
    ),
  )
  const [timerMsg, setTimerMsg] = useState('')
  const [missingConcepts] = useState(() =>
    (decision.requiredConcepts ?? []).filter((id) => !cardsViewed.includes(id)),
  )

  const startedAt = useRef(Date.now())
  const draftRef = useRef(draft)
  draftRef.current = draft
  const onDraftRef = useRef(onDraft)
  onDraftRef.current = onDraft
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const confirmBtn = useRef<HTMLButtonElement>(null)
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview

  // ---------------------------------------------------------------- selection
  const availability = useMemo(
    () => new Map(dv.options.map((o) => [o.option.id, o.available])),
    [dv.options],
  )
  const toggle = (id: string) => {
    if (!availability.get(id)) return
    if (!multi) {
      setSelected([id])
      return
    }
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      const groups = (decision.exclusive ?? []).filter((g) => g.includes(id))
      const kept = prev.filter((x) => !groups.some((g) => g.includes(x)))
      if (kept.length >= sel.max) return prev
      return [...kept, id]
    })
  }

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
  const timer = useMemo(
    () => timerConfig(decision, mode, timersEnabled),
    [decision, mode, timersEnabled],
  )
  // 남은 예산으로 재개한다 — 다른 결정을 잠깐 보고 왔다고 시간이 되돌아가지도, 사라지지도 않는다.
  const budgetMs = Math.max(0, (timer?.limitMs ?? 0) - draft.burnedMs)
  const { remainingMs, paused, stopped, togglePause, expired } = useResponseCountdown(
    budgetMs,
    Boolean(timer) && due,
    () => {
      const def = decision.defaultOptionId
      if (def && timer) {
        const ok = choose(decision.id, [def], {
          timedOut: true,
          elapsedMs: timer.limitMs,
          memo: draftRef.current.memo.trim() || undefined,
          reasoning: savedReasoning(),
        })
        if (ok) onCommitted('시간이 만료되어 기본 선택지로 확정되었습니다')
        else setTimerMsg('시간이 만료되었습니다')
      } else {
        setTimerMsg('시간이 만료되었습니다. 이 결정은 계속 확정하실 수 있습니다')
      }
    },
    /**
     * 도움 시트가 열려 있으면 예산을 멈춘다 — **모드와 무관하게.**
     *
     * 사건 시계(`useSimulationClock`)는 이미 모드와 무관하게 멈춘다. 그런데 여기만 전문가 모드를
     * 빼 두어서, 화면이 «시계가 멈췄습니다» 라고 적는 동안 응답 예산만 타는 상태가 있었다.
     * 전문가 모드의 도움 시트는 지표 설명(단위·기간·기준) 한 탭만 연다 — 사후 정보가 아니라
     * 지금 화면의 숫자가 무엇을 재는가이고, 그걸 읽는 데 시간을 물릴 이유가 없다.
     */
    help.isOpen,
  )
  // 이 결정을 떠날 때, 머문 시간과 태운 예산을 초안에 남긴다.
  useEffect(
    () => () => {
      const limit = timerRef.current?.limitMs ?? 0
      onDraftRef.current({
        elapsedMs: draftRef.current.elapsedMs + (Date.now() - startedAt.current),
        burnedMs: limit > 0 ? limit - remainingRef.current : 0,
      })
    },
    [],
  )
  const remainingRef = useRef(remainingMs)
  remainingRef.current = remainingMs
  const timerRef = useRef(timer)
  timerRef.current = timer
  const warned = useRef<{ 30?: boolean; 10?: boolean }>({})
  useEffect(() => {
    if (!timer || !due) return
    const s = Math.ceil(remainingMs / 1000)
    if (s <= 10 && s > 0 && !warned.current[10] && timer.limitMs > 11_000) {
      warned.current[10] = true
      setTimerMsg('남은 시간 10초')
    } else if (s <= 30 && s > 10 && !warned.current[30] && timer.limitMs > 31_000) {
      warned.current[30] = true
      setTimerMsg('남은 시간 30초')
    }
  }, [remainingMs, timer, due])

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
      elapsedMs: draft.elapsedMs + (Date.now() - startedAt.current),
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
      elapsedMs: draft.elapsedMs + (Date.now() - startedAt.current),
      path,
    })
    setAttempted(true)
    if (ok) onCommitted('확정되었습니다')
  }

  // ---------------------------------------------------------------- keyboard
  const moveTo = (idx: number) => {
    const n = dv.options.length
    if (n === 0) return
    const i = ((idx % n) + n) % n
    setFocusIdx(i)
    buttons.current[i]?.focus()
    const o = dv.options[i]
    if (!multi && o?.available) toggle(o.option.id)
  }
  const onGroupKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        moveTo(focusIdx + 1)
        return
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        moveTo(focusIdx - 1)
        return
      case 'Home':
        e.preventDefault()
        moveTo(0)
        return
      case 'End':
        e.preventDefault()
        moveTo(dv.options.length - 1)
        return
      default:
        if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const idx = Number(e.key) - 1
          const o = dv.options[idx]
          if (!o) return
          e.preventDefault()
          setFocusIdx(idx)
          buttons.current[idx]?.focus()
          if (o.available) toggle(o.option.id)
        }
    }
  }
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
      <div className="px-3 pt-2">
        <button
          type="button"
          aria-expanded={memoOpen}
          className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
          onClick={() => setMemoOpen((o) => !o)}
        >
          {/* 칸이 넷인데 «근거 메모» 라는 이름과 `memo` 하나만 세고 있었다 — 근거·가정·재검토
              조건만 적은 사람에게 접힌 컨트롤이 «적어 둔 것 없음» 이라고 말했다. */}
          판단 기록{written ? ' (작성됨)' : ' (선택)'}
          <Icon name={memoOpen ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
        {memoOpen && (
          <div className="space-y-2">
            <label className="mt-1 block text-sm">
              <span className="sr-only">근거 메모</span>
              <textarea
                className="w-full rounded-md border border-border-control bg-bg px-2 py-1.5 text-base"
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="이 선택을 한 이유를 짧게 적어 두면 디브리핑에서 다시 볼 수 있습니다"
              />
            </label>
            {(
              [
                ['evidence', '확인한 근거'],
                ['assumption', '아직 확인하지 못한 가정'],
                ['reconsiderWhen', '판단을 바꿀 조건'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span>{label} (선택)</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-border-control bg-bg px-2 py-1.5 text-base"
                  rows={2}
                  value={reasoning[key]}
                  onChange={(e) => setReasoning({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}
      </div>

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

/** A resolved decision: one line, the reel it produced, and the rationale below it. */
function ResolvedRow({
  dv,
  index,
  timing,
  showRationale,
  feedItems,
  turnDeltas,
  reel,
  skipSignal,
  onReelDone,
}: {
  dv: DecisionView
  index: number
  timing: RevealTiming
  showRationale: boolean
  feedItems: FeedItem[]
  turnDeltas: MetricDelta[]
  /** The engine reel to play under this row (only when it was caused by this decision). */
  reel?: ReelBinding
  skipSignal: number
  onReelDone: () => void
}) {
  const { scenario, state } = usePlay()
  const [open, setOpen] = useState(false)
  const record = state.decisions.find(
    (r) => r.turnIndex === state.turnIndex && r.decisionId === dv.decision.id,
  )
  const chosen = dv.chosen.map((id) => ({
    id,
    letter: letterFor(dv.options.findIndex((o) => o.option.id === id)),
    title: splitOptionLabel(dv.decision.options.find((o) => o.id === id)?.label ?? id).title,
  }))
  return (
    <Card
      as="article"
      className="p-3"
      aria-labelledby={`resolved-${dv.decision.id}`}
      data-resolved={dv.decision.id}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="label-caps">결정 {index + 1}</span>
        <h3 id={`resolved-${dv.decision.id}`} className="text-base font-semibold">
          {dv.decision.title}
        </h3>
        <Badge tone="positive">확정</Badge>
        {record?.timedOut && <Badge tone="warning">시간 초과 · 기본 선택</Badge>}
        {record?.hintsUsed ? <Badge tone="neutral">힌트 {record.hintsUsed}단계</Badge> : null}
        <span className="w-full text-base text-muted">
          {chosen.map((c) => `${c.letter}. ${c.title}`).join(' · ')}
        </span>
      </div>
      {dv.dialogue && dv.dialogue.transcript.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm text-muted">
            대화 기록 {dv.dialogue.transcript.length}단계
          </summary>
          <ol className="mt-1 space-y-0.5 pl-4 text-sm text-muted">
            {dv.dialogue.transcript.map(({ step, reply }) => (
              <li key={step.id}>{reply.label}</li>
            ))}
          </ol>
        </details>
      )}
      {record?.memo && (
        <p className="mt-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-sm">
          <span className="text-muted">메모 · </span>
          {record.memo}
        </p>
      )}
      {reel && reel.steps.length > 0 && (
        <div className="mt-2">
          <ConsequenceReel
            key={reel.id}
            steps={reel.steps}
            units={scenario.units}
            skipSignal={skipSignal}
            immediate={reel.played}
            onDone={onReelDone}
          />
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          aria-expanded={open}
          className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
          onClick={() => setOpen((o) => !o)}
        >
          근거 보기
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
        {open &&
          (showRationale ? (
            <RationalePanel dv={dv} feedItems={feedItems} turnDeltas={turnDeltas} />
          ) : (
            <p className="text-sm text-muted">
              {timing === 'endOfTurn'
                ? '결정 근거는 이 턴의 결정이 모두 확정되면 공개됩니다.'
                : '결정 근거는 시나리오 종료 후 디브리핑에서 공개됩니다.'}
            </p>
          ))}
      </div>
    </Card>
  )
}

/** A decision the turn will ask for, but not at this tick yet. */
function UpcomingRow({ decision, tick }: { decision: Decision; tick: number }) {
  const { view } = usePlay()
  const from = decision.availableFrom ?? 0
  return (
    <article
      className="rounded-lg bg-disabled-bg p-3 text-disabled-fg"
      aria-disabled="true"
      data-upcoming={decision.id}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-semibold">{decision.title}</h3>
        <span className="num text-sm text-muted">
          {tickLabelOf(view.turn, from)} 이후 선택 가능
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {deadlineCaption(view.turn, decision, tick) || '지금은 아직 요청받지 않았습니다'}
      </p>
    </article>
  )
}

/** The engine reel the dock is currently showing, with whether it has already been played out. */
export interface ReelBinding {
  id: string
  steps: ReelStep[]
  played: boolean
  decisionId?: string
}

/**
 * The permanently docked decision column: 지금 요청받은 것 → options → 확정(1클릭) → 결과 릴 →
 * 다음 턴. The reel is whatever `state.lastReel` the engine produced last (a decision, an answered
 * interrupt or a tick), played once per `lastReel.id`.
 */
export function DecisionDock({
  sticky,
  onPreview,
  onCommitted,
  skipSignal,
}: {
  sticky: boolean
  onPreview: (p: PreviewState | null) => void
  onCommitted: (message: string) => void
  skipSignal: number
}) {
  const { scenario, state, history, mode, view } = usePlay()
  const playedReelId = useGameStore((s) => s.playedReelId)
  const markReelPlayed = useGameStore((s) => s.markReelPlayed)
  const rationaleSetting = useSettingsStore((s) => s.rationaleReveal)

  const timing = rationaleTiming(rationaleSetting, mode)
  const showRationale = timing === 'immediate' || (timing === 'endOfTurn' && view.allResolved)
  const total = view.decisions.length
  const resolvedCount = view.decisions.filter((d) => d.resolved).length
  const turnStart = history[state.turnIndex]
  const turnDeltas = useMemo(
    () => (turnStart ? diffSnapshots(latestSnapshot(turnStart), latestSnapshot(state)) : []),
    [turnStart, state],
  )
  const firstUnresolved = view.decisions.find((d) => !d.resolved)?.decision.id

  /**
   * One unresolved decision is expanded at a time.
   *
   * Every pending decision used to be open at once: the dock opened at 740px of content on a turn
   * with three decisions, the 확정 bar of the first was already below the fold, and the reader had
   * to decide which of three half-read questions to answer first. Opening one — whichever the
   * player picks, defaulting to the first that is due — halves the first paint and makes "there is
   * exactly one primary action on screen" true by construction.
   */
  const [openId, setOpenId] = useState<string | undefined>()

  /**
   * 결정별 초안은 독이 들고 있는다 — `DecisionBlock` 이 결정마다 새로 마운트되기 때문이다.
   * 턴이 넘어가면 비운다: 다음 턴의 결정은 다른 질문이고, 남은 초안은 남의 답이다.
   */
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({})
  useEffect(() => setDrafts({}), [state.turnIndex])
  const draftOf = (id: string) => drafts[id] ?? EMPTY_DRAFT
  const patchDraft = (id: string, patch: Partial<DecisionDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY_DRAFT), ...patch } }))

  const openDecisionId =
    openId && view.decisions.some((d) => !d.resolved && d.decision.id === openId)
      ? openId
      : firstUnresolved

  // Decisions the turn authors but has not opened yet (`availableFrom` beyond the current tick).
  const upcoming = useMemo(() => {
    if (view.ticks <= 1) return []
    const ctx = buildConditionContext(state)
    return view.turn.decisions.filter(
      (d) => (d.availableFrom ?? 0) > state.tick && evaluate(d.when, ctx),
    )
  }, [view.turn, view.ticks, state])

  const reel: ReelBinding | undefined = useMemo(() => {
    const last = state.lastReel
    if (!last || last.steps.length === 0) return undefined
    // A turn-start reel repeats what the situation panel already shows: never played as a reel.
    if (last.cause.kind === 'turn') return undefined
    return {
      id: last.id,
      steps: last.steps,
      played: last.id === playedReelId,
      decisionId: last.cause.decisionId,
    }
  }, [state.lastReel, playedReelId])
  const onReelDone = () => {
    if (reel && !reel.played) markReelPlayed(reel.id)
  }
  const resolvedIds = new Set(view.decisions.filter((d) => d.resolved).map((d) => d.decision.id))
  // A reel caused by a tick or an answered interrupt has no resolved row to live under.
  const standaloneReel =
    reel && (reel.decisionId === undefined || !resolvedIds.has(reel.decisionId)) ? reel : undefined

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-md font-semibold">지금 요청받은 것</h2>
        {total > 0 && (
          <>
            <span className="num text-base text-muted">
              결정 {resolvedCount}/{total}
            </span>
            <Badge tone={view.allResolved ? 'positive' : 'neutral'}>
              {view.allResolved ? '모두 확정' : `${total - resolvedCount}건 대기`}
            </Badge>
          </>
        )}
      </div>
      {standaloneReel && (
        <ConsequenceReel
          key={standaloneReel.id}
          steps={standaloneReel.steps}
          units={scenario.units}
          skipSignal={skipSignal}
          immediate={standaloneReel.played}
          onDone={onReelDone}
        />
      )}
      {total === 0 && upcoming.length === 0 && (
        <p className="rounded-lg bg-surface-2 p-3 text-base text-muted">
          이번 턴에는 내려야 할 결정이 없습니다. 상황을 읽고 다음 턴으로 넘어가 주세요.
        </p>
      )}
      {view.decisions.map((dv, i) =>
        dv.resolved ? (
          <ResolvedRow
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            timing={timing}
            showRationale={showRationale}
            feedItems={view.feed.filter((f) => f.cause?.decisionId === dv.decision.id)}
            turnDeltas={turnDeltas}
            reel={reel?.decisionId === dv.decision.id ? reel : undefined}
            skipSignal={skipSignal}
            onReelDone={onReelDone}
          />
        ) : dv.decision.id === openDecisionId ? (
          <DecisionBlock
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            total={total}
            due={
              dv.decision.id === firstUnresolved &&
              (dv.decision.deadlineTick === undefined || state.tick >= dv.decision.deadlineTick)
            }
            sticky={sticky}
            onPreview={onPreview}
            onCommitted={onCommitted}
            draft={draftOf(dv.decision.id)}
            onDraft={(patch) => patchDraft(dv.decision.id, patch)}
          />
        ) : (
          <PendingRow
            key={`${state.turnIndex}:${dv.decision.id}`}
            dv={dv}
            index={i}
            onOpen={() => setOpenId(dv.decision.id)}
          />
        ),
      )}
      {upcoming.map((d) => (
        <UpcomingRow key={`${state.turnIndex}:${d.id}`} decision={d} tick={state.tick} />
      ))}
    </div>
  )
}

/**
 * An unresolved decision that is not the open one: title, deadline and a way in.
 *
 * The player chooses the order — this is not a wizard. What it is not is three fully expanded
 * question blocks competing for the same screen.
 */
function PendingRow({
  dv,
  index,
  onOpen,
}: {
  dv: DecisionView
  index: number
  onOpen: () => void
}) {
  const { view } = usePlay()
  const deadline =
    dv.decision.deadlineTick !== undefined
      ? tickLabelOf(view.turn, dv.decision.deadlineTick)
      : undefined
  return (
    <article className="rounded-lg border border-border-control bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-tap-min w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
        aria-label={`결정 ${index + 1} ${dv.decision.title} 열기`}
      >
        <span className="label-caps shrink-0">결정 {index + 1}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{dv.decision.title}</span>
        {deadline && <span className="num shrink-0 text-sm text-warning">{deadline}까지</span>}
        <Icon name="chevron-right" size={16} />
      </button>
    </article>
  )
}

/**
 * The dock's action bar, rendered into the zone's non-scrolling footer.
 *
 * It used to be the last child of the scrolled list, held down by `sticky bottom-0` — which an
 * ancestor's `overflow-hidden` silently disabled, so on a 1280×800 screen the 다음 턴 button
 * started every turn below the fold. Living outside the scroll box is the fix: there is nothing
 * left for a stray `overflow` to break.
 */
export function DockActionBar({ onNext }: { onNext: () => boolean }) {
  const { scenario, state, view } = usePlay()
  const lastError = useGameStore((s) => s.lastError)
  const [nextFailed, setNextFailed] = useState(false)
  const isLast = state.turnIndex >= scenario.turns.length - 1
  const handleNext = () => setNextFailed(!onNext())

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      {nextFailed && lastError && (
        <p role="alert" className="w-full text-sm text-critical">
          {lastError}
        </p>
      )}
      <span className="text-sm text-muted">
        {view.allResolved
          ? isLast
            ? '마지막 턴입니다'
            : '다음 턴으로 넘어갈 수 있습니다'
          : '필수 결정을 모두 확정하면 넘어갈 수 있습니다'}
      </span>
      <Button
        variant={view.allResolved ? 'primary' : 'secondary'}
        className="ml-auto"
        disabled={!view.allResolved}
        aria-keyshortcuts="N"
        onClick={handleNext}
      >
        {isLast ? '시나리오 마무리' : '다음 턴으로'}
        <Icon name="arrow-right" size={14} />
      </Button>
    </div>
  )
}
