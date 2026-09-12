import { useState } from 'react'
import { findDecision, findOption } from '../../engine'
import type {
  Decision,
  DecisionRecord,
  GameState,
  Option,
  ScenarioDefinition,
} from '../../engine/types'
import { decisionAnchorId } from '../../lib/catalog'
import { Badge, Button, Card } from '../ui'
import { Icon } from '../ui/Icon'
import { Citation } from '../knowledge/Citation'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

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
    <div className="text-sm">
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
        <InlineMarkdown>{option.expert.rationale}</InlineMarkdown>
        {option.expert.sourceRefs && option.expert.sourceRefs.length > 0 && (
          <Citation ids={option.expert.sourceRefs} local={scenario.meta.sources} />
        )}
      </p>
      {showHistoricalNote && option.expert.historicalNote && (
        <p className="mt-1 text-muted italic">{option.expert.historicalNote}</p>
      )}
      {option.trap && option.trapExplanation && (
        <p className="mt-1 text-warning">
          <InlineMarkdown>{option.trapExplanation}</InlineMarkdown>
        </p>
      )}
    </div>
  )
}

export function PathComparison({
  scenario,
  state,
  onFork,
  expandedDecisionIds,
  forceExpanded,
}: {
  scenario: ScenarioDefinition
  state: GameState
  onFork: (turnIndex: number) => void
  /** Decisions that stay open (the top-3 mistakes); everything else collapses to its header. */
  expandedDecisionIds?: readonly string[]
  /** Printing: open every entry. */
  forceExpanded?: boolean
}) {
  const records: DecisionRecord[] = state.decisions
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  if (records.length === 0) return <p className="text-sm text-muted">기록된 결정이 없습니다.</p>
  const alwaysOpen = new Set(expandedDecisionIds ?? [])
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
        const key = `${rec.turnIndex}-${rec.decisionId}`
        const panelId = `path-${key}-panel`
        const open = Boolean(forceExpanded) || alwaysOpen.has(rec.decisionId) || opened.has(key)
        return (
          <Card
            as="li"
            key={key}
            id={decisionAnchorId(rec.decisionId)}
            className="scroll-mt-4"
            tabIndex={-1}
          >
            <div
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${open ? 'border-b border-border' : ''}`}
            >
              <Badge tone="neutral" className="num">
                {turn.label}
              </Badge>
              <span className="text-sm text-muted">{turn.timeLabel}</span>
              <span className="font-medium">{decision.title}</span>
              {rec.timedOut && <Badge tone="warning">시간 초과</Badge>}
              {rec.hintsUsed ? <Badge tone="neutral">힌트 {rec.hintsUsed}단계</Badge> : null}
              <span className="ml-auto flex items-center gap-1">
                {/*
                  A symmetric toggle. The control used to only ever `add` to the set, so once a
                  comparison was opened there was no way to close it again — on a long debrief that
                  meant the page only ever grew.
                */}
                {!alwaysOpen.has(key) && (
                  <Button
                    variant="link"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() =>
                      setOpened((s2) => {
                        const next = new Set(s2)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }
                  >
                    경로 비교 {open ? '접기' : '보기'}
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => onFork(rec.turnIndex)}>
                  T+{rec.turnIndex}부터 다시 하기
                </Button>
              </span>
            </div>
            <div id={panelId} hidden={!open} className="grid gap-3 px-3 py-3 md:grid-cols-3">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  플레이어
                </h4>
                {chosen.length === 0 ? (
                  <span className="text-muted text-sm">—</span>
                ) : (
                  chosen.map((o) => <OptionCell key={o.id} option={o} scenario={scenario} />)
                )}
                {rec.memo && (
                  <p className="mt-2 rounded-sm border border-border bg-surface-2 p-2 text-sm">
                    <span className="text-muted">메모: </span>
                    {rec.memo}
                  </p>
                )}
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  역사적 대응
                </h4>
                {hist.length === 0 ? (
                  <span className="text-muted text-sm">지정 없음</span>
                ) : (
                  hist.map((o) => (
                    <OptionCell key={o.id} option={o} scenario={scenario} showHistoricalNote />
                  ))
                )}
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-positive">
                  전문가 권고
                </h4>
                {exp.length === 0 ? (
                  <span className="text-muted text-sm">—</span>
                ) : (
                  exp.map((o) => <OptionCell key={o.id} option={o} scenario={scenario} />)
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </ol>
  )
}
