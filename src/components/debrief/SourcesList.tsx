import type { Source } from '../../engine/types'
import { SOURCE_KIND_LABELS } from '../../lib/labels'
import { Badge } from '../ui'

export function SourcesList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return <p className="text-[12px] text-muted">출처가 없습니다.</p>
  return (
    <ol className="m-0 space-y-1.5 pl-5 text-[12px]">
      {sources.map((s) => (
        <li key={s.id} id={`source-${s.id}`}>
          <span className="font-medium">{s.title}</span>
          <span className="text-muted">
            {' '}
            — {s.publisher}
            {s.date ? `, ${s.date}` : ''}
            {s.pages ? `, ${s.pages}` : ''}
          </span>{' '}
          <Badge tone="neutral">{SOURCE_KIND_LABELS[s.kind]}</Badge>
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="ml-1 break-all">
              {s.url}
            </a>
          )}
          {s.note && <div className="text-muted">{s.note}</div>}
        </li>
      ))}
    </ol>
  )
}
