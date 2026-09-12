import { describe, expect, it } from 'vitest'
import type { GameEvent, InstitutionState, ScenarioDefinition } from '@/engine/types'
import { loadAvailableScenariosSafe } from '../helpers/load'

/**
 * A rumour that is never answered.
 *
 * `reliability: 'unconfirmed'` and `correctionOf` were built together — the feed renders a
 * 미확인 정보 badge on one and a 정정 line on the other — but only the first half was ever
 * authored. Twelve rumours across nine scenarios were raised and left hanging, which teaches the
 * player the wrong lesson twice over: that unverified claims simply fade, and that the way to
 * handle one is to wait.
 *
 * History resolved most of them, and not always downwards. The Bloomberg wire's $2bn usable
 * reserves was wrong — and far closer to the truth than the official $28bn. "내일 문 닫는다" was
 * unverified the night before two of the five closed. One resolves to nothing at all: the ELS
 * margin-call total was never published and still has not been, which is itself the lesson.
 *
 * This is a ratchet rather than a rule: a scenario may legitimately raise a rumour it never
 * answers (noise the player must learn to discount), so the count of unanswered ones may only go
 * down. Each number below is the record of how far the authoring has got.
 */
const registry = await loadAvailableScenariosSafe()

function eventsOf(s: ScenarioDefinition<InstitutionState>): GameEvent<InstitutionState>[] {
  return s.turns.flatMap((t) => [
    ...t.events,
    ...(t.interrupts ?? []).flatMap(() => [] as GameEvent<InstitutionState>[]),
  ])
}

/**
 * Rumours a scenario raises and never answers, by scenario id. A missing entry means zero — and
 * the map is now empty, which is the point: every unverified item a player is shown eventually
 * gets an answer, and the answers do not all run the same way.
 *
 * Keep the map rather than deleting it. A scenario may legitimately raise a rumour it never
 * resolves (noise the player has to learn to discount), and when that day comes the number goes
 * here with a sentence saying why, instead of the guardrail being deleted to make room for it.
 */
const UNANSWERED: Record<string, number> = {}

describe.skipIf(registry.length === 0)('rumour corrections', () => {
  it.each(registry.map((s) => [s.meta.id, s] as const))('%s', (id, scenario) => {
    const events = eventsOf(scenario)
    const corrected = new Set(
      events.map((e) => e.correctionOf).filter((x): x is string => Boolean(x)),
    )
    const unanswered = events
      .filter((e) => e.reliability === 'unconfirmed' && !corrected.has(e.id))
      .map((e) => e.id)

    const max = UNANSWERED[id] ?? 0
    expect(
      unanswered.length,
      unanswered.length > max
        ? `«${id}» 답을 받지 못한 루머가 ${max} → ${unanswered.length} 로 늘었습니다: ${unanswered.join(', ')}`
        : `«${id}» 답을 받지 못한 루머가 ${max} → ${unanswered.length} 로 줄었습니다 — UNANSWERED 를 ${unanswered.length} 로 내리세요`,
    ).toBe(max)
  })

  it('every correction points at an event that exists and is actually unverified', () => {
    const problems: string[] = []
    for (const scenario of registry) {
      const events = eventsOf(scenario)
      const byId = new Map(events.map((e) => [e.id, e]))
      for (const e of events) {
        if (!e.correctionOf) continue
        const target = byId.get(e.correctionOf)
        if (!target) {
          problems.push(`${scenario.meta.id}/${e.id} → 대상 없음: ${e.correctionOf}`)
          continue
        }
        // Correcting a confirmed item would tell the player the app had been lying to them.
        if (target.reliability !== 'unconfirmed' && target.reliability !== 'false')
          problems.push(
            `${scenario.meta.id}/${e.id} → ${e.correctionOf} 은 미확인 정보가 아닙니다 (${target.reliability ?? 'confirmed'})`,
          )
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('never corrects an item before the player has seen it', () => {
    /**
     * A correction must land *after* the rumour in feed order, not merely on a later turn.
     *
     * Same-turn is legitimate and sometimes the only truthful option: LTCM's outside offer
     * arrived at 10:05 and lapsed at 12:30 on one morning, so the memo recording its expiry
     * belongs to the same turn as the wire that announced it. What must never happen is the
     * answer reaching the feed first — then the player never got to act on the unverified
     * version, which is the entire point of showing one.
     */
    type Position = [turn: number, tick: number, time: string]
    const positionOf = (turn: number, e: GameEvent<InstitutionState>): Position => [
      turn,
      e.atTick ?? 0,
      e.time ?? '',
    ]
    const HHMM = /^\d{1,2}:\d{2}$/
    const isBefore = (a: Position, b: Position): boolean => {
      if (a[0] !== b[0]) return a[0] < b[0]
      if (a[1] !== b[1]) return a[1] < b[1]
      // Same turn and tick: only `HH:MM` labels can be ordered, and only against each other.
      // Anything else (`11/10 09:00`, absent) is treated as simultaneous rather than inventing
      // a violation out of a label this test cannot parse.
      if (HHMM.test(a[2]) && HHMM.test(b[2])) return a[2] < b[2]
      return true
    }

    const problems: string[] = []
    for (const scenario of registry) {
      const at = new Map<string, Position>()
      scenario.turns.forEach((t, i) => t.events.forEach((e) => at.set(e.id, positionOf(i, e))))
      scenario.turns.forEach((t, i) =>
        t.events.forEach((e) => {
          if (!e.correctionOf) return
          const target = at.get(e.correctionOf)
          if (!target) return
          const here = positionOf(i, e)
          if (!isBefore(target, here))
            problems.push(
              `${scenario.meta.id}/${e.id}: 정정이 원 보도보다 앞섭니다 ` +
                `(원 보도 T${target[0]}·tick${target[1]}·${target[2] || '—'} → ` +
                `정정 T${here[0]}·tick${here[1]}·${here[2] || '—'})`,
            )
        }),
      )
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
})
