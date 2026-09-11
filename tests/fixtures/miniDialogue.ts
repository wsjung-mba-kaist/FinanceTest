/**
 * `miniBank` with its T0 disclosure decision turned into a three-step conversation with the
 * supervisor, and `miniTicks`' partner phone call turned into a two-step negotiation.
 *
 * Nothing about the decisions themselves changes: the same three options, the same effects, the
 * same historical/expert path choices. Only the *way* they are reached is new, which is exactly
 * the D3 contract — a dialogue always terminates in one of the decision's existing `options`.
 *
 * The graph is deliberately shaped so that every autoplay policy walks it differently:
 *
 *   dlg-open ──(정확한 수치)──────────┐
 *            ──(대략적 범위, 함정)────┤→ dlg-backstop ──(0 / 50%)──→ dlg-plain →  opt_b / opt_c
 *            ──(집계 후 보고)─────────→ opt_c_silent   ──(100%)────→ dlg-full  →  opt_a / opt_c
 */
import type { BankState, Decision, DialogueStep, ScenarioDefinition, Turn } from '@/engine'
import { commitReplies } from '@/engine'
import { confidence } from '@/engine/fx/common'
import { miniBank } from './miniBank'
import { miniTicks, TICKED_TURN_INDEX } from './miniTicks'

/** Counter the 백스톱 비율 promise is written to, and judged by later. */
export const BACKSTOP_COUNTER = 'backstopPct'

export const DIALOGUE_DECISION_ID = 'd0_disclosure'
export const DIALOGUE_INTERRUPT_ID = 'i1_partner_call'

const openStep: DialogueStep<BankState> = {
  id: 'dlg-open',
  lines: [
    { speaker: '감독관', text: '어제 마감 후 보고서를 봤습니다. 손실 규모를 확인해 주시겠습니까?' },
  ],
  note: '여기서 말한 숫자는 이후 공시와 대조됩니다.',
  replies: [
    {
      id: 'r-exact',
      label: '확정 손실 $18억을 수치로 보고',
      next: 'dlg-backstop',
      expert: { rating: 80, rationale: '검증 가능한 수치가 먼저 나가야 이후 협상이 가능하다.' },
    },
    {
      id: 'r-range',
      label: '"수십억 달러 수준"이라고만 답변',
      next: 'dlg-backstop',
      expert: { rating: 40, rationale: '범위만 말하면 감독당국이 최악을 가정한다.' },
      trap: true,
      trapExplanation: '모호한 규모는 감독당국이 스스로 상한을 추정하게 만든다.',
    },
    {
      id: 'r-defer',
      label: '집계가 끝난 뒤 보고하겠다고 답변',
      resolvesTo: 'opt_c_silent',
      expert: { rating: 50, rationale: '담보를 먼저 설정하는 판단 자체는 합리적이다.' },
    },
  ],
}

/**
 * The numeric promise: discrete replies plus a counter, never a slider. Whether the promise was
 * kept is judged later — see the delayed effect on `opt_c_silent` below.
 */
const backstopStep: DialogueStep<BankState> = {
  id: 'dlg-backstop',
  lines: [{ speaker: '감독관', text: '증자에 백스톱은 몇 %까지 확보되어 있습니까?' }],
  note: '약속한 백스톱 비율은 이후 이행 여부로 평가됩니다.',
  replies: commitReplies<BankState>(BACKSTOP_COUNTER, [0, 50, 100], {
    unit: '%',
    label: (v) => (v === 0 ? '백스톱 없음' : `${v}% 확보`),
    next: (v) => (v >= 100 ? 'dlg-full' : 'dlg-plain'),
    expert: (v) => ({
      rating: v >= 100 ? 85 : v >= 50 ? 55 : 20,
      rationale:
        v >= 100
          ? '완전 백스톱은 신뢰 충격을 제한한다.'
          : v >= 50
            ? '부분 백스톱은 시장 소화 여력에 기댄다.'
            : '백스톱 없는 증자 발표는 런의 방아쇠가 된다.',
    }),
  }),
}

const fullStep: DialogueStep<BankState> = {
  id: 'dlg-full',
  lines: [{ speaker: '감독관', text: '완전 백스톱이라면 오늘 공개해도 좋습니다. 하시겠습니까?' }],
  replies: [
    {
      id: 'r-full-announce',
      label: '백스톱 증자와 함께 오늘 공개',
      resolvesTo: 'opt_a_backstopped',
      expert: { rating: 85, rationale: '백스톱과 공개를 같은 날 묶는 것이 정석이다.' },
    },
    {
      id: 'r-full-hold',
      label: '공개는 보류하고 담보부터 설정',
      resolvesTo: 'opt_c_silent',
      expert: { rating: 40, rationale: '백스톱을 쥐고도 침묵하면 소문만 키운다.' },
    },
  ],
}

