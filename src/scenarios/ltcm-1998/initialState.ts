import type { ConfidenceState, MarketState, PrimeBrokerState } from '../../engine/types'

/**
 * 해밀턴로스(Hamilton Ross & Co.) 프라임브로커리지·파생 부문 = 1998년 9월 LTCM 컨소시엄에 참여한
 * 월가 대형 딜러의 **합성 기관**. 주로 메릴린치(코어그룹 3사 중 하나이자 LTCM의 선물 청산 브로커,
 * $300M 분담)를 본뜨고, 코어그룹 운영은 골드만삭스·J.P.모건, 청산 대리인의 담보 회계는
 * 베어스턴스를 참고했다. 실명 기관의 내부 수치가 아니다 (calibration.md §0).
 *
 * 초기 시점 = **1998-08-14(금) 종가**. T0(8/17 러시아 모라토리엄)의 entryEffects가 그날의 값을 세운다.
 * 단위: $B (units.scale = 1e9). 대화의 출자 약속만 $M 카운터(`consortiumPledgeM`)로 받는다.
 *
 * 엔진 매핑(PrimeBrokerState → 1998년 딜러)
 *  - firm.capital        = 부문 배정 자본. 손실은 여기서 차감된다.
 *  - firm.liquidityPool  = 출자·담보 납입에 쓸 수 있는 즉시 가용 자금.
 *  - clients[0]          = LTCM 펀드. positions[]는 **우리와의 상품군별 총명목**이며 LTCM 전체
 *                          명목(≈$1.4T)의 일부다. 명목과 순익스포저의 자릿수 차이가 이 시나리오의 교훈이다.
 *  - marginPosted        = LTCM이 우리에게 예치한 담보. 1998년 관행대로 초기증거금은 0에서 시작한다.
 *  - otherPbCount        = **우리가 파악하고 있는** LTCM의 다른 거래상대 수. 실제(>75)는 모른다.
 *  - custom.*            = 대체원가·순익스포저·청산손실 추정·타 딜러 협조도 등 시나리오 지표.
 */
