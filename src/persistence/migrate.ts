/**
 * Version ladder for persisted documents.
 *
 * `z.literal(STORAGE_VERSION)` says "this version only"; it does not say "and bring older ones up".
 * The day the version is bumped, every reader would have classified every user's progress as
 * corrupt, backed it up and started empty. A version number is only meaningful when there is a
 * plan to raise it, and the cost of raising it is paid here, before it happens: a step per version
 * (`from` → `from + 1`), applied in order to whatever `version` the raw document carries.
 *
 * Steps are pure functions of the raw JSON (not of the parsed type — the old shape is exactly what
 * the current schema cannot describe). They run *before* zod parsing, so a step that cannot make
 * sense of its input leaves it alone and lets the schema reject it.
 */
export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

export type MigrationLadder = Record<number, MigrationStep>

function versionOf(raw: unknown): number | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const v = (raw as { version?: unknown }).version
  return typeof v === 'number' && Number.isInteger(v) ? v : undefined
}

/**
 * Applies `ladder[v]` for every `v` from the document's version up to `target − 1`. A document
 * without a version, or already at (or beyond) the target, is returned unchanged. A missing rung
 * stops the climb where it is — the schema then reports the gap instead of this function guessing.
 */
export function runMigrations(raw: unknown, ladder: MigrationLadder, target: number): unknown {
  let v = versionOf(raw)
  if (v === undefined || v >= target) return raw
  let cur = raw as Record<string, unknown>
  while (v < target) {
    const step = ladder[v]
    if (!step) return cur
    cur = { ...step(cur), version: v + 1 }
    v += 1
  }
  return cur
}

/** `fcs:progress` — no step yet: version 1 is the only version that has ever been written. */
export const PROGRESS_MIGRATIONS: MigrationLadder = {}

/** `fcs:settings` — same. */
export const SETTINGS_MIGRATIONS: MigrationLadder = {}
