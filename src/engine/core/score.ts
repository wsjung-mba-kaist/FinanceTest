import type {
  Curve,
  DimensionScore,
  GameState,
  InstitutionState,
  ScenarioDefinition,
  ScoreComponent,
  ScoreDimension,
  ScoreReport,
} from '../types'
import { SCORE_DIMENSIONS } from '../types/common'
import { DEFAULT_SCORING_RULES } from '../scoring/defaults'
import { allDecisions, findOption } from './lookup'
import { clamp } from './paths'

export function evalCurve(curve: Curve, x: number): number {
  if (curve.length === 0) return 0
  const pts = [...curve].sort((a, b) => a[0] - b[0])
  if (x <= pts[0]![0]) return clamp(pts[0]![1], 0, 100)
  const last = pts[pts.length - 1]!
  if (x >= last[0]) return clamp(last[1], 0, 100)
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!
    const [x1, y1] = pts[i + 1]!
    if (x >= x0 && x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0)
      return clamp(y0 + t * (y1 - y0), 0, 100)
    }
  }
  return clamp(last[1], 0, 100)
}

function metricSeries(state: GameState, key: string): number[] {
  return state.metricsHistory
    .map((s) => s.metrics[key])
    .filter(
      (m): m is NonNullable<typeof m> =>
        Boolean(m) && m!.status !== 'na' && Number.isFinite(m!.value),
    )
    .map((m) => m.value)
}

function aggregate(
  series: number[],
  how: 'final' | 'min' | 'max' | 'avg' | 'turnsBelow' | 'turnsAbove',
  threshold?: number,
): number | undefined {
  if (series.length === 0) return undefined
  switch (how) {
    case 'final':
      return series[series.length - 1]
    case 'min':
      return Math.min(...series)
    case 'max':
      return Math.max(...series)
    case 'avg':
      return series.reduce((a, b) => a + b, 0) / series.length
    case 'turnsBelow':
      return series.filter((v) => v < (threshold ?? 0)).length
    case 'turnsAbove':
      return series.filter((v) => v > (threshold ?? 0)).length
  }
}

interface ChosenOption {
  turnIndex: number
  decisionId: string
  optionId: string
  rating: number
  dimensions: ScoreDimension[] | undefined
  scoreAdjust: Partial<Record<ScoreDimension, number>> | undefined
}

function chosenOptions(state: GameState, scenario: ScenarioDefinition): ChosenOption[] {
  const out: ChosenOption[] = []
  const decisions = allDecisions(scenario)
  for (const rec of state.decisions) {
    const found = decisions.find((d) => d.decision.id === rec.decisionId)
    if (!found) continue
    for (const oid of rec.optionIds) {
      const o = findOption(found.decision, oid)
      if (!o) continue
      out.push({
        turnIndex: rec.turnIndex,
        decisionId: rec.decisionId,
        optionId: oid,
        rating: o.expert.rating,
        dimensions: found.decision.dimensions,
        scoreAdjust: o.scoreAdjust,
      })
    }
  }
  return out
}

