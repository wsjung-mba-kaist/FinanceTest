/**
 * How wide a route's content frame should be.
 *
 * The app had no width strategy at all: every non-play route rendered inside `max-w-6xl`, which is
 * 1008px at a 14px root — the same 1008px at 1280, 1440 and 1920, leaving 47.5% of a 1920 screen
 * empty. But "wider" is not one answer, because the routes want different things:
 *
 *  - `full`  — the situation room. It is a dashboard; it should reach both edges.
 *  - `shell` — card grids, charts, tables. These genuinely want the pixels.
 *  - `doc`   — long-form Korean prose. Wrapping a 616px reading column in a 1560px frame is
 *              *worse* than wrapping it in a 960px one: the measure does not grow (44em is a
 *              reading constraint, not a leftover), so all the extra width becomes a moat.
 *
 * This is what "플레이는 밀도, 나머지는 여백" means concretely. Same idiom as `shellHelpContext`
 * in router.tsx — one function, prefix-matched, so a new route declares its width in one place.
 */
export type RouteWidth = 'full' | 'shell' | 'doc'

export function routeWidth(pathname: string): RouteWidth {
  if (pathname.startsWith('/play/')) return 'full'

  // Long-form: a briefing dossier, a framework document, the glossary, the reading list, settings.
  if (pathname.startsWith('/scenarios/')) return 'doc'
  if (pathname.startsWith('/knowledge/')) return 'doc'
  if (pathname.startsWith('/settings')) return 'doc'
  if (pathname.startsWith('/demo')) return 'doc'

  // Grids, charts and tables: the catalog, progress, the debrief, the knowledge index, the demo.
  return 'shell'
}

/** Tailwind classes for the `<main>` frame at each width. */
export const widthClass: Record<RouteWidth, string> = {
  full: 'min-h-0 flex-1 overflow-hidden',
  shell: 'mx-auto w-full max-w-shell flex-1 px-4 py-6',
  doc: 'mx-auto w-full max-w-doc flex-1 px-4 py-6',
}
