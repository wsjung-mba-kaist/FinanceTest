import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/lehman-2008.md §6. 가중치 합 100: 유동성 30 · 자본 15 · 시장리스크 10 · 커뮤니케이션 15 · 규제 15 ·
 * 정책 5 · 적시성 10. 생존은 유동성 차원의 survival 컴포넌트(생존 100 / 질서 있는 실패 40 / 무질서 0).
 * 무질서 실패 상한 40, 질서 있는 실패(pre-packaged Chapter 11) 상한 62.
 */
export const lehmanScoring: ScoringSpec = {
  weights: {
    liquidity: 30,
    solvency: 15,
    marketRisk: 10,
    communication: 15,
    compliance: 15,
    policy: 5,
    timeliness: 10,
  },
  rules: {
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 40,
          disorderlyFail: 0,
          weight: 0.45,
          label: '생존(질서 있는 실패 40)',
        },
        {
          kind: 'flag',
          key: 'sold_with_support',
          ifSet: 40,
          ifNot: 100,
          weight: 0.15,
          label: '독립성 유지(정부 지원부 매각은 부분점수)',
        },
        {
          kind: 'metric',
          metric: 'survivalDays',
          aggregate: 'min',
          curve: [
            [0, 0],
            [0.5, 30],
            [1, 60],
            [2, 85],
            [4, 100],
          ],
          weight: 0.1,
          label: '최저 생존 일수',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'economicTce',
          aggregate: 'final',
          curve: [
            [-1, 0],
            [1, 40],
            [2.5, 80],
            [4, 100],
          ],
          weight: 0.3,
          label: '최종 시장 기준 유형자기자본',
        },
        {
          kind: 'metric',
          metric: 'leverageRatio',
          aggregate: 'min',
          curve: [
            [1.5, 0],
            [2, 30],
            [3, 80],
            [4.5, 100],
          ],
          weight: 0.25,
          label: '최저 레버리지비율',
        },
        {
          kind: 'counter',
          key: 'realizedLoss',
          curve: [
            [0, 100],
            [3, 75],
            [8, 40],
            [15, 0],
          ],
          weight: 0.15,
          label: '실현 손실(파이어세일·자본 기여)',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'repoRollRate',
          aggregate: 'min',
          curve: [
            [50, 0],
            [70, 40],
            [85, 80],
            [100, 100],
          ],
          weight: 0.4,
          label: '최저 트라이파티 레포 롤오버율',
        },
        { kind: 'expert', weight: 0.6 },
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
            [20, 30],
            [40, 60],
            [60, 90],
            [100, 100],
          ],
          weight: 0.35,
          label: '최저 신뢰지수',
        },
        {
          kind: 'flag',
          key: 'unsafe_act',
          ifSet: 0,
          ifNot: 100,
          weight: 0.15,
          label: '불건전 행위 없음',
        },
        {
          kind: 'flag',
          key: 'pool_contradicted',
          ifSet: 20,
          ifNot: 100,
          weight: 0.15,
          label: '유동성 풀 공표 모순 없음',
        },
        { kind: 'expert', weight: 0.35 },
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
            [2, 75],
            [3, 50],
            [4, 0],
          ],
          weight: 0.35,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'fed_engaged',
          byTurn: 3,
          ifSet: 100,
          ifNot: 30,
          weight: 0.25,
          label: '연준 조기 접촉(금요일까지)',
        },
        {
          kind: 'flag',
          key: 'customer_assets_segregated',
          ifSet: 100,
          ifNot: 50,
          weight: 0.1,
          label: '고객 자산 분리 확인',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'flag',
          key: 'prepack',
          ifSet: 100,
          ifNot: 40,
          weight: 0.4,
          label: '사전 조율된 정리',
        },
        { kind: 'expert', weight: 0.6 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'pdcf_prepositioned',
          byTurn: 0,
          ifSet: 100,
          ifNot: 30,
          weight: 0.4,
          label: 'PDCF 담보 사전 예치(T0)',
        },
        {
          kind: 'flag',
          key: 'nb_sale_signed',
          byTurn: 0,
          ifSet: 100,
          ifNot: 40,
          weight: 0.2,
          label: '확정 매각 계약(T0)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 62,
}
