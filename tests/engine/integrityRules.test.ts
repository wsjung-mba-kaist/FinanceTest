import { describe, expect, it } from 'vitest'
import type { BankState, ScenarioDefinition } from '@/engine'
import { validateScenario, type IntegrityIssue } from '@/engine/validate/scenarioIntegrity'
import { miniBank } from '../fixtures/miniBank'
import { miniTicks, TICKED_TURN_INDEX } from '../fixtures/miniTicks'
import { asGeneric } from '../helpers/scenario'

/**
 * Every rule gets the scenario that breaks it. The suite used to assert only "zero errors" on the
 * real scenarios, so a rule could silently stop firing (or never have fired: `metricKeys` was
 * never passed, so `kpi-metric` had never run) and nothing would notice. A linter is code too.
 */
function issues(def: ScenarioDefinition<BankState>, rule: string): IntegrityIssue[] {
  return validateScenario(asGeneric(def)).filter((i) => i.rule === rule)
}

function withDecision(
  def: ScenarioDefinition<BankState>,
  turnIndex: number,
  id: string,
  patch: Partial<ScenarioDefinition<BankState>['turns'][number]['decisions'][number]>,
): ScenarioDefinition<BankState> {
  return {
    ...def,
    turns: def.turns.map((t, i) =>
      i !== turnIndex
        ? t
        : { ...t, decisions: t.decisions.map((d) => (d.id !== id ? d : { ...d, ...patch })) },
    ),
  }
}

describe('the fixtures are clean', () => {
  it('mini-bank and mini-ticks raise no errors', () => {
    for (const def of [miniBank, miniTicks])
      expect(validateScenario(asGeneric(def)).filter((i) => i.level === 'error')).toEqual([])
  })
})

describe('deadline-select', () => {
  it('rejects a deadline decision that needs more than one option', () => {
    const broken = withDecision(miniTicks, TICKED_TURN_INDEX, 'd1_desk', {
      select: { min: 2, max: 2 },
    })
    expect(issues(broken, 'deadline-select')).toHaveLength(1)
    expect(issues(miniTicks, 'deadline-select')).toEqual([])
  })

  it('rejects an interrupt that needs more than one option', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniTicks,
      turns: miniTicks.turns.map((t, i) =>
        i !== TICKED_TURN_INDEX
          ? t
          : {
              ...t,
              interrupts: (t.interrupts ?? []).map((it) => ({ ...it, select: { min: 2, max: 2 } })),
            },
      ),
    }
    expect(issues(broken, 'deadline-select')).toHaveLength(1)
  })
})

describe('scoring rules', () => {
  it('rejects an empty component list (it would score a flat 50, not fall back)', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniBank,
      scoring: {
        ...miniBank.scoring,
        rules: { ...miniBank.scoring.rules, policy: { components: [] } },
      },
    }
    expect(issues(broken, 'components-empty')).toHaveLength(1)
    expect(issues(miniBank, 'components-empty')).toEqual([])
  })

  it('rejects a metric component naming a metric the engine never produces', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniBank,
      scoring: {
        ...miniBank.scoring,
        rules: {
          ...miniBank.scoring.rules,
          policy: {
            components: [
              {
                kind: 'metric',
                metric: 'noSuchMetric',
                aggregate: 'final',
                curve: [[0, 0]],
                weight: 1,
              },
            ],
          },
        },
      },
    }
    expect(issues(broken, 'scoring-metric')).toHaveLength(1)
  })

  it('rejects turnsBelow without a threshold', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniBank,
      scoring: {
        ...miniBank.scoring,
        rules: {
          ...miniBank.scoring.rules,
          policy: {
            components: [
              {
                kind: 'metric',
                metric: 'lcr',
                aggregate: 'turnsBelow',
                curve: [[0, 0]],
                weight: 1,
              },
            ],
          },
        },
      },
    }
    expect(issues(broken, 'scoring-threshold')).toHaveLength(1)
  })
})

describe('initial-finite', () => {
  it('rejects a non-finite authored figure instead of letting the clone turn it into null', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniBank,
      initialState: {
        ...miniBank.initialState,
        institution: { ...miniBank.initialState.institution, cash: Infinity },
      },
    }
    const found = issues(broken, 'initial-finite')
    expect(found).toHaveLength(1)
    expect(found[0]!.where).toBe('initialState.institution.cash')
  })
})

describe('checkpoints', () => {
  const cp = miniBank.checkpoints![0]!
  it('rejects an unknown metric, an unresolvable path and a checkpoint with no target', () => {
    const metric = { ...miniBank, checkpoints: [{ ...cp, metric: 'noSuchMetric' }] }
    expect(issues(metric, 'checkpoint-metric')).toHaveLength(1)
    const path = {
      ...miniBank,
      checkpoints: [{ ...cp, metric: undefined, path: 'institution.nope' }],
    }
    expect(issues(path, 'checkpoint-path')).toHaveLength(1)
    const none = { ...miniBank, checkpoints: [{ ...cp, metric: undefined }] }
    expect(issues(none, 'checkpoint-target')).toHaveLength(1)
    expect(issues(miniBank, 'checkpoint-metric')).toEqual([])
  })
})

describe('kpis and thresholds', () => {
  it('kpi-metric fires without the caller passing metric keys', () => {
    const broken: ScenarioDefinition<BankState> = {
      ...miniBank,
      kpis: [...miniBank.kpis, { metric: 'noSuchMetric', label: '없음', unit: 'ccy' }],
    }
    expect(issues(broken, 'kpi-metric')).toHaveLength(1)
  })

  it('warns when a currency-unit KPI relies on the default threshold band', () => {
    const kpi = { metric: 'facilityHeadroom', label: '담보 여력', unit: 'ccy' as const }
    const defaulted: ScenarioDefinition<BankState> = { ...miniBank, kpis: [...miniBank.kpis, kpi] }
    const own: ScenarioDefinition<BankState> = {
      ...defaulted,
      thresholds: {
        ...(miniBank.thresholds ?? {}),
        facilityHeadroom: { warn: 5, breach: 0, direction: 'below' },
      },
    }
    const found = issues(defaulted, 'threshold-ccy-default')
    expect(found).toHaveLength(1)
    expect(found[0]!.level).toBe('warning')
    expect(issues(own, 'threshold-ccy-default')).toEqual([])
  })
})
