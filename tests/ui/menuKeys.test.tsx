import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useMenuKeys } from '@/components/ui/useMenuKeys'

/**
 * `role="menu"` promises arrow keys, Home/End, Escape and focus on the first item. The two play
 * menus carried the role and none of the behaviour; the hook is what they now share.
 */
function Harness() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const keys = useMenuKeys(ref, open, () => setOpen(false))
  return (
    <div>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(true)}>
        메뉴
      </button>
      {open && (
        <div role="menu" aria-label="테스트 메뉴" ref={ref} onKeyDown={keys}>
          <button type="button" role="menuitem">
            첫째
          </button>
          <button type="button" role="menuitem">
            둘째
          </button>
          <button type="button" role="menuitemradio" aria-checked="false">
            셋째
          </button>
        </div>
      )}
    </div>
  )
}

describe('useMenuKeys', () => {
  it('focuses the first item on open, walks with arrows and wraps, jumps with Home/End', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '메뉴' }))
    expect(screen.getByRole('menuitem', { name: '첫째' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: '둘째' })).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: '첫째' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitemradio', { name: '셋째' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: '둘째' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: '첫째' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '메뉴' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
