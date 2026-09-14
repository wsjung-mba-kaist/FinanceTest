import type { Interrupt, SecuritiesState } from '../../engine/types'
import { securitiesFx } from '../../engine/fx/securities'
import { confidence, flag, op, ownStockMove, regulator } from '../../engine/fx/common'
import {
  S,
  bokSwapBid,
  settleAprilPolicyFunding,
  convertToBackToBack,
  cpRolloverStep,
  drawAllLines,
  equityFundContribution,
  marginCallStep,
  marginCutoffCheck,
  marginFxDrift,
  payMarginFx,
  payUpToRoll,
  policyFunding,
  reduceHedge,
  repoRaise,
  setFxLiquidityPolicy,
  setOwnCpRate,
  setRollRate,
  settlementCheck,
  unhedgedMark,
  type T,
} from './fx'
import { MARGIN, T4_PROFILE } from './turnsA'

/**
 * T4~T7 (2020-03-23 ~ 04-02). 정책 대응이 차례로 도착하지만 **범위와 집행 시차**가 다르다:
 * 3/19 밤 한미 통화스와프 600억달러(입찰은 3/31), 3/24 100조 패키지(채안펀드 매입은 4월 초),
 * 3/26 무제한 RP(첫 입찰 4/2, 증권사 11개사 대상 추가), 3/31 통화스와프 1차 입찰 87.2억달러 낙찰.
 */

const TICK_LABELS = [
  '08:30 해외 종가',
  '10:30 오전',
  '12:30 점심',
  '15:30 장 마감',
  '19:00 해외 증거금 마감',
]

