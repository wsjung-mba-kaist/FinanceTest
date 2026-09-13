import type { KpiSpec, ScenarioDefinition } from '../../engine'

/** Role-shaped shortlist; intersected with what each scenario actually authored. */
const METRICS = {
  bank: ['cash', 'facilityHeadroom', 'facilityPending', 'projectedDailyOutflow'],
  securities: ['cash', 'abcpMaturingNext', 'rollRate', 'marginCallPending'],
  pension: ['liquidAssets', 'marginCallPending', 'collateralHeadroomBp', 'hedgeRatio'],
  prime_broker: ['grossExposure', 'marginCoverage', 'liquidationVaR', 'concentrationDays'],
  asset_manager: ['nav', 'redemptionsPendingPct', 'cashBufferPct', 'weeklyLiquidityPct'],
  central_bank: ['usableReserves', 'guidottiRatio', 'imfCommitted', 'distressedBanks'],
} as const

/**
 * 상황실에 올릴 지표 — 기관 종류 목록과 **그 시나리오가 저작한 KPI 의 교집합**.
 *
 * `METRICS` 만으로 고르면 그 시나리오가 쓰지 않는 필드까지 끌려 나온다. 크레디트스위스 상황실에
 * «IMF 지원 약정액 0» 이 상주했는데, `initialState` 주석이 "지표에는 나오지만 KPI 로 노출하지
 * 않는다"고 못박아 둔 바로 그 값이었다. 레고랜드에는 자체헤지가 없는데 «마진콜 대기 0» 이 떴다.
 * 교차하면 셋이 함께 풀린다: 구조적 0 이 사라지고, `lagTurns` 가 일관되게 걸리고, 라벨을
 * 저작된 것으로 쓸 수 있다.
 */
export function fundingBriefRows(scenario: ScenarioDefinition): KpiSpec[] {
  const kind = scenario.initialState.institution.kind
  return METRICS[kind].flatMap((key) => {
    const spec = scenario.kpis.find((k) => k.metric === key)
    return spec ? [spec] : []
  })
}

/** 역할마다 「이 숫자로 무엇을 단정하면 안 되는가」 한 줄. */
export const BASIS = {
  bank: '차입 한도는 인출 전 현금이 아닙니다. 향후 1일 유출 추정과 실제 결제 마감은 구분하세요.',
  securities:
    '이번 구간 차환 만기와 마진콜을 함께 확인하세요. 차환 실패분과 외화 지급의 결제 시각은 별도 확인이 필요합니다.',
  pension:
    '유동자산에는 미담보 국채가 포함됩니다. 매각·담보 이전이 끝나기 전에는 현금으로 사용할 수 없습니다.',
  prime_broker:
    '청산 VaR는 손실 추정치입니다. 고객에게 받은 마진을 회사의 가용 현금으로 계산하지 않습니다.',
  asset_manager:
    '1일 유동성에는 현금화 가능한 자산이 포함됩니다. 환매 금액·지급일과 잔존 수익자의 희석을 함께 판단하세요.',
  central_bank:
    '가용 외환보유액과 지원 약정액을 구분하세요. 약정만으로 인출 완료나 지원 권한이 확정되지는 않습니다.',
} as const
