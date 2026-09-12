import { Icon } from '../ui/Icon'

/**
 * Why the clock is not moving, said out loud.
 *
 * `holdReason` reached the screen only as the `title` of a 26px play/pause button — a tooltip that
 * needs a hover and a second of patience, on a live-clock screen where the whole question is
 * "why isn't time passing". A screen-reader user got it from the button's accessible name; a
 * sighted user got nothing. That is backwards.
 *
 * The one exception is the hidden-tab hold: nobody is looking at the page when it fires, and by
 * the time they are it has already cleared.
 */
const SILENT = '화면이 비활성 상태입니다'

export function HoldRibbon({ reason, intent }: { reason?: string; intent: boolean }) {
  // A hold is only worth naming when the player *wants* the clock running. If they paused it
  // themselves, the pause button already says so and a ribbon would be nagging.
  if (!reason || !intent || reason === SILENT) return null
  return (
    <p
      role="status"
      className="flex min-h-tap-dense shrink-0 items-center gap-1.5 border-b border-warning-border bg-warning-bg px-3 text-sm text-warning"
    >
      <Icon name="pause" size={14} />
      {reason}
    </p>
  )
}
