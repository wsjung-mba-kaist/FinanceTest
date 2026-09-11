import { z } from 'zod'
import { asStringArray, parseFrontmatter } from './frontmatter'
import type { FrameworkDoc, KnowledgeCard } from './types'

const cardFiles = import.meta.glob('./cards/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const frameworkFiles = import.meta.glob('./frameworks/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const cardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleEn: z.string().optional(),
  tags: z.array(z.string()),
  level: z.enum(['intro', 'core', 'advanced']),
  relatedMetrics: z.array(z.string()),
  sources: z.array(z.string()),
})

function fileId(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '')
}

export function loadCards(): KnowledgeCard[] {
  const out: KnowledgeCard[] = []
  for (const [path, raw] of Object.entries(cardFiles)) {
    const { data, body } = parseFrontmatter(raw)
    const parsed = cardSchema.safeParse({
      id: data.id ?? fileId(path),
      title: data.title,
      titleEn: data.titleEn,
      tags: asStringArray(data.tags),
      level: data.level ?? 'core',
      relatedMetrics: asStringArray(data.relatedMetrics),
      sources: asStringArray(data.sources),
    })
    if (!parsed.success) {
      console.warn(`[content] 카드 frontmatter 오류: ${path}`, parsed.error.issues)
      continue
    }
    out.push({ ...parsed.data, body: body.trim() })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export function loadFrameworks(): FrameworkDoc[] {
  const out: FrameworkDoc[] = []
  for (const [path, raw] of Object.entries(frameworkFiles)) {
    const { data, body } = parseFrontmatter(raw)
    const id = String(data.id ?? fileId(path))
    out.push({
      id,
      title: String(data.title ?? id),
      titleEn: data.titleEn ? String(data.titleEn) : undefined,
      tags: asStringArray(data.tags),
      sources: asStringArray(data.sources),
      relatedCards: asStringArray(data.relatedCards),
      load: () => Promise.resolve(body.trim()),
    })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'ko'))
}
