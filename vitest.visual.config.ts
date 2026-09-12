/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * The browser-driven checks, kept out of the default run.
 *
 * These are the assertions jsdom cannot make — layout at each breakpoint, which cascade rule won,
 * what the very first Tab focuses, what the print stylesheet resolves to. They drive Chromium
 * against a running dev server, so they are a deliberate act rather than part of `pnpm test`:
 *
 *   pnpm dev            # in one terminal
 *   pnpm test:visual    # in another
 *
 * No `environment: jsdom` and no setup file — a real browser is the environment, and importing
 * Testing Library's DOM cleanup here would only add a second, fake document.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/visual/**/*.test.ts'],
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One browser, one dev server: parallel files would fight over both.
    fileParallelism: false,
  },
})
