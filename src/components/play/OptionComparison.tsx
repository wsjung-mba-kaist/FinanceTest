import { gridClass } from '../../lib/grid'
import { Card } from '../ui'
import { useMemo, useState } from 'react'
import { previewOption, type DecisionView } from '../../engine'
import { mergeThresholds } from '../../metrics/thresholds'
import { Markdown } from '../knowledge/Markdown'
import { ImpactPreview } from './ImpactPreview'
import { usePlay } from './playContext'
import { previewFidelity } from './playHelpers'

export function OptionComparison({ dv }: { dv: DecisionView }) {
  const { scenario, state, mode } = usePlay()
  const [open, setOpen] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const fidelity = previewFidelity(mode)
  const compared = useMemo(
    () =>
      open
        ? dv.options
            .filter((o) => ids.includes(o.option.id))
            .map((ov) => ({
              ...ov,
              result:
                fidelity !== 'none' && ov.available
                  ? previewOption(state, scenario, dv.decision.id, [ov.option.id])
                  : undefined,
            }))
        : [],
    [open, ids, dv, fidelity, state, scenario],
  )
  return (
    <div className="px-3 pt-3">
      <button
        type="button"
        className="min-h-tap-compact text-sm text-accent"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        대안 2–3개 나란히 비교
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            비교할 항목을 최대 3개 고르세요. 실행 선택은 기존 선택지에서 확정합니다. 영향은 각 대안
            단독 기준이며, 결제·담보·승인은 명시된 조건까지만 판단할 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {dv.options.map(({ option }) => (
              <label key={option.id} className="text-sm">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={ids.includes(option.id)}
                  disabled={ids.length >= 3 && !ids.includes(option.id)}
                  onChange={() =>
                    setIds((v) =>
                      v.includes(option.id)
                        ? v.filter((id) => id !== option.id)
                        : [...v, option.id],
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className={`grid gap-2 ${gridClass('prose', Math.min(2, compared.length))}`}>
            {compared.map(({ option, available, reason, result }) => (
              <Card as="article" key={option.id} className="min-w-0">
                <div className="space-y-1 p-2 text-sm">
                  <h4 className="font-semibold">{option.label}</h4>
                  <p className={available ? 'text-muted' : 'text-warning'}>
                    {available ? '현재 선택 가능' : `실행 불가: ${reason ?? '조건 미충족'}`}
                  </p>
                  <Markdown className="md-compact">{option.description}</Markdown>
                  <p>
                    실행 조건:{' '}
                    {option.feasibility?.basis ?? '별도 명시 없음 — 승인·담보·결제 조건 확인 필요'}
                  </p>
                  {option.irreversible && <p className="text-warning">되돌리기 어려운 실행</p>}
                  {option.illegal && <p className="text-warning">규정 위반 소지가 있는 실행</p>}
                </div>
                {available && (
                  <ImpactPreview
                    fidelity={fidelity}
                    option={option}
                    result={result}
                    kpis={scenario.kpis}
                    units={scenario.units}
                    thresholds={mergeThresholds(scenario.thresholds)}
                  />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
