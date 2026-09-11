import type { DialogueStep, Interrupt, SecuritiesState } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { securitiesFx } from '../../engine/fx/securities'
import { confidence, flag, op, ownStockMove, regulator } from '../../engine/fx/common'
import {
  FX_BASE,
  S,
  convertToBackToBack,
  cpRolloverStep,
  discloseFxPosition,
  drawAllLines,
  drawFxLine,
  fxSwapDraw,
  marginCallStep,
  marginCutoffCheck,
  marginFxDrift,
  payMarginFx,
  reduceHedge,
  repoRaise,
  setOwnCpRate,
  setRollRate,
  settlementCheck,
  spotBuyUsd,
  unhedgedMark,
  type T,
} from './fx'

/**
 * T0~T3 (2020-03-12 ~ 03-19). 외생 시계열은 모두 1차 통계(ECOS·FRED)이며 플레이어 결정과 무관하다.
 * 턴 파이프라인(모든 턴 공통):
 *   ① 전일 저녁 증거금 납입(payMarginFx) → ② 해외 증거금 마감 점검(marginCutoffCheck)
 *   → ③ 시장 시계열 갱신 → ④ 차환률·CP 만기 → ⑤ 헤지 델타·무헤지 손익
 *   → ⑥ (틱 없는 턴) 증거금 통지 → ⑦ 결제 점검
 * 틱이 있는 턴(T1·T3·T4)은 ⑥을 `eachTick` 슬라이스로 나누고, 마지막 틱에서
 *   환율 재평가 → 납입 → 마감 점검을 한다. 보정 근거: calibration.md
 */

/** 턴별 증거금 산출 입력(테스트가 같은 값으로 재계산한다). calibration.md §3 */
export const MARGIN = {
  t1: { indexMovePct: -0.09511, imDeltaPct: 0.015, fxBase: FX_BASE, fxTurn: 1222.2 },
  t2release: { indexMovePct: 0.09287, imDeltaPct: 0, fxBase: FX_BASE, fxTurn: 1219.6 },
  t2im: { indexMovePct: 0, imDeltaPct: 0.02, fxBase: FX_BASE, fxTurn: 1219.6 },
  t3: { indexMovePct: -0.11542, imDeltaPct: 0.02, fxBase: FX_BASE, fxTurn: 1237.8 },
  t4: { indexMovePct: -0.03886, imDeltaPct: 0.01, fxBase: FX_BASE, fxTurn: 1254.1 },
  t5: { indexMovePct: -0.02929, imDeltaPct: 0.005, fxBase: FX_BASE, fxTurn: 1256 },
  t6: { indexMovePct: 0.10645, imDeltaPct: 0, fxBase: FX_BASE, fxTurn: 1227.9 },
  t7: { indexMovePct: 0.06103, imDeltaPct: -0.01, fxBase: FX_BASE, fxTurn: 1220 },
} as const

/** 일중 분배 프로필(합 = 1). 한국 거래일은 전일 해외 종가로 시작해 해외 증거금 마감에서 끝난다. */
export const T1_PROFILE = [0.15, 0.25, 0.2, 0.15, 0.25]
export const T3_PROFILE = [0.2, 0.3, 0.2, 0.15, 0.15]
export const T4_PROFILE = [0.1, 0.2, 0.25, 0.25, 0.2]

const TICK_LABELS = ['08:30 해외 종가', '10:30 오전', '12:30 점심', '15:30 장 마감', '19:00 해외 증거금 마감']

