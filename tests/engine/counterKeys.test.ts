import { describe, expect, it } from 'vitest'
import { COUNTER, FLAG } from '@/engine/keys'

/**
 * The shared layers (engine, metrics, lib) may only touch counter and flag keys that
 * `src/engine/keys.ts` lists, and the list may hold nothing the code no longer uses. This is the
 * whole enforcement: a typo in a shared key becomes a failing test naming the file instead of a
 * metric that silently reads `?? 0`. Scenario modules keep their own keys and are not scanned.
 */
const SHARED = import.meta.glob(
  ['../../src/engine/**/*.ts', '../../src/metrics/**/*.ts', '../../src/lib/**/*.ts'],
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
) as Record<string, string>

const SCENARIOS = import.meta.glob('../../src/scenarios/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function keysIn(sources: Record<string, string>, bag: 'counters' | 'flags'): Map<string, string[]> {
  const re = new RegExp(`\\b${bag}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g')
  const found = new Map<string, string[]>()
  for (const [file, src] of Object.entries(sources)) {
    if (file.endsWith('.test.ts') || file.endsWith('/keys.ts')) continue
    for (const m of src.matchAll(re)) {
      const key = m[1]!
      if (!found.has(key)) found.set(key, [])
      found.get(key)!.push(file.replace(/^.*\/src\//, 'src/'))
    }
  }
  return found
}

describe('shared counter and flag keys', () => {
  it('every counters.<key> the shared layers touch is registered', () => {
    const used = keysIn(SHARED, 'counters')
    const unknown = [...used]
      .filter(([k]) => !(k in COUNTER))
      .map(([k, f]) => `${k} (${f.join(', ')})`)
    expect(unknown, `src/engine/keys.ts에 없는 카운터 키:\n${unknown.join('\n')}`).toEqual([])
  })

  it('every flags.<key> the shared layers touch is registered', () => {
    const used = keysIn(SHARED, 'flags')
    const unknown = [...used]
      .filter(([k]) => !(k in FLAG))
      .map(([k, f]) => `${k} (${f.join(', ')})`)
    expect(unknown, `src/engine/keys.ts에 없는 플래그 키:\n${unknown.join('\n')}`).toEqual([])
  })

  it('every registered key is still used somewhere (engine, metrics, lib or a scenario)', () => {
    const counters = new Set([
      ...keysIn(SHARED, 'counters').keys(),
      ...keysIn(SCENARIOS, 'counters').keys(),
    ])
    const flags = new Set([...keysIn(SHARED, 'flags').keys(), ...keysIn(SCENARIOS, 'flags').keys()])
    const deadCounters = Object.keys(COUNTER).filter((k) => !counters.has(k))
    const deadFlags = Object.keys(FLAG).filter((k) => !flags.has(k))
    expect(deadCounters, '아무도 쓰지 않는 카운터 키').toEqual([])
    expect(deadFlags, '아무도 쓰지 않는 플래그 키').toEqual([])
  })

  it('registry values equal their keys', () => {
    for (const [k, v] of Object.entries(COUNTER)) expect(v).toBe(k)
    for (const [k, v] of Object.entries(FLAG)) expect(v).toBe(k)
  })
})
