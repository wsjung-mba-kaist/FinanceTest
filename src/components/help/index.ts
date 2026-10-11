/**
 * Only the light parts live in this barrel. It used to re-export `RoleFramePanel`,
 * `KnowledgeSearch`, `RegulationQuickRef` and `ShortcutsList` too — nobody imported them from
 * here, but the router imports `HelpProvider` from here, and a barrel is a static import graph:
 * those four pulled the engine, the metrics and every knowledge card into the first chunk of the
 * home screen. Import the heavy components from their own files.
 */
export { HelpProvider } from './HelpProvider'
export { HelpSheet } from './HelpSheet'
export { HELP_SHORTCUTS, kpiAnchorId, TAB_LABEL, tabsFor } from './helpMeta'
export {
  HelpApiContext,
  useHelp,
  type HelpApi,
  type HelpContextValue,
  type HelpTab,
  type HelpTarget,
} from './helpContext'
