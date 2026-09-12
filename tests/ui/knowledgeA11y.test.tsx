import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Citation } from '@/components/knowledge/Citation'
import { GlossaryTerm } from '@/components/knowledge/GlossaryTerm'
import { Markdown } from '@/components/knowledge/Markdown'
import { InfoTip } from '@/components/ui/InfoTip'
import { GLOSSARY } from '@/content'

/**
 * The three "walk it with the keyboard" checks, mechanised.
 *
 * All three controls hid something behind a `role="tooltip"`, and a tooltip closes on blur —
 * which is what pressing Tab does. So every link inside one was visible and unreachable, and an
 * `onMouseDown` preventDefault kept it alive for the mouse while leaving keyboard users with a
 * control they could see and never press. Each got a different fix, so each is checked here.
 *
 * See docs/ui-conventions.md §10.
 */
function renderIn(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const term = GLOSSARY[0]

describe.skipIf(!term)('glossary term', () => {
  it('is a link, so activating it goes somewhere', () => {
    renderIn(<GlossaryTerm id={term!.id} />)
    // The trigger itself is the destination; the tooltip holds only the definition.
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining(`term-${term!.id}`))
  })

  it('shows the definition on focus and holds no controls', async () => {
    const user = userEvent.setup()
    renderIn(<GlossaryTerm id={term!.id} />)
    await user.tab()
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent(term!.definition.ko.slice(0, 12))
    // A tooltip with a link in it is a link no keyboard can reach.
    expect(within(tip).queryAllByRole('link')).toHaveLength(0)
    expect(within(tip).queryAllByRole('button')).toHaveLength(0)
  })

  it('is a single tab stop', async () => {
    const user = userEvent.setup()
    renderIn(
      <>
        <GlossaryTerm id={term!.id} />
        <button type="button">다음</button>
      </>,
    )
    await user.tab()
    expect(screen.getByRole('link')).toHaveFocus()
    await user.tab()
    // One more Tab leaves the term entirely — it does not land inside the tooltip.
    expect(screen.getByRole('button', { name: '다음' })).toHaveFocus()
  })
})

describe('citation', () => {
  const ids = ['fed-svb-review-2023']

  it('is a disclosure, not a tooltip', async () => {
    const user = userEvent.setup()
    renderIn(<Citation ids={ids} />)
    const chip = screen.getByRole('button')
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps the panel open long enough to reach what is in it', async () => {
    const user = userEvent.setup()
    renderIn(<Citation ids={ids} />)
    await user.click(screen.getByRole('button'))
    // Tab must not dismiss it — that was the whole bug: the source URL was visible and,
    // because blur closed the panel, unreachable.
    await user.tab()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape and gives focus back to the chip', async () => {
    const user = userEvent.setup()
    renderIn(<Citation ids={ids} />)
    const chip = screen.getByRole('button')
    await user.click(chip)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(chip).toHaveAttribute('aria-expanded', 'false'))
    expect(chip).toHaveFocus()
  })
})

describe('InfoTip', () => {
  it('is a plain tooltip when it holds only text', async () => {
    const user = userEvent.setup()
    renderIn(<InfoTip label="설명">그냥 설명입니다</InfoTip>)
    const trigger = screen.getByRole('button', { name: '설명' })
    expect(trigger).not.toHaveAttribute('aria-expanded')
    await user.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('그냥 설명입니다')
  })

  it('becomes a disclosure when it holds an action', async () => {
    const user = userEvent.setup()
    let opened = 0
    renderIn(
      <InfoTip label="설명" onOpenMore={() => (opened += 1)} moreLabel="자세히">
        본문
      </InfoTip>,
    )
    const trigger = screen.getByRole('button', { name: '설명' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // And the action inside is now reachable — it used to blur away before it could be pressed.
    await user.click(screen.getByRole('button', { name: /자세히/ }))
    expect(opened).toBe(1)
  })
})

describe('markdown tables', () => {
  const md = ['| 지표 | 값 |', '| --- | --- |', '| LCR | 97% |'].join('\n')

  it('renders a real table, not a scrollable block', () => {
    renderIn(<Markdown>{md}</Markdown>)
    // `display: block` on a <table> removes it from the accessibility tree *as a table* — the
    // rows and header cells stop being announced as such, in a product whose regulatory tables
    // are the point. Scrolling belongs on a wrapper.
    const table = screen.getByRole('table')
    expect(table.tagName).toBe('TABLE')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
    expect(within(table).getAllByRole('row')).toHaveLength(2)
  })

  it('puts the scroll box outside the table and makes it reachable', () => {
    renderIn(<Markdown>{md}</Markdown>)
    const group = screen.getByRole('group', { name: '표' })
    expect(group.tagName).toBe('DIV')
    expect(group).toHaveAttribute('tabindex', '0')
    expect(within(group).getByRole('table')).toBeInTheDocument()
  })
})
