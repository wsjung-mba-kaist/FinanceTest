import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GLOSSARY } from '../../content'
import { normalize } from '../../lib/search'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { EmptyState, SearchField } from '../ui'
import { Icon } from '../ui/Icon'

const PAGE = 60

/** `용어집` 탭 — 한글·영문·약어로 찾는 목록. `AdvisorDrawer`의 용어집 탭을 옮겨 왔다. */
export function GlossaryHelp({
  initialQuery = '',
  onNavigate,
}: {
  initialQuery?: string
  onNavigate?: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const termDisplay = useSettingsStore((s) => s.termDisplay)
  const markTermViewed = useProgressStore((s) => s.markTermViewed)
  const needle = normalize(q)

  const list = useMemo(() => {
    if (!needle) return GLOSSARY.slice(0, PAGE)
    return GLOSSARY.filter(
      (g) =>
        normalize(g.term.ko).includes(needle) ||
        normalize(g.term.en).includes(needle) ||
        normalize(g.id).includes(needle) ||
        (g.aliases ?? []).some((a) => normalize(a).includes(needle)),
    ).slice(0, PAGE)
  }, [needle])

  return (
    <div className="space-y-2">
      <SearchField
        label="용어 검색"
        icon={<Icon name="search" size={16} />}
        placeholder="용어 검색 (한글·영문·약어)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {list.length === 0 && <EmptyState title="일치하는 용어가 없습니다" />}

      <ul className="space-y-1.5">
        {list.map((g) => (
          <li key={g.id} className="rounded-md border border-border p-2 text-base">
            <div className="font-semibold">
              {termDisplay === 'ko-en'
                ? `${g.term.ko} (${g.term.en})`
                : `${g.term.en} (${g.term.ko})`}
            </div>
            <p className="mt-0.5 leading-relaxed">{g.definition.ko}</p>
            <Link
              to={`/knowledge/glossary#${g.id}`}
              className="mt-0.5 inline-block text-accent"
              onClick={() => {
                markTermViewed(g.id)
                onNavigate?.()
              }}
            >
              자세히 →
            </Link>
          </li>
        ))}
      </ul>

      {!needle && GLOSSARY.length > list.length && (
        <p className="text-xs text-muted">
          전체 <span className="num">{GLOSSARY.length}</span>개 중 {list.length}개를 표시했습니다.
          검색어를 입력해 주세요.
        </p>
      )}
    </div>
  )
}
