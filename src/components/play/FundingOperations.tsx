import { formatAt } from '../../lib/format'
import { gridClass } from '../../lib/grid'
import { fundingPosition } from '../../lib/fundingOperations'
import { usePlay } from './playContext'

/** Cash, collateral and commitments belong to different books; keep them separate at the decision. */
export function FundingOperations({ compact = false }: { compact?: boolean }) {
  const { state, scenario } = usePlay()
  const position = fundingPosition(state)
  if (!position) return null
  const money = (value: number) => formatAt(value, 'ccy', scenario.units)
  const rows =
    position.kind === 'pension'
      ? ([
          ['스킴 현금', position.cash, '스킴 보유 · 풀 납입 전'],
          ['풀 미충당 마진콜', position.unpaidMargin, '현재 남은 콜 · 이후 추가 청구 제외'],
          ['풀 내부 담보 현금', position.poolCash, '풀 내부 콜 충당용 · 스킴 현금에 미포함'],
          ['풀 내부 적격 길트', position.poolGilts, '현금과 구별되는 적격 담보'],
        ] as const)
      : ([
          ['현재 현금', position.cash, '현재 장부 잔고'],
          ['미처리 첫 만기', position.maturity, '차환 처리 후 다음 만기로 이동'],
          ['미인출 은행 약정', position.undrawn, '인출·입금 확인 전 현금에 미포함'],
          [
            '자체매입 필요액 · 추정',
            position.estimatedPurchase,
            '첫 만기 × (1 − 현재 차환 성공률)',
          ],
        ] as const)
  return (
    <section aria-label="결제 준비 현황" className="mt-2">
      <dl className={`grid gap-2 ${gridClass('metric', 2)}`}>
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="num m-0 font-medium">{money(value)}</dd>
            {!compact && <dd className="m-0 text-xs text-muted">{note}</dd>}
          </div>
        ))}
      </dl>
      {position.kind === 'pension' ? (
        <>
          <p className="mt-2 text-muted">
            풀 담보를 스킴 현금에 더하지 않습니다. 스킴 현금도 승인·송금·운용사 반영이 끝나야 풀에서
            사용할 수 있습니다.
          </p>
          {!compact && (
            <details className="mt-2">
              <summary className="cursor-pointer">추가 동원 자산과 실행 조건</summary>
              <p className="mt-1">
                스킴 미담보 길트 <span className="num">{money(position.schemeGilts)}</span> · 매각
                또는 현물 이전이 필요하며 현금이 아닙니다.
              </p>
              {scenario.meta.id === 'uk-ldi-2022' && (
                <ul className="mt-1 space-y-1 text-muted">
                  <li>
                    당일 집행·현물 이전:{' '}
                    {state.flags.ops_ready
                      ? '사전 운영 준비 확보 · 금액·컷오프 확인'
                      : '사전 운영 준비 미확보 · 승인·현물 수용 조건 확인'}
                  </li>
                  <li>
                    스폰서 출연:{' '}
                    {state.flags.sponsor_standby
                      ? '대기성 약정 확보 · 요청·이행 확인'
                      : '대기성 약정 미확보 · 이사회 승인·입금 시점 확인'}
                  </li>
                  <li>
                    주식·회사채 매각 지시와 결제 완료는 다릅니다. 아래 후속 처리 예정 시점과 운용사
                    컷오프를 함께 확인하세요.
                  </li>
                </ul>
              )}
            </details>
          )}
        </>
      ) : (
        <>
          <p className={`mt-2 ${position.purchaseCashGap > 0 ? 'text-critical' : 'text-muted'}`}>
            첫 만기 자체매입 대비 현금 부족분 · 추정{' '}
            <span className="num font-medium">{money(position.purchaseCashGap)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            현재 차환 성공률 {(position.rollRate * 100).toFixed(0)}% 가정. CP·콜 상환, 마진콜, 추가
            조달은 이 비교에 포함되지 않습니다.
          </p>
          {!compact && (
            <details className="mt-2">
              <summary className="cursor-pointer">미처리 만기와 별도 지급 확인</summary>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {position.maturities.map((amount, index) => (
                  <li key={index}>
                    미처리 {index + 1}번째 만기 <span className="num">{money(amount)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1 text-xs text-muted">
                처리 순서 기준이며 30일 합계가 아닙니다. 개별 만기일·결제시각은 별도 확인이
                필요합니다.
              </p>
              <p className="mt-1">
                미납 마진콜 <span className="num">{money(position.unpaidMargin)}</span> · 외화
                유동자산(기준통화 환산) <span className="num">{money(position.fxAssets)}</span>
              </p>
              <p className="text-xs text-muted">
                외화의 실제 통화·송금 마감·환전 가능 여부는 별도 확인하세요. 약정액은 현금에
                합산하지 않습니다.
              </p>
            </details>
          )}
        </>
      )}
    </section>
  )
}
