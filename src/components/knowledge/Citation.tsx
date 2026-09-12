import { useEffect, useId, useRef, useState } from 'react'
import { getSource } from '../../content'
import type { Source } from '../../engine/types/common'

/**
 * Superscript citation chip resolving ids against the shared bibliography (plus optional local
 * sources).
 *
 * A **popover**, not a tooltip: the panel contains links to the sources, and a tooltip that closes
 * on blur can never hand focus to a link inside it — the source URLs were visible and unreachable
 * by keyboard. `aria-expanded` says what the control does, Esc closes it, and clicking away
 * closes it (which `onBlur` cannot do without eating the click on the link).
 */
export function Citation({ ids, local }: { ids: string[]; local?: Source[] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      // Focus goes back to the chip, not to the top of the document.
      wrapRef.current?.querySelector<HTMLElement>('button')?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const sources = ids.map(
    (id) =>
      local?.find((s) => s.id === id) ??
      getSource(id) ?? { id, title: id, publisher: '', date: '', kind: 'press' as const },
  )
  return (
    <span ref={wrapRef} className="relative ml-0.5 inline-block align-super text-xs leading-none">
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-accent"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`출처 ${sources.map((s) => s.title).join(', ')}`}
      >
        [{sources.map((s) => shortRef(s)).join('; ')}]
      </button>
      {open && (
        <span
          id={panelId}
          className="absolute left-0 top-full z-40 mt-1 w-80 max-w-[80vw] rounded-md border border-border bg-surface p-2 align-baseline text-sm leading-snug text-text shadow-lg"
        >
          {sources.map((s) => (
            <span key={s.id} className="block mb-1 last:mb-0">
              <span className="font-medium">{s.title}</span>
              {s.publisher && (
                <span className="text-muted">
                  {' '}
                  — {s.publisher}, {s.date}
                </span>
              )}
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-accent"
                >
                  {s.url}
                </a>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

function shortRef(s: Source): string {
  const year = s.date?.slice(0, 4)
  const pub = s.publisher ? s.publisher.split(/[ ,(]/)[0] : s.id
  return year ? `${pub} ${year}` : pub || s.id
}
