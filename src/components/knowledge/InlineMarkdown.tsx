import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkCjkStrong } from './remarkCjkStrong'
import { GlossaryTerm } from './GlossaryTerm'

/**
 * Inline-only markdown for authored strings that live inside a sentence, a table cell or a caption —
 * an expert rationale, a trap explanation, a source note. `Markdown` wraps its output in a `.md`
 * block and is the wrong shape there; this renders the same inline syntax (`**강조**`, `*기울임*`,
 * `` `코드` ``, `[말](term:id)`) with no block wrapper, so it drops straight into a `<p>` or `<span>`.
 *
 * Without it these fields showed their asterisks literally: 96 source notes, 19 expert rationales
 * and 7 trap explanations across the shipped scenarios contain `**`.
 */
export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkStrong]}
        components={{
          // Unwrap the block elements a phrase can still produce, so nothing nests a <p> in a <p>.
          p: ({ children: c }) => <>{c}</>,
          ul: ({ children: c }) => <>{c}</>,
          ol: ({ children: c }) => <>{c}</>,
          li: ({ children: c }) => <>{c}</>,
          a: ({ href, children: c }) => {
            if (href?.startsWith('term:'))
              return <GlossaryTerm id={href.slice(5)}>{c}</GlossaryTerm>
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {c}
              </a>
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  )
}
