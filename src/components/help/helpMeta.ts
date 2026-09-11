import type { HelpContextValue, HelpTab } from './helpContext'

export const TAB_LABEL: Record<HelpTab, string> = {
  decision: '이 결정에서',
  kpis: '지표 설명',
  cards: '관련 카드·프레임워크',
  glossary: '용어집',
  search: '지식 검색',
  sources: '규정·출처',
}

/** 어떤 화면이 어떤 탭을 가지는가. 시나리오가 없는 화면은 검색·규정·용어만 보여 준다. */
export function tabsFor(context: HelpContextValue): HelpTab[] {
  if (context.page === 'play') return ['decision', 'kpis', 'cards', 'glossary', 'search', 'sources']
  if (context.page === 'briefing' || context.page === 'debrief')
    return ['kpis', 'cards', 'glossary', 'search', 'sources']
  return ['search', 'sources', 'glossary']
}

/** `지표 설명` 탭에서 한 지표 블록의 DOM id (`HelpTarget.anchor`가 여기로 스크롤한다). */
export function kpiAnchorId(metric: string): string {
  return `help-kpi-${metric}`
}

/** 도움 시트 자체를 여는 단축키. `lib/keyboard`의 플레이 단축키 목록에 덧붙인다. */
export const HELP_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '? · H', label: '도움 시트 열기·닫기' },
  { keys: 'Esc', label: '도움 시트 닫기' },
]
