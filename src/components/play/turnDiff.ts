import type { GameState, MetricDelta, MetricStatus, ScenarioDefinition } from '../../engine'
import { latestSnapshot } from '../../engine'

const STATUS_RANK: Record<MetricStatus, number> = { na: 0, ok: 1, warn: 2, breach: 3 }

/**
 * Everything that moved since the previous turn, worst first.
 *
 * The situation column is supposed to answer "what just happened", and until now the only thing
 * that ever said so was the consequence reel — which plays once, over a few seconds, and is then
 * gone. A reader who looked away, took a phone call, or came back to the tab had no way to ask the
 * question again; the dashboard shows where the numbers *are*, not what they just did.
 *
 * No new computation: `metricsHistory` already holds one full snapshot per turn, so this is the
 * difference between two objects the engine has been keeping all along.
 */
export function turnDiff(scenario: ScenarioDefinition, state: GameState): MetricDelta[] {
  const current = latestSnapshot(state)
  const previous = state.metricsHistory.find((m) => m.turnIndex === state.turnIndex - 1)
  if (!previous) return []
  const specs = new Map(scenario.kpis.map((k) => [k.metric, k]))

  const out: MetricDelta[] = []
  for (const [key, now] of Object.entries(current.metrics)) {
    const before = previous.metrics[key]
    if (!before || !Number.isFinite(now.value) || !Number.isFinite(before.value)) continue
    if (Math.abs(now.value - before.value) < 1e-9) continue
    out.push({
      key,
      label: specs.get(key)?.label ?? now.label,
      unit: now.unit,
      before: before.value,
      after: now.value,
      delta: now.value - before.value,
      statusBefore: before.status,
      statusAfter: now.status,
    })
  }

  // A band crossing first, then the worst state landed in, then the largest relative move. Same
  // ranking `ImpactPreview` uses, for the same reason: the reader has a handful of lines of
  // attention and the row that changed state is the one they must not miss.
  return out
    .sort((a, b) => {
      const crossed = Number(b.statusBefore !== b.statusAfter) - Number(a.statusBefore !== a.statusAfter)
      if (crossed !== 0) return crossed
      const worst = STATUS_RANK[b.statusAfter] - STATUS_RANK[a.statusAfter]
      if (worst !== 0) return worst
      return Math.abs(b.delta / (b.before || 1)) - Math.abs(a.delta / (a.before || 1))
    })
    .slice(0, 6)
}
