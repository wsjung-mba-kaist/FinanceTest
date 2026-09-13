import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { autoplay, getTurnView, replay, type Mode } from '@/engine'
import { FundingBrief } from '@/components/play/FundingBrief'
import { PlayContext } from '@/components/play/playContext'
import { useGameStore } from '@/store/gameStore'
import svb from '@/scenarios/svb-2023/scenario'
import { asGeneric } from '../helpers/scenario'

const scenario = asGeneric(svb)
const played = autoplay(scenario, 'historical', { seed: 3, variance: 0 })
afterEach(() => useGameStore.getState().abandon())
function mount(mode: Mode, compact = false, turnIndex = 4) {
  useGameStore.getState().start(scenario, mode, 3, 0)
  const { state, history } = replay(scenario, {
    seed: 3,
    variance: 0,
    turnIndex,
    tick: 0,
    decisions: played.decisions.filter((d) => d.turnIndex < turnIndex),
  })
  const view = getTurnView(state, scenario, { mode })
  render(
    <PlayContext.Provider
      value={{ scenario, state, history, view, mode, run: useGameStore.getState().run! }}
    >
      <FundingBrief compact={compact} />
    </PlayContext.Provider>,
  )
}

it('opens the compact schedule without committing a decision and labels estimates and capacity', async () => {
  const user = userEvent.setup()
  mount('standard', true)
  expect(screen.getByRole('region', { name: '결제·자금 일정' })).toBeVisible()
  expect(screen.getByText(/현재 조건을 유지한 추정/)).toBeVisible()
  await user.click(screen.getByText('결제·자금 일정 자세히'))
  expect(screen.getByRole('table', { name: '남은 구간 시간대별 지급과 잔고 추정' })).toBeVisible()
  expect(screen.getByText(/한도 반영 예정:.*3월 10일.*05:00/)).toBeVisible()
  expect(screen.getByText(/한도 확인 후 인출 결정을 실행해야/)).toBeVisible()
  expect(screen.getByText(/확정 지급 원장은 제공되지 않습니다/)).toBeVisible()
  expect(useGameStore.getState().state!.decisions).toHaveLength(0)
})

it('retains pending follow-ups and hides retrospective sources in expert training', async () => {
  const user = userEvent.setup()
  mount('expert')
  await user.click(screen.getByText('결제·자금 일정 자세히'))
  expect(screen.getByText(/사후 출처는 종료 후 공개/)).toBeVisible()
  expect(screen.queryByRole('button', { name: /^출처 / })).not.toBeInTheDocument()
  expect(screen.getByText(/후속 처리 대기 .*건 · 미결 요청/)).toBeInTheDocument()
  expect(screen.queryByText(/다음 구간 반영 예정/)).not.toBeInTheDocument()
})

it('does not turn an unauthored window into a zero-payment claim or expose later checkpoints', () => {
  mount('standard', false, 0)
  expect(screen.getByText(/지급 의무가 없다는 뜻은 아닙니다/)).toBeVisible()
  expect(screen.getByText('미산정')).toBeVisible()
  expect(screen.queryByText(/목요일 마감 잔고 점검/)).not.toBeInTheDocument()
})
