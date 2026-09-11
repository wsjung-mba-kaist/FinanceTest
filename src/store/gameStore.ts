import { create } from 'zustand'
import {
  advanceTurn,
  applyDecision,
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

export const HINT_COSTS: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 8 }

export interface RunInfo {
  runId: string
  mode: Mode
  seed: number
  rewinds: number
  hintPenalty: number
  hintsRevealed: Record<string, number>
  startedAt: string
  forkedFrom?: { runId: string; turnIndex: number }
}

interface GameStore {
  scenario?: ScenarioDefinition
  state?: GameState
  /** State at the start of each turn (index = turn index). */
  history: GameState[]
  run?: RunInfo
  /** Turn index whose rationale panel is being shown (UI phase helper). */
  lastError?: string
  start: (scenario: ScenarioDefinition, mode: Mode, seed?: number) => void
  restore: (scenario: ScenarioDefinition, saved: InProgressSave) => boolean
  choose: (decisionId: string, optionIds: string[], meta?: DecisionMeta) => boolean
  next: () => boolean
  rewindTo: (turnIndex: number) => void
  forkFrom: (turnIndex: number) => void
  revealHint: (decisionId: string, level: 1 | 2 | 3) => void
  finish: () => ScoreReport | undefined
  abandon: () => void
  clearError: () => void
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
  start: (scenario, mode, seed = 1) => {
    const state = createGame(scenario, seed)
    set({
      scenario,
      state,
      history: [state],
      run: {
        runId: newRunId(),
        mode,
        seed,
        rewinds: 0,
        hintPenalty: 0,
        hintsRevealed: {},
        startedAt: nowIso(),
      },
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
      })
      set({
        scenario,
        state,
        history,
        run: {
          runId: saved.runId,
          mode: saved.mode,
          seed: saved.seed,
          rewinds: saved.rewinds,
          hintPenalty: saved.hintPenalty,
          hintsRevealed: saved.hintsRevealed,
          startedAt: saved.startedAt,
          forkedFrom: saved.forkedFrom,
        },
        lastError: undefined,
      })
      return true
    } catch {
      return false
    }
  },
  choose: (decisionId, optionIds, meta = {}) => {
    const { scenario, state, run } = get()
    if (!scenario || !state || !run) return false
    try {
      const pending = run.hintsRevealed[decisionId] ?? 0
      const penalty = run.mode === 'standard' ? ([0, 2, 6, 14][pending] ?? 0) : 0
      const next = applyDecision(state, scenario, decisionId, optionIds, {
        ...meta,
        hintsUsed: pending || undefined,
        hintPenalty: penalty || undefined,
      })
      set({ state: next, lastError: undefined })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  next: () => {
    const { scenario, state, history } = get()
    if (!scenario || !state) return false
    try {
      const next = advanceTurn(state, scenario)
      const h =
        next.turnIndex > state.turnIndex ? [...history.slice(0, next.turnIndex), next] : history
      set({ state: next, history: h, lastError: undefined })
      persistInProgress(get())
      return true
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) })
      return false
    }
  },
  rewindTo: (turnIndex) => {
    const { history, run } = get()
    const target = history[turnIndex]
    if (!target || !run) return
    set({
      state: target,
      history: history.slice(0, turnIndex + 1),
      run: { ...run, rewinds: run.rewinds + 1 },
    })
    persistInProgress(get())
  },
  forkFrom: (turnIndex) => {
    const { history, run, scenario } = get()
    const target = history[turnIndex]
    if (!target || !run || !scenario) return
    set({
      state: target,
      history: history.slice(0, turnIndex + 1),
      run: {
        runId: newRunId(),
        mode: run.mode,
        seed: run.seed,
        rewinds: 0,
        hintPenalty: 0,
        hintsRevealed: {},
        startedAt: nowIso(),
        forkedFrom: { runId: run.runId, turnIndex },
      },
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
    set({ scenario: undefined, state: undefined, history: [], run: undefined })
  },
  clearError: () => set({ lastError: undefined }),
}))
