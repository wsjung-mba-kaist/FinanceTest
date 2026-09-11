import type { PrimeBrokerState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { ltcmDebrief } from './debrief'
import { ltcmInitialConfidence, ltcmInitialMarket, ltcmInitialPb } from './initialState'
import { ltcmScoring } from './scoring'
import { LTCM_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<PrimeBrokerState> = defineScenario<PrimeBrokerState>({
  meta: {
    id: 'ltcm-1998',
    version: 1,
    title: '컨소시엄',
    subtitle: '1998년 LTCM 구제 — 해밀턴로스 프라임브로커리지',
    era: '1998-09',
    year: 1998,
    region: 'global',
    role: 'pb_risk_head',
    roleTitle: '프라임브로커 리스크 헤드',
    institutionType: 'prime_broker',
    institutionName: '해밀턴로스(Hamilton Ross & Co.) 프라임브로커리지·파생 부문',
    modelledOn:
      '주로 Merrill Lynch & Co.(9/22 코어그룹 3사 중 하나, LTCM의 선물 청산 브로커, 컨소시엄 $300M 분담)를 본뜬 합성 딜러. ' +
      '코어그룹 운영과 작업반 구성은 Goldman Sachs·J.P. Morgan(및 9/22 추가된 UBS)의 기록을, ' +
      '청산 대리인의 결제 익스포저 담보 요구는 Bear Stearns의 기록을 참고했다. ' +
      '대차대조표·한도·담보 수치는 어느 실명 기관의 공시도 아니며 양식화·보정된 값이다(calibration.md §0).',
    difficulty: 'advanced',
    durationTurns: 6,
    turnUnit: 'day',
    estMinutes: 30,
    timezone: 'America/New_York',
    learningObjectives: [
      {
        id: 'lo1',
        text: '파생 명목·순대체원가·순익스포저·청산 손실을 구분하고, 담보가 덮는 범위와 덮지 못하는 범위를 설명한다.',
        competency: 'marketRisk',
        decisionIds: ['t0-d1', 't1-d1', 't3-d1', 't5-d2'],
      },
      {
        id: 'lo2',
        text: '담보 재산정의 강도와 시점을 고객의 납입 능력·계약상 권리·시장 마크를 함께 고려해 결정한다.',
        competency: 'marketRisk',
        decisionIds: ['t1-d1', 't3-d1', 't3-i1-desk'],
      },
      {
        id: 'lo3',
        text: '합산 익스포저를 알 수 없는 구조적 정보 결핍을 인식하고, 정보를 얻는 합법적 수단과 그 대가를 비교한다.',
        competency: 'communication',
        decisionIds: ['t0-d1', 't2-d1', 't3-d1', 't4-i1-frbny'],
      },
      {
        id: 'lo4',
        text: '집단행동 문제(공동 출자 대 무임승차)를 자기 손실 함수로 계산하고, 다른 참가자의 반응을 예측한다.',
        competency: 'policy',
        decisionIds: ['t4-d1', 't5-d1', 't5-i1-peer'],
      },
      {
        id: 'lo5',
        text: '청산 속도가 실현 손실을 만드는 메커니즘을 설명하고, 자사 포지션과 공동 포트폴리오 모두에 적용한다.',
        competency: 'solvency',
        decisionIds: ['t3-i1-desk', 't5-d1', 't5-d2'],
      },
    ],
    competencies: { marketRisk: 3, policy: 2, communication: 2, solvency: 1, compliance: 1 },
    tags: ['레버리지', '수렴 거래', '담보 재산정', '합산 익스포저', '컨소시엄', '집단행동'],
    sources: LTCM_SOURCES,
  },
  units: { currency: 'USD', scale: 1e9, display: 'B' },
  initialState: {
    institution: ltcmInitialPb,
    market: ltcmInitialMarket,
    confidence: ltcmInitialConfidence,
    regulatorLevel: 0,
    flags: {},
    counters: {
      consortiumPledgeM: 0,
      marginCallM: 0,
      infoShared: 0,
      remarginRounds: 0,
    },
  },
  briefing: {
    situation: `1998년 8월 17일 월요일 아침. 귀하는 월가 대형 딜러 **해밀턴로스(Hamilton Ross & Co.)**의 프라임브로커리지·파생 부문 리스크 헤드입니다.

오늘 아침 러시아가 루블의 실질 평가절하와 채무 모라토리엄을 선언했습니다. 신흥국 국채와 고수익 회사채가 동시에 밀리고 미 국채로 자금이 몰리고 있습니다.

귀하의 최대 헤지펀드 고객은 **Long-Term Capital Portfolio, L.P.**입니다. 우리와의 총명목은 $96B, 순대체원가는 사실상 0입니다. 초기증거금은 받지 않고 있고, 담보는 현재 대체원가만 덮습니다. 우리가 파악한 이 고객의 다른 주요 거래상대는 8곳입니다 — 실제로 몇 곳인지는 알 방법이 없습니다.

시나리오는 6턴입니다: 8/17(월) 모라토리엄 → 9/2(수) 투자자 서한 → 9/18(금) 증자 실패와 뉴욕연준의 전화 → 9/21(월) 담보 재산정 → 9/22(화) 회의실 → 9/23(수) 컨소시엄. 마지막 세 턴은 하루를 여러 틱으로 나누어 진행합니다.`,
    mandate: `**권한**: 담보·마크·한도·초기증거금 정책을 결정하고, 익스포저 정보의 공유 여부를 정하며, 자사 자기매매 수렴 북의 규모를 조정할 수 있습니다. 공동 출자 참여와 그 금액은 최종적으로 경영위원회 소관이지만, 게임에서는 리스크 헤드의 권고가 채택됩니다.

**불가능한 행동**: 기존 계약의 담보 조건을 소급해 일방 변경하는 것, 디폴트 사유 발생 전에 담보를 처분하는 것, 고객의 거래 정보를 자기매매에 이용하는 것. 감독당국에 헤지펀드를 규제해 달라고 요구하는 것도 불가능합니다 — 1998년에 연준은 헤지펀드에 대한 규제 권한이 없었습니다.

**목표**: 이 고객의 디폴트가 일어나든 일어나지 않든, 부문의 손실을 통제하고 시장이 멈추지 않게 하십시오.`,
    institutionProfile: `| 항목 | 값 | 비고 |
|---|---|---|
| 부문 배정 자본 | $9B | 손실이 여기서 차감됩니다 |
| 즉시 가용 자금 | $6.5B | 출자·담보 납입에 사용 |
| LTCM 총명목(우리 몫) | $96B | 스왑 스프레드 42 · 온오프더런 26 · 주가지수 변동성 14 · 신흥국 9 · 합병차익 5 |
| 순대체원가 | ≈$0 | 수렴지수 1포인트당 $10M |
| 예치 담보 | $0 | 초기증거금 없음 |
| 파악된 고객의 다른 거래상대 | 8곳 | 실제 수는 알 수 없음 |
| 자사 자기매매 수렴 북 | $18B | 고객과 **같은 방향** |
| 신용한도 | $120B | 총명목 기준 |

**알려진 취약점(8/17 인지 수준)**: 초기증거금이 없어 담보가 현재 대체원가만 덮습니다. 고객의 합산 레버리지와 거래상대 수를 모릅니다. 자사 자기 북이 고객과 같은 거래를 하고 있습니다. 청산 소요일이 가장 긴 포지션(신흥국 베이시스)은 참여율 20% 기준 15영업일입니다.`,
    marketBackdrop: `FF 목표금리 5.50%(1997년 3월 이후 불변). 8월 14일 종가 기준 미 국채 10년 5.40%, 2년 5.34%, 30년 5.55%, 무디스 Baa−10년 174bp, Baa−Aaa 62bp, TED 79bp, VIX 34.34.

1997년 아시아 위기 이후 신흥국 위험에 대한 경계가 남아 있는 상태에서 러시아의 결정이 나왔습니다. 이후 6주 동안 안전자산 선호가 계속되어 10년 국채는 9월 23일 4.69%까지 내려가고, Baa−10년은 238bp까지 벌어집니다. 신용스프레드와 자금시장 스트레스의 **정점은 9월이 아니라 10월**입니다 — 연준은 10월 15일 정례 회의 밖에서 FF 목표를 5.00%로 내렸습니다.`,
    stakeholders: [
      {
        name: '경영위원회·이사회',
        wants: '부문 손실 통제, 평판 보호, 자본의 효율적 사용',
        canDo: '공동 출자 승인, 한도·정책 승인, 리스크 헤드 교체',
      },
      {
        name: 'LTCM(고객)',
        wants: '담보 유예, 시간, 정보 비공개 유지',
        canDo: '거래 이전, 자료 제공 중단, 마크 분쟁 제기, 그리고 디폴트',
      },
      {
        name: '다른 프라임브로커·딜러',
        wants: '자기 익스포저 최소화, 그리고 남이 먼저 움직이지 않기',
        canDo: '정보 교환 수락·거부, 선제 청산, 공동 출자 참여·불참',
      },
      {
        name: '뉴욕연방준비은행',
        wants: '무질서한 동시 청산 회피, 시장 기능 유지',
        canDo: '회의실과 시간 제공, 시장 정보 수집. **자금 투입·보증·규제 강제는 불가**',
      },
      {
        name: '자사 자기매매 데스크',
        wants: '수렴 포지션 유지, 되돌림 수익',
        canDo: '북 확대·축소. 고객의 청산이 이 북의 마크를 먼저 친다',
      },
      {
        name: '영업 총괄',
        wants: '고객 관계 유지, 수수료 수익',
        canDo: '담보 요구 지연 설득, 경영위원회에 이의 제기',
      },
      { name: '언론', wants: '속보', canDo: '소문 증폭, 회의 사실 보도' },
    ],
    regulatoryFramework: `- **감독 권한의 공백**: 연준은 헤지펀드에 대한 규제 권한이 없었습니다(McDonough: "the Federal Reserve has no regulatory authority over hedge funds"). 딜러 쪽에는 은행감독·SEC 순자본규칙이 적용되지만, 고객의 합산 레버리지를 볼 권한은 어디에도 없었습니다.
- **담보 약정(CSA) 실무**: 담보는 현재 대체원가(current replacement cost)를 덮고, 손실 임계(threshold) 이하에서는 부르지 않으며, 미납에는 유예기간이 있습니다. 초기증거금은 경쟁 압력으로 사실상 사라진 상태였습니다.
- **처분권**: 담보 처분은 디폴트 사유 발생과 유예기간 경과 후에만 가능합니다. 그 전 처분은 계약 위반이며 감독당국의 즉시 조치 사유입니다.
- **사후 규제 대응**: LTCM 이후 BCBS 45·46(1999-01-28)이 고레버리지기관 거래의 건전 관행을 권고했고, PWG(1999-04-28)가 레버리지와 시스템 리스크에 관한 공식 사후평가를 냈습니다.
- **감독 단계 R0~R4**: 정상(R0) → 강화 모니터링(R1) → 제한(R2) → 조사·현장(R3) → 즉시 조치(R4: 계약 근거 없는 담보 처분, 고객 정보의 자기매매 이용).
- **게임오버**: 계약 근거 없는 담보 처분(R4) · 과도한 청구로 인한 고객 조기 디폴트 · 부문 자본 잠식 · 공동 출자 결렬에 따른 무질서한 동시 청산.`,
    cardRefs: [
      'hqla-and-haircuts',
      'economic-vs-regulatory-capital',
      'crisis-communication',
      'fdic-resolution-weekend',
      'regulator-escalation-ladder',
      'tri-party-repo-run',
    ],
    simplificationNotes: [
      '해밀턴로스는 합성 딜러다. 부문 자본 $9B, 가용 자금 $6.5B, 총명목 $96B, 신용한도 $120B, 자사 수렴 북 $18B는 모두 양식화·보정된 값이며 어느 실명 기관의 공시도 아니다.',
      'LTCM과의 익스포저를 다섯 개 상품군으로 나눈 것과 각 상품군의 명목·변동성·일평균 거래대금은 보정값이다. 공개 기록에 있는 것은 LTCM 전체의 명목($1.4조)과 거래상대 수(75곳 이상)뿐이다.',
      '수렴 스프레드 종합지수는 10년 스왑 스프레드·온오프더런 스프레드·Baa−Aaa 품질 스프레드의 가중 합성지수(8/14 = 100)다. 검증 가능한 것은 Baa−Aaa뿐이고 나머지 두 계열의 일별 수치는 미확인이다 — 형상의 근거는 CGFS Papers 12의 Chart 8·12다.',
      'LTCM의 자본 경로 중 문서로 확정된 것은 \'97말 $4.8B · 7/31 $4.1B · 8/31 $2.3B이며, 9/18·9/21·9/22 값은 보간, 9/23의 ≈$0.4B는 GAO의 "순자산의 90%"에서 역산한 값이다. 고객의 납입 가능 현금은 전부 보정값이다.',
      '타 딜러의 실제 분담액(11사 × $300M + $125M + $100M + $100M = $3,625M)은 McDonough 증언과 Fed History 총액에서 역산했다. 각 사의 **참여 임계값**은 게임 보정값이며, 확인되는 것은 결과뿐이다.',
      '컨소시엄 출자 제시액 선택지($100M / $250M / $350M)는 균등 분담 $300M을 기준으로 만든 것이지 실제 협상에서 오간 숫자가 아니다. $250M 제시는 회의에서 핵심 참가사의 균등 분담 $300M으로 수렴한다.',
      '9/21·9/22·9/23의 일중 틱과 그 시간대별 분포는 양식화다. 공개된 것은 종가와 회의 시각뿐이다. 9/23의 합의는 실제로 오후 6시경이었으나 마지막 틱(16:00 시장 마감)으로 압축했다.',
      '**중간에 걸려 오는 전화와 협상 대화의 모든 대사는 공개 기록을 바탕으로 한 재구성이며 녹취·속기록이 아니다.** 자기매매 데스크 헤드와 타 딜러 리스크 총괄은 합성 상대이고, 뉴욕연준 소집은 시각·참석 규모·결과만 McDonough 증언에 근거하며 문구는 각색이다.',
      '외부 투자자 그룹의 구성과 제안 금액은 1차 사후평가에 없어 특정하지 않는다. 확인되는 것은 제안의 존재와 12시 30분 시한뿐이다.',
      '투기등급 스프레드(초기값 374bp)·10년 스왑 스프레드(57bp)·온·오프더런 스프레드(9bp)는 CGFS Papers No 12 부록표(A1·A2·A6)의 **하위기간 평균**에서 도출한 값이며 8/14 당일 종가가 아니다[CAL]. 국채 금리·VIX·TED·무디스 Baa/Aaa는 FRED에서 직접 조회한 일별 종가다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(대통령 실무그룹 보고서, 뉴욕연준·연준 이사회 의회 증언, GAO 보고서, BIS/CGFS·BCBS 문헌, FRED 시계열)를 바탕으로 교육 목적으로 재구성한 것입니다. LTCM·뉴욕연방준비은행·컨소시엄 참여 기관은 실재하지만, 플레이어가 맡는 기관은 합성이며 모든 대사는 공개 기록을 바탕으로 한 재구성입니다 — 녹취나 속기록이 아닙니다.',
    executiveSummary: {
      situation:
        '러시아 모라토리엄으로 수렴 거래가 동시에 반대로 벌어졌다. 최대 헤지펀드 고객의 자본이 6주 만에 $4.1B에서 $0.4B로 줄어드는 동안, 우리는 명목 $96B를 안고 있으면서 그 고객의 합산 레버리지를 모른다.',
      mandate:
        '담보·마크·정보·집단행동에 관한 결정을 내려 부문 손실을 통제하고 무질서한 동시 청산을 피한다.',
      objective:
        '9월 23일에 컨소시엄이 성립하도록 하면서, 그 과정에서 한 번도 무담보였던 적이 없게 한다.',
      keyJudgements: [
        '담보 재산정을 언제 얼마나 세게 할 것인가 — 세게 하면 고객이 무너지고, 느슨하게 하면 우리가 떠안는다.',
        '합산 익스포저를 알 수 없다는 사실 자체에 무엇을 할 것인가 — 요구할 것인가, 교환할 것인가, 살 것인가.',
        '공동 출자에 들어갈 것인가 빠질 것인가 — 그리고 우리 선택이 다른 참가사의 선택을 어떻게 바꾸는가.',
        '질서 있는 청산의 속도 — 자본을 넣어 사는 것은 지분이 아니라 시간이다.',
      ],
      preflight: [
        {
          id: 'pf1',
          label: '명목과 순익스포저',
          question: '총명목 $96B 가운데 오늘 실제로 손실 위험에 노출된 금액은 얼마입니까?',
          metrics: ['grossExposure', 'netExposureB'],
        },
        {
          id: 'pf2',
          label: '군집 청산',
          question:
            '청산 손실 추정치는 무엇을 곱해서 나옵니까? 그 곱하는 수를 우리가 알고 있습니까?',
          metrics: ['closeoutLossB', 'knownCounterpartyCount'],
        },
        {
          id: 'pf3',
          label: '담보의 한계',
          question: '담보가 덮는 것은 어느 시점의 무엇입니까? 덮지 못하는 것은 무엇입니까?',
          metrics: ['marginCoverage', 'netExposureB'],
        },
      ],
    },
  },
  kpis: [
    {
      metric: 'netExposureB',
      label: '순익스포저(담보 차감 후)',
      labelEn: 'Net Exposure after Collateral',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: 'max(0, 순대체원가 − 예치 담보). 총명목과 자릿수가 다르다',
      decimals: 2,
    },
    {
      metric: 'closeoutLossB',
      label: '청산 손실(자사 추정)',
      labelEn: 'Estimated Close-out Loss',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description:
        '순익스포저 + 청산 VaR × 군집계수. 군집계수는 **우리가 아는 거래상대 수**로 계산된다',
      decimals: 2,
    },
    {
      metric: 'marginCoverage',
      label: '마진 커버리지',
      labelEn: 'Margin Coverage',
      unit: '%',
      sparkline: true,
      description: '예치 담보 ÷ 청산 VaR',
      decimals: 0,
    },
    {
      metric: 'grossExposure',
      label: 'LTCM 총명목(우리 몫)',
      labelEn: 'Gross Notional with LTCM',
      unit: 'ccy',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'peerCooperation',
      label: '타 딜러 협조도',
      labelEn: 'Peer Cooperation',
      unit: 'index',
      sparkline: true,
      description: '9월 23일 각 참가사의 참여 여부를 결정한다 (상한 90)',
      decimals: 0,
    },
    {
      metric: 'realizedLoss',
      label: '누적 손실(평가·실현 합계)',
      labelEn: 'Cumulative Loss',
      unit: 'ccy',
      sparkline: true,
      decimals: 2,
    },
  ],
  thresholds: {
    netExposureB: { warn: 0.25, breach: 0.6, direction: 'above' },
    closeoutLossB: { warn: 0.3, breach: 0.6, direction: 'above' },
    marginCoverage: { warn: 80, breach: 40, direction: 'below' },
    peerCooperation: { warn: 45, breach: 30, direction: 'below' },
    firmCapital: { warn: 8.4, breach: 7.9, direction: 'below' },
  },
  turns: [...turnsA, ...turnsB],
  /**
   * 라이브 플레이(variance 1)에서만 쓰이는 크기 노이즈. variance 0(정본·체크포인트)에서는 엔진이
   * 난수를 아예 당기지 않는다. 하우스 기본값에서 `tickerSigmaBp`만 2 → 1로 낮췄다: 이 시나리오의
   * 절대 티커가 bp 단위 국채 금리와 **지수 단위 VIX**를 함께 움직이기 때문이다(VIX에 ±2 노이즈는
   * 하루 변동폭보다 크다). calibration.md §6.4.
   */
  noise: {
    runoffSigma: 0.12,
    runoffCap: 0.3,
    tickerSigma: 0.01,
    tickerSigmaBp: 1,
    eventJitter: 1,
  },
  gameOver: [
    {
      id: 'unsafe_act',
      when: { regulator: { gte: 4 } },
      reason: 'unsafe_act',
      title: '감독당국 즉시 조치 — 계약 근거 없는 담보 처분',
      narrative:
        '디폴트 사유가 발생하기 전에 고객 담보를 처분한 사실이 확인되어 감독당국이 즉시 조치에 들어갔습니다. 고객은 계약 위반을 주장하며 소송을 제기했고, 다른 딜러들은 9월 22일 회의에 우리를 부르지 않았습니다. 익스포저는 오늘 사라졌고, 우리가 앉을 자리는 내일 사라졌습니다.',
      failed: true,
      ruleText:
        '감독당국 단계가 R4에 도달하면 종료됩니다 (계약 근거 없는 담보 처분, 고객 정보의 자기매매 이용).',
    },
    {
      id: 'early_default',
      when: { flag: 'ltcm_early_default' },
      reason: 'client_default',
      title: '고객 조기 디폴트 — 단독·동시 청산',
      narrative:
        '납입 가능액을 넘는 청구가 미납으로 이어져 디폴트 사유가 발생했습니다. 회의가 열리기 전에 상위 거래상대들이 동시에 청산에 들어갔고, 호가는 순식간에 벌어졌습니다. 우리가 며칠 앞서 확보한 담보는 그 손실의 일부만 덮었습니다.',
      failed: true,
      ruleText:
        '고객의 납입 가능 현금을 넘는 담보를 청구해 미납이 발생하면, 다음 날 아침 디폴트 사유가 확정되어 종료됩니다.',
    },
    {
      id: 'capital',
      when: { metric: 'firmCapital', lt: 7.9 },
      reason: 'capital',
      title: '부문 자본 잠식',
      narrative:
        '고객 익스포저와 자사 수렴 북에서 동시에 발생한 손실이 부문 배정 자본의 12%를 넘었습니다. 경영위원회가 프라임브로커리지·파생 부문의 신규 거래를 중단시켰습니다.',
      failed: true,
      ruleText: '부문 자본이 $7.9B 미만이 되면 종료됩니다 (누적 손실 $1.1B 초과).',
    },
    {
      id: 'disorderly_closeout',
      when: { flag: 'deal_failed' },
      reason: 'disorderly_closeout',
      title: '공동 출자 결렬 — 무질서한 동시 청산',
      narrative:
        '총액이 성립선에 닿지 않아 회의가 끝났습니다. 다음 날 아침 상위 카운터파티들이 동시에 포지션을 종료하기 시작했고, 국채·스왑 시장의 호가가 벌어지며 수렴 스프레드가 다시 크게 확대되었습니다. 우리 자기 북도 같은 방향으로 맞았습니다. McDonough가 우려한 시나리오가 그대로 일어났습니다 — "Markets would have moved sharply and losses would have been exaggerated."',
      failed: true,
      ruleText:
        '공동 출자 총액이 성립 최소선($3,300M)에 못 미치면 회의가 결렬되고 종료됩니다. 총액은 우리 분담액과 타 딜러의 참여로 결정되며, 타 딜러의 참여는 협조도와 우리 출자 신호에 반응합니다.',
    },
  ],
  endings: [
    {
      id: 'orderly_wind_down',
      when: { all: [{ flag: 'deal_closed' }, { flag: 'joined_consortium' }] },
      title: '질서 있는 청산',
      narrative:
        '9월 23일 오후, 다섯 시간의 논의 끝에 참가사들이 공동 출자와 지분 90% 인수에 합의했습니다. 출자금은 9월 28일에 집행되었고, 포지션은 시간을 두고 정리되어 이듬해 말 펀드가 청산되었습니다. 연준의 자금은 한 푼도 들어가지 않았습니다. 우리가 산 것은 지분이 아니라 시간이었습니다. 남은 질문은 하나입니다 — 우리는 왜 8월 17일에 이미 알 수 있었던 것을 9월 22일에야 알았습니까.',
    },
    {
      id: 'free_rider',
      when: { all: [{ flag: 'deal_closed' }, { flag: 'stayed_out' }] },
      title: '무임승차 — 배는 떴다',
      narrative:
        '우리는 출자하지 않았고 합의는 성립했습니다. 자본은 묶이지 않았고 청산은 질서 있게 진행되었으며, 우리 익스포저는 재자본화된 펀드를 상대로 정리되었습니다. 계산은 맞았습니다. Furfine(2001)이 보인 것처럼, 참여하지 않은 대형은행의 조달금리는 오히려 낮아졌습니다. 그러나 그 계산은 다른 참가사가 충분히 들어왔기 때문에만 맞았고, 회의실의 몇몇은 그것을 기억합니다.',
    },
    {
      id: 'default',
      title: '시나리오 종료',
      narrative:
        '1998년 10월 15일, 연준은 정례 회의 밖에서 연방기금금리 목표를 5.00%로 내렸습니다. 수렴 스프레드가 되돌아오기 시작한 것은 그 뒤였습니다.',
    },
  ],
  scoring: ltcmScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-a'],
        't1-d1': ['t1-b'],
        't2-d1': ['t2-c'],
        't3-d1': ['t3-strict'],
        't3-i1-desk': ['t3-i1-hold'],
        't4-d1': ['t4-consortium'],
        't4-i1-frbny': ['t4-i1-attend'],
        't5-d1': ['t5-join-orderly'],
        't5-d2': ['t5-d2-staged'],
        't5-i1-peer': ['t5-i1-exchange'],
      },
      note: '주로 메릴린치의 경로다: 8/17 담보 조건 유지 → 9/2 일일 재산정 개시(중간값 마크) → 9/18 뉴욕연준 통화에 우려 전달 → 9/21 청산가치 마크로 재산정, 자기 북 유지 → 9/22 연준 회합 참석·컨소시엄 작업반 → 9/23 균등 분담 $300M 출자·질서 있는 청산. 체크포인트: 출자 총액 $3,625M, 참여 14개사, LTCM 자본 8/31 $2.3B → 9/23 ≈$0.4B, 명목 ≈$1.4T.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-b', 't0-d'],
        't1-d1': ['t1-b'],
        't2-d1': ['t2-b', 't2-c'],
        't3-d1': ['t3-negotiated'],
        't3-i1-desk': ['t3-i1-reduce'],
        't4-d1': ['t4-consortium', 't4-lift'],
        't4-i1-frbny': ['t4-i1-attend'],
        't5-d1': ['t5-join-orderly'],
        't5-d2': ['t5-d2-staged'],
        't5-i1-peer': ['t5-i1-lead'],
      },
      note: '초기증거금 도입 + 딜러 간 총량 익스포저 교환(8/17) → 중간값 마크 일일 재산정(9/2) → 교환 한 번 더 + 연준 통화(9/18) → 유예의 대가로 합산 명세 확보, 자기 북 절반 축소(9/21) → 연준 회합에 자료 지참 + 두 작업반 참여(9/22) → 선제 제시 후 균등 분담 출자·질서 있는 청산(9/23). 결말은 역사와 같지만 한 번도 무담보였던 적이 없고 합산을 사흘 먼저 안다.',
    },
  },
  checkpoints: [
    {
      turnId: 't1',
      metric: 'ltcmCapitalB',
      expected: 2.3,
      tolerance: 0.05,
      label: 'LTCM 자본 8/31 = $2.3B (PWG: "The Fund\'s capital base was now $2.3 billion")',
    },
    {
      turnId: 't0',
      metric: 'ltcmNotionalB',
      expected: 1400,
      tolerance: 0.05,
      label:
        'LTCM 명목 파생 ≈$1.4T (선물 >$500B + 스왑 >$750B + 옵션·기타 OTC >$150B; $1.25T는 PWG 수치가 아니다)',
    },
    {
      turnId: 't5',
      metric: 'ltcmCapitalB',
      expected: 0.4,
      tolerance: 0.25,
      absTolerance: 0.15,
      label:
        'LTCM 자본 9/23 출자 직전 ≈$0.4B (GAO: 출자 $3.6B = 순자산의 90% → 원소유자 10% 역산). 0 근처 목표이므로 절대 허용오차 병용',
    },
    {
      turnId: 't5',
      counter: 'consortiumPledgeM',
      expected: 250,
      tolerance: 0.01,
      label: '역사 경로의 출자 제시액 $250M (회의에서 핵심 11개사 균등 분담 $300M으로 확정)',
    },
    {
      turnId: 't5',
      metric: 'consortiumTotalM',
      expected: 3625,
      tolerance: 0.05,
      label: '컨소시엄 출자 총액 $3,625M (Fed History; GAO "about $3.6 billion")',
    },
    {
      turnId: 't5',
      metric: 'peerJoinCount',
      expected: 14,
      tolerance: 0.08,
      absTolerance: 1,
      label: '컨소시엄 참여 기관 수 14곳 (GAO 명단; 베어스턴스·크레디아그리콜 불참)',
    },
  ],
  debrief: ltcmDebrief,
})

export default scenario
