import { SHORTCUTS } from '../../lib/keyboard'
import { HELP_SHORTCUTS } from './helpMeta'

/**
 * 키보드 단축키 목록(평범한 정의 목록).
 * 플레이 페이지가 원하는 자리에 그대로 렌더하면 된다 — 이 컴포넌트는 스스로 배선하지 않는다.
 */
export function ShortcutsList({ className = '' }: { className?: string }) {
  const items = [...SHORTCUTS, ...HELP_SHORTCUTS]
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base ${className}`}>
      {items.map((s) => (
        <div key={s.keys} className="contents">
          <dt className="num whitespace-nowrap text-muted">{s.keys}</dt>
          <dd className="m-0">{s.label}</dd>
        </div>
      ))}
    </dl>
  )
}
