import type { Counters, Flags, RegulatorLevel, Severity } from './common'
import type { PendingEffect } from './effects'
import type { MetricDelta, MetricSnapshot, MetricUnit, TickSample } from './metrics'

export interface SecurityBook {
  marketValue: number
  bookValue: number
  modDuration: number
  convexity?: number
  hqlaLevel?: 'L1' | 'L2A' | 'L2B' | 'none'
  /** Fraction already pledged (encumbered) to FHLB / central bank / repo. */
  pledgedShare?: number
}

export type DepositCategory =
  | 'retailStable'
  | 'retailLessStable'
  | 'smeStable'
  | 'smeLessStable'
  | 'operational'
  | 'corporateInsured'
  | 'corporateUninsured'
  | 'financialInstitution'
  | 'other'

/** Depositor segment used by run-off dynamics (scenario-defined). */
export interface DepositSegment {
  id: string
  label: string
  balance: number
  insured: boolean
  /** Base daily outflow rates by run state S0..S3 (fractions). */
  runoffByState: [number, number, number, number]
  /** Optional daily cap (fraction), e.g. branch-queue limited retail. */
  dailyCap?: number
  /** Basel LCR outflow category for the regulatory lens. */
  lcrCategory: DepositCategory
  /** Whether this segment is network-coordinated (amplifier-sensitive). */
  networked?: boolean
  /**
   * Balance at the start of the current intraday run-off window. Set by `bankFx.runoffStep` on the
   * first tick of a multi-tick turn and removed on the last one, so per-tick slices are projected
   * against a stable base (Σ slices ≡ the single-call result).
   */
  windowBase?: number
}

export interface BankState {
  kind: 'bank'
  cash: number
  securities: { afs: SecurityBook; htm: SecurityBook }
  loans: {
    retail: number
    sme: number
    corporate: number
    fi: number
    nonPerforming: number
    avgDuration: number
  }
  otherAssets: number
  deposits: DepositSegment[]
  wholesale: {
    unsecuredShort: number
    unsecuredLong: number
    repoL1: number
    repoL2A: number
    repoOther: number
    /** Central-bank / FHLB advances outstanding. */
    cbAdvances: number
    /** Same-day secured capacity already established (pre-pledged collateral). */
    cbFacilityCapacity: number
    /** Capacity that becomes available next turn (collateral in transit). */
    cbFacilityPending: number
  }
  committed: { creditToCorporates: number; liquidityToFIs: number }
  otherLiabilities: number
  capital: { cet1: number; at1: number; tier2: number; aociInCet1: boolean }
  rwa: number
  leverageExposure: number
  irrbbBuckets?: { label: string; midDurationYears: number; assets: number; liabilities: number }[]
  /** Additional loss fraction applied on forced sales. */
  fireSaleDiscount: number
  /** Tax rate used to translate pre-tax security losses into capital impact. */
  taxRate: number
  /** Whether HTM has been "tainted" (reclassified to AFS). */
  htmTainted: boolean
  custom: Record<string, number>
}

export interface LdiPool {
  exposure: number
  equity: number
  modDuration: number
  collateral: { cash: number; eligibleGilts: number }
  marginCallOutstanding: number
  repoRateBp: number
}
export interface PensionState {
  kind: 'pension'
  liabilities: { pv: number; modDuration: number; discountRateBp: number }
  assets: {
    cash: number
    gilts: SecurityBook
    corporateBonds: SecurityBook
    equities: number
    illiquid: number
    ldi: LdiPool
  }
  hedgeRatio: number
  sponsor: { covenant: 'weak' | 'medium' | 'strong'; contributionCapacity: number }
  custom: Record<string, number>
}

