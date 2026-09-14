/**
 * 지표 설명 — "왜 중요한가 / 어떻게 계산하는가 / 무엇을 함께 볼 것인가".
 *
 * 대시보드 KPI 타일의 `?`와 도움 시트의 `지표 설명` 탭이 이 맵을 읽는다.
 * 표시 우선순위: `KpiSpec.description` → `KPI_EXPLAIN[metric]` → `MetricValue.detail`.
 *
 * 작성 기준
 * - `why`는 실무자가 이 숫자를 보고 **바꿔야 할 판단**을 1~2문장으로 적는다(정의 반복 금지).
 * - `caveat`는 **집계 기간·단위·기준**을 한 줄로 적는다. `why`를 줄여 쓴 것이 아니다 — 둘이
 *   같은 말을 하면 도움 시트에서 같은 문장이 두 번 쌓인다. 라벨이 이미 말하는 것도 쓰지 않는다.
 * - `formula`는 `src/metrics/*`가 실제로 계산하는 식을 그대로 적는다.
 * - `cards`는 `src/content/cards/`의 실재 id, `sourceRef`는 `src/content/sources.ts`의 실재 id만 쓴다.
 *
 * 한때 이 중 `caveat`만 `src/lib/metricContext.ts`의 하드코딩 `if` 사슬로 따로 살았다. 그래서
 * 같은 지표를 두 곳이 각각 설명했고(`abcpMaturing30`은 두 문장이 거의 글자까지 같았다), 그쪽에는
 * 출처도 카드 연결도 콘텐츠 검증기도 없었다. 설명은 저작 계층 한 곳에서만 온다.
 */
