import type { Role } from '../engine/types/common'

/**
 * 역할별 핵심 판단 프레임.
 *
 * 전문가 훈련의 목적은 "정답 고르기"가 아니라 **같은 질문을 같은 순서로 던지는 습관**이다.
 * 그래서 이 목록은 브리핑 요약 · 플레이 도움 시트 · 디브리핑에서 **항상 같은 순서**로 노출한다.
 * 각 항목의 `metrics`는 실재하는 지표 id이며, 도움 시트는 시나리오 KPI와 교집합이 있는 항목만 보여 준다.
 */
export type RoleFamily = 'bank' | 'securities' | 'pension' | 'fund' | 'policy'

export interface RoleFrameItem {
  id: string
  /** 프레임 이름(≤ 10자). */
  label: string
  /** 실무자가 스스로에게 던져야 하는 한 줄. */
  question: string
  /** 근거 지식카드 id (`src/content/cards/`). */
  cardRef?: string
  /** 근거 프레임워크 문서 id (`src/content/frameworks/`). */
  frameworkRef?: string
  /** 이 프레임이 읽는 지표 id. */
  metrics: string[]
}

export const ROLE_FRAMES: Record<RoleFamily, { title: string; items: RoleFrameItem[] }> = {
  bank: {
    title: '은행 — 유동성 사다리를 순서대로',
    items: [
      {
        id: 'bank-waterfall',
        label: '유동성 워터폴',
        question: '오늘 쓸 수 있는 현금과 담보차입만으로 내일 예상 유출을 덮는가 — 며칠치인가?',
        cardRef: 'contingency-funding-plan',
        frameworkRef: 'contingency-funding-plan',
        metrics: ['cash', 'liquidityAvailable', 'survivalDays', 'projectedDailyOutflow', 'lcr'],
      },
      {
        id: 'bank-collateral',
        label: '담보 준비',
        question: '담보가 창구에 예치·평가되어 있는가, 아니면 이송 중이라 오늘은 0인가?',
        cardRef: 'discount-window-fhlb-btfp',
        frameworkRef: 'basel3-liquidity',
        metrics: ['facilityHeadroom', 'facilityPending', 'hqla', 'cbAdvances'],
      },
      {
        id: 'bank-loss-order',
        label: '손실 실현 순서',
        question: 'AFS 매각과 HTM 매각 중 무엇을 먼저 하며, 테인팅 이후 자본은 얼마로 남는가?',
        cardRef: 'htm-tainting',
        frameworkRef: 'irrbb-and-securities-accounting',
        metrics: ['unrealizedLoss', 'unrealizedLossPctCet1', 'economicTce', 'cet1Ratio'],
      },
      {
        id: 'bank-disclosure',
        label: '공시 순서',
        question:
          '검증 가능한 여력만 말하고 있는가 — 자본조달과 손실 공시를 같은 날 묶고 있지는 않은가?',
        cardRef: 'crisis-communication',
        frameworkRef: 'crisis-communication',
        metrics: ['confidence', 'ownStock', 'uninsuredShare', 'dailyOutflowPct'],
      },
      {
        id: 'bank-supervisor',
        label: '감독 접촉',
        question:
          '감독당국이 우리보다 먼저 알게 되는 숫자가 있는가 — 다음 단계(R+1)의 제약을 계산했는가?',
        cardRef: 'regulator-escalation-ladder',
        frameworkRef: 'resolution-and-backstops',
        metrics: ['regulatorLevel', 'lcr', 'cet1Ratio', 'economicTce'],
      },
    ],
  },
  securities: {
    title: '증권사 — 차환 파이프라인을 먼저',
    items: [
      {
        id: 'sec-rollover',
        label: '차환 만기',
        question:
          '앞으로 처리할 만기 금액은 얼마이고, 차환 실패를 몇 %로 가정하고 있는가? 실제 만기일도 확인했는가?',
        cardRef: 'pf-abcp-commitment-ncr',
        frameworkRef: 'korea-crisis-toolkit',
        metrics: ['abcpMaturingNext', 'abcpMaturing30', 'rollRate', 'ownCpRate'],
      },
      {
        id: 'sec-ncr',
        label: 'NCR 여력',
        question: '자체매입을 실행하면 NCR·유동성비율이 어느 문턱(100/50/0)까지 내려가는가?',
        cardRef: 'pf-abcp-commitment-ncr',
        frameworkRef: 'capital-framework',
        metrics: ['ncr', 'liquidityRatio', 'abcpHeld', 'guaranteeToEquity'],
      },
      {
        id: 'sec-funding',
        label: '조달 채널',
        question:
          '한은 RP 대상기관인가 — 아니라면 증금·산은·은행권 RP의 담보와 소요일을 확인했는가?',
        cardRef: 'korea-crisis-toolkit',
        frameworkRef: 'korea-crisis-toolkit',
        metrics: ['cash', 'liquidAssets', 'fxLiquid'],
      },
      {
        id: 'sec-commitment',
        label: '약정 이행',
        question: '매입확약을 이행할 것인가 미룰 것인가 — 미루면 시장이 다음에 누구를 의심하는가?',
        cardRef: 'pf-abcp-commitment-ncr',
        frameworkRef: 'crisis-communication',
        metrics: ['abcpGuaranteed', 'guaranteeToEquity', 'confidence', 'marginCallPending'],
      },
    ],
  },
  pension: {
    title: '연기금·자산운용 — 담보가 며칠 안에 도착하는가',
    items: [
      {
        id: 'pen-buffer',
        label: '담보 버퍼',
        question: '금리가 몇 bp 더 올라도 버티는가 — 250bp 기준 아래로 내려왔는가?',
        cardRef: 'ldi-leverage-buffer-250bp',
        frameworkRef: 'margin-and-collateral-mechanics',
        metrics: ['collateralHeadroomBp', 'ldiLeverage', 'govt30y'],
      },
      {
        id: 'pen-waterfall',
        label: '담보 조달 순서',
        question: '현금 → 국채 → 비적격 자산 순서로, 각 단계가 결제까지 며칠 걸리는가?',
        cardRef: 'ldi-collateral-waterfall',
        frameworkRef: 'margin-and-collateral-mechanics',
        metrics: ['liquidAssets', 'marginCallPending', 'cash'],
      },
      {
        id: 'pen-hedge',
        label: '헤지 유지',
        question: '헤지를 줄여 담보를 아끼는 선택이 금리가 되돌아올 때 펀딩비율을 얼마나 깎는가?',
        cardRef: 'ldi-leverage-buffer-250bp',
        frameworkRef: 'margin-and-collateral-mechanics',
        metrics: ['hedgeRatio', 'fundingRatio', 'ldiLeverage'],
      },
      {
        id: 'pen-recap',
        label: '재자본화 속도',
        question: '스폰서 추가 출자·자산 매각이 마진콜 시한 안에 실제로 도착하는가?',
        cardRef: 'ldi-collateral-waterfall',
        frameworkRef: 'margin-and-collateral-mechanics',
        metrics: ['fundingRatio', 'liquidAssets', 'marginCallPending'],
      },
    ],
  },
  fund: {
    title: '펀드 운용 — 남는 수익자가 무엇을 떠안는가',
    items: [
      {
        id: 'fund-ladder',
        label: '유동성 사다리',
        question:
          '당일·1주·1개월 각 칸을 위기 가정으로 다시 세었는가 — 평시 수치를 쓰고 있지 않은가?',
        cardRef: 'fund-liquidity-ladder',
        frameworkRef: 'basel3-liquidity',
        metrics: ['cashBufferPct', 'weeklyLiquidityPct', 'illiquidSharePct'],
      },
      {
        id: 'fund-slicing',
        label: '매도 순서',
        question:
          '유동성 높은 칸부터 파는가, 비례로 파는가 — 남는 포트폴리오의 비유동 비중이 어떻게 변하는가?',
        cardRef: 'fund-liquidity-ladder',
        frameworkRef: 'margin-and-collateral-mechanics',
        metrics: ['illiquidSharePct', 'dilutionBp', 'navIndex'],
      },
      {
        id: 'fund-pricing',
        label: '가격 장치',
        question:
          '스윙 임계와 계수가 위기 전에 결의되어 있었는가 — 지금 도입하면 그 자체가 신호가 되는가?',
        cardRef: 'fund-liquidity-ladder',
        frameworkRef: 'crisis-communication',
        metrics: ['dilutionBp', 'redemptionsPendingPct'],
      },
      {
        id: 'fund-gate',
        label: '게이트의 대가',
        question: '환매 제한이 이 펀드를 구하고 같은 운용사의 다른 펀드로 환매를 옮기지는 않는가?',
        cardRef: 'bank-run-dynamics',
        frameworkRef: 'bank-run-dynamics',
        metrics: ['redemptionsCumulativePct', 'redemptionsPendingPct', 'weeklyLiquidityPct'],
      },
    ],
  },
  policy: {
    title: '정책당국 — 범위·말·순서',
    items: [
      {
        id: 'pol-backstop',
        label: '백스톱 범위',
        question:
          '누구를 대상으로, 어떤 담보로, 얼마 동안 대는가 — 대상 밖 기관이 다음 표적이 되지 않는가?',
        cardRef: 'korea-crisis-toolkit',
        frameworkRef: 'korea-crisis-toolkit',
        metrics: ['distressedBanks', 'usableReserves', 'confidence'],
      },
      {
        id: 'pol-comms',
        label: '커뮤니케이션',
        question: '조건부 안심("추가는 없다")을 말하고 있지 않은가 — 이틀 뒤 번복할 여지는?',
        cardRef: 'crisis-communication',
        frameworkRef: 'crisis-communication',
        metrics: ['confidence', 'runState', 'sovereignSpreadBp'],
      },
      {
        id: 'pol-resolution',
        label: '정리 옵션',
        question:
          'P&A·가교·전액 보장 중 무엇이며, 월요일 개장에 무보험 예금자가 돈을 쓸 수 있는가?',
        cardRef: 'fdic-resolution-weekend',
        frameworkRef: 'resolution-and-backstops',
        metrics: ['regulatorLevel', 'economicTce', 'uninsuredShare', 'distressedBanks'],
      },
      {
        id: 'pol-fx',
        label: '외화 방어선',
        question:
          '가용보유액 기준으로 며칠·몇 개월인가 — 롤오버 협상 시한을 금리보다 먼저 잡았는가?',
        cardRef: 'korea-crisis-toolkit',
        frameworkRef: 'fx-crisis-toolkit',
        metrics: ['usableReserves', 'guidottiRatio', 'importCoverMonths'],
      },
    ],
  },
}

