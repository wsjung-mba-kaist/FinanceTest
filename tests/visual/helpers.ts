import type { Browser, BrowserContext, Page } from 'playwright'
import { STORAGE_VERSION } from '../../src/persistence/schema'
import type { SettingsState } from '../../src/persistence/schema'

/**
 * The dev server these checks drive. They are the tests that need a *browser* — layout, the
 * cascade, focus order, the print stylesheet — so they run against a running app rather than jsdom,
 * which applies no stylesheet at all and therefore cannot see any of it.
 */
export const BASE_URL = process.env.VISUAL_BASE_URL ?? 'http://localhost:5173'

/** Is the dev server up? The suite skips rather than fails when it is not. */
export async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * A complete, schema-valid settings object.
 *
 * Writing a partial one is a trap worth naming: `loadValidated` runs it through zod and falls back
 * to the defaults on any failure, silently — so a probe that omits a field, or gets
 * `STORAGE_VERSION` wrong, measures the default settings while believing it measured its own. That
 * cost two rounds of confusing output before it was spotted, which is why the version is imported
 * here rather than typed as a literal.
 */
export function settings(overrides: Partial<SettingsState> = {}): SettingsState {
  return {
    version: STORAGE_VERSION,
    theme: 'light',
    termDisplay: 'ko-en',
    fontScale: 1,
    reducedMotion: false,
    rationaleReveal: 'mode',
    timersEnabled: true,
    useSystemFont: false,
    defaultMode: 'guided',
    ...overrides,
  }
}

export interface OpenOptions {
  width?: number
  height?: number
  hash?: string
  settings?: Partial<SettingsState>
}

/** Opens a page with the given viewport and stored settings, already settled. */
export async function open(
  browser: Browser,
  opts: OpenOptions = {},
): Promise<{ page: Page; context: BrowserContext }> {
  const { width = 1280, height = 800, hash = '', settings: s = {} } = opts
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  await page.addInitScript(
    (value) => localStorage.setItem('fcs:settings', JSON.stringify(value)),
    settings(s),
  )
  await page.goto(`${BASE_URL}/${hash}`, { waitUntil: 'networkidle' })
  // The shell's lazy routes resolve a tick after `networkidle`.
  await page.waitForTimeout(300)
  return { page, context }
}

/** Custom property values resolved on `<html>`, as the browser actually computed them. */
export async function tokens(page: Page, names: string[]): Promise<Record<string, string>> {
  return page.evaluate((keys) => {
    const cs = getComputedStyle(document.documentElement)
    const out: Record<string, string> = {}
    for (const k of keys) out[k] = cs.getPropertyValue(k).trim()
    return out
  }, names)
}

/** What the focused element is, in the terms these assertions care about. */
export async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return null
    const box = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName,
      id: el.id,
      text: (el.textContent ?? '').trim().slice(0, 40),
      width: Math.round(box.width),
      height: Math.round(box.height),
      clipPath: cs.clipPath,
    }
  })
}
