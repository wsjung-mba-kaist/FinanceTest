import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isEditableTarget } from '../../lib/keyboard'
import { useBreakpoint } from '../../lib/useMediaQuery'
import { useGameStore } from '../../store/gameStore'
import { HelpApiContext, type HelpApi, type HelpContextValue, type HelpTarget } from './helpContext'
import { HelpSheet } from './HelpSheet'
import { tabsFor } from './helpMeta'

const DEFAULT_TARGET: HelpTarget = { tab: 'search' }

/**
 * 도움 시스템의 배선점. 페이지는 자기 맥락을 `context`로 넘기고 감싸기만 하면 된다.
 *
 * ```tsx
 * <HelpProvider context={{ page: 'play', scenario, state, view }}>…</HelpProvider>
 * ```
 *
 * 트리 어디서든 `useHelp().open({ tab: 'kpis', anchor: 'cash' })`로 시트를 연다.
 * 전역 `?`/`H`가 시트를 토글하되 입력 중일 때는 무시한다.
 */
export function HelpProvider({
  context,
  children,
  /** 단축키 등록을 끈다(테스트·중첩 방지용). */
  shortcuts = true,
}: {
  context: HelpContextValue
  children?: ReactNode
  shortcuts?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<HelpTarget>(() => ({
    tab: tabsFor(context)[0] ?? 'search',
  }))
  const mobile = useBreakpoint() === 'mobile'
  const mode = useGameStore((s) => s.run?.mode)
  const hintsRevealed = useGameStore((s) => s.run?.hintsRevealed)

  const openHelp = useCallback(
    (next?: HelpTarget) => {
      setTarget(next ?? { tab: tabsFor(context)[0] ?? DEFAULT_TARGET.tab })
      setOpen(true)
    },
    [context],
  )
  const closeHelp = useCallback(() => setOpen(false), [])

  const badge = useMemo(() => {
    if (context.page !== 'play' || mode === 'expert') return 0
    const levels = new Map<string, Set<number>>()
    for (const h of context.view.hints) {
      const key = h.decisionId ?? `turn:${context.state.turnIndex}`
      const set = levels.get(key) ?? new Set<number>()
      set.add(h.level)
      levels.set(key, set)
    }
    let n = 0
    for (const [key, set] of levels) {
      const revealed = hintsRevealed?.[key] ?? 0
      for (const l of set) if (l > revealed) n += 1
    }
    return n
  }, [context, mode, hintsRevealed])

  const api = useMemo<HelpApi>(
    () => ({ open: openHelp, close: closeHelp, isOpen: open, badge }),
    [openHelp, closeHelp, open, badge],
  )

  useEffect(() => {
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts])

  return (
    <HelpApiContext.Provider value={api}>
      {children}
      <HelpSheet
        context={context}
        target={target}
        onTarget={setTarget}
        open={open}
        onClose={closeHelp}
        mobile={mobile}
      />
    </HelpApiContext.Provider>
  )
}
