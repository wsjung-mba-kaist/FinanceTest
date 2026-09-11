/**
 * Minimal inline icon set (24 viewBox, 1.75 stroke, currentColor).
 * Replaces the ad-hoc text glyphs (✕ ▾ ▸ ◀ ⚠ ■ ●) that render inconsistently
 * in Korean system fonts on Windows. Icons always accompany a text label except
 * where `label` is given (then the icon itself is the accessible name).
 */
export type IconName =
  | 'search'
  | 'help'
  | 'book'
  | 'layers'
  | 'list'
  | 'chart'
  | 'clock'
  | 'shield'
  | 'alert'
  | 'check'
  | 'info'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-left'
  | 'arrow-right'
  | 'printer'
  | 'copy'
  | 'download'
  | 'external'
  | 'filter'
  | 'play'
  | 'pause'
  | 'undo'
  | 'phone'
  | 'flag'
  | 'plus'
  | 'minus'

const PATHS: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.1-4.1',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.3A2.5 2.5 0 0 1 14.4 10c0 1.7-2.4 2-2.4 3.6M12 17h.01',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.2 1.9',
  shield: 'M12 3 4.5 6v5.5c0 4.3 3 8.3 7.5 9.5 4.5-1.2 7.5-5.2 7.5-9.5V6L12 3Z',
  alert: 'M12 3 1.8 20.5h20.4L12 3ZM12 10v4.5M12 17.5h.01',
  check: 'm4.5 12.5 5 5 10-11',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01',
  x: 'M5 5l14 14M19 5 5 19',
  'chevron-down': 'm5 9 7 7 7-7',
  'chevron-right': 'm9 5 7 7-7 7',
  'chevron-left': 'm15 5-7 7 7 7',
  'arrow-left': 'M20 12H4m0 0 6-6m-6 6 6 6',
  'arrow-right': 'M4 12h16m0 0-6-6m6 6-6 6',
  printer:
    'M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z',
  copy: 'M9 9h9.5A1.5 1.5 0 0 1 20 10.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-9.5A1.5 1.5 0 0 1 9 9ZM4.5 15A1.5 1.5 0 0 1 3 13.5V4a1.5 1.5 0 0 1 1.5-1.5H14A1.5 1.5 0 0 1 15.5 4v1',
  download: 'M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 19.5h16',
  external: 'M14 4h6v6M20 4l-8.5 8.5M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5h5',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z',
  play: 'M7 4.5 19 12 7 19.5v-15Z',
  pause: 'M8 4.5v15M16 4.5v15',
  undo: 'M4 9h10a5.5 5.5 0 0 1 0 11H8M4 9l4.5-4.5M4 9l4.5 4.5',
  phone:
    'M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z',
  flag: 'M5 21V4m0 0h11l-2 3.5L16 11H5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
}

export function Icon({
  name,
  size = 16,
  label,
  className = '',
  strokeWidth = 1.75,
}: {
  name: IconName
  size?: number
  /** When given the icon becomes the accessible name; otherwise it is decorative. */
  label?: string
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
