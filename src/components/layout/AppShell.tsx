import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const nav = [
  { to: '/', label: '시나리오' },
  { to: '/knowledge', label: '지식 베이스' },
  { to: '/progress', label: '진행 현황' },
  { to: '/settings', label: '설정' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const inPlay = loc.pathname.startsWith('/play/')
  return (
    <div className="min-h-full flex flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-surface focus:p-2 focus:z-50"
      >
        본문으로 건너뛰기
      </a>
      {!inPlay && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 h-12 flex items-center gap-6">
            <NavLink to="/" className="font-semibold tracking-tight">
              금융위기 대응 시뮬레이터
            </NavLink>
            <nav aria-label="주 메뉴" className="flex gap-1 text-[13px]">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      )}
      <main
        id="main"
        className={inPlay ? 'flex-1 min-h-0' : 'flex-1 mx-auto w-full max-w-7xl px-4 py-6'}
      >
        {children}
      </main>
      {!inPlay && (
        <footer className="border-t border-border text-muted text-[12px] px-4 py-3 text-center">
          본 시뮬레이션은 공개 자료를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은
          단순화·각색되었습니다.
        </footer>
      )}
    </div>
  )
}
