import type { CentralBankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 2011년 금융당국 = 금융위원회 + 금융감독원 + 예금보험공사를 하나의 정책 주체로 합성한 상태.
 * 기관은 실재하므로 합성 이름을 쓰지 않는다 — 개인의 발언만 재구성이다(turnsA.ts 상단 주석 참조).
 *
 * 단위: 조원(KRW 1e12). 시점: T0 = 2011-02-14 (월), 수치는 2011-01말·2010-12말 기준.
 *
 * ── 이 시나리오의 상태 설계에서 가장 중요한 세 값 ──
 *   custom.depBusan  부산저축은행 계열 5개사의 수신 6.5조 — "먼저 정지하면 다음이 생기는" 무리
 *   custom.depPeer   BIS 5% 미만 등 취약 저축은행 수신 11.2조
 *   reserves.usable  예금보험기금 저축은행계정이 오늘 쓸 수 있는 돈 4.8조
 *
 * 세 값의 관계가 이 시나리오의 상충 전부다. 계열을 나눠 정지하면 남은 계열사로 인출이 옮겨 가고(fx.ts),
 * 옮겨 간 인출은 다음 정지를 부르며, 정지는 저축은행계정에서 돈을 꺼낸다. 계정이 마르면 게임이 끝난다.
 *
 * `CentralBankState`의 필드 재해석은 fx.ts 상단의 매핑 표를 그대로 따른다.
 */
export const sbInitialAuthority: CentralBankState = {
  kind: 'central_bank',
  reserves: {
    // 예금보험기금 저축은행계정이 즉시 동원할 수 있는 재원(잔여 + 예보채 발행·계정 간 차입 여력) [CAL]
    usable: 4.8,
    // 예금보험기금 전 계정 합계 [CAL]
    gross: 11.5,
    // 삼화저축은행(2011-01-14 영업정지) 정리와 관련해 이미 확정된 소요 [CAL]
    forwardCommitments: 0.9,
  },
  external: {
    // 향후 1년 내 예상 정리소요액 → guidottiRatio = 정리재원 커버리지(= 4.8/12.0 = 40%) [CAL]
    shortTermDebt: 12.0,
    // 정리 대상이 될 수 있는 저축은행의 총자산 합계 [CAL]
    totalDebt: 24.0,
    // 월평균 예금대지급 소요 → importCoverMonths = 재원 커버 개월 [CAL]
    monthlyImports: 0.55,
    // 상호저축은행 업권 총수신(2011-01말) [ecos-111Y007]
    broadMoneyUsd: 74.4,
    // 상호저축은행 업권 총여신 [CAL]
    annualExportsUsd: 62.0,
  },
  fx: {
    spot: 1122.8, // 원/달러 종가 2011-02-14 [ecos-731Y003]
    regime: 'float',
    interventionToday: 0,
  },
  policy: { rateBp: 275 }, // 한국은행 기준금리 2.75% (2011-01-13 인상) [ecos-722Y001]
  bankingSystem: {
    npls: 6.2, // 업권 고정이하여신 [CAL]
    capitalShortfall: 2.4, // 부실 징후 저축은행의 자본부족 추정 [CAL]
    liquiditySupport: 0.9, // 삼화 정리 관련 기집행 [CAL]
    failedBanks: 1, // 삼화저축은행 (2011-01-14) [fsc-69735]
    distressedBanks: 20, // BIS 5% 미만 등 부실 징후 [CAL]
  },
  sovereign: {
    debtToGdpPct: 33.4, // 2010년말 국가채무/GDP (당시 GDP 계열) [mosf-national-debt-2011] 표시용
    spreadBp: 78, // 회사채 AA− 3년 4.75% − 국고채 3년 3.97% (2011-02-14) [ecos-817Y002]
    rating: 'A',
  },
  imf: { stage: 'none', committed: 0, disbursed: 0 }, // 구조조정 특별계정: 아직 법이 없다
  custom: {
    // ── 예금 무리(fx.ts의 전염 모형이 읽는 세 값) ──
    depBusan: 6.5, // 부산저축은행 계열 5개사 [CAL, VERIFY]
    depPeer: 11.2, // BIS 5% 미만 등 취약 저축은행 [CAL]
    depSound: 55.85, // 나머지 저축은행 [CAL]
    depFrozen: 0.85, // 삼화저축은행 영업정지로 묶인 예금 [CAL]
    depositsSector: 73.55, // 영업 중 저축은행 수신 합계 = 74.4 − 0.85 [ecos-111Y007, CAL]
    // ── 인출 ──
    depositOutflowCum: 0,
    outflowToday: 0,
    outflowBusan: 0,
    outflowPeer: 0,
    outflowSound: 0,
    busanRateToday: 0,
    // ── 정리 ──
    excessDeposits: 0, // 영업정지 기관의 5천만원 초과 예금 누계
    subDebt: 0, // 영업정지 기관의 후순위채 누계
    supportCum: 0, // 예금보험기금 저축은행계정 투입 누계
    suspendedBanks: 1,
    specialAccountTn: 0,
    forbearanceCount: 0,
    // ── 백스톱 ──
    backstopTotal: 0,
    backstopRemaining: 0,
    backstopDrawn: 0,
    // ── 표시용(플레이어가 통제하지 않는 업권 지표) ──
    pfLoans: 12.5, // PF대출 12.5조 (2009-12말, 91개사) [fsc-brief-2010-06-25]
    pfDelinqPct: 25.1, // PF대출 연체율 25.1% (2010-12말) [fsb-50years]
    spillBusan: 1,
    spillPeer: 1,
    // bankingSystem·external의 표시용 사본 (fx.ts sync가 유지한다)
    capitalShortfall: 2.4,
    resolutionNeed: 12.0,
  },
}

export const sbInitialMarket: MarketState = {
  policyRateBp: 275, // 한국은행 기준금리 2.75% [ecos-722Y001]
  // 국고채 2년 계열은 2021-03-10부터라 2011년에는 존재하지 않는다 — 국고채 1년 3.39%로 대체 [ecos-817Y002]
  govt2yBp: 339,
  govt10yBp: 483, // 국고채 10년 4.83% [ecos-817Y002]
  // 국고채 30년 계열은 2012-09-11부터다 — 국고채 20년 4.93%로 대체 [ecos-817Y002]
  govt30yBp: 493,
  creditSpreadIgBp: 78, // 회사채 AA− 3년 4.75% − 국고채 3년 3.97% [CAL, ecos-817Y002]
  creditSpreadHyBp: 680, // 회사채 BBB− 3년 10.77% − 국고채 3년 3.97% [CAL, ecos-817Y002]
  fundingStressBp: 16, // CP(91일) 3.29% − CD(91일) 3.13% [CAL, ecos-817Y002]
  equityIndex: 2014.59, // KOSPI 2011-02-14 종가 [ecos-802Y001]
  volIndex: 20, // VKOSPI [VERIFY — ECOS에 없고 KRX getJsonData.cmd는 LOGOUT 반환; KRX [13103] CSV로 닫는다]
  fxUsdLocal: 1122.8, // 원/달러 종가(15:30) [ecos-731Y003]
  ownStock: 100, // 정책당국 역할에는 의미 없음 [STYLIZED]
  ownCdsBp: 0,
  custom: {
    govt3y: 397, // 국고채 3년 3.97% (2011-02-14 종가, bp 반올림) [ecos-817Y002] — 틱 턴 티커 경로
    corpAa3y: 475, // 회사채 AA− 3년 4.75% [ecos-817Y002]
    cd91: 313, // CD(91일) 3.13% [ecos-817Y002]
  },
}

export const sbInitialConfidence: ConfidenceState = {
  index: 56, // S1 우려: 삼화 정지 한 달 뒤, 계열 실사 결과가 아직 공개되지 않은 상태 [CAL]
  depositors: 52, // 저축은행 예금자 — 5천만원 초과 예금의 인식 격차가 이미 시작되었다 [CAL]
  counterparties: 60, // 저축은행중앙회·은행권·증권금융 [CAL]
  regulators: 55, // 감사원·국회 — 2010년 검사에서 부실을 적발하지 못했다는 문제 제기 [CAL]
  investors: 62, // 후순위채 투자자·시장 [CAL]
  media: 44,
  board: 55, // 국무총리실·청와대 [CAL]
}
