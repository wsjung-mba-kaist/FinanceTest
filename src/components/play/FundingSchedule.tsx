import { DataTable, Num } from '../ui'
import { Citation } from '../knowledge/Citation'
import { buildFundingSchedule, fundingTimeLabel } from '../../lib/fundingSchedule'
import { formatAt, scaleFor } from '../../lib/format'
import { gridClass } from '../../lib/grid'
import { usePlay } from './playContext'

export function FundingSchedule({ compact = false }: { compact?: boolean }) {
  const { scenario, state, mode } = usePlay()
  const schedule = buildFundingSchedule(state, scenario)
  if (!schedule) return null
  if (
    mode === 'expert' &&
    scenario.kpis.some(
      (k) =>
        (k.lagTurns ?? 0) > 0 &&
        ['cash', 'deposits', 'confidence', 'facilityHeadroom', 'facilityPending'].includes(
          k.metric,
        ),
    )
  ) {
    return (
      <p className="mt-2 text-muted">
        지연 보고 중인 지표가 있어 현재 시점의 자금 일정 추정을 보류합니다.
      </p>
    )
  }
  const { projection } = schedule
  const scale = scaleFor(
    [
      schedule.cash,
      schedule.undrawn,
      schedule.pending,
      ...state.tickHistory.map((s) => s.values.cash ?? 0),
      ...(projection?.rows.flatMap((r) => [r.estimatedPayment, r.estimatedCash]) ?? []),
    ],
    scenario.units,
  )
  const money = (value: number) => formatAt(value, 'ccy', scenario.units, { scale, decimals: 2 })
  const shortfall = Math.max(0, -(projection?.closingCash ?? schedule.cash))
  const hasRemaining = Boolean(projection?.rows.length)
  const sourceRefs = [
    ...new Set([
      ...(projection?.sourceRefs ?? []),
      ...scenario.fundingPlan!.pendingCapacity.sourceRefs,
      ...schedule.checkpoints.flatMap((c) => c.spec.sourceRefs),
    ]),
  ]
  return (
    <section aria-label="결제·자금 일정" className="relative mt-3 min-w-0">
      <h4 className="font-semibold">결제·자금 일정</h4>
      <p className="mt-1 text-xs text-muted">
        기준:{' '}
        {fundingTimeLabel(scenario, {
          turnId: scenario.turns[state.turnIndex]!.id,
          tick: state.tick,
        })}{' '}
        · {scenario.units.currency}
      </p>
      <p
        className={`mt-1 font-medium ${schedule.cash < 0 ? 'text-critical' : shortfall > 0 ? 'text-warning' : ''}`}
      >
        {hasRemaining
          ? shortfall > 0
            ? schedule.cash < 0
              ? `현재 현금 부족 ${money(-schedule.cash)} · 구간 종료 부족 추정 ${money(shortfall)}`
              : `${projection!.firstShortfall}부터 부족 예상 · 이번 구간 종료 부족액 ${money(shortfall)}`
            : `현재 조건 유지 시 이번 구간 종료 잔고 ${money(projection!.closingCash)}`
          : schedule.cash < 0
            ? `현재 잔고 부족 ${money(-schedule.cash)}`
            : `현재 현금 ${money(schedule.cash)}`}
      </p>
      <p className="mt-1 text-muted">
        {hasRemaining
          ? '현재 조건을 유지한 추정입니다. 앞으로의 결정·사건·변동성에 따라 달라집니다.'
          : projection
            ? '이번 구간의 유출 반영이 끝났습니다. 이후 지급액은 이 추정에 포함되지 않습니다.'
            : '이 구간의 시간대별 지급액은 미산정입니다. 지급 의무가 없다는 뜻은 아닙니다.'}
      </p>
      {!compact && (
        <dl className={`mt-2 grid gap-2 ${gridClass('metric', 2)}`}>
          <div>
            <dt className="text-muted">현재 현금 · 반영 완료</dt>
            <dd className="m-0 font-medium">{money(schedule.cash)}</dd>
          </div>
          <div>
            <dt className="text-muted">남은 구간 지급 · 추정</dt>
            <dd className="m-0 font-medium">
              {projection ? money(projection.remainingPayments) : '미산정'}
            </dd>
          </div>
        </dl>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer font-medium">결제·자금 일정 자세히</summary>
        {hasRemaining && (
          <div className="mt-2">
            <p className="mb-2 text-muted">
              현재 현금 {money(schedule.cash)}에서 아래 추정 지급액을 순서대로 차감합니다. 차입·증자
              등 미실행 조달은 가산하지 않습니다.
            </p>
            <DataTable
              caption="남은 구간 시간대별 지급과 잔고 추정"
              rowKey={(r) => String(r.tick)}
              rows={projection!.rows}
              columns={[
                {
                  key: 'time',
                  label: '예상 반영',
                  render: (r) => <span className="whitespace-nowrap">{r.time}</span>,
                },
                {
                  key: 'payment',
                  label: '지급 추정',
                  unit: scale.label,
                  align: 'right',
                  render: (r) => (
                    <Num
                      value={r.estimatedPayment}
                      unit="ccy"
                      units={scenario.units}
                      scale={scale}
                      decimals={2}
                      showUnit={false}
                    />
                  ),
                },
                {
                  key: 'cash',
                  label: '잔고 추정',
                  unit: scale.label,
                  align: 'right',
                  render: (r) => (
                    <span className={r.shortfall > 0 ? 'text-warning' : ''}>
                      <Num
                        value={r.estimatedCash}
                        unit="ccy"
                        units={scenario.units}
                        scale={scale}
                        decimals={2}
                        showUnit={false}
                      />
                      {r.shortfall > 0 && <span className="block text-xs">부족</span>}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-medium">미인출 차입 한도 · {money(schedule.undrawn)}</dt>
            <dd className="m-0 text-muted">
              한도 확인 후 인출 결정을 실행해야 현금에 반영됩니다. 현금 잔고에 포함하지 않았습니다.
            </dd>
          </div>
          <div>
            <dt className="font-medium">담보 이전 중 · {money(schedule.pending)}</dt>
            <dd className="m-0 text-muted">
              {schedule.pending > 0
                ? `한도 반영 예정: ${schedule.pendingAt}. ${schedule.pendingCondition}`
                : '현재 이전 중인 한도 없음.'}
            </dd>
          </div>
          {schedule.checkpoints.map((c) => (
            <div key={c.spec.id}>
              <dt className="font-medium">
                {c.spec.title} · {c.time}
              </dt>
              <dd className="m-0 text-muted">
                {c.reached
                  ? c.recordedCash === undefined
                    ? '해당 시점의 잔고 기록이 없어 결과를 확인할 수 없습니다.'
                    : `마감 기록 ${money(c.recordedCash)}${c.recordedCash < 0 ? ' · 부족' : ''}. 이후 야간 조달과 구분한 잔고입니다.`
                  : '잔고 확인 예정 · 별도의 추가 지급액이 아닙니다.'}{' '}
                {c.spec.note}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-muted">
          {projection?.assumption} 금액은 합성 기관의 훈련 수치입니다. 개별 송금의 확정 지급 원장은
          제공되지 않습니다.
        </p>
        <p className="mt-1 text-xs text-muted">
          출처는 유출·담보 조달의 배경 근거이며, 시간별 금액과 시각을 입증하지 않습니다.{' '}
          {mode === 'expert' ? (
            '사후 출처는 종료 후 공개'
          ) : (
            <Citation ids={sourceRefs} local={scenario.meta.sources} />
          )}
        </p>
      </details>
    </section>
  )
}
