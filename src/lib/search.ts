import { CARDS, FRAMEWORKS, GLOSSARY, READING_LIST } from '../content'
import { parseFrontmatter } from '../content/frontmatter'
import { REGULATION_REFS, SECTOR_LABELS } from '../content/regulationQuickRef'
import { sectionSlug } from './slug'

/**
 * 지식 베이스 통합 검색 — 용어집 · 개념 카드 · 프레임워크 절 · 규정 참조 · 읽을거리.
 *
 * 설계
 * - 한글·영문·약어를 같은 축에 놓기 위해 NFC 정규화 + 소문자 + 공백·`·`·`()`·`-` 제거.
 *   그래서 `margin call` · `마진콜` · `LCR` · `예금자보호`가 모두 같은 경로로 매칭된다.
 * - 질의 토큰은 **AND**. 토큰마다 가장 강한 필드 하나의 가중치를 취해 합산한다.
 * - 프레임워크 문서는 `## ` 절 단위로 쪼개 색인한다(문서 전체보다 절이 답에 가깝다).
 */
export type SearchKind = 'term' | 'card' | 'framework' | 'regulation' | 'reading'

export interface SearchDoc {
  kind: SearchKind
  id: string
  title: string
  titleEn?: string
  aliases: string[]
  tags: string[]
  body: string
  /** 라우터 경로(해시 라우터 기준 상대 경로). */
  href: string
  /** 결과 줄에 붙는 부가 정보(등급·그룹·발행처 등). */
  meta?: string
}

export interface SearchHit {
  doc: SearchDoc
  score: number
  snippet: string
}

export const SEARCH_KINDS: SearchKind[] = ['term', 'card', 'framework', 'regulation', 'reading']

export const KIND_LABELS: Record<SearchKind, string> = {
  term: '용어',
  card: '개념 카드',
  framework: '프레임워크',
  regulation: '규정 참조',
  reading: '읽을거리',
}

// `sectionSlug` lives in ./slug: the framework anchors it builds and the heading ids
// `<Markdown>` renders must come from one definition, or deep links land at the top of the page.
export { sectionSlug } from './slug'

