import type { BankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 한서은행(가상) = 2023년말 총자산 98.3조원의 중견 시중은행 합성 기관. 「대현건설그룹(가상)」의
 * 주채권은행이며, 은행권 평균보다 부동산 PF 집중도가 높은 기관으로 양식화했다.
 * 단위: 조원(KRW 1e12). 시점: T0 = 2023-12-28 (KST).
 *
 * 대차대조표 항등식: 자산 98.30 = 부채 88.90 + 자본 9.40. 대조표·보정 근거는 facts.ts / calibration.md.
 * 파생지표: CET1 7.60 / RWA 71.00 = 10.70% · 총자본 9.40 / 71.00 = 13.24% ·
 * 레버리지 (7.60+0.80) / 112.00 = 7.50%.
 *
 * 규제 최저 CET1은 4.5%(최소) + 2.5%(자본보전완충) = 7.0%이며, 2024.5.1부터 경기대응완충자본
 * 1%가 부과되어 8.0%가 된다 [fsc-ccyb-2023]. 이 상향이 시나리오 T6~T7 구간에 걸린다.
 */
export const pfInitialBank: BankState = {
  kind: 'bank',
  cash: 5.8, // 현금·한국은행 지준예치금·예치금 [STYLIZED]
  securities: {
    // 국고채·통안채 (RP·자금조정대출 적격담보)
    afs: {
      marketValue: 13.6,
      bookValue: 14.3,
      modDuration: 3.1,
      hqlaLevel: 'L1',
      pledgedShare: 0.1,
    },
    // 은행채·공사채·AA 회사채
    htm: { marketValue: 6.9, bookValue: 7.3, modDuration: 4.2, hqlaLevel: 'L2A', pledgedShare: 0 },
  },
  loans: {
    retail: 20.4, // 가계여신 [STYLIZED]
    sme: 23.2, // 중소기업여신 [STYLIZED]
    // 대기업·중견기업여신 22.40 = 대현건설그룹 직접여신 1.28 + PF 사업장대출 4.60 + 기타 16.52
    corporate: 22.4,
    fi: 1.1,
    nonPerforming: 0.48, // 고정이하여신 (총여신 대비 0.71%) [STYLIZED]
    avgDuration: 2.9,
  },
  otherAssets: 4.42, // 유형자산·무형자산·기타자산 (대차대조표 잔차) [CAL]
  deposits: [
    {
      id: 'd1',
      label: '보호예금(개인·5천만원 이하)',
      balance: 34.0,
      insured: true,
      runoffByState: [0, 0.002, 0.03, 0.1],
      dailyCap: 0.1,
      lcrCategory: 'retailStable',
    },
    {
      id: 'd2',
      label: '개인·SME 초과예금',
      balance: 19.0,
      insured: false,
      runoffByState: [0, 0.005, 0.05, 0.2],
      lcrCategory: 'smeLessStable',
    },
    {
      id: 'd3',
      label: '법인 운영성 예금',
      balance: 13.0,
      insured: false,
      runoffByState: [0, 0.01, 0.1, 0.4],
      lcrCategory: 'operational',
    },
    {
      id: 'd4',
      label: '금융기관 예치금',
      balance: 5.0,
      insured: false,
      runoffByState: [0, 0.02, 0.25, 0.8],
      lcrCategory: 'financialInstitution',
    },
  ],
  wholesale: {
    unsecuredShort: 4.0, // 은행채(1년 이하)·CD [STYLIZED]
    unsecuredLong: 6.6, // 은행채(1년 초과) [STYLIZED]
    repoL1: 1.1,
    repoL2A: 0.4,
    repoOther: 0.2,
    cbAdvances: 0,
    cbFacilityCapacity: 3.2, // 한국은행 자금조정대출·RP 적격담보 여력 [CAL]
    cbFacilityPending: 0,
  },
  // 부외 신용공여 4.60 = PF 채무보증·매입확약 1.00 + 일반 한도성 여신 3.60
  committed: { creditToCorporates: 4.6, liquidityToFIs: 0.4 },
  otherLiabilities: 5.6, // 사채·충당부채·기타부채 (대차대조표 잔차) [CAL]
  capital: { cet1: 7.6, at1: 0.8, tier2: 1.0, aociInCet1: true },
  rwa: 71.0, // CET1 10.70% [STYLIZED]
  leverageExposure: 112.0, // 총자산 + 부외 신용환산 [STYLIZED]
  fireSaleDiscount: 0.01,
  taxRate: 0.22, // 법인세 실효세율 [STYLIZED]
  htmTainted: false,
  custom: {
    // ───────── 부동산 PF 익스포저 (사업장 기준, 60개 사업장) ─────────
    pfExposure: 5.6, // 본PF 3.30 + 브릿지론 1.30 + 채무보증 1.00
    pfMain: 3.3, // 본PF 38개 사업장
    pfBridge: 1.3, // 브릿지론 22개 사업장
    pfGuarantee: 1.0, // PF 채무보증·매입확약 (부외)
    pfDelinquencyPct: 0.62, // 자사 부동산 PF 연체율 (%) — 은행권 평균 0.35%보다 높은 집중 포트폴리오 [CAL]
    pfCdSharePct: 0, // 유의·부실우려(C·D) 사업장 비중 (%) — 사업성 평가 전이므로 0
    sitesTotal: 60,
    sitesNormal: 0,
    sitesRestructure: 0,
    sitesAuction: 0,
    // ───────── 대현건설그룹 직접여신 ─────────
    groupSecured: 0.86, // 담보부 금융채권
    groupUnsecured: 0.42, // 무담보 금융채권
    // ───────── 신고 금융채권 구성 (그룹 전체, 조원) ─────────
    claimBank: 7.63, // 은행권 41.0%
    claimNbfi: 5.3, // 제2금융권(저축은행·캐피탈·상호금융) 28.5%
    claimSecurities: 3.26, // 증권사(매입확약·신용공여) 17.5%
    claimInsurance: 1.67, // 보험·연기금·공제회 9.0%
    claimOther: 0.74, // 건설공제조합·기타 4.0%
    claimContingent: 2.7, // 미확정 우발채무 (산입 여부가 T1 결정)
    // ───────── 진행 상태 ─────────
    consentPct: 0, // 채권단 동의율 (%) — 산식은 fx.ts recomputeConsent
    securedConsentPct: 0, // 담보채권 기준 동의율 (%) — 기촉법 제17조제2항의 두 번째 요건
    provisionsCum: 0, // 누적 대손충당금 적립액 (세전, 조원)
    newMoney: 0, // 집행된 신규자금 (조원)
    selfRescuePledged: 0, // 자구안 약정 규모 (조원)
    selfRescueDelivered: 0, // 실제 도착한 자구안 (조원)
    minimumCash: 0,
  },
}

export const pfInitialMarket: MarketState = {
  policyRateBp: 350, // 한국은행 기준금리 3.50% (2023-01-13~) [bok-base-rate]
  govt2yBp: 326.2, // 국고채 2년 3.262% [ecos-817Y002]
  govt10yBp: 318.3, // 국고채 10년 3.183% [ecos-817Y002]
  govt30yBp: 308.8, // 국고채 30년 3.088% [ecos-817Y002]
  creditSpreadIgBp: 74.4, // 회사채 AA- 3년 3.898% − 국고 3년 3.154% [CAL, ecos-817Y002]
  creditSpreadHyBp: 718.8, // 회사채 BBB- 3년 10.342% − 국고 3년 3.154% [CAL, ecos-817Y002]
  fundingStressBp: 49, // CP(91일) 4.32% − CD(91일) 3.83% [CAL, ecos-817Y002]
  equityIndex: 2655, // 코스피 2023-12-28 2,655.28 [ecos-802Y001]
  volIndex: 16, // [STYLIZED]
  fxUsdLocal: 1288, // 원/달러 종가(15:30) 1,288.0 [ecos-731Y003]
  ownStock: 100, // 지주 주가 지수화 (100 = T0) [STYLIZED]
  ownCdsBp: 0,
  custom: {
    govt3y: 315.4, // 국고채 3년 3.154% [ecos-817Y002]
    corpAA3y: 389.8, // 회사채 AA- 3년 3.898% [ecos-817Y002]
    corpBBB3y: 1034.2, // 회사채 BBB- 3년 10.342% [ecos-817Y002]
    cd91: 383, // CD(91일) 3.83% [ecos-817Y002]
    cp91: 432, // CP(91일) 4.32% [ecos-817Y002]
    // 건설사 보증 PF 유동화증권(A2) 가산금리 — 공표 일별 계열이 없어 보정값 [CAL]
    constructionPfSpreadBp: 420,
    // 업권 부동산 PF 연체율(%) — 한국은행 금융안정보고서 2023.12(2023-12-28 발간) p.38, '23.9말 기준
    pfSecuritiesDelinqPct: 13.9, // 증권회사 (전분기 17.3%에서 소폭 하락)
    pfSavingsDelinqPct: 5.6, // 저축은행
    // 금융권 부동산 PF 대출 잔액(조원)·연체율(%) — T0 시점에는 미공표.
    // 2024-03-22 금융위·금감원 「'23.12말 기준 금융권 부동산PF 대출 현황」 공표 시 T5 진입효과로 채워진다.
    pfSectorLoanTn: 0,
    pfSectorDelinqPct: 0,
  },
}

export const pfInitialConfidence: ConfidenceState = {
  index: 58, // S1 우려 — 워크아웃 신청 당일 [CAL]
  depositors: 68, // 예금은 보호 대상이 대부분 — 직접 영향 작음
  counterparties: 55, // 채권단·대주단
  regulators: 54, // 금융위·금감원 상시 점검 대상
  investors: 52,
  media: 48,
  board: 62,
}
