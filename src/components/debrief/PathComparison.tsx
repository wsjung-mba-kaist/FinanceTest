import { findDecision, findOption } from '../../engine'
import type {
  Decision,
  DecisionRecord,
  GameState,
  Option,
  ScenarioDefinition,
} from '../../engine/types'
import { decisionAnchorId } from '../../lib/catalog'
import { Button, Badge } from '../ui'
import { Citation } from '../knowledge/Citation'

function historicalIds(scenario: ScenarioDefinition, decision: Decision): string[] {
  const path = scenario.paths.historical.choices[decision.id]
  if (path !== undefined) return [path].flat()
  return decision.options.filter((o) => o.historical).map((o) => o.id)
}

function expertIds(scenario: ScenarioDefinition, decision: Decision): string[] {
  const path = scenario.paths.expert?.choices[decision.id]
  if (path !== undefined) return [path].flat()
  const best = [...decision.options].sort((a, b) => b.expert.rating - a.expert.rating)[0]
  return best ? [best.id] : []
}

function OptionCell({
  option,
  scenario,
  showHistoricalNote,
}: {
  option: Option | undefined
  scenario: ScenarioDefinition
  showHistoricalNote?: boolean
}) {
  if (!option) return <span className="text-muted">—</span>
  return (
    <div className="text-[12px]">
      <div className="flex items-start gap-2">
        <span className="font-medium">{option.label}</span>
        <Badge
          tone={
            option.expert.rating >= 70
              ? 'positive'
              : option.expert.rating >= 40
                ? 'warning'
                : 'critical'
          }
          className="shrink-0 num"
        >
          {option.expert.rating}점
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {option.trap && <Badge tone="warning">함정</Badge>}
        {option.irreversible && <Badge tone="neutral">되돌릴 수 없음</Badge>}
        {option.illegal && <Badge tone="critical">규정 위반 소지</Badge>}
      </div>
      <p className="mt-1 text-muted">
        {option.expert.rationale}
        {option.expert.sourceRefs && option.expert.sourceRefs.length > 0 && (
          <Citation ids={option.expert.sourceRefs} local={scenario.meta.sources} />
        )}
      </p>
      {showHistoricalNote && option.expert.historicalNote && (
        <p className="mt-1 text-muted italic">{option.expert.historicalNote}</p>
      )}
      {option.trap && option.trapExplanation && (
        <p className="mt-1 text-warning">{option.trapExplanation}</p>
      )}
    </div>
  )
}

export function PathComparison({
  scenario,
  state,
  onFork,
}: {
  scenario: ScenarioDefinition
  state: GameState
  onFork: (turnIndex: number) => void
}) {
  const records: DecisionRecord[] = state.decisions
  if (records.length === 0) return <p className="text-[12px] text-muted">기록된 결정이 없습니다.</p>
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {records.map((rec) => {
        const found = findDecision(scenario, rec.decisionId)
        if (!found) return null
        const { decision, turn } = found
        const chosen = rec.optionIds
          .map((id) => findOption(decision, id))
          .filter((o): o is Option => Boolean(o))
        const hist = historicalIds(scenario, decision)
          .map((id) => findOption(decision, id))
          .filter((o): o is Option => Boolean(o))
        const exp = expertIds(scenario, decision)
          .map((id) => findOption(decision, id))
          .filter((o): o is Option => Boolean(o))
        return (
          <li
            key={`${rec.turnIndex}-${rec.decisionId}`}
            id={decisionAnchorId(rec.decisionId)}
            className="rounded-lg border border-border bg-surface scroll-mt-4"
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Badge tone="neutral" className="num">
                {turn.label}
              </Badge>
              <span className="text-[12px] text-muted">{turn.timeLabel}</span>
              <span className="font-medium">{decision.title}</span>
              {rec.timedOut && <Badge tone="warning">시간 초과</Badge>}
              {rec.hintsUsed ? <Badge tone="neutral">힌트 {rec.hintsUsed}단계</Badge> : null}
              <span className="ml-auto">
                <Button size="sm" variant="secondary" onClick={() => onFork(rec.turnIndex)}>
                  T+{rec.turnIndex}부터 다시 하기
                </Button>
              </span>
            </div>
            <div className="grid gap-3 px-3 py-3 md:grid-cols-3">
              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  플레이어
                </h4>
                {chosen.length === 0 ? (
                  <span className="text-muted text-[12px]">—</span>
                ) : (
                  chosen.map((o) => <OptionCell key={o.id} option={o} scenario={scenario} />)
                )}
                {rec.memo && (
                  <p className="mt-2 rounded border border-border bg-surface-2 p-2 text-[12px]">
                    <span className="text-muted">메모: </span>
                    {rec.memo}
                  </p>
                )}
              </div>
              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  역사적 대응
                </h4>
                {hist.length === 0 ? (
                  <span className="text-muted text-[12px]">지정 없음</span>
                ) : (
                  hist.map((o) => (
                    <OptionCell key={o.id} option={o} scenario={scenario} showHistoricalNote />
                  ))
                )}
              </div>
              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-positive">
                  전문가 권고
                </h4>
                {exp.length === 0 ? (
                  <span className="text-muted text-[12px]">—</span>
                ) : (
                  exp.map((o) => <OptionCell key={o.id} option={o} scenario={scenario} />)
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
