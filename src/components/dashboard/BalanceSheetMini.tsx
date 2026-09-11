import type {
  BankState,
  InstitutionState,
  PensionState,
  SecuritiesState,
  Units,
} from '../../engine'
import { formatCurrency, formatNumber } from '../../lib/format'
import { usePlay } from '../play/playContext'
import { Card } from '../ui'

interface Segment {
  label: string
  value: number
  note?: string
}

// Neutral accent shades: severity colours are reserved for borders/chips.
const FILLS = ['bg-accent', 'bg-accent/75', 'bg-accent/55', 'bg-accent/35', 'bg-accent/20']

function StackedBar({
  title,
  segments,
  units,
}: {
  title: string
  segments: Segment[]
  units: Units
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0)
  const summary = segments.map((s) => `${s.label} ${formatCurrency(s.value, units)}`).join(', ')
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium">{title}</span>
        <span className="num text-muted">{formatCurrency(total, units)}</span>
      </div>
      <div
        className="mt-1 flex h-4 w-full gap-px overflow-hidden rounded bg-surface-2"
        role="img"
        aria-label={`${title}: ${summary}`}
      >
        {segments.map((s, i) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={s.label}
              className={`${FILLS[i % FILLS.length]} h-full`}
              style={{ width: `${pct}%` }}
              title={`${s.label} ${formatCurrency(s.value, units)}`}
            />
          )
        })}
      </div>
      <ul className="mt-1 grid grid-cols-2 gap-x-2 text-[11px]">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-sm ${FILLS[i % FILLS.length]}`}
              aria-hidden="true"
            />
            <span className="truncate text-muted" title={s.note}>
              {s.label}
            </span>
            <span className="num ml-auto">{formatCurrency(s.value, units)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BankSheet({ bank, units }: { bank: BankState; units: Units }) {
  const loans = bank.loans.retail + bank.loans.sme + bank.loans.corporate + bank.loans.fi
  const insured = bank.deposits.filter((d) => d.insured).reduce((a, d) => a + d.balance, 0)
  const uninsured = bank.deposits.filter((d) => !d.insured).reduce((a, d) => a + d.balance, 0)
  const w = bank.wholesale
  const wholesale =
    w.unsecuredShort + w.unsecuredLong + w.repoL1 + w.repoL2A + w.repoOther + w.cbAdvances
  const equity = bank.capital.cet1 + bank.capital.at1 + bank.capital.tier2
  const htmLoss = Math.max(0, bank.securities.htm.bookValue - bank.securities.htm.marketValue)
  const afsLoss = Math.max(0, bank.securities.afs.bookValue - bank.securities.afs.marketValue)
  const assets: Segment[] = [
    { label: '현금·지준', value: bank.cash },
    {
      label: 'AFS 증권(시가)',
      value: bank.securities.afs.marketValue,
      note: `장부가 ${formatCurrency(bank.securities.afs.bookValue, units)}`,
    },
    {
      label: 'HTM 증권(장부가)',
      value: bank.securities.htm.bookValue,
      note: `시가 ${formatCurrency(bank.securities.htm.marketValue, units)}`,
    },
    {
      label: '대출',
      value: loans,
      note: `부실 ${formatCurrency(bank.loans.nonPerforming, units)}`,
    },
    { label: '기타 자산', value: bank.otherAssets },
  ]
  const liabilities: Segment[] = [
    { label: '보험 예금', value: insured },
    { label: '무보험 예금', value: uninsured },
    {
      label: '도매 조달',
      value: wholesale,
      note: `담보차입 ${formatCurrency(w.cbAdvances, units)}`,
    },
    { label: '기타 부채', value: bank.otherLiabilities },
    { label: '자본', value: equity },
  ]
  return (
    <div className="space-y-3">
      <StackedBar title="자산" segments={assets} units={units} />
      <StackedBar title="부채·자본" segments={liabilities} units={units} />
      <p className="text-[11px] text-muted">
        미실현손실 AFS {formatCurrency(afsLoss, units)} · HTM {formatCurrency(htmLoss, units)}
        {bank.htmTainted ? ' · HTM 재분류(tainting) 발생' : ''}
      </p>
    </div>
  )
}

function PensionSheet({ p, units }: { p: PensionState; units: Units }) {
  const ldi = p.assets.ldi
  const collateral = ldi.collateral.cash + ldi.collateral.eligibleGilts
  const assets: Segment[] = [
    { label: '현금', value: p.assets.cash },
    {
      label: '길트(직접 보유)',
      value: p.assets.gilts.marketValue,
      note: `듀레이션 ${p.assets.gilts.modDuration}y`,
    },
    { label: '회사채', value: p.assets.corporateBonds.marketValue },
    { label: '주식', value: p.assets.equities },
    { label: '비유동 자산', value: p.assets.illiquid },
    {
      label: 'LDI 풀 자본',
      value: Math.max(0, ldi.equity),
      note: `익스포저 ${formatCurrency(ldi.exposure, units)}`,
    },
  ]
  const liabilities: Segment[] = [
    {
      label: '연금 부채(PV)',
      value: p.liabilities.pv,
      note: `듀레이션 ${p.liabilities.modDuration}y`,
    },
  ]
  return (
    <div className="space-y-3">
      <StackedBar title="자산" segments={assets} units={units} />
      <StackedBar title="부채" segments={liabilities} units={units} />
      <p className="text-[11px] text-muted">
        LDI 담보 {formatCurrency(collateral, units)} · 마진콜 대기{' '}
        {formatCurrency(ldi.marginCallOutstanding, units)} · 헤지비율{' '}
        {formatNumber(p.hedgeRatio * 100, 0)}% · 스폰서 여력{' '}
        {formatCurrency(p.sponsor.contributionCapacity, units)}
      </p>
    </div>
  )
}

function SecuritiesSheet({ s, units }: { s: SecuritiesState; units: Units }) {
  const maturing30 = s.pf.abcpMaturing.slice(0, 4).reduce((a, b) => a + b, 0)
  const assets: Segment[] = [
    { label: '현금', value: Math.max(0, s.liquidity.cash) },
    { label: '매각 가능 증권', value: s.liquidity.sellableSecurities },
    { label: '자체 매입 ABCP', value: s.pf.abcpHeld },
    { label: '브릿지론', value: s.pf.bridgeLoans },
    { label: '외화 유동자산', value: s.liquidity.fxLiquid },
  ]
  const liabilities: Segment[] = [
    { label: '콜차입', value: s.funding.call },
    { label: 'RP', value: s.funding.repo },
    { label: 'CP·전단채', value: s.funding.cp },
    {
      label: '은행 크레딧라인(인출)',
      value: s.liquidity.creditLinesDrawn,
      note: `한도 ${formatCurrency(s.liquidity.creditLines, units)}`,
    },
    { label: '자기자본', value: Math.max(0, s.equityCapital) },
  ]
  return (
    <div className="space-y-3">
      <StackedBar title="유동성 자산" segments={assets} units={units} />
      <StackedBar title="조달·자본" segments={liabilities} units={units} />
      <p className="text-[11px] text-muted">
        PF 매입약정·보증 잔액 {formatCurrency(s.pf.abcpGuaranteed, units)} · 30일 차환 만기{' '}
        {formatCurrency(maturing30, units)} · 차환 성공률 {formatNumber(s.pf.rollRate * 100, 0)}% ·
        총위험액 {formatCurrency(s.risk.market + s.risk.credit + s.risk.operational, units)}
      </p>
    </div>
  )
}

function flattenNumbers(
  obj: unknown,
  prefix = '',
  depth = 0,
  out: [string, number][] = [],
): [string, number][] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 2) return out
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'kind' || k === 'custom') continue
    if (typeof v === 'number') out.push([`${prefix}${k}`, v])
    else if (v && typeof v === 'object' && !Array.isArray(v))
      flattenNumbers(v, `${prefix}${k}.`, depth + 1, out)
  }
  return out
}

function KeyFigures({ institution }: { institution: InstitutionState }) {
  const rows = flattenNumbers(institution).slice(0, 16)
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-muted" title={k}>
            {k}
          </dt>
          <dd className="num m-0 text-right">{formatNumber(v, Number.isInteger(v) ? 0 : 2)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Bank: stacked asset/liability bars. Other institutions: generic key-figure list from `state.institution`. */
export function BalanceSheetMini() {
  const { scenario, state } = usePlay()
  const inst = state.institution
  return (
    <Card as="section" aria-labelledby="bs-title" className="p-2">
      <h3 id="bs-title" className="text-[12px] font-semibold">
        {inst.kind === 'bank' || inst.kind === 'pension' || inst.kind === 'securities'
          ? '대차대조표 미니뷰'
          : '주요 수치'}
      </h3>
      <div className="mt-2">
        {inst.kind === 'bank' ? (
          <BankSheet bank={inst} units={scenario.units} />
        ) : inst.kind === 'pension' ? (
          <PensionSheet p={inst} units={scenario.units} />
        ) : inst.kind === 'securities' ? (
          <SecuritiesSheet s={inst} units={scenario.units} />
        ) : (
          <KeyFigures institution={inst} />
        )}
      </div>
    </Card>
  )
}
