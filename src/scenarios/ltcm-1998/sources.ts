import type { Source } from '../../engine/types'

/**
 * ltcm-1998 서지. 옵션·교훈·퀴즈·사실 원장이 id로 참조한다.
 *
 * 공유 서지(`src/content/sources.ts`)에 이미 있는 `pwg-hedge-funds-1999` / `fed-history-ltcm` 는
 * 시나리오 단독 린트(`validateScenario(scenario)` — 공유 id 미주입)에서도 해석되도록 **동일 id로**
 * 여기에도 둔다(lehman-2008 이 fcic-report-2011 등에 쓴 것과 같은 관행). 내용·URL은 공유본과 같다.
 *
 * URL은 실제로 열어 확인한 것만 기재한다. 원문 확인이 끝나지 않은 항목은 URL을 비우고 note 에
 * "무엇을 보면 확정되는지"를 적는다.
 */
export const LTCM_SOURCES: Source[] = [
  // ───────────── 1차: 공식 사후평가·의회 증언 ─────────────
  {
    id: 'pwg-hedge-funds-1999',
    title: 'Hedge Funds, Leverage, and the Lessons of Long-Term Capital Management',
    publisher: "President's Working Group on Financial Markets",
    date: '1999-04-28',
    url: 'https://home.treasury.gov/system/files/236/hedgfund.pdf',
    kind: 'regulatory',
    note:
      '확정 인용: "At the end of 1997, LTCM returned approximately $2.7 billion in capital to its investors, reducing the capital base of the fund by about 36 percent to $4.8 billion." · ' +
      '"During the single month of August, the LTCM Fund suffered additional losses of $1.8 billion, bringing the loss of equity for the year to over fifty percent." · ' +
      '"The Fund\'s capital base was now $2.3 billion." · "With regard to leverage, the LTCM Fund\'s balance sheet on August 31, 1998, included over $125 billion in assets." · ' +
      '"At the end of August, 1998, the gross notional amounts of the Fund\'s contracts on futures exchanges exceeded $500 billion, swaps contracts more than $750 billion, and options and other OTC derivatives over $150 billion." · ' +
      '"LTCM itself estimated that its top 17 counterparties would have suffered various substantial losses - potentially between $3 billion and $5 billion in aggregate." · ' +
      '"The firms in the consortium saw that their losses could be serious, with potential losses to some firms amounting to $300 million to $500 million each." · ' +
      '"By September 21, the LTCM Fund\'s liquidity situation was bleak. Bear Stearns, LTCM\'s prime brokerage firm, had required LTCM to collateralize potential settlement exposures." · ' +
      '"Despite its losses, LTCM was able to meet every margin and collateral call on a timely basis." · ' +
      '"Competitive pressures, however generally led to banks\' reducing, or eliminating such haircuts, and thus sometimes banks have provided 100% financing."',
  },
  {
    id: 'frbny-mcdonough-1998-10-01',
    title:
      'Statement by William J. McDonough, President, Federal Reserve Bank of New York, before the Committee on Banking and Financial Services, U.S. House of Representatives',
    publisher: 'Federal Reserve Bank of New York',
    date: '1998-10-01',
    url: 'https://www.newyorkfed.org/newsevents/speeches/1998/mcd981001',
    kind: 'primary',
    note:
      '9/18~9/23 시각별 1차 기록. 확정 인용: "On September 2, the partners of Long-Term Capital sent their investors a letter acknowledging 52 percent losses on the year through August 31." · ' +
      '"A team from the New York Fed, led by Peter Fisher ... and joined by Treasury Assistant Secretary Gary Gensler, met with the Long-Term Capital partners at their offices on Sunday, September 20." · ' +
      '"the size of these positions was much greater than market participants imagined" · ' +
      '"if many firms had rushed to close-out hundreds of billions of dollars in transactions simultaneously ... Markets would have moved sharply and losses would have been exaggerated." · ' +
      '"more than 75 counterparties" · 코어그룹 3사(GS·ML·JPM) 9/22 조찬 회합, UBS 추가 → 4사 · 19:00 텀시트 · 20:30 13개사 회합 · ' +
      '9/23 10:00 예정 회의, 외부 투자자 제안 회신 시한 12:30, 10:50 정회, 13:00 속개, 이후 5시간 논의 끝에 ' +
      '"14 banks and securities firms agreed to participate in the recapitalization, with three firms contributing smaller amounts than the other eleven. Two firms declined to participate." · ' +
      '"Not one penny of public money was spent or committed."',
  },
  {
    id: 'greenspan-testimony-1998-10-01',
    title:
      'Private-sector refinancing of the large hedge fund, Long-Term Capital Management (Testimony of Chairman Alan Greenspan)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '1998-10-01',
    url: 'https://www.federalreserve.gov/boarddocs/testimony/1998/19981001.htm',
    kind: 'regulatory',
    note:
      '확정 인용: "creditors as a whole most likely underestimated the size and scope of the market bets that LTCM was undertaking" · ' +
      '"the creditors of LTCM were induced to infuse capital into the firm because they failed to stress test their counterparty exposures adequately" · ' +
      '"no Federal Reserve funds were put at risk, no promises were made by the Federal Reserve, and no individual firms were pressured to participate." ' +
      '출자 총액은 "about $3-1/2 billion", 지분 희석 후 원소유자 몫 "one tenth"로 적었다(GAO·Fed History의 $3.625B/$3.6B와 반올림 차이).',
  },
  {
    id: 'gao-ggd-00-67r',
    title:
      'Long-Term Capital Management: Regulators Need to Focus Greater Attention on Systemic Risk (GAO/GGD-00-67R, B-284348)',
    publisher: 'U.S. General Accounting Office',
    date: '2000-02-23',
    url: 'https://www.gao.gov/assets/ggd-00-67r.pdf',
    kind: 'regulatory',
    note:
      '확정 인용: "On September 28, 1998, the[y] contributed about $3.6 billion, representing 90 percent of the net asset value of the fund on that date." · ' +
      '컨소시엄 14개사 명단(Chase Manhattan; Goldman Sachs; Merrill Lynch; J.P. Morgan; Morgan Stanley Dean Witter; Salomon Smith Barney(Travelers); Credit Suisse First Boston; Barclays; Deutsche Bank; UBS; Bankers Trust; Société Générale; Paribas; Lehman Brothers) · ' +
      '"Although Bear Stearns and Credit Agricole were included in these discussions, they declined to participate in the Consortium." · ' +
      'LTCM은 "over 100 equity investors", "over 75 creditors and counterparties" · 9/18 LTCM이 FRBNY에 먼저 접촉.',
  },
  {
    id: 'fed-history-ltcm',
    title: 'Near Failure of Long-Term Capital Management',
    publisher: 'Federal Reserve History (Federal Reserve Bank of Richmond)',
    date: '2013-11',
    url: 'https://www.federalreservehistory.org/essays/ltcm-near-failure',
    kind: 'regulatory',
    note:
      '1998.9.23 FRBNY 소집, 14개사 $3.625B 출자(지분 90%), 연준 자금 미투입. 확정 인용: ' +
      '"Together, fourteen firms put up $3.625 billion in capital in exchange for 90 percent of the fund\'s ownership" · ' +
      '"LTCM generated above-normal returns of 20 percent in 1994, 43 percent in 1995, 41 percent in 1996, and 17 percent in 1997" · ' +
      '"The fund lost 44 percent of its value in August alone" · 외부 투자자 제안의 12:30 시한.',
  },
  {
    id: 'fed-pr-1998-10-15',
    title:
      'Federal Reserve Board press release — discount rate reduced to 4-3/4 percent, federal funds rate target to about 5 percent',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '1998-10-15',
    url: 'https://www.federalreserve.gov/boarddocs/press/general/1998/19981015/',
    kind: 'regulatory',
    note: '정례 회의 밖(intermeeting) 인하. "Growing caution by lenders and unsettled conditions in financial markets more generally are likely to be restraining aggregate demand in the future." FF 목표 5-1/4% → 5%, 재할인율 5% → 4-3/4%.',
  },

  // ───────────── 규제 사후 대응 ─────────────
  {
    id: 'bcbs-45',
    title: "Banks' Interactions with Highly Leveraged Institutions",
    publisher: 'Basel Committee on Banking Supervision (BCBS)',
    date: '1999-01-28',
    url: 'https://www.bis.org/publ/bcbs45.htm',
    kind: 'regulatory',
    note: 'LTCM 이후 은행-HLI(고레버리지기관) 거래의 리스크와 관행 결함, 정책 대안 평가. 게임의 담보·한도·정보요구 옵션의 규제적 근거.',
  },
  {
    id: 'bcbs-46',
    title: "Sound Practices for Banks' Interactions with Highly Leveraged Institutions",
    publisher: 'Basel Committee on Banking Supervision (BCBS)',
    date: '1999-01-28',
    url: 'https://www.bis.org/publ/bcbs46.pdf',
    kind: 'regulatory',
    note:
      '핵심 진단: 신용리스크 관리 요소 간 균형이 깨져 "an over reliance on collateralisation of mark-to-market exposures"였고, 심층 신용분석과 익스포저의 실효적 측정·관리에 둔 비중이 부족했다. ' +
      '권고: 문서화, 포괄적 재무정보, 실사, 담보·약정 등 리스크 경감수단, 현재·미래 익스포저 측정 방법론, 한도 설정 절차, 상시 모니터링.',
  },
  {
    id: 'greenspan-fmc-1999-10-19',
    title:
      'Do efficient financial markets mitigate financial crises? (Remarks at the 1999 Financial Markets Conference of the Federal Reserve Bank of Atlanta, Sea Island, Georgia)',
    publisher: 'Board of Governors of the Federal Reserve System',
    date: '1999-10-19',
    url: 'https://www.federalreserve.gov/boarddocs/speeches/1999/19991019.htm',
    kind: 'regulatory',
    note: '연준 Financial Markets Conference 계열 문헌. 확정 인용: "Banks, being highly leveraged institutions, have, throughout their history, periodically fallen into crisis. The classic problem of bank risk management is to achieve an always-elusive degree of leverage that creates an adequate return on equity without threatening default."',
  },

  // ───────────── 국제기구·학술 ─────────────
  {
    id: 'cgfs-12-autumn-1998',
    title: 'A Review of Financial Market Events in Autumn 1998 (CGFS Papers No 12)',
    publisher: 'Committee on the Global Financial System (BIS)',
    date: '1999-10-08',
    url: 'https://www.bis.org/publications/cgfs-paper-12-review-financial-market-events-autumn-1998.pdf',
    kind: 'regulatory',
    note:
      '1998년 가을 시장 스트레스의 표준 사후 검토. 확정 인용: "In aggregate, LTCM supported assets of about $125 billion on a capital base of about $4 billion at mid-summer." · ' +
      '담보부 조달의 일일 시가평가가 만든 "in effect, a global margin call" · ' +
      '증폭 연쇄 도식(초기 충격 → VaR·시가평가·손절·마진콜 → 디레버리징 → 타 시장 전이 → 유동성 고갈 → 신용리스크·시장리스크 상승). ' +
      'Chart 4(회사채 스프레드), Chart 8(10년 국채 온·오프더런 유동성 스프레드), Chart 12(10년 국채 대비 스왑 스프레드)가 수렴거래 스프레드의 **형상** 근거다. ' +
      '**부록표에는 하위기간 평균이 bp로 실려 있다**(일별 수치는 아니다). 하위기간은 1 Jan~3 Jul · 6 Jul~14 Aug · 17 Aug~22 Sep · 23 Sep~15 Oct · 16 Oct~31 Dec이며, ' +
      'Table A1(p.50) "US 10-year US$ swap" 51 / +6 / +20 / +11 / −8, "US speculative-grade bond" 332 / +42 / +146 / +104 / −24, ' +
      'Table A2(p.51) 1998년 최저·최고(10년 스왑 44bp 2/11 → 97bp 10/14, 투기등급 307bp 3/30 → 687bp 10/19), ' +
      'Table A6(p.54) 10년 국채 온·오프더런 유동성 스프레드(미국 9 / −0 / −2 / −1 / −2)가 이 시나리오 초기값의 근거다.',
  },
  {
    id: 'bis-wp-103-furfine',
    title:
      'The costs and benefits of moral suasion: evidence from the rescue of Long-Term Capital Management (BIS Working Papers No 103) — Craig Furfine',
    publisher: 'Bank for International Settlements',
    date: '2001-08-02',
    url: 'https://www.bis.org/publ/work103.pdf',
    kind: 'academic',
    note: '구제에 참여한 은행들의 무담보 조달 변화 분석. 참여하지 않은 대형은행의 조달금리가 해결 이후 낮아진 것을 "consistent with an increase in the perceived strength of a too-big-to-fail policy"로 해석한다. 무임승차·도덕적해이 논점의 학술 근거.',
  },
  {
    id: 'jorion-2000-ltcm',
    title: 'Risk Management Lessons from Long-Term Capital Management',
    publisher: 'European Financial Management 6(3), 277–300 (Philippe Jorion)',
    date: '2000-09',
    kind: 'academic',
    note: '수렴거래 포지션의 VaR 과소평가와 유동성 조정 VaR 논점. 게임의 청산 VaR 산식(√시간 스케일링, 참여율 20%)의 방법론적 근거. URL 미확인(학술 DB 게재) — 인용은 방법론에 한정하고 수치 근거로 쓰지 않는다.',
  },

  // ───────────── 시장 데이터(일별 종가, FRED에서 직접 확인) ─────────────
  {
    id: 'frb-h15-treasury-1998',
    title:
      'Market Yield on U.S. Treasury Securities at 2-, 10- and 30-Year Constant Maturity (DGS2 · DGS10 · DGS30)',
    publisher:
      'Board of Governors of the Federal Reserve System (H.15), via FRED — Federal Reserve Bank of St. Louis',
    date: '1998-09-23',
    url: 'https://fred.stlouisfed.org/series/DGS10',
    kind: 'data',
    note: '직접 조회한 종가(2y / 10y / 30y, %): 8/14 5.34/5.40/5.55 · 8/17 5.34/5.40/5.56 · 8/31 4.91/5.05/5.30 · 9/2 4.96/5.10/5.34 · 9/18 4.61/4.70/5.15 · 9/21 4.63/4.69/5.12 · 9/22 4.66/4.73/5.16 · 9/23 4.52/4.69/5.16 · 10/15 4.13/4.58/5.02.',
  },
  {
    id: 'fred-moodys-baa-aaa-1998',
    title: "Moody's Seasoned Baa / Aaa Corporate Bond Yield (DBAA · DAAA), daily",
    publisher: "Moody's, via FRED — Federal Reserve Bank of St. Louis",
    date: '1998-09-23',
    url: 'https://fred.stlouisfed.org/series/DBAA',
    kind: 'data',
    note:
      'ICE BofA OAS 계열은 익명 다운로드에서 최근 3년만 열리므로(docs/research/data-sources-global.md §2) 1998년은 이 **전 기간 공개 계열**로 교차 확인한다. ' +
      '직접 조회한 종가(Baa / Aaa, %): 8/14 7.14/6.52 · 8/17 7.14/6.53 · 8/31 7.11/6.46 · 9/2 7.14/6.50 · 9/18 7.07/6.37 · 9/21 7.07/6.37 · 9/22 7.08/6.38 · 9/23 7.07/6.37 · 10/9 7.33/6.55 · 10/15 7.26/6.45. ' +
      'Baa−10년 국채: 8/17 174bp → 8/31 206bp → 9/18 237bp → 9/23 238bp → 10/15 268bp. Baa−Aaa(품질 스프레드): 8/17 61bp → 9/18 70bp → 9/23 70bp → 10/15 81bp.',
  },
  {
    id: 'cboe-vix-1998',
    title: 'CBOE Volatility Index: VIX (VIXCLS), daily close',
    publisher: 'Cboe Global Markets, via FRED — Federal Reserve Bank of St. Louis',
    date: '1998-09-23',
    url: 'https://fred.stlouisfed.org/series/VIXCLS',
    kind: 'data',
    note: '직접 조회한 종가: 8/14 34.34 · 8/17 31.86 · 8/27 38.55 · 8/31 44.28 · 9/2 36.76 · 9/10 45.29(구간 최고) · 9/18 38.63 · 9/21 38.58 · 9/22 36.62 · 9/23 32.47 · 10/8 45.74.',
  },
  {
    id: 'fred-tedrate-1998',
    title: 'TED Spread (TEDRATE, 3-Month LIBOR minus 3-Month Treasury Bill) — 이후 중단된 계열',
    publisher: 'FRED — Federal Reserve Bank of St. Louis',
    date: '1998-09-23',
    url: 'https://fred.stlouisfed.org/series/TEDRATE',
    kind: 'data',
    note: '직접 조회한 종가(%): 8/14 0.79 · 8/17 0.76 · 9/2 0.81 · 9/18 0.99 · 9/21 0.94 · 9/22 0.81 · 9/23 0.95 · 10/8 1.54 · 10/16 1.66. 자금시장 스트레스는 9월보다 10월에 정점을 찍었다.',
  },

  // ───────────── 언론(타임스탬프·정황 전용, 수치 근거 아님) ─────────────
  {
    id: 'press-investor-group-1998-09-23',
    title:
      'Outside investor group (Berkshire Hathaway · AIG · Goldman Sachs) offer for the LTCM portfolio, 23 September 1998 (contemporaneous press accounts)',
    publisher: '언론 보도(타임스탬프·정황 전용)',
    date: '1998-09-23',
    kind: 'press',
    note:
      '외부 투자자 제안의 **존재와 12:30 시한**은 McDonough 증언(1차)과 Fed History로 확인된다. ' +
      '반면 **제안 주체의 구성(버크셔·AIG·골드만삭스)과 제안 금액**은 1차 사후평가 어디에도 적혀 있지 않다 — 언론·회고 기반의 2차 정보다. 수치 근거로 사용하지 않는다.',
  },
]
