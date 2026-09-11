import type { CardTrigger } from './types'

/**
 * Generic contextual triggers: when a condition holds in the current state, the card is suggested
 * in the advisor drawer. Scenario-specific triggers use `Decision.requiredConcepts` / `cardRefs`.
 */
export const CARD_TRIGGERS: CardTrigger[] = [
  {
    cardId: 'lcr-basics',
    when: { metric: 'lcr', lt: 110 },
    institutionTypes: ['bank'],
    reason: 'LCR이 110% 아래로 내려왔습니다',
  },
  {
    cardId: 'contingency-funding-plan',
    when: { metric: 'survivalDays', lt: 3 },
    institutionTypes: ['bank'],
    reason: '생존 일수가 3일 미만입니다',
  },
  {
    cardId: 'discount-window-fhlb-btfp',
    when: { metric: 'facilityHeadroom', lte: 0 },
    institutionTypes: ['bank'],
    reason: '담보차입 여력이 소진되었습니다',
  },
  {
    cardId: 'economic-vs-regulatory-capital',
    when: { metric: 'economicTce', lt: 2 },
    institutionTypes: ['bank'],
    reason: '경제적 자기자본이 얇습니다',
  },
  {
    cardId: 'uninsured-deposits-and-run-speed',
    when: { metric: 'dailyOutflowPct', gt: 3 },
    institutionTypes: ['bank'],
    reason: '당일 유출률이 3%를 넘었습니다',
  },
  {
    cardId: 'bank-run-dynamics',
    when: { metric: 'runState', gte: 2 },
    institutionTypes: ['bank'],
    reason: '런 상태가 공개 런(S2) 이상입니다',
  },
  {
    cardId: 'crisis-communication',
    when: { metric: 'confidence', lt: 50 },
    reason: '신뢰지수가 50 아래입니다',
  },
  {
    cardId: 'regulator-escalation-ladder',
    when: { metric: 'regulatorLevel', gte: 2 },
    reason: '감독당국이 제한 조치 단계에 들어갔습니다',
  },
  {
    cardId: 'htm-tainting',
    when: { metric: 'unrealizedLossPctCet1', gt: 50 },
    institutionTypes: ['bank'],
    reason: '미실현손실이 CET1의 절반을 넘습니다',
  },
]
