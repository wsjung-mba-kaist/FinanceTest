/**
 * Version of the engine's *replay semantics*. A saved run is `(scenario version, seed, decisions)`
 * and the debrief rebuilds it with `replay()`; that only reproduces the run the player saw while
 * the engine computes the same thing it computed then. Bump this when a change alters what a
 * given decision log produces — a fixed effect builder, a different noise draw, a new default —
 * and the stores treat saves from an older engine as stale (in-progress runs cannot be resumed;
 * finished runs show a notice that their numbers were recorded by a different engine).
 *
 * A scenario's own `meta.version` covers *authored* changes to that scenario; this covers the
 * code every scenario runs on.
 *
 * History
 * - 1: everything before this constant existed.
 * - 2: HTM reclassification moves carrying amounts (not market values); `jitterTick` rounds the
 *   scaled offset symmetrically; `pensionFx.meetMarginCall` no longer counts pool collateral as NAV;
 *   `autoplay` random policy uses Fisher–Yates; scoring reads intra-turn extrema (`intraMin` /
 *   `intraMax`) and weights the expert-alignment headline by `scoreWeight`, so a stored `total`
 *   can differ from the one the debrief recomputes.
 */
export const ENGINE_VERSION = 2
