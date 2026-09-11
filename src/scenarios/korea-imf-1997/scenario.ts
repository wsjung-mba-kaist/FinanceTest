import type { CentralBankState, ScenarioDefinition } from '../../engine/types'
import { defineScenario } from '../_shared/define'
import { imfDebrief } from './debrief'
import { imfInitialCentralBank, imfInitialConfidence, imfInitialMarket } from './initialState'
import { imfScoring } from './scoring'
import { IMF_SOURCES } from './sources'
import { turnsA } from './turnsA'
import { turnsB } from './turnsB'

const scenario: ScenarioDefinition<CentralBankState> = defineScenario<CentralBankState>({
  meta: {
    id: 'korea-imf-1997',
    version: 1,
    title: '가용외환보유액 39억달러',
    subtitle: '1997년 외환위기',
    era: '1997-11',
    year: 1997,
    region: 'korea',
    role: 'central_bank_official',
    roleTitle: '재경원·한은 정책담당',
    institutionType: 'central_bank',
    institutionName: '대한민국 외환당국',
    modelledOn:
      '재정경제원 + 한국은행 (1997-10-22 ~ 1998-01-28 기록). 기관은 실명 그대로이며, 개인의 발언은 모두 기록에 기초한 개연성 있는 재구성이다.',
    difficulty: 'advanced',
    durationTurns: 10,
    turnUnit: 'week',
    estMinutes: 50,
    timezone: 'Asia/Seoul',
    learningObjectives: [
      {
        id: 'lo1',
        text: '가용외환보유액과 총외환보유액을 구분하고, 현물 개입·해외점포 예치·외채 상환·대외지원이 두 숫자를 각각 어떻게 움직이는지 설명한다.',
        competency: 'liquidity',
        decisionIds: ['t1-d1', 't3-d3', 't4-d3', 't8-d2'],
      },
      {
        id: 'lo2',
        text: '환율 방어와 제도 변경(일일변동폭 확대·폐지)의 트레이드오프를 판단하고, 상한가 거래 불성립이 왜 안정이 아니라 시장 정지인지 설명한다.',
        competency: 'policy',
        decisionIds: ['t0-d2', 't3-d3', 't4-d1', 't8-d1'],
      },
      {
        id: 'lo3',
        text: '구제금융 요청과 채권은행 만기연장 협상에서 **시점**이 조건과 결과를 정한다는 것을 이해하고, 공적 자금과 민간 채권자 관여의 역할 분담을 설명한다.',
        competency: 'policy',
        decisionIds: ['t3-d1', 't5-d1', 't7-d3', 't9-d1'],
      },
      {
        id: 'lo4',
        text: '부실 금융기관 정리에서 정지와 채무 승계를 같은 날 발표해야 하는 이유를 알고, 지원·선별 정리·일괄 정리의 대외 파급을 비교한다.',
        competency: 'compliance',
        decisionIds: ['t1-d1', 't3-d2', 't6-d1', 't7-d2'],
      },
      {
        id: 'lo5',
        text: '검증 가능한 수치 공개와 수치 없는 안심 발언을 구분하고, 위기 중 통계 공표 기준이 정책 자체를 규율한다는 점을 설명한다.',
        competency: 'communication',
        decisionIds: ['t2-d1', 't4-d2', 't5-d2', 't8-i1'],
      },
    ],
    competencies: { policy: 3, liquidity: 2, communication: 2, compliance: 1 },
    tags: ['환율', 'IMF', '종금사', '외채 롤오버'],
    sources: IMF_SOURCES,
  },
  units: { currency: 'USD', scale: 1e8, display: '억달러' },
  initialState: {
    institution: imfInitialCentralBank,
    market: imfInitialMarket,
    confidence: imfInitialConfidence,
    regulatorLevel: 1,
    flags: {},
    counters: {
      drainMultiplier: 1,
      rolloverBonus: 0,
      interventionThisTurn: 0,
      interventionTotal: 0,
      drainThisTurn: 0,
      drainTotal: 0,
      bandLockedDays: 0,
      unfilledFxDemandPct: 0,
      suspendedMerchantBanks: 0,
      rolloverConverted: 0,
      branchDeposits: 0,
      externalSupportDrawn: 0,
      realEconomyCost: 0,
      // 협상 대화(turnsB.ts)의 숫자 약속. 역사 기준값으로 초기화해 두면 대화를 건너뛰어도
      // (마감 스윕으로 기본 옵션이 확정되어도) 역사적 결과가 그대로 재현된다.
      loiRateCeilingPct: 21,
      debtGuaranteeBn: 240,
    },
  },
  briefing: {
    situation: `1997년 10월 22일 수요일. 귀하는 **재정경제원·한국은행 정책담당**입니다.

오늘 아침 기아자동차가 법정관리를 신청했습니다. 7월 태국 바트가 무너진 뒤 넉 달, 인도네시아와 말레이시아를 거쳐 압력이 홍콩까지 왔고, 다음은 원화라는 것을 모두가 알고 있습니다.

책상 위에는 두 개의 숫자가 있습니다. **총외환보유액 305.1억달러**와 **가용외환보유액 223.0억달러**. 앞의 숫자는 매월 공표되고, 뒤의 숫자는 공표되지 않습니다. 차이 82.1억달러는 대부분 국내은행 해외점포에 예치된 외화입니다 — 장부에는 있지만 회수하면 그 점포가 그날로 지급불능이 됩니다.

같은 서랍에 세 번째 숫자가 있습니다. **1개월 안에 만기가 돌아오는 단기외채 85억달러.** 총단기외채는 900억달러 안팎이고, 총외채의 59%가 1년 이내 만기입니다.

10턴입니다: 10/22~24 → 10/27~31 → **11/5(일중)** → 11/10~17 → **11/19~20(일중)** → 11/21~28 → 12/1~3 → 12/4~12 → **12/16~23(일중)** → 12/24~1/28. 굵게 표시된 세 턴은 하루 또는 이틀을 시간 단위로 쪼개어 진행합니다.`,
    mandate: `**권한**: 외환시장 개입 규모, 환율 일일변동폭(고시), 콜금리, 종합금융회사 업무정지·지원, 한국은행 외화 운용(해외점포 예치·직접 대출), 대외지원 요청 시점과 규모, 통계 공표 기준, 채권은행 만기연장 협상의 개시와 조건을 결정합니다.

**상위 승인 필요**: 국가보증(국회 동의), 예금 전액보장(대통령 재가), 법 개정 사항.

**사용 불가**: 1997년에 존재하지 않던 수단 — 주요국 중앙은행과의 상설 통화스와프, 외화 유동성 커버리지 규제, 외환시장 24시간 거래. 자본통제는 법적으로 가능하지만 국제통화기금 프로그램 조항과 충돌합니다.

**목표**: 대외지급 정지 없이 1998년 1월 말까지 도달하되, 가용외환보유액과 협상력을 최대한 보전하십시오. 무엇을 쓰든 그 비용이 **보이게** 하십시오.`,
    institutionProfile: `| 항목 | 값 | 비고 |
|---|---|---|
| **총외환보유액** | 305.1억달러 | 매월 공표되는 숫자 |
| **가용외환보유액** | 223.0억달러 | 오늘 결제에 쓸 수 있는 숫자 |
| **괴리** | 82.1억달러 | 국내은행 해외점포 예치금 등 |
| 선물환 매도·스왑 잔액 | 30.0억달러 | 공표되지 않음 |
| 총외채 | 1,530억달러 | 단기 비중 58.8% |
| 단기외채 | 900억달러 | 잔존만기 1년 이내 |
| 1개월 내 만기 도래 | 85억달러 | |
| 단기외채 커버리지 | 약 25% | 가용/단기외채 (기준 100%) |
| 수입 커버 | 약 1.9개월 | 가용/월평균 수입 (기준 3개월) |
| 원/달러 | 924.4원 | 일일변동폭 ±2.25% |
| 콜금리 | 12.75% | |
| 종합금융회사 | 30개사 | 외화조달 200억달러(단기 60%), 자기자본 잠식 12개사 |
| 국가신용등급 | AA− | 전망 부정적 |
| 국가채무/GDP | 11.9% | **재정 위기가 아니다** |

**핵심 취약점**: 단기로 빌려 장기로 굴린 종합금융회사, 잔존만기 1년 이내 외채 900억달러, 그리고 그 위에 놓인 가용 223억달러. 재정은 건전하고 경상수지는 개선 중입니다 — 문제는 만기 구조입니다.`,
    marketBackdrop: `7월 2일 태국이 바트 변동환율로 이행할 때 원/달러는 886원이었습니다. 이후 인도네시아 루피아와 말레이시아 링깃이 차례로 무너졌고, 10월 17일 대만이 방어를 포기했으며, 10월 23일 홍콩 항셍지수가 하루 10% 넘게 떨어졌습니다. 홍콩은 페그를 지키기 위해 단기금리를 끌어올리는 길을 택했습니다.

국내에서는 1월 한보를 시작으로 삼미·진로·대농·기아로 대기업 부도가 이어졌습니다. 그 청구서는 은행과 종합금융회사의 장부에 있습니다. 종합주가지수는 566.85, 콜금리는 12.75%, 회사채(3년 AA−) 유통수익률은 12.45%입니다.

해외 채권은행들은 9월부터 한국 금융기관에 대한 신용공여 한도를 조금씩 줄이고 있습니다. 단기외채 롤오버율은 아직 90%대입니다.`,
    stakeholders: [
      {
        name: '한국은행',
        wants: '가용외환보유액 보전, 대외지원 조기 요청',
        canDo: '외환시장 개입, 외화 운용(해외점포 예치·외화대출), 콜금리 조절, 통계 산출',
      },
      {
        name: '재정경제원',
        wants: '환율 안정, 정치적 비용 최소화, 대외 신인도 유지',
        canDo: '환율 변동폭 고시, 종합금융회사 업무정지, 대외지원 요청, 대책 발표',
      },
      {
        name: '국제통화기금',
        wants: '거시 조정, 금융 구조조정, 자본시장 개방, 통계 투명성',
        canDo: '대기성차관·보완준비금융(요청~이사회 승인 2~4주), 프로그램 조건 부과',
      },
      {
        name: '종합금융회사 30개사',
        wants: '외화 만기 지원, 업무정지 회피',
        canDo: '외화 CP·단기차입 롤오버 시도, 한국은행·정부에 지원 요청',
      },
      {
        name: '해외 채권은행(미·일·유럽)',
        wants: '원금 회수 또는 회수 위험의 명확화',
        canDo: '만기 연장 또는 회수, 신용라인 축소, 만기연장 협상 참여',
      },
      {
        name: '국제 신용평가사',
        wants: '상환능력과 정책 일관성의 근거',
        canDo: '등급 강등(투자부적격 강등 시 기관투자자 강제 매도)',
      },
      {
        name: '언론·시장',
        wants: '가용보유액의 실제 규모',
        canDo: '수 시간 내 확산, 개입 규모 역산, 정보 공백을 추측으로 채움',
      },
    ],
    regulatoryFramework: `- **환율제도**: 시장평균환율제, 일일변동폭 ±2.25%. 변동폭은 재정경제원 고시로 변경 가능하며 다음 영업일부터 시행됩니다. 상한에 닿으면 매도 주문이 체결되지 않고 잔량이 다음 날로 넘어갑니다(거래 불성립).
- **한국은행법**: 금융기관에 대한 긴급여신과 영리기업 여신 조항으로 종합금융회사에 외화·원화를 지원할 수 있습니다. 외화자산 운용의 일환으로 국내은행 해외점포에 외화를 예치할 수 있으며, 이 예치금은 **총외환보유액에는 계상되지만 가용분에서는 빠집니다**.
- **종합금융회사**: 인가·감독·업무정지 모두 재정경제원 처분 사항입니다.
- **국제통화기금**: 대기성차관(Stand-By Arrangement)과 보완준비금융(SRF). 요청은 재무장관·중앙은행 총재 명의 서한으로 즉시 가능하나 **이사회 승인까지 2~4주**가 걸립니다. 프로그램은 통화·재정·금융 구조조정·자본시장 개방·통계 공표 기준을 조건으로 답니다.
- **보유액 적정성 기준**: 잔존만기 1년 이내 외채의 100% 커버(Greenspan-Guidotti), 수입 3개월. 두 기준 모두 **가용** 기준으로 재는 것이 원칙입니다.
- **대외 신인도 경보 R0~R4**: 정상 → 강화 관찰 → 프로그램 협상 → 프로그램 이행 → 대외지급 불능. 대외지급 정지 선언은 즉시 R4입니다.`,
    cardRefs: [
      'korea-crisis-toolkit',
      'contingency-funding-plan',
      'crisis-communication',
      'regulator-escalation-ladder',
      'bank-run-dynamics',
    ],
    simplificationNotes: [
      '재정경제원과 한국은행을 하나의 정책 주체로 합성했다. 실제로는 두 기관의 판단이 달랐고, 감사원 특별감사는 한국은행의 23차례 보고에도 대응이 지연되었다고 지적했다 — 그 긴장은 메모와 전화 이벤트로만 표현했다.',
      '가용외환보유액의 일별 계열은 공표된 적이 없다. 10월말 223억달러·11월말 72.6억달러·12월 18일 39억달러는 국회 청문회 기록과 사후 문헌에서 재구성한 값이며 facts.ts에 [VERIFY]로 표시했다. 총외환보유액 월말 계열만이 1차 통계다.',
      '현물 개입의 60%가 스왑·차입으로 조달되어 총외환보유액이 개입액의 40%만 줄어든다는 규칙은 역사 앵커(10~11월 소진 151억달러 / 공표치 감소 61억달러)에서 역산한 보정값이다.',
      '턴별 대외 유출액·롤오버율 경로·1개월 만기 도래액은 보정값이다. 각 턴의 유출액은 역사 경로에서 실제로 빠져나간 금액으로 맞추었고, 역사와 다른 선택만 유출 계수를 움직인다.',
      '환율은 턴별 종가를 앵커로 두고 개입 규모의 편차로 보정한다. 일중 경로(12월 23일 장중 1,995원 → 종가 1,962원 포함)는 저작된 티커다.',
      '국가신용등급은 평가사별 경로를 하나로 합쳤다. 12월 21일 무디스 Ba1만이 도시에 확정 사실이고 중간 단계 일자는 [VERIFY]다.',
      '모든 전화·회의 대사는 기록에 기초한 개연성 있는 재구성이며 실제 발언의 인용이 아니다. 화자는 직책으로만 표기했다.',
      '1998년 2월 이후의 사건(종금사 인가취소, 감사원 특별감사 결과, 공적자금, 실업률, 은행 매각)은 엔딩과 디브리핑에서만 다룬다.',
    ],
    disclaimer:
      '본 시나리오는 공개 자료(한국은행 통계·연차보고서, 재정경제원 발표, 국제통화기금 프로그램 문서와 독립평가국 보고서, 감사원 특별감사, 국회 청문회 기록, 당시 보도)를 바탕으로 교육 목적으로 재구성한 것입니다. 기관은 실재하는 그대로 썼으나 개인의 발언은 모두 재구성이며 실제 인용이 아닙니다. 수치는 단순화·보정되었습니다.',
  },
  kpis: [
    {
      metric: 'usableReserves',
      label: '가용외환보유액',
      labelEn: 'Usable FX Reserves',
      unit: 'ccy',
      primary: true,
      sparkline: true,
      description: '오늘 결제에 쓸 수 있는 돈. 음수가 되면 대외지급 불능',
      decimals: 1,
    },
    {
      metric: 'grossReserves',
      label: '총외환보유액(공표)',
      labelEn: 'Gross FX Reserves',
      unit: 'ccy',
      sparkline: true,
      description: '매월 공표되는 숫자 — 해외점포 예치금을 포함한다',
      decimals: 1,
    },
    {
      metric: 'reserveGap',
      label: '가용·총액 괴리',
      labelEn: 'Usable / Gross Gap',
      unit: 'ccy',
      sparkline: true,
      description: '총액 − 가용. 대부분 국내은행 해외점포 예치금',
      decimals: 1,
    },
    {
      metric: 'stDebtDue30d',
      label: '1개월 내 만기 단기외채',
      labelEn: 'ST Debt Due (30d)',
      unit: 'ccy',
      description: '가용보유액이 이 값보다 적어지면 방어는 도박이 된다',
      decimals: 1,
    },
    {
      metric: 'guidottiRatio',
      label: '단기외채 커버리지',
      labelEn: 'ST Debt Cover (Guidotti)',
      unit: '%',
      sparkline: true,
      description: '가용/단기외채 — 국제 기준 100%',
      decimals: 1,
      referenceLabel: '기준 100%',
    },
    {
      metric: 'fxSpot',
      label: '원/달러',
      labelEn: 'KRW/USD',
      unit: 'fx',
      sparkline: true,
      decimals: 1,
    },
  ],
  thresholds: {
    usableReserves: { warn: 90, breach: 40, direction: 'below' },
    grossReserves: { warn: 250, breach: 150, direction: 'below' },
    reserveGap: { warn: 120, breach: 170, direction: 'above' },
    stDebtDue30d: { warn: 110, breach: 150, direction: 'above' },
    fxSpot: { warn: 1000, breach: 1400, direction: 'above' },
    rolloverRatePct: { warn: 70, breach: 45, direction: 'below' },
  },
  noise: {
    runoffSigma: 0.12,
    runoffCap: 0.25,
    tickerSigma: 0.008,
    tickerSigmaBp: 3,
    eventJitter: 1,
  },
  turns: [...turnsA, ...turnsB],
  gameOver: [
    {
      id: 'moratorium',
      when: { flag: 'moratorium_declared' },
      reason: 'moratorium',
      title: '대외지급 정지 — 모라토리엄',
      narrative:
        '대외지급 정지가 선언되었습니다. 신용장이 거절되고 원유·원자재 수입이 멈췄으며, 국가신용등급은 선택적 디폴트로 내려갔습니다. 국제 자본시장 재진입에는 수년이 걸립니다. 한국은 실제로 이 길을 가지 않았습니다 — 1998년 1월 13개 국제은행과의 만기연장 합의가 같은 목적을 훨씬 싸게 달성했습니다.',
      failed: true,
      ruleText: '대외지급 정지(모라토리엄)를 선언하면 즉시 종료됩니다.',
    },
    {
      id: 'sovereign_default',
      when: { metric: 'usableReserves', lt: 0 },
      reason: 'sovereign_default',
      title: '가용외환보유액 소진 — 대외지급 불능',
      narrative:
        '가용외환보유액이 바닥났습니다. 공표 보유액에는 아직 숫자가 남아 있지만 그 돈은 국내은행 해외점포에 있고, 회수하면 그 점포가 먼저 무너집니다. 오늘 만기가 돌아온 외화 채무를 결제하지 못했습니다. 대외지급 불능이 사실이 된 이상 공표되던 숫자는 아무 의미가 없습니다.',
      failed: true,
      ruleText: '가용외환보유액이 음수가 되면 대외지급 불능으로 종료됩니다.',
    },
    {
      id: 'trade_freeze',
      when: { counter: 'bandLockedDays', gte: 8 },
      reason: 'trade_freeze',
      title: '거래 불성립 누적 — 무역금융 마비',
      narrative:
        '일일변동폭 상한에 연일 닿아 외환시장에서 거래가 성립하지 않는 날이 여드레를 넘었습니다. 수입결제가 밀리고 신용장이 거절되기 시작했으며, 미체결 달러 수요가 역외로 빠져나갔습니다. 화면의 환율은 안정적이었지만 안정된 것은 환율이 아니라 거래량이었습니다.',
      failed: true,
      orderly: true,
      ruleText:
        '변동폭 상한에서 거래가 성립하지 않은 날이 누적 8영업일에 이르면 무역금융 마비로 종료됩니다.',
    },
  ],
  endings: [
    {
      id: 'orderly',
      when: {
        all: [{ metric: 'usableReserves', gte: 140 }, { confidence: { gte: 45 } }],
      },
      title: '질서 있는 회복 — 협상으로 끝낸 위기',
      narrative:
        '대외지급 정지 없이 1998년 1월 말에 도달했습니다. 회수가 멈췄고, 해외점포에 잠겨 있던 외화가 환류했으며, 가용외환보유액이 처음으로 세 자릿수로 올라왔습니다. 이후 4월에 외환보유액이 300억달러를 회복했고 40억달러 외국환평형기금채권으로 국제 자본시장에 복귀했습니다. 구조조정의 청구서는 그대로 남았습니다 — 금융감독위원회 출범, 은행 5곳의 자산부채이전, 공적자금 투입, 그리고 실업률의 급등. 그러나 이 위기를 끝낸 것이 공적 자금이 아니라 민간 채권자의 회수를 멈춘 협상이었다는 사실은 남습니다.',
    },
    {
      id: 'survived',
      when: { metric: 'usableReserves', gte: 60 },
      title: '버텨 냈다 — 그러나 값비싸게',
      narrative:
        '대외지급 정지는 없었습니다. 1998년 1월 말 가용외환보유액은 회복 국면에 들어섰고 만기연장 합의가 회수를 멈췄습니다. 그러나 10~11월에 쓴 돈은 돌아오지 않았고, 협상 조건은 남은 보유액만큼만 다툴 수 있었습니다. 금리 30%와 환율 1,700원대가 이어지는 동안 부도와 실업이 급증했습니다. 1998년의 청구서는 공적자금과 실업률로 지불됩니다.',
    },
    {
      id: 'strained',
      title: '겨우 넘겼다 — 실탄 없이 맞은 1월',
      narrative:
        '지급 정지에는 이르지 않았지만 가용외환보유액은 거의 남지 않았습니다. 만기연장 협상은 우리가 제시할 것이 없는 상태에서 진행되었고, 조건은 상대가 정했습니다. 1998년은 훨씬 긴 해가 될 것입니다.',
    },
  ],
  scoring: imfScoring,
  paths: {
    historical: {
      choices: {
        't0-d1': 't0-d1-a',
        't0-d2': 't0-d2-a',
        't1-d1': 't1-d1-a',
        't1-d2': 't1-d2-a',
        't2-d1': 't2-d1-a',
        't2-d2': 't2-d2-add',
        't2-i1': 't2-i1-branch',
        't3-d1': 't3-d1-a',
        't3-d2': 't3-d2-a',
        't3-d3': 't3-d3-a',
        't4-d1': ['t4-d1-deposit', 't4-d1-band10', 't4-d1-npl'],
        't4-d2': 't4-d2-a',
        't4-d3': 't4-d3-a',
        't4-i1': 't4-i1-consider',
        't5-d1': 't5-d1-a',
        't5-d2': 't5-d2-a',
        't5-d3': 't5-d3-a',
        't6-d1': 't6-d1-a',
        't6-d2': 't6-d2-a',
        't6-d3': 't6-d3-a',
        't7-d1': 't7-d1-a',
        't7-d2': ['t7-d2-a', 't7-d2-b'],
        't7-d3': 't7-d3-a',
        't8-d1': 't8-d1-a',
        't8-d2': 't8-d2-hold',
        't8-i1': 't8-i1-note',
        't9-d1': 't9-d1-a',
        't9-d2': ['t9-d2-a', 't9-d2-b'],
      },
      note: '실제 경로: 10~11월 환율 방어(누적 약 151억달러) → 11/5 가용보유액 보도에 총액만 재확인 → 11/17 1,000원 붕괴 → 11/19 예금 전액보장·변동폭 ±10% 확대·경제팀 교체 → 11/21 구제금융 신청 → 12/2·12/10 종금사 14개사 정지 → 12/3 의향서·12/4 210억달러 승인·12/5 콜금리 21% → 12/16 변동폭 폐지 → 12/18 가용 39억달러 → 12/21 Ba1 → 12/22 은행 외화채무 200억달러 국가보증 → 12/23 종가 1,962원(장중 1,995원) → 12/24 조기지원 100억달러 → 1998/1/28 단기외채 240억달러 만기연장, 정부보증 218.4억달러 전환.',
    },
    expert: {
      choices: {
        't0-d1': 't0-d1-c',
        't0-d2': 't0-d2-b',
        't1-d1': 't1-d1-b',
        't1-d2': 't1-d2-b',
        't2-d1': 't2-d1-b',
        't2-d2': 't2-d2-stop',
        't2-i1': 't2-i1-conditional',
        't3-d1': 't3-d1-b',
        't3-d2': 't3-d2-b',
        't3-d3': 't3-d3-b',
        't4-d1': ['t4-d1-deposit', 't4-d1-npl'],
        't4-d2': 't4-d2-b',
        't4-d3': 't4-d3-b',
        't4-i1': 't4-i1-request',
        't5-d1': 't5-d1-b',
        't5-d2': 't5-d2-b',
        't5-d3': 't5-d3-a',
        't6-d1': 't6-d1-b',
        't6-d2': 't6-d2-b',
        't6-d3': 't6-d3-a',
        't7-d1': 't7-d1-a',
        't7-d2': ['t7-d2-a', 't7-d2-b'],
        't7-d3': 't7-d3-b',
        't8-d1': 't8-d1-a',
        't8-d2': 't8-d2-hold',
        't8-i1': 't8-i1-maturity-table',
        't9-d1': 't9-d1-a',
        't9-d2': ['t9-d2-a', 't9-d2-b'],
      },
      note: '전문가 경로: 종금사 실태·가용보유액을 공개하고(T0·T2·T5) 방어 대신 제도를 바꾸며(T3 변동폭 확대, T4 확대 후 무개입), 두 협상을 일주일씩 앞당긴다(T3 구제금융 요청, T7 채권은행 만기연장 협상 개시). 종금사는 승계 방침과 함께 선별 정리한다(T3·T6).',
    },
  },
  checkpoints: [
    {
      turnId: 't4',
      metric: 'usableReserves',
      expected: 72.6,
      tolerance: 0.15,
      label: '11월 말 가용외환보유액 72.6억달러 (10/21 223.0 → 약 151억달러 소진)',
    },
    {
      turnId: 't4',
      metric: 'grossReserves',
      expected: 244.0,
      tolerance: 0.15,
      label: '11월 말 총외환보유액 244억달러 — 같은 기간 61억달러만 줄었다',
    },
    {
      turnId: 't8',
      tick: 1,
      metric: 'usableReserves',
      expected: 39.0,
      tolerance: 0.15,
      absTolerance: 6,
      label: '1997-12-18 가용외환보유액 39억달러 (시나리오 제목의 그 숫자)',
    },
    {
      turnId: 't8',
      metric: 'fxSpot',
      expected: 1962.0,
      tolerance: 0.03,
      label: '1997-12-23 원/달러 종가 1,962.0원 (장중 고가는 1,995.0원)',
    },
    {
      turnId: 't7',
      metric: 'imfCommitted',
      expected: 210.0,
      tolerance: 0.02,
      label: '1997-12-04 국제통화기금 승인 210억달러 (SDR 155억 = 대기성 75 + 보완준비 135)',
    },
    {
      turnId: 't7',
      counter: 'suspendedMerchantBanks',
      expected: 14,
      tolerance: 0.01,
      label: '업무정지 종합금융회사 누계 14개사 (12/2 9개 + 12/10 5개)',
    },
    {
      turnId: 't9',
      counter: 'rolloverConverted',
      expected: 218.4,
      tolerance: 0.02,
      label: '1998-03-31 정부보증 전환 단기외채 218.4억달러 (합의 대상 약 240억달러)',
    },
  ],
  debrief: imfDebrief,
})

export default scenario
