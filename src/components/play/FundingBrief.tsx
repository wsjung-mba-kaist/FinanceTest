import { Card } from '../ui'
import { FundingSchedule } from './FundingSchedule'
import { FundingOperations } from './FundingOperations'
import { pendingFundingInstructions } from '../../lib/fundingOperations'
import { BASIS, fundingBriefRows } from './fundingBriefRows'
import { gridClass } from '../../lib/grid'
import { latestSnapshot } from '../../engine'
import { formatAt } from '../../lib/format'
import { metricContext } from '../../lib/metricContext'
import { usePlay } from './playContext'
import { deadlineCaption } from './playHelpers'

/** Role overview; authored bank plans add current-window funding estimates. */
export function FundingBrief({ compact = false }: { compact?: boolean }) {
  const { scenario, state, view, mode } = usePlay()
  const snapshot = latestSnapshot(state)
  const operational =
    state.institution.kind === 'pension' || state.institution.kind === 'securities'
  const instructions = pendingFundingInstructions(state, scenario)
  const hasFundingPlan = Boolean(scenario.fundingPlan && state.institution.kind === 'bank')
  /**
   * 저작자가 KPI 로 올린 지표만 상황실에 올린다.
   *
   * 이 목록은 기관 종류로만 골랐었다. 그러면 그 시나리오가 쓰지 않는 필드까지 끌려 나온다 —
   * 크레디트스위스 상황실에 «IMF 지원 약정액 0» 이 상주했고(`initialState` 주석이 "지표에는
   * 나오지만 KPI 로 노출하지 않는다"고 못박아 둔 바로 그 값이다), 레고랜드에는 자체헤지가
   * 없는데 «마진콜 대기 0» 이 떴다. `kpis` 와 교차하면 그 셋이 함께 풀린다: 구조적 0 이
   * 사라지고, `lagTurns` 가 일관되게 걸리고, 라벨을 저작된 것으로 쓸 수 있다.
   */
  const rows = fundingBriefRows(scenario)
  const unresolved = [...view.decisions, ...view.interrupts]
    .filter((d) => !d.resolved)
    .sort(
      (a, b) => (a.decision.deadlineTick ?? view.ticks) - (b.decision.deadlineTick ?? view.ticks),
    )
  const next = unresolved[0]?.decision
  return (
    <Card as="section" aria-label="자금·마감 확인" className="p-3 text-sm">
      <h3 className="font-semibold">자금·마감 확인</h3>
      <p className="mt-1 font-medium">
        {next
          ? `${next.title} · ${deadlineCaption(view.turn, next, state.tick) || '이번 구간 내 판단'}`
          : '현재 요청된 미결 결정 없음'}
      </p>
      {hasFundingPlan && <FundingSchedule compact={compact} />}
      {operational && <FundingOperations compact={compact} />}
      {/* 교차 결과가 비면 본문을 통째로 접는다. 태영처럼 현금·차입 지표를 KPI 로 올리지 않은
          시나리오에 은행용 «차입 한도는 인출 전 현금이 아닙니다» 안내만 남기면, 화면에 없는
          숫자에 대한 주의문이 된다. 그때는 마감 한 줄만 남는 것이 맞다. */}
      {!compact && !hasFundingPlan && !operational && rows.length > 0 && (
        <>
          {
            <dl className={`mt-2 grid gap-2 ${gridClass('metric', 2)}`}>
              {rows.map((spec) => {
                const lag = mode === 'expert' ? (spec.lagTurns ?? 0) : 0
                const shown = lag
                  ? state.metricsHistory.find(
                      (s) => s.turnIndex === Math.max(0, state.turnIndex - lag),
                    )
                  : snapshot
                const metric = shown?.metrics[spec.metric]
                if (!metric) return null
                const context = metricContext(spec.metric)
                return (
                  <div key={spec.metric}>
                    <dt className="text-muted">
                      {/* 저작된 이름이 이긴다. 등록부 라벨을 쓰면 `CentralBankState` 를 다른
                          용도로 저작한 시나리오에서 틀린 이름이 나온다 — 저축은행 «저축은행계정
                          가용재원» 과 CS «SNB 즉시 공여 여력» 이 둘 다 «가용외환보유액» 이 됐다. */}
                      {spec.label}
                      {lag > 0 && ` (T+${shown?.turnIndex} 기준)`}
                    </dt>
                    <dd className="num m-0 font-medium">
                      {formatAt(metric.value, metric.unit, scenario.units)}
                    </dd>
                    {context && <dd className="m-0 text-xs text-muted">{context}</dd>}
                  </div>
                )
              })}
            </dl>
          }
          <p className="mt-2 text-muted">{BASIS[state.institution.kind]}</p>
          <p className="mt-1 text-xs text-muted">
            확정 지급액·결제 시각별 원장은 제공되지 않습니다. 위 수치만으로 마감 시점의 현금
            부족액을 확정할 수 없습니다.
          </p>
        </>
      )}
      {!compact && (
        <details className="mt-2">
          <summary className="cursor-pointer">
            후속 처리 대기 {state.pending.length}건 · 미결 요청 {unresolved.length}건
          </summary>
          {state.pending.length === 0 ? (
            <p className="mt-1 text-muted">등록된 후속 처리 없음</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {instructions.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.instruction}</span>
                  <div className="text-xs text-muted">예정: {p.due} · 시나리오 처리 시점</div>
                  <div className="text-xs text-muted">
                    조건 충족·처리 완료 후 반영 · 예정은 입금·이행 완료를 뜻하지 않습니다.
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </Card>
  )
}
