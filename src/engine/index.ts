export * from './types'
export { createGame } from './core/createGame'
export { startTurn } from './core/startTurn'
export {
  applyDecision,
  DecisionError,
  isDecisionResolved,
  validateDialoguePath,
  validateSelection,
  type DecisionMeta,
} from './core/applyDecision'
export {
  availableReplies,
  commitReplies,
  entryStep,
  hasDialogue,
  reachableOptions,
  stepById,
  validateDialogue,
  walk,
  walkByPolicy,
  type CommitRepliesOptions,
  type DialogueIssue,
  type DialoguePreference,
  type DialogueWalk,
  type DialogueWalkPolicy,
  type DialogueWalkResult,
} from './core/dialogue'
export {
  advanceTurn,
  activeDecisions,
  unresolvedRequiredDecisions,
  isLastTurn,
} from './core/advanceTurn'
export {
  getTurnView,
  dialogueView,
  type TurnView,
  type DecisionView,
  type DialogueTurn,
  type DialogueView,
  type OptionView,
} from './core/view'
export {
  advanceTick,
  canAdvanceTick,
  fastForwardTicks,
  runTickPhase,
  sweepDeadlines,
  tickCount,
} from './core/tick'
export { buildReel, withReel, CHANNEL_ORDER, REEL_STEP_MS } from './core/reel'
export { gaussian, jitterTick, noiseFactor, scheduleTurn, DEFAULT_NOISE } from './core/noise'
export { previewOption, diffSnapshots, type PreviewResult } from './core/preview'
export { replay, type ReplayLog, type ReplayResult } from './core/replay'
export { computeScore, decisionRegrets, evalCurve, gradeFor } from './core/score'
export { autoplay, type Policy, type AutoplayResult, type AutoplayOptions } from './core/autoplay'
export { checkGameOver, applyGameOver, pickEnding } from './core/gameOver'
export { evaluate, buildConditionContext, describeCondition } from './core/conditions'
export { computeMetrics, latestSnapshot, snapshotMetrics, TICK_HISTORY_CAP } from './core/metrics'
export { getPath, getNumberPath, setNumberPath, listNumericPaths, clamp } from './core/paths'
export { rngNext, makeRng, seedToState } from './core/rng'
export {
  findDecision,
  findOption,
  findTurn,
  findTurnDecision,
  turnDecisions,
  isInterrupt,
  allDecisions,
} from './core/lookup'
export { applyEffects, makeEffectContext, setFlag } from './core/effects'
export { DEFAULT_SCORING_RULES, DEFAULT_WEIGHTS } from './scoring/defaults'
export {
  validateScenario,
  formatIssues,
  type IntegrityIssue,
  type IntegrityOptions,
} from './validate/scenarioIntegrity'