const STRIP = /[\s·()[\]{}<>,.;:!?'"`_/\\|·・ー–—-]/

/** NFC → 소문자 → 공백·구두점·`·`·괄호·하이픈 제거. */
export function normalize(s: string): string {
  return normalizeWithMap(s).text
}

/** 정규화된 문자열과 "정규화 위치 → 원문 위치" 대응표(스니펫 추출용). */
function normalizeWithMap(s: string): { text: string; map: number[] } {
  const nf = s.normalize('NFC')
  let text = ''
  const map: number[] = []
  for (let i = 0; i < nf.length; i++) {
    const ch = nf[i]!
    if (STRIP.test(ch)) continue
    const lower = ch.toLowerCase()
    text += lower
    for (let k = 0; k < lower.length; k++) map.push(i)
  }
  return { text, map }
}

// ─────────────────────────────── index ───────────────────────────────

const frameworkFiles = import.meta.glob('../content/frameworks/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function frameworkBodies(): Map<string, string> {
  const out = new Map<string, string>()
  for (const [path, raw] of Object.entries(frameworkFiles)) {
    const { data, body } = parseFrontmatter(raw)
    const id = String(data.id ?? path.replace(/^.*\//, '').replace(/\.md$/, ''))
    out.set(id, body.trim())
  }
  return out
}

/** `## ` 제목 단위로 문서를 쪼갠다. 제목 앞의 도입부는 버린다(프레임워크는 항상 `## 개요`로 시작). */
function splitSections(body: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = []
  const lines = body.split(/\r?\n/)
  let heading: string | undefined
  let buf: string[] = []
  const flush = () => {
    if (heading && buf.length > 0) out.push({ heading, text: buf.join('\n').trim() })
  }
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      flush()
      heading = m[1]!
      buf = []
      continue
    }
    buf.push(line)
  }
  flush()
  return out
}

const CARD_LEVEL_LABEL: Record<string, string> = {
  intro: '입문',
  core: '핵심',
  advanced: '심화',
}

let cached: SearchDoc[] | undefined

/** 색인을 만든다(모듈 수명 동안 1회, 메모이즈). */
export function buildIndex(): SearchDoc[] {
  if (cached) return cached
  const docs: SearchDoc[] = []

  for (const g of GLOSSARY) {
    docs.push({
      kind: 'term',
      id: g.id,
      title: g.term.ko,
      titleEn: g.term.en,
      aliases: [g.id, ...(g.aliases ?? [])],
      tags: [],
      body: `${g.definition.ko} ${g.definition.en ?? ''}`.trim(),
      href: `/knowledge/glossary#${g.id}`,
      meta: '용어집',
    })
  }

  for (const c of CARDS) {
    docs.push({
      kind: 'card',
      id: c.id,
      title: c.title,
      titleEn: c.titleEn,
      aliases: [c.id],
      tags: c.tags,
      body: c.body,
      href: `/knowledge#card-${c.id}`,
      meta: CARD_LEVEL_LABEL[c.level] ?? c.level,
    })
  }

  const bodies = frameworkBodies()
  for (const f of FRAMEWORKS) {
    const body = bodies.get(f.id)
    if (!body) continue
    for (const s of splitSections(body)) {
      const slug = sectionSlug(s.heading)
      docs.push({
        kind: 'framework',
        id: `${f.id}#${slug}`,
        title: `${f.title} › ${s.heading}`,
        titleEn: f.titleEn,
        aliases: [f.id, s.heading],
        tags: f.tags,
        body: s.text,
        href: `/knowledge/frameworks/${f.id}#${slug}`,
        meta: s.heading,
      })
    }
  }

  for (const r of REGULATION_REFS) {
    docs.push({
      kind: 'regulation',
      id: r.id,
      title: r.rule,
      aliases: [r.id, ...(r.termId ? [r.termId] : [])],
      tags: [
        r.group,
        r.region === 'korea' ? '한국' : '국제',
        ...r.sectors.map((s) => SECTOR_LABELS[s]),
      ],
      body: `${r.threshold} ${r.note ?? ''} ${r.asOf ?? ''}`.trim(),
      href: `/knowledge/frameworks/${r.frameworkId}${r.section ? `#${sectionSlug(r.section)}` : ''}`,
      meta: `${r.group} · ${r.threshold}`,
    })
  }

  READING_LIST.forEach((item, i) => {
    docs.push({
      kind: 'reading',
      id: `reading-${i}`,
      title: item.title,
      aliases: [item.publisher],
      tags: item.tags,
      body: `${item.publisher} ${item.year} ${item.note ?? ''}`.trim(),
      href: '/knowledge/reading',
      meta: `${item.publisher} ${item.year}`,
    })
  })

  cached = docs
  return docs
}

/** 테스트용: 메모이즈된 색인을 버린다. */
export function resetIndex(): void {
  cached = undefined
  prepared = undefined
}

// ─────────────────────────────── search ───────────────────────────────

interface Prepared {
  doc: SearchDoc
  title: string
  titleEn: string
  aliases: string[]
  tags: string[]
  body: string
  bodyMap: number[]
  rawBody: string
}

let prepared: Prepared[] | undefined

function prepare(): Prepared[] {
  if (prepared) return prepared
  prepared = buildIndex().map((doc) => {
    const b = normalizeWithMap(doc.body)
    return {
      doc,
      title: normalize(doc.title),
      titleEn: normalize(doc.titleEn ?? ''),
      aliases: doc.aliases.map(normalize).filter(Boolean),
      tags: doc.tags.map(normalize).filter(Boolean),
      body: b.text,
      bodyMap: b.map,
      rawBody: doc.body,
    }
  })
  return prepared
}

const W = { titleExact: 10, title: 6, alias: 6, titleEn: 5, tag: 3, body: 1 } as const
/** 용어는 "이게 무슨 뜻이냐"는 질문의 기본 답이므로 같은 점수면 앞에 둔다. */
const TERM_BONUS = 2

function fieldScore(p: Prepared, token: string): number {
  if (p.title === token) return W.titleExact
  if (p.aliases.some((a) => a === token)) return W.alias
  if (p.title.includes(token)) return W.title
  if (p.aliases.some((a) => a.includes(token))) return W.alias
  if (p.titleEn.includes(token)) return W.titleEn
  if (p.tags.some((t) => t.includes(token))) return W.tag
  if (p.body.includes(token)) return W.body
  return 0
}

function makeSnippet(p: Prepared, tokens: string[]): string {
  const raw = p.rawBody.normalize('NFC')
  let at = -1
  for (const t of tokens) {
    const i = p.body.indexOf(t)
    if (i >= 0) {
      at = p.bodyMap[i] ?? -1
      break
    }
  }
  if (at < 0) return raw.slice(0, 120).replace(/\s+/g, ' ').trim()
  const start = Math.max(0, at - 60)
  const end = Math.min(raw.length, at + 60)
  const text = raw.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${text}${end < raw.length ? '…' : ''}`
}

function emptyResult(): Record<SearchKind, SearchHit[]> {
  return { term: [], card: [], framework: [], regulation: [], reading: [] }
}

/** 질의를 토큰으로 쪼갠다(공백 분리 후 정규화, 빈 토큰 제거). */
export function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .map(normalize)
    .filter((t) => t.length > 0)
}

/**
 * 종류별로 묶인 검색 결과. 모든 토큰이 어떤 필드에든 걸려야(AND) 결과에 포함된다.
 * `limitPerKind` 기본 20 — UI가 5개씩 보여 주고 `더 보기`로 나머지를 편다.
 */
export function search(
  q: string,
  opts: { limitPerKind?: number } = {},
): Record<SearchKind, SearchHit[]> {
  const out = emptyResult()
  const tokens = tokenize(q)
  if (tokens.length === 0) return out
  const limit = opts.limitPerKind ?? 20
  const hits: SearchHit[] = []
  for (const p of prepare()) {
    let score = 0
    let ok = true
    for (const t of tokens) {
      const s = fieldScore(p, t)
      if (s === 0) {
        ok = false
        break
      }
      score += s
    }
    if (!ok) continue
    if (p.doc.kind === 'term') score += TERM_BONUS
    hits.push({ doc: p.doc, score, snippet: makeSnippet(p, tokens) })
  }
  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, 'ko'))
  for (const h of hits) {
    const bucket = out[h.doc.kind]
    if (bucket.length < limit) bucket.push(h)
  }
  return out
}

/** 결과 개수 합계(라이브 리전 안내용). */
export function countHits(result: Record<SearchKind, SearchHit[]>): number {
  return SEARCH_KINDS.reduce((n, k) => n + result[k].length, 0)
}
