import type { GameState, InstitutionState } from '../engine/types/state'
import type { MetricSnapshot, MetricUnit, MetricValue, ThresholdMap } from '../engine/types/metrics'
import { computeLcr, KR_LCR_PARAMS, BCBS_LCR_PARAMS } from './lcr'
import { computeCapital } from './capital'
import { computeLdiMargin } from './ldiMargin'
import { computeNcr } from './ncr'
import { computePbExposure } from './pbExposure'
import { computeFxAdequacy } from './fxAdequacy'
import {
  lcrInputFromBank,
  projectRunoff,
  runStateFromCi,
  totalDeposits,
  uninsuredDeposits,
} from './runoff'
import { computeSurvival } from './survival'
import { statusFor } from './thresholds'

type Row = [
  key: string,
  value: number,
  unit: MetricUnit,
  label: string,
  labelEn?: string,
  detail?: Record<string, number>,
]

function build(rows: Row[], thresholds: ThresholdMap, turnIndex: number): MetricSnapshot {
  const metrics: Record<string, MetricValue> = {}
  for (const [key, value, unit, label, labelEn, detail] of rows) {
    const t = thresholds[key]
    metrics[key] = {
      key,
      value,
      unit,
      status: Number.isFinite(value) ? statusFor(value, t) : 'na',
      label,
      labelEn,
      detail,
    }
  }
  return { turnIndex, metrics }
}

function commonRows(state: GameState): Row[] {
  const rows: Row[] = [
    ['confidence', state.confidence.index, 'index', '시장 신뢰지수', 'Confidence Index'],
    ['regulatorLevel', state.regulator.level, 'index', '감독당국 단계', 'Regulator Level'],
    ['ownStock', state.market.ownStock, 'index', '자사 주가(지수)', 'Own Stock'],
    ['runState', runStateFromCi(state.confidence.index), 'index', '런 상태', 'Run State'],
  ]
  for (const [k, v] of Object.entries(state.institution.custom ?? {})) {
    rows.push([k, v, 'index', k])
  }
  for (const [k, v] of Object.entries(state.market.custom ?? {})) {
    rows.push([`market.${k}`, v, 'index', k])
  }
  return rows
}

