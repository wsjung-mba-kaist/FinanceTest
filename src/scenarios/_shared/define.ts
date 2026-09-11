import type { InstitutionState, ScenarioDefinition, ScenarioSummary } from '../../engine/types'

/** Identity helper that pins the institution-state generic for authoring autocomplete. */
export function defineScenario<S extends InstitutionState>(
  def: ScenarioDefinition<S>,
): ScenarioDefinition<S> {
  return def
}

export function summaryOf(
  def: ScenarioDefinition,
  status: ScenarioSummary['status'] = 'available',
): ScenarioSummary {
  const m = def.meta
  return {
    id: m.id,
    version: m.version,
    title: m.title,
    subtitle: m.subtitle,
    era: m.era,
    year: m.year,
    region: m.region,
    role: m.role,
    roleTitle: m.roleTitle,
    institutionType: m.institutionType,
    institutionName: m.institutionName,
    difficulty: m.difficulty,
    durationTurns: m.durationTurns,
    turnUnit: m.turnUnit,
    estMinutes: m.estMinutes,
    competencies: m.competencies,
    tags: m.tags,
    status,
  }
}
