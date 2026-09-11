import type {
  Condition,
  Decision,
  Effect,
  GameOverRule,
  InstitutionState,
  Option,
  ScenarioDefinition,
} from '../types'
import { SCORE_DIMENSIONS } from '../types/common'
import { createGame } from '../core/createGame'
import { getNumberPath } from '../core/paths'
import { allDecisions } from '../core/lookup'

export interface IntegrityIssue {
  level: 'error' | 'warning'
  rule: string
  where: string
  message: string
}

export interface IntegrityOptions {
  /** Known knowledge-card ids (if omitted, card refs are not checked). */
  cardIds?: Set<string>
  /** Known shared-source ids (merged with scenario.meta.sources). */
  sourceIds?: Set<string>
  /** Known metric keys for this institution type (if omitted, metric keys are not checked). */
  metricKeys?: Set<string>
}

function walkConditions(cond: Condition | undefined, visit: (c: Condition) => void): void {
  if (!cond) return
  visit(cond)
  if ('all' in cond) cond.all.forEach((c) => walkConditions(c, visit))
  if ('any' in cond) cond.any.forEach((c) => walkConditions(c, visit))
  if ('not' in cond) walkConditions(cond.not, visit)
}

/**
 * Pure structural + authoring lint for a scenario definition. Used by tests and the DEV inspector.
 * Returns issues; callers decide whether warnings fail the build.
 */
