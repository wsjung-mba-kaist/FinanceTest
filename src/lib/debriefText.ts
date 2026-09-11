import type { GameState, Mode, ScenarioDefinition, ScoreReport } from '../engine/types'
import { SCORE_DIMENSIONS } from '../engine/types/common'
import { formatMetric, formatNumber } from './format'
import { DIMENSION_LABELS, MODE_LABELS } from './labels'
import { bestDecision, headline, kpiComparison, worstDecision, type Regret } from './debriefSummary'

export interface DebriefTextInput {
  scenario: ScenarioDefinition
  state: GameState
  report: ScoreReport
  mode: Mode
  historical?: GameState
  expert?: GameState
  regrets?: Regret[]
  /** Omitted from the output when absent, so the text is reproducible in tests. */
  generatedAt?: string
}

const RULE = '─'.repeat(52)

function pad(label: string, width: number): string {
  return label.length >= width ? label : label + ' '.repeat(width - label.length)
}

/**
 * Plain-text rendering of the debrief, for `[텍스트로 복사]` and for pasting into a post-mortem
 * note. Deliberately free of markup so it survives a plain textarea.
 */
export function buildDebriefText(input: DebriefTextInput): string {
  const { scenario, state, report, mode, historical, expert, regrets, generatedAt } = input
  const units = scenario.units
  const h = headline(state, scenario)
  const rows = kpiComparison(scenario, state, historical, expert)
  const best = bestDecision(scenario, state, regrets)
  const worst = worstDecision(scenario, state, regrets)
  const fmt = (v: number | undefined, kpi: (typeof rows)[number]['kpi']) =>
    v === undefined ? '—' : formatMetric(v, kpi.unit, units, kpi.decimals)

  const out: string[] = []
  out.push(`${scenario.meta.title} — 디브리핑`)
  if (scenario.meta.subtitle) out.push(scenario.meta.subtitle)
  out.push(`역할: ${scenario.meta.roleTitle} · ${MODE_LABELS[mode]} 모드`)
  if (generatedAt) out.push(`작성: ${generatedAt}`)
  out.push(RULE)

  out.push(`결과: ${h.outcomeLabel} — ${h.title}`)
  if (h.turnLabel) out.push(`종료 시점: ${h.turnLabel}${h.timeLabel ? ` ${h.timeLabel}` : ''}`)
  if (h.lead) out.push(h.lead)
  out.push('')

  out.push(`종합 점수: ${formatNumber(report.total, 1)} (${report.grade})`)
  out.push(
    `전문가 정합 ${formatNumber(report.expertAlignment, 0)} · 힌트 감점 −${formatNumber(report.hintPenalty, 0)} · 시간 초과 ${report.timeoutCount}회`,
  )
  out.push('')

  out.push('[차원별 점수]')
  for (const d of SCORE_DIMENSIONS) {
    const dim = report.dimensions[d]
    out.push(
      `  ${pad(DIMENSION_LABELS[d], 12)} ${formatNumber(dim.score, 0).padStart(3)}점 (가중치 ${dim.weight}%)`,
    )
  }
  out.push('')

  out.push('[핵심 지표 — 귀하 / 역사 / 전문가]')
  for (const r of rows) {
    out.push(
      `  ${pad(r.kpi.label, 20)} ${fmt(r.player, r.kpi)} / ${fmt(r.historical, r.kpi)} / ${fmt(r.expert, r.kpi)}`,
    )
  }
  out.push('')

  out.push('[가장 잘한 결정]')
  if (best) {
    out.push(`  ${best.turnLabel} ${best.decisionTitle}`)
    for (const c of best.chosen) out.push(`    선택: ${c.label} (${c.rating}점)`)
  } else {
    out.push('  전문가 권고와 일치한 결정이 없습니다.')
  }
  out.push('')

  out.push('[가장 아쉬운 결정]')
  if (worst) {
    out.push(`  ${worst.turnLabel} ${worst.decisionTitle} — 후회 ${Math.round(worst.regret)}점`)
    for (const c of worst.chosen) out.push(`    선택: ${c.label} (${c.rating}점)`)
    if (worst.best) {
      out.push(`    전문가: ${worst.best.label} (${worst.best.rating}점)`)
      if (worst.best.why) out.push(`    근거: ${worst.best.why}`)
    }
    if (worst.trapExplanation) out.push(`    함정: ${worst.trapExplanation}`)
  } else {
    out.push('  모든 결정에서 최선의 옵션을 선택했습니다.')
  }
  out.push('')

  out.push('[결정 기록]')
  if (state.decisions.length === 0) {
    out.push('  기록된 결정이 없습니다.')
  } else {
    for (const rec of state.decisions) {
      const turn = scenario.turns[rec.turnIndex]
      out.push(
        `  ${turn?.label ?? `T${rec.turnIndex}`} ${rec.decisionId}: ${rec.optionIds.join(', ')}${rec.timedOut ? ' (시간 초과)' : ''}`,
      )
      if (rec.memo) out.push(`    메모: ${rec.memo}`)
    }
  }
  out.push('')

  out.push(RULE)
  out.push(`모델 대상: ${scenario.meta.modelledOn}`)
  out.push('기관명·수치·발언은 교육 목적으로 단순화·각색되었습니다.')
  return out.join('\n')
}

/** Copies `text` to the clipboard, falling back to a hidden textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
