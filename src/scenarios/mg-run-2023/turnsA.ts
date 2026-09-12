import type { BankState, DialogueStep, Interrupt, Turn } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, flag, op, regulator } from '../../engine/fx/common'
import { mgFx } from './fx'

type T = Turn<BankState>

/**
 * 창구 하루의 틱 구조. 1,293개 금고의 영업시간(09:30~16:00)을 네 구간으로 나눈다.
 * 프로필은 `calibration.md` §9.1 참조 — 합은 항상 1이어야 한다.
 */
export const QUEUE_TICK_LABELS = ['09:30', '11:00', '14:00', '16:00']
/** 7/5 첫 줄: 개점 전부터 대기 행렬 — 전방 집중 [STYLIZED]. */
export const T1_QUEUE_PROFILE = [0.4, 0.3, 0.2, 0.1]
/** 7/6 전국 확산: 하루 종일 고르게 — 완만 [STYLIZED]. */
export const T2_QUEUE_PROFILE = [0.3, 0.27, 0.25, 0.18]

/** 출처 id 축약 (sources.ts). 사후 출처(2023.11 이후)는 턴 텍스트에서 인용하지 않는다. */
export const S = {
  mois: 'mois-special-inspection-2023-07-04',
  merger: 'kfcc-merger-notice-2023-07-05',
  brief: 'mg-joint-briefing-2023',
  redeposit: 'mois-redeposit-2023-07-07',
  support: 'fsc-80363',
  h1: 'fsc-80662',
  kfccAct: 'kfcc-act',
  kfccStd: 'mois-kfcc-supervision-standard',
  bokAct: 'bok-act',
  bokRate: 'bok-base-rate-2023',
  bokOmo: 'bok-omo-2022-10-27',
  mutual: 'fsc-87126',
  sb2011: 'fsc-69871',
  sb2011a: 'fsc-69869',
  sbEval: 'fsc-71188',
  audit2011: 'audit-savings-bank-2011',
  bcbs144: 'bcbs-144',
  fsb: 'fsb-depositor-behaviour-2024',
  frc: 'fdic-frc-supervision-2023',
  bondSale: 'press-kfcc-bond-sale-2023-07-06',
  reserve: 'mois-reserve-2023-07-05',
  bankRp: 'press-bank-rp-2023-07-11',
  outflow: 'press-mg-outflow-2023-07-17',
}

