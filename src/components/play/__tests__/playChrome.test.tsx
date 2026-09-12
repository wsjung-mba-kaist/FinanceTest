import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { InstitutionState, ScenarioDefinition } from '../../../engine'
import PlayPage from '../../../pages/PlayPage'
import { useGameStore } from '../../../store/gameStore'
import { miniTicks, TICKED_TURN_INDEX } from '../../../../tests/fixtures/miniTicks'

/**
 * The situation room's chrome — the parts that are *around* the simulation rather than part of it.
 * Each case here is a defect that was on screen and that no existing test could see, because all
 * three are about which React tree an element is in rather than about what the engine computed.
 */
type AnyScenario = ScenarioDefinition<InstitutionState>
const ticked = miniTicks as unknown as AnyScenario

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

function renderPlay(scenario: AnyScenario) {
  return render(
    <MemoryRouter initialEntries={[`/play/${scenario.meta.id}`]}>
      <Routes>
        <Route path="/play/:scenarioId" element={<PlayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function startAtTickedTurn(scenario: AnyScenario): void {
  const store = useGameStore.getState()
  store.start(scenario, 'standard', 1, 0)
  store.choose('d0_disclosure', ['opt_a_backstopped'])
  store.next()
  expect(useGameStore.getState().state?.turnIndex).toBe(TICKED_TURN_INDEX)
}

beforeEach(() => {
  localStorage.clear()
  stubEnvironment()
})

afterEach(() => {
  useGameStore.getState().abandon()
  document.documentElement.removeAttribute('data-reduced-motion')
})

describe('play chrome', () => {
  /**
   * A7. `PlayView` called `useHelp()` at the top of the very component that rendered the
   * `HelpProvider` two hundred lines down, so the hook read the shell's no-op default. The status
   * bar advertised `?` and the shortcut did nothing — and the "help open ⇒ hold the clock" rule
   * could never fire, because `help.isOpen` was permanently false.
   */
  it('opens the help sheet from the ? shortcut', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await screen.findByText('이 턴의 과제')

    expect(screen.queryByRole('dialog')).toBeNull()
    document.body.focus()
    await user.keyboard('?')
    expect(await screen.findByRole('dialog')).toBeVisible()
  })

  it('opens the help sheet from the H shortcut and closes it again', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await screen.findByText('이 턴의 과제')

    document.body.focus()
    await user.keyboard('h')
    expect(await screen.findByRole('dialog')).toBeVisible()
    await user.keyboard('h')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  /**
   * A3. A global Space handler that always `preventDefault()`s takes Space away from every button
   * on the page. Tab to 시작 and press Space: before this, the clock toggled and the button did
   * not activate.
   */
  it('lets Space select the focused option instead of pausing the clock', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    expect(useGameStore.getState().clock.running).toBe(true)

    const option = screen.getAllByRole('checkbox')[0]!
    expect(option).toHaveAttribute('aria-checked', 'false')
    option.focus()
    await user.keyboard(' ')

    // The option took the key…
    expect(option).toHaveAttribute('aria-checked', 'true')
    // …and the clock did not: the player's intent is untouched.
    expect(useGameStore.getState().clock.running).toBe(true)
  })

  it('still toggles the clock with Space when focus is not on a control', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    expect(useGameStore.getState().clock.running).toBe(true)

    document.body.focus()
    await user.keyboard(' ')
    expect(useGameStore.getState().clock.running).toBe(false)
  })

  /**
   * A6. The pause/resume button was driven by whether the clock was *moving*, not by what the
   * player had asked for. With a required decision holding the clock, the button offered to
   * "resume" a clock the player had never paused.
   */
  it('labels the clock button by the player intent, not by whether it is moving', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    // Intent is "run" from here on, whether or not a hold stops the ticks.
    expect(useGameStore.getState().clock.running).toBe(true)
    expect(screen.getByRole('button', { name: '시계 일시정지' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: '시계 일시정지' }))
    expect(screen.getByRole('button', { name: '시계 재개' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  /** The situation room is a whole page; it needs a page heading like any other route. */
  it('has exactly one h1', async () => {
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await screen.findByText('이 턴의 과제')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /**
   * The decisive assertion for B1. The dock's primary action used to be the last child of the
   * scrolled list, held in place by `sticky bottom-0` — which an ancestor's `overflow-hidden`
   * silently disabled, so on a 1280×800 screen the 다음 턴 button started every turn below the
   * fold. Being outside the scroll box is not a nicer way to achieve the same thing; it is the
   * property that makes the bug impossible.
   */
  it('keeps the primary action outside the scrolling box', async () => {
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await screen.findByText('이 턴의 과제')

    const next = screen.getByRole('button', { name: /다음 턴으로|시나리오 마무리/ })
    const scroller = document.querySelector('#zone-decisions [data-zone-scroll]')
    expect(scroller, '결정 독에 스크롤 박스가 없습니다').not.toBeNull()
    expect(scroller!.contains(next)).toBe(false)
    expect(document.getElementById('zone-decisions')!.contains(next)).toBe(true)
  })

  /**
   * B2. Every pending decision used to be expanded at once, so the dock opened at ~740px with the
   * first 확정 bar already below the fold and three half-read questions competing.
   */
  it('expands one unresolved decision at a time', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await user.click(await screen.findByRole('button', { name: /^시작/ }))

    // The fixture's ticked turn has one open decision; whatever the count, only one option group
    // is on screen at a time.
    const groups = screen.queryAllByRole('group', { name: /선택지/ })
    expect(groups.length).toBeLessThanOrEqual(1)
    expect(screen.queryAllByRole('button', { name: /결정 확정/ }).length).toBeLessThanOrEqual(1)
  })
})
