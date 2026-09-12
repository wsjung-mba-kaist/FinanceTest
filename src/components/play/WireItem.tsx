import { useContext, useEffect, useRef, type ReactNode } from 'react'
import type { DialogueLine, FeedItem, GameEvent, Severity, Source } from '../../engine'
import { Badge, type Tone } from '../ui'
import { Markdown } from '../knowledge/Markdown'
import { Citation } from '../knowledge/Citation'
import type { WireEntry } from './playHelpers'
import { PlayContext } from './playContext'
import { fillMetricTemplates } from '../../lib/template'

const FEED_SUBLABEL: Record<FeedItem['kind'], string | undefined> = {
  consequence: undefined,
  delayed: '지연 효과',
  gameover: '종료',
  system: '시스템',
  timeout: '시간 초과',
}

const BORDER: Record<Severity, string> = {
  info: 'border-l-border',
  warning: 'border-l-warning',
  critical: 'border-l-critical',
  positive: 'border-l-positive',
}

function severityBadge(sev: Severity): ReactNode {
  if (sev === 'warning') return <Badge tone="warning">⚠ 경고</Badge>
  if (sev === 'critical') return <Badge tone="critical">■ 위험</Badge>
  if (sev === 'positive') return <Badge tone="positive">● 정상</Badge>
  return null
}

/**
 * `routine` has no entry on purpose: 통상 is the default state of a wire item, and a pill that says
 * "nothing unusual" spends the reader's attention to tell them there was nothing to spend it on.
 */
const TONE_OF: Record<'concerned' | 'urgent', { label: string; tone: Tone }> = {
  concerned: { label: '우려', tone: 'warning' },
  urgent: { label: '긴급', tone: 'critical' },
}

/**
 * The channel a wire item arrived on. It carried a `tone` until the tag stopped being a badge —
 * severity is already said by the left border, the severity badge and the reliability flag, and a
 * fourth opinion about colour on the same row was what made none of them stand out.
 */
interface Header {
  tag: string
  meta?: string
}

function eventHeader(e: GameEvent): Header {
  switch (e.kind) {
    case 'newswire':
      return { tag: '[속보]', meta: e.outlet }
    case 'market':
      return { tag: '[시장]' }
    case 'memo':
      return { tag: '[내부메모]', meta: `${e.from} → ${e.to}` }
    case 'call':
      return {
        tag: '[전화]',
        meta: `${e.caller} → ${e.callee}${e.agency ? ` (${e.agency})` : ''}`,
      }
    case 'board':
      return { tag: '[이사회]' }
    case 'regulator':
      return { tag: '[감독당국]', meta: e.agency }
    case 'data':
      return { tag: '[데이터]' }
    case 'rumor':
      return { tag: '[미확인]', meta: e.source }
    case 'dialogue':
      return { tag: '[대화]' }
  }
}

function eventTitle(e: GameEvent): string {
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

function Lines({ lines }: { lines: DialogueLine[] }) {
  return (
    <dl className="mt-1 space-y-1">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="text-muted whitespace-nowrap">{l.speaker}</dt>
          <dd className="m-0">{l.text}</dd>
        </div>
      ))}
    </dl>
  )
}

