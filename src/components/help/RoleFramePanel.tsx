import { Link } from 'react-router-dom'
import { latestSnapshot, type GameState, type ScenarioDefinition } from '../../engine'
import { getCard, getFramework } from '../../content'
import { ROLE_FRAMES, roleFamilyOf, type RoleFrameItem } from '../../content/roleFrames'
import { formatMetric } from '../../lib/format'
import { Badge } from '../ui'

/**
 * 역할별 핵심 판단 프레임.
 *
 * 브리핑 요약 · 플레이 도움 시트 · 디브리핑에서 **같은 순서**로 노출해 습관을 만든다.
 * 시나리오 KPI와 겹치는 항목만 보여 주고(관련 없는 프레임은 소음이다),
 * `state`가 있으면 각 프레임이 읽는 지표의 현재 값을 함께 붙인다.
 */
export function RoleFramePanel({
  scenario,
  state,
  showLinks = true,
  layout = 'stack',
}: {
  scenario: ScenarioDefinition
  state?: GameState
  showLinks?: boolean
  /** 'grid' lays the items out across the page width; 'stack' is the narrow help-sheet shape. */
  layout?: 'stack' | 'grid'
}) {
  const family = roleFamilyOf(scenario.meta.role)
  const frame = ROLE_FRAMES[family]
  const kpiMetrics = new Set(scenario.kpis.map((k) => k.metric))
  const relevant = frame.items.filter((i) => i.metrics.some((m) => kpiMetrics.has(m)))
  const items = relevant.length > 0 ? relevant : frame.items
  const snap = state ? latestSnapshot(state) : undefined

  return (
    <section aria-label="역할별 핵심 판단 프레임" className="space-y-2">
      <header>
        <h3 className="text-base font-semibold">{frame.title}</h3>
        <p className="text-sm text-muted">
          같은 질문을 같은 순서로. 상황이 바뀌어도 이 네 가지는 매 턴 확인합니다.
        </p>
      </header>
      <ol className={layout === 'grid' ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' : 'space-y-2'}>
        {items.map((item, i) => (
          <li key={item.id} className="rounded-md border border-border bg-surface p-2">
            <div className="flex items-center gap-1.5">
              <span className="num text-sm text-muted">{i + 1}</span>
              <span className="text-base font-medium">{item.label}</span>
            </div>
            <p className="mt-0.5 text-base leading-relaxed">{item.question}</p>
            <MetricChips item={item} scenario={scenario} snap={snap} kpiMetrics={kpiMetrics} />
            {showLinks && <FrameLinks item={item} />}
          </li>
        ))}
      </ol>
    </section>
  )
}

function MetricChips({
  item,
  scenario,
  snap,
  kpiMetrics,
}: {
  item: RoleFrameItem
  scenario: ScenarioDefinition
  snap?: ReturnType<typeof latestSnapshot>
  kpiMetrics: Set<string>
}) {
  const shown = item.metrics.filter((m) => kpiMetrics.has(m))
  const list = shown.length > 0 ? shown : item.metrics
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {list.map((m) => {
        const spec = scenario.kpis.find((k) => k.metric === m)
        const value = snap?.metrics[m]
        return (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs"
          >
            <span className="text-muted">{spec?.label ?? value?.label ?? m}</span>
            {value && (
              <span className="num font-medium">
                {formatMetric(value.value, value.unit, scenario.units, spec?.decimals)}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

function FrameLinks({ item }: { item: RoleFrameItem }) {
  const card = item.cardRef ? getCard(item.cardRef) : undefined
  const framework = item.frameworkRef ? getFramework(item.frameworkRef) : undefined
  if (!card && !framework) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
      {card && (
        <Link to={`/knowledge#card-${card.id}`} className="text-accent">
          카드 · {card.title}
        </Link>
      )}
      {framework && (
        <Link to={`/knowledge/frameworks/${framework.id}`} className="text-accent">
          프레임워크 · {framework.title}
        </Link>
      )}
    </div>
  )
}

/** 브리핑의 "시작 전 확인" 줄에 쓰는 역할군 배지. */
export function RoleFamilyBadge({ scenario }: { scenario: ScenarioDefinition }) {
  const family = roleFamilyOf(scenario.meta.role)
  return <Badge tone="info">{ROLE_FRAMES[family].title.split(' — ')[0]}</Badge>
}
