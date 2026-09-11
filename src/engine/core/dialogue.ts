import type {
  Condition,
  ConditionContext,
  Decision,
  DialogueReply,
  DialogueStep,
  Effect,
  InstitutionState,
} from '../types'
import { evaluate } from './conditions'

/**
 * Multi-step dialogues (마일스톤 D3).
 *
 * A dialogue is a small graph laid over a decision the scenario already declares: every walk starts
 * at `steps[0]`, each reply either continues at another step (`next`) or **resolves to one of the
 * decision's existing `options`** (`resolvesTo`). That is the whole trick — what lands in the
 * decision log is still `{ decisionId, optionIds }`, so validation, effects, delayed effects,
 * scoring, path comparison, the debrief and the consequence reel keep working unchanged. The reply
 * ids walked are recorded alongside, as `DecisionRecord.path`, and replaying a log re-verifies them.
 *
 * Reply `when` conditions are evaluated against the state the decision was asked in — the same
 * context `Option.when` sees — so the panel and `applyDecision` can never disagree about which
 * replies exist. Reply `effects` are applied in path order **before** the resolved option's, and
 * should stay small (counters and flags): whether a promise was kept is judged later by a delayed
 * effect with `when: { counter: … }`, not by the reply itself.
 */

const MAX_WALK = 64

/** True when the decision is answered through a conversation rather than a bare option list. */
export function hasDialogue<S extends InstitutionState>(decision: Decision<S>): boolean {
  return Array.isArray(decision.steps) && decision.steps.length > 0
}

/** The entry point of the conversation (`steps[0]`). */
export function entryStep<S extends InstitutionState>(
  decision: Decision<S>,
): DialogueStep<S> | undefined {
  return decision.steps?.[0]
}

export function stepById<S extends InstitutionState>(
  decision: Decision<S>,
  id: string | undefined,
): DialogueStep<S> | undefined {
  if (id === undefined) return undefined
  return decision.steps?.find((s) => s.id === id)
}

/**
 * The replies offered at a step. Without a `ctx` nothing is filtered — that is the shape the lint
 * wants (it reasons about every authored path, not one particular state).
 */
export function availableReplies<S extends InstitutionState>(
  decision: Decision<S>,
  stepId: string,
  ctx?: ConditionContext,
): DialogueReply<S>[] {
  const step = stepById(decision, stepId)
  if (!step) return []
  if (!ctx) return step.replies
  return step.replies.filter((r) => evaluate(r.when as Condition | undefined, ctx))
}

export interface DialogueWalk<S extends InstitutionState = InstitutionState> {
  /** The step the walk has reached; absent once it resolved or turned out invalid. */
  step?: DialogueStep<S>
  /** The option the dialogue resolved to. */
  optionId?: string
  /** Why the path is not walkable (Korean, surfaced through `DecisionError`). */
  invalid?: string
  /** The replies consumed, in path order — what `applyDecision` applies. */
  replies: DialogueReply<S>[]
  /** The step each consumed reply was given at (for the transcript). */
  steps: DialogueStep<S>[]
}

/**
 * Replays a path of reply ids from the entry step. Each id must exist at the step the walk has
 * reached (and pass its `when`, when a `ctx` is given); walking past a `resolvesTo`, or naming a
 * step that no longer exists, is invalid.
 */
export function walk<S extends InstitutionState>(
  decision: Decision<S>,
  path: readonly string[],
  ctx?: ConditionContext,
): DialogueWalk<S> {
  const replies: DialogueReply<S>[] = []
  const steps: DialogueStep<S>[] = []
  let step: DialogueStep<S> | undefined = entryStep(decision)
  if (!step) {
    return path.length === 0
      ? { replies, steps }
      : { replies, steps, invalid: '이 결정에는 대화 단계가 없습니다' }
  }
  let resolved: string | undefined
  for (const replyId of path) {
    if (!step)
      return {
        replies,
        steps,
        invalid: `대화가 이미 끝났는데 응답 ${replyId}이(가) 남아 있습니다`,
      }
    const here: DialogueStep<S> = step
    const reply: DialogueReply<S> | undefined = availableReplies(decision, here.id, ctx).find(
      (r) => r.id === replyId,
    )
    if (!reply)
      return {
        replies,
        steps,
        invalid: `단계 ${here.id}에서 선택할 수 없는 응답입니다: ${replyId}`,
      }
    replies.push(reply)
    steps.push(here)
    if (reply.resolvesTo !== undefined) {
      if (!decision.options.some((o) => o.id === reply.resolvesTo))
        return {
          replies,
          steps,
          invalid: `응답 ${replyId}의 귀결 옵션이 없습니다: ${reply.resolvesTo}`,
        }
      // The walk is over; anything left in the path is a stale tail and invalidates it.
      resolved = reply.resolvesTo
      step = undefined
      continue
    }
    const nextStep: DialogueStep<S> | undefined = stepById(decision, reply.next)
    if (!nextStep)
      return {
        replies,
        steps,
        invalid: `응답 ${replyId}의 다음 단계가 없습니다: ${reply.next ?? '(미지정)'}`,
      }
    step = nextStep
    if (replies.length > MAX_WALK)
      return { replies, steps, invalid: '대화 경로가 너무 깁니다 (순환 가능성)' }
  }
  if (resolved !== undefined) return { replies, steps, optionId: resolved }
  return { replies, steps, step }
}

