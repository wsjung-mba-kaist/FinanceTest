# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Korean-language **financial-crisis simulation trainer** for risk/treasury/policy practitioners.
Players make timed decisions inside scenarios reconstructed from primary sources (Fed, FDIC, BoE,
금융위, 한국은행), watch the consequences land in quantitative metrics (LCR, CET1, NCR, 담보 여력,
외환보유액), and compare their run against the historical and expert paths in a debrief.

Static SPA — React 18 + TypeScript + Vite + Tailwind v4 + Zustand, hash router, **no backend and no
accounts**. Progress lives in `localStorage`. Deployed to GitHub Pages (`BASE_PATH=/repo/ pnpm build`).

**Accuracy is the top priority.** Every initial figure is recorded in a scenario's `facts.ts` with a
source, an as-of date, and a `VERIFY` / `STYLIZED` / `CAL` tag; effect sizes are justified by a
documented rule (Basel runoff rates, PCA, haircuts, ASC 320) or a calibration note. Do not invent or
round figures — see `docs/authoring-guide.md` §6 and the per-scenario dossiers in `docs/research/`.

## Commands

```bash
pnpm dev                 # http://localhost:5173
pnpm typecheck           # tsc --noEmit
pnpm lint                # eslint
pnpm format              # prettier --write .  (see the warning below)
pnpm test                # full vitest suite (jsdom)
pnpm validate            # integrity lint + historical-path reproduction + autoplay
pnpm build               # tsc --noEmit && vite build
pnpm test:visual         # real Chromium — needs `pnpm dev` running in another terminal
```

Single test file / single case:

```bash
pnpm vitest run src/metrics/lcr.test.ts
pnpm vitest run tests/ui/contrast.test.ts -t "print"
```

**Gate for any milestone**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, with
`pnpm validate` passing **untouched** — the engine, scenarios, metrics and persistence are where the
accuracy guarantees live, so a UI change that moves those numbers is a bug.

> `pnpm format` rewrites ~80 markdown files that predate Prettier. Run
> `npx prettier --write <file>` on the files you actually changed instead — and note that on a
> content `.md` it reflows tables and wraps the `sources:` array (22 of 30 exceed printWidth 100).
> The frontmatter parser now reads wrapped arrays, so citations survive it; the churn does not.

## Architecture

### Layers, and the direction dependencies may point

```
engine · metrics · scenarios   pure TypeScript, no React, no DOM
        ↓
lib · content · persistence    pure helpers, authored content, zod schemas
        ↓
components · pages · store     React
```

`src/lib` must not import from `src/components`. When a piece of pure logic is needed on both sides
it moves down, not up (`src/lib/direction.ts` is the worked example).

### The engine is a deterministic pure function

A finished run is a pure function of `(scenario version, seed, decisions)`. That is the premise the
whole product rests on:

- `GameState` is **never persisted**. `src/persistence/schema.ts` stores an `AttemptSave`
  (runId, seed, mode, decisions, score) and the debrief rebuilds the full state with `replay()`.
- `metricsHistory` holds one complete `MetricSnapshot` per turn — every metric, not just the KPIs —
  and `tickHistory` one sample per `(turn, tick)`. Sparklines, trend columns and turn diffs are all
  free; none of them need engine changes.
- The historical path must reproduce authored checkpoints (e.g. SVB 3/9 outflow $42B ±15%) and the
  expert path must beat it. `pnpm validate` asserts this.

Entry point is `src/engine/index.ts`; `core/` has the turn loop, `fx/` the effect builders,
`validate/` the scenario integrity linter.

### Scenarios

`src/scenarios/index.ts` is a registry of summaries with lazy `load()`. A scenario module is a fixed
set of files — `scenario.ts`, `facts.ts`, `initialState.ts`, `turnsA/B.ts`, `scoring.ts`,
`debrief.ts`, `sources.ts`, `calibration.md`, plus its own `*.test.ts` that reproduces the historical
path. Follow `docs/authoring-guide.md` for new ones. **All 13 are implemented** — `planned.ts` is an
empty array now, so anything that says "N have a dossier but no implementation" is stale.

