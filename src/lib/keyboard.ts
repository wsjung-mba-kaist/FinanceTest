import { useEffect, useRef } from 'react'

export type Zone = 1 | 2 | 3

/** DOM ids of the three play-view zones (Alt+1/2/3). */
export const ZONE_IDS: Record<Zone, string> = {
  1: 'zone-feed',
  2: 'zone-decisions',
  3: 'zone-dashboard',
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Alt+1 · 2 · 3', label: '상황 · 결정 · 지표 영역으로 이동' },
  { keys: '↑ ↓', label: '선택지 사이 이동' },
  { keys: '1–5', label: '선택지 고르기 (선택지에 포커스가 있을 때)' },
  { keys: 'Ctrl+Enter', label: '결정 확정 단계 열기' },
  { keys: 'A', label: '조언자 패널 열기·닫기' },
  { keys: 'Esc', label: '패널·메뉴 닫기' },
  { keys: '?', label: '단축키 도움말 열기·닫기' },
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
  onToggleAdvisor?: () => void
}

/** Window-level shortcuts for the play view. Letter keys are ignored while typing. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === '1' || e.key === '2' || e.key === '3')
      ) {
        e.preventDefault()
        h.onZone?.(Number(e.key) as Zone)
        return
      }
      if (isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        h.onToggleHelp?.()
        return
      }
      if (e.key === 'a' || e.key === 'A') h.onToggleAdvisor?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
