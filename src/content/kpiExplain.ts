/**
 * 지표 설명 — "왜 중요한가 / 어떻게 계산하는가 / 무엇을 함께 볼 것인가".
 *
 * 대시보드 KPI 타일의 `?`와 도움 시트의 `지표 설명` 탭이 이 맵을 읽는다.
 * 표시 우선순위: `KpiSpec.description` → `KPI_EXPLAIN[metric]` → `MetricValue.detail`.
 *
 * 작성 기준
 * - `why`는 실무자가 이 숫자를 보고 **바꿔야 할 판단**을 1~2문장으로 적는다(정의 반복 금지).
 * - `formula`는 `src/metrics/*`가 실제로 계산하는 식을 그대로 적는다.
 * - `cards`는 `src/content/cards/`의 실재 id, `sourceRef`는 `src/content/sources.ts`의 실재 id만 쓴다.
 */
export interface KpiExplain {
  /** 이 숫자가 바꿔야 할 판단. */
  why: string
  /** 실제 계산식. */
  formula?: string
  /** 관련 지식카드 id. */
  cards?: string[]
  /** 대표 출처 id. */
  sourceRef?: string
}

export const KPI_EXPLAIN: Record<string, KpiExplain> = {
  // ─────────────────────────── 공통 ───────────────────────────
  confidence: {
    why: '런 상태(S0~S3)와 유출 계수를 구동하는 선행 변수다. 60 아래로 내려가면 유출률이 계단식으로 뛰므로, 지표가 아직 멀쩡해도 커뮤니케이션·감독 접촉 순서를 앞당겨야 한다.',
    formula: '예금자·거래상대·투자자·이사회 신뢰의 가중 합(0~100), 사건별 ΔCI 누적',
    cards: ['bank-run-dynamics', 'crisis-communication'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  runState: {
    why: '유출 속도의 레짐을 알려 준다. S2 이상이면 "며칠 안에"가 아니라 "오늘 안에" 담보를 현금으로 바꿀 수 있는지가 유일한 질문이 된다.',
    formula: 'CI ≥ 70 → S0, ≥ 55 → S1, ≥ 40 → S2, 그 아래 S3',
    cards: ['bank-run-dynamics', 'uninsured-deposits-and-run-speed'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  regulatorLevel: {
    why: '감독 단계가 올라가면 선택지 자체가 줄어든다. R2에서 배당·자사주가 막히고 R3에서는 주말 정리 준비가 시작되므로, 자본·매각 옵션은 단계가 오르기 전에 써야 한다.',
    formula: 'R0 정상 · R1 강화 모니터링 · R2 제한 · R3 정리 준비 · R4 폐쇄',
    cards: ['regulator-escalation-ladder', 'fdic-resolution-weekend'],
    sourceRef: 'fdic-oig-signature-2023',
  },
  ownStock: {
    why: '주가는 그 자체로는 유동성이 아니지만, 무보험 예금자가 가장 먼저 보는 공개 신호다. 하루 −20%급 하락은 예금 인출 결정의 방아쇠로 취급한다.',
    cards: ['crisis-communication', 'capital-raise-sequencing'],
    sourceRef: 'dfpi-svb-order-2023',
  },

  // ─────────────────────────── 은행 · 유동성 ───────────────────────────
  cash: {
    why: '오늘 결제할 수 있는 유일한 자산이다. 마감 시 중앙은행 계좌가 음수로 예상되면 다른 지표가 아무리 좋아도 폐쇄 사유가 된다.',
    formula: '중앙은행 지준 + 즉시 인출 가능한 현금성 잔액',
    cards: ['contingency-funding-plan', 'discount-window-fhlb-btfp'],
    sourceRef: 'dfpi-svb-order-2023',
  },
  liquidityAvailable: {
    why: '현금과 "오늘 실행 가능한" 담보차입을 합친 실질 방어선이다. 규제 HQLA가 아니라 이 숫자로 생존 일수를 계산한다.',
    formula: '현금 + 당일 담보차입 여력 − 최소 보유 현금',
    cards: ['contingency-funding-plan', 'hqla-and-haircuts'],
    sourceRef: 'bcbs-144',
  },
  survivalDays: {
    why: '이 플랫폼의 1차 의사결정 지표다. 3일 아래면 담보 이송·창구 신청을 지금 시작해야 하고, 1일 아래면 매각·감독 접촉·매각 타진을 동시에 열어야 한다.',
    formula: '(현금 + 당일 담보차입 여력 − 최소 보유 현금) ÷ 예상 일일 순유출',
    cards: ['contingency-funding-plan', 'uninsured-deposits-and-run-speed'],
    sourceRef: 'bcbs-144',
  },
  facilityHeadroom: {
    why: '"오늘" 빌릴 수 있는 담보 여력이다. 담보가 사전 예치·평가되어 있지 않으면 장부상 여력은 0과 같으므로, 이 숫자가 줄면 원인이 담보 소진인지 운영 지연인지를 먼저 구분한다.',
    formula: '중앙은행·FHLB 사전 예치 담보의 시가 × (1 − 헤어컷) − 기차입액',
    cards: ['discount-window-fhlb-btfp', 'hqla-and-haircuts'],
    sourceRef: 'interagency-cfp-addendum-2023',
  },
  facilityPending: {
    why: '이송·평가 중이라 오늘은 쓸 수 없는 담보다. 생존 일수 계산에 넣지 않는다 — 시그니처는 바로 이 칸의 숫자를 당일 유동성으로 착각해 주말을 넘기지 못했다.',
    formula: '이송·리엔 해제·평가 대기 중인 담보의 예상 차입 가능액(T+1)',
    cards: ['discount-window-fhlb-btfp', 'contingency-funding-plan'],
    sourceRef: 'fdic-oig-signature-2023',
  },
  cbAdvances: {
    why: '이미 쓴 담보차입 잔액이다. 잔액이 늘수록 남은 여력과 함께 담보 재사용 여지가 줄고, 등급 강등 시 2차 신용 전환·금리 가산이 곧바로 비용으로 돌아온다.',
    cards: ['discount-window-fhlb-btfp'],
    sourceRef: 'fed-sr-10-6',
  },
  lcr: {
    why: '규제 최저선이자 감독 개입(R1)의 트리거다. 다만 30일 전제이므로 하루 25%가 빠지는 런에서는 충족 여부와 생존이 별개라는 점을 함께 보고해야 한다.',
    formula: 'HQLA(헤어컷·상한 적용) ÷ 30일 순현금유출 × 100, 유입 인정 상한 75%',
    cards: ['lcr-basics', 'hqla-and-haircuts'],
    sourceRef: 'bcbs-238',
  },
  hqla: {
    why: 'LCR의 분자이지만 "당일 현금화 가능액"과 다르다. 리엔이 걸렸거나 미예치인 자산은 여기 잡혀도 오늘 쓸 수 없으므로 담보차입 여력과 반드시 나란히 본다.',
    formula: 'Level 1 × 100% + Level 2A × 85% + Level 2B × 50~75% (L2 ≤ 40%, 2B ≤ 15%)',
    cards: ['hqla-and-haircuts', 'lcr-basics'],
    sourceRef: 'basel-lcr30',
  },
  projectedDailyOutflow: {
    why: '생존 일수의 분모다. 런 상태·증폭·완화 계수가 반영되므로, 커뮤니케이션이나 백스톱이 이 숫자를 얼마나 줄이는지가 그 조치의 실질 가치다.',
    formula: 'Σ(세그먼트 잔액 × 런 상태별 유출률) × 증폭계수 ÷ 완화계수',
    cards: ['bank-run-dynamics', 'uninsured-deposits-and-run-speed'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  deposits: {
    why: '조달 기반의 크기이자 유출률 계산의 분모다. 총액보다 구성(무보험·운영성·중개예금)이 속도를 결정하므로 무보험 비중과 함께 읽는다.',
    formula: 'Σ 예금 세그먼트 잔액',
    cards: ['uninsured-deposits-and-run-speed', 'lcr-basics'],
    sourceRef: 'basel-lcr40',
  },
  uninsuredShare: {
    why: '런 속도의 가장 강한 예측 변수다. 비중이 높고 예금자가 동질적일수록 30일 규제 가정이 하루 만에 소진되므로, 유출률 가정을 상향하고 커뮤니케이션 대상을 좁힌다.',
    formula: '무보험 예금 ÷ 총예금 × 100',
    cards: ['uninsured-deposits-and-run-speed', 'mutual-credit-deposit-protection'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  dailyOutflow: {
    why: '오늘의 실제 유출액이다. 예상 유출과의 괴리가 커지면 유출 모형이 아니라 관측치로 생존 일수를 다시 계산하고 감독당국에 보고 주기를 올린다.',
    formula: '당일 예금 순유출(인출 − 유입)',
    cards: ['bank-run-dynamics', 'contingency-funding-plan'],
    sourceRef: 'dfpi-svb-order-2023',
  },
  dailyOutflowPct: {
    why: '감독 반응의 임계 축이다. 3%/일에서 경고, 20%/일을 넘으면 감독당국은 정리 준비(R3)로 넘어간다고 가정해야 한다.',
    formula: '당일 순유출 ÷ 턴 시작 예금 잔액 × 100',
    cards: ['uninsured-deposits-and-run-speed', 'regulator-escalation-ladder'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  cumulativeOutflow: {
    why: '위기 시작 이후 빠져나간 총액으로, 백스톱 규모와 매각 협상의 기준선이 된다. 임계 구간이 정의돼 있지 않으므로 "정상"이 아니라 절대액과 속도로 판단한다.',
    formula: 'Σ 일별 순유출',
    cards: ['bank-run-dynamics', 'fdic-resolution-weekend'],
    sourceRef: 'dfpi-svb-order-2023',
  },
  cumulativeOutflowPct: {
    why: '조달 기반이 얼마나 훼손됐는지를 보여 준다. 25%를 넘으면 잔여 예금도 같은 속도로 나간다고 보고 정리·매각 선택지를 실제로 열어 둔다.',
    formula: '누적 순유출 ÷ 위기 시작 시점 예금 × 100',
    cards: ['uninsured-deposits-and-run-speed', 'fdic-resolution-weekend'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },

  // ─────────────────────────── 은행 · 자본 ───────────────────────────
  cet1Ratio: {
    why: '규제 개입의 문턱이다. 최소 4.5%에 자본보전완충 2.5%를 더한 7.0%를 잠식하면 배당·자사주가 제한되고 그 사실 자체가 공개 신호가 된다.',
    formula: 'CET1 ÷ 위험가중자산(RWA) × 100',
    cards: ['economic-vs-regulatory-capital', 'regulator-escalation-ladder'],
    sourceRef: 'bcbs-189',
  },
  leverageRatio: {
    why: '위험가중과 무관한 백스톱 지표다. 국채·MBS처럼 위험가중치가 낮은 자산으로 대차대조표를 키운 경우 CET1보다 먼저 반응한다.',
    formula: 'Tier 1 ÷ 총익스포저 × 100 (최소 3%)',
    cards: ['economic-vs-regulatory-capital'],
    sourceRef: 'bcbs-189',
  },
  economicTce: {
    why: '시장과 무보험 예금자가 실제로 보는 자본이다. 규제 CET1이 12%여도 이 숫자가 0 근처면 증자·매각 조건이 결정되므로, 공시 전에 반드시 먼저 계산한다.',
    formula: '(유형보통주자본 − (AFS + HTM 미실현손실) × (1 − 세율)) ÷ 총자산 × 100',
    cards: ['economic-vs-regulatory-capital', 'afs-htm-aoci'],
    sourceRef: 'fed-svb-review-2023',
  },
  unrealizedLoss: {
    why: '아직 자본에 반영되지 않은 손실의 총량이다. 매각하는 순간 실현되고 HTM은 테인팅으로 잔여분까지 재분류되므로, 매각 결정 전에 이 숫자의 어디까지가 HTM인지 확인한다.',
    formula: '(AFS 장부가 − 시가) + (HTM 장부가 − 시가)',
    cards: ['afs-htm-aoci', 'htm-tainting'],
    sourceRef: 'fasb-asc-320',
  },
  unrealizedLossPctCet1: {
    why: '미실현손실이 자본을 얼마나 덮는지를 한 숫자로 보여 준다. 100%를 넘으면 규제 비율과 무관하게 시장은 자본잠식으로 읽는다.',
    formula: '(AFS + HTM 미실현손실) ÷ CET1 × 100',
    cards: ['afs-htm-aoci', 'economic-vs-regulatory-capital'],
    sourceRef: 'fed-svb-review-2023',
  },

  // ─────────────────────────── 증권사 (한국) ───────────────────────────
  ncr: {
    why: '적기시정조치의 문턱이다. 100% 미만 권고 · 50% 요구 · 0% 명령으로 올라가므로, 매입확약 이행이 NCR을 어디까지 깎는지 먼저 계산하고 순서를 정한다.',
    formula: '(영업용순자본 − 총위험액) ÷ 필요유지자기자본 × 100',
    cards: ['pf-abcp-commitment-ncr', 'regulator-escalation-ladder'],
    sourceRef: 'fsc-86917',
  },
  ncrOld: {
    why: '구 NCR(영업용순자본/총위험액)이다. 시계열 비교나 과거 보도자료와 대조할 때만 쓰고, 감독 문턱 판단은 현행 NCR로 한다.',
    formula: '영업용순자본 ÷ 총위험액 × 100',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'fsc-86917',
  },
  liquidityRatio: {
    why: '1·3개월 기준 100%가 감독 기준선이다. 2027.1.1 개편은 유동자산에 헤어컷을, 유동부채에 우발채무를 넣으므로 현행 수치가 여유 있어도 개편 기준으로 다시 계산해야 한다.',
    formula: '유동자산 ÷ 유동부채 × 100 (게임 단순화: 차환 실패분 + 콜 + CP 50% + 마진콜 대기)',
    cards: ['pf-abcp-commitment-ncr', 'hqla-and-haircuts'],
    sourceRef: 'fsc-86917',
  },
  liquidAssets: {
    why: '오늘 동원 가능한 자산의 총량이다. 매각 가능 증권은 헤어컷을 적용한 값으로만 세고, 미인출 약정은 취소 가능 조항을 확인한 뒤에 센다.',
    formula: '현금 + 미인출 약정 + 매각가능증권 × (1 − 헤어컷)',
    cards: ['hqla-and-haircuts', 'contingency-funding-plan'],
    sourceRef: 'cgfs-36',
  },
  abcpMaturingNext: {
    why: '처리하지 않은 첫 만기 금액이다. 차환이 실패할 부분과 전액 상환 시 필요한 현금을 나눠 확인한다. 처리 후에는 다음 만기로 이동한다.',
    formula: '현재 미처리 만기 배열[0]의 PF-ABCP 잔액',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-23-10',
  },
  abcpMaturing30: {
    why: '미처리 만기 4개를 합한 금액이다. 구간 간격이 서로 달라 달력상 30일 합계로 해석할 수 없다. 실제 날짜별 만기표는 별도 확인한다.',
    formula: 'Σ 현재 미처리 만기 배열[0..3] PF-ABCP 잔액',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-lee-2022-18',
  },
  schemeCash: {
    why: '스킴이 보유한 현금이다. 풀 납입 승인·송금·반영을 확인한 뒤 담보로 사용할 수 있다.',
    formula: '스킴 자산의 현금 잔고 (LDI 풀 내부 현금 제외)',
    cards: ['ldi-collateral-waterfall'],
    sourceRef: 'boe-breeden-2022',
  },
  rollRate: {
    why: '차환 시장의 온도계다. 90% 아래로 떨어지면 시장이 아니라 자기 대차대조표로 막아야 한다는 뜻이므로, 미리 자체매입 한도와 NCR 여파를 정해 둔다.',
    formula: '차환 성공액 ÷ 만기 도래액 × 100',
    cards: ['pf-abcp-commitment-ncr', 'korea-crisis-toolkit'],
    sourceRef: 'fsc-80034',
  },
  abcpGuaranteed: {
    why: '매입확약·신용공여 잔액은 아직 대차대조표 밖이지만 차환이 막히면 전액 내 부채가 된다. 우발채무가 아니라 조건부 만기로 관리한다.',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-23-10',
  },
  abcpHeld: {
    why: '이미 자체매입한 금액이다. 현금을 쓰고 위험액을 늘려 NCR과 유동성비율을 동시에 깎으므로, 추가 매입 여력의 한계를 이 숫자로 관리한다.',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'fsc-80034',
  },
  guaranteeToEquity: {
    why: '자기자본 대비 채무보증 배율이다. 100%를 넘으면 차환 실패 한 번이 자본 전체를 위협하므로, 신규 확약 중단과 보증 축소가 먼저다.',
    formula: '매입확약·신용공여 잔액 ÷ 자기자본 × 100',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-lee-2022-18',
  },
  ownCpRate: {
    why: '자사 조달금리는 시장이 매긴 신용도다. 급등은 곧 차환 거부의 선행 신호이므로, 금리로 막을지 물량을 줄일지 결정하는 기준으로 쓴다.',
    cards: ['pf-abcp-commitment-ncr', 'korea-crisis-toolkit'],
    sourceRef: 'kcmi-23-10',
  },
  fxLiquid: {
    why: '외화 마진콜은 원화로 막을 수 없다. 자체헤지 포지션이 있으면 외화 유동자산을 별도 버킷으로 관리한다 — 2020년 3월의 병목이 여기였다.',
    cards: ['korea-crisis-toolkit'],
    sourceRef: 'fsc-dls-plan-2020',
  },

  // ─────────────────────────── 연기금 · LDI ───────────────────────────
  hedgeRatio: {
    why: '부채 금리 민감도를 얼마나 덮고 있는지다. 담보가 부족해 헤지를 푸는 순간 금리가 되돌아올 때 펀딩비율이 그대로 무너지므로, 헤지 축소는 마지막 수단으로 둔다.',
    formula: '헤지된 부채 PV01 ÷ 총부채 PV01 × 100',
    cards: ['ldi-leverage-buffer-250bp', 'ldi-collateral-waterfall'],
    sourceRef: 'tpr-ldi-guidance-2023',
  },
  ldiLeverage: {
    why: '같은 금리 상승에 몇 배의 담보가 필요한지를 결정한다. 3배를 넘으면 250bp 버퍼로도 5일 안에 담보를 대기 어려워진다.',
    formula: 'LDI 익스포저 ÷ LDI 자기자본',
    cards: ['ldi-leverage-buffer-250bp'],
    sourceRef: 'boe-ldi-staff-paper-2023',
  },
  collateralHeadroomBp: {
    why: '금리가 몇 bp 더 올라도 버티는지를 직접 말해 준다. 영란은행 권고 250bp 아래면 담보 보충(5일 가정)이 시장 속도를 따라가지 못한다고 보고 지금 현금화를 시작한다.',
    formula: '가용 담보 ÷ PV01, PV01 = 익스포저 × 수정듀레이션 ÷ 10,000',
    cards: ['ldi-leverage-buffer-250bp', 'ldi-collateral-waterfall'],
    sourceRef: 'boe-ldi-staff-paper-2023',
  },
  marginCallPending: {
    why: '이미 도착했지만 아직 못 낸 담보다. 결제 시한을 넘기면 상대방이 포지션을 강제 청산하므로 다른 어떤 지표보다 먼저 해결한다.',
    formula: 'Σ 미결제 변동증거금·추가담보 요구액',
    cards: ['ldi-collateral-waterfall', 'tri-party-repo-run'],
    sourceRef: 'imf-wp-2023-210',
  },
  fundingRatio: {
    why: '장기 지급능력의 지표다. 단기 담보 위기를 넘기려고 자산을 헐값에 팔면 이 숫자가 영구히 내려가므로, 매각 순서는 펀딩비율 훼손이 적은 것부터 잡는다.',
    formula: '총자산 ÷ 부채 현재가치 × 100',
    cards: ['ldi-leverage-buffer-250bp'],
    sourceRef: 'tpr-ldi-guidance-2023',
  },
  govt30y: {
    why: '담보 소요의 방향을 결정하는 원인 변수다. 하루 35bp를 넘는 상승이 이어지면 버퍼 소진 속도가 담보 보충 속도를 앞지른다.',
    cards: ['ldi-leverage-buffer-250bp', 'ldi-collateral-waterfall'],
    sourceRef: 'boe-qb-2023-gilt',
  },

  // ─────────────────────────── 프라임브로커 ───────────────────────────
  grossExposure: {
    why: '총액 기준 노출이다. 순액이 작아도 청산은 총액으로 일어나므로, 집중도·청산 일수와 묶어서 한도를 건다.',
    formula: 'Σ 고객 포지션 명목금액',
    cards: ['tri-party-repo-run'],
    sourceRef: 'paul-weiss-cs-archegos-2021',
  },
  liquidationVaR: {
    why: '청산에 걸리는 기간 동안 벌어질 수 있는 손실이다. 마진이 이 값을 덮지 못하면 담보가 아니라 신용으로 빌려준 것이다.',
    formula: '99% 일측(z = 2.33) × 변동성 × √청산일수 × 포지션',
    cards: ['tri-party-repo-run'],
    sourceRef: 'cgfs-36',
  },
  marginCoverage: {
    why: '고객이 맡긴 담보가 청산 손실을 덮는 배율이다. 100% 아래로 내려가면 추가 증거금 요구는 이미 늦었다고 보고 포지션 축소를 강제한다.',
    formula: '예치 증거금 ÷ 청산 VaR × 100',
    cards: ['tri-party-repo-run'],
    sourceRef: 'paul-weiss-cs-archegos-2021',
  },
  concentrationDays: {
    why: '가장 큰 포지션을 빼는 데 걸리는 일수다. 10일을 넘으면 정적 마진은 의미가 없고 집중도 가산 마진으로 전환해야 한다.',
    formula: '포지션 ÷ (일평균거래량 × 참여율 20%)',
    cards: ['tri-party-repo-run'],
    sourceRef: 'sec-pr-2022-70',
  },

  // ─────────────────────────── 중앙은행 · 외환 ───────────────────────────
  usableReserves: {
    why: '헤드라인 보유액이 아니라 실제로 쓸 수 있는 달러다. 이 숫자가 시장에 알려지는 시점이 롤오버 거부의 시작점이므로 방어 소진 속도를 일 단위로 관리한다.',
    cards: ['korea-crisis-toolkit'],
    sourceRef: 'audit-fx-crisis-1998',
  },
  guidottiRatio: {
    why: '1년 안에 갚아야 할 외채를 보유액으로 덮는지를 본다. 100% 아래면 롤오버 거부 하나로 보유액이 급락하므로 채권자 협상 시한을 금리 인상보다 먼저 잡는다.',
    formula: '가용보유액 ÷ 잔존만기 1년 이하 외채 × 100',
    cards: ['korea-crisis-toolkit'],
    sourceRef: 'audit-fx-crisis-1998',
  },
  importCoverMonths: {
    why: '실물 경제가 버티는 개월 수다. 3개월 아래는 전통적 경보선으로, 수입 결제 우선순위와 외화 배분 규칙을 미리 정해야 한다는 신호다.',
    formula: '가용보유액 ÷ 월 수입액',
    cards: ['korea-crisis-toolkit'],
    sourceRef: 'audit-fx-crisis-1998',
  },
  sovereignSpreadBp: {
    why: '국가 신용에 매겨진 가격이다. 300bp를 넘으면 민간의 외화 조달이 사실상 닫히므로 양자·지역 자금과 스와프 경로를 동시에 연다.',
    cards: ['korea-crisis-toolkit', 'crisis-communication'],
    sourceRef: 'audit-fx-crisis-1998',
  },
  distressedBanks: {
    why: '개별 기관 문제가 시스템 문제로 넘어갔는지를 보는 지표다. 4곳을 넘으면 개별 정리가 아니라 일괄 조치(전액 보장·백스톱)를 검토할 시점이다.',
    cards: ['fdic-resolution-weekend', 'korea-crisis-toolkit'],
    sourceRef: 'fsc-71188',
  },

  // ─────────────────────────── 자산운용 ───────────────────────────
  redemptionsPendingPct: {
    why: '오늘 현금으로 내줘야 할 NAV 비중이다. 현금 버퍼를 넘으면 매각이 시작되고, 그 매각이 다음 날 환매를 부른다.',
    formula: '당일 환매 요청액 ÷ NAV × 100',
    cards: ['bank-run-dynamics'],
    sourceRef: 'sec-mmf-reforms-2023',
  },
  cashBufferPct: {
    why: '선착순 인출 유인을 억제하는 유일한 방어선이다. 버퍼가 얇으면 남은 투자자에게 비용이 전가되므로 스윙프라이싱·수수료 발동을 먼저 검토한다.',
    formula: '일일 유동자산 ÷ NAV × 100',
    cards: ['bank-run-dynamics'],
    sourceRef: 'sec-mmf-reforms-2023',
  },
}

/** 설명이 있는 지표인지. */
export function hasKpiExplain(metric: string): boolean {
  return metric in KPI_EXPLAIN
}

/** `KpiSpec.description` → `KPI_EXPLAIN[metric].why` 순으로 폴백한 설명 문장. */
export function kpiWhy(metric: string, description?: string): string | undefined {
  return description ?? KPI_EXPLAIN[metric]?.why
}

/** Shared metric keys can have different balance-sheet meanings for each institution. */
export function kpiExplanation(metric: string, institution: string): KpiExplain | undefined {
  if (metric === 'liquidAssets' && institution === 'pension')
    return {
      why: '스킴 현금과 미담보 길트의 합계다. 길트는 매각·이전 전 현금이 아니며, LDI 풀 내부 담보는 이 합계에 포함하지 않는다.',
      formula: '스킴 현금 + 직접보유 길트 시가 × (1 − 기담보 비중)',
      cards: ['ldi-collateral-waterfall'],
      sourceRef: 'boe-breeden-2022',
    }
  return KPI_EXPLAIN[metric]
}
