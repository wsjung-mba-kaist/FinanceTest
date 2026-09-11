import type { ConfidenceState, MarketState, PrimeBrokerState } from '../../engine/types'

/**
 * 알파인은행 프라임서비스(Alpine Bank Prime) = 2021년 3월 아케고스에 익스포저를 가지고 있던
 * 프라임브로커를 양식화한 **합성 사업부**. 1차적으로 크레디트스위스 프라임서비스를 모델로 하며
 * (마진 수준·한도 운용·초과담보 반환·늦은 청산), 「기다린 은행」의 결과는 노무라의 경로를 참고한다.
 * 고객(아케고스 캐피털 매니지먼트)과 다른 프라임브로커들은 실명이며 기록된 사실만 사용한다.
 *
 * 단위: USD $B (`units.scale = 1e9`). 대조표·보정 근거는 facts.ts / calibration.md 참조.
 * 시점: **T0 = 2020년 4월 1일** — 잠재익스포저(PE) 한도가 10배 초과된 것이 처음 보고된 달.
 * 이때 알파인의 책은 $3bn이다. 위기 당일의 $20bn은 주어진 것이 아니라 프롤로그 두 턴의
 * 선택으로 만들어진다(`counters.bookScale`).
 *
 * 집중도 회계 규약 (calibration.md §1)
 * - `positions[].notional` = 현재 시가 기준 명목(TRS 기초자산 평가액).
 *   항상 `BASE_NOTIONAL × counters.bookScale × (1 − 청산비율) × markIndex/100`으로 재계산된다.
 * - `positions[].advNotional` = 일평균거래대금($B, 한도와 무관하게 고정).
 *   청산 소요일 = 명목 / (ADV × 20% 참여율) — 엔진 `computePbExposure`의 기본 참여율.
 *   **정적 마진율이 아니라 이 일수가 실제 위험의 단위다.**
 * - `clients[0].marginPosted` = 정산 담보, `custom.excessCollateral` = 초과 담보.
 * - `custom.settledValue` = 담보가 마지막으로 정산된 시점의 책 평가액(= 디폴트 시 청구 기준).
 */
export const archegosInitialPb: PrimeBrokerState = {
  kind: 'prime_broker',
  firm: {
    // 프라임서비스 사업부에 배정된 리스크 자본(그룹 CET1이 아니다) [STYLIZED]
    capital: 8.0,
    liquidityPool: 24.0,
    realizedLoss: 0,
  },
  clients: [
    {
      id: 'archegos',
      name: '아케고스 캐피털 매니지먼트(Archegos Capital Management)',
      // 2020년 4월 명목 = 2021-03-22 기준 명목 × bookScale 0.15.
      positions: [
        { ticker: 'VIAC', notional: 0.75, dailyVolPct: 0.035, advNotional: 0.95, pctOfFloat: 1.05 },
        { ticker: 'DISCA', notional: 0.45, dailyVolPct: 0.032, advNotional: 0.42, pctOfFloat: 1.8 },
        { ticker: 'BIDU', notional: 0.675, dailyVolPct: 0.03, advNotional: 2.1, pctOfFloat: 0.3 },
        { ticker: 'GSX', notional: 0.3, dailyVolPct: 0.055, advNotional: 0.35, pctOfFloat: 1.65 },
        { ticker: 'TME', notional: 0.375, dailyVolPct: 0.038, advNotional: 0.45, pctOfFloat: 0.75 },
        { ticker: 'VIPS', notional: 0.45, dailyVolPct: 0.034, advNotional: 0.6, pctOfFloat: 0.6 },
      ],
      marginPosted: 0.225, // 3.0 × 7.5% 정적 마진
      marginPct: 0.075,
      creditLimit: 3.0,
      /** 고객이 **고지한** 타 프라임브로커 수. 실제 수는 알 수 없다 — 그것이 이 시나리오의 정보 결핍이다. */
      otherPbCount: 3,
    },
  ],
  marginPolicy: { staticMarginPct: 7.5, dynamicMargin: false, concentrationAddOn: false },
  custom: {
    /** 기초 종목 가중 마크 지수 (100 = 2021-03-22 종가). 프롤로그에서는 100으로 고정된다. */
    markIndex: 100,
    /** 마지막 담보 정산 시점의 책 평가액($B). 디폴트 손실의 청구 기준. */
    settledValue: 3.0,
    /** 미회수 익스포저 = settledValue − 현재 평가액 − 담보 ($B). */
    marginShortfall: 0,
    /** 미납 마진콜 잔액($B). */
    marginCallOutstanding: 0,
    /** 고객 앞으로 쌓인 초과 담보($B) — 2020년 상승분이 누적되어 T1에서 반환 요청 대상이 된다. */
    excessCollateral: 0,
    /** 승인된 잠재익스포저(PE) 한도($B) = $20m. */
    peLimit: 0.02,
    /** 현재 잠재익스포저($B) = $200m — 한도의 10배. */
    potentialExposure: 0.2,
    /** 보유 포지션 중 최대 유통주식 비중(%). */
    maxPctOfFloat: 1.8,
    /** 차순위 단일 헤지펀드 고객의 익스포저($B) — 집중도 비교 기준. */
    nextLargestClientExposure: 1.5,
    /** 이 고객에게서 얻는 연간 수수료 수입($B). */
    annualFeeRevenue: 0.018,
    /** 고객이 고지한 타 프라임브로커 수(= clients[0].otherPbCount의 표시용 사본). */
    knownOtherPbCount: 3,
    /** 업계 전체 추정 총익스포저($B) — 요구하기 전에는 알 수 없다(0). */
    industryExposure: 0,
    /** 업계 합산 손실($B). */
    industryLoss: 0,
    /** 공동 정리에서 이탈해 선매도한 타 프라임브로커 수. */
    pbDefectors: 0,
  },
}

