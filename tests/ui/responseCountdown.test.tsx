import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResponseCountdown } from '@/lib/useResponseCountdown'

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

describe('response time budget', () => {
  it('does not expire when disabled and respects an explicit pause', () => {
    const expire = vi.fn()
    const { result, rerender } = renderHook(
      ({ enabled }) => useResponseCountdown(1000, enabled, expire),
      { initialProps: { enabled: false } },
    )
    act(() => vi.advanceTimersByTime(5000))
    expect(expire).not.toHaveBeenCalled()
    rerender({ enabled: true })
    act(() => vi.advanceTimersByTime(250))
    act(() => result.current.togglePause())
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.remainingMs).toBe(750)
    act(() => result.current.togglePause())
    act(() => vi.advanceTimersByTime(750))
    expect(expire).toHaveBeenCalledTimes(1)
  })

  it('does not charge hidden-tab time and resumes with the remaining budget', () => {
    const expire = vi.fn()
    const { result } = renderHook(() => useResponseCountdown(1000, true, expire))
    act(() => vi.advanceTimersByTime(250))
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => vi.advanceTimersByTime(60000))
    expect(result.current.remainingMs).toBe(750)
    expect(expire).not.toHaveBeenCalled()
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => vi.advanceTimersByTime(750))
    expect(expire).toHaveBeenCalledTimes(1)
  })
})
