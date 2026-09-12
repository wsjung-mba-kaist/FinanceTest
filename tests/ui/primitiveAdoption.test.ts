import { describe, expect, it } from 'vitest'

/**
 * A ratchet, not a rule.
 *
 * The app has 47 files that draw a card, a chip or a tab by hand, next to primitives that do the
 * same thing. A test that banned the hand-rolled form outright would have to be written last, when
 * the migration is already done, and would therefore protect nothing during the migration. So this
 * counts instead: each pattern has a ceiling equal to today's count, and the ceiling may only ever
 * be lowered. Migrating a file is expected to fail this suite — with a message telling you the new
 * number to write down.
 *
 * The counts are deliberately coarse. They are a direction of travel, not an inventory.
 */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Files that *define* a primitive necessarily contain the pattern they replace. */
const DEFINITIONS = ['/components/ui/', '/styles/', '/lib/grid.ts', '/useChartType.ts']

const files = Object.entries(SOURCES)
  .filter(([path]) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
  .filter(([path]) => !path.includes('__tests__'))

interface Pattern {
  name: string
  /** Global regex; every match in every non-definition source file counts. */
  re: RegExp
  max: number
  replacement: string
}

const PATTERNS: Pattern[] = [
  {
    // Zero: every card surface in the app now comes from `<Card>` or `cardClass()`.
    name: '손으로 그린 카드',
    re: /rounded-lg border border-border bg-surface/g,
    max: 0,
    replacement: '<Card>',
  },
  {
    // Deleted in Phase 1 — a ceiling of 0 so they cannot be reintroduced.
    name: 'card-surface / card-key / card-quiet 유틸리티',
    re: /\bcard-(surface|key|quiet)\b/g,
    max: 0,
    replacement: '<Card tier="…">',
  },
  {
    // `rounded` is a v3 alias compiled to a literal 0.25rem — it never reads `--radius-sm`.
    name: 'v3 별칭 rounded (토큰을 읽지 않음)',
    re: /(?<![-\w])rounded(?=["'` ])/g,
    max: 0,
    replacement: 'rounded-sm / rounded-md',
  },
  {
    name: '임의값 radius',
    re: /\brounded-\[/g,
    max: 0,
    replacement: '--radius-* 토큰',
  },
  {
    /**
     * Counts tab lists that implement the keyboard contract themselves.
     *
     * The count of `role="tablist"` was the wrong proxy: the play screen's three lists are
     * genuinely three shapes (tabs with shortcuts, a 3-of-5 sub-row, a bottom nav with badges),
     * and forcing them through one `<Tabs>` would need a `variant` per caller and make the
     * primitive worse. What they shared — and all three were missing — is arrow keys and a single
     * tab stop, which now lives in `useTabListKeys`. So this counts the *duplication that
     * mattered*: a tab list handling its own arrow keys without the hook.
     */
    name: '직접 구현한 탭 키보드',
    // One match per *file*: "this file draws a tab list and does not use the hook".
    re: /^(?![\s\S]*useTabListKeys)[\s\S]*?role="tablist"/g,
    max: 0,
    replacement: 'useTabListKeys(ids, value, onChange)',
  },
  {
    // Zero: every modal surface is `<Dialog>` or `<SideSheet>`, and both go through
    // `useFocusTrap`. `DEFINITIONS` exempts the two that define it.
    name: '손으로 그린 모달',
    re: /aria-modal/g,
    max: 0,
    replacement: '<Dialog>',
  },
  {
    // 1 is the floor: `SearchField` suppresses the inner ring and puts it on the bordered
    // wrapper via `focus-within`, which is the fix rather than the problem.
    name: 'outline-none (포커스 링을 지움)',
    re: /\boutline-none\b/g,
    max: 1,
    replacement: 'focus-within 링을 가진 <Field>/<SearchField>',
  },
  {
    name: 'opacity 로 만든 비활성 상태',
    re: /\b(disabled:)?opacity-50\b/g,
    max: 0,
    replacement: '--disabled-bg / --disabled-fg',
  },
  {
    // A chip row that is a grid instead of `flex-wrap` leaves a 719px gap next to five items.
    //
    // 12 is a floor, not a to-do. What remains is genuinely fixed: a 2-up KPI tile grid, the
    // three 귀하/역사/전문가 comparison columns, the four mobile tabs, paired side-by-side panels.
    // Routing those through `gridClass` would compute a constant and read worse. Only a grid
    // whose item *count* varies belongs there.
    name: '고정 열 수 grid-cols-N',
    re: /\bgrid-cols-\d/g,
    max: 12,
    replacement: 'gridClass(kind, n)',
  },
  {
    // A toggle chip drawn by hand had three different ideas of "selected" across the app.
    name: '손으로 그린 토글 칩',
    re: /rounded-full border/g,
    max: 0,
    replacement: '<Chip selected>',
  },
  {
    // An accent-filled pill: the unread count, the pending count, the help badge. Four copies had
    // drifted apart on margin and weight. The one left is the option-row letter badge, which is a
    // selection marker inside a radio row rather than a count — a different thing that happens to
    // share a fill.
    name: '손으로 그린 카운트 필',
    re: /bg-accent [^"'`]*text-accent-fg/g,
    max: 1,
    replacement: '<CountPill count label>',
  },
  {
    // A <button> stripped back to look like a link.
    name: '링크처럼 그린 버튼',
    re: /bg-transparent border-0/g,
    max: 0,
    replacement: '<Button variant="link">',
  },
  {
    // A hard-coded *pixel* height is a tap target somebody eyeballed; the three named minimums
    // (44 / 32 / 24) are the only control heights this app has an opinion about. Column widths
    // and skeleton heights in rem/em are layout, not touch, and stay legal.
    name: '임의값 px 터치 높이',
    re: /min-h-\[\d+px\]/g,
    max: 0,
    replacement: 'min-h-tap-min / -compact / -dense',
  },
  {
    // Recharts takes numbers rather than CSS, so a *literal* here is a label that ignores the
    // reader's 글자 크기 setting entirely — everything on the page grew except the axis ticks they
    // were already squinting at. A computed size (`chart.tick`, `size * 0.26`) is fine.
    name: '절대 px 차트 글꼴',
    re: /fontSize[:=]\s*\{?\s*\d/g,
    max: 0,
    replacement: '루트 크기에 연동된 useChartType()',
  },
]

function countIn(re: RegExp, text: string): number {
  return (text.match(new RegExp(re.source, re.flags)) ?? []).length
}

describe('primitive adoption ratchet', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(PATTERNS.map((p) => [p.name, p] as const))('%s', (_name, pattern) => {
    const perFile = files
      .filter(([path]) => !DEFINITIONS.some((d) => path.includes(d)))
      .map(([path, text]) => [path, countIn(pattern.re, text)] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
    const total = perFile.reduce((s, [, n]) => s + n, 0)

    const worst = perFile
      .slice(0, 8)
      .map(([p, n]) => `  ${n}× ${p.replace('../../src/', 'src/')}`)
      .join('\n')

    // Strict equality is what makes this a ratchet: going up is a regression, and going down has
    // to be written down, because the number *is* the record of how far the migration has got.
    expect(
      total,
      total > pattern.max
        ? `«${pattern.name}» 가 ${pattern.max} → ${total} 로 늘었습니다. ${pattern.replacement} 를 쓰세요.\n${worst}`
        : `«${pattern.name}» 가 ${pattern.max} → ${total} 로 줄었습니다 — PATTERNS 의 max 를 ${total} 로 내리세요.`,
    ).toBe(pattern.max)
  })
})
