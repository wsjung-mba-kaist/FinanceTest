import type { CentralBankState, DialogueStep, Interrupt, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, counter, flag, op } from '../../engine/fx/common'
import { sbFx } from './fx'

type T = Turn<CentralBankState>

/**
 * ── 이 시나리오의 서술 규칙 ──
 * 기관은 실재하는 그대로 쓴다(금융위원회·금융감독원·예금보험공사·저축은행중앙회). 그러나 **등장하는
 * 모든 발언은 공개 기록에 기초한 개연성 있는 재구성이며 속기록이나 인용이 아니다.** 화자는 직책으로만
 * 표기하고, 개인에 대한 판단은 법원이 확정한 범위(대법원 2013도6394)와 정부 스스로 공표한 사실
 * (금융위 2011-09-18 브리핑의 "13개사 중 6개사 적기시정조치 유예")을 넘지 않는다.
 *
 * 영업정지 직전의 예금 인출은 국정조사와 수사가 다룬 사실로만 서술하고, 개별 책임은 단정하지 않는다.
 */

/** 영업정지 발표일의 틱 구조(2/17). 프로필 합은 1이어야 한다 — calibration.md §5.1. */
export const T2_TICK_LABELS = [
  '09:00 개점',
  '11:00 금융위 임시회의',
  '14:00 발표',
  '16:00 창구 마감',
  '18:00 시장 마감',
]
/** 2/17: 발표 직후 창구에 몰린다 — 중반 집중 [STYLIZED]. */
export const T2_QUEUE_PROFILE = [0.12, 0.15, 0.33, 0.3, 0.1]

/** 금요일 마감 → 토요일 의결·발표 → 주말 → 월요일 개점(2/18~2/21). */
export const T3_TICK_LABELS = [
  '2/18 (금) 14:00 영업 마감 전',
  '2/18 (금) 17:00 임시회의 소집',
  '2/19 (토) 07:30 정지 의결',
  '2/19 (토) 09:00 발표·주말 콜센터',
  '2/21 (월) 09:30 개점',
]
/** 2/18 금요일과 2/21 월요일 창구에 양분되고 주말은 문의만 남는다 [STYLIZED]. */
export const T3_QUEUE_PROFILE = [0.3, 0.18, 0.05, 0.17, 0.3]

/** 출처 id 축약(sources.ts). 사후 출처(2012년 이후)는 턴 텍스트에서 인용하지 않는다. */
export const S = {
  samhwa: 'fsc-69852',
  busan: 'fsc-69869',
  liquidity: 'fsc-69870',
  stance: 'fsc-69871',
  more4: 'fsc-69872',
  busanMeeting: 'fsc-69874',
  domin: 'fsc-69877',
  supervision: 'fsc-supervision-2011-03-17',
  gyeongeun: 'fsc-70017',
  sept7: 'fsc-70069',
  diagnosis: 'fsc-brief-2011-09-18',
  bridge: 'fsc-70101',
  transfer: 'fsc-70138',
  pfBrief: 'fsc-brief-2010-06-25',
  pfFund: 'fsc-pf-fund-2011-06-24',
  dpAct: 'depositor-protection-act',
  dpAct2011: 'depositor-protection-act-2011',
  msbAct: 'mutual-savings-bank-act',
  finAct: 'bank-restructuring-act',
  fsb50: 'fsb-50years',
  excess: 'press-busan-excess-2011-06-05',
  inquiry: 'assembly-inquiry-2011',
  whitebook: 'savings-bank-whitebook-2012',
  bcbs: 'bcbs-144',
  ecosRate: 'ecos-817Y002',
  ecosFx: 'ecos-731Y003',
  ecosEq: 'ecos-802Y001',
  ecosDep: 'ecos-111Y007',
  ecosPolicy: 'ecos-722Y001',
}

