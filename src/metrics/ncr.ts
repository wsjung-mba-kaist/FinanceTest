/**
 * 순자본비율 (NCR, Net Capital Ratio) — 금융투자업자 건전성 지표.
 *
 * Sources
 * - 금융투자업규정 제3-6조 (영업용순자본), 제3-7조~제3-10조 (총위험액: 시장위험액, 신용위험액,
 *   운영위험액), 2016 신NCR 개편 (필요유지자기자본 기준).
 * - 금융투자업규정 제3-26조 (적기시정조치): 순자본비율 100% 미만 → 경영개선권고, 50% 미만 →
 *   경영개선요구, 0% 미만 → 경영개선명령.
 *
 *   netOperatingCapital (영업용순자본) = equityCapital − deductions + additions
 *   totalRisk (총위험액)               = market + credit + operational
 *   ncr (신NCR)    = (netOperatingCapital − totalRisk) / requiredCapital × 100
 *   ncrOld (구NCR) = netOperatingCapital / totalRisk × 100
 *   actionLevel    = ncr < 0 → 'order', < 50 → 'require', < 100 → 'recommend', else 'none'
 *
 * Zero denominators give NaN; a NaN ncr maps to actionLevel 'none' (no comparison is true).
 * Never throws.
 */
import type { NcrInput, NcrResult } from './types'

/** 적기시정조치 발동 기준 (순자본비율 %, 미만). */
export const NCR_ACTION_THRESHOLDS = {
  recommend: 100,
  require: 50,
  order: 0,
} as const

export function ncrActionLevel(ncr: number): NcrResult['actionLevel'] {
  if (ncr < NCR_ACTION_THRESHOLDS.order) return 'order'
  if (ncr < NCR_ACTION_THRESHOLDS.require) return 'require'
  if (ncr < NCR_ACTION_THRESHOLDS.recommend) return 'recommend'
  return 'none'
}

export function computeNcr(input: NcrInput): NcrResult {
  const netOperatingCapital = input.equityCapital - input.deductions + input.additions
  const totalRisk = input.risk.market + input.risk.credit + input.risk.operational
  const ncr =
    input.requiredCapital === 0
      ? NaN
      : ((netOperatingCapital - totalRisk) / input.requiredCapital) * 100
  const ncrOld = totalRisk === 0 ? NaN : (netOperatingCapital / totalRisk) * 100

  return { netOperatingCapital, totalRisk, ncr, ncrOld, actionLevel: ncrActionLevel(ncr) }
}