export const archegosInitialMarket: MarketState = {
  policyRateBp: 25, // FOMC 목표범위 0~0.25% 상단 (2020-03-15 인하 이후)
  govt2yBp: 23, // 2020-04-01 DGS2 0.23% [fred-dgs10]
  govt10yBp: 62, // 2020-04-01 DGS10 0.62%
  govt30yBp: 127, // 2020-04-01 DGS30 1.27%
  creditSpreadIgBp: 303, // [VERIFY] 2020-04-01 IG OAS — FRED API 키로 BAMLC0A0CM 확정 필요
  creditSpreadHyBp: 880, // [VERIFY] 2020-04-01 HY OAS — FRED API 키로 BAMLH0A0HYM2 확정 필요
  fundingStressBp: 60,
  equityIndex: 100,
  volIndex: 57.06, // VIX 2020-04-01 종가 [fred-vixcls]
  fxUsdLocal: 1.0, // 기준 통화가 USD
  ownStock: 100, // 알파인은행 주가(지수, 100 = 2020-04-01)
  ownCdsBp: 95,
  custom: {
    // 기초 종목 지수 (100 = **2021-03-22 종가**). 프롤로그 두 턴에서는 표시·사용하지 않고,
    // T2 진입 시 100에서 출발해 3/23 이후의 실제 일별 경로를 따라간다.
    viac: 100,
    disca: 100,
    bidu: 100,
    gsx: 100,
    tme: 100,
    vips: 100,
    /** 알파인이 실제로 체결한 블록의 평균 할인(bp) — 자기 체결가에만 적용된다. */
    blockDiscountBp: 0,
  },
}

export const archegosInitialConfidence: ConfidenceState = {
  index: 72, // S0 평온: 2020년 4월의 프라임서비스는 수익성 좋은 성장 사업이었다
  depositors: 72, // 해당 없음(표시용)
  counterparties: 74, // 다른 프라임브로커·딜러
  regulators: 70, // Fed·PRA·FINMA
  investors: 75, // 주주
  media: 72,
  board: 76, // 그룹 리스크위원회·이사회
}

/** 초기 카운터: 책 배율 0.15 = 2021-03-22 기준 $20bn의 15%. */
export const archegosInitialCounters: Record<string, number> = {
  bookScale: 0.15,
  unwoundFraction: 0,
  liquidationProceeds: 0,
  soldToday: 0,
  dailySellCapPct: 100,
  peerBaseline: 0,
}
