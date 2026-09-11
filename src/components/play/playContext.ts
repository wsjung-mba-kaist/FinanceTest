import { createContext, useContext } from 'react'
import type { GameState, Mode, ScenarioDefinition, TurnView } from '../../engine'
import type { RunInfo } from '../../store/gameStore'

/** Read-only play snapshot shared by the feed, decision panel, dashboard and drawer. */
export interface PlayContextValue {
  scenario: ScenarioDefinition
  state: GameState
  /** State at the start of each turn (index = turn index). */
  history: GameState[]
  run: RunInfo
  mode: Mode
  view: TurnView
}

export const PlayContext = createContext<PlayContextValue | null>(null)

export function usePlay(): PlayContextValue {
  const v = useContext(PlayContext)
  if (!v) throw new Error('usePlay()는 PlayContext 안에서만 사용할 수 있습니다')
  return v
}
