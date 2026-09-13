import type { BankState, EventInformation, Turn } from '../../engine/types'

/** Public release verified against the Fed's March 12 press release (6:15 p.m. EDT). */
export const BTFP_KNOWN_AT = '2023-03-12T18:15:00-04:00'

// These are delivery times in the exercise, not claimed timestamps of real calls or memos.
const times: Record<string, string> = {
  't0-news-10k': '2023-02-27T08:40:00-08:00',
  't0-market': '2023-02-27T09:00:00-08:00',
  't0-memo-treasury': '2023-02-27T09:00:00-08:00',
  't0-call-moodys': '2023-02-27T09:00:00-08:00',
  't0-memo-gs': '2023-02-27T09:00:00-08:00',
  't1-news-powell': '2023-03-08T05:30:00-08:00',
  't1-news-silvergate': '2023-03-08T06:00:00-08:00',
  't1-memo-execution': '2023-03-08T06:00:00-08:00',
  't1-memo-collateral-ok': '2023-03-08T06:00:00-08:00',
  't2-news-silvergate': '2023-03-08T16:05:00-08:00',
  't2-news-pvb': '2023-03-08T16:20:00-08:00',
  't2-news-quiet': '2023-03-08T16:20:00-08:00',
  't2-memo-clients': '2023-03-08T16:30:00-08:00',
  't2-data-book': '2023-03-08T16:30:00-08:00',
  't3-market-open': '2023-03-09T06:30:00-08:00',
  't3-news-founders': '2023-03-09T08:15:00-08:00',
  't3-memo-wires': '2023-03-09T09:30:00-08:00',
  't3-dialogue-gs': '2023-03-09T10:00:00-08:00',
  't4-market': '2023-03-09T13:00:00-08:00',
  't4-news-network': '2023-03-09T11:40:00-08:00',
  't4-memo-fed-account': '2023-03-09T13:10:00-08:00',
  't4-memo-gs-fail': '2023-03-09T13:30:00-08:00',
  't5-memo-close': '2023-03-09T17:00:00-08:00',
  't5-call-dfpi-cold': '2023-03-09T17:00:00-08:00',
  't5-news-raise-fail': '2023-03-09T18:20:00-08:00',
  't5-board': '2023-03-09T19:00:00-08:00',
  't6-data-queue': '2023-03-10T05:00:00-08:00',
  't6-news-halt': '2023-03-10T05:00:00-08:00',
  't6-memo-onsite': '2023-03-10T05:00:00-08:00',
  't6-news-signature': '2023-03-10T05:00:00-08:00',
  't7-news-sre': BTFP_KNOWN_AT,
  't7-memo-btfp': '2023-03-12T20:00:00-04:00',
  't7-call-fed': '2023-03-12T21:00:00-04:00',
  't8-news-frc': '2023-03-13T06:00:00-07:00',
  't8-market': '2023-03-13T06:00:00-07:00',
}

export const SVB_EVENT_INFORMATION: Record<string, EventInformation> = Object.fromEntries(
  Object.entries(times).map(([id, knownAt]) => [
    id,
    {
      knownAt,
      basis: id === 't7-news-sre' ? 'public' : 'reconstructed',
      ...(id === 't8-market'
        ? { note: '시장 수치는 모의 스트레스 가정이며, 이 시각에 관측된 실제 시세가 아닙니다.' }
        : {}),
    },
  ]),
)

/** Optional metadata only: effect functions, decisions and numerical calibration stay intact. */
export function withSvbInformation(turns: Turn<BankState>[]): Turn<BankState>[] {
  return turns.map((turn) => ({
    ...turn,
    ...(turn.tickLabels
      ? {
          tickTimes: turn.tickLabels.map(
            (clock) => `${turn.time!.slice(0, 10)}T${clock}:00${turn.time!.slice(-6)}`,
          ),
        }
      : {}),
    events: turn.events.map((event) => ({
      ...event,
      information: SVB_EVENT_INFORMATION[event.id],
    })),
  }))
}
