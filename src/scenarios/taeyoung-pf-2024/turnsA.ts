import type { BankState, DialogueStep, Interrupt, Option, Turn } from '../../engine/types'
import { commitReplies } from '../../engine/core/dialogue'
import { confidence, counter, flag, op, regulator } from '../../engine/fx/common'
import { CLAIM_BASE, pfFx } from './fx'

export type T = Turn<BankState>
export type O = Option<BankState>

/**
 * turnsA — T0(2023-12-28) ~ T3(2024-01-25).
 *
 * **등장 인물의 발언은 모두 개연성 있는 재구성(plausible reconstruction)이며 녹취·속기록이 아니다.**
 * 한서은행과 대현건설그룹은 합성 기관이다(scenario.ts `meta.modelledOn` 참조). 반면 외생 사건·
 * 시장 데이터·제도(기업구조조정 촉진법 조문, 대주단 협약, 금융위·금감원 발표, 국고채·회사채
 * 최종호가수익률, 환율)는 실제 기록을 그대로 쓴다 — facts.ts / sources.ts 참조.
 *
 * 사후정보 금지: 각 턴의 플레이어 가시 텍스트에는 그 시점 이후에만 알 수 있는 사실
 * (사업성 평가 4단계, 경기대응완충자본 1% 적용, 2024.3말 업권 연체율 등)이 등장하지 않는다.
 * pf.test.ts의 HINDSIGHT 표가 이를 강제한다.
 */

/** 출처 id 단축 (sources.ts). */
export const S = {
  crpa: 'crpa-2023',
  accord: 'fsc-accord-2023-04-27',
  accord2024: 'fsc-accord-2024-06-27',
  brief: 'fsc-taeyoung-2023-12-28',
  council: 'kdb-council-2024-01-11',
  plan: 'kdb-plan-2024-04-30',
  mou: 'kind-taeyoung-mou-2024-05-30',
  pfStatus: 'fsc-pf-status-2024-03-22',
  pfQ1: 'fsc-pf-2024-06-05',
  pfPolicy: 'fsc-pf-policy-2024-05-13',
  pfEval: 'fsc-pf-eval-2024-08-29',
  pfDelinq25: 'fsc-pf-2025-03-19',
  savings25: 'fss-savings-2025-03-20',
  pfProvision: 'fsc-pf-provision-2021-10-27',
  bankReg: 'bank-supervision-reg',
  ccyb: 'fsc-ccyb-2023-05-24',
  fsr23: 'bok-fsr-2023-12',
  fsr24: 'bok-fsr-2024-06',
  kis: 'kis-construction-2023-12',
  nice: 'nice-construction-2024',
  kdi: 'kdi-focus-2025',
  kiscon: 'kiscon-bankruptcy',
  kofia: 'kofia-abs-stats',
  ecosRate: 'ecos-817Y002',
  ecosFx: 'ecos-731Y003',
  ecosEq: 'ecos-802Y001',
  bokRate: 'bok-base-rate',
  bcbs: 'bcbs-cre20',
  pressFiling: 'press-taeyoung-2023-12-28',
  pressCouncil: 'press-council-2024-01-11',
  pressPlan: 'press-plan-2024-04-30',
  pressCourt: 'press-construction-receivership-2025',
} as const

// ---------------------------------------------------------------------------------------------
// T0 — 2023-12-28 (목) "워크아웃 신청"
// ---------------------------------------------------------------------------------------------

