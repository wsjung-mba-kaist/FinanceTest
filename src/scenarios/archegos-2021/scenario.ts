import type { PrimeBrokerState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { archegosDebrief } from './debrief'
import {
  archegosInitialConfidence,
  archegosInitialCounters,
  archegosInitialMarket,
  archegosInitialPb,
} from './initialState'
import { archegosScoring } from './scoring'
import { ARCHEGOS_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

/** 게임오버 임계값 (calibration.md §7). 단위 $B. */
export const CAPITAL_BREACH_LOSS = 6.5
export const UNMANAGED_SHORTFALL = 2.5

const scenario: ScenarioDefinition<PrimeBrokerState> = defineScenario<PrimeBrokerState>({
  meta: {
    id: 'archegos-2021',
    version: 1,
    title: '죄수의 딜레마',
    subtitle: '2021년 3월 아케고스 청산',
    era: '2021-03',
    year: 2021,
    region: 'global',
    role: 'pb_risk_head',
    roleTitle: '프라임브로커 리스크 헤드',
    institutionType: 'prime_broker',
    institutionName: '알파인은행 프라임서비스(Alpine Bank Prime)',
    modelledOn:
      '1차적으로 크레디트스위스 프라임서비스(마진 수준·한도 운용·초과담보 반환·늦은 청산, Paul Weiss 독립조사 보고서 2021-07-29 및 FINMA 2023-07-24)를 모델로 한 합성 사업부이며, 「기다린 은행」의 결과는 노무라(20-F FY2021)의 경로를 참고했다. 고객(아케고스 캐피털 매니지먼트)과 다른 프라임브로커(골드만삭스·모건스탠리·UBS·웰스파고·노무라·미쓰비시UFJ)는 실명이며 공개 기록으로 확인된 사실만 사용한다. 대사는 전부 재구성이며 통화록이 아니다',
    difficulty: 'advanced',
    durationTurns: 7,
    turnUnit: 'day',
    estMinutes: 35,
    timezone: 'America/New_York',
    learningObjectives: [
      {
        id: 'lo1',
        text: '집중 익스포저를 정적 마진율이 아니라 청산 소요일(명목 ÷ (일평균거래대금 × 참여율))과 유통주식 비중으로 측정하고, 그 값을 한도 체계의 1차 지표로 쓴다.',
        competency: 'marketRisk',
        decisionIds: ['t0-d1', 't0-d2', 't1-d1', 't2-d1', 't5-d1'],
      },
      {
        id: 'lo2',
        text: '동적 마진과 집중도 가산의 상충(수수료 상실 vs 꼬리위험)을 위기 이전에 판단하고, 결의와 이행의 차이를 구분한다.',
        competency: 'compliance',
        decisionIds: ['t0-d1', 't1-d1', 't1-d2', 't6-d2'],
      },
      {
        id: 'lo3',
        text: '카운터파티의 총레버리지를 알 수 없다는 정보 결핍 자체를 리스크로 계상하고, 증빙 요구·익명 집계 등 실행 가능한 해소 경로와 그렇지 않은 경로(직접 정보교환)를 구분한다.',
        competency: 'compliance',
        decisionIds: ['t1-d3', 't3-i1-client', 't4-d1'],
      },
      {
        id: 'lo4',
        text: '디폴트 정리에서 공동 정리와 선매도의 상충을 반복 게임으로 이해하고, 합의를 지탱하는 것이 선의가 아니라 관측 가능성(일일 상한 + 제3자 검증)임을 적용한다.',
        competency: 'policy',
        decisionIds: ['t4-d1', 't4-i2-peer', 't5-d1', 't5-i1-desk'],
      },
      {
        id: 'lo5',
        text: '매각 속도와 시장 충격의 상충을 계산하고, 자사 손실·업계 합산 손실·감독 비용을 함께 놓고 정리 방식을 선택한다.',
        competency: 'solvency',
        decisionIds: ['t3-d1', 't4-d1', 't5-d1', 't6-d1'],
      },
    ],
    competencies: { marketRisk: 3, compliance: 2, solvency: 2, communication: 1, policy: 2 },
    tags: ['TRS', '마진', '집중도', '블록 매각', '카운터파티 신용리스크'],
    sources: ARCHEGOS_SOURCES,
  },
  units: { currency: 'USD', scale: 1e9, display: 'B' },
  initialState: {
    institution: archegosInitialPb,
    market: archegosInitialMarket,
    confidence: archegosInitialConfidence,
    regulatorLevel: 0,
    flags: {},
    counters: archegosInitialCounters,
  },
  noise: { tickerSigma: 0.008, tickerSigmaBp: 2, eventJitter: 1 },
  briefing: {
    situation: `2020년 4월. 귀하는 **알파인은행 프라임서비스(Alpine Bank Prime)**의 리스크 헤드입니다. 오늘 아침 카운터파티 신용리스크팀이 한 고객에 대한 보고서를 올렸습니다 — 아케고스 캐피털 매니지먼트. 승인된 잠재익스포저(PE) 한도는 $20m인데 현재 값은 $200m, **한도의 10배**입니다.

이 고객의 포지션은 전부 **총수익스와프(TRS)**입니다. 기초자산은 우리 이름으로 보유하므로 고객은 지분공시 의무를 지지 않고, 우리는 고객이 다른 프라임브로커에 얼마나 같은 포지션을 들고 있는지 알 수 없습니다. 고객은 "세 곳"이라고 말했습니다. 확인할 방법은 없습니다.

2019년 협상으로 이 고객의 스왑 마진은 약 20%에서 **7.5%**로 낮아졌습니다. 업계 표준은 15~25%입니다. 연간 수수료는 $18m이고 사업부장은 내년에 세 배가 될 것이라고 말합니다.

시나리오는 7턴입니다: 2020년 4월 프롤로그 → 2020년 9월~2021년 3월 11일 → 3/22~23 비아콤CBS 증자 → 3/24 마진콜 → 3/25 죄수의 딜레마 → 3/26 블록 거래 → 사후.`,
    mandate: `**권한**: 이 고객의 마진 조건·한도·담보 요건을 계약상 변경권 범위에서 직접 결정합니다. 신규 거래 거절과 디폴트 선언은 리스크 헤드 권한입니다. 사업부 수익 목표는 사업부장 소관이며, 사업 철수와 대외 공시는 이사회·그룹 경영진 소관입니다. 다른 프라임브로커와 고객 포지션 정보를 직접 교환하는 것은 비밀유지 의무상 불가합니다.

**목표**: 이 고객으로 인한 실현 손실을 배정자본(${'$'}8.0bn) 안에서 통제하고, 정리 과정이 시장과 감독당국에 남기는 비용을 최소화하십시오. 손실만 줄이면 되는 게임이 아닙니다 — 먼저 파는 쪽이 자사 손실은 줄이지만 업계 합산 손실과 감독 비용은 커집니다.`,
    institutionProfile: `| 항목 (2020년 4월, $B) | 알파인 프라임서비스 | 비고 |
|---|---|---|
| 배정 리스크 자본 | 8.0 | 사업부 단위 [STYLIZED] |
| 아케고스 총익스포저(명목) | 3.0 | TRS 기초자산 6종목 |
| 보유 담보 | 0.225 | 정적 마진 7.5% |
| 차순위 단일 헤지펀드 고객 | 1.5 | 아케고스가 2.0배 |
| 승인 PE 한도 / 현재 PE | 0.02 / 0.20 | **10배 초과** |
| 연간 수수료 수입 | 0.018 | $18m |
| 고객이 고지한 타 프라임브로커 | 3곳 | 검증 불가 |

**포지션 구성(2020년 4월 명목)**: ViacomCBS 0.75 · Discovery 0.45 · Baidu 0.675 · GSX Techedu 0.30 · Tencent Music 0.375 · Vipshop 0.45.

**집중도 회계**: 청산 소요일 = 명목 ÷ (일평균거래대금 × 20% 참여율). 청산 VaR = 2.33 × 일간변동성 × √청산소요일 × 명목. 마진 커버리지 = 보유 담보 ÷ 청산 VaR.

**알려진 취약점(2020년 4월 기준)**: 정적 마진 7.5%(업계 표준의 절반 이하), 동적 마진 미적용, 집중도 가산 없음, 한도가 익스포저를 따라가는 구조, 타 프라임브로커 노출 검증 수단 없음.`,
    marketBackdrop: `2020년 3월 충격 이후 연준의 긴급 조치로 위험자산이 빠르게 반등하고 있습니다. 목표범위는 0~0.25%, 10년물은 0.62%, VIX는 57입니다. 총수익스와프를 통한 레버리지 수요가 급증하고 있으며, 등록 의무가 없는 패밀리오피스는 13F 공시 대상이 아니어서 기초자산이 프라임브로커 명의로 보유되는 구조에서는 포지션이 시장에 드러나지 않습니다.

1년 뒤인 2021년 3월의 시장 배경은 전혀 다릅니다 — 10년물 1.63%, VIX 20, 신용 스프레드는 위기 전 수준입니다. 이 사건은 자금조달 위기가 아니라 **한 고객의 카운터파티 신용 사건**이며, 청산 당일에도 VIX는 오히려 내렸습니다.`,
    stakeholders: [
      {
        name: '프라임서비스 사업부장',
        wants: '수수료 성장, 고객 유지',
        canDo: '마진 조건 협상, 한도 상향 요청, 고객 관계 관리',
      },
      {
        name: '고객(아케고스 캐피털 매니지먼트)',
        wants: '낮은 마진, 초과 담보 반환, 포지션 확대',
        canDo: '다른 프라임브로커로 물량 이전, 정보 제공 거부, 협의 일정 지연',
      },
      {
        name: '그룹 리스크위원회·이사회',
        wants: '한도 준수, 꼬리위험 통제',
        canDo: '한도 승인, 디리스킹 계획 요구, 사업 철수 결정',
      },
      {
        name: '다른 프라임브로커(골드만삭스·모건스탠리·UBS·웰스파고·노무라·미쓰비시UFJ)',
        wants: '자사 회수 극대화',
        canDo: '독자 디폴트 선언과 선매도, 공동 정리 참여, 블록 주도',
      },
      {
        name: '감독당국(Fed·PRA·FINMA)',
        wants: '카운터파티 신용리스크 관리의 건전성',
        canDo: '검사, 시정 명령, 벌금, 보수 체계 개입',
      },
      {
        name: '주식 파생 데스크',
        wants: '체결 가능한 물량과 가격',
        canDo: '블록 주선, 장중 분할 체결, 호가 상황 보고',
      },
    ],
    regulatoryFramework: `- **TRS와 공시**: 총수익스와프는 기초자산을 프라임브로커가 자기 명의로 보유한다. 당시 미국에서 패밀리오피스는 투자자문업 등록이 면제되었고 스와프 포지션은 13F 대상이 아니었으므로, 고객의 경제적 지분은 시장에 드러나지 않았다.
- **마진**: 프라임브로커 계약은 통상 마진 조건 변경권(30일 통지, 사안에 따라 당일 통지)을 담는다. 정적 마진은 명목의 고정 비율, 동적 마진은 변동성·집중도에 연동한다. 업계 표준은 15~25%였다.
- **디폴트와 상계 청산**: 납입 마감 경과 시 계약상 디폴트 사유가 발생하고, 선언과 동시에 담보 처분·상계 청산 권한이 생긴다. 선언 전에는 임의 처분이 불가능하다.
- **정보 제약**: 고객 포지션 정보를 경쟁 프라임브로커와 직접 교환하는 것은 비밀유지 의무 위반이며 경쟁법 문제가 될 수 있다. 실행 가능한 경로는 고객에 대한 증빙 요구와 제3자 익명 집계다.
- **사후 기준**: PRA·FCA 공동 서한(2021-12-10)은 사업부 간 통합 리스크관리·온보딩 후 재평가·마진 방식·종합 리스크관리를 요구했다. BCBS 카운터파티 신용리스크 관리 기준(2024-12-11)은 실사·신용리스크 완화·PFE와 스트레스 측정·거버넌스의 네 축을 제시하며 1999년 고레버리지 기관 기준을 대체했다. FSB 최종 보고서(2025-07-09)는 카운터파티 레버리지 파악을 정책 권고로 담았다.
- **감독 단계 R0~R4(게임)**: 한도 초과 누적·디폴트 보고 → R1, 공시 지연·시정 불충분 → R2~R3, 선행매매·부정확한 공시 → R4(영업 제한).`,
    cardRefs: [
      'economic-vs-regulatory-capital',
      'hqla-and-haircuts',
      'regulator-escalation-ladder',
      'crisis-communication',
      'tri-party-repo-run',
    ],
    simplificationNotes: [
      '알파인은행 프라임서비스는 합성 사업부다. 익스포저 경로(2020년 4월 $3bn → 2021년 3월 $20bn)는 SEC가 적시한 아케고스 전체 익스포저 경로($10bn → $160bn)에 알파인의 몫을 비례 배분한 것이며, 종목별 명목·일평균거래대금·유통주식 비중은 양식화 값이다(facts.ts STYLIZED·VERIFY).',
      '다른 프라임브로커 여섯 곳은 실명이지만 익스포저·담보율·이탈 임계값은 공개된 손실 규모와 매각 시점에서 역산한 보정값이며 각 은행의 내부 수치가 아니다(calibration.md §5).',
      '책의 마크는 종목별 일간 수익률을 가치가중한 단일 지수로 다룬다. 일중 분포는 모든 종목에 같은 모양을 적용한 양식화이며, 종목별 지수(티커)는 각자의 실제 경로를 따른다(calibration.md §2).',
      '청산 체결 할인(슬리피지)과 잔여 처분 가격은 보정값이다. 역사 경로의 실현 손실이 크레디트스위스의 $5.5bn을 재현하도록 잔여 처분 기준 마크를 역산했다(calibration.md §4).',
      '모든 대사는 공개 기록에 근거한 재구성이며 통화록·속기록이 아니다. 고객 측 화자는 특정 개인이 아니라 직책으로 표시했다.',
      '2020년 4월과 2021년 3월의 시장 상태가 한 시나리오에 공존한다. 프롤로그 두 턴은 2020년 시세를, T2 진입 효과가 2021년 3월 앵커를 세운다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(Paul Weiss 독립조사 보고서, 각 은행의 공시와 실적자료, 연준·PRA·FINMA 처분 문서, SEC 보도자료와 소장, 미 상원 은행위 서한, BCBS·FSB 사후 검토)를 바탕으로 교육 목적으로 재구성한 것입니다. 플레이어가 맡는 기관은 합성 사업부이며 수치는 단순화되었습니다. 모든 대사는 재구성이며 실제 발언이 아닙니다. 형사 절차의 결과를 포함해 개인에 대한 판단은 법원과 감독당국이 확정한 범위를 넘지 않습니다.',
  },
  kpis: [
    {
      metric: 'grossExposure',
      label: '고객 총익스포저',
      labelEn: 'Gross Exposure',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: 'TRS 기초자산의 현재 시가 명목 — 프롤로그의 한도 결정이 이 값을 만든다',
      decimals: 2,
    },
    {
      metric: 'concentrationDays',
      label: '최대 청산 소요일',
      labelEn: 'Days to Liquidate (worst)',
      unit: 'days',
      primary: true,
      sparkline: true,
      description: '명목 ÷ (일평균거래대금 × 20% 참여율) 중 최댓값 — 집중 위험의 실제 단위',
      decimals: 1,
      referenceLabel: '경보 기준 10일',
    },
    {
      metric: 'marginCoverage',
      label: '마진 커버리지',
      labelEn: 'Margin Coverage',
      unit: '%',
      primary: true,
      sparkline: true,
      description: '보유 담보 ÷ 청산 VaR — 100% 미만이면 담보가 청산 위험을 덮지 못한다',
      decimals: 0,
      referenceLabel: '업계 표준 마진 15~25%',
    },
    {
      metric: 'marginShortfall',
      label: '미회수 익스포저',
      labelEn: 'Uncovered Exposure',
      unit: 'ccy',
      primary: false,
      sparkline: true,
      description:
        '정산 기준 평가액 − 현재 평가액 − 보유 담보. 0이 아닌 동안 무담보 대출과 같다 (institution.custom 경유)',
      decimals: 2,
    },
    {
      metric: 'realizedLoss',
      label: '실현 손실',
      labelEn: 'Realized Loss',
      unit: 'ccy',
      sparkline: true,
      description: '청구권 안분 − 청산대금 − 담보 안분',
      decimals: 2,
      referenceLabel: `배정자본 8.0 · 게임오버 ${CAPITAL_BREACH_LOSS}`,
    },
    {
      metric: 'industryLoss',
      label: '업계 합산 손실',
      labelEn: 'Industry-wide Loss',
      unit: 'ccy',
      sparkline: true,
      description:
        '알파인 + 다른 프라임브로커 여섯 곳의 손실 합계 — 시스템 결과 (institution.custom 경유)',
      decimals: 2,
    },
  ],
  // `institution.custom` 경유 지표(marginShortfall · industryLoss)에는 **반드시** 임계값을 준다.
  // 임계값이 없는 지표는 status 'na'로 산출되어 조건·채점·엔딩에서 아예 보이지 않는다
  // (src/metrics/thresholds.ts의 설계: 밴드 없는 지표에 초록 배지를 달지 않는다).
  thresholds: {
    marginCoverage: { warn: 50, breach: 25, direction: 'below' },
    concentrationDays: { warn: 10, breach: 20, direction: 'above' },
    marginShortfall: { warn: 0.5, breach: UNMANAGED_SHORTFALL, direction: 'above' },
    realizedLoss: { warn: 2.0, breach: CAPITAL_BREACH_LOSS, direction: 'above' },
    industryLoss: { warn: 6.0, breach: 12.0, direction: 'above' },
    grossExposure: { warn: 12.0, breach: 20.0, direction: 'above' },
  },
  turns: [...turnsA, ...turnsB],
  gameOver: [
    {
      id: 'capital_breach',
      when: { metric: 'realizedLoss', gte: CAPITAL_BREACH_LOSS },
      reason: 'capital_breach',
      title: '배정자본 소진 — 사업부 해체',
      narrative:
        '한 고객의 디폴트로 프라임서비스 사업부에 배정된 리스크 자본의 대부분이 사라졌습니다. 그룹은 사업부를 즉시 해체하고 잔여 포지션을 다른 부문으로 이관했습니다. 감독당국은 카운터파티 신용리스크 관리의 불안전·불건전 관행을 이유로 검사에 착수했고, 리스크 헤드는 교체되었습니다.',
      failed: true,
      ruleText: `실현 손실이 배정자본(8.0)의 80%인 ${CAPITAL_BREACH_LOSS}을 넘으면 시나리오가 종료됩니다.`,
    },
    {
      id: 'unmanaged_default',
      when: {
        all: [
          { metric: 'marginShortfall', gte: UNMANAGED_SHORTFALL },
          { notFlag: 'default_declared' },
          { turn: { gte: 4 } },
        ],
      },
      reason: 'unmanaged_default',
      title: '디폴트 미선언 — 청산 권한 없이 익스포저만 커짐',
      narrative:
        '고객이 마진콜을 이행하지 못하는 상태에서 디폴트를 선언하지 않아 상계 청산 권한이 생기지 않았습니다. 미회수 익스포저가 담보의 몇 배로 불어나는 동안 다른 프라임브로커들은 이미 권한을 확보하고 물량을 처분했습니다. 그룹 리스크위원회가 개입해 사업부의 권한을 회수했습니다.',
      failed: true,
      ruleText: `3/25 이후 미회수 익스포저가 ${UNMANAGED_SHORTFALL}을 넘었는데도 디폴트를 선언하지 않으면 시나리오가 종료됩니다.`,
    },
    {
      id: 'conduct_order',
      when: { regulator: { gte: 4 } },
      reason: 'conduct_order',
      title: '행위 위반 — 영업 제한 명령',
      narrative:
        '고객 청산 정보의 유용 또는 부정확한 공시가 확인되어 감독당국이 즉시 영업 제한을 부과했습니다. 이것은 리스크 관리의 실패가 아니라 행위 위반이며, 손실의 크기와 무관하게 사업 자체를 잃습니다.',
      failed: true,
      ruleText: '감독당국 단계가 R4(행위 위반)에 도달하면 즉시 종료됩니다.',
    },
    {
      id: 'franchise_surrender',
      when: { flag: 'franchise_surrendered' },
      reason: 'franchise_surrender',
      title: '사업 철수 — 질서 있는 해체',
      narrative:
        '손실 공표와 동시에 프라임브로커리지 사업 전면 철수를 발표했습니다. 남은 고객들이 한꺼번에 계좌를 옮기면서 정리 과정 자체가 또 한 번의 가격 충격이 되었지만, 순서와 시점은 통제되었습니다. 질서 있는 실패로 기록됩니다.',
      failed: true,
      orderly: true,
      ruleText:
        '위기 대응이 끝나기 전에 프라임브로커리지 사업 전면 철수를 발표하면 질서 있는 실패로 종료됩니다(부분점수).',
    },
  ],
  endings: [
    {
      id: 'collateral_held',
      when: {
        all: [
          { metric: 'realizedLoss', lt: 1.0 },
          { metric: 'industryLoss', lt: 6.0 },
          { notFlag: 'sold_first' },
        ],
      },
      title: '담보가 만든 결과',
      narrative:
        '손실은 배정자본의 10%에 못 미쳤고, 업계 합산 손실도 실제 기록($100억 초과)의 절반 이하에 머물렀습니다. 먼저 팔지 않고도 이 결과를 얻은 이유는 위기 주간의 대응이 아니라 2020년의 마진 체계입니다 — 실제로 담보를 25% 수준으로 잡았던 은행들은 손실이 미미했습니다. 에필로그: 2021년 12월 PRA·FCA 공동 서한은 마진 방식과 온보딩 후 재평가를 업계 결함으로 지적했고, 2024년 BCBS 카운터파티 신용리스크 관리 기준과 2025년 FSB 권고가 그 내용을 기준으로 굳혔습니다. 귀 사업부는 그 기준을 이미 충족한 채 그 문서들을 읽게 됩니다. 대가는 수수료였습니다.',
    },
    {
      id: 'contained',
      when: { metric: 'realizedLoss', lt: 3.0 },
      title: '줄인 손실, 남은 질문',
      narrative:
        '손실은 통제되었지만 배정자본의 일부가 사라졌고 정리 과정에서 시장 충격이 남았습니다. 에필로그: 2023년 7월 24일 연준($268.5m)·PRA(£87m)·FINMA가 조율된 처분을 내렸고, 처분의 근거는 손실 규모가 아니라 "반복된 경고에도 관리하지 못했다"는 사실이었습니다. 디브리핑의 결정 지점 비교를 보십시오 — 손실의 대부분은 2021년 3월이 아니라 2020년에 결정되었습니다.',
    },
    {
      id: 'billed',
      title: '청구서',
      narrative:
        '한 고객이 사업부 배정자본의 상당 부분을 가져갔습니다. 에필로그: 업계 합산 손실은 $100억을 넘었고, 담보를 두껍게 잡고 먼저 움직인 은행들은 손실이 미미했던 반면 담보가 얇고 늦게 움직인 두 곳이 손실의 80%를 부담했습니다. 2021년 7월 독립조사 보고서는 "경영과 통제의 근본적 실패"라고 결론지었고 23명이 징계를 받았으며 $70m의 보수가 환수되었습니다. 2021년 11월에는 프라임서비스 철수가 결정되었고, 2023년 7월 24일 연준·PRA·FINMA의 처분이 확정되었습니다. 사기나 위법 행위의 증거는 없었습니다 — 그것이 이 사건의 가장 불편한 부분입니다.',
    },
  ],
  scoring: archegosScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-a'],
        't0-d2': ['t0-d2-a'],
        't1-d1': ['t1-a'],
        't1-d2': ['t1-d2-a'],
        't1-d3': ['t1-d3-a'],
        't2-d1': ['t2-a'],
        't3-d1': ['t3-c'],
        't3-i1-client': ['t3-i1-defer'],
        't4-d1': ['t4-c'],
        't4-i2-peer': ['t4-i2-silent'],
        't5-i1-desk': ['t5-i1-partial'],
        't5-d1': ['t5-a'],
        't6-d1': ['t6-a'],
        't6-d2': ['t6-d2-c'],
      },
      note: '크레디트스위스 프라임서비스의 경로다(알파인이 1차적으로 모델로 삼은 은행). 한도 상향(2020.4) → 동적 마진 전환 결의만(2020 하반기) → 초과 담보 $2.4bn 상당 반환(2021.3 초) → 증자 후 관망(3/23) → 마진콜 하루 유예(3/24) → 검증 없는 구두 스탠드스틸(3/25) → 주도 블록에 일부만 참여하고 장중 분할(3/26, 명목 $30억 남짓) → 즉시 공시 + 독립조사 → 프라임서비스 철수(11월). 체크포인트: 3/24 마진 수령 0, 비아콤CBS 종가 $70.10·$48.23, 3/26 자사 매각 명목 ≈$3bn, 모건스탠리+골드만삭스 블록 ≈$18.5bn, 최종 실현 손실 ≈$5.5bn, 업계 합산 ≈$10.4bn.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-c'],
        't0-d2': ['t0-d2-b'],
        't1-d1': ['t1-b'],
        't1-d2': ['t1-d2-b'],
        't1-d3': ['t1-d3-c'],
        't2-d1': ['t2-b', 't2-c'],
        't3-d1': ['t3-a'],
        't3-i1-client': ['t3-i1-probe'],
        't4-d1': ['t4-b'],
        't4-i2-peer': ['t4-i2-verify'],
        't5-i1-desk': ['t5-i1-negotiate'],
        't5-d1': ['t5-b'],
        't6-d1': ['t6-e'],
        't6-d2': ['t6-d2-b'],
      },
      note: '위기 이전에 결정되는 경로다. 이사회 에스컬레이션 + 청산 소요일 한도(2020.4) → 동적 마진 + 집중도 가산 시행, 초과 담보 유보, 익명 집계로 업계 총량 확인(2020 하반기) → 가산 담보 소급 부과 + 집중 종목 20% 선제 축소(3/23) → 유예 없이 전액 수령(3/24) → 낮은 일일 상한 + 제3자 검증 스탠드스틸(3/25) → 잔여 규모 공개 후 상한 내 매각(3/26) → 공시·독립조사·시정계획 동시 발표. 손실은 배정자본의 10% 미만에 머물지만 연간 수수료의 상당 부분을 잃는다.',
    },
  },
  checkpoints: [
    {
      turnId: 't3',
      counter: 'marginReceived',
      expected: 0,
      tolerance: 0.15,
      absTolerance: 0.3,
      label: '3/24 마진콜 수령액 0 — 유예 후 담보는 들어오지 않았다 [paul-weiss-cs-archegos-2021]',
    },
    {
      turnId: 't3',
      metric: 'market.viac',
      expected: 69.86,
      tolerance: 0.03,
      label: '3/24 비아콤CBS 종가 $70.10 (3/22 $100.34 = 100 기준 69.86) [로이터·FXStreet]',
    },
    {
      turnId: 't5',
      metric: 'market.viac',
      expected: 48.06,
      tolerance: 0.03,
      label: '3/26 비아콤CBS 종가 $48.23 (−27.31%, 지수 48.06) [로이터]',
    },
    {
      turnId: 't5',
      counter: 'blockSoldNotional',
      expected: 3.0,
      tolerance: 0.2,
      absTolerance: 0.6,
      label:
        '3/26 자사 매각 명목 ≈$3bn — "CS는 3월 26일에 명목 $30억 남짓만 매도했다" [paul-weiss-cs-archegos-2021]',
    },
    {
      turnId: 't5',
      counter: 'msGsBlockNotional',
      expected: 18.5,
      tolerance: 0.15,
      label:
        '3/26 종료 시점 모건스탠리+골드만삭스 블록 ≈$18.5bn — 제2순회항소법원 "약 $200억" [press-block-trades-2021-03-29]',
    },
    {
      turnId: 't6',
      metric: 'realizedLoss',
      expected: 5.5,
      tolerance: 0.15,
      label: '자사 실현 손실 $5.5bn [paul-weiss-cs-archegos-2021]',
    },
    {
      turnId: 't6',
      metric: 'industryLoss',
      expected: 10.4,
      tolerance: 0.15,
      label:
        '업계 합산 손실 $10.4bn — PRA·FCA "$100억 초과", 개별 공시 합계 [pra-fca-equity-finance-2021]',
    },
  ],
  debrief: archegosDebrief,
})

export default scenario
