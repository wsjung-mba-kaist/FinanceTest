import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Citation } from '../components/knowledge/Citation'
import { EmptyState } from '../components/ui'
import { GLOSSARY, getCard } from '../content'
import type { GlossaryEntry } from '../content/types'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'

const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]
const CHO_MERGE: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }
const KO_INDEX = [
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅅ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]
const EN_INDEX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function initialOf(text: string): string {
  const ch = text.trim().charAt(0)
  if (!ch) return '#'
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const cho = CHOSEONG[Math.floor((code - 0xac00) / 588)] ?? '#'
    return CHO_MERGE[cho] ?? cho
  }
  const up = ch.toUpperCase()
  if (/[A-Z]/.test(up)) return up
  return '#'
}

export default function GlossaryPage() {
  const loc = useLocation()
  const termDisplay = useSettingsStore((s) => s.termDisplay)
  const termsViewed = useProgressStore((s) => s.learning.termsViewed)
  const markTermViewed = useProgressStore((s) => s.markTermViewed)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<string | undefined>()
  const searchId = useId()

  const sorted = useMemo(() => {
    const key = (g: GlossaryEntry) => (termDisplay === 'ko-en' ? g.term.ko : g.term.en)
    return [...GLOSSARY].sort((a, b) => key(a).localeCompare(key(b), 'ko'))
  }, [termDisplay])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (g) =>
        g.id.includes(q) ||
        g.term.ko.toLowerCase().includes(q) ||
        g.term.en.toLowerCase().includes(q) ||
        (g.aliases ?? []).some((a) => a.toLowerCase().includes(q)) ||
        g.definition.ko.toLowerCase().includes(q),
    )
  }, [sorted, query])

  const groups = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>()
    for (const g of filtered) {
      const init = initialOf(termDisplay === 'ko-en' ? g.term.ko : g.term.en)
      const list = map.get(init) ?? []
      list.push(g)
      map.set(init, list)
    }
    const order = [...KO_INDEX, ...EN_INDEX, '#']
    return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as const)
  }, [filtered, termDisplay])
  const present = useMemo(() => new Set(groups.map(([k]) => k)), [groups])

  // Deep link: #<term-id> or #term-<term-id>
  useEffect(() => {
    if (!loc.hash) return
    const raw = decodeURIComponent(loc.hash.slice(1))
    const id = raw.startsWith('term-') ? raw.slice(5) : raw
    if (!GLOSSARY.some((g) => g.id === id)) return
    setQuery('')
    setHighlight(id)
    markTermViewed(id)
    const t = setTimeout(() => {
      const el = document.getElementById(`term-${id}`)
      el?.scrollIntoView({ block: 'start' })
      el?.focus({ preventScroll: true })
    }, 50)
    return () => clearTimeout(t)
  }, [loc.hash, markTermViewed])

  return (
    <div className="space-y-4">
      <header>
        <nav aria-label="경로" className="text-[12px] text-muted">
          <Link to="/knowledge">지식 베이스</Link> <span aria-hidden="true">›</span> 용어집
        </nav>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          용어집 <span className="num text-[13px] font-normal text-muted">({GLOSSARY.length})</span>
        </h1>
      </header>

      <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
        <label htmlFor={searchId} className="block text-[12px] text-muted">
          검색 (한글·영문·약어)
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: LCR, 유동성, margin call"
          className="w-full rounded border border-border bg-bg px-2 py-1.5"
        />
        <nav aria-label="색인" className="flex flex-wrap gap-0.5 text-[12px]">
          {[...KO_INDEX, ...EN_INDEX].map((k) => (
            <a
              key={k}
              href={`#idx-${k}`}
              aria-disabled={!present.has(k)}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(`idx-${k}`)?.scrollIntoView({ block: 'start' })
              }}
              className={`num rounded px-1.5 py-0.5 no-underline ${present.has(k) ? 'text-accent hover:bg-surface-2' : 'pointer-events-none text-muted opacity-40'}`}
            >
              {k}
            </a>
          ))}
        </nav>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={GLOSSARY.length === 0 ? '용어집이 아직 없습니다' : '검색 결과가 없습니다'}
        />
      ) : (
        groups.map(([k, entries]) => (
          <section key={k} id={`idx-${k}`} aria-labelledby={`idx-${k}-h`} className="scroll-mt-4">
            <h2
              id={`idx-${k}-h`}
              className="num sticky top-0 z-10 border-b border-border bg-bg py-1 text-[14px] font-semibold"
            >
              {k}
            </h2>
            <dl className="m-0 divide-y divide-border">
              {entries.map((g) => {
                const card = g.cardRef ? getCard(g.cardRef) : undefined
                const hl = highlight === g.id
                return (
                  <div
                    key={g.id}
                    id={`term-${g.id}`}
                    tabIndex={-1}
                    className={`scroll-mt-12 py-2 ${hl ? 'bg-accent-soft -mx-2 px-2 rounded' : ''}`}
                  >
                    <dt className="font-medium">
                      {termDisplay === 'ko-en' ? (
                        <>
                          {g.term.ko} <span className="font-normal text-muted">({g.term.en})</span>
                        </>
                      ) : (
                        <>
                          {g.term.en} <span className="font-normal text-muted">({g.term.ko})</span>
                        </>
                      )}
                      {g.aliases && g.aliases.length > 0 && (
                        <span className="ml-2 text-[11px] font-normal text-muted">
                          별칭: {g.aliases.join(', ')}
                        </span>
                      )}
                      {termsViewed.includes(g.id) && <span className="sr-only"> (열람함)</span>}
                    </dt>
                    <dd className="m-0 mt-0.5 text-[12px]">
                      {g.definition.ko}
                      {g.sourceRef && <Citation ids={[g.sourceRef]} />}
                      {g.definition.en && (
                        <div className="mt-0.5 text-muted">{g.definition.en}</div>
                      )}
                      {card && (
                        <div className="mt-0.5">
                          <Link to={`/knowledge#card-${card.id}`}>관련 카드: {card.title}</Link>
                        </div>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))
      )}
    </div>
  )
}
