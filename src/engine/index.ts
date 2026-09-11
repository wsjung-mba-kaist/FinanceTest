export * from './types'
export { createGame } from './core/createGame'
export { startTurn } from './core/startTurn'
export {
  applyDecision,
  DecisionError,
  isDecisionResolved,
  validateSelection,
  type DecisionMeta,
} from './core/applyDecision'
export {
  advanceTurn,
  activeDecisions,
  unresolvedRequiredDecisions,
  isLastTurn,
} from './core/advanceTurn'
export { getTurnView, type TurnView, type DecisionView, type OptionView } from './core/view'
export { previewOption, diffSnapshots, type PreviewResult } from './core/preview'
export { replay, type ReplayLog, type ReplayResult } from './core/replay'
export { computeScore, decisionRegrets, evalCurve, gradeFor } from './core/score'
export { autoplay, type Policy, type AutoplayResult } from './core/autoplay'
export { checkGameOver, applyGameOver, pickEnding } from './core/gameOver'
export { evaluate, buildConditionContext, describeCondition } from './core/conditions'
export { computeMetrics, latestSnapshot, snapshotMetrics } from './core/metrics'
export { getPath, getNumberPath, setNumberPath, listNumericPaths, clamp } from './core/paths'
export { rngNext, makeRng, seedToState } from './core/rng'
export { findDecision, findOption, findTurn, allDecisions } from './core/lookup'
export { applyEffects, makeEffectContext, setFlag } from './core/effects'
export { DEFAULT_SCORING_RULES, DEFAULT_WEIGHTS } from './scoring/defaults'
export {
  validateScenario,
  formatIssues,
  type IntegrityIssue,
  type IntegrityOptions,
} from './validate/scenarioIntegrity'
