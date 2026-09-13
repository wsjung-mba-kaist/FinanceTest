import type { ScenarioDefinition, Turn } from '../types'
import { tickCount } from '../core/lookup'
import { informationTime, isInformationTimestamp as timestamp } from '../core/information'
import { DEFAULT_NOISE } from '../core/noise'
import type { IntegrityIssue } from './scenarioIntegrity'

/** Fields rendered during expert play. Deferred teaching/effect internals are intentionally excluded. */
const deferred = new Set([
  'expert',
  'calibrationNote',
  'trapExplanation',
  'effects',
  'delayedEffects',
  'preview',
  'sourceRefs',
  'cardRefs',
  'requiredConcepts',
  'relatedCards',
  'when',
  'requires',
  'information',
])
export function liveInformationText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(liveInformationText).join('\n')
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value)
    .filter(([key]) => !deferred.has(key))
    .map(([, v]) => liveInformationText(v))
    .join('\n')
}

export function validateInformation(scenario: ScenarioDefinition): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  const error = (where: string, message: string) =>
    issues.push({ level: 'error', rule: 'information-release', where, message })
  const sources = new Set(scenario.meta.sources.map((s) => s.id))
  for (const rule of scenario.informationEmbargoes ?? []) {
    if (
      !timestamp(rule.knownAt) ||
      !rule.terms.length ||
      rule.terms.some((t) => !t.trim()) ||
      !rule.sourceRefs.length ||
      rule.sourceRefs.some((s) => !sources.has(s))
    )
      error('informationEmbargoes', '공개 시각·용어·근거 출처가 필요합니다')
  }
  for (const turn of scenario.turns) {
    const where = `turns(${turn.id})`
    if (turn.tickTimes) {
      if (turn.tickTimes.length !== tickCount(turn) || turn.tickTimes.some((t) => !timestamp(t)))
        error(where, '모든 틱에 시간대가 있는 유효한 시각이 필요합니다')
      if (Date.parse(turn.tickTimes[0] ?? '') !== Date.parse(turn.time ?? ''))
        error(where, '첫 틱 시각은 구간 시작 시각과 일치해야 합니다')
      if (
        turn.tickTimes.some((t, i) => i > 0 && Date.parse(t) <= Date.parse(turn.tickTimes![i - 1]!))
      )
        error(where, '틱 시각은 순서대로 증가해야 합니다')
    }
    for (const rule of scenario.informationEmbargoes ?? []) {
      const until = Date.parse(rule.knownAt)
      const check = (value: unknown, now: number, path: string) => {
        const text = liveInformationText(value).toLocaleLowerCase()
        if (
          (!Number.isFinite(now) || now < until) &&
          rule.terms.some((term) => text.includes(term.toLocaleLowerCase()))
        )
          error(path, '공개 전 용어가 플레이 본문에 포함되어 있습니다')
      }
      check(turn.title, informationTime(turn as Turn, 0), where)
      for (const decision of [...turn.decisions, ...(turn.interrupts ?? [])]) {
        const tick = 'atTick' in decision ? Number(decision.atTick) : (decision.availableFrom ?? 0)
        check(decision, informationTime(turn as Turn, tick), `${where}.decisions(${decision.id})`)
      }
      for (const event of turn.events) {
        const known = event.information
          ? Date.parse(event.information.knownAt)
          : informationTime(turn as Turn, event.atTick ?? 0)
        check(event, known, `${where}.events(${event.id})`)
      }
    }
    for (const event of turn.events) {
      const info = event.information
      if (!info) continue
      const at = `${where}.events(${event.id})`
      if (!timestamp(info.knownAt) || !timestamp(turn.time)) {
        error(at, 'knownAt과 구간 시각에 명시적 시간대가 필요합니다')
        continue
      }
      if (tickCount(turn) > 1 && !turn.tickTimes)
        error(at, '일중 공개 시점 검증에 tickTimes가 필요합니다')
      if (Date.parse(info.knownAt) > informationTime(turn as Turn, tickCount(turn) - 1))
        error(at, '공개 시점이 구간 끝보다 늦어 소식을 읽을 수 없습니다')
      // The view has an independent embargo floor, but effects must never run before that floor.
      const earliest = Math.max(
        0,
        (event.atTick ?? 0) -
          (event.jitter ?? scenario.noise?.eventJitter ?? DEFAULT_NOISE.eventJitter),
      )
      if (
        event.effects?.length &&
        Date.parse(info.knownAt) > informationTime(turn as Turn, earliest)
      )
        error(at, '공개 전에 실행될 수 있는 이벤트 효과를 늦추세요')
      if (info.basis === 'public' && !event.sourceRefs?.length)
        error(at, '공개 자료에 출처가 필요합니다')
    }
  }
  return issues
}
