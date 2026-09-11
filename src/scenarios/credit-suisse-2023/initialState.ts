import type { CentralBankState, ConfidenceState, MarketState } from '../../engine/types'

/**
 * 스위스 금융당국 = FINMA + 스위스국립은행(SNB) + 연방재무부를 하나의 정책 주체로 합성한 상태.
 * 기관은 실재하므로 합성 이름을 쓰지 않는다 — 다만 **모든 대사는 기록에 기초한 개연성 있는 재구성이며
 * 녹취·속기록의 인용이 아니다**(turnsA.ts 상단 주석과 calibration.md §9 참조).
 *
 * 단위: 십억 스위스프랑(CHF 1e9). 시점: T0 = 2023-03-14 08:00 CET, 수치는 2023-03-13 종가 기준.
 *
 * ── `CentralBankState`를 이 사건에 맞게 쓰는 규약 (전부 여기 적는다) ──
 * 엔진에는 `central_bank` 전용 공유 fx 모듈이 없고 상태 타입은 1997년 외환위기형(보유액·외채)이다.
 * 2023년 취리히의 주말은 **당국의 공여 여력**과 **한 은행의 유동성**이 마주 보는 구조이므로, 필드를
 * 아래와 같이 재해석해서 쓴다. 재해석은 전부 facts.ts와 calibration.md §2에 표로 남긴다.
 *
 *   reserves.gross              법적으로 동원 가능한 SNB 유동성 지원 총한도
 *                               통상법상 ELA + EFF 50 → 긴급명령 제정 시 250(ELA·EFF 50 + ELA+ 100 + PLB 100)
 *   reserves.usable             그중 **적격담보로 실제 뒷받침되는 즉시 공여 여력**
 *   reserves.forwardCommitments 연방정부가 떠안은 보증 노출(PLB 이행보증 + 손실보전 보증)
 *   external.shortTermDebt      CS의 유출 가능 부채(고객예금 잔액)
 *   external.totalDebt          CS 총부채
 *   external.monthlyImports     CS의 30일 스트레스 순유출(LCR 분모) — `importCoverMonths`가
 *                               "공여 여력 / LCR 스트레스 순유출" 배수가 된다
 *   external.broadMoneyUsd      CS 운용자산(AuM)
 *   external.annualExportsUsd   스위스 명목 GDP (규모 감각용; 지표 계산에는 imfAra에만 쓰인다)
 *   fx.spot                     미달러/스위스프랑
 *   policy.rateBp               SNB 정책금리
 *   bankingSystem.liquiditySupport  SNB 유동성 지원 누계(= custom.supportDrawn)
 *   sovereign.spreadBp          스위스 연방정부 5년 CDS (보증을 떠안을수록 벌어진다)
 *   imf.*                       쓰지 않는다(0 고정) — 지표에는 나오지만 KPI로 노출하지 않는다
 *
 * 분모가 0이면 지표가 NaN이 되고 상태 직렬화에 null이 섞이므로, `external.*` 네 필드는 어떤 경로에서도
 * 0이 되지 않는다(cs.test.ts가 확인한다).
 */
