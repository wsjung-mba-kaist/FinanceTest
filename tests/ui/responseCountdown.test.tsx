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

  /**
   * `held` 는 훅이 처음부터 받던 네 번째 인자인데, 이 파일은 그것을 **한 번도 넘기지 않았다.**
   * 그래서 결정 독은 도움 시트에 예산을 멈추고 돌발 대응 오버레이는 멈추지 않는 상태가 테스트를
   * 그대로 통과했다 — 화면이 «사건 진행은 멈춰 있습니다» 라고 적는 동안 예산만 타고 있었다.
   */
  it('stops the budget while the caller holds it, and resumes with what was left', () => {
    const expire = vi.fn()
    const { result, rerender } = renderHook(
      ({ held }) => useResponseCountdown(1000, true, expire, held),
      { initialProps: { held: false } },
    )
    act(() => vi.advanceTimersByTime(250))
    rerender({ held: true })
    act(() => vi.advanceTimersByTime(60000))
    expect(result.current.remainingMs).toBe(750)
    expect(result.current.stopped).toBe(true)
    expect(expire).not.toHaveBeenCalled()
    rerender({ held: false })
    act(() => vi.advanceTimersByTime(750))
    expect(expire).toHaveBeenCalledTimes(1)
  })

  /**
   * 결정을 바꿔 열었다 돌아오면 `DecisionBlock` 이 새로 마운트된다. 그때 예산이 처음부터 다시
   * 시작하면 시간 압박 훈련이 무의미해지므로, 독은 남은 예산을 `limitMs` 로 넘겨 재개한다.
   */
  it('resumes from a shortened budget rather than starting over', () => {
    const expire = vi.fn()
    const { result } = renderHook(() => useResponseCountdown(400, true, expire))
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.remainingMs).toBe(150)
    // 틱은 250ms 마다다 — 남은 150ms 는 다음 틱에 소진된다.
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.remainingMs).toBe(0)
    expect(expire).toHaveBeenCalledTimes(1)
  })
})
