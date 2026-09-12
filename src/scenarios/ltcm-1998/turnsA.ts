import type { PrimeBrokerState, Turn } from '../../engine/types'
import { confidence, flag, op, regulator } from '../../engine/fx/common'
import { ltcmFx } from './fx'

type T = Turn<PrimeBrokerState>

/** 출처 id (sources.ts). */
export const S = {
  pwg: 'pwg-hedge-funds-1999',
  mcd: 'frbny-mcdonough-1998-10-01',
  greenspan: 'greenspan-testimony-1998-10-01',
  gao: 'gao-ggd-00-67r',
  fedHist: 'fed-history-ltcm',
  fedCut: 'fed-pr-1998-10-15',
  bcbs45: 'bcbs-45',
  bcbs46: 'bcbs-46',
  fmc: 'greenspan-fmc-1999-10-19',
  cgfs: 'cgfs-12-autumn-1998',
  furfine: 'bis-wp-103-furfine',
  jorion: 'jorion-2000-ltcm',
  h15: 'frb-h15-treasury-1998',
  moodys: 'fred-moodys-baa-aaa-1998',
  vix: 'cboe-vix-1998',
  ted: 'fred-tedrate-1998',
  pressOffer: 'press-investor-group-1998-09-23',
}

/**
 * 사후정보 금지 토큰. T0(8/17)~T2(9/18) 텍스트에 등장할 수 없다:
 * 컨소시엄 · 36억 · 3,625 · 90% 지분 · 버크셔 · 12:30 · 피터 피셔 실사 · 10월 15일 인하.
 * `ltcm.test.ts`가 검사한다.
 */

