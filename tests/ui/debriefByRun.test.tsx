import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import DebriefPage from '@/pages/DebriefPage'
import ProgressPage from '@/pages/ProgressPage'
import { autoplay, computeScore, type Policy } from '@/engine'
import type { InstitutionState, ScenarioDefinition } from '@/engine/types'
import type { AttemptSave } from '@/persistence/schema'
import { useGameStore } from '@/store/gameStore'
import { useProgressStore } from '@/store/progressStore'
import { loadAvailableScenariosSafe } from '../helpers/load'

const registry = await loadAvailableScenariosSafe()
const scenario = registry.find((s) => s.meta.id === 'svb-2023') as
  ScenarioDefinition<InstitutionState> | undefined

/**
 * A debrief is a pure function of (scenario version, seed, decisions), so its link has to say
 * which run. Every «디브리핑» link on the progress page used to point at `/debrief/:id` and the
 * page rebuilt `attempts[0]` — the third row opened the first run.
 */
function attemptFor(
  def: ScenarioDefinition,
  policy: Policy,
  runId: string,
  mode: AttemptSave['mode'],
) {
  const r = autoplay(def, policy, { seed: 1 })
  const report = computeScore(r.state, def)
  const attempt: AttemptSave = {
    runId,
    seed: 1,
    mode,
    scenarioVersion: def.meta.version,
    decisions: r.state.decisions,
    variance: 0,
    rewinds: 0,
    hintPenalty: 0,
    total: report.total,
    grade: report.grade,
    dimensions: {},
    endedReason: r.state.ended?.reason ?? 'completed',
    endedTurnIndex: r.state.turnIndex,
    endedTick: r.state.tick,
    failed: Boolean(r.state.ended?.failed),
    completedAt: '2026-01-01T00:00:00.000Z',
    durationSec: 60,
  }
  return attempt
}

describe.skipIf(!scenario)('debrief addressed by run', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll()
    useGameStore.getState().abandon()
    const def = scenario!
    // Recorded oldest first: after both calls `attempts[0]` is the expert run.
    useProgressStore
      .getState()
      .recordAttempt(def.meta.id, attemptFor(def, 'historical', 'r-hist', 'guided'))
    useProgressStore
      .getState()
      .recordAttempt(def.meta.id, attemptFor(def, 'expert', 'r-expert', 'expert'))
  })

  it('the progress page links each attempt to its own run', async () => {
    const router = createMemoryRouter([{ path: '/progress', element: <ProgressPage /> }], {
      initialEntries: ['/progress'],
    })
    render(<RouterProvider router={router} />)
    const links = await screen.findAllByRole('link', { name: '디브리핑' })
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain(`/debrief/${scenario!.meta.id}/r-hist`)
    expect(hrefs).toContain(`/debrief/${scenario!.meta.id}/r-expert`)
  })

  it('opens the run the URL names, not the latest one', async () => {
    const router = createMemoryRouter(
      [{ path: '/debrief/:scenarioId/:runId?', element: <DebriefPage /> }],
      { initialEntries: [`/debrief/${scenario!.meta.id}/r-hist`] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 1 })
    // The footer names the mode of the run shown; the latest attempt is the expert one.
    expect(screen.getByText(/안내 모드 · seed 1/)).toBeInTheDocument()
    expect(screen.queryByText(/전문가 모드 · seed 1/)).not.toBeInTheDocument()
  })

  it('without a run id still shows the latest attempt', async () => {
    const router = createMemoryRouter(
      [{ path: '/debrief/:scenarioId/:runId?', element: <DebriefPage /> }],
      { initialEntries: [`/debrief/${scenario!.meta.id}`] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/전문가 모드 · seed 1/)).toBeInTheDocument()
  })

  it('says so when the run is not stored any more', async () => {
    const router = createMemoryRouter(
      [{ path: '/debrief/:scenarioId/:runId?', element: <DebriefPage /> }],
      { initialEntries: [`/debrief/${scenario!.meta.id}/r-gone`] },
    )
    render(<RouterProvider router={router} />)
    expect(
      await screen.findByRole('heading', { level: 1, name: '이 기록을 찾을 수 없습니다' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '진행 현황에서 고르기' })).toHaveAttribute(
      'href',
      '/progress',
    )
  })
})
