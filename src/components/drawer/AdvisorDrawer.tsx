import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GLOSSARY, getCard, triggeredCards } from '../../content'
import type { KnowledgeCard } from '../../content/types'
import type { AdvisorHint } from '../../engine'
import { findDecision } from '../../engine'
import { HINT_COSTS, useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Badge, Button, EmptyState, Tabs } from '../ui'
import { Markdown } from '../knowledge/Markdown'
import { InlineCard } from '../play/InlineCard'
import { usePlay } from '../play/playContext'

export type DrawerTab = 'advisor' | 'cards' | 'glossary' | 'memos'

const LEVELS = [1, 2, 3] as const
const LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: '무엇을 볼지', 2: '프레임워크', 3: '권고' }

interface HintGroup {
  key: string
  title: string
  resolved: boolean
  hints: AdvisorHint[]
}

function AdvisorTab() {
  const { run, mode, view, state } = usePlay()
  const revealHint = useGameStore((s) => s.revealHint)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const groups = useMemo<HintGroup[]>(() => {
    const map = new Map<string, HintGroup>()
    for (const h of view.hints) {
      const key = h.decisionId ?? `turn:${state.turnIndex}`
      let g = map.get(key)
      if (!g) {
        const dv = h.decisionId
          ? view.decisions.find((d) => d.decision.id === h.decisionId)
          : undefined
        g = {
          key,
          title: dv?.decision.title ?? (h.decisionId ? h.decisionId : '이번 턴 공통'),
          resolved: Boolean(dv?.resolved),
          hints: [],
        }
        map.set(key, g)
      }
      g.hints.push(h)
    }
    return [...map.values()]
  }, [view, state.turnIndex])

  if (mode === 'expert') {
    return (
      <EmptyState title="전문가 모드에서는 조언자를 사용할 수 없습니다">
        이번 턴의 힌트 {view.hints.length}개는 비공개 상태입니다. 디브리핑에서 전문가 관점을
        확인하실 수 있습니다.
      </EmptyState>
    )
  }
  if (groups.length === 0) return <EmptyState title="이번 턴에는 조언자 힌트가 없습니다" />
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted">
        {mode === 'guided'
          ? '안내 모드에서는 힌트가 무료입니다.'
          : `표준 모드에서는 단계별로 −${HINT_COSTS[1]} · −${HINT_COSTS[2]} · −${HINT_COSTS[3]}점이 차감됩니다.`}
      </p>
      {groups.map((g) => {
        const revealed = run.hintsRevealed[g.key] ?? 0
        const levels = LEVELS.filter((l) => g.hints.some((h) => h.level === l))
        const nextLevel = levels.find((l) => l > revealed)
        return (
          <section key={g.key} className="space-y-2" aria-label={g.title}>
            <h3 className="flex items-center gap-1.5 text-[12px] font-semibold">
              {g.title}
              {g.resolved && <Badge tone="neutral">확정됨</Badge>}
            </h3>
            {levels.map((l) => {
              const shown = l <= revealed
              const items = g.hints.filter((h) => h.level === l)
              return (
                <div key={l} className="rounded-md border border-border p-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <Badge tone={shown ? 'info' : 'neutral'}>{l}단계</Badge>
                    <span className="text-muted">{LEVEL_LABEL[l]}</span>
                    {!shown && l === nextLevel && (
                      <Button size="sm" className="ml-auto" onClick={() => revealHint(g.key, l)}>
                        힌트 보기{mode === 'standard' ? ` (−${HINT_COSTS[l]}점)` : ''}
                      </Button>
                    )}
                    {!shown && l !== nextLevel && (
                      <span className="ml-auto text-[11px] text-muted">
                        이전 단계를 먼저 확인해 주세요
                      </span>
                    )}
                  </div>
                  {shown &&
                    items.map((h, i) => (
                      <div key={i} className="mt-1.5 space-y-1">
                        <Markdown className="text-[12px] leading-relaxed">{h.text}</Markdown>
                        {h.cardRefs?.map((id) => (
                          <InlineCard
                            key={id}
                            cardId={id}
                            prefix="관련 카드:"
                            onOpen={markCardViewed}
                          />
                        ))}
                      </div>
                    ))}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function CardsTab() {
  const { scenario, state, view } = usePlay()
  const markCardViewed = useProgressStore((s) => s.markCardViewed)
  const cardsViewed = useProgressStore((s) => s.learning.cardsViewed)
  const list = useMemo(() => {
    const out: { card: KnowledgeCard; reason: string }[] = []
    const seen = new Set<string>()
    for (const id of view.cards) {
      const card = getCard(id)
      if (card && !seen.has(id)) {
        seen.add(id)
        out.push({ card, reason: '이번 턴과 관련된 카드' })
      }
    }
    for (const t of triggeredCards(state, scenario.meta.institutionType)) {
      if (!seen.has(t.card.id)) {
        seen.add(t.card.id)
        out.push(t)
      }
    }
    return out
  }, [view.cards, state, scenario.meta.institutionType])
  if (list.length === 0) return <EmptyState title="지금 표시할 지식카드가 없습니다" />
  return (
    <div className="space-y-2">
      {list.map(({ card, reason }) => (
        <div key={card.id}>
          <p className="mb-1 text-[11px] text-muted">{reason}</p>
          <InlineCard
            cardId={card.id}
            onOpen={markCardViewed}
            viewed={cardsViewed.includes(card.id)}
          />
        </div>
      ))}
    </div>
  )
}

function GlossaryTab() {
  const [q, setQ] = useState('')
  const termDisplay = useSettingsStore((s) => s.termDisplay)
  const markTermViewed = useProgressStore((s) => s.markTermViewed)
  const needle = q.trim().toLowerCase()
  const list = useMemo(() => {
    const all = needle
      ? GLOSSARY.filter(
          (g) =>
            g.term.ko.toLowerCase().includes(needle) ||
            g.term.en.toLowerCase().includes(needle) ||
            g.id.includes(needle) ||
            (g.aliases ?? []).some((a) => a.toLowerCase().includes(needle)),
        )
      : GLOSSARY
    return all.slice(0, 60)
  }, [needle])
  return (
    <div className="space-y-2">
      <input
        type="search"
        className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px]"
        placeholder="용어 검색 (한글·영문·약어)"
        aria-label="용어 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {list.length === 0 && <EmptyState title="일치하는 용어가 없습니다" />}
      <ul className="space-y-1.5">
        {list.map((g) => (
          <li key={g.id} className="rounded-md border border-border p-2 text-[12px]">
            <div className="font-semibold">
              {termDisplay === 'ko-en'
                ? `${g.term.ko} (${g.term.en})`
                : `${g.term.en} (${g.term.ko})`}
            </div>
            <p className="mt-0.5 leading-relaxed">{g.definition.ko}</p>
            <Link
              to={`/knowledge/glossary#${g.id}`}
              className="mt-0.5 inline-block text-accent"
              onClick={() => markTermViewed(g.id)}
            >
              자세히 →
            </Link>
          </li>
        ))}
      </ul>
      {GLOSSARY.length > list.length && !needle && (
        <p className="text-[11px] text-muted">
          처음 {list.length}개만 표시됩니다. 검색어를 입력해 주세요.
        </p>
      )}
    </div>
  )
}

function MemosTab() {
  const { scenario, state } = usePlay()
  const memos = state.decisions.filter((d) => d.memo)
  if (memos.length === 0)
    return (
      <EmptyState title="작성한 메모가 없습니다">
        결정 카드의 근거 메모는 여기와 디브리핑에 모입니다.
      </EmptyState>
    )
  return (
    <ul className="space-y-2">
      {memos.map((d, i) => {
        const found = findDecision(scenario, d.decisionId)
        const title = found?.decision.title ?? d.decisionId
        const labels = d.optionIds.map(
          (id) => found?.decision.options.find((o) => o.id === id)?.label ?? id,
        )
        return (
          <li
            key={`${d.turnIndex}-${d.decisionId}-${i}`}
            className="rounded-md border border-border p-2 text-[12px]"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="num">T+{d.turnIndex}</span>
              <span>{title}</span>
            </div>
            <div className="mt-0.5 text-muted">선택: {labels.join(', ')}</div>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{d.memo}</p>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Slide-over (desktop, 420px) / bottom sheet (mobile) with 조언자 | 지식카드 | 용어집 | 메모.
 * Esc closes; focus moves to the first control on open and returns to the opener on close.
 */
export function AdvisorDrawer({
  open,
  tab,
  onTab,
  onClose,
  mobile,
}: {
  open: boolean
  tab: DrawerTab
  onTab: (t: DrawerTab) => void
  onClose: () => void
  mobile: boolean
}) {
  const { view, state } = usePlay()
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = panel.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      returnTo.current?.focus()
    }
  }, [open])
  if (!open) return null

  const memoCount = state.decisions.filter((d) => d.memo).length
  const tabs: { id: DrawerTab; label: string; badge?: React.ReactNode }[] = [
    {
      id: 'advisor',
      label: '조언자',
      badge: view.hints.length > 0 ? <Badge tone="neutral">{view.hints.length}</Badge> : undefined,
    },
    {
      id: 'cards',
      label: '지식카드',
      badge: view.cards.length > 0 ? <Badge tone="neutral">{view.cards.length}</Badge> : undefined,
    },
    { id: 'glossary', label: '용어집' },
    {
      id: 'memos',
      label: '메모',
      badge: memoCount > 0 ? <Badge tone="neutral">{memoCount}</Badge> : undefined,
    },
  ]
  const panelClass = mobile
    ? 'absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-lg border border-border bg-surface shadow-xl'
    : 'fixed right-0 top-12 z-40 flex h-[calc(100vh-48px)] w-[420px] max-w-full flex-col border-l border-border bg-surface shadow-xl'
  const content = (
    <div
      ref={panel}
      role="dialog"
      aria-modal={mobile}
      aria-label="보조 패널"
      className={panelClass}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">보조 패널</h2>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={onClose}
          aria-label="보조 패널 닫기"
        >
          닫기 ✕
        </Button>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={onTab} ariaLabel="보조 패널 탭" />
      <div className="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
        {tab === 'advisor' && <AdvisorTab />}
        {tab === 'cards' && <CardsTab />}
        {tab === 'glossary' && <GlossaryTab />}
        {tab === 'memos' && <MemosTab />}
      </div>
    </div>
  )
  if (!mobile) return content
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      {content}
    </div>
  )
}
