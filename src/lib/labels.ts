import type {
  Competency,
  Difficulty,
  InstitutionType,
  Mode,
  Region,
  Role,
  ScoreDimension,
  SourceKind,
  TurnUnit,
} from '../engine/types'

export const COMPETENCIES: readonly Competency[] = [
  'liquidity',
  'solvency',
  'marketRisk',
  'communication',
  'compliance',
  'policy',
] as const

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  liquidity: '유동성 관리',
  solvency: '자본·손실 관리',
  marketRisk: '시장리스크 판단',
  communication: '위기 커뮤니케이션',
  compliance: '규제·거버넌스',
  policy: '거시·정책 판단',
  timeliness: '적시성',
}

export const DIMENSION_LABELS_EN: Record<ScoreDimension, string> = {
  liquidity: 'Liquidity',
  solvency: 'Solvency',
  marketRisk: 'Market Risk',
  communication: 'Communication',
  compliance: 'Compliance',
  policy: 'Policy',
  timeliness: 'Timeliness',
}

export const MODE_LABELS: Record<Mode, string> = {
  guided: '안내',
  standard: '표준',
  expert: '전문가',
}

export const MODE_DESCRIPTIONS: Record<Mode, string[]> = {
  guided: [
    '힌트 무료(감점 없음)',
    '개념 카드 자동 펼침',
    '선택 근거 즉시 공개',
    '수치 영향 프리뷰',
    '타이머 없음',
  ],
  standard: [
    '힌트 사용 시 감점(−2/−4/−8점)',
    '선택 근거는 턴 종료 시 공개',
    '방향(▲▼) 프리뷰만 표시',
    '타이머 ×1.5, 일시정지 가능',
  ],
  expert: [
    '힌트 없음',
    '선택 근거는 시나리오 종료 후 공개',
    '영향 프리뷰 없음',
    '엄격한 타이머(시간 초과 시 기본 옵션 자동 확정)',
    '미확인·오보 와이어 포함',
    'KPI 지연 표시(lagTurns)',
  ],
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  intro: '입문',
  standard: '표준',
  advanced: '심화',
}

export const TURN_UNIT_LABELS: Record<TurnUnit, string> = { hour: '시간', day: '일', week: '주' }

export const REGION_LABELS: Record<Region, string> = { global: '글로벌', korea: '한국' }

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  bank: '은행',
  securities: '증권사',
  pension: '연기금',
  prime_broker: '프라임브로커',
  central_bank: '중앙은행·감독당국',
  asset_manager: '자산운용',
}

/** Coarse role group used by the catalog filter. */
export const ROLE_GROUPS: Record<Role, string> = {
  bank_cro: '은행 리스크·자금',
  bank_treasurer: '은행 리스크·자금',
  bank_credit_officer: '은행 여신',
  securities_risk_head: '증권사 리스크·자금',
  securities_treasurer: '증권사 리스크·자금',
  pension_cio: '연기금·LDI',
  ldi_manager: '연기금·LDI',
  pb_risk_head: '프라임브로커',
  central_bank_official: '중앙은행·감독당국',
  regulator_official: '중앙은행·감독당국',
  asset_manager_pm: '자산운용',
}

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  primary: '1차 자료',
  regulatory: '규제·감독',
  academic: '학술',
  press: '언론',
  book: '단행본',
  data: '데이터',
}

export const MASTERY_LEVEL_LABELS = {
  none: '미평가',
  basic: '기초',
  proficient: '숙련',
  expert: '전문',
} as const

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}년대`
}

export function turnProgressLabel(turnIndex: number, durationTurns: number): string {
  return `T+${turnIndex}/${Math.max(0, durationTurns - 1)}`
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

export function durationLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.round(sec / 60)
  if (m < 1) return '1분 미만'
  if (m < 60) return `${m}분`
  return `${Math.floor(m / 60)}시간 ${m % 60}분`
}
