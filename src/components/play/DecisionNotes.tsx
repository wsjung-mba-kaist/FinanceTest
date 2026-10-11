import { useState } from 'react'
import { Icon } from '../ui/Icon'
import type { DecisionDraft } from './decisionDraft'

/** 판단 기록: 근거 메모 한 칸과 근거·가정·재검토 조건 세 칸. 초안은 독이 들고 있고 여기는 그린다. */
export function DecisionNotes({
  memo,
  reasoning,
  written,
  onMemo,
  onReasoning,
}: {
  memo: string
  reasoning: DecisionDraft['reasoning']
  written: boolean
  onMemo: (v: string) => void
  onReasoning: (patch: Partial<DecisionDraft['reasoning']>) => void
}) {
  const [memoOpen, setMemoOpen] = useState(false)
  return (
    <div className="px-3 pt-2">
      <button
        type="button"
        aria-expanded={memoOpen}
        className="inline-flex min-h-tap-compact items-center gap-1 rounded-sm px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
        onClick={() => setMemoOpen((o) => !o)}
      >
        {/* 칸이 넷인데 «근거 메모» 라는 이름과 `memo` 하나만 세고 있었다 — 근거·가정·재검토
              조건만 적은 사람에게 접힌 컨트롤이 «적어 둔 것 없음» 이라고 말했다. */}
        판단 기록{written ? ' (작성됨)' : ' (선택)'}
        <Icon name={memoOpen ? 'chevron-down' : 'chevron-right'} size={14} />
      </button>
      {memoOpen && (
        <div className="space-y-2">
          <label className="mt-1 block text-sm">
            <span className="sr-only">근거 메모</span>
            <textarea
              className="w-full rounded-md border border-border-control bg-bg px-2 py-1.5 text-base"
              rows={2}
              value={memo}
              onChange={(e) => onMemo(e.target.value)}
              placeholder="이 선택을 한 이유를 짧게 적어 두면 디브리핑에서 다시 볼 수 있습니다"
            />
          </label>
          {(
            [
              ['evidence', '확인한 근거'],
              ['assumption', '아직 확인하지 못한 가정'],
              ['reconsiderWhen', '판단을 바꿀 조건'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span>{label} (선택)</span>
              <textarea
                className="mt-1 w-full rounded-md border border-border-control bg-bg px-2 py-1.5 text-base"
                rows={2}
                value={reasoning[key]}
                onChange={(e) => onReasoning({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
