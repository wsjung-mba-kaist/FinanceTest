import { describe, expect, it } from 'vitest'
import { gaussian, jitterTick, noiseFactor } from '@/engine/core/noise'
import { makeRng } from '@/engine/core/rng'
import type { EffectContext } from '@/engine'

/**
 * Determinism («같은 입력 → 같은 출력») and fairness («노이즈는 결과를 한쪽으로 밀지 않는다») are
 * different properties. The suite already pins the first; this file pins the second, because the
 * jitter at variance 0.5 used to round −0.5 to 0 and +0.5 to +1 — calls could only ever come late.
 */
describe('jitterTick', () => {
  const N = 6000
  const ticks = 9
  const base = 4

  function meanOffset(variance: number, jitter: number): { mean: number; hist: number[] } {
    const rng = makeRng(42)
    let sum = 0
    const hist: number[] = Array(ticks).fill(0)
    for (let i = 0; i < N; i++) {
      const t = jitterTick(rng, base, jitter, ticks, variance)
      sum += t - base
      hist[t]!++
    }
    return { mean: sum / N, hist }
  }

  it('is symmetric at variance 1', () => {
    const { mean, hist } = meanOffset(1, 1)
    expect(Math.abs(mean)).toBeLessThan(0.05)
    // Each of −1 / 0 / +1 lands about a third of the time.
    for (const t of [base - 1, base, base + 1]) expect(hist[t]! / N).toBeGreaterThan(0.28)
  })

  it('is symmetric at variance 0.5 (the setting the app offers as «약간»)', () => {
    const { mean, hist } = meanOffset(0.5, 1)
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(hist[base - 1]! / N).toBeGreaterThan(0.28)
    expect(hist[base + 1]! / N).toBeGreaterThan(0.28)
  })

  it('never draws at variance 0 and stays inside the turn', () => {
    let draws = 0
    const rng = () => {
      draws++
      return 0.99
    }
    expect(jitterTick(rng, 4, 3, 9, 0)).toBe(4)
    expect(draws).toBe(0)
    expect(jitterTick(makeRng(1), 0, 3, 9, 1)).toBeGreaterThanOrEqual(0)
    expect(jitterTick(makeRng(1), 8, 3, 9, 1)).toBeLessThanOrEqual(8)
  })
})

describe('gaussian', () => {
  it('has mean ≈ 0 and variance ≈ 1', () => {
    const rng = makeRng(7)
    const N = 20000
    let sum = 0
    let sq = 0
    for (let i = 0; i < N; i++) {
      const g = gaussian(rng)
      sum += g
      sq += g * g
    }
    const mean = sum / N
    expect(Math.abs(mean)).toBeLessThan(0.03)
    expect(Math.abs(sq / N - mean * mean - 1)).toBeLessThan(0.05)
  })
})

describe('noiseFactor', () => {
  const ctx = (variance: number, rng: () => number): EffectContext =>
    ({
      turnIndex: 0,
      rng,
      metrics: { turnIndex: -1, metrics: {} },
      flags: {},
      log: () => {},
      tick: 0,
      ticks: 1,
      isLastTick: true,
      variance,
    }) as EffectContext

  it('returns exactly 1 without touching the RNG at variance 0 or σ 0', () => {
    let draws = 0
    const rng = () => {
      draws++
      return 0.5
    }
    expect(noiseFactor(ctx(0, rng), 0.15)).toBe(1)
    expect(noiseFactor(ctx(1, rng), 0)).toBe(1)
    expect(draws).toBe(0)
  })

  it('is capped at ±cap and centred on 1', () => {
    const rng = makeRng(3)
    let sum = 0
    const N = 5000
    for (let i = 0; i < N; i++) {
      const f = noiseFactor(ctx(1, rng), 0.15, 0.3)
      expect(f).toBeGreaterThanOrEqual(0.7)
      expect(f).toBeLessThanOrEqual(1.3)
      sum += f
    }
    expect(Math.abs(sum / N - 1)).toBeLessThan(0.03)
  })
})
