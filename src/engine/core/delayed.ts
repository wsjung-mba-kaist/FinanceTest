import type { Draft } from 'immer'
import type {
  DelayedEffectSpec,
  EffectContext,
  GameState,
  InstitutionState,
  Option,
  PendingEffect,
  ScenarioDefinition,
} from '../types'
import { buildConditionContext, evaluate } from './conditions'
import { applyEffects } from './effects'
import { findDecision, findOption } from './lookup'

export function enqueueDelayed<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  option: Option<S>,
  decisionId: string,
): void {
  option.delayedEffects?.forEach((d, index) => {
    draft.pending.push({
      id: `p${draft.turnIndex}-${decisionId}-${option.id}-${index}`,
      dueTurn: draft.turnIndex + d.afterTurns,
      ...(d.afterTicks ? { dueTick: d.afterTicks } : {}),
      description: d.description,
      ref: { decisionId, optionId: option.id, index },
    })
  })
}

export function resolveDelayedSpec<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  ref: PendingEffect['ref'],
): DelayedEffectSpec<S> | undefined {
  const found = findDecision(scenario as unknown as ScenarioDefinition, ref.decisionId)
  if (!found) return undefined
  const option = findOption(found.decision, ref.optionId)
  return option?.delayedEffects?.[ref.index] as DelayedEffectSpec<S> | undefined
}

/**
 * Fires every pending effect whose due point `(dueTurn, dueTick ?? 0)` has arrived; re-evaluates
 * `when` at fire time. Effects queued without `afterTicks` keep the legacy behaviour exactly:
 * they fire at tick 0 of their due turn.
 */
export function fireDuePending<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  scenario: ScenarioDefinition<S>,
  ctx: EffectContext,
): void {
  const isDue = (p: { dueTurn: number; dueTick?: number }) =>
    p.dueTurn < draft.turnIndex || (p.dueTurn === draft.turnIndex && (p.dueTick ?? 0) <= draft.tick)
  const due = draft.pending.filter(isDue)
  if (due.length === 0) return
  draft.pending = draft.pending.filter((p) => !isDue(p))
  for (const p of due) {
    const spec = resolveDelayedSpec(scenario, p.ref)
    if (!spec) {
      ctx.log(`[warn] 지연 효과 참조 실패 ${p.id}`)
      continue
    }
    const cause = { decisionId: p.ref.decisionId, optionId: p.ref.optionId }
    if (spec.when && !evaluate(spec.when, buildConditionContext(draft as unknown as GameState))) {
      ctx.log(`지연 효과 조건 미충족으로 생략: ${p.description}`)
      continue
    }
    draft.feed.push({
      id: `f${draft.turnIndex}-${draft.feed.length}`,
      turnIndex: draft.turnIndex,
      ...(draft.tick ? { tick: draft.tick } : {}),
      kind: 'delayed',
      severity: 'info',
      title: '이전 결정의 지연 효과',
      body: p.description,
      cause,
    })
    applyEffects(draft, spec.effects, ctx, cause)
  }
}
