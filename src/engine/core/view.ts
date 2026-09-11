import type {
  AdvisorHint,
  ConditionContext,
  Decision,
  DialogueReply,
  DialogueStep,
  FeedItem,
  GameEvent,
  GameState,
  InstitutionState,
  Interrupt,
  Mode,
  Option,
  ScenarioDefinition,
  Turn,
} from '../types'
import { isDecisionResolved } from './applyDecision'
import { buildConditionContext, evaluate } from './conditions'
import { availableReplies, entryStep, hasDialogue, walk } from './dialogue'
import { tickCount } from './lookup'

export interface OptionView<S extends InstitutionState = InstitutionState> {
  option: Option<S>
  available: boolean
  reason?: string
}

/** One already-given beat of the transcript: what was said, and what the player answered. */
export interface DialogueTurn<S extends InstitutionState = InstitutionState> {
  step: DialogueStep<S>
  reply: DialogueReply<S>
}

/**
 * A conversation in progress. The in-progress `path` is **not** engine state — an unfinished
 * conversation is UI state and never enters `GameState` — so the caller hands it in and gets back
 * where that path has reached.
 */
export interface DialogueView<S extends InstitutionState = InstitutionState> {
  /** Reply ids walked so far, echoed back. */
  path: string[]
  /** The beats already exchanged, in order. */
  transcript: DialogueTurn<S>[]
  /** The step awaiting an answer; absent once the dialogue resolved or the path went stale. */
  step?: DialogueStep<S>
  /** Replies offered at `step` right now (filtered by `when`). */
  replies: DialogueReply<S>[]
  /** The option the dialogue resolved to, ready to be committed. */
  resolvedOptionId?: string
  /** Why the path no longer walks (the panel should reset to the entry step). */
  invalid?: string
}

export interface DecisionView<S extends InstitutionState = InstitutionState> {
  decision: Decision<S>
  resolved: boolean
  chosen: string[]
  options: OptionView<S>[]
  /** Present only for a decision with `steps`. */
  dialogue?: DialogueView<S>
}

/**
 * Where an in-progress `path` has reached in a decision's dialogue. Exposed on its own so the
 * player-facing panel can ask about one decision without rebuilding the whole turn view.
 */
export function dialogueView<S extends InstitutionState>(
  state: GameState<S>,
  decision: Decision<S>,
  path: readonly string[] = [],
  ctx: ConditionContext = buildConditionContext(state as GameState),
): DialogueView<S> | undefined {
  if (!hasDialogue(decision)) return undefined
  const w = walk(decision, path, ctx)
  // A stale path (the scenario changed under a restored run) rewinds to the entry step rather than
  // stranding the player: the engine still refuses the stale path itself at commit time.
  const stale = w.invalid !== undefined
  const step = stale ? entryStep(decision) : w.step
  const out: DialogueView<S> = {
    path: stale ? [] : [...path],
    transcript: stale ? [] : w.replies.map((reply, i) => ({ step: w.steps[i]!, reply })),
    replies: step ? availableReplies(decision, step.id, ctx) : [],
  }
  if (step) out.step = step
  if (w.optionId !== undefined) out.resolvedOptionId = w.optionId
  if (w.invalid !== undefined) out.invalid = w.invalid
  return out
}
export interface TurnView<S extends InstitutionState = InstitutionState> {
  turnIndex: number
  turn: Turn<S>
  /** Current sub-turn tick and its clock label, if the turn is ticked. */
  tick: number
  ticks: number
  tickLabel?: string
  events: GameEvent<S>[]
  decisions: DecisionView<S>[]
  /** Interrupts awaiting an answer right now, in the order they arrived. */
  interrupts: DecisionView<S>[]
  hints: AdvisorHint[]
  cards: string[]
  feed: FeedItem[]
  allResolved: boolean
}

export function getTurnView<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  opts: {
    mode?: Mode
    /**
     * In-progress dialogue paths by decision id, owned by the caller (the store). An unfinished
     * conversation is UI state: it must never enter `GameState`.
     */
    dialoguePaths?: Record<string, string[]>
  } = {},
): TurnView<S> {
  const turn = scenario.turns[state.turnIndex]
  if (!turn) throw new Error(`턴 ${state.turnIndex} 없음`)
  const ctx = buildConditionContext(state as GameState)
  const mode = opts.mode ?? 'standard'
  const events = turn.events.filter(
    (e) =>
      evaluate(e.when, ctx) &&
      (mode === 'expert' || !e.expertOnly) &&
      (state.tickSchedule[e.id] ?? e.atTick ?? 0) <= state.tick,
  )
  const toView = (decision: Decision<S>): DecisionView<S> => {
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
    // A resolved decision shows the path that is actually in the log (empty when the deadline
    // sweep committed the default); only an unresolved one reads the caller's in-progress path.
    const dialogue = dialogueView(
      state,
      decision,
      record ? (record.path ?? []) : (opts.dialoguePaths?.[decision.id] ?? []),
      ctx,
    )
    return {
      decision,
      resolved: Boolean(record),
      chosen: record?.optionIds ?? [],
      options,
      ...(dialogue ? { dialogue } : {}),
    }
  }
  const decisions: DecisionView<S>[] = turn.decisions
    .filter((d) => evaluate(d.when, ctx) && (d.availableFrom ?? 0) <= state.tick)
    .map(toView)
  const interruptDefs = (turn.interrupts ?? []) as Interrupt<S>[]
  const interrupts: DecisionView<S>[] = state.openInterrupts
    .map((id) => interruptDefs.find((i) => i.id === id))
    .filter((i): i is Interrupt<S> => Boolean(i))
    .map(toView)
  const hints = (turn.advisorHints ?? []).filter((h) => evaluate(h.when, ctx))
  const cards = new Set<string>(turn.relatedCards ?? [])
  for (const e of events) e.cardRefs?.forEach((c) => cards.add(c))
  for (const d of decisions) {
    d.decision.cardRefs?.forEach((c) => cards.add(c))
    d.decision.requiredConcepts?.forEach((c) => cards.add(c))
  }
  const allResolved =
    decisions.every((d) => d.resolved || !(d.decision.required ?? true)) && interrupts.length === 0
  const tickLabel = turn.tickLabels?.[state.tick]
  return {
    turnIndex: state.turnIndex,
    turn,
    tick: state.tick,
    ticks: tickCount(turn),
    ...(tickLabel !== undefined ? { tickLabel } : {}),
    events,
    decisions,
    interrupts,
    hints,
    cards: [...cards],
    feed: state.feed.filter((f) => f.turnIndex === state.turnIndex),
    allResolved,
  }
}

export function isDecisionResolvedNow(state: GameState, decisionId: string): boolean {
  return isDecisionResolved(state, decisionId)
}
