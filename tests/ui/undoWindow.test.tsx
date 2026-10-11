import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUndoWindow } from '@/lib/useUndoWindow'
import type { ScenarioDefinition } from '@/engine'
import { useGameStore, UNDO_MS } from '@/store/gameStore'
import { miniBank } from '../fixtures/miniBank'

/**
 * 되돌리기의 유일한 요구는 «되돌릴 수 있다고 말한 만큼 되돌아간다»이다. 여기서 깨졌던 세 가지:
 * 시간 초과 커밋에도 창이 열려 되돌리면 즉시 다시 시간 초과로 확정됐고, 만료 effect가 창을
 * 가리지 않고 지워 그 사이에 열린 새 창까지 닫았으며, 시계 틱이 창을 잘라 «5초»가 2초 만에
 * 사라졌다.
 */
describe('useUndoWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const windowAt = (until: number) => ({
    prevState: {} as never,
    prevHistory: [],
    decisionId: 'd',
    optionIds: ['a'],
    until,
  })

  it('counts down and expires exactly once, naming the window it closed', () => {
    const onExpire = vi.fn()
    const until = Date.now() + 1000
    const { result } = renderHook(() => useUndoWindow(windowAt(until), onExpire))
    expect(result.current.active).toBe(true)
    expect(result.current.secondsLeft).toBe(1)
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.active).toBe(false)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith(until)
  })

  it('a window replaced before it runs out never reports the old one as expired', () => {
    const onExpire = vi.fn()
    const first = Date.now() + 1000
    const { result, rerender } = renderHook(
      ({ until }: { until: number }) => useUndoWindow(windowAt(until), onExpire),
      { initialProps: { until: first } },
    )
    act(() => {
      vi.advanceTimersByTime(800)
    })
    const second = Date.now() + 1000
    rerender({ until: second })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    // The first window's deadline has passed, but it was replaced: still open, nothing expired.
    expect(result.current.active).toBe(true)
    expect(onExpire).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith(second)
  })
})

describe('gameStore undo window', () => {
  beforeEach(() => {
    localStorage.clear()
    useGameStore.getState().start(miniBank as unknown as ScenarioDefinition, 'standard', 1, 0)
  })
  afterEach(() => {
    useGameStore.getState().abandon()
  })

  it('opens a window for a player commit, none for a commit the clock made', () => {
    const store = useGameStore.getState()
    expect(store.choose('d0_disclosure', ['opt_a_backstopped'])).toBe(true)
    expect(useGameStore.getState().undoable).toBeDefined()
    expect(useGameStore.getState().undoChoice()).toBe(true)
    expect(useGameStore.getState().undoable).toBeUndefined()

    expect(
      useGameStore.getState().choose('d0_disclosure', ['opt_a_backstopped'], { timedOut: true }),
    ).toBe(true)
    expect(useGameStore.getState().undoable).toBeUndefined()
    expect(useGameStore.getState().undoChoice()).toBe(false)
  })

  it('clearUndo(until) closes only the window it names', () => {
    useGameStore.getState().choose('d0_disclosure', ['opt_a_backstopped'])
    const open = useGameStore.getState().undoable!
    useGameStore.getState().clearUndo(open.until - 1)
    expect(useGameStore.getState().undoable).toBe(open)
    useGameStore.getState().clearUndo(open.until)
    expect(useGameStore.getState().undoable).toBeUndefined()
  })

  it('the window is as long as the toast says', () => {
    const before = Date.now()
    useGameStore.getState().choose('d0_disclosure', ['opt_a_backstopped'])
    const { until } = useGameStore.getState().undoable!
    expect(until - before).toBeGreaterThanOrEqual(UNDO_MS)
    expect(until - before).toBeLessThan(UNDO_MS + 1000)
  })
})
