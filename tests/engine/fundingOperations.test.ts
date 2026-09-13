import { describe, expect, it } from 'vitest'
import { createGame, applyDecision, latestSnapshot, replay } from '@/engine'
import { securitiesFx } from '@/engine/fx/securities'
import { fundingPosition, pendingFundingInstructions } from '@/lib/fundingOperations'
import { kpiExplanation } from '@/content/kpiExplain'
import { buildStripCells } from '@/components/play/stripCells'
import lego from '@/scenarios/legoland-2022/scenario'
import ldi from '@/scenarios/uk-ldi-2022/scenario'
import { asGeneric } from '../helpers/scenario'

describe('operational funding views', () => {
  it('does not spend undrawn commitments or FX assets to cover an ABCP purchase', () => {
    const state = structuredClone(createGame(lego, 3))
    state.institution.liquidity.cash = 10
    state.institution.liquidity.creditLines = 9000
    state.institution.liquidity.creditLinesDrawn = 50
    state.institution.liquidity.fxLiquid = 10000
    state.institution.pf.abcpMaturing = [100, 200, 300, 400, 500]
    state.institution.pf.rollRate = 0.4
    const before = JSON.stringify(state)
    expect(fundingPosition(state)).toMatchObject({
      cash: 10,
      undrawn: 8950,
      maturity: 100,
      estimatedPurchase: 60,
      purchaseCashGap: 50,
      maturities: [100, 200, 300, 400],
    })
    expect(JSON.stringify(state)).toBe(before)
  })

  it('shows the next unprocessed maturity after a real rollover and preserves replay', () => {
    const original = lego.turns[0]!.decisions[0]!
    const scenario = {
      ...lego,
      turns: lego.turns.map((t, i) =>
        i
          ? t
          : {
              ...t,
              decisions: [
                {
                  ...original,
                  options: [
                    {
                      ...original.options[0]!,
                      effects: [securitiesFx.rolloverStep({ honourCommitment: true })],
                      delayedEffects: [],
                    },
                  ],
                },
              ],
            },
      ),
    }
    const state = structuredClone(createGame(scenario, 3))
    const before = state.institution.pf.abcpMaturing[1]
    const after = applyDecision(state, scenario, original.id, [original.options[0]!.id])
    expect(fundingPosition(after)).toMatchObject({ maturity: before })
    expect(latestSnapshot(after).metrics.abcpMaturingNext!.label).toBe('미처리 첫 만기')
    expect(latestSnapshot(after).metrics.abcpMaturing30!.label).toBe('미처리 만기 4개 합계')
    const restored = replay(scenario, {
      seed: 3,
      variance: 0,
      turnIndex: 0,
      tick: 0,
      decisions: JSON.parse(JSON.stringify(after.decisions)),
    }).state
    expect(fundingPosition(restored)).toEqual(fundingPosition(after))
  })

  it('separates scheme cash, pledged gilts and pool collateral without counting pool NAV as cash', () => {
    const state = structuredClone(createGame(ldi, 3))
    state.institution.assets.gilts.pledgedShare = 0.5
    const position = fundingPosition(state)
    expect(position).toMatchObject({
      kind: 'pension',
      cash: 150,
      poolCash: 300,
      poolGilts: 607,
      schemeGilts: 300,
      unpaidMargin: 0,
    })
    expect(latestSnapshot(state).metrics.schemeCash!.value).toBe(150)
    const cells = buildStripCells(asGeneric(ldi), state)
    expect(cells.filter((c) => c.kind === 'metric').map((c) => c.id)).toEqual([
      'schemeCash',
      'marginCallPending',
      'collateralHeadroomBp',
      'hedgeRatio',
    ])
  })

  it('uses institution-specific formulas for the shared liquid-assets metric', () => {
    expect(kpiExplanation('liquidAssets', 'pension')!.formula).toContain('기담보 비중')
    expect(kpiExplanation('liquidAssets', 'pension')!.formula).not.toContain('미인출')
    expect(kpiExplanation('liquidAssets', 'securities')!.formula).toContain('미인출')
  })

  it('dates pending instructions without publishing outcome text or claiming a calendar settlement day', () => {
    const scenario = asGeneric(ldi)
    const state = structuredClone(createGame(scenario, 3))
    const decision = scenario.turns[0]!.decisions[0]!
    const option = decision.options[0]!
    state.pending = [
      {
        id: 'later',
        dueTurn: 99,
        description: '미래 정책과 수익을 노출하면 안 됨',
        ref: { decisionId: decision.id, optionId: option.id, index: 0 },
      },
      {
        id: 'earlier',
        dueTurn: 4,
        dueTick: 3,
        description: '미래 정책과 수익을 노출하면 안 됨',
        ref: { decisionId: decision.id, optionId: option.id, index: 0 },
      },
    ]
    const rows = pendingFundingInstructions(state, scenario)
    expect(rows.map((r) => r.id)).toEqual(['earlier', 'later'])
    expect(rows[0]!.due).toContain('2022년 9월 28일')
    expect(rows[0]!.due).toContain('10:45')
    expect(rows[1]!.due).toContain('처리 시각 미정')
    expect(rows[0]!.instruction).toBe(option.label)
    expect(JSON.stringify(rows)).not.toContain('미래 정책')
    expect(fundingPosition(state)).toMatchObject({ cash: 150 })
  })
})
