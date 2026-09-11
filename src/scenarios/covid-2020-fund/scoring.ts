import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/covid-2020-fund.md §6.
 *
 * 유동성 30 — 사다리를 지켰는가(현금·1주 유동성 최저치)와 강제 게이트 없이 통과했는가.
 * 시장리스크 20 — 잔존 포트폴리오의 질(비유동 비중 최고치)과 잔존 투자자 희석 누적.
 * 소통 15 — 대형 보유자·이사회 소통(신뢰지수 최저치 + 선택 옵션 품질).
 * 지급능력 10 — 최종 기준가(시장 손실은 외생, 파이어세일·집중도 마크다운이 차이를 만든다).
 * 규제 10 — 감독당국 단계와 자발적 게이트 여부.
 * 정책 5 · 적시성 10 — 도구를 **미리** 갖추었는가(사전 결의·비례 원칙·사다리 재건 시점).
 */
export const fundScoring: ScoringSpec = {
  weights: {
    liquidity: 30,
    solvency: 10,
    marketRisk: 20,
    communication: 15,
    compliance: 10,
    policy: 5,
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
          weight: 0.25,
          label: '강제 게이트 없이 완주',
        },
        {
          kind: 'metric',
          metric: 'cashBufferPct',
          aggregate: 'min',
          curve: [
            [0, 0],
            [1, 25],
            [3, 55],
            [5, 80],
            [8, 100],
          ],
          weight: 0.25,
          label: '최저 현금·1일 유동성 비중',
        },
        {
          kind: 'metric',
          metric: 'weeklyLiquidityPct',
          aggregate: 'min',
          curve: [
            [0, 0],
            [5, 30],
            [10, 60],
            [15, 85],
            [20, 100],
          ],
          weight: 0.15,
          label: '최저 1주 유동성 비중',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'illiquidSharePct',
          aggregate: 'max',
          curve: [
            [30, 100],
            [35, 92],
            [42, 60],
            [50, 25],
            [60, 0],
          ],
          weight: 0.4,
          label: '비유동 비중 최고치(잔존 포트폴리오의 질)',
        },
        {
          kind: 'metric',
          metric: 'dilutionBp',
          aggregate: 'final',
          curve: [
            [0, 100],
            [25, 82],
            [60, 55],
            [120, 22],
            [200, 0],
          ],
          weight: 0.25,
          label: '누적 희석(bp) — 잔존 투자자가 부담한 비용',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'navIndex',
          aggregate: 'final',
          curve: [
            [75, 0],
            [82, 35],
            [86, 62],
            [90, 85],
            [95, 100],
          ],
          weight: 0.6,
          label: '최종 기준가 지수(2/28 = 100)',
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
          label: '최저 신뢰지수(보유자·이사회·딜러)',
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
          weight: 0.4,
          label: '감독당국 관여 최고 단계',
        },
        {
          kind: 'flag',
          key: 'gated_voluntary',
          ifSet: 15,
          ifNot: 100,
          weight: 0.25,
          label: '자발적 환매 중단 여부',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
    policy: {
      components: [{ kind: 'expert', weight: 1, label: '정책 백스톱 활용·해석' }],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'swing_preset',
          byTurn: 0,
          ifSet: 100,
          ifNot: 35,
          weight: 0.3,
          label: '희석방지도구 사전 결의(T0까지)',
        },
        {
          kind: 'flag',
          key: 'vertical_policy',
          byTurn: 1,
          ifSet: 100,
          ifNot: 45,
          weight: 0.2,
          label: '비례 매도 원칙 조기 채택(T1까지)',
        },
        {
          kind: 'flag',
          key: 'ladder_rebuilt',
          byTurn: 6,
          ifSet: 100,
          ifNot: 55,
          weight: 0.15,
          label: '백스톱이 열린 동안 사다리 재건(T6까지)',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 60,
}
