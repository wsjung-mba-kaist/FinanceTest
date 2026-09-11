import type { Condition, Interrupt, PrimeBrokerState, Turn } from '../../engine/types'
import { commitReplies } from '../../engine'
import { confidence, counter, flag, op, regulator, setCounter } from '../../engine/fx/common'
import { archegosFx } from './fx'
import { S } from './turnsA'

type T = Turn<PrimeBrokerState>

/** 3/25 일중 누적 분포. 장 마감(틱 2) 이후 세 틱은 보합 — 없는 시세를 만들지 않는다. */
export const T4_SHAPE = [0, 0.55, 1.0, 1.0, 1.0, 1.0]
/** 3/25 책 가치가중 종가 배수 −5.06% [CAL calibration.md §2]. */
export const T4_DAY_FACTOR = 0.949375

/** 3/26 일중 누적 분포. 개장 전 블록 → 개장 갭 → 오전 → 오후 → 종가 마감 [CAL calibration.md §2]. */
export const T5_SHAPE = [0, 0.358, 0.555, 0.77, 1.0]
/** 3/26 책 가치가중 종가 배수 −27.96% [CAL calibration.md §2]. */
export const T5_DAY_FACTOR = 0.7204

/** 매각 계획 코드(`counters.sellPlan`). calibration.md §6. */
export const SELL_PLAN = { gradual: 1, capped: 2, sameDay: 3, atClose: 4 } as const

function planIs(code: number): Condition {
  return {
    all: [
      { counter: 'sellPlan', gte: code },
      { counter: 'sellPlan', lte: code },
    ],
  }
}

// ---------------------------------------------------------------------------------------------
// T4 — 2021년 3월 25일 (목) "죄수의 딜레마" — 5틱
// ---------------------------------------------------------------------------------------------

/**
 * 심야에 걸려 온 다른 프라임브로커 리스크 총괄의 통화. **재구성된 대사이며 녹취가 아니다**
 * (calibration.md §8). 화자는 특정 개인이 아니라 직책이며, 내용은 공개 기록(3/25 저녁 공동 통화와
 * 그날 밤의 디폴트 통지·선매도)에서 재구성한 것이다.
 */