function bankRows(state: GameState, thresholds: ThresholdMap): Row[] {
  const b = state.institution
  if (b.kind !== 'bank') return []
  const kr = state.counters.useKrLcr === 1
  const lcr = computeLcr(lcrInputFromBank(b), kr ? KR_LCR_PARAMS : BCBS_LCR_PARAMS)
  const deposits = totalDeposits(b)
  const uninsured = uninsuredDeposits(b)
  const afsLoss = Math.max(0, b.securities.afs.bookValue - b.securities.afs.marketValue)
  const htmLoss = Math.max(0, b.securities.htm.bookValue - b.securities.htm.marketValue)
  const cap = computeCapital({
    cet1: b.capital.cet1,
    at1: b.capital.at1,
    tier2: b.capital.tier2,
    rwa: b.rwa,
    leverageExposure: b.leverageExposure,
    aociInCet1: b.capital.aociInCet1,
    unrealizedAfsLoss: afsLoss,
    unrealizedHtmLoss: htmLoss,
  })
  const runState = runStateFromCi(state.confidence.index)
  const amp =
    state.counters.amplifier && state.counters.amplifier > 0 ? state.counters.amplifier : 1
  const damp = state.counters.dampener && state.counters.dampener > 0 ? state.counters.dampener : 1
  const projected = projectRunoff({
    segments: b.deposits,
    runState,
    amplifier: amp,
    dampener: damp,
    networkAmplifier: state.counters.networkAmplifier || 1,
  })
  const survival = computeSurvival({
    cash: b.cash,
    sameDayCapacity: b.wholesale.cbFacilityCapacity,
    projectedDailyOutflow: projected.total,
    minimumCash: b.custom.minimumCash ?? 0,
  })
  const lastOutflow = state.counters.lastOutflow ?? 0
  const cumOutflow = state.counters.cumulativeOutflow ?? 0
  const startDeposits = state.counters.startDeposits || deposits + cumOutflow
  const unrealizedTotal = afsLoss + htmLoss
  void thresholds
  return [
    [
      'lcr',
      lcr.lcr,
      '%',
      '유동성커버리지비율(LCR)',
      'LCR',
      { hqla: lcr.hqla, netOutflows: lcr.netOutflows },
    ],
    ['hqla', lcr.hqla, 'ccy', '고유동성자산(HQLA)', 'HQLA'],
    ['cash', b.cash, 'ccy', '현금·지준', 'Cash'],
    ['liquidityAvailable', survival.available, 'ccy', '즉시 가용 유동성', 'Available Liquidity'],
    [
      'facilityHeadroom',
      b.wholesale.cbFacilityCapacity,
      'ccy',
      '담보차입 여력(당일)',
      'Secured Facility Headroom',
    ],
    [
      'facilityPending',
      b.wholesale.cbFacilityPending,
      'ccy',
      '담보차입 여력(익일)',
      'Facility Headroom (T+1)',
    ],
    [
      'survivalDays',
      survival.survivalDays,
      'days',
      '생존 일수',
      'Survival Days',
      { projectedDailyOutflow: projected.total },
    ],
    [
      'projectedDailyOutflow',
      projected.total,
      'ccy',
      '예상 일일 순유출',
      'Projected Daily Outflow',
    ],
    ['deposits', deposits, 'ccy', '총예금', 'Deposits'],
    [
      'uninsuredShare',
      deposits > 0 ? (uninsured / deposits) * 100 : 0,
      '%',
      '무보험예금 비중',
      'Uninsured Share',
    ],
    ['dailyOutflow', lastOutflow, 'ccy', '당일 예금 순유출', 'Daily Outflow'],
    [
      'dailyOutflowPct',
      startDeposits > 0 ? (lastOutflow / startDeposits) * 100 : 0,
      '%',
      '당일 유출률',
      'Daily Outflow %',
    ],
    ['cumulativeOutflow', cumOutflow, 'ccy', '누적 예금 유출', 'Cumulative Outflow'],
    [
      'cumulativeOutflowPct',
      startDeposits > 0 ? (cumOutflow / startDeposits) * 100 : 0,
      '%',
      '누적 유출률',
      'Cumulative Outflow %',
    ],
    ['cet1Ratio', cap.cet1Ratio, '%', '보통주자본비율(CET1)', 'CET1 Ratio'],
    ['leverageRatio', cap.leverageRatio, '%', '레버리지비율', 'Leverage Ratio'],
    [
      'economicTce',
      cap.economicTceRatio,
      '%',
      '경제적 유형자기자본비율',
      'Economic TCE',
      { afsLoss, htmLoss },
    ],
    ['unrealizedLoss', unrealizedTotal, 'ccy', '미실현손실(AFS+HTM)', 'Unrealized Losses'],
    [
      'unrealizedLossPctCet1',
      b.capital.cet1 > 0 ? (unrealizedTotal / b.capital.cet1) * 100 : 0,
      '%',
      '미실현손실/CET1',
      'Unrealized / CET1',
    ],
    ['cbAdvances', b.wholesale.cbAdvances, 'ccy', '담보차입 잔액', 'Secured Borrowings'],
  ]
}

