import type { ReactNode } from 'react'
import { cardClass } from './cardStyles'

export interface Column<R> {
  key: string
  label: string
  /** Numeric columns right-align so the figures stack on their decimal point. */
  align?: 'left' | 'right'
  /**
   * The unit every cell in this column shares — `조원`, `%`, `bp`. Printed under the label rather
   * than after each value: a column is only a comparable axis if the unit is a property of the
   * column, and repeating it on every row costs width the numbers need.
   */
  unit?: string
  render: (row: R) => ReactNode
}

/**
 * The table shape this app kept hand-rolling: real `<table>` semantics, a scroll container that
 * does not eat them, right-aligned figures, and the unit in the header.
 *
 * `role="table"` / `columnheader` / `row` must survive — `tests/ui/knowledgeA11y.test.tsx` asserts
 * a screen reader still announces "표, N열 M행", which is why the horizontal scroll lives on a
 * wrapper `div` instead of `display: block` on the table itself (docs/ui-conventions.md, the `.md
 * table` note). It draws the card surface with `cardClass` rather than `<Card>` so this module
 * does not import the barrel that re-exports it — the same escape hatch `buttonClass` exists for.
 * `data-card` is what the print stylesheet keys `break-inside: avoid` off.
 */
export function DataTable<R>({
  columns,
  rows,
  rowKey,
  caption,
  stickyHeader = false,
  className = '',
}: {
  columns: Column<R>[]
  rows: R[]
  rowKey: (row: R, index: number) => string
  /** Always present; visually hidden, because the visible heading is the section's own. */
  caption: string
  stickyHeader?: boolean
  className?: string
}) {
  return (
    <div data-card="base" className={cardClass('base', `overflow-x-auto ${className}`)}>
      <table className="w-full text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className={stickyHeader ? 'sticky top-0 bg-surface' : undefined}>
          <tr className="border-b border-border text-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
                {c.unit && <span className="ml-1 text-xs font-normal">({c.unit})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-border/60 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
