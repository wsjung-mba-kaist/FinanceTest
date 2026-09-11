import type { InstitutionType, ScoreComponent, ScoreDimension } from '../types'

/**
 * Default scoring components per institution type. Scenarios override any dimension via
 * `scoring.rules[dimension]`; anything not overridden falls back to these.
 * Each dimension blends authored option quality (expert ratings) with outcome metrics.
 */
type Rules = Partial<Record<ScoreDimension, ScoreComponent[]>>

const expertOnly: ScoreComponent[] = [{ kind: 'expert', weight: 1, label: '전문가 정합' }]

const confidenceRule: ScoreComponent = {
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
}
const regulatorRule: ScoreComponent = {
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
  label: '감독당국 최고 단계',
}

const common: Rules = {
  marketRisk: expertOnly,
  policy: expertOnly,
  timeliness: expertOnly,
  communication: [confidenceRule, { kind: 'expert', weight: 0.6 }],
  compliance: [regulatorRule, { kind: 'expert', weight: 0.5 }],
}

const bank: Rules = {
  ...common,
  liquidity: [
    {
      kind: 'metric',
      metric: 'survivalDays',
      aggregate: 'min',
      curve: [
        [0, 0],
        [1, 40],
        [3, 80],
        [5, 100],
      ],
      weight: 0.5,
      label: '최저 생존 일수',
    },
    {
      kind: 'metric',
      metric: 'lcr',
      aggregate: 'min',
      curve: [
        [40, 0],
        [80, 50],
        [100, 80],
        [130, 100],
      ],
      weight: 0.25,
      label: '최저 LCR',
    },
    { kind: 'expert', weight: 0.25 },
  ],
  solvency: [
    {
      kind: 'metric',
      metric: 'cet1Ratio',
      aggregate: 'min',
      curve: [
        [2, 0],
        [4.5, 30],
        [7, 70],
        [10, 100],
      ],
      weight: 0.35,
      label: '최저 CET1',
    },
    {
      kind: 'metric',
      metric: 'economicTce',
      aggregate: 'final',
      curve: [
        [-3, 0],
        [0, 40],
        [3, 80],
        [6, 100],
      ],
      weight: 0.3,
      label: '최종 경제적 TCE',
    },
    { kind: 'expert', weight: 0.35 },
  ],
}

const securities: Rules = {
  ...common,
  liquidity: [
    {
      kind: 'metric',
      metric: 'liquidityRatio',
      aggregate: 'min',
      curve: [
        [50, 0],
        [100, 60],
        [120, 90],
        [150, 100],
      ],
      weight: 0.5,
      label: '최저 유동성비율',
    },
    { kind: 'expert', weight: 0.5 },
  ],
  solvency: [
    {
      kind: 'metric',
      metric: 'ncr',
      aggregate: 'min',
      curve: [
        [0, 0],
        [100, 50],
        [150, 80],
        [250, 100],
      ],
      weight: 0.5,
      label: '최저 NCR',
    },
    { kind: 'expert', weight: 0.5 },
  ],
}

const pension: Rules = {
  ...common,
  liquidity: [
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
      weight: 0.5,
      label: '최저 담보 여력',
    },
    { kind: 'expert', weight: 0.5 },
  ],
  solvency: [
    {
      kind: 'metric',
      metric: 'fundingRatio',
      aggregate: 'final',
      curve: [
        [80, 0],
        [90, 40],
        [100, 80],
        [110, 100],
      ],
      weight: 0.5,
      label: '최종 펀딩비율',
    },
    { kind: 'expert', weight: 0.5 },
  ],
}

const primeBroker: Rules = {
  ...common,
  liquidity: expertOnly,
  solvency: [
    {
      kind: 'metric',
      metric: 'realizedLoss',
      aggregate: 'final',
      curve: [
        [0, 100],
        [1000, 60],
        [5000, 0],
      ],
      weight: 0.5,
      label: '실현 손실',
    },
    { kind: 'expert', weight: 0.5 },
  ],
  marketRisk: [
    {
      kind: 'metric',
      metric: 'marginCoverage',
      aggregate: 'min',
      curve: [
        [0, 0],
        [100, 60],
        [150, 90],
        [200, 100],
      ],
      weight: 0.5,
      label: '최저 마진 커버리지',
    },
    { kind: 'expert', weight: 0.5 },
  ],
}

const centralBank: Rules = {
  ...common,
  liquidity: [
    {
      kind: 'metric',
      metric: 'guidottiRatio',
      aggregate: 'min',
      curve: [
        [0, 0],
        [50, 40],
        [100, 80],
        [150, 100],
      ],
      weight: 0.5,
      label: '최저 단기외채 커버리지',
    },
    { kind: 'expert', weight: 0.5 },
  ],
  solvency: expertOnly,
  policy: [
    {
      kind: 'metric',
      metric: 'distressedBanks',
      aggregate: 'max',
      curve: [
        [0, 100],
        [3, 70],
        [8, 30],
        [15, 0],
      ],
      weight: 0.4,
      label: '부실 기관 수',
    },
    { kind: 'expert', weight: 0.6 },
  ],
}

const assetManager: Rules = {
  ...common,
  liquidity: [
    {
      kind: 'metric',
      metric: 'cashBufferPct',
      aggregate: 'min',
      curve: [
        [0, 0],
        [3, 40],
        [7, 80],
        [12, 100],
      ],
      weight: 0.5,
      label: '최저 현금 버퍼',
    },
    { kind: 'expert', weight: 0.5 },
  ],
  solvency: expertOnly,
}

export const DEFAULT_SCORING_RULES: Record<InstitutionType, Rules> = {
  bank,
  securities,
  pension,
  prime_broker: primeBroker,
  central_bank: centralBank,
  asset_manager: assetManager,
}

export const DEFAULT_WEIGHTS: Record<InstitutionType, Record<ScoreDimension, number>> = {
  bank: {
    liquidity: 30,
    solvency: 20,
    marketRisk: 10,
    communication: 15,
    compliance: 10,
    policy: 5,
    timeliness: 10,
  },
  securities: {
    liquidity: 30,
    solvency: 20,
    marketRisk: 15,
    communication: 10,
    compliance: 10,
    policy: 5,
    timeliness: 10,
  },
  pension: {
    liquidity: 30,
    solvency: 15,
    marketRisk: 25,
    communication: 5,
    compliance: 10,
    policy: 5,
    timeliness: 10,
  },
  prime_broker: {
    liquidity: 10,
    solvency: 25,
    marketRisk: 30,
    communication: 5,
    compliance: 15,
    policy: 5,
    timeliness: 10,
  },
  central_bank: {
    liquidity: 20,
    solvency: 5,
    marketRisk: 10,
    communication: 15,
    compliance: 10,
    policy: 30,
    timeliness: 10,
  },
  asset_manager: {
    liquidity: 30,
    solvency: 10,
    marketRisk: 25,
    communication: 10,
    compliance: 10,
    policy: 5,
    timeliness: 10,
  },
}