// =================================================================================================
// T0 — 1998-08-17 (월) "모라토리엄"
// =================================================================================================
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '1998년 8월 17일 (월) 08:00 ET',
  title: '러시아 모라토리엄',
  time: '1998-08-17T08:00:00-04:00',
  entryEffects: [
    {
      id: 't0-market',
      description: '8/17 종가로 시장을 세운다 (FRED 직접 조회)',
      effects: [
        op('market.govt2yBp', 'set', 534, '2년 5.34%'),
        op('market.govt10yBp', 'set', 540, '10년 5.40%'),
        op('market.govt30yBp', 'set', 556, '30년 5.56%'),
        op('market.creditSpreadIgBp', 'set', 174, 'Baa − 10년 174bp'),
        op('market.custom.baaAaaBp', 'set', 61, 'Baa − Aaa 61bp'),
        op('market.volIndex', 'set', 31.86, 'VIX 31.86'),
        op('market.fundingStressBp', 'set', 76, 'TED 0.76%'),
        op('market.custom.tedBp', 'set', 76),
        op('market.custom.swapSpread10yBp', 'set', 60), // [CAL] CGFS 12 Table A1 17 Aug~22 Sep 평균 77bp 구간의 초입
        op('market.custom.onOffRun10yBp', 'set', 10), // [CAL] 8/14 앵커 9bp 대비 보정 경로
      ],
    },
    {
      id: 't0-exogenous',
      description: '수렴 스프레드 종합지수 103, 변동성 배수 1.00, LTCM 자본 $3.6B(추정)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 103,
          volMultiplier: 1,
          ltcmCapitalB: 3.6,
          ltcmLiquidityB: 1.55,
          label: '8/17 외생 상태',
        }),
        confidence(-4, '러시아 모라토리엄 — 안전자산 선호'),
      ],
    },
  ],
  events: [
    {
      id: 't0-news-russia',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '08:05',
      headline: '러시아, 루블 실질 평가절하와 채무 모라토리엄 선언',
      body: '러시아 정부가 루블의 실질적 평가절하와 국내 채무에 대한 모라토리엄을 발표했다. 신흥국 국채와 고수익 회사채가 동시에 밀리고 미 국채로 자금이 몰리고 있다. 딜러들은 신흥국 데스크의 한도를 점검하고 있다.',
      severity: 'critical',
      sourceRefs: [S.mcd, S.cgfs],
      relatedMetrics: ['market.convergenceIdx', 'creditSpreadIgBp'],
    },
    {
      id: 't0-data-market',
      kind: 'data',
      time: '16:00',
      title: '8월 17일 종가',
      rows: [
        { label: '미 국채 10년', value: '5.40%' },
        { label: '미 국채 2년', value: '5.34%' },
        { label: '무디스 Baa − 10년', value: '174bp' },
        { label: '무디스 Baa − Aaa (품질 스프레드)', value: '61bp' },
        { label: 'VIX', value: '31.86' },
        { label: 'TED 스프레드', value: '76bp' },
        { label: '수렴 스프레드 종합지수', value: '103 (8/14 = 100)' },
      ],
      sourceRefs: [S.h15, S.moodys, S.vix, S.ted],
    },
    {
      id: 't0-memo-book',
      kind: 'memo',
      time: '09:30',
      from: '프라임브로커리지 데스크',
      to: '리스크 헤드',
      subject: 'LTCM 익스포저 현황 (8/14 종가 기준)',
      body: `- 우리와의 **총명목 $96B**: 스왑 스프레드 수렴 42 · 국채 온·오프더런 26 · 주가지수 변동성 14 · 신흥국 국채 9 · 합병차익 5.
- **순대체원가 ≈ $0** — 명목과 순익스포저는 자릿수가 다릅니다. 담보는 오직 현재 대체원가만 덮고 있고, **초기증거금은 받고 있지 않습니다.**
- 경쟁 압력으로 헤어컷은 사실상 사라졌습니다. 다른 딜러도 조건이 비슷하다고 들었습니다.
- 우리가 파악한 LTCM의 다른 주요 거래상대는 **8곳**입니다. 실제로 몇 곳과 거래하는지는 알 수 없습니다.
- 자사 자기매매 수렴 북도 **같은 방향 $18B**입니다. LTCM이 틀리면 우리도 같이 틀립니다.`,
      severity: 'warning',
      sourceRefs: [S.pwg, S.bcbs45],
      cardRefs: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
      relatedMetrics: ['grossExposure', 'netExposureB', 'knownCounterpartyCount'],
    },
    {
      id: 't0-memo-credit',
      kind: 'memo',
      time: '14:00',
      from: '여신심사역',
      to: '리스크 헤드',
      subject: 'LTCM 신용 파일 — 우리가 가진 것과 갖지 못한 것',
      body: `가지고 있는 것: 월별 순자산 통보(자발적), 거래상대별 담보 명세, 우리와의 계약별 시가평가.
가지고 있지 않은 것: 전체 포지션, 총자산, 합산 레버리지, 다른 거래상대와의 계약 규모.
'97년 말 투자자에게 자본을 돌려준 뒤 레버리지가 올라갔다는 이야기가 있지만 확인할 방법이 없습니다. 한도는 총명목 $120B이며 우리는 그 80%를 쓰고 있습니다.`,
      severity: 'info',
      sourceRefs: [S.pwg, S.bcbs45, S.greenspan],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't0-rumor-desks',
      kind: 'rumor',
      source: '거래소 플로어',
      time: '15:20',
      headline: '"큰 수렴 계정이 신흥국에서 물려 있다"',
      body: '어느 계정인지는 특정되지 않았다. 확인되지 않은 이야기다.',
      severity: 'info',
      reliability: 'unconfirmed',
      sourceRefs: [S.cgfs],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '모라토리엄 당일의 스탠스',
      prompt:
        '러시아 모라토리엄 당일, LTCM 계정에 대해 무엇을 하시겠습니까? (최대 2개; 관계 유지(A)와 한도 축소(E)는 함께 선택할 수 없습니다)',
      context:
        '오늘 바꾸지 않은 계약 조건은 한 달 뒤에도 그대로입니다. 반대로 오늘 세게 조이면 고객은 정보를 닫습니다.',
      select: { min: 1, max: 2 },
      exclusive: [['t0-a', 't0-e']],
      requiredConcepts: ['hqla-and-haircuts'],
      dimensions: ['marketRisk', 'communication', 'timeliness'],
      cardRefs: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
      options: [
        {
          id: 't0-a',
          label: '현행 계약 조건 유지 — 관계를 지키고 상황을 지켜본다',
          description:
            '초기증거금도, 마크 변경도, 자료 요구도 하지 않는다. 실행 가능: 아무것도 하지 않는 선택으로 계약 변경이 필요 없다.',
          effects: [flag('status_quo_t0')],
          expert: {
            rating: 40,
            rationale:
              '8월 17일 당일에는 딜러 가운데 누구도 LTCM의 조건을 바꾸지 않았다. PWG는 경쟁 압력이 헤어컷을 없앴다고 적는다("Competitive pressures, however generally led to banks\' reducing, or eliminating such haircuts"). 오늘 아무 일도 일어나지 않았다는 사실이 이 선택을 합리적으로 보이게 하지만, BCBS 46은 담보 의존 자체가 결함이었다고 판정한다.',
            historicalNote: '실제 선택. 8/17에 LTCM의 담보 조건을 바꾼 딜러는 없었다.',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences: '계약 조건은 그대로입니다. 데스크는 평소처럼 일일 시가평가만 돌렸습니다.',
          historical: true,
          feasibility: { basis: '계약 변경 없이 당일 실행 가능', sourceRefs: [S.pwg] },
        },
        {
          id: 't0-b',
          label: '신규 거래에 초기증거금 3% 도입하고 손실 임계를 0으로',
          description:
            '앞으로 체결하는 스왑에 명목 3%의 초기증거금을 요구하고, 담보를 부르지 않는 손실 임계(threshold)를 없앤다. 고객은 일부 물량을 다른 거래상대로 옮길 것이다. 실행 가능: 신규 계약 조건이므로 기존 계약의 수정 합의가 필요 없다.',
          effects: [
            ltcmFx.setMarginPolicy({
              staticPct: 3,
              dynamic: true,
              concentrationAddOn: false,
              bookScale: 0.9,
              imB: 0.35,
              label: '초기증거금 3% · 손실 임계 0',
            }),
          ],
          expert: {
            rating: 82,
            rationale:
              'BCBS 46이 LTCM 이후 권고한 방향 그대로다: 담보는 현재 대체원가만 덮으므로, 미래 잠재 익스포저(PFE)를 덮는 초기증거금과 손실 임계 축소가 필요하다. McDonough도 세 가지 과제 중 하나로 "the structuring of margin agreements"를 꼽았다. 비용은 책이 10% 줄어드는 것뿐이다.',
            sourceRefs: [S.bcbs46, S.mcd],
          },
          consequences:
            'LTCM은 신규 스왑의 일부를 다른 거래상대로 돌렸습니다. 우리 책은 약 10% 줄었고 담보가 처음으로 쌓이기 시작했습니다.',
          preview: [
            { metric: 'marginCoverage', direction: 'up', magnitude: 2, note: '담보가 쌓인다' },
            { metric: 'grossExposure', direction: 'down', magnitude: 1 },
          ],
          feasibility: {
            basis: '신규 계약 조건 변경은 일방적으로 가능; 기존 계약은 불가',
            sourceRefs: [S.bcbs46],
          },
          calibrationNote: '책 배율 0.9 [CAL] — calibration.md §4.2',
        },
        {
          id: 't0-c',
          label: '전체 포지션·합산 레버리지 자료를 계약 갱신 조건으로 요구',
          description:
            '다음 계약 갱신 때 총자산·합산 레버리지·거래상대 수를 제출하라고 요구한다. 거절당할 수 있고, 그 거절 자체가 정보다. 실행 가능: 갱신 협상에서 조건으로 제시.',
          effects: [
            flag('info_requested'),
            ltcmFx.shareExposure({ peerDelta: 2, knownCount: 10, label: '고객 자료 요구' }),
          ],
          expert: {
            rating: 70,
            rationale:
              'PWG: "Prior to the market events of August 1998, many hedge fund counterparties provided limited or no information with respect to aggregate security portfolios, leverage, risk concentrations, performance, and trading strategies." 요구하지 않으면 받지 못한다. 다만 8월 시점에 이 요구가 받아들여졌을지는 확실하지 않다 — 실제로는 9월 이후에야 자료가 나왔다.',
            sourceRefs: [S.pwg, S.bcbs45],
          },
          consequences:
            'LTCM은 "월별 순자산 통보 외의 자료는 어느 거래상대에게도 주지 않는다"고 답하면서도, 주요 거래상대가 8곳보다 많다는 점은 인정했습니다.',
          preview: [{ metric: 'knownCounterpartyCount', direction: 'up', magnitude: 1 }],
          feasibility: { basis: '계약 갱신 협상에서 제시 가능', sourceRefs: [S.pwg] },
        },
        {
          id: 't0-d',
          label: '주요 딜러와 헤지펀드 익스포저 상호 공개 채널을 제안',
          description:
            '경쟁사 리스크 총괄들에게 고객별이 아닌 **총량 기준** 익스포저를 상호 공개하는 비공식 채널을 제안한다. 법무의 반독점·비밀유지 검토를 거친 총량 집계 방식이다. 실행 가능: 1998년에도 딜러 간 리스크 총괄 채널은 존재했다.',
          effects: [
            flag('info_exchange'),
            ltcmFx.shareExposure({ peerDelta: 8, knownCount: 12, label: '딜러 간 익스포저 교환' }),
          ],
          expert: {
            rating: 85,
            rationale:
              'Greenspan은 "creditors as a whole most likely underestimated the size and scope of the market bets that LTCM was undertaking"고 진단했고, PWG는 어느 거래상대도 "an effective check on its overall activities"가 되지 못했다고 적었다. 합산을 볼 수 있는 주체가 없었다는 것이 이 사건의 구조적 결함이며, 총량 공유는 그 결함에 직접 대응한다. 캐비앳: 1998년에 이런 채널이 실제로 작동한 기록은 없다(반사실).',
            sourceRefs: [S.greenspan, S.pwg, S.bcbs45],
          },
          consequences:
            '세 곳이 총량 기준 공유에 동의했습니다. 첫 집계만으로도 우리가 알던 8곳이 최소 12곳이라는 것이 드러났습니다.',
          preview: [
            { metric: 'peerCooperation', direction: 'up', magnitude: 2 },
            { metric: 'knownCounterpartyCount', direction: 'up', magnitude: 2 },
          ],
          feasibility: {
            basis: '반사실: 총량 공유 채널은 LTCM 이후에야 제도화되었다(BCBS 45·46)',
            sourceRefs: [S.bcbs45],
          },
        },
        {
          id: 't0-e',
          label: '신용한도를 절반으로 줄이고 신규 스왑을 즉시 중단',
          description:
            '한도를 $60B로 내리고 신규 거래를 멈춘다. 기존 계약은 그대로 남는다. 실행 가능: 한도는 일방적으로 조정할 수 있다.',
          effects: [
            ltcmFx.setMarginPolicy({
              staticPct: 0,
              dynamic: false,
              concentrationAddOn: false,
              bookScale: 1,
              label: '신규 중단(기존 계약 유지)',
            }),
            op('institution.clients.0.creditLimit', 'set', 60, '한도 $60B'),
            ltcmFx.peerSignal({ delta: -6, label: '일방적 거래 중단' }),
            flag('new_business_halted'),
          ],
          expert: {
            rating: 35,
            rationale:
              '한도를 줄여도 **기존 계약의 익스포저는 그대로**다 — 문제는 신규가 아니라 이미 체결된 명목이다. 그러면서 고객과 다른 딜러에게는 "저 집은 손을 뗀다"는 신호가 되어 정보는 닫히고 협조는 어려워진다. 8월 17일에 이 신호를 보낼 근거도 아직 없다.',
            sourceRefs: [S.pwg, S.bcbs45],
          },
          consequences:
            'LTCM 측이 "조건을 그렇게 바꾸면 다른 거래상대와 얘기하겠다"고 답했습니다. 자료 제공은 그날로 끊겼습니다.',
          preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 2 }],
          feasibility: {
            basis: '한도 조정은 일방 가능; 기존 계약 해지는 불가',
            sourceRefs: [S.pwg],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드에서 **총명목**과 **순익스포저**를 나란히 보세요. 명목 $96B, 순익스포저 $0.03B — 자릿수가 다릅니다. 위험은 오늘의 순익스포저가 아니라 그것이 하루에 얼마나 움직일 수 있는지입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '담보는 현재 대체원가만 덮습니다. 미래 잠재 익스포저(PFE)를 덮는 것은 초기증거금입니다. 그리고 "파악된 거래상대 8곳"은 사실이 아니라 우리 기록의 한계입니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: 'B(초기증거금)는 비용이 작고 되돌릴 수 없는 이득을 만듭니다. D(익스포저 교환)는 이 시나리오에서 유일하게 합산을 볼 수 있게 해 주는 수단입니다. E는 익스포저를 줄이지 못한 채 정보만 끊습니다.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
}

// =================================================================================================
// T1 — 1998-09-02 (수) "투자자 서한"
// =================================================================================================
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '1998년 9월 2일 (수) 09:00 ET',
  title: '투자자 서한 — 연초 대비 −52%',
  time: '1998-09-02T09:00:00-04:00',
  entryEffects: [
    {
      id: 't1-market',
      description: '9/2 종가로 시장을 세운다',
      effects: [
        op('market.govt2yBp', 'set', 496),
        op('market.govt10yBp', 'set', 510),
        op('market.govt30yBp', 'set', 534),
        op('market.creditSpreadIgBp', 'set', 204, 'Baa 7.14 − 10년 5.10'),
        op('market.custom.baaAaaBp', 'set', 64),
        op('market.volIndex', 'set', 36.76),
        op('market.fundingStressBp', 'set', 81),
        op('market.custom.tedBp', 'set', 81),
        op('market.custom.swapSpread10yBp', 'set', 76), // [CAL] 17 Aug~22 Sep 평균 77bp 구간 중간
        op('market.custom.onOffRun10yBp', 'set', 15), // [CAL]
      ],
    },
    {
      id: 't1-exogenous',
      description: '수렴지수 128, 변동성 배수 1.30, LTCM 자본 $2.3B(8/31)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 128,
          volMultiplier: 1.3,
          ltcmCapitalB: 2.3,
          ltcmLiquidityB: 1.3,
          label: '9/2 외생 상태',
        }),
        confidence(-8, '수렴 거래가 동시에 반대로 벌어짐'),
      ],
    },
  ],
  events: [
    {
      /**
       * The correction to `t0-rumor-desks`. The unnamed "큰 수렴 계정" was the reader's own fund,
       * and the letter naming it is the first item of this turn — so the rumour is answered by the
       * scenario's own escalation rather than by a wire clarification.
       *
       * The lesson is the ordering: the desks knew a week before the letter, which means the
       * counterparties pricing your collateral had already reached their conclusion while you were
       * still deciding whether to confirm anything.
       */
      id: 't1-news-rumour-named',
      kind: 'newswire',
      outlet: '통신사',
      time: '11:55',
      headline: '[확인] 지난주 데스크에서 돌던 "큰 수렴 계정"은 LTCM이었다',
      body:
        '어느 계정인지 특정되지 않은 채 일주일을 돌던 이야기는 투자자 서한이 알려지면서 확인됐다. ' +
        '거래상대들은 이름이 공개되기 전부터 해당 계정의 담보를 다르게 매기고 있었다.',
      severity: 'critical',
      reliability: 'confirmed',
      correctionOf: 't0-rumor-desks',
      sourceRefs: [S.mcd, S.pwg],
    },
    {
      id: 't1-news-letter',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '11:40',
      headline: 'LTCM, 투자자 서한에서 연초 대비 −52% 손실 인정 — 증자 추진',
      body: 'LTCM의 파트너들이 9월 2일 투자자에게 보낸 서한에서 8월 31일까지 연초 대비 52%의 손실을 인정하고 자본 확충을 추진 중이라고 밝혔다. 서한의 존재는 며칠 만에 시장에 널리 알려졌다. 8월 한 달의 손실만 $1.8B, 자본은 $2.3B로 줄었다.',
      severity: 'critical',
      sourceRefs: [S.mcd, S.pwg],
      relatedMetrics: ['ltcmCapitalB'],
    },
    {
      id: 't1-data-ltcm',
      kind: 'data',
      time: '12:00',
      title: 'LTCM 자본 경로 (서한 및 자체 추정)',
      rows: [
        { label: "'97말 자본 (투자자에 $2.7B 반환 후)", value: '$4.8B' },
        { label: '7/31 자본', value: '$4.1B' },
        { label: '8월 손실', value: '−$1.8B (−44%)' },
        { label: '8/31 자본', value: '$2.3B' },
        { label: '8/31 총자산', value: '>$125B' },
        { label: '레버리지 (자산/자본)', value: "'97말 28:1 · 8/31 기준 25:1 초과" },
      ],
      sourceRefs: [S.pwg, S.fedHist],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't1-memo-desk',
      kind: 'memo',
      time: '13:30',
      from: '프라임브로커리지 데스크',
      to: '리스크 헤드',
      subject: '수렴 거래가 동시에 반대로 벌어졌습니다',
      body: `분산이 작동하지 않습니다. 스왑 스프레드, 온·오프더런 베이시스, 신흥국 베이시스, 주가지수 변동성이 **같은 방향으로 동시에** 벌어졌습니다. 수렴 스프레드 종합지수는 8/14 100 → 오늘 128입니다.

- LTCM에 대한 순대체원가: **$0.28B** (명목은 여전히 $96B).
- 담보: $0.00B. 초기증거금이 없으니 오늘 벌어진 만큼이 그대로 무담보 익스포저입니다.
- 자사 수렴 북 평가손실: −$0.11B. 우리도 같은 거래를 하고 있었습니다.`,
      severity: 'critical',
      sourceRefs: [S.cgfs, S.pwg],
      cardRefs: ['hqla-and-haircuts'],
      relatedMetrics: ['netExposureB', 'replacementCostB', 'ownConvergencePnlB'],
    },
    {
      id: 't1-dialogue-relationship',
      kind: 'dialogue',
      time: '15:00',
      title: '영업 총괄과의 회의',
      lines: [
        {
          speaker: '영업 총괄',
          text: '지금 담보를 부르면 이 관계는 끝납니다. 지난 4년 동안 이 계정이 데스크에 가져다준 수수료를 생각하십시오.',
        },
        {
          speaker: '리스크 헤드',
          text: '그 4년의 수익률은 20, 43, 41, 17%였습니다. 올해는 −52%입니다.',
        },
        {
          speaker: '영업 총괄',
          text: '스프레드는 되돌아옵니다. 늘 그랬습니다. 지금 조이면 우리가 그 되돌림을 못 받습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.fedHist, S.pwg],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '담보 재산정을 시작할 것인가',
      prompt: '9월 2일, LTCM 계정의 담보를 어떻게 다루시겠습니까?',
      context:
        '오늘 부르지 않은 담보는 나중에 부를 수 있습니다 — 고객이 낼 수 있는 동안만. PWG는 LTCM이 끝까지 "every margin and collateral call on a timely basis"를 이행했다고 기록합니다.',
      requiredConcepts: ['hqla-and-haircuts'],
      dimensions: ['marketRisk', 'solvency'],
      cardRefs: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
      options: [
        {
          id: 't1-a',
          label: '재산정하지 않고 관계를 유지 — 스프레드는 되돌아온다',
          description:
            '마크도 담보도 그대로 둔다. 되돌림이 오면 익스포저는 저절로 사라진다. 실행 가능: 아무것도 하지 않는 선택.',
          effects: [
            flag('loose_margin'),
            ltcmFx.peerSignal({ delta: 2, label: '관계 유지' }),
            confidence(2, '고객 관계 안정'),
          ],
          expert: {
            rating: 10,
            rationale:
              '1998년 9월에 가장 자연스러운 선택이었고 가장 비쌌다. 수렴 스프레드는 되돌아오지 않았다 — 9/2 지수 128은 9/21에 152가 된다. PWG는 담보가 **현재 대체원가만** 덮는다는 점과, 거래상대들이 "lulled into a false sense of security based solely upon their collateral arrangements"였는지를 문제로 적는다. 담보를 부르지 않으면 벌어진 만큼이 그대로 무담보 익스포저로 남고, 고객이 낼 수 있는 시간은 매일 줄어든다.',
            historicalNote:
              '실제로는 딜러들이 9월 초부터 일일 시가평가를 조이기 시작했다. 이 선택지는 "그러지 않았다면"의 반사실이다.',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences:
            '영업 총괄이 안도했습니다. 순익스포저는 $0.28B로 그대로 남았고, 담보 계정은 비어 있습니다.',
          trap: true,
          trapExplanation:
            '되돌림에 거는 것은 포지션을 늘리는 것과 같다. 수렴 거래의 손실은 스프레드가 벌어진 만큼이 아니라 **벌어진 채로 고객이 버티지 못하는 시간**만큼 커진다. 관계를 지킨 대가로 무담보 익스포저를 3주 동안 들고 가게 된다.',
          preview: [{ metric: 'netExposureB', direction: 'up', magnitude: 3 }],
          feasibility: { basis: '계약 변경 불필요', sourceRefs: [S.pwg] },
          remediationCard: 'hqla-and-haircuts',
        },
        {
          id: 't1-b',
          label: '일일 재산정 개시 — 중간값 마크로 대체원가 전액 담보',
          description:
            '오늘부터 매일 시가평가하고 대체원가 전액을 담보로 부른다. 마크는 딜러 호가의 중간값을 쓴다. 실행 가능: 기존 담보 계약의 일일 마진 조항으로 가능.',
          effects: [
            flag('daily_remargin'),
            ltcmFx.remargin({ markPct: 1, label: '일일 재산정(중간값 마크)' }),
          ],
          expert: {
            rating: 80,
            rationale:
              '계약상 이미 가진 권리를 쓰는 것이고, 고객이 아직 낼 수 있을 때 부르는 것이다. PWG는 이 시점의 실무를 "counterparties typically use collateral as a risk mitigation device"로 적고, LTCM이 모든 콜을 제때 이행했음을 확인한다. 중간값 마크는 다른 딜러가 분쟁을 걸 여지를 주지 않아 관계와 익스포저를 함께 지킨다.',
            historicalNote: '9월 초 다수의 거래상대가 일일 마진 프로세스를 조이기 시작했다(PWG).',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences:
            'LTCM이 당일 $0.28B를 납입했습니다. 순익스포저가 0으로 돌아왔고, 담보 계정이 처음으로 채워졌습니다.',
          historical: true,
          preview: [
            { metric: 'netExposureB', direction: 'down', magnitude: 3 },
            { metric: 'marginCoverage', direction: 'up', magnitude: 3 },
          ],
          feasibility: { basis: '기존 담보 계약의 일일 마진 조항', sourceRefs: [S.pwg] },
          calibrationNote: '대체원가 전액 담보(markPct 1.0) — calibration.md §4.3',
        },
        {
          id: 't1-c',
          label: '청산가치 마크를 적용해 대체원가의 125%를 즉시 요구',
          description:
            '호가 중간값이 아니라 "지금 실제로 풀 수 있는 가격"으로 마크하고 그 125%를 부른다. 고객의 유동성을 직접 겨눈다. 실행 가능: 마크 방법론은 계약상 계산대리인의 재량 범위.',
          effects: [
            flag('daily_remargin'),
            ltcmFx.remargin({
              markPct: 1.25,
              peerDelta: -4,
              label: '청산가치 마크 125%',
            }),
          ],
          expert: {
            rating: 45,
            rationale:
              'PWG는 9월 하순 거래상대들이 실제로 이렇게 했다고 적는다 — "in many cases by seeking to apply possible liquidation values to mark-to-market valuations". 우리 익스포저는 확실히 줄지만, 같은 행동을 모두가 하면 고객의 현금이 마르는 속도가 빨라지고 그 디폴트가 다시 우리 포지션을 친다. 9/2에 하기에는 이르다 — 되돌릴 수 없는 압박을 3주 먼저 거는 셈이다.',
            sourceRefs: [S.pwg, S.mcd],
          },
          consequences:
            'LTCM이 마크 산정 방식에 이의를 제기하면서도 납입했습니다. 다른 딜러 두 곳이 "그쪽은 어떤 마크를 쓰느냐"고 물어 왔습니다.',
          preview: [
            { metric: 'netExposureB', direction: 'down', magnitude: 3 },
            { metric: 'peerCooperation', direction: 'down', magnitude: 1 },
          ],
          feasibility: { basis: '계산대리인 재량; 분쟁 가능', sourceRefs: [S.pwg] },
        },
        {
          id: 't1-d',
          label: '기존 계약에 초기증거금을 소급 적용하겠다고 통보',
          description:
            '이미 체결된 스왑에도 명목 3%의 초기증거금을 요구한다. 기존 계약의 담보 부속서(CSA) 수정에는 상대방 합의가 필요하다.',
          effects: [
            regulator({ add: 1 }, '계약 조건 일방 변경 시도'),
            ltcmFx.peerSignal({ delta: -8, label: '소급 조건 변경 시도' }),
            flag('retroactive_im_attempt'),
          ],
          expert: {
            rating: 20,
            rationale:
              '기존 계약의 담보 조건은 일방적으로 바꿀 수 없다 — 소급 요구는 계약 위반 주장을 부르고, 실무적으로는 고객이 그날로 다른 거래상대에게 달려가게 만든다. "지금 조건을 바꾸려 한다"는 소문은 몇 시간이면 퍼진다. BCBS 46이 권고한 것은 **사전에** 조건을 제대로 설계하라는 것이지 사후에 바꾸라는 것이 아니다.',
            sourceRefs: [S.bcbs46, S.pwg],
          },
          consequences:
            'LTCM 법무가 계약 위반이라고 회신했습니다. 같은 날 다른 딜러 두 곳이 우리 요구를 전해 들었습니다.',
          preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 2 }],
          feasibility: {
            basis: '기존 CSA 수정은 상대방 합의 필요 — 일방 실행 불가',
            sourceRefs: [S.bcbs46],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '순익스포저가 $0.00B에서 $0.28B로 올라왔습니다. 담보 계정은 여전히 비어 있습니다.',
    },
    {
      level: 2,
      decisionId: 't1-d1',
      text: '질문은 "부를 것인가"가 아니라 "어떤 마크로 부를 것인가"입니다. 중간값 마크는 분쟁을 만들지 않고, 청산가치 마크는 익스포저를 더 줄이지만 고객의 시계를 앞당깁니다.',
    },
    {
      level: 3,
      decisionId: 't1-d1',
      text: '되돌림에 거는 A는 이 시나리오의 함정입니다. 수렴지수는 9월 21일에 152가 됩니다.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
}

// =================================================================================================
// T2 — 1998-09-18 (금) "아무도 합산을 모른다"
// =================================================================================================
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '1998년 9월 18일 (금) 09:00 ET',
  title: '증자 실패와 뉴욕연준의 전화',
  time: '1998-09-18T09:00:00-04:00',
  entryEffects: [
    {
      id: 't2-market',
      description: '9/18 종가로 시장을 세운다',
      effects: [
        op('market.govt2yBp', 'set', 461),
        op('market.govt10yBp', 'set', 470),
        op('market.govt30yBp', 'set', 515),
        op('market.creditSpreadIgBp', 'set', 237, 'Baa 7.07 − 10년 4.70'),
        op('market.custom.baaAaaBp', 'set', 70),
        op('market.volIndex', 'set', 38.63),
        op('market.fundingStressBp', 'set', 99),
        op('market.custom.tedBp', 'set', 99),
        op('market.custom.swapSpread10yBp', 'set', 86), // [CAL] 23 Sep~15 Oct 평균 88bp·10/14 정점 97bp로 가는 경로
        op('market.custom.onOffRun10yBp', 'set', 19), // [CAL]
      ],
    },
    {
      id: 't2-exogenous',
      description: '수렴지수 146, 변동성 배수 1.51, LTCM 자본 $1.5B(추정)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 146,
          volMultiplier: 1.51,
          ltcmCapitalB: 1.5,
          ltcmLiquidityB: 0.75,
          label: '9/18 외생 상태',
        }),
        confidence(-6, '증자 실패가 알려짐'),
      ],
    },
    {
      id: 't2-standing-remargin',
      when: { flag: 'daily_remargin' },
      description: '일일 재산정이 가동 중이면 오늘치 담보를 부른다',
      effects: [ltcmFx.remargin({ markPct: 1, label: '일일 재산정(9/18)' })],
    },
  ],
  events: [
    {
      id: 't2-news-capital',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '09:10',
      headline: 'LTCM 증자 노력 난항 — 자본 유치 접촉 사실이 알려지며 불안 확산',
      body: '자본 유치를 위해 접촉한 상대가 늘면서 LTCM의 상태를 아는 사람이 오히려 늘었다. 증자는 성사되지 않았다. 시장 조성자들이 수렴 거래 관련 호가를 넓히고 있다.',
      severity: 'critical',
      sourceRefs: [S.pwg, S.mcd],
    },
    {
      id: 't2-call-frbny',
      kind: 'call',
      time: '11:30',
      caller: '뉴욕연방준비은행 총재실',
      callee: '리스크 헤드',
      agency: 'Federal Reserve Bank of New York',
      tone: 'concerned',
      lines: [
        {
          speaker: '뉴욕연준',
          text: '오늘 시장 상황 전반에 대해 몇 군데에 전화를 돌리고 있습니다. 특별한 사안이 있어서가 아니라 평소 하던 대로입니다.',
        },
        { speaker: '리스크 헤드', text: '무엇을 보고 계십니까.' },
        {
          speaker: '뉴욕연준',
          text: '여러분이 보고 계신 것을 듣고 싶습니다. 오늘 통화한 분들이 한 곳의 상태가 세계 시장에 미칠 영향을 먼저 꺼냈습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.mcd],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't2-memo-gap',
      kind: 'memo',
      time: '14:00',
      from: '리스크 관리부',
      to: '리스크 헤드',
      subject: '우리가 모르는 것의 목록',
      body: `오늘 집계입니다.

- 우리 순익스포저: 담보를 부르고 있다면 0에 가깝고, 부르지 않았다면 $0.46B입니다.
- 우리 청산 VaR: $0.21B. 여기에 **동시에 청산에 나서는 딜러 수**를 곱해야 실제 손실이 됩니다.
- 우리가 곱하고 있는 수: 아는 거래상대 8곳 기준 ×1.35.
- 실제로 곱해야 하는 수: **모릅니다.**

이 마지막 줄이 문제입니다. 우리 시스템이 내놓는 청산 손실 추정치는 우리가 아는 만큼만 맞습니다.`,
      severity: 'critical',
      sourceRefs: [S.greenspan, S.mcd, S.pwg],
      cardRefs: ['economic-vs-regulatory-capital'],
      relatedMetrics: ['closeoutLossB', 'crowdFactorEst', 'knownCounterpartyCount'],
    },
    {
      id: 't2-data-spreads',
      kind: 'data',
      time: '16:00',
      title: '9월 18일 종가 — 8월 14일 대비',
      rows: [
        { label: '미 국채 10년', value: '4.70% (8/14 5.40%)' },
        { label: '무디스 Baa − 10년', value: '237bp (8/14 174bp)' },
        { label: '무디스 Baa − Aaa', value: '70bp (8/14 62bp)' },
        { label: 'TED 스프레드', value: '99bp (8/14 79bp)' },
        { label: 'VIX', value: '38.63 (8/14 34.34)' },
        { label: '수렴 스프레드 종합지수', value: '146 (8/14 100)' },
      ],
      sourceRefs: [S.h15, S.moodys, S.ted, S.vix, S.cgfs],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '정보 결핍에 무엇을 하겠는가',
      prompt: '합산 익스포저를 알 방법이 없습니다. 오늘 무엇을 하시겠습니까? (최대 2개)',
      context:
        '청산 손실 추정치는 "동시에 몇 곳이 팔 것인가"에 달려 있고, 그 숫자를 아무도 가지고 있지 않습니다. 정보를 구하는 방법마다 대가가 다릅니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'compliance', 'timeliness'],
      cardRefs: ['crisis-communication', 'economic-vs-regulatory-capital'],
      options: [
        {
          id: 't2-a',
          label: 'LTCM에 전체 포지션과 거래상대 명세 제출을 요구',
          description:
            '계약상 근거는 없지만 담보 협상의 조건으로 요구한다. 거절당할 수 있다. 실행 가능: 협상 조건으로 제시 가능.',
          effects: [
            ltcmFx.shareExposure({ peerDelta: 1, knownCount: 11, label: '고객에게 명세 요구' }),
            flag('client_disclosure_requested'),
          ],
          expert: {
            rating: 55,
            rationale:
              '가장 직접적이지만 가장 늦다. PWG는 8월 이전 헤지펀드 거래상대들이 "limited or no information"만 받았다고 적는다. 9월 18일에 요구하면 부분적으로는 받게 되지만, 고객이 스스로 고른 숫자다.',
            sourceRefs: [S.pwg, S.bcbs45],
          },
          consequences:
            'LTCM이 주요 거래상대를 11곳까지 열거했습니다. "전부는 아니다"라고 덧붙였습니다.',
          preview: [{ metric: 'knownCounterpartyCount', direction: 'up', magnitude: 1 }],
          feasibility: { basis: '담보 협상 조건으로 제시 가능', sourceRefs: [S.pwg] },
        },
        {
          id: 't2-b',
          label: '주요 딜러 세 곳과 총량 기준 익스포저를 교환',
          description:
            '고객별 계약 내용이 아니라 **총량**만 상호 공개한다. 법무가 반독점·비밀유지 관점에서 총량 집계 방식을 승인했다. 실행 가능: 딜러 간 리스크 총괄 채널.',
          effects: [
            flag('info_exchange'),
            ltcmFx.shareExposure({ peerDelta: 8, knownCount: 13, label: '딜러 간 총량 교환' }),
          ],
          expert: {
            rating: 85,
            rationale:
              'PWG의 진단이 바로 이것이다: "Although individual counterparties imposed bilateral trading limits on their own activities with LTCM, none of its investors, creditors, or counterparties provided an effective check on its overall activities." 각자 자기 몫만 보는 구조에서는 합산이 존재하지 않는다. 교환은 그 구조를 깨는 유일한 자력 수단이며, 뒤이은 집단행동의 전제가 된다.',
            sourceRefs: [S.pwg, S.greenspan, S.bcbs45],
          },
          consequences:
            '세 곳이 총량을 열었습니다. 합치는 순간 우리가 알던 8곳이 최소 13곳이 되었고, 세 곳의 명목 합계만 우리 책의 세 배였습니다.',
          historical: false,
          preview: [
            { metric: 'peerCooperation', direction: 'up', magnitude: 3 },
            { metric: 'knownCounterpartyCount', direction: 'up', magnitude: 2 },
          ],
          feasibility: {
            basis: '반사실: 총량 공유 채널은 LTCM 이후 BCBS 45·46으로 제도화되었다',
            sourceRefs: [S.bcbs45, S.bcbs46],
          },
        },
        {
          id: 't2-c',
          label: '뉴욕연준 통화에 우리 익스포저 규모와 우려를 그대로 전달',
          description:
            '오늘 걸려 온 전화에 숫자를 포함해 답한다. 감독당국은 헤지펀드에 대한 규제 권한이 없지만 시장 전반을 본다. 실행 가능: 이미 통화 중.',
          effects: [
            flag('fed_engaged'),
            ltcmFx.peerSignal({ delta: 4, label: '뉴욕연준에 우려 전달' }),
            confidence(2, '감독당국과 정보 공유'),
          ],
          expert: {
            rating: 75,
            rationale:
              'McDonough의 기록 그대로다: "Everyone I spoke to that day volunteered concern about the serious effect the deteriorating situation of Long-Term could have on world markets." 이 통화들이 9/20 실사와 9/22 소집으로 이어졌다. 연준은 자금을 대지 않았지만, 합산을 볼 수 있는 유일한 위치에 있었다.',
            historicalNote:
              '9월 18일 McDonough가 월가 고위 인사들에게 연쇄 통화를 했고, 같은 날 LTCM도 뉴욕연준에 접촉했다.',
            sourceRefs: [S.mcd, S.gao],
          },
          consequences:
            '우리 숫자를 전달했습니다. 뉴욕연준은 감사 인사만 했고 다른 말은 하지 않았습니다.',
          historical: true,
          preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 1 }],
          feasibility: { basis: '실제로 있었던 통화', sourceRefs: [S.mcd] },
        },
        {
          id: 't2-d',
          label: '대외 접촉 없이 담보 관행만 조인다',
          description:
            '마크를 보수적으로 바꾸고 일일 콜을 빠뜨리지 않는다. 우리 책만 본다. 실행 가능: 내부 조치.',
          effects: [
            flag('daily_remargin'),
            ltcmFx.remargin({ markPct: 1.1, label: '보수적 마크로 재산정' }),
          ],
          expert: {
            rating: 50,
            rationale:
              '자기 익스포저에는 옳은 조치이고 대부분의 딜러가 실제로 한 일이다. 그러나 PWG가 지적한 결함이 정확히 여기 있다: "believing that credit exposures were protected by collateral, some firms did not formally review or limit their exposure to market movements based on an analysis of aggregate firm and customer positions." 담보를 채워도 합산이 무너지면 그 손실은 다른 경로로 돌아온다.',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences: '담보 계정이 채워졌습니다. 우리가 아는 세계는 어제와 같습니다.',
          preview: [{ metric: 'netExposureB', direction: 'down', magnitude: 2 }],
          feasibility: { basis: '내부 조치로 당일 실행', sourceRefs: [S.pwg] },
        },
        {
          id: 't2-e',
          label: '브로커 네트워크에서 LTCM 포지션 정보를 사들여 선제 헤지',
          description:
            '중개인들에게 대가를 주고 LTCM의 반대편 거래 정보를 모아 우리 자기매매 북에서 먼저 헤지한다. 실행 가능: 기술적으로는 가능하다.',
          effects: [
            regulator({ add: 2 }, '고객 거래정보의 자기매매 이용'),
            ltcmFx.peerSignal({ delta: -15, label: '고객 정보 매입' }),
            flag('bought_client_info'),
          ],
          expert: {
            rating: 5,
            rationale:
              '고객의 거래 정보를 자기매매에 쓰는 것은 행위 규범 위반이고, 브로커에게 대가를 주고 사들이는 순간 그 사실이 시장에 알려진다. PWG와 BCBS 45가 권고한 정보는 **거래상대가 스스로 제공하는 자료**와 **딜러 간 총량 공유**이지 뒷거래가 아니다. 게다가 여기서 사는 것은 남의 포지션이지 합산이 아니다 — 가장 필요한 정보는 여전히 얻지 못한다.',
            sourceRefs: [S.bcbs45, S.bcbs46],
          },
          consequences:
            '두 건의 정보를 샀습니다. 사흘 만에 다른 딜러들이 알게 되었고, 준법감시가 조사에 들어갔습니다.',
          trap: true,
          trapExplanation:
            '정보 결핍이 진짜 문제이기 때문에 "정보를 산다"는 해법이 논리적으로 보인다. 그러나 사올 수 있는 것은 조각난 남의 포지션뿐이고, 필요한 것은 **합산**이다. 대가는 감독 단계 상승과 협조도 붕괴이며, 9월 22일 회의실에서 그 대가를 치르게 된다.',
          illegal: true,
          preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 3 }],
          feasibility: {
            basis: '기술적으로 가능하나 행위 규범 위반; 감독 단계 상승',
            sourceRefs: [S.bcbs45],
          },
          remediationCard: 'regulator-escalation-ladder',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '"청산 손실(자사 추정)"과 "파악된 거래상대 수"를 같이 보세요. 앞의 숫자는 뒤의 숫자로 계산됩니다.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: '정보를 얻는 경로는 셋입니다 — 고객에게 요구, 동료와 교환, 감독당국에 전달. 각각 얻는 것과 대가가 다르고, 셋 다 합법입니다.',
    },
    {
      level: 3,
      decisionId: 't2-d1',
      text: 'B(딜러 간 총량 교환)만이 합산에 가까워집니다. C(연준)는 나흘 뒤 회의실 자리를 만듭니다. E는 사지 말아야 할 정보입니다.',
    },
  ],
  relatedCards: ['crisis-communication', 'economic-vs-regulatory-capital'],
}

export const turnsA: T[] = [t0, t1, t2]
