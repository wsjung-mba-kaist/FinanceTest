import type { AssetManagerState, DialogueStep, Interrupt, Turn } from '../../engine/types'
import { confidence, counter, feed, flag, regulator } from '../../engine/fx/common'
import { fundFx } from './fx'
import { REDEMPTION_BASE, S } from './turnsA'

type T = Turn<AssetManagerState>

/**
 * turnsB — T4(3/18) ~ T7(3/24). 세 개의 일중(intraday) 턴과 되돌림 턴.
 *
 * 인물 발언은 모두 개연성 있는 재구성이며 실제 녹취가 아니다(turnsA.ts 상단 주석 참조).
 *
 * 일중 구조(4틱): 개장 → 딜러 호가 점검 → **환매 주문 마감** → 밸류에이션 포인트.
 * 티커는 국채 10년·IG/HY 스프레드·VIX를 그날의 실제 종가까지 움직이며(마지막 틱은 평가 시점이므로
 * 값이 고정된다), `eachTick`의 markToMarket이 그 움직임을 장부에 반영한다.
 * 환매는 `profile`로 일중 분포가 저작되어 있고, 조각의 합은 틱이 없는 턴의 1회 호출과 정확히 같다.
 */

/** 일중 환매 분포 — 주문 마감(틱 2) 전까지 대부분이 들어온다. */
export const PROFILE_T4 = [0.35, 0.3, 0.3, 0.05]
export const PROFILE_T5 = [0.3, 0.25, 0.4, 0.05]
export const PROFILE_T6 = [0.45, 0.3, 0.2, 0.05]