function securitiesRows(state: GameState): Row[] {
  const s = state.institution
  if (s.kind !== 'securities') return []
  const ncr = computeNcr({
    equityCapital: s.equityCapital,
    deductions: s.deductions,
    additions: s.additions,
    risk: s.risk,
    requiredCapital: s.requiredCapital,
  })
  const liquidAssets =
    s.liquidity.cash +
    (s.liquidity.creditLines - s.liquidity.creditLinesDrawn) +
    s.liquidity.sellableSecurities * 0.9
  const maturingNext = s.pf.abcpMaturing[0] ?? 0
  const maturing30 = s.pf.abcpMaturing.slice(0, 4).reduce((a, b) => a + b, 0)
  const liquidLiabilities =
    maturing30 * (1 - s.pf.rollRate) +
    s.funding.call +
    s.funding.cp * 0.5 +
    s.hedge.marginCallPending
  const liquidityRatio = liquidLiabilities > 0 ? (liquidAssets / liquidLiabilities) * 100 : 999
  return [
    [
      'ncr',
      ncr.ncr,
      '%',
      '순자본비율(NCR)',
      'NCR',
      { noc: ncr.netOperatingCapital, totalRisk: ncr.totalRisk },
    ],
    ['ncrOld', ncr.ncrOld, '%', '구 NCR', 'Old NCR'],
    [
      'liquidityRatio',
      Math.min(999, liquidityRatio),
      '%',
      '유동성비율(게임 단순화)',
      'Liquidity Ratio',
      { liquidAssets, liquidLiabilities },
    ],
    ['liquidAssets', liquidAssets, 'ccy', '유동자산', 'Liquid Assets'],
    ['cash', s.liquidity.cash, 'ccy', '현금', 'Cash'],
    [
      'abcpMaturingNext',
      maturingNext,
      'ccy',
      '차환 만기 도래액(이번 턴)',
      'ABCP Maturing (this turn)',
    ],
    ['abcpMaturing30', maturing30, 'ccy', '차환 만기 도래액(30일)', 'ABCP Maturing (30d)'],
    ['rollRate', s.pf.rollRate * 100, '%', '차환 성공률', 'Rollover Success Rate'],
    ['abcpGuaranteed', s.pf.abcpGuaranteed, 'ccy', '매입약정·신용공여 잔액', 'Guaranteed ABCP'],
    ['abcpHeld', s.pf.abcpHeld, 'ccy', '자체 매입 ABCP', 'ABCP Held'],
    [
      'guaranteeToEquity',
      s.equityCapital > 0 ? (s.pf.abcpGuaranteed / s.equityCapital) * 100 : 0,
      '%',
      '신용공여/자기자본',
      'Guarantees / Equity',
    ],
    [
      'marginCallPending',
      s.hedge.marginCallPending,
      'ccy',
      '마진콜 대기액',
      'Pending Margin Calls',
    ],
    ['fxLiquid', s.liquidity.fxLiquid, 'ccy', '외화 유동자산', 'FX Liquid Assets'],
    ['ownCpRate', state.market.custom.ownCpRate ?? 0, 'rate', '자사 CP 발행금리', 'Own CP Rate'],
  ]
}

function pensionRows(state: GameState): Row[] {
  const p = state.institution
  if (p.kind !== 'pension') return []
  const ldi = computeLdiMargin({
    exposure: p.assets.ldi.exposure,
    equity: p.assets.ldi.equity,
    modDuration: p.assets.ldi.modDuration,
    collateral: p.assets.ldi.collateral.cash + p.assets.ldi.collateral.eligibleGilts,
    deltaYieldBp: 0,
  })
  const liquid =
    p.assets.cash + p.assets.gilts.marketValue * (1 - (p.assets.gilts.pledgedShare ?? 0))
  const totalAssets =
    p.assets.cash +
    p.assets.gilts.marketValue +
    p.assets.corporateBonds.marketValue +
    p.assets.equities +
    p.assets.illiquid +
    p.assets.ldi.equity
  return [
    ['hedgeRatio', p.hedgeRatio * 100, '%', '헤지비율', 'Hedge Ratio'],
    ['ldiLeverage', ldi.leverage, 'x', 'LDI 레버리지', 'LDI Leverage'],
    [
      'collateralHeadroomBp',
      ldi.bufferBp,
      'bp',
      '담보 여력(bp)',
      'Collateral Headroom',
      { pv01: ldi.pv01 },
    ],
    ['liquidAssets', liquid, 'ccy', '유동자산', 'Liquid Assets'],
    [
      'fundingRatio',
      p.liabilities.pv > 0 ? (totalAssets / p.liabilities.pv) * 100 : 0,
      '%',
      '펀딩비율',
      'Funding Ratio',
    ],
    [
      'marginCallPending',
      p.assets.ldi.marginCallOutstanding,
      'ccy',
      '마진콜 대기액',
      'Pending Margin Calls',
    ],
    ['govt30y', state.market.govt30yBp / 100, 'rate', '30년 국채 금리', '30Y Yield'],
  ]
}

