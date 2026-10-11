import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest는 `globals: false`로 돌기 때문에 Testing Library의 자동 정리가 등록되지 않는다.
// 정리하지 않으면 이전 테스트의 DOM이 남아 `Found multiple elements …`로 실패한다.
afterEach(cleanup)

// jsdom has no layout engine: `ResizeObserver` does not exist and `window.scrollTo` throws
// "Not implemented". Both are called by components that merely *react* to layout (chart sizing,
// scroll-to-top on navigation), so a silent no-op is the faithful stand-in. Without these the run
// printed two dozen stack traces per suite and real failures hid between them.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}
