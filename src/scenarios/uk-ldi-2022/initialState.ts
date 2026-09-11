import type { ConfidenceState, MarketState, PensionState } from '../../engine/types'

/**
 * 노스브리지 연금스킴(Northbridge Pension Scheme) = 영국 DB 스킴 우주(PPF Purple Book 2022)를 £5bn 규모로
 * 양식화한 합성 스킴. 단위: £M. 대조표·보정 근거는 facts.ts / calibration.md 참조.
 * 시점: T0 = 2022-09-22 (목) — 미니예산 전날. 8/1 이후 30년 길트 +135bp는 이미 시가에 반영되어 있다.
 *
 * LDI 풀(pooled fund): 익스포저 4,200(PV01 7.56 £M/bp) · NAV 1,400(레버리지 3x) · 유동 담보 907(= 120bp).
 * 헤지비율 80% = 풀 PV01 7.56 / 부채 PV01 9.5. 직접보유 길트 600은 담보 예비(표시 헤지비율에 미포함, STYLIZED).
 */
export const ldiInitialPension: PensionState = {
  kind: 'pension',
  liabilities: { pv: 5000, modDuration: 19, discountRateBp: 380 },
  assets: {
    cash: 150,
    gilts: { marketValue: 600, bookValue: 680, modDuration: 18, hqlaLevel: 'L1', pledgedShare: 0 },
    corporateBonds: {
      marketValue: 1000,
      bookValue: 1080,
      modDuration: 7,
      hqlaLevel: 'L2A',
      pledgedShare: 0,
    },
    equities: 1000,
    illiquid: 750,
    ldi: {
      exposure: 4200,
      equity: 1400,
      modDuration: 18,
      collateral: { cash: 300, eligibleGilts: 607 },
      marginCallOutstanding: 0,
      repoRateBp: 230,
    },
  },
  hedgeRatio: 0.8,
  sponsor: { covenant: 'medium', contributionCapacity: 300 },
  custom: {},
}

export const ldiInitialMarket: MarketState = {
  policyRateBp: 225, // 9/22 MPC +50bp [boe-mpc-2022-09-22]
  govt2yBp: 350,
  govt10yBp: 350,
  govt30yBp: 380, // 9/22 종가 ≈3.8% [STYLIZED]
  creditSpreadIgBp: 210,
  creditSpreadHyBp: 650,
  fundingStressBp: 15,
  equityIndex: 100,
  volIndex: 27,
  fxUsdLocal: 0.89, // GBP per USD (GBPUSD ≈1.125)
  ownStock: 100, // 해당 없음
  ownCdsBp: 0,
  custom: {},
}

export const ldiInitialConfidence: ConfidenceState = {
  index: 70, // S0 하단: 8/1 이후 +135bp, 재정 이벤트 경계
  depositors: 70, // 가입자
  counterparties: 75, // LDI 운용사·레포 은행
  regulators: 70, // TPR
  investors: 70, // 스폰서
  media: 65,
  board: 75, // 수탁자 이사회
}
