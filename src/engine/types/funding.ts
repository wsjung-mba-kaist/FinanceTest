/** Reporting metadata only: amounts and processing remain owned by the existing bank effects. */
export interface FundingTime {
  turnId: string
  tick: number
}

export interface BankFundingPlan {
  /** Only explicitly authored windows may produce a time-bucketed estimate. */
  windows: {
    turnId: string
    /** Unconditional eachTick batch containing one runoffStep. */
    effectId: string
    assumption: string
    sourceRefs: string[]
  }[]
  pendingCapacity: {
    at: FundingTime
    /** Actual entry batch that calls settlePendingCapacity; this creates capacity, not cash. */
    effectId: string
    condition: string
    sourceRefs: string[]
  }
  checkpoints: {
    id: string
    title: string
    knownFrom: FundingTime
    at: FundingTime
    /** Last recorded balance before the checkpoint, excluding subsequent remedial funding. */
    balanceAt: FundingTime
    note: string
    sourceRefs: string[]
  }[]
}
