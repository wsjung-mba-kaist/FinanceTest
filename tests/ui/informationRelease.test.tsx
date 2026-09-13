import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { getTurnView } from '@/engine'
import { OptionRow } from '@/components/play/OptionRow'
import { DecisionDock } from '@/components/play/DecisionDock'
import { InformationBasis } from '@/components/play/InformationBasis'
import { PlayContext } from '@/components/play/playContext'
import { rationaleTiming } from '@/components/play/playHelpers'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { miniBank } from '../fixtures/miniBank'
import { asGeneric } from '../helpers/scenario'

afterEach(() => {
  useGameStore.getState().abandon()
  useSettingsStore.getState().reset()
})

it.each(['mode', 'immediate', 'endOfTurn', 'endOfScenario'] as const)(
  'keeps expert rationale deferred with setting %s',
  (setting) => {
    expect(rationaleTiming(setting, 'expert')).toBe('endOfScenario')
  },
)

it('keeps authored influence arrows out of expert option summaries', () => {
  const option = {
    ...asGeneric(miniBank).turns[0]!.decisions[0]!.options[0]!,
    label: '검증 가능한 자금을 확보',
    description: '담보와 인출 조건을 확인합니다.',
    preview: [{ metric: 'cash', direction: 'up' as const, magnitude: 2 as const }],
  }
  const props = {
    ov: { option, available: true },
    letter: 'A',
    kpis: miniBank.kpis,
    role: 'radio' as const,
    checked: false,
    tabIndex: 0,
    expanded: false,
    buttonRef: () => {},
    onSelect: () => {},
    onToggleExpand: () => {},
    onFocusChange: () => {},
  }
  const { rerender } = render(<OptionRow {...props} mode="expert" />)
  expect(screen.getByRole('radio')).not.toHaveTextContent('▲')
  expect(screen.getByRole('radio')).toHaveTextContent('담보와 인출 조건을 확인합니다.')
  rerender(<OptionRow {...props} mode="standard" />)
  expect(screen.getByRole('radio')).toHaveTextContent('▲▲')
})

it('does not render immediate expert rationale after a real store commit', () => {
  const scenario = asGeneric(miniBank)
  const marker = '종료 후 공개할 해설 문장'
  const original = scenario.turns[0]!.decisions[0]!
  const modified = {
    ...scenario,
    turns: scenario.turns.map((t, i) =>
      i
        ? t
        : {
            ...t,
            decisions: t.decisions.map((d) => ({
              ...d,
              options: d.options.map((o) => ({ ...o, expert: { ...o.expert, rationale: marker } })),
            })),
          },
    ),
  }
  useSettingsStore.getState().update({ rationaleReveal: 'immediate', reducedMotion: true })
  useGameStore.getState().start(modified, 'expert', 3, 0)
  expect(useGameStore.getState().choose(original.id, [original.options[0]!.id])).toBe(true)
  const { state, run, history } = useGameStore.getState()
  const view = getTurnView(state!, modified, { mode: 'expert' })
  render(
    <MemoryRouter>
      <PlayContext.Provider
        value={{ scenario: modified, state: state!, run: run!, history, mode: 'expert', view }}
      >
        <DecisionDock sticky={false} onPreview={() => {}} onCommitted={() => {}} skipSignal={0} />
      </PlayContext.Provider>
    </MemoryRouter>,
  )
  expect(screen.queryByText(marker)).not.toBeInTheDocument()
  expect(rationaleTiming('immediate', 'standard')).toBe('immediate')
})

it('distinguishes reconstructed stress information from a public announcement', () => {
  const { rerender } = render(
    <InformationBasis
      information={{
        knownAt: '2023-03-13T06:00:00-07:00',
        basis: 'reconstructed',
        note: '모의 시세입니다.',
      }}
    />,
  )
  expect(screen.getByText('훈련 재구성 · 모의 시세입니다.')).toBeVisible()
  rerender(
    <InformationBasis information={{ knownAt: '2023-03-12T18:15:00-04:00', basis: 'public' }} />,
  )
  expect(screen.getByText('공개 자료')).toBeVisible()
})
