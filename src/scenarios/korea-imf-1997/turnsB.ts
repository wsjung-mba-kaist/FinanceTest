import type { CentralBankState, DialogueStep, Interrupt, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, counter, flag, regulator } from '../../engine/fx/common'
import { imfFx } from './fx'
import { S } from './turnsA'

/**
 * 두 개의 다단계 협상(docs/authoring-guide.md §12). 12월 3일 의향서 협상과 1998년 1월 뉴욕 외채협상은
 * 실제로 며칠에 걸친 주고받기였고, 한 번의 클릭으로는 그 구조가 보이지 않는다.
 *
 * **대사 고지**: 아래 모든 발언은 기록(의향서 본문, 프로그램 문서, 협상 결과 보도)에 기초한
 * **개연성 있는 재구성**이며 어떤 것도 실제 발언의 인용이나 회의록이 아니다.
 *
 * 숫자 약속은 `commitReplies`로 이산 선택지가 되고, 이행·효과는 나중에 판정된다.
 *  · `loiRateCeilingPct` — 의향서에서 약속한 콜금리 상한(15 / 21 / 30). 역사 기준값 21.
 *    귀결 옵션의 `delayedEffects`가 다음 턴에서 판정한다(낮으면 이행 점검 지연, 높으면 실물 충격).
 *  · `debtGuaranteeBn` — 뉴욕 협상에서 제시한 국가보증 규모(0 / 120 / 240억달러). 역사 기준값 240.
 *    `rolloverAgreement`가 이 값에 비례해 전환액·예치금 환류·신뢰 회복을 정한다.
 * 두 카운터 모두 initialState에서 역사 기준값으로 초기화되어, 대화를 건너뛰어도(마감 스윕)
 * 역사적 결과가 재현된다. [CAL: 비율 산식은 docs/scenarios/korea-imf-1997.md §4]
 */

/**
 * 의향서에서 약속한 금리 상한의 이행 판정 — 약속한 그 순간이 아니라 **다음 턴**에 판정한다
 * (docs/authoring-guide.md §12.3). 역사 기준값 21%에서는 어느 조건도 발동하지 않으므로 역사 경로의
 * 보정 원장은 그대로다.
 */
const RATE_PLEDGE_JUDGEMENT: NonNullable<
  Turn<CentralBankState>['decisions'][number]['options'][number]['delayedEffects']
> = [
  {
    afterTurns: 1,
    when: { counter: 'loiRateCeilingPct', lt: 21 },
    description: '약속한 금리 상한이 프로그램 요구 수준에 못 미쳐 2차 인출 점검이 지연됨',
    effects: [
      confidence(-6, '프로그램 이행 점검 지연'),
      imfFx.adjustDrain({ factor: 1.15, reason: '2차 인출 지연 우려' }),
    ],
  },
  {
    afterTurns: 1,
    when: { counter: 'loiRateCeilingPct', gte: 30 },
    description: '약속한 초고금리가 집행되며 기업 부도와 실업이 앞당겨짐',
    effects: [
      confidence(-4, '초고금리의 실물 충격'),
      counter('realEconomyCost', 6),
      counter('corporateDistress', 1),
    ],
  },
]

/** 의향서 협상: 쟁점 순서 → 금리 상한 → 정리·개방 범위. 귀결은 t6-d2의 세 옵션. */
const loiSteps: DialogueStep<CentralBankState>[] = [
  {
    id: 'loi-open',
    lines: [
      {
        speaker: '국제통화기금 협의단장',
        text: '내일 아침까지 문안을 확정해야 12월 4일 이사회에 올립니다. 통화 조항부터 보시죠 — 자본 유출을 멈추려면 단기 고금리가 필요합니다.',
      },
      {
        speaker: '국제통화기금 협의단장',
        text: '재정 조항은 흑자 기조 유지입니다. 어느 쪽부터 이야기하시겠습니까.',
      },
    ],
    note: '여는 쟁점이 협상의 순서를 정합니다. 남은 시간은 하룻밤입니다.',
    replies: [
      {
        id: 'loi-r-rate-first',
        label: '통화 조항부터 논의하겠다',
        next: 'loi-rate',
        expert: {
          rating: 62,
          rationale:
            '상대가 가장 중요하게 보는 조항부터 다루면 협상이 빨리 끝난다. 다만 우리 쪽 가장 강한 근거(국가채무 12%)를 쓰지 않고 시작하는 셈이다.',
        },
      },
      {
        id: 'loi-r-fiscal-first',
        label: '국가채무 12%를 들어 재정 조항부터 다투겠다',
        effects: [counter('negotiatedTerms', 1)],
        next: 'loi-rate',
        expert: {
          rating: 78,
          rationale:
            '우리가 이길 수 있는 쟁점을 먼저 이겨 두면 통화 조항에서 쓸 교환 조건이 생긴다. 한국의 국가채무는 GDP 대비 12% 수준이었고 이 위기는 재정 위기가 아니었다.',
        },
      },
      {
        id: 'loi-r-reject',
        label: '조건 전반의 재협상을 요구하겠다',
        resolvesTo: 't6-d2-c',
        expert: {
          rating: 15,
          rationale:
            '가용보유액 53억달러로 12월 만기 135억달러를 마주한 쪽이 판을 엎겠다고 하면, 판이 엎어지는 동안 지불 불능이 먼저 온다.',
        },
        trap: true,
        trapExplanation:
          '조건이 가혹하다는 판단은 옳다. 그러나 협상력 없는 거부는 조건을 바꾸지 못하고 시간만 잃으며, 그 시간은 가용보유액으로 지불된다.',
      },
    ],
  },
  {
    id: 'loi-rate',
    lines: [
      {
        speaker: '국제통화기금 협의단장',
        text: '그럼 숫자를 주십시오. 콜금리를 어느 수준까지 올리겠다고 문안에 적겠습니까.',
      },
    ],
    note: '여기서 약속한 금리 상한은 이후 프로그램 이행 점검에서 그대로 검증됩니다.',
    replies: commitReplies<CentralBankState>('loiRateCeilingPct', [15, 21, 30], {
      unit: '%',
      label: (v) => `콜금리 상한 ${v}%를 문안에 적는다`,
      next: 'loi-scope',
      expert: (v) => ({
        rating: v === 21 ? 75 : v === 30 ? 52 : 40,
        rationale:
          v === 21
            ? '실제 12월 5일에 집행된 수준이다. 자본 유출 억제와 실물 충격 사이의 타협점이었고, 이사회를 통과할 수 있는 최소선이기도 했다.'
            : v === 30
              ? '유출 억제 효과는 가장 크지만 실물 비용도 가장 크다. 12월 24일 의향서가 요구하게 되는 수준을 3주 앞당기는 셈이다.'
              : '실물 충격은 작다. 그러나 이사회가 자본 유출을 멈출 의지가 없다고 판단하면 2차 인출이 지연되고, 12월에는 그 지연을 버틸 여유가 없다.',
      }),
    }),
  },
  {
    id: 'loi-scope',
    lines: [
      {
        speaker: '국제통화기금 협의단장',
        text: '남은 것은 금융기관 정리 범위와 자본시장 개방 일정입니다. 문안을 어떻게 적을까요.',
      },
    ],
    replies: [
      {
        id: 'loi-r-phasing',
        label: '단계 적용과 완화 기준을 문안에 명시하도록 요구한다',
        resolvesTo: 't6-d2-b',
        expert: {
          rating: 84,
          rationale:
            '완화 기준(환율 안정·롤오버 회복)이 문서에 있으면 이후 협의가 재량이 아니라 조항의 문제가 된다. IMF 사후평가가 인정한 초기 조건의 과도함을 처음부터 문서화하는 것이다.',
        },
      },
      {
        id: 'loi-r-accept',
        label: '문안을 그대로 수용하고 이사회 일정을 지킨다',
        resolvesTo: 't6-d2-a',
        expert: {
          rating: 62,
          rationale:
            '12월 4일 이사회를 지킨 것 자체는 옳았다. 다만 완화 조항 없이 받은 조건은 이후 협의에서 상대의 재량에 맡겨진다.',
        },
      },
      {
        id: 'loi-r-stall',
        label: '정리 범위 조항을 빼 달라고 버틴다',
        resolvesTo: 't6-d2-c',
        expert: {
          rating: 18,
          rationale:
            '금융기관 정리는 우리에게도 필요한 일이었다. 이미 필요한 조항을 협상 카드로 쓰면 정작 다퉈야 할 통화·재정 조항에서 쓸 카드가 없어진다.',
        },
        trap: true,
        trapExplanation:
          '최대한 덜 받아들이는 것이 협상이라는 착각. 우리에게도 필요한 조항을 붙들고 버티면 이사회 일정만 밀리고 조건은 그대로다.',
      },
    ],
  },
]

/** 뉴욕 외채협상: 협상 방식 → 보증 규모 → 만기 구조. 귀결은 t9-d1의 네 옵션. */
const nySteps: DialogueStep<CentralBankState>[] = [
  {
    id: 'ny-open',
    lines: [
      {
        speaker: '채권은행단 대표',
        text: '우리는 열세 개 은행입니다. 한 곳이라도 빠지면 남은 곳이 손해를 봅니다. 전원이 같은 조건이어야 합니다.',
      },
      { speaker: '채권은행단 대표', text: '무엇을 제시하시겠습니까.' },
    ],
    note: '이 협상이 깨지면 1분기 만기 240억달러를 넘길 방법이 없습니다.',
    replies: [
      {
        id: 'ny-r-collective',
        label: '13개 은행 전원 동일 조건으로 일괄 협상한다',
        effects: [counter('collectiveTalks', 1)],
        next: 'ny-guarantee',
        expert: {
          rating: 88,
          rationale:
            '집단행동 문제를 정면으로 푸는 방식이다. 개별 협상은 먼저 빠지는 쪽이 유리해지므로 아무도 남지 않는다 — 전원 동일 조건이라야 각 은행의 신용위원회가 승인할 수 있다.',
        },
      },
      {
        id: 'ny-r-bilateral',
        label: '은행별로 따로 만나 개별 조건을 제시한다',
        next: 'ny-guarantee',
        expert: {
          rating: 35,
          rationale:
            '개별 협상은 조건을 낮출 여지가 있어 보이지만 먼저 회수하는 쪽이 이기는 구조를 그대로 둔다. 한 곳이 빠지면 나머지가 따라 빠진다.',
        },
        trap: true,
        trapExplanation:
          '하나씩 설득하면 된다는 유혹. 집단행동 문제에서 개별 협상은 회수 경쟁을 부추길 뿐이다.',
      },
      {
        id: 'ny-r-writedown',
        label: '원금 감면(손실분담)을 요구하겠다고 먼저 밝힌다',
        resolvesTo: 't9-d1-c',
        expert: {
          rating: 18,
          rationale:
            '원칙은 타당하나 이를 지탱할 보유액이 없다. 감면 요구를 들은 은행은 협상 대신 상각과 회수를 택한다.',
        },
      },
      {
        id: 'ny-r-walk',
        label: '협상을 중단하고 대외지급 정지를 통보한다',
        resolvesTo: 't9-d1-d',
        expert: {
          rating: 3,
          rationale: '협상 테이블이 열려 있는데 선언을 택하면 이미 치른 비용을 전부 버린다.',
        },
        trap: true,
        trapExplanation: '테이블에 앉아 있는 상대를 두고 자리를 뜨는 것은 협상이 아니라 포기다.',
      },
    ],
  },
  {
    id: 'ny-guarantee',
    lines: [
      {
        speaker: '채권은행단 대표',
        text: '우리 신용위원회가 보는 것은 금리가 아니라 위험가중치입니다. 정부보증을 얼마까지 붙이시겠습니까.',
      },
    ],
    note: '여기서 제시한 보증 규모가 실제 전환액과 예치금 환류를 정합니다. 1분기 만기는 240억달러입니다.',
    replies: commitReplies<CentralBankState>('debtGuaranteeBn', [0, 120, 240], {
      unit: '억달러',
      label: (v) =>
        v === 0
          ? '보증 없이 가산금리만 크게 얹는다'
          : v === 240
            ? '1분기 만기 240억달러 전액에 정부보증'
            : `만기의 절반인 ${v}억달러에만 정부보증`,
      next: (v) => (v === 0 ? undefined : 'ny-tenor'),
      resolvesTo: (v) => (v === 0 ? 't9-d1-b' : undefined),
      expert: (v) => ({
        rating: v === 240 ? 88 : v === 120 ? 52 : 30,
        rationale:
          v === 240
            ? '실제 합의 구조다. 한국 리스크가 한국 정부 리스크로 바뀌면 은행의 위험가중치가 달라지고, 그때 신용위원회가 승인한다.'
            : v === 120
              ? '절반만 보증하면 보증되지 않은 절반에서 회수 경쟁이 그대로 남는다. 부분 합의는 1분기를 넘기지 못한다.'
              : '투자부적격 등급의 차주에게 금리만 얹어 준다고 신용위원회가 연장을 승인하지는 않는다. 은행이 필요로 한 것은 수익이 아니라 보증이었다.',
      }),
    }),
  },
  {
    id: 'ny-tenor',
    lines: [
      {
        speaker: '채권은행단 대표',
        text: '보증을 붙인다면 만기 구조를 말씀해 주십시오. 우리 쪽도 자산·부채 만기를 맞춰야 합니다.',
      },
    ],
    replies: [
      {
        id: 'ny-r-ladder',
        label: '1·2·3년물로 나누고 가산금리를 만기별로 차등한다',
        resolvesTo: 't9-d1-a',
        expert: {
          rating: 92,
          rationale:
            '만기를 계단식으로 나누면 한 시점에 상환이 몰리지 않고 은행도 자산 만기를 분산할 수 있다. 실제 합의는 1·2·3년물에 LIBOR+2.25/2.50/2.75%였다.',
        },
      },
      {
        id: 'ny-r-flat',
        label: '1년 단일물로 하고 보증 범위를 다시 줄인다',
        resolvesTo: 't9-d1-b',
        expert: {
          rating: 38,
          rationale:
            '1년 뒤 같은 규모의 만기가 한꺼번에 다시 돌아온다. 연장의 목적이 만기 집중을 푸는 것인데 그 목적을 스스로 지운다.',
        },
      },
    ],
  },
]

