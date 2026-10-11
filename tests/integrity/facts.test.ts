import { describe, expect, it } from 'vitest'
import type { ScenarioDefinition } from '@/engine'
import { loadScenario } from '@/scenarios'

/**
 * The fact ledgers are this project's accuracy contract: every number a trainee sees is supposed to
 * trace to a source. Nothing enforced that the ledger still described the state it documents, so a
 * calibration change could silently orphan its own citation. This test closes that gap — in both
 * directions.
 *
 * Direction 1 (ledger → state): every ledger row on a state path must resolve and match.
 * Direction 2 (state → ledger): every numeric leaf of the initial state should have a ledger row.
 * The second direction used to live in three scenario tests as copies, and nowhere for the other
 * ten — the worked example (svb-2023) had 44 of its 76 leaves outside the ledger and nothing said
 * so. The gap is held by a **ratchet**: each scenario has a ceiling equal to today's count, the
 * ceiling may only be lowered, and adding an uncited figure fails the suite. A guarantee holds only
 * where a test looks; this is where it looks now.
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
/** Roots walked for direction 2 (counters and the regulator level are set by effects, not cited). */
const LEAF_ROOTS = ['institution', 'market', 'confidence'] as const

/**
 * Initial-state leaves with no ledger row, per scenario. Lower a number when you cite a figure;
 * never raise one. A scenario that is not listed is held at 0.
 */
const UNCITED_LEAF_CEILING: Record<string, number> = {
  'svb-2023': 44,
  'taeyoung-pf-2024': 24,
  'lehman-2008': 13,
  'korea-imf-1997': 5,
  'savings-bank-2011': 2,
}

/**
 * Open `VERIFY` rows per scenario. The authoring guide asks for zero at release; these are the
 * figures whose primary source is known but not yet in hand (each row's note names it). The
 * ceiling makes "resolve one" visible and "add one" impossible without saying so here.
 */
const VERIFY_CEILING: Record<string, number> = {
  'archegos-2021': 14,
  'covid-2020-fund': 3,
  'credit-suisse-2023': 2,
  'els-margin-2020': 5,
  'korea-imf-1997': 5,
  'legoland-2022': 3,
  'lehman-2008': 6,
  'mg-run-2023': 4,
  'savings-bank-2011': 5,
}

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

function numericLeaves(obj: unknown, prefix: string, out: string[]): void {
  if (obj === null || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'number') out.push(p)
    else if (v && typeof v === 'object') numericLeaves(v, p, out)
  }
}

function ratchet(id: string, what: string, count: number, ceiling: number): void {
  expect(
    count,
    `${id}: ${what} ${count}건 > 상한 ${ceiling}건 — 새 숫자에는 원장 행이 필요합니다`,
  ).toBeLessThanOrEqual(ceiling)
  expect(
    count,
    `${id}: ${what} ${count}건 < 상한 ${ceiling}건 — 상한을 ${count}으로 내려 적어 두세요`,
  ).toBe(ceiling)
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

  it('every ceiling names a scenario that exists', () => {
    const ids = new Set(cases.map(([id]) => id))
    for (const id of [...Object.keys(UNCITED_LEAF_CEILING), ...Object.keys(VERIFY_CEILING)])
      expect(ids.has(id), `상한 표의 ${id}는 시나리오가 아닙니다`).toBe(true)
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

    // Direction 1: ledger → state.
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

    // Direction 2: state → ledger, held by the ratchet.
    const cited = new Set(ledger!.map((f) => f.path))
    const leaves: string[] = []
    for (const root of LEAF_ROOTS) numericLeaves(init[root], root, leaves)
    const uncited = leaves.filter((p) => !cited.has(p))
    if (uncited.length > 0)
      console.warn(`[facts] ${id}: 원장에 없는 초기값\n  ${uncited.join('\n  ')}`)
    ratchet(id, '원장에 없는 초기 상태 숫자', uncited.length, UNCITED_LEAF_CEILING[id] ?? 0)

    // Open VERIFY rows: each must say how it will be resolved, and the count may only fall.
    const verify = ledger!.filter((f) => f.tag === 'VERIFY')
    for (const f of verify)
      expect(f.note, `${id}: VERIFY 행 ${f.path}에 해소 경로(note)가 없습니다`).toBeTruthy()
    ratchet(id, '열린 VERIFY 행', verify.length, VERIFY_CEILING[id] ?? 0)
  })
})
