import type { TypeOf, ZodTypeAny } from 'zod'

export const KEYS = {
  settings: 'fcs:settings',
  progress: 'fcs:progress',
} as const

export interface LoadResult<T> {
  value: T | null
  corrupt: boolean
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Generic over the *schema* rather than over one payload type: a field carrying `.default()` has an
 * input type that differs from its output (the field is optional going in, always present coming
 * out), and `ZodType<T>` collapses the two — which silently hands callers the input shape and makes
 * a defaulted field look possibly-undefined at every use site.
 *
 * `migrate` runs on the raw JSON before parsing (see `migrate.ts`); without it the schema's
 * version literal rejects every document written by an older build.
 */
export function loadValidated<S extends ZodTypeAny>(
  key: string,
  schema: S,
  migrate: (raw: unknown) => unknown = (raw) => raw,
): LoadResult<TypeOf<S>> {
  const raw = safeGet(key)
  if (!raw) return { value: null, corrupt: false }
  try {
    const parsed = schema.safeParse(migrate(JSON.parse(raw)))
    if (parsed.success) return { value: parsed.data, corrupt: false }
    backupCorrupt(key, raw)
    return { value: null, corrupt: true }
  } catch {
    backupCorrupt(key, raw)
    return { value: null, corrupt: true }
  }
}

const corruptKey = (key: string, at: number) => `${key}.corrupt.${at}`
const corruptPrefix = (key: string) => `${key}.corrupt.`

/**
 * Keeps the most recent corrupt copy of `key` only. It used to add a new copy on every load that
 * failed to parse — the same unreadable document, once per app open — until the copies filled the
 * quota and the *working* save could no longer be written.
 */
function backupCorrupt(key: string, raw: string): void {
  try {
    for (const b of listCorruptBackups(key)) localStorage.removeItem(corruptKey(key, b.at))
    localStorage.setItem(corruptKey(key, Date.now()), raw)
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export interface CorruptBackup {
  /** Epoch ms the copy was taken. */
  at: number
  raw: string
}

/** Corrupt copies of `key`, newest first. */
export function listCorruptBackups(key: string): CorruptBackup[] {
  const out: CorruptBackup[] = []
  try {
    const prefix = corruptPrefix(key)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(prefix)) continue
      const at = Number(k.slice(prefix.length))
      const raw = localStorage.getItem(k)
      if (Number.isFinite(at) && raw !== null) out.push({ at, raw })
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => b.at - a.at)
}

export function removeCorruptBackups(key: string): void {
  try {
    for (const b of listCorruptBackups(key)) localStorage.removeItem(corruptKey(key, b.at))
  } catch {
    /* ignore */
  }
}

export type SaveResult = 'ok' | 'quota' | 'unavailable'

export function save(key: string, value: unknown): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return 'ok'
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota'
    return 'unavailable'
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function clearAll(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('fcs:')) toRemove.push(k)
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/** Debounce helper for store subscriptions. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
