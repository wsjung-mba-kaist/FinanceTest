import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Chip, EmptyState } from '../components/ui'
import { READING_LIST } from '../content'
import type { ReadingItem } from '../content/types'
import { gridClass } from '../lib/grid'

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
        <nav aria-label="경로" className="text-sm text-muted">
          <Link to="/knowledge">지식 베이스</Link> <span aria-hidden="true">›</span> 읽을거리
        </nav>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          읽을거리{' '}
          <span className="num text-base font-normal text-muted">({READING_LIST.length})</span>
        </h1>
        <p className="text-muted">1차 자료·감독 보고서·학술 문헌 중심으로 선별했습니다.</p>
      </header>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="태그 필터">
          <Chip selected={!tag} aria-pressed={!tag} onClick={() => setTag(undefined)}>
            전체
          </Chip>
          {tags.map(([t, n]) => (
            <Chip
              key={t}
              selected={tag === t}
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? undefined : t)}
            >
              {t} <span className="num text-muted">{n}</span>
            </Chip>
          ))}
        </div>
      )}
      {groups.length === 0 ? (
        <EmptyState title={tag ? `#${tag} 태그의 읽을거리가 없습니다` : '읽을거리가 아직 없습니다'}>
          {tag ? (
            <Button size="sm" variant="secondary" onClick={() => setTag(undefined)}>
              전체 보기
            </Button>
          ) : (
            <Link to="/knowledge">지식 베이스로 돌아가기</Link>
          )}
        </EmptyState>
      ) : (
        groups.map(([g, items]) => (
          <section key={g} aria-labelledby={`rl-${g}`}>
            <h2 id={`rl-${g}`} className="mb-1 text-lg font-semibold">
              #{g}
            </h2>
            {/* Short bibliographic rows: two columns halve the scroll without hurting the read. */}
            <ul className={`m-0 grid list-none gap-1.5 p-0 ${gridClass('link', items.length)}`}>
              {items.map((r, i) => (
                <li
                  key={`${r.title}-${i}`}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
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
