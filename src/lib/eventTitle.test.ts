import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../engine'
import { eventTitle } from './eventTitle'
import { ratingTone } from './ratingTone'

describe('eventTitle', () => {
  it('names every event kind by its own headline field, calls included', () => {
    const base = { id: 'e', effects: [] as never[] }
    const ev = (p: Record<string, unknown>) => ({ ...base, ...p }) as unknown as GameEvent
    expect(eventTitle(ev({ kind: 'memo', subject: '메모 제목', body: '' }))).toBe('메모 제목')
    expect(eventTitle(ev({ kind: 'call', caller: '감독관', lines: [] }))).toBe(
      '감독관과(와)의 통화',
    )
    expect(eventTitle(ev({ kind: 'dialogue', title: '대화', lines: [] }))).toBe('대화')
    expect(eventTitle(ev({ kind: 'newswire', headline: '헤드라인', body: '' }))).toBe('헤드라인')
  })
})

describe('ratingTone', () => {
  it('reads ≥70 as good, ≥40 as mixed, below as poor', () => {
    expect(ratingTone(70)).toBe('positive')
    expect(ratingTone(69.9)).toBe('warning')
    expect(ratingTone(40)).toBe('warning')
    expect(ratingTone(39.9)).toBe('critical')
  })
})