function EventBody({ e, fill }: { e: GameEvent; fill: (s: string) => string }) {
  switch (e.kind) {
    case 'market':
      return (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {e.items.map((it, i) => (
              <tr key={i} className="border-t border-border first:border-t-0">
                <th scope="row" className="py-0.5 pr-2 text-left font-normal text-muted">
                  {it.label}
                </th>
                <td className="num py-0.5 text-right">{fill(it.value)}</td>
                <td className="num py-0.5 pl-2 text-right text-muted">{fill(it.change ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'data':
      return (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {e.rows.map((r, i) => (
              <tr key={i} className="border-t border-border first:border-t-0">
                <th scope="row" className="py-0.5 pr-2 text-left font-normal text-muted">
                  {r.label}
                </th>
                <td className="num py-0.5 text-right">{fill(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'call':
    case 'dialogue':
      return <Lines lines={e.lines} />
    default:
      return <Markdown className="mt-1 text-base">{fill(e.body)}</Markdown>
  }
}

/**
 * One feed row. Marks itself read once ≥60% visible (or on click).
 * `compact` renders the single-line variant used for the situation room's supporting rows
 * (tag · title · time) — the body stays in the full feed.
 */
export function WireItem({
  entry,
  unread,
  onRead,
  sources,
  compact,
  onOpen,
}: {
  entry: WireEntry
  unread: boolean
  onRead: (id: string) => void
  sources?: Source[]
  compact?: boolean
  /** Compact rows are buttons; this fires when one is activated. */
  onOpen?: (id: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const play = useContext(PlayContext)
  const snapshot =
    play?.state.metricsHistory.find((m) => m.turnIndex === entry.turnIndex) ??
    play?.state.metricsHistory[play.state.metricsHistory.length - 1]
  const fill = (text: string) =>
    play ? fillMetricTemplates(text, snapshot, play.scenario.units) : text
  useEffect(() => {
    if (!unread || typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) onRead(entry.id)
      },
      { threshold: 0.6 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [unread, entry.id, onRead])

  const e = entry.event
  const f = entry.feed
  const severity: Severity = e?.severity ?? f?.severity ?? 'info'
  const header: Header = e
    ? eventHeader(e)
    : { tag: '[결과]', meta: f ? FEED_SUBLABEL[f.kind] : undefined }
  const title = e ? eventTitle(e) : (f?.title ?? '')
  // `correctionOf` holds an authoring id; showing it raw ("정정: t2-rumor-1") tells the player
  // nothing. Resolve it to the headline of the item being corrected.
  const correctedTitle =
    e?.correctionOf && play
      ? play.scenario.turns
          .flatMap((t) => t.events)
          .filter((x) => x.id === e.correctionOf)
          .map(eventTitle)[0]
      : undefined
  const time = e?.time
  const tone = e && (e.kind === 'call' || e.kind === 'regulator') ? e.tone : undefined

  if (compact) {
    return (
      <button
        type="button"
        ref={ref as React.RefObject<HTMLButtonElement>}
        id={`wire-${entry.id}`}
        className={`flex min-h-tap-min w-full items-center gap-2 scroll-mt-4 rounded-md border border-border border-l-4 bg-surface px-2 py-1.5 text-left hover:bg-surface-2 ${BORDER[severity]}`}
        onClick={() => {
          onRead(entry.id)
          onOpen?.(entry.id)
        }}
      >
        {unread && (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent"
            aria-label="읽지 않음"
            role="img"
          />
        )}
        <span className="label-caps shrink-0">{header.tag}</span>
        <span className="min-w-0 flex-1 truncate text-base">{title}</span>
        {time && <span className="num shrink-0 text-sm text-muted">{time}</span>}
      </button>
    )
  }

  return (
    <article
      ref={ref}
      // Addressable, so the compact copy in the situation column can hand off to *this* item in
      // the full feed. Without an id the round trip dropped the item and just opened the tab —
      // the reader arrived at the top of the feed and had to find the story again by eye.
      id={`wire-${entry.id}`}
      className={`relative scroll-mt-4 rounded-md border border-border border-l-4 bg-surface px-3 py-2 ${BORDER[severity]}`}
      aria-label={`${header.tag} ${title}`}
      onClick={() => unread && onRead(entry.id)}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {unread && (
          <span
            className="inline-block h-2 w-2 rounded-full bg-accent"
            aria-label="읽지 않음"
            role="img"
          />
        )}
        {/*
          * The channel tag is an identifier, not a severity: `[속보]`, `[내부메모]`, `[시장]` say
          * *where this came from*, and drawing them as filled, bordered pills put a badge on every
          * row of the densest repeated unit on the screen. With the tag, the tone, the reliability
          * flag and the severity all wearing the same pill, none of them read as the important one.
          * The brackets already mark it as a tag; `label-caps` is the styling for exactly this.
          */}
        <span className="label-caps">{header.tag}</span>
        {header.meta && <span className="text-muted">{header.meta}</span>}
        {/* `통상` is the default state of a wire item and costs a pill to say nothing. */}
        {tone && tone !== 'routine' && <Badge tone={TONE_OF[tone].tone}>{TONE_OF[tone].label}</Badge>}
        {e?.reliability === 'unconfirmed' && <Badge tone="warning">미확인 정보</Badge>}
        {e?.reliability === 'false' && <Badge tone="critical">오보</Badge>}
        {e?.correctionOf && (
          <span className="text-muted">정정: {correctedTitle ?? '앞선 보도'}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {severityBadge(severity)}
          {time && <span className="num text-muted">{time}</span>}
        </span>
      </div>
      <h4 className="mt-1 text-base font-semibold leading-snug">{title}</h4>
      {e ? (
        <EventBody e={e} fill={fill} />
      ) : f ? (
        <Markdown className="mt-1 text-base">{fill(f.body)}</Markdown>
      ) : null}
      {e?.sourceRefs && e.sourceRefs.length > 0 && (
        <div className="mt-1 text-xs text-muted">
          출처
          <Citation ids={e.sourceRefs} local={sources} />
        </div>
      )}
    </article>
  )
}
