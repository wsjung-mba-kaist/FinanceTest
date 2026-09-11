import { useEffect, useRef, type ReactNode } from 'react'
import { ZONE_IDS } from '../../lib/keyboard'
import type { Breakpoint } from '../../lib/useMediaQuery'

export type InfoTab = 'situation' | 'dashboard' | 'feed' | 'log' | 'balance'
export type MobileTab = 'situation' | 'decide' | 'metrics' | 'more'

const INFO_TABS: { id: InfoTab; label: string; zoneId: string; shortcut?: string }[] = [
  { id: 'situation', label: '상황실', zoneId: ZONE_IDS[1], shortcut: 'Alt+1' },
  { id: 'dashboard', label: '대시보드', zoneId: ZONE_IDS[3], shortcut: 'Alt+3' },
  { id: 'feed', label: '피드 전체', zoneId: ZONE_IDS[4], shortcut: 'Alt+4' },
  { id: 'log', label: '로그', zoneId: ZONE_IDS[5], shortcut: 'Alt+5' },
  { id: 'balance', label: '대차대조표', zoneId: 'zone-balance' },
]

const INFO_TAB_HEADINGS: Record<InfoTab, string> = {
  situation: '상황실',
  dashboard: '지표 대시보드',
  feed: '상황 피드 전체',
  log: '결정 로그',
  balance: '대차대조표',
}

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'situation', label: '상황' },
  { id: 'decide', label: '결정' },
  { id: 'metrics', label: '지표' },
  { id: 'more', label: '더보기' },
]

const MORE_TABS: InfoTab[] = ['feed', 'log', 'balance']

/** A scrollable zone with a real (visible) heading, an id for Alt+n and a focus ring. */
function Zone({
  id,
  heading,
  hideHeading,
  scrollRef,
  className = '',
  children,
}: {
  id: string
  heading: string
  hideHeading?: boolean
  scrollRef?: (el: HTMLElement | null) => void
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      ref={scrollRef}
      tabIndex={-1}
      aria-label={heading}
      className={`h-full min-h-0 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${className}`}
    >
      {hideHeading ? (
        <h2 className="sr-only">{heading}</h2>
      ) : (
        <h2 className="label-caps border-b border-border px-3 py-1">{heading}</h2>
      )}
      {children}
    </section>
  )
}