export const ltcmInitialPb: PrimeBrokerState = {
  kind: 'prime_broker',
  firm: {
    capital: 9, // 부문 배정 자본 $9B [STYLIZED]
    liquidityPool: 6.5, // 즉시 가용 자금 $6.5B [STYLIZED]
    realizedLoss: 0,
  },
  clients: [
    {
      id: 'ltcm',
      name: 'Long-Term Capital Portfolio, L.P.',
      positions: [
        // 총명목 96 = LTCM 전체 명목 ≈1,400의 약 7% [CAL]. dailyVolPct 는 8/14 기준(volMultiplier 1.0).
        { ticker: 'SWAPSPD', notional: 42, dailyVolPct: 0.0001, advNotional: 21 },
        { ticker: 'OFFRUN', notional: 26, dailyVolPct: 0.00009, advNotional: 18 },
        { ticker: 'EQVOL', notional: 14, dailyVolPct: 0.00032, advNotional: 6 },
        { ticker: 'EMSOV', notional: 9, dailyVolPct: 0.00052, advNotional: 3 },
        { ticker: 'RISKARB', notional: 5, dailyVolPct: 0.00035, advNotional: 2.5 },
      ],
      marginPosted: 0, // 8/14 기준 대체원가 0 → 예치 담보 0 [CAL]
      marginPct: 0, // 초기증거금 없음 (PWG: 경쟁 압력으로 헤어컷이 사라졌다)
      creditLimit: 120, // 총명목 한도 $120B [STYLIZED]
      otherPbCount: 8, // **우리가 아는** 다른 거래상대 수 (실제 >75) [CAL]
    },
  ],
  marginPolicy: { staticMarginPct: 0, dynamicMargin: false, concentrationAddOn: false },
  custom: {
    // ── LTCM 쪽 외생 사실 ─────────────────────────────────────────────
    ltcmCapitalB: 4.1, // 7/31 자본 $4.1B [pwg-hedge-funds-1999]
    ltcmLiquidityB: 1.6, // 담보 납입에 쓸 수 있는 LTCM의 잔여 현금(우리 추정) [CAL]
    ltcmPostMoneyB: 0, // 컨소시엄 인수 후 순자산(9/23 이전에는 0)
    ltcmAssetsB: 129, // '97말 총자산 $129B [pwg-hedge-funds-1999]
    ltcmNotionalB: 1400, // 8월말 명목 파생 ≈$1.4T (선물 >500 + 스왑 >750 + 옵션 >150)
    // ── 우리 익스포저 ─────────────────────────────────────────────────
    ourNotionalB: 96, // positions 합계(표시용 미러)
    replacementCostB: 0, // 순대체원가 = ourPv01B × (수렴지수 − 100)
    settledValueB: 0, // 담보가 마지막으로 정산된 시점의 대체원가
    netExposureB: 0, // max(0, 대체원가 − 담보)
    closeoutLossB: 0.18, // **자사 리스크 시스템의 추정** 청산 손실(군집계수는 아는 거래상대 수로 계산)
    crowdFactorEst: 1.35, // 1 + 0.05 × (아는 거래상대 8곳 − 1) [CAL]
    ourPv01B: 0.01, // 수렴지수 1포인트당 $10M [CAL]
    // ── 정보 결핍 ─────────────────────────────────────────────────────
    knownCounterpartyCount: 8, // otherPbCount 미러
    trueCounterpartyCount: 0, // 0 = 아직 모름. 정보 교환·연준 실사로만 채워진다
    aggregateLeverageKnown: 0, // 0/1
    // ── 타 딜러 ───────────────────────────────────────────────────────
    peerCooperation: 50, // 0~90. 정보 공유·회의 참석·선도적 출자로 오른다
    peerJoinCount: 0,
    consortiumTotalM: 0,
    pledgedCapitalB: 0,
    // ── 자사 수렴 북 ──────────────────────────────────────────────────
    ownConvergenceB: 18, // 자사 자기매매 수렴 포지션 명목 $18B [STYLIZED]
    ownPv01B: 0.004, // 수렴지수 1포인트당 $4M [CAL]
    ownConvergencePnlB: 0, // 누적 평가손익(음수 = 손실)
    ownMarkIdx: 100, // 자사 북을 마지막으로 마크한 수렴지수 (증분 마크의 기준점)
    // ── 진행 상태 ─────────────────────────────────────────────────────
    volMultiplier: 1, // 8/14 = 1.0
    unwoundFraction: 0,
    bookScale: 1,
    marginCalledB: 0, // 누적 추가 담보 청구액
    marginPaidB: 0, // 누적 납입액
  },
}

export const ltcmInitialMarket: MarketState = {
  policyRateBp: 550, // FF 목표 5.50% (1997-03-25 이후 불변)
  govt2yBp: 534, // 1998-08-14 종가 5.34% [frb-h15-treasury-1998]
  govt10yBp: 540, // 5.40%
  govt30yBp: 555, // 5.55%
  creditSpreadIgBp: 174, // Baa(7.14%) − 10년(5.40%) = 174bp [fred-moodys-baa-aaa-1998]
  creditSpreadHyBp: 374, // 투기등급 스프레드 — CGFS 12 Table A1 6 Jul~14 Aug 평균 332+42 [CAL]
  fundingStressBp: 79, // TED 0.79% [fred-tedrate-1998]
  equityIndex: 100, // S&P 500 지수화(8/14 = 100)
  volIndex: 34.34, // VIX 종가 [cboe-vix-1998]
  fxUsdLocal: 1,
  ownStock: 100,
  ownCdsBp: 0, // 1998년에는 단일 기업 CDS 시장이 형성되기 전 — 사용하지 않는다
  custom: {
    tedBp: 79,
    baaAaaBp: 62, // Baa(7.14) − Aaa(6.52) 품질 스프레드 [fred-moodys-baa-aaa-1998]
    convergenceIdx: 100, // 수렴 스프레드 종합지수(8/14 = 100) [STYLIZED 합성지수]
    swapSpread10yBp: 57, // 10년 스왑 스프레드 — CGFS 12 Table A1 6 Jul~14 Aug 평균 51+6 [CAL]
    onOffRun10yBp: 9, // 10년 온·오프더런 유동성 스프레드 — CGFS 12 Table A6 미국 행 [CAL]
  },
}

export const ltcmInitialConfidence: ConfidenceState = {
  index: 72, // S0 평온: 8/14는 아직 위기 전이다 [CAL]
  depositors: 70,
  counterparties: 70,
  regulators: 75,
  investors: 72,
  media: 75,
  board: 78,
}
