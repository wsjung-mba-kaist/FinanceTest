import { describe, expect, it } from 'vitest'
import {
  autoplay,
  computeScore,
  getNumberPath,
  latestSnapshot,
  replay,
  type Checkpoint,
  type InstitutionState,
  type Policy,
  type ScenarioDefinition,
} from '@/engine'
import { miniBank } from '../fixtures/miniBank'
import { loadAvailableScenariosSafe } from '../helpers/load'
import { findNonFinite } from '../helpers/scan'
import { asGeneric } from '../helpers/scenario'

const registry = await loadAvailableScenariosSafe()

const cases: [id: string, def: ScenarioDefinition<InstitutionState>][] = [
  ['mini-bank (fixture)', asGeneric(miniBank)],
  ...registry.map((d): [string, ScenarioDefinition<InstitutionState>] => [d.meta.id, d]),
]

const runs: [label: string, policy: Policy, rngSeed: number][] = [
  ['historical', 'historical', 7],
  ['expert', 'expert', 7],
  ['worst', 'worst', 7],
  ['random#1', 'random', 1],
  ['random#2', 'random', 2],
  ['random#3', 'random', 3],
]

/** Value of a checkpoint target after the decisions of the turn `turnId` (exact: replays the historical log up to that turn). */
function checkpointActual(
  def: ScenarioDefinition<InstitutionState>,
  cp: Checkpoint,
  seed: number,
): { actual: number | undefined; turnIndex: number } {
  const turnIndex = def.turns.findIndex((t) => t.id === cp.turnId)
  if (turnIndex < 0) return { actual: undefined, turnIndex }
  const full = autoplay(def, 'historical', { seed })
  const log = full.decisions.filter((d) => d.turnIndex <= turnIndex)
  const { state } = replay(def, { seed, decisions: log, turnIndex })
  if (state.turnIndex !== turnIndex) return { actual: undefined, turnIndex }
  if (cp.metric) return { actual: latestSnapshot(state).metrics[cp.metric]?.value, turnIndex }
  if (cp.counter) return { actual: state.counters[cp.counter] ?? 0, turnIndex }
  if (cp.path) return { actual: getNumberPath(state, cp.path), turnIndex }
  return { actual: undefined, turnIndex }
}

function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected)
}

describe('autoplayer', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  describe.each(cases)('%s', (id, def) => {
    it.each(runs)(
      '%s completes without NaN/Infinity, with `ended` set and a score in [0,100]',
      (_label, policy, rngSeed) => {
        const r = autoplay(def, policy, { seed: 1, rngSeed })
        expect(r.state.phase).toBe('ended')
        expect(r.state.ended).toBeDefined()
        expect(findNonFinite(r.state)).toEqual([])
        for (const h of r.history) expect(findNonFinite(h)).toEqual([])
        const score = computeScore(r.state, def)
        expect(score.total).toBeGreaterThanOrEqual(0)
        expect(score.total).toBeLessThanOrEqual(100)
        expect(findNonFinite(score)).toEqual([])
        if (r.deviations.length > 0)
          console.warn(`[autoplay] ${id}/${policy}: path deviations`, r.deviations)
      },
    )

    it('expert path scores at least the historical path (unless the scenario opts out)', () => {
      const hist = computeScore(autoplay(def, 'historical').state, def)
      const expert = computeScore(autoplay(def, 'expert').state, def)
      if (def.paths.expert?.expertMayNotBeatHistorical) {
        console.warn(
          `[autoplay] ${id}: expertMayNotBeatHistorical set (expert ${expert.total} vs historical ${hist.total})`,
        )
        return
      }
      expect(
        expert.total,
        `expert ${expert.total} < historical ${hist.total}`,
      ).toBeGreaterThanOrEqual(hist.total)
    })

    const checkpoints = def.checkpoints ?? []
    it.skipIf(checkpoints.length === 0)(
      'reproduces every checkpoint on the historical path within tolerance',
      () => {
        const failures: string[] = []
        for (const cp of checkpoints) {
          const { actual, turnIndex } = checkpointActual(def, cp, 1)
          if (turnIndex < 0) {
            failures.push(`${cp.label}: turn ${cp.turnId} not found`)
            continue
          }
          if (actual === undefined || !Number.isFinite(actual)) {
            failures.push(
              `${cp.label}: no value for ${cp.metric ?? cp.counter ?? cp.path} at T${turnIndex} (run may have ended earlier)`,
            )
            continue
          }
          const err = relativeError(actual, cp.expected)
          if (err > cp.tolerance) {
            failures.push(
              `${cp.label} (T${turnIndex} ${cp.metric ?? cp.counter ?? cp.path}): actual ${actual} vs expected ${cp.expected} (rel. error ${(err * 100).toFixed(1)}% > ${(cp.tolerance * 100).toFixed(0)}%)`,
            )
          }
        }
        expect(failures, `\n${failures.join('\n')}`).toEqual([])
      },
    )
  })

  it('fixture: expert-path primary KPI series matches the snapshot', () => {
    const primary = miniBank.kpis.find((k) => k.primary)?.metric ?? miniBank.kpis[0]!.metric
    const r = autoplay(miniBank, 'expert')
    const series = r.state.metricsHistory.map((m) => ({
      turn: miniBank.turns[m.turnIndex]!.id,
      [primary]: Math.round(m.metrics[primary]!.value * 1000) / 1000,
    }))
    expect(series).toHaveLength(miniBank.turns.length)
    expect(series).toMatchSnapshot()
  })

  it('fixture: checkpoint helper reads the value after the turn decisions, not at turn start', () => {
    const cp = miniBank.checkpoints![0]!
    const { actual, turnIndex } = checkpointActual(asGeneric(miniBank), cp, 1)
    expect(turnIndex).toBe(1)
    expect(actual).toBeCloseTo(cp.expected, 1)
  })
})
