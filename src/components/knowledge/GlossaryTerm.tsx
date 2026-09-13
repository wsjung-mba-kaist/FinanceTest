import { RestrictedKnowledgeContext } from './knowledgeAccess'
import { useContext, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getTerm } from '../../content'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'

/**
 * Inline glossary term with an accessible tooltip. Renders `한글(English)` on demand.
 *
 * The trigger is a **link to the glossary entry**, not a button, and the tooltip holds only text.
 * It used to be a button with a 자세히 → link *inside* the tooltip — which no keyboard user could
 * ever reach, because the tooltip closes on blur and blur is what pressing Tab does. The
 * `onMouseDown` preventDefault that kept it alive for the mouse is gone with it.
 *
 * So: hover or focus reads the definition, and activating goes to the full entry. One control,
 * one meaning.
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
  const restricted = useContext(RestrictedKnowledgeContext)
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
  if (restricted) return <>{label}</>
  return (
    <span className="relative inline-block">
      <Link
        to={`/knowledge/glossary#term-${term.id}`}
        className="cursor-help text-inherit underline decoration-muted decoration-dotted underline-offset-2 hover:decoration-accent"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => markTermViewed(term.id)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        {label}
      </Link>
      {open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute z-40 left-0 top-full mt-1 w-72 max-w-[80vw] rounded-md border border-border bg-surface p-2 text-sm leading-snug shadow-lg text-text"
        >
          <span className="block font-semibold">
            {term.term.ko} <span className="text-muted font-normal">({term.term.en})</span>
          </span>
          <span className="block mt-1">{term.definition.ko}</span>
        </span>
      )}
    </span>
  )
}
