import { produce } from 'immer'
import type {
  Decision,
  DialogueReply,
  GameState,
  InstitutionState,
  Option,
  ScenarioDefinition,
} from '../types'
import { buildConditionContext, evaluate } from './conditions'
import { enqueueDelayed } from './delayed'
import { hasDialogue, walk } from './dialogue'
import { applyEffects, makeEffectContext, setFlag } from './effects'
import { applyGameOver, checkGameOver } from './gameOver'
import { findTurnDecision, isInterrupt, tickCount } from './lookup'
import { latestSnapshot, snapshotMetrics } from './metrics'
import { buildReel, withReel } from './reel'

export interface DecisionMeta {
  elapsedMs?: number
  timedOut?: boolean
  memo?: string
  hintsUsed?: number
  /** Score penalty accrued from hints for this decision (mode-dependent, set by the store). */
  hintPenalty?: number
  reasoning?: { evidence: string; assumption: string; reconsiderWhen: string }
  /**
   * Reply ids walked through the decision's dialogue, in order. Only meaningful for a decision
   * with `steps`; the path is re-verified here and stored on the `DecisionRecord`, which is what
   * makes a dialogue replayable. Omitting it commits the option directly (the deadline sweep and
   * an autoplay fallback both do that).
   */
  path?: string[]
}

export class DecisionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ended'
      | 'unknown_decision'
      | 'inactive'
      | 'already_resolved'
      | 'select_count'
      | 'duplicate'
      | 'unknown_option'
      | 'hidden_option'
      | 'unavailable'
      | 'exclusive'
      | 'invalid-path',
  ) {
    super(message)
    this.name = 'DecisionError'
  }
}

export function isDecisionResolved(state: GameState, decisionId: string): boolean {
  return state.decisions.some((r) => r.turnIndex === state.turnIndex && r.decisionId === decisionId)
}

export function validateSelection<S extends InstitutionState>(
  state: GameState<S>,
  decision: Decision<S>,
  optionIds: string[],
): Option<S>[] {
  const ctx = buildConditionContext(state as GameState)
  if (!evaluate(decision.when, ctx))
    throw new DecisionError('현재 활성화되지 않은 결정입니다', 'inactive')
  if (decision.availableFrom !== undefined && state.tick < decision.availableFrom)
    throw new DecisionError('아직 요청받지 않은 결정입니다', 'inactive')
  if (isInterrupt(decision as Decision) && !state.openInterrupts.includes(decision.id))
    throw new DecisionError('응답 가능한 인터럽트가 아닙니다', 'inactive')
  if (isDecisionResolved(state as GameState, decision.id))
    throw new DecisionError('이미 확정된 결정입니다', 'already_resolved')
  const sel = decision.select ?? { min: 1, max: 1 }
  if (optionIds.length < sel.min || optionIds.length > sel.max) {
    throw new DecisionError(`선택 개수는 ${sel.min}~${sel.max}개여야 합니다`, 'select_count')
  }
  if (new Set(optionIds).size !== optionIds.length)
    throw new DecisionError('중복 선택', 'duplicate')
  const options = optionIds.map((id) => {
    const o = decision.options.find((x) => x.id === id)
    if (!o) throw new DecisionError(`알 수 없는 옵션 ${id}`, 'unknown_option')
    if (!evaluate(o.when, ctx))
      throw new DecisionError(`선택할 수 없는 옵션: ${o.label}`, 'hidden_option')
    if (!evaluate(o.requires, ctx)) {
      throw new DecisionError(o.unavailableReason ?? `요건 미충족: ${o.label}`, 'unavailable')
    }
    return o
  })
  for (const group of decision.exclusive ?? []) {
    if (group.filter((g) => optionIds.includes(g)).length > 1) {
      throw new DecisionError('상호 배타적인 옵션을 함께 선택할 수 없습니다', 'exclusive')
    }
  }
  return options
}

/**
 * Verifies a dialogue path against the decision **as it exists now**: every reply id must be
 * offered at the step the walk has reached, its `when` must hold, and the walk must terminate in
 * exactly the option being committed. A replay must never silently accept a path the scenario no
 * longer allows, so a mismatch throws instead of falling back to the bare option list.
 *
 * Returns the replies to apply, in path order. A decision without `steps` returns `[]` and is
 * therefore byte-identical to its pre-D3 behaviour.
 */
