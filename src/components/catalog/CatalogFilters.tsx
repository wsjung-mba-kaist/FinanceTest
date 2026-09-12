import { useId, useState } from 'react'
import { CATALOG_SORT_LABELS, type CatalogSort } from '../../lib/catalog'
import { Button, Card, Chip } from '../ui'
import { Icon } from '../ui/Icon'

export type FilterKey = 'role' | 'region' | 'decade' | 'difficulty' | 'competency' | 'status'
export type Filters = Record<FilterKey, Set<string>>

export type FilterOption = { id: string; label: string }

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} 필터`}>
      <span className="w-14 shrink-0 text-sm text-muted">{label}</span>
      {options.map((o) => {
        const on = selected.has(o.id)
        return (
          <Chip key={o.id} selected={on} aria-pressed={on} onClick={() => onToggle(o.id)}>
            {o.label}
          </Chip>
        )
      })}
    </div>
  )
}

/**
 * 상태 + 정렬 + `준비 중 포함` stay visible; the five long chip rows (지역·시대·난이도·역량·세부
 * 역할) hide behind a disclosure so cards are the first thing on the page.
 */
export function CatalogFilters({
  options,
  filters,
  onToggle,
  onClear,
  sort,
  onSort,
  includePlanned,
  onIncludePlanned,
  visibleCount,
  totalCount,
  plannedCount,
}: {
  options: Record<FilterKey, FilterOption[]>
  filters: Filters
  onToggle: (key: FilterKey, id: string) => void
  onClear: () => void
  sort: CatalogSort
  onSort: (s: CatalogSort) => void
  includePlanned: boolean
  onIncludePlanned: (v: boolean) => void
  visibleCount: number
  totalCount: number
  plannedCount: number
}) {
  const [more, setMore] = useState(false)
  const panelId = useId()
  const sortId = useId()
  const plannedId = useId()
  const anyFilter = (Object.keys(filters) as FilterKey[]).some((k) => filters[k].size > 0)

  return (
    <Card aria-label="카탈로그 필터" className="p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipGroup
          label="상태"
          options={options.status}
          selected={filters.status}
          onToggle={(id) => onToggle('status', id)}
        />
        <label htmlFor={sortId} className="flex items-center gap-1.5 text-sm text-muted">
          정렬
          <select
            id={sortId}
            value={sort}
            onChange={(e) => onSort(e.target.value as CatalogSort)}
            className="rounded-sm border border-border-control bg-bg px-2 py-1 text-sm text-text"
          >
            {(Object.keys(CATALOG_SORT_LABELS) as CatalogSort[]).map((s) => (
              <option key={s} value={s}>
                {CATALOG_SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {/* Nothing is in preparation any more once every scenario ships — hide the control rather
            than offer a filter that can only ever return an empty set. */}
        {plannedCount > 0 && (
          <label htmlFor={plannedId} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              id={plannedId}
              type="checkbox"
              checked={includePlanned}
              onChange={(e) => onIncludePlanned(e.target.checked)}
              className="accent-accent"
            />
            <span>
              준비 중 포함 <span className="num text-muted">({plannedCount})</span>
            </span>
          </label>
        )}
        <button
          type="button"
          aria-expanded={more}
          aria-controls={panelId}
          onClick={() => setMore((v) => !v)}
          className="ml-auto inline-flex min-h-tap-dense items-center gap-1 border-0 bg-transparent text-sm text-accent"
        >
          <Icon name="filter" size={14} />더 많은 필터
          <Icon name={more ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
      </div>

      <div id={panelId} hidden={!more} className="mt-3 space-y-2 border-t border-border pt-3">
        <ChipGroup
          label="세부 역할"
          options={options.role}
          selected={filters.role}
          onToggle={(id) => onToggle('role', id)}
        />
        <ChipGroup
          label="지역"
          options={options.region}
          selected={filters.region}
          onToggle={(id) => onToggle('region', id)}
        />
        <ChipGroup
          label="시대"
          options={options.decade}
          selected={filters.decade}
          onToggle={(id) => onToggle('decade', id)}
        />
        <ChipGroup
          label="난이도"
          options={options.difficulty}
          selected={filters.difficulty}
          onToggle={(id) => onToggle('difficulty', id)}
        />
        <ChipGroup
          label="역량"
          options={options.competency}
          selected={filters.competency}
          onToggle={(id) => onToggle('competency', id)}
        />
      </div>

      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <span className="num">
          {visibleCount}개 표시 / 전체 {totalCount}개
        </span>
        {anyFilter && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            필터 지우기
          </Button>
        )}
      </p>
    </Card>
  )
}