/**
 * T5~T9 (1997-11-21 ~ 1998-01-28). 대사 재구성·사후정보 규칙은 turnsA.ts 상단 주석과 같다.
 *
 * 유출 계수 규약(fx.ts 참조): 각 턴의 `runoffStep({ total })`은 역사 경로에서 실제로 빠져나간 금액이며,
 * 역사 옵션은 유출 계수를 건드리지 않는다.
 */

type T = Turn<CentralBankState>

// =================================================================================================
// T5 — 1997-11-21(금) ~ 11-28(금) "요청"
// =================================================================================================
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '1997년 11월 21일(금) ~ 28일(금) · 6영업일 · KST',
  title: '요청 — 그리고 조건이 시작되는 자리',
  time: '1997-11-21T09:00:00+09:00',
  entryEffects: [
    {
      id: 't5-x1-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 65, dueThisMonth: 125, shortTermDebt: 870 }),
      ],
      description: '롤오버율 65%',
    },
    {
      id: 't5-x2-drain',
      effects: [imfFx.runoffStep({ total: 6.0, profile: [1], label: '단기외채 순상환·무역결제' })],
      description: '대외 유출(6영업일)',
    },
    {
      id: 't5-x3-market',
      effects: [
        imfFx.ratingAction({ to: 'A-', notches: 2, label: '국가신용등급 A+ → A− (2노치)' }),
        imfFx.marketMove({ equityPct: -5, spreadBp: 40, fundingStressBp: 70 }),
        confidence(-3, '연쇄 강등과 롤오버율 65%'),
      ],
      description: '2노치 강등, 시장 악화',
    },
  ],
  events: [
    {
      id: 't5-regulator-request',
      kind: 'regulator',
      agency: '재정경제원',
      time: '11/21 22:00',
      headline: '정부, 국제통화기금에 자금 지원을 공식 요청',
      body: '정부는 국제통화기금에 대기성차관 지원을 요청한다고 발표했다. 요청 규모와 조건은 협의단과의 협상에서 정해진다. 협의단은 다음 주 초 서울에 도착한다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.sba, S.herald],
      relatedMetrics: ['imfCommitted'],
    },
    {
      id: 't5-memo-conditions',
      kind: 'memo',
      time: '11/24 09:00',
      from: '재정경제원 국제금융국',
      to: '정책담당',
      subject: '협상 쟁점 정리 — 우리가 다툴 수 있는 것과 없는 것',
      body: `협의단이 제시할 조건은 대체로 다음과 같이 예상됩니다.

1. **통화·금리**: 단기 고금리. 자본 유출 억제가 목적입니다. 수준은 다툴 여지가 있습니다.
2. **재정**: 흑자 기조 유지. 우리 국가채무는 GDP 대비 12% 수준이어서 다툴 근거가 있습니다.
3. **금융 구조조정**: 부실 종금사·은행 정리, 자기자본 기준 적용. 이미 필요한 일입니다.
4. **자본시장 개방**: 외국인 주식 취득한도 확대, 단기 자본거래 자유화 일정.
5. **공시**: 외환보유액·단기외채 통계의 공표 기준 변경. **가용 개념의 공개를 요구받을 가능성이 높습니다.**

협상력은 남은 가용외환보유액에 비례합니다. 현재 66억달러입니다.`,
      severity: 'warning',
      sourceRefs: [S.loi3, S.ieo],
      relatedMetrics: ['usableReserves'],
    },
    {
      id: 't5-news-rating',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '11/25 23:00',
      headline: '한국 국가신용등급 두 단계 강등 — A+ → A−, 전망 부정적',
      body: '평가사는 단기외채 규모와 금융기관 건전성, 그리고 외환보유액의 실제 가용 규모에 대한 불확실성을 이유로 들었다. 추가 강등 가능성이 열려 있다고 밝혔다.',
      severity: 'critical',
      sourceRefs: [S.crs, S.herald],
      relatedMetrics: ['sovereignSpreadBp'],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '지원 요청 규모와 구성',
      prompt: '얼마를, 어떤 구성으로 요청하시겠습니까?',
      context:
        '너무 작게 부르면 두 번 요청해야 하고, 두 번째 요청은 첫 번째보다 훨씬 비쌉니다. 1개월 내 만기 단기외채만 125억달러이고 12월 만기는 더 큽니다.',
      dimensions: ['policy', 'liquidity'],
      requiredConcepts: ['korea-crisis-toolkit'],
      options: [
        {
          id: 't5-d1-a',
          label: '국제통화기금 200억달러 규모로 요청하고 세계은행·아시아개발은행과 병행 협의',
          description:
            '대기성차관과 보완준비금융을 합해 200억달러대를 요청하고, 세계은행·아시아개발은행 협조융자와 주요국 2선 지원을 병행한다.',
          effects: [
            imfFx.imfStage({
              stage: 'negotiating',
              committed: 0,
              label: '국제통화기금 지원 요청(협상 개시)',
            }),
            flag('imf_requested'),
            confidence(8, '지원 요청 공개 — 해결 경로 제시'),
            regulator({ set: 3 }, '국제통화기금 프로그램 협상 개시'),
          ],
          expert: {
            rating: 70,
            rationale:
              '규모는 결과적으로 맞았다(12월 4일 210억달러 승인, 총 패키지 583억달러). 문제는 시점이다 — 같은 요청을 11월 10일에 했다면 가용보유액 95억달러를 더 쥔 채 조건을 다퉜을 것이다. IMF 사후평가는 늦게 온 요청일수록 프로그램이 크고 조건이 가혹해진다고 정리했다.',
            historicalNote: '11월 21일 구제금융 신청, 12월 4일 210억달러 승인.',
            sourceRefs: [S.sba, S.ieo],
          },
          consequences:
            '요청이 공개되었습니다. 환율은 일시 진정되었고 주가는 반등했습니다. 협의단이 다음 주 초 도착합니다.',
          historical: true,
          feasibility: {
            basis: '대기성차관·보완준비금융 요청은 회원국 권리이며 이사회 승인까지 2~4주',
            sourceRefs: [S.sba],
          },
        },
        {
          id: 't5-d1-b',
          label: '가용보유액·단기외채 실태를 먼저 공개하고 300억달러 규모로 요청',
          description:
            '실태를 먼저 공개해 규모의 근거를 만들고, 한 번에 충분한 규모를 요청한다. 공개는 단기 충격을 키운다.',
          effects: [
            imfFx.imfStage({
              stage: 'negotiating',
              committed: 0,
              label: '실태 공개 후 대규모 요청',
            }),
            flag('imf_requested'),
            flag('reserves_disclosed'),
            confidence(8, '실태 공개와 충분한 규모 요청 — 해결 경로 제시'),
            imfFx.adjustRollover({ deltaPct: 6, reason: '실태 공개 + 충분한 규모' }),
            imfFx.adjustDrain({ factor: 0.85, reason: '프로그램 규모의 신뢰성' }),
            regulator({ set: 3 }, '국제통화기금 프로그램 협상 개시'),
          ],
          expert: {
            rating: 84,
            rationale:
              '실제 최종 패키지는 583억달러였다 — 즉 11월에 200억달러를 부른 것 자체가 과소였다. 규모의 근거는 단기외채 만기 구조이고, 그것을 공개하지 않으면 협상 상대도 규모를 믿지 못한다. 1998년 1월 뉴욕 협상이 성사된 것도 결국 만기 구조가 공개되고 나서였다.',
            sourceRefs: [S.sba, S.ny, S.ieo],
          },
          consequences:
            '단기외채 만기표와 가용보유액이 공개되었습니다. 첫날 시장은 크게 흔들렸지만, 협의단장은 "이제 규모를 산정할 수 있다"고 했습니다.',
        },
        {
          id: 't5-d1-c',
          label: '요청을 보류하고 주요국 양자 지원과 통화스와프를 먼저 시도',
          description:
            '국제통화기금 조건을 피하기 위해 미국·일본과의 양자 지원을 먼저 확보하려 한다.',
          effects: [
            counter('bilateralAttempts', 1),
            confidence(-6, '지원 경로 여전히 불확실'),
            imfFx.adjustRollover({ deltaPct: -8, reason: '지원 경로 불확실' }),
            imfFx.adjustDrain({ factor: 1.3, reason: '프로그램 부재' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '11월 하순에 양자 지원을 먼저 받은 나라는 없었다. 주요국은 일관되게 "프로그램이 먼저"라는 입장이었고, 실제 2선 지원 233억달러도 프로그램의 부속물로 왔다. 이 선택은 12월 첫 주를 통째로 잃는다.',
            sourceRefs: [S.sba, S.crs],
          },
          consequences:
            '양자 채널을 두드렸습니다. 답은 모두 같았습니다 — "국제통화기금 프로그램이 있어야 합니다."',
          trap: true,
          trapExplanation:
            '"조건 없는 돈이 어딘가 있을 것"이라는 기대. 1997년의 국제 금융질서에서 그런 돈은 없었고, 이 기대에 쓴 시간은 전부 가용보유액으로 지불되었다.',
          remediationCard: 'korea-crisis-toolkit',
        },
      ],
    },
    {
      id: 't5-d2',
      title: '통계 공표 기준',
      prompt: '외환보유액 공표 기준을 바꾸시겠습니까?',
      context:
        '협의단은 가용 개념의 공개를 요구할 것입니다. 우리가 먼저 바꾸는 것과 요구받아 바꾸는 것은 다릅니다.',
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't5-d2-a',
          label: '현행 공표 기준을 유지하고 협상 결과에 따른다',
          description: '총외환보유액 기준을 유지한다.',
          effects: [flag('reserves_withheld'), counter('withheldDisclosure', 1)],
          expert: {
            rating: 30,
            rationale:
              '공표 기준은 결국 프로그램 조건으로 바뀌었다. 스스로 바꾸면 정책이고, 요구받아 바꾸면 항복이다. 시장은 그 차이를 안다.',
            historicalNote: '가용외환보유액 계열은 끝내 정기적으로 공표되지 않았다.',
            sourceRefs: [S.hearing, S.ieo],
          },
          consequences:
            '기준은 유지되었습니다. 협의단은 첫 회의에서 가용 계열 산출표를 요구했습니다.',
          historical: true,
        },
        {
          id: 't5-d2-b',
          label: '가용외환보유액과 선물환 잔액을 주간 단위로 공표한다',
          description:
            '총액·가용·선물환 약정을 모두 주간으로 공표하기 시작한다. 지금 상태로는 나쁜 숫자가 나가지만 기준이 생긴다.',
          effects: [
            flag('reserves_disclosed'),
            confidence(-2, '나쁜 숫자의 정기 공표 시작'),
            imfFx.adjustRollover({ deltaPct: 5, reason: '정기 공표 기준 확립' }),
            imfFx.adjustDrain({ factor: 0.9, reason: '정보 비대칭 해소' }),
            counter('transparencySteps', 1),
          ],
          expert: {
            rating: 86,
            rationale:
              '나중에 국제 기준(특별자료공표기준)이 요구하게 되는 바로 그 형식이다. 정기 공표는 한 번의 공개보다 강하다 — 다음 주 숫자를 감출 수 없게 되므로 정책 자체가 규율된다. 감사원 특별감사가 지적한 "23차례 보고에도 대응 지연"의 구조적 해법이 이것이다.',
            sourceRefs: [S.audit, S.ara, S.ieo],
          },
          consequences:
            '첫 주간 공표가 나갔습니다. 가용 66억달러, 선물환 약정 118억달러. 국내 신문 1면이 온통 이 숫자였습니다.',
        },
      ],
    },
    {
      id: 't5-d3',
      title: '요청 이후의 개입',
      prompt: '지원 요청 이후에도 환율을 방어하시겠습니까?',
      context: '가용외환보유액은 66억달러입니다. 12월 만기는 135억달러로 늘어납니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't5-d3-a',
          label: '개입을 중단하고 남은 보유액을 대외결제에 전용한다',
          description:
            '환율은 시장에 맡기고 남은 가용보유액을 만기 도래 외채 결제에만 쓴다. 프로그램 자금이 들어올 때까지 버틴다.',
          effects: [flag('intervention_halted'), counter('restraintDays', 6)],
          expert: {
            rating: 82,
            rationale:
              '요청한 순간부터 보유액의 용도는 환율이 아니라 결제다. 실제로 11월 하순 이후 대규모 현물 개입은 사실상 중단되었고, 그것은 옳은 판단이었다 — 다만 그 전에 146억달러를 이미 쓴 뒤였다.',
            historicalNote: '진정은 하루뿐이었다. 요청 다음 영업일(11/21) 종가는 1,056.0원까지 되밀렸지만 한 주 만에 다시 밀려 11월 28일 종가는 1,170.0원이었다.',
            sourceRefs: [S.bok, S.ieo],
          },
          consequences:
            '개입을 멈췄습니다. 요청 발표 직후 환율은 1,056.0원까지 되돌아왔다가 주말로 갈수록 다시 밀렸습니다.',
          historical: true,
        },
        {
          id: 't5-d3-b',
          label: '프로그램 자금 도래 전까지 20억달러 범위에서 방어를 계속한다',
          description: '요청 발표 효과를 환율 안정으로 굳히기 위해 개입을 이어 간다.',
          effects: [
            imfFx.intervene({ amount: 20.0, label: '요청 이후 개입 20억달러' }),
            counter('defenceAfterRequest', 1),
          ],
          expert: {
            rating: 12,
            rationale:
              '가용 66억달러 중 20억달러를, 12월 만기 135억달러를 앞두고 쓴다. 이 시점의 개입은 환율을 위한 것이 아니라 체면을 위한 것이며, 12월 중순에 갚을 돈이 그만큼 줄어든다.',
            sourceRefs: [S.ieo, S.ara],
          },
          consequences:
            '20억달러를 더 썼습니다. 환율은 며칠 버텼습니다. 가용외환보유액은 46억달러가 되었습니다.',
          trap: true,
          trapExplanation:
            '지원을 요청한 뒤의 개입은 두 배로 나쁘다. 보유액을 줄이면서 동시에 "요청했는데도 시장이 안 믿는다"는 사실을 매일 확인시켜 준다.',
        },
        {
          id: 't5-d3-c',
          label: '변동폭을 폐지하고 완전 자유변동환율로 이행한다',
          description:
            '±10% 변동폭마저 없애 환율이 완전히 시장에서 결정되게 한다. 실제로는 12월 16일에 시행된 조치다.',
          effects: [
            imfFx.setBand({ pct: 0, label: '변동폭 폐지 — 완전 자유변동환율' }),
            confidence(-5, '변동폭 폐지 — 절하 가속'),
            imfFx.adjustDrain({ factor: 0.92, reason: '외환시장 청산 기능 회복' }),
            flag('floated_early'),
          ],
          expert: {
            rating: 74,
            rationale:
              '3주 앞당기는 것이다. 변동폭이 있는 한 상한가 거래 불성립이 반복되어 무역결제가 막히고, 그것이 다시 유출을 키운다. 다만 프로그램 자금이 없는 상태에서의 완전 변동은 절하 폭을 스스로 멈출 수단이 없다는 위험을 안는다.',
            sourceRefs: [S.band, S.ieo],
          },
          consequences:
            '변동폭이 폐지되었습니다. 환율은 며칠 동안 크게 흔들렸지만 거래는 매일 성립했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      text: '협상력은 남은 가용외환보유액에 비례합니다. 이 턴에서 쓰는 1억달러는 조건 협상에서 잃는 1억달러입니다.',
      decisionId: 't5-d3',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'crisis-communication'],
}

