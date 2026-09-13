import type { BankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { svbDebrief } from './debrief'
import { svbFundingPlan } from './funding'
import { BTFP_KNOWN_AT, withSvbInformation } from './information'
import { svbInitialBank, svbInitialConfidence, svbInitialMarket } from './initialState'
import { svbScoring } from './scoring'
import { SVB_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<BankState> = defineScenario<BankState>({
  meta: {
    id: 'svb-2023',
    version: 1,
    title: '퍼시픽밸리은행: 48시간',
    subtitle: '2023년 3월 실리콘밸리은행 예금인출 사태',
    era: '2023-03',
    year: 2023,
    region: 'global',
    role: 'bank_treasurer',
    roleTitle: '최고리스크책임자 겸 자금담당임원(CRO/Treasurer)',
    institutionType: 'bank',
    institutionName: '퍼시픽밸리은행(Pacific Valley Bank)',
    modelledOn:
      'SVB Financial Group / Silicon Valley Bank (2022-12-31 연결 재무제표, 2023-03-08~13 사건 기록)',
    difficulty: 'standard',
    durationTurns: 9,
    turnUnit: 'hour',
    estMinutes: 40,
    timezone: 'America/Los_Angeles',
    learningObjectives: [
      {
        id: 'lo1',
        text: '30일 규제지표(LCR)와 당일 런 여력의 차이를 이해하고, 담보 사전 예치·FHLB vs 재할인창구 메커니즘과 컷오프를 적용한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d1', 't3-d1', 't5-d1', 't8-d1'],
      },
      {
        id: 'lo2',
        text: 'AOCI 옵트아웃, HTM tainting, "규제자본 양호/경제자본 소멸"의 의미와 증자 순서·백스톱의 역할을 설명한다.',
        competency: 'solvency',
        decisionIds: ['t0-d1', 't1-d1', 't3-d2', 't8-d2'],
      },
      {
        id: 'lo3',
        text: '듀레이션·헤지 해제·랠리 중 헤지의 금리리스크를 평가하고, 유동성 사건에서 헤지의 한계를 인식한다.',
        competency: 'marketRisk',
        decisionIds: ['t0-d1', 't8-d1'],
      },
      {
        id: 'lo4',
        text: '검증 가능한 여력에 기반한 위기 커뮤니케이션과 안심 메시지의 차이, 네트워크 효과를 이해한다.',
        competency: 'communication',
        decisionIds: ['t2-d1', 't4-d1', 't7-d1'],
      },
      {
        id: 'lo5',
        text: '감독당국 에스컬레이션, 질서/무질서 폐쇄, FDIC 주말 정리, 시스템리스크 예외, BTFP 조건을 안다.',
        competency: 'compliance',
        decisionIds: ['t4-d2', 't5-d1', 't6-d1', 't7-d1'],
      },
    ],
    competencies: { liquidity: 3, solvency: 2, communication: 2, compliance: 2, marketRisk: 1 },
    tags: ['뱅크런', 'LCR', 'HTM', '재할인창구', 'BTFP', '디지털 런'],
    sources: SVB_SOURCES,
  },
  units: { currency: 'USD', scale: 1e9, display: 'B' },
  // 변동성(variance > 0)에서만 사용된다. variance 0(테스트·체크포인트 정본)에서는 RNG를 아예 당기지 않는다.
  noise: { runoffSigma: 0.15, runoffCap: 0.3, tickerSigma: 0.01, tickerSigmaBp: 2, eventJitter: 1 },
  initialState: {
    institution: svbInitialBank,
    market: svbInitialMarket,
    confidence: svbInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: { startDeposits: 173, amplifier: 1, dampener: 1, backstopPct: 0 },
  },
  briefing: {
    situation: `2023년 2월 27일 월요일. 귀하는 **퍼시픽밸리은행(PVB)**의 최고리스크책임자 겸 자금담당임원입니다. PVB는 벤처캐피털 생태계에 특화된 총자산 $212B의 은행으로, 예금의 94%가 예금보험 한도를 초과하는 무보험 예금입니다.

2020~21년 예금이 $60B에서 $190B로 불어나는 동안 은행은 장기 기관 MBS와 국채를 대량 매입했고, 2022년 연준의 급격한 금리 인상으로 만기보유(HTM) 증권 $91B에 약 $15B의 미실현손실이 생겼습니다. 규제자본비율은 요건을 크게 상회하지만, 미실현손실을 빼면 경제적 자기자본은 거의 0입니다. VC 투자 둔화로 고객들은 현금을 소진하고 있고 예금은 매달 줄고 있습니다. 무디스는 등급 검토에 들어갔습니다.

시나리오는 9턴입니다: 2월 27일 프롤로그(준비) → 3월 8일 발표 → 3월 9일 개장·정오·마감 → 3월 10일 개장 전 → 주말 → 3월 13일 월요일.`,
    mandate: `**권한**: 이사회 한도 내 자금조달·담보·헤지·증권 매각을 실행할 수 있습니다. 증자·은행 매각·공시는 CEO/이사회 승인이 필요합니다(게임에서는 신뢰지수 20 이상이면 승인). 인출 정지, 은행 휴일 선포, 아직 존재하지 않는 창구 사용은 불가능합니다.

**목표**: 은행을 3월 13일까지 영업 상태로 유지하면서 자본·신뢰·규제 관계를 보전하십시오. 생존이 불가능하다면 무질서한 폐쇄보다 질서 있는 정리가 낫습니다.`,
    institutionProfile: `| 항목($B) | PVB | 비고 |
|---|---|---|
| 현금·지준 | 14 | |
| AFS(공정가) | 26 | 미실현손실 ≈2.9, 듀레이션 3.6y |
| HTM(상각원가) | 91 | 공정가 76, 미실현손실 15.1, 듀레이션 6.2y |
| 대출(순) | 74 | |
| 총자산 | 212 | |
| 예금 | 173 | 무보험 94% |
| FHLB 차입 | 15 | 1년 전 0 |
| 장기채 | 5.4 | |
| 자본 | 16.3 | 보통주 12.7 + 우선주 3.6 |
| CET1 비율 | 12.0% | AOCI 옵트아웃(Cat IV) |
| **경제적 유형자기자본** | **≈ 0** | 미실현손실 차감 시 |

**예금 세그먼트(양식화)**: VC 스타트업 $90B(네트워크 조율, 디지털) · 대형 테크·펀드 $58B(운영성) · 보험·스윕 $10B · 프라이빗뱅크 $15B.

**알려진 취약점(2월 27일 기준 인지 수준)**: 재할인창구 사전 예치 담보 없음, 2022년 헤지 해제, 내부 유동성 스트레스테스트 가정 변경, 감독 지적사항 31건.`,
    marketBackdrop: `연준은 2022년 3월 이후 450bp를 인상했고 2월 1일 4.50~4.75%로 올렸습니다. 2년물 국채는 4.8%, 곧 5%를 넘어 16년 최고를 기록할 참입니다. 은행 보유 채권의 평가손실은 업계 전체로 $600B 이상으로 추정됩니다. 암호화폐 은행 실버게이트는 10-K 제출을 연기했고 존속 능력에 의문이 제기되고 있습니다. 시장은 아직 조용합니다.`,
    stakeholders: [
      {
        name: '이사회',
        wants: '규제자본 유지, 주가 방어, 명성 보호',
        canDo: '증자·매각 승인, 경영진 교체',
      },
      {
        name: 'FRB 샌프란시스코 · 캘리포니아 DFPI · FDIC',
        wants: '예금자 보호, 질서 있는 대응, 조기 보고',
        canDo: '감독 단계 상향, 배당 제한, 폐쇄·관재 지정, 야간 창구 지원',
      },
      {
        name: 'VC 투자자와 포트폴리오 스타트업',
        wants: '예금 안전, 급여 지급 확실성',
        canDo: '수 시간 내 잔액 전액 이체, 네트워크 조율',
      },
      {
        name: 'FHLB 샌프란시스코',
        wants: '담보 충족, 리엔 우선권',
        canDo: '기설정 담보 대비 당일 대출, 리엔 후순위화(연준 대출 전제)',
      },
      {
        name: '골드만삭스(자문·인수단)',
        wants: '거래 성사, 리스크 회피',
        canDo: 'AFS 블록 인수, 북빌딩, 백스톱(사전 협상 시)',
      },
      { name: '언론·소셜미디어', wants: '속보', canDo: '수 분 내 확산, 소문 증폭' },
    ],
    regulatoryFramework: `- **LCR/NSFR**: 2019년 tailoring으로 Category IV(자산 $100~250B)인 PVB는 완전한 LCR 적용 대상이 아닙니다. 대시보드의 LCR은 "내부 참고" 지표입니다.
- **자본**: CET1 4.5% + CCB 2.5%. Category IV는 **AOCI 옵트아웃**으로 AFS 미실현손실이 CET1에 반영되지 않습니다.
- **PCA(즉시시정조치)**: 유형자기자본/총자산 ≤ 2%면 "critically undercapitalized" → 관재.
- **재할인창구(1차 신용)**: FF 상단 금리, 최장 90일, 시가−마진 담보, 사전 예치·테스트 거래 필요. CAMELS 강등 시 2차 신용(+50bp, 제한).
- **FHLB**: 기설정 담보 대비 당일 대출, 컷오프 존재. 연준 대출 전 FHLB 리엔 후순위화 필요.
- **HTM 회계(ASC 320)**: HTM 매각 시 전체 포트폴리오 tainting → AFS 재분류.
- **정리**: 주 감독당국(DFPI) 폐쇄 → FDIC 관재 → 최소비용 원칙 P&A/브릿지뱅크/DINB. 시스템리스크 예외는 재무부·연준·FDIC 3자 결정.
- **감독 단계 R0~R4**: 강화 모니터링 → 제한 → 정리 준비 → 폐쇄. 인출 지연·거부, 허위 공표는 즉시 R4.`,
    cardRefs: [
      'lcr-basics',
      'uninsured-deposits-and-run-speed',
      'afs-htm-aoci',
      'discount-window-fhlb-btfp',
      'contingency-funding-plan',
      'economic-vs-regulatory-capital',
    ],
    simplificationNotes: [
      'PVB는 SVB Financial Group 2022-12-31 연결 재무제표를 반올림한 합성 기관이며, 예금 세그먼트와 일일 유출률은 양식화·보정된 값이다(calibration.md).',
      '3월 9일 $42B의 일중 분포(오전 55%/오후 45%와 그 안의 정시 단위 프로필)는 양식화. 실제 시각별 인출 자료는 공개되지 않았다.',
      '일중 시세(주가·2년물·KRE)는 그날의 종가를 앵커로 한 양식화된 궤적이다. 시간대별 실제 시세를 재현한 것이 아니다.',
      '전화·데스크 인터럽트의 대사는 공개 기록을 바탕으로 재구성한 것이며 녹취·속기록이 아니다.',
      '기설정 담보차입 여력 $6.4B는 역사 경로가 마감 잔고 −$958M을 재현하도록 역산한 값이다.',
      '무디스·골드만·VC의 발언은 공개 기록을 바탕으로 각색한 것이다.',
      '세율 25%, 약정 한도 $60B, 대출 세그먼트 배분은 단순화된 가정이다.',
      '생존 분기(반사실)에서는 시그니처·퍼스트리퍼블릭 사태와 시스템리스크 예외·BTFP 신설을 외생 사건으로 유지한다. 실제로는 이들 조치가 SVB 폐쇄에 대한 대응이었으므로, PVB가 생존한 세계에서 같은 시점에 같은 조치가 나왔을지는 가정이다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(SEC 공시, 연준·FDIC·DFPI·GAO 보고서)를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'survivalDays',
      label: '생존 일수',
      labelEn: 'Survival Days',
      unit: 'days',
      primary: true,
      sparkline: true,
      description: '(현금 + 당일 담보차입 여력) ÷ 예상 일일 순유출',
      decimals: 1,
    },
    {
      metric: 'cash',
      label: '현금·연준 잔고',
      labelEn: 'Cash & Reserves',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '마감 시 음수면 결제 실패',
      decimals: 1,
    },
    {
      metric: 'cumulativeOutflow',
      label: '누적 예금 유출',
      labelEn: 'Cumulative Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'facilityHeadroom',
      label: '담보차입 여력(인출 가능)',
      labelEn: 'Drawable Secured Headroom',
      unit: 'ccy',
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'facilityPending',
      label: '담보차입 여력(반영 대기)',
      labelEn: 'Headroom (pending)',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'projectedDailyOutflow',
      label: '예상 일일 순유출',
      labelEn: 'Projected Daily Outflow',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'lcr',
      label: '유동성커버리지비율(LCR, 내부)',
      labelEn: 'LCR (internal)',
      unit: '%',
      sparkline: true,
      referenceLabel: '참고 100%',
      decimals: 0,
    },
    {
      metric: 'cet1Ratio',
      label: '보통주자본비율(CET1)',
      labelEn: 'CET1 Ratio',
      unit: '%',
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'economicTce',
      label: '경제적 유형자기자본비율',
      labelEn: 'Economic TCE',
      unit: '%',
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'unrealizedLoss',
      label: '미실현손실(AFS+HTM)',
      labelEn: 'Unrealized Losses',
      unit: 'ccy',
      decimals: 1,
    },
    { metric: 'deposits', label: '총예금', labelEn: 'Deposits', unit: 'ccy', decimals: 1 },
    {
      metric: 'dailyOutflowPct',
      // 이 시나리오의 한 턴은 하루가 아니라 한 시간대다 — '당일' 은 여기서 틀린 말이다.
      label: '구간 유출률',
      labelEn: 'Outflow % (this window)',
      unit: '%',
      decimals: 1,
    },
    {
      metric: 'confidence',
      label: '시장 신뢰지수',
      labelEn: 'Confidence Index',
      unit: 'index',
      sparkline: true,
    },
  ],
  thresholds: {
    cash: { warn: 5, breach: 0, direction: 'below' },
    facilityHeadroom: { warn: 10, breach: 2, direction: 'below' },
    cumulativeOutflowPct: { warn: 10, breach: 25, direction: 'above' },
  },
  fundingPlan: svbFundingPlan,
  informationEmbargoes: [
    {
      terms: ['BTFP', 'Bank Term Funding Program'],
      knownAt: BTFP_KNOWN_AT,
      sourceRefs: ['fed-btfp-2023-03-12'],
    },
  ],
  turns: withSvbInformation([...turnsA, ...turnsB]),
  gameOver: [
    {
      id: 'orderly',
      when: { flag: 'orderly_failure' },
      reason: 'orderly_failure',
      title: '자발적 관리 — 질서 있는 정리',
      narrative:
        '경영진과 이사회의 동의로 감독당국이 은행을 인수하고 FDIC가 주말 동안 정리 절차에 착수했습니다. 부분 지급의 하루는 피했지만 은행은 독립적으로 존속하지 못했습니다.',
      failed: true,
      orderly: true,
      ruleText: '자발적 관리 절차에 동의하면 시나리오가 종료됩니다 (부분점수).',
    },
    {
      id: 'unsafe_act',
      when: { regulator: { gte: 4 } },
      reason: 'unsafe_act',
      title: '감독당국, 불건전 행위로 즉시 폐쇄',
      narrative:
        '인출 지연·보류 또는 허위 공표가 확인되어 감독당국이 은행을 즉시 인수했습니다. FDIC가 관재인으로 지정되었습니다.',
      failed: true,
      ruleText: '감독당국 단계가 R4에 도달하면 폐쇄됩니다 (인출 거부·지연, 허위 공표).',
    },
    {
      id: 'closure_thursday',
      when: { all: [{ flag: 'friday_open' }, { metric: 'cash', lt: 0 }] },
      reason: 'closure_liquidity',
      title: '캘리포니아 DFPI, 은행 인수 — FDIC 관재인 지정',
      narrative:
        '목요일 마감 잔고가 음수인 채로 금요일 아침을 맞았습니다. 연준 cash letter가 결제되지 않았고, 개장 전 대기열이 가용 유동성을 훨씬 넘었습니다. DFPI가 "불안전·불건전, 유동성 부족"을 이유로 은행을 인수했습니다.',
      failed: true,
      ruleText: '금요일 개장 시점에 현금·연준 잔고가 음수이면 폐쇄됩니다.',
    },
    {
      id: 'closure_friday',
      when: { all: [{ flag: 'friday_closed' }, { metric: 'cash', lt: 0 }] },
      reason: 'closure_liquidity',
      title: '금요일 중 폐쇄',
      narrative:
        '금요일 대기열을 처리하는 도중 현금이 바닥났습니다. 감독당국이 영업 중 은행을 인수했습니다.',
      failed: true,
      ruleText: '금요일 마감 시 현금·연준 잔고가 음수이면 폐쇄됩니다.',
    },
    {
      id: 'capital',
      when: { metric: 'leverageRatio', lt: 2 },
      reason: 'capital',
      title: '자본 잠식 — 즉시시정조치',
      narrative:
        '실현손실로 유형자기자본이 총자산의 2% 아래로 떨어졌습니다. PCA 규정상 "critically undercapitalized"로 관재 절차가 개시되었습니다.',
      failed: true,
      ruleText: '레버리지비율(Tier1/총노출)이 2% 미만이면 관재 절차가 개시됩니다.',
    },
  ],
  endings: [
    {
      id: 'survived_strong',
      when: {
        all: [
          { metric: 'cumulativeOutflowPct', lt: 30 },
          { metric: 'economicTce', gt: 2 },
        ],
      },
      title: '생존 — 준비가 만든 결과',
      narrative:
        '3월 13일 월요일, PVB는 문을 열었고 모든 송금이 정시에 나갔습니다. 예금은 줄었지만 담보 창구와 확정된 자본이 런의 전제를 무너뜨렸습니다. 앞으로 2년간 NII 압박과 소송, 감독 강화를 감내해야 하지만 은행은 살아남았습니다. 퍼스트리퍼블릭의 5월 1일을 기억하십시오 — 유동성은 시간을 벌어줄 뿐, 자본 문제는 아직 남아 있습니다.',
    },
    {
      id: 'survived',
      title: '생존 — 상처뿐인 승리',
      narrative:
        '3월 13일 월요일, PVB는 문을 열었습니다. 예금의 상당 부분이 빠져나갔고 자본은 얇습니다. BTFP가 시간을 벌어주었지만, 시장은 여전히 귀행이 "다음"인지 시험하고 있습니다. 퍼스트리퍼블릭처럼 유동성만으로 버티는 은행은 다음 공시에서 다시 시험대에 오릅니다.',
    },
  ],
  scoring: svbScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-a'],
        't1-d1': ['t1-a'],
        't2-d1': ['t2-a'],
        't3-d1': ['t3-b', 't3-a'],
        't3-d2': ['t3-d2-a'],
        't4-d1': ['t4-a'],
        't4-d2': ['t4-d2-b'],
        't5-d1': ['t5-b'],
        't5-d2': ['t5-d2-b'],
        't6-d1': ['t6-a'],
      },
      note: 'SVB의 실제 선택 순서. T3.D1의 FHLB 당일 인출(A)은 SVB가 3/9 FHLB 차입을 늘린 기록을 반영한다. 체크포인트: 3/9 유출 ≈$40~43B, 마감 잔고 ≈−$1B, 3/10 폐쇄.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-b', 't0-c', 't0-e'],
        't1-d1': ['t1-d'],
        't2-d1': ['t2-b', 't2-d'],
        't3-d1': ['t3-a', 't3-e'],
        't3-d2': ['t3-d2-b'],
        't4-d1': ['t4-b'],
        't4-d2': ['t4-d2-a'],
        't5-d1': ['t5-a'],
        't6-d1': ['t6-c'],
        't7-d1': ['t7-a', 't7-b'],
        't8-d1': ['t8-d1-a'],
        't8-d2': ['t8-d2-a'],
      },
      note: '준비(T0) → 확정 증자 동반 공시(T1) → 검증 가능한 소통(T2) → 기설정 담보 즉시 인출(T3) → 조기 감독 접촉(T4) → 야간 창구(T5) → 전량 처리(T6) → BTFP(T7/T8) → 자본 보강.',
    },
  },
  checkpoints: [
    {
      turnId: 't4',
      metric: 'cumulativeOutflow',
      expected: 42,
      tolerance: 0.15,
      label: '3/9 예금 유출 $42B (DFPI 명령, Fed 리뷰)',
    },
    {
      turnId: 't5',
      metric: 'cash',
      expected: -0.958,
      tolerance: 0.9,
      label: '3/9 마감 연준 계좌 −$958M (DFPI 명령)',
    },
  ],
  debrief: svbDebrief,
})

export default scenario
