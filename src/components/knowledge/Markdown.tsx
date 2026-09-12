import { useId, useRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkCjkStrong } from './remarkCjkStrong'
import {
  createGlossaryScope,
  GlossaryScopeContext,
  splitByGlossary,
  useGlossaryScope,
} from '../../lib/glossaryMatch'
import { GlossaryTerm } from './GlossaryTerm'
import { Citation } from './Citation'
import { createSlugger } from '../../lib/slug'

/**
 * 한 패널 안에서 "용어 첫 등장에만 밑줄"이 되도록 범위를 만든다.
 * 도움 시트·결정 독처럼 여러 `Markdown`이 모인 영역을 이걸로 감싼다.
 */
export function GlossaryScopeProvider({ children }: { children: ReactNode }) {
  const ref = useRef(createGlossaryScope())
  return (
    <GlossaryScopeContext.Provider value={ref.current}>{children}</GlossaryScopeContext.Provider>
  )
}

/**
 * Markdown renderer with three conventions:
 *  - `[텍스트](term:lcr)` → glossary tooltip (항상 우선)
 *  - `[출처: fed-svb-review-2023]` (plain text) → citation chip
 *  - `autoGlossary` → 평문에서 알려진 용어의 **첫 등장**에 자동 밑줄(패널당 1회)
 *
 * `autoGlossary`는 기본 꺼짐이므로 요청하지 않은 화면의 렌더 결과는 바뀌지 않는다.
 * 코드(`code`/`pre`)와 링크 안에서는 자동 매칭하지 않는다 — 해당 요소의 자식은 문자열이 아니라
 * 이미 렌더된 노드로 들어오거나, 전용 렌더러가 원문을 그대로 내보내기 때문이다.
 */
export function Markdown({
  children,
  className,
  autoGlossary = false,
  headingIds = false,
}: {
  children: string
  className?: string
  autoGlossary?: boolean
  /**
   * Give `h2`/`h3` an `id` from `sectionSlug`, so a section can be linked to. Off by default
   * because a page with two `<Markdown>` blocks would otherwise mint duplicate ids; the long-form
   * documents that own their page turn it on.
   */
  headingIds?: boolean
}) {
  const scope = useGlossaryScope()
  const owner = useId()
  // 렌더마다 새로 만든다 — 다시 그려도 같은 위치에 같은 밑줄이 남는다(패널 범위는 owner로 유지).
  const localSeen = new Set<string>()

  const accept = (termId: string): boolean => {
    if (!autoGlossary) return false
    if (localSeen.has(termId)) return false
    if (scope && !scope.claim(termId, owner)) return false
    localSeen.add(termId)
    return true
  }
  const inline = (nodes: ReactNode): ReactNode =>
    withInline(nodes, autoGlossary ? accept : undefined)
  // One slugger per render, so repeated headings get `-2`, `-3`… in document order.
  const slug = headingIds ? createSlugger() : undefined
  const headingId = (c: ReactNode): string | undefined => (slug ? slug(plainText(c)) : undefined)

  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkStrong]}
        components={{
          a: ({ href, children: c }) => {
            if (href?.startsWith('term:'))
              return <GlossaryTerm id={href.slice(5)}>{c}</GlossaryTerm>
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {c}
              </a>
            )
          },
          h2: ({ children: c }) => <h2 id={headingId(c)}>{c}</h2>,
          h3: ({ children: c }) => <h3 id={headingId(c)}>{c}</h3>,
          p: ({ children: c }) => <p>{inline(c)}</p>,
          li: ({ children: c }) => <li>{inline(c)}</li>,
          td: ({ children: c }) => <td>{inline(c)}</td>,
          // Scrolling lives on a wrapper, never on the <table>. `display: block` on a table makes
          // it scroll, and also removes it from the accessibility tree *as a table* — the rows and
          // header cells stop being announced as such, in a product whose regulatory tables are
          // the point. `role="group"` + tabIndex makes the scroll box reachable by keyboard.
          table: ({ children: c }) => (
            <div className="md-table-scroll" role="group" tabIndex={0} aria-label="표">
              <table>{c}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Flattens a heading's rendered children back to text, for slugging. */
function plainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return plainText(props?.children)
  }
  return ''
}

const CITE = /\[출처:\s*([a-zA-Z0-9-_.,\s]+)\]/g

type Accept = (termId: string) => boolean

function withInline(nodes: ReactNode, accept?: Accept): ReactNode {
  if (typeof nodes === 'string') return splitCitations(nodes, accept)
  if (Array.isArray(nodes))
    return nodes.map((n, i) =>
      typeof n === 'string' ? <span key={i}>{splitCitations(n, accept)}</span> : n,
    )
  return nodes
}

function splitCitations(text: string, accept?: Accept): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(CITE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push(withGlossary(text.slice(last, idx), `t${last}`, accept))
    const ids = m[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    parts.push(<Citation key={`c${idx}`} ids={ids} />)
    last = idx + m[0].length
  }
  if (last < text.length) parts.push(withGlossary(text.slice(last), `t${last}`, accept))
  return parts.length === 1 ? parts[0] : parts
}

/** 평문 조각에 용어 첫 등장 밑줄을 입힌다. `accept`가 없으면 원문 그대로. */
function withGlossary(text: string, keyPrefix: string, accept?: Accept): ReactNode {
  if (!accept) return text
  const parts = splitByGlossary(text, accept)
  if (parts.length === 1 && typeof parts[0] === 'string') return text
  return (
    <span key={keyPrefix}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={`${keyPrefix}-${i}`}>{p}</span>
        ) : (
          <GlossaryTerm key={`${keyPrefix}-${i}`} id={p.termId}>
            {p.text}
          </GlossaryTerm>
        ),
      )}
    </span>
  )
}
