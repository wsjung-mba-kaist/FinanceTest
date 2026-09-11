import { useEffect, useMemo, useRef, useState } from 'react'
import type { DecisionView, PreviewResult } from '../../engine'
import { previewOption } from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button, Card, LiveRegion } from '../ui'
import { Markdown } from '../knowledge/Markdown'
import { CountdownRing } from './CountdownRing'
import { ImpactPreview } from './ImpactPreview'
import { InlineCard } from './InlineCard'
import { OptionCard } from './OptionCard'
import { usePlay } from './playContext'
import { letterFor, previewFidelity, timerConfig, type PreviewState } from './playHelpers'

function useCountdown(limitMs: number, enabled: boolean, onExpire: () => void) {
  const [remainingMs, setRemaining] = useState(limitMs)
  const [paused, setPaused] = useState(false)
  const fired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  useEffect(() => {
    if (!enabled || paused || remainingMs <= 0) return
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const dt = now - last
      last = now
      setRemaining((prev) => Math.max(0, prev - dt))
    }, 250)
    return () => window.clearInterval(id)
    // Restart the interval only when pause/enabled flips, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused])
  useEffect(() => {
    if (enabled && remainingMs <= 0 && !fired.current) {
      fired.current = true
      onExpireRef.current()
    }
  }, [enabled, remainingMs])
  return {
    remainingMs,
    paused,
    togglePause: () => setPaused((p) => !p),
    expired: enabled && remainingMs <= 0,
  }
}

/**
 * An unresolved decision: prompt, context, pre-decision concept cards, options (radio/checkbox group with
 * roving tabindex), rationale memo, and the two-step confirmation. Owns the per-decision timer.
 */