/**
 * Option ids reachable from each step, as a fixpoint (so cycles terminate). Used by the autoplay
 * walker to steer toward a target option and by the lint to find unreachable options.
 */
export function reachableOptions<S extends InstitutionState>(
  decision: Decision<S>,
  ctx?: ConditionContext,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const s of decision.steps ?? []) map.set(s.id, new Set<string>())
  let changed = true
  let guard = 0
  while (changed && guard++ < MAX_WALK) {
    changed = false
    for (const s of decision.steps ?? []) {
      const set = map.get(s.id)!
      for (const r of availableReplies(decision, s.id, ctx)) {
        if (r.resolvesTo !== undefined) {
          if (!set.has(r.resolvesTo)) {
            set.add(r.resolvesTo)
            changed = true
          }
        } else if (r.next !== undefined) {
          for (const o of map.get(r.next) ?? []) {
            if (!set.has(o)) {
              set.add(o)
              changed = true
            }
          }
        }
      }
    }
  }
  return map
}

/** Option ids a single reply can still lead to. */
function replyReach<S extends InstitutionState>(
  reply: DialogueReply<S>,
  reach: Map<string, Set<string>>,
): Set<string> {
  if (reply.resolvesTo !== undefined) return new Set([reply.resolvesTo])
  return reach.get(reply.next ?? '') ?? new Set<string>()
}

export type DialoguePreference = 'rating' | 'trap' | 'random'

export interface DialogueWalkPolicy {
  /** Option the walk should steer toward (historical / expert). */
  target?: string
  /** How ties (or a free walk) are broken. */
  prefer: DialoguePreference
  /** Seeded PRNG, only consulted by `prefer: 'random'`. */
  rng?: () => number
  /** Whether an option may be committed right now (`when` / `requires`). */
  canCommit?: (optionId: string) => boolean
}

export interface DialogueWalkResult {
  path: string[]
  optionId: string
  /** Set when the walk could not reach `policy.target` and settled for something else. */
  missedTarget?: string
}

function neutralRating<S extends InstitutionState>(r: DialogueReply<S>): number {
  return r.expert?.rating ?? 50
}

/**
 * Walks a dialogue under an autoplay policy.
 *
 * `historical` / `expert` pass a `target` and the walker follows the reply whose `resolvesTo`
 * — possibly transitively — reaches it, preferring the highest `expert.rating` among ties.
 * `worst` prefers a `trap` reply and then the lowest rating; `random` draws from the seeded RNG.
 * A reply that cannot reach any committable option is never taken, so the walk always terminates
 * in an option `applyDecision` will accept.
 */
