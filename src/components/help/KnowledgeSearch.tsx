import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  countHits,
  KIND_LABELS,
  SEARCH_KINDS,
  search,
  type SearchHit,
  type SearchKind,
} from '../../lib/search'
import { Icon } from '../ui/Icon'
import { EmptyState, LiveRegion } from '../ui'

const PAGE = 5

/**
 * 지식 베이스 통합 검색 — 용어 · 카드 · 프레임워크 절 · 규정 참조 · 읽을거리.
 * 홈·지식 베이스·플레이 어디서나 같은 컴포넌트를 쓴다.
 */
export function KnowledgeSearch({
  initialQuery = '',
  onNavigate,
  autoFocus = true,
}: {
  initialQuery?: string
  /** 결과를 눌러 이동할 때(시트를 닫는 등). */
  onNavigate?: () => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState(initialQuery)
  const [expanded, setExpanded] = useState<Partial<Record<SearchKind, boolean>>>({})
  const deferred = useDeferredValue(q)
  const results = useMemo(() => search(deferred), [deferred])
  const total = countHits(results)

  useEffect(() => {
    setQ(initialQuery)
  }, [initialQuery])

  const trimmed = deferred.trim()
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">지식 베이스 검색</span>
        <span className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5">
          <Icon name="search" size={16} />
          <input
            type="search"
            autoFocus={autoFocus}
            className="w-full bg-transparent text-base outline-none"
            placeholder="용어·규정·카드 검색 (예: LCR, margin call, 예금자보호)"
            aria-label="지식 베이스 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </span>
      </label>

      <LiveRegion message={trimmed ? `검색 결과 ${total}건` : ''} />

      {!trimmed && (
        <p className="text-sm text-muted">
          한글·영문·약어 모두 됩니다. 여러 단어를 넣으면 모두 포함하는 항목만 보여 줍니다.
        </p>
      )}

      {trimmed && total === 0 && (
        <EmptyState title="일치하는 항목이 없습니다">
          약어(LCR·NCR·BTFP)나 한글 용어(담보, 마진콜, 차환)로 다시 시도해 보세요.
        </EmptyState>
      )}

      {trimmed && total > 0 && (
        <p className="text-sm text-muted" aria-hidden="true">
          검색 결과 <span className="num">{total}</span>건
        </p>
      )}

      {SEARCH_KINDS.map((kind) => {
        const hits = results[kind]
        if (hits.length === 0) return null
        const open = expanded[kind] ?? false
        const shown = open ? hits : hits.slice(0, PAGE)
        return (
          <section key={kind} aria-label={`${KIND_LABELS[kind]} 결과`}>
            <h3 className="mb-1 text-sm font-semibold text-muted">
              {KIND_LABELS[kind]} <span className="num">({hits.length})</span>
            </h3>
            <ul className="space-y-1">
              {shown.map((h) => (
                <ResultRow key={h.doc.id} hit={h} onNavigate={onNavigate} />
              ))}
            </ul>
            {hits.length > PAGE && (
              <button
                type="button"
                className="mt-1 text-sm text-accent"
                aria-expanded={open}
                onClick={() => setExpanded((e) => ({ ...e, [kind]: !open }))}
              >
                {open ? '접기' : `더 보기 (${hits.length - PAGE}건)`}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ResultRow({ hit, onNavigate }: { hit: SearchHit; onNavigate?: () => void }) {
  const { doc, snippet } = hit
  return (
    <li className="rounded-md border border-border bg-surface p-2">
      <Link to={doc.href} className="text-base font-medium" onClick={onNavigate}>
        {doc.title}
      </Link>
      {doc.titleEn && <span className="ml-1 text-xs text-muted">{doc.titleEn}</span>}
      {doc.meta && <div className="text-xs text-muted">{doc.meta}</div>}
      {snippet && <p className="mt-0.5 text-sm leading-relaxed text-muted">{snippet}</p>}
    </li>
  )
}
