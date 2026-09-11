import { describe, expect, it } from 'vitest'
import { bulletsOf, firstSentence, splitOptionLabel, stripInlineMarkdown, truncateKo } from './text'

/** Verbatim strings from src/scenarios/svb-2023/turnsA.ts (t0-news-10k, t0-memo-treasury, t2-b, t1-d1). */
const NEWS_10K_BODY =
  '지난 금요일 공시된 10-K에 따르면 만기보유(HTM) 증권 $91B의 공정가치는 $76B로, 미실현손실이 보통주자본을 넘어선다. 회사는 "규제자본비율은 요건을 크게 상회한다"고 밝혔다.'

const MEMO_TREASURY_BODY = `- 1~2월 예금 순유출 약 $8B(추세). VC 투자 둔화로 고객 현금 소진(cash burn) 지속.
- 현금·지준 $14B, FHLB 차입 $15B(작년 0 → 급증). **연준 재할인창구에 사전 예치된 담보는 없음.**
- AFS 헤지 잔액 $0.6B (2021년 말 $10B 초과에서 대부분 해제).
- 2022년 내부 유동성 스트레스테스트(ILST) 30일 부족이 반복돼 가정(예금 지속성)을 조정한 상태.`

const T2B_LABEL =
  '유동성 사실 공개: 즉시 가용 현금 + 설정된 담보차입 한도를 무보험예금 대비 %로 공개, RM이 상위 100개 예금주에 동일 수치 전달'

const BIGBANG_LABEL = '"빅뱅" 리스크 축소: AFS $21B 일괄 매각과 $2.25B 증자를 무디스 결정 전 실행'

describe('firstSentence', () => {
  it('cuts the 10-K wire body at the first 다.', () => {
    const { head, rest } = firstSentence(NEWS_10K_BODY)
    expect(head).toBe(
      '지난 금요일 공시된 10-K에 따르면 만기보유(HTM) 증권 $91B의 공정가치는 $76B로, 미실현손실이 보통주자본을 넘어선다.',
    )
    expect(head.length).toBeLessThanOrEqual(90)
    expect(rest).toBe('회사는 "규제자본비율은 요건을 크게 상회한다"고 밝혔다.')
  })

  it('does not treat 다 inside a quotation as a sentence end', () => {
    const { head } = firstSentence('회사는 "요건을 크게 상회한다"고 밝혔다. 다음 문장.')
    expect(head).toBe('회사는 "요건을 크게 상회한다"고 밝혔다.')
  })

  it('takes the first bullet of a bullet body and strips **', () => {
    const { head, rest } = firstSentence(MEMO_TREASURY_BODY)
    expect(head).toBe(
      '1~2월 예금 순유출 약 $8B(추세). VC 투자 둔화로 고객 현금 소진(cash burn) 지속.',
    )
    expect(head).not.toContain('**')
    expect(rest).toContain('연준 재할인창구에 사전 예치된 담보는 없음.')
    expect(rest).not.toContain('**')
  })

  it('caps a long single sentence and keeps the remainder in rest', () => {
    const long = `${'가'.repeat(200)}입니다. 두 번째 문장입니다.`
    const { head, rest } = firstSentence(long, 60)
    expect(head.length).toBeLessThanOrEqual(61)
    expect(head.endsWith('…')).toBe(true)
    expect(rest.length).toBeGreaterThan(0)
  })

  it('falls back to the whole text when no terminator is present', () => {
    expect(firstSentence('짧은 제목').head).toBe('짧은 제목')
    expect(firstSentence('').head).toBe('')
  })

  it('cuts at a line break before a period', () => {
    expect(firstSentence('첫 줄\n둘째 줄입니다. 셋째.').head).toBe('첫 줄')
  })
})

describe('splitOptionLabel', () => {
  it('splits the 76-character t2-b label at the first colon', () => {
    expect(T2B_LABEL.length).toBe(76)
    const { title, tail } = splitOptionLabel(T2B_LABEL)
    expect(title).toBe('유동성 사실 공개')
    expect(tail).toBe(
      '즉시 가용 현금 + 설정된 담보차입 한도를 무보험예금 대비 %로 공개, RM이 상위 100개 예금주에 동일 수치 전달',
    )
  })

  it('keeps a quoted prefix inside the title', () => {
    const { title, tail } = splitOptionLabel(BIGBANG_LABEL)
    expect(title).toBe('"빅뱅" 리스크 축소')
    expect(tail).toBe('AFS $21B 일괄 매각과 $2.25B 증자를 무디스 결정 전 실행')
  })

  it('ignores a colon inside quotes', () => {
    const { title, tail } = splitOptionLabel('"지금: 즉시" 대응 발표 — 오늘 장 마감 후')
    expect(title).toBe('"지금: 즉시" 대응 발표')
    expect(tail).toBe('오늘 장 마감 후')
  })

  it('truncates a separator-less label to 40 characters', () => {
    const { title, tail } = splitOptionLabel(
      '유동성·EVE 스트레스 가정 완화로 내부 한도를 충족시키고 이사회 보고서를 그대로 유지한다',
    )
    expect(title.length).toBeLessThanOrEqual(41)
    expect(title.endsWith('…')).toBe(true)
    expect(tail).toBe('')
  })

  it('leaves a short label untouched', () => {
    expect(splitOptionLabel('침묵 유지')).toEqual({ title: '침묵 유지', tail: '' })
  })
})

describe('truncateKo', () => {
  it('returns short strings unchanged', () => {
    expect(truncateKo('현금 $14B', 40)).toBe('현금 $14B')
  })
  it('cuts at a word boundary when one is near the limit', () => {
    const out = truncateKo('담보차입 여력 당일 익일 합계 확인 필요', 14)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(15)
  })
})

describe('stripInlineMarkdown / bulletsOf', () => {
  it('removes emphasis, links and citation chips', () => {
    expect(stripInlineMarkdown('**굵게** 그리고 [용어](term:lcr) [출처: fed-2023]')).toBe(
      '굵게 그리고 용어',
    )
  })
  it('lists the four memo bullets', () => {
    const bullets = bulletsOf(MEMO_TREASURY_BODY)
    expect(bullets).toHaveLength(4)
    expect(bullets[1]).toContain('연준 재할인창구에 사전 예치된 담보는 없음.')
  })
  it('returns no bullets for prose', () => {
    expect(bulletsOf(NEWS_10K_BODY)).toHaveLength(0)
  })
})
