import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useHelp } from '../help/helpContext'
import { Icon } from '../ui/Icon'

const nav = [
  { to: '/', label: '시나리오' },
  { to: '/knowledge', label: '지식 베이스' },
  { to: '/progress', label: '진행 현황' },
  { to: '/settings', label: '설정' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const inPlay = loc.pathname.startsWith('/play/')
  const help = useHelp()

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2"
      >
        본문으로 건너뛰기
      </a>
      {!inPlay && (
        <header className="border-b border-border bg-surface" data-noprint>
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4">
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
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-text hover:bg-surface-2"
            >
              <Icon name="help" size={16} />
              도움
              {help.badge > 0 && (
                <span className="num rounded-full bg-accent px-1.5 text-xs text-accent-fg">
                  {help.badge}
                </span>
              )}
            </button>
          </div>
        </header>
      )}
      <main
        id="main"
        className={inPlay ? 'min-h-0 flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-6'}
      >
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
