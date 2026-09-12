import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'

/**
 * Every route has exactly one `<h1>`.
 *
 * A heading outline is how a screen-reader user finds out where they are, and five of this app's
 * routes started mid-outline: the 404 page's title was a styled `<div>`, and the play screen — the
 * one a trainee spends 40 minutes on — had only `<h2>` zone headings under no page heading at all.
 *
 * Zero `h1` is the bug this catches. Two is also a bug, and a subtler one: it means two things on
 * the page both claim to be its subject.
 */
const ROUTES = [
  '#/',
  '#/knowledge',
  '#/knowledge/glossary',
  '#/knowledge/reading',
  '#/progress',
  '#/settings',
  '#/demo',
  '#/this-route-does-not-exist',
]

async function renderAt(hash: string) {
  window.location.hash = hash
  const view = render(<RouterProvider router={router} />)
  // Routes are lazy; wait for the suspense fallback to go away before counting.
  await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument(), {
    timeout: 5000,
  }).catch(() => undefined)
  return view
}

describe('heading outline', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it.each(ROUTES)('%s has exactly one h1', async (hash) => {
    await renderAt(hash)
    const h1s = await waitFor(
      () => {
        const found = screen.queryAllByRole('heading', { level: 1 })
        expect(found.length).toBeGreaterThan(0)
        return found
      },
      { timeout: 5000 },
    )
    expect(
      h1s.map((h) => h.textContent?.trim()),
      `${hash}: h1 이 ${h1s.length}개입니다`,
    ).toHaveLength(1)
  })
})
