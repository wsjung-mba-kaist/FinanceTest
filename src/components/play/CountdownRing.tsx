function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** SVG countdown arc. Tone shifts to warning at 30s and critical at 10s (with a text label, never colour alone). */
export function CountdownRing({
  remainingMs,
  totalMs,
  paused,
  size = 48,
}: {
  remainingMs: number
  totalMs: number
  paused?: boolean
  size?: number
}) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0
  const secs = Math.ceil(remainingMs / 1000)
  const tone =
    secs <= 10 ? 'var(--sev-critical)' : secs <= 30 ? 'var(--sev-warning)' : 'var(--accent)'
  const label = paused ? '일시정지' : `남은 시간 ${formatRemaining(remainingMs)}`
  return (
    <div
      className="flex items-center gap-1.5"
      role="timer"
      aria-live="off"
      aria-label={label}
      title={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={size * 0.26}
          fontFamily="var(--font-mono)"
          fill="var(--text)"
        >
          {paused ? '∥' : formatRemaining(remainingMs)}
        </text>
      </svg>
    </div>
  )
}