Turn length differs per scenario (`turnUnit`: svb = hour, korea-imf and taeyoung = week, the other
ten = day). Anything shared across scenarios — the metric registry in `src/metrics/byInstitution.ts`,
`KPI_EXPLAIN` — therefore **cannot say 당일/익일**; only a scenario's own `KpiSpec.label` can.
`tests/integrity/metricLabels.test.ts` holds that line.

### Screens

Catalog → briefing → **play** → debrief, plus a knowledge base, progress page and settings.

The play screen is a situation room: status bar, liquidity strip, then
`[정보 탭 58% | 결정 독 42%]`. The info column is tabbed (상황실·대시보드·피드·로그·대차대조표); the
decision dock is always mounted. `?` or `H` opens a contextual help sheet anywhere.

Two mounting rules that are easy to break:

- **`HelpProvider` wraps exactly one level.** The router shell mounts it for non-play routes only
  (`shellHelpContext` returns `null` for `/play/`, `/scenarios/`, `/debrief/`); those three pages
  mount their own with a richer context. Two providers means two sheets.
- **`statusFor` returns `'na'` when a metric has no threshold band.** Rendering that as a green 정상
  badge was the bug where 누적 예금 유출 looked healthy through a bank run. Code filtering on
  `status === 'na'` must not drop the _value_.

## UI conventions — read `docs/ui-conventions.md` first

§1–§22 (plus sub-sections), each written from a defect that actually shipped and each backed by a
named test:
cascade layers, custom-`@utility` emission order, "JS gives values, CSS computes", frames-in-px /
measures-in-em, the three border tokens, print as a fourth palette, font delivery, the density axis,
one-scale-per-column for numbers, colour meaning, disclosure vocabulary, machine names.

Two consequences worth knowing before you touch any styling:

- **No test in the suite asserts a `className`** — every query is by role or text. That is what makes
  large styling migrations safe. Do not break it.
- `tests/ui/` holds static stylesheet analysis (layers, emission order, contrast across
  light/dark/**print**, type scale, density) and a **ratchet** (`primitiveAdoption.test.ts`) whose
  ceilings may only be lowered. Migrating a file is _expected_ to fail that suite, with a message
  telling you the new number to write down.

`docs/visual-check.md` records what is verified by browser and the judgement calls still open.
`docs/finance-practitioner-ux.md` records the practitioner-facing review and what it deliberately
left unbuilt (settlement ledgers, per-document release windows).

## Testing

| Path               | What it covers                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**/*.test.ts` | metric calculators (with cited reference cases), scenario historical paths, lib helpers                                                                              |
| `tests/engine/`    | determinism, replay, ticks, turn loop, conditions, dialogue, variance                                                                                                |
| `tests/integrity/` | scenario/content/facts/framework/citation lint                                                                                                                       |
| `tests/autoplay/`  | committed snapshot of an autoplayed run                                                                                                                              |
| `tests/ui/`        | RTL flows plus the stylesheet guards above                                                                                                                           |
| `tests/visual/`    | Playwright — **computed values, not screenshots**: layout at each breakpoint, which cascade rule won, what the first Tab focuses, what the print palette resolves to |

Verifying a debrief change is faster by seeding than by playing: open the app, in the page
`import('/src/engine/index.ts')` and the scenario module, `autoplay(scenario, 'historical', {seed})`,
write an `AttemptSave` into `localStorage['fcs:progress']` (shape in `src/persistence/schema.ts`),
then **reload** — the Zustand stores read `localStorage` at module init, so a hash change alone
leaves you looking at stale state.

## Language

Product language is Korean: all UI strings, `src/content/**` and `docs/**` are Korean. Code comments
and commit messages are written to explain _why_ — most of them name the specific defect the line
prevents. Keep that register.
