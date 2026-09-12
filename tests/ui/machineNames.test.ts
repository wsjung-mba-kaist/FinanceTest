import { describe, expect, it } from 'vitest'
import {
  INSTITUTION_FIGURE_LABELS,
  INSTITUTION_FIGURE_UNITS,
} from '../../src/content/institutionLabels'

/**
 * Machine names must not reach the screen.
 *
 * The project fixed this once already — engine metric ids (`lcr`, `hqla`) were being shown in a
 * monospace face, which tells the reader "this is code" about a name they can type nowhere. The
 * same defect survived in the generic figure list, which printed object paths verbatim:
 * `firm.liquidityPool`, `external.shortTermDebt`, `redemptions.pendingPct`.
 */
describe('institution figure labels', () => {
  it('are Korean, not object paths', () => {
    for (const [path, label] of Object.entries(INSTITUTION_FIGURE_LABELS)) {
      expect(label, `${path} 의 라벨이 경로 그대로입니다`).not.toBe(path)
      expect(label, `${path} 의 라벨에 점 경로가 남아 있습니다`).not.toMatch(/[a-z]+\.[a-z]/i)
      expect(label.trim().length, `${path} 의 라벨이 비어 있습니다`).toBeGreaterThan(0)
    }
  })

  it('only give units to figures that have one', () => {
    // A unit map entry for a path with no label would be dead: the row is never rendered.
    for (const path of Object.keys(INSTITUTION_FIGURE_UNITS))
      expect(
        INSTITUTION_FIGURE_LABELS[path],
        `${path} 에 단위는 있고 라벨이 없습니다`,
      ).toBeDefined()
  })
})
