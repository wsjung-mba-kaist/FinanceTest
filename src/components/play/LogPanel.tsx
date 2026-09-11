import { useMemo, useState } from 'react'
import {
  buildLogEntries,
  buildLogText,
  copyText,
  downloadText,
  logFilename,
  LOG_KIND_LABELS,
  type LogEntry,
  type LogKind,
} from '../../lib/logExport'
import { Badge, Button, LiveRegion } from '../ui'
import { Icon } from '../ui/Icon'
import { usePlay } from './playContext'

const KINDS: LogKind[] = ['decision', 'call', 'consequence', 'regulator', 'memo']

const TONE: Record<LogKind, 'info' | 'neutral' | 'warning'> = {
  decision: 'info',
  call: 'neutral',
  consequence: 'neutral',
  regulator: 'warning',
  memo: 'neutral',
}

function Entry({ entry }: { entry: LogEntry }) {
  return (
    <li className="border-t border-border py-1.5 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Badge tone={TONE[entry.kind]}>{LOG_KIND_LABELS[entry.kind]}</Badge>
        {entry.time && <span className="num text-sm text-muted">{entry.time}</span>}
        <span className="text-base font-medium">{entry.title}</span>
        {entry.meta && <span className="text-sm text-muted">{entry.meta}</span>}
      </div>
      {entry.body && (
        <p className="prose-col mt-0.5 whitespace-pre-wrap text-base text-muted">{entry.body}</p>
      )}
    </li>
  )
}

/**
 * The artefact a trainee hands to a post-exercise review: every 결정 · 통화 · 결과 ·
 * 감독 메모 · 메모 in order, with filters and plain-text 복사 / 다운로드.
 */
export function LogPanel() {
  const { scenario, state, history, run, mode } = usePlay()
  const [active, setActive] = useState<Set<LogKind>>(() => new Set(KINDS))
  const [notice, setNotice] = useState('')

  const entries = useMemo(
    () => buildLogEntries(scenario, state, { history, mode }),
    [scenario, state, history, mode],
  )
  const shown = entries.filter((e) => active.has(e.kind))
  const counts = useMemo(() => {
    const map = new Map<LogKind, number>()
    for (const e of entries) map.set(e.kind, (map.get(e.kind) ?? 0) + 1)
    return map
  }, [entries])

  const toggle = (k: LogKind) =>
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next.size === 0 ? new Set(KINDS) : next
    })

  const onCopy = async () => {
    const ok = await copyText(buildLogText(scenario, state, run, { history }))
    setNotice(ok ? '로그를 복사했습니다' : '복사할 수 없습니다. 다운로드를 이용해 주세요')
  }
  const onDownload = () => {
    downloadText(logFilename(scenario, run), buildLogText(scenario, state, run, { history }))
    setNotice('로그를 내려받았습니다')
  }

  return (
    <div className="space-y-3 p-3">
      <LiveRegion message={notice} />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-md font-semibold">결정 로그</h2>
        <span className="num text-sm text-muted">{entries.length}건</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" onClick={onCopy}>
            <Icon name="copy" size={14} />
            복사
          </Button>
          <Button size="sm" onClick={onDownload}>
            <Icon name="download" size={14} />
            다운로드
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="로그 종류 필터">
        {KINDS.map((k) => {
          const on = active.has(k)
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              className={`min-h-[32px] rounded-full border px-2.5 py-1 text-sm ${
                on ? 'border-accent bg-accent-soft text-text' : 'border-border text-muted'
              }`}
              onClick={() => toggle(k)}
            >
              {LOG_KIND_LABELS[k]}
              <span className="num ml-1">{counts.get(k) ?? 0}</span>
            </button>
          )
        })}
      </div>
      {shown.length === 0 && <p className="text-base text-muted">표시할 기록이 없습니다.</p>}
      {Array.from(new Set(shown.map((e) => e.turnIndex))).map((t) => {
        const turn = scenario.turns[t]
        return (
          <section key={t} aria-label={`${turn?.label ?? `T+${t}`} 기록`}>
            <h3 className="label-caps sticky top-0 bg-bg py-1">
              {turn?.label ?? `T+${t}`} · {turn?.timeLabel ?? ''}
            </h3>
            <ul className="list-none p-0">
              {shown
                .filter((e) => e.turnIndex === t)
                .map((e) => (
                  <Entry key={e.id} entry={e} />
                ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
