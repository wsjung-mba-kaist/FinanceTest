import { useEffect, useState } from 'react'
import type { ScenarioDefinition, ScenarioSummary } from '../engine/types'
import { getScenarioSummary, loadScenario } from '../scenarios'

export interface ScenarioLoad {
  summary: ScenarioSummary | undefined
  def: ScenarioDefinition | undefined
  loading: boolean
  error: string | undefined
}

/** Resolves a catalog summary synchronously and lazily loads the full definition. */
export function useScenarioDef(id: string | undefined): ScenarioLoad {
  const summary = id ? getScenarioSummary(id) : undefined
  const playable = Boolean(summary && summary.status === 'available')
  const [def, setDef] = useState<ScenarioDefinition | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(playable)

  useEffect(() => {
    let cancelled = false
    setDef(undefined)
    setError(undefined)
    if (!id || !playable) {
      setLoading(false)
      return
    }
    setLoading(true)
    loadScenario(id)
      .then((d) => {
        if (cancelled) return
        setDef(d)
        if (!d) setError('시나리오 정의를 불러오지 못했습니다')
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, playable])

  return { summary, def, loading, error }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}