export interface KpiExplain {
  /** 이 숫자가 바꿔야 할 판단. */
  why: string
  /**
   * 집계 기간·단위·기준 한 줄. 타일에 상시 노출되고, 전문가 모드에서도 가려지지 않는다 —
   * 사후 정보가 아니라 «지금 이 숫자가 무엇을 재는가» 이기 때문이다.
   */
  caveat?: string
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
    why: '런 상태(S0~S3)와 유출 계수를 구동하는 선행 변수다. 70·50·30의 경계를 내려갈 때 유출률이 계단식으로 뛰도록 설계되어 있으므로, 지표가 아직 멀쩡해도 커뮤니케이션·감독 접촉 순서를 앞당겨야 한다.',
    caveat: '시뮬레이션 신뢰지수 · 실제 관측 통계 아님',
    formula:
      '초기 신뢰지수에 사건·선택의 ΔCI를 반영한 모형 값(0~100). 이해관계자별 신뢰의 가중 평균이 아님',
    cards: ['bank-run-dynamics', 'crisis-communication'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  runState: {
    why: '유출 속도의 레짐을 알려 준다. S2 이상이면 "며칠 안에"가 아니라 "오늘 안에" 담보를 현금으로 바꿀 수 있는지가 유일한 질문이 된다.',
    formula: 'CI ≥ 70 → S0, ≥ 50 → S1, ≥ 30 → S2, 그 아래 S3',
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
    why: '현재 장부의 현금 잔액이다. 필요한 통화·계좌·결제 마감에 실제로 사용할 수 있는지 확인하고, 인출 전 약정과 구분한다.',
    formula: '해당 기관의 현금 장부 잔액(은행은 현금·지준)',
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
    caveat: '현재 유출 속도 기준 추정 · 결제 마감까지의 시간 아님',
    formula: '(현금 + 당일 담보차입 여력 − 최소 보유 현금) ÷ 예상 일일 순유출',
    cards: ['contingency-funding-plan', 'uninsured-deposits-and-run-speed'],
    sourceRef: 'bcbs-144',
  },
  facilityHeadroom: {
    why: '지금 빌릴 수 있는 담보 여력이다. 담보가 사전 예치·평가되어 있지 않으면 장부상 여력은 0과 같으므로, 이 숫자가 줄면 원인이 담보 소진인지 운영 지연인지를 먼저 구분한다.',
    caveat: '인출 전에는 현금에 포함되지 않음',
    formula: '중앙은행·FHLB 사전 예치 담보의 시가 × (1 − 헤어컷) − 기차입액',
    cards: ['discount-window-fhlb-btfp', 'hqla-and-haircuts'],
    sourceRef: 'interagency-cfp-addendum-2023',
  },
  facilityPending: {
    why: '이송·평가 중이라 아직 쓸 수 없는 담보다. 생존 일수 계산에 넣지 않는다 — 시그니처는 바로 이 칸의 숫자를 당일 유동성으로 착각해 주말을 넘기지 못했다.',
    caveat: '반영 대기 · 현재 현금에 포함되지 않음',
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
    why: '30일 스트레스 유출에 대한 방어력을 본다. 실제 규제 적용 대상·당시 기준과 게임 경고선을 구분한다. SVB와 리먼 등에서 표시하는 LCR은 비교용 모형 지표이며 당시 법정 의무를 뜻하지 않는다.',
    caveat: '30일 스트레스 기준 · 당일 결제 여력은 별도 확인',
    formula: 'HQLA(헤어컷·상한 적용) ÷ 30일 순현금유출 × 100, 유입 인정 상한 75%',
    cards: ['lcr-basics', 'hqla-and-haircuts'],
    sourceRef: 'bcbs-238',
  },
  hqla: {
    why: 'LCR의 분자이지만 "당일 현금화 가능액"과 다르다. 이미 차입에 묶인 담보는 원칙적으로 제외한다. 미인출 중앙은행 사전 예치 담보는 요건 충족 시 인정될 수 있으나 당일 인출 가능 여부는 별도 확인한다.',
    formula:
      '미담보 Level 1 × 100% + Level 2A × 85% + Level 2B × 50%, 이후 L2 40%·2B 15% 상한 적용(모형은 2B를 일괄 50% 인정)',
    cards: ['hqla-and-haircuts', 'lcr-basics'],
    sourceRef: 'basel-lcr30',
  },
  projectedDailyOutflow: {
    why: '생존 일수의 분모다. 런 상태·증폭·완화 계수가 반영되므로, 커뮤니케이션이나 백스톱이 이 숫자를 얼마나 줄이는지가 그 조치의 실질 가치다.',
    caveat: '현재 조건에 따른 향후 1일 추정 · 확정 지급액 아님',
    formula:
      'Σ[세그먼트 잔액 × min(상한, 런 상태별 유출률 × 증폭계수 × 네트워크계수 × 완화계수)]. 완화계수는 1 이하이며 곱한다',
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
    why: '이번 구간의 실제 유출액이다. 예상 유출과의 괴리가 커지면 유출 모형이 아니라 관측치로 생존 일수를 다시 계산하고 감독당국에 보고 주기를 올린다.',
    caveat: '현재 구간 누적 · 구간 시작 때 집계 초기화',
    formula: '현재 구간에 누적된 모형 예금 유출액(구간 진입 시 초기화)',
    cards: ['bank-run-dynamics', 'contingency-funding-plan'],
    sourceRef: 'dfpi-svb-order-2023',
  },
  dailyOutflowPct: {
    why: '구간의 유출 규모를 시나리오 시작 예금과 비교한다. 구간 길이가 서로 다르므로 일일 유출률로 읽지 않으며, 감독 반응은 해당 시나리오 조건을 확인한다.',
    caveat: '현재 구간 누적 · 구간 시작 때 집계 초기화',
    formula: '현재 구간 유출액 ÷ 시나리오 시작 예금 잔액 × 100',
    cards: ['uninsured-deposits-and-run-speed', 'regulator-escalation-ladder'],
    sourceRef: 'fsb-depositor-behaviour-2024',
  },
  cumulativeOutflow: {
    why: '위기 시작 이후 빠져나간 총액으로, 백스톱 규모와 매각 협상의 기준선이 된다. 임계 구간이 정의돼 있지 않으므로 "정상"이 아니라 절대액과 속도로 판단한다.',
    caveat: '시나리오 시작 이후 누적',
    formula: 'Σ 시나리오 구간별 모형 예금 유출액',
    cards: ['bank-run-dynamics', 'fdic-resolution-weekend'],
    sourceRef: 'dfpi-svb-order-2023',
  },
  cumulativeOutflowPct: {
    why: '조달 기반이 얼마나 훼손됐는지를 보여 준다. 25%를 넘으면 잔여 예금도 같은 속도로 나간다고 보고 정리·매각 선택지를 실제로 열어 둔다.',
    caveat: '시나리오 시작 이후 누적',
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
    caveat: 'CET1 기반 세전 근사 · 회계상 TCE와 다름',
    why: '시장과 무보험 예금자가 실제로 보는 자본이다. 규제 CET1이 12%여도 이 숫자가 0 근처면 증자·매각 조건이 결정되므로, 공시 전에 반드시 먼저 계산한다.',
    formula:
      '(CET1 − CET1에 미반영된 AFS 손실 − HTM 손실) ÷ 레버리지 익스포저 × 100 (모형: 세효과 미반영)',
    cards: ['economic-vs-regulatory-capital', 'afs-htm-aoci'],
    sourceRef: 'fed-svb-review-2023',
  },
  unrealizedLoss: {
    why: '증권의 원가 대비 평가손실 합계다. AFS 손실은 회계자본에 이미 반영될 수 있고 CET1 반영 여부는 AOCI 처리에 달려 있다. HTM 매각은 예외 요건과 잔여 보유 의도를 검토해야 한다.',
    formula:
      'max(0, AFS 원가 − 시가) + max(0, HTM 상각원가 − 시가). 모형 bookValue는 AFS에도 원가 기준을 저장',
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
    why: '게임의 자금 압박 지표다. 만기 4개 합계와 단순화한 지급액을 쓰므로 법정 1·3개월 유동성비율과 일치하지 않는다. 2026.5 발표된 개편안은 2027.1.1 시행을 목표로 하며, 당시 규정과 별도 비교한다.',
    formula: '유동자산 ÷ 유동부채 × 100 (게임 단순화: 차환 실패분 + 콜 + CP 50% + 마진콜 대기)',
    cards: ['pf-abcp-commitment-ncr', 'hqla-and-haircuts'],
    sourceRef: 'fsc-86917',
  },
  liquidAssets: {
    why: '현금·미인출 약정·증권 할인평가액을 더한 모형 값이다. 약정은 인출 조건을, 증권은 매각·담보화와 결제 시점을 확인해야 하므로 합계를 즉시 사용 가능한 현금으로 읽지 않는다.',
    formula:
      '현금 + 미인출 은행 약정(약정 − 기인출액) + 매각가능증권 × 90% (모형의 고정 할인율 10%)',
    cards: ['hqla-and-haircuts', 'contingency-funding-plan'],
    sourceRef: 'cgfs-36',
  },
  abcpMaturingNext: {
    caveat: '만기 배열의 상품 구성은 시나리오별로 다름',
    why: '처리하지 않은 첫 만기 금액이다. 차환이 실패할 부분과 전액 상환 시 필요한 현금을 나눠 확인한다. 처리 후에는 다음 만기로 이동한다.',
    formula: '현재 미처리 만기 배열[0]의 잔액',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-23-10',
  },
  abcpMaturing30: {
    why: '미처리 만기 4개를 합한 금액이다. 구간 간격이 서로 달라 달력상 30일 합계로 해석할 수 없다. 실제 날짜별 만기표는 별도 확인한다.',
    caveat: '달력상 30일 합계 아님',
    formula: 'Σ 현재 미처리 만기 배열[0..3]의 잔액',
    cards: ['pf-abcp-commitment-ncr'],
    sourceRef: 'kcmi-lee-2022-18',
  },
  schemeCash: {
    why: '스킴이 보유한 현금이다. 풀 납입 승인·송금·반영을 확인한 뒤 담보로 사용할 수 있다.',
    caveat: 'LDI 풀 내부 현금 제외',
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
    why: '매입확약·신용공여는 조건부 자금 수요다. 이행하면 현금 지급과 ABCP 등 자산 인수가 발생하며, 별도 차입을 할 때 조달 부채가 늘어난다. 보증 잔액 전부가 자동으로 차입 부채가 되는 것은 아니다.',
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
    why: '익스포저 대비 자기자본의 얇기를 보여 준다. 같은 NAV에서 익스포저가 커지면 금리 충격 손실이 커진다. 담보 부족은 레버리지 배수만으로 단정하지 않고 PV01·가용 담보·보충 소요일로 계산한다.',
    formula: 'LDI 익스포저 ÷ LDI 자기자본',
    cards: ['ldi-leverage-buffer-250bp'],
    sourceRef: 'boe-ldi-staff-paper-2023',
  },
  collateralHeadroomBp: {
    why: '현재 담보를 금리 충격 bp로 환산한 모형 값이다. 미충당 콜과 별도로 보며, 250bp는 2023년 사후 최소 회복력 기준으로 2022년 당시 의무가 아니다. 보충 소요일과 운영 버퍼를 함께 판단한다.',
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
    formula: 'Σ |고객 포지션 명목금액| (롱·숏 절댓값 합계)',
    cards: ['tri-party-repo-run'],
    sourceRef: 'paul-weiss-cs-archegos-2021',
  },
  liquidationVaR: {
    why: '청산에 걸리는 기간 동안 벌어질 수 있는 손실이다. 마진이 이 값을 덮지 못하면 담보가 아니라 신용으로 빌려준 것이다.',
    formula: 'Σ[2.33 × 일일 변동성 × √청산일수 × |포지션|] (99% 일측 정규 근사, 분산효과 미반영)',
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
    why: '각 포지션 중 청산에 가장 오래 걸리는 일수다. 명목금액이 가장 큰 포지션과 다를 수 있다. 유동성이 낮은 종목은 참여율·집중도 가산을 함께 검토한다.',
    formula: 'max[|포지션| ÷ (일평균거래대금 × 참여율 20%)]',
    cards: ['tri-party-repo-run'],
    sourceRef: 'sec-pr-2022-70',
  },

  // ─────────────────────────── 중앙은행 · 외환 ───────────────────────────
  usableReserves: {
    why: '헤드라인 보유액이 아니라 실제로 쓸 수 있는 달러다. 가용액 공개와 신뢰 변화가 차환에 미치는 영향을 살피고, 방어에 따른 소진 속도를 일 단위로 관리한다.',
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
    why: '국가 신용에 매겨진 가격이다. 스프레드 상승 시 민간 외화 조달의 비용·물량을 점검한다. 300bp는 모형 경고 기준이며 실제 조달 중단을 결정하는 보편적 문턱은 아니다.',
    cards: ['korea-crisis-toolkit', 'crisis-communication'],
    sourceRef: 'audit-fx-crisis-1998',
  },
  distressedBanks: {
    why: '개별 기관 문제가 시스템 문제로 넘어갔는지를 보는 지표다. 기관 수와 함께 규모·상호연계·지급능력을 확인한다. 4곳이라는 모형 경고 기준만으로 전액 보장이나 일괄 정리를 결정하지 않는다.',
    cards: ['fdic-resolution-weekend', 'korea-crisis-toolkit'],
    sourceRef: 'fsc-71188',
  },

  // ─────────────────────────── 자산운용 ───────────────────────────
  redemptionsPendingPct: {
    why: '현재 처리 대기 중인 환매 요청 비중이다. 요청과 실제 지급 시점을 구별하고 펀드 규약의 결제일·유동성 관리 수단을 확인한다.',
    formula: '당일 환매 요청액 ÷ NAV × 100',
    cards: ['bank-run-dynamics'],
    sourceRef: 'sec-mmf-reforms-2023',
  },
  cashBufferPct: {
    why: '현금과 1일 내 유동화 가능한 자산의 비중이다. 모두 이미 입금된 현금은 아니다. 유동성 버퍼와 함께 규약·관할 규정상 허용된 비용배분 수단을 검토한다.',
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
