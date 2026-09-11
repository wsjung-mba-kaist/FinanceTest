/** Minimal flat frontmatter parser: `key: value` lines, `[a, b]` arrays, numbers, booleans. No nesting. */
export interface Frontmatter {
  data: Record<string, string | string[] | number | boolean>
  body: string
}

export function parseFrontmatter(raw: string): Frontmatter {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { data: {}, body: text }
  const data: Frontmatter['data'] = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf(':')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    const val = t.slice(i + 1).trim()
    data[key] = parseValue(val)
  }
  return { data, body: text.slice(m[0].length) }
}

function parseValue(val: string): string | string[] | number | boolean {
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(',')
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean)
  }
  if (val === 'true') return true
  if (val === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val)
  return stripQuotes(val)
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1)
  return s
}

export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string' && v) return [v]
  return []
}