const plainStep: DialogueStep<BankState> = {
  id: 'dlg-plain',
  lines: [{ speaker: '감독관', text: '백스톱이 부족합니다. 그래도 오늘 공개하시겠습니까?' }],
  replies: [
    {
      id: 'r-plain-announce',
      label: '손실과 증자 계획을 그대로 공개',
      resolvesTo: 'opt_b_unbackstopped',
      expert: { rating: 20, rationale: '백스톱 없는 공개는 증자 실패 가능성을 가시화한다.' },
      trap: true,
      trapExplanation: '백스톱 없이 공개하면 증자 실패 가능성이 런을 촉발한다.',
    },
    {
      id: 'r-plain-hold',
      label: '공개를 미루고 담보를 먼저 설정',
      resolvesTo: 'opt_c_silent',
      expert: { rating: 50, rationale: '담보 설정은 옳지만 침묵은 소문을 키운다.' },
    },
  ],
}

export const DIALOGUE_STEPS: DialogueStep<BankState>[] = [
  openStep,
  backstopStep,
  fullStep,
  plainStep,
]

/** The path the historical autoplay policy is expected to walk. */
export const HISTORICAL_PATH = ['r-exact', `${BACKSTOP_COUNTER}-50`, 'r-plain-announce']
/** The path the expert autoplay policy is expected to walk. */
export const EXPERT_PATH = ['r-exact', `${BACKSTOP_COUNTER}-100`, 'r-full-announce']

function withDialogue(decision: Decision<BankState>): Decision<BankState> {
  return {
    ...decision,
    steps: DIALOGUE_STEPS,
    options: decision.options.map((o) =>
      o.id !== 'opt_c_silent'
        ? o
        : {
            ...o,
            delayedEffects: [
              ...(o.delayedEffects ?? []),
              {
                afterTurns: 1,
                // The promise is judged *later*, by the counter the reply wrote — never by the
                // reply itself. This is the whole point of `commitReplies`.
                when: { counter: BACKSTOP_COUNTER, gte: 50 },
                description: '백스톱을 약속하고도 공개를 미룸 → 신뢰지수 −8',
                effects: [confidence(-8, '백스톱 약속 후 침묵')],
              },
            ],
          },
    ),
  }
}

/** `miniBank` whose T0 disclosure is reached through the supervisor conversation. */
export const miniDialogue: ScenarioDefinition<BankState> = {
  ...miniBank,
  meta: { ...miniBank.meta, id: 'mini-dialogue', title: '미니뱅크: 대화' },
  turns: miniBank.turns.map((t, i) =>
    i === 0 ? { ...t, decisions: t.decisions.map(withDialogue) } : t,
  ),
}

// ---------------------------------------------------------------- interrupt variant

const callSteps: DialogueStep<BankState>[] = [
  {
    id: 'call-open',
    lines: [{ speaker: '파운더스 파트너', text: '지금 자금을 빼야 합니까? 한 마디만 해주세요.' }],
    note: '전화 한 통도 기록에 남습니다.',
    replies: [
      {
        id: 'c-open-numbers',
        label: '먼저 확인 가능한 숫자부터 말하겠다',
        next: 'call-numbers',
        expert: { rating: 75, rationale: '검증 가능한 수치는 네트워크 증폭을 늦춘다.' },
      },
      {
        id: 'c-open-defer',
        label: '집계 후 회신하겠다',
        resolvesTo: 'call_defer',
        expert: { rating: 35, rationale: '침묵은 네트워크 예금자에게 최악의 신호로 읽힌다.' },
      },
    ],
  },
  {
    id: 'call-numbers',
    lines: [{ speaker: '파운더스 파트너', text: '좋습니다. 담보 여력이 얼마나 남아 있습니까?' }],
    replies: [
      {
        id: 'c-num-disclose',
        label: '당일 가용 담보 여력을 그대로 알려준다',
        resolvesTo: 'call_numbers',
        expert: { rating: 75, rationale: '숫자를 주면 파트너가 스스로 계산할 수 있다.' },
      },
      {
        id: 'c-num-vague',
        label: '"충분합니다"라고만 답한다',
        resolvesTo: 'call_defer',
        expert: { rating: 20, rationale: '수치 없는 안심은 침묵과 같이 읽힌다.' },
        trap: true,
        trapExplanation: '검증할 수 없는 안심은 오히려 인출을 앞당긴다.',
      },
    ],
  },
]

/** `miniTicks` whose mid-turn phone call is a two-step negotiation. */
export const miniDialogueInterrupt: ScenarioDefinition<BankState> = {
  ...miniTicks,
  meta: { ...miniTicks.meta, id: 'mini-dialogue-call', title: '미니뱅크: 통화 협상' },
  turns: miniTicks.turns.map((t, i) => {
    if (i !== TICKED_TURN_INDEX) return t
    return {
      ...t,
      interrupts: (t.interrupts ?? []).map((it) =>
        it.id === DIALOGUE_INTERRUPT_ID ? { ...it, steps: callSteps } : it,
      ),
    } as Turn<BankState>
  }),
}
