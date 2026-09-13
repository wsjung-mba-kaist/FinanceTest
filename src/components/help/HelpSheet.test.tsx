import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createGame, getTurnView, type GameState, type ScenarioDefinition } from '@/engine'
import svb from '@/scenarios/svb-2023/scenario'
import { HelpProvider } from './HelpProvider'
import { useHelp } from './helpContext'

const scenario = svb as unknown as ScenarioDefinition
const state: GameState = createGame(scenario, 1) as unknown as GameState
const view = getTurnView(state, scenario, { mode: 'standard' })

function OpenKpis() {
  const help = useHelp()
  return (
    <button type="button" onClick={() => help.open({ tab: 'kpis', anchor: 'cash' })}>
      지표 설명 열기
    </button>
  )
}

function renderPlayHelp() {
  return render(
    <MemoryRouter>
      <HelpProvider context={{ page: 'play', scenario, state, view }}>
        <OpenKpis />
        <input aria-label="메모" />
      </HelpProvider>
    </MemoryRouter>,
  )
}

beforeAll(() => {
  // jsdom에는 구현이 없다.
  Element.prototype.scrollIntoView = () => {}
})

// vitest `globals: false`라 RTL 자동 정리가 등록되지 않는다.
afterEach(cleanup)

describe('HelpSheet', () => {
  it('`?`로 열리고 Esc로 닫힌다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('tablist', { name: '도움 탭' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('`H`로도 토글된다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    await user.keyboard('H')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('H')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('입력 중에는 단축키가 동작하지 않는다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    await user.click(screen.getByLabelText('메모'))
    await user.keyboard('h?')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('플레이 맥락에서 여섯 개 탭을 보여 준다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog')
    for (const label of [
      '이 결정에서',
      '지표 설명',
      '관련 카드·프레임워크',
      '용어집',
      '지식 검색',
      '규정·출처',
    ]) {
      expect(within(dialog).getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('지표 설명 탭이 시나리오 KPI를 빠짐없이 나열한다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    await user.click(screen.getByRole('button', { name: '지표 설명 열기' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('tab', { name: '지표 설명', selected: true })).toBeTruthy()
    for (const spec of scenario.kpis) {
      expect(
        within(dialog).getAllByRole('heading', {
          name:
            spec.metric === 'dailyOutflowPct'
              ? '현재 구간 유출률'
              : spec.metric === 'dailyOutflow'
                ? '현재 구간 예금 유출'
                : spec.label,
        }).length,
        `${spec.metric} (${spec.label}) 누락`,
      ).toBeGreaterThan(0)
    }
  })

  it('임계값이 없는 지표는 정상이 아니라 기준 없음으로 표시한다', async () => {
    const user = userEvent.setup()
    renderPlayHelp()
    await user.click(screen.getByRole('button', { name: '지표 설명 열기' }))
    const dialog = await screen.findByRole('dialog')
    // svb-2023은 누적 예금 유출(cumulativeOutflow) 등 임계값 없는 지표를 노출한다.
    expect(within(dialog).getAllByText('기준 없음').length).toBeGreaterThan(0)
  })

  it('시나리오 없는 맥락에서는 검색·규정·용어 세 탭만 보여 준다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HelpProvider context={{ page: 'catalog' }} />
      </MemoryRouter>,
    )
    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('tab')).toHaveLength(3)
    expect(within(dialog).getByRole('tab', { name: '지식 검색' })).toBeInTheDocument()
  })

  it('지식 검색이 그룹별 결과를 보여 준다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HelpProvider context={{ page: 'knowledge' }} />
      </MemoryRouter>,
    )
    await user.keyboard('?')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('지식 베이스 검색'), 'LCR')
    const links = await within(dialog).findAllByRole('link', { name: /유동성커버리지비율/ })
    expect(links.length).toBeGreaterThan(0)
    // 라이브 리전과 눈에 보이는 개수 줄이 함께 개수를 알린다.
    expect(within(dialog).getAllByText(/검색 결과/).length).toBeGreaterThanOrEqual(2)
  })
})
