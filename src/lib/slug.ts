/**
 * One slug function.
 *
 * There were three, and the important one did not exist: search built framework links as
 * `#{sectionSlug(heading)}`, the table of contents built its own ids with a different rule, and
 * `<Markdown>` put no `id` on any heading at all. So *every* deep link into a framework section —
 * from the search sheet, from a regulation reference, from the ToC — landed at the top of the
 * document, and the ToC papered over it by matching `h2` elements on their text content.
 *
 * Unicode-aware on purpose: the headings are Korean, so `[a-z0-9-]` would slug them all to ''.
 */
export function sectionSlug(heading: string): string {
  return (
    heading
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      // Punctuation that has just been stripped leaves its spaces behind, so `— 배경` would slug
      // to `-배경` and `핵심 규칙 (2024)` to `핵심-규칙-2024-`. Collapse and trim the dashes.
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * Slugs for a list of headings, with `-2`, `-3`… appended to repeats.
 * Two `## 배경` sections in one document must not both answer to `#배경`.
 */
export function uniqueSlugs(headings: string[]): string[] {
  const seen = new Map<string, number>()
  return headings.map((h) => {
    const base = sectionSlug(h)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  })
}

/**
 * Stateful counterpart for a renderer that meets headings one at a time (react-markdown calls the
 * `h2` component per node, with no list to look ahead in). Create one per document render.
 */
export function createSlugger(): (heading: string) => string {
  const seen = new Map<string, number>()
  return (heading: string) => {
    const base = sectionSlug(heading)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}
