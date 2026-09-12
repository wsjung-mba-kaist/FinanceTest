import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import DebriefPage from '@/pages/DebriefPage'
import { autoplay } from '@/engine'
import type { InstitutionState, ScenarioDefinition } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'
import { useProgressStore } from '@/store/progressStore'
import { loadAvailableScenariosSafe } from '../helpers/load'

const registry = await loadAvailableScenariosSafe()
const scenario = registry.find((s) => s.meta.id === 'svb-2023') as
  ScenarioDefinition<InstitutionState> | undefined

const TAB_NAMES = ['경로 비교', '실수와 what-if', '교훈', '퀴즈', '출처']

/** recharts' ResponsiveContainer observes its box; jsdom has no ResizeObserver. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderDebrief(def: ScenarioDefinition) {
  const run = autoplay(def, 'historical', { seed: 1 })
  useGameStore.setState({
    scenario: def,
    state: run.state,
    history: run.history,
    run: {
      runId: 'r-debrief-test',
      mode: 'standard',
      seed: 1,
      rewinds: 0,
      hintPenalty: 0,
      hintsRevealed: {},
      startedAt: '2026-01-01T00:00:00.000Z',
    },
  })
  const router = createMemoryRouter([{ path: '/debrief/:scenarioId', element: <DebriefPage /> }], {
    initialEntries: [`/debrief/${def.meta.id}`],
  })
  return { router, ...render(<RouterProvider router={router} />) }
}

describe.skipIf(!scenario)('DebriefPage tabs', () => {
  beforeAll(() => {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub
  })
  beforeEach(() => {
    useProgressStore.getState().resetAll()
  })

  it('paints the one-page summary before the heavy path computation finishes', async () => {
    renderDebrief(scenario!)
    // The headline (h1) comes from the ending, not from an autoplay.
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: '핵심 지표 — 귀하 / 역사 / 전문가' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '결정 두 가지' })).toBeInTheDocument()
    expect(screen.getByText('가장 잘한 결정')).toBeInTheDocument()
    expect(screen.getByText('가장 아쉬운 결정')).toBeInTheDocument()
    // 역사/전문가 columns fill in afterwards.
    await waitFor(() => expect(screen.queryByText('역사·전문가 경로를 계산 중…')).toBeNull())
  })

  it('renders a real tablist with exactly one visible panel', async () => {
    renderDebrief(scenario!)
    const tablist = await screen.findByRole('tablist', { name: '디브리핑 상세' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(TAB_NAMES)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('경로 비교')
  })

  it('switches panels and records the tab in the URL hash', async () => {
    const { router } = renderDebrief(scenario!)
    const tablist = await screen.findByRole('tablist', { name: '디브리핑 상세' })
    await userEvent.click(within(tablist).getByRole('tab', { name: '교훈' }))
    await waitFor(() => expect(router.state.location.hash).toBe('#lessons'))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('교훈')

    await userEvent.click(within(tablist).getByRole('tab', { name: '출처' }))
    await waitFor(() => expect(router.state.location.hash).toBe('#sources'))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('출처')
  })

  it('opens the tab named by the incoming hash', async () => {
    const def = scenario!
    const run = autoplay(def, 'historical', { seed: 1 })
    useGameStore.setState({
      scenario: def,
      state: run.state,
      history: run.history,
      run: {
        runId: 'r-hash-test',
        mode: 'standard',
        seed: 1,
        rewinds: 0,
        hintPenalty: 0,
        hintsRevealed: {},
        startedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    const router = createMemoryRouter(
      [{ path: '/debrief/:scenarioId', element: <DebriefPage /> }],
      { initialEntries: [`/debrief/${def.meta.id}#quiz`] },
    )
    render(<RouterProvider router={router} />)
    const panel = await screen.findByRole('tabpanel')
    expect(panel).toHaveAccessibleName('퀴즈')
  })

  /**
   * The decisive assertion for print. `beforeprint` is the browser's last synchronous moment
   * before it snapshots the page, so whether the hidden panels made it onto the paper depended on
   * React flushing a batched `setState` in time — a race that usually lost. `flushSync` in
   * `usePrintMode` makes it deterministic, and "deterministic" is exactly what this checks:
   * immediately after dispatching the event, with no `await`, every panel must already be there.
   */
  it('renders every panel synchronously when the browser asks to print', async () => {
    renderDebrief(scenario!)
    await screen.findByRole('tablist', { name: '디브리핑 상세' })
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)

    window.dispatchEvent(new Event('beforeprint'))
    // No await: if this needed one, the print snapshot would already have been taken.
    expect(screen.getAllByRole('tabpanel')).toHaveLength(TAB_NAMES.length)

    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(screen.getAllByRole('tabpanel')).toHaveLength(1))
  })

  /** The summary is meant to be read in one screen; the comparison table belongs to its own tab. */
  it('keeps the one-page summary to a headline, a sentence and two decisions', async () => {
    renderDebrief(scenario!)
    await screen.findByRole('heading', { level: 1 })

    // The 종합 점수 card is the page's single loudest panel.
    expect(screen.getByLabelText('종합 점수')).toBeInTheDocument()
    // The divergence is stated, not tabulated…
    await waitFor(() =>
      expect(
        screen.getByText(/전문가 경로와 가장 크게 갈린 지표|사실상 같은 자리에서 끝났습니다/),
      ).toBeInTheDocument(),
    )
    // …and the reader is told where to go next.
    expect(screen.getByRole('navigation', { name: '다음 단계' })).toBeInTheDocument()
  })
})
