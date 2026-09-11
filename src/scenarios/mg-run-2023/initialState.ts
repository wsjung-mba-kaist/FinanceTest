import type { BankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 상호금융 중앙회(가상) = 새마을금고중앙회 + 1,293개 지역금고를 하나의 수신기관으로 합성.
 * 단위: 조원. 시점: T0 = 2023-07-04 (수치는 2023-06-29 잠정치 [mg-joint-briefing-2023], 6말 확정치 [fsc-80662]).
 *
 * 유동성 배분 [CAL]: 현금성자산 77.3조 = 즉시 가용 현금·예치금 17.3 + 국고채·통안채 40(AFS, L1) + 은행채·기타 20(HTM, L2A).
 * 가용현금 = 상환준비금 13.36 + 17.3 = 30.66 → 30.7. 은행 RP 라인은 7/10~11에야 체결되었으므로 T0 담보차입 여력 = 0.
 * 자본: 순자본비율 8.29% × 총자산 290.7 = 24.1 (순자본비율 = 순자본/총자산 근사 [STYLIZED]).
 * 주의: 상환준비금 13.36조와 현금성자산 77.3조의 포함 관계는 정부 문서 두 건(행안부 7/5 보도자료 vs 7/6 브리핑)이
 * 서로 다르게 말한다. 게임은 비중복으로 잡았다 — calibration.md §8 참조.
 */
export const mgInitialBank: BankState = {
  kind: 'bank',
  cash: 30.7, // 상환준비금 13.36 + 즉시 가용 현금·예치금 17.3 [CAL]
  securities: {
    afs: { marketValue: 40, bookValue: 40.8, modDuration: 2.5, hqlaLevel: 'L1', pledgedShare: 0 }, // 국고채·통안채 [CAL]
    htm: { marketValue: 20, bookValue: 20.6, modDuration: 3.0, hqlaLevel: 'L2A', pledgedShare: 0 }, // 은행채·기타 [CAL]
  },
  loans: {
    retail: 85, // 가계대출 [STYLIZED]
    sme: 55, // 기타 기업대출 [STYLIZED]
    corporate: 56.4, // 건설·부동산 대출 (2023.1월말, 행안부→오영환 의원실 제출자료) [STYLIZED]
    fi: 0,
    nonPerforming: 12.16, // 연체액(6/29) [mg-joint-briefing-2023]
    avgDuration: 2.5,
  },
  otherAssets: 3.6, // plug (A = L + E)
  deposits: [
    {
      id: 'd1',
      label: '5천만원 이하 보호 예금 (개인·창구 중심)',
      balance: 195, // ≈75% [STYLIZED]
      insured: true,
      runoffByState: [0.001, 0.0036, 0.0043, 0.02],
      dailyCap: 0.03, // 창구·ATM 상한 [CAL]
      lcrCategory: 'retailStable',
    },
    {
      id: 'd2',
      label: '5천만원 초과 개인 예금',
      balance: 40, // ≈15% [STYLIZED]
      insured: false,
      runoffByState: [0.003, 0.0072, 0.0085, 0.08],
      lcrCategory: 'retailLessStable',
    },
    {
      id: 'd3',
      label: '부실 우려 금고(특별검사·점검 대상 100개) 예금',
      balance: 12, // [STYLIZED]
      insured: false,
      runoffByState: [0.005, 0.016, 0.02, 0.2],
      lcrCategory: 'retailLessStable',
    },
    {
      id: 'd4',
      label: '법인·단체·공공 예금',
      balance: 12.6, // plug → 합계 259.6 [STYLIZED]
      insured: false,
      runoffByState: [0.002, 0.0052, 0.007, 0.06],
      lcrCategory: 'corporateUninsured',
    },
  ],
  wholesale: {
    unsecuredShort: 0,
    unsecuredLong: 0,
    repoL1: 0,
    repoL2A: 0,
    repoOther: 0,
    cbAdvances: 0,
    cbFacilityCapacity: 0, // 은행 RP 라인 미체결, 한은 RP 대상기관 아님 [bok-omo-2022-10-27]
    cbFacilityPending: 0,
  },
  committed: { creditToCorporates: 0, liquidityToFIs: 0 }, // 중앙회↔금고 내부 약정은 합성 기관 내부 [STYLIZED]
  otherLiabilities: 7.0, // plug (A = L + E)
  capital: { cet1: 24.1, at1: 0, tier2: 0, aociInCet1: true }, // 순자본 [CAL]
  rwa: 290.7, // 순자본비율 8.29% = 순자본/총자산 근사 [STYLIZED]
  leverageExposure: 290.7, // 총자산 [fsc-80662]
  fireSaleDiscount: 0.01, // 국고채 5조 블록 매도 ≈1% [CAL]
  taxRate: 0.2, // [STYLIZED]
  htmTainted: false,
  custom: {
    delinquencyRate: 6.18, // 연체율(6/29 잠정) [mg-joint-briefing-2023]
    depositorProtectionFund: 2.6, // 예금자보호준비금 [mg-joint-briefing-2023]
    minimumCash: 0,
  },
}

export const mgInitialMarket: MarketState = {
  policyRateBp: 350, // 한은 기준금리 3.50% [bok-base-rate-2023]
  govt2yBp: 368, // 국고채 2년 3.676% (3년은 3.619%) [ecos-817Y002]
  govt10yBp: 362, // 국고채 10년 3.623% [ecos-817Y002]
  govt30yBp: 363, // 국고채 30년 3.625% [ecos-817Y002]
  creditSpreadIgBp: 81, // 회사채 AA− 3y 4.429% − 국고 3y 3.619% [CAL, ecos-817Y002]
  creditSpreadHyBp: 720, // 회사채 BBB− 3y 10.817% − 국고 3y 3.619% [CAL, ecos-817Y002]
  fundingStressBp: 19, // CD91 3.74% − 통안 91일 3.552% [CAL, ecos-817Y002]
  equityIndex: 100, // KOSPI 정규화 [STYLIZED]
  volIndex: 14, // VKOSPI [VERIFY — KRX 정보데이터시스템 [13103] 일별시세 미조회]
  fxUsdLocal: 1301, // 원/달러 종가(15:30) 1,301.4원 [ecos-731Y003]
  ownStock: 100, // 비상장 — 사용하지 않음 [STYLIZED]
  ownCdsBp: 0,
  custom: {
    govt3y: 362, // 국고채 3년 3.619% (7/4 종가, bp 반올림) [ecos-817Y002] — 틱 턴 티커 경로
  },
}

export const mgInitialConfidence: ConfidenceState = {
  index: 58, // S1 우려: 연체율 급등 보도·특별점검 발표 [CAL]
  depositors: 58,
  counterparties: 70,
  regulators: 50, // 행안부 단독 감독·감사원 미감사 [CAL]
  investors: 65,
  media: 50,
  board: 65,
}
