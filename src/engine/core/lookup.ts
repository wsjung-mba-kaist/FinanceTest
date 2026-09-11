import type { Decision, Option, ScenarioDefinition, Turn } from '../types'

export function findTurn(scenario: ScenarioDefinition, turnId: string): Turn | undefined {
  return scenario.turns.find((t) => t.id === turnId)
}

export function findDecision(
  scenario: ScenarioDefinition,
  decisionId: string,
): { turnIndex: number; turn: Turn; decision: Decision } | undefined {
  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i]!
    const decision = turn.decisions.find((d) => d.id === decisionId)
    if (decision) return { turnIndex: i, turn, decision }
  }
  return undefined
}

export function findOption(decision: Decision, optionId: string): Option | undefined {
  return decision.options.find((o) => o.id === optionId)
}

export function allDecisions(
  scenario: ScenarioDefinition,
): { turnIndex: number; decision: Decision }[] {
  const out: { turnIndex: number; decision: Decision }[] = []
  scenario.turns.forEach((t, i) =>
    t.decisions.forEach((d) => out.push({ turnIndex: i, decision: d })),
  )
  return out
}
