import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CatalogFilters, type FilterKey, type Filters } from '../components/catalog/CatalogFilters'
import { ScenarioCard } from '../components/catalog/ScenarioCard'
import { RoleChooser } from '../components/onboarding/RoleChooser'
import { Welcome } from '../components/onboarding/Welcome'
import { Button, ConfirmDialog, EmptyState } from '../components/ui'
import { buttonClass } from '../components/ui/buttonStyles'
import { gridPlan } from '../lib/grid'
import { roleFamilyOf, type RoleFamily } from '../content/roleFrames'
import type { Competency, Difficulty, Region, ScenarioSummary } from '../engine/types'
import type { InProgressSave } from '../persistence/schema'
import {
  CATALOG_STATUS_LABELS,
  catalogStatusOf,
  sortCatalog,
  type CatalogSort,
  type CatalogStatus,
} from '../lib/catalog'
import {
  COMPETENCIES,
  DIFFICULTY_LABELS,
  DIMENSION_LABELS,
  MODE_LABELS,
  REGION_LABELS,
  ROLE_FAMILY_LABELS,
  ROLE_GROUPS,
  decadeOf,
  shortDate,
  turnProgressLabel,
} from '../lib/labels'
import { SCENARIOS } from '../scenarios'
import { useProgressStore } from '../store/progressStore'
import { useSettingsStore } from '../store/settingsStore'

const STATUS_FILTERS: CatalogStatus[] = ['available', 'in-progress', 'completed']

const emptyFilters = (): Filters => ({
  role: new Set(),
  region: new Set(),
  decade: new Set(),
  difficulty: new Set(),
  competency: new Set(),
  status: new Set(),
})

