import type { Interrupt, PrimeBrokerState, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, flag, regulator } from '../../engine/fx/common'
import { ltcmFx } from './fx'
import { S } from './turnsA'

type T = Turn<PrimeBrokerState>

// =================================================================================================
// T3 — 1998-09-21 (월) "유동성이 말랐다" · 5틱
// =================================================================================================

/**
 * 09:30 개장 직후, 자사 자기매매 데스크의 포지션 보고. 합성 기관의 내부 통화이므로 실존 인물의
 * 발언이 아니며, 내용은 1998년 가을 딜러들이 자기 수렴 북에서 같은 방향으로 물려 있었다는 공개
 * 기록(CGFS Papers 12의 디레버리징 연쇄, PWG의 딜러 트레이딩 북 비교)을 1인칭으로 재구성한 것이다.
 */
const t3DeskCall: Interrupt<PrimeBrokerState> = {
  id: 't3-i1-desk',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't3-i1-hold',
  scoreWeight: 0.5,
  required: false,
  title: '자기매매 데스크 — 자사 수렴 북 보고',
  prompt: '우리 자기매매 북도 같은 방향입니다. 어떻게 하시겠습니까?',
  context:
    '고객의 포지션과 우리 포지션이 같은 방향일 때, 고객의 청산은 우리 손익계산서에 두 번 나타납니다.',
  source: { kind: 'desk', caller: '자기매매 데스크 헤드', tone: 'urgent' },
  lines: [
    {
      speaker: '자기매매 데스크 헤드',
      text: '우리 수렴 북 $18B도 LTCM과 같은 방향입니다. 오늘까지 평가손실 $0.19B입니다. 그쪽이 강제로 풀면 우리 마크가 먼저 깨집니다.',
    },
  ],
  dimensions: ['marketRisk', 'solvency'],
  cardRefs: ['economic-vs-regulatory-capital'],
  options: [
    {
      id: 't3-i1-reduce',
      label: '자사 수렴 북을 절반으로 축소',
      description:
        '지금 시장에서 절반을 정리한다. 손실이 확정되고 체결 비용도 든다. 실행 가능: 자기매매 북은 내부 결정으로 즉시 줄일 수 있다.',
      effects: [
        ltcmFx.resizeOwnBook({ scale: 0.5, slippageB: 0.006, label: '자사 수렴 북 50% 축소' }),
        flag('own_book_reduced'),
      ],
      expert: {
        rating: 70,
        rationale:
          '무질서한 동시 청산이 오면 이 북이 두 번째 손실원이 된다. 줄이는 것은 보험이며 보험료는 확정 손실과 체결 비용이다. 컨소시엄이 성립해 스프레드가 되돌아오는 세계에서는 그 보험이 쓰이지 않고 비용만 남는다 — 그래도 9/21 시점의 정보로는 옳은 선택이다.',
        sourceRefs: [S.cgfs, S.mcd],
      },
      preview: [
        { metric: 'ownConvergencePnlB', direction: 'down', magnitude: 1, note: '손실 확정' },
        { metric: 'realizedLoss', direction: 'up', magnitude: 1 },
      ],
      consequences: '절반을 정리했습니다. 남은 북의 민감도가 절반이 되었습니다.',
    },
    {
      id: 't3-i1-hold',
      label: '유지 — 지금 팔면 바닥에 판다',
      description: '포지션을 그대로 둔다. 실행 가능: 아무것도 하지 않는 선택.',
      effects: [],
      expert: {
        rating: 45,
        rationale:
          '9/21 시점에 대부분의 딜러가 한 선택이다. 스프레드는 실제로 되돌아왔지만 그것은 컨소시엄이 성립한 세계의 결과이며, 이 결정을 내리는 시점에는 알 수 없다.',
        sourceRefs: [S.cgfs],
      },
      preview: [{ metric: 'ownConvergencePnlB', direction: 'flat', magnitude: 1 }],
      consequences: '포지션을 유지했습니다.',
      historical: true,
    },
    {
      id: 't3-i1-add',
      label: '확대 — 되돌림에 베팅해 50% 증량',
      description:
        '스프레드가 역사적 최대치에 있으니 지금이 기회라고 본다. 실행 가능: 한도 내 증량.',
      effects: [ltcmFx.resizeOwnBook({ scale: 1.5, label: '자사 수렴 북 50% 증량' })],
      expert: {
        rating: 5,
        rationale:
          '수렴 거래가 실패하는 방식이 바로 이것이다. CGFS는 1998년 가을의 연쇄를 "시가평가·손절·마진콜 → 디레버리징 → 타 시장 전이 → 유동성 고갈"로 정리한다. 스프레드가 역사적 최대라는 사실은 되돌림의 근거가 아니라 **아직 청산이 끝나지 않았다**는 신호다. LTCM이 그 논리로 만들어졌고 그 논리로 무너졌다.',
        sourceRefs: [S.cgfs, S.pwg],
      },
      preview: [{ metric: 'ownConvergencePnlB', direction: 'down', magnitude: 3 }],
      consequences: '북을 $27B로 늘렸습니다. 스프레드는 그날 더 벌어졌습니다.',
      trap: true,
      trapExplanation:
        '평균회귀는 포지션을 버틸 수 있을 때만 전략이다. 같은 거래를 하는 가장 큰 참가자가 강제 청산 직전일 때 증량하는 것은 그의 청산 물량을 우리가 받겠다는 뜻이다.',
      irreversible: true,
      remediationCard: 'economic-vs-regulatory-capital',
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '1998년 9월 21일 (월) 08:00~16:00 ET',
  title: '유동성이 말랐다 — 담보 재산정',
  time: '1998-09-21T08:00:00-04:00',
  ticks: 5,
  tickLabels: [
    '08:00 마크 산출',
    '09:30 개장',
    '11:00 증거금 통지',
    '14:00 고객 회신',
    '16:00 마감',
  ],
  entryEffects: [
    {
      id: 't3-exogenous',
      description: '수렴지수 146에서 출발, 변동성 배수 1.57, LTCM 자본 $0.9B·유동성 $0.45B(추정)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 146,
          volMultiplier: 1.57,
          ltcmCapitalB: 0.9,
          ltcmLiquidityB: 0.45,
          label: '9/21 외생 상태',
        }),
        confidence(-5, '주말 사이 증자 무산이 확인됨'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't3-convergence',
      description: '수렴 스프레드 종합지수의 일중 경로 (146 → 152)',
      effects: [
        ltcmFx.convergenceStep({
          values: [146, 147.5, 149.5, 151, 152],
          label: '9/21 수렴지수',
        }),
      ],
    },
  ],
  ticker: {
    series: [
      // 9/18 종가 4.70% → 9/21 종가 4.69% [frb-h15-treasury-1998]. 일중 경로는 [STYLIZED].
      { path: 'market.govt10yBp', mode: 'absolute', values: [470, 470, 469, 468, 469] },
      // Baa − 10년: 237bp → 238bp [fred-moodys-baa-aaa-1998]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [237, 237, 238, 239, 238] },
      // VIX: 38.63 → 38.58 [cboe-vix-1998]
      { path: 'market.volIndex', mode: 'absolute', values: [38.63, 39.2, 39.6, 38.9, 38.58] },
    ],
  },
  interrupts: [t3DeskCall],
  events: [
    {
      id: 't3-memo-marks',
      kind: 'memo',
      atTick: 0,
      time: '08:00',
      from: '평가팀',
      to: '리스크 헤드',
      subject: '오늘의 마크: 중간값과 청산가치가 25% 벌어졌습니다',
      body: `수렴 포지션의 호가 스프레드가 넓어져 **어떤 마크를 쓰느냐**가 오늘 청구액을 좌우합니다.

- 딜러 호가 중간값 기준 대체원가: **$0.52B**
- "지금 실제로 풀 수 있는 가격"(청산가치) 기준: **$0.65B** (+25%)

계약상 계산대리인은 우리입니다. 어느 쪽도 방어할 수 있지만, 청산가치 마크는 분쟁을 부르고 다른 딜러가 곧 알게 됩니다.`,
      severity: 'warning',
      sourceRefs: [S.pwg],
      cardRefs: ['hqla-and-haircuts'],
      relatedMetrics: ['replacementCostB', 'netExposureB'],
    },
    {
      id: 't3-news-liquidity',
      kind: 'newswire',
      outlet: 'Dow Jones',
      atTick: 1,
      time: '09:40',
      headline: '주요 헤지펀드, 청산 대리인으로부터 결제 익스포저 담보 요구받아',
      body: '프라임브로커가 결제 관련 잠재 익스포저에 대한 담보를 요구했다는 이야기가 플로어에 돌고 있다. 해당 펀드의 현금이 눈에 띄게 줄었다는 관측이 뒤따랐다.',
      severity: 'critical',
      sourceRefs: [S.pwg],
      reliability: 'unconfirmed',
    },
    {
      id: 't3-data-liquidity',
      kind: 'data',
      atTick: 2,
      time: '11:00',
      title: '고객 유동성 추정 (자사 리스크 관리부)',
      rows: [
        { label: 'LTCM 자본(추정)', value: '$0.9B' },
        { label: '담보 납입 가능 현금(추정)', value: '$0.45B' },
        { label: '우리 대체원가 — 중간값 마크', value: '$0.52B' },
        { label: '우리 대체원가 — 청산가치 마크', value: '$0.65B' },
        { label: '다른 거래상대의 오늘 청구액', value: '알 수 없음' },
      ],
      severity: 'critical',
      sourceRefs: [S.pwg, S.greenspan],
      relatedMetrics: ['ltcmCapitalB', 'ltcmLiquidityB', 'replacementCostB'],
    },
    {
      id: 't3-memo-close',
      kind: 'memo',
      atTick: 4,
      time: '16:10',
      from: '리스크 관리부',
      to: '리스크 헤드',
      subject: '마감 집계',
      body: '오늘 청구한 담보와 고객의 납입 내역, 잔여 순익스포저가 대시보드에 반영되었습니다. 마크를 어떻게 잡았든, 내일 아침 다시 같은 결정을 해야 합니다.',
      severity: 'info',
      sourceRefs: [S.pwg],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '고객과의 증거금 협의',
      prompt: 'LTCM 재무 담당과의 통화입니다. 오늘의 재산정을 어떻게 마무리하시겠습니까?',
      context:
        '오늘 받아 두는 담보가 디폴트 시 회수할 수 있는 전부입니다. 동시에 오늘 받아 가는 현금만큼 고객의 남은 시간이 줄어듭니다. 여기서 합의한 조건은 이후 지연효과로 판정됩니다.',
      select: { min: 1, max: 1 },
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't3-strict',
      timeLimitSec: 180,
      requiredConcepts: ['hqla-and-haircuts'],
      dimensions: ['marketRisk', 'compliance', 'communication'],
      cardRefs: ['hqla-and-haircuts', 'crisis-communication'],
      // 3단계: 마크 근거 → 당일 청구액(commitReplies) → 납입 조건.
      // 대사는 PWG가 기록한 9월 하순의 담보 협상 관행을 바탕으로 한 **재구성**이며 녹취가 아니다.
      steps: [
        {
          id: 't3-neg-open',
          lines: [
            {
              speaker: 'LTCM 재무 담당',
              text: '오늘 통지하신 재산정 금액의 산정 근거를 알려주십시오. 다른 거래상대들과 금액이 다릅니다.',
            },
          ],
          note: '여기서 정한 태도가 이후 두 단계의 선택지를 결정합니다.',
          replies: [
            {
              id: 't3-r-explain',
              label: '마크 산정 방식을 공유하고 근거를 설명한다',
              next: 't3-neg-amount',
              expert: {
                rating: 80,
                rationale:
                  '계산대리인의 재량은 설명할 수 있을 때만 유지된다. 근거를 공유하면 분쟁이 줄고, 고객이 다른 거래상대의 요구와 비교할 수 있게 되어 우리가 시장 전체의 그림에 조금 더 가까워진다.',
              },
            },
            {
              id: 't3-r-firm',
              label: '설명 없이 통지한 대로 이행할 것을 요구한다',
              next: 't3-neg-amount',
              expert: {
                rating: 45,
                rationale:
                  '계약상 가능하지만 아무것도 얻지 못한다. 고객은 설명 없는 요구를 다른 거래상대에게 옮겨 말하고, 그 말이 9월 22일 회의실에 먼저 도착한다.',
              },
            },
            {
              id: 't3-r-seize',
              label: '협의 없이 보유 담보를 즉시 처분하겠다고 통보한다',
              resolvesTo: 't3-seize',
              trap: true,
              trapExplanation:
                '담보 처분권은 디폴트 사유가 발생한 뒤에 생긴다. 그 전에 처분하면 우리가 계약을 깨는 쪽이 되고, 감독당국과 다른 딜러가 같은 날 안다.',
              expert: {
                rating: 0,
                rationale:
                  '디폴트 사유 없이 담보를 처분하는 것은 계약 위반이며 즉시 조치 사유다. PWG는 담보 약정에 유예기간(grace period)이 있음을 전제로 실무를 설명한다.',
              },
            },
          ],
        },
        {
          id: 't3-neg-amount',
          lines: [
            {
              speaker: 'LTCM 재무 담당',
              text: '오늘 중 얼마를 납입해야 합니까. 금액이 정해지면 순서를 짜야 합니다.',
            },
          ],
          note: '여기서 부른 금액은 오늘의 담보이자 고객의 남은 현금입니다. 이후 이행 여부로 평가됩니다.',
          replies: commitReplies<PrimeBrokerState>('marginCallM', [150, 400, 700], {
            idPrefix: 'marginCallM',
            label: (v) => `당일 $${v}M 납입 요구`,
            next: 't3-neg-terms',
            expert: (v) => ({
              rating: v === 400 ? 66 : v === 150 ? 58 : 25,
              rationale:
                v === 400
                  ? '중간값 마크가 만드는 청구액을 조금 웃도는 수준이다. 고객이 낼 수 있는 범위 안에 있고(PWG: LTCM은 모든 콜을 제때 이행했다), 디폴트 시 회수액을 실질적으로 늘린다.'
                  : v === 150
                    ? '관계를 지키지만 담보가 대체원가를 따라가지 못한다. 회의가 결렬되는 세계에서 그 차이가 그대로 손실이 된다.'
                    : '고객의 납입 가능 현금 추정치를 넘는 금액이다. 받아내면 우리 익스포저는 사라지지만 고객은 다음 날 결제를 하지 못한다 — 그 디폴트가 우리 다른 포지션을 친다.',
            }),
            trap: (v) => v >= 700,
            trapExplanation: (v) =>
              v >= 700
                ? '가장 많이 받아내는 것이 가장 안전해 보인다. 그러나 담보는 고객이 살아 있을 때만 담보다. 납입 가능액을 넘겨 부르면 미납이 발생하고, 미납은 곧 디폴트이며, 디폴트는 우리가 방금 확보한 담보보다 훨씬 큰 손실을 부른다.'
                : undefined,
          }),
        },
        {
          id: 't3-neg-terms',
          lines: [
            {
              speaker: 'LTCM 재무 담당',
              text: '납입하겠습니다. 대신 무엇을 보장해 주실 수 있습니까.',
            },
          ],
          note: '여기서 정한 조건이 9월 22~23일에 우리가 쥐고 있는 패가 됩니다.',
          replies: [
            {
              id: 't3-r-terms-info',
              label: '일주일 재산정 유예를 주되 포지션·거래상대 명세를 제출받는다',
              resolvesTo: 't3-negotiated',
              expert: {
                rating: 85,
                rationale:
                  '담보와 정보를 맞바꾼다. 우리가 가장 필요로 하는 것은 오늘의 현금이 아니라 합산 익스포저이며, 이것이 그것을 얻는 유일한 합법적 지렛대다.',
              },
            },
            {
              id: 't3-r-terms-daily',
              label: '보장 없이 청산가치 마크로 일일 재산정을 계속한다',
              resolvesTo: 't3-strict',
              expert: {
                rating: 55,
                rationale:
                  '9월 하순 다수 거래상대의 실제 행동이다(PWG: "in many cases by seeking to apply possible liquidation values to mark-to-market valuations"). 우리 익스포저에는 옳지만, 모두가 같은 일을 하면 고객의 시계가 빨라진다.',
              },
            },
            {
              id: 't3-r-terms-forbear',
              label: '자료 없이 재산정 자체를 일주일 유예한다',
              resolvesTo: 't3-forbearance',
              trap: true,
              trapExplanation:
                '관계를 지키는 가장 부드러운 방법이고 얻는 것이 하나도 없다. 유예 기간에 스프레드가 더 벌어지면 우리는 담보 없이 그 차이를 전부 안는다.',
              expert: {
                rating: 15,
                rationale:
                  '무상 유예는 신용 공여다. BCBS 46은 담보 조건의 완화를 상대방의 신용도에 근거해서만 하라고 권고한다 — 여기서는 그 반대다.',
              },
            },
          ],
        },
      ],
      options: [
        {
          id: 't3-negotiated',
          label: '중간값 마크로 청구하고 자료 제출을 조건으로 유예',
          description:
            '오늘 합의한 금액을 중간값 마크 기준으로 받고, 일주일 유예의 대가로 포지션·거래상대 명세를 받는다. 실행 가능: 담보 계약의 유예 조항과 협상 합의.',
          effects: [
            ltcmFx.remargin({
              markPct: 1,
              useFloorCounter: true,
              peerDelta: 6,
              label: '협상 재산정(중간값 마크)',
            }),
            ltcmFx.shareExposure({
              peerDelta: 0,
              revealTrue: true,
              label: '고객 명세 제출 — 합산 익스포저 확인',
            }),
            flag('daily_remargin'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'marginCallM', gte: 400 },
              description:
                '합의한 청구액이 고객의 납입 가능 현금에 가까워 9/22 아침 결제에 여유가 없다는 통보 — 타 딜러 협조도 −3',
              effects: [ltcmFx.peerSignal({ delta: -3, label: '고객 결제 여력 경고' })],
            },
            {
              afterTurns: 1,
              when: { counter: 'marginCallM', lt: 400 },
              description: '합의한 조건대로 자료가 제출되어 9/22 회의에서 우리 집계가 기준이 됨',
              effects: [ltcmFx.peerSignal({ delta: 4, label: '자료 제출 이행' })],
            },
          ],
          expert: {
            rating: 85,
            rationale:
              'PWG가 사후에 권고한 방향과 일치한다 — 담보에만 의존하지 말고 상대방에 대한 정보를 확보하라(BCBS 46: "an over reliance on collateralisation of mark-to-market exposures"). 합산 익스포저를 알게 되면 우리 청산 손실 추정치가 비로소 맞아지고, 9/22 회의실에서 쓸 수 있는 자료가 생긴다.',
            sourceRefs: [S.bcbs46, S.pwg, S.greenspan],
          },
          consequences:
            '합의한 금액이 입금되었고, 저녁에 포지션·거래상대 명세가 도착했습니다. 우리가 알던 8곳이 아니라 75곳이 넘습니다. 청산 손실 추정치가 그만큼 올라갔습니다.',
          preview: [
            { metric: 'closeoutLossB', direction: 'up', magnitude: 2, note: '추정치가 맞아진다' },
            { metric: 'peerCooperation', direction: 'up', magnitude: 2 },
          ],
          feasibility: { basis: '담보 계약의 유예 조항 + 협상 합의', sourceRefs: [S.pwg] },
          calibrationNote: 'markPct 1.0 · 합산 공개 — calibration.md §4.3',
        },
        {
          id: 't3-strict',
          label: '청산가치 마크로 일일 재산정 지속 — 보장 없음',
          description:
            '대체원가의 125%를 요구하고 유예도 자료 교환도 하지 않는다. 실행 가능: 계산대리인 재량 + 일일 마진 조항.',
          effects: [
            ltcmFx.remargin({
              markPct: 1.25,
              useFloorCounter: true,
              peerDelta: -4,
              label: '청산가치 마크 재산정',
            }),
            flag('daily_remargin'),
            flag('liquidation_marks'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'marginCallM', gte: 700 },
              description:
                '납입 가능액을 넘는 청구가 미납으로 이어져 9/22 아침 디폴트 사유가 발생 — 게임오버 규칙이 받는다',
              effects: [flag('early_default_confirmed')],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '9월 하순 다수 거래상대의 실제 행동이며 자기 익스포저에는 최선이다. PWG는 이 관행을 그대로 기록한다. 대가는 두 가지다: 고객의 현금이 마르는 속도가 빨라지고, 마크 분쟁이 다른 딜러에게 알려져 다음 날 회의에서 우리 신뢰가 깎인다.',
            historicalNote:
              '"LTCM\'s repo and OTC derivatives counterparties were seeking as much collateral as possible through the daily margining process, in many cases by seeking to apply possible liquidation values to mark-to-market valuations."',
            sourceRefs: [S.pwg],
          },
          consequences:
            '청산가치 마크로 청구했고 고객이 이의를 제기하면서도 납입했습니다. 오후에 다른 딜러 두 곳이 우리 마크를 물어 왔습니다.',
          historical: true,
          preview: [
            { metric: 'netExposureB', direction: 'down', magnitude: 3 },
            { metric: 'peerCooperation', direction: 'down', magnitude: 1 },
          ],
          feasibility: { basis: '계산대리인 재량 + 일일 마진 조항', sourceRefs: [S.pwg] },
        },
        {
          id: 't3-forbearance',
          label: '재산정을 일주일 유예 — 관계를 지킨다',
          description:
            '최소한의 금액만 받고 일주일간 추가 청구를 하지 않는다. 자료도 요구하지 않는다. 실행 가능: 담보 계약의 유예 조항.',
          effects: [
            ltcmFx.remargin({ markPct: 0.5, peerDelta: 2, label: '유예 — 최소 청구' }),
            flag('loose_margin'),
            confidence(3, '고객 관계 안정'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description:
                '유예 기간에 스프레드가 더 벌어져 담보 없는 익스포저가 그대로 남는다 — 순익스포저 확대',
              effects: [ltcmFx.peerSignal({ delta: -2, label: '무담보 익스포저 노출' })],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '무상 유예는 담보 없는 신용 공여다. 9/21에 고객이 아직 낼 수 있었다는 사실이 중요하다 — PWG는 LTCM이 끝까지 모든 콜을 제때 이행했다고 기록한다. 낼 수 있을 때 받지 않으면 낼 수 없게 된 뒤에는 받을 수 없다.',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences:
            '최소 금액만 받고 유예했습니다. 영업 총괄이 만족했습니다. 담보 계정은 대체원가의 절반입니다.',
          trap: true,
          trapExplanation:
            '관계를 지키는 선택은 언제나 오늘 비용이 없고 내일 비용이 크다. 유예한 일주일은 정확히 회의가 열리고 결론이 나는 일주일이다.',
          preview: [{ metric: 'netExposureB', direction: 'up', magnitude: 3 }],
          feasibility: { basis: '담보 계약의 유예 조항', sourceRefs: [S.pwg] },
          remediationCard: 'hqla-and-haircuts',
        },
        {
          id: 't3-seize',
          label: '디폴트 사유 없이 보유 담보를 즉시 처분',
          description:
            '협의를 끝내고 보유 담보를 시장에서 처분해 익스포저를 없앤다. 계약상 처분권은 디폴트 사유 발생 이후에만 생긴다.',
          effects: [
            ltcmFx.seizeCollateral({ label: '담보 일방 처분' }),
            regulator({ set: 4 }, '디폴트 사유 없는 담보 처분 — 계약 위반'),
            flag('unsafe_act'),
          ],
          expert: {
            rating: 0,
            rationale:
              '담보 약정은 유예기간과 디폴트 사유를 전제로 설계된다(PWG의 담보 실무 서술). 그 전에 처분하면 우리가 위반 당사자가 되고, 감독당국의 즉시 조치와 소송이 따른다. 게다가 이 행위는 몇 시간 만에 다른 딜러에게 알려져 다음 날 회의실에서 우리를 고립시킨다.',
            sourceRefs: [S.pwg, S.bcbs46],
          },
          consequences:
            '담보를 처분했습니다. 오후에 감독당국 두 곳과 고객 법무법인의 연락을 받았습니다.',
          trap: true,
          trapExplanation:
            '익스포저를 오늘 없애는 가장 빠른 방법이며, 그래서 위기 중에 실제로 논의된다. 계약이 허용하지 않는 속도는 언제나 다른 곳에서 대가를 치른다.',
          illegal: true,
          irreversible: true,
          feasibility: {
            basis: '계약상 불가 — 디폴트 사유 발생 전 처분은 위반',
            sourceRefs: [S.pwg],
          },
          remediationCard: 'regulator-escalation-ladder',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '대체원가 $0.52B, 담보 계정, 그리고 고객의 납입 가능 현금 추정 $0.45B를 나란히 보세요. 세 숫자가 오늘의 경계를 그립니다.',
    },
    {
      level: 2,
      decisionId: 't3-d1',
      text: '담보는 고객이 살아 있을 때만 담보입니다. 그리고 오늘 우리가 협상에서 얻을 수 있는 것은 현금만이 아닙니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: '중간값 마크로 부르고 유예의 대가로 명세를 받으십시오. 그 명세가 내일 회의실에서 우리가 가진 유일한 자료입니다.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'crisis-communication'],
}

// =================================================================================================
// T4 — 1998-09-22 (화) "회의실" · 4틱
// =================================================================================================

/**
 * 07:00 뉴욕연준의 소집 통보. McDonough 증언이 확인하는 것은 **소집의 사실과 시각, 참석 3사**이며,
 * 문구는 재구성이다(녹취·속기록이 아니다).
 */
const t4FedSummons: Interrupt<PrimeBrokerState> = {
  id: 't4-i1-frbny',
  interrupt: true,
  atTick: 0,
  jitter: 0,
  timeoutSec: 40,
  defaultOptionId: 't4-i1-attend',
  scoreWeight: 0.5,
  required: false,
  title: '뉴욕연준 — 조찬 회합 소집',
  prompt: '오늘 아침 회합에 어떻게 응하시겠습니까?',
  context:
    '뉴욕연준은 헤지펀드에 대한 규제 권한이 없습니다. 자금도 대지 않습니다. 회의실과 시간만 제공합니다.',
  source: {
    kind: 'regulator',
    caller: '마켓그룹 총괄',
    agency: 'Federal Reserve Bank of New York',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '뉴욕연준 마켓그룹 총괄',
      text: '이 상황을 가장 잘 아는 세 곳을 오늘 아침 회의에 부르고 있습니다. 무질서한 청산의 위험을 줄이는 방법을 논의하려 합니다. 오실 수 있습니까.',
    },
    {
      speaker: '뉴욕연준 마켓그룹 총괄',
      text: '미리 말씀드립니다. 공적 자금 이야기는 없습니다. 보증도 없습니다.',
    },
  ],
  dimensions: ['policy', 'communication', 'timeliness'],
  cardRefs: ['crisis-communication', 'fdic-resolution-weekend'],
  options: [
    {
      id: 't4-i1-attend',
      label: '참석하고 우리 익스포저 자료를 지참',
      description:
        '회의에 나가고 우리 집계를 그대로 공유한다. 다른 참석사도 같은 것을 가져온다. 실행 가능: 실제로 소집된 회의.',
      effects: [
        ltcmFx.shareExposure({
          peerDelta: 10,
          revealTrue: true,
          label: '연준 회의 — 익스포저 자료 공유',
        }),
        flag('fed_engaged'),
        flag('core_group'),
      ],
      expert: {
        rating: 85,
        rationale:
          'McDonough의 기록 그대로다: 피셔가 "the greatest knowledge of the situation"을 가진 세 곳을 9/22 조찬에 불렀고, 그 자리에서 각자 자기 익스포저만 알고 있다는 사실이 드러났다. 자료를 들고 가는 것이 합산을 만드는 유일한 방법이며, 9/20 실사에서 연준이 확인한 "the size of these positions was much greater than market participants imagined"가 이 자리에서 공유된다.',
        historicalNote:
          '실제 참석 3사는 골드만삭스·메릴린치·J.P.모건이었고, 곧 UBS가 더해져 코어그룹 4사가 되었다.',
        sourceRefs: [S.mcd, S.gao],
      },
      preview: [
        { metric: 'peerCooperation', direction: 'up', magnitude: 3 },
        {
          metric: 'closeoutLossB',
          direction: 'up',
          magnitude: 2,
          note: '합산을 보면 추정이 커진다',
        },
      ],
      consequences:
        '회의실에서 넉 장의 익스포저 표를 붙여 놓고 보니, 우리가 알던 8곳은 75곳이 넘었습니다. 각자의 숫자는 맞았고 합계는 아무도 본 적이 없는 크기였습니다.',
      historical: true,
    },
    {
      id: 't4-i1-quiet',
      label: '참석하되 우리 숫자는 공유하지 않는다',
      description: '회의에는 나가지만 자료는 내지 않는다. 실행 가능: 참석 자체에 조건이 없다.',
      effects: [ltcmFx.peerSignal({ delta: 3, label: '참석(자료 미제출)' }), flag('fed_engaged')],
      expert: {
        rating: 40,
        rationale:
          '자리를 지키되 아무것도 바꾸지 않는다. 합산을 보려는 회의에서 자기 숫자를 감추면 합산은 만들어지지 않고, 다른 참석사도 같은 선택을 하게 된다.',
        sourceRefs: [S.mcd, S.greenspan],
      },
      preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 1 }],
      consequences: '회의에 참석했습니다. 우리 표는 가방 안에 있었습니다.',
    },
    {
      id: 't4-i1-decline',
      label: '불참 — 양자 계약으로 각자 정리하면 된다',
      description: '회의에 나가지 않고 우리 계약만 관리한다. 실행 가능: 참석 의무가 없다.',
      effects: [ltcmFx.peerSignal({ delta: -15, label: '연준 소집 불참' }), flag('fed_declined')],
      expert: {
        rating: 10,
        rationale:
          '각자 양자 계약만 관리하는 것이 정확히 실패한 구조다. McDonough는 동시 청산이 일어나면 "they would have been unable to liquidate collateral or establish offsetting positions at the previously-existing prices"라고 적었다. 양자 계약의 합이 시장이며, 그 시장이 멈추면 양자 계약도 소용없다.',
        sourceRefs: [S.mcd, S.pwg],
      },
      preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 3 }],
      consequences:
        '불참했습니다. 오후에 다른 참석사로부터 "그쪽은 따로 가기로 했다고 들었다"는 연락을 받았습니다.',
      trap: true,
      trapExplanation:
        '내 계약만 보면 되는 것처럼 보인다. 그러나 이 시나리오에서 우리가 잃는 돈의 대부분은 우리 계약이 아니라 **다른 사람들이 동시에 파는 가격**에서 나온다.',
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '1998년 9월 22일 (화) 07:00~21:00 ET',
  title: '코어그룹과 13개사 회합',
  time: '1998-09-22T07:00:00-04:00',
  ticks: 4,
  tickLabels: ['07:00 코어그룹 회합', '11:00 작업반 실사', '19:00 텀시트', '20:30 13개사 회합'],
  entryEffects: [
    {
      id: 't4-exogenous',
      description: '수렴지수 152에서 출발, 변동성 배수 1.53, LTCM 자본 $0.6B·유동성 $0.28B(추정)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 152,
          volMultiplier: 1.53,
          ltcmCapitalB: 0.6,
          ltcmLiquidityB: 0.28,
          label: '9/22 외생 상태',
        }),
      ],
    },
    {
      id: 't4-standing-remargin',
      when: { all: [{ flag: 'daily_remargin' }, { notFlag: 'ltcm_missed_call' }] },
      description: '일일 재산정이 가동 중이면 오늘치 담보를 부른다',
      effects: [ltcmFx.remargin({ markPct: 1, label: '일일 재산정(9/22)' })],
    },
    {
      id: 't4-early-default',
      when: { flag: 'ltcm_missed_call' },
      description: '전날 청구액 미납 — 디폴트 사유 발생, 동시 청산 개시',
      effects: [ltcmFx.triggerEarlyDefault({ label: '9/22 아침 디폴트' })],
    },
  ],
  eachTick: [
    {
      id: 't4-convergence',
      description: '수렴 스프레드 종합지수의 일중 경로 (152 → 150)',
      effects: [ltcmFx.convergenceStep({ values: [152, 151, 150, 150], label: '9/22 수렴지수' })],
    },
  ],
  ticker: {
    series: [
      // 9/21 종가 4.69% → 9/22 종가 4.73%. 장 마감(16:00) 이후 틱은 보합.
      { path: 'market.govt10yBp', mode: 'absolute', values: [469, 471, 473, 473] },
      // Baa − 10년: 238bp → 235bp
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [238, 236, 235, 235] },
      // VIX: 38.58 → 36.62
      { path: 'market.volIndex', mode: 'absolute', values: [38.58, 37.6, 36.62, 36.62] },
    ],
  },
  interrupts: [t4FedSummons],
  events: [
    {
      id: 't4-dialogue-core',
      kind: 'dialogue',
      atTick: 0,
      time: '07:30',
      title: '뉴욕연준 회의실 — 코어그룹 조찬',
      lines: [
        {
          speaker: '뉴욕연준 마켓그룹 총괄',
          text: '연준은 자금을 대지 않습니다. 보증도 하지 않습니다. 우리가 하는 것은 여러분이 한자리에 앉게 하는 것뿐입니다.',
        },
        {
          speaker: '참석 딜러 A',
          text: '우리 익스포저는 관리되고 있습니다. 담보는 매일 받고 있습니다.',
        },
        {
          speaker: '뉴욕연준 마켓그룹 총괄',
          text: '그 말씀을 오늘 아침에 네 번 들었습니다. 각자 관리되고 있다면, 합쳐서 얼마입니까.',
        },
        { speaker: '참석 딜러 B', text: '그 숫자는 이 방에 없습니다.' },
      ],
      severity: 'critical',
      sourceRefs: [S.mcd, S.greenspan],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't4-memo-workgroups',
      kind: 'memo',
      atTick: 1,
      time: '11:00',
      from: '작업반 연락 담당',
      to: '리스크 헤드',
      subject: '세 개의 작업반이 코네티컷과 시내로 나뉘어 움직입니다',
      body: `- 작업반 1: 채권 포지션을 우리 대차대조표로 "들어 올릴(lifting)" 수 있는지 실사.
- 작업반 2: 주식 포지션에 대해 같은 실사.
- 작업반 3: 공동 출자(컨소시엄) 구조 설계.

연준 인력은 어느 작업반에도 들어오지 않았습니다. 참석사 한 곳(스위스 은행)이 코어그룹과 각 작업반에 추가되었습니다.`,
      severity: 'warning',
      sourceRefs: [S.mcd],
    },
    {
      id: 't4-data-aggregate',
      kind: 'data',
      atTick: 2,
      time: '19:00',
      when: { flag: 'aggregate_known' },
      title: '합산 집계 — 처음 만들어진 숫자',
      rows: [
        { label: 'LTCM 총자산(8/31)', value: '>$125B' },
        { label: 'LTCM 자본(추정, 오늘)', value: '$0.6B' },
        { label: '명목 파생 총액(8월말)', value: '≈$1.4T (선물 >500 + 스왑 >750 + 옵션 >150)' },
        { label: '거래상대 수', value: '75곳 이상' },
        { label: '상위 17개사 동시 청산 시 손실(고객 자체 추정)', value: '$3B~$5B' },
        { label: '일부 개별사 손실 추정', value: '$300M~$500M' },
      ],
      severity: 'critical',
      sourceRefs: [S.pwg, S.mcd],
      cardRefs: ['economic-vs-regulatory-capital'],
      relatedMetrics: ['ltcmNotionalB', 'closeoutLossB', 'knownCounterpartyCount'],
    },
    {
      id: 't4-memo-termsheet',
      kind: 'memo',
      atTick: 2,
      time: '19:30',
      from: '작업반 3',
      to: '리스크 헤드',
      subject: '텀시트 초안 — 공동 출자 구조',
      body: `두 작업반이 "들어 올리기"는 불가능하다고 결론 내렸습니다. 남은 것은 공동 출자입니다.

- 새 피더 펀드에 참가사들이 공동 출자하고, 새로 만든 유한책임회사가 새 무한책임사원이 됩니다.
- 원소유자 지분은 10%로 희석되고 참가사들이 90%와 **운영 통제권**을 가집니다.
- 참가사 수와 각 사 분담액은 내일 정합니다.

연준 관계자는 이 논의의 조건을 정하는 데 참여하지 않았습니다.`,
      severity: 'critical',
      sourceRefs: [S.pwg, S.mcd],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't4-news-wider',
      kind: 'newswire',
      outlet: 'Bloomberg',
      atTick: 3,
      time: '20:40',
      headline: '월가 주요 금융기관 13곳, 뉴욕연방준비은행에서 야간 회합',
      body: '13개 기관의 대표가 뉴욕연준 회의실에 모였다는 사실이 확인됐다. 참석자들은 내일 오전 10시에 다시 모이기로 했다. 회의 내용은 알려지지 않았다.',
      severity: 'critical',
      sourceRefs: [S.mcd],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '어느 작업반에 들어갈 것인가',
      prompt:
        '오늘 하루 우리 인력을 어디에 쓰시겠습니까? (최대 2개; 컨소시엄 참여와 양자 청산 준비는 함께 선택할 수 없습니다)',
      context:
        '세 개의 작업반이 동시에 돌아갑니다. 두 개는 몇 시간 뒤 "불가능"이라는 답을 낼 것이고, 하나는 내일 아침의 유일한 선택지가 됩니다.',
      select: { min: 1, max: 2 },
      exclusive: [['t4-consortium', 't4-bilateral']],
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't4-consortium',
      timeLimitSec: 150,
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'marketRisk', 'communication'],
      cardRefs: ['fdic-resolution-weekend', 'crisis-communication'],
      options: [
        {
          id: 't4-consortium',
          label: '공동 출자 구조 작업반에 인력을 파견',
          description:
            '텀시트 설계에 참여하고 분담 원칙을 논의한다. 실행 가능: 실제로 구성된 작업반.',
          effects: [
            ltcmFx.peerSignal({ delta: 6, label: '컨소시엄 작업반 참여' }),
            flag('consortium_workgroup'),
          ],
          expert: {
            rating: 80,
            rationale:
              '두 개의 "들어 올리기" 작업반은 실사 끝에 불가능하다고 결론냈고, 남은 것은 이 구조뿐이었다(McDonough). 구조를 설계하는 자리에 있어야 다음 날 분담 원칙을 말할 수 있다.',
            historicalNote: '세 번째 작업반이 컨소시엄 구조를 설계했고 그것이 유일하게 성립했다.',
            sourceRefs: [S.mcd, S.pwg],
          },
          consequences:
            '텀시트 초안에 우리 의견이 반영되었습니다. 분담 원칙은 내일 오전으로 미뤄졌습니다.',
          historical: true,
          preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 2 }],
          feasibility: { basis: '실제로 구성된 작업반', sourceRefs: [S.mcd] },
        },
        {
          id: 't4-lift',
          label: '포지션 "들어 올리기" 실사 작업반에 참여',
          description:
            '채권·주식 포지션을 우리 대차대조표로 옮길 수 있는지 실사한다. 실행 가능: 실제로 파견된 작업반.',
          effects: [
            ltcmFx.peerSignal({ delta: 3, label: '리프팅 실사 참여' }),
            flag('lift_attempted'),
          ],
          expert: {
            rating: 60,
            rationale:
              '결론은 "불가능"이었지만 그 실사 자체가 포지션의 실제 크기와 유동성을 확인시켜 주었고, 컨소시엄이 유일한 대안이라는 합의를 만들었다. McDonough는 어느 회사든 포지션을 자기 대차대조표로 가져가는 것이 "the most desirable outcome"이었다고 적는다.',
            sourceRefs: [S.mcd],
          },
          consequences:
            '실사 결과 규모와 유동성 모두 한 회사가 감당할 수 없다는 결론이 나왔습니다. 대신 포지션의 실제 구성을 직접 보았습니다.',
          preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 1 }],
          feasibility: { basis: '실제로 파견된 두 작업반', sourceRefs: [S.mcd] },
        },
        {
          id: 't4-bilateral',
          label: '조용히 양자 청산을 준비 — 우리 몫을 먼저 확보한다',
          description:
            '회의와 별개로 우리 계약의 25%를 조기 종료하고 담보를 정산한다. 실행 가능: 계약상 조기 종료 협상은 가능하다.',
          effects: [
            ltcmFx.unwindBilateral({
              fraction: 0.25,
              peerDelta: -18,
              label: '양자 조기 종료 25%',
            }),
          ],
          expert: {
            rating: 10,
            rationale:
              '개별적으로는 합리적이고 집단적으로는 파괴적이다 — 이 시나리오의 죄수의 딜레마가 여기 있다. 먼저 빠지면 우리 익스포저는 줄지만, 그 사실이 알려지는 순간 다른 참가사도 같은 계산을 하고 공동 출자의 전제가 무너진다. McDonough는 동시 청산이 "hundreds of billions of dollars in transactions"을 한꺼번에 움직여 손실을 과장시켰을 것이라고 적었다.',
            sourceRefs: [S.mcd, S.pwg],
          },
          consequences:
            '25%를 종료했습니다. 저녁 회의에서 두 참가사가 "그쪽은 이미 줄이고 있다고 들었다"고 말했습니다.',
          trap: true,
          trapExplanation:
            '먼저 빠지는 쪽이 이기는 것처럼 보이고, 실제로 그 계약에서는 이긴다. 그러나 모두가 그렇게 하면 공동 출자가 성립하지 않고, 성립하지 않으면 우리가 방금 줄인 것보다 훨씬 큰 손실이 시장 전체에서 온다.',
          irreversible: true,
          preview: [
            { metric: 'netExposureB', direction: 'down', magnitude: 2 },
            { metric: 'peerCooperation', direction: 'down', magnitude: 3 },
          ],
          feasibility: { basis: '조기 종료 협상은 계약상 가능', sourceRefs: [S.pwg] },
          remediationCard: 'crisis-communication',
        },
        {
          id: 't4-observe',
          label: '어느 작업반에도 들어가지 않고 지켜본다',
          description: '오늘은 인력을 쓰지 않고 결과를 기다린다. 실행 가능: 참여 의무가 없다.',
          effects: [ltcmFx.peerSignal({ delta: -8, label: '작업반 불참' })],
          expert: {
            rating: 25,
            rationale:
              '아무 대가도 치르지 않지만 내일 아침 아무 패도 없이 회의실에 앉게 된다. 구조를 설계하지 않은 참가사는 분담 원칙을 말할 자격을 인정받지 못한다.',
            sourceRefs: [S.mcd],
          },
          consequences: '작업반 결과를 저녁에 요약으로 받았습니다.',
          preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 2 }],
          feasibility: { basis: '참여 의무 없음', sourceRefs: [S.mcd] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '"타 딜러 협조도"를 보세요. 내일 이 숫자가 각 참가사의 참여 여부를 결정합니다.',
    },
    {
      level: 2,
      decisionId: 't4-d1',
      text: '오늘의 선택은 익스포저를 거의 바꾸지 않습니다. 바꾸는 것은 내일 회의실에서 우리가 어떤 사람으로 앉아 있느냐입니다.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: '두 "들어 올리기" 작업반은 불가능하다는 답을 낼 것이고, 그 결론 자체가 필요합니다. 양자 청산 준비는 오늘 이득이고 내일 손해입니다.',
    },
  ],
  relatedCards: ['fdic-resolution-weekend', 'crisis-communication'],
}

