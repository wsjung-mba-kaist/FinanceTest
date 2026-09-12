import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { focused, open, serverIsUp, tokens } from './helpers'

/**
 * The checks that only a browser can make.
 *
 * Everything else in this suite runs in jsdom, which applies no stylesheet — so it can see that a
 * class name is present and never that the rule behind it won. Layout, cascade order, focus order
 * and the print palette are all decided by the engine that paints, and this is the only place they
 * are actually observed.
 *
 * It found a real defect on its first run: the route-focus effect fired at startup under
 * StrictMode's double-invoke, so `<main>` already held focus and the very first Tab skipped past
 * the skip link — the exact thing a skip link exists for. `stylesheetLayers` and
 * `cssEmissionOrder` both passed the whole time, because neither is wrong about the CSS. The bug
 * was in JavaScript that moved focus before the user ever pressed a key.
 *
 * Needs `pnpm dev` running; skips cleanly when it is not, so `pnpm test` stays green offline.
 */
const up = await serverIsUp()
let browser: Browser

beforeAll(async () => {
  if (up) browser = await chromium.launch()
}, 60_000)
afterAll(async () => {
  await browser?.close()
})

describe.skipIf(!up)('layout widths in a real browser', () => {
  /**
   * The shell frame grows with the *screen*, not with the type size. Asserting the token in
   * `layoutScale.test.ts` proves the unit; this proves the browser resolves it to the pixels the
   * design intends at each breakpoint.
   */
  it.each([
    [390, 390],
    [768, 768],
    [1024, 1024],
    [1280, 1180],
    [1440, 1320],
    [1920, 1560],
  ])('at %ipx the content frame is %ipx', async (viewport, expected) => {
    const { page, context } = await open(browser, { width: viewport, height: 900 })
    const width = await page.evaluate(() =>
      Math.round(document.getElementById('main')!.getBoundingClientRect().width),
    )
    expect(width).toBe(expected)
    await context.close()
  })

  /**
   * The invariant the whole width/type matrix existed to check: enlarging the text must not take
   * the monitor away, and must widen the reading measure.
   */
  it('holds the frame and moves the measure as the type scale changes', async () => {
    const seen: { scale: number; root: number; frame: number; prose: number }[] = []
    for (const scale of [0.85, 1, 1.3]) {
      const { page, context } = await open(browser, {
        width: 1920,
        height: 1000,
        settings: { fontScale: scale },
      })
      seen.push(
        await page.evaluate(() => ({
          scale: Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--fs-scale'),
          ),
          root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
          frame: Math.round(document.getElementById('main')!.getBoundingClientRect().width),
          prose: Math.round(document.querySelector('.prose-col')!.getBoundingClientRect().width),
        })),
      )
      await context.close()
    }
    const [small, mid, large] = seen

    // The setting reached the document at all — a partial settings object would silently fall
    // back to the defaults and make every row below identical and meaningless.
    expect([small!.scale, mid!.scale, large!.scale]).toEqual([0.85, 1, 1.3])
    expect(small!.root).toBeLessThan(mid!.root)
    expect(mid!.root).toBeLessThan(large!.root)

    // The frame does not move…
    expect(new Set([small!.frame, mid!.frame, large!.frame]).size).toBe(1)
    // …and the measure does.
    expect(small!.prose).toBeLessThan(mid!.prose)
    expect(mid!.prose).toBeLessThan(large!.prose)
  })

  it('never scrolls sideways on a phone', async () => {
    for (const hash of ['', '#/knowledge', '#/progress', '#/settings', '#/knowledge/glossary']) {
      const { page, context } = await open(browser, { width: 390, height: 800, hash })
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `${hash || '/'} 가로 넘침`).toBeLessThanOrEqual(clientWidth)
      await context.close()
    }
  })
})

describe.skipIf(!up)('focus order', () => {
  /**
   * The regression this suite was written to catch.
   *
   * The skip link is `class="sr-only focus:not-sr-only …"`, so it is only ever reachable if (a)
   * the cascade lets it un-hide on focus and (b) nothing has already moved focus into the page.
   * `cssEmissionOrder` covers (a). This covers (b), which is where the bug actually was.
   */
  it('puts the skip link on the very first Tab, visibly', async () => {
    const { page, context } = await open(browser)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

    await page.keyboard.press('Tab')
    const el = await focused(page)
    expect(el?.tag).toBe('A')
    expect(el?.text).toContain('본문으로 건너뛰기')
    // Not merely focused — actually painted. `sr-only` clips to a 1px box.
    expect(el?.clipPath).toBe('none')
    expect(el!.width).toBeGreaterThan(40)
    expect(el!.height).toBeGreaterThan(16)
    await context.close()
  })

  it('moves focus to the new page on a route change', async () => {
    const { page, context } = await open(browser)
    await page.getByRole('link', { name: '지식 베이스', exact: true }).first().click()
    await page.waitForTimeout(400)
    expect((await focused(page))?.id).toBe('main')
    await context.close()
  })
})

describe.skipIf(!up)('print palette', () => {
  /**
   * `@media print :root` is specificity (0,1,0) and `:root[data-theme='dark']` is (0,2,0), so a
   * dark-mode reader used to print 1.22:1 text and solid black blocks onto white paper.
   * `contrast.test.ts` proves the tokens are all redeclared; this proves the browser applies them.
   */
  it('prints on white from the dark theme', async () => {
    const { page, context } = await open(browser, { settings: { theme: 'dark' } })
    const onScreen = await tokens(page, ['--bg', '--text'])
    expect(onScreen['--bg']).toBe('#0e1116')

    await page.emulateMedia({ media: 'print' })
    const onPaper = await tokens(page, ['--bg', '--surface', '--text', '--fs-root'])
    expect(onPaper['--bg']).toBe('#fff')
    expect(onPaper['--surface']).toBe('#fff')
    expect(onPaper['--text']).toBe('#000')
    expect(onPaper['--fs-root']).toBe('11pt')
    await context.close()
  })
})
