import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTurnView } from '@/engine'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { PlayContext } from '@/components/play/playContext'
import { InterruptOverlay } from '@/components/play/InterruptOverlay'
import { OptionComparison } from '@/components/play/OptionComparison'
import { HelpSheet } from '@/components/help/HelpSheet'
import { RestrictedKnowledgeContext } from '@/components/knowledge/knowledgeAccess'
import { Markdown } from '@/components/knowledge/Markdown'
import { miniBank } from '../fixtures/miniBank'
import { miniTicks } from '../fixtures/miniTicks'
import { asGeneric } from '../helpers/scenario'

afterEach(() => {
  useGameStore.getState().abandon()
  useSettingsStore.getState().reset()
  vi.useRealTimers()
})

describe('practitioner training controls', () => {
  it('compares alternatives without committing a decision', async () => {
    const user = userEvent.setup()
    const scenario = asGeneric(miniBank)
    useGameStore.getState().start(scenario, 'guided', 1, 0)
    const { state, run, history } = useGameStore.getState()
    const view = getTurnView(state!, scenario, { mode: 'guided' })
    render(
      <MemoryRouter>
        <PlayContext.Provider
          value={{ scenario, state: state!, run: run!, history, mode: 'guided', view }}
        >
          <OptionComparison dv={view.decisions[0]!} />
        </PlayContext.Provider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '대안 2–3개 나란히 비교' }))
    const checks = screen.getAllByRole('checkbox')
    await user.click(checks[0]!)
    await user.click(checks[1]!)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(useGameStore.getState().state?.decisions).toHaveLength(0)
    expect(screen.getAllByLabelText('예상 영향')).toHaveLength(2)
  })

  it.each([
    ['guided', true],
    ['standard', false],
    ['expert', false],
  ] as const)('keeps %s calls open when timersEnabled=%s', (mode, timersEnabled) => {
    vi.useFakeTimers()
    const base = asGeneric(miniTicks)
    const scenario = {
      ...base,
      turns: base.turns.map((t) => ({
        ...t,
        interrupts: t.interrupts?.map((i) => ({ ...i, timeoutSec: 0.1 })),
      })),
    }
    useSettingsStore.getState().update({ timersEnabled })
    const g = useGameStore.getState()
    g.start(scenario, mode, 1, 0)
    g.choose('d0_disclosure', ['opt_a_backstopped'])
    g.next()
    g.choose('d1_funding', ['draw_fhlb'])
    g.tickAdvance()
    const { state, run, history } = useGameStore.getState()
    const view = getTurnView(state!, scenario, { mode })
    const onAnswered = vi.fn()
    expect(view.interrupts).toHaveLength(1)
    render(
      <MemoryRouter>
        <PlayContext.Provider value={{ scenario, state: state!, run: run!, history, mode, view }}>
          <InterruptOverlay dv={view.interrupts[0]!} onAnswered={onAnswered} />
        </PlayContext.Provider>
      </MemoryRouter>,
    )
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('응답 시간 제한 없음')).toBeVisible()
    expect(onAnswered).not.toHaveBeenCalled()
    expect(useGameStore.getState().state?.openInterrupts).toHaveLength(1)
  })

  it('defers expert supplemental material across help and inline links', () => {
    const scenario = asGeneric(miniBank)
    const { rerender } = render(
      <MemoryRouter>
        <HelpSheet
          context={{ page: 'briefing', scenario, mode: 'expert' }}
          target={{ tab: 'cards' }}
          onTarget={() => {}}
          open
          onClose={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/전문가 모드에서는 사후 학습 자료/)).toBeVisible()
    rerender(
      <MemoryRouter>
        <RestrictedKnowledgeContext.Provider value>
          <Markdown>{'[학습](https://example.com/future) · [LCR](term:lcr)'}</Markdown>
        </RestrictedKnowledgeContext.Provider>
      </MemoryRouter>,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/학습/)).toBeVisible()
  })
})
