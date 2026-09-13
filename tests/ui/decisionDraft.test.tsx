import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { getTurnView } from '@/engine'
import { DecisionDock } from '@/components/play/DecisionDock'
import { PlayContext } from '@/components/play/playContext'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { miniBank } from '../fixtures/miniBank'
import { asGeneric } from '../helpers/scenario'

afterEach(() => {
  useGameStore.getState().abandon()
  useSettingsStore.getState().reset()
})

/**
 * 열린 결정을 바꿔도 적어 둔 것은 남는다.
 *
 * 독은 미결 결정을 하나만 펼치고 `DecisionBlock` 의 `key` 가 결정 id 라, 다른 결정을 열면 통째로
 * 언마운트된다. 예전에는 그래서 잃는 것이 메모 하나였다. 판단 기록 세 칸이 생기면서 한 번의
 * 전환으로 **네 칸**이 사라지고 응답 예산까지 처음부터 다시 시작했다 — 한 턴에 결정이 둘 이상
 * 열리는 시나리오에서 실제로 밟는 경로다.
 */
const base = asGeneric(miniBank)
const twoDecisions = {
  ...base,
  turns: base.turns.map((t, i) =>
    i === 0
      ? {
          ...t,
          decisions: [
            t.decisions[0]!,
            { ...base.turns[1]!.decisions[0]!, id: 'd0_second', title: '두 번째 결정' },
          ],
        }
      : t,
  ),
}

function renderDock() {
  useGameStore.getState().start(twoDecisions, 'guided', 3, 0)
  const { state, run, history } = useGameStore.getState()
  const view = getTurnView(state!, twoDecisions, { mode: 'guided' })
  expect(view.decisions.length, '두 결정이 함께 열려 있어야 이 경로를 밟는다').toBe(2)
  render(
    <MemoryRouter>
      <PlayContext.Provider
        value={{ scenario: twoDecisions, state: state!, run: run!, history, mode: 'guided', view }}
      >
        <DecisionDock sticky={false} onPreview={() => {}} onCommitted={() => {}} skipSignal={0} />
      </PlayContext.Provider>
    </MemoryRouter>,
  )
}

describe('decision drafts', () => {
  it('survive switching to another decision and back', async () => {
    const user = userEvent.setup()
    renderDock()

    await user.click(screen.getByRole('button', { name: /판단 기록/ }))
    await user.type(screen.getByLabelText(/확인한 근거/), '담보 확인함')
    await user.type(screen.getByLabelText(/판단을 바꿀 조건/), '결제 지연 시')

    // 접힌 컨트롤은 네 칸 중 하나라도 차면 «작성됨» 이라고 말한다.
    await user.click(screen.getByRole('button', { name: /판단 기록/ }))
    expect(screen.getByRole('button', { name: /판단 기록 \(작성됨\)/ })).toBeVisible()

    // 두 번째 결정을 열었다가 돌아온다 — 그 사이 `DecisionBlock` 이 언마운트된다.
    await user.click(screen.getByRole('button', { name: /두 번째 결정/ }))
    expect(screen.queryByRole('button', { name: /판단 기록 \(작성됨\)/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /손실 공개 방식/ }))

    await user.click(screen.getByRole('button', { name: /판단 기록/ }))
    expect(screen.getByLabelText(/확인한 근거/)).toHaveValue('담보 확인함')
    expect(screen.getByLabelText(/판단을 바꿀 조건/)).toHaveValue('결제 지연 시')
    expect(screen.getByLabelText(/아직 확인하지 못한 가정/)).toHaveValue('')
  })

  it('keeps one decision draft out of another', async () => {
    const user = userEvent.setup()
    renderDock()
    await user.click(screen.getByRole('button', { name: /판단 기록/ }))
    await user.type(screen.getByLabelText(/확인한 근거/), '첫 번째')
    await user.click(screen.getByRole('button', { name: /두 번째 결정/ }))
    await user.click(screen.getByRole('button', { name: /판단 기록/ }))
    expect(screen.getByLabelText(/확인한 근거/)).toHaveValue('')
  })
})
