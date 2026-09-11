import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DemoPage from '@/pages/DemoPage'

/**
 * The tour runs the real engine (`replay` → `getTurnView` → `previewOption` → `applyDecision`) on a
 * registered scenario, so this test also fails if that scenario stops loading or its second turn
 * stops offering a decision. It must never touch the game store or localStorage.
 */
function renderDemo() {
  return render(
    <MemoryRouter initialEntries={['/demo']}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('90초 둘러보기', () => {
  it('walks 상황 → 지표 → 결정 → 결과 and ends on a link into the scenario', async () => {
    const user = userEvent.setup()
    renderDemo()

    await screen.findByRole('heading', { name: '90초 둘러보기' })
    await waitFor(() => expect(screen.queryByText('불러오는 중입니다…')).not.toBeInTheDocument())

    // 1. 상황 — a headline is shown, not a placeholder.
    const steps = screen.getByRole('list', { name: '둘러보기 단계' })
    expect(steps).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /다음/ }))

    // 2. 지표 — four figures with a status each.
    await screen.findByRole('heading', { name: '핵심 지표' })
    await user.click(screen.getByRole('button', { name: /다음/ }))

    // 3. 결정 — 확정 is blocked until something is picked, and picking shows a preview.
    const commit = await screen.findByRole('button', { name: /확정하고 결과 보기/ })
    expect(commit).toBeDisabled()
    const options = screen.getAllByRole('button', { pressed: false })
    const option = options.find((b) => b.textContent && b.textContent.length > 10)
    expect(option).toBeDefined()
    await user.click(option!)
    expect(await screen.findByRole('button', { name: /확정하고 결과 보기/ })).toBeEnabled()

    // 4. 결과 — the commit produces real consequence text and a way into the scenario.
    await user.click(screen.getByRole('button', { name: /확정하고 결과 보기/ }))
    await screen.findByRole('heading', { name: '결과' })
    expect(screen.getByRole('link', { name: /이 시나리오 시작하기/ })).toBeInTheDocument()
  })

  it('writes nothing to localStorage', async () => {
    localStorage.clear()
    renderDemo()
    await waitFor(() => expect(screen.queryByText('불러오는 중입니다…')).not.toBeInTheDocument())
    expect(localStorage.length).toBe(0)
  })
})
