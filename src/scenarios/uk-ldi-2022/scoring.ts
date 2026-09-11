import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/uk-ldi-2022.md §6. 유동성(담보 여력 최저치·강제 디레버리징 없음) 30 · 시장리스크(헤지 유지) 25 ·
 * 지급능력(최종 펀딩비율·파이어세일 손실) 15 · 적시성(T0 준비·5일 내 재자본화) 15 · 소통·규제·정책 각 5.
 */
export const ldiScoring: ScoringSpec = {
  weights: {
    liquidity: 30,
    solvency: 15,
    marketRisk: 25,
    communication: 5,
    compliance: 5,
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
          weight: 0.3,
          label: '생존(헤지 유지)',
        },
        {
          kind: 'metric',
          metric: 'collateralHeadroomBp',
          aggregate: 'min',
          curve: [
            [0, 0],
            [50, 40],
            [150, 80],
            [250, 100],
          ],
          weight: 0.3,
          label: '최저 담보 여력(bp)',
        },
        {
          kind: 'counter',
          key: 'forcedDeleverage',
          curve: [
            [0, 100],
            [0.2, 60],
            [0.5, 20],
            [1, 0],
          ],
          weight: 0.15,
          label: '강제 디레버리징 누적 비율',
        },
        { kind: 'expert', weight: 0.25 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'hedgeRatio',
          aggregate: 'min',
          curve: [
            [30, 0],
            [50, 40],
            [70, 80],
            [80, 100],
          ],
          weight: 0.5,
          label: '최저 헤지비율',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'fundingRatio',
          aggregate: 'final',
          curve: [
            [85, 0],
            [92, 40],
            [97, 70],
            [100, 85],
            [105, 100],
          ],
          weight: 0.4,
          label: '최종 펀딩비율',
        },
        {
          kind: 'counter',
          key: 'fireSaleLoss',
          curve: [
            [0, 100],
            [50, 80],
            [150, 50],
            [300, 20],
            [500, 0],
          ],
          weight: 0.2,
          label: '파이어세일 손실(£M)',
        },
        { kind: 'expert', weight: 0.4 },
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
          label: '최저 신뢰지수(수탁자·스폰서·운용사)',
        },
        { kind: 'expert', weight: 0.6 },
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
            [1, 85],
            [2, 60],
            [3, 30],
            [4, 0],
          ],
          weight: 0.5,
          label: 'TPR 관여 최고 단계',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'buffer_prepared',
          byTurn: 0,
          ifSet: 100,
          ifNot: 30,
          weight: 0.3,
          label: '위기 전 버퍼 확충(T0)',
        },
        {
          kind: 'flag',
          key: 'ops_ready',
          byTurn: 0,
          ifSet: 100,
          ifNot: 40,
          weight: 0.2,
          label: '담보 운영 준비(T0)',
        },
        {
          kind: 'flag',
          key: 'recap_complete',
          byTurn: 3,
          ifSet: 100,
          ifNot: 30,
          weight: 0.2,
          label: '5영업일 내 재자본화 완료(T3까지)',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 55,
}
