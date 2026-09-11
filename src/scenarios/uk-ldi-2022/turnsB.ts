import type { PensionState, Turn } from '../../engine/types'
import { confidence, flag, op, regulator } from '../../engine/fx/common'
import { pensionFx } from '../../engine/fx/pension'
import { ldiFx } from './ldiFx'
import { MAX_LEVERAGE, S } from './turnsA'

type T = Turn<PensionState>

// ---------------------------------------------------------------------------------------------
// T4 — 2022-09-28 (수) 08:30 BST "수요일 아침: 매수호가 실종" (영란은행 발표 이전)
// ---------------------------------------------------------------------------------------------
export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2022년 9월 28일 (수) 08:30 BST',
  title: '수요일 아침: 매수호가 실종',
  time: '2022-09-28T08:30:00+01:00',
  entryEffects: [
    {
      id: 't4-shock',
      description:
        '개장 직후 30년 길트 +5bp(5.10→5.15%, 장중 고점) — 장기물 매수호가 실종. 콜·레버리지 점검, 미충당 시 강제 축소',
      effects: [
        pensionFx.yieldShock({ deltaBp: 5, label: '30년 +5bp (9/28 오전)' }),
        ldiFx.marketMove({ govt2yBp: 5, govt10yBp: 5, creditSpreadIgBp: 10, volIndex: 3 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.08 }),
        confidence(-5, '장기물 시장 기능 상실'),
      ],
    },
    {
      id: 't4-haircut',
      description: '레포 은행이 장기 길트 헤어컷을 인상 → 풀 레포 조달 금리 +50bp',
      effects: [op('institution.assets.ldi.repoRateBp', 'add', 50, '레포 금리(헤어컷 인상 반영)')],
    },
  ],
  events: [
    {
      id: 't4-market',
      kind: 'market',
      time: '08:00',
      headline: '개장 시세',
      items: [
        { label: '30년 길트', value: '5.15%', change: '+5bp — 2002년 이후 최고' },
        { label: '30년 호가 스프레드', value: '호가 없음 구간 발생', change: '9/22 0.5bp' },
        { label: '10년 길트', value: '4.55%', change: '+5bp' },
        { label: 'GBP/USD', value: '1.06', change: '' },
      ],
      sourceRefs: [S.yields, S.qb],
    },
    {
      id: 't4-news-plea',
      kind: 'newswire',
      outlet: 'Financial Times',
      time: '07:15',
      headline:
        'LDI 운용사들, 영란은행·재무부에 "장기물 시장 기능 저하" 알려 — 영란은행은 논평 거부',
      body: '복수의 LDI 운용사와 연기금 컨설턴트가 지난 이틀간 영란은행과 재무부에 장기 길트 시장의 매수호가 실종과 담보 콜 연쇄를 알리고 지원을 요청했다고 FT가 보도했다. 영란은행 대변인은 "논평하지 않는다"고 답했다. 어떤 조치가, 언제 나올지는 알려진 바 없다. 딜러들은 "오늘도 연기금 매도가 이어질 것"이라고 전했다.',
      severity: 'warning',
      reliability: 'unconfirmed',
      sourceRefs: [S.pinter, S.qb],
    },
    {
      id: 't4-memo-manager',
      kind: 'memo',
      time: '08:15',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '[긴급] 4차 콜 — 잔여 담보 소진 시 즉시 축소',
      body: `- 개장 직후 콜은 풀 잔여 담보로 충당했습니다. 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**, 잔여 콜 **{{metric:marginCallPending}}**.
- 레버리지 밴드 초과분은 개장 직후 익스포저 축소로 처리했습니다(로그 확인).
- 오늘 11:00 딜링 컷오프까지 도착하는 현금만 반영됩니다. 이후 도착분은 내일 반영입니다.
- 레포 은행 두 곳이 장기 길트 헤어컷을 2%에서 6%로 올렸습니다. 만기 도래 레포 일부는 롤오버가 어렵습니다.`,
      severity: 'critical',
      sourceRefs: [S.breeden, S.cgfs],
      cardRefs: ['ldi-collateral-waterfall'],
      relatedMetrics: ['collateralHeadroomBp', 'ldiLeverage', 'hedgeRatio', 'marginCallPending'],
    },
    {
      id: 't4-memo-settle',
      kind: 'memo',
      when: { counter: 'saleInstructed_equities', gt: 0 },
      time: '08:20',
      from: '운영팀',
      to: 'CIO',
      subject: '매각 대금 결제 보고',
      body: '월요일 지시분 매각 대금이 오늘 아침 결제되어 풀에 납입되었습니다(해당 시, 로그 참조). 오늘 지시하는 매각은 금요일(9/30) 결제입니다.',
      severity: 'info',
    },
    {
      id: 't4-dialogue-trustee',
      kind: 'dialogue',
      time: '08:25',
      title: '수탁자 의장 통화',
      lines: [
        { speaker: '수탁자 의장', text: '오늘 아침에 우리가 실제로 할 수 있는 게 뭡니까?' },
        {
          speaker: 'CIO',
          text: '11시까지 도착하는 현금만 의미가 있습니다. 당일 현금은 현물 이전 약정, 대기약정이 있는 스폰서, 그리고 길트 매도뿐입니다. 주식·회사채 매각은 금요일 자금입니다.',
        },
        {
          speaker: '수탁자 의장',
          text: '금리가 5%를 넘었으니 헤지를 풀고 펀딩 개선을 확정하자는 위원이 있습니다.',
        },
        {
          speaker: 'CIO',
          text: '그건 담보 문제를 금리 방향 베팅으로 바꾸는 겁니다. 오늘 금리가 어디로 갈지는 아무도 모릅니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.wpc, S.tpr],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '개입 전 마지막 아침',
      prompt: '11:00 컷오프 전에 무엇을 하시겠습니까? (최대 2개; A·D는 함께 선택 불가)',
      context:
        '잔여 담보가 없다면 오늘 오전의 추가 상승은 곧바로 강제 축소입니다. 구속 제약은 지급능력이 아니라 "11시까지 도착하는 현금"입니다.',
      select: { min: 1, max: 2 },
      exclusive: [['t4-a', 't4-d']],
      requiredConcepts: ['ldi-collateral-waterfall', 'ldi-leverage-buffer-250bp'],
      dimensions: ['liquidity', 'marketRisk', 'timeliness'],
      timeLimitSec: 90,
      defaultOptionId: 't4-a',
      options: [
        {
          id: 't4-a',
          label: '운용사 축소 수용, 스폰서에 £300M 출연 요청(이사회 승인 대기)',
          description:
            '당일 담보가 없어 운용사의 익스포저 축소를 받아들이고, 스폰서에 긴급 출연을 요청한다. 대기성 약정이 없으면 스폰서 이사회 승인 후 다음 턴 도착. 실행가능성: 항상 가능.',
          effects: [
            flag('accepted_cuts_t4'),
            confidence(-4, '운용사: 추가 축소 통보'),
            ldiFx.requestSponsor({ amount: 300 }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'sponsorInstructed', gt: 0 },
              description: '스폰서 이사회 승인 후 출연금 도착 → 풀 재자본화',
              effects: [ldiFx.settleSponsor()],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '풀드펀드 투자 스킴 다수의 실제 수요일 아침. 스폰서 요청은 옳지만 승인이 늦어 오전의 축소를 막지 못했다. Breeden은 "통상 1주, 때로 2주" 걸리는 리밸런싱 절차가 강제 매도의 원인이었다고 본다.',
            historicalNote: '실제 다수 스킴이 9/28 오전 운용사의 추가 축소를 통보받았다.',
            sourceRefs: [S.breeden, S.wpc],
          },
          consequences:
            '운용사가 축소를 진행했습니다. 스폰서에 요청서를 보냈습니다(도착 시점은 로그 참조).',
          historical: true,
          feasibility: { basis: '항상 가능; 스폰서 승인 1일', sourceRefs: [S.wpc] },
        },
        {
          id: 't4-b',
          label: '회사채 £400M 매각 지시(T+2 결제, 할인 3%) — 9/30 도착',
          description:
            'IG 회사채를 매각한다. 스프레드 확대로 할인 3%. 대금은 금요일 결제 후 풀에 납입되어 다음 턴 전 반영된다. 오늘 오전에는 도움이 되지 않는다.',
          effects: [ldiFx.instructSale({ asset: 'corporateBonds', amount: 400, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '회사채 £400M T+2(9/30) 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'corporateBonds', amount: 400, discount: 0.03 })],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '길트를 팔지 않고 담보를 만드는 정석이지만 결제 일수 때문에 오늘의 강제 축소는 막지 못한다. 버퍼 재건에는 필요하다.',
            sourceRefs: [S.tpr, S.qb],
          },
          consequences: '회사채 매각이 체결되었습니다. 대금은 금요일 결제됩니다.',
          feasibility: { basis: 'IG 회사채 T+2 결제', sourceRefs: [S.cgfs] },
          calibrationNote:
            '회사채 매각 할인 3% [CAL calibration.md §4: IG 스프레드 +45bp × D7 + 호가]',
        },
        {
          id: 't4-c',
          label: '직접보유 길트 잔량 현물 이전(in-specie)',
          description: '매도 없이 담보 편입. 11시 전 당일 반영. 직접보유 길트가 남아 있어야 한다.',
          requires: {
            all: [{ flag: 'ops_ready' }, { path: 'institution.assets.gilts.marketValue', gt: 0 }],
          },
          unavailableReason:
            '현물 이전 약정이 없거나(T0 운영 준비 미선택) 직접보유 길트가 남아 있지 않습니다.',
          effects: [ldiFx.giltsInSpecie({ amount: 300 })],
          expert: {
            rating: 85,
            rationale: '시장에 무해한 당일 담보. 남은 길트가 있는 한 최선의 오전 조치.',
            sourceRefs: [S.breeden, S.tpr],
          },
          consequences: '현물 이전이 11시 전에 완료되었습니다.',
          feasibility: { basis: 'T0 약정 필요', sourceRefs: [S.tpr] },
        },
        {
          id: 't4-d',
          label: '스폰서 대기약정 £300M 당일 집행',
          description: '사전 서명한 대기성 약정을 집행한다. 요청 당일 풀에 도착한다.',
          requires: {
            all: [
              { flag: 'sponsor_standby' },
              { path: 'institution.sponsor.contributionCapacity', gt: 0 },
            ],
          },
          unavailableReason:
            '대기성 약정이 없거나(T0 미선택) 스폰서 출연 여력이 남아 있지 않습니다.',
          effects: [ldiFx.requestSponsor({ amount: 300 })],
          expert: {
            rating: 75,
            rationale:
              '준비된 스폰서 유동성은 길트를 팔지 않는 당일 담보다(TPR 워터폴). 캐비앳: 커버넌트 의존.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '스폰서 출연금이 당일 풀에 도착했습니다.',
          feasibility: { basis: 'T0 대기 약정 필요', sourceRefs: [S.wpc] },
        },
        {
          id: 't4-e',
          label: '헤지 50% 추가 축소로 5% 금리의 펀딩 개선을 확정',
          description:
            '익스포저 절반을 언와인드한다(할인 10%). 담보 콜이 사라지고, 금리가 5%에 머물면 펀딩비율 개선이 확정된다. 금리가 내리면 부채가 늘어나는 만큼 자산이 따라오지 않는다.',
          effects: [ldiFx.cutHedge({ fraction: 0.5, discount: 0.1, reason: '펀딩 개선 확정' })],
          expert: {
            rating: 5,
            rationale:
              '"펀딩 개선 확정"은 금리가 다시 내리지 않는다는 베팅이다. 사후평가는 헤지 축소가 아니라 헤지를 유지할 담보를 해법으로 제시했고, 헤지를 줄인 스킴은 이후 금리 하락에서 펀딩이 악화되었다(FSR).',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences:
            '익스포저 절반이 최악의 호가에 언와인드되었습니다. 담보 콜은 사라졌지만 헤지비율이 급락했습니다.',
          trap: true,
          trapExplanation:
            '금리가 20년 최고일 때 헤지를 푸는 것은 "이익 확정"처럼 보이지만, 부채 대비 리스크 관리를 버리고 방향 베팅을 사는 것이다. 헤지가 없는 스킴은 금리가 내리는 날 무방비다.',
          irreversible: true,
          calibrationNote: '9/28 오전 언와인드 할인 10% [CAL calibration.md §4]',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '"담보 여력(bp)"과 "마진콜 대기액"을 보세요. 잔여 콜이 있으면 11시 전 현금만 의미가 있습니다.',
    },
    {
      level: 2,
      decisionId: 't4-d1',
      text: '당일 현금: 현물 이전(약정), 대기약정 스폰서, 길트 매도. 회사채 매각은 금요일 자금입니다. 헤지 축소는 담보 문제를 금리 베팅으로 바꿉니다.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: '현물 이전(C)·대기약정 스폰서(D)가 열려 있으면 그것부터. 회사채 매각(B)은 버퍼 재건용입니다. E는 함정입니다.',
    },
  ],
  relatedCards: ['ldi-collateral-waterfall'],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2022-09-28 (수) 17:30 BST "영란은행 개입"
// ---------------------------------------------------------------------------------------------
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2022년 9월 28일 (수) 17:30 BST',
  title: '영란은행 개입: −110bp',
  time: '2022-09-28T17:30:00+01:00',
  entryEffects: [
    {
      id: 't5-boe',
      description:
        '11:00 영란은행 장기 길트 임시 매입 발표 → 30년 −110bp(5.15→4.05%), 사상 최대 일일 하락. 변동증거금 반환, 임시 매입 창구 개방',
      effects: [
        pensionFx.yieldShock({ deltaBp: -110, label: '30년 −110bp (9/28 오후)' }),
        ldiFx.marketMove({ govt2yBp: -30, govt10yBp: -50, creditSpreadIgBp: -15, volIndex: -5 }),
        ldiFx.postFromBuffer('반환 담보 정리'),
        flag('boe_window_open'),
        confidence(12, '영란은행 임시 매입 발표'),
      ],
    },
    {
      id: 't5-unhedged',
      when: { metric: 'hedgeRatio', lt: 70 },
      description: '헤지 부족 상태에서 금리 급락 → 부채 증가분을 자산이 따라오지 못함 (신뢰 −5)',
      effects: [confidence(-5, '수탁자: 언헤지 손실 인식')],
    },
  ],
  events: [
    {
      id: 't5-news-boe',
      kind: 'newswire',
      outlet: 'Bank of England',
      time: '11:00',
      headline:
        '영란은행, 장기 길트 임시 매입 개시 — "시장 기능 회복에 필요한 규모로", 10월 14일까지',
      body: '영란은행은 금융안정 목적으로 9월 28일부터 10월 14일까지 매 영업일 잔존만기 20년 초과 명목 길트를 경매 방식으로 매입한다고 발표했다. 회당 최대 £50억, 총 £650억 한도. APF 보유 길트 매각은 10월 31일로 연기된다. "이 조치는 일시적이며 시한이 정해져 있다." 발표 직후 30년물 금리가 100bp 넘게 급락했다.',
      severity: 'positive',
      sourceRefs: [S.pr0928, S.qb],
      cardRefs: ['ldi-leverage-buffer-250bp'],
    },
    {
      id: 't5-market',
      kind: 'market',
      time: '16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '4.05%', change: '−110bp — 사상 최대 일일 하락' },
        { label: '10년 길트', value: '4.01%', change: '−50bp' },
        { label: '2년 길트', value: '4.45%', change: '−30bp' },
        { label: 'GBP/USD', value: '1.089', change: '+1.5%' },
      ],
      sourceRefs: [S.yields, S.qb],
    },
    {
      id: 't5-memo-manager',
      kind: 'memo',
      time: '17:00',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '담보 반환 및 재자본화 요청 유지 — 임시 매입 종료일 10/14',
      body: `- 금리 하락으로 변동증거금이 반환되어 풀 담보 현금으로 들어왔습니다. 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**.
- 임시 매입은 **10/14 종료** 예정입니다. 종료 후 금리가 다시 오를 수 있어 운용사는 버퍼 목표를 **200bp**로 올리고 재자본화 요청을 유지합니다.
- 고객 지시가 있으면 보유 길트(직접보유·풀 담보)를 영란은행 경매에 매도해 현금화할 수 있습니다. 경매 가격은 시장 호가 대비 할인이 거의 없습니다.
- 축소된 헤지의 복원을 요청하시면 NAV × 3배 한도 안에서 익스포저를 재설정합니다.`,
      severity: 'warning',
      sourceRefs: [S.pr0928, S.qb, S.breeden],
      cardRefs: ['ldi-collateral-waterfall'],
      relatedMetrics: ['collateralHeadroomBp', 'hedgeRatio', 'ldiLeverage'],
    },
    {
      id: 't5-call-consultant-hedged',
      kind: 'call',
      when: { metric: 'hedgeRatio', gte: 70 },
      time: '17:20',
      caller: '투자 컨설턴트',
      callee: 'CIO',
      tone: 'concerned',
      lines: [
        {
          speaker: '컨설턴트',
          text: '헤지를 지킨 스킴은 오늘 부채가 늘어난 만큼 자산이 따라왔습니다. 펀딩비율을 확인해 보십시오. 다만 영란은행은 "시한이 정해져 있다"고 했습니다. 2주 안에 버퍼를 다시 쌓지 못하면 10/14 이후 같은 일이 반복됩니다.',
        },
        { speaker: 'CIO', text: '이 창을 버퍼 재건에 씁니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.fsr, S.qb],
    },
    {
      id: 't5-call-consultant-unhedged',
      kind: 'call',
      when: { metric: 'hedgeRatio', lt: 70 },
      time: '17:20',
      caller: '투자 컨설턴트',
      callee: 'CIO',
      tone: 'urgent',
      lines: [
        {
          speaker: '컨설턴트',
          text: '오늘 부채가 약 20% 늘었는데 헤지가 부족해 자산이 따라오지 못했습니다. 펀딩비율을 확인하십시오. 스폰서가 물어볼 겁니다.',
        },
        { speaker: 'CIO', text: '헤지 복원 비용과 버퍼 재건을 함께 검토하겠습니다.' },
      ],
      severity: 'critical',
      sourceRefs: [S.fsr],
    },
    {
      id: 't5-board',
      kind: 'board',
      time: '18:00',
      headline: '수탁자 긴급회의',
      body: '이사회는 CIO에게 (1) 10/14 이전 버퍼 재건 계획, (2) 축소된 헤지의 복원 여부, (3) 스폰서·TPR 보고를 요구했습니다. 위원 한 명은 "영란은행이 뒤에 있으니 서두를 필요가 없다"고 말했습니다.',
      severity: 'warning',
      sourceRefs: [S.wpc],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '반전 이후: 2주의 창',
      prompt: '임시 매입이 열려 있는 동안 무엇을 하시겠습니까? (최대 2개)',
      context:
        '금리는 내렸고 담보는 돌아왔습니다. 그러나 조치는 10/14에 끝납니다. 창이 열린 동안 만든 담보만이 종료 후를 버팁니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall', 'ldi-leverage-buffer-250bp'],
      dimensions: ['liquidity', 'marketRisk', 'policy', 'communication'],
      options: [
        {
          id: 't5-a',
          label: '주식·회사채 £500M 매각(T+2)해 운용사 요청 버퍼 200bp 재건',
          description:
            '운용사의 상향된 요청대로 성장자산을 매각한다. 금요일(9/30) 결제 후 풀 납입. 할인 1.5%(시장 안정 후).',
          effects: [ldiFx.instructSale({ asset: 'equities', amount: 500, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '주식·크레딧 £500M T+2(9/30) 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'equities', amount: 500, discount: 0.015 })],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '실제 스킴들이 2주 동안 한 일이다(Breeden: 13일간 >£40bn 조달). 옳지만 200bp는 이번 위기의 3거래일 변동(130bp)을 겨우 넘는 수준이며, 성장자산을 파는 대신 길트 경매를 쓰는 편이 싸다.',
            historicalNote: '풀드펀드 운용사들은 9/28 이후 재자본화 요청을 유지·상향했다.',
            sourceRefs: [S.breeden, S.fsr],
          },
          consequences: '매각이 체결되었습니다. 대금은 금요일 결제 후 풀에 납입됩니다.',
          historical: true,
          feasibility: { basis: 'T+2 결제', sourceRefs: [S.wpc] },
        },
        {
          id: 't5-b',
          label: '영란은행 경매에 길트 £300M 매도(운용사 경유, 할인 0.5%)',
          description:
            '직접보유 길트를 먼저, 없으면 풀 담보 길트를 영란은행 경매에 매도해 현금 담보로 바꾼다. 파이어세일 할인 없이 당일 현금이 된다. 실행가능성: 운용사가 고객 지시로 경매 참여 가능.',
          requires: {
            any: [
              { path: 'institution.assets.gilts.marketValue', gt: 0 },
              { path: 'institution.assets.ldi.collateral.eligibleGilts', gt: 0 },
            ],
          },
          unavailableReason: '매도할 길트(직접보유·풀 담보)가 남아 있지 않습니다.',
          effects: [ldiFx.sellIntoBoeAuction({ amount: 300, discount: 0.005 })],
          expert: {
            rating: 80,
            rationale:
              '영란은행 매입의 설계 목적이 바로 이것이다 — 파이어세일 가격이 아닌 질서 있는 가격으로 담보를 현금화할 시간을 주는 것(BoE QB "backstop" 설계 원칙). 실제 13회 경매에서 £193억이 매입되었다.',
            sourceRefs: [S.qb, S.pr0928],
          },
          consequences: '경매 매도가 체결되었습니다. 대금이 풀 담보 현금으로 들어왔습니다.',
          feasibility: { basis: '9/28~10/14 매 영업일 경매', sourceRefs: [S.pr0928] },
          calibrationNote: '경매 매도 할인 0.5% [CAL calibration.md §9: 호가 스프레드 수준]',
        },
        {
          id: 't5-c',
          label: '축소된 헤지를 NAV 3배 한도 안에서 80%까지 복원',
          description:
            '강제·자발 축소로 낮아진 익스포저를 재설정한다. 금리가 내린 뒤라 복원 비용(언헤지 손실)은 이미 실현되었다. 담보 여력(bp)은 익스포저 증가만큼 줄어든다.',
          requires: { metric: 'hedgeRatio', lt: 79 },
          unavailableReason: '헤지비율이 이미 목표(80%) 수준입니다.',
          effects: [ldiFx.restoreHedge({ targetRatio: 0.8, maxLeverage: 3 })],
          expert: {
            rating: 60,
            rationale:
              '부채 대비 리스크 관리를 복구한다. 손실은 이미 났고, 복원하지 않으면 다음 금리 하락에서 같은 손실을 반복한다. 캐비앳: 복원은 담보 여력을 줄이므로 버퍼 재건과 함께 해야 한다.',
            sourceRefs: [S.fsr, S.tpr],
          },
          consequences: '익스포저가 재설정되었습니다. 담보 여력(bp)이 줄었습니다.',
          feasibility: { basis: '운용사 재레버리지 가능(NAV × 3배)', sourceRefs: [S.tpr] },
        },
        {
          id: 't5-d',
          label: '초과 담보를 위기 전 100bp 수준까지 환매해 주식에 재투자',
          description:
            '금리가 내렸으니 돌아온 담보를 성장자산에 다시 넣는다. 영란은행이 시장을 지키는 동안 버퍼는 필요 없다는 판단.',
          effects: [ldiFx.releaseCollateral({ toBufferBp: 100 })],
          expert: {
            rating: 5,
            rationale:
              '영란은행은 발표문에서 "일시적이며 시한이 정해진" 조치라고 명시했다. 실제로 30년물은 10/11까지 다시 5%에 근접했다. 창이 열린 동안 버퍼를 줄이는 것은 두 번째 스파이럴을 예약하는 것이다.',
            sourceRefs: [S.pr0928, S.fsr],
          },
          consequences:
            '담보 초과분이 환매되어 주식에 투자되었습니다. 버퍼가 100bp로 돌아갔습니다.',
          trap: true,
          trapExplanation:
            '"중앙은행이 뒤에 있다"는 안도감이 가장 위험한 순간이다. 임시 매입은 시장 기능을 되살리는 백스톱이지 스킴의 버퍼를 대신하는 것이 아니며, 종료일이 공표되어 있었다.',
          irreversible: true,
        },
        {
          id: 't5-e',
          label: '수탁자·스폰서·TPR에 워터폴·잔여 유동성·재자본화 일정 서면 보고',
          description:
            '담보 워터폴, 잔여 유동자산, 종료일까지의 재자본화 일정을 정리해 이해관계자에게 보낸다. 신뢰를 회복하고 감독 관여를 낮춘다.',
          effects: [
            flag('reported_t5'),
            confidence(5, '이해관계자 서면 보고'),
            regulator({ add: -1 }, '선제 보고로 TPR 관여 완화'),
          ],
          expert: {
            rating: 70,
            rationale:
              'TPR 가이드와 WPC 보고서는 수탁자 거버넌스와 정보 흐름을 회복력의 일부로 본다. 위기 중 검증 가능한 수치를 공유하는 것은 스폰서 지원과 감독 관계 모두에 유리하다.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '보고서가 발송되었습니다. 스폰서 CFO가 "이제 그림이 보인다"고 답했습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '"담보 여력(bp)"이 돌아왔습니다. 그러나 발표문의 종료일(10/14)을 보세요. 종료 후 금리가 오르면 같은 콜이 옵니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '중앙은행 백스톱의 용도: 파이어세일 가격이 아닌 질서 있는 가격으로 담보를 만들 시간. 버퍼를 줄이는 데 쓰면 안 됩니다.',
    },
    {
      level: 3,
      decisionId: 't5-d1',
      text: '경매 매도(B)로 담보를 현금화하고, 보고(E)로 거버넌스를 정리하세요. 헤지가 줄었다면 복원(C)을 검토하세요. D는 함정입니다.',
    },
  ],
  relatedCards: ['ldi-leverage-buffer-250bp'],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2022-10-10~11 (월·화) 21:00 BST "종료 카운트다운"
// ---------------------------------------------------------------------------------------------
export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2022년 10월 10~11일 (월·화) 21:00 BST',
  title: '종료 카운트다운: "3일 남았다"',
  time: '2022-10-11T21:00:00+01:00',
  entryEffects: [
    {
      id: 't6-shock',
      description:
        '9/29~10/11 30년 길트 +95bp(4.05→5.00%) — 임시 매입에도 종료 우려로 재상승. 콜·레버리지 점검, 담보 확대 레포(TECRF) 개방',
      effects: [
        pensionFx.yieldShock({ deltaBp: 95, label: '30년 +95bp (9/29~10/11 누적)' }),
        ldiFx.marketMove({ govt2yBp: 20, govt10yBp: 45, creditSpreadIgBp: 15, volIndex: 4 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.05 }),
        flag('tecrf_open'),
        confidence(-6, '총재 "3일 남았다" 발언·연동채 급락'),
      ],
    },
  ],
  events: [
    {
      id: 't6-news-boe-1010',
      kind: 'newswire',
      outlet: 'Bank of England',
      time: '10/10 07:00',
      headline:
        '영란은행, 회당 매입 한도 £100억으로 상향·담보 확대 레포(TECRF) 신설 — 종료일 10/14 재확인',
      body: '남은 경매의 회당 한도를 £50억에서 £100억으로 올리고, 은행이 LDI 고객의 회사채 등 확대 담보로 자금을 조달할 수 있는 임시 담보 확대 레포(TECRF)를 11/10까지 운영한다. 임시 매입 종료일은 10/14로 변함없다.',
      severity: 'warning',
      sourceRefs: [S.pr1010],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't6-news-boe-1011',
      kind: 'newswire',
      outlet: 'Bank of England',
      time: '10/11 07:00',
      headline: '물가연동채도 임시 매입 대상에 추가 — 연동채 시장 "기능 저하" 대응',
      body: '전날 연동채 장기물이 급락하자 영란은행은 물가연동 길트를 매입 대상에 추가했다. 30년 명목 길트 호가 스프레드는 9/22의 5배인 2.5bp까지 벌어졌다.',
      severity: 'critical',
      sourceRefs: [S.pr1011, S.qb],
    },
    {
      id: 't6-market',
      kind: 'market',
      time: '10/11 16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '5.00%', change: '9/28 종가 대비 +95bp' },
        { label: '30년 호가 스프레드', value: '2.5bp', change: '9/22 0.5bp' },
        { label: '10년 길트', value: '4.46%', change: '+45bp' },
        { label: '2년 길트', value: '4.35%', change: '+20bp' },
      ],
      sourceRefs: [S.yields, S.qb, S.fsr],
    },
    {
      id: 't6-news-bailey',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '10/11 19:45',
      headline: '베일리 총재: "연기금에 3일 남았다… 금요일에 끝난다"',
      body: '워싱턴 IIF 연차총회에서 영란은행 총재는 "내 메시지는 분명하다. 여러분(연기금·LDI 펀드)에게 3일이 남았다. 이 조치는 금요일에 종료된다"고 말했다. 파운드가 하락하고 장기물 선물이 시간외에서 밀렸다.',
      severity: 'critical',
      sourceRefs: [S.bailey],
    },
    {
      id: 't6-memo-manager',
      kind: 'memo',
      time: '10/11 20:00',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '종료 전 마지막 3회 경매(10/12·13·14) — 재자본화 현황',
      body: `- 금리 재상승으로 콜이 다시 발생했고 풀 담보로 충당했습니다. 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**, 잔여 콜 **{{metric:marginCallPending}}**.
- 경매는 수·목·금 3회 남았습니다. 고객 지시로 길트를 경매에 매도할 수 있습니다.
- 은행 경유 담보 확대 레포로 회사채를 담보로 현금을 조달할 수 있습니다(헤어컷 15% 내외, 은행 한도 제한).
- 종료 후 금리가 더 오르면 잔여 담보가 없는 펀드는 즉시 축소합니다.`,
      severity: 'critical',
      sourceRefs: [S.pr1010, S.breeden],
      relatedMetrics: ['collateralHeadroomBp', 'ldiLeverage', 'marginCallPending'],
    },
    {
      id: 't6-call-tpr',
      kind: 'call',
      time: '10/11 17:00',
      caller: 'TPR 감독관',
      callee: '수탁자 의장',
      agency: 'The Pensions Regulator',
      tone: 'concerned',
      lines: [
        {
          speaker: 'TPR',
          text: '수탁자 이사회가 LDI 회복력·유동성·거버넌스를 점검했는지 서면으로 회신해 주십시오. 담보 워터폴, 잔여 유동자산, 운용사와의 운영 절차를 포함해서요. 기한은 금요일입니다.',
        },
        { speaker: '수탁자 의장', text: 'CIO와 정리해 회신하겠습니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.tprStmt, S.lords],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '마지막 3일',
      prompt: '종료 전 3회 경매 동안 무엇을 하시겠습니까? (최대 2개)',
      context:
        '창이 닫히면 파이어세일 가격으로 돌아갑니다. 지금 만든 담보만이 종료 후 상승을 버팁니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall'],
      dimensions: ['liquidity', 'policy', 'timeliness'],
      timeLimitSec: 90,
      defaultOptionId: 't6-a',
      options: [
        {
          id: 't6-a',
          label: '회사채 £400M 추가 매각(T+2)해 버퍼 재건',
          description: 'IG 회사채를 추가로 판다. 대금은 목요일(10/13) 결제 후 풀 납입. 할인 2%.',
          effects: [ldiFx.instructSale({ asset: 'corporateBonds', amount: 400, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '회사채 £400M T+2(10/13) 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'corporateBonds', amount: 400, discount: 0.02 })],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '실제 스킴들의 10월 행동. 버퍼는 늘지만 성장자산을 줄이는 비용이 크고, 경매·레포라는 더 싼 수단이 열려 있었다.',
            historicalNote: 'FSR: LDI 펀드들은 10월 중 버퍼를 300~400bp로 올렸다.',
            sourceRefs: [S.fsr, S.breeden],
          },
          consequences: '매각이 체결되었습니다. 대금은 목요일 결제됩니다.',
          historical: true,
          feasibility: { basis: 'T+2 결제', sourceRefs: [S.wpc] },
        },
        {
          id: 't6-b',
          label: '마지막 경매에 길트 £300M 매도(할인 0.5%)해 담보 현금화',
          description:
            '남은 경매를 이용해 담보 길트를 현금으로 바꾼다. 종료 후에는 이 가격이 없다.',
          requires: {
            any: [
              { path: 'institution.assets.gilts.marketValue', gt: 0 },
              { path: 'institution.assets.ldi.collateral.eligibleGilts', gt: 0 },
            ],
          },
          unavailableReason: '매도할 길트(직접보유·풀 담보)가 남아 있지 않습니다.',
          effects: [ldiFx.sellIntoBoeAuction({ amount: 300, discount: 0.005 })],
          expert: {
            rating: 75,
            rationale:
              '10/10 회당 한도 상향은 마지막 3일에 더 많은 매도를 흡수하려는 설계였다(BoE QB). 창이 닫히기 전 담보를 현금으로 바꾸는 것이 종료 후 헤어컷 인상 리스크를 줄인다.',
            sourceRefs: [S.qb, S.pr1010],
          },
          consequences: '경매 매도가 체결되어 풀 담보 현금이 늘었습니다.',
          feasibility: { basis: '10/12~14 경매', sourceRefs: [S.pr1010] },
        },
        {
          id: 't6-c',
          label: '담보 확대 레포(TECRF) 경유 회사채 £350M 레포로 현금 조달',
          description:
            '은행을 통해 회사채를 담보로 현금을 빌려 풀에 납입한다. 헤어컷 15%. 은행 한도가 제한적이며 11/10까지만 운영된다.',
          requires: {
            all: [
              { flag: 'tecrf_open' },
              { path: 'institution.assets.corporateBonds.marketValue', gt: 0 },
            ],
          },
          unavailableReason: '담보 확대 레포가 열려 있지 않거나 담보로 쓸 회사채가 없습니다.',
          effects: [ldiFx.corpRepoToPool({ collateral: 350, haircut: 0.15 })],
          expert: {
            rating: 65,
            rationale:
              'TECRF는 정확히 이 용도로 설계되었다 — 회사채를 팔지 않고 담보로 현금을 만드는 것. 캐비앳: 은행 대차대조표 한도와 헤어컷, 11/10 종료.',
            sourceRefs: [S.pr1010, S.qb],
          },
          consequences:
            '레포가 실행되어 현금이 풀에 납입되었습니다. 회사채 일부가 담보로 묶였습니다.',
          feasibility: { basis: '10/10~11/10 은행 경유', sourceRefs: [S.pr1010] },
          calibrationNote: '회사채 레포 헤어컷 15% [CAL: CGFS 36 IG 5~10% + 스트레스 가산]',
        },
        {
          id: 't6-d',
          label: '영란은행이 종료를 연장할 것 — 추가 조치 없이 대기',
          description:
            '"시장이 이 상태로 금요일에 끝나게 두지 않을 것"이라는 판단. 아무것도 팔지 않는다.',
          effects: [flag('waited_t6'), confidence(-4, '수탁자: 대기 방침')],
          expert: {
            rating: 10,
            rationale:
              '총재는 같은 날 저녁 "금요일에 끝난다"고 공개적으로 말했고 실제로 예정대로 종료되었다. 중앙은행 백스톱의 시한을 무시하는 것은 시한 자체를 협상 카드로 오해한 것이다.',
            sourceRefs: [S.bailey, S.qb],
          },
          consequences:
            '아무 조치도 취하지 않았습니다. 운용사는 "종료 후 즉시 축소" 방침을 재확인했습니다.',
          trap: true,
          trapExplanation:
            '"연장할 수밖에 없을 것"은 중앙은행 백스톱에 대한 흔한 오판이다. 영란은행은 도덕적 해이를 막기 위해 시한을 공개했고 지켰다. 시한이 있는 창은 시한 안에 써야 한다.',
        },
        {
          id: 't6-e',
          label: '스폰서 잔여 출연 요청',
          description:
            '스폰서 여력이 남아 있으면 요청한다(대기약정 시 당일, 아니면 승인 후 다음 턴).',
          requires: { path: 'institution.sponsor.contributionCapacity', gt: 0 },
          unavailableReason: '스폰서 출연 여력이 남아 있지 않습니다.',
          effects: [ldiFx.requestSponsor({ amount: 300 })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'sponsorInstructed', gt: 0 },
              description: '스폰서 이사회 승인 후 출연금 도착 → 풀 재자본화',
              effects: [ldiFx.settleSponsor()],
            },
          ],
          expert: {
            rating: 60,
            rationale: '길트를 팔지 않는 담보. 커버넌트 의존과 승인 지연이 캐비앳.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '스폰서에 요청했습니다(도착 시점은 로그 참조).',
        },
      ],
    },
    {
      id: 't6-d2',
      title: 'TPR 정보 요청 회신',
      prompt: 'TPR의 회복력·거버넌스 점검 요청에 어떻게 회신하시겠습니까?',
      dimensions: ['compliance', 'communication'],
      options: [
        {
          id: 't6-d2-a',
          label: '회복력·워터폴·거버넌스 점검 결과와 버퍼 상향 계획을 서면 제출',
          description:
            '이번 3주의 콜·충당 내역, 담보 워터폴, 운영 절차 개선(위임·현물 이전), 버퍼 목표 상향 계획을 정리해 기한 내 제출한다.',
          effects: [
            flag('tpr_reported'),
            confidence(3, 'TPR 회신 완료'),
            regulator({ add: -1 }, '점검 결과 제출로 TPR 관여 완화'),
          ],
          expert: {
            rating: 85,
            rationale:
              'TPR은 10월 성명에서 수탁자에게 회복력·유동성·거버넌스 점검을 요구했고, 이후 가이드(2023.4)의 골격이 되었다. 위기 중 거버넌스 기록은 사후 감독 대응의 근거가 된다.',
            sourceRefs: [S.tprStmt, S.tpr, S.wpc],
          },
          consequences: '회신이 제출되었습니다. TPR은 "추가 요청 없음"이라고 답했습니다.',
        },
        {
          id: 't6-d2-b',
          label: '운용사가 배포한 표준 회신서로 대체',
          description:
            '운용사의 고객 공통 회신서에 서명해 보낸다. 스킴 고유의 워터폴·절차는 담기지 않는다.',
          effects: [flag('tpr_template_reply')],
          expert: {
            rating: 35,
            rationale:
              '풀드펀드 투자 스킴 다수의 실제 대응. 위반은 아니지만 WPC·상원은 수탁자가 자기 스킴의 회복력을 스스로 설명하지 못한 점을 거버넌스 결함으로 지적했다.',
            historicalNote: '다수 소규모 스킴이 운용사·컨설턴트 회신에 의존했다.',
            sourceRefs: [S.wpc, S.lords],
          },
          consequences: '표준 회신서가 제출되었습니다.',
          historical: true,
        },
        {
          id: 't6-d2-c',
          label: '회신 보류 — 시장 안정 후 대응',
          description: '지금은 담보가 급하다며 회신을 미룬다.',
          effects: [regulator({ add: 1 }, 'TPR 요청 미회신'), confidence(-3, 'TPR 요청 미회신')],
          expert: {
            rating: 5,
            rationale:
              '감독당국은 회신 지연을 거버넌스 실패로 기록한다. 시간을 버는 것이 아니라 잃는 것이다.',
            sourceRefs: [S.tprStmt, S.lords],
          },
          consequences: '회신이 미뤄졌습니다. TPR이 재촉 서한을 보냈습니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't6-d1',
      text: '"담보 여력(bp)"이 종료 후 상승(수십 bp)을 버틸 수 있습니까? 총재는 "3일"이라고 했습니다.',
    },
    {
      level: 2,
      decisionId: 't6-d1',
      text: '남은 수단: 경매 매도(질서 있는 가격), 담보 확대 레포(회사채를 팔지 않고 현금), 스폰서, 성장자산 매각(T+2).',
    },
    {
      level: 3,
      decisionId: 't6-d1',
      text: '레포(C)와 경매(B)가 가장 싸고 빠릅니다. 대기(D)는 함정입니다.',
    },
    {
      level: 2,
      decisionId: 't6-d2',
      text: '감독당국 회신은 스킴 고유의 워터폴·절차를 담을 때만 의미가 있습니다.',
    },
  ],
  relatedCards: ['ldi-collateral-waterfall', 'regulator-escalation-ladder'],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2022-10-14 (금) 17:30 BST "매입 종료"
// ---------------------------------------------------------------------------------------------
export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2022년 10월 14일 (금) 17:30 BST',
  title: '매입 종료: 다시 5%',
  time: '2022-10-14T17:30:00+01:00',
  entryEffects: [
    {
      id: 't7-shock',
      description:
        '10/12~14 30년 길트 +10bp(5.00→5.10%, 장중 재돌파) — 종료 전 마지막 콜·레버리지 점검',
      effects: [
        pensionFx.yieldShock({ deltaBp: 10, label: '30년 +10bp (10/12~14)' }),
        ldiFx.marketMove({ govt2yBp: -10, govt10yBp: 5, creditSpreadIgBp: 0, volIndex: -2 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.05 }),
        flag('boe_window_closed'),
        confidence(-3, '임시 매입 종료'),
      ],
    },
    {
      id: 't7-tpr-escalate',
      when: { all: [{ flag: 'forced_deleverage' }, { notFlag: 'tpr_reported' }] },
      description: '강제 축소가 있었고 점검 결과를 제출하지 않은 스킴 → TPR 서면 요구 단계 상향',
      effects: [regulator({ add: 1 }, 'TPR 서면 요구(강제 축소·미회신)')],
    },
  ],
  events: [
    {
      id: 't7-news-tpr',
      kind: 'newswire',
      outlet: 'The Pensions Regulator',
      time: '10/12',
      headline:
        'TPR 성명: 수탁자는 LDI 회복력·유동성·거버넌스를 점검하고 운용사와 운영 절차를 확인하라',
      body: 'TPR은 최근 시장 변동성과 관련해 수탁자에게 LDI 약정의 회복력, 담보 조달 유동성, 의사결정 절차를 점검하고 필요 시 자문을 받으라고 요구했다.',
      severity: 'warning',
      sourceRefs: [S.tprStmt],
    },
    {
      id: 't7-news-chancellor',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '14:00',
      headline: '재무장관 경질 — 총리, 법인세 인상 철회 계획을 되돌려',
      body: '총리는 재무장관을 경질하고 새 재무장관을 지명했다. 9/23 성장 계획의 핵심 조치 일부가 철회되었다. 장기물은 오후 들어 되돌림을 보였으나 변동성은 여전히 높다.',
      severity: 'warning',
      sourceRefs: [S.fsr],
    },
    {
      id: 't7-news-final',
      kind: 'newswire',
      outlet: 'Bank of England',
      time: '15:00',
      headline:
        '영란은행 임시 매입 예정대로 종료 — 13회 경매 총 £193억 매입(명목 £121억 + 연동 £72억)',
      body: '총 한도 £650억의 약 30%만 집행되었다. 영란은행은 "시장 기능 회복이라는 목적을 달성했다"고 밝혔다. 매입 길트는 시장 상황을 보아 재매각할 계획이다.',
      severity: 'info',
      sourceRefs: [S.qb],
    },
    {
      id: 't7-market',
      kind: 'market',
      time: '16:30',
      headline: '종료일 시세',
      items: [
        { label: '30년 길트', value: '5.10% (장중 고점)', change: '8/1 대비 +270bp' },
        { label: '10년 길트', value: '4.51%', change: '' },
        { label: '30년 호가 스프레드', value: '≈2bp', change: '' },
      ],
      sourceRefs: [S.yields, S.fsr],
    },
    {
      id: 't7-memo-manager',
      kind: 'memo',
      time: '17:00',
      from: 'LDI 운용사',
      to: 'CIO · 수탁자 의장',
      subject: '임시 매입 종료 — 풀 최종 현황 및 버퍼 목표 재설정 요청',
      body: `- 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**, 펀딩비율 **{{metric:fundingRatio}}**.
- 종료 후에도 30년물은 5% 부근입니다. 업계 운용사들은 풀 버퍼 목표를 **300~400bp**로 올리고 있습니다.
- 수탁자 이사회는 (1) 사후 버퍼 목표, (2) 축소된 헤지의 복원 여부를 결의해 주십시오. 목표 버퍼까지의 재자본화는 워터폴(현금 → 길트 → 회사채 → 주식) 순으로 집행합니다.`,
      severity: 'warning',
      sourceRefs: [S.fsr, S.breeden],
      relatedMetrics: ['collateralHeadroomBp', 'hedgeRatio', 'fundingRatio'],
    },
    {
      id: 't7-board',
      kind: 'board',
      time: '17:15',
      headline: '수탁자 이사회 — 사후 방침 결의',
      body: '이사회는 3주간의 콜·충당·축소 내역을 보고받았습니다. 안건은 두 가지입니다: 버퍼를 얼마나 둘 것인가, 헤지를 어떻게 할 것인가. 한 위원은 "위기는 끝났으니 성장자산으로 돌아가자"고, 다른 위원은 "다음 위기는 더 클 수 있다"고 말했습니다.',
      severity: 'info',
      sourceRefs: [S.wpc],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '헤지 복원 여부',
      prompt: '축소된 헤지를 어떻게 하시겠습니까?',
      context:
        '헤지비율이 80% 아래입니다. 복원하면 부채 대비 리스크가 줄지만 담보 여력(bp)이 줄어듭니다.',
      when: { metric: 'hedgeRatio', lt: 79 },
      requiredConcepts: ['ldi-leverage-buffer-250bp'],
      dimensions: ['marketRisk', 'solvency'],
      options: [
        {
          id: 't7-d1-a',
          label: '80%까지 복원(NAV 3배 한도) — 버퍼는 D2에서 재설정',
          description:
            '금리가 높을 때 헤지를 되사면 부채 대비 비용이 낮다. 익스포저가 늘어 담보 여력(bp)은 줄어든다.',
          effects: [ldiFx.restoreHedge({ targetRatio: 0.8, maxLeverage: 3 })],
          expert: {
            rating: 70,
            rationale:
              '헤지의 목적은 부채 대비 변동성 제거다. 높은 금리에서의 복원은 이후 금리 하락(11월 이후)에서 펀딩을 지켰다. 복원 후 버퍼 재설정이 뒤따라야 한다.',
            historicalNote: '많은 스킴이 10~11월 높은 금리에서 헤지를 단계적으로 복원했다.',
            sourceRefs: [S.fsr, S.tpr],
          },
          consequences: '익스포저가 재설정되었습니다.',
          historical: true,
        },
        {
          id: 't7-d1-b',
          label: '축소된 헤지 유지 — 금리 추가 상승 대비',
          description:
            '복원하지 않는다. 금리가 더 오르면 펀딩이 개선되지만, 내리면 부채가 자산보다 빨리 늘어난다.',
          effects: [flag('hedge_kept_reduced')],
          expert: {
            rating: 40,
            rationale:
              '위기 중 축소된 헤지를 방치하는 것은 방향 베팅의 연장이다. 사후평가는 헤지 유지를 전제로 담보 회복력을 요구했다.',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences: '헤지비율이 유지되었습니다.',
        },
        {
          id: 't7-d1-c',
          label: '헤지 25% 추가 축소 — 변동성 회피',
          description: '변동성이 여전히 높으니 익스포저를 더 줄인다(할인 2%).',
          effects: [ldiFx.cutHedge({ fraction: 0.25, discount: 0.02, reason: '변동성 회피' })],
          expert: {
            rating: 20,
            rationale: '위기가 끝난 뒤 헤지를 더 줄이는 것은 이번 위기의 교훈과 반대다.',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences: '익스포저가 추가로 축소되었습니다.',
        },
      ],
    },
    {
      id: 't7-d2',
      title: '사후 담보버퍼 목표',
      prompt: '풀 담보버퍼 목표를 얼마로 결의하시겠습니까?',
      context:
        '목표까지의 재자본화는 워터폴 순으로 즉시 집행됩니다. 버퍼가 클수록 성장자산이 줄어 기대수익이 낮아지지만, 다음 충격을 자력으로 버팁니다.',
      requiredConcepts: ['ldi-leverage-buffer-250bp'],
      dimensions: ['liquidity', 'marketRisk', 'policy'],
      options: [
        {
          id: 't7-d2-a',
          label: '120bp로 복귀 — 성장자산 비중 회복',
          description: '위기 전 수준으로 돌아간다. 초과 담보는 환매해 주식에 재투자한다.',
          effects: [ldiFx.releaseCollateral({ toBufferBp: 120 })],
          expert: {
            rating: 5,
            rationale:
              '이번 위기가 3거래일에 130bp였다. 120bp는 방금 소진된 버퍼다. BoE·TPR·IMF 사후평가 모두 위기 전 버퍼가 불충분했다고 결론지었다.',
            sourceRefs: [S.staff, S.imf],
          },
          consequences: '초과 담보가 환매되어 주식에 투자되었습니다. 버퍼 120bp.',
          trap: true,
          trapExplanation:
            '"위기는 끝났다"는 판단이 다음 위기의 첫 조건이다. 버퍼는 지난 변동이 아니라 다음 변동을 견뎌야 한다.',
          irreversible: true,
        },
        {
          id: 't7-d2-b',
          label: '200bp — 이번 위기 3거래일 변동(130bp) 초과 수준',
          description:
            '이번 충격을 한 번 더 흡수할 수 있는 수준. 재자본화는 워터폴 순으로 집행된다.',
          effects: [
            ldiFx.topUpBuffer({
              targetBp: 200,
              giltDiscount: 0.01,
              corpDiscount: 0.01,
              equityDiscount: 0.01,
            }),
          ],
          expert: {
            rating: 45,
            rationale:
              '130bp 충격은 한 번 버티지만 운영 지연(재자본화 5영업일)과 헤어컷 인상을 고려하면 여유가 없다. 이후 정해진 최소 기준에 미달한다.',
            sourceRefs: [S.staff, S.tpr],
          },
          consequences: '버퍼 200bp까지 재자본화가 집행되었습니다.',
        },
        {
          id: 't7-d2-c',
          label: '250bp + 운영 버퍼 50bp — 3거래일 130bp 충격의 2배와 5일 보충 지연',
          description:
            '시장 스트레스 버퍼 250bp에 재자본화 소요(5영업일) 동안의 추가 변동을 흡수할 운영 버퍼 50bp를 더한다. 유효 300bp. 재자본화는 워터폴 순으로 집행된다.',
          effects: [
            ldiFx.topUpBuffer({
              targetBp: 300,
              giltDiscount: 0.01,
              corpDiscount: 0.01,
              equityDiscount: 0.01,
            }),
          ],
          expert: {
            rating: 80,
            rationale:
              '이후 FPC(2023.3)가 정한 최소 회복력 250bp와 TPR 가이드(2023.4)의 "250bp + 운영 버퍼, 담보 보충 5일 가정"에 정확히 대응하는 설계. 근거: 2022년 9월 3거래일 변동(130bp)의 약 2배에 운영 지연을 더한 값.',
            sourceRefs: [S.staff, S.tpr],
          },
          consequences: '버퍼 300bp(250 + 운영 50)까지 재자본화가 집행되었습니다.',
        },
        {
          id: 't7-d2-d',
          label: '운용사 표준 350bp(300~400bp 밴드)로 재자본화',
          description:
            '업계 운용사들이 10월에 올린 수준. 성장자산이 더 줄어든다. 재자본화는 워터폴 순으로 집행된다.',
          effects: [
            ldiFx.topUpBuffer({
              targetBp: 350,
              giltDiscount: 0.01,
              corpDiscount: 0.01,
              equityDiscount: 0.01,
            }),
          ],
          expert: {
            rating: 70,
            rationale:
              '실제 업계 대응(FSR 2022.12: 300~400bp). 회복력은 충분하지만 FPC는 이후 250bp를 최소 기준으로 정했고, 초과분은 기대수익 비용이다. 견고하되 다소 과도한 선택.',
            historicalNote: 'LDI 운용사들은 10월 중 버퍼를 300~400bp로 올렸다.',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences: '버퍼 350bp까지 재자본화가 집행되었습니다.',
          historical: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't7-d2',
      text: '이번 위기의 3거래일 변동은 130bp였고, 재자본화에는 5영업일이 걸렸습니다. 버퍼는 그 둘을 함께 견뎌야 합니다.',
    },
    {
      level: 3,
      decisionId: 't7-d2',
      text: '250bp + 운영 버퍼(C)가 근거 있는 기준입니다. 120bp 복귀(A)는 함정입니다.',
    },
    {
      level: 2,
      decisionId: 't7-d1',
      text: '헤지 복원은 담보 여력(bp)을 줄입니다. 복원 후 버퍼 목표(D2)로 다시 채우세요.',
    },
  ],
  relatedCards: ['ldi-leverage-buffer-250bp'],
}

export const turnsB: T[] = [t4, t5, t6, t7]
