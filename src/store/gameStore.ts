import { create } from 'zustand'
import {
  advanceTick,
  advanceTurn,
  applyDecision,
  canAdvanceTick,
  computeScore,
  createGame,
  replay,
  type DecisionMeta,
  type GameState,
  type Mode,
  type ScenarioDefinition,
  type ScoreReport,
} from '../engine'
import type { InProgressSave } from '../persistence/schema'
import { useProgressStore } from './progressStore'
import { useSettingsStore } from './settingsStore'

export const HINT_COSTS: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 8 }

/**
 * Real milliseconds one simulated tick lasts at ×1, per mode. The `clockTickSec` setting
 * overrides it; the engine itself never sees real time (see `lib/useSimulationClock.ts`).
 */
export const MODE_TICK_MS: Record<Mode, number> = {
  guided: 30_000,
  standard: 20_000,
  expert: 12_000,
}

export type ClockSpeed = 1 | 2 | 4

/** Player-facing clock intent. `running` is desire, not fact: the hook holds it for interrupts etc. */
export interface ClockState {
  running: boolean
  speed: ClockSpeed
  /** Real ms per tick at ×1. */
  baseTickMs: number
}

function baseTickMsFor(mode: Mode): number {
  const sec = useSettingsStore.getState().clockTickSec
  return sec !== undefined ? Math.round(sec * 1000) : MODE_TICK_MS[mode]
}

function initialClock(mode: Mode): ClockState {
  return { running: false, speed: 1, baseTickMs: baseTickMsFor(mode) }
}

export interface RunInfo {
  runId: string
  mode: Mode
  seed: number
  /**
   * 0 = canonical (engine draws no RNG), 0.5 / 1 = live volatility. Optional and additive:
   * runs recorded before L2 have no field and read back as 0.
   */
  variance?: number
  rewinds: number
  hintPenalty: number
  hintsRevealed: Record<string, number>
  startedAt: string
  forkedFrom?: { runId: string; turnIndex: number }
}

/** Undo window opened by `choose()`; 5s normally, 8s when an `irreversible` option was picked. */
export const UNDO_MS = 5_000
export const UNDO_MS_IRREVERSIBLE = 8_000

/**
 * Snapshot taken immediately before the last `choose()`. Restoring it removes the
 * `DecisionRecord` from `state.decisions` as well, so an undone decision never enters
 * the persisted log and replay/scoring are bit-identical to a run where it never happened.
 */
export interface UndoableChoice {
  prevState: GameState
  prevHistory: GameState[]
  decisionId: string
  optionIds: string[]
  /** Epoch ms at which the window closes. */
  until: number
}

interface GameStore {
  scenario?: ScenarioDefinition
  state?: GameState
  /** State at the start of each turn (index = turn index). */
  history: GameState[]
  run?: RunInfo
  /** Open undo window for the last decision (absent in expert mode). */
  undoable?: UndoableChoice
  /**
   * Reply ids walked so far in each in-progress dialogue, by decision id. An unfinished
   * conversation is UI state: it deliberately lives here and never enters `GameState`, so the
   * engine's determinism contract only ever sees a *completed* path on the `DecisionRecord`.
   */
  dialoguePaths: Record<string, string[]>
  /** Simulated-clock intent owned by the store; `useSimulationClock` drives it. */
  clock: ClockState
  /** Id of the last `state.lastReel` the UI has finished playing. */
  playedReelId?: string
  /** Turn index whose rationale panel is being shown (UI phase helper). */
  lastError?: string
  start: (scenario: ScenarioDefinition, mode: Mode, seed?: number, variance?: number) => void
  restore: (scenario: ScenarioDefinition, saved: InProgressSave) => boolean
  choose: (decisionId: string, optionIds: string[], meta?: DecisionMeta) => boolean
  /** Answers an open interrupt. Never opens an undo window — a phone call cannot be taken back. */
  respondInterrupt: (id: string, optionIds: string[], meta?: DecisionMeta) => boolean
  /** Appends one reply to a decision's in-progress dialogue. */
  dialogueReply: (decisionId: string, replyId: string) => void
  /** 한 단계 되돌리기: drops the last reply of a decision's in-progress dialogue. */
  dialogueBack: (decisionId: string) => void
  /** Clears one decision's in-progress dialogue (or every one). */
  dialogueReset: (decisionId?: string) => void
  undoChoice: () => boolean
  clearUndo: () => void
  /** Plays one sub-turn tick. False when the turn has no tick left (or the run ended). */
  tickAdvance: () => boolean
  pause: () => void
  resume: () => void
  setSpeed: (speed: ClockSpeed) => void
  markReelPlayed: (id: string) => void
  next: () => boolean
  rewindTo: (turnIndex: number) => void
  forkFrom: (turnIndex: number) => void
  revealHint: (decisionId: string, level: 1 | 2 | 3) => void
  finish: () => ScoreReport | undefined
  abandon: () => void
  clearError: () => void
}

/** A copy of `paths` without `key` — returns the same object when there is nothing to drop. */
function without(paths: Record<string, string[]>, key: string): Record<string, string[]> {
  if (!(key in paths)) return paths
  const next = { ...paths }
  delete next[key]
  return next
}

