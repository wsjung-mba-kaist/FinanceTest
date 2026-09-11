import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useMediaQuery'
import { useHelp } from '../help/helpContext'
import { Icon } from '../ui/Icon'
import { StatusBadge } from '../ui'
import { DIR_CLASS, DIR_TEXT } from '../dashboard/kpiRows'
import { Sparkline } from '../dashboard/Sparkline'
import { usePlay } from './playContext'
import { buildStripCells, type MetricCell, type StripCell } from './stripCells'

const DOT: Record<string, string> = {
  ok: 'bg-positive',
  warn: 'bg-warning',
  breach: 'bg-critical',
  na: 'bg-none',
}

/** Background flash when the figure moves (reel feedback); skipped under reduced motion. */
function usePulse(value: number, direction: string, enabled: boolean): string {
  const prev = useRef(value)
  const [cls, setCls] = useState('')
  useEffect(() => {
    if (prev.current === value) return
    const up = value > prev.current
    prev.current = value
    if (!enabled) return
    setCls(
      direction === 'neutral'
        ? up
          ? 'pulse-better'
          : 'pulse-worse'
        : direction === 'better'
          ? 'pulse-better'
          : 'pulse-worse',
    )
    const t = window.setTimeout(() => setCls(''), 720)
    return () => window.clearTimeout(t)
  }, [value, direction, enabled])
  return cls
}

function Cell({ cell }: { cell: MetricCell }) {
  const help = useHelp()
  const reduced = useReducedMotion()
  const pulse = usePulse(cell.raw, cell.direction, !reduced)
  return (
    <div
      className={`flex min-w-[9.5rem] flex-1 flex-col justify-center gap-0.5 rounded-md px-3 py-1 ${pulse}`}
    >
      <div className="flex items-center gap-1">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[cell.status] ?? 'bg-none'}`}
          aria-hidden="true"
        />
        <span className="truncate text-sm text-muted">{cell.label}</span>
        <button
          type="button"
          className="ml-auto rounded-full p-1 text-muted hover:bg-surface-2 hover:text-text"
          aria-label={`${cell.label} 설명 보기`}
          onClick={() => help.open({ tab: 'kpis', anchor: cell.metric })}
        >
          <Icon name="help" size={14} />
        </button>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="num-lg truncate">{cell.value}</span>
        {cell.delta && (
          <span className={`num text-sm ${DIR_CLASS[cell.direction]}`}>
            {cell.delta}
            <span className="sr-only"> (전 턴 대비 {DIR_TEXT[cell.direction]})</span>
          </span>
        )}
        {cell.series.length >= 2 && (
          <span className="ml-auto shrink-0">
            <Sparkline
              values={cell.series}
              width={56}
              height={18}
              ariaLabel={`${cell.label} 오늘 추이 ${cell.series.length}틱, 현재 ${cell.value}`}
            />
          </span>
        )}
      </div>
      {cell.sub && <div className="truncate text-xs text-muted">{cell.sub}</div>}
      <span className="sr-only">
        <StatusBadge status={cell.status} />
      </span>
    </div>
  )
}

function Legend({
  cell,
  mobile,
}: {
  cell: Extract<StripCell, { kind: 'legend' }>
  mobile?: boolean
}) {
  return (
    <div
      className={`flex flex-col justify-center gap-0.5 px-3 py-1 ${
        mobile ? 'col-span-2 border-t border-border' : 'min-w-[10rem] border-l border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        {cell.figures.map((f) => (
          <span key={f.label} className="whitespace-nowrap">
            <span className="text-muted">{f.label} </span>
            <span className={`num ${DIR_CLASS[f.direction]}`}>{f.value}</span>
          </span>
        ))}
      </div>
      <div className="text-xs text-muted">단위 {cell.legend}</div>
    </div>
  )
}

/**
 * Row of role-specific headline numbers (72px on desktop, a 2×2 grid on mobile).
 * The figures come from `stripCells.ts` so the same set feeds the tests.
 */
export function LiquidityStrip({ mobile }: { mobile?: boolean }) {
  const { scenario, state } = usePlay()
  const cells = useMemo(() => buildStripCells(scenario, state), [scenario, state])
  return (
    <section
      aria-label="핵심 유동성 지표"
      className={
        mobile
          ? 'grid grid-cols-2 gap-x-1 gap-y-0.5 border-b border-border bg-surface px-1 py-1'
          : 'flex h-[4.5rem] shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border bg-surface px-2'
      }
    >
      {cells.map((c) =>
        c.kind === 'legend' ? (
          <Legend key={c.id} cell={c} mobile={mobile} />
        ) : (
          <Cell key={c.id} cell={c} />
        ),
      )}
    </section>
  )
}
