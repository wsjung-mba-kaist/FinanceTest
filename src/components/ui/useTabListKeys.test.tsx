import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { useTabListKeys } from './useTabListKeys'

/**
 * The keyboard contract every tab list in this app was missing.
 *
 * Without roving `tabIndex` each tab is its own tab stop, so reaching the panel behind a five-tab
 * bar costs five presses of Tab — and the arrow keys, which is what a screen-reader user reaches
 * for first, did nothing at all. Three separate tab lists on the play screen had this bug, plus
 * the shared `<Tabs>`; now they share one implementation.
 */
const IDS = ['a', 'b', 'c'] as const
type Id = (typeof IDS)[number]

function Harness() {
  const [value, setValue] = useState<Id>('a')
  const onKeyDown = useTabListKeys(IDS, value, setValue, { idFor: (id) => `tab-${id}` })
  return (
    <div role="tablist" aria-label="테스트" onKeyDown={onKeyDown}>
      {IDS.map((id) => (
        <button
          key={id}
          id={`tab-${id}`}
          role="tab"
          type="button"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          onClick={() => setValue(id)}
        >
          {id}
        </button>
      ))}
    </div>
  )
}

describe('useTabListKeys', () => {
  it('is a single tab stop', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
  })

  it('moves with the arrow keys and wraps', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'a' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'b' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'a' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'c' })).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'a' }).focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'c' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'a' })).toHaveAttribute('aria-selected', 'true')
  })

  it('leaves other keys to the browser', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'a' }).focus()
    await user.keyboard('x')
    expect(screen.getByRole('tab', { name: 'a' })).toHaveAttribute('aria-selected', 'true')
  })
})
