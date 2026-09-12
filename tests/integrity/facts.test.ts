import { describe, expect, it } from 'vitest'
import type { ScenarioDefinition } from '@/engine'
import { loadScenario } from '@/scenarios'

/**
 * The fact ledgers are this project's accuracy contract: every number a trainee sees is supposed to
 * trace to a source. Nothing enforced that the ledger still described the state it documents, so a
 * calibration change could silently orphan its own citation. This test closes that gap.
 *
 * Only paths that address the initial state are checked (`institution.`, `market.`, `confidence.`,
 * `counters.`, `regulatorLevel`); `anchor.`, `event.`, `timeline.`, `policy.`, `industry.`,
 * `checkpoint.` and `turns.` rows document things that are not T0 leaves and are skipped. A dated
 * observation that is not the T0 value (a later close, a daily move) therefore belongs on an
 * `anchor.*` path — putting it on a state path would read as drift, which is the point.
 *
 * Scenarios and their ledgers are **discovered**, not listed: a new scenario is covered the moment
 * it has a `facts.ts`, and one that loses its ledger fails the census below.
 */
interface FactRowLike {
  path: string
  value: number
  tag?: string
  note?: string
}

const STATE_ROOTS = ['institution', 'market', 'confidence', 'counters', 'regulatorLevel']

const factModules = import.meta.glob('../../src/scenarios/*/facts.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>

function scenarioIdOf(path: string): string {
  return path.replace(/^.*\/scenarios\//, '').replace(/\/facts\.ts$/, '')
}

/** A ledger is the module's first exported array of `{ path, value }` rows, whatever it is named. */
function ledgerOf(mod: Record<string, unknown>): FactRowLike[] | undefined {
  for (const value of Object.values(mod)) {
    if (!Array.isArray(value) || value.length === 0) continue
    const first = value[0] as Partial<FactRowLike>
    if (typeof first?.path === 'string' && typeof first?.value === 'number')
      return value as FactRowLike[]
  }
  return undefined
}

function resolve(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

const cases = Object.entries(factModules)
  .map(([file, mod]) => [scenarioIdOf(file), ledgerOf(mod)] as const)
  .sort((a, b) => a[0].localeCompare(b[0]))

describe('fact ledgers describe the initial state they cite', () => {
  it('every scenario directory with a facts module exports a readable ledger', () => {
    expect(cases.length).toBeGreaterThan(0)
    const empty = cases.filter(([, ledger]) => !ledger || ledger.length === 0).map(([id]) => id)
    expect(empty, `원장을 읽을 수 없습니다: ${empty.join(', ')}`).toEqual([])
  })

  it.each(cases.map(([id]) => [id] as const))('%s', async (id) => {
    const ledger = cases.find(([x]) => x === id)?.[1]
    expect(ledger, `${id}: 원장 없음`).toBeDefined()
    const scenario = (await loadScenario(id)) as ScenarioDefinition | undefined
    // A ledger can exist before the scenario is registered; skip rather than fail in that window.
    if (!scenario) return

    const init = {
      ...scenario.initialState,
      regulatorLevel: scenario.initialState.regulatorLevel ?? 0,
    }
    const drift: string[] = []
    const unresolved: string[] = []
    let checked = 0

    for (const f of ledger!) {
      if (!STATE_ROOTS.includes(f.path.split('.')[0]!)) continue
      const actual = resolve(init, f.path)
      if (typeof actual !== 'number') {
        unresolved.push(`${f.path} → ${String(actual)}`)
        continue
      }
      checked++
      if (Math.abs(actual - f.value) > 1e-9)
        drift.push(`${f.path}: 원장 ${f.value} vs 초기 상태 ${actual}`)
    }

    expect(unresolved, `해석되지 않는 경로:\n${unresolved.join('\n')}`).toEqual([])
    expect(drift, `원장과 초기 상태가 다릅니다:\n${drift.join('\n')}`).toEqual([])
    expect(checked, `${id}: 상태 경로 행이 너무 적습니다`).toBeGreaterThan(10)
  })
})
