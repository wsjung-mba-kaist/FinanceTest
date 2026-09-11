/**
 * FactLedger — 초기 상태의 모든 숫자 리프와 턴별 외생 시계열의 출처
 * (docs/authoring-guide.md 체크리스트 1·2, §4.2).
 *
 * tag: VERIFY (아직 1차 출처로 확인하지 못한 값 — 릴리스 전 해소) ·
 *      STYLIZED (합성 펀드를 위해 의도적으로 단순화·반올림한 값) ·
 *      CAL (보정 규칙에서 도출한 값; docs/scenarios/covid-2020-fund.md §6)
 *
 * 단위: $M (units.scale = 1e6). 금리·스프레드는 bp.
 *
 * 사실 확인 원칙
 * - 국채 금리(2y/10y/30y)는 연준 H.15 일별 종가 그대로 사용한다 — 전 구간 1차 출처.
 * - VIX는 Cboe VIX_History 일별 종가 그대로 사용한다 — 전 구간 1차 출처.
 * - 하버라이트 크레딧펀드는 **합성 펀드**다. 대차대조표 항목은 전부 STYLIZED이며 실제 특정 펀드가 아니다.
 * - 2020년 국채 베이시스 트레이드 규모는 **약 $664bn(2020년 2월)**을 쓴다.
 *   흔히 인용되는 "$1조 초과"는 2023~24년 추정치이므로 2020년 서술에 쓰지 않는다.
 */
export interface FactRow {
  path: string
  value: number
  unit: string
  asOf: string
  knownAt?: string
  sourceId: string
  tag?: 'VERIFY' | 'STYLIZED' | 'CAL'
  note?: string
}

