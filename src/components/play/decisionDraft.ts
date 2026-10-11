/**
 * 한 결정에 대해 플레이어가 «아직 확정하지 않고 적어 둔 것».
 *
 * `DecisionBlock` 은 열린 결정 하나만 마운트되고 `key` 가 결정 id 라, 다른 결정을 열었다 돌아오면
 * 통째로 새로 만들어진다. 예전에는 그래서 잃는 것이 메모 하나였는데, 판단 기록 세 칸이 생기면서
 * 한 번의 전환으로 네 칸이 사라지고 응답 시간까지 처음부터 다시 시작했다. 한 턴에 결정이 둘
 * 이상 열리는 시나리오에서 실제로 밟는 경로다. 그래서 초안은 독(dock)이 들고 있는다.
 */
export interface DecisionDraft {
  memo: string
  reasoning: { evidence: string; assumption: string; reconsiderWhen: string }
  /** 이 결정에 실제로 머문 시간의 합. 디브리핑의 «소요 N초» 가 이 값이다. */
  elapsedMs: number
  /** 이미 태운 응답 예산. 돌아왔을 때 처음부터가 아니라 남은 만큼으로 재개한다. */
  burnedMs: number
}

export const EMPTY_DRAFT: DecisionDraft = {
  memo: '',
  reasoning: { evidence: '', assumption: '', reconsiderWhen: '' },
  elapsedMs: 0,
  burnedMs: 0,
}
