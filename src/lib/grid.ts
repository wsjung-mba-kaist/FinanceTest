/**
 * Column counts are a function of the item count, not a constant.
 *
 * `grid-cols-3` with 13 items leaves one card alone on the last row and 640px of blank beside it.
 * `grid-cols-4` with 5 items leaves 719px. Both were on screen; both came from picking a column
 * count once and never revisiting it as the content grew.
 *
 *   R1  c = min(cmax, n, ceil(n / ceil(n / cmax)))
 *       Keep the number of rows `cmax` would have produced, then spread the items evenly over
 *       them. 13 items at cmax 4 → 4 rows → 4 columns (13 = 4+4+4+1, still an orphan), but 10
 *       items at cmax 3 → 4 rows → 3 columns becomes 10 at cmax 5 → 2 rows → 5 columns.
 *
 *   R1b If one orphan still remains (`n % c === 1`) and there is room to do it (`c > 2`), the
 *       first item spans two columns. The row fills, and the item that gets the extra width is
 *       the one the reading order already says is most important.
 *
 *   R2  `cmax` is a property of the *content*, not the page: a numeric tile needs ~160px, a link
 *       ~240px, a question ~280px, prose ~320px, a scenario card ~360px. A row of chips is not a
 *       grid at all — it is `flex-wrap`, because chips are as wide as their words.
 *
 * Returning class strings (rather than a `style`) keeps this inside Tailwind's responsive system,
 * so the column count still steps down on a phone.
 */
export type GridKind = 'metric' | 'link' | 'question' | 'prose' | 'scenario'

/** Widest column count each kind may reach, and the ramp up to it. */
const RAMP: Record<GridKind, { max: number; classes: string[] }> = {
  // 160px tiles: 2 up on a phone, then 3 / 4 / 5 / 6.
  metric: {
    max: 6,
    classes: [
      'grid-cols-1',
      'grid-cols-2',
      'sm:grid-cols-3',
      'lg:grid-cols-4',
      'xl:grid-cols-5',
      '2xl:grid-cols-6',
    ],
  },
  // 240px links.
  link: {
    max: 5,
    classes: ['grid-cols-1', 'grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5'],
  },
  // 280px — a question needs a line or two of Korean without hyphenating.
  question: {
    max: 4,
    classes: ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4'],
  },
  // 320px prose.
  prose: { max: 3, classes: ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3'] },
  // 360px scenario cards.
  scenario: { max: 3, classes: ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3'] },
}

/** R1: the widest column count that does not add a row beyond what `cmax` would need. */
export function columnsFor(n: number, cmax: number): number {
  if (n <= 0) return 1
  const rows = Math.ceil(n / cmax)
  return Math.min(cmax, n, Math.ceil(n / rows))
}

/**
 * R1b: does the first item need to span two columns to fill the last row?
 * Only when exactly one item would be left over, and only when the grid is wide enough that a
 * double-width first item is not simply the whole row.
 */
export function firstSpansTwo(n: number, columns: number): boolean {
  return columns > 2 && n % columns === 1
}

export interface GridPlan {
  /** Class string for the grid container (no `grid` / `gap-*` — the caller owns those). */
  className: string
  columns: number
  /** Class for the first child, or `''`. Apply it only to the first item. */
  firstItemClassName: string
}

export function gridPlan(kind: GridKind, n: number): GridPlan {
  const { max, classes } = RAMP[kind]
  const columns = columnsFor(n, max)
  // The ramp is written for the widest case; truncating it at `columns` gives the same steps
  // scaled down, which is why a 2-item prose grid never jumps to three columns on a wide screen.
  const className = classes.slice(0, Math.max(1, columns)).join(' ')
  return {
    className,
    columns,
    firstItemClassName: firstSpansTwo(n, columns) ? `sm:col-span-2` : '',
  }
}

/** Shorthand when the caller does not need the first-item span. */
export function gridClass(kind: GridKind, n: number): string {
  return gridPlan(kind, n).className
}
