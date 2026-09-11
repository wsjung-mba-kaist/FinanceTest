import type { Interrupt, SecuritiesState } from '../../engine/types'
import { securitiesFx } from '../../engine/fx/securities'
import { confidence, flag, op, ownStockMove, regulator } from '../../engine/fx/common'
import { legoFx } from './localFx'
import { rolloverDecision, S, type T } from './shared'
import { MM_TICK_LABELS } from './turnsA'

/** 11/1: 흥국생명 공시가 08:30에 나온 날 — 개장과 동시에 단기물 수요가 사라진다 [STYLIZED]. */
export const T5_CP_PROFILE = [0.3, 0.35, 0.25, 0.1]

/**
 * 11:00 콜머니 상대 은행 자금부 전화. 대사는 흥국생명 콜 미행사 직후의 크레딧 시장 반응(공개 기록)을
 * 바탕으로 한 **재구성**이며 실제 통화가 아니다.
 */
const t5CallDeskCall: Interrupt<SecuritiesState> = {
  id: 't5-i1-calldesk',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 40,
  defaultOptionId: 't5-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '콜머니 상대 은행 자금부 전화',
  prompt: '오늘 오후 콜 만기분의 롤오버 여부를 지금 알려 달라고 합니다.',
  dimensions: ['liquidity', 'communication'],
  source: { kind: 'desk', caller: '주거래은행 자금부 차장', tone: 'urgent' },
  lines: [
    {
      speaker: '자금부 차장',
      text: '아침 공시 보셨죠. 본부에서 증권사 무담보 콜 한도를 재검토하라는 지시가 내려왔습니다. 오늘 오후 만기분을 롤오버할지, 지금 말씀해 주셔야 한도를 잡아 둡니다.',
    },
  ],
  options: [
    {
      id: 't5-i1-a',
      label: '오늘 만기분은 상환하고 증권금융·RP로 대체하겠다고 답한다',
      description:
        '무담보 익일물 의존을 스스로 줄이고 담보 조달로 옮기겠다는 계획을 말한다. 상대 은행은 한도를 유지한다.',
      effects: [flag('call_desk_reassured')],
      expert: {
        rating: 75,
        rationale:
          'BCBS 2023이 정리한 대로 무담보 도매자금은 필요할 때 먼저 사라진다. 상대가 한도를 줄이기 전에 의존을 줄이겠다고 먼저 말하는 것이 한도를 남기는 방법이다.',
        sourceRefs: [S.bcbs555, S.bcbs144],
      },
      consequences:
        '자금부가 한도를 유지하겠다고 답했습니다. 대체 조달은 오늘 결정에 달려 있습니다.',
      historical: true,
      preview: [{ metric: 'cash', direction: 'flat', magnitude: 1, note: '한도 유지' }],
    },
    {
      id: 't5-i1-b',
      label: '한도 유지를 요청하며 11/15 후순위채 콜 행사를 확약한다',
      description:
        '흥국생명과 다르다는 것을 상대가 가장 신경 쓰는 지표로 말한다. 다만 이 자리에서 한 확약은 지켜야 한다.',
      effects: [flag('call_desk_reassured'), confidence(1, '콜 관행 준수 확약')],
      expert: {
        rating: 70,
        rationale:
          '시장이 지금 보는 것은 잔액이 아니라 콜 관행이다. 다만 확약은 T5의 콜옵션 결정과 일치해야 하며, 어긋나면 확약 자체가 증거가 된다.',
        sourceRefs: [S.pHeungkuk, S.fsr],
      },
      consequences: '자금부가 "그 말씀을 본부에 그대로 전하겠다"고 했습니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
    },
    {
      id: 't5-i1-c',
      label: '"문제없다"고만 답하고 구체적 계획은 말하지 않는다',
      description: '상세를 주지 않는다. 상대는 한도를 잡아 두지 못한다.',
      effects: [confidence(-2, '수치 없는 안심 답변')],
      expert: {
        rating: 25,
        rationale:
          '보정 규칙의 "수치 없는 침착 메시지"가 1:1 통화로 나타난 형태다. 무담보 대여자는 설명을 받지 못하면 한도부터 줄인다.',
        sourceRefs: [S.fsb, S.bcbs555],
      },
      consequences: '자금부가 "본부 판단에 맡기겠다"고 답했습니다.',
      trap: true,
      trapExplanation:
        '"불안을 키우지 말자"는 침묵이 대여자에게는 "설명할 수 없는 상태"로 읽힌다. 무담보 한도는 설명을 받지 못한 쪽부터 사라진다.',
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2022-11-01 (화) "2차 충격: 흥국생명"
// ---------------------------------------------------------------------------------------------
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2022년 11월 1일 (화) 09:00 KST',
  title: '2차 충격: 콜옵션',
  time: '2022-11-01T09:00:00+09:00',
  ticks: 4,
  tickLabels: MM_TICK_LABELS,
  entryEffects: [
    {
      id: 't5-market',
      description:
        '개장 앵커(10/31 종가): 국고 3년 4.185%, 회사채 AA- 5.580%, CD91 3.96%, CP91 4.65%; 자사 CP 호가 5.9%, 흥국생명 충격으로 증권주 −3%',
      effects: [
        op('market.custom.cp91', 'set', 465),
        op('market.custom.cd91', 'set', 396),
        op('market.fundingStressBp', 'set', 69),
        op('market.custom.creditSpreadAA', 'set', 139),
        op('market.creditSpreadIgBp', 'set', 139),
        op('market.custom.govt3y', 'set', 419),
        op('market.custom.corpAA3y', 'set', 558),
        op('market.custom.ownCpRate', 'set', 5.9),
        ownStockMove(-0.03, '흥국생명 콜옵션 미행사'),
      ],
    },
    {
      id: 't5-windows',
      description: '증권금융 특별 지원(10/26)·산은 CP 매입(10/27) 시행 — 창구 개방',
      effects: [flag('ksfc_window_open'), flag('kdb_cp_open')],
    },
    {
      id: 't5-rollrate',
      description: '차환 성공률 40% — 한은 RP·채안펀드의 간접 효과로 소폭 개선',
      effects: [legoFx.setRollRateWithAdj(0.4, '정책 스필오버(간접)')],
    },
    {
      id: 't5-ci',
      description: '흥국생명 콜 미행사(섹터 스필오버 −4) + 5대 지주 95조(+2) → 신뢰지수 −2',
      effects: [
        confidence(-4, '흥국생명 콜옵션 미행사 — 크레딧 2차 충격'),
        confidence(2, '5대 금융지주 95조 유동성 공급'),
      ],
    },
    {
      id: 't5-mtm',
      description: '채권 평가손 −40억, 보유 A2 ABCP 평가손 3%(유통금리 10%대)',
      effects: [
        op('institution.equityCapital', 'add', -40, '채권 평가손'),
        legoFx.markHeldAbcp({ pct: 0.03, reason: 'A2 PF-ABCP 유통금리 10%대' }),
      ],
    },
    {
      id: 't5-regulator',
      when: { metric: 'ncr', lt: 130 },
      description: 'NCR 130% 미만 — 금감원, 자본·유동성 확충 계획 제출 요구 (R2)',
      effects: [regulator({ set: 2 }, 'NCR 130% 미만 — 자본확충 계획 요구')],
    },
    {
      id: 't5-call',
      description: '콜차입(익일물) 정산 — 신뢰지수가 낮으면 대여자가 한도를 회수',
      effects: [legoFx.callRollStep()],
    },
  ],
  eachTick: [
    {
      id: 't5-cp-tick',
      description: 'CP·전단채 만기(잔액 9%) 재발행 — 청약 구간별 확정',
      effects: [legoFx.cpRollTicks({ share: 0.09, profile: T5_CP_PROFILE, label: 'CP 청약 구간' })],
    },
  ],
  tickEffects: [
    {
      id: 't5-settle',
      atTick: 3,
      description: '마감 결제 점검',
      effects: [legoFx.settlementCheck()],
    },
  ],
  ticker: {
    series: [
      // CP91 4.65%(보간) → 4.70%, CD91 3.96% → 3.97% (11/1 종가) [ecos-817Y002 / kofia-bond]
      { path: 'market.custom.cp91', mode: 'absolute', values: [465, 467, 469, 470] },
      { path: 'market.custom.cd91', mode: 'absolute', values: [396, 396, 397, 397] },
      { path: 'market.fundingStressBp', mode: 'absolute', values: [69, 71, 72, 73] },
      // 국고 3년 4.185% → 4.068%, 회사채 AA- 3년 5.580% → 5.486% (11/1 종가) [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [419, 415, 411, 407] },
      { path: 'market.custom.corpAA3y', mode: 'absolute', values: [558, 555, 552, 549] },
      // 스프레드는 두 계열의 차이 — 139 → 142bp
      { path: 'market.custom.creditSpreadAA', mode: 'absolute', values: [139, 140, 141, 142] },
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [139, 140, 141, 142] },
    ],
  },
  events: [
    {
      id: 't5-news-heungkuk',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '08:30',
      headline: '[속보] 흥국생명, 5억달러 신종자본증권 콜옵션 미행사 공시 — 한국물 채권가 급락',
      body: '흥국생명이 11/9 콜 도래 신종자본증권의 조기상환권을 행사하지 않겠다고 공시했다. 차환 발행 금리가 너무 높다는 이유다. 2009년 우리은행 이후 처음으로 한국 금융기관이 콜을 건너뛰면서 해외 투자자들은 "한국물 전체의 콜 관행이 깨졌다"고 반응했고, 해당 채권은 99.7달러에서 급락했다.',
      severity: 'critical',
      sourceRefs: [S.pHeungkuk],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't5-news-holdings',
      kind: 'newswire',
      outlet: '금융위원회',
      time: '09:00',
      headline:
        '5대 금융지주, 연말까지 95조원 유동성 공급 — 시장유동성 73조·채안/증안펀드 12조·계열사 10조',
      body: '금융위원장과 5대 금융지주 회장단 간담회에서 지주사들이 연말까지 95조원의 유동성을 공급하기로 했다. 은행의 RP 매수·크레딧라인 유지가 포함된다.',
      severity: 'positive',
      sourceRefs: [S.fsc1028],
    },
    {
      id: 't5-news-bok',
      kind: 'newswire',
      outlet: '한국은행',
      time: '09:10',
      headline:
        '한은 RP 매입 6조원 시행(~2023.1.31), 적격담보에 은행채·공공기관채 포함(11/1~3개월), 담보비율 인상 유예',
      body: '한은법 68조 공개시장운영에 따른 조치로 최대 36.5조원의 유동성 효과가 기대된다. 대상은 RP 매매 대상기관(은행·일부 증권사)이며 그 밖의 증권사는 은행·증권금융을 통해 간접 수혜한다.',
      severity: 'positive',
      sourceRefs: [S.bokOmo, S.bokAct],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't5-news-gangwon',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '09:20',
      headline: '강원도, 레고랜드 ABCP 상환 시점 "12월 15일"로 앞당겨 (10/27 발표)',
      body: '1월 29일에서 12월 15일로 앞당겼지만 시장은 이미 지자체 보증을 할인해 평가하고 있다.',
      severity: 'info',
      sourceRefs: [S.gangwon],
    },
    {
      id: 't5-memo-treasury',
      kind: 'memo',
      time: '09:40',
      from: '자금부장',
      to: 'CRO',
      subject: '11/15 후순위채 500억 콜 도래 — 차환 발행 조건',
      body: `- 우리 후순위채 500억(영업용순자본 가산분)의 콜이 11/15 도래합니다. 차환 발행 호가는 **8%대**(기존 4%대). 콜을 건너뛰면 스텝업 금리로 5년 연장됩니다.
- 흥국생명 사례 직후라 시장은 모든 금융기관의 콜 결정을 지켜보고 있습니다.
- 증권금융 창구가 열렸습니다(RP·증권담보대출). 산은 CP 매입은 일반기업 CP 위주로 증권사 CP 편입은 미정.
- 현금 {{metric:cash}}, 유동성비율 {{metric:liquidityRatio}}, 이번 턴 만기 {{metric:abcpMaturingNext}}.`,
      severity: 'critical',
      sourceRefs: [S.pHeungkuk, S.fsc1028],
      relatedMetrics: ['cash', 'liquidityRatio', 'abcpMaturingNext'],
    },
    {
      id: 't5-regulator-fss',
      kind: 'regulator',
      when: { metric: 'ncr', lt: 130 },
      agency: '금융감독원 금융투자검사국',
      time: '14:00',
      atTick: 2,
      headline: '[감독당국] NCR 130% 미만 — 자본·유동성 확충 계획 제출 요구',
      body: '귀사의 순자본비율이 내부 관리 기준(130%)을 밑돌고 있습니다. 2주 내 자본 확충·자산 매각·익스포저 축소 계획을 제출하고, 신규 PF 신용공여를 중단하십시오.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.fss],
      cardRefs: ['regulator-escalation-ladder'],
    },
  ],
  decisions: [
    {
      // 차환 마감(15:30) 집계가 나온 뒤에야 미달 금액이 확정된다 — 이 결정은 마지막 틱에 열린다.
      ...rolloverDecision({
        turn: 5,
        riskWeight: 1,
        prompt: '11/1~8 만기(750억 + 추가분) 중 차환 실패분(약 60%)을 어떻게 처리하시겠습니까?',
        context:
          '11월은 만기가 가장 많은 달입니다. 마감 집계가 방금 나왔습니다. 이번 턴 매입은 여전히 위험값 100%로 신용위험액에 가산됩니다.',
        honour: {
          rating: 70,
          rationale:
            '이행. 11월 만기의 벽에서 자체매입 잔액이 급증한 것이 업계 현실이었고, 이것이 11/9 특례의 배경이 됐다.',
          historicalNote: '11월 초 증권사 자체매입 잔액이 급증했다.',
          consequences: '차환 실패분을 자체매입했습니다. 보유 ABCP가 크게 늘었습니다.',
        },
        negotiate: {
          rating: 75,
          extendShare: 0.4,
          rationale:
            '연장분은 11월 말(T7)로 밀린다. 그 시점의 시장은 알 수 없지만, 지금 위험값 100%로 사는 것보다는 낫다.',
          consequences: '일부 연장, 잔여분 자체매입.',
        },
        abandon: {
          rating: 5,
          rationale:
            '흥국생명 콜 미행사로 시장이 극도로 예민한 시점의 불이행은 즉각적인 시장 퇴출을 부른다.',
          consequences: 'SPC 부도 처리. 콜 대여자들이 한도 회수를 통보했습니다.',
          trapExplanation:
            '흥국생명이 보여주듯 시장은 "약속을 지키지 않는 기관"을 즉시 가격에 반영한다.',
        },
      }),
      availableFrom: 3,
      defaultOptionId: 't5-d1-a',
      timeLimitSec: 120,
    },
    {
      id: 't5-d2',
      title: '조달 채널 선택',
      prompt: '어떤 창구를 쓰시겠습니까? (최대 2개)',
      context:
        '증권금융 창구가 열렸습니다. 한은 RP는 대상기관이 아닙니다. 산은 CP 매입은 아직 일반기업 위주입니다. 당일 자금이 되려면 오후 중에 신청이 접수되어야 합니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['liquidity', 'policy'],
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't5-d2-a',
      options: [
        {
          id: 't5-d2-a',
          label: '증권금융 RP·증권담보대출 500억 추가',
          description:
            '보유 채권 담보로 증권금융 특별 지원을 이용한다(4.9%). 창구가 열려 있어 즉시 입금.',
          requires: { flag: 'ksfc_window_open' },
          unavailableReason: '증권금융 특별 지원 창구가 아직 열리지 않았습니다.',
          effects: [securitiesFx.raiseFunding({ channel: 'ksfc', amount: 500, rateBp: 490 })],
          expert: {
            rating: 80,
            rationale:
              '범위가 정확히 일치하는 창구. 금융위 10/28 점검회의가 확인한 증금 3조+α의 정상 집행.',
            historicalNote: '중소형 증권사들이 실제로 가장 많이 이용한 창구.',
            sourceRefs: [S.fsc1028, S.pkg],
          },
          consequences: '증권금융 자금이 입금되었습니다.',
          historical: true,
        },
        {
          id: 't5-d2-b',
          label: '한국은행 RP 매입(6조) 입찰 참여',
          description: '한은법 68조 RP 매입. 대상기관(은행·일부 대형 증권사)만 참여 가능.',
          requires: { flag: 'bok_rp_counterparty' },
          unavailableReason:
            '한빛증권은 한은 RP 매매 대상기관이 아닙니다. 한은 유동성은 은행·증권금융 경로로만 닿습니다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bok', amount: 1000, rateBp: 300 })],
          expert: {
            rating: 70,
            rationale:
              '대상기관이라면 최선. 중형사에는 존재하지 않는 창구 — 이것이 2020년과 2022년 정책 설계의 핵심 제약이었다.',
            sourceRefs: [S.bokOmo, S.bokAct],
          },
          consequences: '입찰에 참여했습니다.',
        },
        {
          id: 't5-d2-c',
          label: '5대 지주 95조 발표 근거로 주거래은행 크레딧라인 500억 증액 요청',
          description:
            '지주 회장단 약속을 근거로 라인 증액을 요청한다. 은행 심사를 거쳐 다음 턴에 반영된다.',
          effects: [flag('line_increase_requested')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '5대 지주 유동성 공급 약속에 따라 은행 크레딧라인 500억 증액 승인',
              effects: [op('institution.liquidity.creditLines', 'add', 500, '크레딧라인 증액')],
            },
          ],
          expert: {
            rating: 60,
            rationale:
              '집행 시차가 있지만 정책 발표를 자기 기관의 확정 라인으로 바꾸는 올바른 행동이다.',
            sourceRefs: [S.fsc1028, S.bcbs144],
          },
          consequences: '은행이 증액 심사에 들어갔습니다. 결과는 다음 주입니다.',
        },
        {
          id: 't5-d2-d',
          label: '산은 CP 매입 프로그램에 자사 CP 500억 매각 신청',
          description:
            '10/27 시행 산은 CP 매입은 일반기업 CP 위주라 지금은 10%만 소화된다. 증권사 CP로 범위가 넓어지면 나머지가 다음 턴에 소화된다.',
          requires: { flag: 'kdb_cp_open' },
          unavailableReason: '산은 CP 매입 프로그램이 아직 시행되지 않았습니다.',
          effects: [legoFx.sellOwnCpToProgramme({ amount: 500, scopeShare: 0.1, rateBp: 590 })],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                '11/11 산은·증권금융 증권사 CP·PF-ABCP 매입 프로그램 가동 — 잔여 신청분 소화',
              effects: [legoFx.sellOwnCpToProgramme({ amount: 500, scopeShare: 0.8, rateBp: 610 })],
            },
          ],
          expert: {
            rating: 65,
            rationale:
              '지금은 범위 밖(10%)이지만 신청을 걸어두면 범위가 확대되는 순간(11/11) 집행된다. 정책 범위는 시간에 따라 넓어진다는 것을 이해한 행동.',
            sourceRefs: [S.kdb1111, S.fsc1028],
          },
          consequences: '산은에 신청했습니다. 일부만 즉시 소화되었고 나머지는 대기열에 있습니다.',
        },
        {
          id: 't5-d2-e',
          label: '자사 CP 500억 고금리(7%) 발행 시도',
          description: '신뢰지수 60 이상이면 전액, 40~59면 절반, 미만이면 0.',
          effects: [securitiesFx.raiseFunding({ channel: 'cp', amount: 500, rateBp: 700 })],
          expert: {
            rating: 35,
            rationale:
              '7%대 CP는 그 자체가 신용 사건으로 읽힌다. 정책 창구가 있는데 시장 조달에 매달릴 이유가 없다.',
            sourceRefs: [S.pCp],
          },
          consequences: 'CP 발행을 시도했습니다(소화분은 로그 참조).',
        },
      ],
    },
    {
      id: 't5-d3',
      title: '후순위채 콜옵션',
      prompt: '11/15 콜 도래 후순위채 500억을 어떻게 하시겠습니까?',
      context:
        '차환 발행 금리는 8%대입니다. 콜을 건너뛰면 이자를 아끼지만, 흥국생명이 방금 무엇을 겪었는지 시장은 기억합니다. 주관 증권사는 오후 중에 답을 받아야 11/15 일정을 맞출 수 있다고 합니다.',
      requiredConcepts: ['crisis-communication', 'capital-raise-sequencing'],
      dimensions: ['communication', 'solvency', 'compliance'],
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't5-d3-a',
      options: [
        {
          id: 't5-d3-a',
          label: '콜 행사 후 신규 후순위채 500억 차환 발행 (8%대)',
          description:
            '관행대로 콜을 행사하고 비싸게 차환한다. 신뢰지수 45 이상이면 전액 소화, 미만이면 절반만 사모로 소화되고 나머지는 현금 상환(가산자본 감소).',
          effects: [legoFx.exerciseCallRefinance({ amount: 500, ciFloor: 45, rateBp: 850 })],
          expert: {
            rating: 75,
            rationale:
              '시장 관행 준수가 시장 접근성을 지킨다. 흥국생명은 11/7 결정을 번복하고 11/9 콜을 행사했으며 그 사이 채권가는 72달러까지 밀렸다. 이자 비용은 시장 폐쇄 비용보다 싸다.',
            historicalNote: '흥국 번복 이후 다른 금융기관들은 예외 없이 콜을 행사했다.',
            sourceRefs: [S.pHeungkuk, S.fsr],
          },
          consequences: '콜을 행사했습니다. 차환 발행 결과는 로그를 확인하세요.',
          historical: true,
        },
        {
          id: 't5-d3-b',
          label: '콜 미행사: 스텝업 금리 수용하고 5년 연장 — 조달비용 절감',
          description:
            '8%대 차환 대신 스텝업(약 6%)으로 5년 더 간다. 연간 10억 이상 이자를 아낀다. 시장은 "한빛도 못 갚는다"로 읽는다.',
          effects: [legoFx.skipCall()],
          expert: {
            rating: 5,
            rationale:
              '흥국생명이 11/1에 한 결정 그대로다. 결과: 한국물 전체 채권가 급락, 6일 만의 번복, 당국의 사실상 압박. 보정 규칙 6.10: 콜 미행사 → ΔCI −20, 시장 폐쇄 6개월+. 중형 증권사에게는 CP 시장 폐쇄를 뜻한다.',
            sourceRefs: [S.pHeungkuk, S.fsr],
          },
          consequences:
            '콜 미행사를 공시했습니다. CP 데스크: "한빛 CP 호가 없음." 콜 대여자들이 한도를 줄이고 있습니다.',
          trap: true,
          trapExplanation:
            '이자 절감액(연 10억대)은 눈에 보이고 시장 접근성 상실 비용은 보이지 않는다. 그러나 후자는 CP 7,000억의 차환 전체를 건다. 흥국생명은 이 계산을 6일 만에 다시 했다.',
          irreversible: true,
          remediationCard: 'crisis-communication',
        },
        {
          id: 't5-d3-c',
          label: '콜 행사 후 차환 없이 현금 상환',
          description:
            '비싼 차환을 피하고 현금으로 갚는다. 후순위채는 영업용순자본 가산분이므로 NCR이 약 33%p 하락한다.',
          effects: [legoFx.redeemCallCash({ amount: 500 })],
          expert: {
            rating: 50,
            rationale:
              '시장 관행은 지키지만 자본과 현금을 동시에 잃는다. NCR·유동성에 여유가 있을 때만 정당화된다.',
            sourceRefs: [S.kcmi23],
          },
          consequences: '후순위채를 현금으로 상환했습니다. 영업용순자본 가산분이 사라졌습니다.',
        },
        {
          id: 't5-d3-d',
          label: '콜 결정을 1주 보류하며 시장 반응 관찰',
          description:
            '"검토 중" 공시로 시간을 번다. 시장은 보류 자체를 미행사 예고로 읽는다(신뢰지수 −8). 다음 턴 콜 행사 시 절반만 차환.',
          effects: [confidence(-8, '콜 결정 보류 공시')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '보류 끝에 콜 행사 — 차환 발행은 절반(250억)만 소화, 잔여분 현금 상환',
              effects: [
                op('institution.liquidity.cash', 'add', -250, '후순위채 잔여 현금 상환'),
                op('institution.additions', 'add', -250, '가산자본 감소'),
                flag('call_exercised'),
              ],
            },
          ],
          expert: {
            rating: 25,
            rationale:
              'DB생명이 11/3 콜을 연기했을 때 시장은 미행사와 같은 반응을 보였다. 보류는 중립이 아니다.',
            sourceRefs: [S.pHeungkuk],
          },
          consequences: '"검토 중" 공시가 나갔습니다. 채권 호가가 즉시 밀렸습니다.',
        },
      ],
    },
  ],
  interrupts: [t5CallDeskCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d3',
      text: '이자 절감액과 CP 잔액 7,000억의 차환 위험을 나란히 놓고 보세요.',
    },
    {
      level: 2,
      decisionId: 't5-d2',
      text: '한은 RP는 대상기관만 씁니다. 중형사는 증권금융(범위 일치)과 은행(간접 경로)이 창구입니다.',
    },
    {
      level: 3,
      decisionId: 't5-d3',
      text: 'A(콜 행사+차환)가 정석입니다. B는 흥국생명이 6일 만에 번복한 함정입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2022-11-09 (수) "NCR 특례"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2022년 11월 9일 (수) 09:00 KST',
  title: 'NCR 위험값 32% 특례',
  time: '2022-11-09T09:00:00+09:00',
  entryEffects: [
    {
      id: 't6-market',
      description:
        'CP91 4.92%(11/7), CD91 3.97%, 스프레드 151bp, 자사 CP 6.1%; 흥국 번복·특례로 증권주 +4%',
      effects: [
        op('market.custom.cp91', 'set', 492),
        op('market.custom.cd91', 'set', 397),
        op('market.fundingStressBp', 'set', 95),
        op('market.custom.creditSpreadAA', 'set', 151),
        op('market.creditSpreadIgBp', 'set', 151),
        op('market.custom.govt3y', 'set', 409),
        op('market.custom.corpAA3y', 'set', 559),
        op('market.custom.ownCpRate', 'set', 6.1),
        ownStockMove(0.04, '흥국 번복·NCR 특례'),
      ],
    },
    {
      id: 't6-ncr-relief',
      description: '금융위 특례: 자기보증 PF-ABCP 자체매입분 NCR 위험값 100% → 32% (2023.6.30까지)',
      effects: [
        securitiesFx.reweightHeldAbcp({ from: 1, to: 0.32, reason: '금융위 11/9 특례' }),
        flag('ncr_relief'),
      ],
    },
    {
      id: 't6-rollrate',
      description: '차환 성공률 45%',
      effects: [legoFx.setRollRateWithAdj(0.45, '특례·흥국 번복으로 심리 소폭 개선')],
    },
    {
      id: 't6-ci',
      description: '흥국생명 번복·콜 행사(+3), NCR 특례(범위 일치, +3) → 신뢰지수 +6',
      effects: [confidence(3, '흥국생명 콜 행사로 번복'), confidence(3, 'NCR 위험값 32% 특례')],
    },
    {
      id: 't6-regulator-ncr',
      when: { metric: 'ncr', lt: 130 },
      description: 'NCR 130% 미만 지속 — 감독 단계 R2',
      effects: [regulator({ set: 2 }, 'NCR 130% 미만')],
    },
    {
      id: 't6-regulator-default',
      when: { flag: 'abcp_default' },
      description: '매입확약 불이행 — 금감원 현장 검사 착수 (R3)',
      effects: [regulator({ set: 3 }, '매입확약 불이행 검사')],
    },
    {
      id: 't6-cp',
      description: 'CP 만기(잔액 9%) 재발행',
      effects: [legoFx.cpRollStep({ share: 0.09 }), legoFx.callRollStep()],
    },
    { id: 't6-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't6-news-ncr32',
      kind: 'newswire',
      outlet: '금융위원회',
      time: '09:00',
      headline:
        '[속보] 금융위, 증권사가 자기 보증 PF-ABCP를 매입할 때 NCR 위험값 32% 적용 — 내년 6월 말까지',
      body: '차환 실패 PF-ABCP를 자체매입한 증권사의 순자본비율 부담을 덜기 위해 해당 매입분의 신용위험액 위험값을 100%에서 32%로 낮춘다. 자기 보증분에 한정되며 타사 보증 ABCP 매입에는 적용되지 않는다.',
      severity: 'positive',
      sourceRefs: [S.ncr32],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't6-news-heungkuk-reversal',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '09:05',
      headline:
        '흥국생명, 콜옵션 미행사 결정 번복(11/7) — 오늘 5억달러 조기상환. 채권가 72.2달러까지 밀렸다가 회복',
      body: '당국과 시장의 압박 끝에 흥국생명은 6일 만에 결정을 뒤집었다. 그 사이 한국 금융기관 신종자본증권·후순위채 가격이 일제히 하락했고, DB생명도 콜 연기를 철회했다.',
      severity: 'warning',
      sourceRefs: [S.pHeungkuk],
    },
    {
      id: 't6-news-cp',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '09:10',
      headline: 'CP91 4.92%(11/7) — 10월 초부터 하루도 빠짐없이 상승',
      body: '대책 발표 후 회사채 AA-는 안정세지만 CP·전단채 금리는 여전히 오른다. 증권사 CP와 A2 PF-ABCP가 채안펀드 범위 밖이라는 점이 원인으로 꼽힌다.',
      severity: 'warning',
      sourceRefs: [S.kofia],
    },
    {
      id: 't6-memo-risk',
      kind: 'memo',
      time: '10:00',
      from: '리스크관리부장',
      to: 'CRO',
      subject: 'NCR 특례 반영 결과',
      body: `- 자체매입 ABCP {{metric:abcpHeld}}의 위험값이 32%로 재계산되어 신용위험액이 줄었습니다. NCR {{metric:ncr}}.
- 특례는 **자기 보증분에 한정**됩니다. 타사 보증 ABCP를 저가 매입하면 여전히 위험값 100%입니다.
- 자회사 출자금은 영업용순자본 차감항목입니다 — 매각 시 차감이 해소되어 NCR이 개선됩니다(현금도 유입).`,
      severity: 'info',
      sourceRefs: [S.ncr32, S.kcmi23],
      relatedMetrics: ['ncr', 'abcpHeld'],
    },
    {
      id: 't6-news-daol',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '14:00',
      headline: '중형 증권사들 비용 절감·자산 매각 착수 — 희망퇴직, 해외 자회사 매각 검토',
      body: '한 중형 증권사가 희망퇴직을 실시하고 태국 자회사 매각을 검토 중인 것으로 알려졌다. PF 우발채무 비율이 높은 증권사들의 디레버리징이 본격화되고 있다.',
      severity: 'info',
      sourceRefs: [S.pDaol],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 6,
      riskWeight: 0.32,
      prompt: '11/9~23 만기(1,050억 + 연장분) 중 차환 실패분(약 55%)을 어떻게 처리하시겠습니까?',
      context:
        '이번 턴부터 자체매입분은 위험값 32%로 가산됩니다. NCR 부담은 줄었지만 현금은 그대로 나갑니다.',
      honour: {
        rating: 75,
        rationale:
          '특례로 자본 비용이 1/3로 줄었으니 이행의 상대적 매력이 커졌다. 현금 여력이 있으면 이행이 협상보다 단순하고 확실하다.',
        consequences: '차환 실패분을 자체매입했습니다(위험값 32%).',
      },
      negotiate: {
        rating: 72,
        extendShare: 0.35,
        rationale:
          '연장분은 12월로 밀린다. 특례 이후에는 협상의 자본 절감 효과가 작아졌지만 현금 절감은 여전하다.',
        consequences: '일부 연장, 잔여분 자체매입.',
      },
      abandon: {
        rating: 5,
        rationale:
          '당국이 자체매입을 돕는 특례를 낸 직후의 불이행은 정책 의도를 정면으로 거스른다.',
        consequences: 'SPC 부도 처리. 금감원 검사가 시작되었습니다.',
        trapExplanation: '특례는 이행을 전제로 설계됐다. 불이행 기관에는 특례도 프로그램도 없다.',
      },
    }),
    {
      id: 't6-d2',
      title: '비용 절감·자산 매각',
      prompt: '디레버리징을 어떻게 진행하시겠습니까?',
      context: '자회사 매각은 현금과 NCR을 동시에 개선하지만 완료까지 한 달이 걸립니다.',
      dimensions: ['solvency', 'liquidity'],
      options: [
        {
          id: 't6-d2-a',
          label: '희망퇴직 실시 + 해외 자회사 매각 추진 (완료 시 현금 400억·차감항목 해소)',
          description:
            '희망퇴직 비용 30억을 즉시 반영하고 자회사 매각을 시작한다. 12월 완료 시 현금 400억 유입, 영업용순자본 차감항목 400억 해소.',
          effects: [
            op('institution.equityCapital', 'add', -30, '희망퇴직 비용'),
            flag('asset_sale_started'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '해외 자회사 매각 완료 — 현금 +400억, 영업용순자본 차감항목 −400억',
              effects: [
                op('institution.liquidity.cash', 'add', 400, '자회사 매각 대금'),
                op('institution.deductions', 'add', -400, '자회사 출자금 차감 해소'),
              ],
            },
          ],
          expert: {
            rating: 65,
            rationale:
              '다올투자증권의 실제 대응(희망퇴직, 다올타일랜드 매각). 자회사 출자금이 영업용순자본 차감항목이라는 NCR 구조를 이용한 정공법이다. 다만 완료까지 시차가 있다.',
            historicalNote: '다올투자증권은 2022년 11월 희망퇴직과 태국 자회사 매각을 추진했다.',
            sourceRefs: [S.pDaol, S.kcmi23],
          },
          consequences:
            '희망퇴직 공고와 자회사 매각 자문사 선정이 끝났습니다. 매각 대금은 12월에 들어옵니다.',
          historical: true,
        },
        {
          id: 't6-d2-b',
          label: '신규 PF 영업 중단·조직 축소만 실시 (자산 매각 없음)',
          description: '비용 절감만 한다. 현금·NCR 개선 효과는 작다(비용 10억).',
          effects: [
            op('institution.equityCapital', 'add', -10, '조직 축소 비용'),
            flag('deleveraging_announced'),
          ],
          expert: {
            rating: 50,
            rationale:
              '방향은 맞지만 규모가 작다. 위기에서 필요한 것은 현금과 NCR이지 비용 절감이 아니다.',
            sourceRefs: [S.kcmi23],
          },
          consequences: '신규 PF 영업을 중단하고 조직을 축소했습니다.',
        },
        {
          id: 't6-d2-c',
          label: '현상 유지 — 특례로 NCR 여유가 생겼으니 추가 조치 없음',
          description: '특례가 NCR을 되돌렸으니 디레버리징을 미룬다.',
          effects: [],
          expert: {
            rating: 35,
            rationale: '특례는 2023.6.30까지의 시한부다. 특례가 끝나면 위험값은 100%로 돌아온다.',
            sourceRefs: [S.ncr32],
          },
          consequences: '추가 조치 없이 지켜봅니다.',
        },
        {
          id: 't6-d2-d',
          label: '특례로 생긴 NCR 여유로 타사 보증 A2 ABCP 500억 저가 매입 (10%대 수익)',
          description:
            '유통금리 10%대인 타사 보증 ABCP를 산다. 특례는 자기 보증분에만 적용되므로 위험값 100%. 현금 500억 소진.',
          effects: [
            op('institution.liquidity.cash', 'add', -500, '타사 ABCP 매입'),
            op('institution.risk.credit', 'add', 500, '타사 ABCP 신용위험액(위험값 100%)'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '타사 ABCP 이자 수익 25억',
              effects: [op('institution.equityCapital', 'add', 25, '타사 ABCP 이자')],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '특례의 범위(자기 보증분)를 오독한 결정. 위험값 100%로 NCR −33%p, 현금 −500억. 수익률 10%가 매력적으로 보이지만 12월 결산 NCR·유동성비율이 먼저다.',
            sourceRefs: [S.ncr32, S.kcmi23],
          },
          consequences: '타사 ABCP를 매입했습니다. 신용위험액이 위험값 100%로 늘었습니다.',
          trap: true,
          trapExplanation:
            '"당국이 위험값을 낮췄으니 ABCP를 사도 된다"는 일반화는 특례의 범위 조항을 놓친다. 정책 범위는 항상 문장 단위로 읽어야 한다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d2',
      text: 'NCR 산식에서 "차감항목"을 보세요. 자회사 출자금을 팔면 분자가 두 번 좋아집니다(현금 + 차감 해소).',
    },
    {
      level: 3,
      decisionId: 't6-d2',
      text: 'A(자회사 매각)가 정공법입니다. D는 특례 범위를 오독한 함정입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2022-11-24 (목) "PF-ABCP 매입프로그램"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2022년 11월 24일 (목) 09:00 KST',
  title: '종투사 PF-ABCP 매입프로그램',
  time: '2022-11-24T09:00:00+09:00',
  entryEffects: [
    {
      id: 't7-market',
      description:
        '기준금리 3.25%, CP91 5.49%, CD91 4.03%(11/21 4% 돌파), 스프레드 171bp, 국고3y 3.689%, 자사 CP 6.7%',
      effects: [
        op('market.policyRateBp', 'set', 325),
        op('market.custom.cp91', 'set', 549),
        op('market.custom.cd91', 'set', 403),
        op('market.fundingStressBp', 'set', 146),
        op('market.custom.creditSpreadAA', 'set', 171),
        op('market.creditSpreadIgBp', 'set', 171),
        op('market.custom.govt3y', 'set', 369),
        op('market.custom.corpAA3y', 'set', 540),
        op('market.custom.ownCpRate', 'set', 6.7),
        ownStockMove(0.05, 'PF-ABCP 매입프로그램'),
      ],
    },
    {
      id: 't7-programme',
      description: '종투사 PF-ABCP 매입프로그램(1.8조, A2, 사당 2,000억) 가동 — 창구 개방',
      effects: [flag('pf_programme_open')],
    },
    {
      id: 't7-rollrate',
      description: '차환 성공률 55% — 상품 특정 프로그램(범위 일치)',
      effects: [legoFx.setRollRateWithAdj(0.55, 'PF-ABCP 매입프로그램 발표')],
    },
    {
      id: 't7-ci',
      description: 'PF-ABCP 매입프로그램(범위 일치 100%) → 신뢰지수 +8',
      effects: [confidence(8, '종투사 PF-ABCP 매입프로그램')],
    },
    {
      id: 't7-cp',
      description: 'CP 만기(잔액 16%) 재발행',
      effects: [legoFx.cpRollStep({ share: 0.16 }), legoFx.callRollStep()],
    },
    { id: 't7-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't7-news-programme',
      kind: 'newswire',
      outlet: '금융위원회·금융투자협회',
      time: '09:00',
      headline:
        '[속보] 9개 종투사 출자 PF-ABCP 매입프로그램 1.8조원 가동 — A2 등급, 사당 2,000억, 매입금리 10%대',
      body: '대형 증권사들이 출자한 프로그램이 중소형 증권사 보증 A2 PF-ABCP를 매입한다. 1차 매입 규모는 2,938억원. 채안펀드 범위 밖이던 A2 PF-ABCP에 처음으로 상품 특정 매입 창구가 생겼다.',
      severity: 'positive',
      sourceRefs: [S.prog1124],
      cardRefs: ['korea-crisis-toolkit', 'pf-abcp-commitment-ncr'],
    },
    {
      id: 't7-news-rate',
      kind: 'newswire',
      outlet: '한국은행',
      time: '09:50',
      headline: '한은 기준금리 3.00→3.25% 인상 — 이창용 총재 "단기금융시장 안정 조치 병행"',
      body: '금통위는 25bp 인상하면서도 RP 매입과 적격담보 확대를 유지한다고 밝혔다.',
      severity: 'info',
      sourceRefs: [S.bokRate],
    },
    {
      id: 't7-news-cp',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '15:40',
      headline: 'CP91 5.49% — 10월 초 이후 하루도 빠짐없이 상승, 5.5% 목전',
      body: 'CD91은 11/21 14년 만에 4%를 넘었다. 시장은 프로그램이 실제 매입에 들어가야 CP 금리가 꺾일 것으로 본다.',
      severity: 'warning',
      sourceRefs: [S.kofia, S.pCp],
    },
    {
      id: 't7-news-kdb',
      kind: 'newswire',
      outlet: '금융위원회',
      time: '10:00',
      headline: '(참고) 11/11 산은·증권금융 증권사 CP·PF-ABCP 매입 프로그램 가동 이후 집행 현황',
      body: '10/23 대책의 회사채·CP 매입 범위가 11/11 증권사 CP·PF-ABCP로 확대되어 집행 중이다. 발표(10/23)에서 증권사 상품 특정 집행(11/11·11/24)까지 3~5주가 걸렸다.',
      severity: 'info',
      sourceRefs: [S.kdb1111, S.prog1124],
    },
    {
      id: 't7-memo-treasury',
      kind: 'memo',
      time: '10:30',
      from: '자금부장',
      to: 'CRO',
      subject: '프로그램 매각 조건 — 보유 ABCP {{metric:abcpHeld}}',
      body: `- 매입금리 10%대 → 3개월물 매각가 약 97(할인 3%). 사당 한도 2,000억.
- 매각 시 현금 유입, 신용위험액(위험값 32%) 감소, 할인분은 손실.
- 매각 대금으로 콜·CP를 상환하면 유동성비율 분모가 줄어듭니다.`,
      severity: 'info',
      sourceRefs: [S.prog1124],
      relatedMetrics: ['abcpHeld', 'liquidityRatio'],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 7,
      riskWeight: 0.32,
      prompt: '11/24~30 만기(700억 + 연장분) 중 차환 실패분(약 45%)을 어떻게 처리하시겠습니까?',
      context: '프로그램이 생겨 차환률이 55%로 올랐습니다. 매입분은 프로그램에 되팔 수 있습니다.',
      honour: {
        rating: 78,
        rationale: '이행 후 프로그램에 매각하는 경로가 열렸다. 협상보다 이행이 단순하고 확실하다.',
        consequences: '차환 실패분을 자체매입했습니다.',
      },
      negotiate: {
        rating: 65,
        extendShare: 0.3,
        rationale:
          '연장분은 게임 지평 밖(2023.1)으로 밀린다. 프로그램이 있으니 굳이 연장 수수료를 낼 이유가 줄었다.',
        consequences: '일부 연장, 잔여분 자체매입.',
      },
      abandon: {
        rating: 5,
        rationale: '매입 창구가 있는데 불이행하는 것은 설명이 불가능하다.',
        consequences: 'SPC 부도 처리.',
        trapExplanation: '프로그램이 있는 시점의 불이행은 유동성 문제가 아니라 고의로 읽힌다.',
      },
    }),
    {
      id: 't7-d2',
      title: '프로그램 참여',
      prompt: '보유 A2 ABCP를 프로그램에 얼마나 매각하시겠습니까?',
      context: '할인 3%는 확정 손실이지만 현금과 NCR을 동시에 개선합니다.',
      requiredConcepts: ['pf-abcp-commitment-ncr'],
      dimensions: ['liquidity', 'solvency', 'policy'],
      options: [
        {
          id: 't7-d2-a',
          label: '보유 ABCP 1,500억 프로그램 매각 (할인 3%)',
          description:
            '한도(2,000억) 내에서 대부분을 판다. 손실 최대 45억, 현금 유입, 신용위험액 감소.',
          requires: { flag: 'pf_programme_open' },
          unavailableReason: '프로그램이 아직 가동되지 않았습니다.',
          effects: [
            securitiesFx.sellHeldAbcp({ amount: 1500, priceDiscount: 0.03, riskWeight: 0.32 }),
            flag('programme_used'),
          ],
          expert: {
            rating: 80,
            rationale:
              '상품 특정 프로그램은 정확히 이 목적으로 만들어졌다. 3% 할인은 연말 NCR·유동성비율 결산 앞에서 싼 보험이다. 2023.5 금융위의 4.9조 대출 전환은 같은 논리의 연장선이다.',
            historicalNote: '1차 매입 2,938억에 중소형사 다수가 참여했다.',
            sourceRefs: [S.prog1124, S.fsc2023],
          },
          consequences: '프로그램 매각이 체결되었습니다. 현금이 늘고 신용위험액이 줄었습니다.',
          historical: true,
        },
        {
          id: 't7-d2-b',
          label: '보유 ABCP 500억만 매각, 나머지는 만기 보유',
          description: '손실을 최소화하며 일부만 판다.',
          requires: { flag: 'pf_programme_open' },
          unavailableReason: '프로그램이 아직 가동되지 않았습니다.',
          effects: [
            securitiesFx.sellHeldAbcp({ amount: 500, priceDiscount: 0.03, riskWeight: 0.32 }),
            flag('programme_used'),
          ],
          expert: {
            rating: 55,
            rationale: '절충안. 연말 결산 지표가 안전권이라면 정당화된다.',
            sourceRefs: [S.prog1124],
          },
          consequences: '500억이 체결되었습니다.',
        },
        {
          id: 't7-d2-c',
          label: '프로그램 미참여 — 할인 손실 회피, 2023년 만기까지 보유',
          description: '보유 ABCP를 만기까지 들고 간다. 손실은 없지만 현금·NCR 개선도 없다.',
          effects: [],
          expert: {
            rating: 30,
            rationale:
              '위험값 32% 특례는 2023.6.30까지다. 사업장이 2023년에 부실화되면 3%가 아니라 30%를 잃는다(2024 태영 사례).',
            sourceRefs: [S.ncr32, S.fsc2023],
          },
          consequences: '참여하지 않았습니다.',
        },
        {
          id: 't7-d2-d',
          label: '1,500억 매각 후 대금으로 콜 500억·CP 500억 상환 (디레버리징)',
          description: '프로그램 대금으로 단기 조달을 줄여 유동성비율 분모를 낮춘다.',
          requires: { flag: 'pf_programme_open' },
          unavailableReason: '프로그램이 아직 가동되지 않았습니다.',
          effects: [
            securitiesFx.sellHeldAbcp({ amount: 1500, priceDiscount: 0.03, riskWeight: 0.32 }),
            securitiesFx.repay({ channel: 'call', amount: 500 }),
            securitiesFx.repay({ channel: 'cp', amount: 500 }),
            flag('programme_used'),
          ],
          expert: {
            rating: 72,
            rationale:
              '연말 유동성비율을 정면으로 개선하는 조합. 다만 현금 버퍼가 얇으면 A가 낫다.',
            sourceRefs: [S.prog1124, S.lr2027],
          },
          consequences: '매각 대금으로 콜과 CP를 상환했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't7-d2',
      text: '연말 결산까지 두 턴 남았습니다. NCR 150%·유동성비율 100%가 연착륙 기준입니다.',
    },
    {
      level: 3,
      decisionId: 't7-d2',
      text: '현금이 넉넉하면 D(매각+상환), 아니면 A(매각)입니다. C(미참여)는 특례 종료 후 위험을 남깁니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T8 — 2022-12-01~15 "정점과 결산"
// ---------------------------------------------------------------------------------------------
export const t8: T = {
  id: 't8',
  label: 'T8',
  timeLabel: '2022년 12월 1~15일',
  title: 'CP 정점과 연말 결산',
  time: '2022-12-01T09:00:00+09:00',
  entryEffects: [
    {
      id: 't8-market',
      description: 'CP91 5.54%(정점), CD91 4.03%, 스프레드 177bp, 국고3y 3.650%, 자사 CP 6.7%',
      effects: [
        op('market.custom.cp91', 'set', 554),
        op('market.custom.cd91', 'set', 403),
        op('market.fundingStressBp', 'set', 151),
        op('market.custom.creditSpreadAA', 'set', 177),
        op('market.creditSpreadIgBp', 'set', 177),
        op('market.custom.govt3y', 'set', 365),
        op('market.custom.corpAA3y', 'set', 542),
        op('market.custom.ownCpRate', 'set', 6.7),
        ownStockMove(0.03, '금리 정점 인식'),
      ],
    },
    {
      id: 't8-rollrate',
      description: '차환 성공률 70% — 프로그램 집행·강원도 상환 예정',
      effects: [legoFx.setRollRateWithAdj(0.7, '프로그램 집행, 강원도 12/15 상환 예정')],
    },
    {
      id: 't8-ci',
      description: '프로그램 집행 누적·강원도 상환 예정 → 신뢰지수 +5',
      effects: [confidence(5, '프로그램 집행·강원도 상환 예정')],
    },
    {
      id: 't8-mtm',
      description: '국고 금리 하락으로 채권 평가익 +50억',
      effects: [op('institution.equityCapital', 'add', 50, '채권 평가익')],
    },
    {
      id: 't8-cp',
      description: 'CP 만기(잔액 16%) 재발행',
      effects: [legoFx.cpRollStep({ share: 0.16 }), legoFx.callRollStep()],
    },
    { id: 't8-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't8-news-peak',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '12/1 15:40',
      headline: 'CP91 5.54% — 두 달 연속 상승 끝 정점 신호, 스프레드 177bp',
      body: 'CP 금리가 5.54%를 기록했다. 국고 3년은 3.72%로 내려와 기준금리(3.25%)와의 격차가 좁아졌다. 시장은 프로그램 집행이 누적되면서 CP 금리가 곧 꺾일 것으로 본다.',
      severity: 'warning',
      sourceRefs: [S.kofia],
    },
    {
      id: 't8-news-gangwon',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '12/15',
      headline: '강원도, 레고랜드 ABCP 2,050억 전액 상환',
      body: '강원도가 예고대로 보증채무를 갚았다. 그러나 78일 동안 단기금융시장이 치른 비용은 상환액과 비교할 수 없다.',
      severity: 'positive',
      sourceRefs: [S.gangwon],
    },
    {
      id: 't8-memo-yearend',
      kind: 'memo',
      time: '12/12',
      from: '리스크관리부장',
      to: 'CRO·CEO',
      subject: '연말 결산 전망 — NCR·유동성비율',
      body: `- NCR {{metric:ncr}}, 유동성비율 {{metric:liquidityRatio}}, 현금 {{metric:cash}}, 보유 ABCP {{metric:abcpHeld}}.
- 연말 기준 NCR 150% 이상·유동성비율 100% 이상이면 연착륙으로 평가됩니다.
- NCR 특례(위험값 32%)는 2023.6.30 종료 예정. 보유 ABCP 잔액이 크면 특례 종료 시 NCR이 다시 떨어집니다.
- 매입확약 잔액/자기자본 {{metric:guaranteeToEquity}}.`,
      severity: 'info',
      relatedMetrics: ['ncr', 'liquidityRatio', 'abcpHeld', 'guaranteeToEquity'],
    },
    {
      id: 't8-regulator-fss',
      kind: 'regulator',
      agency: '금융감독원',
      time: '12/14',
      headline:
        '[감독당국] 연말 기준 NCR·유동성비율 점검 및 2023년 PF 우발채무 관리 계획 제출 요청',
      body: '연말 결산 지표와 함께 2023년 만기 도래 PF 유동화증권의 차환·장기화 계획을 제출하십시오. 자기자본 대비 매입확약 잔액 관리 목표를 포함해야 합니다.',
      tone: 'routine',
      severity: 'info',
      sourceRefs: [S.fss],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 8,
      riskWeight: 0.32,
      prompt: '12/1~15 만기(300억 + 연장분) 중 차환 실패분(약 30%)을 어떻게 처리하시겠습니까?',
      context: '차환률이 70%로 회복되었습니다. 이번이 연말 전 마지막 만기입니다.',
      honour: {
        rating: 78,
        rationale: '이행. 규모가 작고 프로그램이 있다.',
        consequences: '차환 실패분을 자체매입했습니다.',
      },
      negotiate: {
        rating: 60,
        extendShare: 0.3,
        rationale: '연장할 이유가 줄었다. 수수료만 든다.',
        consequences: '일부 연장, 잔여분 자체매입.',
      },
      abandon: {
        rating: 5,
        rationale: '마지막 턴의 불이행은 아무것도 얻지 못한다.',
        consequences: 'SPC 부도 처리.',
        trapExplanation: '끝까지 왔는데 신용을 버릴 이유가 없다.',
      },
    }),
    {
      id: 't8-d2',
      title: '2023년 PF 계획',
      prompt: '2023년을 어떻게 준비하시겠습니까?',
      context: '특례는 6월 말에 끝나고, 2023년에도 만기는 계속됩니다.',
      requiredConcepts: ['pf-abcp-commitment-ncr'],
      dimensions: ['solvency', 'compliance', 'policy'],
      options: [
        {
          id: 't8-d2-a',
          label: '유동화증권 대출 전환 준비 + 매입확약 한도 자기자본 30%로 축소 계획 공시',
          description:
            '2023년 만기 도래 유동화증권을 대출로 전환해 차환 위험을 없애고, 익스포저 한도를 공시한다. 신뢰지수 +5.',
          effects: [confidence(5, '익스포저 축소 계획 공시'), flag('exposure_cap_announced')],
          expert: {
            rating: 80,
            rationale:
              '금융위는 2023.5.24 증권사 보증 유동화증권 4.9조의 대출 전환을 발표했다 — 이 옵션은 그것을 자발적으로 앞당기는 것이다. 2027년 유동성비율 개편(우발채무 유동부채 포함)은 이 익스포저를 규제 지표에 정식으로 넣는다.',
            sourceRefs: [S.fsc2023, S.lr2027],
          },
          consequences: '대출 전환 실무가 시작되었고 익스포저 한도가 공시되었습니다.',
        },
        {
          id: 't8-d2-b',
          label: '유동성 완화 확인 후 2023년 PF 영업 재개',
          description: 'CP 금리가 정점을 지났으니 수익성 회복을 위해 매입확약 영업을 재개한다.',
          effects: [
            legoFx.addCommitments({ amount: 300, atIndex: 1, reason: '2023 PF 영업 재개' }),
          ],
          expert: {
            rating: 20,
            rationale:
              '단기금리 정점과 PF 사업성은 별개다. 2023년 PF 부실은 본격화됐고 2024년 태영건설 워크아웃으로 이어졌다. 자본시장연구원(23-10)은 이 시점의 재확대를 경고했다.',
            sourceRefs: [S.kcmi23, S.fsc2023],
          },
          consequences: '신규 약정을 재개했습니다. 매입확약 잔액이 다시 늘었습니다.',
          trap: true,
          trapExplanation:
            '"유동성 위기가 끝났다"와 "PF 사업장이 안전해졌다"는 다른 명제다. 2022년은 차환 위기였고 2023~24년은 사업성 위기였다.',
        },
        {
          id: 't8-d2-c',
          label: '보유 ABCP 만기 보유·현상 유지',
          description: '추가 조치 없이 특례 기간 동안 만기를 기다린다.',
          effects: [],
          expert: {
            rating: 45,
            rationale:
              '대부분의 증권사가 실제로 택한 경로. 결국 2023년 5월 당국이 대출 전환을 요구했다.',
            historicalNote: '2023.5 금융위 대책 전까지 업계의 자발적 장기화는 제한적이었다.',
            sourceRefs: [S.fsc2023],
          },
          consequences: '현상을 유지합니다.',
          historical: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't8-d2',
      text: '2022년의 위기는 차환 위기였습니다. 2023년의 위기는 사업성 위기가 될 수 있습니다.',
    },
  ],
}

export const turnsB: T[] = [t5, t6, t7, t8]
