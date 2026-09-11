import { z } from 'zod'

export const STORAGE_VERSION = 1

/** Default real seconds per simulated tick at ×1 (설정에서 4~30초로 조정). */
export const DEFAULT_CLOCK_TICK_SEC = 8

export const decisionRecordSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  decisionId: z.string(),
  optionIds: z.array(z.string()),
  elapsedMs: z.number().optional(),
  timedOut: z.boolean().optional(),
  memo: z.string().optional(),
  hintsUsed: z.number().optional(),
  /** Sub-turn tick the record was committed at (omitted when 0 — the legacy shape). */
  tick: z.number().int().nonnegative().optional(),
  /** Set when the record answers an `Interrupt`. */
  interrupt: z.literal(true).optional(),
})

export const inProgressSchema = z.object({
  runId: z.string(),
  seed: z.number(),
  mode: z.enum(['guided', 'standard', 'expert']),
  scenarioVersion: z.number(),
  decisions: z.array(decisionRecordSchema),
  turnIndex: z.number().int().nonnegative(),
  /** Sub-turn tick the run had reached inside `turnIndex` (absent ⇒ the turn's last tick). */
  tick: z.number().int().nonnegative().optional(),
  /** Volatility the run is being played at (absent ⇒ 0, the canonical stream). */
  variance: z.number().min(0).max(1).optional(),
  rewinds: z.number().int().nonnegative(),
  hintPenalty: z.number().nonnegative(),
  hintsRevealed: z.record(z.string(), z.number()),
  startedAt: z.string(),
  updatedAt: z.string(),
  forkedFrom: z.object({ runId: z.string(), turnIndex: z.number() }).optional(),
})
export type InProgressSave = z.infer<typeof inProgressSchema>

export const attemptSchema = z.object({
  runId: z.string(),
  seed: z.number(),
  mode: z.enum(['guided', 'standard', 'expert']),
  scenarioVersion: z.number(),
  decisions: z.array(decisionRecordSchema),
  /** Volatility the attempt was played at (absent ⇒ 0). */
  variance: z.number().min(0).max(1).optional(),
  rewinds: z.number(),
  hintPenalty: z.number(),
  total: z.number(),
  grade: z.string(),
  dimensions: z.record(z.string(), z.number()),
  endedReason: z.string(),
  failed: z.boolean(),
  completedAt: z.string(),
  durationSec: z.number(),
  forkedFrom: z.object({ runId: z.string(), turnIndex: z.number() }).optional(),
})
export type AttemptSave = z.infer<typeof attemptSchema>

export const quizResultSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  correct: z.number(),
  total: z.number(),
  completedAt: z.string(),
})

export const scenarioProgressSchema = z.object({
  best: z
    .object({
      total: z.number(),
      grade: z.string(),
      mode: z.enum(['guided', 'standard', 'expert']),
      dimensions: z.record(z.string(), z.number()),
      completedAt: z.string(),
      scenarioVersion: z.number(),
    })
    .optional(),
  attempts: z.array(attemptSchema),
  inProgress: inProgressSchema.optional(),
  quiz: quizResultSchema.optional(),
  briefingSectionsViewed: z.array(z.string()).optional(),
})
export type ScenarioProgress = z.infer<typeof scenarioProgressSchema>

export const progressStateSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  scenarios: z.record(z.string(), scenarioProgressSchema),
  learning: z.object({
    cardsViewed: z.array(z.string()),
    termsViewed: z.array(z.string()),
  }),
  meta: z.object({ createdAt: z.string(), lastOpenedAt: z.string() }),
})
export type ProgressState = z.infer<typeof progressStateSchema>

export const settingsSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  theme: z.enum(['system', 'light', 'dark']),
  termDisplay: z.enum(['ko-en', 'en-ko']),
  fontScale: z.number().min(0.85).max(1.3),
  reducedMotion: z.boolean(),
  rationaleReveal: z.enum(['mode', 'immediate', 'endOfTurn', 'endOfScenario']),
  timersEnabled: z.boolean(),
  useSystemFont: z.boolean(),
  defaultMode: z.enum(['guided', 'standard', 'expert']),
  /**
   * Real seconds one simulated tick lasts at ×1. Absent ⇒ the mode default
   * (안내 30초 · 표준 20초 · 전문가 12초).
   */
  clockTickSec: z.number().min(4).max(30).optional(),
  /** Live-play volatility: 0 = 완전히 동일, 0.5 = 약간, 1 = 기본. */
  variance: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).optional(),
  /** ISO timestamp set when the home screen intro is dismissed (`처음 안내 숨기기`). */
  onboardingSeenAt: z.string().optional(),
  /** Last role family picked on the home screen; pre-filters the catalog. */
  roleFamily: z.enum(['bank', 'securities', 'pension', 'fund', 'policy']).optional(),
})
export type SettingsState = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: SettingsState = {
  version: STORAGE_VERSION,
  theme: 'system',
  termDisplay: 'ko-en',
  fontScale: 1,
  reducedMotion: false,
  rationaleReveal: 'mode',
  timersEnabled: true,
  useSystemFont: false,
  defaultMode: 'standard',
  clockTickSec: DEFAULT_CLOCK_TICK_SEC,
  variance: 1,
}

export function emptyProgress(now: string): ProgressState {
  return {
    version: STORAGE_VERSION,
    scenarios: {},
    learning: { cardsViewed: [], termsViewed: [] },
    meta: { createdAt: now, lastOpenedAt: now },
  }
}
