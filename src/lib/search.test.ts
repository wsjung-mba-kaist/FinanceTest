import { describe, expect, it } from 'vitest'
import {
  buildIndex,
  countHits,
  normalize,
  search,
  sectionSlug,
  tokenize,
  type SearchKind,
} from './search'

function ids(kind: SearchKind, q: string): string[] {
  return search(q)[kind].map((h) => h.doc.id)
}

describe('normalize', () => {
  it('NFC · 소문자 · 공백/구두점 제거', () => {
    expect(normalize('LCR')).toBe('lcr')
    expect(normalize('margin call')).toBe('margincall')
    expect(normalize('Liquidity Coverage Ratio (LCR)')).toBe('liquiditycoverageratiolcr')
    expect(normalize('예금자보호 한도')).toBe('예금자보호한도')
    expect(normalize('K-ICS')).toBe('kics')
    expect(normalize('P&A')).toBe('p&a')
    expect(normalize('  ')).toBe('')
  })

  it('tokenize는 공백으로 나누고 빈 토큰을 버린다', () => {
    expect(tokenize(' margin   call ')).toEqual(['margin', 'call'])
    expect(tokenize('')).toEqual([])
  })

  it('sectionSlug는 `## ` 제목을 앵커로 만든다', () => {
    expect(sectionSlug('핵심 규칙과 수치')).toBe('핵심-규칙과-수치')
    expect(sectionSlug('위기에서의 작동 방식')).toBe('위기에서의-작동-방식')
  })
})

describe('buildIndex', () => {
  const index = buildIndex()

  it('다섯 종류를 모두 담고 메모이즈된다', () => {
    expect(buildIndex()).toBe(index)
    const kinds = new Set(index.map((d) => d.kind))
    for (const k of ['term', 'card', 'framework', 'regulation', 'reading'] as const)
      expect(kinds.has(k), `${k} 문서 없음`).toBe(true)
  })

  it('용어 76 · 카드 19 규모를 담는다', () => {
    expect(index.filter((d) => d.kind === 'term').length).toBeGreaterThanOrEqual(70)
    expect(index.filter((d) => d.kind === 'card').length).toBeGreaterThanOrEqual(19)
  })

  it('프레임워크는 `## ` 절 단위로 쪼개진다', () => {
    const fw = index.filter((d) => d.kind === 'framework')
    // 10편 × 최소 5개 절
    expect(fw.length).toBeGreaterThanOrEqual(50)
    for (const d of fw) {
      expect(d.id).toContain('#')
      expect(d.href.startsWith('/knowledge/frameworks/')).toBe(true)
      expect(d.body.length).toBeGreaterThan(0)
    }
    expect(fw.some((d) => d.id === 'basel3-liquidity#핵심-규칙과-수치')).toBe(true)
  })

  it('모든 문서에 href와 제목이 있다', () => {
    for (const d of index) {
      expect(d.title.length, d.id).toBeGreaterThan(0)
      expect(d.href.startsWith('/'), d.id).toBe(true)
    }
  })
})

describe('search', () => {
  it('빈 질의는 빈 결과', () => {
    expect(countHits(search(''))).toBe(0)
    expect(countHits(search('   '))).toBe(0)
  })

  it('약어(LCR)가 용어·카드·규정을 모두 찾는다', () => {
    const r = search('LCR')
    expect(r.term.map((h) => h.doc.id)).toContain('lcr')
    expect(r.card.map((h) => h.doc.id)).toContain('lcr-basics')
    expect(r.regulation.length).toBeGreaterThan(0)
    // 용어가 가장 강한 매칭이므로 첫 결과다.
    expect(r.term[0]?.doc.id).toBe('lcr')
  })

  it('영문 두 단어(margin call)가 매칭된다', () => {
    expect(ids('term', 'margin call')).toContain('margin-call')
  })

  it('한글(예금자보호)이 용어와 규정을 찾는다', () => {
    expect(ids('term', '예금자보호')).toContain('deposit-insurance-limit')
    expect(ids('regulation', '예금자보호')).toContain('deposit-insurance-kr')
  })

  it('한글 약어·별칭(채안펀드, 킥스)이 매칭된다', () => {
    expect(ids('term', '채안펀드')).toContain('bond-stabilization-fund')
    expect(ids('term', '킥스')).toContain('k-ics')
  })

  it('AND 매칭 — 모든 토큰이 걸려야 한다', () => {
    expect(ids('term', 'lcr 존재하지않는토큰')).toEqual([])
    const both = search('담보 헤어컷')
    expect(countHits(both)).toBeGreaterThan(0)
  })

  it('스니펫은 본문 일부를 담는다', () => {
    const hit = search('테인팅').card[0] ?? search('테인팅').framework[0]
    expect(hit).toBeDefined()
    expect(hit!.snippet.length).toBeGreaterThan(0)
    expect(hit!.snippet.length).toBeLessThanOrEqual(130)
  })

  it('limitPerKind가 종류별 결과 수를 제한한다', () => {
    const r = search('유동성', { limitPerKind: 2 })
    for (const k of ['term', 'card', 'framework', 'regulation', 'reading'] as const)
      expect(r[k].length).toBeLessThanOrEqual(2)
  })

  it('제목 정확 일치가 본문 일치보다 위에 온다', () => {
    const r = search('헤어컷')
    expect(r.term[0]?.doc.id).toBe('haircut')
  })

  it('규정 참조는 수치를 meta에 노출한다', () => {
    const hit = search('LDI 버퍼').regulation.find((h) => h.doc.id === 'ldi-buffer')
    expect(hit?.doc.meta).toContain('250bp')
  })
})
