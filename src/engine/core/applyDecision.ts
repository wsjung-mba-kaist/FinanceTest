import { produce } from 'immer'
import type { Decision, GameState, InstitutionState, Option, ScenarioDefinition } from '../types'
import { buildConditionContext, evaluate } from './conditions'
import { enqueueDelayed } from './delayed'
import { applyEffects, makeEffectContext, setFlag } from './effects'
import { applyGameOver, checkGameOver } from './gameOver'
import { latestSnapshot, snapshotMetrics } from './metrics'

export interface DecisionMeta {
  elapsedMs?: number
  timedOut?: boolean
  memo?: string
  hintsUsed?: number
  /** Score penalty accrued from hints for this decision (mode-dependent, set by the store). */
  hintPenalty?: number
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
      | 'exclusive',
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

export function applyDecision<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
  decisionId: string,
  optionIds: string[],
  meta: DecisionMeta = {},
): GameState<S> {
  if (state.phase === 'ended') throw new DecisionError('시나리오가 이미 종료되었습니다', 'ended')
  const turn = scenario.turns[state.turnIndex]
  const decision = turn?.decisions.find((d) => d.id === decisionId)
  if (!turn || !decision)
    throw new DecisionError(`이 턴에 결정 ${decisionId}이(가) 없습니다`, 'unknown_decision')
  const options = validateSelection(state, decision, optionIds)

  let s = produce(state, (d) => {
    const ctx = makeEffectContext(d, latestSnapshot(state as GameState))
    for (const o of options) {
      const cause = { decisionId, optionId: o.id }
      ctx.log(`결정 ${decisionId}: ${o.label}`)
      applyEffects(d, o.effects, ctx, cause)
      if (o.setFlags) for (const [k, v] of Object.entries(o.setFlags)) setFlag(d, k, v)
      enqueueDelayed(d, o, decisionId)
      d.feed.push({
        id: `f${d.turnIndex}-${d.feed.length}`,
        turnIndex: d.turnIndex,
        kind: 'consequence',
        severity: o.trap ? 'warning' : 'info',
        title: o.label,
        body: o.consequences,
        cause,
      })
    }
    d.decisions.push({
      turnIndex: d.turnIndex,
      decisionId,
      optionIds: [...optionIds],
      ...(meta.elapsedMs !== undefined ? { elapsedMs: meta.elapsedMs } : {}),
      ...(meta.timedOut ? { timedOut: true } : {}),
      ...(meta.memo ? { memo: meta.memo } : {}),
      ...(meta.hintsUsed ? { hintsUsed: meta.hintsUsed } : {}),
    })
    if (meta.timedOut) d.counters.timeouts = (d.counters.timeouts ?? 0) + 1
    if (meta.hintsUsed) d.counters.hintsUsed = (d.counters.hintsUsed ?? 0) + meta.hintsUsed
    if (meta.hintPenalty) d.counters.hintPenalty = (d.counters.hintPenalty ?? 0) + meta.hintPenalty
  })
  s = snapshotMetrics(s, scenario)
  const rule = checkGameOver(s, scenario)
  if (rule) s = applyGameOver(s, rule)
  return s
}