// ---------------------------------------------------------------------------------------------
// T4 — 2020-03-18 (수) "국채마저 팔린다"
// ---------------------------------------------------------------------------------------------
const t4Interrupt: Interrupt<AssetManagerState> = {
  id: 't4-i1',
  interrupt: true,
  atTick: 1,
  deadlineTick: 1,
  timeoutSec: 45,
  defaultOptionId: 't4-i1-d',
  scoreWeight: 0.5,
  required: false,
  title: '딜러가 호가를 거둔다',
  prompt: '진행 중이던 $150M IG 블록에서 딜러가 호가를 내렸습니다. 지금 어떻게 하시겠습니까?',
  source: { kind: 'desk', caller: '프라이머리딜러 크레딧 데스크', tone: 'urgent' },
  lines: [
    {
      speaker: '딜러 트레이더',
      text: '아까 드린 호가는 더 못 지킵니다. 지금은 −150bp 넓혀야 받을 수 있고, 그것도 절반만 됩니다.',
    },
    { speaker: '우리 트레이더', text: '나머지 절반은요?' },
    { speaker: '딜러 트레이더', text: '저희 대차대조표로는 못 받습니다. 30초 안에 답 주십시오.' },
  ],
  dimensions: ['liquidity', 'marketRisk'],
  options: [
    {
      id: 't4-i1-a',
      label: '로트를 쪼개 세 딜러에 분산 체결',
      description: '$50M씩 나눠 세 곳에 동시에 낸다. 체결까지 시간이 걸리지만 충격이 분산된다.',
      effects: [counter('splitLots', 1), fundFx.redeemAmp({ factor: 1, reason: '분산 체결' })],
      expert: {
        rating: 74,
        rationale:
          'O’Hara·Zhou는 이 국면에 딜러가 대차대조표를 쓰지 않고 중개만 했음을 보인다. 블록을 쪼개면 왕복 비용은 블록 호가(150bp+)보다 낮아지지만 체결까지 시간이 걸린다.',
        sourceRefs: [S.ohara],
      },
      consequences: '세 딜러에 분산해 대부분 체결했습니다. 평균 체결가는 첫 호가보다 낮았습니다.',
    },
    {
      id: 't4-i1-b',
      label: '내려간 호가에 전량 체결',
      description: '150bp 넓어진 호가를 그대로 받아 오늘 안에 현금을 확보한다.',
      effects: [
        counter('hitBlockBid', 1),
        confidence(-2, '블록 체결가 노출'),
        fundFx.redeemAmp({ factor: 1.03, reason: '체결가가 시장에 알려짐' }),
      ],
      expert: {
        rating: 36,
        rationale:
          '현금은 확보되지만 블록 거래비용이 24bp에서 150bp 이상으로 오른 시장에서 그 가격을 그대로 받은 것이다. 체결가는 곧 다른 참가자의 참조가격이 되어 우리 잔여 포지션의 평가에도 돌아온다.',
        sourceRefs: [S.ohara],
      },
      consequences: '전량 체결되었습니다. 현금은 들어왔지만 체결가가 낮아 평가손이 확정되었습니다.',
      historical: true,
    },
    {
      id: 't4-i1-c',
      label: '주문을 철회하고 현물 바스켓으로 전환',
      description: '블록을 접고 같은 물량을 AP에 바스켓으로 인도한다. 개별 호가를 찾지 않는다.',
      effects: [fundFx.sellViaEtfCreation({ amount: 150, feeBp: 25 })],
      expert: {
        rating: 82,
        rationale:
          '딜러 대차대조표가 닫힌 날 발행시장(in-kind) 경로는 개별 호가 없이 위험을 넘긴다. 비용은 ETF 할인폭이며, 이 시점 할인폭은 블록 호가보다 좁았다.',
        sourceRefs: [S.etfPrimary, S.fimsac],
      },
      consequences:
        '블록을 철회하고 바스켓을 인도했습니다. 현금이 들어왔고 비유동 비중이 내려갔습니다.',
    },
    {
      id: 't4-i1-d',
      label: '응답 보류 — 주문은 자동 취소된다',
      description: '지금 답하지 않으면 딜러가 주문을 거둔다. 오늘 이 물량은 체결되지 않는다.',
      effects: [counter('desk_no_answer', 1), confidence(-3, '데스크 무응답')],
      expert: {
        rating: 26,
        rationale:
          '유동성이 사라지는 날에 시간을 쓰는 것은 가장 비싼 선택이다. 다음 호가는 오늘 호가보다 좋을 확률이 낮았고, 실제로 3월 18일은 국채마저 팔리던 날이었다.',
        sourceRefs: [S.bis, S.fsb],
      },
      consequences: '주문이 취소되었습니다. 오늘 조달 계획에서 $150M이 빠졌습니다.',
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2020년 3월 18일 (수) 09:30~16:00 ET',
  title: '국채마저 팔린다',
  time: '2020-03-18T09:30:00-04:00',
  ticks: 4,
  tickLabels: [
    '09:30 개장',
    '11:30 딜러 호가 점검',
    '14:00 환매 주문 마감',
    '16:00 밸류에이션 포인트',
  ],
  entryEffects: [
    {
      id: 't4-open',
      description:
        '3/18 개장: 전일 종가 10년 1.02%, IG 320bp. 네 번째 서킷브레이커. 국채 현·선물 베이시스 청산 물량',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 54,
          govt10yBp: 102,
          govt30yBp: 177,
          igBp: 320,
          hyBp: 950,
          volIndex: 69.37,
          equityIndex: 81.18,
          fundingStressBp: 85,
          bidAskIgBp: 95,
          etfDiscountPct: -3.1,
          treasuryOffRunBp: 30,
          label: '3/18 개장 시세',
        }),
        confidence(-7, '안전자산 동반 매도'),
      ],
    },
    { id: 't4-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
    {
      id: 't4-gate-count',
      description: '환매 중단 지속일 집계',
      effects: [fundFx.countGateTurn()],
    },
  ],
  eachTick: [
    {
      id: 't4-flow',
      description: '3/18 환매 유입 2.3% (일중 분포 35/30/30/5)',
      effects: [
        fundFx.markToMarket(),
        fundFx.redemptionStep({ basePct: REDEMPTION_BASE[4]!, profile: PROFILE_T4 }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't4-offrun-blowout',
      atTick: 1,
      description: '온·오프더런 격차 30bp — 국채 유동성 악화',
      effects: [
        feed(
          '국채 데스크',
          '오프더런 10년물 $25M 매도에 3bp를 더 내줘야 했습니다. 사다리의 맨 윗칸도 비용이 붙기 시작했습니다.',
          'warning',
          'market',
        ),
      ],
    },
  ],
  ticker: {
    series: [
      { path: 'market.govt10yBp', mode: 'absolute', values: [102, 112, 118, 118] },
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [320, 331, 337, 337] },
      { path: 'market.creditSpreadHyBp', mode: 'absolute', values: [950, 972, 985, 985] },
      { path: 'market.volIndex', mode: 'relative', values: [69.37, 84.0, 76.45, 76.45] },
    ],
  },
  interrupts: [t4Interrupt],
  events: [
    {
      id: 't4-news-mmlf',
      kind: 'regulator',
      agency: '연방준비제도이사회',
      time: '2020-03-18 11:30',
      headline: '연준, MMF 유동성 지원기구(MMLF) 신설 — 재무부 외환안정기금 $10bn 신용보강',
      body: 'MMF가 매각한 적격 자산을 담보로 예금기관에 대출한다. 전날 신설된 CP 매입기구(CPFF)와 프라이머리딜러 신용기구(PDCF)에 이은 세 번째 유동성 창구다. 기관 프라임 MMF에서는 3월 초부터 대규모 환매가 이어지고 있다.',
      tone: 'urgent',
      severity: 'critical',
      atTick: 1,
      sourceRefs: [S.mmlf, S.cpff, S.pdcf, S.mmfReform],
    },
    {
      id: 't4-news-treasury',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '15:40',
      headline: '10년 국채 수익률 1.18% — 주식과 국채가 함께 팔리다',
      body: '네 번째 서킷브레이커가 발동된 날, 국채 수익률은 오히려 올랐다. 레버리지 투자자의 현·선물 베이시스 포지션 축소와 현금 수요가 겹치며 안전자산까지 매도 대상이 되었다. 온·오프더런 격차는 30bp까지 벌어졌다.',
      severity: 'critical',
      atTick: 2,
      sourceRefs: [S.h15, S.bis, S.ofr],
      relatedMetrics: ['market.treasuryOffRunBp'],
    },
    {
      id: 't4-data-ladder',
      kind: 'data',
      time: '14:05',
      title: '환매 주문 마감 직전 집계',
      rows: [
        { label: '오늘 접수 환매(누적)', value: '{{metric:redemptionsPendingPct}}' },
        { label: '현금·1일 유동성', value: '{{metric:cashBufferPct}}' },
        { label: '1주 유동성', value: '{{metric:weeklyLiquidityPct}}' },
        { label: '비유동 비중', value: '{{metric:illiquidSharePct}}' },
        { label: '기준가 지수', value: '{{metric:navIndex}}' },
        { label: 'IG 왕복 거래비용', value: '95bp / 블록 150bp+' },
      ],
      severity: 'critical',
      atTick: 2,
      sourceRefs: [S.ohara],
      relatedMetrics: ['cashBufferPct', 'illiquidSharePct', 'navIndex'],
    },
    {
      id: 't4-memo-margin',
      kind: 'memo',
      time: '10:20',
      from: '리스크관리본부',
      to: '포트폴리오매니저',
      subject: '시장 전반의 증거금 압력',
      body: `- 중앙청산소 개시증거금이 올해 1분기 들어 크게 올랐고(분기 중 약 +$300bn, +40%), 3월 9일 하루 변동증거금만 약 $140bn이 오갔습니다.
- 헤지펀드의 국채 현·선물 베이시스 포지션(2월 말 약 $664bn 추정)이 축소되며 국채 시장에 매도 물량이 나오고 있습니다.
- 우리 펀드는 파생 포지션이 없어 직접 증거금 부담은 없지만, 모두가 같은 날 현금을 필요로 한다는 것이 오늘의 조건입니다.`,
      severity: 'warning',
      atTick: 0,
      sourceRefs: [S.margin, S.ofr, S.bis],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '오늘의 조달 계획 (14:00 주문 마감 전 확정)',
      prompt:
        '오늘 접수될 환매를 어디에서 조달하시겠습니까? 14:00 주문 마감까지 확정해야 합니다. (최대 2개 · A는 단독)',
      context:
        '국채마저 비용이 붙는 날입니다. 14:00을 넘기면 데스크가 기본 계획(국채 추가 매도)으로 집행합니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t4-d1-a', 't4-d1-b'],
        ['t4-d1-a', 't4-d1-c'],
        ['t4-d1-a', 't4-d1-d'],
        ['t4-d1-a', 't4-d1-e'],
      ],
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't4-d1-a',
      timeLimitSec: 180,
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't4-d1-a',
          label: '국채를 더 판다 — 오늘도 사다리 위칸부터',
          description:
            '남은 국채·현금으로 오늘 환매를 충당한다. 오프더런 격차가 벌어져 비용이 붙지만 여전히 회사채보다 싸다. 실행가능성: 국채는 당일 결제.',
          effects: [fundFx.setSlicing({ policy: 'horizontal' }), counter('soldTreasuriesAgain', 1)],
          expert: {
            rating: 38,
            rationale:
              '이날은 국채조차 팔리지 않던 날이다. 그럼에도 회사채보다 싸다는 것은 사실이고, 다수 펀드가 같은 판단을 했다. 문제는 이 선택이 3월 20일의 선택지를 없앤다는 것이다.',
            historicalNote:
              '3월 18일 국채 매도는 시장 전체에서 관측되었고, 그것이 국채 수익률 상승의 한 원인이었다.',
            sourceRefs: [S.maxz, S.bis],
          },
          consequences: '국채로 충당했습니다. 현금·1주 유동성 비중이 다시 내려갔습니다.',
          historical: true,
          feasibility: { basis: '국채 당일 체결·결제', sourceRefs: [S.h15] },
        },
        {
          id: 't4-d1-b',
          label: '현물 바스켓 $600M 설정 — 처분 한도 우회',
          description:
            '월간·비유동 구간에서 $600M을 AP에 인도해 ETF 지분으로 바꾼 뒤 매도한다. 비용은 할인폭 3.1% + 수수료. 실행가능성: AP 계약 기체결, 당일 설정 가능.',
          effects: [fundFx.sellViaEtfCreation({ amount: 600, feeBp: 25 })],
          expert: {
            rating: 82,
            rationale:
              '딜러가 대차대조표를 닫은 날 비유동 구간을 실제로 줄일 수 있는 경로다. 3월 18일의 ETF 할인폭(−3.1%)은 3월 12일(−5.02%)보다 좁았고 블록 호가(150bp+)와 견줄 만했다.',
            sourceRefs: [S.etfPrimary, S.fimsac, S.ohara],
          },
          consequences:
            '$600M 바스켓이 설정·매도되었습니다. 현금 구간이 채워지고 비유동 비중이 내려갔습니다.',
          feasibility: { basis: 'AP 현물 설정 계약', sourceRefs: [S.etfPrimary] },
        },
        {
          id: 't4-d1-c',
          label: '크레딧라인 잔여 전액 인출',
          description:
            '약정 한도의 남은 금액을 전부 인출해 오늘의 매도를 최소화한다. 실행가능성: 은행단 공동약정, 배분 조항 적용.',
          effects: [
            fundFx.drawCreditLine({ amount: 800 }),
            flag('line_maxed'),
            confidence(-3, '라인 최대 인출'),
          ],
          expert: {
            rating: 50,
            rationale:
              '오늘의 파이어세일은 피할 수 있다. 그러나 3~4월 기업 리볼버 인출 $284bn으로 은행 대차대조표가 압박받던 시기이고, 라인을 다 쓰면 다음 주의 선택지가 사라진다. 인출 사실은 분기 보고와 시장 소문으로 알려진다.',
            sourceRefs: [S.fsr, S.fsb],
          },
          consequences: '라인을 전액 인출했습니다. 현금 구간이 채워졌지만 여력은 0이 되었습니다.',
          feasibility: { basis: '약정 한도 내 당일 인출', sourceRefs: [S.fsr] },
        },
        {
          id: 't4-d1-d',
          label: '비례 매도 유지 + 스윙폭을 실제 비용(95bp)에 맞춤',
          description:
            '구간 비중을 지키며 조달하고, 오른 거래비용을 그대로 환매자에게 전가한다. 실행가능성: 사전 결의가 있으면 당일, 없으면 익영업일 적용.',
          effects: [
            fundFx.setSlicing({ policy: 'vertical' }),
            fundFx.applySwing({ bp: 95 }),
            fundFx.redeemAmp({ factor: 0.9, reason: '스윙폭 현실화' }),
          ],
          expert: {
            rating: 87,
            rationale:
              '오늘의 조달 비용이 95bp라면 오늘 나가는 사람이 95bp를 내는 것이 FSB 권고의 원칙이다. 그렇게 하면 희석이 멈추고 선착순 동기도 사라진다. 비례 유지는 남는 포트폴리오의 질을 지킨다.',
            sourceRefs: [S.fsbOef, S.maxz],
          },
          consequences:
            '비례 매도로 조달하고 스윙 95bp를 반영했습니다. 오늘의 비용은 환매자가 부담했습니다.',
          feasibility: { basis: '스윙 당일 적용은 사전 결의 시에만', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't4-d1-e',
          label: '비유동 블록을 오늘 안에 전부 처분',
          description:
            'HY·오프벤치마크를 블록으로 던져 한 번에 정리한다. 실행가능성: 블록 호가는 150bp 이상이며 당일 처분 한도가 여전히 적용된다.',
          effects: [
            fundFx.setSlicing({ policy: 'illiquidFirst' }),
            confidence(-4, '대량 블록 매도 노출'),
            counter('blockDump', 1),
          ],
          expert: {
            rating: 20,
            rationale:
              '이날 블록 거래비용은 평시 24bp에서 150bp 이상으로 올라 있었다. 처분 한도 때문에 필요한 금액도 만들지 못하면서 실현 손실만 확정한다. 사후평가가 "파이어세일"이라고 부르는 바로 그 행동이다.',
            sourceRefs: [S.ohara, S.fsb],
          },
          consequences:
            '블록을 던졌지만 한도에 막혀 일부만 체결되었고, 체결분의 손실이 기준가에 즉시 반영되었습니다.',
          feasibility: { basis: '비유동 당일 처분 한도 적용', sourceRefs: [S.ohara] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '14:00(틱 3번째)이 환매 주문 마감입니다. 그때까지 확정하지 않으면 데스크가 기본 계획으로 집행합니다.',
    },
    {
      level: 2,
      decisionId: 't4-d1',
      text: '오늘은 국채도 비용이 붙습니다. "가장 싼 칸"이 어제와 같다고 가정하지 마십시오.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: 'D(비례 + 스윙 현실화)는 희석을 멈추고 포트폴리오를 지킵니다. B(현물 바스켓)는 처분 한도를 우회하는 유일한 경로입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2020-03-20 (금) "게이트를 열 것인가"
// ---------------------------------------------------------------------------------------------
/**
 * T5 최대 보유자 투자위원회와의 다단계 협상.
 *
 * 발언은 개연성 있는 재구성이며 실제 녹취가 아니다.
 * "남는 수익자의 포트폴리오 질을 지키겠다"는 약속은 `promised_fair_slicing` 플래그로 기록되고,
 * 그 약속이 지켜졌는지는 **2영업일 뒤(3/24)** 비유동 비중으로 판정된다 — 공정성의 결과는
 * 같은 턴이 아니라 나중에 드러난다.
 */
const holderDialogue: DialogueStep<AssetManagerState>[] = [
  {
    id: 'h-open',
    lines: [
      {
        speaker: '주정부 연금 CIO',
        text: '위원회가 지금 전액 환매를 논의하고 있습니다. 우리가 나가면 어떻게 됩니까?',
      },
    ],
    note: '여기서 하는 약속은 이후 포트폴리오 구성으로 검증됩니다.',
    replies: [
      {
        id: 'h-open-numbers',
        label: '오늘의 조달 비용과 적용 중인 스윙폭을 그대로 말한다',
        next: 'h-portfolio',
        expert: {
          rating: 84,
          rationale:
            '검증 가능한 수치는 위원회가 스스로 계산하게 만든다. 그것이 가장 빠른 진정제다.',
        },
      },
      {
        id: 'h-open-hedge',
        label: '지금은 말씀드리기 어렵고 오후에 서면으로 회신하겠다',
        resolvesTo: 't5-i1-c',
        expert: {
          rating: 24,
          rationale: '가장 큰 보유자에게 답하지 않으면 위원회는 최악을 가정한다.',
        },
      },
      {
        id: 'h-open-threat',
        label: '"전액 환매가 들어오면 게이트를 검토할 수밖에 없다"고 말한다',
        resolvesTo: 't5-i1-d',
        expert: {
          rating: 8,
          rationale:
            '게이트의 가능성 자체가 선제 환매를 부른다. SEC가 2023년에 임의 게이트를 폐지한 근거가 이것이다.',
        },
        trap: true,
        trapExplanation:
          '협상 카드로 보이지만 실제로는 방아쇠다. 한 시간 안에 다른 보유자들에게 전달되고, 그들은 게이트가 걸리기 전에 나가려 한다.',
      },
    ],
  },
  {
    id: 'h-portfolio',
    lines: [
      {
        speaker: '주정부 연금 CIO',
        text: '우리가 나가면 남는 분들 포트폴리오는 어떻게 됩니까? 팔기 좋은 것만 팔아서 주시는 건 아니죠?',
      },
    ],
    replies: [
      {
        id: 'h-pf-vertical',
        label: '비례로 매도하고 있어 구간 비중은 유지된다고 답한다',
        when: { flag: 'slicingPolicy', is: 'vertical' },
        next: 'h-size',
        expert: {
          rating: 86,
          rationale:
            '사실이면 이것이 최선의 답이다. 비례 매도는 남는 수익자에게 열화된 포트폴리오를 넘기지 않는다.',
        },
      },
      {
        id: 'h-pf-liquid',
        label: '현금·국채부터 쓰고 있다고 사실대로 답한다',
        when: { not: { flag: 'slicingPolicy', is: 'vertical' } },
        next: 'h-size',
        expert: {
          rating: 44,
          rationale:
            '정직하지만 위원회가 듣기에는 "지금 나가는 것이 유리하다"는 말이다. 선착순 우위를 스스로 확인해 준다.',
        },
        trap: true,
        trapExplanation:
          '사실을 말한 것이 문제가 아니라, 말할 수밖에 없는 상태를 만든 것이 문제다. 수평 슬라이싱은 이 대화에서 값을 치른다.',
      },
      {
        id: 'h-pf-commit',
        label: '남는 수익자의 포트폴리오 질을 지키겠다고 약속한다',
        setFlags: { promised_fair_slicing: true },
        next: 'h-size',
        expert: {
          rating: 66,
          rationale:
            '약속 자체는 옳은 방향이지만, 매도 순서를 바꾸지 않으면 3월 24일의 비유동 비중이 그 약속을 반박한다.',
        },
      },
    ],
  },
  {
    id: 'h-size',
    lines: [
      {
        speaker: '주정부 연금 CIO',
        text: '위원회는 오늘 얼마를 받을 수 있는지 알고 싶어 합니다.',
      },
    ],
    replies: [
      {
        id: 'h-size-full',
        label: '오늘 전액 현금으로 지급 가능하다고 답한다',
        resolvesTo: 't5-i1-a',
        expert: {
          rating: 74,
          rationale: '지급 능력을 확인해 주는 것은 옳다. 다만 그 현금이 어디서 나오는지가 남는다.',
        },
      },
      {
        id: 'h-size-inkind',
        label: '대량 환매는 현물(채권 바스켓) 지급을 제안한다',
        resolvesTo: 't5-i1-b',
        expert: {
          rating: 84,
          rationale:
            '펀드가 팔지 않으므로 시장 충격이 없고, 남는 수익자의 구성도 그대로다. FSB가 대량 환매의 공정한 처리 수단으로 명시한 방법이다.',
        },
      },
      {
        id: 'h-size-partial',
        label: '분할 환매를 제안하고 오늘은 일부만 지급한다',
        resolvesTo: 't5-i1-a',
        expert: {
          rating: 70,
          rationale: '흐름을 예측 가능하게 만들지만 나머지 물량이 언제 올지는 여전히 모른다.',
        },
      },
    ],
  },
]

const t5Interrupt: Interrupt<AssetManagerState> = {
  id: 't5-i1',
  interrupt: true,
  atTick: 1,
  deadlineTick: 1,
  timeoutSec: 40,
  defaultOptionId: 't5-i1-c',
  scoreWeight: 0.5,
  required: false,
  title: '최대 보유자 투자위원회',
  prompt: '주정부 연금(NAV의 11%) 투자위원회가 회의 중 전화를 걸어왔습니다. 어떻게 답하시겠습니까?',
  source: { kind: 'call', caller: '주정부 연금 CIO', agency: '기관 투자자', tone: 'urgent' },
  lines: [
    {
      speaker: '주정부 연금 CIO',
      text: '위원회가 지금 전액 환매를 논의하고 있습니다. 우리가 나가면 어떻게 됩니까?',
    },
    { speaker: '포트폴리오매니저', text: '…' },
  ],
  dimensions: ['communication', 'liquidity'],
  steps: holderDialogue,
  options: [
    {
      id: 't5-i1-a',
      label: '적용 중인 스윙폭과 조달 비용을 수치로 설명',
      description:
        '오늘의 실제 조달 비용과 스윙폭, 남은 유동성 사다리를 그대로 말한다. 나가는 비용을 본인이 낸다는 사실을 포함한다.',
      effects: [
        confidence(5, '수치 기반 설명'),
        fundFx.redeemAmp({ factor: 0.92, reason: '최대 보유자 안정' }),
        counter('holderStraightAnswer', 1),
      ],
      delayedEffects: [
        {
          afterTurns: 2,
          when: {
            all: [{ flag: 'promised_fair_slicing' }, { metric: 'illiquidSharePct', gte: 36 }],
          },
          description:
            '남는 수익자의 포트폴리오 질을 약속했으나 3/24 비유동 비중이 오히려 올라감 → 최대 보유자 신뢰 하락',
          effects: [
            confidence(-8, '약속과 다른 잔존 포트폴리오'),
            fundFx.redeemAmp({ factor: 1.08, reason: '공정성 약속 미이행' }),
          ],
        },
      ],
      expert: {
        rating: 86,
        rationale:
          'FSB 권고의 핵심은 "나가는 비용을 나가는 사람이 안다"는 것이다. 스윙이 적용 중이라면 그 사실 자체가 가장 설득력 있는 답이며, 동시에 남는 투자자에 대한 공정성도 설명된다.',
        sourceRefs: [S.fsbOef, S.esma],
      },
      consequences: '위원회가 전액 환매 안건을 보류하고 분할 환매를 검토하기로 했습니다.',
    },
    {
      id: 't5-i1-b',
      label: '현물(in-kind) 환매로 처리하자고 제안',
      description:
        '대량 환매를 현금이 아니라 채권 바스켓으로 지급하는 방안을 제안한다. 시장에 물량이 나가지 않는다.',
      effects: [
        flag('inkind_offered'),
        fundFx.redeemAmp({ factor: 0.88, reason: '현물 환매 협의' }),
        counter('inkindProposed', 1),
      ],
      delayedEffects: [
        {
          afterTurns: 2,
          when: {
            all: [{ flag: 'promised_fair_slicing' }, { metric: 'illiquidSharePct', gte: 36 }],
          },
          description:
            '남는 수익자의 포트폴리오 질을 약속했으나 3/24 비유동 비중이 오히려 올라감 → 최대 보유자 신뢰 하락',
          effects: [
            confidence(-8, '약속과 다른 잔존 포트폴리오'),
            fundFx.redeemAmp({ factor: 1.08, reason: '공정성 약속 미이행' }),
          ],
        },
      ],
      expert: {
        rating: 82,
        rationale:
          '대형 기관 환매를 현물로 처리하면 펀드는 매도하지 않고, 남는 투자자의 포트폴리오도 비례로 줄어 공정하다. 상대가 채권을 받을 수 있는 기관이어야 하고 정관·세무 처리가 필요하다는 제약이 있다.',
        sourceRefs: [S.fsbOef, S.esma],
      },
      consequences:
        '연금 측이 현물 수령 가능성을 내부 검토하겠다고 했습니다. 즉시 확답은 없었습니다.',
    },
    {
      id: 't5-i1-c',
      label: '확답을 피하고 서면 회신을 약속',
      description: '지금은 수치를 말하지 않고 오후에 자료로 회신하겠다고 한다.',
      effects: [
        confidence(-6, '최대 보유자에게 무응답'),
        fundFx.redeemAmp({ factor: 1.15, reason: '정보 공백' }),
        counter('holderDeflected', 1),
      ],
      expert: {
        rating: 24,
        rationale:
          '가장 큰 보유자에게 답하지 않으면 위원회는 최악을 가정한다. 개방형 펀드의 선착순 우위는 정보 공백에서 가장 강하게 작동한다.',
        sourceRefs: [S.fsb, S.fsbOef],
      },
      consequences: '위원회는 답을 얻지 못한 채 회의를 이어갔습니다. 오후 접수가 늘었습니다.',
      historical: true,
    },
    {
      id: 't5-i1-d',
      label: '환매 중단 가능성을 시사',
      description: '"전액 환매가 들어오면 게이트를 검토할 수밖에 없다"고 말한다.',
      effects: [
        confidence(-12, '게이트 시사'),
        fundFx.redeemAmp({ factor: 1.35, reason: '게이트 시사 → 선제 환매' }),
        regulator({ add: 1 }, '게이트 시사 발언'),
      ],
      expert: {
        rating: 8,
        rationale:
          'SEC가 2023년 개혁에서 MMF의 임의 게이트를 폐지한 이유가 이것이다 — 게이트의 가능성 자체가 선제 환매를 부른다. 2020년 3월 기관 프라임 MMF에서 30% 주간유동자산 임계 접근이 런을 가속했다는 분석이 그 근거다.',
        sourceRefs: [S.mmfReform, S.fsb],
      },
      consequences:
        '한 시간 뒤 다른 두 기관 보유자로부터 환매가 접수되었습니다. 발언이 전달된 것으로 보입니다.',
    },
  ],
}

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2020년 3월 20일 (금) 08:30~16:00 ET',
  title: '게이트를 열 것인가',
  time: '2020-03-20T08:30:00-04:00',
  ticks: 4,
  tickLabels: [
    '08:30 프리마켓',
    '11:00 블록 매도 시도',
    '14:00 환매 주문 마감',
    '16:00 밸류에이션 포인트',
  ],
  entryEffects: [
    {
      id: 't5-open',
      description: '3/20: 주간 유출 정점. IG 355 → 373bp. 유럽 일부 펀드 환매 중단 보도',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 37,
          govt10yBp: 112,
          govt30yBp: 155,
          igBp: 355,
          hyBp: 1015,
          volIndex: 67.86,
          equityIndex: 78.02,
          fundingStressBp: 80,
          bidAskIgBp: 90,
          etfDiscountPct: -2.4,
          treasuryOffRunBp: 22,
          label: '3/20 개장 시세',
        }),
        confidence(-5, '주간 유출 정점'),
      ],
    },
    { id: 't5-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
    {
      id: 't5-gate-count',
      description: '환매 중단 지속일 집계',
      effects: [fundFx.countGateTurn()],
    },
    {
      id: 't5-line-disclosed',
      when: { path: 'institution.custom.creditLineDrawn', gte: 400 },
      description: '크레딧라인 대규모 인출이 시장에 알려짐',
      effects: [
        confidence(-6, '라인 인출 노출'),
        fundFx.redeemAmp({ factor: 1.12, reason: '차입 사실 노출' }),
        feed(
          '시장 소문',
          '"대형 크레딧펀드가 은행 라인을 크게 인출했다"는 이야기가 브로커 채팅에 돌고 있습니다.',
          'warning',
          'press',
        ),
      ],
    },
  ],
  eachTick: [
    {
      id: 't5-flow',
      description: '3/20 환매 유입 2.1% (일중 분포 30/25/40/5)',
      effects: [
        fundFx.markToMarket(),
        fundFx.redemptionStep({ basePct: REDEMPTION_BASE[5]!, profile: PROFILE_T5 }),
      ],
    },
  ],
  ticker: {
    series: [
      { path: 'market.govt10yBp', mode: 'absolute', values: [112, 100, 92, 92] },
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [355, 368, 373, 373] },
      { path: 'market.creditSpreadHyBp', mode: 'absolute', values: [1015, 1032, 1040, 1040] },
      { path: 'market.volIndex', mode: 'relative', values: [67.86, 69.51, 66.04, 66.04] },
    ],
  },
  interrupts: [t5Interrupt],
  events: [
    {
      id: 't5-news-swap',
      kind: 'regulator',
      agency: '연방준비제도이사회',
      time: '2020-03-19 09:00',
      headline: '연준, 9개 중앙은행과 임시 달러 통화스와프 — 한국은행 등 6곳 각 $600억',
      body: '한국·호주·브라질·멕시코·싱가포르·스웨덴 각 600억 달러, 덴마크·노르웨이·뉴질랜드 각 300억 달러 규모다. 달러 조달 압력이 미국 밖으로 번진 데 대한 대응이다.',
      tone: 'urgent',
      severity: 'warning',
      atTick: 0,
      sourceRefs: [S.swap],
    },
    {
      id: 't5-news-europe',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '09:50',
      headline: '유럽 일부 채권·부동산 펀드 환매 중단 — 평가 불가를 사유로',
      body: '유럽 여러 나라에서 개방형 펀드의 환매가 중단되었다. 사유는 대부분 "기초자산의 신뢰할 수 있는 평가가 불가능하다"는 것이다. 감독당국은 유동성 관리도구의 사용 현황을 점검 중이라고 밝혔다.',
      severity: 'critical',
      atTick: 1,
      sourceRefs: [S.esma, S.fsb],
    },
    {
      id: 't5-data-week',
      kind: 'data',
      time: '14:10',
      title: '주간 집계 (3/16~3/20)',
      rows: [
        { label: '누적 환매(기준일 NAV 대비)', value: '{{metric:redemptionsCumulativePct}}' },
        { label: '현금·1일 유동성', value: '{{metric:cashBufferPct}}' },
        { label: '비유동 비중', value: '{{metric:illiquidSharePct}}' },
        { label: '누적 희석', value: '{{metric:dilutionBp}}bp' },
        { label: '기준가 지수', value: '{{metric:navIndex}}' },
        { label: '업계 참고: 3월 채권 뮤추얼펀드 순유출', value: '$250bn 초과(운용자산의 약 5%)' },
      ],
      severity: 'critical',
      atTick: 2,
      sourceRefs: [S.ici, S.falato],
      relatedMetrics: ['redemptionsCumulativePct', 'cashBufferPct', 'illiquidSharePct'],
    },
    {
      id: 't5-memo-counsel',
      kind: 'memo',
      time: '10:40',
      from: '법무·컴플라이언스',
      to: '포트폴리오매니저 · 이사회',
      subject: '환매 관련 도구의 법적 요건',
      body: `- **환매 중단(suspension)**: 1940년법상 SEC의 명령 또는 극히 제한된 사유가 필요합니다. 개방형 펀드가 스스로 중단하는 것은 매우 예외적이며 감독당국 보고 대상입니다.
- **지급 연기**: 정관상 환매 대금 지급은 접수 후 7일 이내입니다. 그 범위 안에서 T+3까지 늦추는 것은 가능하나 사유를 기록해야 합니다.
- **현물(in-kind) 환매**: 정관상 허용되며 대량 환매에 실제로 쓰입니다. 잔존 투자자에게 비례적으로 공정해야 합니다.
- **스윙프라이싱**: 이사회 결의와 회계·중개 처리가 전제입니다.`,
      severity: 'warning',
      atTick: 0,
      sourceRefs: [S.mmfReform, S.fsbOef, S.esma],
    },
  ],
  decisions: [
    {
      id: 't5-d2',
      title: '도구 재설정',
      prompt: '오늘 쓸 도구를 다시 맞추십시오. (최대 2개)',
      context: '스윙폭·크레딧라인·발행시장 경로 중 무엇을 오늘 쓰겠습니까.',
      select: { min: 1, max: 2 },
      exclusive: [['t5-d2-a', 't5-d2-b']],
      dimensions: ['liquidity', 'marketRisk'],
      options: [
        {
          id: 't5-d2-a',
          label: '현행 유지 — 도구를 바꾸지 않는다',
          description: '오늘의 조달을 기존 정책대로 진행한다. 실행가능성: 항상 가능.',
          effects: [counter('toolsUnchanged', 1)],
          expert: {
            rating: 34,
            rationale:
              '거래비용이 90bp인 날에 도구를 그대로 두면 그 비용은 전부 남는 투자자가 낸다. 3월 20일은 주간 유출이 정점을 찍던 날이었다.',
            historicalNote: '다수 펀드가 도구 없이 이 주를 통과했다.',
            sourceRefs: [S.falato, S.fsbOef],
          },
          consequences: '기존 정책대로 조달했습니다. 누적 희석이 늘었습니다.',
          historical: true,
          feasibility: { basis: '기본 상태', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't5-d2-b',
          label: '스윙폭을 실제 조달 비용(90bp)으로 재설정',
          description:
            '오늘 실제 비용에 맞춰 스윙폭을 다시 정한다. 실행가능성: 사전 결의가 있으면 당일, 없으면 익영업일.',
          effects: [
            fundFx.applySwing({ bp: 90 }),
            fundFx.redeemAmp({ factor: 0.9, reason: '스윙폭 현실화' }),
          ],
          expert: {
            rating: 86,
            rationale:
              '스윙폭은 추정된 실제 거래비용에 연동되어야 한다는 것이 FSB 2023 권고와 SEC 2023 MMF 개혁의 공통 설계다. 비용이 오른 날 폭을 올리지 않으면 희석방지도구로 작동하지 않는다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences: '스윙폭이 90bp로 조정되었습니다. 오늘의 조달 비용이 환매자에게 전가됩니다.',
          feasibility: { basis: '사전 결의 시 당일 적용', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't5-d2-c',
          label: '현물 바스켓 $500M 추가 설정',
          description:
            '비유동·월간 구간을 다시 줄여 현금 구간을 채운다. 실행가능성: AP 계약 기체결.',
          effects: [fundFx.sellViaEtfCreation({ amount: 500, feeBp: 25 })],
          expert: {
            rating: 78,
            rationale:
              '3월 20일 ETF 할인폭(−2.4%)은 3월 12일보다 좁았고, 발행시장 경로는 여전히 열려 있었다. 비유동 비중을 낮추는 것이 다음 주의 선택지를 만든다.',
            sourceRefs: [S.etfPrimary, S.fimsac],
          },
          consequences: '$500M 바스켓을 설정·매도했습니다. 비유동 비중이 내려갔습니다.',
          feasibility: { basis: 'AP 현물 설정 계약', sourceRefs: [S.etfPrimary] },
        },
        {
          id: 't5-d2-d',
          label: '크레딧라인 잔여분 인출',
          description: '남은 약정 한도를 인출해 현금 구간을 보강한다. 실행가능성: 당일 인출.',
          effects: [fundFx.drawCreditLine({ amount: 400 })],
          expert: {
            rating: 52,
            rationale:
              '오늘의 매도를 줄이는 정당한 수단이나 부채이며, 인출 규모가 커지면 시장에 알려져 오히려 환매를 부른다. 연준 보고서가 기록한 이 시기 은행 여신 압박도 고려해야 한다.',
            sourceRefs: [S.fsr],
          },
          consequences: '잔여 한도를 인출했습니다. 차입 잔액이 늘었습니다.',
          feasibility: { basis: '약정 한도 내 인출', sourceRefs: [S.fsr] },
        },
      ],
    },
    {
      id: 't5-d1',
      title: '환매를 계속 지급할 것인가 (14:00 마감)',
      prompt:
        '오늘 접수되는 환매를 어떻게 처리하시겠습니까? 14:00 주문 마감까지 확정해야 합니다. (1개)',
      context:
        '유럽에서는 이미 환매를 중단한 펀드가 나왔습니다. 게이트는 오늘의 매도를 멈추지만, 되돌릴 수 없는 평판·감독 결과를 남깁니다.',
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't5-d1-a',
      timeLimitSec: 150,
      dimensions: ['liquidity', 'compliance', 'communication'],
      options: [
        {
          id: 't5-d1-a',
          label: '전액 지급을 계속한다',
          description:
            '도구(스윙·현물 바스켓·라인)를 쓰되 환매는 정상 지급한다. 실행가능성: 처분 한도 안에서 지급 가능한 동안 유지된다.',
          effects: [counter('keptPaying', 1), confidence(2, '정상 지급 유지')],
          expert: {
            rating: 70,
            rationale:
              '미국 회사채 펀드는 3월 내내 환매를 계속 지급했고 게이트를 건 곳은 사실상 없었다. 결과적으로 옳았지만, 그것은 3월 23일 연준의 개입이 있었기 때문이기도 하다 — 도구 없이 지급만 계속하면 비용은 전부 남는 투자자에게 간다.',
            historicalNote:
              '미국 등록 회사채 펀드 중 3월에 환매를 중단한 곳은 거의 없었다. 유럽에서는 여러 건이 있었다.',
            sourceRefs: [S.fsb, S.esma, S.falato],
          },
          consequences: '정상 지급을 유지했습니다. 보유자에게 그 사실을 공지했습니다.',
          historical: true,
          feasibility: { basis: '처분 한도 내 지급 가능', sourceRefs: [S.fsb] },
        },
        {
          id: 't5-d1-b',
          label: '대량 환매를 현물(in-kind) 환매로 전환 협의',
          description:
            '기관 보유자의 대량 환매를 채권 바스켓으로 지급하는 방안을 정관에 따라 제안한다. 시장에 물량이 나가지 않고 잔존 투자자에게 비례적으로 공정하다. 실행가능성: 정관상 허용, 상대 기관의 수령 능력이 전제.',
          effects: [
            flag('inkind_redemption'),
            fundFx.redeemAmp({ factor: 0.85, reason: '현물 환매 전환' }),
            confidence(3, '공정한 대량 환매 처리'),
          ],
          expert: {
            rating: 86,
            rationale:
              'FSB의 개방형 펀드 권고는 현물 환매를 대량 환매의 공정한 처리 수단으로 명시한다. 펀드가 팔지 않으므로 시장 충격도 없고, 남는 투자자의 포트폴리오 구성도 그대로 유지된다.',
            sourceRefs: [S.fsbOef, S.esma],
          },
          consequences: '두 기관 보유자가 현물 수령에 동의했습니다. 그만큼의 매도가 사라졌습니다.',
          feasibility: { basis: '정관상 현물 환매 조항', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't5-d1-c',
          label: '환매 대금 지급을 T+3으로 연기',
          description:
            '정관상 7일 이내 지급 범위에서 결제를 늦춰 조달 시간을 번다. 실행가능성: 정관 범위 내, 사유 기록 필요.',
          effects: [
            counter('settlementDelayed', 1),
            confidence(-5, '지급 지연 인지'),
            regulator({ add: 1 }, '지급 연기 보고'),
            fundFx.redeemAmp({ factor: 1.1, reason: '지급 지연이 신호로 읽힘' }),
          ],
          expert: {
            rating: 42,
            rationale:
              '합법적이고 때로 유용하지만, 지급이 늦어지는 것은 시장에 즉시 알려지고 "다음은 게이트"라는 추정을 부른다. 도구를 쓰지 않은 채 시간만 버는 선택이다.',
            sourceRefs: [S.esma, S.fsb],
          },
          consequences:
            'T+3 지급으로 전환했습니다. 플랫폼 두 곳이 사유를 문의했고 접수는 오히려 늘었습니다.',
          feasibility: { basis: '정관상 7일 이내 지급', sourceRefs: [S.esma] },
        },
        {
          id: 't5-d1-d',
          label: '환매를 중단한다 (게이트)',
          description:
            '평가 불가와 유동성 부족을 사유로 환매를 중단한다. 매도 압력이 즉시 사라진다. 실행가능성: 1940년법상 매우 예외적이며 감독당국 보고 대상.',
          effects: [fundFx.gate({ voluntary: true, reason: '자발적 환매 중단' })],
          expert: {
            rating: 14,
            rationale:
              '오늘의 파이어세일은 멈추지만 되돌릴 수 없다. SEC는 2023년 MMF 개혁에서 임의 게이트를 아예 폐지했는데, 그 근거가 게이트의 존재 자체가 선제 환매를 유발한다는 2020년 3월의 경험이다. 미국 회사채 펀드 중 실제로 중단한 곳은 사실상 없었다.',
            sourceRefs: [S.mmfReform, S.fsb],
          },
          consequences:
            '환매를 중단했습니다. 감독당국이 즉시 보고를 요구했고, 보유자 공지가 나갔습니다. 매도 압력은 사라졌습니다.',
          irreversible: true,
          feasibility: {
            basis: '1940년법상 예외적 절차, 감독당국 보고',
            sourceRefs: [S.mmfReform],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '"현금·1일 유동성 비중"이 0에 가까우면 게이트는 선택이 아니라 결과가 됩니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '게이트는 유동성 문제를 평판·감독 문제로 바꿉니다. 현물 환매는 같은 매도 감축 효과를 되돌릴 수 있는 형태로 얻습니다.',
    },
    {
      level: 3,
      decisionId: 't5-d2',
      text: '스윙폭을 오늘의 실제 비용(90bp)에 맞추면 희석이 멈추고 접수도 줄어듭니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2020-03-23 (월) "연준이 회사채를 산다"
// ---------------------------------------------------------------------------------------------
const t6Interrupt: Interrupt<AssetManagerState> = {
  id: 't6-i1',
  interrupt: true,
  atTick: 1,
  deadlineTick: 1,
  timeoutSec: 45,
  defaultOptionId: 't6-i1-b',
  scoreWeight: 0.5,
  required: false,
  title: '이사회 의장 전화',
  prompt: '발표 직후 이사회 의장이 전화했습니다. 오늘 기준가를 어떻게 산정하시겠습니까?',
  source: { kind: 'board', caller: '펀드 이사회 의장', tone: 'urgent' },
  lines: [
    {
      speaker: '이사회 의장',
      text: '발표를 봤습니다. 오늘 스윙을 풀 겁니까? 지금 파는 사람은 오히려 손해를 보게 되는데요.',
    },
    { speaker: '포트폴리오매니저', text: '…' },
  ],
  dimensions: ['communication', 'policy'],
  options: [
    {
      id: 't6-i1-a',
      label: '밸류에이션 포인트에서 새 시장가로 재산정하겠다',
      description:
        '16:00 평가 시점에 오늘의 실제 체결·호가로 다시 계산해 스윙폭을 정한다고 답한다.',
      effects: [counter('boardStraightAnswer', 1), confidence(4, '절차대로 설명')],
      expert: {
        rating: 84,
        rationale:
          '발표 효과가 크더라도 오늘의 실제 조달 비용은 밸류에이션 포인트에서야 알 수 있다. 스윙폭을 추정 비용에 연동한다는 원칙을 그대로 적용하는 답이며, 이사회에도 절차로 설명된다.',
        sourceRefs: [S.fsbOef, S.sr935],
      },
      consequences: '의장이 동의했습니다. 16:00 평가 후 폭을 재산정하기로 했습니다.',
    },
    {
      id: 't6-i1-b',
      label: '즉시 스윙을 풀고 정상 기준가로 전환',
      description: '발표로 시장이 돌아섰으니 오늘부터 스윙을 적용하지 않는다.',
      effects: [fundFx.setSwing({ bp: 0 }), counter('swingDroppedEarly', 1)],
      expert: {
        rating: 46,
        rationale:
          '발표 효과는 컸지만(FRBNY SR 935) 3월 23일 당일의 회사채 거래비용은 여전히 70bp대였다. 비용이 남아 있는 날 스윙을 0으로 되돌리면 그날의 희석이 다시 남는 투자자에게 간다.',
        sourceRefs: [S.sr935, S.ohara],
      },
      consequences: '스윙을 해제했습니다. 오늘 환매분의 거래비용은 펀드가 부담합니다.',
    },
    {
      id: 't6-i1-c',
      label: '발표를 신뢰할 수 없으니 현 방침을 유지하겠다',
      description: '발표와 실제 매입은 다르다며 아무것도 바꾸지 않는다고 답한다.',
      effects: [counter('boardNoChange', 1), confidence(-2, '방침 미변경')],
      expert: {
        rating: 40,
        rationale:
          '신중함 자체는 근거가 있으나(실제 SMCCF 매입 개시는 5월이었다), FRBNY 분석은 발표 효과가 매입 실행보다 컸음을 보인다. 시장 조건이 바뀐 날 아무 판단도 하지 않는 것은 판단이 아니다.',
        sourceRefs: [S.sr935],
      },
      consequences: '방침을 유지했습니다. 의장은 "다음 이사회에서 다시 보겠다"고 했습니다.',
      historical: true,
    },
  ],
}

export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2020년 3월 23일 (월) 08:00~16:00 ET',
  title: '연준이 회사채를 산다',
  time: '2020-03-23T08:00:00-04:00',
  ticks: 4,
  tickLabels: ['08:00 개장 전', '09:30 발표 직후', '13:00 오후 세션', '16:00 밸류에이션 포인트'],
  entryEffects: [
    {
      id: 't6-open',
      description: '3/23 개장 전: IG 408bp로 정점. 발표 후 종가 401bp, HY 1,087bp',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 28,
          govt10yBp: 88,
          govt30yBp: 133,
          igBp: 408,
          hyBp: 1110,
          volIndex: 74.08,
          equityIndex: 75.74,
          fundingStressBp: 62,
          bidAskIgBp: 72,
          etfDiscountPct: -1.1,
          treasuryOffRunBp: 14,
          label: '3/23 개장 전 시세',
        }),
      ],
    },
    { id: 't6-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
    {
      id: 't6-gate-count',
      description: '환매 중단 지속일 집계',
      effects: [fundFx.countGateTurn()],
    },
  ],
  eachTick: [
    {
      id: 't6-flow',
      description: '3/23 환매 유입 1.2% (일중 분포 45/30/20/5)',
      effects: [
        fundFx.markToMarket(),
        fundFx.redemptionStep({ basePct: REDEMPTION_BASE[6]!, profile: PROFILE_T6 }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't6-announcement-effect',
      atTick: 1,
      description: '발표 효과: 환매 유입 둔화, 신뢰 회복',
      effects: [
        confidence(12, '연준 회사채 매입기구 발표'),
        fundFx.redeemAmp({ factor: 0.7, reason: '정책 백스톱 발표' }),
      ],
    },
  ],
  ticker: {
    series: [
      { path: 'market.govt10yBp', mode: 'absolute', values: [88, 80, 76, 76] },
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [408, 405, 401, 401] },
      { path: 'market.creditSpreadHyBp', mode: 'absolute', values: [1110, 1095, 1087, 1087] },
      { path: 'market.volIndex', mode: 'relative', values: [74.08, 66.0, 61.59, 61.59] },
    ],
  },
  interrupts: [t6Interrupt],
  events: [
    {
      id: 't6-news-facilities',
      kind: 'regulator',
      agency: '연방준비제도이사회',
      time: '08:00',
      headline:
        '연준, 회사채 매입기구 신설 — 발행시장(PMCCF)·유통시장(SMCCF)·자산유동화증권(TALF), 국채·MBS 매입 한도 철폐',
      body: 'SMCCF는 유통시장에서 투자등급 회사채와 적격 회사채 ETF를 매입한다. PMCCF는 발행시장에서 직접 인수·대출한다. 국채와 주택저당증권 매입은 "원활한 시장 기능에 필요한 만큼" 하기로 해 사실상 금액 제한이 없어졌다.',
      tone: 'urgent',
      severity: 'positive',
      atTick: 1,
      sourceRefs: [S.pr0323, S.rt0323],
    },
    {
      id: 't6-market-reaction',
      kind: 'market',
      time: '13:05',
      headline: '발표 직후 시세',
      items: [
        { label: 'IG 스프레드(OAS)', value: '405bp → 401bp', change: '개장 전 408bp에서 반전' },
        { label: 'HY 스프레드(OAS)', value: '1,087bp', change: '정점 확인' },
        { label: '회사채 ETF 괴리', value: '−1.1%', change: '3/12 −5.02%에서 축소' },
        { label: '10년 국채', value: '0.76%', change: '−16bp' },
        { label: 'VIX', value: '61.59', change: '−4.5' },
      ],
      atTick: 2,
      severity: 'positive',
      sourceRefs: [S.feds, S.etfPrimary, S.h15, S.vix],
    },
    {
      id: 't6-memo-pm',
      kind: 'memo',
      time: '13:30',
      from: '크레딧 리서치',
      to: '포트폴리오매니저',
      subject: '발표와 실행은 다르다 — 그러나 가격은 발표에 반응했다',
      body: `- SMCCF의 실제 매입은 아직 시작되지 않았고 세부 조건도 미정입니다. 적격 요건(투자등급·만기)에 따라 우리 비유동 구간의 상당 부분은 대상이 아닐 수 있습니다.
- 그럼에도 오늘 IG 호가가 돌아섰습니다. 딜러들이 다시 양방향 호가를 내기 시작했습니다.
- 우리 현금 비중은 {{metric:cashBufferPct}}, 비유동 비중은 {{metric:illiquidSharePct}}입니다. 지금이 사다리를 다시 세울 기회인지, 아직 이른지가 오늘의 질문입니다.`,
      severity: 'positive',
      atTick: 2,
      sourceRefs: [S.pr0323, S.sr935, S.ohara],
      relatedMetrics: ['cashBufferPct', 'illiquidSharePct'],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '되돌림 국면의 첫 수',
      prompt: '발표 이후 오늘 무엇을 하시겠습니까? (최대 2개 · E는 단독)',
      context:
        '호가가 돌아왔습니다. 유동성 사다리를 재건할 것인지, 벌어진 스프레드에 재진입할 것인지, 차입을 갚을 것인지 — 셋을 동시에 할 현금은 없습니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t6-d1-e', 't6-d1-a'],
        ['t6-d1-e', 't6-d1-b'],
        ['t6-d1-e', 't6-d1-c'],
        ['t6-d1-e', 't6-d1-d'],
      ],
      dimensions: ['liquidity', 'policy', 'marketRisk'],
      options: [
        {
          id: 't6-d1-a',
          label: '유동성 사다리 재건 우선 — 현금 비중 8%까지 회복',
          description:
            '호가가 돌아온 틈에 비유동·IG 구간을 줄여 현금을 다시 채운다. 거래비용이 72bp로 내려왔다. 실행가능성: 처분 한도 안에서 당일 가능.',
          effects: [fundFx.rebuildLadder({ targetDailyPct: 8 }), flag('ladder_rebuilt')],
          expert: {
            rating: 78,
            rationale:
              '백스톱이 열려 있는 동안 질서 있는 가격으로 사다리를 다시 세우는 것은 LDI 사례에서도 확인된 원칙이다. 다음 충격은 백스톱이 없을 수도 있다. 다만 재건 비용은 여전히 72bp이고 기대수익을 포기하는 값이 있다.',
            sourceRefs: [S.fsb, S.fsbOef],
          },
          consequences: '현금 비중이 8%로 회복되었습니다. 비유동 비중이 내려갔습니다.',
          historical: true,
          feasibility: { basis: '호가 회복 후 당일 처분 한도 내', sourceRefs: [S.ohara] },
        },
        {
          id: 't6-d1-b',
          label: '스윙폭을 오늘 실제 비용에 맞춰 재산정',
          description:
            '밸류에이션 포인트에서 오늘의 실제 조달 비용(약 72bp)으로 폭을 다시 정한다. 실행가능성: 사전 결의 시 당일.',
          effects: [fundFx.applySwing({ bp: 70 })],
          expert: {
            rating: 84,
            rationale:
              '스윙폭은 시장이 좋아졌다고 0으로 돌아가는 것이 아니라 그날의 추정 비용을 따라간다. FSB 권고와 SEC 개혁의 설계가 모두 그렇다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences: '스윙폭이 70bp로 조정되었습니다. 오늘 환매분의 비용이 계속 전가됩니다.',
          feasibility: { basis: '사전 결의 시 당일 적용', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't6-d1-c',
          label: '현금 $600M으로 IG 회사채 재진입',
          description:
            '401bp의 IG에 현금을 다시 투입한다. 기대수익은 높지만 사다리의 맨 윗칸이 다시 얇아진다. 실행가능성: 호가 회복으로 당일 체결 가능.',
          effects: [fundFx.reinvest({ amount: 600 }), counter('reentered', 1)],
          expert: {
            rating: 62,
            rationale:
              '결과적으로 3월 23일은 스프레드의 정점이었고 재진입은 수익을 냈다. 그러나 그것은 사후의 지식이다. 환매가 아직 들어오는 상태에서 현금을 줄이는 것은 이번 달에 이미 배운 교훈과 반대 방향이다.',
            sourceRefs: [S.feds, S.sr935],
          },
          consequences: '$600M을 IG에 재투자했습니다. 현금 비중이 다시 내려갔습니다.',
          feasibility: { basis: '양방향 호가 회복', sourceRefs: [S.ohara] },
        },
        {
          id: 't6-d1-d',
          label: '크레딧라인 상환 — 차입을 먼저 정리',
          description:
            '인출한 라인을 현금으로 갚아 다음 충격에 쓸 여력을 되살린다. 실행가능성: 잔액 범위 내 즉시 상환.',
          effects: [fundFx.repayCreditLine({ amount: 800 }), counter('lineRepaid', 1)],
          expert: {
            rating: 72,
            rationale:
              '라인은 다음 충격의 보험이고, 인출된 상태에서는 보험이 아니다. 연준 보고서가 기록한 은행 여신 압박을 감안하면 재인출이 보장되지 않는다는 점도 중요하다.',
            sourceRefs: [S.fsr],
          },
          consequences: '차입을 상환했습니다. 현금 구간이 줄었지만 라인 여력이 돌아왔습니다.',
          feasibility: { basis: '잔액 범위 내 상환', sourceRefs: [S.fsr] },
        },
        {
          id: 't6-d1-e',
          label: '관망 — 발표가 실제 매입으로 이어질 때까지 아무것도 하지 않는다',
          description: '조건도 일정도 미정인 발표에 반응하지 않는다. 실행가능성: 항상 가능.',
          effects: [counter('waitAndSee', 1)],
          expert: {
            rating: 30,
            rationale:
              'FRBNY 분석은 이 시기 스프레드 축소의 대부분이 실제 매입이 아니라 발표에서 왔음을 보인다. 시장 조건이 바뀐 날 아무것도 하지 않으면 가장 좋은 재건 가격을 놓친다 — 실제 SMCCF 매입이 시작된 5월에는 스프레드가 이미 크게 좁혀져 있었다.',
            sourceRefs: [S.sr935, S.feds],
          },
          consequences: '아무 조치도 취하지 않았습니다. 호가는 하루 종일 좋아졌습니다.',
          feasibility: { basis: '항상 가능', sourceRefs: [S.sr935] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '오늘의 IG 스프레드(401bp)와 거래비용(72bp)을 보세요. 둘 다 지난주보다 낫습니다.',
    },
    {
      level: 2,
      decisionId: 't6-d1',
      text: '백스톱이 열려 있는 동안이 재건의 시간입니다. 다음 충격에 백스톱이 있으리라는 보장은 없습니다.',
    },
    {
      level: 3,
      decisionId: 't6-d1',
      text: '사다리 재건(A)과 스윙폭 재산정(B)이 함께 가면 다음 환매에도 희석이 남지 않습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2020-03-24 (화) "되돌림"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2020년 3월 24일 (화) 16:00 ET',
  title: '되돌림',
  time: '2020-03-24T16:00:00-04:00',
  entryEffects: [
    {
      id: 't7-open',
      description: '3/24: S&P +9.4%, IG 358bp로 축소, ETF 괴리 −0.4%, 거래비용 55bp',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 38,
          govt10yBp: 84,
          govt30yBp: 139,
          igBp: 358,
          hyBp: 980,
          volIndex: 61.67,
          equityIndex: 82.84,
          fundingStressBp: 48,
          bidAskIgBp: 55,
          etfDiscountPct: -0.4,
          treasuryOffRunBp: 9,
          label: '3/24 마감 시세',
        }),
        confidence(8, '스프레드 축소·발행시장 재개'),
      ],
    },
    { id: 't7-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
    {
      id: 't7-gate-count',
      description: '환매 중단 지속일 집계',
      effects: [fundFx.countGateTurn()],
    },
  ],
  eachTick: [
    {
      id: 't7-flow',
      description: '3/24 환매 유입 0.4% — 정상화',
      effects: [fundFx.markToMarket(), fundFx.redemptionStep({ basePct: REDEMPTION_BASE[7]! })],
    },
  ],
  events: [
    {
      id: 't7-news-rally',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '16:10',
      headline: 'S&P 500 하루 9.4% 급등 — IG 스프레드 축소, 발행시장 재개',
      body: '전날 연준 발표 이후 회사채 발행이 재개되었다. 대형 발행사들이 잇따라 딜을 냈고 수요가 몰렸다. 회사채 ETF의 NAV 대비 괴리는 −0.4%로 거의 사라졌다.',
      severity: 'positive',
      sourceRefs: [S.sifma, S.etfPrimary],
    },
    {
      id: 't7-data-summary',
      kind: 'data',
      time: '16:30',
      title: '3월 전체 결산 (기준일 2/28 대비)',
      rows: [
        { label: '누적 환매(기준일 NAV 대비)', value: '{{metric:redemptionsCumulativePct}}' },
        { label: '기준가 지수', value: '{{metric:navIndex}}' },
        { label: '현금·1일 유동성', value: '{{metric:cashBufferPct}}' },
        { label: '비유동 비중', value: '{{metric:illiquidSharePct}}' },
        { label: '누적 희석(잔존 투자자 부담)', value: '{{metric:dilutionBp}}bp' },
        { label: '업계 참고: 회사채 펀드 평균 누적 유출', value: '약 10% of NAV (2월 말~3/23)' },
      ],
      severity: 'info',
      sourceRefs: [S.falato, S.ici],
      relatedMetrics: ['redemptionsCumulativePct', 'navIndex', 'dilutionBp', 'illiquidSharePct'],
    },
    {
      id: 't7-memo-board',
      kind: 'board',
      time: '17:00',
      headline: '이사회 의장 — 다음 회의 안건',
      body: '이번 달의 경험을 유동성 관리 프로그램에 어떻게 반영할지 다음 회의에서 결정합니다. 독립이사들은 "같은 일이 다시 생겼을 때 무엇이 달라지는지"를 한 장으로 보고 싶어 합니다.',
      severity: 'info',
      sourceRefs: [S.fsbOef, S.mmfReform],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '다음을 위한 유동성 정책',
      prompt: '이사회에 무엇을 제안하시겠습니까? (최대 3개 · A는 단독)',
      context:
        '이번 달에 무엇이 구속 제약이었는지는 이제 분명합니다. 다음 충격에 백스톱이 있으리라는 보장은 없습니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t7-d1-a', 't7-d1-b'],
        ['t7-d1-a', 't7-d1-c'],
        ['t7-d1-a', 't7-d1-d'],
        ['t7-d1-a', 't7-d1-e'],
      ],
      dimensions: ['compliance', 'policy', 'timeliness'],
      options: [
        {
          id: 't7-d1-a',
          label: '위기 전 구성으로 복귀 — 특별한 변경 없음',
          description:
            '시장이 정상화되었으므로 원래의 자산배분과 운영 절차로 돌아간다. 실행가능성: 항상 가능.',
          effects: [counter('noPolicyChange', 1)],
          expert: {
            rating: 30,
            rationale:
              'FSB는 2020년 3월 이후 3년에 걸쳐 개방형 펀드 권고를 개정했고, SEC는 MMF 규칙을 다시 썼다. 아무것도 바꾸지 않는 것은 그 사후평가의 결론과 정반대다.',
            historicalNote:
              '실제로는 업계 전반이 현금 비중과 유동성 관리도구 준비를 강화했고, 2023년 규제 개정으로 이어졌다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences: '기존 정책을 유지하기로 했습니다.',
          historical: true,
          feasibility: { basis: '기본 상태', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't7-d1-b',
          label: '스윙프라이싱 상시화 — 임계·폭 산정식을 이사회 정책으로',
          description:
            '순환매 임계와 스윙폭 산정식(추정 거래비용 연동)을 상시 정책으로 결의하고 회계·중개 절차를 갖춘다. 실행가능성: 이사회 결의 사항.',
          effects: [flag('policy_swing_standing'), confidence(3, '희석방지 상시화')],
          expert: {
            rating: 88,
            rationale:
              'FSB의 2023년 12월 개정 권고는 희석방지도구를 상시 준비·사용하도록 요구하고, SEC의 2023년 MMF 개혁은 임의 게이트를 폐지하고 의무 유동성 수수료를 도입했다. 두 건 모두 2020년 3월을 직접적 근거로 든다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences: '이사회가 상시 스윙프라이싱 정책을 승인했습니다.',
          feasibility: { basis: '이사회 결의 + 회계·중개 인프라', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't7-d1-c',
          label: '최소 현금 비중 10%와 비례 매도 원칙을 투자정책서에 명시',
          description:
            '현금 하한과 "환매 충당은 비례 매도를 기본으로 한다"는 원칙을 문서화한다. 실행가능성: 투자정책서 개정.',
          effects: [flag('policy_vertical_standing'), flag('policy_cash_floor')],
          expert: {
            rating: 84,
            rationale:
              'Ma·Xiao·Zeng가 보인 "유동자산 우선 매도 → 잔존 포트폴리오 열화"는 개별 판단이 아니라 기본 정책으로 막아야 한다. FSB 권고의 유동성 미스매치 항목과도 직접 대응한다.',
            sourceRefs: [S.maxz, S.fsbOef],
          },
          consequences: '투자정책서가 개정되었습니다. 현금 하한과 비례 원칙이 명문화되었습니다.',
          feasibility: { basis: '투자정책서 개정', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't7-d1-d',
          label: '대형 보유자와 현물(in-kind) 환매 표준약정 체결',
          description:
            '상위 보유자와 대량 환매 시 현물 지급 절차를 미리 약정한다. 실행가능성: 정관상 허용, 상대 기관과 개별 약정.',
          effects: [flag('policy_inkind_standing'), confidence(2, '대량 환매 절차 사전 합의')],
          expert: {
            rating: 80,
            rationale:
              '집중된 보유자의 대량 환매를 시장 충격 없이 처리하는 유일한 구조적 수단이다. 사전 약정이 없으면 위기 중에 협상해야 하고, 그때는 시간이 없다.',
            sourceRefs: [S.fsbOef, S.esma],
          },
          consequences: '상위 3개 보유자와 표준약정 초안에 합의했습니다.',
          feasibility: { basis: '정관 + 개별 약정', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't7-d1-e',
          label: '비유동 비중 상한 30%를 투자정책서에 명시',
          description:
            '유동성 미스매치의 근본을 줄인다. 기대수익이 낮아지는 비용이 명확하다. 실행가능성: 투자정책서 개정, 기존 보유분은 단계적 조정.',
          effects: [flag('policy_illiquid_cap'), counter('illiquidCapSet', 1)],
          expert: {
            rating: 76,
            rationale:
              'FSB 권고의 첫 축은 "환매 조건과 자산 유동성의 정합"이다. 상한은 그 정합을 사전에 강제하지만, 고수익 자산을 줄이는 실질 비용이 있고 벤치마크 대비 성과 괴리를 만든다.',
            sourceRefs: [S.fsbOef, S.fsb],
          },
          consequences: '비유동 비중 상한 30%가 정책으로 채택되었습니다.',
          feasibility: { basis: '투자정책서 개정 + 단계적 조정', sourceRefs: [S.fsbOef] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't7-d1',
      text: '이번 달의 "누적 희석"과 "비유동 비중" 경로를 보세요. 그 둘이 다음 정책의 근거입니다.',
    },
    {
      level: 2,
      decisionId: 't7-d1',
      text: '구속 제약은 지급능력이 아니라 "오늘 무엇을 팔 수 있는가"였습니다. 도구(스윙·현물 환매)와 구성(현금 하한·비유동 상한)은 서로 다른 제약을 풉니다.',
    },
  ],
}

export const turnsB: T[] = [t4, t5, t6, t7]
