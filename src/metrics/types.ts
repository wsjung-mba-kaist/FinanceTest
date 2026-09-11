/**
 * Input/output contracts for the reusable regulatory & risk calculators.
 * Every calculator is a pure function `compute*(input, params?) => result` and must expose
 * intermediate values so the UI can "show working". Formula sources are cited in each module.
 */

// ---------------------------------------------------------------- LCR (BCBS 238 / LCR30-40)
export type LcrOutflowCategory =
  | 'retailStable'
  | 'retailLessStable'
  | 'smeStable'
  | 'smeLessStable'
  | 'operational'
  | 'operationalInsured'
  | 'corporateInsured'
  | 'corporateUninsured'
  | 'financialInstitution'
  | 'other'
  | 'securedL1'
  | 'securedL2A'
  | 'securedL2BRmbs'
  | 'securedL2BOther'
  | 'securedOther'
  | 'committedCredit'
  | 'committedLiquidity'

export type LcrInflowCategory =
  'retail' | 'corporate' | 'financialInstitution' | 'securedL1' | 'other'

export interface LcrInput {
  /** Pre-haircut market values by HQLA level. */
  hqla: { l1: number; l2a: number; l2b: number }
  /** Balances (not outflows) by category; run-off rates are applied by the calculator. */
  outflows: Partial<Record<LcrOutflowCategory, number>>
  /** Contractual inflows within 30 days by category; inflow rates applied by the calculator. */
  inflows: Partial<Record<LcrInflowCategory, number>>
}

export interface LcrParams {
  haircuts: { l2a: number; l2b: number }
  /** Level 2 ≤ 40% of HQLA, Level 2B ≤ 15% (after haircuts, BCBS 238 Annex 1). */
  capL2: number
  capL2b: number
  runoff: Record<LcrOutflowCategory, number>
  inflowRates: Record<LcrInflowCategory, number>
  /** Inflows capped at 75% of outflows. */
  inflowCap: number
}

export interface LcrResult {
  l1: number
  l2aAdjusted: number
  l2bAdjusted: number
  /** Amount removed by the 40%/15% caps. */
  capAdjustment: number
  hqla: number
  totalOutflows: number
  totalInflows: number
  inflowsCapped: number
  netOutflows: number
  /** Percent, e.g. 112.4. NaN if netOutflows is 0. */
  lcr: number
}

// ---------------------------------------------------------------- NSFR (BCBS d295)
export interface NsfrInput {
  asf: {
    capital: number
    retailStable: number
    retailLessStable: number
    corporateUnder1y: number
    otherUnder6m: number
    over1y: number
  }
  rsf: {
    cash: number
    l1: number
    l2a: number
    l2b: number
    loansFiUnder6m: number
    otherUnder1y: number
    mortgagesOver1y: number
    otherLoans: number
    otherAssets: number
    offBalance: number
  }
}
export interface NsfrParams {
  asf: Record<keyof NsfrInput['asf'], number>
  rsf: Record<keyof NsfrInput['rsf'], number>
}
export interface NsfrResult {
  asf: number
  rsf: number
  /** Percent. */
  nsfr: number
}

// ---------------------------------------------------------------- Capital (BCBS 189 / RBC20)
export interface CapitalInput {
  cet1: number
  at1: number
  tier2: number
  rwa: number
  leverageExposure: number
  /** If false, unrealized AFS losses are added back (AOCI opt-out) → provide unrealizedAfsLoss to see the adjusted ratio. */
  aociInCet1: boolean
  /** Positive number = loss. */
  unrealizedAfsLoss?: number
  /** Positive number = loss (economic view only). */
  unrealizedHtmLoss?: number
}
export interface CapitalResult {
  cet1Ratio: number
  tier1Ratio: number
  totalRatio: number
  leverageRatio: number
  /** CET1 ratio if AFS unrealized loss were recognised. */
  cet1RatioAfsAdjusted: number
  /** Tangible-equity view: CET1 less both AFS and HTM unrealized losses, over leverage exposure. */
  economicTceRatio: number
}

// ---------------------------------------------------------------- Bond P&L (duration/convexity)
export interface BondPnlInput {
  marketValue: number
  modDuration: number
  deltaYieldBp: number
  convexity?: number
}
export interface BondPnlResult {
  pnl: number
  pctChange: number
}

// ---------------------------------------------------------------- IRRBB (BCBS d368 / SRP31)
export interface IrrbbBucket {
  label: string
  midDurationYears: number
  assets: number
  liabilities: number
}
export interface IrrbbInput {
  buckets: IrrbbBucket[]
  tier1: number
  /** Shocks in bp; default ±200 parallel. */
  shocksBp?: number[]
}
export interface IrrbbResult {
  deltaEve: Record<string, number>
  worstDeltaEve: number
  worstPctTier1: number
  /** True when worst loss > 15% of Tier 1 (outlier test). */
  outlier: boolean
}

// ---------------------------------------------------------------- LDI margin (BoE FSR 2022-12, TPR 2023)
export interface LdiMarginInput {
  exposure: number
  equity: number
  modDuration: number
  collateral: number
  deltaYieldBp: number
}
export interface LdiMarginResult {
  leverage: number
  /** Value change per 1bp of yield (positive number). */
  pv01: number
  /** Yield rise (bp) the collateral can absorb. */
  bufferBp: number
  loss: number
  marginCall: number
  shortfall: number
  postMoveLeverage: number
  recapNeeded: number
}

// ---------------------------------------------------------------- Prime-broker exposure (Archegos mechanics)
export interface PbPositionInput {
  ticker: string
  notional: number
  /** Daily volatility as a fraction, e.g. 0.03. */
  dailyVolPct: number
  advNotional: number
}
export interface PbExposureInput {
  positions: PbPositionInput[]
  marginPosted: number
  /** Participation rate of ADV used to liquidate, default 0.2. */
  participation?: number
  /** z-score, default 2.33 (99%). */
  z?: number
}
export interface PbExposureResult {
  grossNotional: number
  daysToLiquidate: number
  liquidationVaR: number
  shortfall: number
  /** margin / VaR, percent. */
  marginCoverage: number
  concentrationFlag: boolean
  perPosition: { ticker: string; daysToLiquidate: number; var: number }[]
}

// ---------------------------------------------------------------- NCR (금융투자업규정 §3-6~3-10, §3-26)
export interface NcrInput {
  equityCapital: number
  deductions: number
  additions: number
  risk: { market: number; credit: number; operational: number }
  requiredCapital: number
}
export interface NcrResult {
  /** 영업용순자본 */
  netOperatingCapital: number
  /** 총위험액 */
  totalRisk: number
  /** 신NCR = (영업용순자본 − 총위험액) / 필요유지자기자본 × 100 */
  ncr: number
  /** 구NCR = 영업용순자본 / 총위험액 × 100 */
  ncrOld: number
  /** 적기시정조치 단계: none | recommend (<100) | require (<50) | order (<0) */
  actionLevel: 'none' | 'recommend' | 'require' | 'order'
}

// ---------------------------------------------------------------- FX reserve adequacy (IMF ARA, Greenspan-Guidotti)
export interface FxAdequacyInput {
  usableReserves: number
  shortTermDebt: number
  monthlyImports: number
  broadMoneyUsd: number
  annualExportsUsd: number
  otherLiabilities?: number
  regime: 'float' | 'managed' | 'peg'
}
export interface FxAdequacyResult {
  /** usable reserves / short-term debt, percent. */
  guidottiRatio: number
  importCoverMonths: number
  reservesToM2: number
  imfAra: number
  /** reserves / ARA, percent (adequate band 100–150). */
  imfAraPct: number
}
