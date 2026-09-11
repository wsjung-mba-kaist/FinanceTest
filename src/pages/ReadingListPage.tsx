import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState } from '../components/ui'
import { READING_LIST } from '../content'
import type { ReadingItem } from '../content/types'

export default function ReadingListPage() {
  const [tag, setTag] = useState<string | undefined>()
  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of READING_LIST) for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [])
  const groups = useMemo(() => {
    const map = new Map<string, ReadingItem[]>()
    for (const r of READING_LIST) {
      if (tag && !r.tags.includes(tag)) continue
      const key = tag ?? r.tags[0] ?? '기타'
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => b.year.localeCompare(a.year))
    return [...map.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'),
    )
  }, [tag])

  return (
    <div className="space-y-4">
      <header>
        <nav aria-label="경로" className="text-[12px] text-muted">
          <Link to="/knowledge">지식 베이스</Link> <span aria-hidden="true">›</span> 읽을거리
        </nav>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          읽을거리{' '}
          <span className="num text-[13px] font-normal text-muted">({READING_LIST.length})</span>
        </h1>
        <p className="text-muted">1차 자료·감독 보고서·학술 문헌 중심으로 선별했습니다.</p>
      </header>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="태그 필터">
          <button
            type="button"
            aria-pressed={!tag}
            onClick={() => setTag(undefined)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] ${!tag ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:text-text'}`}
          >
            전체
          </button>
          {tags.map(([t, n]) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? undefined : t)}
              className={`rounded-full border px-2.5 py-0.5 text-[12px] ${tag === t ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:text-text'}`}
            >
              {t} <span className="num opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}
      {groups.length === 0 ? (
        <EmptyState title="읽을거리가 아직 없습니다" />
      ) : (
        groups.map(([g, items]) => (
          <section key={g} aria-labelledby={`rl-${g}`}>
            <h2 id={`rl-${g}`} className="mb-1 text-[14px] font-semibold">
              #{g}
            </h2>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {items.map((r, i) => (
                <li
                  key={`${r.title}-${i}`}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium">
                        {r.title}
                      </a>
                    ) : (
                      <span className="font-medium">{r.title}</span>
                    )}
                    <span className="text-muted">
                      {r.publisher}, {r.year}
                    </span>
                  </div>
                  {r.note && <p className="mt-0.5 text-muted">{r.note}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <Badge key={t} tone="neutral">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