/** 한국 증권사 (NCR 기반). */
export interface SecuritiesState {
  kind: 'securities'
  equityCapital: number
  /** 영업용순자본 = equityCapital - deductions + additions */
  deductions: number
  additions: number
  /** 총위험액 구성 */
  risk: { market: number; credit: number; operational: number }
  /** 필요유지자기자본 */
  requiredCapital: number
  liquidity: {
    cash: number
    creditLines: number
    creditLinesDrawn: number
    sellableSecurities: number
    /** 외화 유동자산 (ELS 헤지용) */
    fxLiquid: number
  }
  pf: {
    /** 매입확약/보증 잔액 */
    abcpGuaranteed: number
    /** 턴별 차환 만기 도래액 (index 0 = 현재 턴) */
    abcpMaturing: number[]
    /** 현재 차환 성공률 (0..1) */
    rollRate: number
    bridgeLoans: number
    /** 자체 매입한 ABCP 잔액 */
    abcpHeld: number
  }
  funding: { cp: number; repo: number; call: number }
  hedge: { elsSelfHedged: number; marginCallPending: number }
  custom: Record<string, number>
}

export interface PbPosition {
  ticker: string
  notional: number
  dailyVolPct: number
  advNotional: number
  pctOfFloat?: number
}
export interface PbClient {
  id: string
  name: string
  positions: PbPosition[]
  marginPosted: number
  marginPct: number
  creditLimit: number
  otherPbCount?: number
}
export interface PrimeBrokerState {
  kind: 'prime_broker'
  firm: { capital: number; liquidityPool: number; realizedLoss: number }
  clients: PbClient[]
  marginPolicy: { staticMarginPct: number; dynamicMargin: boolean; concentrationAddOn: boolean }
  custom: Record<string, number>
}

export interface CentralBankState {
  kind: 'central_bank'
  reserves: { gross: number; usable: number; forwardCommitments: number }
  external: {
    shortTermDebt: number
    totalDebt: number
    monthlyImports: number
    broadMoneyUsd: number
    annualExportsUsd: number
  }
  fx: {
    spot: number
    regime: 'float' | 'managed' | 'peg'
    bandPct?: number
    interventionToday: number
  }
  policy: { rateBp: number }
  bankingSystem: {
    npls: number
    capitalShortfall: number
    liquiditySupport: number
    failedBanks: number
    distressedBanks: number
  }
  sovereign: { debtToGdpPct: number; spreadBp: number; rating: string }
  imf: {
    stage: 'none' | 'requested' | 'negotiating' | 'agreed' | 'disbursed'
    committed: number
    disbursed: number
  }
  custom: Record<string, number>
}

export interface AssetManagerState {
  kind: 'asset_manager'
  fund: { nav: number; shares: number; leverage: number }
  liquidity: { daily: number; weekly: number; monthly: number; illiquid: number }
  redemptions: { pendingPct: number; gated: boolean; swingPricingBp: number; cumulativePct: number }
  custom: Record<string, number>
}

export type InstitutionState =
  | BankState
  | PensionState
  | SecuritiesState
  | PrimeBrokerState
  | CentralBankState
  | AssetManagerState

export interface MarketState {
  policyRateBp: number
  govt2yBp: number
  govt10yBp: number
  govt30yBp: number
  creditSpreadIgBp: number
  creditSpreadHyBp: number
  /** Funding stress proxy (FRA-OIS, CP-OIS, CD-KTB…). */
  fundingStressBp: number
  equityIndex: number
  volIndex: number
  fxUsdLocal: number
  /** Own-institution stock price index (100 = start). */
  ownStock: number
  /** Own-institution CDS (bp) where relevant. */
  ownCdsBp: number
  custom: Record<string, number>
}

/** Confidence: `index` is the CI used by calibration rules; stakeholders are display-level. */
export interface ConfidenceState {
  index: number
  depositors: number
  counterparties: number
  regulators: number
  investors: number
  media: number
  board: number
}
export type ConfidenceTarget = keyof ConfidenceState

