import type { CentralBankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { sbDebrief } from './debrief'
import { sbInitialAuthority, sbInitialConfidence, sbInitialMarket } from './initialState'
import { sbScoring } from './scoring'
import { SB_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<CentralBankState> = defineScenario<CentralBankState>({
  meta: {
    id: 'savings-bank-2011',
    version: 1,
    title: '영업정지 명령',
    subtitle: '2011년 저축은행 구조조정',
    era: '2011-02',
    year: 2011,
    region: 'korea',
    role: 'regulator_official',
    roleTitle: '금융위·금감원 정책담당',
    institutionType: 'central_bank',
    institutionName: '금융당국',
    modelledOn:
      '금융위원회·금융감독원·예금보험공사를 하나의 정책 주체로 합성했다. 기관은 실재하는 그대로 쓰고 개인의 발언만 재구성했다. 사건·조치·시장 수치는 금융위원회 보도자료(2011-01-14 fsc 69852, 02-17 fsc 69869·69870·69871, 02-19 fsc 69872, 02-22 fsc 69877, 08-08 fsc 70017, 09-18 fsc 70069와 같은 날 브리핑, 10-19 fsc 70101, 11-23 fsc 70138), 예금자보호법 개정(법률 제10476호), 대법원 2013도6394, 한국은행 ECOS 실측치를 따른다.',
    difficulty: 'standard',
    durationTurns: 8,
    turnUnit: 'day',
    estMinutes: 35,
    timezone: 'Asia/Seoul',
    learningObjectives: [
      {
        id: 'lo1',
        text: '계열 금융기관의 영업정지를 나눠서 할 때와 동시에 할 때의 차이를 전염 경로로 설명하고, 정지 시점·범위·동시성의 상충을 대지급 소요와 함께 계산한다.',
        competency: 'policy',
        decisionIds: ['t0-d1', 't3-d1', 't6-d1'],
      },
      {
        id: 'lo2',
        text: '검증 가능한 범위에서만 약속하는 것과 조건부 안심 발언의 차이를 구분하고, 약속이 다음 라운드의 시장 기대와 감독당국의 신뢰에 어떻게 남는지 설명한다.',
        competency: 'communication',
        decisionIds: ['t2-d1', 't3-d2', 't6-d2', 't6-i1-assembly', 't2-i1-peer'],
      },
      {
        id: 'lo3',
        text: '적기시정조치 유예가 손실을 없애지 않고 정리 시점의 비용으로 이전된다는 것을 수치로 확인하고, 유예의 요건·기록·보고가 왜 제도적 방어인지 설명한다.',
        competency: 'compliance',
        decisionIds: ['t0-d1', 't4-d2', 't5-d2', 't7-d2'],
      },
      {
        id: 'lo4',
        text: '예금보험기금의 재원 구조(계정 간 차입·예보채·구조조정 특별계정)와 그 도착 시점이 정지 여부의 판단을 어떻게 왜곡하는지 이해하고, 최소비용 원칙에 따라 정리방식을 고른다.',
        competency: 'liquidity',
        decisionIds: ['t1-d2', 't5-d1', 't7-d1', 't3-i1-kdic'],
      },
      {
        id: 'lo5',
        text: '예금자보호 한도 밖의 예금자와 후순위채 투자자를 법·정보·절차의 틀에서 다루고, 사후 보전 약속이 다음 위기의 인출 유인을 어떻게 바꾸는지 설명한다.',
        competency: 'solvency',
        decisionIds: ['t4-d1', 't2-d1'],
      },
    ],
    competencies: { policy: 3, communication: 2, compliance: 2, liquidity: 1 },
    tags: ['영업정지', 'P&A', '예보', '후순위채', '적기시정조치', '전염'],
    sources: SB_SOURCES,
  },
  units: { currency: 'KRW', scale: 1e12, display: '조원' },
  initialState: {
    institution: sbInitialAuthority,
    market: sbInitialMarket,
    confidence: sbInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: {
      dampener: 1,
      spillBusan: 1,
      spillPeer: 1,
      spillSound: 1,
      startDeposits: 73.55,
    },
  },
  briefing: {
    situation: `2011년 2월 14일 월요일. 귀하는 **금융위원회·금융감독원의 정책담당**입니다. 한 달 전(1월 14일) 삼화저축은행이 BIS 기준 자기자본비율 △1.42%로 영업정지되었고, 그 뒤 한 달 동안 업권 수신은 2조 4천억원 줄었습니다.

오늘 아침 금융감독원 검사국이 부산저축은행 계열 5개사(부산·부산2·중앙부산·대전·전주)의 중간 검사 결과를 올렸습니다. 부산저축은행은 자기자본이 완전잠식 상태이고, 대전저축은행은 인출 요구에 응하기 어려운 수준입니다. 다섯 곳은 자금·전산·평판을 공유합니다 — **한 곳에서 인출이 시작되면 나머지로 옮겨 갑니다.**

시나리오는 8턴입니다: 2/14(월) 계열 실사 → 2/16(수) 의결 준비 → **2/17(목) 영업정지 명령** → **2/18(금)~2/21(월) 인출이 옮겨 가다** → 3/17(목) 감독강화 방안 → 4/28(목) 구조조정 특별계정 → **9/16(금)~9/19(월) 경영진단과 2차 정지** → 11/23(수) 가교저축은행과 책임.`,
    mandate: `**권한**: 부실금융기관 결정과 영업정지 명령(금융산업의 구조개선에 관한 법률·상호저축은행법), 적기시정조치와 그 유예, 유동성 지원 구조의 설계·승인, 발표문의 범위, 예금보험기금의 지원과 정리방식 결정, 제도 개선안의 마련.

**권한이 아닌 것**: 예금자보호 한도의 변경(법 개정 사항), 예금보험기금 밖의 재정 투입(국회 동의), 한국은행 대출(저축은행은 대상기관이 아님), 개인의 형사 책임에 대한 판단(수사·재판 사항).

**목표**: 예금보험기금 저축은행계정을 소진시키지 않고, 업권 전반으로 번지는 인출을 막고, 발표한 것과 실제로 한 것이 어긋나지 않게 하십시오. 보호 한도 밖의 손실은 어느 경로에서도 사라지지 않습니다 — 그 사실을 어떻게 다루는지가 이 훈련의 절반입니다.`,
    institutionProfile: `| 항목(조원) | 값 | 비고 |
|---|---|---|
| 예금보험기금 저축은행계정 가용재원 | 4.8 | 잔여 + 예보채·계정 간 차입 여력 [CAL] |
| 예금보험기금 전 계정 | 11.5 | [CAL] |
| 향후 1년 예상 정리소요 | 12.0 | 정리재원 커버리지 40% [CAL] |
| 업권 총수신(영업 중) | 73.55 | 74.4(2011.1말) − 0.85(삼화, 지급정지) |
| 부실 징후 기관 | 20개사 | BIS 5% 미만 5개사 포함 [CAL] |
| 영업정지 누계 | 1개사 | 삼화저축은행(1/14) |
| 부동산 PF대출 | 12.5 | 2009.12말, 91개사 보유 |
| PF대출 연체율 | 25.1% | 2010.12말 (2009.12말은 10.6%) |
| 유동성 백스톱 | 0 | 아직 약정되지 않음 |

**예금 무리(전염 모형이 읽는 세 값)**: 부산저축은행 계열 5개사 6.5 · BIS 5% 미만 등 취약 저축은행 11.2 · 나머지 저축은행 55.85.

**알려진 취약점**: 계열 내 자금·전산·평판 공유, 예금보험기금 저축은행계정의 기존 결손, 한국은행 대출 창구 부재, 88클럽 여신한도 우대와 적기시정조치 유예 관행.`,
    marketBackdrop: `한국은행 기준금리는 1월 13일 2.75%로 인상되었습니다. 국고채 3년은 3.97%, 회사채 AA− 3년은 4.75%, KOSPI는 2,014선, 원/달러는 1,122원대입니다. 채권시장은 조용하고 저축은행 문제는 아직 업권 안의 일로 인식되고 있습니다. 2010년 6월 구조조정기금이 법인 차주 PF채권 3.5조원을 2.5조원에 인수했지만 연체율은 오히려 올랐습니다.`,
    stakeholders: [
      {
        name: '금융위원회',
        wants: '질서 있는 정리, 시장 신뢰 유지',
        canDo: '부실금융기관 결정, 영업정지·인가취소·계약이전 의결, 적기시정조치와 유예, 발표',
      },
      {
        name: '금융감독원',
        wants: '검사 결과에 따른 조치, 감독 실패 논란의 해소',
        canDo: '검사·경영진단, 거래기록 확보, 판매 절차 검사, 제재 건의',
      },
      {
        name: '예금보험공사',
        wants: '기금 손실 최소화, 대지급 절차의 이행',
        canDo: '가지급금·보험금 지급, 계약이전 분석, 가교저축은행 설립·출자, 예보채 발행',
      },
      {
        name: '저축은행중앙회',
        wants: '업권 존속, 창구 현금 확보',
        canDo: '지급준비예탁금 지원(95% 콜 → 200% 유동성콜 → 긴급대출), 외부 차입',
      },
      {
        name: '정책금융공사·시중은행·한국증권금융',
        wants: '담보 안전성, 손실보증',
        canDo: '크레딧라인 개설, RP·담보대출 공급',
      },
      {
        name: '예금자 · 후순위채 투자자',
        wants: '원리금 전액, 초과분과 후순위채의 구제',
        canDo: '창구 인출, 집단 민원과 소송, 분쟁조정 신청',
      },
      {
        name: '국회 · 언론',
        wants: '감독 실패의 규명, 정지 직전 인출의 경위',
        canDo: '국정조사, 자료 제출 요구, 수 시간 내 확산',
      },
    ],
    regulatoryFramework: `- **적기시정조치**: 상호저축은행업감독규정상 경영개선권고·요구·명령의 3단계. 명령 단계에서 영업정지가 부과됩니다. **유예가 가능하며, 이 시나리오의 핵심 판단 중 하나입니다.**
- **부실금융기관 결정**: 「금융산업의 구조개선에 관한 법률」에 따라 부채가 자산을 초과하거나 예금 등 채권의 지급이 정지된 경우 등에 금융위원회가 결정합니다. 결정과 영업정지 명령은 같은 의결에서 이루어질 수 있습니다.
- **예금자보호**: 예금자보호법상 보호 한도는 1인당 원리금 **5천만원**. 초과분과 후순위채는 보호 대상이 아니며, 초과분은 파산재단 배당으로만 회수됩니다. 가지급금은 정지 며칠 뒤부터 한도 내에서 지급됩니다.
- **최소비용 원칙**: 정리방식은 예금보험기금의 손실이 최소화되는 방식이어야 합니다. 계약이전이 청산·파산보다 비용이 적으면 계약이전을 택합니다. 인수자가 없으면 예금보험공사 100% 출자 **가교저축은행**을 세울 수 있습니다.
- **유동성**: 저축은행은 한국은행 대출·공개시장운영 대상기관이 아닙니다. 창구 현금은 저축은행중앙회 지급준비예탁금과 외부 차입(정책금융공사·시중은행 크레딧라인, 한국증권금융)에서만 나옵니다.
- **88클럽**: BIS 8% 이상·고정이하여신비율 8% 이하 저축은행에 개별차주 여신한도를 우대하는 제도가 이 시점에 아직 살아 있습니다.
- **대응 단계 R0~R4**: 정상 → 강화 감시 → 조치 착수 → 정리 진행 → 제도 밖 조치에 따른 직접 개입. 법이 정한 절차 밖에서 지급을 제한·지연하는 조치는 즉시 R4입니다.`,
    cardRefs: [
      'korea-crisis-toolkit',
      'regulator-escalation-ladder',
      'bank-run-dynamics',
      'uninsured-deposits-and-run-speed',
      'crisis-communication',
      'fdic-resolution-weekend',
    ],
    simplificationNotes: [
      '금융위원회·금융감독원·예금보험공사를 하나의 정책 주체로 합성했다. 실제로는 세 기관의 판단과 절차가 달랐고, 그 긴장은 메모와 전화 이벤트로만 표현했다.',
      '저축은행 105개사를 세 무리(부산 계열 5개사 · 취약 저축은행 · 나머지)로 묶었다. 무리별 수신 배분(6.5 / 11.2 / 55.85조)은 보정값이며 1차 공표치가 아니다.',
      '전염 계수(같은 계열 잔여로 옮겨 가는 인출 압력 1 + 1.6 × 정지 비중, 다른 무리 +0.35 / +0.21)는 2011년 2월 17일과 19일 사이의 기록에서 역산한 보정값이다.',
      '예금보험기금 저축은행계정의 가용재원 4.8조원과 기관별 대지급 소요는 보정값이다. 2010년말 저축은행계정 누적적자는 언론 2차 인용만 확보했다.',
      '5천만원 초과 예금과 후순위채는 부산저축은행 계열과 9월 정지 7개사의 공표치만 반영하고, 보해·도민·경은에는 0으로 두었다. 개별 공표치가 없기 때문이다.',
      '창구 하루의 시간대별 인출 분포(틱 프로필)는 공개된 자료가 없어 양식화한 값이다. variance 0에서 슬라이스 합계는 하루치 단일 계산과 일치한다.',
      '시장 시계열(국고채·회사채·KOSPI·원/달러)은 한국은행 ECOS 실측 종가이며 틱 턴의 시각별 배열만 양식화했다. 국고채 2년·30년 계열은 2011년에 존재하지 않아 1년물·20년물로 대체했다.',
      '월 단위로 벌어진 사건(2/22~3/17, 3/18~4/28, 9/20~11/23)은 영업일 수를 축약해 한 턴으로 처리했다.',
      '등장하는 모든 발언은 공개 기록에 기초한 개연성 있는 재구성이며 속기록이나 인용이 아니다. 개인에 대한 서술은 법원이 확정한 사실과 정부가 스스로 공표한 사실의 범위를 넘지 않는다.',
      '2012년 이후의 사건(4개사 추가 정지, 형사 확정판결, 특별계정 총 투입액, 존속기한 연장)은 엔딩과 디브리핑에서만 다룬다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(금융위원회 보도자료와 브리핑, 예금자보호법·상호저축은행법·금융산업의 구조개선에 관한 법률, 국회 기록, 대법원 판결문, 한국은행 통계)를 바탕으로 교육 목적으로 재구성한 것입니다. 기관은 실재하는 그대로 썼으나 **등장하는 모든 발언은 재구성이며 실제 인용이 아닙니다.** 이 사건에는 형사 유죄판결이 확정된 사실이 포함되어 있으며, 시나리오는 법원과 정부가 확인한 범위를 넘어 개인을 평가하지 않습니다. 수치는 단순화·보정되었습니다.',
  },
  kpis: [
    {
      metric: 'usableReserves',
      label: '저축은행계정 가용재원',
      labelEn: 'Deposit Insurance Fund (Savings Bank Account)',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '음수가 되면 대지급 불능',
      decimals: 2,
    },
    {
      metric: 'depositOutflowCum',
      label: '누적 예금 인출',
      labelEn: 'Cumulative Deposit Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '영업 중 저축은행에서 빠져나간 누계',
      decimals: 2,
    },
    {
      metric: 'failedBanks',
      label: '영업정지 누계',
      labelEn: 'Suspended Institutions',
      unit: 'count',
      primary: true,
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'confidence',
      label: '예금자 신뢰지수',
      labelEn: 'Depositor Confidence Index',
      unit: 'index',
      sparkline: true,
    },
    {
      metric: 'excessDeposits',
      label: '5천만원 초과 예금(정지 기관)',
      labelEn: 'Uninsured Deposits at Suspended Banks',
      unit: 'ccy',
      decimals: 4,
      description: '보호 대상이 아닌 예금 — 파산재단 배당으로만 회수된다',
    },
    {
      metric: 'subDebt',
      label: '후순위채(정지 기관)',
      labelEn: 'Subordinated Debt at Suspended Banks',
      unit: 'ccy',
      decimals: 4,
      description: '예금이 아니어서 보호 대상이 아니고 변제 순위도 뒤다',
    },
  ],
  thresholds: {
    usableReserves: { warn: 1.5, breach: 0, direction: 'below' },
    depositOutflowCum: { warn: 3, breach: 6, direction: 'above' },
    failedBanks: { warn: 8, breach: 18, direction: 'above' },
    confidence: { warn: 45, breach: 30, direction: 'below' },
    guidottiRatio: { warn: 35, breach: 15, direction: 'below' },
    spillBusan: { warn: 1.8, breach: 2.6, direction: 'above' },
  },
  turns: [...turnsA, ...turnsB],
  // 크기(magnitude) 노이즈와 틱 지터만 — 분기는 만들지 않는다. variance 0에서는 엔진이 RNG를 당기지
  // 않으므로 체크포인트와 정본 경로는 불변이다. 근거는 calibration.md §8.
  noise: { runoffSigma: 0.14, runoffCap: 0.28, tickerSigma: 0.008, tickerSigmaBp: 2, eventJitter: 1 },
  gameOver: [
    {
      id: 'unsafe_act',
      when: { regulator: { gte: 4 } },
      reason: 'unsafe_act',
      title: '법정 절차 밖의 조치 — 직접 개입',
      narrative:
        '예금자보호법이 정한 절차 밖에서 지급을 제한하거나 지연했다는 사실이 알려졌습니다. 예금보험은 지급 약속이고, 그 약속의 이행을 당국이 임의로 멈춘 순간 보호받는 예금까지 인출 대상이 되었습니다. 국회와 감사기구가 직접 개입했고 대응 권한은 회수되었습니다.',
      failed: true,
      ruleText:
        '대응 단계가 R4에 도달하면 종료됩니다 (법정 절차 밖의 지급 제한·지연, 허위 공표).',
    },
    {
      id: 'fund_exhausted',
      when: { metric: 'usableReserves', lt: 0 },
      reason: 'fund_exhausted',
      title: '예금보험기금 저축은행계정 소진 — 대지급 불능',
      narrative:
        '저축은행계정의 재원이 바닥났습니다. 가지급금 지급이 멈추고, 예금보험이 지급을 약속한 5천만원 이하 예금조차 언제 나올지 말할 수 없게 되었습니다. 정리 절차는 재원이 확보될 때까지 중단되고, 그 사이 남은 저축은행의 창구에는 다시 줄이 섭니다. 재원은 위기 전에 설계되지 않으면 위기 중에는 만들 수 없습니다.',
      failed: true,
      ruleText: '예금보험기금 저축은행계정 가용재원이 음수가 되면 대지급 불능으로 종료됩니다.',
    },
    {
      id: 'sector_run',
      when: { metric: 'depositOutflowCum', gte: 6 },
      reason: 'sector_run',
      title: '업권 전반의 인출 — 연쇄 정지',
      narrative:
        '인출이 부실 기관을 넘어 업권 전체로 번졌습니다. 유동성 백스톱이 바닥나고, 건전하던 저축은행까지 지급 요구에 응하지 못하는 상태가 되었습니다. 부실을 정리하는 문제가 업권을 유지하는 문제로 바뀌었고, 정부는 대응 체계를 다시 짜야 했습니다.',
      failed: true,
      ruleText:
        '영업 중 저축은행의 누적 예금 인출이 6조원(업권 수신의 8%)을 넘으면 연쇄 정지로 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'orderly',
      when: {
        all: [
          { metric: 'depositOutflowCum', lt: 3.2 },
          { metric: 'usableReserves', gte: 1 },
          { confidence: { gte: 52 } },
        ],
      },
      title: '질서 있는 정리 — 그러나 손실은 남는다',
      narrative:
        '정리는 계획대로 끝났습니다. 인출은 부실 기관 밖으로 크게 번지지 않았고, 예금보험기금은 다음 라운드를 감당할 여력을 남겼으며, 발표한 것과 실제로 한 것이 어긋나지 않았습니다. 그러나 2006년부터 나간 대출과 그 부실은 어느 경로에서도 사라지지 않습니다 — 보호 한도를 넘는 예금과 후순위채의 손실은 그대로 남았고, 구조조정은 이후 몇 해 더 이어졌습니다. 정리를 잘한다는 것은 손실을 없애는 것이 아니라 손실이 드러나는 방식과 그 비용의 분담을 정하는 일입니다.',
    },
    {
      id: 'costly',
      when: { metric: 'depositOutflowCum', lt: 5 },
      title: '정리는 했으나 비용이 커졌다',
      narrative:
        '영업정지와 계약이전은 이루어졌지만 그 과정에서 인출이 업권으로 번졌고, 예금보험기금의 부담은 처음 추정보다 크게 늘었습니다. 약속이 뒤집힌 자리마다 다음 발표의 신뢰가 깎였고, 미룬 결정은 미룬 만큼 비싼 값으로 돌아왔습니다. 남은 저축은행은 더 적은 수신과 더 높은 조달비용으로 다음 해를 맞습니다.',
    },
    {
      id: 'prolonged',
      title: '끝나지 않은 구조조정',
      narrative:
        '한 해가 끝났지만 정리는 끝나지 않았습니다. 유예된 기관이 남아 있고, 재원은 매 라운드마다 다시 논쟁의 대상이 되며, 예금자는 다음 발표를 믿지 않습니다. 구조조정은 이후로도 몇 해 더 이어지게 됩니다.',
    },
  ],
  scoring: sbScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-d1-a'],
        't0-d2': ['t0-d2-a'],
        't1-d1': ['t1-d1-a'],
        't1-d2': ['t1-d2-a'],
        't2-d2': ['t2-d2-a'],
        't2-d1': ['t2-d1-b'],
        't2-i1-peer': ['t2-i1-a'],
        't3-d1': ['t3-d1-a'],
        't3-d2': ['t3-d2-a'],
        't3-i1-kdic': ['t3-i1-a'],
        't4-d1': ['t4-d1-a'],
        't4-d2': ['t4-d2-a'],
        't5-d1': ['t5-d1-a'],
        't5-d2': ['t5-d2-b'],
        't6-d1': ['t6-d1-a'],
        't6-d2': ['t6-d2-a'],
        't6-i1-assembly': ['t6-i1-a'],
        't7-d1': ['t7-d1-a'],
        't7-d2': ['t7-d2-a'],
      },
      note: '실제 순서: 2/17 부산·대전 2개사만 정지하고 백스톱은 당일 협의(6조 발표) + "상반기 추가 정지 없음" 조건부 단서 → 2/19 계열 잔여 3개사와 보해 추가 정지, 사유는 "예금인출 동향과 유동성" → 3/17 감독강화 방안(88클럽 우대 폐지)과 후순위채 분쟁조정 → 4/1 특별계정 시행(전 업권 보험료 45%) + 기한 없는 자구계획 → 9/18 7개사 동시 정지와 6개사 유예 → 11/23 가교 계약이전. 체크포인트: 2/19까지 정지 7개사, 부산 계열 초과예금 1,613억·후순위채 1,132억, 9/18 누계 16개사.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-d1-b'],
        't0-d2': ['t0-d2-b'],
        't1-d1': ['t1-d1-d'],
        't1-d2': ['t1-d2-d'],
        't2-d2': ['t2-d2-b'],
        't2-d1': ['t2-d1-a'],
        't2-i1-peer': ['t2-i1-a'],
        't3-d1': ['t3-d1-d'],
        't3-d2': ['t3-d2-c'],
        't3-i1-kdic': ['t3-i1-d'],
        't4-d1': ['t4-d1-d'],
        't4-d2': ['t4-d2-b'],
        't5-d1': ['t5-d1-d'],
        't5-d2': ['t5-d2-a'],
        't6-d1': ['t6-d1-a'],
        't6-d2': ['t6-d2-a'],
        't6-i1-assembly': ['t6-i1-c'],
        't7-d1': ['t7-d1-a'],
        't7-d2': ['t7-d2-b', 't7-d2-c'],
      },
      note: '계열 5개사 동시 정지 + 백스톱 6조 사전 약정(T0) → 인출 기록 보존과 특별계정 조기 착수(T1) → 법정 범위만 공표 + 가지급금 일정 동시 발표(T2) → 계열 밖 1개사만 정지하고 판단 기준 공개(T3) → 배당 전망 공개·판매 검사 + 유예 해제(T4) → 존속기한 명시 + 60일 서면 약정(T5) → 7개사 동시 정지·패키지 발표·인출 조사 공개(T6) → 가교 계약이전 + 유예 요건 법제화·대주주 규제(T7).',
    },
  },
  checkpoints: [
    {
      turnId: 't1',
      metric: 'supportCum',
      expected: 0,
      tolerance: 0.2,
      absTolerance: 0.05,
      label: '2/16까지 예금보험기금 투입 0 — 영업정지 전이므로 대지급 소요가 없다 (0 근처 목표라 absTolerance)',
    },
    {
      turnId: 't1',
      metric: 'failedBanks',
      expected: 1,
      tolerance: 0.01,
      absTolerance: 0.5,
      label: '2/16까지 영업정지 1개사 — 삼화저축은행 [fsc-69852]',
    },
    {
      turnId: 't2',
      metric: 'market.govt3y',
      expected: 396,
      tolerance: 0.02,
      label: '국고채 3년 3.96% (2011-02-17 종가, ECOS 817Y002)',
    },
    {
      turnId: 't3',
      metric: 'failedBanks',
      expected: 7,
      tolerance: 0.01,
      absTolerance: 0.5,
      label:
        '2/19까지 영업정지 누계 7개사 — 삼화 1 + 부산·대전 2 + 부산2·중앙부산·전주·보해 4 [fsc-69852, fsc-69869, fsc-69872]',
    },
    {
      turnId: 't3',
      metric: 'excessDeposits',
      expected: 0.1613,
      tolerance: 0.03,
      label:
        '부산저축은행그룹 5개 계열의 5천만원 초과 비보호 예금 1,613억원 (개인 순예금자 27,024명) [press-busan-excess-2011-06-05]',
    },
    {
      turnId: 't3',
      metric: 'subDebt',
      expected: 0.1132,
      tolerance: 0.03,
      label:
        '부산저축은행그룹 5개 계열의 후순위채 1,132억원 (2,947명) [press-busan-excess-2011-06-05]',
    },
    {
      turnId: 't5',
      metric: 'specialAccountTn',
      expected: 15,
      tolerance: 0.02,
      label:
        '구조조정 특별계정 설치 당시 소요 예상 15조원 — 실제 투입은 27.2조원이었다 [fsc-86263]',
    },
    {
      turnId: 't6',
      metric: 'failedBanks',
      expected: 16,
      tolerance: 0.01,
      absTolerance: 0.5,
      label:
        '2011년 중 영업정지 누계 16개사 — 8(2월까지) + 경은 1(8/5) + 7개사(9/18) [fsc-70017, fsc-70069]',
    },
    {
      turnId: 't6',
      metric: 'excessDeposits',
      expected: 0.3173,
      tolerance: 0.03,
      label:
        '부산 계열 1,613억 + 9/18 7개사 1,560억 = 3,173억원 [press-busan-excess-2011-06-05, fsc-brief-2011-09-18]',
    },
    {
      turnId: 't6',
      metric: 'subDebt',
      expected: 0.3364,
      tolerance: 0.03,
      label:
        '부산 계열 1,132억 + 9/18 7개사 2,232억(사모 포함) = 3,364억원 [press-busan-excess-2011-06-05, fsc-brief-2011-09-18]',
    },
    {
      turnId: 't6',
      metric: 'market.govt3y',
      expected: 351,
      tolerance: 0.02,
      label: '국고채 3년 3.51% (2011-09-19 종가, ECOS 817Y002)',
    },
  ],
  debrief: sbDebrief,
})

export default scenario
