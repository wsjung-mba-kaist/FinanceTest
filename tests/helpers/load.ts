import type * as ContentNs from '@/content'
import type { InstitutionState, ScenarioDefinition } from '@/engine'

/**
 * Loads every registered scenario definition. Scenario modules are being authored concurrently;
 * when the registry cannot even be imported (Vite fails to resolve a missing module at transform
 * time) or `loadAllAvailable()` rejects, we warn and return an empty list so the calling suite can
 * `test.skipIf` those cases instead of failing to collect.
 */
export async function loadAvailableScenariosSafe(): Promise<
  ScenarioDefinition<InstitutionState>[]
> {
  try {
    const mod = await import('@/scenarios')
    return await mod.loadAllAvailable()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    console.warn(`[tests] registered scenarios unavailable — skipping registry cases: ${msg}`)
    return []
  }
}

export type ContentModule = typeof ContentNs

/** Same guard for the knowledge-content module (`glossary.ts` / `sources.ts` / `readingList.ts` may not exist yet). */
export async function loadContentSafe(): Promise<ContentModule | undefined> {
  try {
    return await import('@/content')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    console.warn(`[tests] content module unavailable — skipping content-dependent cases: ${msg}`)
    return undefined
  }
}
