import type { BankState, Interrupt, Turn } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import { confidence, flag, op } from '../../engine/fx/common'
import { mgFx } from './fx'
import { QUEUE_TICK_LABELS, S } from './turnsA'

type T = Turn<BankState>

/** 7/10 월요일: 다시 줄이 섰으나 하루 종일 고르게 분산 — 가장 완만한 프로필 [STYLIZED]. */
export const T4_QUEUE_PROFILE = [0.28, 0.26, 0.24, 0.22]

/**
 * 10:30 행안부 담당 국장 전화. 대사는 7/10 실무지원단 발표의 공개 기록을 바탕으로 한 **재구성**이며
 * 속기록이 아니다.
 */
const t4MoisCall: Interrupt<BankState> = {
  id: 't4-i1-mois',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't4-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '행안부 담당 국장 전화',
  prompt: '오후 발표문의 보장 문구를 지금 확정해야 합니다. 어떻게 쓰시겠습니까?',
  dimensions: ['communication', 'policy'],
  source: {
    kind: 'regulator',
    caller: '행정안전부 지역경제지원관',
    agency: '행정안전부',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '지역경제지원관',
      text: '실무지원단 발표문 초안이 왔는데 보장 문구가 두 갈래입니다. "정부가 보장한다"로 쓸지, 계약이전 근거를 적고 "전액 지급된다"로 쓸지. 법제처 검토를 받으면 내일로 넘어갑니다.',
    },
  ],
  options: [
    {
      id: 't4-i1-a',
      label: '계약이전 근거를 명시하고 "전액 지급"으로 오늘 발표',
      description:
        '새마을금고법상 합병·계약이전 시 예금이 승계된다는 근거를 문장에 넣고, 재원(예금자보호준비금·필요 시 정부 차입)까지 함께 적는다. 법제처 검토 없이도 근거가 조문이므로 오늘 나갈 수 있다.',
      effects: [flag('pna_wording_legal')],
      expert: {
        rating: 85,
        rationale:
          '방법(P&A)과 재원을 함께 말해야 약속이 검증 가능해진다. 근거가 조문이면 이후 어떤 검사 결과가 나와도 발표가 뒤집히지 않는다.',
        sourceRefs: [S.support, S.kfccAct],
      },
      consequences: '발표문이 확정되었습니다. "P&A 시 전액 지급"이 저녁 뉴스 자막으로 나갑니다.',
      historical: true,
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1, note: '근거 있는 보장' }],
    },
    {
      id: 't4-i1-b',
      label: '"정부가 보장한다"로 단순화해 강하게 쓴다',
      description: '한 문장으로 읽히게 만든다. 법적 근거는 적지 않는다.',
      effects: [flag('pna_wording_broad')],
      delayedEffects: [
        {
          afterTurns: 1,
          description: '"정부 보증의 법적 근거를 밝히라"는 국회 요구 — 신뢰지수 −4',
          effects: [confidence(-4, '포괄 보증 표현의 근거 논란')],
        },
      ],
      expert: {
        rating: 25,
        rationale:
          '새마을금고법상 보호 한도는 5천만원이고 정부 보증에는 국회 동의가 필요하다. 근거 없는 강한 문장은 며칠 안에 검증되고, 검증에 실패하면 이전 약속까지 의심받는다.',
        sourceRefs: [S.kfccAct, S.sb2011],
      },
      consequences: '발표문이 나갔습니다. 야당이 "근거 법령을 밝히라"고 요구했습니다.',
      trap: true,
      trapExplanation:
        '더 강한 말이 더 안전해 보이지만, 근거가 없는 보장은 한 번의 질의로 무너진다. 약속의 힘은 세기가 아니라 검증 가능성에서 나온다.',
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 2, note: '다음 턴 판정' }],
    },
    {
      id: 't4-i1-c',
      label: '법제처 검토 후 내일 발표',
      description: '문구를 다듬어 확실하게 간다. 오늘 오후는 원칙 없이 지나간다.',
      effects: [bankFx.addAmplifier(1.05, '처리 원칙 공백(하루)')],
      expert: {
        rating: 35,
        rationale:
          '신중함의 비용이 하루치 줄이다. "부실이 나오면 어떻게 되나"에 답이 없으면 예금자는 최악(청산)을 가정한다.',
        sourceRefs: [S.fsb],
      },
      consequences: '발표가 내일로 미뤄졌습니다. 기자들이 "그러면 청산이냐"고 묻고 있습니다.',
      preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 1, note: '증폭 ×1.05' }],
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T4 — 2023-07-10 (월) "실무지원단·은행 RP"
// ---------------------------------------------------------------------------------------------
export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2023년 7월 10일 (월) 09:00 KST',
  title: '실무지원단과 은행 RP',
  time: '2023-07-10T09:00:00+09:00',
  ticks: 4,
  tickLabels: QUEUE_TICK_LABELS,
  entryEffects: [
    {
      id: 't4-settle',
      description: '익일 결제 RP 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't4-weekend-press',
      description: '주말 언론(외생): 건설·부동산 대출 집중, 감독체계 논란 → 신뢰지수 −3',
      effects: [confidence(-3, '주말 언론: 부동산 대출 집중·감독체계 논란(외생)')],
    },
    {
      id: 't4-market',
      description: '개장 앵커: 원/달러 1,299.0원, 국고 2년 3.780%, 국고 3년 3.735% (7/7 종가)',
      effects: [
        op('market.fxUsdLocal', 'set', 1299, '7/10 시가'),
        op('market.govt2yBp', 'set', 378, '국고 2년 7/7 종가 3.780%'),
        op('market.custom.govt3y', 'set', 374, '국고 3년 7/7 종가 3.735%'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't4-runoff-tick',
      description: '7/10 창구 인출 (월요일 개점 — 하루 종일 고르게)',
      effects: [mgFx.runoffTicks({ profile: T4_QUEUE_PROFILE, label: '7/10 인출' })],
    },
  ],
  ticker: {
    series: [
      // 원/달러 시가 1,299.0 · 저가 1,298.8 · 고가 1,307.2 · 종가 1,306.5 [ecos-731Y003]
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1299, 1298.8, 1307.2, 1306.5] },
      // 국고채 2년 3.780% → 3.839% (7/10 종가) [ecos-817Y002]
      { path: 'market.govt2yBp', mode: 'absolute', values: [378, 380, 382, 384] },
      // 국고채 3년 3.735% → 3.795% (7/10 종가) [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [374, 376, 378, 380] },
    ],
  },
  events: [
    {
      id: 't4-news-weekend',
      kind: 'newswire',
      outlet: '주말 종합',
      time: '07:00',
      headline: '"새마을금고 대출 절반이 부동산·건설" — 주말 내내 감독체계 논란',
      body: '주말 사이 언론은 새마을금고의 건설·부동산 대출 집중과 행정안전부 감독의 전문성을 집중 조명했다. 일부 지점은 월요일 개점 전부터 다시 줄이 섰다.',
      severity: 'warning',
      sourceRefs: [S.brief, S.audit2011],
    },
    {
      id: 't4-reg-contradiction',
      kind: 'regulator',
      when: { flag: 'reassurance_contradicted' },
      agency: '특별검사반 / 언론',
      time: '08:00',
      headline: '[속보] 특별검사 중 추가 부실 금고 확인 — "추가 부실 없다"던 정부 발표 무색',
      body: '30개 특별검사 대상 중 복수 금고에서 추가 부실 징후가 확인되었다는 보도가 나왔다. 지난주 브리핑의 "추가 부실 금고는 없다"는 발언이 그대로 인용되고 있다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.sb2011],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't4-data-flow',
      kind: 'data',
      time: '09:00',
      title: '인출 현황',
      rows: [
        { label: '오늘 순인출(개장 후 집계)', value: '{{metric:dailyOutflow}}' },
        { label: '누적 순인출', value: '{{metric:cumulativeOutflow}}' },
        { label: '상환준비금·가용현금', value: '{{metric:cash}}' },
        { label: '시장 신뢰지수', value: '{{metric:confidence}}' },
      ],
      severity: 'warning',
    },
    {
      id: 't4-memo-banks',
      kind: 'memo',
      time: '09:30',
      from: '중앙회 자금운용부',
      to: '범정부 대응단 담당관',
      subject: '은행권 RP 매입 의향',
      body: `- 5대 은행과 산업은행·기업은행이 중앙회 보유 국고채·통안채를 담보로 RP를 매입할 의향을 밝혔습니다. 규모 6조 안팎, 오늘~내일 결제 가능.
- 평가손 실현 없음. 시장 충격 없음. 금융위가 "은행권 지원"으로 발표할 수 있습니다.
- 한국은행 직접 지원은 여전히 불가합니다.`,
      severity: 'positive',
      sourceRefs: [S.bankRp, S.bokAct],
      cardRefs: ['korea-crisis-toolkit'],
      relatedMetrics: ['cash', 'facilityHeadroom'],
    },
    {
      id: 't4-call-kdic',
      kind: 'call',
      when: { flag: 'task_force' },
      time: '10:30',
      caller: '예금보험공사 정리기획부장',
      callee: '범정부 대응단 담당관',
      agency: '예금보험공사',
      tone: 'routine',
      lines: [
        {
          speaker: '정리기획부장',
          text: '부실 우려 금고를 우량 금고에 자산부채이전(P&A)하면 예금은 5천만원 초과분까지 그대로 승계됩니다. 2011년 삼화저축은행 P&A와 같은 구조이고, 이번엔 예보 대신 중앙회 준비금과 필요 시 정부 차입이 뒷받침합니다. 이 원칙을 실무지원단 이름으로 발표하면 "청산되면 못 받는다"는 오해를 끊을 수 있습니다.',
        },
      ],
      severity: 'info',
      sourceRefs: [S.support, S.sbEval],
      cardRefs: ['fdic-resolution-weekend', 'mutual-credit-deposit-protection'],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '부실 우려 금고 처리 원칙',
      prompt: '특별검사에서 부실이 확인되는 금고를 어떻게 처리한다고 발표하시겠습니까?',
      context:
        '"부실 금고가 더 나오면 어떻게 되나"가 이번 주 질문입니다. 답의 형식이 인출을 결정합니다. 실무지원단 발표는 창구 마감 뒤 저녁 뉴스에 맞춰 나갑니다 — 오늘이 아니라 내일 줄의 길이를 정합니다.',
      requiredConcepts: ['mutual-credit-deposit-protection', 'fdic-resolution-weekend'],
      dimensions: ['policy', 'communication'],
      availableFrom: 3,
      defaultOptionId: 't4-d1-a',
      timeLimitSec: 120,
      options: [
        {
          id: 't4-d1-a',
          label: '실무지원단 발족: 부실 금고는 우량금고 P&A, 5천만원 초과도 전액 보장',
          description:
            '행안부·금융위 공동 실무지원단(예보 참여)이 "부실 우려 금고는 우량 금고로 자산부채이전(P&A) → 예금 전액 보장, 필요 시 정부 차입"을 원칙으로 발표한다.',
          effects: [
            confidence(4, 'P&A 전액 보장 원칙·실무지원단'),
            bankFx.setDampener(0.95, 'P&A 전액 보장 원칙'),
            flag('pna_principle'),
          ],
          expert: {
            rating: 85,
            rationale:
              '"합병 시"라는 조건을 "부실이 확인되어도"로 넓히되, 방법(P&A)과 재원(준비금·정부 차입)을 함께 말해 검증 가능하게 했다. 실제 7/10 발표이며 이후 이탈은 계속 둔화되었다.',
            historicalNote: '7/10 범정부 실무지원단 발표(fsc-80363).',
            sourceRefs: [S.support, S.sbEval],
          },
          consequences:
            '실무지원단이 발족했습니다. "P&A 시 전액 보장"이 저녁 뉴스 자막으로 나갔습니다.',
          historical: true,
          calibrationNote: 'ΔCI +4, 완화 ×0.95 [CAL: 7/6 약속의 확장이므로 한계 효과는 작게]',
          feasibility: {
            basis: '새마을금고법상 합병·계약이전 절차 + 중앙회 준비금·정부 차입',
            sourceRefs: [S.support, S.kfccAct],
          },
        },
        {
          id: 't4-d1-b',
          label: '부실 확인 금고는 영업정지·청산, 5천만원까지 준비금으로 지급',
          description: '원칙대로 정리한다. 5천만원 초과분은 청산 배당으로 일부만 회수된다.',
          effects: [
            confidence(-20, '청산 원칙 — 5천만원 초과 손실 가시화'),
            bankFx.addAmplifier(1.5, '5천만원 초과 예금 손실 현실화'),
            flag('liquidation_principle'),
          ],
          expert: {
            rating: 10,
            rationale:
              '지금까지의 모든 메시지("합병 시 전액 지급")를 뒤집는다. 2011년 부산저축은행 영업정지 후 5천만원 초과 예금자 2.3만명이 5,132억을 잃었고, 그 기억이 이번 런의 연료다.',
            sourceRefs: [S.sb2011a, S.sbEval],
          },
          consequences:
            '청산 원칙이 발표되었습니다. "5천만원 넘으면 못 받는다"가 사실이 되었습니다.',
          trap: true,
          trapExplanation:
            '"도덕적 해이를 막자"는 명분은 옳게 들린다. 그러나 런 한복판에서 손실을 현실화하는 것은 모든 예금자에게 "지금 빼라"는 지시가 된다.',
          irreversible: true,
          remediationCard: 'mutual-credit-deposit-protection',
        },
        {
          id: 't4-d1-c',
          label: '처리 원칙 발표를 유보하고 검사 결과를 기다림',
          description: '결과가 나오기 전엔 말하지 않는다.',
          effects: [bankFx.addAmplifier(1.1, '처리 원칙 공백')],
          expert: {
            rating: 30,
            rationale: '"부실이 나오면 어떻게 되나"에 답이 없으면 예금자는 최악(청산)을 가정한다.',
            sourceRefs: [S.fsb, S.sb2011],
          },
          consequences: '원칙 발표를 미뤘습니다. 기자들이 "그러면 청산이냐"고 묻고 있습니다.',
        },
      ],
    },
    {
      id: 't4-d2',
      title: '은행권 RP',
      prompt: '은행권 RP 매입을 어떻게 하시겠습니까?',
      context: '당일 결제를 받으려면 오전 중에 담보 목록과 체결 의사가 은행 자금부로 가야 합니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['liquidity', 'policy'],
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't4-d2-a',
      options: [
        {
          id: 't4-d2-a',
          label: '5대 은행·산은·기은 국고채·통안채 담보 RP 6조 체결·공표',
          description:
            '오늘 당일 결제. 금융위가 "은행권 지원"으로 발표한다. 이미 라인이 있다면 잔여 한도만 추가된다.',
          effects: [
            mgFx.bankRp({ amount: 6, settle: 'now', label: '은행권 RP 6조 체결' }),
            confidence(3, '은행권 RP 지원 공표'),
            flag('bank_rp'),
          ],
          expert: {
            rating: 85,
            rationale:
              '평가손 없이 현금을 만들고, 은행권이 담보를 받아 주었다는 사실 자체가 검증 가능한 신호다. 한은 창구가 없는 기관의 사실상 최종대부자 경로.',
            historicalNote: '7/10~11 은행 7곳 RP 매입 6~6.2조.',
            sourceRefs: [S.bankRp, S.bokOmo],
          },
          consequences: 'RP가 체결되었습니다. 결제 금액은 로그를 확인하세요.',
          historical: true,
        },
        {
          id: 't4-d2-b',
          label: 'RP 없이 상환준비금으로 계속 대응',
          description: '아직 현금이 남아 있다.',
          effects: [],
          expert: {
            rating: 30,
            rationale:
              '현금이 남아 있어도 "은행권이 담보를 받아 주었다"는 신호를 포기한다. 붕괴 시 사흘의 여유가 사라진다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: 'RP를 체결하지 않았습니다.',
        },
        {
          id: 't4-d2-c',
          label: '채권 3조 추가 매도',
          description: '시장에 판다. 지난주 매도에 이어 두 번째.',
          effects: [
            bankFx.sellSecurities({
              book: 'afs',
              amount: 3,
              fireSaleRef: 5,
              label: '채권 3조 추가 매도',
            }),
            confidence(-5, '중앙회 추가 매도 보도'),
          ],
          expert: {
            rating: 20,
            rationale:
              '같은 담보로 RP를 할 수 있는데 파는 것은 평가손과 시장 신호를 자초하는 일이다.',
            sourceRefs: [S.bondSale, S.bankRp],
          },
          consequences: '3조가 체결되었습니다. 채권시장이 다시 술렁입니다.',
        },
        {
          id: 't4-d2-d',
          label: '한국은행에 RP 매입·긴급여신 요청',
          description: '최종대부자 창구를 연다.',
          requires: { flag: 'bok_access' },
          unavailableReason:
            '새마을금고중앙회는 한은 RP 대상기관이 아니며, 65조 긴급여신은 금통위 의결 절차로 이번 주 안에 실행할 수 없습니다.',
          effects: [],
          expert: {
            rating: 40,
            rationale: '당시에는 열리지 않은 창구.',
            sourceRefs: [S.bokAct, S.bokOmo],
          },
          consequences: '요청서가 접수되었습니다.',
        },
      ],
    },
  ],
  interrupts: [t4MoisCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '지난주 약속은 "합병 시"였습니다. 검사에서 부실이 확인되면 어떻게 되는지에 답이 필요합니다.',
    },
    {
      level: 2,
      decisionId: 't4-d2',
      text: '같은 국고채로 팔 수도(손실·신호) RP를 할 수도(무손실·신호 없음) 있습니다. 바젤 원칙 11: 조달은 가능할 때 한다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2023-07-14 (금) "재예치 확대"
// ---------------------------------------------------------------------------------------------
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2023년 7월 14일 (금) 09:00 KST',
  title: '재예치 확대',
  time: '2023-07-14T09:00:00+09:00',
  entryEffects: [
    {
      id: 't5-settle',
      description: '익일 결제 RP 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't5-week-press',
      description:
        '주중 언론(외생): 채권 매도 잡음·특별검사 진행·일부 금고 비위 보도 → 신뢰지수 −3',
      effects: [confidence(-3, '주중 언론: 검사 진행·금고 비위 보도(외생)')],
    },
    {
      id: 't5-runoff',
      description: '7/11~7/14 4영업일 인출',
      effects: [mgFx.runoffDays({ days: 4, label: '7/11~14 인출' })],
    },
  ],
  events: [
    {
      id: 't5-data-week',
      kind: 'data',
      time: '09:00',
      title: '주간 인출 현황 (7/11~14)',
      rows: [
        { label: '어제(7/14 기준 최근일) 순인출', value: '{{metric:dailyOutflow}}' },
        { label: '누적 순인출(7/5~)', value: '{{metric:cumulativeOutflow}}' },
        { label: '상환준비금·가용현금', value: '{{metric:cash}}' },
        { label: '총예금', value: '{{metric:deposits}}' },
      ],
      severity: 'info',
    },
    {
      id: 't5-news-redeposit',
      kind: 'newswire',
      when: { flag: 'redeposit' },
      outlet: '연합뉴스',
      time: '08:30',
      headline: '재예치 하루 3,000건 넘어 — "기간 더 늘려 달라" 요구',
      body: '이자·비과세 복원 조치 이후 재예치가 꾸준히 들어오고 있다. 오늘이 마감일이어서 기간 연장 요구가 나온다.',
      severity: 'positive',
      sourceRefs: [S.redeposit],
    },
    {
      id: 't5-memo-inspection',
      kind: 'memo',
      time: '10:00',
      from: '특별검사반 총괄',
      to: '범정부 대응단 담당관',
      subject: '특별검사(30개)·점검(70개) 진행 상황',
      body: `- 검사 진행률 약 절반. 복수 금고에서 PF 대출 사후관리 미흡·대출 심사 부실이 확인되고 있습니다.
- 명단 공개 요구가 언론·국회에서 나옵니다. 공개 시 해당 금고 예금자의 표적 인출이 예상됩니다.
- 결과는 8월 말 상반기 실적과 함께 정리하는 것이 실무적으로 가능합니다.`,
      severity: 'warning',
      sourceRefs: [S.mois],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '재예치 조치 운영',
      prompt: '오늘 마감되는 재예치 조치를 어떻게 하시겠습니까?',
      dimensions: ['policy'],
      options: [
        {
          id: 't5-d1-a',
          label: '재예치 기간을 7/21까지 확대',
          description: '접수 기간과 대상 해지일을 넓힌다.',
          when: { flag: 'redeposit' },
          effects: [
            confidence(2, '재예치 기간 확대'),
            bankFx.setDampener(0.95, '재예치 기간 확대'),
            flag('redeposit_extended'),
          ],
          expert: {
            rating: 70,
            rationale: '작동 중인 조치를 끝낼 이유가 없다. 실제 7/14 확대.',
            historicalNote: '7/14 재예치 기간 확대.',
            sourceRefs: [S.redeposit],
          },
          consequences: '재예치 기간이 연장되었습니다.',
          historical: true,
        },
        {
          id: 't5-d1-b',
          label: '예정대로 오늘 종료',
          description: '형평성 논란을 끝낸다.',
          when: { flag: 'redeposit' },
          effects: [],
          expert: {
            rating: 40,
            rationale:
              '도덕적 해이 논란은 있지만, 회복이 진행 중일 때 조치를 끊는 것은 신호가 나쁘다.',
            sourceRefs: [S.redeposit],
          },
          consequences: '재예치 창구가 닫혔습니다.',
        },
        {
          id: 't5-d1-c',
          label: '기간 확대 + 재예치 시 추가 금리 0.5%p 우대',
          description: '유인을 더한다. 이자 비용이 늘고 형평 논란이 커진다.',
          when: { flag: 'redeposit' },
          effects: [
            confidence(2, '재예치 확대·우대'),
            bankFx.setDampener(0.93, '재예치 확대·우대'),
            mgFx.depositRateDefense({ bp: 50 }),
            flag('redeposit_extended'),
          ],
          expert: {
            rating: 45,
            rationale:
              '한계 효과는 작고, "해지했다가 돌아오면 이득"이라는 유인은 다음 위기의 행동을 왜곡한다.',
            sourceRefs: [S.redeposit, S.frc],
          },
          consequences: '우대 재예치가 시작되었습니다. 해지하지 않은 고객의 항의가 들어옵니다.',
        },
        {
          id: 't5-d1-d',
          label: '재예치 조치를 지금이라도 시행 (7/1~7/13 해지분)',
          description: '늦었지만 되돌림 유인을 만든다.',
          when: { notFlag: 'redeposit' },
          effects: [
            confidence(6, '재예치 조치(지연 시행)'),
            bankFx.setDampener(0.75, '재예치 인센티브(지연)'),
            flag('redeposit'),
          ],
          expert: {
            rating: 55,
            rationale: '일주일 늦었지만 여전히 작동한다. 늦은 회복 조치가 없는 것보다 낫다.',
            sourceRefs: [S.redeposit],
          },
          consequences: '재예치 창구가 열렸습니다.',
        },
        {
          id: 't5-d1-e',
          label: '재예치 없이 현행 유지',
          description: '조치 없음.',
          when: { notFlag: 'redeposit' },
          effects: [],
          expert: {
            rating: 15,
            rationale: '빠져나간 예금을 되돌릴 유인이 끝내 없다.',
            sourceRefs: [S.redeposit, S.fsb],
          },
          consequences: '아무 조치도 취하지 않았습니다.',
        },
        {
          id: 't5-d1-f',
          label: '중도해지 이자 손실만 면제하고 재예치는 도입하지 않음',
          description:
            '남은 예금의 해지 부담을 줄이되 되돌림 유인은 주지 않는다. 금고 규정 개정으로 당일 시행 가능.',
          when: { notFlag: 'redeposit' },
          effects: [
            confidence(2, '해지 비용 면제(지연)'),
            bankFx.setDampener(0.92, '해지 부담 완화(지연)'),
          ],
          expert: {
            rating: 40,
            rationale:
              '인출을 늦추는 효과만 있고 회복 효과는 없다. 일주일 늦은 시점에서는 재예치(D)가 명백히 낫다.',
            sourceRefs: [S.redeposit],
          },
          consequences: '면제 안내가 나갔습니다. 해지는 조금 줄었지만 되돌아오는 예금은 없습니다.',
        },
      ],
    },
    {
      id: 't5-d2',
      title: '특별검사 정보 공개',
      prompt: '특별검사 대상·진행 상황을 어디까지 공개하시겠습니까?',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't5-d2-a',
          label: '검사 대상 100개 금고 명단 공개',
          description: '투명성을 택한다. 해당 금고 예금자는 자기 금고가 명단에 있음을 알게 된다.',
          effects: [
            confidence(-5, '명단 공개 — 대상 금고 표적 인출'),
            bankFx.addAmplifier(1.3, '명단 공개 금고 표적 인출'),
          ],
          expert: {
            rating: 20,
            rationale:
              '투명성처럼 보이지만 검사 결과가 나오기 전의 명단은 "혐의자 명단"이 되어 해당 금고에 표적 런을 만든다. 2011년에도 검사 대상 명단 유출 우려가 인출을 자극했다.',
            sourceRefs: [S.sb2011, S.fsb],
          },
          consequences: '명단이 공개되었습니다. 해당 금고 지점에 다시 줄이 섰습니다.',
          trap: true,
          trapExplanation:
            '"숨기지 않는다"는 원칙과 "확정되지 않은 혐의를 공표하지 않는다"는 원칙은 다르다. 후자를 어기면 검사가 런을 만든다.',
        },
        {
          id: 't5-d2-b',
          label: '명단은 비공개, 검사 기준·진행률·처리 원칙을 주간 공개',
          description: '무엇을 어떻게 보고 있는지는 말하되, 누구인지는 결과와 함께 말한다.',
          effects: [confidence(2, '검사 기준·진행 공개')],
          expert: {
            rating: 60,
            rationale:
              '실제 대응. 검사 결과(연체율·순손실)는 8월 말 상반기 실적과 함께 공개되었다.',
            historicalNote: '명단 미공개, 8/31 상반기 실적 발표.',
            sourceRefs: [S.h1, S.mois],
          },
          consequences: '주간 브리핑 형식이 정해졌습니다.',
          historical: true,
        },
        {
          id: 't5-d2-c',
          label: '검사 관련 일체 비공개',
          description: '결과가 나올 때까지 말하지 않는다.',
          effects: [bankFx.addAmplifier(1.1, '검사 정보 공백')],
          expert: {
            rating: 30,
            rationale: '정보 공백은 추측으로 채워진다.',
            sourceRefs: [S.fsb],
          },
          consequences: '비공개 방침이 정해졌습니다. "무엇을 숨기나" 기사가 나옵니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d2',
      text: '검사 중인 금고 명단은 확정되지 않은 혐의입니다. 공개하면 해당 금고에 표적 인출이 생깁니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2023-07-17 (월) "감독체계"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2023년 7월 17일 (월) 09:00 KST',
  title: '줄이 짧아진 뒤: 감독체계',
  time: '2023-07-17T09:00:00+09:00',
  entryEffects: [
    {
      id: 't6-settle',
      description: '익일 결제 RP 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't6-press',
      description:
        '언론(외생): 건설·부동산 대출 56.4조(연체 9.23%)·관리형토지신탁 15.8조 보도 → 신뢰지수 −2',
      effects: [confidence(-2, '건설·부동산 대출 집중 보도(외생)')],
    },
    {
      id: 't6-runoff',
      description: '7/17 당일 인출',
      effects: [mgFx.runoffDays({ days: 1, label: '7/17 인출' })],
    },
  ],
  events: [
    {
      id: 't6-data-flow',
      kind: 'data',
      time: '09:00',
      title: '인출 현황 (7/17)',
      rows: [
        { label: '오늘 순인출', value: '{{metric:dailyOutflow}}' },
        { label: '누적 순인출(7/5~)', value: '{{metric:cumulativeOutflow}}' },
        { label: '상환준비금·가용현금', value: '{{metric:cash}}' },
        { label: '시장 신뢰지수', value: '{{metric:confidence}}' },
      ],
      severity: 'info',
      relatedMetrics: ['dailyOutflow', 'cumulativeOutflow'],
    },
    {
      id: 't6-news-pf',
      kind: 'newswire',
      outlet: '연합뉴스 (국회 제출 자료)',
      time: '08:00',
      headline: '새마을금고 건설·부동산 대출 56.4조, 연체율 9.23% — 관리형토지신탁 15.8조',
      body: '행정안전부가 국회에 제출한 자료(1월말 기준)에 따르면 건설·부동산업 대출이 56.4조원으로 연체율은 9.23%, 연체액은 5.2조원이다. 관리형토지신탁 사업비 대출은 15조 7,527억원으로 2021년말 9조원에서 73% 늘었다. 신협·농협에는 지난해 1월부터 건설·부동산 각 30%, 합산 50%의 업종별 대출 한도가 적용되고 있지만, 새마을금고에는 같은 한도가 없다.',
      severity: 'warning',
      sourceRefs: [S.outflow, S.kfccStd],
    },
    {
      id: 't6-memo-wrap',
      kind: 'memo',
      time: '09:30',
      from: '범정부 대응단 총괄',
      to: '범정부 대응단 담당관',
      subject: '2주 경과 — 감독체계 결정 요청',
      body: `- 인출은 둔화 추세입니다. 그러나 연체율·PF 집중·지배구조 문제는 그대로입니다.
- 국회 행안위와 정무위가 "행안부가 금융감독을 할 수 있느냐"를 묻고 있습니다. 대응단 해산 전에 감독체계 방향을 정해야 합니다.
- 선택지: 행안부 감독 유지 + 금융당국 협력 강화 / 금융위 이관(법 개정) / 현행 유지 / 경영혁신·지배구조 개편.`,
      severity: 'warning',
      sourceRefs: [S.audit2011, S.support],
      cardRefs: ['regulator-escalation-ladder', 'korea-crisis-toolkit'],
    },
    {
      id: 't6-call-assembly',
      kind: 'call',
      time: '11:00',
      caller: '국회 행정안전위원회 전문위원',
      callee: '범정부 대응단 담당관',
      tone: 'concerned',
      lines: [
        {
          speaker: '전문위원',
          text: '여야 모두 "감독 사각지대"를 문제 삼습니다. 정부 입장을 이번 주 안에 내주십시오. 이관이든 협력이든, 지배구조 얘기가 빠지면 통과가 어렵습니다.',
        },
      ],
      severity: 'warning',
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '감독체계',
      prompt: '새마을금고 감독체계를 어떻게 가져가시겠습니까? (최대 2개; 감독 소관 옵션은 하나만)',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t6-d1-a', 't6-d1-b'],
        ['t6-d1-a', 't6-d1-c'],
        ['t6-d1-b', 't6-d1-c'],
      ],
      requiredConcepts: ['regulator-escalation-ladder', 'korea-crisis-toolkit'],
      dimensions: ['policy', 'compliance'],
      options: [
        {
          id: 't6-d1-a',
          label: '행안부 감독 유지 + 금융위·금감원 검사·감독 협력 제도화 추진',
          description:
            '소관은 그대로 두고 금융당국의 검사 인력과 기준을 상시 공유하는 협력 체계를 만든다.',
          effects: [flag('supervision_coop')],
          expert: {
            rating: 55,
            rationale:
              '실행 가능성이 높고 이번 사태의 실무지원단이 원형이다. 그러나 소관이 남는 한 "감독 전문성"과 "정치적 독립성" 문제는 구조적으로 남는다.',
            historicalNote: '정부는 행안부 감독을 유지하고 금융당국과의 협력 강화 방침을 밝혔다.',
            sourceRefs: [S.support, S.audit2011],
          },
          consequences: '협력 강화 방침이 발표되었습니다.',
          historical: true,
        },
        {
          id: 't6-d1-b',
          label: '금융위로 감독권 이관(새마을금고법 개정) 추진',
          description: '소관을 바꾼다. 법 개정에 1년 이상 걸리고 부처·지역 정치의 반발이 크다.',
          effects: [flag('transfer_fsc')],
          expert: {
            rating: 65,
            rationale:
              '감독 전문성 측면에서는 정답에 가깝다. 다만 실행 가능성이 낮고, 이관 자체가 지배구조·PF 쏠림을 고치지는 않는다.',
            sourceRefs: [S.audit2011, S.sbEval],
          },
          consequences: '이관 추진이 발표되었습니다. 지역 금고 이사장들의 반발 성명이 나왔습니다.',
        },
        {
          id: 't6-d1-c',
          label: '현행 유지 — 특별점검으로 충분',
          description: '이번 사태는 개별 금고 문제로 본다.',
          effects: [flag('status_quo')],
          expert: {
            rating: 15,
            rationale:
              '2011년 저축은행 사태의 감사원 감사는 감독 실패가 개별 기관 문제가 아니라 체계 문제였음을 보여 준다. 사각지대를 그대로 두면 같은 일이 반복된다.',
            sourceRefs: [S.audit2011, S.sbEval],
          },
          consequences: '현행 유지 방침이 발표되었습니다. "또 터지면?"이라는 사설이 나왔습니다.',
          trap: true,
          trapExplanation:
            '"줄이 짧아졌으니 끝났다"는 안도. 그러나 런은 증상이고 감독 사각지대·PF 쏠림·지배구조가 원인이다.',
        },
        {
          id: 't6-d1-d',
          label: '경영혁신·지배구조 개편(회장 권한 분산, 부실금고 합병 일정) 병행',
          description: '감독체계와 별개로 중앙회 지배구조와 부실 금고 정리 일정을 함께 내놓는다.',
          effects: [flag('governance_reform')],
          expert: {
            rating: 70,
            rationale:
              '감독의 형식보다 피감기관의 지배구조가 부실의 원인이었다. 2011~14 저축은행 구조조정 사후평가도 대주주·경영진 문제를 핵심으로 꼽는다.',
            sourceRefs: [S.sbEval, S.audit2011],
          },
          consequences: '경영혁신 방안 수립이 예고되었습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '런은 증상입니다. 연체율·PF 집중·지배구조 지표는 이번 2주 동안 하나도 바뀌지 않았습니다.',
    },
  ],
}

export const turnsB: T[] = [t4, t5, t6]
