import { useEffect, useRef } from 'react'
import { SHORTCUTS } from '../../lib/keyboard'
import { Button } from '../ui'

/** Keyboard reference (메뉴 › 키보드 단축키). The `?` key opens the contextual help sheet instead. */
export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      data-noprint
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shortcuts-title" className="mb-2 text-md font-semibold">
          키보드 단축키
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="contents">
              <dt className="num whitespace-nowrap text-muted">{s.keys}</dt>
              <dd className="m-0">{s.label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex justify-end">
          <Button ref={first} onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
