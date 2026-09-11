import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCard } from '../../content'
import { createGame, latestSnapshot } from '../../engine'
import type { BankState, Mode, ScenarioDefinition, ScoreDimension } from '../../engine/types'
import { SCORE_DIMENSIONS } from '../../engine/types/common'
import { formatCurrency, formatMetric } from '../../lib/format'
import {
  DIMENSION_LABELS,
  DIMENSION_LABELS_EN,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  SOURCE_KIND_LABELS,
  shortDate,
  turnProgressLabel,
} from '../../lib/labels'
import { useMediaQuery } from '../../lib/useScenario'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { GlossaryTerm } from '../knowledge/GlossaryTerm'
import { Markdown } from '../knowledge/Markdown'
import { Badge, Button, ConfirmDialog, StatusBadge } from '../ui'

export const DOSSIER_SECTIONS = [
  { id: 'situation', n: 1, title: '상황 개요' },
  { id: 'institution', n: 2, title: '기관 현황' },
  { id: 'market', n: 3, title: '시장 배경' },
  { id: 'stakeholders', n: 4, title: '이해관계자' },
  { id: 'regulation', n: 5, title: '규제·제도' },
  { id: 'concepts', n: 6, title: '핵심 개념' },
  { id: 'scoring', n: 7, title: '평가 기준' },
  { id: 'mode', n: 8, title: '모드·시작' },
  { id: 'sources', n: 9, title: '출처·단순화 노트' },
] as const
export type DossierSectionId = (typeof DOSSIER_SECTIONS)[number]['id']

const MODES: Mode[] = ['guided', 'standard', 'expert']