export function validateDialoguePath<S extends InstitutionState>(
  state: GameState<S>,
  decision: Decision<S>,
  optionIds: string[],
  path: string[] | undefined,
): DialogueReply<S>[] {
  if (!hasDialogue(decision)) {
    if (path && path.length > 0)
      throw new DecisionError(`결정 ${decision.id}에는 대화 단계가 없습니다`, 'invalid-path')
    return []
  }
  // No path ⇒ the option was committed directly: the deadline sweep, a timeout default, or an
  // autoplay fallback. The dialogue is simply skipped, exactly as if it had no steps.
  if (!path || path.length === 0) return []
  const w = walk(decision, path, buildConditionContext(state as GameState))
  if (w.invalid) throw new DecisionError(`대화 경로 오류: ${w.invalid}`, 'invalid-path')
  if (w.optionId === undefined)
    throw new DecisionError('대화가 아직 끝나지 않았습니다', 'invalid-path')
  if (optionIds.length !== 1 || optionIds[0] !== w.optionId) {
    throw new DecisionError(
      `대화가 귀결한 옵션(${w.optionId})과 확정 옵션(${optionIds.join(', ') || '없음'})이 다릅니다`,
      'invalid-path',
    )
  }
  return w.replies
}

export function applyDecision<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  decisionId: string,
  optionIds: string[],
  meta: DecisionMeta = {},
): GameState<S> {
  if (state.phase === 'ended') throw new DecisionError('시나리오가 이미 종료되었습니다', 'ended')
  const turn = scenario.turns[state.turnIndex]
  // Interrupts are ordinary decisions that arrive mid-turn, so they resolve through this same path.
  const decision = turn
    ? (findTurnDecision(turn as unknown as Parameters<typeof findTurnDecision>[0], decisionId) as
        Decision<S> | undefined)
    : undefined
  if (!turn || !decision)
    throw new DecisionError(`이 턴에 결정 ${decisionId}이(가) 없습니다`, 'unknown_decision')
  const options = validateSelection(state, decision, optionIds)
  const replies = validateDialoguePath(state, decision, optionIds, meta.path)
  const interrupt = isInterrupt(decision as Decision)
  const before = state

  let s = produce(state, (d) => {
    const ctx = makeEffectContext(d, latestSnapshot(state as GameState), {
      ticks: tickCount(turn),
      noise: scenario.noise,
    })
    // Reply effects land in path order, before the option the conversation resolved to.
    for (const r of replies) {
      const cause = { decisionId, optionId: optionIds[0]! }
      ctx.log(`대화 ${decisionId}: ${r.label}`)
      if (r.effects) applyEffects(d, r.effects, ctx, cause)
      if (r.setFlags) for (const [k, v] of Object.entries(r.setFlags)) setFlag(d, k, v)
    }
    for (const o of options) {
      const cause = { decisionId, optionId: o.id }
      ctx.log(`결정 ${decisionId}: ${o.label}`)
      applyEffects(d, o.effects, ctx, cause)
      if (o.setFlags) for (const [k, v] of Object.entries(o.setFlags)) setFlag(d, k, v)
      enqueueDelayed(d, o, decisionId)
      d.feed.push({
        id: `f${d.turnIndex}-${d.feed.length}`,
        turnIndex: d.turnIndex,
        ...(d.tick ? { tick: d.tick } : {}),
        kind: 'consequence',
        severity: o.trap ? 'warning' : 'info',
        title: o.label,
        body: o.consequences,
        cause,
      })
    }
    // `tick` is omitted at 0 so records of un-ticked turns keep their historical shape.
    d.decisions.push({
      turnIndex: d.turnIndex,
      decisionId,
      optionIds: [...optionIds],
      ...(d.tick ? { tick: d.tick } : {}),
      ...(interrupt ? { interrupt: true as const } : {}),
      // Omitted when there is no dialogue, so records of every pre-D3 run keep their exact shape.
      ...(replies.length > 0 ? { path: [...(meta.path ?? [])] } : {}),
      ...(meta.elapsedMs !== undefined ? { elapsedMs: meta.elapsedMs } : {}),
      ...(meta.timedOut ? { timedOut: true } : {}),
      ...(meta.memo ? { memo: meta.memo } : {}),
      ...(meta.hintsUsed ? { hintsUsed: meta.hintsUsed } : {}),
      ...(meta.hintPenalty !== undefined ? { hintPenalty: meta.hintPenalty } : {}),
      ...(meta.reasoning ? { reasoning: { ...meta.reasoning } } : {}),
    })
    if (interrupt) d.openInterrupts = d.openInterrupts.filter((id) => id !== decisionId)
    if (meta.timedOut) d.counters.timeouts = (d.counters.timeouts ?? 0) + 1
    if (meta.hintsUsed) d.counters.hintsUsed = (d.counters.hintsUsed ?? 0) + meta.hintsUsed
    if (meta.hintPenalty) d.counters.hintPenalty = (d.counters.hintPenalty ?? 0) + meta.hintPenalty
  })
  s = snapshotMetrics(s, scenario)
  const rule = checkGameOver(s, scenario)
  if (rule) s = applyGameOver(s, rule)
  return withReel(
    s,
    buildReel(
      before,
      s,
      { kind: interrupt ? 'interrupt' : 'decision', decisionId, optionIds: [...optionIds] },
      { interrupts: turn.interrupts },
    ),
  )
}
