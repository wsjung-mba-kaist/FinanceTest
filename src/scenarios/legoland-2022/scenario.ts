import type { ScenarioDefinition, SecuritiesState } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { legoDebrief } from './debrief'
import { legoInitialConfidence, legoInitialMarket, legoInitialSecurities } from './initialState'
import { legoScoring } from './scoring'
import { LEGO_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<SecuritiesState> = defineScenario<SecuritiesState>({
  meta: {
    id: 'legoland-2022',
    version: 1,
    title: '차환의 벽: 레고랜드 이후',
    subtitle: '2022년 10~11월 PF-ABCP 시장 경색',
    era: '2022-10',
    year: 2022,
    region: 'korea',
    role: 'securities_risk_head',
    roleTitle: '중형 증권사 최고리스크책임자(CRO)',
    institutionType: 'securities',
    institutionName: '한빛증권(가상)',
    modelledOn:
      '2022년 자기자본 1조원 내외 중형 증권사 합성(한국신용평가 2022.3 중형사 PF 익스포저/자기자본 47%, 금융감독원 2022.10말 증권사 PF 채무보증 20.2조와 10·11월 만기 비율; 하이투자·다올·SK증권 등의 대응 기록)',
    difficulty: 'standard',
    durationTurns: 9,
    turnUnit: 'day',
    estMinutes: 40,
    timezone: 'Asia/Seoul',
    learningObjectives: [
      {
        id: 'lo1',
        text: '매입확약의 차환 실패가 현금과 NCR을 동시에 소진하는 구조를 이해하고, 비상자금조달계획(CFP)의 워터폴(확정 라인 → 담보 조달 → 무담보)에 따라 조달 순서를 정한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d1', 't1-d2', 't2-d2', 't3-d3', 't5-d2'],
      },
      {
        id: 'lo2',
        text: 'NCR 산식(영업용순자본·총위험액·필요유지자기자본)에서 자체매입 위험값·차감항목·가산항목이 자체매입, 자산 매각, 자사주, 후순위채 콜에 어떻게 반응하는지 계산한다.',
        competency: 'solvency',
        decisionIds: ['t1-d1', 't2-d1', 't5-d3', 't6-d1', 't6-d2', 't7-d2'],
      },
      {
        id: 'lo3',
        text: '정책 발표를 범위 일치(채안펀드 회사채·A1 CP vs A2 PF-ABCP)와 집행 시차(증권금융 10/26, 한은 적격담보 11/1, 산은·증금 11/11, 종투사 프로그램 11/24)로 읽고, 자기 기관에 닿는 창구만 자금으로 계산한다.',
        competency: 'policy',
        decisionIds: ['t4-d2', 't4-d3', 't5-d2', 't7-d2', 't8-d2'],
      },
      {
        id: 'lo4',
        text: '검증 가능한 여력에 기반한 익스포저 공시와 시장 관행(콜옵션) 준수가 시장 접근성을 지킨다는 것을 이해하고, 수치 없는 안심 메시지·침묵·콜 미행사의 비용을 구분한다.',
        competency: 'communication',
        decisionIds: ['t3-d2', 't5-d3'],
      },
      {
        id: 'lo5',
        text: '적기시정조치(NCR 100/50/0%)와 감독 에스컬레이션, 매입확약 불이행의 제재·시장 퇴출 리스크, 규제 특례의 범위·시한을 안다.',
        competency: 'compliance',
        decisionIds: ['t1-d1', 't3-d1', 't6-d1', 't6-d2', 't8-d2'],
      },
    ],
    competencies: { liquidity: 3, solvency: 2, compliance: 2, policy: 1, communication: 1 },
    tags: ['PF-ABCP', 'NCR', '채안펀드', '콜옵션', '매입확약', '증권금융'],
    sources: LEGO_SOURCES,
  },
  units: { currency: 'KRW', scale: 1e8, display: '억원' },
  initialState: {
    institution: legoInitialSecurities,
    market: legoInitialMarket,
    confidence: legoInitialConfidence,
    regulatorLevel: 0,
    flags: {},
    counters: {},
  },
  briefing: {
    situation: `2022년 9월 28일 수요일 오후. 귀하는 **한빛증권(가상)**의 최고리스크책임자(CRO)입니다. 한빛증권은 자기자본 1조원 안팎의 중형 증권사로, 부동산 PF 유동화증권(PF-ABCP)에 대한 매입확약·신용공여 잔액이 4,700억원 — 자기자본의 47%로 중형사 평균과 같습니다. 보증 물량의 대부분은 A2 등급 사업장이며 1~3개월마다 차환됩니다.

오늘 오후 강원도가 도 출자기관인 강원중도개발공사(GJC)에 대해 기업회생을 신청하겠다고 밝혔습니다. GJC의 SPC가 발행한 2,050억원 ABCP는 강원도 지급보증을 근거로 A1 등급을 받았고 내일 만기입니다. 아직 한빛증권의 보증 ABCP는 정상 차환되고 있습니다. 그러나 "지자체 보증도 안 갚는다"는 학습이 시장에 퍼지면 A2 PF-ABCP 전체가 재평가되고, 차환 실패분은 약정대로 한빛증권이 사야 합니다 — 현금이 나가고 같은 금액이 위험값 100%로 총위험액에 더해집니다.

시나리오는 9턴입니다: 9/28 프롤로그(부도 전 준비) → 10/5 최종 부도 → 10/14 스프레드 확대 → 10/21 CP 수요처 이탈 → 10/24 「50조원+α」 다음 날 → 11/1 흥국생명 콜옵션 → 11/9 NCR 특례 → 11/24 PF-ABCP 매입프로그램 → 12/1~15 정점과 연말 결산.`,
    mandate: `**권한**: 리스크위원회 한도 내에서 매입확약 이행·만기 연장 협상, 조달 채널(은행 크레딧라인·RP·콜·CP·증권금융·정책 프로그램) 선택, 보유 채권 매각, 익스포저 공시 수준, 비용 절감·자산 매각 착수, 후순위채 콜옵션 결정을 실행할 수 있습니다. 신규 매입확약 재개와 자회사 매각 완료는 이사회 승인 사항이지만 게임에서는 즉시 결정됩니다. 매입확약 불이행은 계약 위반이며 물리적으로 가능하지만 되돌릴 수 없습니다. 한국은행 RP 매매 대상기관이 아니므로 한은 창구는 직접 쓸 수 없습니다.

**목표**: 12월 15일까지 결제 실패 없이 영업을 유지하면서 NCR을 적기시정조치 기준(100%) 위에 두고, 연말 결산에서 NCR 150%·유동성비율 100% 이상을 만드십시오. 11월의 만기 벽(11/1 이후)에서도 NCR 150%를 한 번도 내주지 않으면 연착륙입니다.`,
    institutionProfile: `| 항목(억원) | 한빛증권 | 비고 |
|---|---|---|
| 자기자본 | 10,000 | 중형사 양식화 |
| 영업용순자본 | 9,000 | 차감항목 1,500(고정자산·자회사 출자) · 가산항목 500(후순위채, 11/15 콜) |
| 총위험액 | 5,250 | 시장 2,400 · 신용 2,250 · 운영 600 |
| 필요유지자기자본 | 1,500 | |
| **NCR** | **250%** | (9,000 − 5,250) / 1,500 |
| 현금 | 1,800 | |
| 은행 크레딧라인 | 1,500 | 미사용, 당일 인출 |
| 매각·RP 담보 가능 채권 | 2,400 | 국공채·은행채·AA |
| PF 매입확약·신용공여 | 4,700 | 자기자본 47%, 대부분 A2 |
| 브릿지론 | 800 | 직접 대출 |
| CP·전단채 | 7,000 | 1~3개월, 자사 A2 발행금리 4.4% |
| RP 매도 | 1,000 | |
| 콜차입 | 1,000 | 한도 1,500(자기자본 15%) |
| **유동성비율(게임 단순화)** | **120%** | (현금 + 미사용 라인 + 채권×0.9) / (30일 만기×(1−차환률) + 콜 + CP×0.5) |

**만기 사다리(억원)**: 9/28~10/4 150 · 10/5 400 · 10/14 400 · 10/21 250 · 10/24 450 · 11/1 750 · 11/9 1,050 · 11/24 700 · 12/1 300 · 2023.1~ 250. 10월 1,500(32%)·11월 2,500(53%)은 업계 만기(6.5조·10.7조 / 20.2조) 비율로 스케일한 값입니다.

**알려진 취약점(9/28 기준)**: 익스포저가 자기자본 절반에 육박, 만기가 11월에 집중, 조달의 70%가 CP·전단채, 한은 RP 대상기관 아님, 후순위채 콜 11/15 도래.`,
    marketBackdrop: `한은은 8월 25일 기준금리를 2.50%로 올렸고 10월 12일 50bp 추가 인상이 예상됩니다. 국고 3년은 9월 26일 4.548%로 정점을 찍었고 CP91(A1)은 연초 1.55%에서 3.15%(9/22)로 올랐습니다. 원/달러는 1,440원으로 13년 만의 최고 부근입니다. 자본시장연구원은 3주 전(9/5) A3- CP 6.0%와 비은행 PF 익스포저 78.1조원을 경고했습니다. 증권사 PF 채무보증은 업계 전체로 약 20조원이며 10월 6.2~6.7조, 11월 10.7조가 만기입니다. 시장은 아직 A2 PF-ABCP를 정상 차환하고 있습니다.`,
    stakeholders: [
      {
        name: '금융위원회·금융감독원',
        wants: '시장 안정, 정확한 익스포저 보고, 적기시정조치 기준 준수',
        canDo: '일일 보고 요구, 자본확충 계획 요구, NCR 특례·시장안정대책 설계, 검사·제재',
      },
      {
        name: '한국은행',
        wants: '단기금융시장 기능 유지, 법적 근거 없는 지원 회피',
        canDo: '한은법 68조 RP 매입·적격담보 확대(대상기관 한정), 65조 긴급여신(금통위 4명 이상)',
      },
      {
        name: '금융투자협회',
        wants: '업권 공동 대응, 정책 창구 접수 창구 역할',
        canDo: '증권금융·프로그램 신청 취합, 종투사 출자 프로그램 조율',
      },
      {
        name: '주거래은행(크레딧라인)',
        wants: '담보 안전성, 증권사 신용 리스크 통제',
        canDo: '기존 한도 당일 인출 허용, 증액은 본부 심사(부도 후 지연), 라인 회수',
      },
      {
        name: '한국증권금융',
        wants: '담보 적격성, 정책 지시 집행',
        canDo: '증권사 대상 RP·증권담보대출(10/26 이후 특별 지원)',
      },
      {
        name: '신용평가사',
        wants: 'PF 우발채무·유동성 대응 계획의 투명성',
        canDo: '등급전망 검토·하향, 업계 익스포저 집계 공개',
      },
      {
        name: '발행 SPC·시공사·ABCP 투자자',
        wants: '차환 또는 상환 확실성, 사업장 정상 진행',
        canDo: '만기 연장 동의·거부, 재투자 중단, 매입확약 이행 청구',
      },
      {
        name: '언론',
        wants: '증권사별 익스포저 수치, 속보',
        canDo: '추측성 보도, 극단 사례로 업계 전체 묘사',
      },
    ],
    regulatoryFramework: `- **NCR(순자본비율)**: (영업용순자본 − 총위험액) / 필요유지자기자본. 영업용순자본 = 자기자본 − 차감항목(고정자산·자회사 출자·자사주) + 가산항목(후순위차입). 총위험액 = 시장·신용·운영위험액. 자체매입 PF-ABCP는 신용위험액에 위험값 100%로 가산된다(특례 전).
- **적기시정조치**: NCR 100% 미만 경영개선권고, 50% 미만 경영개선요구, 0% 미만 경영개선명령(금산법·금융투자업규정). 게임에서는 100% 미만 2턴 연속 또는 50% 미만이면 종료.
- **유동성비율**: 유동자산/유동부채 1개월·3개월 각 100%. 현행 규제 대상은 종투사 10사·파생결합증권 발행사 13사라 한빛증권은 대상이 아니지만 내부 관리지표로 쓰며, 2027.1.1부터 49개사 전체에 헤어컷·우발채무 포함 산식으로 확대된다. 대시보드의 유동성비율은 게임 단순화 산식이다.
- **한국은행법**: 68조 공개시장운영(RP 매입·적격담보 확대 — 대상기관만), 65조 긴급여신(유동성 악화 금융기관, 금통위 4명 이상 찬성·정부 의견 청취), 80조 영리기업 여신. 중형 증권사는 은행·증권금융을 통해서만 한은 유동성에 닿는다.
- **채권시장안정펀드**: 금융회사 출자 캐피탈콜 방식(상설 기금 아님). 매입 대상은 회사채·CP 중 적격 등급 — 범위와 콜 응답 시차를 읽어야 한다.
- **감독 단계 R0~R4**: 강화 모니터링(일일 보고) → 제한(자본확충 계획 요구) → 정리 준비(현장 검사) → 명령. 매입확약 불이행은 계약 위반으로 제재·소송 대상이다.`,
    cardRefs: [
      'pf-abcp-commitment-ncr',
      'korea-crisis-toolkit',
      'contingency-funding-plan',
      'crisis-communication',
      'regulator-escalation-ladder',
      'hqla-and-haircuts',
    ],
    simplificationNotes: [
      '한빛증권은 특정 증권사가 아니라 2022년 중형 증권사(자기자본 1조원 내외)의 합성 기관이다. 자기자본·차감/가산항목·총위험액·조달 구조는 양식화(STYLIZED)했고, PF 익스포저/자기자본 47%는 한신평 중형 평균이다.',
      '만기 사다리는 업계 만기(10월 6.2~6.7조 / 11월 10.7조 of 20.2조)의 비율(32%/53%)로 보증 잔액 4,700억을 나눈 보정값(CAL)이다. 개별 증권사의 실제 사다리는 공개되지 않는다.',
      '차환 성공률 경로(95→60→45→35→35→40→45→55→70%)와 CP·콜 롤오프(신뢰지수 구간 함수)는 보정값(CAL)이다. calibration.md에 앵커를 적었다.',
      '대시보드의 유동성비율은 게임 단순화 산식이며 금융투자업규정의 유동성비율과 다르다. 한빛증권은 현행 규제 대상(종투사·발행사)이 아니다.',
      '콜 한도 1,500억(자기자본 15%)은 두 가지를 단순화한 값이다. 실제 규칙인 금융투자협회 「금융투자회사의 리스크관리 모범규준」 제2-15조제2항은 15%를 월평균 상한으로 두고 일별 상한은 자기자본의 100%까지 허용한다. 또 2015년 3월 3일 이후 콜머니는 국고채전문딜러·한국은행 공개시장운영 대상기관 등에만 열려 있으므로, 한빛증권이 그 지정을 받은 중형사라고 가정했다.',
      '한빛증권은 한국은행 RP 매매 대상기관이 아니라고 가정했다. 대상기관인 대형 증권사에는 10/27 한은 RP 6조가 직접 창구였다.',
      '흥국생명 신종자본증권 콜옵션(11/1~11/9)의 자사 대응물로 후순위채 500억(11/15 콜)을 두었다. 증권사 후순위채 콜 미행사 사례는 2022년에 없었다.',
      '턴 사이의 정책 시행일(증권금융 10/26, 산은·한은 10/27, 한은 적격담보 11/1, 산은·증금 증권사 CP 11/11)은 T4(10/24)와 T5(11/1) 사이의 지연 효과·창구 개방 플래그로 압축했다.',
      '반사실 경로에서도 정책 사건(10/23 대책, 11/9 특례, 11/24 프로그램)은 같은 시점에 외생으로 발생한다. CP91·스프레드 등 시장 시계열은 플레이어 결정과 무관하게 불변이다.',
      'CP91(A1) 시계열은 확인된 앵커(9/22 3.15%, 11/7 4.92%, 11/25 5.50%, 12/1 5.54% 정점, 12/12 첫 하락) 사이를 보간한 값(CAL)이다 — 9/28·10/5·10/14·10/21·10/24·11/1·11/24는 관측값이 아니다. 국고채·회사채·CD는 한국은행 ECOS 시장금리(일별) 통계표 817Y002의 당일 최종호가수익률로 교체했다. 두 계열은 10월 초 11~18bp 차이가 나며(보간이 볼록한 실제 경로를 직선으로 대체), calibration.md §6에 일자별 대조표를 적었다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(금융위원회·한국은행 발표, 금융투자협회 채권정보센터, 감사원 감사결과, 자본시장연구원·한국신용평가 보고서, 언론 보도)를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'ncr',
      label: '순자본비율(NCR)',
      labelEn: 'NCR',
      unit: '%',
      primary: true,
      sparkline: true,
      description: '(영업용순자본 − 총위험액) / 필요유지자기자본. 100% 미만 권고, 50% 미만 요구',
      referenceLabel: '권고 100%',
      decimals: 0,
    },
    {
      metric: 'liquidityRatio',
      label: '유동성비율(게임 단순화)',
      labelEn: 'Liquidity Ratio',
      unit: '%',
      primary: true,
      sparkline: true,
      description:
        '(현금 + 미사용 라인 + 채권×0.9) / (30일 만기×(1−차환률) + 콜 + CP×0.5 + 마진콜)',
      referenceLabel: '내부 기준 100%',
      decimals: 0,
    },
    {
      metric: 'abcpMaturing30',
      label: '차환 만기 도래액(30일)',
      labelEn: 'ABCP Maturing (30d)',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '향후 4턴 만기 합계 — 차환 실패율을 곱하면 자체매입 예상액',
      decimals: 0,
    },
    {
      metric: 'cash',
      label: '현금',
      labelEn: 'Cash',
      unit: 'ccy',
      sparkline: true,
      description: '결제일(턴 시작)에 음수면 지급불능',
      decimals: 0,
    },
    {
      metric: 'abcpMaturingNext',
      label: '차환 만기 도래액(이번 턴)',
      labelEn: 'ABCP Maturing (this turn)',
      unit: 'ccy',
      decimals: 0,
    },
    {
      metric: 'rollRate',
      label: '차환 성공률',
      labelEn: 'Rollover Success Rate',
      unit: '%',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'abcpHeld',
      label: '자체 매입 ABCP',
      labelEn: 'ABCP Held',
      unit: 'ccy',
      sparkline: true,
      description: '위험값 100%(11/9 특례 후 32%)로 신용위험액에 가산',
      decimals: 0,
    },
    {
      metric: 'guaranteeToEquity',
      label: '매입확약 잔액/자기자본',
      labelEn: 'Guarantees / Equity',
      unit: '%',
      decimals: 0,
    },
    {
      metric: 'liquidAssets',
      label: '유동자산(현금+라인+채권×0.9)',
      labelEn: 'Liquid Assets',
      unit: 'ccy',
      decimals: 0,
    },
    {
      metric: 'ownCpRate',
      label: '자사 CP(A2) 발행금리',
      labelEn: 'Own CP Rate',
      unit: 'rate',
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'market.cp91',
      label: 'CP91(A1) 최종호가',
      labelEn: 'CP91 (A1)',
      unit: 'bp',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'confidence',
      label: '시장 신뢰지수',
      labelEn: 'Confidence Index',
      unit: 'index',
      sparkline: true,
    },
    {
      metric: 'regulatorLevel',
      label: '감독당국 단계',
      labelEn: 'Regulator Level',
      unit: 'index',
    },
  ],
  thresholds: {
    cash: { warn: 500, breach: 0, direction: 'below' },
    abcpMaturing30: { warn: 1500, breach: 2500, direction: 'above' },
    abcpHeld: { warn: 1500, breach: 3000, direction: 'above' },
    ownCpRate: { warn: 5.5, breach: 6.5, direction: 'above' },
    'market.cp91': { warn: 450, breach: 540, direction: 'above' },
  },
  turns: [...turnsA, ...turnsB],
  // 크기(magnitude) 노이즈만 — 분기는 만들지 않는다. variance 0에서는 엔진이 RNG를 당기지 않으므로
  // 체크포인트와 정본 경로는 불변이다. 근거는 calibration.md §13.5.
  noise: { runoffSigma: 0.15, runoffCap: 0.3, tickerSigma: 0.01, tickerSigmaBp: 2, eventJitter: 1 },
  gameOver: [
    {
      id: 'pca_require',
      when: { metric: 'ncr', lt: 50 },
      reason: 'pca_require',
      title: '경영개선요구 — 순자본비율 50% 미만',
      narrative:
        '순자본비율이 50% 아래로 떨어졌습니다. 금융위원회는 적기시정조치 2단계인 경영개선요구를 내렸고, 신규 신용공여 중단·자산 매각·자본 확충을 명령했습니다. 시장은 한빛증권 보증 물량 전체를 회피하기 시작했습니다.',
      failed: true,
      ruleText: '순자본비율(NCR)이 50% 미만이면 경영개선요구로 종료됩니다.',
    },
    {
      id: 'insolvent',
      when: { flag: 'insolvent' },
      reason: 'insolvent',
      title: '결제 실패 — 지급불능',
      narrative:
        '결제일 아침 현금이 음수인 채로 만기가 돌아왔습니다. 콜·CP 상환과 매입확약 결제가 이행되지 않았고, 금융투자협회와 금감원에 지급불능이 통보되었습니다. 매입확약을 지킬 현금이 없는 증권사는 신용공여 사업을 계속할 수 없습니다.',
      failed: true,
      ruleText:
        '결제 점검 시점(턴 시작, 틱이 있는 턴은 마감 집계)에 현금이 음수이면 지급불능으로 종료됩니다.',
    },
    {
      id: 'insolvent_final',
      when: { all: [{ turn: { gte: 8 } }, { metric: 'cash', lt: 0 }] },
      reason: 'insolvent',
      title: '연말 결제 실패 — 지급불능',
      narrative:
        '12월 만기 결제에서 현금이 부족했습니다. 연말 결산을 앞두고 지급불능이 확인되었습니다.',
      failed: true,
      ruleText: '마지막 턴(12/1~15)에 결정 후 현금이 음수이면 지급불능으로 종료됩니다.',
    },
    {
      id: 'market_exit',
      when: { all: [{ flag: 'abcp_default' }, { confidence: { lt: 30 } }] },
      reason: 'market_exit',
      title: '시장 퇴출 — 매입확약 불이행 후 신뢰 붕괴',
      narrative:
        '매입확약을 이행하지 않은 뒤 신뢰지수가 30 아래로 떨어졌습니다. 단기자금 데스크는 한빛증권 보증 물량과 자사 CP를 전면 회피하고, 콜 대여자는 한도를 회수했습니다. 보증기관의 신용이 사라진 증권사는 잔여 보증 물량의 차환을 한꺼번에 떠안게 되며, 금감원은 현장 검사와 제재 절차에 들어갔습니다.',
      failed: true,
      ruleText:
        '매입확약 불이행(abcp_default) 상태에서 신뢰지수가 30 미만이면 시장 퇴출로 종료됩니다.',
    },
    {
      id: 'pca_recommend',
      when: { metric: 'ncr', lt: 100, consecutiveTurns: 2 },
      reason: 'pca_recommend',
      title: '경영개선권고 — 순자본비율 100% 미만 지속',
      narrative:
        '순자본비율이 두 턴 연속 100%를 밑돌았습니다. 금융위원회는 적기시정조치 1단계인 경영개선권고를 내렸습니다. 신규 PF 신용공여가 중단되고 자본 확충·자산 매각 계획 제출이 요구됩니다. 시나리오는 여기서 종료됩니다 — 권고 자체가 시장에서는 "다음 정리 대상"으로 읽히기 때문입니다.',
      failed: true,
      ruleText: '순자본비율(NCR)이 2턴 연속 100% 미만이면 경영개선권고로 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'soft_landing',
      when: {
        all: [
          { metric: 'ncr', gte: 150, consecutiveTurns: 4 },
          { metric: 'liquidityRatio', gte: 100 },
        ],
      },
      title: '연착륙 — 차환의 벽을 넘다',
      narrative:
        '강원도가 2,050억을 상환하고(12월 12일 — 약속한 12월 15일보다 사흘 빨랐다) 사흘이 지난 지금, 한빛증권의 연말 결산 전망은 NCR 150% 이상·유동성비율 100% 이상이며, 11월의 만기 벽을 지나는 동안에도 NCR은 한 번도 150% 아래로 내려가지 않았습니다. 자체매입 잔액은 프로그램으로 줄였고 조달 구조는 확정 라인과 담보 조달로 옮겨 놓았습니다. 2023년 6월 특례가 끝나도 NCR은 버팁니다. 그러나 사업장의 사업성은 바뀌지 않았습니다 — 2023년의 위기는 차환이 아니라 사업성에서 옵니다.',
    },
    {
      id: 'survived_strained',
      when: { metric: 'ncr', gte: 120 },
      title: '생존 — 특례에 기댄 연말',
      narrative:
        '결제 실패 없이 12월을 넘겼습니다. 그러나 NCR은 위험값 32% 특례 위에 서 있고, 유동성비율은 내부 기준을 오르내립니다. 2023년 6월 특례가 끝나면 보유 ABCP 잔액이 다시 위험값 100%로 돌아옵니다. 당국은 이듬해 5월 유동화증권 대출 전환을 요구하게 됩니다 — 한빛증권은 그 대상이 될 것입니다.',
    },
    {
      id: 'survived_impaired',
      title: '생존 — 잠식된 자본',
      narrative:
        '살아남았지만 자본이 잠식되었습니다. NCR은 권고 기준 바로 위에서 연말을 맞고, 매각손·평가손과 자체매입 잔액이 영업용순자본을 갉아먹었습니다. 특례 종료와 함께 2023년 상반기 적기시정조치 대상이 될 가능성이 큽니다. 시장은 한빛증권을 "다음"으로 보고 있습니다.',
    },
  ],
  scoring: legoScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-e'],
        't1-d1': ['t1-d1-a'],
        't1-d2': ['t1-d2-c'],
        't2-d1': ['t2-d1-a'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-d1-a'],
        't3-d2': ['t3-d2-b'],
        't3-d3': ['t3-d3-d'],
        't4-d1': ['t4-d1-a'],
        't4-d2': ['t4-d2-a'],
        't4-d3': ['t4-d3-a'],
        't5-d1': ['t5-d1-a'],
        't5-d2': ['t5-d2-a'],
        't5-d3': ['t5-d3-a'],
        't6-d1': ['t6-d1-a'],
        't6-d2': ['t6-d2-a'],
        't7-d1': ['t7-d1-a'],
        't7-d2': ['t7-d2-a'],
        't8-d1': ['t8-d1-a'],
        't8-d2': ['t8-d2-c'],
      },
      note: '중형 증권사의 실제 대응 순서: 부도 전 관망 → 차환 실패분 자체매입(매입확약 이행) → CP 발행·은행 라인 인출 → 익스포저 침묵 → 증권금융 신청·이용 → 콜 행사·고금리 차환 → 희망퇴직·자회사 매각 → 11/24 프로그램 매각 → 현상 유지. 체크포인트: CP91 11/7 492bp·12/1 554bp(외생), 자체매입 누적 ≈2,400억(CAL 1,900~2,900), NCR 저점 ≈120%(T5, CAL), 결제 실패 없음.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-a', 't0-b', 't0-c'],
        't1-d1': ['t1-d1-b'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-d1-b'],
        't2-d2': ['t2-d2-a', 't2-d2-d'],
        't3-d1': ['t3-d1-b'],
        't3-d2': ['t3-d2-a'],
        't3-d3': ['t3-d3-b'],
        't4-d1': ['t4-d1-b'],
        't4-d2': ['t4-d2-a', 't4-d2-c'],
        't4-d3': ['t4-d3-a'],
        't5-d1': ['t5-d1-b'],
        't5-d2': ['t5-d2-a', 't5-d2-c'],
        't5-d3': ['t5-d3-a'],
        't6-d1': ['t6-d1-a'],
        't6-d2': ['t6-d2-a'],
        't7-d1': ['t7-d1-a'],
        't7-d2': ['t7-d2-d'],
        't8-d1': ['t8-d1-a'],
        't8-d2': ['t8-d2-a'],
      },
      note: 'T0 실사·신규 중단 + 라인 확대 + 만기 분산 → 만기 연장 협상(T1~T5) + 확정 라인 조기 인출·RP → 유동성비율 100% 이상에서 상세 공시(T3) → 증권금융 즉시 신청 + 은행 담보대출(T4) → 증금·라인 증액 + 콜 행사·차환(T5) → 특례 후 이행 + 자회사 매각(T6) → 프로그램 매각·콜/CP 상환(T7) → 대출 전환·한도 공시(T8).',
    },
  },
  checkpoints: [
    {
      turnId: 't6',
      metric: 'market.cp91',
      expected: 492,
      tolerance: 0.05,
      label: 'CP91(A1) 11/7 4.92% (금투협 채권정보센터)',
    },
    {
      turnId: 't8',
      metric: 'market.cp91',
      expected: 554,
      tolerance: 0.05,
      label: 'CP91(A1) 12/1 정점 5.54% (금투협 채권정보센터)',
    },
    {
      turnId: 't2',
      metric: 'market.creditSpreadAA',
      expected: 111,
      tolerance: 0.05,
      label:
        '회사채 AA- − 국고 3년 10/14 111.3bp = 5.320% − 4.207% (2009.9 이후 최대; 민평 기준 114.5bp)',
    },
    {
      turnId: 't3',
      metric: 'market.corpAA3y',
      expected: 574,
      tolerance: 0.05,
      label: '회사채 AA- 3년 10/21 5.736% 정점',
    },
    {
      turnId: 't8',
      counter: 'abcpBought',
      expected: 2400,
      tolerance: 0.2,
      label:
        '역사 경로 자체매입 누적 ≈2,400억 (CAL 밴드 1,900~2,900: 만기 4,450억 × 차환 실패율 35~65%)',
    },
    {
      turnId: 't5',
      metric: 'ncr',
      expected: 120,
      tolerance: 0.15,
      label:
        '역사 경로 NCR 저점 ≈120% (11/1, 특례 전; CAL: 중소형사 NCR 압박·R2 도달, 권고 기준 100% 상회)',
    },
  ],
  debrief: legoDebrief,
})

export default scenario
