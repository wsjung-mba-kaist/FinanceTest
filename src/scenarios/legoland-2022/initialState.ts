import type { ConfidenceState, MarketState, SecuritiesState } from '../../engine/types'

/**
 * 한빛증권(가상) = 자기자본 1조원 내외의 중형 증권사 합성 기관. PF 채무보증/자기자본 47%(한신평 2022.3 중형 평균)
 * [kis-pf-2022-03], 만기 사다리는 업계 만기(10월 6.2~6.7조 / 11월 10.7조 of 20.2조) 비율로 스케일 [CAL].
 * 단위: 억원. 시점: T0 = 2022-09-28. 대조표·보정 근거는 facts.ts / calibration.md 참조.
 */
export const legoInitialSecurities: SecuritiesState = {
  kind: 'securities',
  equityCapital: 10000, // 자기자본 1조원 [STYLIZED]
  deductions: 1500, // 고정자산·자회사 출자 등 영업용순자본 차감항목 [STYLIZED]
  additions: 500, // 후순위차입금 가산분 (콜옵션 결정 대상) [STYLIZED]
  // 총위험액 5,250: 시장 2,400 · 신용 2,250(PF 채무보증 4,700×18% ≈ 846 + 브릿지론·기타 1,404) · 운영 600 [CAL]
  // 위험값 18% = 시행세칙 별표5 <표13> 일반법인 무등급 12% × 부동산채무보증 가산 150% [fsc-80034 표로 교차확인]
  risk: { market: 2400, credit: 2250, operational: 600 },
  requiredCapital: 1500, // 필요유지자기자본 → NCR = (9,000 − 5,250) / 1,500 = 250% [STYLIZED]
  liquidity: {
    cash: 1800,
    creditLines: 1500, // 은행 크레딧라인(미사용)
    creditLinesDrawn: 0,
    sellableSecurities: 2400, // 매각·RP 담보 가능 채권(국공채·은행채·AA)
    fxLiquid: 300,
  },
  pf: {
    abcpGuaranteed: 4700, // 자기자본 47% [kis-pf-2022-03]
    // T0(9/28~10/4) 150 · T1 400 · T2 400 · T3 250 · T4 450 · T5 750 · T6 1,050 · T7 700 · T8 300 · 2023.1~ 250
    // 10월(T1~T4) 1,500 ≈ 32%, 11월(T5~T7) 2,500 ≈ 53% — 업계 6.5조/20.2조·10.7조/20.2조 비율 [CAL]
    abcpMaturing: [150, 400, 400, 250, 450, 750, 1050, 700, 300, 250],
    rollRate: 0.95, // 회생 발표 직후, 부도 전 [CAL]
    bridgeLoans: 800, // 브릿지론 직접 대출 [STYLIZED]
    abcpHeld: 0,
  },
  funding: { cp: 7000, repo: 1000, call: 1000 }, // CP·전단채 7,000 · RP 매도 1,000 · 콜차입 1,000 [STYLIZED]
  hedge: { elsSelfHedged: 0, marginCallPending: 0 }, // 중형사: ELS 자체헤지 없음 [STYLIZED]
  custom: {
    callLimit: 1500, // 콜차입 한도 = 자기자본 15%(모범규준 제2-15조② 월평균 상한을 일별 하드캡으로 단순화) [STYLIZED]
    subDebtCallable: 500, // 11/15 콜 도래 후순위채 [STYLIZED]
  },
}

export const legoInitialMarket: MarketState = {
  policyRateBp: 250, // 2022-08-25 2.50% [bok-base-rate]
  govt2yBp: 431, // 국고채 2년 4.311% [ecos-817Y002]
  govt10yBp: 433, // 국고채 10년 4.332% [ecos-817Y002]
  govt30yBp: 410, // 국고채 30년 4.100% [ecos-817Y002]
  creditSpreadIgBp: 100, // 회사채 AA- 3y 5.342% − 국고 3y 4.338% [CAL, ecos-817Y002]
  creditSpreadHyBp: 686, // 회사채 BBB- 3y 11.202% − 국고 3y 4.338% [CAL, ecos-817Y002]
  fundingStressBp: 5, // CP91(A1) − CD91; T0만 기준일 불일치 [CAL, facts.ts 주석]
  equityIndex: 2155, // 코스피 2022-09-30 2,155.49 [kofia-bond 외 KRX]
  volIndex: 24, // [STYLIZED]
  fxUsdLocal: 1440, // 원/달러 2022-09-28 종가(15:30) 1,439.9, 장중 고가 1,442.2 [ecos-731Y003]
  ownStock: 100,
  ownCdsBp: 0, // 해당 없음 [STYLIZED]
  custom: {
    cp91: 315, // CP91(A1) 2022-09-22 3.15%를 9/28 대용으로 사용 [CAL, kofia-bond]
    cd91: 314, // CD(91일) 3.14% [ecos-817Y002]
    creditSpreadAA: 100, // AA- 3y − 국고 3y = 100.4bp [CAL, ecos-817Y002]
    govt3y: 434, // 국고채 3년 4.338% [ecos-817Y002] (9/26 정점 4.548%)
    corpAA3y: 534, // 회사채 AA- 3년 5.342% [ecos-817Y002]
    ownCpRate: 4.4, // 자사 CP(A2) 발행금리 % = CP91(A1) + 125bp [CAL]
  },
}

export const legoInitialConfidence: ConfidenceState = {
  index: 62, // S1 우려 — 회생 발표 직후 [CAL]
  depositors: 65, // 리테일 고객(위탁·예탁금)
  counterparties: 62, // CP·콜·RP 대여자
  regulators: 60,
  investors: 60,
  media: 58,
  board: 75,
}
