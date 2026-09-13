import { findDecision, type GameState, type ScenarioDefinition } from '../engine'

/** Current books only. No future effects, policy events or hypothetical funding are evaluated. */
export function fundingPosition(state: GameState) {
  const s = state.institution
  if (s.kind === 'pension') {
    return {
      kind: 'pension' as const,
      cash: s.assets.cash,
      unpaidMargin: s.assets.ldi.marginCallOutstanding,
      poolCash: s.assets.ldi.collateral.cash,
      poolGilts: s.assets.ldi.collateral.eligibleGilts,
      schemeGilts: s.assets.gilts.marketValue * (1 - (s.assets.gilts.pledgedShare ?? 0)),
    }
  }
  if (s.kind === 'securities') {
    const maturity = s.pf.abcpMaturing[0] ?? 0
    const rollRate = Math.max(0, Math.min(1, s.pf.rollRate))
    const estimatedPurchase = maturity * (1 - rollRate)
    return {
      kind: 'securities' as const,
      cash: s.liquidity.cash,
      undrawn: Math.max(0, s.liquidity.creditLines - s.liquidity.creditLinesDrawn),
      maturity,
      rollRate,
      estimatedPurchase,
      purchaseCashGap: Math.max(0, estimatedPurchase - s.liquidity.cash),
      unpaidMargin: s.hedge.marginCallPending,
      fxAssets: s.liquidity.fxLiquid,
      maturities: s.pf.abcpMaturing.slice(0, 4),
    }
  }
  return undefined
}

/** Calendar labels of already requested processing; never turn counts presented as business days. */
export function pendingFundingInstructions(state: GameState, scenario: ScenarioDefinition) {
  return [...state.pending]
    .sort((a, b) => a.dueTurn - b.dueTurn || (a.dueTick ?? 0) - (b.dueTick ?? 0))
    .map((pending) => {
      const decision = findDecision(scenario, pending.ref.decisionId)?.decision
      const option = decision?.options.find((o) => o.id === pending.ref.optionId)
      const turn = scenario.turns[pending.dueTurn]
      const tickLabel = turn?.tickLabels?.[pending.dueTick ?? 0]
      return {
        id: pending.id,
        instruction: option?.label ?? decision?.title ?? '선택에 따른 후속 처리',
        due: turn
          ? `${turn.timeLabel}${tickLabel ? ` · 처리 시각 ${tickLabel}` : ''}`
          : '시나리오 종료 이후 · 처리 시각 미정',
      }
    })
}
