import { useCallback, useState } from 'react'

/**
 * A live-region message that repeats.
 *
 * `setAnnounce('결정을 확정했습니다')` twice in a row is two identical strings, so React bails out
 * of the update, the DOM text never changes, and the screen reader says nothing the second time.
 * Confirming two decisions on one turn announced the first and silently swallowed the second —
 * and confirming *is* the moment that most needs confirming.
 *
 * A sequence number attached to the message makes every call a new value. The number never
 * reaches the user: `LiveRegion` renders `message`, and `seq` only exists to force the re-render.
 */
export interface Announcement {
  message: string
  seq: number
}

export function useAnnouncer(): [Announcement, (message: string) => void] {
  const [value, setValue] = useState<Announcement>({ message: '', seq: 0 })
  const announce = useCallback((message: string) => {
    setValue((prev) => ({ message, seq: prev.seq + 1 }))
  }, [])
  return [value, announce]
}
