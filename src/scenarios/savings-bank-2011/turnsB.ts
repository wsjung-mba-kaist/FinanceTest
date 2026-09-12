import type { CentralBankState, DialogueStep, Interrupt, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, counter, flag, op, regulator } from '../../engine/fx/common'
import { sbFx } from './fx'
import { S } from './turnsA'

type T = Turn<CentralBankState>

/** 9/16(금) 마감 → 9/18(일) 의결·발표 → 주말 → 9/19(월) 개점. */
export const T6_TICK_LABELS = [
  '9/16 (금) 16:00 영업 마감',
  '9/18 (일) 08:00 임시회의',
  '9/18 (일) 10:00 발표',
  '9/18 (일) 18:00 주말 콜센터',
  '9/19 (월) 09:30 개점',
]
/** 9/16 금요일과 9/19 월요일 창구에 양분되고 일요일은 문의만 남는다 [STYLIZED]. */
export const T6_QUEUE_PROFILE = [0.22, 0.06, 0.12, 0.2, 0.4]

// ---------------------------------------------------------------------------------------------
// T4 — 2011-03-17 (목) "감독강화 방안과 초과 예금"
// ---------------------------------------------------------------------------------------------
export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2011년 3월 17일 (목) 09:00 KST',
  title: '한 달 뒤 — 보호받지 못하는 사람들',
  time: '2011-03-17T09:00:00+09:00',
  entryEffects: [
    {
      id: 't4-decay',
      description: '한 달간 전염 계수 감쇠 (2회)',
      effects: [sbFx.decaySpill('전염 계수 감쇠(1)'), sbFx.decaySpill('전염 계수 감쇠(2)')],
    },
    {
      id: 't4-domin',
      description: '2/22 도민저축은행 영업정지 (외생)',
      effects: [
        sbFx.suspend({
          group: 'peer',
          count: 1,
          deposits: 0.35,
          excessDeposits: 0,
          subDebt: 0,
          payout: 0.25,
          label: '도민저축은행 영업정지',
        }),
      ],
    },
    {
      id: 't4-stabilise',
      description:
        '지역 합동 대책회의와 구조조정기금 매입 예고로 3월 수신이 순유입 전환 (신뢰 +12)',
      effects: [
        confidence(12, '3월 업권 수신 순유입 전환'),
        sbFx.setDampener({ factor: 0.95, reason: '지역 합동 대책', label: '3월 진정' }),
      ],
    },
    {
      id: 't4-market',
      description: '3/17 종가: 국고채 3년 3.66%, 회사채 AA− 4.48%, KOSPI 1,959.03, 원/달러 1,135.3',
      effects: [
        op('market.custom.govt3y', 'set', 366, '국고채 3년 3/17 종가'),
        op('market.custom.corpAa3y', 'set', 448, '회사채 AA− 3년 3/17 종가'),
        op('market.custom.cd91', 'set', 339, 'CD 91일 3/17'),
        op('market.equityIndex', 'set', 1959.03, 'KOSPI 3/17 종가'),
        op('market.fxUsdLocal', 'set', 1135.3, '원/달러 3/17 종가'),
        op('institution.fx.spot', 'set', 1135.3, '원/달러 3/17 종가'),
        op('institution.policy.rateBp', 'set', 300, '한국은행 기준금리 3.00% (3/10 인상)'),
        op('market.policyRateBp', 'set', 300, '한국은행 기준금리 3.00%'),
        sbFx.refresh('3/17 시세 반영'),
      ],
    },
    {
      id: 't4-runoff',
      description: '2/22~3/17 잔여 인출 (약 2영업일분으로 축약 — 3월 수신은 순유입으로 돌아섰다)',
      effects: [sbFx.runoffStep({ days: 2, profile: [1], label: '2/22~3/17 인출' })],
    },
  ],
  events: [
    {
      id: 't4-news-excess',
      kind: 'newswire',
      outlet: '주요 일간지',
      time: '07:00',
      headline: '"5천만원까지만 보호"에 걸린 예금자들 — 후순위채 투자자는 배당 순위 뒤',
      body: '영업정지된 저축은행의 예금자 가운데 보호 한도를 넘는 금액을 맡긴 사람들이 항의를 이어가고 있다. 예금자보호법상 보호 대상은 1인당 원리금 5천만원이며, 초과분은 파산재단 배당으로만 회수된다. 후순위채는 예금이 아니어서 보호 대상이 아니고 변제 순위도 뒤다. 일부는 "은행 창구에서 예금처럼 권유받았다"고 주장한다.',
      severity: 'critical',
      sourceRefs: [S.dpAct, S.excess],
      cardRefs: ['uninsured-deposits-and-run-speed'],
      relatedMetrics: ['excessDeposits', 'subDebt'],
    },
    {
      id: 't4-data-excess',
      kind: 'data',
      time: '09:00',
      title: '정지 기관 비보호 예금·후순위채 (예금보험공사 잠정 집계)',
      rows: [
        { label: '5천만원 초과 예금(누계)', value: '{{metric:excessDeposits}}' },
        { label: '후순위채 잔액(누계)', value: '{{metric:subDebt}}' },
        { label: '영업정지 누계', value: '{{metric:failedBanks}}' },
        { label: '저축은행계정 가용재원', value: '{{metric:usableReserves}}' },
        { label: '정리재원 커버리지', value: '{{metric:guidottiRatio}}' },
      ],
      severity: 'warning',
      sourceRefs: [S.excess, S.dpAct],
      relatedMetrics: ['excessDeposits', 'subDebt', 'usableReserves'],
    },
    {
      id: 't4-reg-supervision',
      kind: 'regulator',
      agency: '금융위원회 · 금융감독원',
      time: '14:00',
      headline: '저축은행 경영 건전화를 위한 감독강화 방안 발표 예정',
      body: '이른바 88클럽(BIS 8% 이상·고정이하여신비율 8% 이하) 저축은행에 대한 개별차주 여신한도 우대를 폐지하고, 후순위채 발행·판매 절차를 손보는 방안이 오늘 오후 발표됩니다. 부동산 관련 여신의 한도 도입도 검토 대상입니다.',
      tone: 'routine',
      severity: 'info',
      sourceRefs: [S.supervision, S.msbAct],
    },
    {
      id: 't4-memo-samhwa',
      kind: 'memo',
      time: '10:30',
      from: '예금보험공사 정리부',
      to: '금융위원회 중소금융과',
      subject: '삼화저축은행 계약이전 완료 — 정리 방식의 선례',
      body: `- 삼화저축은행의 자산·부채가 우량 금융회사로 계약이전되었습니다. 5천만원 이하 예금은 조건 그대로 승계되고, 초과분은 승계 대상이 아닙니다.
- 정리 방식은 예금보험기금의 손실이 최소화되는 방식이어야 합니다. 계약이전이 청산·파산보다 비용이 적으면 계약이전을 택합니다.
- 인수자가 없으면 예금보험공사가 100% 출자한 **가교저축은행**을 세워 일단 넘긴 뒤 나중에 매각하는 방법이 있습니다. 지금 준비해 두면 다음 라운드에서 쓸 수 있습니다.`,
      severity: 'info',
      sourceRefs: [S.dpAct, S.bridge],
      cardRefs: ['fdic-resolution-weekend'],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '5천만원 초과 예금과 후순위채',
      prompt: '보호받지 못하는 예금자와 투자자에게 무엇을 말하시겠습니까?',
      context:
        '법적으로 초과분과 후순위채는 보호 대상이 아닙니다. 정치적으로는 그 사실이 답이 되지 않습니다. 여기서 하는 약속은 다음 라운드의 기대가 됩니다.',
      requiredConcepts: ['uninsured-deposits-and-run-speed', 'crisis-communication'],
      dimensions: ['communication', 'compliance', 'policy'],
      options: [
        {
          id: 't4-d1-a',
          label: '한도는 그대로 적용하고 후순위채는 불완전판매 여부로 다룬다',
          description:
            '보호 한도는 법대로 적용한다. 후순위채는 판매 과정에 문제가 있었는지를 검사와 분쟁조정으로 가린다. 초과 예금은 파산재단 배당 대상임을 안내한다.',
          effects: [sbFx.promiseProtection({ scope: 'mediation', label: '분쟁조정으로 대응' })],
          expert: {
            rating: 72,
            rationale:
              '법을 지키면서 다툴 여지가 있는 부분을 절차로 보내는 현실적인 답이다. 후순위채의 쟁점은 보호 여부가 아니라 **어떻게 팔렸는가**이며, 그 판단은 검사와 분쟁조정, 최종적으로는 법원의 몫이다.',
            historicalNote: '후순위채 불완전판매 문제는 이후 분쟁조정과 소송 절차로 다뤄졌다.',
            sourceRefs: [S.dpAct, S.supervision],
          },
          consequences:
            '검사와 분쟁조정 절차가 안내되었습니다. 항의는 계속되지만 답변에 근거가 생겼습니다.',
          historical: true,
        },
        {
          id: 't4-d1-b',
          label: '한도를 그대로 적용하고 추가 구제는 검토하지 않는다고 못 박는다',
          description: '법이 정한 범위를 반복해 말하고 그 밖의 기대를 차단한다.',
          effects: [sbFx.promiseProtection({ scope: 'legal', label: '법정 범위만 적용' })],
          expert: {
            rating: 50,
            rationale:
              '원칙은 분명하지만 후순위채 판매 과정의 문제까지 함께 닫아 버린다. 판매에 하자가 있었다면 그것은 보호 제도의 문제가 아니라 판매 규제의 문제이고, 그 구분을 하지 않으면 나중에 법원이 대신 한다.',
            sourceRefs: [S.dpAct],
          },
          consequences: '입장이 반복되었습니다. 후순위채 투자자들이 집단 소송을 준비합니다.',
        },
        {
          id: 't4-d1-c',
          label: '5천만원 초과 예금의 전액 보전을 검토하겠다고 발표한다',
          description:
            '정치적 압력이 크고 피해가 실재한다. 초과분까지 보전하는 방안을 검토하겠다고 밝힌다.',
          effects: [sbFx.promiseProtection({ scope: 'full', label: '초과 예금 전액 보전 검토' })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'protectionPledge', gte: 2 },
              description:
                '법적 근거 부재와 도덕적 해이 지적, 정리 소요 확대 (신뢰지수 −10, 예상 소요 ×1.2)',
              effects: [
                confidence(-10, '초과 예금 보전의 법적 근거 부재 지적'),
                op('institution.external.shortTermDebt', 'mul', 1.2, '보전 기대에 따른 소요 확대'),
                counter('forbearanceCost', 0.1),
              ],
            },
          ],
          expert: {
            rating: 12,
            rationale:
              '예금자보호법을 바꾸지 않으면 할 수 없는 약속이고, 바꾸면 모든 부보기관의 보험료가 오른다. 더 중요한 것은 기대의 변화다 — 한 번 초과분을 보전하면 다음 정리에서 그것이 기준선이 되고, 고금리를 좇아 한도를 넘겨 예치할 유인이 제도적으로 생긴다.',
            sourceRefs: [S.dpAct, S.excess],
          },
          consequences:
            '발표 직후 항의는 잦아들었습니다. 국회와 타 업권에서 법적 근거와 재원을 묻는 질의가 이어집니다.',
          trap: true,
          trapExplanation:
            '피해가 실재하고 압력이 크기 때문에 가장 하기 쉬운 약속이다. 그러나 예금보험은 한도가 있기 때문에 작동하는 제도이고, 한도를 사후에 지우면 다음 위기의 인출 유인이 바뀐다.',
          remediationCard: 'uninsured-deposits-and-run-speed',
        },
        {
          id: 't4-d1-d',
          label: '한도는 유지하되 배당 전망·지급 일정을 숫자로 공개하고 판매 검사에 착수한다',
          description:
            '초과 예금의 파산재단 배당 전망과 가지급금·보험금 지급 일정을 기관별로 공개하고, 후순위채 발행·판매 전 과정에 대한 일제 검사를 즉시 시작한다.',
          effects: [
            sbFx.promiseProtection({ scope: 'mediation', label: '분쟁조정·검사 병행' }),
            sbFx.setDampener({
              factor: 0.9,
              reason: '배당 전망·지급 일정 공개',
              label: '숫자 공개',
            }),
            flag('salespractice_review'),
          ],
          expert: {
            rating: 88,
            rationale:
              '보호받지 못하는 사람에게 줄 수 있는 것은 보전이 아니라 **정확한 정보와 절차**다. 얼마를 언제 받을 수 있는지가 숫자로 나오면 불확실성이 줄고, 판매 과정에 하자가 있었다면 검사가 그것을 가린다. 법을 바꾸지 않고도 할 수 있는 최대치다.',
            sourceRefs: [S.dpAct, S.supervision, S.excess],
          },
          consequences:
            '기관별 배당 전망과 지급 일정이 공개되었습니다. 후순위채 판매 전수 검사가 시작되었습니다.',
        },
      ],
    },
    {
      id: 't4-d2',
      title: '감독강화 방안',
      prompt: '오늘 발표할 감독강화 방안에 무엇을 넣으시겠습니까?',
      context:
        '부실의 원인은 부동산 PF 쏠림과 대주주 문제였습니다. 지금 손보지 않으면 남은 저축은행에서 같은 일이 반복됩니다.',
      requiredConcepts: ['regulator-escalation-ladder'],
      dimensions: ['policy', 'compliance'],
      options: [
        {
          id: 't4-d2-a',
          label: '88클럽 여신한도 우대를 폐지하고 부동산 여신 한도를 도입한다',
          description:
            'BIS 8% 이상·고정이하여신비율 8% 이하 저축은행에 주던 개별차주 여신한도 우대를 없애고, 부동산·건설·PF 여신에 한도를 둔다. 후순위채 발행·판매 절차도 손본다.',
          effects: [
            flag('supervision_tightened'),
            counter('reformSteps', 1),
            confidence(2, '감독강화 방안 발표'),
          ],
          expert: {
            rating: 80,
            rationale:
              '쏠림은 한도로만 막힌다. 88클럽 우대는 건전성 지표가 좋은 곳에 더 큰 여신을 허용한 제도였고, 그 지표 자체가 유예와 분류 관행으로 부풀려질 수 있었다는 것이 이 사태가 보여 준 것이다.',
            historicalNote:
              '2011년 3월 17일 금융위원회·금융감독원이 발표한 감독강화 방안에 88클럽 개별차주 여신한도 우대 폐지가 포함되었다.',
            sourceRefs: [S.supervision, S.msbAct],
          },
          consequences: '감독강화 방안이 발표되었습니다. 업권은 여신 여력 축소를 우려합니다.',
          historical: true,
        },
        {
          id: 't4-d2-b',
          label: '유예했던 적기시정조치를 해제하고 기준대로 집행한다',
          description:
            '유예 중인 기관의 적기시정조치를 모두 해제하고 감독규정 기준대로 경영개선 절차를 진행한다. 유예 요건과 기록을 문서로 남긴다.',
          effects: [
            flag('forbearance_lifted'),
            counter('reformSteps', 1),
            counter('forbearanceCost', -0.12),
            confidence(1, '유예 해제'),
          ],
          expert: {
            rating: 88,
            rationale:
              '유예는 손실을 없애지 않고 키운다. 지금 해제하면 몇 곳이 더 부실 판정을 받지만 그 비용은 오늘의 가격이고, 미루면 9월의 가격이 된다. 실제로 9월 경영진단에서도 13개사 중 6개사가 다시 유예되었다 — 유예를 끊는 결정은 한 번으로 끝나지 않는다.',
            sourceRefs: [S.diagnosis, S.msbAct],
          },
          consequences:
            '유예가 해제되었습니다. 몇 곳이 경영개선요구 단계로 내려갔고, 그만큼 소요가 앞당겨 확정되었습니다.',
        },
        {
          id: 't4-d2-c',
          label: '감독 강화는 시장이 진정된 뒤로 미룬다',
          description: '지금 규제를 조이면 업권이 더 흔들린다. 정리가 끝난 뒤에 제도를 손본다.',
          effects: [
            counter('forbearanceCost', 0.12),
            confidence(1, '규제 강화 유보에 따른 업권 안도'),
          ],
          expert: {
            rating: 15,
            rationale:
              '가장 그럴듯한 순서처럼 보인다. 그러나 "진정된 뒤"는 오지 않고, 그 사이 같은 구조로 여신이 계속 나간다. 규제 공백은 정리 대상을 늘리는 방식으로 스스로를 청구한다.',
            sourceRefs: [S.supervision, S.fsb50],
          },
          consequences: '제도 개선이 보류되었습니다. 업권 여신은 같은 구조로 이어집니다.',
          trap: true,
          trapExplanation:
            '"지금은 때가 아니다"가 가장 오래 반복된 말이다. 쏠림을 만든 제도를 그대로 두면 정리가 끝난 뒤에도 같은 자리에서 다시 시작된다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't4-d2-d',
          label: '예금금리 경쟁을 제한해 조달비용을 낮춘다',
          description: '고금리 경쟁이 부실의 원인이라고 보고 수신금리에 상한을 둔다.',
          effects: [counter('reformSteps', 1), confidence(-1, '금리 규제 논쟁')],
          expert: {
            rating: 40,
            rationale:
              '조달비용은 결과이지 원인이 아니다. 고금리로 모은 돈이 어디로 갔는지가 문제이며, 운용 쪽 한도 없이 조달만 막으면 수신이 다른 업권으로 이동할 뿐이다.',
            sourceRefs: [S.fsb50, S.msbAct],
          },
          consequences: '수신금리 지도가 시행되었습니다. 일부 수신이 다른 업권으로 옮겨 갑니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't4-d1',
      text: '보호받지 못하는 사람에게 법을 반복하는 것과, 얼마를 언제 받는지 알려 주는 것은 다릅니다.',
      cardRefs: ['uninsured-deposits-and-run-speed'],
    },
    {
      level: 3,
      decisionId: 't4-d2',
      text: '유예 계수(정리 소요 가산)를 보십시오. 지금 해제하면 줄고, 미루면 9월에 청구됩니다.',
    },
  ],
  relatedCards: ['uninsured-deposits-and-run-speed', 'fdic-resolution-weekend'],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2011-04-28 (목) "구조조정 특별계정"
// ---------------------------------------------------------------------------------------------

/**
 * T5.D2 대주주 증자 협상 (3단계). 대사는 재구성이며 실제 협상 기록이 아니다.
 * 요구 규모는 `capitalDemandTn`, 이행 기한은 `capitalDeadlineDays`로 이산화되고,
 * **이행 여부는 T6 경영진단 시점의 지연효과가 판정한다** — calibration.md §7.
 */
const t5CapitalSteps: DialogueStep<CentralBankState>[] = [
  {
    id: 't5-d2-open',
    lines: [
      {
        speaker: '저축은행 대주주 측 대리인',
        text: '자구계획은 내겠습니다. 다만 무엇을 요구하시는지부터 정해 주십시오. 증자입니까, 자산 매각입니까, 아니면 나가라는 말씀입니까.',
      },
    ],
    replies: [
      {
        id: 'ask-capital',
        label: '현금 증자를 요구한다',
        next: 't5-d2-amount',
        expert: {
          rating: 80,
          rationale:
            '자본부족은 자본으로만 메워진다. 현금 증자는 이행 여부가 계좌로 확인되므로 가장 검증하기 쉬운 요구다.',
        },
      },
      {
        id: 'ask-asset-sale',
        label: '계열사·자산 매각을 통한 자본확충을 요구한다',
        next: 't5-d2-amount',
        expert: {
          rating: 72,
          rationale:
            '현금이 없는 대주주에게는 현실적인 경로다. 다만 매각은 시장이 받아 줘야 완결되므로 도착 시점이 불확실하다.',
        },
      },
      {
        id: 'ask-exit',
        label: '대주주 지분 매각과 경영권 포기를 요구한다',
        next: 't5-d2-amount',
        expert: {
          rating: 62,
          rationale:
            '부실의 원인이 대주주라면 가장 근본적인 요구다. 그러나 인수자를 찾는 데 시간이 걸리고, 그 사이 기관은 그대로다.',
        },
      },
      {
        id: 'ask-none',
        label: '요구하지 않고 적기시정조치를 그대로 집행한다',
        resolvesTo: 't5-d2-c',
        expert: {
          rating: 58,
          rationale:
            '협상 자체를 하지 않는 것도 선택이다. 자구계획에 기대지 않으면 유예의 유혹도 생기지 않는다.',
        },
      },
    ],
  },
  {
    id: 't5-d2-amount',
    lines: [
      {
        speaker: '금융감독원 저축은행검사국장',
        text: '이 기관들의 자본부족액은 우리 추정으로 8천억원대입니다. 얼마를 요구할지 정해야 자구계획의 승인 기준이 섭니다.',
      },
    ],
    note: '여기서 정한 규모는 9월 경영진단에서 그대로 대조됩니다.',
    replies: commitReplies<CentralBankState>('capitalDemandTn', [0.3, 0.8, 1.5], {
      unit: '조원',
      label: (v) =>
        v === 0.3
          ? '3천억원 — 우선 받을 수 있는 만큼만 요구한다'
          : v === 0.8
            ? '8천억원 — 추정 자본부족액 전액을 요구한다'
            : '1조 5천억원 — 추가 부실까지 감안해 넉넉히 요구한다',
      next: 't5-d2-deadline',
      expert: (v) => ({
        rating: v === 0.8 ? 85 : v === 0.3 ? 40 : 62,
        rationale:
          v === 0.8
            ? '추정 자본부족액과 같은 금액을 요구하면 자구계획의 충분성을 판정할 기준이 생긴다.'
            : v === 0.3
              ? '받아 내기는 쉽지만 자본부족을 메우지 못한다. 부분 증자는 경영진단에서 그대로 미달로 잡힌다.'
              : '협상 결렬 위험이 커지고, 결렬되면 자구계획 없이 9월을 맞는다.',
      }),
    }),
  },
  {
    id: 't5-d2-deadline',
    lines: [
      {
        speaker: '저축은행 대주주 측 대리인',
        text: '금액은 받아들이겠습니다. 그런데 기한은 조금 여유를 주셔야 합니다. 자산을 정리하는 데 시간이 걸립니다.',
      },
    ],
    note: '여기서 정한 기한은 9월 경영진단 전에 자구계획이 도착하는지로 평가됩니다.',
    replies: [
      ...commitReplies<CentralBankState>('capitalDeadlineDays', [30, 60, 120], {
        label: (v) =>
          v === 30
            ? '30일 — 다음 분기 전에 끝낸다'
            : v === 60
              ? '60일 — 경영진단 전에 도착하도록 못 박는다'
              : '120일 — 자율에 맡기고 기한은 느슨하게 둔다',
        resolvesTo: (v) => (v <= 60 ? 't5-d2-a' : 't5-d2-b'),
        expert: (v) => ({
          rating: v === 60 ? 88 : v === 30 ? 78 : 35,
          rationale:
            v === 60
              ? '경영진단 전에 도착하도록 기한을 잡으면 자구계획의 이행 여부가 진단 결과에 반영된다. 강제수단과 기한이 함께 있어야 약정이 약정이 된다.'
              : v === 30
                ? '엄격하지만 실현 가능성이 낮아 결렬 위험이 있다. 결렬 자체가 나쁜 결과는 아니다 — 조치를 앞당기면 된다.'
                : '기한이 없는 약속은 약속이 아니다. 120일이면 경영진단 이후에 도착하므로 진단 결과에 반영되지 않고, 그때 다시 유예의 근거로 쓰인다.',
        }),
        trap: (v) => v === 120,
        trapExplanation: (v) =>
          v === 120
            ? '"기한을 늘려 주면 이행 가능성이 높아진다"는 착각. 기한이 경영진단 이후면 자구계획은 판단 자료가 아니라 유예의 명분이 된다.'
            : undefined,
      }),
      {
        id: 'fund-first',
        label: '증자 대신 예금보험기금 자금지원을 먼저 투입한다',
        resolvesTo: 't5-d2-d',
        expert: {
          rating: 18,
          rationale:
            '대주주가 부담해야 할 손실을 기금이 먼저 떠안는 것이다. 부실의 원인 제공자가 아무것도 내지 않는 정리는 다음 라운드의 행동을 바꾼다.',
        },
        trap: true,
        trapExplanation:
          '가장 빠르고 조용한 해법이지만, 대주주가 손실을 지지 않으면 다음 저축은행의 대주주도 같은 계산을 한다. 기금은 최후의 수단이지 최초의 수단이 아니다.',
      },
    ],
  },
]

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2011년 4월 28일 (목) 09:00 KST',
  title: '누가 비용을 대는가',
  time: '2011-04-28T09:00:00+09:00',
  entryEffects: [
    {
      id: 't5-decay',
      description: '전염 계수 감쇠 (2회)',
      effects: [sbFx.decaySpill('전염 계수 감쇠(1)'), sbFx.decaySpill('전염 계수 감쇠(2)')],
    },
    {
      id: 't5-market',
      description: '4/28 종가: 국고채 3년 3.79%, 회사채 AA− 4.58%, KOSPI 2,208.35, 원/달러 1,071.2',
      effects: [
        op('market.custom.govt3y', 'set', 379, '국고채 3년 4/28 종가'),
        op('market.custom.corpAa3y', 'set', 458, '회사채 AA− 3년 4/28 종가'),
        op('market.equityIndex', 'set', 2208.35, 'KOSPI 4/28 종가'),
        op('market.fxUsdLocal', 'set', 1071.2, '원/달러 4/28 종가'),
        op('institution.fx.spot', 'set', 1071.2, '원/달러 4/28 종가'),
        sbFx.refresh('4/28 시세 반영'),
      ],
    },
    {
      id: 't5-runoff',
      description: '3/18~4/28 잔여 인출 (약 2영업일분으로 축약 — 4월 수신은 소폭 증가)',
      effects: [sbFx.runoffStep({ days: 2, profile: [1], label: '3/18~4/28 인출' })],
    },
  ],
  events: [
    {
      id: 't5-reg-act',
      kind: 'regulator',
      agency: '금융위원회',
      time: '08:30',
      headline: '예금자보호법 개정 시행 — 상호저축은행 구조조정 특별계정 설치',
      body: '예금보험기금 안에 한시적인 상호저축은행 구조조정 특별계정이 설치되었습니다. 특별계정의 수입은 정부 출연금, 부보금융기관이 납부하는 연간 보험료의 45퍼센트에 해당하는 보험료, 그리고 해당 보험료분의 연체료 등입니다. 2011년 1월 1일 이후 발생한 보험사고와 관련된 자산·부채부터 상호저축은행계정에서 특별계정으로 이전할 수 있습니다.',
      tone: 'routine',
      severity: 'positive',
      sourceRefs: [S.dpAct2011],
      relatedMetrics: ['specialAccountTn', 'usableReserves'],
    },
    {
      id: 't5-memo-cost',
      kind: 'memo',
      time: '09:30',
      from: '예금보험공사 기금관리부',
      to: '금융위원회 구조개선정책과',
      subject: '특별계정 소요 추정 — 무엇을 전제로 하느냐에 따라 달라집니다',
      body: `- 지금까지 정지된 기관만 기준으로 하면 소요는 제한적입니다. 문제는 **아직 정지되지 않은 기관**입니다.
- 현재 자본부족 추정은 {{metric:capitalShortfall}}이고, 향후 1년 예상 정리소요는 {{metric:resolutionNeed}}입니다. 적기시정조치를 유예한 기관이 있으면 그만큼 늘어납니다.
- 전 업권 보험료의 45%를 전입하는 구조는 다른 업권의 반발을 부를 수 있습니다. 저축은행 스스로 부담하게 하면 업권이 더 빨리 무너집니다.
- 존속기한과 상환계획을 법에 명시하지 않으면, 이 계정은 "한시"라는 이름으로 오래 남습니다.`,
      severity: 'warning',
      sourceRefs: [S.dpAct2011, S.whitebook],
      relatedMetrics: ['capitalShortfall', 'shortTermDebt'],
    },
    {
      id: 't5-news-inquiry',
      kind: 'newswire',
      outlet: '주요 일간지',
      time: '07:30',
      headline: '국회, 저축은행 국정조사 추진 — 영업정지 직전 인출이 쟁점',
      body: '영업정지 직전에 일부 예금이 빠져나간 경위와 감독이 왜 부실을 걸러내지 못했는지가 조사 대상으로 거론된다. 여야는 국정조사계획서 처리를 협의 중이다.',
      severity: 'warning',
      sourceRefs: [S.inquiry],
    },
    {
      id: 't5-call-industry',
      kind: 'call',
      time: '11:00',
      caller: '타 업권 협회 임원',
      callee: '금융위원회 구조개선정책과장',
      agency: '금융협회',
      tone: 'concerned',
      lines: [
        {
          speaker: '타 업권 협회 임원',
          text: '왜 우리 회원사의 보험료로 저축은행 부실을 메웁니까. 우리는 그 대출에 관여한 적이 없습니다.',
        },
        {
          speaker: '구조개선정책과장',
          text: '예금보험은 하나의 기금입니다. 한 업권의 지급불능이 전체 제도의 신뢰를 흔들면 비용은 결국 모두가 냅니다.',
        },
        {
          speaker: '타 업권 협회 임원',
          text: '그렇다면 최소한 언제까지인지, 얼마를 갚을 것인지는 법에 써 주십시오.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.dpAct2011],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '특별계정 재원 설계',
      prompt: '구조조정 비용을 누가 어떻게 부담하도록 설계하시겠습니까?',
      context:
        '저축은행계정만으로는 감당할 수 없습니다. 재정, 전 업권 보험료, 저축은행 자체 부담 — 셋 중 어떤 조합이든 누군가는 낸다는 사실은 변하지 않습니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['policy', 'liquidity'],
      options: [
        {
          id: 't5-d1-a',
          label: '전 업권 보험료의 45%를 특별계정에 전입한다',
          description:
            '정부 출연금과 부보금융기관 연간 보험료의 45%를 특별계정 수입으로 하고, 저축은행분은 전액 전입한다. 2011년 1월 1일 이후 보험사고분부터 이전한다.',
          effects: [
            sbFx.specialAccount({
              stage: 'agreed',
              committed: 15,
              draw: 4.5,
              label: '특별계정 설치·재원 확보',
            }),
            flag('special_account_agreed'),
          ],
          expert: {
            rating: 82,
            rationale:
              '실제로 만들어진 구조다. 예금보험을 하나의 제도로 보면 업권 간 분담은 정당화되고, 저축은행 스스로 부담하게 하면 업권이 더 빨리 무너진다. 다만 "한시"라는 이름이 얼마나 한시인지는 법에 쓰인 대로만 지켜진다.',
            historicalNote:
              '예금자보호법은 2011년 3월 29일 공포·4월 1일 시행으로 상호저축은행 구조조정 특별계정을 설치했고, 재원은 정부 출연금과 전 업권 보험료의 45%였다.',
            sourceRefs: [S.dpAct2011],
          },
          consequences:
            '특별계정이 가동되었습니다. 저축은행계정 가용재원이 늘었고, 타 업권의 의견서가 접수되었습니다.',
          historical: true,
        },
        {
          id: 't5-d1-b',
          label: '정부 재정으로 공적자금을 조성한다',
          description:
            '국회 동의를 받아 재정에서 공적자금을 조성한다. 규모는 가장 크지만 절차가 가장 길다.',
          effects: [
            sbFx.specialAccount({
              stage: 'negotiating',
              committed: 15,
              draw: 1.5,
              label: '공적자금 조성 협의',
            }),
            counter('fiscalRoute', 1),
          ],
          expert: {
            rating: 45,
            rationale:
              '부담 주체가 가장 명확하고 규모도 확실하지만, 국회 동의와 예산 절차 동안 정리는 멈추지 않는다. 재원이 늦게 도착하면 그 공백이 곧 유예의 명분이 된다.',
            sourceRefs: [S.dpAct2011],
          },
          consequences:
            '공적자금 조성 협의가 시작되었습니다. 이번 분기 안에는 결론이 나기 어렵습니다.',
        },
        {
          id: 't5-d1-c',
          label: '저축은행 업권 보험료만 인상해 스스로 부담하게 한다',
          description:
            '원인을 제공한 업권이 부담해야 한다는 원칙에 따라 저축은행 예금보험료율만 대폭 올린다.',
          effects: [
            sbFx.specialAccount({
              stage: 'negotiating',
              committed: 6,
              draw: 0.8,
              label: '업권 자체 부담',
            }),
            sbFx.adjustContagion({
              factor: 1.1,
              reason: '보험료 부담으로 업권 수익성 악화',
              groups: ['peer'],
              label: '업권 부담 가중',
            }),
          ],
          expert: {
            rating: 25,
            rationale:
              '원칙으로는 깔끔하지만 산술이 맞지 않는다. 정리 소요는 업권 전체 이익보다 크고, 보험료를 올리면 남은 저축은행의 수익성이 떨어져 다음 부실을 앞당긴다. 부담 원칙과 지급 능력은 다른 문제다.',
            sourceRefs: [S.dpAct2011, S.fsb50],
          },
          consequences: '저축은행 보험료율이 인상되었습니다. 업권 수익성 전망이 낮아졌습니다.',
          trap: true,
          trapExplanation:
            '"원인을 제공한 업권이 부담한다"는 원칙이 가장 공정하게 들린다. 그러나 정리 소요가 업권 전체의 이익보다 크면 그 원칙은 산술적으로 성립하지 않고, 보험료 인상은 남은 저축은행의 다음 부실을 앞당긴다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't5-d1-d',
          label: '45% 전입에 존속기한·상환계획과 재정 분담 근거를 함께 법에 명시한다',
          description:
            '전 업권 보험료 45% 전입에 더해, 특별계정의 존속기한과 상환계획을 법에 못 박고, 소요가 예상을 넘을 때 재정이 분담하는 근거를 함께 둔다.',
          effects: [
            sbFx.specialAccount({
              stage: 'agreed',
              committed: 15,
              draw: 5.0,
              label: '특별계정 설치·존속기한 명시',
            }),
            flag('special_account_agreed'),
            flag('sunset_defined'),
            confidence(2, '존속기한과 상환계획 명시'),
          ],
          expert: {
            rating: 90,
            rationale:
              '재원 구조는 실제와 같되, 이 제도가 뒤에 남긴 문제 하나를 미리 막는다 — 존속기한과 상환계획이 법에 없으면 "한시"는 계속 연장된다. 소요가 예상을 넘을 경우의 분담 근거를 함께 두면, 초과분이 발생했을 때 다시 입법을 기다리지 않아도 된다.',
            sourceRefs: [S.dpAct2011],
          },
          consequences:
            '존속기한과 상환계획이 법에 명시되었습니다. 타 업권은 "끝이 있다면 받아들이겠다"고 답했습니다.',
          calibrationNote: '역사 경로(a)보다 인출 재원 0.5조 추가 — 합의 속도 차이 [CAL]',
        },
      ],
    },
    {
      id: 't5-d2',
      title: '대주주 자구계획 협상',
      prompt: '대주주에게 무엇을, 언제까지 요구하시겠습니까?',
      context:
        '자본부족을 메우는 방법은 둘뿐입니다 — 대주주가 넣거나 기금이 넣거나. 협상의 결과는 9월 경영진단에서 숫자로 확인됩니다.',
      requiredConcepts: ['regulator-escalation-ladder'],
      dimensions: ['compliance', 'communication'],
      select: { min: 1, max: 1 },
      steps: t5CapitalSteps,
      options: [
        {
          id: 't5-d2-a',
          label: '규모와 기한을 서면 약정으로 받고 미이행 시 조치를 예고한다',
          description:
            '자구계획을 서면 약정으로 받고 이행 기한을 감독규정상 조치와 연계한다. 기한 내 미이행이면 적기시정조치가 자동으로 진행된다.',
          effects: [flag('capital_agreement_written'), counter('capitalAgreement', 1)],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'capitalDeadlineDays', lte: 60 },
              description: '경영진단 전에 자구계획 일부가 도착 (저축은행계정 +0.6조, 신뢰지수 +4)',
              effects: [
                sbFx.specialAccount({ stage: 'agreed', draw: 0.6, label: '자구계획 이행분 도착' }),
                confidence(4, '자구계획 이행분 도착'),
              ],
            },
            {
              afterTurns: 1,
              when: { counter: 'capitalDemandTn', lt: 0.8 },
              description: '요구 규모가 자본부족액에 미달해 진단에서 그대로 드러남 (신뢰지수 −4)',
              effects: [confidence(-4, '자구계획 규모 미달')],
            },
          ],
          expert: {
            rating: 85,
            rationale:
              '약정에 기한과 강제수단이 함께 있으면 자구계획은 판단 자료가 된다. 없으면 명분이 된다.',
            sourceRefs: [S.msbAct, S.finAct],
          },
          consequences:
            '서면 약정이 체결되었습니다. 이행 기한과 미이행 시 조치가 함께 기재되었습니다.',
        },
        {
          id: 't5-d2-b',
          label: '규모는 받되 이행 기한은 자율에 맡긴다',
          description: '자구계획을 제출받되 기한은 대주주의 사정에 맡긴다. 협상은 원만하게 끝난다.',
          effects: [flag('capital_agreement_soft'), counter('capitalAgreement', 1)],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'capitalDeadlineDays', gte: 120 },
              description:
                '기한이 경영진단 이후여서 자구계획이 도착하지 않음 (정리 소요 가산 +0.10, 신뢰지수 −6)',
              effects: [
                counter('forbearanceCost', 0.1),
                confidence(-6, '자구계획 미도착'),
                sbFx.adjustContagion({
                  factor: 1.1,
                  reason: '자구계획 미이행',
                  groups: ['peer'],
                }),
              ],
            },
            {
              afterTurns: 1,
              when: { counter: 'capitalDemandTn', lt: 0.8 },
              description: '요구 규모가 자본부족액에 미달해 진단에서 그대로 드러남 (신뢰지수 −4)',
              effects: [confidence(-4, '자구계획 규모 미달')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '실제로 반복된 형태다. 자구계획은 제출되었으나 이행을 강제할 수단과 기한이 없었고, 그 계획은 경영진단 시점에 적기시정조치를 다시 유예하는 근거가 되었다.',
            historicalNote:
              '2011년 9월 경영진단에서 BIS 5% 미만 또는 부채초과로 판정된 13개사 가운데 6개사는 영업정지 대신 적기시정조치가 유예되었다.',
            sourceRefs: [S.diagnosis, S.msbAct],
          },
          consequences: '자구계획이 제출되었습니다. 이행 기한은 명시되지 않았습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '협상이 원만하게 끝나는 것이 성과처럼 보인다. 그러나 기한과 강제수단이 없는 자구계획은 이행을 담보하지 않고, 다음 판단 시점에 "계획이 진행 중"이라는 유예의 근거로 되돌아온다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't5-d2-c',
          label: '협상 없이 적기시정조치를 기준대로 집행한다',
          description: '자구계획에 기대지 않고 감독규정 기준대로 경영개선 절차를 진행한다.',
          effects: [flag('pca_enforced'), counter('forbearanceCost', -0.08)],
          expert: {
            rating: 62,
            rationale:
              '유예의 여지를 없애는 가장 확실한 방법이지만, 대주주가 낼 수 있었을 자본까지 포기하는 것이다. 기금 부담이 그만큼 커진다.',
            sourceRefs: [S.msbAct],
          },
          consequences:
            '적기시정조치가 기준대로 집행되었습니다. 대주주 측은 협상 중단을 통보했습니다.',
        },
        {
          id: 't5-d2-d',
          label: '증자 대신 예금보험기금 자금지원을 먼저 투입한다',
          description: '기금이 먼저 자본을 넣어 기관을 정상화한 뒤 매각한다.',
          effects: [
            sbFx.supportFund({
              amount: 1.0,
              reason: '대주주 증자 대신 기금 선투입',
              label: '기금 선투입',
            }),
            flag('fund_before_owner'),
          ],
          expert: {
            rating: 18,
            rationale:
              '부실의 원인 제공자가 손실을 지지 않는 정리다. 최소비용 원칙에도 어긋나며, 다음 저축은행의 대주주가 같은 계산을 하게 만든다.',
            sourceRefs: [S.dpAct, S.msbAct],
          },
          consequences: '기금이 먼저 투입되었습니다. 대주주 지분은 그대로 남았습니다.',
          trap: true,
          trapExplanation:
            '가장 빠르고 조용하지만, 손실 분담 순서를 뒤집는 순간 제도가 바뀐다. 기금은 최후의 수단이지 최초의 수단이 아니다.',
          remediationCard: 'fdic-resolution-weekend',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't5-d1',
      text: '"한시"라는 이름은 법에 쓰인 기한만큼만 한시입니다.',
    },
    {
      level: 3,
      decisionId: 't5-d2',
      text: '기한이 경영진단 이후면 자구계획은 판단 자료가 아니라 유예의 명분이 됩니다.',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'regulator-escalation-ladder'],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2011-09-16 (금) ~ 09-19 (월) "경영진단과 2차 영업정지" · 틱 5
// ---------------------------------------------------------------------------------------------

/** 발표 직전 국회 정무위원회 의원실의 연락. 대사는 재구성이며 실제 통화가 아니다. */
const t6AssemblyCall: Interrupt<CentralBankState> = {
  id: 't6-i1-assembly',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 50,
  defaultOptionId: 't6-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '국회 정무위원회 의원실',
  prompt: '발표 직전 의원실에서 연락이 왔습니다. 무엇을 답하시겠습니까?',
  dimensions: ['communication', 'compliance'],
  source: {
    kind: 'regulator',
    caller: '국회 정무위원회 의원실 보좌관',
    agency: '국회',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '정무위원회 보좌관',
      text: '오늘 발표에 두 가지를 넣어 주셔야 합니다. 하나는 5천만원 초과 예금자 구제책이고, 다른 하나는 지난 2월에 명단이 왜 사전에 돌았느냐에 대한 답입니다. 둘 다 국정감사에서 다시 물을 겁니다.',
    },
  ],
  options: [
    {
      id: 't6-i1-a',
      label: '법이 정한 보호 범위를 설명하고 유출 의혹은 조사·수사 결과에 따르겠다고 답한다',
      description:
        '보호 한도와 가지급금 절차를 다시 설명하고, 영업정지 직전 인출에 대해서는 진행 중인 조사와 수사의 결과에 따르겠다고 답한다.',
      effects: [counter('assemblyAnswered', 1)],
      expert: {
        rating: 62,
        rationale:
          '어느 쪽도 단정하지 않는 답이고 제도적으로 안전하다. 다만 "따르겠다"만으로는 당국이 스스로 무엇을 확인했는지가 남지 않는다.',
        sourceRefs: [S.inquiry, S.dpAct],
      },
      consequences: '답변이 전달되었습니다. 보좌관은 "국정감사에서 다시 묻겠다"고 했습니다.',
      historical: true,
    },
    {
      id: 't6-i1-b',
      label: '5천만원 초과 예금의 전액 보전을 긍정적으로 검토하겠다고 답한다',
      description: '정치적 압력을 완화하고 오늘 발표의 충격을 줄인다.',
      effects: [sbFx.promiseProtection({ scope: 'full', label: '초과 예금 보전 시사(국회 답변)' })],
      expert: {
        rating: 12,
        rationale:
          '법을 바꾸지 않으면 할 수 없는 약속을 공식 답변으로 남기는 것이다. 발표 당일의 반응은 좋아지지만 다음 정리의 기준선이 바뀐다.',
        sourceRefs: [S.dpAct, S.excess],
      },
      consequences: '검토 방침이 전달되었습니다. 오후 발표 전에 이미 기사가 나갔습니다.',
      trap: true,
      trapExplanation:
        '국회 답변은 발표문보다 오래 남는다. 보호 한도를 사후에 지우겠다는 말은 한 번으로 끝나지 않는다.',
      remediationCard: 'uninsured-deposits-and-run-speed',
    },
    {
      id: 't6-i1-c',
      label: '정지 직전 대량 인출에 대한 자체 조사 결과를 공개하고 수사를 의뢰하겠다고 밝힌다',
      description:
        '보유하고 있는 계좌별 인출 기록을 근거로 확인된 사실의 범위를 공개하고, 판단이 필요한 부분은 수사기관에 넘기겠다고 밝힌다. 보호 범위는 법대로 설명한다.',
      effects: [
        counter('assemblyAnswered', 1),
        flag('leak_investigation_announced'),
        confidence(3, '정지 직전 인출에 대한 자체 조사 공개'),
      ],
      expert: {
        rating: 88,
        rationale:
          '감독당국이 스스로 무엇을 확인했는지 밝히는 것이 신뢰를 회복하는 유일한 경로다. 확인한 사실만 말하고 판단은 수사와 국정조사에 넘기면, 단정하지 않으면서도 책임을 지는 답이 된다.',
        sourceRefs: [S.inquiry, S.msbAct],
      },
      consequences: '자체 조사 결과의 범위와 수사 의뢰 방침이 발표 자료에 포함되었습니다.',
    },
    {
      id: 't6-i1-d',
      label: '답변을 유보한다',
      description: '오늘은 발표에 집중하고 답변은 나중에 한다.',
      effects: [confidence(-3, '국회 질의에 대한 무응답')],
      expert: {
        rating: 30,
        rationale: '오늘 하루는 벌지만, 답하지 않은 질문은 국정감사에서 더 큰 형태로 돌아온다.',
        sourceRefs: [S.inquiry],
      },
      consequences: '답변이 유보되었습니다. 의원실이 자료 제출을 공식 요구했습니다.',
    },
  ],
}

export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2011년 9월 16일 (금) ~ 9월 19일 (월)',
  title: '경영진단과 2차 영업정지',
  time: '2011-09-16T16:00:00+09:00',
  ticks: 5,
  tickLabels: T6_TICK_LABELS,
  entryEffects: [
    {
      id: 't6-decay',
      description: '전염 계수 감쇠 (2회)',
      effects: [sbFx.decaySpill('전염 계수 감쇠(1)'), sbFx.decaySpill('전염 계수 감쇠(2)')],
    },
    {
      id: 't6-gyeongeun',
      description: '8/5 경은저축은행 영업정지 (외생) — BIS △2.83%, 부채 자산 초과 △141억원',
      effects: [
        sbFx.suspend({
          group: 'peer',
          count: 1,
          deposits: 0.2,
          excessDeposits: 0,
          subDebt: 0,
          payout: 0.2,
          label: '경은저축은행 영업정지',
        }),
      ],
    },
    {
      id: 't6-diagnosis',
      description:
        '85개사 경영진단 결과 — BIS 5% 미만 또는 부채초과 13개사, 업권 평균 BIS 5.6%(6월말)',
      effects: [
        sbFx.setSectorStress({
          bisSector: 5.6,
          distressed: 13,
          capitalShortfall: 3.2,
          label: '경영진단 결과 반영',
        }),
        confidence(-5, '경영진단 결과 공표'),
      ],
    },
    {
      id: 't6-market',
      description: '개장 앵커: 국고채 3년 3.40%, 회사채 AA− 4.20%, KOSPI 1,840.10, 원/달러 1,112.5',
      effects: [
        op('market.custom.govt3y', 'set', 340, '국고채 3년 9/16 종가'),
        op('market.custom.corpAa3y', 'set', 420, '회사채 AA− 3년 9/16 종가'),
        op('market.custom.cd91', 'set', 358, 'CD 91일 9/16'),
        op('market.equityIndex', 'set', 1840.1, 'KOSPI 9/16 종가'),
        op('market.fxUsdLocal', 'set', 1112.5, '원/달러 9/16 종가'),
        op('institution.fx.spot', 'set', 1112.5, '원/달러 9/16 종가'),
        op('institution.policy.rateBp', 'set', 325, '한국은행 기준금리 3.25% (6/10 인상)'),
        op('market.policyRateBp', 'set', 325, '한국은행 기준금리 3.25%'),
        sbFx.refresh('9/16 시세 반영'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't6-runoff-tick',
      description: '9/16 금요일과 9/19 월요일의 창구 인출 (2영업일)',
      effects: [sbFx.runoffStep({ days: 2, profile: T6_QUEUE_PROFILE, label: '9/16~9/19 인출' })],
    },
  ],
  ticker: {
    series: [
      // 국고채 3년 9/16 3.40% → 9/19 3.51% [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [340, 342, 345, 348, 351] },
      // 회사채 AA− 3년 9/16 4.20% → 9/19 4.31% [ecos-817Y002]
      { path: 'market.custom.corpAa3y', mode: 'absolute', values: [420, 423, 426, 429, 431] },
      // KOSPI 9/16 1,840.10 → 9/19 1,820.94 [ecos-802Y001]
      {
        path: 'market.equityIndex',
        mode: 'absolute',
        values: [1840.1, 1836.0, 1831.0, 1826.0, 1820.94],
      },
      // 원/달러 9/16 1,112.5 → 9/19 1,137.0 (종가 15:30) [ecos-731Y003]
      {
        path: 'market.fxUsdLocal',
        mode: 'absolute',
        values: [1112.5, 1118.0, 1124.0, 1130.0, 1137.0],
      },
    ],
  },
  events: [
    {
      id: 't6-data-diagnosis',
      kind: 'data',
      time: '16:00',
      atTick: 0,
      title: '경영진단 결과 (85개사, 7.5~8.19)',
      rows: [
        { label: '진단 대상', value: '6월말 영업 중 98개사 중 85개사' },
        { label: '투입 인력', value: '금감원·예보·회계법인 338명, 20개 공동진단반' },
        { label: 'BIS 5% 미만 또는 부채초과', value: '13개사' },
        { label: '업권 평균 BIS(6월말)', value: '5.6%' },
        { label: '자본부족 추정', value: '{{metric:capitalShortfall}}' },
        { label: '저축은행계정 가용재원', value: '{{metric:usableReserves}}' },
      ],
      severity: 'critical',
      sourceRefs: [S.diagnosis],
      relatedMetrics: ['distressedBanks', 'capitalShortfall', 'usableReserves'],
    },
    {
      id: 't6-memo-thirteen',
      kind: 'memo',
      time: '08:00',
      atTick: 1,
      from: '금융감독원 저축은행검사국',
      to: '금융위원회 중소금융과',
      subject: '13개사 처리 방안 — 무엇을 정지하고 무엇을 유예할 것인가',
      body: `- 13개사 가운데 **자체 정상화 가능성이 없다고 판단되는 곳은 7개사**입니다. 나머지 6개사는 자구계획이 진행 중이라는 이유로 유예 의견이 올라와 있습니다.
- 유예하면 오늘의 충격은 줄지만, 지난 2월에 확인한 대로 그 비용은 정리하는 날에 청구됩니다. 현재 유예 가산은 정리 소요에 그대로 반영되고 있습니다.
- 7개사의 5천만원 초과 순예금은 약 1,560억원(약 25,535명, 9.15 기준), 후순위채는 공모 2,082억원(사모 포함 2,232억원, 약 7,571명)입니다.
- 가지급금은 D+4일부터 한도 내에서 지급 가능합니다. 구조조정기금 증액과 PF채권 추가 매입이 함께 발표될 예정입니다.`,
      severity: 'critical',
      sourceRefs: [S.diagnosis, S.pfFund],
      relatedMetrics: ['excessDeposits', 'subDebt'],
    },
    {
      id: 't6-reg-decision',
      kind: 'regulator',
      agency: '금융위원회',
      time: '10:00',
      atTick: 2,
      headline: '임시회의 — 부실금융기관 결정 및 경영개선명령',
      body: '일요일 오전 임시회의에서 조치가 의결되었습니다. 영업정지 기간은 6개월이며, 45일 내 유상증자 등 자체 정상화 기회가 부여됩니다. 가지급금은 D+4일부터 한도 내에서 지급됩니다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.sept7, S.diagnosis],
      relatedMetrics: ['failedBanks'],
    },
    {
      id: 't6-news-monday',
      kind: 'newswire',
      outlet: '통신사',
      time: '09:30',
      atTick: 4,
      headline: '월요일 개점 — 정지되지 않은 저축은행 창구에도 문의 이어져',
      body: '주말 사이 발표된 조치의 대상이 아닌 저축은행에도 문의가 이어지고 있다. 경영진단에서 유예된 기관이 어디인지는 공개되지 않았고, 예금자들은 "우리 저축은행은 어디에 해당하느냐"를 묻고 있다.',
      severity: 'warning',
      sourceRefs: [S.diagnosis],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      id: 't6-market-close',
      kind: 'market',
      time: '15:30',
      atTick: 4,
      headline: '월요일 시장',
      items: [
        { label: '국고채 3년', value: '3.51%', change: '+11bp (9/16 대비)' },
        { label: '회사채 AA− 3년', value: '4.31%', change: '+11bp' },
        { label: 'KOSPI', value: '1,820.94', change: '−1.0%' },
        { label: '원/달러', value: '1,137.0', change: '+24.5원' },
      ],
      sourceRefs: [S.ecosRate, S.ecosEq, S.ecosFx],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '2차 영업정지 범위',
      prompt: '경영진단에서 걸린 13개사를 어떻게 처리하시겠습니까?',
      context:
        '자체 정상화가 불가능한 곳은 7개사입니다. 나머지 6개사는 자구계획이 진행 중이라는 이유로 유예 의견이 올라와 있습니다. 2월에 배운 것이 있다면 여기서 쓰십시오.',
      requiredConcepts: ['regulator-escalation-ladder', 'fdic-resolution-weekend'],
      dimensions: ['policy', 'liquidity'],
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't6-d1-a',
      timeLimitSec: 150,
      options: [
        {
          id: 't6-d1-a',
          label: '자체 정상화가 불가능한 7개사를 같은 날 동시에 정지한다',
          description:
            '부실금융기관으로 판정된 7개사에 대해 하나의 의결로 영업정지를 부과하고, 가지급금 일정과 정리 방침을 함께 발표한다.',
          effects: [
            sbFx.suspend({
              group: 'peer',
              count: 7,
              deposits: 3.2,
              excessDeposits: 0.156,
              subDebt: 0.2232,
              payout: 4.2,
              label: '7개사 동시 영업정지',
            }),
          ],
          expert: {
            rating: 85,
            rationale:
              '2월의 교훈이 적용된 형태다. 한 번에 정지하면 "다음은 어디인가"라는 표적이 최소화되고, 대지급 소요도 한 번에 확정된다. 실제로 2011년 9월 18일 일요일 임시회의에서 7개사가 동시에 정지되었다.',
            historicalNote:
              '2011년 9월 18일 일요일 오전 임시회의에서 7개 저축은행이 부실금융기관으로 결정되고 영업정지가 부과되었다.',
            sourceRefs: [S.sept7, S.diagnosis],
          },
          consequences:
            '일곱 곳이 동시에 정지되었습니다. 가지급금 일정과 정리 방침이 같은 자료에 담겼습니다.',
          historical: true,
          irreversible: true,
        },
        {
          id: 't6-d1-b',
          label: '규모가 큰 3개사만 먼저 정지하고 나머지는 자구계획 이행을 본다',
          description:
            '충격을 나눠 받는다. 나머지 네 곳은 자구계획 진행을 보고 다음 분기에 판단한다.',
          effects: [
            sbFx.suspend({
              group: 'peer',
              count: 3,
              deposits: 1.6,
              excessDeposits: 0.078,
              subDebt: 0.112,
              payout: 2.0,
              label: '3개사 우선 영업정지',
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '남겨 둔 기관으로 인출이 옮겨 가 정리 소요가 커짐 (가산 +0.15)',
              effects: [
                counter('forbearanceCost', 0.15),
                confidence(-5, '남은 기관으로 인출 이동'),
              ],
            },
          ],
          expert: {
            rating: 25,
            rationale:
              '2월 17일과 19일 사이에 일어난 일을 그대로 반복하는 선택이다. 정지 기준이 "부실 정도"가 아니라 "규모"가 되면, 남겨 둔 곳이 곧 다음 인출처가 된다.',
            sourceRefs: [S.more4, S.diagnosis],
          },
          consequences:
            '세 곳이 정지되었습니다. 남은 네 곳의 창구에 같은 예금자가 서기 시작했습니다.',
          trap: true,
          trapExplanation:
            '"충격을 나눈다"는 말은 인출도 나눈다는 뜻이 아니다. 나눈 정지는 인출을 남은 곳으로 모을 뿐이다.',
          remediationCard: 'bank-run-dynamics',
          irreversible: true,
        },
        {
          id: 't6-d1-c',
          label: '자구계획 제출을 조건으로 13개사 전부를 유예한다',
          description:
            '모두 자구계획이 진행 중이다. 정지하지 않으면 오늘의 줄도 없다. 45일 뒤에 다시 판단한다.',
          effects: [
            sbFx.forbear({
              count: 13,
              months: 3,
              lossGrowthPerMonth: 0.06,
              label: '13개사 적기시정조치 유예',
            }),
          ],
          expert: {
            rating: 8,
            rationale:
              '2월에 한 번 치른 대가를 다시 치르는 선택이다. 부채가 자산을 초과한 기관을 열어 두면 예금자는 계속 빠져나가고, 남은 자산은 줄어들며, 정지하는 날의 대지급 소요만 커진다.',
            sourceRefs: [S.diagnosis, S.msbAct, S.finAct],
          },
          consequences:
            '유예가 의결되었습니다. 오늘 창구는 조용하고, 자본부족액은 다시 자라기 시작했습니다.',
          trap: true,
          trapExplanation:
            '이 시나리오에서 두 번째로 나오는 같은 유혹이다. 실제로도 13개사 중 6개사는 이때 유예되었다 — 유예는 한 번의 실수가 아니라 반복되는 구조였다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't6-d1-d',
          label: '13개사를 모두 정지해 불확실성을 한 번에 없앤다',
          description: '자구계획 진행 여부와 무관하게 기준에 걸린 모든 기관을 정지한다.',
          effects: [
            sbFx.suspend({
              group: 'peer',
              count: 13,
              deposits: 5.4,
              excessDeposits: 0.156,
              subDebt: 0.2232,
              payout: 6.4,
              label: '13개사 일괄 영업정지',
            }),
          ],
          expert: {
            rating: 40,
            rationale:
              '표적을 없앤다는 점에서는 일관되지만, 자체 정상화가 가능한 기관까지 닫으면 대지급 소요를 스스로 키운다. 기금 잔여가 얼마인지를 먼저 보아야 하는 선택이다.',
            sourceRefs: [S.diagnosis, S.finAct],
          },
          consequences:
            '열세 곳이 정지되었습니다. 대지급 소요가 한꺼번에 확정되었고 기금 잔여가 크게 줄었습니다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't6-d2',
      title: '발표 방식과 예금자 안내',
      prompt: '오늘 발표에 무엇을 함께 담으시겠습니까?',
      context:
        '월요일 개점 전에 예금자가 알아야 할 것은 두 가지입니다 — 내 돈을 언제 받는지, 그리고 내 저축은행은 어떻게 되는지.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication'],
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't6-d2-a',
      options: [
        {
          id: 't6-d2-a',
          label: '명단·가지급금 일정·정리 방침을 같은 자료에 담는다',
          description:
            '정지 기관 명단과 함께 가지급금 지급 개시일, 5천만원 이하 예금의 계약이전 방침, 자체 정상화 기회(45일)를 하나의 자료로 발표한다.',
          effects: [
            flag('full_disclosure_package'),
            sbFx.setDampener({
              factor: 0.88,
              reason: '지급 일정·정리 방침 동시 공표',
              label: '패키지 발표',
            }),
          ],
          expert: {
            rating: 85,
            rationale:
              '조치와 구제 절차를 같은 자료에 담으면 예금자가 다음 행동을 계산할 수 있다. 명단만 나가면 그 공백을 "다음은 어디인가"가 채운다.',
            historicalNote:
              '2011년 9월 18일 발표에는 영업정지와 함께 가지급금 일정(D+4일), 자체 정상화 기회 45일, 구조조정기금 증액이 포함되었다.',
            sourceRefs: [S.sept7, S.diagnosis],
          },
          consequences:
            '발표 자료 하나에 모든 절차가 담겼습니다. 콜센터 문의가 "언제"에서 "어디서"로 바뀌었습니다.',
          historical: true,
        },
        {
          id: 't6-d2-b',
          label: '명단만 공표하고 정리 방식은 추후 발표한다',
          description: '오늘은 조치만 알리고 구제 절차는 정리되는 대로 발표한다.',
          effects: [
            sbFx.adjustContagion({
              factor: 1.15,
              reason: '정리 절차 미공표',
              groups: ['peer', 'sound'],
              label: '절차 공백',
            }),
          ],
          expert: {
            rating: 40,
            rationale:
              '절차를 미루면 그 공백 동안 예금자는 최악을 가정한다. 지급 일정은 이미 법에 정해져 있으므로 미룰 이유가 없다.',
            sourceRefs: [S.dpAct, S.diagnosis],
          },
          consequences: '명단이 발표되었습니다. 문의의 대부분이 "그래서 내 돈은"이었습니다.',
        },
        {
          id: 't6-d2-c',
          label: '추가 정지는 이것으로 끝이라고 다시 단언한다',
          description: '시장의 불안을 끊기 위해 더 이상의 정지는 없다고 말한다.',
          effects: [
            flag('reassurance_given'),
            counter('reassuranceGiven', 1),
            confidence(4, '추가 정지 없음 단언'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { flag: 'more_suspensions' },
              description: '단언이 다시 뒤집힘 (신뢰지수 −15, 전염 ×1.4)',
              effects: [
                confidence(-15, '추가 정지 없다는 단언의 재붕괴'),
                sbFx.adjustContagion({ factor: 1.4, reason: '두 번째로 뒤집힌 약속' }),
                flag('reassurance_contradicted'),
              ],
            },
          ],
          expert: {
            rating: 12,
            rationale:
              '유예된 6개사의 자구계획이 아직 끝나지 않은 상태에서 하는 단언이다. 2월에 같은 문장이 이틀 만에 깨졌다.',
            sourceRefs: [S.stance, S.more4, S.diagnosis],
          },
          consequences: '단언이 발표문에 들어갔습니다. 유예된 기관의 명단은 공개되지 않았습니다.',
          trap: true,
          trapExplanation:
            '같은 실수를 두 번째로 하는 선택이다. 유예한 기관이 남아 있는 한 "끝"이라고 말할 수 있는 근거는 없다.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't6-d2-d',
          label: '주말 콜센터와 임시 창구를 열고 인출 동향을 실시간 공개한다',
          description:
            '주말 내내 콜센터를 열고, 업권 전체의 일별 인출 규모를 매일 공개해 추측을 없앤다.',
          effects: [
            sbFx.setDampener({
              factor: 0.92,
              reason: '주말 콜센터·인출 동향 공개',
              label: '주말 대응',
            }),
            flag('weekend_channel'),
          ],
          expert: {
            rating: 75,
            rationale:
              '수치를 매일 공개하면 소문이 설 자리가 줄어든다. 다만 정리 절차 자체를 대신하지는 못한다.',
            sourceRefs: [S.diagnosis, S.busanMeeting],
          },
          consequences: '콜센터가 주말 내내 운영되고 일별 인출 규모가 공개되었습니다.',
        },
      ],
    },
  ],
  interrupts: [t6AssemblyCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '2월 17일과 19일 사이에 무슨 일이 있었는지 기억하십시오. 남겨 둔 창구가 다음 인출처입니다.',
      cardRefs: ['bank-run-dynamics'],
    },
    {
      level: 3,
      decisionId: 't6-d1',
      text: '유예 가산(정리 소요 배수)과 저축은행계정 잔여를 함께 보십시오. 유예는 오늘이 아니라 정리하는 날에 청구됩니다.',
    },
  ],
  relatedCards: ['regulator-escalation-ladder', 'fdic-resolution-weekend', 'crisis-communication'],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2011-11-23 (수) "가교저축은행과 남은 책임"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2011년 11월 23일 (수) 09:00 KST',
  title: '정리와 책임',
  time: '2011-11-23T09:00:00+09:00',
  entryEffects: [
    {
      id: 't7-decay',
      description: '전염 계수 감쇠 (2회)',
      effects: [sbFx.decaySpill('전염 계수 감쇠(1)'), sbFx.decaySpill('전염 계수 감쇠(2)')],
    },
    {
      id: 't7-market',
      description:
        '11/23 종가: 국고채 3년 3.36%, 회사채 AA− 4.21%, KOSPI 1,783.10, 원/달러 1,152.0',
      effects: [
        op('market.custom.govt3y', 'set', 336, '국고채 3년 11/23 종가'),
        op('market.custom.corpAa3y', 'set', 421, '회사채 AA− 3년 11/23 종가'),
        op('market.equityIndex', 'set', 1783.1, 'KOSPI 11/23 종가'),
        op('market.fxUsdLocal', 'set', 1152.0, '원/달러 11/23 종가'),
        op('institution.fx.spot', 'set', 1152.0, '원/달러 11/23 종가'),
        sbFx.refresh('11/23 시세 반영'),
      ],
    },
    {
      id: 't7-runoff',
      description: '9/20~11/23 잔여 인출 (약 2영업일분으로 축약)',
      effects: [sbFx.runoffStep({ days: 2, profile: [1], label: '9/20~11/23 인출' })],
    },
  ],
  events: [
    {
      id: 't7-memo-bridge',
      kind: 'memo',
      time: '08:30',
      from: '예금보험공사 정리부',
      to: '금융위원회 중소금융과',
      subject: '가교저축은행 준비 완료 — 계약이전 대상 결정 요청',
      body: `- 예금보험공사가 100% 출자한 가교저축은행이 지난달 영업인가를 받았습니다. 인수자를 찾기 전까지 자산·부채를 일단 받아 영업을 잇는 그릇입니다.
- 계약이전은 5천만원 이하 예금 등을 그대로 넘기는 방식입니다. 정리방식은 예금보험기금의 손실이 최소화되는 방식이어야 하므로, **계약이전 비용이 청산·파산보다 적은지**를 기관별로 계산했습니다.
- 현재 저축은행계정 가용재원은 {{metric:usableReserves}}, 정리재원 커버리지는 {{metric:guidottiRatio}}입니다.`,
      severity: 'warning',
      sourceRefs: [S.bridge, S.transfer, S.dpAct],
      cardRefs: ['fdic-resolution-weekend'],
      relatedMetrics: ['usableReserves', 'guidottiRatio'],
    },
    {
      id: 't7-news-inquiry',
      kind: 'newswire',
      outlet: '주요 일간지',
      time: '07:00',
      headline: '국정조사 종료 — 감독 실패와 정지 직전 인출, 결론은 수사로',
      body: '국회 특별위원회의 국정조사가 여름에 마무리되었다. 영업정지 직전의 예금 인출과 감독이 왜 부실을 걸러내지 못했는지가 주된 쟁점이었다. 형사 책임은 수사와 재판에서 가려진다.',
      severity: 'warning',
      sourceRefs: [S.inquiry],
    },
    {
      id: 't7-data-year',
      kind: 'data',
      time: '09:00',
      title: '2011년 누계',
      rows: [
        { label: '영업정지 누계', value: '{{metric:failedBanks}}' },
        { label: '누적 예금 인출', value: '{{metric:depositOutflowCum}}' },
        { label: '5천만원 초과 예금(정지 기관)', value: '{{metric:excessDeposits}}' },
        { label: '후순위채(정지 기관)', value: '{{metric:subDebt}}' },
        { label: '예금보험기금 투입 누계', value: '{{metric:supportCum}}' },
        { label: '특별계정 약정 재원', value: '{{metric:specialAccountTn}}' },
        { label: '적기시정조치 유예 기관', value: '{{metric:forbearanceCount}}' },
      ],
      severity: 'info',
      sourceRefs: [S.excess, S.diagnosis, S.dpAct2011],
      relatedMetrics: ['failedBanks', 'depositOutflowCum', 'supportCum', 'specialAccountTn'],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '정리 방식',
      prompt: '정지된 기관을 어떻게 정리하시겠습니까?',
      context:
        '예금보험기금의 손실이 최소화되는 방식이어야 합니다. 계산은 이미 나와 있습니다 — 남은 것은 그 계산을 따를 것인지입니다.',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'liquidity'],
      options: [
        {
          id: 't7-d1-a',
          label: '가교저축은행으로 계약이전한 뒤 금융지주에 매각한다',
          description:
            '인가를 취소하고 자산·부채를 예금보험공사 100% 출자 가교저축은행으로 계약이전한다. 5천만원 이하 예금은 조건 그대로 승계되고, 가교는 이후 인수자에게 매각한다.',
          effects: [
            sbFx.supportFund({
              amount: 1.4,
              reason: '계약이전·가교 출자',
              label: '계약이전 지원',
            }),
            sbFx.specialAccount({ stage: 'disbursed', draw: 2.0, label: '특별계정 인출' }),
            flag('bridge_resolution'),
            confidence(4, '계약이전으로 예금 승계'),
          ],
          expert: {
            rating: 88,
            rationale:
              '예금보험공사의 분석대로 계약이전이 청산·파산보다 비용이 적으면 최소비용 원칙에 부합한다. 가교는 인수자를 기다리는 동안 영업을 잇는 장치이고, 예금자는 창구가 닫히는 경험을 하지 않는다.',
            historicalNote:
              '2011년 10월 가교저축은행이 영업인가를 받았고, 11월 23일 부산저축은행의 인가가 취소되면서 자산 약 2,029억원·부채 약 2조 5,408억원이 계약이전되었다. 금융위원회는 예금보험공사 분석 결과 계약이전이 청산·파산보다 비용이 적어 최소비용 원칙에 부합한다고 밝혔다.',
            sourceRefs: [S.transfer, S.bridge, S.dpAct],
          },
          consequences:
            '인가가 취소되고 계약이전이 완료되었습니다. 5천만원 이하 예금은 조건 그대로 승계되었습니다.',
          historical: true,
        },
        {
          id: 't7-d1-b',
          label: '청산·파산으로 보내 예금보험금만 지급한다',
          description:
            '인수자도 가교도 쓰지 않고 파산 절차로 보낸다. 예금자는 보험금으로 5천만원까지 받는다.',
          effects: [
            sbFx.supportFund({ amount: 2.1, reason: '파산·보험금 지급', label: '청산 지급' }),
            confidence(-6, '창구 폐쇄와 보험금 지급 지연'),
            flag('liquidation_resolution'),
          ],
          expert: {
            rating: 30,
            rationale:
              '최소비용 원칙은 선택의 자유가 아니라 계산의 결과다. 계약이전이 더 싸다는 분석이 있는데 청산을 택하면 기금 손실이 커지고, 예금자는 보험금 지급까지 기다려야 한다.',
            sourceRefs: [S.dpAct, S.transfer],
          },
          consequences: '파산 절차가 개시되었습니다. 보험금 지급까지 시간이 걸립니다.',
        },
        {
          id: 't7-d1-c',
          label: '정부가 직접 인수해 공적 관리 아래 둔다',
          description: '정부가 지분을 인수해 공적 관리 상태로 운영한다.',
          effects: [
            sbFx.supportFund({ amount: 1.9, reason: '정부 직접 인수', label: '공적 관리' }),
            flag('public_ownership'),
          ],
          expert: {
            rating: 35,
            rationale:
              '가교저축은행이 이미 그 기능을 한다. 별도의 공적 관리 구조를 만들면 출구 전략이 흐려지고, 매각 시점이 정치 일정에 묶인다.',
            sourceRefs: [S.bridge, S.dpAct],
          },
          consequences: '공적 관리가 시작되었습니다. 매각 일정은 정해지지 않았습니다.',
        },
        {
          id: 't7-d1-d',
          label: '인수 후보가 나타날 때까지 영업정지 상태를 유지한다',
          description: '정리 비용을 아끼기 위해 매각 협상이 끝날 때까지 기다린다.',
          effects: [
            counter('forbearanceCost', 0.12),
            confidence(-8, '정리 지연으로 예금자 불확실성 장기화'),
          ],
          expert: {
            rating: 12,
            rationale:
              '영업정지 상태의 기관은 가치가 매일 줄어든다. 예금자는 돈을 쓰지 못하고, 자산은 관리되지 않으며, 인수 후보는 기다릴수록 낮은 값을 부른다.',
            sourceRefs: [S.transfer, S.dpAct],
          },
          consequences: '정리가 미뤄졌습니다. 예금자 민원과 소송이 늘고 있습니다.',
          trap: true,
          trapExplanation:
            '"조금 더 기다리면 더 좋은 조건"이라는 유혹이 마지막으로 한 번 더 나온다. 정지된 기관을 오래 두면 남는 것은 협상력이 아니라 손실이다.',
          remediationCard: 'fdic-resolution-weekend',
        },
      ],
    },
    {
      id: 't7-d2',
      title: '제도 개선',
      prompt: '무엇을 바꾸시겠습니까? (최대 2개)',
      context:
        '국정조사가 끝났고 수사가 진행 중입니다. 이번에 바꾸지 않으면 다음에 같은 자리에서 다시 시작합니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t7-d2-d', 't7-d2-a'],
        ['t7-d2-d', 't7-d2-b'],
        ['t7-d2-d', 't7-d2-c'],
      ],
      requiredConcepts: ['regulator-escalation-ladder'],
      dimensions: ['compliance', 'policy'],
      options: [
        {
          id: 't7-d2-a',
          label: '검사·제재 체계를 개편하고 감독의 독립성·책임성을 제도화한다',
          description:
            '관계부처 합동으로 금융감독 체계를 손본다. 검사 인력과 주기, 제재 절차, 감독기관의 책임 구조를 다시 짠다.',
          effects: [
            flag('supervision_reform'),
            counter('reformSteps', 1),
            confidence(3, '감독체계 개편'),
          ],
          expert: {
            rating: 78,
            rationale:
              '2010년 검사에서 부실이 걸러지지 않았다는 것이 이 사태의 출발점이므로 검사 체계 개편은 필요조건이다. 다만 조직과 절차를 바꾸는 것만으로는 유예를 막지 못한다.',
            historicalNote: '사태 이후 금융감독 체계 개편 논의가 정부 차원에서 진행되었다.',
            sourceRefs: [S.inquiry, S.supervision],
          },
          consequences: '감독체계 개편안이 마련되었습니다.',
          historical: true,
        },
        {
          id: 't7-d2-b',
          label: '적기시정조치 유예의 요건·기록을 법령에 명시하고 국회 보고를 의무화한다',
          description:
            '유예할 수 있는 경우를 한정하고, 유예할 때마다 사유·기간·재무 영향을 기록해 국회에 보고하도록 한다.',
          effects: [
            flag('forbearance_rules'),
            counter('reformSteps', 1),
            counter('forbearanceCost', -0.1),
            confidence(4, '유예 요건 법제화'),
          ],
          expert: {
            rating: 90,
            rationale:
              '이 사태에서 반복된 단 하나의 행위는 유예였다. 2011년 9월 경영진단에서도 13개사 중 6개사가 유예되었고 그 명단은 공개되지 않았다. 유예 자체를 금지할 수는 없지만 — 때로는 옳다 — 요건과 기록을 남기면 유예가 관행이 되지 않는다.',
            sourceRefs: [S.diagnosis, S.msbAct, S.finAct],
          },
          consequences: '유예 요건과 보고 의무가 법령 개정안에 담겼습니다.',
        },
        {
          id: 't7-d2-c',
          label: '대주주 적격성 심사와 대주주 신용공여 금지를 강화한다',
          description:
            '대주주 변경 시 적격성 심사를 강화하고, 특수목적법인을 통한 우회 여신을 대주주 신용공여로 보아 금지 범위를 넓힌다.',
          effects: [
            flag('owner_rules'),
            counter('reformSteps', 1),
            confidence(3, '대주주 규제 강화'),
          ],
          expert: {
            rating: 85,
            rationale:
              '법원이 확정한 사실은 계열이 다수의 특수목적법인에 4조 5,621억원을 대출하게 했다는 것이다. 대주주 신용공여 금지가 있었음에도 우회 경로가 열려 있었다면, 막아야 할 것은 명목이 아니라 실질이다.',
            sourceRefs: ['scourt-2013do6394', S.msbAct],
          },
          consequences: '대주주 규제 강화안이 마련되었습니다.',
        },
        {
          id: 't7-d2-d',
          label: '제도 개선은 수사와 재판 결과가 나온 뒤로 미룬다',
          description: '사실관계가 확정되기 전에 제도를 바꾸면 방향이 틀릴 수 있다.',
          effects: [confidence(-5, '제도 개선 보류'), regulator({ add: 1 }, '제도 개선 보류')],
          expert: {
            rating: 10,
            rationale:
              '수사는 개인의 형사 책임을 가리는 절차이고 제도 개선은 구조를 바꾸는 일이다. 둘은 서로를 기다릴 이유가 없으며, 기다리는 동안 같은 구조가 계속 작동한다.',
            sourceRefs: [S.inquiry, S.supervision],
          },
          consequences: '제도 개선이 보류되었습니다. 국회가 다시 자료 제출을 요구했습니다.',
          trap: true,
          trapExplanation:
            '"사실관계를 확정한 뒤에"는 언제나 합리적으로 들린다. 그러나 이 사태에서 확정이 필요했던 것은 개인의 책임이었고, 구조는 이미 2010년 검사에서도 보였다.',
          remediationCard: 'regulator-escalation-ladder',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't7-d1',
      text: '최소비용 원칙은 선택의 자유가 아니라 계산의 결과입니다.',
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      level: 3,
      decisionId: 't7-d2',
      text: '이 사태에서 반복된 단 하나의 행위가 무엇이었는지 돌아보십시오.',
    },
  ],
  relatedCards: ['fdic-resolution-weekend', 'regulator-escalation-ladder'],
}

export const turnsB: T[] = [t4, t5, t6, t7]
