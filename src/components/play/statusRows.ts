import type { ConfidenceState, GameState, MetricValue, ScenarioDefinition } from '../../engine'
import { latestSnapshot } from '../../engine'
import { formatCurrency, formatMetric, formatPct } from '../../lib/format'
import type { Tone } from '../ui'

export interface StatusRow {
  id: string
  /** Row group heading (창구·거래상대 / 자본·매각 / 노출). */
  group: string
  label: string
  value: string
  tone: Tone
  /** Secondary figure or condition, one short clause. */
  note?: string
}

export interface ConfidenceBar {
  id: keyof ConfidenceState
  label: string
  value: number
}

const CONFIDENCE_LABELS: Partial<Record<keyof ConfidenceState, string>> = {
  depositors: '예금자·고객',
  counterparties: '거래상대',
  investors: '투자자',
  board: '이사회',
}

/** Stakeholder confidence bars, straight from `ConfidenceState`. */
export function confidenceBars(state: GameState): ConfidenceBar[] {
  return (Object.keys(CONFIDENCE_LABELS) as (keyof ConfidenceState)[])
    .filter((k) => Number.isFinite(state.confidence[k]))
    .map((k) => ({ id: k, label: CONFIDENCE_LABELS[k] ?? k, value: state.confidence[k] }))
}

export function confidenceTone(value: number): Tone {
  if (value >= 70) return 'positive'
  if (value >= 50) return 'info'
  if (value >= 30) return 'warning'
  return 'critical'
}

function on(state: GameState, ...keys: string[]): boolean {
  return keys.some((k) => Boolean(state.flags[k]))
}

function metricRow(
  snap: Record<string, MetricValue>,
  scenario: ScenarioDefinition,
  key: string,
  group: string,
  label?: string,
): StatusRow | undefined {
  const mv = snap[key]
  if (!mv || !Number.isFinite(mv.value)) return undefined
  const spec = scenario.kpis.find((k) => k.metric === key)
  return {
    id: key,
    group,
    label: label ?? spec?.label ?? mv.label,
    value: formatMetric(mv.value, mv.unit, scenario.units, spec?.decimals),
    tone: mv.status === 'breach' ? 'critical' : mv.status === 'warn' ? 'warning' : 'neutral',
  }
}

/**
 * The war-room status board: which facilities are actually usable today, what has been
 * promised to whom, and how exposed the balance sheet is right now. Every row is derived
 * from state (flags, counters, institution fields) — nothing is authored per scenario.
 */
