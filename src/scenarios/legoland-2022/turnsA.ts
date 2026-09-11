import type { DialogueStep, Interrupt, SecuritiesState } from '../../engine/types'
import { securitiesFx } from '../../engine/fx/securities'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, flag, fnEffect, op, ownStockMove, regulator } from '../../engine/fx/common'
import { legoFx } from './localFx'
import { rolloverDecision, S, type T } from './shared'

const CALL_LIMIT = 1500 // 자기자본 15%(월평균 상한을 일별 캡으로 단순화) [fsc-call-market-2015, STYLIZED]

/**
 * 단기금융시장 하루의 틱 구조. 전단채·CP·ABCP의 발행 조건 제시 → 오전 청약 → 오후 청약 → 마감
 * 집계가 한 영업일의 실제 순서다. 프로필은 `calibration.md` §13.1 참조 — 합은 항상 1이어야 한다.
 */
export const MM_TICK_LABELS = ['09:00', '11:00', '14:00', '15:30']
/** 10/21: MMF·은행 신탁이 이탈해 미달이 오전·오후 청약에서 확정된다 — 중반 집중 [STYLIZED]. */
export const T3_CP_PROFILE = [0.1, 0.4, 0.35, 0.15]

// ---------------------------------------------------------------------------------------------
// T0 — 2022-09-28 (수) "회생신청 발표"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2022년 9월 28일 (수) 16:00 KST',
  title: '프롤로그: 회생신청 발표',
  time: '2022-09-28T16:00:00+09:00',
  events: [
    {
      id: 't0-news-gangwon',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '15:40',
      headline:
        '[속보] 강원도, 강원중도개발공사(GJC) 회생신청 방침 — 레고랜드 ABCP 2,050억 내일 만기',
      body: '강원도가 도 출자기관인 GJC에 대해 기업회생을 신청하겠다고 밝혔다. GJC의 SPC 아이원제일차가 발행한 2,050억원 규모 ABCP는 강원도 지급보증(A1)을 근거로 발행됐으며 내일(9/29) 만기가 도래한다. 시장에서는 "지자체 보증 ABCP의 상환이 불투명해졌다"는 반응이 나온다.',
      severity: 'critical',
      sourceRefs: [S.gangwon, S.bai],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '15:30',
      headline: '마감 시세',
      items: [
        { label: '기준금리', value: '2.50%', change: '8/25 +25bp' },
        { label: '국고 3년', value: '4.338%', change: '9/26 4.548% 정점 후 소폭 하락' },
        { label: 'CP91 (A1)', value: '3.15%', change: '9/22 기준; 연초 1.55%' },
        { label: '회사채 AA- 3년', value: '5.342%', change: '스프레드 100bp' },
        { label: '원/달러', value: '1,440', change: '13년 만 최고 부근' },
      ],
      sourceRefs: [S.kofia, S.bokRate],
    },
    {
      id: 't0-memo-risk',
      kind: 'memo',
      time: '16:10',
      from: '리스크관리부장',
      to: 'CRO',
      subject: 'PF 익스포저 현황 및 레고랜드 파급 1차 점검',
      body: `- 매입확약·신용공여 잔액 **4,700억(자기자본 47%)**, 브릿지론 직접 대출 800억. 한신평 중형사 평균(47%)과 같은 수준.
- 만기 사다리: 10월 1,500억(10/5 400 · 10/14 400 · 10/21 250 · 10/24~31 450), 11월 2,500억(11/1 750 · 11/9 1,050 · 11/24 700), 12월 300억.
- 우리 보증 ABCP는 대부분 A2 등급 사업장. 차환 실패 시 **약정대로 자체매입 → 현금 소진 + 신용위험액 가산(위험값 100%)** → NCR 하락.
- 현재 NCR {{metric:ncr}}, 유동성비율 {{metric:liquidityRatio}}. 적기시정조치 기준 NCR 100%(권고)/50%(요구).`,
      severity: 'warning',
      sourceRefs: [S.kis, S.kcmi23],
      relatedMetrics: ['ncr', 'guaranteeToEquity', 'abcpMaturing30'],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't0-memo-treasury',
      kind: 'memo',
      time: '16:30',
      from: '자금부장',
      to: 'CRO',
      subject: '조달 구조 및 유동성 현황',
      body: `- CP·전단채 7,000억(1~3개월, 이번 주 만기 약 560억), 콜차입 1,000억(한도 1,500억 = 자기자본 15%), RP 매도 1,000억.
- 현금 1,800억, 은행 크레딧라인 1,500억(미사용), 매각·RP 담보 가능 채권 2,400억.
- 자사 CP(A2) 발행금리 4.4% — A1 CP91 대비 +125bp. 아직 수요는 정상.
- 3주 전 자본시장연구원 보고서(A3- CP 6.0%, 비은행 PF 78조)를 다시 회람합니다.`,
      severity: 'info',
      sourceRefs: [S.kcmiLee, S.callLimit],
      relatedMetrics: ['cash', 'liquidityRatio', 'ownCpRate'],
      cardRefs: ['contingency-funding-plan'],
    },
    {
      id: 't0-call-dealer',
      kind: 'call',
      time: '17:00',
      caller: '채권 브로커(단기자금 데스크)',
      callee: '자금부장',
      tone: 'concerned',
      lines: [
        {
          speaker: '브로커',
          text: '지자체 보증인데 안 갚는다는 게 말이 됩니까? 내일 만기 물량이 미상환되면 A1 ABCP 전체가 다시 평가될 겁니다. PF 쪽은 특히요.',
        },
        {
          speaker: '자금부장',
          text: '우리 보증 물량 차환 문의가 오면 바로 알려 주십시오. 10월 첫 주 만기부터 봐야겠습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.pDefault],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '선제 대응 패키지',
      prompt: '부도가 확정되기 전 일주일 동안 무엇을 준비하시겠습니까? (최대 3개, E는 단독 선택)',
      context:
        '아직 우리 보증 ABCP는 정상 차환되고 있습니다. 준비 조치는 눈에 띄지 않지만 10월 이후의 선택지는 오늘 무엇을 해두었는지에 달려 있습니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t0-e', 't0-a'],
        ['t0-e', 't0-b'],
        ['t0-e', 't0-c'],
        ['t0-e', 't0-d'],
      ],
      requiredConcepts: ['pf-abcp-commitment-ncr', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'solvency', 'timeliness'],
      options: [
        {
          id: 't0-a',
          label: 'PF 익스포저 전수 실사 및 신규 매입확약 중단',
          description:
            '사업장별 만기·등급·시공사 신용을 전수 점검하고, 클로징을 앞둔 신규 약정(약 250억)을 보류한다. 비용은 없고 시장에 알려지지 않는다. 내부 결재만으로 즉시 가능.',
          effects: [flag('exposure_reviewed')],
          expert: {
            rating: 85,
            rationale:
              '자본시장연구원(23-10)은 위기 직전까지 신규 매입확약이 늘어난 것을 중소형사 취약성의 원인으로 지적한다. 익스포저를 동결해야 이후 모든 조달 계산이 유효하다.',
            sourceRefs: [S.kcmi23, S.fsc2023],
          },
          consequences:
            '실사가 시작되었습니다. 진행 중이던 신규 약정은 보류되어 11월 만기 사다리가 늘어나지 않습니다.',
          feasibility: { basis: '내부 결재 사항 — 즉시 실행 가능', sourceRefs: [S.kcmi23] },
        },
        {
          id: 't0-b',
          label: '유동성 버퍼 확대: 은행 크레딧라인 1,500억 추가 약정',
          description:
            '주거래은행 2곳과 크레딧라인을 3,000억으로 늘린다. 약정 수수료(0.2%, 30억)가 들지만 부도 전이라 은행 심사가 정상 속도로 진행된다. 부도 후에는 본부 심사가 막힌다.',
          effects: [
            op('institution.liquidity.creditLines', 'add', 1500, '크레딧라인 +1,500'),
            op('institution.equityCapital', 'add', -30, '약정 수수료'),
            flag('t0_buffer'),
          ],
          expert: {
            rating: 90,
            rationale:
              'BCBS 원칙 11(CFP): 조치는 금액·리드타임이 확정된 것이어야 한다. 확정 라인은 위기 중 유일하게 "즉시 가용"한 도매 자금이며, 한은 FSR은 2022년 증권사 유동성 대응에서 은행 라인의 역할을 지적한다.',
            sourceRefs: [S.bcbs144, S.fsr, S.kcmi23],
          },
          consequences: '은행 2곳이 약정서에 서명했습니다. 크레딧라인이 3,000억으로 늘었습니다.',
          feasibility: {
            basis: '부도 전 은행 심사 정상 — 1주 내 약정 가능',
            sourceRefs: [S.bcbs144],
          },
          calibrationNote: '약정 수수료 0.2% [CAL]; 버퍼 플래그는 적시성 점수에 반영',
        },
        {
          id: 't0-c',
          label: '만기 분산 협상: 10월 만기 ABCP 30%를 3개월 연장',
          description:
            '발행 SPC·시공사·투자자와 협의해 10월 만기의 30%(약 450억)를 2023년 1월 이후로 연장한다. 연장 수수료 0.5%. 부도 전이라 투자자 동의를 얻기 쉽다.',
          effects: [
            legoFx.smoothMaturities({ fraction: 0.3, fromIdx: 1, toIdx: 4, feeRate: 0.005 }),
          ],
          expert: {
            rating: 75,
            rationale:
              '만기 집중이 차환 위험의 핵심이다. 금융위는 2023년 5월 결국 4.9조의 유동화증권을 대출로 전환해 만기를 늘렸다 — 같은 조치를 부도 전에 자발적으로 하는 것이 훨씬 싸다.',
            sourceRefs: [S.fsc2023, S.kcmi23],
          },
          consequences:
            '10월 만기 중 약 450억이 내년 1월 이후로 연장되었습니다. 30일 만기 도래액이 줄었습니다.',
          feasibility: { basis: '유동화 약정 변경 — 투자자 동의 시 가능', sourceRefs: [S.fsc2023] },
          calibrationNote: '연장 수수료 0.5% [CAL]',
        },
        {
          id: 't0-d',
          label: '보유 국공채 1,000억 선제 매각으로 현금 확보',
          description:
            '평온한 시장에서 국공채를 0.5% 할인에 판다. 현금은 늘지만 RP 담보와 매각 가능 채권이 줄어 이후 조달 옵션이 좁아진다.',
          effects: [securitiesFx.sellSecurities({ amount: 1000, discount: 0.005 })],
          expert: {
            rating: 55,
            rationale:
              '나쁘지 않지만 최선은 아니다. 국공채는 팔지 않아도 RP·증금 담보로 현금이 된다. 지금 팔면 담보 여력을 미리 소진한다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '국공채 1,000억이 체결되었습니다. 현금이 늘고 담보 가능 채권이 줄었습니다.',
          calibrationNote: '평온 시 할인 0.5% [CAL]',
        },
        {
          id: 't0-e',
          label: '관망: 지자체 보증이므로 상환될 것으로 보고 정상 영업',
          description:
            '강원도가 결국 갚을 것이라는 판단 하에 신규 약정과 조달 구조를 그대로 둔다. 비용은 없다.',
          effects: [],
          expert: {
            rating: 20,
            rationale:
              '대부분의 중형사가 실제로 택한 경로다. 그러나 감사원은 이미 2015년에 보증 증액의 절차적 하자를 지적했고, 자본시장연구원은 3주 전 A3- CP 6%를 경고했다. "지자체 보증 = 안전"은 검증되지 않은 가정이었다.',
            historicalNote: '10/5 최종 부도 전까지 업계 대응은 제한적이었다.',
            sourceRefs: [S.bai, S.kcmiLee],
          },
          consequences:
            '정상 영업을 계속합니다. 진행 중이던 신규 약정 250억이 다음 주 클로징됩니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"지자체가 보증했으니 결국 갚는다"는 결론이 맞더라도, 그 사이 시장이 A2 PF-ABCP 전체를 재평가하면 우리 보증 물량의 차환이 막힌다. 위기는 최종 손실이 아니라 차환 타이밍에서 온다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "차환 만기 도래액(30일)"과 "현금+크레딧라인"을 비교하세요. 차환률이 50%로 떨어지면 무엇이 부족합니까?',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: 'CFP 원칙: 위기 전에 확정한 라인만 위기 중 자금이 됩니다. 만기 분산은 부도 후엔 투자자 동의를 받기 어렵습니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: 'A(실사·신규 중단)+B(라인 확대)+C(만기 분산)의 조합이 비용 대비 효과가 가장 큽니다. E는 함정입니다.',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'pf-abcp-commitment-ncr'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2022-10-05 (수) "최종 부도"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2022년 10월 5일 (수) 09:00 KST',
  title: '최종 부도',
  time: '2022-10-05T09:00:00+09:00',
  entryEffects: [
    {
      id: 't1-market',
      description: 'CP91 3.50%, 스프레드 108bp, 자사 CP 4.7%, 증권주 −5%',
      effects: [
        op('market.custom.cp91', 'set', 350),
        op('market.custom.cd91', 'set', 332),
        op('market.fundingStressBp', 'set', 18),
        op('market.custom.creditSpreadAA', 'set', 108),
        op('market.creditSpreadIgBp', 'set', 108),
        op('market.custom.govt3y', 'set', 416),
        op('market.custom.corpAA3y', 'set', 524),
        op('market.custom.ownCpRate', 'set', 4.7),
        ownStockMove(-0.05, '부도 확정'),
      ],
    },
    {
      id: 't1-t0-roll',
      description: '9/28~10/4 만기분(150억) 차환 — 부도 전 차환률 95%',
      effects: [
        securitiesFx.rolloverStep({
          honourCommitment: true,
          riskWeight: 1,
          label: '9월 말 만기 차환',
        }),
      ],
    },
    {
      id: 't1-rollrate',
      description: '아이원제일차 최종 부도(D) → A2 PF-ABCP 차환 성공률 60%',
      effects: [legoFx.setRollRateWithAdj(0.6, '부도 확정, A2 PF-ABCP 차환 실패 시작')],
    },
    {
      id: 't1-ci',
      description: '동종 상품(지자체 보증 ABCP) 부도 → 신뢰지수 −8',
      effects: [confidence(-8, '레고랜드 ABCP 최종 부도')],
    },
    {
      id: 't1-new-deal',
      when: { notFlag: 'exposure_reviewed' },
      description: '9월에 약정한 신규 딜 250억 클로징 → 11월 초 첫 만기',
      effects: [legoFx.addCommitments({ amount: 250, atIndex: 4, reason: '9월 약정 딜 클로징' })],
    },
    {
      id: 't1-cp',
      description: 'CP 만기(잔액 8%) 재발행 — 신뢰지수에 따라 일부 순상환',
      effects: [legoFx.cpRollStep({ share: 0.08 }), legoFx.callRollStep()],
    },
    { id: 't1-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't1-news-default',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '08:50',
      headline: '[속보] 레고랜드 ABCP 최종 부도 처리 — 등급 A1→C 강등 이어 D',
      body: '아이원제일차 ABCP 2,050억원이 9/29 만기 미상환에 이어 최종 부도 처리됐다. 신용평가사는 10/4 등급을 C로 내렸다. 지자체 보증 유동화증권이 부도난 첫 사례로, 증권사 보증 PF-ABCP 전반의 차환 우려가 커지고 있다.',
      severity: 'critical',
      sourceRefs: [S.pDefault, S.gangwon],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't1-market-open',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: 'CP91 (A1)', value: '3.50%', change: '+35bp (1주)' },
        { label: '회사채 AA- 스프레드', value: '108bp', change: '+8bp' },
        { label: '자사 CP(A2) 호가', value: '4.7%', change: '+30bp' },
        { label: '증권업 지수', value: '−5%', change: '' },
      ],
      sourceRefs: [S.kofia],
    },
    {
      id: 't1-memo-treasury',
      kind: 'memo',
      time: '09:20',
      from: '자금부장',
      to: 'CRO',
      subject: '이번 주 만기 ABCP 400억 — 차환 수요 냉담',
      body: `- 10/5~13 만기 도래 400억 중 기존 투자자(MMF·은행 신탁·법인)의 재투자 의사는 약 60%. 나머지는 "A2 PF는 당분간 편입 불가".
- 차환 실패분은 매입확약에 따라 우리가 사야 합니다. 현금 {{metric:cash}}.
- CP 만기 도래분 재발행은 아직 진행 중이나 금리가 매일 오릅니다.
- 한은 RP 매매 대상기관이 아니므로 한은 창구는 직접 이용 불가. 은행 크레딧라인·RP·콜·CP가 현재 가용 채널.`,
      severity: 'critical',
      sourceRefs: [S.kcmi23, S.bokAct],
      relatedMetrics: ['abcpMaturingNext', 'rollRate', 'cash'],
    },
    {
      id: 't1-memo-newdeal',
      kind: 'memo',
      when: { notFlag: 'exposure_reviewed' },
      time: '09:30',
      from: 'IB본부',
      to: 'CRO',
      subject: '9월 약정 PF 딜 클로징 완료 (매입확약 250억)',
      body: '9월 초 약정한 사업장의 ABCP가 발행되어 매입확약 250억이 추가되었습니다. 첫 만기는 11월 초입니다.',
      severity: 'warning',
    },
    {
      id: 't1-call-bank',
      kind: 'call',
      time: '11:00',
      caller: '주거래은행 RM',
      callee: '자금부장',
      tone: 'concerned',
      lines: [
        {
          speaker: 'RM',
          text: '기존 크레딧라인은 유효합니다. 다만 오늘부터 증권사 신규 증액은 본부 심사로 올라가서, 부도 뉴스가 있는 동안은 결론이 늦을 겁니다.',
        },
        { speaker: '자금부장', text: '기존 한도 인출은 당일 처리되는 거지요?' },
        { speaker: 'RM', text: '네, 기존 한도는 당일입니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.bcbs144],
    },
    {
      id: 't1-memo-risk',
      kind: 'memo',
      time: '13:00',
      from: '리스크관리부장',
      to: 'CRO',
      subject: 'NCR 산식 리마인드 — 자체매입의 자본 효과',
      body: `순자본비율 = (영업용순자본 − 총위험액) / 필요유지자기자본.
- 자체매입 ABCP는 신용위험액에 **위험값 100%**로 가산 → 1,000억 매입 시 NCR 약 67%p 하락(필요유지자기자본 1,500억 기준).
- 현금 유출과 NCR 하락이 동시에 일어나는 것이 매입확약의 구조적 특징입니다.
- 적기시정조치: NCR 100% 미만 경영개선권고, 50% 미만 요구, 0% 미만 명령.`,
      severity: 'warning',
      sourceRefs: [S.kcmi23],
      cardRefs: ['pf-abcp-commitment-ncr', 'regulator-escalation-ladder'],
      relatedMetrics: ['ncr'],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 1,
      riskWeight: 1,
      prompt: '10/5~13 만기 400억 중 차환 실패분(약 40%)을 어떻게 처리하시겠습니까?',
      context:
        '차환 실패분은 약정상 우리가 사야 합니다. 사면 현금과 NCR이 동시에 줄고, 안 사면 시장에서 퇴출됩니다.',
      honour: {
        rating: 70,
        rationale:
          '약정 이행은 증권사 신용공여의 전제이며 업계 전체가 실제로 그렇게 했다. 다만 한 턴 앞을 내다보면 만기 연장 협상이 같은 결과를 더 싸게 낸다.',
        historicalNote:
          '2022년 10~11월 증권사들은 차환 실패 PF-ABCP를 자체매입했고, 그 잔액이 NCR 특례(11/9)의 배경이 됐다.',
        consequences:
          '차환 실패분을 자체매입했습니다. 현금이 줄고 보유 ABCP와 신용위험액이 늘었습니다.',
      },
      negotiate: {
        rating: 75,
        extendShare: 0.4,
        rationale:
          '부도 초기에는 투자자도 손실 확정보다 연장을 선호한다. 연장분은 11월로 밀리지만 그때는 정책 창구가 열려 있을 가능성이 크다. 금융위의 2023년 대출 전환(4.9조)이 사후에 같은 논리를 확인했다.',
        consequences: '일부 투자자가 연장에 동의했습니다. 나머지는 자체매입했습니다.',
      },
      abandon: {
        rating: 5,
        rationale:
          '매입확약 불이행은 시장 퇴출로 이어진다. 증권사 신용공여의 신뢰가 무너지면 잔여 보증 물량 전체의 차환이 즉시 막히고, 감독당국 제재와 투자자 소송이 따른다. 어떤 사후평가도 이 선택을 지지하지 않는다.',
        consequences:
          'SPC가 부도 처리되었습니다. 단기자금 데스크에서 "한빛증권 보증 물량 전면 회피" 지침이 돈다는 보고입니다.',
        trapExplanation:
          '현금과 NCR을 지키는 것처럼 보이지만, 보증기관의 신용이 사라지면 잔여 4,000억의 차환이 한꺼번에 막힌다. 매입확약은 선택이 아니라 사업 모델의 전제다.',
      },
      extra: [
        {
          id: 't1-d1-d',
          label: '자체매입 후 즉시 유통시장에 재매각 시도',
          description:
            '약정대로 산 뒤 15% 할인으로 되판다. 신뢰지수 50 이상이면 절반이 소화되고, 미만이면 매수처가 없다. A2 PF-ABCP 유통시장은 사실상 실종 상태다.',
          effects: [
            securitiesFx.rolloverStep({ honourCommitment: true, riskWeight: 1, label: '자체매입' }),
            fnEffect<SecuritiesState>('resellHeld', {}, (d, ctx) => {
              const s = d.institution
              const last = d.counters.lastRolloverFailed ?? 0
              if (d.confidence.index >= 50 && last > 0) {
                const sold = last * 0.5
                s.pf.abcpHeld -= sold
                s.liquidity.cash += sold * 0.85
                s.equityCapital -= sold * 0.15
                s.risk.credit = Math.max(0, s.risk.credit - sold)
                d.counters.realizedLoss = (d.counters.realizedLoss ?? 0) + sold * 0.15
                ctx.log(`보유 ABCP 재매각 ${sold.toFixed(0)} (할인 15%)`)
              } else ctx.log('재매각 실패: A2 PF-ABCP 매수처 없음')
            }),
          ],
          expert: {
            rating: 30,
            rationale:
              '유통시장이 없는 자산을 시장에 되파는 것은 손실 확정 외에 얻는 것이 없다. 결국 11/24 매입프로그램이 이 유통시장 역할을 대신하게 된다.',
            sourceRefs: [S.prog1124],
          },
          consequences: '재매각을 타진했습니다. 결과는 로그를 확인하세요.',
        },
      ],
    }),
    {
      id: 't1-d2',
      title: '조달 채널 선택',
      prompt: '이번 주 어떤 채널로 얼마를 조달하시겠습니까? (최대 2개)',
      context:
        '한은 RP 매매 대상기관이 아니므로 한은 창구는 없습니다. 아직 CP 시장은 열려 있지만 금리가 오르고 있습니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['contingency-funding-plan', 'korea-crisis-toolkit'],
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't1-d2-a',
          label: '은행 크레딧라인 1,000억 인출',
          description: '기존 약정 한도 내 당일 인출. 금리 4.5%. 위기 초기에 확정 라인을 먼저 쓴다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bank', amount: 1000, rateBp: 450 })],
          expert: {
            rating: 80,
            rationale:
              'CFP 워터폴의 첫 단계는 확정 라인이다. 부도 직후에는 은행이 아직 라인을 존중하지만, 신뢰지수가 떨어지면 갱신을 거부한다(BCBS 2023: 무담보 도매자금은 필요할 때 먼저 사라진다).',
            sourceRefs: [S.bcbs144, S.bcbs555],
          },
          consequences: '크레딧라인 인출이 당일 입금되었습니다.',
        },
        {
          id: 't1-d2-b',
          label: '콜차입을 한도(자기자본 15%)까지 확대',
          description:
            '익일물 콜을 500억 늘린다. 가장 싸지만(3.0%) 매일 갱신해야 하며, 신뢰지수가 40 아래로 가면 대여자가 한도를 회수한다.',
          effects: [
            securitiesFx.raiseFunding({
              channel: 'call',
              amount: 500,
              rateBp: 300,
              callLimit: CALL_LIMIT,
            }),
          ],
          expert: {
            rating: 40,
            rationale:
              '익일물 의존 확대는 롤오버 위험을 키운다. 2013년 금융위가 증권사 콜차입 한도를 자기자본 25%에서 15%로 낮추고, 2015년 콜시장 참가 자체를 국고채전문딜러·한은 공개시장운영 대상 증권사로 좁힌 이유가 바로 이것이다.',
            sourceRefs: [S.callLimit],
          },
          consequences: '콜차입이 한도까지 늘었습니다. 매일 갱신해야 합니다.',
          calibrationNote:
            '콜 한도 자기자본 15% — 모범규준 제2-15조②의 월평균 상한을 일별 하드캡으로 단순화 [STYLIZED]',
        },
        {
          id: 't1-d2-c',
          label: '자사 CP 1,000억 추가 발행 (금리 4.7%)',
          description:
            '3개월 CP를 발행한다. 신뢰지수 60 이상이면 전액, 40~59면 절반, 미만이면 소화되지 않는다.',
          effects: [securitiesFx.raiseFunding({ channel: 'cp', amount: 1000, rateBp: 470 })],
          expert: {
            rating: 45,
            rationale:
              '10월 초 증권사 CP 발행이 급증한 것은 사실이나, 그 CP가 11월에 다시 만기 도래해 45일 연속 금리 상승의 연료가 되었다. 만기를 늘리는 효과는 있지만 수요처가 이탈 중이다.',
            historicalNote: '증권사들은 10월 초 CP·전단채 발행으로 대응했다.',
            sourceRefs: [S.pCp, S.kcmi23],
          },
          consequences: 'CP 발행을 진행했습니다. 소화된 금액은 로그를 확인하세요.',
          historical: true,
        },
        {
          id: 't1-d2-d',
          label: '조달 없이 보유 현금으로 대응',
          description: '조달 비용을 아낀다. 이번 주 만기와 CP 순상환을 현금으로 흡수한다.',
          effects: [],
          expert: {
            rating: 25,
            rationale: '위기 초기 조달 비용 절감은 위기 중반의 조달 불가로 되돌아온다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: '조달하지 않았습니다.',
        },
        {
          id: 't1-d2-e',
          label: '한국은행 RP 매입 입찰 참여',
          description:
            '한은법 68조 공개시장운영 RP는 대상기관(은행·일부 대형 증권사)만 참여할 수 있다.',
          requires: { flag: 'bok_rp_counterparty' },
          unavailableReason:
            '한빛증권은 한은 RP 매매 대상기관이 아닙니다. 중형 증권사는 증권금융·은행 경로로만 한은 유동성에 닿습니다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bok', amount: 1000, rateBp: 300 })],
          expert: {
            rating: 70,
            rationale: '대상기관이라면 최선의 창구지만, 이 기관에는 존재하지 않는 창구다.',
            sourceRefs: [S.bokAct, S.bokOmo],
          },
          consequences: '입찰에 참여했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '"차환 만기 도래액(이번 턴)" × (1 − 차환 성공률)이 오늘 사야 할 금액입니다. 현금과 비교하세요.',
    },
    {
      level: 2,
      decisionId: 't1-d2',
      text: 'CFP 워터폴: 확정 라인(은행) → 담보 조달(RP) → 무담보(CP·콜). 위기 중에는 순서가 곧 생존입니다.',
    },
    {
      level: 3,
      decisionId: 't1-d2',
      text: '은행 라인(A)을 먼저 쓰고, CP(C)는 시장이 열려 있는 동안만 보조로 쓰세요. 콜 확대(B)는 익일물 의존을 키웁니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2022-10-14 (금) "스프레드 확대"
// ---------------------------------------------------------------------------------------------
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2022년 10월 14일 (금) 09:00 KST',
  title: '스프레드, 2009년 이후 최대',
  time: '2022-10-14T09:00:00+09:00',
  entryEffects: [
    {
      id: 't2-market',
      description:
        '기준금리 3.00%(10/12), 국고3y 4.207%, AA- 5.320%, 스프레드 111bp, CP91 4.00%, 자사 CP 5.2%',
      effects: [
        op('market.policyRateBp', 'set', 300),
        op('market.custom.cp91', 'set', 400),
        op('market.custom.cd91', 'set', 366),
        op('market.fundingStressBp', 'set', 34),
        op('market.custom.creditSpreadAA', 'set', 111),
        op('market.creditSpreadIgBp', 'set', 111),
        op('market.custom.govt3y', 'set', 421),
        op('market.custom.corpAA3y', 'set', 532),
        op('market.custom.ownCpRate', 'set', 5.2),
        ownStockMove(-0.08, '스프레드 확대'),
      ],
    },
    {
      id: 't2-rollrate',
      description: '차환 성공률 45%',
      effects: [legoFx.setRollRateWithAdj(0.45, '스프레드 확대, A2 PF-ABCP 기피')],
    },
    {
      id: 't2-ci',
      description: '신용스프레드 2009년 이후 최대, 신평사 검토 → 신뢰지수 −5',
      effects: [confidence(-5, '스프레드 확대·등급전망 검토')],
    },
    {
      id: 't2-mtm',
      description: '채권 운용 평가손 −60억 (금리·스프레드 상승)',
      effects: [op('institution.equityCapital', 'add', -60, '채권 평가손')],
    },
    {
      id: 't2-cp',
      description: 'CP 만기(잔액 10%) 재발행',
      effects: [legoFx.cpRollStep({ share: 0.1 }), legoFx.callRollStep()],
    },
    { id: 't2-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't2-news-spread',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '08:30',
      headline: '회사채 AA- 3년 5.320%, 국고 대비 111~114bp — 2009년 9월 이후 최대 스프레드',
      body: '국고 3년 4.207%에 회사채 AA- 3년이 5.320%로 마감하며 스프레드가 금융위기 직후 수준으로 벌어졌다. 한은은 10/12 기준금리를 3.00%로 50bp 인상했다. 레고랜드 사태 이후 PF-ABCP뿐 아니라 우량 회사채까지 수요가 얼어붙고 있다.',
      severity: 'critical',
      sourceRefs: [S.kofia, S.bokRate],
    },
    {
      id: 't2-memo-treasury',
      kind: 'memo',
      time: '09:10',
      from: '자금부장',
      to: 'CRO',
      subject: 'CP 재발행 현황 — MMF 편입 거부 시작',
      body: `- 이번 주 CP 만기 도래분 재발행 진행 중. 자사 CP(A2) 호가 5.2%. 일부 MMF가 증권사 CP 편입을 중단했습니다.
- 은행 크레딧라인 잔여 {{metric:liquidAssets}} 중 일부. RP 담보 여력은 매각 가능 채권 2,400억의 90%에서 기존 RP를 뺀 금액.
- 현금 {{metric:cash}}, 유동성비율 {{metric:liquidityRatio}}.`,
      severity: 'warning',
      relatedMetrics: ['cash', 'liquidityRatio', 'ownCpRate'],
    },
    {
      id: 't2-call-rating',
      kind: 'call',
      time: '14:00',
      caller: '신용평가사 금융평가본부',
      callee: 'CRO',
      tone: 'concerned',
      lines: [
        {
          speaker: '평가사',
          text: 'PF 우발채무 비율이 높은 증권사들을 대상으로 등급전망 검토에 들어갑니다. 자체매입 잔액과 유동성 대응 계획을 다음 주까지 주십시오.',
        },
        { speaker: 'CRO', text: '만기 사다리와 조달 계획을 같이 드리겠습니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.kis],
    },
    {
      id: 't2-data-ncr',
      kind: 'data',
      time: '16:00',
      title: '리스크 대시보드',
      rows: [
        { label: 'NCR', value: '{{metric:ncr}}' },
        { label: '유동성비율(30일)', value: '{{metric:liquidityRatio}}' },
        { label: '자체매입 ABCP 잔액', value: '{{metric:abcpHeld}}' },
        { label: '이번 턴 만기', value: '{{metric:abcpMaturingNext}}' },
      ],
      severity: 'warning',
      relatedMetrics: ['ncr', 'liquidityRatio'],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 2,
      riskWeight: 1,
      prompt: '10/14~20 만기 400억 중 차환 실패분(약 55%)을 어떻게 처리하시겠습니까?',
      context: '차환률이 45%로 떨어졌습니다. 이행하면 약 220억이 보유 ABCP로 바뀝니다.',
      honour: {
        rating: 70,
        rationale:
          '이행은 옳지만 협상 여지가 아직 있다. 스프레드 확대 국면에서 투자자는 부도 확정보다 연장을 택한다.',
        consequences: '차환 실패분을 자체매입했습니다.',
      },
      negotiate: {
        rating: 75,
        extendShare: 0.4,
        rationale:
          '연장분은 11월 중순 이후로 밀리며, 그 시점에는 NCR 특례와 매입프로그램이 나올 가능성이 있다(플레이어는 아직 모른다). 협상 비용 0.5%는 자체매입의 자본 비용보다 싸다.',
        consequences: '일부 연장, 잔여분 자체매입.',
      },
      abandon: {
        rating: 5,
        rationale: 'T1과 같다. 보증기관의 신용이 사라지면 잔여 물량 전체가 부도 위험에 노출된다.',
        consequences: 'SPC 부도 처리. 시장이 한빛증권 보증 물량을 전면 회피합니다.',
        trapExplanation: '한 사업장의 손실을 피하려다 보증 사업 전체의 신용을 잃는다.',
      },
    }),
    {
      id: 't2-d2',
      title: '유동성 확보',
      prompt: '어떻게 유동성을 확보하시겠습니까? (최대 2개)',
      context:
        '스프레드가 벌어져 채권 매각 할인이 커졌습니다. 담보 조달(RP)은 헤어컷 10%가 붙습니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['hqla-and-haircuts', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'marketRisk'],
      options: [
        {
          id: 't2-d2-a',
          label: '은행 크레딧라인 잔여 한도 전액 인출',
          description:
            '기존 약정 잔여분을 모두 당일 인출한다(4.6%). 은행이 라인을 회수하기 전에 쓴다.',
          effects: [securitiesFx.raiseFunding({ channel: 'bank', amount: 9999, rateBp: 460 })],
          expert: {
            rating: 75,
            rationale:
              '확정 라인은 위기 중반 이후 존재하지 않을 수 있다. 지금 전액 인출하는 것이 CFP 원칙에 맞다.',
            historicalNote: '중형 증권사들은 10월 중순 은행 크레딧라인을 인출해 대응했다.',
            sourceRefs: [S.bcbs144, S.fsr],
          },
          consequences: '크레딧라인 잔여분이 입금되었습니다.',
          historical: true,
        },
        {
          id: 't2-d2-b',
          label: '보유 채권 1,500억 매각 (할인 2%)',
          description:
            '국공채·은행채를 스프레드 확대 국면에 판다. 손실 30억이 자본에 반영되고 RP 담보 여력이 줄어든다.',
          effects: [securitiesFx.sellSecurities({ amount: 1500, discount: 0.02 })],
          expert: {
            rating: 45,
            rationale:
              '현금은 생기지만 평가손이 실현되고 담보가 사라진다. RP 조달이 같은 채권으로 더 싸게 현금을 만든다.',
            sourceRefs: [S.bcbs555],
          },
          consequences: '채권 1,500억이 체결되었습니다. 매각손이 자본에 반영되었습니다.',
          calibrationNote: '할인 = 스프레드 확대분 × 듀레이션 ≈ 2% [CAL]',
        },
        {
          id: 't2-d2-c',
          label: '보유 채권 전량 매각 (할인 4%)으로 현금 극대화',
          description:
            '매각 가능 채권을 모두 시장에 던진다. 블록 매각 할인 4%, 손실 약 100억. 시장에는 "한빛이 투매한다"는 신호가 간다.',
          effects: [
            securitiesFx.sellSecurities({ amount: 9999, discount: 0.04 }),
            confidence(-5, '보유채권 투매 관측'),
          ],
          expert: {
            rating: 15,
            rationale:
              '유동성 확보처럼 보이지만 (1) 평가손이 자본에 실현되어 NCR이 떨어지고, (2) RP·증금 담보가 사라져 이후 조달 옵션이 없어지며, (3) 투매 자체가 신용 사건으로 읽힌다. BCBS 2023 보고서의 파이어세일 역학 그대로다.',
            sourceRefs: [S.bcbs555, S.kcmi23],
          },
          consequences: '전량 매각이 체결되었습니다. 딜러들이 "한빛 물량"을 화제로 삼고 있습니다.',
          trap: true,
          trapExplanation:
            '"현금이 많으면 안전하다"는 직관은 담보 여력을 무시한다. 채권은 팔면 한 번 현금이 되지만, 담보로 쓰면 반복해서 현금이 된다. 게다가 매각손은 NCR을 직접 깎는다.',
          irreversible: true,
        },
        {
          id: 't2-d2-d',
          label: 'RP 조달 800억 확대 (헤어컷 10%)',
          description: '보유 채권을 담보로 RP를 매도한다(3.8%). 담보 여력 한도 내에서 체결된다.',
          effects: [
            securitiesFx.raiseFunding({
              channel: 'repo',
              amount: 800,
              rateBp: 380,
              repoHaircut: 0.1,
            }),
          ],
          expert: {
            rating: 65,
            rationale:
              '담보 조달은 무담보보다 오래 살아남는다. 채권을 팔지 않고 현금을 만드는 정석.',
            sourceRefs: [S.bcbs144],
          },
          consequences: 'RP 매도가 체결되었습니다. 체결액은 담보 여력에 달려 있습니다(로그 참조).',
        },
        {
          id: 't2-d2-e',
          label: '금리 하락 베팅: 국채선물 매수·채권 운용 포지션 확대',
          description:
            '"금리가 정점"이라는 판단으로 운용 포지션을 늘려 평가손을 만회한다. 시장위험액 +800억. 스프레드가 더 벌어지면 손실이 난다.',
          effects: [op('institution.risk.market', 'add', 800, '운용 포지션 확대')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '10/21 회사채 AA- 5.736% 정점 — 확대한 포지션에서 평가손 150억',
              effects: [op('institution.equityCapital', 'add', -150, '운용 확대 평가손')],
            },
          ],
          expert: {
            rating: 10,
            rationale:
              '손실 만회 베팅은 위기 중 최악의 리스크 결정이다. 시장위험액이 즉시 NCR을 깎고, 10/21 AA- 5.736% 정점까지 스프레드는 더 벌어졌다. 유동성 위기에서 자기자본을 시장위험에 노출하는 것은 자본시장연구원이 지적한 중소형사 실패 패턴이다.',
            sourceRefs: [S.kofia, S.kcmi23],
          },
          consequences:
            '포지션을 늘렸습니다. 시장위험액이 증가했고 결과는 다음 주 시장에 달려 있습니다.',
          trap: true,
          trapExplanation:
            '"이미 많이 올랐으니 내린다"는 판단이 맞더라도 그 사이 NCR이 100% 아래로 가면 의미가 없다. 위기 중 리스크 예산은 생존에 쓴다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d2',
      text: '유동성비율이 100% 아래입니까? 분모(30일 만기 × 차환 실패율 + 콜 + CP 절반)와 분자(현금 + 미사용 라인 + 채권 90%)를 보세요.',
    },
    {
      level: 2,
      decisionId: 't2-d2',
      text: '채권은 "팔면 한 번, 담보로 쓰면 여러 번" 현금이 됩니다. 매각손은 NCR을 직접 깎습니다.',
    },
    {
      level: 3,
      decisionId: 't2-d2',
      text: 'A(라인 전액)+D(RP)가 정석입니다. C(전량 매각)와 E(운용 확대)는 함정입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2022-10-21 (금) "45일의 시작"
// ---------------------------------------------------------------------------------------------

/**
 * 11:00 주관사(자산관리회사) 전화. 대사는 2022년 10월 PF-ABCP 차환 실패의 공개 기록을 바탕으로 한
 * **재구성**이며 실제 통화의 녹취가 아니다.
 */
const t3ArrangerCall: Interrupt<SecuritiesState> = {
  id: 't3-i1-arranger',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 40,
  defaultOptionId: 't3-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '주관사 전화 — 오전 청약 미달',
  prompt: '오후 청약 전에 조건을 바꾸시겠습니까?',
  dimensions: ['liquidity', 'marketRisk'],
  source: { kind: 'desk', caller: 'ABCP 주관사(자산관리회사) 팀장', tone: 'urgent' },
  lines: [
    {
      speaker: '주관사 팀장',
      text: '오전 청약이 사실상 0입니다. 오후 청약 전에 발행금리를 올릴지, 아니면 매입확약 이행을 전제로 투자자에게 미달 통지를 먼저 보낼지 30분 안에 정해 주셔야 합니다.',
    },
  ],
  options: [
    {
      id: 't3-i1-a',
      label: '조건 그대로 오후 청약 진행, 이행 확약을 서면 재확인',
      description:
        '발행 조건은 건드리지 않고 매입확약 이행 의사만 서면으로 재확인해 준다. 미달분은 마감에 우리가 산다.',
      effects: [flag('commitment_reaffirmed')],
      expert: {
        rating: 70,
        rationale:
          '업계가 실제로 한 대응이다. 금리를 올려도 A2 PF-ABCP를 살 수요처(MMF·은행 신탁)가 편입 자체를 중단한 국면에서는 금리가 문제가 아니었다.',
        sourceRefs: [S.pCp, S.kcmi23],
      },
      consequences: '오후 청약을 예정대로 열었습니다. 미달분은 마감 후 확정됩니다.',
      historical: true,
      preview: [{ metric: 'rollRate', direction: 'flat', magnitude: 1, note: '조건 불변' }],
    },
    {
      id: 't3-i1-b',
      label: '발행금리 200bp 인상해 오후 청약 재시도',
      description:
        '가격으로 수요를 찾는다. 이번 턴 차환률이 5%p 오르지만 인상분은 사업장 비용으로 남고 시장에 "한빛 물량은 비싸게 나온다"는 신호가 간다.',
      effects: [
        op('institution.pf.rollRate', 'add', 0.05, '발행금리 인상 — 당일 차환률 +5%p'),
        op('institution.equityCapital', 'add', -10, '금리 인상분 보전'),
      ],
      expert: {
        rating: 45,
        rationale:
          '한계적으로는 작동하지만 수요처가 편입을 중단한 국면에서 가격 대응의 효과는 작다. 같은 논리로 증권사 CP 금리는 10월 내내 올랐고 발행은 늘지 않았다.',
        sourceRefs: [S.pCp],
      },
      consequences: '금리를 올려 오후 청약을 다시 열었습니다. 일부 법인 수요가 들어왔습니다.',
      preview: [{ metric: 'rollRate', direction: 'up', magnitude: 1, note: '+5%p (당일)' }],
    },
    {
      id: 't3-i1-c',
      label: '오후 청약을 취소하고 전액 자체매입을 지금 통지',
      description:
        '더 볼 것 없다고 보고 청약을 접는다. 투자자 명부에 "주관사가 청약을 접었다"가 남고, 잔여 물량의 차환 심리가 나빠진다.',
      effects: [
        op('institution.pf.rollRate', 'add', -0.1, '오후 청약 취소 — 당일 차환률 −10%p'),
        legoFx.adjustRollRate(-0.05, '청약 조기 철회'),
      ],
      expert: {
        rating: 15,
        rationale:
          '자체매입 금액을 스스로 늘리는 선택이다. 오후 청약에서 들어오던 잔여 수요까지 포기하게 되고, 조기 철회는 이후 발행에도 따라다닌다.',
        sourceRefs: [S.kcmi23, S.fsr],
      },
      consequences: '오후 청약을 취소했습니다. 미달분 전액이 자체매입으로 확정됩니다.',
      trap: true,
      trapExplanation:
        '"어차피 안 될 것"이라는 판단이 맞더라도, 청약을 여는 비용은 0이고 접는 비용은 잔여 물량 전체의 차환 심리다.',
      preview: [{ metric: 'abcpHeld', direction: 'up', magnitude: 2, note: '자체매입 증가' }],
    },
  ],
}

/** 15:00 금감원 담당자. 대사는 금감원 일일 보고 요청의 공개 기록을 바탕으로 한 **재구성**이다. */
const t3FssCall: Interrupt<SecuritiesState> = {
  id: 't3-i2-fss',
  interrupt: true,
  atTick: 3,
  jitter: 0,
  timeoutSec: 45,
  defaultOptionId: 't3-i2-a',
  scoreWeight: 0.5,
  required: false,
  title: '금융감독원 담당자 전화',
  prompt: '일일 보고 서식을 마감 시각까지 제출하시겠습니까?',
  dimensions: ['compliance', 'communication'],
  source: {
    kind: 'regulator',
    caller: '금융감독원 금융투자검사국 담당자',
    agency: '금융감독원',
    tone: 'concerned',
  },
  lines: [
    {
      speaker: '금감원 담당자',
      text: '오늘자 서식에 자체매입 잔액과 익일 만기, 가용 유동성을 마감 시각까지 넣어 주십시오. 그리고 기자들이 귀사 PF 우발채무 규모를 묻고 있습니다 — 공시 계획이 있으면 같이 알려 주시죠.',
    },
  ],
  options: [
    {
      id: 't3-i2-a',
      label: '서식대로 마감 시각까지 제출',
      description: '요청받은 항목을 그대로 채워 오늘 중 제출한다. 추가 설명은 붙이지 않는다.',
      effects: [flag('daily_report_filed')],
      expert: {
        rating: 70,
        rationale:
          '감독당국 반응표에서 R1(강화 모니터링)을 유지하는 최소 요건이다. 보고 자체는 비용이 없고, 누락은 곧바로 상향 사유가 된다.',
        sourceRefs: [S.fss],
      },
      consequences: '서식을 제출했습니다. 담당자가 "내일도 같은 시각"이라고 답했습니다.',
      historical: true,
      preview: [{ metric: 'regulatorLevel', direction: 'flat', magnitude: 1 }],
    },
    {
      id: 't3-i2-b',
      label: '제출과 함께 익스포저 공시 계획도 선제 보고',
      description:
        '서식을 내면서 공시 수준과 시점을 먼저 알린다. 감독당국이 언론 대응의 예측 가능성을 얻는다.',
      effects: [
        flag('daily_report_filed'),
        flag('disclosure_pre_notified'),
        confidence(1, '감독당국 선제 보고'),
      ],
      expert: {
        rating: 80,
        rationale:
          'FSB(2024)가 말하는 "같은 수치를 같은 시각에" 원칙의 감독당국 판이다. 공시 계획을 먼저 알린 기관은 언론 보도가 나와도 당국의 확인을 받을 수 있다.',
        sourceRefs: [S.fss, S.fsb],
      },
      consequences:
        '서식과 공시 계획을 함께 냈습니다. 담당자가 보도 대응 시 확인해 주겠다고 했습니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
    },
    {
      id: 't3-i2-c',
      label: '마감 집계를 정리해 내일 아침 제출하겠다고 답한다',
      description: '오늘 마감 수치가 확정되지 않았다는 이유로 하루 미룬다.',
      effects: [regulator({ add: 1 }, '일일 보고 지연')],
      expert: {
        rating: 20,
        rationale:
          '일일 보고 체계에서 하루 지연은 "숫자를 말할 수 없는 상태"로 읽힌다. 감독 단계 상향은 이후 모든 창구(특례·프로그램) 심사에 따라온다.',
        sourceRefs: [S.fss, S.fsb],
      },
      consequences: '내일 제출하겠다고 답했습니다. 담당자가 "사유를 서면으로 남기라"고 했습니다.',
      trap: true,
      trapExplanation:
        '"정확한 수치를 내는 것이 낫다"는 명분은 옳게 들리지만, 일일 보고는 정확성이 아니라 연속성을 보는 장치다. 공백이 생긴 날이 곧 검사 대상 기간이 된다.',
      preview: [{ metric: 'regulatorLevel', direction: 'up', magnitude: 2, note: '감독 단계 +1' }],
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2022년 10월 21일 (금) 09:00 KST',
  title: 'CP 수요처 이탈',
  time: '2022-10-21T09:00:00+09:00',
  ticks: 4,
  tickLabels: MM_TICK_LABELS,
  entryEffects: [
    {
      id: 't3-market',
      description:
        '개장 앵커(10/20 종가): 국고 3년 4.350%, 회사채 AA- 5.588%, CP91 4.14%, CD91 3.85%; 자사 CP 호가 5.5%',
      effects: [
        op('market.custom.cp91', 'set', 414),
        op('market.custom.cd91', 'set', 385),
        op('market.fundingStressBp', 'set', 29),
        op('market.custom.creditSpreadAA', 'set', 124),
        op('market.creditSpreadIgBp', 'set', 124),
        op('market.custom.govt3y', 'set', 435),
        op('market.custom.corpAA3y', 'set', 559),
        op('market.custom.ownCpRate', 'set', 5.5),
        ownStockMove(-0.04, 'CP 금리 상승'),
      ],
    },
    {
      id: 't3-rollrate',
      description: '차환 성공률 35%',
      effects: [legoFx.setRollRateWithAdj(0.35, 'CP·ABCP 수요처 이탈')],
    },
    {
      id: 't3-ci',
      description: 'CP 수요처(MMF·은행 신탁) 이탈 → 신뢰지수 −4',
      effects: [confidence(-4, 'CP 수요처 이탈')],
    },
    {
      id: 't3-mtm',
      description: '채권 운용 평가손 −80억 (AA- 5.736% 정점)',
      effects: [op('institution.equityCapital', 'add', -80, '채권 평가손')],
    },
    {
      id: 't3-regulator',
      description: '금감원, PF 우발채무·유동성 일일 보고 요청 (R1 강화 모니터링)',
      effects: [regulator({ add: 1 }, '금감원 일일 보고 요청')],
    },
    {
      id: 't3-call',
      description: '콜차입(익일물) 정산 — 신뢰지수가 낮으면 대여자가 한도를 회수',
      effects: [legoFx.callRollStep()],
    },
  ],
  eachTick: [
    {
      id: 't3-cp-tick',
      description: 'CP·전단채 만기(잔액 8%) 재발행 — 청약 구간별 확정',
      effects: [legoFx.cpRollTicks({ share: 0.08, profile: T3_CP_PROFILE, label: 'CP 청약 구간' })],
    },
  ],
  tickEffects: [
    {
      id: 't3-settle',
      atTick: 3,
      description: '마감 결제 점검',
      effects: [legoFx.settlementCheck()],
    },
  ],
  ticker: {
    series: [
      // CP91 4.14% → 4.30%, CD91 3.85% → 3.90% (10/21 종가) [ecos-817Y002]
      { path: 'market.custom.cp91', mode: 'absolute', values: [414, 419, 425, 430] },
      { path: 'market.custom.cd91', mode: 'absolute', values: [385, 387, 389, 390] },
      { path: 'market.fundingStressBp', mode: 'absolute', values: [29, 32, 36, 40] },
      // 국고 3년 4.350% → 4.495%, 회사채 AA- 3년 5.588% → 5.736%(연중 최고) [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [435, 440, 446, 450] },
      { path: 'market.custom.corpAA3y', mode: 'absolute', values: [559, 564, 570, 574] },
    ],
  },
  events: [
    {
      id: 't3-news-gangwon',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '08:40',
      headline: '강원도 "레고랜드 ABCP 2,050억, 내년 1월 29일까지 상환" — 시장 "너무 늦다"',
      body: '강원도가 보증채무를 2023년 1월 29일까지 갚겠다고 밝혔다. 그러나 이미 부도 처리된 지 2주가 지났고, 단기자금시장은 "지자체 보증도 3개월을 기다려야 한다"는 학습을 마친 뒤다. CP 금리는 매일 오르고 있다.',
      severity: 'warning',
      sourceRefs: [S.gangwon],
    },
    {
      id: 't3-news-aa',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '15:40',
      atTick: 3,
      headline: '회사채 AA- 3년 5.736% 마감 — 연중 최고, 국고 3년 4.495%',
      body: '우량 회사채마저 5.7%대에 거래되며 스프레드가 124bp에 이르렀다. 증권사 CP·전단채 금리는 A1 기준 4.3%, A2는 5% 중반이다.',
      severity: 'critical',
      sourceRefs: [S.kofia],
    },
    {
      id: 't3-memo-treasury',
      kind: 'memo',
      time: '09:15',
      from: '자금부장',
      to: 'CRO',
      subject: 'CP 수요처 이탈 — 은행 신탁·MMF 증권사 CP 편입 중단',
      body: `- 주요 MMF와 은행 신탁이 증권사 CP·전단채 신규 편입을 중단했습니다. 만기 도래분의 절반 이상이 순상환되고 있습니다.
- 자사 CP 호가 5.5%에도 수요는 법인 일부뿐. 발행해도 절반 소화가 한계입니다.
- 언론이 증권사별 PF 우발채무 규모를 묻고 있습니다. IR팀은 공시 수준을 결정해 달라고 합니다.`,
      severity: 'critical',
      sourceRefs: [S.pCp],
      relatedMetrics: ['ownCpRate', 'cash'],
    },
    {
      id: 't3-regulator-fss',
      kind: 'regulator',
      agency: '금융감독원 금융투자검사국',
      time: '10:30',
      atTick: 1,
      headline: '[감독당국] PF 우발채무·유동성 현황 일일 보고 요청',
      body: '증권사 전체를 대상으로 매입확약 잔액, 자체매입 잔액, 만기 도래액, 가용 유동성을 매일 보고하도록 요청합니다. NCR·유동성비율이 내부 관리 기준을 밑도는 경우 즉시 별도 보고하십시오.',
      tone: 'concerned',
      severity: 'warning',
      sourceRefs: [S.fss],
      cardRefs: ['regulator-escalation-ladder'],
    },
    {
      id: 't3-data-industry',
      kind: 'data',
      time: '11:00',
      atTick: 1,
      title: '[데이터] 증권사 보증 PF-ABCP 만기 (업계)',
      rows: [
        { label: '10월 만기', value: '6.2~6.7조원' },
        { label: '11월 만기', value: '10.7조원' },
        { label: '증권사 PF 채무보증 잔액', value: '약 20조원' },
        { label: '한빛증권 30일 만기', value: '{{metric:abcpMaturing30}}' },
      ],
      severity: 'warning',
      sourceRefs: [S.pMaturity, S.fss],
    },
  ],
  decisions: [
    {
      // 차환 마감(15:30) 집계가 나온 뒤에야 미달 금액이 확정된다 — 이 결정은 마지막 틱에 열린다.
      ...rolloverDecision({
        turn: 3,
        riskWeight: 1,
        prompt: '10/21~23 만기 250억 중 차환 실패분(약 65%)을 어떻게 처리하시겠습니까?',
        context:
          '차환률이 35%입니다. 마감 집계가 방금 나왔습니다. 다음 주 만기 450억이 곧 이어집니다.',
        honour: {
          rating: 70,
          rationale:
            '이행. 다만 신뢰지수가 40 아래면 협상 동의율이 떨어지므로 지금이 협상의 마지막 창일 수 있다.',
          consequences: '차환 실패분을 자체매입했습니다.',
        },
        negotiate: {
          rating: 75,
          extendShare: 0.4,
          rationale:
            '연장분은 11월 말로 밀린다. 그때는 시장 상황이 지금보다 나쁠 수도, 정책 창구가 열렸을 수도 있다 — 하지만 자체매입의 확정 비용보다는 낫다.',
          consequences: '일부 연장, 잔여분 자체매입.',
        },
        abandon: {
          rating: 5,
          rationale: '금감원이 일일 보고를 받는 상황에서의 불이행은 즉시 검사·제재로 이어진다.',
          consequences: 'SPC 부도 처리. 금감원이 현장 검사를 예고했습니다.',
          trapExplanation:
            '감독당국의 시야 안에서 약정을 어기는 것은 유동성 문제를 제재 문제로 바꾼다.',
        },
      }),
      availableFrom: 3,
      defaultOptionId: 't3-d1-a',
      timeLimitSec: 120,
    },
    {
      id: 't3-d2',
      title: '익스포저 공시 수준',
      prompt: '언론과 투자자에게 PF 익스포저를 어느 수준까지 공개하시겠습니까?',
      context:
        '검증 가능한 여력이 있을 때만 공개가 신뢰를 만듭니다. 유동성비율이 100% 아래라면 상세 공시는 부족을 확인시킵니다. IR팀은 오전 중에 답을 받아야 조간 마감에 맞출 수 있다고 합니다.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'compliance'],
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't3-d2-b',
      options: [
        {
          id: 't3-d2-a',
          label: '상세 공시: 사업장별 만기·자체매입 잔액·가용 유동성 공개',
          description:
            '매입확약 잔액, 만기 사다리, 자체매입 잔액, 현금+라인을 숫자로 낸다. 유동성비율 100% 이상이면 신뢰지수 +8·자사 차환률 +5%p, 미만이면 −5.',
          effects: [legoFx.discloseExposure({ minRatio: 100 })],
          expert: {
            rating: 70,
            rationale:
              'FSB(2024): 검증 가능한 수치에 기반한 커뮤니케이션만 유효하다. 가치는 T0~T2에서 무엇을 준비했는지에 달려 있다.',
            sourceRefs: [S.fsb, S.kcmi23],
          },
          consequences: '공시가 나갔습니다. 결과는 유동성비율에 따라 달라집니다(로그 참조).',
        },
        {
          id: 't3-d2-b',
          label: '정기 공시 외 침묵',
          description: '분기 보고서 외에는 답하지 않는다. 정보 공백은 추측으로 채워진다.',
          effects: [confidence(-4, '정보 공백')],
          expert: {
            rating: 30,
            rationale:
              '대부분의 증권사가 택한 경로. 그 결과 언론이 "채무보증 비율 95%" 같은 극단 사례로 업계 전체를 묘사했다.',
            historicalNote: '2022년 10월 증권사들은 개별 익스포저를 적극 공개하지 않았다.',
            sourceRefs: [S.fsb],
          },
          consequences: '답하지 않았습니다. 추측성 기사가 늘고 있습니다.',
          historical: true,
        },
        {
          id: 't3-d2-c',
          label: '"유동성에 문제 없다" 보도자료 (수치 없음)',
          description: '안심 메시지만 낸다. 숫자가 없는 메시지는 "숫자를 말할 수 없다"로 읽힌다.',
          effects: [confidence(-3, '수치 없는 안심 메시지')],
          expert: {
            rating: 25,
            rationale:
              '보정 규칙: 수치 없는 "침착" 메시지 −3. 2011년 저축은행 "추가 없다" 발언의 축소판이다.',
            sourceRefs: [S.fsb],
          },
          consequences: '보도자료가 나갔습니다. 기자들이 "그래서 얼마입니까"라고 되묻습니다.',
        },
        {
          id: 't3-d2-d',
          label: '익스포저 감축 계획 발표: 신규 PF 중단·비용 절감·자산 매각 착수',
          description:
            '희망퇴직·해외 자회사 매각 검토를 포함한 디레버리징 계획을 공표한다. 구조조정 비용 20억. 신뢰지수 +3.',
          effects: [
            op('institution.equityCapital', 'add', -20, '구조조정 비용'),
            confidence(3, '디레버리징 계획 공표'),
            flag('deleveraging_announced'),
          ],
          expert: {
            rating: 55,
            rationale:
              '방향은 옳고 다올투자증권이 실제로 택했다. 그러나 수치 없는 계획은 신뢰를 조금만 산다. 상세 공시와 결합할 때 효과가 크다.',
            sourceRefs: [S.pDaol, S.kcmi23],
          },
          consequences: '디레버리징 계획이 공표되었습니다.',
        },
      ],
    },
    {
      id: 't3-d3',
      title: '조달',
      prompt: '이번 주 조달은? (최대 2개)',
      context:
        '증권금융 지원은 아직 없습니다. CP는 절반만 소화됩니다. 당일 자금이 되려면 오후 청약 마감 전에 지시가 나가야 합니다.',
      select: { min: 1, max: 2 },
      dimensions: ['liquidity', 'solvency'],
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't3-d3-d',
      options: [
        {
          id: 't3-d3-a',
          label: '한국증권금융 RP·증권담보대출 신청',
          description: '증권금융의 증권사 유동성 지원 창구.',
          requires: { flag: 'ksfc_window_open' },
          unavailableReason:
            '증권금융의 증권사 대상 특별 지원은 아직 발표되지 않았습니다. 평시 창구는 담보 심사에 1주 이상 걸립니다.',
          effects: [securitiesFx.raiseFunding({ channel: 'ksfc', amount: 1000, rateBp: 480 })],
          expert: {
            rating: 75,
            rationale: '존재한다면 중형사에 가장 맞는 창구다. 그러나 오늘은 없다.',
            sourceRefs: [S.fsc1028],
          },
          consequences: '신청했습니다.',
        },
        {
          id: 't3-d3-b',
          label: 'RP 조달 500억 추가 (헤어컷 10%)',
          description: '담보 여력 내에서 RP 매도(4.0%).',
          effects: [
            securitiesFx.raiseFunding({
              channel: 'repo',
              amount: 500,
              rateBp: 400,
              repoHaircut: 0.1,
            }),
          ],
          expert: {
            rating: 65,
            rationale: '담보 조달 우선. 여력이 남아 있다면 항상 옳다.',
            sourceRefs: [S.bcbs144],
          },
          consequences: 'RP가 체결되었습니다(담보 여력 한도).',
        },
        {
          id: 't3-d3-c',
          label: '콜차입 한도(자기자본 15%)까지 확대',
          description: '익일물. 신뢰지수 40 아래면 대여자가 회수한다.',
          effects: [
            securitiesFx.raiseFunding({
              channel: 'call',
              amount: 999,
              rateBp: 320,
              callLimit: CALL_LIMIT,
            }),
          ],
          expert: {
            rating: 35,
            rationale:
              '신뢰지수가 40 근처인 지금 익일물을 늘리는 것은 다음 주의 강제 상환을 예약하는 것이다.',
            sourceRefs: [S.callLimit],
          },
          consequences: '콜을 한도까지 늘렸습니다.',
        },
        {
          id: 't3-d3-d',
          label: '자사 CP 1,000억 고금리(5.5%) 발행',
          description: '수요처 이탈로 절반 소화가 한계. 연일 오르는 CP 금리의 한 조각이 된다.',
          effects: [securitiesFx.raiseFunding({ channel: 'cp', amount: 1000, rateBp: 550 })],
          expert: {
            rating: 40,
            rationale: '증권사들이 실제로 한 일이다. 조달은 되지만 11월 만기의 벽을 더 높인다.',
            historicalNote: '10월 하순 증권사 CP 발행금리는 5% 중반까지 올랐다.',
            sourceRefs: [S.pCp],
          },
          consequences: 'CP 발행을 진행했습니다(소화분은 로그 참조).',
          historical: true,
        },
        {
          id: 't3-d3-e',
          label: '자사주 300억 매입으로 주가 방어',
          description:
            '주가 하락이 신용 우려를 키운다는 판단으로 자사주를 산다. 현금 300억 소진, 자사주는 영업용순자본 차감항목.',
          effects: [
            op('institution.liquidity.cash', 'add', -300, '자사주 매입'),
            op('institution.deductions', 'add', 300, '자사주(영업용순자본 차감)'),
            ownStockMove(0.03, '자사주 매입'),
          ],
          expert: {
            rating: 10,
            rationale:
              '유동성 위기 한가운데서 현금과 영업용순자본을 동시에 줄이는 결정. NCR −20%p, 유동성비율 하락. 주가 3% 방어는 CP 시장이 닫히면 아무 의미가 없다.',
            sourceRefs: [S.kcmi23, S.fsr],
          },
          consequences: '자사주 매입을 공시했습니다. 주가는 소폭 반등했고 현금과 NCR은 줄었습니다.',
          trap: true,
          trapExplanation:
            '"주가를 지키면 신용이 지켜진다"는 착각. 신용은 결제 계좌 잔고와 NCR에서 나오고, 자사주는 둘 다 깎는다.',
        },
      ],
    },
  ],
  interrupts: [t3ArrangerCall, t3FssCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d2',
      text: '공시 전에 대시보드 유동성비율을 보세요. 100% 미만이면 상세 공시는 역효과입니다.',
    },
    {
      level: 3,
      decisionId: 't3-d3',
      text: 'B(RP)가 담보 여력이 남아 있는 한 우선입니다. E(자사주)는 함정입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T4 — 2022-10-24 (월) "50조원+α 다음 날"
// ---------------------------------------------------------------------------------------------

/**
 * T4.D3 증권금융·금융투자협회 지원 조건 협의 (3단계). 대사는 10/23 대책과 10/26 증권금융 시행의
 * 공개 기록을 바탕으로 한 **재구성**이며 속기록이 아니다. 신청 규모는 `ksfcRequested` 카운터로
 * 이산화되고, 담보 평가액을 넘는 신청의 결과는 다음 턴 지연효과가 판정한다 — `calibration.md` §14.
 *
 * 세 옵션의 효과는 **플래그와 신뢰지수뿐이며 현금·위험액에 손대지 않는다.** 증권금융 자금 1,000억은
 * `t4-d2-a`의 지연효과가 그대로 집행하므로, 이 결정은 설계상 T5 NCR·T8 자체매입 체크포인트와 무관하다.
 */
const t4KsfcSteps: DialogueStep<SecuritiesState>[] = [
  {
    id: 't4-d3-collateral',
    lines: [
      {
        speaker: '한국증권금융 담보관리부',
        text: '26일 시행에 맞추려면 담보 목록이 먼저입니다. 적격 담보는 국채·통안채·은행채와 일부 우량 회사채입니다. 어디까지 올리시겠습니까.',
      },
    ],
    replies: [
      {
        id: 'coll-full',
        label: '국공채·은행채 보유분 전량을 목록에 올린다',
        next: 't4-d3-amount',
        expert: {
          rating: 85,
          rationale:
            '담보 여력은 쓰지 않아도 줄지 않는다. 목록을 넓게 올려 두면 한도만 확보되고 실제 인출은 필요할 때 한다.',
        },
      },
      {
        id: 'coll-partial',
        label: '국공채만 올리고 은행채는 RP용으로 남긴다',
        next: 't4-d3-amount',
        expert: {
          rating: 55,
          rationale:
            '같은 담보를 두 창구에 중복으로 걸 수는 없으니 배분 자체는 합리적이다. 다만 증권금융 한도가 그만큼 줄어든다.',
        },
      },
      {
        id: 'coll-abcp',
        label: '보유 A2 PF-ABCP를 담보로 받아 달라고 요청한다',
        resolvesTo: 't4-d3-c',
        expert: {
          rating: 15,
          rationale:
            '가장 급한 자산을 담보로 내겠다는 요청이지만, 증권금융의 적격 담보 목록에 A2 유동화증권은 없다. 심사만 늘어지고 시행 첫날을 놓친다.',
        },
        trap: true,
        trapExplanation:
          '"어차피 당국이 도와주려는 것이니 담보도 유연하게 볼 것"이라는 기대. 그러나 지원 창구의 적격 담보 목록은 대책 발표로 바뀌지 않는다 — A2 PF-ABCP를 사 주는 창구는 11/24 매입프로그램까지 없었다.',
      },
    ],
  },
  {
    id: 't4-d3-amount',
    lines: [
      {
        speaker: '금융투자협회 자율규제본부',
        text: '신청 규모를 적어 주십시오. 업권 전체 3조+α를 나누는 자리라 신청액은 담보 평가액으로 검증됩니다.',
      },
    ],
    note: '여기서 적은 신청 규모는 다음 주 담보 평가 결과로 검증됩니다.',
    replies: commitReplies<SecuritiesState>('ksfcRequested', [500, 1000, 2000], {
      unit: '억원',
      next: 't4-d3-timing',
      expert: (v) => ({
        rating: v === 1000 ? 85 : v === 500 ? 55 : 45,
        rationale:
          v === 1000
            ? '보유 채권 2,400억의 헤어컷 후 담보가액과 11월 만기 규모에 모두 맞는 신청액이다.'
            : v === 500
              ? '안전하지만 11월 만기 2,500억 앞에서는 작다. 한도는 쓰지 않아도 비용이 없다.'
              : '담보 평가액을 넘는 신청은 초과분이 반려되고, 업권 배분 자리에서 "규모를 부풀렸다"는 기록만 남는다.',
      }),
    }),
  },
  {
    id: 't4-d3-timing',
    lines: [
      {
        speaker: '한국증권금융 담보관리부',
        text: '목록을 오늘 중 넘기시면 26일 시행과 동시에 처리됩니다. 다음 주로 미루시면 순번이 뒤로 갑니다.',
      },
    ],
    replies: [
      {
        id: 'time-today',
        label: '오늘 중 담보 목록과 신청서를 모두 넘긴다',
        resolvesTo: 't4-d3-a',
        expert: {
          rating: 85,
          rationale:
            '집행 시차가 곧 유동성이다. 시행 첫날 집행을 받는 것과 일주일 뒤에 받는 것은 11월 만기 앞에서 다른 사건이다.',
        },
      },
      {
        id: 'time-next-week',
        label: '신청서만 내고 담보 목록은 다음 주에 정리해 넘긴다',
        resolvesTo: 't4-d3-b',
        expert: {
          rating: 35,
          rationale:
            '서류 부담을 미루는 대가로 집행 순번을 내준다. 11월 첫 주 만기가 750억이라는 것을 알면서 내릴 결정은 아니다.',
        },
      },
    ],
  },
]

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2022년 10월 24일 (월) 09:00 KST',
  title: '50조원+α 다음 날',
  time: '2022-10-24T09:00:00+09:00',
  entryEffects: [
    {
      id: 't4-market',
      description:
        '채안펀드 CP 매입 개시; CP91 4.40%(A1은 소폭 안정), 스프레드 129bp, 자사 CP 5.6%',
      effects: [
        op('market.custom.cp91', 'set', 440),
        op('market.custom.cd91', 'set', 392),
        op('market.fundingStressBp', 'set', 48),
        op('market.custom.creditSpreadAA', 'set', 129),
        op('market.creditSpreadIgBp', 'set', 129),
        op('market.custom.govt3y', 'set', 431),
        op('market.custom.corpAA3y', 'set', 559),
        op('market.custom.ownCpRate', 'set', 5.6),
        ownStockMove(0.03, '시장안정대책'),
      ],
    },
    {
      id: 't4-rollrate',
      description: '차환 성공률 35% — PF-ABCP는 채안펀드 범위 밖이라 변화 없음',
      effects: [legoFx.setRollRateWithAdj(0.35, '50조+α 대책은 PF-ABCP 범위 밖')],
    },
    {
      id: 't4-ci',
      description: '50조+α 발표 효과: 회사채·A1 CP 부분 일치(40%) → 신뢰지수 +3',
      effects: [confidence(3, '50조원+α 시장안정대책(부분 범위)')],
    },
    {
      id: 't4-cp',
      description: 'CP 만기(잔액 4%) 재발행',
      effects: [legoFx.cpRollStep({ share: 0.04 }), legoFx.callRollStep()],
    },
    { id: 't4-settle', description: '결제일 점검', effects: [legoFx.settlementCheck()] },
  ],
  events: [
    {
      id: 't4-news-package',
      kind: 'newswire',
      outlet: '금융위원회·기획재정부·한국은행·금융감독원 합동',
      time: '일 16:00',
      headline:
        '[속보] 비상거시경제금융회의 "50조원+α" 유동성 공급 — 채안펀드 20조(1.6조 즉시 가동), 회사채·CP 매입 16조, 증권금융 3조, 주금공 PF-ABCP 보증 10조',
      body: '정부와 한은은 일요일 회의에서 채권시장안정펀드 20조원(캐피탈콜 방식, 1.6조 즉시 가동), 산은·기은·신보의 회사채·CP 매입 프로그램 16조원, 한국증권금융의 증권사 유동성 지원 3조원, 주택금융공사의 PF-ABCP 보증 10조원을 발표했다. 한은은 적격담보 확대를 검토한다고 밝혔다. 채안펀드는 오늘(10/24)부터 CP 매입을 시작한다.',
      severity: 'positive',
      sourceRefs: [S.pkg, S.fsc1028],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't4-memo-scope',
      kind: 'memo',
      time: '09:30',
      from: '자금부장',
      to: 'CRO',
      subject: '대책 범위 분석 — 우리에게 무엇이 닿는가',
      body: `- **채안펀드**: 매입 대상은 회사채(AA- 이상)와 CP(A1). 우리 보증 A2 PF-ABCP와 A2 자사 CP는 **범위 밖**. 캐피탈콜 방식이라 출자사 콜 응답에 시간이 걸립니다.
- **증권금융 3조+α**: 증권사 대상 RP·증권담보대출. **10/26 시행 예정** — 오늘 신청하면 자금은 다음 주.
- **산은·기은 CP 매입(회사채·CP 16조 중)**: 이번 주 후반 시행 예정, 일반기업 CP 위주. 증권사 CP 편입 여부는 미정.
- **주금공 PF-ABCP 보증 10조**: 신규 발행분 보증 — 기존 차환 실패분에는 해당 없음.
- 결론: 회사채 시장은 안정될 수 있지만 우리 PF-ABCP 차환률은 당장 바뀌지 않습니다.`,
      severity: 'warning',
      sourceRefs: [S.pkg, S.fsc1028],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't4-call-kofia',
      kind: 'call',
      time: '11:00',
      caller: '금융투자협회 자율규제본부',
      callee: 'CRO',
      tone: 'routine',
      lines: [
        {
          speaker: '금투협',
          text: '증권금융 지원 신청 접수를 오늘부터 받습니다. 담보 목록과 신청액을 주시면 26일 시행과 동시에 처리되도록 넘기겠습니다.',
        },
      ],
      severity: 'info',
      sourceRefs: [S.fsc1028],
    },
    {
      id: 't4-market-open',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: 'CP91 (A1)', value: '4.40%', change: '상승세 둔화' },
        { label: '회사채 AA- 스프레드', value: '129bp', change: '+5bp' },
        { label: '자사 CP(A2) 호가', value: '5.6%', change: '+10bp — 여전히 상승' },
        { label: '증권업 지수', value: '+3%', change: '대책 반응' },
      ],
      sourceRefs: [S.kofia],
    },
  ],
  decisions: [
    rolloverDecision({
      turn: 4,
      riskWeight: 1,
      prompt: '10/24~31 만기 450억 중 차환 실패분(약 65%)을 어떻게 처리하시겠습니까?',
      context: '대책 발표에도 A2 PF-ABCP 차환률은 35%입니다. 채안펀드는 우리 물량을 사지 않습니다.',
      honour: {
        rating: 70,
        rationale: '이행. 대책이 범위 밖이라는 것을 이해했다면 협상이 더 낫다.',
        consequences: '차환 실패분을 자체매입했습니다.',
      },
      negotiate: {
        rating: 75,
        extendShare: 0.4,
        rationale:
          '대책 발표 직후는 투자자 심리가 잠시 나아지는 창이다. 연장 동의율이 오르는 시점을 이용한다.',
        consequences: '일부 연장, 잔여분 자체매입.',
      },
      abandon: {
        rating: 5,
        rationale:
          '정부가 시장 안정에 나선 시점의 불이행은 정책 효과를 스스로 무효화하는 행동으로 읽힌다.',
        consequences: 'SPC 부도 처리.',
        trapExplanation: '정책 창구가 열리는 순간 약정을 어기면 창구도 닫힌다.',
      },
    }),
    {
      id: 't4-d2',
      title: '지원 프로그램 신청',
      prompt: '어떤 프로그램에 무엇을 신청하시겠습니까? (최대 2개)',
      context: '발표와 집행은 다릅니다. 범위가 맞는 창구만 자금이 되고, 그것도 다음 주에 옵니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['liquidity', 'policy', 'timeliness'],
      options: [
        {
          id: 't4-d2-a',
          label: '증권금융 RP·증권담보대출 1,000억 신청 (10/26 시행)',
          description:
            '보유 채권을 담보로 증권금융에 신청한다. 자금은 다음 턴(11/1)에 입금된다(금리 4.8%).',
          effects: [flag('ksfc_applied')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '증권금융 특별 지원(10/26 시행) 자금 1,000억 입금',
              effects: [
                flag('ksfc_window_open'),
                securitiesFx.raiseFunding({ channel: 'ksfc', amount: 1000, rateBp: 480 }),
              ],
            },
          ],
          expert: {
            rating: 80,
            rationale:
              '중형 증권사에게 범위가 정확히 일치하는 유일한 창구. 금융위 10/28 점검회의는 증금 3조+α가 10/26부터 집행됐음을 확인한다. 신청이 빠를수록 집행이 빠르다.',
            historicalNote: '증권금융 지원은 중소형 증권사가 실제로 가장 많이 이용한 창구였다.',
            sourceRefs: [S.fsc1028, S.pkg],
          },
          consequences: '신청서를 냈습니다. 자금은 시행일 이후 입금됩니다.',
          historical: true,
        },
        {
          id: 't4-d2-b',
          label: '채안펀드에 자사 CP·보유 PF-ABCP 매입 요청',
          description:
            '채안펀드 운용사에 A2 CP와 보유 A2 PF-ABCP 매입을 요청한다. 적격 기준(회사채 AA- 이상, CP A1)에 맞지 않는다.',
          effects: [],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                '채안펀드: A2 물량은 적격 외 — 회사채 시장 안정의 스필오버로 CP 100억만 소화',
              effects: [
                legoFx.sellOwnCpToProgramme({ amount: 1000, scopeShare: 0.1, rateBp: 560 }),
              ],
            },
          ],
          expert: {
            rating: 35,
            rationale:
              '정책 범위 오독. 보정 규칙 6.7: 범위 불일치 시 발표 효과 10%. 채안펀드는 회사채·A1 CP 시장을 안정시켰고 PF-ABCP는 11/24 프로그램까지 5주를 더 기다려야 했다.',
            sourceRefs: [S.pkg, S.prog1124],
          },
          consequences: '요청서를 보냈습니다. 운용사는 "적격 기준을 확인해 달라"고 답했습니다.',
        },
        {
          id: 't4-d2-c',
          label: '은행 RP·담보대출 한도 700억 신설 요청 (한은 적격담보 확대 기대)',
          description:
            '한은이 적격담보를 확대하면 은행 유동성에 여유가 생긴다. 은행과 담보대출 한도를 협의한다(다음 턴 반영).',
          effects: [],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                '한은 RP 6조·적격담보 확대(10/27) 이후 은행 담보대출 한도 700억 신설·인출',
              effects: [
                op('institution.liquidity.creditLines', 'add', 700, '은행 담보대출 한도'),
                securitiesFx.raiseFunding({ channel: 'bank', amount: 700, rateBp: 470 }),
              ],
            },
          ],
          expert: {
            rating: 65,
            rationale:
              '한은법 68조 RP는 은행을 통해 비은행에 닿는다. 한은 10/27 조치(RP 6조, 적격담보 확대, 최대 36.5조 효과)의 간접 경로를 미리 준비하는 것은 정책 전달 구조를 이해한 행동이다.',
            sourceRefs: [S.bokOmo, S.bokAct],
          },
          consequences: '은행과 협의를 시작했습니다. 한도는 한은 조치 이후 반영됩니다.',
        },
        {
          id: 't4-d2-d',
          label: '50조원+α로 시장 안정 확실 — 조달 신청 보류, 신규 매입확약 재개',
          description:
            '대책 규모를 믿고 디레버리징을 멈춘다. 보류했던 사업장 2곳의 매입확약 300억을 재개하고 지원 신청은 하지 않는다.',
          effects: [
            legoFx.addCommitments({ amount: 300, atIndex: 1, reason: '신규 매입확약 재개' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '발표와 집행의 차이를 무시한 결정. PF-ABCP는 채안펀드 범위 밖이었고 CP 금리는 발표 후에도 5주간 더 올라 12/1 5.54%에서 정점을 찍었다. 이 시점에 익스포저를 늘린 증권사는 11월 만기의 벽을 더 높게 만났다.',
            sourceRefs: [S.pCp, S.kofia, S.pkg],
          },
          consequences: '신규 약정이 체결되었습니다. 11월 초 만기가 300억 늘었습니다.',
          trap: true,
          trapExplanation:
            '"정부가 50조를 넣었으니 끝났다"는 안도는 범위(회사채·A1 CP)와 집행 시차(캐피탈콜·시행일)를 무시한다. 상품 특정 프로그램(11/11, 11/24)까지 PF-ABCP 시장은 닫혀 있었다.',
        },
      ],
    },
    {
      id: 't4-d3',
      title: '증권금융 지원 조건 협의',
      prompt: '증권금융·금융투자협회와 신청 조건을 어떻게 정리하시겠습니까?',
      context:
        '증권금융 3조+α는 10/26 시행입니다. 담보 목록·신청 규모·제출 시점을 상대와 주고받아야 시행 첫날 집행을 받습니다. 자금 자체는 신청서로 결정되지만, 이 대화가 정하는 것은 그 자금이 언제 어떤 평가와 함께 오느냐입니다.',
      when: { chose: { decision: 't4-d2', option: 't4-d2-a' } },
      required: false,
      select: { min: 1, max: 1 },
      steps: t4KsfcSteps,
      requiredConcepts: ['korea-crisis-toolkit', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'policy'],
      defaultOptionId: 't4-d3-a',
      options: [
        {
          id: 't4-d3-a',
          label: '담보 목록 즉시 제출 — 시행 첫날 집행 확약',
          description:
            '적격 담보 목록과 신청서를 오늘 중 넘겨 10/26 시행과 동시에 처리되도록 한다. 자금 규모는 신청서가 정하고, 이 확약이 정하는 것은 집행 시점이다.',
          effects: [flag('ksfc_collateral_ready')],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'ksfcRequested', gte: 2000 },
              description:
                '담보 평가액을 넘는 신청분이 반려됨 — 업권 배분 자리의 기록으로 남아 신뢰지수 −3',
              effects: [confidence(-3, '담보 평가액 초과 신청 반려'), flag('ksfc_over_requested')],
            },
          ],
          expert: {
            rating: 85,
            rationale:
              '금융위 10/28 점검회의는 증금 3조+α가 10/26부터 집행됐음을 확인한다. 중형사에게 범위가 정확히 일치하는 유일한 창구이고, 집행 순번은 서류 제출 시점이 정한다.',
            historicalNote: '증권금융 지원은 중소형 증권사가 실제로 가장 많이 이용한 창구였다.',
            sourceRefs: [S.fsc1028, S.pkg],
          },
          consequences: '담보 목록과 신청서를 넘겼습니다. 시행 첫날 처리 대상에 올랐습니다.',
          historical: true,
          feasibility: {
            basis: '증권금융 담보 목록 제출은 당일 가능 — 시행일은 10/26',
            sourceRefs: [S.fsc1028],
          },
        },
        {
          id: 't4-d3-b',
          label: '신청서만 제출하고 담보 목록은 다음 주 정리',
          description: '서류 부담을 미룬다. 집행 순번이 뒤로 밀려 11월 첫 주 만기와 겹친다.',
          effects: [confidence(-2, '담보 목록 제출 지연')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '증권금융 집행 순번 지연 — 11월 첫 주 만기와 겹침, 신뢰지수 −3',
              effects: [confidence(-3, '지원 집행 지연'), flag('ksfc_execution_delayed')],
            },
          ],
          expert: {
            rating: 40,
            rationale:
              '발표와 집행의 차이를 이해했다면 서류가 곧 순번이라는 것도 이해해야 한다. 11월 첫 주 만기가 750억인 것은 오늘 이미 알고 있다.',
            sourceRefs: [S.fsc1028, S.bcbs144],
          },
          consequences: '신청서만 접수되었습니다. 담보 심사는 다음 주에 시작됩니다.',
        },
        {
          id: 't4-d3-c',
          label: '보유 A2 PF-ABCP를 담보로 받아 달라고 요청 — 심사 지연',
          description:
            '가장 급한 자산을 담보로 내밀지만 적격 담보 목록에 없다. 심사가 늘어져 시행 첫날을 놓친다.',
          effects: [confidence(-3, '부적격 담보 요청 — 심사 지연')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '부적격 담보 반려 후 재신청 — 집행이 한 주 밀리고 신뢰지수 −3',
              effects: [confidence(-3, '부적격 담보 반려'), flag('ksfc_execution_delayed')],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '지원 창구의 적격 담보 목록은 대책 발표로 바뀌지 않는다. A2 PF-ABCP를 사 주는 창구는 11/24 종투사 매입프로그램까지 존재하지 않았다.',
            sourceRefs: [S.fsc1028, S.prog1124],
          },
          consequences: '요청서를 보냈습니다. 담보관리부가 "적격 목록을 확인해 달라"고 답했습니다.',
          trap: true,
          trapExplanation:
            '"당국이 도우려는 것이니 담보도 유연할 것"이라는 기대는 범위 조항을 읽지 않은 것이다. 정책 창구는 언제나 적격 기준과 함께 온다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d2',
      text: '자금부 메모의 "범위 분석"을 다시 읽으세요. 우리 물량이 적격인 창구는 증권금융뿐입니다.',
    },
    {
      level: 2,
      decisionId: 't4-d2',
      text: '보정 규칙 6.7: 발표 효과는 범위 일치 시 100%, 부분 40%, 불일치 10%. 집행은 주 단위로 늦습니다.',
    },
    {
      level: 3,
      decisionId: 't4-d2',
      text: 'A(증금 신청)는 필수, C(은행 담보대출)는 한은 조치의 간접 경로입니다. D는 함정입니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3, t4]