// =================================================================================================
// T5 — 1998-09-23 (수) "컨소시엄" · 5틱
// =================================================================================================

/**
 * 13:00 지분 배분 협상 직전, 다른 딜러의 리스크 총괄이 거는 전화. 이 통화의 존재는 기록에 없다 —
 * **재구성**이며, 내용은 "lengthy discussions"와 "three firms contributing smaller amounts than
 * the other eleven"가 남긴 협상 구조에서 역산한 것이다.
 */
const t5PeerCall: Interrupt<PrimeBrokerState> = {
  id: 't5-i1-peer',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 35,
  defaultOptionId: 't5-i1-exchange',
  scoreWeight: 0.5,
  required: false,
  title: '타 딜러 리스크 총괄 — 회의 직전 통화',
  prompt: '분담액을 먼저 밝혀 달라는 요청에 어떻게 답하시겠습니까?',
  context:
    '모두가 먼저 다른 사람의 숫자를 듣고 싶어 합니다. 모두가 기다리면 총액은 채워지지 않습니다.',
  source: { kind: 'call', caller: '타 딜러 리스크 총괄', tone: 'urgent' },
  lines: [
    {
      speaker: '타 딜러 리스크 총괄',
      text: '베어스턴스가 빠진다고 합니다. 청산 대리인으로서 이미 충분한 리스크를 지고 있다는 논리입니다.',
    },
    {
      speaker: '타 딜러 리스크 총괄',
      text: '우리 이사회는 다른 곳이 얼마를 쓰는지 보고 정하겠다고 합니다. 귀사는 얼마입니까.',
    },
  ],
  dimensions: ['policy', 'communication'],
  cardRefs: ['crisis-communication'],
  options: [
    {
      id: 't5-i1-lead',
      label: '우리 분담액을 먼저 밝히고 동참을 요청',
      description: '숫자를 먼저 말하고 같은 수준의 참여를 요청한다. 실행 가능: 회의 전 양자 통화.',
      effects: [ltcmFx.peerSignal({ delta: 8, label: '분담액 선제 제시' }), flag('led_pledge')],
      expert: {
        rating: 80,
        rationale:
          '집단행동 문제는 누군가 먼저 움직여야 풀린다. 실제로 열한 곳이 **같은 금액**으로 수렴한 것이 그 증거다 — 균등 분담은 "다른 곳이 얼마를 쓰는가"라는 질문을 없애는 장치였다.',
        sourceRefs: [S.mcd, S.fedHist],
      },
      preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 2 }],
      consequences: '상대가 "그러면 우리도 같은 수준으로 올리겠다"고 답했습니다.',
    },
    {
      id: 't5-i1-exchange',
      label: '익스포저 자료는 교환하되 금액은 회의에서 말하겠다',
      description: '숫자는 회의 테이블에서 공개한다. 실행 가능: 통화로 답변.',
      effects: [ltcmFx.peerSignal({ delta: 2, label: '자료 교환, 금액은 회의에서' })],
      expert: {
        rating: 55,
        rationale:
          '틀린 답은 아니다. 회의에서 모두 같은 순간에 숫자를 내는 것이 실제로 일어난 일이고, 다섯 시간의 논의가 필요했던 이유이기도 하다.',
        sourceRefs: [S.mcd],
      },
      preview: [{ metric: 'peerCooperation', direction: 'up', magnitude: 1 }],
      consequences: '자료를 교환했습니다. 금액은 오후 테이블에서 정해집니다.',
      historical: true,
    },
    {
      id: 't5-i1-wait',
      label: '"귀사가 먼저 쓰시면 우리도 검토하겠습니다"',
      description: '상대의 숫자를 먼저 듣고 결정하겠다고 답한다. 실행 가능: 통화로 답변.',
      effects: [ltcmFx.peerSignal({ delta: -8, label: '선제 제시 거부' })],
      expert: {
        rating: 15,
        rationale:
          '개별적으로는 합리적인 협상 전술이고 집단적으로는 총액을 비운다. 두 곳이 실제로 빠졌고 그만큼을 남은 열넷이 메워야 했다.',
        sourceRefs: [S.mcd, S.furfine],
      },
      preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 2 }],
      consequences:
        '상대도 같은 답을 했습니다. 두 곳이 서로를 기다리는 동안 오후 회의 시각이 다가왔습니다.',
      trap: true,
      trapExplanation:
        '기다리는 쪽이 유리한 것처럼 보인다. 모두가 그렇게 계산하면 총액이 성립선에 닿지 않고, 그 결과는 기다린 쪽에게도 똑같이 온다 — 무임승차는 배가 뜰 때만 가능하다.',
    },
  ],
}

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '1998년 9월 23일 (수) 09:30~16:00 ET',
  title: '컨소시엄',
  time: '1998-09-23T09:30:00-04:00',
  ticks: 5,
  tickLabels: [
    '09:30 회의 소집',
    '10:50 실사 보고',
    '13:00 지분 배분 협상',
    '15:30 서명 시한',
    '16:00 시장 마감',
  ],
  entryEffects: [
    {
      id: 't5-exogenous',
      description: '수렴지수 150에서 출발, 변동성 배수 1.46, LTCM 자본 $0.4B(출자 직전)',
      effects: [
        ltcmFx.setDay({
          convergenceIdx: 150,
          volMultiplier: 1.46,
          ltcmCapitalB: 0.4,
          ltcmLiquidityB: 0.2,
          label: '9/23 외생 상태',
        }),
      ],
    },
    {
      id: 't5-early-default',
      when: { all: [{ flag: 'ltcm_missed_call' }, { notFlag: 'ltcm_early_default' }] },
      description: '전날 미납이 해소되지 않아 디폴트 사유 확정',
      effects: [ltcmFx.triggerEarlyDefault({ label: '9/23 디폴트' })],
    },
  ],
  eachTick: [
    {
      id: 't5-convergence',
      description: '수렴 스프레드 종합지수의 일중 경로 (150 → 148)',
      effects: [
        ltcmFx.convergenceStep({ values: [150, 150, 149, 148, 148], label: '9/23 수렴지수' }),
      ],
    },
  ],
  ticker: {
    series: [
      // 9/22 종가 4.73% → 9/23 종가 4.69%
      { path: 'market.govt10yBp', mode: 'absolute', values: [473, 472, 470, 469, 469] },
      // Baa − 10년: 235bp → 238bp
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [235, 236, 237, 238, 238] },
      // VIX: 36.62 → 32.47 (합의가 알려지기 전부터 변동성이 내려오고 있었다)
      { path: 'market.volIndex', mode: 'absolute', values: [36.62, 35.5, 34.2, 33, 32.47] },
    ],
  },
  interrupts: [t5PeerCall],
  events: [
    {
      id: 't5-regulator-open',
      kind: 'regulator',
      atTick: 0,
      time: '09:30',
      agency: 'Federal Reserve Bank of New York',
      headline: '오전 10시 회의 — 참가 예정 기관에 통보',
      body: '어젯밤 회합한 기관들이 오전 10시에 다시 모입니다. 뉴욕연준은 회의실과 시간을 제공하며, 조건과 금액에 관한 논의에는 참여하지 않습니다. 공적 자금은 논의 대상이 아닙니다.',
      tone: 'urgent',
      sourceRefs: [S.mcd, S.greenspan],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't5-news-offer',
      kind: 'newswire',
      outlet: 'Dow Jones',
      atTick: 1,
      time: '10:05',
      headline: '외부 투자자 그룹, 포트폴리오 인수 제안 — 회신 시한 12:30',
      body: '회의 시작 직전, 한 외부 투자자 그룹이 포트폴리오 전체를 인수하겠다는 제안을 전달했다. 회신 시한은 12시 30분이다. 공동 출자 논의는 잠시 정회되었다.',
      severity: 'critical',
      sourceRefs: [S.mcd, S.fedHist, S.pressOffer],
      reliability: 'unconfirmed',
    },
    {
      id: 't5-memo-offer-expired',
      kind: 'memo',
      atTick: 1,
      time: '12:35',
      from: '회의 연락 담당',
      to: '리스크 헤드',
      subject: '외부 제안 만료 — 공동 출자가 유일한 선택지가 되었습니다',
      body: `12시 30분에 제안이 수락되지 않았고 연장되지도 않았습니다. 13시에 회의가 속개됩니다.

지금부터는 공동 출자 외의 대안이 없습니다. 어제 두 작업반이 "들어 올리기"는 불가능하다고 결론냈고, 외부 인수는 방금 끝났습니다.

제안 주체의 구성과 금액은 확인되지 않았습니다 — 기록에 남은 것은 제안의 존재와 12시 30분이라는 시한뿐입니다.`,
      severity: 'critical',
      sourceRefs: [S.mcd, S.pressOffer],
    },
    {
      id: 't5-data-allocation',
      kind: 'data',
      atTick: 2,
      time: '13:00',
      title: '분담 논의의 출발점',
      rows: [
        { label: '필요 출자 총액(순자산의 90% 인수 기준)', value: '$3.3B 이상' },
        { label: '핵심 참가사가 논의 중인 균등 분담액', value: '$300M' },
        { label: '소액 참여를 검토 중인 기관', value: '3곳' },
        { label: '불참 의사를 밝힌 기관', value: '2곳' },
        { label: '우리 청산 손실 추정(디폴트 시)', value: '{{metric:closeoutLossB}}' },
      ],
      severity: 'critical',
      sourceRefs: [S.mcd, S.fedHist, S.gao],
      relatedMetrics: ['closeoutLossB', 'peerCooperation'],
    },
    {
      id: 't5-memo-signing',
      kind: 'memo',
      atTick: 3,
      time: '15:30',
      from: '법무',
      to: '리스크 헤드',
      subject: '서명 시한',
      body: '서류는 준비되었습니다. 오늘 서명되지 않으면 내일 아침 결제가 불확실하고, 그 경우 상위 거래상대들이 동시에 청산에 들어갑니다. 조건부 서명은 다른 참가사에게 이탈 신호로 읽힙니다.',
      severity: 'critical',
      sourceRefs: [S.mcd, S.pwg],
    },
    {
      id: 't5-news-close',
      kind: 'newswire',
      outlet: 'Reuters',
      atTick: 4,
      time: '18:10',
      when: { flag: 'deal_closed' },
      headline: '주요 금융기관들, 롱텀캐피털 포트폴리오 공동 인수 합의',
      body: '오후 내내 이어진 논의 끝에 참가 기관들이 공동 출자와 지분 90% 인수에 합의했다. 출자금 집행은 9월 28일로 예정되어 있다. 연준의 자금은 투입되지 않았다.',
      severity: 'positive',
      sourceRefs: [S.mcd, S.gao, S.fedHist],
    },
    {
      id: 't5-news-fail',
      kind: 'newswire',
      outlet: 'Reuters',
      atTick: 4,
      time: '18:10',
      when: { flag: 'deal_failed' },
      headline: '공동 출자 합의 불발 — 주요 거래상대들 청산 절차 개시',
      body: '참가 기관들이 분담에 합의하지 못하고 회의가 끝났다. 상위 거래상대들이 동시에 포지션 종료 절차에 들어갔다. 국채·스왑 시장의 호가가 급격히 벌어지고 있다.',
      severity: 'critical',
      sourceRefs: [S.mcd, S.pwg],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '지분 배분 협상',
      prompt: '회의 테이블에서 어떤 구조와 금액을 제시하시겠습니까?',
      context:
        '총액이 성립선에 닿지 않으면 회의는 결렬되고 내일 아침 상위 거래상대들이 동시에 청산합니다. 다른 참가사는 우리 협조도와 우리가 부른 숫자를 보고 움직입니다.',
      select: { min: 1, max: 1 },
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't5-join-orderly',
      timeLimitSec: 240,
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'solvency', 'communication'],
      cardRefs: ['fdic-resolution-weekend', 'crisis-communication'],
      // 3단계: 배분 원칙 → 출자 제시액(commitReplies) → 서명.
      // 제시액은 `counters.consortiumPledgeM`에 남고, 그 크기가 타 딜러의 참여를 실제로 바꾼다.
      // 대사는 회의의 구조(균등 분담, 소액 3사, 불참 2사)에서 역산한 **재구성**이며 속기록이 아니다.
      steps: [
        {
          id: 't5-neg-open',
          lines: [
            {
              speaker: '코어그룹 대표',
              text: '구조는 합의됐습니다. 남은 것은 누가 얼마를 쓰느냐입니다. 어떤 원칙으로 나눌까요.',
            },
          ],
          note: '여기서 정한 원칙이 다른 참가사가 자기 이사회를 설득하는 방식이 됩니다.',
          replies: [
            {
              id: 't5-r-equal',
              label: '핵심 참가사 균등 분담을 제안한다',
              next: 't5-neg-pledge',
              expert: {
                rating: 80,
                rationale:
                  '실제로 성립한 원칙이다 — 열한 곳이 같은 금액을 냈고 세 곳만 작게 냈다. 균등 분담은 "다른 곳이 얼마를 쓰는가"라는 질문을 테이블에서 없애기 때문에 다섯 시간 안에 합의가 가능했다.',
              },
            },
            {
              id: 't5-r-pro-rata',
              label: '익스포저 비례 배분을 제안한다',
              next: 't5-neg-pledge',
              expert: {
                rating: 50,
                rationale:
                  '논리적으로는 옳지만 익스포저를 서로 검증해야 하고, 그러면 각 사가 자기 숫자를 작게 부를 유인이 생긴다. 시간이 없는 회의에서 비례 배분은 합의를 늦춘다.',
              },
            },
            {
              id: 't5-r-out',
              label: '우리는 참여하지 않겠다고 밝힌다',
              resolvesTo: 't5-out',
              expert: {
                rating: 20,
                rationale:
                  '두 기관이 실제로 한 선택이다. 오늘 자본이 묶이지 않지만, 코어그룹 참가사의 이탈은 소액 참여를 검토하던 기관들의 계산을 먼저 바꾼다.',
              },
            },
          ],
        },
        {
          id: 't5-neg-pledge',
          lines: [
            {
              speaker: '참가사 대표',
              text: '각 사 이사회에 올릴 숫자가 필요합니다. 귀사는 얼마입니까.',
            },
          ],
          note: '여기서 부른 금액은 이후 지분 배분에서 그대로 검증됩니다. 균등 분담 원칙에서 핵심 참가사는 $300M 수준을 전제로 논의하고 있습니다.',
          replies: commitReplies<PrimeBrokerState>('consortiumPledgeM', [100, 250, 350], {
            idPrefix: 'consortiumPledgeM',
            label: (v) => `$${v}M 출자를 제시`,
            next: 't5-neg-sign',
            expert: (v) => ({
              rating: v === 250 ? 80 : v === 350 ? 74 : 35,
              rationale:
                v === 250
                  ? '핵심 참가사의 균등 분담 수준이다. 회의는 이 금액을 $300M으로 맞춰 확정하며, 열한 곳이 실제로 낸 금액이 그것이다.'
                  : v === 350
                    ? '표준 분담을 넘어 선도적으로 제시한다. 협조도가 낮아 총액이 모자랄 때는 이 초과분이 다른 기관을 끌어오지만, 이미 충분하다면 $50M을 더 내는 것일 뿐이다.'
                    : '소액 참여다. 다른 기관이 충분히 들어오면 회의는 성립하고 우리는 적게 낸다 — 그러나 협조도가 낮으면 이 숫자가 총액을 성립선 아래로 떨어뜨린다.',
            }),
            trap: (v) => v < 200,
            trapExplanation: (v) =>
              v < 200
                ? '적게 내는 것이 언제나 이득처럼 보인다. 그러나 같은 숫자가 다른 참가사에게는 "코어그룹도 몸을 사린다"는 신호로 읽힌다. 우리 $150M이 남의 $300M을 지우면 총액은 오히려 줄어든다.'
                : undefined,
          }),
        },
        {
          id: 't5-neg-sign',
          lines: [
            {
              speaker: '뉴욕연준 마켓그룹 총괄',
              text: '외부 제안은 12시 30분에 만료되었습니다. 이제 이것이 유일한 안입니다. 서명하시겠습니까.',
            },
          ],
          note: '서명과 함께 청산 속도를 정합니다. 얼마나 빨리 푸는가가 실현 손실을 좌우합니다.',
          replies: [
            {
              id: 't5-r-sign-orderly',
              label: '즉시 서명하고 질서 있는 청산 일정에 합의',
              resolvesTo: 't5-join-orderly',
              expert: {
                rating: 85,
                rationale:
                  '컨소시엄의 목적 자체가 동시 청산을 피하는 것이다. 90% 지분과 운영 통제권을 가져오는 이유는 포지션을 **천천히** 풀기 위해서이며, 그래야 우리가 산 것이 값을 한다.',
              },
            },
            {
              id: 't5-r-sign-fast',
              label: '서명하되 포지션을 빠르게 정리하는 조건을 요구',
              resolvesTo: 't5-join-fast',
              expert: {
                rating: 30,
                rationale:
                  '출자하고도 동시 청산의 손실을 다시 만든다. McDonough의 판단은 "losses would have been exaggerated"였고, 그 과장은 파는 속도에서 나온다. 자본을 넣어 산 시간을 스스로 버리는 선택이다.',
              },
            },
            {
              id: 't5-r-conditional',
              label: '불참을 밝힌 기관이 들어오면 서명하겠다고 조건을 단다',
              resolvesTo: 't5-conditional',
              trap: true,
              trapExplanation:
                '공정해 보이는 조건이고 회의실에서는 이탈 신호로 읽힌다. 한 곳이 조건을 달면 다른 곳도 조건을 달고, 그러면 아무도 먼저 서명하지 않는다.',
              expert: {
                rating: 15,
                rationale:
                  '두 기관의 불참은 이미 확정되어 있었다. 그것을 조건으로 다는 것은 사실상 서명하지 않겠다는 뜻이며, 남은 참가사는 그렇게 받아들인다.',
              },
            },
          ],
        },
      ],
      options: [
        {
          id: 't5-join-orderly',
          label: '균등 분담으로 출자하고 질서 있는 청산에 합의',
          description:
            '확정된 분담액을 출자하고 포지션을 수개월에 걸쳐 푸는 일정에 합의한다. 실행 가능: 실제로 체결된 구조.',
          effects: [
            ltcmFx.resolveConsortium({
              joined: true,
              orderly: true,
              label: '컨소시엄 출자·질서 있는 청산',
            }),
            confidence(8, '공동 인수 합의'),
          ],
          expert: {
            rating: 85,
            rationale:
              '실제로 성립한 해법이다. 열넷이 $3.625B를 출자해 지분 90%와 운영 통제권을 가져갔고, 포지션은 시간을 두고 정리되었다. 연준은 자금을 대지 않았다(Greenspan: "no Federal Reserve funds were put at risk"). 대가는 자본이 묶이는 것과 무임승차를 감수하는 것이다.',
            historicalNote:
              '9/23 오후 다섯 시간의 논의 끝에 14개사가 참여를 합의했고, 9/28에 집행되었다.',
            sourceRefs: [S.mcd, S.gao, S.fedHist],
          },
          consequences:
            '서명했습니다. 포트폴리오의 90%와 운영 통제권이 참가사로 넘어갔고, 청산 일정은 수개월로 잡혔습니다.',
          historical: true,
          preview: [
            { metric: 'realizedLoss', direction: 'up', magnitude: 1, note: '출자분이 묶인다' },
            { metric: 'peerCooperation', direction: 'up', magnitude: 1 },
          ],
          feasibility: { basis: '실제로 체결된 구조', sourceRefs: [S.gao] },
          calibrationNote: '확정 분담액과 타 딜러 반응 — calibration.md §5',
        },
        {
          id: 't5-join-fast',
          label: '출자하되 포지션을 즉시 대량 정리',
          description:
            '출자에는 참여하지만 인수 직후 포지션을 빠르게 푼다. 실행 가능: 운영 통제권이 참가사에 있으므로 속도는 참가사가 정한다.',
          effects: [
            ltcmFx.resolveConsortium({
              joined: true,
              orderly: false,
              label: '컨소시엄 출자·급속 청산',
            }),
            confidence(2, '공동 인수 합의(급속 청산)'),
          ],
          expert: {
            rating: 30,
            rationale:
              '출자의 목적을 스스로 없앤다. 자본을 넣어 얻은 것은 지분이 아니라 **시간**이며, 그 시간을 쓰지 않으면 동시 청산과 같은 가격에 팔게 된다. 수렴 스프레드는 되돌아오지 않고 우리 자기 북도 함께 맞는다.',
            sourceRefs: [S.mcd, S.cgfs],
          },
          consequences:
            '서명 직후 대량 정리가 시작되었고 호가가 벌어졌습니다. 우리 자기 북의 마크도 함께 나빠졌습니다.',
          preview: [{ metric: 'realizedLoss', direction: 'up', magnitude: 3 }],
          feasibility: { basis: '운영 통제권 보유 시 가능', sourceRefs: [S.gao] },
        },
        {
          id: 't5-conditional',
          label: '조건부 서명 — 불참 기관이 들어와야 확정',
          description:
            '서명서에 다른 기관의 참여를 조건으로 단다. 실행 가능: 조건부 약정은 제시할 수 있다.',
          effects: [
            ltcmFx.resolveConsortium({
              joined: true,
              orderly: true,
              conditional: true,
              label: '조건부 서명',
            }),
          ],
          expert: {
            rating: 20,
            rationale:
              '공정성 논리는 성립하지만 시각이 맞지 않는다. 두 기관의 불참은 이미 확정되어 있었고, 조건을 다는 순간 남은 참가사는 우리를 "아직 결정하지 않은 쪽"으로 분류한다. 회의실에서 조건은 전염된다.',
            sourceRefs: [S.mcd, S.furfine],
          },
          consequences:
            '조건부 서명을 제출했습니다. 두 참가사가 자기 조건도 다시 검토하겠다고 말했습니다.',
          trap: true,
          trapExplanation:
            '무임승차를 막으려는 조건이 오히려 무임승차를 퍼뜨린다. 합의가 성립하지 않으면 조건을 단 쪽도 똑같이 손실을 본다.',
          preview: [{ metric: 'peerCooperation', direction: 'down', magnitude: 2 }],
          feasibility: { basis: '조건부 약정 제시는 가능', sourceRefs: [S.mcd] },
        },
        {
          id: 't5-out',
          label: '불참 — 자본을 묶지 않고 우리 계약만 관리',
          description:
            '출자하지 않는다. 다른 기관이 충분히 들어오면 청산은 질서 있게 진행되고 우리는 자본을 아낀다. 실행 가능: 두 기관이 실제로 한 선택.',
          effects: [
            ltcmFx.resolveConsortium({ joined: false, orderly: true, label: '컨소시엄 불참' }),
          ],
          expert: {
            rating: 25,
            rationale:
              '두 기관(청산 대리인 한 곳과 유럽 은행 한 곳)이 실제로 한 선택이며, 합의가 성립한 세계에서는 옳은 계산이었다. Furfine(BIS WP 103)은 구제에 참여하지 않은 대형은행의 조달금리가 사후에 오히려 낮아졌음을 보이며 이를 "too-big-to-fail" 인식의 강화로 해석한다. 위험은 하나다 — **우리가 빠짐으로써 합의가 성립하지 않는 경우**다.',
            sourceRefs: [S.gao, S.mcd, S.furfine],
          },
          consequences:
            '불참을 통보했습니다. 남은 참가사들이 우리 몫을 메울 수 있는지 계산하기 시작했습니다.',
          preview: [
            { metric: 'peerCooperation', direction: 'down', magnitude: 3 },
            { metric: 'closeoutLossB', direction: 'up', magnitude: 2 },
          ],
          feasibility: { basis: '두 기관이 실제로 한 선택', sourceRefs: [S.gao] },
        },
      ],
    },
    {
      id: 't5-d2',
      title: '자사 수렴 북 처리',
      prompt: '회의 결과가 정해졌습니다. 우리 자기 북은 어떻게 하시겠습니까?',
      context:
        '앞으로 몇 주 동안 수렴 스프레드가 어디로 가는지는 방금 결정된 구조에 달려 있습니다. 남겨 두면 그 움직임을 그대로 받고, 지금 정리하면 체결 비용을 냅니다.',
      when: { flag: 'consortium_resolved' },
      select: { min: 1, max: 1 },
      availableFrom: 3,
      deadlineTick: 3,
      defaultOptionId: 't5-d2-staged',
      timeLimitSec: 120,
      dimensions: ['marketRisk', 'solvency'],
      cardRefs: ['economic-vs-regulatory-capital'],
      options: [
        {
          id: 't5-d2-staged',
          label: '60%를 단계적으로 정리하고 40%를 남긴다',
          description:
            '컨소시엄의 청산 일정에 맞춰 나눠 판다. 체결 비용은 작고 잔여 포지션은 스프레드 움직임에 노출된다.',
          effects: [
            ltcmFx.settleOwnBook({
              keepFraction: 0.4,
              slippagePerUnit: 0.0008,
              label: '자사 북 단계적 정리',
            }),
          ],
          expert: {
            rating: 75,
            rationale:
              '청산 속도가 가격을 만든다는 것이 이 사건의 교훈이고, 그것은 우리 자기 북에도 똑같이 적용된다. 나눠 팔면 체결 비용이 작고, 남긴 부분은 우리가 방금 자본을 들여 만든 질서 있는 정리의 효과를 받는다.',
            sourceRefs: [S.mcd, S.cgfs],
          },
          consequences: '60%를 나눠 정리했습니다. 남은 40%는 스프레드 경로에 노출되어 있습니다.',
          historical: true,
          preview: [{ metric: 'realizedLoss', direction: 'up', magnitude: 1 }],
          feasibility: { basis: '자기매매 북은 내부 결정으로 조절 가능' },
        },
        {
          id: 't5-d2-immediate',
          label: '전량 즉시 정리',
          description: '오늘 한 번에 판다. 체결 비용이 크지만 이후 움직임에 노출되지 않는다.',
          effects: [
            ltcmFx.settleOwnBook({
              keepFraction: 0,
              slippagePerUnit: 0.0025,
              label: '자사 북 전량 즉시 정리',
            }),
          ],
          expert: {
            rating: 45,
            rationale:
              '회의가 결렬된 세계에서는 옳은 선택이고, 성립한 세계에서는 되돌림을 포기하면서 체결 비용까지 내는 선택이다. 어느 쪽인지는 방금 결정되었으므로 이 선택은 그 결과를 읽는 문제다.',
            sourceRefs: [S.cgfs],
          },
          consequences: '전량 정리했습니다. 체결 가격은 호가 중간값보다 상당히 아래였습니다.',
          preview: [{ metric: 'realizedLoss', direction: 'up', magnitude: 2 }],
          feasibility: { basis: '자기매매 북은 내부 결정으로 조절 가능' },
        },
        {
          id: 't5-d2-hold',
          label: '전량 유지 — 되돌림을 전부 받는다',
          description: '아무것도 팔지 않는다. 체결 비용이 없고 이후 움직임을 전부 받는다.',
          effects: [
            ltcmFx.settleOwnBook({
              keepFraction: 1,
              slippagePerUnit: 0,
              label: '자사 북 전량 유지',
            }),
          ],
          expert: {
            rating: 40,
            rationale:
              '질서 있는 정리가 확정된 세계에서는 가장 수익성 높은 선택이다. 다만 같은 선택이 결렬된 세계에서는 손실을 두 배로 만든다. 리스크 헤드의 일은 두 세계 모두에서 견디는 규모를 정하는 것이다.',
            sourceRefs: [S.cgfs, S.fmc],
          },
          consequences: '북을 그대로 두었습니다.',
          preview: [{ metric: 'realizedLoss', direction: 'flat', magnitude: 2 }],
          feasibility: { basis: '아무것도 하지 않는 선택' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '"타 딜러 협조도"와 "청산 손실 추정"을 같이 보세요. 앞의 숫자가 총액을 만들고, 뒤의 숫자가 결렬 시의 비용입니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '불참은 다른 기관이 충분히 들어올 때만 이득입니다. 우리가 코어그룹이라면, 우리의 이탈은 소액 참여를 검토하던 기관부터 지웁니다.',
    },
    {
      level: 3,
      decisionId: 't5-d1',
      text: '균등 분담 원칙으로 표준 분담액을 제시하고 즉시 서명하십시오. 자본을 넣어 사는 것은 지분이 아니라 청산에 쓸 시간입니다.',
    },
  ],
  relatedCards: ['fdic-resolution-weekend', 'economic-vs-regulatory-capital'],
}

export const turnsB: T[] = [t3, t4, t5]
