import { describe, expect, it } from 'vitest'
import {
  createGlossaryScope,
  GLOSSARY_STOP_LIST,
  matchGlossary,
  splitByGlossary,
} from './glossaryMatch'

const ids = (text: string) => matchGlossary(text).map((m) => m.termId)

describe('matchGlossary', () => {
  it('약어와 한글 표면형을 모두 찾는다', () => {
    expect(ids('LCR이 100% 아래로 내려왔습니다')).toContain('lcr')
    expect(ids('마진콜이 도착했습니다')).toContain('margin-call')
    expect(ids('예금자보호한도를 확인하세요')).toContain('deposit-insurance-limit')
  })

  it('라틴 약어는 단어 경계를 지킨다', () => {
    expect(ids('LCRX는 존재하지 않는 지표다')).not.toContain('lcr')
    expect(ids('XLCR도 마찬가지다')).not.toContain('lcr')
    expect(ids('(LCR)은 괄호 안에서도 잡힌다')).toContain('lcr')
  })

  it('모호한 짧은 토큰은 제외한다', () => {
    expect(GLOSSARY_STOP_LIST).toContain('정리')
    expect(ids('정리 절차를 시작한다')).not.toContain('resolution')
    expect(ids('콜 시장이 얼었다')).toEqual([])
  })

  it('매칭은 겹치지 않고 왼쪽부터 한 번씩만 잡는다', () => {
    const m = matchGlossary('LCR과 LCR')
    expect(m).toHaveLength(2)
    expect(m[0]!.start).toBe(0)
    expect(m[1]!.start).toBeGreaterThan(m[0]!.end)
  })

  it('accept로 첫 등장만 남길 수 있다', () => {
    const seen = new Set<string>()
    const accept = (id: string) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    }
    expect(matchGlossary('LCR과 LCR과 LCR', accept)).toHaveLength(1)
  })

  it('splitByGlossary가 원문을 손실 없이 되돌린다', () => {
    const text = 'LCR이 100% 아래이고 마진콜이 왔다'
    const parts = splitByGlossary(text)
    const joined = parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')
    expect(joined).toBe(text)
    expect(parts.some((p) => typeof p !== 'string')).toBe(true)
  })

  it('매칭이 없으면 원문 한 조각을 돌려준다', () => {
    expect(splitByGlossary('아무 용어도 없는 문장')).toEqual(['아무 용어도 없는 문장'])
  })
})

describe('createGlossaryScope', () => {
  it('패널 안에서 한 용어는 한 소유자만 차지한다', () => {
    const scope = createGlossaryScope()
    expect(scope.claim('lcr', 'a')).toBe(true)
    expect(scope.claim('lcr', 'b')).toBe(false)
    // 같은 소유자가 다시 그려도 밑줄이 유지된다.
    expect(scope.claim('lcr', 'a')).toBe(true)
  })
})
