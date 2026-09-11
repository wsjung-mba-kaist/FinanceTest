import { create } from 'zustand'
import {
  emptyProgress,
  progressStateSchema,
  type AttemptSave,
  type InProgressSave,
  type ProgressState,
  type ScenarioProgress,
} from '../persistence/schema'
import { KEYS, loadValidated, save, type SaveResult } from '../persistence/storage'

const MAX_ATTEMPTS = 10

interface ProgressStore extends ProgressState {
  corruptOnLoad: boolean
  lastSaveResult: SaveResult
  getScenario: (id: string) => ScenarioProgress
  setInProgress: (scenarioId: string, run: InProgressSave | undefined) => void
  recordAttempt: (scenarioId: string, attempt: AttemptSave) => void
  recordQuiz: (scenarioId: string, result: ScenarioProgress['quiz']) => void
  markBriefingSection: (scenarioId: string, sectionId: string) => void
  markCardViewed: (cardId: string) => void
  markTermViewed: (termId: string) => void
  clearScenario: (scenarioId: string) => void
  importState: (state: ProgressState) => void
  resetAll: () => void
  export: () => ProgressState
}

const now = () => new Date().toISOString()
const loaded = loadValidated(KEYS.progress, progressStateSchema)
const initial: ProgressState = loaded.value ?? emptyProgress(now())
initial.meta.lastOpenedAt = now()

function emptyScenario(): ScenarioProgress {
  return { attempts: [] }
}

export const useProgressStore = create<ProgressStore>((set, get) => {
  const persist = () => {
    const s = get()
    const state: ProgressState = {
      version: s.version,
      scenarios: s.scenarios,
      learning: s.learning,
      meta: s.meta,
    }
    const r = save(KEYS.progress, state)
    if (r !== get().lastSaveResult) set({ lastSaveResult: r })
  }
  const updateScenario = (id: string, fn: (p: ScenarioProgress) => ScenarioProgress) => {
    set((s) => ({ scenarios: { ...s.scenarios, [id]: fn(s.scenarios[id] ?? emptyScenario()) } }))
    persist()
  }
  return {
    ...initial,
    corruptOnLoad: loaded.corrupt,
    lastSaveResult: 'ok',
    getScenario: (id) => get().scenarios[id] ?? emptyScenario(),
    setInProgress: (id, run) => updateScenario(id, (p) => ({ ...p, inProgress: run })),
    recordAttempt: (id, attempt) =>
      updateScenario(id, (p) => {
        const attempts = [attempt, ...p.attempts].slice(0, MAX_ATTEMPTS)
        const eligible = attempt.rewinds === 0 && !attempt.forkedFrom
        const best =
          eligible && (!p.best || attempt.total > p.best.total)
            ? {
                total: attempt.total,
                grade: attempt.grade,
                mode: attempt.mode,
                dimensions: attempt.dimensions,
                completedAt: attempt.completedAt,
                scenarioVersion: attempt.scenarioVersion,
              }
            : p.best
        return { ...p, attempts, best, inProgress: undefined }
      }),
    recordQuiz: (id, result) => updateScenario(id, (p) => ({ ...p, quiz: result })),
    markBriefingSection: (id, sectionId) =>
      updateScenario(id, (p) => {
        const list = p.briefingSectionsViewed ?? []
        return list.includes(sectionId) ? p : { ...p, briefingSectionsViewed: [...list, sectionId] }
      }),
    markCardViewed: (cardId) => {
      if (get().learning.cardsViewed.includes(cardId)) return
      set((s) => ({
        learning: { ...s.learning, cardsViewed: [...s.learning.cardsViewed, cardId] },
      }))
      persist()
    },
    markTermViewed: (termId) => {
      if (get().learning.termsViewed.includes(termId)) return
      set((s) => ({
        learning: { ...s.learning, termsViewed: [...s.learning.termsViewed, termId] },
      }))
      persist()
    },
    clearScenario: (id) => {
      set((s) => {
        const next = { ...s.scenarios }
        delete next[id]
        return { scenarios: next }
      })
      persist()
    },
    importState: (state) => {
      set({
        version: state.version,
        scenarios: state.scenarios,
        learning: state.learning,
        meta: state.meta,
      })
      persist()
    },
    resetAll: () => {
      const e = emptyProgress(now())
      set({ ...e })
      persist()
    },
    export: () => {
      const s = get()
      return { version: s.version, scenarios: s.scenarios, learning: s.learning, meta: s.meta }
    },
  }
})
