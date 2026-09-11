import type {
  AdvisorHint,
  Decision,
  FeedItem,
  GameEvent,
  GameState,
  InstitutionState,
  Mode,
  Option,
  ScenarioDefinition,
  Turn,
} from '../types'
import { isDecisionResolved } from './applyDecision'
import { buildConditionContext, evaluate } from './conditions'

export interface OptionView<S extends InstitutionState = InstitutionState> {
  option: Option<S>
  available: boolean
  reason?: string
}
export interface DecisionView<S extends InstitutionState = InstitutionState> {
  decision: Decision<S>
  resolved: boolean
  chosen: string[]
  options: OptionView<S>[]
}
export interface TurnView<S extends InstitutionState = InstitutionState> {
  turnIndex: number
  turn: Turn<S>
  events: GameEvent<S>[]
  decisions: DecisionView<S>[]
  hints: AdvisorHint[]
  cards: string[]
  feed: FeedItem[]
  allResolved: boolean
}

export function getTurnView<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  opts: { mode?: Mode } = {},
): TurnView<S> {
  const turn = scenario.turns[state.turnIndex]
  if (!turn) throw new Error(`턴 ${state.turnIndex} 없음`)
  const ctx = buildConditionContext(state as GameState)
  const mode = opts.mode ?? 'standard'
  const events = turn.events.filter(
    (e) => evaluate(e.when, ctx) && (mode === 'expert' || !e.expertOnly),
  )
  const decisions: DecisionView<S>[] = turn.decisions
    .filter((d) => evaluate(d.when, ctx))
    .map((decision) => {
      const record = state.decisions.find(
        (r) => r.turnIndex === state.turnIndex && r.decisionId === decision.id,
      )
      const options: OptionView<S>[] = decision.options
        .filter((o) => evaluate(o.when, ctx))
        .map((option) => {
          const ok = evaluate(option.requires, ctx)
          return ok
            ? { option, available: true }
            : {
                option,
                available: false,
                reason: option.unavailableReason ?? '현재 조건에서 선택할 수 없습니다',
              }
        })
      return {
        decision,
        resolved: Boolean(record),
        chosen: record?.optionIds ?? [],
        options,
      }
    })
  const hints = (turn.advisorHints ?? []).filter((h) => evaluate(h.when, ctx))
  const cards = new Set<string>(turn.relatedCards ?? [])
  for (const e of events) e.cardRefs?.forEach((c) => cards.add(c))
  for (const d of decisions) {
    d.decision.cardRefs?.forEach((c) => cards.add(c))
    d.decision.requiredConcepts?.forEach((c) => cards.add(c))
  }
  const allResolved = decisions.every((d) => d.resolved || !(d.decision.required ?? true))
  return {
    turnIndex: state.turnIndex,
    turn,
    events,
    decisions,
    hints,
    cards: [...cards],
    feed: state.feed.filter((f) => f.turnIndex === state.turnIndex),
    allResolved,
  }
}

export function isDecisionResolvedNow(state: GameState, decisionId: string): boolean {
  return isDecisionResolved(state, decisionId)
}
