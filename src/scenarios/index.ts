import type { InstitutionState, ScenarioDefinition, ScenarioSummary } from '../engine/types'
import { PLANNED_SCENARIOS } from './planned'

export interface ScenarioRegistryEntry {
  summary: ScenarioSummary
  load?: () => Promise<ScenarioDefinition<InstitutionState>>
}

const available: ScenarioRegistryEntry[] = [
  {
    summary: {
      id: 'svb-2023',
      version: 1,
      title: '퍼시픽밸리은행: 48시간',
      subtitle: '2023년 3월 실리콘밸리은행 예금인출 사태',
      era: '2023-03',
      year: 2023,
      region: 'global',
      role: 'bank_treasurer',
      roleTitle: '최고리스크책임자 겸 자금담당임원(CRO/Treasurer)',
      institutionType: 'bank',
      institutionName: '퍼시픽밸리은행(Pacific Valley Bank)',
      difficulty: 'standard',
      durationTurns: 9,
      turnUnit: 'hour',
      estMinutes: 40,
      competencies: { liquidity: 3, solvency: 2, communication: 2, compliance: 2, marketRisk: 1 },
      tags: ['뱅크런', 'LCR', 'HTM', '재할인창구', 'BTFP', '디지털 런'],
      status: 'available',
      cardRefs: [
        'lcr-basics',
        'uninsured-deposits-and-run-speed',
        'afs-htm-aoci',
        'discount-window-fhlb-btfp',
        'contingency-funding-plan',
        'economic-vs-regulatory-capital',
      ],
    },
    load: () =>
      import('./svb-2023/scenario').then((m) => m.default as ScenarioDefinition<InstitutionState>),
  },
  {
    summary: {
      id: 'legoland-2022',
      version: 1,
      title: '차환의 벽: 레고랜드 이후',
      subtitle: '2022년 10월 PF-ABCP 시장 경색',
      era: '2022-10',
      year: 2022,
      region: 'korea',
      role: 'securities_risk_head',
      roleTitle: '중형 증권사 최고리스크책임자(CRO)',
      institutionType: 'securities',
      institutionName: '한빛증권(가상)',
      difficulty: 'standard',
      durationTurns: 9,
      turnUnit: 'day',
      estMinutes: 40,
      competencies: { liquidity: 3, solvency: 2, compliance: 2, policy: 1, communication: 1 },
      tags: ['PF-ABCP', 'NCR', '채안펀드', '콜옵션'],
      status: 'available',
      cardRefs: [
        'pf-abcp-commitment-ncr',
        'korea-crisis-toolkit',
        'contingency-funding-plan',
        'crisis-communication',
        'regulator-escalation-ladder',
        'hqla-and-haircuts',
      ],
    },
    load: () =>
      import('./legoland-2022/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'mg-run-2023',
      version: 1,
      title: '금고 앞의 줄',
      subtitle: '2023년 7월 새마을금고 예금인출',
      era: '2023-07',
      year: 2023,
      region: 'korea',
      role: 'regulator_official',
      roleTitle: '중앙회 자금담당 / 범정부 대응단 담당관',
      institutionType: 'bank',
      institutionName: '상호금융 중앙회(가상)',
      difficulty: 'intro',
      durationTurns: 7,
      turnUnit: 'day',
      estMinutes: 30,
      competencies: { liquidity: 2, communication: 3, policy: 2, compliance: 1 },
      tags: ['뱅크런', '예금자보호', 'RP', '커뮤니케이션'],
      status: 'available',
      cardRefs: [
        'mutual-credit-deposit-protection',
        'korea-crisis-toolkit',
        'crisis-communication',
        'bank-run-dynamics',
        'uninsured-deposits-and-run-speed',
        'regulator-escalation-ladder',
      ],
    },
    load: () =>
      import('./mg-run-2023/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'uk-ldi-2022',
      version: 1,
      title: '길트 스파이럴: 13일',
      subtitle: '2022년 9월 영국 LDI·국채 위기',
      era: '2022-09',
      year: 2022,
      region: 'global',
      role: 'pension_cio',
      roleTitle: 'DB 연기금 최고투자책임자(CIO)',
      institutionType: 'pension',
      institutionName: '노스브리지 연금스킴(Northbridge Pension Scheme)',
      difficulty: 'standard',
      durationTurns: 8,
      turnUnit: 'day',
      estMinutes: 35,
      competencies: { liquidity: 3, marketRisk: 3, communication: 1, compliance: 1 },
      tags: ['LDI', '마진콜', '레버리지', 'BoE'],
      status: 'available',
      cardRefs: [
        'ldi-leverage-buffer-250bp',
        'ldi-collateral-waterfall',
        'hqla-and-haircuts',
        'regulator-escalation-ladder',
      ],
    },
    load: () =>
      import('./uk-ldi-2022/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'lehman-2008',
      version: 1,
      title: '리먼 주간',
      subtitle: '2008년 9월 투자은행 자금조달 붕괴',
      era: '2008-09',
      year: 2008,
      region: 'global',
      role: 'bank_treasurer',
      roleTitle: '대형 투자은행 자금담당(Treasurer)',
      institutionType: 'bank',
      institutionName: '메리디언 브라더스(Meridian Brothers)',
      difficulty: 'advanced',
      durationTurns: 8,
      turnUnit: 'day',
      estMinutes: 45,
      competencies: { liquidity: 3, marketRisk: 2, communication: 2, policy: 2 },
      tags: ['트라이파티 레포', 'PB', '연준', '파산'],
      status: 'available',
      cardRefs: [
        'tri-party-repo-run',
        'contingency-funding-plan',
        'crisis-communication',
        'hqla-and-haircuts',
        'discount-window-fhlb-btfp',
        'fdic-resolution-weekend',
        'bank-run-dynamics',
      ],
    },
    load: () =>
      import('./lehman-2008/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'korea-imf-1997',
      version: 1,
      title: '가용외환보유액 39억달러',
      subtitle: '1997년 외환위기',
      era: '1997-11',
      year: 1997,
      region: 'korea',
      role: 'central_bank_official',
      roleTitle: '재경원·한은 정책담당',
      institutionType: 'central_bank',
      institutionName: '대한민국 외환당국',
      difficulty: 'advanced',
      durationTurns: 10,
      turnUnit: 'week',
      estMinutes: 50,
      competencies: { policy: 3, liquidity: 2, communication: 2, compliance: 1 },
      tags: ['환율', 'IMF', '종금사', '외채 롤오버'],
      status: 'available',
      cardRefs: [
        'korea-crisis-toolkit',
        'contingency-funding-plan',
        'crisis-communication',
        'regulator-escalation-ladder',
        'bank-run-dynamics',
      ],
    },
    load: () =>
      import('./korea-imf-1997/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'covid-2020-fund',
      version: 1,
      title: '현금 확보 쇄도',
      subtitle: '2020년 3월 회사채 펀드 환매 위기',
      era: '2020-03',
      year: 2020,
      region: 'global',
      role: 'asset_manager_pm',
      roleTitle: '회사채 펀드 포트폴리오매니저(PM)',
      institutionType: 'asset_manager',
      institutionName: '하버라이트 크레딧펀드(Harborlight Credit Fund)',
      difficulty: 'standard',
      durationTurns: 8,
      turnUnit: 'day',
      estMinutes: 35,
      competencies: { liquidity: 3, marketRisk: 3, communication: 1 },
      tags: ['환매', '스윙프라이싱', 'ETF', 'SMCCF'],
      status: 'available',
      cardRefs: [
        'fund-liquidity-ladder',
        'hqla-and-haircuts',
        'crisis-communication',
        'bank-run-dynamics',
      ],
    },
    load: () =>
      import('./covid-2020-fund/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'els-margin-2020',
      version: 2,
      title: '마진콜 5조',
      subtitle: '2020년 3월 증권사 ELS 헤지 위기',
      era: '2020-03',
      year: 2020,
      region: 'korea',
      role: 'securities_treasurer',
      roleTitle: '대형 증권사 자금부장(자금담당임원)',
      institutionType: 'securities',
      institutionName: '대한투자증권(가상)',
      difficulty: 'standard',
      durationTurns: 8,
      turnUnit: 'day',
      estMinutes: 35,
      competencies: { liquidity: 3, marketRisk: 2, compliance: 1, policy: 1, solvency: 1 },
      tags: ['ELS', '마진콜', '통화스와프', 'CP', '자체헤지', '외화유동성'],
      status: 'available',
      cardRefs: [
        'ldi-collateral-waterfall',
        'contingency-funding-plan',
        'korea-crisis-toolkit',
        'hqla-and-haircuts',
        'crisis-communication',
        'regulator-escalation-ladder',
      ],
    },
    load: () =>
      import('./els-margin-2020/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'credit-suisse-2023',
      version: 1,
      title: '취리히의 주말',
      subtitle: '2023년 3월 크레디트스위스 정리',
      era: '2023-03',
      year: 2023,
      region: 'global',
      role: 'regulator_official',
      roleTitle: 'FINMA·SNB 정책담당',
      institutionType: 'central_bank',
      institutionName: '스위스 금융당국',
      difficulty: 'advanced',
      durationTurns: 6,
      turnUnit: 'day',
      estMinutes: 30,
      competencies: { policy: 3, compliance: 2, communication: 2, solvency: 1 },
      tags: ['AT1', 'ELA', '합병', '베일인', '정리 주말', '긴급명령'],
      status: 'available',
      cardRefs: [
        'fdic-resolution-weekend',
        'bank-run-dynamics',
        'crisis-communication',
        'regulator-escalation-ladder',
        'economic-vs-regulatory-capital',
        'uninsured-deposits-and-run-speed',
        'discount-window-fhlb-btfp',
        'contingency-funding-plan',
      ],
    },
    load: () =>
      import('./credit-suisse-2023/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'taeyoung-pf-2024',
      version: 2,
      title: '워크아웃 동의율 75%',
      subtitle: '2024년 부동산 PF 구조조정',
      era: '2023-12',
      year: 2024,
      region: 'korea',
      role: 'bank_credit_officer',
      roleTitle: '주채권은행 여신담당 부행장',
      institutionType: 'bank',
      institutionName: '한서은행(가상)',
      difficulty: 'standard',
      durationTurns: 8,
      turnUnit: 'week',
      estMinutes: 35,
      competencies: { solvency: 3, compliance: 2, policy: 2, communication: 1, marketRisk: 1 },
      tags: ['워크아웃', '출자전환', '사업성 평가', '기촉법', '동의율', '대손충당금'],
      status: 'available',
      cardRefs: [
        'korea-crisis-toolkit',
        'economic-vs-regulatory-capital',
        'regulator-escalation-ladder',
        'pf-abcp-commitment-ncr',
        'crisis-communication',
      ],
    },
    load: () =>
      import('./taeyoung-pf-2024/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'archegos-2021',
      version: 1,
      title: '죄수의 딜레마',
      subtitle: '2021년 3월 아케고스 청산',
      era: '2021-03',
      year: 2021,
      region: 'global',
      role: 'pb_risk_head',
      roleTitle: '프라임브로커 리스크 헤드',
      institutionType: 'prime_broker',
      institutionName: '알파인은행 프라임서비스(Alpine Bank Prime)',
      difficulty: 'advanced',
      durationTurns: 7,
      turnUnit: 'day',
      estMinutes: 35,
      competencies: { marketRisk: 3, compliance: 2, solvency: 2, communication: 1, policy: 2 },
      tags: ['TRS', '마진', '집중도', '블록 매각', '카운터파티 신용리스크'],
      status: 'available',
      cardRefs: [
        'economic-vs-regulatory-capital',
        'hqla-and-haircuts',
        'regulator-escalation-ladder',
        'crisis-communication',
        'tri-party-repo-run',
      ],
    },
    load: () =>
      import('./archegos-2021/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
  {
    summary: {
      id: 'ltcm-1998',
      version: 1,
      title: '컨소시엄',
      subtitle: '1998년 LTCM 구제 — 해밀턴로스 프라임브로커리지',
      era: '1998-09',
      year: 1998,
      region: 'global',
      role: 'pb_risk_head',
      roleTitle: '프라임브로커 리스크 헤드',
      institutionType: 'prime_broker',
      institutionName: '해밀턴로스(Hamilton Ross & Co.) 프라임브로커리지·파생 부문',
      difficulty: 'advanced',
      durationTurns: 6,
      turnUnit: 'day',
      estMinutes: 30,
      competencies: { marketRisk: 3, policy: 2, communication: 2, solvency: 1, compliance: 1 },
      tags: ['레버리지', '수렴 거래', '담보 재산정', '합산 익스포저', '컨소시엄', '집단행동'],
      status: 'available',
      cardRefs: [
        'hqla-and-haircuts',
        'economic-vs-regulatory-capital',
        'crisis-communication',
        'fdic-resolution-weekend',
        'regulator-escalation-ladder',
        'tri-party-repo-run',
      ],
    },
    load: () =>
      import('./ltcm-1998/scenario').then((m) => m.default as ScenarioDefinition<InstitutionState>),
  },
  {
    summary: {
      id: 'savings-bank-2011',
      version: 1,
      title: '영업정지 명령',
      subtitle: '2011년 저축은행 구조조정',
      era: '2011-02',
      year: 2011,
      region: 'korea',
      role: 'regulator_official',
      roleTitle: '금융위·금감원 정책담당',
      institutionType: 'central_bank',
      institutionName: '금융당국',
      difficulty: 'standard',
      durationTurns: 8,
      turnUnit: 'day',
      estMinutes: 35,
      competencies: { policy: 3, communication: 2, compliance: 2, liquidity: 1 },
      tags: ['영업정지', 'P&A', '예보', '후순위채', '적기시정조치', '전염'],
      status: 'available',
      cardRefs: [
        'korea-crisis-toolkit',
        'regulator-escalation-ladder',
        'bank-run-dynamics',
        'uninsured-deposits-and-run-speed',
        'crisis-communication',
        'fdic-resolution-weekend',
      ],
    },
    load: () =>
      import('./savings-bank-2011/scenario').then(
        (m) => m.default as ScenarioDefinition<InstitutionState>,
      ),
  },
]

export const SCENARIOS: ScenarioRegistryEntry[] = [
  ...available,
  ...PLANNED_SCENARIOS.map((summary) => ({ summary })),
]

export function getScenarioSummary(id: string): ScenarioSummary | undefined {
  return SCENARIOS.find((s) => s.summary.id === id)?.summary
}

const cache = new Map<string, Promise<ScenarioDefinition<InstitutionState>>>()

export function loadScenario(
  id: string,
): Promise<ScenarioDefinition<InstitutionState> | undefined> {
  const entry = SCENARIOS.find((s) => s.summary.id === id)
  if (!entry?.load) return Promise.resolve(undefined)
  let p = cache.get(id)
  if (!p) {
    p = entry.load()
    cache.set(id, p)
  }
  return p
}

/** All scenario definitions that are available (for tests / DEV inspector). */
export async function loadAllAvailable(): Promise<ScenarioDefinition<InstitutionState>[]> {
  const defs = await Promise.all(SCENARIOS.filter((s) => s.load).map((s) => s.load!()))
  return defs
}
