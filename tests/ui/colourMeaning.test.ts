import { describe, expect, it } from 'vitest'
import { dirClass } from '@/components/dashboard/kpiRows'

/** Same source enumeration `primitiveAdoption.test.ts` uses. */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/**
 * Colour says one thing on these screens: **what state the metric is in now**.
 *
 * It used to say two. A status badge is coloured by `ok | warn | breach`; a delta was coloured by
 * `better | worse`. One row could therefore carry a green delta beside a red badge, and a reader had
 * to work out which green meant what. And because the delta's colour was its *only* direction
 * channel, the ~8% of men with a red-green deficiency got no direction at all — on a screen whose
 * other greens and reds mean something different again.
 *
 * Direction is now shape and word (`▲`/`▼` + 개선/악화). Colour is spent on one thing: a change that
 * crossed a threshold band, which is the moment the eye is meant to be pulled.
 */
describe('direction colour', () => {
  it('stays muted unless a threshold band was crossed', () => {
    expect(dirClass('better', false)).toBe('text-muted')
    expect(dirClass('worse', false)).toBe('text-muted')
    expect(dirClass('neutral', true)).toBe('text-muted')
  })

  it('is spent on the crossings', () => {
    expect(dirClass('better', true)).toBe('text-positive')
    expect(dirClass('worse', true)).toBe('text-critical')
  })
})

/**
 * The old map is the thing to keep gone: a `Record<Direction, string>` has no place to put the
 * crossing, so any call site reaching for one is re-introducing colour-by-sign.
 */
describe('no colour-by-sign map', () => {
  it('has no DIR_CLASS lookup left anywhere', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('colourMeaning'))
      .filter(([, src]) => src.includes('DIR_CLASS'))
      .map(([path]) => path)
    expect(
      offenders,
      '방향을 부호만으로 색칠하던 지도입니다. dirClass(dir, crossed) 를 쓰세요.',
    ).toEqual([])
  })
})

/**
 * Every place that colours a direction must also say it in words, or the colour is load-bearing
 * again for anyone who cannot see it.
 */
describe('direction is also spoken', () => {
  const COLOURING = [
    'src/components/dashboard/KpiTile.tsx',
    'src/components/play/ImpactPreview.tsx',
    'src/components/play/LiquidityStrip.tsx',
  ]

  it.each(COLOURING)('%s renders the 개선/악화 word beside the arrow', (file) => {
    const [, src] = Object.entries(SOURCES).find(([path]) =>
      path.endsWith(file.replace('src/', '')),
    )!
    expect(src, `${file} 이 dirClass 를 쓰지 않습니다`).toContain('dirClass(')
    expect(src, `${file} 이 방향을 낱말로 말하지 않습니다`).toContain('DIR_TEXT[')
  })
})
