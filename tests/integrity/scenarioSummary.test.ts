import { describe, expect, it } from 'vitest'
import { SCENARIOS, loadScenario } from '@/scenarios'

/**
 * 목록의 요약은 모듈의 사본이다 — 사본이 어긋나면 조용히 틀린다.
 *
 * `src/scenarios/index.ts` 는 카탈로그가 13개 모듈을 전부 번들에 끌어오지 않도록 `meta` 의 일부를
 * 손으로 베껴 둔다. 정당한 설계지만, 사본에는 **그것이 여전히 사본인지 확인하는 장치가 없었다.**
 * 그리고 하필 그 사본에 `version` 이 들어 있다:
 *
 *   - `HomePage` 는 요약의 `version` 으로 «이어하기» 를 이어할 수 있는지 판단하고,
 *   - `gameStore.restore()` 는 모듈의 `meta.version` 으로 실제로 거절한다.
 *
 * 둘이 어긋나면 화면은 이어할 수 있다고 말하고 복원은 실패한다. 실제로 `els-margin-2020` 과
 * `taeyoung-pf-2024` 를 버전 2 로 올릴 때 두 곳을 손으로 맞춰야 했다 — 한 곳을 잊어도 아무 테스트도
 * 울리지 않았을 것이다.
 *
 * `cardRefs` 의 주석은 이미 "Kept in sync by an integrity test" 라고 적고 있었는데, 그런 테스트는
 * 없었다. 이 파일이 그 문장을 사실로 만든다.
 */
const MIRRORED = [
  'id',
  'version',
  'title',
  'subtitle',
  'era',
  'year',
  'region',
  'role',
  'roleTitle',
  'institutionType',
  'institutionName',
  'difficulty',
  'durationTurns',
  'turnUnit',
  'estMinutes',
  'competencies',
  'tags',
] as const

const available = SCENARIOS.filter((s) => s.load)

describe('scenario registry summaries', () => {
  it.each(available.map((s) => [s.summary.id, s] as const))(
    '%s summary still matches its module',
    async (_id, entry) => {
      const def = await loadScenario(entry.summary.id)
      expect(def, '목록에 있는데 모듈이 없습니다').toBeDefined()
      // 키 순서는 차이가 아니다 — 값만 본다.
      const canon = (v: unknown): string =>
        v !== null && typeof v === 'object' && !Array.isArray(v)
          ? JSON.stringify(Object.entries(v as Record<string, unknown>).sort())
          : JSON.stringify(v)
      const drift: string[] = []
      for (const key of MIRRORED) {
        const a = entry.summary[key]
        const b = def!.meta[key]
        if (canon(a) !== canon(b))
          drift.push(`${key}: 목록 ${JSON.stringify(a)} ≠ 모듈 ${JSON.stringify(b)}`)
      }
      // 요약의 `cardRefs` 는 브리핑이 가르치는 카드의 사본이다.
      if (entry.summary.cardRefs !== undefined)
        if (
          JSON.stringify([...entry.summary.cardRefs].sort()) !==
          JSON.stringify([...def!.briefing.cardRefs].sort())
        )
          drift.push(
            `cardRefs: 목록 ${entry.summary.cardRefs.length}개 ≠ 브리핑 ${def!.briefing.cardRefs.length}개`,
          )
      expect(drift, `${entry.summary.id}\n  ${drift.join('\n  ')}`).toEqual([])
    },
  )

  it('marks every loadable entry available, and every planned entry unloadable', () => {
    const wrong = SCENARIOS.filter(
      (s) => (s.summary.status === 'available') !== Boolean(s.load),
    ).map((s) => `${s.summary.id}: status=${s.summary.status} load=${Boolean(s.load)}`)
    expect(wrong, wrong.join('\n')).toEqual([])
  })
})
