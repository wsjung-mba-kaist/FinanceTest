import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/ltcm-1998.md §6. 가중치 합 100:
 * 시장리스크 30 · 자본 20 · 정책 15 · 규제준수 10 · 커뮤니케이션 10 · 유동성 5 · 적시성 10.
 *
 * 역할이 프라임브로커 리스크 헤드이므로 **시장리스크(익스포저·담보·청산)** 가 가장 무겁고,
 * 컨소시엄 성립 여부는 **정책** 차원으로 잡는다(연준이 자금을 대지 않은 민간 해법이었다는 점이
 * 이 시나리오의 정책 교훈이다). 유동성 가중치가 낮은 것은 의도된 설계다 — 이 시나리오에서
 * 딜러를 구속한 것은 자금이 아니라 **정보와 집단행동**이었다.
 *
 * 무질서한 실패 상한 40, 질서 있는 실패 상한 62. 컨소시엄이 성립하면 실패가 아니므로 상한이 없다.
 */
export const ltcmScoring: ScoringSpec = {
  weights: {
    liquidity: 5,
    solvency: 20,
    marketRisk: 30,
    communication: 10,
    compliance: 10,
    policy: 15,
    timeliness: 10,
  },
  rules: {
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'netExposureB',
          aggregate: 'max',
          curve: [
            [0, 100],
            [0.2, 80],
            [0.45, 45],
            [0.8, 0],
          ],
          weight: 0.3,
          label: '최대 순익스포저(담보 차감 후)',
        },
        {
          kind: 'metric',
          metric: 'marginCoverage',
          aggregate: 'min',
          curve: [
            [0, 0],
            [50, 35],
            [100, 65],
            [160, 88],
            [220, 100],
          ],
          weight: 0.3,
          label: '최저 마진 커버리지(담보 / 청산 VaR)',
        },
        { kind: 'expert', weight: 0.4, label: '전문가 정합(익스포저·담보 결정)' },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'firmCapital',
          aggregate: 'final',
          curve: [
            [7.2, 0],
            [8, 35],
            [8.6, 70],
            [8.95, 95],
            [9.2, 100],
          ],
          weight: 0.35,
          label: '최종 부문 자본',
        },
        {
          kind: 'metric',
          metric: 'realizedLoss',
          aggregate: 'final',
          curve: [
            [0, 100],
            [0.2, 82],
            [0.5, 50],
            [1, 15],
            [1.8, 0],
          ],
          weight: 0.25,
          label: '누적 손실(평가·실현 합계)',
        },
        { kind: 'expert', weight: 0.4, label: '전문가 정합(손실 통제 결정)' },
      ],
    },
    policy: {
      components: [
        {
          kind: 'flag',
          key: 'deal_closed',
          ifSet: 100,
          ifNot: 0,
          weight: 0.3,
          label: '컨소시엄 성립(질서 있는 인수)',
        },
        {
          kind: 'flag',
          key: 'joined_consortium',
          ifSet: 100,
          ifNot: 45,
          weight: 0.25,
          label: '집단행동에 스스로 참여',
        },
        { kind: 'expert', weight: 0.45, label: '전문가 정합(집단행동 결정)' },
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
            [3, 40],
            [4, 0],
          ],
          weight: 0.35,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'unilateral_seizure',
          ifSet: 0,
          ifNot: 100,
          weight: 0.2,
          label: '계약 근거 없는 담보 압류 없음',
        },
        { kind: 'expert', weight: 0.45, label: '전문가 정합(계약·감독 준수)' },
      ],
    },
    communication: {
      components: [
        {
          kind: 'metric',
          metric: 'peerCooperation',
          aggregate: 'final',
          curve: [
            [0, 0],
            [35, 30],
            [55, 60],
            [75, 85],
            [90, 100],
          ],
          weight: 0.4,
          label: '최종 타 딜러 협조도',
        },
        {
          kind: 'flag',
          key: 'aggregate_known',
          ifSet: 100,
          ifNot: 40,
          weight: 0.2,
          label: '합산 익스포저 파악',
        },
        { kind: 'expert', weight: 0.4, label: '전문가 정합(정보 공유 결정)' },
      ],
    },
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 40,
          disorderlyFail: 0,
          weight: 0.5,
          label: '생존(질서 있는 실패 40)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'info_exchange',
          byTurn: 2,
          ifSet: 100,
          ifNot: 35,
          weight: 0.3,
          label: '익스포저 정보 교환 개시(9/18까지)',
        },
        {
          kind: 'flag',
          key: 'fed_engaged',
          byTurn: 2,
          ifSet: 100,
          ifNot: 40,
          weight: 0.25,
          label: '뉴욕연준 조기 접촉(9/18까지)',
        },
        { kind: 'expert', weight: 0.45, label: '전문가 정합(시점 선택)' },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 62,
}
