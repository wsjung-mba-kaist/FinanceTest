import { describe, expect, it } from 'vitest'
import { autoplay, getTurnView, replay, type ScenarioDefinition } from '@/engine'
import { informationReleased } from '@/engine/core/information'
import { liveInformationText, validateInformation } from '@/engine/validate/information'
import { previousTurnEntries, tickOfEntry } from '@/components/play/playHelpers'
import { observedTurnState } from '@/lib/observedTurn'
import svb from '@/scenarios/svb-2023/scenario'
import { BTFP_KNOWN_AT, SVB_EVENT_INFORMATION } from '@/scenarios/svb-2023/information'
import { asGeneric } from '../helpers/scenario'

const scenario = asGeneric(svb)
const played = autoplay(scenario, 'historical', { seed: 3, variance: 0 })
function at(turnIndex: number, tick = 0) {
  return replay(scenario, {
    seed: 3,
    variance: 0,
    turnIndex,
    tick,
    decisions: played.decisions.filter(
      (d) => d.turnIndex < turnIndex || (d.turnIndex === turnIndex && (d.tick ?? 0) < tick),
    ),
  })
}

describe('SVB information release boundaries', () => {
  it('covers every event and validates its delivery time, clock and embargo', () => {
    expect(scenario.turns.flatMap((t) => t.events.map((e) => e.id)).sort()).toEqual(
      Object.keys(SVB_EVENT_INFORMATION).sort(),
    )
    expect(validateInformation(scenario)).toEqual([])
  })

  it.each([
    [3, 't3-news-founders', 1, 2],
    [3, 't3-memo-wires', 2, 3],
    [4, 't4-memo-fed-account', 1, 2],
  ] as const)(
    'holds %s/%s until the displayed clock reaches its delivery',
    (turnIndex, id, before, after) => {
      const { state } = at(turnIndex)
      const base = { ...state, tickSchedule: { ...state.tickSchedule, [id]: 0 } }
      const early = getTurnView({ ...base, tick: before }, scenario, { mode: 'expert' })
      const due = getTurnView({ ...base, tick: after }, scenario, { mode: 'expert' })
      expect(early.events.some((e) => e.id === id)).toBe(false)
      expect(due.events.some((e) => e.id === id)).toBe(true)
      const event = due.events.find((e) => e.id === id)!
      expect(tickOfEntry({ id, turnIndex, event }, base, scenario.turns[turnIndex])).toBe(after)
      expect(base.rng).toBe(state.rng)
    },
  )

  it('keeps both the random arrival schedule and the public release floor', () => {
    const { state } = at(4)
    const id = 't4-market'
    expect(
      getTurnView({ ...state, tick: 0, tickSchedule: { [id]: 0 } }, scenario).events.some(
        (e) => e.id === id,
      ),
    ).toBe(false)
    expect(
      getTurnView({ ...state, tick: 1, tickSchedule: { [id]: 4 } }, scenario).events.some(
        (e) => e.id === id,
      ),
    ).toBe(false)
    expect(
      getTurnView({ ...state, tick: 4, tickSchedule: { [id]: 4 } }, scenario).events.some(
        (e) => e.id === id,
      ),
    ).toBe(true)
  })

  it('uses EDT for the BTFP announcement and withholds malformed or premature information', () => {
    expect(Date.parse(BTFP_KNOWN_AT)).toBe(Date.UTC(2023, 2, 12, 22, 15))
    const turn = scenario.turns[7]!
    const info = SVB_EVENT_INFORMATION['t7-news-sre']!
    expect(informationReleased({ ...turn, time: '2023-03-12T18:14:59-04:00' }, 0, info)).toBe(false)
    expect(informationReleased({ ...turn, time: BTFP_KNOWN_AT }, 0, info)).toBe(true)
    expect(informationReleased(turn, 0, { ...info, knownAt: '2023-03-12T18:15:00' })).toBe(false)
    expect(Date.parse(turn.time!)).toBeGreaterThanOrEqual(
      Date.parse(SVB_EVENT_INFORMATION['t7-call-fed']!.knownAt),
    )
  })

  it('rejects early policy terms in decisions but allows deferred teaching text', () => {
    const change = (key: 'description' | 'expert'): ScenarioDefinition => ({
      ...scenario,
      turns: scenario.turns.map((t, i) =>
        i
          ? t
          : {
              ...t,
              decisions: t.decisions.map((d) => ({
                ...d,
                options: d.options.map((o, j) =>
                  j
                    ? o
                    : {
                        ...o,
                        ...(key === 'description'
                          ? { description: 'BTFP를 지금 신청한다' }
                          : { expert: { ...o.expert, rationale: 'BTFP는 이후에 도입됐다' } }),
                      },
                ),
              })),
            },
      ),
    })
    expect(
      validateInformation(change('description')).some((e) => e.message.includes('공개 전 용어')),
    ).toBe(true)
    expect(validateInformation(change('expert'))).toEqual([])
  })

  it('rejects unreachable releases and ambiguous clocks', () => {
    const invalid = {
      ...scenario,
      turns: scenario.turns.map((t, i) =>
        i !== 3
          ? t
          : {
              ...t,
              tickTimes: undefined,
              events: t.events.map((e) => ({
                ...e,
                information: { ...e.information!, knownAt: '2023-03-20T09:00:00-07:00' },
              })),
            },
      ),
    }
    const issues = validateInformation(invalid)
    expect(issues.some((i) => i.message.includes('구간 끝보다'))).toBe(true)
    expect(issues.some((i) => i.message.includes('tickTimes'))).toBe(true)
  })

  it('retains later arrivals in previous-turn review and after replay', () => {
    const { state, history } = at(5)
    const entries = previousTurnEntries(history, state, scenario, 'expert')
    expect(
      entries.find((e) => e.turnIndex === 3)!.entries.some((e) => e.event?.id === 't3-memo-wires'),
    ).toBe(true)
    expect(entries.flatMap((e) => e.entries).some((e) => e.event?.id === 't7-news-sre')).toBe(false)
    const prior = observedTurnState(scenario, state, history, 3, 'expert')!
    expect(prior.tick).toBe(4)
    const restored = replay(scenario, {
      seed: 3,
      variance: 0,
      decisions: JSON.parse(JSON.stringify(state.decisions)),
      turnIndex: 5,
      tick: 0,
    })
    expect(previousTurnEntries(restored.history, restored.state, scenario, 'expert')).toEqual(
      entries,
    )
  })

  it('moves late historical facts out of live copy and marks the Monday market as a model stress', () => {
    const friday = liveInformationText(scenario.turns[6]!.events)
    const monday = liveInformationText(scenario.turns[8]!.events)
    expect(friday).not.toMatch(/18\.6|거래를 정지했다/)
    expect(monday).not.toMatch(/퍼스트리퍼블릭 −62%|하루 60bp 급락했다/)
    expect(
      scenario.turns[8]!.events.find((e) => e.id === 't8-market')!.information!.note,
    ).toContain('모의 스트레스')
    expect(scenario.debrief.historical.timeline.find((t) => t.turnId === 't8')!.note).toContain(
      'FRC −62%',
    )
  })
})
