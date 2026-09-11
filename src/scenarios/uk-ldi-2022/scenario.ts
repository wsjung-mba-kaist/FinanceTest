import type { PensionState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { ldiDebrief } from './debrief'
import { ldiInitialConfidence, ldiInitialMarket, ldiInitialPension } from './initialState'
import { ldiScoring } from './scoring'
import { LDI_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

/** 게임오버 임계값 (calibration.md §7). */
export const HEDGE_COLLAPSE_PCT = 40
export const HEDGE_UNWOUND_PCT = 20
export const FORCED_CUT_COLLAPSE = 0.3
export const FUNDING_COLLAPSE_PCT = 90

const scenario: ScenarioDefinition<PensionState> = defineScenario<PensionState>({
  meta: {
    id: 'uk-ldi-2022',
    version: 1,
    title: '길트 스파이럴: 13일',
    subtitle: '2022년 9월 영국 LDI·국채 위기',
    era: '2022-09',
    year: 2022,
    region: 'global',
    role: 'pension_cio',
    roleTitle: 'DB 연기금 최고투자책임자(CIO)',
    institutionType: 'pension',
    institutionName: '노스브리지 연금스킴(Northbridge Pension Scheme)',
    modelledOn:
      '영국 DB 연금 우주(PPF Purple Book 2022)를 £5bn 규모로 양식화한 풀드 LDI 투자 스킴. 외생 사건·시장 데이터·정책 대응은 BoE FSR 2022-12 / Quarterly Bulletin 2023 / FPC 스태프 페이퍼 2023-03 / TPR 가이드 2023-04 / IMF WP 23/210 기록',
    difficulty: 'standard',
    durationTurns: 8,
    turnUnit: 'day',
    estMinutes: 35,
    timezone: 'Europe/London',
    learningObjectives: [
      {
        id: 'lo1',
        text: '레버리지 LDI의 담보 회계(PV01·버퍼 bp·레버리지 밴드)를 이해하고, 담보 워터폴에서 구속 제약이 지급능력이 아니라 "며칠 안에 현금이 도착하는가"임을 적용한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d1', 't1-d1', 't2-d1', 't3-d1', 't4-d1', 't6-d1'],
      },
      {
        id: 'lo2',
        text: '위기 중 헤지 축소가 담보 문제를 금리 방향 베팅으로 바꾸는 이유와, 반전(−100bp) 시 언헤지 손실의 크기를 설명한다.',
        competency: 'marketRisk',
        decisionIds: ['t0-d1', 't2-d2', 't4-d1', 't5-d1', 't7-d1'],
      },
      {
        id: 'lo3',
        text: '개별 스킴에 합리적인 길트 매도가 집합적으로 스파이럴이 되는 구조와, 파이어세일 할인·비유동자산 급매가 펀딩비율에 남기는 영구 손실을 평가한다.',
        competency: 'solvency',
        decisionIds: ['t2-d1', 't3-d1', 't7-d2'],
      },
      {
        id: 'lo4',
        text: '시한이 있는 중앙은행 백스톱(임시 매입·담보 확대 레포)의 설계 의도를 이해하고, 창이 열린 동안 질서 있는 가격으로 담보를 재건하는 데 활용한다.',
        competency: 'policy',
        decisionIds: ['t5-d1', 't6-d1', 't7-d2'],
      },
      {
        id: 'lo5',
        text: '수탁자 거버넌스(위임 권한·운영 준비·스폰서 약정)와 감독당국(TPR) 대응이 회복력의 일부임을 인식한다.',
        competency: 'compliance',
        decisionIds: ['t0-d1', 't5-d1', 't6-d2'],
      },
    ],
    competencies: {
      liquidity: 3,
      marketRisk: 3,
      solvency: 1,
      policy: 1,
      communication: 1,
      compliance: 1,
    },
    tags: ['LDI', '마진콜', '레버리지', 'BoE', '담보버퍼', '파이어세일'],
    sources: LDI_SOURCES,
  },
  units: { currency: 'GBP', scale: 1e6, display: 'M' },
  initialState: {
    institution: ldiInitialPension,
    market: ldiInitialMarket,
    confidence: ldiInitialConfidence,
    regulatorLevel: 0,
    flags: {},
    counters: {},
  },
  briefing: {
    situation: `2022년 9월 22일 목요일. 귀하는 **노스브리지 연금스킴(Northbridge Pension Scheme)**의 최고투자책임자(CIO)입니다. 노스브리지는 부채(기술적 준비금) £5,000M, 자산 £4,900M(펀딩비율 98%)의 성숙한 확정급여(DB) 스킴으로, 부채 금리 민감도의 80%를 **풀드(pooled) LDI 펀드**로 헤지하고 있습니다. 풀은 레버리지 3배(익스포저 £4,200M / NAV £1,400M)이며 유동 담보 £907M — 금리 **120bp** 상승을 견딜 수 있는 버퍼 — 를 들고 있습니다.

8월 1일 이후 30년 길트 금리는 이미 135bp 올라 버퍼는 200bp에서 120bp로 줄었습니다. 오늘 영란은행은 기준금리를 50bp 올려 2.25%로 하고 보유 길트 매각(QT)을 확정했습니다. 내일 신임 재무장관이 "성장 계획"을 발표합니다.

시나리오는 8턴입니다: 9월 22일 프롤로그(준비) → 9/23 미니예산 → 9/26 월요일 → 9/27 화요일 → 9/28 수요일 오전 → 9/28 수요일 오후 → 10/10~11 → 10/14 종료.`,
    mandate: `**권한**: 수탁자 이사회가 정한 투자정책 안에서 현금 송금·자산 매각·담보 조달·LDI 운용사 지시를 실행합니다. £100M 이상 집행과 헤지비율 변경은 원칙적으로 투자위원회 결의가 필요합니다(T0에서 위임 권한을 확보하면 CIO가 £500M까지 당일 집행). 스폰서 출연은 스폰서 이사회 승인이 필요합니다. 풀드펀드 규정(레버리지 밴드·딜링 컷오프·현금 납입)은 개별 협상이 불가능합니다.

**목표**: 10월 14일까지 헤지를 유지한 채 담보 콜을 충당하고, 펀딩비율과 스킴 자산을 보전하며, 종료 후를 버틸 버퍼를 재건하십시오. 운용사가 강제로 헤지를 잘라내면 최악의 가격에 최악의 시점에 팔리는 것입니다.`,
    institutionProfile: `| 항목(£M) | 노스브리지 | 비고 |
|---|---|---|
| 부채(기술적 준비금) | 5,000 | 수정듀레이션 19년 |
| 현금 | 150 | 자산의 3% |
| 직접보유 길트(장기) | 600 | D≈18년, 담보 예비·매각 가능 |
| 회사채(IG) | 1,000 | D≈7년, T+2 결제 |
| 주식 | 1,000 | T+2 결제 |
| 비유동자산(사모·부동산) | 750 | 세컨더리 수 주, 할인 30~40% |
| LDI 풀 NAV | 1,400 | 익스포저 4,200 (레버리지 3.0x), D≈18년 |
| **총자산** | **4,900** | 펀딩비율 98% |
| 헤지비율 | 80% | 풀 PV01 7.56 / 부채 PV01 9.5 |
| **담보 여력** | **120bp** | 유동 담보 907 (현금 300 + 적격 길트 607) ÷ PV01 7.56 |
| 스폰서 긴급 출연 여력 | 300 | 중간 커버넌트, 이사회 승인 필요 |

**풀드펀드 규정**: 레버리지 4.5x 초과 시 규정상 익스포저 축소(길트 매도). 신규 납입은 현금만, 딜링 컷오프 오전 11시(T+1). 재자본화 요청 시 통상 5영업일 내 자금 도착 가정.

**알려진 취약점(9월 22일 기준)**: 현물(길트) 이전 약정 없음, CIO 위임 권한 없음(£100M 이상은 위원회), 스폰서 대기성 약정 없음, 주식·회사채 매각은 T+2.`,
    marketBackdrop: `영란은행은 2021년 12월 이후 7회 인상해 기준금리 2.25%에 이르렀고, 오늘 APF 보유 길트 £800억 감축(능동 매각 10월 개시)을 확정했습니다. 30년 길트는 3.80%(8/1 대비 +135bp), 파운드는 1.125달러로 1985년 이후 최저권입니다. 시장은 내일 "성장 계획"의 재원 없는 감세 규모를 £300억 안팎으로 예상하지만 OBR 전망은 동반되지 않을 것으로 알려져 있습니다. LDI 시장은 약 £1.4tn의 부채를 헤지하며, 풀드펀드가 10~15%(≈£200bn)를 차지합니다. 2000년 이후 30년 길트의 최대 일일 변동은 29bp입니다.`,
    stakeholders: [
      {
        name: '수탁자 이사회·투자위원회',
        wants: '펀딩비율 보전, 가입자 급여 안전, 절차 준수',
        canDo: '헤지 정책 결의, 위임 권한 부여, 대규모 집행 승인(정기 위원회 월요일)',
      },
      {
        name: '스폰서(모기업 CFO)',
        wants: '분담금 예측 가능성, 회수계획 안정',
        canDo: '긴급 출연(이사회 승인 며칠), 대기성 약정 사전 서명',
      },
      {
        name: 'LDI 풀드펀드 운용사',
        wants: '펀드 규정 준수, 전체 투자자 보호',
        canDo:
          '담보 콜·재자본화 요청, 레버리지 밴드 초과 시 강제 축소, 경매 참여 대행, 현물 이전 약정',
      },
      {
        name: '영란은행·FPC',
        wants: '길트 시장 기능·금융안정',
        canDo: '임시 매입(시한부), 담보 확대 레포, 사후 회복력 기준',
      },
      {
        name: '연금규제청(TPR)',
        wants: '수탁자 거버넌스·회복력 점검',
        canDo: '정보 요청, 성명·가이드, 사후 감독 강화',
      },
      {
        name: '투자 컨설턴트',
        wants: '자문 책임 관리',
        canDo: '워터폴 설계 자문, 위원회 보고, 매각 지시 지원',
      },
      {
        name: '레포 은행·딜러',
        wants: '담보 충분, 대차대조표 관리',
        canDo: '헤어컷 인상, 롤오버 거부, 장기물 매수호가 철회',
      },
    ],
    regulatoryFramework: `- **TPR·수탁자 의무**: 수탁자는 투자 리스크 관리와 유동성 계획 책임이 있다. 위기 전 레버리지 LDI에 대한 정량 기준(버퍼 bp)은 없었다.
- **FPC**: 금융안정 관점에서 LDI 펀드 회복력을 관찰하며, 위기 중 영란은행 임시 매입을 권고했다. 사후 기준은 게임 종료 후 에필로그에서 다룬다.
- **풀드(pooled) vs 세그리게이티드(segregated) LDI**: 풀드펀드는 여러 스킴의 공동 펀드로 규정(레버리지 밴드·딜링 사이클·현금 납입)이 일률 적용되며 개별 협상이 불가하다. 세그리게이티드 계좌는 현물 담보·맞춤 절차가 가능해 위기를 비교적 잘 넘겼다.
- **레포·스왑 담보 메커니즘**: 풀은 길트를 레포로 조달하거나 스왑으로 익스포저를 만든다. 금리 상승 → 포지션 평가손 → 변동증거금(현금·적격 길트) 콜 → 풀 담보 소진 → 재자본화 요청 → 미도착 시 익스포저 축소(길트 매도). 매도가 금리를 올려 콜이 다시 커지는 것이 스파이럴이다.
- **담보 회계(게임)**: PV01 = 익스포저 × 듀레이션 / 10,000. 버퍼(bp) = 유동 담보 / PV01. 레버리지 = 익스포저 / NAV. 레버리지 > 4.5x 또는 잔여 콜 > 담보이면 강제 축소.
- **결제 관행**: 주식·회사채 T+2, 길트 당일 체결(운용사가 당일 인정), 풀 현금 납입 T+1(위임·당일 딜링 시 당일), 스폰서 출연 이사회 승인 후.
- **감독 단계 R0~R4(게임)**: 강제 축소 → TPR 강화 모니터링(R1) → 미회신·반복 축소 시 서면 요구(R2).`,
    cardRefs: [
      'ldi-leverage-buffer-250bp',
      'ldi-collateral-waterfall',
      'hqla-and-haircuts',
      'regulator-escalation-ladder',
    ],
    simplificationNotes: [
      '노스브리지는 PPF Purple Book 2022의 DB 스킴 우주 자산배분을 £5bn 규모로 양식화한 합성 스킴이며, 풀 레버리지 3x·버퍼 120bp는 계획서 설계값(BoE 스태프 페이퍼: 위기 전 풀드펀드 100~150bp)이다(facts.ts STYLIZED).',
      '30년 길트 경로는 9/23~27 +130bp(35/50/45로 분할[CAL]), 9/28 −110bp, 9/29~10/11 +95bp, 10/12~14 +10bp로 양식화했다. 일별 종가는 BoE 수익률곡선 통계 기준 근사이며 10/14 값은 장중 재돌파를 반영한 STYLIZED 값이다.',
      '파이어세일 할인 사다리(2%→4%→7%→8~10%, 경매 0.5%, 종료 후 5%)와 결제 일수·딜링 컷오프는 보정값[CAL]이다(calibration.md §4·§5).',
      '풀 담보 회계는 NAV·유동 담보·잔여 콜 세 변수로 단순화했다. 실제 풀드펀드의 변동증거금은 스왑·레포 거래상대별로 나뉘고 적격 담보 범위가 다르다.',
      '스폰서 출연 여력 £300M(대기 약정 시 £600M), TPR 통화 시점(10/11), 운용사 표준 회신서는 양식화된 설정이다.',
      '펀딩비율은 자산(풀 NAV 포함)/부채(PV)로 단순 계산하며, 물가연동 부채·회수계획 분담금은 제외했다.',
      '9월 28일(오전·오후 두 턴)은 서브턴 5틱으로 진행된다. 틱 라벨과 장중 금리 경로는 양식화이며 관측 앵커는 종가(9/27 5.10%, 9/28 4.05%)뿐이다 — 오전 장중 고점 5.15%는 관측값이 아니라 보간값[CAL]으로, 커늘리프 서한(2022-10-05)의 9/28 일중 변동폭 127bp와 "100bp 초과 하락"이 만드는 5.05~5.32% 구간 안에서 잡았다. 중간에 걸려 오는 전화와 스폰서 협상의 대사는 공개 기록을 바탕으로 한 재구성이며 녹취가 아니다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(영란은행 FSR·QB·FPC 스태프 페이퍼·보도자료, TPR 가이드·성명, IMF 워킹페이퍼, 의회 위원회 보고서)를 바탕으로 교육 목적으로 재구성한 것이며, 합성 스킴의 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'collateralHeadroomBp',
      label: '담보 여력(bp)',
      labelEn: 'Collateral Headroom',
      unit: 'bp',
      primary: true,
      sparkline: true,
      description: '풀 유동 담보 ÷ PV01 — 추가로 견딜 수 있는 금리 상승폭',
      decimals: 0,
      referenceLabel: '위기 전 업계 100~150bp',
    },
    {
      metric: 'marginCallPending',
      label: '마진콜 대기액',
      labelEn: 'Pending Margin Calls',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '풀 담보로 충당하지 못한 잔여 콜 — 0이 아니면 다음 상승 시 강제 축소',
      decimals: 0,
    },
    {
      metric: 'hedgeRatio',
      label: '헤지비율',
      labelEn: 'Hedge Ratio',
      unit: '%',
      primary: true,
      sparkline: true,
      description: '부채 금리 민감도 중 헤지된 비율 — 40% 미만이면 헤지 붕괴',
      decimals: 0,
    },
    {
      metric: 'ldiLeverage',
      label: 'LDI 레버리지',
      labelEn: 'LDI Leverage',
      unit: 'x',
      sparkline: true,
      description: '익스포저 ÷ NAV — 4.5x 초과 시 운용사 규정상 축소',
      decimals: 2,
      referenceLabel: '밴드 상한 4.5x',
    },
    {
      metric: 'liquidAssets',
      label: '유동자산(현금+직접보유 길트)',
      labelEn: 'Liquid Assets',
      unit: 'ccy',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'fundingRatio',
      label: '펀딩비율',
      labelEn: 'Funding Ratio',
      unit: '%',
      sparkline: true,
      description: '총자산(풀 NAV 포함) ÷ 부채 PV',
      decimals: 1,
    },
    {
      metric: 'govt30y',
      label: '30년 길트 금리',
      labelEn: '30Y Gilt Yield',
      unit: 'rate',
      sparkline: true,
      decimals: 2,
    },
    {
      metric: 'confidence',
      label: '신뢰지수(수탁자·스폰서·운용사)',
      labelEn: 'Confidence Index',
      unit: 'index',
      sparkline: true,
    },
  ],
  thresholds: {
    hedgeRatio: { warn: 70, breach: HEDGE_COLLAPSE_PCT, direction: 'below' },
    fundingRatio: { warn: 95, breach: FUNDING_COLLAPSE_PCT, direction: 'below' },
    marginCallPending: { warn: 1, breach: 200, direction: 'above' },
  },
  turns: [...turnsA, ...turnsB],
  /**
   * 라이브 플레이(variance 1)에서만 쓰이는 크기 노이즈. variance 0(정본·체크포인트)에서는 엔진이
   * 난수를 아예 당기지 않는다. 하우스 기본값 그대로다 — `tickerSigmaBp`를 3으로 올려 보았으나
   * 9/28 종가(4.05%)가 체크포인트 허용폭(±0.12%p) 밖으로 벗어나는 시드가 열에 셋이었다.
   * `runoffSigma`·`runoffCap`은 예금 유출 모델의 계수이고 연기금에는 `runoffStep`이 없어
   * **이 시나리오에서는 쓰이지 않는다**(선언만 유지). calibration.md §12.6.
   */
  noise: {
    runoffSigma: 0.15,
    runoffCap: 0.3,
    tickerSigma: 0.01,
    tickerSigmaBp: 2,
    eventJitter: 1,
  },
  gameOver: [
    {
      id: 'funding_collapse',
      when: { metric: 'fundingRatio', lt: FUNDING_COLLAPSE_PCT },
      reason: 'funding_collapse',
      title: '펀딩 급락 — 언헤지 반전',
      narrative:
        '헤지가 줄어든 상태에서 금리가 반전해 부채가 자산보다 훨씬 빨리 늘었습니다. 펀딩비율이 90% 아래로 떨어지자 스폰서는 회수계획 재협상을 요구했고, TPR은 수탁자 거버넌스 조사를 시작했습니다. 스킴은 존속하지만 수탁자 이사회는 교체됩니다.',
      failed: true,
      ruleText: '펀딩비율(총자산/부채)이 90% 미만으로 떨어지면 시나리오가 종료됩니다.',
    },
    {
      id: 'hedge_collapse',
      when: {
        all: [
          { counter: 'forcedDeleverage', gte: FORCED_CUT_COLLAPSE },
          { metric: 'hedgeRatio', lt: HEDGE_COLLAPSE_PCT },
        ],
      },
      reason: 'hedge_collapse',
      title: '헤지 붕괴 — 강제 디레버리징',
      narrative:
        '재자본화 자금이 제때 도착하지 않아 운용사가 풀 규정에 따라 익스포저를 잘라냈습니다. 강제 축소가 누적되어 헤지비율이 40% 아래로 떨어졌고, 길트는 최악의 호가에 팔렸습니다. 금리가 반전하면 부채는 늘고 자산은 따라오지 않습니다. 수탁자 이사회는 TPR의 서면 요구를 받았습니다.',
      failed: true,
      ruleText:
        '운용사의 강제 축소 누적이 익스포저의 30% 이상이고 헤지비율이 40% 미만으로 떨어지면 시나리오가 종료됩니다.',
    },
    {
      id: 'hedge_unwound',
      when: {
        all: [{ flag: 'hedge_cut_voluntary' }, { metric: 'hedgeRatio', lt: HEDGE_UNWOUND_PCT }],
      },
      reason: 'hedge_unwound',
      title: '헤지 해제 — 수탁자의 자발적 언와인드',
      narrative:
        '수탁자 결의로 헤지 대부분을 풀었습니다. 담보 콜은 사라졌지만 스킴은 이제 금리 방향에 그대로 노출됩니다. 강제 매도는 피했으므로 질서 있는 실패로 기록됩니다 — 그러나 부채 대비 리스크 관리는 포기한 것입니다.',
      failed: true,
      orderly: true,
      ruleText:
        '수탁자의 자발적 축소로 헤지비율이 20% 미만이 되면 질서 있는 실패로 종료됩니다 (부분점수). 헤지가 남은 채 금리가 반전하면 펀딩 급락 규칙이 먼저 적용될 수 있습니다.',
    },
  ],
  endings: [
    {
      id: 'resilient',
      when: {
        all: [
          { metric: 'collateralHeadroomBp', gte: 250 },
          { metric: 'hedgeRatio', gte: 70 },
          { notFlag: 'forced_deleverage' },
        ],
      },
      title: '버퍼 재건 — 준비가 만든 결과',
      narrative:
        '10월 14일, 임시 매입이 예정대로 끝났습니다. 노스브리지는 강제 축소 없이 헤지를 지켰고, 창이 열린 동안 질서 있는 가격으로 담보를 재건해 250bp 이상의 버퍼로 종료일을 맞았습니다. 에필로그: 2023년 3월 29일 FPC는 LDI 펀드의 최소 회복력을 250bp로 정했고, TPR은 4월 가이드에서 250bp 시장 스트레스 버퍼에 운영 버퍼를 더하고 담보 보충 5일을 가정하도록 했습니다. 귀 스킴은 그 기준을 이미 충족한 채 2023년을 맞습니다. 다만 성장자산 비중이 줄어 기대수익은 낮아졌습니다 — 그것이 회복력의 가격입니다.',
    },
    {
      id: 'rebuilt',
      when: { metric: 'collateralHeadroomBp', gte: 250 },
      title: '버퍼 재건 — 상처 입은 헤지',
      narrative:
        '10월 14일, 임시 매입이 끝났습니다. 버퍼는 250bp 이상으로 재건되었지만, 그 과정에서 헤지 일부가 최악의 시점에 잘려 나갔거나 스킴 자산이 파이어세일 가격에 팔렸습니다. 에필로그: 2023년 3월 FPC는 최소 회복력 250bp를, TPR은 4월 "250bp + 운영 버퍼, 담보 보충 5일"을 기준으로 정했습니다. 귀 스킴은 기준을 충족하지만, 디브리핑의 파이어세일 손실과 헤지비율 경로를 보십시오 — 같은 버퍼를 9월 22일에 만들었다면 그 손실은 없었습니다.',
    },
    {
      id: 'exposed',
      title: '생존 — 그러나 다음 충격에 무방비',
      narrative:
        '10월 14일, 임시 매입이 끝났고 노스브리지는 살아남았습니다. 그러나 버퍼는 250bp에 미치지 못합니다. 에필로그: 2022년 12월 FPC는 LDI 펀드에 300~400bp 수준의 회복력 유지를 요구했고, 2023년 3월 29일 최소 250bp를 기준으로 정했으며, TPR은 4월 가이드에서 운영 버퍼와 5일 보충 가정을 추가했습니다. 귀 스킴은 곧 운용사로부터 다시 재자본화 요청을 받게 됩니다 — 이번에는 위기가 아니라 규제 때문입니다.',
    },
  ],
  scoring: ldiScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-a'],
        't1-d1': ['t1-a'],
        't2-d1': ['t2-a', 't2-b'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-a'],
        't4-d1': ['t4-a'],
        't4-d2': ['t4-d2-a'],
        't5-d1': ['t5-a'],
        't6-d1': ['t6-a'],
        't6-d2': ['t6-d2-b'],
        't7-d1': ['t7-d1-a'],
        't7-d2': ['t7-d2-d'],
      },
      note: '풀드펀드 투자 스킴의 전형적 경로: 버퍼 방치(T0) → 금요일 대기(T1) → 월요일 T+2 매각 지시 + 길트 당일 매도(T2) → 화요일 길트 추가 매도(T3) → 수요일 아침 운용사 축소 수용(T4) → 개입 후 T+2 매각으로 재건(T5·T6) → 표준 회신 → 350bp·헤지 복원(T7). 체크포인트: 9/27 30년 ≈5.1%, 9/28 종가 ≈4.05%, 직접보유 길트 매도 ≈£500M, 강제 축소 발생.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-b', 't0-c', 't0-e'],
        't1-d1': ['t1-e', 't1-c'],
        't2-d1': ['t2-c', 't2-d'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-b', 't3-d'],
        't4-d1': ['t4-b', 't4-d'],
        't5-d1': ['t5-b', 't5-e'],
        't6-d1': ['t6-c', 't6-b'],
        't6-d2': ['t6-d2-a'],
        't7-d2': ['t7-d2-c'],
      },
      note: '준비(버퍼 확충 + 운영 준비 + 스폰서 대기약정) → 현물 이전·T+2 매각 조기 지시 → 헤지 유지 → 대기약정 스폰서·회사채 매각 → 경매 매도·보고 → 레포·경매 → TPR 회신 → 250bp + 운영 버퍼. 강제 축소 0회로 종료.',
    },
  },
  checkpoints: [
    {
      turnId: 't3',
      metric: 'govt30y',
      expected: 5.1,
      tolerance: 0.03,
      label: '9/27 30년 길트 ≈5.1% (9/22→27 3거래일 +130bp, BoE QB)',
    },
    {
      turnId: 't5',
      metric: 'govt30y',
      expected: 4.05,
      tolerance: 0.03,
      label: '9/28 종가 30년 길트 ≈4.0% (발표 당일 −100bp 이상, BoE QB)',
    },
    {
      turnId: 't7',
      metric: 'govt30y',
      expected: 5.1,
      tolerance: 0.03,
      label: '10/14 30년 길트 5% 재돌파 (8/1 대비 +270bp 초과, FSR 2022-12)',
    },
    {
      turnId: 't3',
      counter: 'giltsSoldDirect',
      expected: 500,
      tolerance: 0.15,
      label:
        '9/26~27 스킴 직접보유 길트 매도 ≈£500M (시스템 >£30bn의 풀드펀드 비례 배분 [CAL calibration.md §8])',
    },
  ],
  debrief: ldiDebrief,
})

export default scenario
