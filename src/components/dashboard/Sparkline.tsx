/** Hand-rolled SVG sparkline with an optional dashed threshold line. Text alternative via aria-label. */
export function Sparkline({
  values,
  threshold,
  width = 96,
  height = 28,
  ariaLabel,
}: {
  values: number[]
  threshold?: number
  width?: number
  height?: number
  ariaLabel: string
}) {
  if (values.length < 2) return null
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (threshold !== undefined && Number.isFinite(threshold)) {
    min = Math.min(min, threshold)
    max = Math.max(max, threshold)
  }
  if (max - min < 1e-9) max = min + 1
  const pad = 2
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad)
  const y = (v: number) => height - pad - ((v - min) / (max - min)) * (height - 2 * pad)
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ')
  const last = values[values.length - 1] ?? min
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="shrink-0"
    >
      {threshold !== undefined && Number.isFinite(threshold) && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--sev-warning)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2} fill="var(--accent)" />
    </svg>
  )
}
