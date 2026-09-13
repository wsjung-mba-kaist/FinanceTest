import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Threshold, Units } from '@/engine'
import { ThresholdBand } from '@/components/dashboard/ThresholdBand'
import { mergeThresholds } from '@/metrics/thresholds'
import { loadAllAvailable } from '@/scenarios'

/**
 * 없는 근거를 기본값으로 단언하지 않는다.
 *
 * `ThresholdBand` 는 한때 `basis` 가 없으면 «훈련 경고선» 이라고 적었다. 그런데 이 저장소의
 * threshold 중 `basis` 를 저작한 것은 하나도 없어서, 규제로 정해진 선(NCR 100%, CET1 8%,
 * LCR 100%)까지 전부 훈련용 경고선이라고 화면이 말했다 — 같은 타일이 저작된 `referenceLabel` 로
 * «권고 100%» · «내부 기준 100%» 를 적고 있는 동안에. 정확성이 최우선인 제품에서, 규제 최저를
 * 훈련 밴드로 잘못 부르는 것은 아무 말도 하지 않는 것보다 나쁘다.
 *
 * 그래서 근거 낱말은 `basis` 가 실제로 저작됐을 때만 나타난다. 이 테스트는 두 방향을 다 잠근다:
 * 저작하지 않으면 말하지 않고, 저작하면 말한다.
 */
const UNITS: Units = { currency: 'USD', scale: 1e9, display: 'B' }
const BASIS_WORDS = ['훈련 경고선', '규제 기준', '내부 한도']

function renderBand(threshold: Threshold) {
  return render(
    <ThresholdBand
      value={104}
      threshold={threshold}
      unit="%"
      units={UNITS}
      label="유동성커버리지비율(LCR)"
      status="ok"
    />,
  )
}

/** Caption plus accessible name — the two places the word could reach a reader. */
function spoken(): string {
  const img = screen.getByRole('img')
  return `${img.getAttribute('aria-label') ?? ''} ${img.textContent ?? ''}`
}

describe('threshold provenance', () => {
  it('says nothing about provenance when none is authored', () => {
    renderBand({ warn: 105, breach: 100, direction: 'below' })
    const said = spoken()
    for (const word of BASIS_WORDS)
      expect(said, `저작되지 않은 근거를 «${word}» 라고 단언합니다`).not.toContain(word)
    // The band still says what it does know.
    expect(said).toContain('경고')
    expect(said).toContain('위험')
  })

  it.each([
    ['regulatory', '규제 기준'],
    ['internal', '내부 한도'],
    ['simulation', '훈련 경고선'],
  ] as const)('says %s provenance when it is authored', (basis, word) => {
    renderBand({ warn: 105, breach: 100, direction: 'below', basis })
    expect(spoken()).toContain(word)
  })

  it('has no authored provenance to contradict today', async () => {
    // A census, not a rule: if a scenario starts authoring `basis`, this number moves and the
    // change is deliberate. What it guards is the reverse — that the fallback never silently
    // becomes the thing every band says again.
    const withBasis: string[] = []
    for (const scenario of await loadAllAvailable())
      for (const [metric, t] of Object.entries(mergeThresholds(scenario.thresholds)))
        if (t.basis) withBasis.push(`${scenario.meta.id}/${metric}=${t.basis}`)
    expect(
      withBasis.length,
      `근거를 저작한 threshold 가 생겼습니다 — 의도한 변경이면 이 숫자를 갱신하세요:\n${withBasis.join('\n')}`,
    ).toBe(0)
  })
})
