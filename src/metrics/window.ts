/**
 * 구간마다 집계가 리셋되는 지표.
 *
 * `engine/fx/bank.ts` 가 `lastOutflow = first ? out : lastOutflow + out` 로 유지한다 — 구간 안에서는
 * 누적되고 구간이 시작하면 0 부터 다시 센다. 그래서 이 값을 **전 턴과 비교하면 안 된다**: 리셋된
 * 값이 이전 구간의 최종 누적보다 작다는 사실은 «개선» 이 아니라 «집계가 다시 시작됐다» 는 뜻이다.
 * 실제로 전 구간 대비 개선으로 표시되던 버그가 있었다.
 *
 * 이 사실이 `src/lib` 이 아니라 여기 있는 이유: 집계 기간은 지표를 **만드는** 쪽이 아는 성질이지
 * 화면이 키 이름으로 추측할 것이 아니다. 새 구간 지표가 생기면 그 행 옆에서 여기에 더한다.
 */
export function isWindowMetric(key: string): boolean {
  return key === 'dailyOutflow' || key === 'dailyOutflowPct'
}
