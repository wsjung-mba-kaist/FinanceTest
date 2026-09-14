import type { PensionState, Turn } from '../../engine/types'
import { confidence, flag, fnEffect, op, regulator } from '../../engine/fx/common'
import { pensionFx } from '../../engine/fx/pension'
import { bufferBpOf, ldiFx, pv01Of } from './ldiFx'

type T = Turn<PensionState>

export const S = {
  qb: 'boe-qb-2023-gilt',
  staff: 'boe-ldi-staff-paper-2023',
  tpr: 'tpr-ldi-guidance-2023',
  breeden: 'boe-breeden-2022',
  imf: 'imf-wp-2023-210',
  fsr: 'boe-fsr-2022-12',
  pr0928: 'boe-pr-2022-09-28',
  pr1010: 'boe-pr-2022-10-10',
  pr1011: 'boe-pr-2022-10-11',
  mpc: 'boe-mpc-2022-09-22',
  gov0926: 'boe-statement-2022-09-26',
  growth: 'hmt-growth-plan-2022',
  purple: 'ppf-purple-book-2022',
  wpc: 'wpc-ldi-report-2023',
  lords: 'lords-ldi-report-2023',
  tprStmt: 'tpr-statement-2022-10-12',
  pinter: 'boe-swp-1019-pinter-2023',
  bailey: 'bailey-2022-10-11-press',
  yields: 'boe-yield-curves',
  cgfs: 'cgfs-36',
}

/** 강제 디레버리징 트리거: 풀 레버리지 상한 4.5x [CAL calibration.md §3] */
export const MAX_LEVERAGE = 4.5

