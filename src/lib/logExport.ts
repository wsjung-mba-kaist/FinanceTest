import type { GameEvent, GameState, Mode, ScenarioDefinition } from '../engine'
import { getTurnView } from '../engine'
import { observedTurnState } from './observedTurn'
import type { RunInfo } from '../store/gameStore'
import { MODE_LABELS } from './labels'
import { stripInlineMarkdown } from './text'

export type LogKind = 'decision' | 'call' | 'consequence' | 'regulator' | 'memo'

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  decision: '결정',
  call: '통화',
  consequence: '결과',
  regulator: '감독 메모',
  memo: '메모',
}

export interface LogEntry {
  id: string
  turnIndex: number
  kind: LogKind
  /** Clock label of the authored event, when it has one. */
  time?: string
  title: string
  body?: string
  /** One-line context (speaker, chosen options, agency…). */
  meta?: string
  severity?: 'info' | 'warning' | 'critical' | 'positive'
}

function eventsOfTurn(
  scenario: ScenarioDefinition,
  history: GameState[] | undefined,
  state: GameState,
  turnIndex: number,
  mode: Mode,
): GameEvent[] {
  const snapshot = observedTurnState(scenario, state, history, turnIndex, mode)
  if (!snapshot) return []
  try {
    return getTurnView(snapshot, scenario, { mode }).events
  } catch {
    return []
  }
}

/**
 * Everything a trainee needs for a post-exercise review, in one chronological list:
 * 통화 · 감독 메모 · 결정 · 메모 · 결과, grouped by turn.
 */
export function buildLogEntries(
  scenario: ScenarioDefinition,
  state: GameState,
  opts: { history?: GameState[]; mode?: Mode } = {},
): LogEntry[] {
  const mode = opts.mode ?? 'standard'
  const out: LogEntry[] = []
  for (let t = 0; t <= state.turnIndex; t++) {
    const turn = scenario.turns[t]
    if (!turn) continue
    for (const e of eventsOfTurn(scenario, opts.history, state, t, mode)) {
      if (e.kind === 'call') {
        out.push({
          id: `call-${t}-${e.id}`,
          turnIndex: t,
          kind: 'call',
          time: e.time,
          title: `${e.caller} → ${e.callee}`,
          meta: e.agency,
          body: e.lines.map((l) => `${l.speaker}: ${l.text}`).join('\n'),
          severity: e.severity,
        })
      } else if (e.kind === 'regulator') {
        out.push({
          id: `reg-${t}-${e.id}`,
          turnIndex: t,
          kind: 'regulator',
          time: e.time,
          title: e.headline,
          meta: e.agency,
          body: stripInlineMarkdown(e.body),
          severity: e.severity,
        })
      }
    }

    for (const rec of state.decisions.filter((d) => d.turnIndex === t)) {
      const decision = turn.decisions.find((d) => d.id === rec.decisionId)
      const labels = rec.optionIds.map(
        (id) => decision?.options.find((o) => o.id === id)?.label ?? id,
      )
      out.push({
        id: `dec-${t}-${rec.decisionId}`,
        turnIndex: t,
        kind: 'decision',
        title: decision?.title ?? rec.decisionId,
        body: labels.map((l) => `· ${stripInlineMarkdown(l)}`).join('\n'),
        meta: [
          rec.timedOut ? '시간 초과 · 기본 선택' : undefined,
          rec.hintsUsed ? `힌트 ${rec.hintsUsed}단계` : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
      })
      if (rec.memo) {
        out.push({
          id: `memo-${t}-${rec.decisionId}`,
          turnIndex: t,
          kind: 'memo',
          title: decision?.title ?? rec.decisionId,
          body: rec.memo,
        })
      }
    }

    for (const f of state.feed.filter((x) => x.turnIndex === t)) {
      out.push({
        id: `feed-${f.id}`,
        turnIndex: t,
        kind: 'consequence',
        title: f.title,
        body: stripInlineMarkdown(f.body),
        severity: f.severity,
      })
    }

    // Engine notes are stamped `[T3] R1→R2: 사유` (core/effects.ts).
    const notes = state.regulator.notes.filter((n) => n.startsWith(`[T${t}]`))
    for (const [i, n] of notes.entries()) {
      out.push({
        id: `note-${t}-${i}`,
        turnIndex: t,
        kind: 'regulator',
        title: '감독 단계 변경',
        body: n.replace(`[T${t}] `, ''),
      })
    }
  }
  return out
}

function header(scenario: ScenarioDefinition, state: GameState, run: RunInfo): string[] {
  const hints = Object.values(run.hintsRevealed).filter((v) => v > 0).length
  return [
    `${scenario.meta.title} — 결정 로그`,
    `시나리오: ${scenario.meta.id} v${scenario.meta.version} · ${scenario.meta.institutionName} · ${scenario.meta.roleTitle}`,
    `모드: ${MODE_LABELS[run.mode]} · 시드: ${run.seed} · 런 id: ${run.runId}`,
    `힌트: ${hints}건 (감점 ${run.hintPenalty}점) · 되감기: ${run.rewinds}회`,
    `진행: T+${state.turnIndex}/${Math.max(0, scenario.meta.durationTurns - 1)}${
      state.ended ? ` · 종료(${state.ended.title})` : ''
    }`,
    `내보낸 시각: ${new Date().toLocaleString('ko-KR')}`,
    '',
  ]
}

/** Plain-text export handed to a post-exercise reviewer (복사 / .txt 다운로드). */
export function buildLogText(
  scenario: ScenarioDefinition,
  state: GameState,
  run: RunInfo,
  opts: { history?: GameState[] } = {},
): string {
  const entries = buildLogEntries(scenario, state, { history: opts.history, mode: run.mode })
  const lines = header(scenario, state, run)
  for (let t = 0; t <= state.turnIndex; t++) {
    const turn = scenario.turns[t]
    if (!turn) continue
    const rows = entries.filter((e) => e.turnIndex === t)
    lines.push(`── ${turn.label} · ${turn.timeLabel}${turn.title ? ` · ${turn.title}` : ''} ──`)
    if (rows.length === 0) lines.push('  (기록 없음)')
    for (const e of rows) {
      const head = [
        `  [${LOG_KIND_LABELS[e.kind]}]`,
        e.time ? `${e.time}` : undefined,
        e.title,
        e.meta ? `(${e.meta})` : undefined,
      ]
        .filter(Boolean)
        .join(' ')
      lines.push(head)
      if (e.body) for (const b of e.body.split('\n')) lines.push(`      ${b}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function logFilename(scenario: ScenarioDefinition, run: RunInfo): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `${scenario.meta.id}-log-${run.mode}-${stamp}.txt`
}

/** Writes the text to the clipboard; returns false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
