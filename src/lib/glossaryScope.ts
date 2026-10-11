import { createContext, useContext } from 'react'

/**
 * The glossary *scope* — which panel has already underlined which term — on its own, without the
 * matcher. `glossaryMatch.ts` needs the whole glossary (and through it the knowledge content) to
 * find terms; a panel that merely *provides* a scope does not, and the help sheet provides one on
 * every route. Keeping the two apart keeps the content out of the first chunk.
 */
export interface GlossaryScopeApi {
  /**
   * `termId`를 `owner`가 차지한다. 아직 아무도 차지하지 않았거나 이미 같은 owner면 true.
   * 패널 안에서 같은 용어가 두 번째로 나오면 false가 되어 밑줄이 한 번만 그어진다.
   */
  claim: (termId: string, owner: string) => boolean
}

export const GlossaryScopeContext = createContext<GlossaryScopeApi | null>(null)

export function useGlossaryScope(): GlossaryScopeApi | null {
  return useContext(GlossaryScopeContext)
}

/** 패널 하나가 쓰는 차지 기록. `GlossaryScopeProvider`가 ref로 들고 있는다. */
export function createGlossaryScope(): GlossaryScopeApi {
  const owners = new Map<string, string>()
  return {
    claim(termId, owner) {
      const cur = owners.get(termId)
      if (cur === undefined) {
        owners.set(termId, owner)
        return true
      }
      return cur === owner
    },
  }
}
