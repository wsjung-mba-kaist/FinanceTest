import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Welcome } from '@/components/onboarding/Welcome'
import { SCENARIOS } from '@/scenarios'

const availableCount = SCENARIOS.filter((e) => e.summary.status === 'available').length

/** `Welcome` links to the tour, so it needs a router. */
function renderWelcome(props: Parameters<typeof Welcome>[0]) {
  return render(
    <MemoryRouter>
      <Welcome {...props} />
    </MemoryRouter>,
  )
}

describe('Welcome', () => {
  it('introduces the product with one h1 and three cards', () => {
    renderWelcome({ expanded: true, onHide: () => {}, onShow: () => {} })
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('실제 위기 기록으로 훈련하는 의사결정 시뮬레이터')
    expect(screen.getByText(/계정도 서버도 없습니다/)).toBeInTheDocument()
    const cards = screen.getAllByRole('heading', { level: 2 })
    expect(cards.map((c) => c.textContent)).toEqual([
      '무엇을 하는가',
      '어떻게 진행되는가',
      '무엇을 평가하는가',
    ])
    // The count is derived from the registry, so this cannot go stale as scenarios land.
    expect(screen.getByText(new RegExp(`금융위기 ${availableCount}편`))).toBeInTheDocument()
    expect(screen.getByText(/7개 차원/)).toBeInTheDocument()
  })

  it('hides on request', async () => {
    const onHide = vi.fn()
    renderWelcome({ expanded: true, onHide, onShow: () => {} })
    await userEvent.click(screen.getByRole('button', { name: '처음 안내 숨기기' }))
    expect(onHide).toHaveBeenCalledOnce()
  })

  it('collapses to a single line with a way back', async () => {
    const onShow = vi.fn()
    renderWelcome({ expanded: false, onHide: () => {}, onShow })
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '안내 다시 보기' }))
    expect(onShow).toHaveBeenCalledOnce()
  })
})
