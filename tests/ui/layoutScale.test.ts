import { describe, expect, it } from 'vitest'
import { parseBlocks, readStylesheet, tokensOf } from '../helpers/css'

/**
 * The width/type matrix, mechanised.
 *
 * The plan called for sweeping 390 / 768 / 1024 / 1280 / 1440 / 1920 × light·dark × type scale
 * 0.85 / 1.0 / 1.3 by eye, checking one thing: **the shell width must not move with the type
 * scale, and the reading measure must.** That is not a matter of taste — it follows from the unit
 * each token is written in, so it can be asserted here instead of being re-checked by hand every
 * time someone touches the stylesheet.
 *
 * What is still left for eyes is what a browser actually paints: whether the result *looks* right.
 * This only guarantees the arithmetic underneath it cannot drift.
 */
const blocks = parseBlocks(readStylesheet())

/** Token values from `:root`, plus whatever the named media query overrides. */
function rootAt(mediaPrelude?: string): Record<string, string> {
  const base = blocks.filter((b) => b.prelude === ':root' && b.ancestors.length === 0)
  const out: Record<string, string> = {}
  for (const b of base) Object.assign(out, tokensOf(b.body))
  if (!mediaPrelude) return out
  // *Every* `:root` under that query, in source order — both 1440 and 1800 appear twice, once for
  // the type base and once for the widths, and taking only the first would silently answer with
  // the wrong block. (They are the same two numbers on purpose: the frame and the text grow at the
  // same screen widths, which they did not when the widths bumped at 1400 and the type at 1440.)
  for (const b of blocks)
    if (b.prelude === ':root' && b.ancestors.join('|') === mediaPrelude)
      Object.assign(out, tokensOf(b.body))
  return out
}

const FRAME_TOKENS = ['w-shell', 'w-doc']
const MEASURE_TOKENS = ['w-prose', 'w-prose-wide', 'w-play-col']

describe('layout width tokens', () => {
  it('declares every width the layout reads', () => {
    const root = rootAt()
    for (const t of [...FRAME_TOKENS, ...MEASURE_TOKENS])
      expect(root[t], `--${t} 이 선언되지 않았습니다`).toBeDefined()
  })

  /**
   * Frames are px, so a reader at 1.3× type scale keeps the same amount of monitor. Writing
   * `--w-shell` in rem would have taken a third of their screen away the moment they enlarged the
   * text — the opposite of what enlarging it is for.
   */
  it('measures the frame in px at every breakpoint', () => {
    for (const at of [undefined, '@media (min-width: 1440px)', '@media (min-width: 1800px)']) {
      const root = rootAt(at)
      for (const t of FRAME_TOKENS) {
        expect(root[t], `--${t} @ ${at ?? ':root'}`).toMatch(/^\d+px$/)
      }
    }
  })

  /**
   * Measures are em, so 44 글자 stays 44 글자 at any scale. In px the line would hold *fewer*
   * characters as the type grew, which is exactly backwards.
   */
  it('measures the reading column in em', () => {
    const root = rootAt()
    for (const t of MEASURE_TOKENS) expect(root[t], `--${t}`).toMatch(/^[\d.]+em$/)
  })

  it('widens the frame monotonically', () => {
    const steps = [undefined, '@media (min-width: 1440px)', '@media (min-width: 1800px)']
    for (const t of FRAME_TOKENS) {
      const values = steps.map((at) => Number.parseFloat(rootAt(at)[t]!))
      for (let i = 1; i < values.length; i++)
        expect(values[i]!, `--${t}: ${values.join(' → ')}`).toBeGreaterThan(values[i - 1]!)
    }
  })

  it('keeps the document frame narrower than the shell', () => {
    // A 616px reading column inside a 1560px frame reads worse than inside a 960px one: the
    // leftover width becomes a moat rather than content.
    for (const at of [undefined, '@media (min-width: 1440px)', '@media (min-width: 1800px)']) {
      const root = rootAt(at)
      expect(
        Number.parseFloat(root['w-doc']!),
        `--w-doc vs --w-shell @ ${at ?? ':root'}`,
      ).toBeLessThan(Number.parseFloat(root['w-shell']!))
    }
  })
})

describe('root type scale', () => {
  /**
   * The wide-screen bump and the user's 글자 크기 setting are different questions and multiply.
   * JS writes only `--fs-scale`; an inline `style.fontSize` outranks every media query and is what
   * killed both the bump and the print size.
   */
  it('is a product of a screen-size base and a user scale', () => {
    const html = blocks.find((b) => b.prelude === 'html' && b.ancestors.includes('@layer base'))
    expect(html, '`html` 규칙이 @layer base 에 없습니다').toBeDefined()
    const fontSize = html!.body.match(/font-size:\s*([^;]+)/)?.[1]?.trim()
    expect(fontSize).toBe('calc(var(--fs-root) * var(--fs-scale))')
  })

  it('defaults the user scale to 1 so the first paint needs no inline style', () => {
    expect(rootAt()['fs-scale']).toBe('1')
  })

  it('bumps the base on wide screens and for print, never the scale', () => {
    const wide = rootAt('@media (min-width: 1440px)')
    const wider = rootAt('@media (min-width: 1800px)')
    expect(Number.parseFloat(wide['fs-root']!)).toBeGreaterThan(
      Number.parseFloat(rootAt()['fs-root']!),
    )
    expect(Number.parseFloat(wider['fs-root']!)).toBeGreaterThan(
      Number.parseFloat(wide['fs-root']!),
    )
    // Print sets a point size, and leaves `--fs-scale` alone so the reader's setting still applies.
    const print = blocks.find(
      (b) => b.ancestors.join('|') === '@media print' && b.prelude.includes(':root'),
    )
    const printTokens = tokensOf(print!.body)
    expect(printTokens['fs-root']).toMatch(/pt$/)
    expect(printTokens['fs-scale'], '인쇄가 사용자 글자 크기를 덮으면 안 됩니다').toBeUndefined()
  })
})
