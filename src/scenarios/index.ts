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
    },
    load: () =>
      import('./lehman-2008/scenario').then(
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
