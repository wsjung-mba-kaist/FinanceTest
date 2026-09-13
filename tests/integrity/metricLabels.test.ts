import { describe, expect, it } from 'vitest'
import { SCENARIOS, loadAllAvailable } from '@/scenarios'
import { createGame, latestSnapshot } from '@/engine'

/**
 * 한 지표에는 이름이 하나다 — 그리고 그 이름은 저작한 자리에서 온다.
 *
 * 한때 `src/lib/metricContext.ts` 의 `metricLabel()` 이 화면에 나가는 라벨을 덮었다. 「'당일' 은
 * 시간 단위가 하루가 아닌 시나리오에서 틀리다」는 판단은 옳았지만, 고친 자리가 틀렸다:
 *
 *   - 리먼에는 **예금이 없다**(트라이파티 레포·프라임브로커리지라서 `deposits` 조차 '도주성 조달
 *     잔액' 으로 다시 저작했다). 그런데 오버라이드가 «현재 구간 예금 유출» 로 «예금» 을 도로
 *     집어넣었다.
 *   - 크레디트스위스의 `dailyOutflow` 는 `institution.custom` 의 고객자금이고 저작된 이름은
 *     '당일 고객자금 유출' 인데, 같은 오버라이드가 그것도 «예금» 으로 바꿨다.
 *   - 대시보드·도움 시트·스트립이 각자 다르게 적용해서 한 지표에 이름이 셋이 됐다.
 *
 * 지금은 등록부 라벨이 구간 중립이고(«구간 예금 순유출»), 하루 단위 시나리오는 자기 `KpiSpec` 에
 * '당일' 을 저작한다. 이 테스트가 그 둘을 맞춰 둔다.
 */
const scenarios = await loadAllAvailable()
const turnUnitOf = new Map(SCENARIOS.map((s) => [s.summary.id, s.summary.turnUnit]))

/**
 * 「이번 턴 = 하루」를 전제하는 낱말.
 *
 * '일일' 은 일부러 뺐다. `projectedDailyOutflow` 의 '예상 일일 순유출' 은 턴 길이가 아니라
 * **하루당 비율**을 말한다 — `survivalDays = 가용 ÷ 이 값` 이 성립하려면 분모가 하루여야 하고,
 * 그것은 한 턴이 한 시간이든 한 주든 똑같이 맞는 말이다. 잡아야 하는 것은 턴을 하루라고 부르는
 * 말이지, 하루를 단위로 쓰는 말이 아니다.
 */
const TURN_IS_A_DAY_WORDS = ['당일', '익일', '오늘']

describe('metric display names', () => {
  it('never say 당일 / 익일 unless a turn really is a day', () => {
    const problems: string[] = []
    for (const scenario of scenarios) {
      const unit = turnUnitOf.get(scenario.meta.id)
      if (unit === 'day') continue
      for (const spec of scenario.kpis)
        for (const word of TURN_IS_A_DAY_WORDS)
          if (spec.label.includes(word))
            problems.push(
              `${scenario.meta.id} (한 턴 = ${unit}) ${spec.metric}: '${spec.label}' — «${word}»`,
            )
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  /**
   * 등록부 라벨은 **여러 시나리오가 공유한다.** 거기 하루를 박아 두면, 그 행을 쓰는 시나리오 중
   * 턴이 하루가 아닌 것에서 틀린 말이 된다. 하루라고 말해도 되는 것은 하루 단위 시나리오뿐이고,
   * 그 말은 공유 등록부가 아니라 그 시나리오의 `KpiSpec` 에 적는다.
   *
   * 규칙을 「등록부에 '당일' 금지」로 쓰지 않은 이유: `redemptionsPendingPct` 의 '환매 요청(당일,
   * %NAV)' 은 그것을 쓰는 유일한 시나리오(covid-2020-fund)가 하루 단위라 **맞는 말**이다.
   * 잴 것은 문자열이 아니라 «그 화면에서 맞는가» 다.
   */
  it('never renders 당일 in a scenario whose turn is not a day', () => {
    const problems: string[] = []
    for (const scenario of scenarios) {
      const unit = turnUnitOf.get(scenario.meta.id)
      if (unit === 'day') continue
      const snap = latestSnapshot(createGame(scenario, 1)).metrics
      for (const [key, mv] of Object.entries(snap))
        for (const word of TURN_IS_A_DAY_WORDS)
          if (mv.label.includes(word))
            problems.push(`${scenario.meta.id} (한 턴 = ${unit}) ${key}: '${mv.label}'`)
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
})
