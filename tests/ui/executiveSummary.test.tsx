import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ExecutiveSummary } from '@/components/briefing/ExecutiveSummary'
import { latestSnapshot } from '@/engine'
import type { InstitutionState, Mode, ScenarioDefinition } from '@/engine/types'
import { baselineGame, deriveBriefingSummary } from '@/lib/briefingSummary'
import { useGameStore } from '@/store/gameStore'
import { useProgressStore } from '@/store/progressStore'
import { loadAvailableScenariosSafe } from '../helpers/load'

const registry = await loadAvailableScenariosSafe()
const scenario = registry.find((s) => s.meta.id === 'svb-2023') as
  ScenarioDefinition<InstitutionState> | undefined

function Harness({ def }: { def: ScenarioDefinition }) {
  const [mode, setMode] = useState<Mode>('standard')
  const state = baselineGame(def)
  const snapshot = state ? latestSnapshot(state) : undefined
  return (
    <ExecutiveSummary
      scenario={def}
      summary={deriveBriefingSummary(def, snapshot)}
      baseline={snapshot}
      mode={mode}
      setMode={setMode}
    />
  )
}

function renderSummary(def: ScenarioDefinition) {
  const router = createMemoryRouter(
    [
      { path: '/scenarios/:scenarioId', element: <Harness def={def} /> },
      { path: '/play/:scenarioId', element: <div>플레이 화면</div> },
    ],
    { initialEntries: [`/scenarios/${def.meta.id}`] },
  )
  return render(<RouterProvider router={router} />)
}

describe.skipIf(!scenario)('ExecutiveSummary', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll()
    useGameStore.setState({ scenario: undefined, state: undefined, history: [], run: undefined })
  })

  /**
   * The summary answers four questions, each exactly once: 이게 뭔가 / 내 일은 뭔가 /
   * 무엇을 결정하나 / 무엇을 지켜보나. It used to answer two of them twice and the third not at
   * all — 중요한 판단 listed learning objectives ("…을 이해한다"), which say nothing about what
   * the player will be asked to decide.
   */
  it('answers each of the four briefing questions once', () => {
    renderSummary(scenario!)
    for (const title of ['상황', '역할·권한', '목표', '시작하기']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('heading', { level: 2, name: /내려야 할 결정 \d가지/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /매 턴 확인할 \d가지/ }),
    ).toBeInTheDocument()
    // The summary no longer carries a separate baseline strip or a second copy of the role frame.
    expect(screen.queryByRole('heading', { level: 2, name: '핵심 지표 기준선' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /중요한 판단/ })).toBeNull()
    // The start card carries the mode radios with their one-line summaries.
    const group = screen.getByRole('radiogroup', { name: '플레이 모드' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByText(/처음이라면 안내 모드를 권장합니다/)).toBeInTheDocument()
  })

  it('reveals the mode bullet list behind 자세히', async () => {
    renderSummary(scenario!)
    const more = screen.getByRole('button', { name: '자세히' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('힌트 사용 시 감점(−2/−4/−8점)')).toBeInTheDocument()
  })

  it('starts a run in the selected mode and navigates to play', async () => {
    renderSummary(scenario!)
    await userEvent.click(screen.getByRole('radio', { name: /안내/ }))
    const cta = screen.getAllByRole('button', { name: '안내 모드로 시작' })
    await userEvent.click(cta[0]!)
    expect(await screen.findByText('플레이 화면')).toBeInTheDocument()
    const run = useGameStore.getState().run
    expect(run?.mode).toBe('guided')
    expect(useGameStore.getState().scenario?.meta.id).toBe(scenario!.meta.id)
  })

  it('offers 이어하기 vs 새로 시작 when a save exists, and confirms before discarding it', async () => {
    const def = scenario!
    useProgressStore.getState().setInProgress(def.meta.id, {
      runId: 'r-test',
      seed: 1,
      mode: 'standard',
      scenarioVersion: def.meta.version,
      decisions: [],
      turnIndex: 0,
      rewinds: 0,
      hintPenalty: 0,
      hintsRevealed: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    renderSummary(def)
    expect(screen.getByText('진행 중인 플레이가 있습니다')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '이어하기' }).length).toBeGreaterThan(0)

    await userEvent.click(screen.getAllByRole('button', { name: '새로 시작' })[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('새로 시작할까요?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '새로 시작' }))
    expect(await screen.findByText('플레이 화면')).toBeInTheDocument()
  })

  it('blocks 이어하기 when the save was made against another scenario version', () => {
    const def = scenario!
    useProgressStore.getState().setInProgress(def.meta.id, {
      runId: 'r-old',
      seed: 1,
      mode: 'standard',
      scenarioVersion: def.meta.version + 1,
      decisions: [],
      turnIndex: 0,
      rewinds: 0,
      hintPenalty: 0,
      hintsRevealed: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    renderSummary(def)
    expect(screen.getByText('시나리오가 갱신되어 이어할 수 없습니다.')).toBeInTheDocument()
    for (const b of screen.getAllByRole('button', { name: '이어하기' })) {
      expect(b).toBeDisabled()
    }
  })

  /**
   * The decisive assertion for this page: a T0 figure appeared up to four times on one screen
   * (baseline strip, role-frame chips, pre-flight checklist, dossier table). 매 턴 확인할 N가지
   * is now the only place the summary prints one.
   */
  it('prints each baseline figure exactly once', () => {
    renderSummary(scenario!)
    const watch = screen.getByRole('heading', { level: 2, name: /매 턴 확인할/ }).closest('section')
    expect(watch).not.toBeNull()
    const shown = [...watch!.querySelectorAll('dt')].map((el) => el.textContent?.trim() ?? '')
    expect(shown.length).toBeGreaterThan(0)
    for (const label of new Set(shown)) {
      // Each KPI label appears once inside the section…
      expect(
        shown.filter((x) => x === label),
        label,
      ).toHaveLength(1)
    }
  })
})
