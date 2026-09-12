import { describe, expect, it } from 'vitest'
import { createSlugger, sectionSlug, uniqueSlugs } from './slug'
import { buildIndex } from './search'

describe('sectionSlug', () => {
  it('keeps Hangul', () => {
    // An ASCII-only slug rule would reduce every heading in this project to the empty string.
    expect(sectionSlug('핵심 규칙과 수치')).toBe('핵심-규칙과-수치')
  })

  it('drops punctuation and folds case', () => {
    expect(sectionSlug('## Basel III (2017): LCR')).toBe('basel-iii-2017-lcr')
    expect(sectionSlug('  배경 · 맥락  ')).toBe('배경-맥락')
  })

  it('is idempotent', () => {
    const once = sectionSlug('유동성 커버리지 비율 (LCR)')
    expect(sectionSlug(once)).toBe(once)
  })
})

describe('uniqueSlugs / createSlugger', () => {
  it('numbers repeats so two sections never claim one anchor', () => {
    expect(uniqueSlugs(['배경', '본문', '배경'])).toEqual(['배경', '본문', '배경-2'])
  })

  it('numbers them the same way one at a time', () => {
    const slug = createSlugger()
    expect(['배경', '본문', '배경'].map(slug)).toEqual(uniqueSlugs(['배경', '본문', '배경']))
  })

  it('starts fresh for each document', () => {
    expect(createSlugger()('배경')).toBe('배경')
    expect(createSlugger()('배경')).toBe('배경')
  })
})

describe('the anchors search produces', () => {
  /**
   * The end of the chain that was broken: search built `#{sectionSlug(heading)}` hrefs, the table
   * of contents minted ids with a *different* rule, and `<Markdown>` stamped no ids at all — so
   * following a search result landed at the top of the document every time. Asserting that the
   * href slug equals what `uniqueSlugs` gives the same heading is what keeps the three in step.
   */
  it('match the ids the document will render', () => {
    const index = buildIndex()
    const sections = index.filter((d) => d.kind === 'framework' && d.href.includes('#'))
    expect(sections.length).toBeGreaterThan(0)
    for (const doc of sections) {
      const anchor = decodeURIComponent(doc.href.slice(doc.href.indexOf('#') + 1))
      // `meta` carries the raw heading the anchor was built from.
      expect(anchor, `${doc.href} — 제목 "${doc.meta}"`).toBe(uniqueSlugs([doc.meta ?? ''])[0])
    }
  })
})
