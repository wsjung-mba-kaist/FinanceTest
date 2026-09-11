import type { Source } from '../../engine/types'

/**
 * covid-2020-fund 서지. 모든 게임 내 수치는 이 목록의 항목으로 추적된다.
 * 1차(primary)·감독당국(regulatory) 출처가 다수이며, 언론(press)은 타임스탬프와 인용에만 쓴다.
 *
 * 공유 서지(src/content/sources.ts)와 id가 겹치지 않도록 모두 시나리오 로컬 id를 쓴다.
 */
export const FUND_SOURCES: Source[] = [
  // ───────────── 연준 발표·통계 (1차) ─────────────
  {
    id: 'fed-pr-2020-03-03',
    title: 'Federal Reserve issues FOMC statement (긴급 50bp 인하)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-03',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200303a.htm',
    note: '연방기금금리 목표범위 1.00~1.25%로 50bp 긴급 인하(정례 회의 외)',
  },
  {
    id: 'fed-pr-2020-03-15',
    title: 'Federal Reserve issues FOMC statement (0~0.25% + 대규모 자산매입)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-15',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm',
    note: '목표범위 0~0.25%, 국채 최소 $500bn·MBS 최소 $200bn 매입, 재할인창구 1차신용 0.25%·최장 90일, 지준율 0%',
  },
  {
    id: 'fed-pr-2020-03-17-cpff',
    title: 'Federal Reserve Board announces establishment of a Commercial Paper Funding Facility',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-17',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200317a.htm',
    note: 'CPFF: 3개월 CP 직접 매입, 재무부 ESF $10bn 신용보강',
  },
  {
    id: 'fed-pr-2020-03-17-pdcf',
    title: 'Federal Reserve Board announces establishment of a Primary Dealer Credit Facility',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-17',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200317b.htm',
    note: 'PDCF: 프라이머리딜러 대상 최장 90일 담보대출(회사채·지방채·주식 등 광범위 담보)',
  },
  {
    id: 'fed-pr-2020-03-18-mmlf',
    title:
      'Federal Reserve Board broadens program of support for the flow of credit — Money Market Mutual Fund Liquidity Facility',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-18',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200318a.htm',
    note: 'MMLF: MMF가 매각한 자산을 담보로 예금기관에 대출, 재무부 ESF $10bn 신용보강',
  },
  {
    id: 'fed-pr-2020-03-19-swap',
    title:
      'Federal Reserve announces the establishment of temporary U.S. dollar liquidity arrangements with other central banks',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-19',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200319b.htm',
    note: '9개 중앙은행 임시 통화스와프: 한국은행·호주·브라질·멕시코·싱가포르·스웨덴 각 $60bn, 덴마크·노르웨이·뉴질랜드 각 $30bn',
  },
  {
    id: 'fed-pr-2020-03-23',
    title: 'Federal Reserve announces extensive new measures to support the economy',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-03-23',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20200323b.htm',
    note: 'PMCCF(발행시장)·SMCCF(유통시장, 적격 ETF 포함)·TALF 신설, 국채·MBS 매입 금액 제한 해제(무제한 QE)',
  },
  {
    id: 'fed-h41',
    title: 'H.4.1 Factors Affecting Reserve Balances of Depository Institutions (주간)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020',
    kind: 'data',
    url: 'https://www.federalreserve.gov/releases/h41/',
    note: '연준 대차대조표·유동성 공급 시설 잔액 주간 공표 — 시설 실제 사용액 확인용',
  },
  {
    id: 'fed-h15',
    title: 'H.15 Selected Interest Rates — Treasury constant maturity (일별)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020',
    kind: 'data',
    url: 'https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H15',
    note: '2/28 2y 0.86·10y 1.13·30y 1.65 / 3/9 0.38·0.54·0.99 / 3/12 0.50·0.88·1.49 / 3/16 0.36·0.73·1.34 / 3/18 0.54·1.18·1.77 / 3/20 0.37·0.92·1.55 / 3/23 0.28·0.76·1.33 / 3/24 0.38·0.84·1.39 (%)',
  },
  {
    id: 'cboe-vix-history',
    title: 'CBOE Volatility Index (VIX) — historical daily OHLC',
    publisher: 'Cboe Global Markets',
    date: '2020',
    kind: 'data',
    url: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv',
    note: '종가 2/28 40.11 / 3/9 54.46 / 3/12 75.47 / 3/16 82.69(사상 최고, 장중 83.56) / 3/18 76.45 / 3/20 66.04 / 3/23 61.59 / 3/24 61.67',
  },
  // ───────────── 공식 사후평가 ─────────────
  {
    id: 'fsb-holistic-2020',
    title: 'Holistic Review of the March Market Turmoil',
    publisher: 'Financial Stability Board',
    date: '2020-11-17',
    kind: 'regulatory',
    url: 'https://www.fsb.org/2020/11/holistic-review-of-the-march-market-turmoil/',
    note: '"대시 포 캐시(dash for cash)" 서사, 개방형 펀드·MMF 취약성, 딜러 중개 한계, 정책 대응 평가',
  },
  {
    id: 'fed-fsr-2020-05',
    title: 'Financial Stability Report — May 2020',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-05-15',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/publications/2020-may-financial-stability-report-purpose.htm',
    note: '회사채·지방채 뮤추얼펀드의 대규모 환매, 유동성 미스매치, 기업 리볼버 인출 급증',
  },
  {
    id: 'feds-note-2020-10-07',
    title: 'The Corporate Bond Market Crises and the Government Response (FEDS Notes)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-10-07',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/econres/notes/feds-notes/the-corporate-bond-market-crises-and-the-government-response-20201007.htm',
    note: 'IG 스프레드는 3/23 PMCCF·SMCCF 발표 시점에 약 4%(≈400bp), HY는 2월 4%에서 3/23 약 11%(≈1,100bp)까지 확대',
  },
  {
    id: 'bis-bulletin-02-2020',
    title:
      'Leverage and margin spirals in fixed income markets during the Covid-19 crisis (BIS Bulletin No 2)',
    publisher: 'Bank for International Settlements',
    date: '2020-04-02',
    kind: 'regulatory',
    url: 'https://www.bis.org/publ/bisbull02.htm',
    note: '국채 현·선물 베이시스 트레이드 청산, 증거금 급증, 국채 시장 기능 저하의 메커니즘',
  },
  {
    id: 'bcbs-cpmi-iosco-d526',
    title: 'Review of margining practices',
    publisher: 'BCBS · CPMI · IOSCO',
    date: '2022-09-29',
    kind: 'regulatory',
    url: 'https://www.bis.org/bcbs/publ/d526.htm',
    note: 'CCP 개시증거금 2020년 1분기 약 +$300bn(+40%), 3/9 변동증거금 일일 약 $140bn',
  },
  {
    id: 'sec-fimsac-etf-2020',
    title: 'Pricing and Liquidity of Fixed Income ETFs in the Covid-19 Crisis of 2020',
    publisher:
      'U.S. Securities and Exchange Commission (Fixed Income Market Structure Advisory Committee)',
    date: '2020-10-05',
    kind: 'regulatory',
    url: 'https://www.sec.gov/spotlight/fixed-income-advisory-committee/100520-sec-conference-bond-etf-behavior-during-covid-volatility.pdf',
    note: '채권 ETF의 NAV 대비 대규모 할인 거래, 기초자산 평가가격의 지연(stale pricing) 논쟁',
  },
  {
    id: 'sec-mmf-reform-2023',
    title: 'Money Market Fund Reforms (Release No. IC-34959)',
    publisher: 'U.S. Securities and Exchange Commission',
    date: '2023-07-12',
    kind: 'regulatory',
    url: 'https://www.sec.gov/rules/final/2023/33-11211.pdf',
    note: '환매 게이트 폐지, 일일 유동자산 25%·주간 유동자산 50%, 기관 프라임의 일일 순환매 5% 초과 시 의무 유동성 수수료',
  },
  {
    id: 'fsb-oef-2023-12',
    title:
      'Revised Policy Recommendations to Address Structural Vulnerabilities from Liquidity Mismatch in Open-Ended Funds',
    publisher: 'Financial Stability Board',
    date: '2023-12-20',
    kind: 'regulatory',
    url: 'https://www.fsb.org/2023/12/revised-policy-recommendations-to-address-structural-vulnerabilities-from-liquidity-mismatch-in-open-ended-funds/',
    note: '희석방지도구(anti-dilution tools) 우선 사용, 환매 조건과 자산 유동성의 정합, 선착순 우위(first-mover advantage) 제거',
  },
  {
    id: 'esma-34-39-1119',
    title:
      'Report on the preparedness of investment funds with significant exposures to corporate debt and real estate assets',
    publisher: 'European Securities and Markets Authority',
    date: '2020-11-12',
    kind: 'regulatory',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-1119-report_on_preparedness_of_investment_funds_with_significant_exposures_to_corporate_debt_and_re_assets.pdf',
    note: '2020년 3월 EU 회사채 펀드의 환매 대응, 일부 펀드의 환매 중단(suspension), 유동성 관리도구 준비 미흡',
  },
  // ───────────── 학술·업계 ─────────────
  {
    id: 'falato-goldstein-hortacsu-2021',
    title:
      'Financial fragility in the COVID-19 crisis: The case of investment funds in corporate bond markets (JME 123)',
    publisher: 'Journal of Monetary Economics (NBER WP 27559)',
    date: '2021-10',
    kind: 'academic',
    url: 'https://www.nber.org/papers/w27559',
    note: '2020년 2~3월 회사채 펀드의 누적 유출 평균 약 10% of NAV(2013년 테이퍼 탠트럼 정점 2.2%와 대비); 3/23 연준 발표 후 반전',
  },
  {
    id: 'ma-xiao-zeng-2022',
    title: 'Mutual Fund Liquidity Transformation and Reverse Flight to Liquidity (RFS 35-10)',
    publisher: 'Review of Financial Studies',
    date: '2022-10',
    kind: 'academic',
    url: 'https://academic.oup.com/rfs/article/35/10/4674/6520150',
    note: '2020년 3월 회사채 펀드는 현금·국채 등 유동자산을 우선 매도(수평 슬라이싱)했고, 그 결과 잔존 포트폴리오의 유동성이 저하되었다',
  },
  {
    id: 'ohara-zhou-2021',
    title: 'Anatomy of a liquidity crisis: Corporate bonds in the COVID-19 crisis (JFE 142-1)',
    publisher: 'Journal of Financial Economics',
    date: '2021-10',
    kind: 'academic',
    url: 'https://www.sciencedirect.com/science/article/pii/S0304405X21001902',
    note: 'IG 회사채 거래비용 약 30bp → 90bp, 블록 거래비용 24bp → 150bp 이상; 딜러가 대차대조표를 쓰지 않고 중개만 수행',
  },
  {
    id: 'nyfed-sr-935',
    title:
      "It's What You Say and What You Buy: A Holistic Evaluation of the Corporate Credit Facilities (Staff Report 935)",
    publisher: 'Federal Reserve Bank of New York',
    date: '2020-12',
    kind: 'academic',
    url: 'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr935.pdf',
    note: 'PMCCF·SMCCF의 발표 효과가 실제 매입보다 컸다는 분석; 발표 직후 스프레드 축소와 발행 재개',
  },
  {
    id: 'ofr-wp-21-01',
    title:
      'Hedge Fund Treasury Trading and Funding Fragility: Evidence from the COVID-19 Crisis (OFR WP 21-01)',
    publisher: 'Office of Financial Research (U.S. Treasury)',
    date: '2021-02',
    kind: 'academic',
    url: 'https://www.financialresearch.gov/working-papers/2021/02/09/hedge-fund-treasury-trading-and-funding-fragility/',
    note: '2020년 2월 헤지펀드 국채 현·선물 베이시스 포지션 추정 약 $664bn, 3월 중 약 −$127bn 축소. "$1조 초과"는 2023~24년 추정치이므로 2020년 서술에 쓰지 않는다',
  },
  {
    id: 'ici-covid-bond-funds-2020',
    title:
      'Report of the COVID-19 Market Impact Working Group: Experiences of US Bond Mutual Funds',
    publisher: 'Investment Company Institute',
    date: '2020-10',
    kind: 'data',
    url: 'https://www.ici.org/system/files/attachments/20_rpt_covid3.pdf',
    note: '2020년 3월 미국 채권 뮤추얼펀드 순유출 $250bn 초과(운용자산의 약 5%), 주간 흐름과 자산군별 분해',
  },
  {
    id: 'ishares-lqd-premium-discount',
    title:
      'iShares iBoxx $ Investment Grade Corporate Bond ETF (LQD) — Premium/Discount 일별 공시 (SEC Rule 6c-11(c)(1)(ii) 웹사이트 공시)',
    publisher: 'BlackRock / iShares (발행사 규제 공시)',
    date: '2021-01-15',
    kind: 'primary',
    url: 'https://web.archive.org/web/20210115084252id_/https://www.ishares.com/us/products/239566/ishares-iboxx-investment-grade-corporate-bond-etf/1467271812595.ajax?tab=premium-discount-chart',
    note:
      '2020-01-02~2021-01-14의 종가 대비 NAV 괴리 일별 원계열(현재 iShares 페이지는 최근 기간만 노출하므로 ' +
      '2021-01-15 아카이브본을 쓴다). 2020년 3월: 3/11 −3.2943 · 3/12 −5.0239 · 3/13 −0.4550 · ' +
      '3/16 −1.6425 · 3/17 −2.2708 · 3/18 −2.2528 · **3/19 −5.0804(연중 최대 할인)** · 3/20 −2.7798 · ' +
      '3/23 +2.9341 · 3/24 +2.8127 · **3/25 +5.0396(연중 최대 프리미엄)**. 같은 아카이브본의 NAV 계열 ' +
      '(3/12 124.178582 · 3/19 110.672579)과 종가로도 같은 값이 재현된다. Rule 6c-11에 따르는 ETF는 ' +
      '연차보고서에 프리미엄/할인 빈도표를 싣지 않고 이 웹 공시로 갈음하므로, N-CSR에는 이 계열이 없다',
  },
  {
    id: 'bis-bulletin-06-2020',
    title:
      'The recent distress in corporate bond markets: cues from ETFs (BIS Bulletin No 6, Aramonte & Avalos)',
    publisher: 'Bank for International Settlements',
    date: '2020-04-14',
    kind: 'regulatory',
    url: 'https://www.bis.org/publications/bulletin-6-recent-distress-corporate-bond-markets-cues-etfs.pdf',
    note:
      '인쇄본 p.4: "some of the largest ETFs in both the IG and HY segments recorded NAV discounts in ' +
      'excess of 5% (Graph 2, first and fourth panels)" — Graph 2 범례가 LQD(iShares iBoxx $ Investment ' +
      'Grade Corporate Bond ETF)를 명시한다. 같은 쪽의 "IG ETFs with duration under three years recorded ' +
      'a larger NAV discount than average (6.9% versus 5.3%)"의 5.3%는 **개별 ETF가 아니라 IG ETF 횡단면 ' +
      '평균**이므로 LQD 수치와 혼동하지 않는다',
  },
  {
    id: 'fed-libor-ois-2020-06-29',
    title:
      'How Correlated is LIBOR with Bank Funding Costs? (FEDS Notes) — Figure 1 접근성 버전의 3개월 LIBOR-OIS 일별 표',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2020-06-29',
    kind: 'primary',
    url: 'https://www.federalreserve.gov/econres/notes/feds-notes/how-correlated-is-libor-with-bank-funding-costs-20200629.htm',
    note:
      'Figure 1의 접근성(accessible) 버전이 1988-10-04~2020-05-22의 3개월 LIBOR-OIS 스프레드 일별 값을 ' +
      '표로 공표한다. 2020-02-27 16.12 · **2020-02-28 26.60** · 03-02 17.27 · 03-23 111.39 · ' +
      '03-27 138.16 · **03-31 138.17(3월 최대)**. (참고 2008-10-10 364.12.) **FRA-OIS가 아니다** — ' +
      '2020년 2월 말은 시장이 긴급 인하를 선반영해 현물·선도 지표가 갈라진 구간이라 대용으로 쓸 수 없다',
  },
  {
    id: 'blackrock-etf-primary-2020',
    title: 'By the numbers: new data behind the bond ETF primary process',
    publisher: 'BlackRock / iShares',
    date: '2020',
    kind: 'press',
    url: 'https://www.blackrock.com/corporate/literature/whitepaper/ishares-by-the-numbers-new-data-behind-the-bond-etf-primary-process.pdf',
    note:
      '현물 바스켓(in-kind) 설정·환매 경로의 실제 사용 기록. **2026-09 확인: 이 URL은 더 이상 PDF를 반환하지 않는다(HTML 오류 페이지).** 종전에 이 문서에서 인용하던 "2020년 3월 IG 회사채 ETF 최대 할인 −5.35%"는 발행사 자신의 Rule 6c-11 공시와 맞지 않는다 — LQD의 자기 NAV 기준 최대 할인은 **3/19 −5.08%**이고 −5.35%는 같은 날을 ICE 평가가격 기준으로 잰 값이다. 괴리 수치의 근거는 `ishares-lqd-premium-discount`로 옮겼고, 이 출처는 in-kind 서사에만 쓴다',
  },
  {
    id: 'sifma-fixed-income-2020',
    title: 'US Fixed Income Securities Statistics — corporate bond issuance',
    publisher: 'SIFMA',
    date: '2020',
    kind: 'data',
    url: 'https://www.sifma.org/resources/research/fixed-income-chart/',
    note: '3/23 이후 약 두 달간 IG 회사채 발행 $625bn 규모로 사상 최대 — 발행시장 재개 확인',
  },
  {
    id: 'reuters-2020-03-12',
    title: 'Wall Street plunges, S&P 500 confirms bear market as coronavirus fears deepen',
    publisher: 'Reuters',
    date: '2020-03-12',
    kind: 'press',
    url: 'https://www.reuters.com/article/us-usa-stocks-idUSKBN20Z1BS',
    note: '타임스탬프·시장 서술 용도. 3/12 2차 서킷브레이커 발동, ECB 예금금리 동결·매입 확대 발표',
  },
  {
    id: 'reuters-2020-03-23',
    title: 'Fed pulls out all the stops to shore up economy amid coronavirus shutdown',
    publisher: 'Reuters',
    date: '2020-03-23',
    kind: 'press',
    url: 'https://www.reuters.com/article/us-health-coronavirus-fed-idUSKBN21A1EL',
    note: '타임스탬프 용도. 3/23 08:00 ET 발표, 시장 반응 서술',
  },
]
