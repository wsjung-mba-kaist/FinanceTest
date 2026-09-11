import type { Decision, Interrupt, Option, ScenarioDefinition, Turn } from '../types'

/**
 * Sub-turn ticks of a turn. Undefined `ticks` ⇒ 1 ⇒ tick 0 is both the first and the last tick,
 * which is exactly how every pre-tick scenario behaves.
 */
export function tickCount(turn: { ticks?: number } | undefined): number {
  return Math.max(1, Math.floor(turn?.ticks ?? 1))
}

export function findTurn(scenario: ScenarioDefinition, turnId: string): Turn | undefined {
  return scenario.turns.find((t) => t.id === turnId)
}

/** Every answerable item of a turn: authored decisions first, then interrupts. */
export function turnDecisions(turn: Turn): Decision[] {
  return turn.interrupts && turn.interrupts.length > 0
    ? [...turn.decisions, ...turn.interrupts]
    : turn.decisions
}

/** Looks an id up in `turn.decisions ∪ turn.interrupts`. */
export function findTurnDecision(turn: Turn, decisionId: string): Decision | undefined {
  return (
    turn.decisions.find((d) => d.id === decisionId) ??
    turn.interrupts?.find((i) => i.id === decisionId)
  )
}

export function isInterrupt(decision: Decision): decision is Interrupt {
  return (decision as Interrupt).interrupt === true
}

export function findDecision(
  scenario: ScenarioDefinition,
  decisionId: string,
): { turnIndex: number; turn: Turn; decision: Decision } | undefined {
  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i]!
    const decision = findTurnDecision(turn, decisionId)
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
    turnDecisions(t).forEach((d) => out.push({ turnIndex: i, decision: d })),
  )
  return out
}
