import type { Source } from '../../engine/types'

/**
 * lehman-2008 서지. 옵션·교훈·퀴즈·사실 원장이 id로 참조한다.
 * 공유 서지(src/content/sources.ts)에 있는 fcic-report-2011 / bcbs-144 / cgfs-36 은 시나리오 단독 린트
 * (validateScenario(scenario) — 공유 id 미주입)에서도 해석되도록 동일 id·내용으로 여기에도 둔다.
 * URL은 확인된 것만 기재한다(미확인은 비움).
 */
export const LEHMAN_SOURCES: Source[] = [
  // ───────────── 1차 (공시·연준·SEC) ─────────────
  {
    id: 'lehman-10q-2q08',
    title: 'Lehman Brothers Holdings Inc., Form 10-Q for the quarter ended May 31, 2008',
    publisher: 'SEC EDGAR',
    date: '2008-07-10',
    kind: 'primary',
    url: 'https://www.sec.gov/Archives/edgar/data/0000806085/000110465908045115/a08-18147_110q.htm',
    note: '2008-05-31 연결 재무상태표: 총자산 $639.4B, 총부채 $613.2B, 주주지분 $26.3B, 레포 $127.8B, 증권대여 $55.4B, 단기차입 $35.3B, 장기차입 $128.2B, 고객 지급채무 $57.3B; 트라이파티 레포 $188B',
  },
  {
    id: 'lehman-8k-2008-09-10',
    title:
      'Lehman Brothers Holdings Inc., Form 8-K Ex. 99.1 — Preliminary Third Quarter 2008 Results and Strategic Initiatives',
    publisher: 'SEC EDGAR',
    date: '2008-09-10',
    kind: 'primary',
    url: 'https://www.sec.gov/Archives/edgar/data/806085/000110465908057829/a08-22764_2ex99d1.htm',
    note: '순손실 $3.9B(총 MTM $7.8B, 순 $5.6B), 유동성 풀 $42B(추정), CRE $39.8B→$32.6B, 주택 $17.2B→$13.2B(pro forma), 순레버리지 10.6x, Tier 1 ≈11.0%, 주주지분 $28.4B, REI Global $25~30B 스핀오프(2009 1분기), IMD 지분 ≈55% 매각, 배당 $0.05',
  },
  {
    id: 'lehman-8k-2008-09-29',
    title:
      'Lehman Brothers Holdings Inc., Form 8-K Ex. 99.1 — Sale of Neuberger Berman and Fixed Income Management to Bain Capital / Hellman & Friedman',
    publisher: 'SEC EDGAR',
    date: '2008-09-29',
    kind: 'primary',
    url: 'https://www.sec.gov/Archives/edgar/data/806085/000110465908061953/a08-22764_11ex99d1.htm',
    note: '파산 후 매각가 $2.15B — 파산 전 제안(칼라일 $7B[press])·중순 입찰(≈$5B[press]) 대비 매각 지연 비용의 앵커',
  },
  {
    id: 'fcic-report-2011',
    title: 'The Financial Crisis Inquiry Report',
    publisher: 'Financial Crisis Inquiry Commission (FCIC)',
    date: '2011-01',
    url: 'https://www.govinfo.gov/content/pkg/GPO-FCIC/pdf/GPO-FCIC.pdf',
    pages: 'ch.15 (Bear Stearns), ch.18 (Lehman)',
    kind: 'primary',
    note: '트라이파티 레포 일중 신용·청산은행 담보 요구, 레포 롤오버 거부, 헤지펀드 이탈이 증권사 실패 메커니즘; 리먼 주말(9/12~14) 협상·FSA·연준 입장',
  },
  {
    id: 'valukas-report-2010',
    title:
      'Report of Anton R. Valukas, Examiner — In re Lehman Brothers Holdings Inc. (Vol. 4: Liquidity, Clearing-bank Collateral)',
    publisher: 'U.S. Bankruptcy Court, S.D.N.Y. (Jenner & Block)',
    date: '2010-03-11',
    kind: 'primary',
    url: 'https://www.jenner.com/a/web/irKPixTgz8Ppv7n6waHtmE/4k1Wwu/VOLUME%204.pdf',
    pages: 'Vol. 4 §III.A.5(Secured Lenders) — 목차 (5)(b) p.1455(10-Q 비공시), 청산은행 담보 요구 요약절, 유동성 "ability to monetize" 절',
    note:
      '유동성 풀에 JPM 담보 ≈$5.5B·씨티 comfort deposit $2B 포함(비공시, p.1455 표제에 명시); ' +
      'JPM 담보 요구 9/9 $5B(9/9~10에 $3B 선이행) → 9/11 추가 현금 $5B(9/12 오후 이행); ' +
      '보고유동성 전주말 $42.1B(고현금화 $33.8B) → 9/10 $37.6B → 9/12 $32.5B 중 $30.1B가 저현금화, ' +
      '즉 **9/12 즉시 현금화 가능액 $2.4B**; 9/10 "약 $41B" 공표. ' +
      '**본 보고서 Vol. 1·2·4 본문에는 리먼 CDS 스프레드의 bp 수치가 없다**(전문 검색으로 확인). ' +
      '원문은 Stanford 미러(web.stanford.edu/~jbulow/Lehmandocs/)에서도 열린다',
  },
  {
    id: 'valukas-testimony-2011',
    title:
      'Statement of Anton R. Valukas, Examiner, before the Senate Committee on Banking, Housing, and Urban Affairs',
    publisher: 'U.S. Senate Banking Committee',
    date: '2011-04-06',
    kind: 'primary',
    url: 'https://www.banking.senate.gov/imo/media/doc/ValukasTestimony4611am.pdf',
    note: '유동성 풀 과대 공표, 청산은행 담보, 마크 논쟁 요약',
  },
  {
    id: 'fed-pr-2008-09-14',
    title:
      'Federal Reserve Board announces several initiatives to provide additional support to financial markets (PDCF·TSLF collateral expansion)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2008-09-14',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20080914a.htm',
    note: 'PDCF 적격 담보를 양대 청산은행 트라이파티 레포 담보 전체로 확대(종전 투자등급 채권), TSLF Schedule 2를 전 투자등급 채권으로 확대·주간 실시, TSLF 총 $200B; 9/14(일) 저녁 발표',
  },
  {
    id: 'fed-pr-2008-03-16',
    title: 'Federal Reserve Board announces establishment of the Primary Dealer Credit Facility',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2008-03-16',
    kind: 'regulatory',
    url: 'https://federalreserve.gov/newsevents/press/monetary/20080316a.htm',
    note: 'PDCF: 프라이머리 딜러(브로커딜러)에 익일물 담보 대출, 담보 = FRBNY 트라이파티 적격 + 투자등급 회사채·지방채·MBS·ABS. 지주회사는 적격 차입자가 아님',
  },
  {
    id: 'fed-pr-2008-03-11',
    title: 'Federal Reserve announces Term Securities Lending Facility (TSLF)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2008-03-11',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20080311a.htm',
    note: '국채 최대 $200B를 28일간 프라이머리 딜러에 대여(담보: 기관채·기관 MBS·AAA 민간 RMBS)',
  },
  {
    id: 'fed-pr-2008-09-16-aig',
    title: 'Federal Reserve Board authorizes FRBNY to lend up to $85 billion to AIG',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2008-09-16',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/other20080916a.htm',
    note: '13(3)조, 24개월, 3M LIBOR+850bp, 지분 79.9%',
  },
  {
    id: 'fed-pr-2008-09-19-amlf',
    title:
      'Federal Reserve Board announces two enhancements to its programs to provide liquidity to markets (AMLF)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '2008-09-19',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20080919a.htm',
    note: '예금기관·BHC가 MMF에서 고품질 ABCP를 매입하도록 1차 신용금리 비소구 대출',
  },
  {
    id: 'treasury-hp1147',
    title: 'Treasury Announces Guaranty Program for Money Market Funds',
    publisher: 'U.S. Department of the Treasury',
    date: '2008-09-19',
    kind: 'regulatory',
    url: 'https://home.treasury.gov/news/press-releases/hp1147',
    note: '공모 MMF(소매·기관) 1년 보증, ESF 최대 $50B',
  },
  {
    id: 'sec-cox-basel-2008-03-20',
    title:
      'Chairman Cox Letter to Basel Committee in Support of New Guidance on Liquidity Management (SEC Press Release 2008-48)',
    publisher: 'U.S. Securities and Exchange Commission',
    date: '2008-03-20',
    kind: 'regulatory',
    url: 'https://www.sec.gov/news/press/2008/2008-48.htm',
    note: '베어스턴스 지주 유동성 풀: 3/10 $18.1B → 3/11 $11.5B → 3/12 $12.4B → 3/13 급감(≈$2B[2차]); 자본비율은 내내 10% 이상 — 유동성 위기가 자본 위기가 아님',
  },
  {
    id: 'bernanke-fcic-2010-04-20',
    title:
      'Lessons from the failure of Lehman Brothers (Testimony before the House Financial Services Committee)',
    publisher: 'Board of Governors of the Federal Reserve System (Ben S. Bernanke)',
    date: '2010-04-20',
    kind: 'regulatory',
    url: 'https://www.federalreserve.gov/newsevents/testimony/bernanke20100420a.htm',
    note: '연준의 리먼 지주 대출 불가 입장(담보 부족·13(3) 요건), 보증 권한 부재, 정리 권한 필요성',
  },
  {
    id: 'fdic-quarterly-2011-lehman',
    title:
      'The Orderly Liquidation of Lehman Brothers Holdings Inc. under the Dodd-Frank Act (FDIC Quarterly Vol.5 No.2)',
    publisher: 'Federal Deposit Insurance Corporation (FDIC)',
    date: '2011-05-24',
    kind: 'regulatory',
    url: 'https://www.fdic.gov/analysis/2011-01/orderly-liquidation-lehman-brothers-holdings-inc-under-dodd-frank-act',
    note: 'Title II OLA 하 사전 조율된 정리라면 시스템 안정·채권자 회수 모두 우월; 파산 관리 수수료 2011.2까지 >$1.2B',
  },
  {
    id: 'fed-history-support-institutions',
    title: 'Support for Specific Institutions (Federal Reserve History essay, John Weinberg)',
    publisher: 'Federal Reserve History (Federal Reserve Bank of Richmond)',
    date: '2013-11',
    kind: 'regulatory',
    url: 'https://www.federalreservehistory.org/essays/support-for-specific-institutions',
    note: '베어 FRBNY $12.9B(담보 $13.8B), Maiden Lane $30B/$29B; 리먼 민간 해법 실패 후 9/15 파산, 브로커딜러(LBI) 9/15 PDCF $28B 차입; AIG 9/16 79.9%',
  },
  {
    id: 'fed-history-credit-programs',
    title: 'Federal Reserve Credit Programs During the Meltdown (Federal Reserve History essay)',
    publisher: 'Federal Reserve History',
    date: '2013-11',
    kind: 'regulatory',
    url: 'https://www.federalreservehistory.org/essays/fed-credit-programs',
    note: 'TSLF·PDCF·AMLF·CPFF 등 위기 창구의 설계와 순서',
  },
  {
    id: 'bcbs-144',
    title: 'Principles for Sound Liquidity Risk Management and Supervision',
    publisher: 'Basel Committee on Banking Supervision (BCBS)',
    date: '2008-09',
    kind: 'regulatory',
    url: 'https://www.bis.org/publ/bcbs144.pdf',
    pages: 'Principle 11, ¶110~117 (CFP)',
    note: '비상자금조달계획: 조치 목록·리드타임, 담보 사전 준비, 중앙은행 창구 요건 반영, 커뮤니케이션 계획',
  },
  {
    id: 'cgfs-36',
    title: 'The role of margin requirements and haircuts in procyclicality (CGFS Papers No 36)',
    publisher: 'Committee on the Global Financial System (BIS)',
    date: '2010-03',
    kind: 'regulatory',
    url: 'https://www.bis.org/publ/cgfs36.pdf',
    note: '헤어컷 상승의 자기강화적 조달 축소(헤어컷 스파이럴)',
  },
  {
    id: 'hc-treasury-run-on-the-rock-2008',
    title: 'The run on the Rock (Fifth Report of Session 2007–08, HC 56-I)',
    publisher: 'House of Commons Treasury Committee',
    date: '2008-01-26',
    kind: 'regulatory',
    note: '2007.9.14 BoE 지원 발표 후 소매 인출(며칠 내 £4.6B[도시에]) → 9/17 정부 보증으로만 종료: 보증 없는 LOLR 발표는 런을 촉발. URL 미확인',
  },
  // ───────────── 시장 데이터(일별 시계열) ─────────────
  {
    id: 'frb-h15-treasury-2008',
    title:
      'Market Yield on U.S. Treasury Securities at 2-, 10- and 30-Year Constant Maturity (DGS2 · DGS10 · DGS30)',
    publisher:
      'Board of Governors of the Federal Reserve System (H.15), via FRED — Federal Reserve Bank of St. Louis',
    date: '2008-09-09',
    kind: 'data',
    url: 'https://fred.stlouisfed.org/series/DGS10',
    note: '2008-09-09 종가: 2년 2.23% · 10년 3.62% · 30년 4.20%. (참고: 9/12 2.23/3.74/4.32, 9/15 1.78/3.47/4.12)',
  },
  {
    id: 'fred-tedrate-2008',
    title: 'TED Spread (TEDRATE, 3-Month LIBOR minus 3-Month Treasury Bill) — 연속 중단된 계열',
    publisher: 'FRED — Federal Reserve Bank of St. Louis',
    date: '2008-09-09',
    kind: 'data',
    url: 'https://fred.stlouisfed.org/series/TEDRATE',
    note: '2008-09-09 1.19%(119bp). 리먼 주간 추이: 9/8 1.13 → 9/11 1.24 → 9/12 1.36 → 9/15 1.79 → 9/16 2.04',
  },
  {
    id: 'cboe-vix-2008',
    title: 'CBOE Volatility Index: VIX (VIXCLS) 일별 종가',
    publisher: 'Cboe Global Markets, via FRED — Federal Reserve Bank of St. Louis',
    date: '2008-09-09',
    kind: 'data',
    url: 'https://fred.stlouisfed.org/series/VIXCLS',
    note:
      '2008-09-09 종가 25.47. 9/8 22.64 → 9/10 24.52 → 9/11 24.39 → 9/12 25.66 → 9/15 31.70. ' +
      'TED 궤적의 교차 확인용(파산 직전 주의 스트레스는 주식 변동성보다 자금시장에 먼저 나타났다)',
  },
  {
    id: 'bis-qr-2008-12',
    title:
      'BIS Quarterly Review, December 2008 — Box "Three market implications of the Lehman bankruptcy" (Fender · Frankel · Gyntelberg)',
    publisher: 'Bank for International Settlements',
    date: '2008-12',
    kind: 'academic',
    url: 'https://www.bis.org/publ/qtrpdf/r_qt0812x.htm',
    note:
      '확정 인용: 리먼 CDS 경매 회수율 **8.625%**(14개 딜러 호가, ISDA 2008 Lehman CDS Protocol), ' +
      '참조 명목 약 **$72B**에 대해 10/21 실제 순결제 **$5.2B**(사전 추정 $6B). 총액과 순액의 격차가 ' +
      '이 사건의 핵심 교훈 중 하나다. ' +
      'CDS 스프레드 수준은 이 박스에 bp 수치로 실려 있지 않다 — 같은 호에서 인용되는 9월 초 327 → 360/370bp는 ' +
      'KDB 협상 결렬 이전의 관측이므로 시나리오의 9/9 **종가** 앵커와 같은 시점이 아니다. 두 값은 ' +
      '모순이 아니라 다른 날짜일 가능성이 높지만, 9/9 475bp는 여전히 미확정이다 [VERIFY]. ' +
      '해소 문서는 FCIC 자료실의 위원회 수집 Markit CDS 계열 또는 Markit/IHS 라이선스 데이터다 — ' +
      'Valukas 보고서 Vol. 1·2·4 본문에는 bp 수치가 없음을 확인했다',
  },

  // ───────────── 학술 ─────────────
  {
    id: 'nyfed-sr506',
    title:
      'Repo Runs: Evidence from the Tri-Party Repo Market (Staff Report 506) — Copeland, Martin, Walker',
    publisher: 'Federal Reserve Bank of New York',
    date: '2011-07',
    kind: 'academic',
    url: 'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr506.pdf',
    note: '2008.9 리먼 트라이파티 레포 조달 급감; 헤어컷보다 조달 규모 자체가 줄어드는 "런" 형태',
  },
  {
    id: 'nyfed-epr-triparty-2012',
    title:
      'Key Mechanics of the U.S. Tri-Party Repo Market (Economic Policy Review 18(3)) — Copeland, Duffie, Martin, McLaughlin',
    publisher: 'Federal Reserve Bank of New York',
    date: '2012-11',
    kind: 'academic',
    url: 'https://www.newyorkfed.org/medialibrary/media/research/epr/12v18n3/1210cope.pdf',
    note: '청산은행의 일중 언와인드(morning unwind)와 일중 신용, 청산은행이 언와인드를 거부하면 딜러는 당일 결제 불능',
  },
  {
    id: 'ball-nber-w22410',
    title:
      'The Fed and Lehman Brothers: Introduction and Summary (NBER Working Paper 22410) — Laurence Ball',
    publisher: 'National Bureau of Economic Research',
    date: '2016-07',
    kind: 'academic',
    url: 'https://www.nber.org/system/files/working_papers/w22410/w22410.pdf',
    note: '리먼은 PDCF 적격 담보 ≥$131B 보유, PDCF $88B 차입 가능했다는 반론; 지주(LBHI)는 PDCF 부적격, "금요일 기준" 담보 제한',
  },
  // ───────────── 언론(타임스탬프·인용 전용) ─────────────
  {
    id: 'press-kdb-2008-09-09',
    title:
      'KDB says talks with Lehman have ended; Lehman shares fall 45% (Reuters/Bloomberg, 2008-09-09)',
    publisher: 'Reuters · Bloomberg (타임스탬프·인용 전용)',
    date: '2008-09-09',
    kind: 'press',
    note: '9/9(화) 산업은행 협상 결렬 보도, 주가 −45%; 수치 근거로 사용하지 않음',
  },
  {
    id: 'press-nb-carlyle-2008-09',
    title:
      'Carlyle offered about $7 billion for Lehman investment-management unit before bankruptcy; mid-September bids ≈$5 billion (press, 2008-09)',
    publisher: 'Reuters · WSJ (타임스탬프·인용 전용)',
    date: '2008-09-14',
    kind: 'press',
    note:
      '뉴버거버먼/IMD 매각가 앵커 $7B(파산 전 제안)·$5B(중순 입찰) [VERIFY]; 최종 $2.15B는 8-K 9/29(1차). ' +
      '파산 전 입찰가를 수치로 적은 1차 문서는 아직 없다 — Valukas 보고서 Vol. 2 §III.A.2(Survival)에 칼라일 제안 금액이 ' +
      '없음을 본문 검색으로 확인했다. 해소 문서: LBHI 파산사건(Bankr. S.D.N.Y. No. 08-13555)의 IMD 매각 승인 신청서와 증거자료',
  },
]
