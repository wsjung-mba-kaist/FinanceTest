import type { MetricSnapshot } from '../engine/types/metrics'
import type { Units } from '../engine/types/common'
import { formatMetric } from './format'

const TOKEN = /\{\{metric:([a-zA-Z0-9_.]+)\}\}/g

/**
 * Replaces `{{metric:key}}` tokens in authored text with the formatted current metric value,
 * so memos and data tables can quote live figures ("마감 잔고 −$1.0B") without hard-coding them.
 */
export function fillMetricTemplates(
  text: string,
  snapshot: MetricSnapshot | undefined,
  units: Units,
): string {
  if (!text.includes('{{metric:')) return text
  return text.replace(TOKEN, (_m, key: string) => {
    const v = snapshot?.metrics[key]
    if (!v || !Number.isFinite(v.value)) return '—'
    return formatMetric(v.value, v.unit, units)
  })
}
