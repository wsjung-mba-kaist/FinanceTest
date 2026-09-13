import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { getTurnView, type InstitutionState, type ScenarioDefinition } from '@/engine'
import { FundingBrief } from '@/components/play/FundingBrief'
import { PlayContext } from '@/components/play/playContext'
import { KpiHelp } from '@/components/help/KpiHelp'
import { useGameStore } from '@/store/gameStore'
import ldi from '@/scenarios/uk-ldi-2022/scenario'
import lego from '@/scenarios/legoland-2022/scenario'
import { asGeneric } from '../helpers/scenario'

afterEach(() => useGameStore.getState().abandon())

function setup<S extends InstitutionState>(source: ScenarioDefinition<S>) {
  const scenario = asGeneric(source)
  useGameStore.getState().start(scenario, 'expert', 3, 0)
  const { state, run, history } = useGameStore.getState()
  return {
    scenario,
    state: state!,
    run: run!,
    history,
    mode: 'expert' as const,
    view: getTurnView(state!, scenario, { mode: 'expert' }),
  }
}

it('makes cash ownership visible in a compact LDI decision view', () => {
  const value = setup(ldi)
  render(
    <PlayContext.Provider value={value}>
      <FundingBrief compact />
    </PlayContext.Provider>,
  )
  const region = screen.getByRole('region', { name: '결제 준비 현황' })
  expect(within(region).getByText('스킴 현금')).toBeVisible()
  expect(within(region).getByText('풀 내부 담보 현금')).toBeVisible()
  expect(within(region).getByText('풀 내부 적격 길트')).toBeVisible()
  expect(region).toHaveTextContent('풀 담보를 스킴 현금에 더하지 않습니다')
})

it('distinguishes a conditional ABCP purchase estimate from total payment needs', () => {
  const value = setup(lego)
  render(
    <PlayContext.Provider value={value}>
      <FundingBrief />
    </PlayContext.Provider>,
  )
  const region = screen.getByRole('region', { name: '결제 준비 현황' })
  expect(region).toHaveTextContent('미인출 은행 약정')
  expect(region).toHaveTextContent('자체매입 필요액 · 추정')
  expect(region).toHaveTextContent('CP·콜 상환, 마진콜, 추가 조달은 이 비교에 포함되지 않습니다')
  expect(region).not.toHaveTextContent('이번 턴 만기')
})

it('shows the pension liquid-assets formula in expert help without the securities formula', () => {
  const value = setup(ldi)
  render(
    <MemoryRouter>
      <KpiHelp scenario={value.scenario} state={value.state} expertTraining />
    </MemoryRouter>,
  )
  const section = screen.getByRole('region', { name: '스킴 현금+미담보 길트' })
  expect(section).toHaveTextContent('스킴 현금 + 직접보유 길트 시가 × (1 − 기담보 비중)')
  expect(section).not.toHaveTextContent('미인출 약정')
})
