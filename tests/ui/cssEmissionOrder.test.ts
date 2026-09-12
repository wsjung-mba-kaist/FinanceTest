import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { readStylesheet } from '../helpers/css'

/**
 * Runs the real Tailwind compiler over the real stylesheet and inspects the emitted order.
 *
 * This exists because of a bug that was invisible in every other kind of test: `@utility card-key`
 * declared `border`, `background`, `border-radius` and `box-shadow`, and Tailwind emits custom
 * utilities at the **top** of `@layer utilities`, before the built-ins. Same layer, same
 * specificity (0,1,0) ⇒ source order decides ⇒ `rounded-lg border border-border bg-surface`
 * appearing anywhere on the same element silently won, all four properties. `card-key` never once
 * rendered the stronger border it was written for, on any screen, since the day it was added.
 *
 * Nothing about that is observable from jsdom (which applies no stylesheet), from a snapshot, or
 * from reading the source. It is only observable here, in the emitted text.
 */
const PROJECT_ROOT = process.cwd()
const TAILWIND_ENTRY = resolve(PROJECT_ROOT, 'node_modules/tailwindcss/index.css')

/**
 * Every custom `@utility` this project has ever declared, including the three that Phase 1
 * deleted. Asking for a name that no longer exists emits nothing, so the list is safe to keep —
 * and keeping it is what makes the ban below able to fail if a component look is reintroduced.
 */
const SKIP_LINK_CANDIDATES = ['sr-only', 'focus:not-sr-only']

const CUSTOM_CANDIDATES = [
  'prose-col',
  'num-lg',
  'num-md',
  'num',
  'label-caps',
  'card-surface',
  'card-key',
  'card-quiet',
]

/** Candidates chosen so every built-in below collides with a property some custom utility sets. */
const BUILTIN_CANDIDATES = [
  'rounded-lg',
  'rounded-md',
  'border',
  'border-border',
  'border-border-strong',
  'bg-surface',
  'bg-surface-2',
  'shadow-card',
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'font-mono',
  'font-semibold',
  'max-w-prose',
  'text-muted',
]

let emitted = ''

beforeAll(async () => {
  const compiler = await compile(readStylesheet(), {
    base: PROJECT_ROOT,
    loadStylesheet: async (id: string) => {
      if (id !== 'tailwindcss') throw new Error(`예상치 못한 @import: ${id}`)
      return {
        path: TAILWIND_ENTRY,
        base: dirname(TAILWIND_ENTRY),
        content: readFileSync(TAILWIND_ENTRY, 'utf8'),
      }
    },
  })
  emitted = compiler.build([...CUSTOM_CANDIDATES, ...BUILTIN_CANDIDATES, ...SKIP_LINK_CANDIDATES])
})

/** Text of `@layer utilities { … }` in the emitted sheet. */
function utilitiesLayer(): string {
  const start = emitted.indexOf('@layer utilities {')
  expect(start, '@layer utilities 가 방출되지 않았습니다').toBeGreaterThan(-1)
  let depth = 0
  let i = emitted.indexOf('{', start)
  const from = i
  do {
    if (emitted[i] === '{') depth++
    else if (emitted[i] === '}') depth--
    i++
  } while (depth > 0 && i < emitted.length)
  return emitted.slice(from, i)
}

function indexOfRule(layer: string, selector: string): number {
  const i = layer.indexOf(`${selector} {`)
  expect(i, `${selector} 규칙이 방출되지 않았습니다`).toBeGreaterThan(-1)
  return i
}

describe('emitted CSS order', () => {
  it('custom utilities are emitted before the built-ins they share a layer with', () => {
    // Not a wish — a fact about Tailwind v4 we must design around. Asserting it here means the
    // day it stops being true, the two tests below tell us rather than the UI drifting silently.
    const layer = utilitiesLayer()
    const custom = indexOfRule(layer, '.prose-col')
    const builtin = indexOfRule(layer, '.rounded-lg')
    expect(
      custom,
      '커스텀 @utility 가 내장 유틸리티보다 뒤에 방출된다면 이 파일의 전제가 바뀐 것입니다',
    ).toBeLessThan(builtin)
  })

  it('no custom utility can be beaten on border, background or shadow', () => {
    // The consequence of the fact above: a multi-property component look in `@utility` is a rule
    // that loses every collision. Those looks live in React primitives (`Card`), not here.
    const layer = utilitiesLayer()
    const customRules = [...layer.matchAll(/\n {2}\.([a-z0-9-]+) \{([^}]*)\}/g)].filter(
      ([, name]) => CUSTOM_CANDIDATES.includes(name!),
    )
    expect(customRules.length, '커스텀 유틸리티가 하나도 방출되지 않았습니다').toBeGreaterThan(0)
    const broken = customRules
      .filter(([, , body]) => /(^|\s)(border|background|box-shadow)[-:]/.test(body!))
      .map(([, name]) => name!)
    expect(
      broken,
      `이 유틸리티들은 내장 유틸리티에 항상 집니다(방출 순서). 프리미티브로 옮기세요: ${broken.join(', ')}`,
    ).toEqual([])
  })

  /**
   * The skip link, decided in the emitted text rather than by tabbing through a browser.
   *
   * It is `class="sr-only focus:not-sr-only …"`, so becoming visible on focus is purely a question
   * of which rule wins. A local `.sr-only` redefinition — which this project had, unlayered —
   * outranks `focus:not-sr-only` and the link can never appear. `stylesheetLayers` bans the
   * redefinition; this checks the consequence.
   */
  it('lets the skip link become visible on focus', () => {
    const layer = utilitiesLayer()
    const srOnly = indexOfRule(layer, '.sr-only')
    // The emitted selector escapes the variant colon: `.focus\:not-sr-only:focus`.
    const notSrOnly = layer.indexOf('.focus\\:not-sr-only:focus {')
    expect(notSrOnly, 'focus:not-sr-only 가 방출되지 않았습니다').toBeGreaterThan(-1)
    // Same layer, same specificity class ⇒ later wins. `not-sr-only` must come after.
    expect(notSrOnly, '`sr-only` 가 `focus:not-sr-only` 를 이깁니다').toBeGreaterThan(srOnly)
  })

  it('the theme reaches the utilities that read it', () => {
    // `bg-surface` must compile to `var(--surface)` and not be dropped as an unknown colour —
    // a broken `@theme inline` entry produces no rule at all rather than an error.
    const layer = utilitiesLayer()
    expect(layer).toContain('.bg-surface {')
    expect(layer).toContain('var(--surface)')
    expect(layer).toContain('.text-muted {')
    expect(layer).toContain('.border-border {')
  })
})
