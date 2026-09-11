import type {
  Decision,
  FeedItem,
  GameEvent,
  GameState,
  KpiSpec,
  MetricDelta,
  Mode,
  Option,
  ScenarioDefinition,
  Turn,
  TurnView,
} from '../../engine'
import { getTurnView } from '../../engine'
import { firstSentence, splitOptionLabel, truncateKo } from '../../lib/text'
import type { SettingsState } from '../../persistence/schema'

export const MODE_LABELS: Record<Mode, string> = {
  guided: '안내',
  standard: '표준',
  expert: '전문가',
}

export const REGULATOR_LABELS: Record<number, string> = {
  0: 'R0 정상',
  1: 'R1 강화 모니터링',
  2: 'R2 제한',
  3: 'R3 정리 준비',
  4: 'R4 폐쇄',
}

// ---------------------------------------------------------------- mode-dependent behaviour

export type PreviewFidelity = 'numeric' | 'directional' | 'none'

export function previewFidelity(mode: Mode): PreviewFidelity {
  if (mode === 'guided') return 'numeric'
  if (mode === 'standard') return 'directional'
  return 'none'
}

/** Option preview lifted to the page so dashboard tiles can show projected deltas. */
export interface PreviewState {
  fidelity: PreviewFidelity
  deltas: MetricDelta[]
}

export type RevealTiming = 'immediate' | 'endOfTurn' | 'endOfScenario'

export function rationaleTiming(
  setting: SettingsState['rationaleReveal'],
  mode: Mode,
): RevealTiming {
  if (setting !== 'mode') return setting
  if (mode === 'guided') return 'immediate'
  if (mode === 'standard') return 'endOfTurn'
  return 'endOfScenario'
}

/** Interrupt answering time is a mode setting, never a scenario one: 안내 ×2 · 표준 ×1.5 · 전문가 ×1. */
export const MODE_TIMEOUT_MULTIPLIER: Record<Mode, number> = {
  guided: 2,
  standard: 1.5,
  expert: 1,
}

export interface TimerConfig {
  limitMs: number
  pausable: boolean
}

/** Guided: no timer. Standard: ×1.5 and pausable. Expert: strict. */
export function timerConfig(
  decision: Decision,
  mode: Mode,
  timersEnabled: boolean,
): TimerConfig | null {
  if (!decision.timeLimitSec || !timersEnabled || mode === 'guided') return null
  const mult = mode === 'standard' ? 1.5 : 1
  return { limitMs: Math.round(decision.timeLimitSec * mult * 1000), pausable: mode === 'standard' }
}

export function letterFor(index: number): string {
  return String.fromCharCode(65 + Math.min(index, 25))
}

/**
 * Keyboard digit shown on a dialogue reply. Replies are capped at 4 by the authoring lint, so the
 * conversation always fits on 1–4 and never collides with the option list's own 1–5.
 */
export function replyKeyFor(index: number): string {
  return String(Math.min(index, 3) + 1)
}

// ---------------------------------------------------------------- sub-turn ticks

/** Authored clock label of a tick (`'09:00'`), falling back to `틱 n`. */
export function tickLabelOf(turn: Turn, tick: number): string {
  return turn.tickLabels?.[tick] ?? `틱 ${tick + 1}`
}

/** Deadline caption of a decision: `마감 11:00 · 2틱 남음`. Empty on an un-ticked turn. */
export function deadlineCaption(turn: Turn, decision: Decision, tick: number): string {
  const deadline = decision.deadlineTick
  if (deadline === undefined) return ''
  const left = deadline - tick
  const remaining = left > 0 ? ` · ${left}틱 남음` : ' · 마감'
  return `마감 ${tickLabelOf(turn, deadline)}${remaining}`
}

/** The tick a feed item or authored event belongs to (0 when it is not tick-scheduled). */
export function tickOfEntry(entry: WireEntry, state: GameState): number {
  if (entry.feed) return entry.feed.tick ?? 0
  const e = entry.event
  if (!e) return 0
  return state.tickSchedule[e.id] ?? e.atTick ?? 0
}

function arrowsFor(direction: 'up' | 'down' | 'flat', magnitude: number): string {
  if (direction === 'flat') return '→'
  return (direction === 'up' ? '▲' : '▼').repeat(Math.max(1, Math.min(3, magnitude)))
}

/**
 * The single 핵심 효과 line under an option title.
 * Priority: authored `preview` hints → the part of the label after `: ` → the first sentence
 * of the description. Never longer than one line at the play column width.
 */
export function optionEffectLine(option: Option, kpis: KpiSpec[]): string {
  if (option.preview && option.preview.length > 0) {
    return option.preview
      .slice(0, 3)
      .map((h) => {
        const label = kpis.find((k) => k.metric === h.metric)?.label ?? h.metric
        return `${label} ${arrowsFor(h.direction, h.magnitude)}`
      })
      .join(' · ')
  }
  const { tail } = splitOptionLabel(option.label)
  if (tail) return truncateKo(tail, 60)
  return firstSentence(option.description, 60).head
}

// ---------------------------------------------------------------- wire feed entries

/** One row of the situation feed: either an authored event or an engine feed item. */
export interface WireEntry {
  id: string
  turnIndex: number
  event?: GameEvent
  feed?: FeedItem
}

export function turnEntries(view: TurnView): WireEntry[] {
  return [
    ...view.events.map((e) => ({
      id: `e${view.turnIndex}-${e.id}`,
      turnIndex: view.turnIndex,
      event: e,
    })),
    ...view.feed.map((f) => ({ id: f.id, turnIndex: f.turnIndex, feed: f })),
  ]
}

export interface PreviousTurn {
  turnIndex: number
  entries: WireEntry[]
}

/** Entries of earlier turns: events visible at turn start (recomputed from history) + that turn's feed items. */
export function previousTurnEntries(
  history: GameState[],
  state: GameState,
  scenario: ScenarioDefinition,
  mode: Mode,
): PreviousTurn[] {
  const out: PreviousTurn[] = []
  for (let i = 0; i < state.turnIndex; i++) {
    const snapshot = history[i]
    let events: GameEvent[] = []
    if (snapshot) {
      try {
        events = getTurnView(snapshot, scenario, { mode }).events
      } catch {
        events = []
      }
    }
    const entries: WireEntry[] = [
      ...events.map((e) => ({ id: `e${i}-${e.id}`, turnIndex: i, event: e })),
      ...state.feed
        .filter((f) => f.turnIndex === i)
        .map((f) => ({ id: f.id, turnIndex: i, feed: f })),
    ]
    out.push({ turnIndex: i, entries })
  }
  return out
}

/** Day key used for day separators between turns (ISO date when available, else the label prefix). */
export function dayKeyOf(turn: { time?: string; timeLabel: string }): string {
  if (turn.time && turn.time.length >= 10) return turn.time.slice(0, 10)
  return turn.timeLabel.replace(/\d{1,2}:\d{2}.*$/, '').trim()
}

export function safeTurnView(
  state: GameState,
  scenario: ScenarioDefinition,
  mode: Mode,
): TurnView | undefined {
  try {
    return getTurnView(state, scenario, { mode })
  } catch {
    return undefined
  }
}
