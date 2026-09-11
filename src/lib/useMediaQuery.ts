import { useEffect, useState } from 'react'

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/** Subscribes to a CSS media query; false when matchMedia is unavailable (tests). */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query))
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setValue(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return value
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

/** desktop ≥ 1200px · tablet 900–1199px · mobile < 900px (play-view layout breakpoints). */
export function useBreakpoint(): Breakpoint {
  const desktop = useMediaQuery('(min-width: 1200px)')
  const tablet = useMediaQuery('(min-width: 900px)')
  if (desktop) return 'desktop'
  if (tablet) return 'tablet'
  return 'mobile'
}

function rootReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-reduced-motion') === 'true'
}

/** True when the OS asks for reduced motion or the app setting (`data-reduced-motion`) is on. */
export function useReducedMotion(): boolean {
  const media = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [attr, setAttr] = useState(rootReducedMotion)
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    const obs = new MutationObserver(() => setAttr(rootReducedMotion()))
    obs.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    return () => obs.disconnect()
  }, [])
  return media || attr
}
