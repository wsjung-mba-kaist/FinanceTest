import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getCard } from '../../content'
import { createGame, latestSnapshot } from '../../engine'
import type { BankState, ScenarioDefinition, ScoreDimension } from '../../engine/types'
import { SCORE_DIMENSIONS } from '../../engine/types/common'
import { formatCurrency, formatMetric } from '../../lib/format'
import { DIMENSION_LABELS, DIMENSION_LABELS_EN, SOURCE_KIND_LABELS } from '../../lib/labels'
import { useProgressStore } from '../../store/progressStore'
import { GlossaryTerm } from '../knowledge/GlossaryTerm'
import { Markdown } from '../knowledge/Markdown'
import { Badge, StatusBadge } from '../ui'
import { Icon } from '../ui/Icon'

/**
 * The full dossier. Every section is collapsed by default on every breakpoint — the executive
 * summary above carries what a reader needs before starting, and this is the reference behind it.
 * Mode selection and the start CTA live in the summary's start card, not here.
 */
export const DOSSIER_SECTIONS = [
  { id: 'situation', n: 1, title: '상황 개요' },
  { id: 'institution', n: 2, title: '기관 현황' },
  { id: 'market', n: 3, title: '시장 배경' },
  { id: 'stakeholders', n: 4, title: '이해관계자' },
  { id: 'regulation', n: 5, title: '규제·제도' },
  { id: 'concepts', n: 6, title: '핵심 개념' },
  { id: 'scoring', n: 7, title: '평가 기준' },
  { id: 'sources', n: 8, title: '출처·단순화 노트' },
] as const
export type DossierSectionId = (typeof DOSSIER_SECTIONS)[number]['id']

