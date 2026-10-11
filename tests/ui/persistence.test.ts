import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ENGINE_VERSION, type ScenarioDefinition } from '@/engine'
import { runMigrations, type MigrationLadder } from '@/persistence/migrate'
import {
  BACKUP_FILE_KIND,
  emptyProgress,
  parseBackupFile,
  progressStateSchema,
  saveIsStale,
  STORAGE_VERSION,
} from '@/persistence/schema'
import { listCorruptBackups, loadValidated, removeCorruptBackups } from '@/persistence/storage'

/**
 * `z.literal(1)` says "this version only". The ladder is what makes a version number a plan rather
 * than a cliff: these tests climb a synthetic ladder, keep one corrupt copy instead of one per
 * app open, read both backup-file shapes, and define staleness once for scenario and engine.
 */
describe('runMigrations', () => {
  const ladder: MigrationLadder = {
    1: (raw) => ({ ...raw, renamed: raw.old, old: undefined }),
    2: (raw) => ({ ...raw, added: 'x' }),
  }

  it('climbs every rung from the document version to the target, stamping the version', () => {
    const out = runMigrations({ version: 1, old: 'v' }, ladder, 3) as Record<string, unknown>
    expect(out.version).toBe(3)
    expect(out.renamed).toBe('v')
    expect(out.added).toBe('x')
  })

  it('leaves a current, future or unversioned document untouched', () => {
    const cur = { version: 3, a: 1 }
    expect(runMigrations(cur, ladder, 3)).toBe(cur)
    expect(runMigrations({ version: 9 }, ladder, 3)).toEqual({ version: 9 })
    expect(runMigrations({ a: 1 }, ladder, 3)).toEqual({ a: 1 })
    expect(runMigrations(null, ladder, 3)).toBeNull()
  })

  it('stops at a missing rung and lets the schema report the gap', () => {
    const out = runMigrations({ version: 1 }, { 1: (r) => r }, 4) as Record<string, unknown>
    expect(out.version).toBe(2)
  })
})

describe('loadValidated with a migration', () => {
  const KEY = 'fcs:test-doc'
  const schema = z.object({ version: z.literal(2), name: z.string() })
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('reads an older document through the ladder instead of calling it corrupt', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, title: 'old' }))
    const r = loadValidated(KEY, schema, (raw) =>
      runMigrations(raw, { 1: (d) => ({ name: d.title }) }, 2),
    )
    expect(r.corrupt).toBe(false)
    expect(r.value).toEqual({ version: 2, name: 'old' })
  })

  it('keeps exactly one corrupt copy, however many times the bad document is loaded', () => {
    localStorage.setItem(KEY, '{"version":2}')
    expect(loadValidated(KEY, schema).corrupt).toBe(true)
    expect(listCorruptBackups(KEY)).toHaveLength(1)
    // The original is removed so the next load starts clean; put it back to simulate a re-open.
    localStorage.setItem(KEY, '{"version":2}')
    expect(loadValidated(KEY, schema).corrupt).toBe(true)
    expect(listCorruptBackups(KEY)).toHaveLength(1)
    expect(listCorruptBackups(KEY)[0]!.raw).toBe('{"version":2}')
    removeCorruptBackups(KEY)
    expect(listCorruptBackups(KEY)).toHaveLength(0)
  })
})

describe('parseBackupFile', () => {
  it('accepts the progress-only file older builds exported', () => {
    const r = parseBackupFile(emptyProgress('2026-01-01T00:00:00.000Z'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe(BACKUP_FILE_KIND)
      expect(r.value.settings).toBeUndefined()
    }
  })

  it('accepts the wrapped file with settings and rejects anything else', () => {
    const r = parseBackupFile({
      kind: BACKUP_FILE_KIND,
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      progress: emptyProgress('2026-01-01T00:00:00.000Z'),
    })
    expect(r.ok).toBe(true)
    expect(parseBackupFile({ hello: 'world' }).ok).toBe(false)
  })

  it('the exported progress still parses as a ProgressState on its own', () => {
    expect(progressStateSchema.safeParse(emptyProgress('2026-01-01T00:00:00.000Z')).success).toBe(
      true,
    )
    expect(STORAGE_VERSION).toBe(1)
  })
})

describe('saveIsStale', () => {
  it('is stale on a scenario bump, on an engine bump, and for a save with no engine version', () => {
    expect(
      saveIsStale({ scenarioVersion: 1, engineVersion: ENGINE_VERSION }, 1, ENGINE_VERSION),
    ).toBe(false)
    expect(
      saveIsStale({ scenarioVersion: 1, engineVersion: ENGINE_VERSION }, 2, ENGINE_VERSION),
    ).toBe(true)
    expect(
      saveIsStale({ scenarioVersion: 1, engineVersion: ENGINE_VERSION - 1 }, 1, ENGINE_VERSION),
    ).toBe(true)
    expect(saveIsStale({ scenarioVersion: 1 }, 1, ENGINE_VERSION)).toBe(true)
  })
})

describe('gameStore and the engine version', () => {
  it('stamps saves with the engine version and refuses to resume one from an older engine', async () => {
    const { useGameStore } = await import('@/store/gameStore')
    const { useProgressStore } = await import('@/store/progressStore')
    const { miniBank } = await import('../fixtures/miniBank')
    const def = miniBank as unknown as ScenarioDefinition
    localStorage.clear()
    useProgressStore.getState().resetAll()
    useGameStore.getState().start(def, 'standard', 1, 0)
    const saved = useProgressStore.getState().getScenario(def.meta.id).inProgress!
    expect(saved.engineVersion).toBe(ENGINE_VERSION)
    useGameStore.getState().abandon()
    expect(useGameStore.getState().restore(def, saved)).toBe(true)
    useGameStore.getState().abandon()
    expect(
      useGameStore.getState().restore(def, { ...saved, engineVersion: ENGINE_VERSION - 1 }),
    ).toBe(false)
    expect(useGameStore.getState().restore(def, { ...saved, engineVersion: undefined })).toBe(false)
    useGameStore.getState().abandon()
    useProgressStore.getState().resetAll()
  })
})
