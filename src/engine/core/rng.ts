/**
 * mulberry32 PRNG in stateless form so the 32-bit state can live inside the immutable GameState.
 * Same seed + same call sequence ⇒ identical values (determinism guarantee).
 */
export function rngNext(state: number): { value: number; next: number } {
  const next = (state + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), 1 | next)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, next }
}

export function seedToState(seed: number): number {
  return seed >>> 0
}

/** Convenience generator for tests/autoplay (not used inside the engine's immutable state). */
export function makeRng(seed: number): () => number {
  let s = seedToState(seed)
  return () => {
    const r = rngNext(s)
    s = r.next
    return r.value
  }
}
