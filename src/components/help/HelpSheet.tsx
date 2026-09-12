import { useEffect, useMemo, useState } from 'react'
import { Tabs } from '../ui'
import { SideSheet } from '../ui/SideSheet'
import { GlossaryScopeProvider } from '../knowledge/Markdown'
import { CardsHelp } from './CardsHelp'
import { DecisionHelp } from './DecisionHelp'
import { GlossaryHelp } from './GlossaryHelp'
import type { HelpContextValue, HelpTab, HelpTarget } from './helpContext'
import { TAB_LABEL, tabsFor } from './helpMeta'
import { KnowledgeSearch } from './KnowledgeSearch'
import { KpiHelp } from './KpiHelp'
import { SourcesHelp } from './SourcesHelp'

function titleFor(context: HelpContextValue): string {
  if (context.page === 'play' || context.page === 'briefing' || context.page === 'debrief')
    return `도움 — ${context.scenario.meta.roleTitle}`
  return '도움 · 지식 베이스'
}

/**
 * 맥락형 도움 시트. `SideSheet`(포커스 트랩 · Esc · 포커스 복귀) 위에 `<Tabs>` 프리미티브를 얹는다.
 *
 * 보통은 `HelpProvider`가 이 컴포넌트를 렌더하고 페이지는 `useHelp().open(...)`만 호출한다.
 */
export function HelpSheet({
  context,
  target,
  onTarget,
  open,
  onClose,
  mobile = false,
}: {
  context: HelpContextValue
  target: HelpTarget
  onTarget: (target: HelpTarget) => void
  open: boolean
  onClose: () => void
  mobile?: boolean
}) {
  const available = useMemo(() => tabsFor(context), [context])
  const [tab, setTab] = useState<HelpTab>(() =>
    available.includes(target.tab) ? target.tab : (available[0] ?? 'search'),
  )

  useEffect(() => {
    if (!open) return
    setTab(available.includes(target.tab) ? target.tab : (available[0] ?? 'search'))
  }, [open, target.tab, available])

  if (!open) return null

  const tabs = available.map((id) => ({ id, label: TAB_LABEL[id] }))
  const select = (next: HelpTab) => {
    setTab(next)
    onTarget({ ...target, tab: next })
  }

  return (
    <SideSheet open={open} title={titleFor(context)} onClose={onClose} mobile={mobile} width={520}>
      <Tabs tabs={tabs} value={tab} onChange={select} ariaLabel="도움 탭" />
      <div className="p-3" role="tabpanel" aria-label={TAB_LABEL[tab]}>
        <GlossaryScopeProvider>
          <HelpBody context={context} tab={tab} target={target} onClose={onClose} />
        </GlossaryScopeProvider>
      </div>
    </SideSheet>
  )
}

function HelpBody({
  context,
  tab,
  target,
  onClose,
}: {
  context: HelpContextValue
  tab: HelpTab
  target: HelpTarget
  onClose: () => void
}) {
  const scenario =
    context.page === 'play' || context.page === 'briefing' || context.page === 'debrief'
      ? context.scenario
      : undefined
  const state =
    context.page === 'play'
      ? context.state
      : context.page === 'briefing' || context.page === 'debrief'
        ? context.state
        : undefined

  if (tab === 'decision' && context.page === 'play')
    return (
      <DecisionHelp
        scenario={context.scenario}
        state={context.state}
        view={context.view}
        anchor={target.anchor}
      />
    )
  if (tab === 'kpis' && scenario)
    return <KpiHelp scenario={scenario} state={state} anchor={target.anchor} />
  if (tab === 'cards' && scenario)
    return (
      <CardsHelp
        scenario={scenario}
        state={state}
        turnCards={context.page === 'play' ? context.view.cards : []}
      />
    )
  if (tab === 'glossary')
    return <GlossaryHelp initialQuery={target.query ?? ''} onNavigate={onClose} />
  if (tab === 'sources') return <SourcesHelp scenario={scenario} />
  return <KnowledgeSearch initialQuery={target.query ?? ''} onNavigate={onClose} />
}
