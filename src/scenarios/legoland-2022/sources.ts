import type { Source } from '../../engine/types'

/**
 * legoland-2022 서지. 옵션·교훈·퀴즈가 id로 참조한다. 공유 서지(src/content/sources.ts)와 같은 id는 동일 문서다.
 * 언론(press)은 사건 타임스탬프·인용에만 쓰고 대차대조표 수치의 근거로 쓰지 않는다.
 */
export const LEGO_SOURCES: Source[] = [
  // ───────── 금융위원회·정부 ─────────
  {
    id: 'fsc-2022-10-23',
    title:
      '비상거시경제금융회의 — 「50조원+α」 유동성 공급 프로그램 (채안펀드 20조·회사채/CP 매입 16조·증권금융 3조·주금공 PF-ABCP 보증 10조)',
    publisher: '금융위원회·기획재정부·한국은행·금융감독원',
    date: '2022-10-23',
    kind: 'regulatory',
    note: '채안펀드 1.6조 즉시 가동, 회사채·CP 매입 확대, 증권사 유동성 지원 3조. 원문 URL 미확인 [VERIFY]',
  },
  {
    id: 'fsc-78804',
    title:
      '[보도참고] 금융시장 점검·소통회의 개최 — 유동성 지원조치 현황 공유 및 금융업권의 대응노력 논의',
    publisher: '금융위원회',
    date: '2022-10-28',
    kind: 'regulatory',
    url: 'https://www.fsc.go.kr/no010101/78804',
    note: '10/24 채안펀드 CP 매입 개시, 10/26 증권금융 3조+α RP·증권담보대출, 10/27 산은 CP 매입 2조+α, 한은 RP 6조 집행 현황',
  },
  {
    id: 'fsc-2022-11-09',
    title:
      '금융시장 현황 점검회의 — 증권사 자기보증 PF-ABCP 매입 시 순자본비율 위험값 32% 적용(2023.6.30까지)',
    publisher: '금융위원회',
    date: '2022-11-09',
    kind: 'regulatory',
    note: '매입확약 ABCP 자체매입분 신용위험액 위험값 100%→32%. 원문 URL 미확인 [VERIFY]',
  },
  {
    id: 'fsc-2022-11-11',
    title: '산업은행·증권금융 증권사 발행 CP·PF-ABCP 매입 프로그램 가동',
    publisher: '금융위원회',
    date: '2022-11-11',
    kind: 'regulatory',
    note: '10/23 대책의 회사채·CP 매입 범위를 증권사 CP·PF-ABCP로 확대. 규모·일자 [VERIFY]',
  },
  {
    id: 'fsc-2022-11-24',
    title:
      '종합금융투자사업자 PF-ABCP 매입프로그램(1.8조원, A2 등급, 사당 2,000억, 매입금리 10%대) 가동',
    publisher: '금융위원회·금융투자협회',
    date: '2022-11-24',
    kind: 'regulatory',
    note: '9개 종투사 출자, 중소형 증권사 보증 A2 PF-ABCP 매입. 1차 2,938억. 원문 URL 미확인 [VERIFY]',
  },
  {
    id: 'fsc-80034',
    title: '[보도자료] 부동산 PF 관련 증권사發 불안요인 선제적으로 차단한다',
    publisher: '금융위원회',
    date: '2023-05-24',
    kind: 'regulatory',
    url: 'https://www.fsc.go.kr/no010101/80034',
    note: '증권사 보증 PF 유동화증권의 대출 전환 4.9조; 차환 위험을 대출로 흡수하는 사후 구조조정',
  },
  {
    id: 'fsc-86917',
    title: '증권사 유동성 관리 강화를 위한 「금융투자업규정」 및 「시행세칙」 개정 추진',
    publisher: '금융위원회',
    date: '2026-05-18',
    kind: 'regulatory',
    url: 'https://www.fsc.go.kr/no010101/86917',
    note: '2027.1.1 유동성비율 개편: 49개사 전체, 유동자산 헤어컷, 우발채무 유동부채 포함 — 2022년 교훈의 제도화',
  },
  {
    id: 'fsc-call-market-2015',
    title: '콜시장 개편 방안 — 증권사 콜차입 한도 자기자본의 15% 이내',
    publisher: '금융위원회',
    date: '2015-03',
    kind: 'regulatory',
    note: '증권사 콜차입 한도(자기자본 15%) [VERIFY]',
  },
  // ───────── 한국은행 ─────────
  {
    id: 'bok-omo-2022-10-27',
    title:
      '한국은행 공개시장운영 조치 — RP 매입 6조원(~2023.1.31), 적격담보증권 확대(은행채·공공기관채, 11/1~3개월), 담보비율 인상 유예',
    publisher: '한국은행',
    date: '2022-10-27',
    kind: 'regulatory',
    note: '최대 36.5조 효과. RP 매매 대상기관(은행·일부 증권사)에 한정 — 중형 증권사는 간접 수혜',
  },
  {
    id: 'bok-act',
    title:
      '한국은행법 (제65조 금융기관에 대한 긴급여신 · 제68조 공개시장운영 · 제80조 영리기업 여신)',
    publisher: '대한민국 법률',
    date: '2026-09',
    kind: 'primary',
    url: 'https://ko.wikisource.org/wiki/한국은행법',
    note: '65조: 금통위 4명 이상 찬성·정부 의견 청취; 68조: RP 매입·적격담보 확대(2022.10.27 근거); 80조: 비은행 영리기업 여신',
  },
  {
    id: 'bok-base-rate',
    title: '한국은행 기준금리 결정 이력 (2022.8.25 2.50% · 10.12 3.00% · 11.24 3.25%)',
    publisher: '한국은행',
    date: '2022-11-24',
    kind: 'data',
    url: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643',
  },
  {
    id: 'bok-fsr-2022-12',
    title: '금융안정보고서 2022년 12월 — 참고: 단기금융시장 경색과 증권사 PF 우발채무',
    publisher: '한국은행',
    date: '2022-12',
    kind: 'regulatory',
    note: '참고6 본문 미확인 [VERIFY]; 증권사 PF 우발채무·단기자금시장 경색 평가',
  },
  // ───────── 시장 데이터 ─────────
  {
    id: 'kofia-bond',
    title: '채권정보센터 최종호가수익률 — CP91(A1)·CD91·국고 3년·회사채 AA-/BBB- 3년',
    publisher: '금융투자협회',
    date: '2022-12',
    kind: 'data',
    url: 'https://www.kofiabond.or.kr',
    note: 'CP91 9/22 3.15% · 11/7 4.92% · 11/25 5.50% · 12/1 5.54%; 국고3y 9/26 4.548%; AA- 10/14 5.320%·10/21 5.736%; 스프레드 10/14 111~114bp, 11/29 168.2bp',
  },
  {
    id: 'fss-pf-2022',
    title: '증권사 부동산 PF 채무보증 현황 — 20.2조(2022.10말) → 21.5조(2022.12말)',
    publisher: '금융감독원',
    date: '2023-01',
    kind: 'regulatory',
    note: '증권사 PF 채무보증 잔액. 원문 URL 미확인 [VERIFY]',
  },
  // ───────── 연구·평가 ─────────
  {
    id: 'kcmi-lee-2022-18',
    title: '이슈보고서 22-18 (이효섭): 비은행 부동산 PF 익스포저 리스크',
    publisher: '자본시장연구원',
    date: '2022-09-05',
    kind: 'academic',
    note: '비은행 PF 78.1조, A3- CP 6.0% 경고 — 사태 3주 전. URL 미확인',
  },
  {
    id: 'kcmi-23-10',
    title: '이슈보고서 23-10: 국내 증권업 부동산PF 위험요인과 대응방안 (장근혁·이석훈·이효섭)',
    publisher: '자본시장연구원',
    date: '2023-05',
    kind: 'academic',
    url: 'https://www.kcmi.re.kr/report/report_view?report_no=1747',
    note: '매입확약 구조, 차환 실패 시 자체매입의 NCR·유동성 동시 소진, 중소형사 취약성',
  },
  {
    id: 'kis-pf-2022-03',
    title: '증권사 부동산 PF 익스포저 분석 — 익스포저/자기자본 소형 49%·중형 47%·대형 37%',
    publisher: '한국신용평가',
    date: '2022-03',
    kind: 'academic',
    note: '합성 기관 익스포저 비율의 근거',
  },
  {
    id: 'bai-gangwon-2015',
    title: '강원도 감사결과 — 레고랜드 보증 증액(210억→2,050억) 시 도의회 동의 누락',
    publisher: '감사원',
    date: '2015-12',
    kind: 'regulatory',
    note: '지자체 보증의 법적 취약성이 2022년 부도의 원인(遠因)',
  },
  {
    id: 'gangwon-2022',
    title: '강원도 발표 — 9/28 GJC 회생신청 · 10/21 "2023.1.29까지 상환" · 10/27 "12/15까지 상환"',
    publisher: '강원도',
    date: '2022-10-27',
    kind: 'primary',
    note: '12/15 상환 완료의 1차 출처 미확인 [VERIFY]',
  },
  // ───────── 국제 기준 ─────────
  {
    id: 'bcbs-144',
    title: 'Principles for Sound Liquidity Risk Management and Supervision',
    publisher: 'Basel Committee on Banking Supervision',
    date: '2008-09',
    kind: 'regulatory',
    url: 'https://www.bis.org/publ/bcbs144.pdf',
    note: '원칙 11 비상자금조달계획: 조치의 금액·리드타임·발동 조건',
  },
  {
    id: 'fsb-depositor-behaviour-2024',
    title: 'Depositor Behaviour and Interest Rate and Liquidity Risks in the Financial System',
    publisher: 'Financial Stability Board',
    date: '2024-10-23',
    kind: 'regulatory',
    url: 'https://www.fsb.org/uploads/P231024.pdf',
    note: '검증 가능한 수치에 기반한 커뮤니케이션만 유효 — 익스포저 공시 옵션의 앵커',
  },
  {
    id: 'bcbs-d555',
    title: 'Report on the 2023 banking turmoil',
    publisher: 'Basel Committee on Banking Supervision',
    date: '2023-10',
    kind: 'regulatory',
    url: 'https://www.bis.org/bcbs/publ/d555.htm',
    note: '파이어세일·무담보 도매조달의 취약성',
  },
  // ───────── 언론(타임스탬프·인용 전용) ─────────
  {
    id: 'press-abcp-default-2022-10',
    title: '레고랜드 ABCP(아이원제일차) 등급 A1→C(10/4), 최종 부도 처리(10/5)',
    publisher: '연합뉴스',
    date: '2022-10-05',
    kind: 'press',
  },
  {
    id: 'press-heungkuk-2022-11',
    title:
      '흥국생명 5억달러 신종자본증권 콜옵션 미행사 공시(11/1) → 번복(11/7) → 콜 행사(11/9); 채권가 99.7→72.2달러; DB생명 콜 연기(11/3)',
    publisher: '연합뉴스·연합인포맥스',
    date: '2022-11-09',
    kind: 'press',
  },
  {
    id: 'press-cp-2022-11-25',
    title: 'CP 금리 5.50%, 45일 연속 상승 — 2009년 이후 최고',
    publisher: '연합인포맥스',
    date: '2022-11-25',
    kind: 'press',
  },
  {
    id: 'press-daol-2022-11',
    title: '다올투자증권 희망퇴직 실시, 다올타일랜드 매각 추진 — 중형 증권사 유동성 대응',
    publisher: '연합뉴스',
    date: '2022-11',
    kind: 'press',
  },
  {
    id: 'press-abcp-maturity-2022-10',
    title: '증권사 보증 PF-ABCP 만기 10월 6.2~6.7조·11월 10.7조 (신용평가사·금투협 집계 인용)',
    publisher: '연합뉴스',
    date: '2022-10',
    kind: 'press',
    note: '만기 사다리 스케일링의 앵커 [CAL]',
  },
]
