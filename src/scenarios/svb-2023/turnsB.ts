import type { BankState, Interrupt, Turn } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import {
  confidence,
  counter,
  flag,
  fnEffect,
  op,
  ownStockMove,
  regulator,
} from '../../engine/fx/common'
import { commitReplies } from '../../engine/core/dialogue'
import { clamp } from '../../engine/core/paths'

type T = Turn<BankState>

/**
 * Re-decides whether an acquirer stays at the table once the negotiation ends. `overnightSale`
 * (t5-b) already ran the baseline test on liquidity days and economic TCE; what the player promised
 * in the conversation then moves it. Holding out for book value closes the only weekend window;
 * a deep discount, or the supervisor in the room opening loss-sharing, keeps a buyer.
 * Flags only — never cash — so the T5 closing-balance checkpoint is untouched by construction.
 */
function settleBuyer(joint: boolean) {
  return fnEffect<BankState>('settleBuyer', { joint }, (d, ctx) => {
    const haircut = d.counters.saleHaircutPct ?? 0
    let exists = d.flags.buyer_exists === true
    if (haircut <= 10) exists = false
    else if (haircut >= 40 || joint) exists = true
    d.flags.buyer_exists = exists
    if (exists) d.flagTurns.buyer_exists ??= d.turnIndex
    ctx.log(
      `인수 후보 ${exists ? '유지' : '이탈'} (할인 ${haircut}%, 감독당국 동석 ${joint ? '있음' : '없음'})`,
    )
  })
}

const S = {
  fed: 'fed-svb-review-2023',
  gao: 'gao-23-106736',
  dfpi: 'dfpi-order-2023-03-10',
  fdic16: 'fdic-pr-16-2023',
  fdic17: 'fdic-pr-17-2023',
  fdic19: 'fdic-pr-19-2023',
  btfp: 'fed-btfp-2023-03-12',
  bcbs: 'bcbs-d555',
  sig: 'fdic-oig-signature-2023',
  frc: 'fdic-pr-34-2023',
  frcDeposit: 'treasury-jy1349',
  deloitte: 'deloitte-fra-23-2',
  fsb: 'fsb-depositor-2024',
  fred: 'fred-dgs2',
  pacw10q: 'pacwest-10q-2023q1',
  pacw8k: 'pacwest-8k-2023-03-22',
}

// ---------------------------------------------------------------------------------------------
// T5 — 2023-03-09 (목) 17:00 PT "마감"  (3틱: 17:00 / 20:00 / 23:00)
// ---------------------------------------------------------------------------------------------

/**
 * 기존 `t5-call-frbsf` 통화 이벤트를 인터럽트로 재배치한 것이다(재작성이 아니라 이관).
 * 감독관 대사는 원 이벤트에서 그대로 가져왔고, CRO의 응답 대사("담보 목록과 FHLB 리엔 해제
 * 요청서를 지금 보내겠습니다")는 옵션 A의 결과 문장으로 옮겼다. **재구성된 대사**이며 통화
 * 녹취가 아니다(calibration.md §7).
 */
