/**
 * Synthetic 4-turn bank scenario used by the engine test-suite. It is deliberately small but
 * exercises every engine feature: entry effects (run-off + collateral settlement), conditional
 * events, delayed effects with `when`, `setFlags`, `requires`/`unavailableReason`, traps,
 * multi-select with an exclusive group, a `chose`-gated decision, a timed decision with a
 * default option, game-over rules (incl. `consecutiveTurns`), conditional endings, every scoring
 * component kind, historical / expert paths, a metric checkpoint and a debrief with a quiz.
 *
 * Designed dynamics (seed-independent except for `reject_help`, which rolls the RNG once):
 *  - expert path : backstopped raise → S1 → regulator-verified statement → S0 → survives (strong ending)
 *  - historical  : unbackstopped raise (−20 CI) → S1 → S2 after delayed downgrade → survives, bruised
 *  - worst       : HTM fire-sale taints the book (−30 CI) → S3 run → LCR < 60 twice → game over at T3
 */
import type { BankState, Effect } from '@/engine'
import { bankFx } from '@/engine/fx/bank'
import { confidence, counter, feed, flag, op, ownStockMove, regulator } from '@/engine/fx/common'
import { defineScenario } from '@/scenarios/_shared/define'

const SRC_PRIMARY = 'mini-primary'
const SRC_REG = 'mini-reg'

const fx = {
  ci: (delta: number, reason: string): Effect<BankState> => confidence(delta, reason),
}

