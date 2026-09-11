import type { CentralBankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 대한민국 외환당국 = 재정경제원 + 한국은행을 하나의 정책 주체로 합성한 상태.
 * 기관은 실재하므로 합성 이름을 쓰지 않는다(개인의 발언만 재구성이다 — turnsA.ts 상단 주석 참조).
 *
 * 단위: 억달러(USD 1e8). 시점: T0 = 1997-10-22 (수), 수치는 1997-10-21 기준.
 *
 * ── 이 시나리오의 상태 설계에서 가장 중요한 세 값 ──
 *   reserves.gross   총외환보유액 305.1 — 매월 공표되는 숫자
 *   reserves.usable  가용외환보유액 223.0 — 당국이 실제로 쓸 수 있는 숫자
 *   그 차이 82.1     국내은행 해외점포 예치금 등. 총액에는 들어가지만 꺼낼 수 없다.
 *
 * 개입은 이 둘을 서로 다른 속도로 줄인다(fx.ts SWAP_SHARE 참조): 현물 매도의 60%가 스왑·차입으로
 * 조달되었기 때문에 총액은 개입액의 40%만 줄고 가용은 전액 줄었다. 그래서 10~11월에 약 151억달러를
 * 쓰는 동안 공표 보유액은 305 → 244로 61억 줄었을 뿐이지만 가용은 223 → 72.6으로 무너졌다.
 * 대시보드가 두 숫자를 나란히 보여 주는 이유가 이것이다.
 */
export const imfInitialCentralBank: CentralBankState = {
  kind: 'central_bank',
  reserves: {
    gross: 305.1, // 총외환보유액 (10월말 확정 305.09) [ecos-732Y001, CAL: 월말→10/21]
    usable: 223.0, // 가용외환보유액 — 공표 계열 없음 [nars-fx-crisis-hearing-1999, VERIFY]
    forwardCommitments: 30.0, // 선물환 매도·스왑 미결제 잔액 [CAL]
  },
  external: {
    shortTermDebt: 900.0, // 총외채 1,530 × 58.8% [mofe-external-debt-1997]
    totalDebt: 1530.0,
    monthlyImports: 120.5, // 1997년 수입(CIF) 1,446.16 / 12 [ecos-trade-1997]
    broadMoneyUsd: 5419.0, // M2 말잔 500.9조 ÷ 924.4 — ARA 지표 분모 [ecos-101Y002, CAL]
    annualExportsUsd: 1361.0, // 1997년 수출(FOB) 1,361.64 [ecos-trade-1997]
  },
  fx: {
    spot: 924.4, // 1997-10-21 종가 [ecos-731Y003]
    regime: 'managed',
    bandPct: 2.25, // 시장평균환율제 일일변동폭 ±2.25%
    interventionToday: 0,
  },
  policy: { rateBp: 1275 }, // 콜금리(1일, 전체거래) 12.75% [ecos-817Y002]
  bankingSystem: {
    npls: 320.0, // 금융기관 부실여신(달러 환산 근사) [CAL]
    capitalShortfall: 90.0, // [CAL]
    liquiditySupport: 0, // 한은 외화 유동성 공급 누계
    failedBanks: 0, // 업무정지·퇴출 종금사 수
    distressedBanks: 12, // 부실 징후 종금사(전체 30개 중) [CAL]
  },
  sovereign: { debtToGdpPct: 11.9, spreadBp: 130, rating: 'AA-' },
  imf: { stage: 'none', committed: 0, disbursed: 0 },
  custom: {
    // 대시보드 표시용 사본 — fx.ts의 sync()가 모든 효과 뒤에 동기화한다.
    grossReserves: 305.1,
    reserveGap: 82.1, // 총액 − 가용 = 국내은행 해외점포 예치금 등 사용 불가분
    forwardCommitments: 30.0,
    stDebtDue30d: 85.0, // 1개월 내 만기 도래 단기외채 [CAL]
    rolloverRatePct: 92.0, // 단기외채 만기연장 비율 [CAL]
    merchantBankFxDebt: 200.0, // 종금사 외화조달 잔액 [mofe-external-debt-1997]
    interventionCumulative: 0,
  },
}

export const imfInitialMarket: MarketState = {
  policyRateBp: 1275,
  govt2yBp: 1245, // 회사채 3년 AA− 유통수익률 12.45%로 대체 표시 [ecos-817Y002]
  govt10yBp: 1250, // [STYLIZED]
  govt30yBp: 1250, // [STYLIZED]
  creditSpreadIgBp: 250, // [STYLIZED]
  creditSpreadHyBp: 700, // [STYLIZED]
  fundingStressBp: 150, // 국내은행 외화 단기조달 가산금리 [STYLIZED]
  equityIndex: 566.85, // KOSPI 1997-10-21 종가 [ecos-802Y001]
  volIndex: 35, // 당시 변동성 지수는 없었다 [STYLIZED]
  fxUsdLocal: 924.4, // institution.fx.spot의 표시 사본
  ownStock: 100, // 중앙은행 역할에는 의미 없음 [STYLIZED]
  ownCdsBp: 130, // 1997년에는 국가 CDS가 없었다 — 한국물 가산금리 프록시 [STYLIZED]
  custom: {},
}

export const imfInitialConfidence: ConfidenceState = {
  index: 60, // S1 우려: 기아 사태·종금사 부실, 태국·인도네시아 전염 [CAL]
  depositors: 58, // 국내 예금자·국민
  counterparties: 48, // 외국 채권은행 — 롤오버 의사의 대리 지표 [CAL]
  regulators: 60, // IMF·미 재무부 등 대외 정책 카운터파트
  investors: 50, // 외국인 주식·채권 투자자
  media: 45,
  board: 55, // 청와대·국회
}
