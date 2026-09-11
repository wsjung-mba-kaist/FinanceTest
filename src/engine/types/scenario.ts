import type {
  Competency,
  Counters,
  Difficulty,
  Flags,
  InstitutionType,
  Region,
  RegulatorLevel,
  Role,
  ScoreDimension,
  Severity,
  Source,
  TurnUnit,
  Units,
} from './common'
import type { Condition } from './conditions'
import type { ConditionalEffects, DelayedEffectSpec, Effect } from './effects'
import type { KpiSpec, ThresholdMap } from './metrics'
import type { ScoringSpec } from './scoring'
import type { ConfidenceState, InstitutionState, MarketState } from './state'

export interface LearningObjective {
  id: string
  text: string
  competency: Competency
  decisionIds: string[]
}

export interface ScenarioMeta {
  id: string
  /** Bumping invalidates in-progress saves. */
  version: number
  title: string
  subtitle?: string
  /** e.g. '2023-03' */
  era: string
  year: number
  region: Region
  role: Role
  /** Display title of the role, e.g. '자금담당임원(Treasurer)'. */
  roleTitle: string
  institutionType: InstitutionType
  /** Composite institution name used in play, e.g. '퍼시픽밸리은행'. */
  institutionName: string
  /** Real institution(s) the composite is modelled on (shown in debrief). */
  modelledOn: string
  difficulty: Difficulty
  durationTurns: number
  turnUnit: TurnUnit
  estMinutes: number
  timezone: string
  learningObjectives: LearningObjective[]
  competencies: Partial<Record<Competency, number>>
  tags: string[]
  sources: Source[]
}

export interface DialogueLine {
  speaker: string
  text: string
}

export type Reliability = 'confirmed' | 'unconfirmed' | 'false'

interface EventBase<S extends InstitutionState> {
  id: string
  when?: Condition
  effects?: Effect<S>[]
  cardRefs?: string[]
  sourceRefs?: string[]
  severity?: Severity
  /** Expert mode: unconfirmed/false items may later be corrected. */
  reliability?: Reliability
  /** Id of the earlier item this corrects. */
  correctionOf?: string
  /** Only shown in expert mode (noise). */
  expertOnly?: boolean
  relatedMetrics?: string[]
  /** Time label shown in the feed, e.g. '09:12'. */
  time?: string
}

export type GameEvent<S extends InstitutionState = InstitutionState> = EventBase<S> &
  (
    | { kind: 'newswire'; outlet: string; headline: string; body: string }
    | {
        kind: 'market'
        headline: string
        items: { label: string; value: string; change?: string }[]
      }
    | { kind: 'memo'; from: string; to: string; subject: string; body: string }
    | {
        kind: 'call'
        caller: string
        callee: string
        agency?: string
        tone?: 'routine' | 'concerned' | 'urgent'
        lines: DialogueLine[]
      }
    | { kind: 'board'; headline: string; body: string }
    | {
        kind: 'regulator'
        agency: string
        headline: string
        body: string
        tone?: 'routine' | 'concerned' | 'urgent'
      }
    | { kind: 'data'; title: string; rows: { label: string; value: string }[] }
    | { kind: 'rumor'; source: string; headline: string; body: string }
    | { kind: 'dialogue'; title: string; lines: DialogueLine[] }
  )

export type WireKind = GameEvent['kind']

export interface PreviewHint {
  metric: string
  direction: 'up' | 'down' | 'flat'
  magnitude: 1 | 2 | 3
  note?: string
}

export interface Option<S extends InstitutionState = InstitutionState> {
  id: string
  /** Verb-first, ≤ 12 words. */
  label: string
  description: string
  /** Hidden entirely when false. */
  when?: Condition
  /** Shown but disabled (with `unavailableReason`) when false. */
  requires?: Condition
  unavailableReason?: string
  effects: Effect<S>[]
  delayedEffects?: DelayedEffectSpec<S>[]
  setFlags?: Flags
  expert: {
    rating: number
    rationale: string
    historicalNote?: string
    sourceRefs?: string[]
  }
  /** Narrative shown after commit ("[결과]"). */
  consequences: string
  historical?: boolean
  trap?: boolean
  trapExplanation?: string
  irreversible?: boolean
  illegal?: boolean
  feasibility?: { basis: string; sourceRefs?: string[] }
  calibrationNote?: string
  scoreAdjust?: Partial<Record<ScoreDimension, number>>
  /** Knowledge card to surface after choosing this (mistake remediation). */
  remediationCard?: string
  /** Authored directional preview (used when numeric preview is off). */
  preview?: PreviewHint[]
}

