import { describe, expect, it } from 'vitest'
import { loadAllAvailable } from '@/scenarios'
import { computeLcr } from '@/metrics/lcr'
import { computeCapital } from '@/metrics/capital'
import { lcrInputFromBank, projectRunoff, runStateFromCi } from '@/metrics/runoff'
import { computePbExposure } from '@/metrics/pbExposure'
import { KPI_EXPLAIN } from '@/content/kpiExplain'
import svb from '@/scenarios/svb-2023/scenario'
import ldi from '@/scenarios/uk-ldi-2022/scenario'

const scenarios = await loadAllAvailable()
const zoneByScenario: Record<string, string> = {
  'svb-2023': 'America/Los_Angeles',
  'lehman-2008': 'America/New_York',
  'archegos-2021': 'America/New_York',
  'ltcm-1998': 'America/New_York',
  'covid-2020-fund': 'America/New_York',
  'credit-suisse-2023': 'Europe/Zurich',
  'uk-ldi-2022': 'Europe/London',
}

describe('financial content regression checks', () => {
  it('LCR40.64 distinguishes non-financial, bank and non-bank liquidity commitments', () => {
    const input = { hqla: { l1: 100, l2a: 0, l2b: 0 }, inflows: {} }
    expect(computeLcr({ ...input, outflows: { committedLiquidity: 100 } }).totalOutflows).toBe(30)
    expect(
      computeLcr({ ...input, outflows: { committedFacilitiesToBanks: 100 } }).totalOutflows,
    ).toBe(40)
    expect(
      computeLcr({ ...input, outflows: { committedLiquidityToNonBankFIs: 100 } }).totalOutflows,
    ).toBe(100)
    const bank = structuredClone(svb.initialState.institution)
    bank.committed.liquidityToFIs = 100
    const mapped = lcrInputFromBank(bank)
    expect(mapped.outflows.committedLiquidityToNonBankFIs).toBe(100)
    expect(mapped.outflows.committedLiquidity).toBeUndefined()
  })

  it('pledged securities are excluded from the simplified HQLA mapping', () => {
    const bank = structuredClone(svb.initialState.institution)
    bank.cash = 10
    bank.securities.afs = {
      ...bank.securities.afs,
      marketValue: 100,
      hqlaLevel: 'L1',
      pledgedShare: 0.6,
    }
    bank.securities.htm = { ...bank.securities.htm, marketValue: 0 }
    expect(lcrInputFromBank(bank).hqla.l1).toBeCloseTo(50)
  })

  it('an AFS loss already in CET1 is not deducted again in economic capital', () => {
    const base = {
      cet1: 100,
      at1: 0,
      tier2: 0,
      rwa: 500,
      leverageExposure: 1000,
      unrealizedAfsLoss: 20,
      unrealizedHtmLoss: 30,
    }
    expect(computeCapital({ ...base, aociInCet1: true }).economicTceRatio).toBeCloseTo(7)
    expect(computeCapital({ ...base, aociInCet1: false }).economicTceRatio).toBeCloseTo(5)
    expect(KPI_EXPLAIN.economicTce?.formula).toContain('CET1에 미반영된 AFS')
    expect(KPI_EXPLAIN.economicTce?.formula).toContain('세효과 미반영')
  })

  it('mitigation multiplies outflow and disclosed run-state boundaries match the engine', () => {
    const seg = {
      ...svb.initialState.institution.deposits[0]!,
      balance: 100,
      runoffByState: [0.01, 0.1, 0.2, 0.4] as [number, number, number, number],
      dailyCap: 1,
      networked: false,
    }
    expect(projectRunoff({ segments: [seg], runState: 2, amplifier: 2, dampener: 0.5 }).total).toBe(
      20,
    )
    const disclosed = [...KPI_EXPLAIN.runState!.formula!.matchAll(/≥ (\d+)/g)].map((m) =>
      Number(m[1]),
    )
    expect(disclosed).toEqual([70, 50, 30])
    for (const [i, boundary] of disclosed.entries()) {
      expect(runStateFromCi(boundary)).toBe(i)
      expect(runStateFromCi(boundary - 0.01)).toBe(i + 1)
    }
  })

  it('gross exposure includes shorts; the least liquid position can be smaller', () => {
    const result = computePbExposure({
      marginPosted: 100,
      positions: [
        { ticker: 'LARGE', notional: 1000, advNotional: 1000, dailyVolPct: 0.01 },
        { ticker: 'SMALL_SHORT', notional: -100, advNotional: 10, dailyVolPct: 0.01 },
      ],
    })
    expect(result.grossNotional).toBe(1100)
    expect(result.daysToLiquidate).toBe(50)
    expect(KPI_EXPLAIN.concentrationDays?.formula).toContain('max[')
  })

  it('LDI sale instructions disclose the same number of model windows as their settlement effects', () => {
    const drift: string[] = []
    for (const turn of ldi.turns)
      for (const decision of turn.decisions)
        for (const option of decision.options) {
          for (const effect of option.effects ?? []) {
            if (effect.kind !== 'fn' || effect.name !== 'instructSale') continue
            const settlement = option.delayedEffects?.find((d) =>
              d.effects.some((e) => e.kind === 'fn' && e.name === 'settleSale'),
            )
            if (settlement?.afterTurns !== effect.params?.settleTurns) drift.push(option.id)
          }
        }
    expect(drift).toEqual([])
  })

  it.each(scenarios.map((s) => [s.meta.id, s] as const))(
    '%s uses the correct historical UTC offset',
    (id, scenario) => {
      const mismatches: string[] = []
      for (const turn of scenario.turns) {
        if (!turn.time) continue
        // The SVB resolution weekend is explicitly authored in ET instead of the bank's PT.
        const zone =
          id === 'svb-2023' && turn.timeLabel.includes('ET')
            ? 'America/New_York'
            : (zoneByScenario[id] ?? 'Asia/Seoul')
        const date = new Date(turn.time)
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(date)
        const authored = turn.time.slice(11, 16)
        if (parts !== authored) mismatches.push(`${turn.id}: ${turn.time} / ${zone} ${parts}`)
      }
      expect(mismatches).toEqual([])
    },
  )
})
