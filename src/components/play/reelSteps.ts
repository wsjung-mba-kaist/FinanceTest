/**
 * Presentation constants for the consequence reel.
 *
 * U1 built the beats on the client; milestone L2 moved that to `engine/core/reel.ts`, which emits
 * the very same union. The types are re-exported from the engine so every importer keeps working
 * and the two shapes can never drift apart again.
 */
export type { ConsequenceReel, ReelStep } from '../../engine'
export { REEL_STEP_MS } from '../../engine'

import type { ReelStep } from '../../engine'

export const REEL_STEP_TITLES: Record<ReelStep['kind'], string> = {
  metrics: '지표 변화',
  consequence: '결과',
  market: '시장 반응',
  reaction: '감독·이사회 반응',
}

export const REACTION_LABELS: Record<'regulator' | 'board' | 'counterparty', string> = {
  regulator: '감독당국',
  board: '이사회',
  counterparty: '거래상대',
}
