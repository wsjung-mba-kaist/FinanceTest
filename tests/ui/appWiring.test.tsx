import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'

/**
 * Guards the wiring done at integration time: the shell mounts a `HelpProvider`
 * for routes that do not supply a richer context, so the 도움 button and the
 * `?` / `H` shortcuts work everywhere instead of silently hitting the no-op
 * default context.
 */
async function renderAt(hash: string) {
  window.location.hash = hash
  const view = render(<RouterProvider router={router} />)
  await waitFor(() => expect(screen.queryByRole('status', { name: '' })).not.toBeInTheDocument(), {
    timeout: 3000,
  }).catch(() => undefined)
  return view
}

describe('app wiring', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shell renders the catalog and the help entry point', async () => {
    await renderAt('#/')
    expect(await screen.findByRole('button', { name: /도움/ }, { timeout: 5000 })).toBeVisible()
  })

  it('help sheet opens from the shell (provider is mounted above the route)', async () => {
    const user = userEvent.setup()
    await renderAt('#/')
    await user.click(await screen.findByRole('button', { name: /도움/ }, { timeout: 5000 }))
    expect(await screen.findByRole('dialog')).toBeVisible()
  })

  it('knowledge route also has a help context', async () => {
    const user = userEvent.setup()
    await renderAt('#/knowledge')
    await user.click(await screen.findByRole('button', { name: /도움/ }, { timeout: 5000 }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeVisible()
  })
})
