import type {
  ConsequenceReel,
  FeedChannel,
  FeedItem,
  GameState,
  Interrupt,
  InstitutionState,
  MetricDelta,
  MetricUnit,
  ReelStep,
  Severity,
} from '../types'
import { produce } from 'immer'
import { diffSnapshots, latestSnapshot } from './metrics'

export type { ConsequenceReel, ReelStep } from '../types'

/** Narrative order of the reel; the log filter uses the same axis. */
export const CHANNEL_ORDER: FeedChannel[] = [
  'result',
  'market',
  'depositors',
  'regulator',
  'board',
  'press',
  'internal',
]

/** Cadence between beats (ms). Mirrors `src/components/play/reelSteps.ts`. */
export const REEL_STEP_MS = 800

/** Most-significant metrics first: a status change dominates, then the relative move. */
function significance(d: MetricDelta): number {
  if (!Number.isFinite(d.delta)) return 0
  const base = Math.abs(d.before)
  const rel = base > 1e-9 ? Math.abs(d.delta / base) : 1
  return (d.statusBefore !== d.statusAfter ? 10 : 0) + Math.min(rel, 5)
}

function channelRank(f: FeedItem): number {
  const i = CHANNEL_ORDER.indexOf(f.channel ?? 'result')
  return i < 0 ? CHANNEL_ORDER.length : i
}

function marketItems(
  before: GameState,
  after: GameState,
): { label: string; before: number; after: number; unit: MetricUnit }[] {
  const rows: { label: string; before: number; after: number; unit: MetricUnit }[] = [
    {
      label: '자사 주가',
      before: before.market.ownStock,
      after: after.market.ownStock,
      unit: 'index',
    },
    { label: 'CDS', before: before.market.ownCdsBp, after: after.market.ownCdsBp, unit: 'bp' },
    {
      label: '시장 신뢰지수',
      before: before.confidence.index,
      after: after.confidence.index,
      unit: 'index',
    },
  ]
  return rows.filter((r) => Math.abs(r.after - r.before) > 1e-9)
}

type ReactionFrom = 'regulator' | 'board' | 'counterparty'

function reactions(before: GameState, after: GameState): { from: ReactionFrom; text: string }[] {
  const out: { from: ReactionFrom; text: string }[] = []
  if (after.regulator.level !== before.regulator.level) {
    const note = after.regulator.notes.slice(before.regulator.notes.length)[0]
    out.push({
      from: 'regulator',
      text:
        note ??
        `감독 단계가 R${before.regulator.level}에서 R${after.regulator.level}로 조정되었습니다`,
    })
  }
  const boardDelta = after.confidence.board - before.confidence.board
  if (Math.abs(boardDelta) >= 2) {
    out.push({
      from: 'board',
      text:
        boardDelta > 0 ? '이사회 신뢰가 회복되었습니다' : '이사회가 대응 속도에 우려를 표했습니다',
    })
  }
  const cpDelta = after.confidence.counterparties - before.confidence.counterparties
  if (Math.abs(cpDelta) >= 2) {
    out.push({
      from: 'counterparty',
      text:
        cpDelta > 0
          ? '거래상대의 신용 라인 태도가 완화되었습니다'
          : '거래상대가 담보·한도 조건을 조이기 시작했습니다',
    })
  }
  return out
}

const INTERRUPT_FROM: Record<Interrupt['source']['kind'], ReactionFrom> = {
  call: 'counterparty',
  desk: 'counterparty',
  regulator: 'regulator',
  board: 'board',
}

/**
 * Builds the beats played after a state transition:
 * ① 지표 변화 → ② 결과 서술(채널 순서) → ③ 시장 반응 → ④ 감독·이사회 반응 → ⑤ 새 인터럽트.
 * Empty beats are dropped and the remaining delays are re-spaced at `REEL_STEP_MS`.
 *
 * Pure and deterministic: the reel is stored on the state, so replay reproduces it exactly.
 */
export function buildReel<S extends InstitutionState>(
  before: GameState<S>,
  after: GameState<S>,
  cause: ConsequenceReel['cause'],
  opts: { interrupts?: Interrupt<S>[] } = {},
): ConsequenceReel {
  const b = before as GameState
  const a = after as GameState
  const deltas = diffSnapshots(latestSnapshot(b), latestSnapshot(a))
    .sort((x, y) => significance(y) - significance(x))
    .slice(0, 6)

  const newFeed = a.feed.slice(b.feed.length)
  const items: { title: string; body: string; severity: Severity }[] = [...newFeed]
    .sort((x, y) => channelRank(x) - channelRank(y))
    .map((f) => ({ title: f.title, body: f.body, severity: f.severity }))

  const market = marketItems(b, a)
  const steps: ReelStep[] = []
  if (deltas.length > 0) steps.push({ kind: 'metrics', deltas, delayMs: 0 })
  if (items.length > 0) steps.push({ kind: 'consequence', items, delayMs: 0 })
  if (market.length > 0) steps.push({ kind: 'market', items: market, delayMs: 0 })
  for (const r of reactions(b, a)) {
    steps.push({ kind: 'reaction', from: r.from, text: r.text, delayMs: 0 })
  }
  const opened = a.openInterrupts.filter((id) => !b.openInterrupts.includes(id))
  for (const id of opened) {
    const it = opts.interrupts?.find((x) => x.id === id)
    if (!it) continue
    const line = it.lines[0]?.text ?? it.prompt
    steps.push({
      kind: 'reaction',
      from: INTERRUPT_FROM[it.source.kind],
      text: `${it.source.caller}${it.source.agency ? ` (${it.source.agency})` : ''}: ${line}`,
      delayMs: 0,
    })
  }

  const suffix = cause.decisionId ? `-${cause.decisionId}` : ''
  return {
    id: `r${a.turnIndex}.${a.tick}-${cause.kind}${suffix}`,
    cause,
    turnIndex: a.turnIndex,
    tick: a.tick,
    steps: steps.map((s, i) => ({ ...s, delayMs: i * REEL_STEP_MS })),
  }
}

/** Stores a freshly built reel on the state (the store plays it; autoplay and replay ignore it). */
export function withReel<S extends InstitutionState>(
  state: GameState<S>,
  reel: ConsequenceReel,
): GameState<S> {
  return produce(state, (d) => {
    d.lastReel = reel
  })
}
