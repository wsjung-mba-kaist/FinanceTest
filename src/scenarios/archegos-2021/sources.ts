import type { Source } from '../../engine/types'

/**
 * archegos-2021 서지. 공유 서지(src/content/sources.ts)와 같은 id를 쓰는 항목은 내용도 동일하게 유지한다
 * (paul-weiss-cs-archegos-2021 · sec-pr-2022-70 · cgfs-36 · pwg-hedge-funds-1999). 나머지는 시나리오
 * 로컬 항목이며 공유 서지 승격 후보다(보고서 참조).
 *
 * 유형 규약: primary = 당사자 공시·독립조사보고서·법원 제출물, regulatory = 감독당국·국제기준기구,
 * data = 시계열, press = 타임스탬프·인용 전용(수치 근거로 쓰지 않는다).
 */
export const ARCHEGOS_SOURCES: Source[] = [
  // ───────────────────────── 1차 조사·공시 ─────────────────────────
  {
    id: 'paul-weiss-cs-archegos-2021',
    title:
      'Credit Suisse Group Special Committee of the Board of Directors — Report on Archegos Capital Management',
    publisher: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
    date: '2021-07-29',
    url: 'https://www.paulweiss.com/practices/litigation/internal-investigations/news/credit-suisse-publishes-independent-review-of-archegos-losses?id=40637',
    kind: 'primary',
    pages: '서두 ("CS incurred approximately $5.5 billion in losses"), 마진·한도·동적마진 관련 절',
    note: 'CS 스왑 마진 ~20%→7.5%(2019)→평균 5.9%(2020.9), PE 한도 $20m 10배 초과, $530m 미대응, 3/26 매도 명목 $30억 남짓(그중 $12.7억이 골드만 주도 블록); 경영·통제의 근본적 실패; 23명 징계·$70m 환수. 전문은 EDGAR Form 6-K Exhibit 99.2(2021-07-29, CIK 1053092)로도 열람 가능하다. 공유 서지(src/content/sources.ts)와 URL·제목을 동일하게 유지한다',
  },
  {
    id: 'cs-q1-2021-results',
    title: 'Credit Suisse Group AG — Trading Update (Form 6-K Exhibit 99.3, CHF 4.4bn charge)',
    publisher: 'Credit Suisse Group AG / U.S. SEC EDGAR',
    date: '2021-04-06',
    url: 'https://www.sec.gov/Archives/edgar/data/1053092/000137036821000031/a210406-99_3.htm',
    kind: 'primary',
    note: '"미국 소재 헤지펀드의 마진 약정 불이행"에 대한 CHF 4.4bn 계상(1Q21 세전손실 약 CHF 9억 전망). 보도자료 자체는 "Archegos"라는 이름을 쓰지 않는다. **CHF 4.4bn은 1Q21 계상액이고 USD 5.5bn은 1~2Q 합계 총손실이므로 서로 다른 측정치이지 경쟁하는 추정치가 아니다.** 1Q21 실적 자체는 2021-04-22 공표',
  },
  {
    id: 'nomura-20f-fy2021',
    title: 'Nomura Holdings, Inc. — Annual Report on Form 20-F, fiscal year ended 31 March 2021',
    publisher: 'Nomura Holdings / U.S. SEC EDGAR',
    date: '2021-06',
    url: 'https://www.sec.gov/Archives/edgar/data/1163653/000119312521199397/d103463d20f.htm',
    kind: 'primary',
    note: '"US client"(아케고스) 관련 손실 ¥245.7bn(≈$2.3bn)을 2021년 3월 분기에 인식, 익기 추가분 포함 총 ¥313bn(≈$2.9bn); 포지션·헤지는 2021-05-17까지 청산',
  },
  {
    id: 'ms-q1-2021',
    title: 'Morgan Stanley — First Quarter 2021 Earnings Results',
    publisher: 'Morgan Stanley',
    date: '2021-04-16',
    url: 'https://www.morganstanley.com/about-us-ir/quarterly-results',
    kind: 'primary',
    note: '1Q21에 아케고스 관련 $911m 손실 계상($644m 신용사건 + $267m 이후 거래손실). Paul Weiss 보고서도 "모건스탠리 약 $10억"으로 교차 확인한다. URL은 IR 분기실적 색인(해당 분기 PDF 직링크 미확인)',
  },
  {
    id: 'ubs-q1-2021',
    title: 'UBS Group AG — First Quarter 2021 Report',
    publisher: 'UBS Group AG / U.S. SEC EDGAR (Form 6-K)',
    date: '2021-04-27',
    url: 'https://www.sec.gov/Archives/edgar/data/1610520/000161052021000050/EDGARq21ubsgroupag.htm',
    kind: 'primary',
    note: '"미국 소재 프라임브로커리지 고객의 디폴트"로 **USD** 774m 손실(세후 순이익 영향 USD 434m). 잔여 익스포저는 2021년 4월에 정리되어 2Q 손실은 그룹 기준 비중대. 널리 인용되는 $861m는 774 + 2Q 잔여 추정 약 87(CEO 구두 설명)이며 **CHF 환산이 아니다**. 보고서 원문은 "Archegos"라는 이름을 쓰지 않는다',
  },
  {
    id: 'viacomcbs-offering-2021-03',
    title: 'ViacomCBS Inc. — Form 424B5 최종 투자설명서 보충서(Class B 보통주 2,000만주)',
    publisher: 'ViacomCBS Inc. / U.S. SEC EDGAR',
    date: '2021-03-23',
    url: 'https://www.sec.gov/Archives/edgar/data/813828/000119312521094654/d162565d424b5.htm',
    kind: 'primary',
    note: '3/22 장 마감 후 발표, 3/23 가격 확정: Class B 2,000만주 @$85.00 + 5.75% 전환우선주 1,000만주 @$100 = 약 $30억. **문서에 "2021년 3월 23일 Class B 마지막 체결가 $91.25"가 기재되어 있어 3/23 종가의 1차 출처가 된다.** 3/22 종가 $100.34는 사상 최고 종가이며 발행 직후 급락이 마진콜의 방아쇠가 되었다',
  },

  // ───────────────────────── 감독당국 조치 ─────────────────────────
  {
    id: 'fed-enforcement-archegos-2023',
    title:
      'Federal Reserve Board fines UBS Group AG $268.5 million for misconduct by Credit Suisse in its dealings with Archegos (Enforcement press release)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2023-07-24',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/enforcement20230724a.htm',
    kind: 'regulatory',
    note: '$268.5m 벌금 + 동의명령. "반복된 경고에도 아케고스 리스크를 관리하지 못한" 불안전·불건전 카운터파티 신용리스크 관리; CS 손실 ≈$5.5bn 명시; 미국 영업의 리스크관리 시정 의무',
  },
  {
    id: 'pra-cs-archegos-2023',
    title:
      'The PRA imposes record fine of £87m on Credit Suisse for serious risk management and governance failures in connection with Archegos Capital Management exposure',
    publisher: 'Bank of England (Prudential Regulation Authority)',
    date: '2023-07-24',
    url: 'https://www.bankofengland.co.uk/news/2023/july/the-pra-imposes-record-fine-of-87m-on-credit-suisse',
    kind: 'regulatory',
    note: '£87,082,000(조기합의 30% 감액 전 £124.4m). 대상 기간 2020-01-01~2021-03-31, Fundamental Rule 4건 동시 위반. 영국 법인 손실 US$5.1bn. Fed와 합산 제재 $387.5m 초과',
  },
  {
    id: 'finma-archegos-2023',
    title: 'FINMA concludes "Archegos" proceedings against Credit Suisse (보도자료)',
    publisher: 'Swiss Financial Market Supervisory Authority (FINMA)',
    date: '2023-07-24',
    url: 'https://www.finma.ch/en/news/2023/07/20230724-mm-archegos/',
    kind: 'regulatory',
    note: '금융시장법 "중대·체계적 위반" 5개 항목: (1) 2021.3 포지션 USD 24bn — 차순위 헤지펀드 고객의 4배이자 그룹 자기자본의 절반 초과, (2) 경영진 미보고, (3) 한도 초과 시 추가 요구 대신 한도 반복 상향, (4) 담보 집중으로 비상시 기능 불가, (5) 붕괴 2주 전 USD 2.4bn 지급 시 대안 미검토. UBS에 자체 포지션 제한·리스크 연동 보수 기준 명령',
  },
  {
    id: 'pra-fca-equity-finance-2021',
    title:
      'Joint letter to banks operating in the UK: Supervisory review of global equity finance businesses following the default of Archegos Capital Management (Dear CEO letter)',
    publisher: 'Bank of England (PRA) · Financial Conduct Authority',
    date: '2021-12-10',
    url: 'https://www.bankofengland.co.uk/prudential-regulation/publication/2021/december/supervisory-review-global-equity-finance-businesses',
    kind: 'regulatory',
    note: '아케고스 디폴트로 업계 $10bn 초과 손실. 지적: 사업부 간 리스크 통합관리 미흡, 온보딩 이후 재평가 부재, 비효과적·비일관적 마진 방식, 종합적 리스크관리 부재',
  },
  {
    id: 'sec-pr-2022-70',
    title:
      'SEC Charges Archegos and its Founder with Massive Market Manipulation Scheme (Press Release 2022-70)',
    publisher: 'U.S. Securities and Exchange Commission',
    date: '2022-04-27',
    url: 'https://www.sec.gov/news/press-release/2022-70',
    kind: 'regulatory',
    note: '2020.3 포트폴리오 $1.5bn·익스포저 $10bn → 2021.3 정점 $36bn·익스포저 $160bn. TRS로 포지션을 쌓으면서 카운터파티에 익스포저·집중도·유동성을 오도해 추가 한도를 얻었다는 혐의. SDNY 형사기소·CFTC 민사소송 병행',
  },
  {
    id: 'sec-v-hwang-complaint-2022',
    title:
      'SEC v. Sung Kook (Bill) Hwang, Patrick Halligan, William Tomita and Scott Becker — Complaint (No. 1:22-cv-03402, S.D.N.Y.)',
    publisher: 'U.S. Securities and Exchange Commission',
    date: '2022-04-27',
    url: 'https://www.sec.gov/files/litigation/complaints/2022/comp-pr2022-70.pdf',
    kind: 'primary',
    pages: '¶¶148~165 (붕괴 주간)',
    note:
      '보도자료(sec-pr-2022-70)의 근거 소장. 주간 경로를 날짜로 적는다 — 3/22 장 마감 후 ViacomCBS $30억 공모 발표가 ' +
      '"다음 거래일 약 10% 하락"을 촉발(¶148); 3/23 자본 $36.2bn → $32.7bn(¶150); 3/24 공모가 $85는 ' +
      '"$100.34 closing price the day prior"에 크게 못 미쳤고 그날 자본은 $16.9bn(−48%)로 하락(¶152·¶159); ' +
      '3/25 종료 시점 자본 $9.2bn(−46%)(¶162); **3/25 장 마감 후 카운터파티 1곳(CP6)과 할인된 블록 거래를 체결(¶163)** — ' +
      '금액은 적지 않는다. 개별 종목의 일별 종가는 $100.34 외에는 실려 있지 않다',
  },
  {
    id: 'mushd-pr-2021-03-31',
    title:
      'Mitsubishi UFJ Securities Holdings — "Progress report: Potential Loss Arising from Business Activities" (2021-03-31) 및 선행 공시(2021-03-30)',
    publisher: 'Mitsubishi UFJ Securities Holdings Co., Ltd.',
    date: '2021-03-31',
    url: 'https://www.hd.sc.mufg.jp/english/news/000019905.pdf',
    kind: 'primary',
    note:
      '3/30 공시(https://www.hd.sc.mufg.jp/english/news/000019897.pdf): "on March 26, 2021, an event occurred in ' +
      'MUFG Securities EMEA plc (MUSE) … in relation to a US client"; 추정 손실 "approximately USD 300 million". ' +
      '3/31 공시: 포지션 정리 완료, "our final potential loss will be approximately **USD 270million**", ' +
      '손실은 MUSHD의 2022-03기 1분기 연결에 반영. 두 공시 모두 "Archegos"라는 이름을 쓰지 않는다',
  },
  {
    id: 'bcbs-ccr-guidelines-2024',
    title: 'Guidelines for counterparty credit risk management (BCBS d588)',
    publisher: 'Basel Committee on Banking Supervision (BIS)',
    date: '2024-12-11',
    url: 'https://www.bis.org/bcbs/publ/d588.pdf',
    kind: 'regulatory',
    note: 'CCR 관리 기준 4축: 실사, 신용리스크 완화(마진), PFE·스트레스테스트 기반 리스크 측정, 거버넌스. 1999년 "고레버리지 기관과의 거래 건전관행"을 대체한다. **문서 본문은 아케고스를 명시하지 않으며** BIS 보도자료는 "최근 비은행 금융중개(NBFI) 부실 사례의 교훈"이라고만 밝힌다 — 아케고스를 직접 언급한 BCBS 문건은 뉴스레터 bcbs-nbfi-newsletter-2022다. 협의안은 d574(2024-04-30)',
  },
  {
    id: 'bcbs-nbfi-newsletter-2022',
    title: 'Newsletter on bank exposures to non-bank financial intermediaries',
    publisher: 'Basel Committee on Banking Supervision (BIS)',
    date: '2022-11-24',
    url: 'https://www.bis.org/publ/bcbs_nl31.htm',
    kind: 'regulatory',
    note: '아케고스를 이름으로 언급한 BCBS 문건: "아케고스 캐피털 매니지먼트의 붕괴는 일부 은행의 리스크관리 관행상 결함을 드러냈다." 실사·마진 등 CCR 관행의 미흡을 지적하며 d588의 예고편에 해당한다',
  },
  {
    id: 'fsb-nbfi-leverage-2025',
    title: 'Leverage in Nonbank Financial Intermediation — Final report',
    publisher: 'Financial Stability Board (FSB)',
    date: '2025-07-09',
    url: 'https://www.fsb.org/uploads/P090725-1.pdf',
    kind: 'regulatory',
    note: '아케고스를 TRS를 통한 숨은 레버리지·카운터파티 신용리스크 오가격의 사례로 다룬다(딜러 손실 ≈$10bn, CS $5.5bn, 노무라 $2.9bn). 9개 정책 권고',
  },
  {
    id: 'senate-banking-archegos-2021',
    title:
      'Brown Presses Banks for Answers on Risky Trades and Recent Market Turmoil (아케고스 관련 서한)',
    publisher: 'U.S. Senate Committee on Banking, Housing, and Urban Affairs (Majority)',
    date: '2021-04-07',
    url: 'https://www.banking.senate.gov/newsroom/majority/brown-presses-banks-for-answers-on-risky-trades-and-recent-market-turmoil',
    kind: 'regulatory',
    note: '서한 일자 2021-04-07, 보도자료 게시 2021-04-08. 수신 4곳: 골드만삭스·모건스탠리·노무라·크레디트스위스(CS는 법무총괄 앞). 10개 동일 질문, 회신 기한 2021-04-22. 하원에는 아케고스 전용 청문회·보고서가 없고, 하원 금융서비스위 다수당 실무 메모(2021-07-23)가 13F·패밀리오피스 규제 항목에서 다룬 것이 전부다. banking.senate.gov는 자동 조회를 차단하므로 원문 확인에는 미러본이 필요하다',
  },
  {
    id: 'cgfs-36',
    title: 'The role of margin requirements and haircuts in procyclicality (CGFS Papers No 36)',
    publisher: 'Committee on the Global Financial System (BIS)',
    date: '2010-03',
    url: 'https://www.bis.org/publ/cgfs36.htm',
    kind: 'regulatory',
    note: '시장 관행 헤어컷 참고값: IG 회사채 5~10%, 주식 15~25%; 마진·헤어컷의 경기순응성과 동시 청산의 가격 충격',
  },
  {
    id: 'pwg-hedge-funds-1999',
    title: 'Hedge Funds, Leverage, and the Lessons of Long-Term Capital Management',
    publisher: "President's Working Group on Financial Markets",
    date: '1999-04-28',
    url: 'https://home.treasury.gov/system/files/236/hedgfund.pdf',
    kind: 'regulatory',
    note: 'LTCM: 카운터파티가 각자 본 익스포저만으로는 총레버리지를 알 수 없었다는 구조적 결론 — 아케고스와 같은 실패의 선례',
  },

  // ───────────────────────── 데이터 ─────────────────────────
  {
    id: 'fred-vixcls',
    title: 'CBOE Volatility Index: VIX (VIXCLS) — daily close',
    publisher: 'Federal Reserve Bank of St. Louis (FRED) / Cboe',
    date: '2021-03',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS',
    kind: 'data',
    note: '2021 종가: 3/22 18.88 · 3/23 20.30 · 3/24 21.20 · 3/25 19.81 · 3/26 18.86 · 3/29 20.74 — 아케고스 청산이 지수 변동성 사건이 아니었음을 보여주는 교차 확인값',
  },
  {
    id: 'fred-dgs10',
    title: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity (DGS10)',
    publisher: 'Federal Reserve Bank of St. Louis (FRED) / Federal Reserve H.15',
    date: '2021-03',
    url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10',
    kind: 'data',
    note: '2021년 3월 말 10년물 ≈1.6~1.75% — 시장 배경(리플레이션 트레이드) 표시용',
  },
  {
    id: 'sec-midas-2021q1',
    title:
      'Metrics by Individual Security — 2021 Q1 (MIDAS 시장구조 데이터, individual_security_2021_q1.zip)',
    publisher: 'U.S. Securities and Exchange Commission (Division of Economic and Risk Analysis)',
    date: '2021',
    url: 'https://www.sec.gov/files/opa/data/market-structure/metrics-individual-security/individual_security_2021_q1.zip',
    kind: 'data',
    note:
      '종목·일자별 체결건수·체결주식수(주문형 거래소 합계, 장외 TRF 미포함)를 담은 SEC 공개 데이터셋. ' +
      '본 점검에서 직접 내려받아 확인한 값 — VIAC의 2021-03-22까지 20영업일 평균 8.48백만주(2월 평균 5.38), ' +
      'DISCA 4.71백만주(2월 3.56); 3/26 청산 당일 VIAC 98.98백만주 · DISCA 57.53백만주로 급증. ' +
      '3/22의 VIAC 거래량은 5.79백만주로 직전 2주 중 최저였고 3/23에 17.74백만주로 뛰었다 — ' +
      '**공모 발표 충격이 3/23에 반영되었다는 424B5·SEC 소장의 서술과 정합한다.** ' +
      '수록 종목은 6,371개이며 **외국 발행인 ADR(BIDU·TME·VIPS·GSX)은 수록되지 않는다**',
  },

  // ───────────────────────── 언론(타임스탬프·인용 전용) ─────────────────────────
  {
    id: 'press-ms-overnight-2021-04-06',
    title:
      "Morgan Stanley dumped $5 billion in Archegos' stocks the night before massive fire sale",
    publisher: 'CNBC',
    date: '2021-04-06',
    url: 'https://www.cnbc.com/2021/04/06/morgan-stanley-dumped-5-billion-in-archegos-stocks-before-fire-sale.html',
    kind: 'press',
    note: '타임스탬프·정황 전용: 3/25 밤 ~$5bn 선매도, 3/26 오전·오후 각 ~$4bn 추가, ViacomCBS 4,500만주는 일요일에 처리',
  },
  {
    id: 'press-standstill-2021-03-30',
    title: 'Archegos saga: hope for an orderly fix turned into a bruising free-for-all',
    publisher: 'Fortune / Bloomberg',
    date: '2021-03-30',
    url: 'https://fortune.com/2021/03/30/archegos-saga-hope-an-orderly-fix-turned-bruising-free-for-all-wall-street/',
    kind: 'press',
    note: '타임스탬프·정황 전용: 3/25 저녁 프라임브로커 공동 통화, 자기자본 $9~10bn·총익스포저 $120bn(롱 $70bn/숏 $50bn) 자진 고지, 스탠드스틸 제안 결렬, 같은 밤 디폴트 통지 발송',
  },
  {
    id: 'press-block-trades-2021-03-29',
    title: 'Large block trades tied to Archegos raise worries about trading this week',
    publisher: 'Reuters',
    date: '2021-03-29',
    url: 'https://finance.yahoo.com/news/1-large-block-trades-tied-030625938.html',
    kind: 'press',
    note: '타임스탬프·정황 전용: 3/26 골드만삭스 ~$10.5bn 블록, 모건스탠리 ~$8bn; ViacomCBS·Discovery 각 약 −27%, 주간 합계 $20bn 초과',
  },
  {
    id: 'press-cs-pb-exit-2021-11-04',
    title: 'Credit Suisse to exit prime brokerage following Archegos losses',
    publisher: 'The TRADE / Bloomberg',
    date: '2021-11-04',
    url: 'https://www.thetradenews.com/credit-suisse-to-exit-prime-brokerage-following-archegos-capital-losses/',
    kind: 'press',
    note: '타임스탬프 전용: 2021-11-04 전략 발표에서 프라임서비스 대부분 철수 결정',
  },
]
