import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { KnowledgeSearch } from '../components/help/KnowledgeSearch'
import { CardLinksFooter } from '../components/knowledge/CardLinksFooter'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, Button, Chip, EmptyState } from '../components/ui'
import { buttonClass } from '../components/ui/buttonStyles'
import { gridClass } from '../lib/grid'
import { CARDS, FRAMEWORKS, GLOSSARY, READING_LIST } from '../content'
import type { KnowledgeCard } from '../content/types'
import { useProgressStore } from '../store/progressStore'

const LEVEL_LABELS: Record<KnowledgeCard['level'], string> = {
  intro: '입문',
  core: '핵심',
  advanced: '심화',
}

function CardItem({
  card,
  open,
  onToggle,
}: {
  card: KnowledgeCard
  open: boolean
  onToggle: () => void
}) {
  const viewed = useProgressStore((s) => s.learning.cardsViewed.includes(card.id))
  const panelId = `card-${card.id}-panel`
  return (
    <li id={`card-${card.id}`} className="rounded-md border border-border bg-surface scroll-mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex-1 font-medium">
          {card.title}
          {card.titleEn && <span className="font-normal text-muted"> ({card.titleEn})</span>}
        </span>
        <Badge tone="neutral">{LEVEL_LABELS[card.level]}</Badge>
        {viewed && <Badge tone="positive">열람</Badge>}
        <span aria-hidden="true" className="text-muted">
          {open ? '−' : '+'}
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-border px-3 py-3">
        <Markdown>{card.body}</Markdown>
        {/*
          The raw `relatedMetrics` ids used to be printed here in a monospace face — `lcr, hqla,
          survivalDays`. Monospace says "this is code you could type", and these are engine keys
          the reader cannot enter anywhere. Worse, the same key is labelled differently per
          scenario (예금자 신뢰지수 vs 채권단 신뢰지수), so there is no one correct name to show.
          The scenarios below are where those numbers appear *with* their proper labels.
        */}
        <CardLinksFooter card={card} />
      </div>
    </li>
  )
}

export default function KnowledgeIndexPage() {
  const loc = useLocation()
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const [tag, setTag] = useState<string | undefined>()
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of CARDS) for (const t of c.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [])

  const groups = useMemo(() => {
    const byTag = new Map<string, KnowledgeCard[]>()
    for (const c of CARDS) {
      const primary = c.tags[0] ?? '기타'
      if (tag && !c.tags.includes(tag)) continue
      const key = tag ?? primary
      const list = byTag.get(key) ?? []
      list.push(c)
      byTag.set(key, list)
    }
    return [...byTag.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'),
    )
  }, [tag])

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        markCardViewed(id)
      }
      return next
    })

  // `?q=` keeps the search in the URL, so a result set can be linked to or reloaded.
  const [params, setParams] = useSearchParams()
  const queryParam = params.get('q') ?? ''
  const setQueryParam = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          if (next.trim()) out.set('q', next)
          else out.delete('q')
          return out
        },
        { replace: true },
      )
    },
    [setParams],
  )

  // Deep link: #card-<id>
  useEffect(() => {
    const m = /^#card-(.+)$/.exec(loc.hash)
    if (!m) return
    const id = decodeURIComponent(m[1]!)
    if (!CARDS.some((c) => c.id === id)) return
    setTag(undefined)
    setOpenIds((s) => new Set(s).add(id))
    markCardViewed(id)
    const t = setTimeout(
      () => document.getElementById(`card-${id}`)?.scrollIntoView({ block: 'start' }),
      50,
    )
    return () => clearTimeout(t)
  }, [loc.hash, markCardViewed])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">지식 베이스</h1>
        <p className="text-muted">프레임워크 문서, 개념 카드, 용어집, 읽을거리를 모았습니다.</p>
        <nav aria-label="지식 베이스 하위 메뉴" className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link
            to="/knowledge/glossary"
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            용어집 <span className="num text-muted">({GLOSSARY.length})</span>
          </Link>
          <Link
            to="/knowledge/reading"
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            읽을거리 <span className="num text-muted">({READING_LIST.length})</span>
          </Link>
        </nav>
      </header>

      {/*
        The unified search existed only inside the help sheet — reachable from the play screen and
        from the shell's 도움 button, but not from the page whose whole subject is this content.
        Someone who navigated to 지식 베이스 to look something up had a list of sections and no
        search box. Same component, and `?q=` in the URL so a search can be linked to.
      */}
      <section aria-labelledby="kb-search-h">
        <h2 id="kb-search-h" className="sr-only">
          검색
        </h2>
        <KnowledgeSearch
          initialQuery={queryParam}
          autoFocus={false}
          onQueryChange={setQueryParam}
        />
      </section>

      <section aria-labelledby="kb-frameworks">
        <h2 id="kb-frameworks" className="mb-2 text-lg font-semibold">
          프레임워크
        </h2>
        {FRAMEWORKS.length === 0 ? (
          <EmptyState title="프레임워크 문서가 아직 없습니다">
            <Link to="/knowledge/reading">읽을거리 목록 보기</Link>
          </EmptyState>
        ) : (
          <ul className={`grid list-none gap-2 p-0 m-0 ${gridClass('link', FRAMEWORKS.length)}`}>
            {FRAMEWORKS.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/knowledge/frameworks/${f.id}`}
                  className="block h-full rounded-md border border-border bg-surface p-3 no-underline text-text hover:border-accent"
                >
                  <div className="font-medium">{f.title}</div>
                  {f.titleEn && <div className="text-sm text-muted">{f.titleEn}</div>}
                  {f.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.tags.map((t) => (
                        <Badge key={t} tone="neutral">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="kb-cards">
        <h2 id="kb-cards" className="mb-2 text-lg font-semibold">
          개념 카드 <span className="num text-muted text-base font-normal">({CARDS.length})</span>
        </h2>
        {tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="태그 필터">
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
          <EmptyState title={tag ? `#${tag} 태그의 카드가 없습니다` : '개념 카드가 아직 없습니다'}>
            {tag ? (
              <Button size="sm" variant="secondary" onClick={() => setTag(undefined)}>
                전체 카드 보기
              </Button>
            ) : (
              <Link to="/knowledge/glossary">용어집 보기</Link>
            )}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {groups.map(([g, cards]) => (
              <div key={g}>
                <h3 className="mb-1 text-md font-semibold text-muted">#{g}</h3>
                <ul
                  className={`m-0 grid list-none gap-1.5 p-0 ${gridClass('prose', cards.length)}`}
                >
                  {cards.map((c) => (
                    <CardItem
                      key={c.id}
                      card={c}
                      open={openIds.has(c.id)}
                      onToggle={() => toggle(c.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
