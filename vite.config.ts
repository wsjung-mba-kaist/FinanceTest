/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // `tests/visual/*` drives a real browser against a running dev server. It is a deliberate act
    // (`pnpm test:visual`), not part of the default run: it needs `pnpm dev` up, takes ~20s, and
    // would otherwise skip silently on every CI run and look like it was passing.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/visual/**'],
    setupFiles: ['./tests/setup.ts'],
  },
})
