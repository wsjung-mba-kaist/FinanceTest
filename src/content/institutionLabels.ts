/**
 * Korean labels for the flattened `InstitutionState` figures.
 *
 * `BalanceSheetMini` falls back to a generic key-figure list for the institution shapes that have
 * no authored balance sheet (prime broker, central bank, asset manager), and that list printed the
 * object paths verbatim — `firm.liquidityPool`, `external.shortTermDebt`, `redemptions.pendingPct`.
 * Machine names on screen are the same defect the KPI ids were: the reader cannot type them
 * anywhere, cannot look them up, and they say the product was not finished.
 *
 * A path with no entry here is **hidden** rather than shown raw. An unlabelled number is not
 * information — a reader who cannot tell what it measures cannot use it, and a wrong guess about
 * what it measures is worse than not seeing it.
 */
export const INSTITUTION_FIGURE_LABELS: Record<string, string> = {
  // PrimeBrokerState
  'firm.capital': '자기자본',
  'firm.liquidityPool': '유동성 풀',
  'firm.realizedLoss': '실현 손실',
  'marginPolicy.staticMarginPct': '기본 증거금률',

  // CentralBankState
  'reserves.gross': '외환보유액(총액)',
  'reserves.usable': '가용 외환보유액',
  'reserves.forwardCommitments': '선물환 약정',
  'external.shortTermDebt': '단기외채',
  'external.totalDebt': '총외채',
  'external.monthlyImports': '월 수입액',
  'external.broadMoneyUsd': '광의통화(달러 환산)',
  'external.annualExportsUsd': '연간 수출액',
  'fx.spot': '원/달러 현물환율',
  'fx.bandPct': '환율 변동폭',
  'fx.interventionToday': '당일 시장개입',
  'policy.rateBp': '정책금리',
  'bankingSystem.npls': '부실채권',
  'bankingSystem.capitalShortfall': '자본 부족액',
  'bankingSystem.liquiditySupport': '유동성 지원',
  'bankingSystem.failedBanks': '퇴출 금융기관',
  'bankingSystem.distressedBanks': '부실 우려 기관',
  'sovereign.debtToGdpPct': '국가채무비율',
  'sovereign.spreadBp': '국채 가산금리',
  'imf.committed': 'IMF 약정액',
  'imf.disbursed': 'IMF 인출액',

  // AssetManagerState
  'fund.nav': '순자산가치',
  'fund.shares': '발행 좌수',
  'fund.leverage': '레버리지',
  'liquidity.daily': '일간 환금성 자산',
  'liquidity.weekly': '주간 환금성 자산',
  'liquidity.monthly': '월간 환금성 자산',
  'liquidity.illiquid': '비유동 자산',
  'redemptions.pendingPct': '대기 환매 비중',
  'redemptions.swingPricingBp': '스윙 프라이싱',
  'redemptions.cumulativePct': '누적 환매 비중',
}

/** Units that are not the scenario's currency, so a bare number would be read as money. */
export const INSTITUTION_FIGURE_UNITS: Record<string, string> = {
  'marginPolicy.staticMarginPct': '%',
  'policy.rateBp': 'bp',
  'sovereign.debtToGdpPct': '%',
  'sovereign.spreadBp': 'bp',
  'fund.leverage': 'x',
  'redemptions.pendingPct': '%',
  'redemptions.swingPricingBp': 'bp',
  'redemptions.cumulativePct': '%',
  'external.monthlyImports': '개월',
}
