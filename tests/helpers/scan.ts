/**
 * Deep scanner for non-finite numbers. Walks plain data (objects / arrays) and returns the dotted
 * path of every `NaN`, `Infinity` or `-Infinity` it finds. Functions and non-plain values are ignored.
 */
export function findNonFinite(value: unknown, prefix = ''): string[] {
  const out: string[] = []
  const seen = new WeakSet<object>()
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) out.push(path || '<root>')
      return
    }
    if (v === null || typeof v !== 'object') return
    if (seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)))
      return
    }
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      walk(item, path ? `${path}.${k}` : k)
    }
  }
  walk(value, prefix)
  return out
}

/** Convenience assertion helper: returns an empty array when the value is clean. */
export function assertFinite(value: unknown, label = 'value'): void {
  const bad = findNonFinite(value)
  if (bad.length > 0) {
    throw new Error(
      `${label}: non-finite numbers at ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ` (+${bad.length - 10} more)` : ''}`,
    )
  }
}
