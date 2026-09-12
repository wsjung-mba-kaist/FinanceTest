import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, settingsSchema } from '../../src/persistence/schema'
import { declarationsOf, parseBlocks, readStylesheet, tokensOf } from '../helpers/css'

/**
 * Density is the second reading axis — how much the reader wants on screen at once — and it is
 * deliberately orthogonal to `--fs-scale`, which answers a question about eyesight.
 *
 * The failure this suite exists to prevent is subtle and has already happened once, one level up:
 * the play screen pinned its own rhythm with an inline `style={{ '--spacing': '0.25rem' }}`, and an
 * inline style outranks every rule, so the setting could never have reached the one screen a user
 * spends 40 minutes on. That is the same trap `style.fontSize` set for the root type size
 * (docs/ui-conventions.md §3). Nothing about it is visible in a snapshot: the markup is fine, the
 * cascade is correct, and the screen simply ignores the control.
 */
const css = readStylesheet()
const blocks = parseBlocks(css)

function tokensAt(prelude: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const b of blocks)
    if (b.prelude === prelude && b.ancestors.length === 0) Object.assign(out, tokensOf(b.body))
  return out
}

const DENSITIES = ['compact', 'normal', 'comfortable'] as const

describe('density tokens', () => {
  it('offers three distinct spacing steps', () => {
    const steps = new Map<string, string>()
    for (const d of DENSITIES) {
      const t = d === 'normal' ? tokensAt(':root') : tokensAt(`:root[data-density='${d}']`)
      const step = t['sp-base']
      expect(step, `${d} 밀도가 --sp-base 를 선언하지 않습니다`).toBeDefined()
      steps.set(d, step!)
    }
    expect(
      new Set(steps.values()).size,
      `밀도 세 단계의 --sp-base 가 겹칩니다: ${[...steps]}`,
    ).toBe(3)
  })

  it('orders them: compact < normal < comfortable', () => {
    const rem = (d: (typeof DENSITIES)[number]): number => {
      const t = d === 'normal' ? tokensAt(':root') : tokensAt(`:root[data-density='${d}']`)
      return Number.parseFloat(t['sp-base']!)
    }
    expect(rem('compact')).toBeLessThan(rem('normal'))
    expect(rem('normal')).toBeLessThan(rem('comfortable'))
  })

  it('moves prose leading with it, and keeps CJK leading generous', () => {
    for (const d of DENSITIES) {
      const t = d === 'normal' ? tokensAt(':root') : tokensAt(`:root[data-density='${d}']`)
      const prose = Number.parseFloat(t['lh-prose']!)
      const body = Number.parseFloat(t['lh-body']!)
      // Hangul carries more per character than Latin; long-form leading must exceed body leading.
      expect(prose, `${d}: --lh-prose 가 --lh-body 보다 좁습니다`).toBeGreaterThan(body)
      expect(prose, `${d}: 한국어 장문에 ${prose} 는 좁습니다`).toBeGreaterThanOrEqual(1.6)
    }
  })

  /** The spacing step must *read* the token, or the whole axis is inert. */
  it('feeds the Tailwind spacing step', () => {
    const theme = blocks.find((b) => b.prelude === '@theme' && b.ancestors.length === 0)
    expect(theme, '@theme 블록이 없습니다').toBeDefined()
    const spacing = tokensOf(theme!.body)['spacing']
    expect(spacing, '--spacing 이 --sp-base 를 읽지 않습니다').toBe('var(--sp-base)')
  })

  /**
   * `@theme`, not `@theme inline`: inline bakes the value into every `calc()` at compile time, and a
   * subtree could then never re-scope the rhythm — which is exactly what the play zone below does.
   */
  it('keeps the spacing step re-scopable by a subtree', () => {
    expect(css).not.toMatch(/@theme\s+inline\s*\{[^}]*--spacing\s*:/)
  })
})

describe('the play zone', () => {
  it('is one step denser than the rest of the app, at every density', () => {
    const zone = blocks.find((b) => b.prelude === "[data-zone='play']")
    expect(zone, "[data-zone='play'] 규칙이 없습니다").toBeDefined()
    expect(zone!.ancestors.join('|'), '계층 밖 규칙은 모든 유틸리티를 이깁니다').toContain('@layer')
    const step = declarationsOf(zone!.body).find((d) => d.prop === '--spacing')
    expect(step, '플레이 존이 --spacing 을 재조정하지 않습니다').toBeDefined()
    // Derived from --sp-base, so it tracks the setting instead of pinning one value.
    expect(step!.value, '플레이 존의 밀도가 --sp-base 와 무관합니다').toContain('var(--sp-base)')
  })

  it('pins nothing with an inline style', () => {
    // Comments stripped first: the rule is worth explaining at the call site, and the explanation
    // naturally quotes the very inline style it replaced.
    const play = readFileSync(resolve(process.cwd(), 'src/pages/PlayPage.tsx'), 'utf8')
    const code = play.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ')
    expect(
      code,
      'PlayPage 가 --spacing 을 인라인으로 씁니다 — 인라인은 설정을 이깁니다',
    ).not.toMatch(/style=\{\{[^}]*--spacing/)
    expect(play, "PlayPage 에 data-zone='play' 가 없습니다").toContain('data-zone="play"')
  })
})

describe('the density setting', () => {
  it('defaults to normal and survives settings saved before it existed', () => {
    expect(DEFAULT_SETTINGS.density).toBe('normal')
    const { density: _omitted, ...legacy } = DEFAULT_SETTINGS
    const parsed = settingsSchema.safeParse(legacy)
    expect(parsed.success, '밀도 필드가 없는 기존 설정이 파싱되지 않습니다').toBe(true)
    expect(parsed.success && parsed.data.density).toBe('normal')
  })

  it('is stamped on the root by the store and by the pre-paint script', () => {
    const store = readFileSync(resolve(process.cwd(), 'src/store/settingsStore.ts'), 'utf8')
    expect(store, 'applySettingsToDocument 가 data-density 를 찍지 않습니다').toContain(
      "setAttribute('data-density'",
    )
    // Without the pre-paint stamp the first frame lays out at one density and the second at another.
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html, 'index.html 의 사전 페인트 스크립트가 밀도를 찍지 않습니다').toContain(
      "setAttribute('data-density'",
    )
  })

  /** Paper is its own density: the printout is already fixed-width and re-flowed. */
  it('resets on paper', () => {
    const printRoot = blocks.find(
      (b) =>
        b.prelude.startsWith(':root') &&
        b.ancestors.some((a) => a.startsWith('@media print')) &&
        Object.hasOwn(tokensOf(b.body), 'sp-base'),
    )
    expect(printRoot, '인쇄 블록이 --sp-base 를 되돌리지 않습니다').toBeDefined()
    expect(printRoot!.prelude, '인쇄 블록이 다크 셀렉터를 함께 적지 않았습니다').toContain(
      "[data-theme='dark']",
    )
  })
})
