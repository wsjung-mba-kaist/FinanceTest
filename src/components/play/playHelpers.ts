import type {
  Decision,
  FeedItem,
  GameEvent,
  GameState,
  MetricDelta,
  Mode,
  ScenarioDefinition,
  TurnView,
} from '../../engine'
import { getTurnView } from '../../engine'
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