function Section({
  id,
  n,
  title,
  mobile,
  open,
  onToggle,
  viewed,
  children,
}: {
  id: DossierSectionId
  n: number
  title: string
  mobile: boolean
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
      className="rounded-lg border border-border bg-surface scroll-mt-4"
    >
      {mobile ? (
        <h2 id={headingId} className="m-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-semibold"
          >
            <span className="text-muted num">{n}.</span>
            <span className="flex-1">{title}</span>
            {viewed && <span className="text-[11px] font-normal text-positive">열람</span>}
            <span aria-hidden="true" className="text-muted">
              {open ? '−' : '+'}
            </span>
          </button>
        </h2>
      ) : (
        <h2
          id={headingId}
          className="m-0 flex items-center gap-2 border-b border-border px-4 py-3 text-[15px] font-semibold"
        >
          <span className="text-muted num">{n}.</span>
          <span className="flex-1">{title}</span>
          {viewed && <span className="text-[11px] font-normal text-positive">열람</span>}
        </h2>
      )}
      <div id={panelId} hidden={mobile && !open} className="px-4 py-4">
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
      <table className="w-full text-[12px]">
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
      <div className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted">
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
  const navigate = useNavigate()
  const id = scenario.meta.id
  const mobile = !useMediaQuery('(min-width: 1024px)')
  const defaultMode = useSettingsStore((s) => s.defaultMode)
  const timersEnabled = useSettingsStore((s) => s.timersEnabled)
  const progress = useProgressStore((s) => s.scenarios[id])
  const cardsViewed = useProgressStore((s) => s.learning.cardsViewed)
  const markBriefingSection = useProgressStore((s) => s.markBriefingSection)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const viewedSections = useMemo(
    () => new Set(progress?.briefingSectionsViewed ?? []),
    [progress?.briefingSectionsViewed],
  )
  const inProgress = progress?.inProgress

  const [mode, setMode] = useState<Mode>(defaultMode)
  const [openSections, setOpenSections] = useState<Set<DossierSectionId>>(
    () => new Set<DossierSectionId>(['situation']),
  )
  const [active, setActive] = useState<DossierSectionId>('situation')
  const [confirmNew, setConfirmNew] = useState(false)
  const [restoreError, setRestoreError] = useState<string | undefined>()
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
          if (!mobile || openSections.has(sid)) markViewed(sid)
        }
      },
      { threshold: 0.2, rootMargin: '-15% 0px -55% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [markViewed, mobile, openSections])

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

  const startNew = () => {
    useGameStore.getState().start(scenario, mode)
    navigate(`/play/${id}`)
  }
  const resume = () => {
    if (!inProgress) return
    const g = useGameStore.getState()
    if (g.run?.runId !== inProgress.runId) {
      const ok = g.restore(scenario, inProgress)
      if (!ok) {
        setRestoreError(
          '저장된 진행 상황이 현재 시나리오 버전과 맞지 않아 이어할 수 없습니다. 새로 시작해 주세요.',
        )
        return
      }
    }
    navigate(`/play/${id}`)
  }

  const kpiRows = scenario.kpis.map((k) => {
    const m = baseline.snapshot?.metrics[k.metric]
    return { k, m }
  })
  const objectives = scenario.meta.learningObjectives
  const goTo = (sid: DossierSectionId) => {
    if (mobile) setOpenSections((s) => new Set(s).add(sid))
    document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={rootRef} className="grid gap-4 lg:grid-cols-[200px_1fr]">
      {!mobile && (
        <nav aria-label="브리핑 목차" className="sticky top-4 self-start">
          <ol className="m-0 list-none space-y-0.5 border-l border-border p-0 text-[12px]">
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
          <p className="mt-3 px-3 text-[11px] text-muted num">
            {viewedSections.size}/{DOSSIER_SECTIONS.length} 섹션 열람
          </p>
        </nav>
      )}

      <div className="space-y-3 min-w-0">
        {DOSSIER_SECTIONS.map((s) => {
          const common = {
            id: s.id,
            n: s.n,
            title: s.title,
            mobile,
            open: openSections.has(s.id),
            onToggle: () => toggleSection(s.id),
            viewed: viewedSections.has(s.id),
          }
          switch (s.id) {
            case 'situation':
              return (
                <Section key={s.id} {...common}>
                  <Markdown>{scenario.briefing.situation}</Markdown>
                  <h3 className="mt-4 text-[13px] font-semibold">임무·권한 범위</h3>
                  <Markdown>{scenario.briefing.mandate}</Markdown>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
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
                      <h3 className="mt-4 text-[13px] font-semibold">학습 목표</h3>
                      <ul className="mt-1 space-y-1 text-[12px]">
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
                  <h3 className="mt-4 text-[13px] font-semibold">KPI 기준선 (T0)</h3>
                  {baseline.error ? (
                    <p className="text-[12px] text-critical">기준선 계산 실패: {baseline.error}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
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
                      <h3 className="mt-4 text-[13px] font-semibold">대차대조표 주요 항목 (T0)</h3>
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
                      <li key={st.name} className="rounded-md border border-border p-3 text-[12px]">
                        <div className="font-semibold text-[13px]">{st.name}</div>
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
                    <p className="text-[12px] text-muted">
                      이 시나리오에 연결된 개념 카드가 없습니다.
                    </p>
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
                  <p className="text-[12px] text-muted mb-2">
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
                    <table className="w-full text-[12px]">
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
            case 'mode':
              return (
                <Section key={s.id} {...common}>
                  {inProgress && (
                    <div className="mb-4 rounded-md border border-info/40 bg-info-bg p-3 text-[12px]">
                      <div className="font-medium text-info">진행 중인 플레이가 있습니다</div>
                      <div className="mt-0.5 num">
                        {turnProgressLabel(inProgress.turnIndex, scenario.meta.durationTurns)} ·{' '}
                        {MODE_LABELS[inProgress.mode]} 모드 · 마지막 저장{' '}
                        {shortDate(inProgress.updatedAt)}
                        {inProgress.scenarioVersion !== scenario.meta.version && (
                          <span className="text-warning">
                            {' '}
                            · 시나리오 버전이 변경되어 이어할 수 없습니다
                          </span>
                        )}
                      </div>
                      {restoreError && <p className="mt-1 text-critical">{restoreError}</p>}
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="primary"
                          onClick={resume}
                          disabled={inProgress.scenarioVersion !== scenario.meta.version}
                        >
                          이어하기
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirmNew(true)}>
                          새로 시작
                        </Button>
                      </div>
                    </div>
                  )}
                  <div
                    role="radiogroup"
                    aria-label="플레이 모드"
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {MODES.map((m) => {
                      const checked = mode === m
                      return (
                        <label
                          key={m}
                          className={`cursor-pointer rounded-md border p-3 text-[12px] transition-colors ${checked ? 'border-accent bg-accent-soft' : 'border-border hover:border-muted'}`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="mode"
                              value={m}
                              checked={checked}
                              onChange={() => setMode(m)}
                              className="accent-accent"
                            />
                            <span className="text-[13px] font-semibold">{MODE_LABELS[m]}</span>
                            {m === defaultMode && <Badge tone="neutral">기본</Badge>}
                          </span>
                          <ul className="mt-2 space-y-0.5 pl-5 list-disc text-muted">
                            {MODE_DESCRIPTIONS[m].map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </label>
                      )
                    })}
                  </div>
                  {!timersEnabled && (
                    <p className="mt-2 text-[12px] text-muted">
                      설정에서 타이머가 꺼져 있어 결정 시간 제한은 적용되지 않습니다.
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    {inProgress ? (
                      <Button variant="secondary" size="lg" onClick={() => setConfirmNew(true)}>
                        {MODE_LABELS[mode]} 모드로 새로 시작
                      </Button>
                    ) : (
                      <Button variant="primary" size="lg" onClick={startNew}>
                        {MODE_LABELS[mode]} 모드로 시작
                      </Button>
                    )}
                    <span className="text-[12px] text-muted num">
                      예상 소요 약 {scenario.meta.estMinutes}분
                    </span>
                  </div>
                </Section>
              )
            case 'sources':
              return (
                <Section key={s.id} {...common}>
                  <h3 className="text-[13px] font-semibold">출처</h3>
                  <ol className="mt-1 space-y-1 pl-5 text-[12px]">
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
                  <h3 className="mt-4 text-[13px] font-semibold">단순화 노트</h3>
                  <ul className="mt-1 space-y-1 pl-5 list-disc text-[12px]">
                    {scenario.briefing.simplificationNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  {scenario.briefing.disclaimer && (
                    <p className="mt-3 rounded-md border border-border bg-surface-2 p-2 text-[12px] text-muted">
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

      <ConfirmDialog
        open={confirmNew}
        title="새로 시작할까요?"
        body="진행 중인 플레이 저장분이 삭제되고 처음부터 다시 시작합니다. 완료된 기록은 유지됩니다."
        confirmLabel="새로 시작"
        destructive
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false)
          startNew()
        }}
      />
    </div>
  )
}
