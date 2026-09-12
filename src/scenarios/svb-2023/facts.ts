/**
 * FactLedger — every numeric initial-state value traced to a source (docs/authoring-guide.md 저작 체크리스트 1).
 * tag: VERIFY (2차 출처/미확인, 릴리스 전 재검증) · STYLIZED (선언된 단순화) · CAL (보정 가정)
 *
 * `path` addresses the T0 state (`institution.` · `market.` · `confidence.` · `counters.` ·
 * `regulatorLevel`) and `tests/integrity/facts.test.ts` asserts those rows still match it. A dated
 * observation that is *not* the T0 value — a later close, a daily move — must use an `anchor.*`
 * path instead, or it will be read as drift.
 */
export interface FactRow {
  path: string
  value: number
  unit: string
  asOf: string
  sourceId: string
  tag?: 'VERIFY' | 'STYLIZED' | 'CAL'
  note?: string
}

export const SVB_FACTS: FactRow[] = [
  {
    path: 'institution.cash',
    value: 14,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note: '13.8 반올림',
  },
  {
    path: 'institution.securities.afs.marketValue',
    value: 26,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note: '26.1',
  },
  {
    path: 'institution.securities.afs.bookValue',
    value: 28.9,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-8k-2023-03-08',
    tag: 'STYLIZED',
    note: '미실현손실 2.5~2.9; $21B 매각 시 세후 손실 $1.8B 재현을 위해 2.9 채택',
  },
  {
    path: 'institution.securities.afs.modDuration',
    value: 3.6,
    unit: 'y',
    asOf: '2023-03-08',
    sourceId: 'svb-8k-2023-03-08',
  },
  {
    path: 'institution.securities.htm.marketValue',
    value: 76.2,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
  },
  {
    path: 'institution.securities.htm.bookValue',
    value: 91.3,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
  },
  {
    path: 'institution.securities.htm.modDuration',
    value: 6.2,
    unit: 'y',
    asOf: '2022-12-31',
    sourceId: 'fed-svb-review-2023',
  },
  {
    path: 'institution.loans.corporate',
    value: 55,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
    note: '순대출 73.6의 세그먼트 배분',
  },
  {
    path: 'institution.loans.sme',
    value: 10,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
  },
  {
    path: 'institution.loans.retail',
    value: 5,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
  },
  {
    path: 'institution.loans.fi',
    value: 3.6,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
  },
  {
    path: 'institution.otherAssets',
    value: 7,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note: 'plug',
  },
  {
    path: 'institution.deposits.0.balance',
    value: 90,
    unit: '$B',
    asOf: '2023-03-08',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
    note: '예금 173 중 산업별 구성 기반 세그먼트',
  },
  {
    path: 'institution.deposits.1.balance',
    value: 58,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
    note: 'T1 진입 시 −8 → 50',
  },
  {
    path: 'institution.deposits.2.balance',
    value: 10,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'fed-svb-review-2023',
    tag: 'STYLIZED',
    note: '보험 예금 ≈6%',
  },
  {
    path: 'institution.deposits.3.balance',
    value: 15,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
  },
  {
    path: 'institution.wholesale.unsecuredLong',
    value: 5.4,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
  },
  {
    path: 'institution.wholesale.cbAdvances',
    value: 15,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note:
      '10-K 주석 15 원문으로 확정(종전 2차 출처 CBO 2024를 교체): "the Company had short-term FHLB ' +
      'advances totaling $13.0 billion and long-term FHLB advances of $2.0 billion, which consists of two ' +
      '$1 billion borrowings with maturities on November 1 and 2, 2023." 합계 $15.0B. FHLB 담보 장부가 ' +
      '$44.9B 중 $25.9B가 추가 차입 여력으로 남아 있었다. **모형 주의**: 장기 FHLB $2.0B는 총장기부채 ' +
      '$5,370M(= 선순위채·후순위사채 $3,370M + FHLB 장기 $2,000M)에도 들어 있으므로 ' +
      '`unsecuredLong` 5.4와 $2.0B만큼 겹친다 — 양쪽을 다 세지 않도록 `otherLiabilities` 플러그가 흡수한다',
  },
  {
    path: 'institution.wholesale.cbFacilityCapacity',
    value: 6.4,
    unit: '$B',
    asOf: '2023-03-09',
    sourceId: 'dfpi-order-2023-03-10',
    tag: 'CAL',
    note: '역사 경로가 마감 잔고 −$0.96B를 재현하도록 역산; Davis Polk "$5B 남짓"과 동일 자릿수',
  },
  {
    path: 'institution.committed.creditToCorporates',
    value: 60,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    tag: 'STYLIZED',
    note: '미인출 약정',
  },
  {
    path: 'institution.otherLiabilities',
    value: 2.2,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note: 'plug (A = L + E)',
  },
  {
    path: 'institution.capital.cet1',
    value: 13.7,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note:
      '**정정 12.7 → 13.7.** 10-K MD&A "Capital Resources — Capital Ratios"(인쇄본 p.84) 및 주석 23의 ' +
      'SVB Financial **CET1 Capital $13,697백만**(2021년 $12,186백만). 조정 전 CET1 12,358에 ' +
      'AOCI 옵트아웃 환입 등 조정 −1,339을 반영한 값이다. 13,697 / 113,628 = 12.05%로 공시 비율과 일치한다',
  },
  {
    path: 'institution.capital.at1',
    value: 3.6,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note:
      '연결대차대조표의 우선주 장부가 **$3,646백만**(383,500주 발행·유통) 확인 — 게임값 3.6은 그 반올림이다. ' +
      '규제상 기타기본자본(Additional tier 1)은 우선주 3,646 + 비지배지분 291 − 차감 130 = **$3,807백만**으로 ' +
      '조금 크지만, 이 모형의 `capital.at1`은 우선주 장부가를 쓴다(p.84 표)',
  },
  {
    path: 'institution.rwa',
    value: 113.6,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
    note:
      '**정정 105 → 113.6.** 10-K p.84 "Total risk-weighted assets $113,628"(은행 단독 $111,353, ' +
      '2021년 그룹 $100,812). 종전 105는 CET1 12.7을 12.05%로 나눈 역산값이었고, 분자가 틀려 분모도 ' +
      '8% 낮았다. 공시된 다른 비율도 이 분모로 검산된다(Tier1 17,504/113,628 = 15.40%, ' +
      '총자본 18,380/113,628 = 16.18%)',
  },
  {
    path: 'institution.leverageExposure',
    value: 212,
    unit: '$B',
    asOf: '2022-12-31',
    sourceId: 'svb-10k-2022',
  },
  {
    path: 'institution.fireSaleDiscount',
    value: 0.015,
    unit: 'fraction',
    asOf: '2023-03',
    sourceId: 'bcbs-d555',
    tag: 'CAL',
    note: '$20B agency MBS/일 ≈ 1.5%',
  },
  {
    path: 'institution.taxRate',
    value: 0.25,
    unit: 'fraction',
    asOf: '2023',
    sourceId: 'svb-8k-2023-03-08',
    tag: 'STYLIZED',
  },
  { path: 'market.govt2yBp', value: 480, unit: 'bp', asOf: '2023-02-27', sourceId: 'fred-dgs2' },
  {
    path: 'market.policyRateBp',
    value: 463,
    unit: 'bp',
    asOf: '2023-02-01',
    sourceId: 'fred-dgs2',
    note: '4.50–4.75% 중간값',
  },
  {
    path: 'confidence.index',
    value: 72,
    unit: 'index',
    asOf: '2023-02-27',
    sourceId: 'fed-svb-review-2023',
    tag: 'CAL',
    note: 'S0 평온 하단',
  },
  // 세그먼트 유출률 앵커
  {
    path: 'institution.deposits.0.runoffByState.2',
    value: 0.35,
    unit: 'fraction/day',
    asOf: '2023-03-09',
    sourceId: 'dfpi-order-2023-03-10',
    tag: 'CAL',
    note: 'S2 1일차 합계 ≈$43B vs 실제 $42B',
  },
  {
    path: 'institution.deposits.0.runoffByState.3',
    value: 0.95,
    unit: 'fraction/day',
    asOf: '2023-03-10',
    sourceId: 'fed-svb-review-2023',
    tag: 'CAL',
    note: 'S3 2일차 합계 ≈$95B vs 실제 ≈$100B',
  },
  // 3/9 일중 티커 앵커 (L2-c 서브턴 틱). 모두 "그날의 종가"가 앵커이며 시간대별 분포는 [STYLIZED].
  {
    path: 'anchor.govt2yBp.2023-03-08',
    value: 507,
    unit: 'bp',
    asOf: '2023-03-08',
    sourceId: 'fred-dgs2',
    note: 'DGS2 3/8 종가 5.07%(파월 증언 후 16년 최고). T3 티커의 틱 0 앵커',
  },
  {
    path: 'anchor.govt2yBp.2023-03-09',
    value: 487,
    unit: 'bp',
    asOf: '2023-03-09',
    sourceId: 'fred-dgs2',
    note: 'DGS2 3/9 종가 4.87%(−20bp, 안전자산 선호). T4 티커의 종착점',
  },
  {
    path: 'anchor.ownStockMove.2023-03-09',
    value: -0.604,
    unit: 'fraction/day',
    asOf: '2023-03-09',
    sourceId: 'sivb-close-2023-03-09',
    note: 'SIVB 3/9 종가 $106.04, 전일 대비 −60.41%(시세 이력으로 확인). 모델 누적 ≈−65%',
  },
  {
    path: 'anchor.kreMove.2023-03-09',
    value: -0.081,
    unit: 'fraction/day',
    asOf: '2023-03-09',
    sourceId: 'kre-close-2023-03-09',
    note:
      '정정: 기존 −7.7%는 KRE가 아니라 **KBW 나스닥 은행지수(BKX)**의 3/9 일간 하락폭이다. ' +
      'KRE(지역은행 ETF) 자체는 −8.1%로 2021년 1월 이후 최저 종가. 같은 날 KBWB −7.6%, KBE −7.3%',
  },
]
