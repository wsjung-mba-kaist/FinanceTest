import type { AssetManagerState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 하버라이트 크레딧펀드(Harborlight Credit Fund) = 2020년 초 미국 IG/HY 혼합 회사채 개방형 펀드를
 * $8bn 규모로 양식화한 **합성 펀드**. 특정 실제 펀드가 아니다. 단위: $M(units.scale = 1e6).
 * 대조표·보정 근거는 facts.ts / docs/scenarios/covid-2020-fund.md 참조.
 *
 * 시점: T0 = 2020-02-28 (금) 장 마감 — 2/24~28 주간 급락 직후, 환매 유입이 막 시작된 시점.
 *
 * 유동성 사다리(liquidity ladder) — 이 시나리오의 중심 구조
 *   daily    560 (7%)  현금·T-bill·온더런 국채              — 당일 현금화, 거래비용 ≈2bp
 *   weekly  1040 (13%) 장기 국채·에이전시·대형 벤치마크 IG   — 1주, ≈15bp
 *   monthly 3600 (45%) 일반 IG 회사채                        — 1개월, ≈40bp
 *   illiquid 2800 (35%) HY·오프벤치마크·소액 발행·144A       — 그 이상, ≈120bp
 *
 * 총합 8,000 = fund.nav. 차입(creditLineDrawn)이 있으면 nav = 구간 합계 − 차입 잔액이다.
 */
export const fundInitialAm: AssetManagerState = {
  kind: 'asset_manager',
  fund: { nav: 8000, shares: 800, leverage: 1 },
  liquidity: { daily: 560, weekly: 1040, monthly: 3600, illiquid: 2800 },
  redemptions: { pendingPct: 0, gated: false, swingPricingBp: 0, cumulativePct: 0 },
  custom: {
    /** 기준가 지수 (2/28 좌당 $10.00 = 100). */
    navIndex: 100,
    /** 누적 환매율(%NAV)의 분모 — 시나리오 내 불변. */
    initialNav: 8000,
    /** 비유동 구간 / 총자산 × 100. 수평 슬라이싱이 올리고 수직 슬라이싱은 유지한다. */
    illiquidSharePct: 35,
    /** IG 회사채 왕복 거래비용(bp). 시장 스트레스의 실무 지표이자 매도 비용 계수. */
    bidAskIgBp: 30,
    /** 누적 희석(bp) — 환매 대응 비용 중 잔존 투자자가 부담한 부분. */
    dilutionBp: 0,
    /** 커밋 크레딧라인 약정 한도($M). */
    creditLineLimit: 400,
    /** 크레딧라인 인출 잔액($M). */
    creditLineDrawn: 0,
  },
}

export const fundInitialMarket: MarketState = {
  policyRateBp: 163, // 연방기금 목표범위 1.50~1.75% 중간값 [fed-h15]
  govt2yBp: 86, // 2/28 종가 0.86% [fed-h15]
  govt10yBp: 113, // 2/28 종가 1.13% [fed-h15]
  govt30yBp: 165, // 2/28 종가 1.65% [fed-h15]
  creditSpreadIgBp: 130, // [VERIFY] facts.ts 참조
  creditSpreadHyBp: 500, // [VERIFY] facts.ts 참조
  fundingStressBp: 35, // 3개월 FRA-OIS 근사 [VERIFY]
  equityIndex: 100, // S&P 500 지수화(2/28 = 100)
  volIndex: 40.11, // VIX 2/28 종가 [cboe-vix-history]
  fxUsdLocal: 1, // 달러 기준 펀드 — 사용하지 않음
  ownStock: 100, // 개방형 펀드에는 상장 주가가 없다 — 사용하지 않음
  ownCdsBp: 0, // 해당 없음
  custom: {
    /** 대표 IG 회사채 ETF의 NAV 대비 괴리(%). 음수 = 할인. */
    etfDiscountPct: -0.2,
    /** 온·오프더런 10년 국채 수익률 격차(bp) — 국채 시장 유동성 지표. */
    treasuryOffRunBp: 3,
  },
}

export const fundInitialConfidence: ConfidenceState = {
  index: 68, // S1(우려) 상단: 주간 급락 직후, 환매 유입 개시
  depositors: 68, // 수익자(개인·기관 투자자)
  counterparties: 65, // 딜러·지정참가회사(AP)·크레딧라인 은행
  regulators: 75, // SEC 투자관리국
  investors: 68, // 대형 기관 보유자(공적연금·보험)
  media: 62,
  board: 75, // 펀드 이사회(독립이사 포함)
}