export function DecisionCard({
  dv,
  index,
  onPreview,
  onConfirmed,
  sticky,
}: {
  dv: DecisionView
  index: number
  onPreview: (p: PreviewState | null) => void
  onConfirmed: (message: string) => void
  sticky: boolean
}) {
  const { scenario, state, mode } = usePlay()
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

  const [selected, setSelected] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; result: PreviewResult } | null>(null)
  const [focusIdx, setFocusIdx] = useState(() =>
    Math.max(
      0,
      dv.options.findIndex((o) => o.available),
    ),
  )
  const [timerMsg, setTimerMsg] = useState('')
  // Concepts not yet viewed when the card mounted; kept for the card's lifetime so it does not vanish on expand.
  const [missingConcepts] = useState(() =>
    (decision.requiredConcepts ?? []).filter((id) => !cardsViewed.includes(id)),
  )

  const startedAt = useRef(Date.now())
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const openBtn = useRef<HTMLButtonElement>(null)
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
    setConfirming(false)
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

  // ---------------------------------------------------------------- preview (debounced)
  const lastSelected = selected[selected.length - 1] ?? null
  const activeId = [hoverId, focusId, lastSelected].find((id) => id && availability.get(id)) ?? null
  /** Option under which the preview block is rendered (expert mode shows the "자체 판단" line only). */
  const shownId = fidelity === 'none' ? (hoverId ?? focusId ?? lastSelected) : activeId
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
  const memoRef = useRef(memo)
  memoRef.current = memo
  const { remainingMs, paused, togglePause, expired } = useCountdown(
    timer?.limitMs ?? 0,
    Boolean(timer),
    () => {
      const def = decision.defaultOptionId
      if (def && timer) {
        const ok = choose(decision.id, [def], {
          timedOut: true,
          elapsedMs: timer.limitMs,
          memo: memoRef.current.trim() || undefined,
        })
        if (ok) onConfirmed('시간이 만료되어 기본 선택지로 확정되었습니다')
        else setTimerMsg('시간이 만료되었습니다')
      } else {
        setTimerMsg('시간이 만료되었습니다')
      }
    },
  )
  const warned = useRef<{ 30?: boolean; 10?: boolean }>({})
  useEffect(() => {
    if (!timer) return
    const s = Math.ceil(remainingMs / 1000)
    if (s <= 10 && s > 0 && !warned.current[10] && timer.limitMs > 11_000) {
      warned.current[10] = true
      setTimerMsg('남은 시간 10초')
    } else if (s <= 30 && s > 10 && !warned.current[30] && timer.limitMs > 31_000) {
      warned.current[30] = true
      setTimerMsg('남은 시간 30초')
    }
  }, [remainingMs, timer])

  // ---------------------------------------------------------------- confirm
  const canConfirm = selected.length >= sel.min && selected.length <= sel.max && !expired
  const openConfirm = () => {
    if (!canConfirm) return
    setConfirming(true)
  }
  useEffect(() => {
    if (confirming) confirmBtn.current?.focus()
  }, [confirming])
  const cancelConfirm = () => {
    setConfirming(false)
    openBtn.current?.focus()
  }
  const doConfirm = () => {
    const ok = choose(decision.id, selected, {
      memo: memo.trim() || undefined,
      elapsedMs: Date.now() - startedAt.current,
    })
    setAttempted(true)
    if (ok) onConfirmed('확정되었습니다')
    else setConfirming(false)
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
  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (confirming) doConfirm()
      else openConfirm()
    } else if (e.key === 'Escape' && confirming) {
      e.preventDefault()
      cancelConfirm()
    }
  }

  const selectedLetters = selected
    .map((id) => letterFor(dv.options.findIndex((o) => o.option.id === id)))
    .filter((l) => l !== letterFor(-1))
  const groupHint = multi
    ? `${sel.min}개 이상 ${sel.max}개 이하 선택${decision.exclusive?.length ? ' · 일부 선택지는 함께 고를 수 없습니다' : ''}`
    : '하나만 선택'

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      className="overflow-hidden"
      onKeyDown={onCardKeyDown}
    >
      <LiveRegion
        message={timerMsg}
        assertive={timerMsg.includes('10초') || timerMsg.includes('만료')}
      />
      <header className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-muted">결정 {index + 1}</div>
          <h3 id={titleId} className="text-[15px] font-semibold leading-tight">
            {decision.title}
          </h3>
        </div>
        {timer && (
          <div className="flex shrink-0 items-center gap-1">
            <CountdownRing remainingMs={remainingMs} totalMs={timer.limitMs} paused={paused} />
            {timer.pausable && !expired && (
              <Button size="sm" variant="ghost" aria-pressed={paused} onClick={togglePause}>
                {paused ? '재개' : '일시정지'}
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-2 px-3 pt-2">
        <p className="text-[13px] font-medium leading-relaxed">{decision.prompt}</p>
        {decision.context && (
          <Markdown className="text-[12px] leading-relaxed text-muted">{decision.context}</Markdown>
        )}
        {mode !== 'expert' &&
          missingConcepts.map((id) => (
            <InlineCard
              key={id}
              cardId={id}
              prefix="이 결정에 앞서:"
              defaultOpen={mode === 'guided'}
              onOpen={markCardViewed}
            />
          ))}
      </div>

      <div
        role={multi ? 'group' : 'radiogroup'}
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-hint`}
        className="space-y-2 px-3 pt-3"
        onKeyDown={onGroupKeyDown}
      >
        <div id={`${titleId}-hint`} className="text-[11px] text-muted">
          {groupHint} · 숫자키 1–{Math.min(5, dv.options.length)}로 선택
        </div>
        {dv.options.map((ov, i) => (
          <OptionCard
            key={ov.option.id}
            ov={ov}
            letter={letterFor(i)}
            role={multi ? 'checkbox' : 'radio'}
            checked={selected.includes(ov.option.id)}
            tabIndex={i === focusIdx ? 0 : -1}
            buttonRef={(el) => {
              buttons.current[i] = el
            }}
            onSelect={() => {
              setFocusIdx(i)
              toggle(ov.option.id)
            }}
            onHoverChange={(h) => setHoverId(h ? ov.option.id : null)}
            onFocusChange={(f) => {
              if (f) setFocusIdx(i)
              setFocusId(f ? ov.option.id : null)
            }}
          >
            {shownId === ov.option.id && (
              <ImpactPreview
                fidelity={fidelity}
                option={ov.option}
                result={preview?.id === ov.option.id ? preview.result : undefined}
                kpis={scenario.kpis}
                units={scenario.units}
                thresholds={thresholds}
              />
            )}
          </OptionCard>
        ))}
      </div>

      <div className="px-3 pt-3">
        <label className="block text-[12px]">
          <span className="text-muted">근거 메모(선택)</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px]"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="이 선택을 한 이유를 짧게 적어 두면 디브리핑에서 다시 볼 수 있습니다"
          />
        </label>
      </div>

      <div
        className={`mt-3 border-t border-border bg-surface px-3 py-2 ${sticky ? 'sticky bottom-0 z-10' : ''}`}
      >
        {attempted && lastError && (
          <p
            role="alert"
            className="mb-2 rounded border border-critical/40 bg-critical-bg px-2 py-1 text-[12px] text-critical"
          >
            {lastError}
          </p>
        )}
        {expired && !decision.defaultOptionId && (
          <p className="mb-2 text-[12px] text-warning">
            시간이 만료되었습니다. 이 결정은 더 이상 확정할 수 없습니다.
          </p>
        )}
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="확정 확인">
            <span className="text-[13px]">확정하시겠습니까? 되돌릴 수 없습니다</span>
            <span className="ml-auto flex gap-2">
              <Button ref={confirmBtn} variant="primary" onClick={doConfirm}>
                확정
              </Button>
              <Button variant="secondary" onClick={cancelConfirm}>
                취소
              </Button>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted">
              {selectedLetters.length > 0
                ? `선택: ${selectedLetters.join(', ')}`
                : '선택지를 골라 주세요'}
            </span>
            <Button
              ref={openBtn}
              variant="primary"
              className="ml-auto min-h-[44px] sm:min-h-0"
              disabled={!canConfirm}
              onClick={openConfirm}
            >
              결정 확정
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