function Section({
  id,
  n,
  title,
  open,
  onToggle,
  viewed,
  children,
}: {
  id: DossierSectionId
  n: number
  title: string
  open: boolean
  onToggle: () => void
  viewed: boolean
  children: ReactNode
}) {
  const headingId = `sec-${id}-h`
  const panelId = `sec-${id}-panel`
  return (
    <section
      id={`sec-${id}`}
      data-section={id}
      aria-labelledby={headingId}
      className="scroll-mt-4 rounded-lg border border-border bg-surface"
    >
      <h3 id={headingId} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-md font-semibold ${open ? 'border-b border-border' : ''}`}
        >
          <span className="num text-muted">{n}.</span>
          <span className="flex-1">{title}</span>
          {viewed && <span className="text-xs font-normal text-positive">열람</span>}
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="text-muted" />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-4 py-4">
        {children}
      </div>
    </section>
  )
}

function BankBalanceSheet({ b, scenario }: { b: BankState; scenario: ScenarioDefinition }) {
  const u = scenario.units
  const deposits = b.deposits.reduce((a, d) => a + d.balance, 0)
  const uninsured = b.deposits.filter((d) => !d.insured).reduce((a, d) => a + d.balance, 0)
  const loans = b.loans.retail + b.loans.sme + b.loans.corporate + b.loans.fi
  const wholesale =
    b.wholesale.unsecuredShort +
    b.wholesale.unsecuredLong +
    b.wholesale.repoL1 +
    b.wholesale.repoL2A +
    b.wholesale.repoOther
  const rows: { label: ReactNode; value: string; note?: string }[] = [
    { label: '현금·지준', value: formatCurrency(b.cash, u) },
    {
      label: (
        <>
          <GlossaryTerm id="afs">매도가능증권(AFS)</GlossaryTerm> 시가 / 장부
        </>
      ),
      value: `${formatCurrency(b.securities.afs.marketValue, u)} / ${formatCurrency(b.securities.afs.bookValue, u)}`,
      note: `수정듀레이션 ${b.securities.afs.modDuration.toFixed(1)}년`,
    },
    {
      label: (
        <>
          <GlossaryTerm id="htm">만기보유증권(HTM)</GlossaryTerm> 시가 / 장부
        </>
      ),
      value: `${formatCurrency(b.securities.htm.marketValue, u)} / ${formatCurrency(b.securities.htm.bookValue, u)}`,
      note: `수정듀레이션 ${b.securities.htm.modDuration.toFixed(1)}년`,
    },
    {
      label: '대출(합계)',
      value: formatCurrency(loans, u),
      note: `부실 ${formatCurrency(b.loans.nonPerforming, u)}`,
    },
    {
      label: '총예금',
      value: formatCurrency(deposits, u),
      note: `무보험 ${formatCurrency(uninsured, u)} (${deposits > 0 ? ((uninsured / deposits) * 100).toFixed(0) : 0}%)`,
    },
    { label: '도매자금(무담보+레포)', value: formatCurrency(wholesale, u) },
    {
      label: '담보차입 잔액 / 당일 여력',
      value: `${formatCurrency(b.wholesale.cbAdvances, u)} / ${formatCurrency(b.wholesale.cbFacilityCapacity, u)}`,
    },
    {
      label: (
        <>
          <GlossaryTerm id="cet1">보통주자본(CET1)</GlossaryTerm> / 위험가중자산
        </>
      ),
      value: `${formatCurrency(b.capital.cet1, u)} / ${formatCurrency(b.rwa, u)}`,
      note: b.capital.aociInCet1 ? 'AOCI가 CET1에 반영됨' : 'AOCI 미반영(옵트아웃)',
    },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">T0 대차대조표 주요 항목</caption>
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="py-1 pr-2 font-medium">항목</th>
            <th className="py-1 pr-2 font-medium">금액</th>
            <th className="py-1 font-medium">비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="py-1 pr-2">{r.label}</td>
              <td className="py-1 pr-2 num whitespace-nowrap">{r.value}</td>
              <td className="py-1 text-muted">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConceptCard({
  cardId,
  viewed,
  onView,
}: {
  cardId: string
  viewed: boolean
  onView: () => void
}) {
  const card = getCard(cardId)
  const [open, setOpen] = useState(false)
  const panelId = `card-${cardId}`
  if (!card) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
        카드 <code className="font-mono">{cardId}</code> 을(를) 찾을 수 없습니다.
      </div>
    )
  }
  return (
    <article className="rounded-md border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onView()
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex-1 font-medium">
          {card.title}
          {card.titleEn && <span className="text-muted font-normal"> ({card.titleEn})</span>}
        </span>
        <Badge tone="neutral">{card.level}</Badge>
        {viewed && <Badge tone="positive">열람</Badge>}
        <span aria-hidden="true" className="text-muted">
          {open ? '−' : '+'}
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-border px-3 py-3">
        <Markdown>{card.body}</Markdown>
        {card.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.tags.map((t) => (
              <Badge key={t} tone="neutral">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

export function Dossier({ scenario }: { scenario: ScenarioDefinition }) {
  const id = scenario.meta.id
  const progress = useProgressStore((s) => s.scenarios[id])
  const cardsViewed = useProgressStore((s) => s.learning.cardsViewed)
  const markBriefingSection = useProgressStore((s) => s.markBriefingSection)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const viewedSections = useMemo(
    () => new Set(progress?.briefingSectionsViewed ?? []),
    [progress?.briefingSectionsViewed],
  )

  const [openSections, setOpenSections] = useState<Set<DossierSectionId>>(
    () => new Set<DossierSectionId>(),
  )
  const [active, setActive] = useState<DossierSectionId>('situation')
  const rootRef = useRef<HTMLDivElement>(null)

  const baseline = useMemo(() => {
    try {
      const state = createGame(scenario, 1)
      return { snapshot: latestSnapshot(state), state, error: undefined }
    } catch (e) {
      return {
        snapshot: undefined,
        state: undefined,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }, [scenario])

  const markViewed = useCallback(
    (sectionId: string) => markBriefingSection(id, sectionId),
    [id, markBriefingSection],
  )

  // Observe sections → mark viewed + highlight ToC.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !rootRef.current) return
    const els = Array.from(rootRef.current.querySelectorAll<HTMLElement>('[data-section]'))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const sid = e.target.getAttribute('data-section') as DossierSectionId | null
          if (!sid) continue
          setActive(sid)
          if (openSections.has(sid)) markViewed(sid)
        }
      },
      { threshold: 0.2, rootMargin: '-15% 0px -55% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [markViewed, openSections])

  const toggleSection = (sid: DossierSectionId) =>
    setOpenSections((s) => {
      const next = new Set(s)
      if (next.has(sid)) next.delete(sid)
      else {
        next.add(sid)
        markViewed(sid)
      }
      return next
    })

  const kpiRows = scenario.kpis.map((k) => {
    const m = baseline.snapshot?.metrics[k.metric]
    return { k, m }
  })
  const objectives = scenario.meta.learningObjectives
  const goTo = (sid: DossierSectionId) => {
    setOpenSections((s) => {
      if (s.has(sid)) return s
      markViewed(sid)
      return new Set(s).add(sid)
    })
    document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={rootRef} className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <nav aria-label="브리핑 목차" className="sticky top-4 hidden self-start lg:block">
        <ol className="m-0 list-none space-y-0.5 border-l border-border p-0 text-sm">
          {DOSSIER_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#sec-${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  goTo(s.id)
                }}
                aria-current={active === s.id ? 'location' : undefined}
                className={`-ml-px block border-l-2 px-3 py-1 no-underline ${active === s.id ? 'border-accent text-text font-medium' : 'border-transparent text-muted hover:text-text'}`}
              >
                <span className="num">{s.n}.</span> {s.title}
                {viewedSections.has(s.id) && <span className="sr-only"> (열람함)</span>}
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-3 px-3 text-xs text-muted num">
          {viewedSections.size}/{DOSSIER_SECTIONS.length} 섹션 열람
        </p>
      </nav>

      <div className="space-y-3 min-w-0">
        {DOSSIER_SECTIONS.map((s) => {
          const common = {
            id: s.id,
            n: s.n,
            title: s.title,
            open: openSections.has(s.id),
            onToggle: () => toggleSection(s.id),
            viewed: viewedSections.has(s.id),
          }
          switch (s.id) {
            case 'situation':
              return (
                <Section key={s.id} {...common}>
                  <Markdown>{scenario.briefing.situation}</Markdown>
                  <h4 className="mt-4 text-base font-semibold">임무·권한 범위</h4>
                  <Markdown>{scenario.briefing.mandate}</Markdown>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="text-muted">역할</dt>
                    <dd>{scenario.meta.roleTitle}</dd>
                    <dt className="text-muted">시간 지평</dt>
                    <dd className="num">
                      {scenario.meta.durationTurns}턴 · {scenario.turns[0]?.timeLabel} →{' '}
                      {scenario.turns[scenario.turns.length - 1]?.timeLabel}
                    </dd>
                    <dt className="text-muted">모델 대상</dt>
                    <dd>{scenario.meta.modelledOn}</dd>
                  </dl>
                  {objectives.length > 0 && (
                    <>
                      <h4 className="mt-4 text-base font-semibold">학습 목표</h4>
                      <ul className="mt-1 space-y-1 text-sm">
                        {objectives.map((o) => (
                          <li key={o.id} className="flex gap-2">
                            <Badge tone="neutral" className="shrink-0">
                              {DIMENSION_LABELS[o.competency]}
                            </Badge>
                            <span>{o.text}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Section>
              )
            case 'institution':
              return (
                <Section key={s.id} {...common}>
                  <Markdown>{scenario.briefing.institutionProfile}</Markdown>
                  <h4 className="mt-4 text-base font-semibold">KPI 기준선 (T0)</h4>
                  {baseline.error ? (
                    <p className="text-sm text-critical">기준선 계산 실패: {baseline.error}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">T0 KPI 기준선</caption>
                        <thead>
                          <tr className="text-left text-muted border-b border-border">
                            <th className="py-1 pr-2 font-medium">지표</th>
                            <th className="py-1 pr-2 font-medium">값</th>
                            <th className="py-1 pr-2 font-medium">상태</th>
                            <th className="py-1 font-medium">기준</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kpiRows.map(({ k, m }) => (
                            <tr key={k.metric} className="border-b border-border/60 last:border-0">
                              <td className="py-1 pr-2">
                                {k.label}
                                {k.labelEn && <span className="text-muted"> ({k.labelEn})</span>}
                                {k.primary && <span className="sr-only"> (핵심)</span>}
                              </td>
                              <td className="py-1 pr-2 num whitespace-nowrap">
                                {m
                                  ? formatMetric(m.value, k.unit, scenario.units, k.decimals)
                                  : '—'}
                              </td>
                              <td className="py-1 pr-2">
                                <StatusBadge status={m?.status ?? 'na'} />
                              </td>
                              <td className="py-1 text-muted">
                                {k.referenceLabel ?? k.description ?? ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {scenario.initialState.institution.kind === 'bank' && (
                    <>
                      <h4 className="mt-4 text-base font-semibold">대차대조표 주요 항목 (T0)</h4>
                      <BankBalanceSheet b={scenario.initialState.institution} scenario={scenario} />
                    </>
                  )}
                </Section>
              )
            case 'market':
              return (
                <Section key={s.id} {...common}>
                  <Markdown>{scenario.briefing.marketBackdrop}</Markdown>
                </Section>
              )
            case 'stakeholders':
              return (
                <Section key={s.id} {...common}>
                  <ul className="grid gap-2 sm:grid-cols-2 list-none p-0 m-0">
                    {scenario.briefing.stakeholders.map((st) => (
                      <li key={st.name} className="rounded-md border border-border p-3 text-sm">
                        <div className="font-semibold text-base">{st.name}</div>
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                          <dt className="text-muted">원하는 것</dt>
                          <dd>{st.wants}</dd>
                          <dt className="text-muted">할 수 있는 것</dt>
                          <dd>{st.canDo}</dd>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </Section>
              )
            case 'regulation':
              return (
                <Section key={s.id} {...common}>
                  <Markdown>{scenario.briefing.regulatoryFramework}</Markdown>
                </Section>
              )
            case 'concepts':
              return (
                <Section key={s.id} {...common}>
                  {scenario.briefing.cardRefs.length === 0 ? (
                    <p className="text-sm text-muted">이 시나리오에 연결된 개념 카드가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {scenario.briefing.cardRefs.map((c) => (
                        <ConceptCard
                          key={c}
                          cardId={c}
                          viewed={cardsViewed.includes(c)}
                          onView={() => markCardViewed(c)}
                        />
                      ))}
                    </div>
                  )}
                </Section>
              )
            case 'scoring':
              return (
                <Section key={s.id} {...common}>
                  <p className="text-sm text-muted mb-2">
                    7개 차원의 가중 합산으로 종합 점수(0~100)를 계산합니다. 각 차원은 저작된 옵션
                    품질(전문가 평점)과 결과 지표를 함께 반영합니다.
                    {scenario.scoring.failureCap !== undefined ||
                    scenario.scoring.failureCapOrderly !== undefined ? (
                      <>
                        {' '}
                        실패 종료 시 상한 {scenario.scoring.failureCap ?? 40}점, 질서 있는 정리 시{' '}
                        {scenario.scoring.failureCapOrderly ?? 60}점.
                      </>
                    ) : (
                      ' 실패 종료 시 상한 40점(질서 있는 정리는 60점).'
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">평가 차원과 가중치</caption>
                      <thead>
                        <tr className="text-left text-muted border-b border-border">
                          <th className="py-1 pr-2 font-medium">차원</th>
                          <th className="py-1 pr-2 font-medium num">가중치</th>
                          <th className="py-1 font-medium">구성</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SCORE_DIMENSIONS.map((d: ScoreDimension) => {
                          const w = scenario.scoring.weights[d] ?? 0
                          const comps = scenario.scoring.rules[d]?.components
                          return (
                            <tr key={d} className="border-b border-border/60 last:border-0">
                              <td className="py-1 pr-2">
                                {DIMENSION_LABELS[d]}{' '}
                                <span className="text-muted">({DIMENSION_LABELS_EN[d]})</span>
                              </td>
                              <td className="py-1 pr-2 num">{w}%</td>
                              <td className="py-1 text-muted">
                                {comps
                                  ? comps.map((c) => c.label ?? c.kind).join(' · ')
                                  : '기관 유형 기본 규칙'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )
            case 'sources':
              return (
                <Section key={s.id} {...common}>
                  <h4 className="text-base font-semibold">출처</h4>
                  <ol className="mt-1 space-y-1 pl-5 text-sm">
                    {scenario.meta.sources.map((src) => (
                      <li key={src.id}>
                        <span className="font-medium">{src.title}</span>
                        <span className="text-muted">
                          {' '}
                          — {src.publisher}, {src.date}
                          {src.pages ? `, ${src.pages}` : ''}
                        </span>{' '}
                        <Badge tone="neutral">{SOURCE_KIND_LABELS[src.kind]}</Badge>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 break-all"
                          >
                            링크
                          </a>
                        )}
                        {src.note && <div className="text-muted">{src.note}</div>}
                      </li>
                    ))}
                  </ol>
                  <h4 className="mt-4 text-base font-semibold">단순화 노트</h4>
                  <ul className="mt-1 space-y-1 pl-5 list-disc text-sm">
                    {scenario.briefing.simplificationNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  {scenario.briefing.disclaimer && (
                    <p className="mt-3 rounded-md border border-border bg-surface-2 p-2 text-sm text-muted">
                      {scenario.briefing.disclaimer}
                    </p>
                  )}
                </Section>
              )
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
