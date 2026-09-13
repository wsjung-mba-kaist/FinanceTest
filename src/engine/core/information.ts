import type { EventInformation, Turn } from '../types'

export function isInformationTimestamp(value: string | undefined): boolean {
  return Boolean(
    value && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
  )
}

/** Never infer a timezone from a display label. Undated legacy scenarios retain their old view. */
export function informationTime(turn: Turn, tick: number): number {
  const time = turn.tickTimes?.[tick] ?? turn.time
  return isInformationTimestamp(time) ? Date.parse(time!) : NaN
}

export function informationReleased(turn: Turn, tick: number, info?: EventInformation): boolean {
  if (!info) return true
  const now = informationTime(turn, tick)
  const known = isInformationTimestamp(info.knownAt) ? Date.parse(info.knownAt) : NaN
  return Number.isFinite(now) && Number.isFinite(known) && known <= now
}