function pbRows(state: GameState): Row[] {
  const pb = state.institution
  if (pb.kind !== 'prime_broker') return []
  let gross = 0
  let varSum = 0
  let margin = 0
  let worstDays = 0
  for (const c of pb.clients) {
    const r = computePbExposure({ positions: c.positions, marginPosted: c.marginPosted })
    gross += r.grossNotional
    varSum += r.liquidationVaR
    margin += c.marginPosted
    worstDays = Math.max(worstDays, r.daysToLiquidate)
  }
  return [
    ['grossExposure', gross, 'ccy', '총익스포저', 'Gross Exposure'],
    ['liquidationVaR', varSum, 'ccy', '청산 VaR', 'Liquidation VaR'],
    [
      'marginCoverage',
      varSum > 0 ? (margin / varSum) * 100 : 999,
      '%',
      '마진 커버리지',
      'Margin Coverage',
    ],
    ['concentrationDays', worstDays, 'days', '청산 소요일(최대)', 'Days to Liquidate'],
    ['realizedLoss', pb.firm.realizedLoss, 'ccy', '실현 손실', 'Realized Loss'],
    ['firmCapital', pb.firm.capital, 'ccy', '자본', 'Capital'],
  ]
}

function centralBankRows(state: GameState): Row[] {
  const cb = state.institution
  if (cb.kind !== 'central_bank') return []
  const fx = computeFxAdequacy({
    usableReserves: cb.reserves.usable,
    shortTermDebt: cb.external.shortTermDebt,
    monthlyImports: cb.external.monthlyImports,
    broadMoneyUsd: cb.external.broadMoneyUsd,
    annualExportsUsd: cb.external.annualExportsUsd,
    regime: cb.fx.regime,
  })
  return [
    ['usableReserves', cb.reserves.usable, 'ccy', '가용외환보유액', 'Usable Reserves'],
    ['guidottiRatio', fx.guidottiRatio, '%', '단기외채 커버리지', 'ST Debt Cover'],
    ['importCoverMonths', fx.importCoverMonths, 'x', '수입 커버 개월', 'Import Cover (months)'],
    ['fxSpot', cb.fx.spot, 'fx', '환율', 'FX Spot'],
    ['policyRate', cb.policy.rateBp / 100, 'rate', '정책금리', 'Policy Rate'],
    ['sovereignSpreadBp', cb.sovereign.spreadBp, 'bp', '국가 스프레드/CDS', 'Sovereign Spread'],
    [
      'distressedBanks',
      cb.bankingSystem.distressedBanks,
      'count',
      '부실 징후 기관 수',
      'Distressed Institutions',
    ],
    ['failedBanks', cb.bankingSystem.failedBanks, 'count', '정리된 기관 수', 'Failed Institutions'],
    ['imfCommitted', cb.imf.committed, 'ccy', 'IMF 약정액', 'IMF Committed'],
  ]
}

function assetManagerRows(state: GameState): Row[] {
  const am = state.institution
  if (am.kind !== 'asset_manager') return []
  const nav = am.fund.nav
  return [
    ['nav', nav, 'ccy', '순자산(NAV)', 'NAV'],
    [
      'redemptionsPendingPct',
      am.redemptions.pendingPct,
      '%',
      '환매 요청(당일, %NAV)',
      'Pending Redemptions',
    ],
    [
      'redemptionsCumulativePct',
      am.redemptions.cumulativePct,
      '%',
      '누적 환매(%NAV)',
      'Cumulative Redemptions',
    ],
    [
      'cashBufferPct',
      nav > 0 ? (am.liquidity.daily / nav) * 100 : 0,
      '%',
      '현금·1일 유동성 비중',
      'Cash Buffer',
    ],
    [
      'weeklyLiquidityPct',
      nav > 0 ? ((am.liquidity.daily + am.liquidity.weekly) / nav) * 100 : 0,
      '%',
      '1주 유동성 비중',
      'Weekly Liquidity',
    ],
    ['gated', am.redemptions.gated ? 1 : 0, 'index', '게이트 여부', 'Gated'],
  ]
}

export function computeMetricsFor(
  state: GameState<InstitutionState>,
  thresholds: ThresholdMap,
): MetricSnapshot {
  const rows: Row[] = [
    ...commonRows(state),
    ...bankRows(state, thresholds),
    ...securitiesRows(state),
    ...pensionRows(state),
    ...pbRows(state),
    ...centralBankRows(state),
    ...assetManagerRows(state),
  ]
  return build(rows, thresholds, state.turnIndex)
}
