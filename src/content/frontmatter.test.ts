import { describe, expect, it } from 'vitest'
import { asStringArray, parseFrontmatter } from './frontmatter'

/**
 * `pnpm format` 한 번이 근거를 지우지 못하게 한다.
 *
 * 파서가 줄 단위였을 때, prettier(printWidth 100)가 긴 `sources:` 배열을 여러 줄로 펴 놓으면
 * 파서는 그것을 **빈 배열**로 읽었다. 콘텐츠 30개 중 22개의 `sources:` 줄이 100자를 넘으므로
 * 서식 명령 한 번에 대부분의 인용이 사라질 수 있었다 — 그리고 카드 쪽에는 그것을 잡는 테스트가
 * 없었다. 빈 배열은 「모든 출처가 실재한다」를 0회 순회로 통과하기 때문이다.
 */
const ONE_LINE = `---
id: x
sources: [a, b, c]
---
본문
`

// prettier 가 실제로 만들어 내는 모양.
const WRAPPED = `---
id: x
sources:
  [
    a,
    b,
    c,
  ]
---
본문
`

describe('frontmatter arrays', () => {
  it('read the same whether or not the array was wrapped', () => {
    const flat = parseFrontmatter(ONE_LINE)
    const wrapped = parseFrontmatter(WRAPPED)
    expect(asStringArray(flat.data.sources)).toEqual(['a', 'b', 'c'])
    expect(asStringArray(wrapped.data.sources)).toEqual(['a', 'b', 'c'])
    expect(wrapped.data.id).toBe('x')
    expect(wrapped.body.trim()).toBe('본문')
  })

  it('does not swallow the keys that follow a wrapped array', () => {
    const { data } = parseFrontmatter(`---
sources:
  [
    a,
    b,
  ]
level: core
tags: [t1, t2]
---
본문
`)
    expect(asStringArray(data.sources)).toEqual(['a', 'b'])
    expect(data.level).toBe('core')
    expect(asStringArray(data.tags)).toEqual(['t1', 't2'])
  })

  it('leaves an unterminated array from eating the rest of the block', () => {
    const { data } = parseFrontmatter(`---
sources: [a, b
level: core
---
본문
`)
    // 닫히지 않으면 남은 줄을 먹는다 — 조용히 비우는 것보다 눈에 띄는 실패가 낫다.
    expect(asStringArray(data.sources).length).toBeGreaterThan(0)
  })
})
