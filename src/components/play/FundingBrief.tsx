import { Card } from '../ui'
import { FundingSchedule } from './FundingSchedule'
import { FundingOperations } from './FundingOperations'
import { pendingFundingInstructions } from '../../lib/fundingOperations'
import { gridClass } from '../../lib/grid'
import { latestSnapshot } from '../../engine'
import { formatAt } from '../../lib/format'
import { metricContext } from '../../lib/metricContext'
import { usePlay } from './playContext'
import { deadlineCaption } from './playHelpers'

const METRICS = {
  bank: ['cash', 'facilityHeadroom', 'facilityPending', 'projectedDailyOutflow'],
  securities: ['cash', 'abcpMaturingNext', 'rollRate', 'marginCallPending'],
  pension: ['liquidAssets', 'marginCallPending', 'collateralHeadroomBp', 'hedgeRatio'],
  prime_broker: ['grossExposure', 'marginCoverage', 'liquidationVaR', 'concentrationDays'],
  asset_manager: ['nav', 'redemptionsPendingPct', 'cashBufferPct', 'weeklyLiquidityPct'],
  central_bank: ['usableReserves', 'guidottiRatio', 'imfCommitted', 'distressedBanks'],
} as const

const BASIS = {
  bank: '차입 한도는 인출 전 현금이 아닙니다. 향후 1일 유출 추정과 실제 결제 마감은 구분하세요.',
  securities:
    '이번 구간 차환 만기와 마진콜을 함께 확인하세요. 차환 실패분과 외화 지급의 결제 시각은 별도 확인이 필요합니다.',
  pension:
    '유동자산에는 미담보 국채가 포함됩니다. 매각·담보 이전이 끝나기 전에는 현금으로 사용할 수 없습니다.',
  prime_broker:
    '청산 VaR는 손실 추정치입니다. 고객에게 받은 마진을 회사의 가용 현금으로 계산하지 않습니다.',
  asset_manager:
    '1일 유동성에는 현금화 가능한 자산이 포함됩니다. 환매 금액·지급일과 잔존 수익자의 희석을 함께 판단하세요.',
  central_bank:
    '가용 외환보유액과 지원 약정액을 구분하세요. 약정만으로 인출 완료나 지원 권한이 확정되지는 않습니다.',
} as const

/** Role overview; authored bank plans add current-window funding estimates. */
export function FundingBrief({ compact = false }: { compact?: boolean }) {
  const { scenario, state, view, mode } = usePlay()
  const snapshot = latestSnapshot(state)
  const operational =
    state.institution.kind === 'pension' || state.institution.kind === 'securities'
  const instructions = pendingFundingInstructions(state, scenario)
  const hasFundingPlan = Boolean(scenario.fundingPlan && state.institution.kind === 'bank')
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
      {!compact && !hasFundingPlan && !operational && (
        <>
          <dl className={`mt-2 grid gap-2 ${gridClass('metric', 2)}`}>
            {METRICS[state.institution.kind].map((key) => {
              const spec = scenario.kpis.find((k) => k.metric === key)
              const lag = mode === 'expert' ? (spec?.lagTurns ?? 0) : 0
              const shown = lag
                ? state.metricsHistory.find(
                    (s) => s.turnIndex === Math.max(0, state.turnIndex - lag),
                  )
                : snapshot
              const metric = shown?.metrics[key]
              if (!metric) return null
              return (
                <div key={key}>
                  <dt className="text-muted">
                    {key === 'facilityPending' ? '반영 대기 한도' : metric.label}
                    {lag > 0 && ` (T+${shown?.turnIndex} 기준)`}
                  </dt>
                  <dd className="num m-0 font-medium">
                    {formatAt(metric.value, metric.unit, scenario.units)}
                  </dd>
                  {metricContext(key) && (
                    <dd className="m-0 text-xs text-muted">{metricContext(key)}</dd>
                  )}
                </div>
              )
            })}
          </dl>
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