// ---------------------------------------------------------------------------------------------
// T0 — 2011-02-14 (월) "계열 실사와 적기시정조치"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2011년 2월 14일 (월) 09:00 KST',
  title: '프롤로그: 계열 실사 결과',
  time: '2011-02-14T09:00:00+09:00',
  entryEffects: [
    {
      id: 't0-sync',
      description: '초기 지표 정렬',
      effects: [sbFx.refresh('T0 지표 정렬')],
    },
  ],
  events: [
    {
      id: 't0-memo-inspection',
      kind: 'memo',
      time: '08:40',
      from: '금융감독원 저축은행검사국',
      to: '금융위원회 중소금융과 · 금융감독원 저축은행서비스국',
      subject: '부산저축은행 계열 5개사 검사 중간 결과 (대외주의)',
      body: `- 부산·부산2·중앙부산·대전·전주 5개사. 계열 전체 수신 약 6.5조원.
- **부산저축은행은 자기자본이 완전잠식** 상태로 집계됩니다. 대전저축은행은 자본보다 유동성이 먼저 문제입니다 — 최근 인출에 응하기 어려운 수준입니다.
- 계열이 설립·관리한 다수의 특수목적법인(SPC)을 통해 사업시행자 대출이 나갔고, 그 잔액이 계열 여신의 상당 부분을 차지합니다. 차주와 자금 흐름은 계속 확인 중입니다.
- 다섯 곳은 자금·인력·전산을 공유합니다. **한 곳에서 인출이 시작되면 나머지 네 곳으로 옮겨 갑니다.**`,
      severity: 'critical',
      sourceRefs: [S.busan, S.whitebook],
      relatedMetrics: ['distressedBanks'],
    },
    {
      id: 't0-data-sector',
      kind: 'data',
      time: '09:00',
      title: '업권 현황',
      rows: [
        { label: '저축은행 수', value: '105개사 (2010년말)' },
        { label: '업권 총수신(말잔)', value: '2010.12말 76.8조 → 2011.1말 74.4조 (△2.40조)' },
        { label: '영업정지', value: '삼화저축은행 1개사 (1/14, BIS △1.42%)' },
        { label: '부동산 PF대출', value: '12.5조원 (2009년 12월말, 91개사 보유)' },
        { label: 'PF대출 연체율', value: '25.1% (2010년 12월말) — 2009년 12월말은 10.6%' },
        { label: '예금자보호 한도', value: '1인당 원리금 5천만원' },
      ],
      severity: 'warning',
      sourceRefs: [S.ecosDep, S.samhwa, S.pfBrief, S.fsb50, S.dpAct],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't0-memo-kdic',
      kind: 'memo',
      time: '09:20',
      from: '예금보험공사 정리부',
      to: '금융위원회 중소금융과',
      subject: '저축은행계정 재원 현황',
      body: `- 예금보험기금 **상호저축은행계정은 이미 결손** 상태입니다. 삼화 정리 소요를 반영하면 즉시 동원 가능한 재원은 **약 4.8조원**(잔여 + 예보채 발행·계정 간 차입 여력)입니다.
- 향후 1년 내 예상 정리소요는 보수적으로 잡아도 **12조원 안팎**입니다. 커버리지는 40% 수준입니다.
- 예금자보호법상 보호 한도는 1인당 원리금 5천만원이고, **초과분과 후순위채는 보호 대상이 아닙니다.** 초과분은 파산재단 배당으로만 회수됩니다.
- 정리방식은 예금보험기금의 손실이 최소화되는 방식이어야 합니다(최소비용 원칙).`,
      severity: 'critical',
      sourceRefs: [S.dpAct, S.whitebook],
      cardRefs: ['fdic-resolution-weekend', 'uninsured-deposits-and-run-speed'],
      relatedMetrics: ['usableReserves', 'guidottiRatio'],
    },
    {
      id: 't0-news-pf',
      kind: 'newswire',
      outlet: '경제지',
      time: '07:30',
      headline: '저축은행 PF 연체율 25%대 — "부산 계열 검사 결과가 분수령"',
      body: '구조조정기금이 지난해 6월 법인 차주 PF채권 3.5조원을 2.5조원에 인수했지만 연체율은 오히려 올랐다. 시장은 금융당국이 계열 저축은행을 어떻게 처리할지 지켜보고 있다.',
      severity: 'warning',
      sourceRefs: [S.pfBrief, S.fsb50],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: '한국은행 기준금리', value: '2.75%', change: '1/13 인상' },
        { label: '국고채 3년', value: '3.97%', change: '' },
        { label: '회사채 AA− 3년', value: '4.75%', change: '' },
        { label: 'KOSPI', value: '2,014.59', change: '' },
        { label: '원/달러', value: '1,122.8', change: '' },
      ],
      sourceRefs: [S.ecosRate, S.ecosEq, S.ecosFx, S.ecosPolicy],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '적기시정조치',
      prompt: '부산저축은행 계열을 어떻게 처리하시겠습니까?',
      context:
        '자본이 완전잠식된 기관에는 경영개선명령(영업정지)이 원칙입니다. 다만 적기시정조치는 유예할 수 있고, 유예는 시간을 벌어 줍니다 — 벌어 준 시간에 손실이 자라지 않는다면.',
      requiredConcepts: ['regulator-escalation-ladder', 'fdic-resolution-weekend'],
      dimensions: ['compliance', 'policy'],
      options: [
        {
          id: 't0-d1-a',
          label: '부산·대전 두 곳을 먼저 정지하고 나머지 3개사는 실사를 계속한다',
          description:
            '자본잠식이 확인된 부산과 유동성이 마른 대전에 대해 부실금융기관 결정과 영업정지를 준비한다. 계열 나머지 3개사는 검사 결과가 나올 때까지 영업을 유지한다.',
          effects: [flag('scope_partial'), counter('plannedSuspend', 2)],
          expert: {
            rating: 45,
            rationale:
              '법적으로 요건이 갖춰진 곳부터 처리하는 것은 원칙에 맞다. 그러나 계열은 자금·전산·평판을 공유하므로, 두 곳을 닫으면 남은 세 곳의 창구에 같은 예금자가 선다. 정지의 근거가 "요건 충족 순서"일 때 치르는 비용이 전염이다.',
            historicalNote:
              '실제로 2011년 2월 17일 부산·대전 두 곳이 먼저 정지되었고, 이틀 뒤 계열 3개사와 보해가 추가로 정지되었다.',
            sourceRefs: [S.busan, S.more4],
          },
          consequences:
            '부산·대전에 대한 부실금융기관 결정 안건이 금융위원회에 올라갑니다. 계열 3개사는 검사를 계속합니다.',
          historical: true,
          feasibility: {
            basis:
              '금융산업의 구조개선에 관한 법률상 부실금융기관 결정 및 상호저축은행법상 영업정지 명령',
            sourceRefs: [S.finAct, S.msbAct],
          },
        },
        {
          id: 't0-d1-b',
          label: '계열 5개사를 같은 날 동시에 정지하도록 준비한다',
          description:
            '부산·부산2·중앙부산·대전·전주에 대한 부실금융기관 결정을 하나의 안건으로 올린다. 계열 전체의 예금 6.5조원이 같은 시각에 지급정지되며, 대지급 소요도 한 번에 나온다.',
          effects: [flag('scope_group'), counter('plannedSuspend', 5)],
          expert: {
            rating: 85,
            rationale:
              '계열을 나눠 정지하면 남은 곳이 곧 다음 차례가 된다 — 2월 19일 추가 정지의 사유가 바로 "2.17 이후 예금인출 사태가 계속되었다"는 것이었다. 동시 정지는 예금자에게 옮겨 갈 창구를 남기지 않으므로 전염 항이 사라진다. 대가는 즉시 확정되는 대지급 소요와, 아직 살릴 수 있었을지 모르는 곳까지 닫는다는 사실이다.',
            sourceRefs: [S.more4, S.busan],
          },
          consequences:
            '계열 5개사 일괄 안건이 준비됩니다. 예금보험공사가 대지급 소요를 다시 계산하고 있습니다.',
          irreversible: true,
          calibrationNote:
            '계열 잔여가 0이면 전염 항 1 + 1.6 × 정지비중 이 사라진다 (fx.ts affiliateSpill)',
          feasibility: {
            basis: '같은 의결에서 복수 기관에 대한 부실금융기관 결정이 가능하다',
            sourceRefs: [S.finAct],
          },
        },
        {
          id: 't0-d1-c',
          label: '자산건전성 분류를 유지한 채 6개월 유예하고 시장이 진정되기를 기다린다',
          description:
            '적기시정조치를 유예하고 자체 정상화 기회를 준다. 오늘 닫지 않으면 오늘의 줄도 없다. 부동산 경기가 돌아서면 PF 사업장이 살아날 수도 있다.',
          effects: [
            sbFx.forbear({
              count: 5,
              months: 6,
              lossGrowthPerMonth: 0.05,
              label: '계열 5개사 적기시정조치 6개월 유예',
            }),
            flag('scope_forbear'),
          ],
          expert: {
            rating: 10,
            rationale:
              '가장 자연스럽고 가장 비싼 선택이다. 유예는 손실을 없애지 않고 청구 시점을 미룰 뿐이며, 그 사이 부실은 이자와 추가 대출로 자란다. 금융당국은 2011년 9월 경영진단에서도 13개사 중 6개사에 대해 적기시정조치를 유예했다 — 유예가 예외가 아니라 관행이었다는 사실이 이 사태의 구조다.',
            sourceRefs: [S.diagnosis, S.msbAct],
          },
          consequences:
            '유예 결정이 기록됩니다. 오늘 창구는 조용하고, 자본부족액은 장부 밖에서 자라기 시작합니다.',
          trap: true,
          trapExplanation:
            '"조금만 더 기다리면 부동산이 돌아선다"는 유혹. 그러나 유예된 6개월 동안 자본부족액은 30% 늘고, 그 비용은 정지하는 순간 예금보험기금에 그대로 청구된다. 유예는 결정을 미루는 것이 아니라 가격을 올리는 것이다.',
          remediationCard: 'regulator-escalation-ladder',
          calibrationNote: '유예 6개월 × 월 5% = 자본부족·대지급 소요 ×1.30 (fx.ts forbear)',
        },
        {
          id: 't0-d1-d',
          label: '계열 5개사와 BIS 5% 미만 저축은행까지 일괄 정지한다',
          description:
            '부실 징후가 있는 곳을 한 번에 정리해 불확실성을 없앤다. 계열 5개사에 BIS 5% 미만으로 분류된 기관들을 더한다.',
          effects: [flag('scope_wide'), counter('plannedSuspend', 13)],
          expert: {
            rating: 30,
            rationale:
              'BIS 5% 미만이라는 사실만으로 부실금융기관 결정 요건이 충족되지는 않는다. 요건 없이 닫으면 그 자체가 법적 분쟁이 되고, 아직 자체 정상화가 가능한 곳까지 죽여 대지급 소요를 스스로 키운다. 2011년 2월 시점의 BIS 5% 미만은 5개사였다.',
            sourceRefs: [S.stance, S.finAct],
          },
          consequences:
            '광범위한 일괄 정지 안건이 검토됩니다. 법무 검토에서 요건 미충족 의견이 붙었습니다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't0-d2',
      title: '유동성 백스톱',
      prompt: '정지 전에 잔여 저축은행의 지급 능력을 무엇으로 받치겠습니까?',
      context:
        '저축은행은 한국은행 대출 대상이 아닙니다. 창구 현금은 저축은행중앙회의 지급준비예탁금과 외부 차입으로만 나옵니다. 약정은 하루 만에 맺어지지 않습니다.',
      requiredConcepts: ['korea-crisis-toolkit', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't0-d2-a',
          label: '중앙회 지급준비예탁금만 확인하고 차입은 정지 당일에 협의한다',
          description:
            '저축은행중앙회가 보유한 지급준비예탁금으로 우선 대응하고, 크레딧라인은 발표와 함께 협의한다. 당일에 모으는 만큼 전부 모이지는 않는다.',
          effects: [
            sbFx.backstop({ amount: 3.0, label: '중앙회 지급준비예탁금 3조원' }),
            flag('backstop_partial'),
          ],
          expert: {
            rating: 45,
            rationale:
              '실제 경로다. 중앙회 차입한도 확대(0.6조 → 3조)와 정책금융공사·4개 은행 크레딧라인 2조원은 영업정지와 **같은 날** 승인·개설되었다. 하루에 모을 수는 있었지만, 그 하루 동안 창구는 이미 열려 있었다.',
            historicalNote:
              '2011년 2월 17일 금융위원회는 중앙회 차입한도를 3조원으로 확대 승인하고 크레딧라인 2조원을 개설했다고 발표했다.',
            sourceRefs: [S.liquidity, S.stance],
          },
          consequences: '중앙회 예탁금 3조원을 확인했습니다. 나머지는 당일 협의 사항으로 남깁니다.',
          historical: true,
        },
        {
          id: 't0-d2-b',
          label: '중앙회 3조·정책금융공사·은행 2조·증권금융 1조를 정지 전에 약정한다',
          description:
            '저축은행중앙회 지급준비예탁금 3조원, 정책금융공사와 시중은행 크레딧라인 2조원(정책금융공사 50% 손실보증), 한국증권금융 RP·담보대출 1조원 — 합계 6조원을 영업정지 이전에 문서로 맺는다.',
          effects: [
            sbFx.backstop({ amount: 6.0, label: '유동성 백스톱 6조원 사전 약정' }),
            flag('backstop_full'),
          ],
          expert: {
            rating: 85,
            rationale:
              '규모는 실제 발표와 같고 시점만 앞선다. 바젤 원칙 11은 조달 수단을 위기 전에 확보·테스트하라고 요구한다 — 사전에 약정된 라인만이 발표 당일의 현금이 된다. 같은 6조원이라도 "오늘 맺었다"와 "이미 맺혀 있다"는 창구에서 다르게 작동한다.',
            sourceRefs: [S.liquidity, S.stance, S.bcbs],
          },
          consequences:
            '3단계 지원체계(지급준비예탁금 95% 콜 → 200% 유동성콜 → 긴급대출)와 크레딧라인 약정서가 준비되었습니다.',
          calibrationNote: '백스톱 6조 → 완화 계수 ×(1 − 6/24) = ×0.75 (fx.ts backstop)',
          feasibility: {
            basis: '중앙회 차입한도 확대는 금융위원회 승인 사항, 크레딧라인은 기관 간 약정',
            sourceRefs: [S.liquidity],
          },
        },
        {
          id: 't0-d2-c',
          label: '백스톱 없이 개별 저축은행의 자체 유동성으로 대응한다',
          description:
            '정지 대상이 아닌 저축은행은 스스로 버틸 수 있다고 본다. 중앙회 지원은 요청이 오면 심사한다.',
          effects: [
            sbFx.adjustContagion({
              factor: 1.12,
              reason: '창구 현금 부족 우려',
              groups: ['peer', 'sound'],
              label: '백스톱 미준비',
            }),
          ],
          expert: {
            rating: 15,
            rationale:
              '저축은행의 창구 현금은 균일하지 않다. 한 곳의 "오늘은 어렵습니다"가 업권 전체의 뉴스가 되고, 그 뉴스가 다음 날의 줄을 만든다. 최종대부자 접근이 없는 업권에서 백스톱은 선택이 아니라 전제다.',
            sourceRefs: [S.bcbs, S.liquidity],
          },
          consequences: '별도 조치 없이 정지일을 맞습니다. 중앙회가 우려를 전해 왔습니다.',
          trap: true,
          trapExplanation:
            '"아직 쓸 일이 없는데 왜 미리 약정하는가"가 가장 합리적으로 들린다. 그러나 백스톱은 쓰기 위해서가 아니라 **있다는 사실을 말하기 위해** 필요하고, 그 말을 하려면 발표 전에 문서가 있어야 한다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't0-d2-d',
          label: '한국은행에 저축은행 대상 유동성 지원을 요청한다',
          description: '최종대부자에게 직접 창구를 요청한다.',
          requires: { flag: 'bok_access' },
          unavailableReason:
            '저축은행은 한국은행 공개시장운영 대상기관이 아니며, 한국은행법상 금융기관 여신은 금융통화위원회 의결과 정부 의견 청취가 필요해 이번 주 안에 실행할 수 없습니다. 2011년 2월의 유동성은 저축은행중앙회·정책금융공사·시중은행·한국증권금융에서 나왔습니다.',
          effects: [],
          expert: {
            rating: 35,
            rationale:
              '방향은 옳지만 그 주에 열리지 않은 창구다. 실제 백스톱은 중앙회·정책금융공사·은행·증권금융의 4자 구조로 만들어졌다.',
            sourceRefs: [S.liquidity, S.stance],
          },
          consequences: '요청서가 접수되었습니다.',
          feasibility: {
            basis: '2011년 당시 저축은행은 한국은행 대출·공개시장운영 대상기관이 아니었다',
            sourceRefs: [S.liquidity],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '계열 5개사는 자금·전산·평판을 공유합니다. 몇 곳을 남기는지가 다음 이틀의 인출을 결정합니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '유예의 비용은 유예하는 날이 아니라 정리하는 날에 청구됩니다. 대시보드의 "자본부족액"을 보십시오.',
      cardRefs: ['regulator-escalation-ladder'],
    },
    {
      level: 2,
      decisionId: 't0-d2',
      text: '사전에 약정된 라인만이 발표 당일의 현금입니다. 당일 협의는 당일에 다 모이지 않습니다.',
      cardRefs: ['contingency-funding-plan'],
    },
  ],
  relatedCards: ['regulator-escalation-ladder', 'korea-crisis-toolkit', 'fdic-resolution-weekend'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2011-02-16 (수) "의결 준비와 정보 관리"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2011년 2월 16일 (수) 09:00 KST',
  title: '의결 준비 — 명단과 재원',
  time: '2011-02-16T09:00:00+09:00',
  entryEffects: [
    {
      id: 't1-decay',
      description: '전염 계수 감쇠',
      effects: [sbFx.decaySpill()],
    },
    {
      id: 't1-market',
      description: '2/16 종가: 국고채 3년 3.93%, KOSPI 1,989.11, 원/달러 1,120.3',
      effects: [
        op('market.custom.govt3y', 'set', 393, '국고채 3년 2/16 종가'),
        op('market.custom.corpAa3y', 'set', 471, '회사채 AA− 3년 2/16 종가'),
        op('market.equityIndex', 'set', 1989.11, 'KOSPI 2/16 종가'),
        op('market.fxUsdLocal', 'set', 1120.3, '원/달러 2/16 종가'),
        op('institution.fx.spot', 'set', 1120.3, '원/달러 2/16 종가'),
        sbFx.refresh('2/16 시세 반영'),
      ],
    },
    {
      id: 't1-presuspension-drain',
      description: '정지 예정 소문에 따른 계열 창구 인출(외생) — 전염 ×1.12',
      effects: [
        sbFx.adjustContagion({
          factor: 1.12,
          reason: '정지 예정 소문 확산',
          groups: ['busan'],
          label: '정지 전 인출 징후',
        }),
        confidence(-3, '계열 저축은행 정지 예정 소문'),
      ],
    },
    {
      id: 't1-runoff',
      description: '2/15~2/16 이틀치 창구 인출',
      effects: [sbFx.runoffStep({ days: 2, profile: [1], label: '2/15~2/16 인출' })],
    },
  ],
  events: [
    {
      id: 't1-memo-agenda',
      kind: 'memo',
      time: '08:30',
      from: '금융위원회 사무처',
      to: '중소금융과',
      subject: '임시회의 안건 — 부실금융기관 결정 및 영업정지',
      body: `- 내일(2/17) 이른 아침 임시회의를 소집합니다. 안건은 부실금융기관 결정과 경영개선명령(영업정지)입니다.
- 영업정지 기간은 6개월이 원칙이며, 임원 직무집행정지와 관리인 선임이 함께 이루어집니다. 만기도래 어음·대출의 기일연장 등 일부 업무는 정지 대상에서 제외됩니다.
- 의결과 동시에 예금보험공사가 가지급금 지급 준비에 들어갑니다. 지급까지는 며칠이 걸립니다.
- **의결 전까지 대상 기관 명단은 대외주의입니다.**`,
      severity: 'warning',
      sourceRefs: [S.samhwa, S.busan, S.finAct, S.msbAct],
    },
    {
      id: 't1-rumor-branch',
      kind: 'rumor',
      source: '부산 지역 지점·온라인 게시판',
      time: '10:30',
      headline: '"내일 문 닫는다" — 계열 지점 앞 대기 행렬, 어제보다 길어져',
      body: '정지 대상이 어디인지에 대한 이야기가 지역에서 돌고 있다. 일부 지점은 어제 하루 인출액이 평소의 몇 배였다고 보고했다. 무엇이 사실이고 무엇이 소문인지 지금은 아무도 확인해 주지 않는다.',
      severity: 'critical',
      reliability: 'unconfirmed',
      cardRefs: ['bank-run-dynamics'],
      relatedMetrics: ['spillBusan', 'outflowBusan'],
    },
    {
      id: 't1-call-central',
      kind: 'call',
      time: '14:00',
      caller: '저축은행중앙회 자금담당 임원',
      callee: '금융위원회 중소금융과장',
      agency: '저축은행중앙회',
      tone: 'concerned',
      lines: [
        {
          speaker: '중앙회 자금담당 임원',
          text: '지급준비예탁금으로 감당할 수 있는 규모에는 한계가 있습니다. 차입한도를 늘려 주시면 정책금융공사·시중은행과 크레딧라인을 열 수 있습니다. 다만 약정서에 손실보증 조건이 들어가야 은행이 움직입니다.',
        },
        {
          speaker: '중소금융과장',
          text: '한도 확대는 금융위원회 승인 사항입니다. 언제까지 필요합니까.',
        },
        {
          speaker: '중앙회 자금담당 임원',
          text: '발표 전에요. 발표 뒤에 맺으면 그날 창구에는 못 씁니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.liquidity],
    },
    {
      id: 't1-data-backstop',
      kind: 'data',
      time: '15:00',
      title: '유동성 백스톱 현황',
      rows: [
        { label: '약정 누계', value: '{{metric:backstopTotal}}' },
        { label: '잔여', value: '{{metric:backstopRemaining}}' },
        { label: '저축은행계정 가용재원', value: '{{metric:usableReserves}}' },
        { label: '정리재원 커버리지', value: '{{metric:guidottiRatio}}' },
      ],
      relatedMetrics: ['backstopTotal', 'usableReserves', 'guidottiRatio'],
      sourceRefs: [S.liquidity],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '명단과 정보 관리',
      prompt: '의결 전까지 정지 대상 정보를 어떻게 다루시겠습니까?',
      context:
        '지역에서는 이미 이야기가 돌고 있습니다. 명단이 새어 나가면 정지 직전에 인출이 몰리고, 그 인출은 나중에 누가 무엇을 알았는지에 대한 질문이 됩니다.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't1-d1-a',
          label: '의결 직전까지 비공개하고 사전 통보는 법정 최소 범위로 한정한다',
          description:
            '해당 기관에 대한 통보는 의결 절차가 요구하는 범위에서만 한다. 대외적으로는 "검사 진행 중"이라고만 답한다.',
          effects: [flag('list_confidential')],
          expert: {
            rating: 60,
            rationale:
              '원칙적으로 맞는 처리다. 다만 비공개만으로는 이미 시작된 인출을 막지 못하고, 사후에 "그럼에도 왜 새어 나갔는가"라는 질문에 답할 기록이 남지 않는다.',
            historicalNote:
              '영업정지 직전의 예금 인출은 이후 국정조사와 수사에서 다루어진 사실이다.',
            sourceRefs: [S.inquiry],
          },
          consequences:
            '명단은 대외주의로 관리됩니다. 언론 문의에는 "확인해 드릴 수 없다"로 답합니다.',
          historical: true,
        },
        {
          id: 't1-d1-b',
          label: '감독당국·예보·중앙회 실무진에 명단을 사전 공유해 창구를 준비시킨다',
          description:
            '가지급금 준비와 현금 수송을 미리 배치하려면 실무진이 대상을 알아야 한다. 아는 사람이 늘수록 새어 나갈 경로도 늘어난다.',
          effects: [
            counter('leakRisk', 1),
            sbFx.adjustContagion({
              factor: 1.15,
              reason: '명단 사전 공유 범위 확대',
              groups: ['busan'],
              label: '명단 공유',
            }),
          ],
          expert: {
            rating: 35,
            rationale:
              '운영상의 이점은 실재하지만, 정지 직전 인출은 이 사태에서 가장 무거운 쟁점이 되었다. 준비는 대상을 특정하지 않고도 할 수 있다 — 현금 수송과 가지급금 시스템은 명단 없이 예열할 수 있다.',
            sourceRefs: [S.inquiry],
          },
          consequences:
            '실무 준비는 빨라졌습니다. 저녁에 지역 언론이 "복수의 계열사"라는 표현을 쓰기 시작했습니다.',
        },
        {
          id: 't1-d1-c',
          label: '정지 대상과 시점을 미리 공표해 예금자가 대비하게 한다',
          description: '어차피 알려질 일이라면 먼저 알린다. 예금자에게 준비할 시간을 준다.',
          effects: [
            sbFx.adjustContagion({
              factor: 1.45,
              reason: '정지 대상 사전 공표',
              label: '사전 공표',
            }),
            confidence(-8, '정지 대상 사전 공표'),
          ],
          expert: {
            rating: 20,
            rationale:
              '사전 공표는 "대비할 시간"이 아니라 "먼저 빼낼 시간"을 준다. 먼저 움직일 수 있는 예금자와 그렇지 못한 예금자 사이에 손실이 재분배되고, 정지 시점의 잔여 자산은 더 줄어 대지급 소요가 커진다.',
            sourceRefs: [S.finAct, S.dpAct],
          },
          consequences:
            '공표 직후 해당 지점 앞에 줄이 섰습니다. 정지 시점의 잔여 예금이 빠르게 줄고 있습니다.',
          trap: true,
          trapExplanation:
            '"투명성"으로 보이지만 실제로는 정보를 먼저 아는 쪽에 유리한 거래 창을 여는 것이다. 영업정지는 예고하는 제도가 아니다.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't1-d1-d',
          label: '명단은 비공개하되 정지 직전 대량 인출을 기록·사후 검사 대상으로 지정한다',
          description:
            '계좌 단위 인출 동향을 의결 전부터 시간별로 기록하고, 기준 이상 인출에 대해서는 영업정지 직후 검사에 착수한다는 방침을 내부 지침으로 확정한다.',
          effects: [
            flag('list_confidential'),
            flag('preclosure_withdrawal_watch'),
            counter('withdrawalWatch', 1),
          ],
          expert: {
            rating: 85,
            rationale:
              '비공개는 유출을 완전히 막지 못한다. 막지 못할 것을 전제로 **기록을 남기는 것**이 차선이자 실제로 필요한 조치였다 — 정지 직전 인출은 이후 국정조사와 수사의 핵심 쟁점이 되었고, 그때 필요한 것은 당시의 계좌별 시간대별 기록이었다. 기록이 있으면 사실 확인이 되고, 없으면 의혹만 남는다.',
            sourceRefs: [S.inquiry, S.msbAct],
          },
          consequences:
            '계좌별 인출 기록을 시간 단위로 보존하도록 지시했습니다. 검사국이 사후 점검 계획을 준비합니다.',
          feasibility: {
            basis: '상호저축은행법상 검사권에 근거한 거래기록 확보 및 사후 검사',
            sourceRefs: [S.msbAct],
          },
        },
      ],
    },
    {
      id: 't1-d2',
      title: '대지급 재원',
      prompt: '예금대지급 재원을 어디서 마련하시겠습니까?',
      context:
        '저축은행계정은 이미 결손입니다. 가용재원 4.8조원으로 향후 1년 예상 소요 12조원을 감당할 수 없습니다. 재원을 늘리는 방법은 모두 시간이 걸립니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't1-d2-a',
          label: '가지급금 제도를 준비하고 예보채 발행 한도를 확인한다',
          description:
            '정지 직후 예금자에게 지급할 가지급금(한도 내 선지급) 절차와 전산을 점검하고, 예금보험공사의 채권 발행 여력을 확인한다.',
          effects: [flag('payout_ready'), counter('payoutPrep', 1)],
          expert: {
            rating: 65,
            rationale:
              '반드시 해야 하는 준비이고 실제로 이루어졌다. 다만 이것만으로는 재원의 크기가 달라지지 않는다 — 절차를 준비하는 것과 돈을 만드는 것은 다른 문제다.',
            historicalNote: '가지급금은 영업정지 며칠 뒤부터 한도 내에서 지급되었다.',
            sourceRefs: [S.dpAct, S.diagnosis],
          },
          consequences: '가지급금 지급 절차와 전산이 점검되었습니다.',
          historical: true,
        },
        {
          id: 't1-d2-b',
          label: '예금보험기금 계정 간 차입으로 즉시 재원을 확보한다',
          description:
            '다른 계정의 여유 재원을 저축은행계정이 차입한다. 즉시 쓸 수 있지만 갚아야 하고, 다른 업권이 부담을 나눈다는 논쟁이 시작된다.',
          effects: [
            sbFx.specialAccount({
              stage: 'none',
              draw: 1.0,
              label: '예금보험기금 계정 간 차입 1조원',
            }),
            flag('interfund_borrowing'),
          ],
          expert: {
            rating: 68,
            rationale:
              '가장 빠른 재원이다. 다만 계정 간 차입은 상환 의무가 있고, 다른 업권 부보기관의 보험료로 저축은행 부실을 메운다는 문제 제기를 부른다 — 그 논쟁은 두 달 뒤 특별계정 설계에서 정면으로 다뤄지게 된다.',
            sourceRefs: [S.dpAct, S.dpAct2011],
          },
          consequences:
            '계정 간 차입 1조원이 집행되었습니다. 타 업권 협회가 의견서를 보내왔습니다.',
        },
        {
          id: 't1-d2-c',
          label: '재원 문제는 정지 이후에 다룬다',
          description: '지금은 정지 자체에 집중한다. 재원은 소요가 확정된 뒤에 논의한다.',
          effects: [confidence(-2, '재원 대책 부재')],
          expert: {
            rating: 25,
            rationale:
              '정지는 재원을 쓰는 행위다. 쓸 돈을 정하지 않고 쓰기 시작하면, 두 번째 정지에서 "돈이 없다"는 이유로 결정이 왜곡된다 — 유예의 유혹이 가장 강해지는 순간이 바로 그때다.',
            sourceRefs: [S.dpAct],
          },
          consequences: '재원 논의는 다음으로 미뤄졌습니다.',
          trap: true,
          trapExplanation:
            '"소요가 확정된 뒤에 재원을 논의한다"는 순서가 자연스러워 보인다. 그러나 재원이 없다는 사실은 다음 정지 여부의 판단에 조용히 개입하고, 그때 유예의 유혹이 가장 강해진다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't1-d2-d',
          label: '예금자보호법 개정으로 저축은행 구조조정 특별계정 설치를 즉시 착수한다',
          description:
            '예금보험기금 안에 한시적인 특별계정을 두고, 전 업권 보험료의 일정 비율을 전입시키는 법 개정을 지금 발의한다. 국회 심의에 최소 한 달 이상이 걸린다.',
          effects: [
            sbFx.specialAccount({ stage: 'requested', label: '구조조정 특별계정 입법 착수' }),
            flag('special_account_requested'),
          ],
          expert: {
            rating: 88,
            rationale:
              '실제로 만들어진 해법을 한 달 앞당기는 것이다. 예금자보호법은 2011년 3월 29일 공포·4월 1일 시행으로 상호저축은행 구조조정 특별계정을 설치했고, 그 재원은 정부 출연금과 전 업권 보험료의 45%였다. 입법은 시간이 걸리므로 착수 시점이 곧 재원의 도착 시점이다.',
            sourceRefs: [S.dpAct2011],
          },
          consequences:
            '개정안 초안이 준비되었습니다. 타 업권은 "왜 우리가 부담하는가"를 묻기 시작했습니다.',
          feasibility: {
            basis: '예금자보호법 개정 사항 — 국회 심의 필요',
            sourceRefs: [S.dpAct2011],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '막지 못할 유출이라면, 최소한 기록은 남기십시오. 사후에 사실을 확인할 수 있는 유일한 방법입니다.',
    },
    {
      level: 3,
      decisionId: 't1-d2',
      text: '입법은 착수한 날이 아니라 시행된 날에 돈이 됩니다. 지금 시작하면 4월에 씁니다.',
      cardRefs: ['korea-crisis-toolkit'],
    },
  ],
  relatedCards: ['crisis-communication', 'korea-crisis-toolkit'],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2011-02-17 (목) "영업정지 명령" · 틱 5
// ---------------------------------------------------------------------------------------------

/**
 * T2.D1 관계기관 합동 발표 문안 (3단계). 대사는 2011-02-17 금융위원회 「정부 입장」 발표문과 같은 날
 * 유동성 지원 보도자료의 공개 기록을 바탕으로 한 **재구성**이며 속기록이 아니다.
 *
 * 약속한 백스톱 규모는 `pledgedBackstopTn`, 추가 정지에 대한 약속 범위는 `pledgedNoSuspensionDays`로
 * 이산화되고, **이행 여부는 다음 턴의 지연효과가 판정한다** — calibration.md §7.
 */
const t2AnnouncementSteps: DialogueStep<CentralBankState>[] = [
  {
    id: 't2-d1-forum',
    lines: [
      {
        speaker: '금융위원회 대변인실',
        text: '오후 발표 형식을 지금 확정해야 자료가 나갑니다. 금융위 단독으로 갈지, 기획재정부·한국은행·예금보험공사와 같은 자리에 설지 정해 주십시오.',
      },
    ],
    replies: [
      {
        id: 'forum-joint',
        label: '관계기관 합동 발표로 연다',
        next: 't2-d1-backstop',
        expert: {
          rating: 85,
          rationale:
            '유동성 백스톱은 금융위가 혼자 만든 것이 아니다. 중앙회·정책금융공사·은행·증권금융이 각자 약정한 금액이므로, 같은 자리에서 각자 말하는 것 자체가 검증 가능한 신호가 된다.',
        },
      },
      {
        id: 'forum-fsc-only',
        label: '금융위원회 단독 발표로 간다',
        next: 't2-d1-backstop',
        expert: {
          rating: 45,
          rationale:
            '의사결정 주체가 명확하다는 장점은 있으나, 백스톱의 실행 주체가 빠진 발표는 "그 돈이 정말 나오느냐"는 질문을 남긴다.',
        },
      },
      {
        id: 'forum-silent',
        label: '의결 사실만 게시하고 별도 발표는 하지 않는다',
        resolvesTo: 't2-d1-c',
        expert: {
          rating: 35,
          rationale: '정보 공백은 지역 언론과 창구의 소문이 채운다.',
        },
      },
    ],
  },
  {
    id: 't2-d1-backstop',
    lines: [
      {
        speaker: '기획재정부 차관보',
        text: '첫 질문은 "잔여 저축은행은 괜찮으냐"일 겁니다. 유동성 지원 규모를 숫자로 말해야 하는데, 지금 문서로 맺힌 것과 말할 수 있는 것이 다를 수 있습니다. 어느 숫자를 쓰시겠습니까.',
      },
    ],
    note: '여기서 말한 규모는 다음 영업일에 "그중 오늘 실제로 나간 돈은 얼마입니까"로 검증됩니다.',
    replies: commitReplies<CentralBankState>('pledgedBackstopTn', [3, 6, 12], {
      unit: '조원',
      label: (v) =>
        v === 3
          ? '중앙회 지급준비예탁금 3조원만 말한다'
          : v === 6
            ? '중앙회 3조 + 크레딧라인 2조 + 증권금융 1조 = 6조원으로 말한다'
            : '필요하면 12조원까지 늘릴 수 있다고 말한다',
      next: 't2-d1-promise',
      expert: (v) => ({
        rating: v === 6 ? 85 : v === 3 ? 50 : 30,
        rationale:
          v === 6
            ? '실제 발표가 쓴 숫자이자 문서로 맺힌 숫자다. 구성(3조 + 2조 + 1조)까지 함께 말할 수 있으면 검증 가능하다.'
            : v === 3
              ? '틀린 말은 아니지만 확보한 여력을 과소 공표해 "그것뿐이냐"는 반문을 부른다.'
              : '맺히지 않은 금액을 말하는 것이다. 다음 날 "그 12조는 어디 있습니까"라는 질문에 답할 문서가 없다.',
      }),
    }),
  },
  {
    id: 't2-d1-promise',
    lines: [
      {
        speaker: '금융감독원 부원장보',
        text: '남은 것은 "추가로 문 닫을 곳이 있느냐"입니다. 계열 나머지 세 곳의 검사는 끝나지 않았습니다. 무엇을 어디까지 말하시겠습니까.',
      },
    ],
    note: '검사는 아직 진행 중이며, 여기서 한 약속은 다음 라운드에 그대로 시험받습니다.',
    replies: [
      ...commitReplies<CentralBankState>('pledgedNoSuspensionDays', [0, 30, 120], {
        label: (v) =>
          v === 0
            ? '추가 정지 여부는 검사 결과에 달렸다고만 말한다'
            : v === 30
              ? '한 달 안에는 추가 정지가 없을 것으로 본다고 말한다'
              : '과도한 인출이 없는 한 상반기 중 추가 정지는 없을 것이라고 말한다',
        resolvesTo: (v) => (v === 0 ? 't2-d1-a' : v === 30 ? 't2-d1-c' : 't2-d1-b'),
        expert: (v) => ({
          rating: v === 0 ? 88 : v === 30 ? 55 : 20,
          rationale:
            v === 0
              ? '검사가 끝나지 않았다는 사실을 그대로 말하면 어떤 결과가 나와도 발표가 뒤집히지 않는다. 오늘의 줄은 조금 길어지고, 모레의 신뢰는 남는다.'
              : v === 30
                ? '기간을 좁히면 위험도 좁아지지만, 조건부 약속이라는 성질은 그대로다.'
                : '오늘의 줄을 가장 빨리 줄이는 말이다. 그러나 계열 세 곳의 검사가 끝나지 않은 상태에서 상반기를 약속하는 것은, 인출이 계속되면 스스로 깨야 하는 약속이다.',
        }),
        trap: (v) => v === 120,
        trapExplanation: (v) =>
          v === 120
            ? '"과도한 인출이 없는 한"이라는 단서가 안전장치처럼 보인다. 그러나 그 단서는 곧 발동 조건이 된다 — 인출이 계속되면 약속을 깨야 하고, 약속을 깨는 순간 이전 발표의 신뢰까지 함께 무너진다. 2011년 2월 19일 추가 정지의 사유가 바로 "2.17 이후 예금인출 사태가 계속되었다"는 것이었다.'
            : undefined,
      }),
      {
        id: 'promise-full-protection',
        label: '5천만원 초과 예금과 후순위채까지 구제를 검토하겠다고 말한다',
        resolvesTo: 't2-d1-d',
        expert: {
          rating: 12,
          rationale:
            '법적 근거가 없는 약속이다. 예금자보호법의 보호 대상은 1인당 원리금 5천만원이며 초과분과 후순위채는 보호 대상이 아니다.',
        },
        trap: true,
        trapExplanation:
          '오늘의 줄을 가장 확실하게 줄이는 말이지만, 법을 바꾸지 않으면 지킬 수 없다. 지키지 못하면 다음 라운드의 예금자는 "이번에도 말만 할 것"이라고 가정하고, 지키면 이후 모든 정리에서 초과 예금 보전이 기본값이 된다.',
      },
    ],
  },
]

/** 14:00 발표 직후 걸려 오는 업계 전화. 대사는 재구성이며 실제 통화가 아니다. */
const t2PeerCall: Interrupt<CentralBankState> = {
  id: 't2-i1-peer',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't2-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '다른 저축은행 대표의 전화',
  prompt: '정지 대상이 아닌 저축은행 대표가 직접 연결을 요청했습니다. 어떻게 답하시겠습니까?',
  dimensions: ['communication'],
  source: { kind: 'call', caller: '수도권 저축은행 대표', tone: 'urgent' },
  lines: [
    {
      speaker: '수도권 저축은행 대표',
      text: '오늘 저희 창구에도 줄이 섰습니다. 한 시간에 평소 하루치가 나갑니다. 저희가 정지 대상이 아니라는 것만 확인해 주시면 됩니다. 한 마디면 됩니다.',
    },
  ],
  options: [
    {
      id: 't2-i1-a',
      label: '지원 창구의 존재를 확인해 주되 개별 기관에 대한 확인은 하지 않는다',
      description:
        '중앙회 지급준비예탁금과 크레딧라인의 구조를 설명하고, 유동성 요청 절차를 안내한다. 개별 기관의 정지 여부는 확인해 주지 않는다.',
      effects: [counter('peerCallsHandled', 1), flag('peer_channel_open')],
      expert: {
        rating: 65,
        rationale:
          '감독당국이 개별 기관의 안전을 보증하는 순간 그 보증은 모든 기관에 대해 요구된다. 창구의 존재를 말하는 것은 검증 가능하고, 개별 기관을 말하는 것은 검증할 수 없다.',
        sourceRefs: [S.liquidity, S.stance],
      },
      consequences: '지원 절차를 안내했습니다. 대표는 "그걸로는 오늘 줄이 안 줄어든다"고 했습니다.',
      historical: true,
    },
    {
      id: 't2-i1-b',
      label: '귀 기관은 정지 대상이 아니라고 확인해 준다',
      description: '전화 한 통으로 오늘의 줄을 줄인다.',
      effects: [counter('individualAssurance', 1), flag('individual_assurance_given')],
      expert: {
        rating: 15,
        rationale:
          '개별 확인은 확인받지 못한 모든 기관을 정지 대상으로 만든다. 그리고 그 기관이 나중에 정지되면, 확인해 준 사실 자체가 감독당국의 신뢰를 무너뜨린다.',
        sourceRefs: [S.stance],
      },
      consequences: '확인해 주었습니다. 30분 뒤 다른 두 곳에서 같은 요청이 들어왔습니다.',
      trap: true,
      trapExplanation:
        '한 마디로 한 곳의 줄을 줄이는 대신, 확인받지 못한 나머지의 줄을 늘린다. 감독당국의 개별 보증은 나눠 줄 수 없는 자원이다.',
      remediationCard: 'crisis-communication',
    },
    {
      id: 't2-i1-c',
      label: '검사 결과가 나오기 전에는 어떤 확인도 할 수 없다고만 답한다',
      description: '원칙만 말하고 통화를 끝낸다.',
      effects: [
        counter('peerCallsHandled', 1),
        sbFx.adjustContagion({
          factor: 1.05,
          reason: '업계 문의에 대한 무응답',
          groups: ['peer'],
          label: '업계 응대 부재',
        }),
      ],
      expert: {
        rating: 45,
        rationale:
          '틀린 답은 아니지만, 지원 창구가 열려 있다는 사실조차 전하지 않으면 업계는 "당국이 손을 놓았다"로 읽는다.',
        sourceRefs: [S.liquidity],
      },
      consequences:
        '통화가 짧게 끝났습니다. 업계 게시판에 "당국은 아무 말도 안 한다"가 올라왔습니다.',
    },
  ],
}

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2011년 2월 17일 (목)',
  title: '영업정지 명령',
  time: '2011-02-17T09:00:00+09:00',
  ticks: 5,
  tickLabels: T2_TICK_LABELS,
  entryEffects: [
    {
      id: 't2-decay',
      description: '전염 계수 감쇠',
      effects: [sbFx.decaySpill()],
    },
    {
      id: 't2-market',
      description: '개장 앵커: 국고채 3년 3.93%, 회사채 AA− 4.71%, KOSPI 1,989.11, 원/달러 1,120.3',
      effects: [
        op('market.custom.govt3y', 'set', 393, '국고채 3년 개장 앵커'),
        op('market.custom.corpAa3y', 'set', 471, '회사채 AA− 3년 개장 앵커'),
        op('market.equityIndex', 'set', 1989.11, 'KOSPI 개장 앵커'),
        op('market.fxUsdLocal', 'set', 1120.3, '원/달러 개장 앵커'),
      ],
    },
    {
      id: 't2-suspend-partial',
      when: { flag: 'scope_partial' },
      description: '부산·대전 2개사 영업정지 (07:30 임시회의 의결)',
      effects: [
        sbFx.suspend({
          group: 'busan',
          count: 2,
          deposits: 2.6,
          excessDeposits: 0.098,
          subDebt: 0.07,
          payout: 1.6,
          label: '부산·대전 영업정지',
        }),
      ],
    },
    {
      id: 't2-suspend-group',
      when: { flag: 'scope_group' },
      description: '부산 계열 5개사 동시 영업정지',
      effects: [
        sbFx.suspend({
          group: 'busan',
          count: 5,
          deposits: 6.5,
          excessDeposits: 0.1613,
          subDebt: 0.1132,
          payout: 2.6,
          label: '부산 계열 5개사 동시 영업정지',
        }),
      ],
    },
    {
      id: 't2-suspend-wide',
      when: { flag: 'scope_wide' },
      description: '부산 계열 5개사 + BIS 5% 미만 8개사 일괄 영업정지',
      effects: [
        sbFx.suspend({
          group: 'busan',
          count: 5,
          deposits: 6.5,
          excessDeposits: 0.1613,
          subDebt: 0.1132,
          payout: 2.6,
          label: '부산 계열 5개사 영업정지',
        }),
        sbFx.suspend({
          group: 'peer',
          count: 8,
          deposits: 4.2,
          excessDeposits: 0,
          subDebt: 0,
          payout: 1.9,
          label: 'BIS 5% 미만 8개사 영업정지',
        }),
      ],
    },
    {
      id: 't2-forbear-leak',
      when: { flag: 'scope_forbear' },
      description: '유예 사실이 알려지며 계열 창구 인출 급증 — 전염 ×1.6, 신뢰지수 −6',
      effects: [
        sbFx.adjustContagion({
          factor: 1.6,
          reason: '자본잠식 기관에 대한 조치 부재',
          groups: ['busan'],
          label: '유예 노출',
        }),
        confidence(-6, '조치 없이 유예했다는 보도'),
      ],
    },
    {
      id: 't2-backstop-lateadd',
      when: { flag: 'backstop_partial' },
      description: '발표 당일 크레딧라인 협의 — 1.5조원만 추가 확보(총 4.5조원)',
      effects: [sbFx.backstop({ amount: 1.5, label: '당일 협의로 추가 확보한 크레딧라인' })],
    },
  ],
  eachTick: [
    {
      id: 't2-runoff-tick',
      description: '2/17 창구 인출 (발표 직후 집중)',
      effects: [sbFx.runoffStep({ days: 1, profile: T2_QUEUE_PROFILE, label: '2/17 인출' })],
    },
  ],
  ticker: {
    series: [
      // 국고채 3년 2/16 3.93% → 2/17 3.96% [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [393, 394, 395, 397, 396] },
      // 회사채 AA− 3년 2/16 4.71% → 2/17 4.74% [ecos-817Y002]
      { path: 'market.custom.corpAa3y', mode: 'absolute', values: [471, 472, 473, 474, 474] },
      // KOSPI 2/16 1,989.11 → 2/17 1,977.22 [ecos-802Y001]
      {
        path: 'market.equityIndex',
        mode: 'absolute',
        values: [1989.11, 1985.0, 1979.5, 1977.22, 1977.22],
      },
      // 원/달러 2/16 1,120.3 → 2/17 1,117.4 (종가 15:30) [ecos-731Y003]
      {
        path: 'market.fxUsdLocal',
        mode: 'absolute',
        values: [1120.3, 1119.6, 1118.4, 1117.4, 1117.4],
      },
    ],
  },
  events: [
    {
      id: 't2-reg-decision',
      kind: 'regulator',
      agency: '금융위원회',
      time: '07:30',
      atTick: 0,
      headline: '임시회의 — 부실금융기관 결정 및 경영개선명령(영업정지)',
      body: '오전 7시 30분 임시회의에서 부실금융기관 결정과 영업정지 명령이 의결되었습니다. 영업정지 기간은 6개월이며 임원 직무집행정지와 관리인 선임이 함께 이루어집니다. 만기도래 어음·대출의 기일연장 등 일부 업무는 정지 대상에서 제외됩니다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.busan, S.finAct, S.msbAct],
      relatedMetrics: ['failedBanks', 'usableReserves'],
    },
    {
      /**
       * The correction to `t1-rumor-branch`, and the uncomfortable one: the rumour was **right**.
       *
       * "내일 문 닫는다" was unverified when it spread, and the next morning two of the five did
       * close. A scenario that only ever corrects rumours *downwards* teaches players to discount
       * them; this one has to teach the harder thing, which is that an unverified claim the
       * authorities will not confirm is not therefore false — and that the silence itself is what
       * made the queue grow overnight.
       */
      id: 't2-news-rumour-confirmed',
      kind: 'newswire',
      outlet: '통신사',
      time: '08:10',
      atTick: 0,
      headline: '[확인] 어제 돌던 "내일 문 닫는다"는 사실이었다 — 계열 2개사 영업정지',
      body:
        '어제 지점 앞에서 돌던 이야기는 오늘 아침 사실로 확인됐다. 다만 대상은 계열 전체가 아니라 ' +
        '2개사이며, 나머지 계열사는 정상 영업 중이다. 어제 시점에 이를 확인해 줄 수 있는 곳은 ' +
        '없었고, 그 사이 대기 행렬은 밤새 길어졌다.',
      severity: 'critical',
      reliability: 'confirmed',
      correctionOf: 't1-rumor-branch',
      sourceRefs: [S.busan],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      id: 't2-news-queue',
      kind: 'newswire',
      outlet: '지역 방송·통신사',
      time: '11:20',
      atTick: 1,
      headline: '영업정지 지점 앞 예금자 수백 명 — "5천만원 넘는 돈은 어떻게 되나"',
      body: '정지된 지점 셔터 앞에 예금자들이 모였다. 예금자보호법상 보호 한도는 1인당 원리금 5천만원이며, 초과분과 후순위채는 보호 대상이 아니다. 계열 다른 지점에도 문의가 몰리고 있다.',
      severity: 'critical',
      sourceRefs: [S.dpAct],
      cardRefs: ['uninsured-deposits-and-run-speed', 'bank-run-dynamics'],
    },
    {
      id: 't2-data-flow',
      kind: 'data',
      time: '16:00',
      atTick: 3,
      title: '창구 마감 집계',
      rows: [
        { label: '당일 인출', value: '{{metric:outflowToday}}' },
        { label: '누적 인출', value: '{{metric:depositOutflowCum}}' },
        { label: '계열 잔여 수신', value: '{{metric:depBusan}}' },
        { label: '전염 계수(계열)', value: '{{metric:spillBusan}}' },
        { label: '백스톱 잔여', value: '{{metric:backstopRemaining}}' },
      ],
      severity: 'warning',
      relatedMetrics: ['outflowToday', 'depBusan', 'spillBusan', 'backstopRemaining'],
      sourceRefs: [S.ecosDep],
    },
    {
      id: 't2-market-close',
      kind: 'market',
      time: '18:00',
      atTick: 4,
      headline: '시장 마감',
      items: [
        { label: '국고채 3년', value: '3.96%', change: '+3bp' },
        { label: '회사채 AA− 3년', value: '4.74%', change: '+3bp' },
        { label: 'KOSPI', value: '1,977.22', change: '−0.6%' },
        { label: '원/달러', value: '1,117.4', change: '−2.9원' },
      ],
      sourceRefs: [S.ecosRate, S.ecosEq, S.ecosFx],
    },
  ],
  decisions: [
    {
      id: 't2-d2',
      title: '창구와 백스톱 집행',
      prompt: '오늘 잔여 저축은행 창구를 무엇으로 받치시겠습니까?',
      context:
        '정지된 곳의 셔터는 내려갔습니다. 문제는 열려 있는 곳입니다. 창구 현금은 오전 중에 배차해야 마감까지 닿습니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['liquidity', 'communication'],
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't2-d2-a',
      timeLimitSec: 120,
      options: [
        {
          id: 't2-d2-a',
          label: '중앙회 지급준비예탁금을 방출하고 현금 수송을 늘린다',
          description:
            '지급준비예탁금의 95% 콜과 200% 유동성콜 절차를 가동하고, 요청 기관에 현금 수송을 배차한다. 효과는 다음 영업일 창구에서 드러난다.',
          effects: [flag('cash_delivery'), counter('cashDelivery', 1)],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '현금 수송·예탁금 방출로 다음 영업일 창구 대기 완화 (완화 ×0.92)',
              effects: [
                sbFx.setDampener({
                  factor: 0.92,
                  reason: '창구 현금 공급',
                  label: '현금 수송 효과',
                }),
              ],
            },
          ],
          expert: {
            rating: 70,
            rationale:
              '중앙회의 3단계 지원체계가 존재하는 이유다. 모든 창구에서 지급이 정시에 이루어진다는 사실만이 "못 받을 수 있다"는 런의 전제를 무너뜨린다.',
            historicalNote:
              '저축은행중앙회의 차입한도는 같은 날 0.6조원에서 3조원으로 확대 승인되었다.',
            sourceRefs: [S.liquidity],
          },
          consequences: '현금 수송이 배차되었습니다. 마감까지 지급 지연 보고는 없습니다.',
          historical: true,
        },
        {
          id: 't2-d2-b',
          label: '가지급금 지급 일정을 같은 날 함께 공표한다',
          description:
            '정지된 기관 예금자에게 며칠 뒤부터 한도 내 가지급금을 지급한다는 일정과 절차를 발표 자료에 함께 담는다. 열려 있는 창구에는 지급준비예탁금을 방출한다.',
          effects: [flag('cash_delivery'), flag('payout_schedule'), counter('cashDelivery', 1)],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '지급 일정 공표로 다음 영업일 대기 완화 (완화 ×0.85, 신뢰지수 +4)',
              effects: [
                sbFx.setDampener({
                  factor: 0.85,
                  reason: '가지급금 일정 공표',
                  label: '지급 일정 효과',
                }),
                confidence(4, '가지급금 지급 일정이 날짜로 제시됨'),
              ],
            },
          ],
          expert: {
            rating: 85,
            rationale:
              '예금자가 창구에 서는 이유는 돈이 없어질까 봐가 아니라 **언제 받을지 모르기 때문**이다. 날짜가 있으면 줄이 짧아진다. 가지급금 제도는 이미 법에 있었고, 실제로 9월 정지에서는 D+4일부터 한도 내 지급이 이루어졌다.',
            sourceRefs: [S.dpAct, S.diagnosis],
          },
          consequences:
            '지급 일정이 발표 자료에 들어갔습니다. 콜센터 문의의 절반이 "언제 받느냐"에서 "어디서 받느냐"로 바뀌었습니다.',
        },
        {
          id: 't2-d2-c',
          label: '백스톱 집행을 유보하고 인출 동향을 하루 더 본다',
          description: '지원 여력을 아껴 둔다. 요청이 오면 심사 후 집행한다.',
          effects: [
            sbFx.adjustContagion({
              factor: 1.15,
              reason: '지원 집행 유보',
              groups: ['peer', 'sound'],
              label: '집행 유보',
            }),
          ],
          expert: {
            rating: 25,
            rationale:
              '백스톱은 아껴서 커지는 자원이 아니다. 쓰이지 않는 백스톱은 존재하지 않는 백스톱으로 읽히고, 그 인식이 다음 날의 인출을 키운다.',
            sourceRefs: [S.liquidity, S.bcbs],
          },
          consequences: '집행이 유보되었습니다. 두 곳에서 오후 늦게 현금 부족을 보고했습니다.',
        },
        {
          id: 't2-d2-d',
          label: '정지 기관 예금자의 인출을 당분간 제한한다고 안내한다',
          description: '가지급금 지급 전까지 창구 응대를 중단해 혼란을 줄인다.',
          effects: [
            sbFx.unsafeAct({
              reason: '법적 근거 없는 지급 제한 안내',
              label: '지급 제한 안내',
            }),
          ],
          expert: {
            rating: 0,
            rationale:
              '영업정지된 기관의 예금 지급은 예금자보호법이 정한 절차(가지급금·보험금)로 이루어진다. 그 절차 밖에서 "제한한다"고 안내하는 것은 법이 허용하지 않으며, 안내문이 사진으로 퍼지는 순간 업권 전체의 지급능력이 의심받는다.',
            sourceRefs: [S.dpAct, S.finAct],
          },
          consequences:
            '안내문이 붙었습니다. 몇 시간 뒤 국회와 언론이 법적 근거를 묻기 시작했습니다.',
          trap: true,
          trapExplanation:
            '"혼란을 줄인다"는 명분이지만, 지급 절차를 당국이 임의로 멈추는 순간 예금자보호 제도 자체가 의심받는다. 즉시 최고 대응 단계로 올라간다.',
          illegal: true,
          irreversible: true,
          remediationCard: 'regulator-escalation-ladder',
        },
      ],
    },
    {
      id: 't2-d1',
      title: '관계기관 합동 발표 문안',
      prompt: '오후 발표에서 무엇을 어디까지 약속하시겠습니까?',
      context:
        '발표문은 오늘의 줄을 줄이는 도구이면서, 다음 라운드의 시장 기대를 정하는 문서이기도 합니다. 계열 나머지 세 곳의 검사는 끝나지 않았습니다.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'policy'],
      select: { min: 1, max: 1 },
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't2-d1-b',
      steps: t2AnnouncementSteps,
      options: [
        {
          id: 't2-d1-a',
          label: '법이 보장하는 범위와 백스톱 규모만 말한다',
          description:
            '보호 한도(1인당 원리금 5천만원), 가지급금 절차, 유동성 지원 규모와 그 구성만 발표한다. 추가 정지 여부는 검사 결과에 달렸다고 말한다.',
          effects: [sbFx.promiseProtection({ scope: 'legal', label: '법정 범위 공표' })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'pledgedBackstopTn', gte: 12 },
              description: '공표 규모와 실제 약정액의 괴리가 드러남 (신뢰지수 −6, 전염 ×1.2)',
              effects: [
                confidence(-6, '공표한 지원 규모와 실제 약정액의 괴리'),
                sbFx.adjustContagion({ factor: 1.2, reason: '백스톱 규모 과대 공표' }),
              ],
            },
          ],
          expert: {
            rating: 88,
            rationale:
              '약속의 범위를 법이 보장하는 곳에서 멈추면 어떤 검사 결과가 나와도 발표가 뒤집히지 않는다. 오늘의 줄은 조금 더 길지만, 이틀 뒤에 스스로 깨야 할 문장이 없다.',
            sourceRefs: [S.stance, S.dpAct],
          },
          consequences:
            '발표가 끝났습니다. 기자들은 "그래서 추가로 문 닫을 곳이 있느냐"를 세 번 물었고, 같은 답이 세 번 나갔습니다.',
        },
        {
          id: 't2-d1-b',
          label: '"과도한 인출이 없는 한 상반기 추가 정지는 없다"는 단서를 단다',
          description:
            '유동성 지원 규모와 함께, 과도한 예금인출 등이 발생하지 않는 한 금년 상반기 중 부실을 이유로 추가 영업정지를 부과할 곳은 없을 것으로 예상된다고 발표한다.',
          effects: [
            sbFx.promiseProtection({ scope: 'legal', label: '법정 범위 공표' }),
            flag('reassurance_given'),
            counter('reassuranceGiven', 1),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              afterTicks: 3,
              when: {
                all: [
                  { counter: 'pledgedNoSuspensionDays', gte: 30 },
                  { flag: 'more_suspensions' },
                ],
              },
              description:
                '조건부 안심 발언이 이틀 만에 뒤집힘 (신뢰지수 −12, 전염 ×1.35, 발언 붕괴 기록)',
              effects: [
                confidence(-12, '조건부 안심 발언의 붕괴'),
                sbFx.adjustContagion({ factor: 1.35, reason: '추가 정지 없다던 발표가 뒤집힘' }),
                flag('reassurance_contradicted'),
              ],
            },
            {
              afterTurns: 1,
              when: { counter: 'pledgedBackstopTn', gte: 12 },
              description: '공표 규모와 실제 약정액의 괴리가 드러남 (신뢰지수 −6, 전염 ×1.2)',
              effects: [
                confidence(-6, '공표한 지원 규모와 실제 약정액의 괴리'),
                sbFx.adjustContagion({ factor: 1.2, reason: '백스톱 규모 과대 공표' }),
              ],
            },
          ],
          expert: {
            rating: 20,
            rationale:
              '오늘의 줄을 가장 빨리 줄이는 문장이고, 실제로 발표된 문장이다. 그러나 "과도한 인출이 없는 한"이라는 단서는 안전장치가 아니라 발동 조건이었다 — 이틀 뒤 금융위원회는 "2.17 부산·대전 영업정지 이후 예금인출 사태가 계속"되었다는 이유로 4개사를 추가 정지했다.',
            historicalNote:
              '2011년 2월 17일 금융위원회 「정부 입장」의 문장이다. 이 발표는 기관 명의였다.',
            sourceRefs: [S.stance, S.more4],
          },
          consequences:
            '발표가 나갔습니다. 오후 늦게 계열 나머지 지점의 인출 속도가 오히려 빨라졌다는 보고가 들어왔습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '조건부 단서는 스스로 깨질 조건을 문장 안에 담고 있다. 약속을 깨는 순간 잃는 것은 그 약속 하나가 아니라 이전 발표 전체의 신뢰다.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't2-d1-c',
          label: '추가 정지에 대한 언급 없이 지원 규모만 발표한다',
          description:
            '유동성 지원 규모와 가지급금 절차만 말하고 추가 정지 여부는 언급하지 않는다. 짧은 기간에 대한 전망만 덧붙인다.',
          effects: [sbFx.promiseProtection({ scope: 'legal', label: '법정 범위 공표' })],
          delayedEffects: [
            {
              afterTurns: 1,
              afterTicks: 3,
              when: {
                all: [
                  { counter: 'pledgedNoSuspensionDays', gte: 30 },
                  { flag: 'more_suspensions' },
                ],
              },
              description: '한 달 전망이 이틀 만에 뒤집힘 (신뢰지수 −9, 전염 ×1.25)',
              effects: [
                confidence(-9, '추가 정지 전망의 붕괴'),
                sbFx.adjustContagion({ factor: 1.25, reason: '전망이 이틀 만에 뒤집힘' }),
                flag('reassurance_contradicted'),
              ],
            },
          ],
          expert: {
            rating: 60,
            rationale:
              '언급하지 않는 것은 거짓말을 하지 않는 가장 쉬운 방법이지만, 정보 공백은 창구와 지역 언론이 채운다. 짧은 기간을 말하면 위험도 짧아지되 성질은 같다.',
            sourceRefs: [S.stance],
          },
          consequences:
            '발표에 추가 정지에 대한 언급이 빠졌습니다. 기사 제목은 "당국, 추가 정지 여부 함구"로 나갔습니다.',
        },
        {
          id: 't2-d1-d',
          label: '5천만원 초과 예금과 후순위채까지 구제를 시사한다',
          description:
            '보호 한도를 넘는 예금과 후순위채 투자자에 대해서도 구제 방안을 검토하겠다고 발표한다.',
          effects: [sbFx.promiseProtection({ scope: 'full', label: '초과 예금 구제 시사' })],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'protectionPledge', gte: 2 },
              description:
                '법적 근거가 없다는 지적이 제기되고 다음 정지에서 같은 요구가 반복됨 (신뢰지수 −10, 정리소요 확대)',
              effects: [
                confidence(-10, '법적 근거 없는 구제 시사에 대한 지적'),
                op('institution.external.shortTermDebt', 'mul', 1.15, '구제 기대에 따른 소요 확대'),
              ],
            },
          ],
          expert: {
            rating: 12,
            rationale:
              '예금자보호법의 보호 대상은 1인당 원리금 5천만원이고 초과분과 후순위채는 보호 대상이 아니다. 법을 바꾸지 않으면 지킬 수 없는 약속이며, 지키면 이후 모든 정리에서 같은 요구가 기본값이 된다.',
            sourceRefs: [S.dpAct, S.excess],
          },
          consequences:
            '오늘의 줄은 눈에 띄게 짧아졌습니다. 저녁에 "법적 근거가 무엇이냐"는 질의가 들어왔습니다.',
          trap: true,
          trapExplanation:
            '가장 효과가 즉각적인 말이자 가장 되돌리기 어려운 말이다. 보호 대상이 아닌 것을 보호하겠다고 말하는 순간, 다음 정리의 기준선이 바뀐다.',
          remediationCard: 'uninsured-deposits-and-run-speed',
        },
      ],
    },
  ],
  interrupts: [t2PeerCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '오늘의 줄을 가장 빨리 줄이는 문장과, 이틀 뒤에도 참인 문장은 다릅니다.',
    },
    {
      level: 2,
      decisionId: 't2-d2',
      text: '예금자가 창구에 서는 이유는 대개 "언제 받는지 모르기 때문"입니다. 날짜를 주십시오.',
      cardRefs: ['crisis-communication'],
    },
  ],
  relatedCards: ['crisis-communication', 'bank-run-dynamics', 'uninsured-deposits-and-run-speed'],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2011-02-18 (금) ~ 02-21 (월) "인출이 옮겨 가다" · 틱 5
