import { describe, expect, it } from 'vitest'
import { CARDS, FRAMEWORKS, GLOSSARY, SOURCES } from '@/content'

const sourceIds = new Set(SOURCES.map((s) => s.id))
const cardIds = new Set(CARDS.map((c) => c.id))
const termIds = new Set(GLOSSARY.map((g) => g.id))

describe('framework documents', () => {
  it('exist and have unique ids', () => {
    expect(FRAMEWORKS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(FRAMEWORKS.map((f) => f.id)).size).toBe(FRAMEWORKS.length)
  })

  for (const f of FRAMEWORKS) {
    it(`${f.id}: frontmatter refs resolve`, () => {
      for (const s of f.sources) expect(sourceIds.has(s), `unknown source ${s}`).toBe(true)
      for (const c of f.relatedCards) expect(cardIds.has(c), `unknown card ${c}`).toBe(true)
      expect(f.sources.length).toBeGreaterThan(0)
    })

    it(`${f.id}: body citations and term links resolve`, async () => {
      const body = await f.load()
      expect(body.length).toBeGreaterThan(1500)
      for (const m of body.matchAll(/\[출처:\s*([^\]]+)\]/g)) {
        for (const id of m[1]!
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          expect(sourceIds.has(id), `unknown cited source ${id} in ${f.id}`).toBe(true)
        }
      }
      for (const m of body.matchAll(/\(term:([a-z0-9-]+)\)/g)) {
        expect(termIds.has(m[1]!), `unknown term ${m[1]} in ${f.id}`).toBe(true)
      }
      for (const h of [
        '## 개요',
        '## 핵심 규칙과 수치',
        '## 위기에서의 작동 방식',
        '## 실무 체크리스트',
      ]) {
        expect(body.includes(h), `${f.id} missing ${h}`).toBe(true)
      }
    })
  }
})
