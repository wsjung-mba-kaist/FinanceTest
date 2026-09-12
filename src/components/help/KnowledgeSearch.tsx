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
import { EmptyState, LiveRegion, SearchField } from '../ui'

const PAGE = 5

/**
 * 지식 베이스 통합 검색 — 용어 · 카드 · 프레임워크 절 · 규정 참조 · 읽을거리.
 * 홈·지식 베이스·플레이 어디서나 같은 컴포넌트를 쓴다.
 */
export function KnowledgeSearch({
  initialQuery = '',
  onNavigate,
  onQueryChange,
  autoFocus = true,
}: {
  initialQuery?: string
  /** 결과를 눌러 이동할 때(시트를 닫는 등). */
  onNavigate?: () => void
  /** 질의가 바뀔 때 — 지식 베이스 페이지는 이걸로 `?q=`를 유지한다. */
  onQueryChange?: (q: string) => void
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

  // Deferred, so the URL is rewritten once the user stops typing rather than per keystroke.
  useEffect(() => {
    onQueryChange?.(deferred)
    // `onQueryChange` is a stable callback at every call site; listing it would re-run this on
    // every parent render and fight the deferral it exists to respect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred])

  const trimmed = deferred.trim()
  return (
    <div className="space-y-3">
      <SearchField
        label="지식 베이스 검색"
        icon={<Icon name="search" size={16} />}
        autoFocus={autoFocus}
        placeholder="용어·규정·카드 검색 (예: LCR, margin call, 예금자보호)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

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
