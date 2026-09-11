import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/taeyoung-pf-2024.md §6.
 * 자본 28 · 컴플라이언스 18 · 정책 16 · 커뮤니케이션 12 · 유동성 10 · 시장리스크 8 · 적시성 8 = 100.
 *
 * 여신담당 부행장의 성과는 유동성이 아니라 **자본과 절차**에서 갈린다. 그래서 solvency가 가장
 * 무겁고, 그다음이 기촉법·감독규정 준수(compliance)와 제도·정책 창구의 활용(policy)이다.
 * 각 차원은 결과 지표와 선택 옵션 품질(expert)을 반씩 섞는다.
 */
export const pfScoring: ScoringSpec = {
  weights: {
    liquidity: 10,
    solvency: 28,
    marketRisk: 8,
    communication: 12,
    compliance: 18,
    policy: 16,
    timeliness: 8,
  },
  rules: {
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'cet1Ratio',
          aggregate: 'min',
          curve: [
            [6, 0],
            [8, 45],
            [9, 65],
            [10.5, 85],
            [11.5, 100],
          ],
          weight: 0.4,
          label: '최저 CET1 비율',
        },
        {
          kind: 'metric',
          metric: 'cet1Ratio',
          aggregate: 'final',
          curve: [
            [7, 20],
            [8, 50],
            [10, 80],
            [11.5, 100],
          ],
          weight: 0.25,
          label: '약정 시점 CET1 비율',
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
            [1, 85],
            [2, 55],
            [3, 25],
            [4, 0],
          ],
          weight: 0.3,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'classification_frozen',
          ifSet: 20,
          ifNot: 100,
          weight: 0.25,
          label: '자산건전성 분류의 정직성',
        },
        { kind: 'expert', weight: 0.45 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'flag',
          key: 'workout_open',
          ifSet: 100,
          ifNot: 20,
          weight: 0.3,
          label: '기촉법 공동관리절차 개시',
        },
        { kind: 'expert', weight: 0.7 },
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
            [30, 25],
            [45, 55],
            [60, 85],
            [75, 100],
          ],
          weight: 0.4,
          label: '최저 신뢰지수',
        },
        { kind: 'expert', weight: 0.6 },
      ],
    },
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 40,
          disorderlyFail: 0,
          weight: 0.35,
          label: '절차 완주',
        },
        {
          kind: 'metric',
          metric: 'lcr',
          aggregate: 'min',
          curve: [
            [80, 0],
            [100, 60],
            [120, 85],
            [150, 100],
          ],
          weight: 0.25,
          label: '최저 LCR',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'realizedLoss',
          curve: [
            [0, 100],
            [0.4, 85],
            [0.9, 55],
            [1.6, 20],
            [2.4, 0],
          ],
          weight: 0.5,
          label: '세후 실현손실',
        },
        {
          kind: 'counter',
          key: 'deferCost',
          curve: [
            [0, 100],
            [0.1, 80],
            [0.3, 45],
            [0.6, 0],
          ],
          weight: 0.2,
          label: '재구조화 이연 비용',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'open_vote_held',
          byTurn: 2,
          ifSet: 100,
          ifNot: 40,
          weight: 0.3,
          label: '개시 의결 적시 상정',
        },
        {
          kind: 'flag',
          key: 'triage_done',
          byTurn: 4,
          ifSet: 100,
          ifNot: 35,
          weight: 0.35,
          label: '사업장 옥석 가리기 시점',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 58,
}