export const FUND_FACTS: FactRow[] = [
  // ───────────── 펀드 대차대조표 (합성) ─────────────
  {
    path: 'institution.fund.nav',
    value: 8000,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'STYLIZED',
    note: '합성 펀드 순자산 $8bn — 계획서 부록 B-2 설계값. 2020년 초 미국 회사채 뮤추얼펀드 상위권의 전형적 규모대',
  },
  {
    path: 'institution.fund.shares',
    value: 800,
    unit: 'M좌',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'STYLIZED',
    note: '기준가 $10.00 = NAV 8,000 / 800M좌 (표시 편의를 위한 반올림)',
  },
  {
    path: 'institution.fund.leverage',
    value: 1,
    unit: 'x',
    asOf: '2020-02-28',
    sourceId: 'fed-fsr-2020-05',
    tag: 'STYLIZED',
    note: '미국 등록 개방형 펀드는 1940년법상 차입이 제한되어 사실상 무차입 — 기본 1.0x',
  },
  {
    path: 'institution.liquidity.daily',
    value: 560,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'sec-mmf-reform-2023',
    tag: 'STYLIZED',
    note: '현금·T-bill·온더런 국채 = NAV의 7%. SEC 유동성 리스크 관리 규칙(22e-4)의 "고유동성" 구간에 대응',
  },
  {
    path: 'institution.liquidity.weekly',
    value: 1040,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'ohara-zhou-2021',
    tag: 'STYLIZED',
    note: '장기 국채·에이전시·대형 벤치마크 IG(1주 내 현금화) = NAV의 13%',
  },
  {
    path: 'institution.liquidity.monthly',
    value: 3600,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'ohara-zhou-2021',
    tag: 'STYLIZED',
    note: '일반 IG 회사채 = NAV의 45%',
  },
  {
    path: 'institution.liquidity.illiquid',
    value: 2800,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'ohara-zhou-2021',
    tag: 'STYLIZED',
    note: 'HY·오프벤치마크·소액 발행·144A = NAV의 35%. IG/HY 혼합 펀드의 HY 비중 약 20%를 포함',
  },
  {
    path: 'institution.redemptions.pendingPct',
    value: 0,
    unit: '%NAV',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
  },
  {
    path: 'institution.redemptions.swingPricingBp',
    value: 0,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fsb-oef-2023-12',
    note: '2020년 3월 시점 미국 등록 펀드는 스윙프라이싱을 사실상 쓰지 않았다(2016년 허용 규칙에도 불구하고 회계·중개 인프라 미비)',
  },
  {
    path: 'institution.redemptions.cumulativePct',
    value: 0,
    unit: '%NAV',
    asOf: '2020-02-28',
    sourceId: 'falato-goldstein-hortacsu-2021',
  },
  {
    path: 'institution.custom.navIndex',
    value: 100,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'CAL',
    note: '기준가 지수 = 좌당 순자산 / $10.00 × 100 (2/28 = 100)',
  },
  {
    path: 'institution.custom.initialNav',
    value: 8000,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'CAL',
    note: '누적 환매율(%NAV)의 분모로 쓰는 기준일 순자산 — 시나리오 내 불변',
  },
  {
    path: 'institution.custom.illiquidSharePct',
    value: 35,
    unit: '%',
    asOf: '2020-02-28',
    sourceId: 'ma-xiao-zeng-2022',
    tag: 'CAL',
    note: '비유동 구간 / 총자산 × 100. 수평 슬라이싱이 이 값을 올리고 수직 슬라이싱은 유지한다',
  },
  {
    path: 'institution.custom.bidAskIgBp',
    value: 30,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'ohara-zhou-2021',
    note: 'IG 회사채 왕복 거래비용 위기 전 약 30bp (3월 중 약 90bp, 블록은 24 → 150bp 이상)',
  },
  {
    path: 'institution.custom.dilutionBp',
    value: 0,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fsb-oef-2023-12',
    tag: 'CAL',
    note: '누적 희석 = 환매 대응 거래비용 중 잔존 투자자가 부담한 부분 / NAV × 10,000',
  },
  {
    path: 'institution.custom.creditLineLimit',
    value: 400,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'fed-fsr-2020-05',
    tag: 'STYLIZED',
    note: '커밋 크레딧라인 약정 한도 = NAV의 5%. 미국 뮤추얼펀드의 공동(committed line) 약정 관행 수준',
  },
  {
    path: 'institution.custom.creditLineDrawn',
    value: 0,
    unit: '$M',
    asOf: '2020-02-28',
    sourceId: 'fed-fsr-2020-05',
  },
  // ───────────── 시장 (2020-02-28 종가) ─────────────
  {
    path: 'market.policyRateBp',
    value: 163,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
    note: '연방기금 목표범위 1.50~1.75%의 중간값 1.625% → 163bp(반올림)',
  },
  {
    path: 'market.govt2yBp',
    value: 86,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
    note: '2년 국채 불변만기 수익률 0.86%',
  },
  {
    path: 'market.govt10yBp',
    value: 113,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
    note: '10년 국채 불변만기 수익률 1.13%',
  },
  {
    path: 'market.govt30yBp',
    value: 165,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
    note: '30년 국채 불변만기 수익률 1.65%',
  },
  {
    path: 'market.creditSpreadIgBp',
    value: 130,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'feds-note-2020-10-07',
    tag: 'VERIFY',
    note:
      'ICE BofA US Corporate OAS 기준 2월 말 수준 ≈130bp로 설정. **2026-09 재확인: 여전히 미해소이며 ' +
      '막힌 경로가 확정됐다.** FRED 익명 다운로드는 `BAMLC0A0CM`에 대해 최근 3년(2023-09-12 이후 795건)만 ' +
      '돌려주고 `cosd`·`coed`를 붙여도 바이트 단위로 같은 파일을 준다 — 같은 요청의 `DGS10`은 1962년부터 ' +
      '전 기간(16,877건)이 오므로 일반 상한이 아니라 **ICE 라이선스 제약**이다. 어떤 공개 문헌도 ' +
      '2020-02-28의 수치를 표로 싣지 않는다(연준 FSR 2020-11은 같은 계열에 "Source: ICE Data Indices, ' +
      'LLC, used with permission"만 달고 값을 싣지 않는다). **해소 데이터셋**: 무료 FRED API 키로 ' +
      '`api.stlouisfed.org/fred/series/observations?series_id=BAMLC0A0CM&observation_start=2020-02-28' +
      '&observation_end=2020-02-28`(계열은 1996-12-31부터). **교차확인**: 같은 날 Baa−10년 238bp · ' +
      'Aaa−10년 157bp(FRED DBAA·DAAA·DGS10 직접 조회). FEDS Note 2020-10-07 Figure 1 접근성 버전은 ' +
      '"Investment-grade bond yield spread is around 1% in February"로 서술하므로 **게임값 130bp는 그 ' +
      '서술보다 다소 넓다** — 재확정 시 하향 조정 가능성이 있다',
  },
  {
    path: 'market.creditSpreadHyBp',
    value: 500,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'feds-note-2020-10-07',
    tag: 'VERIFY',
    note:
      'HY OAS 2월 말 ≈500bp. `market.creditSpreadIgBp`와 **같은 ICE 라이선스 제약**으로 막혀 있다 ' +
      '(FRED 익명 다운로드의 `BAMLH0A0HYM2`도 2023-09-12 이후만 반환, 2026-09 재확인). ' +
      '**해소 데이터셋**: 무료 FRED API 키로 `series_id=BAMLH0A0HYM2`, `observation_start/end=2020-02-28`. ' +
      'FEDS Note 2020-10-07 Figure 1 접근성 버전의 서술은 "rising from 4% in February to about 11% on ' +
      'March 23"이며 "2월"의 날짜가 특정되지 않아 2/28 종가로는 확정되지 않는다. 3/23 정점 1,087bp는 ' +
      '같은 노트로 확인된 값이다',
  },
  {
    path: 'market.fundingStressBp',
    value: 35,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fsb-holistic-2020',
    tag: 'VERIFY',
    note:
      '3개월 FRA-OIS 근사. **2026-09 재확인: 2020-02-28의 FRA-OIS 수치를 적은 공표 문헌이 없다.** ' +
      '이름은 쓰되 값은 싣지 않는 1차 문헌: 뉴욕연준·재무부 『Treasury and Federal Reserve Foreign ' +
      'Exchange Operations, Q1 2020』 p.5("LIBOR–OIS, FRA–OIS ... widened notably and reached levels ' +
      'last seen during the GFC"), IMF GFSR 2020-04 Fig 1.1(값 없는 변화폭 막대). BIS QR 2020-06 · ' +
      '연준 FSR 2020-05 · 2020-03-15 FOMC 의사록에는 "FRA"라는 단어 자체가 없다. **해소 데이터셋**: ' +
      '블룸버그 `USFOSC1 BGN Curncy`(USD 3개월 FRA-OIS = 3x6 LIBOR FRA − 대응 선도 OIS). 무료 경로로는 ' +
      'CME 유로달러(GE) 일별 정산가에서 30일 연방기금선물(ZQ) OIS 스트립을 빼서 재구성한다. ' +
      '**확인된 인접 계열(대용 아님, 다른 계열)**: 3개월 **LIBOR-OIS**는 2020-02-28 **26.60bp**, ' +
      '3월 최대 **138.17bp(3/31)** — 연준 FEDS Notes 2020-06-29 "How Correlated is LIBOR with Bank ' +
      'Funding Costs?" Figure 1의 접근성 버전이 일별 표를 그대로 공표한다. 다만 2020-02-28은 시장이 ' +
      '긴급 인하를 선반영해 현물·선도 지표가 갈라진 날이라 LIBOR-OIS를 FRA-OIS 대용으로 쓰면 안 된다 ' +
      '(3/3 51.53 → 3/4 23.52의 급등락은 회의간 인하에 따른 현물 고시 artefact이며 FRA-OIS에는 없다)',
  },
  {
    path: 'market.equityIndex',
    value: 100,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'fed-fsr-2020-05',
    tag: 'CAL',
    note: 'S&P 500을 2/28 종가 = 100으로 지수화(표시용)',
  },
  {
    path: 'market.volIndex',
    value: 40.11,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'cboe-vix-history',
    note: 'VIX 종가 40.11',
  },
  {
    path: 'market.fxUsdLocal',
    value: 1,
    unit: 'USD/USD',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
    tag: 'STYLIZED',
    note: '달러 기준 펀드 — 환율 축은 사용하지 않는다',
  },
  {
    path: 'market.ownStock',
    value: 100,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'STYLIZED',
    note: '개방형 펀드에는 상장 주가가 없다 — 사용하지 않는다',
  },
  {
    path: 'market.ownCdsBp',
    value: 0,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'STYLIZED',
    note: '해당 없음',
  },
  {
    path: 'market.custom.etfDiscountPct',
    value: -0.2,
    unit: '%',
    asOf: '2020-02-28',
    sourceId: 'blackrock-etf-primary-2020',
    tag: 'STYLIZED',
    note: '대표 IG 회사채 ETF의 NAV 대비 괴리. 평시에는 ±0.2% 내에서 움직인다',
  },
  {
    path: 'market.custom.treasuryOffRunBp',
    value: 3,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'bis-bulletin-02-2020',
    tag: 'STYLIZED',
    note: '온·오프더런 10년 국채 수익률 격차 — 국채 시장 유동성 지표. 평시 2~4bp',
  },
  // ───────────── 신뢰 ─────────────
  {
    path: 'confidence.index',
    value: 68,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'fed-fsr-2020-05',
    tag: 'CAL',
    note: 'S1(우려) 상단: 2/24~28 주간 S&P 급락과 첫 환매 유입이 시작된 상태',
  },
  {
    path: 'confidence.depositors',
    value: 68,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'CAL',
    note: '수익자(개인·기관 투자자)',
  },
  {
    path: 'confidence.counterparties',
    value: 65,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'ohara-zhou-2021',
    tag: 'CAL',
    note: '딜러·지정참가회사(AP)·크레딧라인 은행',
  },
  {
    path: 'confidence.regulators',
    value: 75,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'sec-fimsac-etf-2020',
    tag: 'CAL',
    note: 'SEC 투자관리국',
  },
  {
    path: 'confidence.investors',
    value: 68,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'ici-covid-bond-funds-2020',
    tag: 'CAL',
    note: '대형 기관 보유자(공적연금·보험)',
  },
  {
    path: 'confidence.media',
    value: 62,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'reuters-2020-03-12',
    tag: 'CAL',
  },
  {
    path: 'confidence.board',
    value: 75,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'esma-34-39-1119',
    tag: 'CAL',
    note: '펀드 이사회(독립이사 포함)',
  },
  // ───────────── 외생 시계열: 국채 10년 (H.15 일별 종가, bp) ─────────────
  {
    path: 'turns.t0.market.govt10yBp',
    value: 113,
    unit: 'bp',
    asOf: '2020-02-28',
    sourceId: 'fed-h15',
  },
  {
    path: 'turns.t1.market.govt10yBp',
    value: 54,
    unit: 'bp',
    asOf: '2020-03-09',
    sourceId: 'fed-h15',
    note: '사상 최저 종가',
  },
  {
    path: 'turns.t2.market.govt10yBp',
    value: 88,
    unit: 'bp',
    asOf: '2020-03-12',
    sourceId: 'fed-h15',
  },
  {
    path: 'turns.t3.market.govt10yBp',
    value: 73,
    unit: 'bp',
    asOf: '2020-03-16',
    sourceId: 'fed-h15',
  },
  {
    path: 'turns.t4.market.govt10yBp',
    value: 118,
    unit: 'bp',
    asOf: '2020-03-18',
    sourceId: 'fed-h15',
    note: '주식·국채 동반 매도 — 안전자산마저 현금화되던 날',
  },
  {
    path: 'turns.t5.market.govt10yBp',
    value: 92,
    unit: 'bp',
    asOf: '2020-03-20',
    sourceId: 'fed-h15',
  },
  {
    path: 'turns.t6.market.govt10yBp',
    value: 76,
    unit: 'bp',
    asOf: '2020-03-23',
    sourceId: 'fed-h15',
  },
  {
    path: 'turns.t7.market.govt10yBp',
    value: 84,
    unit: 'bp',
    asOf: '2020-03-24',
    sourceId: 'fed-h15',
  },
  // ───────────── 외생 시계열: VIX (Cboe 일별 종가) ─────────────
  {
    path: 'turns.t0.market.volIndex',
    value: 40.11,
    unit: 'index',
    asOf: '2020-02-28',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t1.market.volIndex',
    value: 54.46,
    unit: 'index',
    asOf: '2020-03-09',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t2.market.volIndex',
    value: 75.47,
    unit: 'index',
    asOf: '2020-03-12',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t3.market.volIndex',
    value: 82.69,
    unit: 'index',
    asOf: '2020-03-16',
    sourceId: 'cboe-vix-history',
    note: '사상 최고 종가(장중 고점 83.56)',
  },
  {
    path: 'turns.t4.market.volIndex',
    value: 76.45,
    unit: 'index',
    asOf: '2020-03-18',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t5.market.volIndex',
    value: 66.04,
    unit: 'index',
    asOf: '2020-03-20',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t6.market.volIndex',
    value: 61.59,
    unit: 'index',
    asOf: '2020-03-23',
    sourceId: 'cboe-vix-history',
  },
  {
    path: 'turns.t7.market.volIndex',
    value: 61.67,
    unit: 'index',
    asOf: '2020-03-24',
    sourceId: 'cboe-vix-history',
  },
  // ───────────── 외생 시계열: IG OAS (bp) ─────────────
  {
    path: 'turns.t6.market.creditSpreadIgBp',
    value: 401,
    unit: 'bp',
    asOf: '2020-03-23',
    sourceId: 'feds-note-2020-10-07',
    note: 'IG 스프레드 정점. FEDS Note는 PMCCF·SMCCF 발표 시점 "약 4%"로 서술한다. ICE BofA 계열 ≈401bp, Bloomberg US Corporate 계열 ≈373bp로 지수별 차이가 있어 체크포인트 허용오차 8%로 두 값을 모두 포함한다',
  },
  {
    path: 'turns.t1.market.creditSpreadIgBp',
    value: 182,
    unit: 'bp',
    asOf: '2020-03-09',
    sourceId: 'feds-note-2020-10-07',
    tag: 'CAL',
    note: '2/28 130bp → 3/23 401bp 경로를 일별 종가 형태로 보간. 정점·시점만 출처값',
  },
  {
    path: 'turns.t2.market.creditSpreadIgBp',
    value: 236,
    unit: 'bp',
    asOf: '2020-03-12',
    sourceId: 'feds-note-2020-10-07',
    tag: 'CAL',
  },
  {
    path: 'turns.t3.market.creditSpreadIgBp',
    value: 283,
    unit: 'bp',
    asOf: '2020-03-16',
    sourceId: 'feds-note-2020-10-07',
    tag: 'CAL',
  },
  {
    path: 'turns.t4.market.creditSpreadIgBp',
    value: 337,
    unit: 'bp',
    asOf: '2020-03-18',
    sourceId: 'feds-note-2020-10-07',
    tag: 'CAL',
  },
  {
    path: 'turns.t5.market.creditSpreadIgBp',
    value: 373,
    unit: 'bp',
    asOf: '2020-03-20',
    sourceId: 'feds-note-2020-10-07',
    tag: 'CAL',
  },
  {
    path: 'turns.t7.market.creditSpreadIgBp',
    value: 358,
    unit: 'bp',
    asOf: '2020-03-24',
    sourceId: 'nyfed-sr-935',
    tag: 'CAL',
    note: '발표 다음날 축소 개시. FRBNY SR 935는 발표 효과가 매입 실행보다 컸다고 본다',
  },
  // ───────────── 외생 시계열: HY OAS (bp) ─────────────
  {
    path: 'turns.t6.market.creditSpreadHyBp',
    value: 1087,
    unit: 'bp',
    asOf: '2020-03-23',
    sourceId: 'feds-note-2020-10-07',
    note: 'HY 정점. ICE BofA US High Yield OAS 2020-03-23 = 10.87% (FEDS Note: 2월 약 4% → 3/23 약 11%). 조사 도시에의 "~1,100bp [미확인]"을 이 값으로 해소',
  },
  // ───────────── 외생 시계열: 회사채 ETF 괴리 (%) ─────────────
  {
    path: 'turns.t2.market.custom.etfDiscountPct',
    value: -5.02,
    unit: '%',
    asOf: '2020-03-12',
    sourceId: 'ishares-lqd-premium-discount',
    note:
      '**정정 −5.35 → −5.02.** 발행사 iShares가 Rule 6c-11에 따라 공시하는 LQD 일별 프리미엄/할인 ' +
      '원계열을 직접 확보해 확정했다: 3/11 −3.2943 · **3/12 −5.0239** · 3/13 −0.4550 · 3/16 −1.6425 · ' +
      '3/17 −2.2708 · 3/18 −2.2528 · **3/19 −5.0804(연중 최대 할인)** · 3/20 −2.7798 · 3/23 +2.9341 · ' +
      '3/24 +2.8127 · 3/25 +5.0396(연중 최대 프리미엄). 즉 **최대 할인일은 3/12가 아니라 3/19**이고, ' +
      '널리 인용되는 −5.35%는 같은 3/19 사건을 ICE 평가가격 기준으로 잰 값(ICE Market Pulse)이며 ' +
      '−4.5%는 3/12를 "fair value" 기준으로 보도한 언론 수치다. 규제기관 교차확인: BIS Bulletin ' +
      'No 6(2020-04-14) p.4 "some of the largest ETFs in both the IG and HY segments recorded NAV ' +
      'discounts in excess of 5%"이고 Graph 2의 범례가 LQD를 명시한다. ' +
      '**미해소 인접 항목**: 게임 T6(2020-03-24)의 −0.4%는 같은 공시의 관측치 **+2.81%(프리미엄)** 와 ' +
      '어긋난다 — 이 행은 `[VERIFY]` 대상이 아니었고 고치면 T6 서사와 체크포인트가 함께 움직이므로 ' +
      '이번 작업에서는 기록만 남긴다',
  },
  // ───────────── 펀드 유출(외생 기저) ─────────────
  {
    path: 'turns.cumulative.redemptionsPct',
    value: 10,
    unit: '%NAV',
    asOf: '2020-03-23',
    sourceId: 'falato-goldstein-hortacsu-2021',
    note: '2020년 2월 말~3월 23일 회사채 펀드 평균 누적 유출 ≈10% of NAV. 턴별 기저 유출률(0.3/0.8/1.4/1.9/2.3/2.1/1.2)은 이 합계에 맞춘 [CAL] 배분',
  },
  {
    path: 'turns.market.bondFundOutflowUsdB',
    value: 250,
    unit: '$B',
    asOf: '2020-03-31',
    sourceId: 'ici-covid-bond-funds-2020',
    note: '2020년 3월 미국 채권 뮤추얼펀드 순유출 $250bn 초과(운용자산의 약 5%)',
  },
  {
    path: 'turns.market.bondFundOutflow1wUsdB',
    value: 109,
    unit: '$B',
    asOf: '2020-03-20',
    sourceId: 'fsb-holistic-2020',
    note:
      '**종전 행 `corpFundEtfOutflow2wUsdB` = $174bn을 폐기하고 이 행으로 대체했다.** FSB Holistic ' +
      'Review 전문(60쪽)을 기계 판독한 결과 "174"는 각주의 트위터 URL 조각 외에 한 번도 나오지 않으며, ' +
      '회사채 펀드+ETF의 2주간 유출액 자체가 보고서에 없다. 이 보고서가 실제로 싣는 값은 §4.2(인쇄본 ' +
      'p.21)의 "in mid-March, weekly outflows from bond funds reached record levels (US$109 billion)"이며, ' +
      '출처는 EPFR·FSB 계산이다. 규모 정합성 교차확인: ICI 『Experiences of US ETFs During the COVID-19 ' +
      'Crisis』(2020-10)는 3/18·3/25 종료 2주간 투자등급 채권 ETF 순유출을 약 $23bn으로 적고, ' +
      'FSOC 2020 연차보고서는 3월 한 달 채권 뮤추얼펀드 유출을 $255bn으로 적는다 — $174bn을 "회사채 ' +
      '펀드+ETF 2주"로 두면 이 둘 사이에 들어갈 자리가 없다',
  },
  {
    path: 'turns.market.primeMmfOutflowUsdB',
    value: 100,
    unit: '$B',
    asOf: '2020-03-26',
    sourceId: 'sec-mmf-reform-2023',
    note: '기관 프라임 MMF 3/6~3/26 약 $100bn 유출(3주 만에 운용자산의 약 16%)',
  },
  {
    path: 'turns.market.revolverDrawUsdB',
    value: 284,
    unit: '$B',
    asOf: '2020-04-30',
    sourceId: 'fed-fsr-2020-05',
    note: '3~4월 기업 리볼버 인출 $284bn(과반이 IG 차주)',
  },
  {
    path: 'turns.market.basisTradeUsdB',
    value: 664,
    unit: '$B',
    asOf: '2020-02-29',
    sourceId: 'ofr-wp-21-01',
    note: '헤지펀드 국채 현·선물 베이시스 포지션 2020년 2월 ≈$664bn, 3월 중 ≈−$127bn 축소. "$1조 초과"는 2023~24년 추정치이므로 사용하지 않는다',
  },
  {
    path: 'turns.market.ccpInitialMarginUsdB',
    value: 300,
    unit: '$B',
    asOf: '2020-03-31',
    sourceId: 'bcbs-cpmi-iosco-d526',
    note: 'CCP 개시증거금 2020년 1분기 약 +$300bn(+40%), 3/9 변동증거금 일일 약 $140bn',
  },
  {
    path: 'turns.market.igIssuanceAfterFacilitiesUsdB',
    value: 625,
    unit: '$B',
    asOf: '2020-05-20',
    sourceId: 'sifma-fixed-income-2020',
    note: '3/23 발표 이후 약 두 달간 IG 회사채 발행 $625bn — 발행시장 재개의 규모',
  },
  {
    path: 'turns.market.igTradingCostBp',
    value: 90,
    unit: 'bp',
    asOf: '2020-03-20',
    sourceId: 'ohara-zhou-2021',
    note: 'IG 왕복 거래비용 30bp → 90bp, 블록 거래비용 24bp → 150bp 이상',
  },
  // ───────────── 보정값 (calibration) ─────────────
  {
    path: 'cal.duration.monthly.spread',
    value: 5.5,
    unit: 'y',
    asOf: '2020-03-23',
    sourceId: 'ohara-zhou-2021',
    tag: 'CAL',
    // [VERIFY] 보정 앵커로 쓴 "2/28→3/23 IG 지수 총수익 약 −12%, HY 지수 약 −20%"는 2차 기억에
    // 기반한 값이며 2026-09 재조사에서도 닫히지 않았다. 해소 데이터셋: Bloomberg 총수익 지수
    // `LUACTRUU Index`(US Corporate)와 `LF98TRUU Index`(US Corporate High Yield)의 2020-02-28→
    // 2020-03-23 구간 수익률, 또는 ICE BofA `C0A0`·`H0A0` 총수익 지수(FRED `BAMLCC0A0CMTRIV`·
    // `BAMLHYH0A0HYM2TRIV` — 단, ICE 계열은 익명 다운로드에서 최근 3년만 반환되므로 FRED API 키 필요).
    note: '구간별 유효 듀레이션(rate / spread): daily 2.0/0 · weekly 7.0/2.5 · monthly 7.5/5.5 · illiquid 4.0/4.0(HY 스프레드 기준). 2/28→3/23 포트폴리오 시가 −13~14%가 되도록 보정',
  },
  {
    path: 'cal.concentrationDrag.k',
    value: 3,
    unit: 'x',
    asOf: '2020-03-23',
    sourceId: 'ma-xiao-zeng-2022',
    tag: 'CAL',
    note: '집중도 마크다운 = k × max(0, 비유동비중% − 35)/100 × ΔHY스프레드/10,000. 유동자산을 먼저 판 펀드의 잔존 포트폴리오가 더 크게 상각되는 효과',
  },
  {
    path: 'cal.saleCapacity.perDay',
    value: 0.15,
    unit: 'fraction',
    asOf: '2020-03-18',
    sourceId: 'ohara-zhou-2021',
    tag: 'CAL',
    note: '구간별 당일 매도 가능 비율: weekly 40% · monthly 15% · illiquid 3%. 시장 스트레스 계수(=30/거래비용bp)를 곱한다',
  },
]