export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2023년 12월 28일 (목) 09:00 KST',
  title: '워크아웃 신청',
  time: '2023-12-28T09:00:00+09:00',
  events: [
    {
      id: 't0-news-filing',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '08:40',
      headline: '[속보] 대현건설, 기업개선절차(워크아웃) 신청 — PF 대출보증 8.6조',
      body: '시공능력 상위권 건설사 대현건설이 주채권은행인 한서은행에 기업구조조정 촉진법에 따른 공동관리절차(워크아웃)를 신청했다. 소집통보서에 따르면 PF 대출보증은 122개 사업장 8.6조원, 직접차입금은 1.1조원이다. 2023년 9월말 별도기준 부채비율은 264%, 자기자본 대비 PF 보증 비중은 352%로 주요 건설사 가운데 가장 높다. 지주회사 대현홀딩스는 자구 계획을 준비 중이라고 밝혔다.',
      severity: 'critical',
      sourceRefs: [S.pressFiling, S.kis],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't0-regulator-brief',
      kind: 'regulator',
      agency: '금융위원회·금융감독원',
      time: '10:00',
      headline: '정부 합동브리핑 — "일시적 유동성 문제, 시스템 리스크로 번지지 않도록 관리"',
      body: '금융위원회와 금융감독원은 관계기관 합동브리핑에서 해당 건설사의 워크아웃 신청이 "자구 노력을 전제로 한 정상화 절차"이며 채권단이 기업구조조정 촉진법 절차에 따라 처리할 것이라고 밝혔다. 협력업체 상거래채권은 정상 지급되도록 관리하고, 분양계약자 보호와 PF 사업장의 계속 시공을 우선하겠다고 했다.',
      tone: 'concerned',
      severity: 'warning',
      sourceRefs: [S.brief],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't0-memo-credit',
      kind: 'memo',
      time: '10:30',
      from: '여신심사부장',
      to: '여신담당 부행장',
      subject: '대현건설그룹 익스포저 및 부동산 PF 포트폴리오 현황',
      body: `- **그룹 직접여신 1.28조** = 담보부 0.86 + 무담보 0.42. 무담보는 운전자금·한도대출로 담보 여력이 없습니다.
- **부동산 PF 익스포저 5.60조** = 본PF 3.30(42개 사업장) + 브릿지론 1.30(18개) + 채무보증·매입확약 1.00(부외). 이 중 그룹이 시공하는 사업장은 1.62조입니다.
- 현재 CET1 {{metric:cet1Ratio}}. 규제 최저는 최소 4.5% + 자본보전완충 2.5% = **7.0%** 입니다.
- 그룹 전체 금융채권은 **468개 기관 18.60조**로 집계됩니다. 은행권 7.63 · 제2금융권 5.30 · 증권사 3.26 · 보험·연기금·공제회 1.67 · 기타 0.74.
- 기업구조조정 촉진법 제11조제4항: 공동관리절차 개시는 **제1차 협의회 소집을 통보받은 금융채권자의 총 금융채권액 중 4분의 3(75%) 이상** 동의가 필요합니다. 머릿수가 아니라 채권액 기준입니다.
- 채권 신고는 소집통보일부터 **5일 이내**(제26조제1항)이며, 의결권은 신고된 금융채권액에 비례합니다(제26조제2항).`,
      severity: 'warning',
      sourceRefs: [S.crpa, S.kis],
      relatedMetrics: ['cet1Ratio', 'pfExposure', 'consentPct'],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '15:30',
      headline: '마감 시세',
      items: [
        { label: '기준금리', value: '3.50%', change: '2023-01-13 이후 동결' },
        { label: '국고채 3년', value: '3.154%', change: '전일 3.220%' },
        { label: '회사채 AA- 3년', value: '3.898%', change: '스프레드 74.4bp' },
        { label: '회사채 BBB- 3년', value: '10.342%', change: '스프레드 718.8bp' },
        { label: '원/달러', value: '1,288.0', change: '종가(15:30)' },
        { label: '코스피', value: '2,655.28', change: '연말 종가' },
      ],
      sourceRefs: [S.ecosRate, S.ecosFx, S.ecosEq, S.bokRate],
    },
    {
      id: 't0-call-nbfi',
      kind: 'call',
      time: '16:20',
      caller: '저축은행 여신담당 임원',
      callee: '여신담당 부행장',
      tone: 'urgent',
      lines: [
        {
          speaker: '저축은행 여신담당 임원',
          text: '브릿지론은 저희가 후순위입니다. 은행은 담보를 잡고 있으니 유예해도 손해가 없겠지만, 저희는 유예가 곧 손실입니다. 채권단 동의는 쉽지 않을 겁니다.',
        },
        {
          speaker: '여신담당 부행장',
          text: '사업장별 회수 시뮬레이션을 공유하겠습니다. 개별 회수는 서로에게 더 나쁜 결과가 됩니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.fsr23],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '첫 대응 경로',
      prompt: '주채권은행으로서 오늘 어떤 절차를 선택하시겠습니까?',
      context:
        '기업구조조정 촉진법상 공동관리절차는 주채권은행이 채권자협의회를 소집해야 시작됩니다. 대주단 협약(자율협의회)은 법적 구속력이 약한 대신 합의만으로 만기를 연장할 수 있고, 회생절차(법정관리)는 법원이 주도합니다. 선택에 따라 오늘 이후의 모든 창구가 달라집니다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['policy', 'compliance', 'solvency'],
      options: [
        {
          id: 't0-d1-a',
          label: '기촉법 공동관리절차 개시를 위한 채권자협의회 소집',
          description:
            '기업구조조정 촉진법 제9조에 따라 신청일부터 14일 이내에 제1차 금융채권자협의회를 소집하고 개시 의결을 상정한다. 소집 통보는 주채권은행의 권한이며 오늘 즉시 발송할 수 있다. 개시 의결 요건은 총 금융채권액의 4분의 3이다(제11조제4항).',
          effects: [
            flag('council_called'),
            pfFx.pledgeConsent({ add: { Bank: 0.86 }, label: '은행권 사전 협의' }),
            confidence(2, '절차 개시 통보'),
          ],
          expert: {
            rating: 80,
            rationale:
              '기촉법 절차는 채권행사 유예와 실사를 법적 근거 위에서 동시에 얻는 유일한 경로다. 2023년 12월 26일 공포·시행된 기업구조조정 촉진법(법률 제19852호)은 총 금융채권액 4분의 3 동의로 개시할 수 있고, 반대 채권자에게는 채권매수청구권(제27조)을, 신규 신용공여에는 다른 금융채권에 우선하는 변제권(제18조제2항)을 준다.',
            historicalNote:
              '실제 사례에서도 주채권은행은 신청 당일 채권자협의회 소집을 통보했고 2주 뒤 제1차 협의회에서 개시가 결의되었다.',
            sourceRefs: [S.crpa, S.council],
          },
          consequences:
            '제1차 금융채권자협의회 소집이 통보되었습니다. 은행권은 대체로 협조적입니다. 제2금융권과 증권사의 태도는 아직 확인되지 않았습니다.',
          historical: true,
          feasibility: {
            basis: '주채권은행의 소집 권한 — 당일 통보 가능 (기업구조조정 촉진법 제9조·제11조)',
            sourceRefs: [S.crpa],
          },
          calibrationNote: '은행권 동의 확보 0.86 = 주채권은행 + 주요 시중은행 사전 협의 [CAL]',
        },
        {
          id: 't0-d1-b',
          label: '대주단 협약 자율협의회로 만기연장만 결의',
          description:
            '기촉법 절차 대신 「부동산PF 사업정상화를 위한 대주단 협약」의 자율협의회를 소집해 만기연장과 이자유예만 결의한다. 만기연장은 채권액 3분의 2 동의로 가능해 요건이 낮고, 자산건전성 분류는 그대로 두므로 이번 분기 충당금 부담이 없다. 협약 가입 금융기관만 구속하며 법적 강제력은 없다.',
          effects: [
            pfFx.freezeClassification({ months: 12, label: '만기연장 + 분류 유지' }),
            pfFx.pledgeConsent({ add: { Bank: 0.4, Nbfi: 0.15 } }),
            flag('accord_path'),
          ],
          delayedEffects: [
            {
              afterTurns: 4,
              when: { flag: 'classification_frozen' },
              description:
                '감독당국이 만기연장 중인 익스포저의 자산건전성 재분류를 지시 — 미뤄 둔 충당금이 한꺼번에 적립된다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['groupUnsecured', 'groupSecured', 'pfBridge'],
                  bucket: 'substandard',
                  share: 1,
                  surcharge: 0.35,
                  label: '재분류 지시(동결 가산 35%)',
                }),
              ],
            },
          ],
          expert: {
            rating: 25,
            rationale:
              '가장 매력적인 함정이다. 오늘 아무것도 잃지 않고 시간을 벌 수 있게 보이지만, 자율협약에는 실사도 자구안도 채권매수청구도 없고, 무엇보다 **만기만 늘리고 분류를 그대로 두는 것**이 감독당국의 재분류 지시 대상이다. 재분류가 오면 미뤄 둔 충당금이 가산까지 붙어 한 번에 온다.',
            sourceRefs: [S.accord, S.bankReg, S.pfPolicy],
          },
          consequences:
            '자율협의회에서 만기연장이 결의되었습니다. 이번 분기 충당금 부담은 없습니다. 실사는 시작되지 않았고 자구안도 없습니다.',
          trap: true,
          trapExplanation:
            '만기연장은 채무자의 상환능력을 바꾸지 않는다. 자산건전성 분류는 "연체 여부"가 아니라 "채무상환능력"으로 판단해야 하며, 만기만 늘려 연체를 없앤 상태를 정상으로 두는 것은 부실의 이연일 뿐이다. 2024년 감독당국이 사업성 평가 기준을 새로 만든 이유가 정확히 이것이다.',
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: {
            basis:
              '대주단 협약(2023.4.24 개정) 자율협의회 — 만기연장은 협약 가입기관 채권액 3분의 2 동의로 의결 가능',
            sourceRefs: [S.accord],
          },
        },
        {
          id: 't0-d1-c',
          label: '회생절차(법정관리) 유도',
          description:
            '워크아웃 신청을 반려하고 법원의 회생절차로 넘긴다. 채권단은 협상 부담을 덜지만 시공 현장은 즉시 중단되고 PF 사업장의 회수가치가 급락한다. 법원 절차이므로 채권단이 속도를 통제할 수 없다.',
          effects: [
            pfFx.pledgeConsent({ add: { Bank: 0.3 } }),
            flag('court_path'),
            confidence(-8, '회생절차 유도'),
          ],
          expert: {
            rating: 30,
            rationale:
              '회생절차가 언제나 나쁜 선택은 아니다 — 자구 여력이 없는 건설사는 오히려 빠른 회생이 낫다(2025년 1월 회생을 신청한 중견 건설사는 9개월 만에 절차를 종결했다). 그러나 PF 보증 16.4조를 남긴 채 시공이 멈추면 사업장 회수가치가 먼저 무너지고 분양계약자·협력업체 피해가 채권단 회수보다 앞선다.',
            sourceRefs: [S.fsr23, S.nice],
          },
          consequences:
            '회생절차 유도 방침이 알려졌습니다. 채권단의 동의 확보는 사실상 중단되었고 시공 현장이 흔들리기 시작했습니다.',
          irreversible: true,
          feasibility: {
            basis:
              '주채권은행은 워크아웃 신청을 수용할 의무가 없다 — 채무자회생법상 회생 신청은 별도 경로',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't0-d1-d',
          label: '협의회 소집과 동시에 담보권 실행·상계 착수',
          description:
            '협의회를 소집하면서 동시에 예금 상계와 담보권 실행으로 자행 채권을 먼저 보전한다. 법적으로 가능하지만 다른 채권자에게 "주채권은행이 먼저 빠져나간다"는 신호가 되어 동의 확보가 어려워진다.',
          effects: [
            flag('council_called'),
            pfFx.pledgeConsent({ add: { Bank: 0.8, Nbfi: 0.02 } }),
            op('institution.cash', 'add', 0.12, '상계 회수'),
            confidence(-7, '주채권은행 선회수'),
            counter('unilateralRecovery', 1),
          ],
          expert: {
            rating: 45,
            rationale:
              '채권행사 유예 통보 전이라면 위법이 아니다. 그러나 기촉법 절차는 다른 채권자의 동의로만 굴러가며, 주채권은행의 선제 회수는 제2금융권이 같은 행동을 하도록 만드는 신호다. 채권액 기준 59%를 쥔 비은행 채권자가 이탈하면 75% 요건은 산술적으로 불가능해진다.',
            sourceRefs: [S.crpa, S.fsr23],
          },
          consequences:
            '상계로 0.12조를 회수했습니다. 협의회는 소집되었으나 제2금융권이 같은 조치를 준비하고 있다는 보고가 들어왔습니다.',
          feasibility: {
            basis:
              '채권행사 유예 통보 이전의 상계·담보권 실행은 적법 (기촉법 제9조 유예 효력 발생 전)',
            sourceRefs: [S.crpa],
          },
        },
      ],
    },
    {
      id: 't0-d2',
      title: '채권행사 유예 범위',
      prompt: '채권행사 유예를 어느 범위까지 요청하시겠습니까?',
      context:
        '기업구조조정 촉진법은 협의회 소집 통보 시 채권행사 유예를 함께 요청할 수 있게 한다. 유예는 제2금융권에게는 즉각적인 회수 포기를 뜻하므로 반발이 크고, 협력업체 상거래채권을 어떻게 다룰지가 현장 시공 계속 여부를 가른다.',
      dimensions: ['compliance', 'communication', 'policy'],
      options: [
        {
          id: 't0-d2-a',
          label: '전 금융채권자에 채권행사 유예 요청',
          description:
            '기촉법 제9조제3항에 따라 모든 금융채권자에게 제1차 협의회 종료 시까지 채권행사 유예를 요청한다. 상계·담보권 행사·추가담보 취득까지 포함되며(어음교환 회부는 제외), 개시 후에는 제11조제2항에 따라 개시일부터 1개월, 실사가 필요하면 3개월까지 이어진다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Nbfi: 0.05, Securities: 0.05, Insurance: 0.15, Other: 0.1 },
            }),
            flag('standstill_requested'),
          ],
          expert: {
            rating: 78,
            rationale:
              '유예 없이는 실사도 자구안도 의미가 없다. 개별 회수 경쟁이 시작되면 사업장 회수가치가 먼저 파괴되고, 결과적으로 모든 채권자의 회수율이 낮아진다.',
            sourceRefs: [S.crpa],
          },
          consequences: '유예가 통보되었습니다. 개별 회수 시도는 일단 멈췄습니다.',
          historical: true,
          feasibility: {
            basis: '기업구조조정 촉진법 제9조 — 소집 통보와 함께 유예 요청 가능',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't0-d2-b',
          label: '은행권에만 유예 요청',
          description:
            '은행권에만 유예를 요청하고 제2금융권은 각자 판단하게 둔다. 협상 부담이 줄지만 유예의 목적 자체가 사라진다.',
          effects: [pfFx.pledgeConsent({ add: { Bank: 0.04 } })],
          expert: {
            rating: 42,
            rationale:
              '채권액의 59%를 쥔 비은행 채권자를 유예 밖에 두면, 유예에 응한 은행권이 회수를 포기한 몫만큼 비은행이 먼저 가져간다. 형평성 시비가 곧바로 개시 의결의 반대표로 돌아온다.',
            sourceRefs: [S.crpa, S.fsr23],
          },
          consequences: '은행권만 유예에 응했습니다. 제2금융권의 개별 회수 문의가 이어집니다.',
          feasibility: { basis: '유예 요청 범위는 주채권은행 재량', sourceRefs: [S.crpa] },
        },
        {
          id: 't0-d2-c',
          label: '유예 없이 개별 회수를 허용',
          description:
            '유예를 요청하지 않고 각 채권자가 알아서 회수하게 둔다. 자행 회수는 빨라지지만 사업장은 즉시 멈춘다.',
          effects: [
            confidence(-10, '개별 회수 경쟁'),
            pfFx.pledgeConsent({ set: { Nbfi: 0, Other: 0 } }),
            counter('unilateralRecovery', 1),
          ],
          expert: {
            rating: 15,
            rationale:
              '워크아웃을 신청받고 유예를 하지 않는 것은 절차를 시작하지 않겠다는 뜻이다. 한국은행 금융안정보고서는 2023년 하반기 PF 구조조정에서 "채권자 간 조율 실패가 회수가치 훼손의 주된 경로"라고 지적했다.',
            sourceRefs: [S.fsr23, S.crpa],
          },
          consequences:
            '개별 회수가 시작되었습니다. 브릿지론 사업장의 토지에 가압류가 들어가기 시작했습니다.',
          trap: true,
          trapExplanation:
            '자행 회수를 먼저 하면 단기적으로는 손실이 줄어 보인다. 그러나 같은 계산을 모든 채권자가 하므로 회수 경쟁이 시작되고, 담보가 없는 사업장부터 가치가 사라진다.',
          feasibility: { basis: '유예 요청은 의무가 아니다', sourceRefs: [S.crpa] },
        },
        {
          id: 't0-d2-d',
          label: '유예 요청 + 상거래채권 정상 지급 공표',
          description:
            '금융채권에는 유예를 요청하되 협력업체 상거래채권은 워크아웃 대상에서 제외해 정상 지급한다고 공표한다. 현장 시공이 계속되어 사업장 회수가치가 보존되고, 협력업체 연쇄 부도를 막는다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Nbfi: 0.08, Securities: 0.07, Insurance: 0.2, Other: 0.2 },
            }),
            flag('standstill_requested'),
            flag('trade_payables_honoured'),
            confidence(4, '상거래채권 정상 지급 공표'),
          ],
          expert: {
            rating: 85,
            rationale:
              '기촉법의 금융채권에 상거래채권은 포함되지 않으며, 정부 합동브리핑도 협력업체 상거래채권의 정상 지급과 계속 시공을 우선한다고 밝혔다. 공사가 멈추면 본PF 사업장의 회수가치가 가장 먼저 사라지므로, 상거래채권 지급은 자선이 아니라 담보 보전이다.',
            sourceRefs: [S.brief, S.crpa],
          },
          consequences:
            '유예와 함께 상거래채권 정상 지급 방침이 공표되었습니다. 현장 시공이 유지되고 있고, 채권자들의 태도도 다소 누그러졌습니다.',
          feasibility: {
            basis: '상거래채권은 기촉법상 금융채권이 아니므로 유예 대상에서 제외 가능',
            sourceRefs: [S.crpa, S.brief],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '동의율은 머릿수가 아니라 채권액 기준입니다. 대시보드의 채권 구성표에서 은행권이 몇 %인지 먼저 확인하세요.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: '기촉법 절차(A)는 유예·실사·자구안·매수청구를 한 번에 얻습니다. 만기연장만 하는 자율협약(B)은 오늘 비용이 없어 보이지만 분류를 동결하는 순간 재분류 지시의 대상이 됩니다.',
    },
    {
      level: 2,
      decisionId: 't0-d2',
      text: '상거래채권은 금융채권이 아닙니다. 공사가 멈추면 본PF 사업장의 회수가치가 먼저 사라진다는 점을 계산에 넣으세요.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2024-01-04 (목) "채권 신고와 동의율 산식"
// ---------------------------------------------------------------------------------------------

/**
 * T1 대화 — 제2금융권 협의체와의 사전 협상. 목표 동의율을 숫자로 약속하고(`workoutConsentTargetPct`),
 * 그 약속은 다음 턴의 지연효과가 판정한다. 대사는 재구성이다.
 */
const t1NegotiationSteps: DialogueStep<BankState>[] = [
  {
    id: 't1-d2-open',
    lines: [
      {
        speaker: '제2금융권 협의체 대표',
        text: '브릿지론은 저희가 후순위입니다. 은행은 담보가 있으니 기다릴 수 있지만 저희는 기다리는 것이 곧 손실입니다. 무엇을 주실 수 있습니까?',
      },
    ],
    note: '여기서 한 약속은 이후 이행 여부로 평가됩니다.',
    replies: [
      {
        id: 't1-d2-r-share',
        label: '실사 전이라도 사업장별 회수 시뮬레이션을 공유하겠다',
        effects: [flag('sites_disclosed')],
        next: 't1-d2-target',
        expert: {
          rating: 82,
          rationale:
            '후순위 채권자가 반대하는 이유는 손실이 확정되어서가 아니라 얼마인지 몰라서다. 숫자를 먼저 주면 협상 대상이 생긴다.',
        },
      },
      {
        id: 't1-d2-r-priority',
        label: '후순위 채권자에게 우선 상환을 약속하겠다',
        next: 't1-d2-target',
        expert: {
          rating: 35,
          rationale:
            '당장의 동의는 사지만 채권자 간 형평성 원칙을 깨뜨린다. 계획 의결에서 선순위가 같은 이유로 반대한다.',
        },
        trap: true,
        trapExplanation:
          '기촉법의 기업개선계획은 채권자 평등을 전제로 한다. 후순위에게 먼저 준 약속은 선순위·은행권의 반대표로 돌아오며, 개시 의결은 넘겨도 계획 의결에서 무너진다.',
      },
      {
        id: 't1-d2-r-nothing',
        label: '개별 협상은 없다, 협의회에서 표결로 정하자',
        resolvesTo: 't1-d2-c',
        expert: {
          rating: 25,
          rationale: '채권액의 59%를 쥔 상대에게 표결로 압박하는 것은 산술적으로 성립하지 않는다.',
        },
      },
    ],
  },
  {
    id: 't1-d2-target',
    lines: [
      {
        speaker: '제2금융권 협의체 대표',
        text: '그러면 몇 %를 목표로 하고 계십니까? 요건은 75%라고 들었습니다만, 그 선에 겨우 맞출 생각이라면 저희 회원사는 반대표로 값을 매길 겁니다.',
      },
    ],
    note: '여기서 부른 목표치는 다음 협의회에서 그대로 검증됩니다.',
    replies: commitReplies<BankState>('workoutConsentTargetPct', [67, 75, 85], {
      idPrefix: 't1-d2-target',
      label: (v) =>
        v === 67
          ? '67% — 요건 미만이라도 자율협약으로 전환 가능하다'
          : v === 75
            ? '75% — 법정 요건을 정확히 맞춘다'
            : '85% — 요건보다 충분히 높게 확보한다',
      next: (v) => (v >= 85 ? 't1-d2-cost' : 't1-d2-plain'),
      expert: (v) => ({
        rating: v >= 85 ? 85 : v >= 75 ? 60 : 25,
        rationale:
          v >= 85
            ? '요건에 여유를 두면 몇 곳이 이탈해도 절차가 살아 있고, 계획 의결에서도 같은 표를 다시 쓸 수 있다.'
            : v >= 75
              ? '요건은 맞지만 여유가 없다. 한 기관의 이탈이 곧 부결이다.'
              : '75% 미만이면 기촉법 절차는 열리지 않는다. 목표 자체가 요건을 모르고 있다는 뜻으로 읽힌다.',
      }),
      trap: (v) => v < 75,
      trapExplanation: (v) =>
        v < 75
          ? '개시 의결 요건은 신고 금융채권액의 4분의 3이다. 67%를 목표로 부르는 순간 상대는 이 은행이 산식을 모른다고 판단하고 협상 가격을 올린다.'
          : undefined,
    }),
  },
  {
    id: 't1-d2-cost',
    lines: [
      {
        speaker: '제2금융권 협의체 대표',
        text: '85%라면 저희 회원사 대부분이 찬성해야 한다는 뜻입니다. 그 대가로 무엇을 내놓으시겠습니까?',
      },
    ],
    replies: [
      {
        id: 't1-d2-r-cost-newmoney',
        label: '기촉법 제18조제2항의 신규자금 우선변제권을 협의회 결의에 명문화하겠다',
        resolvesTo: 't1-d2-b',
        expert: {
          rating: 88,
          rationale:
            '기촉법상 신규 신용공여 채권은 법정담보권 다음 순위로 다른 금융채권에 우선 변제된다. 이를 결의에 명문화하면 후순위 채권자도 신규자금 분담에 참여할 유인이 생긴다 — 채권액 가중 동의율에서 가장 값싼 표를 사는 방법이다.',
        },
      },
      {
        id: 't1-d2-r-cost-buyout',
        label: '끝까지 반대하는 채권은 매수청구로 정리하겠다',
        resolvesTo: 't1-d2-d',
        expert: {
          rating: 58,
          rationale:
            '매수청구는 확실하지만 현금이 나가고 그만큼 자행 익스포저가 늘어난다. 동의를 돈으로 사는 것이다.',
        },
      },
    ],
  },
  {
    id: 't1-d2-plain',
    lines: [
      {
        speaker: '제2금융권 협의체 대표',
        text: '그 정도 목표라면 저희도 굳이 먼저 움직일 이유가 없군요. 무엇으로 설득하시겠습니까?',
      },
    ],
    replies: [
      {
        id: 't1-d2-r-plain-standstill',
        label: '채권행사 유예와 실사 결과 공유로 설득하겠다',
        resolvesTo: 't1-d2-a',
        expert: {
          rating: 66,
          rationale:
            '실제로 쓰인 방법이다. 비용이 들지 않고 형평성도 해치지 않지만, 확보되는 표가 요건 근처에 머문다.',
        },
      },
      {
        id: 't1-d2-r-plain-buyout',
        label: '반대 채권은 매수청구로 정리하겠다',
        resolvesTo: 't1-d2-d',
        expert: {
          rating: 45,
          rationale: '목표를 낮게 부른 상태에서 매수청구를 예고하면 매수 가격만 올라간다.',
        },
      },
    ],
  },
]

export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2024년 1월 4일 (목) 09:00 KST',
  title: '채권 신고와 동의율 산식',
  time: '2024-01-04T09:00:00+09:00',
  entryEffects: [
    {
      id: 't1-market-anchor',
      description: '시장 앵커를 2024-01-04 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 322.7, '국고채 3년 3.227%'),
        op('market.custom.corpAA3y', 'set', 397.7, '회사채 AA- 3년 3.977%'),
        op('market.custom.corpBBB3y', 'set', 1042.7, '회사채 BBB- 3년 10.427%'),
        op('market.creditSpreadIgBp', 'set', 75.0, 'AA- − 국고 3년'),
        op('market.creditSpreadHyBp', 'set', 720.0, 'BBB- − 국고 3년'),
        op('market.custom.constructionPfSpreadBp', 'set', 452, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
  ],
  events: [
    {
      id: 't1-data-claims',
      kind: 'data',
      time: '09:30',
      title: '신고 금융채권 집계 (기준일 2024-01-03)',
      rows: [
        { label: '신고 기관 수', value: '468곳' },
        { label: '신고 금융채권 합계', value: '18.60조원' },
        { label: '은행권', value: '7.63조 (41.0%)' },
        { label: '제2금융권(저축은행·캐피탈·상호금융)', value: '5.30조 (28.5%)' },
        { label: '증권사(매입확약·신용공여)', value: '3.26조 (17.5%)' },
        { label: '보험·연기금·공제회', value: '1.67조 (9.0%)' },
        { label: '건설공제조합·기타', value: '0.74조 (4.0%)' },
        { label: '미확정 우발채무(산입 여부 미정)', value: '2.70조' },
      ],
      sourceRefs: [S.crpa, S.kofia],
      relatedMetrics: ['consentPct'],
    },
    {
      id: 't1-memo-formula',
      kind: 'memo',
      time: '10:10',
      from: '구조조정팀장',
      to: '여신담당 부행장',
      subject: '동의율 산식 — 무엇을 신고 채권으로 세느냐가 결과를 가릅니다',
      body: `동의율 = **Σ(그룹 채권액 × 그룹 동의비율) ÷ Σ(그룹 채권액)** 입니다. 분모를 정하는 것이 첫 번째 결정입니다.

| 산입 범위 | 분모 | 증권사 채권 | 성격 |
|---|---|---|---|
| 확정채무만 | 17.20조 | 1.86조 | 미확정 매입확약 1.40조 제외 — 분모가 작아 요건을 맞추기 쉽다 |
| 신고 기준 | 18.60조 | 3.26조 | 신고된 채권을 그대로 센다 |
| 우발채무 포함 | 21.30조 | 4.88조 | 미확정 우발채무 2.70조를 증권사·기타에 배분 — 요건은 어려워지지만 전원을 구속한다 |

제외한 채권자는 협의회 결의에 구속되지 않습니다. 오늘 분모를 줄여 요건을 맞추면, 제외된 채권자가 나중에 개별 회수에 나서거나 결의의 효력을 다툴 수 있습니다.`,
      severity: 'warning',
      sourceRefs: [S.crpa],
      relatedMetrics: ['consentPct'],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't1-news-nbfi',
      kind: 'newswire',
      outlet: '한국경제',
      time: '11:20',
      headline: '저축은행·캐피탈 "브릿지론 후순위 손실만 떠안는 구조" 반발',
      body: '대현건설그룹 브릿지론에 참여한 제2금융권이 채권행사 유예에 반발하고 있다. 업계 관계자는 "은행은 담보와 본PF를 쥐고 있어 유예해도 손해가 크지 않지만, 토지만 담보인 브릿지론 후순위는 유예 기간이 곧 손실"이라고 말했다.',
      severity: 'warning',
      sourceRefs: [S.fsr23],
    },
    {
      id: 't1-memo-securities',
      kind: 'memo',
      time: '14:00',
      from: '금융시장부장',
      to: '여신담당 부행장',
      subject: '증권사 매입확약 물량의 신고 채권 산입 이견',
      body: `증권사 4곳이 사업장 미확정 매입확약 1.40조를 금융채권으로 신고했으나, 일부 채권자가 "아직 현실화되지 않은 우발채무"라며 산입에 이의를 제기했습니다.

- 산입하면 증권사 의결권이 커지고 분모도 커집니다. 증권사는 자기자본 대비 PF 채무보증 비중이 높아 유예에 민감합니다.
- 산입하지 않으면 그 채권자들은 결의에 구속되지 않습니다. 나중에 차환이 막혀 매입확약이 현실화되면 같은 사업장에서 다른 셈을 하게 됩니다.`,
      severity: 'info',
      sourceRefs: [S.crpa, S.kofia],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '신고 금융채권 산입 범위',
      prompt: '개시 의결의 분모가 될 신고 금융채권을 어떻게 확정하시겠습니까?',
      context:
        '기촉법의 의결 요건은 신고된 금융채권액의 4분의 3이다. 무엇을 세느냐가 분모와 분자를 동시에 바꾸며, 제외된 채권자는 결의에 구속되지 않는다.',
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['compliance', 'policy'],
      options: [
        {
          id: 't1-d1-a',
          label: '확정채무만 산입 — 미확정 매입확약 1.40조 제외',
          description:
            '사업장이 특정되지 않은 증권사 매입확약을 제외해 분모를 17.20조로 줄인다. 요건을 맞추기 쉬워지지만 제외된 증권사는 결의에 구속되지 않는다.',
          effects: [pfFx.setClaimBase({ mode: CLAIM_BASE.narrow, label: '확정채무만 산입' })],
          delayedEffects: [
            {
              afterTurns: 2,
              description:
                '산입에서 제외된 증권사가 결의의 효력을 다투며 개별 회수에 나섬 — 신뢰지수 −8, 감독 단계 +1',
              effects: [
                confidence(-8, '제외 채권자의 이의'),
                regulator({ add: 1 }, '결의 효력 분쟁'),
                pfFx.pledgeConsent({ add: { Securities: -0.2 } }),
              ],
            },
          ],
          expert: {
            rating: 35,
            rationale:
              '분모를 줄이는 것은 산식을 이해한 사람의 수법이지만 잘못 쓴 것이다. 개시는 통과해도 제외된 채권자를 구속하지 못하므로, 결국 같은 사업장에서 두 개의 절차가 굴러간다.',
            sourceRefs: [S.crpa],
          },
          consequences: '분모가 17.20조로 확정되었습니다. 제외된 증권사 4곳이 유감을 표명했습니다.',
          trap: true,
          trapExplanation:
            '산식을 이해한 사람일수록 끌리는 선택이다 — 분모를 1.40조 줄이면 같은 동의로 요건을 넘길 수 있다. 그러나 기촉법의 결의는 신고된 금융채권자만 구속하므로, 산입에서 뺀 채권자는 유예에도 채무조정에도 묶이지 않는다. 오늘 넘긴 문턱만큼 같은 사업장에서 다른 절차가 하나 더 생긴다.',
          remediationCard: 'korea-crisis-toolkit',
          feasibility: {
            basis: '신고 채권의 인정 범위는 협의회가 정한다 — 주채권은행이 안을 제시',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't1-d1-b',
          label: '신고된 채권을 그대로 산입',
          description:
            '신고된 18.60조를 그대로 분모로 삼는다. 가장 다툼이 적고 결의의 효력 범위가 명확하다.',
          effects: [pfFx.setClaimBase({ mode: CLAIM_BASE.standard, label: '신고 기준 산입' })],
          expert: {
            rating: 75,
            rationale:
              '신고 기준은 분쟁 여지가 가장 작고, 개시 의결과 계획 의결이 같은 분모 위에서 굴러간다. 실제 사례도 신고 채권을 그대로 세어 468개 기관·18조원대 규모로 협의회를 구성했다.',
            historicalNote: '실제 제1차 협의회는 신고 기준으로 구성되었다.',
            sourceRefs: [S.crpa, S.council],
          },
          consequences: '분모가 18.60조로 확정되었습니다. 이의는 없었습니다.',
          historical: true,
          feasibility: { basis: '신고 기준이 기촉법의 원칙', sourceRefs: [S.crpa] },
        },
        {
          id: 't1-d1-c',
          label: '미확정 우발채무 2.70조까지 전액 산입',
          description:
            '차환이 막히면 현실화될 매입확약·보증까지 모두 산입해 분모를 21.30조로 넓힌다. 요건은 어려워지지만 모든 이해관계자를 한 절차 안에 묶는다.',
          effects: [pfFx.setClaimBase({ mode: CLAIM_BASE.broad, label: '우발채무 전액 산입' })],
          expert: {
            rating: 62,
            rationale:
              '원칙적으로 가장 깨끗하다 — PF 우발채무는 이미 현실화되는 중이고, 나중에 현실화될 채권자를 지금 구속해 두면 계획 의결에서 다시 협상할 필요가 없다. 다만 분모가 2.70조 커지므로 오늘 확보해야 할 동의가 그만큼 늘어난다.',
            sourceRefs: [S.crpa, S.fsr23],
          },
          consequences:
            '분모가 21.30조로 확정되었습니다. 증권사 의결권이 커졌고 요건 충족선도 함께 올라갔습니다.',
          feasibility: {
            basis: '우발채무의 금융채권 인정은 협의회 의결 사항 — 주채권은행 제안 가능',
            sourceRefs: [S.crpa],
          },
        },
      ],
    },
    {
      id: 't1-d2',
      title: '제2금융권 협의체 협상',
      prompt: '제2금융권 협의체 대표와의 협상에서 무엇을 약속하시겠습니까?',
      context:
        '제2금융권은 채권액의 28.5%를 쥐고 있고 대부분 브릿지론 후순위다. 이들 없이 75%는 산술적으로 어렵다. 이 자리에서 부른 목표 동의율과 약속은 다음 협의회에서 검증된다.',
      select: { min: 1, max: 1 },
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'policy', 'compliance'],
      steps: t1NegotiationSteps,
      defaultOptionId: 't1-d2-a',
      options: [
        {
          id: 't1-d2-a',
          label: '채권행사 유예와 실사 결과 공유로 설득',
          description:
            '추가 양보 없이 유예의 논리와 실사 결과 공유만으로 설득한다. 비용이 들지 않고 형평성을 해치지 않는다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Bank: 0.09, Nbfi: 0.72, Securities: 0.7, Insurance: 0.55, Other: 0.42 },
              label: '유예·정보공유 기반 설득',
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: 'workoutConsentTargetPct', lt: 75 },
              description:
                '요건 미만의 목표치를 부른 것이 알려져 협상력이 깎임 — 제2금융권·기타 동의 후퇴',
              effects: [
                pfFx.pledgeConsent({ add: { Nbfi: -0.1, Other: -0.12 } }),
                confidence(-4, '목표 동의율 오인'),
              ],
            },
          ],
          expert: {
            rating: 68,
            rationale:
              '실제로 쓰인 방법이고 충분히 통했다. 비용이 없고 형평성 시비도 없지만, 확보되는 표가 요건 근처에 머물러 한두 기관의 이탈에 취약하다.',
            historicalNote:
              '실제 사례에서 주채권은행은 추가 양보 없이 유예와 실사 공유만으로 설득해 제1차 협의회에서 요건을 크게 상회하는 동의를 얻었다.',
            sourceRefs: [S.council, S.crpa],
          },
          consequences:
            '제2금융권 협의체가 "실사 결과를 보고 판단하겠다"며 반대 의사를 철회했습니다.',
          historical: true,
          feasibility: {
            basis: '실사 결과 공유는 협의회 운영규정 내에서 주채권은행이 결정',
            sourceRefs: [S.crpa],
          },
          calibrationNote: '동의 확보 증분은 채권액 가중 — calibration.md §3 표 참조 [CAL]',
        },
        {
          id: 't1-d2-b',
          label: '신규자금 우선변제권 명문화 + 사업장 정보 전면 공개',
          description:
            '기촉법 제18조제2항의 신규 신용공여 우선변제권을 협의회 결의에 명문화하고 60개 사업장의 회수 시뮬레이션을 전면 공개한다. 후순위 채권자도 신규자금에 참여할 유인이 생긴다. 이 우선변제권은 기촉법 절차에만 있고 대주단 협약에는 없다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Bank: 0.1, Nbfi: 0.82, Securities: 0.8, Insurance: 0.68, Other: 0.62 },
              label: '우선변제권·정보 전면 공개',
            }),
            flag('priority_new_money'),
            flag('sites_disclosed'),
          ],
          delayedEffects: [
            {
              afterTurns: 4,
              when: { notFlag: 'new_money_senior' },
              description:
                '약속한 신규자금 우선변제권이 계획에 반영되지 않음 — 제2금융권 이탈, 신뢰지수 −8',
              effects: [
                pfFx.pledgeConsent({ add: { Nbfi: -0.12, Other: -0.15 } }),
                confidence(-8, '우선변제권 약속 불이행'),
              ],
            },
          ],
          expert: {
            rating: 86,
            rationale:
              '기촉법 제18조제2항은 신규 신용공여 채권을 법정담보권 다음 순위로 다른 금융채권에 우선 변제하도록 정한다. 이것이 후순위 채권자의 반대 이유(추가 손실 없이 기다리기만 해야 한다)를 직접 제거한다. 채권액 가중 동의율에서 가장 값싸게 표를 사는 방법이며, 매수청구처럼 현금이 나가지도 않는다.',
            sourceRefs: [S.crpa],
          },
          consequences:
            '신규자금 우선변제권이 협의회 안건에 포함되었습니다. 제2금융권의 태도가 눈에 띄게 달라졌습니다. 이 약속은 계획 의결에서 지켜져야 합니다.',
          feasibility: {
            basis:
              '기업구조조정 촉진법 제18조제2항 — 신규 신용공여 채권은 법정담보권 다음 순위로 다른 금융채권에 우선 변제',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't1-d2-c',
          label: '개별 협상 없이 협의회 표결로 결정',
          description:
            '사전 협상을 하지 않고 협의회에서 표결한다. 형평성 시비가 없지만 확보된 표가 없다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Bank: 0.06, Nbfi: 0.3, Securities: 0.35, Insurance: 0.3, Other: 0.15 },
              label: '사전 협상 없음',
            }),
          ],
          expert: {
            rating: 28,
            rationale:
              '채권액의 59%를 쥔 비은행 채권자를 설득하지 않고 75%를 맞추는 방법은 없다. 표결은 협상의 결과를 확인하는 자리이지 협상하는 자리가 아니다.',
            sourceRefs: [S.crpa],
          },
          consequences: '협상 없이 협의회로 갑니다. 반대 의사가 여러 곳에서 접수되었습니다.',
          feasibility: { basis: '사전 협상은 의무가 아니다', sourceRefs: [S.crpa] },
        },
        {
          id: 't1-d2-d',
          label: '반대 채권은 채권매수청구로 정리하겠다고 예고',
          description:
            '설득 대신 기촉법 제27조의 채권매수청구를 예고한다. 반대 채권자는 청산가치 기준 가격에 채권을 팔고 나갈 수 있다. 확실하지만 현금이 나간다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Bank: 0.09, Nbfi: 0.62, Securities: 0.64, Insurance: 0.5, Other: 0.35 },
              label: '매수청구 예고',
            }),
            flag('buyout_signalled'),
          ],
          expert: {
            rating: 52,
            rationale:
              '매수청구는 기촉법이 반대 채권자에게 준 권리이자 주채권은행의 정리 수단이다. 확실하지만 현금이 나가고 그만큼 자행 익스포저가 늘어나므로, 설득으로 살 수 있는 표까지 돈으로 사면 손해다.',
            sourceRefs: [S.crpa],
          },
          consequences:
            '매수청구 예고가 전달되었습니다. 일부 채권자가 오히려 "그 가격이면 팔겠다"며 계산을 시작했습니다.',
          feasibility: {
            basis: '기업구조조정 촉진법 제27조 채권매수청구권 — 반대 채권자의 법정 권리',
            sourceRefs: [S.crpa],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't1-d1',
      text: '분모를 줄이면 오늘의 요건은 쉬워지지만 제외된 채권자는 결의에 구속되지 않습니다. 같은 사업장에서 두 개의 절차가 굴러가는 상황을 상상해 보세요.',
    },
    {
      level: 3,
      decisionId: 't1-d2',
      text: '제2금융권이 반대하는 이유는 후순위라서입니다. 신규자금 우선변제권은 그 이유를 직접 제거하면서 현금이 나가지 않는 유일한 수단입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2024-01-11 (목) "제1차 금융채권자협의회" (4틱)
// ---------------------------------------------------------------------------------------------

/**
 * 협의회 당일의 부동표 확정 분포. 자구안 설명(틱 1)과 질의(틱 2)에 가장 많이 움직이고, 마감
 * 직전(틱 3)에는 이미 정해진 표만 남는다. [STYLIZED] — 개별 협의회의 시간대별 동의 집계는 공표되지 않는다.
 */
export const T2_CONSENT_PROFILE = [0.15, 0.3, 0.35, 0.2]
/** 협의회 당일 확정되는 부동표 합계(%p). 최종 동의율 96.1%를 재현하는 보정값 [CAL]. */
export const T2_CONSENT_TOTAL = 8.38

const t2NbfiCall: Interrupt<BankState> = {
  id: 't2-i1',
  interrupt: true,
  atTick: 1,
  timeoutSec: 45,
  defaultOptionId: 't2-i1-c',
  scoreWeight: 0.5,
  required: false,
  title: '반대 채권자 전화 — 저축은행 여신담당 임원',
  prompt: '자구안 설명 도중 반대 의사를 밝힌 저축은행에서 전화가 왔습니다. 어떻게 답하시겠습니까?',
  context:
    '이 기관이 속한 저축은행 계열의 채권은 합계 0.9조원 규모입니다. 지금 답이 협의회장 안의 다른 제2금융권에도 즉시 전달됩니다.',
  source: { kind: 'call', caller: '저축은행 여신담당 임원', tone: 'urgent' },
  lines: [
    {
      speaker: '저축은행 여신담당 임원',
      text: '자구안 설명은 들었습니다. 그런데 저희 브릿지론 사업장이 어떻게 되는지는 한 마디도 없더군요. 지금 답을 주시면 찬성으로 돌리겠습니다.',
    },
  ],
  dimensions: ['communication', 'policy'],
  cardRefs: ['crisis-communication'],
  options: [
    {
      id: 't2-i1-a',
      label: '해당 사업장 회수 시뮬레이션 수치를 그대로 제시',
      description:
        '브릿지론 사업장별 토지 감정가·선순위 잔액·예상 회수율을 숫자로 답한다. 수치가 나쁘더라도 검증 가능한 값이다.',
      effects: [
        pfFx.pledgeConsent({ add: { Nbfi: 0.06 }, label: '회수 시뮬레이션 제시' }),
        flag('sites_disclosed'),
      ],
      expert: {
        rating: 80,
        rationale:
          '후순위 채권자가 반대하는 이유는 손실의 크기를 모르기 때문이다. 검증 가능한 수치는 나쁜 수치여도 협상의 출발점이 되고, 같은 답이 협의회장의 다른 기관에도 같은 내용으로 전달된다.',
        sourceRefs: [S.crpa],
      },
      preview: [{ metric: 'consentPct', direction: 'up', magnitude: 1 }],
      consequences:
        '수치를 그대로 전달했습니다. 상대는 "생각보다 나쁘지만 적어도 숫자가 있다"며 찬성 쪽으로 돌아섰습니다.',
    },
    {
      id: 't2-i1-b',
      label: '후순위 채권의 우선 상환을 구두로 약속',
      description:
        '협의회 결의와 무관하게 후순위 채권을 먼저 갚겠다고 구두로 약속한다. 지금 표는 확실히 얻는다.',
      effects: [
        pfFx.pledgeConsent({ add: { Nbfi: 0.1 }, label: '구두 우선상환 약속' }),
        flag('verbal_priority'),
      ],
      delayedEffects: [
        {
          afterTurns: 3,
          description:
            '구두 약속이 다른 채권자에게 알려져 형평성 문제가 제기됨 — 선순위·증권사 이탈, 감독 단계 +1',
          effects: [
            pfFx.pledgeConsent({ add: { Bank: -0.05, Securities: -0.2, Insurance: -0.18 } }),
            confidence(-9, '채권자 간 형평성 훼손'),
            regulator({ add: 1 }, '구두 약속에 따른 형평성 문제'),
          ],
        },
      ],
      expert: {
        rating: 25,
        rationale:
          '개시 의결은 이렇게 넘길 수 있다. 그러나 기업개선계획은 채권자 평등을 전제로 하므로, 한 기관에만 준 약속은 계획 의결에서 선순위 전체의 반대 사유가 된다. 개시를 사고 계획을 잃는 거래다.',
        sourceRefs: [S.crpa],
      },
      consequences: '상대가 만족하며 찬성으로 돌아섰습니다. 통화 내용은 기록으로 남습니다.',
      trap: true,
      trapExplanation:
        '오늘의 표가 가장 급해 보이지만, 이 절차에서 표는 두 번 필요하다 — 개시 의결과 계획 의결. 첫 번째 표를 형평성으로 사면 두 번째 표를 잃는다.',
      remediationCard: 'crisis-communication',
    },
    {
      id: 't2-i1-c',
      label: '협의회에서 공식 답변하겠다고 회신',
      description:
        '개별 통화로는 답하지 않고 협의회 안건으로 다루겠다고 답한다. 절차적으로 가장 안전하지만 이 표는 얻지 못한다.',
      effects: [counter('deferredCalls', 1)],
      expert: {
        rating: 50,
        rationale:
          '위법도 부당도 아니며 형평성도 지킨다. 다만 협의회 진행 중의 30초는 절차의 정확성보다 답의 존재 여부가 더 중요한 시간이다.',
        historicalNote: '주채권은행은 개별 접촉을 협의회 안건으로 수렴해 처리했다.',
        sourceRefs: [S.council],
      },
      consequences: '상대는 답을 얻지 못한 채 전화를 끊었습니다.',
      historical: true,
    },
  ],
}

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2024년 1월 11일 (목) 10:00 KST',
  title: '제1차 금융채권자협의회',
  time: '2024-01-11T10:00:00+09:00',
  ticks: 4,
  tickLabels: [
    '10:00 협의회 소집',
    '13:00 자구안 설명',
    '17:00 질의·수정안',
    '24:00 서면결의 마감',
  ],
  entryEffects: [
    {
      id: 't2-market-anchor',
      description: '시장 앵커를 2024-01-10 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 326.9, '국고채 3년 3.269%'),
        op('market.custom.corpAA3y', 'set', 401.7, '회사채 AA- 3년 4.017%'),
        op('market.custom.corpBBB3y', 'set', 1047.0, '회사채 BBB- 3년 10.470%'),
        op('market.creditSpreadIgBp', 'set', 74.8, 'AA- − 국고 3년 (1/10 종가)'),
        op('market.creditSpreadHyBp', 'set', 720.1, 'BBB- − 국고 3년'),
        op('market.custom.constructionPfSpreadBp', 'set', 455, '건설사 보증 PF 유동화증권 [CAL]'),
        op('market.fxUsdLocal', 'set', 1320.1, '원/달러 종가 1,320.1 (1/10)'),
      ],
    },
    { id: 't2-council-open', description: '협의회 소집', effects: [flag('council_in_session')] },
  ],
  eachTick: [
    {
      id: 't2-consent-accrual',
      description: '협의회 진행에 따라 현장에서 확정되는 부동표',
      effects: [
        pfFx.accrueConsent({
          total: T2_CONSENT_TOTAL,
          profile: T2_CONSENT_PROFILE,
          label: '현장 부동표 확정',
        }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't2-vote',
      atTick: 3,
      when: { notFlag: 'vote_deferred' },
      description: '자정 서면결의 마감 — 총 금융채권액 4분의 3 요건으로 판정',
      effects: [pfFx.workoutVote({ kind: 'open', threshold: 75, label: '개시 의결' })],
    },
    {
      id: 't2-vote-fallout',
      atTick: 3,
      when: { flag: 'open_vote_failed' },
      description: '개시 부결 — 그룹이 회생절차로 이행하며 담보 회수율이 떨어진다',
      effects: [
        pfFx.courtReceivership({
          securedRecovery: 0.55,
          sectorLoss: 0.08,
          label: '개시 부결 → 회생절차',
        }),
      ],
    },
  ],
  ticker: {
    series: [
      // 회사채 AA- − 국고 3년: 1/10 종가 74.8bp → 1/11 종가 74.9bp. 일중 분포는 [STYLIZED]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [74.8, 76.5, 75.6, 74.9] },
      // 건설사 보증 PF 유동화증권 가산금리 — 공표 일별 계열이 없어 보정값 [CAL]
      {
        path: 'market.custom.constructionPfSpreadBp',
        mode: 'absolute',
        values: [455, 470, 462, 448],
      },
    ],
  },
  interrupts: [t2NbfiCall],
  events: [
    {
      id: 't2-council-agenda',
      kind: 'memo',
      time: '10:00',
      from: '구조조정팀장',
      to: '여신담당 부행장',
      subject: '제1차 금융채권자협의회 안건과 현재 동의율',
      body: `- 안건: ① 공동관리절차 개시 ② 채권행사 유예 기간 ③ 실사법인 선정 ④ 자구계획 검토
- 현재 확보 동의율 **{{metric:consentPct}}%** / 요건 75%
- 서면결의 마감은 **오늘 자정**입니다. 마감 후 도착한 의사표시는 반영되지 않으며, 결과는 내일 오전에 공표됩니다.
- 반대 의사를 밝힌 기관은 제2금융권 다수와 증권사 2곳입니다.`,
      severity: 'warning',
      relatedMetrics: ['consentPct'],
      sourceRefs: [S.crpa, S.council],
    },
    {
      id: 't2-owner-plan',
      kind: 'dialogue',
      atTick: 1,
      time: '13:00',
      title: '자구계획 설명 — 대현홀딩스 대표',
      lines: [
        {
          speaker: '대현홀딩스 대표',
          text: '지주가 보유한 계열사 지분과 보유 부동산을 합하면 1조원을 넘습니다. 대여금 출자전환과 함께 자구에 쓰겠습니다.',
        },
        {
          speaker: '제2금융권 협의체 대표',
          text: '장부가 말고 언제 현금이 되는지를 말씀해 주십시오. 매각에 1년이 걸리면 저희에게는 없는 돈입니다.',
        },
        {
          speaker: '대현홀딩스 대표',
          text: '시장 상황을 봐야 합니다. 지금 급매하면 제값을 받지 못합니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.pressCouncil],
    },
    {
      id: 't2-market',
      kind: 'market',
      atTick: 2,
      time: '17:00',
      headline: '채권시장 (1/10 종가 기준)',
      items: [
        { label: '국고채 3년', value: '3.269%', change: '전일 3.255%' },
        { label: '회사채 AA- 3년', value: '4.017%', change: '스프레드 74.8bp' },
        { label: 'CP(91일)', value: '4.28%', change: '보합' },
        { label: '원/달러', value: '1,320.1', change: '종가(15:30)' },
      ],
      sourceRefs: [S.ecosRate, S.ecosFx],
    },
    {
      id: 't2-news-close',
      kind: 'newswire',
      outlet: '연합뉴스',
      atTick: 3,
      time: '23:40',
      headline: '대현건설 채권자협의회 서면결의 마감 — 결과 집계 중',
      body: '제1차 금융채권자협의회의 서면결의가 자정에 마감된다. 기업구조조정 촉진법상 공동관리절차 개시는 소집을 통보받은 금융채권자의 총 금융채권액 중 4분의 3 이상 동의가 필요하며, 결과는 주채권은행이 내일 공표한다.',
      sourceRefs: [S.crpa],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '반대 채권자 처리',
      prompt: '반대 의사를 밝힌 채권자를 오늘 어떻게 처리하시겠습니까?',
      context:
        '서면결의 마감은 오늘 자정입니다. 지금 움직일 수 있는 수단은 세 가지입니다 — 설득, 채권매수청구 수용, 그리고 요구를 들어주는 것. 각각 비용이 다릅니다.',
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't2-d1-a',
      timeLimitSec: 240,
      requiredConcepts: ['korea-crisis-toolkit'],
      dimensions: ['policy', 'communication', 'solvency'],
      options: [
        {
          id: 't2-d1-a',
          label: '사업장별 회수 시뮬레이션으로 개별 설득',
          description:
            '반대 기관을 개별 접촉해 사업장별 토지 감정가·선순위 잔액·회수 시나리오를 제시한다. 비용이 들지 않고 형평성도 해치지 않는다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Nbfi: 0.12, Insurance: 0.1, Other: 0.25 },
              label: '회수 시뮬레이션 기반 설득',
            }),
            flag('sites_disclosed'),
          ],
          expert: {
            rating: 76,
            rationale:
              '실제로 통한 방법이다. 반대의 근거가 "모르는 손실"일 때는 숫자가 가장 싼 설득 수단이며, 채권액 가중 동의율에서 제2금융권 28.5%를 움직이는 효과가 가장 크다.',
            historicalNote:
              '실제 제1차 협의회의 동의율은 요건 75%를 크게 웃도는 96.1%로 집계되었다.',
            sourceRefs: [S.council, S.crpa],
          },
          consequences:
            '설득이 진행되었습니다. 반대 기관 상당수가 유보 또는 찬성으로 돌아섰습니다.',
          historical: true,
          feasibility: {
            basis: '실사 전 회수 시뮬레이션 공유는 주채권은행 재량 — 당일 가능',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't2-d1-b',
          label: '반대 채권 0.45조를 청산가치 68%에 매수',
          description:
            '기촉법 제27조의 채권매수청구를 선제적으로 수용해 제2금융권 반대 채권 0.45조를 액면의 68%(0.31조)에 사들인다. 법상 매수가액은 "청산을 통하여 변제받을 수 있는 금액보다 불리하지 아니한 공정한 가액"이며 협의가 안 되면 금융채권자조정위원회가 회계전문가 산정을 고려해 정한다. 매수한 채권은 협의회 채권액에서 빠지고 자행 채권이 된다 — 분모가 줄고 분자가 는다.',
          effects: [
            pfFx.buyoutDissenters({
              group: 'Nbfi',
              amount: 0.45,
              priceRatio: 0.68,
              label: '반대채권 매수청구 수용',
            }),
            pfFx.pledgeConsent({ add: { Nbfi: 0.05 } }),
          ],
          expert: {
            rating: 58,
            rationale:
              '기촉법이 준 정당한 수단이고 확실하다. 다만 0.31조의 현금이 나가고 같은 금액이 자행 익스포저로 들어오므로, 설득으로 살 수 있는 표까지 돈으로 사면 손해다. 청산가치 기준 가격 산정 자체가 분쟁의 소지도 있다.',
            sourceRefs: [S.crpa],
          },
          consequences:
            '매수청구가 수용되었습니다. 현금 0.31조가 나갔고 그만큼 자행 익스포저가 늘었습니다.',
          feasibility: {
            basis:
              '기업구조조정 촉진법 제27조 — 서면 반대 채권자는 의결일부터 7일 이내 매수청구, 찬성채권자가 매수청구기간 종료일부터 6개월 이내 연대 매수',
            sourceRefs: [S.crpa],
          },
          calibrationNote: '매수가 68% = 청산가치 기준 추정 회수율 [CAL], calibration.md §4',
        },
        {
          id: 't2-d1-c',
          label: '반대 채권자 요구대로 후순위 우선상환 조건 수용',
          description:
            '반대 기관들이 요구하는 후순위 채권 우선상환 조건을 협의회 안건에 넣는다. 오늘 가장 많은 표를 가장 빨리 확보한다.',
          effects: [
            pfFx.pledgeConsent({
              add: { Nbfi: 0.22, Other: 0.3 },
              label: '후순위 우선상환 수용',
            }),
            flag('priority_to_junior'),
          ],
          delayedEffects: [
            {
              afterTurns: 3,
              description:
                '선순위·증권사가 형평성 위반을 이유로 기업개선계획에 반대 — 계획 의결 동의율 급락, 감독 단계 +1',
              effects: [
                pfFx.pledgeConsent({
                  add: { Bank: -0.08, Securities: -0.3, Insurance: -0.28 },
                }),
                confidence(-10, '채권자 평등 원칙 훼손'),
                regulator({ add: 1 }, '형평성 문제 제기'),
              ],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '오늘의 동의율만 보면 가장 효율적이다. 그러나 이 절차에는 의결이 두 번 있고, 손실 배분을 확정하는 두 번째 의결은 채권자 평등 위에서만 통과한다. 개시를 사고 계획을 잃는다.',
            sourceRefs: [S.crpa],
          },
          consequences:
            '반대가 급격히 줄었습니다. 선순위 채권자 몇 곳이 조건을 문제 삼기 시작했습니다.',
          trap: true,
          trapExplanation:
            '개시 의결의 동의율은 눈앞에 있고 계획 의결은 넉 달 뒤에 있다. 그래서 이 선택이 매력적으로 보인다. 그러나 후순위에게 준 우선상환은 선순위가 같은 논리로 반대할 근거가 되며, 기업개선계획은 개시보다 반대가 훨씬 강한 의결이다.',
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis: '협의회 안건 구성은 주채권은행 권한 — 다만 채권자 평등 원칙의 제약을 받는다',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't2-d1-d',
          label: '설득 없이 표결 강행',
          description: '반대 의사를 그대로 두고 확보된 표만으로 표결에 부친다.',
          effects: [counter('forcedVote', 1)],
          expert: {
            rating: 22,
            rationale:
              '확보된 표가 요건을 넘는다면 정당한 선택이다. 그러나 확인하지 않은 채 강행하는 것은 산식을 계산하지 않은 것과 같다 — 부결은 되돌릴 수 없고 그 순간 회생절차로 간다.',
            sourceRefs: [S.crpa],
          },
          consequences: '추가 설득 없이 표결로 갑니다.',
          feasibility: { basis: '설득은 의무가 아니다', sourceRefs: [S.crpa] },
        },
      ],
    },
    {
      id: 't2-d2',
      title: '의결 상정 시점',
      prompt: '개시 의결을 오늘 자정 마감 안에 상정하시겠습니까?',
      context:
        '의결을 미루면 추가 설득 시간을 벌 수 있지만, 그 사이 채권행사 유예의 정당성이 약해지고 사업장 공정이 멈춥니다. 기촉법은 소집 통보 후 절차의 신속한 진행을 전제합니다.',
      availableFrom: 2,
      deadlineTick: 2,
      defaultOptionId: 't2-d2-a',
      timeLimitSec: 120,
      dimensions: ['timeliness', 'policy', 'compliance'],
      options: [
        {
          id: 't2-d2-a',
          label: '자정 마감 안에 개시 의결 상정',
          description:
            '오늘 서면결의 마감 시각 안에 개시 의결을 상정한다. 확보된 동의율이 그대로 결과가 된다.',
          effects: [flag('vote_on_time')],
          expert: {
            rating: 80,
            rationale:
              '기촉법 절차는 속도가 곧 회수가치다. 유예 기간이 길어질수록 사업장 공정률이 떨어지고 분양 일정이 밀린다. 확보된 표가 요건을 넘는다면 미룰 이유가 없다.',
            historicalNote: '실제 제1차 협의회는 소집 통보 2주 뒤 당일 개시를 결의했다.',
            sourceRefs: [S.council, S.crpa],
          },
          consequences: '개시 의결이 상정되었습니다. 자정에 집계되어 내일 오전 공표됩니다.',
          historical: true,
          feasibility: { basis: '서면 의결 마감은 소집 통보에 명시', sourceRefs: [S.crpa] },
        },
        {
          id: 't2-d2-b',
          label: '2주 연기하고 반대 채권자를 더 설득',
          description:
            '의결을 2주 미루고 추가 설득에 들어간다. 동의율은 오르지만 유예 기간이 길어져 사업장 공정이 멈추고 이연 손실이 쌓인다.',
          effects: [flag('vote_deferred'), confidence(-5, '의결 연기')],
          expert: {
            rating: 42,
            rationale:
              '요건에 미달하는 것이 확실하다면 연기가 부결보다 낫다. 그러나 확보된 표가 이미 요건을 넘는데 연기하면 비용만 남는다 — 공정 중단, 협력업체 이탈, 그리고 "주채권은행이 자신 없다"는 신호.',
            sourceRefs: [S.crpa, S.fsr23],
          },
          consequences:
            '의결이 2주 연기되었습니다. 현장 공정이 멈추고 협력업체 문의가 늘고 있습니다.',
          feasibility: {
            basis: '협의회 소집권자가 의결 기일을 변경할 수 있다',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't2-d2-c',
          label: '은행권만 먼저 결의하는 부분 의결로 처리',
          description:
            '은행권 채권액만으로 선결의하고 나머지는 추후 처리한다. 형식은 갖추지만 기촉법상 근거가 없다.',
          effects: [flag('partial_vote'), confidence(-6, '근거 없는 부분 의결')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '부분 의결의 효력을 두고 다툼이 생겨 절차가 지연되고 감독 단계가 오른다',
              effects: [
                regulator({ add: 1 }, '부분 의결의 효력 분쟁'),
                confidence(-5, '절차 정당성 훼손'),
              ],
            },
          ],
          expert: {
            rating: 18,
            rationale:
              '기촉법의 협의회 의결은 신고된 금융채권 전체를 모수로 한다. 일부 채권자만의 결의는 나머지를 구속하지 못하며, 절차의 정당성을 스스로 무너뜨린다.',
            sourceRefs: [S.crpa],
          },
          consequences: '은행권 선결의가 이루어졌습니다. 다른 채권자들이 효력을 문제 삼습니다.',
          trap: true,
          trapExplanation:
            '"일단 은행권만이라도"는 절차를 지키는 것처럼 보이지만, 구속력 없는 결의는 나중에 전부 다시 해야 한다.',
          feasibility: {
            basis: '물리적으로 가능하나 기촉법상 근거 없음 — 효력 분쟁의 대상',
            sourceRefs: [S.crpa],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '대시보드의 동의율과 요건 75%를 비교하세요. 서면결의 마감은 오늘 자정입니다.',
    },
    {
      level: 3,
      decisionId: 't2-d1',
      text: '설득(A)이 가장 싸고, 매수청구(B)는 확실하지만 현금이 나갑니다. 후순위 우선상환(C)은 오늘 가장 효율적으로 보이지만 계획 의결에서 대가를 치릅니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2024-01-25 (목) "실사 착수와 오너 자구안"
// ---------------------------------------------------------------------------------------------

/** T3 대화 — 오너와의 자구안 협의. 약정 규모(억원)를 카운터로 기록하고 T5·T7에 도착 여부를 판정한다. */
const t3OwnerSteps: DialogueStep<BankState>[] = [
  {
    id: 't3-d1-open',
    lines: [
      {
        speaker: '대현홀딩스 회장',
        text: '지주 지분은 경영권입니다. 담보로 내놓는 것과 파는 것은 다릅니다. 채권단이 요구하는 것이 정확히 무엇입니까?',
      },
    ],
    note: '여기서 확보한 조건이 이후 실제로 도착하는 금액을 결정합니다.',
    replies: [
      {
        id: 't3-d1-r-all',
        label: '지분 담보·계열사 매각·유상증자를 한 묶음으로 요구',
        effects: [flag('self_rescue_package')],
        next: 't3-d1-size',
        expert: {
          rating: 85,
          rationale:
            '세 수단은 실현 시차가 각각 다르다. 하나만 받으면 그 시차가 그대로 채권단의 위험이 된다.',
        },
      },
      {
        id: 't3-d1-r-pledge',
        label: '우선 지주 지분 담보 제공부터 받는다',
        next: 't3-d1-size',
        expert: {
          rating: 58,
          rationale:
            '가장 빨리 받을 수 있는 자구이지만 담보는 현금이 아니다. 처분해야 돈이 되고 처분에는 다시 시간이 걸린다.',
        },
      },
      {
        id: 't3-d1-r-none',
        label: '자구안 없이 채권단 출자전환으로 처리하겠다',
        resolvesTo: 't3-d1-d',
        expert: {
          rating: 18,
          rationale: '대주주 책임 없는 채권단 부담은 계획 의결에서 통과하지 못한다.',
        },
        trap: true,
        trapExplanation:
          '기촉법의 기업개선계획은 대주주의 손실 분담을 전제로 한다. 자구 없는 출자전환안은 채권자에게만 손실을 지우는 것이어서 의결 자체가 어렵고, 감독당국의 문제 제기 대상이 된다.',
      },
    ],
  },
  {
    id: 't3-d1-size',
    lines: [
      {
        speaker: '대현홀딩스 회장',
        text: '규모를 먼저 말씀해 주십시오. 얼마를 내놓아야 채권단이 움직입니까?',
      },
    ],
    note: '여기서 부른 규모는 T5 기업개선계획 의결에서 실제 도착액으로 검증됩니다.',
    replies: commitReplies<BankState>('selfRescuePledgedBn', [4000, 8000, 12000], {
      idPrefix: 't3-d1-size',
      label: (v) => `${(v / 10000).toFixed(1)}조원 규모를 요구`,
      next: (v) => (v >= 12000 ? 't3-d1-timing' : 't3-d1-plain'),
      expert: (v) => ({
        rating: v >= 12000 ? 85 : v >= 8000 ? 62 : 35,
        rationale:
          v >= 12000
            ? '무담보 금융채권과 신규자금 소요를 함께 덮을 수 있는 규모다. 대주주 손실 분담의 진정성도 이 선에서 판단된다.'
            : v >= 8000
              ? '장부상으로는 무담보채권을 덮지만 실현율과 시차를 감안하면 빠듯하다.'
              : '자구라기보다 성의 표시에 가깝다. 채권단이 계획 의결에서 같은 계산을 한다.',
      }),
    }),
  },
  {
    id: 't3-d1-timing',
    lines: [
      {
        speaker: '대현홀딩스 회장',
        text: '그 규모면 계열사 매각과 증자가 다 필요합니다. 다만 매각은 시장 상황을 봐야 합니다.',
      },
    ],
    note: '"시장 상황을 본다"는 답은 시차를 채권단이 떠안는다는 뜻입니다.',
    replies: [
      {
        id: 't3-d1-r-time-now',
        label: '3월말까지 본계약, 미이행 시 지분 처분권을 약정에 넣는다',
        setFlags: { self_rescue_hard: true },
        resolvesTo: 't3-d1-a',
        expert: {
          rating: 88,
          rationale:
            '기한과 미이행 시 처분권이 없는 자구안은 약속이 아니라 의사표시다. 기한을 걸어야 시차가 채무자 쪽에 남는다.',
        },
      },
      {
        id: 't3-d1-r-time-later',
        label: '매각 시점은 시장 상황에 맡긴다',
        resolvesTo: 't3-d1-b',
        expert: {
          rating: 40,
          rationale:
            '장부상 규모는 같지만 도착 시점이 정해지지 않으면 계획 의결 때 손에 쥔 것이 없다.',
        },
        trap: true,
        trapExplanation:
          '자구안의 크기는 협상에서 눈에 보이고 시차는 보이지 않는다. 기한 없는 매각 약속은 계획 의결일까지 한 푼도 도착하지 않을 수 있으며, 그 차이가 채권단이 져야 할 출자전환 규모를 그대로 바꾼다.',
      },
    ],
  },
  {
    id: 't3-d1-plain',
    lines: [
      {
        speaker: '대현홀딩스 회장',
        text: '그 정도면 지주 지분 담보와 대여금 출자전환으로 맞출 수 있겠습니다.',
      },
    ],
    replies: [
      {
        id: 't3-d1-r-plain-pledge',
        label: '지분 담보와 대여금 출자전환으로 정리한다',
        resolvesTo: 't3-d1-b',
        expert: {
          rating: 60,
          rationale: '가장 빨리 확보되는 자구이지만 규모가 무담보 금융채권에 미치지 못한다.',
        },
      },
      {
        id: 't3-d1-r-plain-push',
        label: '계열사 매각을 반드시 포함하도록 요구한다',
        resolvesTo: 't3-d1-c',
        expert: {
          rating: 72,
          rationale:
            '매각은 실제 현금을 만드는 유일한 자구다. 다만 매각 절차 자체가 몇 달을 요구한다.',
        },
      },
    ],
  },
]

export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2024년 1월 25일 (목) 09:00 KST',
  title: '실사 착수와 오너 자구안',
  time: '2024-01-25T09:00:00+09:00',
  entryEffects: [
    {
      id: 't3-market-anchor',
      description: '시장 앵커를 2024-01-25 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 331.3, '국고채 3년 3.313%'),
        op('market.custom.corpAA3y', 'set', 406.1, '회사채 AA- 3년 4.061%'),
        op('market.custom.corpBBB3y', 'set', 1049.0, '회사채 BBB- 3년 10.490%'),
        op('market.creditSpreadIgBp', 'set', 74.8, 'AA- − 국고 3년'),
        op('market.creditSpreadHyBp', 'set', 717.7, 'BBB- − 국고 3년'),
        op('market.custom.cd91', 'set', 368, 'CD(91일) 3.68%'),
        op('market.custom.constructionPfSpreadBp', 'set', 438, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
    {
      id: 't3-deferred-vote',
      when: { flag: 'vote_deferred' },
      description: '연기했던 개시 의결을 집계한다 — 2주 사이 공정이 멈춰 이연 손실이 쌓였다',
      effects: [
        pfFx.accrueConsent({ total: 3.4, label: '연기 기간 중 추가 확보' }),
        pfFx.workoutVote({ kind: 'open', threshold: 75, label: '연기된 개시 의결' }),
        op('institution.custom.provisionsCum', 'add', 0.04, '공정 중단에 따른 이연 손실'),
        op('institution.capital.cet1', 'add', -0.031, '이연 손실 세후 반영'),
      ],
    },
    {
      id: 't3-deferred-fallout',
      when: { all: [{ flag: 'vote_deferred' }, { flag: 'open_vote_failed' }] },
      description: '연기 끝에 부결 — 그룹이 회생절차로 이행한다',
      effects: [
        pfFx.courtReceivership({
          securedRecovery: 0.5,
          sectorLoss: 0.09,
          label: '부결 → 회생절차',
        }),
      ],
    },
  ],
  events: [
    {
      id: 't3-news-open',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '08:30',
      headline: '대현건설 공동관리절차 개시 — 채권단 실사 착수',
      body: '금융채권자협의회가 대현건설에 대한 공동관리절차 개시를 결의하면서 회계법인 실사가 시작된다. 실사는 자산·부채 실사와 계속기업가치·청산가치 산정, 60개 PF 사업장의 사업성 평가를 포함하며 결과는 3월 중 나올 예정이다.',
      sourceRefs: [S.crpa, S.pressCouncil],
    },
    {
      id: 't3-memo-sites',
      kind: 'memo',
      time: '09:40',
      from: '부동산금융부장',
      to: '여신담당 부행장',
      subject: 'PF 사업장 60곳 1차 분류 (실사 착수 기준)',
      body: `| 구분 | 사업장 | 익스포저 | 특징 |
|---|---|---|---|
| 본PF | 42곳 | 3.30조 | 평균 공정률 42%, 평균 분양률 61%. 분양 전 사업자보증·분양 후 분양보증이 붙는다 |
| 브릿지론 | 18곳 | 1.30조 | 인허가 전 10곳, 인허가 후 본PF 전환 대기 8곳. 담보는 토지뿐 |
| 채무보증·매입확약 | — | 1.00조 | 차환이 막히면 현금 유출과 위험가중자산 증가가 동시에 온다 |

**브릿지론과 본PF는 성격이 다릅니다.** 본PF는 시간이 가면 분양대금이 들어오지만, 브릿지론은 시간이 갈수록 금융비용이 토지 가치를 잠식합니다. 정리하면 즉시 손실이 확정되고, 끌면 손실이 커집니다.`,
      severity: 'warning',
      relatedMetrics: ['pfExposure', 'pfBridge', 'pfMain'],
      sourceRefs: [S.fsr23, S.nice],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't3-memo-owner',
      kind: 'memo',
      time: '11:00',
      from: '구조조정팀장',
      to: '여신담당 부행장',
      subject: '대주주 자구안 협의 — 세 수단의 실현 가능성과 시차',
      body: `| 수단 | 장부 규모 | 실현 시차 | 실현율 위험 |
|---|---|---|---|
| 지주 지분 담보 제공 + 대여금 출자전환 | 0.55조 | 즉시~1개월 | 담보는 현금이 아니다. 처분에 다시 시간이 든다 |
| 계열사(방송·레저) 매각 | 0.45~0.90조 | 3~9개월 | 인허가·주주 승인·매수자 탐색. 기한을 걸지 않으면 계획 의결까지 도착하지 않는다 |
| 유상증자 | 0.20조 | 4~6개월 | 시장 상황과 신용등급에 좌우된다 |

**장부상 합계가 충분해 보여도 도착 시점이 계획 의결 이후면 채권단이 그 차이를 출자전환으로 메워야 합니다.**`,
      severity: 'warning',
      relatedMetrics: ['selfRescuePledged', 'selfRescueDelivered'],
      sourceRefs: [S.crpa, S.kis],
    },
    {
      id: 't3-news-rating',
      kind: 'newswire',
      outlet: '한국경제',
      time: '14:30',
      headline: '신용평가사, 건설업 신용전망 "부정적" 유지 — 브릿지론 회수율이 관건',
      body: '신용평가사들은 건설업 신용전망을 부정적으로 유지하면서 브릿지론의 회수율이 업계 전반의 손실 규모를 가를 것이라고 분석했다. 토지만 담보인 브릿지론은 경·공매로 넘어갈 경우 회수율이 본PF 대비 크게 낮다.',
      severity: 'warning',
      sourceRefs: [S.nice, S.kis],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '오너 자구안 협의',
      prompt: '대주주에게서 무엇을, 얼마나, 언제까지 받아 내시겠습니까?',
      context:
        '자구안은 규모보다 시차가 중요합니다. 장부상 1조원이라도 계획 의결일까지 도착하지 않으면 그만큼을 채권단이 출자전환으로 메워야 합니다. 여기서 확보한 조건이 T5와 T7에서 실제 도착액으로 검증됩니다.',
      select: { min: 1, max: 1 },
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['solvency', 'communication', 'policy'],
      steps: t3OwnerSteps,
      defaultOptionId: 't3-d1-b',
      options: [
        {
          id: 't3-d1-a',
          label: '3종 패키지 + 이행 기한 + 미이행 시 처분권',
          description:
            '지주 지분 담보·계열사 매각·유상증자를 한 묶음으로 받고, 매각은 3월말 본계약을 기한으로 걸며 미이행 시 담보 지분 처분권을 채권단이 갖는다.',
          effects: [
            pfFx.pledgeSelfRescue({ amount: 1.2, kind: '3종 패키지', label: '자구안 약정 1.20조' }),
            flag('self_rescue_hard'),
            confidence(5, '기한부 자구안 확보'),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '지주 지분 담보와 대여금 출자전환이 계획 의결 전에 도착',
              effects: [
                pfFx.deliverSelfRescue({
                  amount: 0.55,
                  realisation: 0.85,
                  kind: '지분 담보·대여금 출자전환',
                }),
              ],
            },
            {
              afterTurns: 2,
              when: { counter: 'selfRescuePledgedBn', gte: 12000 },
              description: '기한을 건 계열사 매각이 본계약에 이르러 대금 일부가 도착',
              effects: [
                pfFx.deliverSelfRescue({ amount: 0.45, realisation: 0.7, kind: '계열사 매각' }),
              ],
            },
            {
              afterTurns: 4,
              description: '유상증자 납입',
              effects: [
                pfFx.deliverSelfRescue({ amount: 0.2, realisation: 0.6, kind: '유상증자' }),
              ],
            },
          ],
          expert: {
            rating: 88,
            rationale:
              '자구안의 실효성은 규모가 아니라 기한과 강제수단에서 나온다. 기한과 처분권을 건 자구안만이 계획 의결 시점에 실제로 손에 쥐어지며, 그만큼 채권단의 출자전환 부담이 줄어든다.',
            sourceRefs: [S.crpa, S.plan],
          },
          consequences:
            '자구안 1.20조가 기한과 함께 약정되었습니다. 미이행 시 담보 지분 처분권이 채권단에 있습니다.',
          feasibility: {
            basis: '기업개선계획의 자구계획·이행약정은 협의회 의결 사항 — 처분권 특약 가능',
            sourceRefs: [S.crpa, S.mou],
          },
          calibrationNote: '실현율 0.85/0.70/0.60 — calibration.md §5 자구안 실현율 표 [CAL]',
        },
        {
          id: 't3-d1-b',
          label: '지주 지분 담보와 대여금 출자전환 우선',
          description:
            '가장 빨리 받을 수 있는 자구부터 받는다. 계열사 매각은 시장 상황에 맡기고 기한을 걸지 않는다.',
          effects: [
            pfFx.pledgeSelfRescue({
              amount: 0.8,
              kind: '지분 담보·대여금',
              label: '자구안 약정 0.80조',
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              description: '지주 지분 담보와 대여금 출자전환이 도착',
              effects: [
                pfFx.deliverSelfRescue({
                  amount: 0.4,
                  realisation: 0.8,
                  kind: '지분 담보·대여금 출자전환',
                }),
              ],
            },
            {
              afterTurns: 4,
              description: '기한을 걸지 않은 계열사 매각이 지연되어 일부만 도착',
              effects: [
                pfFx.deliverSelfRescue({
                  amount: 0.4,
                  realisation: 0.35,
                  kind: '계열사 매각(기한 없음)',
                }),
              ],
            },
          ],
          expert: {
            rating: 62,
            rationale:
              '실제 사례도 지주의 대여금 출자전환과 영구채 인수가 자구의 중심이었고 계열사 매각은 약정 이후로 밀렸다. 빠르고 확실한 부분을 먼저 받는 것은 합리적이지만, 기한 없는 매각 약속의 시차는 그대로 채권단의 부담이 된다.',
            historicalNote:
              '실제 기업개선계획에서 지주는 대여금 출자전환과 영구채 인수로 자구에 참여했고, 자산매각 이행률은 약정 2년 뒤에도 절반 남짓에 머물렀다.',
            sourceRefs: [S.plan, S.mou],
          },
          consequences:
            '자구안 0.80조가 약정되었습니다. 지분 담보는 곧 처리되지만 매각 시점은 정해지지 않았습니다.',
          historical: true,
          feasibility: {
            basis: '대주주 지분 담보 제공·대여금 출자전환은 주주총회 없이 실행 가능',
            sourceRefs: [S.plan],
          },
        },
        {
          id: 't3-d1-c',
          label: '계열사 매각을 자구의 중심으로 요구',
          description:
            '방송·레저 계열사 매각을 자구의 중심에 놓는다. 실제 현금이 들어오지만 매각 절차에 몇 달이 걸린다.',
          effects: [
            pfFx.pledgeSelfRescue({
              amount: 0.9,
              kind: '계열사 매각',
              label: '자구안 약정 0.90조',
            }),
            flag('affiliate_sale_led'),
          ],
          delayedEffects: [
            {
              afterTurns: 3,
              description: '계열사 매각 대금이 계획 의결 이후에 도착 — 의결 시점에는 손에 없다',
              effects: [
                pfFx.deliverSelfRescue({ amount: 0.9, realisation: 0.45, kind: '계열사 매각' }),
              ],
            },
          ],
          expert: {
            rating: 56,
            rationale:
              '매각만이 실제 현금을 만든다는 판단은 옳다. 다만 인허가·주주 승인·매수자 탐색을 거치면 계획 의결일까지 도착하지 않으며, 그 사이 채권단은 도착하지 않은 돈을 전제로 계획을 짜게 된다.',
            sourceRefs: [S.plan, S.kdi],
          },
          consequences:
            '계열사 매각이 자구의 중심이 되었습니다. 매각 주관사 선정에만 몇 주가 걸립니다.',
          feasibility: {
            basis: '계열사 매각은 이사회·주주총회 및 인허가 절차 필요 — 수개월 소요',
            sourceRefs: [S.plan],
          },
        },
        {
          id: 't3-d1-d',
          label: '자구안 없이 채권단 출자전환으로 처리',
          description:
            '대주주 자구를 요구하지 않고 채권단의 출자전환만으로 자본을 채운다. 협상은 빠르지만 대주주 손실 분담이 없다.',
          effects: [
            confidence(-8, '대주주 손실 분담 부재'),
            pfFx.pledgeConsent({ add: { Nbfi: -0.15, Securities: -0.12, Other: -0.2 } }),
          ],
          expert: {
            rating: 18,
            rationale:
              '기촉법의 기업개선계획은 대주주의 손실 분담(감자·출자전환)을 전제로 한다. 자구 없는 계획은 채권자에게만 손실을 지우는 것이어서 계획 의결에서 반대에 부딪히고, 감독당국도 같은 문제를 제기한다.',
            sourceRefs: [S.crpa, S.plan],
          },
          consequences:
            '자구안 협의가 중단되었습니다. 채권단 내부에서 "왜 우리만 부담하느냐"는 반발이 나옵니다.',
          trap: true,
          trapExplanation:
            '협상 시간을 아끼는 것처럼 보이지만, 대주주 손실 분담이 없는 계획은 계획 의결 자체를 통과하지 못한다. 실제 사례에서도 대주주 100대 1 무상감자가 계획의 전제였다.',
          feasibility: {
            basis: '자구 요구는 의무가 아니나 계획 의결의 사실상 전제',
            sourceRefs: [S.crpa],
          },
        },
      ],
    },
    {
      id: 't3-d2',
      title: '실사 기간 중 사업 유지',
      prompt: '실사가 끝날 때까지 사업장과 협력업체를 어떻게 유지하시겠습니까?',
      context:
        '실사에는 6~7주가 걸립니다. 그 사이 공사가 멈추면 본PF 사업장의 회수가치가 먼저 사라집니다. 반대로 만기만 연장하고 분류를 그대로 두면 이번 분기 충당금은 없지만 부실이 이연됩니다.',
      dimensions: ['liquidity', 'solvency', 'compliance'],
      options: [
        {
          id: 't3-d2-a',
          label: '상거래채권 정상 지급 + 한도성 여신 유지',
          description:
            '협력업체 상거래채권을 정상 지급하고 공사 계속에 필요한 한도성 여신을 유지한다. 현금이 나가지만 본PF 사업장의 공정이 유지된다.',
          effects: [
            op('institution.cash', 'add', -0.09, '상거래채권·한도성 여신 유지'),
            op('institution.loans.corporate', 'add', 0.09, '한도성 여신 사용'),
            flag('trade_payables_honoured'),
            confidence(3, '현장 유지'),
          ],
          expert: {
            rating: 76,
            rationale:
              '본PF 사업장의 회수가치는 공정률과 분양률에서 나온다. 공사가 멈추면 실사 결과가 나오기 전에 회수가치가 먼저 떨어진다. 정부 합동브리핑도 계속 시공과 상거래채권 정상 지급을 우선한다고 밝혔다.',
            historicalNote:
              '실제로도 협력업체 상거래채권은 워크아웃 대상에서 제외되어 정상 지급되었다.',
            sourceRefs: [S.brief, S.crpa],
          },
          consequences: '현장 공정이 유지되고 있습니다. 협력업체 이탈은 크지 않습니다.',
          historical: true,
          feasibility: {
            basis: '한도성 여신 유지는 여신담당 부행장 전결 범위',
            sourceRefs: [S.brief],
          },
        },
        {
          id: 't3-d2-b',
          label: '최소 유지자금만 집행하고 신규는 전면 중단',
          description:
            '기존 약정 범위의 최소 자금만 집행하고 신규 취급은 전면 중단한다. 현금 유출이 가장 적다.',
          effects: [
            op('institution.cash', 'add', -0.03, '최소 유지자금'),
            counter('minimalSupport', 1),
          ],
          expert: {
            rating: 48,
            rationale:
              '현금을 아끼는 만큼 사업장 회수가치를 잃는다. 공정이 멈춘 본PF 사업장은 분양 일정이 밀리고, 밀린 만큼 금융비용이 회수가치를 잠식한다.',
            sourceRefs: [S.fsr23],
          },
          consequences: '일부 현장에서 공정이 지연되기 시작했습니다.',
          feasibility: { basis: '신규 취급 중단은 내부 여신정책으로 즉시 가능' },
        },
        {
          id: 't3-d2-c',
          label: '브릿지론 만기를 일괄 연장하고 분류는 유지',
          description:
            '실사 기간 중 만기가 돌아오는 브릿지론을 6개월 일괄 연장하고 자산건전성 분류는 그대로 둔다. 연체가 생기지 않으므로 이번 분기 충당금 부담이 없다.',
          effects: [
            pfFx.freezeClassification({ months: 6, label: '브릿지론 일괄 연장 + 분류 유지' }),
          ],
          delayedEffects: [
            {
              afterTurns: 3,
              when: { flag: 'classification_frozen' },
              description:
                '감독당국이 만기연장 중인 브릿지론의 재분류를 지시 — 미뤄 둔 충당금이 가산과 함께 적립된다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['pfBridge'],
                  bucket: 'substandard',
                  share: 1,
                  surcharge: 0.3,
                  label: '브릿지론 재분류 지시',
                }),
              ],
            },
          ],
          expert: {
            rating: 22,
            rationale:
              '두 번째 함정이다. 실사 중이라는 이유는 그럴듯하고 이번 분기 자본도 지킨다. 그러나 브릿지론은 만기를 늘릴수록 금융비용이 토지 가치를 잠식하므로, 연장은 손실을 줄이는 것이 아니라 키우면서 미루는 것이다.',
            sourceRefs: [S.bankReg, S.pfPolicy, S.kdi],
          },
          consequences: '브릿지론 만기가 6개월 연장되었습니다. 이번 분기 충당금 부담은 없습니다.',
          trap: true,
          trapExplanation:
            '만기연장은 채무자의 상환능력을 바꾸지 않는다. 연체가 사라지므로 지표는 좋아 보이지만, 그 사이 브릿지론의 이자가 원금에 붙고 토지 가치는 그대로다.',
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: {
            basis:
              '만기연장은 협의회 결의 없이 개별 여신 조건 변경으로 가능 — 분류는 감독규정의 판단 대상',
            sourceRefs: [S.bankReg],
          },
        },
        {
          id: 't3-d2-d',
          label: '상거래채권 지급 + 브릿지론 사업성 즉시 재평가',
          description:
            '상거래채권을 정상 지급하면서, 실사를 기다리지 않고 브릿지론 18곳의 사업성 재평가에 착수한다. 인허가 단계·토지 감정가·선순위 잔액을 사업장 단위로 다시 본다.',
          effects: [
            op('institution.cash', 'add', -0.09, '상거래채권·한도성 여신 유지'),
            op('institution.loans.corporate', 'add', 0.09, '한도성 여신 사용'),
            flag('trade_payables_honoured'),
            flag('early_triage'),
            confidence(4, '선제 사업성 재평가'),
          ],
          expert: {
            rating: 85,
            rationale:
              '브릿지론은 실사 결과를 기다릴 이유가 가장 적은 자산이다 — 담보가 토지 하나뿐이라 감정가와 선순위만 보면 회수율이 나온다. 먼저 보면 실사 결과가 나왔을 때 옥석 가리기가 추정이 아니라 계산이 되고, 정리 대상 사업장의 경·공매 준비도 앞당길 수 있다.',
            sourceRefs: [S.pfPolicy, S.nice, S.kdi],
          },
          consequences:
            '브릿지론 18곳의 재평가가 시작되었습니다. 인허가 전 10곳의 회수율 추정치가 먼저 나왔습니다.',
          feasibility: {
            basis: '자체 사업성 재평가는 내부 여신심사 절차 — 실사와 병행 가능',
            sourceRefs: [S.pfPolicy],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't3-d1',
      text: '자구안은 규모가 아니라 도착 시점으로 평가하세요. 대시보드의 자구안 약정액과 도착액을 나란히 보십시오.',
    },
    {
      level: 3,
      decisionId: 't3-d2',
      text: '만기연장(C)은 이번 분기 자본을 지키지만 브릿지론의 이자는 계속 붙습니다. 감독당국의 재분류 지시가 오면 미뤄 둔 충당금이 가산과 함께 옵니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3]
