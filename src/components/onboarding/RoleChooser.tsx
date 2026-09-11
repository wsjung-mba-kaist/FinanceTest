import type { RoleFamily } from '../../content/roleFrames'
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
        <h2 id="rolechooser-h" className="text-md font-semibold">
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
      <ul
        className="mt-2 grid list-none gap-2 p-0 m-0 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        aria-label="역할 선택"
      >
        {FAMILIES.map((f) => {
          const on = value === f
          return (
            <li key={f}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? undefined : f)}
                className={`block h-full w-full rounded-lg border p-3 text-left transition-colors ${
                  on
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <span className="block font-medium">{ROLE_FAMILY_LABELS[f]}</span>
                <span className="mt-0.5 block text-sm text-muted">{ROLE_FAMILY_BLURBS[f]}</span>
                <span className="num mt-1.5 block text-sm text-muted">
                  시작 가능 {counts[f] ?? 0}편
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