// ---------------------------------------------------------------------------------------------
// T0 — 2023-07-04 (화) "행안부 특별점검 발표"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2023년 7월 4일 (화) 09:00 KST',
  title: '프롤로그: 연체율 6%',
  time: '2023-07-04T09:00:00+09:00',
  events: [
    {
      id: 't0-news-mois',
      kind: 'newswire',
      outlet: '행정안전부 보도자료 / 연합뉴스',
      time: '08:30',
      headline: '행안부, 연체율 상위 100개 새마을금고 특별점검 착수 — "연말까지 연체율 4% 이하로"',
      body: '행정안전부는 연체율 상위 100개 금고를 대상으로 특별검사(30개)와 특별점검(70개)에 착수한다고 밝혔다. 6월 29일 잠정 연체율은 6.18%(기업 9.63%, 가계 1.65%), 연체액은 12.16조원이다. 행안부는 필요 시 부실 금고의 합병·인가취소 등 강력한 조치를 예고했다.',
      severity: 'warning',
      sourceRefs: [S.mois, S.brief],
      relatedMetrics: ['delinquencyRate'],
    },
    {
      id: 't0-data-delinquency',
      kind: 'data',
      time: '08:40',
      title: '연체율 추이 (중앙회 감독부 집계)',
      rows: [
        { label: '2022년 말', value: '3.59% (예수금 251.4조)' },
        { label: '2023년 3월 말', value: '5.33%' },
        { label: '5월 말', value: '6.19%' },
        { label: '6월 15일', value: '6.49%' },
        { label: '6월 29일(잠정)', value: '6.18% — 연체액 12.16조' },
      ],
      severity: 'warning',
      sourceRefs: [S.brief],
    },
    {
      id: 't0-memo-liquidity',
      kind: 'memo',
      time: '09:10',
      from: '중앙회 자금운용부',
      to: '범정부 대응단 담당관 겸 중앙회 자금담당',
      subject: '유동성 현황 (6/29 기준)',
      body: `- 예수금 259.6조. 6월 중 수신은 소폭 감소 추세.
- **상환준비금 13.36조** (금고가 인출 대응 시 즉시 인출 가능한 중앙회 예치금).
- 현금성자산 77.3조 = 즉시 가용 현금·예치금 17.3 + 국고채·통안채 40 + 은행채·기타 채권 20 [내부 배분].
- 예금자보호준비금 2.6조 (새마을금고법상 1인당 원리금 5천만원 보호 재원).
- **한국은행 RP 대상기관이 아니며**, 은행권과 사전 약정된 RP 라인도 없습니다. 채권은 시장에서 팔거나 은행에 RP로 넘겨야 현금이 됩니다.`,
      severity: 'warning',
      sourceRefs: [S.brief, S.kfccAct, S.bokOmo],
      cardRefs: ['mutual-credit-deposit-protection', 'korea-crisis-toolkit'],
      relatedMetrics: ['cash', 'facilityHeadroom'],
    },
    {
      id: 't0-memo-namyangju',
      kind: 'memo',
      time: '10:00',
      from: '중앙회 검사감독부',
      to: '범정부 대응단 담당관',
      subject: '남양주동부새마을금고 — 합병 불가피, 공시 시점 결정 요청',
      body: `- 남양주동부금고: 시행사 PF 대출 600억원대 부실로 자체 정상화 불가. 화도새마을금고에 흡수합병 예정.
- 새마을금고법상 합병 시 예금·출자금은 승계되며, 예금자보호준비금은 5천만원까지 보호합니다. 합병이면 5천만원 초과분도 승계되지만, 이 점을 예금자가 알고 있지는 않습니다.
- 언론 두 곳이 이미 취재 중입니다. 공시를 어떻게, 언제 할지 결정이 필요합니다.`,
      severity: 'critical',
      sourceRefs: [S.merger, S.kfccAct],
    },
    {
      id: 't0-rumor-sns',
      kind: 'rumor',
      source: '유튜브·온라인 커뮤니티',
      time: '11:00',
      headline: '"새마을금고 곧 망한다" 영상 조회수 급증 — "5천만원 넘으면 못 받는다"는 댓글 확산',
      body: '예금자보호법 대상이 아니라는 점이 "보호가 안 된다"로 오해되어 퍼지고 있다. 일부 지점에서 잔액 확인 문의가 늘고 있다.',
      severity: 'warning',
      reliability: 'unconfirmed',
      cardRefs: ['mutual-credit-deposit-protection'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: '한은 기준금리', value: '3.50%', change: '1월 이후 동결' },
        { label: '국고 3년', value: '3.619%', change: '' },
        { label: '원/달러', value: '1,301', change: '' },
      ],
      sourceRefs: [S.bokRate],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '부실 금고 공시 방식·타이밍',
      prompt: '남양주동부금고 합병을 어떻게, 언제 알리시겠습니까?',
      context:
        '지금은 아직 줄이 없습니다. 하지만 언론이 취재 중이고, 공시 방식이 "합병"을 "파산"으로 읽히게 할 수도, "보호"로 읽히게 할 수도 있습니다.',
      requiredConcepts: ['crisis-communication', 'mutual-credit-deposit-protection'],
      dimensions: ['communication', 'timeliness'],
      options: [
        {
          id: 't0-d1-a',
          label: '내일 표준 합병 공고문으로 즉시 공시',
          description:
            '새마을금고법상 합병 공고 양식대로 사유·일정만 공시한다. 예금 승계 범위나 중앙회 유동성 수치는 담지 않는다. 오늘 중 실행 가능.',
          effects: [flag('disclosure_plain')],
          expert: {
            rating: 45,
            rationale:
              '투명성은 맞지만 "600억 부실로 합병"이라는 사실만 전달되어 예금자는 최악을 가정한다. 합동 브리핑의 수치·보장 설명이 하루 뒤(7/6)에야 나왔고 그 사이 인출이 몰렸다.',
            historicalNote: '실제 7/5 합병 공시. 당일부터 남양주 지점 앞 대기 행렬이 보도되었다.',
            sourceRefs: [S.merger, S.brief],
          },
          consequences:
            '합병 공고가 내일 아침 게시됩니다. 언론은 "PF 부실로 합병"이라는 제목을 준비하고 있습니다.',
          historical: true,
          feasibility: {
            basis: '새마을금고법상 합병 공고 절차, 당일 실행 가능',
            sourceRefs: [S.kfccAct],
          },
        },
        {
          id: 't0-d1-b',
          label: '합병 공시와 예금 전액 승계·유동성 수치를 동시 발표',
          description:
            '합병 공고에 "합병 시 5천만원 초과 예금·이자도 화도금고가 전액 승계"를 명시하고, 중앙회 상환준비금·현금성자산 수치를 같은 자료에 넣는다. 자료는 오늘 밤까지 준비 가능.',
          effects: [flag('disclosure_with_protection')],
          expert: {
            rating: 80,
            rationale:
              '7/6 합동 브리핑과 7/10 실무지원단 발표의 핵심 메시지("합병 시에도 5천만원 초과 원리금 지급")를 방아쇠와 같은 시각에 내놓는 것이다. FSB는 검증 가능한 정보가 공백을 메울 때 런이 늦춰진다고 평가한다.',
            sourceRefs: [S.brief, S.support, S.fsb],
          },
          consequences:
            '공고문에 예금 승계 범위와 유동성 수치가 들어갔습니다. 홍보실은 "그래도 줄은 설 것"이라고 예상합니다.',
          calibrationNote:
            '합병 공시 ΔCI −15 중 +5 상쇄, 완화 ×0.9 [CAL: 검증 가능 정보 공개의 부분 효과]',
          feasibility: { basis: '수치는 중앙회 내부 자료로 당일 확인 가능', sourceRefs: [S.brief] },
        },
        {
          id: 't0-d1-c',
          label: '특별점검이 끝날 때까지 공시를 미루고 조용히 합병 준비',
          description:
            '방아쇠를 당기지 않는다. 합병은 7월 말 점검 결과와 함께 발표한다. 법적으로는 공고 시점을 늦출 여지가 있으나 언론이 이미 취재 중이다.',
          effects: [flag('disclosure_delayed')],
          expert: {
            rating: 10,
            rationale:
              '언론이 취재 중인 사실을 미루면 "숨겼다"는 프레임으로 보도되고, 이후 정부의 모든 발표가 의심받는다. 2011년 저축은행 사태에서도 정보 공백은 인출 동향을 악화시켰다. 보정 규칙: 정보 공백 ×1.2, 거짓·은폐 노출 ×1.5.',
            sourceRefs: [S.sb2011, S.fsb],
          },
          consequences: '공시를 보류했습니다. 홍보실이 언론의 추가 문의 3건을 보고했습니다.',
          trap: true,
          trapExplanation:
            '"방아쇠를 당기지 않으면 런도 없다"는 유혹. 그러나 정보 공백은 언론·SNS가 채우고, 은폐로 읽히는 순간 이후의 안심 메시지는 힘을 잃는다.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't0-d1-d',
          label: '합병 대신 남양주동부금고 영업정지·청산 절차 개시',
          description:
            '부실 금고를 정리해 "썩은 가지"를 잘라낸다. 청산 시 예금자보호준비금(2.6조)으로 1인당 5천만원까지만 지급된다.',
          effects: [flag('liquidation_first')],
          expert: {
            rating: 15,
            rationale:
              '5천만원 초과 예금의 손실이 실제로 발생하는 순간 "새마을금고는 5천만원 넘으면 못 받는다"가 사실이 된다. 2011년 부산저축은행 영업정지에서 5천만원 초과 예금 5,132억(2.3만명) 손실이 남긴 교훈이다.',
            sourceRefs: [S.sb2011a, S.sbEval],
          },
          consequences:
            '영업정지 절차 검토가 시작되었습니다. 예금자보호준비금 지급 시뮬레이션이 요청되었습니다.',
          irreversible: true,
          feasibility: {
            basis: '새마을금고법상 행안부 인가취소·중앙회 예금자보호준비금 지급 절차',
            sourceRefs: [S.kfccAct],
          },
        },
      ],
    },
    {
      id: 't0-d2',
      title: '사전 유동성 확보',
      prompt: '공시 전에 조달 경로를 준비하시겠습니까? (최대 2개)',
      context:
        '상환준비금과 현금성자산은 넉넉해 보입니다. 그러나 채권은 팔아야 현금이 되고, 한국은행 창구는 열려 있지 않습니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t0-d2-a', 't0-d2-b'],
        ['t0-d2-a', 't0-d2-c'],
      ],
      requiredConcepts: ['korea-crisis-toolkit', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't0-d2-a',
          label: '추가 조달 없이 상환준비금·현금성자산으로 대응',
          description: '13.36조 상환준비금과 17.3조 가용현금이면 충분하다고 본다. 별도 조치 없음.',
          effects: [flag('no_prefunding')],
          expert: {
            rating: 35,
            rationale:
              '가용현금 30조는 S1~S2 유출(일 1~2조)에는 충분하지만, 붕괴(S3) 시 일 10조 이상이 빠지면 사흘이면 소진된다. 바젤 원칙 11은 조달 수단을 위기 전에 확보·테스트하라고 요구한다.',
            historicalNote: '실제로 은행 RP 라인은 7/10~11에야 체결되었다.',
            sourceRefs: [S.bcbs144, S.bankRp],
          },
          consequences: '추가 조달 준비 없이 공시일을 맞습니다.',
          historical: true,
        },
        {
          id: 't0-d2-b',
          label: '5대 은행·산은·기은과 국고채·통안채 담보 RP 6조 라인 사전 협의',
          description:
            '한은 대신 은행권이 중앙회 보유 국고채·통안채를 RP로 매입하는 우회 경로. 담보 목록 확인과 약정에 하루가 걸려 내일부터 당일 결제가 가능하다. 시장에 알려지지 않는다.',
          effects: [
            mgFx.bankRp({
              amount: 6,
              settle: 'next',
              label: '은행권 RP 라인 사전 협의(익일 결제)',
            }),
            flag('rp_line_ready'),
          ],
          expert: {
            rating: 85,
            rationale:
              '실제로 작동한 경로(7/10~11 은행 7곳 6~6.2조)를 닷새 앞당기는 것이다. 사전에 확보된 담보차입 여력만이 당일 자금이 된다는 것이 2023년 3월 미국 은행 위기의 운영상 교훈이며, 바젤 원칙 11의 요구다.',
            sourceRefs: [S.bankRp, S.bcbs144, S.fsb],
          },
          consequences:
            '은행권 자금부와 담보 목록을 교환했습니다. 내일부터 6조 한도 내 당일 결제가 가능합니다.',
          calibrationNote: 'RP 상한 6.2조 [press-bank-rp-2023-07-11]; 익일 여력 반영',
          feasibility: {
            basis: '은행 RP 매입은 자율 거래로 약정·담보 확인에 1영업일',
            sourceRefs: [S.bankRp],
          },
        },
        {
          id: 't0-d2-c',
          label: '국고채 2조 사전 매각으로 현금 확보',
          description:
            '공시 전에 조용히 판다. 시장 영향은 작지만 매각 보도가 나면 "중앙회가 현금이 급하다"로 읽힌다.',
          effects: [
            bankFx.sellSecurities({
              book: 'afs',
              amount: 2,
              fireSaleRef: 5,
              label: '국고채 2조 사전 매각',
            }),
            confidence(-2, '중앙회 채권 매각 보도(소폭)'),
          ],
          expert: {
            rating: 50,
            rationale:
              '현금은 늘지만 RP와 달리 평가손을 실현하고 시장에 신호를 남긴다. 2조는 국고채 일평균 거래 규모 안이라 충격은 작다.',
            sourceRefs: [S.bondSale],
          },
          consequences:
            '국고채 2조가 체결되었습니다. 채권 데스크는 "매도 주체가 곧 알려질 것"이라고 합니다.',
          calibrationNote: '장부/시가 40.8/40 → 2% 손실 + 파이어세일 1%×√(2/5) [CAL]',
        },
        {
          id: 't0-d2-d',
          label: '한국은행에 RP 대상기관 편입·긴급여신(65조) 사전 요청',
          description: '최종대부자에게 직접 창구를 요청한다.',
          requires: { flag: 'bok_access' },
          unavailableReason:
            '새마을금고중앙회는 한국은행 공개시장운영 RP 대상기관이 아닙니다. 한은법 65조 긴급여신은 금통위 4명 이상 찬성과 정부 의견 청취가 필요해 이번 주 안에 실행할 수 없습니다.',
          effects: [],
          expert: {
            rating: 40,
            rationale:
              '방향은 옳지만 2023년 7월에는 열리지 않은 창구다. 한은법 65조는 "유동성 악화 금융기관"에 임시 적격담보로 대출할 수 있게 하지만 금통위 의결 절차가 필요하다.',
            sourceRefs: [S.bokAct, S.bokOmo],
          },
          consequences: '요청서가 접수되었습니다.',
          feasibility: {
            basis: '당시 한은 RP 대상기관 아님; 65조 긴급여신은 금통위 의결 필요',
            sourceRefs: [S.bokAct],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '"담보차입 여력(당일)"이 0입니다. 공시 이후 쓸 수 있는 현금은 대시보드의 상환준비금·가용현금뿐입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '위기 커뮤니케이션 원칙: 방아쇠(부실 공시)와 보장 범위·검증 가능한 수치는 같은 문장에 넣는다. 2011년 저축은행의 정보 공백을 기억하세요.',
    },
    {
      level: 3,
      decisionId: 't0-d2',
      text: '은행권 RP 라인(B)은 비용이 거의 없고 눈에 띄지 않으며, 이후 모든 턴의 선택지를 살립니다.',
    },
  ],
  relatedCards: ['mutual-credit-deposit-protection', 'korea-crisis-toolkit'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2023-07-05 (수) "합병 공시, 줄이 생기다"
// ---------------------------------------------------------------------------------------------

/**
 * 11:20 지역금고 이사장 전화. 종전 `t1-call-branch` 이벤트를 인터럽트로 옮긴 것이며, 대사는
 * 공개 기록(대기 행렬 보도·행안부 7/5 보도자료)을 바탕으로 한 **재구성**이다 — 녹취가 아니다.
 */
const t1BranchCall: Interrupt<BankState> = {
  id: 't1-i1-branch',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't1-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '지역금고 이사장 전화',
  prompt: '창구 현금이 오후를 못 버틴다고 합니다. 지금 무엇을 답하시겠습니까?',
  dimensions: ['compliance', 'liquidity'],
  source: {
    kind: 'call',
    caller: '지역금고 이사장(경기 북부)',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '이사장',
      text: '창구에 현금이 오후를 못 버팁니다. 상환준비금에서 오늘 중으로 지원되는 겁니까? 일부 직원은 큰 금액은 내일 오라고 안내하자고 합니다.',
    },
  ],
  options: [
    {
      id: 't1-i1-a',
      label: '오늘 중 지원 확약 + 인근 금고 현금 재배치 지시',
      description:
        '상환준비금 인출을 즉시 승인하고 인근 금고·중앙회 지점에서 현금을 돌린다. 합성 기관 내부 이동이므로 시스템 현금은 줄지 않는다.',
      effects: [flag('branch_cash_dispatched')],
      expert: {
        rating: 80,
        rationale:
          '상환준비금의 존재 이유다. 지급이 한 창구에서라도 멈추면 그 사진이 다음 날 전국의 대기 행렬이 된다.',
        sourceRefs: [S.brief, S.fsb],
      },
      consequences:
        '현금 수송 차량이 배차되었습니다. 이사장이 직원 안내문을 회수하겠다고 답합니다.',
      historical: true,
      preview: [{ metric: 'cash', direction: 'flat', magnitude: 1, note: '중앙회 내부 이동' }],
    },
    {
      id: 't1-i1-b',
      label: '요청서 접수 후 오후에 심사 결과 회신',
      description:
        '절차대로 서면 요청을 받고 심사한다. 오늘 오후 창구는 자체 현금으로 버텨야 한다.',
      effects: [bankFx.addAmplifier(1.1, '창구 현금 부족·회신 지연')],
      expert: {
        rating: 25,
        rationale:
          '위기 중 절차는 속도를 이기지 못한다. 1,293개 금고의 창구 현금은 균일하지 않고, 한 곳의 "오늘은 안 됩니다"가 전체의 뉴스가 된다(보정 규칙: 정보 공백 ×1.2의 축소판 ×1.1).',
        sourceRefs: [S.fsb],
      },
      consequences:
        '요청서를 접수했습니다. 오후 늦게 두 금고에서 현금이 바닥났다는 보고가 왔습니다.',
      preview: [
        { metric: 'dailyOutflow', direction: 'up', magnitude: 1, note: '남은 시간대 증폭 ×1.1' },
      ],
    },
    {
      id: 't1-i1-c',
      label: '한도 내 지급 후 초과분은 본점 확인 절차 안내',
      description:
        '일정 금액까지는 즉시 지급하고 그 이상은 본점 확인을 거치게 한다. 창구에서는 "오늘은 어렵다"로 들린다.',
      effects: [regulator({ add: 1 }, '사실상의 인출 지연 안내')],
      expert: {
        rating: 5,
        rationale:
          '지급 유예의 축소판이다. 예금의 요구불성을 조건부로 만드는 안내는 감독당국 반응표에서 곧바로 상향 사유가 되며, 2011년 저축은행 사태에서 같은 안내가 인출을 가속했다.',
        sourceRefs: [S.sb2011a, S.frc],
      },
      consequences:
        '한도 안내가 창구에 붙었습니다. 대기 중인 예금자들이 휴대전화로 촬영하고 있습니다.',
      trap: true,
      trapExplanation:
        '"전부 막는 것은 아니다"라는 절충은 창구에서 "오늘은 다 못 준다"로 번역된다. 조건이 붙는 순간 요구불예금은 요구불이 아니다.',
      preview: [{ metric: 'regulatorLevel', direction: 'up', magnitude: 2, note: '감독 단계 +1' }],
    },
  ],
}

