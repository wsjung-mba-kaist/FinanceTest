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

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

export function resolveTheme(theme: SettingsState['theme']): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}

/**
 * Applies theme/font/motion settings to the document root.
 * The resolved theme is always stamped (never removed) so the dark palette can be
 * declared once under `[data-theme='dark']`.
 */
export function applySettingsToDocument(s: SettingsState): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(s.theme))
  // A *scale*, never a size. `html { font-size: calc(var(--fs-root) * var(--fs-scale)) }` keeps
  // the base in CSS, so the wide-screen bump and the print size still apply and the user's scale
  // multiplies with them. Writing `style.fontSize` here made an inline rule that beat both.
  root.style.setProperty('--fs-scale', String(s.fontScale))
  // Same contract as the scale above, one level up: an attribute selects a token block and CSS does
  // the arithmetic, so the play screen's tighter subtree and the print reset both still apply.
  root.setAttribute('data-density', s.density)
  root.setAttribute('data-reduced-motion', s.reducedMotion ? 'true' : 'false')
  root.setAttribute('data-system-font', s.useSystemFont ? 'true' : 'false')
}

/** Re-applies the resolved theme when the OS preference changes (theme: 'system'). */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (useSettingsStore.getState().theme === 'system') {
      document.documentElement.setAttribute('data-theme', prefersDark() ? 'dark' : 'light')
    }
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