export default function HomePage() {
  const scenarios = useProgressStore((s) => s.scenarios)
  const setInProgress = useProgressStore((s) => s.setInProgress)
  const onboardingSeenAt = useSettingsStore((s) => s.onboardingSeenAt)
  const roleFamily = useSettingsStore((s) => s.roleFamily)
  const updateSettings = useSettingsStore((s) => s.update)

  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sort, setSort] = useState<CatalogSort>('recommended')
  const [includePlanned, setIncludePlanned] = useState(false)
  const [discardId, setDiscardId] = useState<string | undefined>()
  const [introReopened, setIntroReopened] = useState(false)

  const showIntro = introReopened || !onboardingSeenAt

  const toggle = (key: FilterKey, id: string) =>
    setFilters((f) => {
      const next = new Set(f[key])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...f, [key]: next }
    })

  const progressOf = useCallback((id: string) => scenarios[id], [scenarios])

  const all = useMemo(() => SCENARIOS.map((e) => e.summary), [])
  const plannedCount = useMemo(() => all.filter((s) => s.status === 'planned').length, [all])

  const familyCounts = useMemo(() => {
    const out: Record<RoleFamily, number> = {
      bank: 0,
      securities: 0,
      pension: 0,
      fund: 0,
      policy: 0,
    }
    for (const s of all) {
      if (s.status !== 'available') continue
      out[roleFamilyOf(s.role)] += 1
    }
    return out
  }, [all])

  const options = useMemo(() => {
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
      status: STATUS_FILTERS.map((s) => ({ id: s, label: CATALOG_STATUS_LABELS[s] })),
    }
  }, [all])

  const visible = useMemo(() => {
    const list = all.filter((s) => {
      const planned = s.status === 'planned'
      if (planned && !includePlanned) return false
      if (roleFamily && roleFamilyOf(s.role) !== roleFamily) return false
      if (filters.role.size && !filters.role.has(ROLE_GROUPS[s.role])) return false
      if (filters.region.size && !filters.region.has(s.region)) return false
      if (filters.decade.size && !filters.decade.has(decadeOf(s.year))) return false
      if (filters.difficulty.size && !filters.difficulty.has(s.difficulty)) return false
      if (
        filters.competency.size &&
        ![...filters.competency].some((c) => (s.competencies[c as Competency] ?? 0) > 0)
      )
        return false
      if (filters.status.size && !filters.status.has(catalogStatusOf(s, scenarios[s.id])))
        return false
      return true
    })
    return sortCatalog(list, sort, progressOf)
  }, [all, filters, includePlanned, progressOf, roleFamily, scenarios, sort])

  const inProgress = useMemo(() => {
    const out: { summary: ScenarioSummary; run: InProgressSave; stale: boolean }[] = []
    for (const s of all) {
      const run = scenarios[s.id]?.inProgress
      if (run) out.push({ summary: s, run, stale: run.scenarioVersion !== s.version })
    }
    return out.sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt))
  }, [all, scenarios])
  const discardTarget = inProgress.find((x) => x.summary.id === discardId)
  const cardGrid = gridPlan('scenario', visible.length)

  return (
    <div className="space-y-6">
      {!showIntro && <h1 className="sr-only">시나리오 카탈로그</h1>}
      <Welcome
        expanded={showIntro}
        onHide={() => {
          setIntroReopened(false)
          updateSettings({ onboardingSeenAt: new Date().toISOString() })
        }}
        onShow={() => setIntroReopened(true)}
      />

      {inProgress.length > 0 && (
        <section
          aria-label="이어하기"
          className="space-y-2 rounded-lg border border-info-border bg-info-bg p-3"
        >
          {inProgress.map(({ summary, run, stale }) => (
            <div key={summary.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-info">진행 중</span>
              <span className="font-medium">{summary.title}</span>
              <span className="num text-sm text-muted">
                {turnProgressLabel(run.turnIndex, summary.durationTurns)} · {MODE_LABELS[run.mode]}{' '}
                모드 · 마지막 저장 {shortDate(run.updatedAt)}
              </span>
              {stale && (
                <span className="text-sm text-warning">
                  시나리오가 갱신되어 이어할 수 없습니다 — 새로 시작해 주세요
                </span>
              )}
              <span className="ml-auto flex gap-1">
                {stale ? (
                  <Link
                    to={`/scenarios/${summary.id}`}
                    className={buttonClass({ variant: 'secondary', size: 'sm' })}
                  >
                    브리핑 열기
                  </Link>
                ) : (
                  <Link
                    to={`/play/${summary.id}`}
                    className={buttonClass({ variant: 'primary', size: 'sm' })}
                  >
                    이어하기
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDiscardId(summary.id)}>
                  버리기
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}

      <RoleChooser
        value={roleFamily}
        counts={familyCounts}
        onChange={(next) => updateSettings({ roleFamily: next })}
      />

      <section aria-labelledby="catalog-h" className="space-y-3">
        <h2 id="catalog-h" className="text-lg font-semibold">
          시나리오
          {roleFamily && (
            <span className="ml-1 font-normal text-muted">— {ROLE_FAMILY_LABELS[roleFamily]}</span>
          )}
        </h2>
        <CatalogFilters
          options={options}
          filters={filters}
          onToggle={toggle}
          onClear={() => setFilters(emptyFilters())}
          sort={sort}
          onSort={setSort}
          includePlanned={includePlanned}
          onIncludePlanned={setIncludePlanned}
          visibleCount={visible.length}
          totalCount={all.length}
          plannedCount={plannedCount}
        />

        {visible.length === 0 ? (
          <EmptyState title="조건에 맞는 시나리오가 없습니다">
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilters(emptyFilters())
                  updateSettings({ roleFamily: undefined })
                }}
              >
                필터·역할 지우기
              </Button>
              {!includePlanned && plannedCount > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setIncludePlanned(true)}>
                  준비 중 {plannedCount}편 보기
                </Button>
              )}
            </div>
          </EmptyState>
        ) : (
          <ul className={`m-0 grid list-none gap-3 p-0 ${cardGrid.className}`}>
            {visible.map((s, i) => (
              // The first card takes two columns when the last row would otherwise strand one.
              // Sorting already puts the 입문 편 first, so the card that gets the extra width is
              // the one a newcomer should start from.
              <li key={s.id} className={i === 0 ? cardGrid.firstItemClassName : undefined}>
                <ScenarioCard summary={s} progress={scenarios[s.id]} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
