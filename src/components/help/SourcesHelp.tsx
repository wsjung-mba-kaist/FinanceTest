import type { InstitutionType, ScenarioDefinition } from '../../engine'
import type { RegulationSector } from '../../content/regulationQuickRef'
import { RegulationQuickRef } from './RegulationQuickRef'
import { InlineMarkdown } from '../knowledge/InlineMarkdown'

const SECTOR_BY_INSTITUTION: Partial<Record<InstitutionType, RegulationSector>> = {
  bank: 'bank',
  securities: 'securities',
  pension: 'pension',
  central_bank: 'central_bank',
}

/** `규정·출처` 탭 — 규정 빠른 참조표 + 이 시나리오가 쓰는 1차 출처 목록. */
export function SourcesHelp({ scenario }: { scenario?: ScenarioDefinition }) {
  const sector = scenario ? SECTOR_BY_INSTITUTION[scenario.meta.institutionType] : undefined
  return (
    <div className="space-y-4">
      <RegulationQuickRef
        defaultSectors={sector ? [sector] : undefined}
        defaultRegion={scenario?.meta.region}
      />

      {scenario && scenario.meta.sources.length > 0 && (
        <section aria-label="시나리오 출처">
          <h3 className="mb-1 text-base font-semibold">이 시나리오의 출처</h3>
          <ul className="space-y-1">
            {scenario.meta.sources.map((s) => (
              <li key={s.id} className="rounded-md border border-border bg-surface p-2 text-sm">
                <div className="font-medium">{s.title}</div>
                <div className="text-muted">
                  {s.publisher}
                  {s.date ? ` · ${s.date}` : ''}
                  {s.pages ? ` · ${s.pages}` : ''}
                </div>
                {s.note && (
                  <p className="mt-0.5 leading-relaxed text-muted">
                    <InlineMarkdown>{s.note}</InlineMarkdown>
                  </p>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block break-all text-accent"
                  >
                    {s.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
