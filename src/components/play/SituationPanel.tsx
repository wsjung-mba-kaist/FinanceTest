import { useEffect, useMemo, useState } from 'react'
import type { FeedItem, GameEvent, Severity } from '../../engine'
import { firstSentence } from '../../lib/text'
import { fillMetricTemplates } from '../../lib/template'
import { latestSnapshot } from '../../engine'
import { Badge, Button, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { Citation } from '../knowledge/Citation'
import { Markdown } from '../knowledge/Markdown'
import { TurnChanges } from './TurnChanges'
import { WireItem } from './WireItem'
import { usePlay } from './playContext'
import { turnEntries, type WireEntry } from './playHelpers'

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, positive: 1, info: 0 }

const TAG: Record<GameEvent['kind'], { label: string; tone: 'info' | 'warning' | 'neutral' }> = {
  newswire: { label: '속보', tone: 'info' },
  market: { label: '시장', tone: 'neutral' },
  memo: { label: '내부메모', tone: 'neutral' },
  call: { label: '전화', tone: 'neutral' },
  board: { label: '이사회', tone: 'neutral' },
  regulator: { label: '감독당국', tone: 'warning' },
  data: { label: '데이터', tone: 'neutral' },
  rumor: { label: '미확인', tone: 'warning' },
  dialogue: { label: '대화', tone: 'neutral' },
}

function headlineOf(e: GameEvent): string {
  switch (e.kind) {
    case 'memo':
      return e.subject
    case 'call':
      return `${e.caller}과(와)의 통화`
    case 'data':
    case 'dialogue':
      return e.title
    default:
      return e.headline
  }
}

function bodyOf(e: GameEvent): string {
  switch (e.kind) {
    case 'call':
    case 'dialogue':
      return e.lines.map((l) => `**${l.speaker}** ${l.text}`).join('\n\n')
    case 'market':
      return e.items
        .map((i) => `- ${i.label} ${i.value}${i.change ? ` (${i.change})` : ''}`)
        .join('\n')
    case 'data':
      return e.rows.map((r) => `- ${r.label} ${r.value}`).join('\n')
    default:
      return e.body
  }
}

function severityOf(entry: WireEntry): Severity {
  return entry.event?.severity ?? entry.feed?.severity ?? 'info'
}

