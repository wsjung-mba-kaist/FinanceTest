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
import { miniTicks, TICKED_TURN_INDEX } from '../fixtures/miniTicks'
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
  // A replay can only move forward, so a tick-scoped checkpoint must also drop the decisions that
  // were committed later in that turn — otherwise the log itself drags the state past the tick.
  const log = full.decisions.filter(
    (d) =>
      d.turnIndex < turnIndex ||
      (d.turnIndex === turnIndex && (cp.tick === undefined || (d.tick ?? 0) <= cp.tick)),
  )
  const { state } = replay(def, { seed, decisions: log, turnIndex, tick: cp.tick })
  if (state.turnIndex !== turnIndex) return { actual: undefined, turnIndex }
  if (cp.metric) return { actual: latestSnapshot(state).metrics[cp.metric]?.value, turnIndex }
  if (cp.counter) return { actual: state.counters[cp.counter] ?? 0, turnIndex }
  if (cp.path) return { actual: getNumberPath(state, cp.path), turnIndex }
  return { actual: undefined, turnIndex }
}

function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected)
}

/**
 * Verdict for one checkpoint; `undefined` means it passed. `absTolerance` is an alternative to the
 * relative one, not a narrowing of it — near zero (a closing balance of −$958M) a relative band is
 * meaningless, so either tolerance being met is enough.
 */
function checkpointFailure(
  cp: Checkpoint,
  actual: number | undefined,
  turnIndex: number,
): string | undefined {
  const target = cp.metric ?? cp.counter ?? cp.path
  const at = cp.tick === undefined ? '' : ` tick ${cp.tick}`
  if (turnIndex < 0) return `${cp.label}: turn ${cp.turnId} not found`
  if (actual === undefined || !Number.isFinite(actual))
    return `${cp.label}: no value for ${target} at T${turnIndex}${at} (run may have ended earlier)`
  const err = relativeError(actual, cp.expected)
  const absErr = Math.abs(actual - cp.expected)
  if (err <= cp.tolerance) return undefined
  if (cp.absTolerance !== undefined && absErr <= cp.absTolerance) return undefined
  const abs =
    cp.absTolerance === undefined ? '' : `, abs. error ${absErr.toFixed(3)} > ${cp.absTolerance}`
  return `${cp.label} (T${turnIndex}${at} ${target}): actual ${actual} vs expected ${cp.expected} (rel. error ${(err * 100).toFixed(1)}% > ${(cp.tolerance * 100).toFixed(0)}%${abs})`
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
          const failure = checkpointFailure(cp, actual, turnIndex)
          if (failure) failures.push(failure)
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

  describe('checkpoint tolerance', () => {
    const base: Checkpoint = { turnId: 't1', metric: 'cash', expected: -0.958, tolerance: 0.15, label: '마감 잔고' }

    it('fails a value outside the relative band', () => {
      expect(checkpointFailure(base, -1.6, 1)).toMatch(/rel\. error/)
    })

    it('passes it when `absTolerance` covers the gap (near-zero targets)', () => {
      expect(checkpointFailure({ ...base, absTolerance: 0.8 }, -1.6, 1)).toBeUndefined()
    })

    it('still fails when neither tolerance is met', () => {
      expect(checkpointFailure({ ...base, absTolerance: 0.2 }, -1.6, 1)).toMatch(/abs\. error/)
    })

    it('reads a ticked checkpoint at the requested tick, not the turn end', () => {
      const ticked: Checkpoint = {
        turnId: miniTicks.turns[TICKED_TURN_INDEX]!.id,
        path: 'institution.cash',
        expected: 0,
        tolerance: 1,
        label: 'tick 0 cash',
      }
      const gen = asGeneric(miniTicks)
      const first = checkpointActual(gen, { ...ticked, tick: 0 }, 1).actual
      const last = checkpointActual(gen, ticked, 1).actual
      expect(first).toBeDefined()
      expect(last).toBeDefined()
      expect(first).not.toBeCloseTo(last!, 6)
    })
  })
})
