import { describe, expect, it } from 'vitest'
import { loadAllAvailable } from '@/scenarios'
import { fundingBriefRows } from '@/components/play/fundingBriefRows'

/**
 * 상황실은 **저작자가 KPI 로 올린 것만** 꺼낸다.
 *
 * 자금·마감 카드는 기관 종류별 고정 목록으로 지표를 골랐다. 그러면 그 시나리오가 쓰지 않는
 * 필드까지 끌려 나온다 — 구조적으로 0 인 값이 «수치» 인 척 상주했다:
 *
 *   - credit-suisse-2023 `imf: { committed: 0 } // 사용하지 않음 [STYLIZED]`, 그리고 그 파일의
 *     헤더 주석이 "지표에는 나오지만 KPI 로 노출하지 않는다"고 못박아 둔다. 그런데 스위스 은행
 *     상황실에 «IMF 지원 약정액 0» 이 떠 있었다.
 *   - savings-bank-2011 `// 구조조정 특별계정: 아직 법이 없다` — 같은 0.
 *   - legoland-2022 `marginCallPending: 0, // 중형사: ELS 자체헤지 없음 [STYLIZED]`.
 *
 * 이 목록이 곧 계약이다. 숫자가 움직이면 의도한 변경이므로 여기를 고쳐 적는다.
 */
const scenarios = await loadAllAvailable()
const rowsOf = (id: string) =>
  fundingBriefRows(scenarios.find((s) => s.meta.id === id)!).map((s) => s.metric)

describe('situation-room funding rows', () => {
  it('only lists metrics the scenario itself authored as a KPI', () => {
    const problems: string[] = []
    for (const scenario of scenarios)
      for (const spec of fundingBriefRows(scenario))
        if (!scenario.kpis.some((k) => k.metric === spec.metric))
          problems.push(`${scenario.meta.id}: ${spec.metric}`)
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('no longer shows the figures their authors deliberately kept off the board', () => {
    expect(rowsOf('credit-suisse-2023')).not.toContain('imfCommitted')
    expect(rowsOf('savings-bank-2011')).not.toContain('imfCommitted')
    expect(rowsOf('legoland-2022')).not.toContain('marginCallPending')
    // `imfCommitted` 를 KPI 로 올린 시나리오는 지금 하나도 없다 — 그래서 어디에도 나오지 않는다.
    // 규칙이지 일괄 삭제가 아니라는 것은 저작한 쪽이 그대로 남는 데서 보인다.
    expect(rowsOf('korea-imf-1997')).toEqual(['usableReserves', 'guidottiRatio'])
    expect(rowsOf('legoland-2022')).toContain('abcpMaturingNext')
  })

  it('is the census it is today', () => {
    const census = Object.fromEntries(
      scenarios.map((s) => [s.meta.id, fundingBriefRows(s).map((k) => k.metric)]),
    )
    expect(census).toEqual({
      'svb-2023': ['cash', 'facilityHeadroom', 'facilityPending', 'projectedDailyOutflow'],
      'legoland-2022': ['cash', 'abcpMaturingNext', 'rollRate'],
      'mg-run-2023': ['cash', 'facilityHeadroom'],
      'uk-ldi-2022': ['liquidAssets', 'marginCallPending', 'collateralHeadroomBp', 'hedgeRatio'],
      'lehman-2008': ['cash', 'facilityHeadroom'],
      'korea-imf-1997': ['usableReserves', 'guidottiRatio'],
      'covid-2020-fund': ['cashBufferPct'],
      'els-margin-2020': ['cash', 'marginCallPending'],
      'credit-suisse-2023': ['usableReserves'],
      // 태영은 현금·차입을 KPI 로 올리지 않는다(동의율·충당금 시나리오다) → 카드 본문이 접힌다.
      'taeyoung-pf-2024': [],
      'archegos-2021': ['grossExposure', 'marginCoverage', 'concentrationDays'],
      'ltcm-1998': ['grossExposure', 'marginCoverage'],
      'savings-bank-2011': ['usableReserves'],
    })
  })
})
