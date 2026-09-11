import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Citation } from '../components/knowledge/Citation'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, EmptyState } from '../components/ui'
import { getCard, getFramework } from '../content'
import { scenariosUsingCards } from '../lib/catalog'
import { ROLE_SHORT } from '../lib/labels'
import { getScenarioSummary } from '../scenarios'

/** `## ` headings of the markdown source, parsed from the text (never from the DOM). */
function parseToc(md: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = []
  const seen = new Map<string, number>()
  let inFence = false
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^##\s+(.+?)\s*#*$/.exec(line)
    if (!m) continue
    const title = m[1]!.replace(/[*_`]/g, '').trim()
    if (!title) continue
    const base = title.replace(/\s+/g, '-').toLowerCase()
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push({ id: n === 1 ? base : `${base}-${n}`, title })
  }
  return out
}

export default function FrameworkPage() {
  const { frameworkId } = useParams()
  const framework = frameworkId ? getFramework(frameworkId) : undefined
  const [body, setBody] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    setBody(undefined)
    setError(undefined)
    if (!framework) return
    framework
      .load()
      .then((md) => {
        if (!cancelled) setBody(md)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [framework])

  const toc = useMemo(() => (body ? parseToc(body) : []), [body])
  const usedBy = useMemo(() => {
    if (!framework) return []
    return scenariosUsingCards(framework.relatedCards)
      .map((id) => getScenarioSummary(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
  }, [framework])

  if (!framework) {
    return (
      <EmptyState title="프레임워크 문서를 찾을 수 없습니다">
        <p>주소가 바뀌었거나 삭제된 문서일 수 있습니다.</p>
        <p className="mt-2">
          <Link to="/knowledge">지식 베이스로 돌아가기</Link>
        </p>
      </EmptyState>
    )
  }
  const related = framework.relatedCards.map((id) => ({ id, card: getCard(id) }))
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <article className="min-w-0">
        <nav aria-label="경로" className="text-sm text-muted">
          <Link to="/knowledge">지식 베이스</Link> <span aria-hidden="true">›</span> 프레임워크
        </nav>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {framework.title}
          {framework.titleEn && (
            <span className="ml-2 text-base font-normal text-muted">({framework.titleEn})</span>
          )}
        </h1>
        {framework.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {framework.tags.map((t) => (
              <Badge key={t} tone="neutral">
                #{t}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          {error && <p className="text-critical">문서를 불러오지 못했습니다: {error}</p>}
          {body === undefined && !error && (
            <p className="text-muted" role="status">
              불러오는 중…
            </p>
          )}
          {body !== undefined && <Markdown className="prose-col">{body}</Markdown>}
        </div>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {toc.length > 1 && (
          <nav aria-label="문서 목차" className="rounded-lg border border-border bg-surface p-3">
            <h2 className="text-base font-semibold">목차</h2>
            <ol className="m-0 mt-1 list-none space-y-0.5 border-l border-border p-0 text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const el = [...document.querySelectorAll('.md h2')].find(
                        (n) => n.textContent?.trim() === t.title,
                      )
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="-ml-px block w-full border-0 border-l-2 border-transparent bg-transparent px-3 py-1 text-left text-muted hover:border-accent hover:text-text"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {usedBy.length > 0 && (
          <section
            aria-labelledby="fw-scenarios"
            className="rounded-lg border border-border bg-surface p-3"
          >
            <h2 id="fw-scenarios" className="text-base font-semibold">
              이 프레임워크가 쓰인 시나리오
            </h2>
            <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sm">
              {usedBy.map((s) => (
                <li key={s.id}>
                  <Link to={`/scenarios/${s.id}`}>{s.title}</Link>
                  <span className="text-muted"> — {ROLE_SHORT[s.role]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {related.length > 0 && (
          <section
            aria-labelledby="fw-related"
            className="rounded-lg border border-border bg-surface p-3"
          >
            <h2 id="fw-related" className="text-base font-semibold">
              관련 개념 카드
            </h2>
            <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sm">
              {related.map(({ id, card }) => (
                <li key={id}>
                  <Link to={`/knowledge#card-${id}`}>{card?.title ?? id}</Link>
                  {card?.titleEn && <span className="text-muted"> ({card.titleEn})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {framework.sources.length > 0 && (
          <section
            aria-labelledby="fw-sources"
            className="rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <h2 id="fw-sources" className="text-base font-semibold">
              출처
            </h2>
            <p className="mt-1">
              <Citation ids={framework.sources} />
            </p>
          </section>
        )}
      </aside>
    </div>
  )
}
