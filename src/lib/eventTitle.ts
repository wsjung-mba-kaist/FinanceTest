import type { GameEvent } from '../engine'

/**
 * The one rule for what an event is *called*. Four copies had drifted — the feed said
 * «홍길동 통화», the situation room «홍길동과(와)의 통화» — so the same call carried two titles on
 * one screen, and a reader scanning from one panel to the other could not match them.
 */
export function eventTitle(e: GameEvent): string {
  switch (e.kind) {
    case 'memo':
      return e.subject
    case 'call':
      return `${e.caller}과(와)의 통화`
    case 'data':
    case 'dialogue':
      return e.title
    default:
      return e.headline
  }
}
