import { useRef, type ReactNode } from 'react'
import { createGlossaryScope, GlossaryScopeContext } from '../../lib/glossaryScope'

/**
 * 한 패널 안에서 "용어 첫 등장에만 밑줄"이 되도록 범위를 만든다.
 * 도움 시트·결정 독처럼 여러 `Markdown`이 모인 영역을 이걸로 감싼다.
 *
 * Lives apart from `Markdown.tsx` on purpose: that module carries react-markdown, and the help
 * sheet (mounted on every route) needs only the scope.
 */
export function GlossaryScopeProvider({ children }: { children: ReactNode }) {
  const ref = useRef(createGlossaryScope())
  return (
    <GlossaryScopeContext.Provider value={ref.current}>{children}</GlossaryScopeContext.Provider>
  )
}
