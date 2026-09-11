import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest는 `globals: false`로 돌기 때문에 Testing Library의 자동 정리가 등록되지 않는다.
// 정리하지 않으면 이전 테스트의 DOM이 남아 `Found multiple elements …`로 실패한다.
afterEach(cleanup)