const ROLE_TO_FAMILY: Record<Role, RoleFamily> = {
  bank_cro: 'bank',
  bank_treasurer: 'bank',
  bank_credit_officer: 'bank',
  securities_risk_head: 'securities',
  securities_treasurer: 'securities',
  pb_risk_head: 'securities',
  pension_cio: 'pension',
  ldi_manager: 'pension',
  asset_manager_pm: 'fund',
  central_bank_official: 'policy',
  regulator_official: 'policy',
}

export function roleFamilyOf(role: Role): RoleFamily {
  return ROLE_TO_FAMILY[role] ?? 'bank'
}

export interface PreflightCheck {
  id: string
  label: string
  /** 무엇을 확인하라는 것인지 한 줄. */
  hint: string
  /** 확인할 지표 id (있으면 브리핑이 기준선 값을 함께 보여 준다). */
  metric?: string
}

/**
 * 시작 전 확인 체크리스트 — 차단하지 않는 안내.
 * 브리핑(`ExecutiveSummary`)과 도움 시트의 역할 프레임 패널이 함께 쓴다.
 */
export const PREFLIGHT_BY_FAMILY: Record<RoleFamily, PreflightCheck[]> = {
  bank: [
    {
      id: 'bank-pre-headroom',
      label: '담보 여력(당일)',
      hint: '오늘 실행 가능한 담보차입이 얼마인지, 익일분과 구분해 확인합니다.',
      metric: 'facilityHeadroom',
    },
    {
      id: 'bank-pre-uninsured',
      label: '무보험 예금 비중',
      hint: '런 속도를 결정하는 변수입니다. 비중이 높을수록 30일 가정은 의미가 없습니다.',
      metric: 'uninsuredShare',
    },
    {
      id: 'bank-pre-limits',
      label: '규제 한도',
      hint: 'LCR 100%와 CET1 7.0%(최소 4.5 + 완충 2.5)까지 남은 거리를 확인합니다.',
      metric: 'lcr',
    },
    {
      id: 'bank-pre-survival',
      label: '생존 일수',
      hint: '현금 + 당일 담보차입 여력 ÷ 예상 일일 유출. 3일 미만이면 경고 구간입니다.',
      metric: 'survivalDays',
    },
  ],
  securities: [
    {
      id: 'sec-pre-maturity',
      label: '미처리 만기 4개 합계',
      hint: '미처리 만기와 현재 차환 성공률을 함께 봅니다. 달력상 30일 합계는 아닙니다.',
      metric: 'abcpMaturing30',
    },
    {
      id: 'sec-pre-ncr',
      label: 'NCR 여력',
      hint: '적기시정조치 문턱(100 / 50 / 0%)까지 남은 거리를 확인합니다.',
      metric: 'ncr',
    },
    {
      id: 'sec-pre-guarantee',
      label: '채무보증 배율',
      hint: '매입확약·신용공여 잔액이 자기자본의 몇 배인지 확인합니다.',
      metric: 'guaranteeToEquity',
    },
  ],
  pension: [
    {
      id: 'pen-pre-buffer',
      label: '담보 버퍼(bp)',
      hint: '영란은행 권고 250bp 대비 현재 여력을 확인합니다.',
      metric: 'collateralHeadroomBp',
    },
    {
      id: 'pen-pre-liquid',
      label: '유동자산',
      hint: '담보 보충에 5일이 걸린다는 가정으로 즉시 동원 가능한 자산을 셉니다.',
      metric: 'liquidAssets',
    },
    {
      id: 'pen-pre-leverage',
      label: 'LDI 레버리지',
      hint: '레버리지가 높을수록 같은 금리 상승에 더 많은 담보가 필요합니다.',
      metric: 'ldiLeverage',
    },
  ],
  fund: [
    {
      id: 'fund-pre-weekly',
      label: '1주 유동성비율',
      hint: '위기 가정으로 다시 계산한 값인지 확인합니다. 평시 수치는 위기 수치가 아닙니다.',
      metric: 'weeklyLiquidityPct',
    },
    {
      id: 'fund-pre-illiquid',
      label: '비유동 비중',
      hint: '환매 대응 후 남는 수익자가 떠안게 될 포트폴리오의 질을 나타냅니다.',
      metric: 'illiquidSharePct',
    },
    {
      id: 'fund-pre-pending',
      label: '환매 대기 비중',
      hint: '오늘 마감까지 처리해야 할 환매가 순자산의 몇 퍼센트인지 셉니다.',
      metric: 'redemptionsPendingPct',
    },
  ],
  policy: [
    {
      id: 'pol-pre-scope',
      label: '백스톱 대상',
      hint: '누가 중앙은행 창구에 직접 닿고, 누가 우회 경로를 거쳐야 하는지 확인합니다.',
      metric: 'distressedBanks',
    },
    {
      id: 'pol-pre-reserves',
      label: '가용 재원',
      hint: '헤드라인이 아니라 실제로 쓸 수 있는 재원(가용보유액·기금 캐피탈콜)을 셉니다.',
      metric: 'usableReserves',
    },
    {
      id: 'pol-pre-limits',
      label: '법적 근거',
      hint: '한국은행법 65조·금산법 등 발동 요건과 의결 정족수를 확인합니다.',
    },
  ],
}
