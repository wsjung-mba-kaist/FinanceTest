import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getTerm } from '../../content'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'

/**
 * Inline glossary term with an accessible tooltip. Renders `한글(English)` on demand.
 * Trigger is a button (hover + focus + click), Esc closes.
 */
export function GlossaryTerm({
  id,
  children,
  form = 'auto',
}: {
  id: string
  children?: ReactNode
  form?: 'auto' | 'full' | 'short'
}) {
  const term = getTerm(id)
  const termDisplay = useSettingsStore((s) => s.termDisplay)
  const markTermViewed = useProgressStore((s) => s.markTermViewed)
  const [open, setOpen] = useState(false)
  const tipId = useId()
  if (!term) return <>{children ?? id}</>
  const label =
    children ??
    (form === 'short'
      ? term.term.en
      : termDisplay === 'ko-en'
        ? `${term.term.ko}(${term.term.en})`
        : `${term.term.en}(${term.term.ko})`)
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="underline decoration-dotted underline-offset-2 decoration-muted hover:decoration-accent cursor-help bg-transparent border-0 p-0 text-inherit"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => {
          setOpen((o) => !o)
          markTermViewed(term.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        {label}
      </button>
      {open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute z-40 left-0 top-full mt-1 w-72 max-w-[80vw] rounded-md border border-border bg-surface p-2 text-[12px] leading-snug shadow-lg text-text"
        >
          <span className="block font-semibold">
            {term.term.ko} <span className="text-muted font-normal">({term.term.en})</span>
          </span>
          <span className="block mt-1">{term.definition.ko}</span>
          <Link
            to={`/knowledge/glossary#${term.id}`}
            className="block mt-1 text-accent"
            onMouseDown={(e) => e.preventDefault()}
          >
            자세히 →
          </Link>
        </span>
      )}
    </span>
  )
}
