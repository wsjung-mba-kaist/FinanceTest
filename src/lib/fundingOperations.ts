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
  const instructions = [...state.pending]
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
  if (scenario.meta.id === 'els-margin-2020') {
    const turn = scenario.turns.find((t) => t.id === 't7')
    const due = turn ? `${turn.timeLabel} · ${turn.tickLabels?.[1] ?? '4/2 결제'}` : '4/2 결제'
    if ((state.counters.bokRpPending ?? 0) > 0)
      instructions.push({ id: 'els-policy-rp', instruction: '한국은행 RP 입금', due })
    if ((state.counters.bokSwapPending ?? 0) > 0)
      instructions.push({ id: 'els-policy-fx', instruction: '거래은행 외화차입 입금', due })
    const settlementIndex = scenario.turns.findIndex((t) => t.id === 't7')
    if (
      state.flags.april_refinance_planned &&
      settlementIndex >= 0 &&
      (state.turnIndex < settlementIndex || (state.turnIndex === settlementIndex && state.tick < 1))
    )
      instructions.push({ id: 'els-refinance', instruction: '입금 후 콜·CP 상환', due })
  }
  return instructions
}
