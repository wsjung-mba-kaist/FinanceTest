import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useMediaQuery'
import { useHelp } from '../help/helpContext'
import { Icon } from '../ui/Icon'
import { StatusBadge } from '../ui'
import { DIR_CLASS, DIR_TEXT } from '../dashboard/kpiRows'
import { Sparkline } from '../dashboard/Sparkline'
import { usePlay } from './playContext'
import { buildStripCells, type MetricCell, type StripCell } from './stripCells'

/**
 * Status by **shape** as well as colour.
 *
 * The marker was an 8px coloured disc, `aria-hidden`, beside an `sr-only` badge — so a screen
 * reader was told the status and a colour-blind sighted reader was not: green, amber and red discs
 * at 8px are the same disc. These are the glyphs `StatusBadge` already uses, so the two say the
 * same thing the same way, and shape survives greyscale printing too.
 */
const DOT_GLYPH: Record<string, string> = { ok: '●', warn: '▲', breach: '■', na: '·' }

const DOT_COLOR: Record<string, string> = {
  ok: 'text-positive',
  warn: 'text-warning',
  breach: 'text-critical',
  na: 'text-sev-none',
}

/**
 * The figure only grows when something is wrong.
 *
 * All four strip numbers were 22px — the largest type on the screen, permanently, which meant the
 * strip shouted equally whether the bank was fine or failing and left the decision title (15px)
 * looking like a caption. At 18px the strip is legible without dominating, and the one metric in
 * breach is the thing that is now bigger than everything else — which is when you want it to be.
 */
const VALUE_CLASS: Record<string, string> = {
  breach: 'num-lg text-critical',
  warn: 'num-md text-warning',
  ok: 'num-md',
  na: 'num-md text-muted',
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

function Cell({ cell, mobile }: { cell: MetricCell; mobile?: boolean }) {
  const help = useHelp()
  const reduced = useReducedMotion()
  const pulse = usePulse(cell.raw, cell.direction, !reduced)
  return (
    <div
      className={`flex flex-1 flex-col justify-center gap-0.5 rounded-md py-1 ${
        mobile ? 'min-w-0 px-2' : 'min-w-[9.5rem] px-3'
      } ${pulse}`}
    >
      <div className="flex items-center gap-1">
        <span
          className={`shrink-0 text-xs leading-none ${DOT_COLOR[cell.status] ?? 'text-sev-none'}`}
          aria-hidden="true"
        >
          {DOT_GLYPH[cell.status] ?? '·'}
        </span>
        <span className="truncate text-sm text-muted">{cell.label}</span>
        <button
          type="button"
          className="ml-auto inline-flex min-h-tap-dense min-w-tap-dense items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
          aria-label={`${cell.label} 설명 보기`}
          onClick={() => help.open({ tab: 'kpis', anchor: cell.metric })}
        >
          <Icon name="help" size={14} />
        </button>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`truncate ${VALUE_CLASS[cell.status] ?? 'num-md'}`}>{cell.value}</span>
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
        mobile ? 'col-span-2 border-t border-border' : 'min-w-[8rem] border-l border-border'
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
      {/*
        The units line is a constant — it says the same thing on every turn of every scenario —
        and it was taking a permanent row of the densest strip on the screen. It is still read out
        (the strip's own figures carry their units in their labels) and still on the 대차대조표
        tab, where the numbers it qualifies actually live.
      */}
      <span className="sr-only">단위 {cell.legend}</span>
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
          <Cell key={c.id} cell={c} mobile={mobile} />
        ),
      )}
    </section>
  )
}
