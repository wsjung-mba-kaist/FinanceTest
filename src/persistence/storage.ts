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
 */
export function loadValidated<S extends ZodTypeAny>(key: string, schema: S): LoadResult<TypeOf<S>> {
  const raw = safeGet(key)
  if (!raw) return { value: null, corrupt: false }
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    if (parsed.success) return { value: parsed.data, corrupt: false }
    backupCorrupt(key, raw)
    return { value: null, corrupt: true }
  } catch {
    backupCorrupt(key, raw)
    return { value: null, corrupt: true }
  }
}

function backupCorrupt(key: string, raw: string): void {
  try {
    localStorage.setItem(`${key}.corrupt.${Date.now()}`, raw)
    localStorage.removeItem(key)
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
