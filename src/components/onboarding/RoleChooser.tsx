import type { RoleFamily } from '../../content/roleFrames'
import { gridClass } from '../../lib/grid'
import { ROLE_FAMILY_BLURBS, ROLE_FAMILY_LABELS } from '../../lib/labels'

const FAMILIES: RoleFamily[] = ['bank', 'securities', 'pension', 'fund', 'policy']

/**
 * "역할로 시작하기" — four entry points that pre-filter the catalog. The choice is persisted
 * (`설정.roleFamily`) so a returning user lands on their own shelf.
 */
export function RoleChooser({
  value,
  counts,
  onChange,
}: {
  value: RoleFamily | undefined
  /** Number of playable scenarios per family. */
  counts: Record<RoleFamily, number>
  onChange: (next: RoleFamily | undefined) => void
}) {
  return (
    <section aria-labelledby="rolechooser-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rolechooser-h" className="text-lg font-semibold">
          역할로 시작하기
        </h2>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="border-0 bg-transparent p-0 text-sm text-accent"
          >
            전체 보기
          </button>
        )}
      </div>
      {/*
        Six tiles, not five. Five over four columns left a 719px hole next to the last one, and —
        more to the point — a visitor who does not yet know which of these they are had no tile to
        press. "아직 모르겠습니다" is that tile: it clears the filter, which is what the catalog's
        추천순 already does well (입문 편 first).
      */}
      <ul
        className={`mt-2 grid list-none gap-2 p-0 m-0 ${gridClass('question', FAMILIES.length + 1)}`}
        role="group"
        aria-label="역할 선택"
      >
        {FAMILIES.map((f) => {
          const on = value === f
          return (
            <li key={f}>
              <Tile
                selected={on}
                onClick={() => onChange(on ? undefined : f)}
                title={ROLE_FAMILY_LABELS[f]}
                blurb={ROLE_FAMILY_BLURBS[f]}
                foot={`시작 가능 ${counts[f] ?? 0}편`}
              />
            </li>
          )
        })}
        <li>
          <Tile
            selected={value === undefined}
            onClick={() => onChange(undefined)}
            title="아직 모르겠습니다"
            blurb="전체를 추천순으로 봅니다 — 입문 편이 맨 앞에 옵니다."
            foot="추천 받기"
          />
        </li>
      </ul>
    </section>
  )
}

function Tile({
  selected,
  onClick,
  title,
  blurb,
  foot,
}: {
  selected: boolean
  onClick: () => void
  title: string
  blurb: string
  foot: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`block h-full w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-border-control bg-surface hover:border-border-strong active:bg-surface-2'
      }`}
    >
      <span className="block font-medium">{title}</span>
      <span className="mt-0.5 block text-sm text-muted">{blurb}</span>
      <span className="num mt-1.5 block text-sm text-muted">{foot}</span>
    </button>
  )
}
