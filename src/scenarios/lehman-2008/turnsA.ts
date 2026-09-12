import type { BankState, Interrupt, Turn } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import { confidence, counter, flag, op, ownStockMove, regulator } from '../../engine/fx/common'
import { ibFx } from './fx'

type T = Turn<BankState>

/** 출처 id (sources.ts). */
export const S = {
  q10: 'lehman-10q-2q08',
  k8: 'lehman-8k-2008-09-10',
  k8nb: 'lehman-8k-2008-09-29',
  fcic: 'fcic-report-2011',
  val: 'valukas-report-2010',
  valT: 'valukas-testimony-2011',
  fed914: 'fed-pr-2008-09-14',
  fed316: 'fed-pr-2008-03-16',
  fed311: 'fed-pr-2008-03-11',
  aig: 'fed-pr-2008-09-16-aig',
  amlf: 'fed-pr-2008-09-19-amlf',
  mmf: 'treasury-hp1147',
  cox: 'sec-cox-basel-2008-03-20',
  bern: 'bernanke-fcic-2010-04-20',
  fdic: 'fdic-quarterly-2011-lehman',
  fhSup: 'fed-history-support-institutions',
  fhCredit: 'fed-history-credit-programs',
  bcbs: 'bcbs-144',
  cgfs: 'cgfs-36',
  rock: 'hc-treasury-run-on-the-rock-2008',
  sr506: 'nyfed-sr506',
  epr: 'nyfed-epr-triparty-2012',
  ball: 'ball-nber-w22410',
  pressKdb: 'press-kdb-2008-09-09',
  pressNb: 'press-nb-carlyle-2008-09',
}

/** 도주성 조달 시작 잔액(세그먼트 합) — 라이브 카운터 조건 산정용. */
const START_RUNNABLE = 80

/**
 * 뉴욕 영업일의 자금 유출 분포(틱 5개). **전방 집중** — 트라이파티 언와인드가 아침에 일어나고
 * PB 잔고 이전·노베이션 지시가 개장 전에 쌓여 있다가 한꺼번에 나간다. 오후에는 무담보 만기와
 * 남은 결제만 남는다. 시각별 분해 자료는 공개되지 않았으므로 모양 자체는 [STYLIZED]이며,
 * 합계는 1이므로 variance 0에서 슬라이스 합이 종전 단일 호출과 정확히 일치한다(calibration.md §7.1).
 */
export const NY_DAY_PROFILE = [0.35, 0.25, 0.18, 0.12, 0.1]

// 사후정보 금지 토큰(턴 T0~T5 텍스트에 등장 불가): AIG, Reserve Primary, AMLF, TARP, TLGP, CPFF.
// PDCF 담보 확대는 T5(9/14 저녁) 이전 텍스트에 등장 불가 — lehman.test.ts 가 검사한다.

