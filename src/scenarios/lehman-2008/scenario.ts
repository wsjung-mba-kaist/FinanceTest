import type { BankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { lehmanDebrief } from './debrief'
import { lehmanInitialBank, lehmanInitialConfidence, lehmanInitialMarket } from './initialState'
import { lehmanScoring } from './scoring'
import { LEHMAN_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<BankState> = defineScenario<BankState>({
  meta: {
    id: 'lehman-2008',
    version: 1,
    title: '리먼 주간',
    subtitle: '2008년 9월 투자은행 자금조달 붕괴 — 메리디언 브라더스',
    era: '2008-09',
    year: 2008,
    region: 'global',
    role: 'bank_treasurer',
    roleTitle: '투자은행 자금담당임원(Treasurer)',
    institutionType: 'bank',
    institutionName: '메리디언 브라더스(Meridian Brothers)',
    modelledOn:
      'Lehman Brothers Holdings Inc. (2008-05-31 10-Q, 2008-09-10 3분기 사전 공시, 2008-09-09~19 사건 기록; 유동성 풀 붕괴 앵커: Bear Stearns 2008-03-10~13)',
    difficulty: 'advanced',
    durationTurns: 8,
    turnUnit: 'day',
    estMinutes: 45,
    timezone: 'America/New_York',
    learningObjectives: [
      {
        id: 'lo1',
        text: '트라이파티 레포의 청산은행 일중 신용·담보 콜·헤어컷 메커니즘을 이해하고, PDCF 담보 사전 예치와 법인별 창구 적격성을 조달 계획에 반영한다.',
        competency: 'liquidity',
        decisionIds: ['t0-d1', 't2-d1', 't2-d2', 't3-d2', 't6-d1'],
      },
      {
        id: 'lo2',
        text: '유동성 풀에서 담보 예치분을 구분하고, 검증 가능한 수치만 공표하는 위기 커뮤니케이션을 실행한다.',
        competency: 'communication',
        decisionIds: ['t0-d1', 't1-d1', 't2-d2', 't6-d2'],
      },
      {
        id: 'lo3',
        text: '비유동 자산의 매각 순서(확정 매각·분리·담보)와 파이어세일이 자본에 미치는 영향을 판단한다.',
        competency: 'solvency',
        decisionIds: ['t0-d1', 't3-d2', 't4-d1'],
      },
      {
        id: 'lo4',
        text: '고객 자산 보호(15c3-3)와 질서 있는 정리(사전 조율, ISDA, 해외 법인)를 무질서 파산과 구분한다.',
        competency: 'compliance',
        decisionIds: ['t1-d2', 't4-d2', 't5-d1'],
      },
      {
        id: 'lo5',
        text: '보증 없는 최종대부자의 한계(지주 대출 불가·보증 부재)와 기관별 대출 vs 시스템 보증의 차이를 설명한다.',
        competency: 'policy',
        decisionIds: ['t3-d1', 't5-d1', 't7-d1'],
      },
    ],
    competencies: {
      liquidity: 3,
      communication: 2,
      compliance: 2,
      policy: 2,
      solvency: 1,
      marketRisk: 1,
    },
    tags: ['트라이파티 레포', 'PDCF', '청산은행', '헤어컷', 'Chapter 11', '투자은행', '최종대부자'],
    sources: LEHMAN_SOURCES,
  },
  units: { currency: 'USD', scale: 1e9, display: 'B' },
  initialState: {
    institution: lehmanInitialBank,
    market: lehmanInitialMarket,
    confidence: lehmanInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: {
      startDeposits: 80,
      amplifier: 1,
      dampener: 1,
      cumulativeOutflow: 0,
      lastOutflow: 0,
    },
  },
  briefing: {
    situation: `2008년 9월 9일 화요일 아침. 귀하는 대형 투자은행 **메리디언 브라더스(MB)**의 자금담당임원(Treasurer)입니다. 총자산 약 $640B, 주주지분 약 $28B(보통주 ≈$20B), 트라이파티 레포 $185B로 조달하는 전형적인 독립 투자은행입니다.

3월 베어스턴스가 사흘 만에 무너진 뒤 시장은 "다음"을 찾아 왔고, 6월 이후 회사는 계속 압박을 받았습니다. 오늘 아침 한국산업은행과의 지분 협상 결렬이 보도되며 주가가 45% 급락했습니다. 보고용 유동성 풀은 $42B이지만 그중 $7.5B는 청산은행 담보와 comfort deposit으로 사실상 쓸 수 없습니다. 3분기 손실 $3.9B는 아직 공개되지 않았습니다.

시나리오는 8턴입니다: 9/9(화) 프롤로그 → 9/10(수) 실적 선공개 → 9/11(목) 레포 롤오버 거부 → 9/12(금) 뉴욕연준 회동 → 9/13(토)·9/14(일) 주말 → 9/15(월) → 9/16~19 에필로그.`,
    mandate: `**권한**: 이사회 한도 내 담보 이동·창구 차입·레포 관리·자산 매각 실행을 결정할 수 있습니다. 실적 공시·회사 매각·파산 신청은 CEO/이사회 소관이지만, 게임에서는 Treasurer의 권고가 채택됩니다. 고객 자산 이전 지연, 존재하지 않는 창구(지주회사 앞 연준 대출) 사용은 불가능합니다.

**목표**: 브로커딜러의 결제를 지키고 유동성 풀을 보전하면서 자본·신뢰·규제 관계를 유지하십시오. 생존이 불가능하다면 무질서한 파산보다 사전 조율된 정리가 낫습니다.`,
    institutionProfile: `| 항목($B) | MB | 비고 |
|---|---|---|
| 유동성 풀(cash) | 42 | 그중 7.5는 청산은행 담보·comfort deposit |
| 유동 인벤토리(국채·기관·IG·주식) | 190 | 80% 트라이파티 레포 담보 |
| 비유동 인벤토리(CRE 32.6 + 주택 13.2) | 46 | 시장 추정 추가 상각 후 38 |
| 역레포·증권차입·미수금 | 336 | 매치드북 |
| 총자산 | 640 | |
| PB 프리크레딧 / 파생 담보 / CP·MTN / 기타 고객 | 25 / 15 / 12 / 28 | 도주성 조달 80 |
| 트라이파티 레포 (국채·기관 / IG·주식 / CMBS·비IG) | 120 / 40 / 25 | 청산은행 JPM |
| 장기차입 | 128 | |
| 주주지분 | 28 | 보통주 20 + 우선주 8; Tier 1 ≈11% |
| PDCF 적격 담보 여력(브로커딜러) | 0 | 사전 예치 없음 |

**알려진 취약점(9/9 인지 수준)**: 유동성 풀에 담보 예치분 포함, PDCF 앞 사전 예치·테스트 없음, CMBS 담보 레포 $25B, 자산운용 자회사(≈$7B) 매각 미확정, 지주회사는 연준 창구 부적격.`,
    marketBackdrop: `FF 목표금리 2.00%. 3월 베어스턴스 사태 후 연준은 TSLF(3/11)와 PDCF(3/16)를 신설해 프라이머리 딜러에 담보 대출을 열었습니다. 9월 7일 패니메이·프레디맥이 정부 관리에 들어갔습니다. TED 스프레드는 약 115bp, MB 5년 CDS는 약 475bp입니다. 재무부는 "공적 자금 투입은 없다"는 입장을 공공연히 밝히고 있습니다.`,
    stakeholders: [
      {
        name: '이사회·CEO',
        wants: '독립 생존 또는 유리한 매각, 명성 보호',
        canDo: '공시·매각·파산 신청 승인',
      },
      {
        name: '뉴욕연준·재무부·SEC',
        wants: '시스템 충격 최소화, 공적 자금 없는 민간 해법',
        canDo:
          'PDCF·TSLF 조건 변경(브로커딜러 한정), CEO 소집, 감독 단계 상향; 지주 대출·보증은 불가',
      },
      {
        name: '청산은행(JPM)',
        wants: '일중 신용 익스포저 축소, 충분한 담보',
        canDo: '추가 담보 요구, 언와인드 거부(=결제 불능)',
      },
      {
        name: '레포 카운터파티·MMF',
        wants: '담보 품질, 원금 보전',
        canDo: '롤오버 거부, 헤어컷 인상, 국채 담보만 수용',
      },
      {
        name: '헤지펀드 PB 고객',
        wants: '자산 접근성, 파산 위험 회피',
        canDo: '수 시간 내 잔고 이전·노베이션, 경쟁 PB로 분산',
      },
      {
        name: '인수 후보(BofA·바클레이스)',
        wants: '부동산 손실 보증, 규제 승인, 시간',
        canDo: '실사, 서명 또는 이탈(BofA→메릴)',
      },
      { name: '신용평가사', wants: '전략적 거래·자본', canDo: '검토·강등(파생 담보 요구 촉발)' },
      { name: '언론', wants: '속보', canDo: '소문 증폭, 카운터파티 심리 변화' },
    ],
    regulatoryFramework: `- **CSE(Consolidated Supervised Entity) 프로그램**: SEC가 지주 단위 자본·유동성을 감독. 브로커딜러는 순자본 규칙(15c3-1)·고객보호규칙(15c3-3) 적용 — 고객 자산 이전 지연은 위반.
- **PDCF(2008.3.16)·TSLF(2008.3.11)**: 프라이머리 딜러(브로커딜러) 앞 창구. 지주회사는 적격 차입자가 아님. 9/14 저녁 PDCF 담보가 트라이파티 적격 담보 전체로 확대(주식·비투자등급 포함).
- **연준 13(3)조**: 비상 대출 권한. 연준·재무부는 "담보 부족·보증 권한 부재"로 지주 대출·보증을 거부(Bernanke 2010); Ball(2016)은 담보가 충분했다고 반박.
- **파산법 Chapter 11**: 지주 신청 시 브로커딜러는 SIPC 청산(SIPA), 해외 법인은 현지 관리 절차. 2008년에는 Title II OLA가 없었다.
- **감독 단계 R0~R4**: 강화 모니터링(R1, 기본) → 상주(R2) → 정리 준비(R3) → 즉시 조치(R4: 고객 자산 이전 지연·허위 공표).
- **게임오버**: 유동성 풀 < 0 ∧ PDCF 여력 없음 → 청산은행 언와인드 거부 → Chapter 11; 청산은행 요구 거부; Chapter 11 신청(사전 조율 시 질서 있는 실패); R4; 레버리지비율 < 2%.`,
    cardRefs: [
      'tri-party-repo-run',
      'contingency-funding-plan',
      'crisis-communication',
      'hqla-and-haircuts',
      'discount-window-fhlb-btfp',
      'fdic-resolution-weekend',
      'bank-run-dynamics',
    ],
    simplificationNotes: [
      'MB는 리먼 2008-05-31 10-Q와 9/10 사전 공시를 반올림한 합성 기관이다. 조달 세그먼트(PB 프리크레딧·파생 담보·CP·기타)와 레포 북의 담보별 분해는 양식화·보정된 값이다(calibration.md).',
      '유동성 풀 $42B는 8-K(9/10) 추정치이며, 그중 담보 예치분 $7.5B(JPM ≈5.5 + 씨티 2)는 파산 조사관 보고서 Vol. 4 §III.A.5 p.1455에서 원문 확인했다.',
      '주주지분 $28.4B(8/31)를 보통주 20 + 우선주 8로 나눈 것은 양식화다. 3분기 손실 $3.9B는 이미 반영된 수치이므로 공시 시 자본 효과는 없고 신뢰 효과만 있다.',
      '비유동 북의 시장가치 38(장부 46)은 "시장이 요구하는 추가 상각"이며 economicTce에만 반영된다. 매각은 시나리오 전용 효과로 처리하며 ASC 320 tainting 규칙은 적용하지 않는다.',
      '자산운용 자회사 확정 매각의 2일 종결, bad-bank 스핀오프의 주말 확정, 컨소시엄 자금 $5B는 양식화·반사실이다.',
      '9/15 이후 생존 분기에서 AIG·Reserve Primary·MMF 보증은 외생으로 유지한다. 실제로는 리먼 파산이 이 사건들의 원인이었으므로, MB가 생존한 세계에서 같은 시점에 같은 사건이 일어났을지는 가정이다.',
      '주말 턴(T4·T5)에는 송금 창구가 없어 세그먼트 유출을 적용하지 않는다. 시장 데이터(주가 −45/−7/−42/−14%)는 실제 종가 기준이다[press].',
      '9/11·9/12는 서브턴 5틱으로 진행된다. 틱 라벨(07:00 언와인드 → 09:30 개장 → 청산은행 요구 → 장 마감 → 연준 소집)과 그날 유출의 시간대별 분포는 양식화이며, 앵커는 그날의 합계뿐이다. 중간에 걸려 오는 전화와 주말 협상의 대사는 공개 기록을 바탕으로 한 재구성이며 녹취가 아니다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(SEC 공시, 연준·FDIC·SEC 자료, FCIC 보고서, 파산 조사관 보고서, 학술 논문)를 바탕으로 교육 목적으로 재구성한 것이며, 수치와 인물의 발언은 단순화·각색되었습니다.',
  },
  kpis: [
    {
      metric: 'cash',
      label: '유동성 풀',
      labelEn: 'Liquidity Pool',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '지주+브로커딜러 가용 현금·즉시 현금화 자산. 음수면 결제 실패',
      decimals: 1,
    },
    {
      metric: 'cumulativeOutflow',
      label: '누적 자금 유출(PB·레포·담보 콜 포함)',
      labelEn: 'Cumulative Funding Outflow',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      decimals: 1,
    },
    {
      metric: 'facilityHeadroom',
      label: 'PDCF 적격 담보 여력(브로커딜러)',
      labelEn: 'PDCF-eligible Headroom',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '지주회사는 차입 불가',
      decimals: 1,
    },
    {
      metric: 'repoRollRate',
      label: '트라이파티 레포 롤오버율',
      labelEn: 'Tri-party Repo Roll Rate',
      unit: '%',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'dailyOutflow',
      label: '당일 자금 유출',
      labelEn: 'Daily Outflow',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'survivalDays',
      label: '생존 일수',
      labelEn: 'Survival Days',
      unit: 'days',
      sparkline: true,
      description: '(유동성 풀 + PDCF 여력) ÷ 예상 일일 유출',
      decimals: 1,
    },
    {
      metric: 'leverageRatio',
      label: '레버리지비율(Tier1/총자산)',
      labelEn: 'Leverage Ratio',
      unit: '%',
      sparkline: true,
      referenceLabel: '게임오버 2%',
      decimals: 2,
    },
    {
      metric: 'economicTce',
      label: '시장 기준 유형자기자본비율',
      labelEn: 'Economic TCE',
      unit: '%',
      sparkline: true,
      description: '보통주 − 시장 추정 추가 상각',
      decimals: 2,
    },
    {
      metric: 'confidence',
      label: '시장 신뢰지수',
      labelEn: 'Confidence Index',
      unit: 'index',
      sparkline: true,
    },
    {
      metric: 'ownStock',
      label: '자사 주가(지수)',
      labelEn: 'Own Stock',
      unit: 'index',
      sparkline: true,
      decimals: 0,
    },
    {
      metric: 'deposits',
      label: '도주성 조달 잔액',
      labelEn: 'Runnable Funding',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'cbAdvances',
      label: 'PDCF 차입 잔액',
      labelEn: 'PDCF Borrowing',
      unit: 'ccy',
      decimals: 1,
    },
    {
      metric: 'clearingBankCalls',
      label: '청산은행 담보 예치 누적',
      labelEn: 'Clearing-bank Collateral Posted',
      unit: 'ccy',
      decimals: 1,
    },
  ],
  thresholds: {
    cash: { warn: 10, breach: 0, direction: 'below' },
    facilityHeadroom: { warn: 10, breach: 1, direction: 'below' },
    cumulativeOutflowPct: { warn: 15, breach: 35, direction: 'above' },
    repoRollRate: { warn: 85, breach: 60, direction: 'below' },
    leverageRatio: { warn: 3, breach: 2, direction: 'below' },
  },
  turns: [...turnsA, ...turnsB],
  /**
   * 라이브 플레이(variance 1)에서만 쓰이는 크기 노이즈. variance 0(정본·체크포인트)에서는 엔진이
   * 난수를 아예 당기지 않는다. 하우스 기본값에서 `runoffSigma`만 0.15 → 0.12로 낮췄다: 9/12 체크포인트
   * 두 개(누적 유출 ≈38, 풀 ≈2)가 **하루 유출의 합**으로 정의되어 있어 슬라이스 분산이 그대로
   * 누적되기 때문이다. calibration.md §7.6.
   */
  noise: {
    runoffSigma: 0.12,
    runoffCap: 0.3,
    tickerSigma: 0.01,
    tickerSigmaBp: 2,
    eventJitter: 1,
  },
  gameOver: [
    {
      id: 'unsafe_act',
      when: { regulator: { gte: 4 } },
      reason: 'unsafe_act',
      title: 'SEC, 고객보호규칙 위반으로 즉시 조치 — 브로커딜러 SIPC 청산',
      narrative:
        '고객 자산 이전 지연이 확인되어 SEC·FINRA가 브로커딜러에 즉시 조치를 취했습니다. 고객 자산 보호 절차(SIPA)가 개시되고 지주회사는 파산을 신청했습니다.',
      failed: true,
      ruleText: '감독당국 단계가 R4에 도달하면 종료됩니다 (고객 자산 이전 지연·허위 공표).',
    },
    {
      id: 'chapter11_orderly',
      when: { all: [{ flag: 'chapter11' }, { flag: 'prepack' }] },
      reason: 'chapter11',
      title: '사전 조율된 Chapter 11 — 질서 있는 정리',
      narrative:
        '9월 15일 새벽 지주회사가 연준·SEC·ISDA와 조율된 순서로 Chapter 11을 신청했습니다. 브로커딜러는 확대된 PDCF로 결제를 유지했고 고객 자산 분리와 해외 법인 자금이 사전에 확정되었습니다. 회사는 존속하지 못했지만, 무질서한 파산의 2차 피해는 크게 줄었습니다.',
      failed: true,
      orderly: true,
      ruleText: '사전 조율된 파산을 선택하면 질서 있는 실패로 종료됩니다 (부분점수, 상한 62).',
    },
    {
      id: 'chapter11',
      when: { flag: 'chapter11' },
      reason: 'chapter11',
      title: '9월 15일 01:30 — Chapter 11 신청',
      narrative:
        '지주회사가 사전 조율 없이 Chapter 11을 신청했습니다. 런던 법인은 개장과 함께 관리 절차에 들어가 고객 자산이 동결되었고, 파생 카운터파티 수천 건의 계약이 무질서하게 종료되었습니다. 브로커딜러는 저녁에야 확대 PDCF에서 차입했습니다.',
      failed: true,
      ruleText: '파산을 선택하면 시나리오가 종료됩니다 (무질서한 실패, 상한 40).',
    },
    {
      id: 'clearing_refusal',
      when: { flag: 'clearing_bank_refused' },
      reason: 'closure_liquidity',
      title: '청산은행, 트라이파티 레포 언와인드 거부 — 결제 불능',
      narrative:
        '청산은행이 아침 언와인드를 거부해 트라이파티 레포 전체가 결제되지 않았습니다. 브로커딜러는 당일 결제를 할 수 없었고 지주회사는 즉시 파산을 신청했습니다.',
      failed: true,
      ruleText:
        '청산은행의 담보 요구를 거부하거나 준비 없이 개장하면 언와인드가 거부되어 종료됩니다.',
    },
    {
      id: 'liquidity_no_capacity',
      when: {
        all: [
          { metric: 'cash', lt: 0 },
          { metric: 'facilityHeadroom', lt: 1 },
        ],
      },
      reason: 'closure_liquidity',
      title: '유동성 풀 소진 — 청산은행 언와인드 거부, Chapter 11',
      narrative:
        '유동성 풀이 음수가 되었고 브로커딜러에 PDCF 적격 담보 여력이 없었습니다. 청산은행이 언와인드를 거부해 결제가 멈추었고 지주회사는 파산을 신청했습니다.',
      failed: true,
      ruleText: '유동성 풀이 음수이고 PDCF 적격 담보 여력이 없으면 종료됩니다.',
    },
    {
      id: 'liquidity_persistent',
      when: { metric: 'cash', lt: 0, consecutiveTurns: 2 },
      reason: 'closure_liquidity',
      title: '유동성 풀 음수 지속 — 결제 실패',
      narrative:
        '유동성 풀이 두 턴 연속 음수였습니다. 청산은행과 카운터파티가 결제를 거부했습니다.',
      failed: true,
      ruleText:
        '유동성 풀이 두 턴 연속 음수이면 종료됩니다 (PDCF 여력이 있어도 차입하지 않으면 적용).',
    },
    {
      id: 'capital',
      when: { metric: 'leverageRatio', lt: 2 },
      reason: 'capital',
      title: '자본 잠식 — 지급불능',
      narrative:
        '실현손실로 Tier 1 자본이 총자산의 2% 아래로 떨어졌습니다. 카운터파티가 지급능력을 의심해 모든 조달이 중단되었고 지주회사는 파산을 신청했습니다.',
      failed: true,
      ruleText: '레버리지비율(Tier1/총자산)이 2% 미만이면 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'sold_with_support',
      when: { flag: 'sold_with_support' },
      title: '정부 지원부 매각 — 역사에 없던 선택지',
      narrative:
        '월요일 아침 인수자와 당국이 제한적 손실 분담 구조를 공동 발표했습니다. 고객 자산과 결제는 유지되었지만 메리디언은 독립 기관으로 존속하지 못했습니다. 이 결말은 반사실입니다: 2008년 9월의 연준·재무부에는 이 보증을 제공할 권한도 의지도 없었습니다(Bernanke 2010; Ball 2016의 반론 참조).',
    },
    {
      id: 'survived_independent',
      when: { flag: 'stay_open' },
      title: '생존 — 반사실의 한 주',
      narrative:
        '메리디언은 월요일에 문을 열었고 브로커딜러는 확대된 PDCF로 결제를 지켰습니다. AIG 구제와 MMF 런을 지나 금요일 시스템 보증이 나왔습니다. 그러나 이 결말은 낙관적 반사실입니다: 지주의 만기와 파생 담보는 여전히 창구 밖이었고, 독립 투자은행의 익일물 도매 조달 모델은 그 주에 끝났습니다. 다음 결정은 은행지주회사 전환과 신자본입니다.',
    },
    {
      id: 'default',
      title: '시나리오 종료',
      narrative: '9월 19일 금요일, 시스템 보증이 나왔습니다. 메리디언의 한 주가 끝났습니다.',
    },
  ],
  scoring: lehmanScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': ['t0-a', 't0-e'],
        't1-d1': ['t1-a'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-a'],
        't2-d2': ['t2-d2-a'],
        't3-d1': ['t3-a'],
        't3-d2': ['t3-d2-e'],
        't4-d1': ['t4-a'],
        't4-d2': ['t4-d2-c'],
        't5-d1': ['t5-a'],
      },
      note: '리먼의 실제 순서: 풀 "$42B" 공표 + SpinCo 설계 → 손실·계획 선공개 → PB 정시 처리 → JPM $5B 현금 예치 → CMBS 레포 헤어컷 수용 → 민간 해법·무조치 → 컨소시엄/바클레이스 → 런던 스윕 → 무질서 Chapter 11. 체크포인트: 9/12 누적 유출 ≈38, 풀 ≈2, 9/15 Chapter 11.',
    },
    expert: {
      choices: {
        't0-d1': ['t0-b', 't0-c', 't0-d'],
        't1-d1': ['t1-b'],
        't1-d2': ['t1-d2-a'],
        't2-d1': ['t2-c'],
        't2-d2': ['t2-d2-c', 't2-d2-b'],
        't3-d1': ['t3-b', 't3-c'],
        't3-d2': ['t3-d2-a'],
        't4-d1': ['t4-b'],
        't4-d2': ['t4-d2-a', 't4-d2-b'],
        't5-d1': ['t5-b'],
      },
      note: 'PDCF 사전 예치 + 확정 매각 + 정직한 풀 공개 → 확정 거래 동반 공시 → PDCF로 담보 콜 대응, 레포 질서 있는 축소 → 연준 조기 접촉·보증 요청·PDCF 차입 → bad-bank 확정·고객 자산 분리 → 사전 조율된 Chapter 11(질서 있는 실패). 생존하지 못하지만 역사 경로보다 높은 점수.',
    },
  },
  checkpoints: [
    {
      turnId: 't3',
      metric: 'cumulativeOutflow',
      expected: 38,
      tolerance: 0.3,
      label: '9/12(금) 누적 자금 유출 ≈$38B (풀 $42B → ≈$2.4B; Valukas·SEC Cox 서한 앵커)',
    },
    {
      turnId: 't3',
      metric: 'cash',
      expected: 2.4,
      tolerance: 1,
      label:
        '9/12(금) 유동성 풀 ≈$2.4B (Examiner Vol.4: 보고유동성 $32.5B 중 즉시 현금화 가능 $2.4B)',
    },
  ],
  debrief: lehmanDebrief,
})

export default scenario
