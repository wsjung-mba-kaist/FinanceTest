import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { useTickProgress, type ProgressStore } from './useSimulationClock'

/**
 * Tick progress must reach the dot without re-rendering anything else.
 *
 * It used to be `useState` inside `useSimulationClock`, set ten times a second: every component
 * under the play screen — the decision dock, the wire feed, every Recharts chart on the dashboard
 * — re-rendered ten times a second, for the thirty to fifty minutes a scenario takes, to animate
 * one dot's opacity. The subscriber below stands in for `TickDots`; the counter stands in for the
 * rest of the tree.
 */
function makeStore(): ProgressStore {
  let value = 0
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return
      value = v
      for (const fn of listeners) fn()
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

let parentRenders = 0
let dotRenders = 0

function Dot({ store }: { store: ProgressStore }) {
  dotRenders++
  const progress = useTickProgress(store)
  return <span data-testid="dot">{progress.toFixed(2)}</span>
}

function Tree({ store }: { store: ProgressStore }) {
  parentRenders++
  // Some state of its own, so the test can prove the parent *can* re-render.
  const [n, setN] = useState(0)
  return (
    <div>
      <button onClick={() => setN(n + 1)}>bump</button>
      <span data-testid="n">{n}</span>
      <Dot store={store} />
    </div>
  )
}

describe('useTickProgress', () => {
  it('re-renders only the subscriber when progress moves', () => {
    const store = makeStore()
    parentRenders = 0
    dotRenders = 0
    render(<Tree store={store} />)
    const parentBefore = parentRenders
    const dotBefore = dotRenders

    // Ten progress updates — one second of clock at the real 100 ms step.
    act(() => {
      for (let i = 1; i <= 10; i++) store.set(i / 10)
    })

    expect(screen.getByTestId('dot')).toHaveTextContent('1.00')
    expect(dotRenders, '점은 다시 그려져야 합니다').toBeGreaterThan(dotBefore)
    expect(parentRenders, '나머지 트리는 다시 그려지면 안 됩니다').toBe(parentBefore)
  })

  it('tolerates no store at all', () => {
    // A scenario without sub-turn ticks renders no clock affordance; the hook must still be safe
    // to call, because hooks cannot be called conditionally.
    function Bare() {
      return <span data-testid="bare">{useTickProgress(undefined)}</span>
    }
    render(<Bare />)
    expect(screen.getByTestId('bare')).toHaveTextContent('0')
  })
})
