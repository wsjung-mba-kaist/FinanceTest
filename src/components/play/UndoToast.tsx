import { useUndoWindow } from '../../lib/useUndoWindow'
import type { UndoableChoice } from '../../store/gameStore'
import { Button } from '../ui'
import { Icon } from '../ui/Icon'

/**
 * 실행 취소 toast shown for 5 seconds after a decision (8 when the chosen option was
 * `irreversible`). Not offered in expert mode — the store never opens a window there.
 */
export function UndoToast({
  undoable,
  label,
  onUndo,
  onExpire,
}: {
  undoable: UndoableChoice | undefined
  /** One-line description of what was just committed. */
  label: string
  onUndo: () => void
  onExpire: () => void
}) {
  const win = useUndoWindow(undoable, onExpire)
  if (!win.active) return null
  return (
    <div
      role="status"
      aria-live="polite"
      data-noprint
      className="fixed bottom-4 left-1/2 z-40 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-border-strong bg-surface px-3 py-2 shadow-xl"
    >
      <Icon name="check" size={16} className="text-positive" />
      <span className="min-w-0 truncate text-base">{label}</span>
      <span className="num shrink-0 text-sm text-muted">{win.secondsLeft}초</span>
      <Button size="sm" variant="secondary" aria-keyshortcuts="Z" onClick={onUndo}>
        <Icon name="undo" size={14} />
        실행 취소 (Z)
      </Button>
    </div>
  )
}
