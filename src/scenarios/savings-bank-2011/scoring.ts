import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/savings-bank-2011.md §6.
 *
 * 정책당국 역할이므로 정책(30)·커뮤니케이션(25)이 중심이고, 재원 관리를 유동성(15)으로, 법이 정한
 * 범위를 지키는 것을 규제준수(15)로 본다. 업권의 자본은 플레이어가 직접 통제하지 못하므로
 * 지급능력은 5, 시장리스크는 가중치 0(차원은 유지해 레이더에 표시)이다.
 *
 * 두 가지가 이 배점의 뼈대다.
 *  (1) **약속과 사실의 일치**가 커뮤니케이션 점수의 절반이다(`reassurance_contradicted` 플래그).
 *  (2) **전염을 키우지 않았는가**가 정책 점수의 절반이다(계열 부분 정지 횟수와 누적 인출).
 */
export const sbScoring: ScoringSpec = {
  weights: {
    liquidity: 15,
    solvency: 5,
    marketRisk: 0,
    communication: 25,
    compliance: 15,
    policy: 30,
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
          weight: 0.3,
          label: '기금 소진·연쇄 정지 없음',
        },
        {
          kind: 'metric',
          metric: 'usableReserves',
          aggregate: 'min',
          curve: [
            [0, 0],
            [1, 45],
            [3, 80],
            [6, 100],
          ],
          weight: 0.4,
          label: '최저 저축은행계정 가용재원(조원)',
        },
        { kind: 'expert', weight: 0.3 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'counter',
          key: 'forbearanceCost',
          curve: [
            [0, 100],
            [0.15, 70],
            [0.35, 35],
            [0.6, 0],
          ],
          weight: 0.5,
          label: '적기시정조치 유예로 커진 손실',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'metric',
          metric: 'market.govt3y',
          aggregate: 'max',
          curve: [
            [380, 100],
            [420, 60],
            [470, 0],
          ],
          weight: 0.4,
          label: '국고채 3년 최고치(bp)',
        },
        { kind: 'expert', weight: 0.6 },
      ],
    },
    communication: {
      components: [
        {
          kind: 'flag',
          key: 'reassurance_contradicted',
          ifSet: 0,
          ifNot: 100,
          weight: 0.3,
          label: '조건부 안심 발언이 뒤집히지 않음',
        },
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'min',
          curve: [
            [0, 0],
            [30, 30],
            [45, 60],
            [60, 90],
            [80, 100],
          ],
          weight: 0.2,
          label: '최저 신뢰지수',
        },
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'final',
          curve: [
            [35, 0],
            [50, 55],
            [62, 85],
            [72, 100],
          ],
          weight: 0.15,
          label: '최종 신뢰지수',
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
            [1, 92],
            [2, 72],
            [3, 45],
            [4, 0],
          ],
          weight: 0.3,
          label: '대응 단계 최고치',
        },
        {
          kind: 'flag',
          key: 'unsafe_act',
          ifSet: 0,
          ifNot: 100,
          weight: 0.25,
          label: '법이 허용하지 않는 조치 없음',
        },
        { kind: 'expert', weight: 0.45 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'counter',
          key: 'partialSuspensions',
          curve: [
            [0, 100],
            [1, 60],
            [2, 30],
            [4, 0],
          ],
          weight: 0.25,
          label: '계열 부분 정지 횟수(전염을 만든 횟수)',
        },
        {
          kind: 'metric',
          metric: 'depositOutflowCum',
          aggregate: 'final',
          curve: [
            [1.5, 100],
            [3, 75],
            [4.5, 40],
            [7, 0],
          ],
          weight: 0.25,
          label: '누적 예금 인출(조원)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'backstop_ready',
          byTurn: 1,
          ifSet: 100,
          ifNot: 45,
          weight: 0.25,
          label: '유동성 백스톱 사전 확보(T0~T1)',
        },
        {
          kind: 'flag',
          key: 'special_account_requested',
          byTurn: 4,
          ifSet: 100,
          ifNot: 50,
          weight: 0.25,
          label: '구조조정 특별계정 조기 착수(~T4)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
}