// =================================================================================================
// T6 — 1997-12-01(월) ~ 12-03(수) "종금사와 합의서"
// =================================================================================================
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '1997년 12월 1일(월) ~ 3일(수) · 3영업일 · KST',
  title: '종금사 9개, 그리고 합의서',
  time: '1997-12-01T09:00:00+09:00',
  entryEffects: [
    {
      id: 't6-x1-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 55, dueThisMonth: 135, shortTermDebt: 855 }),
      ],
      description: '롤오버율 55%, 12월 만기 135억달러',
    },
    {
      id: 't6-x2-drain',
      effects: [imfFx.runoffStep({ total: 14.0, profile: [1], label: '종금사 외화채무 순상환' })],
      description: '대외 유출(3영업일)',
    },
    {
      id: 't6-x3-market',
      effects: [
        imfFx.marketMove({ equityPct: -8, spreadBp: 60, fundingStressBp: 80 }),
        confidence(-2, '롤오버율 55% — 만기의 절반이 회수되고 있다'),
      ],
      description: '시장 악화',
    },
  ],
  events: [
    {
      id: 't6-data-call',
      kind: 'data',
      time: '12/01 09:00',
      title: '12월 1일 자금시장',
      rows: [
        { label: '콜금리', value: '12.11%' },
        { label: '단기외채 롤오버율', value: '55%' },
        { label: '12월 만기 도래 단기외채', value: '135억달러' },
        { label: '가용외환보유액', value: '약 67억달러' },
        { label: '총외환보유액(공표)', value: '약 240억달러' },
      ],
      severity: 'critical',
      sourceRefs: [S.crs, S.res, S.debt],
      relatedMetrics: ['usableReserves', 'grossReserves', 'rolloverRatePct', 'stDebtDue30d'],
    },
    {
      id: 't6-call-mission',
      kind: 'call',
      caller: '국제통화기금 협의단장',
      callee: '재정경제원 차관',
      agency: 'International Monetary Fund',
      tone: 'urgent',
      time: '12/02 22:30',
      lines: [
        {
          speaker: '국제통화기금 협의단장',
          text: '내일 아침까지 합의서 문안을 정리해야 12월 4일 이사회에 올립니다. 남은 쟁점은 금리 수준과 금융기관 정리 일정입니다.',
        },
        {
          speaker: '재정경제원 차관',
          text: '금리는 우리 기업들이 감당할 수 없는 수준입니다. 대기업 연쇄 부도가 이미 진행 중입니다.',
        },
        {
          speaker: '국제통화기금 협의단장',
          text: '알고 있습니다. 그러나 자본 유출을 멈추지 않으면 환율이 먼저 기업을 죽입니다. 어느 쪽이 먼저인지는 각국 사정이 다릅니다만, 지금 한국은 외화가 없습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.loi3, S.ieo],
    },
    {
      id: 't6-regulator-loi',
      kind: 'regulator',
      agency: '재정경제원 · 국제통화기금',
      time: '12/03 17:00',
      headline: '국제통화기금과 의향서 합의 — 이사회 상정',
      body: '정부와 국제통화기금 협의단은 의향서에 합의했다. 통화 긴축, 재정 건전성, 금융기관 구조조정, 자본시장 개방, 통계 공표 기준 개선이 담겼다. 이사회는 12월 4일 열린다.',
      tone: 'urgent',
      severity: 'warning',
      sourceRefs: [S.loi3],
      relatedMetrics: ['imfCommitted'],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '종합금융회사 처리',
      prompt: '자기자본이 잠식된 종금사들을 어떻게 하시겠습니까?',
      context:
        '외화조달 200억달러 중 상당수가 이 회사들에 있습니다. 정지하면 해외 채권은행이 한국 전체의 롤오버를 거부할 수 있고, 두면 한국은행 외화가 계속 나갑니다.',
      dimensions: ['policy', 'compliance'],
      requiredConcepts: ['regulator-escalation-ladder'],
      options: [
        {
          id: 't6-d1-a',
          label: '9개사를 업무정지하고 나머지는 자구계획을 받는다',
          description:
            '자기자본 잠식이 확인된 9개사에 업무정지를 명한다. 예금·외화채무 처리 방침은 추후 발표한다. 재정경제원 처분으로 당일 집행 가능하다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 9,
              rolloverShockPct: 10,
              drainFactor: 1.0,
              label: '종금사 9개사 업무정지',
            }),
            confidence(-5, '종금사 일괄 정지 — 승계 방침 미제시'),
            regulator({ set: 3 }, '금융기관 일괄 정지'),
          ],
          expert: {
            rating: 45,
            rationale:
              '정지 자체는 불가피했다. 문제는 외화채무 승계 방침 없이 아홉 곳을 한꺼번에 세운 것이다. 해외 채권은행은 이를 "한국이 종금사 외화채무를 책임지지 않는다"는 신호로 읽었고, 12월 중순 롤오버율이 30%대로 무너지는 계기가 되었다.',
            historicalNote: '1997년 12월 2일 9개 종금사 업무정지, 12월 10일 5개사 추가(누계 14개).',
            sourceRefs: [S.susp, S.kdi],
          },
          consequences:
            '9개사가 정지되었습니다. 다음 날 아침 뉴욕과 도쿄에서 한국 금융기관 전반에 대한 신용라인 축소 통보가 잇따랐습니다.',
          historical: true,
          irreversible: true,
          feasibility: {
            basis: '종합금융회사 업무정지는 재정경제원 처분 사항 — 실제로 12월 2일 집행되었다',
            sourceRefs: [S.susp],
          },
        },
        {
          id: 't6-d1-b',
          label: '9개사를 정지하되 외화채무 전액 승계와 가교기관 설립을 함께 발표',
          description:
            '같은 9개사를 정지시키면서 외화채무는 가교 금융기관이 전액 승계한다고 동시에 발표한다. 가교기관 설립은 인가 절차로 연내 가능하다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 9,
              rolloverShockPct: 3,
              drainFactor: 0.82,
              label: '종금사 9개사 정지 + 외화채무 승계 발표',
            }),
            flag('bridge_institution'),
            confidence(-1, '정지와 승계를 동시에 발표'),
            imfFx.adjustRollover({ deltaPct: 8, reason: '외화채무 승계 방침 명시' }),
            counter('earlyResolution', 1),
          ],
          expert: {
            rating: 88,
            rationale:
              '실제로 가교 종금사는 12월 31일에야 설립되었다 — 정지보다 29일 늦었다. 그 29일 동안 해외 채권은행은 자기 채권의 지위를 알 수 없었고, 모르면 회수한다. 정리와 승계를 같은 날 발표하는 것은 2023년 미국 지역은행 사례에서도 확인된 원칙이다.',
            sourceRefs: [S.susp, S.kdi, S.ieo],
          },
          consequences:
            '정지와 승계가 함께 발표되었습니다. 해외 채권은행들은 "적어도 누가 갚는지는 알겠다"는 반응을 보였습니다.',
          irreversible: true,
          feasibility: {
            basis: '가교 금융기관 설립은 인가 절차로 가능했고 실제로 12월 31일에 설립되었다',
            sourceRefs: [S.susp],
          },
        },
        {
          id: 't6-d1-c',
          label: '정지하지 않고 한국은행 외화지원으로 전부 막는다',
          description:
            '종금사를 정지시키지 않고 한국은행이 외화를 대 준다. 당장의 대외 부도는 없다.',
          effects: [
            imfFx.supportMerchantBanks({
              amount: 18.0,
              viaBranches: true,
              drainFactor: 1.25,
              label: '종금사 전면 외화지원 18억달러(해외점포 예치)',
            }),
            confidence(-6, '부실 종금사 존속 — 구조조정 신뢰 상실'),
            imfFx.adjustRollover({ deltaPct: -6, reason: '구조조정 회피' }),
          ],
          expert: {
            rating: 8,
            rationale:
              '가용보유액 67억달러 중 18억달러를 부실 회사의 대외채무 상환에 넣는다. 게다가 이 지원은 의향서의 금융 구조조정 조항과 정면으로 충돌해 프로그램 자체를 위태롭게 한다. 12월 4일 이사회를 앞두고 할 수 있는 가장 비싼 선택이다.',
            sourceRefs: [S.loi3, S.kdi],
          },
          consequences:
            '전면 지원이 결정되었습니다. 종금사들은 살아남았고 가용외환보유액은 49억달러가 되었습니다. 협의단이 "의향서 문안을 다시 보자"고 연락해 왔습니다.',
          trap: true,
          trapExplanation:
            '"오늘의 부도를 막으면 내일 협상할 시간이 생긴다"는 논리. 실제로는 협상 대상인 구조조정 약속을 스스로 어기면서, 협상의 재원인 가용보유액을 함께 태운다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't6-d1-d',
          label: '30개사 전부를 정지하고 일괄 정리에 들어간다',
          description: '종금사 업종 전체를 정지시키고 일괄 정리한다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 18,
              rolloverShockPct: 20,
              drainFactor: 1.45,
              label: '종금사 전면 정지',
            }),
            confidence(-12, '업종 전체 정지 — 대외 신인도 급락'),
            regulator({ set: 3 }, '업종 전면 정지'),
          ],
          expert: {
            rating: 18,
            rationale:
              '최종적으로 30개사 중 16개사가 퇴출되었으니 방향은 틀리지 않았다. 그러나 한꺼번에 하면 살아남을 14개사의 외화 차입선까지 같은 날 닫힌다. 정리는 순서와 승계 계획이 전부다.',
            sourceRefs: [S.susp, S.kdi],
          },
          consequences:
            '업종 전체가 멈췄습니다. 살아남을 수 있었던 회사들의 차입선도 함께 닫혔습니다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't6-d2',
      title: '의향서 협상 — 무엇을 어떤 순서로 내줄 것인가',
      prompt: '협의단장과 하룻밤 안에 문안을 정리해야 합니다.',
      context:
        '고금리는 자본 유출을 늦춥니다. 동시에 이미 진행 중인 대기업 연쇄 부도를 가속합니다. 국가채무는 GDP 대비 12% 수준이라 재정 조항은 다툴 근거가 있습니다. 남은 쟁점은 금리 수준, 금융기관 정리 범위, 자본시장 개방 일정입니다.',
      select: { min: 1, max: 1 },
      defaultOptionId: 't6-d2-a',
      steps: loiSteps,
      dimensions: ['policy', 'communication'],
      options: [
        {
          id: 't6-d2-a',
          label: '금리 조항을 수용하고 재정 조항에서 여지를 받는다',
          description:
            '통화 긴축 조항을 받아들이되 재정 흑자 목표에서 완화를 얻어 낸다. 12월 4일 이사회 일정을 지킨다.',
          effects: [
            imfFx.imfStage({ stage: 'agreed', committed: 0, label: '의향서 합의' }),
            flag('loi_agreed'),
            confidence(5, '프로그램 합의 — 자금 도래 확정'),
          ],
          delayedEffects: RATE_PLEDGE_JUDGEMENT,
          expert: {
            rating: 62,
            rationale:
              '이사회 일정을 지킨 것은 옳았다. IMF 사후평가(IEO)는 한국 프로그램의 초기 금리·재정 조건이 과도했으며 이후 완화되었다고 명시했다 — 즉 더 다툴 수 있었다는 뜻이지만, 12월 3일 시점의 협상력(가용 53억달러)으로는 어려웠다.',
            historicalNote: '1997년 12월 3일 의향서 합의, 12월 4일 이사회 승인.',
            sourceRefs: [S.loi3, S.ieo],
          },
          consequences:
            '의향서에 합의했습니다. 이사회는 내일입니다. 회사채 시장은 이미 사실상 닫혔습니다.',
          historical: true,
        },
        {
          id: 't6-d2-b',
          label: '금리 수준의 단계적 적용과 조기 완화 조항을 문서로 받아 낸다',
          description:
            '금리 인상은 받되 적용 단계와 완화 기준(환율 안정·롤오버 회복 시)을 의향서에 명시하도록 요구한다. 하루가 더 걸릴 수 있다.',
          effects: [
            imfFx.imfStage({ stage: 'agreed', committed: 0, label: '의향서 합의(단계 조항 포함)' }),
            flag('loi_agreed'),
            flag('rate_phasing_clause'),
            confidence(5, '프로그램 합의'),
            counter('negotiatedTerms', 1),
          ],
          delayedEffects: RATE_PLEDGE_JUDGEMENT,
          expert: {
            rating: 80,
            rationale:
              'IMF 사후평가가 인정한 바로 그 지점 — 초기 조건이 과도했고 이후 완화되었다 — 을 처음부터 문서화하는 것이다. 완화 기준을 명시하면 이후 협상이 재량이 아니라 조항의 문제가 된다. 실제 완화는 1998년 봄에야 이루어졌다.',
            sourceRefs: [S.ieo, S.loi24],
          },
          consequences:
            '단계 적용과 완화 기준이 문안에 들어갔습니다. 이사회 상정은 예정대로입니다.',
        },
        {
          id: 't6-d2-c',
          label: '금리 조항을 거부하고 재협상을 요구한다',
          description: '국내 실물 충격을 이유로 통화 조항 전면 재협상을 요구한다.',
          effects: [
            flag('loi_contested'),
            confidence(-8, '프로그램 지연 — 자금 도래 불확실'),
            imfFx.adjustDrain({ factor: 1.3, reason: '프로그램 합의 지연' }),
            imfFx.adjustRollover({ deltaPct: -10, reason: '프로그램 불확실성' }),
          ],
          expert: {
            rating: 15,
            rationale:
              '가용보유액 53억달러로 12월 만기 135억달러를 마주한 상태에서 재협상을 요구하면, 협상이 길어지는 동안 지불 불능이 먼저 온다. 조항을 다투는 것과 프로그램을 미루는 것은 다른 일이다.',
            sourceRefs: [S.ieo, S.sba],
          },
          consequences:
            '재협상 요구가 전달되었습니다. 이사회 상정이 연기되었고, 그 소식이 시장에 먼저 도착했습니다.',
          trap: true,
          trapExplanation:
            '조건이 가혹하다는 판단은 옳았다. 그러나 협상력이 없는 상태에서의 거부는 조건을 바꾸지 못하고 시간만 잃는다 — 그리고 시간이 곧 가용보유액이다.',
        },
      ],
    },
    {
      id: 't6-d3',
      title: '12월 첫 주 환율 대응',
      prompt: '환율이 1,200원을 넘어섰습니다. 어떻게 하시겠습니까?',
      context: '가용외환보유액은 53억달러입니다. 12월 만기는 135억달러입니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't6-d3-a',
          label: '개입하지 않고 프로그램 자금 도래를 기다린다',
          description: '남은 보유액을 결제에만 쓴다.',
          effects: [
            counter('restraintDays', 3),
            imfFx.fxStep({ close: 1196.0, baseline: 0, bandDays: 3, freeFloatPremiumPct: 2 }),
          ],
          expert: {
            rating: 78,
            rationale:
              '이 시점에는 개입할 돈 자체가 없었다. 12월 3일 종가 1,196.0원은 개입 없는 시장 가격이며, 그것이 정상이다.',
            historicalNote: '12월 3일 원/달러 종가는 1,196.0원이었다. 흔히 인용되는 1,240.6원은 같은 날 매매기준율(= 12월 2일 거래의 가중평균)이다.',
            sourceRefs: [S.rate],
          },
          consequences: '원/달러는 1,196.0원에서 마감했습니다.',
          historical: true,
        },
        {
          id: 't6-d3-b',
          label: '1,200원선에서 10억달러를 투입해 심리선을 지킨다',
          description: '남은 보유액의 5분의 1을 심리선 방어에 쓴다.',
          effects: [
            imfFx.intervene({ amount: 10.0, label: '심리선 방어 개입 10억달러' }),
            imfFx.fxStep({ close: 1196.0, baseline: 0, bandDays: 3, freeFloatPremiumPct: 2 }),
          ],
          expert: {
            rating: 8,
            rationale:
              '가용 53억달러 중 10억달러다. 1,200원이라는 숫자에는 아무 의미가 없고, 12월 15일에 갚아야 할 돈에는 의미가 있다.',
            sourceRefs: [S.ara, S.ieo],
          },
          consequences: '환율은 하루 버텼습니다. 가용외환보유액은 43억달러가 되었습니다.',
          trap: true,
          trapExplanation:
            '"심리선"은 딜러의 언어이지 결제의 언어가 아니다. 이 단계에서 보유액의 용도는 오직 만기 결제다.',
        },
        {
          id: 't6-d3-c',
          label: '자본통제를 도입하고 환율을 고정한다',
          description:
            '단기 자본거래를 제한하고 환율을 고정한다. 이듬해 말레이시아가 택하게 되는 경로다. 국제통화기금 프로그램 조항과 정면으로 충돌한다.',
          effects: [
            flag('capital_controls'),
            imfFx.setBand({ pct: 0.5, label: '환율 사실상 고정' }),
            imfFx.fxStep({ close: 1196.0, baseline: 0, bandDays: 3 }),
            confidence(-14, '자본통제 도입 — 프로그램 충돌'),
            imfFx.adjustRollover({ deltaPct: -20, reason: '자본통제 — 채권 회수 가속' }),
            imfFx.adjustDrain({ factor: 1.5, reason: '통제 도입 전 자금 이탈' }),
            regulator({ set: 3 }, '자본거래 제한 도입'),
          ],
          expert: {
            rating: 20,
            rationale:
              '말레이시아는 1998년 9월 1일에 자본통제와 3.80 페그를 도입했고 결과는 나쁘지 않았다. 그러나 두 가지가 달랐다 — 말레이시아는 단기외채가 훨씬 적었고, 이미 통화가 충분히 절하된 뒤였다. 1997년 12월의 한국은 만기가 목전이었고 통제 발표 자체가 회수를 가속한다. 대조군으로서 가치가 있는 선택지이지 권장 경로가 아니다.',
            sourceRefs: [S.malaysia, S.ieo],
          },
          consequences:
            '자본거래 제한이 발표되었습니다. 통제 시행 전에 빠져나가려는 자금이 몰렸고, 협의단은 이사회 상정 보류를 통보했습니다.',
          irreversible: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 3,
      text: '정지와 승계를 같은 날 발표하십시오. 정리 자체보다 "누가 갚는지 모르는 기간"이 훨씬 비쌉니다.',
      decisionId: 't6-d1',
      cardRefs: ['regulator-escalation-ladder'],
    },
  ],
  relatedCards: ['regulator-escalation-ladder', 'korea-crisis-toolkit'],
}

