import { describe, expect, it } from 'vitest'

/**
 * The dependency order from CLAUDE.md, as a test:
 *
 *   engine · metrics · scenarios   pure TypeScript, no React, no DOM
 *           ↓
 *   lib · content · persistence    pure helpers, authored content, zod schemas
 *           ↓
 *   components · pages · store     React
 *
 * An arrow that bends once is the one the next person bends again. Three `lib` files imported the
 * store before this test existed; they now live under `store/hooks`. The engine's internals
 * (`engine/core/*`) are reached through `engine/index.ts` only, so a module can move inside the
 * engine without touching its callers.
 */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const files = Object.entries(SOURCES)
  .map(([path, src]) => [path.replace(/^.*\/src\//, 'src/'), src] as const)
  .filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.includes('__tests__'))

function imports(src: string): string[] {
  return [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!)
}

interface Rule {
  name: string
  /** Files the rule applies to. */
  from: RegExp
  /** Import specifiers the rule forbids there. */
  forbids: RegExp
}

const RULES: Rule[] = [
  {
    name: 'engine · metrics · scenarios 는 React·DOM·스토어·컴포넌트를 모른다',
    from: /^src\/(engine|metrics|scenarios)\//,
    forbids: /^(react|react-dom|zustand)|\/(store|components|pages|app)\//,
  },
  {
    name: 'lib · content · persistence 는 store·components·pages 를 import 하지 않는다',
    from: /^src\/(lib|content|persistence)\//,
    forbids: /\.\.\/(store|components|pages|app)(\/|$)|^@\/(store|components|pages|app)(\/|$)/,
  },
  {
    // Scenarios are authored against the engine's builders and sit in the same top layer, so they
    // may reach `engine/core`; everything below the line goes through the entry point.
    name: 'UI·lib 층은 engine/core 를 직접 import 하지 않는다 (engine/index 를 통해서만)',
    from: /^src\/(lib|content|persistence|components|pages|store|app)\//,
    forbids: /engine\/core\//,
  },
]

describe('dependency direction', () => {
  it.each(RULES.map((r) => [r.name, r] as const))('%s', (_name, rule) => {
    const violations: string[] = []
    for (const [path, src] of files) {
      if (!rule.from.test(path)) continue
      for (const spec of imports(src))
        if (rule.forbids.test(spec)) violations.push(`${path} → ${spec}`)
    }
    expect(violations, `\n${violations.join('\n')}`).toEqual([])
  })
})