export interface DecisionRecord {
  turnIndex: number
  decisionId: string
  optionIds: string[]
  elapsedMs?: number
  timedOut?: boolean
  memo?: string
  hintsUsed?: number
  /** Per-decision deduction, including an explicit zero for unpenalised hints. */
  hintPenalty?: number
  reasoning?: { evidence: string; assumption: string; reconsiderWhen: string }
  /** Sub-turn tick at which the decision was committed. Omitted when 0 (the legacy shape). */
  tick?: number
  /** Set when the record answers an `Interrupt` rather than a turn decision. */
  interrupt?: true
  /**
   * Reply ids walked through the decision's dialogue, in order. Omitted when the decision has no
   * `steps` (the legacy shape), so records of every existing scenario are byte-identical.
   */
  path?: string[]
}

export type FeedKind = 'consequence' | 'delayed' | 'gameover' | 'system' | 'timeout'

/** Narrative axis shared by the consequence reel order and the log filter. */
export type FeedChannel =
  'result' | 'market' | 'depositors' | 'regulator' | 'board' | 'press' | 'internal'

export interface FeedItem {
  id: string
  turnIndex: number
  kind: FeedKind
  severity: 'info' | 'warning' | 'critical' | 'positive'
  title: string
  body: string
  /** Decision/option that caused it, for causality display. */
  cause?: { decisionId: string; optionId: string }
  /** Sub-turn tick. Omitted when 0 (the legacy shape). */
  tick?: number
  channel?: FeedChannel
}

/**
 * One beat of the consequence reel. The shape mirrors `src/components/play/reelSteps.ts` exactly so
 * the player-facing component can consume engine-built reels without changing.
 */
export type ReelStep =
  | { kind: 'metrics'; deltas: MetricDelta[]; delayMs: number }
  | {
      kind: 'consequence'
      items: { title: string; body: string; severity: Severity }[]
      delayMs: number
    }
  | {
      kind: 'market'
      items: { label: string; before: number; after: number; unit: MetricUnit }[]
      delayMs: number
    }
  | {
      kind: 'reaction'
      from: 'regulator' | 'board' | 'counterparty'
      text: string
      delayMs: number
    }

export interface ConsequenceReel {
  id: string
  cause: {
    kind: 'turn' | 'tick' | 'decision' | 'interrupt'
    decisionId?: string
    optionIds?: string[]
  }
  turnIndex: number
  tick: number
  steps: ReelStep[]
}

export interface EndedInfo {
  reason: string
  turnIndex: number
  title: string
  narrative: string
  failed: boolean
  /** 'orderly' failures receive partial credit. */
  orderly?: boolean
}

export interface GameState<S extends InstitutionState = InstitutionState> {
  scenarioId: string
  scenarioVersion: number
  seed: number
  /** PRNG state (mulberry32), advanced deterministically. */
  rng: number
  turnIndex: number
  /** Sub-turn tick (0 .. ticks-1). Turns without `ticks` have exactly one tick, 0. */
  tick: number
  /** 0 = canonical (no RNG is consumed by the engine), 0.5 / 1 = live play volatility. */
  variance: number
  phase: 'deciding' | 'ended'
  institution: S
  market: MarketState
  confidence: ConfidenceState
  regulator: { level: RegulatorLevel; notes: string[] }
  flags: Flags
  /** Turn index at which each flag was first set (for timeliness scoring). */
  flagTurns: Record<string, number>
  counters: Counters
  pending: PendingEffect[]
  decisions: DecisionRecord[]
  metricsHistory: MetricSnapshot[]
  /** Intra-turn metric samples (capped); one entry per (turnIndex, tick). */
  tickHistory: TickSample[]
  /** Resolved tick for each jitterable event / interrupt id of the current turn. */
  tickSchedule: Record<string, number>
  /** `market.*` values captured at the start of the current turn, for the ticker series. */
  tickerBase: Record<string, number>
  /** Ids of interrupts awaiting an answer. */
  openInterrupts: string[]
  feed: FeedItem[]
  log: string[]
  /** Reel built by the last state transition (start of turn / tick / decision). */
  lastReel?: ConsequenceReel
  ended?: EndedInfo
}
