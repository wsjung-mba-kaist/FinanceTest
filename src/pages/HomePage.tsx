import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScenarioCard } from '../components/catalog/ScenarioCard'
import { CATALOG_STATUS_LABELS, catalogStatusOf, type CatalogStatus } from '../lib/catalog'
import { Button, ConfirmDialog, EmptyState } from '../components/ui'
import type { Competency, Difficulty, Region, ScenarioSummary } from '../engine/types'
import type { InProgressSave } from '../persistence/schema'
import {
  COMPETENCIES,
  DIFFICULTY_LABELS,
  DIMENSION_LABELS,
  MODE_LABELS,
  REGION_LABELS,
  ROLE_GROUPS,
  decadeOf,
  shortDate,
  turnProgressLabel,
} from '../lib/labels'
import { SCENARIOS } from '../scenarios'
import { useProgressStore } from '../store/progressStore'

type FilterKey = 'role' | 'region' | 'decade' | 'difficulty' | 'competency' | 'status'
type Filters = Record<FilterKey, Set<string>>

const emptyFilters = (): Filters => ({
  role: new Set(),
  region: new Set(),
  decade: new Set(),
  difficulty: new Set(),
  competency: new Set(),
  status: new Set(),
})

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} 필터`}>
      <span className="text-[11px] text-muted mr-1 w-10">{label}</span>
      {options.map((o) => {
        const on = selected.has(o.id)
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] transition-colors ${on ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:text-text'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function HomePage() {
  const scenarios = useProgressStore((s) => s.scenarios)
  const setInProgress = useProgressStore((s) => s.setInProgress)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sortDesc, setSortDesc] = useState(false)
  const [discardId, setDiscardId] = useState<string | undefined>()

  const toggle = (key: FilterKey, id: string) =>
    setFilters((f) => {
      const next = new Set(f[key])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...f, [key]: next }
    })
  const anyFilter = (Object.keys(filters) as FilterKey[]).some((k) => filters[k].size > 0)

  const options = useMemo(() => {
    const all = SCENARIOS.map((s) => s.summary)
    const uniq = <T,>(xs: T[]) => [...new Set(xs)]
    return {
      role: uniq(all.map((s) => ROLE_GROUPS[s.role])).map((g) => ({ id: g, label: g })),
      region: (['global', 'korea'] as Region[]).map((r) => ({ id: r, label: REGION_LABELS[r] })),
      decade: uniq(all.map((s) => decadeOf(s.year)))
        .sort()
        .map((d) => ({ id: d, label: d })),
      difficulty: (['intro', 'standard', 'advanced'] as Difficulty[]).map((d) => ({
        id: d,
        label: DIFFICULTY_LABELS[d],
      })),
      competency: COMPETENCIES.map((c) => ({ id: c, label: DIMENSION_LABELS[c] })),
      status: (['available', 'in-progress', 'completed', 'planned'] as CatalogStatus[]).map(
        (s) => ({ id: s, label: CATALOG_STATUS_LABELS[s] }),
      ),
    }
  }, [])

  const visible = useMemo(() => {
    const list = SCENARIOS.map((e) => e.summary).filter((s) => {
      const p = scenarios[s.id]
      if (filters.role.size && !filters.role.has(ROLE_GROUPS[s.role])) return false
      if (filters.region.size && !filters.region.has(s.region)) return false
      if (filters.decade.size && !filters.decade.has(decadeOf(s.year))) return false
      if (filters.difficulty.size && !filters.difficulty.has(s.difficulty)) return false
      if (
        filters.competency.size &&
        ![...filters.competency].some((c) => (s.competencies[c as Competency] ?? 0) > 0)
      )
        return false
      if (filters.status.size && !filters.status.has(catalogStatusOf(s, p))) return false
      return true
    })
    return list.sort((a, b) => {
      const d = sortDesc ? b.year - a.year : a.year - b.year
      return d !== 0 ? d : a.era.localeCompare(b.era)
    })
  }, [filters, scenarios, sortDesc])

  const inProgress = useMemo(() => {
    const out: { summary: ScenarioSummary; run: InProgressSave }[] = []
    for (const e of SCENARIOS) {
      const run = scenarios[e.summary.id]?.inProgress
      if (run) out.push({ summary: e.summary, run })
    }
    return out.sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt))
  }, [scenarios])
  const discardTarget = inProgress.find((x) => x.summary.id === discardId)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">시나리오 카탈로그</h1>
        <p className="text-muted mt-1">
          리스크·자금 팀을 위한 훈련 시뮬레이터 — 실제 위기 기록을 바탕으로 의사결정을 훈련합니다.
        </p>
      </header>

      {inProgress.length > 0 && (
        <section
          aria-label="이어하기"
          className="rounded-lg border border-info/40 bg-info-bg p-3 space-y-2"
        >
          {inProgress.map(({ summary, run }) => (
            <div key={summary.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[12px] font-medium text-info">진행 중</span>
              <span className="font-medium">{summary.title}</span>
              <span className="text-[12px] text-muted num">
                {turnProgressLabel(run.turnIndex, summary.durationTurns)} · {MODE_LABELS[run.mode]}{' '}
                모드 · 마지막 저장 {shortDate(run.updatedAt)}
              </span>
              <span className="ml-auto flex gap-1">
                <Link
                  to={`/play/${summary.id}`}
                  className="inline-flex items-center rounded-md border border-accent bg-accent px-3 py-1 text-[12px] font-medium text-white no-underline hover:opacity-90"
                >
                  이어하기
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setDiscardId(summary.id)}>
                  버리기
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section
        aria-label="필터"
        className="rounded-lg border border-border bg-surface p-3 space-y-2"
      >
        <ChipGroup
          label="역할"
          options={options.role}
          selected={filters.role}
          onToggle={(id) => toggle('role', id)}
        />
        <ChipGroup
          label="지역"
          options={options.region}
          selected={filters.region}
          onToggle={(id) => toggle('region', id)}
        />
        <ChipGroup
          label="시대"
          options={options.decade}
          selected={filters.decade}
          onToggle={(id) => toggle('decade', id)}
        />
        <ChipGroup
          label="난이도"
          options={options.difficulty}
          selected={filters.difficulty}
          onToggle={(id) => toggle('difficulty', id)}
        />
        <ChipGroup
          label="역량"
          options={options.competency}
          selected={filters.competency}
          onToggle={(id) => toggle('competency', id)}
        />
        <ChipGroup
          label="상태"
          options={options.status}
          selected={filters.status}
          onToggle={(id) => toggle('status', id)}
        />
        <div className="flex items-center justify-between pt-1 text-[12px] text-muted">
          <span>
            {visible.length}개 표시 / 전체 {SCENARIOS.length}개
            {anyFilter && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={() => setFilters(emptyFilters())}
              >
                필터 지우기
              </Button>
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`연도 정렬: ${sortDesc ? '최신순' : '오래된순'}`}
            onClick={() => setSortDesc((v) => !v)}
          >
            연도 {sortDesc ? '↓ 최신순' : '↑ 오래된순'}
          </Button>
        </div>
      </section>

      {visible.length === 0 ? (
        <EmptyState title="조건에 맞는 시나리오가 없습니다">필터를 조정해 보세요.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
          {visible.map((s) => (
            <li key={s.id}>
              <ScenarioCard summary={s} progress={scenarios[s.id]} />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(discardTarget)}
        title="진행 중인 플레이를 버릴까요?"
        body={
          discardTarget ? (
            <>
              <b>{discardTarget.summary.title}</b> —{' '}
              {turnProgressLabel(discardTarget.run.turnIndex, discardTarget.summary.durationTurns)}{' '}
              저장분이 삭제됩니다. 완료된 기록은 유지됩니다.
            </>
          ) : null
        }
        confirmLabel="버리기"
        destructive
        onCancel={() => setDiscardId(undefined)}
        onConfirm={() => {
          if (discardTarget) setInProgress(discardTarget.summary.id, undefined)
          setDiscardId(undefined)
        }}
      />
    </div>
  )
}
