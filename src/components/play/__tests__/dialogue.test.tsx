import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { InstitutionState, ScenarioDefinition } from '../../../engine'
import PlayPage from '../../../pages/PlayPage'
import { useGameStore } from '../../../store/gameStore'
import {
  BACKSTOP_COUNTER,
  DIALOGUE_DECISION_ID,
  DIALOGUE_INTERRUPT_ID,
  EXPERT_PATH,
  miniDialogue,
  miniDialogueInterrupt,
} from '../../../../tests/fixtures/miniDialogue'
import { TICKED_TURN_INDEX } from '../../../../tests/fixtures/miniTicks'

type AnyScenario = ScenarioDefinition<InstitutionState>

const scenario = miniDialogue as unknown as AnyScenario
const callScenario = miniDialogueInterrupt as unknown as AnyScenario

/** Desktop layout + reduced motion, matching the rest of the play tests. */
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

function renderPlay(sc: AnyScenario) {
  return render(
    <MemoryRouter initialEntries={[`/play/${sc.meta.id}`]}>
      <Routes>
        <Route path="/play/:scenarioId" element={<PlayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function panel(): HTMLElement {
  return document.querySelector(`[data-dialogue="${DIALOGUE_DECISION_ID}"]`) as HTMLElement
}

function replyButton(root: HTMLElement, id: string): HTMLElement {
  return root.querySelector(`[data-reply="${id}"]`) as HTMLElement
}

function transcript(root: HTMLElement): string {
  return within(root).getByRole('log').textContent ?? ''
}

function path(): string[] {
  return useGameStore.getState().dialoguePaths[DIALOGUE_DECISION_ID] ?? []
}

beforeEach(() => {
  localStorage.clear()
  stubEnvironment()
})

afterEach(() => {
  useGameStore.getState().abandon()
  document.documentElement.removeAttribute('data-reduced-motion')
})

describe('DialoguePanel in the decision dock', () => {
  beforeEach(() => {
    useGameStore.getState().start(scenario, 'standard', 1, 0)
  })

  it('replaces the option list with the counterparty’s opening lines and its replies', async () => {
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    const p = panel()
    expect(p).not.toBeNull()
    expect(transcript(p)).toContain('손실 규모를 확인해 주시겠습니까?')
    expect(replyButton(p, 'r-exact')).toBeInTheDocument()
    expect(replyButton(p, 'r-range')).toBeInTheDocument()
    expect(replyButton(p, 'r-defer')).toBeInTheDocument()
    // The bare option list and its 확정 bar are gone: you answer by talking.
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /결정 확정/ })).toBeNull()
  })

  it('grows the transcript with both sides as the conversation proceeds', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    await user.click(replyButton(panel(), 'r-exact'))
    await waitFor(() => expect(path()).toEqual(['r-exact']))

    const after = transcript(panel())
    // What they asked, what I answered, what they asked next.
    expect(after).toContain('손실 규모를 확인해 주시겠습니까?')
    expect(after).toContain('확정 손실 $18억을 수치로 보고')
    expect(after).toContain('백스톱은 몇 %까지 확보되어 있습니까?')
    // The numeric promise is a set of discrete replies, never a free-text box.
    expect(replyButton(panel(), `${BACKSTOP_COUNTER}-0`)).toBeInTheDocument()
    expect(replyButton(panel(), `${BACKSTOP_COUNTER}-100`)).toBeInTheDocument()
    expect(within(panel()).queryByRole('textbox')).toBeNull()
    expect(within(panel()).getByText(/이후 이행 여부로 평가됩니다/)).toBeInTheDocument()
  })

  it('walks the whole conversation with the number keys and resolves to the option', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    // 1 → 정확한 수치, 3 → 100% 확보, 1 → 오늘 공개  ⇒ opt_a_backstopped
    replyButton(panel(), 'r-exact').focus()
    await user.keyboard('1')
    await waitFor(() => expect(path()).toEqual(['r-exact']))
    await user.keyboard('3')
    await waitFor(() => expect(path()).toHaveLength(2))
    await user.keyboard('1')

    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))
    const record = useGameStore.getState().state!.decisions[0]!
    expect(record.optionIds).toEqual(['opt_a_backstopped'])
    expect(record.path).toEqual(EXPERT_PATH)
    expect(useGameStore.getState().state?.counters[BACKSTOP_COUNTER]).toBe(100)
    // The in-progress path is cleared once it has entered the log.
    expect(path()).toEqual([])
  })

  it('한 단계 되돌리기 takes the last answer back', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    const back = () => within(panel()).getByRole('button', { name: /한 단계 되돌리기/ })
    expect(back()).toBeDisabled()

    await user.click(replyButton(panel(), 'r-exact'))
    await waitFor(() => expect(path()).toEqual(['r-exact']))
    expect(back()).toBeEnabled()

    await user.click(back())
    await waitFor(() => expect(path()).toEqual([]))
    expect(transcript(panel())).not.toContain('확정 손실 $18억을 수치로 보고')
    expect(replyButton(panel(), 'r-defer')).toBeInTheDocument()
  })

  it('Backspace steps back too, and never commits anything on its own', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    await user.click(replyButton(panel(), 'r-range'))
    await waitFor(() => expect(path()).toEqual(['r-range']))
    // Esc must not walk away from a conversation already under way.
    await user.keyboard('{Escape}')
    expect(path()).toEqual(['r-range'])
    await user.keyboard('{Backspace}')
    await waitFor(() => expect(path()).toEqual([]))
    expect(useGameStore.getState().state?.decisions).toHaveLength(0)
  })

  it('the resolved row keeps the walked conversation', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    await user.click(replyButton(panel(), 'r-defer'))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))

    const resolved = document.querySelector(
      `[data-resolved="${DIALOGUE_DECISION_ID}"]`,
    ) as HTMLElement
    expect(resolved).not.toBeNull()
    expect(resolved.textContent).toContain('대화 기록 1단계')
    expect(resolved.textContent).toContain('집계가 끝난 뒤 보고하겠다고 답변')
  })

  it('undo restores the state and lets the conversation be walked again', async () => {
    const user = userEvent.setup()
    renderPlay(scenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    await user.click(replyButton(panel(), 'r-defer'))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: /실행 취소/ }))

    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(0))
    expect(path()).toEqual([])
    await waitFor(() => expect(replyButton(panel(), 'r-exact')).toBeInTheDocument())
  })
})

