import { describe, expect, it } from 'vitest'
import { KPI_EXPLAIN } from '@/content/kpiExplain'

/**
 * 지표 설명은 저작 계층 한 곳에서만 온다.
 *
 * 한때 짧은 단서(집계 기간·단위·기준)만 `src/lib/metricContext.ts` 의 하드코딩 `if` 사슬로 따로
 * 살았다. 결과:
 *
 *   - 같은 지표를 두 곳이 각각 설명했고, `KpiTile` 과 `KpiHelp` 는 **둘 다** 렌더했다.
 *     `abcpMaturing30` 은 두 문장이 거의 글자까지 같아서 도움 시트에 같은 말이 두 번 쌓였다.
 *   - lib 쪽에는 `sourceRef` 도 `cards` 도 없고 콘텐츠 검증기도 타지 않았다.
 *   - 기간을 `/cumulative/i` 같은 **이름 정규식**으로 추측해서, `depositOutflowCum` 처럼 이름이
 *     다른 누적 지표는 조용히 빠졌다.
 *
 * 지금은 `KpiExplain.caveat` 이고, 지표별 기관 변형까지 `kpiExplanation()` 이 한 번에 준다.
 */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const files = Object.entries(SOURCES).filter(
  ([path]) =>
    !path.endsWith('.test.ts') && !path.endsWith('.test.tsx') && !path.includes('__tests__'),
)

describe('metric explanations', () => {
  it('are written nowhere but the content layer', () => {
    const problems: string[] = []
    for (const [metric, explain] of Object.entries(KPI_EXPLAIN)) {
      if (!explain.caveat) continue
      for (const [path, src] of files) {
        if (path.includes('/content/')) continue
        if (src.includes(explain.caveat))
          problems.push(`${path.replace('../../', '')}: ${metric} 의 단서가 복제돼 있습니다`)
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  /**
   * `caveat` 은 `why` 를 줄여 쓴 것이 아니라 **한 줄짜리 기준 표시**다. 길어지기 시작하면 곧
   * 두 번째 `why` 가 되고, 도움 시트에서 같은 말이 두 번 쌓인다. 지금 가장 긴 것이 31자다.
   */
  it('stay one line', () => {
    const long = Object.entries(KPI_EXPLAIN)
      .filter(([, e]) => (e.caveat?.length ?? 0) > 40)
      .map(([metric, e]) => `${metric}: ${e.caveat!.length}자 — ${e.caveat}`)
    expect(long, long.join('\n')).toEqual([])
  })

  /**
   * 되돌아오지 못하게 못을 박는다. `src/lib` 은 지표 이름을 사람 말로 옮기는 자리가 아니다 —
   * 그 일은 시나리오(`KpiSpec.label`)와 콘텐츠(`KPI_EXPLAIN`)가 한다.
   */
  it('do not reappear as a helper in src/lib', () => {
    const offenders = files
      .filter(([path]) => path.includes('/src/lib/'))
      .filter(([, src]) => /export function metric(Label|Context|Explain|Description)/.test(src))
      .map(([path]) => path.replace('../../', ''))
    expect(
      offenders,
      `지표 설명은 저작 계층에 씁니다(KpiSpec.label · KPI_EXPLAIN):\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
