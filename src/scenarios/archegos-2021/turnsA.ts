import type { Interrupt, PrimeBrokerState, Turn } from '../../engine/types'
import { commitReplies } from '../../engine'
import { confidence, counter, flag, op, regulator } from '../../engine/fx/common'
import { archegosFx } from './fx'

type T = Turn<PrimeBrokerState>

export const S = {
  pw: 'paul-weiss-cs-archegos-2021',
  sec: 'sec-pr-2022-70',
  fed: 'fed-enforcement-archegos-2023',
  pra: 'pra-cs-archegos-2023',
  finma: 'finma-archegos-2023',
  dearCeo: 'pra-fca-equity-finance-2021',
  bcbs: 'bcbs-ccr-guidelines-2024',
  bcbsNl: 'bcbs-nbfi-newsletter-2022',
  fsb: 'fsb-nbfi-leverage-2025',
  senate: 'senate-banking-archegos-2021',
  cgfs: 'cgfs-36',
  pwg: 'pwg-hedge-funds-1999',
  csQ1: 'cs-q1-2021-results',
  nomura: 'nomura-20f-fy2021',
  ms: 'ms-q1-2021',
  ubs: 'ubs-q1-2021',
  viac: 'viacomcbs-offering-2021-03',
  vix: 'fred-vixcls',
  ust: 'fred-dgs10',
  pressMs: 'press-ms-overnight-2021-04-06',
  pressStand: 'press-standstill-2021-03-30',
  pressBlock: 'press-block-trades-2021-03-29',
  pressExit: 'press-cs-pb-exit-2021-11-04',
}

/** 3/24 일중 누적 분포. 증자 가격이 전날 밤 확정되어 개장 갭이 컸다 [STYLIZED calibration.md §2]. */
export const T3_SHAPE = [0, 0.45, 0.68, 0.86, 1.0]
/** 3/24 책 가치가중 종가 배수 −11.12% [CAL calibration.md §2]. */
export const T3_DAY_FACTOR = 0.8888

