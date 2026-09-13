/** A flow over a partial turn cannot be compared with the previous completed turn. */
export function isWindowMetric(key: string): boolean {
  return key === 'dailyOutflow' || key === 'dailyOutflowPct'
}

export function metricContext(key: string): string | undefined {
  if (isWindowMetric(key)) return '현재 구간 누적 · 구간 시작 때 집계 초기화'
  if (/cumulative/i.test(key)) return '시나리오 시작 이후 누적'
  if (key === 'projectedDailyOutflow') return '현재 조건에 따른 향후 1일 추정 · 확정 지급액 아님'
  if (key === 'survivalDays') return '현재 유출 속도 기준 추정 · 결제 마감까지의 시간 아님'
  if (key === 'lcr') return '30일 스트레스 기준 · 당일 결제 여력은 별도 확인'
  if (key === 'facilityHeadroom') return '인출 가능한 한도 · 인출 전에는 현금에 포함되지 않음'
  if (key === 'facilityPending') return '다음 구간 반영 예정 · 현재 현금에 포함되지 않음'
  if (key === 'confidence') return '시뮬레이션 신뢰지수 · 실제 관측 통계 아님'
  return undefined
}

/** Labels that remain correct when a scenario uses hourly, daily or weekly turns. */
export function metricLabel(key: string, fallback: string): string {
  if (key === 'dailyOutflow') return '현재 구간 예금 유출'
  if (key === 'dailyOutflowPct') return '현재 구간 유출률'
  return fallback
}
