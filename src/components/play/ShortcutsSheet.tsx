import { SHORTCUTS } from '../../lib/keyboard'
import { Button } from '../ui'
import { Dialog } from '../ui/Dialog'

/** Keyboard reference (메뉴 › 키보드 단축키). The `?` key opens the contextual help sheet instead. */
export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} labelledBy="shortcuts-title" onClose={onClose} onDismiss={onClose}>
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
        <Button onClick={onClose}>닫기</Button>
      </div>
    </Dialog>
  )
}