export function buildStatusRows(scenario: ScenarioDefinition, state: GameState): StatusRow[] {
  const snap = latestSnapshot(state).metrics
  const units = scenario.units
  const ccy = (v: number) => formatCurrency(v, units)
  const rows: (StatusRow | undefined)[] = []
  const inst = state.institution

  if (inst.kind === 'bank') {
    const prepositioned = on(state, 'collateral_prepositioned', 'weekend_collateral_prepared')
    rows.push({
      id: 'cb-window',
      group: '창구·거래상대',
      label: '중앙은행 재할인창구',
      value: prepositioned ? '담보 사전 예치' : '담보 미예치',
      tone: prepositioned ? 'positive' : 'warning',
      note: `당일 가능 ${ccy(inst.wholesale.cbFacilityCapacity)}`,
    })
    rows.push({
      id: 'facility',
      group: '창구·거래상대',
      label: '담보차입 여력',
      value: `당일 ${ccy(inst.wholesale.cbFacilityCapacity)}`,
      tone: inst.wholesale.cbFacilityCapacity > 0 ? 'neutral' : 'warning',
      note: `익일 +${ccy(inst.wholesale.cbFacilityPending)} · 잔액 ${ccy(inst.wholesale.cbAdvances)}`,
    })
    rows.push({
      id: 'raise',
      group: '자본·매각',
      label: '증자',
      value: on(state, 'raise_closed', 'recap_complete')
        ? '완료'
        : on(state, 'raise_failed')
          ? '실패·철회'
          : on(state, 'raise_announced') || (state.counters.dilution ?? 0) > 0
            ? '진행 중'
            : '미착수',
      tone: on(state, 'raise_closed', 'recap_complete')
        ? 'positive'
        : on(state, 'raise_failed')
          ? 'critical'
          : on(state, 'raise_announced') || (state.counters.dilution ?? 0) > 0
            ? 'warning'
            : 'neutral',
    })
    rows.push({
      id: 'sale',
      group: '자본·매각',
      label: '매각·백스톱',
      value: on(state, 'buyer_exists')
        ? '인수 후보 확인'
        : on(state, 'sale_process')
          ? '매각 절차 개시'
          : on(state, 'backstop_arranged', 'btfp_ready', 'programme_used')
            ? '백스톱 확보'
            : '미착수',
      tone: on(state, 'buyer_exists', 'backstop_arranged', 'btfp_ready')
        ? 'positive'
        : on(state, 'sale_process')
          ? 'warning'
          : 'neutral',
    })
    rows.push(metricRow(snap, scenario, 'uninsuredShare', '노출'))
    rows.push(metricRow(snap, scenario, 'cumulativeOutflow', '노출'))
    rows.push(metricRow(snap, scenario, 'lcr', '노출'))
    if (on(state, 'false_statement', 'capacity_shortfall_exposed', 'disclosure_backfired')) {
      rows.push({
        id: 'disclosure',
        group: '노출',
        label: '공시·커뮤니케이션',
        value: on(state, 'false_statement') ? '사실과 다른 설명 노출' : '설명이 확인되지 않음',
        tone: 'critical',
      })
    } else if (on(state, 'capacity_disclosed', 'verified_disclosure', 'disclosure_verified')) {
      rows.push({
        id: 'disclosure',
        group: '노출',
        label: '공시·커뮤니케이션',
        value: '검증 가능한 수치 공개',
        tone: 'positive',
      })
    }
  } else if (inst.kind === 'securities') {
    const line = inst.liquidity.creditLines
    const drawn = inst.liquidity.creditLinesDrawn
    rows.push({
      id: 'credit-line',
      group: '창구·거래상대',
      label: '은행 크레딧라인',
      value: `한도 ${ccy(line)}`,
      tone: line - drawn > 0 ? 'neutral' : 'critical',
      note: `인출 ${ccy(drawn)} · 잔여 ${ccy(Math.max(0, line - drawn))}`,
    })
    const bok = on(state, 'bok_window_open', 'programme_used', 'pdcf_expanded')
    const ksfc = on(state, 'ksfc_window_open', 'sponsor_standby')
    rows.push({
      id: 'policy-window',
      group: '창구·거래상대',
      label: '한은·증권금융 창구',
      value: bok || ksfc ? '개방' : '미개방',
      tone: bok || ksfc ? 'positive' : 'warning',
      note: [bok ? '한은 프로그램' : undefined, ksfc ? '증권금융' : undefined]
        .filter(Boolean)
        .join(' · '),
    })
    rows.push({
      id: 'roll',
      group: '차환',
      label: '차환 성공률',
      value: formatPct(inst.pf.rollRate * 100, 0),
      tone: inst.pf.rollRate >= 0.8 ? 'neutral' : inst.pf.rollRate >= 0.5 ? 'warning' : 'critical',
      note: `이번 턴 만기 ${ccy(inst.pf.abcpMaturing[0] ?? 0)}`,
    })
    rows.push({
      id: 'guarantee',
      group: '차환',
      label: '매입약정·신용공여',
      value: ccy(inst.pf.abcpGuaranteed),
      tone: 'neutral',
      note: `자체 매입 ${ccy(inst.pf.abcpHeld)}`,
    })
    rows.push(metricRow(snap, scenario, 'ncr', '노출'))
    rows.push(metricRow(snap, scenario, 'marginCallPending', '노출'))
  } else if (inst.kind === 'pension') {
    const ldi = inst.assets.ldi
    rows.push({
      id: 'ldi-collateral',
      group: '창구·거래상대',
      label: 'LDI 풀 담보',
      value: ccy(ldi.collateral.cash + ldi.collateral.eligibleGilts),
      tone: 'neutral',
      note: `현금 ${ccy(ldi.collateral.cash)} · 적격국채 ${ccy(ldi.collateral.eligibleGilts)}`,
    })
    rows.push({
      id: 'margin-call',
      group: '창구·거래상대',
      label: '마진콜 대기',
      value: ccy(ldi.marginCallOutstanding),
      tone: ldi.marginCallOutstanding > 0 ? 'critical' : 'positive',
    })
    rows.push(metricRow(snap, scenario, 'collateralHeadroomBp', '노출'))
    rows.push({
      id: 'sponsor',
      group: '자본·매각',
      label: '스폰서 여력',
      value: ccy(inst.sponsor.contributionCapacity),
      tone:
        inst.sponsor.covenant === 'strong'
          ? 'positive'
          : inst.sponsor.covenant === 'medium'
            ? 'neutral'
            : 'warning',
      note: `커버넌트 ${inst.sponsor.covenant === 'strong' ? '견고' : inst.sponsor.covenant === 'medium' ? '보통' : '취약'}`,
    })
    rows.push(metricRow(snap, scenario, 'hedgeRatio', '노출'))
  }

  let out = rows.filter((r): r is StatusRow => Boolean(r))
  if (out.length === 0) {
    out = scenario.kpis
      .filter((k) => !k.primary)
      .slice(0, 6)
      .map((k) => metricRow(snap, scenario, k.metric, '노출'))
      .filter((r): r is StatusRow => Boolean(r))
  }
  return out
}