// =============================================================================================
// T0 — 2020-03-12 (목) 17:00 KST "유럽이 무너지는 저녁"
// =============================================================================================
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2020년 3월 12일 (목) 17:00 KST',
  title: '프롤로그: 유럽이 무너지는 저녁',
  time: '2020-03-12T17:00:00+09:00',
  entryEffects: [
    {
      id: 't0-roll',
      description: 'CP·전단채 차환은 아직 정상(98%)',
      effects: [setRollRate(0.98, '단기자금 시장 정상'), cpRolloverStep({ label: '3/12 만기 차환' })],
    },
    {
      id: 't0-cp-rate',
      description: '자사 CP 발행금리 = CP91 + 20bp',
      effects: [setOwnCpRate({ premiumBp: 20 })],
    },
    { id: 't0-settle', effects: [settlementCheck()] },
  ],
  events: [
    {
      id: 't0-market',
      kind: 'market',
      time: '15:30',
      headline: '국내 마감 시세',
      items: [
        { label: 'KOSPI', value: '1,834.33', change: '−3.87%' },
        { label: '원/달러(당일 가중평균)', value: '1,202.0', change: '+9.2원' },
        { label: 'CP(91일)', value: '1.55%', change: '보합' },
        { label: 'CD(91일)', value: '1.39%', change: '−1bp' },
        { label: '국고채 3년', value: '1.062%', change: '−2.4bp' },
      ],
      sourceRefs: [S.ecosEquity, S.ecosFx, S.ecosRate],
    },
    {
      id: 't0-news-who',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '17:05',
      headline: 'WHO 팬데믹 선언 이후 유럽 증시 두 자릿수 급락 — 미국 선물 서킷브레이커',
      body: '세계보건기구가 어제 코로나19를 팬데믹으로 선언한 뒤 유럽 주요 지수가 장중 두 자릿수 하락하고 있다. 미국 지수선물은 개장 전 하한가에 걸렸다. 어제 미국 종가 기준 S&P 500은 2,741.38이었다.',
      severity: 'critical',
      sourceRefs: [S.sp500],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't0-memo-hedge',
      kind: 'memo',
      time: '17:20',
      from: '파생운용본부장',
      to: '자금담당임원',
      subject: '자체헤지 ELS 북 현황 및 증거금 민감도',
      body: `- 자체헤지 ELS 발행잔액 **10조원**, 백투백헤지 4조원. 업계 자체헤지 잔액은 2019년 말 45.4조원입니다.
- 해외 지수선물 헤지 명목은 잔액의 약 26%(2조 6,000억원 상당). 기초지수가 낙인 장벽 쪽으로 내려갈수록 복제해야 할 델타가 커집니다.
- 변동증거금은 **거래일 단위로 외화 현금** 납입입니다. 원화로는 대납되지 않습니다.
- 민감도: 기초지수 −10%이면 헤지 명목의 10%, 약 2,600억원 상당의 외화가 하루 만에 필요합니다. 거래소가 개시증거금률을 올리면 그만큼 더 필요합니다.
- 현재 외화 유동자산 {{metric:fxLiquid}} — 원화 현금 {{metric:cash}}과는 별개의 재원입니다.`,
      severity: 'warning',
      sourceRefs: [S.fss, S.kcmiLee, S.cgfs],
      relatedMetrics: ['fxLiquid', 'cash', 'marginCallPending', 'hedgeDelta'],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't0-memo-funding',
      kind: 'memo',
      time: '17:40',
      from: '자금부장',
      to: '자금담당임원',
      subject: '단기조달 구조와 만기 사다리',
      body: `- CP·전자단기사채 잔액 6조원(1~3개월물). 이번 주 만기 2,000억, 다음 주 3,000억, 3월 넷째 주에만 9,000억이 몰려 있습니다.
- RP 매도 10조원 — 보유 채권의 대부분은 이미 담보로 제공되어 있습니다. 미담보 국공채·통안채는 2조 5,000억원입니다.
- 콜차입 4,000억(한도 6,750억 = 자기자본 15%).
- 은행 크레딧라인: 원화 8,000억, **외화 4,000억**(모두 미사용).
- 자사 CP 발행금리 {{metric:ownCpRate}}%. 아직 수요는 정상입니다.`,
      severity: 'info',
      sourceRefs: [S.pCp, S.bcbs144],
      relatedMetrics: ['cash', 'liquidityRatio', 'abcpMaturing30', 'ownCpRate'],
      cardRefs: ['contingency-funding-plan'],
    },
    {
      id: 't0-call-clearing',
      kind: 'call',
      time: '18:10',
      caller: '해외 청산회원 은행(런던)',
      callee: '자금부장',
      tone: 'concerned',
      lines: [
        {
          speaker: '청산회원',
          text: '오늘 유럽 마감이 어떻게 끝날지 모르겠습니다. 거래소들이 증거금률 인상을 검토하고 있다는 이야기가 돌고 있습니다.',
        },
        {
          speaker: '자금부장',
          text: '내일 아침 통지가 오면 즉시 알려 주십시오. 납입 통화와 컷오프 시각을 다시 확인하겠습니다.',
        },
        {
          speaker: '청산회원',
          text: '납입은 달러입니다. 컷오프는 한국시간 19시. 원화 대납은 받지 않습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.cgfs, S.kcmiLee],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '선제 대응 패키지',
      prompt:
        '내일 아침 첫 증거금 통지가 오기 전까지 무엇을 준비하시겠습니까? (최대 3개, E는 단독 선택)',
      context:
        '아직 증거금 통지는 없습니다. 오늘 밤 미국·유럽이 어떻게 끝나든, 내일 필요한 것은 원화가 아니라 달러입니다. 준비 조치는 비용이 들지만 지금은 시장이 정상적으로 열려 있습니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t0-e', 't0-a'],
        ['t0-e', 't0-b'],
        ['t0-e', 't0-c'],
        ['t0-e', 't0-d'],
      ],
      requiredConcepts: ['ldi-collateral-waterfall', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'timeliness', 'marketRisk'],
      options: [
        {
          id: 't0-a',
          label: 'FX 스왑으로 외화 유동자산 3,000억 선제 확충',
          description:
            '원화를 담보로 3개월 FX 스왑을 체결해 달러를 미리 확보한다. 오늘은 스왑 베이시스가 −25bp로 평시 수준이고 은행 데스크의 한도도 열려 있다. 내일 이후에는 둘 다 사라진다.',
          effects: [
            fxSwapDraw({ amount: 3000, capacityShare: 0.9, label: '선제 FX 스왑' }),
            flag('t0_fx_buffer'),
          ],
          expert: {
            rating: 88,
            rationale:
              '바젤 원칙 8은 통화별 유동성을 별도로 관리하라고 요구한다. 금융위는 이 사태 이후 자체헤지 발행잔액의 10~20%를 외화 유동자산으로 보유하도록 의무화했다 — 위기 전에 하면 −25bp, 위기 중에 하면 −150bp다.',
            sourceRefs: [S.bcbs144, S.dlsPlan],
          },
          consequences:
            '외화 유동자산이 늘었습니다. 원화 현금은 그만큼 줄었지만, 내일 필요한 것은 달러입니다.',
          feasibility: {
            basis: '3/12 시점 은행 FX 스왑 데스크 정상 가동 — 당일 체결 가능',
            sourceRefs: [S.fsb],
          },
          calibrationNote: '체결률 90%, 비용 = 금액 × 베이시스 25bp × 0.25(3개월) [CAL]',
          preview: [
            { metric: 'fxLiquid', direction: 'up', magnitude: 3 },
            { metric: 'cash', direction: 'down', magnitude: 2 },
          ],
        },
        {
          id: 't0-b',
          label: '증거금 시나리오 산출 및 청산회원 한도·컷오프 재확인',
          description:
            '기초지수 −10%/−20%/−30% 시나리오별 증거금 소요를 통화별로 산출하고, 해외 청산회원 3곳의 납입 통화·컷오프·대체담보 허용 여부를 문서로 확인한다. 비용은 없고 내부 결재만으로 오늘 끝난다.',
          effects: [flag('margin_scenario_run')],
          expert: {
            rating: 84,
            rationale:
              '증거금은 금액이 아니라 시각과 통화의 문제다. 컷오프를 모른 채 조달 계획을 세우면 조달에 성공하고도 결제에 실패한다. 바젤 원칙 11의 "금액·리드타임이 확정된 조치"가 이것이다.',
            sourceRefs: [S.bcbs144, S.cgfs],
          },
          consequences:
            '세 청산회원 모두 납입 통화는 달러, 컷오프는 한국시간 19시로 확인되었습니다. 대체담보(국채)는 사전 등록분만 허용됩니다.',
          feasibility: { basis: '내부 결재 사항 — 당일 실행 가능', sourceRefs: [S.cgfs] },
          preview: [{ metric: 'confidence', direction: 'flat', magnitude: 1, note: '즉각적 지표 변화 없음' }],
        },
        {
          id: 't0-c',
          label: '자체헤지 잔액 15%를 백투백으로 전환',
          description:
            '자체헤지 잔액 10조 중 1조 5,000억원을 해외 투자은행에 백투백으로 넘긴다. 증거금 의무가 상대방으로 이전되고 시장위험액이 줄지만, 오늘 기준 전환 수수료 35bp를 한 번에 지불한다.',
          effects: [
            convertToBackToBack({ share: 0.15, costBp: 35, label: '백투백 전환 15%' }),
          ],
          expert: {
            rating: 76,
            rationale:
              '백투백은 평상시에 비싸고 위기에 싸다. 2019년 말 업계 자체헤지 45.4조 vs 백투백 25.7조의 구성이 2020년 3월의 결과를 갈랐다. 다만 전량 전환은 수익 구조 자체를 포기하는 것이라 15%가 현실적 상한이다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences:
            '1조 5,000억원이 백투백으로 넘어갔습니다. 자체헤지 잔액이 8조 5,000억원으로 줄었습니다.',
          feasibility: {
            basis: '기존 백투백 상대방과의 추가 거래 — 정상 시장에서 수일 내 체결 가능',
            sourceRefs: [S.fss],
          },
          calibrationNote: '전환 수수료 35bp(평시), 위기 중 T4에서는 90bp [CAL]',
        },
        {
          id: 't0-d',
          label: '원화 CP 3,000억 추가 발행으로 현금 버퍼 확충',
          description:
            '아직 발행 여건이 좋을 때 CP·전단채를 3,000억원 더 찍어 원화 현금을 쌓는다. 조달은 확실하고 금리도 싸다. 만기는 3월 넷째 주에 더해진다.',
          effects: [
            op('institution.liquidity.cash', 'add', 3000, 'CP 추가 발행'),
            op('institution.funding.cp', 'add', 3000, 'CP 잔액 증가'),
            op('institution.pf.abcpMaturing.4', 'add', 3000, '3월 넷째 주 만기 가중'),
          ],
          expert: {
            rating: 28,
            rationale:
              '원화 현금은 내일의 문제를 풀지 못한다. 증거금은 달러로 납입되며 원화 대납은 받지 않는다. 게다가 이 발행은 만기가 가장 몰린 3월 넷째 주에 3,000억을 더 얹어 차환의 벽을 높인다. 이 시나리오의 핵심 오해가 바로 "총 유동성은 충분하다"이다.',
            sourceRefs: [S.dlsPlan, S.bcbs144],
          },
          consequences:
            '원화 현금이 3,000억 늘었습니다. 3월 넷째 주 만기가 1조 2,000억원으로 늘었습니다.',
          trap: true,
          trapExplanation:
            '총 유동성 숫자는 커지지만 통화가 맞지 않는다. 원화 버퍼는 해외 청산회원의 달러 요구를 한 푼도 갚지 못하며, 만기 불일치만 악화시킨다. 금융위가 2020년 7월 30일 자체헤지 증권사에 **외화** 유동자산 보유를 의무화한 것은 정확히 이 착각 때문이다.',
          remediationCard: 'contingency-funding-plan',
          feasibility: { basis: '3/12 시점 CP 발행시장 정상', sourceRefs: [S.pCp] },
        },
        {
          id: 't0-e',
          label: '관망: 통지가 오면 그때 대응',
          description:
            '아직 증거금 통지가 없으므로 평소 절차대로 둔다. 비용은 없고, 내일 아침 통지 규모를 보고 판단한다.',
          effects: [],
          expert: {
            rating: 26,
            rationale:
              '업계 대부분이 실제로 택한 경로다. 3월 12일 시점에 이미 VIX는 75.47로 사상 최고 부근이었고 거래소들은 증거금률 인상을 예고하고 있었다. 증거금은 통지를 받은 날 저녁에 납입해야 하므로, 통지를 보고 조달을 시작하면 이미 늦다.',
            historicalNote:
              '3월 셋째 주 이전에 외화 유동성을 선제 확충한 국내 증권사는 확인되지 않는다.',
            sourceRefs: [S.dlsPlan, S.vix],
          },
          consequences: '아무 조치도 취하지 않았습니다. 내일 아침 해외 종가를 확인하게 됩니다.',
          historical: true,
          feasibility: { basis: '현상 유지 — 언제나 가능', sourceRefs: [S.dlsPlan] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '대시보드에서 "현금"과 "외화 유동자산"을 따로 보십시오. 증거금은 후자에서만 나갑니다.',
      cardRefs: ['ldi-collateral-waterfall'],
      decisionId: 't0-d1',
    },
    {
      level: 2,
      text: '헤지 명목 × 지수 하락률 = 하루치 변동증거금. 명목은 자체헤지 잔액 10조 × 델타 26% = 2조 6,000억원입니다.',
      decisionId: 't0-d1',
    },
  ],
  relatedCards: ['ldi-collateral-waterfall', 'contingency-funding-plan'],
}

// =============================================================================================
// T1 — 2020-03-13 (금) "첫 통지" — 5틱
// =============================================================================================
/**
 * 청산회원과의 증거금 협상(3단계). 대사는 실제 통화 기록이 아니라 **당시 실무 관행에 기초한 재구성**이다
 * (calibration.md §9, 디브리핑 단순화 노트). 세 단계는 모두 결정의 기존 옵션 셋으로 귀결한다.
 */
const t1DialogueSteps: DialogueStep<SecuritiesState>[] = [
  {
    id: 'clr-open',
    lines: [
      {
        speaker: '청산회원',
        text: '어젯밤 종가 기준 변동증거금이 확정됐습니다. 거래소들이 개시증거금률도 함께 올렸습니다.',
      },
      { speaker: '청산회원', text: '오늘 한국시간 19시까지입니다. 어떻게 하시겠습니까?' },
    ],
    note: '여기서 한 확약은 상대의 익일 거래 한도 산정에 그대로 반영됩니다.',
    replies: [
      {
        id: 'r-open-confirm',
        label: '확정 금액과 대체담보 조건을 먼저 확인한다',
        next: 'clr-terms',
        expert: {
          rating: 72,
          rationale: '금액·통화·컷오프·대체담보 가능 여부를 확인한 뒤에야 조달 계획을 세울 수 있다.',
        },
      },
      {
        id: 'r-open-extend',
        label: '컷오프 연장을 요청한다',
        next: 'clr-extend',
        expert: {
          rating: 40,
          rationale: '변동증거금 납입 시한은 거래소 규칙이라 청산회원이 연장해 줄 수 없다.',
        },
      },
      {
        id: 'r-open-defer',
        label: '내부 집계 후 회신하겠다고 답한다',
        resolvesTo: 't1-i1-check',
        expert: {
          rating: 42,
          rationale: '위법도 허위도 아니지만 상대는 답을 얻지 못한 채 한도를 재산정한다.',
        },
      },
    ],
  },
  {
    id: 'clr-terms',
    lines: [
      {
        speaker: '청산회원',
        text: '확정 금액은 약 2,900억원 상당입니다. 납입 통화는 달러이고 원화 대납은 받지 않습니다.',
      },
      {
        speaker: '청산회원',
        text: '대체담보는 사전에 등록된 국채 한도 내에서만 인정됩니다. 오늘 새로 등록하는 것은 불가능합니다.',
      },
    ],
    replies: [
      {
        id: 'r-terms-full',
        label: '전액 납입을 확약한다',
        resolvesTo: 't1-i1-commit',
        expert: {
          rating: 78,
          rationale: '지킬 수 있는 확약은 익일 한도를 지켜 준다. 조달 계획이 먼저 서 있어야 한다.',
        },
      },
      {
        id: 'r-terms-partial',
        label: '보유 외화 범위까지 확약하고 잔여는 협의한다',
        resolvesTo: 't1-i1-partial',
        expert: {
          rating: 62,
          rationale: '정직하지만 상대가 리스크 한도를 재산정하게 만든다.',
        },
      },
      {
        id: 'r-terms-collateral',
        label: '사전 등록된 국채를 대체담보로 제시한다',
        resolvesTo: 't1-i1-partial',
        expert: {
          rating: 58,
          rationale:
            '사전 등록 한도 안에서만 인정되므로 부분 납입과 결과가 같다. 등록 한도를 평시에 키워 두었어야 했다.',
        },
      },
    ],
  },
  {
    id: 'clr-extend',
    lines: [
      {
        speaker: '청산회원',
        text: '연장은 불가능합니다. 변동증거금 납입 시한은 거래소 규칙이고 저희가 조정할 수 있는 항목이 아닙니다.',
      },
      { speaker: '청산회원', text: '지금 확약해 주시겠습니까, 아니면 나중에 회신하시겠습니까?' },
    ],
    replies: [
      {
        id: 'r-ext-commit',
        label: '전액 현금 납입으로 확약한다',
        resolvesTo: 't1-i1-commit',
        expert: { rating: 76, rationale: '연장이 없다면 남은 선택은 조달뿐이다.' },
      },
      {
        id: 'r-ext-partial',
        label: '보유 외화 범위까지만 확약한다',
        resolvesTo: 't1-i1-partial',
        expert: { rating: 60, rationale: '가능한 범위를 먼저 확정하는 것은 정직한 협상이다.' },
      },
      {
        id: 'r-ext-defer',
        label: '그러면 집계 후 회신하겠다고 답한다',
        resolvesTo: 't1-i1-check',
        expert: {
          rating: 38,
          rationale: '연장 요청이 거절된 뒤의 보류는 상대에게 "재원이 없다"로 읽힌다.',
        },
        trap: true,
        trapExplanation:
          '연장을 먼저 요청하면 상대는 이미 유동성 문제를 의심한다. 그 상태에서 답을 보류하면 확인이 된다 — 같은 "회신 보류"라도 연장 요청 뒤의 보류는 비용이 훨씬 크다.',
      },
    ],
  },
]

const t1Interrupt: Interrupt<SecuritiesState> = {
  id: 't1-i1',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't1-i1-check',
  scoreWeight: 0.5,
  required: false,
  title: '해외 청산회원 증거금 통지',
  prompt: '런던 청산회원이 오늘 컷오프까지의 납입 확약을 요구합니다. 어떻게 답하시겠습니까?',
  context:
    '변동증거금은 오늘 한국시간 19시까지 달러로 납입해야 합니다. 확약을 주면 상대는 한도를 유지하고, 주지 않으면 익일 거래 한도를 줄입니다.',
  source: { kind: 'call', caller: '해외 청산회원 은행(런던) 마진 데스크', tone: 'urgent' },
  lines: [
    {
      speaker: '청산회원',
      text: '어젯밤 미국 종가 기준 변동증거금이 확정됐습니다. 유로스톡스·S&P 선물 모두입니다. 거래소들이 개시증거금률도 1.5%p 올렸습니다.',
    },
    {
      speaker: '청산회원',
      text: '한국시간 19시까지 달러로 납입해 주십시오. 지금 확약을 주시겠습니까?',
    },
  ],
  dimensions: ['liquidity', 'communication'],
  steps: t1DialogueSteps,
  options: [
    {
      id: 't1-i1-commit',
      label: '전액 납입 확약 후 즉시 조달 착수',
      description:
        '오늘 컷오프까지 전액 납입하겠다고 확약하고 자금부에 조달을 지시한다. 확약을 지키지 못하면 신뢰는 더 크게 깎인다.',
      effects: [
        { kind: 'counter', key: 'marginCommitted', add: 1 },
        confidence(3, '청산회원에 납입 확약'),
      ],
      expert: {
        rating: 78,
        rationale:
          '증거금 관계에서 확약은 신용라인과 같다. 지킬 수 있는 확약은 익일 한도를 지켜 준다 — 다만 조달 계획이 먼저 서 있어야 한다.',
        sourceRefs: [S.cgfs],
      },
      consequences: '청산회원이 한도를 유지하기로 했습니다. 이제 실제로 달러를 마련해야 합니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1, note: '상대방 신뢰 +' }],
    },
    {
      id: 't1-i1-partial',
      label: '보유 외화 범위 내 납입 확약, 잔여는 협의 요청',
      description:
        '지금 확실한 금액만 확약하고 나머지는 컷오프 연장 또는 대체담보를 협의한다. 상대는 대체담보를 사전 등록분만 받는다.',
      effects: [{ kind: 'counter', key: 'marginNegotiated', add: 1 }],
      expert: {
        rating: 62,
        rationale:
          '정직하지만 상대가 리스크 한도를 재산정하게 만든다. 사전 등록되지 않은 대체담보는 당일 인정되지 않으므로 실익이 크지 않다.',
        sourceRefs: [S.cgfs],
      },
      consequences: '청산회원이 잔여분에 대해 저녁에 다시 확인하겠다고 답했습니다.',
      preview: [{ metric: 'marginCallPending', direction: 'flat', magnitude: 1 }],
    },
    {
      id: 't1-i1-check',
      label: '금액 확인 후 회신하겠다고 답변',
      description: '내부 집계 후 회신하겠다고 답하고 통화를 끝낸다. 위법도 허위도 아니지만 상대는 답을 얻지 못한다.',
      effects: [{ kind: 'counter', key: 'marginDeferred', add: 1 }],
      expert: {
        rating: 42,
        rationale:
          '2020년 3월의 기본 상태였다. 정보 공백은 상대가 최악을 가정하게 만들지만, 이 통화만으로 한도가 끊기지는 않는다.',
        sourceRefs: [S.kcmiLee],
      },
      consequences: '회신을 보류했습니다. 증거금 통지 금액은 대시보드의 "마진콜 대기"에 반영됩니다.',
      historical: true,
    },
  ],
}

export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2020년 3월 13일 (금) KST',
  title: '첫 통지: 공매도 금지와 서킷브레이커',
  time: '2020-03-13T08:30:00+09:00',
  ticks: 5,
  tickLabels: TICK_LABELS,
  entryEffects: [
    { id: 't1-pay-residual', effects: [payMarginFx({ label: '전일 잔여 증거금 납입' })] },
    { id: 't1-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't1-market',
      description: '3/12 미국 종가 −9.51%(S&P 500 2,480.64), VIX 75.47',
      effects: [
        op('market.custom.oseaIndex', 'set', 90.49, '해외지수 90.49 (3/12 종가)'),
        op('market.volIndex', 'set', 75.47, 'VIX 75.47'),
        op('market.custom.cp91', 'set', 155, 'CP91 1.55%'),
        op('market.custom.cd91', 'set', 139, 'CD91 1.39%'),
        op('market.fundingStressBp', 'set', 16, 'CP−CD 16bp'),
        op('market.custom.govt3y', 'set', 115, '국고채 3년 1.149%'),
        op('market.custom.corpAA3y', 'set', 181, '회사채 AA- 3년 1.810%'),
        op('market.creditSpreadIgBp', 'set', 66, 'AA- − 국고 66bp'),
        setOwnCpRate({ premiumBp: 22 }),
      ],
    },
    {
      id: 't1-roll',
      description: '차환률 95% — CP 시장은 아직 열려 있다',
      effects: [setRollRate(0.95, '단기자금 시장 경계'), cpRolloverStep({ label: '3/13 만기 차환' })],
    },
    {
      id: 't1-unhedged',
      effects: [unhedgedMark({ indexMovePct: MARGIN.t1.indexMovePct })],
    },
    {
      id: 't1-ci',
      description: '글로벌 증시 붕괴 — 신뢰지수 −4',
      effects: [confidence(-4, '글로벌 증시 붕괴'), ownStockMove(-0.08, '증권주 동반 급락')],
    },
    { id: 't1-settle', effects: [settlementCheck()] },
  ],
  eachTick: [
    {
      id: 't1-margin-tick',
      description: '해외 지수선물 변동증거금·개시증거금 통지(일중 분배)',
      effects: [marginCallStep({ ...MARGIN.t1, profile: T1_PROFILE, label: '3/13 증거금 통지' })],
    },
  ],
  tickEffects: [
    {
      id: 't1-cutoff-pay',
      atTick: 4,
      description: '한국시간 19시 해외 증거금 마감 — 납입 및 미납 점검',
      effects: [payMarginFx({ label: '19:00 증거금 납입' }), marginCutoffCheck()],
    },
  ],
  ticker: {
    series: [
      { path: 'market.equityIndex', mode: 'absolute', values: [1834.33, 1760, 1745, 1771.44, 1771.44] },
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1202, 1211, 1218, 1222.2, 1222.2] },
      { path: 'market.custom.swapBasisBp', mode: 'absolute', values: [-25, -38, -52, -60, -60] },
    ],
  },
  interrupts: [t1Interrupt],
  events: [
    {
      id: 't1-open',
      kind: 'market',
      time: '08:30',
      headline: '간밤 해외 종가',
      items: [
        { label: 'S&P 500', value: '2,480.64', change: '−9.51%' },
        { label: 'VIX', value: '75.47', change: '+21.6' },
        { label: '해외지수(ELS 기초, 3/11=100)', value: '90.49', change: '−9.51' },
      ],
      severity: 'critical',
      sourceRefs: [S.sp500, S.vix],
      relatedMetrics: ['market.oseaIndex', 'marginCallPending'],
    },
    {
      id: 't1-news-shortsell',
      kind: 'regulator',
      agency: '금융위원회',
      atTick: 2,
      time: '12:40',
      headline: '금융위, 6개월간 상장증권 공매도 금지 의결 — 3월 16일부터 시행',
      body: '금융위원회는 임시회의를 열어 유가증권·코스닥·코넥스 전 종목에 대한 공매도를 2020년 3월 16일부터 9월 15일까지 6개월간 금지하기로 의결했다.',
      severity: 'info',
      sourceRefs: [S.shortSell],
    },
    {
      id: 't1-news-cb',
      kind: 'newswire',
      outlet: '연합뉴스',
      atTick: 1,
      time: '10:43',
      headline: '코스피 서킷브레이커 발동 — 장중 8% 넘게 급락',
      body: '코스피가 장중 8% 이상 급락해 서킷브레이커가 발동됐다. 코스닥에서도 매도 사이드카가 발동됐다.',
      severity: 'critical',
      sourceRefs: [S.ecosEquity],
    },
    {
      id: 't1-memo-margin',
      kind: 'memo',
      atTick: 0,
      time: '08:45',
      from: '파생운용본부',
      to: '자금담당임원',
      subject: '금일 증거금 통지 예상 — 달러 소요',
      body: `- 간밤 기초지수 −9.51%, 거래소 개시증거금률 +1.5%p.
- 헤지 명목 2조 6,000억원 상당 기준 금일 소요는 변동증거금과 개시증거금을 합쳐 **약 2,900억원 상당의 달러**입니다.
- 컷오프는 한국시간 19시. 통지는 오전·점심·마감·저녁으로 나뉘어 들어옵니다.
- 현재 외화 유동자산 {{metric:fxLiquid}}. 원화 현금은 {{metric:cash}}이지만 납입에는 쓸 수 없습니다.`,
      severity: 'critical',
      sourceRefs: [S.cgfs, S.kcmiLee],
      relatedMetrics: ['fxLiquid', 'marginCallPending', 'cash'],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't1-close',
      kind: 'market',
      atTick: 3,
      time: '15:30',
      headline: '국내 마감',
      items: [
        { label: 'KOSPI', value: '1,771.44', change: '−3.43%' },
        { label: '원/달러(당일 가중평균)', value: '1,222.2', change: '+20.2원' },
        { label: 'FX 스왑 베이시스(1개월)', value: '−60bp', change: '−35bp' },
      ],
      sourceRefs: [S.ecosEquity, S.ecosFx],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '금일 증거금 재원',
      prompt:
        '한국시간 19시 컷오프까지 약 2,900억원 상당의 달러가 필요합니다. 어디서 조달하시겠습니까? (최대 2개)',
      context:
        '현재 외화 유동자산으로 오늘은 겨우 막을 수 있지만, 다음 통지가 오면 재원이 남지 않습니다. 원화 현금은 납입에 쓸 수 없습니다.',
      select: { min: 1, max: 2 },
      availableFrom: 1,
      deadlineTick: 3,
      defaultOptionId: 't1-d1-d',
      requiredConcepts: ['ldi-collateral-waterfall', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'timeliness'],
      timeLimitSec: 150,
      options: [
        {
          id: 't1-d1-a',
          label: 'FX 스왑으로 2,000억 조달해 여유분 확보',
          description:
            '보유 외화로 오늘을 막고, FX 스왑으로 2,000억원 상당을 추가로 확보해 다음 통지에 대비한다. 베이시스는 −60bp까지 벌어졌고 은행 데스크 한도도 좁아졌다.',
          effects: [fxSwapDraw({ amount: 2000, capacityShare: 0.8, label: 'FX 스왑 조달' })],
          expert: {
            rating: 84,
            rationale:
              '오늘을 막는 것이 아니라 내일을 막는 선택이다. 스왑 베이시스는 이후 −150bp까지 벌어지므로 −60bp는 사후적으로 싼 가격이었다.',
            sourceRefs: [S.fsb, S.bcbs144],
          },
          consequences: '외화 유동자산이 늘었습니다. 원화 현금은 담보로 묶였습니다.',
          feasibility: {
            basis: '3/13 시점 은행 FX 스왑 데스크 가동 — 한도 축소 중',
            sourceRefs: [S.fsb],
          },
          calibrationNote: '체결률 80%, 비용 = 금액 × 60bp × 0.25 [CAL]',
          preview: [{ metric: 'fxLiquid', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't1-d1-b',
          label: 'RP 매도 확대 후 현물시장에서 달러 매입',
          description:
            '미담보 국공채로 RP를 3,000억 늘려 원화를 만들고, 현물시장에서 2,000억원 상당의 달러를 산다. 자기 체결가에 슬리피지가 붙는다.',
          effects: [
            repoRaise({ amount: 3000, haircut: 0.04, rateBp: 110 }),
            spotBuyUsd({ amount: 2000, slippageBp: 10, label: '현물 달러 매입' }),
          ],
          expert: {
            rating: 66,
            rationale:
              '확실하지만 비싸고, 규모가 커지면 원/달러 자체를 밀어올린다. 3월 하순 증권사들의 달러 매입이 환율 불안의 한 축으로 지목된 이유다.',
            sourceRefs: [S.kcmiLee, S.fsr],
          },
          consequences: '담보 여력이 줄고 달러가 들어왔습니다. 체결 환율은 고시 환율보다 불리했습니다.',
          feasibility: { basis: '현물 외환시장·RP 시장 정상 가동', sourceRefs: [S.ecosFx] },
          calibrationNote: '슬리피지 = 10bp × (1 + 금액/10,000) [CAL, 가이드 6.6 자기 체결가]',
        },
        {
          id: 't1-d1-c',
          label: '은행 외화 크레딧라인 2,000억 인출',
          description:
            '미사용 외화 크레딧라인(한도 4,000억) 중 2,000억을 인출한다. 확정 라인이므로 당일 인출이 가능하고 금리는 연 2.0% 수준이다.',
          effects: [drawFxLine({ amount: 2000, rateBp: 200, label: '외화 라인 인출' })],
          expert: {
            rating: 82,
            rationale:
              '바젤 원칙 11이 요구하는 "금액·리드타임이 확정된" 조치다. 위기 중 가장 먼저 써야 할 재원이며, 한도의 절반만 쓰면 신호 효과도 작다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '외화 라인 2,000억이 인출되었습니다. 잔여 한도는 2,000억입니다.',
          feasibility: { basis: '기존 약정 한도 내 당일 인출', sourceRefs: [S.bcbs144] },
          preview: [{ metric: 'fxLiquid', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't1-d1-d',
          label: '보유 외화 유동자산만으로 납입',
          description:
            '오늘 통지분은 보유 외화 유동자산으로 충당하고 추가 조달은 하지 않는다. 비용이 들지 않으며 시장에 아무 신호도 보내지 않는다.',
          effects: [{ kind: 'counter', key: 'passiveFunding', add: 1 }],
          expert: {
            rating: 40,
            rationale:
              '오늘은 막힌다. 문제는 내일이다 — 이 선택은 외화 유동자산을 거의 0으로 만들고, 다음 통지가 오는 순간 조달을 시작해야 한다. 그때는 스왑 베이시스가 −150bp이고 은행 한도는 닫혀 있다.',
            historicalNote:
              '3월 셋째 주 초반까지 업계의 일반적 대응이었다. 금융위가 사후에 외화 유동자산 상시 보유를 의무화한 배경이다.',
            sourceRefs: [S.dlsPlan],
          },
          consequences:
            '보유 외화로 납입했습니다. 외화 유동자산이 거의 남지 않았습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '오늘 통지분을 정확히 막았으니 합리적으로 보인다. 그러나 이 선택은 외화 유동자산을 거의 0으로 만들고, 다음 통지가 오는 날 조달을 처음부터 시작하게 만든다 — 그때 FX 스왑 베이시스는 −150bp이고 은행 데스크는 제시를 멈춘 뒤다. 증거금은 재원을 미리 쌓아 두는 문제이지 그날 맞추는 문제가 아니다.',
          remediationCard: 'contingency-funding-plan',
          feasibility: { basis: '현상 유지 — 언제나 가능', sourceRefs: [S.dlsPlan] },
        },
        {
          id: 't1-d1-e',
          label: '헤지 델타 20% 축소로 증거금 소요 감축',
          description:
            '해외 지수선물 포지션의 20%를 정리해 증거금 소요를 줄인다. 오늘부터 증거금은 줄지만 그만큼 ELS 부채의 지수 위험이 열린 채 남는다.',
          effects: [reduceHedge({ share: 0.2, label: '헤지 20% 축소' })],
          expert: {
            rating: 34,
            rationale:
              '증거금 문제를 시장위험 문제로 바꾸는 선택이다. 지수가 더 내려가면 열린 위험이 그대로 손실이 되고, 시장위험액이 늘어 NCR도 깎인다. 2020년 1분기 증권사 파생결합증권 손익 △9,067억의 상당 부분이 이 계열의 손실이다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences:
            '헤지 델타가 줄었습니다. 증거금 소요는 감소하지만 지수 위험이 열렸습니다.',
          feasibility: { basis: '선물 포지션 청산 — 당일 체결 가능', sourceRefs: [S.fss] },
          calibrationNote: '축소분 × 13% 만큼 시장위험액 증가, 이후 지수 변동의 40%가 자본 손익 [CAL]',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '"마진콜 대기"는 하루 종일 늘어나고 19시 컷오프에 한 번에 결제됩니다. 그 전에 외화 유동자산이 그만큼 있어야 합니다.',
      decisionId: 't1-d1',
    },
    {
      level: 3,
      when: { metric: 'fxLiquid', lt: 1500 },
      text: '외화 유동자산이 오늘 통지분에도 모자랍니다. 확정 라인(외화 크레딧라인)이 가장 빠릅니다.',
      cardRefs: ['contingency-funding-plan'],
      decisionId: 't1-d1',
    },
  ],
  relatedCards: ['ldi-collateral-waterfall', 'hqla-and-haircuts'],
}

// =============================================================================================
// T2 — 2020-03-16 (월) "임시 금통위"
// =============================================================================================
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2020년 3월 16일 (월) KST',
  title: '임시 금통위: 원화는 싸졌다',
  time: '2020-03-16T09:00:00+09:00',
  entryEffects: [
    { id: 't2-pay-residual', effects: [payMarginFx({ label: '3/13 잔여 증거금 납입' })] },
    { id: 't2-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't2-market',
      description: '3/13 미국 종가 +9.29% 반등, VIX 82.69(사상 최고 종가)',
      effects: [
        op('market.custom.oseaIndex', 'set', 98.89, '해외지수 98.89 (3/13 종가)'),
        op('market.equityIndex', 'set', 1714.86, 'KOSPI 1,714.86'),
        op('market.volIndex', 'set', 82.69, 'VIX 82.69'),
        op('market.fxUsdLocal', 'set', 1219.6, '원/달러 당일 가중평균 1,219.6'),
        op('market.policyRateBp', 'set', 75, '기준금리 0.75%'),
        op('market.custom.cp91', 'set', 154, 'CP91 1.54%'),
        op('market.custom.cd91', 'set', 139, 'CD91 1.39%'),
        op('market.fundingStressBp', 'set', 15, 'CP−CD 15bp'),
        op('market.custom.govt3y', 'set', 110, '국고채 3년 1.099%'),
        op('market.custom.corpAA3y', 'set', 177, '회사채 AA- 3년 1.765%'),
        op('market.creditSpreadIgBp', 'set', 67, 'AA- − 국고 67bp'),
        op('market.custom.swapBasisBp', 'set', -95, 'FX 스왑 베이시스 −95bp'),
        setOwnCpRate({ premiumBp: 25 }),
      ],
    },
    {
      id: 't2-roll',
      description: '차환률 92%',
      effects: [setRollRate(0.92, '기준금리 인하 직후'), cpRolloverStep({ label: '3/16 만기 차환' })],
    },
    {
      id: 't2-delta',
      description: '기초지수가 낙인 장벽에 가까워지며 복제 델타 상승(+2%p)',
      effects: [op('institution.custom.hedgeDelta', 'add', 0.02, '델타 상승')],
    },
    { id: 't2-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t2release.indexMovePct })] },
    {
      id: 't2-margin-im',
      description: '거래소 개시증거금률 추가 인상(+2.0%p)',
      effects: [marginCallStep({ ...MARGIN.t2im, label: '개시증거금률 인상' })],
    },
    {
      id: 't2-margin-release',
      description: '해외지수 반등(+9.29%)에 따른 변동증거금 환급',
      effects: [marginCallStep({ ...MARGIN.t2release, label: '변동증거금 환급' })],
    },
    {
      id: 't2-ci',
      description: '임시 금통위 50bp 인하·공매도 금지 시행 — 신뢰지수 +2',
      effects: [confidence(2, '정책 대응 개시'), ownStockMove(0.02, '증권주 소폭 반등')],
    },
    { id: 't2-settle', effects: [settlementCheck()] },
  ],
  events: [
    {
      id: 't2-bok',
      kind: 'regulator',
      agency: '한국은행',
      time: '16:30',
      headline: '임시 금융통화위원회, 기준금리 1.25% → 0.75%로 50bp 인하',
      body: '한국은행은 임시 금융통화위원회를 열어 기준금리를 0.75%로 인하했다. 공개시장운영 대상증권에 은행채 등을 포함하는 조치도 함께 의결했다. 미 연준은 현지시간 3월 15일 정책금리를 0~0.25%로 내리고 대규모 자산매입을 발표했다.',
      severity: 'positive',
      sourceRefs: [S.mpb],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't2-market-open',
      kind: 'market',
      time: '08:30',
      headline: '간밤 해외 종가와 국내 개장',
      items: [
        { label: 'S&P 500 (3/13)', value: '2,711.02', change: '+9.29%' },
        { label: 'VIX', value: '82.69', change: '사상 최고 종가' },
        { label: 'KOSPI', value: '1,714.86', change: '−3.19%' },
        { label: '원/달러(당일 가중평균)', value: '1,219.6', change: '−2.6원' },
      ],
      sourceRefs: [S.sp500, S.vix, S.ecosEquity, S.ecosFx],
    },
    {
      id: 't2-memo-margin',
      kind: 'memo',
      time: '09:20',
      from: '파생운용본부',
      to: '자금담당임원',
      subject: '증거금 환급과 개시증거금률 인상이 상계된 결과',
      body: `- 간밤 지수 반등(+9.29%)으로 변동증거금이 환급됩니다. 예치금 일부가 외화 유동자산으로 돌아옵니다.
- 그러나 VIX가 82.69로 사상 최고 종가를 기록하면서 거래소들이 개시증거금률을 2.0%p 추가 인상했습니다. 이 부분은 지수가 올라도 돌려받지 못합니다.
- 복제 델타는 26% → 28%로 올랐습니다. 같은 지수 하락률이라도 내일의 증거금 소요는 오늘보다 큽니다.
- 요약: 오늘은 숨을 돌렸지만 **구조는 나빠졌습니다**.`,
      severity: 'warning',
      sourceRefs: [S.cgfs, S.vix],
      relatedMetrics: ['fxLiquid', 'hedgeDelta', 'marginCallPending'],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't2-memo-treasury',
      kind: 'memo',
      time: '10:10',
      from: '자금부장',
      to: '자금담당임원',
      subject: '원화는 싸졌는데 달러는 비싸졌습니다',
      body: `- 기준금리 50bp 인하로 CD·국고채 금리가 내려갑니다. 원화 조달은 오히려 쉬워졌습니다.
- 반면 1개월 FX 스왑 베이시스는 −95bp까지 벌어졌습니다. 원화를 주고 달러를 받는 값이 계속 오르고 있습니다.
- 현물시장에서는 살 수 있지만 규모가 커지면 체결 환율이 밀립니다.
- 외화 크레딧라인 잔여 한도를 확인해 두시기 바랍니다.`,
      severity: 'warning',
      sourceRefs: [S.fsb, S.ecosRate],
      relatedMetrics: ['fxLiquid', 'cash', 'market.swapBasisBp'],
      cardRefs: ['korea-crisis-toolkit'],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '원화 조달 순서',
      prompt: '앞으로 2주간 쓸 원화 재원을 어떤 순서로 확보하시겠습니까? (최대 2개)',
      context:
        '금리 인하로 원화 조달 여건은 좋아졌습니다. 다만 조달 수단마다 담보를 소진하는 정도와 만기 벽을 높이는 정도가 다릅니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['hqla-and-haircuts', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'solvency'],
      options: [
        {
          id: 't2-d1-a',
          label: 'RP 매도 5,000억 확대(담보부 조달)',
          description:
            '미담보 국공채·통안채를 담보로 RP 매도를 5,000억 늘린다. 헤어컷 4%, 금리 0.9% 수준이며 담보 여력이 그만큼 줄어든다.',
          effects: [repoRaise({ amount: 5000, haircut: 0.04, rateBp: 90 })],
          expert: {
            rating: 80,
            rationale:
              '담보부 조달은 위기에 가장 늦게 닫히는 창구다. 채권을 팔면 평가손이 자본에 실현되지만 담보로 쓰면 그렇지 않다.',
            sourceRefs: [S.cgfs, S.bcbs555],
          },
          consequences: '원화 현금이 늘고 미담보 채권이 줄었습니다.',
          historical: true,
          feasibility: { basis: 'RP 시장 정상 가동, 국공채 담보 적격', sourceRefs: [S.cgfs] },
          calibrationNote: '헤어컷 4%(국공채) [CAL, cgfs-36 IG 5~10% 하단]',
        },
        {
          id: 't2-d1-b',
          label: 'CP·전단채 4,000억 추가 발행',
          description:
            '아직 차환률이 92%로 높을 때 CP를 더 찍는다. 무담보라 담보 여력을 쓰지 않지만 만기가 3월 넷째 주에 더해진다.',
          effects: [
            op('institution.liquidity.cash', 'add', 4000, 'CP 발행'),
            op('institution.funding.cp', 'add', 4000, 'CP 잔액 증가'),
            op('institution.pf.abcpMaturing.2', 'add', 4000, '3월 넷째 주 만기 가중'),
          ],
          expert: {
            rating: 48,
            rationale:
              '3월 증권사 CP 발행이 21.2조원(+34.2%)으로 급증한 것이 바로 이 선택의 업계 총합이다. 조달은 되지만 만기 불일치가 커지고, 넷째 주에 차환이 막히면 그대로 현금 유출이 된다.',
            sourceRefs: [S.pCp, S.kcmiHwang],
          },
          consequences: '원화 현금이 4,000억 늘었습니다. 3월 넷째 주 만기가 그만큼 늘었습니다.',
          feasibility: { basis: '3/16 시점 CP 발행시장 가동', sourceRefs: [S.pCp] },
        },
        {
          id: 't2-d1-c',
          label: '보유 채권 5,000억 매각',
          description:
            '미담보 채권을 시장에 판다. 담보가 아니라 현금이 되지만 스프레드 확대 구간이라 1.2% 할인에 체결되고 손실이 자본에 실현된다.',
          effects: [securitiesFx.sellSecurities({ amount: 5000, discount: 0.012 })],
          expert: {
            rating: 44,
            rationale:
              '같은 채권으로 RP를 하면 담보 여력만 줄지만, 팔면 손실이 자본에 실현되고 이후 담보 조달 옵션까지 사라진다. 파이어세일은 가격 영향을 자기 체결가로 되돌려 받는다.',
            sourceRefs: [S.bcbs555, S.cgfs],
          },
          consequences: '채권이 체결되었습니다. 현금이 늘고 자본은 매각손만큼 줄었습니다.',
          feasibility: { basis: '채권시장 유동성 저하 상태에서 체결 가능', sourceRefs: [S.bcbs555] },
          calibrationNote: '할인 1.2%(스프레드 확대 구간) [CAL]',
        },
        {
          id: 't2-d1-d',
          label: '콜차입 한도까지 확대',
          description:
            '익일물 콜차입을 한도(자기자본 15%)까지 늘린다. 가장 싸고 빠르지만 매일 갱신해야 하며 신뢰가 흔들리면 하루 만에 회수된다.',
          effects: [
            securitiesFx.raiseFunding({ channel: 'call', amount: 2750, callLimit: 6750, rateBp: 80 }),
          ],
          expert: {
            rating: 32,
            rationale:
              '위기 한복판에서 익일물 의존을 키우는 것은 만기 불일치를 하루 단위로 압축하는 일이다. 싸다는 것은 언제든 사라질 수 있다는 뜻이다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '콜차입이 한도까지 찼습니다. 매일 아침 갱신해야 합니다.',
          trap: true,
          trapExplanation:
            '콜 금리는 기준금리 인하로 더 싸졌고 한도도 남아 있어 매력적으로 보인다. 그러나 익일물은 위기에 가장 먼저 끊기는 재원이며, 한도를 다 써 두면 정작 필요한 날 쓸 여지가 없다.',
          remediationCard: 'contingency-funding-plan',
          feasibility: { basis: '콜시장 정상 가동, 한도 내', sourceRefs: [S.bcbs144] },
        },
      ],
    },
    {
      id: 't2-d2',
      title: '달러 조달 경로',
      prompt: '다음 증거금 통지에 대비해 달러를 어떻게 확보하시겠습니까? (최대 2개)',
      context:
        'FX 스왑 베이시스는 −95bp까지 벌어졌습니다. 현물시장은 열려 있지만 규모가 커지면 체결가가 밀립니다. 한국은행의 외화 공급 창구는 아직 없습니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall', 'korea-crisis-toolkit'],
      dimensions: ['liquidity', 'marketRisk', 'policy'],
      options: [
        {
          id: 't2-d2-a',
          label: 'FX 스왑 2,500억 체결',
          description:
            '원화를 담보로 3개월 스왑을 체결한다. 베이시스 −95bp의 비용이 붙고 은행 데스크 한도가 좁아져 신청액의 일부만 체결된다.',
          effects: [fxSwapDraw({ amount: 2500, capacityShare: 0.7, label: 'FX 스왑 조달' })],
          expert: {
            rating: 76,
            rationale:
              '스왑은 원화 담보를 그대로 두고 달러를 빌리므로 대차대조표 왜곡이 가장 작다. 비용은 −95bp지만 3월 19일에는 −150bp가 된다.',
            sourceRefs: [S.fsb, S.kcmiLee],
          },
          consequences: '신청액의 70%가 체결되었습니다. 한도가 좁아지고 있습니다.',
          feasibility: { basis: '은행 FX 스왑 데스크 한도 축소 중, 부분 체결 가능', sourceRefs: [S.fsb] },
          calibrationNote: '체결률 70%, 비용 = 금액 × 95bp × 0.25 [CAL]',
        },
        {
          id: 't2-d2-b',
          label: '현물시장에서 달러 2,000억 매입',
          description:
            '원화 현금으로 달러를 산다. 확실하고 즉시 쓸 수 있지만 슬리피지가 붙고, 업계가 동시에 같은 일을 하면 원/달러 자체가 밀린다.',
          effects: [spotBuyUsd({ amount: 2000, slippageBp: 12, label: '현물 달러 매입' })],
          expert: {
            rating: 58,
            rationale:
              '3월 하순 증권사들의 달러 현물 매입은 원/달러 급등의 한 축으로 지목됐다. 개별 기관에는 합리적이지만 합성의 오류가 작동한다 — 다만 3월 16일 시점에서는 아직 가장 확실한 경로였다.',
            historicalNote: '업계는 CP·RP 매도로 원화를 만들고 현물에서 달러를 샀다.',
            sourceRefs: [S.kcmiLee, S.fsr],
          },
          consequences: '달러가 들어왔습니다. 체결 환율은 고시 환율보다 불리했습니다.',
          historical: true,
          feasibility: { basis: '현물 외환시장 정상 가동', sourceRefs: [S.ecosFx] },
          calibrationNote: '슬리피지 = 12bp × (1 + 금액/10,000) [CAL, 가이드 6.6]',
        },
        {
          id: 't2-d2-c',
          label: '외화 크레딧라인 잔여 한도 인출',
          description:
            '미사용 외화 크레딧라인에서 2,000억을 인출한다. 확정 라인이므로 당일 실행되며 금리는 연 2.2% 수준이다.',
          effects: [drawFxLine({ amount: 2000, rateBp: 220, label: '외화 라인 인출' })],
          expert: {
            rating: 82,
            rationale:
              '확정 라인은 위기 중 유일하게 가격이 사전에 정해진 외화 재원이다. 다만 한도는 유한하며, 한 번에 전부 쓰면 시장에 신호가 된다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '외화 라인이 인출되었습니다. 잔여 한도가 줄었습니다.',
          feasibility: { basis: '기존 약정 한도 내 당일 인출', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't2-d2-d',
          label: '한국은행에 외화 유동성 지원 공식 요청',
          description:
            '증권사에 대한 외화 공급 창구 개설을 한국은행에 요청한다. 현재 증권회사가 직접 이용할 수 있는 외화 공급 제도는 없다.',
          effects: [{ kind: 'counter', key: 'policyRequests', add: 1 }],
          requires: { flag: 'bok_swap_open' },
          unavailableReason:
            '현재 증권회사가 이용할 수 있는 한국은행 외화 공급 창구가 없습니다. 한국은행법상 외화 여신 제도는 은행을 대상으로 합니다.',
          expert: {
            rating: 55,
            rationale:
              '방향은 맞지만 시점이 이르다. 증권사가 한국은행 외화자금에 직접 닿는 경로는 3월 하순 이후에야 생긴다 — 창구가 열리기 전의 요청은 자금이 아니라 기록이다.',
            sourceRefs: [S.bokAct, S.swap],
          },
          consequences: '요청이 접수되었습니다. 오늘 쓸 수 있는 자금은 없습니다.',
          feasibility: {
            basis: '3/16 시점 증권사 대상 외화 공급 창구 부재 — 요청만 가능',
            sourceRefs: [S.bokAct],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      text: '오늘 환급받은 변동증거금은 지수가 다시 내려가면 그대로 되돌아갑니다. 개시증거금률 인상분은 돌아오지 않습니다.',
      cardRefs: ['ldi-collateral-waterfall'],
      decisionId: 't2-d2',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
}

// =============================================================================================
// T3 — 2020-03-19 (목) "1,285.7원" — 5틱
// =============================================================================================
/** 스왑 가산 약속을 기록하는 카운터. 이행 비용은 귀결 옵션의 지연효과가 판정한다. */
export const SWAP_BID_COUNTER = 'fxSwapBidBp'

/**
 * 스왑 데스크와의 가격 협상(3단계). 대사는 실제 통화 기록이 아니라 당시 관행에 기초한 재구성이다.
 * 중간값 위 가산(bp)은 `commitReplies`로 이산 약속이 되고, 그 값이 다음 만기 재조달 비용을 결정한다.
 */
const t3DialogueSteps: DialogueStep<SecuritiesState>[] = [
  {
    id: 'swp-open',
    lines: [
      {
        speaker: '스왑 데스크',
        text: '1개월 베이시스가 −150bp입니다. 본점 한도가 거의 다 찼습니다. 지금 주시면 3,000억원 상당까지는 맞춰 드리겠습니다.',
      },
      { speaker: '스왑 데스크', text: '오후에는 제시 자체가 없을 겁니다. 어떻게 하시겠습니까?' },
    ],
    note: '여기서 약속한 가산 수준은 다음 만기 재조달 비용으로 평가됩니다.',
    replies: [
      {
        id: 'r-swp-ask',
        label: '필요 금액과 만기, 용도를 먼저 밝힌다',
        next: 'swp-bid',
        expert: {
          rating: 70,
          rationale:
            '증거금 납입 목적이라고 밝히면 데스크가 본점 한도를 요청할 근거가 생긴다. 위기 중 조달에서 용도 설명은 비용이 아니라 접근성이다.',
        },
      },
      {
        id: 'r-swp-quiet',
        label: '금액만 말하고 용도는 밝히지 않는다',
        next: 'swp-bid',
        expert: {
          rating: 52,
          rationale:
            '정보를 아끼는 것은 평시의 습관이다. 상대는 용도를 모르면 최악을 가정하고 한도를 좁힌다.',
        },
      },
      {
        id: 'r-swp-walk',
        label: '가격이 비정상이니 오늘은 체결하지 않겠다',
        resolvesTo: 't3-i1-decline',
        expert: {
          rating: 22,
          rationale: '가격 판단은 옳았고 시점 판단은 틀렸다. 결제는 정상화를 기다려 주지 않는다.',
        },
        trap: true,
        trapExplanation:
          '−150bp는 분명히 비정상이었고 실제로 몇 주 뒤 정상화됐다. 그러나 컷오프는 오늘 19시다 — 가격이 비싸다는 이유로 결제 재원을 포기하는 것이 유동성 위기의 전형적 오판이다.',
      },
    ],
  },
  {
    id: 'swp-bid',
    lines: [
      {
        speaker: '스왑 데스크',
        text: '중간값 위로 얼마까지 쓰실 수 있습니까? 그 수준에 따라 본점에서 열어 주는 한도가 다릅니다.',
      },
    ],
    note: '약속한 가산은 다음 만기 재조달에도 기준이 됩니다.',
    replies: commitReplies<SecuritiesState>(SWAP_BID_COUNTER, [20, 60, 120], {
      unit: 'bp',
      label: (v) => `중간값 +${v}bp까지`,
      next: (v) => (v >= 120 ? 'swp-size' : 'swp-thin'),
      expert: (v) => ({
        rating: v >= 120 ? 74 : v >= 60 ? 66 : 32,
        rationale:
          v >= 120
            ? '비싸지만 전액이 체결된다. 증거금 미납의 대가(강제 청산)와 비교하면 값이 싸다.'
            : v >= 60
              ? '시장 수준이지만 한도의 절반만 열린다. 나머지는 다른 경로로 메워야 한다.'
              : '중간값 근처 호가는 이 국면에서 체결되지 않는다. 가격을 아끼다 물량을 놓친다.',
      }),
      trap: (v) => v <= 20,
      trapExplanation: (v) =>
        v <= 20
          ? '평시 감각으로는 +20bp도 비싼 가산이다. 그러나 3월 19일의 1개월 베이시스는 −150bp였고, 중간값 근처 호가는 아예 체결되지 않는다 — 아낀 40bp가 체결 실패로 돌아온다.'
          : undefined,
    }),
  },
  {
    id: 'swp-thin',
    lines: [
      {
        speaker: '스왑 데스크',
        text: '그 수준으로는 본점 한도에서 절반 정도밖에 못 맞춥니다. 나머지는 현물에서 구하셔야 합니다.',
      },
    ],
    replies: [
      {
        id: 'r-thin-push',
        label: '가산을 더 얹어 전액을 맞춘다',
        resolvesTo: 't3-i1-full',
        expert: {
          rating: 78,
          rationale:
            '오늘 19시 컷오프를 기준으로 보면 가산 몇십 bp보다 체결 수량이 훨씬 중요하다.',
        },
      },
      {
        id: 'r-thin-half',
        label: '절반만 받고 나머지는 현물에서 산다',
        resolvesTo: 't3-i1-half',
        expert: {
          rating: 60,
          rationale:
            '가격 리스크를 나누는 상식적 선택이지만, 원/달러가 연중 최고를 찍는 날의 현물 매입이 가장 비싼 체결이 된다.',
        },
      },
      {
        id: 'r-thin-walk',
        label: '절반으로는 의미가 없으니 체결하지 않는다',
        resolvesTo: 't3-i1-decline',
        expert: {
          rating: 20,
          rationale: '절반이라도 오늘 저녁 결제에 쓰인다. 전부 아니면 아무것도라는 판단이 최악이다.',
        },
        trap: true,
        trapExplanation:
          '"절반은 어차피 부족하다"는 논리는 깔끔해 보이지만, 증거금 미납은 부분 미납이 아니라 전액 미이행으로 처리된다 — 절반을 채우면 나머지를 메울 경로가 남지만 아무것도 하지 않으면 남지 않는다.',
      },
    ],
  },
  {
    id: 'swp-size',
    lines: [
      {
        speaker: '스왑 데스크',
        text: '그 수준이면 3,000억원 상당 전액 맞춰 드리겠습니다. 만기는 어떻게 하시겠습니까?',
      },
    ],
    replies: [
      {
        id: 'r-size-full',
        label: '전액 3개월물로 체결한다',
        resolvesTo: 't3-i1-full',
        expert: {
          rating: 82,
          rationale:
            '만기를 길게 가져가면 다음 재조달 시점이 시장 정상화 이후로 넘어간다. 비싼 가산을 3개월에 나누는 효과도 있다.',
        },
      },
      {
        id: 'r-size-short',
        label: '전액이지만 1개월물로 짧게 간다',
        resolvesTo: 't3-i1-full',
        expert: {
          rating: 64,
          rationale:
            '가격이 곧 내려갈 것이라는 기대에 기댄 선택이다. 실제로는 4월 초까지 조달 여건이 더 나빠졌다.',
        },
      },
    ],
  },
]

const t3Interrupt: Interrupt<SecuritiesState> = {
  id: 't3-i1',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 40,
  defaultOptionId: 't3-i1-half',
  scoreWeight: 0.5,
  required: false,
  title: '주간사 은행 FX 스왑 데스크',
  prompt: '스왑 데스크가 지금 제시 수준에 체결할지 묻습니다. 답은 몇 분 안에 주어야 합니다.',
  context:
    '1개월 베이시스가 −150bp까지 벌어졌고 본점 한도가 거의 소진됐습니다. 지금 거절하면 오늘 다시 제시받기 어렵습니다.',
  source: { kind: 'desk', caller: '주간사 은행 FX 스왑 데스크', agency: '외국환은행', tone: 'urgent' },
  lines: [
    {
      speaker: '스왑 데스크',
      text: '1개월 베이시스가 −150bp입니다. 본점 한도가 거의 다 찼습니다. 지금 주시면 3,000억원 상당까지는 맞춰 드리겠습니다.',
    },
    {
      speaker: '스왑 데스크',
      text: '오후에는 제시 자체가 없을 겁니다. 지금 결정해 주십시오.',
    },
  ],
  dimensions: ['liquidity', 'marketRisk'],
  steps: t3DialogueSteps,
  options: [
    {
      id: 't3-i1-full',
      label: '제시 수준에 전액 체결',
      description: '−150bp를 받아들이고 3,000억원 상당을 전부 체결한다. 비싸지만 확실하다.',
      effects: [fxSwapDraw({ amount: 3000, capacityShare: 1, label: '스왑 전액 체결' })],
      delayedEffects: [
        {
          afterTurns: 1,
          when: { counter: SWAP_BID_COUNTER, gte: 120 },
          description: '약속한 +120bp 가산이 다음 만기 스왑 재조달 기준가에 반영된다',
          effects: [
            op('institution.equityCapital', 'add', -60, '가산 약속에 따른 재조달 비용'),
            { kind: 'counter', key: 'fxCost', add: 60 },
          ],
        },
      ],
      expert: {
        rating: 80,
        rationale:
          '3월 19일의 −150bp는 사후적으로 싼 값이었다. 통화스와프자금 입찰은 3월 31일에야 열리고, 그 사이 컷오프는 매일 돌아온다.',
        sourceRefs: [S.fsb, S.swapAuction],
      },
      consequences: '3,000억원 상당의 달러가 들어왔습니다. 베이시스 비용이 자본에서 빠졌습니다.',
      preview: [
        { metric: 'fxLiquid', direction: 'up', magnitude: 3 },
        { metric: 'cash', direction: 'down', magnitude: 2, note: '원화 담보로 묶임' },
      ],
    },
    {
      id: 't3-i1-half',
      label: '절반만 체결하고 나머지는 현물에서',
      description: '스왑으로 절반을 받고 나머지는 현물시장에서 산다. 비용을 나누지만 두 시장 모두에서 불리한 가격에 체결된다.',
      effects: [
        fxSwapDraw({ amount: 1500, capacityShare: 1, label: '스왑 절반 체결' }),
        spotBuyUsd({ amount: 1500, slippageBp: 18, label: '잔여 현물 매입' }),
      ],
      delayedEffects: [
        {
          afterTurns: 1,
          when: { counter: SWAP_BID_COUNTER, lte: 20 },
          description: '중간값 근처 호가로는 다음 제시를 받지 못해 조달이 하루 늦어진다',
          effects: [confidence(-3, '스왑 데스크 제시 중단')],
        },
      ],
      expert: {
        rating: 60,
        rationale:
          '가격 리스크를 나누는 상식적 선택이지만, 원/달러가 연중 최고를 찍는 날의 현물 매입은 가장 비싼 체결이 된다.',
        sourceRefs: [S.kcmiLee, S.ecosFx],
      },
      consequences: '절반은 스왑, 절반은 현물로 조달했습니다. 현물 체결가가 불리했습니다.',
      historical: true,
      preview: [{ metric: 'fxLiquid', direction: 'up', magnitude: 2 }],
    },
    {
      id: 't3-i1-decline',
      label: '거절하고 정책 창구를 기다린다',
      description: '−150bp는 받아들이지 않고 당국의 외화 공급을 기다린다. 오늘 컷오프는 보유분으로 감당해야 한다.',
      effects: [{ kind: 'counter', key: 'swapDeclined', add: 1 }],
      expert: {
        rating: 22,
        rationale:
          '정책 창구는 오늘 없다. 한미 통화스와프 체결은 이날 밤에야 발표되고 첫 입찰은 3월 31일이다 — 그 사이 열 번의 컷오프가 지나간다. 가격이 비싸다는 이유로 결제 재원을 포기하는 것은 유동성 위기에서 가장 흔한 치명적 오판이다.',
        sourceRefs: [S.swapAuction, S.fsb],
      },
      consequences: '체결하지 않았습니다. 오늘 컷오프는 보유 외화로만 막아야 합니다.',
      trap: true,
      trapExplanation:
        '"−150bp는 비정상이니 곧 정상화된다"는 판단은 가격에 대해서는 옳았지만 시점에 대해서는 틀렸다. 결제는 정상화를 기다려 주지 않는다.',
      remediationCard: 'ldi-collateral-waterfall',
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2020년 3월 19일 (목) KST',
  title: '1,285.7원: 연중 최고',
  time: '2020-03-19T08:30:00+09:00',
  ticks: 5,
  tickLabels: TICK_LABELS,
  entryEffects: [
    { id: 't3-pay-residual', effects: [payMarginFx({ label: '3/16 잔여 증거금 납입' })] },
    { id: 't3-cutoff', effects: [marginCutoffCheck()] },
    {
      id: 't3-market',
      description: '3/16~3/18 미국 세션 누적 −11.54%(2,398.10), VIX 76.45',
      effects: [
        op('market.custom.oseaIndex', 'set', 87.48, '해외지수 87.48 (3/18 종가)'),
        op('market.volIndex', 'set', 72, 'VIX 72.00'),
        op('market.fxUsdLocal', 'set', 1237.8, '원/달러 1,237.8 (3/18 가중평균)에서 출발'),
        op('market.custom.cp91', 'set', 141, 'CP91 1.41%'),
        op('market.custom.cd91', 'set', 102, 'CD91 1.02%'),
        op('market.fundingStressBp', 'set', 39, 'CP−CD 39bp'),
        op('market.custom.govt3y', 'set', 119, '국고채 3년 1.193%'),
        op('market.custom.corpAA3y', 'set', 195, '회사채 AA- 3년 1.947%'),
        op('market.creditSpreadIgBp', 'set', 76, 'AA- − 국고 76bp'),
        op('market.custom.swapBasisBp', 'set', -150, 'FX 스왑 베이시스 −150bp'),
        setOwnCpRate({ premiumBp: 35 }),
      ],
    },
    {
      id: 't3-roll',
      description: '차환률 80% — MMF 환매로 CP 수요처가 빠지기 시작',
      effects: [setRollRate(0.8, 'MMF 환매·CP 수요 위축'), cpRolloverStep({ label: '3/19 만기 차환' })],
    },
    {
      id: 't3-delta',
      description: '복제 델타 추가 상승(+2%p)',
      effects: [op('institution.custom.hedgeDelta', 'add', 0.02, '델타 상승')],
    },
    { id: 't3-unhedged', effects: [unhedgedMark({ indexMovePct: MARGIN.t3.indexMovePct })] },
    {
      id: 't3-ci',
      description: '환율 급등·서킷브레이커 — 신뢰지수 −8',
      effects: [confidence(-8, '환율 급등·증시 서킷브레이커'), ownStockMove(-0.12, '증권주 급락')],
    },
    {
      id: 't3-reg',
      description: '금융감독원, 파생결합증권 발행사 외화유동성 일일 점검 개시',
      effects: [regulator({ set: 1 }, '외화유동성 일일 보고')],
    },
    { id: 't3-settle', effects: [settlementCheck()] },
  ],
  eachTick: [
    {
      id: 't3-margin-tick',
      description: '해외 지수선물 변동증거금·개시증거금 통지(일중 분배)',
      effects: [marginCallStep({ ...MARGIN.t3, profile: T3_PROFILE, label: '3/19 증거금 통지' })],
    },
  ],
  tickEffects: [
    {
      id: 't3-cutoff-pay',
      atTick: 4,
      description: '환율 재평가 후 19시 해외 증거금 마감',
      effects: [
        marginFxDrift({ fxAtTurnStart: MARGIN.t3.fxTurn }),
        payMarginFx({ label: '19:00 증거금 납입' }),
        marginCutoffCheck(),
      ],
    },
  ],
  ticker: {
    series: [
      { path: 'market.equityIndex', mode: 'absolute', values: [1591.2, 1520, 1490, 1457.64, 1457.64] },
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1237.8, 1258, 1272, 1285.7, 1280.1] },
      { path: 'market.volIndex', mode: 'absolute', values: [72, 74, 75, 76, 76] },
    ],
  },
  interrupts: [t3Interrupt],
  events: [
    {
      id: 't3-open',
      kind: 'market',
      time: '08:30',
      headline: '간밤 해외 종가 — 3거래일 누적',
      items: [
        { label: 'S&P 500 (3/18)', value: '2,398.10', change: '3/13 대비 −11.54%' },
        { label: 'VIX', value: '76.45 → 72.00', change: '사상 최고권 유지' },
        { label: '해외지수(ELS 기초)', value: '87.48', change: '−11.54' },
        { label: '원/달러 시가', value: '1,237.8 부근', change: '상승 출발' },
      ],
      severity: 'critical',
      sourceRefs: [S.sp500, S.vix, S.ecosFx],
    },
    {
      id: 't3-memo-margin',
      kind: 'memo',
      atTick: 0,
      time: '08:40',
      from: '파생운용본부',
      to: '자금담당임원',
      subject: '금일 증거금 소요 — 약 4,200억원 상당',
      body: `- 3거래일 누적 −11.54%, 복제 델타 30%. 개시증거금률 2.0%p 추가 인상.
- 금일 소요는 **약 4,200억원 상당의 달러**입니다. 컷오프는 한국시간 19시.
- 주의: 증거금은 달러 표시입니다. 오늘 원/달러가 더 오르면 같은 달러 금액의 **원화 환산액이 그만큼 늘어납니다**.
- 현재 외화 유동자산 {{metric:fxLiquid}}.`,
      severity: 'critical',
      sourceRefs: [S.cgfs, S.kcmiLee],
      relatedMetrics: ['fxLiquid', 'marginCallPending', 'hedgeDelta'],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't3-emergency1',
      kind: 'regulator',
      agency: '대한민국 정부',
      atTick: 1,
      time: '10:30',
      headline: '제1차 비상경제회의 — 민생·금융안정 패키지 50조원',
      body: '대통령 주재 제1차 비상경제회의에서 소상공인·중소기업 대출과 보증을 중심으로 한 50조원 규모 지원 방안이 발표됐다. 증권사 유동성이나 외화자금에 대한 조치는 포함되지 않았다.',
      severity: 'info',
      sourceRefs: [S.em1],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't3-cb',
      kind: 'newswire',
      outlet: '연합뉴스',
      atTick: 3,
      time: '15:40',
      headline: '코스피 1,457.64로 마감 — 8.39% 급락, 코스피·코스닥 동시 서킷브레이커',
      body: '코스피가 8.39% 급락한 1,457.64로 마감했다. 원/달러 환율은 장중 1,291원까지 올랐고 종가는 1,285.7원으로 연중 최고를 기록했다.',
      severity: 'critical',
      sourceRefs: [S.ecosEquity, S.ecosFx],
    },
    {
      id: 't3-desk-fx',
      kind: 'dialogue',
      atTick: 2,
      time: '13:10',
      title: '외환 데스크 보고',
      lines: [
        {
          speaker: '외환 데스크',
          text: '현물 호가가 벌어졌습니다. 1,270원대에서 100억원 단위로만 체결됩니다. 대량 주문은 그대로 밀립니다.',
        },
        {
          speaker: '자금부장',
          text: '스왑은?',
        },
        {
          speaker: '외환 데스크',
          text: '오전에 −150bp 제시가 마지막이었습니다. 지금은 제시 자체가 없습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.fsb],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '오늘 컷오프까지의 달러',
      prompt:
        '19시까지 약 4,200억원 상당의 달러가 필요합니다. 남은 재원을 어떻게 쓰시겠습니까? (최대 2개)',
      context:
        '보유 외화 유동자산만으로는 부족합니다. 미납이 발생하면 청산회원이 헤지 포지션을 강제 청산합니다. 환율이 오르면 필요한 원화는 더 늘어납니다.',
      select: { min: 1, max: 2 },
      availableFrom: 1,
      deadlineTick: 3,
      defaultOptionId: 't3-d1-d',
      requiredConcepts: ['ldi-collateral-waterfall', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'timeliness', 'marketRisk'],
      timeLimitSec: 120,
      options: [
        {
          id: 't3-d1-a',
          label: '한국은행 외화자금 입찰에 응찰',
          description:
            '한국은행이 공급하는 외화자금 입찰에 응찰한다. 현재 증권회사를 대상으로 한 외화 공급 입찰은 실시되지 않고 있다.',
          effects: [{ kind: 'counter', key: 'policyRequests', add: 1 }],
          requires: { flag: 'bok_swap_open' },
          unavailableReason:
            '증권회사가 응찰할 수 있는 한국은행 외화자금 입찰이 아직 없습니다.',
          expert: {
            rating: 70,
            rationale:
              '언젠가는 가장 싼 창구가 되지만 오늘은 존재하지 않는다. 창구가 없다는 사실을 확인하는 것도 조달 계획의 일부다.',
            sourceRefs: [S.bokAct, S.swapAuction],
          },
          consequences: '응찰할 수 있는 입찰이 없습니다.',
          feasibility: {
            basis: '3/19 시점 증권사 대상 외화자금 입찰 부재',
            sourceRefs: [S.swapAuction],
          },
        },
        {
          id: 't3-d1-b',
          label: 'FX 스왑 3,000억 신청(베이시스 −150bp)',
          description:
            '벌어진 베이시스를 감수하고 스왑을 신청한다. 은행 한도가 소진돼 신청액의 절반 이하만 체결된다.',
          effects: [fxSwapDraw({ amount: 3000, capacityShare: 0.45, label: 'FX 스왑 조달' })],
          expert: {
            rating: 74,
            rationale:
              '가격이 아니라 체결 가능 여부가 문제인 국면이다. 45%만 체결되더라도 그 금액은 오늘 저녁 결제에 쓰인다.',
            sourceRefs: [S.fsb, S.kcmiLee],
          },
          consequences: '신청액의 45%가 체결되었습니다. 나머지는 제시가 없었습니다.',
          historical: true,
          feasibility: { basis: '은행 스왑 한도 대부분 소진 — 부분 체결', sourceRefs: [S.fsb] },
          calibrationNote: '체결률 45%, 비용 = 금액 × 150bp × 0.25 [CAL]',
        },
        {
          id: 't3-d1-c',
          label: '외화 크레딧라인 잔여 한도 전액 인출',
          description:
            '남은 외화 크레딧라인을 모두 인출한다. 확정 라인이라 즉시 실행되지만 한도가 소진되면 이후 선택지가 사라진다.',
          effects: [drawFxLine({ amount: 4000, rateBp: 260, label: '외화 라인 전액 인출' })],
          expert: {
            rating: 78,
            rationale:
              '확정 라인은 이런 날을 위해 존재한다. 다만 외화 라인만 쓰고 원화 라인은 남겨 두는 것이 중요하다 — 두 라인을 같은 날 다 쓰면 신호가 된다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '외화 라인이 소진되었습니다. 원화 라인은 아직 남아 있습니다.',
          feasibility: { basis: '기존 약정 한도 내 당일 인출', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't3-d1-d',
          label: '현물시장에서 달러 3,000억 매입',
          description:
            'RP·현금으로 만든 원화로 현물 달러를 산다. 오늘은 호가가 벌어져 체결 슬리피지가 크고, 대량 주문은 환율을 더 밀어올린다.',
          effects: [
            repoRaise({ amount: 3500, haircut: 0.06, rateBp: 130 }),
            spotBuyUsd({ amount: 3000, slippageBp: 18, label: '현물 달러 매입' }),
          ],
          expert: {
            rating: 56,
            rationale:
              '가장 확실하지만 가장 비싸고, 업계 전체가 동시에 하면 원/달러를 밀어올려 자기 증거금의 원화 환산액을 키운다. 실제로 3월 하순 증권사의 달러 매입은 환율 불안 요인으로 지목됐다.',
            historicalNote: '업계는 CP·RP 매도로 원화를 만들고 현물에서 달러를 샀다.',
            sourceRefs: [S.kcmiLee, S.fsr],
          },
          consequences: '달러가 들어왔습니다. 담보 여력이 줄고 체결가는 불리했습니다.',
          feasibility: { basis: '현물시장 호가 확대 상태에서 체결 가능', sourceRefs: [S.ecosFx] },
          calibrationNote: '슬리피지 = 18bp × (1 + 금액/10,000), RP 헤어컷 6% [CAL]',
        },
        {
          id: 't3-d1-e',
          label: '원화·외화 확정 라인을 전부 동시 인출',
          description:
            '주거래은행 전부에 원화·외화 라인 전액 인출을 통보한다. 오늘의 결제는 확실히 해결된다.',
          effects: [drawAllLines({ ciPenalty: 12 })],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '주거래은행들이 미사용 한도를 축소한다',
              effects: [
                { kind: 'counter', key: 'linesCutPending', add: 1 },
                confidence(-4, '은행 라인 한도 축소'),
              ],
            },
          ],
          expert: {
            rating: 18,
            rationale:
              '오늘을 해결하고 내일을 잃는다. 모든 주거래은행이 같은 날 같은 신호를 읽으면 미사용 한도는 조용히 사라지고, 증권사 CP를 들고 있던 기관들도 같은 결론에 도달한다. 2008년 이후 위기마다 반복된 실수다.',
            sourceRefs: [S.bcbs144, S.fsb],
          },
          consequences:
            '원화·외화 라인이 모두 인출되었습니다. 오늘 결제는 해결되었고, 은행 여신담당자 전원이 같은 보고서를 쓰고 있습니다.',
          trap: true,
          trapExplanation:
            '확정 라인은 "쓰라고 있는 것"이 맞지만 **한 번에 전부** 쓰는 것은 다른 행동이다. 부분 인출은 유동성 관리이고 전액 동시 인출은 공시다 — 상대방은 그것을 최후의 수단으로 읽는다. 이 시나리오에서 가장 매력적인 함정이다.',
          remediationCard: 'contingency-funding-plan',
          irreversible: true,
          feasibility: { basis: '기존 약정 한도 내 — 계약상 즉시 가능', sourceRefs: [S.bcbs144] },
        },
        {
          id: 't3-d1-f',
          label: '헤지 델타 30% 축소로 증거금 소요 감축',
          description:
            '선물 포지션의 30%를 정리해 오늘과 앞으로의 증거금 소요를 줄인다. 그만큼 ELS 부채의 지수 위험이 열린다.',
          effects: [reduceHedge({ share: 0.3, label: '헤지 30% 축소' })],
          expert: {
            rating: 30,
            rationale:
              '증거금이 무서워 헤지를 푸는 것은 유동성 문제를 손익 문제로 바꾸는 것이다. 지수가 여기서 더 내려가면 열린 위험이 그대로 손실이 되고, 시장위험액 증가로 NCR도 깎인다.',
            sourceRefs: [S.fss, S.dlsPlan],
          },
          consequences:
            '델타가 줄어 증거금 소요가 감소했습니다. 지수 위험이 30% 열린 채 남았습니다.',
          feasibility: { basis: '선물 포지션 청산 — 당일 체결 가능', sourceRefs: [S.fss] },
          calibrationNote: '축소분 × 13% 시장위험액 증가, 이후 지수 변동의 40%가 자본 손익 [CAL]',
        },
      ],
    },
    {
      id: 't3-d2',
      title: '외화 유동성 현황 공표',
      prompt: '기자단과 신용평가사가 외화 유동성 현황을 묻습니다. 어떻게 답하시겠습니까?',
      context:
        '"증권사 마진콜"이 기사화되기 시작했습니다. 검증 가능한 수치는 신뢰를 지키지만, 여력이 실제로 부족하면 공표가 부족을 드러냅니다.',
      select: { min: 1, max: 1 },
      availableFrom: 3,
      required: false,
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't3-d2-a',
          label: '외화 유동자산과 증거금 소요를 수치로 공표',
          description:
            '보유 외화 유동자산, 미납 증거금, 확보한 조달 한도를 숫자로 공개한다. 여력이 실제로 충분할 때만 효과가 있다.',
          effects: [discloseFxPosition({ minCover: 3000 })],
          expert: {
            rating: 76,
            rationale:
              '검증 가능한 여력 공표는 완화 계수 0.7로 작동하지만, 수치가 부족을 드러내면 오히려 증폭된다. 공표 전에 여력을 만들어 두어야 한다는 순서가 핵심이다.',
            sourceRefs: [S.fsr, S.bcbs144],
          },
          consequences: '수치가 공개되었습니다. 시장 반응은 실제 여력에 달려 있습니다.',
          feasibility: { basis: '공시 규정 내 자율 공표 — 즉시 가능', sourceRefs: [S.fsr] },
        },
        {
          id: 't3-d2-b',
          label: '개괄적으로만 답변하고 수치는 밝히지 않는다',
          description:
            '"유동성 관리에 문제가 없다"는 수준으로만 답한다. 비용은 없지만 시장은 수치가 없다는 사실 자체를 읽는다.',
          effects: [confidence(-3, '수치 없는 안심 발언')],
          expert: {
            rating: 40,
            rationale:
              '위기 중 검증 불가능한 안심은 중립이 아니라 약한 음(−)의 신호다. 다만 여력이 실제로 부족한 상태에서는 상세 공표보다 손실이 작다.',
            sourceRefs: [S.fsr],
          },
          consequences: '개괄 답변이 나갔습니다. 후속 취재가 이어집니다.',
          historical: true,
          feasibility: { basis: '공시 의무 없음 — 재량 사항', sourceRefs: [S.fsr] },
        },
        {
          id: 't3-d2-c',
          label: '"마진콜은 없다"고 부인',
          description:
            '증거금 납입 사실 자체를 부인한다. 오늘 기사는 잦아들지만 청산회원·은행·감독당국은 실제 자금 흐름을 보고 있다.',
          effects: [
            flag('false_statement'),
            confidence(-2, '사실과 다른 설명'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '자금 흐름과 설명의 불일치가 드러난다',
              effects: [confidence(-14, '허위 설명 노출'), regulator({ add: 1 }, '설명 불일치 검사')],
            },
          ],
          expert: {
            rating: 6,
            rationale:
              '증거금 납입은 청산회원·결제은행·감독당국에 기록으로 남는다. 부인은 하루를 벌고 신뢰와 감독 관계를 동시에 잃는다. 불건전 영업행위로 제재 대상이 될 수 있다.',
            sourceRefs: [S.fsr, S.dlsPlan],
          },
          consequences: '부인 논평이 나갔습니다. 기록은 남아 있습니다.',
          trap: true,
          trapExplanation:
            '침묵보다 강력해 보이고 오늘의 기사를 막는다. 그러나 증거금 흐름은 여러 기관에 동시에 기록되므로 반드시 드러나며, 드러나는 순간 신뢰 하락폭이 침묵의 네 배다.',
          illegal: true,
          remediationCard: 'crisis-communication',
          feasibility: {
            basis: '물리적으로 가능하나 불건전 영업행위 — 제재 대상',
            sourceRefs: [S.fsr],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '"마진콜 대기"가 19시 컷오프에 결제됩니다. 그 시각까지 외화 유동자산이 그 금액 이상이어야 합니다.',
      decisionId: 't3-d1',
    },
    {
      level: 2,
      text: '환율이 오르면 같은 달러 금액의 원화 환산액이 늘어납니다. 오늘 아침 계산한 원화 소요는 저녁에 3% 이상 커집니다.',
      cardRefs: ['ldi-collateral-waterfall'],
      decisionId: 't3-d1',
    },
    {
      level: 3,
      when: { metric: 'fxLiquid', lt: 2000 },
      text: '외화 라인 잔여 한도를 먼저 쓰고, 원화 라인은 남겨 두십시오. 두 라인을 같은 날 모두 인출하면 다음 주 한도가 사라집니다.',
      cardRefs: ['contingency-funding-plan'],
      decisionId: 't3-d1',
    },
  ],
  relatedCards: ['ldi-collateral-waterfall', 'crisis-communication'],
}

export const turnsA: T[] = [t0, t1, t2, t3]
