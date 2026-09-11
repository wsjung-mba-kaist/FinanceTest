import { useMemo } from 'react'
import { getCard } from '../../content'
import type { AdvisorHint, GameState, ScenarioDefinition, TurnView } from '../../engine'
import { HINT_COSTS, useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { InlineCard } from '../play/InlineCard'
import { Badge, Button, EmptyState } from '../ui'
import { Markdown } from '../knowledge/Markdown'
import { RoleFramePanel } from './RoleFramePanel'

const LEVELS = [1, 2, 3] as const
const LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: '무엇을 볼지', 2: '프레임워크', 3: '권고' }

interface HintGroup {
  key: string
  title: string
  resolved: boolean
  requiredConcepts: string[]
  hints: AdvisorHint[]
}

/**
 * `이 결정에서` 탭 — 조언자 힌트(1·2·3단계 순차 공개) + 필수 개념 카드 + 역할 프레임.
 * `AdvisorDrawer`의 조언자 탭 로직을 그대로 옮겨 왔다(비용·순차 공개·확정 표시).
 */
export function DecisionHelp({
  scenario,
  state,
  view,
  anchor,
}: {
  scenario: ScenarioDefinition
  state: GameState
  view: TurnView
  /** 특정 결정으로 스크롤/우선 표시. */
  anchor?: string
}) {
  const mode = useGameStore((s) => s.run?.mode) ?? 'standard'
  const hintsRevealed = useGameStore((s) => s.run?.hintsRevealed)
  const revealHint = useGameStore((s) => s.revealHint)
  const markCardViewed = useProgressStore((s) => s.markCardViewed)

  const groups = useMemo<HintGroup[]>(() => {
    const map = new Map<string, HintGroup>()
    const ensure = (key: string, title: string, resolved: boolean, requiredConcepts: string[]) => {
      let g = map.get(key)
      if (!g) {
        g = { key, title, resolved, requiredConcepts, hints: [] }
        map.set(key, g)
      }
      return g
    }
    for (const dv of view.decisions) {
      ensure(
        dv.decision.id,
        dv.decision.title,
        Boolean(dv.resolved),
        dv.decision.requiredConcepts ?? [],
      )
    }
    for (const h of view.hints) {
      const key = h.decisionId ?? `turn:${state.turnIndex}`
      const dv = h.decisionId
        ? view.decisions.find((d) => d.decision.id === h.decisionId)
        : undefined
      const g = ensure(
        key,
        dv?.decision.title ?? (h.decisionId ? h.decisionId : '이번 턴 공통'),
        Boolean(dv?.resolved),
        dv?.decision.requiredConcepts ?? [],
      )
      g.hints.push(h)
    }
    const list = [...map.values()]
    if (!anchor) return list
    return [...list].sort((a, b) => Number(b.key === anchor) - Number(a.key === anchor))
  }, [view, state.turnIndex, anchor])

  const hasAnything = groups.some((g) => g.hints.length > 0 || g.requiredConcepts.length > 0)

  return (
    <div className="space-y-4">
      <CostHeader mode={mode} hintCount={view.hints.length} />

      {mode !== 'expert' &&
        groups.map((g) => (
          <section
            key={g.key}
            className="space-y-2"
            aria-label={g.title}
            id={`help-decision-${g.key}`}
          >
            <h3 className="flex items-center gap-1.5 text-base font-semibold">
              {g.title}
              {g.resolved && <Badge tone="neutral">확정됨</Badge>}
            </h3>

            {g.requiredConcepts.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted">이 결정 전에 알아야 할 개념</p>
                {g.requiredConcepts.map((id) =>
                  getCard(id) ? <InlineCard key={id} cardId={id} onOpen={markCardViewed} /> : null,
                )}
              </div>
            )}

            <HintLevels
              group={g}
              revealed={hintsRevealed?.[g.key] ?? 0}
              mode={mode}
              onReveal={(level) => revealHint(g.key, level)}
              onCardOpen={markCardViewed}
            />
          </section>
        ))}

      {mode !== 'expert' && !hasAnything && (
        <EmptyState title="이번 턴에는 조언자 힌트가 없습니다">
          아래 역할 프레임과 `지표 설명` 탭이 판단의 출발점입니다.
        </EmptyState>
      )}

      <RoleFramePanel scenario={scenario} state={state} />
    </div>
  )
}

function CostHeader({ mode, hintCount }: { mode: string; hintCount: number }) {
  if (mode === 'expert') {
    return (
      <div className="rounded-md border border-border bg-surface-2 p-2 text-sm">
        <span className="font-medium">전문가 모드 — 조언자 비공개</span>
        <p className="mt-0.5 text-muted">
          이번 턴의 힌트 <span className="num">{hintCount}</span>개는 디브리핑에서 전문가 관점으로
          확인하실 수 있습니다.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2 text-sm">
      <span className="font-medium">
        {mode === 'guided' ? '안내 모드 — 힌트 무료' : '표준 모드 — 단계별 점수 차감'}
      </span>
      <p className="mt-0.5 text-muted">
        {mode === 'guided'
          ? '점수 차감 없이 1·2·3단계를 모두 볼 수 있습니다.'
          : `1단계 −${HINT_COSTS[1]} · 2단계 −${HINT_COSTS[2]} · 3단계 −${HINT_COSTS[3]}점이 누적 차감됩니다.`}
      </p>
    </div>
  )
}

function HintLevels({
  group,
  revealed,
  mode,
  onReveal,
  onCardOpen,
}: {
  group: HintGroup
  revealed: number
  mode: string
  onReveal: (level: 1 | 2 | 3) => void
  onCardOpen: (id: string) => void
}) {
  const levels = LEVELS.filter((l) => group.hints.some((h) => h.level === l))
  if (levels.length === 0) return null
  const nextLevel = levels.find((l) => l > revealed)
  return (
    <>
      {levels.map((l) => {
        const shown = l <= revealed
        const items = group.hints.filter((h) => h.level === l)
        return (
          <div key={l} className="rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <Badge tone={shown ? 'info' : 'neutral'}>{l}단계</Badge>
              <span className="text-muted">{LEVEL_LABEL[l]}</span>
              {!shown && l === nextLevel && (
                <Button size="sm" className="ml-auto" onClick={() => onReveal(l)}>
                  힌트 보기{mode === 'standard' ? ` (−${HINT_COSTS[l]}점)` : ''}
                </Button>
              )}
              {!shown && l !== nextLevel && (
                <span className="ml-auto text-xs text-muted">이전 단계를 먼저 확인해 주세요</span>
              )}
            </div>
            {shown &&
              items.map((h, i) => (
                <div key={i} className="mt-1.5 space-y-1">
                  <Markdown className="text-base leading-relaxed" autoGlossary>
                    {h.text}
                  </Markdown>
                  {h.cardRefs?.map((id) => (
                    <InlineCard key={id} cardId={id} prefix="관련 카드:" onOpen={onCardOpen} />
                  ))}
                </div>
              ))}
          </div>
        )
      })}
    </>
  )
}