// ---------------------------------------------------------------------------------------------
// T0 — 2008-09-09 (화) "KDB 협상 결렬"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2008년 9월 9일 (화) 09:00 ET',
  title: '프롤로그: 산업은행 협상 결렬',
  time: '2008-09-09T09:00:00-04:00',
  entryEffects: [
    {
      id: 't0-stock',
      description: 'KDB 협상 결렬 보도 → 주가 −45% (9/9 실제)',
      effects: [ownStockMove(-0.45, 'KDB 협상 결렬')],
    },
  ],
  events: [
    {
      id: 't0-news-kdb',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '08:40',
      headline: '한국산업은행, 메리디언 브라더스 지분 인수 협상 종료 — 주가 급락',
      body: '산업은행이 메리디언 지분 25% 인수 협상을 중단했다는 보도가 나오면서 프리마켓에서 주가가 40% 이상 급락하고 있다. 회사는 "여러 전략적 대안을 검토 중"이라고만 밝혔다. 3분기 실적 발표는 다음 주로 예정되어 있다.',
      severity: 'critical',
      sourceRefs: [S.pressKdb],
      relatedMetrics: ['ownStock', 'confidence'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '09:30',
      headline: '개장 시세',
      items: [
        { label: 'MB 주가(지수)', value: '55', change: '−45%' },
        { label: 'MB 5y CDS', value: '≈475bp', change: '확대' },
        { label: 'TED 스프레드', value: '≈115bp', change: '' },
        { label: 'FF 목표', value: '2.00%', change: '' },
      ],
      sourceRefs: [S.pressKdb],
    },
    {
      id: 't0-memo-pool',
      kind: 'memo',
      time: '09:45',
      from: '자금부장',
      to: 'Treasurer',
      subject: '유동성 풀 구성과 이번 주 만기',
      body: `- 보고용 유동성 풀 **$42B**. 그중 $7.5B는 청산은행(JPM) 담보 $5.5B와 씨티 comfort deposit $2B로 **사실상 사용 불가**. 가용 ≈ $34.5B.
- 트라이파티 레포 $185B: 국채·기관 $120B / 투자등급·주식 $40B / **CMBS·비투자등급 $25B**. 청산은행이 매일 아침 언와인드(일중 신용)한다.
- PB 프리크레딧 $25B, 헤지펀드 파생 담보 $15B, CP·MTN·은행 라인 만기 도래분 $12B.
- 브로커딜러의 PDCF 적격 담보는 트라이파티 담보로 이미 예치되어 있어 **PDCF 앞 사전 예치·테스트 차입 실적 없음**. 지주회사는 PDCF 적격 차입자가 아님.
- 자산운용 자회사(뉴버거) 매각 제안가 약 $7B [자문사 인용]; 상업용 부동산 북 $32.6B, 주택 $13.2B.`,
      severity: 'warning',
      sourceRefs: [S.k8, S.val, S.fed316],
      cardRefs: ['tri-party-repo-run', 'contingency-funding-plan'],
      relatedMetrics: ['cash', 'facilityHeadroom', 'repoRollRate'],
    },
    {
      id: 't0-call-jpm',
      kind: 'call',
      time: '11:00',
      caller: 'JPM 청산은행 리스크 헤드',
      callee: 'Treasurer',
      agency: 'JPMorgan Chase (트라이파티 청산은행)',
      tone: 'concerned',
      lines: [
        {
          speaker: 'JPM',
          text: '오늘 주가 흐름을 보고 있습니다. 귀사 트라이파티 담보 중 CMBS·비유동 증권의 가치평가를 재검토 중입니다. 추가 담보 요구가 있을 수 있습니다.',
        },
        { speaker: 'Treasurer', text: '요구 금액과 형태를 알려주시면 대응하겠습니다.' },
        {
          speaker: 'JPM',
          text: '6월에 받은 $5B는 담보로 잡혀 있습니다. 그 금액은 귀사 유동성 풀에서 빼고 보셔야 합니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.val, S.fcic],
      cardRefs: ['tri-party-repo-run'],
    },
    {
      id: 't0-memo-advisor',
      kind: 'memo',
      time: '14:00',
      from: '자문사(투자은행)',
      to: 'CEO · CFO · Treasurer',
      subject: '전략적 대안 (사전 검토)',
      body: `1) 3분기 실적을 **내일 아침 선공개**하고 상업용 부동산 SpinCo(REI Global, $25~30B)와 자산운용 자회사 지분 매각 계획을 함께 발표 — 시장의 불확실성을 줄인다는 논리.
2) 자산운용 자회사(뉴버거)는 확정 계약(bought)으로 바로 팔 수 있다: 제안가 ≈$7B, 종결 T+2.
3) PDCF는 브로커딜러 앞 담보만 받는다. 담보 이동·테스트에 1~2일.
4) 산업은행은 규제당국 반대로 사실상 끝났다. 재제안은 가능하나 기대는 낮다.`,
      sourceRefs: [S.k8, S.pressNb, S.fed316],
      cardRefs: ['capital-raise-sequencing'],
    },
    {
      id: 't0-regulator-sec',
      kind: 'regulator',
      agency: 'SEC · FRBNY (CSE 모니터링)',
      time: '16:30',
      headline: '일일 유동성 보고 요구',
      body: 'SEC 시장감독국과 뉴욕연준 담당자가 매일 마감 후 유동성 풀·트라이파티 레포·PB 잔고 보고를 요구했다. 3월 이후 상주 모니터링이 계속되고 있다.',
      tone: 'concerned',
      sourceRefs: [S.fcic, S.cox],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '긴급 대응 패키지',
      prompt:
        '실적 선공개 전 24시간 동안 무엇을 준비하시겠습니까? (최대 3개; "충분" 공표(A)와 정직 공개(D)는 함께 선택 불가)',
      context:
        '오늘 준비하지 않은 담보는 내일 현금이 되지 않습니다. 오늘 말한 숫자는 목요일에 검증됩니다.',
      select: { min: 1, max: 3 },
      exclusive: [['t0-a', 't0-d']],
      requiredConcepts: ['tri-party-repo-run', 'crisis-communication'],
      dimensions: ['liquidity', 'communication', 'solvency', 'timeliness'],
      options: [
        {
          id: 't0-a',
          label: '유동성 풀 "$42B 충분" 공표 — 청산은행 담보 예치분 포함 총액',
          description:
            '보고용 풀 총액을 그대로 안심 메시지로 낸다. $7.5B의 담보 예치분과 comfort deposit이 포함된 숫자다. 실행 가능: 보도자료·IR 콜.',
          effects: [
            flag('pool_overstated'),
            counter('statedPool', 42),
            confidence(3, '"충분" 공표 단기 안도'),
          ],
          expert: {
            rating: 15,
            rationale:
              '리먼은 9/10 "약 $41~42B"를 공표했지만 파산 조사관(Valukas)은 그중 청산은행 담보·comfort deposit이 사실상 사용 불가였고 9/12에는 즉시 현금화 가능 자산이 $2B 미만이었다고 판정했다. 검증 불가능한 숫자는 첫 담보 콜에서 모순이 드러나 증폭기가 된다.',
            historicalNote: '리먼의 실제 선택. 9/10 8-K "Estimated Liquidity Pool of $42 Billion".',
            sourceRefs: [S.val, S.k8, S.valT],
          },
          consequences:
            '보도자료 초안에 "$42B의 견고한 유동성 풀"이 들어갔습니다. 자금부는 가용 금액이 이보다 작다고 재차 경고했습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '큰 숫자는 하루의 안도를 산다. 그러나 담보로 잡힌 자산을 "가용"이라 부르면, 청산은행이 담보를 더 요구하는 순간 숫자와 현실의 차이가 시장에 노출된다(증폭 규칙: 거짓 백스톱 발표 후 모순).',
          feasibility: { basis: '보도자료·IR 콜은 당일 실행 가능', sourceRefs: [S.k8] },
          remediationCard: 'crisis-communication',
        },
        {
          id: 't0-b',
          label: 'PDCF 적격 담보를 브로커딜러 앞으로 사전 이동하고 테스트 차입',
          description:
            '트라이파티에 묶이지 않은 투자등급 인벤토리 ≈$20B를 브로커딜러 계정으로 옮겨 PDCF 담보로 설정하고 소액 테스트 차입을 한다. 비용은 운영 비용뿐이며 공개되지 않는다. 실행 가능: PDCF(3/16 신설) 운영 중.',
          effects: [
            bankFx.pledgeCollateral({ immediate: 20, label: 'PDCF 담보 사전 예치(브로커딜러)' }),
            flag('pdcf_prepositioned'),
          ],
          expert: {
            rating: 90,
            rationale:
              'Ball(2016)은 리먼이 PDCF 적격 담보 ≥$131B를 보유해 $88B를 차입할 수 있었다고 추정한다. 문제는 담보가 어디에, 누구 명의로 있느냐였다(연준의 "금요일 기준"). 바젤 원칙 11은 중앙은행 창구·담보 요건을 CFP에 사전 반영하라고 요구한다. 준비된 담보만 당일 자금이 된다.',
            sourceRefs: [S.ball, S.bcbs, S.fed316],
          },
          consequences:
            '담보 이전과 테스트 차입이 완료되었습니다. 브로커딜러의 PDCF 적격 담보 여력이 대시보드에 반영되었습니다.',
          feasibility: {
            basis: 'PDCF는 2008.3.16부터 운영; 담보 이동은 1~2일',
            sourceRefs: [S.fed316],
          },
          calibrationNote: '트라이파티 미예치 투자등급 인벤토리 중 2일 내 이동 가능분 20 [CAL]',
        },
        {
          id: 't0-c',
          label: '자산운용 자회사(뉴버거) 확정 매각 계약 협상 개시 — T+2 종결',
          description:
            '사모펀드 제안가 ≈$7B로 확정 계약(escrow·브릿지 포함)을 협상한다. 종결 대금은 T+2(9/11)에 들어온다. 실행 가능: 매수 의향자 복수 존재.',
          effects: [flag('nb_sale_signed')],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '자산운용 자회사 매각 종결 — 현금 $7B 유입, 장부가 대비 이익 자본 반영',
              effects: [ibFx.sellNeuberger({ price: 7, bookValue: 4, label: '뉴버거 매각 종결' })],
            },
          ],
          expert: {
            rating: 75,
            rationale:
              '리먼은 IMD 지분 55% 매각 "계획"만 발표했고 확정 계약이 없었다. 파산 후 같은 자산은 $2.15B에 팔렸다(8-K 9/29). 팔 수 있는 자산은 살 사람이 있을 때 팔아야 한다. 캐비앳: 2일 종결은 양식화.',
            sourceRefs: [S.k8nb, S.k8, S.pressNb],
          },
          consequences:
            '매수자와 확정 계약 조건에 합의했습니다. 종결 대금은 9월 11일에 입금될 예정입니다.',
          feasibility: {
            basis: '칼라일 등 매수 의향 존재(≈$7B); 확정 계약 2일 종결은 STYLIZED',
            sourceRefs: [S.pressNb],
          },
          calibrationNote: '장부가 4 [STYLIZED], 매각가 7 → 자본 +3 (8-K: 유형장부가 >$3B 개선)',
        },
        {
          id: 't0-d',
          label: '유동성 풀 구성 정직 공개 — 가용 $34.5B와 담보 예치분 구분',
          description:
            '공개 숫자에서 청산은행 담보·comfort deposit을 빼고 "즉시 가용 $34.5B + 담보 예치 $7.5B"로 나눠 말한다. 숫자는 작아지지만 검증 가능하다.',
          effects: [
            confidence(-3, '가용 풀이 공표치보다 작음'),
            bankFx.setDampener(0.9, '검증 가능한 풀 공개'),
            flag('pool_disclosed_honestly'),
          ],
          expert: {
            rating: 70,
            rationale:
              '검증 가능한 수치만 신뢰를 만든다(BCBS 144 원칙 11 커뮤니케이션). 작은 숫자의 비용은 −3이지만, 목요일에 모순이 드러나는 비용(−10과 증폭)보다 싸다.',
            sourceRefs: [S.bcbs, S.val],
          },
          consequences:
            '공개 자료에 가용/담보 예치 구분이 들어갔습니다. 애널리스트 몇 명이 "왜 이제야"라고 물었습니다.',
          feasibility: { basis: '공시·IR 자료로 당일 실행 가능', sourceRefs: [S.k8] },
        },
        {
          id: 't0-e',
          label: '상업용 부동산 SpinCo(REI Global) 분리 계획 설계 착수',
          description:
            '$25~30B 상업용 부동산을 별도 회사로 떼어내는 구조를 설계한다. 자본 배분·자금조달이 필요하며 종결은 2009년 1분기다. 오늘 현금은 늘지 않는다.',
          effects: [flag('spinco_planned')],
          expert: {
            rating: 40,
            rationale:
              '방향은 옳지만 시계가 틀렸다. 분기 뒤의 스핀오프는 이번 주 레포 롤오버를 바꾸지 못한다. 다만 주말 컨소시엄 협상에서 bad-bank 구조의 뼈대가 된다.',
            historicalNote: '리먼은 9/10 REI Global 스핀오프(2009 1분기)를 발표했다.',
            sourceRefs: [S.k8, S.fcic],
          },
          consequences: 'SpinCo 구조 설계가 시작되었습니다. 자문사가 주말까지 텀시트를 준비합니다.',
          historical: true,
          feasibility: { basis: '8-K 9/10 발표된 실제 계획', sourceRefs: [S.k8] },
        },
        {
          id: 't0-f',
          label: '산업은행(KDB)에 가격 인하 재제안',
          description:
            '지분 25%를 더 낮은 가격에 다시 제안한다. 한국 감독당국의 반대가 알려져 있어 기대는 낮다.',
          effects: [flag('kdb_reopened')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '산업은행 최종 거부 보도 → 신뢰지수 −3',
              effects: [confidence(-3, 'KDB 최종 거부')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '이미 공개적으로 결렬된 협상의 재개는 절박함의 신호가 된다. 시간을 쓰는 동안 담보 준비가 늦어진다.',
            sourceRefs: [S.pressKdb, S.fcic],
          },
          consequences: '산업은행에 수정 제안을 보냈습니다. 답은 내일 아침에 옵니다.',
          feasibility: {
            basis: '협상 채널은 존재; 한국 감독당국 반대 공개',
            sourceRefs: [S.pressKdb],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "유동성 풀"과 "PDCF 적격 담보 여력"을 보세요. 풀 $42B 중 $7.5B는 이미 청산은행에 잡혀 있고, PDCF 여력은 0입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: 'CFP 원칙: 조치는 "즉시 가용"해야 하고, 커뮤니케이션은 "검증 가능한 수치"여야 합니다. 팔 수 있는 자산은 사려는 사람이 있을 때 팝니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: 'B(PDCF 사전 예치)는 목요일의 모든 선택지를 살립니다. C(확정 매각)는 목요일에 현금이 됩니다. A는 함정입니다.',
    },
  ],
  relatedCards: ['tri-party-repo-run', 'contingency-funding-plan'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2008-09-10 (수) "실적 선공개"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2008년 9월 10일 (수) 07:30 ET',
  title: '실적 선공개',
  time: '2008-09-10T07:30:00-04:00',
  entryEffects: [
    {
      id: 't1-rating',
      description: 'S&P CreditWatch 부정적(9/9 저녁)·무디스 검토 → 신뢰지수 −5',
      effects: [confidence(-5, '등급 검토')],
    },
    { id: 't1-stock', description: '주가 −7% (9/10 실제)', effects: [ownStockMove(-0.07, '9/10')] },
    {
      id: 't1-runoff',
      description: '9/10 자금 유출(PB 잔고·파생 담보·CP 만기)',
      effects: [bankFx.runoffStep({ windowFraction: 1, label: '9/10 유출' })],
    },
  ],
  events: [
    {
      id: 't1-news-kdb-fsc',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '06:30',
      headline: '한국 금융위원장 "산업은행의 메리디언 인수는 부적절" — 협상 재개 가능성 일축',
      body: '한국 금융당국이 국책은행의 미국 투자은행 인수에 공개적으로 반대하면서 산업은행 카드는 사실상 사라졌다.',
      severity: 'warning',
      sourceRefs: [S.pressKdb],
    },
    {
      id: 't1-memo-draft',
      kind: 'memo',
      time: '06:45',
      from: 'CFO',
      to: 'CEO · Treasurer',
      subject: '3분기 실적 선공개 초안 (07:30 발표 예정)',
      body: `- 순손실 **$3.9B**(총 평가손 $7.8B, 헤지·부채평가이익 후 순 $5.6B).
- 상업용 부동산 $39.8B → $32.6B, 주택 $17.2B → $13.2B(pro forma).
- 순레버리지 10.6x, Tier 1 ≈11.0%, 주주지분 $28.4B.
- 발표 문안 선택지: SpinCo·자산운용 지분 매각 "계획", 또는 확정 계약 동반, 또는 정기 발표(9/18)까지 대기.
- 배당 $0.05로 삭감.`,
      severity: 'critical',
      sourceRefs: [S.k8],
      cardRefs: ['capital-raise-sequencing'],
    },
    {
      id: 't1-memo-nb-signed',
      kind: 'memo',
      when: { flag: 'nb_sale_signed' },
      time: '07:00',
      from: '자문사',
      to: 'CEO · CFO',
      subject: '자산운용 자회사 확정 매각 계약 — 서명 완료',
      body: '매수자 확정 계약이 서명되었습니다. 종결 대금 $7B는 내일 입금됩니다. 오늘 발표에 "확정 계약"으로 포함할 수 있습니다.',
      severity: 'positive',
      sourceRefs: [S.pressNb],
    },
    {
      id: 't1-memo-pb',
      kind: 'memo',
      time: '10:30',
      from: 'PB 데스크',
      to: 'Treasurer',
      subject: '헤지펀드 잔고 이전·노베이션 요청',
      body: `- 어제 오후부터 헤지펀드 고객 30여 곳이 프리크레딧 잔고 이전과 OTC 포지션 노베이션(타 딜러로 이관)을 요청.
- 요청 처리 지연 여부를 고객·경쟁사가 지켜보고 있음. 3월 베어스턴스에서 "이전이 늦어진다"는 소문이 이탈을 가속했음.
- 오늘 유출 규모는 대시보드 참조.`,
      severity: 'warning',
      sourceRefs: [S.fcic, S.cox],
      cardRefs: ['bank-run-dynamics'],
      relatedMetrics: ['dailyOutflow', 'cash'],
    },
    {
      id: 't1-call-moodys',
      kind: 'call',
      time: '15:00',
      caller: '무디스 애널리스트',
      callee: 'CFO',
      tone: 'concerned',
      lines: [
        {
          speaker: '무디스',
          text: '등급을 검토 중입니다. 더 강한 파트너와의 전략적 거래가 없으면 강등이 불가피합니다.',
        },
        { speaker: 'CFO', text: '여러 대안을 병행하고 있습니다. 주 후반에 다시 설명드리겠습니다.' },
      ],
      severity: 'warning',
      sourceRefs: [S.fcic],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '실적 선공개 방식',
      prompt: '오늘 아침 무엇을 어떻게 발표하시겠습니까?',
      context: '손실은 이미 발생했습니다. 문제는 손실과 함께 무엇이 "확정"되어 있느냐입니다.',
      requiredConcepts: ['capital-raise-sequencing', 'crisis-communication'],
      dimensions: ['communication', 'solvency', 'timeliness'],
      options: [
        {
          id: 't1-a',
          label: '손실 $3.9B 선공개 + SpinCo·자산운용 지분 매각 "계획" 발표(확정 거래 없음)',
          description:
            '실적을 일주일 앞당겨 발표하고 구조조정 계획을 함께 낸다. 확정된 거래는 하나도 없다. 실행 가능: 8-K 당일 공시.',
          effects: [flag('loss_disclosed'), confidence(-15, '손실 공개 + 미확정 구조조정 계획')],
          expert: {
            rating: 30,
            rationale:
              '연준·FCIC 사후평가: 확정 거래 없는 계획 발표는 시장에 "손실은 확정, 해법은 미정"으로 읽혔다. 9/11 주가 −42%, 레포 카운터파티 이탈이 뒤따랐다. 보정: 손실 공개 + 미백스톱 −25의 IB 변형 −15(자본 조달이 아닌 매각 계획).',
            historicalNote: '리먼의 실제 9/10 8-K.',
            sourceRefs: [S.k8, S.fcic],
          },
          consequences:
            '07:30 보도자료가 나갔습니다. 컨퍼런스콜에서 애널리스트들이 "확정된 거래가 있느냐"고 반복해 물었습니다.',
          historical: true,
          feasibility: { basis: '8-K 9/10 실제 구조', sourceRefs: [S.k8] },
        },
        {
          id: 't1-b',
          label: '손실 선공개 + 자산운용 자회사 확정 매각 계약 동시 발표(자금 확정)',
          description:
            '손실과 함께 "내일 $7B가 들어온다"는 확정 계약을 발표한다. 시장은 손실보다 확정된 현금을 본다.',
          requires: { flag: 'nb_sale_signed' },
          unavailableReason: '확정 매각 계약이 없습니다 (T0에서 협상을 개시하지 않음).',
          effects: [
            flag('loss_disclosed'),
            flag('funded_deal_announced'),
            confidence(-8, '손실 공개(확정 매각 동반)'),
            bankFx.setDampener(0.85, '확정 거래 동반 공시'),
          ],
          expert: {
            rating: 75,
            rationale:
              '손실 공개는 자금이 확정된 뒤에(증자 순서 원칙). CS 2022.10, 그리고 리먼이 하지 못한 것. 캐비앳: 현금 $7B는 이번 주 유출의 일부만 덮는다.',
            sourceRefs: [S.k8nb, S.bcbs],
          },
          consequences:
            '손실과 확정 매각이 함께 공시되었습니다. 애널리스트 반응은 "부족하지만 구체적"이었습니다.',
          feasibility: { basis: 'T0.C 확정 계약 전제', sourceRefs: [S.pressNb] },
        },
        {
          id: 't1-c',
          label: '정기 실적 발표(9/18)까지 침묵 — 소문 방치',
          description: '아무것도 발표하지 않는다. 정보 공백은 시장의 추측으로 채워진다.',
          effects: [
            flag('silence'),
            confidence(-10, '정보 공백'),
            bankFx.addAmplifier(1.2, '정보 공백'),
          ],
          expert: {
            rating: 15,
            rationale:
              '주가 −45% 다음 날의 침묵은 최악의 해석을 부른다(증폭 규칙: 정보 공백 ×1.2). 등급사도 기다려주지 않는다.',
            sourceRefs: [S.fcic, S.bcbs],
          },
          consequences:
            '발표하지 않았습니다. 트레이딩 데스크마다 "다음 주에 더 나쁜 숫자가 나온다"는 소문이 돕니다.',
          feasibility: { basis: '공시 의무는 9/18 정기 발표로 충족 가능' },
        },
        {
          id: 't1-d',
          label: '손실 선공개 + "유동성 풀 충분, 연준 창구 사용 불필요" 강조',
          description:
            '창구 낙인을 피하려 "우리는 PDCF가 필요 없다"고 못 박는다. 목요일에 창구를 쓰게 되면 말과 행동이 모순된다.',
          effects: [flag('loss_disclosed'), flag('stigma_stance'), confidence(-12, '손실 공개')],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { path: 'institution.cash', lt: 30 },
              description:
                '목요일 풀 급감 뒤 "창구 불필요" 발언이 모순으로 드러남 → 금요일 유출 증폭 ×1.3, 신뢰지수 −8',
              effects: [
                bankFx.addAmplifier(1.3, '창구 불필요 발언 모순'),
                confidence(-8, '발언 모순'),
              ],
            },
          ],
          expert: {
            rating: 10,
            rationale:
              '베어스턴스도 3/10 "유동성 문제 없다"고 했다(SEC Cox 서한: 3/10 $18.1B → 3/13 급감). 낙인을 피하려는 발언은 창구를 써야 할 때 창구를 못 쓰게 만든다.',
            sourceRefs: [S.cox, S.fcic],
          },
          consequences: '보도자료에 "중앙은행 창구 사용 계획 없음"이 들어갔습니다.',
          trap: true,
          trapExplanation:
            '창구 낙인(stigma)을 피하려는 발언은 자기 손을 묶는다. 위기에서 창구는 낙인이 아니라 생존 수단이며, 준비된 담보로 조용히 쓰는 것이 정답이다.',
          remediationCard: 'discount-window-fhlb-btfp',
        },
      ],
    },
    {
      id: 't1-d2',
      title: 'PB 고객 자산 이전 요청 처리',
      prompt: '헤지펀드 고객의 잔고 이전·노베이션 요청을 어떻게 처리하시겠습니까?',
      context: '요청은 실시간으로 결제됩니다. 이전 지연은 즉시 시장에 알려집니다.',
      requiredConcepts: ['bank-run-dynamics'],
      dimensions: ['compliance', 'communication'],
      options: [
        {
          id: 't1-d2-a',
          label: '이전 요청 즉시 전액 처리 — 정시 결제 유지',
          description:
            '고객 자산은 고객 것이다. 유출은 발생하지만 "정시에 나간다"는 사실이 남은 고객을 붙잡는다.',
          effects: [flag('pb_prompt'), confidence(2, 'PB 이전 정시 처리')],
          expert: {
            rating: 80,
            rationale:
              'SEC 고객보호규칙(15c3-3) 준수이자 유일하게 검증 가능한 메시지. 베어스턴스에서 "이전이 막힌다"는 소문이 런을 가속했다(FCIC ch.15).',
            historicalNote:
              '리먼 뉴욕 브로커딜러는 파산 전까지 이전을 처리했다. 런던(LBIE)의 고객 자산 문제는 파산 후 발생했다.',
            sourceRefs: [S.fcic, S.cox],
          },
          consequences:
            '이전 요청이 정시에 처리되었습니다. PB 데스크는 "적어도 소문은 없다"고 보고합니다.',
          historical: true,
          feasibility: { basis: '결제 인프라 정상 작동', sourceRefs: [S.fcic] },
        },
        {
          id: 't1-d2-b',
          label: '대형 이전 요청을 "운영 점검"으로 1~2일 지연',
          description: '시간을 벌기 위해 대형 요청을 늦춘다. 고객보호규칙 위반이며 즉시 알려진다.',
          effects: [
            flag('unsafe_act'),
            regulator({ set: 3 }, '고객 자산 이전 지연(불건전 행위)'),
            bankFx.addAmplifier(1.5, '이전 지연 가시화', { networked: true }),
            confidence(-20, '지급 지연 가시화'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: 'SEC·FINRA, 고객보호규칙 위반 확인 → 즉시 조치(R4)',
              effects: [regulator({ set: 4 }, 'SEC 고객보호규칙 위반')],
            },
          ],
          expert: {
            rating: 0,
            rationale:
              '고객 자산 이전 지연은 15c3-3 위반이자 런의 확증이다(보정: 지급 지연 가시화 ΔCI −20, 증폭 ×1.5, S3 전이). 어떤 사후평가도 이 선택을 허용하지 않는다.',
            sourceRefs: [S.fcic, S.cox],
          },
          consequences:
            '지연이 감지되었습니다. 경쟁 PB들이 "메리디언에서 자산이 안 나온다"고 고객에게 알리고 있습니다.',
          trap: true,
          trapExplanation:
            '시간을 벌려는 시도는 PB 사업의 존립 근거(고객 자산의 즉시 이전 가능성)를 스스로 부정한다. 하루 뒤 감독당국이 문을 닫는다.',
          illegal: true,
          irreversible: true,
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't1-d2-c',
          label: '이전은 처리하되 잔존 고객에 마진·수수료 인하 제시',
          description: '가격으로 고객을 붙잡는다. 런 상태에서는 효과가 미미하다.',
          effects: [flag('pb_prompt'), bankFx.setDampener(0.97, 'PB 조건 완화')],
          expert: {
            rating: 35,
            rationale: '지급능력 우려로 시작된 이탈은 가격으로 멈추지 않는다. 처리 자체는 옳다.',
            sourceRefs: [S.fcic],
          },
          consequences: '이전은 정시 처리되었고 조건 인하 안내가 나갔습니다. 반응은 미미합니다.',
          feasibility: { basis: 'PB 계약 조건 변경은 당일 가능' },
        },
        {
          id: 't1-d2-d',
          label: '고객 자산 재담보(rehypothecation) 확대로 $3B 조달',
          description:
            '고객이 맡긴 증권을 더 많이 재담보로 돌려 현금을 만든다. 합법 범위 내지만 파산 시 고객 자산이 묶인다.',
          effects: [
            flag('rehypo_expanded'),
            ibFx.fundingInflow({ amount: 3, label: '고객 증권 재담보 조달' }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '재담보 확대가 헤지펀드에 알려짐 → PB 네트워크 증폭 ×1.3, 신뢰지수 −5',
              effects: [
                bankFx.addAmplifier(1.3, '재담보 확대 소문', { networked: true }),
                confidence(-5, '재담보 확대 소문'),
              ],
            },
          ],
          expert: {
            rating: 10,
            rationale:
              '리먼 런던 법인(LBIE)의 재담보 관행은 파산 후 고객 자산 동결의 원인이 되었고 헤지펀드의 PB 분산을 촉발했다(FDIC 2011). 오늘의 $3B가 내일의 이탈을 만든다.',
            sourceRefs: [S.fdic, S.fcic],
          },
          consequences: '재담보로 $3B가 들어왔습니다. PB 데스크는 고객 문의가 늘었다고 보고합니다.',
          trap: true,
          trapExplanation:
            '고객 자산으로 자기 조달을 늘리는 것은 런의 연료다. 헤지펀드는 "내 자산이 파산 재단에 묶일 수 있다"는 신호에 가장 빨리 반응한다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '발표에 "확정된 것"이 있습니까? 손실만 확정이고 해법은 계획이라면 시장은 최악을 가정합니다.',
    },
    {
      level: 3,
      decisionId: 't1-d1',
      text: '확정 계약이 있다면 B. 없다면 A가 그나마 정직하고, C·D는 더 나쁩니다.',
    },
    {
      level: 2,
      decisionId: 't1-d2',
      text: 'PB 잔고 이전은 유출이지만, "정시에 나간다"는 사실은 유일하게 검증 가능한 안심 메시지입니다. 지연은 R4 사유입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2008-09-11 (목) "레포 롤오버 거부"
// ---------------------------------------------------------------------------------------------
/**
 * 09:30 개장 직후 프라임브로커리지 최대 고객의 잔고 이전 통지. 합성 기관의 고객이므로 실존 인물의
 * 발언이 아니며, 내용은 헤지펀드 잔고 이전·노베이션 요청이 9/10~12에 급증했다는 공개 기록
 * (FCIC ch.15, Valukas)을 1인칭 통화로 각색한 **재구성**이다(calibration.md §7.4).
 */
const t2PrimeBrokerCall: Interrupt<BankState> = {
  id: 't2-i1-pb',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't2-i1-asis',
  scoreWeight: 0.5,
  required: false,
  title: '프라임브로커리지 고객 통화 — 잔고 이전 통지',
  prompt: '$3B 규모 프리크레딧 잔고 이전 요청에 어떻게 답하시겠습니까?',
  context: 'PB 고객은 서로 통화합니다. 한 곳의 처리 속도가 나머지 전부의 이전 시점을 결정합니다.',
  source: { kind: 'call', caller: '헤지펀드 COO', agency: '프라임브로커리지 고객', tone: 'urgent' },
  lines: [
    {
      speaker: '헤지펀드 COO',
      text: '오늘 프리크레딧 잔고 전액을 다른 프라임브로커로 옮기겠습니다. 오늘 안에 처리됩니까?',
    },
  ],
  dimensions: ['liquidity', 'compliance', 'communication'],
  cardRefs: ['tri-party-repo-run'],
  options: [
    {
      id: 't2-i1-priority',
      label: '정시 전량 처리 + 노베이션 전담 인력 배치',
      description:
        '이전 요청과 OTC 노베이션을 전담팀이 당일 처리하고 처리 현황을 고객에게 공유한다. 현금은 그대로 나가지만 "막힌다"는 소문이 생기지 않는다.',
      effects: [flag('pb_priority'), counter('pbSupport', 1)],
      expert: {
        rating: 75,
        rationale:
          'PB 잔고는 고객 자산이다. 이전을 늦추는 것은 유동성을 버는 것이 아니라 감독상 즉시 조치의 사유를 만드는 것이며, 네트워크로 연결된 고객은 지연을 수 분 안에 공유한다. 리먼 런던 법인의 고객 자산 동결은 파산의 가장 큰 2차 피해였다.',
        sourceRefs: [S.fdic, S.fcic],
      },
      preview: [
        { metric: 'cash', direction: 'down', magnitude: 1, note: '유출은 그대로, 확산은 억제' },
      ],
      consequences: '전담팀이 배치되어 이전이 정시 처리되었습니다.',
    },
    {
      id: 't2-i1-asis',
      label: '접수 순서대로 처리',
      description: '별도 지시 없이 평시 절차로 처리한다.',
      effects: [counter('callsDeferred', 1)],
      expert: {
        rating: 40,
        rationale:
          '위법도 지연도 아니다. 9/11 리먼의 실제 상태였고, 이전은 그대로 일어났다. 보정 노트: S2/S3 기본 유출률이 이미 PB 이탈을 내재하므로 이 경로에는 증폭기를 추가로 곱하지 않는다(calibration.md §1.3).',
        sourceRefs: [S.fcic, S.val],
      },
      preview: [
        { metric: 'cash', direction: 'down', magnitude: 1, note: '기본 유출률에 이미 반영' },
      ],
      consequences: '이전 요청이 접수 순서대로 처리되었습니다.',
      historical: true,
    },
    {
      id: 't2-i1-slow',
      label: '대형 계좌 이전은 내일 처리하겠다고 답변',
      description:
        '가장 큰 계좌의 이전을 하루 미뤄 오늘 유출을 줄인다. 고객은 즉시 다른 고객들에게 알린다.',
      effects: [
        bankFx.addAmplifier(1.5, 'PB 이전 지연(네트워크 확산)', { networked: true }),
        regulator({ add: 1 }, '고객 자산 이전 지연'),
        flag('pb_delayed'),
      ],
      expert: {
        rating: 0,
        rationale:
          '고객 자산 이전 지연은 유동성 조달 수단이 아니라 고객보호규칙 위반의 입구다. 남은 슬라이스의 유출이 네트워크 증폭 ×1.5로 계산되고 감독 단계가 오른다(calibration.md §2의 "PB 이전 지연 −20, 증폭 ×1.5").',
        sourceRefs: [S.fdic, S.fcic],
      },
      preview: [{ metric: 'cash', direction: 'down', magnitude: 3 }],
      consequences: '고객이 "처리를 거부당했다"고 다른 고객들에게 알렸습니다.',
      trap: true,
      trapExplanation:
        '하루를 버는 대신 남은 하루의 유출을 키운다. 고객 자산은 회사의 유동성이 아니며, 지연은 감독당국에 즉시 보이는 사건이다.',
      irreversible: true,
    },
  ],
}

/**
 * 15:00 청산은행 트라이파티 데스크의 마감 확인. JPM 실무 데스크와의 통화를 **재구성**한 것이며
 * 녹취가 아니다. 내용은 Valukas 보고서가 정리한 9/11 담보 요구·이행 경위에 근거한다.
 */
const t2ClearingDeskCall: Interrupt<BankState> = {
  id: 't2-i2-clearing',
  interrupt: true,
  atTick: 3,
  jitter: 0,
  timeoutSec: 30,
  defaultOptionId: 't2-i2-confirm',
  scoreWeight: 0.5,
  required: false,
  title: '청산은행 트라이파티 데스크 — 마감 확인',
  prompt: '마감 전 담보 이체 확인 요청에 어떻게 답하시겠습니까?',
  source: { kind: 'desk', caller: '트라이파티 데스크', agency: 'JPMorgan Chase', tone: 'urgent' },
  lines: [
    {
      speaker: '트라이파티 데스크',
      text: '마감까지 한 시간입니다. 오늘 이체가 확인되지 않으면 내일 아침 언와인드를 실행할 수 없습니다.',
    },
  ],
  dimensions: ['liquidity', 'compliance'],
  cardRefs: ['tri-party-repo-run'],
  options: [
    {
      id: 't2-i2-escalate',
      label: '상위 책임자와 통화해 내일 언와인드 조건을 문서로 확인',
      description:
        '실무 데스크가 아니라 결정 권한이 있는 상대와 통화해, 오늘 이체가 확인되면 내일 아침 언와인드를 실행한다는 조건을 문서로 받는다.',
      effects: [flag('unwind_terms_documented'), counter('clearingContacts', 1)],
      expert: {
        rating: 75,
        rationale:
          '청산은행은 심판이 아니라 일중 대출자이며, 일중 신용 제공은 재량이다. 조건을 문서로 고정해 두는 것이 다음 날 아침의 유일한 보장이다(NY Fed EPR 2012의 트라이파티 개혁 논점).',
        sourceRefs: [S.epr, S.val],
      },
      preview: [
        { metric: 'cash', direction: 'flat', magnitude: 1, note: '현금 변화 없음, 조건만 확정' },
      ],
      consequences: '언와인드 조건을 서면으로 확인받았습니다.',
    },
    {
      id: 't2-i2-confirm',
      label: '이체 예정을 구두로 확인하고 회신',
      description: '오늘 이체가 진행 중임을 알리고 통화를 끝낸다.',
      effects: [counter('callsDeferred', 1)],
      expert: {
        rating: 50,
        rationale:
          '필요한 답이고 리먼이 실제로 한 답이다. 다만 구두 확인은 다음 날 아침의 재량을 묶지 못한다.',
        sourceRefs: [S.val],
      },
      preview: [{ metric: 'cash', direction: 'flat', magnitude: 1 }],
      consequences: '데스크가 이체 예정을 접수했습니다.',
      historical: true,
    },
    {
      id: 't2-i2-securities',
      label: '현금 대신 인벤토리 증권으로 대체하겠다고 제안',
      description:
        '현금을 아끼려 보유 증권을 담보로 제시한다. 청산은행은 자체 헤어컷으로 다시 평가한다.',
      effects: [flag('collateral_quality_disputed'), counter('clearingContacts', 1)],
      expert: {
        rating: 15,
        rationale:
          '청산은행은 시장보다 보수적으로 평가하고, 그 차이는 결국 현금으로 메워야 한다(CGFS 36의 헤어컷 스파이럴). 리먼이 JPM에 제공한 담보 중 일부는 이후 가치 논쟁의 대상이 되었다(Valukas).',
        sourceRefs: [S.cgfs, S.val],
      },
      preview: [
        { metric: 'cash', direction: 'down', magnitude: 2, note: '헤어컷 차액은 내일 현금으로' },
      ],
      consequences: '데스크가 "품질을 검토한 뒤 부족분을 다시 요청하겠다"고 답했습니다.',
      trap: true,
      trapExplanation:
        '현금을 아끼려 비유동 담보를 주면 헤어컷 스파이럴이 시작된다. 담보의 가치는 보유자가 아니라 청산은행이 정한다.',
    },
  ],
}

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2008년 9월 11일 (목) 07:00~16:00 ET',
  title: '레포 롤오버 거부',
  time: '2008-09-11T07:00:00-04:00',
  ticks: 5,
  tickLabels: ['07:00', '09:30', '11:00', '15:00', '16:00'],
  entryEffects: [
    {
      id: 't2-anchor',
      description: 'TED 스프레드를 9/10 종가 1.20%로 맞춘다 (티커가 9/11 종가 1.24%까지 걷는다)',
      effects: [op('market.custom.tedBp', 'set', 120, 'TED 9/10 종가 1.20%')],
    },
    {
      id: 't2-stock',
      description: '프리마켓 갭 −20% (9/11 종가 −42% 중 갭 부분; 개장 후 하락은 티커가 이어받는다)',
      effects: [ownStockMove(-0.2, '9/11 프리마켓 갭')],
    },
  ],
  eachTick: [
    {
      id: 't2-runoff-tick',
      description: '9/11 자금 유출(PB 잔고·파생 담보·CP 만기) — 뉴욕 영업일 전방 집중 분포',
      effects: [
        bankFx.runoffStep({ windowFraction: 1, profile: NY_DAY_PROFILE, label: '9/11 유출' }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't2-repo-refusal',
      atTick: 0,
      description:
        '07:00 트라이파티 언와인드 — CMBS·비투자등급 담보 레포 카운터파티 20% 롤오버 거부 → 현금 반환',
      effects: [
        ibFx.repoRollOff({
          book: 'repoOther',
          fraction: 0.2,
          label: '레포 롤오버 거부(비유동 담보)',
        }),
      ],
    },
    // ΔCI 세 건은 모두 **마지막 틱**에 건다. 유출 슬라이스가 매 틱 CI를 실시간으로 읽으므로,
    // 중간 틱에 걸면 런 상태 경계(S2 30~49 / S3 <30)를 넘어 남은 슬라이스가 다시 계산된다.
    // 전환 전 모델에서도 ΔCI는 그날의 유출이 모두 끝난 뒤에 적용되었다(calibration.md §7.1).
    {
      id: 't2-visible',
      atTick: 4,
      when: {
        fn: (ctx) => (ctx.counters.cumulativeOutflow ?? 0) / START_RUNNABLE > 0.1,
        label: '누적 자금 유출 > 도주성 조달의 10%',
      },
      description: '가시적 유출(>10%)이 시장에 알려짐 → 신뢰지수 −10',
      effects: [confidence(-10, '가시적 대규모 유출')],
    },
    {
      id: 't2-pool-contradiction',
      atTick: 4,
      when: {
        all: [
          { flag: 'pool_overstated' },
          {
            fn: (ctx) =>
              (ctx.path('institution.cash') ?? 0) < 0.65 * (ctx.counters.statedPool ?? 42),
            label: '실제 풀 < 공표 풀의 65%',
          },
        ],
      },
      description: '공표한 "$42B 충분"과 실제 가용 풀이 모순 → 신뢰지수 −10',
      effects: [confidence(-10, '유동성 풀 공표 모순 노출'), flag('pool_contradicted')],
    },
    {
      id: 't2-rating-warning',
      atTick: 4,
      description: '무디스 "전략적 거래 없으면 강등" 공개 경고 → 신뢰지수 −3',
      effects: [confidence(-3, '강등 경고')],
    },
  ],
  ticker: {
    series: [
      // 프리마켓 갭(0.80) × 장중 티커(0.725) = 0.58 → 9/11 종가 −42% [press-kdb-2008-09-09]
      { path: 'market.ownStock', mode: 'relative', values: [100, 90, 84, 78, 72.5] },
      // TED: 9/10 종가 1.20% → 9/11 종가 1.24% [fred-tedrate-2008]
      { path: 'market.custom.tedBp', mode: 'absolute', values: [120, 121, 122, 123, 124] },
      // 5년 CDS 475bp → ≈700bp [VERIFY — facts.ts 주석의 해소 문서: FCIC 자료실 Markit 계열]
      { path: 'market.ownCdsBp', mode: 'absolute', values: [475, 560, 620, 670, 700] },
    ],
  },
  interrupts: [t2PrimeBrokerCall, t2ClearingDeskCall],
  events: [
    {
      id: 't2-market',
      kind: 'market',
      atTick: 1,
      time: '09:30',
      headline: '개장 시세',
      items: [
        { label: 'MB 주가', value: '대시보드 참조', change: '−42%' },
        { label: 'MB 5y CDS', value: '≈700bp+', change: '급등' },
        { label: '트라이파티 레포 롤오버율', value: '{{metric:repoRollRate}}', change: '' },
      ],
      sourceRefs: [S.pressKdb, S.sr506],
    },
    {
      id: 't2-news-repo',
      kind: 'newswire',
      outlet: 'Reuters',
      atTick: 0,
      time: '08:20',
      headline: 'MMF·증권대여 기관, 메리디언 레포 익스포저 축소 — "비유동 담보는 받지 않는다"',
      body: '복수의 머니마켓펀드와 증권대여 대리인이 메리디언과의 익일물 레포를 줄이거나 국채 담보만 받겠다고 통보한 것으로 알려졌다. 헤지펀드들은 프라임브로커 잔고를 경쟁사로 옮기고 있다.',
      severity: 'critical',
      sourceRefs: [S.sr506, S.fcic],
      cardRefs: ['tri-party-repo-run'],
    },
    {
      id: 't2-call-jpm-call',
      kind: 'call',
      atTick: 2,
      time: '10:00',
      caller: 'JPM 청산은행',
      callee: 'Treasurer',
      agency: 'JPMorgan Chase (트라이파티 청산은행)',
      tone: 'urgent',
      lines: [
        {
          speaker: 'JPM',
          text: '오늘 마감 전까지 **추가 담보 $5B**를 현금 또는 국채로 예치해 주십시오. 귀사 트라이파티 담보의 가치평가 하락과 일중 신용 익스포저 때문입니다.',
        },
        { speaker: 'Treasurer', text: '내일 아침 언와인드는 정상적으로 진행됩니까?' },
        {
          speaker: 'JPM',
          text: '담보가 들어오면 그렇습니다. 들어오지 않으면 우리는 내일 아침 언와인드를 할 수 없습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.val, S.epr],
      cardRefs: ['tri-party-repo-run'],
      relatedMetrics: ['cash', 'facilityHeadroom'],
    },
    {
      id: 't2-memo-pool-gap',
      kind: 'memo',
      when: { flag: 'pool_contradicted' },
      atTick: 4,
      time: '16:20',
      from: 'IR',
      to: 'CEO · Treasurer',
      subject: '"$42B" 질문 쇄도',
      body: '애널리스트와 카운터파티가 "어제 $42B라더니 왜 담보를 못 내느냐"고 묻고 있습니다. 담보 예치분을 뺀 가용 금액을 묻는 전화가 계속됩니다.',
      severity: 'critical',
      sourceRefs: [S.val],
    },
    {
      id: 't2-news-buyers',
      kind: 'newswire',
      outlet: 'WSJ',
      atTick: 4,
      time: '16:30',
      headline: '메리디언, 회사 전체 매각 타진 — 뱅크오브아메리카 등과 접촉 보도',
      body: '재무부·뉴욕연준이 인수 후보를 물색하고 있으며 BofA가 실사에 착수했다는 보도가 나왔다. 정부는 "공적 자금 투입은 없다"는 입장을 비공식적으로 전하고 있다.',
      severity: 'warning',
      sourceRefs: [S.fcic],
      reliability: 'unconfirmed',
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '청산은행 추가 담보 요구 $5B',
      prompt: 'JPM의 $5B 추가 담보 요구에 어떻게 대응하시겠습니까?',
      context:
        '청산은행이 내일 아침 언와인드를 거부하면 트라이파티 레포 전체가 결제되지 않습니다. 이것이 증권사 실패의 실제 메커니즘입니다.',
      requiredConcepts: ['tri-party-repo-run'],
      dimensions: ['liquidity', 'compliance'],
      timeLimitSec: 120,
      // 청산은행의 요구는 10:00(틱 2)에 도착하고 마감(틱 3, 15:00) 안에 이체되어야 한다.
      // 틱 4(16:00)를 마감으로 두면 스윕이 그 뒤에 돌아 자동 확정이 일어나지 않는다.
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't2-a',
      options: [
        {
          id: 't2-a',
          label: '요구대로 현금·국채 $5B를 유동성 풀에서 예치',
          description:
            '풀에서 $5B가 빠져 청산은행 담보로 잡힌다. 언와인드는 유지된다. 실행 가능: 당일 이체.',
          effects: [
            ibFx.clearingBankCollateralCall({ amount: 5, label: 'JPM 담보 $5B 예치' }),
            flag('jpm_call_met'),
          ],
          expert: {
            rating: 50,
            rationale:
              '언와인드를 지키는 유일한 즉시 수단이지만, 풀에서 현금이 빠지고 그 현금은 다시 "가용"이 아니다. 리먼은 이렇게 예치했고 풀은 금요일에 <$2B가 되었다(Valukas).',
            historicalNote: '리먼은 9/11~12 JPM 요구를 이행했다.',
            sourceRefs: [S.val, S.fcic],
          },
          consequences: '$5B가 JPM 담보 계정으로 이체되었습니다. 유동성 풀이 그만큼 줄었습니다.',
          historical: true,
          feasibility: { basis: '당일 이체 가능', sourceRefs: [S.val] },
        },
        {
          id: 't2-b',
          label: '요구 거부 — 담보 충분하다며 협상으로 시간 확보',
          description:
            '청산은행과 다툰다. 청산은행은 내일 아침 언와인드를 거부할 수 있고, 그 순간 결제 불능이다.',
          effects: [flag('clearing_bank_refused'), regulator({ add: 1 }, '청산은행 분쟁')],
          expert: {
            rating: 5,
            rationale:
              '트라이파티 청산은행은 매일 아침 딜러에게 일중 신용을 주고 담보를 되돌려준다. 이를 거부하면 딜러는 당일 결제를 할 수 없다(NY Fed EPR 2012; FCIC ch.15/18). 청산은행과의 분쟁은 곧 결제 불능이다.',
            sourceRefs: [S.epr, S.fcic],
          },
          consequences: 'JPM이 "내일 아침 언와인드를 보장할 수 없다"고 통보했습니다.',
          trap: true,
          trapExplanation:
            '"담보는 충분하다"는 주장이 옳더라도 청산은행이 동의하지 않으면 의미가 없다. 청산은행은 심판이 아니라 일중 대출자이며, 대출자는 언제든 대출을 멈출 수 있다.',
          irreversible: true,
          remediationCard: 'tri-party-repo-run',
        },
        {
          id: 't2-c',
          label: '브로커딜러가 PDCF 차입 $5B로 담보 요구 충당',
          description:
            '사전 예치된 PDCF 담보로 익일물 차입을 받아 청산은행에 예치한다. 풀은 그대로다.',
          requires: { metric: 'facilityHeadroom', gte: 5 },
          unavailableReason: 'PDCF 적격 담보 여력이 $5B 미만입니다 (T0에서 사전 예치하지 않음).',
          effects: [
            bankFx.drawFacility({ amount: 5, source: 'PDCF(브로커딜러)', rateBp: 225 }),
            ibFx.clearingBankCollateralCall({ amount: 5, label: 'JPM 담보 $5B 예치(PDCF 자금)' }),
            flag('jpm_call_met'),
            flag('pdcf_drawn'),
          ],
          expert: {
            rating: 80,
            rationale:
              'PDCF는 정확히 이 목적(프라이머리 딜러의 익일물 담보 조달)을 위해 3월에 만들어졌다. 준비된 담보가 있을 때만 열린다. 시스템 스트레스 중 창구 낙인은 부차적이다.',
            sourceRefs: [S.fed316, S.ball],
          },
          consequences:
            'PDCF 차입이 당일 결제되어 JPM에 예치되었습니다. 유동성 풀은 유지되었습니다.',
          feasibility: { basis: 'PDCF 익일물, 사전 예치 담보 한도 내', sourceRefs: [S.fed316] },
        },
        {
          id: 't2-d',
          label: 'CMBS 등 비유동 증권으로 $5B 담보 충당',
          description:
            '현금 대신 비유동 증권을 준다. 청산은행은 50% 헤어컷을 적용하고 부족분을 다시 요구한다.',
          effects: [
            ibFx.clearingBankCollateralCall({
              amount: 2.5,
              label: 'JPM, 비유동 담보 50% 헤어컷 → 현금 보충 2.5',
            }),
            flag('jpm_disputed'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                'JPM, 제공 담보 품질 불인정 — 2차 콜과 별도로 추가 현금 $5B 요구, 신뢰지수 −5',
              effects: [
                ibFx.clearingBankCollateralCall({
                  amount: 5,
                  label: 'JPM 담보 불인정 — 추가 현금 요구',
                }),
                confidence(-5, '청산은행 담보 분쟁 보도'),
              ],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '리먼이 JPM에 제공한 담보 중 일부(구조화 상품)는 이후 가치 논쟁의 대상이 되었다(Valukas). 비유동 담보는 헤어컷을 키워 더 많은 현금을 요구받는 스파이럴을 만든다(CGFS 36).',
            sourceRefs: [S.val, S.cgfs],
          },
          consequences:
            'JPM이 제공 담보에 50% 헤어컷을 적용하고 현금 보충을 요구했습니다. 내일 담보 불인정에 따른 추가 현금 요구가 예상됩니다.',
          trap: true,
          trapExplanation:
            '현금을 아끼려 비유동 담보를 주면 헤어컷 스파이럴이 시작된다. 청산은행은 시장보다 보수적으로 평가하고, 그 차이는 결국 현금으로 메워야 한다.',
        },
      ],
    },
    {
      id: 't2-d2',
      title: '레포 롤오버 거부 대응',
      prompt:
        'CMBS·비투자등급 담보 레포 카운터파티의 롤오버 거부에 어떻게 대응하시겠습니까? (최대 2개; A·B는 배타)',
      context: '비유동 담보 레포는 이미 20%가 빠졌습니다. 남은 $20B의 처리가 내일 풀을 결정합니다.',
      select: { min: 1, max: 2 },
      exclusive: [['t2-d2-a', 't2-d2-b']],
      requiredConcepts: ['tri-party-repo-run', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'marketRisk', 'communication'],
      // 레포 북의 처리는 07:00 언와인드 직후부터 열려 있고 마감(15:00)까지 결정해야 한다.
      availableFrom: 0,
      deadlineTick: 3,
      defaultOptionId: 't2-d2-a',
      timeLimitSec: 120,
      options: [
        {
          id: 't2-d2-a',
          label: '헤어컷 인상(+10pp) 수용하며 CMBS 담보 레포 롤오버 압박',
          description:
            '남은 카운터파티에 더 높은 헤어컷과 금리를 주고 CMBS 레포를 유지하려 한다. 인상분은 현금으로 메운다. 내일도 같은 요구가 온다.',
          effects: [
            ibFx.haircutShock({
              book: 'repoOther',
              deltaPct: 0.1,
              label: 'CMBS 레포 헤어컷 +10pp',
            }),
            flag('haircut_spiral'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '헤어컷 인상에도 카운터파티 추가 25% 롤오버 거부, 신뢰지수 −5',
              effects: [
                ibFx.repoRollOff({
                  book: 'repoOther',
                  fraction: 0.25,
                  label: '레포 추가 롤오버 거부',
                }),
                confidence(-5, '레포 축소 지속'),
              ],
            },
          ],
          expert: {
            rating: 15,
            rationale:
              '헤어컷 스파이럴(CGFS 36): 헤어컷을 받아들일수록 조달은 줄고 현금은 더 나간다. NY Fed(Copeland·Martin·Walker)는 2008.9 리먼의 트라이파티 조달이 헤어컷 조정이 아니라 조달 규모 자체의 급감으로 무너졌다고 보였다. 비유동 담보로는 롤오버를 살 수 없다.',
            historicalNote: '리먼은 주 후반까지 비유동 담보 레포 유지를 시도했다.',
            sourceRefs: [S.cgfs, S.sr506],
          },
          consequences:
            '일부 카운터파티가 하루 더 롤오버했습니다. 인상된 헤어컷만큼 현금이 빠졌고, 내일 재협상이 예정되어 있습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"조금만 더 주면 유지된다"는 유혹. 헤어컷은 카운터파티의 두려움의 가격이며, 두려움은 헤어컷으로 사라지지 않는다. 결과는 같은 롤오프에 현금만 더 쓴 것이다.',
          remediationCard: 'hqla-and-haircuts',
        },
        {
          id: 't2-d2-b',
          label: 'CMBS 레포 자발적 축소 — $5B 현금 상환, 잔여분 만기 연장 협상',
          description:
            '억지로 유지하지 않고 질서 있게 줄인다. 현금 $5B가 나가지만 헤어컷 스파이럴은 피한다.',
          effects: [
            ibFx.fundingOutflow({ amount: 5, book: 'repoOther', label: 'CMBS 레포 자발적 상환 5' }),
            flag('repo_paydown'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '잔여 CMBS 레포 25% 추가 롤오프',
              effects: [
                ibFx.repoRollOff({ book: 'repoOther', fraction: 0.25, label: '레포 추가 롤오프' }),
              ],
            },
          ],
          expert: {
            rating: 50,
            rationale:
              '비유동 담보 조달은 어차피 사라진다. 스스로 줄이면 현금 손실은 같아도 분쟁·소문은 준다.',
            sourceRefs: [S.sr506],
          },
          consequences: 'CMBS 레포 $5B를 상환했습니다. 카운터파티 반응은 "합리적"이었습니다.',
          feasibility: { basis: '레포 상환은 당일 결제' },
        },
        {
          id: 't2-d2-c',
          label: '카운터파티에 담보 목록·PDCF 접근 여력을 검증 가능하게 제시',
          description:
            '레포 카운터파티와 MMF에 담보 구성표와 브로커딜러 PDCF 여력을 보여준다. 여력이 있을 때만 작동하고, 없으면 부족을 확인시킨다.',
          effects: [
            ibFx.verifiableLiquidityDisclosure({
              share: 0.35,
              ciUp: 5,
              ciDown: 5,
              dampen: 0.85,
              amp: 1.2,
              label: '카운터파티 앞 검증 가능 공표',
            }),
          ],
          expert: {
            rating: 65,
            rationale:
              '커뮤니케이션은 검증 가능한 여력이 있을 때만 작동한다(완화 ×0.85; 모순 시 증폭). 가치는 T0의 준비에 달려 있다.',
            sourceRefs: [S.bcbs, S.sr506],
          },
          consequences:
            '담보 목록과 PDCF 여력이 카운터파티에 전달되었습니다. 반응은 여력의 크기에 따라 갈렸습니다(로그 참조).',
          feasibility: { basis: '카운터파티 앞 비공개 자료 제공은 당일 가능' },
        },
        {
          id: 't2-d2-d',
          label: '무담보 CP·은행 신용라인 확대 요청으로 대체 조달 시도',
          description:
            '담보 없는 조달을 늘려 레포 축소를 메우려 한다. 주가 −42%의 날에는 공급자가 없다.',
          effects: [flag('unsecured_asked'), confidence(-3, '무담보 조달 요청 거절')],
          expert: {
            rating: 10,
            rationale:
              '무담보 자금은 필요할 때 가장 먼저 사라진다. 씨티·BofA는 신용라인 확대 대신 담보를 요구했다(FCIC ch.18). 요청 자체가 절박함의 신호다.',
            sourceRefs: [S.fcic, S.bcbs],
          },
          consequences:
            '은행 3곳이 "담보 없이는 불가"라고 답했습니다. 요청 사실이 시장에 알려졌습니다.',
          feasibility: { basis: '요청은 가능하나 체결 불가' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '"PDCF 적격 담보 여력"이 $5B 이상이면 풀을 건드리지 않고 담보 콜에 응할 수 있습니다. 0이면 현금뿐입니다.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: '트라이파티 청산은행은 매일 아침 언와인드로 딜러에게 일중 신용을 줍니다. 청산은행과 다투는 것은 결제와 다투는 것입니다.',
    },
    {
      level: 2,
      decisionId: 't2-d2',
      text: '헤어컷 스파이럴: 헤어컷을 받아들일수록 조달은 줄고 현금은 더 나갑니다. 비유동 담보 레포는 어차피 사라집니다.',
    },
    {
      level: 3,
      decisionId: 't2-d2',
      text: '여력이 있으면 C(검증 가능 제시)+B(질서 있는 축소). A는 함정, D는 시간 낭비입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2008-09-12 (금) "3자 회동"
// ---------------------------------------------------------------------------------------------
/**
 * 16:00 뉴욕연준의 소집 통보. 통화의 존재와 시각은 공개 기록(FCIC ch.18: 9/12 저녁 6시 소집)에
 * 근거하지만, 대사 자체는 **재구성**이며 녹취·속기록이 아니다(calibration.md §7.4).
 */
const t3FrbnySummons: Interrupt<BankState> = {
  id: 't3-i1-frbny',
  interrupt: true,
  atTick: 3,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't3-i1-attend',
  scoreWeight: 0.5,
  required: false,
  title: '뉴욕연준 소집 통보 — 오늘 저녁 6시',
  prompt: '오늘 저녁 회동에 어떻게 임하시겠습니까?',
  context: '주말은 60시간입니다. 오늘 저녁 회의실에 가지고 들어가는 자료가 일요일의 선택지입니다.',
  source: {
    kind: 'regulator',
    caller: '뉴욕연준 실무국장',
    agency: 'Federal Reserve Bank of New York',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '뉴욕연준 실무국장',
      text: '오늘 저녁 6시에 주요 금융기관 CEO를 소집합니다. 귀사도 참석하십시오. 공적 자금은 논의 대상이 아닙니다.',
    },
  ],
  dimensions: ['policy', 'compliance'],
  cardRefs: ['fdic-resolution-weekend'],
  options: [
    {
      id: 't3-i1-prebrief',
      label: '참석 전에 담보 목록·고객자산 분리 현황을 사전 제출',
      description:
        '브로커딜러의 트라이파티 적격 담보 목록과 고객 자산 분리 상태를 회의 전에 보낸다. 주말에 창구 조건이 바뀌면 곧바로 쓸 수 있다.',
      effects: [flag('fed_prebrief'), counter('fedContacts', 1)],
      expert: {
        rating: 80,
        rationale:
          '준비된 담보 목록만 월요일 아침에 자금이 된다(CFP 원칙의 리드타임). 사전 제출은 연준의 담보 확대가 실제로 나왔을 때 몇 시간을 벌어 주며, 사전 조율된 정리(pre-pack)의 전제이기도 하다(FDIC 2011).',
        sourceRefs: [S.bcbs, S.fdic, S.fed914],
      },
      preview: [
        {
          metric: 'facilityHeadroom',
          direction: 'up',
          magnitude: 1,
          note: '담보 확대가 나올 경우 반영 폭이 커진다',
        },
      ],
      consequences: '담보 목록과 고객자산 분리 현황이 회의 전에 전달되었습니다.',
    },
    {
      id: 't3-i1-attend',
      label: 'CEO·자금담당이 동반 참석',
      description: '자료 없이 참석해 현장에서 상황을 설명한다.',
      effects: [counter('fedContacts', 1)],
      expert: {
        rating: 55,
        rationale:
          '리먼의 실제 대응이다. 참석 자체는 필요했지만, 회의실에서 요구된 것은 설명이 아니라 인수자와 컨소시엄이었다.',
        historicalNote: '9/12 저녁 뉴욕연준 회동 참석.',
        sourceRefs: [S.fcic, S.fhSup],
      },
      preview: [{ metric: 'facilityHeadroom', direction: 'flat', magnitude: 1 }],
      consequences: '참석을 통보했습니다.',
      historical: true,
    },
    {
      id: 't3-i1-delegate',
      label: '자문사를 대리 참석시키고 경영진은 인수 협상에 집중',
      description: '회의에는 자문사를 보내고 경영진은 후보와의 협상을 계속한다.',
      effects: [flag('frbny_delegated'), regulator({ add: 1 }, '소집 회의 대리 참석')],
      expert: {
        rating: 10,
        rationale:
          '소집은 초대가 아니다. 감독당국이 직접 부른 자리에 대리인을 보내는 것은 협상력을 얻는 대신 감독 관계를 잃는 선택이며, 주말의 조율 채널이 좁아진다.',
        sourceRefs: [S.fcic, S.fdic],
      },
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
      consequences: '자문사가 대리 참석했습니다. 뉴욕연준이 경영진의 불참을 기록했습니다.',
      trap: true,
      trapExplanation:
        '주말의 선택지는 금요일 저녁에 열린 채널로만 만들어진다. 그 자리에 결정 권한이 없는 사람을 보내면 일요일 밤에 협상할 상대가 남지 않는다.',
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2008년 9월 12일 (금) 07:00~18:00 ET',
  title: '금요일: 뉴욕연준 회동',
  time: '2008-09-12T07:00:00-04:00',
  ticks: 5,
  tickLabels: ['07:00', '09:30', '12:00', '16:00', '18:00'],
  entryEffects: [
    {
      id: 't3-stock',
      description:
        '프리마켓 갭 −7.03% (9/12 종가 −14% 중 갭 부분; 개장 후 하락은 티커가 이어받는다)',
      // 0.86 = 갭 × 0.925(장중 티커) ⇒ 갭 = 0.86 / 0.925. 곱이 종전 −14%와 정확히 같다.
      effects: [ownStockMove(0.86 / 0.925 - 1, '9/12 프리마켓 갭')],
    },
  ],
  eachTick: [
    {
      id: 't3-runoff-tick',
      description: '9/12 자금 유출 — 뉴욕 영업일 전방 집중 분포',
      effects: [
        bankFx.runoffStep({ windowFraction: 1, profile: NY_DAY_PROFILE, label: '9/12 유출' }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't3-jpm-call2',
      atTick: 0,
      when: { notFlag: 'clearing_bank_refused' },
      description:
        'JPM 2차 추가 담보 요구 $5B (9/11 저녁 요구 → 9/12 아침 현금 이행) — 유동성 풀에서 예치',
      effects: [ibFx.clearingBankCollateralCall({ amount: 5, label: 'JPM 2차 담보 콜 $5B 예치' })],
    },
    // ΔCI·감독 강화는 마지막 틱에 건다 — T2와 같은 이유다(유출 슬라이스가 CI를 실시간으로 읽는다).
    {
      id: 't3-pb-report',
      atTick: 4,
      when: {
        fn: (ctx) => (ctx.counters.cumulativeOutflow ?? 0) / START_RUNNABLE > 0.3,
        label: '누적 자금 유출 > 도주성 조달의 30%',
      },
      description: 'PB 잔고 이탈·레포 축소 규모 보도 → 신뢰지수 −5',
      effects: [confidence(-5, 'PB 이탈·레포 축소 보도')],
    },
    {
      id: 't3-regulator',
      atTick: 4,
      description: 'SEC·뉴욕연준 상주 감독 강화(R+1)',
      effects: [regulator({ add: 1 }, 'SEC·FRBNY 상주')],
    },
  ],
  ticker: {
    series: [
      // 프리마켓 갭 × 장중 티커(0.925) = 0.86 → 9/12 종가 −14% [press-kdb-2008-09-09]
      { path: 'market.ownStock', mode: 'relative', values: [100, 97, 95, 93.5, 92.5] },
      // TED: 9/11 종가 1.24% → 9/12 종가 1.36% [fred-tedrate-2008]
      { path: 'market.custom.tedBp', mode: 'absolute', values: [124, 127, 130, 133, 136] },
      // 5년 CDS 700bp → ≈775bp [VERIFY — facts.ts 주석의 해소 문서: FCIC 자료실 Markit 계열]
      { path: 'market.ownCdsBp', mode: 'absolute', values: [700, 725, 745, 762, 775] },
    ],
  },
  interrupts: [t3FrbnySummons],
  events: [
    {
      /**
       * The correction to `t2-news-buyers`. Both halves of the report held: BofA really was in the
       * data room, and "공적 자금은 없다" really was the position — it was stated to the CEOs' faces
       * at the Friday meeting and never moved.
       *
       * The lesson is that a confirmed rumour is not necessarily a useful one. Knowing a buyer is
       * looking tells you nothing about whether they will bid, and the reader who treated the
       * first half as good news spent Thursday not raising liquidity.
       */
      id: 't3-news-buyers-confirmed',
      kind: 'newswire',
      outlet: '통신사',
      atTick: 0,
      time: '07:00',
      headline: '[확인] 어제 보도는 사실 — BofA 실사 진행 중, 재무부는 "공적 자금 없다" 공식화',
      body:
        '어제 확인되지 않은 채 전해진 두 가지가 모두 사실로 굳었다. BofA는 실사를 진행 중이고, ' +
        '재무부의 "공적 자금은 없다"는 입장은 비공식 전언이 아니라 오늘 회의에서 직접 전달됐다. ' +
        '다만 실사 착수는 인수 의사가 아니며, 어느 후보도 아직 가격을 제시하지 않았다.',
      severity: 'critical',
      reliability: 'confirmed',
      correctionOf: 't2-news-buyers',
      sourceRefs: [S.fcic, S.val],
    },
    {
      id: 't3-memo-pool',
      kind: 'memo',
      atTick: 0,
      time: '07:10',
      from: '자금부장',
      to: 'CEO · Treasurer',
      subject: '금요일 아침 유동성 현황',
      body: `- JPM이 어제 저녁 **추가 담보 $5B**를 다시 요구해 오늘 아침 현금으로 예치했습니다(오늘 언와인드 조건).
- 유동성 풀: **{{metric:cash}}** (청산은행 담보 예치 누적 {{metric:clearingBankCalls}} 별도).
- PDCF 적격 담보 여력(브로커딜러): {{metric:facilityHeadroom}}.
- 트라이파티 레포 롤오버율: {{metric:repoRollRate}}%. 국채·기관 담보는 아직 롤오버 중.
- 누적 자금 유출: {{metric:cumulativeOutflow}}.
- 지주회사 무담보 만기·파생 담보 요구는 PDCF로 조달할 수 없음(브로커딜러 전용).`,
      severity: 'critical',
      sourceRefs: [S.val, S.fed316],
      relatedMetrics: ['cash', 'facilityHeadroom', 'repoRollRate', 'cumulativeOutflow'],
    },
    {
      id: 't3-call-frbny',
      kind: 'call',
      atTick: 1,
      time: '10:00',
      caller: '뉴욕연준 총재',
      callee: 'CEO',
      agency: 'Federal Reserve Bank of New York',
      tone: 'urgent',
      lines: [
        {
          speaker: '뉴욕연준',
          text: '오늘 저녁 6시 연준에 주요 금융기관 CEO들을 소집합니다. 주말 안에 민간 해법을 찾아야 합니다. 재무부 장관의 입장은 분명합니다 — 공적 자금은 없습니다.',
        },
        { speaker: 'CEO', text: 'PDCF 담보 범위 확대와 지주회사 앞 대출은 검토되고 있습니까?' },
        {
          speaker: '뉴욕연준',
          text: '담보 범위는 검토 중이며 확정된 바 없습니다. 지주회사는 프라이머리 딜러가 아닙니다. 그 점은 변하지 않습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.fcic, S.bern, S.fhSup],
    },
    {
      id: 't3-news-buyers',
      kind: 'newswire',
      outlet: 'Bloomberg',
      atTick: 2,
      time: '12:00',
      headline: '뱅크오브아메리카·바클레이스, 메리디언 인수 검토 — 정부 손실 보증 요구',
      body: '두 인수 후보 모두 상업용 부동산 북에 대한 손실 보증 없이는 주말 내 완결이 어렵다는 입장을 전한 것으로 알려졌다. 재무부는 보증에 부정적이다.',
      severity: 'warning',
      sourceRefs: [S.fcic],
      reliability: 'unconfirmed',
    },
    {
      id: 't3-memo-legal',
      kind: 'memo',
      atTick: 2,
      time: '14:00',
      from: '법무실장',
      to: '경영진',
      subject: '연준 창구 적격성 정리',
      body: 'PDCF(3/16 신설)와 TSLF(3/11)는 **프라이머리 딜러(브로커딜러 자회사)** 앞 창구입니다. 지주회사는 적격 차입자가 아니며, 지주의 무담보 만기·파생 담보는 브로커딜러 차입으로 직접 충당할 수 없습니다. 브로커딜러에서 지주로의 자금 이전은 순자본 규칙(15c3-1)의 제한을 받습니다.',
      severity: 'warning',
      sourceRefs: [S.fed316, S.fed311, S.ball],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 't3-memo-pdcf-drawn',
      kind: 'memo',
      when: { flag: 'pdcf_prepositioned' },
      atTick: 2,
      time: '14:30',
      from: '브로커딜러 자금팀',
      to: 'Treasurer',
      subject: 'PDCF 여력 사용 가능',
      body: '사전 예치 담보 기준 PDCF 차입 여력은 대시보드 참조. 익일물이며 매일 롤오버됩니다. 주말 담보 확대 여부는 미정입니다.',
      severity: 'positive',
      sourceRefs: [S.fed316],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '연준·재무부·인수 후보 대응',
      prompt: '오늘 저녁 회동 전에 무엇을 하시겠습니까? (최대 2개)',
      context: '주말은 60시간입니다. 오늘 열어둔 채널만 일요일에 작동합니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'compliance', 'communication'],
      // 저녁 회동(틱 4, 18:00) 전까지가 시한이다. 인수 후보·연준·재무부 접촉은 정오(틱 2) 보도
      // 이후에 의미가 생기므로 그때 열린다.
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't3-a',
      timeLimitSec: 120,
      options: [
        {
          id: 't3-a',
          label: '민간 해법 집중: BofA·바클레이스 실사 데이터룸 개방, 정부 지원 없이 협상',
          description:
            '두 후보에 전면 실사를 허용하고 주말 내 완결을 목표로 한다. 보증 문제는 후보들이 제기한다.',
          effects: [flag('sale_process')],
          expert: {
            rating: 40,
            rationale:
              '리먼의 실제 경로. 두 후보 모두 보증 없이는 완결하지 않았고, BofA는 토요일 메릴린치로 돌아섰다. 필요하지만 충분하지 않은 조치.',
            historicalNote: '9/12 저녁 뉴욕연준 회동 → 주말 협상.',
            sourceRefs: [S.fcic, S.fhSup],
          },
          consequences: '데이터룸이 열렸습니다. 두 후보의 실사팀이 주말 동안 상주합니다.',
          historical: true,
          feasibility: { basis: '실제 진행된 절차', sourceRefs: [S.fcic] },
        },
        {
          id: 't3-b',
          label: '뉴욕연준에 PDCF 담보 확대·지주 앞 대출을 공식 요청(조기 접촉)',
          description:
            '브로커딜러의 담보 목록과 지주의 자금 계획을 연준에 제출하고 주말 조율 채널을 연다. 감독 단계는 오르지만 일요일 밤 선택지가 늘어난다.',
          effects: [flag('fed_engaged')],
          expert: {
            rating: 70,
            rationale:
              '연준의 담보 확대(9/14)는 실제로 일요일 저녁에야 나왔다. 조기 접촉은 이를 앞당기지는 못해도 사전 조율된 정리(pre-pack)의 전제가 된다(FDIC 2011: 준비된 정리가 무질서 파산보다 우월).',
            sourceRefs: [S.fed914, S.fdic],
          },
          consequences: '연준·SEC와 주말 핫라인이 열렸습니다. 담보 확대 요청은 "검토 중"입니다.',
          feasibility: { basis: 'CSE 모니터링 채널 존재', sourceRefs: [S.fcic] },
        },
        {
          id: 't3-c',
          label: '재무부에 인수자 앞 부동산 손실 보증 요청',
          description:
            '베어스턴스식($29B Maiden Lane) 지원을 요청한다. 재무부는 공개적으로 거부하지만, 요청 기록은 주말 협상의 조건이 된다.',
          effects: [flag('guarantee_requested')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '재무부 "공적 자금 없음" 공개 → 신뢰지수 −3',
              effects: [confidence(-3, '재무부 보증 거부 보도')],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '연준·재무부는 보증 권한이 없다고 했고(Bernanke 2010), Ball은 담보가 충분했다고 반박한다. 요청은 정당하지만 거부가 공개되면 비용이 있다.',
            sourceRefs: [S.bern, S.ball, S.fhSup],
          },
          consequences: '재무부에 보증 요청서를 보냈습니다. 답은 "권한이 없다"였습니다.',
          feasibility: { basis: '요청 가능; 승인 권한 부재', sourceRefs: [S.bern] },
        },
        {
          id: 't3-d',
          label: '"주말 내 인수 완결 확실" 공개 메시지로 시장 안심',
          description:
            '완결되지 않은 거래를 확정처럼 말한다. 일요일에 사실이 아니면 거짓 백스톱이 된다.',
          effects: [flag('deal_promised'), confidence(3, '인수 기대')],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { notFlag: 'sold_with_support' },
              description: '"완결 확실" 발언이 거짓으로 드러남 → 증폭 ×1.5, 신뢰지수 −15',
              effects: [
                bankFx.addAmplifier(1.5, '거짓 백스톱 노출'),
                confidence(-15, '인수 완결 발언 모순'),
              ],
            },
          ],
          expert: {
            rating: 10,
            rationale:
              '검증 불가능한 약속은 모순의 순간 증폭기가 된다(보정 6.4: 거짓 백스톱 ×1.5).',
            sourceRefs: [S.bcbs, S.fcic],
          },
          consequences: '"주말 내 해법을 기대한다"는 메시지가 나갔습니다.',
          trap: true,
          trapExplanation:
            '금요일의 안도는 일요일의 배신이 된다. 확정되지 않은 거래는 말하지 않는다.',
        },
      ],
    },
    {
      id: 't3-d2',
      title: '금요일 유동성 동원',
      prompt: '주말 전 마지막 영업일에 어떤 자금을 확보하시겠습니까? (최대 2개)',
      context:
        '월요일 아침 언와인드를 위해 브로커딜러에 현금이 있어야 합니다. 지주의 만기는 별개입니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['discount-window-fhlb-btfp'],
      dimensions: ['liquidity', 'solvency', 'timeliness'],
      // 자금 조치는 개장(틱 1)부터 가능하고 장 마감(틱 3, 16:00)이 시한이다.
      availableFrom: 1,
      deadlineTick: 3,
      defaultOptionId: 't3-d2-e',
      timeLimitSec: 120,
      options: [
        {
          id: 't3-d2-a',
          label: '브로커딜러 PDCF 여력 한도까지 차입',
          description: '사전 예치 담보 한도 내에서 익일물 차입. 주말 동안 롤오버된다.',
          requires: { metric: 'facilityHeadroom', gte: 1 },
          unavailableReason: 'PDCF 적격 담보가 브로커딜러 앞에 예치되어 있지 않습니다.',
          effects: [
            bankFx.drawFacility({ amount: 999, source: 'PDCF(브로커딜러)', rateBp: 225 }),
            flag('pdcf_drawn'),
          ],
          expert: {
            rating: 80,
            rationale:
              '런 중 유동성 과잉이 정답이다. 비용은 스프레드, 대가는 월요일 아침 언와인드.',
            sourceRefs: [S.fed316, S.ball],
          },
          consequences: 'PDCF 차입이 실행되었습니다.',
          feasibility: { basis: 'PDCF 익일물, 여력 한도 내', sourceRefs: [S.fed316] },
        },
        {
          id: 't3-d2-b',
          label: '자산운용 자회사 급매 개시 — 가격 $5B, 월요일 결제',
          description:
            '확정 계약이 없다면 지금이라도 판다. 가격은 $7B에서 $5B로 떨어졌고 결제는 월요일이다.',
          when: { notFlag: 'nb_sale_signed' },
          effects: [flag('nb_firesale')],
          delayedEffects: [
            {
              afterTurns: 3,
              description: '자산운용 자회사 급매 종결 — 현금 $5B (월요일)',
              effects: [ibFx.sellNeuberger({ price: 5, bookValue: 4, label: '뉴버거 급매 종결' })],
            },
          ],
          expert: {
            rating: 50,
            rationale: '중순 입찰가 ≈$5B(언론). 늦었지만 파산 후 $2.15B보다 낫다.',
            sourceRefs: [S.pressNb, S.k8nb],
          },
          consequences: '급매 절차가 시작되었습니다. 대금은 월요일에 들어옵니다.',
          feasibility: {
            basis: '매수 의향자 복수; 주말 서명·월요일 결제 STYLIZED',
            sourceRefs: [S.pressNb],
          },
        },
        {
          id: 't3-d2-c',
          label: 'SpinCo 대상 부동산·CMBS $25B 주말 전 블록 투매(−45%)',
          description:
            '비유동 북 $25B를 45% 할인해 블록으로 판다. 현금 ≈$14B가 들어오지만 손실 ≈$16B가 자본에서 빠지고 남은 북도 그 가격으로 재마크된다. 자본이 총자산 2% 아래로 가면 지급불능이다.',
          effects: [
            ibFx.sellIlliquid({
              amount: 25,
              discount: 0.45,
              remarkPct: 0.2,
              label: '부동산 블록 투매',
            }),
            flag('re_firesale'),
            confidence(-5, '파이어세일 가격 공개'),
          ],
          expert: {
            rating: 15,
            rationale:
              '파이어세일은 자기 체결가로 자기 북 전체를 재마크한다(가이드 6.6). 얻는 현금보다 잃는 자본이 크고, 자본이 총자산 2% 아래로 가면 유동성 문제가 지급불능이 된다. 리먼의 부동산 마크는 이미 논쟁 대상이었다(Valukas).',
            sourceRefs: [S.cgfs, S.val],
          },
          consequences:
            '블록이 45% 할인에 체결되었습니다. 남은 부동산 북의 평가액이 그 가격으로 내려갔고 자본이 급감했습니다.',
          trap: true,
          trapExplanation:
            '"현금이 급하니 판다"는 판단은 유동성 문제를 자본 문제로 바꾼다. 비유동 자산은 매각이 아니라 분리(스핀오프)·담보의 대상이다.',
          irreversible: true,
          remediationCard: 'economic-vs-regulatory-capital',
        },
        {
          id: 't3-d2-d',
          label: '지주회사 앞 연준 직접 대출 요청',
          description:
            '지주의 만기를 연준 대출로 막으려 한다. 지주는 프라이머리 딜러가 아니어서 PDCF·TSLF 적격이 아니다.',
          requires: { flag: 'fed_parent_lending_allowed' },
          unavailableReason:
            'PDCF·TSLF는 브로커딜러 전용입니다. 지주회사는 적격 차입자가 아니며 연준은 지주 앞 대출을 거부했습니다.',
          effects: [],
          expert: {
            rating: 30,
            rationale:
              '요청 자체는 정당하나 창구가 없다. 학습 포인트: 최종대부자 창구의 법적 경계.',
            sourceRefs: [S.fed316, S.bern],
          },
          consequences: '(선택 불가)',
          feasibility: { basis: '적격 차입자 아님 — 실행 불가', sourceRefs: [S.fed316] },
        },
        {
          id: 't3-d2-e',
          label: '추가 조달 없이 주말 협상에 집중',
          description: '오늘은 인수 협상에 집중하고 자금 조치는 하지 않는다.',
          effects: [],
          expert: {
            rating: 25,
            rationale:
              '리먼의 브로커딜러는 파산 전까지 PDCF를 쓰지 않았다(9/15 저녁 $28B). 월요일 아침이 오면 선택지가 없다.',
            historicalNote: '실제 금요일: 자금 조치 없이 주말 협상.',
            sourceRefs: [S.fhSup, S.fcic],
          },
          consequences: '자금 조치 없이 주말에 들어갑니다.',
          historical: true,
          feasibility: { basis: '무조치' },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '일요일 밤에 열려 있는 채널은 오늘 만든 채널뿐입니다. 연준(B)과 재무부(C)에 무엇을 요청했는지가 T5의 선택지를 결정합니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: 'B(연준 조기 접촉)는 사전 조율된 정리의 전제입니다. D는 함정입니다.',
    },
    {
      level: 2,
      decisionId: 't3-d2',
      text: 'PDCF는 브로커딜러 전용입니다. 지주의 만기는 자산 매각·확정 거래로만 막을 수 있습니다. 파이어세일(C)은 자본을 태웁니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3]