// ---------------------------------------------------------------------------------------------
// T0 — 2022-09-19~22 (프롤로그) "미니예산 전야"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2022년 9월 19~22일 (월~목) 프롤로그',
  title: '프롤로그: 미니예산 전야',
  time: '2022-09-22T17:00:00+01:00',
  events: [
    {
      id: 't0-news-mpc',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '9/22 12:00',
      headline: '영란은행, 기준금리 50bp 인상해 2.25% — 보유 길트 매각(QT) 10월 개시 확정',
      body: 'MPC는 5대4로 50bp 인상을 결정했다(3명은 75bp 주장). 자산매입기금(APF) 보유 길트를 12개월간 £800억 줄이기로 했으며 능동 매각은 10월 초 시작된다. 내일 재무장관은 "성장 계획"을 발표한다.',
      severity: 'warning',
      sourceRefs: [S.mpc],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '9/22 16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '3.80%', change: '8/1 대비 +135bp' },
        { label: '10년 길트', value: '3.50%', change: '8/1 대비 +165bp' },
        { label: '2년 길트', value: '3.50%', change: '' },
        { label: 'GBP/USD', value: '1.125', change: '1985년 이후 최저권' },
      ],
      sourceRefs: [S.yields],
    },
    {
      id: 't0-memo-ldi',
      kind: 'memo',
      time: '9/20 10:00',
      from: 'LDI 운용사 고객담당',
      to: 'CIO',
      subject: '분기 리밸런싱 안내 및 담보버퍼 현황',
      body: `- 노스브리지 풀드 LDI 펀드: 익스포저 £4,200M, NAV £1,400M(레버리지 3.0x), 유동 담보 £907M = **120bp**.
- 펀드 레버리지 밴드 상한 4.5x 초과 시 규정상 리밸런싱(익스포저 축소)이 자동 실행됩니다. 재자본화 요청 시 통상 **5영업일** 내 자금 도착을 가정합니다.
- 펀드 신규 납입은 **현금만** 가능하며 딜링 사이클은 T+1(오전 11시 컷오프)입니다. 현물(길트) 이전은 별도 약정이 필요합니다.
- 8월 이후 금리 상승으로 버퍼가 200bp에서 120bp로 줄었습니다. 분기 리밸런싱은 10월 말 예정입니다.`,
      severity: 'warning',
      sourceRefs: [S.staff, S.breeden, S.tpr],
      cardRefs: ['ldi-leverage-buffer-250bp', 'ldi-collateral-waterfall'],
      relatedMetrics: ['collateralHeadroomBp', 'ldiLeverage'],
    },
    {
      id: 't0-memo-consultant',
      kind: 'memo',
      time: '9/21 15:00',
      from: '투자 컨설턴트',
      to: '수탁자 투자위원회',
      subject: '9/23 "성장 계획" 관련 리스크 노트',
      body: `- 시장은 재원 없는 감세 규모를 £300억 안팎으로 예상합니다. OBR 전망이 동반되지 않을 경우 장기물 변동성이 커질 수 있습니다.
- 스킴 펀딩비율 98%(TP 기준). 헤지비율 80%. 금리 상승은 펀딩에 유리하지만 **담보 콜은 현금으로 즉시** 나갑니다.
- 스킴 현금 £150M, 직접보유 길트 £600M, 회사채 £1,000M, 주식 £1,000M, 비유동 £750M.
- 주식·회사채 매각은 T+2 결제, 비유동자산은 수 주가 걸립니다.`,
      sourceRefs: [S.purple, S.wpc],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't0-call-sponsor',
      kind: 'call',
      time: '9/21 17:00',
      caller: '스폰서 CFO',
      callee: 'CIO',
      tone: 'routine',
      lines: [
        {
          speaker: '스폰서 CFO',
          text: '회수계획 분담금은 예정대로 냅니다. 긴급 출연이 필요하면 이사회 승인이 필요하니 미리 말씀해 주십시오. 승인에는 보통 며칠 걸립니다.',
        },
        { speaker: 'CIO', text: '대기성 약정 형태로 미리 서명해 두는 방안을 검토하겠습니다.' },
      ],
      severity: 'info',
      sourceRefs: [S.wpc],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '위기 전 준비 패키지',
      prompt:
        '미니예산 발표 전, 이번 주에 무엇을 해 두시겠습니까? (최대 3개; A는 단독 선택, B·D는 동시 선택 불가)',
      context:
        '9/19~22 준비 기간을 묶은 프롤로그입니다. 이 구간의 즉시 효과는 기간 중 준비·체결·결제가 완료됐다는 훈련 가정이며, 9/22 장 마감 후 신규 지시가 다음 날 결제된다는 뜻은 아닙니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t0-a', 't0-b'],
        ['t0-a', 't0-c'],
        ['t0-a', 't0-d'],
        ['t0-a', 't0-e'],
        ['t0-a', 't0-f'],
        ['t0-d', 't0-b'],
      ],
      requiredConcepts: ['ldi-leverage-buffer-250bp', 'ldi-collateral-waterfall'],
      dimensions: ['liquidity', 'timeliness', 'marketRisk'],
      options: [
        {
          id: 't0-a',
          label: '현행 유지: 버퍼 120bp·레버리지 3x, 10월 분기 리밸런싱 대기',
          description:
            '운용사 안내대로 분기 리밸런싱을 기다린다. 비용도 변화도 없다. 버퍼 120bp는 2000년 이후 최대 일일 변동(29bp)의 4배다.',
          effects: [flag('status_quo')],
          expert: {
            rating: 25,
            rationale:
              'BoE 스태프 페이퍼는 위기 전 다수 풀드펀드가 100~150bp 버퍼를 들고 있었고 이것이 "3거래일 130bp"에 소진되었다고 기록한다. 8월 이후 이미 135bp가 오른 상태에서 재정 이벤트 전날 버퍼를 방치한 것은 사후평가상 핵심 취약점이다.',
            historicalNote: '다수 풀드펀드 투자 스킴의 실제 상태. 재자본화는 위기 중에 시작되었다.',
            sourceRefs: [S.staff, S.breeden],
          },
          consequences: '변경 없음. 운용사는 10월 말 리밸런싱 일정을 확인했습니다.',
          historical: true,
          feasibility: { basis: '기본 상태 유지', sourceRefs: [S.staff] },
        },
        {
          id: 't0-b',
          label: '버퍼 사전 확충: 주식 £450M 매각해 풀에 납입, 버퍼 120→180bp',
          description:
            '주식 £450M 매각(할인 1%)과 풀 납입이 프롤로그 준비 기간 중 완료됐다고 가정한다. 주식 비중이 약 20%→11%로 줄고 기대수익이 낮아진다. 실제로는 체결일·T+2 결제·풀 T+1 딜링을 역산해야 한다.',
          effects: [
            ldiFx.settleSale({ asset: 'equities', amount: 450, discount: 0.01 }),
            flag('buffer_prepared'),
          ],
          expert: {
            rating: 80,
            rationale:
              '버퍼의 가치는 위기 전에만 만들 수 있다. FPC는 사후에 최소 250bp를 요구했고 위기 전 업계 버퍼(100~150bp)가 불충분했다고 결론지었다. 다만 9/22 시점에 180bp도 130bp 충격을 겨우 흡수하는 수준이라는 캐비앳이 있다.',
            sourceRefs: [S.staff, S.fsr],
          },
          consequences:
            '주식 매각이 결제되고 풀 납입이 완료되었습니다. 담보 여력이 늘었고 레버리지가 낮아졌습니다.',
          feasibility: {
            basis: '평시 주식 T+2 결제 + 풀 T+1 딜링',
            sourceRefs: [S.tpr],
          },
          calibrationNote:
            '평시 매각 할인 1% [CAL]; 450 × 0.99 = 445.5 납입 → 담보 1,352 / PV01 7.56 ≈ 179bp, 레버리지 2.3x',
        },
        {
          id: 't0-c',
          label: '담보 운영 준비: 현물(in-specie) 이전 약정·당일 딜링·CIO 위임 권한 확보',
          description:
            '운용사와 직접보유 길트를 담보로 현물 이전하는 약정을 맺고, 긴급 시 위원회 소집 없이 CIO가 £500M까지 집행하도록 수탁자 위임을 받는다. 비용은 법무·운영 비용뿐이다.',
          effects: [flag('ops_ready')],
          expert: {
            rating: 85,
            rationale:
              'TPR 2023 가이드는 담보 워터폴·운영 절차·위임 권한을 수탁자 회복력의 핵심으로 명시한다. WPC·상원 보고서는 풀드펀드 투자 스킴의 "며칠 걸리는 승인과 딜링 사이클"이 강제 매도의 직접 원인이었다고 평가한다.',
            sourceRefs: [S.tpr, S.wpc, S.lords],
          },
          consequences:
            '현물 이전 약정과 위임 권한이 문서화되었습니다. 이후 길트 현물 이전과 현금 송금이 당일 반영됩니다.',
          feasibility: {
            basis: '세그리게이티드 계좌에서는 표준 약정; 풀드펀드도 운용사 동의로 가능',
            sourceRefs: [S.tpr],
          },
        },
        {
          id: 't0-d',
          label: '레버리지 4x로 상향, 버퍼 80bp로 축소해 성장자산 확대',
          description:
            '풀에서 £350M을 환매해 주식에 투자한다. 같은 헤지를 더 적은 자본으로 유지해 기대수익을 높인다. 버퍼는 80bp로 줄지만 여전히 역대 최대 일일 변동의 2.7배다.',
          effects: [
            fnEffect<PensionState>('leverUp', { targetLeverage: 4, bufferBp: 80 }, (d, ctx) => {
              const s = d.institution
              const ldi = s.assets.ldi
              const targetEquity = ldi.exposure / 4
              const release = Math.max(0, ldi.equity - targetEquity)
              ldi.equity = targetEquity
              const targetColl = 80 * pv01Of(ldi)
              const cur = ldi.collateral.cash + ldi.collateral.eligibleGilts
              const scale = cur > 0 ? Math.min(1, targetColl / cur) : 1
              ldi.collateral.cash *= scale
              ldi.collateral.eligibleGilts *= scale
              s.assets.equities += release
              ctx.log(
                `레버리지 4x 상향: NAV ${ldi.equity.toFixed(0)}, 담보 ${(ldi.collateral.cash + ldi.collateral.eligibleGilts).toFixed(0)} (${bufferBpOf(ldi).toFixed(0)}bp), 주식 +${release.toFixed(0)}`,
              )
            }),
            flag('levered_up'),
          ],
          expert: {
            rating: 5,
            rationale:
              '"역대 최대 변동의 몇 배"라는 논리는 2022년 9월에 무너졌다 — 실제 변동은 역대 최대의 4배 이상이었다. 4x 펀드는 첫날 35bp에서 이미 리밸런싱 밴드를 넘는다. IMF·BoE 사후평가 모두 높은 레버리지 풀드펀드를 스파이럴의 진앙으로 지목한다.',
            sourceRefs: [S.staff, S.imf],
          },
          consequences:
            '풀 환매 대금이 주식에 투자되었습니다. 레버리지 4.0x, 버퍼 80bp. 운용사는 리밸런싱 밴드 상한이 가까워졌다고 경고했습니다.',
          trap: true,
          trapExplanation:
            '자본 효율은 평시의 미덕이다. 담보버퍼는 "역대 최대 변동"이 아니라 "다음 변동"을 견뎌야 하며, 레버리지가 높을수록 같은 충격에 NAV가 더 빨리 소진된다(3x: 130bp에 NAV 70% 손실, 4x: 90% 손실).',
          irreversible: true,
          feasibility: { basis: '풀 환매는 T+1 NAV로 가능', sourceRefs: [S.tpr] },
          calibrationNote: 'NAV 1,400→1,050 (4.0x), 담보 907→605 (80bp) [CAL]',
        },
        {
          id: 't0-e',
          label: '스폰서와 £300M 대기성 출연 약정(standby) 사전 서명',
          description:
            '스폰서 이사회가 미리 승인한 대기성 약정으로, 위기 시 요청 당일 송금된다. 스폰서 출연 여력이 £300M에서 £600M으로 늘고 승인 지연이 없어진다.',
          effects: [
            flag('sponsor_standby'),
            op('institution.sponsor.contributionCapacity', 'add', 300),
          ],
          expert: {
            rating: 70,
            rationale:
              'TPR 가이드는 스폰서 유동성 지원을 담보 워터폴의 한 층으로 인정한다. 다만 커버넌트에 의존하며, 위기 중 스폰서 자체 자금조달이 어려울 수 있다는 캐비앳(WPC)이 있다.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '스폰서 이사회가 대기성 약정을 승인했습니다. 요청 당일 집행 가능합니다.',
          feasibility: { basis: '스폰서 이사회 사전 승인 필요(1주)', sourceRefs: [S.wpc] },
        },
        {
          id: 't0-f',
          label: '헤지비율 80→60% 선제 축소 — 감세 발표 전 금리 상승 베팅',
          description:
            '풀 익스포저의 25%를 언와인드한다. 담보 콜 노출이 줄고 금리가 오르면 펀딩비율이 개선된다. 그러나 금리가 반전하면 언헤지 손실이 난다.',
          effects: [ldiFx.cutHedge({ fraction: 0.25, discount: 0.005, reason: '선제 축소' })],
          expert: {
            rating: 35,
            rationale:
              '거시 베팅으로 헤지를 줄이는 것은 수탁자 리스크 관리가 아니라 투기다. 이번 주에는 맞았겠지만 9/28 오후 30년 −100bp 반전에서 언헤지 손실이 난다. 사후평가는 "헤지를 유지할 수 있는 담보"를 해법으로 제시했지, 헤지 축소를 제시하지 않았다.',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences: '익스포저 25%가 언와인드되어 헤지비율이 60%로 낮아졌습니다.',
          calibrationNote: '평시 언와인드 할인 0.5% [CAL]',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "담보 여력(bp)"과 "LDI 레버리지"를 보세요. 120bp는 지난 두 달 상승폭(135bp)보다 작습니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '담보 워터폴 원칙: 구속 제약은 지급능력이 아니라 "며칠 안에 현금이 도착하는가"입니다. 버퍼(B)와 운영 준비(C)는 서로 다른 제약을 풉니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: 'C(운영 준비)는 비용이 거의 없고 이후 모든 턴의 당일 선택지를 살립니다. B(버퍼 확충)·E(스폰서 대기 약정)와 함께 고려하세요. D는 함정입니다.',
    },
  ],
  relatedCards: ['ldi-leverage-buffer-250bp', 'hqla-and-haircuts'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2022-09-23 (금) 17:30 BST "미니예산"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2022년 9월 23일 (금) 17:30 BST',
  title: '미니예산',
  time: '2022-09-23T17:30:00+01:00',
  entryEffects: [
    {
      id: 't1-shock',
      description:
        '미니예산 반응: 30년 길트 +35bp(3.80→4.15%), 2년 +40bp, 10년 +33bp → LDI 풀 마진콜',
      effects: [
        pensionFx.yieldShock({ deltaBp: 35, label: '30년 +35bp (9/23)' }),
        ldiFx.marketMove({ govt2yBp: 40, govt10yBp: 33, creditSpreadIgBp: 10, volIndex: 3 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.02 }),
        confidence(-5, '미니예산 충격'),
      ],
    },
  ],
  events: [
    {
      id: 't1-news-budget',
      kind: 'newswire',
      outlet: 'Financial Times',
      time: '09:30',
      headline: '재무장관, £450억 감세 "성장 계획" 발표 — OBR 전망 없이, 차입 급증',
      body: '소득세 기본세율 인하, 45% 최고세율 폐지, 국민보험 인상 철회, 인지세 인하가 발표되었다. 재원은 차입이다. 길트 시장은 즉각 매도로 반응했고 파운드는 1.09달러 아래로 떨어졌다.',
      severity: 'critical',
      sourceRefs: [S.growth],
    },
    {
      id: 't1-market',
      kind: 'market',
      time: '16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '4.15%', change: '+35bp' },
        { label: '10년 길트', value: '3.83%', change: '+33bp' },
        { label: '2년 길트', value: '3.90%', change: '+40bp' },
        { label: 'GBP/USD', value: '1.086', change: '−3.5%' },
      ],
      sourceRefs: [S.yields],
    },
    {
      id: 't1-memo-call',
      kind: 'memo',
      time: '17:05',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '[긴급] 담보 콜 및 재자본화 요청 — 기한 9/27(화) 11:00',
      body: `- 오늘 금리 상승으로 풀에 변동증거금 콜 {{metric:marginCallPending}} 발생분은 풀 자체 담보로 충당했습니다.
- 현재 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**.
- 버퍼를 120bp로 복원하기 위한 **재자본화 요청**을 송부합니다. 납입은 현금만, 딜링 컷오프 오전 11시(T+1 반영).
- 레버리지가 4.5x를 넘으면 펀드 규정에 따라 익스포저를 축소(길트 매도)합니다.`,
      severity: 'critical',
      sourceRefs: [S.tpr, S.breeden],
      cardRefs: ['ldi-collateral-waterfall'],
      relatedMetrics: ['collateralHeadroomBp', 'ldiLeverage', 'marginCallPending'],
    },
    {
      id: 't1-memo-secretary',
      kind: 'memo',
      time: '17:20',
      from: '스킴 사무국',
      to: 'CIO',
      subject: '투자위원회 일정',
      body: '정기 투자위원회는 월요일(9/26) 오후입니다. 위임 권한이 없으면 £100M 이상 집행은 위원회 결의가 필요합니다. 주식·회사채 매각은 오늘 지시해도 T+2(화요일) 결제입니다.',
      severity: 'warning',
      sourceRefs: [S.wpc],
    },
    {
      id: 't1-memo-ops-ready',
      kind: 'memo',
      when: { flag: 'ops_ready' },
      time: '17:25',
      from: '운영팀',
      to: 'CIO',
      subject: '현물 이전 약정·위임 권한 활성',
      body: '지난주 체결한 약정에 따라 직접보유 길트를 오늘 중 풀 담보로 이전할 수 있고, CIO 권한으로 £500M까지 당일 집행이 가능합니다.',
      severity: 'positive',
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '첫 담보 콜 대응',
      prompt: '오늘 저녁 무엇을 하시겠습니까? (최대 2개; A는 단독 선택)',
      context:
        '운용사의 기한은 화요일 오전입니다. 월요일에 금리가 더 오르면 콜은 더 커집니다. 지금 지시하는 매각은 화요일에 결제됩니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t1-a', 't1-b'],
        ['t1-a', 't1-c'],
        ['t1-a', 't1-d'],
        ['t1-a', 't1-e'],
      ],
      requiredConcepts: ['ldi-collateral-waterfall'],
      dimensions: ['liquidity', 'timeliness'],
      timeLimitSec: 120,
      defaultOptionId: 't1-a',
      options: [
        {
          id: 't1-a',
          label: '월요일 투자위원회까지 대기 — 운용사 요청 검토',
          description:
            '컨설턴트 자문을 받아 월요일 위원회에서 결정한다. 오늘 실행되는 것은 없다. 실행가능성: 항상 가능.',
          effects: [flag('waited_t1'), confidence(-3, '운용사: 대응 지연 우려')],
          expert: {
            rating: 15,
            rationale:
              'WPC·상원 보고서와 Breeden 연설은 "며칠 걸리는 수탁자 승인"이 풀드펀드 강제 매도의 직접 원인이었다고 본다. 금요일 저녁의 하루는 화요일의 이틀과 같다.',
            historicalNote:
              '다수 스킴의 실제 대응. 월요일 오후에야 매각 지시가 나갔고 대금은 수요일에 도착했다.',
            sourceRefs: [S.wpc, S.breeden],
          },
          consequences:
            '위원회 자료를 준비했습니다. 운용사는 "월요일 시장이 열리면 다시 연락하겠다"고 했습니다.',
          historical: true,
        },
        {
          id: 't1-b',
          label: '스킴 현금 £150M 즉시 풀에 송금',
          description:
            '보유 현금 전액을 풀에 납입한다. 위임 권한·당일 딜링(운영 준비)이 있으면 오늘 반영, 없으면 월요일 위원회 승인 후 화요일 반영(T+1).',
          effects: [ldiFx.instructCash({ amount: 150 })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'cashInstructed', gt: 0 },
              description: '현금 송금 T+1 결제 — 풀 담보 반영',
              effects: [ldiFx.settleInstructedCash()],
            },
          ],
          expert: {
            rating: 80,
            rationale:
              '현금은 워터폴의 첫 층이다. TPR 가이드의 담보 워터폴은 "현금 → 적격 길트 → 유동자산 매각 → 스폰서" 순이며, 첫 층은 즉시 써야 의미가 있다.',
            sourceRefs: [S.tpr, S.staff],
          },
          consequences: '송금 지시가 나갔습니다. 반영 시점은 운영 준비 여부에 따릅니다(로그 참조).',
          feasibility: { basis: '스킴 현금 즉시 송금; 위임 권한 없으면 T+1', sourceRefs: [S.tpr] },
        },
        {
          id: 't1-c',
          label: '주식·크레딧 £400M 매각 지시(T+2 결제 → 9/27 화)',
          description:
            '오늘 장 마감 후 매각 주문을 낸다. 대금은 화요일에 도착해 풀에 납입된다. 할인 1.5%(시장 충격·호가).',
          effects: [ldiFx.instructSale({ asset: 'equities', amount: 400, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '주식·크레딧 £400M T+2 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'equities', amount: 400, discount: 0.015 })],
            },
          ],
          expert: {
            rating: 75,
            rationale:
              '길트를 팔지 않고 담보를 만드는 정석. 단 T+2 결제라 월·화의 콜에는 늦을 수 있다 — 그래서 금요일에 지시해야 한다.',
            sourceRefs: [S.tpr, S.qb],
          },
          consequences: '매각이 체결되었습니다. 대금은 화요일에 풀로 들어갑니다.',
          feasibility: { basis: '주식·회사채 T+2 결제(런던)', sourceRefs: [S.wpc] },
          calibrationNote: '주식·크레딧 매각 할인 1.5% [CAL: 호가+시장충격, CGFS 36 참고]',
        },
        {
          id: 't1-d',
          label: '직접보유 길트 £200M 즉시 매도(할인 2%)해 현금 확보',
          description:
            '길트는 당일 매도·결제가 가능하다. 그러나 오늘 장기물 매수호가는 얇고, 매도는 금리를 더 밀어 올려 다음 콜을 키운다.',
          effects: [ldiFx.sellGiltsToPool({ amount: 200, discount: 0.02 })],
          expert: {
            rating: 40,
            rationale:
              '개별 스킴에는 합리적이지만 집합적으로는 스파이럴의 연료다(BoE QB: "담보 콜 → 길트 매도 → 금리 상승 → 담보 콜"). 금요일에는 할인이 작으니 화요일보다는 낫다.',
            sourceRefs: [S.qb, S.imf],
          },
          consequences:
            '길트가 매도되고 대금이 풀에 납입되었습니다. 딜러는 "장기물 호가가 얇다"고 전했습니다.',
          feasibility: {
            basis: '길트 당일 매도·T+1 결제(운용사가 체결 확인으로 당일 인정)',
            sourceRefs: [S.qb],
          },
          calibrationNote: '9/23 파이어세일 할인 2% [CAL calibration.md §4]',
        },
        {
          id: 't1-e',
          label: '직접보유 길트 £300M 현물 이전(in-specie)해 담보로 편입',
          description:
            '매도 없이 길트를 풀 담보 계좌로 이전한다. 시장에 매도 압력을 주지 않고 당일 반영된다.',
          requires: { flag: 'ops_ready' },
          unavailableReason:
            '현물 이전 약정이 없습니다 (T0에서 운영 준비를 하지 않음). 풀은 현금 납입만 받습니다.',
          effects: [ldiFx.giltsInSpecie({ amount: 300 })],
          expert: {
            rating: 85,
            rationale:
              '가장 빠르고 시장에 무해한 담보 조달. 세그리게이티드 LDI 스킴이 위기를 비교적 잘 넘긴 이유가 이것이다(Breeden). 가치는 전적으로 T0 준비에 달려 있다.',
            sourceRefs: [S.breeden, S.tpr],
          },
          consequences: '길트 현물 이전이 당일 완료되어 담보 여력이 늘었습니다.',
          feasibility: { basis: 'T0 약정 필요', sourceRefs: [S.tpr] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '"담보 여력(bp)"이 다음 거래일 예상 변동보다 큰지 보세요. 오늘 35bp였고, 월요일은 더 클 수 있습니다.',
    },
    {
      level: 2,
      decisionId: 't1-d1',
      text: '워터폴: 현금(당일) → 길트 현물 이전(당일, 약정 필요) → 주식·크레딧 매각(T+2) → 길트 매도(당일, 스파이럴) → 스폰서(승인 지연).',
    },
    {
      level: 3,
      decisionId: 't1-d1',
      text: '현금(B)은 즉시, 주식 매각(C)은 오늘 지시해야 화요일에 옵니다. 대기(A)는 하루가 아니라 이틀을 잃습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2022-09-26 (월) 18:00 BST "월요일: +50bp"
// ---------------------------------------------------------------------------------------------
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2022년 9월 26일 (월) 18:00 BST',
  title: '월요일: 사상 최대 일일 변동',
  time: '2022-09-26T18:00:00+01:00',
  entryEffects: [
    {
      id: 't2-shock',
      description:
        '30년 길트 +50bp(4.15→4.65%) — 2000년 이후 최대 일일 상승(종전 29bp) → 마진콜, 레버리지 밴드 점검',
      effects: [
        pensionFx.yieldShock({ deltaBp: 50, label: '30년 +50bp (9/26)' }),
        ldiFx.marketMove({ govt2yBp: 45, govt10yBp: 42, creditSpreadIgBp: 15, volIndex: 4 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.03 }),
        confidence(-8, '파운드 사상 최저·장기물 투매'),
      ],
    },
  ],
  events: [
    {
      id: 't2-news-sterling',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '07:10',
      headline: '파운드, 아시아 장에서 1.035달러 사상 최저 — 길트 장기물 개장 전부터 투매',
      body: '주말 재무장관의 "추가 감세" 발언 이후 파운드가 급락했다. 시장은 영란은행의 긴급 금리 인상을 거론하고 있다.',
      severity: 'critical',
      sourceRefs: [S.fsr],
    },
    {
      id: 't2-market',
      kind: 'market',
      time: '16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '4.65%', change: '+50bp — 2000년 이후 최대' },
        { label: '10년 길트', value: '4.25%', change: '+42bp' },
        { label: '2년 길트', value: '4.35%', change: '+45bp' },
        { label: '30년 호가 스프레드', value: '≈1.5bp', change: '9/22 0.5bp' },
      ],
      sourceRefs: [S.yields, S.staff, S.qb],
    },
    {
      id: 't2-news-boe',
      kind: 'newswire',
      outlet: 'Bank of England',
      time: '17:30',
      headline: '총재 성명: "시장 상황을 면밀히 주시… 필요하면 금리를 주저 없이 조정"',
      body: '영란은행은 정부의 성장 계획을 11월 MPC에서 평가하겠다고 밝혔다. 임시 조치나 자산 매입에 대한 언급은 없다.',
      severity: 'warning',
      sourceRefs: [S.gov0926],
    },
    {
      id: 't2-memo-manager',
      kind: 'memo',
      time: '17:40',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '[긴급] 2차 콜 — 레버리지 밴드 점검 결과',
      body: `- 오늘 콜은 풀 잔여 담보로 충당했습니다. 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**.
- 레버리지가 4.5x를 넘은 경우 펀드 규정에 따라 오늘 익스포저 일부를 축소(길트 매도)했습니다 — 로그 확인.
- 화요일 11:00까지 재자본화 자금이 도착하지 않으면 추가 축소가 실행됩니다. 현금만 받습니다.
- 다른 고객 스킴들도 같은 요청을 받았습니다. 우리도 길트를 팔고 있습니다.`,
      severity: 'critical',
      sourceRefs: [S.breeden, S.staff],
      cardRefs: ['ldi-collateral-waterfall', 'ldi-leverage-buffer-250bp'],
      relatedMetrics: ['collateralHeadroomBp', 'ldiLeverage', 'hedgeRatio'],
    },
    {
      id: 't2-call-consultant',
      kind: 'call',
      time: '18:00',
      caller: '투자 컨설턴트',
      callee: 'CIO',
      tone: 'urgent',
      lines: [
        {
          speaker: '컨설턴트',
          text: '고객 스킴 대부분이 같은 상황입니다. 다들 길트를 팔아서 담보를 만들고 있고, 그게 금리를 더 올립니다. 화요일 대금이 도착하기 전에 운용사가 헤지를 잘라낼 수 있습니다.',
        },
        {
          speaker: 'CIO',
          text: '헤지를 우리가 먼저 줄이는 것과 운용사가 강제로 줄이는 것, 무엇이 다릅니까?',
        },
        {
          speaker: '컨설턴트',
          text: '가격입니다. 강제 축소는 최악의 시점에 최악의 가격으로 일어납니다. 그리고 금리가 반전하면 둘 다 언헤지 손실입니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.qb, S.pinter],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '월요일 담보 콜 대응',
      prompt: '화요일 11:00 기한 전에 무엇을 하시겠습니까? (최대 2개)',
      context:
        '금요일에 지시한 매각은 내일 결제됩니다. 오늘 지시하는 매각은 수요일입니다. 길트만이 당일 현금이 되지만, 팔수록 콜이 커집니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall'],
      dimensions: ['liquidity', 'timeliness', 'solvency'],
      timeLimitSec: 120,
      defaultOptionId: 't2-a',
      options: [
        {
          id: 't2-a',
          label: '주식·크레딧 £500M 매각 지시(T+2 결제 → 9/28 수)',
          description: '위원회가 승인한 매각. 대금은 수요일 아침 도착한다. 할인 1.5%.',
          effects: [ldiFx.instructSale({ asset: 'equities', amount: 500, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '주식·크레딧 £500M T+2 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'equities', amount: 500, discount: 0.015 })],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '올바르지만 늦다. 수요일 도착 자금은 화요일의 강제 축소를 막지 못한다. WPC 보고서의 전형적 사례.',
            historicalNote: '실제 다수 스킴이 월요일에 매각을 지시했고 수요일에 대금이 도착했다.',
            sourceRefs: [S.wpc, S.breeden],
          },
          consequences: '매각이 체결되었습니다. 대금은 수요일 아침 풀에 납입됩니다.',
          historical: true,
          feasibility: { basis: 'T+2 결제', sourceRefs: [S.wpc] },
        },
        {
          id: 't2-b',
          label: '직접보유 길트 £200M 당일 매도(할인 4%)해 콜 충당',
          description:
            '오늘 유일한 당일 현금. 장기물 호가 스프레드가 세 배로 벌어졌고 블록 매도는 4% 할인을 감수한다.',
          effects: [ldiFx.sellGiltsToPool({ amount: 200, discount: 0.04 })],
          expert: {
            rating: 40,
            rationale:
              '강제 축소를 피하는 유일한 당일 수단이지만 시스템 전체가 같은 행동을 하면 스파이럴이다(IMF: 13일간 길트 매도 ≈£37bn). 개별 최적·집합 최악.',
            historicalNote: '실제 스킴들이 월·화요일에 직접보유 길트를 매도했다(Breeden: >£30bn).',
            sourceRefs: [S.imf, S.breeden, S.qb],
          },
          consequences:
            '길트 블록이 할인 매도되었습니다. 대금이 풀에 납입되어 잔여 콜을 충당했습니다.',
          historical: true,
          feasibility: { basis: '길트 당일 매도', sourceRefs: [S.qb] },
          calibrationNote: '9/26 파이어세일 할인 4% [CAL calibration.md §4]',
        },
        {
          id: 't2-c',
          label: '직접보유 길트 £300M 현물 이전(in-specie)',
          description: '매도 없이 담보로 편입. 당일 반영. 직접보유 길트가 남아 있어야 한다.',
          requires: {
            all: [{ flag: 'ops_ready' }, { path: 'institution.assets.gilts.marketValue', gt: 0 }],
          },
          unavailableReason:
            '현물 이전 약정이 없거나(T0 운영 준비 미선택) 직접보유 길트가 남아 있지 않습니다.',
          effects: [ldiFx.giltsInSpecie({ amount: 300 })],
          expert: {
            rating: 85,
            rationale: '시장에 매도 압력을 주지 않는 당일 담보. 준비된 스킴만 쓸 수 있는 선택지.',
            sourceRefs: [S.breeden, S.tpr],
          },
          consequences: '현물 이전이 완료되었습니다.',
          feasibility: { basis: 'T0 약정 필요', sourceRefs: [S.tpr] },
        },
        {
          id: 't2-d',
          label: '스킴 잔여 현금 전액 풀에 송금',
          description: '남은 현금을 모두 납입한다(운영 준비 시 당일, 아니면 T+1).',
          effects: [ldiFx.instructCash({ amount: 999 })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'cashInstructed', gt: 0 },
              description: '현금 송금 T+1 결제 — 풀 담보 반영',
              effects: [ldiFx.settleInstructedCash()],
            },
          ],
          expert: {
            rating: 75,
            rationale: '워터폴 첫 층. 금요일에 이미 보냈다면 남은 것이 없다.',
            sourceRefs: [S.tpr],
          },
          consequences: '송금 지시가 나갔습니다(로그 참조).',
        },
        {
          id: 't2-e',
          label: '비유동자산(사모) £300M 세컨더리 급매(할인 35%, T+2)',
          description:
            '사모·부동산 지분을 세컨더리 시장에 급매한다. 매수자는 30~40% 할인을 요구하며, 결제도 빠르지 않다.',
          effects: [ldiFx.instructSale({ asset: 'illiquid', amount: 300, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '비유동자산 £300M 세컨더리 결제(할인 35%) → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'illiquid', amount: 300, discount: 0.35 })],
            },
          ],
          expert: {
            rating: 5,
            rationale:
              '35%를 영구히 잃고도 당일 현금이 아니다. 유동성 워터폴의 마지막 층을 첫 층처럼 쓰는 것은 펀딩비율을 직접 파괴한다.',
            sourceRefs: [S.tpr, S.cgfs],
          },
          consequences:
            '세컨더리 매수자와 계약했습니다. 할인 35%가 확정되었고 결제는 이틀 뒤입니다.',
          trap: true,
          trapExplanation:
            '"무엇이든 팔아 담보를 만든다"는 절박함이 가장 비싼 자산부터 팔게 한다. 워터폴은 싸고 빠른 것부터, 비싸고 느린 것은 마지막이다.',
          irreversible: true,
          calibrationNote: '2022년 4분기 사모 세컨더리 할인 30~40% [CAL]',
        },
      ],
    },
    {
      id: 't2-d2',
      title: '헤지 정책',
      prompt: '수탁자 위원회에 어떤 헤지 방침을 권고하시겠습니까?',
      context:
        '헤지를 줄이면 담보 콜이 줄지만, 금리가 반전하면 부채가 늘어나는 만큼 자산이 따라오지 않습니다. 지금은 금리가 오르고만 있습니다.',
      requiredConcepts: ['ldi-leverage-buffer-250bp'],
      dimensions: ['marketRisk'],
      options: [
        {
          id: 't2-d2-a',
          label: '헤지 유지 — 운용사 재자본화 요청 전액 이행 방침 결의',
          description:
            '헤지비율 목표를 바꾸지 않고 담보를 조달한다. 실행가능성: 결의만으로 가능하며 자금 조달은 D1의 선택에 달려 있다.',
          effects: [flag('hedge_policy_hold'), confidence(3, '수탁자 결의: 헤지 유지')],
          expert: {
            rating: 75,
            rationale:
              'BoE·TPR 사후평가의 해법은 "헤지를 유지할 담보"였다. 헤지는 부채 대비 리스크 관리이며, 위기 중 축소는 타이밍 베팅이 된다. 캐비앗: 담보를 못 만들면 운용사가 대신 줄인다.',
            sourceRefs: [S.staff, S.tpr],
          },
          consequences: '위원회가 헤지 유지를 결의했습니다.',
          historical: true,
        },
        {
          id: 't2-d2-b',
          label: '헤지 25% 자발적 축소로 담보 부담 경감',
          description:
            '익스포저 25%를 언와인드한다(할인 4%). 헤지비율이 낮아지고 담보 여력(bp)은 늘어난다.',
          effects: [ldiFx.cutHedge({ fraction: 0.25, discount: 0.04, reason: '위원회 결의' })],
          expert: {
            rating: 40,
            rationale:
              '강제 축소보다 질서 있지만, 이틀 뒤 −100bp 반전에서 언헤지 손실을 확정한다. FSR은 헤지 축소를 권고한 적이 없다.',
            sourceRefs: [S.fsr, S.qb],
          },
          consequences: '익스포저 25%가 언와인드되었습니다. 담보 여력이 늘었습니다.',
          calibrationNote: '언와인드 할인 4% (당일 길트 매도와 동일) [CAL]',
        },
        {
          id: 't2-d2-c',
          label: '헤지 60% 축소 — 담보 콜 원천 차단',
          description:
            '익스포저 60%를 언와인드해 콜을 사실상 없앤다. 금리가 계속 오르면 펀딩비율이 크게 개선된다.',
          effects: [
            ldiFx.cutHedge({ fraction: 0.6, discount: 0.04, reason: '위원회 결의(대폭 축소)' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '"금리는 계속 오른다"는 베팅이다. 9/28 −100bp 반전에서 부채가 20% 늘어날 때 자산은 따라오지 못한다. 헤지의 목적은 방향 예측이 아니라 부채 대비 변동성 제거다.',
            sourceRefs: [S.fsr, S.staff],
          },
          consequences: '익스포저 60%가 언와인드되었습니다. 헤지비율이 급락했습니다.',
          trap: true,
          trapExplanation:
            '오르는 금리 앞에서 헤지를 버리면 당장은 편해진다. 그러나 헤지를 버린 스킴은 금리가 내리는 날 무방비다 — 그리고 그날은 이틀 뒤였다.',
          irreversible: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '"LDI 레버리지"가 4.5x를 넘으면 운용사가 헤지를 강제로 줄입니다. "마진콜 대기액"과 "유동자산"을 비교하세요.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: '당일 담보는 현금·현물 이전·길트 매도뿐입니다. T+2 매각은 수요일 자금입니다. 비유동자산 급매는 워터폴의 마지막 층입니다.',
    },
    {
      level: 3,
      decisionId: 't2-d1',
      text: '현물 이전(C)이 열려 있으면 C. 아니면 길트 매도(B)가 강제 축소보다 낫고, 주식 매각(A)은 수요일을 위한 것입니다.',
    },
    {
      level: 2,
      decisionId: 't2-d2',
      text: '헤지 축소는 담보 문제를 금리 방향 베팅으로 바꿉니다. 사후평가의 해법은 "헤지 유지 + 담보"였습니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2022-09-27 (화) 17:30 BST "5% 돌파"
// ---------------------------------------------------------------------------------------------
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2022년 9월 27일 (화) 17:30 BST',
  title: '화요일: 30년 5% 돌파',
  time: '2022-09-27T17:30:00+01:00',
  entryEffects: [
    {
      id: 't3-shock',
      description:
        '30년 길트 +45bp(4.65→5.10%) — 3거래일 누적 +130bp. 콜·레버리지 점검, 미충당 시 강제 축소',
      effects: [
        pensionFx.yieldShock({ deltaBp: 45, label: '30년 +45bp (9/27)' }),
        ldiFx.marketMove({ govt2yBp: 35, govt10yBp: 25, creditSpreadIgBp: 20, volIndex: 3 }),
        ldiFx.postFromBuffer('풀 자체 버퍼로 콜 충당'),
        ldiFx.forcedDelever({ maxLeverage: MAX_LEVERAGE, discount: 0.06 }),
        confidence(-7, '장기물 시장 기능 저하'),
      ],
    },
  ],
  events: [
    {
      id: 't3-market',
      kind: 'market',
      time: '16:30',
      headline: '마감 시세',
      items: [
        { label: '30년 길트', value: '5.10%', change: '+45bp — 3일 누적 +130bp' },
        { label: '10년 길트', value: '4.50%', change: '+25bp' },
        { label: '2년 길트', value: '4.70%', change: '+35bp' },
        { label: '30년 호가 스프레드', value: '≈2bp', change: '장기물 매수호가 실종 구간' },
      ],
      sourceRefs: [S.yields, S.qb],
    },
    {
      id: 't3-news-spiral',
      kind: 'newswire',
      outlet: 'Financial Times',
      time: '15:40',
      headline: '"연기금이 길트를 던지고 있다" — LDI 담보 콜이 장기물 투매의 배후로 지목',
      body: '딜러들은 장기 길트 매도 주문 대부분이 연기금·LDI 펀드에서 나온다고 전했다. 한 운용사는 "고객 자금이 도착하기 전에 익스포저를 줄일 수밖에 없다"고 말했다. 30년물은 20년 만에 처음 5%를 넘었다.',
      severity: 'critical',
      sourceRefs: [S.pinter, S.qb],
      cardRefs: ['ldi-collateral-waterfall'],
    },
    {
      id: 't3-memo-manager',
      kind: 'memo',
      time: '17:10',
      from: 'LDI 운용사 담보팀',
      to: 'CIO · 수탁자 의장',
      subject: '[긴급] 기한 경과 — 축소 실행 내역 및 잔여 콜',
      body: `- 11:00 기한까지 도착한 자금과 풀 잔여 담보로 콜을 충당했고, 레버리지 밴드 초과분은 익스포저 축소로 처리했습니다(로그 참조).
- 현재 담보 여력 **{{metric:collateralHeadroomBp}}**, 레버리지 **{{metric:ldiLeverage}}**, 헤지비율 **{{metric:hedgeRatio}}**, 잔여 콜 **{{metric:marginCallPending}}**.
- 내일 오전 추가 상승 시 잔여 담보가 없으면 즉시 추가 축소합니다.
- 레포 은행 두 곳이 장기 길트 헤어컷을 인상했습니다.`,
      severity: 'critical',
      sourceRefs: [S.breeden, S.cgfs],
      relatedMetrics: ['collateralHeadroomBp', 'hedgeRatio', 'marginCallPending'],
    },
    {
      id: 't3-memo-settle',
      kind: 'memo',
      when: { counter: 'saleInstructed_equities', gt: 0 },
      time: '17:20',
      from: '운영팀',
      to: 'CIO',
      subject: '매각 대금 결제 일정',
      body: '금요일 지시분은 오늘 결제되어 풀에 납입되었습니다(해당 시). 월요일 지시분은 내일(수) 아침 결제 예정입니다.',
      severity: 'info',
    },
    {
      id: 't3-call-tpr',
      kind: 'call',
      when: { flag: 'forced_deleverage' },
      effects: [regulator({ add: 1 }, 'TPR 강화 모니터링(강제 축소 스킴)')],
      time: '17:40',
      caller: 'TPR 감독관',
      callee: '수탁자 의장',
      agency: 'The Pensions Regulator',
      tone: 'concerned',
      lines: [
        {
          speaker: 'TPR',
          text: 'LDI 익스포저 축소가 있었다고 들었습니다. 스킴의 담보 워터폴과 잔여 유동성, 스폰서 접촉 여부를 내일까지 서면으로 보내 주십시오.',
        },
        { speaker: '수탁자 의장', text: '오늘 밤 정리해 보내겠습니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.tprStmt],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '잔여 콜과 재자본화 속도',
      prompt: '내일 아침 전에 무엇을 하시겠습니까? (최대 2개)',
      context:
        '잔여 담보가 없다면 내일 아침 금리가 조금만 올라도 추가 강제 축소가 일어납니다. 구속 제약은 지급능력이 아니라 "내일 11시까지 도착하는 현금"입니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['ldi-collateral-waterfall'],
      dimensions: ['liquidity', 'solvency'],
      timeLimitSec: 120,
      defaultOptionId: 't3-a',
      options: [
        {
          id: 't3-a',
          label: '직접보유 길트 £300M 매도(할인 7%)해 잔여 콜 충당·버퍼 보강',
          description:
            '장기물 매수호가가 거의 없다. 블록 매도는 7% 할인이다. 그래도 당일 현금이다.',
          effects: [ldiFx.sellGiltsToPool({ amount: 300, discount: 0.07 })],
          expert: {
            rating: 35,
            rationale:
              '강제 축소보다는 나은 가격이지만 여전히 최악의 시점에 파는 것이다. BoE QB가 묘사한 "펀더멘털과 무관한 가격 하락"이 이 할인이다.',
            historicalNote: '실제 스킴·LDI 펀드의 9/27~28 매도. 시스템 전체로 >£30bn.',
            sourceRefs: [S.qb, S.breeden],
          },
          consequences: '길트 잔량이 할인 매도되었습니다. 대금이 풀에 납입되었습니다.',
          historical: true,
          calibrationNote: '9/27 파이어세일 할인 7% [CAL calibration.md §4]',
        },
        {
          id: 't3-b',
          label: '스폰서에 £300M 긴급 출연 요청',
          description:
            '대기성 약정이 있으면 오늘 송금, 없으면 스폰서 이사회 승인 후 내일 반영. 스폰서 여력은 £300M(약정 시 £600M).',
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
            rating: 65,
            rationale:
              '길트를 팔지 않는 담보. TPR 가이드는 스폰서 유동성 지원을 워터폴에 포함한다. 캐비앳: 승인 지연과 커버넌트 의존.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '스폰서에 요청했습니다. 도착 시점은 대기 약정 여부에 따릅니다(로그 참조).',
          feasibility: {
            basis: '스폰서 이사회 승인(1일) 또는 대기 약정(당일)',
            sourceRefs: [S.wpc],
          },
        },
        {
          id: 't3-c',
          label: '직접보유 길트 잔량 현물 이전(in-specie)',
          description: '매도 없이 담보 편입. 당일 반영. 직접보유 길트가 남아 있어야 한다.',
          requires: {
            all: [{ flag: 'ops_ready' }, { path: 'institution.assets.gilts.marketValue', gt: 0 }],
          },
          unavailableReason:
            '현물 이전 약정이 없거나(T0 운영 준비 미선택) 직접보유 길트가 남아 있지 않습니다.',
          effects: [ldiFx.giltsInSpecie({ amount: 300 })],
          expert: {
            rating: 85,
            rationale: '시장에 무해한 당일 담보. 남은 길트가 있는 한 최선.',
            sourceRefs: [S.breeden, S.tpr],
          },
          consequences: '현물 이전이 완료되었습니다.',
        },
        {
          id: 't3-d',
          label: '주식 £300M 추가 매각 지시(T+2 결제)',
          description:
            '대금은 목요일에 도착한다(게임에서는 9/28 오후 턴에 반영). 내일 아침에는 도움이 되지 않는다.',
          effects: [ldiFx.instructSale({ asset: 'equities', amount: 300, settleTurns: 2 })],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '주식 £300M T+2 결제 → 풀 재자본화',
              effects: [ldiFx.settleSale({ asset: 'equities', amount: 300, discount: 0.015 })],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '버퍼 재건에는 맞지만 내일의 강제 축소를 막지 못한다. 결제 일수가 구속 제약이다.',
            sourceRefs: [S.tpr, S.wpc],
          },
          consequences: '매각이 체결되었습니다. 대금은 이틀 뒤 도착합니다.',
        },
        {
          id: 't3-e',
          label: '운용사에 기한 연장 요청, 추가 조치 없음',
          description:
            '"자금이 오는 중"이라며 축소를 미뤄 달라고 한다. 풀드펀드 규정상 개별 고객에게 예외는 없다.',
          effects: [confidence(-5, '운용사: 기한 연장 거부'), flag('asked_extension')],
          expert: {
            rating: 10,
            rationale:
              '풀드펀드는 수백 개 스킴의 공동 펀드다. 운용사는 다른 투자자 보호 의무로 개별 연장을 거부한다(Breeden: 풀드펀드의 "많은 소규모 투자자" 문제).',
            sourceRefs: [S.breeden, S.wpc],
          },
          consequences: '운용사가 연장을 거부했습니다. "규정은 모든 투자자에게 같다."',
          trap: true,
          trapExplanation:
            '세그리게이티드 계좌라면 협상이 가능하지만 풀드펀드에서는 규정이 곧 실행이다. 시간을 달라는 요청은 시간을 쓰는 것이다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '"담보 여력(bp)"이 0에 가깝다면 내일 아침 5bp 상승만으로도 추가 강제 축소가 일어납니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: '현물 이전(C)·대기 약정 스폰서(B)가 당일 자금입니다. 길트 매도(A)는 당일이지만 비쌉니다. 연장 요청(E)은 함정입니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3]
