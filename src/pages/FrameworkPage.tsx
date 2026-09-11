import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Citation } from '../components/knowledge/Citation'
import { Markdown } from '../components/knowledge/Markdown'
import { Badge, EmptyState } from '../components/ui'
import { getCard, getFramework } from '../content'

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

  if (!framework) {
    return (
      <EmptyState title="프레임워크 문서를 찾을 수 없습니다">
        <Link to="/knowledge">지식 베이스로 돌아가기</Link>
      </EmptyState>
    )
  }
  const related = framework.relatedCards.map((id) => ({ id, card: getCard(id) }))
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <article className="min-w-0">
        <nav aria-label="경로" className="text-[12px] text-muted">
          <Link to="/knowledge">지식 베이스</Link> <span aria-hidden="true">›</span> 프레임워크
        </nav>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          {framework.title}
          {framework.titleEn && (
            <span className="ml-2 text-[14px] font-normal text-muted">({framework.titleEn})</span>
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
          {body !== undefined && <Markdown>{body}</Markdown>}
        </div>
      </article>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {related.length > 0 && (
          <section
            aria-labelledby="fw-related"
            className="rounded-lg border border-border bg-surface p-3"
          >
            <h2 id="fw-related" className="text-[13px] font-semibold">
              관련 개념 카드
            </h2>
            <ul className="mt-1 list-none space-y-1 p-0 m-0 text-[12px]">
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
            className="rounded-lg border border-border bg-surface p-3 text-[12px]"
          >
            <h2 id="fw-sources" className="text-[13px] font-semibold">
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
