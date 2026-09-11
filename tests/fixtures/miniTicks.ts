/**
 * `miniBank` with its T1 turned into a three-tick intraday turn. It exercises every L2 feature:
 * a run-off profile, `tickEffects`, a ticker series, a scheduled event, an interrupt and a
 * decision with `availableFrom` / `deadlineTick`.
 *
 * Everything added here is deliberately **run-off neutral** (counters, feed items, `market.volIndex`,
 * `market.ownStock`, `market.govt2yBp`), so the per-tick slices still sum exactly to `miniBank`'s
 * single `runoffStep` — except `e1_rumor`, which only fires on the `silent` branch and is scheduled
 * at tick 1 so the amplifier it sets applies to the remaining slice and resets on the last tick.
 */
import type { BankState, Interrupt, ScenarioDefinition, Turn } from '@/engine'
import { bankFx } from '@/engine/fx/bank'
import { counter, feed, flag } from '@/engine/fx/common'
import { miniBank } from './miniBank'

/** Intraday distribution of the T1 window (sums to 1). */
export const TICK_PROFILE = [0.5, 0.3, 0.2]
export const TICKED_TURN_INDEX = 1
export const TICKS = 3

const deskDecision: Turn<BankState>['decisions'][number] = {
  id: 'd1_desk',
  title: '결제데스크 보고',
  prompt: '정오 결제 데스크 보고를 어떻게 처리할 것인가?',
  required: false,
  availableFrom: 1,
  deadlineTick: 1,
  defaultOptionId: 'desk_hold',
  dimensions: ['communication'],
  options: [
    {
      id: 'desk_report',
      label: '유출 현황을 채널별로 즉시 공유',
      description: '감독·언론·시장 채널에 같은 수치를 동시에 공유한다.',
      effects: [
        feed('감독당국 문의', '유출 수치 확인 요청이 들어왔다.', 'info', 'regulator'),
        feed('언론 문의', '기자단이 오후 마감 전 확인을 요청했다.', 'info', 'press'),
        feed('시장 반응', '호가 스프레드가 벌어졌다.', 'info', 'market'),
        counter('deskReports', 1),
      ],
      expert: { rating: 70, rationale: '같은 수치를 동시에 배포하면 채널 간 불일치가 사라진다.' },
      consequences: '세 채널에 동일한 수치가 전달되었다.',
      historical: true,
    },
    {
      id: 'desk_hold',
      label: '마감 후 일괄 보고',
      description: '마감 집계가 끝난 뒤 한 번에 보고한다.',
      effects: [counter('deskHeld', 1)],
      expert: { rating: 40, rationale: '집계 지연은 채널별 추측을 키운다.' },
      consequences: '보고가 마감 이후로 미뤄졌다.',
      trap: true,
      trapExplanation: '정보 공백은 예금자·언론이 최악을 가정하게 만든다.',
    },
  ],
}

const partnerCall: Interrupt<BankState> = {
  id: 'i1_partner_call',
  interrupt: true,
  atTick: 1,
  deadlineTick: 1,
  timeoutSec: 30,
  defaultOptionId: 'call_defer',
  scoreWeight: 0.5,
  required: false,
  title: '대형 예금자 전화',
  prompt: '파트너가 지금 자금 안전성을 묻습니다. 어떻게 답하겠습니까?',
  source: { kind: 'call', caller: '파운더스 파트너', tone: 'urgent' },
  lines: [{ speaker: '파운더스 파트너', text: '지금 자금을 빼야 합니까? 30초 안에 답해주세요.' }],
  dimensions: ['communication'],
  options: [
    {
      id: 'call_numbers',
      label: '검증 가능한 여력 수치를 제시',
      description: '담보 여력과 무보험 예금 비중을 숫자로 답한다.',
      effects: [counter('callNumbers', 1), flag('call_answered')],
      expert: { rating: 75, rationale: '검증 가능한 수치는 네트워크 증폭을 늦춘다.' },
      consequences: '파트너가 수치를 확인하고 인출 권고를 보류했다.',
    },
    {
      id: 'call_defer',
      label: '회신 보류',
      description: '집계 후 회신하겠다고 답한다.',
      effects: [counter('callDeferred', 1)],
      expert: { rating: 35, rationale: '침묵은 네트워크 예금자에게 최악의 신호로 읽힌다.' },
      consequences: '파트너가 답을 얻지 못한 채 전화를 끊었다.',
      historical: true,
    },
  ],
}

function tickedTurn(turn: Turn<BankState>): Turn<BankState> {
  return {
    ...turn,
    ticks: TICKS,
    tickLabels: ['08:00', '10:00', '12:00'],
    // the run-off moves from `entryEffects` to `eachTick`, sliced by the intraday profile
    entryEffects: (turn.entryEffects ?? []).filter((e) => e.id !== 'x1_runoff'),
    eachTick: [
      {
        id: 'x1_runoff_tick',
        effects: [bankFx.runoffStep({ windowFraction: 1, profile: TICK_PROFILE })],
        description: '1일차 예금 유출',
      },
    ],
    tickEffects: [
      {
        id: 'x1_midday_vol',
        atTick: 1,
        effects: [{ kind: 'op', path: 'market.volIndex', op: 'add', value: 5 }],
        description: '정오 변동성 상승',
      },
    ],
    ticker: {
      series: [
        { path: 'market.ownStock', mode: 'relative', values: [100, 97, 92] },
        { path: 'market.govt2yBp', mode: 'absolute', values: [0, -6, -15] },
      ],
    },
    events: turn.events.map((e) => (e.id === 'e1_rumor' ? { ...e, atTick: 1 } : e)),
    decisions: [...turn.decisions, deskDecision],
    interrupts: [partnerCall],
  }
}

export const miniTicks: ScenarioDefinition<BankState> = {
  ...miniBank,
  meta: { ...miniBank.meta, id: 'mini-ticks', title: '미니뱅크: 틱' },
  noise: { runoffSigma: 0.15, runoffCap: 0.3, tickerSigma: 0.01, tickerSigmaBp: 2, eventJitter: 1 },
  turns: miniBank.turns.map((t, i) => (i === TICKED_TURN_INDEX ? tickedTurn(t) : t)),
}

/** Same scenario with a very long turn, to exercise the `tickHistory` cap. */
export const miniManyTicks: ScenarioDefinition<BankState> = {
  ...miniTicks,
  meta: { ...miniTicks.meta, id: 'mini-ticks-long' },
  turns: miniTicks.turns.map((t, i) => (i === TICKED_TURN_INDEX ? { ...t, ticks: 300 } : t)),
}
