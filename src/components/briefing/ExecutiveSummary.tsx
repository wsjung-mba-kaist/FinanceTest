import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MetricSnapshot, Mode, ScenarioDefinition } from '../../engine/types'
import type { BriefingSummary } from '../../lib/briefingSummary'
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  MODE_SUMMARY,
  shortDate,
  turnProgressLabel,
} from '../../lib/labels'
import type { InProgressSave } from '../../persistence/schema'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Markdown } from '../knowledge/Markdown'
import { KeyDecisions } from './KeyDecisions'
import { Watchpoints } from './Watchpoints'
import { Badge, Button, Card, ConfirmDialog } from '../ui'
import { Icon } from '../ui/Icon'

const MODES: Mode[] = ['guided', 'standard', 'expert']

interface StartActions {
  inProgress: InProgressSave | undefined
  stale: boolean
  restoreError: string | undefined
  confirmNew: boolean
  askNew: () => void
  cancelNew: () => void
  startNew: () => void
  resume: () => void
}

function useStartActions(scenario: ScenarioDefinition, mode: Mode): StartActions {
  const navigate = useNavigate()
  const id = scenario.meta.id
  const inProgress = useProgressStore((s) => s.scenarios[id]?.inProgress)
  const [confirmNew, setConfirmNew] = useState(false)
  const [restoreError, setRestoreError] = useState<string | undefined>()
  const stale = Boolean(inProgress && inProgress.scenarioVersion !== scenario.meta.version)

  return {
    inProgress,
    stale,
    restoreError,
    confirmNew,
    askNew: () => setConfirmNew(true),
    cancelNew: () => setConfirmNew(false),
    startNew: () => {
      setConfirmNew(false)
      useGameStore.getState().start(scenario, mode)
      navigate(`/play/${id}`)
    },
    resume: () => {
      if (!inProgress) return
      const g = useGameStore.getState()
      if (g.run?.runId !== inProgress.runId && !g.restore(scenario, inProgress)) {
        setRestoreError(
          '저장된 진행 상황이 현재 시나리오 버전과 맞지 않아 이어할 수 없습니다. 새로 시작해 주세요.',
        )
        return
      }
      navigate(`/play/${id}`)
    },
  }
}

