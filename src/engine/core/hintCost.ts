/**
 * 힌트 감점표 — 증분 하나, 누적은 그것에서 나온다.
 *
 * 이 표는 세 자리에 각각 하드코딩돼 있었다. 화면에 «−2/−4/−8점» 이라고 찍는 쪽은
 * `HINT_COSTS`(증분)를 읽었고, 실제로 깎는 쪽과 저장 기록을 되살리는 쪽은 `[0, 2, 6, 14]`(누적)를
 * 각자 적어 두고 있었다. 둘은 같은 수를 다르게 적은 것이라, 하나를 고치면 나머지가 조용히
 * 어긋난다 — 그것도 **점수 경로**에서.
 *
 * 그리고 이 자리가 `src/store` 가 아니라 엔진인 이유: `replay()` 가 읽어야 한다. 구형 저장 기록은
 * 결정별 감점을 적어 두지 않았으므로 당시 모드와 사용 단계로 되살리는데, 엔진은 스토어를
 * 가져올 수 없다. 양쪽이 필요한 것은 위로 올라가지 않고 아래로 내려온다.
 */
export const HINT_COSTS: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 8 }

/** `hintsUsed` 단계까지 누적된 감점. `CUMULATIVE_HINT_COST[0]` 은 0이다. */
export const CUMULATIVE_HINT_COST: readonly number[] = [
  0,
  HINT_COSTS[1],
  HINT_COSTS[1] + HINT_COSTS[2],
  HINT_COSTS[1] + HINT_COSTS[2] + HINT_COSTS[3],
]

/** 이미 `from` 단계까지 본 사람이 `to` 단계를 여는 데 드는 추가 감점. 단계를 건너뛰어도 맞는다. */
export function hintCostBetween(from: number, to: number): number {
  const at = (n: number) => CUMULATIVE_HINT_COST[Math.max(0, Math.min(n, 3))] ?? 0
  return Math.max(0, at(to) - at(from))
}
