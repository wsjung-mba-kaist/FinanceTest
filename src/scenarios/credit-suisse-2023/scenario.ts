import type { CentralBankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { csDebrief } from './debrief'
import { csInitialAuthority, csInitialConfidence, csInitialMarket } from './initialState'
import { csScoring } from './scoring'
import { CS_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<CentralBankState> = defineScenario<CentralBankState>({
  meta: {
    id: 'credit-suisse-2023',
    version: 1,
    title: '취리히의 주말',
    subtitle: '2023년 3월 크레디트스위스 정리',
    era: '2023-03',
    year: 2023,
    region: 'global',
    role: 'regulator_official',
    roleTitle: 'FINMA·SNB 정책담당',
    institutionType: 'central_bank',
    institutionName: '스위스 금융당국',
    modelledOn:
      'FINMA + 스위스국립은행(SNB) + 연방재무부 (2023-03-14 ~ 2023-03-20 기록). 기관은 실명 그대로이며, 개인의 발언은 모두 기록에 기초한 개연성 있는 재구성이다.',
    difficulty: 'advanced',
    durationTurns: 6,
    turnUnit: 'day',
    estMinutes: 30,
    timezone: 'Europe/Zurich',
    learningObjectives: [
      {
        id: 'lo1',
        text: '최종대부자 지원의 조건·규모·공표 여부가 낙인과 완화 중 어느 쪽으로 작동하는지 판단하고, 유동성이 신뢰를 대체하지 못하는 국면을 식별한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d2', 't1-d2', 't2-d1', 't3-d1'],
      },
      {
        id: 'lo2',
        text: '강제 매각·정리계획(베일인)·국유화·파산의 법적 근거·소요 시간·시장 반응을 비교하고, 준비된 대안이 협상력으로 전환되는 조건을 설명한다.',
        competency: 'policy',
        decisionIds: ['t0-d1', 't3-d2', 't4-d1', 't5-d2'],
      },
      {
        id: 'lo3',
        text: 'AT1의 계약상 존립사유 조항과 일반적 채권자 서열 기대가 충돌할 때 무엇이 계약상 가능하고 무엇이 시장에 무엇을 초래하는지 구분하고, 근거 공표의 시점이 비용을 정한다는 점을 설명한다.',
        competency: 'compliance',
        decisionIds: ['t1-i1-at1', 't4-d2', 't5-d1'],
      },
      {
        id: 'lo4',
        text: '긴급명령으로 절차를 생략할 때 속도와 법적 정당성의 상충을 평가하고, 긴급권한으로 만든 수단을 법률로 상설화해야 하는 이유를 설명한다.',
        competency: 'compliance',
        decisionIds: ['t2-d2', 't4-d3', 't5-d2'],
      },
      {
        id: 'lo5',
        text: '세계적 시스템 중요 은행의 조치가 외국 관할의 인정과 공동 커뮤니케이션 없이는 효력을 갖지 못한다는 점을 이해하고, 국제 공조의 시점을 설계한다.',
        competency: 'communication',
        decisionIds: ['t1-d1', 't2-i1-eu', 't4-d3', 't5-d1'],
      },
    ],
    competencies: { policy: 3, compliance: 2, communication: 2, solvency: 1 },
    tags: ['AT1', 'ELA', '합병', '베일인', '정리 주말', '긴급명령'],
    sources: CS_SOURCES,
  },
  units: { currency: 'CHF', scale: 1e9, display: '십억 프랑' },
  initialState: {
    institution: csInitialAuthority,
    market: csInitialMarket,
    confidence: csInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: {
      drainMultiplier: 1,
      cumulativeOutflow: 1.6,
      // 주말 협상 대화(turnsB.ts)의 숫자 약속. 역사 기준값(손실보전 보증 90억 프랑)으로 초기화해 두면
      // 대화를 건너뛰어도(마감 스윕으로 기본 옵션이 확정되어도) 역사적 결과가 그대로 재현된다.
      lossGuaranteeBn: 9,
      committedFacility: 0,
      at1MarketDamage: 0,
      pressureDrainTotal: 0,
      supportProvided: 0,
      mondayShortfall: 0,
    },
  },
  briefing: {
    situation: `2023년 3월 14일 화요일 아침 8시. 귀하는 **FINMA·스위스국립은행(SNB)·연방재무부 합동 정책담당**입니다.

지난 나흘 동안 미국에서 두 은행이 문을 닫았습니다. 3월 10일 실리콘밸리은행, 3월 12일 시그니처은행. 오늘 아침에는 크레디트스위스의 2022년 연차보고서가 일주일 늦게 공시되었고, 그 안에 **재무보고 내부통제의 중대 결함**과 감사인의 부적정 의견이 들어 있습니다.

책상 위에는 서로 다른 방향을 가리키는 두 묶음의 숫자가 있습니다. 한쪽은 CET1 비율 14.1%, 유동성커버리지비율 144% — **규제 요건을 전부 충족합니다.** 다른 쪽은 2022년 4분기 고객예금 감소 1,380억 프랑, 그리고 이번 주의 일별 유출 3월 13일 16억, 오늘 27억 프랑입니다.

6턴입니다. 3/14(화) → 3/15(수, 일중) → 3/16(목, 일중) → 3/17(금) → **3/18~19(주말, 일중)** → 3/20(월). 굵게 표시된 주말을 포함해 세 턴은 하루를 시간 단위로 쪼개어 진행하며, 그 턴의 결정에는 마감 시각이 붙습니다.`,
    mandate: `**권한**: 긴급유동성지원(ELA)과 유동성부족자금조달창구(LSFF)의 공여 규모·조건·공표 여부, 적격담보 요구, 감독 보고 주기와 감독처분, 연방평의회에 대한 긴급명령 제안, 정리·합병·국유화·파산 절차의 개시, AT1 상각 명령, 국제 공조의 범위를 결정합니다.

**상위 승인 필요**: 긴급명령의 제정·개정(연방평의회 의결), 약정 신용(재정대표단 긴급 승인 또는 연방의회 의결), 국유화(연방평의회).

**사용 불가**: 2023년 3월에 존재하지 않던 수단 — 상설화된 공적유동성백스톱(긴급명령으로만 창설됩니다), 무담보 최종대부자 대출(통상법에 근거가 없습니다), 유럽 정리기금. 예금 인출의 중단·지연은 어떤 상황에서도 선택지가 아닙니다.

**목표**: 결제가 한 번도 멈추지 않은 상태로 3월 20일 월요일 개장에 도달하되, 법적 근거·납세자 위험·국제 서열 원칙을 가능한 한 보전하십시오. 무엇을 쓰든 그 비용이 **보이게** 하십시오.`,
    institutionProfile: `| 항목 | 값 | 비고 |
|---|---|---|
| **SNB 즉시 공여 여력** | 500억 프랑 | 적격담보가 뒷받침하는 금액. 통상법상 ELA + LSFF |
| 법적 총한도 | 500억 프랑 | 긴급명령이 있으면 2,500억으로 늘어난다 |
| 연방 보증 노출 | 0 | 아직 없다 |
| **크레디트스위스 가용 유동성** | 380억 프랑 | 오늘 결제에 쓸 수 있는 돈 [보정값] |
| 고객예금 잔액 | 2,330억 프랑 | 2022년 말 |
| 총자산 | 5,314억 프랑 | 2022년 말 |
| CET1 비율 | 14.1% | **요건 충족** |
| 유동성커버리지비율 | 144% | **요건 충족** |
| 30일 스트레스 순유출(LCR 분모) | 910억 프랑 | 2022년 10월 실제 유출 920억과 거의 같았다 |
| AT1 명목 잔액 | 160억 프랑 | 존립사유 조항이 붙어 있다 |
| CS 5년 CDS | 450bp | 3월 13일 |
| 스위스 국가채무/GDP | 27.5% | **재정 위기가 아니다** |

**핵심 취약점**: 자본이 아니라 예금의 속도. 2022년 4분기에 고객예금 1,380억 프랑이 빠졌고 정기예금의 51%가 한 분기에 사라졌습니다. 2022년 10월 한 달의 실제 유출은 920억 프랑으로, 규제가 30일 스트레스로 상정한 910억과 거의 같았습니다 — **규제 최저기준의 30일치를 한 달에 소진하는 은행**이라는 뜻입니다.`,
    marketBackdrop: `3월 8일 실리콘밸리은행이 채권 210억 달러를 18억 달러 손실로 매각하고 증자를 예고한 뒤 사흘 만에 폐쇄되었고, 3월 12일에는 시그니처은행이 문을 닫았습니다. 미 국채 2년물은 3월 8일 5.07%에서 3월 13일 4.03%로 하루 만에 100bp 넘게 내렸습니다. 투자등급 회사채 스프레드(Baa − 10년 국채)는 214bp, VIX는 26.5입니다.

유럽에서는 은행주가 이틀째 내리고 있습니다. 시장의 질문은 자산의 질이 아니라 **자금조달 구조**로 옮겨 갔습니다. 크레디트스위스의 5년 CDS는 450bp이고, AT1은 이미 액면을 크게 밑돌고 있습니다.

SNB 정책금리는 1.00%로 지난해 9월 이후 동결 중입니다.`,
    stakeholders: [
      {
        name: 'FINMA (스위스 금융시장감독청)',
        wants: '채권자 보호와 금융시장 안정, 집행 가능한 조치',
        canDo: '감독처분, 보고 요구, 정리·파산 명령, AT1 상각 명령, 합병 승인',
      },
      {
        name: '스위스국립은행 (SNB)',
        wants: '결제 시스템의 연속성, 담보로 뒷받침되는 지원',
        canDo: 'ELA·LSFF 공여(적격담보 필요), 긴급명령이 있으면 ELA+·PLB, 달러 스와프 라인',
      },
      {
        name: '연방평의회·연방재무부',
        wants: '스위스 경제와 금융중심지 보호, 납세자 위험의 최소화',
        canDo: '긴급명령 제정·개정(헌법 제184·185조), 손실보전 보증, 국유화 의결',
      },
      {
        name: '재정대표단(FinDel)',
        wants: '재정 통제, 사후 설명 가능성',
        canDo: '긴급 약정 신용의 승인(연방의회 의결을 대신한다)',
      },
      {
        name: '크레디트스위스',
        wants: '유동성, 시간, 독립 유지',
        canDo: '창구 이용 신청, 실사 자료 제공, 이사회 결의 — 지급 지연은 불가',
      },
      {
        name: '인수 후보 은행',
        wants: '가격, 손실보전, 법적 확실성',
        canDo: '실사, 조건 제시, 협상장 이탈',
      },
      {
        name: 'AT1 보유 기관투자자',
        wants: '서열의 예측 가능성',
        canDo: '즉시 매도, 다른 관할 AT1의 재가격, 행정소송',
      },
      {
        name: '위기관리그룹(CMG)의 외국 당국',
        wants: '조치의 사전 공유와 인정 절차의 성공',
        canDo: '정리 인정, 현지 법인 규제, 공동·개별 성명',
      },
    ],
    regulatoryFramework: `- **통상법상 최종대부자**: 긴급유동성지원(ELA)과 유동성부족자금조달창구(LSFF). 둘 다 **적격담보가 사전 배치되어 있어야** 당일 집행됩니다. 무담보 지원 창구는 존재하지 않습니다.
- **긴급명령**: 연방헌법 제184조 제3항·제185조 제3항에 근거해 연방평의회가 의결로 즉시 발효시킬 수 있습니다. 이것으로만 **ELA+**(담보 요건을 완화한 추가 대출)와 **PLB**(연방정부 이행보증부 대출)가 창설되며, 두 수단에는 파산 시 우선변제권이 붙습니다. 지급 요건: 차입자가 자체 조달 수단을 모두 소진했다는 FINMA의 확인, PLB 첫 지급 시에는 담보 소진·ELA+ 소진에 대한 SNB의 확인.
- **정리(restructuring)**: 은행법 제26조 이하. FINMA가 정리명령·정리계획·정리인 선임을 명할 수 있으며, 자본조치로 주식 상각·AT1 상각·베일인 채권의 주식 전환이 가능합니다. 채권자는 청산 시보다 불리해져서는 안 됩니다(no creditor worse off). 국제 인정 절차가 필요합니다.
- **합병**: 합병법상 원칙적으로 양 회사 주주총회의 결의가 필요합니다. 긴급명령으로 시스템적 중요 은행 간 거래에 한해 이 결의를 요하지 않도록 정할 수 있습니다.
- **AT1**: 스위스 AT1은 계약상 **존립사유(viability event)** — 특히 특별한 정부 지원이 제공되는 경우 — 에 전액 상각되도록 발행되어 있습니다. 이 상각은 정리 절차의 개시와 무관하게, 그리고 주주의 손실 이전에도 발동될 수 있습니다. 유럽연합 체계의 일반 서열(보통주 우선 흡수)과 이 점이 다릅니다.
- **감독 단계 R0~R4**: 정상 → 강화 감시 → 제한·보고 강화 → 정리 준비 → 정리·합병 실행. 인출 정지·지급 유예·허위 공표는 어떤 단계에서도 선택지가 아닙니다.`,
    cardRefs: [
      'fdic-resolution-weekend',
      'bank-run-dynamics',
      'crisis-communication',
      'regulator-escalation-ladder',
      'economic-vs-regulatory-capital',
      'uninsured-deposits-and-run-speed',
      'discount-window-fhlb-btfp',
      'contingency-funding-plan',
    ],
    simplificationNotes: [
      'FINMA·스위스국립은행·연방재무부를 하나의 정책 주체로 합성했다. 실제로는 세 기관의 권한과 판단 시점이 달랐고, 그 긴장은 메모와 전화 이벤트로만 표현했다.',
      '기관은 실재하는 그대로 썼다(FINMA·SNB·크레디트스위스·UBS). 그러나 **모든 전화·회의·협상 대사는 공개 기록에 기초한 개연성 있는 재구성이며 녹취·속기록의 인용이 아니다.** 화자는 직책으로만 표기했다.',
      '"크레디트스위스 가용 유동성"의 일별 계열은 공표된 적이 없다. 초기값 380억 프랑과 담보·한도 소요는 두 개의 문서화된 앵커에서 역산한 보정값이다(3월 16일 480억을 받고도 17일에 200억이 더 필요했다는 사실, 그리고 그 200억이 없었다면 금요일 정오에 지급불능이었다는 FINMA의 반사실).',
      'AT1 상각액은 FINMA 2023년 3월 19일 보도자료의 "약 160억 프랑"을 쓴다. FINMA의 2023년 12월 보고서는 같은 금액을 "165억 프랑(명목)"으로 적으며, 체크포인트 허용오차가 두 값을 모두 감싼다.',
      '주가·유럽 은행 주가지수·CDS 일별 경로는 언론 보도와 FINMA 보고서의 도표에서 읽은 값이며 [VERIFY]다. 주가는 절대 가격이 아니라 2023년 3월 13일 종가 = 100의 지수로만 쓴다. 투자등급 신용스프레드는 유럽 계열에 익명 접근이 막혀 있어 Baa − 10년 미 국채 프록시를 쓰며, 이 계열의 값은 전부 실측이다.',
      '`CentralBankState` 타입은 1997년형(외환보유액·외채)이라 이 사건에 맞게 필드를 재해석해서 쓴다. 재해석 규약은 initialState.ts 상단과 calibration.md §2에 표로 있다.',
      '일중 유출 배분, 담보·한도 소요의 금액과 시점, 신뢰지수의 변동 폭은 보정값이다. 반면 일별 유출 총액(16 / 27 / 132 / 171 / 101억 프랑)과 지원 금액(480 / 200 / 300 + 700억)은 FINMA 보고서의 실측값이며 역사 경로가 그대로 재현한다.',
      '2023년 3월 20일 이후의 사건(FINMA의 3월 23일 상각 근거 설명, 은행법 개정 협의, 의회 조사위원회 보고서, AT1 소송의 경과)은 엔딩과 디브리핑에서만 다룬다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(FINMA 보도자료와 2023년 12월 사후 보고서, 스위스국립은행 발표, 연방 관보에 공포된 긴급명령, 크레디트스위스·UBS 공시, 유럽 정리·감독 당국 공동성명, 국제결제은행 분석, 스위스 의회 조사위원회 보고서, 당시 보도)를 바탕으로 교육 목적으로 재구성한 것입니다. 기관은 실재하는 그대로 썼으나 **개인의 발언은 모두 재구성이며 실제 인용이 아닙니다.** 수치는 단순화·보정되었고, 법적 쟁점이 계속되고 있는 사항(특히 AT1 상각의 근거)은 단정하지 않고 각 당사자의 입장으로 기술했습니다.',
  },
  kpis: [
    {
      metric: 'csLiquidity',
      label: 'CS 가용 유동성',
      labelEn: 'CS Usable Liquidity',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '오늘 결제에 쓸 수 있는 돈. 음수가 되면 지급불능',
      decimals: 1,
    },
    {
      metric: 'dailyOutflow',
      label: '당일 고객자금 유출',
      labelEn: 'Daily Client Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'usableReserves',
      label: 'SNB 즉시 공여 여력',
      labelEn: 'SNB Deployable Capacity',
      unit: 'ccy',
      sparkline: true,
      description: '담보와 법적 근거가 뒷받침하는 금액',
      decimals: 0,
    },
    {
      metric: 'csCdsBp',
      label: 'CS 5년 CDS',
      labelEn: 'CS 5Y CDS',
      unit: 'bp',
      sparkline: true,
      decimals: 0,
      referenceLabel: '1,000bp = 위기 수준',
    },
    {
      metric: 'ownStock',
      label: 'CS 주가지수',
      labelEn: 'CS Share Index',
      unit: 'index',
      sparkline: true,
      description: '2023-03-13 종가 = 100',
      decimals: 1,
    },
    {
      metric: 'confidence',
      label: '시장 신뢰지수',
      labelEn: 'Confidence Index',
      unit: 'index',
      sparkline: true,
    },
    {
      metric: 'supportDrawn',
      label: 'SNB 지원 누계',
      labelEn: 'SNB Support Drawn',
      unit: 'ccy',
      decimals: 0,
    },
    {
      metric: 'federalGuarantee',
      label: '연방 보증 노출',
      labelEn: 'Federal Guarantee Exposure',
      unit: 'ccy',
      decimals: 0,
      description: '납세자가 떠안은 위험',
    },
    {
      metric: 'at1WrittenOff',
      label: 'AT1 상각액',
      labelEn: 'AT1 Written Off',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'shareholderConsideration',
      label: '주주 대가',
      labelEn: 'Shareholder Consideration',
      unit: 'ccy',
      decimals: 1,
      description: 'AT1 상각액과 나란히 보십시오',
    },
    {
      metric: 'cumulativeOutflow',
      label: '누적 고객자금 유출',
      labelEn: 'Cumulative Outflow',
      unit: 'ccy',
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'mondayCashRequirement',
      label: '월요일 개장 소요 현금',
      labelEn: 'Monday Opening Requirement',
      unit: 'ccy',
      decimals: 0,
      description: '주말 턴에서 설정됩니다',
    },
  ],
  thresholds: {
    csLiquidity: { warn: 15, breach: 0, direction: 'below' },
    dailyOutflow: { warn: 10, breach: 17, direction: 'above' },
    usableReserves: { warn: 20, breach: 5, direction: 'below' },
    csCdsBp: { warn: 500, breach: 1000, direction: 'above' },
    federalGuarantee: { warn: 100, breach: 200, direction: 'above' },
    cumulativeOutflow: { warn: 30, breach: 50, direction: 'above' },
  },
  noise: {
    runoffSigma: 0.12,
    runoffCap: 0.25,
    tickerSigma: 0.008,
    tickerSigmaBp: 4,
    eventJitter: 1,
  },
  turns: [...turnsA, ...turnsB],
  gameOver: [
    {
      id: 'insolvency',
      when: { metric: 'csLiquidity', lt: 0 },
      reason: 'insolvency',
      title: '지급불능 — 결제가 멈추다',
      narrative:
        '가용 유동성이 바닥났습니다. 대리은행이 결제를 반송하기 시작했고, 스위스 법인의 창구에서 지급이 멈췄습니다. 이 순간 남은 선택지는 정리도 매각도 아니라 파산 선고뿐입니다. FINMA 보고서의 반사실이 그대로 실현되었습니다 — 금요일 정오의 200억 프랑이 없었다면 은행은 즉시 지급불능이었습니다.',
      failed: true,
      ruleText: '크레디트스위스의 가용 유동성이 음수가 되면 지급불능으로 종료됩니다.',
    },
    {
      id: 'disorderly_failure',
      when: { flag: 'disorderly_bankruptcy' },
      reason: 'disorderly_failure',
      title: '무질서한 파산 — 세계적 시스템 중요 은행의 첫 도산',
      narrative:
        '그룹의 파산 결정문이 발효했습니다. 스위스 긴급계획으로 국내 결제와 보호예금은 유지되었지만, 해외 법인은 각국의 도산 절차로 흩어졌고 파생계약이 일제히 조기종료되었습니다. 금융중심지와 국가 신인도의 손상은 수치로 정리되기까지 몇 년이 걸릴 것입니다. FINMA가 이 선택지를 최후의 수단으로 분류한 이유가 그대로 드러났습니다.',
      failed: true,
      ruleText: '그룹 파산 + 긴급계획 발동을 선택하면 무질서한 실패로 종료됩니다.',
    },
    {
      id: 'system_contagion',
      when: { metric: 'confidence', lt: 12 },
      reason: 'system_contagion',
      title: '신뢰 붕괴 — 전염이 시작되다',
      narrative:
        '시장은 더 이상 이 은행 하나를 보고 있지 않습니다. 다른 스위스 은행과 유럽 은행의 CDS가 함께 벌어지고 무담보 조달 창구가 광범위하게 닫혔습니다. 당국의 발표가 시장의 예상보다 늦거나 작거나 서로 모순되었을 때 일어나는 일입니다. 이 시점부터는 한 은행의 문제를 푸는 것이 아니라 시스템 전체를 막아야 합니다.',
      failed: true,
      ruleText: '시장 신뢰지수가 12 미만으로 떨어지면 시스템 전염으로 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'merger_announced',
      when: { flag: 'route_merger' },
      title: '월요일 아침 — 은행 하나가 사라지고 시장은 열렸다',
      narrative:
        '일요일 저녁의 발표가 월요일 아침에 발효했습니다. 결제는 한 번도 멈추지 않았고 예금자는 한 사람도 손실을 보지 않았습니다. 스위스국립은행의 지원은 3월 말 누계 1,680억 프랑까지 갔다가 공적유동성백스톱은 5월 말까지, 추가 유동성지원대출은 8월 말까지 전액 상환되었고, 합병은 6월 12일에 법적으로 완결되었습니다.\n\n남은 것은 세 가지입니다. 주주가 대가를 받는데 AT1이 전액 상각된 순서, 주주총회 결의를 명령으로 생략한 전례, 그리고 서명 가능한 상태로 존재했으나 쓰이지 않은 정리계획입니다. 스위스 의회는 이듬해 조사위원회를 구성해 45회 회의와 3만 쪽의 문서를 검토했고, AT1 보유자들의 소송은 2025년 10월 연방행정법원의 첫 부분판결로 FINMA의 처분이 취소되었다가 상고심으로 이어졌습니다. 런을 멈추는 것과 그 방식의 정당성을 확보하는 것은 다른 문제입니다.',
    },
    {
      id: 'resolution_executed',
      when: { flag: 'route_resolution' },
      title: '정리 실행 — 제도가 설계된 대로 작동했다',
      narrative:
        '정리명령이 발효했습니다. 주식이 전액 상각되고, 그 다음에 AT1이 상각되었으며, 베일인 채권이 주식으로 전환되어 자본이 약 730억 프랑 늘었습니다. 이사회 의장이 교체되고 정리인이 선임되었습니다. **서열은 지켜졌습니다** — 유럽 당국이 다음 날 아침에 별도 성명을 낼 일도, AT1 시장이 자기 조건서를 다시 읽을 일도 없었습니다.\n\n대가는 전례의 부재였습니다. 세계적 시스템 중요 은행의 정리는 이것이 처음이고, 외국 관할의 인정 절차가 같은 시각에 맞물려야 했으며, 실패하면 남는 것은 파산뿐이었습니다. FINMA가 실제로는 이 길을 택하지 않은 이유가 바로 그 위험이었습니다. 이 경로를 끝까지 걸어 본 것 자체가 이 훈련의 목적입니다 — 존재했으나 쓰이지 않은 선택지의 값을 재는 것.',
    },
    {
      id: 'nationalised',
      when: { flag: 'route_nationalisation' },
      title: '국유화 — 확실하지만 전부 떠안았다',
      narrative:
        '연방이 단독 주주가 되었습니다. 월요일 아침은 조용했고 결제는 멈추지 않았습니다. 대신 대형 은행의 경영과 위험 전부가 연방 재정 안으로 들어왔습니다. 특별한 정부 지원이므로 AT1의 계약상 상각은 이 경로에서도 발동되었고, 주주의 지분은 대가 없이 이전되었습니다. FINMA가 이 선택지를 규제·법률·리스크 어느 관점에서도 우선순위로 두지 않았던 이유는 월요일이 아니라 그 다음 몇 년의 대차대조표에 나타납니다.',
    },
    {
      id: 'standalone',
      when: { flag: 'route_standalone' },
      title: '아무것도 정하지 못한 주말',
      narrative:
        '구조 조치 없이 창구만 더 열었습니다. 월요일 아침 유출은 다시 커졌고, 시장이 던지는 질문은 "이 은행이 버틸 수 있는가"에서 "언제까지 버티게 할 것인가"로 바뀌었습니다. 이미 목요일에 증명된 사실이 다시 확인되었을 뿐입니다 — 유동성으로 살 수 있는 것은 시간이지 신뢰가 아닙니다.',
    },
    {
      id: 'unresolved',
      title: '경로 없이 맞은 월요일',
      narrative:
        '일요일 저녁의 시한을 넘겼습니다. 아시아가 열렸을 때 발표된 것도, 발효한 것도 없었습니다. 이 시나리오에서 가장 비싼 결과는 잘못된 선택이 아니라 선택하지 않은 것입니다.',
    },
  ],
  scoring: csScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': 't0-d1-daily',
        't0-d2': 't0-d2-list',
        't1-d1': 't1-d1-joint',
        't1-d2': 't1-d2-intraday',
        't1-i1-at1': 't1-i1-noComment',
        't2-d1': 't2-d1-full',
        't2-d2': 't2-d2-enact',
        't2-i1-eu': 't2-i1-brief',
        't3-d1': 't3-d1-elaplus',
        't3-d2': 't3-d2-merger',
        't4-d1': 't4-d1-merger',
        't4-d2': 't4-d2-writeoff-silent',
        't4-d3': ['t4-d3-skip-agm', 't4-d3-swap-lines'],
        't4-i1-buyer': 't4-i1-defer',
        't5-d1': 't5-d1-explain-later',
        't5-d2': 't5-d2-plb-law',
      },
      note: '실제 경로: 3/14 일일 보고·담보 목록 접수 → 3/15 저녁 FINMA·SNB 공동성명(수치 없음) → 3/16 ELA 380 + LSFF 100 공여 + 긴급명령 제정 → 3/17 ELA+ 200 공여, 매각 단일 트랙 → 3/18~19 UBS 흡수합병(대가 30억, 손실보전 보증 90억, PLB 1,000억), AT1 160억 전액 상각을 설명 없이 공표, 주주총회 생략 + 달러 스와프 라인 확대 → 3/20 상각 근거 설명은 며칠 뒤로, 공적유동성백스톱 법제화 착수. 체크포인트: 3/15 CDS 1,010bp·유출 132억, 3/16 유출 171억·지원 누계 480억, 3/17 누계 680억, 주말 AT1 상각 160억·주주 대가 30억, 3/20 지원 누계 1,680억·연방 보증 1,090억.',
    },
    expert: {
      choices: {
        't0-d1': 't0-d1-prepare',
        't0-d2': 't0-d2-preposition',
        't1-d1': 't1-d1-numbers',
        't1-d2': 't1-d2-collateral',
        't1-i1-at1': 't1-i1-contract',
        't2-d1': 't2-d1-conditional',
        't2-d2': 't2-d2-enact-resolution',
        't2-i1-eu': 't2-i1-full',
        't3-d1': 't3-d1-elaplus-prepared',
        't3-d2': 't3-d2-dual',
        't4-d1': 't4-d1-merger',
        't4-d2': 't4-d2-writeoff-explained',
        't4-d3': ['t4-d3-skip-agm', 't4-d3-swap-lines'],
        't4-i1-buyer': 't4-i1-firm',
        't5-d1': 't5-d1-explain-now',
        't5-d2': ['t5-d2-plb-law', 't5-d2-at1-terms'],
      },
      note: '전문가 경로: 화요일에 정리·매각·긴급명령을 동시에 준비하고 담보를 사전 배치한다(T0) → 공동성명에 규모·조건을 수치로 넣고 남은 담보를 밤사이 이전한다(T1) → 같은 480억을 조건부로 공여하고 긴급명령에 상각·합병·보증 조항까지 미리 넣는다(T2) → ELA+ 200억을 주말 협조 조건과 함께 내주고 매각·정리를 병행한다(T3) → 합병으로 가되 보증을 90억에 묶고 AT1 상각의 근거를 유럽 당국과 맞춘 문안으로 결과와 같은 시각에 공표한다(T4) → 개장 전에 설명을 마치고 백스톱 법제화와 AT1 조건 표준화를 함께 착수한다(T5). 같은 결론에 더 일찍, 더 준비된 채로 도달하는 것이 이 경로의 전부다.',
    },
  },
  checkpoints: [
    {
      turnId: 't1',
      path: 'market.ownCdsBp',
      expected: 1010,
      tolerance: 0.15,
      label: '2023-03-15 CS 5년 CDS 1,000bp 돌파 (FINMA 보고서 본문)',
    },
    {
      turnId: 't1',
      metric: 'dailyOutflow',
      expected: 13.2,
      tolerance: 0.02,
      label: '2023-03-15 고객자금 유출 132억 프랑 (틱 5개 슬라이스 합계)',
    },
    {
      turnId: 't2',
      metric: 'dailyOutflow',
      expected: 17.1,
      tolerance: 0.02,
      label: '2023-03-16 고객자금 유출 171억 프랑 — 480억을 공여한 바로 그날',
    },
    {
      turnId: 't2',
      metric: 'supportDrawn',
      expected: 48,
      tolerance: 0.02,
      label: '2023-03-16 SNB 지원 누계 480억 프랑 (ELA 380 + LSFF 100)',
    },
    {
      turnId: 't3',
      metric: 'supportDrawn',
      expected: 68,
      tolerance: 0.02,
      label: '2023-03-17 SNB 지원 누계 680억 프랑 (ELA+ 200억 추가)',
    },
    {
      turnId: 't4',
      metric: 'at1WrittenOff',
      expected: 16,
      tolerance: 0.05,
      label: '2023-03-19 AT1 상각 약 160억 프랑 (FINMA 보고서는 165억으로 적는다)',
    },
    {
      turnId: 't4',
      metric: 'shareholderConsideration',
      expected: 3,
      tolerance: 0.05,
      absTolerance: 0.3,
      label: '2023-03-19 주주 대가 30억 프랑 (주당 0.76프랑, CS 22.48주당 UBS 1주)',
    },
    {
      turnId: 't5',
      metric: 'supportDrawn',
      expected: 168,
      tolerance: 0.03,
      label: '2023년 3월 말 SNB 지원 누계 1,680억 프랑',
    },
    {
      turnId: 't5',
      metric: 'federalGuarantee',
      expected: 109,
      tolerance: 0.03,
      label: '2023-03-19 재정대표단 승인 약정 신용 1,090억 프랑 (PLB 보증 1,000 + 손실보전 90)',
    },
  ],
  debrief: csDebrief,
})

export default scenario
