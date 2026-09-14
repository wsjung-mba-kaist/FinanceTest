/**
 * Minimal flat frontmatter parser: `key: value` lines, `[a, b]` arrays, numbers, booleans. No nesting.
 *
 * 배열은 **여러 줄에 걸쳐 있어도** 읽는다. 한때 한 줄만 읽었는데, `sources:` 줄이 100자를 넘는
 * 콘텐츠 파일이 30개 중 22개였다 — 즉 `pnpm format`(printWidth 100) 한 번이면 그 22개의 배열이
 * 줄바꿈되고, 파서는 그것을 **빈 배열**로 읽는다. 인용이 통째로 사라지는데 카드 쪽에는 그것을
 * 잡는 테스트도 없었다(빈 배열은 «모든 출처가 실재한다»를 0회 순회로 통과한다).
 *
 * 출처가 핵심인 제품에서, 서식 명령 하나가 조용히 근거를 지우게 두지 않는다.
 */
export interface Frontmatter {
  data: Record<string, string | string[] | number | boolean>
  body: string
}

export function parseFrontmatter(raw: string): Frontmatter {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { data: {}, body: text }
  const data: Frontmatter['data'] = {}
  const lines = m[1]!.split(/\r?\n/)
  for (let n = 0; n < lines.length; n++) {
    const t = lines[n]!.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf(':')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    // prettier 는 긴 배열을 `key:` 다음 줄부터 편다 — 값이 비어 있으면 다음 줄에서 시작을 찾는다.
    if (!val && lines[n + 1]?.trim().startsWith('[')) val = lines[++n]!.trim()
    // 열린 대괄호는 닫힐 때까지 이어 읽는다 — 여러 줄로 펴 놓아도 같은 값이다.
    if (val.startsWith('[') && !val.endsWith(']'))
      while (++n < lines.length) {
        val += ' ' + lines[n]!.trim()
        if (val.endsWith(']')) break
      }
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
