import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { DecisionView } from '../../engine'

/**
 * The selection model of a decision: which options are picked, the roving focus index, and the
 * keyboard contract (arrows, Home/End, 1–5). Pure state — it knows nothing about timers, drafts
 * or previews, which is the point: it used to share one component with all three, and the bugs
 * lived at the crossings.
 */
export function useOptionSelection(dv: DecisionView) {
  const { decision } = dv
  const sel = decision.select ?? { min: 1, max: 1 }
  const multi = sel.max > 1
  const [selected, setSelected] = useState<string[]>([])
  const [focusIdx, setFocusIdx] = useState(() =>
    Math.max(
      0,
      dv.options.findIndex((o) => o.available),
    ),
  )
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const availability = useMemo(
    () => new Map(dv.options.map((o) => [o.option.id, o.available])),
    [dv.options],
  )

  const toggle = (id: string) => {
    if (!availability.get(id)) return
    if (!multi) {
      setSelected([id])
      return
    }
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      const groups = (decision.exclusive ?? []).filter((g) => g.includes(id))
      const kept = prev.filter((x) => !groups.some((g) => g.includes(x)))
      if (kept.length >= sel.max) return prev
      return [...kept, id]
    })
  }

  const moveTo = (idx: number) => {
    const n = dv.options.length
    if (n === 0) return
    const i = ((idx % n) + n) % n
    setFocusIdx(i)
    buttons.current[i]?.focus()
    const o = dv.options[i]
    if (!multi && o?.available) toggle(o.option.id)
  }

  const onGroupKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        moveTo(focusIdx + 1)
        return
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        moveTo(focusIdx - 1)
        return
      case 'Home':
        e.preventDefault()
        moveTo(0)
        return
      case 'End':
        e.preventDefault()
        moveTo(dv.options.length - 1)
        return
      default:
        if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const idx = Number(e.key) - 1
          const o = dv.options[idx]
          if (!o) return
          e.preventDefault()
          setFocusIdx(idx)
          buttons.current[idx]?.focus()
          if (o.available) toggle(o.option.id)
        }
    }
  }

  return { selected, availability, toggle, focusIdx, setFocusIdx, moveTo, onGroupKeyDown, buttons }
}
