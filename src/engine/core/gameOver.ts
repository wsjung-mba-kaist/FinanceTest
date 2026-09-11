import { produce } from 'immer'
import type {
  Ending,
  GameOverRule,
  GameState,
  InstitutionState,
  ScenarioDefinition,
} from '../types'
import { buildConditionContext, evaluate } from './conditions'

export function checkGameOver<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): GameOverRule | null {
  if (state.phase === 'ended') return null
  const ctx = buildConditionContext(state)
  for (const rule of scenario.gameOver) {
    if (evaluate(rule.when, ctx)) return rule
  }
  return null
}

export function applyGameOver<S extends InstitutionState>(
  state: GameState<S>,
  rule: GameOverRule,
): GameState<S> {
  return produce(state, (d) => {
    d.phase = 'ended'
    d.ended = {
      reason: rule.reason,
      turnIndex: d.turnIndex,
      title: rule.title,
      narrative: rule.narrative,
      failed: rule.failed,
      orderly: rule.orderly,
    }
    d.feed.push({
      id: `f${d.turnIndex}-${d.feed.length}`,
      turnIndex: d.turnIndex,
      kind: 'gameover',
      severity: rule.failed ? 'critical' : 'positive',
      title: rule.title,
      body: `${rule.narrative}\n\n발동 규칙: ${rule.ruleText}`,
    })
    d.log.push(`[T${d.turnIndex}] 게임 종료: ${rule.id}`)
  })
}

export function pickEnding<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): Ending | undefined {
  const ctx = buildConditionContext(state)
  return scenario.endings.find((e) => evaluate(e.when, ctx))
}
