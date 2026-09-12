import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFramework, getTerm } from '../../content'
import {
  REGULATION_GROUPS,
  REGULATION_REFS,
  SECTOR_LABELS,
  type RegulationGroup,
  type RegulationRef,
  type RegulationSector,
} from '../../content/regulationQuickRef'
import { sectionSlug } from '../../lib/search'
import { Badge, Chip } from '../ui'
import { Citation } from '../knowledge/Citation'
import { GlossaryTerm } from '../knowledge/GlossaryTerm'

/**
 * 규정 빠른 참조표.
 *
 * 각 행은 프레임워크 문서의 해당 절로 연결되고 출처 칩을 단다. 값이 프레임워크 본문과 어긋나면
 * `tests/integrity/regulationRefs.test.ts`가 실패한다(드리프트 가드).
 */
export function RegulationQuickRef({
  defaultSectors,
  defaultRegion,
}: {
  /** 시나리오 기관 유형에 맞춰 처음에 걸어 둘 업권 필터. */
  defaultSectors?: RegulationSector[]
  defaultRegion?: 'global' | 'korea'
}) {
  const [group, setGroup] = useState<RegulationGroup | 'all'>('all')
  const [sector, setSector] = useState<RegulationSector | 'all'>(defaultSectors?.[0] ?? 'all')
  const [region, setRegion] = useState<'global' | 'korea' | 'all'>(defaultRegion ?? 'all')

  const rows = useMemo(
    () =>
      REGULATION_REFS.filter(
        (r) =>
          (group === 'all' || r.group === group) &&
          (sector === 'all' || r.sectors.includes(sector)) &&
          (region === 'all' || r.region === region),
      ),
    [group, sector, region],
  )

  return (
    <section aria-label="규정 빠른 참조" className="space-y-2">
      <div className="space-y-1.5">
        <FilterRow label="분류">
          <Chip
            size="sm"
            selected={group === 'all'}
            aria-pressed={group === 'all'}
            onClick={() => setGroup('all')}
          >
            전체
          </Chip>
          {REGULATION_GROUPS.map((g) => (
            <Chip
              key={g}
              size="sm"
              selected={group === g}
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
            >
              {g}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="업권">
          <Chip
            size="sm"
            selected={sector === 'all'}
            aria-pressed={sector === 'all'}
            onClick={() => setSector('all')}
          >
            전체
          </Chip>
          {(Object.keys(SECTOR_LABELS) as RegulationSector[]).map((s) => (
            <Chip
              key={s}
              size="sm"
              selected={sector === s}
              aria-pressed={sector === s}
              onClick={() => setSector(s)}
            >
              {SECTOR_LABELS[s]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="지역">
          <Chip
            size="sm"
            selected={region === 'all'}
            aria-pressed={region === 'all'}
            onClick={() => setRegion('all')}
          >
            전체
          </Chip>
          <Chip
            size="sm"
            selected={region === 'korea'}
            aria-pressed={region === 'korea'}
            onClick={() => setRegion('korea')}
          >
            한국
          </Chip>
          <Chip
            size="sm"
            selected={region === 'global'}
            aria-pressed={region === 'global'}
            onClick={() => setRegion('global')}
          >
            국제
          </Chip>
        </FilterRow>
      </div>

      <p className="text-sm text-muted">
        <span className="num">{rows.length}</span>개 규정 · 수치는 프레임워크 문서에서 옮겨 적었고
        값이 어긋나면 테스트가 실패합니다.
      </p>

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <RegulationRow key={r.id} row={r} />
        ))}
      </ul>
    </section>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} 필터`}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  )
}

function RegulationRow({ row }: { row: RegulationRef }) {
  const framework = getFramework(row.frameworkId)
  const term = row.termId ? getTerm(row.termId) : undefined
  const href = `/knowledge/frameworks/${row.frameworkId}${
    row.section ? `#${sectionSlug(row.section)}` : ''
  }`
  return (
    <li className="rounded-md border border-border bg-surface p-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-base font-medium">{row.rule}</span>
        <Badge tone="neutral">{row.region === 'korea' ? '한국' : '국제'}</Badge>
        {row.sectors.map((s) => (
          <Badge key={s} tone="neutral">
            {SECTOR_LABELS[s]}
          </Badge>
        ))}
        {row.verify && <Badge tone="warning">확인 필요</Badge>}
      </div>
      <div className="num mt-0.5 text-md font-semibold">{row.threshold}</div>
      {row.note && <p className="mt-0.5 text-sm leading-relaxed text-muted">{row.note}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {row.asOf && <span className="text-xs text-muted">기준 {row.asOf}</span>}
        {term && (
          <span className="text-sm">
            <GlossaryTerm id={term.id} />
          </span>
        )}
        {framework && (
          <Link to={href} className="text-accent">
            {framework.title}
            {row.section ? ` › ${row.section}` : ''} →
          </Link>
        )}
        <span className="text-muted">
          출처
          <Citation ids={[row.sourceRef]} />
        </span>
      </div>
    </li>
  )
}