function StartCard({
  scenario,
  mode,
  setMode,
  actions,
}: {
  scenario: ScenarioDefinition
  mode: Mode
  setMode: (m: Mode) => void
  actions: StartActions
}) {
  const defaultMode = useSettingsStore((s) => s.defaultMode)
  const timersEnabled = useSettingsStore((s) => s.timersEnabled)
  const [detail, setDetail] = useState(false)
  const { inProgress, stale, restoreError } = actions

  return (
    <Card tier="key" className="scroll-mt-4 p-4" id="bf-start" aria-labelledby="bf-start-h">
      <h2 id="bf-start-h" className="text-lg font-semibold">
        시작하기
      </h2>

      {inProgress && (
        <div className="mt-2 rounded-md border border-info-border bg-info-bg p-2 text-sm">
          <div className="font-medium text-info">진행 중인 플레이가 있습니다</div>
          <div className="num mt-0.5">
            {turnProgressLabel(inProgress.turnIndex, scenario.meta.durationTurns)} ·{' '}
            {MODE_LABELS[inProgress.mode]} 모드 · 저장 {shortDate(inProgress.updatedAt)}
          </div>
          {stale && <p className="mt-1 text-warning">시나리오가 갱신되어 이어할 수 없습니다.</p>}
          {restoreError && <p className="mt-1 text-critical">{restoreError}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" onClick={actions.resume} disabled={stale}>
              이어하기
            </Button>
            <Button variant="secondary" onClick={actions.askNew}>
              새로 시작
            </Button>
          </div>
        </div>
      )}

      <div role="radiogroup" aria-label="플레이 모드" className="mt-3 space-y-1.5">
        {MODES.map((m) => {
          const checked = mode === m
          return (
            <label
              key={m}
              className={`flex cursor-pointer gap-2 rounded-md border p-2 text-sm transition-colors ${
                checked
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <input
                type="radio"
                name="bf-mode"
                value={m}
                checked={checked}
                onChange={() => setMode(m)}
                className="mt-1 accent-accent"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold">{MODE_LABELS[m]}</span>
                  {m === defaultMode && <Badge tone="neutral">기본</Badge>}
                </span>
                <span className="mt-0.5 block text-muted">{MODE_SUMMARY[m]}</span>
              </span>
            </label>
          )
        })}
      </div>

      <button
        type="button"
        aria-expanded={detail}
        aria-controls="bf-mode-detail"
        onClick={() => setDetail((v) => !v)}
        className="mt-2 inline-flex min-h-tap-dense items-center gap-1 border-0 bg-transparent text-sm text-accent"
      >
        자세히
        <Icon name={detail ? 'chevron-down' : 'chevron-right'} size={14} />
      </button>
      <div id="bf-mode-detail" hidden={!detail} className="mt-1.5">
        <ul className="m-0 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {MODE_DESCRIPTIONS[mode].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {!timersEnabled && (
          <p className="mt-1 text-sm text-muted">
            설정에서 타이머가 꺼져 있어 결정 시간 제한은 적용되지 않습니다.
          </p>
        )}
      </div>

      {/* On small screens the CTA lives in the sticky bar, so it is not repeated here. */}
      <div className="mt-3">
        {inProgress ? (
          <Button
            variant="secondary"
            size="lg"
            className="hidden w-full lg:inline-flex"
            onClick={actions.askNew}
          >
            {MODE_LABELS[mode]} 모드로 새로 시작
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="hidden w-full lg:inline-flex"
            onClick={actions.startNew}
          >
            {MODE_LABELS[mode]} 모드로 시작
          </Button>
        )}
        <p className="num mt-1.5 text-sm text-muted">
          예상 소요 약 {scenario.meta.estMinutes}분 · {scenario.meta.durationTurns}턴
        </p>
      </div>
    </Card>
  )
}

/**
 * One-page briefing summary: 상황 / 역할·권한 / 목표 / 중요한 판단 3가지 on the left, the start
 * card + KPI baselines + role frame in the right rail. Everything is derived from the existing
 * scenario content by `deriveBriefingSummary`, so the full dossier below stays the source of truth.
 */
export function ExecutiveSummary({
  scenario,
  summary,
  baseline,
  mode,
  setMode,
}: {
  scenario: ScenarioDefinition
  summary: BriefingSummary
  baseline: MetricSnapshot | undefined
  mode: Mode
  setMode: (m: Mode) => void
}) {
  const actions = useStartActions(scenario, mode)

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="bf-situation-h">
            <h2 id="bf-situation-h" className="text-lg font-semibold">
              상황
            </h2>
            <Markdown className="prose-col mt-1">{summary.situation}</Markdown>
            {/* The dossier carries the same ground in full. Saying so here is what lets the
                summary stop at 220 characters instead of becoming a second copy of it. */}
            <p className="mt-1 text-sm">
              <a href="#bf-dossier-h">전체 상황 개요 · 기관 현황 · 시장 배경 →</a>
            </p>
          </section>

          {/* 역할·권한 and 목표 are each a sentence or two, so they sit side by side rather than
              stacking two mostly-empty rows down a column that is ~700px wide. */}
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="bf-mandate-h" className="min-w-0">
              <h2 id="bf-mandate-h" className="text-lg font-semibold">
                역할·권한
              </h2>
              <p className="mt-1 text-sm text-muted">
                {scenario.meta.roleTitle} · {scenario.meta.institutionName}
              </p>
              {summary.mandate && <Markdown className="mt-1">{summary.mandate}</Markdown>}
            </section>

            {summary.objective && (
              <section aria-labelledby="bf-objective-h" className="min-w-0">
                <h2 id="bf-objective-h" className="text-lg font-semibold">
                  목표
                </h2>
                <Markdown className="mt-1">{summary.objective}</Markdown>
              </section>
            )}
          </div>

          <KeyDecisions scenario={scenario} />
        </div>

        {/* Only the start action belongs beside the prose. The baseline figures and the role frame
            are both four-item rows that read better across the page than stacked in a 320px rail —
            keeping them here made the aside roughly twice the height of the column next to it. */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <StartCard scenario={scenario} mode={mode} setMode={setMode} actions={actions} />
        </aside>
      </div>

      {/*
        One section where there were three. 핵심 지표 기준선 printed the T0 figures, the role
        frame printed them again beside its four questions, and 시작 전 확인 printed them a third
        time — the same numbers, up to four times on one screen counting the dossier. They are
        joined on the metric each item reads, and this is now the only place the summary shows a
        T0 value.
      */}
      <div className="mt-4">
        <Watchpoints scenario={scenario} baseline={baseline} />
      </div>

      {/* Mobile: the start action follows the reader down the page. */}
      <div
        data-noprint
        className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface px-4 py-2 lg:hidden"
      >
        {actions.inProgress ? (
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={actions.resume}
              disabled={actions.stale}
            >
              이어하기
            </Button>
            <Button variant="secondary" size="lg" onClick={actions.askNew}>
              새로 시작
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={actions.startNew}>
            {MODE_LABELS[mode]} 모드로 시작
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={actions.confirmNew}
        title="새로 시작할까요?"
        body="진행 중인 플레이 저장분이 삭제되고 처음부터 다시 시작합니다. 완료된 기록은 유지됩니다."
        confirmLabel="새로 시작"
        destructive
        onCancel={actions.cancelNew}
        onConfirm={actions.startNew}
      />
    </>
  )
}
