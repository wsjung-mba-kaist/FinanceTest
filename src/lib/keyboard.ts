import { useEffect, useRef } from 'react'

/** Focusable zones of the situation-room screen (Alt+1…5). */
export type Zone = 1 | 2 | 3 | 4 | 5

export const ZONE_IDS: Record<Zone, string> = {
  1: 'zone-situation',
  2: 'zone-decisions',
  3: 'zone-dashboard',
  4: 'zone-feed',
  5: 'zone-log',
}

export const ZONE_LABELS: Record<Zone, string> = {
  1: '상황실',
  2: '결정 독',
  3: '대시보드',
  4: '피드 전체',
  5: '로그',
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Alt+1 … 5', label: '상황실 · 결정 · 대시보드 · 피드 · 로그로 이동' },
  { keys: '↑ ↓', label: '선택지 사이 이동' },
  { keys: '1–5', label: '선택지 고르기 (선택지에 포커스가 있을 때)' },
  { keys: 'Ctrl+Enter', label: '결정 확정' },
  { keys: 'Z', label: '방금 내린 결정 실행 취소 (5초 이내)' },
  { keys: 'Space', label: '결과 재생 건너뛰기 · 시계 일시정지·재개' },
  { keys: '+ / -', label: '시계 속도 올리기·내리기 (×1 ×2 ×4)' },
  { keys: 'N', label: '다음 턴으로' },
  { keys: '? 또는 H', label: '도움 열기·닫기' },
  { keys: 'Esc', label: '패널·메뉴 닫기' },
]

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function focusZone(zone: Zone): boolean {
  const el = document.getElementById(ZONE_IDS[zone])
  if (!el) return false
  el.focus()
  return true
}

export interface ShortcutHandlers {
  onZone?: (zone: Zone) => void
  onToggleHelp?: () => void
  /** Advance to the next turn (N). Ignored when the turn is not complete. */
  onNextTurn?: () => void
  /** Undo the last decision while the undo window is open (Z). */
  onUndo?: () => void
  /** Skip the consequence reel (Space). Only wired while a reel is playing. */
  onSkipReel?: () => void
  /**
   * Pause/resume the simulated clock (Space) — or start the turn while the intro card is up.
   * Only wired when the current turn actually has sub-turn ticks; a reel being played wins.
   */
  onToggleClock?: () => void
  /** Clock speed step (+ / -). Only wired on ticked turns. */
  onSpeedStep?: (delta: 1 | -1) => void
}

/** Window-level shortcuts for the play view. Letter keys are ignored while typing. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        h.onZone?.(Number(e.key) as Zone)
        return
      }
      if (isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === ' ' || e.key === 'Spacebar') {
        const handler = h.onSkipReel ?? h.onToggleClock
        if (!handler) return
        e.preventDefault()
        handler()
        return
      }
      if (e.key === '+' || e.key === '=') {
        if (!h.onSpeedStep) return
        e.preventDefault()
        h.onSpeedStep(1)
        return
      }
      if (e.key === '-' || e.key === '_') {
        if (!h.onSpeedStep) return
        e.preventDefault()
        h.onSpeedStep(-1)
        return
      }
      if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        h.onToggleHelp?.()
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        h.onNextTurn?.()
        return
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        h.onUndo?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