const t5FrbsfCall: Interrupt<BankState> = {
  id: 't5-i1-frbsf',
  interrupt: true,
  atTick: 0,
  when: { flag: 'regulator_engaged' },
  timeoutSec: 45,
  defaultOptionId: 't5-i1-send-now',
  scoreWeight: 0.5,
  required: false,
  title: 'FRB 샌프란시스코 감독관 통화',
  prompt: '야간 담보 이동이 허용되었습니다. 담보 목록과 리엔 해제 요청서를 언제 보내겠습니까?',
  context:
    '야간 창구 대출은 담보 목록이 접수되어야 준비가 시작됩니다. 개장까지 남은 시간이 그대로 여력이 됩니다.',
  source: {
    kind: 'regulator',
    caller: 'FRB 샌프란시스코 감독관',
    agency: 'Federal Reserve Bank of San Francisco',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '감독관',
      text: '오늘 낮에 말씀하신 대로 야간 담보 이동을 허용하겠습니다. 이동 가능한 담보 범위 내에서 창구 대출을 준비하십시오. 단, 내일 아침 대기열이 여력을 넘으면 우리도 선택지가 없습니다.',
    },
  ],
  dimensions: ['compliance', 'timeliness'],
  options: [
    {
      id: 't5-i1-send-now',
      label: '담보 목록과 리엔 해제 요청서를 지금 전송',
      description:
        '리엔 해제와 담보 이관은 순차 처리다. 지금 접수되어야 야간에 실제로 움직일 수 있다.',
      effects: [flag('collateral_list_sent'), counter('overnightPrepStarted', 1)],
      expert: {
        rating: 85,
        rationale:
          '3월 9일 밤의 제약은 의지가 아니라 처리 시간이었다. SVB는 담보 이동을 마감 전에 완료하지 못했고, 연준 검토와 GAO 보고서 모두 야간 이동에 필요한 준비 시간이 부족했다는 점을 실패 요인으로 기록한다. 채널이 열려 있을 때 즉시 접수시키는 것 외의 선택지는 없다.',
        sourceRefs: [S.fed, S.gao],
      },
      preview: [
        {
          metric: 'facilityPending',
          direction: 'flat',
          magnitude: 1,
          note: '준비된 익일 여력이 그대로 살아난다',
        },
      ],
      consequences:
        '"담보 목록과 FHLB 리엔 해제 요청서를 지금 보내겠습니다." 목록이 접수되어 야간 처리 대기열에 올랐습니다.',
      historical: true,
    },
    {
      id: 't5-i1-wait-morning',
      label: '내일 아침 정리해서 전송',
      description: '야간에 목록을 다듬어 개장 전에 한 번에 보낸다.',
      effects: [flag('collateral_list_delayed')],
      delayedEffects: [
        {
          afterTurns: 1,
          when: { flag: 'collateral_list_delayed' },
          description: '개장 전 접수로는 리엔 해제·담보 이관이 절반만 완료됨 → 익일 반영 여력 ×0.6',
          effects: [op('institution.wholesale.cbFacilityPending', 'mul', 0.6, '야간 이관 미완')],
        },
      ],
      expert: {
        rating: 15,
        rationale:
          '야간 채널은 한 번 열리면 닫힌다. 아침에 보내면 리엔 해제와 담보 이관이 개장 대기열보다 늦고, 준비된 여력은 쓸 수 없는 여력이 된다(3월 10일 아침 cash letter 미결제의 직접 원인).',
        sourceRefs: [S.fed, S.dfpi],
      },
      preview: [
        { metric: 'facilityPending', direction: 'down', magnitude: 2, note: '익일 반영 여력 ×0.6' },
      ],
      consequences:
        '목록 전송을 아침으로 미뤘습니다. 감독관은 "그러면 준비할 시간이 없습니다"라고 답했습니다.',
      trap: true,
      trapExplanation:
        '서류를 "제대로" 정리하려는 본능이 야간 처리 시간을 통째로 소모한다. 위기 야간의 담보 이관은 완결성보다 접수 시각이 가치를 결정한다.',
    },
  ],
}

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2023년 3월 9일 (목) 17:00 PT',
  title: '마감',
  time: '2023-03-09T17:00:00-08:00',
  ticks: 3,
  tickLabels: ['17:00', '20:00', '23:00'],
  interrupts: [t5FrbsfCall],
  entryEffects: [
    {
      id: 't5-close-flag',
      description: '목요일 영업 마감 — 연준 cash letter 결제',
      effects: [flag('thursday_closed')],
    },
  ],
  events: [
    {
      id: 't5-memo-close',
      kind: 'memo',
      time: '17:05',
      from: '결제팀',
      to: 'CRO/Treasurer · CFO · CEO',
      subject: '마감 결제 결과',
      body: `- 당일 누적 예금 순유출: {{metric:dailyOutflow}} (예금의 {{metric:dailyOutflowPct}}).
- 마감 시 현금·연준 계좌 잔고: **{{metric:cash}}**.
- 잔고가 음수이면 연준 cash letter가 결제되지 않으며, 감독당국은 익일 개장 전 조치를 검토합니다.
- 담보차입 여력: 당일 {{metric:facilityHeadroom}}, 익일 반영 예정 {{metric:facilityPending}}.`,
      severity: 'critical',
      sourceRefs: [S.dfpi],
      relatedMetrics: ['cash', 'dailyOutflow', 'facilityPending'],
    },
    {
      id: 't5-call-dfpi-cold',
      kind: 'call',
      when: { notFlag: 'regulator_engaged' },
      time: '17:40',
      caller: 'DFPI 감독관',
      callee: 'CEO',
      agency: 'California DFPI',
      tone: 'urgent',
      lines: [
        {
          speaker: '감독관',
          text: '연준 결제 데이터를 보고 연락드립니다. 오늘 아침에 왜 연락이 없었습니까? 내일 개장 전에 유동성 계획을 제출하십시오. 야간 지원은 이 시점에서 준비되어 있지 않습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.dfpi],
    },
    {
      id: 't5-news-raise-fail',
      kind: 'newswire',
      when: { flag: 'raise_failed' },
      outlet: 'CNBC',
      atTick: 1,
      time: '18:20',
      headline: '퍼시픽밸리은행 증자 무산 임박 — 매각 대안 모색 보도',
      body: '복수의 소식통에 따르면 북빌딩이 목표에 크게 못 미쳤으며, 은행이 밤사이 인수자를 찾고 있다.',
      severity: 'critical',
      sourceRefs: [S.fed],
    },
    {
      id: 't5-board',
      kind: 'board',
      atTick: 1,
      time: '19:00',
      headline: '긴급 이사회 소집',
      body: '이사회는 (1) 야간 유동성 조달 가능성, (2) 매각 절차, (3) 감독당국과의 협의 상태를 보고받고 경영진에 결정 권한을 위임했습니다. "내일 아침 문을 열 수 있는가"가 유일한 안건입니다.',
      severity: 'critical',
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '야간 조치',
      prompt: '오늘 밤 무엇을 하시겠습니까? (최대 2개)',
      context:
        '내일 아침 개장 전까지 현금 잔고가 양수가 되어야 합니다. 금요일 대기열은 오늘보다 훨씬 클 것으로 예상됩니다.',
      select: { min: 1, max: 2 },
      // 감독관 통화(틱 0)가 먼저 오고, 야간 조치는 그 뒤에 결정한다. 개장 전(틱 1)까지가 시한이며
      // T5에는 유출 창구가 없어 마감 틱이 잔고 보정에 영향을 주지 않는다.
      availableFrom: 1,
      deadlineTick: 1,
      defaultOptionId: 't5-b',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['liquidity', 'compliance', 'timeliness'],
      options: [
        {
          id: 't5-a',
          label:
            'FRB SF에 야간 이동 가능 담보 대비 긴급 재할인창구 대출 요청, FHLB에 담보 해제 요청, 일중 초과인출 허용 요청',
          description:
            '야간에 이동 가능한 담보(진행 중인 이전 포함)를 모두 창구 대출로 전환한다. 사전 접촉이 없으면 채널이 없다.',
          requires: { flag: 'regulator_engaged' },
          unavailableReason:
            '감독당국과 사전 접촉이 없어 야간 지원을 요청할 채널이 없습니다 (T4에서 선제 보고하지 않음).',
          effects: [
            fnEffect<BankState>('overnightFacility', {}, (d, ctx) => {
              const b = d.institution
              const moved = b.wholesale.cbFacilityPending + b.wholesale.cbFacilityCapacity
              b.wholesale.cbAdvances += moved
              b.cash += moved
              b.wholesale.cbFacilityPending = 0
              b.wholesale.cbFacilityCapacity = 0
              d.counters.fundingDrawn = (d.counters.fundingDrawn ?? 0) + moved
              ctx.log(`야간 창구 대출 ${moved.toFixed(1)} 실행 → 현금 ${b.cash.toFixed(1)}`)
            }),
            regulator({ add: 1 }, '야간 긴급 지원'),
          ],
          expert: {
            rating: 80,
            rationale:
              '실질적 여력을 가진 유일한 야간 레버. 결과는 이전 담보 조치(T0.B, T3.B)에 결정론적으로 좌우된다.',
            sourceRefs: [S.fed],
          },
          consequences: '야간 담보 이동과 창구 대출이 실행되었습니다. 현금 잔고를 확인하세요.',
        },
        {
          id: 't5-b',
          label: '증자 포기, 대형 은행 매각을 야간에 타진',
          description:
            '인수자는 실사 시간이 필요하다. 유동성 일수 2일 이상, 유형자기자본 3% 이상이어야 관심을 보인다.',
          effects: [
            flag('sale_process'),
            fnEffect<BankState>('overnightSale', {}, (d, ctx) => {
              const snap = d.metricsHistory[d.metricsHistory.length - 1]
              const days = snap?.metrics.survivalDays?.value ?? 0
              const tce = snap?.metrics.economicTce?.value ?? -99
              if (days >= 2 && tce > 3) {
                d.flags.buyer_exists = true
                d.flagTurns.buyer_exists ??= d.turnIndex
                ctx.log('인수 후보가 주말 실사에 동의')
              } else
                ctx.log(`인수 후보 없음 (유동성 일수 ${days.toFixed(1)}, TCE ${tce.toFixed(1)}%)`)
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '매각 추진이 공개됨 → 신뢰지수 −20',
              effects: [confidence(-20, '매각 추진 공개')],
            },
          ],
          expert: {
            rating: 50,
            rationale:
              'SVB는 3월 10일 아침 매각을 추진했지만 매수자는 런이 허용한 시간보다 더 긴 시간을 요구했다. 정직하지만 늦은 선택.',
            historicalNote: 'SVB의 실제 야간 대응.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences: '투자은행이 인수 후보에 연락했습니다.',
          historical: true,
        },
        {
          id: 't5-c',
          label:
            '자발적 관리 절차 동의 (목요일 밤, WaMu 방식) — FDIC가 주말 동안 질서 있게 정리하도록 허용',
          description:
            '내일 아침 부분 지급 사태를 피하고 FDIC에 정리 시간을 준다. 은행은 문을 닫는다.',
          effects: [flag('orderly_failure')],
          expert: {
            rating: 40,
            rationale:
              'GAO는 금요일 정오 폐쇄가 전례 없고 무질서했다고 평가한다. 생존 가능성이 없다면 목요일 밤 폐쇄가 "최선의 실패"다.',
            sourceRefs: [S.gao, S.fdic16],
          },
          consequences: '이사회가 관리 절차에 동의했습니다. FDIC가 주말 정리에 착수합니다.',
          irreversible: true,
        },
        {
          id: 't5-d',
          label: 'HTM을 골드만에 추가 할인 매각해 적자 보전',
          description: '야간 블록 매각. 할인은 더 크고 tainting은 그대로다.',
          effects: [
            bankFx.sellSecurities({
              book: 'htm',
              amount: 20,
              fireSaleRef: 8,
              label: 'HTM 야간 매각',
            }),
          ],
          expert: {
            rating: 5,
            rationale: 'T3.C와 같은 함정을 더 나쁜 가격에 반복한다.',
            sourceRefs: [S.deloitte],
          },
          consequences: 'HTM 블록이 대폭 할인되어 체결되었습니다. 전체 HTM이 재분류됩니다.',
          trap: true,
          trapExplanation: '야간의 절박함이 낮의 실수를 더 비싸게 반복하게 만든다.',
          irreversible: true,
        },
        {
          id: 't5-e',
          label: '"침착" 서한 발송 + GA $500M만 집행',
          description: '확정된 앵커 투자만 받고 안심 서한을 보낸다.',
          effects: [
            op('institution.cash', 'add', 0.5, 'GA 집행'),
            op('institution.capital.cet1', 'add', 0.5, 'GA 집행'),
            confidence(-5, '수치 없는 서한'),
          ],
          expert: {
            rating: 15,
            rationale: '$100B 대기열 앞에서 $0.5B는 무의미하다.',
            sourceRefs: [S.fed],
          },
          consequences: 'GA 자금이 입금되었습니다. 서한에 대한 반응은 냉담합니다.',
        },
      ],
    },
    {
      // 매각을 타진했을 때만 열리는 협상. `t5-d1`은 최대 2개 선택이라 대화를 직접 붙일 수 없어
      // 별도 결정으로 분리했다. 현금에는 손대지 않고 인수자 성립 여부(flag)만 움직이므로
      // T5 마감 잔고 체크포인트(−$958M)에 영향이 없다.
      // 대사는 기록에 근거한 재구성이며 실제 협상록이 아니다(calibration.md §7.6).
      id: 't5-d2',
      title: '인수 협상',
      prompt: '투자은행이 인수 후보를 연결했습니다. 어떻게 협상하시겠습니까?',
      context:
        '인수자는 주말 안에 실사를 끝내야 합니다. 실사 자료를 얼마나 여는지, 장부를 얼마나 깎아 내놓는지가 후보의 참여 여부를 가릅니다.',
      when: { chose: { decision: 't5-d1', option: 't5-b' } },
      required: false,
      select: { min: 1, max: 1 },
      // `t5-d1`을 답한 뒤(틱 1)에야 열리고, T5에는 유출 창구가 없어 마감 틱을 둘 이유가 없다.
      // 마지막 틱에 마감을 두면 스윕이 그 다음 틱에 돌지 않아 자동 확정이 일어나지 않는다.
      availableFrom: 1,
      defaultOptionId: 't5-d2-b',
      dimensions: ['solvency', 'communication', 'timeliness'],
      steps: [
        {
          id: 't5-d2-dataroom',
          lines: [
            {
              speaker: '인수 후보 CFO',
              text: '주말 안에 끝내야 합니다. 대출 포트폴리오 원장과 증권 북 전체를 지금 볼 수 있습니까?',
            },
          ],
          note: '실사 자료의 범위가 인수 후보의 참여 여부를 먼저 결정합니다.',
          replies: [
            {
              id: 't5-d2-r-open',
              label: '데이터룸을 지금 전면 개방',
              effects: [flag('dataroom_open')],
              next: 't5-d2-haircut',
              expert: {
                rating: 80,
                rationale: '주말이 유일한 창이다. 자료 제한은 실사 시간을 늘려 창을 닫는다.',
              },
            },
            {
              id: 't5-d2-r-summary',
              label: '요약 자료만 제공하고 원장은 내일 아침에',
              next: 't5-d2-haircut',
              expert: {
                rating: 35,
                rationale: '하루를 미루면 후보가 요구하는 실사 시간이 런이 허용한 시간을 넘는다.',
              },
            },
            {
              id: 't5-d2-r-stop',
              label: '조건이 맞지 않는다고 보고 협상을 중단',
              resolvesTo: 't5-d2-c',
              expert: { rating: 20, rationale: '대안 없이 유일한 출구를 스스로 닫는다.' },
            },
          ],
        },
        {
          id: 't5-d2-haircut',
          lines: [
            {
              speaker: '인수 후보 CFO',
              text: '장부가로는 못 삽니다. 증권·대출 북에 얼마를 깎아 주실 수 있습니까?',
            },
          ],
          note: '여기서 부른 할인율이 후보의 참여 여부를 가릅니다. 깎을수록 팔리지만, 남는 것이 줄어듭니다.',
          replies: commitReplies<BankState>('saleHaircutPct', [10, 25, 40], {
            idPrefix: 't5-d2-haircut',
            label: (v) =>
              v <= 10
                ? '10% — 장부가에 가깝게 고수'
                : v <= 25
                  ? '25% — 시장가 수준을 수용'
                  : '40% — 주말 종결을 위해 대폭 양보',
            next: 't5-d2-supervisor',
            expert: (v) => ({
              rating: v <= 10 ? 25 : v <= 25 ? 70 : 55,
              rationale:
                v <= 10
                  ? '런 중인 은행의 장부가를 인정할 인수자는 없다. 후보가 이탈한다.'
                  : v <= 25
                    ? '시장가 수용은 후보를 붙잡되 주주 가치를 지나치게 버리지 않는다.'
                    : '팔리기는 하지만 잔여 자본이 깎여 나간다. 대안이 없을 때만 정당화된다.',
            }),
            trap: (v) => v <= 10,
            trapExplanation: (v) =>
              v <= 10
                ? '장부가 고수는 협상력을 지키는 것처럼 보이지만, 인수자에게는 매도 의사가 없다는 신호다. 주말이라는 유일한 창을 닫는다.'
                : undefined,
          }),
        },
        {
          id: 't5-d2-supervisor',
          lines: [
            {
              speaker: '인수 후보 CFO',
              text: '감독당국이 이 자리에 함께 있습니까? 손실분담 없이는 이사회를 설득할 수 없습니다.',
            },
          ],
          replies: [
            {
              id: 't5-d2-r-joint',
              label: 'FRB SF·FDIC 동석을 요청',
              // T4에서 선제 보고하지 않았다면 이 자리를 만들 채널 자체가 없다 — 응답을 숨긴다.
              when: { flag: 'regulator_engaged' },
              resolvesTo: 't5-d2-a',
              expert: {
                rating: 85,
                rationale:
                  '주말 매각은 감독당국이 손실분담 구조를 열어 줄 때만 성립한다. 사전 접촉이 없으면 이 자리를 만들 수 없다.',
              },
            },
            {
              id: 't5-d2-r-alone',
              label: '단독으로 진행',
              resolvesTo: 't5-d2-b',
              expert: { rating: 40, rationale: '순수 민간 거래는 실사 시간과 가격 모두에서 불리하다.' },
            },
          ],
        },
      ],
      options: [
        {
          id: 't5-d2-a',
          label: '감독당국 동석 하에 협상',
          description: '손실분담 구조를 전제로 후보와 협상한다. 사전 접촉이 있어야 자리가 열린다.',
          requires: { flag: 'regulator_engaged' },
          unavailableReason: '감독당국과 사전 접촉이 없어 동석을 요청할 채널이 없습니다 (T4).',
          effects: [flag('sale_joint'), settleBuyer(true)],
          expert: {
            rating: 85,
            rationale:
              '2023년 3월의 실제 해법도 감독당국이 손실분담을 연 뒤에야 성립했다(퍼스트시티즌스). 야간에 그 자리를 만드는 것이 최선의 경로다.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences: '감독당국이 동석했습니다. 후보가 주말 실사에 착수합니다.',
        },
        {
          id: 't5-d2-b',
          label: '단독으로 협상 진행',
          description: '민간 거래로만 진행한다. 후보는 더 긴 실사 시간과 더 큰 할인을 요구한다.',
          effects: [settleBuyer(false)],
          expert: {
            rating: 40,
            rationale:
              'SVB의 실제 경로. 후보는 런이 허용한 시간보다 긴 실사를 요구했고 주말 안에 합의에 이르지 못했다.',
            historicalNote: '3월 10일 아침까지 인수 합의에 도달하지 못했다.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences: '후보와 단독으로 협상 중입니다. 실사 일정에 대한 답이 오지 않았습니다.',
          historical: true,
        },
        {
          id: 't5-d2-c',
          label: '협상 중단',
          description: '조건이 맞지 않는다고 보고 자리를 정리한다.',
          effects: [
            fnEffect<BankState>('saleAbandoned', {}, (d, ctx) => {
              d.flags.buyer_exists = false
              ctx.log('매각 협상 중단 — 인수 후보 없음')
            }),
          ],
          expert: {
            rating: 20,
            rationale: '증자도 매각도 없으면 남는 경로는 정리뿐이다.',
            sourceRefs: [S.gao],
          },
          consequences: '협상을 중단했습니다.',
          irreversible: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '현금 잔고가 음수입니까? 그렇다면 내일 개장 전에 양수로 만들 수 있는 조치는 A뿐입니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '정리 실무: 목요일 밤 자발적 관리 동의는 부분점수를 받는 "질서 있는 실패"입니다. 금요일 정오 폐쇄는 무질서한 실패입니다.',
    },
    {
      level: 3,
      decisionId: 't5-d1',
      text: 'A가 열려 있다면 A. 닫혀 있고 잔고가 음수라면 C(질서 있는 실패)가 D·E보다 낫습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2023-03-10 (금) 05:00 PT "장전"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2023년 3월 10일 (금) 05:00 PT',
  title: '장전: 대기열',
  time: '2023-03-10T05:00:00-08:00',
  entryEffects: [
    {
      id: 't6-settle',
      description: '야간 담보 이전분 반영',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't6-open-flag',
      description: '금요일 개장 전 점검 — 마감 잔고가 음수이면 감독당국이 개장을 허용하지 않음',
      effects: [flag('friday_open')],
    },
    {
      id: 't6-sector-stress',
      description: '시그니처·퍼스트리퍼블릭 인출 보도로 지역은행 전반 불안 → 신뢰지수 −5',
      effects: [confidence(-5, '지역은행 전반 불안(외생)')],
    },
  ],
  events: [
    {
      id: 't6-data-queue',
      kind: 'data',
      time: '05:00',
      title: '개장 전 송금 대기열',
      rows: [
        { label: '대기 중인 송금 요청(추정)', value: '{{metric:projectedDailyOutflow}}' },
        { label: '현금·연준 잔고', value: '{{metric:cash}}' },
        { label: '담보차입 여력(당일)', value: '{{metric:facilityHeadroom}}' },
        { label: '생존 일수', value: '{{metric:survivalDays}}' },
      ],
      severity: 'critical',
      sourceRefs: [S.fed],
    },
    {
      id: 't6-news-halt',
      kind: 'newswire',
      outlet: 'Nasdaq',
      time: '05:45',
      headline: '퍼시픽밸리은행 주식 프리마켓 거래정지 — "추가 정보 대기"',
      body: '거래소는 중요 정보 공시를 이유로 거래를 정지했다.',
      severity: 'critical',
    },
    {
      id: 't6-memo-onsite',
      kind: 'memo',
      time: '06:00',
      from: '법무실장',
      to: '경영진',
      subject: 'DFPI·FDIC 현장 도착',
      body: 'DFPI 검사역과 FDIC 정리팀이 본점에 도착했습니다. 개장 허용 여부는 오늘 아침 유동성 상태에 따라 결정된다고 합니다.',
      severity: 'critical',
      sourceRefs: [S.dfpi, S.fdic16],
    },
    {
      id: 't6-news-signature',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '06:30',
      headline: '뉴욕 시그니처은행도 예금 이탈 — 수 시간 만에 $18.6B',
      body: '암호화폐·부동산 예금 비중이 높은 시그니처은행에서 대규모 인출이 보고되고 있다. 퍼스트리퍼블릭도 인출 압력을 받고 있다.',
      severity: 'critical',
      sourceRefs: [S.sig],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '금요일 개장',
      prompt: '어떻게 개장하시겠습니까?',
      context:
        '개장하면 대기열이 오늘 하루 동안 결제됩니다. 현금과 여력이 대기열에 미치지 못하면 하루가 끝나기 전에 폐쇄됩니다.',
      dimensions: ['liquidity', 'compliance', 'communication'],
      timeLimitSec: 90,
      defaultOptionId: 't6-a',
      options: [
        {
          id: 't6-a',
          label: '증자 중단·매각 모색 발표, 정상 개장, 현금 한도 내 송금 처리',
          description: '개장은 하지만 대기열을 다 처리할 수 없다면 낮에 폐쇄된다.',
          effects: [flag('friday_normal_open')],
          expert: {
            rating: 30,
            rationale: 'SVB의 실제 3월 10일 아침. 남은 선택 여지가 거의 없었다.',
            historicalNote: 'DFPI가 오전 중 은행을 인수하고 FDIC를 관재인으로 지정했다.',
            sourceRefs: [S.dfpi, S.fdic16],
          },
          consequences: '개장했습니다. 대기열이 결제되기 시작합니다.',
          historical: true,
        },
        {
          id: 't6-b',
          label: '개장 전 자진 폐쇄 요청 (부분 지급 사태 회피)',
          description: '무질서한 부분 지급 대신 감독당국에 폐쇄와 정리를 요청한다.',
          effects: [flag('orderly_failure')],
          expert: {
            rating: 45,
            rationale:
              '대기열을 처리할 수 없다면 부분 지급의 하루를 피하는 것이 예금자와 정리 절차 모두에 낫다(GAO).',
            sourceRefs: [S.gao],
          },
          consequences: '감독당국에 폐쇄를 요청했습니다.',
          irreversible: true,
        },
        {
          id: 't6-c',
          label: '개장하고 전량 처리 — 처리 완료를 공개',
          description: '현금과 여력이 대기열을 감당할 때만 가능하다. 성공하면 런이 꺾인다.',
          requires: { metric: 'survivalDays', gte: 1 },
          unavailableReason: '현금과 당일 담보차입 여력이 예상 대기열에 미치지 못합니다.',
          effects: [
            fnEffect<BankState>('processAll', {}, (d, ctx) => {
              const b = d.institution
              // draw what is needed from same-day capacity so wires clear
              const snap = d.metricsHistory[d.metricsHistory.length - 1]
              const queue = snap?.metrics.projectedDailyOutflow?.value ?? 0
              const need = Math.max(0, queue - b.cash)
              const drawn = Math.min(need, b.wholesale.cbFacilityCapacity)
              b.wholesale.cbFacilityCapacity -= drawn
              b.wholesale.cbAdvances += drawn
              b.cash += drawn
              d.counters.dampener = (d.counters.dampener || 1) * 0.7
              d.confidence.index = clamp(d.confidence.index + 15, 0, 100)
              d.flags.processed_all = true
              d.flagTurns.processed_all ??= d.turnIndex
              ctx.log(`전량 처리 준비: 담보차입 ${drawn.toFixed(1)} 선인출, 완화 ×0.7, ΔCI +15`)
            }),
          ],
          expert: {
            rating: 90,
            rationale:
              '준비된 은행만 도달할 수 있는 경로. 모든 송금이 정시에 나가면 런의 전제("돈을 못 받을 수 있다")가 무너진다.',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences: '전량 처리 방침이 공표되었습니다. 창구가 열립니다.',
        },
        {
          id: 't6-d',
          label: '일정 금액 이상 송금 "일시 보류"',
          description: '대형 송금을 보류해 시간을 번다.',
          effects: [regulator({ set: 4 }, '인출 보류(불건전 행위)'), flag('unsafe_act')],
          expert: {
            rating: 0,
            rationale: '즉시 폐쇄 사유.',
            sourceRefs: [S.dfpi],
          },
          consequences: '송금 보류가 감지되었습니다.',
          trap: true,
          trapExplanation: 'T4.D와 같은 함정. 은행은 인출을 거부하는 순간 은행이 아니다.',
          illegal: true,
          irreversible: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '"생존 일수"가 1 이상이면 전량 처리(C)가 열립니다. 그렇지 않다면 B가 A보다 낫습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2023-03-11~12 (토·일) "주말"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2023년 3월 11~12일 (토·일)',
  title: '주말',
  time: '2023-03-12T18:15:00-05:00',
  entryEffects: [
    {
      id: 't7-friday-runoff',
      description: '금요일 하루 대기열 결제',
      effects: [bankFx.runoffStep({ windowFraction: 1, label: '금요일 유출' })],
    },
    {
      id: 't7-friday-closed',
      description: '금요일 마감',
      effects: [flag('friday_closed')],
    },
  ],
  events: [
    {
      id: 't7-news-sre',
      kind: 'newswire',
      outlet: 'Federal Reserve / Treasury / FDIC',
      time: '일 18:15 ET',
      headline:
        '재무부·연준·FDIC 공동성명: 시스템리스크 예외 발동 — 폐쇄 은행 전 예금 보호, BTFP 신설',
      body: '이번 주 문을 닫은 은행들의 예금을 전액 보호하는 시스템리스크 예외가 발동되었다. 연준은 은행에 국채·기관채·MBS를 **액면가**로 담보로 받아 최장 1년간 대출하는 Bank Term Funding Program(BTFP)을 발표했다. 금리는 1년 OIS+10bp 고정, 수수료 없음, 조기상환 가능. 재무부는 ESF에서 $25B를 백스톱으로 제공한다. 시그니처은행은 일요일 뉴욕주 감독당국에 의해 폐쇄되었다.',
      severity: 'positive',
      sourceRefs: [S.fdic17, S.btfp],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 't7-memo-btfp',
      kind: 'memo',
      time: '일 20:00 ET',
      from: '자금부장',
      to: 'CRO/Treasurer',
      subject: 'BTFP 활용 검토',
      body: `- 적격 담보: UST, 기관채, 기관 MBS(3/12 기준 보유분). 지방채·회사채 제외.
- **액면가 평가** → HTM $15B 미실현손실이 담보 여력을 깎지 않음.
- 우리 HTM 장부가 {{metric:cbAdvances}} 외 잔여분 대부분이 적격. 월요일 아침부터 신청 가능.
- 대안: 재할인창구(시가−마진, 90일).`,
      severity: 'positive',
      sourceRefs: [S.btfp],
    },
    {
      id: 't7-call-fed',
      kind: 'call',
      time: '일 21:00 ET',
      caller: 'FRB SF 부총재',
      callee: 'CEO',
      agency: 'Federal Reserve Bank of San Francisco',
      tone: 'concerned',
      lines: [
        {
          speaker: '부총재',
          text: '월요일이 고비입니다. 귀행은 이번 조치의 직접 대상이 아니므로 시장은 귀행이 "다음"인지 시험할 겁니다. 필요한 유동성을 오늘 밤 확정하십시오.',
        },
      ],
      severity: 'warning',
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '주말 준비',
      prompt: '월요일 개장 전에 무엇을 준비하시겠습니까? (최대 2개)',
      select: { min: 1, max: 2 },
      requiredConcepts: ['discount-window-fhlb-btfp'],
      dimensions: ['liquidity', 'communication', 'timeliness'],
      options: [
        {
          id: 't7-a',
          label: 'BTFP 차입 준비: UST·기관채·기관 MBS를 액면가로 담보 설정',
          description:
            '액면 평가로 HTM 미실현손실이 차입 여력을 깎지 않는다. 월요일부터 실행 가능.',
          effects: [
            fnEffect<BankState>('btfpPrepare', {}, (d, ctx) => {
              const b = d.institution
              const eligiblePar = b.securities.htm.bookValue + b.securities.afs.bookValue
              const add = Math.max(0, eligiblePar * 0.9 - b.wholesale.cbFacilityCapacity)
              b.wholesale.cbFacilityCapacity += add
              d.flags.btfp_ready = true
              d.flagTurns.btfp_ready ??= d.turnIndex
              ctx.log(`BTFP 담보 설정(액면): 여력 +${add.toFixed(1)}`)
            }),
          ],
          expert: {
            rating: 95,
            rationale:
              '액면 평가가 $15B 미실현손실을 차입 여력으로 바꾼다 — 결정적 창구. 2023년 3월의 정책 대응 설계 핵심.',
            sourceRefs: [S.btfp, S.bcbs],
          },
          consequences: 'BTFP 담보 설정이 완료되었습니다. 월요일 아침 차입 가능합니다.',
        },
        {
          id: 't7-b',
          label: '연준 확인 하에 총 가용 유동성(무보험예금 대비 100% 초과) 공표',
          description: '이제는 사실이고 검증 가능하다.',
          effects: [
            fnEffect<BankState>('discloseVerifiedLiquidity', {}, (d, ctx) => {
              const b = d.institution
              const capacity = b.cash + b.wholesale.cbFacilityCapacity
              const uninsured = b.deposits
                .filter((s) => !s.insured)
                .reduce((a, s) => a + s.balance, 0)
              if (d.flags.btfp_ready || capacity >= uninsured) {
                d.confidence.index = clamp(d.confidence.index + 15, 0, 100)
                d.counters.dampener = Math.max(0.3, (d.counters.dampener || 1) * 0.7)
                ctx.log(
                  `검증된 유동성 공표: 여력 ${capacity.toFixed(1)} vs 무보험 ${uninsured.toFixed(1)} → ΔCI +15, 완화 ×0.7`,
                )
              } else {
                d.confidence.index = clamp(d.confidence.index - 10, 0, 100)
                d.counters.amplifier = (d.counters.amplifier || 1) * 1.5
                ctx.log('공표할 여력이 부족 — 수치가 불안을 확인시킴: ΔCI −10, 증폭 ×1.5')
              }
            }),
          ],
          expert: {
            rating: 85,
            rationale: 'FRC 3월 12일 공표의 원형이나, 이번에는 액면 담보 창구로 뒷받침된다.',
            sourceRefs: [S.frcDeposit, S.fsb],
          },
          consequences: '보도자료가 나갔습니다. 주요 예금주에게 같은 수치가 전달되었습니다.',
        },
        {
          id: 't7-c',
          label: '보험 스윕(ICS/IntraFi) 프로그램 출시',
          description: '무보험 잔액의 최대 20%를 5영업일 내 보험 예금으로 전환한다.',
          effects: [bankFx.insuredSweep({ share: 0.2 })],
          expert: {
            rating: 70,
            rationale:
              '무보험 비중의 구조적 해법. PacWest는 보험 예금 비중을 2022-12-31 48% → 2023-03-31 71%로 높였다 ' +
              '(중간 경과: 3/16 62% 초과, 3/20 65% 초과).',
            sourceRefs: [S.bcbs, S.pacw10q, S.pacw8k],
          },
          consequences: '스윕 프로그램이 개시되었습니다. 보험 예금 비중이 상승했습니다.',
          calibrationNote:
            '원문 확인(2026-09). **"48%→71%"의 일자는 3/20이 아니라 3/31이다** — PacWest Bancorp Form 10-Q ' +
            '(Q1 2023, 2023-05-11 제출): "the percentage of insured deposits to total deposits to increase ' +
            'from 48% at December 31, 2022 to 71% of total deposits at March 31, 2023". 3월 중 경과는 8-K ' +
            'Ex.99.1로 확인된다: 3/16 기준 "insured deposits exceed 62% of total deposits"(2023-03-20 제출), ' +
            '3/20 기준 "FDIC-insured deposits exceeded 65% of total deposits"(2023-03-22 제출). [VERIFY] 해소.',
        },
        {
          id: 't7-d',
          label: '관망',
          description: '정책 대응이 시장을 안정시키기를 기다린다.',
          effects: [],
          expert: {
            rating: 20,
            rationale: 'FRC의 월요일(−62%)이 보여주듯 기다림은 중립이 아니다.',
            sourceRefs: [S.frc],
          },
          consequences: '아무 조치도 취하지 않았습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't7-d1',
      text: 'BTFP는 담보를 "액면"으로 평가합니다. 미실현손실이 큰 HTM일수록 이 창구의 가치가 큽니다.',
    },
    {
      level: 3,
      decisionId: 't7-d1',
      text: 'A(BTFP 준비)는 필수, B(공표)는 A 이후에만 의미가 있습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T8 — 2023-03-13 (월) "BTFP 첫날"
// ---------------------------------------------------------------------------------------------
export const t8: T = {
  id: 't8',
  label: 'T8',
  timeLabel: '2023년 3월 13일 (월) 06:00 PT',
  title: 'BTFP 첫날',
  time: '2023-03-13T06:00:00-07:00',
  entryEffects: [
    {
      id: 't8-market',
      description: '2년물 −60bp 랠리(안전자산 선호), KRE −12%, 피어 보증 미대상 반응 −10%',
      effects: [
        op('market.govt2yBp', 'add', -60),
        bankFx.rateShock({ deltaBp: -60, label: '2년물 −60bp' }),
        op('market.custom.kre', 'mul', 0.88),
        ownStockMove(-0.1, '피어만 보증'),
      ],
    },
    {
      id: 't8-sector-stress',
      description: '퍼스트리퍼블릭 −62%, KRE −12% — 시장이 "다음 은행"을 찾음 → 신뢰지수 −10',
      effects: [confidence(-10, '지역은행 투매(외생)')],
    },
    {
      id: 't8-runoff',
      description: '월요일 유출',
      effects: [bankFx.runoffStep({ windowFraction: 1, label: '월요일 유출' })],
    },
  ],
  events: [
    {
      id: 't8-news-frc',
      kind: 'newswire',
      outlet: 'CNBC',
      time: '06:45 PT',
      headline: '퍼스트리퍼블릭 −62%, 지역은행주 급락 — 재할인창구 차입 사상 최대 전망',
      body: '시스템리스크 예외가 SVB·시그니처에만 적용되면서 시장은 "다음 은행"을 찾고 있다. 2년물 국채는 하루 60bp 급락했다.',
      severity: 'critical',
      sourceRefs: [S.frc, S.fred],
    },
    {
      id: 't8-market',
      kind: 'market',
      time: '06:30 PT',
      headline: '개장 시세',
      items: [
        { label: 'KRE', value: '−12%', change: '' },
        { label: 'UST 2Y', value: '4.03%', change: '−60bp' },
        { label: 'PVB', value: '대시보드 참조', change: '' },
      ],
      sourceRefs: [S.fred],
    },
  ],
  decisions: [
    {
      id: 't8-d1',
      title: 'BTFP 차입 규모',
      prompt: '오늘 얼마나 차입하시겠습니까?',
      dimensions: ['liquidity'],
      options: [
        {
          id: 't8-d1-a',
          label: '적격 담보 액면 전액 차입',
          description: 'NII 드래그 ≈ (OIS+10bp ≈ 4.6% − HTM 수익률 ≈ 1.7%) × 차입액.',
          requires: { flag: 'btfp_ready' },
          unavailableReason: 'BTFP 담보가 설정되어 있지 않습니다.',
          effects: [bankFx.drawFacility({ amount: 999, source: 'BTFP', rateBp: 460 })],
          expert: {
            rating: 90,
            rationale:
              '런 중에는 유동성 과잉이 정답이다. 비용은 2년간의 NII 압박이지만 생존의 대가다.',
            sourceRefs: [S.btfp, S.bcbs],
          },
          consequences: 'BTFP 차입이 실행되었습니다.',
        },
        {
          id: 't8-d1-b',
          label: '재할인창구만 사용(시가−마진, 90일)',
          description: '기설정 여력 내에서 창구 차입.',
          effects: [bankFx.drawFacility({ amount: 10, source: '재할인창구', rateBp: 475 })],
          expert: {
            rating: 60,
            rationale: '작동하지만 액면 평가의 이점을 버린다.',
            sourceRefs: [S.btfp],
          },
          consequences: '창구 차입이 실행되었습니다.',
        },
        {
          id: 't8-d1-c',
          label: '최소 차입',
          description: '비용을 아낀다.',
          effects: [],
          expert: {
            rating: 20,
            rationale: '월요일은 시험대다. 여력을 쓰지 않는 것은 시험에 답하지 않는 것이다.',
            sourceRefs: [S.frc],
          },
          consequences: '차입하지 않았습니다.',
        },
      ],
    },
    {
      id: 't8-d2',
      title: '자본 계획',
      prompt: '주 후반의 자본 계획은?',
      dimensions: ['solvency', 'policy'],
      options: [
        {
          id: 't8-d2-a',
          label: '완전 백스톱 증자 즉시 (깊은 할인, 희석 30~40%)',
          description: '경제적 자기자본이 얇은 은행은 징벌적 가격에라도 자본을 넣어야 한다.',
          effects: [
            bankFx.raiseEquity({ amount: 3, backstopPct: 100, discount: 0.4, marketCap: 4 }),
          ],
          expert: {
            rating: 60,
            rationale:
              'HTM 손실 ≈ TCE인 은행의 생존은 결국 신자본을 요구한다. FRC 캐비앗: $30B 예금과 $70B 창구에도 자본 없이 5/1 실패.',
            sourceRefs: [S.frc, S.bcbs],
          },
          consequences: '증자가 종결되었습니다.',
        },
        {
          id: 't8-d2-b',
          label: '전략적 합병 협상 개시',
          description: '독립 생존 대신 합병을 추진한다.',
          effects: [flag('merger_talks'), confidence(5, '합병 협상')],
          expert: {
            rating: 55,
            rationale: '현실적 대안. 협상 기간 동안 유동성은 BTFP로 버틴다.',
            sourceRefs: [S.bcbs],
          },
          consequences: '자문사가 후보군을 선정했습니다.',
        },
        {
          id: 't8-d2-c',
          label: '안정화 대기',
          description: '정책 효과를 지켜본다.',
          effects: [],
          expert: {
            rating: 40,
            rationale: 'FRC의 교훈: 유동성만으로는 지급능력 우려를 잠재우지 못한다.',
            sourceRefs: [S.frc],
          },
          consequences: '대기합니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't8-d1',
      text: '오늘은 여력을 최대한 쓰는 날입니다. 비용은 나중 문제입니다.',
    },
    {
      level: 2,
      decisionId: 't8-d2',
      text: '경제적 유형자기자본비율을 보세요. 0 근처라면 유동성 창구는 시간을 벌어줄 뿐 생존을 보장하지 않습니다.',
    },
  ],
}

export const turnsB: T[] = [t5, t6, t7, t8]