/** The one thing to read first: full headline, first sentence, everything else behind 더 보기. */
function Headline({ entry, fill }: { entry: WireEntry; fill: (s: string) => string }) {
  const { scenario } = usePlay()
  const [open, setOpen] = useState(false)
  const e = entry.event
  const f = entry.feed
  const title = e ? headlineOf(e) : (f?.title ?? '')
  const raw = e ? bodyOf(e) : (f?.body ?? '')
  const body = fill(raw)
  const { head, rest } = useMemo(() => firstSentence(body, 90), [body])
  const severity = severityOf(entry)
  const tag = e ? TAG[e.kind] : { label: '결과', tone: 'info' as const }

  useEffect(() => setOpen(false), [entry.id])

  return (
    <article
      aria-labelledby="situation-headline"
      className={`rounded-lg border border-border-strong bg-surface shadow-card border-l-4 p-3 ${
        severity === 'critical'
          ? 'border-l-critical'
          : severity === 'warning'
            ? 'border-l-warning'
            : severity === 'positive'
              ? 'border-l-positive'
              : 'border-l-border-strong'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={tag.tone}>{tag.label}</Badge>
        {severity === 'critical' && <Badge tone="critical">위험</Badge>}
        {severity === 'warning' && <Badge tone="warning">경고</Badge>}
        {e?.reliability === 'unconfirmed' && <Badge tone="warning">미확인 정보</Badge>}
        {e?.time && <span className="num ml-auto text-sm text-muted">{e.time}</span>}
      </div>
      <h3 id="situation-headline" className="prose-col mt-1 text-md font-semibold">
        {title}
      </h3>
      {open ? (
        <Markdown className="prose-col md-compact mt-1 text-base">{body}</Markdown>
      ) : (
        head && <p className="prose-col mt-1 text-base">{head}</p>
      )}
      {rest && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 px-0"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '접기' : '더 보기'}
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        </Button>
      )}
      {e?.sourceRefs && e.sourceRefs.length > 0 && (
        <div className="mt-1 text-xs text-muted">
          출처
          <Citation ids={e.sourceRefs} local={scenario.meta.sources} />
        </div>
      )}
    </article>
  )
}

/** 최근 결과: what the last committed decision actually produced. */
function RecentResult({ items, fill }: { items: FeedItem[]; fill: (s: string) => string }) {
  if (items.length === 0) {
    return (
      <section aria-labelledby="recent-result-title" className="rounded-lg bg-surface-2 p-3">
        <h3 id="recent-result-title" className="label-caps">
          최근 결과
        </h3>
        <p className="mt-1 text-base text-muted">아직 이번 턴에 확정된 결정의 결과가 없습니다.</p>
      </section>
    )
  }
  return (
    <section aria-labelledby="recent-result-title" className="rounded-lg bg-surface-2 p-3">
      <h3 id="recent-result-title" className="label-caps">
        최근 결과
      </h3>
      <ul className="mt-1 list-none space-y-1.5 p-0">
        {items.map((f) => {
          const { head } = firstSentence(fill(f.body), 90)
          return (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-2">
              <Badge tone={f.severity === 'info' ? 'neutral' : f.severity}>{f.title}</Badge>
              <span className="min-w-0 flex-1 text-base">{head}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * 상황실 tab: one headline read large, two or three supporting one-liners, the result of the
 * last decision, and the status board. Everything else lives in 피드 전체.
 */
export function SituationPanel({
  onOpenFeed,
  onOpenDashboard,
}: {
  onOpenFeed: (entryId?: string) => void
  onOpenDashboard: () => void
}) {
  const { scenario, state, view } = usePlay()
  const entries = useMemo(() => turnEntries(view), [view])
  const events = useMemo(() => entries.filter((e) => e.event), [entries])
  const feedItems = useMemo(() => view.feed.filter((f) => f.kind !== 'system'), [view.feed])
  const snapshot = latestSnapshot(state)
  const fill = (text: string) => fillMetricTemplates(text, snapshot, scenario.units)

  const [headlineId, setHeadlineId] = useState<string | null>(null)
  const best = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => SEVERITY_RANK[severityOf(b)] - SEVERITY_RANK[severityOf(a)],
    )
    return sorted[0]
  }, [events])
  useEffect(() => {
    setHeadlineId(best?.id ?? null)
  }, [best?.id])
  const headline = events.find((e) => e.id === headlineId) ?? best
  const supporting = events.filter((e) => e.id !== headline?.id).slice(0, 3)
  const turn = view.turn
  const announce = useMemo(
    () => (events.length > 0 ? `${turn.label} 새 소식 ${events.length}건` : ''),
    [turn.label, events.length],
  )

  return (
    <div className="space-y-3 p-3">
      <LiveRegion message={announce} />
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="turn-header-current" tabIndex={-1} className="label-caps font-semibold">
          <span className="num rounded-sm bg-surface-2 px-1.5 py-0.5">{turn.label}</span>{' '}
          {turn.timeLabel}
          {turn.title ? ` · ${turn.title}` : ''}
        </h2>
        <span className="text-sm text-muted">지금 일어나는 일</span>
      </div>

      {headline ? (
        <Headline entry={headline} fill={fill} />
      ) : (
        <p className="rounded-lg bg-surface-2 p-3 text-base text-muted">
          이번 턴에는 새로 들어온 소식이 없습니다. 현황판과 결정을 확인해 주세요.
        </p>
      )}

      {supporting.length > 0 && (
        <section aria-labelledby="supporting-title">
          <h3 id="supporting-title" className="label-caps">
            함께 들어온 소식
          </h3>
          <ul className="mt-1 list-none space-y-1 p-0">
            {supporting.map((e) => (
              <li key={e.id}>
                <WireItem
                  entry={e}
                  unread={false}
                  compact
                  onRead={() => {}}
                  onOpen={onOpenFeed}
                  sources={scenario.meta.sources}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        최근 결과 moved above the fold and 창구·거래상대 현황판 moved to the dashboard tab.
        The board is a standing reference — it takes ~460px and changes slowly — and it was
        pushing "what did my last decision actually do" off the bottom of the column every turn.
        The situation column answers "what just happened"; a table of counterparties does not.
      */}
      <RecentResult items={feedItems.slice(-2)} fill={fill} />

      {/*
        "무엇이 바뀌었나"는 결과 릴이 한 번 재생하고 사라지면 다시 물을 방법이 없었다. 대시보드는
        숫자가 *어디* 있는지 말하지만 방금 *무엇을 했는지*는 말하지 않는다. 계산은 없다 —
        metricsHistory 의 두 스냅샷 차이다.
      */}
      <TurnChanges scenario={scenario} state={state} onSeeAll={onOpenDashboard} />

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => onOpenFeed()}>
          피드 전체 보기
          <Icon name="arrow-right" size={14} />
        </Button>
      </div>
    </div>
  )
}
