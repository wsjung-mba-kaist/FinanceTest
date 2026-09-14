import { describe, expect, it } from 'vitest'

/**
 * AFS 평가손실을 회계자본에서 **다시** 빼지 않는다.
 *
 * 미실현 AFS 손실은 AOCI 를 거쳐 이미 회계상 보통주자본에 들어 있다. 규제 CET1 에서 빠져 있는
 * 것(미국 AOCI 옵트아웃)과는 다른 말인데, 이 둘을 섞으면 자본을 두 번 깎게 된다. 실제로
 * `(AFS + HTM) × (1 − 세율)` 을 자본에서 빼는 예시가 저작돼 있었고, SVB 양식화 계산이
 * `12.7 − (2.5 + 15.1) × (1 − 25%) ≈ 0` 으로 적혀 있었다. 올바른 값은 약 1.4($B) 다.
 *
 * 그 자체로도 틀렸지만 더 나쁜 것은 **훈련자의 판단을 바꾼다**는 점이다. 자본이 이미 0 이라고
 * 읽으면 증자·매각의 선택지가 사라진다.
 *
 * 한 번 고친 뒤에도 같은 산술이 다른 문서에 살아남아 있었다(형식 설명은 고쳐졌는데 두 문단
 * 아래의 계산 예시는 그대로였다). 문장을 고치는 것과 예시를 고치는 것은 다른 일이다.
 */
const CONTENT = import.meta.glob('../../src/content/**/*.{ts,md}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const SCENARIOS = import.meta.glob('../../src/scenarios/**/*.{ts,md}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const files = Object.entries({ ...CONTENT, ...SCENARIOS }).filter(
  ([path]) => !path.includes('.test.'),
)

/** `(AFS + HTM …) ×` — 둘을 묶어 한 번에 세후로 차감하는 꼴. */
const SYMBOLIC = /\(\s*AFS\s*[+＋]\s*HTM[^)]*\)\s*[×*]/
/** `− (2.5 + 15.1) × (1 − 25%)` — 같은 것을 숫자로 쓴 꼴. */
const NUMERIC = /[−-]\s*\(\s*[\d.]+\s*[+＋]\s*[\d.]+\s*\)\s*[×*]\s*\(\s*1\s*[−-]/

describe('capital arithmetic in authored content', () => {
  it('never deducts AFS and HTM unrealized losses as one after-tax block', () => {
    const offenders = files
      .filter(([, src]) => SYMBOLIC.test(src) || NUMERIC.test(src))
      .map(([path]) => path.replace('../../', ''))
    expect(
      offenders,
      `AFS 손실은 회계자본에 이미 들어 있습니다 — HTM 만 차감하세요:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  /**
   * 반대 방향의 못: 이 사실을 설명하는 문서가 하나도 없으면, 위 규칙은 지켜지지만 아무도
   * 이유를 모르게 된다.
   */
  it('says somewhere why it is not deducted twice', () => {
    const explains = files.filter(([, src]) => src.includes('중복 차감'))
    expect(explains.length, '중복 차감을 경고하는 설명이 사라졌습니다').toBeGreaterThan(0)
  })
})