export const miniBank = defineScenario<BankState>({
  meta: {
    id: 'mini-bank',
    version: 1,
    title: '미니뱅크: 4턴',
    subtitle: '엔진 테스트용 합성 은행 시나리오',
    era: '2023-03',
    year: 2023,
    region: 'global',
    role: 'bank_treasurer',
    roleTitle: '자금담당임원(Treasurer)',
    institutionType: 'bank',
    institutionName: '미니뱅크(Mini Bank)',
    modelledOn: '합성(테스트 픽스처)',
    difficulty: 'intro',
    durationTurns: 4,
    turnUnit: 'day',
    estMinutes: 5,
    timezone: 'America/Los_Angeles',
    learningObjectives: [
      {
        id: 'lo1',
        text: '손실 공개와 증자 백스톱의 관계를 이해한다',
        competency: 'communication',
        decisionIds: ['d0_disclosure'],
      },
      {
        id: 'lo2',
        text: '유동성 조달 수단의 순서를 이해한다',
        competency: 'liquidity',
        decisionIds: ['d1_funding'],
      },
      {
        id: 'lo3',
        text: '위기 커뮤니케이션의 원칙을 이해한다',
        competency: 'communication',
        decisionIds: ['d2_comms', 'd3_weekend'],
      },
    ],
    competencies: { liquidity: 3, communication: 2, solvency: 1 },
    tags: ['테스트', '뱅크런'],
    sources: [
      {
        id: SRC_PRIMARY,
        title: 'Mini Bank stress log (synthetic)',
        publisher: 'FinanceTest fixtures',
        date: '2024-01-01',
        kind: 'primary',
      },
      {
        id: SRC_REG,
        title: 'Mini supervisory manual (synthetic)',
        publisher: 'FinanceTest fixtures',
        date: '2024-01-01',
        kind: 'regulatory',
      },
    ],
  },
  units: { currency: 'USD', scale: 1e9, display: 'B' },
  initialState: {
    institution: {
      kind: 'bank',
      cash: 60,
      securities: {
        afs: { marketValue: 20, bookValue: 22, modDuration: 4, hqlaLevel: 'L1' },
        htm: { marketValue: 60, bookValue: 75, modDuration: 6, hqlaLevel: 'L2A' },
      },
      loans: { retail: 20, sme: 20, corporate: 30, fi: 5, nonPerforming: 1, avgDuration: 3 },
      otherAssets: 5,
      deposits: [
        {
          id: 'retail',
          label: '보험 소매예금',
          balance: 40,
          insured: true,
          runoffByState: [0, 0.002, 0.03, 0.1],
          dailyCap: 0.1,
          lcrCategory: 'retailStable',
        },
        {
          id: 'vc',
          label: '무보험 스타트업 예금(네트워크)',
          balance: 100,
          insured: false,
          runoffByState: [0.005, 0.03, 0.35, 0.95],
          lcrCategory: 'corporateUninsured',
          networked: true,
        },
        {
          id: 'corp',
          label: '무보험 운영성 예금',
          balance: 40,
          insured: false,
          runoffByState: [0, 0.02, 0.2, 0.8],
          lcrCategory: 'operational',
        },
      ],
      wholesale: {
        unsecuredShort: 5,
        unsecuredLong: 5,
        repoL1: 0,
        repoL2A: 0,
        repoOther: 0,
        cbAdvances: 0,
        cbFacilityCapacity: 10,
        cbFacilityPending: 0,
      },
      committed: { creditToCorporates: 10, liquidityToFIs: 2 },
      otherLiabilities: 17,
      capital: { cet1: 12, at1: 1, tier2: 1, aociInCet1: false },
      rwa: 100,
      leverageExposure: 221,
      fireSaleDiscount: 0.02,
      taxRate: 0.21,
      htmTainted: false,
      custom: {},
    },
    market: {
      policyRateBp: 475,
      govt2yBp: 480,
      govt10yBp: 390,
      govt30yBp: 380,
      creditSpreadIgBp: 130,
      creditSpreadHyBp: 450,
      fundingStressBp: 20,
      equityIndex: 100,
      volIndex: 20,
      fxUsdLocal: 1,
      ownStock: 100,
      ownCdsBp: 150,
      custom: {},
    },
    confidence: {
      index: 72,
      depositors: 70,
      counterparties: 70,
      regulators: 70,
      investors: 70,
      media: 70,
      board: 75,
    },
    regulatorLevel: 0,
    flags: {},
    counters: {},
  },
  briefing: {
    situation: '미니뱅크는 무보험 스타트업 예금 비중이 높고 HTM 미실현손실을 안고 있다.',
    mandate: '4일 동안 유동성을 지키고 신뢰를 유지하라.',
    institutionProfile: '총자산 221, 예금 180(무보험 78%), HTM 미실현손실 15.',
    marketBackdrop: '정책금리 4.75%, 장단기 역전.',
    stakeholders: [{ name: 'CEO', wants: '주가 방어', canDo: '공개 발언' }],
    regulatoryFramework: 'LCR 100% 최저, CET1 7% 버퍼.',
    cardRefs: [],
    simplificationNotes: ['모든 수치는 합성값이다.'],
  },
  kpis: [
    {
      metric: 'survivalDays',
      label: '생존 일수',
      unit: 'days',
      primary: true,
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'lcr',
      label: 'LCR',
      unit: '%',
      sparkline: true,
      decimals: 0,
      referenceLabel: '규제 최저 100%',
    },
    { metric: 'confidence', label: '신뢰지수', unit: 'index', decimals: 0 },
    { metric: 'cash', label: '현금', unit: 'ccy', decimals: 1 },
  ],
  turns: [
    // ------------------------------------------------------------------ T0
    {
      id: 't0',
      label: 'T0',
      timeLabel: '수요일 08:00',
      title: '손실 공개 전야',
      events: [
        {
          id: 'e0_wire',
          kind: 'newswire',
          outlet: 'MiniWire',
          headline: '미니뱅크, 증권 포트폴리오 손실 검토 중',
          body: 'HTM 미실현손실이 CET1을 넘어선다는 관측.',
          severity: 'warning',
          sourceRefs: [SRC_PRIMARY],
        },
        {
          id: 'e0_memo',
          kind: 'memo',
          from: 'CFO',
          to: 'Treasurer',
          subject: '증자 옵션',
          body: '백스톱 유무에 따른 두 가지 안이 있다.',
        },
        {
          id: 'e0_market',
          kind: 'market',
          headline: '개장 전 시장',
          items: [
            { label: '2y', value: '4.80%', change: '+5bp' },
            { label: '자사주', value: '100', change: '0%' },
          ],
        },
      ],
      decisions: [
        {
          id: 'd0_disclosure',
          title: '손실 공개 방식',
          prompt: '손실을 어떻게 공개할 것인가?',
          dimensions: ['communication', 'solvency'],
          options: [
            {
              id: 'opt_a_backstopped',
              label: '완전 백스톱 증자와 함께 공개',
              description: '앵커 투자자가 100% 인수하는 증자를 동시 발표.',
              requires: { confidence: { gte: 40 } },
              unavailableReason: '신뢰지수 40 미만에서는 백스톱 투자자를 구할 수 없습니다',
              effects: [
                fx.ci(-5, '손실 공개(백스톱 증자 동반)'),
                bankFx.raiseEquity({ amount: 2, backstopPct: 100, discount: 0.2, marketCap: 10 }),
                ownStockMove(-0.15, '백스톱 증자 희석'),
              ],
              setFlags: { backstop: true },
              scoreAdjust: { policy: 10 },
              expert: {
                rating: 85,
                rationale: '백스톱이 있으면 신뢰 충격이 제한된다.',
                sourceRefs: [SRC_PRIMARY],
              },
              consequences: '증자가 종결되고 완화 계수 ×0.7이 적용된다.',
              feasibility: { basis: '당시 앵커 투자자 존재', sourceRefs: [SRC_PRIMARY] },
            },
            {
              id: 'opt_b_unbackstopped',
              label: '백스톱 없이 손실과 증자 계획 공개',
              description: '손실을 공개하고 시장에서 증자를 시도한다.',
              effects: [
                fx.ci(-20, '손실 공개 + 미백스톱 증자'),
                op('market.ownCdsBp', 'add', 150, 'CDS 확대'),
                ownStockMove(-0.4, '미백스톱 증자 발표'),
              ],
              delayedEffects: [
                {
                  afterTurns: 2,
                  when: { notFlag: 'guarantee' },
                  description: '신용등급 검토 → 1노치 강등',
                  effects: [
                    fx.ci(-10, '1노치 강등'),
                    feed(
                      '신용등급 강등',
                      '검증된 유동성 공표가 없어 등급이 강등되었다.',
                      'warning',
                    ),
                  ],
                },
              ],
              scoreAdjust: { policy: -10 },
              expert: {
                rating: 15,
                rationale: '백스톱 없는 증자 발표는 런의 방아쇠가 된다.',
                sourceRefs: [SRC_PRIMARY, SRC_REG],
              },
              consequences: '주가가 급락하고 예금자들이 동요한다.',
              historical: true,
              trap: true,
              trapExplanation:
                '백스톱 없이 손실을 공개하면 증자 실패 가능성이 가시화되어 런을 촉발한다.',
            },
            {
              id: 'opt_c_silent',
              label: '공개를 미루고 담보를 먼저 설정',
              description: 'FHLB에 담보를 추가 설정하고 발표는 보류한다.',
              effects: [
                bankFx.pledgeCollateral({ immediate: 5, pending: 10 }),
                bankFx.addAmplifier(1.2, '정보 공백'),
              ],
              setFlags: { silent: true },
              expert: { rating: 50, rationale: '담보 설정은 옳지만 침묵은 소문을 키운다.' },
              consequences: '당일 여력 +5, 익일 +10. 소문이 돌기 시작한다.',
            },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------ T1
    {
      id: 't1',
      label: 'T1',
      timeLabel: '목요일 08:00',
      title: '런 첫날',
      entryEffects: [
        {
          id: 'x1_settle',
          effects: [bankFx.settlePendingCapacity()],
          description: '담보 이전 완료',
        },
        {
          id: 'x1_runoff',
          effects: [bankFx.runoffStep({ windowFraction: 1 })],
          description: '1일차 예금 유출',
        },
      ],
      events: [
        {
          id: 'e1_call',
          kind: 'call',
          caller: '감독관',
          callee: 'Treasurer',
          agency: 'Mini FSA',
          tone: 'concerned',
          lines: [
            { speaker: '감독관', text: '오늘 유출 규모를 보고하세요.' },
            { speaker: 'Treasurer', text: '집계 중입니다.' },
          ],
        },
        {
          id: 'e1_rumor',
          kind: 'newswire',
          outlet: 'SNS',
          headline: '미니뱅크 침묵에 소문 확산',
          body: '공식 입장이 없자 예금 인출 권고가 돌고 있다.',
          when: { flag: 'silent' },
          effects: [bankFx.addAmplifier(1.2, 'SNS 바이럴'), regulator({ add: 1 }, '정보 공백')],
          severity: 'warning',
        },
      ],
      decisions: [
        {
          id: 'd1_funding',
          title: '유동성 조달',
          prompt: '오늘 실행할 조달 수단을 최대 2개 고르시오.',
          select: { min: 1, max: 2 },
          exclusive: [['sell_afs', 'sell_htm']],
          dimensions: ['liquidity', 'marketRisk'],
          options: [
            {
              id: 'draw_fhlb',
              label: 'FHLB 여력 인출',
              description: '기설정 담보 여력을 전액 인출한다.',
              effects: [bankFx.drawFacility({ amount: 10, source: 'FHLB', rateBp: 520 })],
              expert: { rating: 80, rationale: '기설정 여력은 가장 빠르고 저렴한 조달원이다.' },
              consequences: '현금이 늘고 담보차입 잔액이 증가한다.',
              historical: true,
            },
            {
              id: 'sell_afs',
              label: 'AFS 절반 매각',
              description: 'AFS 포트폴리오의 절반을 매각한다.',
              effects: [bankFx.sellSecurities({ book: 'afs', fraction: 0.5 })],
              expert: { rating: 60, rationale: 'AOCI 손실은 이미 인식되어 있어 자본 충격이 작다.' },
              consequences: '현금이 늘고 소폭의 실현 손실이 발생한다.',
              historical: true,
            },
            {
              id: 'sell_htm',
              label: 'HTM 30% 매각',
              description: 'HTM 포트폴리오의 30%를 매각한다.',
              effects: [
                bankFx.sellSecurities({ book: 'htm', fraction: 0.3 }),
                regulator({ add: 1 }, 'HTM tainting'),
              ],
              expert: {
                rating: 10,
                rationale: 'HTM 매각은 전체 장부를 tainting하여 미실현손실을 가시화한다.',
                sourceRefs: [SRC_REG],
              },
              consequences: 'HTM 전체가 AFS로 재분류되고 신뢰지수가 30 하락한다.',
              trap: true,
              trapExplanation:
                'ASC 320 tainting 규칙 때문에 일부 매각도 전체 장부의 손실을 가시화한다.',
              irreversible: true,
            },
            {
              id: 'seek_guarantee',
              label: '감독당국 검증 유동성 성명 요청',
              description: '감독당국이 확인한 유동성 수치를 공표한다.',
              effects: [
                fx.ci(10, '검증된 유동성 공표'),
                bankFx.setDampener(0.7, '검증 유동성 공표'),
              ],
              setFlags: { guarantee: true },
              expert: { rating: 75, rationale: '검증 가능한 수치는 완화 계수 0.7을 만든다.' },
              consequences: '신뢰가 회복되고 유출이 완화된다.',
            },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------ T2
    {
      id: 't2',
      label: 'T2',
      timeLabel: '금요일 08:00',
      title: '피어 실패',
      entryEffects: [
        {
          id: 'x2_peer',
          when: { notFlag: 'guarantee' },
          effects: [bankFx.addAmplifier(1.3, '48h 내 피어 실패')],
          description: '피어 실패 증폭',
        },
        {
          id: 'x2_runoff',
          effects: [bankFx.runoffStep({ windowFraction: 1 })],
          description: '2일차 예금 유출',
        },
      ],
      events: [
        {
          id: 'e2_wire',
          kind: 'newswire',
          outlet: 'MiniWire',
          headline: '동종 은행 폐쇄',
          body: '유사한 예금 구조의 은행이 감독당국에 의해 폐쇄되었다.',
          effects: [fx.ci(-5, '동종 피어 실패')],
          severity: 'critical',
          sourceRefs: [SRC_PRIMARY],
        },
        {
          id: 'e2_memo',
          kind: 'memo',
          from: 'IR',
          to: 'Treasurer',
          subject: '언론 대응',
          body: 'CEO가 고객 콜을 원한다.',
        },
      ],
      decisions: [
        {
          id: 'd2_comms',
          title: '고객 커뮤니케이션',
          prompt: '어떤 메시지를 낼 것인가?',
          when: {
            chose: { decision: 'd0_disclosure', option: ['opt_b_unbackstopped', 'opt_c_silent'] },
          },
          dimensions: ['communication'],
          options: [
            {
              id: 'ceo_calm_call',
              label: '수치 없는 CEO "침착" 콜',
              description: 'CEO가 구체적 수치 없이 안심을 호소한다.',
              effects: [
                fx.ci(-3, '수치 없는 CEO 콜'),
                bankFx.addAmplifier(1.2, '정보 공백'),
                counter('pressCalls', 1),
              ],
              expert: { rating: 25, rationale: '수치 없는 안심 메시지는 오히려 불안을 키운다.' },
              consequences: '콜 직후 인출 문의가 늘었다.',
              historical: true,
              trap: true,
              trapExplanation: '검증 가능한 수치 없는 메시지는 완화가 아니라 증폭 요인이다.',
            },
            {
              id: 'publish_liquidity',
              label: '검증 가능한 유동성 수치 공표',
              description: '현금·담보 여력을 수치로 공표한다.',
              effects: [
                fx.ci(8, '검증 가능 유동성 공표'),
                bankFx.setDampener(0.7, '수치 공표'),
                flag('published'),
              ],
              expert: { rating: 70, rationale: '검증 가능한 수치는 완화 계수를 만든다.' },
              consequences: '일부 예금자가 인출을 보류했다.',
            },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------ T3
    {
      id: 't3',
      label: 'T3',
      timeLabel: '토요일 08:00',
      title: '주말',
      entryEffects: [
        {
          id: 'x3_runoff',
          effects: [bankFx.runoffStep({ windowFraction: 1 })],
          description: '3일차 예금 유출',
        },
      ],
      events: [
        {
          id: 'e3_market',
          kind: 'market',
          headline: '주말 시장',
          items: [{ label: '자사 CDS', value: '300bp' }],
        },
        {
          id: 'e3_board',
          kind: 'board',
          headline: '이사회 소집',
          body: '컨소시엄 제안이 도착했다. 1시간 안에 답해야 한다.',
        },
      ],
      decisions: [
        {
          id: 'd3_weekend',
          title: '컨소시엄 제안',
          prompt: '대형은행 컨소시엄의 예금 제안을 받아들일 것인가?',
          timeLimitSec: 60,
          defaultOptionId: 'accept_consortium',
          dimensions: ['policy', 'timeliness'],
          options: [
            {
              id: 'accept_consortium',
              label: '컨소시엄 예금 수용',
              description: '대형은행 컨소시엄이 10을 예치한다.',
              effects: [
                op('institution.cash', 'add', 10, '컨소시엄 예금'),
                fx.ci(10, '컨소시엄 예금'),
              ],
              expert: {
                rating: 80,
                rationale: '컨소시엄 예금은 검증된 완화 요인이다.',
                sourceRefs: [SRC_PRIMARY],
              },
              consequences: '현금 +10, 신뢰 +10.',
            },
            {
              id: 'reject_help',
              label: '제안 거절',
              description: '독자 생존을 선택한다.',
              effects: [
                {
                  kind: 'fn',
                  name: 'boardRoll',
                  apply: (d, ctx) => {
                    const roll = ctx.rng()
                    d.counters.boardRoll = Math.round(roll * 1000) / 1000
                    d.confidence.index = Math.max(0, d.confidence.index - (roll < 0.5 ? 5 : 8))
                  },
                  label: '이사회 반응',
                },
              ],
              expert: { rating: 30, rationale: '지원 거절은 불확실성을 키운다.' },
              consequences: '이사회가 동요한다.',
              historical: true,
              trap: true,
              trapExplanation: '가용한 완화 수단을 거절하는 것은 시간을 잃는 선택이다.',
            },
            {
              id: 'sell_bank',
              label: '주말 매각 협상 개시',
              description: '인수자를 찾는다.',
              when: { metric: 'confidence', lt: 50 },
              effects: [fx.ci(5, '매각 협상'), regulator({ set: 3 }, '정리 준비')],
              expert: {
                rating: 55,
                rationale: '신뢰가 무너진 상황에서는 질서 있는 매각이 차선이다.',
              },
              consequences: '감독당국이 정리 준비 단계로 들어간다.',
            },
          ],
        },
      ],
    },
  ],
  gameOver: [
    {
      id: 'go_negative_liquidity',
      when: { metric: 'liquidityAvailable', lt: 0 },
      reason: 'liquidity',
      title: '결제 불능',
      narrative: '가용 유동성이 음수가 되었다.',
      failed: true,
      ruleText: '즉시 가용 유동성 < 0',
    },
    {
      id: 'go_lcr',
      when: { metric: 'lcr', lt: 60, consecutiveTurns: 2 },
      reason: 'lcr',
      title: '감독당국 폐쇄',
      narrative: 'LCR이 2턴 연속 60% 미만으로 감독당국이 은행을 폐쇄했다.',
      failed: true,
      orderly: false,
      ruleText: 'LCR < 60% 2턴 연속',
    },
  ],
  endings: [
    {
      id: 'ending_strong',
      when: { all: [{ metric: 'confidence', gte: 60 }, { notFlag: 'raise_failed' }] },
      title: '신뢰 회복',
      narrative: '은행은 신뢰를 지키며 주말을 넘겼다.',
    },
    {
      id: 'ending_bruised',
      when: { any: [{ flag: 'published' }, { flag: 'guarantee' }] },
      title: '상처뿐인 생존',
      narrative: '검증된 수치 덕분에 살아남았지만 예금 기반이 크게 줄었다.',
    },
    { id: 'ending_default', title: '불확실한 월요일', narrative: '월요일 개장이 불안하다.' },
  ],
  scoring: {
    weights: {
      liquidity: 30,
      solvency: 20,
      marketRisk: 10,
      communication: 15,
      compliance: 10,
      policy: 5,
      timeliness: 10,
    },
    rules: {
      liquidity: {
        components: [
          {
            kind: 'survival',
            alive: 100,
            orderlyFail: 50,
            disorderlyFail: 0,
            weight: 0.3,
            label: '생존',
          },
          {
            kind: 'metric',
            metric: 'survivalDays',
            aggregate: 'min',
            curve: [
              [0, 0],
              [1, 40],
              [3, 80],
              [5, 100],
            ],
            weight: 0.4,
            label: '최저 생존 일수',
          },
          { kind: 'expert', weight: 0.3 },
        ],
      },
      compliance: {
        components: [
          {
            kind: 'counter',
            key: 'timeouts',
            curve: [
              [0, 100],
              [3, 0],
            ],
            weight: 0.3,
            label: '시간 초과',
          },
          {
            kind: 'metric',
            metric: 'regulatorLevel',
            aggregate: 'max',
            curve: [
              [0, 100],
              [4, 0],
            ],
            weight: 0.3,
            label: '감독당국 최고 단계',
          },
          { kind: 'expert', weight: 0.4 },
        ],
      },
      policy: {
        components: [
          { kind: 'adjust', weight: 0.5, label: '옵션 보정' },
          { kind: 'expert', weight: 0.5 },
        ],
      },
      timeliness: {
        components: [
          {
            kind: 'flag',
            key: 'guarantee',
            byTurn: 1,
            ifSet: 100,
            ifNot: 40,
            weight: 0.5,
            label: 'T1까지 검증 유동성 공표',
          },
          { kind: 'expert', weight: 0.5 },
        ],
      },
    },
    failureCap: 40,
    failureCapOrderly: 60,
  },
  paths: {
    historical: {
      choices: {
        d0_disclosure: 'opt_b_unbackstopped',
        d1_funding: ['draw_fhlb', 'sell_afs'],
        d2_comms: 'ceo_calm_call',
        d3_weekend: 'reject_help',
      },
      note: '손실 공개 → 런 → 안심 콜 → 독자 생존',
    },
    expert: {
      choices: {
        d0_disclosure: 'opt_a_backstopped',
        d1_funding: ['draw_fhlb', 'seek_guarantee'],
        d2_comms: 'publish_liquidity',
        d3_weekend: 'accept_consortium',
      },
      note: '백스톱 증자 → 여력 인출 + 검증 성명 → 컨소시엄 수용',
    },
  },
  checkpoints: [
    // Historical path, after T1 decisions: cumulative deposit outflow after the first run-off day.
    {
      turnId: 't1',
      metric: 'cumulativeOutflow',
      expected: 3.88,
      tolerance: 0.15,
      label: 'T1 누적 유출',
    },
  ],
  debrief: {
    historical: {
      summary: '백스톱 없는 손실 공개가 런을 촉발했다.',
      timeline: [
        { turnId: 't0', note: '손실 공개', sourceRefs: [SRC_PRIMARY] },
        { turnId: 't2', note: '피어 실패로 유출 가속', sourceRefs: [SRC_PRIMARY] },
      ],
      outcome: '예금 기반이 크게 줄었다.',
    },
    expert: {
      summary: '백스톱 증자와 검증된 수치 공표가 런을 막았다.',
      rationale: '완화 계수의 곱이 유출률을 S0 수준으로 되돌린다.',
      caveats: ['합성 시나리오이므로 실제 사례와 다르다.'],
    },
    lessons: [
      {
        id: 'l1',
        title: '백스톱 없는 공개는 방아쇠다',
        body: '증자 성공 여부가 불확실하면 예금자는 먼저 움직인다.',
        sourceRefs: [SRC_PRIMARY],
      },
      {
        id: 'l2',
        title: 'HTM 매각의 함정',
        body: 'tainting 규칙 때문에 부분 매각도 전체 손실을 가시화한다.',
        sourceRefs: [SRC_REG],
        when: { chose: { decision: 'd1_funding', option: 'sell_htm' } },
      },
    ],
    quiz: [
      {
        id: 'q1',
        type: 'single',
        prompt: '완전 백스톱 증자의 신뢰지수 영향은?',
        choices: [
          { id: 'a', text: '−5' },
          { id: 'b', text: '−25' },
        ],
        answer: ['a'],
        explanation: '백스톱이 있으면 충격이 제한된다.',
        sourceRefs: [SRC_PRIMARY],
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'HTM 일부 매각은 장부 전체를 tainting한다.',
        answer: true,
        explanation: 'ASC 320 규칙.',
        sourceRefs: [SRC_REG],
      },
      {
        id: 'q3',
        type: 'numeric',
        prompt: 'S2(공개 런) 상태의 네트워크 무보험 예금 일일 유출률(%)은?',
        answer: 35,
        tolerance: 5,
        unit: '%',
        explanation: '보정 규칙 6.3 표.',
        sourceRefs: [SRC_REG],
      },
    ],
  },
})

export default miniBank
