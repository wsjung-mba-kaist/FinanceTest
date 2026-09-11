import { useEffect, type ReactNode } from 'react'
import { applySettingsToDocument, useSettingsStore } from '../store/settingsStore'

export function Providers({ children }: { children: ReactNode }) {
  const settings = useSettingsStore()
  useEffect(() => {
    applySettingsToDocument(settings)
  }, [settings.theme, settings.fontScale, settings.reducedMotion, settings.useSystemFont]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children}</>
}
