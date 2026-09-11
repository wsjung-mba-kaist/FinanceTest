import type { AssetManagerState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { fundDebrief } from './debrief'
import { fundInitialAm, fundInitialConfidence, fundInitialMarket } from './initialState'
import { fundScoring } from './scoring'
import { FUND_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

/** 게임오버 임계값 (docs/scenarios/covid-2020-fund.md §5). */
export const NAV_BREAK_INDEX = 83
export const GATE_DAYS_LIMIT = 2
export const ILLIQUID_WARN_PCT = 45

const scenario: ScenarioDefinition<AssetManagerState> = defineScenario<AssetManagerState>({
  meta: {
    id: 'covid-2020-fund',
    version: 1,
    title: '현금 확보 쇄도',
    subtitle: '2020년 3월 회사채 펀드 환매 위기',
    era: '2020-03',
    year: 2020,
    region: 'global',
    role: 'asset_manager_pm',
    roleTitle: '회사채 펀드 포트폴리오매니저(PM)',
    institutionType: 'asset_manager',
    institutionName: '하버라이트 크레딧펀드(Harborlight Credit Fund)',
    modelledOn:
      '미국 IG/HY 혼합 회사채 개방형 뮤추얼펀드 군(2020년 초 운용자산 $5~15bn 구간)을 $8bn 규모로 양식화한 합성 펀드. 특정 실제 펀드가 아니며, 유동성 사다리 구성과 보유자 집중도는 ICI의 2020년 채권펀드 보고서와 SEC 22e-4 유동성 구분을 참고해 만든 설계값이다. 외생 사건·시장 데이터·정책 대응은 실제 기록을 그대로 사용한다: 연준 보도자료(3/3·3/15·3/17·3/18·3/19·3/23), 연준 H.15 일별 국채금리, Cboe VIX 일별 종가, FEDS Note 2020-10의 IG·HY 스프레드 경로, SEC FIMSAC·BlackRock 자료의 채권 ETF 괴리, Falato·Goldstein·Hortaçsu(2021)의 펀드 유출, Ma·Xiao·Zeng(2022)의 매도 순서, O’Hara·Zhou(2021)의 거래비용',
    difficulty: 'standard',
    durationTurns: 8,
    turnUnit: 'day',
    estMinutes: 35,
    timezone: 'America/New_York',
    learningObjectives: [
      {
        id: 'lo1',
        text: '유동성 사다리(현금·1주·1개월·비유동)를 읽고, 환매 충당에서 수평(유동자산 우선) 슬라이싱과 수직(비례) 슬라이싱이 잔존 포트폴리오와 잔존 투자자에게 남기는 결과를 구분한다.',
        competency: 'liquidity',
        decisionIds: ['t1-d1', 't3-d1', 't4-d1', 't5-d2', 't7-d1'],
      },
      {
        id: 'lo2',
        text: '희석과 선착순 우위(first-mover advantage)를 정량으로 이해하고, 스윙프라이싱의 임계·폭 설정과 사전 결의 여부가 그 크기를 어떻게 바꾸는지 적용한다.',
        competency: 'marketRisk',
        decisionIds: ['t0-d1', 't2-d2', 't4-d1', 't5-d2', 't6-d1'],
      },
      {
        id: 'lo3',
        text: '채권 ETF의 NAV 대비 괴리를 "가격 오류"와 "기초자산 평가 지연"의 두 가설로 해석하고, 어느 쪽을 택하느냐가 평가·환매가격·매도 경로에 미치는 영향을 평가한다.',
        competency: 'marketRisk',
        decisionIds: ['t2-d1', 't3-d1', 't4-d1'],
      },
      {
        id: 'lo4',
        text: '환매 중단(게이트)·지급 연기·현물 환매·차입의 비용과 신호 효과를 비교하고, 감독·평판 결과를 포함해 선택한다.',
        competency: 'compliance',
        decisionIds: ['t5-d1', 't1-d1', 't5-i1', 't7-d1'],
      },
      {
        id: 'lo5',
        text: '시한이 정해지지 않은 중앙은행 백스톱의 발표 효과와 실행의 차이를 이해하고, 창이 열린 동안 유동성 사다리를 재건하는 판단을 연습한다.',
        competency: 'policy',
        decisionIds: ['t6-d1', 't6-i1', 't7-d1'],
      },
    ],
    competencies: { liquidity: 3, marketRisk: 3, communication: 1 },
    tags: ['환매', '스윙프라이싱', 'ETF', 'SMCCF'],
    sources: FUND_SOURCES,
  },
  units: { currency: 'USD', scale: 1e6, display: 'M' },
  initialState: {
    institution: fundInitialAm,
    market: fundInitialMarket,
    confidence: fundInitialConfidence,
    regulatorLevel: 0,
    flags: {},
    counters: {},
  },
  briefing: {
    situation: `2020년 2월 28일 금요일 마감. 귀하는 **하버라이트 크레딧펀드(Harborlight Credit Fund)**의 포트폴리오매니저이자 유동성 총괄입니다. 순자산 $8,000M의 투자등급 중심 회사채 개방형 펀드로, 하이일드를 약 20% 섞어 운용합니다. 좌당 순자산은 $10.00입니다.

이번 주 S&P 500은 2008년 이후 최악의 한 주를 보냈고, 10년 국채는 1.13%까지 내려갔으며 VIX는 40.11로 마감했습니다. 금리 하락 덕분에 기준가는 아직 버티고 있지만 스프레드는 벌어지기 시작했고, 이번 주 순환매는 NAV의 0.3%로 아직 작습니다.

시나리오는 8턴입니다: 2/28 프롤로그(준비) → 3/9 첫 서킷브레이커 → 3/12 ETF 괴리 → 3/16 VIX 82.69 → 3/18 국채마저 팔리는 날(일중) → 3/20 게이트 논쟁(일중) → 3/23 연준 회사채 매입기구 발표(일중) → 3/24 되돌림.`,
    mandate: `**권한**: 매도 순서·조달 경로·현물 바스켓 설정·크레딧라인 인출을 직접 집행합니다. 스윙프라이싱의 임계와 최대 폭, 환매 중단, 정관 변경은 **펀드 이사회** 소관입니다. 환매 접수 자체를 거절하거나 특정 투자자를 선별해 유리한 가격을 줄 수는 없습니다.

**목표**: 3월 24일까지 강제 환매 중단 없이 통과하면서, ① 유동성 사다리(현금·1주 유동성)를 지키고 ② 잔존 투자자에 대한 희석을 최소화하며 ③ 남는 포트폴리오의 질(비유동 비중)을 보전하십시오. 기준가 하락 자체는 시장에서 오는 것이고 피할 수 없습니다 — 이 시나리오가 묻는 것은 그 비용을 **누가** 부담하는가입니다.`,
    institutionProfile: `| 유동성 사다리($M) | 금액 | 비중 | 당일 처분 한도 | 평시 왕복 비용 |
|---|---|---|---|---|
| 현금·T-bill·온더런 국채 | 560 | 7.0% | 제한 없음 | 2bp |
| 장기 국채·에이전시·벤치마크 IG | 1,040 | 13.0% | 잔고의 30% | 15bp |
| 일반 IG 회사채 | 3,600 | 45.0% | 잔고의 8% | 40bp |
| HY·오프벤치마크·144A | 2,800 | 35.0% | 잔고의 2.5% | 120bp |
| **합계 / 순자산** | **8,000** | **100%** | — | — |

당일 처분 한도에는 **시장 스트레스 계수**(= 30bp ÷ 현재 IG 왕복 거래비용, 하한 0.15)가 곱해집니다. 거래비용이 90bp면 한도는 3분의 1로 줄어듭니다.

| 그 밖의 상태 | 값 |
|---|---|
| 발행 좌수 / 좌당 순자산 | 800M좌 / $10.00 |
| 커밋 크레딧라인 | 약정 $400M(NAV의 5%), 인출 0 |
| 스윙프라이싱 | **임계·최대폭 미결의** — 적용하려면 이사회 결의 후 익영업일 |
| 현물(in-kind) 설정·환매 | 지정참가회사(AP) 2곳과 계약 체결 |
| 보유자 집중도 | 상위 5개 기관이 31%(최대 보유자 주정부 연금 11%) |

**알려진 취약점(2/28 기준)**: 스윙프라이싱 미결의, 현금 7%(업계 평균 수준), 비유동 35%, 보유자 집중도 높음.`,
    marketBackdrop: `2월 24~28일 주간에 S&P 500은 2008년 이후 최악의 낙폭을 기록했습니다. 10년 국채는 1.13%, 30년은 1.65%로 내려갔고 VIX는 40.11입니다. IG 회사채 스프레드는 약 130bp, HY는 약 500bp로 아직 역사적 범위 안에 있습니다. IG 왕복 거래비용은 32bp로 평시와 큰 차이가 없습니다.

연방기금 목표범위는 1.50~1.75%이고 시장은 인하를 상당폭 반영하고 있습니다. 미국 회사채 뮤추얼펀드와 ETF는 합쳐서 수조 달러 규모이며, 개방형 구조상 매일 환매를 지급해야 하는 반면 보유 자산의 상당 부분은 하루에 한두 번 거래됩니다 — 이 유동성 미스매치가 이번 달의 주제입니다.`,
    stakeholders: [
      {
        name: '펀드 이사회(독립이사 포함)',
        wants: '잔존 투자자 보호, 절차 준수, 설명 가능한 판단',
        canDo: '스윙프라이싱 임계·폭 결의, 환매 중단 승인, 평가 방법론 승인',
      },
      {
        name: '대형 기관 보유자(주정부 연금 등)',
        wants: '자기 유동성 계획의 예측 가능성, 공정한 환매가격',
        canDo: '전액·분할 환매, 현물 수령 동의, 다른 보유자에게 신호 전달',
      },
      {
        name: '플랫폼·랩 채널(퇴직연금 등)',
        wants: '정상적인 환매 처리',
        canDo: '하루 늦게 반영되는 대량 접수, 판매 중단',
      },
      {
        name: '프라이머리딜러 크레딧 데스크',
        wants: '자기 대차대조표 보호',
        canDo: '호가 축소·철회, 블록 인수 거부, 체결가 노출',
      },
      {
        name: '지정참가회사(AP)',
        wants: '설정·환매 차익, 재고 관리',
        canDo: '현물 바스켓 설정·환매 집행, 바스켓 적격 요건 제시',
      },
      {
        name: '크레딧라인 은행단',
        wants: '약정 이행과 자기 유동성 관리',
        canDo: '인출 응락(배분 조항), 갱신 거부, 인출 사실의 사실상 노출',
      },
      {
        name: 'SEC 투자관리국',
        wants: '투자자 공정대우, 유동성 관리 규칙 준수',
        canDo: '환매 중단 보고 요구, 스윙폭 적정성 조회, 사후 규칙 개정',
      },
      {
        name: '연방준비제도',
        wants: '시장 기능 회복',
        canDo: '금리·자산매입, 유동성 지원기구, 회사채 매입기구(3/23)',
      },
    ],
    regulatoryFramework: `- **1940년 투자회사법**: 개방형 펀드는 환매 청구 접수 후 **7일 이내** 지급해야 합니다. 환매 중단(suspension)은 SEC 명령 또는 극히 제한된 사유에서만 가능하며 보고 대상입니다.
- **규칙 22e-4(유동성 리스크 관리 프로그램)**: 자산을 유동성 구간으로 분류하고 고유동성 투자 최소 비중(HLIM)을 이사회가 정합니다. 비유동 투자는 15%를 넘을 수 없습니다(게임에서는 "비유동 구간"을 더 넓게 정의하므로 이 한도와 직접 대응하지 않습니다).
- **스윙프라이싱**: 2016년 SEC 규칙 개정으로 미국 등록 펀드에 허용되었습니다. 이사회가 임계(순환매 비율)와 최대 스윙폭을 결의해야 하고, 회계·중개(TA) 처리가 전제입니다. 2020년 3월 시점에 실제로 적용한 미국 등록 펀드는 사실상 없었습니다.
- **현물(in-kind) 환매**: 정관에 근거가 있으면 대량 환매를 채권 바스켓으로 지급할 수 있습니다. 잔존 투자자에게 비례적으로 공정해야 합니다.
- **공정가치 평가**: 거래가 드문 채권은 평가기관의 매트릭스 프라이싱을 쓰며, 이사회가 승인한 방법론 안에서 조정할 수 있습니다.
- **게임 내 감독 단계 R0~R4**: 스윙폭 적정성 조회·선별 공개 우려 → R1, 지급 연기 보고 → R2, 환매 중단 → R2 이상.
- **당시 존재하지 않았던 것**: 연준의 회사채 매입기구는 **3월 23일 이전에는 존재하지 않습니다**. MMLF(3/18)·CPFF·PDCF(3/17)도 각 발표일 이전에는 쓸 수 없습니다.`,
    cardRefs: [
      'fund-liquidity-ladder',
      'hqla-and-haircuts',
      'crisis-communication',
      'bank-run-dynamics',
    ],
    simplificationNotes: [
      '하버라이트 크레딧펀드는 합성 펀드다. 순자산 $8,000M, 좌당 $10.00, 유동성 사다리 7/13/45/35%, 크레딧라인 NAV의 5%, 보유자 집중도 31%는 모두 설계값[STYLIZED]이며 특정 실제 펀드의 수치가 아니다.',
      '국채 금리(2y/10y/30y)와 VIX는 각각 연준 H.15와 Cboe의 일별 종가를 그대로 쓴다. IG·HY 스프레드는 3/23 정점(IG 약 400bp, HY 1,087bp)만 출처값이고 나머지 일자는 그 경로를 일별로 보간한 [CAL] 값이다. 지수별 차이(ICE BofA 401bp / Bloomberg 373bp)는 체크포인트 허용오차로 흡수한다.',
      '회사채 ETF의 NAV 대비 괴리는 3/12의 −5.02%만 출처값이고 나머지 일자는 양식화[STYLIZED]했다. 2026-09 검증에서 발행사 iShares의 Rule 6c-11 프리미엄/할인 공시로 LQD 일별 계열 전체를 확보해 [VERIFY]를 해소했다 — 3/12 −5.02%, 3월 최대 할인은 **3/19 −5.08%**이며, 널리 인용되는 −5.35%는 같은 3/19 사건을 ICE의 평가가격 기준으로 잰 값이다. **미해소**: 게임의 T6(3/24) 값 −0.4%는 같은 공시의 관측치(+2.81% 프리미엄)와 어긋난다 — facts.ts 참조.',
      '턴별 환매 기저율(0.3/0.8/1.4/1.9/2.3/2.1/1.2/0.4%)은 2월 말~3/23 누적 약 10% of NAV(Falato·Goldstein·Hortaçsu 2021)에 맞춘 [CAL] 배분이다. 실제 일별 흐름은 이보다 불규칙했다.',
      '포트폴리오 시가평가는 구간별 유효 듀레이션(금리·스프레드)으로 단순화했고, 여기에 "집중도 마크다운"(비유동 비중이 35%를 넘는 만큼 HY 스프레드 확대에 더 크게 상각)을 더했다[CAL]. 실제 평가는 종목별이며 훨씬 복잡하다.',
      '구간별 당일 처분 한도(주간 30%·월간 8%·비유동 2.5%)와 시장 스트레스 계수(30bp ÷ 현재 거래비용)는 보정값[CAL]이다. 앵커는 O’Hara·Zhou(2021)의 거래비용 30→90bp, 블록 24→150bp+이다.',
      '두 개의 결정은 다단계 대화로 저작되어 있다 — T2 이사회 스윙프라이싱 통화(약속한 폭은 `swingPromisedBp` 카운터에 기록되고 다음 영업일 지연효과가 이행 여부를 판정한다)와 T5 최대 보유자 투자위원회 통화(공정성 약속은 2영업일 뒤 비유동 비중으로 판정된다). 대화는 언제나 그 결정이 원래 가진 옵션 하나로 귀결하므로 점수·경로 비교는 달라지지 않는다.',
      '일중 턴(3/18·3/20·3/23)은 4틱으로 양식화했다. 티커는 국채 10년·IG/HY 스프레드·VIX만 일중으로 움직이고 나머지 지표는 개장 시점 값으로 고정된다. 환매의 일중 분포도 저작된 값이며, 조각의 합은 틱이 없는 턴의 1회 처리와 정확히 같다.',
      '인물의 발언(딜러, 보유자 CIO, 이사회 의장, 사내 메모)과 다단계 대화(이사회 스윙프라이싱 통화, 최대 보유자 투자위원회 통화)의 모든 대사는 개연성 있는 재구성이며 실제 녹취나 인용이 아니다.',
      '기업 재무담당(리볼버 인출)·프라임 MMF·베이시스 트레이더의 결정은 이 역할에서 다루지 않는다. 그들의 행동은 외생 이벤트와 시장 데이터로만 등장한다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(연준 보도자료·H.4.1·H.15·금융안정보고서·FEDS Notes, Cboe, FSB·BIS·SEC·ESMA 자료, 학술 논문, 업계 보고서)를 바탕으로 교육 목적으로 재구성한 것이며, 합성 펀드의 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'cashBufferPct',
      label: '현금·1일 유동성 비중',
      labelEn: 'Cash Buffer',
      unit: '%',
      primary: true,
      sparkline: true,
      description: '현금·T-bill·온더런 국채 ÷ 순자산 — 내일 환매를 즉시 지급할 수 있는 여력',
      decimals: 1,
      referenceLabel: '기준일 7.0%',
    },
    {
      metric: 'redemptionsCumulativePct',
      label: '누적 환매(기준일 NAV 대비)',
      labelEn: 'Cumulative Redemptions',
      unit: '%',
      primary: true,
      sparkline: true,
      description: '2/28 순자산 대비 누적 환매 지급액. 업계 평균은 3/23까지 약 10%였다',
      decimals: 2,
    },
    {
      metric: 'illiquidSharePct',
      label: '비유동 비중(잔존 포트폴리오)',
      labelEn: 'Illiquid Share',
      unit: '%',
      primary: true,
      sparkline: true,
      description: 'HY·오프벤치마크·144A ÷ 총자산 — 수평 슬라이싱이 올리고 수직 슬라이싱이 지킨다',
      decimals: 1,
      referenceLabel: '기준일 35.0%',
    },
    {
      metric: 'dilutionBp',
      label: '누적 희석(bp)',
      labelEn: 'Cumulative Dilution',
      unit: 'bp',
      sparkline: true,
      description:
        '환매 대응 비용 중 잔존 투자자가 부담한 부분. 스윙폭이 실제 비용과 같으면 0이 된다',
      decimals: 0,
    },
    {
      metric: 'navIndex',
      label: '기준가 지수(2/28 = 100)',
      labelEn: 'NAV per Share Index',
      unit: 'index',
      sparkline: true,
      description: '좌당 순자산 / $10.00 × 100',
      decimals: 2,
    },
    {
      metric: 'market.etfDiscountPct',
      label: '회사채 ETF의 NAV 괴리',
      labelEn: 'Bond ETF Discount to NAV',
      unit: '%',
      sparkline: true,
      description: '음수는 할인. 2020년 3월 최대 −5.08%(3/19), 3/12은 −5.02%',
      decimals: 2,
    },
  ],
  thresholds: {
    cashBufferPct: { warn: 4, breach: 1.5, direction: 'below' },
    weeklyLiquidityPct: { warn: 14, breach: 7, direction: 'below' },
    redemptionsPendingPct: { warn: 1.5, breach: 3, direction: 'above' },
    illiquidSharePct: { warn: ILLIQUID_WARN_PCT, breach: 55, direction: 'above' },
    dilutionBp: { warn: 50, breach: 120, direction: 'above' },
    navIndex: { warn: 90, breach: NAV_BREAK_INDEX, direction: 'below' },
    'market.etfDiscountPct': { warn: -2, breach: -4.5, direction: 'below' },
  },
  turns: [...turnsA, ...turnsB],
  noise: {
    runoffSigma: 0.12,
    runoffCap: 0.25,
    tickerSigma: 0.01,
    tickerSigmaBp: 3,
    eventJitter: 1,
  },
  gameOver: [
    {
      id: 'forced_gate',
      when: { flag: 'forced_gate' },
      reason: 'forced_gate',
      title: '강제 환매 중단 — 지급할 현금을 만들지 못했다',
      narrative:
        '구간별 당일 처분 한도를 모두 쓰고도 접수된 환매를 지급하지 못했습니다. 펀드는 그날 환매를 중단했고, 감독당국에 즉시 보고했으며, 보유자 공지가 나갔습니다. 유동성 문제가 평판·감독 문제로 바뀌는 데 걸린 시간은 하루였습니다. 이 결과는 지급능력의 문제가 아니라 "오늘 무엇을 팔 수 있는가"의 문제였습니다 — 팔 수 있는 것을 먼저 다 팔았기 때문입니다.',
      failed: true,
      ruleText:
        '당일 처분 한도를 모두 사용하고도 접수된 환매를 $1M 이상 지급하지 못하면 환매가 강제 중단되고 시나리오가 종료됩니다.',
    },
    {
      id: 'nav_break',
      when: { metric: 'navIndex', lt: NAV_BREAK_INDEX },
      reason: 'nav_break',
      title: '기준가 붕괴 — 운용 위임 상실',
      narrative:
        '좌당 순자산이 기준일 대비 17% 넘게 떨어졌습니다. 같은 기간 IG 회사채 지수의 하락폭은 그 절반 수준이었습니다. 시장 손실만으로는 여기까지 오지 않습니다 — 레버리지, 파이어세일 할인, 그리고 유동자산을 먼저 판 결과 남은 비유동 집중 포트폴리오의 추가 상각이 겹친 결과입니다. 대형 보유자 두 곳이 위임을 철회했고 이사회는 운용사 교체 절차를 개시했습니다.',
      failed: true,
      ruleText: `좌당 순자산 지수가 ${NAV_BREAK_INDEX}(기준일 대비 −17%) 미만으로 떨어지면 시나리오가 종료됩니다.`,
    },
    {
      id: 'suspension_wind_down',
      when: { all: [{ flag: 'gated_voluntary' }, { counter: 'gateTurns', gte: GATE_DAYS_LIMIT }] },
      reason: 'suspension_wind_down',
      title: '환매 중단 장기화 — 질서 있는 청산',
      narrative:
        '자발적 환매 중단이 이틀을 넘겼습니다. 이사회는 펀드를 재개하는 대신 순차 매각 후 분배하는 청산 절차를 결정했습니다. 파이어세일은 피했고 보유자는 시간을 두고 자산을 회수하게 됩니다 — 질서 있는 실패로 기록되지만, 개방형 펀드로서의 약속은 지켜지지 않았습니다.',
      failed: true,
      orderly: true,
      ruleText: `자발적 환매 중단이 ${GATE_DAYS_LIMIT}영업일을 넘기면 질서 있는 청산으로 종료됩니다(부분 점수).`,
    },
  ],
  endings: [
    {
      id: 'resilient',
      when: {
        all: [
          { notFlag: 'forced_gate' },
          { notFlag: 'gated_voluntary' },
          { metric: 'illiquidSharePct', lte: 38 },
          { metric: 'dilutionBp', lte: 45 },
        ],
      },
      title: '사다리를 지킨 3월',
      narrative:
        '3월 24일. 하버라이트는 환매를 한 번도 막지 않고 통과했고, 남는 투자자는 열화되지 않은 포트폴리오를 들고 있습니다. 기준가는 시장이 가져간 만큼 내려갔지만 그 이상은 아닙니다. 에필로그: 2023년 12월 FSB는 개방형 펀드 권고를 개정해 희석방지도구의 상시 준비·사용을 1순위로 올렸고, SEC는 2023년 MMF 개혁에서 임의 게이트를 폐지하고 의무 유동성 수수료를 도입했습니다. 귀하의 펀드는 그 기준을 이미 충족한 채 4월을 맞습니다. 다만 현금을 늘리고 비유동 비중을 줄인 만큼 기대수익은 낮아졌습니다 — 그것이 회복력의 가격입니다.',
    },
    {
      id: 'repaired',
      when: {
        all: [{ notFlag: 'forced_gate' }, { metric: 'illiquidSharePct', lte: 44 }],
      },
      title: '살아남았다 — 남는 사람이 낸 값으로',
      narrative:
        '3월 24일. 환매는 끝까지 지급되었고 펀드는 문을 닫지 않았습니다. 그러나 디브리핑의 "누적 희석"과 "비유동 비중" 경로를 보십시오 — 나간 사람은 대체로 온전한 값을 받았고, 그 비용은 남은 사람이 냈습니다. 에필로그: 이후 규제는 정확히 이 지점을 겨냥합니다. FSB 2023년 권고는 희석방지도구 우선을, SEC 2023년 MMF 개혁은 의무 유동성 수수료를 도입했습니다. 같은 도구를 2월 28일에 결의해 두었다면 이 비용의 대부분은 없었습니다.',
    },
    {
      id: 'degraded',
      title: '살아남았으나 포트폴리오가 달라졌다',
      narrative:
        '3월 24일. 펀드는 존속하지만 남은 것은 3월 초의 포트폴리오가 아닙니다. 팔 수 있는 것을 먼저 팔았고, 남은 것은 팔기 가장 어려운 종이입니다. 다음 충격에 이 펀드가 견딜 수 있는지는 다음 충격의 크기가 아니라 오늘의 구성이 정합니다. 에필로그: 연준의 회사채 매입기구는 3월 23일에 왔지만, 그것이 다음에도 온다는 보장은 없습니다.',
    },
  ],
  scoring: fundScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-d1-a'],
        't1-d1': ['t1-d1-a'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-d1-d'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-d1-c'],
        't4-d1': ['t4-d1-a'],
        't4-i1': ['t4-i1-b'],
        't5-d2': ['t5-d2-a'],
        't5-d1': ['t5-d1-a'],
        't5-i1': ['t5-i1-c'],
        't6-d1': ['t6-d1-a'],
        't6-i1': ['t6-i1-c'],
        't7-d1': ['t7-d1-a'],
      },
      note: '2020년 3월 대형 IG 회사채 펀드의 대표 경로를 재현한다: 희석방지도구 미준비(2/28) → 환매를 현금·국채로 충당(수평 슬라이싱, 3/9·3/16·3/18) → 대형 보유자 소통은 정기 보고 주기대로 → ETF 할인을 참고만 하고 평가기관 가격을 그대로 유지(3/12) → 스윙프라이싱 미적용 → 게이트 없이 환매를 계속 지급(3/20) → 연준 발표 후 사다리 재건(3/23) → 정책 변경 없음(3/24). 이사회 통화(t2-d2)에서는 비용을 측정해 60bp를 보고하고도 적용을 미루고(sw-open-measure → 60bp → sw-time-defer), 최대 보유자 통화(t5-i1)에서는 확답을 피한다(h-open-hedge). 재현하는 행동은 "게이트는 걸지 않았지만 희석방지도구도 쓰지 않아 비용 전부를 잔존 수익자가 부담한" 미국 등록 회사채 펀드의 전형이다.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-d1-b', 't0-d1-c', 't0-d1-d'],
        't1-d1': ['t1-d1-b'],
        't1-d2': ['t1-d2-b'],
        't2-d1': ['t2-d1-a'],
        't2-d2': ['t2-d2-b'],
        't3-d1': ['t3-d1-b', 't3-d1-d'],
        't4-d1': ['t4-d1-d'],
        't4-i1': ['t4-i1-c'],
        't5-d2': ['t5-d2-b'],
        't5-d1': ['t5-d1-b'],
        't5-i1': ['t5-i1-a'],
        't6-d1': ['t6-d1-b', 't6-d1-a'],
        't6-i1': ['t6-i1-a'],
        't7-d1': ['t7-d1-b', 't7-d1-c', 't7-d1-d'],
      },
      note: '사전 준비(스윙 결의 + 현금 10% + 라인 증액) → 비례 매도 + 전 보유자 동시 고지 → 평가 갱신 + 스윙 60bp → 비례 유지 + 현물 바스켓 → 스윙 95bp → 게이트 대신 현물 환매, 최대 보유자에게 수치로 설명 → 백스톱 창에서 사다리 재건 + 스윙 재산정 → 상시 정책화. 강제 게이트 0회, 희석 최소.',
    },
  },
  checkpoints: [
    {
      turnId: 't3',
      path: 'market.volIndex',
      expected: 82.69,
      tolerance: 0.01,
      label: '2020-03-16 VIX 종가 82.69 (사상 최고) [cboe-vix-history]',
    },
    {
      turnId: 't4',
      path: 'market.govt10yBp',
      expected: 118,
      tolerance: 0.03,
      label: '2020-03-18 10년 국채 1.18% — 주식·국채 동반 매도 [fed-h15]',
    },
    {
      turnId: 't2',
      metric: 'market.etfDiscountPct',
      expected: -5.02,
      tolerance: 0.1,
      absTolerance: 0.4,
      label:
        '2020-03-12 대표 IG 회사채 ETF(LQD)의 NAV 대비 할인 −5.02% [ishares-lqd-premium-discount]',
    },
    {
      turnId: 't6',
      path: 'market.creditSpreadIgBp',
      expected: 401,
      tolerance: 0.08,
      label:
        '2020-03-23 IG 스프레드 정점 ≈400bp (ICE BofA 401 / Bloomberg 373 — 지수 차이를 허용오차로 포함) [feds-note-2020-10-07]',
    },
    {
      turnId: 't6',
      metric: 'redemptionsCumulativePct',
      expected: 10,
      tolerance: 0.15,
      label: '2월 말~2020-03-23 회사채 펀드 누적 유출 ≈10% of NAV [falato-goldstein-hortacsu-2021]',
    },
    {
      turnId: 't7',
      metric: 'market.etfDiscountPct',
      expected: -0.4,
      tolerance: 0.5,
      absTolerance: 0.5,
      label:
        '2020-03-24 ETF 괴리 해소(≈0) — 연준 발표 이후 발행시장 정상화 [blackrock-etf-primary-2020]',
    },
  ],
  debrief: fundDebrief,
})

export default scenario
