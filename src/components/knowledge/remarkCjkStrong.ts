/**
 * Minimal local mdast shapes. The full `mdast` types are not a dependency of this project and this
 * plugin only ever touches `text` nodes and their parents' `children` arrays.
 */
interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
}
type Root = MdNode
type Text = MdNode & { type: 'text'; value: string }

/**
 * CommonMark's flanking rules were written for languages that put a space after a word. A closing
 * `**` is only allowed to close when it is *right-flanking*: not preceded by whitespace, and either
 * not preceded by punctuation, or preceded by punctuation and followed by whitespace/punctuation.
 *
 * Korean breaks that. `**하버라이트 크레딧펀드(Harborlight Credit Fund)**의` has a `)` before the
 * closing `**` and the particle `의` right after it, so the run is neither left- nor right-flanking
 * and the emphasis never closes — the reader sees literal asterisks. The pattern
 * `**용어(English)**` followed by a particle is everywhere in this project's Korean content, so
 * this is systemic rather than a one-off typo.
 *
 * This plugin runs after the parser and rescues what the parser left behind: any `**…**` pair still
 * sitting inside a plain text node becomes a `strong` node. It only ever sees text nodes, so code
 * spans, fenced code and link destinations are untouched by construction.
 */
const PAIR = /\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/

function splitText(node: Text): MdNode[] | undefined {
  if (!node.value.includes('**')) return undefined
  const out: MdNode[] = []
  let rest = node.value
  let matched = false

  for (;;) {
    const m = PAIR.exec(rest)
    if (!m) break
    matched = true
    const before = rest.slice(0, m.index)
    if (before) out.push({ type: 'text', value: before })
    out.push({ type: 'strong', children: [{ type: 'text', value: m[1]! }] })
    rest = rest.slice(m.index + m[0].length)
  }

  if (!matched) return undefined
  if (rest) out.push({ type: 'text', value: rest })
  return out
}

function walk(node: MdNode): void {
  const children = node.children
  if (!children) return
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    if (child.type === 'text' && typeof child.value === 'string') {
      const replacement = splitText(child as Text)
      if (replacement) {
        children.splice(i, 1, ...replacement)
        i += replacement.length - 1
      }
      continue
    }
    if (Array.isArray(child.children)) walk(child)
  }
}

export function remarkCjkStrong() {
  return (tree: Root): void => {
    walk(tree)
  }
}