function evalComponent(
  c: ScoreComponent,
  dim: ScoreDimension,
  state: GameState,
  chosen: ChosenOption[],
): { score: number; text: string } | undefined {
  switch (c.kind) {
    case 'metric': {
      const v = aggregate(metricSeries(state, c.metric), c.aggregate, c.threshold)
      if (v === undefined) return undefined
      const score = evalCurve(c.curve, v)
      return {
        score,
        text: `${c.label ?? c.metric}(${c.aggregate}) = ${fmt(v)} → ${score.toFixed(0)}점`,
      }
    }
    case 'counter': {
      const v = state.counters[c.key] ?? 0
      const score = evalCurve(c.curve, v)
      return { score, text: `${c.label ?? c.key} = ${fmt(v)} → ${score.toFixed(0)}점` }
    }
    case 'expert': {
      const tagged = chosen.filter((o) => o.dimensions?.includes(dim))
      const pool = tagged.length > 0 ? tagged : chosen
      if (pool.length === 0) return undefined
      const avg = pool.reduce((a, o) => a + o.rating, 0) / pool.length
      return {
        score: avg,
        text: `${c.label ?? '전문가 정합'}: 선택 옵션 평균 ${avg.toFixed(0)}점 (${pool.length}건${tagged.length ? '' : ', 전체 결정 기준'})`,
      }
    }
    case 'flag': {
      const t = state.flagTurns[c.key]
      const set = t !== undefined && (c.byTurn === undefined || t <= c.byTurn)
      const score = clamp(set ? c.ifSet : c.ifNot, 0, 100)
      return { score, text: `${c.label ?? c.key}: ${set ? `T${t}에 달성` : '미달성'} → ${score}점` }
    }
    case 'adjust': {
      const sum = chosen.reduce((a, o) => a + (o.scoreAdjust?.[dim] ?? 0), 0)
      return {
        score: clamp(50 + sum, 0, 100),
        text: `${c.label ?? '옵션 보정'}: ${sum >= 0 ? '+' : ''}${sum}`,
      }
    }
    case 'survival': {
      const alive = !state.ended?.failed
      const score = alive ? c.alive : state.ended?.orderly ? c.orderlyFail : c.disorderlyFail
      return {
        score: clamp(score, 0, 100),
        text: `${c.label ?? '생존'}: ${alive ? '생존' : state.ended?.orderly ? '질서 있는 실패' : '무질서한 실패'} → ${score}점`,
      }
    }
  }
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export function gradeFor(total: number): ScoreReport['grade'] {
  if (total >= 90) return 'S'
  if (total >= 80) return 'A'
  if (total >= 70) return 'B'
  if (total >= 60) return 'C'
  if (total >= 50) return 'D'
  return 'F'
}

export function computeScore<S extends InstitutionState>(
  state: GameState<S>,
  scenario: ScenarioDefinition<S>,
): ScoreReport {
  const st = state as GameState
  const sc = scenario as unknown as ScenarioDefinition
  const chosen = chosenOptions(st, sc)
  const defaults = DEFAULT_SCORING_RULES[scenario.meta.institutionType]
  const dims = {} as Record<ScoreDimension, DimensionScore>
  const timeouts = st.counters.timeouts ?? 0
  let total = 0
  for (const dim of SCORE_DIMENSIONS) {
    const components = sc.scoring.rules[dim]?.components ??
      defaults[dim] ?? [{ kind: 'expert', weight: 1 }]
    const evaluated = components
      .map((c) => ({ c, r: evalComponent(c, dim, st, chosen) }))
      .filter((x): x is { c: ScoreComponent; r: { score: number; text: string } } => Boolean(x.r))
    const wsum = evaluated.reduce((a, x) => a + x.c.weight, 0)
    let score = wsum > 0 ? evaluated.reduce((a, x) => a + x.c.weight * x.r.score, 0) / wsum : 50
    const explanation = evaluated.map((x) => x.r.text)
    if (dim === 'timeliness' && timeouts > 0) {
      score = clamp(score - 10 * timeouts, 0, 100)
      explanation.push(`시간 초과 ${timeouts}회: −${10 * timeouts}점`)
    }
    const weight = sc.scoring.weights[dim] ?? 0
    dims[dim] = { score, weight, explanation }
    total += (weight * score) / 100
  }
  const hintPenalty = st.counters.hintPenalty ?? 0
  total = clamp(total - hintPenalty, 0, 100)
  if (st.ended?.failed) {
    const cap = st.ended.orderly
      ? (sc.scoring.failureCapOrderly ?? 60)
      : (sc.scoring.failureCap ?? 40)
    total = Math.min(total, cap)
  }
  const expertAlignment = chosen.length
    ? chosen.reduce((a, o) => a + o.rating, 0) / chosen.length
    : 0
  const roundedTotal = Math.round(total * 10) / 10
  return {
    total: roundedTotal,
    grade: gradeFor(roundedTotal),
    dimensions: dims,
    expertAlignment: Math.round(expertAlignment * 10) / 10,
    hintPenalty,
    timeoutCount: timeouts,
    ...(st.ended
      ? { ended: { failed: st.ended.failed, orderly: st.ended.orderly, reason: st.ended.reason } }
      : {}),
  }
}

/** Regret per decision = best available expert rating − chosen rating (for "Top mistakes"). */
export function decisionRegrets(
  state: GameState,
  scenario: ScenarioDefinition,
): { decisionId: string; turnIndex: number; chosen: string[]; best: string; regret: number }[] {
  const out: {
    decisionId: string
    turnIndex: number
    chosen: string[]
    best: string
    regret: number
  }[] = []
  const decisions = allDecisions(scenario)
  for (const rec of state.decisions) {
    const found = decisions.find((d) => d.decision.id === rec.decisionId)
    if (!found) continue
    const best = [...found.decision.options].sort((a, b) => b.expert.rating - a.expert.rating)[0]
    if (!best) continue
    const chosenRatings = rec.optionIds.map(
      (id) => findOption(found.decision, id)?.expert.rating ?? 0,
    )
    const avg = chosenRatings.length
      ? chosenRatings.reduce((a, b) => a + b, 0) / chosenRatings.length
      : 0
    out.push({
      decisionId: rec.decisionId,
      turnIndex: rec.turnIndex,
      chosen: rec.optionIds,
      best: best.id,
      regret: best.expert.rating - avg,
    })
  }
  return out.sort((a, b) => b.regret - a.regret)
}
