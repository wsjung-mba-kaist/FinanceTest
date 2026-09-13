import type { BankFundingPlan, FundingTime, GameState, ScenarioDefinition } from '../engine'
import { tickCount } from '../engine/core/lookup'
import { projectRunoff, runStateFromCi } from '../metrics/runoff'

export interface FundingBucket {
  tick: number
  time: string
  estimatedPayment: number
  estimatedCash: number
  shortfall: number
}

export function fundingTimeLabel(scenario: ScenarioDefinition, at: FundingTime): string {
  const turn = scenario.turns.find((t) => t.id === at.turnId)
  if (!turn) return '시점 미확인'
  // timeLabel carries the date and PT; replace only its clock for intraday points.
  const clock = turn.tickLabels?.[at.tick]
  return clock ? turn.timeLabel.replace(/\d{2}:\d{2}/, clock) : turn.timeLabel
}

function reached(state: GameState, scenario: ScenarioDefinition, at: FundingTime): boolean {
  const index = scenario.turns.findIndex((t) => t.id === at.turnId)
  return (
    index >= 0 && (state.turnIndex > index || (state.turnIndex === index && state.tick >= at.tick))
  )
}

export interface FundingScheduleView {
  cash: number
  undrawn: number
  pending: number
  pendingAt: string
  pendingCondition: string
  projection?: {
    rows: FundingBucket[]
    assumption: string
    sourceRefs: string[]
    remainingPayments: number
    closingCash: number
    firstShortfall?: string
  }
  checkpoints: {
    spec: BankFundingPlan['checkpoints'][number]
    time: string
    reached: boolean
    recordedCash?: number
  }[]
}

/**
 * A frozen-current-conditions estimate, not autoplay. Reads only the current window and state:
 * no RNG draws, future events, pending effects, hypothetical funding, or scoring inputs are run.
 * Tick 0 has already settled when the UI sees the state, so estimate only ticks > state.tick.
 */
export function buildFundingSchedule(
  state: GameState,
  scenario: ScenarioDefinition,
): FundingScheduleView | undefined {
  const plan = scenario.fundingPlan
  const bank = state.institution
  const turn = scenario.turns[state.turnIndex]
  if (!plan || bank.kind !== 'bank' || !turn) return undefined
  const window = plan.windows.find((w) => w.turnId === turn.id)
  const batch = turn.eachTick?.find((e) => e.id === window?.effectId)
  const effect = batch?.effects.find((e) => e.kind === 'fn' && e.name === 'runoffStep')
  let projection: FundingScheduleView['projection']
  if (window && batch && !batch.when && effect?.kind === 'fn') {
    const ticks = tickCount(turn)
    const profile =
      typeof effect.params?.profile === 'string'
        ? effect.params.profile.split('/').map(Number)
        : Array.from({ length: ticks }, () => 1 / ticks)
    const fraction =
      typeof effect.params?.windowFraction === 'number' ? effect.params.windowFraction : 1
    // Fail closed if authoring drifts; never display NaN or an invented zero forecast.
    if (
      profile.length === ticks &&
      profile.every((p) => Number.isFinite(p) && p >= 0) &&
      Math.abs(profile.reduce((a, b) => a + b, 0) - 1) < 1e-6 &&
      Number.isFinite(fraction) &&
      fraction >= 0
    ) {
      let cash = bank.cash
      const rows: FundingBucket[] = []
      for (let tick = state.tick + 1; tick < ticks; tick++) {
        const estimatedPayment = projectRunoff({
          segments: bank.deposits.map((s) => ({ ...s, balance: s.windowBase ?? s.balance })),
          runState: runStateFromCi(state.confidence.index),
          amplifier: state.counters.amplifier || 1,
          dampener: Math.max(0.3, state.counters.dampener || 1),
          networkAmplifier: state.counters.networkAmplifier || 1,
          windowFraction: fraction * profile[tick]!,
        }).total
        cash -= estimatedPayment
        rows.push({
          tick,
          time: turn.tickLabels?.[tick] ?? `${tick + 1}번째 시점`,
          estimatedPayment,
          estimatedCash: cash,
          shortfall: Math.max(0, -cash),
        })
      }
      projection = {
        rows,
        assumption: window.assumption,
        sourceRefs: window.sourceRefs,
        remainingPayments: rows.reduce((sum, r) => sum + r.estimatedPayment, 0),
        closingCash: cash,
        firstShortfall: bank.cash < 0 ? '현재' : rows.find((r) => r.shortfall > 0)?.time,
      }
    }
  }
  return {
    cash: bank.cash,
    undrawn: bank.wholesale.cbFacilityCapacity,
    pending: bank.wholesale.cbFacilityPending,
    pendingAt: fundingTimeLabel(scenario, plan.pendingCapacity.at),
    pendingCondition: plan.pendingCapacity.condition,
    projection,
    checkpoints: plan.checkpoints
      .filter((c) => reached(state, scenario, c.knownFrom))
      .map((spec) => {
        const due = reached(state, scenario, spec.at)
        const index = scenario.turns.findIndex((t) => t.id === spec.balanceAt.turnId)
        const recordedCash = due
          ? state.tickHistory.find((s) => s.turnIndex === index && s.tick === spec.balanceAt.tick)
              ?.values.cash
          : undefined
        return { spec, time: fundingTimeLabel(scenario, spec.at), reached: due, recordedCash }
      }),
  }
}