// ---------------------------------------------------------------------------------------------
// T0 — 2020년 4월 "한도의 10배"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2020년 4월 (프롤로그 ①)',
  title: '한도의 10배',
  time: '2020-04-01T09:00:00-04:00',
  events: [
    {
      id: 't0-memo-ccr',
      kind: 'memo',
      time: '4/1 08:30',
      from: '카운터파티 신용리스크팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '아케고스 캐피털 — 잠재익스포저(PE) 한도 초과 보고',
      body: `- 승인 PE 한도: **$20m**. 현재 PE: **$200m** — 한도의 **10배**입니다.
- 총수익스와프(TRS) 명목 $3.0bn, 담보 $225m(정적 마진 7.5%). 2019년 고객 협상으로 스왑 마진이 약 20%에서 7.5%로 낮아진 이후 한 번도 재산정되지 않았습니다.
- 담보율 7.5%는 업계 표준(15~25%)의 절반 이하입니다. 같은 포지션에 대해 다른 프라임브로커가 어떤 조건을 주는지는 알 수 없습니다.
- 대응 선택지: (1) 한도를 실제 익스포저에 맞춰 상향, (2) 익스포저 축소 요구, (3) 동적 마진 전환, (4) 그룹 리스크위원회 에스컬레이션.`,
      severity: 'warning',
      sourceRefs: [S.pw, S.finma],
      cardRefs: ['economic-vs-regulatory-capital'],
      relatedMetrics: ['grossExposure', 'marginCoverage', 'concentrationDays'],
    },
    {
      id: 't0-data-book',
      kind: 'data',
      time: '4/1 08:45',
      title: '아케고스 포지션 현황 (TRS 기초자산)',
      rows: [
        { label: 'ViacomCBS', value: '$0.75bn · 일평균거래대금의 0.8배 · 유통주식 1.1%' },
        { label: 'Discovery', value: '$0.45bn · 일평균거래대금의 1.1배 · 유통주식 1.8%' },
        { label: 'Baidu', value: '$0.68bn · 일평균거래대금의 0.3배 · 유통주식 0.3%' },
        { label: 'GSX Techedu', value: '$0.30bn · 일평균거래대금의 0.9배 · 유통주식 1.7%' },
        { label: 'Tencent Music', value: '$0.38bn · 일평균거래대금의 0.8배 · 유통주식 0.8%' },
        { label: 'Vipshop', value: '$0.45bn · 일평균거래대금의 0.8배 · 유통주식 0.6%' },
        { label: '합계 / 차순위 헤지펀드 고객', value: '$3.0bn / $1.5bn (2.0배)' },
      ],
      sourceRefs: [S.sec, S.finma],
      relatedMetrics: ['concentrationDays', 'maxPctOfFloat'],
    },
    {
      id: 't0-call-head',
      kind: 'call',
      time: '4/1 11:00',
      caller: '프라임서비스 사업부장',
      callee: '리스크 헤드',
      tone: 'routine',
      lines: [
        {
          speaker: '프라임서비스 사업부장',
          text: '이 고객은 연간 $18m을 냅니다. 성장 속도를 보면 내년에는 세 배가 될 겁니다. 마진을 올리면 다음 주에 다른 프라임브로커로 갑니다 — 그쪽이 조건을 더 준다는 이야기를 이미 들었습니다.',
        },
        {
          speaker: '리스크 헤드',
          text: '조건을 더 준다는 곳이 어디인지, 그쪽 익스포저가 얼마인지는 우리가 알 수 없습니다.',
        },
        {
          speaker: '프라임서비스 사업부장',
          text: '그건 어느 고객이든 마찬가지입니다. 한도는 올리면 됩니다.',
        },
      ],
      severity: 'info',
      sourceRefs: [S.dearCeo, S.pw],
    },
    {
      id: 't0-news-context',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '4/1 16:30',
      headline: '3월 충격 이후 주식 파생 수요 급증 — 패밀리오피스가 프라임브로커 성장의 축',
      body: '연준의 긴급 조치 이후 위험자산이 반등하면서 총수익스와프를 통한 레버리지 수요가 빠르게 늘고 있다. 등록 의무가 없는 패밀리오피스는 13F 공시 대상에서 벗어나 있어, 기초자산을 프라임브로커가 자기 명의로 보유하는 구조에서는 포지션이 시장에 드러나지 않는다.',
      severity: 'info',
      sourceRefs: [S.sec, S.fsb],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: 'PE 한도 초과 대응',
      prompt: '승인 한도의 10배를 넘은 잠재익스포저를 어떻게 처리하시겠습니까?',
      context:
        '이 결정은 2021년 3월의 책 크기를 결정합니다. 한도를 올리면 익스포저가 자랍니다. 줄이라고 요구하면 수수료를 잃습니다. 어느 쪽이든 오늘은 비용이 보이지 않습니다.',
      requiredConcepts: ['economic-vs-regulatory-capital'],
      cardRefs: ['economic-vs-regulatory-capital', 'regulator-escalation-ladder'],
      dimensions: ['marketRisk', 'compliance', 'timeliness'],
      options: [
        {
          id: 't0-a',
          label: '한도를 실제 익스포저에 맞춰 상향',
          description:
            '승인 PE 한도를 $200m로 재설정하고 현행 거래를 계속한다. 사업부 승인만으로 실행 가능하며 고객과의 재협상이 필요 없다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 0.35,
              feeDelta: 0.012,
              label: 'PE 한도 $20m → $200m 상향',
            }),
            counter('limitBreachesAccepted', 1),
          ],
          expert: {
            rating: 20,
            rationale:
              'FINMA는 "초과된 한도가 단순히 반복해서 상향되었다"는 것을 중대·체계적 위반 다섯 항목 중 하나로 적시했다. 한도를 실제 익스포저에 맞추는 것은 한도를 없애는 것과 같다 — 한도의 기능은 익스포저를 따라가는 것이 아니라 멈추는 것이다.',
            historicalNote:
              'CS는 2020년 4월 이후에도 한도 초과를 수용했고, 8월에는 PE가 $530m(한도의 26배)에 이르렀으나 디리스킹 조치는 없었다.',
            sourceRefs: [S.finma, S.pw],
          },
          consequences:
            '한도가 상향되었습니다. 고객이 물량을 늘렸고 연간 수수료가 $30m으로 올랐습니다.',
          historical: true,
          feasibility: {
            basis: '사업부 리스크위원회 승인만으로 실행 가능(당시 CS의 실제 절차)',
            sourceRefs: [S.pw],
          },
          calibrationNote: '책 배율 0.15 → 0.35 (책 $3.0bn → $7.0bn) [CAL calibration.md §3]',
          preview: [
            { metric: 'grossExposure', direction: 'up', magnitude: 2 },
            { metric: 'concentrationDays', direction: 'up', magnitude: 2 },
          ],
        },
        {
          id: 't0-b',
          label: '익스포저 축소 요구, 미이행 시 신규 거래 중단',
          description:
            '90일 내 PE를 한도 이내로 줄이도록 요구하고 그때까지 신규 스와프를 받지 않는다. 계약상 신규 거래 거절은 즉시 가능하다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 0.22,
              feeDelta: -0.004,
              label: '신규 거래 중단, 익스포저 축소 요구',
            }),
            flag('derisking_demanded'),
            confidence(-2, '고객 관계 악화'),
          ],
          expert: {
            rating: 85,
            rationale:
              'BCBS 카운터파티 신용리스크 관리 기준은 고레버리지 상대방에 대해 거래 한도의 실효성과 신규 거래 게이트를 핵심 통제로 본다. PRA·FCA 공동 서한도 "온보딩 이후 관계 재평가의 부재"를 첫 번째 결함으로 꼽았다.',
            sourceRefs: [S.bcbs, S.dearCeo],
          },
          consequences:
            '고객이 강하게 항의했고 일부 물량을 다른 프라임브로커로 옮겼습니다. 수수료가 줄었습니다.',
          feasibility: {
            basis: '프라임브로커 계약상 신규 거래 거절은 사전 통지 없이 가능',
            sourceRefs: [S.bcbs],
          },
          calibrationNote: '책 배율 0.15 → 0.22 [CAL]',
          preview: [{ metric: 'grossExposure', direction: 'flat', magnitude: 1 }],
        },
        {
          id: 't0-c',
          label: '그룹 리스크위원회 에스컬레이션 + 90일 디리스킹 계획',
          description:
            '한도 초과를 그룹 리스크위원회와 이사회 리스크소위에 정식 보고하고 기한이 있는 디리스킹 계획을 승인받는다. 보고 자체에 비용은 없다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 0.28,
              feeDelta: 0.002,
              label: '에스컬레이션 후 기한부 디리스킹 계획',
            }),
            flag('escalated_to_board'),
            flag('derisking_demanded'),
            regulator({ add: 0 }, '내부 에스컬레이션(감독당국 보고 아님)'),
          ],
          expert: {
            rating: 88,
            rationale:
              'FINMA의 다섯 위반 중 하나는 "포지션의 막대한 규모와 위험에도 경영진이 보고받지 못했다"는 것이다. Paul Weiss도 "리스크 에스컬레이션의 부재"를 핵심 실패로 지목했다. 에스컬레이션은 비용이 거의 없고, 나중에 무엇을 할 수 있는지를 결정한다.',
            sourceRefs: [S.finma, S.pw],
          },
          consequences:
            '그룹 리스크위원회가 보고를 받고 90일 디리스킹 계획을 승인했습니다. 이제 이 고객은 경영진의 의제입니다.',
          feasibility: {
            basis: '내부 거버넌스 절차만 필요 — 당시에도 존재했던 채널',
            sourceRefs: [S.pw],
          },
          calibrationNote: '책 배율 0.15 → 0.28 [CAL]',
        },
        {
          id: 't0-d',
          label: '한시적 리스크선호 상향을 부여하고 재검토 연기',
          description:
            '한도는 그대로 두고 한시적 초과 승인($900m 상당)을 주어 시간을 번다. 정식 한도 변경보다 승인 절차가 가볍다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 0.3,
              feeDelta: 0.008,
              label: '한시적 리스크선호 상향',
            }),
            counter('temporaryWaivers', 1),
          ],
          expert: {
            rating: 22,
            rationale:
              'Paul Weiss는 이 고객에게 여러 차례의 한시적 맞춤 리스크선호 상향이 부여되었다고 기록한다(10월에는 $900m). 한시적 승인은 한도 상향과 결과가 같으면서 검토 기록만 흐리게 만든다.',
            sourceRefs: [S.pw],
          },
          consequences:
            '한시적 승인이 부여되었습니다. 재검토 기한은 분기 말로 잡혔고, 그때 다시 연장될 것입니다.',
          feasibility: { basis: '당시 CS에서 실제로 사용된 절차', sourceRefs: [S.pw] },
          calibrationNote: '책 배율 0.15 → 0.30 [CAL]',
        },
        {
          id: 't0-e',
          label: '마진을 5.9%로 인하해 물량을 더 받는다',
          description:
            '고객이 요구하는 조건에 맞춰 스왑 마진을 평균 5.9%로 낮추고 명목을 늘린다. 수수료가 크게 늘고 경쟁사에 고객을 뺏기지 않는다.',
          effects: [
            archegosFx.setMarginPolicy({
              staticPct: 5.9,
              dynamic: false,
              concentrationAddOn: false,
              bookScale: 0.45,
              feeDelta: 0.024,
              label: '마진 7.5% → 5.9%',
            }),
            confidence(3, '고객 관계 강화'),
          ],
          expert: {
            rating: 2,
            rationale:
              'Paul Weiss는 2020년 9월 시점에 프라임파이낸싱 스왑북의 평균 마진이 5.9%였다고 기록한다 — 업계 표준 15~25%의 3분의 1 이하다. 보고서의 결론은 "사업부가 단기 이익 극대화에 집중해 고객의 탐욕스러운 리스크 감수를 제어하지 못하고 오히려 가능하게 했다"는 것이다.',
            sourceRefs: [S.pw, S.finma],
          },
          consequences:
            '고객이 만족했고 명목이 빠르게 늘었습니다. 연간 수수료가 $42m이 되었습니다.',
          trap: true,
          trapExplanation:
            '수수료는 즉시 보이고 꼬리위험은 보이지 않는다. 마진 1%p는 이 책에서 담보 $200m이며, 그것이 사라진 자리에 남는 것은 청산 소요일이다. 2021년 3월에 문제가 된 것은 수수료가 아니라 "며칠 걸려야 빠져나올 수 있는가"였다.',
          irreversible: true,
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: { basis: '고객 요구에 따른 마진 재협상은 계약상 가능', sourceRefs: [S.pw] },
          calibrationNote: '책 배율 0.15 → 0.45, 담보율 7.5% → 5.9% [CAL]',
        },
      ],
    },
    {
      id: 't0-d2',
      title: '집중 익스포저의 측정 기준',
      prompt: '이 고객의 위험을 무엇으로 재시겠습니까?',
      context:
        '정적 마진율은 하루치 가격 변동을 가정합니다. 그러나 이 포지션을 실제로 정리하려면 며칠이 필요한지는 마진율이 말해 주지 않습니다.',
      cardRefs: ['hqla-and-haircuts'],
      dimensions: ['marketRisk'],
      options: [
        {
          id: 't0-d2-a',
          label: '정적 마진율과 명목 한도를 그대로 쓴다',
          description:
            '현행 리스크 대시보드(명목, 마진율, 1일 VaR)를 유지한다. 추가 시스템 개발이 필요 없다.',
          effects: [counter('measurementUnchanged', 1)],
          expert: {
            rating: 18,
            rationale:
              'BCBS는 아케고스 이후 카운터파티 신용리스크 기준에서 잠재미래익스포저(PFE)와 스트레스 측정의 부재를 명시적으로 다뤘고, PRA·FCA 서한은 "비효과적이고 일관되지 않은 마진 방식"을 지적했다. 1일 VaR은 35일이 걸리는 포지션에 대해 아무것도 말해 주지 않는다.',
            sourceRefs: [S.bcbs, S.dearCeo],
          },
          consequences: '대시보드가 그대로 유지됩니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '정적 마진율과 1일 VaR은 모든 고객에게 같은 언어로 계산되므로 비교 가능하고 감사에도 통과한다. 그러나 일평균거래대금의 30배인 포지션과 0.3배인 포지션이 같은 7.5%로 표시되는 순간, 대시보드는 위험을 보여주는 것이 아니라 가려 준다.',
          remediationCard: 'hqla-and-haircuts',
          feasibility: { basis: '현행 유지', sourceRefs: [S.pw] },
        },
        {
          id: 't0-d2-b',
          label: '청산 소요일을 1차 한도 지표로 채택',
          description:
            '일평균거래대금의 20%를 참여 상한으로 두고 포지션별 청산 소요일과 유통주식 비중을 계산해 한도 체계의 1차 지표로 삼는다. 거래대금 데이터는 이미 보유하고 있어 분기 내 구축 가능하다.',
          effects: [flag('concentration_measured'), counter('measurementUpgraded', 1)],
          expert: {
            rating: 90,
            rationale:
              '집중 포지션의 위험 단위는 가격 변동폭이 아니라 시간이다. 청산 소요일 × 일간 변동성이 곧 청산 VaR이며, 마진은 그것을 덮어야 한다. 2021년 3월에 손실을 가른 것은 정확히 이 변수였다 — 며칠 만에 빠져나왔는가.',
            sourceRefs: [S.bcbs, S.dearCeo],
          },
          consequences:
            '새 지표가 대시보드에 나타납니다. 최대 청산 소요일과 유통주식 비중이 이제 매일 보입니다.',
          feasibility: {
            basis: '거래대금·유통주식 데이터는 시장 데이터 벤더로 상시 조회 가능',
            sourceRefs: [S.bcbs],
          },
          preview: [{ metric: 'concentrationDays', direction: 'flat', magnitude: 1 }],
        },
        {
          id: 't0-d2-c',
          label: '스트레스 VaR 배수만 상향한다',
          description:
            '기존 VaR 모형의 스트레스 배수를 올려 한도 소진율을 높인다. 모형 변경 승인만 필요하다.',
          effects: [counter('stressVarRaised', 1)],
          expert: {
            rating: 48,
            rationale:
              '방향은 맞지만 같은 모형의 눈금만 바꾸는 것이다. 유동성 조정 없는 VaR은 포지션이 시장 하루치의 몇 배인지를 여전히 보지 못한다.',
            sourceRefs: [S.bcbs],
          },
          consequences: '한도 소진율이 올라갔습니다. 포지션 구조에 대한 정보는 늘지 않았습니다.',
          feasibility: { basis: '모형 파라미터 변경은 리스크모형위원회 승인 사항' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "청산 소요일"과 "마진 커버리지"를 보십시오. 마진 7.5%가 덮는 것은 하루치 변동입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '한도의 기능은 익스포저를 따라가는 것이 아니라 멈추는 것입니다. 한도를 실제 값에 맞추면 한도가 없어집니다.',
    },
    {
      level: 3,
      decisionId: 't0-d2',
      text: '이 시나리오에서 손실을 가르는 변수는 하나입니다 — 포지션을 정리하는 데 며칠이 걸리는가. 그것을 재지 않으면 나머지 결정은 눈을 감고 하는 것입니다.',
    },
  ],
  relatedCards: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2020년 9월 ~ 2021년 3월 11일 "한도 없는 성장"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2020년 9월 ~ 2021년 3월 11일 (프롤로그 ②)',
  title: '한도 없는 성장',
  time: '2021-03-11T17:00:00-05:00',
  entryEffects: [
    {
      id: 't1-excess-accrues',
      description:
        '2020년 하반기 기초 종목 상승으로 요구 담보를 초과하는 담보 $1.2bn이 고객 계좌에 쌓였다',
      effects: [
        archegosFx.retainExcessCollateral({ add: 1.2, label: '초과 담보 누적' }),
        op('institution.custom.potentialExposure', 'set', 0.53, 'PE $530m (한도의 26배)'),
        op('institution.custom.nextLargestClientExposure', 'set', 5.0, '차순위 고객 $5bn'),
      ],
    },
  ],
  events: [
    {
      id: 't1-memo-pe',
      kind: 'memo',
      time: '2020-08-31',
      from: '카운터파티 신용리스크팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '아케고스 — PE $530m, 스왑북 평균 마진 5.9%',
      body: `- 잠재익스포저 **$530m**. 승인 한도 대비 **26배**입니다. 4월 보고 이후 디리스킹 조치는 없었습니다.
- 프라임파이낸싱 스왑북의 **평균 마진은 5.9%**입니다(총포트폴리오 가치 기준). 업계 표준은 15~25%입니다.
- 고객은 이번 분기에도 명목을 늘렸습니다. 요구 담보를 초과하는 담보 **$1.2bn**이 계좌에 쌓여 있고, 고객이 반환을 요청했습니다.
- 내부 위원회는 이 고객을 **동적 마진 체계로 전환**하기로 결정했습니다. 이행 일정은 고객과 협의 중입니다.`,
      severity: 'critical',
      sourceRefs: [S.pw, S.finma],
      cardRefs: ['economic-vs-regulatory-capital'],
      relatedMetrics: ['marginCoverage', 'concentrationDays', 'grossExposure'],
    },
    {
      id: 't1-dialogue-schedule',
      kind: 'dialogue',
      time: '2020-11~2021-02',
      title: '동적 마진 전환 협의 — 4개월간의 기록',
      lines: [
        { speaker: '운영팀', text: '11월 17일 전환 회의 — 고객 측 요청으로 연기되었습니다.' },
        { speaker: '운영팀', text: '12월 9일 재소집 — 다시 연기되었습니다.' },
        { speaker: '운영팀', text: '1월 21일 — 고객이 일정을 확인해 주지 않고 있습니다.' },
        {
          speaker: '프라임서비스 사업부장',
          text: '밀어붙이면 관계가 끝납니다. 다음 분기에 다시 잡읍시다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.pw],
    },
    {
      id: 't1-call-coo',
      kind: 'call',
      time: '2021-03-11 15:00',
      caller: '아케고스 최고운영책임자',
      callee: '리스크 헤드',
      tone: 'routine',
      lines: [
        {
          speaker: '아케고스 최고운영책임자',
          text: '계좌에 요구액을 넘는 담보 $1.2bn이 묶여 있습니다. 다른 프라임브로커는 초과분을 당일 반환합니다. 오늘 중 처리해 주시겠습니까.',
        },
        {
          speaker: '리스크 헤드',
          text: '귀사가 다른 프라임브로커 몇 곳과 거래하는지, 합산 익스포저가 얼마인지 알려주실 수 있습니까.',
        },
        {
          speaker: '아케고스 최고운영책임자',
          text: '세 곳입니다. 합산 수치는 대외비이며 어느 곳에도 제공하지 않습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.finma, S.sec],
      relatedMetrics: ['knownOtherPbCount'],
    },
    {
      id: 't1-data-growth',
      kind: 'data',
      time: '2021-03-11',
      title: '집중도 지표 — 2020년 4월 대비',
      rows: [
        { label: '총익스포저', value: '$3.0bn → 대시보드 참조' },
        { label: '차순위 헤지펀드 고객 대비', value: '2.0배 → 4.0배' },
        { label: '최대 청산 소요일(ADV 20% 참여)', value: '5일 → 대시보드 참조' },
        { label: '연간 수수료', value: '$18m → 대시보드 참조' },
        { label: '고객이 고지한 타 프라임브로커 수', value: '3곳 (검증 불가)' },
      ],
      sourceRefs: [S.finma, S.sec],
      relatedMetrics: ['grossExposure', 'concentrationDays', 'knownOtherPbCount'],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '동적 마진 전환',
      prompt: '동적 마진과 집중도 가산을 실제로 시행하시겠습니까?',
      context:
        '위원회는 이미 전환을 결정했습니다. 남은 것은 고객의 동의 없이도 시행할 것인가입니다. 시행하면 고객은 물량을 다른 프라임브로커로 옮기고 수수료가 줄어듭니다.',
      requiredConcepts: ['economic-vs-regulatory-capital'],
      cardRefs: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
      dimensions: ['marketRisk', 'timeliness'],
      options: [
        {
          id: 't1-a',
          label: '전환을 결의하되 이행 일정은 고객과 협의',
          description:
            '동적 마진 전환을 공식 결정으로 남기고 실제 적용 시점은 고객과 합의해 정한다. 관계를 지키면서 기록도 남는다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 1.0,
              feeDelta: 0.042,
              label: '전환 결의(미이행) — 명목 계속 증가',
            }),
            counter('dynamicMarginDeferred', 1),
          ],
          expert: {
            rating: 25,
            rationale:
              'Paul Weiss에 따르면 위원회는 아케고스를 몇 주 안에 동적 마진으로 옮기기로 결정했으나, 고객이 협의 회의를 계속 취소해 끝내 이행되지 않았다. 결정이 이행을 대신하지 않는다 — 기록에 남은 것은 결정이고, 손실을 만든 것은 미이행이다.',
            historicalNote:
              '아케고스 사태 후 CS는 모든 헤지펀드 고객을 동적 마진으로 전환했다. 2020년에 그렇게 했다면 이 시나리오는 존재하지 않았을 것이다.',
            sourceRefs: [S.pw, S.finma],
          },
          consequences:
            '전환 결의가 의사록에 남았습니다. 고객은 일정 협의를 미루고 있고 명목은 계속 늘어납니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"결정했다"는 사실은 감사에도 이사회에도 통과한다. 그러나 마진은 결의가 아니라 담보로 걷힌다. 이행 기한과 미이행 시 자동 발효 조항이 없는 결의는 기록일 뿐이다.',
          feasibility: { basis: '위원회 결의 후 이행 일정 협의 — 실제 경로', sourceRefs: [S.pw] },
          calibrationNote: '책 배율 → 1.00 (책 $20bn) [CAL calibration.md §3]',
          preview: [
            { metric: 'grossExposure', direction: 'up', magnitude: 3 },
            { metric: 'marginCoverage', direction: 'down', magnitude: 2 },
          ],
        },
        {
          id: 't1-b',
          label: '동적 마진 + 집중도 가산 즉시 시행',
          description:
            '계약상 마진 조건 변경권을 발동해 30일 통지 후 시행한다. 집중도 가산은 청산 소요일 10일 초과분에 부과한다. 고객은 물량 일부를 다른 프라임브로커로 옮길 것이다.',
          effects: [
            archegosFx.setMarginPolicy({
              staticPct: 12,
              dynamic: true,
              concentrationAddOn: true,
              bookScale: 0.7,
              feeDelta: 0.018,
              label: '동적 마진 12% + 집중도 가산 시행',
            }),
            flag('escalated_to_board'),
            confidence(-4, '고객 관계 악화'),
          ],
          expert: {
            rating: 90,
            rationale:
              'BCBS 카운터파티 신용리스크 기준은 고레버리지 상대방에 대해 포지션 규모·유동성에 연동된 마진을 요구한다. FINMA는 "한도 초과에 대해 훨씬 낮은 추가 요구만 했다"는 것을 위반으로 적시했다. 동적 마진은 손실을 막는 것이 아니라 손실이 나기 전에 익스포저를 줄인다 — 고객이 스스로 물량을 옮기기 때문이다.',
            sourceRefs: [S.bcbs, S.finma],
          },
          consequences:
            '고객이 강하게 항의한 뒤 명목의 상당 부분을 다른 프라임브로커로 옮겼습니다. 남은 책은 더 작고 담보는 더 두껍습니다.',
          feasibility: {
            basis: '프라임브로커 계약의 마진 조건 변경권(통상 30일 통지) — 당시 표준 조항',
            sourceRefs: [S.bcbs],
          },
          calibrationNote: '책 배율 → 0.70 (책 $14bn), 담보율 12% [CAL]',
          preview: [
            { metric: 'marginCoverage', direction: 'up', magnitude: 3 },
            { metric: 'concentrationDays', direction: 'down', magnitude: 2 },
          ],
        },
        {
          id: 't1-c',
          label: '동적 마진만 시행하고 집중도 가산은 보류',
          description:
            '가격 변동에 연동된 동적 마진은 도입하되 집중도 가산은 경쟁력을 이유로 미룬다. 고객 저항이 훨씬 작다.',
          effects: [
            archegosFx.setMarginPolicy({
              staticPct: 9.5,
              dynamic: true,
              concentrationAddOn: false,
              bookScale: 0.85,
              feeDelta: 0.03,
              label: '동적 마진 9.5% 시행(집중도 가산 없음)',
            }),
          ],
          expert: {
            rating: 62,
            rationale:
              '동적 마진은 변동성에 반응하지만 집중도에는 반응하지 않는다. 같은 변동성이라도 일평균거래대금의 30배인 포지션은 30배만큼 나쁘다. 절반의 개선이며, 절반은 남는다.',
            sourceRefs: [S.bcbs, S.dearCeo],
          },
          consequences: '동적 마진이 적용되었습니다. 집중도가 큰 종목의 담보는 그대로입니다.',
          feasibility: { basis: '마진 조건 변경권 발동', sourceRefs: [S.bcbs] },
          calibrationNote: '책 배율 → 0.85, 담보율 9.5% [CAL]',
        },
        {
          id: 't1-d',
          label: '현행 유지하고 수수료 인상을 협상',
          description:
            '마진은 그대로 두고 파이낸싱 스프레드를 올려 리스크 대가를 받는다. 고객이 받아들일 가능성이 높다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 1.15,
              feeDelta: 0.06,
              label: '현행 마진 유지 + 수수료 인상',
            }),
            confidence(2, '수익 기여 확대'),
          ],
          expert: {
            rating: 8,
            rationale:
              '수수료로 보상받는 것은 예상손실이지 꼬리위험이 아니다. 이 책의 꼬리는 $5bn 규모였고 연간 수수료는 $60m이었다 — 90년치다. PRA·FCA 서한이 지적한 "리스크와 상업적 보상의 균형을 잡지 못한 문화"가 정확히 이것이다.',
            sourceRefs: [S.dearCeo, S.pra],
          },
          consequences:
            '수수료가 $78m으로 늘었습니다. 고객은 물량을 더 늘렸고 담보율은 그대로입니다.',
          trap: true,
          trapExplanation:
            '가격으로 리스크를 산다는 논리는 분포의 가운데에서만 맞다. 꼬리에서는 수수료가 손실의 1%도 되지 않으며, 수수료를 받았다는 사실 자체가 익스포저를 더 키운다.',
          feasibility: { basis: '파이낸싱 스프레드 재협상은 상시 가능', sourceRefs: [S.pw] },
          calibrationNote: '책 배율 → 1.15 (책 $23bn) [CAL]',
        },
      ],
    },
    {
      id: 't1-d2',
      title: '초과 담보 반환 요청',
      prompt: '고객이 요구하는 초과 담보 $1.2bn을 반환하시겠습니까?',
      context:
        '계약상 요구액을 초과하는 담보는 고객 자산입니다. 반환을 거부하려면 집중도 가산이나 추가 담보 요건이라는 근거가 있어야 합니다.',
      cardRefs: ['hqla-and-haircuts'],
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't1-d2-a',
          label: '전액 반환한다',
          description:
            '계약상 초과 담보는 고객 자산이므로 요청대로 당일 반환한다. 거절할 계약상 근거가 없다.',
          effects: [
            archegosFx.returnExcessCollateral({ fraction: 1, label: '초과 담보 전액 반환' }),
            confidence(2, '고객 관계 유지'),
          ],
          expert: {
            rating: 5,
            rationale:
              'FINMA는 "붕괴 약 2주 전 아케고스에 USD 24억을 지급하면서 리스크를 최소화할 대안을 검토하지 않았다"는 것을 중대·체계적 위반 다섯 항목 중 하나로 명시했다. 계약상 권리와 리스크 판단은 다른 문제이며, 최소한 대안을 검토한 기록은 있어야 한다.',
            historicalNote:
              '반환된 담보는 두 주 뒤 디폴트 손실에 그대로 더해졌다. 이 지급은 FINMA 명령의 근거 중 하나가 되었다.',
            sourceRefs: [S.finma, S.fed],
          },
          consequences: '$1.2bn이 반환되었습니다. 보유 담보가 그만큼 줄었습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"계약상 고객 자산"은 사실이고, 그래서 이 선택은 검토 없이 통과된다. 함정은 반환 자체가 아니라 대안(집중도 가산 담보로의 재지정, 부분 반환, 조건부 유보)을 검토한 기록이 없다는 점이다 — 감독당국이 사후에 본 것이 바로 그 공백이다.',
          irreversible: true,
          remediationCard: 'hqla-and-haircuts',
          feasibility: {
            basis: '계약상 초과 담보 반환은 고객 청구에 따라 당일 처리',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'marginCoverage', direction: 'down', magnitude: 2 }],
        },
        {
          id: 't1-d2-b',
          label: '집중도 가산 담보로 재지정하고 반환 거부',
          description:
            '집중도 가산 요건을 발동해 초과분을 추가 담보로 재지정하고 반환하지 않는다. 계약상 마진 조건 변경권이 근거가 된다.',
          effects: [flag('excess_retained_deliberately'), confidence(-4, '고객 관계 악화')],
          expert: {
            rating: 90,
            rationale:
              'FINMA의 지적은 "반환하지 말았어야 했다"가 아니라 "대안을 검토하지 않았다"였다. 집중도 가산으로 재지정하는 것은 계약상 근거가 있는 대안이며, 두 주 뒤 손실을 $1.2bn 줄인다.',
            sourceRefs: [S.finma, S.bcbs],
          },
          consequences:
            '고객이 강하게 항의했습니다. 담보는 그대로 남아 있고, 그 사실이 문서로 기록되었습니다.',
          feasibility: {
            basis: '마진 조건 변경권으로 추가 담보 요건을 부과 — 통지 후 즉시 효력',
            sourceRefs: [S.bcbs],
          },
          preview: [{ metric: 'marginCoverage', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't1-d2-c',
          label: '절반만 반환하고 나머지는 유보',
          description:
            '$600m을 반환하고 나머지는 집중도 검토가 끝날 때까지 유보한다. 관계와 담보를 절충한다.',
          effects: [
            archegosFx.returnExcessCollateral({ fraction: 0.5, label: '초과 담보 절반 반환' }),
            counter('partialReturn', 1),
          ],
          expert: {
            rating: 55,
            rationale:
              '대안을 검토했다는 기록은 남고 담보의 절반은 지킨다. 다만 절반은 두 주 뒤 손실에 그대로 더해진다.',
            sourceRefs: [S.finma],
          },
          consequences: '$600m이 반환되었습니다. 나머지는 검토 종료 시까지 유보됩니다.',
          feasibility: { basis: '부분 반환은 계약상 재량 범위', sourceRefs: [S.finma] },
        },
      ],
    },
    {
      id: 't1-d3',
      title: '타 프라임브로커 노출 집계',
      prompt: '고객의 전체 레버리지를 알 수 없다는 문제를 어떻게 다루시겠습니까?',
      context:
        '고객은 프라임브로커가 세 곳이라고 말했습니다. 확인할 방법은 없습니다. 우리가 보는 것은 우리 책뿐이고, 같은 포지션이 다른 곳에도 있다면 시장 전체의 집중도는 우리가 보는 것의 몇 배입니다.',
      cardRefs: ['tri-party-repo-run'],
      dimensions: ['compliance', 'marketRisk'],
      options: [
        {
          id: 't1-d3-a',
          label: '고객 고지를 그대로 수용한다',
          description:
            '고객 진술(3곳)을 온보딩 파일에 기록하고 별도 검증은 하지 않는다. 계약상 제출 의무가 없다.',
          effects: [counter('aggregationSkipped', 1)],
          expert: {
            rating: 20,
            rationale:
              'SEC는 아케고스가 카운터파티에 익스포저·집중도·유동성을 오도해 추가 거래 한도를 얻었다고 적시했다. 검증 없는 진술은 정보가 아니다. PWG는 1998년 LTCM 이후 이미 "각 카운터파티가 자기 몫만 보아서는 총레버리지를 알 수 없다"고 결론지었다.',
            sourceRefs: [S.sec, S.pwg],
          },
          consequences: '온보딩 파일에 "타 프라임브로커 3곳"이 기록되었습니다.',
          historical: true,
          feasibility: { basis: '현행 온보딩 절차', sourceRefs: [S.dearCeo] },
        },
        {
          id: 't1-d3-b',
          label: '총레버리지 증빙 제출을 요구하고 미제출 시 가산',
          description:
            '전체 프라임브로커별 명목·담보 명세를 분기마다 제출하도록 요구하고, 미제출 시 마진 가산을 자동 발효한다. 계약 갱신 시 추가 가능한 조항이다.',
          effects: [
            archegosFx.aggregateOtherPbs({
              revealedCount: 6,
              revealedExposure: 95,
              shareData: false,
              label: '총레버리지 증빙 요구',
            }),
            flag('escalated_to_board'),
            confidence(-3, '고객 관계 악화'),
          ],
          expert: {
            rating: 86,
            rationale:
              'FSB는 아케고스를 "TRS를 통한 숨은 레버리지와 카운터파티 신용리스크의 오가격" 사례로 다루며, 카운터파티의 총레버리지 파악을 핵심 권고로 제시한다. 고객은 정확한 수치를 주지 않겠지만 "여섯 곳"이라는 답만으로도 대시보드의 의미가 달라진다.',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences:
            '고객이 부분적으로 응답했습니다 — 프라임브로커는 여섯 곳이며 합산 익스포저는 "$950억 수준"이라고 합니다. 정확성은 검증할 수 없지만 우리가 보던 것의 다섯 배입니다.',
          feasibility: {
            basis: '계약 갱신 시 정보제출 조항 추가 — 아케고스 이후 업계 표준이 되었다',
            sourceRefs: [S.fsb, S.dearCeo],
          },
          preview: [{ metric: 'industryExposure', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't1-d3-c',
          label: '익명 집계 서비스를 통해 업계 총량을 조회',
          description:
            '개별 고객 정보를 공유하지 않고 제3자 익명 집계를 통해 동일 기초자산의 프라임브로커 합산 포지션을 조회한다. 경쟁법·비밀유지 문제를 피하는 유일한 경로다.',
          effects: [
            archegosFx.aggregateOtherPbs({
              revealedCount: 6,
              revealedExposure: 110,
              shareData: true,
              label: '익명 집계 서비스 조회',
            }),
            flag('escalated_to_board'),
          ],
          expert: {
            rating: 88,
            rationale:
              'FSB 최종 보고서의 권고 중 하나가 바로 이것 — 개별 정보를 노출하지 않고 카운터파티 집중도를 파악할 수 있는 집계 체계다. 직접 문의는 고객 비밀유지 의무와 경쟁법 문제를 일으키므로 익명 집계가 실행 가능한 유일한 경로다.',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences:
            '동일 기초자산에 대한 업계 합산 포지션이 우리 책의 다섯 배가 넘는다는 결과가 돌아왔습니다. 어느 기관의 것인지는 알 수 없습니다.',
          feasibility: {
            basis: '익명 집계는 경쟁법·비밀유지 제약을 피하는 유일한 구조 — FSB가 사후 권고',
            sourceRefs: [S.fsb],
          },
        },
        {
          id: 't1-d3-d',
          label: '동종 프라임브로커에게 직접 이 고객 포지션을 문의',
          description:
            '다른 프라임브로커 리스크 총괄에게 직접 전화해 이 고객의 포지션 규모를 확인한다. 가장 빠른 방법이다.',
          effects: [flag('confidentiality_breach'), regulator({ add: 1 }, '고객 비밀유지 위반')],
          expert: {
            rating: 6,
            rationale:
              '고객 포지션 정보를 경쟁사와 직접 교환하는 것은 비밀유지 의무 위반이며, 사안에 따라 경쟁법 문제가 된다. FSB가 익명 집계 구조를 권고한 이유가 바로 이 경로가 막혀 있기 때문이다.',
            sourceRefs: [S.fsb, S.dearCeo],
          },
          consequences:
            '상대 은행은 답을 주지 않았고, 내부 준법감시가 이 통화를 보고 대상으로 분류했습니다.',
          trap: true,
          trapExplanation:
            '정보 결핍이 실재하므로 이 선택은 합리적으로 보인다. 그러나 해법은 정보를 몰래 얻는 것이 아니라 정보를 요구할 권리를 계약에 넣는 것이다.',
          illegal: true,
          feasibility: { basis: '실행은 가능하나 비밀유지 의무 위반', sourceRefs: [S.fsb] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '"전환을 결의했다"와 "전환했다"는 대시보드에서 다르게 보입니다. 마진 커버리지를 확인하십시오.',
    },
    {
      level: 2,
      decisionId: 't1-d2',
      text: '초과 담보 반환은 계약상 정당합니다. 문제는 반환 여부가 아니라 대안을 검토한 기록이 있는가입니다.',
    },
    {
      level: 3,
      decisionId: 't1-d3',
      text: '총레버리지를 모른다는 사실 자체를 리스크로 계상하십시오. 모르는 것을 0으로 두면 대시보드가 거짓말을 합니다.',
    },
  ],
  relatedCards: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2021년 3월 22~23일 (월~화) "비아콤CBS 증자"
// ---------------------------------------------------------------------------------------------
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2021년 3월 22~23일 (월~화) 16:00 ET',
  title: '비아콤CBS 증자',
  time: '2021-03-23T16:00:00-04:00',
  entryEffects: [
    {
      id: 't2-market-anchor',
      description: '2021년 3월 시장 앵커를 세운다 (10년 1.63%, VIX 20.30, IG OAS 92bp)',
      effects: [
        op('market.govt2yBp', 'set', 15, '3/23 DGS2 0.15%'),
        op('market.govt10yBp', 'set', 163, '3/23 DGS10 1.63%'),
        op('market.govt30yBp', 'set', 234, '3/23 DGS30 2.34%'),
        op('market.volIndex', 'set', 20.3, 'VIX 3/23 종가 20.30'),
        op('market.creditSpreadIgBp', 'set', 92, 'IG OAS [VERIFY]'),
        op('market.creditSpreadHyBp', 'set', 320, 'HY OAS [VERIFY]'),
        op('market.fundingStressBp', 'set', 10, '2021년 3월 조달 스트레스는 매우 낮았다'),
        op('market.ownCdsBp', 'set', 55, '알파인 5년 CDS'),
      ],
    },
    {
      id: 't2-mark-0323',
      description: '3/23 마크: 비아콤CBS −9.06%, 책 가치가중 −4.49%',
      effects: [
        archegosFx.markDaily({
          moves: { VIAC: -0.0906, DISCA: -0.04, BIDU: -0.02, GSX: -0.05, TME: -0.03, VIPS: -0.02 },
          label: '3/23 마크',
        }),
      ],
    },
    {
      id: 't2-settle-0323',
      description: '3/23 정규 변동증거금 정산 — 고객이 전액 이행했다(이 주의 마지막 정상 정산)',
      effects: [
        archegosFx.issueMarginCall({ requiredPct: -1, label: '3/23 변동증거금 산정' }),
        archegosFx.settleMarginCall({ fraction: 1, label: '3/23 정산' }),
      ],
    },
    {
      id: 't2-ci',
      description: '증자 발표로 기초 종목 변동성 상승 — 신뢰지수 −3',
      effects: [confidence(-3, '기초 종목 급락 시작')],
    },
  ],
  events: [
    {
      id: 't2-news-ath',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '3/22 16:00',
      headline: '비아콤CBS $100.34로 사상 최고 종가 — 연초 이후 두 배 이상 상승',
      body: '비아콤CBS Class B는 3월 22일 $100.34로 마감해 사상 최고 종가를 새로 썼다. 스트리밍 사업 기대와 미디어 섹터 재평가가 배경으로 꼽힌다. 회사는 장 마감 후 약 $30억 규모의 보통주·전환우선주 공모 계획을 발표했다.',
      severity: 'warning',
      sourceRefs: [S.viac],
      relatedMetrics: ['market.viac'],
    },
    {
      id: 't2-news-pricing',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '3/23 16:10',
      headline: '비아콤CBS 공모 가격 $85 확정 — 주가 9.1% 하락해 $91.25 마감',
      body: 'Class B 보통주 2,000만주를 주당 $85.00에, 5.75% 전환우선주 1,000만주를 주당 $100에 확정했다. 최종 투자설명서 보충서는 3월 23일 마지막 체결가를 $91.25로 기재했다. 시장 소화가 예상보다 약했다는 평가가 나온다.',
      severity: 'critical',
      sourceRefs: [S.viac],
      relatedMetrics: ['market.viac'],
    },
    {
      id: 't2-memo-risk',
      kind: 'memo',
      time: '3/23 17:30',
      from: '카운터파티 신용리스크팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '아케고스 — 기초 종목 하락에 따른 담보 현황',
      body: `- 책 가치가중 마크 **−4.49%**. 오늘 변동증거금은 전액 정산되었습니다.
- 비아콤CBS는 이 고객 책의 가장 큰 단일 포지션입니다. 증자 물량이 시장에 남아 있는 동안 추가 하락 위험이 있습니다.
- **최대 청산 소요일과 마진 커버리지를 대시보드에서 확인하십시오.** 지금 정리하려면 몇 주가 필요합니다.
- 고객은 오늘도 정상적으로 납입했습니다. 다만 같은 종목을 다른 프라임브로커도 들고 있다면, 그쪽 마진콜이 우리 담보를 먼저 소진시킬 수 있습니다.`,
      severity: 'critical',
      sourceRefs: [S.pw, S.sec],
      cardRefs: ['hqla-and-haircuts'],
      relatedMetrics: ['concentrationDays', 'marginCoverage', 'marginShortfall'],
    },
    {
      id: 't2-market-close',
      kind: 'market',
      time: '3/23 16:30',
      headline: '마감 시세',
      items: [
        { label: '비아콤CBS', value: '$91.25', change: '−9.06%' },
        { label: 'S&P 500', value: '보합권', change: '−0.8%' },
        { label: 'VIX', value: '20.30', change: '+1.4' },
        { label: '미 국채 10년', value: '1.63%', change: '−6bp' },
      ],
      sourceRefs: [S.viac, S.vix, S.ust],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '증자 발표 후 선제 대응',
      prompt: '오늘 무엇을 하시겠습니까? (최대 2개)',
      context:
        '고객은 아직 정상적으로 납입하고 있습니다. 지금 움직이면 관계 비용을 치르고, 기다리면 내일 더 큰 마진콜을 발행하게 됩니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t2-a', 't2-b'],
        ['t2-a', 't2-c'],
        ['t2-a', 't2-e'],
        ['t2-a', 't2-d'],
        ['t2-d', 't2-b'],
        ['t2-d', 't2-c'],
      ],
      cardRefs: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
      dimensions: ['marketRisk', 'timeliness'],
      options: [
        {
          id: 't2-a',
          label: '관망한다 — 정산은 정상이다',
          description:
            '오늘 납입이 정상적으로 이루어졌으므로 추가 조치 없이 관찰한다. 비용이 없고 관계도 유지된다.',
          effects: [counter('waited', 1)],
          expert: {
            rating: 25,
            rationale:
              '납입이 정상이라는 사실은 어제의 정보다. 집중 포지션에서 담보가 충분한지 여부는 가격이 아니라 청산 소요일이 결정하며, 그 값은 이미 위험 구간에 있었다. PRA·FCA 서한은 "위험이 신중하게 판단될 때 줄이지 못한 것"을 결함으로 적시했다.',
            historicalNote: '3월 23일 대부분의 프라임브로커는 별도 조치를 취하지 않았다.',
            sourceRefs: [S.dearCeo, S.pra],
          },
          consequences: '아무 일도 일어나지 않았습니다. 내일 마진콜이 산정됩니다.',
          historical: true,
          feasibility: { basis: '현행 유지', sourceRefs: [S.pw] },
        },
        {
          id: 't2-b',
          label: '집중도 가산을 소급 부과하고 추가 담보 요구',
          description:
            '청산 소요일 10일 초과분에 가산 담보를 부과해 오늘 중 추가 납입을 요구한다. 마진 조건 변경권이 근거이며 당일 통지로 발효한다.',
          effects: [
            archegosFx.issueMarginCall({ requiredPct: 12, label: '집중도 가산 소급 부과' }),
            archegosFx.settleMarginCall({ fraction: 1, label: '가산 담보 납입' }),
            flag('addon_applied'),
            confidence(-3, '고객 관계 악화'),
          ],
          expert: {
            rating: 85,
            rationale:
              '고객이 아직 납입 능력이 있을 때만 담보를 늘릴 수 있다. 3월 23일은 그 능력이 남아 있던 마지막 날이었다 — 다음 날 비아콤CBS가 23% 떨어지면서 여러 프라임브로커의 마진콜이 동시에 도착했다.',
            sourceRefs: [S.bcbs, S.finma],
          },
          consequences:
            '고객이 항의하면서도 납입했습니다. 담보가 늘고 정산 기준이 오늘 종가로 재설정되었습니다.',
          feasibility: {
            basis: '마진 조건 변경권 발동 — 당일 통지로 효력 발생',
            sourceRefs: [S.bcbs],
          },
          preview: [{ metric: 'marginCoverage', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't2-c',
          label: '집중 종목 포지션 20%를 고객 동의로 선제 축소',
          description:
            '비아콤CBS·디스커버리 명목의 20%를 오늘 종가 기준으로 상계 청산한다. 시장이 아직 정상 기능하므로 충격 없이 처리 가능하다.',
          effects: [
            archegosFx.liquidateSlice({
              fraction: 0.2,
              slipK: 0.004,
              label: '3/23 선제 축소 20%',
            }),
            flag('preemptive_cut'),
            confidence(-4, '고객 관계 악화'),
          ],
          expert: {
            rating: 80,
            rationale:
              '이날의 호가 스프레드는 정상이었고 VIX는 20이었다. 같은 물량이 사흘 뒤에는 블록 할인을 내고 나가게 된다. 다만 고객 동의 없이 상계 청산하려면 계약상 디폴트 사유가 필요하므로, 이 시점에서는 합의가 전제된다.',
            sourceRefs: [S.cgfs, S.bcbs],
          },
          consequences: '고객이 마지못해 동의했고 20%가 정리되었습니다. 남은 책이 그만큼 작습니다.',
          feasibility: {
            basis: '고객 합의에 의한 조기 종료(early termination) — 정상 시장에서 당일 가능',
            sourceRefs: [S.cgfs],
          },
          calibrationNote: '정상 시장 체결 할인 0.4% [CAL calibration.md §4]',
          preview: [{ metric: 'grossExposure', direction: 'down', magnitude: 2 }],
        },
        {
          id: 't2-d',
          label: '고객의 증자 참여를 위해 추가 신용을 제공',
          description:
            '고객이 비아콤CBS 공모에 참여할 수 있도록 파이낸싱 한도를 늘린다. 평균 매입단가를 낮춰 포지션을 방어할 수 있다.',
          effects: [
            archegosFx.raiseLimit({
              bookScale: 1.15,
              feeDelta: 0.01,
              label: '증자 참여용 추가 신용',
            }),
            counter('doubledDown', 1),
            confidence(3, '고객 관계 강화'),
          ],
          expert: {
            rating: 2,
            rationale:
              '떨어지는 집중 포지션에 신용을 더 주는 것은 카운터파티 리스크를 두 배로 만드는 것이다. Paul Weiss가 "사업부가 고객의 탐욕스러운 리스크 감수를 가능하게 했다"고 쓴 구조가 정확히 이것이다.',
            sourceRefs: [S.pw, S.finma],
          },
          consequences:
            '한도가 늘었고 고객이 공모에 참여했습니다. 우리 익스포저가 그만큼 커졌습니다.',
          trap: true,
          trapExplanation:
            '"평균단가를 낮춘다"는 논리는 포지션이 회복될 때만 맞다. 회복되지 않으면 손실이 커진 상태에서 담보는 그대로다 — 그리고 이 책의 담보는 7.5%였다.',
          irreversible: true,
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: { basis: '파이낸싱 한도 증액은 사업부 승인 사항', sourceRefs: [S.pw] },
        },
        {
          id: 't2-e',
          label: '그룹 리스크위원회 긴급 보고 + 신규 거래 중단',
          description:
            '집중도 지표와 시나리오 손실을 그룹 리스크위원회에 긴급 보고하고 이 고객의 신규 거래를 즉시 중단한다.',
          effects: [
            flag('escalated_to_board'),
            flag('new_trades_frozen'),
            confidence(-2, '고객 관계 악화'),
          ],
          expert: {
            rating: 78,
            rationale:
              'FINMA는 "포지션의 막대한 규모와 위험에도 경영진이 보고받지 못했다"를 위반으로 적시했다. 보고는 손실을 줄이지 않지만, 다음 이틀의 결정을 리스크 헤드 혼자 지지 않게 만든다.',
            sourceRefs: [S.finma, S.pw],
          },
          consequences:
            '그룹 리스크위원회가 소집되었고 신규 거래가 동결되었습니다. 경영진이 이제 상황을 알고 있습니다.',
          feasibility: { basis: '내부 거버넌스 절차', sourceRefs: [S.finma] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '오늘 납입이 정상이라는 것은 어제의 정보입니다. 최대 청산 소요일을 보십시오.',
    },
    {
      level: 3,
      decisionId: 't2-d1',
      text: '고객이 담보를 낼 수 있는 마지막 날일 수 있습니다. 담보를 늘리거나 익스포저를 줄이는 것은 오늘까지만 싸게 할 수 있습니다.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2021년 3월 24일 (수) "마진콜" — 5틱, 납입 마감 11:00
// ---------------------------------------------------------------------------------------------

/**
 * 고객 최고운영책임자의 오후 통화. **재구성된 대사이며 녹취·속기록이 아니다**(calibration.md §8).
 * 화자는 특정 개인이 아니라 직책이며, 발언 내용은 공개 기록(복수 프라임브로커 동시 마진콜, 포지션
 * 이관 시도, 총레버리지 비공개)에서 재구성한 것이다.
 */
const t3ClientCall: Interrupt<PrimeBrokerState> = {
  id: 't3-i1-client',
  interrupt: true,
  atTick: 3,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't3-i1-defer',
  scoreWeight: 0.5,
  required: false,
  title: '고객 최고운영책임자 통화',
  prompt: '고객이 포지션 이관을 제안합니다. 어떻게 답하시겠습니까?',
  context:
    '이 통화는 마진콜 처리가 끝난 뒤에 걸려 왔습니다. 고객이 스스로 다른 프라임브로커의 존재를 말하고 있습니다.',
  source: { kind: 'call', caller: '아케고스 최고운영책임자', tone: 'urgent' },
  lines: [
    {
      speaker: '아케고스 최고운영책임자',
      text: '오늘 여러 곳에서 동시에 콜이 왔습니다. 한 곳이 포지션 이관을 받아 주면 나머지를 정리할 수 있습니다. 귀사가 비아콤 포지션 일부를 더 받아 주시겠습니까.',
    },
  ],
  dimensions: ['marketRisk', 'compliance'],
  cardRefs: ['economic-vs-regulatory-capital'],
  options: [
    {
      id: 't3-i1-accept',
      label: '이관을 수용해 수수료를 확보한다',
      description: '타행 포지션을 넘겨받아 명목과 수수료를 늘린다.',
      effects: [
        archegosFx.raiseLimit({ bookScale: 1.2, feeDelta: 0.01, label: '타행 포지션 이관 수용' }),
        counter('transfersAccepted', 1),
      ],
      expert: {
        rating: 3,
        rationale:
          '다른 프라임브로커가 줄이려는 포지션을 받는다는 것은 그들이 본 위험을 우리가 사는 것이다. 이 통화가 알려주는 진짜 정보는 이관 제안이 아니라 "여러 곳에서 동시에 콜이 왔다"는 문장이다.',
        sourceRefs: [S.sec, S.finma],
      },
      consequences: '이관이 체결되었습니다. 명목이 늘었습니다.',
      trap: true,
      trapExplanation:
        '스트레스 상황의 고객이 포지션을 옮기려 할 때 그것을 받는 쪽은 언제나 마지막 카운터파티가 된다.',
      preview: [{ metric: 'grossExposure', direction: 'up', magnitude: 2 }],
    },
    {
      id: 't3-i1-refuse',
      label: '거절하고 신규 거래를 동결한다',
      description: '이관을 거절하고 이 고객의 신규 거래를 즉시 중단한다.',
      effects: [flag('new_trades_frozen'), counter('transfersRefused', 1)],
      expert: {
        rating: 82,
        rationale:
          '"여러 곳에서 동시에 콜이 왔다"는 진술은 이 고객의 문제가 우리 책만의 문제가 아님을 처음으로 확인해 준다. 그 순간 해야 할 일은 익스포저를 늘리지 않는 것이다.',
        sourceRefs: [S.sec, S.dearCeo],
      },
      consequences: '이관을 거절했습니다. 신규 거래가 동결되었습니다.',
    },
    {
      id: 't3-i1-probe',
      label: '거절하고 전체 프라임브로커 명세를 즉시 요구',
      description:
        '이관을 거절하면서 전 프라임브로커별 명목·담보 명세를 24시간 내 제출하도록 요구한다.',
      effects: [
        flag('new_trades_frozen'),
        archegosFx.aggregateOtherPbs({
          revealedCount: 8,
          revealedExposure: 160,
          shareData: false,
          label: '전 프라임브로커 명세 요구',
        }),
        flag('escalated_to_board'),
      ],
      expert: {
        rating: 90,
        rationale:
          '고객이 스스로 복수 프라임브로커의 존재를 말한 순간이 정보를 요구할 수 있는 유일한 지렛대다. 이 요구에 대한 답은 이튿날 저녁 공동 통화에서 나오게 되는데, 하루 먼저 아는 것과 나중에 아는 것은 다르다.',
        sourceRefs: [S.sec, S.fsb],
      },
      consequences:
        '고객이 프라임브로커가 여덟 곳이며 총익스포저가 $1,600억 규모라고 답했습니다. 우리가 보던 것의 여덟 배입니다.',
      preview: [{ metric: 'industryExposure', direction: 'up', magnitude: 3 }],
    },
    {
      id: 't3-i1-defer',
      label: '회신을 보류한다',
      description: '내일 논의하겠다고 답하고 통화를 끝낸다.',
      effects: [counter('callsDeferred', 1)],
      expert: {
        rating: 30,
        rationale:
          '위법도 실수도 아니지만, 고객이 자발적으로 정보를 흘린 유일한 순간을 그냥 보낸 것이다.',
        sourceRefs: [S.pw],
      },
      consequences: '내일 논의하기로 하고 통화를 끝냈습니다.',
      historical: true,
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2021년 3월 24일 (수) 08:00 ET',
  title: '마진콜',
  time: '2021-03-24T08:00:00-04:00',
  ticks: 5,
  tickLabels: ['08:00 마진콜 산정', '09:30 개장', '11:00 납입 마감', '14:00 오후', '16:00 종가'],
  entryEffects: [
    {
      id: 't3-reset',
      description: '당일 매각 카운터 초기화',
      effects: [archegosFx.resetDaily()],
    },
    {
      id: 't3-ci',
      description: '비아콤CBS 공모 물량 소화 실패가 확인되며 신뢰지수 −5',
      effects: [confidence(-5, '기초 종목 급락')],
    },
  ],
  eachTick: [
    {
      id: 't3-mark-tick',
      description: '3/24 일중 마크 — 개장 갭 중심 분포',
      effects: [
        archegosFx.markStep({
          dayFactor: T3_DAY_FACTOR,
          shape: T3_SHAPE,
          label: '3/24 마크',
        }),
      ],
    },
  ],
  // 마진콜은 **개장가가 확정된 뒤** 발행된다. 전일 종가로 계산하면 3/23에 전액 정산된 상태에서는
  // 요구액이 0이 되어, 유예를 줄 것인지 묻는 결정 자체가 성립하지 않는다 (calibration.md §3).
  tickEffects: [
    {
      id: 't3-call',
      atTick: 1,
      description: '09:30 개장가 기준 마진콜 발행 — 요구 담보율은 현행 마진 정책을 따른다',
      effects: [archegosFx.issueMarginCall({ requiredPct: -1, label: '3/24 마진콜' })],
    },
  ],
  ticker: {
    series: [
      // 비아콤CBS: 3/23 종가 $91.25(지수 90.94) → 3/24 종가 $70.10(지수 69.86) [VERIFY facts.ts]
      { path: 'market.custom.viac', mode: 'relative', values: [90.94, 81.45, 76.6, 72.81, 69.86] },
      // 디스커버리: 3/24 −9.0% [STYLIZED — 확인된 값은 3/25→3/26 −27.45%뿐]
      { path: 'market.custom.disca', mode: 'relative', values: [96.0, 92.11, 90.13, 88.57, 87.36] },
      // VIX: 3/23 종가 20.30 → 3/24 종가 21.20 [fred-vixcls]
      { path: 'market.volIndex', mode: 'absolute', values: [20.3, 20.55, 20.8, 21.05, 21.2] },
    ],
  },
  interrupts: [t3ClientCall],
  events: [
    {
      id: 't3-memo-call',
      kind: 'memo',
      atTick: 0,
      time: '08:00',
      from: '마진 운영팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '아케고스 — 당일 마진콜 산정 및 납입 마감',
      body: `- 개장 전 호가가 어제 종가보다 크게 아래에 형성되어 있어, 마진콜은 **09:30 개장가가 확정된 뒤** 발행됩니다. 금액은 대시보드의 "미납 마진콜"을 참조하십시오.
- **납입 마감은 오늘 11:00 ET**입니다. 미납 시 계약상 디폴트 사유가 발생하며, 그 시점부터 상계 청산 권한이 생깁니다.
- 고객 담당자는 "여러 프라임브로커의 콜이 동시에 도착해 조정이 필요하다"고 전해 왔습니다.
- 개장 전 비아콤CBS 호가는 어제 종가 대비 크게 아래에 형성되어 있습니다.`,
      severity: 'critical',
      sourceRefs: [S.pw, S.finma],
      cardRefs: ['regulator-escalation-ladder'],
      relatedMetrics: ['marginCallOutstanding', 'marginShortfall'],
    },
    {
      id: 't3-news-open',
      kind: 'newswire',
      outlet: 'Bloomberg',
      atTick: 1,
      time: '09:35',
      headline: '비아콤CBS 개장 직후 급락 — 공모 물량 소화 부진',
      body: '전일 $85에 확정된 공모 물량이 시장에서 소화되지 않으면서 비아콤CBS가 개장 직후 두 자릿수 하락했다. 트레이더들은 대형 보유자의 매도 압력이 있다고 추정하지만 공시상 확인되는 대주주 변동은 없다.',
      severity: 'critical',
      sourceRefs: [S.viac, S.sec],
      relatedMetrics: ['market.viac'],
    },
    {
      id: 't3-memo-deadline',
      kind: 'memo',
      atTick: 2,
      time: '11:05',
      from: '마진 운영팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '납입 마감 경과',
      body: `- 11:00 마감 시점 기준 처리 결과는 대시보드의 "미납 마진콜"과 "미회수 익스포저"에 반영되어 있습니다.
- 미회수 익스포저는 담보로 덮이지 않은 평가손실입니다. 이 값이 0이 아닌 동안 우리는 무담보 대출을 하고 있는 것과 같습니다.`,
      severity: 'warning',
      sourceRefs: [S.pw],
      relatedMetrics: ['marginShortfall', 'marginCallOutstanding'],
    },
    {
      id: 't3-market-close',
      kind: 'market',
      atTick: 4,
      time: '16:05',
      headline: '마감 시세',
      items: [
        { label: '비아콤CBS', value: '$70.10', change: '−23.18%' },
        { label: 'VIX', value: '21.20', change: '+0.90' },
        { label: 'S&P 500', value: '보합권', change: '−0.6%' },
      ],
      sourceRefs: [S.pressBlock, S.vix],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '증거금 협의',
      prompt: '고객이 요구액 전액은 오늘 어렵다고 합니다. 어떻게 협의하시겠습니까?',
      context:
        '11:00 납입 마감 전에 결론이 나야 합니다. 지금 받는 것과 내일 받기로 하는 것의 차이가 이 시나리오의 손실 대부분을 결정합니다. 여기서 받아들이는 조건이 나중에 회수할 수 있는 것을 정합니다.',
      select: { min: 1, max: 1 },
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't3-c',
      timeLimitSec: 180,
      requiredConcepts: ['hqla-and-haircuts'],
      cardRefs: ['hqla-and-haircuts', 'regulator-escalation-ladder'],
      dimensions: ['liquidity', 'marketRisk', 'timeliness'],
      // 3단계 대화: 협상 개시 → 담보 형태 → 요구 비율. 재구성된 대사이며 실제 통화록이 아니다.
      steps: [
        {
          id: 't3-mc-open',
          lines: [
            {
              speaker: '아케고스 최고운영책임자',
              text: '오늘 요구액 전액은 어렵습니다. 여러 프라임브로커가 동시에 콜을 걸었고 현금이 분산돼 있습니다. 하루만 시간을 주시면 내일 아침에 정리됩니다.',
            },
          ],
          note: '11:00 마감 전에 결론이 나야 하며, 여기서 정한 조건은 이후 회수 가능액을 결정합니다.',
          replies: [
            {
              id: 't3-mc-r-negotiate',
              label: '조건을 협의하되 오늘 안에 마무리하겠다',
              next: 't3-mc-collateral',
              expert: {
                rating: 80,
                rationale:
                  '유예 없이 오늘 안에 무언가를 받는 것이 내일 전액을 약속받는 것보다 낫다.',
              },
            },
            {
              id: 't3-mc-r-default',
              label: '협의 없이 즉시 디폴트를 선언하겠다',
              resolvesTo: 't3-d',
              expert: {
                rating: 60,
                rationale:
                  '계약상 정당하고 상계 청산 권한을 하루 먼저 얻는다. 다만 이 시점에 혼자 선언하면 공동 정리의 가능성이 사라진다.',
              },
            },
            {
              id: 't3-mc-r-grace',
              label: '내일 아침까지 유예해 주겠다',
              resolvesTo: 't3-c',
              expert: { rating: 12, rationale: '관계는 지키지만 담보 없이 하루를 더 노출한다.' },
              trap: true,
              trapExplanation:
                '유예는 아무 비용이 없어 보인다. 실제로는 담보 없는 하루를 사는 것이고, 그 하루에 책은 5% 더 떨어졌으며 다른 프라임브로커들은 그 사이에 자기 담보를 채웠다.',
            },
          ],
        },
        {
          id: 't3-mc-collateral',
          lines: [
            {
              speaker: '아케고스 최고운영책임자',
              text: '현금 대신 우리가 보유한 주식을 담보로 받아 주실 수 있습니까. 같은 종목이라 평가도 쉽습니다.',
            },
          ],
          note: '담보의 가치는 평가가 쉬운가가 아니라 비상시에 팔리는가로 결정됩니다.',
          replies: [
            {
              id: 't3-mc-c-cash',
              label: '현금만 받겠다',
              next: 't3-mc-amount',
              expert: {
                rating: 85,
                rationale:
                  'FINMA는 "담보가 집중되어 비상시에 제 기능을 할 수 없었다"를 위반으로 적시했다. 기초자산과 같은 종목의 주식은 담보가 아니라 같은 포지션이다.',
              },
            },
            {
              id: 't3-mc-c-stock',
              label: '보유 주식도 담보로 받겠다',
              next: 't3-mc-amount',
              effects: [flag('concentrated_collateral')],
              expert: {
                rating: 20,
                rationale: '평가는 쉽지만 우리가 팔아야 할 때 같이 떨어지는 담보다.',
              },
              trap: true,
              trapExplanation:
                '담보의 목적은 기초자산과 다르게 움직이는 것이다. 같은 종목을 담보로 받으면 담보 가치와 익스포저가 같은 날 같은 방향으로 사라진다 — FINMA가 적시한 다섯 위반 중 하나가 정확히 이것이다.',
            },
          ],
        },
        {
          id: 't3-mc-amount',
          lines: [
            {
              speaker: '아케고스 최고운영책임자',
              text: '그러면 오늘 얼마까지 맞추면 되겠습니까. 나머지는 내일 처리하겠습니다.',
            },
          ],
          note: '여기서 약속받는 비율이 오늘 실제로 들어오는 담보이며, 이후 회수 가능액을 결정합니다.',
          replies: commitReplies<PrimeBrokerState>('marginDemandPct', [50, 75, 100], {
            idPrefix: 't3-mc-amt',
            unit: '%',
            label: (v) => (v >= 100 ? '오늘 전액 납입을 요구' : `오늘 ${v}% 납입을 요구`),
            resolvesTo: (v) => (v >= 100 ? 't3-a' : 't3-b'),
            expert: (v) => ({
              rating: v >= 100 ? 88 : v >= 75 ? 68 : 45,
              rationale:
                v >= 100
                  ? '고객이 아직 낼 수 있는 마지막 날이다. 전액을 받으면 정산 기준이 오늘 종가로 재설정되어 미회수 익스포저가 사라진다.'
                  : '부분 납입은 미회수 익스포저를 남긴다. 남긴 만큼이 이틀 뒤 손실이 된다.',
            }),
            trap: (v) => v <= 50,
            trapExplanation: (v) =>
              v <= 50
                ? '"절반이라도 받자"는 협상의 상식이지만, 여기서는 절반을 포기하는 것이다. 고객의 지급 능력은 내일 더 나빠진다.'
                : undefined,
          }),
        },
      ],
      options: [
        {
          id: 't3-a',
          label: '전액 당일 수령하고 정산 기준을 재설정',
          description:
            '마감 전 요구액 전액을 현금으로 수령하고 정산 기준을 당일 종가로 재설정한다. 계약상 마감 시각을 그대로 집행한다.',
          effects: [
            archegosFx.settleMarginCall({ fraction: 1, label: '3/24 전액 정산' }),
            flag('full_margin_received'),
            confidence(-2, '고객 관계 악화'),
          ],
          expert: {
            rating: 88,
            rationale:
              '고객이 지급 능력을 가진 마지막 날에 전액을 받는 것이 이 시나리오에서 손실을 줄이는 가장 큰 단일 행동이다. 3월 25일에는 같은 요구가 불가능해진다.',
            sourceRefs: [S.finma, S.bcbs],
          },
          consequences:
            '전액이 입금되었습니다. 미회수 익스포저가 0이 되고 정산 기준이 오늘 종가로 재설정되었습니다.',
          feasibility: {
            basis: '프라임브로커 계약의 당일 마감 시각 집행 — 표준 조항',
            sourceRefs: [S.bcbs],
          },
          preview: [
            { metric: 'marginShortfall', direction: 'down', magnitude: 3 },
            { metric: 'marginCoverage', direction: 'up', magnitude: 2 },
          ],
        },
        {
          id: 't3-b',
          label: '부분 수령하고 잔액은 익일로 이월',
          description:
            '대화에서 정한 비율만큼 오늘 수령하고 나머지는 익일 마감으로 이월한다. 디폴트 선언은 유보한다.',
          effects: [
            archegosFx.settleMarginCall({
              fractionCounter: 'marginDemandPct',
              label: '3/24 부분 정산',
            }),
            counter('partialMarginAccepted', 1),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'marginDemandPct', lt: 75 },
              description:
                '수령 비율이 낮아 익일 잔액이 회수되지 않음 — 카운터파티 신뢰 −5, 감독 단계 +1',
              effects: [
                confidence(-5, '미회수 잔액 확대'),
                regulator({ add: 1 }, '카운터파티 익스포저 미관리'),
              ],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '유예보다 낫고 전액 수령보다 못하다. 남긴 잔액은 이틀 뒤 그대로 손실이 되며, 비율이 낮을수록 그 크기가 커진다.',
            sourceRefs: [S.finma],
          },
          consequences: '약속한 비율만큼 입금되었습니다. 잔액은 미회수 익스포저로 남습니다.',
          feasibility: { basis: '부분 납입 수용은 계약상 재량 범위', sourceRefs: [S.bcbs] },
        },
        {
          id: 't3-c',
          label: '내일 아침까지 납입을 유예한다',
          description:
            '관계를 고려해 하루 유예한다. 계약상 디폴트 선언을 미루는 것은 담보권자의 재량이며 비용이 발생하지 않는다.',
          effects: [
            archegosFx.grantGrace({ hours: 24, label: '3/24 납입 유예' }),
            confidence(2, '고객 관계 유지'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '유예 기간 중 미회수 익스포저가 커진 사실이 그룹 리스크위원회에 보고됨',
              effects: [
                confidence(-6, '유예 후 익스포저 확대'),
                regulator({ add: 1 }, '유예 사후 검토'),
              ],
            },
          ],
          expert: {
            rating: 12,
            rationale:
              'Fed 동의명령은 "반복된 경고에도 아케고스가 제기한 리스크를 적절히 관리하지 못했다"고 적시했고, PRA는 "신중하다고 판단될 때 리스크를 줄이는 효과적 완화 전략이 없었다"를 위반 사유로 들었다. 유예는 비용이 없어 보이지만 담보 없는 하루를 사는 것이며, 그 하루에 책은 5% 더 떨어졌다.',
            historicalNote:
              '3월 24~25일의 마진콜은 끝내 납입되지 않았고, 25일 저녁 고객은 디폴트 상태였다.',
            sourceRefs: [S.fed, S.pra],
          },
          consequences:
            '유예가 통지되었습니다. 오늘 들어온 담보는 없고 미회수 익스포저가 그대로 남습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '이 선택이 매력적인 이유는 진짜다 — 20년 된 관계, 연 $60m의 수수료, 그리고 "내일 아침이면 해결된다"는 고객의 말. 비용이 보이지 않는 이유는 비용이 미래에 있기 때문이고, 담보 없이 보낸 하루의 가격은 이틀 뒤에 청구된다.',
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis: '디폴트 선언 유예는 담보권자의 재량 — 계약상 즉시 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'marginShortfall', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't3-d',
          label: '즉시 디폴트를 선언한다',
          description:
            '마감 시각 경과와 동시에 계약상 디폴트를 선언하고 상계 청산 권한을 확보한다. 다른 프라임브로커보다 하루 먼저 움직이게 된다.',
          effects: [
            archegosFx.declareDefault({ label: '3/24 디폴트 선언' }),
            flag('early_default'),
            confidence(-5, '고객 디폴트 선언'),
            regulator({ add: 1 }, '카운터파티 디폴트 보고'),
          ],
          expert: {
            rating: 62,
            rationale:
              '계약상 정당하고 권한을 하루 먼저 얻는다. 그러나 이 시점에 혼자 선언하면 이튿날 저녁의 공동 정리 협의가 시작되기도 전에 다른 프라임브로커들이 각자 움직이게 된다 — 이 시나리오에서 가장 비싼 것은 손실이 아니라 조율의 실패다.',
            sourceRefs: [S.pressStand, S.bcbs],
          },
          consequences:
            '디폴트가 통지되었습니다. 상계 청산 권한이 생겼고, 다른 프라임브로커들이 이를 알게 됩니다.',
          irreversible: true,
          feasibility: {
            basis: '납입 마감 경과 시 계약상 디폴트 사유 발생 — 즉시 선언 가능',
            sourceRefs: [S.bcbs],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '대시보드의 "미회수 익스포저"를 보십시오. 이 값은 담보로 덮이지 않은 평가손실입니다.',
    },
    {
      level: 2,
      decisionId: 't3-d1',
      text: '오늘은 고객이 아직 현금을 낼 수 있는 마지막 날일 수 있습니다. 내일의 지급 능력은 오늘보다 나쁩니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: '유예는 비용이 없어 보이지만 담보 없는 하루를 사는 것입니다. 11:00 마감을 그대로 집행하고 받을 수 있는 만큼 오늘 받으십시오.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'regulator-escalation-ladder'],
}

export const turnsA: T[] = [t0, t1, t2, t3]
