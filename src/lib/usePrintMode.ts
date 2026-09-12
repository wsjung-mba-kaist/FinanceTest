import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

function printMatches(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('print').matches
  } catch {
    return false
  }
}

/**
 * True while the page is being printed (or previewed). Charts swap to their table form and every
 * tab panel is rendered, so nothing is laid out at zero width in the print document.
 *
 * Both signals are used: Safari/Firefox fire `beforeprint`/`afterprint`, Chromium also flips the
 * `print` media query during preview.
 */
export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(printMatches)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // `beforeprint` is the browser's last synchronous moment before it snapshots the page. A
    // plain `setState` here is batched and lands *after* the snapshot, so whether the hidden tab
    // panels made it onto the paper was a race that usually lost. `flushSync` is safe in a native
    // event listener (it is not inside React's own render or lifecycle).
    const on = () => flushSync(() => setPrinting(true))
    const off = () => setPrinting(false)
    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    let mql: MediaQueryList | undefined
    const onChange = (e: MediaQueryListEvent) => setPrinting(e.matches)
    if (typeof window.matchMedia === 'function') {
      try {
        mql = window.matchMedia('print')
        mql.addEventListener('change', onChange)
      } catch {
        mql = undefined
      }
    }
    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
      mql?.removeEventListener('change', onChange)
    }
  }, [])

  return printing
}
