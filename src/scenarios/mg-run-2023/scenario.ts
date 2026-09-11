import type { BankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { mgDebrief } from './debrief'
import { mgInitialBank, mgInitialConfidence, mgInitialMarket } from './initialState'
import { mgScoring } from './scoring'
import { MG_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<BankState> = defineScenario<BankState>({
  meta: {
    id: 'mg-run-2023',
    version: 1,
    title: '금고 앞의 줄',
    subtitle: '2023년 7월 새마을금고 예금인출',
    era: '2023-07',
    year: 2023,
    region: 'korea',
    role: 'regulator_official',
    roleTitle: '범정부 대응단 담당관 겸 중앙회 자금담당',
    institutionType: 'bank',
    institutionName: '상호금융 중앙회(가상)',
    modelledOn:
      '새마을금고중앙회 + 1,293개 지역금고 (2023-06-29 잠정치·2023-06-30 상반기 실적, 2023-07-04~17 사건 기록)',
    difficulty: 'intro',
    durationTurns: 7,
    turnUnit: 'day',
    estMinutes: 30,
    timezone: 'Asia/Seoul',
    learningObjectives: [
      {
        id: 'lo1',
        text: '검증 가능한 수치와 법이 보장하는 범위까지의 약속으로 소통하고, 조건부 안심 발언·정보 공백·명단 공개의 역효과를 구분한다.',
        competency: 'communication',
        decisionIds: ['t0-d1', 't2-d1', 't3-d2', 't5-d2'],
      },
      {
        id: 'lo2',
        text: '상환준비금·현금성자산·은행 RP·채권 매도의 조달 순서를 이해하고, 최종대부자 접근성이 없는 기관의 우회 경로를 위기 전에 확보한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d2', 't2-d2', 't4-d2'],
      },
      {
        id: 'lo3',
        text: '개별법 예금자보호(5천만원)와 P&A 전액 보장의 차이, 재예치 인센티브의 효과와 도덕적 해이 트레이드오프를 설명한다.',
        competency: 'policy',
        decisionIds: ['t3-d1', 't4-d1', 't5-d1'],
      },
      {
        id: 'lo4',
        text: '지급 유예가 왜 즉시 감독 개입 사유인지, 그리고 위기 대응 거버넌스(범정부 대응단)와 감독체계·지배구조 개편의 관계를 안다.',
        competency: 'compliance',
        decisionIds: ['t1-d1', 't1-d2', 't6-d1'],
      },
    ],
    competencies: { communication: 3, liquidity: 2, policy: 2, compliance: 1 },
    tags: ['뱅크런', '예금자보호', 'RP', '커뮤니케이션', '상호금융'],
    sources: MG_SOURCES,
  },
  units: { currency: 'KRW', scale: 1e12, display: '조원' },
  initialState: {
    institution: mgInitialBank,
    market: mgInitialMarket,
    confidence: mgInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: { startDeposits: 259.6, amplifier: 1, dampener: 1, useKrLcr: 1 },
  },
  briefing: {
    situation: `2023년 7월 4일 화요일. 귀하는 **범정부 대응단 담당관**이자 **상호금융 중앙회 자금담당**입니다. 중앙회와 1,293개 지역금고는 예수금 259.6조원의 수신기관이지만 은행이 아닙니다 — 예금자보호법(예보)이 아닌 새마을금고법상 중앙회 준비금으로 1인당 5천만원이 보호되고, 감독은 금융위가 아닌 행정안전부가 맡으며, 한국은행 RP 창구는 열려 있지 않습니다.

연체율은 2022년 말 3.59%에서 6월 말 6%대로 뛰었고, 건설·부동산 대출이 집중되어 있습니다. 오늘 행안부는 연체율 상위 100개 금고 특별점검을 발표했습니다. 내일이면 남양주동부금고의 합병 공시가 나갑니다.

시나리오는 7턴, 일 단위입니다: 7/4(화) 프롤로그 → 7/5(수) 합병 공시 → 7/6(목) 합동 브리핑 → 7/7(금) 재예치 → 7/10(월) 실무지원단·은행 RP → 7/14(금) 재예치 확대 → 7/17(월) 감독체계.`,
    mandate: `**권한**: 중앙회의 자금 운용(상환준비금 지원, 채권 매도, 은행 RP 협의)과 정부의 커뮤니케이션·조치(브리핑 메시지, 재예치 조치, 부실 금고 처리 원칙, 대응 체계)를 결정합니다. 법 개정이 필요한 사항(감독권 이관, 정부 보증)은 "추진"만 할 수 있습니다. 한국은행 RP·긴급여신은 이번 주 안에 열리지 않습니다. 인출 지연·지급 유예는 어떤 상황에서도 선택지가 아닙니다.

**목표**: 지급 정지 없이 7월 17일까지 인출을 진정시키고(일 인출 0.8조 미만, 신뢰지수 60 이상), 신뢰·감독 관계·시장 안정을 보전하십시오.`,
    institutionProfile: `| 항목(조원) | 중앙회+금고 | 비고 |
|---|---|---|
| 상환준비금·가용현금 | 30.7 | 상환준비금 13.36 + 즉시 가용 17.3 [CAL] |
| 국고채·통안채 | 40 | RP 담보 적격 [CAL] |
| 은행채·기타 채권 | 20 | [CAL] |
| 대출 | 196.4 | 건설·부동산 56.4(1월말 기준), 연체액 12.16 |
| 총자산 | 290.7 | 6월 말 |
| 예수금 | 259.6 | 6/29 |
| 순자본 | 24.1 | 순자본비율 8.29% |
| 예금자보호준비금 | 2.6 | 1인당 5천만원 보호 재원 |
| 담보차입 여력 | 0 | 한은 RP 대상 아님, 은행 RP 라인 없음 |

**예금 세그먼트(양식화)**: 5천만원 이하 보호 예금 195 · 5천만원 초과 개인 40 · 부실 우려 금고(검사·점검 대상 100개) 12 · 법인·단체 12.6.

**알려진 취약점(7/4 기준)**: 연체율 6.18%(잠정), 건설·부동산 대출 집중, 예보 미가입 인식 격차, 행안부 단독 감독, 최종대부자 접근 불가.`,
    marketBackdrop: `한은 기준금리는 3.50%로 1월 이후 동결 중이고 국고 3년물은 3.6%대입니다. 지난해 10월 레고랜드 사태 이후 비은행 PF 익스포저가 시장의 관심사이며, 3월 미국 지역은행 위기로 "디지털 런"이 새 상식이 되었습니다. 저축은행·상호금융의 PF 연체율 상승이 보도되고 있지만 채권시장은 아직 조용합니다.`,
    stakeholders: [
      {
        name: '행정안전부',
        wants: '소관 부처로서 사태 수습, 감독권 유지',
        canDo: '특별점검·검사, 합병·인가취소, 브리핑 주관',
      },
      {
        name: '금융위원회·금융감독원·예금보험공사',
        wants: '금융시스템 안정, 정확한 수치, 정리 원칙(P&A) 준수',
        canDo: '검사 인력 지원, 수치 검증, 실무지원단 참여, P&A 설계 자문',
      },
      {
        name: '한국은행',
        wants: '시장 안정, 법적 근거 없는 지원 회피',
        canDo: '65조 긴급여신(금통위 의결, 수일 소요) — 이번 주 직접 지원 불가',
      },
      {
        name: '5대 은행·산업은행·기업은행',
        wants: '담보 안전성, 시스템 안정',
        canDo: '국고채·통안채 담보 RP 매입(6조 안팎, 약정 후 당일 결제)',
      },
      {
        name: '지역금고 이사장',
        wants: '창구 현금, 명단 비공개, 자율성',
        canDo: '상환준비금 지원 요청, 창구 운영(지급 지연은 불가)',
      },
      {
        name: '예금자',
        wants: '원리금 확실성, 5천만원 초과분의 보호 여부',
        canDo: '창구·ATM 인출, 중도해지, 재예치',
      },
      {
        name: '언론·SNS',
        wants: '속보, 대기 행렬 사진',
        canDo: '수 시간 내 확산, 정보 공백을 추측으로 채움',
      },
    ],
    regulatoryFramework: `- **예금자보호**: 새마을금고법상 중앙회 예금자보호준비금(2.6조)으로 1인당 원리금 5천만원. 예금자보호법(예보) 부보기관이 아님. 합병·P&A 시 예금은 5천만원 초과분까지 승계.
- **감독**: 행정안전부 소관(새마을금고법). 금융위·금감원은 협력·지원 형태로만 참여 가능.
- **한국은행법**: 65조 긴급여신(유동성 악화 금융기관, 임시 적격담보, 금통위 4명 이상 찬성·정부 의견 청취), 80조 영리기업 여신, 68조 공개시장운영(RP). 중앙회는 RP 대상기관이 아님.
- **건전성**: 상호금융 유동성비율 100%(자산 1천억 이상), 순자본비율 기준 4%. **업종별 대출 한도는 없다** — 건설·부동산 각 30%/합산 50% 한도는 신협·농협·수협에 2022.1.12부터 적용 중이지만 새마을금고 감독기준에는 아직 도입되지 않았다.
- **감독당국 반응 R0~R4**: 강화 모니터링 → 제한 → 정리 준비 → 정부 직접 개입. 인출 지연·지급 유예·허위 공표는 즉시 R4.`,
    cardRefs: [
      'mutual-credit-deposit-protection',
      'korea-crisis-toolkit',
      'crisis-communication',
      'bank-run-dynamics',
      'uninsured-deposits-and-run-speed',
      'regulator-escalation-ladder',
    ],
    simplificationNotes: [
      '상호금융 중앙회(가상)는 새마을금고중앙회와 1,293개 지역금고를 하나의 수신기관으로 합성한 것이다. 상환준비금 지원 등 중앙회↔금고 거래는 내부 거래로 취급한다.',
      '현금성자산 77.3조의 구성(즉시 가용 17.3 / 국고채·통안채 40 / 은행채·기타 20)은 공개되지 않아 보정값이다(calibration.md).',
      '예금 세그먼트 4개와 일일 유출률은 양식화·보정된 값이다. 5천만원 초과 예금 비중(≈25%)은 공개 통계가 아니다.',
      '순자본비율 8.29%는 순자본/총자산으로 근사했고, RWA는 총자산과 같게 두었다.',
      '채권 매도 1.6조는 2차 출처다. 널리 인용되는 "7~8월 17조 인출"은 부정확한 표현이며, 한국은행 ECOS 111Y007(새마을금고 수신 말잔)로 확인한 사실은 **7월 한 달 △17.61조(6월말 259.46조 → 7월말 241.86조)이고 8월은 +1.86조 순유입(243.72조)**이다. 게임의 누적 유출 체크포인트(6~10조)는 7/5~7/17 9영업일분이므로 이 월간 총액과 정합적이다.',
      '시장 배경(국고채·CD·환율)은 엔진 계산에 쓰이지 않는 참고값이다. 틱 턴(T1·T2·T4)의 원/달러·국고채 일중 궤적은 시가·고가·저가·종가만 실측(ECOS)이고 시각별 배열은 양식화한 것이다.',
      '창구 하루의 시간대별 인출 분포(틱 프로필)는 공개된 자료가 없어 양식화한 값이다. variance 0에서 슬라이스 합계는 하루치 단일 계산과 일치한다.',
      '2024년 이후의 제도 변화(감독협력 MOU, 한은 RP 대상기관 편입, 예금보호한도 1억원)는 엔딩과 디브리핑에서만 다룬다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(관계부처 합동 브리핑, 금융위원회·행정안전부 보도자료, 한국은행법, 언론 보도)를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'cash',
      label: '상환준비금·가용현금',
      labelEn: 'Reserve Fund & Usable Cash',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '음수면 지급 정지',
      decimals: 1,
    },
    {
      metric: 'dailyOutflow',
      label: '당일 예금 순유출',
      labelEn: 'Daily Net Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '마지막 영업일 기준',
      decimals: 2,
    },
    {
      metric: 'cumulativeOutflow',
      label: '누적 예금 순유출',
      labelEn: 'Cumulative Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'confidence',
      label: '대중 신뢰지수',
      labelEn: 'Public Confidence Index',
      unit: 'index',
      sparkline: true,
    },
    {
      metric: 'facilityHeadroom',
      label: '은행 RP 여력(당일)',
      labelEn: 'Bank RP Headroom',
      unit: 'ccy',
      decimals: 1,
    },
    { metric: 'deposits', label: '총예수금', labelEn: 'Deposits', unit: 'ccy', decimals: 1 },
    {
      metric: 'dailyOutflowPct',
      label: '당일 유출률',
      labelEn: 'Daily Outflow %',
      unit: '%',
      decimals: 2,
    },
    {
      metric: 'delinquencyRate',
      label: '연체율',
      labelEn: 'Delinquency Rate',
      unit: '%',
      decimals: 2,
      description: '6/29 잠정치 — 플레이어가 통제하지 않는 지표',
    },
    {
      metric: 'market.govt3y',
      label: '국고채 3년(bp)',
      labelEn: 'KTB 3Y (bp)',
      unit: 'bp',
      sparkline: true,
      decimals: 0,
      description:
        '중앙회 채권 매도와 시장 금리 — 틱 턴(T1·T2·T4)에서는 일중 궤적으로 움직인다 [ecos-817Y002]',
    },
    {
      metric: 'regulatorLevel',
      label: '감독당국 단계',
      labelEn: 'Regulator Level',
      unit: 'index',
    },
  ],
  thresholds: {
    cash: { warn: 10, breach: 0, direction: 'below' },
    dailyOutflow: { warn: 1, breach: 2, direction: 'above' },
    cumulativeOutflow: { warn: 8, breach: 15, direction: 'above' },
    facilityHeadroom: { warn: 3, breach: 0, direction: 'below' },
    dailyOutflowPct: { warn: 0.4, breach: 0.8, direction: 'above' },
  },
  turns: [...turnsA, ...turnsB],
  // 크기(magnitude) 노이즈만 — 분기는 만들지 않는다. variance 0에서는 엔진이 RNG를 당기지 않으므로
  // 체크포인트와 정본 경로는 불변이다. 근거는 calibration.md §9.4.
  noise: { runoffSigma: 0.15, runoffCap: 0.3, tickerSigma: 0.01, tickerSigmaBp: 2, eventJitter: 1 },
  gameOver: [
    {
      id: 'unsafe_act',
      when: { regulator: { gte: 4 } },
      reason: 'unsafe_act',
      title: '정부 직접 개입 — 지급 유예 사태',
      narrative:
        '창구에서 지급이 유예되었다는 사실이 SNS로 퍼졌습니다. 정부는 대응단을 해산하고 금고 전반에 직접 개입했습니다. "못 준다"는 소문이 사실이 된 이상 어떤 브리핑도 소용이 없습니다.',
      failed: true,
      ruleText: '감독당국 단계가 R4에 도달하면 종료됩니다 (지급 유예·인출 지연·허위 공표).',
    },
    {
      id: 'suspension',
      when: { metric: 'cash', lt: 0 },
      reason: 'suspension',
      title: '상환준비금 소진 — 지급 정지',
      narrative:
        '상환준비금과 가용현금이 바닥났습니다. 담보를 현금으로 바꾸기 전에 창구가 먼저 비었고, 복수 금고에서 지급이 멈췄습니다. 정부가 지급 정지와 정리 절차를 발표했습니다.',
      failed: true,
      ruleText: '상환준비금·가용현금이 음수가 되면 지급 정지로 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'calmed',
      when: {
        all: [
          { metric: 'dailyOutflow', lt: 0.8 },
          { metric: 'confidence', gte: 60 },
        ],
      },
      title: '진정 — 줄이 짧아지다',
      narrative:
        '7월 17일 월요일, 일 인출은 수천억 수준으로 내려왔고 재예치가 이어지고 있습니다. 지급은 단 하루도 멈추지 않았습니다. 그러나 연체율과 부동산 PF 집중, 지배구조 문제는 하나도 바뀌지 않았습니다. 이후 경영혁신안(11월), 금융당국과의 감독협력 제도화(이듬해 2월), 한국은행 RP 대상기관 편입(이듬해 8월)이 뒤따랐지만 2024년 말 연체율은 다시 6.8%로 올랐습니다. 런을 멈추는 것과 부실을 해결하는 것은 다른 문제입니다.',
    },
    {
      id: 'delayed',
      title: '진정 지연 — 줄은 남아 있다',
      narrative:
        '7월 17일에도 인출은 잦아들지 않았거나 신뢰는 회복되지 않았습니다. 지급은 이어졌지만 매일의 줄이 다음 날의 뉴스가 되는 상태가 계속됩니다. 8월 실적 발표까지 버틸 현금은 있으나, 시장은 "다음 금고"를 찾고 있습니다.',
    },
  ],
  scoring: mgScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-d1-a'],
        't0-d2': ['t0-d2-a'],
        't1-d1': ['t1-d1-a'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-d1-a'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-d1-a'],
        't3-d2': ['t3-d2-a'],
        't4-d1': ['t4-d1-a'],
        't4-d2': ['t4-d2-a'],
        't5-d1': ['t5-d1-a'],
        't5-d2': ['t5-d2-b'],
        't6-d1': ['t6-d1-a'],
      },
      note: '실제 순서: 7/5 표준 합병 공시 → 7/6 합동 브리핑(수치 공개·전액 지급 약속) + 채권 1.6조 매도 → 7/7 재예치·장차관 예금 → 7/10 실무지원단·P&A 원칙 + 은행 RP 6조 → 7/14 재예치 확대 → 감독 협력 강화. 체크포인트: 7/6 일 인출 1~2조 밴드, 7/17 일 인출 0.6~0.7조, 누적 6~10조, 현금 음수 없음.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-d1-b'],
        't0-d2': ['t0-d2-b'],
        't1-d1': ['t1-d1-a'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-d1-a'],
        't2-d2': ['t2-d2-c'],
        't3-d1': ['t3-d1-a'],
        't3-d2': ['t3-d2-a'],
        't4-d1': ['t4-d1-a'],
        't4-d2': ['t4-d2-a'],
        't5-d1': ['t5-d1-a'],
        't5-d2': ['t5-d2-b'],
        't6-d1': ['t6-d1-b', 't6-d1-d'],
      },
      note: '보장 범위·수치 동반 공시(T0) + RP 라인 사전 협의 → 정시 지급·범정부 대응단 → 검증 가능한 브리핑 + RP(채권 매도 없음) → 재예치·퍼포먼스 → P&A 원칙·RP 공표 → 재예치 확대·기준 공개 → 감독권 이관 추진 + 경영혁신.',
    },
  },
  checkpoints: [
    {
      turnId: 't2',
      metric: 'dailyOutflow',
      expected: 1.8,
      tolerance: 0.35,
      label: '7/6 일 인출 피크 ≈1.8조 (1~2조 밴드, CAL: 7/7 "전일比 −1조"에서 역산)',
    },
    {
      turnId: 't6',
      metric: 'dailyOutflow',
      expected: 0.65,
      tolerance: 0.3,
      label: '7/17 일 인출 6,000~7,000억',
    },
    {
      turnId: 't6',
      metric: 'cumulativeOutflow',
      expected: 8,
      tolerance: 0.25,
      label: '7/5~7/17 누적 인출 6~10조 (CAL 밴드)',
    },
  ],
  debrief: mgDebrief,
})

export default scenario