export const csInitialAuthority: CentralBankState = {
  kind: 'central_bank',
  reserves: {
    gross: 50, // 통상법상 ELA + EFF 한도 [finma-cs-report-2023]
    usable: 50, // 적격담보로 뒷받침되는 즉시 공여 여력 [CAL]
    forwardCommitments: 0, // 연방 보증 노출 — 3/14에는 없다
  },
  external: {
    shortTermDebt: 233, // CS 그룹 고객예금 잔액 233,235백만 (2022-12-31) [cs-ar-2022]
    totalDebt: 486, // CS 그룹 총부채 486,027백만 (총자산 531,358 − 총자본 45,331) [cs-ar-2022]
    monthlyImports: 91, // CS 30일 스트레스 순유출(LCR 모형) [finma-cs-report-2023]
    broadMoneyUsd: 1294, // CS 운용자산(AuM) 2022년 말 [cs-4q22-earnings]
    annualExportsUsd: 781, // 스위스 명목 GDP 2022 = 781,460백만 (BFS 1995~2022년판) [bfs-gdp-2022]
  },
  fx: {
    spot: 0.91, // 미달러/스위스프랑 0.9118 (2023-03-13) [fred-dexszus]
    regime: 'float',
    interventionToday: 0,
  },
  policy: { rateBp: 100 }, // SNB 정책금리 1.00% (2022-12-15 결정, 12-16 적용) [snb-mpa-2022-2023]
  bankingSystem: {
    npls: 0, // 이 시나리오는 부실여신을 모형화하지 않는다 [STYLIZED]
    capitalShortfall: 0, // 3/14 시점 CS는 규제 자본요건을 충족한다 [finma-cs-report-2023]
    liquiditySupport: 0, // SNB 지원 누계
    failedBanks: 0, // 정리된 시스템적 중요 은행 수
    distressedBanks: 1, // 크레디트스위스 [CAL]
  },
  sovereign: { debtToGdpPct: 24.5, spreadBp: 15, rating: 'AAA' }, // 마스트리흐트 기준 2022년 24.55% [efv-schuldenquote]; spreadBp는 [STYLIZED]
  imf: { stage: 'none', committed: 0, disbursed: 0 }, // 사용하지 않음 [STYLIZED]
  custom: {
    // ── 크레디트스위스 쪽 상태 (당국 대시보드에 보이는 숫자) ──
    csLiquidity: 38, // 즉시 결제 가능 유동성(현금·중앙은행 예치·즉시 현금화 가능 담보) [CAL]
    csDeposits: 233, // 고객예금 잔액 233,235백만 [cs-ar-2022]
    csCdsBp: 450, // CS 5년 선순위 CDS (2023-03-13) [VERIFY]
    csCet1Pct: 14.1, // CET1 비율 (2022-12-31) [cs-4q22-earnings]
    csAt1Nominal: 16, // AT1 명목 잔액 [finma-pr-2023-03-19]
    // ── 흐름·누계 ──
    dailyOutflow: 1.6, // 3/13 고객자금 유출 [finma-cs-report-2023]
    cumulativeOutflow: 1.6, // 3/13부터의 누계
    supportDrawn: 0, // SNB 유동성 지원 누계
    federalGuarantee: 0, // 연방정부 보증 노출
    // ── 주말의 결과물 ──
    at1WrittenOff: 0, // AT1 상각액
    shareholderConsideration: 0, // 주주에게 지급된 대가
    mondayCashRequirement: 0, // 월요일 개장에 필요한 현금 (주말 턴에서 설정)
  },
}

export const csInitialMarket: MarketState = {
  policyRateBp: 100, // SNB 정책금리 1.00% (2022-12-15 결정) [snb-mpa-2022-2023]
  govt2yBp: 403, // 미 국채 2년 4.03% (2023-03-13) [fred-dgs]
  govt10yBp: 355, // 미 국채 10년 3.55% [fred-dgs]
  govt30yBp: 370, // 미 국채 30년 3.70% [fred-dgs]
  creditSpreadIgBp: 214, // Baa 5.69% − 10년 3.55% = 214bp [fred-dbaa, fred-dgs]
  creditSpreadHyBp: 500, // 하이일드 스프레드 — 표시 전용 [STYLIZED]
  fundingStressBp: 45, // 달러 조달 스트레스 프록시 — 표시 전용 [STYLIZED]
  equityIndex: 100, // 유럽 은행 주가지수, 2023-03-13 종가 = 100 [STYLIZED]
  volIndex: 26.52, // VIX 종가 (2023-03-13) [fred-dgs]
  fxUsdLocal: 0.91, // 미달러/스위스프랑 0.9118 (2023-03-13) [fred-dexszus]
  ownStock: 100, // 크레디트스위스 주가지수, 2023-03-13 종가 = 100 [CAL]
  ownCdsBp: 450, // CS 5년 선순위 CDS [VERIFY]
  custom: {},
}

/**
 * 신뢰지수 42 = S2(공개 런). 3월 14일 아침의 크레디트스위스는 이미 2022년 4분기에 예금 1,380억 프랑을
 * 잃은 은행이고, 같은 주에 미국에서 두 은행이 문을 닫았으며, 오늘 아침 연차보고서가 내부통제 중대
 * 결함을 공시했다. 평온(S0)도 우려(S1)도 아니다. [CAL]
 */
export const csInitialConfidence: ConfidenceState = {
  index: 42,
  depositors: 40, // 예금자·자산관리 고객
  counterparties: 38, // 거래상대방·청산기관 — 담보 요구와 한도 축소로 나타난다
  regulators: 55, // 해외 감독당국(연준·영국 PRA·ECB·SRB)
  investors: 35, // 주주·AT1 보유자
  media: 35,
  board: 50, // 연방평의회·의회
}
