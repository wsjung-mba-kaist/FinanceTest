import { create } from 'zustand'
import { DEFAULT_SETTINGS, settingsSchema, type SettingsState } from '../persistence/schema'
import { KEYS, loadValidated, save } from '../persistence/storage'

interface SettingsStore extends SettingsState {
  corruptOnLoad: boolean
  update: (patch: Partial<Omit<SettingsState, 'version'>>) => void
  reset: () => void
}

const loaded = loadValidated(KEYS.settings, settingsSchema)

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...(loaded.value ?? DEFAULT_SETTINGS),
  corruptOnLoad: loaded.corrupt,
  update: (patch) => {
    set(patch)
    const { corruptOnLoad: _c, update: _u, reset: _r, ...rest } = get()
    save(KEYS.settings, rest)
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS })
    save(KEYS.settings, DEFAULT_SETTINGS)
  },
}))

/** Applies theme/font/motion settings to the document root. */
export function applySettingsToDocument(s: SettingsState): void {
  const root = document.documentElement
  if (s.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', s.theme)
  root.style.fontSize = `${Math.round(13 * s.fontScale)}px`
  root.setAttribute('data-reduced-motion', s.reducedMotion ? 'true' : 'false')
  root.setAttribute('data-system-font', s.useSystemFont ? 'true' : 'false')
}
