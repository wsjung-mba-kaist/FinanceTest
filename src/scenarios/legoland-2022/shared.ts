import type { Decision, Option, SecuritiesState, Turn } from '../../engine/types'
import { securitiesFx } from '../../engine/fx/securities'
import { legoFx } from './localFx'

export type T = Turn<SecuritiesState>
export type O = Option<SecuritiesState>

/** 출처 id 단축 (sources.ts). */
export const S = {
  pkg: 'fsc-2022-10-23',
  fsc1028: 'fsc-78804',
  ncr32: 'fsc-2022-11-09',
  kdb1111: 'fsc-2022-11-11',
  prog1124: 'fsc-2022-11-24',
  fsc2023: 'fsc-80034',
  lr2027: 'fsc-86917',
  callLimit: 'fsc-call-market-2015',
  bokOmo: 'bok-omo-2022-10-27',
  bokAct: 'bok-act',
  bokRate: 'bok-base-rate',
  fsr: 'bok-fsr-2022-12',
  kofia: 'kofia-bond',
  fss: 'fss-pf-2022',
  kcmiLee: 'kcmi-lee-2022-18',
  kcmi23: 'kcmi-23-10',
  kis: 'kis-pf-2022-03',
  bai: 'bai-gangwon-2015',
  gangwon: 'gangwon-2022',
  bcbs144: 'bcbs-144',
  fsb: 'fsb-depositor-behaviour-2024',
  bcbs555: 'bcbs-d555',
  pDefault: 'press-abcp-default-2022-10',
  pHeungkuk: 'press-heungkuk-2022-11',
  pCp: 'press-cp-2022-11-25',
  pDaol: 'press-daol-2022-11',
  pMaturity: 'press-abcp-maturity-2022-10',
} as const

export interface RolloverCfg {
  turn: number
  /** 자체매입 ABCP 신용위험액 위험값 (11/9 특례 전 1.0, 이후 0.32) */
  riskWeight: number
  prompt: string
  context: string
  honour: { rating: number; rationale: string; consequences: string; historicalNote?: string }
  negotiate: { rating: number; rationale: string; consequences: string; extendShare: number }
  abandon: { rating: number; rationale: string; consequences: string; trapExplanation: string }
  /** 추가 옵션(턴 특수). */
  extra?: O[]
}

/**
 * 매턴 반복되는 "차환 실패분 처리" 결정. 옵션 A(이행)·B(만기연장 협상)·C(불이행)는 모든 턴에 공통이며
 * 위험값·평점·서사만 턴별로 다르다. A가 역사 옵션이다.
 */
export function rolloverDecision(c: RolloverCfg): Decision<SecuritiesState> {
  const id = `t${c.turn}-d1`
  return {
    id,
    title: '차환 실패분 처리',
    prompt: c.prompt,
    context: c.context,
    requiredConcepts: ['pf-abcp-commitment-ncr'],
    dimensions: ['liquidity', 'solvency', 'compliance'],
    options: [
      {
        id: `${id}-a`,
        label: '매입확약 이행: 차환 실패분 전액 자체매입',
        description: `이번 턴 만기 도래분 중 시장에서 차환되지 않은 금액을 약정대로 사들인다. 현금이 줄고 보유 ABCP가 늘며 신용위험액이 위험값 ${(c.riskWeight * 100).toFixed(0)}%로 가산된다. 매입확약은 유동화증권 발행 조건이므로 이행은 법적·실무적으로 즉시 가능하다.`,
        effects: [
          securitiesFx.rolloverStep({
            honourCommitment: true,
            riskWeight: c.riskWeight,
            label: '매입확약 이행(자체매입)',
          }),
        ],
        expert: {
          rating: c.honour.rating,
          rationale: c.honour.rationale,
          historicalNote: c.honour.historicalNote,
          sourceRefs: [S.kcmi23, S.fsc2023],
        },
        consequences: c.honour.consequences,
        historical: true,
        feasibility: {
          basis: '매입확약은 유동화 약정상 의무 — 즉시 이행 가능',
          sourceRefs: [S.kcmi23],
        },
        calibrationNote: `자체매입 = 만기 × (1 − 차환률); 신용위험액 += 매입액 × ${c.riskWeight} [CAL]`,
      },
      {
        id: `${id}-b`,
        label: 'SPC·투자자와 만기 연장 협상 후 잔여분만 매입',
        description: `차환 실패분 중 투자자 동의를 받은 부분(신뢰지수 40 이상이면 ${(c.negotiate.extendShare * 100).toFixed(0)}%, 미만이면 그 40%)을 2턴 뒤로 연장하고 나머지를 자체매입한다. 연장분에는 수수료(0.5%)가 붙는다. 만기 연장은 유동화 약정 변경으로 투자자·시공사 동의가 필요하지만 부도가 아니므로 신용공여 신뢰는 유지된다.`,
        effects: [
          legoFx.negotiatedRollover({
            extendShare: c.negotiate.extendShare,
            riskWeight: c.riskWeight,
            ciFloor: 40,
            feeRate: 0.005,
            label: '만기 연장 협상 + 잔여분 자체매입',
          }),
        ],
        expert: {
          rating: c.negotiate.rating,
          rationale: c.negotiate.rationale,
          sourceRefs: [S.kcmi23, S.fsc2023],
        },
        consequences: c.negotiate.consequences,
        feasibility: {
          basis:
            '유동화증권 만기 연장(리파이낸싱 조건 변경)은 투자자 동의 시 가능 — 2022년 다수 사업장에서 실행',
          sourceRefs: [S.fsc2023],
        },
        calibrationNote: '연장 동의율은 신뢰지수 임계(40)로 분기; 연장분은 사다리 +2턴 [CAL]',
      },
      {
        id: `${id}-c`,
        label: '매입확약 불이행: 차환 실패분 부도 처리',
        description:
          '약정을 이행하지 않고 SPC 부도를 방치한다. 현금과 NCR은 당장 보전되지만 시장은 "증권사 신용공여도 믿을 수 없다"고 읽는다. 소송·제재 리스크가 따르며 되돌릴 수 없다.',
        effects: [
          securitiesFx.rolloverStep({
            honourCommitment: false,
            riskWeight: c.riskWeight,
            label: '매입확약 불이행(부도 방치)',
          }),
        ],
        expert: {
          rating: c.abandon.rating,
          rationale: c.abandon.rationale,
          sourceRefs: [S.kcmi23, S.fsc2023, S.fsr],
        },
        consequences: c.abandon.consequences,
        trap: true,
        trapExplanation: c.abandon.trapExplanation,
        irreversible: true,
        feasibility: {
          basis: '계약 위반이지만 물리적으로 가능 — 감독당국 제재·투자자 소송 대상',
          sourceRefs: [S.kcmi23],
        },
      },
      ...(c.extra ?? []),
    ],
  }
}