export function validateScenario<S extends InstitutionState>(
  scenario: ScenarioDefinition<S>,
  opts: IntegrityOptions = {},
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  const err = (rule: string, where: string, message: string) =>
    issues.push({ level: 'error', rule, where, message })
  const warn = (rule: string, where: string, message: string) =>
    issues.push({ level: 'warning', rule, where, message })
  const sc = scenario as unknown as ScenarioDefinition
  const m = sc.meta

  // --- meta
  if (!m.id) err('meta', 'meta.id', 'id 누락')
  if (!m.sources || m.sources.length === 0)
    err('sources-present', 'meta.sources', '출처가 없습니다')
  else if (!m.sources.some((s) => s.kind === 'primary' || s.kind === 'regulatory')) {
    err('sources-primary', 'meta.sources', '1차/규제 출처가 최소 1개 필요합니다')
  }
  if (m.durationTurns !== sc.turns.length) {
    err(
      'turn-count',
      'meta.durationTurns',
      `durationTurns(${m.durationTurns}) ≠ turns.length(${sc.turns.length})`,
    )
  }
  if (m.learningObjectives.length < 3)
    warn('learning-objectives', 'meta.learningObjectives', '학습목표는 3~5개를 권장합니다')

  const sourceIds = new Set<string>([...(opts.sourceIds ?? []), ...m.sources.map((s) => s.id)])
  const decisionIds = new Set<string>()
  const allIds = new Set<string>()
  const addId = (id: string, where: string) => {
    if (allIds.has(id)) err('unique-ids', where, `중복 id: ${id}`)
    allIds.add(id)
  }

  // --- initial state can be created
  let initial: ReturnType<typeof createGame> | undefined
  try {
    initial = createGame(sc, 1)
  } catch (e) {
    err(
      'initial-state',
      'initialState',
      `createGame 실패: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const checkEffects = (effects: Effect[] | undefined, where: string) => {
    for (const e of effects ?? []) {
      if (e.kind === 'op') {
        if (initial && getNumberPath(initial, e.path) === undefined) {
          err('op-path', where, `op 경로가 초기 상태에서 숫자로 해석되지 않음: ${e.path}`)
        }
      } else if (e.kind === 'fn' && !e.name) {
        warn('fn-named', where, 'fn 효과에 name이 없습니다')
      }
    }
  }
  const checkCondition = (cond: Condition | undefined, where: string) => {
    walkConditions(cond, (c) => {
      if ('metric' in c && opts.metricKeys && !opts.metricKeys.has(c.metric)) {
        err('metric-key', where, `알 수 없는 지표 키: ${c.metric}`)
      }
      if ('path' in c && initial && getNumberPath(initial, c.path) === undefined) {
        err('cond-path', where, `조건 경로가 초기 상태에서 숫자로 해석되지 않음: ${c.path}`)
      }
      if ('chose' in c) {
        const ids = [c.chose.option].flat()
        if (!decisionIds.has(c.chose.decision)) {
          // may reference a later-declared decision; check after the pass
          pendingChose.push({ where, decision: c.chose.decision, options: ids })
        }
      }
    })
  }
  const checkRefs = (
    cardRefs: string[] | undefined,
    sourceRefs: string[] | undefined,
    where: string,
  ) => {
    if (opts.cardIds) {
      for (const c of cardRefs ?? [])
        if (!opts.cardIds.has(c)) err('card-ref', where, `알 수 없는 카드: ${c}`)
    }
    for (const s of sourceRefs ?? [])
      if (!sourceIds.has(s)) err('source-ref', where, `알 수 없는 출처: ${s}`)
  }
  const pendingChose: { where: string; decision: string; options: string[] }[] = []
  const optionIdsByDecision = new Map<string, Set<string>>()
  // Decisions in turns beyond the last turn named by the historical path are unreachable historically
  // (e.g. the institution was closed) — a missing historical option there is a warning, not an error.
  const histTurnIndex = (id: string) =>
    sc.turns.findIndex((t) => t.decisions.some((d) => d.id === id))
  const histMaxTurn = Object.keys(sc.paths.historical.choices).reduce(
    (m, id) => Math.max(m, histTurnIndex(id)),
    -1,
  )

  // --- turns
  let currentTurnIndex = 0
  sc.turns.forEach((turn, ti) => {
    currentTurnIndex = ti
    const tw = `turns[${ti}](${turn.id})`
    addId(turn.id, tw)
    if (turn.events.length === 0 && turn.decisions.length === 0)
      err('turn-empty', tw, '이벤트도 결정도 없는 턴')
    for (const ce of turn.entryEffects ?? []) {
      checkEffects(ce.effects, `${tw}.entryEffects(${ce.id})`)
      checkCondition(ce.when, `${tw}.entryEffects(${ce.id})`)
    }
    for (const ev of turn.events) {
      const ew = `${tw}.events(${ev.id})`
      addId(ev.id, ew)
      checkEffects(ev.effects, ew)
      checkCondition(ev.when, ew)
      checkRefs(ev.cardRefs, ev.sourceRefs, ew)
      if (ev.correctionOf && !allIds.has(ev.correctionOf))
        warn('correction-ref', ew, `정정 대상 미존재: ${ev.correctionOf}`)
    }
    for (const d of turn.decisions) {
      const dw = `${tw}.decisions(${d.id})`
      addId(d.id, dw)
      decisionIds.add(d.id)
      checkDecision(d as Decision, dw)
    }
    for (const h of turn.advisorHints ?? []) checkCondition(h.when, `${tw}.advisorHints`)
    checkRefs(turn.relatedCards, undefined, tw)
  })

  function checkDecision(d: Decision, dw: string) {
    if (d.options.length < 2) err('options-min', dw, '옵션은 2개 이상이어야 합니다')
    const sel = d.select ?? { min: 1, max: 1 }
    if (sel.min < 1 || sel.max < sel.min)
      err('select-range', dw, `select 범위 오류 ${sel.min}~${sel.max}`)
    if (!d.prompt) err('prompt', dw, 'prompt 누락')
    checkCondition(d.when, dw)
    checkRefs(d.cardRefs, undefined, dw)
    checkRefs(d.requiredConcepts, undefined, `${dw}.requiredConcepts`)
    if (d.defaultOptionId && !d.options.some((o) => o.id === d.defaultOptionId)) {
      err('default-option', dw, `defaultOptionId ${d.defaultOptionId} 없음`)
    }
    for (const dim of d.dimensions ?? []) {
      if (!SCORE_DIMENSIONS.includes(dim)) err('dimension', dw, `알 수 없는 점수 차원 ${dim}`)
    }
    const ids = new Set<string>()
    let historical = 0
    let trap = 0
    for (const o of d.options) {
      const ow = `${dw}.options(${o.id})`
      if (ids.has(o.id)) err('unique-ids', ow, `옵션 id 중복 ${o.id}`)
      ids.add(o.id)
      checkOption(o, ow)
      if (o.historical) historical++
      if (o.trap) trap++
    }
    optionIdsByDecision.set(d.id, ids)
    for (const g of d.exclusive ?? []) {
      for (const id of g)
        if (!ids.has(id)) err('exclusive-ref', dw, `exclusive 그룹의 옵션 미존재 ${id}`)
    }
    const pathChoice = sc.paths.historical.choices[d.id]
    if (historical === 0 && pathChoice === undefined) {
      if (histMaxTurn >= 0 && currentTurnIndex > histMaxTurn) {
        warn(
          'one-historical-per-decision',
          dw,
          '역사 경로가 도달하지 않는 턴의 결정입니다 (역사 옵션 없음)',
        )
      } else {
        err(
          'one-historical-per-decision',
          dw,
          '역사 옵션(historical) 또는 paths.historical 지정이 없습니다',
        )
      }
    }
    if (trap === 0) warn('min-one-trap', dw, '함정 옵션이 없습니다 (시나리오 전체에 ≥1 필요)')
    if (d.timeLimitSec && !d.defaultOptionId)
      warn('timeout-default', dw, '타이머가 있는 결정에 defaultOptionId가 없습니다')
  }

  function checkOption(o: Option, ow: string) {
    if (!o.label) err('option-label', ow, 'label 누락')
    if (o.label && o.label.split(/\s+/).length > 14)
      warn('option-label-length', ow, '라벨이 깁니다 (≤ 12 단어 권장)')
    if (!(o.expert.rating >= 0 && o.expert.rating <= 100))
      err('rating-range', ow, `expert.rating ${o.expert.rating} 범위 밖`)
    if (!o.expert.rationale) err('rating-rationale', ow, 'expert.rationale 누락')
    if (
      (o.expert.rating < 20 || o.expert.rating > 80) &&
      !(o.expert.sourceRefs && o.expert.sourceRefs.length > 0)
    ) {
      warn('ratings-have-sources', ow, '극단 rating(<20 또는 >80)에는 출처가 필요합니다')
    }
    if (!o.consequences) err('consequences', ow, 'consequences 누락')
    if (o.trap && !o.trapExplanation)
      err('trap-has-explanation', ow, '함정 옵션에 trapExplanation이 없습니다')
    checkEffects(o.effects, ow)
    checkCondition(o.when, ow)
    checkCondition(o.requires, ow)
    checkRefs(o.remediationCard ? [o.remediationCard] : undefined, o.expert.sourceRefs, ow)
    checkRefs(undefined, o.feasibility?.sourceRefs, ow)
    o.delayedEffects?.forEach((de, i) => {
      const dew = `${ow}.delayedEffects[${i}]`
      if (de.afterTurns < 1) err('delayed-offset', dew, 'afterTurns는 1 이상이어야 합니다')
      checkEffects(de.effects, dew)
      checkCondition(de.when, dew)
      if (!de.description) err('delayed-description', dew, 'description 누락')
    })
    if (o.requires && !o.unavailableReason)
      warn('unavailable-reason', ow, 'requires가 있는 옵션은 unavailableReason을 권장합니다')
  }

  // --- deferred chose references
  for (const p of pendingChose) {
    if (!decisionIds.has(p.decision)) err('chose-ref', p.where, `참조한 결정 미존재: ${p.decision}`)
    else {
      const set = optionIdsByDecision.get(p.decision)
      for (const o of p.options)
        if (set && !set.has(o)) err('chose-ref', p.where, `결정 ${p.decision}에 옵션 ${o} 없음`)
    }
  }

  // --- game over / endings
  if (sc.gameOver.length === 0) warn('game-over-present', 'gameOver', '게임오버 규칙이 없습니다')
  sc.gameOver.forEach((r: GameOverRule) => {
    checkCondition(r.when, `gameOver(${r.id})`)
    if (!r.ruleText)
      err('game-over-ruletext', `gameOver(${r.id})`, 'ruleText(게임 내 규칙 설명) 누락')
  })
  sc.endings.forEach((e) => checkCondition(e.when, `endings(${e.id})`))
  if (sc.endings.length === 0) warn('endings', 'endings', '엔딩이 없습니다 (기본 종료 문구 사용)')

  // --- scoring
  const wsum = SCORE_DIMENSIONS.reduce((a, d) => a + (sc.scoring.weights[d] ?? 0), 0)
  if (Math.abs(wsum - 100) > 0.01) err('weights-sum', 'scoring.weights', `가중치 합 ${wsum} ≠ 100`)

  // --- paths
  const decisionsAll = allDecisions(sc)
  for (const [dId, choice] of Object.entries(sc.paths.historical.choices)) {
    const found = decisionsAll.find((d) => d.decision.id === dId)
    if (!found) err('path-decision', `paths.historical(${dId})`, '결정 미존재')
    else
      for (const o of [choice].flat())
        if (!found.decision.options.some((x) => x.id === o))
          err('path-option', `paths.historical(${dId})`, `옵션 ${o} 없음`)
  }
  for (const [dId, choice] of Object.entries(sc.paths.expert?.choices ?? {})) {
    const found = decisionsAll.find((d) => d.decision.id === dId)
    if (!found) err('path-decision', `paths.expert(${dId})`, '결정 미존재')
    else
      for (const o of [choice].flat())
        if (!found.decision.options.some((x) => x.id === o))
          err('path-option', `paths.expert(${dId})`, `옵션 ${o} 없음`)
  }

  // --- debrief
  if (sc.debrief.lessons.length === 0) err('lessons', 'debrief.lessons', '교훈이 없습니다')
  for (const l of sc.debrief.lessons) {
    if (!l.sourceRefs || l.sourceRefs.length === 0)
      err('lesson-source', `debrief.lessons(${l.id})`, '교훈에 출처가 없습니다')
    checkRefs(l.cardRefs, l.sourceRefs, `debrief.lessons(${l.id})`)
    checkCondition(l.when, `debrief.lessons(${l.id})`)
  }
  if (sc.debrief.quiz.length < 3) warn('quiz-count', 'debrief.quiz', '퀴즈는 5문항을 권장합니다')
  for (const q of sc.debrief.quiz) {
    const qw = `debrief.quiz(${q.id})`
    if (!q.sourceRefs || q.sourceRefs.length === 0)
      err('quiz-source', qw, '퀴즈 해설에 출처가 없습니다')
    checkRefs(q.cardRefs, q.sourceRefs, qw)
    if (q.type === 'single' || q.type === 'multi') {
      for (const a of q.answer)
        if (!q.choices.some((c) => c.id === a))
          err('quiz-answer', qw, `정답 ${a}가 보기에 없습니다`)
      if (q.type === 'single' && q.answer.length !== 1)
        err('quiz-answer', qw, 'single 유형은 정답 1개')
    }
  }
  for (const t of sc.debrief.historical.timeline) {
    if (!sc.turns.some((x) => x.id === t.turnId))
      err('debrief-turn', 'debrief.historical.timeline', `턴 ${t.turnId} 없음`)
    checkRefs(undefined, t.sourceRefs, `debrief.historical.timeline(${t.turnId})`)
  }
  // --- briefing / kpis
  checkRefs(sc.briefing.cardRefs, undefined, 'briefing.cardRefs')
  if (sc.kpis.length === 0) warn('kpis', 'kpis', 'KPI가 정의되지 않았습니다')
  if (opts.metricKeys)
    for (const k of sc.kpis)
      if (!opts.metricKeys.has(k.metric))
        err('kpi-metric', `kpis(${k.metric})`, '알 수 없는 지표 키')
  for (const c of sc.checkpoints ?? []) {
    if (!sc.turns.some((x) => x.id === c.turnId))
      err('checkpoint-turn', `checkpoints(${c.label})`, `턴 ${c.turnId} 없음`)
  }
  // scenario-level trap requirement
  const anyTrap = decisionsAll.some((d) => d.decision.options.some((o) => o.trap))
  if (!anyTrap) err('min-one-trap', 'turns', '시나리오에 함정 옵션이 최소 1개 필요합니다')
  return issues
}

export function formatIssues(issues: IntegrityIssue[]): string {
  return issues
    .map((i) => `${i.level === 'error' ? '✖' : '⚠'} [${i.rule}] ${i.where}: ${i.message}`)
    .join('\n')
}
