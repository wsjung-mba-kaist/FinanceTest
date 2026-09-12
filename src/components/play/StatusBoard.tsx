import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable } from '../ui'
import { usePlay } from './playContext'
import { REGULATOR_LABELS } from './playHelpers'
import { buildStatusRows, confidenceBars, confidenceTone, type StatusRow } from './statusRows'

const BAR_CLASS: Record<string, string> = {
  positive: 'bg-positive',
  info: 'bg-info',
  warning: 'bg-warning',
  critical: 'bg-critical',
  neutral: 'bg-sev-none',
}

const VISIBLE = 8

/**
 * A pill when something is off, plain text when it is not.
 *
 * Every row wore a filled badge, so a board of a dozen rows was a dozen pills and none of them
 * drew the eye — which is the only thing a pill is for. `neutral` and `positive` are the board's
 * resting states; they read fine as text and leave the colour to the rows that need it.
 */
const TONE_TEXT: Record<string, string> = {
  warning: 'text-warning font-medium',
  critical: 'text-critical font-medium',
  info: 'text-info',
}

function StatusValue({ row }: { row: StatusRow }) {
  const alarming = row.tone === 'warning' || row.tone === 'critical'
  if (alarming) return <Badge tone={row.tone}>{row.value}</Badge>
  return <span className={TONE_TEXT[row.tone] ?? ''}>{row.value}</span>
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
    <Card aria-labelledby="status-board-title" className="p-3">
      <h3 id="status-board-title" className="text-md font-semibold">
        창구·거래상대 현황판
      </h3>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-base text-muted">표시할 현황 항목이 없습니다.</p>
      ) : (
        <div className="mt-1.5">
          {/* Three aligned columns rather than a flex row: the second figure is a number, and a
              number that starts wherever the badge before it happened to end is not a column. */}
          <DataTable
            caption="창구·거래상대 현황"
            columns={[
              { key: 'label', label: '항목', render: (r: StatusRow) => r.label },
              {
                key: 'value',
                label: '상태',
                align: 'right',
                render: (r: StatusRow) => <StatusValue row={r} />,
              },
              {
                key: 'note',
                label: '수치',
                align: 'right',
                render: (r: StatusRow) => (r.note ? <span className="num">{r.note}</span> : null),
              },
            ]}
            rows={shown}
            rowKey={(r) => r.id}
          />
        </div>
      )}
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
    </Card>
  )
}
