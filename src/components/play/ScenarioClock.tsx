/** Scenario clock: local time label of the current turn and `T+n/N` progress. */
export function ScenarioClock({
  timeLabel,
  turnIndex,
  durationTurns,
  turnLabel,
  compact,
}: {
  timeLabel: string
  turnIndex: number
  durationTurns: number
  turnLabel?: string
  compact?: boolean
}) {
  const progress = `T+${turnIndex}/${Math.max(0, durationTurns - 1)}`
  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap text-sm text-muted"
      role="group"
      aria-label={`시나리오 시계 ${timeLabel}, ${progress}`}
    >
      {!compact && <span aria-hidden="true">◷</span>}
      {!compact && <span className="text-text">{timeLabel}</span>}
      <span
        className="num rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-text"
        title={turnLabel}
      >
        {progress}
      </span>
    </div>
  )
}
