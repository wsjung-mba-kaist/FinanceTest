import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/archegos-2021.md §6. 프라임브로커 리스크 헤드의 직무는 「담보를 얼마나 쌓느냐」가
 * 아니라 「집중 익스포저를 어떻게 재고, 언제 줄이며, 정리 국면에서 무엇을 약속하고 지키느냐」다.
 * 그래서 시장리스크(집중도·청산 소요일·마진 커버리지) 28 · 지급능력(실현 손실) 18 ·
 * 규제(감독 단계·에스컬레이션) 18 · 정책(업계 합산 손실 = 시스템 결과) 10 · 소통 10 ·
 * 적시성(위기 **전** 마진 체계 전환, 디폴트 선언 시점) 10 · 유동성(미회수 익스포저) 6.
 *
 * 기본 prime_broker 가중에서 정책 비중을 남긴 이유: 이 시나리오의 죄수의 딜레마는 자사 손실만
 * 최소화하면 이기는 게임이 아니다. 먼저 팔면 자사 손실은 줄지만 업계 합산 손실과 감독 비용이
 * 커지며, 그 차이를 점수에 반영하지 않으면 잘못된 교훈이 남는다 (calibration.md §9).
 */
export const archegosScoring: ScoringSpec = {
  weights: {
    liquidity: 6,
    solvency: 18,
    marketRisk: 28,
    communication: 10,
    compliance: 18,
    policy: 10,
    timeliness: 10,
  },
  rules: {
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'concentrationDays',
          aggregate: 'max',
          curve: [
            [4, 100],
            [10, 75],
            [20, 45],
            [36, 10],
            [50, 0],
          ],
          weight: 0.3,
          label: '최대 청산 소요일(ADV 20% 참여 기준)',
        },
        {
          kind: 'metric',
          metric: 'marginCoverage',
          aggregate: 'min',
          curve: [
            [10, 0],
            [25, 40],
            [50, 75],
            [80, 100],
          ],
          weight: 0.25,
          label: '최저 마진 커버리지(담보 / 청산 VaR)',
        },
        { kind: 'expert', weight: 0.45 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'realizedLoss',
          aggregate: 'final',
          curve: [
            [0, 100],
            [1, 85],
            [2.5, 60],
            [5.5, 25],
            [8, 0],
          ],
          weight: 0.45,
          label: '최종 실현 손실($B)',
        },
        { kind: 'expert', weight: 0.55 },
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
          weight: 0.4,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'escalated_to_board',
          byTurn: 1,
          ifSet: 100,
          ifNot: 35,
          weight: 0.2,
          label: '한도 초과의 이사회·그룹 리스크위 에스컬레이션(프롤로그)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'metric',
          metric: 'industryLoss',
          aggregate: 'final',
          curve: [
            [2, 100],
            [6, 75],
            [11, 45],
            [18, 0],
          ],
          weight: 0.5,
          label: '업계 합산 손실($B) — 시스템 결과',
        },
        {
          kind: 'counter',
          key: 'capBreachPct',
          curve: [
            [0, 100],
            [5, 60],
            [20, 20],
            [40, 0],
          ],
          weight: 0.2,
          label: '약속한 일일 매각 상한 초과(%p)',
        },
        { kind: 'expert', weight: 0.3 },
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
          label: '최저 신뢰지수(카운터파티·감독당국·이사회)',
        },
        { kind: 'expert', weight: 0.6 },
      ],
    },
    liquidity: {
      components: [
        {
          kind: 'metric',
          metric: 'marginShortfall',
          aggregate: 'max',
          curve: [
            [0, 100],
            [1, 75],
            [3, 40],
            [6, 0],
          ],
          weight: 0.5,
          label: '최대 미회수 익스포저($B)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'dynamic_margin',
          byTurn: 1,
          ifSet: 100,
          ifNot: 30,
          weight: 0.3,
          label: '위기 전 동적 마진 전환(프롤로그 T0·T1)',
        },
        {
          kind: 'flag',
          key: 'default_declared',
          byTurn: 4,
          ifSet: 100,
          ifNot: 40,
          weight: 0.2,
          label: '3/25까지 디폴트 선언',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 58,
}
