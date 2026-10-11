import { useEffect, type ReactNode } from 'react'
import {
  applySettingsToDocument,
  DOCUMENT_SETTING_KEYS,
  useSettingsStore,
  watchSystemTheme,
} from '../store/settingsStore'

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    applySettingsToDocument(useSettingsStore.getState())
    // Re-apply when any key the document reads changes. The list of keys lives next to the
    // function that reads them, not in a dependency array here: the array had `theme`,
    // `fontScale`, `reducedMotion` and `useSystemFont`, and when `density` was added to the
    // function nobody added it here — so the 조밀/여유 radio did nothing until the next reload.
    return useSettingsStore.subscribe((next, prev) => {
      if (DOCUMENT_SETTING_KEYS.some((k) => next[k] !== prev[k])) applySettingsToDocument(next)
    })
  }, [])
  useEffect(() => watchSystemTheme(), [])
  return <>{children}</>
}
