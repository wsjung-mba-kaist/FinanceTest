import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Providers } from '../../src/app/providers'
import { useSettingsStore } from '../../src/store/settingsStore'

/**
 * A setting is a contract: change the value and the document follows, now. The density radio
 * used to do nothing until the next reload because the effect that stamps the root listed four
 * of the five keys it depends on. This test flips every document-facing setting through the
 * store and reads the root back — the way the settings page does it, and the way the bug showed.
 */
describe('settings reach the document live', () => {
  const root = () => document.documentElement

  beforeEach(() => {
    useSettingsStore.getState().reset()
  })
  afterEach(() => {
    useSettingsStore.getState().reset()
  })

  it('stamps density, theme, scale, motion and font the moment they change', () => {
    render(<Providers>{null}</Providers>)
    expect(root().getAttribute('data-density')).toBe('normal')

    act(() => useSettingsStore.getState().update({ density: 'compact' }))
    expect(root().getAttribute('data-density')).toBe('compact')

    act(() => useSettingsStore.getState().update({ theme: 'dark' }))
    expect(root().getAttribute('data-theme')).toBe('dark')

    act(() => useSettingsStore.getState().update({ fontScale: 1.15 }))
    expect(root().style.getPropertyValue('--fs-scale')).toBe('1.15')

    act(() => useSettingsStore.getState().update({ reducedMotion: true }))
    expect(root().getAttribute('data-reduced-motion')).toBe('true')

    act(() => useSettingsStore.getState().update({ useSystemFont: true }))
    expect(root().getAttribute('data-system-font')).toBe('true')
  })

  it('does not touch the document for a setting it does not read', () => {
    render(<Providers>{null}</Providers>)
    act(() => useSettingsStore.getState().update({ density: 'comfortable' }))
    const snapshot = root().outerHTML
    act(() => useSettingsStore.getState().update({ timersEnabled: false }))
    expect(root().outerHTML).toBe(snapshot)
  })
})
