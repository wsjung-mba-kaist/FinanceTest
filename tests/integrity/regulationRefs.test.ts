import { describe, expect, it } from 'vitest'
import { CARDS, FRAMEWORKS, GLOSSARY, SOURCES } from '@/content'
import {
  firstNumericToken,
  REGULATION_REFS,
  type RegulationRef,
} from '@/content/regulationQuickRef'
import { PREFLIGHT_BY_FAMILY, ROLE_FRAMES } from '@/content/roleFrames'
import { KPI_EXPLAIN } from '@/content/kpiExplain'

const sourceIds = new Set(SOURCES.map((s) => s.id))
const cardIds = new Set(CARDS.map((c) => c.id))
const termIds = new Set(GLOSSARY.map((g) => g.id))
const frameworkIds = new Set(FRAMEWORKS.map((f) => f.id))

const bodies = new Map<string, string>()
for (const f of FRAMEWORKS) bodies.set(f.id, await f.load())

/** Normalises the spacing/decimal separators so `12.5` matches `12.5%` and `1,000` matches `1000`. */
function normalizeNumber(token: string): string {
  return token.replace(/,/g, '')
}

function bodyContainsNumber(body: string, token: string): boolean {
  const t = normalizeNumber(token)
  return normalizeNumber(body).includes(t)
}

