import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The pre-paint script in `index.html`.
 *
 * It runs before first paint to stamp the resolved theme, so the dark palette applies without a
 * flash. That makes it the one place in the app where a mistake is a *visible* mistake: it used to
 * write `root.style.fontSize = Math.round(14 * scale) + 'px'`, which
 *
 *  - made an inline rule that outranked every media query, killing both the wide-screen type bump
 *    and the print size for the whole session, and
 *  - laid out the first paint at 14px and then re-laid it out, which is a layout shift on the
 *    very first frame the user sees.
 *
 * These assertions are about the *source text* rather than behaviour, because the script cannot be
 * imported — it is an inline `<script>` that runs against a document that does not exist in jsdom.
 */
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const prePaint = html.slice(html.indexOf('<script>'), html.indexOf('</script>'))

describe('pre-paint script', () => {
  it('exists and runs before the app bundle', () => {
    expect(prePaint).toContain('localStorage.getItem')
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('src="/src/app/main.tsx"'))
  })

  it('never writes an inline font size', () => {
    // `style.fontSize` beats `@media (min-width: 1440px)` and `@media print` alike.
    expect(prePaint).not.toMatch(/style\s*\.\s*fontSize/)
    expect(prePaint).not.toMatch(/setProperty\(\s*['"]font-size/)
  })

  it('passes the user scale as a custom property instead', () => {
    expect(prePaint).toContain("setProperty('--fs-scale'")
  })

  it('writes nothing at all at the default scale', () => {
    // `--fs-scale: 1` is already the stylesheet's value, so the common case leaves the first
    // paint free of any inline style — which is what makes its CLS zero rather than nearly zero.
    expect(prePaint).toMatch(/fontScale\s*!==\s*1/)
  })

  it('still stamps the theme pre-paint', () => {
    expect(prePaint).toContain("setAttribute('data-theme'")
    expect(prePaint).toContain('prefers-color-scheme: dark')
  })

  it('falls back to light if anything throws', () => {
    // localStorage can throw outright (private mode, blocked site data). A theme of "none" would
    // paint unstyled text on an unstyled background.
    expect(prePaint).toMatch(/catch\s*\([\s\S]*?\)\s*\{[\s\S]*?data-theme[\s\S]*?light/)
  })
})