// ---------------------------------------------------------------------------------------------

/** 금요일 저녁 예금보험공사 담당 임원의 전화. 대사는 재구성이며 실제 통화가 아니다. */
const t3KdicCall: Interrupt<CentralBankState> = {
  id: 't3-i1-kdic',
  interrupt: true,
  atTick: 1,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't3-i1-a',
  scoreWeight: 0.5,
  required: false,
  title: '예금보험공사 담당 임원',
  prompt: '추가 정지를 의결하기 전에 재원 문제가 올라왔습니다. 어떻게 처리하시겠습니까?',
  dimensions: ['liquidity', 'compliance'],
  source: {
    kind: 'call',
    caller: '예금보험공사 정리담당 임원',
    agency: '예금보험공사',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '예금보험공사 정리담당 임원',
      text: '내일 아침에 네 곳을 더 정지하면 이번 주에만 가지급금 소요가 다시 나옵니다. 저축은행계정은 이미 결손이고, 지금 남은 재원으로는 다음 라운드를 감당하기 어렵습니다. 재원을 어디서 가져올지 오늘 정해 주셔야 대지급 일정을 잡습니다.',
    },
  ],
  options: [
    {
      id: 't3-i1-a',
      label: '계정 간 차입으로 우선 대응하고 특별계정 입법을 추진한다',
      description:
        '예금보험기금 내 다른 계정에서 차입해 이번 라운드를 감당하고, 저축은행 구조조정 특별계정을 만드는 예금자보호법 개정을 추진한다.',
      effects: [
        sbFx.specialAccount({ stage: 'requested', label: '특별계정 입법 추진' }),
        flag('special_account_requested'),
        counter('interfundBorrow', 1),
      ],
      expert: {
        rating: 70,
        rationale:
          '실제로 간 길이다. 예금자보호법은 한 달 반 뒤 상호저축은행 구조조정 특별계정을 설치했고 재원은 정부 출연금과 전 업권 보험료의 45%였다. 다만 입법이 끝날 때까지의 공백은 계정 간 차입이 메워야 한다.',
        sourceRefs: [S.dpAct2011],
      },
      consequences:
        '계정 간 차입으로 이번 주 소요를 감당하기로 했습니다. 개정안 준비가 시작됩니다.',
      historical: true,
    },
    {
      id: 't3-i1-b',
      label: '대지급 개시를 늦춰 재원 부담을 뒤로 미룬다',
      description: '가지급금 지급 일정을 늦춰 이번 달 소요를 줄인다.',
      effects: [sbFx.unsafeAct({ reason: '법정 절차 밖의 대지급 지연', label: '대지급 지연' })],
      expert: {
        rating: 0,
        rationale:
          '예금보험금과 가지급금의 지급은 예금자보호법이 정한 절차다. 재원이 부족하다는 이유로 지급을 늦추는 것은 제도 자체를 부정하는 행위이며, 알려지는 순간 보호받는 예금까지 인출 대상이 된다.',
        sourceRefs: [S.dpAct],
      },
      consequences: '지급 일정이 미뤄졌습니다. 주말 사이 그 사실이 알려졌습니다.',
      trap: true,
      trapExplanation:
        '"돈이 없으니 나중에"가 가장 현실적으로 들리는 순간이 위험하다. 예금보험은 지급 약속이고, 약속의 이행을 미루면 남는 것은 약속이 아니다.',
      illegal: true,
      irreversible: true,
      remediationCard: 'regulator-escalation-ladder',
    },
    {
      id: 't3-i1-c',
      label: '정부 재정 출연을 즉시 요청한다',
      description: '재정으로 공적자금을 조성해 달라고 요청한다. 국회 동의와 예산 절차가 필요하다.',
      effects: [counter('fiscalRequest', 1), confidence(-2, '재정 투입 논쟁 점화')],
      expert: {
        rating: 45,
        rationale:
          '재원의 크기로는 가장 확실하지만 가장 느리다. 예산 절차와 국회 동의에 걸리는 시간 동안 정리는 멈추지 않는다. 실제 해법은 예금보험기금 안의 특별계정이었고, 정부 출연금은 그 재원의 한 축으로 들어갔다.',
        sourceRefs: [S.dpAct2011],
      },
      consequences: '재정 당국에 요청서를 보냈습니다. "국회 동의가 필요하다"는 회신이 왔습니다.',
    },
    {
      id: 't3-i1-d',
      label: '예보채 발행 한도를 늘려 시장에서 조달한다',
      description:
        '예금보험공사 채권 발행으로 즉시 재원을 만든다. 조달비용이 남고 상환 부담이 뒤에 온다.',
      effects: [
        sbFx.specialAccount({ stage: 'requested', draw: 1.2, label: '예보채 발행 1.2조원' }),
        flag('special_account_requested'),
        counter('bondIssuance', 1),
      ],
      expert: {
        rating: 72,
        rationale:
          '가장 빠르게 재원을 늘리는 현실적인 수단이고, 특별계정 입법과 병행할 수 있다. 다만 발행한 채권은 결국 보험료나 재정으로 갚아야 하므로 부담의 시점만 옮기는 것이다.',
        sourceRefs: [S.dpAct, S.dpAct2011],
      },
      consequences: '예보채 발행 계획이 확정되었습니다. 저축은행계정 가용재원이 늘었습니다.',
    },
  ],
}

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2011년 2월 18일 (금) ~ 2월 21일 (월)',
  title: '인출이 옮겨 가다',
  time: '2011-02-18T14:00:00+09:00',
  ticks: 5,
  tickLabels: T3_TICK_LABELS,
  entryEffects: [
    {
      id: 't3-decay',
      description: '전염 계수 감쇠',
      effects: [sbFx.decaySpill()],
    },
    {
      id: 't3-market',
      description: '개장 앵커: 국고채 3년 3.96%, 회사채 AA− 4.74%, KOSPI 1,977.22, 원/달러 1,117.4',
      effects: [
        op('market.custom.govt3y', 'set', 396, '국고채 3년 2/17 종가'),
        op('market.custom.corpAa3y', 'set', 474, '회사채 AA− 3년 2/17 종가'),
        op('market.equityIndex', 'set', 1977.22, 'KOSPI 2/17 종가'),
        op('market.fxUsdLocal', 'set', 1117.4, '원/달러 2/17 종가'),
        sbFx.refresh('2/17 종가 반영'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't3-runoff-tick',
      description: '2/18 금요일과 2/21 월요일의 창구 인출 (2영업일)',
      effects: [sbFx.runoffStep({ days: 2, profile: T3_QUEUE_PROFILE, label: '2/18~2/21 인출' })],
    },
  ],
  ticker: {
    series: [
      // 국고채 3년 2/17 3.96% → 2/18 3.94% → 2/21 3.96% [ecos-817Y002]
      { path: 'market.custom.govt3y', mode: 'absolute', values: [396, 395, 394, 394, 396] },
      // 회사채 AA− 3년 2/17 4.74% → 2/18 4.73% → 2/21 4.74% [ecos-817Y002]
      { path: 'market.custom.corpAa3y', mode: 'absolute', values: [474, 473, 473, 473, 474] },
      // KOSPI 2/17 1,977.22 → 2/18 2,013.14 → 2/21 2,005.30 [ecos-802Y001]
      {
        path: 'market.equityIndex',
        mode: 'absolute',
        values: [1977.22, 1995.0, 2013.14, 2013.14, 2005.3],
      },
      // 원/달러 2/17 1,117.4 → 2/18 1,112.1 → 2/21 1,118.1 (종가 15:30) [ecos-731Y003]
      {
        path: 'market.fxUsdLocal',
        mode: 'absolute',
        values: [1117.4, 1114.0, 1112.1, 1112.1, 1118.1],
      },
    ],
  },
  events: [
    {
      id: 't3-memo-flow',
      kind: 'memo',
      time: '14:00',
      atTick: 0,
      from: '금융감독원 저축은행검사국',
      to: '금융위원회 중소금융과',
      subject: '어제 발표 이후 인출 동향 (긴급)',
      body: `- 어제 정지되지 않은 **계열 나머지 지점의 인출이 어제보다 빨라졌습니다.** 같은 예금자가 어제는 정지된 지점 앞에, 오늘은 옆 계열사 창구에 서 있습니다.
- 계열 밖 저축은행에도 문의가 늘고 있으나 속도는 계열 쪽이 압도적입니다.
- 현재 계열 잔여 수신은 {{metric:depBusan}}이고, 전염 계수는 {{metric:spillBusan}}입니다.
- 이 속도가 유지되면 다음 주 초에는 계열 잔여사가 지급 요구에 응하기 어려워집니다.`,
      severity: 'critical',
      sourceRefs: [S.more4],
      relatedMetrics: ['depBusan', 'spillBusan', 'outflowBusan'],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      id: 't3-reg-emergency',
      kind: 'regulator',
      agency: '금융위원회',
      time: '17:00',
      atTick: 1,
      headline: '임시회의 소집 — 내일 아침 추가 조치 안건',
      body: '오늘 인출 추이와 유동성, 예금잔액, 외부차입 가능 규모를 종합해 추가 조치 여부를 내일 아침에 결정합니다. 안건은 준비되었습니다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.more4],
    },
    {
      id: 't3-news-saturday',
      kind: 'newswire',
      outlet: '통신사',
      time: '09:30',
      atTick: 3,
      headline: '주말에도 콜센터 문의 폭주 — "이틀 전에는 추가로 없다고 하지 않았나"',
      body: '예금자들은 이틀 전 발표와 오늘의 조치가 어떻게 같이 설명되는지 묻고 있다. 콜센터는 응답률이 절반을 밑돌고 있으며, 월요일 개점 시각에 맞춰 지점 앞에 줄이 설 것으로 보인다.',
      severity: 'critical',
      sourceRefs: [S.more4, S.stance],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't3-data-monday',
      kind: 'data',
      time: '09:30',
      atTick: 4,
      title: '월요일 개점 집계',
      rows: [
        { label: '누적 인출', value: '{{metric:depositOutflowCum}}' },
        { label: '영업정지 누계', value: '{{metric:failedBanks}}' },
        { label: '5천만원 초과 예금(정지 기관)', value: '{{metric:excessDeposits}}' },
        { label: '후순위채(정지 기관)', value: '{{metric:subDebt}}' },
        { label: '저축은행계정 가용재원', value: '{{metric:usableReserves}}' },
        { label: '백스톱 잔여', value: '{{metric:backstopRemaining}}' },
      ],
      severity: 'warning',
      relatedMetrics: ['depositOutflowCum', 'failedBanks', 'excessDeposits', 'usableReserves'],
      sourceRefs: [S.excess, S.ecosDep],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '추가 조치 범위',
      prompt: '내일 아침 임시회의에 무엇을 올리시겠습니까?',
      context:
        '계열 잔여사는 유동성 기준으로만 보면 어제 정지한 두 곳보다 낫습니다. 그러나 인출 속도가 그 차이를 이틀 안에 지웁니다. 지금 닫으면 이틀 전 발표를 스스로 깨는 것이고, 닫지 않으면 다음 주에 더 큰 구멍으로 닫게 됩니다.',
      requiredConcepts: ['regulator-escalation-ladder', 'bank-run-dynamics'],
      dimensions: ['policy', 'compliance'],
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't3-d1-a',
      timeLimitSec: 150,
      options: [
        {
          id: 't3-d1-a',
          label: '계열 잔여 3개사와 보해저축은행을 같은 날 동시에 정지한다',
          description:
            '인출 추이·유동성·예금잔액·외부차입 가능 규모를 종합해 단기간 내 지급 불능이 명백하다고 판단하고, 네 곳을 한 번에 정지한다.',
          when: { path: 'institution.custom.depBusan', gt: 0.1 },
          effects: [
            sbFx.suspend({
              group: 'busan',
              count: 3,
              deposits: 3.9,
              excessDeposits: 0.0633,
              subDebt: 0.0432,
              payout: 1.0,
              label: '계열 잔여 3개사 영업정지',
            }),
            sbFx.suspend({
              group: 'peer',
              count: 1,
              deposits: 0.55,
              excessDeposits: 0,
              subDebt: 0,
              payout: 0.35,
              label: '보해저축은행 영업정지',
            }),
          ],
          expert: {
            rating: 70,
            rationale:
              '이 시점에서는 최선에 가깝다 — 계열을 남겨 두면 인출은 계속 옮겨 다닌다. 다만 이틀 전 발표를 스스로 깨는 대가를 함께 치른다. 애초에 계열을 한 번에 닫았다면 치르지 않았을 대가다.',
            historicalNote:
              '2011년 2월 19일 토요일 아침 임시회의에서 부산2·중앙부산·전주·보해 4개사가 추가 정지되었다. 사유는 "2.17 부산·대전 영업정지 이후 예금인출 사태가 계속"되었다는 것이었다.',
            sourceRefs: [S.more4],
          },
          consequences:
            '네 곳이 동시에 정지되었습니다. 계열에는 더 이상 옮겨 갈 창구가 남지 않았습니다.',
          historical: true,
          irreversible: true,
        },
        {
          id: 't3-d1-b',
          label: '유동성을 지원해 계열 잔여사를 살려 두고 실사를 계속한다',
          description:
            '중앙회 유동성콜과 긴급대출로 계열 잔여 3개사의 지급을 받치고, 검사가 끝날 때까지 영업을 유지한다. 이틀 전 발표와 모순되지 않는다.',
          when: { path: 'institution.custom.depBusan', gt: 0.1 },
          effects: [
            sbFx.supportFund({
              amount: 0.8,
              reason: '계열 잔여사 유동성 지원',
              label: '유동성 지원',
            }),
            flag('affiliate_support'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                '유동성 지원으로 버틴 기간만큼 손실이 자람 (정리 소요 가산 +0.20, 신뢰지수 −5)',
              effects: [
                counter('forbearanceCost', 0.2),
                confidence(-5, '지원으로 버틴 기간에 손실이 자람'),
              ],
            },
          ],
          expert: {
            rating: 22,
            rationale:
              '발표를 지키는 가장 쉬운 방법이지만, 지급 불능이 임박한 기관에 유동성을 넣는 것은 예금자에게 빠져나갈 시간을 사 주는 것이다. 남은 예금자는 줄고 잔여 자산도 줄어 대지급 소요만 커진다.',
            sourceRefs: [S.more4, S.finAct],
          },
          consequences: '유동성이 투입되었습니다. 창구는 열려 있고, 인출은 계속되고 있습니다.',
          trap: true,
          trapExplanation:
            '"약속을 지켰다"는 것 말고는 남는 것이 없다. 지급 불능이 임박한 기관을 열어 두면 먼저 움직인 예금자만 온전히 받고, 늦게 온 예금자와 예금보험기금이 그 차액을 나눠 진다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't3-d1-c',
          label: '계열 잔여 3개사만 정지하고 보해는 다음 주로 미룬다',
          description:
            '계열은 정리하되 계열 밖 기관은 검사 결과를 더 본다. 정지 기관 수를 줄여 충격을 완화한다.',
          when: { path: 'institution.custom.depBusan', gt: 0.1 },
          effects: [
            sbFx.suspend({
              group: 'busan',
              count: 3,
              deposits: 3.9,
              excessDeposits: 0.0633,
              subDebt: 0.0432,
              payout: 1.0,
              label: '계열 잔여 3개사 영업정지',
            }),
            sbFx.adjustContagion({
              factor: 1.2,
              reason: '다음 차례가 어디인지 시장이 지목',
              groups: ['peer'],
              label: '보해 정지 유예',
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '한 주를 더 끈 기관의 정리 소요가 커짐 (정리 소요 가산 +0.08)',
              effects: [counter('forbearanceCost', 0.08)],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '계열 전염은 끊지만 계열 밖에 "다음 차례"라는 표적을 남긴다. 시장은 BIS 5% 미만 명단을 이미 알고 있으므로 지목은 즉시 이루어진다.',
            sourceRefs: [S.stance, S.more4],
          },
          consequences:
            '계열 세 곳이 정지되었습니다. 기사에는 "다음은 어디인가"라는 제목이 붙었습니다.',
          irreversible: true,
        },
        {
          id: 't3-d1-d',
          label: '계열 밖에서 지급 불능이 임박한 곳만 정지한다',
          description:
            '계열 정리가 이미 끝났거나 잔여가 없는 상태에서, 인출로 지급 불능이 임박한 계열 밖 기관 한 곳만 정지한다.',
          effects: [
            sbFx.suspend({
              group: 'peer',
              count: 1,
              deposits: 0.55,
              excessDeposits: 0,
              subDebt: 0,
              payout: 0.35,
              label: '보해저축은행 영업정지',
            }),
          ],
          expert: {
            rating: 80,
            rationale:
              '계열을 이미 한 번에 닫았다면 이번 라운드에서 닫을 곳은 계열 밖의 한 곳뿐이다. 정지의 근거가 "계열이라서"가 아니라 "지급 불능이 임박해서"로 유지되므로 다음 기관에 대한 예단도 생기지 않는다.',
            sourceRefs: [S.more4, S.finAct],
          },
          consequences: '한 곳이 정지되었습니다. 조치의 근거가 기관별 사실로만 설명되었습니다.',
          irreversible: true,
        },
        {
          id: 't3-d1-e',
          label: 'BIS 5% 미만 기관까지 확대해 이번 주에 정리를 끝낸다',
          description: '불확실성을 한 번에 없앤다. 계열 밖 취약 기관 일곱 곳을 함께 정지한다.',
          effects: [
            sbFx.suspend({
              group: 'peer',
              count: 7,
              deposits: 2.6,
              excessDeposits: 0,
              subDebt: 0,
              payout: 1.1,
              label: '취약 저축은행 7개사 영업정지',
            }),
          ],
          expert: {
            rating: 32,
            rationale:
              'BIS 5% 미만은 적기시정조치 사유이지 부실금융기관 결정 요건이 아니다. 요건 없이 닫으면 법적 분쟁이 남고, 자체 정상화가 가능했을 기관의 대지급 소요까지 기금이 떠안는다.',
            sourceRefs: [S.stance, S.finAct],
          },
          consequences:
            '일곱 곳이 정지되었습니다. 대지급 소요가 한꺼번에 늘었고, 법무 검토 의견이 뒤따랐습니다.',
          irreversible: true,
        },
      ],
    },
    {
      id: 't3-d2',
      title: '주말 커뮤니케이션',
      prompt: '이틀 전 발표와 오늘의 조치를 어떻게 설명하시겠습니까?',
      context:
        '기자단과 콜센터가 같은 질문을 반복하고 있습니다. 월요일 개점 전에 답이 정해져야 합니다.',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication'],
      select: { min: 1, max: 1 },
      availableFrom: 3,
      deadlineTick: 3,
      defaultOptionId: 't3-d2-a',
      options: [
        {
          id: 't3-d2-a',
          label: '"예금인출 동향과 유동성을 감안했다"고 사유를 설명한다',
          description:
            '인출 추이·유동성·예금잔액·외부차입 가능 규모를 종합해 판단했다고 밝힌다. 이틀 전 발표와의 관계는 직접 다루지 않는다.',
          effects: [counter('explanationGiven', 1)],
          expert: {
            rating: 55,
            rationale:
              '사실에 부합하는 설명이고 실제 사유이기도 하다. 다만 "그렇다면 이틀 전 발표는 무엇이었나"에 답하지 않으므로, 다음 발표도 같은 방식으로 뒤집힐 수 있다는 인식이 남는다.',
            historicalNote: '2월 19일 발표의 사유가 이 문장이었다.',
            sourceRefs: [S.more4],
          },
          consequences:
            '사유가 설명되었습니다. 후속 질문은 "그럼 그때 그 말은 무엇이었나"였습니다.',
          historical: true,
        },
        {
          id: 't3-d2-b',
          label: '추가 정지가 없다고 말한 적이 없다고 대응한다',
          description: '발표문에 조건이 붙어 있었다는 점을 강조한다.',
          effects: [
            confidence(-8, '단서 뒤에 숨는 해명'),
            sbFx.adjustContagion({ factor: 1.15, reason: '해명에 대한 불신' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '문언상으로는 틀리지 않지만, 예금자가 들은 것은 조건이 아니라 결론이었다. 단서 뒤에 숨는 해명은 다음 발표의 모든 문장에 단서를 찾게 만든다.',
            sourceRefs: [S.stance],
          },
          consequences: '해명이 나갔습니다. 기사 제목에 "말 바꾸기"가 들어갔습니다.',
          trap: true,
          trapExplanation:
            '기술적으로 정확한 해명이 신뢰를 더 빠르게 무너뜨리는 전형적인 경우다. 문제는 문장이 아니라 그 문장을 믿고 움직이지 않은 예금자다.',
          remediationCard: 'crisis-communication',
        },
        {
          id: 't3-d2-c',
          label: '조건부 예단이 잘못이었음을 인정하고 앞으로의 기준을 제시한다',
          description:
            '검사 결과가 나오기 전에 추가 조치 여부를 예단하지 않겠다는 원칙을 밝히고, 앞으로 조치 판단에 쓰는 기준(지급 불능 임박 여부)을 공개한다.',
          effects: [
            confidence(3, '기준을 공개한 정정'),
            sbFx.setDampener({ factor: 0.93, reason: '판단 기준 공개', label: '기준 공개' }),
            flag('standard_published'),
          ],
          expert: {
            rating: 85,
            rationale:
              '뒤집힌 약속의 비용은 이미 치렀다. 남은 선택은 다음 발표의 신뢰를 어떻게 만들 것인가이고, 그 방법은 예단을 끊고 판단 기준을 공개하는 것뿐이다. 기준이 공개되면 예금자는 발표가 아니라 기준으로 다음을 예측한다.',
            sourceRefs: [S.more4, S.finAct],
          },
          consequences:
            '정정과 기준이 함께 발표되었습니다. "다음은 어디냐"는 질문이 "기준에 걸리는 곳이 몇 곳이냐"로 바뀌었습니다.',
        },
        {
          id: 't3-d2-d',
          label: '주말 콜센터와 임시 창구를 열고 가지급금 일정을 함께 공표한다',
          description:
            '설명보다 절차를 준다. 주말 콜센터를 증설하고, 정지 기관 예금자의 가지급금 지급 개시일을 날짜로 공표한다.',
          effects: [
            sbFx.setDampener({
              factor: 0.9,
              reason: '주말 콜센터·지급 일정 공표',
              label: '주말 대응',
            }),
            flag('weekend_channel'),
            counter('explanationGiven', 1),
          ],
          expert: {
            rating: 75,
            rationale:
              '월요일 개점 시각의 줄을 실제로 줄이는 유일한 조치다. 다만 이틀 전 발표와의 관계는 여전히 남아 다음 라운드에서 다시 물어진다.',
            sourceRefs: [S.dpAct, S.busanMeeting],
          },
          consequences:
            '콜센터 응답률이 올라가고 지급 개시일이 공표되었습니다. 월요일 대기 줄이 예상보다 짧습니다.',
        },
      ],
    },
  ],
  interrupts: [t3KdicCall],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '계열 잔여 수신과 전염 계수를 보십시오. 남겨 둔 창구가 곧 다음 라운드의 인출처입니다.',
      cardRefs: ['bank-run-dynamics'],
    },
    {
      level: 3,
      decisionId: 't3-d2',
      text: '이미 뒤집힌 약속은 되돌릴 수 없습니다. 남은 것은 다음 약속을 어떻게 검증 가능하게 만들 것인가입니다.',
      cardRefs: ['crisis-communication'],
    },
  ],
  relatedCards: ['bank-run-dynamics', 'crisis-communication', 'regulator-escalation-ladder'],
}

export const turnsA: T[] = [t0, t1, t2, t3]
