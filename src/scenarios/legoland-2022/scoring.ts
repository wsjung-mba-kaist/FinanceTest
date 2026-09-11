import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/legoland-2022.md §6. 유동성 30 · 자본 25 · 컴플라이언스 15 · 커뮤니케이션 10 · 정책 10 ·
 * 시장리스크 5 · 적시성 5. 각 차원 = 결과 지표 + 선택 옵션 품질(expert).
 */
export const legoScoring: ScoringSpec = {
  weights: {
    liquidity: 30,
    solvency: 25,
    marketRisk: 5,
    communication: 10,
    compliance: 15,
    policy: 10,
    timeliness: 5,
  },
  rules: {
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 35,
          disorderlyFail: 0,
          weight: 0.4,
          label: '생존',
        },
        {
          kind: 'metric',
          metric: 'liquidityRatio',
          aggregate: 'min',
          curve: [
            [50, 0],
            [100, 60],
            [120, 90],
            [150, 100],
          ],
          weight: 0.35,
          label: '최저 유동성비율',
        },
        { kind: 'expert', weight: 0.25 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'ncr',
          aggregate: 'min',
          curve: [
            [0, 0],
            [100, 50],
            [150, 80],
            [250, 100],
          ],
          weight: 0.45,
          label: '최저 NCR',
        },
        {
          kind: 'metric',
          metric: 'ncr',
          aggregate: 'final',
          curve: [
            [100, 40],
            [150, 70],
            [200, 100],
          ],
          weight: 0.25,
          label: '연말 NCR',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'realizedLoss',
          curve: [
            [0, 100],
            [100, 70],
            [300, 30],
            [600, 0],
          ],
          weight: 0.5,
          label: '실현 매각손',
        },
        { kind: 'expert', weight: 0.5 },
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
          key: 'call_skipped',
          ifSet: 0,
          ifNot: 100,
          weight: 0.2,
          label: '콜옵션 관행 준수',
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
            [2, 65],
            [3, 30],
            [4, 0],
          ],
          weight: 0.3,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'abcp_default',
          ifSet: 0,
          ifNot: 100,
          weight: 0.3,
          label: '매입확약 이행',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'flag',
          key: 'programme_used',
          ifSet: 100,
          ifNot: 40,
          weight: 0.3,
          label: '정책 프로그램 활용',
        },
        { kind: 'expert', weight: 0.7 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 't0_buffer',
          byTurn: 0,
          ifSet: 100,
          ifNot: 30,
          weight: 0.5,
          label: '선제 버퍼(T0)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 55,
}
