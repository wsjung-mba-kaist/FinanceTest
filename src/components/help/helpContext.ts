import { createContext, useContext } from 'react'
import type { GameState, Mode, ScenarioDefinition, TurnView } from '../../engine'

/** Tabs of the contextual help sheet. `decision` is only meaningful during play. */
export type HelpTab = 'decision' | 'kpis' | 'cards' | 'glossary' | 'search' | 'sources'

export interface HelpTarget {
  tab: HelpTab
  /** Metric id, card id, term id or decision id to scroll to / preselect. */
  anchor?: string
  /** Prefill for the search tab. */
  query?: string
}

/** What the sheet can see. Pages supply as much as they have. */
export type HelpContextValue =
  | { page: 'catalog' | 'knowledge' | 'progress' | 'settings' | 'other' }
  | { page: 'briefing' | 'debrief'; scenario: ScenarioDefinition; state?: GameState; mode?: Mode }
  | { page: 'play'; scenario: ScenarioDefinition; state: GameState; view: TurnView; mode?: Mode }

export interface HelpApi {
  open: (target?: HelpTarget) => void
  close: () => void
  isOpen: boolean
  /** Number of unseen hints/cards available in the current context (badge). */
  badge: number
}

const noop: HelpApi = { open: () => {}, close: () => {}, isOpen: false, badge: 0 }

export const HelpApiContext = createContext<HelpApi>(noop)

/** Anywhere in the tree: `useHelp().open({ tab: 'kpis', anchor: 'cash' })`. */
export function useHelp(): HelpApi {
  return useContext(HelpApiContext)
}