// =================================================================================================
// T7 — 1997-12-04(목) ~ 12-12(금) "210억달러, 그리고 30%대로 무너진 롤오버"
// =================================================================================================
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '1997년 12월 4일(목) ~ 12일(금) · 7영업일 · KST',
  title: '210억달러 — 그런데 돈이 들어오는 속도보다 나가는 속도가 빠르다',
  time: '1997-12-04T09:00:00+09:00',
  entryEffects: [
    {
      id: 't7-x1-approval',
      effects: [
        imfFx.imfStage({
          stage: 'agreed',
          committed: 210.0,
          label: '국제통화기금 이사회 승인 210억달러(SDR 155억)',
        }),
        confidence(10, '프로그램 승인 — 총 지원 패키지 583억달러'),
      ],
      description: '12월 4일 이사회 승인',
    },
    {
      id: 't7-x2-first-drawing',
      effects: [
        imfFx.disburse({
          amount: 55.6,
          source: '국제통화기금 1차 인출',
          imf: true,
          label: '1차 인출 55.6억달러',
        }),
      ],
      description: '12월 5일 1차 인출',
    },
    {
      id: 't7-x3-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 40, dueThisMonth: 150, shortTermDebt: 830 }),
      ],
      description: '롤오버율 40%로 붕괴',
    },
    {
      id: 't7-x4-drain',
      effects: [imfFx.runoffStep({ total: 45.0, profile: [1], label: '단기외채 회수·무역결제' })],
      description: '대외 유출(7영업일)',
    },
    {
      id: 't7-x5-market',
      effects: [
        imfFx.ratingAction({ to: 'BBB-', notches: 3, label: '국가신용등급 A− → BBB− (3노치)' }),
        imfFx.marketMove({ equityPct: -4, spreadBp: 50, fundingStressBp: 120 }),
      ],
      description: '3노치 강등',
    },
    {
      id: 't7-x6-fx',
      effects: [
        imfFx.fxStep({
          close: 1565.9,
          baseline: 0,
          bandDays: 3,
          freeFloatPremiumPct: 2,
          label: '12월 10일 종가',
        }),
      ],
      description: '환율 결정(개입 없음)',
    },
  ],
  events: [
    {
      id: 't7-regulator-sba',
      kind: 'regulator',
      agency: 'International Monetary Fund',
      time: '12/04 (워싱턴)',
      headline: '국제통화기금 이사회, 한국에 SDR 155억(약 210억달러) 대기성차관 승인',
      body: '대기성차관 75억달러와 보완준비금융 135억달러로 구성된다. 세계은행 100억달러, 아시아개발은행 40억달러, 주요국 2선 지원 233억달러를 합하면 총 583억달러 규모다. 1차 인출은 즉시 이루어진다.',
      tone: 'routine',
      severity: 'positive',
      sourceRefs: [S.sba],
      relatedMetrics: ['imfCommitted', 'usableReserves'],
    },
    {
      id: 't7-data-rollover',
      kind: 'data',
      time: '12/10 18:00',
      title: '단기외채 롤오버 동향 — 12월 첫째~둘째 주',
      rows: [
        { label: '만기 도래', value: '150억달러' },
        { label: '연장', value: '약 60억달러 (40%)' },
        { label: '회수', value: '약 90억달러' },
        { label: '1차 인출', value: '55.6억달러' },
        { label: '결론', value: '들어온 돈보다 나간 돈이 많다' },
      ],
      severity: 'critical',
      sourceRefs: [S.crs, S.debt, S.sba],
      relatedMetrics: ['rolloverRatePct', 'usableReserves'],
    },
    {
      id: 't7-memo-rollover-idea',
      kind: 'memo',
      time: '12/08 08:00',
      from: '재정경제원 국제금융국',
      to: '정책담당',
      subject: '[대외비] 채권은행 만기연장 협상의 필요성',
      body: `1차 인출 55.6억달러는 이번 주 회수액보다 적습니다. 남은 프로그램 자금을 다 받아도 12월 만기를 감당하지 못합니다.

산술이 분명합니다. **공적 자금으로 민간 채권자의 회수를 메울 수는 없습니다.** 회수 자체를 멈춰야 합니다.

방법은 하나입니다 — 주요 채권은행을 한자리에 모아 만기연장에 합의하는 것입니다. 미국·일본·유럽의 13개 은행이 우리 단기외채의 상당 부분을 쥐고 있습니다. 협상에는 최소 3~4주가 걸리고, 각국 감독당국의 묵인이 필요합니다.

**지금 시작하면 1월 중순, 연말에 시작하면 2월입니다.**`,
      severity: 'critical',
      sourceRefs: [S.ny, S.ieo],
      relatedMetrics: ['rolloverRatePct', 'stDebtDue30d'],
    },
    {
      id: 't7-news-suspension2',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '12/10 17:30',
      headline: '종합금융회사 5개사 추가 업무정지 — 누계 14개사',
      body: '재정경제원은 자기자본 잠식이 확인된 5개 종합금융회사에 추가로 업무정지를 명했다. 12월 2일 9개사를 포함해 정지된 회사는 모두 14개사가 되었다.',
      severity: 'critical',
      sourceRefs: [S.susp],
      relatedMetrics: ['failedBanks'],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '콜금리 수준',
      prompt: '의향서의 통화 긴축 조항을 어떤 수준으로 집행하시겠습니까?',
      context:
        '12월 1일 12.11%였던 콜금리를 얼마까지 올리시겠습니까? 회사채 시장은 사실상 닫혔고 대기업 부도가 이어지고 있습니다.',
      dimensions: ['policy', 'marketRisk'],
      options: [
        {
          id: 't7-d1-a',
          label: '콜금리를 21%로 인상한다',
          description:
            '의향서 조항에 따라 12월 5일부터 콜금리를 21%로 올린다. 자본 유출 억제와 환율 안정이 목적이다.',
          effects: [
            imfFx.setPolicyRate({ pct: 21, baselinePct: 21, label: '콜금리 12.1% → 21%' }),
            confidence(-3, '고금리 충격 — 국내 기업 부도 가속'),
          ],
          expert: {
            rating: 55,
            rationale:
              '프로그램 조항의 집행이었다. 자본 유출은 실제로 다소 늦춰졌지만 국내 기업 부도는 가속되었다. IMF 사후평가는 이 시기 금리 수준이 과도했다고 평가했으나, 12월 5일 시점의 대안은 사실상 없었다.',
            historicalNote: '12월 5일 콜금리 21%, 12월 24일 의향서상 약 30% 수준.',
            sourceRefs: [S.crs, S.ieo, S.loi3],
          },
          consequences:
            '콜금리가 21%로 올랐습니다. 자금시장이 얼어붙었고 중소기업 부도 통계가 급증하기 시작했습니다.',
          historical: true,
        },
        {
          id: 't7-d1-b',
          label: '15%까지만 올리고 환율에 조정을 맡긴다',
          description:
            '금리 인상 폭을 제한하고 절하로 조정한다. 의향서 조항과의 충돌을 협의로 관리한다.',
          effects: [
            imfFx.setPolicyRate({ pct: 15, baselinePct: 21, label: '콜금리 12.1% → 15%' }),
            confidence(-2, '프로그램 조항과의 긴장'),
            counter('negotiatedTerms', 1),
          ],
          expert: {
            rating: 48,
            rationale:
              '실물 충격은 작지만 자본 유출 억제 효과가 줄어 가용보유액이 더 빨리 준다. 그리고 프로그램 조항을 지키지 않는 나라의 2차 인출은 지연된다 — 12월의 한국에는 그 지연을 버틸 여유가 없었다.',
            sourceRefs: [S.loi3, S.ieo],
          },
          consequences:
            '금리를 15%로 제한했습니다. 국내 자금시장은 덜 얼었지만, 협의단이 이행 점검을 앞당기겠다고 통보했습니다.',
        },
        {
          id: 't7-d1-c',
          label: '30%까지 올려 자본 유출을 강하게 억제한다',
          description:
            '홍콩식으로 금리를 크게 올려 원화 자산 보유 유인을 극대화한다. 12월 24일 의향서가 요구하게 되는 수준을 앞당긴다.',
          effects: [
            imfFx.setPolicyRate({ pct: 30, baselinePct: 21, label: '콜금리 12.1% → 30%' }),
            confidence(-7, '초고금리 — 기업 연쇄 부도 가속'),
            counter('corporateDistress', 1),
          ],
          expert: {
            rating: 40,
            rationale:
              '자본 유출 억제 효과는 가장 크다. 대가도 가장 크다 — 1998년 실업률이 2.6%에서 6.8%로 뛴 배경에 이 금리가 있다. IMF 사후평가는 초기 고금리가 과도했다고 보았고, 3주 앞당기는 것은 그 과도함을 키운다.',
            sourceRefs: [S.ieo, S.loi24],
          },
          consequences:
            '콜금리가 30%가 되었습니다. 외화 유출 속도는 눈에 띄게 느려졌고, 부도 업체 수도 눈에 띄게 늘었습니다.',
        },
      ],
    },
    {
      id: 't7-d2',
      title: '자본시장 개방과 추가 정리',
      prompt: '개방 일정과 종금사 추가 정리를 어떻게 하시겠습니까? (1~2개 선택)',
      context:
        '외국인 주식 취득한도 확대는 달러를 들여오는 몇 안 되는 수단입니다. 종금사 5개사 추가 정지는 감독 자료상 불가피합니다.',
      select: { min: 1, max: 2 },
      dimensions: ['policy', 'compliance'],
      options: [
        {
          id: 't7-d2-a',
          label: '외국인 주식 취득한도를 50%로 확대한다',
          description: '의향서 이행 사항이며 주식 자금 유입을 유도한다. 12월 12일 시행 가능하다.',
          effects: [
            flag('equity_opening_50'),
            counter('capitalAccountSteps', 1),
            confidence(2, '자본시장 개방 — 주식자금 유입 기대'),
          ],
          expert: {
            rating: 68,
            rationale:
              '한도 확대는 실제로 12월 12일 50%, 12월 30일 55%로 이어졌고 이듬해 외국인 순매수로 나타났다. 다만 12월 중순의 주가 수준에서는 유입 규모가 크지 않았다 — 자본 유입은 신뢰가 돌아온 뒤에 온다.',
            historicalNote: '12월 12일 50%, 12월 30일 55%로 확대되었다.',
            sourceRefs: [S.loi3, S.crs],
          },
          consequences: '한도가 50%로 확대되었습니다. 외국인 순매수가 소폭 늘었습니다.',
          historical: true,
        },
        {
          id: 't7-d2-b',
          label: '종합금융회사 5개사를 추가 정지한다',
          description: '자기자본 잠식이 추가로 확인된 5개사를 정지시킨다. 누계 14개사가 된다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 5,
              rolloverShockPct: 5,
              drainFactor: 1.0,
              label: '종금사 5개사 추가 업무정지(누계 14)',
            }),
            confidence(-3, '추가 정지 — 정리 범위 불확실성'),
          ],
          expert: {
            rating: 52,
            rationale:
              '불가피했지만, 12월 2일과 같은 문제가 반복되었다 — 승계 방침 없이 두 번째 일괄 정지를 하면 시장은 "세 번째도 있다"고 읽는다. 결국 30개사 중 16개사가 퇴출되었다.',
            historicalNote: '12월 10일 5개사 추가 정지로 누계 14개사가 되었다.',
            sourceRefs: [S.susp],
          },
          consequences: '5개사가 추가로 정지되었습니다. 정지된 종금사는 모두 14개사입니다.',
          historical: true,
          irreversible: true,
        },
        {
          id: 't7-d2-c',
          label: '개방을 미루고 단기 자본거래 제한을 검토한다',
          description: '유출을 막기 위해 자본거래를 제한하는 쪽으로 방향을 튼다.',
          effects: [
            flag('opening_deferred'),
            confidence(-6, '프로그램 조항 불이행'),
            imfFx.adjustRollover({ deltaPct: -8, reason: '자본거래 제한 검토 보도' }),
            imfFx.adjustDrain({ factor: 1.25, reason: '통제 우려에 따른 선제 회수' }),
          ],
          expert: {
            rating: 14,
            rationale:
              '통제를 "검토한다"는 사실만으로도 채권자는 통제 시행 전에 회수하려 한다. 말레이시아가 통제에 성공한 것은 이미 절하가 끝나고 만기 압력이 없던 1998년 9월이었기 때문이다.',
            sourceRefs: [S.malaysia, S.ieo],
          },
          consequences:
            '검토 사실이 보도되었습니다. 다음 날 회수 통보가 평소의 두 배로 들어왔습니다.',
          trap: true,
          trapExplanation:
            '통제는 선언 즉시 효력이 생기는 것이 아니라, 선언 예고 즉시 회수를 부른다. 통제를 하려면 예고 없이 해야 하고, 예고 없이 하려면 프로그램을 깨야 한다.',
        },
      ],
    },
    {
      id: 't7-d3',
      title: '단기외채 만기연장 협상 개시 시점',
      prompt:
        '채권은행 만기연장 협상을 언제 시작하시겠습니까? (이 결정도 내용이 아니라 시점이 핵심입니다)',
      context:
        '협상에는 3~4주가 걸립니다. 지금 시작하면 1월 중순, 연말에 시작하면 2월입니다. 프로그램 자금만으로는 12월 만기를 감당할 수 없습니다.',
      dimensions: ['policy', 'timeliness'],
      requiredConcepts: ['korea-crisis-toolkit'],
      options: [
        {
          id: 't7-d3-a',
          label: '프로그램 집행을 지켜본 뒤 연말에 판단한다',
          description:
            '2차·3차 인출과 자본시장 개방 효과를 먼저 확인한다. 협상 카드는 나중에 쓴다.',
          effects: [flag('rollover_talks_deferred'), counter('rolloverTalksDelayed', 1)],
          expert: {
            rating: 25,
            rationale:
              '실제 경로다. 채권은행 협상은 12월 말 이후에야 본격화되었고 합의는 1998년 1월 하순에 나왔다. 그 사이 12월 중순에 가용보유액이 39억달러까지 떨어졌다. IMF 사후평가는 민간 채권자 관여(bail-in)가 한국 위기 해결의 결정적 요소였으며 더 일찍 이루어졌어야 했다고 평가한다.',
            historicalNote:
              '1998년 1월 16일·29일 13개 국제은행과 1분기 만기 단기외채 약 240억달러 롤오버 합의.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '협상 개시를 미뤘습니다. 국제금융국장은 "12월 셋째 주를 어떻게 넘길지 계산이 서지 않습니다"라고 보고했습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '이 시나리오의 두 번째 타이밍 함정이다. 프로그램 자금이 들어오고 있으니 조금 더 지켜보자는 판단은 합리적으로 보인다. 그러나 프로그램 자금은 주 단위로 들어오고 민간 채권 회수는 일 단위로 나간다 — 산술이 처음부터 맞지 않았다. 협상을 2주 먼저 시작했다면 12월 중순의 39억달러는 오지 않았다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't7-d3-b',
          label: '지금 주요 채권은행 13곳과 뉴욕에서 협상을 개시한다',
          description:
            '미국·일본·유럽 주요 채권은행을 뉴욕에 소집하고, 각국 감독당국에 협조를 요청한다. 만기 구조와 보증 방안을 제시한다.',
          effects: [
            flag('rollover_talks'),
            imfFx.adjustRollover({ deltaPct: 12, reason: '채권은행 협상 개시' }),
            imfFx.adjustDrain({ factor: 0.72, reason: '주요 채권은행의 회수 자제' }),
            confidence(6, '민간 채권자 관여 협상 개시'),
            counter('rolloverTalksEarly', 1),
          ],
          expert: {
            rating: 92,
            rationale:
              '공적 자금으로 민간 회수를 메울 수 없다는 산술은 12월 초에 이미 분명했다. 협상 개시 사실만으로도 주요 은행은 회수를 늦춘다 — "다 같이 빠지면 아무도 못 받는다"는 것이 협상 테이블의 논리이기 때문이다. IMF 사후평가는 민간 채권자 관여를 한국 회복의 결정적 요소로 꼽았고, 실제 합의(1998-01-28)는 240억달러를 정부보증 1·2·3년물로 전환했다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '뉴욕 협상이 시작되었습니다. 주요 은행 다섯 곳이 협상 기간 중 회수 자제에 구두 동의했습니다.',
          calibrationNote: '롤오버 +12%p, 유출 계수 ×0.72 [CAL: 협상 개시의 발표 효과]',
          feasibility: {
            basis: '채권은행 소집과 각국 감독당국 협조는 1998년 1월에 실제로 이루어진 경로다',
            sourceRefs: [S.ny],
          },
        },
        {
          id: 't7-d3-c',
          label: '국제통화기금에 협상 주선을 위임한다',
          description: '프로그램 당국이 채권은행을 설득하도록 요청한다.',
          effects: [
            flag('rollover_talks_delegated'),
            imfFx.adjustRollover({ deltaPct: 4, reason: '프로그램 당국 주선' }),
            imfFx.adjustDrain({ factor: 0.9, reason: '주선 요청' }),
          ],
          expert: {
            rating: 50,
            rationale:
              '실제 협상에서도 프로그램 당국과 주요국 감독당국의 개입이 결정적이었다. 그러나 채권은행에 갚을 주체는 한국이고, 만기 구조를 아는 것도 한국이다. 위임만으로는 협상 테이블이 열리지 않는다 — 두 달이 더 걸렸다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '주선을 요청했습니다. 답은 "한국이 직접 만기표를 들고 오셔야 합니다"였습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '이번 주 들어온 돈과 나간 돈을 비교해 보십시오. 프로그램 자금만으로 메울 수 있는 규모입니까.',
      decisionId: 't7-d3',
    },
    {
      level: 3,
      text: '공적 자금으로 민간 채권자의 회수를 메울 수는 없습니다. 회수 자체를 멈추는 협상이 유일한 출구이고, 그 협상에는 3~4주가 걸립니다.',
      decisionId: 't7-d3',
      cardRefs: ['korea-crisis-toolkit'],
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'regulator-escalation-ladder'],
}

// =================================================================================================
// T8 — 1997-12-16(화) ~ 12-23(화) 1,962원 — 6틱
// =================================================================================================
const t8Interrupt: Interrupt<CentralBankState> = {
  id: 't8-i1',
  interrupt: true,
  atTick: 3,
  deadlineTick: 4,
  timeoutSec: 45,
  defaultOptionId: 't8-i1-note',
  scoreWeight: 0.5,
  required: false,
  title: '채권은행 서울지점장 방문',
  prompt: '본점이 한국 익스포저 전량 회수를 지시했다고 합니다. 어떻게 답하겠습니까?',
  source: {
    kind: 'call',
    caller: '외국 채권은행 서울지점장',
    agency: '해외 채권은행',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '외국 채권은행 서울지점장',
      text: '어제 등급이 투자부적격으로 떨어졌습니다. 본점 신용위원회가 한국 익스포저를 연말까지 전량 회수하라고 지시했습니다.',
    },
    {
      speaker: '외국 채권은행 서울지점장',
      text: '저는 8년째 서울에 있습니다. 회수가 답이 아니라는 것도 압니다. 그런데 본점을 설득할 재료가 없습니다. 한국이 무엇을 어떻게 갚을 것인지 문서로 주십시오.',
    },
  ],
  dimensions: ['communication', 'policy'],
  options: [
    {
      id: 't8-i1-maturity-table',
      label: '만기 구조표와 국가보증 방안을 즉시 문서로 제공한다',
      description:
        '1998년 1분기 만기표, 국가보증 계획, 프로그램 자금 유입 일정을 정리해 그 자리에서 건넨다.',
      effects: [
        imfFx.adjustRollover({ deltaPct: 8, reason: '만기 구조 공개와 보증 방안 제시' }),
        imfFx.adjustDrain({ factor: 0.86, reason: '주요 채권은행 회수 자제' }),
        flag('maturity_table_shared'),
        counter('transparencySteps', 1),
      ],
      expert: {
        rating: 88,
        rationale:
          '지점장이 요구한 것은 약속이 아니라 자료다. 1998년 1월의 뉴욕 협상이 성사된 것도 결국 만기 구조와 보증 범위가 문서로 제시되고 나서였다.',
        sourceRefs: [S.ny, S.ieo],
      },
      consequences: '자료를 건넸습니다. 지점장은 그날 밤 본점 신용위원회에 재심의를 요청했습니다.',
    },
    {
      id: 't8-i1-note',
      label: '정부가 대응 중이라고만 답하고 자료는 나중에 준다',
      description: '아직 확정되지 않은 사항이 많다고 설명하고 추후 제공하겠다고 답한다.',
      effects: [counter('interruptDeferred', 1), confidence(-3, '채권은행에 제시할 자료 부재')],
      expert: {
        rating: 25,
        rationale:
          '"대응 중"은 회수 지시를 뒤집을 재료가 되지 못한다. 정보 공백은 이 단계에서 그대로 회수로 번역된다.',
        sourceRefs: [S.ieo],
      },
      consequences:
        '지점장은 빈손으로 돌아갔습니다. 다음 날 해당 은행의 회수 통보가 예정대로 들어왔습니다.',
      historical: true,
    },
    {
      id: 't8-i1-threaten',
      label: '회수를 강행하면 한국 내 영업을 제한하겠다고 경고한다',
      description: '감독권을 지렛대로 회수를 억제한다.',
      effects: [
        confidence(-6, '채권은행 압박 — 협상 분위기 악화'),
        imfFx.adjustRollover({ deltaPct: -10, reason: '감독권 압박에 따른 반발' }),
        imfFx.adjustDrain({ factor: 1.2, reason: '보복적 회수 가속' }),
      ],
      expert: {
        rating: 8,
        rationale:
          '회수를 결정하는 것은 서울지점이 아니라 본점 신용위원회다. 지점을 압박하면 본점은 "정치적 위험"을 한 줄 추가하고 회수를 앞당긴다.',
        sourceRefs: [S.ny],
      },
      consequences:
        '경고가 전달되었습니다. 그날 밤 해당 은행 본점은 회수 일정을 앞당기기로 했습니다.',
    },
  ],
}

export const t8: T = {
  id: 't8',
  label: 'T8',
  timeLabel: '1997년 12월 16일(화) ~ 23일(화) · 일중 · KST',
  title: '1,962원 — 변동폭이 사라진 주',
  time: '1997-12-16T09:00:00+09:00',
  ticks: 6,
  tickLabels: [
    '12/16 변동폭 폐지',
    '12/18 내부 보고',
    '12/19 2차 인출',
    '12/22 국가보증',
    '12/23 11:00',
    '12/23 15:00 종가',
  ],
  entryEffects: [
    {
      id: 't8-x1-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 32, dueThisMonth: 140, shortTermDebt: 800 }),
      ],
      description: '롤오버율 32% — 만기의 3분의 2가 회수되고 있다',
    },
    {
      id: 't8-x2-market',
      effects: [imfFx.marketMove({ spreadBp: 60, fundingStressBp: 150 })],
      description: '한국물 가산금리 급등',
    },
  ],
  eachTick: [
    {
      id: 't8-tick-drain',
      effects: [
        imfFx.runoffStep({
          total: 59.4,
          profile: [0.22, 0.19, 0.17, 0.15, 0.14, 0.13],
          label: '단기외채 회수(일중 배분)',
        }),
      ],
      description: '대외 유출',
    },
  ],
  tickEffects: [
    {
      id: 't8-tick2-drawing',
      atTick: 2,
      effects: [
        imfFx.disburse({
          amount: 35.2,
          source: '국제통화기금 2차 인출',
          imf: true,
          label: '2차 인출 35.2억달러',
        }),
        confidence(3, '2차 인출 집행'),
      ],
      description: '국제통화기금 2차 인출',
    },
    {
      id: 't8-tick3-guarantee',
      atTick: 3,
      effects: [
        imfFx.ratingAction({
          to: 'Ba1',
          notches: 2,
          junk: true,
          label: '국가신용등급 Baa2 → Ba1 (투자부적격)',
        }),
        imfFx.releaseBranchDeposits({
          amount: 12.0,
          label: '국가보증에 따른 해외점포 예치금 환류 12억달러',
        }),
        confidence(8, '은행 외화채무 200억달러 국가보증'),
        flag('bank_debt_guarantee'),
      ],
      description: '무디스 투자부적격 강등(12/21)과 은행 외화채무 국가보증(12/22)',
    },
    {
      id: 't8-tick5-close',
      atTick: 5,
      effects: [imfFx.fxSettle({ close: 1962.0, baseline: 0, bandDays: 2 })],
      description: '12월 23일 종가 확정',
    },
  ],
  ticker: {
    series: [
      {
        path: 'institution.fx.spot',
        mode: 'absolute',
        values: [1565.9, 1712.0, 1810.0, 1885.0, 1995.0, 1995.0],
      },
      {
        path: 'market.fxUsdLocal',
        mode: 'absolute',
        values: [1565.9, 1712.0, 1810.0, 1885.0, 1995.0, 1995.0],
      },
      { path: 'market.equityIndex', mode: 'relative', values: [343, 330, 322, 336, 352, 366] },
      {
        path: 'institution.sovereign.spreadBp',
        mode: 'absolute',
        values: [0, 40, 70, 90, 120, 110],
      },
    ],
  },
  events: [
    {
      id: 't8-regulator-float',
      kind: 'regulator',
      agency: '재정경제원',
      time: '12/16 09:00',
      atTick: 0,
      headline: '환율 일일변동폭 폐지 — 완전 자유변동환율제 이행, 최고금리 25% → 40%',
      body: '정부는 환율 일일변동폭을 폐지해 환율이 전적으로 시장에서 결정되도록 했다. 같은 날 이자제한법상 최고금리를 40%로 올렸다. 두 조치 모두 의향서 이행 사항이다.',
      tone: 'urgent',
      severity: 'warning',
      sourceRefs: [S.band, S.loi3],
      relatedMetrics: ['fxSpot'],
    },
    {
      id: 't8-data-39',
      kind: 'data',
      time: '12/18 08:00',
      atTick: 1,
      title: '[대외비] 가용외환보유액 일일 보고',
      rows: [
        { label: '가용외환보유액', value: '약 39억달러' },
        { label: '총외환보유액(공표 기준)', value: '약 210억달러' },
        { label: '괴리', value: '약 171억달러' },
        { label: '이번 달 잔여 만기 도래액', value: '약 60억달러' },
        { label: '단기외채 롤오버율', value: '32%' },
      ],
      severity: 'critical',
      sourceRefs: [S.hearing, S.res, S.debt],
      relatedMetrics: ['usableReserves', 'grossReserves', 'reserveGap'],
    },
    {
      id: 't8-news-junk',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '12/22 08:00',
      atTick: 3,
      headline: '무디스, 한국 국가신용등급 Ba1로 강등 — 투자부적격',
      body: '한국 국가신용등급이 투자적격 아래로 내려갔다. 투자적격 채권만 보유할 수 있는 해외 기관투자자의 강제 매도가 예상된다. 정부는 같은 날 국내 금융기관 외화채무 200억달러에 대한 국가보증 방침을 밝혔다.',
      severity: 'critical',
      sourceRefs: [S.moodys, S.guar],
      relatedMetrics: ['sovereignSpreadBp', 'rolloverRatePct'],
    },
    {
      id: 't8-memo-guarantee',
      kind: 'memo',
      time: '12/22 14:00',
      atTick: 3,
      from: '재정경제원 국제금융국',
      to: '정책담당',
      subject: '은행 외화채무 국가보증과 한국은행 외화대출 조건',
      body: `- 국내 금융기관 외화채무 **200억달러**에 대한 국가보증 방침을 발표했습니다(국회 동의 전제).
- 한국은행 외화대출 금리는 **LIBOR + 1,000bp**로 정했습니다. 벌칙 수준입니다 — 지원은 하되 의존을 막기 위한 가격입니다.
- 보증 효과로 일부 해외점포가 자체 조달에 성공해 **예치금 12억달러가 환류**했습니다. 가용외환보유액이 그만큼 늘었습니다.

보증은 우발채무입니다. 우리가 갚을 수 있다고 시장이 믿는 동안만 효력이 있습니다.`,
      severity: 'warning',
      sourceRefs: [S.guar, S.bokAct],
      relatedMetrics: ['usableReserves', 'reserveGap'],
    },
    {
      id: 't8-news-1962',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '12/23 15:40',
      atTick: 5,
      headline: '원/달러 종가 1,962.0원 — 장중 1,995.0원까지 올랐다',
      body: '변동폭이 폐지된 뒤 환율은 매일 새 기록을 썼다. 이날 장중 1,995.0원까지 오른 뒤 1,962.0원에 마감했다. 7월 2일 종가 887.2원에서 5개월 만에 두 배를 넘었다.',
      severity: 'critical',
      sourceRefs: [S.rate],
      relatedMetrics: ['fxSpot'],
    },
  ],
  decisions: [
    {
      id: 't8-d1',
      title: '환율제도',
      prompt: '변동폭을 어떻게 하시겠습니까?',
      context:
        '±10% 상한에 연일 닿아 거래가 성립하지 않고 있습니다. 수입결제와 무역금융이 막혔습니다.',
      dimensions: ['policy', 'marketRisk'],
      options: [
        {
          id: 't8-d1-a',
          label: '변동폭을 폐지하고 완전 자유변동환율제로 이행한다',
          description:
            '고시로 변동폭을 없앤다. 환율은 급등하지만 매일 거래가 성립하고 무역결제가 돌아온다. 의향서 이행 사항이다.',
          effects: [
            imfFx.setBand({ pct: 0, label: '변동폭 폐지 — 완전 자유변동환율' }),
            confidence(-2, '절하 가속의 충격'),
            flag('fx_floated'),
          ],
          expert: {
            rating: 80,
            rationale:
              '거래 불성립은 환율 안정이 아니라 시장 정지다. 폐지 후 환율은 1,962원까지 갔지만 무역결제가 돌아왔고, 1998년 1월부터는 오히려 절상되기 시작했다. 시장이 청산되어야 균형이 생긴다.',
            historicalNote: '1997년 12월 16일 변동폭이 폐지되었다.',
            sourceRefs: [S.band, S.ieo],
          },
          consequences:
            '변동폭이 폐지되었습니다. 환율은 매일 새 기록을 쓰고 있지만, 수입업체들이 결제를 할 수 있게 되었습니다.',
          historical: true,
          feasibility: {
            basis: '재정경제원 고시 — 12월 16일 실제로 시행되었다',
            sourceRefs: [S.band],
          },
        },
        {
          id: 't8-d1-b',
          label: '±10% 변동폭을 유지하고 상한 거래를 이어 간다',
          description: '절하 속도를 제도로 제한한다. 화면상 환율은 덜 오른다.',
          effects: [flag('band_kept'), counter('bandKept', 1)],
          expert: {
            rating: 10,
            rationale:
              '상한에 닿으면 거래가 성립하지 않는다. 수입결제와 무역금융이 막히고, 막힌 결제는 결국 한국은행 외화로 메워야 한다 — 환율을 눌러 아낀 돈보다 결제를 메우는 돈이 더 크다.',
            sourceRefs: [S.band, S.ieo],
          },
          consequences:
            '변동폭이 유지되었습니다. 상한가 거래 불성립이 이어지고 무역결제가 밀리고 있습니다.',
          trap: true,
          trapExplanation:
            '화면의 환율이 덜 오르는 것과 경제가 덜 아픈 것은 다르다. 거래 불성립이 쌓이면 무역금융이 마비되고, 그 비용은 가용외환보유액으로 지불된다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't8-d1-c',
          label: '자본통제를 도입하고 환율을 고정한다',
          description:
            '단기 자본거래를 전면 제한하고 환율을 고정한다. 이듬해 말레이시아가 택하는 경로다.',
          effects: [
            flag('capital_controls'),
            imfFx.setBand({ pct: 0.5, label: '환율 사실상 고정' }),
            confidence(-16, '자본통제 — 프로그램 이행 중단'),
            imfFx.adjustRollover({ deltaPct: -22, reason: '자본통제 — 전면 회수' }),
            imfFx.adjustDrain({ factor: 1.6, reason: '통제 발표 전후 자금 이탈' }),
            regulator({ set: 4 }, '프로그램 이행 중단 — 자본거래 전면 제한'),
          ],
          expert: {
            rating: 10,
            rationale:
              '말레이시아는 1998년 9월 1일에 이 길을 택했고 결과는 나쁘지 않았다. 다만 그때는 단기외채가 적었고 절하가 끝난 뒤였다. 12월 23일의 한국은 만기가 목전이고 프로그램 자금이 진행 중이다 — 통제는 그 자금을 멈추고 회수를 가속한다.',
            sourceRefs: [S.malaysia, S.ieo],
          },
          consequences:
            '자본거래가 전면 제한되었습니다. 프로그램 이행 점검이 중단되었고, 남은 만기는 전부 회수 통보로 들어왔습니다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't8-d2',
      title: '12월 23일 장중 대응',
      prompt: '장중 1,995원까지 올랐습니다. 지금 무엇을 하시겠습니까? (오후 마감 전 결정)',
      context:
        '가용외환보유액은 40억달러 안팎이고 이번 달 잔여 만기는 60억달러입니다. 방어에 쓸 돈이 이번 달 갚을 돈보다 적습니다.',
      availableFrom: 2,
      deadlineTick: 4,
      defaultOptionId: 't8-d2-hold',
      timeLimitSec: 90,
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't8-d2-hold',
          label: '개입하지 않고 국가보증과 금리로만 대응한다',
          description: '남은 가용보유액은 전부 만기 결제에 남긴다. 환율은 시장이 정하게 둔다.',
          effects: [counter('restraintDays', 2), flag('no_intervention_final')],
          expert: {
            rating: 85,
            rationale:
              '이 시점에는 개입할 돈이 없었고, 없다는 사실을 인정한 것이 옳았다. 12월 23일 종가 1,962원은 개입 없는 가격이고, 한 달 뒤 환율은 1,700원대로 내려온다 — 개입이 아니라 만기연장 합의가 환율을 되돌렸다.',
            historicalNote: '12월 23일 종가 1,962.0원(장중 고가 1,995.0원).',
            sourceRefs: [S.rate, S.ny],
          },
          consequences:
            '개입하지 않았습니다. 원/달러는 장중 1,995.0원까지 올랐다가 1,962.0원에 마감했습니다.',
          historical: true,
        },
        {
          id: 't8-d2-intervene',
          label: '남은 보유액으로 현물 개입을 재개해 2,000원을 막는다',
          description:
            '2,000원이라는 상징적 숫자가 뚫리면 심리가 완전히 무너진다고 보고 개입을 재개한다. 25억달러를 투입한다.',
          effects: [
            imfFx.intervene({ amount: 25.0, label: '2,000원 방어 개입 25억달러' }),
            counter('finalDefence', 1),
          ],
          expert: {
            rating: 5,
            rationale:
              '가용 40억달러 중 25억달러를, 이번 달 잔여 만기 60억달러를 앞두고 쓴다. 남는 것은 15억달러이고 그것으로는 다음 주 만기를 못 갚는다. 개입이 알려지는 순간 시장은 가용보유액을 역산하고, 역산된 숫자는 2,000원보다 훨씬 무서운 숫자다.',
            sourceRefs: [S.hearing, S.ara, S.ieo],
          },
          consequences:
            '2,000원은 막았습니다. 가용외환보유액은 15억달러 안팎이 되었습니다. 이번 달 만기는 아직 60억달러 남아 있습니다.',
          trap: true,
          trapExplanation:
            '이 시나리오에서 마지막이자 가장 비싼 함정이다. 2,000원이라는 숫자는 당시 신문 1면의 언어였고 막아야 할 것처럼 보였다. 그러나 가용외환보유액이 그달의 잔여 만기보다 적어진 뒤의 현물 개입은 방어가 아니라 지급불능의 앞당김이다. 대시보드의 두 숫자 — 가용 40억달러와 잔여 만기 60억달러 — 를 나란히 보면 이 선택은 성립하지 않는다.',
          remediationCard: 'contingency-funding-plan',
        },
        {
          id: 't8-d2-moratorium',
          label: '대외지급 정지(모라토리엄)를 선언한다',
          description:
            '더 이상 갚을 수 없다고 선언하고 채무 재조정을 일방적으로 요구한다. 되돌릴 수 없다.',
          effects: [imfFx.declareMoratorium('대외지급 정지 선언')],
          expert: {
            rating: 2,
            rationale:
              '한국은 이 길을 가지 않았고, 가지 않은 것이 1998년의 회복을 가능하게 했다. 선언하는 순간 무역금융이 전면 중단되고, 수입 원자재가 끊기며, 재진입에 수년이 걸린다. 실제 경로였던 정부보증 만기연장(1998-01-28, 218.4억달러)은 같은 목적을 훨씬 싸게 달성했다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '대외지급 정지가 선언되었습니다. 무역금융이 즉시 중단되었고 국가신용등급은 선택적 디폴트로 떨어졌습니다.',
          irreversible: true,
          illegal: false,
          trap: true,
          trapExplanation:
            '"어차피 못 갚을 바에는 먼저 선언하자"는 유혹. 그러나 만기연장 협상은 아직 시도조차 하지 않았고, 선언은 그 협상의 가능성 자체를 없앤다.',
        },
      ],
    },
  ],
  interrupts: [t8Interrupt],
  advisorHints: [
    {
      level: 1,
      text: '가용외환보유액과 이번 달 잔여 만기를 나란히 보십시오. 두 숫자의 관계가 이번 결정의 전부입니다.',
      decisionId: 't8-d2',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'contingency-funding-plan'],
}

// =================================================================================================
// T9 — 1997-12-24(수) ~ 1998-01-28(수) "뉴욕"
// =================================================================================================
export const t9: T = {
  id: 't9',
  label: 'T9',
  timeLabel: '1997년 12월 24일(수) ~ 1998년 1월 28일(수) · KST / EST',
  title: '뉴욕 — 회수를 멈추는 협상',
  time: '1997-12-24T09:00:00+09:00',
  entryEffects: [
    {
      id: 't9-x1-early',
      effects: [
        imfFx.disburse({
          amount: 100.0,
          source: '국제통화기금·세계은행·아시아개발은행 조기지원',
          imf: true,
          label: '조기지원 100억달러',
        }),
        confidence(8, '100억달러 조기지원 합의'),
      ],
      description: '12월 24일 조기지원 합의',
    },
    {
      id: 't9-x2-rate',
      effects: [
        imfFx.setPolicyRate({ pct: 30, baselinePct: 30, label: '콜금리 약 30%(의향서 조항)' }),
      ],
      description: '12월 24일 의향서 — 콜금리 약 30%',
    },
    {
      id: 't9-x3-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 45, dueThisMonth: 240, shortTermDebt: 800 }),
      ],
      description: '1998년 1분기 만기 240억달러',
    },
    {
      id: 't9-x4-drain',
      effects: [imfFx.runoffStep({ total: 78.0, profile: [1], label: '연말·1월 만기 회수' })],
      description: '대외 유출(12/24~1/28)',
    },
    {
      id: 't9-x5-market',
      effects: [imfFx.marketMove({ equityPct: 12, spreadBp: -300, fundingStressBp: -80 })],
      description: '조기지원과 협상 기대에 따른 반등',
    },
  ],
  events: [
    {
      id: 't9-regulator-early',
      kind: 'regulator',
      agency: '국제통화기금 · 주요국',
      time: '12/24 (워싱턴)',
      headline: '100억달러 조기지원 합의 — 의향서 갱신, 콜금리 약 30% 수준 유지',
      body: '국제통화기금과 세계은행·아시아개발은행, 주요국은 예정보다 앞당겨 100억달러를 제공하기로 했다. 갱신된 의향서는 통화 긴축 유지와 함께 단기외채 만기연장 협상 개시를 명시했다.',
      tone: 'routine',
      severity: 'positive',
      sourceRefs: [S.loi24, S.sba],
      relatedMetrics: ['usableReserves', 'imfCommitted'],
    },
    {
      id: 't9-data-yearend',
      kind: 'data',
      time: '12/31 18:00',
      title: '1997년 마감',
      rows: [
        { label: '총외환보유액(연말)', value: '약 207억달러' },
        { label: '원/달러(연말)', value: '약 1,701원 (7월 2일 886원)' },
        { label: '총외채', value: '약 1,530억달러 (단기 비중 58.8%)' },
        { label: '업무정지 종금사', value: '14개사' },
        { label: '가교 종합금융회사', value: '12월 31일 설립' },
      ],
      severity: 'warning',
      sourceRefs: [S.res, S.rate, S.debt, S.susp],
      relatedMetrics: ['grossReserves', 'fxSpot'],
    },
    {
      id: 't9-dialogue-ny',
      kind: 'dialogue',
      time: '1998-01-26 (뉴욕)',
      title: '뉴욕 채권은행 협상 (재구성)',
      lines: [
        {
          speaker: '채권은행단 대표',
          text: '우리는 열세 개 은행입니다. 한 곳이라도 빠지면 나머지는 손해를 봅니다. 전원이 같은 조건이어야 합니다.',
        },
        {
          speaker: '재정경제원 협상단장',
          text: '1분기 만기 약 240억달러를 정부보증 1년·2년·3년물로 전환하겠습니다. 가산금리는 만기별로 차등합니다.',
        },
        {
          speaker: '채권은행단 대표',
          text: '정부보증이 붙는다면 우리 신용위원회를 설득할 수 있습니다. 한국 리스크가 아니라 한국 정부 리스크가 되니까요. 문제는 각국 감독당국이 이 전환을 부실 재조정으로 보지 않아야 한다는 것입니다.',
        },
      ],
      severity: 'positive',
      sourceRefs: [S.ny],
    },
  ],
  decisions: [
    {
      id: 't9-d1',
      title: '뉴욕 만기연장 협상',
      prompt: '채권은행단 대표와 마주 앉았습니다.',
      context:
        '1998년 1분기 만기가 약 240억달러입니다. 협상이 깨지면 1분기를 넘길 방법이 없습니다. 협상 방식(일괄 vs 개별), 보증 규모, 만기 구조를 차례로 정해야 합니다.',
      select: { min: 1, max: 1 },
      defaultOptionId: 't9-d1-a',
      steps: nySteps,
      dimensions: ['policy', 'communication'],
      requiredConcepts: ['korea-crisis-toolkit'],
      options: [
        {
          id: 't9-d1-a',
          label: '정부보증 1·2·3년물 전환을 제시한다 (LIBOR+2.25/2.50/2.75%)',
          description:
            '단기 채권을 정부보증 중장기물로 바꾼다. 채권은행은 원금을 보전하고 한국은 만기를 번다. 국회 동의를 전제로 한 보증이다.',
          effects: [
            imfFx.rolloverAgreement({
              amount: 240.0,
              converted: 218.4,
              releaseBranches: 86.0,
              pledgeCounter: 'debtGuaranteeBn',
              label: '단기외채 240억달러 만기연장 — 정부보증 218.4억달러 전환',
            }),
            imfFx.fxStep({ close: 1688.0, baseline: 0, bandDays: 25 }),
            // `rollover_agreed` 플래그는 rolloverAgreement 가 **전액 보증을 약속한 경우에만** 세운다
            // (뉴욕 대화에서 약속한 보증 규모가 곧 합의의 완결성이다).
            regulator({ set: 2 }, '만기연장 합의 — 대외지급 위험 완화'),
          ],
          expert: {
            rating: 90,
            rationale:
              '실제 합의이며 위기의 전환점이었다. 1998년 1월 16일과 29일 13개 국제은행과 1분기 만기 약 240억달러의 롤오버에 합의했고, 3월 31일 기준 218.4억달러가 정부보증 1·2·3년물(LIBOR+2.25/2.50/2.75%)로 전환되었다. IMF 사후평가는 이 민간 채권자 관여가 한국 회복의 결정적 요소였다고 본다 — 공적 자금이 아니라 회수를 멈춘 것이 위기를 끝냈다.',
            historicalNote:
              '1998-01-28 합의, 1998-03-31 최종 전환액 218.4억달러. 해외점포 예치금도 이후 단계적으로 환류했다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '합의가 이루어졌습니다. 회수가 멈췄고, 해외점포 예치금 86억달러가 환류했습니다. 가용외환보유액이 처음으로 세 자릿수로 올라왔습니다.',
          historical: true,
          feasibility: {
            basis: '13개 국제은행과의 협상 및 각국 감독당국 협조로 실제 성사된 구조',
            sourceRefs: [S.ny],
          },
        },
        {
          id: 't9-d1-b',
          label: '정부보증 없이 고금리만 제시해 자율적 연장을 유도한다',
          description:
            '보증 없이 가산금리를 크게 얹어 채권은행의 자발적 연장을 유도한다. 우발채무를 지지 않는다.',
          effects: [
            imfFx.rolloverAgreement({
              amount: 90.0,
              converted: 60.0,
              releaseBranches: 25.0,
              label: '무보증 부분 연장 — 90억달러',
            }),
            imfFx.fxStep({ close: 1688.0, baseline: 0, bandDays: 25, freeFloatPremiumPct: 6 }),
            confidence(-4, '부분 연장에 그침'),
          ],
          expert: {
            rating: 35,
            rationale:
              '투자부적격 등급의 차주에게 금리만 얹어 준다고 신용위원회가 연장을 승인하지는 않는다. 은행이 필요로 한 것은 수익이 아니라 위험가중치를 낮출 보증이었다. 부분 연장으로는 1분기를 넘길 수 없다.',
            sourceRefs: [S.ny, S.crs],
          },
          consequences: '일부 은행만 연장에 동의했습니다. 1분기 만기의 3분의 1을 넘겼을 뿐입니다.',
        },
        {
          id: 't9-d1-c',
          label: '채권은행에 원금 감면(손실분담)을 요구한다',
          description:
            '민간 채권자에게도 손실을 분담하라고 요구한다. 원칙적으로는 타당하나 합의 가능성이 낮다.',
          effects: [
            imfFx.rolloverAgreement({
              amount: 40.0,
              converted: 20.0,
              releaseBranches: 10.0,
              label: '협상 결렬 후 소규모 연장',
            }),
            imfFx.fxStep({ close: 1688.0, baseline: 0, bandDays: 25, freeFloatPremiumPct: 12 }),
            confidence(-12, '협상 사실상 결렬'),
            regulator({ set: 3 }, '만기연장 협상 난항'),
          ],
          expert: {
            rating: 18,
            rationale:
              '손실분담 원칙은 이후 국제 논의의 핵심 주제가 되었지만, 1998년 1월의 한국에는 그 협상을 지탱할 보유액이 없었다. 감면을 요구하면 은행은 협상 대신 상각과 회수를 택한다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '감면 요구에 채권은행단이 협상장을 떠났습니다. 소수 은행과의 개별 연장만 남았습니다.',
        },
        {
          id: 't9-d1-d',
          label: '협상을 중단하고 대외지급 정지를 선언한다',
          description: '일방적 채무 재조정을 선언한다. 되돌릴 수 없다.',
          effects: [
            imfFx.declareMoratorium('대외지급 정지 선언'),
            imfFx.fxStep({ close: 1688.0, baseline: 0, bandDays: 25, freeFloatPremiumPct: 25 }),
          ],
          expert: {
            rating: 2,
            rationale:
              '협상이 눈앞에 있는 상태에서의 선언은 얻을 것이 없다. 한국은 이 길을 가지 않았고, 그 덕분에 몇 달 뒤 외국환평형기금채권 발행으로 국제 자본시장에 복귀할 수 있었다.',
            sourceRefs: [S.ny, S.ieo],
          },
          consequences:
            '대외지급 정지가 선언되었습니다. 협상단은 귀국했고 무역금융이 전면 중단되었습니다.',
          irreversible: true,
          trap: true,
          trapExplanation:
            '협상 테이블이 열려 있는데도 선언을 택하는 것은, 이미 치른 비용을 전부 버리는 일이다.',
        },
      ],
    },
    {
      id: 't9-d2',
      title: '국내 소통과 자본시장 복귀 준비',
      prompt: '국민과 시장에 무엇을 말하고, 무엇을 준비하시겠습니까? (1~2개 선택)',
      context:
        '1월에도 금리 30%와 환율 1,700원이 이어집니다. 부도와 실업이 급증하고 있습니다. 동시에 자본시장 복귀 준비를 해야 합니다.',
      select: { min: 1, max: 2 },
      dimensions: ['communication', 'policy'],
      options: [
        {
          id: 't9-d2-a',
          label: '외화 조달 실태와 상환 일정을 정기 공표하고 외평채 발행을 준비한다',
          description:
            '가용보유액·단기외채 만기표를 정기 공표하고, 국제 자본시장 복귀를 위한 외국환평형기금채권 발행을 준비한다.',
          effects: [
            flag('reserves_disclosed'),
            flag('fx_bond_prepared'),
            confidence(5, '실태 공표와 복귀 계획'),
            counter('transparencySteps', 1),
          ],
          expert: {
            rating: 85,
            rationale:
              '외국환평형기금채권 발행은 국제 자본시장 복귀의 신호가 되며, 그 전제가 통계 공표 기준의 정상화다. 정기 공표는 위기 중에는 아프고 위기 후에는 자산이다.',
            historicalNote:
              '위기 이후 40억달러 규모의 외국환평형기금채권이 발행되어 국제 자본시장 복귀의 신호가 되었다.',
            sourceRefs: [S.crs, S.ara],
          },
          consequences: '정기 공표가 시작되었고 외평채 실무 준비에 들어갔습니다.',
          historical: true,
        },
        {
          id: 't9-d2-b',
          label: '국민 참여 외화 확보 운동을 조직한다',
          description:
            '가계 보유 금을 모아 수출해 외화를 확보하는 운동을 조직한다. 규모보다 상징의 효과가 크다.',
          effects: [
            flag('gold_campaign'),
            confidence(5, '국민 참여 — 대외 신인도에 상징 효과'),
            counter('publicCampaign', 1),
          ],
          expert: {
            rating: 62,
            rationale:
              '실제로 이루어졌고 대외적으로 강한 인상을 남겼다. 확보된 외화는 위기 규모에 비하면 작았지만, "국민이 부담을 나눈다"는 신호는 채권은행 협상장에서도 언급되었다. 다만 이것이 정책을 대신할 수는 없다.',
            historicalNote: '1998년 1월부터 전국적인 금 모으기 운동이 전개되었다.',
            sourceRefs: [S.herald, S.crs],
          },
          consequences: '전국에서 참여가 이어지고 있습니다. 외신들이 이 장면을 크게 보도했습니다.',
          historical: true,
        },
        {
          id: 't9-d2-c',
          label: '고금리를 즉시 정상화하고 프로그램 조항 완화를 요구한다',
          description: '국내 실물 충격을 이유로 금리를 즉시 내리고 프로그램 조항 완화를 요구한다.',
          effects: [
            imfFx.setPolicyRate({ pct: 15, baselinePct: 30, label: '콜금리 30% → 15%' }),
            confidence(-6, '프로그램 조항 일방 변경'),
            imfFx.adjustRollover({ deltaPct: -10, reason: '프로그램 이행 불확실' }),
            imfFx.adjustDrain({ factor: 1.25, reason: '조항 불이행에 따른 회수 재개' }),
          ],
          expert: {
            rating: 25,
            rationale:
              '금리 정상화 자체는 결국 1998년 봄에 이루어졌고 옳은 방향이었다. 그러나 만기연장 합의가 확정되기 전에 일방적으로 하면 협상 상대에게 "한국은 약속을 안 지킨다"는 재료를 준다. 순서의 문제다.',
            sourceRefs: [S.ieo, S.ny],
          },
          consequences:
            '금리를 내렸습니다. 국내 자금시장은 숨을 돌렸지만, 협상 중이던 은행 두 곳이 조건 재검토를 요청했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      text: '채권은행이 원하는 것은 수익이 아니라 위험가중치입니다. 정부보증은 그들의 신용위원회가 이해하는 유일한 언어입니다.',
      decisionId: 't9-d1',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'crisis-communication'],
}

export const turnsB: T[] = [t5, t6, t7, t8, t9]