describe('DialoguePanel inside an interrupt overlay', () => {
  function startAtTickedTurn(sc: AnyScenario): void {
    const store = useGameStore.getState()
    store.start(sc, 'standard', 1, 0)
    store.choose('d0_disclosure', ['opt_a_backstopped'])
    store.next()
    expect(useGameStore.getState().state?.turnIndex).toBe(TICKED_TURN_INDEX)
  }

  it('negotiates on the phone and records the path on the interrupt record', async () => {
    const user = userEvent.setup()
    startAtTickedTurn(callScenario)
    renderPlay(callScenario)

    await user.click(await screen.findByRole('button', { name: /^시작/ }))
    await user.click(screen.getAllByRole('checkbox')[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(2))
    act(() => {
      useGameStore.getState().tickAdvance()
    })

    const dialog = await screen.findByRole('alertdialog')
    const call = dialog.querySelector(`[data-dialogue="${DIALOGUE_INTERRUPT_ID}"]`) as HTMLElement
    expect(call).not.toBeNull()
    expect(transcript(call)).toContain('지금 자금을 빼야 합니까?')

    await user.click(replyButton(call, 'c-open-numbers'))
    await waitFor(() =>
      expect(useGameStore.getState().dialoguePaths[DIALOGUE_INTERRUPT_ID]).toEqual([
        'c-open-numbers',
      ]),
    )
    expect(transcript(call)).toContain('담보 여력이 얼마나 남아 있습니까?')

    await user.click(replyButton(call, 'c-num-disclose'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    const record = useGameStore
      .getState()
      .state?.decisions.find((d) => d.decisionId === DIALOGUE_INTERRUPT_ID)
    expect(record).toMatchObject({
      optionIds: ['call_numbers'],
      interrupt: true,
      path: ['c-open-numbers', 'c-num-disclose'],
    })
  })
})

describe('a decision without steps is untouched', () => {
  it('still shows the option list and the 결정 확정 bar', async () => {
    const user = userEvent.setup()
    const { miniBank } = await import('../../../../tests/fixtures/miniBank')
    useGameStore.getState().start(miniBank as unknown as AnyScenario, 'standard', 1, 0)
    renderPlay(miniBank as unknown as AnyScenario)
    await screen.findByRole('heading', { name: /지금 요청받은 것/ })

    expect(document.querySelector('[data-dialogue]')).toBeNull()
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBeGreaterThan(0)
    await user.click(radios[0]!)
    await user.click(screen.getByRole('button', { name: /결정 확정/ }))
    await waitFor(() => expect(useGameStore.getState().state?.decisions).toHaveLength(1))
    expect(useGameStore.getState().state!.decisions[0]).not.toHaveProperty('path')
  })
})
