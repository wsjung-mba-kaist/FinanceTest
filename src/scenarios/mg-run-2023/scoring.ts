import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/mg-run-2023.md §6. 정책담당 역할이므로 커뮤니케이션(30)·유동성(25)·정책(20)이 중심이다.
 * 연체율·순자본은 플레이어가 통제하지 못하므로 지급능력은 5, 시장리스크는 가중치 0(차원은 유지해 레이더에 표시).
 */
export const mgScoring: ScoringSpec = {
  weights: {
    liquidity: 25,
    solvency: 5,
    marketRisk: 0,
    communication: 30,
    compliance: 10,
    policy: 20,
    timeliness: 10,
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
          label: '지급 정지 없음',
        },
        {
          kind: 'metric',
          metric: 'cash',
          aggregate: 'min',
          curve: [
            [0, 0],
            [5, 40],
            [15, 80],
            [30, 100],
          ],
          weight: 0.3,
          label: '최저 상환준비금·가용현금',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'cet1Ratio',
          aggregate: 'min',
          curve: [
            [4, 0],
            [6, 50],
            [8, 100],
          ],
          weight: 0.5,
          label: '최저 순자본비율',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'realizedLoss',
          curve: [
            [0, 100],
            [0.1, 80],
            [0.5, 40],
            [1, 0],
          ],
          weight: 0.5,
          label: '채권 매도 실현손실',
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
          weight: 0.3,
          label: '최저 신뢰지수',
        },
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'final',
          curve: [
            [40, 0],
            [60, 60],
            [70, 90],
            [80, 100],
          ],
          weight: 0.2,
          label: '최종 신뢰지수',
        },
        {
          kind: 'flag',
          key: 'reassurance_contradicted',
          ifSet: 0,
          ifNot: 100,
          weight: 0.15,
          label: '조건부 안심 발언 붕괴 없음',
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
            [2, 70],
            [3, 45],
            [4, 0],
          ],
          weight: 0.4,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'unsafe_act',
          ifSet: 0,
          ifNot: 100,
          weight: 0.2,
          label: '지급 유예 없음',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'metric',
          metric: 'dailyOutflow',
          aggregate: 'final',
          curve: [
            [0.6, 100],
            [0.8, 70],
            [1, 40],
            [2, 0],
          ],
          weight: 0.3,
          label: '최종 일 인출(조원)',
        },
        {
          kind: 'metric',
          metric: 'cumulativeOutflow',
          aggregate: 'final',
          curve: [
            [4, 100],
            [8, 80],
            [12, 40],
            [20, 0],
          ],
          weight: 0.2,
          label: '누적 인출(조원)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'task_force',
          byTurn: 1,
          ifSet: 100,
          ifNot: 40,
          weight: 0.3,
          label: '범정부 대응단 조기 구성(T1)',
        },
        {
          kind: 'flag',
          key: 'rp_line_ready',
          byTurn: 2,
          ifSet: 100,
          ifNot: 50,
          weight: 0.3,
          label: '은행 RP 라인 사전 확보(T0~T2)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
  },
  failureCap: 40,
}
