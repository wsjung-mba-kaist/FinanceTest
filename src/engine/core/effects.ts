import type { Draft } from 'immer'
import type {
  Effect,
  EffectContext,
  GameState,
  InstitutionState,
  MetricSnapshot,
  RegulatorLevel,
} from '../types'
import { clamp, getNumberPath, setNumberPath } from './paths'
import { rngNext } from './rng'

export const EMPTY_SNAPSHOT: MetricSnapshot = { turnIndex: -1, metrics: {} }

/** Builds an effect context bound to an immer draft; rng advances `draft.rng` deterministically. */
export function makeEffectContext<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  metrics: MetricSnapshot,
): EffectContext {
  return {
    turnIndex: draft.turnIndex,
    rng: () => {
      const r = rngNext(draft.rng)
      draft.rng = r.next
      return r.value
    },
    metrics,
    flags: draft.flags,
    log: (msg) => {
      draft.log.push(`[T${draft.turnIndex}] ${msg}`)
    },
  }
}

export function setFlag<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  key: string,
  value: boolean | number | string,
): void {
  draft.flags[key] = value
  if (value !== false && draft.flagTurns[key] === undefined) draft.flagTurns[key] = draft.turnIndex
}

export function applyEffects<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  effects: Effect<S>[],
  ctx: EffectContext,
  cause?: { decisionId: string; optionId: string },
): void {
  for (const e of effects) applyEffect(draft, e, ctx, cause)
}

function applyEffect<S extends InstitutionState>(
  draft: Draft<GameState<S>>,
  e: Effect<S>,
  ctx: EffectContext,
  cause?: { decisionId: string; optionId: string },
): void {
  switch (e.kind) {
    case 'op': {
      const cur = getNumberPath(draft, e.path)
      if (cur === undefined) {
        ctx.log(`[warn] 알 수 없는 경로 ${e.path}`)
        return
      }
      let v = cur
      switch (e.op) {
        case 'set':
          v = e.value
          break
        case 'add':
          v = cur + e.value
          break
        case 'mul':
          v = cur * e.value
          break
        case 'min':
          v = Math.min(cur, e.value)
          break
        case 'max':
          v = Math.max(cur, e.value)
          break
      }
      setNumberPath(draft, e.path, v)
      if (e.label) ctx.log(`${e.label}: ${e.path} ${fmt(cur)} → ${fmt(v)}`)
      return
    }
    case 'flag':
      setFlag(draft, e.key, e.value)
      return
    case 'counter':
      draft.counters[e.key] = (draft.counters[e.key] ?? 0) + e.add
      return
    case 'confidence': {
      const target = e.target ?? 'index'
      const before = draft.confidence[target]
      draft.confidence[target] = clamp(before + e.delta, 0, 100)
      if (e.reason) ctx.log(`신뢰(${target}) ${e.delta > 0 ? '+' : ''}${e.delta}: ${e.reason}`)
      return
    }
    case 'regulator': {
      const before = draft.regulator.level
      const next =
        e.set !== undefined ? e.set : (clamp(before + (e.add ?? 0), 0, 4) as RegulatorLevel)
      draft.regulator.level = next
      if (next !== before)
        draft.regulator.notes.push(
          `[T${draft.turnIndex}] R${before}→R${next}${e.reason ? `: ${e.reason}` : ''}`,
        )
      return
    }
    case 'feed':
      draft.feed.push({
        id: `f${draft.turnIndex}-${draft.feed.length}`,
        turnIndex: draft.turnIndex,
        ...e.item,
        ...(cause ? { cause } : {}),
      })
      return
    case 'fn':
      e.apply(draft, ctx)
      if (e.label) ctx.log(e.label)
      return
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3)
}
