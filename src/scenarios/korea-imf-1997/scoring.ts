import type { ScoringSpec } from '../../engine/types'

/**
 * docs/scenarios/korea-imf-1997.md §6.
 *
 * 외환당국 역할이므로 정책(30)이 가장 무겁고, 유동성(= 가용외환보유액 관리, 20)과 커뮤니케이션(15)이
 * 뒤를 잇는다. 지급능력(solvency)은 기관 자본이 아니라 **대외지급능력**(단기외채 커버리지)으로 읽고,
 * 시장리스크는 **환율방어 소진과 환율 수준**으로 읽는다.
 *
 * 시간(timeliness)에는 이 시나리오의 두 가지 타이밍 교훈이 그대로 들어 있다 — IMF 요청을 T3까지,
 * 변동폭 확대를 T3까지, 단기외채 만기연장 협상 개시를 T7까지 했는가. 일주일 먼저 움직인 경로만
 * 만점을 받는다.
 */
export const imfScoring: ScoringSpec = {
  weights: {
    liquidity: 20,
    solvency: 5,
    marketRisk: 10,
    communication: 15,
    compliance: 10,
    policy: 30,
    timeliness: 10,
  },
  rules: {
    liquidity: {
      components: [
        {
          kind: 'survival',
          alive: 100,
          orderlyFail: 30,
          disorderlyFail: 0,
          weight: 0.3,
          label: '대외지급 불능 없음',
        },
        {
          kind: 'metric',
          metric: 'usableReserves',
          aggregate: 'min',
          curve: [
            [0, 0],
            [39, 35],
            [80, 70],
            [150, 90],
            [223, 100],
          ],
          weight: 0.35,
          label: '최저 가용외환보유액(억달러)',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
    solvency: {
      components: [
        {
          kind: 'metric',
          metric: 'guidottiRatio',
          aggregate: 'final',
          curve: [
            [0, 0],
            [15, 35],
            [30, 65],
            [60, 90],
            [100, 100],
          ],
          weight: 0.5,
          label: '단기외채 커버리지(Greenspan-Guidotti, %)',
        },
        { kind: 'expert', weight: 0.5 },
      ],
    },
    marketRisk: {
      components: [
        {
          kind: 'counter',
          key: 'interventionTotal',
          curve: [
            [0, 100],
            [60, 85],
            [120, 55],
            [200, 20],
          ],
          weight: 0.35,
          label: '누적 현물환 개입 소진(억달러)',
        },
        {
          kind: 'metric',
          metric: 'fxSpot',
          aggregate: 'max',
          curve: [
            [1000, 100],
            [1500, 70],
            [2000, 40],
            [2600, 0],
          ],
          weight: 0.25,
          label: '최고 원/달러 환율',
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
            [20, 25],
            [40, 55],
            [60, 85],
            [80, 100],
          ],
          weight: 0.25,
          label: '최저 시장 신뢰지수',
        },
        {
          kind: 'metric',
          metric: 'confidence',
          aggregate: 'final',
          curve: [
            [20, 0],
            [40, 45],
            [60, 80],
            [75, 100],
          ],
          weight: 0.15,
          label: '최종 신뢰지수',
        },
        {
          kind: 'flag',
          key: 'reserves_disclosed',
          ifSet: 100,
          ifNot: 40,
          weight: 0.2,
          label: '가용·총액 구분 공개',
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
            [2, 70],
            [3, 45],
            [4, 0],
          ],
          weight: 0.3,
          label: '대외 신인도 경보 최고 단계',
        },
        {
          kind: 'flag',
          key: 'moratorium_declared',
          ifSet: 0,
          ifNot: 100,
          weight: 0.25,
          label: '대외지급 정지 선언 없음',
        },
        { kind: 'expert', weight: 0.45 },
      ],
    },
    policy: {
      components: [
        {
          kind: 'metric',
          metric: 'imfCommitted',
          aggregate: 'final',
          curve: [
            [0, 20],
            [100, 60],
            [210, 90],
            [583, 100],
          ],
          weight: 0.25,
          label: '확보한 대외 지원 약정(억달러)',
        },
        {
          kind: 'counter',
          key: 'rolloverConverted',
          curve: [
            [0, 20],
            [100, 60],
            [218, 95],
            [240, 100],
          ],
          weight: 0.2,
          label: '정부보증 중장기 전환 단기외채(억달러)',
        },
        {
          kind: 'metric',
          metric: 'usableReserves',
          aggregate: 'final',
          curve: [
            [0, 0],
            [40, 40],
            [90, 70],
            [150, 95],
            [220, 100],
          ],
          weight: 0.15,
          label: '최종 가용외환보유액(억달러)',
        },
        { kind: 'expert', weight: 0.4 },
      ],
    },
    timeliness: {
      components: [
        {
          kind: 'flag',
          key: 'imf_requested',
          byTurn: 3,
          ifSet: 100,
          ifNot: 45,
          weight: 0.25,
          label: 'IMF 구제금융 요청을 T3(11/17)까지',
        },
        {
          kind: 'flag',
          key: 'band_widened',
          byTurn: 3,
          ifSet: 100,
          ifNot: 50,
          weight: 0.2,
          label: '환율 변동폭 확대를 T3까지',
        },
        {
          kind: 'flag',
          key: 'rollover_talks',
          byTurn: 7,
          ifSet: 100,
          ifNot: 50,
          weight: 0.2,
          label: '단기외채 만기연장 협상 개시를 T7(12/12)까지',
        },
        { kind: 'expert', weight: 0.35 },
      ],
    },
  },
  failureCap: 40,
  failureCapOrderly: 60,
}
