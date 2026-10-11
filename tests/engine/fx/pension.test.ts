import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type { Effect, GameState, PensionState } from '@/engine'
import { createGame } from '@/engine'
import { EMPTY_SNAPSHOT, applyEffects, makeEffectContext } from '@/engine/core/effects'
import { pensionFx } from '@/engine/fx/pension'
import { ldiInitialPension } from '@/scenarios/uk-ldi-2022/initialState'
import { miniBank } from '../../fixtures/miniBank'

/**
 * Pool accounting identity: `ldi.equity` (NAV) = own collateral + derivative MTM. A yield move
 * changes the MTM; posting the pool's own collateral settles it (NAV unchanged); only money from
 * outside the pool is new NAV. `meetMarginCall` used to add the whole payment to NAV even when it
 * came out of pool cash — a double count that no scenario path test could see because the one
 * LDI scenario had re-implemented the builder locally to avoid it.
 */
type S = GameState<PensionState>

function fresh(): S {
  const base = createGame(miniBank, 1, { variance: 0 }) as unknown as S
  return { ...base, institution: structuredClone(ldiInitialPension) }
}

function apply(state: S, effects: Effect<PensionState>[]): S {
  return produce(state, (d) => {
    applyEffects(d, effects, makeEffectContext(d, EMPTY_SNAPSHOT))
  })
}

const pv01 = (p: PensionState) => (p.assets.ldi.exposure * p.assets.ldi.modDuration) / 10000

describe('pensionFx.yieldShock', () => {
  it('a rise in yields marks the books down, raises a call and charges NAV once', () => {
    const s0 = fresh()
    const p0 = s0.institution
    const dBp = 100
    const s1 = apply(s0, [pensionFx.yieldShock({ deltaBp: dBp })])
    const p1 = s1.institution
    const dy = dBp / 10000
    expect(p1.assets.gilts.marketValue).toBeCloseTo(
      p0.assets.gilts.marketValue * (1 - p0.assets.gilts.modDuration * dy),
      9,
    )
    expect(p1.liabilities.pv).toBeCloseTo(
      p0.liabilities.pv * (1 - p0.liabilities.modDuration * dy),
      9,
    )
    const loss = pv01(p0) * dBp
    expect(p1.assets.ldi.marginCallOutstanding).toBeCloseTo(loss, 9)
    expect(p0.assets.ldi.equity - p1.assets.ldi.equity).toBeCloseTo(loss, 9)
    // Collateral is untouched by the mark itself — it moves only when the call is met.
    expect(p1.assets.ldi.collateral).toEqual(p0.assets.ldi.collateral)
    expect(s1.market.govt30yBp).toBe(s0.market.govt30yBp + dBp)
  })

  it('a fall in yields releases collateral and NAV by the same amount', () => {
    const s0 = fresh()
    const s1 = apply(s0, [pensionFx.yieldShock({ deltaBp: -50 })])
    const release = pv01(s0.institution) * 50
    expect(s1.institution.assets.ldi.collateral.cash).toBeCloseTo(
      s0.institution.assets.ldi.collateral.cash + release,
      9,
    )
    expect(s1.institution.assets.ldi.equity).toBeCloseTo(
      s0.institution.assets.ldi.equity + release,
      9,
    )
  })
})

describe('pensionFx.meetMarginCall', () => {
  it('posting the pool’s own cash settles the call and leaves NAV unchanged', () => {
    const called = apply(fresh(), [pensionFx.yieldShock({ deltaBp: 20 })])
    const ldi0 = called.institution.assets.ldi
    expect(ldi0.marginCallOutstanding).toBeLessThan(ldi0.collateral.cash)
    const paid = apply(called, [pensionFx.meetMarginCall({ source: 'cash' })])
    const ldi1 = paid.institution.assets.ldi
    expect(ldi1.marginCallOutstanding).toBe(0)
    expect(ldi1.collateral.cash).toBeCloseTo(ldi0.collateral.cash - ldi0.marginCallOutstanding, 9)
    expect(ldi1.equity).toBeCloseTo(ldi0.equity, 9)
    expect(paid.institution.assets.cash).toBe(called.institution.assets.cash)
  })

  it('cash that enters from the scheme is new NAV; the pool part is not', () => {
    const base = fresh()
    const s0 = produce(base, (d) => {
      d.institution.assets.ldi.collateral.cash = 40
      d.institution.assets.ldi.marginCallOutstanding = 100
    })
    const s1 = apply(s0, [pensionFx.meetMarginCall({ source: 'cash' })])
    const ldi1 = s1.institution.assets.ldi
    expect(ldi1.marginCallOutstanding).toBe(0)
    expect(ldi1.collateral.cash).toBe(0)
    expect(s1.institution.assets.cash).toBe(s0.institution.assets.cash - 60)
    expect(ldi1.equity).toBeCloseTo(s0.institution.assets.ldi.equity + 60, 9)
  })

  it('a gilt sale at a discount books the fire-sale loss and credits the net proceeds', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.assets.ldi.marginCallOutstanding = 90
    })
    const s1 = apply(s0, [pensionFx.meetMarginCall({ source: 'gilts', discount: 0.1 })])
    const gross = 90 / 0.9
    expect(
      s0.institution.assets.gilts.marketValue - s1.institution.assets.gilts.marketValue,
    ).toBeCloseTo(gross, 9)
    expect(s1.counters.giltsSold).toBeCloseTo(gross, 9)
    expect(s1.counters.fireSaleLoss).toBeCloseTo(gross * 0.1, 9)
    expect(s1.institution.assets.ldi.marginCallOutstanding).toBeCloseTo(0, 9)
    expect(s1.institution.assets.ldi.equity).toBeCloseTo(s0.institution.assets.ldi.equity + 90, 9)
  })

  it('the sponsor pays up to its capacity', () => {
    const s0 = produce(fresh(), (d) => {
      d.institution.assets.ldi.marginCallOutstanding = 500
      d.institution.sponsor.contributionCapacity = 120
    })
    const s1 = apply(s0, [pensionFx.meetMarginCall({ source: 'sponsor' })])
    expect(s1.institution.sponsor.contributionCapacity).toBe(0)
    expect(s1.institution.assets.ldi.marginCallOutstanding).toBe(380)
    expect(s1.counters.sponsorCash).toBe(120)
    expect(s1.institution.assets.ldi.equity).toBeCloseTo(s0.institution.assets.ldi.equity + 120, 9)
  })
})

