import { useState } from 'react'
import { getSource } from '../../content'
import type { Source } from '../../engine/types/common'

/** Superscript citation chip resolving ids against the shared bibliography (plus optional local sources). */
export function Citation({ ids, local }: { ids: string[]; local?: Source[] }) {
  const [open, setOpen] = useState(false)
  const sources = ids.map(
    (id) =>
      local?.find((s) => s.id === id) ??
      getSource(id) ?? { id, title: id, publisher: '', date: '', kind: 'press' as const },
  )
  return (
    <span className="relative inline-block align-super text-[10px] leading-none ml-0.5">
      <button
        type="button"
        className="text-accent bg-transparent border-0 p-0 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label={`출처 ${sources.map((s) => s.title).join(', ')}`}
      >
        [{sources.map((s) => shortRef(s)).join('; ')}]
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-40 left-0 top-full mt-1 w-80 max-w-[80vw] rounded-md border border-border bg-surface p-2 text-[12px] leading-snug shadow-lg text-text align-baseline"
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
                  className="block text-accent break-all"
                  onMouseDown={(e) => e.preventDefault()}
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