export interface Decision<S extends InstitutionState = InstitutionState> {
  id: string
  title: string
  prompt: string
  context?: string
  when?: Condition
  /** Default true. */
  required?: boolean
  /** Default { min: 1, max: 1 }. */
  select?: { min: number; max: number }
  /** Groups of mutually exclusive option ids (multi-select). */
  exclusive?: string[][]
  timeLimitSec?: number
  /** Applied on timeout (pressure modes). */
  defaultOptionId?: string
  options: Option<S>[]
  cardRefs?: string[]
  /** Concepts a learner should know before deciding (card ids). */
  requiredConcepts?: string[]
  /** Which score dimensions this decision's expert rating feeds. */
  dimensions?: ScoreDimension[]
}

export interface AdvisorHint {
  when?: Condition
  /** Level 1: what to look at; 2: framework; 3: recommendation. */
  level: 1 | 2 | 3
  text: string
  cardRefs?: string[]
  decisionId?: string
}

export interface Turn<S extends InstitutionState = InstitutionState> {
  id: string
  /** Short label, e.g. 'T3'. */
  label: string
  /** Human time label, e.g. '2023년 3월 9일 (목) 07:00 PT'. */
  timeLabel: string
  /** Optional title, e.g. '개장'. */
  title?: string
  /** ISO timestamp for hindsight lint. */
  time?: string
  entryEffects?: ConditionalEffects<S>[]
  events: GameEvent<S>[]
  decisions: Decision<S>[]
  advisorHints?: AdvisorHint[]
  relatedCards?: string[]
}

export interface GameOverRule {
  id: string
  when: Condition
  reason: string
  title: string
  narrative: string
  failed: boolean
  orderly?: boolean
  /** Rule shown to the player ("발동 규칙"). */
  ruleText: string
}

export interface Ending {
  id: string
  when?: Condition
  title: string
  narrative: string
}

export interface PathSpec {
  /** decisionId → optionId(s) */
  choices: Record<string, string | string[]>
  note?: string
  /** Set when the expert path is not expected to outscore the historical path. */
  expertMayNotBeatHistorical?: boolean
}

export interface Checkpoint {
  /** Turn id at which to check (after decisions of that turn are applied). */
  turnId: string
  metric?: string
  counter?: string
  path?: string
  expected: number
  /** Relative tolerance, e.g. 0.15. */
  tolerance: number
  label: string
}

export interface Lesson {
  id: string
  title: string
  body: string
  sourceRefs: string[]
  cardRefs?: string[]
  when?: Condition
}

export type QuizQuestion = {
  id: string
  prompt: string
  explanation: string
  sourceRefs: string[]
  cardRefs?: string[]
} & (
  | { type: 'single' | 'multi'; choices: { id: string; text: string }[]; answer: string[] }
  | { type: 'numeric'; answer: number; tolerance: number; unit: string }
  | { type: 'true_false'; answer: boolean }
)

export interface DebriefSpec {
  historical: {
    summary: string
    timeline: { turnId: string; note: string; sourceRefs: string[] }[]
    outcome: string
  }
  expert: { summary: string; rationale: string; caveats: string[] }
  lessons: Lesson[]
  quiz: QuizQuestion[]
}

export interface Stakeholder {
  name: string
  wants: string
  canDo: string
}

export interface Briefing {
  situation: string
  mandate: string
  institutionProfile: string
  marketBackdrop: string
  stakeholders: Stakeholder[]
  regulatoryFramework: string
  cardRefs: string[]
  simplificationNotes: string[]
  disclaimer?: string
}

export interface ScenarioDefinition<S extends InstitutionState = InstitutionState> {
  meta: ScenarioMeta
  units: Units
  initialState: {
    institution: S
    market: MarketState
    confidence: ConfidenceState
    regulatorLevel?: RegulatorLevel
    flags?: Flags
    counters?: Counters
  }
  briefing: Briefing
  kpis: KpiSpec[]
  thresholds?: ThresholdMap
  turns: Turn<S>[]
  gameOver: GameOverRule[]
  endings: Ending[]
  scoring: ScoringSpec
  paths: { historical: PathSpec; expert?: PathSpec }
  checkpoints?: Checkpoint[]
  debrief: DebriefSpec
}

/** Lightweight catalog entry (eagerly loaded). */
export interface ScenarioSummary {
  id: string
  version: number
  title: string
  subtitle?: string
  era: string
  year: number
  region: Region
  role: Role
  roleTitle: string
  institutionType: InstitutionType
  institutionName: string
  difficulty: Difficulty
  durationTurns: number
  turnUnit: TurnUnit
  estMinutes: number
  competencies: Partial<Record<Competency, number>>
  tags: string[]
  /** M-status for catalog: 'available' | 'planned'. */
  status: 'available' | 'planned'
}
