import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from '@/components/knowledge/Markdown'
import { InlineMarkdown } from '@/components/knowledge/InlineMarkdown'

/**
 * `**용어(English)**` followed directly by a Korean particle is everywhere in this project's
 * content, and CommonMark's flanking rules refuse to close the emphasis there — the reader saw
 * literal asterisks. `remarkCjkStrong` rescues it.
 */
const bolded: [name: string, src: string, expected: string][] = [
  [
    'closing ** after a paren, followed by a particle',
    '귀하는 **하버라이트 크레딧펀드(Harborlight Credit Fund)**의 PM입니다.',
    '하버라이트 크레딧펀드(Harborlight Credit Fund)',
  ],
  ['closing ** after a digit', '유출은 **17.61조**였다.', '17.61조'],
  ['closing ** after a percent sign', '연체율은 **8.52%**로 올랐다.', '8.52%'],
  ['plain Korean', '**중요한** 결정입니다.', '중요한'],
  ['two pairs in one line', '**가**와 **나(B)**의 차이', '가'],
]

describe('Korean-safe strong emphasis', () => {
  it.each(bolded)('%s', (_name, src, expected) => {
    const { container } = render(<Markdown>{src}</Markdown>)
    const strongs = [...container.querySelectorAll('strong')].map((el) => el.textContent)
    expect(strongs).toContain(expected)
    expect(container.textContent).not.toContain('**')
  })

  it('leaves an unpaired asterisk run alone', () => {
    const { container } = render(<Markdown>{'별표 ** 하나만 있는 문장'}</Markdown>)
    expect(container.textContent).toContain('**')
    expect(container.querySelector('strong')).toBeNull()
  })

  it('does not touch asterisks inside a code span', () => {
    const { container } = render(<Markdown>{'코드 `a ** b` 입니다.'}</Markdown>)
    expect(container.querySelector('code')?.textContent).toBe('a ** b')
    expect(container.querySelector('strong')).toBeNull()
  })
})

describe('InlineMarkdown', () => {
  it('renders inline emphasis without wrapping it in a block', () => {
    const { container } = render(
      <InlineMarkdown>{'**8.52%**는 총여신 연체율(전체)**이 아니다**.'}</InlineMarkdown>,
    )
    expect(container.querySelectorAll('strong').length).toBe(2)
    expect(container.querySelector('p')).toBeNull()
    expect(container.textContent).not.toContain('**')
  })

  it('is safe inside a paragraph', () => {
    const { container } = render(
      <p>
        앞말 <InlineMarkdown>{'**굵게**'}</InlineMarkdown> 뒷말
      </p>,
    )
    expect(container.querySelector('p > p')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('굵게')
  })
})

/**
 * The Korean numeric range and GFM strikethrough collide on the same character.
 *
 * `7~10%` is how a range is written here; GFM reads a *pair* of single tildes as strikethrough, so
 * a line of ranges came out as struck-through nonsense — the reader was shown `710%` and `1525%` in
 * a knowledge base whose whole claim is that the figures are right. `src/content` holds 840 tilde
 * ranges, so this was not an edge case.
 */
const ranges: [name: string, src: string, shown: string][] = [
  [
    'a line of ranges, as the discount-window card writes them',
    'FHLB 헤어컷 국채 ~3% / MBS 7~10% / 주택담보 15~25% / CRE 30~40%',
    'FHLB 헤어컷 국채 ~3% / MBS 7~10% / 주택담보 15~25% / CRE 30~40%',
  ],
  ['a single range', 'LCR 100~120% 구간', 'LCR 100~120% 구간'],
  ['a range spanning a unit', '마진 250~300bp', '마진 250~300bp'],
]

describe('numeric ranges survive the markdown renderer', () => {
  it.each(ranges)('%s', (_name, src, shown) => {
    const { container } = render(<Markdown>{src}</Markdown>)
    expect(container.querySelectorAll('del')).toHaveLength(0)
    expect(container.textContent).toBe(shown)
  })

  it.each(ranges)('%s (inline)', (_name, src, shown) => {
    const { container } = render(<InlineMarkdown>{src}</InlineMarkdown>)
    expect(container.querySelectorAll('del')).toHaveLength(0)
    expect(container.textContent).toBe(shown)
  })

  /** Explicit `~~…~~` still strikes through: only the accidental single-tilde form is off. */
  it('keeps deliberate strikethrough', () => {
    const { container } = render(<Markdown>{'~~취소됨~~ 확정'}</Markdown>)
    expect(container.querySelector('del')?.textContent).toBe('취소됨')
  })
})
