import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/credit-suisse-2023.md §6.
 *
 * 정책·감독 역할이므로 정책(25)·유동성(20)·준법(20)이 중심이다. 시장리스크는 플레이어가 포지션을
 * 운용하지 않으므로 5로 두되 차원 자체는 남겨 두었다 — 이 시나리오에서 시장리스크는 "당국의 결정이
 * 유럽 AT1 시장에 남긴 손상"(`counters.at1MarketDamage`)으로 측정된다.
 *
 * 지급능력(10)은 크레디트스위스의 자본이지 당국의 자본이 아니다. 그래서 가중치가 낮고, 측정하는 것도
 * 자본비율의 수준이 아니라 **자본이 채워진 방식**이다 — 상각·전환으로 채웠는지, 납세자의 보증으로
 * 메웠는지.
 *
 * 전문가 정합(expert) 성분의 비중을 모든 차원에서 0.4 이상으로 둔 것은 이 시나리오의 결과 지표가
 * 대부분 외생(그날의 유출액은 기록이다)이기 때문이다. 플레이어가 실제로 바꾸는 것은 선택이다.
 */
export const csScoring: ScoringSpec = {
  weights: {
    liquidity: 20,
    solvency: 10,
    marketRisk: 5,
    communication: 15,
    compliance: 20,
    policy: 25,
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
          weight: 0.3,
          label: '지급불능 없이 완주',
        },
        {
          kind: 'metric',
          metric: 'csLiquidity',
          aggregate: 'min',
          curve: [
            [0, 0],
            [10, 45],
            [20, 75],
            [35, 100],
          ],
          weight: 0.3,
          label: '최저 가용 유동성(십억 프랑)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'csCet1Pct',
          aggregate: 'final',
          curve: [
            [10, 0],
            [14, 50],
            [20, 90],
            [30, 100],
          ],
          weight: 0.3,
          label: '최종 CET1 비율',
        },
        {
          kind: 'metric',
          metric: 'federalGuarantee',
          aggregate: 'final',
          curve: [
            [0, 100],
            [109, 70],
            [200, 35],
            [300, 0],
          ],
          weight: 0.3,
          label: '연방 보증 노출(납세자 위험)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'at1MarketDamage',
          curve: [
            [0, 100],
            [6, 70],
            [12, 35],
            [20, 0],
          ],
          weight: 0.5,
          label: '유럽 AT1 시장 손상 계수',
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
            [20, 35],
            [30, 60],
            [45, 90],
            [60, 100],
          ],
          weight: 0.2,
          label: '최저 신뢰지수',
        },
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'final',
          curve: [
            [20, 0],
            [35, 50],
            [50, 85],
            [65, 100],
          ],
          weight: 0.2,
          label: '최종 신뢰지수',
        },
        {
          kind: 'flag',
          key: 'at1_basis_published',
          ifSet: 100,
          ifNot: 45,
          weight: 0.15,
          label: 'AT1 상각의 근거를 결과와 같은 시각에 공표',
        },
        { kind: 'expert', weight: 0.45 },
      ],
    },
    compliance: {
      components: [
        {
          kind: 'flag',
          key: 'emergency_ordinance',
          byTurn: 2,
          ifSet: 100,
          ifNot: 25,
          weight: 0.2,
          label: '긴급명령을 목요일까지 제정(법적 근거 선확보)',
        },
        {
          kind: 'flag',
          key: 'route_committed',
          ifSet: 100,
          ifNot: 0,
          weight: 0.2,
          label: '일요일 시한 안에 경로 확정',
        },
        {
          kind: 'flag',
          key: 'cmg_full_coordination',
          ifSet: 100,
          ifNot: 55,
          weight: 0.1,
          label: '국제 인정 절차 사전 조율',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'counter',
          key: 'mondayShortfall',
          curve: [
            [0, 100],
            [20, 55],
            [60, 20],
            [100, 0],
          ],
          weight: 0.2,
          label: '월요일 개장 현금 부족분',
        },
        {
          kind: 'flag',
          key: 'monday_open_met',
          ifSet: 100,
          ifNot: 20,
          weight: 0.15,
          label: '월요일 개장 요건 충족',
        },
        { kind: 'expert', weight: 0.65 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'prep_early',
          byTurn: 0,
          ifSet: 100,
          ifNot: 40,
          weight: 0.25,
          label: '정리·매각·긴급명령 준비를 T0에 착수',
        },
        {
          kind: 'flag',
          key: 'track_dual',
          byTurn: 3,
          ifSet: 100,
          ifNot: 45,
          weight: 0.25,
          label: '주말 전에 병행 트랙 확보',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 60,
}