export function walkByPolicy<S extends InstitutionState>(
  decision: Decision<S>,
  ctx: ConditionContext,
  policy: DialogueWalkPolicy,
): DialogueWalkResult | undefined {
  const reach = reachableOptions(decision, ctx)
  const canCommit = policy.canCommit ?? (() => true)
  const path: string[] = []
  let step: DialogueStep<S> | undefined = entryStep(decision)
  let missedTarget: string | undefined
  let target = policy.target
  if (target !== undefined && !(reach.get(step?.id ?? '')?.has(target) ?? false)) {
    missedTarget = target
    target = undefined
  }
  for (let i = 0; step && i <= MAX_WALK; i++) {
    const replies = availableReplies(decision, step.id, ctx)
    const committable = replies.filter((r) => [...replyReach(r, reach)].some(canCommit))
    const pool =
      target !== undefined
        ? committable.filter((r) => replyReach(r, reach).has(target!))
        : committable
    const candidates = pool.length > 0 ? pool : committable
    if (candidates.length === 0) return undefined
    let pick: DialogueReply<S>
    if (policy.prefer === 'random' && policy.rng) {
      const idx = Math.min(candidates.length - 1, Math.floor(policy.rng() * candidates.length))
      pick = candidates[idx]!
    } else if (policy.prefer === 'trap') {
      pick =
        candidates.find((r) => r.trap) ??
        [...candidates].sort((a, b) => neutralRating(a) - neutralRating(b))[0]!
    } else {
      pick = [...candidates].sort((a, b) => neutralRating(b) - neutralRating(a))[0]!
    }
    path.push(pick.id)
    if (pick.resolvesTo !== undefined) {
      return {
        path,
        optionId: pick.resolvesTo,
        ...(missedTarget !== undefined ? { missedTarget } : {}),
      }
    }
    step = stepById(decision, pick.next)
  }
  return undefined
}

// ---------------------------------------------------------------- authoring helpers

export interface CommitRepliesOptions<S extends InstitutionState = InstitutionState> {
  /** Reply id prefix; defaults to the counter name. */
  idPrefix?: string
  /** Label for one value; defaults to `${value}${unit}`. */
  label?: (value: number) => string
  /** Appended to the default label, e.g. '%' or '시간'. */
  unit?: string
  /** Next step for every generated reply (or per value). Exclusive with `resolvesTo`. */
  next?: string | ((value: number) => string | undefined)
  /** Option every generated reply resolves to (or per value). Exclusive with `next`. */
  resolvesTo?: string | ((value: number) => string | undefined)
  when?: (value: number) => Condition | undefined
  expert?: (value: number) => { rating: number; rationale: string } | undefined
  trap?: (value: number) => boolean
  trapExplanation?: (value: number) => string | undefined
  /** Extra effects beyond the counter itself. */
  effects?: (value: number) => Effect<S>[] | undefined
}

function resolveSpec<T>(
  spec: T | ((value: number) => T | undefined) | undefined,
  value: number,
): T | undefined {
  return typeof spec === 'function' ? (spec as (v: number) => T | undefined)(value) : spec
}

/**
 * Turns a numeric promise into discrete replies plus a counter — the only way this engine takes a
 * number from a player. `commitReplies('saleHaircutPct', [10, 25, 40], { next: 'step-3' })` yields
 * three replies that each `set` the counter, so a later delayed effect can judge the promise with
 * `when: { counter: 'saleHaircutPct', lte: 25 }`. There is no free-text or slider input: a discrete
 * reply is replayable, a typed number is not.
 */
export function commitReplies<S extends InstitutionState = InstitutionState>(
  counter: string,
  values: number[],
  opts: CommitRepliesOptions<S> = {},
): DialogueReply<S>[] {
  const prefix = opts.idPrefix ?? counter
  return values.map((value) => {
    const next = resolveSpec(opts.next, value)
    const resolvesTo = resolveSpec(opts.resolvesTo, value)
    const label = opts.label ? opts.label(value) : `${value}${opts.unit ?? ''}`
    const when = opts.when?.(value)
    const expert = opts.expert?.(value)
    const trap = opts.trap?.(value)
    const trapExplanation = opts.trapExplanation?.(value)
    const commit: Effect<S> = {
      kind: 'fn',
      name: 'commitCounter',
      params: { counter, value },
      label: `${counter} = ${value}`,
      // A promise is *set*, never accumulated: walking the same dialogue twice must not double it.
      apply: (draft) => {
        draft.counters[counter] = value
      },
    }
    return {
      id: `${prefix}-${value}`,
      label,
      effects: [commit, ...(opts.effects?.(value) ?? [])],
      ...(when ? { when } : {}),
      ...(next !== undefined ? { next } : {}),
      ...(resolvesTo !== undefined ? { resolvesTo } : {}),
      ...(expert ? { expert } : {}),
      ...(trap ? { trap: true as const } : {}),
      ...(trapExplanation ? { trapExplanation } : {}),
    }
  })
}

// ---------------------------------------------------------------- lint

export interface DialogueIssue {
  level: 'error' | 'warning'
  rule: string
  /** Relative location, e.g. `steps(s2).replies(r1)`. */
  where: string
  message: string
}