const t4PeerCall: Interrupt<PrimeBrokerState> = {
  id: 't4-i2-peer',
  interrupt: true,
  atTick: 4,
  jitter: 0,
  timeoutSec: 45,
  defaultOptionId: 't4-i2-silent',
  scoreWeight: 0.5,
  required: false,
  title: '노무라 프라임 리스크 총괄 통화',
  prompt: '한 곳이 이미 움직였다는 이야기가 돕니다. 어떻게 답하시겠습니까?',
  context:
    '지금 답하는 내용이 내일 아침 다른 프라임브로커들의 행동을 결정합니다. 답하지 않는 것도 하나의 신호입니다.',
  source: { kind: 'call', caller: '노무라 프라임 리스크 총괄', tone: 'urgent' },
  lines: [
    {
      speaker: '노무라 프라임 리스크 총괄',
      text: '오늘 밤 대규모 블록이 돌고 있다는 이야기를 들었습니다. 우리는 합의를 지킬 생각인데, 귀사는 어떻게 하시겠습니까.',
    },
  ],
  dimensions: ['communication', 'policy'],
  cardRefs: ['crisis-communication'],
  options: [
    {
      id: 't4-i2-hold',
      label: '합의를 지키겠다고 확인한다',
      description: '내일 아침까지 독자 매각을 하지 않겠다고 서면으로 확인한다.',
      effects: [flag('standstill_reaffirmed'), confidence(3, '공동 정리 확약')],
      expert: {
        rating: 82,
        rationale:
          '공동 정리의 가치는 전원이 지킬 때만 생긴다. 확약을 문서로 남기면 상대도 남기며, 그것이 이튿날 아침의 이탈 압력을 낮춘다.',
        sourceRefs: [S.pressStand, S.fsb],
      },
      consequences: '확약이 교환되었습니다. 상대도 같은 문구를 보내왔습니다.',
    },
    {
      id: 't4-i2-match',
      label: '우리도 오늘 밤 처분하겠다고 답한다',
      description: '합의를 깨고 심야 블록으로 30%를 처분한다. 오늘 밤 가격이 내일보다 낫다.',
      effects: [
        flag('sold_first'),
        archegosFx.declareDefault({ label: '심야 선매도 전 디폴트 선언' }),
        archegosFx.liquidateSlice({ fraction: 0.3, label: '3/25 심야 블록 30%' }),
        confidence(-8, '공동 정리 이탈'),
      ],
      expert: {
        rating: 22,
        rationale:
          '오늘 밤 체결가는 확실히 낫다. 그러나 이 통화 한 통이 상대의 계산을 바꾸고, 내일 아침 모두가 같은 시각에 같은 종목을 판다. 자사 손실은 줄고 업계 합산 손실과 감독 비용은 커진다 — 그 차이가 이 시나리오의 주제다.',
        sourceRefs: [S.pressMs, S.pressStand],
      },
      consequences: '심야 블록이 체결되었습니다. 상대는 답하지 않고 전화를 끊었습니다.',
      trap: true,
      trapExplanation:
        '먼저 파는 쪽이 이기는 것은 사실이다. 문제는 상대도 같은 계산을 한다는 것이며, 전화로 그 사실을 알려 주면 계산이 즉시 실행된다.',
      preview: [
        { metric: 'realizedLoss', direction: 'up', magnitude: 1 },
        { metric: 'industryLoss', direction: 'up', magnitude: 3 },
      ],
    },
    {
      id: 't4-i2-verify',
      label: '내일 아침 제3자 대사를 요구한다',
      description: '합의 준수를 제3자가 매시간 대사하도록 요구하고 그 결과를 전원에게 공유한다.',
      effects: [
        flag('standstill_verified'),
        flag('standstill_reaffirmed'),
        confidence(2, '검증 장치 도입'),
      ],
      expert: {
        rating: 86,
        rationale:
          '죄수의 딜레마에서 협력을 유지시키는 것은 선의가 아니라 관측 가능성이다. 검증이 있으면 이탈이 즉시 드러나고, 이탈의 기대 이익이 사라진다.',
        sourceRefs: [S.fsb, S.bcbs],
      },
      consequences: '제3자 대사에 합의했습니다. 내일 아침부터 매시간 집계가 공유됩니다.',
      preview: [{ metric: 'industryLoss', direction: 'down', magnitude: 2 }],
    },
    {
      id: 't4-i2-silent',
      label: '확답하지 않는다',
      description: '내일 아침에 다시 이야기하자고 답하고 통화를 끝낸다.',
      effects: [counter('peerCallsDeferred', 1)],
      expert: {
        rating: 38,
        rationale:
          '위법도 배신도 아니지만, 상대는 확답하지 않는 쪽을 이탈 가능성으로 계산에 넣는다. 공동 정리에서 침묵은 중립이 아니다.',
        sourceRefs: [S.pressStand],
      },
      consequences: '확답 없이 통화를 끝냈습니다.',
      historical: true,
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2021년 3월 25일 (목) 09:30 ET',
  title: '죄수의 딜레마',
  time: '2021-03-25T09:30:00-04:00',
  ticks: 6,
  tickLabels: [
    '09:30 개장',
    '13:00 오후',
    '16:00 종가',
    '18:00 프라임브로커 공동 통화',
    '21:00 심야',
    '23:30 마감',
  ],
  entryEffects: [
    { id: 't4-reset', description: '당일 카운터 초기화', effects: [archegosFx.resetDaily()] },
    {
      id: 't4-call',
      description: '3/25 마진콜 산정 — 전일 미납분이 합산된다',
      effects: [archegosFx.issueMarginCall({ requiredPct: -1, label: '3/25 마진콜' })],
    },
    {
      id: 't4-ci',
      description: '고객이 복수 프라임브로커의 콜을 동시에 받고 있다는 사실이 확인되며 신뢰지수 −6',
      effects: [confidence(-6, '고객 지급불능 징후')],
    },
  ],
  eachTick: [
    {
      id: 't4-mark-tick',
      description: '3/25 일중 마크 — 장 마감 이후 두 틱은 보합',
      effects: [
        archegosFx.markStep({ dayFactor: T4_DAY_FACTOR, shape: T4_SHAPE, label: '3/25 마크' }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't4-peer-night',
      atTick: 5,
      description: '심야 — 다른 프라임브로커들의 첫 반응',
      effects: [archegosFx.peerReactionStep({ point: 'night', label: '3/25 심야' })],
    },
  ],
  ticker: {
    series: [
      // 비아콤CBS: 3/24 종가 $70.10(지수 69.86) → 3/25 종가 $66.35(지수 66.12) [VERIFY facts.ts]
      {
        path: 'market.custom.viac',
        mode: 'relative',
        values: [69.86, 67.8, 66.12, 66.12, 66.12, 66.12],
      },
      // 디스커버리: 3/25 −3.0% [STYLIZED]; 3/25 종가 $57.75가 확인된 값이다
      {
        path: 'market.custom.disca',
        mode: 'relative',
        values: [87.36, 85.92, 84.74, 84.74, 84.74, 84.74],
      },
      // VIX: 3/24 종가 21.20 → 3/25 종가 19.81 [fred-vixcls] — 지수 변동성은 오히려 내렸다
      {
        path: 'market.volIndex',
        mode: 'absolute',
        values: [21.2, 20.5, 19.81, 19.81, 19.81, 19.81],
      },
    ],
  },
  interrupts: [t4PeerCall],
  events: [
    {
      id: 't4-memo-nopay',
      kind: 'memo',
      atTick: 0,
      time: '09:00',
      from: '마진 운영팀',
      to: '프라임브로커리지 리스크 헤드',
      subject: '아케고스 — 전일 마진콜 미납, 당일 콜 합산 발행',
      body: `- 어제 요구액이 납입되지 않았습니다. 오늘 콜에 전일 미납분이 합산되어 발행되었습니다.
- 고객 담당자는 "오늘 중 프라임브로커 전체 회의를 소집하겠다"고 알려 왔습니다.
- 계약상 디폴트 사유는 이미 발생했습니다. 상계 청산 권한은 선언과 동시에 생깁니다.
- 미회수 익스포저는 대시보드를 참조하십시오. 이 금액은 무담보 익스포저입니다.`,
      severity: 'critical',
      sourceRefs: [S.pw, S.finma],
      cardRefs: ['regulator-escalation-ladder'],
      relatedMetrics: ['marginShortfall', 'marginCallOutstanding'],
    },
    {
      id: 't4-news-rumour',
      kind: 'rumor',
      atTick: 1,
      time: '13:20',
      source: '트레이딩 데스크',
      headline: '대형 미디어주에 대규모 매도 물량이 준비되고 있다는 이야기',
      body: '데스크에 "비아콤CBS와 디스커버리에서 수십억 달러 규모의 블록이 준비되고 있다"는 이야기가 돌고 있습니다. 출처는 확인되지 않았습니다.',
      severity: 'warning',
      reliability: 'unconfirmed',
      sourceRefs: [S.pressBlock],
    },
    {
      id: 't4-dialogue-standstill',
      kind: 'dialogue',
      atTick: 3,
      time: '18:00',
      title: '프라임브로커 공동 통화',
      lines: [
        {
          speaker: '아케고스 최고운영책임자',
          text: '자기자본은 90억에서 100억 달러 사이입니다. 총익스포저는 1,200억 달러 규모이며 롱 700억, 숏 500억입니다.',
        },
        {
          speaker: '회의 주재 프라임브로커',
          text: '우리 여덟 곳의 합산이 그 숫자라는 뜻입니까. 각자가 본 것은 그 일부였습니다.',
        },
        {
          speaker: '아케고스 최고운영책임자',
          text: '질서 있게 정리할 시간을 주십시오. 지금 동시에 팔면 아무도 회수하지 못합니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.pressStand, S.sec],
      cardRefs: ['crisis-communication'],
      relatedMetrics: ['industryExposure'],
    },
    {
      id: 't4-market-close',
      kind: 'market',
      atTick: 2,
      time: '16:05',
      headline: '마감 시세',
      items: [
        { label: '비아콤CBS', value: '$66.35', change: '−5.35%' },
        { label: 'VIX', value: '19.81', change: '−1.39' },
        { label: 'S&P 500', value: '보합권', change: '+0.5%' },
      ],
      sourceRefs: [S.pressBlock, S.vix],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '공동 정리 협상',
      prompt: '여덟 곳의 프라임브로커가 같은 통화에 있습니다. 무엇을 약속하시겠습니까?',
      context:
        '합의는 전체 손실을 줄이지만 상대가 배신하면 지킨 쪽만 크게 잃습니다. 먼저 팔면 오늘은 유리하지만 시장 충격을 키우고 평판·감독 비용을 남깁니다. 약속한 일일 매각 상한은 내일 실제 매각량과 대조됩니다.',
      select: { min: 1, max: 1 },
      availableFrom: 3,
      deadlineTick: 3,
      defaultOptionId: 't4-c',
      timeLimitSec: 240,
      requiredConcepts: ['crisis-communication'],
      cardRefs: ['crisis-communication', 'regulator-escalation-ladder'],
      dimensions: ['policy', 'marketRisk', 'timeliness'],
      // 3단계 대화: 참여 여부 → 일일 매각 상한 → 검증 장치. 대사는 기록에 근거한 재구성이며
      // 실제 통화록이 아니다(calibration.md §8).
      steps: [
        {
          id: 't4-sa-open',
          lines: [
            {
              speaker: '회의 주재 프라임브로커',
              text: '고객 자기자본이 100억 달러이고 우리 여덟 곳 합산 익스포저가 1,200억 달러입니다. 각자 팔면 아무도 회수하지 못합니다. 공동 정리에 참여하시겠습니까.',
            },
          ],
          note: '여기서 하는 약속은 내일 실제 매각량과 대조되며, 초과분은 이후 평가에 반영됩니다.',
          replies: [
            {
              id: 't4-sa-r-join',
              label: '원칙적으로 참여하겠다',
              next: 't4-sa-cap',
              expert: {
                rating: 78,
                rationale:
                  '공동 정리는 전체 손실을 줄이는 유일한 구조다. 문제는 약속의 구체성이며, 다음 두 질문이 그것을 정한다.',
              },
            },
            {
              id: 't4-sa-r-declare',
              label: '디폴트만 선언하고 합의에는 참여하지 않겠다',
              resolvesTo: 't4-d',
              expert: {
                rating: 45,
                rationale:
                  '권한은 확보하되 조율은 포기한다. 배신은 아니지만 상대는 이 답을 이탈 예고로 읽는다.',
              },
            },
            {
              id: 't4-sa-r-sell',
              label: '오늘 밤 독자적으로 처분하겠다',
              resolvesTo: 't4-a',
              expert: {
                rating: 28,
                rationale:
                  '오늘 밤 체결가는 낫다. 그 대가로 내일 아침 여덟 곳이 동시에 같은 종목을 판다.',
              },
              trap: true,
              trapExplanation:
                '죄수의 딜레마의 우월전략은 배신이다 — 한 번만 하는 게임이라면. 프라임브로커리지는 반복 게임이고, 감독당국과 나머지 일곱 곳이 모두 이 선택을 기억한다.',
            },
            {
              id: 't4-sa-r-wait',
              label: '고객이 스스로 정리하도록 기다리겠다',
              resolvesTo: 't4-e',
              expert: {
                rating: 8,
                rationale:
                  '고객의 자기자본은 이미 익스포저의 8%다. 스스로 정리할 수 있는 단계가 아니다.',
              },
              trap: true,
              trapExplanation:
                '아무것도 하지 않는 것은 결정이 아닌 것처럼 보이지만, 디폴트를 선언하지 않으면 상계 청산 권한이 생기지 않고 미회수 익스포저만 커진다.',
            },
          ],
        },
        {
          id: 't4-sa-cap',
          lines: [
            {
              speaker: '회의 주재 프라임브로커',
              text: '그러면 각자 하루에 보유 명목의 몇 퍼센트까지 팔 수 있게 할지 정합시다. 낮을수록 시장 충격이 작지만 정리에 오래 걸립니다.',
            },
          ],
          note: '약속한 일일 매각 상한은 이후 실제 매각량으로 이행 여부가 평가됩니다.',
          replies: commitReplies<PrimeBrokerState>('dailySellCapPct', [5, 15, 25], {
            idPrefix: 't4-sa-cap',
            unit: '%',
            label: (v) => `일일 매각 상한 ${v}%로 합의`,
            next: (v) => (v <= 15 ? 't4-sa-verify' : 't4-sa-loose'),
            expert: (v) => ({
              rating: v <= 5 ? 88 : v <= 15 ? 66 : 32,
              rationale:
                v <= 5
                  ? '상한이 낮을수록 이탈의 유혹이 커지지만, 동시에 이탈하지 않았을 때의 이익도 커진다. 낮은 상한 + 검증이 이 게임의 해다.'
                  : v <= 15
                    ? '중간 상한은 시장 충격을 어느 정도 줄이지만 여전히 하루에 책의 절반이 시장에 나온다.'
                    : '25%는 사실상 상한이 없는 것이다. 상대는 이 숫자를 보고 합의가 형식이라고 판단한다.',
            }),
            trap: (v) => v >= 25,
            trapExplanation: (v) =>
              v >= 25
                ? '느슨한 상한은 협상을 쉽게 만든다. 그러나 지킬 필요가 없는 약속은 상대에게 "이 합의는 구속력이 없다"는 신호이며, 이탈 압력을 오히려 높인다.'
                : undefined,
          }),
        },
        {
          id: 't4-sa-verify',
          lines: [
            {
              speaker: '회의 주재 프라임브로커',
              text: '준수 여부는 어떻게 확인합니까. 각자 자기 신고로 할지, 제3자를 둘지 정해야 합니다.',
            },
          ],
          replies: [
            {
              id: 't4-sa-v-third',
              label: '제3자 일일 대사를 두자',
              resolvesTo: 't4-b',
              setFlags: { standstill_verified: true },
              expert: {
                rating: 90,
                rationale:
                  '협력을 유지시키는 것은 선의가 아니라 관측 가능성이다. 검증이 있으면 이탈이 즉시 드러나고 이탈의 기대 이익이 사라진다.',
              },
            },
            {
              id: 't4-sa-v-escrow',
              label: '상호 담보 예치로 이행을 담보하자',
              resolvesTo: 't4-b',
              setFlags: { standstill_verified: true },
              expert: {
                rating: 72,
                rationale:
                  '예치는 이탈을 비싸게 만들지만 즉시 드러나게 하지는 않는다. 대사보다 약하되 자율 신고보다는 강하다.',
              },
            },
          ],
        },
        {
          id: 't4-sa-loose',
          lines: [
            {
              speaker: '회의 주재 프라임브로커',
              text: '그 상한이면 사실상 제한이 없습니다. 그대로 서명하시겠습니까, 아니면 다시 조이겠습니까.',
            },
          ],
          replies: [
            {
              id: 't4-sa-l-sign',
              label: '그대로 서명한다',
              resolvesTo: 't4-c',
              expert: {
                rating: 35,
                rationale:
                  '합의문은 만들어지지만 구속력이 없다. 상대는 그것을 보고 각자 계산을 시작한다.',
              },
            },
            {
              id: 't4-sa-l-tighten',
              label: '상한을 5%로 다시 낮추자고 제안한다',
              effects: [setCounter<PrimeBrokerState>('dailySellCapPct', 5)],
              next: 't4-sa-verify',
              expert: {
                rating: 84,
                rationale:
                  '협상 도중에 조건을 조이는 것은 관계 비용이 있지만, 구속력 없는 합의에 서명하는 것보다 낫다.',
              },
            },
          ],
        },
      ],
      options: [
        {
          id: 't4-a',
          label: '합의를 거부하고 오늘 밤 독자 처분',
          description:
            '디폴트를 선언하고 심야 블록으로 보유 명목의 45%를 처분한다. 계약상 상계 청산 권한으로 즉시 실행 가능하다.',
          effects: [
            flag('sold_first'),
            archegosFx.declareDefault({ label: '3/25 디폴트 선언(선매도 전)' }),
            archegosFx.liquidateSlice({ fraction: 0.45, label: '3/25 심야 블록 45%' }),
            confidence(-10, '공동 정리 거부'),
            regulator({ add: 1 }, '단독 대량 처분'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description:
                '선매도 사실이 확인되어 감독당국이 카운터파티 정리 관행 검토에 착수 — 단계 +1, 신뢰 −8',
              effects: [regulator({ add: 1 }, '정리 관행 검토'), confidence(-8, '업계 평판 손상')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '자사 손실만 보면 이 선택이 가장 낫다 — 실제로 먼저 판 은행들은 손실이 미미했다. 그러나 PRA·FCA 공동 서한과 FSB 보고서는 이 사건을 "개별 합리가 집합적으로 $100억을 넘는 손실을 만든 사례"로 다룬다. 감독당국은 자사 손실이 아니라 정리 방식을 본다.',
            historicalNote:
              '보도에 따르면 한 은행은 3월 25일 밤 약 $50억을 선매도했고, 그 은행의 손실은 $911m에 그쳤다.',
            sourceRefs: [S.dearCeo, S.fsb],
          },
          consequences: '심야 블록이 체결되었습니다. 다른 프라임브로커들이 이를 즉시 감지했습니다.',
          irreversible: true,
          feasibility: {
            basis: '디폴트 선언 후 상계 청산 권한으로 장외 블록 즉시 실행 가능',
            sourceRefs: [S.pressMs],
          },
          preview: [
            { metric: 'realizedLoss', direction: 'down', magnitude: 2 },
            { metric: 'industryLoss', direction: 'up', magnitude: 3 },
          ],
        },
        {
          id: 't4-b',
          label: '공동 정리 합의 + 제3자 검증',
          description:
            '디폴트를 선언하되 일일 매각 상한과 제3자 일일 대사를 조건으로 공동 정리에 참여한다. 합의는 구속력 있는 서면으로 교환한다.',
          effects: [
            flag('standstill_signed'),
            flag('standstill_verified'),
            archegosFx.declareDefault({ label: '3/25 디폴트 선언(공동 정리)' }),
            confidence(4, '공동 정리 합의'),
            regulator({ add: 1 }, '카운터파티 디폴트 보고'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { counter: 'capBreachPct', gt: 0 },
              description:
                '약속한 일일 매각 상한을 초과한 사실이 제3자 대사에서 드러남 — 신뢰 −14, 감독 단계 +1',
              effects: [
                confidence(-14, '약속한 매각 상한 위반'),
                regulator({ add: 1 }, '합의 위반 확인'),
              ],
            },
            {
              afterTurns: 2,
              when: { counter: 'capBreachPct', lte: 0 },
              description: '합의가 끝까지 지켜진 것이 대사로 확인됨 — 신뢰 +8',
              effects: [confidence(8, '공동 정리 완주')],
            },
          ],
          expert: {
            rating: 90,
            rationale:
              'FSB는 아케고스를 카운터파티 신용리스크의 오가격과 조율 실패 사례로 다루며, BCBS 기준은 디폴트 관리 절차의 사전 합의를 요구한다. 검증 없는 합의는 합의가 아니다 — 2021년 3월 25일의 제안이 실패한 이유가 그것이다.',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences:
            '합의문이 교환되었고 제3자 대사가 내일 아침부터 시작됩니다. 디폴트는 선언되었습니다.',
          feasibility: {
            basis: '디폴트 선언과 스탠드스틸 합의는 양립 가능 — 실제로 제안된 구조',
            sourceRefs: [S.pressStand],
          },
          preview: [{ metric: 'industryLoss', direction: 'down', magnitude: 3 }],
        },
        {
          id: 't4-c',
          label: '공동 정리에 합의하되 검증 장치는 두지 않는다',
          description:
            '디폴트를 선언하고 구두 합의에 참여한다. 각자 자율 신고로 준수를 확인한다. 가장 빨리 합의에 도달하는 방식이다.',
          effects: [
            flag('standstill_signed'),
            archegosFx.declareDefault({ label: '3/25 디폴트 선언(구두 합의)' }),
            confidence(1, '공동 정리 참여'),
            regulator({ add: 1 }, '카운터파티 디폴트 보고'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { counter: 'capBreachPct', gt: 0 },
              description: '합의 위반이 사후에 드러남 — 신뢰 −10',
              effects: [confidence(-10, '약속한 매각 상한 위반')],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '실제로 이 구조가 제안되었고 실패했다. 구두 합의는 이탈을 다음 날 아침에야 알게 하며, 그때는 이미 블록이 체결된 뒤다. 그러나 시도 자체는 옳았다 — 사후평가는 조율 실패를 문제 삼았지 조율 시도를 문제 삼지 않았다.',
            historicalNote:
              '3월 25일 저녁의 공동 통화에서 스탠드스틸이 제안되었으나 합의에 이르지 못했고, 같은 밤 일부 은행이 디폴트 통지를 발송했다.',
            sourceRefs: [S.pressStand, S.pw],
          },
          consequences:
            '구두 합의가 이루어졌습니다. 디폴트는 선언되었고, 준수 확인 방법은 정해지지 않았습니다.',
          historical: true,
          feasibility: {
            basis: '구두 스탠드스틸 — 실제로 제안된 구조',
            sourceRefs: [S.pressStand],
          },
        },
        {
          id: 't4-d',
          label: '디폴트만 선언하고 매각·합의를 모두 보류',
          description:
            '상계 청산 권한만 확보하고 오늘 밤에는 아무것도 팔지 않으며 합의에도 서명하지 않는다.',
          effects: [
            archegosFx.declareDefault({ label: '3/25 디폴트 선언(단독)' }),
            confidence(-3, '조율 불참'),
            regulator({ add: 1 }, '카운터파티 디폴트 보고'),
          ],
          expert: {
            rating: 48,
            rationale:
              '권한은 확보하고 시장 충격은 만들지 않는다. 그러나 합의에 서명하지 않은 쪽은 상대의 계산에서 이탈 가능성으로 취급되며, 그것이 내일 아침 전체 이탈 압력을 높인다.',
            sourceRefs: [S.pressStand, S.bcbs],
          },
          consequences:
            '디폴트가 통지되었습니다. 합의에는 참여하지 않았고 오늘 밤 매각도 없습니다.',
          feasibility: { basis: '계약상 디폴트 선언은 단독으로 가능', sourceRefs: [S.bcbs] },
        },
        {
          id: 't4-e',
          label: '디폴트를 선언하지 않고 고객의 자체 정리를 기다린다',
          description:
            '고객이 스스로 포지션을 정리하겠다고 하므로 디폴트 선언을 보류하고 하루 더 지켜본다.',
          effects: [counter('defaultDeferred', 1), confidence(-4, '디폴트 미선언')],
          expert: {
            rating: 6,
            rationale:
              '고객 자기자본은 이미 총익스포저의 8% 수준이었고, 여덟 곳의 콜이 동시에 도착한 상태였다. 디폴트를 선언하지 않으면 상계 청산 권한이 생기지 않아 다음 날 가격이 무너질 때 아무것도 할 수 없다.',
            sourceRefs: [S.pressStand, S.sec],
          },
          consequences:
            '디폴트 선언을 보류했습니다. 미회수 익스포저가 그대로 남아 있고 청산 권한은 없습니다.',
          trap: true,
          trapExplanation:
            '"하루만 더"는 T3의 유예와 같은 선택이며, 이번에는 상계 청산 권한까지 포기하는 것이다. 다른 프라임브로커들은 이미 권한을 확보했다.',
          preview: [{ metric: 'marginShortfall', direction: 'up', magnitude: 3 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '대시보드의 "업계 추정 총익스포저"를 보십시오. 우리가 보던 것은 그중 일부였습니다.',
    },
    {
      level: 2,
      decisionId: 't4-d1',
      text: '이것은 반복 게임입니다. 상대가 지킬 것인지가 아니라, 상대가 지키는지 볼 수 있는가가 문제입니다.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: '낮은 일일 상한 + 제3자 검증이 이 게임의 해입니다. 검증 없는 합의는 서명 그 자체가 이탈 신호가 됩니다.',
    },
  ],
  relatedCards: ['crisis-communication', 'regulator-escalation-ladder'],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2021년 3월 26일 (금) "블록 거래" — 5틱
// ---------------------------------------------------------------------------------------------

/** 개장 전 자사 트레이딩 데스크의 블록 오퍼 보고. 재구성된 대사다(calibration.md §8). */
const t5DeskCall: Interrupt<PrimeBrokerState> = {
  id: 't5-i1-desk',
  interrupt: true,
  atTick: 0,
  jitter: 0,
  timeoutSec: 30,
  defaultOptionId: 't5-i1-partial',
  scoreWeight: 0.5,
  required: false,
  title: '자사 트레이딩 데스크 블록 오퍼 보고',
  prompt: '개장 전 블록 오퍼가 들어왔습니다. 어떻게 처리하시겠습니까?',
  context: '개장 전 가격은 전일 종가 근처입니다. 개장하면 이 가격은 사라집니다.',
  source: { kind: 'desk', caller: '주식 파생 데스크 헤드', tone: 'urgent' },
  lines: [
    {
      speaker: '주식 파생 데스크 헤드',
      text: '한 경쟁사가 개장 전 블록을 돌리고 있습니다. 우리 물량도 같이 실어 준다고 합니다. 지금 결정해야 합니다.',
    },
  ],
  dimensions: ['marketRisk', 'liquidity'],
  cardRefs: ['hqla-and-haircuts'],
  options: [
    {
      id: 't5-i1-full',
      label: '오퍼 전량을 수락해 25%를 즉시 처분',
      description: '개장 전 가격에 보유 명목의 25%를 블록으로 넘긴다.',
      effects: [
        archegosFx.liquidateSlice({
          fraction: 0.25,
          countAsBlock: true,
          label: '개장 전 블록 25%',
        }),
      ],
      expert: {
        rating: 58,
        rationale:
          '개장 전 체결가는 그날 최고가다. 다만 합의한 일일 상한이 있다면 한 번에 25%는 그것을 넘길 수 있고, 그 초과는 이후 평가된다.',
        sourceRefs: [S.pressBlock],
      },
      consequences: '블록이 체결되었습니다. 개장 전 가격이 적용되었습니다.',
      preview: [{ metric: 'grossExposure', direction: 'down', magnitude: 2 }],
    },
    {
      id: 't5-i1-negotiate',
      label: '잔여 규모를 밝히고 가격을 재협상해 5% 처분',
      description:
        '블록 매수자에게 우리 잔여 물량 규모를 알리고 그만큼 나은 조건을 받되, 합의한 일일 상한 안에 들어가도록 5%만 처분한다.',
      effects: [
        archegosFx.liquidateSlice({
          fraction: 0.05,
          slipK: 0.006,
          countAsBlock: true,
          label: '개장 전 블록 5%(규모 공개)',
        }),
        flag('overhang_disclosed'),
      ],
      expert: {
        rating: 82,
        rationale:
          '잔여 물량을 숨기면 매수자가 그것을 뒤에서 알게 되고 다음 블록의 가격이 무너진다. 규모를 밝히고 받는 할인이 결국 더 싸며, 시장 교란 소지도 없다.',
        sourceRefs: [S.cgfs, S.dearCeo],
      },
      consequences:
        '매수자가 잔여 규모를 알고도 받았습니다. 할인은 작았고 이후 호가가 유지되었습니다.',
      preview: [{ metric: 'realizedLoss', direction: 'down', magnitude: 1 }],
    },
    {
      id: 't5-i1-partial',
      label: '경쟁사 주도 블록에 8%만 참여',
      description:
        '주도 은행이 만든 블록에 우리 물량 일부를 얹는다. 관계도 지키고 일부는 처분한다.',
      effects: [
        archegosFx.liquidateSlice({
          fraction: 0.08,
          countAsBlock: true,
          label: '주도 블록 참여 8%',
        }),
        counter('followedLeadBlock', 1),
      ],
      expert: {
        rating: 44,
        rationale:
          'Paul Weiss 보고서는 CS가 3월 26일에 명목 $30억 남짓만 매도했고 그중 약 $12.7억이 골드만 주도 블록이었다고 기록한다. 남의 블록에 얹는 것은 안전해 보이지만 물량 대부분이 그대로 남는다.',
        historicalNote: '이것이 「기다린 은행」의 실제 속도였다.',
        sourceRefs: [S.pw, S.pressBlock],
      },
      consequences: '주도 블록에 우리 물량 일부가 실렸습니다. 대부분은 아직 남아 있습니다.',
      historical: true,
    },
    {
      id: 't5-i1-decline',
      label: '오퍼를 거절하고 장중 분할로 간다',
      description: '개장 전 할인을 받아들이지 않고 장중 유동성을 이용한다.',
      effects: [counter('blockDeclined', 1)],
      expert: {
        rating: 30,
        rationale:
          '장중 유동성이 남아 있을 것이라는 가정이 필요하다. 이날은 남아 있지 않았고, 개장 전 가격이 그날 최고가였다.',
        sourceRefs: [S.pressBlock],
      },
      consequences: '오퍼를 거절했습니다. 개장을 기다립니다.',
      trap: true,
      trapExplanation:
        '"할인이 너무 크다"는 판단은 그 할인이 최소일 때 나온다. 집중 포지션의 유동성은 하루 안에 사라지며, 거절한 가격은 그날의 최고가였다.',
    },
  ],
}

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2021년 3월 26일 (금) 07:00 ET',
  title: '블록 거래',
  time: '2021-03-26T07:00:00-04:00',
  ticks: 5,
  tickLabels: [
    '07:00 개장 전 블록 오퍼',
    '09:30 개장',
    '11:00 오전',
    '14:00 오후',
    '16:00 종가 마감',
  ],
  entryEffects: [
    { id: 't5-reset', description: '당일 카운터 초기화', effects: [archegosFx.resetDaily()] },
    {
      id: 't5-ci',
      description: '기초 종목 동시 급락 — 신뢰지수 −12',
      effects: [confidence(-12, '블록 매각 연쇄')],
    },
  ],
  eachTick: [
    {
      id: 't5-mark-tick',
      description: '3/26 일중 마크 — 개장 갭 이후 종가까지 계단식 하락',
      effects: [
        archegosFx.markStep({ dayFactor: T5_DAY_FACTOR, shape: T5_SHAPE, label: '3/26 마크' }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't5-peer-open',
      atTick: 1,
      description: '개장 — 다른 프라임브로커들의 반응',
      effects: [archegosFx.peerReactionStep({ point: 'open', label: '3/26 개장' })],
    },
    {
      id: 't5-peer-mid',
      atTick: 2,
      description: '오전 — 블록이 연쇄적으로 돌기 시작',
      effects: [archegosFx.peerReactionStep({ point: 'mid', label: '3/26 오전' })],
    },
    {
      id: 't5-sell-t1-sameday',
      atTick: 1,
      when: planIs(SELL_PLAN.sameDay),
      description: '전량 당일 청산 — 개장 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.3, countAsBlock: true, label: '개장 30%' }),
      ],
    },
    {
      id: 't5-sell-t2-gradual',
      atTick: 2,
      when: planIs(SELL_PLAN.gradual),
      description: '장중 분할 — 오전 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.04, countAsBlock: true, label: '오전 4%' }),
      ],
    },
    {
      id: 't5-sell-t2-sameday',
      atTick: 2,
      when: planIs(SELL_PLAN.sameDay),
      description: '전량 당일 청산 — 오전 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.4, countAsBlock: true, label: '오전 40%' }),
      ],
    },
    {
      id: 't5-sell-t3-gradual',
      atTick: 3,
      when: planIs(SELL_PLAN.gradual),
      description: '장중 분할 — 오후 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.04, countAsBlock: true, label: '오후 4%' }),
      ],
    },
    {
      id: 't5-sell-t3-capped',
      atTick: 3,
      when: planIs(SELL_PLAN.capped),
      description: '합의 상한 내 매각 — 오늘 남은 여유만큼만',
      effects: [archegosFx.liquidateToCap({ maxFraction: 0.25, label: '상한 내 매각' })],
    },
    {
      id: 't5-sell-t3-sameday',
      atTick: 3,
      when: planIs(SELL_PLAN.sameDay),
      description: '전량 당일 청산 — 오후 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.3, countAsBlock: true, label: '오후 30%' }),
      ],
    },
    {
      id: 't5-peer-close',
      atTick: 4,
      description: '종가 — 이날의 마지막 이탈 판정',
      effects: [archegosFx.peerReactionStep({ point: 'close', label: '3/26 종가' })],
    },
    {
      id: 't5-sell-t4-gradual',
      atTick: 4,
      when: planIs(SELL_PLAN.gradual),
      description: '장중 분할 — 종가 슬라이스',
      effects: [
        archegosFx.liquidateSlice({ fraction: 0.04, countAsBlock: true, label: '종가 4%' }),
      ],
    },
    {
      id: 't5-sell-t4-close',
      atTick: 4,
      when: planIs(SELL_PLAN.atClose),
      description: '잔여 전량을 종가에 일괄 처분',
      effects: [
        archegosFx.liquidateSlice({ fraction: 1, countAsBlock: true, label: '종가 일괄 처분' }),
      ],
    },
    {
      id: 't5-cap-check',
      atTick: 4,
      description: '약속한 일일 매각 상한 준수 여부 판정',
      effects: [archegosFx.checkSellCap({ label: '3/26 상한 대사' })],
    },
  ],
  ticker: {
    series: [
      // 비아콤CBS: 3/25 종가 $66.35(지수 66.12) → 3/26 종가 $48.23(지수 48.06, −27.31%) [로이터]
      { path: 'market.custom.viac', mode: 'relative', values: [66.12, 59.66, 56.1, 52.22, 48.06] },
      // 디스커버리: 3/25 $57.75 → 3/26 $41.90 (−27.45%) [로이터]
      {
        path: 'market.custom.disca',
        mode: 'relative',
        values: [84.74, 76.41, 71.82, 66.82, 61.48],
      },
      // VIX: 3/25 19.81 → 3/26 18.86 [fred-vixcls] — 청산 당일 지수 변동성은 오히려 내렸다
      { path: 'market.volIndex', mode: 'absolute', values: [19.81, 19.55, 19.3, 19.05, 18.86] },
    ],
  },
  interrupts: [t5DeskCall],
  events: [
    {
      id: 't5-news-premarket',
      kind: 'newswire',
      outlet: 'Bloomberg',
      atTick: 0,
      time: '07:10',
      headline: '개장 전 대형 블록 유통 — 중국 ADR과 미디어주 수십억 달러 규모',
      body: '개장 전 시간에 바이두, 텐센트뮤직, 웨이핀후이를 포함한 블록이 기관 매수자에게 제시되고 있다. 규모는 수십억 달러로 추정되며 매도자는 확인되지 않았다.',
      severity: 'critical',
      sourceRefs: [S.pressBlock],
    },
    {
      id: 't5-news-blocks',
      kind: 'newswire',
      outlet: 'Bloomberg',
      atTick: 2,
      time: '11:20',
      headline: '블록 매각 연쇄 — 한 은행만 오늘 $105억, 비아콤CBS·디스커버리 급락',
      body: '한 대형 투자은행이 오늘 하루 약 $105억 규모의 블록을 소화시킨 것으로 전해졌다. 개장 전 $66억(바이두·텐센트뮤직·웨이핀후이), 이후 $39억(비아콤CBS·디스커버리·파페치·아이치이·GSX)이다. 해당 종목들은 두 자릿수 하락 중이다.',
      severity: 'critical',
      sourceRefs: [S.pressBlock],
      relatedMetrics: ['market.viac', 'market.disca', 'pbDefectors'],
    },
    {
      id: 't5-memo-desk',
      kind: 'memo',
      atTick: 3,
      time: '14:10',
      from: '주식 파생 데스크 헤드',
      to: '프라임브로커리지 리스크 헤드',
      subject: '잔여 물량 처리 현황',
      body: `- 오후 호가가 급격히 얇아졌습니다. 같은 종목에 대해 복수의 매도자가 동시에 물량을 내놓고 있습니다.
- 우리 잔여 명목은 대시보드의 "총익스포저"를 참조하십시오. 오늘 안에 전량을 소화시키는 것은 불가능합니다.
- 오늘 넘기는 물량은 다음 주에 처리하게 되며, 그때의 가격은 오늘 시장에 얼마가 나왔는지에 달려 있습니다.`,
      severity: 'critical',
      sourceRefs: [S.pw, S.cgfs],
      relatedMetrics: ['grossExposure', 'market.blockDiscountBp'],
    },
    {
      id: 't5-market-close',
      kind: 'market',
      atTick: 4,
      time: '16:05',
      headline: '마감 시세',
      items: [
        { label: '비아콤CBS', value: '$48.23', change: '−27.31%' },
        { label: '디스커버리', value: '$41.90', change: '−27.45%' },
        { label: 'VIX', value: '18.86', change: '−0.95' },
        { label: 'S&P 500', value: '상승 마감', change: '+1.7%' },
      ],
      sourceRefs: [S.pressBlock, S.vix],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '매각 속도',
      prompt: '남은 물량을 오늘 어떤 속도로 처분하시겠습니까?',
      context:
        '하루에 얼마를 파느냐가 실현 손실을 좌우합니다. 빨리 팔면 오늘 가격이 깨지고, 천천히 팔면 다음 주 가격에 노출됩니다. 공동 정리에 합의했다면 약속한 일일 상한이 있습니다.',
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't5-a',
      timeLimitSec: 180,
      cardRefs: ['hqla-and-haircuts', 'tri-party-repo-run'],
      dimensions: ['marketRisk', 'liquidity', 'policy'],
      options: [
        {
          id: 't5-a',
          label: '장중 분할로 하루 12%만 처분',
          description:
            '오전·오후·종가에 4%씩 나눠 판다. 시장 충격을 최소화하고 나머지는 다음 주로 넘긴다.',
          effects: [setCounter<PrimeBrokerState>('sellPlan', SELL_PLAN.gradual)],
          expert: {
            rating: 42,
            rationale:
              'Paul Weiss는 CS가 3월 26일에 명목 $30억 남짓만 매도했다고 기록한다 — 책의 15% 수준이다. 시장 충격은 작았지만 잔여 물량이 다음 주 가격에 그대로 노출되었고, 그것이 손실의 대부분을 만들었다.',
            historicalNote: '「기다린 은행」의 실제 속도다.',
            sourceRefs: [S.pw, S.csQ1],
          },
          consequences: '분할 매각이 시작되었습니다. 대부분의 물량이 다음 주로 넘어갑니다.',
          historical: true,
          feasibility: { basis: '장중 분할 매각은 상시 가능', sourceRefs: [S.cgfs] },
          preview: [{ metric: 'grossExposure', direction: 'down', magnitude: 1 }],
        },
        {
          id: 't5-b',
          label: '합의한 일일 상한 안에서만 처분',
          description:
            '공동 정리에서 약속한 일일 상한 안에서만 판다. 오늘 이미 판 만큼을 빼고 남은 여유만 체결한다.',
          requires: { flag: 'standstill_signed' },
          unavailableReason: '공동 정리 합의에 서명하지 않았으므로 지킬 상한이 없습니다',
          effects: [
            setCounter<PrimeBrokerState>('sellPlan', SELL_PLAN.capped),
            flag('cap_respected'),
          ],
          expert: {
            rating: 80,
            rationale:
              '상한을 지키면 다른 프라임브로커의 이탈 압력이 낮아지고, 잔여 물량의 다음 주 처분 가격이 올라간다. 합의가 유지된 세계에서는 질서 있는 정리의 손실률이 무질서 청산의 절반 이하다.',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences: '상한 내에서만 매각했습니다. 제3자 대사가 있다면 준수 사실이 기록됩니다.',
          feasibility: {
            basis: '합의 상한 준수는 자기 집행 — 별도 창구가 필요 없다',
            sourceRefs: [S.pressStand],
          },
          preview: [{ metric: 'industryLoss', direction: 'down', magnitude: 2 }],
        },
        {
          id: 't5-c',
          label: '오늘 안에 전량 청산한다',
          description: '개장·오전·오후에 걸쳐 잔여 전량을 소화시킨다. 다음 주 가격 위험을 없앤다.',
          effects: [setCounter<PrimeBrokerState>('sellPlan', SELL_PLAN.sameDay)],
          expert: {
            rating: 38,
            rationale:
              '다음 주 가격 위험은 없어지지만 오늘 시장이 그 물량을 소화하지 못한다. 자기 매도가 자기 체결가를 깎고, 공동 정리에 합의했다면 상한을 크게 넘긴다.',
            sourceRefs: [S.cgfs, S.pressBlock],
          },
          consequences: '전량이 오늘 안에 처분되었습니다. 체결가는 크게 나빠졌습니다.',
          feasibility: {
            basis: '블록 매수자가 존재하는 한 가능 — 가격은 규모에 따라 결정된다',
            sourceRefs: [S.cgfs],
          },
          preview: [{ metric: 'realizedLoss', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't5-d',
          label: '종가까지 기다렸다가 일괄 처분한다',
          description:
            '장중 매도가 가격을 깎는다고 보고 종가 대량거래로 한 번에 넘긴다. 단일 체결로 처리된다.',
          effects: [setCounter<PrimeBrokerState>('sellPlan', SELL_PLAN.atClose)],
          expert: {
            rating: 18,
            rationale:
              '종가는 그날 최저가였다. 하루 종일 다른 은행들이 같은 종목을 팔고 난 뒤의 종가에 전량을 얹는 것은 가장 나쁜 시각에 가장 큰 물량을 내놓는 것이다.',
            sourceRefs: [S.pressBlock, S.cgfs],
          },
          consequences: '종가에 대량 물량이 체결되었습니다. 할인이 컸습니다.',
          trap: true,
          trapExplanation:
            '"장중에 팔면 가격을 깎는다"는 논리는 맞다. 그러나 그 논리의 결론은 "천천히 팔라"이지 "마지막에 한꺼번에 팔라"가 아니다. 하루를 기다리는 동안 가격은 28% 떨어졌다.',
          preview: [{ metric: 'realizedLoss', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't5-e',
          label: '잔여 물량 정보를 자사 데스크에 넘겨 선매도한다',
          description:
            '고객 청산 예정 물량을 자기계정 트레이딩 데스크에 알려 먼저 헤지·매도하게 한다.',
          effects: [
            setCounter<PrimeBrokerState>('sellPlan', SELL_PLAN.sameDay),
            flag('front_running'),
            regulator({ set: 4 }, '고객 주문정보 유용·선행매매'),
          ],
          expert: {
            rating: 0,
            rationale:
              '고객 청산 정보를 자기계정 거래에 쓰는 것은 시장질서 교란이자 정보차단벽 위반이며 어떤 상황에서도 선택지가 아니다. PRA·FCA 공동 서한은 이 사건 이후 주식 파이낸싱 사업의 정보 관리와 통제 전반을 점검 대상으로 명시했다.',
            sourceRefs: [S.dearCeo, S.fed],
          },
          consequences: '선행매매가 즉시 감지되었습니다. 감독당국이 영업 제한을 부과했습니다.',
          trap: true,
          trapExplanation:
            '손실을 줄이라는 압력 아래에서 가장 빠른 길로 보인다. 그러나 이것은 리스크 관리 실패가 아니라 행위 위반이며, 손실이 아니라 사업 자체를 잃는다.',
          illegal: true,
          irreversible: true,
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis: '실행은 가능하나 명백한 시장질서 교란행위',
            sourceRefs: [S.dearCeo],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '이번 턴 로그의 이탈 프라임브로커 수를 보십시오. 그 숫자가 오늘 우리 체결가를 결정합니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '오늘 파는 양과 다음 주 가격은 반대로 움직입니다. 오늘 많이 팔수록 잔여 물량의 값이 떨어집니다.',
    },
    {
      level: 3,
      decisionId: 't5-d1',
      text: '합의에 서명했다면 상한을 지키십시오. 상한 초과는 T6에서 대사되어 신뢰와 감독 단계로 돌아옵니다.',
    },
  ],
  relatedCards: ['hqla-and-haircuts', 'crisis-communication'],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2021년 3월 29일 ~ 2023년 7월 "청구서"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2021년 3월 29일 ~ 2023년 7월 24일',
  title: '청구서',
  time: '2021-03-29T07:00:00-04:00',
  entryEffects: [
    {
      id: 't6-residual',
      description:
        '잔여 물량을 다음 주 이후 처분한다 — 가격은 지난주 금요일에 시장에 얼마가 나왔는지에 달려 있다',
      effects: [archegosFx.liquidateResidual({ label: '잔여 처분' })],
    },
    {
      id: 't6-industry',
      description: '업계 합산 손실 확정',
      effects: [
        archegosFx.finaliseIndustryLoss({ label: '업계 손실 집계' }),
        archegosFx.settleBooks({ label: '최종 정산' }),
      ],
    },
    {
      id: 't6-market',
      description: '3/29 종가 반영 — 비아콤CBS $45.01',
      effects: [
        op('market.custom.viac', 'set', 44.86, '3/29 종가 $45.01'),
        op('market.custom.disca', 'set', 60.5, '3/29 종가 $41.23'),
        op('market.volIndex', 'set', 20.74, 'VIX 3/29 종가'),
      ],
    },
    {
      id: 't6-fallout',
      description: '손실 공표와 감독당국 검토 개시 — 신뢰지수 −18, 감독 단계 +1',
      effects: [confidence(-18, '손실 공표'), regulator({ add: 1 }, '감독당국 검토 개시')],
    },
    {
      id: 't6-stock',
      when: { metric: 'realizedLoss', gte: 3 },
      description: '손실 규모가 배정자본의 3분의 1을 넘어 주가 −22%',
      effects: [op('market.ownStock', 'mul', 0.78, '손실 공표 후 주가')],
    },
  ],
  events: [
    {
      id: 't6-news-warning',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '3/29 07:00',
      headline: '복수 은행, 미국 헤지펀드 디폴트로 중대한 손실 경고',
      body: '두 개 이상의 대형 은행이 미국 소재 고객의 마진 약정 불이행으로 실적에 중대한 영향을 받을 수 있다고 공시했다. 한 일본계 증권사는 $20억 규모의 손실 가능성을 언급했고, 유럽계 은행은 규모를 특정하지 않았다.',
      severity: 'critical',
      sourceRefs: [S.csQ1, S.nomura],
    },
    {
      id: 't6-data-losses',
      kind: 'data',
      time: '2021-04-27',
      title: '공시된 손실 — 프라임브로커별',
      rows: [
        { label: '크레디트스위스', value: '$5.5bn (1Q21 CHF 4.4bn 계상 + 2Q21 잔여)' },
        { label: '노무라', value: '$2.9bn (¥313bn)' },
        { label: '모건스탠리', value: '$911m (신용사건 $644m + 이후 거래손실 $267m)' },
        { label: 'UBS', value: 'USD 774m (1Q21) + 2Q 잔여 약 $87m' },
        { label: '미쓰비시UFJ', value: '$270m (초기 경고 $300m)' },
        { label: '미즈호', value: '약 $90m [보도 기준, 회사 미확인]' },
        { label: '골드만삭스·웰스파고·도이체', value: '손실 미미(자체 공표)' },
        { label: '합계', value: '$100억 초과 (PRA·FCA 공동 서한)' },
      ],
      severity: 'critical',
      sourceRefs: [S.csQ1, S.nomura, S.ms, S.ubs, S.dearCeo],
      relatedMetrics: ['realizedLoss', 'industryLoss'],
    },
    {
      id: 't6-regulator-letter',
      kind: 'regulator',
      time: '2021-12-10',
      agency: 'PRA·FCA',
      headline: '영국 내 은행 앞 공동 서한 — 주식 파이낸싱 사업 감독 검토 결과',
      body: '아케고스 디폴트로 업계 전체에 $100억을 넘는 손실이 발생했다. 검토 결과 네 가지 결함이 확인되었다: 사업부 간 리스크 통합관리 미흡, 온보딩 이후 고객 관계 재평가 부재, 비효과적이고 일관되지 않은 마진 방식, 종합적 리스크관리 체계의 부재. 이 관찰은 주식 파이낸싱을 넘어 담보·합성 파이낸싱 전반에 적용된다.',
      tone: 'concerned',
      severity: 'critical',
      sourceRefs: [S.dearCeo],
      cardRefs: ['regulator-escalation-ladder'],
    },
    {
      id: 't6-news-penalties',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '2023-07-24',
      headline: '연준 $2억6,850만·PRA £8,700만 — 아케고스 관련 제재 확정',
      body: '연준은 카운터파티 신용리스크 관리의 불안전·불건전성을 이유로 $268.5m의 벌금과 동의명령을 부과했다. PRA는 2020년 1월~2021년 3월 기간의 리스크관리·거버넌스 실패로 £87,082,000을 부과했으며, 이는 PRA 사상 최고 금액이자 Fundamental Rule 4건 동시 위반이 인정된 첫 사례다. FINMA는 같은 날 절차를 종결하며 자체 포지션 제한과 리스크 연동 보수 기준을 명령했다.',
      severity: 'critical',
      sourceRefs: [S.fed, S.pra, S.finma],
      cardRefs: ['regulator-escalation-ladder'],
    },
    {
      id: 't6-news-standards',
      kind: 'newswire',
      outlet: 'BIS',
      time: '2024-12-11',
      headline:
        '바젤위원회, 카운터파티 신용리스크 관리 기준 발표 — 1999년 고레버리지 기관 기준 대체',
      body: '바젤은행감독위원회는 실사, 신용리스크 완화(마진), 잠재미래익스포저·스트레스테스트 기반 측정, 거버넌스의 네 축으로 구성된 카운터파티 신용리스크 관리 기준을 발표했다. 위원회는 이미 2022년 11월 뉴스레터에서 "아케고스 캐피털 매니지먼트의 붕괴는 일부 은행의 리스크관리 관행상 결함을 드러냈다"고 적은 바 있다. 2025년 7월 금융안정위원회는 비은행 레버리지 최종 보고서에서 카운터파티 레버리지 파악을 정책 권고로 담았다.',
      severity: 'info',
      sourceRefs: [S.bcbs, S.bcbsNl, S.fsb],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '손실 공표와 감독당국 대응',
      prompt: '손실을 어떻게 공표하고 무엇을 함께 발표하시겠습니까?',
      context:
        '규모는 이미 확정되었습니다. 남은 것은 언제, 무엇과 함께 말하느냐입니다. 감독당국은 숫자보다 무엇을 고칠 것인지를 봅니다.',
      cardRefs: ['crisis-communication', 'regulator-escalation-ladder'],
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't6-a',
          label: '즉시 경고 공시 + 독립 외부조사 의뢰',
          description:
            '규모가 확정되기 전이라도 중대 손실 가능성을 즉시 공시하고 외부 법무법인에 독립조사를 의뢰한다.',
          effects: [
            flag('independent_review'),
            confidence(6, '즉시 공시 + 독립조사'),
            counter('disclosureQuality', 2),
          ],
          expert: {
            rating: 72,
            rationale:
              '이것이 실제 경로다 — 3월 29일 경고 공시, 4월 6일 규모 공표, 7월 29일 독립조사 보고서 공개. 보고서는 "경영과 통제의 근본적 실패"라고 결론지었고, 그 공개 자체가 이후 감독당국 협상의 기초가 되었다.',
            historicalNote: '독립조사 결과 23명이 징계를 받았고 $70m의 보수가 환수되었다.',
            sourceRefs: [S.pw, S.csQ1],
          },
          consequences:
            '공시가 나갔고 독립조사가 시작되었습니다. 주가는 하락했지만 정보 공백은 없었습니다.',
          historical: true,
          feasibility: {
            basis: '중대 손실의 즉시 공시는 상장사 공시 의무',
            sourceRefs: [S.csQ1],
          },
        },
        {
          id: 't6-b',
          label: '분기 실적 발표까지 공표를 미룬다',
          description: '규모가 확정될 때까지 기다렸다가 분기 실적에서 한 번에 공표한다.',
          effects: [confidence(-10, '공시 지연'), regulator({ add: 1 }, '공시 시점 검토')],
          expert: {
            rating: 22,
            rationale:
              '규모를 모르는 동안에도 "중대할 수 있다"는 사실은 알고 있었다. 정보 공백은 시장이 최악을 가정하게 만들고, 공시 지연 자체가 별도의 감독 사안이 된다.',
            sourceRefs: [S.dearCeo, S.fed],
          },
          consequences: '공표가 미뤄졌습니다. 그 사이 언론 추정치가 먼저 돌았습니다.',
          trap: true,
          trapExplanation:
            '"정확한 숫자가 나올 때까지"라는 기다림은 성실해 보인다. 그러나 공시 기준은 정확성이 아니라 중대성이며, 중대성은 이미 확정되어 있었다.',
        },
        {
          id: 't6-c',
          label: '"중대하지 않다"고 발표한다',
          description: '손실이 자본에 미치는 영향이 제한적이라고 설명하고 규모를 특정하지 않는다.',
          effects: [
            flag('misleading_statement'),
            regulator({ add: 2 }, '부정확한 공시'),
            confidence(-20, '공시 신뢰 붕괴'),
          ],
          expert: {
            rating: 2,
            rationale:
              '손실이 배정자본의 상당 부분을 소진한 상태에서 "중대하지 않다"는 발표는 부정확한 공시이며, 그 자체가 별도의 제재 사유가 된다.',
            sourceRefs: [S.fed, S.pra],
          },
          consequences:
            '발표 직후 언론이 실제 규모를 보도했습니다. 감독당국이 공시 내용을 검토 대상으로 올렸습니다.',
          trap: true,
          trapExplanation:
            '주가를 지키려는 발표가 신뢰와 주가를 동시에 잃게 만든다. 손실 규모는 어차피 분기 재무제표에서 드러난다.',
          illegal: true,
          remediationCard: 'crisis-communication',
        },
        {
          id: 't6-d',
          label: '즉시 공표 + 프라임브로커리지 사업 전면 철수 발표',
          description:
            '손실 공표와 동시에 프라임서비스 사업 전면 철수를 발표하고 모든 고객 포지션 정리에 착수한다.',
          effects: [flag('franchise_surrendered'), confidence(-6, '사업 철수 발표')],
          expert: {
            rating: 44,
            rationale:
              '결과적으로 같은 방향이다 — 사업 철수는 그해 11월에 실제로 이루어졌다. 그러나 손실 공표와 동시에 발표하면 남은 고객들이 동시에 포지션을 옮기게 되고, 정리 과정 자체가 또 한 번의 가격 충격이 된다.',
            historicalNote: '프라임서비스 철수 발표는 2021년 11월 4일 전략 발표에서 이루어졌다.',
            sourceRefs: [S.pressExit],
          },
          consequences:
            '철수가 발표되었습니다. 남은 고객들이 동시에 계좌를 옮기기 시작했고 사업부가 해체됩니다.',
          irreversible: true,
          feasibility: { basis: '사업 철수 발표는 이사회 승인 사항', sourceRefs: [S.pressExit] },
        },
        {
          id: 't6-e',
          label: '즉시 공표 + 독립조사 + 마진 체계 재설계 동시 발표',
          description:
            '공시·독립조사에 더해 전 고객 동적 마진 전환과 집중도 한도 도입을 같은 날 발표하고 감독당국에 자진 보고한다.',
          effects: [
            flag('independent_review'),
            flag('self_reported'),
            confidence(10, '공시 + 조사 + 시정계획'),
            counter('disclosureQuality', 3),
          ],
          expert: {
            rating: 92,
            rationale:
              '감독당국이 사후에 본 것은 손실 규모가 아니라 "반복된 경고에도 관리하지 못했다"는 사실과 그 뒤에 무엇을 고쳤는가였다. 연준 동의명령과 PRA 처분은 모두 시정 의무를 핵심으로 담았다. 시정계획을 스스로 먼저 내놓는 것과 명령으로 받는 것은 결과가 다르다.',
            sourceRefs: [S.fed, S.pra, S.bcbs],
          },
          consequences:
            '공시·조사·시정계획이 같은 날 발표되었습니다. 감독당국이 자진 보고를 협조 요소로 기록했습니다.',
          feasibility: {
            basis: '자진 보고와 시정계획 제출은 감독당국 협의 절차상 상시 가능',
            sourceRefs: [S.fed],
          },
        },
      ],
    },
    {
      id: 't6-d2',
      title: '마진 체계 재설계',
      prompt: '무엇을 바꾸시겠습니까?',
      context:
        '이 결정이 다음 고객에게 적용됩니다. 감독당국의 시정 명령은 몇 달 뒤에 오지만, 그 내용은 지금 여기서 결정할 수 있습니다.',
      cardRefs: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
      dimensions: ['marketRisk', 'compliance', 'policy'],
      options: [
        {
          id: 't6-d2-a',
          label: '전 헤지펀드 고객을 동적 마진으로 전환',
          description: '예외 없이 모든 헤지펀드 고객을 동적 마진 체계로 옮긴다.',
          effects: [
            archegosFx.setMarginPolicy({
              staticPct: 15,
              dynamic: true,
              concentrationAddOn: false,
              bookScale: -1,
              feeDelta: -0.04,
              label: '전 고객 동적 마진 전환',
            }),
            flag('remediation_dynamic'),
          ],
          expert: {
            rating: 84,
            rationale:
              '실제로 사건 직후 모든 헤지펀드 고객이 동적 마진으로 전환되었다. 2020년에 했어야 할 일을 2021년에 한 것이며, 그 지연이 $55억이었다.',
            sourceRefs: [S.pw, S.bcbs],
          },
          consequences:
            '전 고객이 동적 마진으로 전환되었습니다. 일부 고객이 이탈했고 수수료가 줄었습니다.',
          feasibility: { basis: '계약상 마진 조건 변경권', sourceRefs: [S.bcbs] },
        },
        {
          id: 't6-d2-b',
          label: '동적 마진 + 집중도 가산 + 총레버리지 증빙 의무화',
          description:
            '동적 마진에 더해 청산 소요일 기반 집중도 가산과 전 프라임브로커 익스포저 증빙 제출을 계약 의무로 만든다.',
          effects: [
            archegosFx.setMarginPolicy({
              staticPct: 18,
              dynamic: true,
              concentrationAddOn: true,
              bookScale: -1,
              feeDelta: -0.05,
              label: '동적 마진 + 집중도 가산 + 증빙 의무',
            }),
            flag('remediation_full'),
            flag('escalated_to_board'),
          ],
          expert: {
            rating: 94,
            rationale:
              'BCBS 카운터파티 신용리스크 관리 기준(2024-12-11)은 실사, 신용리스크 완화(마진), PFE·스트레스 기반 측정, 거버넌스의 네 축을 요구하며, 1999년의 고레버리지 기관 관련 기준을 대체했다. FSB는 카운터파티 총레버리지 파악을 별도 권고로 담았다. 이 선택이 사후 기준을 선제적으로 충족한다.',
            sourceRefs: [S.bcbs, S.fsb],
          },
          consequences:
            '세 가지가 모두 도입되었습니다. 증빙을 거부한 고객 일부가 이탈했고 수수료가 크게 줄었습니다.',
          feasibility: {
            basis: '계약 갱신 시 정보제출 조항 추가 — 아케고스 이후 업계 표준',
            sourceRefs: [S.fsb, S.dearCeo],
          },
        },
        {
          id: 't6-d2-c',
          label: '프라임브로커리지 사업에서 철수한다',
          description: '마진 체계를 고치는 대신 사업 자체를 접고 자본을 다른 부문으로 재배치한다.',
          effects: [
            flag('pb_exit'),
            archegosFx.feeImpact({ delta: -0.06, label: '프라임서비스 철수' }),
            confidence(-2, '사업 축소'),
          ],
          expert: {
            rating: 58,
            rationale:
              '실제 결말이다 — 2021년 11월 전략 발표에서 프라임서비스 대부분 철수가 결정되었다. 리스크는 사라지지만 역량도 사라지며, 같은 실패가 다른 사업부에서 반복되지 않는다는 보장은 없다. 감독당국의 시정 명령은 철수와 무관하게 2023년에 부과되었다.',
            historicalNote: '철수 결정은 사건 8개월 뒤에 내려졌다.',
            sourceRefs: [S.pressExit, S.fed],
          },
          consequences: '사업 철수가 결정되었습니다. 고객이 경쟁사로 이동하고 인력이 재배치됩니다.',
          historical: true,
          irreversible: true,
          feasibility: { basis: '이사회 전략 결정', sourceRefs: [S.pressExit] },
        },
        {
          id: 't6-d2-d',
          label: '담당자 징계로 마무리하고 체계는 유지',
          description:
            '관련 임직원을 징계하고 보수를 환수하되 마진 체계와 한도 구조는 그대로 둔다.',
          effects: [counter('disciplineOnly', 1), regulator({ add: 1 }, '시정 조치 불충분')],
          expert: {
            rating: 8,
            rationale:
              '독립조사는 이 사건을 개인의 부정이 아니라 "경영과 통제의 근본적 실패"로 규정했고, 사기나 위법 행위의 증거는 없다고 결론지었다. 개인 징계는 필요하지만 충분하지 않으며, 연준·PRA 명령이 요구한 것은 정확히 체계의 시정이었다.',
            sourceRefs: [S.pw, S.fed],
          },
          consequences:
            '징계가 이루어졌습니다. 마진 체계는 그대로이며 감독당국이 시정 계획을 요구했습니다.',
          trap: true,
          trapExplanation:
            '책임자를 특정하면 사건이 끝난 것처럼 보인다. 그러나 같은 마진 체계가 남아 있으면 다음 고객에게 같은 일이 일어나며, 감독당국은 그것을 본다.',
          remediationCard: 'economic-vs-regulatory-capital',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '감독당국은 손실 규모가 아니라 무엇을 고칠 것인지를 봅니다.',
    },
    {
      level: 3,
      decisionId: 't6-d2',
      text: '사후 기준(BCBS 2024, FSB 2025)은 동적 마진·집중도·총레버리지 파악 세 가지를 모두 요구합니다. 지금 그것을 스스로 도입하면 명령으로 받지 않아도 됩니다.',
    },
  ],
  relatedCards: ['regulator-escalation-ladder', 'crisis-communication'],
}

export const turnsB: T[] = [t4, t5, t6]
