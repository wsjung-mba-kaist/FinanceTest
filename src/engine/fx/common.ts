import type { Draft } from 'immer'
import type { Effect, EffectContext, FeedChannel, GameState, InstitutionState } from '../types'
import { clamp } from '../core/paths'

type Params = Record<string, number | string | boolean>

/** Helper to build a named `fn` effect with serialisable params (kept in logs / DEV inspector). */
export function fnEffect<S extends InstitutionState>(
  name: string,
  params: Params,
  apply: (draft: Draft<GameState<S>>, ctx: EffectContext) => void,
  label?: string,
): Effect<S> {
  return {
    kind: 'fn',
    name,
    params,
    apply,
    label:
      label ??
      `${name}(${Object.entries(params)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(', ')})`,
  }
}

export const op = (
  path: string,
  opName: 'set' | 'add' | 'mul' | 'min' | 'max',
  value: number,
  label?: string,
): Effect => ({
  kind: 'op',
  path,
  op: opName,
  value,
  label,
})
export const flag = (key: string, value: boolean | number | string = true): Effect => ({
  kind: 'flag',
  key,
  value,
})
export const counter = (key: string, add: number): Effect => ({ kind: 'counter', key, add })
export const confidence = (delta: number, reason?: string): Effect => ({
  kind: 'confidence',
  delta,
  reason,
})
export const regulator = (
  setOrAdd: { set?: 0 | 1 | 2 | 3 | 4; add?: number },
  reason?: string,
): Effect => ({
  kind: 'regulator',
  ...setOrAdd,
  reason,
})
/** Feed item effect. `channel` drives both the consequence-reel order and the log filter. */
export const feed = (
  title: string,
  body: string,
  severity: 'info' | 'warning' | 'critical' | 'positive' = 'info',
  channel?: FeedChannel,
): Effect => ({
  kind: 'feed',
  item: { kind: 'consequence', severity, title, body, ...(channel ? { channel } : {}) },
})

/** Multiplies a counter used as an amplifier/dampener product (keeps ≥ 0). */
export function multiplyCounter<S extends InstitutionState>(
  key: string,
  factor: number,
  label?: string,
): Effect<S> {
  return fnEffect<S>(
    'multiplyCounter',
    { key, factor },
    (d) => {
      const cur = d.counters[key]
      d.counters[key] = Math.max(0, (cur === undefined || cur === 0 ? 1 : cur) * factor)
    },
    label,
  )
}

/** Sets a counter to a value (idempotent). */
export function setCounter<S extends InstitutionState>(key: string, value: number): Effect<S> {
  return fnEffect<S>('setCounter', { key, value }, (d) => {
    d.counters[key] = value
  })
}

export function clampConfidence<S extends InstitutionState>(d: Draft<GameState<S>>): void {
  d.confidence.index = clamp(d.confidence.index, 0, 100)
}

/** Moves own stock by a percentage (e.g. −0.6 for −60%). */
export function ownStockMove<S extends InstitutionState>(
  pct: number,
  reason?: string,
  opts: { coupleCi?: boolean } = {},
): Effect<S> {
  return fnEffect<S>('ownStockMove', { pct, coupleCi: opts.coupleCi ?? false }, (d, ctx) => {
    const before = d.market.ownStock
    d.market.ownStock = Math.max(0.01, before * (1 + pct))
    // CI formula couples 0.4 × own-stock return (%) only when the move is not already priced into a ΔCI event
    if (opts.coupleCi) d.confidence.index = clamp(d.confidence.index + 0.4 * pct * 100, 0, 100)
    ctx.log(`자사 주가 ${(pct * 100).toFixed(0)}%${reason ? ` (${reason})` : ''}`)
  })
}
