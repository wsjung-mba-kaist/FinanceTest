import type { Condition, ConditionContext, GameState } from '../types'
import { getNumberPath } from './paths'

interface Cmp {
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  eq?: number
}

function compare(v: number, c: Cmp): boolean {
  if (c.lt !== undefined && !(v < c.lt)) return false
  if (c.lte !== undefined && !(v <= c.lte)) return false
  if (c.gt !== undefined && !(v > c.gt)) return false
  if (c.gte !== undefined && !(v >= c.gte)) return false
  if (c.eq !== undefined && !(v === c.eq)) return false
  return true
}

/** Undefined condition ⇒ true. */
export function evaluate(cond: Condition | undefined, ctx: ConditionContext): boolean {
  if (!cond) return true
  if ('flag' in cond) {
    const v = ctx.flags[cond.flag]
    return cond.is === undefined ? Boolean(v) : v === cond.is
  }
  if ('notFlag' in cond) return !ctx.flags[cond.notFlag]
  if ('metric' in cond) {
    const n = cond.consecutiveTurns ?? 1
    if (n <= 1) {
      const v = ctx.metric(cond.metric)
      return v !== undefined && compare(v, cond)
    }
    const hist = ctx.metricHistory(cond.metric)
    if (hist.length < n) return false
    return hist.slice(0, n).every((v) => compare(v, cond))
  }
  if ('counter' in cond) return compare(ctx.counters[cond.counter] ?? 0, cond)
  if ('path' in cond) {
    const v = ctx.path(cond.path)
    return v !== undefined && compare(v, cond)
  }
  if ('chose' in cond) return ctx.chose(cond.chose.decision, cond.chose.option)
  if ('notChose' in cond) return !ctx.chose(cond.notChose.decision, cond.notChose.option)
  if ('turn' in cond) return compare(ctx.turnIndex, cond.turn)
  if ('regulator' in cond) return compare(ctx.regulatorLevel, cond.regulator)
  if ('confidence' in cond) return compare(ctx.confidence, cond.confidence)
  if ('all' in cond) return cond.all.every((c) => evaluate(c, ctx))
  if ('any' in cond) return cond.any.some((c) => evaluate(c, ctx))
  if ('not' in cond) return !evaluate(cond.not, ctx)
  if ('fn' in cond) return cond.fn(ctx)
  return false
}

/** Builds a read-only condition context from a state (or an immer draft). */
export function buildConditionContext(state: GameState): ConditionContext {
  const latest = state.metricsHistory[state.metricsHistory.length - 1]
  return {
    turnIndex: state.turnIndex,
    flags: state.flags,
    counters: state.counters,
    // Finiteness only — **never** `status`. `status` is a display concept: `statusFor` returns 'na'
    // for any metric without a threshold band, and filtering on it here silently made every
    // condition on such a metric false. A scenario that routes a value through `institution.custom`
    // and reads it from a game-over rule, an ending or a scoring component must still see it.
    metric: (key) => {
      const m = latest?.metrics[key]
      if (!m || !Number.isFinite(m.value)) return undefined
      return m.value
    },
    metricHistory: (key) => {
      const out: number[] = []
      for (let i = state.metricsHistory.length - 1; i >= 0; i--) {
        const m = state.metricsHistory[i]!.metrics[key]
        if (m && Number.isFinite(m.value)) out.push(m.value)
      }
      return out
    },
    path: (p) => getNumberPath(state, p),
    chose: (decisionId, optionId) =>
      state.decisions.some(
        (r) =>
          r.decisionId === decisionId &&
          (Array.isArray(optionId)
            ? optionId.some((o) => r.optionIds.includes(o))
            : r.optionIds.includes(optionId)),
      ),
    regulatorLevel: state.regulator.level,
    confidence: state.confidence.index,
  }
}

/** Human-readable description of a condition (for debrief branch explanations and the DEV inspector). */
export function describeCondition(cond: Condition | undefined): string {
  if (!cond) return '항상'
  if ('flag' in cond)
    return cond.is === undefined
      ? `플래그 ${cond.flag}`
      : `플래그 ${cond.flag} = ${String(cond.is)}`
  if ('notFlag' in cond) return `플래그 ${cond.notFlag} 없음`
  if ('metric' in cond)
    return `지표 ${cond.metric} ${cmpText(cond)}${cond.consecutiveTurns ? ` (${cond.consecutiveTurns}턴 연속)` : ''}`
  if ('counter' in cond) return `카운터 ${cond.counter} ${cmpText(cond)}`
  if ('path' in cond) return `${cond.path} ${cmpText(cond)}`
  if ('chose' in cond)
    return `결정 ${cond.chose.decision}에서 ${[cond.chose.option].flat().join('/')} 선택`
  if ('notChose' in cond)
    return `결정 ${cond.notChose.decision}에서 ${[cond.notChose.option].flat().join('/')} 미선택`
  if ('turn' in cond) return `턴 ${cmpText(cond.turn)}`
  if ('regulator' in cond) return `감독당국 단계 ${cmpText(cond.regulator)}`
  if ('confidence' in cond) return `신뢰지수 ${cmpText(cond.confidence)}`
  if ('all' in cond) return cond.all.map(describeCondition).join(' 그리고 ')
  if ('any' in cond) return cond.any.map(describeCondition).join(' 또는 ')
  if ('not' in cond) return `NOT(${describeCondition(cond.not)})`
  if ('fn' in cond) return cond.label
  return '?'
}

function cmpText(c: Cmp): string {
  const parts: string[] = []
  if (c.lt !== undefined) parts.push(`< ${c.lt}`)
  if (c.lte !== undefined) parts.push(`≤ ${c.lte}`)
  if (c.gt !== undefined) parts.push(`> ${c.gt}`)
  if (c.gte !== undefined) parts.push(`≥ ${c.gte}`)
  if (c.eq !== undefined) parts.push(`= ${c.eq}`)
  return parts.join(', ')
}
