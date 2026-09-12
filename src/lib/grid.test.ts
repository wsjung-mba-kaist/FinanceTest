import { describe, expect, it } from 'vitest'
import { columnsFor, firstSpansTwo, gridPlan } from './grid'

describe('columnsFor (R1)', () => {
  it('never exceeds the content-derived maximum', () => {
    for (let n = 1; n <= 40; n++) expect(columnsFor(n, 4)).toBeLessThanOrEqual(4)
  })

  it('never exceeds the number of items', () => {
    for (let n = 1; n <= 6; n++) expect(columnsFor(n, 6)).toBeLessThanOrEqual(n)
  })

  it('keeps the row count a fixed grid would have used', () => {
    for (let n = 1; n <= 40; n++) {
      for (const cmax of [2, 3, 4, 5, 6]) {
        const c = columnsFor(n, cmax)
        expect(Math.ceil(n / c), `n=${n} cmax=${cmax}`).toBe(Math.ceil(n / cmax))
      }
    }
  })

  it('spreads items instead of stranding them', () => {
    // The cases that were actually on screen.
    expect(columnsFor(10, 5)).toBe(5) // 지식 베이스 색인: 10개를 3열로 놓아 640px가 비었다
    expect(columnsFor(5, 4)).toBe(3) // 역할 선택: 5개를 4열로 놓아 719px가 비었다
    expect(columnsFor(7, 4)).toBe(4) // 4+3 — 두 줄에 고르게
    expect(columnsFor(4, 3)).toBe(2) // 3+1 이 아니라 2+2
  })

  it('is stable at the boundaries', () => {
    expect(columnsFor(0, 4)).toBe(1)
    expect(columnsFor(1, 4)).toBe(1)
  })
})

describe('firstSpansTwo (R1b)', () => {
  it('fills a row that would otherwise leave exactly one orphan', () => {
    expect(firstSpansTwo(13, 4)).toBe(true) // 13 = 4+4+4+1 → 첫 항목이 2칸이면 14칸
    expect(firstSpansTwo(7, 3)).toBe(true)
  })

  it('does nothing when the last row is already full', () => {
    expect(firstSpansTwo(12, 4)).toBe(false)
    expect(firstSpansTwo(6, 3)).toBe(false)
  })

  it('does nothing in a two-column grid, where a span is the whole row', () => {
    expect(firstSpansTwo(5, 2)).toBe(false)
    expect(firstSpansTwo(3, 2)).toBe(false)
  })
})

describe('gridPlan', () => {
  it('always produces a base single-column class for phones', () => {
    for (let n = 1; n <= 20; n++) {
      for (const kind of ['metric', 'link', 'question', 'prose', 'scenario'] as const) {
        expect(gridPlan(kind, n).className, `${kind} n=${n}`).toMatch(/(^|\s)grid-cols-1(\s|$)/)
      }
    }
  })

  it('does not widen a grid past its item count', () => {
    // Two prose cards must never sit in a three-column grid with a hole.
    expect(gridPlan('prose', 2).className).not.toContain('lg:grid-cols-3')
    expect(gridPlan('scenario', 1).className).toBe('grid-cols-1')
  })

  it('emits the first-item span only when it is needed', () => {
    // 13 scenario cards over 3 columns = 4+4+4+1; the first card takes two so the last row fills.
    expect(gridPlan('scenario', 13).firstItemClassName).toBe('sm:col-span-2')
    expect(gridPlan('scenario', 12).firstItemClassName).toBe('')
    // Numeric tiles reach 5 columns at n=13 (3 rows), which leaves 3 on the last row — no orphan.
    expect(gridPlan('metric', 13).firstItemClassName).toBe('')
  })
})
