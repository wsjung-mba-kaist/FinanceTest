import type { ConfidenceState, MarketState, SecuritiesState } from '../../engine/types'

/**
 * 대한투자증권(가상) = 2020년 초 자기자본 4.5조원 내외 대형 증권사의 합성 기관.
 * 자체헤지 ELS 잔액 10조원은 업계 자체헤지 45.4조(2019년 말, 금감원)의 22%에 해당한다 [fss-dls-2019].
 * 단위: 억원. 시점: T0 = 2020-03-12 장 마감 후. 대조표·보정 근거는 facts.ts / calibration.md 참조.
 *
 * 엔진 필드 재사용 선언: 이 시나리오에는 PF 매입확약이 없으므로 `pf.abcpMaturing`을
 * **CP·전자단기사채 만기 사다리**로, `pf.rollRate`를 **단기조달 차환 성공률**로 쓴다.
 * 대시보드 라벨은 scenario.ts의 KPI에서 그에 맞게 바꾼다.
 */
export const elsInitialSecurities: SecuritiesState = {
  kind: 'securities',
  equityCapital: 45000, // 자기자본 4.5조 [STYLIZED]
  deductions: 13000, // 고정자산·자회사 출자·특수관계인 채권 [STYLIZED]
  additions: 3000, // 후순위차입금 가산분 [STYLIZED]
  // 총위험액 22,000: 시장 13,000(자체헤지 ELS 델타·베가 + 채권·주식) · 신용 7,000 · 운영 2,000 [CAL]
  risk: { market: 13000, credit: 7000, operational: 2000 },
  requiredCapital: 1200, // → NCR = (35,000 − 22,000) / 1,200 = 1,083% [STYLIZED]
  liquidity: {
    cash: 12000, // 원화 현금·예치금
    creditLines: 8000, // 은행 원화 크레딧라인(미사용)
    creditLinesDrawn: 0,
    sellableSecurities: 25000, // 미담보 국공채·통안채 — 나머지 채권은 RP 매도 10조에 이미 담보로 묶임
    fxLiquid: 3000, // 외화 유동자산 = 자체헤지 잔액의 3% [CAL; 금융위 2020.7.30은 사후에 10~20%를 의무화]
  },
  pf: {
    abcpGuaranteed: 0, // 이 시나리오에서는 PF 매입확약을 다루지 않는다 [STYLIZED]
    // CP·전단채 만기 사다리(억원): T0 3/12 2,000 · T1 3/13 3,000 · T2 3/16 5,000 · T3 3/19 6,000 ·
    // T4 3/23 9,000 · T5 3/24 4,000 · T6 3/26 5,000 · T7 3/31 7,000 · 4월 4,000 · 3,000 [CAL]
    abcpMaturing: [2000, 3000, 5000, 6000, 9000, 4000, 5000, 7000, 4000, 3000],
    rollRate: 0.98, // CP·전단채 차환 성공률 [CAL]
    bridgeLoans: 0,
    abcpHeld: 0,
  },
  funding: { cp: 60000, repo: 100000, call: 4000 }, // CP·전단채 6조 · RP 매도 10조 · 콜차입 4,000억
  hedge: {
    elsSelfHedged: 100000, // 자체헤지 ELS 잔액 10조 [STYLIZED, 앵커: 업계 45.4조의 22%]
    marginCallPending: 0,
  },
  custom: {
    elsBackToBack: 40000, // 백투백헤지 잔액 4조 — 자체:백투백 = 71:29 (업계 64:36보다 자체 비중이 높다)
    hedgeDelta: 0.26, // 자체헤지 잔액 대비 해외 지수선물 헤지 명목 비율 [CAL]
    imRatePct: 8, // 해외 거래소 개시증거금률(%) [CAL]
    fxCreditLines: 4000, // 은행 외화 크레딧라인(원화 환산, 미사용)
    fxCreditLinesDrawn: 0,
    callLimit: 6750, // 콜차입 한도 = 자기자본 15% [STYLIZED; 밑에 깔린 조문은 VERIFY]
  },
}

export const elsInitialMarket: MarketState = {
  policyRateBp: 125, // 기준금리 1.25% (3/16 임시 금통위에서 0.75%) [bok-mpb-2020-03-16]
  govt2yBp: 104, // 국고채 3년 1.062%에서 −2bp 근사 — 2년물 계열은 2021-03-10부터다 [CAL]
  govt10yBp: 139, // 국고채 10년 1.387% [ecos-817Y002] 표시 전용
  govt30yBp: 145, // 국고채 30년 1.448% [ecos-817Y002] 표시 전용
  creditSpreadIgBp: 65, // 회사채 AA- 3년 1.707% − 국고채 3년 1.062% [ecos-817Y002]
  creditSpreadHyBp: 679, // BBB- 3년 7.855% − 국고 3년 1.062% [ecos-817Y002] 표시 전용
  fundingStressBp: 16, // CP91 1.55% − CD91 1.39% [ecos-817Y002]
  equityIndex: 1834.33, // KOSPI 2020-03-12 종가 [ecos-802Y001]
  volIndex: 75.47, // VIX 2020-03-12 종가 [fred-vixcls]
  fxUsdLocal: 1202, // 원/달러 3/12 거래 가중평균(3/13 고시 매매기준율) [ecos-731Y001]
  ownStock: 100,
  ownCdsBp: 0, // 국내 증권사 개별 CDS 미거래 [STYLIZED]
  custom: {
    cp91: 155, // CP(91일) 1.55% [ecos-817Y002]
    cd91: 139, // CD(91일) 1.39% [ecos-817Y002]
    govt3y: 106, // 국고채 3년 1.062% [ecos-817Y002]
    corpAA3y: 171, // 회사채 3년 AA- 1.707% [ecos-817Y002]
    oseaIndex: 100, // ELS 기초 해외지수 프록시 = S&P500 (2020-03-11 종가 2,741.38 = 100) [fred-sp500]
    swapBasisBp: -25, // 1개월 원/달러 FX 스왑 베이시스(음수 = 달러 조달 프리미엄) [VERIFY — 서울외국환중개 스왑포인트 일별로 닫는다]
    ownCpRate: 1.75, // 자사 CP·전단채 발행금리 % = CP91 + 20bp [CAL]
  },
}

export const elsInitialConfidence: ConfidenceState = {
  index: 68, // S1(우려) 상단 — 시장은 무너지고 있으나 증권사 신용 자체는 아직 문제되지 않음 [CAL]
  depositors: 70, // 리테일 고객(위탁·예탁금)
  counterparties: 66, // CP·콜·RP·스왑 상대방
  regulators: 72,
  investors: 60,
  media: 62,
  board: 75,
}
