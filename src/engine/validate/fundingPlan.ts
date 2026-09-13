import type { FundingTime, ScenarioDefinition } from '../types'
import { tickCount } from '../core/lookup'
import type { IntegrityIssue } from './scenarioIntegrity'

export function validateFundingPlan(
  scenario: ScenarioDefinition,
  sourceIds: Set<string>,
): IntegrityIssue[] {
  const plan = scenario.fundingPlan
  if (!plan) return []
  const issues: IntegrityIssue[] = []
  const error = (where: string, message: string) =>
    issues.push({ level: 'error', rule: 'funding-plan', where: `fundingPlan.${where}`, message })
  if (scenario.initialState.institution.kind !== 'bank')
    error('institution', '은행 상태가 필요합니다')
  const refs = (ids: string[], where: string) => {
    if (!ids.length) error(where, '근거 출처가 필요합니다')
    for (const id of ids) if (!sourceIds.has(id)) error(where, `알 수 없는 출처: ${id}`)
  }
  const point = (at: FundingTime, where: string): number => {
    const index = scenario.turns.findIndex((t) => t.id === at.turnId)
    const turn = scenario.turns[index]
    if (!turn || !Number.isInteger(at.tick) || at.tick < 0 || at.tick >= tickCount(turn)) {
      error(where, '존재하는 구간·시점이 필요합니다')
      return NaN
    }
    return scenario.turns.slice(0, index).reduce((sum, t) => sum + tickCount(t), 0) + at.tick
  }
  const windows = new Set<string>()
  for (const w of plan.windows) {
    const where = `windows(${w.turnId})`
    if (windows.has(w.turnId)) error(where, '구간별 추정은 한 번만 정의합니다')
    windows.add(w.turnId)
    const turn = scenario.turns.find((t) => t.id === w.turnId)
    const batch = turn?.eachTick?.find((e) => e.id === w.effectId)
    const runoff = batch?.effects.filter((e) => e.kind === 'fn' && e.name === 'runoffStep')
    if (!turn || !batch || batch.when || runoff?.length !== 1)
      error(where, '무조건 실행되는 eachTick의 단일 runoffStep을 참조해야 합니다')
    const effect = runoff?.[0]
    if (effect?.kind === 'fn') {
      const fraction = effect.params?.windowFraction ?? 1
      if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0)
        error(where, '유효한 구간 비율이 필요합니다')
      const profile = effect.params?.profile
      if (typeof profile === 'string') {
        const shares = profile.split('/').map(Number)
        if (
          shares.length !== tickCount(turn) ||
          shares.some((x) => !Number.isFinite(x) || x < 0) ||
          Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 1e-6
        )
          error(where, '시간 배분은 유한한 음이 아닌 값이며 합계가 1이어야 합니다')
      }
    }
    if (!w.assumption.trim()) error(where, '추정 가정을 명시해야 합니다')
    refs(w.sourceRefs, where)
  }
  const pending = plan.pendingCapacity
  point(pending.at, 'pendingCapacity.at')
  const settlement = scenario.turns
    .find((t) => t.id === pending.at.turnId)
    ?.entryEffects?.find((e) => e.id === pending.effectId)
  if (
    pending.at.tick !== 0 ||
    !settlement ||
    settlement.when ||
    !settlement.effects.some((e) => e.kind === 'fn' && e.name === 'settlePendingCapacity')
  )
    error('pendingCapacity', '실제 한도 반영 entryEffects와 시점이 일치해야 합니다')
  if (!pending.condition.trim()) error('pendingCapacity', '현금 사용 조건이 필요합니다')
  refs(pending.sourceRefs, 'pendingCapacity')
  const ids = new Set<string>()
  for (const c of plan.checkpoints) {
    const where = `checkpoints(${c.id})`
    if (ids.has(c.id)) error(where, '중복 점검 id')
    ids.add(c.id)
    const known = point(c.knownFrom, where)
    const at = point(c.at, where)
    const balance = point(c.balanceAt, where)
    if (known > at || balance > at)
      error(where, '공개 시점·잔고 기준은 점검 시점보다 늦을 수 없습니다')
    if (!c.title.trim() || !c.note.trim()) error(where, '점검 제목과 근거 설명이 필요합니다')
    refs(c.sourceRefs, where)
  }
  return issues
}
