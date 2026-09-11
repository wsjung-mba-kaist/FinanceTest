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
import type { RoleFamily } from '../content/roleFrames'

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

/** Compact labels for tight surfaces (radar axes, comparison table headers). */
export const DIMENSION_LABELS_SHORT: Record<ScoreDimension, string> = {
  liquidity: '유동성',
  solvency: '자본',
  marketRisk: '시장',
  communication: '소통',
  compliance: '규제',
  policy: '정책',
  timeliness: '적시성',
}

/** "무엇을 보는 점수인가" — shown from the `?` next to a dimension label. */
export const DIMENSION_HELP: Record<ScoreDimension, string> = {
  liquidity:
    '현금과 담보 여력을 유출 속도에 맞춰 확보했는지를 봅니다. 조달 채널을 미리 열어 두었는지, 당일·익일 가용액을 구분했는지가 핵심입니다.',
  solvency:
    '손실 인식과 자본 확충의 순서를 봅니다. 규제비율만이 아니라 미실현손실을 반영한 경제적 자기자본을 지켰는지가 핵심입니다.',
  marketRisk:
    '금리·가격 변동 노출을 이해하고 헤지·매각 시점을 판단했는지를 봅니다. 듀레이션과 담보가치의 연쇄를 읽었는지가 핵심입니다.',
  communication:
    '검증 가능한 수치로 예금자·투자자·감독당국·이사회의 신뢰를 관리했는지를 봅니다. 근거 없는 안심 메시지는 감점 요인입니다.',
  compliance:
    '규제 한도와 보고 의무를 지키고 감독당국에 제때 알렸는지를 봅니다. 위반 소지가 있는 선택은 크게 감점됩니다.',
  policy:
    '정책 수단의 조건·한계를 알고 활용하거나 건의했는지를 봅니다. 아직 존재하지 않는 창구를 전제한 계획은 감점됩니다.',
  timeliness: '결정을 기회 창구 안에서 실행했는지를 봅니다. 시간 초과와 미뤄진 결정이 반영됩니다.',
}

export const MODE_LABELS: Record<Mode, string> = {
  guided: '안내',
  standard: '표준',
  expert: '전문가',
}

/** One-line pitch shown next to the mode radio on the briefing start card. */
export const MODE_SUMMARY: Record<Mode, string> = {
  guided: '힌트가 무료이고 타이머가 없습니다. 처음이라면 안내 모드를 권장합니다.',
  standard: '힌트는 감점되고 타이머는 1.5배로 여유가 있습니다. 한 번 해 본 뒤 권장합니다.',
  expert: '힌트 없음·엄격한 타이머·미확인 정보 포함. 실제 상황실에 가장 가깝습니다.',
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

/** Short role label for the catalog card (the full `roleTitle` is 20~30자). */
export const ROLE_SHORT: Record<Role, string> = {
  bank_cro: '은행 CRO',
  bank_treasurer: '은행 자금담당',
  bank_credit_officer: '은행 여신담당',
  securities_risk_head: '증권 CRO',
  securities_treasurer: '증권 자금담당',
  pension_cio: '연기금 CIO',
  ldi_manager: 'LDI 운용역',
  pb_risk_head: '프라임브로커 리스크',
  central_bank_official: '중앙은행 정책담당',
  regulator_official: '감독당국 담당',
  asset_manager_pm: '펀드 PM',
}

/** Labels for the role entry points on the home screen (keys match `RoleFamily`). */
export const ROLE_FAMILY_LABELS: Record<RoleFamily, string> = {
  bank: '은행 자금·리스크',
  securities: '증권사·PB',
  pension: '연기금·LDI',
  fund: '펀드 운용',
  policy: '정책당국',
}

/** One-line blurb under each role family card. */
export const ROLE_FAMILY_BLURBS: Record<RoleFamily, string> = {
  bank: '예금 유출과 담보차입 여력을 시간 단위로 관리합니다.',
  securities: '차환 만기와 자본비율을 지키며 조달 채널을 고릅니다.',
  pension: '담보 콜을 막으면서 헤지와 자산을 함께 지킵니다.',
  fund: '환매에 응하면서 남는 수익자의 몫을 지킵니다.',
  policy: '시장 전체의 신뢰와 정책 수단의 순서를 결정합니다.',
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
