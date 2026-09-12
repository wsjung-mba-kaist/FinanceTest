import { describe, expect, it } from 'vitest'
import { declarationsOf, parseBlocks, readStylesheet } from '../helpers/css'

/**
 * The cascade-layer guardrail.
 *
 * Tailwind v4 emits `@layer theme, base, components, utilities`. Unlayered CSS is **not** in any
 * layer, and unlayered always outranks layered — so a single unlayered `a { color: … }` beats
 * `text-accent-fg` on the very links that fill themselves with the accent colour, i.e. an
 * invisible button label. That shipped once. This test is why it cannot ship again.
 *
 * Three allowances, all deliberate:
 *   • `:root…` blocks declare custom properties. Custom properties do not participate in the
 *     layer-vs-utility fight at all — they are read through `var()` by whichever rule wins — so
 *     keeping them unlayered is correct and keeps the token table readable.
 *   • `@media print` **must** stay unlayered. Print rules exist precisely to override utilities;
 *     putting them in a layer would make `bg-surface` beat `--surface: #fff` at the paper.
 *   • `@media (forced-colors: active)` is the same argument in Windows 고대비 모드: its whole job
 *     is to redraw boundaries the forced palette erased, over the top of whatever utilities said.
 *
 * Everything else — element defaults, `.md` typography, animation classes — belongs in a layer.
 */
const css = readStylesheet()
const blocks = parseBlocks(css)

/** A prelude that starts with `@` is an at-rule; anything else is a selector list. */
function isAtRule(prelude: string): boolean {
  return prelude.startsWith('@')
}

/** Media blocks whose contents are allowed to sit outside every layer. */
const OVERRIDE_MEDIA = ['@media print', '@media (forced-colors: active)']

const AT_RULES_NEEDING_NO_LAYER = [
  '@theme',
  '@utility',
  '@keyframes',
  '@layer',
  '@supports',
  '@font-face',
  '@page',
  '@custom-variant',
  '@property',
]

function where(b: { prelude: string; line: number }): string {
  return `index.css:${b.line} — ${b.prelude}`
}

describe('stylesheet cascade layers', () => {
  it('every style rule sits in a layer (tokens and print excepted)', () => {
    const offenders = blocks
      .filter((b) => {
        if (isAtRule(b.prelude)) return false
        if (b.ancestors.some((a) => a.startsWith('@layer'))) return false
        if (b.ancestors.some((a) => a.startsWith('@utility'))) return false
        if (b.ancestors.some((a) => a.startsWith('@keyframes'))) return false
        if (b.ancestors.some((a) => a.startsWith('@theme'))) return false
        // Print and forced-colors overrides are intentionally unlayered — see the file header.
        if (b.ancestors.some((a) => OVERRIDE_MEDIA.some((m) => a.startsWith(m)))) return false
        // Token blocks: `:root`, `:root[data-theme='dark']`, …
        if (b.prelude.split(',').every((s) => s.trim().startsWith(':root'))) return false
        // The reduced-motion reset is a deliberate `!important` sledgehammer over everything.
        const decls = declarationsOf(b.body)
        const allImportant = decls.length > 0 && decls.every((d) => d.value.includes('!important'))
        if (allImportant && b.prelude.split(',').every((s) => /^\*(::?[a-z-]+)?$/.test(s.trim())))
          return false
        return true
      })
      .map(where)

    expect(
      offenders,
      `계층 밖 규칙은 모든 유틸리티를 이깁니다. @layer base / @layer components 로 옮기세요:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('unlayered at-rules are only the ones that carry no cascade weight', () => {
    const offenders = blocks
      .filter((b) => isAtRule(b.prelude) && b.ancestors.length === 0)
      .filter((b) => !AT_RULES_NEEDING_NO_LAYER.some((a) => b.prelude.startsWith(a)))
      .filter((b) => !OVERRIDE_MEDIA.some((m) => b.prelude.startsWith(m)))
      // A top-level `@media` is fine as long as everything inside it is allowed; the rule above
      // already inspects those children by ancestry.
      .filter((b) => !b.prelude.startsWith('@media'))
      .map(where)

    expect(offenders, `계층 밖 at-rule:\n${offenders.join('\n')}`).toEqual([])
  })

  /**
   * A custom `@utility` is emitted *before* Tailwind's built-ins inside `@layer utilities`, so any
   * property it declares loses to the built-in utility for that same property.
   *
   * That is fine for a **type default** — `num-lg` setting a font size the caller may override is
   * the behaviour you want. It is fatal for a **box look**: `card-key` declared border, background,
   * radius and shadow, and lost all four to any `rounded-lg border border-border bg-surface` on the
   * same element, on every screen, since the day it was written. So the line is drawn by property,
   * not by taste: a utility here may paint type and colour, never the box.
   */
  it('custom utilities declare no box property a built-in utility would win', () => {
    const BOX = [
      'border',
      'background',
      'box-shadow',
      'outline',
      'padding',
      'margin',
      'gap',
      'display',
      'width',
      'height',
      'position',
      'inset',
    ]
    const problems: string[] = []
    for (const b of blocks) {
      if (!b.prelude.startsWith('@utility')) continue
      const name = b.prelude.replace(/^@utility\s+/, '')
      const decls = declarationsOf(b.body)
      // A generous backstop: a utility with a dozen declarations is a component by any other name.
      if (decls.length > 6)
        problems.push(
          `${name}: 속성 ${decls.length}개 — 컴포넌트 룩은 프리미티브로 (index.css:${b.line})`,
        )
      for (const d of decls) {
        if (BOX.some((p) => d.prop === p || d.prop.startsWith(`${p}-`)))
          problems.push(
            `${name}: '${d.prop}' 은 내장 유틸리티가 항상 이깁니다 — 동작할 수 없는 규칙입니다 (index.css:${b.line})`,
          )
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('does not redefine .sr-only', () => {
    // Tailwind v4 ships `sr-only`/`not-sr-only`. An unlayered redefinition beats `focus:not-sr-only`,
    // which means the skip link can never become visible on focus.
    expect(css).not.toMatch(/^\s*\.sr-only\s*[,{]/m)
  })

  it('markdown tables keep their table role', () => {
    // `display: block` on a <table> removes it from the accessibility tree as a table — in a
    // product whose regulatory tables are the point. Scrolling belongs on a wrapper element.
    const table = blocks.find((b) => b.prelude === '.md table')
    expect(table, '`.md table` 규칙이 없습니다').toBeDefined()
    const display = declarationsOf(table!.body).find((d) => d.prop === 'display')
    expect(display?.value, '`.md table { display: block }` 은 표의 역할을 없앱니다').not.toBe(
      'block',
    )
  })
})
