import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Interrupt, ScenarioDefinition, InstitutionState, Turn } from '../../../engine'
import PlayPage from '../../../pages/PlayPage'
import { useGameStore } from '../../../store/gameStore'
import { miniBank } from '../../../../tests/fixtures/miniBank'
import { miniTicks, TICKED_TURN_INDEX } from '../../../../tests/fixtures/miniTicks'

type AnyScenario = ScenarioDefinition<InstitutionState>

const ticked = miniTicks as unknown as AnyScenario
const plain = miniBank as unknown as AnyScenario

/** Same ticked fixture, but the phone rings out in 0.3 s so the timeout path is testable. */
function withShortInterrupt(seconds: number): AnyScenario {
  const turns = ticked.turns.map((t, i) => {
    if (i !== TICKED_TURN_INDEX) return t
    const interrupts = (t.interrupts ?? []).map((it) => ({ ...it, timeoutSec: seconds }))
    return { ...t, interrupts } as Turn<InstitutionState>
  })
  return { ...ticked, meta: { ...ticked.meta, id: 'mini-ticks-short' }, turns }
}

/** Desktop layout: both columns mount. Reduced motion is opt-in per test. */
function stubEnvironment(reducedMotion: boolean): void {
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
  document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false')
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

/**
 * Starts a run at the ticked turn: T0's disclosure answered, then one turn advance.
 * `variance: 0` keeps the fixture's event/interrupt schedule fixed (no tick jitter).
 */
function startAtTickedTurn(scenario: AnyScenario): void {
  const store = useGameStore.getState()
  store.start(scenario, 'standard', 1, 0)
  store.choose('d0_disclosure', ['opt_a_backstopped'])
  store.next()
  expect(useGameStore.getState().state?.turnIndex).toBe(TICKED_TURN_INDEX)
}

function stripText(): string {
  return screen.getByLabelText('핵심 유동성 지표').textContent ?? ''
}

beforeEach(() => {
  localStorage.clear()
  stubEnvironment(true)
})

afterEach(() => {
  useGameStore.getState().abandon()
  document.documentElement.removeAttribute('data-reduced-motion')
})

describe('live simulation clock', () => {
  it('gates the ticked turn behind 이 턴의 과제, then moves the tick and the strip with it', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    // The turn opens on the intro card with the clock stopped.
    expect(await screen.findByText('이 턴의 과제')).toBeInTheDocument()
    expect(useGameStore.getState().clock.running).toBe(false)
    expect(screen.getByRole('img', { name: '틱 1/3' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^시작/ }))
    expect(useGameStore.getState().clock.running).toBe(true)
    expect(screen.queryByText('이 턴의 과제')).toBeNull()

    // The required decision holds the clock; answering it releases it.
    const options = screen.getAllByRole('checkbox')
    await user.click(options[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(2))

    const before = stripText()
    act(() => {
      useGameStore.getState().tickAdvance()
    })

    await waitFor(() => expect(screen.getByRole('img', { name: '틱 2/3' })).toBeInTheDocument())
    expect(useGameStore.getState().state?.tick).toBe(1)
    expect(stripText()).not.toBe(before)
    // The clock label follows the authored tick labels.
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('holds the clock while a phone call is open and commits the default on timeout', async () => {
    const user = userEvent.setup()
    const scenario = withShortInterrupt(0.3)
    startAtTickedTurn(scenario)
    renderPlay(scenario)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    await user.click(screen.getAllByRole('checkbox')[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(2))

    act(() => {
      useGameStore.getState().tickAdvance()
    })

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getAllByText('파운더스 파트너').length).toBeGreaterThan(0)
    expect(useGameStore.getState().state?.openInterrupts).toEqual(['i1_partner_call'])
    // The clock stops on its own and says so — twice, on purpose: once as the pause button's
    // accessible name (which is all a sighted user used to get, via a tooltip) and once as the
    // ribbon under the strip, which is the visible answer to "why isn't time passing".
    const held = screen.getAllByText('전화 응답 대기 — 시계가 멈췄습니다')
    expect(held.length).toBeGreaterThanOrEqual(1)
    // At least one of them is the ribbon: a live region, not a tooltip.
    expect(held.some((el) => el.closest('[role="status"]') !== null)).toBe(true)
    expect(useGameStore.getState().clock.running).toBe(true)

    // 0.3 s × 표준 1.5 = 450 ms, then the authored default answer is committed for the player.
    await waitFor(
      () => {
        const record = useGameStore
          .getState()
          .state?.decisions.find((d) => d.decisionId === 'i1_partner_call')
        expect(record).toMatchObject({ optionIds: ['call_defer'], timedOut: true, interrupt: true })
      },
      { timeout: 4000 },
    )
    expect(useGameStore.getState().state?.openInterrupts).toEqual([])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('answers a phone call from the overlay and records the chosen reply', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    await user.click(screen.getAllByRole('checkbox')[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(2))
    act(() => {
      useGameStore.getState().tickAdvance()
    })

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: /검증 가능한 여력 수치를 제시/ }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    const record = useGameStore
      .getState()
      .state?.decisions.find((d) => d.decisionId === 'i1_partner_call')
    expect(record).toMatchObject({ optionIds: ['call_numbers'], interrupt: true, tick: 1 })
    expect(record).not.toHaveProperty('timedOut')
  })

  it('advances the tick on its own once nothing is being asked of the player', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    await user.click(screen.getAllByRole('checkbox')[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(2))

    // A 300 ms tick keeps the test honest about the interval without making it slow.
    act(() => {
      useGameStore.setState({ clock: { running: true, speed: 1, baseTickMs: 300 } })
    })
    await waitFor(() => expect(useGameStore.getState().state?.tick).toBe(1), { timeout: 4000 })
    // …and stops there, because the arriving call holds it.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    // The feed separates the two ticks by their authored clock labels.
    await user.click(screen.getByRole('tab', { name: /피드 전체/ }))
    await waitFor(() =>
      expect(document.querySelectorAll('[data-tick-separator]').length).toBeGreaterThan(0),
    )
  })

  it('keeps running while a required decision is still open, so deliberation costs time', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(ticked)
    renderPlay(ticked)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    // d1_funding is required and unanswered. The run-off must not wait for the player.
    expect(
      useGameStore.getState().state?.decisions.some((d) => d.decisionId === 'd1_funding'),
    ).toBe(false)

    act(() => {
      useGameStore.setState({ clock: { running: true, speed: 1, baseTickMs: 300 } })
    })
    await waitFor(() => expect(useGameStore.getState().state?.tick).toBe(1), { timeout: 4000 })
  })

  it('shows the 마감 caption and greys out a decision that is not open yet', async () => {
    startAtTickedTurn(ticked)
    renderPlay(ticked)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    // d1_desk opens at tick 1 and is due at tick 1.
    const upcoming = document.querySelector('[data-upcoming="d1_desk"]')
    expect(upcoming).not.toBeNull()
    expect(upcoming?.textContent).toContain('10:00 이후 선택 가능')
    expect(upcoming?.textContent).toContain('마감 10:00')
  })
})

describe('engine consequence reel', () => {
  beforeEach(() => stubEnvironment(false))

  it('plays once per lastReel.id and does not replay a reel already seen', async () => {
    const user = userEvent.setup()
    useGameStore.getState().start(plain, 'standard', 1, 0)
    const view = renderPlay(plain)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    await user.click(screen.getAllByRole('radio')[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))

    await screen.findByRole('heading', { name: '결과 요약' })
    const reelId = useGameStore.getState().state?.lastReel?.id
    expect(reelId).toBeTruthy()

    // Still mid-playback: the skip affordance is on screen and the reel is not marked played.
    expect(screen.getByRole('button', { name: /건너뛰기/ })).toBeInTheDocument()
    expect(useGameStore.getState().playedReelId).not.toBe(reelId)

    await user.click(screen.getByRole('button', { name: /건너뛰기/ }))
    await waitFor(() => expect(useGameStore.getState().playedReelId).toBe(reelId))

    // Re-entering the screen shows the summary but never replays it.
    view.unmount()
    renderPlay(plain)
    expect(await screen.findByRole('heading', { name: '결과 요약' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /건너뛰기/ })).toBeNull()
    expect(useGameStore.getState().playedReelId).toBe(reelId)
  })
})

describe('a scenario without ticks', () => {
  it('renders no clock affordance and ignores Space', async () => {
    const user = userEvent.setup()
    useGameStore.getState().start(plain, 'standard', 1, 0)
    renderPlay(plain)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    expect(screen.queryByRole('button', { name: /시계 (일시정지|재개)/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /시계 속도/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /^틱 / })).toBeNull()
    expect(screen.queryByText('이 턴의 과제')).toBeNull()

    const before = useGameStore.getState().state
    document.body.focus()
    await user.keyboard(' ')
    expect(useGameStore.getState().clock.running).toBe(false)
    expect(useGameStore.getState().state).toBe(before)
  })
})

describe('interrupts and the store', () => {
  it('refuses an interrupt answer while none is open', () => {
    startAtTickedTurn(ticked)
    expect(useGameStore.getState().respondInterrupt('i1_partner_call', ['call_defer'])).toBe(false)
    expect(useGameStore.getState().state?.decisions).toHaveLength(1)
  })

  it('tickAdvance stops at the last tick of a turn', () => {
    startAtTickedTurn(ticked)
    const store = useGameStore.getState()
    store.choose('d1_funding', ['draw_fhlb'])
    expect(store.tickAdvance()).toBe(true)
    expect(store.tickAdvance()).toBe(true)
    expect(useGameStore.getState().state?.tick).toBe(2)
    expect(store.tickAdvance()).toBe(false)
  })
})

/** Type-only guard: the fixture really does author an interrupt. */
const _partnerCall: Interrupt | undefined = (
  ticked.turns[TICKED_TURN_INDEX]?.interrupts as Interrupt[] | undefined
)?.[0]
void _partnerCall
