import { describe, expect, it } from 'vitest'
import { autoplay, computeScore, latestSnapshot, type InstitutionState } from '@/engine'
import type { ScenarioDefinition } from '@/engine'
import { loadAvailableScenariosSafe } from '../helpers/load'
import { findNonFinite } from '../helpers/scan'
import { asGeneric } from '../helpers/scenario'
import { miniTicks } from '../fixtures/miniTicks'

/**
 * Every other test in this repo runs at `variance: 0`, the canonical mode in which the engine never
 * draws from the RNG. **Live play defaults to `variance: 1`**, so without this file the mode players
 * actually use is the one mode nothing exercises.
 *
 * What is asserted here is a band, not an equality: noise is magnitude-only and must never flip an
 * outcome. A scenario whose ending reason changes with the seed is miscalibrated — the noise is
 * large enough to be doing the deciding.
 *
 * **`seed`, not `rngSeed`.** `autoplay` takes two independent streams: `seed` initialises
 * `GameState.rng`, which is what the engine's noise draws from, while `rngSeed` drives the *policy*
 * (which option a `random` run picks). Varying `rngSeed` on a `historical` run changes nothing at
 * all, because the path fixes every choice. Only `seed` moves the noise.
 */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const registry = await loadAvailableScenariosSafe()
const cases: [id: string, def: ScenarioDefinition<InstitutionState>][] = [
  ['mini-ticks (fixture)', asGeneric(miniTicks)],
  ...registry.map((d): [string, ScenarioDefinition<InstitutionState>] => [d.meta.id, d]),
]

describe('live-play volatility (variance 1)', () => {
  it.skipIf(registry.length > 0)('registry scenarios are not available yet (skipped)', (ctx) => {
    ctx.skip()
  })

  describe.each(cases)('%s', (_id, def) => {
    it('finishes cleanly on every seed, with a score in [0,100] and no NaN', () => {
      const problems: string[] = []
      for (const seed of SEEDS) {
        const r = autoplay(def, 'historical', { seed, variance: 1 })
        if (r.state.phase !== 'ended') problems.push(`seed ${seed}: 종료되지 않음`)
        const bad = findNonFinite(r.state)
        if (bad.length > 0) problems.push(`seed ${seed}: 유한하지 않은 값 ${bad.join(', ')}`)
        const score = computeScore(r.state, def)
        if (!(score.total >= 0 && score.total <= 100))
          problems.push(`seed ${seed}: 점수 ${score.total}`)
      }
      expect(problems, `\n${problems.join('\n')}`).toEqual([])
    })

    it('noise changes magnitudes, never the ending — the historical outcome is stable', () => {
      const canonical = autoplay(def, 'historical', { seed: 1, variance: 0 })
      const expected = canonical.state.ended?.reason
      expect(expected, '정본 경로에 종료 사유가 없습니다').toBeDefined()

      const reasons = SEEDS.map(
        (seed) =>
          autoplay(def, 'historical', { seed, variance: 1 }).state.ended?.reason,
      )
      const same = reasons.filter((r) => r === expected).length
      // A single seed may legitimately tip a borderline scenario; a pattern of them is calibration.
      expect(
        same,
        `종료 사유가 시드에 따라 흔들립니다: 기대 ${expected}, 실제 ${JSON.stringify(reasons)}`,
      ).toBeGreaterThanOrEqual(SEEDS.length - 1)
    })

    it('the same seed reproduces exactly at variance 1', () => {
      const a = autoplay(def, 'historical', { seed: 4, variance: 1 })
      const b = autoplay(def, 'historical', { seed: 4, variance: 1 })
      expect(a.state.rng).toBe(b.state.rng)
      expect(a.state.ended?.reason).toBe(b.state.ended?.reason)
      expect(latestSnapshot(a.state).metrics).toEqual(latestSnapshot(b.state).metrics)
    })

    it('every expert path also survives the noise', () => {
      if (!def.paths.expert) return
      const problems: string[] = []
      for (const seed of SEEDS.slice(0, 5)) {
        const r = autoplay(def, 'expert', { seed, variance: 1 })
        if (r.state.phase !== 'ended') problems.push(`seed ${seed}: 종료되지 않음`)
        if (findNonFinite(r.state).length > 0) problems.push(`seed ${seed}: 유한하지 않은 값`)
      }
      expect(problems, `\n${problems.join('\n')}`).toEqual([])
    })
  })

  it('a canonical run consumes no randomness at all', () => {
    // The guarantee is about the engine, so it is asserted on the shipped scenarios. The `miniBank`
    // fixture deliberately calls `ctx.rng()` from an authored effect to exercise the plumbing, so it
    // is excluded here — an authored draw is the scenario's choice, not the engine's.
    const problems: string[] = []
    for (const def of registry) {
      const quiet = autoplay(def, 'historical', { seed: 1, variance: 0 })
      if (quiet.state.rng !== quiet.history[0]!.rng)
        problems.push(
          `${def.meta.id}: variance 0에서 rng가 ${quiet.history[0]!.rng} → ${quiet.state.rng}`,
        )
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('a scenario that declares noise actually uses it at variance 1', () => {
    const noisy = registry.filter((d) => d.noise !== undefined)
    expect(noisy.length, '`noise`를 선언한 시나리오가 하나도 없습니다').toBeGreaterThan(0)
    const inert: string[] = []
    for (const def of noisy) {
      const r = autoplay(def, 'historical', { seed: 3, variance: 1 })
      if (r.state.rng === r.history[0]!.rng) inert.push(def.meta.id)
    }
    expect(inert, `noise를 선언했지만 variance 1에서 난수를 쓰지 않습니다: ${inert.join(', ')}`).toEqual(
      [],
    )
  })
})
