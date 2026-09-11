import type { ReadingItem } from './types'

/**
 * 추천 읽을거리. 공식 사후평가와 핵심 논문 위주로, 시나리오 id·주제 태그를 붙인다.
 * 근거: docs/research/*.md 도시에의 "교훈 및 공식 사후평가 출처".
 */
export const READING_LIST: ReadingItem[] = [
  // ── 2023 미국 은행 위기 ──
  {
    title:
      "Review of the Federal Reserve's Supervision and Regulation of Silicon Valley Bank (Barr 리뷰)",
    publisher: 'Federal Reserve Board',
    year: '2023',
    url: 'https://www.federalreserve.gov/publications/files/svb-review-20230428.pdf',
    tags: ['svb-2023', 'bank', 'supervision', 'liquidity', 'irrbb'],
    note: '경영 실패·감독 미흡·2019 tailoring. ILST 위반과 가정 완화(p.72, 78), AOCI 옵트아웃, HTM 취급 재평가.',
  },
  {
    title: 'Material Loss Review of Signature Bank of New York (EVAL-24-02)',
    publisher: 'FDIC Office of Inspector General',
    year: '2023',
    url: 'https://www.fdicoig.gov/sites/default/files/reports/2023-10/EVAL-24-02.pdf',
    tags: ['svb-2023', 'bank', 'cfp', 'resolution'],
    note: 'CFP를 발동했으나 일일 현금흐름 보고·담보 테스트가 없었던 사례. 주말 $7.9B vs $3.0B.',
  },
  {
    title: "FDIC's Supervision of First Republic Bank",
    publisher: 'FDIC',
    year: '2023',
    tags: ['svb-2023', 'bank', 'supervision', 'lolr'],
    note: '컨소시엄 예금 $30B로 5주 확보 → 공시로 재점화 → 등급 강등이 재할인창구를 차단한 경위.',
  },
  {
    title: 'Report on the 2023 banking turmoil (d555)',
    publisher: 'Basel Committee on Banking Supervision',
    year: '2023',
    url: 'https://www.bis.org/bcbs/publ/d555.pdf',
    tags: ['svb-2023', 'credit-suisse-2023', 'basel3', 'liquidity', 'capital'],
    note: 'SVB·시그니처·FRC·CS를 아우르는 국제 기준 관점의 원인·대응·교훈.',
  },
  {
    title:
      'Depositor Behaviour and Interest Rate and Liquidity Risks in the Financial System: Lessons from the March 2023 banking turmoil',
    publisher: 'Financial Stability Board',
    year: '2024',
    url: 'https://www.fsb.org/2024/10/depositor-behaviour-and-interest-rate-and-liquidity-risks-in-the-financial-system-lessons-from-the-march-2023-banking-turmoil/',
    tags: ['svb-2023', 'run', 'liquidity', 'communication'],
    note: '런 속도 통계(상위 3개 런 일 20~30%, 중위 7%/일), fast-fail 시나리오, 소셜미디어 모니터링.',
  },
  {
    title:
      'Addendum to the Interagency Policy Statement on Funding and Liquidity Risk Management: Importance of Contingency Funding Plans',
    publisher: 'Federal Reserve · FDIC · OCC · NCUA',
    year: '2023',
    url: 'https://www.federalreserve.gov/newsevents/pressreleases/files/bcreg20230728a1.pdf',
    tags: ['svb-2023', 'cfp', 'liquidity', 'discount-window'],
    note: '재할인창구 운영 준비·주기적 테스트 거래를 CFP에 포함하라는 2023.7.28 부록.',
  },
  {
    title: 'Silicon Valley Bank: Gone in 36 Hours (HBS 케이스)',
    publisher: 'Harvard Business School',
    year: '2023',
    tags: ['svb-2023', 'bank', 'case', 'simulation'],
    note: '교육용 케이스. 의사결정 시점별 정보 컷을 확인하는 데 유용.',
  },

  // ── Basel 조문 ──
  {
    title: 'Basel III: The Liquidity Coverage Ratio and liquidity risk monitoring tools (bcbs238)',
    publisher: 'Basel Committee on Banking Supervision',
    year: '2013',
    url: 'https://www.bis.org/publ/bcbs238.pdf',
    tags: ['basel3', 'lcr', 'liquidity'],
    note: 'LCR 정의, HQLA 등급·헤어컷·상한, 유출률 표의 원문.',
  },
  {
    title: 'Principles for Sound Liquidity Risk Management and Supervision (bcbs144)',
    publisher: 'Basel Committee on Banking Supervision',
    year: '2008',
    url: 'https://www.bis.org/publ/bcbs144.pdf',
    tags: ['basel3', 'cfp', 'liquidity'],
    note: '원칙 11(¶110~117)이 CFP 구성요소의 원전.',
  },
  {
    title: 'Interest rate risk in the banking book (d368)',
    publisher: 'Basel Committee on Banking Supervision',
    year: '2016',
    url: 'https://www.bis.org/bcbs/publ/d368.pdf',
    tags: ['basel3', 'irrbb', 'capital'],
    note: 'EVE 6개·NII 2개 시나리오, 이상치 기준 ΔEVE > Tier1 15%. d578(2024.7)로 2026년 재보정.',
  },

  // ── 2023 크레디트스위스 ──
  {
    title: 'Lessons Learned from the CS Crisis',
    publisher: 'FINMA',
    year: '2023',
    url: 'https://www.finma.ch/en/~/media/finma/dokumente/dokumentencenter/myfinma/finma-publikationen/cs-bericht/20231219-finma-bericht-cs.pdf',
    tags: ['credit-suisse-2023', 'resolution', 'at1', 'ela'],
    note: '일별 유출 CHF 13.2/17.1/10.1B, ELA·ELA+·PLB, 5개 선택지와 UBS 합병, AT1 상각 논리.',
  },

  // ── 2022 영국 LDI ──
  {
    title: 'Financial stability buy/sell tools: a gilt market case study',
    publisher: 'Bank of England Quarterly Bulletin',
    year: '2023',
    url: 'https://www.bankofengland.co.uk/quarterly-bulletin/2023/2023/financial-stability-buy-sell-tools-a-gilt-market-case-study',
    tags: ['uk-ldi-2022', 'central-bank', 'fire-sale', 'pension'],
    note: '임시 길트 매입(최대 £65bn, 실집행 £19.3bn)의 설계 원칙과 종료 결정.',
  },
  {
    title: 'Bank staff paper: LDI minimum resilience — recommendation and explainer',
    publisher: 'Bank of England (FPC)',
    year: '2023',
    url: 'https://www.bankofengland.co.uk/financial-policy-summary-and-record/2023/bank-staff-paper-ldi-minimum-resilience',
    tags: ['uk-ldi-2022', 'pension', 'collateral'],
    note: '250bp 최소 회복력 기준의 보정 근거.',
  },
  {
    title: 'Using leveraged liability-driven investment (LDI 가이드)',
    publisher: 'The Pensions Regulator',
    year: '2023',
    url: 'https://www.thepensionsregulator.gov.uk/en/document-library/scheme-management-detailed-guidance/funding-and-investment-detailed-guidance/liability-driven-investment',
    tags: ['uk-ldi-2022', 'pension', 'collateral'],
    note: '250bp 시장 스트레스 버퍼 + 운영 버퍼, 담보 보충 5일 가정.',
  },
  {
    title:
      "Putting Out the NBFIRE: Lessons from the UK's Liability-Driven Investment (LDI) Crisis (WP/23/210)",
    publisher: 'International Monetary Fund',
    year: '2023',
    url: 'https://www.imf.org/en/publications/wp/issues/2023/09/29/putting-out-the-nbfire-lessons-from-the-uk-s-liability-driven-investment-ldi-crisis-539683',
    tags: ['uk-ldi-2022', 'nbfi', 'margin'],
    note: '마진콜 ≈£70bn·길트 매도 ≈£37bn 추정, 개입 성공 요인 분석.',
  },

  // ── 2008 GFC · 1998 LTCM · 2021 아케고스 ──
  {
    title: 'The Financial Crisis Inquiry Report, ch.15 & ch.18',
    publisher: 'Financial Crisis Inquiry Commission',
    year: '2011',
    url: 'https://www.govinfo.gov/content/pkg/GPO-FCIC/pdf/GPO-FCIC.pdf',
    tags: ['lehman-2008', 'repo', 'prime-broker', 'resolution'],
    note: '트라이파티 레포 일중 신용과 청산은행 담보 요구가 증권사 실패 메커니즘이었음을 기록.',
  },
  {
    title: 'Hedge Funds, Leverage, and the Lessons of Long-Term Capital Management',
    publisher: "President's Working Group on Financial Markets",
    year: '1999',
    url: 'https://home.treasury.gov/system/files/236/hedgfund.pdf',
    tags: ['ltcm-1998', 'leverage', 'prime-broker'],
    note: '자산 >$125B, 레버리지 >25:1, 명목 파생 ≈$1.4T(통용되는 $1.25T는 PWG 수치 아님).',
  },
  {
    title: 'Near Failure of Long-Term Capital Management',
    publisher: 'Federal Reserve History',
    year: '2013',
    url: 'https://www.federalreservehistory.org/essays/ltcm-near-failure',
    tags: ['ltcm-1998', 'central-bank'],
    note: 'FRBNY 소집과 14개사 $3.6B 컨소시엄의 짧은 개관.',
  },
  {
    title: 'Credit Suisse — Report on Archegos Capital Management (Paul Weiss 독립 조사)',
    publisher: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
    year: '2021',
    url: 'https://www.paulweiss.com/practices/litigation/internal-investigations/news/credit-suisse-publishes-independent-review-of-archegos-losses?id=40637',
    tags: ['archegos-2021', 'prime-broker', 'margin', 'governance'],
    note: '스왑 마진 20%→7.5%→<6%, PE 한도 10배 초과 방치, 3/25 청산 죄수의 딜레마.',
  },
  {
    title: 'SEC Charges Archegos and its Founder with Massive Market Manipulation Scheme (2022-70)',
    publisher: 'U.S. Securities and Exchange Commission',
    year: '2022',
    url: 'https://www.sec.gov/news/press-release/2022-70',
    tags: ['archegos-2021', 'trs', 'prime-broker'],
  },

  // ── 2020.3 dash for cash ──
  {
    title: 'Holistic Review of the March Market Turmoil',
    publisher: 'Financial Stability Board',
    year: '2020',
    url: 'https://www.fsb.org/2020/11/holistic-review-of-the-march-market-turmoil/',
    tags: ['covid-2020-fund', 'mmf', 'margin', 'nbfi'],
    note: '펀드 유출·MMF 런·베이시스 트레이드 청산·CCP 증거금 급증의 종합 분석.',
  },
  {
    title: 'Money Market Fund Reforms (Final Rule)',
    publisher: 'U.S. Securities and Exchange Commission',
    year: '2023',
    tags: ['covid-2020-fund', 'mmf', 'gate'],
    note: '게이트 폐지, DLA 25%/WLA 50%, 의무 유동성 수수료.',
  },

  // ── 한국 ──
  {
    title: '서민금융 지원시스템 운영 및 감독실태 (감사결과)',
    publisher: '감사원',
    year: '2011',
    tags: ['savings-bank-2011', 'supervision', 'pf'],
    note: '저축은행 PF 부실과 138일 검사 미적발의 감독 실패.',
  },
  {
    title: '저축은행 구조조정 성과 평가 및 향후 정책 방향',
    publisher: '금융위원회',
    year: '2014',
    url: 'https://www.fsc.go.kr/no010101/71188',
    tags: ['savings-bank-2011', 'resolution', 'korea'],
    note: '105개→87개, BIS 5.6%→11.2%, 특별계정 27.2조의 사후 평가.',
  },
  {
    title: '이슈보고서 22-18: 비은행 부동산 PF 익스포저 리스크 (이효섭)',
    publisher: '자본시장연구원',
    year: '2022',
    tags: ['legoland-2022', 'pf', 'securities'],
    note: '레고랜드 사태 3주 전 A3- CP 6.0%·비은행 PF 78.1조를 경고한 보고서.',
  },
  {
    title: '이슈보고서 23-10: 국내 증권업 부동산PF 위험요인과 대응방안',
    publisher: '자본시장연구원',
    year: '2023',
    url: 'https://www.kcmi.re.kr/report/report_view?report_no=1747',
    tags: ['legoland-2022', 'taeyoung-pf-2024', 'pf', 'securities'],
  },
  {
    title: 'KDI FOCUS: 부동산 PF 자본확충의 효과와 제도개선 방안 (황순주)',
    publisher: '한국개발연구원',
    year: '2025',
    url: 'https://www.kdi.re.kr/research/focusView?pub_no=18876',
    tags: ['taeyoung-pf-2024', 'pf', 'policy'],
    note: '시행사 자기자본 3%→20% 시 총사업비 7.2% 절감.',
  },
  {
    title: '파생결합증권시장 건전화 방안',
    publisher: '금융위원회',
    year: '2020',
    url: 'https://www.korea.kr/briefing/pressReleaseView.do?newsId=156403711',
    tags: ['els-margin-2020', 'securities', 'liquidity', 'korea'],
    note: '자체헤지 증권사 외화유동자산 10~20%, 레버리지 가중치 상향, 유동성비율 기준 개선.',
  },
  {
    title: '외환위기 특별감사 결과',
    publisher: '감사원',
    year: '1998',
    tags: ['korea-imf-1997', 'central-bank', 'policy'],
    note: '한은의 23차례 보고에도 대응이 지연된 경위.',
  },

  // ── 시뮬레이션 훈련 실무 ──
  {
    title: 'The World Bank Crisis Simulation Exercise Handbook',
    publisher: 'World Bank',
    year: '2023',
    url: 'https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099125002162330340',
    tags: ['simulation', 'training', 'policy'],
    note: '계획-구축-실행-보고 사이클, 인젝트, 구조화된 디브리핑 — 이 플랫폼의 설계 원칙 근거.',
  },
  {
    title:
      'Cross-border crisis simulation exercise in sub-Saharan Africa (FSI Occasional Paper 21)',
    publisher: 'BIS Financial Stability Institute',
    year: '2023',
    url: 'https://www.bis.org/fsi/fsipapers21.htm',
    tags: ['simulation', 'training', 'ela', 'resolution'],
    note: 'ELA 타이밍 결정이 당국별로 크게 달랐던 8개국 훈련 기록.',
  },
  {
    title: 'The Effects of the Chair the Fed Simulation on High School Students Knowledge',
    publisher: 'SAGE (Duzhak · Hoff · Lopus)',
    year: '2021',
    url: 'https://journals.sagepub.com/doi/abs/10.1177/0569434520971193',
    tags: ['simulation', 'training', 'central-bank'],
    note: '시뮬레이션 학습이 전통 수업 대비 사후 테스트 점수를 높였다는 실증.',
  },
]
