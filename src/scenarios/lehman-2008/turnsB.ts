import type { BankState, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { bankFx } from '../../engine/fx/bank'
import { confidence, flag, ownStockMove, regulator } from '../../engine/fx/common'
import { ibFx } from './fx'
import { S } from './turnsA'

type T = Turn<BankState>

// ---------------------------------------------------------------------------------------------
// T4 — 2008-09-13 (토) "주말 1일차: 컨소시엄"
// ---------------------------------------------------------------------------------------------
export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2008년 9월 13일 (토) 09:00 ET',
  title: '주말 1일차: 컨소시엄과 bad-bank',
  time: '2008-09-13T09:00:00-04:00',
  entryEffects: [
    {
      id: 't4-no-window',
      description: '주말 — 송금 창구 없음',
      effects: [ibFx.resetDailyOutflow()],
    },
  ],
  events: [
    {
      /**
       * The correction to `t3-news-buyers`. The bidders' demand for a loss guarantee was real, and
       * so was the Treasury's refusal — which is why the meeting in the next event opens with
       * "공적 자금은 없습니다" and a consortium bad bank instead.
       *
       * The reader who read the Thursday report as a negotiating posture is finding out here that
       * it was the actual constraint, and that the only remaining source of a guarantee is the
       * room they are sitting in.
       */
      id: 't4-news-guarantee-confirmed',
      kind: 'newswire',
      outlet: '통신사',
      time: '08:30',
      headline: '[확인] 손실 보증 요구는 사실이었다 — 재무부는 거부, 남은 자금줄은 경쟁사들',
      body:
        '어제 전해진 "정부 손실 보증 없이는 어렵다"는 두 후보의 입장은 사실로 확인됐다. ' +
        '재무부는 보증을 거부했고, 그래서 오늘 회의의 의제는 인수자 찾기가 아니라 ' +
        '상업용 부동산을 떼어낼 자금을 누가 댈 것인가로 옮겨졌다.',
      severity: 'critical',
      reliability: 'confirmed',
      correctionOf: 't3-news-buyers',
      sourceRefs: [S.fcic, S.val],
    },
    {
      id: 't4-dialogue-frbny',
      kind: 'dialogue',
      time: '09:00',
      title: '뉴욕연준 회의실 — 월가 CEO 회의',
      lines: [
        { speaker: '재무부 장관', text: '공적 자금은 없습니다. 여러분이 해법을 만들어야 합니다.' },
        {
          speaker: '뉴욕연준 총재',
          text: '두 가지 축입니다. 하나는 인수자(바클레이스 또는 BofA). 다른 하나는 인수자가 원하지 않는 상업용 부동산 $30B 안팎을 여러분의 컨소시엄이 자금을 대는 별도 회사(bad bank)로 떼어내는 것입니다.',
        },
        {
          speaker: '대형은행 CEO',
          text: '우리가 손실을 떠안는 구조라면, 인수자가 확정된 뒤에나 논의할 수 있습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.fcic, S.fhSup],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't4-news-bofa-merrill',
      kind: 'newswire',
      outlet: 'WSJ',
      time: '18:30',
      headline: '뱅크오브아메리카, 메리디언 실사 중단 — 메릴린치와 접촉 중이라는 보도',
      body: 'BofA가 메리디언 대신 메릴린치 인수를 논의하고 있다는 보도가 나왔다. 확인되지 않았다.',
      severity: 'critical',
      sourceRefs: [S.fcic],
      reliability: 'unconfirmed',
    },
    {
      id: 't4-memo-barclays',
      kind: 'memo',
      time: '20:00',
      from: '자문사',
      to: 'CEO · 이사회',
      subject: '바클레이스 실사 진행 상황',
      body: `- 바클레이스는 상업용 부동산을 제외한 "좋은 회사"를 인수하고 싶어 합니다. 부동산은 컨소시엄 bad bank 로 분리하는 것이 전제입니다.
- 영국 인수자는 자국 규제당국(FSA)의 승인과, 주주총회 없이 거래 보증을 제공할 수 있는지에 대한 면제가 필요합니다. 아직 답이 없습니다.
- 실사팀은 부동산 마크의 근거 자료를 요구하고 있습니다.`,
      severity: 'warning',
      sourceRefs: [S.fcic],
    },
    {
      id: 't4-memo-london',
      kind: 'memo',
      time: '21:00',
      from: '런던 법인 CFO',
      to: 'Treasurer',
      subject: '런던 법인 현금 스윕',
      body: '평소처럼 런던 법인의 여유 현금을 뉴욕 지주로 스윕했고 월요일 아침 돌려받는 구조입니다. 만약 월요일에 돌려주지 못하면 런던 법인은 개장과 동시에 지급불능이며, 고객 자산 분리 문제가 뒤따릅니다.',
      severity: 'warning',
      sourceRefs: [S.fdic],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '컨소시엄·bad-bank 협상',
      prompt: '주말 협상에서 어떤 구조를 밀겠습니까?',
      context:
        '인수자·컨소시엄·규제당국 세 축이 동시에 맞아야 합니다. 하나라도 빠지면 일요일 밤 선택지는 줄어듭니다.',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['solvency', 'policy', 'communication'],
      select: { min: 1, max: 1 },
      defaultOptionId: 't4-a',
      // 3단계 협상: 구조 선택 → 컨소시엄 출자 약속액(commitReplies) → 규제 승인 축의 주체.
      // 약속액은 `counters.consortiumPledgeB`에 남고, 그 크기가 충분했는지는 t4-a의 지연효과가
      // 일요일(T5)에 판정한다. 대사는 FCIC ch.18과 연준 사료가 전하는 회의 내용을 바탕으로 한
      // **재구성**이며 녹취·속기록이 아니다(calibration.md §7.4).
      steps: [
        {
          id: 't4-neg-open',
          lines: [
            {
              speaker: '뉴욕연준 총재',
              text: '두 축입니다 — 인수자, 그리고 인수자가 원하지 않는 상업용 부동산을 떠안을 컨소시엄. 무엇부터 붙이시겠습니까?',
            },
          ],
          note: '여기서 정한 구조가 주말 내내 협상 테이블의 형태를 결정합니다.',
          replies: [
            {
              id: 't4-neg-r-package',
              label: '인수자와 bad-bank를 한 패키지로 묶어 동시에 협상',
              next: 't4-neg-pledge',
              expert: {
                rating: 70,
                rationale:
                  '인수자는 부동산을 원하지 않고 컨소시엄은 인수자 없이 움직이지 않는다. 두 축을 따로 세우면 서로를 기다리다 주말이 끝난다.',
              },
            },
            {
              id: 't4-neg-r-bofa',
              label: 'BofA 한 곳에 집중해 단독 인수를 설득',
              resolvesTo: 't4-c',
              expert: {
                rating: 30,
                rationale:
                  'BofA는 보증 없이 움직이지 않았고 토요일에 메릴린치로 돌아섰다. 한 후보에 거는 것은 일요일 밤을 비운다.',
              },
            },
            {
              id: 't4-neg-r-marks',
              label: '부동산 마크를 상향해 실사팀을 먼저 안심시킨다',
              resolvesTo: 't4-e',
              trap: true,
              trapExplanation:
                '실사는 숫자가 아니라 신뢰를 검증한다. 마크를 고치면 거래가 죽고, 그 사실은 같은 주말에 드러난다.',
              expert: { rating: 5, rationale: '거래를 살리려 숫자를 고치면 거래가 죽는다.' },
            },
          ],
        },
        {
          id: 't4-neg-pledge',
          lines: [
            {
              speaker: '대형은행 CEO',
              text: '우리가 SpinCo에 얼마를 대야 합니까? 숫자가 없으면 각 사 이사회에 올릴 수 없습니다.',
            },
          ],
          note: '여기서 부른 출자 규모는 일요일 실사에서 그대로 검증됩니다. 분리 대상 부동산 북은 $25~30B입니다.',
          replies: commitReplies<BankState>('consortiumPledgeB', [10, 20, 30], {
            idPrefix: 't4-neg-pledge',
            label: (v) => `컨소시엄 출자 $${v}B 규모로 제안`,
            next: 't4-neg-regulator',
            expert: (v) => ({
              rating: v >= 30 ? 80 : v >= 20 ? 60 : 30,
              rationale:
                v >= 30
                  ? '분리 대상 부동산 북(REI Global $25~30B)을 실제로 덮는 규모다. 인수자가 잔여 리스크를 계산할 수 있어야 거래가 성립한다.'
                  : v >= 20
                    ? '북의 대부분을 덮지만 잔여분은 인수자가 떠안아야 한다. 협상이 한 번 더 돌아간다.'
                    : '분리 대상의 3분의 1에 불과하다. 인수자는 나머지를 자기 대차대조표에서 보게 되고, 그 순간 실사가 멈춘다.',
            }),
            trap: (v) => v < 20,
            trapExplanation: (v) =>
              v < 20
                ? '숫자를 낮게 불러 컨소시엄의 동의를 얻어도, 같은 숫자가 인수자에게는 "덮이지 않은 리스크"로 읽힌다. 두 상대에게 같은 숫자가 반대로 작동한다.'
                : undefined,
          }),
        },
        {
          id: 't4-neg-regulator',
          lines: [
            {
              speaker: '뉴욕연준 총재',
              text: '세 번째 축이 남았습니다. 영국 인수자에게는 자국 감독당국의 면제가 필요합니다. 누가 그것을 책임집니까?',
            },
          ],
          replies: [
            {
              id: 't4-neg-r-fsa-joint',
              label: '연준·재무부가 영국 감독당국과 직접 협의하도록 요청',
              resolvesTo: 't4-a',
              expert: {
                rating: 60,
                rationale:
                  '규제 승인은 거래의 세 번째 축이며 당사자가 풀 수 없다. 실제로도 일요일 오후에 "불가"라는 답이 왔고, 그때는 대안을 만들 시간이 없었다.',
              },
            },
            {
              id: 't4-neg-r-buyer-owns',
              label: '규제 승인 문제는 인수자가 알아서 해결하도록 둔다',
              resolvesTo: 't4-d',
              expert: {
                rating: 35,
                rationale: '인수자에게 맡기면 일요일 오후에 "불가"라는 답을 받는다.',
              },
            },
            {
              id: 't4-neg-r-standalone',
              label: '인수자 없이 컨소시엄 지원 스핀오프만으로 독립 생존을 확정',
              when: { all: [{ flag: 'pdcf_prepositioned' }, { flag: 'fed_engaged' }] },
              resolvesTo: 't4-b',
              expert: {
                rating: 75,
                rationale:
                  '비유동 북이 대차대조표에서 사라지면 규제 승인이라는 축 자체가 필요 없어진다. 다만 사전 예치 담보와 연준 채널이 모두 있을 때만 성립한다(반사실).',
              },
            },
          ],
        },
      ],
      options: [
        {
          id: 't4-a',
          label: '컨소시엄이 부동산 bad-bank에 자금 대고 바클레이스가 잔여 인수 — 잠정 합의',
          description:
            '월가 컨소시엄이 $30B 안팎의 부동산 SpinCo를 지원하고 바클레이스가 나머지를 산다. 규제 승인은 별도.',
          effects: [flag('consortium_deal_tentative')],
          // 협상에서 부른 출자 규모의 이행 판정. 대화를 걷지 않고 옵션이 바로 확정된 경우
          // (마감 스윕·타임아웃) 카운터는 0으로 남고, `gt: 0` 조건 덕분에 판정도 생략된다.
          delayedEffects: [
            {
              afterTurns: 1,
              when: {
                all: [
                  { counter: 'consortiumPledgeB', gt: 0 },
                  { counter: 'consortiumPledgeB', lt: 20 },
                ],
              },
              description:
                '컨소시엄 출자 약속이 분리 대상 부동산 북($25~30B)에 못 미쳐 인수 후보가 잔여 리스크를 이유로 조건을 다시 요구 → 신뢰지수 −8',
              effects: [confidence(-8, '컨소시엄 출자 부족 — 인수 협상 후퇴')],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '실제 토요일의 구조. 일요일 FSA 면제 거부로 무산되었다. 구조는 합리적이었으나 세 번째 축(규제)이 빠져 있었다.',
            historicalNote: '9/13 컨소시엄 잠정 합의 → 9/14 FSA 거부.',
            sourceRefs: [S.fcic, S.fhSup],
          },
          consequences: '컨소시엄이 잠정 합의했습니다. 바클레이스는 런던의 승인을 기다립니다.',
          historical: true,
          feasibility: { basis: '실제 진행된 협상', sourceRefs: [S.fcic] },
        },
        {
          id: 't4-b',
          label: '컨소시엄 bad-bank 스핀오프를 자체 PDCF 여력과 결합해 독립 생존 계획 확정',
          description:
            '인수자와 무관하게 부동산 북과 CMBS 레포를 컨소시엄 지원 SpinCo로 분리하고, 브로커딜러는 PDCF로 조달한다. 자본 기여 $3B. 연준 조기 접촉과 PDCF 사전 예치가 전제.',
          requires: { all: [{ flag: 'pdcf_prepositioned' }, { flag: 'fed_engaged' }] },
          unavailableReason: 'PDCF 사전 예치(T0.B)와 연준 조기 접촉(T3.B)이 모두 필요합니다.',
          effects: [
            ibFx.spinoffBadBank({ equityContribution: 3, label: '부동산 bad-bank 스핀오프 확정' }),
            confidence(5, 'bad-bank 분리 확정'),
          ],
          expert: {
            rating: 60,
            rationale:
              '비유동 북을 분리하면 카운터파티가 두려워하던 자산이 대차대조표에서 사라진다. 그러나 컨소시엄이 인수자 없이 자금을 댔을지는 반사실이다(캐비앳: 도시에가 지지하지 않음). 자본 기여 3은 STYLIZED.',
            sourceRefs: [S.fcic, S.k8],
          },
          consequences:
            'SpinCo 텀시트에 컨소시엄이 서명했습니다. 부동산 북과 CMBS 레포가 분리되었습니다.',
          feasibility: {
            basis: '반사실: 인수자 없는 컨소시엄 지원은 역사적으로 없었음',
            sourceRefs: [S.fcic],
          },
          calibrationNote: '자본 기여 3 [STYLIZED]; 분리 시 repoOther → 0, 비유동 북 → 0',
        },
        {
          id: 't4-c',
          label: 'BofA에 집중 — 정부 보증 없이 인수 요청',
          description: 'BofA 하나에 집중한다. BofA는 이미 다른 상대를 보고 있다.',
          effects: [flag('bofa_focus')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: 'BofA, 메릴린치 인수로 선회 → 신뢰지수 −10',
              effects: [confidence(-10, 'BofA 이탈')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              'BofA는 보증 없이는 움직이지 않았고 토요일 메릴린치로 돌아섰다(FCIC ch.18). 한 후보에 거는 것은 일요일 밤을 비운다.',
            sourceRefs: [S.fcic],
          },
          consequences: 'BofA 실사팀이 저녁에 철수했습니다.',
          feasibility: { basis: '협상 가능; 결과는 역사와 동일' },
        },
        {
          id: 't4-d',
          label: '바클레이스 단독 협상 — 규제 승인 문제는 인수자 몫으로',
          description: '바클레이스만 상대한다. FSA 면제 문제는 인수자가 풀어야 한다고 본다.',
          effects: [flag('barclays_only')],
          expert: {
            rating: 35,
            rationale:
              '규제 승인은 거래의 세 번째 축이다. 인수자에게 맡기면 일요일 오후에 "불가"라는 답을 받는다.',
            sourceRefs: [S.fcic],
          },
          consequences: '바클레이스와 단독 협상에 들어갔습니다. FSA 회신은 일요일에 옵니다.',
          feasibility: { basis: '협상 가능' },
        },
        {
          id: 't4-e',
          label: '실사 데이터룸에 부동산 마크를 낙관적으로 상향 제시',
          description:
            '인수자를 안심시키려 부동산 마크를 올린다. 실사팀은 마크의 근거를 요구하고 있다.',
          effects: [flag('marks_inflated'), confidence(2, '낙관 마크 제시')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '실사팀, 마크 불신 — 모든 인수 협상 중단, 신뢰지수 −10',
              effects: [confidence(-10, '마크 불신')],
            },
          ],
          expert: {
            rating: 5,
            rationale:
              '리먼의 부동산 마크는 파산 조사관 실사에서 논쟁이 되었다(Valukas). 인수자 실사에서 낙관 마크는 거래를 죽인다 — 그리고 일요일에 남는 선택지를 없앤다.',
            sourceRefs: [S.val, S.valT],
          },
          consequences: '수정된 마크가 데이터룸에 올라갔습니다. 실사팀이 근거 자료를 요구했습니다.',
          trap: true,
          trapExplanation:
            '거래를 살리려 숫자를 고치면 거래가 죽는다. 실사는 숫자가 아니라 신뢰를 검증한다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't4-d2',
      title: '주말 유동성·고객 자산 준비',
      prompt: '월요일을 위해 이번 주말에 무엇을 준비하시겠습니까? (최대 2개)',
      select: { min: 1, max: 2 },
      dimensions: ['liquidity', 'compliance', 'timeliness'],
      options: [
        {
          id: 't4-d2-a',
          label: '브로커딜러 담보 목록 정비 — 담보 범위 확대에 대비',
          description:
            '트라이파티 적격 담보 전체(주식·비투자등급 포함)의 목록·가치평가를 준비해 연준 창구가 넓어질 경우 즉시 쓸 수 있게 한다.',
          effects: [flag('weekend_collateral_prepared')],
          expert: {
            rating: 70,
            rationale:
              '창구 조건은 주말에 바뀔 수 있다. 준비된 담보 목록만 월요일 아침에 자금이 된다(CFP 원칙: 리드타임).',
            sourceRefs: [S.bcbs, S.fed914],
          },
          consequences: '담보 목록과 가치평가 파일이 준비되었습니다.',
          feasibility: { basis: '내부 작업, 주말 가능' },
        },
        {
          id: 't4-d2-b',
          label: '고객 자산 분리 확인 및 PB 이전 요청 전량 처리 준비',
          description:
            '고객 증권·현금의 분리 상태를 확인하고 월요일 이전 요청을 전량 처리할 준비를 한다. 어떤 결말이든 고객 자산 문제를 줄인다.',
          effects: [flag('customer_assets_segregated'), confidence(2, '고객 자산 분리 확인')],
          expert: {
            rating: 75,
            rationale:
              '리먼 런던 법인의 고객 자산 동결은 파산의 가장 큰 2차 피해였다. 질서 있는 정리의 핵심 요소(FDIC 2011: 고객 자산·결제 연속성).',
            sourceRefs: [S.fdic],
          },
          consequences: '고객 자산 분리가 확인되었고 월요일 처리 계획이 세워졌습니다.',
          feasibility: { basis: '내부 작업, 주말 가능', sourceRefs: [S.fdic] },
        },
        {
          id: 't4-d2-c',
          label: '지주 중앙집중 현금관리 유지 — 런던 법인 현금을 뉴욕으로 스윕',
          description:
            '평소 관행대로 런던 법인 현금을 지주로 모은다. 지주가 월요일에 돌려주지 못하면 런던 법인은 개장과 함께 지급불능이다.',
          effects: [flag('london_sweep')],
          expert: {
            rating: 25,
            rationale:
              '리먼의 실제 관행. 9/15 지주가 런던 법인에 현금을 돌려주지 못해 LBIE는 즉시 관리 절차에 들어갔고 고객 자산이 수년간 묶였다(FDIC 2011).',
            historicalNote: '실제 주말 관행 유지.',
            sourceRefs: [S.fdic, S.fcic],
          },
          consequences: '스윕이 유지되었습니다. 런던 법인은 월요일 아침 반환을 전제로 개장합니다.',
          historical: true,
          feasibility: { basis: '기존 관행' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '거래에는 인수자·컨소시엄·규제 승인 세 축이 필요합니다. 지금 확보된 축은 몇 개입니까?',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: 'B(자체 스핀오프)는 T0.B와 T3.B가 있을 때만 열립니다. E(마크 상향)는 함정입니다.',
    },
    {
      level: 2,
      decisionId: 't4-d2',
      text: '어떤 결말이든 고객 자산 분리(B)와 담보 목록(A)은 월요일의 피해를 줄입니다. 런던 스윕(C)은 파산 시 2차 피해의 원인입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2008-09-14 (일) "결정의 일요일"
// ---------------------------------------------------------------------------------------------
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2008년 9월 14일 (일) 21:00 ET',
  title: '결정의 일요일',
  time: '2008-09-14T21:00:00-04:00',
  entryEffects: [
    {
      id: 't5-no-window',
      description: '주말 — 송금 창구 없음',
      effects: [ibFx.resetDailyOutflow()],
    },
    {
      id: 't5-fsa',
      description: 'FSA, 바클레이스 주주투표 면제 거부 (일요일 오전) — 바클레이스 인수 무산',
      effects: [flag('fsa_refused'), confidence(-5, 'FSA 면제 거부')],
    },
    {
      id: 't5-fed-parent',
      description: '연준, 지주회사 앞 대출·보증 거부 확인',
      effects: [flag('fed_parent_refused')],
    },
    {
      id: 't5-pdcf-expansion',
      description:
        '연준, PDCF 담보를 트라이파티 적격 담보 전체로 확대 발표(일요일 저녁) — 브로커딜러 여력 확대, 지주는 부적격',
      effects: [ibFx.pdcfExpansion({ base: 12, prepared: 20 })],
    },
  ],
  events: [
    {
      /**
       * The correction to `t4-news-bofa-merrill`. The unconfirmed report was right, and the
       * timing is what matters: BofA and Merrill agreed over the same weekend, which removed one
       * of the two bidders from the table while the consortium was still being assembled.
       *
       * A reader who discounted it as unconfirmed was planning around a buyer that was already
       * gone.
       */
      id: 't5-news-bofa-merrill-confirmed',
      kind: 'newswire',
      outlet: '통신사',
      time: '09:40',
      headline: '[확인] BofA는 메릴린치로 갔다 — 인수 후보가 하나로 줄었다',
      body:
        '어제 "확인되지 않았다"고 전해진 보도는 사실이었다. BofA는 주말 사이 메릴린치와 합의했고, ' +
        '이로써 남은 인수 후보는 바클레이스 하나다. 바클레이스의 조건은 바뀌지 않았다.',
      severity: 'critical',
      reliability: 'confirmed',
      correctionOf: 't4-news-bofa-merrill',
      sourceRefs: [S.fcic],
    },
    {
      id: 't5-call-fsa',
      kind: 'call',
      time: '10:30',
      caller: '바클레이스 CEO',
      callee: 'CEO',
      tone: 'urgent',
      lines: [
        {
          speaker: '바클레이스',
          text: 'FSA가 주주총회 없이 귀사 거래를 보증하는 것을 허가하지 않았습니다. 월요일 개장 전에 완결할 방법이 없습니다. 유감입니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.fcic, S.fhSup],
    },
    {
      id: 't5-news-bofa-merrill',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '15:00',
      headline: '뱅크오브아메리카, 메릴린치 인수 합의 임박',
      body: 'BofA가 메릴린치를 주당 $29에 인수하는 데 합의했다는 보도. 메리디언 인수 후보에서 공식 이탈.',
      severity: 'critical',
      sourceRefs: [S.fcic],
    },
    {
      id: 't5-dialogue-isda',
      kind: 'dialogue',
      time: '14:00',
      title: 'ISDA 특별 세션 (14:00~16:00)',
      lines: [
        {
          speaker: 'ISDA',
          text: '메리디언이 자정 전 파산을 신청할 경우에 대비해 딜러 간 파생 포지션 상계·대체 거래 세션을 엽니다. 신청이 없으면 세션의 거래는 무효입니다.',
        },
        {
          speaker: 'Treasurer',
          text: '우리 포지션 데이터는 제공합니다. 신청 여부는 이사회가 오늘 밤 결정합니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.fcic, S.fdic],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't5-call-fed',
      kind: 'call',
      time: '19:00',
      caller: '뉴욕연준 총재',
      callee: 'CEO',
      agency: 'Federal Reserve Bank of New York',
      tone: 'urgent',
      lines: [
        {
          speaker: '뉴욕연준',
          text: '오늘 저녁 PDCF 담보 범위를 트라이파티 적격 담보 전체로 넓힙니다. 귀사 브로커딜러는 월요일 아침부터 이 창구를 쓸 수 있습니다. 그러나 지주회사에는 대출하지 않으며 보증도 없습니다.',
        },
        { speaker: 'CEO', text: '지주의 만기는 어떻게 합니까?' },
        {
          speaker: '뉴욕연준',
          text: '그것이 오늘 밤 이사회가 결정할 문제입니다. SEC 위원장이 곧 전화할 겁니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.fed914, S.bern, S.fhSup],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 't5-board',
      kind: 'board',
      time: '20:00',
      headline: '긴급 이사회',
      body: '이사회는 (1) 인수 협상 결과, (2) 브로커딜러의 창구 접근과 지주의 자금 부족, (3) 파산 신청 준비 상태(사전 조율 여부), (4) 런던 등 해외 법인의 월요일 상태를 보고받았습니다. "자정 전에 결정해야 한다."',
      severity: 'critical',
      sourceRefs: [S.fcic],
    },
    {
      id: 't5-memo-prepack',
      kind: 'memo',
      when: { flag: 'fed_engaged' },
      time: '20:30',
      from: '법무실장',
      to: '이사회',
      subject: '사전 조율된 정리안 준비 상태',
      body: '금요일부터 연준·SEC와 조율한 결과, 브로커딜러(LBI)를 파산 절차에서 제외해 PDCF 차입·정상 결제를 유지하고, 해외 법인 자금·고객 자산 분리·ISDA 상계 세션과 순서를 맞춘 신청이 가능합니다. 무질서 신청보다 채권자 회수와 시장 충격 면에서 낫습니다.',
      severity: 'positive',
      sourceRefs: [S.fdic],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '일요일 밤의 결정',
      prompt: '자정 전에 무엇을 결정하시겠습니까?',
      context:
        '지주에는 창구가 없습니다. 브로커딜러에는 있습니다. 월요일 아침 언와인드까지 8시간입니다.',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['compliance', 'policy', 'liquidity'],
      timeLimitSec: 180,
      defaultOptionId: 't5-a',
      options: [
        {
          id: 't5-a',
          label: 'Chapter 11 즉시 신청 — 사전 조율 없이 지주 단독',
          description:
            'SEC의 권고대로 지주회사가 파산을 신청한다. 브로커딜러·해외 법인·ISDA와의 순서 조율은 없다.',
          effects: [flag('chapter11_decided')],
          expert: {
            rating: 25,
            rationale:
              'FDIC(2011)는 리먼의 무질서한 파산이 시스템 충격과 채권자 손실을 키웠고, 사전 조율된 정리(Title II OLA)라면 "vastly superior"였을 것이라고 평가한다. 관리 수수료만 2011.2까지 $1.2B 이상.',
            historicalNote: '9/15 01:45 ET Chapter 11 신청.',
            sourceRefs: [S.fdic, S.fhSup],
          },
          consequences: '이사회가 파산 신청을 의결했습니다. 변호사들이 신청서를 작성합니다.',
          historical: true,
          irreversible: true,
          feasibility: { basis: '실제 선택', sourceRefs: [S.fdic] },
        },
        {
          id: 't5-b',
          label: '사전 조율된(pre-packaged) Chapter 11 — 브로커딜러 정상 운영·ISDA·해외 법인 조율',
          description:
            '연준·SEC와 조율된 순서로 신청한다: 브로커딜러는 PDCF로 결제를 유지하고, 해외 법인 자금과 고객 자산 분리를 먼저 확정하며, ISDA 세션 결과를 반영한다.',
          requires: { flag: 'fed_engaged' },
          unavailableReason: '연준·SEC와 사전 조율 채널이 없습니다 (T3에서 조기 접촉하지 않음).',
          effects: [flag('chapter11_decided'), flag('prepack')],
          expert: {
            rating: 70,
            rationale:
              'FDIC(2011) 시뮬레이션: 사전 준비된 정리라면 시스템 안정과 채권자 회수 모두 우월. 2008년에는 OLA가 없었으므로 이 옵션은 "당시 가능했던 최선의 실패"다(캐비앳: 생존이 아니다).',
            sourceRefs: [S.fdic, S.bern],
          },
          consequences:
            '조율된 신청 일정이 확정되었습니다. 브로커딜러와 해외 법인에 자금·고객 자산 지시가 내려갔습니다.',
          irreversible: true,
          feasibility: {
            basis: '2008년 법제 하에서도 순서 조율은 가능(OLA는 없음)',
            sourceRefs: [S.fdic],
          },
        },
        {
          id: 't5-c',
          label: '바클레이스 매각 강행 서명 — 정부 보증 없이',
          description: 'FSA가 주주투표 면제를 거부해 월요일 개장 전 완결이 불가능하다.',
          requires: { flag: 'fsa_waiver_granted' },
          unavailableReason:
            'FSA가 바클레이스의 주주투표 면제를 거부했습니다. 월요일 개장 전 완결 불가.',
          effects: [],
          expert: {
            rating: 40,
            rationale:
              '거래의 세 번째 축(규제 승인)이 없다. 학습 포인트: 국경 간 인수의 승인 리스크.',
            sourceRefs: [S.fcic],
          },
          consequences: '(선택 불가)',
          feasibility: { basis: 'FSA 거부 — 실행 불가', sourceRefs: [S.fcic] },
        },
        {
          id: 't5-d',
          label: '정부 지원부 전략적 매각 서명(반사실) — 보증 요청·컨소시엄 합의 전제',
          description:
            '재무부·연준이 제한적 손실 분담을 받아들이고 인수자가 서명하는 반사실. 보증 요청(T3.C)과 컨소시엄·SpinCo 합의(T4)가 있고 마크 논쟁이 없을 때만 열린다.',
          requires: {
            all: [
              { flag: 'guarantee_requested' },
              { any: [{ flag: 'consortium_deal_tentative' }, { flag: 'badbank_spinoff_agreed' }] },
              { notFlag: 'marks_inflated' },
            ],
          },
          unavailableReason:
            '보증 요청(T3.C)과 컨소시엄/SpinCo 합의(T4)가 필요하며, 마크 논쟁이 있으면 인수자가 서명하지 않습니다.',
          effects: [
            flag('sold_with_support'),
            confidence(20, '정부 지원부 매각 발표'),
            bankFx.setDampener(0.5, '인수 발표'),
          ],
          expert: {
            rating: 55,
            rationale:
              '역사에는 없던 선택지다. 연준·재무부는 보증 권한이 없다고 했고(Bernanke 2010), Ball은 담보가 충분해 대출이 가능했다고 반박한다. 부분점수: 독립 생존이 아니며 반사실이다.',
            sourceRefs: [S.bern, S.ball, S.fhSup],
          },
          consequences: '인수 계약이 서명되었습니다. 월요일 아침 공동 발표가 예정되어 있습니다.',
          irreversible: true,
          feasibility: { basis: '반사실 — 당시 법적 권한·정치적 의지 부재', sourceRefs: [S.bern] },
        },
        {
          id: 't5-e',
          label: '파산 연기 — 월요일 개장하고 확대된 PDCF·자산 매각으로 독립 생존 시도',
          description:
            '브로커딜러는 확대된 PDCF로 조달하고, 분리된 부동산 북·확정 매각으로 지주 만기를 막는다. PDCF 사전 예치·SpinCo 확정·생존 일수 ≥1 일 때만 열린다.',
          requires: {
            all: [
              { flag: 'pdcf_prepositioned' },
              { flag: 'badbank_spinoff_agreed' },
              { metric: 'survivalDays', gte: 1 },
            ],
          },
          unavailableReason:
            'PDCF 사전 예치(T0.B), SpinCo 확정(T4.B), 생존 일수 ≥1이 모두 필요합니다.',
          effects: [flag('stay_open')],
          expert: {
            rating: 45,
            rationale:
              '엔진에서는 도달 가능하지만 도시에는 독립 생존을 지지하지 않는다(낙관적 반사실). Ball의 반론(PDCF $88B 차입 가능)이 유일한 근거이며, 지주 만기·파생 담보는 여전히 창구 밖이다.',
            sourceRefs: [S.ball, S.bern],
          },
          consequences:
            '이사회가 개장을 결정했습니다. 브로커딜러 자금팀이 월요일 새벽 PDCF 신청을 준비합니다.',
          feasibility: { basis: '반사실 — 준비된 경우에만 조건부 실행 가능', sourceRefs: [S.ball] },
        },
        {
          id: 't5-f',
          label: '파산 연기 — 준비 없이 월요일 개장 강행, 청산은행에 언와인드 요청',
          description: '아무 준비 없이 하루 더 버틴다. 청산은행은 담보 없이는 언와인드하지 않는다.',
          effects: [flag('stay_open_unprepared')],
          expert: {
            rating: 5,
            rationale:
              '청산은행은 월요일 아침 언와인드를 거부하고 트라이파티 레포 전체가 결제되지 않는다(NY Fed EPR 2012). 무질서 파산보다 더 무질서한 결과.',
            sourceRefs: [S.epr, S.fcic],
          },
          consequences:
            '이사회가 신청을 미뤘습니다. JPM은 "담보 없이는 언와인드 불가"라고 재확인했습니다.',
          trap: true,
          trapExplanation:
            '파산을 미루면 더 나빠진다. 준비 없는 하루는 청산은행의 거부와 고객 자산의 동결로 끝난다. 실패가 확정되었다면 질서 있게 실패해야 한다.',
          irreversible: true,
          remediationCard: 'fdic-resolution-weekend',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '"생존 일수"와 "PDCF 적격 담보 여력"을 보세요. 지주의 만기는 창구 밖입니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '질서 있는 실패(pre-pack)는 부분점수를 받습니다. 준비 없는 연기(F)는 무질서 파산보다 나쁩니다.',
    },
    {
      level: 3,
      decisionId: 't5-d1',
      text: 'E(독립 생존)가 열려 있다면 반사실임을 알고 선택하세요. 아니라면 B(사전 조율)가 당시 가능했던 최선입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2008-09-15 (월) "월요일"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2008년 9월 15일 (월) 01:30 ET',
  title: '월요일',
  time: '2008-09-15T01:30:00-04:00',
  entryEffects: [
    {
      id: 't6-chapter11',
      when: { flag: 'chapter11_decided' },
      description: '01:30 ET Chapter 11 신청',
      effects: [flag('chapter11'), flag('monday')],
    },
    {
      id: 't6-unprepared',
      when: { flag: 'stay_open_unprepared' },
      description: '청산은행, 월요일 아침 언와인드 거부',
      effects: [
        flag('clearing_bank_refused'),
        flag('monday'),
        confidence(-20, '청산은행 언와인드 거부'),
      ],
    },
    {
      id: 't6-open-market',
      when: { any: [{ flag: 'stay_open' }, { flag: 'sold_with_support' }] },
      description:
        '월요일 시장: 주가지수 −4.7%, BofA·메릴 발표, 무담보 시장 경색 → 신뢰지수 −10 (매각 시 +10)',
      effects: [
        flag('monday'),
        ownStockMove(-0.2, '월요일 개장'),
        confidence(-10, '월요일 시장 충격'),
      ],
    },
    {
      id: 't6-sold-boost',
      when: { flag: 'sold_with_support' },
      description: '인수 공동 발표 → 신뢰지수 +20',
      effects: [confidence(20, '인수 공동 발표')],
    },
    {
      id: 't6-runoff',
      when: { flag: 'stay_open' },
      description: '9/15 자금 유출',
      effects: [bankFx.runoffStep({ windowFraction: 1, label: '9/15 유출' })],
    },
  ],
  events: [
    {
      id: 't6-news-filing',
      kind: 'newswire',
      when: { flag: 'chapter11' },
      outlet: 'Bloomberg',
      time: '01:45',
      headline: '메리디언 브라더스 지주회사, Chapter 11 신청 — 미국 역사상 최대 파산',
      body: '자산 약 $639B, 부채 약 $613B. 브로커딜러 자회사는 신청 대상에서 제외되었다. 런던 법인은 개장과 함께 관리 절차에 들어갔다.',
      severity: 'critical',
      sourceRefs: [S.q10, S.fdic],
    },
    {
      id: 't6-market',
      kind: 'market',
      time: '09:30',
      headline: '월요일 개장',
      items: [
        { label: 'S&P 500', value: '−4.7%', change: '2001.9 이후 최대' },
        { label: 'TED 스프레드', value: '≈200bp', change: '급등' },
        { label: 'BofA·메릴린치', value: '$50B 인수 발표', change: '' },
      ],
      sourceRefs: [S.fcic],
    },
    {
      id: 't6-memo-pdcf-open',
      kind: 'memo',
      when: { flag: 'stay_open' },
      time: '07:00',
      from: '브로커딜러 자금팀',
      to: 'Treasurer',
      subject: '확대 PDCF 신청 준비 완료',
      body: '담보 확대로 늘어난 여력은 대시보드 참조. 오전 언와인드 전에 차입을 실행해야 청산은행이 담보를 되돌려줍니다.',
      severity: 'positive',
      sourceRefs: [S.fed914],
    },
    {
      id: 't6-news-sold',
      kind: 'newswire',
      when: { flag: 'sold_with_support' },
      outlet: 'Reuters',
      time: '07:30',
      headline: '메리디언, 정부 지원부 인수 합의 공동 발표 (반사실)',
      body: '인수자와 재무부·연준이 제한적 손실 분담 구조를 발표했다. 이 결말은 역사에 없던 반사실이다.',
      severity: 'positive',
      sourceRefs: [S.bern],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '월요일 유동성 운영',
      prompt: '개장 전 무엇을 실행하시겠습니까? (최대 2개)',
      when: { flag: 'stay_open' },
      select: { min: 1, max: 2 },
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't6-d1-a',
          label: '확대 PDCF 여력 전액 차입 — 언와인드 전 실행',
          description: '트라이파티 적격 담보 전체를 PDCF에 넣고 한도까지 차입한다.',
          effects: [bankFx.drawFacility({ amount: 999, source: 'PDCF(확대 담보)', rateBp: 225 })],
          expert: {
            rating: 85,
            rationale:
              '9/15 리먼 브로커딜러는 실제로 확대 PDCF에서 $28B를 차입했다(Fed History). 런 중 유동성 과잉이 정답이다.',
            sourceRefs: [S.fhSup, S.fed914],
          },
          consequences: 'PDCF 차입이 실행되어 언와인드가 정상 진행되었습니다.',
          feasibility: { basis: '9/14 담보 확대 시행', sourceRefs: [S.fed914] },
        },
        {
          id: 't6-d1-b',
          label: 'SpinCo 컨소시엄 1차 자금 $5B 수령·확정 매각 대금 결제',
          description: 'SpinCo 자금과 매각 대금을 지주 계좌로 받아 지주 만기를 막는다.',
          requires: { flag: 'badbank_spinoff_agreed' },
          unavailableReason: 'SpinCo가 확정되어 있지 않습니다.',
          effects: [ibFx.fundingOutflow({ amount: -5, label: 'SpinCo 컨소시엄 자금 +5' })],
          expert: {
            rating: 70,
            rationale: '지주 만기는 창구 밖이다. 확정 거래의 현금만 지주를 살린다. 반사실 캐비앳.',
            sourceRefs: [S.fcic, S.ball],
          },
          consequences: '컨소시엄 자금이 입금되었습니다.',
          feasibility: { basis: '반사실 — T4.B 전제' },
        },
        {
          id: 't6-d1-c',
          label: '최소 차입 — 창구 사용 최소화',
          description: '낙인을 우려해 여력을 쓰지 않는다.',
          effects: [],
          expert: {
            rating: 20,
            rationale: '월요일은 시험대다. 여력을 쓰지 않는 것은 시험에 답하지 않는 것이다.',
            sourceRefs: [S.fhSup],
          },
          consequences: '차입하지 않았습니다.',
          feasibility: { basis: '무조치' },
        },
        {
          id: 't6-d1-d',
          label: 'PB 이전 요청 지연으로 현금 보전',
          description: '고객 자산 이전을 늦춘다. 고객보호규칙 위반이며 즉시 폐쇄 사유다.',
          effects: [regulator({ set: 4 }, '고객 자산 이전 지연'), flag('unsafe_act')],
          expert: {
            rating: 0,
            rationale: 'T1.D2.B와 같은 함정. 즉시 R4.',
            sourceRefs: [S.fcic],
          },
          consequences: '지연이 감지되었습니다. SEC가 즉시 개입합니다.',
          trap: true,
          trapExplanation: '고객 자산은 자기 유동성이 아니다.',
          illegal: true,
          irreversible: true,
        },
      ],
    },
    {
      id: 't6-d2',
      title: '월요일 커뮤니케이션',
      prompt: '개장 후 시장과 카운터파티에 무엇을 말하시겠습니까?',
      when: { flag: 'stay_open' },
      dimensions: ['communication'],
      options: [
        {
          id: 't6-d2-a',
          label: '연준 창구 확인 하에 총 가용 유동성 수치 공표',
          description:
            '브로커딜러 PDCF 여력과 풀을 합산해 도주성 조달 대비 %로 공표한다. 여력이 충분할 때만 작동한다.',
          effects: [
            ibFx.verifiableLiquidityDisclosure({
              share: 0.5,
              ciUp: 15,
              ciDown: 10,
              dampen: 0.7,
              amp: 1.5,
              label: '검증된 유동성 공표',
            }),
          ],
          expert: {
            rating: 80,
            rationale:
              '검증 가능한 여력만 신뢰를 만든다(BCBS 144). 확대 창구가 뒷받침하면 작동한다.',
            sourceRefs: [S.bcbs, S.fed914],
          },
          consequences: '수치가 공표되었습니다. 결과는 여력에 달려 있습니다(로그 참조).',
          feasibility: { basis: '보도자료 당일 가능' },
        },
        {
          id: 't6-d2-b',
          label: 'CEO "안정적" 서한 — 수치 없음',
          description: '감정에 호소한다.',
          effects: [confidence(-3, '수치 없는 서한')],
          expert: {
            rating: 20,
            rationale: '수치 없는 안심 메시지는 "숫자를 말할 수 없다"는 신호다.',
            sourceRefs: [S.bcbs],
          },
          consequences: '서한이 나갔습니다. 반응은 냉담합니다.',
          feasibility: { basis: '당일 가능' },
        },
        {
          id: 't6-d2-c',
          label: '침묵',
          description: '아무 말도 하지 않는다.',
          effects: [bankFx.addAmplifier(1.2, '정보 공백')],
          expert: {
            rating: 15,
            rationale: '정보 공백은 추측으로 채워진다(증폭 ×1.2).',
            sourceRefs: [S.bcbs],
          },
          consequences: '침묵했습니다.',
          feasibility: { basis: '무조치' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '언와인드 전에 차입해야 청산은행이 담보를 돌려줍니다. 오늘은 여력을 최대한 쓰는 날입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2008-09-16~19 (화~금) "에필로그"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2008년 9월 16~19일 (화~금)',
  title: '에필로그: AIG·MMF·시스템 보증',
  time: '2008-09-19T09:00:00-04:00',
  entryEffects: [
    {
      id: 't7-runoff-tue',
      when: { flag: 'stay_open' },
      description: '9/16 자금 유출',
      effects: [bankFx.runoffStep({ windowFraction: 1, label: '9/16 유출' })],
    },
    {
      id: 't7-contagion',
      when: { any: [{ flag: 'stay_open' }, { flag: 'sold_with_support' }] },
      description:
        '9/16 AIG $85B 구제·Reserve Primary Fund NAV $0.97 — MMF 런, 무담보 CP 시장 마비 → 신뢰지수 −10',
      effects: [confidence(-10, 'AIG·MMF 런 전이')],
    },
    {
      id: 't7-runoff-wed-thu',
      when: { flag: 'stay_open' },
      description: '9/17~18 자금 유출(2일)',
      effects: [bankFx.runoffStep({ windowFraction: 1.6, label: '9/17~18 유출' })],
    },
    {
      id: 't7-guarantee',
      when: { any: [{ flag: 'stay_open' }, { flag: 'sold_with_support' }] },
      description:
        '9/19 재무부 MMF 보증(ESF $50B)·연준 AMLF — 시스템 보증으로 무담보 조달 안정 → 신뢰지수 +15, 완화 ×0.6',
      effects: [
        confidence(15, 'MMF 보증·AMLF(시스템 조치)'),
        bankFx.setDampener(0.6, '시스템 보증'),
      ],
    },
  ],
  events: [
    {
      id: 't7-news-aig',
      kind: 'newswire',
      outlet: 'Federal Reserve Board',
      time: '화 21:00',
      headline: '연준, AIG에 최대 $85B 대출 — 24개월, 3M LIBOR+850bp, 지분 79.9%',
      body: '13(3)조에 따른 담보부 대출. 리먼과 달리 AIG에는 기관 특정 지원이 이루어졌다.',
      severity: 'critical',
      sourceRefs: [S.aig, S.fhSup],
    },
    {
      id: 't7-news-reserve',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '화 17:00',
      headline: 'Reserve Primary Fund, NAV $0.97 — "브레이크 더 벅", 이틀간 $40B+ 환매',
      body: '$62.5B 규모 MMF가 보유한 리먼 CP $785M을 상각하며 기준가가 $1 아래로 떨어졌다. 기관 프라임 MMF 전반에서 환매가 쏟아지고 CP 시장이 마비되고 있다.',
      severity: 'critical',
      sourceRefs: [S.fcic],
    },
    {
      id: 't7-news-guarantee',
      kind: 'newswire',
      outlet: 'U.S. Treasury / Federal Reserve',
      time: '금 09:00',
      headline: '재무부, MMF 임시 보증 프로그램(ESF 최대 $50B) — 연준 AMLF 신설',
      body: '공모 MMF 전체를 1년간 보증하고, 은행이 MMF에서 ABCP를 매입하도록 비소구 대출을 제공한다. 기관별 대출이 막지 못한 런을 시스템 보증이 멈추었다.',
      severity: 'positive',
      sourceRefs: [S.mmf, S.amlf, S.fhCredit],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      id: 't7-memo-epilogue-fail',
      kind: 'memo',
      when: { flag: 'chapter11' },
      time: '금 18:00',
      from: '관리인',
      to: '전 경영진',
      subject: '파산 첫 주 요약',
      body: '브로커딜러는 9/15 저녁 확대 PDCF에서 $28B를 차입해 결제를 유지했고 곧 매각되었다. 런던 법인은 관리 절차에 들어가 고객 자산이 동결되었다. TED 스프레드는 10/10 4.58%까지 오른다.',
      severity: 'critical',
      sourceRefs: [S.fhSup, S.fdic, S.fcic],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '주 후반의 전략',
      prompt: '시스템 조치가 나온 뒤 어떤 길을 택하시겠습니까?',
      when: { flag: 'stay_open' },
      dimensions: ['policy', 'solvency'],
      options: [
        {
          id: 't7-d1-a',
          label: '은행지주회사 전환 신청 + 전략적 투자자(대형 은행·국부펀드) 협상',
          description:
            '연준 상시 창구·감독 체계로 들어가 독립 IB 모델을 접는다. 신자본이 필요하다.',
          effects: [flag('bhc_applied'), confidence(10, 'BHC 전환·투자자 협상')],
          expert: {
            rating: 70,
            rationale:
              '골드만·모건스탠리가 9/21 BHC로 전환하고 MUFG가 모건스탠리에 투자했다. 독립 IB의 익일물 도매 조달 모델은 끝났다.',
            sourceRefs: [S.fhCredit, S.fcic],
          },
          consequences: 'BHC 전환 신청서가 준비되었습니다. 투자자 협상이 시작되었습니다.',
          feasibility: { basis: '9/21 실제 사례(GS·MS)', sourceRefs: [S.fhCredit] },
        },
        {
          id: 't7-d1-b',
          label: '독립 유지 — 확대 PDCF 의존',
          description: '창구에 기대어 독립 IB 모델을 유지한다.',
          effects: [],
          expert: {
            rating: 35,
            rationale: '창구는 시간을 벌 뿐이다. 도매 조달 모델의 신뢰는 돌아오지 않는다.',
            sourceRefs: [S.fhCredit],
          },
          consequences: '현상 유지를 택했습니다.',
          feasibility: { basis: '무조치' },
        },
        {
          id: 't7-d1-c',
          label: '정부 지원 없이 매각 재시도',
          description: '시장이 진정된 뒤 인수자를 다시 찾는다.',
          effects: [confidence(3, '매각 재시도')],
          expert: {
            rating: 50,
            rationale: '현실적 대안. 협상 기간 동안 유동성은 PDCF로 버틴다.',
            sourceRefs: [S.fcic],
          },
          consequences: '자문사가 후보군을 다시 접촉합니다.',
          feasibility: { basis: '협상 가능' },
        },
      ],
    },
    {
      id: 't7-d2',
      title: '통합 첫 주',
      prompt: '인수 발표 후 첫 주에 무엇을 우선하시겠습니까?',
      when: { flag: 'sold_with_support' },
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't7-d2-a',
          label: '고객 자산·PB 잔고 즉시 이전 보장 공동 발표',
          description: '인수자와 함께 고객 자산 보호를 먼저 말한다.',
          effects: [confidence(5, '고객 자산 보장 발표')],
          expert: {
            rating: 75,
            rationale: '인수 발표 뒤에도 고객은 "내 자산이 어디 있나"를 먼저 묻는다.',
            sourceRefs: [S.fdic],
          },
          consequences: '공동 발표가 나갔습니다.',
          feasibility: { basis: '당일 가능' },
        },
        {
          id: 't7-d2-b',
          label: '통합 작업 대기',
          description: '인수자에게 맡긴다.',
          effects: [],
          expert: {
            rating: 40,
            rationale: '중립적이나 첫 주의 고객 이탈을 막지 못한다.',
            sourceRefs: [S.fdic],
          },
          consequences: '대기합니다.',
          feasibility: { basis: '무조치' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't7-d1',
      text: '9/19 시스템 보증이 MMF 런을 멈춘 것을 보십시오. 기관별 대출은 런을 못 막고, 시스템 보증이 막습니다.',
    },
  ],
}

export const turnsB: T[] = [t4, t5, t6, t7]