const nowIso = () => new Date().toISOString()
const newRunId = () => `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

function persistInProgress(store: GameStore): void {
  const { scenario, state, run } = store
  if (!scenario || !state || !run) return
  if (state.phase === 'ended') return
  const save: InProgressSave = {
    runId: run.runId,
    seed: run.seed,
    mode: run.mode,
    scenarioVersion: scenario.meta.version,
    decisions: state.decisions,
    turnIndex: state.turnIndex,
    tick: state.tick,
    variance: state.variance,
    rewinds: run.rewinds,
    hintPenalty: run.hintPenalty,
    hintsRevealed: run.hintsRevealed,
    startedAt: run.startedAt,
    updatedAt: nowIso(),
    forkedFrom: run.forkedFrom,
  }
  useProgressStore.getState().setInProgress(scenario.meta.id, save)
}

export const useGameStore = create<GameStore>((set, get) => ({
  history: [],
  dialoguePaths: {},
  clock: { running: false, speed: 1, baseTickMs: MODE_TICK_MS.standard },
  start: (scenario, mode, seed = 1, variance) => {
    // 엔진 기본은 0(정본·재현용)이므로 플레이 기본값은 설정에서 가져온다.
    const v = variance ?? useSettingsStore.getState().variance ?? 1
    const state = createGame(scenario, seed, { variance: v })
    set({
      scenario,
      state,
      history: [state],
      run: {
        runId: newRunId(),
        mode,
        seed,
        variance: v,
        rewinds: 0,
        hintPenalty: 0,
        hintsRevealed: {},
        startedAt: nowIso(),
      },
      clock: initialClock(mode),
      playedReelId: undefined,
      undoable: undefined,
      dialoguePaths: {},
      lastError: undefined,
    })
    persistInProgress(get())
  },
  restore: (scenario, saved) => {
    if (saved.scenarioVersion !== scenario.meta.version) return false
    try {
      const { state, history } = replay(scenario, {
        seed: saved.seed,
        decisions: saved.decisions,
        turnIndex: saved.turnIndex,
        ...(saved.tick !== undefined ? { tick: saved.tick } : {}),
        variance: saved.variance ?? 0,
      })
      set({
        scenario,
        state,
        history,
        run: {
          runId: saved.runId,
          mode: saved.mode,
          seed: saved.seed,
          variance: saved.variance ?? 0,
          rewinds: saved.rewinds,
          hintPenalty: saved.hintPenalty,
          hintsRevealed: saved.hintsRevealed,
          startedAt: saved.startedAt,
          forkedFrom: saved.forkedFrom,
        },
        clock: initialClock(saved.mode),
        // A reel rebuilt by the replay belongs to a moment the player already lived through.
        playedReelId: state.lastReel?.id,
        undoable: undefined,
        dialoguePaths: {},
        lastError: undefined,
      })
      return true
    } catch {
      return false
    }
  },
  choose: (decisionId, optionIds, meta = {}) => {
    const { scenario, state, run, history } = get()
    if (!scenario || !state || !run) return false
    try {
      const pending = run.hintsRevealed[decisionId] ?? 0
      const penalty = run.mode === 'standard' ? ([0, 2, 6, 14][pending] ?? 0) : 0
      const next = applyDecision(state, scenario, decisionId, optionIds, {
        ...meta,
        hintsUsed: pending || undefined,
        hintPenalty: penalty || undefined,
      })
      // Expert mode commits for good; other modes keep a short window to take it back.
      const decision = scenario.turns[state.turnIndex]?.decisions.find((d) => d.id === decisionId)
      const irreversible = optionIds.some(
        (id) => decision?.options.find((o) => o.id === id)?.irreversible,
      )
      const undoable =
        run.mode === 'expert'
          ? undefined
          : {
              prevState: state,
              prevHistory: history,
              decisionId,
              optionIds,
              until: Date.now() + (irreversible ? UNDO_MS_IRREVERSIBLE : UNDO_MS),
            }
      set({
        state: next,
        lastError: undefined,
        undoable,
        dialoguePaths: without(get().dialoguePaths, decisionId),
      })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  respondInterrupt: (id, optionIds, meta = {}) => {
    const { scenario, state } = get()
    if (!scenario || !state) return false
    if (!state.openInterrupts.includes(id)) return false
    try {
      const next = applyDecision(state, scenario, id, optionIds, meta)
      set({
        state: next,
        undoable: undefined,
        dialoguePaths: without(get().dialoguePaths, id),
        lastError: undefined,
      })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  dialogueReply: (decisionId, replyId) =>
    set((s) => ({
      dialoguePaths: {
        ...s.dialoguePaths,
        [decisionId]: [...(s.dialoguePaths[decisionId] ?? []), replyId],
      },
    })),
  dialogueBack: (decisionId) =>
    set((s) => {
      const cur = s.dialoguePaths[decisionId]
      if (!cur || cur.length === 0) return s
      return { dialoguePaths: { ...s.dialoguePaths, [decisionId]: cur.slice(0, -1) } }
    }),
  dialogueReset: (decisionId) =>
    set((s) =>
      decisionId === undefined
        ? { dialoguePaths: {} }
        : { dialoguePaths: without(s.dialoguePaths, decisionId) },
    ),
  tickAdvance: () => {
    const { scenario, state } = get()
    if (!scenario || !state) return false
    if (!canAdvanceTick(state, scenario)) return false
    try {
      // An undo window cannot survive the simulated clock moving on.
      set({ state: advanceTick(state, scenario), undoable: undefined, lastError: undefined })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  pause: () => set((s) => ({ clock: { ...s.clock, running: false } })),
  resume: () => set((s) => ({ clock: { ...s.clock, running: true } })),
  setSpeed: (speed) => set((s) => ({ clock: { ...s.clock, speed, running: true } })),
  markReelPlayed: (id) => set((s) => (s.playedReelId === id ? s : { playedReelId: id })),
  undoChoice: () => {
    const { undoable } = get()
    if (!undoable) return false
    set({
      state: undoable.prevState,
      history: undoable.prevHistory,
      playedReelId: undoable.prevState.lastReel?.id,
      undoable: undefined,
      // The conversation is walked again from the top: its effects were undone with the decision.
      dialoguePaths: without(get().dialoguePaths, undoable.decisionId),
      lastError: undefined,
    })
    // Re-persist so the saved decision log matches the restored state.
    persistInProgress(get())
    return true
  },
  clearUndo: () => set({ undoable: undefined }),
  next: () => {
    const { scenario, state, history, clock } = get()
    if (!scenario || !state) return false
    try {
      // `advanceTurn` fast-forwards any tick the player left unplayed, sweep included.
      const next = advanceTurn(state, scenario)
      const h =
        next.turnIndex > state.turnIndex ? [...history.slice(0, next.turnIndex), next] : history
      set({
        state: next,
        history: h,
        // A new turn opens on the intro card; the clock only restarts when the player says so.
        clock: { ...clock, running: false },
        undoable: undefined,
        dialoguePaths: {},
        lastError: undefined,
      })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  rewindTo: (turnIndex) => {
    const { history, run, clock } = get()
    const target = history[turnIndex]
    if (!target || !run) return
    set({
      state: target,
      history: history.slice(0, turnIndex + 1),
      run: { ...run, rewinds: run.rewinds + 1 },
      clock: { ...clock, running: false },
      playedReelId: target.lastReel?.id,
      undoable: undefined,
      dialoguePaths: {},
    })
    persistInProgress(get())
  },
  forkFrom: (turnIndex) => {
    const { history, run, scenario, clock } = get()
    const target = history[turnIndex]
    if (!target || !run || !scenario) return
    set({
      state: target,
      history: history.slice(0, turnIndex + 1),
      clock: { ...clock, running: false },
      playedReelId: target.lastReel?.id,
      run: {
        runId: newRunId(),
        mode: run.mode,
        seed: run.seed,
        variance: run.variance,
        rewinds: 0,
        hintPenalty: 0,
        hintsRevealed: {},
        startedAt: nowIso(),
        forkedFrom: { runId: run.runId, turnIndex },
      },
      undoable: undefined,
      dialoguePaths: {},
    })
    persistInProgress(get())
  },
  revealHint: (decisionId, level) => {
    const { run } = get()
    if (!run) return
    const cur = run.hintsRevealed[decisionId] ?? 0
    if (level <= cur) return
    const cost = run.mode === 'standard' ? HINT_COSTS[level] : 0
    set({
      run: {
        ...run,
        hintsRevealed: { ...run.hintsRevealed, [decisionId]: level },
        hintPenalty: run.hintPenalty + cost,
      },
    })
    persistInProgress(get())
  },
  finish: () => {
    const { scenario, state, run } = get()
    if (!scenario || !state || !run || state.phase !== 'ended') return undefined
    const report = computeScore(state, scenario)
    const dims: Record<string, number> = {}
    for (const [k, v] of Object.entries(report.dimensions)) dims[k] = v.score
    useProgressStore.getState().recordAttempt(scenario.meta.id, {
      runId: run.runId,
      seed: run.seed,
      mode: run.mode,
      scenarioVersion: scenario.meta.version,
      decisions: state.decisions,
      variance: run.variance,
      rewinds: run.rewinds,
      hintPenalty: run.hintPenalty,
      total: report.total,
      grade: report.grade,
      dimensions: dims,
      endedReason: state.ended?.reason ?? 'completed',
      failed: Boolean(state.ended?.failed),
      completedAt: nowIso(),
      durationSec: Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000),
      forkedFrom: run.forkedFrom,
    })
    return report
  },
  abandon: () => {
    const { scenario } = get()
    if (scenario) useProgressStore.getState().setInProgress(scenario.meta.id, undefined)
    set({
      scenario: undefined,
      state: undefined,
      history: [],
      run: undefined,
      clock: { running: false, speed: 1, baseTickMs: MODE_TICK_MS.standard },
      playedReelId: undefined,
      undoable: undefined,
      dialoguePaths: {},
    })
  },
  clearError: () => set({ lastError: undefined }),
}))
