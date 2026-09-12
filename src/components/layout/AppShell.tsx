import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useHelp } from '../help/helpContext'
import { Icon } from '../ui/Icon'
import { routeWidth, widthClass } from './routeMeta'
import { CountPill } from '../ui'

const nav = [
  { to: '/', label: '시나리오' },
  { to: '/knowledge', label: '지식 베이스' },
  { to: '/progress', label: '진행 현황' },
  { to: '/settings', label: '설정' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const width = routeWidth(loc.pathname)
  const inPlay = width === 'full'
  const help = useHelp()
  const mainRef = useRef<HTMLElement>(null)

  /**
   * Move focus to the new page on a route change.
   *
   * In a client-side app nothing moves focus when the URL changes: a keyboard or screen-reader
   * user who follows a link stays wherever they were in the *old* page's tab order, and the next
   * Tab continues from a link that no longer exists.
   *
   * Keyed on `pathname` only — the debrief puts its tab in the hash, and pulling focus out of the
   * tab list every time a tab is selected would be worse than doing nothing. `/play/*` is exempt
   * too: the situation room owns its own focus (a turn change moves it to the turn header).
   */
  const prevPath = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevPath.current
    prevPath.current = loc.pathname
    // Only on a *change*. `prev === null` is the first paint, which is not a navigation, and
    // `prev === pathname` is a re-run with the same route — which StrictMode produces on every
    // mount in development. A "have I run before?" flag cannot tell those apart: StrictMode's
    // replay consumed the flag on the first pass and then focused `<main>` on the second, so the
    // app started with focus already inside the page and the very first Tab skipped past the
    // skip link. Comparing the value instead of counting the runs is idempotent by construction.
    if (inPlay || prev === null || prev === loc.pathname) return
    mainRef.current?.focus({ preventScroll: true })
  }, [loc.pathname, inPlay])

  return (
    <div
      className={`flex flex-col bg-bg text-text ${
        // The play screen is a fixed-height situation room: an exact-height chain from <html>
        // down, so no descendant has to guess the status bar's height with `calc(100dvh - 3rem)`.
        inPlay ? 'h-full overflow-hidden' : 'min-h-full'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2"
      >
        본문으로 건너뛰기
      </a>
      {!inPlay && (
        <header className="border-b border-border bg-surface" data-noprint>
          <div className="mx-auto flex h-12 max-w-shell items-center gap-6 px-4">
            <NavLink to="/" className="font-semibold tracking-tight">
              금융위기 대응 시뮬레이터
            </NavLink>
            <nav aria-label="주 메뉴" className="flex gap-1 text-base">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => help.open()}
              aria-expanded={help.isOpen}
              className="ml-auto inline-flex min-h-tap-compact items-center gap-1 rounded-md border border-border-control bg-surface px-2.5 text-sm text-text hover:bg-surface-2"
            >
              <Icon name="help" size={16} />
              도움
              <CountPill count={help.badge} label="새 도움말" />
            </button>
          </div>
        </header>
      )}
      <main id="main" ref={mainRef} tabIndex={-1} className={widthClass[width]}>
        {children}
      </main>
      {!inPlay && (
        <footer className="border-t border-border px-4 py-3 text-center text-sm text-muted">
          본 시뮬레이션은 공개 자료를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은
          단순화·각색되었습니다.
        </footer>
      )}
    </div>
  )
}