export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2023년 7월 5일 (수) 09:00 KST',
  title: '합병 공시 — 줄이 생기다',
  time: '2023-07-05T09:00:00+09:00',
  ticks: 4,
  tickLabels: QUEUE_TICK_LABELS,
  entryEffects: [
    {
      id: 't1-settle',
      description: '사전 협의한 은행 RP 라인 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't1-market',
      description: '원/달러 시가 1,298.0원 (전일 종가 1,301.4)',
      effects: [op('market.fxUsdLocal', 'set', 1298, '7/5 시가')],
    },
    {
      id: 't1-disclosure-plain',
      when: { flag: 'disclosure_plain' },
      description: '남양주동부금고 합병 공시 → 부실 금고 가시화, 신뢰지수 −15',
      effects: [confidence(-15, '합병 공시(부실 금고 가시화)')],
    },
    {
      id: 't1-disclosure-protect',
      when: { flag: 'disclosure_with_protection' },
      description: '합병 공시(예금 전액 승계·수치 동반) → 신뢰지수 −10, 완화 ×0.9',
      effects: [
        confidence(-10, '합병 공시(보장 범위·수치 동반)'),
        bankFx.setDampener(0.9, '검증 가능한 정보 동반 공시'),
      ],
    },
    {
      id: 't1-disclosure-delayed',
      when: { flag: 'disclosure_delayed' },
      description: '언론 단독 보도 "부실 숨겼다" → 신뢰지수 −20, 증폭 ×1.5',
      effects: [
        confidence(-20, '언론 단독 보도·은폐 인식'),
        bankFx.addAmplifier(1.5, '은폐 인식(정보 공백 + 모순)'),
      ],
    },
    {
      id: 't1-liquidation',
      when: { flag: 'liquidation_first' },
      description: '영업정지·청산 절차 보도 → 5천만원 초과 손실 가시화, 신뢰지수 −25, 증폭 ×1.3',
      effects: [
        confidence(-25, '영업정지·청산 — 5천만원 초과 손실 가시화'),
        bankFx.addAmplifier(1.3, '피어(부실 금고) 실패'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't1-runoff-tick',
      description: '7/5 창구 인출 (개점 집중)',
      effects: [mgFx.runoffTicks({ profile: T1_QUEUE_PROFILE, label: '7/5 인출' })],
    },
  ],
  ticker: {
    series: [
      // 원/달러 시가 1,298.0 · 저가 1,297.0 · 고가 1,305.9 · 종가 1,298.6 [ecos-731Y003]
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1298, 1297, 1305.9, 1298.6] },
    ],
  },
  events: [
    {
      id: 't1-news-merger',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '08:50',
      headline: '남양주동부새마을금고, 화도새마을금고에 흡수합병 — 600억원대 PF 대출 부실',
      body: '새마을금고중앙회는 시행사 대출 부실로 자체 정상화가 어려운 남양주동부금고를 화도금고에 합병한다고 공고했다. 인근 지점에는 개점 전부터 예금자들이 줄을 섰다.',
      severity: 'critical',
      sourceRefs: [S.merger],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      /**
       * The correction to `t0-rumor-sns`.
       *
       * The rumour is not vague, it is **backwards**: 새마을금고 is outside 예금자보호법, which
       * spread as "보호가 안 된다" — when in fact 새마을금고법 제71조's own 준비금 protects the
       * same 5천만원. Leaving it uncorrected teaches the player that unverified claims simply
       * fade; in this scenario the whole lesson is that a false claim with a true-sounding premise
       * has to be answered with the specific provision, quickly, or the queue keeps growing.
       *
       * Inert by construction: no `effects`, so the engine's path is unchanged. What it changes is
       * what the player *knows* when they pick the T1 communication option.
       */
      id: 't1-news-protect-correction',
      kind: 'newswire',
      outlet: '행정안전부 설명자료',
      time: '09:20',
      atTick: 1,
      headline:
        '[정정] "5천만원 넘으면 못 받는다"는 사실과 다르다 — 새마을금고법 자체 준비금이 같은 한도까지 보호',
      body:
        '예금자보호법의 적용 대상이 아닌 것은 맞다. 다만 그것이 "보호가 없다"는 뜻은 아니다 — ' +
        '새마을금고법 제71조에 따른 예금자보호준비금이 같은 5천만원 한도까지 대위변제한다' +
        '(한도는 같은 법 시행령 제46조제3항). 합병이 이뤄지는 경우에도 피합병금고의 예적금은 ' +
        '금리·만기 조건 그대로 이관되므로 5천만원을 넘는 금액도 그대로 지급된다.',
      severity: 'info',
      reliability: 'confirmed',
      correctionOf: 't0-rumor-sns',
      sourceRefs: [S.kfccAct, S.reserve],
      cardRefs: ['mutual-credit-deposit-protection'],
    },
    {
      id: 't1-news-queue',
      kind: 'newswire',
      outlet: '온라인 매체·SNS',
      time: '10:30',
      atTick: 1,
      headline: '"돈 빼러 왔어요" — 남양주 지점 앞 대기 행렬, 인증샷 확산',
      body: '대기 행렬 사진이 SNS로 퍼지며 다른 지역 지점에도 "우리 금고는 괜찮냐"는 문의가 몰리고 있다. 일부 예금자는 만기 전 중도해지를 감수하고 있다.',
      severity: 'critical',
      cardRefs: ['uninsured-deposits-and-run-speed'],
    },
    {
      id: 't1-news-delayed',
      kind: 'newswire',
      when: { flag: 'disclosure_delayed' },
      outlet: '일간지 단독',
      time: '07:00',
      headline: '[단독] 새마을금고, 600억 부실 금고 합병 숨겼다 — 중앙회 "점검 후 발표하려 했다"',
      body: '중앙회가 부실 금고의 합병을 특별점검 이후로 미루기로 한 사실이 확인됐다. 예금자들은 "또 무엇을 숨기고 있느냐"고 묻고 있다.',
      severity: 'critical',
    },
    {
      id: 't1-memo-flow',
      kind: 'memo',
      time: '16:00',
      atTick: 3,
      from: '중앙회 자금운용부',
      to: '범정부 대응단 담당관',
      subject: '당일 인출 및 유동성',
      body: `- 당일 순인출: {{metric:dailyOutflow}} (예수금의 {{metric:dailyOutflowPct}}).
- 상환준비금·가용현금: {{metric:cash}}. 담보차입 여력(당일): {{metric:facilityHeadroom}}.
- 지역금고 12곳이 창구 현금 부족을 보고했습니다. 상환준비금 인출 요청이 들어와 있습니다.`,
      severity: 'warning',
      relatedMetrics: ['dailyOutflow', 'cash', 'facilityHeadroom'],
    },
    {
      id: 't1-memo-rp-ready',
      kind: 'memo',
      when: { flag: 'rp_line_ready' },
      time: '09:30',
      from: '중앙회 자금운용부',
      to: '범정부 대응단 담당관',
      subject: '은행권 RP 라인 약정 완료',
      body: '5대 은행과 산은·기은이 국고채·통안채 담보 RP 6조 한도를 확인했습니다. 오늘부터 당일 결제로 인출할 수 있습니다.',
      severity: 'positive',
      sourceRefs: [S.bankRp],
    },
    {
      id: 't1-call-mois',
      kind: 'call',
      time: '14:00',
      atTick: 2,
      caller: '행정안전부 지역경제지원관',
      callee: '범정부 대응단 담당관',
      agency: '행정안전부',
      tone: 'concerned',
      lines: [
        {
          speaker: '지역경제지원관',
          text: '기재부·금융위·금감원·한은이 대응단 참여 의사를 물어왔습니다. 행안부 단독으로 갈지, 범정부로 갈지 오늘 정해야 내일 브리핑 형식이 나옵니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.brief],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '지역금고 창구·지급 대응',
      prompt: '오늘 창구에서 무엇을 하시겠습니까?',
      context:
        '예금은 요구불입니다. 지급을 늦추는 순간 "못 준다"는 소문이 사실이 됩니다. 창구 현금 배차는 오전 중에 결정해야 오후 마감까지 닿습니다.',
      requiredConcepts: ['regulator-escalation-ladder'],
      dimensions: ['compliance', 'liquidity'],
      timeLimitSec: 120,
      defaultOptionId: 't1-d1-a',
      availableFrom: 0,
      deadlineTick: 1,
      options: [
        {
          id: 't1-d1-a',
          label: '상환준비금 즉시 지원·현금 수송으로 전 지점 정시 지급',
          description:
            '중앙회 상환준비금을 요청 금고에 당일 지원하고 현금 수송을 늘린다. 합성 기관 내부 이동이므로 시스템 현금은 줄지 않는다.',
          effects: [flag('timely_payment')],
          expert: {
            rating: 75,
            rationale:
              '상환준비금의 존재 이유다. 모든 창구에서 지급이 정시에 이루어진다는 사실만이 "못 받을 수 있다"는 런의 전제를 무너뜨린다.',
            historicalNote:
              '실제 중앙회는 상환준비금으로 금고 창구를 지원했고 지급 지연 사례는 보고되지 않았다.',
            sourceRefs: [S.brief, S.fsb],
          },
          consequences: '현금 수송 차량이 증편되었습니다. 오후 마감까지 지급 지연 보고는 없습니다.',
          historical: true,
        },
        {
          id: 't1-d1-b',
          label: '5천만원 초과 인출은 익일 지급으로 유예',
          description: '큰 금액을 하루 늦춰 현금 압박을 줄인다.',
          effects: [regulator({ set: 4 }, '지급 유예(불건전 행위)'), flag('unsafe_act')],
          expert: {
            rating: 0,
            rationale:
              '지급 유예는 예금의 요구불성을 부정하는 행위로, 감독당국 반응표의 R4(인출 거부·지연)에 해당한다. 유예 사실이 알려지면 런은 붕괴(S3)로 넘어간다.',
            sourceRefs: [S.sb2011a, S.frc],
          },
          consequences: '유예 안내가 창구에 붙었습니다. 몇 분 뒤 사진이 SNS에 올라왔습니다.',
          trap: true,
          trapExplanation: '"시간을 벌자"는 유혹. 그러나 지급을 미루는 순간 금고는 금고가 아니다.',
          illegal: true,
          irreversible: true,
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't1-d1-c',
          label: '금고 자율 대응에 맡기고 중앙회 개입 최소화',
          description: '각 금고가 자체 현금으로 대응하게 둔다. 상환준비금 지원은 요청서 심사 후.',
          effects: [bankFx.addAmplifier(1.2, '정보 공백·지급 지연 우려')],
          expert: {
            rating: 25,
            rationale:
              '1,293개 금고의 창구 현금은 균일하지 않다. 일부 금고의 "오늘은 안 됩니다"가 전체의 뉴스가 된다(보정 규칙: 정보 공백 ×1.2).',
            sourceRefs: [S.fsb],
          },
          consequences: '두 금고에서 오후 늦게 현금이 바닥났다는 보고가 올라왔습니다.',
        },
        {
          id: 't1-d1-d',
          label: '중앙회장 명의 "예금은 안전합니다" 담화문 발표',
          description: '수치 없이 안심을 호소한다. 창구 지원은 통상 절차대로.',
          effects: [confidence(-3, '수치 없는 안심 담화')],
          expert: {
            rating: 30,
            rationale:
              '검증 가능한 숫자 없는 안심 메시지는 "숫자를 말할 수 없다"는 신호로 읽힌다(보정 규칙: 수치 없는 "침착" 콜 −3).',
            sourceRefs: [S.fsb],
          },
          consequences: '담화문이 배포되었습니다. 댓글은 "그래서 얼마 있는데?"로 채워졌습니다.',
        },
      ],
    },
    {
      id: 't1-d2',
      title: '대응 체계',
      prompt: '누가 이 사태를 지휘합니까?',
      context:
        '행안부 지역경제지원관이 14:00에 물어 왔습니다. 오늘 중에 정해야 내일 아침 브리핑 형식이 나옵니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['policy', 'timeliness'],
      availableFrom: 2,
      deadlineTick: 2,
      defaultOptionId: 't1-d2-a',
      options: [
        {
          id: 't1-d2-a',
          label: '행안부·기재부·금융위·금감원·한은 범정부 대응단 즉시 구성',
          description: '금융당국의 검사 인력과 신뢰를 빌린다. 내일 합동 브리핑이 가능해진다.',
          effects: [flag('task_force')],
          expert: {
            rating: 80,
            rationale:
              '행안부는 금융감독 경험이 얇고 시장은 그것을 안다. 금융위·금감원·한은이 같은 단상에 서는 것 자체가 검증 가능한 신호다.',
            historicalNote: '실제 7/6 합동 브리핑은 5개 기관 명의로 열렸다.',
            sourceRefs: [S.brief, S.support],
          },
          consequences:
            '대응단이 구성되었습니다. 금융위·금감원이 내일 브리핑 수치를 함께 검증합니다.',
          historical: true,
        },
        {
          id: 't1-d2-b',
          label: '행안부 단독 대응 유지',
          description: '소관 부처가 책임진다. 금융당국은 필요 시 자문.',
          effects: [flag('mois_alone')],
          expert: {
            rating: 25,
            rationale:
              '감독 전문성 부족이 이 사태의 배경 중 하나다. 단독 브리핑은 수치의 신뢰도가 낮고, 검사 인력도 부족하다.',
            sourceRefs: [S.audit2011, S.support],
          },
          consequences:
            '행안부가 단독 브리핑을 준비합니다. 금융위는 "요청이 있으면 참여"라고 답했습니다.',
        },
        {
          id: 't1-d2-c',
          label: '금융위로 감독권 즉시 이관 요청',
          description:
            '지금 소관을 바꾼다. 법 개정이 필요해 이번 주 실행이 불가능하고, 논쟁만 남긴다.',
          effects: [confidence(-2, '감독권 이관 논쟁 보도')],
          expert: {
            rating: 20,
            rationale:
              '중장기 과제로는 논의할 만하지만 위기 한복판의 소관 논쟁은 "누가 책임지느냐"는 혼선만 낳는다. 새마을금고법 개정 없이는 실행 불가.',
            sourceRefs: [S.kfccAct, S.audit2011],
          },
          consequences: '이관 요청이 보도되었습니다. 부처 간 책임 공방 기사가 나왔습니다.',
          feasibility: {
            basis: '새마을금고법 개정 필요 — 턴 내 실행 불가',
            sourceRefs: [S.kfccAct],
          },
        },
      ],
    },
  ],
  interrupts: [t1BranchCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '지급을 늦추는 어떤 조치도 감독당국 단계 R4(즉시 개입)입니다. 창구 현금은 상환준비금이 해결합니다.',
    },
    {
      level: 2,
      decisionId: 't1-d2',
      text: '검증 가능한 신호: 금융당국이 수치를 함께 확인해 주는 것 자체가 완화 요인입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2023-07-06 (목) "합동 브리핑"
// ---------------------------------------------------------------------------------------------

/** 14:00 기자 확인 요청. 대사는 당시 보도 흐름을 바탕으로 한 **재구성**이며 실제 통화가 아니다. */
const t2PressCall: Interrupt<BankState> = {
  id: 't2-i1-press',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 40,
  defaultOptionId: 't2-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '기자 확인 요청',
  prompt: '마감 전 확인 요청입니다. 오늘 인출 규모를 지금 말하시겠습니까?',
  dimensions: ['communication'],
  source: { kind: 'call', caller: '경제지 기자', tone: 'concerned' },
  lines: [
    {
      speaker: '기자',
      text: '오늘 인출이 어제보다 크다는 제보가 있습니다. 오후 4시 마감 기사에 넣어야 해서 지금 확인이 필요합니다. 수치를 주시겠습니까, 아니면 "확인 불가"로 쓸까요.',
    },
  ],
  options: [
    {
      id: 't2-i1-a',
      label: '마감 집계 후 오후 브리핑에서 공식 수치로 답하겠다',
      description:
        '집계 중인 수치를 미리 주지 않되, 언제 어디서 답할지를 시각으로 약속한다. 브리핑 전 공백은 몇 시간뿐이다.',
      effects: [flag('press_deferred_to_briefing')],
      expert: {
        rating: 70,
        rationale:
          '검증되지 않은 중간 집계를 흘리면 그 숫자가 공식 수치와 어긋나는 순간 모든 발표의 신뢰가 깎인다. 공백을 "언제 답하겠다"로 채우는 것이 FSB가 말하는 최소 요건이다.',
        sourceRefs: [S.fsb],
      },
      consequences: '기자가 "오후 브리핑에서 공식 집계 발표 예정"으로 쓰겠다고 답했습니다.',
      historical: true,
      preview: [{ metric: 'confidence', direction: 'flat', magnitude: 1, note: '브리핑까지 보류' }],
    },
    {
      id: 't2-i1-b',
      label: '현재까지 집계치를 그대로 알려준다',
      description:
        '오후 2시 기준 중간 집계를 준다. 마감치와 달라지면 정정해야 하고, 정정은 은폐로 읽힌다.',
      effects: [confidence(-2, '미확정 중간 집계 선공개')],
      expert: {
        rating: 35,
        rationale:
          '투명성처럼 보이지만 중간 집계는 확정치가 아니다. 같은 날 두 개의 숫자가 돌면 예금자는 큰 쪽을 믿는다.',
        sourceRefs: [S.fsb],
      },
      consequences: '중간 집계가 15시 속보로 나갔습니다. 마감치와 차이가 날 경우 정정해야 합니다.',
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
    },
    {
      id: 't2-i1-c',
      label: '"어제보다 크다는 것은 사실이 아니다"라고 부인',
      description: '집계가 끝나기 전에 방향을 단정한다. 마감치가 반대로 나오면 되돌릴 수 없다.',
      effects: [flag('press_denied')],
      delayedEffects: [
        {
          afterTurns: 1,
          description: '마감 집계가 부인과 어긋나 "정부가 축소했다" 보도 — 신뢰지수 −6, 증폭 ×1.3',
          effects: [
            confidence(-6, '부인과 마감 집계의 모순'),
            bankFx.addAmplifier(1.3, '축소 발표 인식'),
          ],
        },
      ],
      expert: {
        rating: 5,
        rationale:
          '검증이 예정된 사실을 부인하는 것은 가장 비싼 커뮤니케이션이다. 2011년 저축은행 사태의 "추가 영업정지 없다"가 이틀 만에 뒤집힌 것과 같은 구조다.',
        sourceRefs: [S.sb2011, S.fsb],
      },
      consequences: '부인 코멘트가 나갔습니다. 기자는 "마감 집계를 받아 대조하겠다"고 했습니다.',
      trap: true,
      trapExplanation:
        '오늘 한 줄 기사를 막는 대가로 내일 검증을 예약하는 선택이다. 인출 집계는 반드시 공표되므로 부인은 언제나 발각된다.',
      preview: [
        { metric: 'confidence', direction: 'down', magnitude: 3, note: '다음 턴 모순 판정' },
      ],
    },
  ],
}

/**
 * T2.D1 합동 브리핑 문안 협의 (3단계). 대사는 7/6 관계부처 합동 브리핑의 공개 기록을 바탕으로 한
 * **재구성**이며 속기록이 아니다. 약속한 유동성 규모는 `pledgedSupport` 카운터로 이산화되고,
 * 이행(당일 현금화 가능성) 여부는 다음 턴 지연효과가 판정한다 — `calibration.md` §10 참조.
 */
const t2BriefingSteps: DialogueStep<BankState>[] = [
  {
    id: 't2-d1-forum',
    lines: [
      {
        speaker: '행안부 대변인실',
        text: '오후 브리핑 형식을 지금 확정해야 자료가 나갑니다. 누가 단상에 서고, 무엇을 말하는 자리로 만들지 정해 주십시오.',
      },
    ],
    replies: [
      {
        id: 'forum-joint',
        label: '5개 기관 합동 브리핑으로 연다',
        when: { flag: 'task_force' },
        next: 't2-d1-support',
        expert: {
          rating: 85,
          rationale:
            '행안부 단독 수치는 시장이 검증하지 못한다. 금융위·금감원·한은이 같은 단상에 서는 것 자체가 검증 가능한 신호다.',
        },
      },
      {
        id: 'forum-mois',
        label: '행안부 단독 메시지로 간다',
        resolvesTo: 't2-d1-c',
        expert: {
          rating: 25,
          rationale: '소관 부처의 안심 메시지는 "금융당국은 왜 빠졌나"를 남긴다.',
        },
      },
      {
        id: 'forum-silent',
        label: '브리핑 없이 공시 자료와 FAQ만 게시한다',
        resolvesTo: 't2-d1-d',
        expert: { rating: 15, rationale: '정보 공백은 SNS와 언론이 채운다.' },
      },
    ],
  },
  {
    id: 't2-d1-support',
    lines: [
      {
        speaker: '기재부 차관보',
        text: '"지금 당장 쓸 수 있는 돈이 얼마냐"가 첫 질문이 될 겁니다. 상환준비금 13.4조, 즉시 가용 현금·예치금까지 30.7조, 채권을 포함한 현금성자산 전체는 77.3조입니다. 어느 숫자를 단상에서 말하시겠습니까.',
      },
    ],
    note: '여기서 말한 규모는 다음 날 "그중 오늘 현금이 되는 돈은 얼마입니까"로 검증됩니다.',
    replies: commitReplies<BankState>('pledgedSupport', [13, 30, 77], {
      unit: '조원',
      label: (v) =>
        v === 13
          ? '상환준비금 13조원만 말한다'
          : v === 30
            ? '즉시 가용 현금·예치금까지 30조원으로 말한다'
            : '현금성자산 전체 77조원으로 말한다',
      next: 't2-d1-promise',
      expert: (v) => ({
        rating: v === 30 ? 85 : v === 13 ? 55 : 45,
        rationale:
          v === 30
            ? '당일 지급에 실제로 쓸 수 있는 돈만 말한다. 다음 날 "그중 얼마가 현금이냐"는 질문에 같은 숫자로 답할 수 있는 유일한 값이다.'
            : v === 13
              ? '틀린 말은 아니지만 가진 여력을 과소 공표해 "그것뿐이냐"는 반문을 부른다.'
              : '실제 브리핑이 쓴 숫자다. 다만 77.3조 중 60조는 채권이라 팔거나 RP로 넘겨야 현금이 되고, 담보차입 여력이 없으면 "언제 현금이 되느냐"에 답할 수 없다.',
      }),
    }),
  },
  {
    id: 't2-d1-promise',
    lines: [
      {
        speaker: '금융위 사무처',
        text: '보장 범위가 남았습니다. 새마을금고법상 합병이면 5천만원 초과 원리금도 승계됩니다. 거기서 멈추시겠습니까, 아니면 "추가 부실 금고는 없다"까지 말하시겠습니까.',
      },
    ],
    note: '특별검사 30개는 아직 진행 중입니다.',
    replies: [
      {
        id: 'promise-legal',
        label: '법이 보장하는 범위(합병 시 전액 승계)까지만 약속한다',
        resolvesTo: 't2-d1-a',
        expert: {
          rating: 85,
          rationale:
            '약속의 범위를 법이 보장하는 곳에서 멈추면 이후 어떤 검사 결과가 나와도 발표가 뒤집히지 않는다.',
        },
      },
      {
        id: 'promise-no-more',
        label: '"추가 부실 금고는 없다"까지 단언한다',
        resolvesTo: 't2-d1-b',
        expert: {
          rating: 20,
          rationale:
            '오늘의 줄을 가장 빨리 줄이는 말이지만, 검사가 끝나지 않은 상태의 단언은 반드시 시험받는다.',
        },
        trap: true,
        trapExplanation:
          '2011년 2월 17일 금융위는 "과도한 예금인출이 없는 한 상반기 추가 영업정지는 없다"고 했고 이틀 뒤 4개를 추가 정지했다. 검증 불가능한 약속은 모순되는 순간 이전 발표의 신뢰까지 함께 무너뜨린다.',
      },
    ],
  },
]

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2023년 7월 6일 (목) 09:00 KST',
  title: '합동 브리핑',
  time: '2023-07-06T09:00:00+09:00',
  ticks: 4,
  tickLabels: QUEUE_TICK_LABELS,
  entryEffects: [
    {
      id: 't2-settle',
      description: '익일 결제 RP 라인 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't2-media',
      description: '언론·SNS 확산(외생): 전국 지점 문의 폭주 → 신뢰지수 −3, 증폭 ×1.2',
      effects: [confidence(-3, '언론·SNS 확산(외생)'), bankFx.addAmplifier(1.2, 'SNS 바이럴')],
    },
    {
      id: 't2-market',
      description: '개장 앵커: 원/달러 1,304.5원, 국고 2년 3.677%, 국고 3년 3.618% (7/5 종가)',
      effects: [
        op('market.fxUsdLocal', 'set', 1304.5, '7/6 시가'),
        op('market.govt2yBp', 'set', 368, '국고 2년 7/5 종가 3.677%'),
        op('market.custom.govt3y', 'set', 362, '국고 3년 7/5 종가 3.618%'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't2-runoff-tick',
      description: '7/6 창구 인출 (전국 확산 — 하루 종일)',
      effects: [mgFx.runoffTicks({ profile: T2_QUEUE_PROFILE, label: '7/6 인출' })],
    },
  ],
  ticker: {
    series: [
      // 원/달러 시가 1,304.5 · 고가 1,306.8 · 저가 1,300.1 · 종가 1,300.9 [ecos-731Y003]
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [1304.5, 1306.8, 1300.1, 1300.9] },
      // 국고채 2년 3.677% → 3.732% (7/6 종가) [ecos-817Y002]
      { path: 'market.govt2yBp', mode: 'absolute', values: [368, 369, 371, 373] },
      // 국고채 3년 3.618% → 3.676% (7/6 종가) [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [362, 364, 366, 368] },
    ],
  },
  events: [
    {
      id: 't2-news-spread',
      kind: 'newswire',
      outlet: '주요 일간지',
      time: '07:30',
      headline: '새마을금고 예금 이탈 확산 — 전국 지점 문의 폭주, "5천만원 넘는 돈은 빼야 하나"',
      body: '남양주에서 시작된 인출이 다른 지역으로 번지고 있다. 예금자보호법 대상이 아니라는 점, 연체율 6%대, 부동산 PF 익스포저가 함께 거론된다.',
      severity: 'critical',
      cardRefs: ['bank-run-dynamics', 'mutual-credit-deposit-protection'],
    },
    {
      id: 't2-data-flow',
      kind: 'data',
      time: '09:00',
      title: '인출 현황 (개장 전)',
      rows: [
        { label: '어제 순인출', value: '{{metric:dailyOutflow}}' },
        { label: '누적 순인출', value: '{{metric:cumulativeOutflow}}' },
        { label: '상환준비금·가용현금', value: '{{metric:cash}}' },
        { label: '담보차입 여력(당일)', value: '{{metric:facilityHeadroom}}' },
      ],
      severity: 'critical',
    },
    {
      id: 't2-memo-funding',
      kind: 'memo',
      time: '09:20',
      from: '중앙회 자금운용부',
      to: '범정부 대응단 담당관',
      subject: '조달 선택지',
      body: `- **채권 매도**: 국고채·통안채는 당일 체결 가능. 1~2조는 시장이 소화하지만 5조 블록은 금리를 밀어 올리고 "새마을금고 투매" 보도가 붙습니다.
- **은행권 RP**: 국고채·통안채를 담보로 5대 은행·산은·기은이 매입. 약정에 1영업일, 이후 당일 결제. 평가손 실현 없음.
- **한국은행**: RP 대상기관 아님. 65조 긴급여신은 금통위 의결 필요.
- 상환준비금은 오늘 유출 속도라면 2주 이상 버팁니다. 문제는 속도가 빨라질 때입니다.`,
      severity: 'warning',
      sourceRefs: [S.bondSale, S.bankRp, S.bokAct],
      cardRefs: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
      relatedMetrics: ['cash', 'facilityHeadroom', 'survivalDays'],
    },
    {
      id: 't2-call-moef',
      kind: 'call',
      when: { flag: 'task_force' },
      time: '10:00',
      atTick: 1,
      caller: '기획재정부 차관보',
      callee: '범정부 대응단 담당관',
      agency: '기획재정부',
      tone: 'concerned',
      lines: [
        {
          speaker: '차관보',
          text: '금융위·금감원이 중앙회 수치를 확인했습니다. 예수금 259.6조, 연체액 12.16조, 상환준비금 13.36조, 현금성자산 77.3조, 예금자보호준비금 2.6조. 이 숫자로 오후 브리핑을 합니다. 메시지 수위는 담당관이 정하십시오.',
        },
        {
          speaker: '담당관',
          text: '"합병 시에도 5천만원 초과 원리금 지급"까지는 법적으로 확실합니다. 그 이상은 근거가 필요합니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.brief, S.kfccAct],
    },
    {
      id: 't2-reg-fsc-absent',
      kind: 'regulator',
      when: { flag: 'mois_alone' },
      agency: '금융위원회',
      time: '10:00',
      atTick: 1,
      headline: '금융위 "행안부 요청 없이는 브리핑 참여 어려움"',
      body: '행안부 단독 브리핑이 예정되어 있다. 시장은 "금융당국이 왜 빠졌나"를 묻고 있다.',
      tone: 'concerned',
      severity: 'warning',
    },
    {
      id: 't2-news-delayed-2',
      kind: 'newswire',
      when: { flag: 'disclosure_delayed' },
      outlet: '주요 일간지',
      time: '08:00',
      headline: '"숨긴 게 더 있나" — 은폐 논란에 정부 발표 신뢰도 추락',
      body: '어제 단독 보도 이후 정부와 중앙회가 내놓는 모든 숫자에 "믿을 수 있느냐"는 질문이 따라붙고 있다.',
      severity: 'critical',
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '브리핑 메시지',
      prompt: '오후 브리핑에서 무엇을 말하시겠습니까?',
      context:
        '수치는 확인되었습니다. 문제는 어디까지 약속하느냐입니다. 법이 보장하는 것, 정부가 하겠다는 것, 그리고 하고 싶은 말은 다릅니다. 브리핑은 창구 마감 집계를 받은 뒤에 열립니다 — 오늘의 줄은 이미 끝났고, 이 메시지가 정하는 것은 내일 아침 줄의 길이입니다.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'policy'],
      timeLimitSec: 150,
      defaultOptionId: 't2-d1-c',
      availableFrom: 3,
      select: { min: 1, max: 1 },
      steps: t2BriefingSteps,
      options: [
        {
          id: 't2-d1-a',
          label: '합동 브리핑: 수치 공개 + "합병 시 5천만원 초과도 전액 지급" 약속',
          description:
            '5개 기관 명의로 예수금·상환준비금·현금성자산·예금자보호준비금을 공개하고, 부실 금고는 합병으로 처리하며 그 경우 5천만원 초과 원리금도 지급된다고 밝힌다. 법적 근거(합병 시 예금 승계)가 있는 범위까지만 약속한다.',
          requires: { flag: 'task_force' },
          unavailableReason:
            '범정부 대응단이 구성되지 않아 합동 브리핑을 열 수 없습니다 (T1에서 행안부 단독 대응 선택).',
          effects: [
            mgFx.discloseFigures(),
            confidence(12, '"합병 시 5천만원 초과 전액 지급" 약속'),
            bankFx.setDampener(0.8, '인식된 보장 범위 확대(합병 시 전액 승계)'),
            flag('full_payment_promise'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: {
                all: [
                  { counter: 'pledgedSupport', gte: 70 },
                  { metric: 'facilityHeadroom', lt: 1 },
                ],
              },
              description:
                '"77조 중 오늘 현금이 되는 돈은 얼마입니까" — 담보차입 여력이 없어 즉시 지급 가능액을 대지 못함 → 신뢰지수 −5, 증폭 ×1.15',
              effects: [
                confidence(-5, '공표한 유동성 규모의 즉시 가용성 미입증'),
                bankFx.addAmplifier(1.15, '공표 규모와 당일 가용액의 괴리'),
              ],
            },
          ],
          expert: {
            rating: 85,
            rationale:
              '실제 7/6 브리핑. 검증 가능한 수치와 법적 근거가 있는 보장을 같은 자리에서 말했고, 다음 날 인출이 전일 대비 약 1조 줄었다. 약속의 범위를 법이 보장하는 곳에서 멈춘 것이 핵심이다.',
            historicalNote: '7/6 관계부처 합동 브리핑(행안부·기재부·금융위·금감원·한은).',
            sourceRefs: [S.brief, S.redeposit, S.fsb],
          },
          consequences:
            '브리핑이 끝났습니다. 저녁 뉴스는 "정부, 5천만원 초과도 지급"을 제목으로 뽑았습니다.',
          historical: true,
          calibrationNote:
            '수치 공개 +5(여력 ≥ 5천만원 초과 예금 50%일 때) + 전액 지급 약속 +12, 완화 ×0.8 [CAL: 7/7 전일比 −1조 앵커; 가이드의 피어 암묵 보장 0.5보다 약한 조건부(합병 시) 보장]',
          feasibility: {
            basis: '합병 시 예금 승계는 새마을금고법상 확정; 수치는 금융위·금감원 확인',
            sourceRefs: [S.kfccAct, S.brief],
          },
        },
        {
          id: 't2-d1-b',
          label: '위 브리핑에 "추가 부실 금고는 없다" 단언을 추가',
          description:
            '"남양주동부 외에 추가로 부실한 금고는 없으며, 과도한 인출만 없다면 합병도 더 없다"고 못 박는다. 특별검사 30개는 아직 진행 중이다.',
          requires: { flag: 'task_force' },
          unavailableReason: '범정부 대응단이 구성되지 않아 합동 브리핑을 열 수 없습니다.',
          effects: [
            mgFx.discloseFigures(),
            confidence(17, '전액 지급 약속 + "추가 부실 없다" 단언'),
            bankFx.setDampener(0.7, '강한 안심 메시지(단기)'),
            flag('full_payment_promise'),
            flag('conditional_reassurance'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: {
                all: [
                  { counter: 'pledgedSupport', gte: 70 },
                  { metric: 'facilityHeadroom', lt: 1 },
                ],
              },
              description:
                '"77조 중 오늘 현금이 되는 돈은 얼마입니까" — 담보차입 여력이 없어 즉시 지급 가능액을 대지 못함 → 신뢰지수 −5, 증폭 ×1.15',
              effects: [
                confidence(-5, '공표한 유동성 규모의 즉시 가용성 미입증'),
                bankFx.addAmplifier(1.15, '공표 규모와 당일 가용액의 괴리'),
              ],
            },
            {
              afterTurns: 2,
              description:
                '특별검사 과정에서 추가 부실 금고가 확인·보도됨 → "없다"던 단언이 모순되어 증폭 ×1.5, 신뢰지수 −20',
              effects: [
                bankFx.addAmplifier(1.5, '조건부 안심 발언 붕괴'),
                confidence(-20, '"추가 부실 없다" 단언 붕괴'),
                flag('reassurance_contradicted'),
              ],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '2011.2.17 금융위는 "과도한 예금인출 없는 한 상반기 추가 영업정지 없을 것"이라 했고 이틀 뒤 4개를 추가 정지했다. 검사 중인 100개 금고를 두고 "없다"고 말하는 것은 검증 불가능한 약속이며, 모순이 드러나면 증폭기(×1.5)가 된다.',
            sourceRefs: [S.sb2011, S.fsb],
          },
          consequences:
            '브리핑이 끝났습니다. 당장은 효과가 큽니다. 검사역들은 "30개 특별검사 결과가 나오면…"이라고 말끝을 흐립니다.',
          trap: true,
          trapExplanation:
            '오늘의 줄을 줄이는 가장 강한 말은 "더는 없다"이다. 그러나 검사가 끝나지 않은 상태에서 한 단언은 반드시 시험받고, 모순되는 순간 이전 발표의 신뢰까지 함께 무너진다 — 2011년 2월 17일의 교훈.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't2-d1-c',
          label: '행안부 단독 "새마을금고는 안전합니다" 메시지(수치 없음)',
          description: '소관 부처가 안심을 호소한다. 구체 수치·보장 범위는 언급하지 않는다.',
          effects: [confidence(-3, '수치 없는 안심 메시지')],
          expert: {
            rating: 25,
            rationale:
              '검증 가능한 숫자 없는 안심 메시지는 작동하지 않는다(보정 규칙 −3). 금융당국 부재는 "왜 빠졌나"를 남긴다.',
            sourceRefs: [S.fsb, S.audit2011],
          },
          consequences:
            '브리핑이 끝났습니다. 기자들의 첫 질문은 "그래서 상환준비금이 얼마입니까"였습니다.',
        },
        {
          id: 't2-d1-d',
          label: '브리핑 없이 공시 자료와 FAQ만 게시',
          description: '법무의 우려로 공식 발언을 피한다.',
          effects: [confidence(-3, '정보 공백'), bankFx.addAmplifier(1.2, '정보 공백(침묵)')],
          expert: {
            rating: 15,
            rationale: '정보 공백은 SNS와 언론이 채운다(보정 규칙: 침묵 ×1.2).',
            sourceRefs: [S.fsb, S.sb2011],
          },
          consequences: 'FAQ가 게시되었습니다. 조회수는 높지만 댓글은 "정부는 왜 말이 없나"입니다.',
        },
      ],
    },
    {
      id: 't2-d2',
      title: '중앙회 조달',
      prompt: '오늘 현금을 어떻게 확보하시겠습니까? (최대 2개)',
      context:
        '채권 매도와 RP 체결은 당일 결제를 받으려면 오후 장이 끝나기 전에 지시가 나가야 합니다.',
      select: { min: 1, max: 2 },
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't2-d2-a',
      exclusive: [
        ['t2-d2-a', 't2-d2-b'],
        ['t2-d2-a', 't2-d2-d'],
        ['t2-d2-b', 't2-d2-d'],
        ['t2-d2-c', 't2-d2-d'],
      ],
      requiredConcepts: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'marketRisk'],
      options: [
        {
          id: 't2-d2-a',
          label: '국고채·통안채 1.6조 시장 매도',
          description: '당일 체결. 평가손을 소폭 실현하고 "중앙회 매도" 보도가 붙는다.',
          effects: [
            bankFx.sellSecurities({
              book: 'afs',
              amount: 1.6,
              fireSaleRef: 5,
              label: '채권 1.6조 매도',
            }),
            confidence(-3, '중앙회 채권 매도 보도(시장 불안)'),
          ],
          expert: {
            rating: 55,
            rationale:
              '작동하지만 대가가 있다. 매도는 국고채 금리 상승 압력과 "새마을금고발" 보도를 낳았고, 나흘 뒤 은행 RP로 대체되었다. RP가 먼저였다면 매도는 불필요했다.',
            historicalNote: '7/6 중앙회 채권 약 1.6조 매도(2차 출처).',
            sourceRefs: [S.bondSale, S.bankRp],
          },
          consequences:
            '1.6조가 체결되었습니다. 채권 데스크: "시장이 눈치챘습니다. 금리가 3bp 올랐습니다."',
          historical: true,
          calibrationNote:
            '손실 = 2%×1.6 + 파이어세일 1%×√(1.6/5) ≈ 0.04조 [CAL]; ΔCI −3 [CAL: 소규모 매도 보도]',
        },
        {
          id: 't2-d2-b',
          label: '채권 5조 즉시 매도로 현금 두텁게 확보',
          description: '한 번에 크게 판다. 국고채 시장이 하루에 소화하기 어려운 규모다.',
          effects: [
            bankFx.sellSecurities({
              book: 'afs',
              amount: 5,
              fireSaleRef: 5,
              label: '채권 5조 블록 매도',
            }),
            confidence(-8, '"새마을금고발 채권 투매" 보도·금리 급등'),
            {
              kind: 'op',
              path: 'market.govt2yBp',
              op: 'add',
              value: 10,
              label: '국고채 금리 +10bp',
            },
            flag('bond_dump'),
          ],
          expert: {
            rating: 15,
            rationale:
              '현금은 늘지만 시장 충격이 곧 뉴스가 되어 런의 재료가 된다("얼마나 급하면 5조를"). 같은 담보로 RP를 하면 평가손도 충격도 없다. 파이어세일 할인은 규모의 제곱근에 비례한다.',
            sourceRefs: [S.bondSale, S.bokOmo],
          },
          consequences:
            '5조 블록이 할인 체결되었습니다. 저녁 뉴스: "새마을금고 채권 투매, 국고채 금리 급등".',
          trap: true,
          trapExplanation:
            '"현금이 많으면 안전하다"는 직관. 그러나 현금을 만드는 방법 자체가 신호다. 투매는 "급하다"를 시장 전체에 공표하는 것이다.',
          irreversible: true,
          remediationCard: 'hqla-and-haircuts',
        },
        {
          id: 't2-d2-c',
          label: '5대 은행·산은·기은과 RP 6조 체결 협의 (익일 결제)',
          description:
            '국고채·통안채를 담보로 은행이 RP 매입. 사전 협의가 있었다면 오늘 당일 결제, 아니면 내일 결제.',
          effects: [
            mgFx.bankRp({ amount: 6, settle: 'next', label: '은행권 RP 6조 협의' }),
            flag('rp_negotiating'),
          ],
          expert: {
            rating: 80,
            rationale:
              '평가손 실현도 시장 충격도 없이 6조를 만드는 유일한 경로. 한은 창구가 없는 기관에게 은행 RP는 사실상의 최종대부자 우회로다.',
            sourceRefs: [S.bankRp, S.bokOmo],
          },
          consequences: '은행 자금부들과 담보 목록을 확정했습니다. 결제 시점은 로그를 확인하세요.',
        },
        {
          id: 't2-d2-d',
          label: '추가 조달 없이 상환준비금으로 대응',
          description: '아직 여력이 있다.',
          effects: [],
          expert: {
            rating: 35,
            rationale:
              '오늘은 맞을 수 있지만 내일 유출이 두 배가 되면 선택지가 사라진다. 조달은 필요할 때가 아니라 가능할 때 한다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '추가 조달 없이 마감했습니다.',
        },
        {
          id: 't2-d2-e',
          label: '한국은행에 긴급여신(한은법 65조) 요청',
          description: '최종대부자 창구를 연다.',
          requires: { flag: 'bok_access' },
          unavailableReason:
            '새마을금고중앙회는 한은 RP 대상기관이 아니며, 65조 긴급여신은 금통위 4명 이상 찬성·정부 의견 청취 절차로 이번 주 안에 실행할 수 없습니다.',
          effects: [],
          expert: {
            rating: 40,
            rationale:
              '당시에는 열리지 않은 창구. 최종대부자 접근성 부재가 이 사태의 구조적 취약점이다.',
            sourceRefs: [S.bokAct, S.bokOmo],
          },
          consequences: '요청서가 접수되었습니다.',
          feasibility: { basis: '한은법 65조 금통위 의결 요건', sourceRefs: [S.bokAct] },
        },
      ],
    },
  ],
  interrupts: [t2PressCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '법이 보장하는 범위(합병 시 예금 승계)와 검사가 끝나야 알 수 있는 것("추가 부실 없음")을 구분하세요.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: '보정 규칙: 검증 가능 수치 공표 +5, 인식된 보장 확대 완화 ×0.8; 조건부 단언은 모순 시 ×1.5 증폭, ΔCI −20.',
    },
    {
      level: 3,
      decisionId: 't2-d2',
      text: '같은 담보라면 매도(C보다 A/B)보다 RP(C)가 낫습니다. 매도는 평가손과 시장 신호를 남깁니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2023-07-07 (금) "재예치"
// ---------------------------------------------------------------------------------------------
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2023년 7월 7일 (금) 09:00 KST',
  title: '재예치 조치',
  time: '2023-07-07T09:00:00+09:00',
  entryEffects: [
    {
      id: 't3-settle',
      description: '익일 결제 RP 반영(해당 시)',
      effects: [bankFx.settlePendingCapacity()],
    },
    {
      id: 't3-market',
      description: '7/7 종가: 원/달러 1,305.0원, 국고 2년 3.780%, 국고 3년 3.735%',
      effects: [
        op('market.fxUsdLocal', 'set', 1305, '7/7 종가'),
        op('market.govt2yBp', 'set', 378, '국고 2년 3.780%'),
        op('market.custom.govt3y', 'set', 374, '국고 3년 3.735%'),
      ],
    },
    {
      id: 't3-runoff',
      description: '7/7 당일 인출',
      effects: [mgFx.runoffDays({ days: 1, label: '7/7 인출' })],
    },
  ],
  events: [
    {
      id: 't3-data-flow',
      kind: 'data',
      time: '09:00',
      title: '인출 추이',
      rows: [
        { label: '어제 순인출', value: '{{metric:dailyOutflow}}' },
        { label: '누적 순인출', value: '{{metric:cumulativeOutflow}}' },
        { label: '상환준비금·가용현금', value: '{{metric:cash}}' },
        { label: '시장 신뢰지수', value: '{{metric:confidence}}' },
      ],
      severity: 'warning',
    },
    {
      id: 't3-news-slowing',
      kind: 'newswire',
      when: { flag: 'full_payment_promise' },
      outlet: '연합뉴스',
      time: '17:30',
      headline: '정부 브리핑 뒤 새마을금고 인출 둔화 — 중도해지 고객 "다시 넣을 수 있나" 문의',
      body: '"5천만원 초과도 지급"이 알려지면서 대기 행렬이 짧아졌다. 며칠 새 만기 전 해지한 예금자 중 일부는 이자 손실을 아쉬워하며 재예치 가능 여부를 묻고 있다.',
      severity: 'positive',
      sourceRefs: [S.redeposit],
    },
    {
      id: 't3-news-bond-shock',
      kind: 'newswire',
      when: { flag: 'bond_dump' },
      outlet: '경제지',
      time: '08:00',
      headline: '새마을금고발 채권 투매에 국고채 금리 급등 — "얼마나 급하길래"',
      body: '어제 5조 블록 매도가 시장에 알려지며 금리가 급등했다. 채권 운용사들은 "추가 매도가 있을지"를 묻고 있다.',
      severity: 'critical',
      sourceRefs: [S.bondSale],
    },
    {
      id: 't3-memo-redeposit',
      kind: 'memo',
      time: '09:30',
      from: '중앙회 영업지원부',
      to: '범정부 대응단 담당관',
      subject: '중도해지 고객 재예치 인센티브 검토',
      body: `- 7/1~7/6 중도해지 건수가 평소의 두 배를 넘습니다. 해지 고객은 약정 이자를 잃었고 비과세 혜택도 소멸됐습니다.
- 해지분을 재예치하면 **최초 약정 이율·만기·비과세 혜택을 복원**하는 방안: 전례가 없지만 금고 규정과 기재부(비과세) 협의로 이번 주 시행 가능합니다.
- 비용은 미지급 이자 재지급. 도덕적 해이 논란(해지 안 한 고객과의 형평)이 있을 수 있습니다.`,
      severity: 'warning',
      sourceRefs: [S.redeposit],
    },
    {
      id: 't3-call-fsc',
      kind: 'call',
      when: { flag: 'task_force' },
      time: '11:00',
      caller: '금융위원장 비서실',
      callee: '범정부 대응단 담당관',
      agency: '금융위원회',
      tone: 'routine',
      lines: [
        {
          speaker: '비서실',
          text: '위원장이 오후에 새마을금고 지점을 방문해 예금에 가입하겠다고 합니다. 행안부 차관도 동행 의사입니다. 진행할까요?',
        },
      ],
      severity: 'info',
      sourceRefs: [S.redeposit],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '재예치·예금 유지 조치',
      prompt: '빠져나간 예금을 어떻게 되돌리시겠습니까?',
      requiredConcepts: ['crisis-communication', 'mutual-credit-deposit-protection'],
      dimensions: ['policy', 'communication'],
      options: [
        {
          id: 't3-d1-a',
          label: '7/1~7/6 중도해지분 재예치 시 이자·만기·비과세 복원',
          description:
            '7/14까지 재예치하면 해지 전 조건을 되살린다. 전례 없는 조치. 비용은 미지급 이자.',
          effects: [
            confidence(8, '재예치 조치(이자·비과세 복원)'),
            bankFx.setDampener(0.7, '재예치 인센티브'),
            flag('redeposit'),
          ],
          expert: {
            rating: 85,
            rationale:
              '해지의 비용을 없애 "빼도 손해 없다"를 "다시 넣으면 손해 없다"로 바꾼다. 실제로 재예치가 일 3,000건 이상 들어왔고 인출은 전일 대비 약 1조 줄었다. 도덕적 해이 논란은 있지만 런의 비용이 훨씬 크다.',
            historicalNote: '7/7 범정부 대응단 발표, 7/14 기간 확대.',
            sourceRefs: [S.redeposit, S.fsb],
          },
          consequences: '재예치 창구가 열렸습니다. 첫날 접수가 3,000건을 넘었습니다.',
          historical: true,
          calibrationNote: 'ΔCI +8, 완화 ×0.7 [CAL: 7/10 이후 일 인출 0.6~0.7조 경로 재현]',
          feasibility: {
            basis: '금고 예금 규정 + 기재부 비과세 협의로 주내 시행',
            sourceRefs: [S.redeposit],
          },
        },
        {
          id: 't3-d1-b',
          label: '예금금리 +1%p 특판으로 신규 예금 유치',
          description: '가격으로 붙잡는다. 이자 비용이 크고, 런 상태에서는 효과가 거의 없다.',
          effects: [mgFx.depositRateDefense({ bp: 100 })],
          expert: {
            rating: 35,
            rationale:
              '지급능력 우려로 시작된 런은 가격으로 멈추지 않는다(보정 규칙: 예금금리 인상은 S1에서만 ×0.95). "높은 금리"는 오히려 "급하다"로 읽힐 수 있다.',
            sourceRefs: [S.frc, S.fsb],
          },
          consequences: '특판 안내가 나갔습니다. 반응은 미미합니다.',
        },
        {
          id: 't3-d1-c',
          label: '중도해지 수수료·이자 손실만 면제(재예치 없음)',
          description: '해지 비용을 줄여 불안을 낮추되, 되돌리는 유인은 주지 않는다.',
          effects: [confidence(3, '해지 비용 면제'), bankFx.setDampener(0.9, '해지 부담 완화')],
          expert: {
            rating: 50,
            rationale:
              '방향은 맞지만 "다시 넣을 이유"가 없다. 인출을 줄이는 효과만 있고 회복 효과는 없다.',
            sourceRefs: [S.redeposit],
          },
          consequences: '면제 안내가 나갔습니다. 인출은 조금 줄었지만 재예치는 없습니다.',
        },
        {
          id: 't3-d1-d',
          label: '추가 조치 없이 브리핑 효과를 지켜본다',
          description: '어제 메시지가 작동하는지 본다.',
          effects: [],
          expert: {
            rating: 15,
            rationale: '주말 전 금요일이다. 월요일 아침 줄은 금요일에 무엇을 했느냐로 정해진다.',
            sourceRefs: [S.fsb, S.sb2011],
          },
          consequences: '아무 조치도 취하지 않았습니다.',
        },
      ],
    },
    {
      id: 't3-d2',
      title: '고위급 퍼포먼스',
      prompt: '장관·위원장의 예금 가입 방문을 진행하시겠습니까?',
      dimensions: ['communication'],
      options: [
        {
          id: 't3-d2-a',
          label: '금융위원장·행안부 차관 지점 방문, 예금 가입 공개',
          description:
            '위원장이 6천만원(5천만원 초과)을 예치하고 차관이 지점을 방문한다. 상징적 신호.',
          effects: [confidence(2, '장·차관 예금 가입 퍼포먼스'), flag('minister_deposit')],
          expert: {
            rating: 60,
            rationale:
              '숫자 뒤에 오는 상징은 보조 효과가 있다(ΔCI +2 [CAL]). 단독으로는 힘이 없지만 전액 지급 약속·재예치와 함께 "정부가 자기 돈을 넣었다"는 검증 가능한 행동이 된다.',
            historicalNote: '7/7 김주현 금융위원장 6천만원 예금, 행안부 차관 지점 방문.',
            sourceRefs: [S.redeposit, S.fsb],
          },
          consequences: '방문 사진이 저녁 뉴스에 나갔습니다. 댓글은 반반입니다.',
          historical: true,
        },
        {
          id: 't3-d2-b',
          label: '방문 없이 보도자료로 갈음',
          description: '퍼포먼스는 하지 않는다.',
          effects: [],
          expert: {
            rating: 45,
            rationale: '손해는 없지만 얻는 것도 없다. 검증 가능한 행동 하나를 포기한다.',
            sourceRefs: [S.fsb],
          },
          consequences: '보도자료만 배포했습니다.',
        },
        {
          id: 't3-d2-c',
          label: '"정부가 모든 예금을 책임진다"는 고위급 메시지 요청',
          description:
            '법적 근거 없는 포괄 보증을 말로 한다. 당장은 강하고, 곧 "근거가 뭐냐"는 질문이 온다.',
          effects: [confidence(4, '고위급 포괄 보증 메시지'), flag('political_guarantee')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '"법적 근거 없는 보증" 비판 보도 → 신뢰지수 −6',
              effects: [confidence(-6, '포괄 보증의 법적 근거 논란')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '새마을금고법상 보호는 5천만원이고 정부 보증에는 국회 동의가 필요하다. 근거 없는 말은 며칠 안에 검증되고, 검증에 실패한 말은 이전 약속까지 의심하게 만든다.',
            sourceRefs: [S.kfccAct, S.sb2011],
          },
          consequences: '메시지가 나갔습니다. 야당이 "근거 법령을 밝히라"고 요구했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '"당일 예금 순유출"이 어제보다 줄었습니까? 줄었다면 지금은 회복 조치(재예치)를 넣을 때입니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: '재예치(A)는 인출의 비용을 없애는 조치입니다. 금리 특판(B)은 런 상태에서 작동하지 않습니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3]
