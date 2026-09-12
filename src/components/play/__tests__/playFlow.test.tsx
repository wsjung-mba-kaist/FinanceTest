import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { GameState, InstitutionState, ScenarioDefinition } from '../../../engine'
import { applyDecision } from '../../../engine'
import PlayPage from '../../../pages/PlayPage'
import { useGameStore } from '../../../store/gameStore'
import type { ReelStep } from '../reelSteps'

let scenario: ScenarioDefinition<InstitutionState>

beforeAll(async () => {
  const mod = await import('../../../scenarios/svb-2023/scenario')
  scenario = mod.default as ScenarioDefinition<InstitutionState>
})

/** Desktop layout + reduced motion: both columns mount and the reel renders as a static list. */
function stubEnvironment(): void {
  window.matchMedia = ((query: string) => ({
    matches: /min-width:\s*1200px/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  document.documentElement.setAttribute('data-reduced-motion', 'true')
}

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={[`/play/${scenario.meta.id}`]}>
      <Routes>
        <Route path="/play/:scenarioId" element={<PlayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function optionButtons(): HTMLElement[] {
  const radios = screen.queryAllByRole('radio')
  return radios.length > 0 ? radios : screen.queryAllByRole('checkbox')
}

beforeEach(() => {
  stubEnvironment()
  localStorage.clear()
  useGameStore.getState().start(scenario, 'standard', 1)
})

afterEach(() => {
  useGameStore.getState().abandon()
  document.documentElement.removeAttribute('data-reduced-motion')
})

describe('situation-room turn flow', () => {
  it('completes a turn with the keyboard only: 1 → Ctrl+Enter → 결과 → N', async () => {
    const user = userEvent.setup()
    renderPlay()

    expect(await screen.findByRole('heading', { name: /지금 요청받은 것/ })).toBeInTheDocument()
    const options = optionButtons()
    expect(options.length).toBeGreaterThan(0)

    // Tab lands on the first option of the group (roving tabindex), then number keys select.
    options[0]!.focus()
    await user.keyboard('1')
    expect(options[0]).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))

    // The consequence reel replaces the block in place and keeps a persistent summary.
    expect(await screen.findByRole('heading', { name: '결과 요약' })).toBeInTheDocument()

    const turnBefore = useGameStore.getState().state?.turnIndex ?? 0
    document.body.focus()
    await user.keyboard('n')
    await waitFor(() => expect(useGameStore.getState().state?.turnIndex).toBe(turnBefore + 1))
  })

  it('undo restores the state from before the decision', async () => {
    const user = userEvent.setup()
    renderPlay()
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    const before = useGameStore.getState().state as GameState
    const options = optionButtons()
    options[0]!.focus()
    await user.keyboard('1')
    await user.click(screen.getByRole('button', { name: /확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))
    expect(useGameStore.getState().undoable).toBeDefined()

    await user.click(screen.getByRole('button', { name: /실행 취소/ }))

    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(0))
    expect(useGameStore.getState().state).toBe(before)
    expect(useGameStore.getState().undoable).toBeUndefined()
    // The decision is answerable again.
    expect(optionButtons().length).toBeGreaterThan(0)
  })

  it('resets every zone to the top when the turn changes', async () => {
    const user = userEvent.setup()
    renderPlay()
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    // The element that scrolls, which is the zone itself or — once the zone has a
    // non-scrolling action footer — the box inside it.
    const dock = document.querySelector(
      '#zone-decisions [data-zone-scroll], #zone-decisions[data-zone-scroll]',
    )
    expect(dock).not.toBeNull()
    let scrollTop = 420
    Object.defineProperty(dock as HTMLElement, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v
      },
    })

    const options = optionButtons()
    options[0]!.focus()
    await user.keyboard('1')
    await user.click(screen.getByRole('button', { name: /확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))
    expect(scrollTop).toBe(420)

    await user.click(screen.getByRole('button', { name: /다음 턴으로/ }))
    await waitFor(() => expect(scrollTop).toBe(0))
  })
})

describe('consequence reel', () => {
  it('emits its beats in order with an 800 ms cadence', () => {
    const before = useGameStore.getState().state as GameState
    const decision = scenario.turns[0]!.decisions[0]!
    const optionId = decision.options[0]!.id
    const after = applyDecision(before, scenario, decision.id, [optionId])

    // L2: the reel is built by the engine and carried on the state.
    expect(after.lastReel?.cause).toEqual({
      kind: 'decision',
      decisionId: decision.id,
      optionIds: [optionId],
    })
    const steps: ReelStep[] = after.lastReel!.steps
    expect(steps.length).toBeGreaterThan(0)

    const order = ['metrics', 'consequence', 'market', 'reaction']
    const seen = steps.map((s) => order.indexOf(s.kind))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    steps.forEach((s, i) => expect(s.delayMs).toBe(i * 800))

    const metrics = steps.find((s) => s.kind === 'metrics')
    expect(metrics && metrics.kind === 'metrics' ? metrics.deltas.length : 0).toBeLessThanOrEqual(6)
  })

  it('renders every beat as a static list under reduced motion', async () => {
    const user = userEvent.setup()
    renderPlay()
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    const options = optionButtons()
    options[0]!.focus()
    await user.keyboard('1')
    await user.click(screen.getByRole('button', { name: /확정/ }))

    const summary = await screen.findByRole('heading', { name: '결과 요약' })
    const reel = summary.closest('[aria-labelledby="reel-title"]') as HTMLElement
    const beats = Array.from(reel.querySelectorAll('section[aria-label]')).map((s) =>
      s.getAttribute('aria-label'),
    )
    const canonical = ['지표 변화', '결과', '시장 반응', '감독·이사회 반응']
    const positions = beats.map((b) => canonical.indexOf(b ?? ''))
    expect(positions.length).toBeGreaterThan(0)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(beats).toContain('결과')
    expect(within(reel).getAllByText('결과').length).toBeGreaterThan(0)
    // A static list means no 건너뛰기 affordance is left on screen.
    expect(screen.queryByRole('button', { name: /건너뛰기/ })).toBeNull()
  })
})