/**
 * Structural lint for one decision's dialogue. Every rule here is about the graph itself, so it
 * runs with no state: replies are never filtered by `when` (an option reachable only behind a
 * condition still counts as reachable).
 */
export function validateDialogue<S extends InstitutionState>(
  decision: Decision<S>,
): DialogueIssue[] {
  const issues: DialogueIssue[] = []
  if (!hasDialogue(decision)) return issues
  const steps = decision.steps ?? []
  const err = (rule: string, where: string, message: string) =>
    issues.push({ level: 'error', rule, where, message })
  const warn = (rule: string, where: string, message: string) =>
    issues.push({ level: 'warning', rule, where, message })

  const stepIds = new Set<string>()
  const optionIds = new Set(decision.options.map((o) => o.id))
  const sel = decision.select ?? { min: 1, max: 1 }
  if (sel.min !== 1 || sel.max !== 1) {
    err(
      'dialogue-select',
      'steps',
      `대화는 옵션 1개로 귀결되므로 select는 1~1이어야 합니다 (${sel.min}~${sel.max})`,
    )
  }
  for (const step of steps) {
    const sw = `steps(${step.id})`
    if (stepIds.has(step.id)) err('dialogue-unique-ids', sw, `단계 id 중복: ${step.id}`)
    stepIds.add(step.id)
    if (!step.lines || step.lines.length === 0)
      err('dialogue-lines', sw, '상대 대사(lines)가 없습니다')
    if (step.replies.length < 2 || step.replies.length > 4)
      err('dialogue-reply-count', sw, `응답은 2~4개여야 합니다 (${step.replies.length}개)`)
    const replyIds = new Set<string>()
    for (const r of step.replies) {
      const rw = `${sw}.replies(${r.id})`
      if (replyIds.has(r.id)) err('dialogue-unique-ids', rw, `응답 id 중복: ${r.id}`)
      replyIds.add(r.id)
      if (!r.label) err('dialogue-reply-label', rw, 'label 누락')
      const hasNext = r.next !== undefined
      const hasResolve = r.resolvesTo !== undefined
      if (hasNext && hasResolve)
        err('dialogue-reply-target', rw, 'next와 resolvesTo를 함께 쓸 수 없습니다')
      else if (!hasNext && !hasResolve)
        err('dialogue-reply-target', rw, 'next 또는 resolvesTo 중 하나가 필요합니다')
      if (hasResolve && !optionIds.has(r.resolvesTo!))
        err('dialogue-resolves-to', rw, `이 결정에 없는 옵션으로 귀결합니다: ${r.resolvesTo}`)
      if (r.trap && !r.trapExplanation)
        err('dialogue-trap-explanation', rw, '함정 응답에 trapExplanation이 없습니다')
    }
  }
  for (const step of steps) {
    for (const r of step.replies) {
      if (r.next !== undefined && !stepIds.has(r.next)) {
        err(
          'dialogue-next',
          `steps(${step.id}).replies(${r.id})`,
          `다음 단계가 없습니다: ${r.next}`,
        )
      }
    }
  }

  // --- reachability from steps[0]
  const entry = steps[0]!
  const seen = new Set<string>([entry.id])
  const queue = [entry.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const r of stepById(decision, id)?.replies ?? []) {
      if (r.next === undefined || !stepIds.has(r.next) || seen.has(r.next)) continue
      seen.add(r.next)
      queue.push(r.next)
    }
  }
  for (const step of steps) {
    if (!seen.has(step.id))
      err(
        'dialogue-unreachable-step',
        `steps(${step.id})`,
        'steps[0]에서 도달할 수 없는 단계입니다',
      )
  }

  // --- every reachable step must be able to terminate (no cycle without a `resolvesTo`)
  const reach = reachableOptions(decision)
  for (const step of steps) {
    if (!seen.has(step.id)) continue
    if ((reach.get(step.id)?.size ?? 0) === 0) {
      err(
        'dialogue-cycle',
        `steps(${step.id})`,
        'resolvesTo에 도달하지 못하고 계속 순환할 수 있는 단계입니다',
      )
    }
  }

  // --- an option no path reaches (a warning: it may be reachable only when a `when` holds)
  const fromEntry = reach.get(entry.id) ?? new Set<string>()
  for (const o of decision.options) {
    if (!fromEntry.has(o.id))
      warn(
        'dialogue-option-unreachable',
        `options(${o.id})`,
        '어떤 대화 경로로도 도달할 수 없는 옵션입니다',
      )
  }
  return issues
}
