import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/svb-2023.md §6 (생존 35 · 유동성 20 · 자본 15 · 커뮤니케이션·프로세스 15 · 전문가 정합 15)
 * 를 엔진의 7차원에 매핑. 생존은 유동성 차원의 survival 컴포넌트(가중 0.5)로 표현한다.
 */
export const svbScoring: ScoringSpec = {
  weights: {
    liquidity: 30,
    solvency: 15,
    marketRisk: 5,
    communication: 15,
    compliance: 15,
    policy: 5,
    timeliness: 15,
  },
  rules: {
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 35,
          disorderlyFail: 0,
          weight: 0.5,
          label: '생존',
        },
        {
          kind: 'metric',
          metric: 'survivalDays',
          aggregate: 'min',
          curve: [
            [0, 0],
            [1, 40],
            [3, 80],
            [5, 100],
          ],
          weight: 0.25,
          label: '최저 생존 일수',
        },
        { kind: 'expert', weight: 0.25 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'economicTce',
          aggregate: 'final',
          curve: [
            [-3, 0],
            [0, 40],
            [3, 80],
            [6, 100],
          ],
          weight: 0.35,
          label: '최종 경제적 TCE',
        },
        {
          kind: 'metric',
          metric: 'cet1Ratio',
          aggregate: 'min',
          curve: [
            [2, 0],
            [4.5, 30],
            [7, 70],
            [10, 100],
          ],
          weight: 0.25,
          label: '최저 CET1',
        },
        {
          kind: 'counter',
          key: 'dilution',
          curve: [
            [0, 100],
            [0.2, 80],
            [0.4, 50],
            [0.6, 20],
          ],
          weight: 0.15,
          label: '희석',
        },
        { kind: 'expert', weight: 0.25 },
      ],
    },
    communication: {
      components: [
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'min',
          curve: [
            [0, 0],
            [30, 30],
            [50, 60],
            [70, 90],
            [100, 100],
          ],
          weight: 0.4,
          label: '최저 신뢰지수',
        },
        {
          kind: 'flag',
          key: 'unsafe_act',
          ifSet: 0,
          ifNot: 100,
          weight: 0.2,
          label: '불건전 행위 없음',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    compliance: {
      components: [
        {
          kind: 'metric',
          metric: 'regulatorLevel',
          aggregate: 'max',
          curve: [
            [0, 100],
            [1, 90],
            [2, 70],
            [3, 45],
            [4, 0],
          ],
          weight: 0.4,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'regulator_engaged',
          byTurn: 4,
          ifSet: 100,
          ifNot: 30,
          weight: 0.3,
          label: '감독당국 조기 접촉',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'collateral_prepositioned',
          byTurn: 0,
          ifSet: 100,
          ifNot: 30,
          weight: 0.5,
          label: '담보 사전 예치(T0)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 55,
}