// =============================================================================================
// T4 — 2020-03-23 (월) "차환의 벽" — 5틱
// =============================================================================================
const t4Interrupt: Interrupt<SecuritiesState> = {
  id: 't4-i1',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't4-i1-summary',
  scoreWeight: 0.5,
  required: false,
  title: '금융감독원 자본시장감독국',
  prompt: '담당 국장이 파생결합증권 발행사 외화유동성 일일 보고를 요구합니다.',
  context:
    '감독당국은 업계 전체의 증거금 소요를 집계하고 있습니다. 보고 내용은 정책 설계의 입력이 되며, 동시에 검사 기록으로 남습니다.',
  source: {
    kind: 'regulator',
    caller: '자본시장감독국 담당 국장',
    agency: '금융감독원',
    tone: 'concerned',
  },
  lines: [
    {
      speaker: '담당 국장',
      text: '자체헤지 발행사 전체의 증거금 소요를 집계하고 있습니다. 귀사의 누적 납입액, 외화 유동자산 잔액, 향후 2주 소요 전망을 오늘 중 보내 주십시오.',
    },
    {
      speaker: '담당 국장',
      text: '수치가 정확해야 대책의 규모가 정해집니다. 업계 공동 대응이 필요하다면 그것도 적어 주십시오.',
    },
  ],
  dimensions: ['compliance', 'policy', 'communication'],
  options: [
    {
      id: 't4-i1-precise',
      label: '실제 수치를 즉시 보고하고 업계 공동 창구를 요청',
      description:
        '누적 납입액·외화 잔액·2주 소요 전망을 그대로 보고하고, 증권사가 접근할 수 있는 외화 공급 창구가 필요하다고 명시한다.',
      effects: [
        flag('fss_reported'),
        confidence(4, '감독당국에 정확한 수치 보고'),
        { kind: 'counter', key: 'policyRequests', add: 1 },
      ],
      expert: {
        rating: 86,
        rationale:
          '정책의 규모는 집계된 수치로 정해진다. 2020년 3월 하순의 대책들(무제한 RP, 증권사 RP 대상 편입, 통화스와프자금 배분)은 업계가 보고한 소요 위에서 설계됐다. 정확한 보고는 규제 리스크를 줄이면서 창구를 앞당긴다.',
        sourceRefs: [S.bokRp, S.dlsPlan, S.assembly],
      },
      consequences:
        '보고서가 제출되었습니다. 국장은 "같은 내용을 보내온 곳이 여럿"이라고 답했습니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1, note: '감독 신뢰 +' }],
    },
    {
      id: 't4-i1-summary',
      label: '개괄 수치만 보고',
      description: '구간으로만 답하고 상세 내역은 다음 정기 보고에 담겠다고 한다.',
      effects: [{ kind: 'counter', key: 'fssSummaryOnly', add: 1 }],
      expert: {
        rating: 45,
        rationale:
          '위법은 아니지만 정책 설계의 입력을 흐린다. 업계 전체가 같은 태도를 취하면 대책은 늦게, 작게 나온다.',
        sourceRefs: [S.dlsPlan],
      },
      consequences: '개괄 보고가 제출되었습니다.',
      historical: true,
    },
    {
      id: 't4-i1-selfreliant',
      label: '자체 대응 가능하다고 답변',
      description: '유동성에 문제가 없으며 자체 대응이 가능하다고 답한다. 감독 부담이 줄어든다.',
      effects: [flag('claimed_selfreliant'), { kind: 'counter', key: 'fssSelfReliant', add: 1 }],
      delayedEffects: [
        {
          afterTurns: 1,
          when: { metric: 'fxLiquid', lt: 2000 },
          description: '보고와 실제 외화 사정의 불일치가 확인된다',
          effects: [confidence(-10, '보고 불일치'), regulator({ add: 1 }, '현장 점검')],
        },
      ],
      expert: {
        rating: 20,
        rationale:
          '자체 대응 가능하다는 답변은 지원 대상에서 스스로를 제외시키는 동시에, 실제 소요가 드러나면 보고 신뢰를 잃는다. 감독당국은 결제은행·청산회원 경로로 실제 자금 흐름을 따로 본다.',
        sourceRefs: [S.dlsPlan, S.fsr],
      },
      consequences: '자체 대응이 가능하다고 답했습니다. 후속 자료 요구는 없었습니다.',
      trap: true,
      trapExplanation:
        '감독 부담을 줄이고 "관리되고 있다"는 인상을 준다. 그러나 정책 창구는 집계된 소요에 비례해 열리므로, 소요를 축소 보고하면 자기 몫의 창구가 작아진다.',
      remediationCard: 'regulator-escalation-ladder',
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2020년 3월 23일 (월) KST',
  title: '차환의 벽: 9,000억 만기',
  time: '2020-03-23T08:30:00+09:00',
  ticks: 5,
  tickLabels: TICK_LABELS,
  entryEffects: [
    { id: 't4-pay-residual', effects: [payMarginFx({ label: '3/19 잔여 증거금 납입' })] },
    { id: 't4-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't4-market',
      description: '3/20 미국 종가 2,304.92(3/18 대비 −3.89%), VIX 61.59',
      effects: [
        op('market.custom.oseaIndex', 'set', 84.08, '해외지수 84.08 (3/20 종가)'),
        op('market.equityIndex', 'set', 1566.15, 'KOSPI 3/20 종가에서 출발'),
        op('market.volIndex', 'set', 61.59, 'VIX 61.59'),
        op('market.fxUsdLocal', 'set', 1254.1, '원/달러 1,254.1 (3/20 가중평균)에서 출발'),
        op('market.custom.cp91', 'set', 156, 'CP91 1.56%'),
        op('market.custom.cd91', 'set', 102, 'CD91 1.02%'),
        op('market.fundingStressBp', 'set', 54, 'CP−CD 54bp'),
        op('market.custom.govt3y', 'set', 115, '국고채 3년 1.153%'),
        op('market.custom.corpAA3y', 'set', 201, '회사채 AA- 3년 2.010%'),
        op('market.creditSpreadIgBp', 'set', 86, 'AA- − 국고 86bp'),
        op('market.custom.swapBasisBp', 'set', -180, 'FX 스왑 베이시스 −180bp'),
        setOwnCpRate({ premiumBp: 55 }),
      ],
    },
    {
      id: 't4-roll',
      description: '차환률 62% — MMF 유출과 CP 수요처 이탈',
      effects: [
        setRollRate(0.62, 'MMF 유출·CP 수요처 이탈'),
        cpRolloverStep({ label: '3/23 만기 차환(9,000억)' }),
      ],
    },
    {
      id: 't4-delta',
      description: '복제 델타 추가 상승(+2%p)',
      effects: [op('institution.custom.hedgeDelta', 'add', 0.02, '델타 상승')],
    },
    { id: 't4-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t4.indexMovePct })] },
    {
      id: 't4-ci',
      description: '차환 실패·마진콜 보도 — 신뢰지수 −7',
      effects: [confidence(-7, '차환 실패·마진콜 보도'), ownStockMove(-0.07, '증권주 하락')],
    },
    { id: 't4-settle', effects: [settlementCheck()] },
  ],
  eachTick: [
    {
      id: 't4-margin-tick',
      description: '해외 지수선물 변동증거금·개시증거금 통지(일중 분배)',
      effects: [marginCallStep({ ...MARGIN.t4, profile: T4_PROFILE, label: '3/23 증거금 통지' })],
    },
  ],
  tickEffects: [
    {
      id: 't4-cutoff-pay',
      atTick: 4,
      description: '환율 재평가 후 19시 해외 증거금 마감',
      effects: [
        marginFxDrift({ fxAtTurnStart: MARGIN.t4.fxTurn }),
        payMarginFx({ label: '19:00 증거금 납입' }),
        marginCutoffCheck(),
      ],
    },
  ],
  ticker: {
    series: [
      {
        path: 'market.equityIndex',
        mode: 'absolute',
        values: [1566.15, 1530, 1500, 1482.46, 1482.46],
      },
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1254.1, 1262, 1270, 1276, 1274.6] },
      { path: 'market.custom.cp91', mode: 'absolute', values: [156, 158, 160, 162, 162] },
    ],
  },
  interrupts: [t4Interrupt],
  events: [
    {
      id: 't4-swapline',
      kind: 'regulator',
      agency: '한국은행',
      time: '08:00',
      headline: '[지난 목요일 밤] 한국은행–연준 통화스왑 600억달러 체결',
      body: '한국은행은 3월 19일 밤 미국 연방준비제도와 600억달러 규모의 통화스왑 계약을 체결했다고 발표했다. 2008년(300억달러)의 두 배 규모다. 다만 실제 자금이 시장에 공급되는 입찰 일정은 아직 공고되지 않았다.',
      severity: 'positive',
      sourceRefs: [S.swap],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't4-open',
      kind: 'market',
      time: '08:30',
      headline: '간밤 해외 종가와 지난 금요일 국내 마감',
      items: [
        { label: 'S&P 500 (3/20)', value: '2,304.92', change: '3/18 대비 −3.89%' },
        { label: 'KOSPI (3/20)', value: '1,566.15', change: '+7.44%' },
        { label: '원/달러(3/20 가중평균)', value: '1,254.1', change: '−26.0원' },
        { label: 'CP(91일)', value: '1.56%', change: '+9bp (3/19 대비)' },
        { label: 'CD(91일)', value: '1.02%', change: '보합' },
      ],
      sourceRefs: [S.sp500, S.ecosEquity, S.ecosFx, S.ecosRate],
    },
    {
      id: 't4-memo-roll',
      kind: 'memo',
      atTick: 0,
      time: '08:50',
      from: '자금부장',
      to: '자금담당임원',
      subject: '금일 CP·전단채 만기 9,000억 — 차환 의사 62%',
      body: `- 오늘 만기 9,000억원 중 재투자 의사를 확인한 물량은 약 62%입니다. **차환 실패분 약 3,420억원은 현금으로 상환**해야 합니다.
- 이탈 사유는 신용이 아니라 환매입니다. MMF에서 자금이 빠지면서 CP를 살 돈 자체가 없습니다. CP 잔액의 63.5%를 금융·보험사가 들고 있는 구조라 환매가 곧 수요 소멸입니다.
- 발행금리를 80bp 올리면 차환 의사가 74%까지 회복될 것으로 봅니다.
- 동시에 오늘 증거금도 들어옵니다. 원화와 달러가 같은 날 필요합니다.`,
      severity: 'critical',
      sourceRefs: [S.kcmiHwang, S.pCp],
      relatedMetrics: ['abcpMaturingNext', 'rollRate', 'cash', 'ownCpRate'],
      cardRefs: ['contingency-funding-plan'],
    },
    {
      id: 't4-news-margin',
      kind: 'newswire',
      outlet: '한국경제',
      atTick: 1,
      time: '11:20',
      headline: '자체헤지 증권사 마진콜 누적 수조원대 — "달러가 없다"',
      body: '해외 지수를 기초로 한 자체헤지 ELS를 다수 발행한 증권사들이 해외 거래소 증거금 납입을 위해 달러를 구하고 있다. 업계에서는 지난주 이후 누적 규모가 수조원대라는 추정이 나온다. 증권사들의 달러 매입이 원/달러 상승 요인으로도 지목된다.',
      severity: 'warning',
      reliability: 'unconfirmed',
      sourceRefs: [S.pMargin],
    },
    {
      id: 't4-close',
      kind: 'market',
      atTick: 3,
      time: '15:30',
      headline: '국내 마감',
      items: [
        { label: 'KOSPI', value: '1,482.46', change: '−5.34%' },
        { label: '원/달러(당일 가중평균)', value: '1,274.6', change: '+20.5원' },
        { label: 'FX 스왑 베이시스(1개월)', value: '−180bp', change: '−30bp' },
      ],
      sourceRefs: [S.ecosEquity, S.ecosFx],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '차환 실패분 대응',
      prompt:
        '오늘 만기 9,000억 중 약 3,420억이 차환되지 않습니다. 어떻게 메우시겠습니까? (최대 2개)',
      context:
        '같은 날 증거금도 들어옵니다. 원화를 만드는 방법마다 담보 소진·손실 실현·시장 신호의 비용이 다릅니다.',
      select: { min: 1, max: 2 },
      availableFrom: 1,
      deadlineTick: 3,
      defaultOptionId: 't4-d1-a',
      requiredConcepts: ['contingency-funding-plan', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'solvency', 'timeliness'],
      timeLimitSec: 150,
      options: [
        {
          id: 't4-d1-a',
          label: '발행금리 80bp 인상해 차환률 회복',
          description:
            '자사 CP·전단채 발행금리를 80bp 올려 재투자 의사를 끌어올린다. 차환률이 12%p 회복되고 분기 조달비용이 늘어난다.',
          effects: [payUpToRoll({ extraBp: 80, rollGain: 0.12 })],
          expert: {
            rating: 72,
            rationale:
              '가격을 올려 차환하는 것은 정상적인 대응이며, 3월 증권사 CP 발행이 21.2조원(+34.2%)으로 급증한 것이 그 흔적이다. 다만 금리를 올린 발행은 다음 만기에도 그 금리를 물고 돌아온다.',
            historicalNote: '증권사들은 발행금리를 올려 CP 발행을 크게 늘렸다.',
            sourceRefs: [S.pCp, S.kcmiHwang],
          },
          consequences: '발행금리를 올려 차환 물량 대부분을 소화했습니다. 조달비용이 올랐습니다.',
          historical: true,
          feasibility: {
            basis: 'CP 발행시장 가동 — 금리 조정으로 수요 확보 가능',
            sourceRefs: [S.pCp],
          },
          calibrationNote: '+80bp → 차환률 +12%p, 비용 = CP 잔액 × 80bp × 0.25 [CAL]',
          preview: [{ metric: 'rollRate', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't4-d1-b',
          label: 'RP 매도 4,000억 확대',
          description:
            '남은 미담보 채권으로 RP를 늘린다. 헤어컷이 8%로 올랐고 담보 여력이 그만큼 줄어든다.',
          effects: [repoRaise({ amount: 4000, haircut: 0.08, rateBp: 150 })],
          expert: {
            rating: 78,
            rationale:
              '담보부 조달은 위기에 가장 늦게 닫힌다. 3월 26일 한국은행이 무제한 RP를 시작하면 같은 담보가 더 싼 창구로 옮겨 간다 — 그때까지 담보를 남겨 두는 것이 이 선택의 유일한 반론이다.',
            sourceRefs: [S.cgfs, S.bokRp],
          },
          consequences: 'RP로 원화를 확보했습니다. 미담보 채권이 줄었습니다.',
          feasibility: { basis: 'RP 시장 가동, 헤어컷 확대', sourceRefs: [S.cgfs] },
        },
        {
          id: 't4-d1-c',
          label: '보유 채권 6,000억 매각',
          description:
            '미담보 채권을 시장에 판다. 스프레드가 벌어져 2.0% 할인에 체결되고 손실이 자본에 실현된다. 담보 여력도 함께 사라진다.',
          effects: [securitiesFx.sellSecurities({ amount: 6000, discount: 0.02 })],
          expert: {
            rating: 40,
            rationale:
              '유동성은 만들어지지만 NCR과 담보 여력을 동시에 깎는다. 이 시나리오가 가르치려는 상충이 정확히 여기에 있다 — 팔면 현금이 생기고 자본이 줄며, 들고 있으면 자본은 지키지만 현금이 없다.',
            sourceRefs: [S.bcbs555, S.cgfs],
          },
          consequences: '채권이 체결되었습니다. 매각손이 자본에서 빠졌습니다.',
          feasibility: {
            basis: '채권시장 유동성 저하 상태에서 할인 체결',
            sourceRefs: [S.bcbs555],
          },
          calibrationNote: '할인 2.0%(스프레드 확대 정점 구간) [CAL]',
        },
        {
          id: 't4-d1-d',
          label: '원화 크레딧라인 4,000억 인출',
          description:
            '미사용 원화 크레딧라인의 절반을 인출한다. 확정 라인이라 당일 실행되며, 절반만 쓰면 신호 효과가 작다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bank', amount: 4000, rateBp: 180 })],
          expert: {
            rating: 80,
            rationale:
              '확정 라인은 이런 날을 위해 있다. 부분 인출은 유동성 관리로 읽히고 전액 동시 인출은 공시로 읽힌다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '원화 라인 4,000억이 인출되었습니다.',
          feasibility: { basis: '기존 약정 한도 내 당일 인출', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't4-d1-e',
          label: '원화·외화 확정 라인을 전부 동시 인출',
          description:
            '남은 원화·외화 라인을 전액 인출한다. 오늘의 차환 실패분과 증거금이 한 번에 해결된다.',
          effects: [drawAllLines({ ciPenalty: 12 })],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '주거래은행들이 미사용 한도를 축소한다',
              effects: [confidence(-4, '은행 라인 한도 축소')],
            },
          ],
          expert: {
            rating: 16,
            rationale:
              '오늘을 해결하고 다음 주를 잃는다. 은행 여신담당자 전원이 같은 날 같은 결론에 도달하면 남은 한도는 사라지고 CP 매수자도 같은 판단을 한다.',
            sourceRefs: [S.bcbs144, S.fsb],
          },
          consequences:
            '모든 라인이 인출되었습니다. 오늘은 해결되었고, 내일부터는 새로 만들 재원이 없습니다.',
          trap: true,
          trapExplanation:
            '차환 실패와 증거금이 같은 날 겹치면 "가진 것을 다 쓰자"는 판단이 합리적으로 보인다. 그러나 확정 라인의 가치는 잔여 한도에 있으며, 전부 쓰는 순간 그 가치가 0이 된다.',
          remediationCard: 'contingency-funding-plan',
          irreversible: true,
          feasibility: { basis: '기존 약정 한도 내 — 계약상 즉시 가능', sourceRefs: [S.bcbs144] },
        },
      ],
    },
    {
      id: 't4-d2',
      title: '헤지 북 구성',
      prompt: '증거금 소요가 2주째 이어집니다. 자체헤지 북을 어떻게 하시겠습니까? (최대 2개)',
      context:
        '자체헤지는 델타를 직접 복제하므로 지수가 움직일 때마다 외화 증거금이 나갑니다. 백투백은 그 의무를 상대방에게 넘기지만 평상시에도 비용이 듭니다. 위기 중 전환은 비쌉니다.',
      select: { min: 1, max: 2 },
      availableFrom: 2,
      requiredConcepts: ['ldi-collateral-waterfall', 'pf-abcp-commitment-ncr'],
      dimensions: ['marketRisk', 'solvency', 'liquidity'],
      options: [
        {
          id: 't4-d2-a',
          label: '자체헤지 구조 그대로 유지',
          description:
            '헤지는 계속 복제하고 증거금은 조달로 감당한다. 비용이 들지 않고 지수 위험도 열리지 않는다.',
          effects: [{ kind: 'counter', key: 'hedgeHeld', add: 1 }],
          expert: {
            rating: 62,
            rationale:
              '리스크 관리 측면에서는 옳다 — 헤지를 유지하면 지수 위험이 열리지 않는다. 문제는 이 선택이 유동성 문제를 전적으로 조달로 푼다는 점이며, 조달이 막히면 강제 청산으로 끝난다. 업계의 실제 선택이었다.',
            historicalNote: '대형 자체헤지사들은 헤지를 유지하고 달러를 조달했다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences: '헤지를 유지했습니다. 증거금은 계속 들어옵니다.',
          historical: true,
          feasibility: { basis: '현상 유지', sourceRefs: [S.fss] },
        },
        {
          id: 't4-d2-b',
          label: '자체헤지 20%를 백투백으로 전환',
          description:
            '자체헤지 잔액의 20%를 해외 투자은행에 넘긴다. 증거금 의무가 이전되고 시장위험액이 줄지만, 위기 중 전환 수수료는 90bp로 평시의 세 배다.',
          effects: [convertToBackToBack({ share: 0.2, costBp: 90, label: '백투백 전환 20%' })],
          expert: {
            rating: 74,
            rationale:
              '비싸지만 구조를 바꾸는 유일한 선택이다. 금융위는 2020년 7월 자체헤지 비중 자체를 규제 대상으로 삼았다 — 전환 비용은 사후 규제가 강제할 비용의 선지급이다.',
            sourceRefs: [S.dlsPlan, S.fss],
          },
          consequences: '자체헤지 잔액이 줄었습니다. 앞으로의 증거금 소요가 20% 감소합니다.',
          feasibility: {
            basis: '기존 백투백 상대방과의 추가 거래 — 위기 중 가격 급등',
            sourceRefs: [S.fss],
          },
          calibrationNote: '전환 수수료 90bp(위기 중), 시장위험액 −전환액×5% [CAL]',
        },
        {
          id: 't4-d2-c',
          label: '헤지 델타 40% 축소',
          description:
            '선물 포지션의 40%를 정리해 증거금 소요를 크게 줄인다. 비용이 들지 않고 오늘부터 달러 수요가 감소한다.',
          effects: [reduceHedge({ share: 0.4, label: '헤지 40% 축소' })],
          expert: {
            rating: 18,
            rationale:
              '증거금이 사라지는 대신 ELS 부채의 지수 위험이 40% 열린다. 지수가 더 내려가면 손실이 자본을 직접 때리고, 시장위험액 증가로 NCR도 함께 내려간다. 2020년 1분기 파생결합증권 손익 △9,067억은 2019년 연간 이익 7,501억을 한 분기에 넘어선 규모다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences: '증거금 소요가 크게 줄었습니다. 지수 위험이 40% 열린 채 남았습니다.',
          trap: true,
          trapExplanation:
            '달러가 없는 상황에서 "달러가 필요 없게 만드는" 선택은 즉효처럼 보인다. 그러나 헤지를 푸는 것은 유동성 위기를 손익 위기로 바꾸는 것일 뿐이며, 지수가 반등해도 손실이 난다(반등분을 못 따라간다). 이 시나리오에서 NCR을 무너뜨릴 수 있는 유일한 경로다.',
          remediationCard: 'ldi-collateral-waterfall',
          feasibility: { basis: '선물 포지션 청산 — 당일 체결 가능', sourceRefs: [S.fss] },
        },
        {
          id: 't4-d2-d',
          label: '신규 ELS 발행 중단',
          description:
            '자체헤지 ELS 신규 발행을 중단한다. 잔액은 줄지 않지만 더 늘지도 않으며, 발행 수수료 수익이 사라진다.',
          effects: [
            flag('els_issuance_halted'),
            op('institution.equityCapital', 'add', -120, '발행 수수료 수익 상실'),
          ],
          expert: {
            rating: 80,
            rationale:
              '위기 중 자체헤지 잔액을 늘리지 않는 것은 가장 값싼 조치다. 금융위는 사후에 발행 자체를 규제 대상으로 삼았고(레버리지비율 가중치 상향), 업계도 2분기부터 발행을 크게 줄였다.',
            sourceRefs: [S.dlsPlan, S.seibro],
          },
          consequences: '신규 발행을 중단했습니다. 수수료 수익이 사라집니다.',
          feasibility: { basis: '발행 중단은 내부 결정 사항 — 즉시 가능', sourceRefs: [S.dlsPlan] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '오늘은 원화(차환 실패분)와 달러(증거금)가 동시에 필요합니다. 두 재원은 서로 대체되지 않습니다.',
      decisionId: 't4-d1',
    },
    {
      level: 2,
      text: '헤지를 줄이면 증거금은 줄지만 시장위험액이 늘어 NCR이 내려갑니다. 대시보드에서 두 지표를 함께 보십시오.',
      cardRefs: ['ldi-collateral-waterfall'],
      decisionId: 't4-d2',
    },
  ],
  relatedCards: ['contingency-funding-plan', 'ldi-collateral-waterfall'],
}

// =============================================================================================
// T5 — 2020-03-24 (화) "100조"
// =============================================================================================
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2020년 3월 24일 (화) KST',
  title: '제2차 비상경제회의: 100조',
  time: '2020-03-24T09:00:00+09:00',
  entryEffects: [
    { id: 't5-pay-residual', effects: [payMarginFx({ label: '3/23 잔여 증거금 납입' })] },
    { id: 't5-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't5-market',
      description: '3/23 미국 종가 2,237.40(저점), KOSPI +8.60%',
      effects: [
        op('market.custom.oseaIndex', 'set', 81.62, '해외지수 81.62 (3/23 종가·저점)'),
        op('market.equityIndex', 'set', 1609.97, 'KOSPI 1,609.97 (+8.60%)'),
        op('market.volIndex', 'set', 61.67, 'VIX 61.67'),
        op('market.fxUsdLocal', 'set', 1256, '원/달러 당일 가중평균 1,256.0'),
        op('market.custom.cp91', 'set', 166, 'CP91 1.66%'),
        op('market.custom.cd91', 'set', 107, 'CD91 1.07%'),
        op('market.fundingStressBp', 'set', 59, 'CP−CD 59bp'),
        op('market.custom.govt3y', 'set', 113, '국고채 3년 1.127%'),
        op('market.custom.corpAA3y', 'set', 201, '회사채 AA- 3년 2.006%'),
        op('market.creditSpreadIgBp', 'set', 88, 'AA- − 국고 88bp'),
        op('market.custom.swapBasisBp', 'set', -140, 'FX 스왑 베이시스 −140bp'),
        setOwnCpRate({ premiumBp: 60 }),
      ],
    },
    {
      id: 't5-roll',
      description: '차환률 68%',
      effects: [setRollRate(0.68, '대책 발표 직후'), cpRolloverStep({ label: '3/24 만기 차환' })],
    },
    {
      id: 't5-delta',
      effects: [op('institution.custom.hedgeDelta', 'add', 0.01, '델타 소폭 상승')],
    },
    { id: 't5-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t5.indexMovePct })] },
    {
      id: 't5-margin',
      description: '3/23 미국 세션 −2.93%에 따른 증거금 통지',
      effects: [marginCallStep({ ...MARGIN.t5, label: '3/24 증거금 통지' })],
    },
    {
      id: 't5-policy',
      description: '채안펀드 상담과 증권금융 지원대출 창구 안내',
      effects: [flag('bond_fund_open'), flag('ksf_loan_open')],
    },
    {
      id: 't5-ci',
      description: '100조 패키지 발표 — 신뢰지수 +6',
      effects: [confidence(6, '100조 기업구호 패키지'), ownStockMove(0.09, '증권주 반등')],
    },
    { id: 't5-settle', effects: [settlementCheck()] },
  ],
  events: [
    {
      /**
       * The correction to `t4-news-margin`, and the one that corrects to *nothing*.
       *
       * The "누적 수조원대" estimate was never confirmed and never denied. It was not published by
       * the supervisor at the time and still has not been — this project's own fact ledger carries
       * `industry.marginCallTotal` as unresolved, with the closing document named as a National
       * Assembly document request that was never made public.
       *
       * Every other correction in this project resolves one way or the other. This one has to say
       * "the number was never published", because that is what happened, and because a player who
       * only ever sees rumours resolved learns to wait for resolution. In a funding squeeze the
       * number you are trading on is often the one nobody will ever confirm.
       */
      id: 't5-news-margin-unconfirmed',
      kind: 'newswire',
      outlet: '경제지 종합',
      time: '08:40',
      headline: '[후속] 마진콜 누적 규모, 당국 집계 공표 없음 — 업계 추정만 남았다',
      body:
        '지난주 보도된 "누적 수조원대"는 확인도 부인도 되지 않았다. 금융감독원은 자체헤지 증거금 ' +
        '납입 규모를 집계해 공표한 적이 없고, 사별 수치는 각사가 밝히지 않는다. 시장이 그 주에 ' +
        '가격에 반영한 것은 확인된 수치가 아니라 추정치였다.',
      severity: 'warning',
      // `confirmed`, not `unconfirmed`: the *absence* of a published figure is itself an
      // established fact. The estimate stays unverified — that is what the body says — but this
      // item is not a second rumour, and marking it as one would leave the thread open forever.
      reliability: 'confirmed',
      correctionOf: 't4-news-margin',
      sourceRefs: [S.fsr, S.kcmiLee],
    },
    {
      id: 't5-emergency2',
      kind: 'regulator',
      agency: '대한민국 정부·금융위원회',
      time: '10:00',
      headline: '제2차 비상경제회의 — 100조원 기업구호 긴급자금',
      body: '채권시장안정펀드 20조원(1차 캐피탈콜 3조원, 실제 매입은 4월 초 개시), 증권시장안정펀드 10.7조원, 단기자금시장 지원 7조원(증권사 유동성 지원 5조원과 기업 CP·전단채 지원 2조원) 등을 담은 100조원 규모 지원 방안이 발표됐다. 금융회사들이 출자하는 캐피탈콜 방식이므로 자금 집행에는 시차가 있다.',
      severity: 'positive',
      sourceRefs: [S.em2],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't5-market',
      kind: 'market',
      time: '15:30',
      headline: '국내 마감',
      items: [
        { label: 'KOSPI', value: '1,609.97', change: '+8.60%' },
        { label: '원/달러(당일 가중평균)', value: '1,256.0', change: '−18.6원' },
        { label: 'CP(91일)', value: '1.66%', change: '+10bp' },
        { label: 'CD(91일)', value: '1.07%', change: '+5bp' },
        { label: 'S&P 500 (3/23)', value: '2,237.40', change: '−2.93%, 저점' },
      ],
      sourceRefs: [S.ecosEquity, S.ecosFx, S.ecosRate, S.sp500],
    },
    {
      id: 't5-memo-scope',
      kind: 'memo',
      time: '11:20',
      from: '기획재무팀',
      to: '자금담당임원',
      subject: '발표된 프로그램의 범위와 집행 시차',
      body: `- 채권시장안정펀드 20조: 대상은 회사채와 우량 CP입니다. 캐피탈콜 방식이라 1차 3조원이 모이고 실제 매입은 **4월 초**부터입니다.
- 단기자금 지원 7조는 증권사 유동성 5조(증권금융 대출·한은 RP)와 기업 CP·전단채 2조입니다. 증권사 CP를 5조 매입하는 프로그램이 아닙니다.
- 증권시장안정펀드 10.7조: 우리가 **출자하는** 쪽입니다. 현금이 나가고 출자금은 영업용순자본 차감항목이 됩니다.
- 외화에 대한 조치는 없습니다. 통화스와프 자금의 배분 방식은 아직 공고되지 않았습니다.`,
      severity: 'warning',
      sourceRefs: [S.em2, S.swap],
      relatedMetrics: ['cash', 'ncr', 'fxLiquid'],
      cardRefs: ['korea-crisis-toolkit'],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '정책 창구 활용',
      prompt: '발표된 프로그램 중 어디에 신청하시겠습니까? (최대 2개)',
      context:
        '발표와 집행은 다릅니다. 자기 물량이 적격인 창구만 자금이며, 캐피탈콜 방식은 돈이 모이는 데 시간이 걸립니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['korea-crisis-toolkit', 'contingency-funding-plan'],
      dimensions: ['policy', 'liquidity'],
      options: [
        {
          id: 't5-d1-a',
          label: '증권금융 지원대출 5,000억 신청',
          description:
            '증권금융 대출 창구에 신청한다. 이 모형은 사전 심사·담보 적격성이 확인된 한도 2,500억원을 이번 구간에 실행한다고 가정한다. 담보는 예약되고 대출 부채가 생기며, 남은 신청액은 확정 자금이 아니다.',
          effects: [
            policyFunding({ programme: 'ksfloan', amount: 5000, scopeShare: 0.5, rateBp: 200 }),
          ],
          expert: {
            rating: 80,
            rationale:
              '증권금융 대출은 기업 CP 매입과 다른 경로다. 확약된 금액과 실행일, 담보 여력을 확인한 부분만 자금계획에 넣는다. 신청만으로 잔여 금액까지 확정되는 것은 아니다.',
            sourceRefs: [S.em2, S.bcbs144],
          },
          consequences:
            '모형의 심사·담보 한도 안에서 증권금융 대출이 실행됐습니다. 미실행 신청액은 현금에 포함하지 않습니다.',
          historical: true,
          feasibility: { basis: '3/24 발표된 프로그램 — 신청 접수 개시', sourceRefs: [S.em2] },
          calibrationNote:
            '신청 5,000 중 한도 50%·금리 2%·담보 할인 5%·해당 구간 실행은 합성 기관 가정 [CAL]; 실제 회사의 대출 실적 아님',
        },
        {
          id: 't5-d1-b',
          label: '채안펀드에 매입 적격성과 일정 확인 요청',
          description:
            '4,000억원 규모의 매각 후보를 상담하되, 매입 적격성과 실행 확약이 확인되기 전에는 현금화하지 않는다. 채안펀드는 4월 초 매입을 준비 중이다.',
          effects: [
            policyFunding({ programme: 'bondfund', amount: 4000, scopeShare: 0.2, rateBp: 210 }),
          ],
          expert: {
            rating: 55,
            rationale:
              '매입 대상과 일정 확인은 필요하지만, 지금의 지급 재원을 대신하지 못한다. 이 모형에는 적격 회사채 매각 확약이 없어 해당 신청의 현금 유입을 0으로 처리한다.',
            sourceRefs: [S.em2],
          },
          consequences:
            '적격성·일정을 문의했습니다. 매입 확약이 없어 현금과 차입 잔액은 변하지 않습니다.',
          feasibility: {
            basis: '캐피탈콜 진행 중 — 상담 가능, 매입 확약 없음',
            sourceRefs: [S.em2],
          },
        },
        {
          id: 't5-d1-c',
          label: '원화 크레딧라인 추가 인출',
          description:
            '정책 창구를 기다리지 않고 남은 원화 라인에서 3,000억을 인출한다. 확정 라인이라 오늘 들어온다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bank', amount: 3000, rateBp: 190 })],
          expert: {
            rating: 70,
            rationale:
              '정책 창구의 집행 시차를 메우는 정석적 조치다. 다만 라인 잔여 한도는 유한하므로 정책 자금이 들어오면 갚아야 한다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '원화 라인이 인출되었습니다.',
          feasibility: { basis: '기존 약정 한도 내 당일 인출', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't5-d1-d',
          label: '발표 효과를 기다리며 신청하지 않는다',
          description:
            '100조 발표만으로 시장이 정상화될 것으로 보고 신청 절차를 밟지 않는다. 비용도 서류도 없다.',
          effects: [{ kind: 'counter', key: 'policySkipped', add: 1 }],
          expert: {
            rating: 24,
            rationale:
              '발표 효과는 심리이고 집행은 자금이다. CP 금리는 이 발표 이후에도 계속 올라 4월 2일 2.24%로 정점을 찍었다 — 발표가 시장을 되돌린 것이 아니라 집행이 되돌렸다.',
            sourceRefs: [S.ecosRate, S.em2],
          },
          consequences: '신청하지 않았습니다. 다음 만기는 그대로 돌아옵니다.',
          trap: true,
          trapExplanation:
            '"100조"라는 숫자는 모든 문제가 해결된 것처럼 보이게 한다. 그러나 CP(91일) 금리는 발표 다음 날 1.66%에서 3월 31일 2.20%, 4월 2일 2.24%까지 계속 올랐다. 발표일과 집행일 사이의 거리가 이 시나리오의 정책 학습 지점이다.',
          remediationCard: 'korea-crisis-toolkit',
          feasibility: { basis: '현상 유지', sourceRefs: [S.em2] },
        },
      ],
    },
    {
      id: 't5-d2',
      title: '증권시장안정펀드 출자',
      prompt: '증권시장안정펀드 10.7조원에 대한 출자 요청이 왔습니다. 어떻게 하시겠습니까?',
      context:
        '증안펀드는 금융회사가 출자하는 캐피탈콜 방식입니다. 출자금은 현금으로 나가고 영업용순자본에서 차감됩니다. 불참은 정책 협조 측면에서 기록에 남습니다.',
      select: { min: 1, max: 1 },
      requiredConcepts: ['korea-crisis-toolkit', 'regulator-escalation-ladder'],
      dimensions: ['policy', 'compliance', 'solvency'],
      options: [
        {
          id: 't5-d2-a',
          label: '요청받은 1,500억 전액 출자',
          description:
            '업권 분담 비율대로 1,500억원을 출자한다. 현금이 나가고 출자금만큼 영업용순자본이 줄어 NCR이 내려간다.',
          effects: [equityFundContribution({ amount: 1500 })],
          expert: {
            rating: 68,
            rationale:
              '정책 협조는 이후 창구 접근에 영향을 준다. 증안펀드는 실제로 대부분 집행되지 않았지만, 출자 약정 자체가 당시 시장 안정 신호였다. 유동성이 빠듯한 시점에 현금을 내보내는 비용은 분명하다.',
            sourceRefs: [S.em2],
          },
          consequences: '출자가 완료되었습니다. 현금과 NCR이 함께 내려갔습니다.',
          historical: true,
          feasibility: { basis: '업권 분담 요청 — 이사회 승인 후 즉시 납입', sourceRefs: [S.em2] },
          calibrationNote: '출자금은 영업용순자본 차감항목(deductions)에 가산 [CAL]',
        },
        {
          id: 't5-d2-b',
          label: '500억으로 축소 협의',
          description:
            '외화 유동성 사정을 설명하고 출자 규모를 줄인다. 현금 부담이 줄지만 업권 내 조정 부담이 생긴다.',
          effects: [equityFundContribution({ amount: 500 }), confidence(-2, '출자 축소 협의')],
          expert: {
            rating: 62,
            rationale:
              '유동성 제약을 근거로 규모를 조정하는 것은 정당하다. 다만 근거가 되는 수치를 감독당국에 이미 보고해 두었어야 설득력이 있다.',
            sourceRefs: [S.em2, S.dlsPlan],
          },
          consequences: '출자 규모가 축소되었습니다.',
          feasibility: { basis: '분담 비율 조정 협의 가능', sourceRefs: [S.em2] },
        },
        {
          id: 't5-d2-c',
          label: '유동성을 이유로 불참',
          description:
            '현재 유동성 사정으로는 출자할 수 없다고 통보한다. 현금은 지키지만 정책 협조 기록이 남는다.',
          effects: [
            flag('equity_fund_declined'),
            confidence(-5, '증안펀드 불참'),
            regulator({ add: 1 }, '정책 협조 미이행'),
          ],
          expert: {
            rating: 30,
            rationale:
              '출자 거절은 공동 시장안정 노력에 대한 평가에 영향을 줄 수 있다. 다만 증안펀드 출자를 한국은행 RP 대상기관 선정이나 외화대출 배정의 법정 조건으로 간주해서는 안 된다. 각 창구의 적격요건과 심사는 별도다.',
            sourceRefs: [S.bokRp, S.em2],
          },
          consequences: '불참을 통보했습니다. 감독당국의 태도가 달라졌습니다.',
          trap: true,
          trapExplanation:
            '유동성이 빠듯한 국면에서 나가는 현금을 막는 것은 교과서적 대응처럼 보인다. 그러나 이 시나리오에서 남은 두 개의 창구(3/26 한국은행 RP 대상기관 편입, 3/31 통화스와프자금 배분)는 모두 감독당국과의 관계 위에서 열린다 — 1,500억을 아끼고 수천억짜리 창구에서 뒤로 밀리는 거래다.',
          remediationCard: 'korea-crisis-toolkit',
          feasibility: { basis: '출자는 법적 의무가 아님 — 거부 가능', sourceRefs: [S.em2] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      text: '발표 규모가 아니라 "내 물량이 적격인가"와 "언제 돈이 나오는가"를 보십시오. 채안펀드 매입은 4월 초입니다.',
      cardRefs: ['korea-crisis-toolkit'],
      decisionId: 't5-d1',
    },
  ],
  relatedCards: ['korea-crisis-toolkit'],
}

// =============================================================================================
// T6 — 2020-03-26 (목) "무제한 RP"
// =============================================================================================
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2020년 3월 26일 (목) KST',
  title: '무제한 RP: 창구가 열리다',
  time: '2020-03-26T09:00:00+09:00',
  entryEffects: [
    { id: 't6-pay-residual', effects: [payMarginFx({ label: '3/24 잔여 증거금 납입' })] },
    { id: 't6-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't6-market',
      description: '3/24~3/25 미국 세션 누적 +10.65%, CP91 2.05%로 급등',
      effects: [
        op('market.custom.oseaIndex', 'set', 90.3, '해외지수 90.30 (3/25 종가)'),
        op('market.equityIndex', 'set', 1686.24, 'KOSPI 1,686.24'),
        op('market.volIndex', 'set', 61, 'VIX 61.00'),
        op('market.fxUsdLocal', 'set', 1227.9, '원/달러 당일 가중평균 1,227.9'),
        op('market.custom.cp91', 'set', 205, 'CP91 2.05%'),
        op('market.custom.cd91', 'set', 110, 'CD91 1.10%'),
        op('market.fundingStressBp', 'set', 95, 'CP−CD 95bp'),
        op('market.custom.govt3y', 'set', 107, '국고채 3년 1.067%'),
        op('market.custom.corpAA3y', 'set', 204, '회사채 AA- 3년 2.035%'),
        op('market.creditSpreadIgBp', 'set', 97, 'AA- − 국고 97bp'),
        op('market.custom.swapBasisBp', 'set', -80, 'FX 스왑 베이시스 −80bp'),
        setOwnCpRate({ premiumBp: 55 }),
      ],
    },
    {
      id: 't6-roll',
      description: '차환률 80% — 한국은행 창구 개설 기대',
      effects: [setRollRate(0.8, '한은 RP 창구 개설'), cpRolloverStep({ label: '3/26 만기 차환' })],
    },
    {
      id: 't6-delta',
      description: '지수 반등으로 복제 델타 하락(−2%p)',
      effects: [op('institution.custom.hedgeDelta', 'add', -0.02, '델타 하락')],
    },
    { id: 't6-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t6.indexMovePct })] },
    {
      id: 't6-margin',
      description: '해외지수 반등(+10.65%)에 따른 변동증거금 환급',
      effects: [marginCallStep({ ...MARGIN.t6, label: '3/26 증거금 환급' })],
    },
    {
      id: 't6-policy',
      description: '한국은행 무제한 RP 매입 — 증권사 11개사 RP 대상기관 추가',
      effects: [flag('bok_rp_open')],
    },
    {
      id: 't6-ci',
      description: '무제한 RP 발표 — 신뢰지수 +7',
      effects: [confidence(7, '한국은행 무제한 RP'), ownStockMove(0.06, '증권주 반등')],
    },
    { id: 't6-settle', effects: [settlementCheck()] },
  ],
  events: [
    {
      id: 't6-bok-rp',
      kind: 'regulator',
      agency: '한국은행',
      time: '16:00',
      headline: '한국은행, 무제한 환매조건부증권 매입 — 증권사 11개사를 대상기관에 추가',
      body: '한국은행은 2020년 4월부터 6월까지 매주 정례적으로 91일물 환매조건부증권을 사들이되 응찰 금액을 제한하지 않기로 했다. 최고낙찰금리는 0.85%이며, 공개시장운영 대상기관에 증권회사 11개사가 추가됐다. 첫 입찰은 4월 2일이다. 담보로는 국채와 정부보증채 등이 인정된다.',
      severity: 'positive',
      sourceRefs: [S.bokRp, S.bokAct],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't6-market-data',
      kind: 'data',
      time: '16:30',
      title: '단기금융시장 지표',
      rows: [
        { label: 'CP(91일)', value: '2.05% (3/12 1.55%)' },
        { label: 'CD(91일)', value: '1.10%' },
        { label: 'CP−CD 스프레드', value: '95bp' },
        { label: '회사채 AA- 3년', value: '2.035%' },
        { label: '국고채 3년', value: '1.067%' },
      ],
      sourceRefs: [S.ecosRate],
      relatedMetrics: ['market.cp91', 'market.cd91'],
    },
    {
      id: 't6-memo-structure',
      kind: 'memo',
      time: '17:00',
      from: '자금부장',
      to: '자금담당임원',
      subject: '조달 구조를 바꿀 기회',
      body: `- 한국은행 RP 대상기관에 편입되면 국채 담보로 91일물을 0.85% 이하에 조달할 수 있습니다. 현재 자사 CP 발행금리는 {{metric:ownCpRate}}%입니다.
- 무담보 단기조달(CP·콜)을 담보부(RP)로 바꾸면 같은 금액을 절반 이하 금리로, 만기는 3개월로 늘려 조달할 수 있습니다.
- 다만 담보로 쓸 국공채가 남아 있어야 합니다. 지난주에 채권을 팔았다면 그만큼 이 창구를 쓸 수 없습니다.
- CP 금리는 아직 오르고 있습니다(2.05%). 창구 개설과 금리 안정 사이에도 시차가 있습니다.`,
      severity: 'info',
      sourceRefs: [S.bokRp, S.ecosRate],
      relatedMetrics: ['liquidAssets', 'ownCpRate', 'cash'],
      cardRefs: ['hqla-and-haircuts'],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '한국은행 RP 창구',
      prompt: '대상기관 편입과 담보 구성을 어떻게 하시겠습니까?',
      context:
        'RP 담보로는 국채·정부보증채가 인정됩니다. 미담보 국공채가 남아 있어야 쓸 수 있는 창구입니다.',
      select: { min: 1, max: 1 },
      requiredConcepts: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
      dimensions: ['policy', 'liquidity'],
      options: [
        {
          id: 't6-d1-a',
          label: '대상기관 편입 확인 후 국채 담보로 6,000억 신청',
          description:
            '추가 선정 대상에 해당한다는 모형 가정 아래, 4/2 첫 RP 입찰을 준비하고 보유 국채를 예약한다. 오늘 현금은 늘지 않는다. 금리 0.85%는 훈련용 상한 가정이다.',
          effects: [policyFunding({ programme: 'bokrp', amount: 6000, scopeShare: 1, rateBp: 85 })],
          expert: {
            rating: 88,
            rationale:
              '범위가 100% 일치하고 금리가 가장 낮으며 만기가 가장 긴 창구다. 한국은행법 제68조 공개시장운영의 대상기관 확대는 2020년 3월 대응의 핵심이었고, 기존에도 일부 증권사는 RP 대상기관이었다. 이번 조치는 대상기관을 추가 확대했으며, 이 프로그램의 첫 입찰은 4/2이다.',
            sourceRefs: [S.bokRp, S.bokAct],
          },
          consequences:
            'RP 신청과 담보 예약이 반영됐습니다. 실제 조달은 4/2 결제 구간에서 반영됩니다.',
          historical: true,
          feasibility: {
            basis: '3/26 발표로 증권사 11개사 대상기관 추가 — 담보 적격 시 이용 가능',
            sourceRefs: [S.bokRp],
          },
          calibrationNote: '범위 일치 100%, 담보 여력 = 미담보 채권 × 95% [CAL]',
          preview: [{ metric: 'cash', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't6-d1-b',
          label: '최소한만 조달하고 담보를 남겨 둔다',
          description:
            '3,000억원의 4/2 RP 조달을 준비하고 필요한 담보만 예약한다. 결제 전 자금 수요는 기존 현금과 확정 라인으로 충당해야 한다.',
          effects: [policyFunding({ programme: 'bokrp', amount: 3000, scopeShare: 1, rateBp: 85 })],
          expert: {
            rating: 66,
            rationale:
              '예비 담보를 남기는 것은 합리적이지만, 0.85%로 조달할 수 있는 창구를 열어 두고 2%대 CP를 계속 굴리는 것은 비용이다. 담보는 남겨도 가격 차이는 남지 않는다.',
            sourceRefs: [S.bokRp],
          },
          consequences: '일부 담보를 예약했습니다. 4/2 결제 전까지 현금에 포함되지 않습니다.',
          feasibility: { basis: '조달 규모는 자율', sourceRefs: [S.bokRp] },
        },
        {
          id: 't6-d1-c',
          label: '신청하지 않는다 — 중앙은행 창구 이용이 낙인이 될 수 있다',
          description:
            '한국은행 창구 이용이 시장에 약점으로 읽힐 수 있다고 보고 신청하지 않는다. 비용도 서류도 없다.',
          effects: [{ kind: 'counter', key: 'bokRpSkipped', add: 1 }],
          expert: {
            rating: 22,
            rationale:
              '이번 조치는 11개사를 일괄 대상기관으로 추가한 제도 변경이지 개별 구제가 아니다. 광범위한 대상기관 확대는 개별 구제보다 낙인을 줄일 수 있지만, 시장이 어떻게 해석할지는 별도로 판단해야 한다.',
            sourceRefs: [S.bokRp, S.bokAct],
          },
          consequences: '신청하지 않았습니다. 조달은 계속 CP 시장에 의존합니다.',
          trap: true,
          trapExplanation:
            '재할인창구 낙인 효과는 실재하는 개념이라 그럴듯하다. 그러나 2020년 3월 26일의 조치는 증권사 11개사를 **일괄** 대상기관으로 추가한 제도 변경이었다. 일괄 조치에서 혼자 빠지는 것이 오히려 신호가 된다.',
          remediationCard: 'korea-crisis-toolkit',
          feasibility: { basis: '현상 유지', sourceRefs: [S.bokRp] },
        },
      ],
    },
    {
      id: 't6-d2',
      title: '조달 구조 재편',
      prompt: '창구가 열린 김에 조달 구조를 어떻게 바꾸시겠습니까? (최대 2개)',
      context:
        '무담보 단기조달(CP·콜)은 위기에 가장 먼저 닫히고, 담보부 조달(RP)은 가장 늦게 닫힙니다. 지금은 후자가 더 싸기까지 합니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['contingency-funding-plan', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'solvency', 'timeliness'],
      options: [
        {
          id: 't6-d2-a',
          label: '4/2 입금 후 콜·CP 상환 예약',
          description:
            '4/2 실제 입금 후 가용 현금 범위에서 콜차입 최대 4,000억과 CP 최대 3,000억을 상환하도록 예약한다. 결제 전에는 현금을 쓰지 않는다.',
          effects: [flag('april_refinance_planned')],
          expert: {
            rating: 84,
            rationale:
              '위기의 교훈은 언제나 만기 구조다. 익일물과 1개월물을 3개월 담보부로 바꾸면 다음 충격에서 버틸 수 있는 날이 늘어난다.',
            sourceRefs: [S.bcbs144, S.lr2027],
          },
          consequences: '4/2 결제 후 상환을 예약했습니다. 현재 차입 잔액은 그대로입니다.',
          feasibility: { basis: '만기 도래분 미차환 + 조기 상환', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't6-d2-b',
          label: '외화 유동자산 상시 보유 목표를 자체헤지 잔액의 10%로 설정',
          description:
            '자체헤지 발행잔액의 10%를 외화 유동자산으로 상시 보유하는 내부 규정을 만든다. 이번 사태에서 실제로 필요했던 수준이다.',
          effects: [setFxLiquidityPolicy({ targetShare: 0.1 }), flag('fx_policy_early')],
          expert: {
            rating: 90,
            rationale:
              '금융위원회는 2020년 7월 30일 「파생결합증권시장 건전화 방안」에서 자체헤지 발행잔액의 10~20%를 외화 유동자산으로 보유하도록 의무화했다. 넉 달 먼저 스스로 도입하는 것이 이 시나리오의 정답이다.',
            sourceRefs: [S.dlsPlan, S.bcbs144],
          },
          consequences: '내부 규정이 확정되었습니다. 외화 버퍼 목표가 대시보드에 표시됩니다.',
          feasibility: {
            basis: '내부 리스크관리 규정 — 이사회 결의로 즉시 가능',
            sourceRefs: [S.dlsPlan],
          },
        },
        {
          id: 't6-d2-c',
          label: '현 구조를 유지하고 만기 도래분만 관리',
          description:
            '구조 변경 없이 만기 도래분만 차환한다. 비용이 들지 않고 수익 구조도 그대로다.',
          effects: [{ kind: 'counter', key: 'structureUnchanged', add: 1 }],
          expert: {
            rating: 38,
            rationale:
              '시장이 진정되면 구조 개선의 동력도 사라진다. 업계 대부분이 그랬고, 그래서 금융위가 7월에 규정으로 강제해야 했다.',
            historicalNote: '조달 구조와 헤지 구성의 실질적 변경은 규제가 강제한 뒤에 이루어졌다.',
            sourceRefs: [S.dlsPlan],
          },
          consequences: '구조를 그대로 두었습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '시장이 진정되는 순간 구조 개선의 동력도 사라진다 — 비용은 오늘 발생하고 편익은 다음 위기에나 나타나기 때문이다. 업계 대부분이 이 선택을 했고, 그래서 금융위원회가 2020년 7월 30일 외화 유동자산 보유와 레버리지비율 가중치를 규정으로 강제해야 했다. 이 시나리오에서 가장 조용한 함정이다.',
          remediationCard: 'contingency-funding-plan',
          feasibility: { basis: '현상 유지', sourceRefs: [S.dlsPlan] },
        },
        {
          id: 't6-d2-d',
          label: '자체헤지 30%를 백투백으로 전환',
          description:
            '시장이 진정된 틈에 자체헤지 잔액의 30%를 백투백으로 넘긴다. 수수료는 70bp로 정점보다 내려왔다.',
          effects: [convertToBackToBack({ share: 0.3, costBp: 70, label: '백투백 전환 30%' })],
          expert: {
            rating: 78,
            rationale:
              '전환 비용이 내려온 시점에 구조를 바꾸는 것은 합리적이다. 2019년 말 업계 자체헤지 45.4조 대 백투백 25.7조의 구성이 이 사태의 출발점이었다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences: '자체헤지 잔액이 줄고 증거금 민감도가 낮아졌습니다.',
          feasibility: { basis: '시장 정상화 구간 — 전환 호가 회복', sourceRefs: [S.fss] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '한국은행 RP는 담보가 있어야 쓸 수 있습니다. 대시보드의 유동자산에서 미담보 채권이 얼마나 남았는지 확인하십시오.',
      cardRefs: ['hqla-and-haircuts'],
      decisionId: 't6-d1',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
}

// =============================================================================================
// T7 — 2020-03-31 (화) "통화스와프 1차 입찰"
// =============================================================================================
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2020년 3월 31일~4월 2일 KST',
  title: '통화스와프 입찰과 결제: 발표된 달러가 현금이 되기까지',
  time: '2020-03-31T17:00:00+09:00',
  ticks: 2,
  tickLabels: ['3/31 17:00 거래은행 차입 약정', '4/2 정책자금 결제'],
  tickEffects: [
    { id: 't7-policy-cash', atTick: 1, effects: [settleAprilPolicyFunding(), settlementCheck()] },
    {
      id: 't7-refinance',
      atTick: 1,
      when: { flag: 'april_refinance_planned' },
      effects: [
        securitiesFx.repay({ channel: 'call', amount: 4000 }),
        securitiesFx.repay({ channel: 'cp', amount: 3000 }),
      ],
    },
  ],
  entryEffects: [
    { id: 't7-pay-residual', effects: [payMarginFx({ label: '3/26 잔여 증거금 납입' })] },
    { id: 't7-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't7-market',
      description: '3/30 미국 종가 2,626.65, CP91 2.20%로 계속 상승',
      effects: [
        op('market.custom.oseaIndex', 'set', 95.81, '해외지수 95.81 (3/30 종가)'),
        op('market.equityIndex', 'set', 1754.64, 'KOSPI 1,754.64'),
        op('market.volIndex', 'set', 53.54, 'VIX 53.54'),
        op('market.fxUsdLocal', 'set', 1220, '원/달러 당일 가중평균 1,220.0'),
        op('market.custom.cp91', 'set', 220, 'CP91 2.20%'),
        op('market.custom.cd91', 'set', 110, 'CD91 1.10%'),
        op('market.fundingStressBp', 'set', 110, 'CP−CD 110bp'),
        op('market.custom.govt3y', 'set', 107, '국고채 3년 1.070%'),
        op('market.custom.corpAA3y', 'set', 208, '회사채 AA- 3년 2.077%'),
        op('market.creditSpreadIgBp', 'set', 101, 'AA- − 국고 101bp'),
        op('market.custom.swapBasisBp', 'set', -40, 'FX 스왑 베이시스 −40bp'),
        setOwnCpRate({ premiumBp: 45 }),
      ],
    },
    {
      id: 't7-roll',
      description: '차환률 90%',
      effects: [setRollRate(0.9, '단기금융시장 회복'), cpRolloverStep({ label: '3/31 만기 차환' })],
    },
    {
      id: 't7-delta',
      effects: [op('institution.custom.hedgeDelta', 'add', -0.02, '델타 하락')],
    },
    { id: 't7-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t7.indexMovePct })] },
    {
      id: 't7-margin',
      description: '해외지수 추가 반등(+6.10%)과 개시증거금률 인하에 따른 환급',
      effects: [marginCallStep({ ...MARGIN.t7, label: '3/31 증거금 환급' })],
    },
    {
      id: 't7-policy',
      description: '한국은행 통화스와프자금 대출 1차 입찰 실시',
      effects: [flag('bok_swap_open')],
    },
    {
      id: 't7-ci',
      description: '통화스와프자금 입찰 실시 — 신뢰지수 +5',
      effects: [confidence(5, '통화스와프자금 입찰 실시'), ownStockMove(0.05, '증권주 회복')],
    },
    { id: 't7-settle', effects: [settlementCheck()] },
  ],
  events: [
    {
      id: 't7-swap-auction',
      kind: 'regulator',
      agency: '한국은행',
      time: '3/31 입찰 결과',
      headline: '통화스왑자금 대출 1차 입찰 — 공급 예정 120억달러, 낙찰 87.2억달러',
      body: '한국은행은 연준과의 통화스왑 자금을 이용한 외화대출 1차 입찰을 실시했다. 공급 예정 금액 120억달러 중 87.2억달러가 낙찰됐다. 3월 19일 계약 체결로부터 12일 뒤의 입찰이며, 은행에 대한 실제 결제는 4월 2일이다. 증권사는 직접 입찰 대상이 아니므로 거래은행의 별도 외화대출 심사·약정이 필요하다.',
      severity: 'positive',
      sourceRefs: [S.swapAuction, S.swapTerms, S.swap],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't7-market-data',
      kind: 'data',
      time: '16:30',
      title: '3월 말 시장 지표',
      rows: [
        { label: 'KOSPI', value: '1,754.64 (3/19 저점 1,457.64)' },
        { label: '원/달러(당일 가중평균)', value: '1,220.0 (3/19 1,280.1)' },
        { label: 'CP(91일)', value: '2.20% (3/12 1.55%)' },
        { label: 'CD(91일)', value: '1.10%' },
        { label: 'CP−CD 스프레드', value: '110bp' },
        { label: '회사채 AA- 3년', value: '2.077%' },
      ],
      sourceRefs: [S.ecosRate, S.ecosEquity, S.ecosFx],
      relatedMetrics: ['market.cp91', 'market.cd91', 'fxUsdLocal'],
    },
    {
      id: 't7-memo-review',
      kind: 'memo',
      time: '17:00',
      from: '리스크관리본부장',
      to: '자금담당임원',
      subject: '3월 결산 전 점검 — 무엇이 구속조건이었나',
      body: `- 현재 미납 증거금은 {{metric:marginCallPending}}입니다. 이는 누적 통지액이 아닙니다. 매일 확인할 핵심은 **19시까지 납입 가능한 달러**와 손실 발생 후의 자본입니다.
- 원화 유동성은 넉넉했습니다. 기준금리는 내려갔고 CD는 1.10%입니다. 그런데 CP(91일)는 2.20%로 계속 오르고 있습니다 — 원화 시장 안에서도 조달 주체에 따라 값이 다릅니다.
- 통화스와프는 3/19 계약 → 3/31 은행 입찰 → 4/2 결제입니다. 증권사에 전달되는 금액과 시점은 거래은행 약정에 달려 있습니다. 약정 잔액은 입금 전까지 결제 재원이 아닙니다.
- 다음 분기 리스크위원회에 올릴 안건: 자체헤지 비중, 외화 유동자산 상시 보유 비율, 만기 구조.`,
      severity: 'info',
      sourceRefs: [S.swapAuction, S.ecosRate, S.dlsPlan],
      relatedMetrics: ['fxLiquid', 'marginCallPending', 'ncr', 'market.cp91'],
      cardRefs: ['ldi-collateral-waterfall', 'contingency-funding-plan'],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      deadlineTick: 0,
      defaultOptionId: 't7-d1-c',
      title: '거래은행을 통한 외화 버퍼 확충',
      prompt: '4월 2일 입금을 전제로 거래은행과 외화차입을 약정하시겠습니까?',
      context:
        '3/31 은행 입찰 결과는 87.2억달러입니다. 증권사는 직접 응찰 대상이 아닙니다. 이 모형에서는 거래은행이 4/2 입금, 한도 3,000억원 상당, 연 0.9%의 별도 외화차입을 제안합니다. 이는 실제 한국은행 낙찰금리나 증권사별 배정 실적이 아닙니다.',
      select: { min: 1, max: 1 },
      requiredConcepts: ['korea-crisis-toolkit', 'ldi-collateral-waterfall'],
      dimensions: ['policy', 'liquidity'],
      options: [
        {
          id: 't7-d1-a',
          label: '거래은행에 4,000억 상당의 외화차입을 신청한다',
          description:
            '요청 4,000억원 상당 중 모형 한도 3,000억원을 약정한다. 4/2 입금 전에는 외화 유동자산에 더하지 않는다. 연 0.9%는 거래은행 대출의 훈련 가정이다.',
          effects: [bokSwapBid({ amount: 4000, allocationCap: 3000, rateBp: 90 })],
          expert: {
            rating: 86,
            rationale:
              '입찰 미달만으로 증권사의 조달 완료를 추론할 수는 없다. 거래은행의 확약, 입금일, 총비용과 만기를 확인한 뒤 필요한 외화 버퍼를 확보한다. 이 선택은 3/31의 미납을 소급해서 해결하지 않는다.',
            sourceRefs: [S.swapAuction],
          },
          consequences:
            '거래은행 차입이 약정되었습니다. 4/2 결제 구간에서 외화 유동자산에 반영됩니다.',
          historical: true,
          feasibility: {
            basis: '은행만 직접 입찰 가능; 증권사 연계 차입은 거래은행 확약을 가정',
            sourceRefs: [S.swapTerms],
          },
          preview: [{ metric: 'fxLiquid', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't7-d1-b',
          label: '거래은행 차입을 1,000억 상당만 약정한다',
          description:
            '1,000억원 상당을 약정하며 4/2에 입금된다. 차입 비용은 작지만 이후 외화 수요에 대비한 버퍼도 작다.',
          effects: [bokSwapBid({ amount: 1000, allocationCap: 3000, rateBp: 90 })],
          expert: {
            rating: 60,
            rationale:
              '이자 비용은 줄지만, 넉 달 뒤 금융위가 자체헤지 잔액의 10~20% 외화 보유를 의무화한다는 점을 생각하면 버퍼를 얇게 두는 것은 곧 되돌릴 결정이다.',
            sourceRefs: [S.swapAuction, S.dlsPlan],
          },
          consequences: '1,000억원 상당을 약정했습니다. 4/2 입금 전에는 사용할 수 없습니다.',
          feasibility: {
            basis: '거래은행 한도 내 차입 규모 선택이라는 모형 가정',
            sourceRefs: [S.swapTerms],
          },
        },
        {
          id: 't7-d1-c',
          label: '거래은행 차입을 신청하지 않는다',
          description:
            '스왑 베이시스가 −40bp까지 좁혀졌으므로 시장에서 조달하면 된다고 보고 추가 차입을 신청하지 않는다.',
          effects: [{ kind: 'counter', key: 'swapAuctionSkipped', add: 1 }],
          expert: {
            rating: 34,
            rationale:
              '베이시스는 좁아졌지만 4월 CP 금리는 2.24%까지 더 올랐고 외화 조달 여건이 완전히 정상화된 것은 6월 이후다. 정책 자금은 열려 있을 때 확보하는 것이지, 필요할 때 열려 있지 않다.',
            sourceRefs: [S.swapAuction, S.ecosRate],
          },
          consequences: '거래은행 차입을 신청하지 않았습니다. 외화 버퍼는 그대로입니다.',
          trap: true,
          trapExplanation:
            '베이시스가 −40bp까지 좁혀진 것을 보면 "시장에서 사면 된다"는 판단이 자연스럽다. 그러나 1차 입찰이 미달(120억달러 공급 예정, 87.2억달러 낙찰)이었다는 사실은 싼 자금이 남아 있었다는 뜻이다 — 정책 자금은 열려 있을 때 받는 것이지 필요할 때 열려 있는 것이 아니다. CP 금리는 이 입찰 이후에도 4월 2일까지 더 올랐다.',
          remediationCard: 'korea-crisis-toolkit',
          feasibility: { basis: '현상 유지', sourceRefs: [S.swapAuction] },
        },
      ],
    },
    {
      id: 't7-d2',
      availableFrom: 1,
      title: '헤지 북의 미래',
      prompt:
        '리스크위원회에 올릴 자체헤지 북 방침을 정하십시오. 이 결정이 다음 위기의 출발점이 됩니다. (최대 2개)',
      context:
        '2019년 말 업계 자체헤지 45.4조원, 백투백 25.7조원이었습니다. 자체헤지는 수익성이 높고 백투백은 평상시에 비용이 듭니다. 이번 달에 그 비용의 반대편을 보았습니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall', 'korea-crisis-toolkit'],
      dimensions: ['marketRisk', 'solvency', 'compliance'],
      options: [
        {
          id: 't7-d2-a',
          label: '자체헤지 비중 유지, 외화 버퍼만 5%로 확대',
          description:
            '수익 구조는 그대로 두고 외화 유동자산 목표만 자체헤지 잔액의 5%로 올린다. 비용이 가장 작다.',
          effects: [setFxLiquidityPolicy({ targetShare: 0.05 })],
          expert: {
            rating: 48,
            rationale:
              '방향은 맞지만 폭이 모자란다. 금융위는 넉 달 뒤 10~20%를 의무화했고, 이번 달 실제 소요는 잔액의 10%를 넘었다. 업계 대부분이 이 정도에서 멈췄고 그래서 규정이 필요했다.',
            historicalNote: '자발적 구조 개선은 제한적이었고 2020년 7월 규제로 강제됐다.',
            sourceRefs: [S.dlsPlan],
          },
          consequences: '외화 버퍼 목표가 5%로 설정되었습니다.',
          historical: true,
          feasibility: { basis: '내부 규정 — 이사회 결의로 가능', sourceRefs: [S.dlsPlan] },
        },
        {
          id: 't7-d2-b',
          label: '자체헤지 40%를 백투백으로 전환하고 외화 버퍼 10% 설정',
          description:
            '자체헤지 잔액의 40%를 백투백으로 넘기고 외화 유동자산 상시 보유 목표를 10%로 정한다. 수수료 60bp를 지불하고 수익성은 낮아진다.',
          effects: [
            convertToBackToBack({ share: 0.4, costBp: 60, label: '백투백 전환 40%' }),
            setFxLiquidityPolicy({ targetShare: 0.1 }),
          ],
          expert: {
            rating: 88,
            rationale:
              '금융위 「파생결합증권시장 건전화 방안」(2020.7.30)이 요구한 방향을 넉 달 먼저 실행하는 것이다: 자체헤지 발행잔액의 10~20% 외화 유동자산 보유, 파생결합증권 레버리지비율 가중치 상향. 수익성 하락은 규제가 어차피 가져갈 비용의 선지급이다.',
            sourceRefs: [S.dlsPlan, S.fss],
          },
          consequences:
            '자체헤지 잔액이 크게 줄고 외화 버퍼 목표가 10%로 설정되었습니다. 다음 분기 수익 전망이 내려갑니다.',
          feasibility: { basis: '시장 정상화 구간 — 전환 호가 회복', sourceRefs: [S.fss] },
        },
        {
          id: 't7-d2-c',
          label: '자체헤지 확대 — 증거금 부담이 정상화됐고 수익성을 회복해야 한다',
          description:
            '위기가 지나갔으니 자체헤지 발행을 다시 늘려 수익성을 회복한다. 증거금 소요는 지수 반등으로 이미 환급되고 있다.',
          effects: [
            op('institution.hedge.elsSelfHedged', 'add', 20000, '자체헤지 잔액 확대'),
            op('institution.risk.market', 'add', 1400, '시장위험액 증가'),
            flag('self_hedge_expanded'),
          ],
          expert: {
            rating: 12,
            rationale:
              '증거금이 환급되는 국면에서 가장 유혹적인 판단이며, 정확히 이 판단을 막기 위해 금융위가 2020년 7월 30일 자체헤지 비중과 레버리지비율 가중치를 규제 대상으로 삼았다. 3월의 소요는 잔액의 10%를 넘었고, 그 구조는 그대로 남아 있다.',
            sourceRefs: [S.dlsPlan, S.fss],
          },
          consequences: '자체헤지 잔액이 12조원으로 늘었습니다. 시장위험액도 함께 늘었습니다.',
          trap: true,
          trapExplanation:
            '환급이 시작되면 "그래도 결국 살아남았고 비용은 일시적이었다"는 결론에 이르기 쉽다. 그러나 이번 달에 살아남은 이유는 구조가 좋아서가 아니라 정책 창구가 열렸기 때문이다. 다음 충격에서 그 창구가 같은 속도로 열린다는 보장은 없다.',
          remediationCard: 'ldi-collateral-waterfall',
          feasibility: { basis: '발행 확대는 내부 결정 사항', sourceRefs: [S.dlsPlan] },
        },
        {
          id: 't7-d2-d',
          label: 'ELS 발행 축소와 외화 버퍼 20% 설정',
          description:
            '자체헤지 ELS 발행을 줄이고 외화 유동자산 목표를 잔액의 20%로 올린다. 가장 보수적이며 수익 기반이 가장 많이 줄어든다.',
          effects: [
            convertToBackToBack({ share: 0.25, costBp: 60, label: '백투백 전환 25%' }),
            setFxLiquidityPolicy({ targetShare: 0.2 }),
            op('institution.equityCapital', 'add', -200, '발행 축소에 따른 수익 감소'),
            flag('els_issuance_halted'),
          ],
          expert: {
            rating: 74,
            rationale:
              '금융위 기준의 상단(20%)을 택하는 보수적 대응이다. 안전하지만 자체헤지 자체가 금지된 것은 아니므로 과도한 축소는 경쟁력 문제를 남긴다 — 규제는 10~20% 범위를 제시했다.',
            sourceRefs: [S.dlsPlan],
          },
          consequences: '발행이 축소되고 외화 버퍼 목표가 20%로 설정되었습니다.',
          feasibility: { basis: '내부 규정·발행 계획 조정', sourceRefs: [S.dlsPlan] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 3,
      text: '이번 달의 구속조건은 자본이 아니라 통화별 유동성이었습니다. 다음 위기에 같은 일이 반복되지 않으려면 외화 버퍼 목표와 자체헤지 비중을 함께 정해야 합니다.',
      cardRefs: ['ldi-collateral-waterfall'],
      decisionId: 't7-d2',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'ldi-collateral-waterfall'],
}

export const turnsB: T[] = [t4, t5, t6, t7]