describe('규정 빠른 참조 — 드리프트 가드', () => {
  it('행이 충분하고 id가 고유하다', () => {
    expect(REGULATION_REFS.length).toBeGreaterThanOrEqual(25)
    const ids = REGULATION_REFS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 행에 rule·threshold가 있다', () => {
    const problems: string[] = []
    for (const r of REGULATION_REFS) {
      if (!r.rule.trim()) problems.push(`${r.id}: rule 비어 있음`)
      if (!r.threshold.trim()) problems.push(`${r.id}: threshold 비어 있음`)
      if (r.sectors.length === 0) problems.push(`${r.id}: sectors 비어 있음`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('frameworkId · sourceRef · termId · cardRef가 모두 해석된다', () => {
    const problems: string[] = []
    for (const r of REGULATION_REFS) {
      if (!frameworkIds.has(r.frameworkId))
        problems.push(`${r.id}: unknown framework ${r.frameworkId}`)
      if (!sourceIds.has(r.sourceRef)) problems.push(`${r.id}: unknown source ${r.sourceRef}`)
      if (r.termId && !termIds.has(r.termId)) problems.push(`${r.id}: unknown term ${r.termId}`)
      if (r.cardRef && !cardIds.has(r.cardRef)) problems.push(`${r.id}: unknown card ${r.cardRef}`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('section이 해당 프레임워크 문서의 `## ` 절로 존재한다', () => {
    const problems: string[] = []
    for (const r of REGULATION_REFS) {
      if (!r.section) continue
      const body = bodies.get(r.frameworkId)
      if (!body) continue
      if (!body.includes(`## ${r.section}`)) problems.push(`${r.id}: '## ${r.section}' 없음`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('threshold의 첫 숫자가 프레임워크 본문에 그대로 존재한다', () => {
    const problems: string[] = []
    for (const r of REGULATION_REFS) {
      const token = firstNumericToken(r.threshold)
      if (!token) continue
      const body = bodies.get(r.frameworkId)
      if (!body) continue
      if (!bodyContainsNumber(body, token))
        problems.push(`${r.id}: '${token}' (${r.threshold}) 가 ${r.frameworkId} 본문에 없음`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('프레임워크가 인용하는 출처 목록 안에서 인용하거나 verify 표시가 있다', () => {
    const problems: string[] = []
    const fwSources = new Map(FRAMEWORKS.map((f) => [f.id, new Set(f.sources)]))
    for (const r of REGULATION_REFS) {
      const allowed = fwSources.get(r.frameworkId)
      if (!allowed) continue
      if (!allowed.has(r.sourceRef) && !r.verify)
        problems.push(
          `${r.id}: ${r.sourceRef}는 ${r.frameworkId}의 출처 목록에 없음 (verify: true 필요)`,
        )
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })
})

describe('역할 프레임 참조', () => {
  const families = Object.keys(ROLE_FRAMES) as (keyof typeof ROLE_FRAMES)[]

  it('모든 역할군이 정의되어 있고 항목이 비어 있지 않다', () => {
    // `RoleFamily`가 늘어나면 여기도 함께 늘어나야 한다 — 역할이 프레임 없이 추가되는 것을 막는다.
    expect(families.sort()).toEqual(['bank', 'fund', 'pension', 'policy', 'securities'])
    for (const f of families) expect(ROLE_FRAMES[f].items.length).toBeGreaterThanOrEqual(3)
  })

  it('cardRef · frameworkRef가 해석되고 metrics가 비어 있지 않다', () => {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const f of families) {
      for (const item of ROLE_FRAMES[f].items) {
        if (seen.has(item.id)) problems.push(`중복 id ${item.id}`)
        seen.add(item.id)
        if (item.cardRef && !cardIds.has(item.cardRef))
          problems.push(`${item.id}: unknown card ${item.cardRef}`)
        if (item.frameworkRef && !frameworkIds.has(item.frameworkRef))
          problems.push(`${item.id}: unknown framework ${item.frameworkRef}`)
        if (item.metrics.length === 0) problems.push(`${item.id}: metrics 비어 있음`)
        if (!item.question.trim().endsWith('?'))
          problems.push(`${item.id}: question이 질문 형태가 아님`)
      }
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('시작 전 체크리스트가 모든 역할군에 있다', () => {
    for (const f of families) expect(PREFLIGHT_BY_FAMILY[f].length).toBeGreaterThanOrEqual(3)
  })
})

describe('지표 설명', () => {
  it('cards · sourceRef가 모두 해석된다', () => {
    const problems: string[] = []
    for (const [metric, e] of Object.entries(KPI_EXPLAIN)) {
      for (const c of e.cards ?? [])
        if (!cardIds.has(c)) problems.push(`${metric}: unknown card ${c}`)
      if (e.sourceRef && !sourceIds.has(e.sourceRef))
        problems.push(`${metric}: unknown source ${e.sourceRef}`)
      if (e.why.trim().length < 20) problems.push(`${metric}: why가 너무 짧음`)
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([])
  })

  it('시나리오 KPI가 참조하는 지표를 대부분 설명한다', () => {
    const explained = new Set(Object.keys(KPI_EXPLAIN))
    // 각 기관 유형의 1차 지표는 반드시 설명이 있어야 한다.
    const required = [
      'cash',
      'survivalDays',
      'facilityHeadroom',
      'facilityPending',
      'cumulativeOutflow',
      'dailyOutflow',
      'lcr',
      'cet1Ratio',
      'economicTce',
      'confidence',
      'regulatorLevel',
      'ncr',
      'liquidityRatio',
      'rollRate',
      'collateralHeadroomBp',
      'hedgeRatio',
      'ldiLeverage',
      'fundingRatio',
      'guidottiRatio',
      'usableReserves',
    ]
    const missing = required.filter((m) => !explained.has(m))
    expect(missing, `설명 없는 지표: ${missing.join(', ')}`).toEqual([])
  })
})

function refsFor(group: RegulationRef['group']): RegulationRef[] {
  return REGULATION_REFS.filter((r) => r.group === group)
}

describe('규정 그룹 커버리지', () => {
  it('여섯 그룹에 모두 행이 있다', () => {
    for (const g of [
      '유동성',
      '자본',
      '증권·보험·상호금융',
      '담보·마진',
      '정리·백스톱',
      '외환',
    ] as const)
      expect(refsFor(g).length, `${g} 그룹이 비어 있음`).toBeGreaterThan(0)
  })
})
