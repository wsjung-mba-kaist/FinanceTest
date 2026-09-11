import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/els-margin-2020.md §6.
 * 유동성 32 · 시장리스크 20 · 자본 16 · 정책 12 · 컴플라이언스 10 · 커뮤니케이션 6 · 적시성 4 = 100.
 *
 * 가중치는 이 사건의 실제 구속조건 순서를 따른다: 무너진 것은 자본이 아니라 **통화별 유동성**이었고
 * (금융위 2020.7.30이 사후에 외화 유동자산 보유를 의무화한 이유), 그다음이 헤지 운용에서 난 손실이다
 * (2020년 1분기 파생결합증권 손익 △9,067억). NCR은 대형사에서 실제로 여유가 있었으므로 비중이 낮다.
 * 각 차원 = 결과 지표 + 선택 옵션 품질(expert).
 */
export const elsScoring: ScoringSpec = {
  weights: {
    liquidity: 32,
    solvency: 16,
    marketRisk: 20,
    communication: 6,
    compliance: 10,
    policy: 12,
    timeliness: 4,
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
          label: '생존',
        },
        {
          kind: 'metric',
          metric: 'marginCallPending',
          aggregate: 'max',
          curve: [
            [0, 100],
            [1500, 85],
            [4000, 55],
            [8000, 20],
            [14000, 0],
          ],
          weight: 0.25,
          label: '미납 증거금 최대치',
        },
        {
          kind: 'metric',
          metric: 'fxLiquid',
          aggregate: 'min',
          curve: [
            [0, 0],
            [400, 35],
            [1500, 70],
            [4000, 95],
            [8000, 100],
          ],
          weight: 0.2,
          label: '외화 유동자산 저점',
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
            [100, 0],
            [400, 40],
            [700, 75],
            [1000, 100],
          ],
          weight: 0.4,
          label: '최저 NCR',
        },
        {
          kind: 'metric',
          metric: 'ncr',
          aggregate: 'final',
          curve: [
            [100, 20],
            [600, 60],
            [900, 90],
            [1100, 100],
          ],
          weight: 0.25,
          label: '3월 말 NCR',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'realizedLoss',
          curve: [
            [0, 100],
            [500, 80],
            [2000, 45],
            [5000, 0],
          ],
          weight: 0.25,
          label: '실현 매각·체결손',
        },
        {
          kind: 'counter',
          key: 'fxCost',
          curve: [
            [0, 100],
            [100, 82],
            [400, 45],
            [1000, 0],
          ],
          weight: 0.2,
          label: '달러 조달 비용(스왑 베이시스·슬리피지)',
        },
        {
          kind: 'metric',
          metric: 'hedgeDelta',
          aggregate: 'min',
          curve: [
            [0, 0],
            [0.08, 30],
            [0.18, 80],
            [0.26, 100],
          ],
          weight: 0.2,
          label: '헤지 델타 유지',
        },
        { kind: 'expert', weight: 0.35 },
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
          key: 'lines_exhausted',
          ifSet: 0,
          ifNot: 100,
          weight: 0.2,
          label: '확정 라인 일괄 인출 회피',
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
            [1, 88],
            [2, 60],
            [3, 25],
            [4, 0],
          ],
          weight: 0.3,
          label: '감독당국 최고 단계',
        },
        {
          kind: 'flag',
          key: 'margin_default',
          ifSet: 0,
          ifNot: 100,
          weight: 0.3,
          label: '해외 증거금 결제 이행',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'flag',
          key: 'policy_window_used',
          ifSet: 100,
          ifNot: 40,
          weight: 0.25,
          label: '원화 정책 창구 활용',
        },
        {
          kind: 'flag',
          key: 'bok_swap_used',
          ifSet: 100,
          ifNot: 50,
          weight: 0.25,
          label: '통화스와프자금 입찰 참여',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 't0_fx_buffer',
          byTurn: 1,
          ifSet: 100,
          ifNot: 25,
          weight: 0.5,
          label: '선제 외화 버퍼(3/12~13)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 55,
}
