/** Dotted-path helpers used by declarative `op` effects, conditions and integrity checks. */

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

export function getNumberPath(obj: unknown, path: string): number | undefined {
  const v = getPath(obj, path)
  return typeof v === 'number' ? v : undefined
}

/** Sets a numeric leaf; returns false if the path does not resolve to an existing number. */
export function setNumberPath(obj: unknown, path: string, value: number): boolean {
  const segs = path.split('.')
  let cur: unknown = obj
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[segs[i]!]
  }
  if (cur === null || typeof cur !== 'object') return false
  const last = segs[segs.length - 1]!
  const rec = cur as Record<string, unknown>
  if (typeof rec[last] !== 'number') return false
  rec[last] = value
  return true
}

/** Lists every numeric leaf path (arrays use index segments). */
export function listNumericPaths(obj: unknown, prefix = ''): string[] {
  const out: string[] = []
  if (obj === null || typeof obj !== 'object') return out
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as const)
    : Object.entries(obj as Record<string, unknown>)
  for (const [k, v] of entries) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'number') out.push(p)
    else if (v && typeof v === 'object') out.push(...listNumericPaths(v, p))
  }
  return out
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
