import type { ReactNode } from 'react'
import { ZONE_IDS } from '../../lib/keyboard'
import type { Breakpoint } from '../../lib/useMediaQuery'
import { Button } from '../ui'

export type MobileTab = 'feed' | 'decide' | 'metrics'

function Zone({
  id,
  label,
  className = '',
  children,
}: {
  id: string
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-label={label}
      className={`h-full min-h-0 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${className}`}
    >
      {children}
    </section>
  )
}

const TABS: { id: MobileTab; label: string; zone: string }[] = [
  { id: 'feed', label: '상황', zone: ZONE_IDS[1] },
  { id: 'decide', label: '결정', zone: ZONE_IDS[2] },
  { id: 'metrics', label: '지표', zone: ZONE_IDS[3] },
]

/**
 * Responsive 3-zone layout.
 *  ≥1200px: 28% | 42% | 30%, each scrolls independently
 *  900–1199px: collapsible KPI strip + two columns (feed | decisions)
 *  <900px: sticky KPI strip + segmented tabs [상황 | 결정 | 지표]; the decision zone carries its own sticky CTA
 */
export function PlayLayout({
  bp,
  feed,
  decisions,
  dashboard,
  kpiStrip,
  mobileTab,
  onMobileTab,
  unreadCount,
  pendingCount,
  dashboardExpanded,
  onToggleDashboard,
}: {
  bp: Breakpoint
  feed: ReactNode
  decisions: ReactNode
  dashboard: ReactNode
  kpiStrip: ReactNode
  mobileTab: MobileTab
  onMobileTab: (t: MobileTab) => void
  unreadCount: number
  pendingCount: number
  dashboardExpanded: boolean
  onToggleDashboard: () => void
}) {
  if (bp === 'desktop') {
    return (
      <div className="grid h-[calc(100vh-48px)] grid-cols-[28%_42%_30%] overflow-hidden">
        <Zone id={ZONE_IDS[1]} label="상황 피드" className="border-r border-border">
          {feed}
        </Zone>
        <Zone id={ZONE_IDS[2]} label="결정 패널" className="border-r border-border">
          {decisions}
        </Zone>
        <Zone id={ZONE_IDS[3]} label="지표 대시보드">
          {dashboard}
        </Zone>
      </div>
    )
  }

  if (bp === 'tablet') {
    return (
      <div className="flex h-[calc(100vh-48px)] flex-col">
        <div className="shrink-0 border-b border-border bg-surface">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">{kpiStrip}</div>
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={dashboardExpanded}
              aria-controls={ZONE_IDS[3]}
              onClick={onToggleDashboard}
            >
              {dashboardExpanded ? '지표 접기' : '지표 펼치기'}
            </Button>
          </div>
          {dashboardExpanded && (
            <div className="max-h-[45vh] border-t border-border">
              <Zone id={ZONE_IDS[3]} label="지표 대시보드" className="max-h-[45vh]">
                {dashboard}
              </Zone>
            </div>
          )}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[40%_60%] overflow-hidden">
          <Zone id={ZONE_IDS[1]} label="상황 피드" className="border-r border-border">
            {feed}
          </Zone>
          <Zone id={ZONE_IDS[2]} label="결정 패널">
            {decisions}
          </Zone>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-2 py-1.5">{kpiStrip}</div>
      <div
        role="tablist"
        aria-label="플레이 화면 영역"
        className="grid shrink-0 grid-cols-3 border-b border-border bg-surface"
      >
        {TABS.map((t) => {
          const active = mobileTab === t.id
          const badge = t.id === 'feed' ? unreadCount : t.id === 'decide' ? pendingCount : 0
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active}
              aria-controls={t.zone}
              className={`flex min-h-[44px] items-center justify-center gap-1 border-b-2 text-[13px] ${active ? 'border-accent font-semibold text-text' : 'border-transparent text-muted'}`}
              onClick={() => onMobileTab(t.id)}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className="num rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white"
                  aria-label={`${badge}건`}
                >
                  {t.id === 'decide' ? '●' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1" role="tabpanel" aria-labelledby={`tab-${mobileTab}`}>
        {mobileTab === 'feed' && (
          <Zone id={ZONE_IDS[1]} label="상황 피드">
            {feed}
          </Zone>
        )}
        {mobileTab === 'decide' && (
          <Zone id={ZONE_IDS[2]} label="결정 패널">
            {decisions}
          </Zone>
        )}
        {mobileTab === 'metrics' && (
          <Zone id={ZONE_IDS[3]} label="지표 대시보드">
            {dashboard}
          </Zone>
        )}
      </div>
    </div>
  )
}
