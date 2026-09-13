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
      {/*
        「그게 실제로 가능했나」는 사후 검토에서 먼저 나오는 질문이다. 저자는 그 답을 출처까지 달아
        `feasibility.basis`에 써 두었고, 플레이 화면의 선택지 상세가 그걸 한 줄로 보여 준다 — 선택 직전,
        가장 바쁘 순간에. 정작 천천히 읽을 수 있는 곳인 디브리핑에는 없었고, 출처는 어느 쪽에도 없었다.
        보정 노트도 같다: 수치의 크기를 무엇으로 정당화했는지는 정확성이 제1 원칙인 제품에서
        독자가 볼 권리가 있는 것이고, 그 자리는 경로 비교다.
      */}
      {option.feasibility && (
        <p className="mt-1 text-muted">
          <span className="label-caps">실행 가능성 근거</span>{' '}
          <InlineMarkdown>{option.feasibility.basis}</InlineMarkdown>
          {option.feasibility.sourceRefs && option.feasibility.sourceRefs.length > 0 && (
            <Citation ids={option.feasibility.sourceRefs} local={scenario.meta.sources} />
          )}
        </p>
      )}
      {option.calibrationNote && (
        <p className="mt-1 text-muted">
          <span className="label-caps">보정 노트</span> {option.calibrationNote}
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
              {/* Chrome, not severity — a hint count is a fact about the run, not an alarm. */}
              {rec.hintsUsed ? <span className="label-caps">힌트 {rec.hintsUsed}단계</span> : null}
              {/*
                결정까지 걸린 시간은 엔진이 줄곳 기록해 왔지만 어디에도 표시된 적이 없다. 시간 압박을
                훈련하는 제품에서 의사결정 지연은 점수만큼 실질적인 지표고, 사후 검토의 재료다.
              */}
              {rec.elapsedMs !== undefined && rec.elapsedMs > 0 && (
                <span className="num label-caps">{Math.round(rec.elapsedMs / 1000)}초</span>
              )}
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
                {rec.reasoning && (
                  <dl className="mt-2 space-y-1 text-sm">
                    {(
                      [
                        ['evidence', '당시 확인한 근거'],
                        ['assumption', '당시의 가정'],
                        ['reconsiderWhen', '판단을 바꿀 조건'],
                      ] as const
                    ).map(([key, label]) =>
                      rec.reasoning?.[key] ? (
                        <div key={key}>
                          <dt className="text-muted">{label}</dt>
                          <dd className="m-0 whitespace-pre-wrap">{rec.reasoning[key]}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
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