describe('pensionFx.reduceHedge / recapitalisePool / sponsorContribution', () => {
  it('reduceHedge cuts exposure and hands the released gilts back to the scheme', () => {
    const s0 = fresh()
    const s1 = apply(s0, [pensionFx.reduceHedge({ fraction: 0.25 })])
    const l0 = s0.institution.assets.ldi
    const l1 = s1.institution.assets.ldi
    expect(l1.exposure).toBeCloseTo(l0.exposure * 0.75, 9)
    const released = l0.collateral.eligibleGilts * 0.25
    expect(l1.collateral.eligibleGilts).toBeCloseTo(l0.collateral.eligibleGilts - released, 9)
    expect(s1.institution.assets.gilts.marketValue).toBeCloseTo(
      s0.institution.assets.gilts.marketValue + released,
      9,
    )
    expect(s1.institution.hedgeRatio).toBeCloseTo(s0.institution.hedgeRatio * 0.75, 9)
    expect(l1.equity).toBe(l0.equity)
  })

  it('recapitalisePool moves scheme money into the pool: NAV and collateral rise together', () => {
    const s0 = fresh()
    const s1 = apply(s0, [pensionFx.recapitalisePool({ amount: 100, source: 'cash' })])
    expect(s1.institution.assets.cash).toBe(s0.institution.assets.cash - 100)
    expect(s1.institution.assets.ldi.collateral.cash).toBe(
      s0.institution.assets.ldi.collateral.cash + 100,
    )
    expect(s1.institution.assets.ldi.equity).toBe(s0.institution.assets.ldi.equity + 100)
    const s2 = apply(s0, [pensionFx.recapitalisePool({ amount: 100, source: 'gilts' })])
    expect(s2.institution.assets.gilts.marketValue).toBe(
      s0.institution.assets.gilts.marketValue - 100,
    )
    expect(s2.institution.assets.ldi.collateral.eligibleGilts).toBe(
      s0.institution.assets.ldi.collateral.eligibleGilts + 100,
    )
  })

  it('sponsorContribution is capped by capacity and lands where asked', () => {
    const s0 = fresh()
    const toScheme = apply(s0, [pensionFx.sponsorContribution({ amount: 1000 })])
    const cap = s0.institution.sponsor.contributionCapacity
    expect(toScheme.institution.assets.cash).toBe(s0.institution.assets.cash + cap)
    expect(toScheme.institution.sponsor.contributionCapacity).toBe(0)
    const toPool = apply(s0, [pensionFx.sponsorContribution({ amount: 50, toPool: true })])
    expect(toPool.institution.assets.ldi.collateral.cash).toBe(
      s0.institution.assets.ldi.collateral.cash + 50,
    )
    expect(toPool.institution.assets.ldi.equity).toBe(s0.institution.assets.ldi.equity + 50)
  })
})

describe('pensionFx.forcedDeleverage', () => {
  it('does nothing while the call is covered and leverage is within the limit', () => {
    const s0 = fresh()
    const s1 = apply(s0, [pensionFx.forcedDeleverage({ maxLeverage: 4, discount: 0.05 })])
    expect(s1.institution).toEqual(s0.institution)
    expect(s1.flags.forced_deleverage).toBeUndefined()
  })

  it('cuts exposure back to the leverage limit, selling gilts at the discount', () => {
    // A 300bp shock on this pool: loss 2,268 > NAV 1,400 → equity negative → cut everything.
    const shocked = apply(fresh(), [pensionFx.yieldShock({ deltaBp: 300 })])
    const l0 = shocked.institution.assets.ldi
    const s1 = apply(shocked, [pensionFx.forcedDeleverage({ maxLeverage: 4, discount: 0.1 })])
    const l1 = s1.institution.assets.ldi
    expect(s1.flags.forced_deleverage).toBe(true)
    const cut = s1.counters.forcedDeleverage!
    expect(cut).toBeGreaterThan(0)
    expect(cut).toBeLessThanOrEqual(1)
    const sold = l0.collateral.eligibleGilts * cut
    expect(l1.collateral.eligibleGilts).toBeCloseTo(l0.collateral.eligibleGilts - sold, 9)
    expect(s1.counters.fireSaleLoss).toBeCloseTo(sold * 0.1, 9)
    expect(l1.marginCallOutstanding).toBeCloseTo(
      Math.max(0, l0.marginCallOutstanding - sold * 0.9),
      9,
    )
    expect(l1.exposure).toBeCloseTo(l0.exposure * (1 - cut), 9)
  })
})
