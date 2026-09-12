import type { Options as GfmOptions } from 'remark-gfm'

/**
 * GFM, minus the one feature that corrupts this product's subject matter.
 *
 * Korean writes a numeric range with a tilde — `7~10%`, `15~25%`, `250~300bp` — and GFM reads a
 * *pair* of single tildes as strikethrough. So a line like
 *
 *     FHLB 헤어컷 국채 ~3% / MBS 7~10% / 주택담보 15~25% / CRE 30~40%
 *
 * rendered as `국채 ~~3% / MBS 7~~10% / 주택담보 15~~25%` — i.e. the reader was shown `710%` and
 * `1525%`, struck through, in a knowledge base whose entire premise is that the figures are right.
 * There are 840 tilde ranges in `src/content`, and 22 rendered lines were being mangled this way.
 *
 * `singleTilde: false` leaves `~~…~~` working as strikethrough; no content uses it, and no content
 * intends single-tilde strikethrough either, so this only ever removes damage.
 */
export const GFM_OPTIONS: GfmOptions = { singleTilde: false }
