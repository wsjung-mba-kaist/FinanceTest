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
          {/*
            한 줄로 버티지 않는다.
            이 줄은 `flex h-12 … gap-6` 하나였다 — 줄바꿈도, 축소 금지도, 모바일 변형도 없이.
            390px 에서 담아야 할 폭은 640px 남짓이라 모든 항목이 최소 폭까지 눌렸는데, `body` 의
            `overflow-wrap: anywhere`(§CJK 줄바꿈) 때문에 한글의 최소 폭은 **한 글자**다. 그래서
            «시나리오» 가 네 줄 세로로 서서 48px 높이에 잘렸다.

            고치는 방법은 `anywhere` 를 걷어내는 것이 아니라(그건 좁은 칸의 `$2.25B` 를 지키는
            규칙이다) 줄을 넘치지 않게 만드는 것이다: 라벨은 `whitespace-nowrap` 으로 세로로 서지
            않게 하고, 좁은 화면에서는 메뉴 묶음이 둘째 줄로 내려간다.

            메뉴와 도움을 한 `<div>` 로 묶은 이유는 **DOM 순서가 곧 화면 순서**이기 때문이다.
            `order` 로 자리를 바꾸면 시각 순서와 탭 순서가 어긋난다.
          */}
          <div className="mx-auto flex min-h-12 max-w-shell flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1.5 sm:flex-nowrap sm:py-0">
            <NavLink to="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight">
              금융위기 대응 시뮬레이터
            </NavLink>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1">
              <nav aria-label="주 메뉴" className="flex flex-wrap gap-1 text-sm sm:text-base">
                {nav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    className={({ isActive }) =>
                      `shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 sm:px-3 ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`
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
                className="ml-auto inline-flex min-h-tap-compact shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border-control bg-surface px-2.5 text-sm text-text hover:bg-surface-2"
              >
                <Icon name="help" size={16} />
                도움
                <CountPill count={help.badge} label="새 도움말" />
              </button>
            </div>
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
