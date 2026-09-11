import type { BankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 메리디언 브라더스(Meridian Brothers) = Lehman Brothers Holdings 2008-05-31 10-Q [lehman-10q-2q08] +
 * 2008-09-10 3분기 사전 공시 [lehman-8k-2008-09-10] 를 반올림·양식화한 합성 투자은행. 단위 $B. T0 = 2008-09-09(화).
 *
 * 엔진 매핑(BankState → 투자은행):
 *  - cash                 = 유동성 풀(지주 + 브로커딜러). 8-K 9/10의 $42B(추정). custom.encumberedInPool 은 그중
 *                           청산은행 담보·comfort deposit 으로 사실상 사용 불가한 부분 [valukas-report-2010].
 *  - securities.afs       = 유동 인벤토리(국채·기관채·투자등급·주식). 대부분 트라이파티 레포 담보로 예치(pledgedShare).
 *  - securities.htm       = 비유동 인벤토리(CRE $32.6B + 주택 $13.2B ≈ $46B). marketValue 는 "시장이 요구하는 추가 상각"
 *                           (aociInCet1=true 이므로 economicTce 에만 반영). 매각은 시나리오 fx.sellIlliquid 로만 처리.
 *  - loans                = 역레포·증권차입 매치드북(corporate) + 브로커·고객 미수금(fi). 유출 모델에는 쓰이지 않음.
 *  - deposits[]           = 도주 가능한 조달 세그먼트(PB 프리크레딧·헤지펀드 파생 담보·CP/MTN·기타 고객 예수금).
 *  - wholesale.repo*      = 트라이파티 레포 북(담보 품질별). cbFacilityCapacity = PDCF 적격 담보 여력(브로커딜러 한정).
 */
export const lehmanInitialBank: BankState = {
  kind: 'bank',
  cash: 42, // 유동성 풀 $42B(추정) [lehman-8k-2008-09-10]; Valukas: 9/10 "약 $41B" 공표
  securities: {
    afs: {
      marketValue: 190,
      bookValue: 190,
      modDuration: 3,
      hqlaLevel: 'L1',
      pledgedShare: 0.8, // 트라이파티 레포 담보 예치분 [STYLIZED]
    },
    htm: {
      marketValue: 38, // 시장 추정 추가 상각 −17% [CAL]
      bookValue: 46, // CRE 32.6 + 주택 13.2(pro forma) [lehman-8k-2008-09-10]
      modDuration: 5,
      hqlaLevel: 'none',
      pledgedShare: 0.5,
    },
  },
  loans: { retail: 0, sme: 0, corporate: 295, fi: 41, nonPerforming: 0, avgDuration: 0.1 },
  otherAssets: 26, // 영업권·IMD(뉴버거버먼) 등 plug
  deposits: [
    {
      id: 'd1',
      label: '프라임브로커리지 고객 프리크레딧 잔고(헤지펀드 현금)',
      balance: 25,
      insured: false,
      runoffByState: [0.005, 0.04, 0.12, 0.15],
      lcrCategory: 'financialInstitution',
      networked: true,
    },
    {
      id: 'd2',
      label: '헤지펀드 OTC 파생 담보·노베이션 대상 잔고',
      balance: 15,
      insured: false,
      runoffByState: [0, 0.02, 0.1, 0.12],
      lcrCategory: 'financialInstitution',
    },
    {
      id: 'd3',
      label: 'CP·MTN·은행 신용라인(무담보 도매, 만기 시 미갱신)',
      balance: 12,
      insured: false,
      runoffByState: [0.02, 0.08, 0.2, 0.22],
      lcrCategory: 'financialInstitution',
    },
    {
      id: 'd4',
      label: '기타 고객 지급채무(결제 대기·운영성)',
      balance: 28,
      insured: false,
      runoffByState: [0, 0.01, 0.03, 0.04],
      lcrCategory: 'other',
    },
  ],
  wholesale: {
    unsecuredShort: 0,
    unsecuredLong: 128, // 장기차입 $128.2B [lehman-10q-2q08]
    repoL1: 120, // 국채·기관채 담보 트라이파티 레포 [STYLIZED]
    repoL2A: 40, // 투자등급 회사채·주식 담보 [STYLIZED]
    repoOther: 25, // CMBS·비투자등급 담보 [STYLIZED]
    cbAdvances: 0,
    cbFacilityCapacity: 0, // PDCF 앞 사전 예치 담보 없음 [CAL]
    cbFacilityPending: 0,
  },
  committed: { creditToCorporates: 0, liquidityToFIs: 0 },
  otherLiabilities: 219, // 공매도 포지션 141.5 + 파생·기타 (plug, A = L + E)
  capital: { cet1: 20, at1: 8, tier2: 0, aociInCet1: true }, // 주주지분 28.4 = 보통주 ≈20 + 우선주 ≈8 [STYLIZED]
  rwa: 255, // Tier 1 ≈ 11.0% 역산 [lehman-8k-2008-09-10]
  leverageExposure: 640,
  fireSaleDiscount: 0.1, // 비유동 자산 5~15% [CAL]
  taxRate: 0, // 손실 세효과 미반영 [STYLIZED]
  htmTainted: true, // 투자은행 트레이딩 북은 시가평가 — ASC 320 tainting 규칙 미적용 [STYLIZED]
  custom: {
    minimumCash: 0,
    encumberedInPool: 7.5, // JPM 담보 ≈5.5 + 씨티 comfort deposit 2 [valukas-report-2010 Vol.4 p.1455]
    neubergerValue: 7, // 파산 전 제안가 [press-nb-carlyle-2008-09, VERIFY]
    repoRollRate: 100,
    repoBookStart: 185,
    clearingBankCalls: 0,
    spinCoSize: 30, // REI Global $25~30B [lehman-8k-2008-09-10]
  },
}

export const lehmanInitialMarket: MarketState = {
  policyRateBp: 200, // FF 목표 2.00% (2008-04-30 이후)
  govt2yBp: 223, // 2008-09-09 종가 2.23% [frb-h15-treasury-2008]
  govt10yBp: 362, // 2008-09-09 종가 3.62% [frb-h15-treasury-2008]
  govt30yBp: 420, // 2008-09-09 종가 4.20% [frb-h15-treasury-2008]
  creditSpreadIgBp: 300, // FRED API 키로 BAMLC0A0CM 2008-09-09 확정 필요 [VERIFY, facts.ts 주석 참조]
  creditSpreadHyBp: 850, // FRED API 키로 BAMLH0A0HYM2 2008-09-09 확정 필요 [VERIFY, facts.ts 주석 참조]
  fundingStressBp: 119, // TED 2008-09-09 1.19% [fred-tedrate-2008]; 10/10 458bp 정점 [fcic-report-2011]
  equityIndex: 100,
  volIndex: 25.5, // VIX 2008-09-09 종가 25.47 [cboe-vix-2008]
  fxUsdLocal: 1,
  ownStock: 100, // 9/8 종가 기준 지수
  ownCdsBp: 475, // 리먼 5y CDS 9/9 ≈475bp — Markit 일별 미공개 [VERIFY, facts.ts 주석 참조]
  custom: { tedBp: 119 },
}

export const lehmanInitialConfidence: ConfidenceState = {
  index: 58, // S1 우려: 6월 이후 지속 압박, 9/9 KDB 결렬·−45% [CAL]
  depositors: 55,
  counterparties: 52,
  regulators: 50,
  investors: 45,
  media: 45,
  board: 70,
}
