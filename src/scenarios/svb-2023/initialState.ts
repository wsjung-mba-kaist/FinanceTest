import type { BankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 퍼시픽밸리은행(PVB) = SVB Financial Group 연결 2022-12-31 [svb-10k-2022] 반올림 + 양식화 세그먼트.
 * 단위: $B. 대조표와 보정 근거는 facts.ts / calibration.md 참조.
 * 시점: T0 = 2023-02-27. T1(3/8) 진입 시 1~2월 추세 유출(−8)과 현금 감소(−2)를 외생 효과로 반영한다.
 */
export const svbInitialBank: BankState = {
  kind: 'bank',
  cash: 14, // 10-K 13.8 [svb-10k-2022]
  securities: {
    afs: { marketValue: 26, bookValue: 28.9, modDuration: 3.6, hqlaLevel: 'L1', pledgedShare: 0 }, // FV 26.1; 미실현손실 ≈2.5~2.9 [STYLIZED]
    htm: {
      marketValue: 76.2,
      bookValue: 91.3,
      modDuration: 6.2,
      hqlaLevel: 'L2A',
      pledgedShare: 0,
    }, // 미실현손실 15.1 [svb-10k-2022]
  },
  loans: { retail: 5, sme: 10, corporate: 55, fi: 3.6, nonPerforming: 0.3, avgDuration: 2 }, // 순대출 73.6
  otherAssets: 7,
  deposits: [
    {
      id: 'd1',
      label: 'VC 투자 스타트업 (디지털·네트워크 조율)',
      balance: 90,
      insured: false,
      runoffByState: [0.001, 0.03, 0.35, 0.95],
      lcrCategory: 'corporateUninsured',
      networked: true,
    },
    {
      id: 'd2',
      label: '대형 테크·생명과학 기업 및 VC/PE 펀드 (운영성)',
      balance: 58, // T1 진입 시 −8 → 50
      insured: false,
      runoffByState: [0, 0.02, 0.2, 0.8],
      lcrCategory: 'operational',
    },
    {
      id: 'd3',
      label: '보험 대상·스윕 예금',
      balance: 10,
      insured: true,
      runoffByState: [0, 0.002, 0.03, 0.1],
      dailyCap: 0.1,
      lcrCategory: 'corporateInsured',
    },
    {
      id: 'd4',
      label: '프라이빗뱅크 고액자산가',
      balance: 15,
      insured: false,
      runoffByState: [0, 0.01, 0.1, 0.5],
      lcrCategory: 'retailLessStable',
    },
  ],
  wholesale: {
    unsecuredShort: 0,
    unsecuredLong: 5.4, // 장기채 [svb-10k-2022]
    repoL1: 0,
    repoL2A: 0,
    repoOther: 0,
    cbAdvances: 15, // FHLB 차입 ≈$15B [CBO 2024, 2차]
    // 당일 인출 가능한 기설정 담보 여력. [CAL] 역사 경로가 3/9 마감 잔고 −$0.96B(DFPI 명령)를 재현하도록 역산.
    // Davis Polk 기조연설의 "연준 예치 담보 $5B 남짓"과 같은 자릿수.
    cbFacilityCapacity: 6.4,
    cbFacilityPending: 0,
  },
  committed: { creditToCorporates: 60, liquidityToFIs: 0 }, // 미인출 약정 [STYLIZED]
  otherLiabilities: 2.2,
  capital: { cet1: 12.7, at1: 3.6, tier2: 0, aociInCet1: false }, // 보통주 ≈12.7, 우선주 ≈3.6; Cat IV AOCI 옵트아웃
  rwa: 105, // CET1 12.05% 역산 [svb-10k-2022]
  leverageExposure: 212,
  fireSaleDiscount: 0.015, // $20B agency MBS/일 ≈ 1.5% [CAL]
  taxRate: 0.25, // [STYLIZED]
  htmTainted: false,
  custom: { minimumCash: 0 },
}

export const svbInitialMarket: MarketState = {
  policyRateBp: 463, // 4.50–4.75% (2023-02-01 인상)
  govt2yBp: 480, // 2/27 ≈4.8% [fred-dgs2]
  govt10yBp: 395,
  govt30yBp: 392,
  creditSpreadIgBp: 130,
  creditSpreadHyBp: 420,
  fundingStressBp: 10,
  equityIndex: 100,
  volIndex: 21,
  fxUsdLocal: 1,
  ownStock: 100,
  ownCdsBp: 0,
  custom: { kre: 100 },
}

export const svbInitialConfidence: ConfidenceState = {
  index: 72, // S0 평온이지만 우려 형성 (무디스 검토, 예금 추세 유출)
  depositors: 72,
  counterparties: 75,
  regulators: 55, // 감독 지적 31건 [fed-svb-review-2023]
  investors: 70,
  media: 70,
  board: 80,
}
