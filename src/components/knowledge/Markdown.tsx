import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GlossaryTerm } from './GlossaryTerm'
import { Citation } from './Citation'

/**
 * Markdown renderer with two conventions:
 *  - `[텍스트](term:lcr)` → glossary tooltip
 *  - `[출처: fed-svb-review-2023]` (plain text) → citation chip
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          p: ({ children: c }) => <p>{withCitations(c)}</p>,
          li: ({ children: c }) => <li>{withCitations(c)}</li>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

const CITE = /\[출처:\s*([a-zA-Z0-9-_.,\s]+)\]/g

function withCitations(nodes: React.ReactNode): React.ReactNode {
  if (typeof nodes === 'string') return splitCitations(nodes)
  if (Array.isArray(nodes))
    return nodes.map((n, i) =>
      typeof n === 'string' ? <span key={i}>{splitCitations(n)}</span> : n,
    )
  return nodes
}

function splitCitations(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(CITE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push(text.slice(last, idx))
    const ids = m[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    parts.push(<Citation key={`${idx}`} ids={ids} />)
    last = idx + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : parts
}