function InfoTabs({
  value,
  onChange,
  unreadCount,
}: {
  value: InfoTab
  onChange: (t: InfoTab) => void
  unreadCount: number
}) {
  return (
    <div
      role="tablist"
      aria-label="정보 열"
      className="flex shrink-0 overflow-x-auto border-b border-border bg-surface"
    >
      {INFO_TABS.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`info-tab-${t.id}`}
            aria-selected={active}
            aria-controls={t.zoneId}
            aria-keyshortcuts={t.shortcut}
            className={`-mb-px min-h-[40px] whitespace-nowrap border-b-2 px-3 py-2 text-base ${
              active ? 'border-accent font-semibold text-text' : 'border-transparent text-muted'
            }`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.id === 'feed' && unreadCount > 0 && (
              <span className="num ml-1 rounded-full bg-accent px-1.5 text-xs text-accent-fg">
                {unreadCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Situation-room layout.
 *  ≥1200px: 유동성 스트립 + [정보 열 58% (탭) | 결정 독 42% (상주)], each column scrolls on its own.
 *  900–1199px: the same two columns at 55/45.
 *  <900px: sticky 2×2 strip + bottom tab bar (상황 · 결정 · 지표 · 더보기); the dock carries a sticky CTA.
 *
 * Every zone's `scrollTop` returns to 0 when `scrollResetKey` changes (turn advance / rewind),
 * so a new turn always starts at the top of the column instead of mid-card.
 */
export function PlayLayout({
  bp,
  strip,
  panels,
  dock,
  infoTab,
  onInfoTab,
  mobileTab,
  onMobileTab,
  unreadCount,
  pendingCount,
  scrollResetKey,
}: {
  bp: Breakpoint
  strip: ReactNode
  panels: Record<InfoTab, ReactNode>
  dock: ReactNode
  infoTab: InfoTab
  onInfoTab: (t: InfoTab) => void
  mobileTab: MobileTab
  onMobileTab: (t: MobileTab) => void
  unreadCount: number
  pendingCount: number
  scrollResetKey: number
}) {
  const zones = useRef(new Set<HTMLElement>())
  const register = (el: HTMLElement | null) => {
    if (el) zones.current.add(el)
  }
  useEffect(() => {
    for (const el of zones.current) {
      if (el.isConnected) el.scrollTop = 0
      else zones.current.delete(el)
    }
  }, [scrollResetKey, infoTab, mobileTab])

  const activeInfo = INFO_TABS.find((t) => t.id === infoTab) ?? INFO_TABS[0]!
  const infoZone = (
    <>
      <InfoTabs value={infoTab} onChange={onInfoTab} unreadCount={unreadCount} />
      <Zone
        id={activeInfo.zoneId}
        heading={INFO_TAB_HEADINGS[infoTab]}
        hideHeading={infoTab === 'situation'}
        scrollRef={register}
        className="flex-1"
      >
        {panels[infoTab]}
      </Zone>
    </>
  )

  if (bp !== 'mobile') {
    const cols = bp === 'desktop' ? 'grid-cols-[58%_42%]' : 'grid-cols-[55%_45%]'
    return (
      <div className="flex h-[calc(100dvh-3rem)] flex-col overflow-hidden">
        {strip}
        <div className={`grid min-h-0 flex-1 ${cols} overflow-hidden`}>
          <div className="flex min-h-0 flex-col border-r border-border">{infoZone}</div>
          <Zone
            id={ZONE_IDS[2]}
            heading="결정 독"
            hideHeading
            scrollRef={register}
            className="relative"
          >
            {dock}
          </Zone>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0">{strip}</div>
      <div className="min-h-0 flex-1" role="tabpanel" aria-labelledby={`mtab-${mobileTab}`}>
        {mobileTab === 'situation' && (
          <Zone id={ZONE_IDS[1]} heading="상황실" hideHeading scrollRef={register}>
            {panels.situation}
          </Zone>
        )}
        {mobileTab === 'decide' && (
          <Zone id={ZONE_IDS[2]} heading="결정 독" hideHeading scrollRef={register}>
            {dock}
          </Zone>
        )}
        {mobileTab === 'metrics' && (
          <Zone id={ZONE_IDS[3]} heading="지표 대시보드" scrollRef={register}>
            {panels.dashboard}
          </Zone>
        )}
        {mobileTab === 'more' && (
          <div className="flex h-full min-h-0 flex-col">
            <div
              role="tablist"
              aria-label="더보기"
              className="flex shrink-0 border-b border-border"
            >
              {MORE_TABS.map((t) => {
                const active = infoTab === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`min-h-[44px] flex-1 border-b-2 text-base ${
                      active ? 'border-accent font-semibold' : 'border-transparent text-muted'
                    }`}
                    onClick={() => onInfoTab(t)}
                  >
                    {INFO_TABS.find((x) => x.id === t)?.label}
                  </button>
                )
              })}
            </div>
            <Zone
              id={INFO_TABS.find((x) => x.id === infoTab)?.zoneId ?? ZONE_IDS[4]}
              heading={INFO_TAB_HEADINGS[MORE_TABS.includes(infoTab) ? infoTab : 'feed']}
              scrollRef={register}
              className="flex-1"
            >
              {panels[MORE_TABS.includes(infoTab) ? infoTab : 'feed']}
            </Zone>
          </div>
        )}
      </div>
      <nav
        role="tablist"
        aria-label="플레이 화면 영역"
        className="grid shrink-0 grid-cols-4 border-t border-border bg-surface"
      >
        {MOBILE_TABS.map((t) => {
          const active = mobileTab === t.id
          const badge = t.id === 'decide' ? pendingCount : t.id === 'more' ? unreadCount : 0
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`mtab-${t.id}`}
              aria-selected={active}
              className={`flex min-h-[44px] items-center justify-center gap-1 border-t-2 text-base ${
                active ? 'border-accent font-semibold text-text' : 'border-transparent text-muted'
              }`}
              onClick={() => {
                if (t.id === 'more' && !MORE_TABS.includes(infoTab)) onInfoTab('feed')
                onMobileTab(t.id)
              }}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className="num rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg"
                  aria-label={`${badge}건`}
                >
                  {t.id === 'decide' ? '●' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
