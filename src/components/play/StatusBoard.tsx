import { useMemo, useState } from 'react'
import { Badge, Button } from '../ui'
import { usePlay } from './playContext'
import { REGULATOR_LABELS } from './playHelpers'
import { buildStatusRows, confidenceBars, confidenceTone, type StatusRow } from './statusRows'

const BAR_CLASS: Record<string, string> = {
  positive: 'bg-positive',
  info: 'bg-info',
  warning: 'bg-warning',
  critical: 'bg-critical',
  neutral: 'bg-none',
}

const VISIBLE = 8

function Row({ row }: { row: StatusRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 border-t border-border py-1.5 first:border-t-0">
      <span className="min-w-[8rem] text-base text-muted">{row.label}</span>
      <Badge tone={row.tone}>{row.value}</Badge>
      {row.note && <span className="num text-sm text-muted">{row.note}</span>}
    </li>
  )
}

/**
 * 창구·거래상대 현황판 + 이해관계자 신뢰 막대 + 감독 단계.
 * This is the board a crisis desk actually keeps on the wall: what can be drawn today,
 * what has been promised, and who still believes us.
 */
export function StatusBoard() {
  const { scenario, state } = usePlay()
  const rows = useMemo(() => buildStatusRows(scenario, state), [scenario, state])
  const bars = useMemo(() => confidenceBars(state), [state])
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, VISIBLE)
  const level = state.regulator.level
  const lastNote = [...state.regulator.notes].reverse()[0]

  return (
    <section aria-labelledby="status-board-title" className="card-surface p-3">
      <h3 id="status-board-title" className="text-md font-semibold">
        창구·거래상대 현황판
      </h3>
      <ul className="mt-1.5 list-none p-0">
        {shown.map((r) => (
          <Row key={r.id} row={r} />
        ))}
        {rows.length === 0 && (
          <li className="py-1.5 text-base text-muted">표시할 현황 항목이 없습니다.</li>
        )}
      </ul>
      {rows.length > VISIBLE && (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          className="mt-1"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '접기' : `더 보기 (${rows.length - VISIBLE}건)`}
        </Button>
      )}

      <h4 className="label-caps mt-3">이해관계자 신뢰</h4>
      <ul className="mt-1 list-none space-y-1 p-0">
        {bars.map((b) => {
          const tone = confidenceTone(b.value)
          return (
            <li key={b.id} className="flex items-center gap-2">
              <span className="w-[6.5rem] shrink-0 text-base text-muted">{b.label}</span>
              <span
                className="h-2 min-w-0 flex-1 rounded-full bg-surface-2"
                role="img"
                aria-label={`${b.label} 신뢰 ${Math.round(b.value)}점 (100점 만점)`}
              >
                <span
                  className={`block h-2 rounded-full ${BAR_CLASS[tone]}`}
                  style={{ width: `${Math.max(0, Math.min(100, b.value))}%` }}
                />
              </span>
              <span className="num w-8 shrink-0 text-right text-sm">{Math.round(b.value)}</span>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <span className="text-base text-muted">감독 단계</span>
        <Badge
          tone={
            level >= 3 ? 'critical' : level === 2 ? 'warning' : level === 1 ? 'info' : 'neutral'
          }
        >
          {REGULATOR_LABELS[level] ?? `R${level}`}
        </Badge>
        {lastNote && <span className="text-sm text-muted">{lastNote}</span>}
      </div>
    </section>
  )
}
