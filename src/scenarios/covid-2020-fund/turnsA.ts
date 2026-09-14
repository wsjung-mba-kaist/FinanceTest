import type { AssetManagerState, DialogueStep, Turn } from '../../engine/types'
import { commitReplies } from '../../engine'
import { confidence, counter, flag, regulator } from '../../engine/fx/common'
import { fundFx } from './fx'

type T = Turn<AssetManagerState>

/**
 * turnsA — T0(2/28) ~ T3(3/16).
 *
 * **인물 발언은 모두 개연성 있는 재구성(plausible reconstruction)이며 실제 녹취가 아니다.**
 * 하버라이트 크레딧펀드는 합성 펀드이고, 등장하는 딜러·투자자·이사회 인물도 가상이다.
 * 반면 외생 사건·시장 데이터·정책 발표(연준 보도자료, 국채금리, VIX, 스프레드, ETF 괴리)는
 * 실제 기록을 그대로 쓴다 — facts.ts / sources.ts 참조.
 *
 * 사후정보 금지: 각 턴의 플레이어 가시 텍스트에는 그 시점 이후에만 알 수 있는 용어
 * (CPFF·PDCF·MMLF·PMCCF·SMCCF·무제한 QE·통화스와프 확대 등)가 등장하지 않는다.
 * fund.test.ts의 HINDSIGHT 표가 이를 강제한다.
 */

export const S = {
  pr0303: 'fed-pr-2020-03-03',
  pr0315: 'fed-pr-2020-03-15',
  cpff: 'fed-pr-2020-03-17-cpff',
  pdcf: 'fed-pr-2020-03-17-pdcf',
  mmlf: 'fed-pr-2020-03-18-mmlf',
  swap: 'fed-pr-2020-03-19-swap',
  pr0323: 'fed-pr-2020-03-23',
  h41: 'fed-h41',
  h15: 'fed-h15',
  vix: 'cboe-vix-history',
  fsb: 'fsb-holistic-2020',
  fsr: 'fed-fsr-2020-05',
  feds: 'feds-note-2020-10-07',
  bis: 'bis-bulletin-02-2020',
  margin: 'bcbs-cpmi-iosco-d526',
  fimsac: 'sec-fimsac-etf-2020',
  mmfReform: 'sec-mmf-reform-2023',
  fsbOef: 'fsb-oef-2023-12',
  esma: 'esma-34-39-1119',
  falato: 'falato-goldstein-hortacsu-2021',
  maxz: 'ma-xiao-zeng-2022',
  ohara: 'ohara-zhou-2021',
  sr935: 'nyfed-sr-935',
  ofr: 'ofr-wp-21-01',
  ici: 'ici-covid-bond-funds-2020',
  etfPrimary: 'blackrock-etf-primary-2020',
  sifma: 'sifma-fixed-income-2020',
  rt0312: 'reuters-2020-03-12',
  rt0323: 'reuters-2020-03-23',
}

/** 턴별 외생 환매 기저율(%NAV). 합계(T0~T6) = 10.0 [falato-goldstein-hortacsu-2021]. */
export const REDEMPTION_BASE = [0.3, 0.8, 1.4, 1.9, 2.3, 2.1, 1.2, 0.4]

// ---------------------------------------------------------------------------------------------
// T0 — 2020-02-28 (금) 16:00 ET "2월의 마지막 금요일"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2020년 2월 28일 (금) 16:00 ET',
  title: '프롤로그: 2월의 마지막 금요일',
  time: '2020-02-28T16:00:00-05:00',
  entryEffects: [
    {
      id: 't0-open',
      description: '2월 마감: 10년 국채 1.13%, VIX 40.11, IG 스프레드 130bp — 첫 환매 유입',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 86,
          govt10yBp: 113,
          govt30yBp: 165,
          igBp: 130,
          hyBp: 500,
          volIndex: 40.11,
          equityIndex: 100,
          fundingStressBp: 35,
          bidAskIgBp: 32,
          etfDiscountPct: -0.2,
          treasuryOffRunBp: 3,
          label: '2/28 마감 시세',
        }),
      ],
    },
  ],
  eachTick: [
    {
      id: 't0-flow',
      description: '2/28 환매 유입 0.3%',
      effects: [fundFx.markToMarket(), fundFx.redemptionStep({ basePct: REDEMPTION_BASE[0]! })],
    },
  ],
  events: [
    {
      id: 't0-news-week',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '16:20',
      headline: 'S&P 500, 2008년 이후 최악의 주간 — 한 주 만에 고점 대비 조정 구간 진입',
      body: '코로나19 확산 우려로 S&P 500은 2월 24~28일 한 주간 급락했다. 10년 국채 수익률은 1.13%로 사상 최저권까지 내려갔고 VIX는 40.11로 마감했다. 채권 운용역들은 "금리 하락으로 회사채 가격은 버텼지만 스프레드는 벌어지기 시작했다"고 전했다.',
      severity: 'warning',
      sourceRefs: [S.h15, S.vix],
      relatedMetrics: ['navIndex'],
    },
    {
      id: 't0-data-flows',
      kind: 'data',
      time: '17:00',
      title: '주간 자금 흐름 요약 (사내 집계)',
      rows: [
        { label: '이번 주 순환매', value: '−0.3% NAV (−$24M)' },
        { label: '1일 유동성(현금·T-bill·온더런 국채)', value: '$560M = 7.0%' },
        { label: '1주 유동성(누적)', value: '$1,600M = 20.0%' },
        { label: '일반 IG 회사채', value: '$3,600M = 45.0%' },
        { label: 'HY·오프벤치마크·144A', value: '$2,800M = 35.0%' },
        { label: 'IG 왕복 거래비용', value: '32bp (평시 30bp)' },
      ],
      sourceRefs: [S.ohara, S.ici],
      relatedMetrics: ['cashBufferPct', 'weeklyLiquidityPct', 'illiquidSharePct'],
    },
    {
      id: 't0-memo-coo',
      kind: 'memo',
      time: '15:10',
      from: '펀드 운영본부(COO)',
      to: '포트폴리오매니저 · 리스크',
      subject: '유동성 관리 프로그램 연례 점검 — 미결 항목',
      body: `- 22e-4(유동성 리스크 관리 규칙)상 고유동성 투자 최소 비중(HLIM)은 이사회 결의로 정해져 있으나, **스윙프라이싱 임계·최대 스윙폭은 아직 결의되지 않았습니다**. 결의 없이 적용하려면 이사회 소집과 회계·중개(TA) 처리로 최소 1영업일이 필요합니다.
- 커밋 크레딧라인: 약정 한도 $400M(NAV의 5%), 인출 잔액 0. 공동약정이라 동시 인출 시 배분 조항이 있습니다.
- 현물 바스켓(in-kind) 설정·환매 계약은 지정참가회사(AP) 2곳과 체결되어 있습니다.
- 상위 5개 기관 보유자가 NAV의 31%를 차지합니다. 최대 보유자는 주정부 연금(11%)입니다.`,
      severity: 'warning',
      sourceRefs: [S.mmfReform, S.fsbOef],
      relatedMetrics: ['cashBufferPct'],
    },
    {
      id: 't0-call-analyst',
      kind: 'call',
      time: '14:40',
      caller: '크레딧 애널리스트',
      callee: '포트폴리오매니저',
      tone: 'routine',
      lines: [
        {
          speaker: '크레딧 애널리스트',
          text: '에너지·항공·호텔 익스포저가 비유동 구간에 몰려 있습니다. BBB− 등급 이하가 그 구간의 절반입니다.',
        },
        {
          speaker: '포트폴리오매니저',
          text: '지금 파는 건 싸게 파는 겁니다. 다만 다음 주에 환매가 계속 들어오면 무엇을 먼저 팔지는 오늘 정해두는 게 낫겠습니다.',
        },
      ],
      severity: 'info',
      sourceRefs: [S.maxz],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '사전 준비 패키지',
      prompt:
        '다음 주가 오기 전에 무엇을 해 두시겠습니까? (최대 3개 · A는 단독 선택, E는 A와 함께 선택 불가)',
      context:
        '지금은 아직 선택지가 많습니다. 다음 주에 쓸 수 있는 도구는 오늘 결의해 둔 것뿐입니다 — 스윙프라이싱은 이사회 결의가 없으면 하루가 걸리고, 크레딧라인 증액은 은행 심사가 필요합니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t0-d1-a', 't0-d1-b'],
        ['t0-d1-a', 't0-d1-c'],
        ['t0-d1-a', 't0-d1-d'],
        ['t0-d1-a', 't0-d1-e'],
        ['t0-d1-a', 't0-d1-f'],
        ['t0-d1-c', 't0-d1-e'],
      ],
      dimensions: ['liquidity', 'timeliness', 'compliance'],
      options: [
        {
          id: 't0-d1-a',
          label: '현행 유지 — 현금 7%, 스윙 미결의, 크레딧라인 $400M',
          description:
            '유동성 관리 프로그램을 그대로 두고 다음 주 흐름을 본다. 비용도 변화도 없다. 실행가능성: 항상 가능.',
          effects: [flag('status_quo'), fundFx.setSlicing({ policy: 'horizontal' })],
          expert: {
            rating: 25,
            rationale:
              'FSB Holistic Review와 ESMA 점검은 2020년 3월 다수 개방형 펀드가 희석방지도구를 "준비해 두지 않아서" 쓰지 못했다고 기록한다. 미국 등록 펀드는 2016년부터 스윙프라이싱이 허용되었으나 사전 결의와 회계·중개 인프라가 없어 사실상 사용되지 않았다.',
            historicalNote:
              '2020년 2월 말 대다수 미국 회사채 펀드의 실제 상태. 스윙프라이싱을 쓴 미국 등록 펀드는 사실상 없었다.',
            sourceRefs: [S.fsb, S.esma, S.fsbOef],
          },
          consequences:
            '변경 없음. 다음 주 환매가 커지면 도구를 만드는 데 하루가 걸린다는 점만 기록에 남겼습니다.',
          historical: true,
          feasibility: { basis: '기본 상태 유지', sourceRefs: [S.esma] },
        },
        {
          id: 't0-d1-b',
          label: '스윙프라이싱 임계·최대 스윙폭을 이사회 결의로 사전 확정',
          description:
            '순환매가 NAV의 1%를 넘는 날 스윙을 자동 적용하고 최대 폭을 200bp로 하는 결의를 받는다. 회계·중개(TA) 처리 절차도 함께 확정한다. 실행가능성: 미국 등록 펀드는 2016년 SEC 규칙 개정으로 스윙프라이싱이 허용되어 있었다 — 필요한 것은 결의와 운영 준비뿐이다.',
          effects: [flag('swing_preset'), confidence(2, '이사회: 희석방지 준비 완료')],
          expert: {
            rating: 88,
            rationale:
              'FSB의 2023년 개방형 펀드 권고는 희석방지도구를 "위기 전에 준비해 두고 상시 사용"하는 것을 1순위로 제시하며, 그 근거로 2020년 3월을 든다. SEC의 2023년 MMF 개혁도 같은 방향으로 임의 게이트를 폐지하고 의무 유동성 수수료를 도입했다. 사전 결의가 있어야 당일 적용이 가능하다는 것이 이 사례의 핵심 운영 교훈이다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences:
            '이사회가 임계 1%·최대 200bp 스윙을 결의했습니다. 이후 스윙 적용은 당일 기준가에 반영됩니다.',
          feasibility: {
            basis:
              '2016년 SEC 규칙 개정으로 미국 등록 펀드의 스윙프라이싱 허용(당시 실사용은 드물었음)',
            sourceRefs: [S.fsbOef],
          },
        },
        {
          id: 't0-d1-c',
          label: '현금 비중 7%→10% 선제 확충 — 비유동·IG 구간 축소',
          description:
            '아직 거래비용이 32bp인 시장에서 비유동·IG 구간을 줄여 현금 구간을 NAV의 10%까지 채운다. 기대수익을 일부 포기하는 대신 사다리의 맨 윗칸을 미리 넓힌다. 실행가능성: 정상 시장, 당일 체결·T+2 결제.',
          effects: [
            fundFx.rebuildLadder({ targetDailyPct: 10 }),
            flag('buffer_prepared'),
            counter('preparedCash', 1),
          ],
          expert: {
            rating: 82,
            rationale:
              '3월에 같은 $240M을 만들려면 거래비용이 90bp 이상, 블록은 150bp 이상이었다(O’Hara·Zhou). 현금은 위기 전에만 싸게 살 수 있다. 다만 기대수익을 포기하는 비용은 실재하며, 2/28 시점에 10%가 충분하다는 보장도 없다.',
            sourceRefs: [S.ohara, S.fsb],
          },
          consequences:
            '비례 매도가 체결되어 현금 비중이 10%로 올라갔습니다. 구성 비중은 유지되었습니다.',
          feasibility: { basis: '평시 시장에서 당일 체결', sourceRefs: [S.ohara] },
          calibrationNote: '평시 거래비용 32bp × 규모계수 [CAL]',
        },
        {
          id: 't0-d1-d',
          label: '커밋 크레딧라인 $400M → $800M 증액 약정',
          description:
            '주거래 은행단과 공동약정 한도를 NAV의 10%로 늘린다. 약정 수수료가 들지만 인출 전에는 차입이 아니다. 실행가능성: 2월 말에는 은행들이 아직 여유가 있었다 — 3월 중순 리볼버 인출이 몰린 뒤에는 신규 약정이 훨씬 어려워졌다.',
          effects: [fundFx.extendCreditLine({ amount: 400 })],
          expert: {
            rating: 72,
            rationale:
              '연준 2020년 5월 금융안정보고서는 3~4월 기업 리볼버 인출 $284bn이 은행 대차대조표를 압박했다고 기록한다. 라인은 위기 전에 넓혀 두는 것이고, 위기 중에는 늘릴 수 없다. 다만 크레딧라인은 유동성의 "마지막 층"이지 첫 층이 아니며, 인출 사실이 알려지면 신호가 된다.',
            sourceRefs: [S.fsr],
          },
          consequences: '은행단이 한도 $800M 증액에 동의했습니다. 인출 잔액은 여전히 0입니다.',
          feasibility: { basis: '2월 말 은행 여신 여력 정상', sourceRefs: [S.fsr] },
        },
        {
          id: 't0-d1-e',
          label: '차입으로 BBB·HY 비중 확대 — 스프레드 확대를 매수 기회로',
          description:
            '크레딧라인에서 NAV의 10%를 인출해 벌어진 스프레드의 BBB·HY를 담는다. 금리가 내려가는 국면에서 캐리와 자본이득을 동시에 노린다. 실행가능성: 약정 한도 내 인출은 언제든 가능하다.',
          effects: [fundFx.leverUp({ pctOfNav: 10 }), fundFx.setSlicing({ policy: 'horizontal' })],
          expert: {
            rating: 6,
            rationale:
              '2020년 2월 말 IG 스프레드는 이미 130bp였고 3월 23일 약 400bp, HY는 약 1,100bp까지 갔다. 레버리지는 같은 시장 충격에 NAV를 더 빨리 깎고, 비유동 비중을 올려 환매 대응 능력을 동시에 떨어뜨린다. BIS는 레버리지와 증거금의 상호작용을 3월 국면의 증폭 경로로 지목했다.',
            sourceRefs: [S.feds, S.bis],
          },
          consequences:
            '차입 $800M으로 BBB·HY를 담았습니다. 비유동 비중이 40%를 넘었고 레버리지는 1.10배입니다. 크레딧라인 여력은 사라졌습니다.',
          trap: true,
          trapExplanation:
            '"스프레드가 벌어졌으니 싸다"는 판단은 2월 말에 진실처럼 보였다. 그러나 환매가 들어오는 펀드에서 레버리지는 두 번 벌을 받는다 — 시가 손실이 커지고, 팔 수 없는 자산의 비중이 올라 다음 날 환매를 막을 현금을 만들 수 없게 된다.',
          irreversible: true,
          feasibility: { basis: '약정 한도 내 인출', sourceRefs: [S.fsr] },
          calibrationNote:
            'NAV 10% = $800M 차입 → 비유동 구간 편입, 레버리지 1.10x. 약정 한도를 모두 소진한다 [CAL]',
        },
        {
          id: 't0-d1-f',
          label: '상위 5개 기관 보유자와 사전 접촉 — 환매 계획 확인',
          description:
            '집중도가 높은 보유자에게 먼저 연락해 유동성 계획과 현물(in-kind) 환매 가능성을 확인한다. 비용은 없고, 가장 큰 흐름을 미리 안다. 실행가능성: 상시 가능한 투자자 관리 업무.',
          effects: [flag('holders_engaged'), confidence(3, '대형 보유자와 사전 소통')],
          expert: {
            rating: 80,
            rationale:
              'FSB는 개방형 펀드의 취약성이 "유동성 미스매치 + 선착순 우위"에서 나온다고 본다. 집중된 보유자의 의사를 미리 아는 것은 예측 가능성을 높이고, 대량 환매를 현물로 처리할 여지를 만든다. 다만 접촉 자체가 "무슨 문제가 있나"로 읽힐 위험이 있어 문구가 중요하다.',
            sourceRefs: [S.fsb, S.fsbOef],
          },
          consequences:
            '상위 5개 보유자 중 3곳이 "당분간 비중을 유지한다"고 답했고, 주정부 연금은 "이사회 일정에 따라 4월에 리밸런싱을 검토한다"고 했습니다.',
          feasibility: { basis: '투자자 관리 업무 범위 내', sourceRefs: [S.fsbOef] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "현금·1일 유동성 비중"(7.0%)과 "비유동 비중"(35.0%)을 보세요. 이 두 숫자의 다음 주 경로가 이번 시나리오의 전부입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '개방형 펀드의 문제는 지급능력이 아니라 "오늘 기준가로 환매해 주는 것이 잔존 투자자에게 공정한가"입니다. 희석방지도구(스윙프라이싱)는 그 공정성을 사후가 아니라 당일에 만듭니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: 'B(스윙 사전 결의)는 비용이 거의 없고 이후 모든 턴의 선택지를 살립니다. C(현금 확충)·D(라인 증액)와 조합하십시오. E는 함정입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2020-03-09 (월) 16:00 ET "첫 서킷브레이커"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2020년 3월 9일 (월) 16:00 ET',
  title: '첫 서킷브레이커',
  time: '2020-03-09T16:00:00-04:00',
  entryEffects: [
    {
      id: 't1-open',
      description:
        '3/9: 유가 급락 + 팬데믹 공포 → S&P −7.60%, 첫 서킷브레이커. 10년 국채 0.54% 사상 최저, IG 182bp',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 38,
          govt10yBp: 54,
          govt30yBp: 99,
          igBp: 182,
          hyBp: 640,
          volIndex: 54.46,
          equityIndex: 92.97,
          fundingStressBp: 48,
          bidAskIgBp: 45,
          etfDiscountPct: -1.6,
          treasuryOffRunBp: 6,
          label: '3/9 마감 시세',
        }),
        confidence(-6, '첫 서킷브레이커'),
      ],
    },
    { id: 't1-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
  ],
  eachTick: [
    {
      id: 't1-flow',
      description: '3/9 환매 유입 0.8%',
      effects: [fundFx.markToMarket(), fundFx.redemptionStep({ basePct: REDEMPTION_BASE[1]! })],
    },
  ],
  events: [
    {
      id: 't1-news-cb',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '09:34',
      headline: 'S&P 500 −7% 서킷브레이커 발동 — 1997년 제도 도입 이후 처음',
      body: '유가 급락과 팬데믹 확산이 겹치며 개장 4분 만에 거래가 15분간 중단되었다. S&P 500은 7.60% 하락 마감했다. 10년 국채 수익률은 0.54%로 사상 최저를 기록했고 30년물도 1% 아래로 내려갔다.',
      severity: 'critical',
      sourceRefs: [S.h15],
      relatedMetrics: ['navIndex'],
    },
    {
      id: 't1-market',
      kind: 'market',
      time: '16:05',
      headline: '마감 시세',
      items: [
        { label: '10년 국채', value: '0.54%', change: '2/28 대비 −59bp' },
        { label: '30년 국채', value: '0.99%', change: '−66bp' },
        { label: 'IG 스프레드(OAS)', value: '182bp', change: '+52bp' },
        { label: 'HY 스프레드(OAS)', value: '640bp', change: '+140bp' },
        { label: 'VIX', value: '54.46', change: '+14.4' },
        { label: 'IG 왕복 거래비용', value: '45bp', change: '평시 30bp' },
      ],
      sourceRefs: [S.h15, S.vix, S.ohara],
    },
    {
      id: 't1-memo-ta',
      kind: 'memo',
      time: '15:40',
      from: '중개·수탁(TA)팀',
      to: '포트폴리오매니저',
      subject: '당일 환매 접수 요약',
      body: `- 오늘 접수 순환매 **{{metric:redemptionsPendingPct}}**, 누적 **{{metric:redemptionsCumulativePct}}**.
- 플랫폼(퇴직연금·랩) 경유분이 접수액의 62%입니다. 이 채널은 하루 늦게 반영되므로 내일 추가 접수가 예상됩니다.
- 현금·1일 유동성 잔액 **{{metric:cashBufferPct}}**.`,
      severity: 'warning',
      sourceRefs: [S.ici],
      relatedMetrics: ['redemptionsPendingPct', 'cashBufferPct'],
    },
    {
      id: 't1-dialogue-desk',
      kind: 'dialogue',
      time: '11:20',
      title: '트레이딩 데스크',
      lines: [
        {
          speaker: '채권 트레이더',
          text: '국채는 아직 정상입니다. 온·오프더런 격차 6bp. IG는 딜러가 호가를 내지만 사이즈가 작습니다 — $5M 단위로 쪼개야 합니다.',
        },
        {
          speaker: '포트폴리오매니저',
          text: '오늘은 국채만 팔면 비용이 거의 없습니다. 문제는 그 다음입니다.',
        },
      ],
      severity: 'info',
      sourceRefs: [S.ohara, S.maxz],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '환매 충당 방식 — 유동성 사다리의 어느 칸부터',
      prompt: '앞으로의 환매를 어떤 순서로 충당하시겠습니까? (1개)',
      context:
        '오늘 접수분은 이미 기존 정책대로 처리되었습니다. 지금 정하는 것은 **다음 영업일부터**의 매도 순서이며, 이 결정이 남는 포트폴리오의 모양을 정합니다.',
      requiredConcepts: [],
      dimensions: ['liquidity', 'marketRisk'],
      options: [
        {
          id: 't1-d1-a',
          label: '현금·국채부터 순서대로 매도 (수평 슬라이싱)',
          description:
            '가장 유동적인 칸부터 비운다. 오늘의 거래비용이 거의 없고 기준가 하락도 최소다. 실행가능성: 국채는 당일 체결·당일 결제.',
          effects: [
            fundFx.setSlicing({ policy: 'horizontal' }),
            flag('horizontal_policy'),
            counter('policySetTurn', 1),
          ],
          expert: {
            rating: 32,
            rationale:
              'Ma·Xiao·Zeng(2022)는 2020년 3월 회사채 펀드가 현금·국채 등 유동자산을 불균형하게 먼저 팔았고("역 유동성 도피"), 그 결과 잔존 포트폴리오의 유동성이 저하되었음을 거래 데이터로 보인다. 오늘의 기준가는 좋아 보이지만 비용은 남는 투자자에게 이연될 뿐이다.',
            historicalNote:
              '2020년 3월 다수 회사채 펀드의 실제 행동. 첫 며칠 동안 환매는 대부분 현금·국채로 충당되었다.',
            sourceRefs: [S.maxz, S.fsb],
          },
          consequences:
            '국채·현금으로 환매를 충당했습니다. 거래비용은 거의 없었고 기준가는 시장 변동분만 반영했습니다. 현금 비중이 내려갔습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '규율 있어 보이는 선택이다 — 비싼 것을 팔지 않았고 오늘의 기준가를 지켰다. 그러나 유동성 사다리의 위 칸만 비우면 남는 것은 가장 팔기 어려운 종이뿐이다. 3월 18일에 현금이 없는 상태로 하루 2%의 환매를 맞는 것과, 3월 9일에 40bp를 더 치르는 것 중 무엇이 비싼지는 나중에야 알 수 있다.',
          feasibility: { basis: '국채 당일 체결·당일 결제', sourceRefs: [S.ohara] },
          calibrationNote: '현금 구간 거래비용 2bp, 주간 구간 15bp × 스트레스 배수 [CAL]',
        },
        {
          id: 't1-d1-b',
          label: '네 구간에서 비례 매도 (수직 슬라이싱)',
          description:
            '현금·국채·IG·비유동을 보유 비중대로 함께 판다. 오늘 비용은 더 크지만 남는 포트폴리오의 구성이 변하지 않는다. 비유동 구간은 당일 처분 한도까지만 소화된다. 실행가능성: 비유동 구간은 당일 잔고의 2.5%(스트레스 계수 적용) 한도 — 완전한 비례는 불가능하다.',
          effects: [
            fundFx.setSlicing({ policy: 'vertical' }),
            flag('vertical_policy'),
            counter('policySetTurn', 1),
          ],
          expert: {
            rating: 86,
            rationale:
              'FSB의 개방형 펀드 권고는 환매 비용을 "환매하는 자가 부담"하게 만드는 것을 원칙으로 제시한다. 비례 매도는 그 원칙의 포트폴리오 측 표현이다 — 남는 투자자에게 열화된 포트폴리오를 넘기지 않는다. 다만 스트레스 시장에서 비유동 구간은 실제로 팔리지 않으므로 비례는 근사일 뿐이라는 한계가 있다.',
            sourceRefs: [S.fsbOef, S.maxz],
          },
          consequences:
            '비례 매도를 시작했습니다. 오늘 거래비용이 수평 방식보다 컸지만 구간 비중은 유지되었습니다. 비유동 구간은 처분 한도까지만 팔렸습니다.',
          feasibility: {
            basis: '구간별 당일 처분 한도(주간 30% · 월간 8% · 비유동 2.5%, 스트레스 계수 적용)',
            sourceRefs: [S.ohara],
          },
          calibrationNote: '구간별 비용 2/15/40/120bp × (거래비용bp/30) × 규모계수 [CAL]',
        },
        {
          id: 't1-d1-c',
          label: '절반은 현금, 절반은 비례 (혼합)',
          description:
            '오늘 필요한 금액의 절반은 현금 구간에서, 나머지 절반은 비례로 조달한다. 비용과 구성 열화를 절충한다. 실행가능성: 두 방식의 조합, 운영상 제약 없음.',
          effects: [fundFx.setSlicing({ policy: 'mixed' }), counter('policySetTurn', 1)],
          expert: {
            rating: 62,
            rationale:
              '절충안은 두 위험을 모두 줄이지만 어느 쪽도 해결하지 않는다. 현금 소진 속도는 수평의 절반, 구성 열화도 절반이다. 사후평가가 권고하는 방향(환매자 비용 부담)에 부분적으로만 부합한다.',
            sourceRefs: [S.fsbOef],
          },
          consequences:
            '절반씩 조달했습니다. 현금 비중과 비유동 비중이 모두 완만하게 움직였습니다.',
          feasibility: { basis: '두 방식의 조합', sourceRefs: [S.ohara] },
        },
        {
          id: 't1-d1-d',
          label: '비유동 구간부터 매도 — 비싼 것을 먼저 처분',
          description:
            '팔기 어려운 HY·오프벤치마크를 먼저 정리해 나중을 대비한다. 오늘 비용은 가장 크지만 포트폴리오는 유동적으로 바뀐다. 실행가능성: 당일 처분 한도 2.5%가 강하게 구속한다.',
          effects: [fundFx.setSlicing({ policy: 'illiquidFirst' }), counter('policySetTurn', 1)],
          expert: {
            rating: 38,
            rationale:
              '방향은 방어적이지만 시점이 최악이다. 비유동 종이는 이 국면에서 왕복 120bp 이상, 블록은 150bp를 넘었고(O’Hara·Zhou) 당일 처분 한도 때문에 필요한 금액을 만들지도 못한다. 잔존 투자자는 실현 손실을 즉시 떠안는다.',
            sourceRefs: [S.ohara],
          },
          consequences:
            'HY 물량을 던졌지만 한도에 막혀 일부만 체결되었고, 체결분의 비용이 컸습니다. 기준가가 눈에 띄게 내려갔습니다.',
          feasibility: {
            basis: '비유동 구간 당일 처분 한도 2.5% × 스트레스 계수',
            sourceRefs: [S.ohara],
          },
        },
        {
          id: 't1-d1-e',
          label: '크레딧라인을 먼저 인출해 매도 없이 충당',
          description:
            '약정 한도에서 $200M을 인출해 이번 주 환매를 매도 없이 지급한다. 시장에 물량을 내지 않는다. 실행가능성: 약정 한도 내 인출은 당일 가능.',
          effects: [
            fundFx.drawCreditLine({ amount: 200 }),
            fundFx.setSlicing({ policy: 'horizontal' }),
            counter('policySetTurn', 1),
          ],
          expert: {
            rating: 48,
            rationale:
              '파이어세일을 늦추는 정당한 도구이고 연준 금융안정보고서도 은행 라인을 유동성 층으로 인정한다. 그러나 라인은 상환해야 하는 부채이고, 인출이 알려지면 "저 펀드는 자산을 팔 수 없다"는 신호가 된다. 무엇보다 매도 순서 문제 자체를 며칠 미룰 뿐이다.',
            sourceRefs: [S.fsr, S.fsb],
          },
          consequences:
            '$200M을 인출해 환매를 지급했습니다. 자산은 그대로지만 차입 잔액이 생겼고 레버리지가 올라갔습니다.',
          feasibility: { basis: '커밋 라인 당일 인출', sourceRefs: [S.fsr] },
        },
      ],
    },
    {
      id: 't1-d2',
      title: '이사회·대형 보유자 소통',
      prompt: '오늘 일어난 일을 누구에게 언제 알리시겠습니까? (1개)',
      context:
        '아직 위기라고 부를 단계는 아닙니다. 그러나 상위 5개 보유자가 NAV의 31%이고, 이들이 같은 날 움직이면 오늘의 계산은 무의미해집니다.',
      required: false,
      dimensions: ['communication', 'timeliness'],
      options: [
        {
          id: 't1-d2-a',
          label: '월간 정기 보고까지 대기',
          description:
            '정해진 보고 주기를 지킨다. 지금 특별히 알릴 내용이 없다는 판단이다. 실행가능성: 항상 가능.',
          effects: [flag('comms_delayed'), fundFx.redeemAmp({ factor: 1.05, reason: '정보 공백' })],
          expert: {
            rating: 30,
            rationale:
              'FSB는 개방형 펀드의 선착순 우위가 "정보 비대칭 + 오늘 기준가로 나갈 수 있다는 확신"에서 나온다고 본다. 정보 공백은 큰 보유자가 최악을 가정하고 먼저 움직이게 만든다.',
            historicalNote:
              '많은 펀드가 3월 중순에야 보유자 소통을 시작했고, 그때는 이미 환매가 정점 부근이었다.',
            sourceRefs: [S.fsb, S.fsbOef],
          },
          consequences:
            '별도 보고 없이 하루가 지났습니다. 오후에 대형 보유자 두 곳이 운용보고서 파일을 다운로드했다는 기록이 남았습니다.',
          historical: true,
          feasibility: { basis: '정기 보고 주기 준수', sourceRefs: [S.fsb] },
        },
        {
          id: 't1-d2-b',
          label: '이사회 의장과 상위 5개 보유자에게 같은 수치를 당일 공유',
          description:
            '접수 환매, 현금 비중, 유동성 사다리 구성, 매도 순서 정책을 같은 표로 동시에 보낸다. 실행가능성: 사실 공시이며 선별 공개가 아니다.',
          effects: [
            flag('comms_early'),
            confidence(4, '동일 수치 동시 공유'),
            fundFx.redeemAmp({ factor: 0.94, reason: '예측 가능성 확보' }),
          ],
          expert: {
            rating: 85,
            rationale:
              'ESMA의 2020년 점검과 FSB 권고는 환매 압력 국면에서 투자자 소통과 도구 사용 계획의 사전 고지를 회복력의 일부로 본다. 모든 보유자에게 같은 수치를 같은 시각에 주는 것은 선별 공개 문제도 피한다.',
            sourceRefs: [S.esma, S.fsbOef],
          },
          consequences:
            '보유자 3곳이 회신했고, 그중 한 곳은 "당분간 움직이지 않겠다"고 확인했습니다. 이사회 의장은 주 2회 브리핑을 요청했습니다.',
          feasibility: { basis: '전체 보유자 동시 고지', sourceRefs: [S.esma] },
        },
        {
          id: 't1-d2-c',
          label: '최대 보유자에게만 개별 전화',
          description:
            '가장 큰 위험인 주정부 연금에만 먼저 연락해 의중을 확인한다. 실행가능성: 실무상 흔하지만 선별 공개 논란이 있다.',
          effects: [
            flag('comms_selective'),
            regulator({ add: 1 }, '선별 공개 우려'),
            fundFx.redeemAmp({ factor: 0.98, reason: '최대 보유자만 안정' }),
          ],
          expert: {
            rating: 40,
            rationale:
              '가장 큰 흐름은 잡을 수 있으나, 나머지 보유자에게 제공되지 않은 정보를 준 것이 되어 공정대우 문제가 생긴다. 소식이 퍼지면 나머지 보유자의 선착순 동기가 오히려 커진다.',
            sourceRefs: [S.fsbOef, S.esma],
          },
          consequences:
            '주정부 연금은 "4월 이사회까지 움직이지 않는다"고 답했습니다. 다른 보유자 한 곳이 "우리는 왜 연락을 못 받았느냐"고 문의했습니다.',
          feasibility: { basis: '개별 투자자 접촉', sourceRefs: [S.esma] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '"현금·1일 유동성 비중"과 "비유동 비중"을 함께 보세요. 수평 슬라이싱은 앞의 숫자를 내리고 뒤의 숫자를 올립니다.',
    },
    {
      level: 2,
      decisionId: 't1-d1',
      text: '오늘의 비용(거래비용)과 내일의 비용(남는 포트폴리오의 질)은 다른 사람이 부담합니다. 오늘 나가는 사람이 오늘 비용을, 남는 사람이 내일 비용을 냅니다.',
    },
    {
      level: 3,
      decisionId: 't1-d1',
      text: '비례 매도(B)는 오늘 더 비싸지만 "누적 희석"과 "비유동 비중"을 지킵니다. 스윙프라이싱이 준비돼 있다면 오늘 비용도 환매자에게 돌릴 수 있습니다.',
    },
  ],
}

/**
 * T2 스윙프라이싱 결정의 다단계 대화 — 펀드 이사회 의장과의 통화.
 *
 * 발언은 개연성 있는 재구성이며 실제 녹취가 아니다.
 * 숫자 약속(스윙폭)은 `commitReplies`로 이산 응답이 되고 `counters.swingPromisedBp`에 기록되며,
 * 그 약속을 지켰는지는 **다음 턴의 지연효과**가 판정한다(옵션 t2-d2-a의 delayedEffects).
 */
export const SWING_PROMISE_COUNTER = 'swingPromisedBp'

const swingDialogue: DialogueStep<AssetManagerState>[] = [
  {
    id: 'sw-open',
    lines: [
      {
        speaker: '이사회 의장',
        text: '오늘 순환매가 순자산의 1%를 넘었습니다. 지금 환매를 지급하는 가격이 남는 수익자에게 공정합니까?',
      },
    ],
    note: '여기서 보고하는 수치와 약속한 스윙폭은 다음 영업일 이사회 기록과 대조됩니다.',
    replies: [
      {
        id: 'sw-open-measure',
        label: '오늘의 실제 조달 비용과 누적 희석을 수치로 보고',
        next: 'sw-level',
        expert: {
          rating: 85,
          rationale: '희석을 측정하지 않으면 스윙폭도 정할 수 없다. 측정이 먼저다.',
        },
      },
      {
        id: 'sw-open-soft',
        label: '"비용은 크지 않다"고 답한다',
        next: 'sw-level',
        expert: { rating: 32, rationale: '측정되지 않은 비용은 언제나 작아 보인다.' },
        trap: true,
        trapExplanation:
          '희석은 눈에 보이지 않는다 — 기준가는 시장 변동에 묻히고, 나간 사람은 이미 없다. 재지 않으면 없는 것이 된다.',
      },
      {
        id: 'sw-open-noauth',
        label: '사전 결의가 없어 오늘은 쓸 수 없다고 답한다',
        resolvesTo: 't2-d2-a',
        expert: {
          rating: 30,
          rationale:
            '사실이다 — 그리고 그 사실이 이 사례의 교훈이다. 도구는 위기 전에 결의해 두어야 당일 쓸 수 있다.',
        },
      },
    ],
  },
  {
    id: 'sw-level',
    lines: [
      {
        speaker: '이사회 의장',
        text: '그럼 폭은 몇 bp로 하시겠습니까? 사전 결의가 없으니 오늘 정해도 반영은 내일부터입니다.',
      },
    ],
    note: '여기서 약속한 폭은 다음 영업일에 실제 적용 여부로 평가됩니다.',
    replies: commitReplies<AssetManagerState>(SWING_PROMISE_COUNTER, [0, 60, 200], {
      unit: 'bp',
      label: (v) =>
        v === 0 ? '적용하지 않음(0bp)' : v === 60 ? '60bp — 오늘 실제 비용 수준' : '200bp — 최대폭',
      resolvesTo: (v) => (v === 0 ? 't2-d2-a' : v === 200 ? 't2-d2-c' : undefined),
      next: (v) => (v === 60 ? 'sw-timing' : undefined),
      expert: (v) => ({
        rating: v === 60 ? 88 : v === 200 ? 45 : 26,
        rationale:
          v === 60
            ? '스윙폭을 추정된 실제 거래비용에 맞추는 것이 FSB 2023 권고와 SEC 2023 개혁의 공통 설계다.'
            : v === 200
              ? '환매는 줄지만 스윙은 비용 전가 장치이지 억제 장치가 아니다. 실제 비용을 크게 넘으면 환매자에게 부당하다.'
              : '적용하지 않으면 오늘의 비용은 전부 남는 수익자가 낸다.',
      }),
    }),
  },
  {
    id: 'sw-timing',
    lines: [
      {
        speaker: '이사회 의장',
        text: '60bp로 하겠습니다. 임시 이사회를 열어 바로 결의합니까, 아니면 이번 주 흐름을 더 보고 정합니까?',
      },
    ],
    replies: [
      {
        id: 'sw-time-today',
        label: '오늘 기준가 적용을 지시하고 회계·중개 처리를 시작한다',
        resolvesTo: 't2-d2-b',
        expert: {
          rating: 88,
          rationale: '결의가 없으면 반영은 내일이지만, 처리를 오늘 시작해야 내일 적용된다.',
        },
      },
      {
        id: 'sw-time-board',
        label: '임시 이사회를 열어 임계·최대폭을 함께 결의한다',
        resolvesTo: 't2-d2-d',
        expert: {
          rating: 68,
          rationale:
            '하루 늦지만 이후 모든 날에 당일 적용 권한이 생긴다. 준비가 없던 펀드의 차선책이다.',
        },
      },
      {
        id: 'sw-time-defer',
        label: '이번 주 흐름을 더 보고 결정하겠다고 답한다',
        resolvesTo: 't2-d2-a',
        expert: {
          rating: 22,
          rationale:
            '폭을 이미 산정해 놓고 적용을 미루는 것은 측정하지 않은 것보다 나쁘다 — 비용을 알면서 남는 수익자에게 넘긴 것이 된다.',
        },
        trap: true,
        trapExplanation:
          '"조금 더 보자"는 위기 중 가장 자주 나오는 답이고, 그 하루의 희석은 회수되지 않는다. 이사회에 폭을 보고한 기록만 남는다.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------------------------
// T2 — 2020-03-12 (목) 16:00 ET "ETF가 먼저 말한다"
// ---------------------------------------------------------------------------------------------
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2020년 3월 12일 (목) 16:00 ET',
  title: 'ETF가 먼저 말한다',
  time: '2020-03-12T16:00:00-04:00',
  entryEffects: [
    {
      id: 't2-open',
      description:
        '3/12: 2차 서킷브레이커. IG 236bp, 회사채 ETF가 NAV 대비 −5.02%에 거래. 거래비용 62bp',
      effects: [
        fundFx.marketOpen({
          govt2yBp: 50,
          govt10yBp: 88,
          govt30yBp: 149,
          igBp: 236,
          hyBp: 760,
          volIndex: 75.47,
          equityIndex: 83.97,
          fundingStressBp: 62,
          bidAskIgBp: 62,
          etfDiscountPct: -5.02,
          treasuryOffRunBp: 12,
          label: '3/12 마감 시세',
        }),
        confidence(-8, '2차 서킷브레이커·ETF 대규모 할인'),
      ],
    },
    { id: 't2-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
  ],
  eachTick: [
    {
      id: 't2-flow',
      description: '3/12 환매 유입 1.4%',
      effects: [fundFx.markToMarket(), fundFx.redemptionStep({ basePct: REDEMPTION_BASE[2]! })],
    },
  ],
  events: [
    {
      id: 't2-news-cb2',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '09:36',
      headline: '두 번째 서킷브레이커 — S&P 500 하루 9.5% 급락, 약세장 진입 확인',
      body: '개장 직후 다시 거래가 중단되었다. 유럽중앙은행이 예금금리를 동결하고 매입 확대를 발표했으나 시장은 실망으로 반응했다. 회사채 거래는 딜러가 대차대조표를 쓰지 않으면서 사실상 중개만 이루어지고 있다.',
      severity: 'critical',
      sourceRefs: [S.rt0312, S.ohara],
    },
    {
      id: 't2-data-etf',
      kind: 'data',
      time: '16:10',
      title: '회사채 ETF 종가 vs 순자산가치(NAV)',
      rows: [
        { label: '대표 IG 회사채 ETF 종가 괴리', value: '−5.02% (올해 최대 할인)' },
        { label: '전일 괴리', value: '−3.29%' },
        { label: 'ETF 당일 거래대금', value: '기초 회사채 시장 거래대금의 여러 배' },
        {
          label: '자사 포트폴리오 평가가격 출처',
          value: '평가기관 매트릭스 프라이싱(전일 기준 다수)',
        },
        { label: 'IG 왕복 거래비용', value: '62bp' },
      ],
      severity: 'critical',
      sourceRefs: [S.etfPrimary, S.fimsac],
      relatedMetrics: ['market.etfDiscountPct'],
    },
    {
      id: 't2-dialogue-ap',
      kind: 'dialogue',
      time: '14:05',
      title: '지정참가회사(AP) 크레딧 데스크',
      lines: [
        {
          speaker: 'AP 트레이더',
          text: '오늘 ETF는 수천 번 거래됐습니다. 그 안에 든 회사채 중 40%가량은 하루에 한두 번 거래됐고요. 어느 쪽이 진짜 가격인지는 각자 판단할 문제입니다.',
        },
        {
          speaker: '포트폴리오매니저',
          text: '현물 바스켓으로 설정(create)해서 지분을 시장에 파는 경로는 열려 있습니까?',
        },
        {
          speaker: 'AP 트레이더',
          text: '열려 있습니다. 다만 할인폭만큼은 여러분이 부담하는 셈입니다. 대신 블록 호가를 찾을 필요가 없죠.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.etfPrimary, S.fimsac],
    },
    {
      id: 't2-memo-risk',
      kind: 'memo',
      time: '15:30',
      from: '리스크관리본부',
      to: '포트폴리오매니저 · 이사회 의장',
      subject: '평가가격과 시장가격의 괴리',
      body: `- 우리 평가가격은 평가기관 매트릭스 프라이싱에 의존하며, 거래가 없는 종목은 사실상 전일 가격이 유지됩니다.
- ETF 할인폭 −5.02%는 (a) ETF 유동성 프리미엄 붕괴이거나 (b) 기초자산 평가가격이 현실보다 높다는 신호입니다. 둘 중 어느 쪽이냐에 따라 오늘 기준가로 환매해 주는 것이 잔존 투자자에게 공정한지가 달라집니다.
- 현재 누적 환매 **{{metric:redemptionsCumulativePct}}**, 누적 희석 **{{metric:dilutionBp}}**bp.`,
      severity: 'critical',
      sourceRefs: [S.fimsac, S.fsbOef],
      relatedMetrics: ['dilutionBp', 'redemptionsCumulativePct'],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: 'ETF 할인폭을 어떻게 읽을 것인가',
      prompt: '회사채 ETF의 NAV 대비 −5.02% 할인에 어떻게 대응하시겠습니까? (1개)',
      context:
        '이 질문은 2020년 3월에 실제로 크게 다투어졌습니다. ETF가 틀렸다면 기준가는 정확하고, ETF가 맞다면 우리 기준가가 며칠 늦은 가격으로 환매를 지급하고 있다는 뜻입니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't2-d1-a',
          label: '가격 발견 신호로 수용 — 평가가격 하향, 매도 비용 가정 현실화',
          description:
            'ETF가 시사하는 수준의 60%까지 평가가격을 낮추고, 이후 매도 비용 가정도 그에 맞춘다. 오늘 기준가가 즉시 내려간다. 실행가능성: 공정가치 평가 절차(이사회 승인 평가 방법론) 안에서 가능하다.',
          effects: [fundFx.markToEtfImplied({ fraction: 0.6 }), flag('marks_current')],
          expert: {
            rating: 84,
            rationale:
              'SEC FIMSAC 자료는 2020년 3월 채권 ETF 할인의 상당 부분이 "ETF의 오작동"이 아니라 기초자산 평가가격의 지연에서 왔다고 정리한다. 평가가 현실을 따라가지 않으면 오늘 환매하는 사람이 과대평가된 가격으로 나가고 그 차액은 남는 사람이 낸다. 다만 하향은 즉시 기준가를 떨어뜨려 환매를 자극할 수 있다는 캐비앳이 있다.',
            sourceRefs: [S.fimsac, S.fsbOef],
          },
          consequences:
            '평가가격을 하향해 기준가가 즉시 내려갔습니다. 대신 매도 시 추가 충격이 줄었고, 환매 지급가가 현실에 가까워졌습니다.',
          feasibility: {
            basis: '이사회 승인 공정가치 평가 방법론 내 조정',
            sourceRefs: [S.fimsac],
          },
          calibrationNote:
            '할인폭의 60% 반영 → 월간·비유동 구간 시가 하향, 거래비용 계수 ×0.9 [CAL]',
        },
        {
          id: 't2-d1-b',
          label: '현물 바스켓으로 설정 후 ETF 지분 매도 — 발행시장 경로 활용',
          description:
            '보유 회사채 $400M을 AP에 인도해 ETF 지분을 받고 거래소에서 판다. 블록 호가를 찾을 필요가 없고 구간별 처분 한도를 우회한다. 비용은 할인폭 + 설정 수수료. 실행가능성: AP 2곳과 현물 설정·환매 계약이 체결되어 있다.',
          effects: [fundFx.sellViaEtfCreation({ amount: 400, feeBp: 25 })],
          expert: {
            rating: 74,
            rationale:
              '2020년 3월 다수 운용사가 실제로 쓴 경로다. 발행시장(in-kind)은 개별 종목 호가 없이 바스켓 단위로 위험을 넘기며, 비유동 구간의 당일 처분 한도를 우회한다. 다만 할인폭을 그대로 치르는 것이고, ETF 자체의 가격이 왜 할인인지에 대한 판단은 미룬다.',
            historicalNote:
              '발행시장 통계는 이 기간 현물 설정·환매가 크게 늘었음을 보여준다. 채권 ETF는 이 국면에서 "가격 발견 장치"로 기능했다.',
            sourceRefs: [S.etfPrimary, S.fimsac],
          },
          consequences:
            '$400M 바스켓을 인도하고 지분을 매도했습니다. 현금 구간이 채워졌고 월간·비유동 구간이 함께 줄었습니다.',
          feasibility: { basis: 'AP와 체결된 현물 설정 계약', sourceRefs: [S.etfPrimary] },
          calibrationNote:
            '비용 = 할인폭(535bp) + 설정 수수료 25bp; 구간 배분 월간 60% / 비유동 40% [CAL]',
        },
        {
          id: 't2-d1-c',
          label: '일시적 가격 오류로 판단 — 현금으로 할인된 ETF 매수',
          description:
            '−5.02%는 유동성 프리미엄의 일시적 붕괴이며 며칠 내 되돌아온다고 본다. 현금 구간에서 $240M으로 ETF를 산다. 실행가능성: 거래소 매수는 즉시 가능.',
          effects: [fundFx.buyEtf({ amount: 240 }), flag('bought_etf_discount')],
          expert: {
            rating: 12,
            rationale:
              '이 베팅은 두 번 틀린다. 첫째, 할인은 3월 중순 내내 유지되었고 기초 회사채 가격도 더 내려갔다 — IG 스프레드는 236bp에서 400bp 부근까지 더 벌어졌다. 둘째, 환매가 들어오는 펀드에서 현금을 위험자산으로 바꾸는 것은 유동성 사다리의 맨 윗칸을 스스로 비우는 행위다. FSB는 3월 국면의 핵심 취약성을 바로 이 유동성 미스매치로 지목한다.',
            sourceRefs: [S.feds, S.fsb],
          },
          consequences:
            '$240M으로 ETF를 매수했습니다. 현금 비중이 급감했고 비유동 비중이 올라갔습니다. 할인폭은 다음 날에도 좁혀지지 않았습니다.',
          trap: true,
          trapExplanation:
            '"싸다"와 "살 수 있다"는 다른 문제다. 할인이 진짜 차익이었다 해도, 그것을 수확하려면 며칠을 버텨야 하고 그 며칠 동안 환매는 매일 들어온다. 유동성 위기에서 현금은 수익률이 아니라 옵션이다.',
          irreversible: true,
          feasibility: { basis: '거래소 매수', sourceRefs: [S.etfPrimary] },
        },
        {
          id: 't2-d1-d',
          label: '평가기관 가격 유지 — ETF 괴리는 참고만',
          description:
            '평가기관의 매트릭스 프라이싱을 그대로 쓰고 ETF 괴리는 리스크 보고에만 기재한다. 실행가능성: 기존 절차 유지.',
          effects: [flag('marks_stale'), counter('staleMarks', 1)],
          expert: {
            rating: 28,
            rationale:
              '절차적으로는 방어할 수 있지만, 실질은 오늘 나가는 사람에게 어제 가격을 주는 것이다. FSB 권고가 "선착순 우위 제거"를 핵심으로 삼는 이유가 여기에 있다. 평가가 늦으면 스윙폭도 과소 설정된다.',
            historicalNote:
              '2020년 3월 뮤추얼펀드 기준가가 기초 회사채의 실제 체결가를 며칠 늦게 따라갔다는 점은 SEC FIMSAC 논의의 핵심 쟁점이었다. 대다수 펀드는 평가기관 가격을 그대로 썼다.',
            sourceRefs: [S.fsbOef, S.fimsac],
          },
          consequences:
            '기존 평가를 유지했습니다. 기준가는 상대적으로 높게 유지되었고, 환매 접수는 줄지 않았습니다.',
          historical: true,
          feasibility: { basis: '기존 평가 절차 유지', sourceRefs: [S.fimsac] },
        },
      ],
    },
    {
      id: 't2-d2',
      title: '스윙프라이싱 적용 여부와 폭',
      prompt: '오늘 기준가에 스윙프라이싱을 적용하시겠습니까? 적용한다면 몇 bp입니까? (1개)',
      context:
        '오늘 순환매는 NAV의 1%를 넘었습니다. 사전 결의가 있으면 당일 기준가에 반영되고, 없으면 이사회 승인·중개 처리로 내일부터 적용됩니다. 이사회 의장이 통화를 요청했습니다.',
      dimensions: ['liquidity', 'communication', 'compliance'],
      steps: swingDialogue,
      options: [
        {
          id: 't2-d2-a',
          label: '적용하지 않음 — 기준가 그대로',
          description:
            '스윙을 쓰지 않고 관행대로 순자산가치 그대로 환매를 지급한다. 실행가능성: 기본 상태.',
          effects: [fundFx.setSwing({ bp: 0 }), counter('swingSkipped', 1)],
          // 대화에서 이사회에 폭을 보고해 놓고 적용하지 않은 경우에만 발동한다
          // (`counters.swingPromisedBp`는 commitReplies가 기록한다).
          delayedEffects: [
            {
              afterTurns: 1,
              when: { counter: SWING_PROMISE_COUNTER, gte: 60 },
              description:
                '이사회에 스윙폭을 보고하고도 적용하지 않음 → 이사회 신뢰 하락, 환매 가속',
              effects: [
                confidence(-5, '약속한 희석방지도구 미적용'),
                fundFx.redeemAmp({ factor: 1.03, reason: '이사회 보고 후 미적용' }),
              ],
            },
          ],
          expert: {
            rating: 26,
            rationale:
              '2020년 3월 미국 등록 펀드의 실제 관행이다. 그 결과 환매 비용은 전부 남는 투자자가 부담했고, "오늘 나가면 비용을 안 낸다"는 선착순 우위가 유지되어 환매를 스스로 키웠다. FSB는 이 구조를 2023년 권고의 출발점으로 삼는다.',
            historicalNote:
              '미국에서 스윙프라이싱을 실제로 적용한 등록 펀드는 사실상 없었다. 유럽 일부 펀드는 적용했다.',
            sourceRefs: [S.fsbOef, S.esma],
          },
          consequences: '기준가 그대로 환매를 지급했습니다. 누적 희석이 늘었습니다.',
          historical: true,
          feasibility: { basis: '기본 상태', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't2-d2-b',
          label: '스윙 60bp 적용 — 실제 거래비용 수준',
          description:
            '오늘의 실제 조달 비용에 가깝게 60bp를 환매자에게 전가한다. 사전 결의가 있으면 당일, 없으면 내일부터 반영된다. 실행가능성: 사전 결의 시 당일 기준가 반영, 미결의 시 이사회 승인 후 익영업일.',
          effects: [
            fundFx.applySwing({ bp: 60 }),
            fundFx.redeemAmp({ factor: 0.9, reason: '선착순 우위 축소' }),
          ],
          expert: {
            rating: 88,
            rationale:
              '스윙폭을 실제 거래비용에 맞추면 희석은 이론상 0이 되고, 동시에 "오늘 나가면 공짜"라는 동기가 사라져 환매 자체가 줄어든다. FSB 2023 권고와 SEC의 2023년 MMF 개혁(의무 유동성 수수료)이 같은 설계를 채택했다. 근거가 두 건의 공식 사후 규제 조치다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences:
            '스윙 60bp가 반영되었습니다. 환매 접수 속도가 눈에 띄게 둔화되었고 희석 누적이 멈췄습니다.',
          feasibility: {
            basis: '2016년 SEC 규칙상 허용; 당일 적용은 사전 결의가 있을 때만',
            sourceRefs: [S.fsbOef],
          },
        },
        {
          id: 't2-d2-c',
          label: '스윙 200bp 적용 — 최대폭으로 환매 억제',
          description:
            '실제 비용보다 훨씬 큰 폭을 적용해 환매를 강하게 억제한다. 실행가능성: 사전 결의된 최대폭 한도 내.',
          effects: [
            fundFx.applySwing({ bp: 200 }),
            fundFx.redeemAmp({ factor: 0.78, reason: '징벌적 스윙' }),
            confidence(-6, '징벌적 스윙 논란'),
            regulator({ add: 1 }, '스윙폭 적정성 조회'),
          ],
          expert: {
            rating: 45,
            rationale:
              '환매는 확실히 줄지만 스윙은 비용 전가 장치이지 환매 억제 장치가 아니다. 실제 비용을 크게 넘는 폭은 환매자에게 부당한 부담을 지우고 감독당국의 적정성 조회를 부른다. FSB 권고도 "추정된 실제 비용"에 연동하도록 설계되어 있다.',
            sourceRefs: [S.fsbOef, S.mmfReform],
          },
          consequences:
            '환매가 크게 줄었습니다. 대신 두 보유자가 스윙폭 산정 근거를 서면으로 요구했고, 감독당국도 문의했습니다.',
          feasibility: { basis: '사전 결의 최대폭 200bp 한도 내', sourceRefs: [S.fsbOef] },
        },
        {
          id: 't2-d2-d',
          label: '이사회를 소집해 내일부터 적용하기로 결의',
          description:
            '오늘은 적용하지 않고, 임시 이사회를 소집해 임계·폭을 정한 뒤 내일부터 적용한다. 실행가능성: 임시 이사회 소집과 중개(TA) 처리로 최소 1영업일.',
          // applySwing이 먼저 실행되어 (아직 사전 결의가 없으므로) 익영업일 적용으로 예약되고,
          // 그 다음 flag('swing_preset')이 이후 턴의 당일 적용 권한을 연다.
          effects: [
            fundFx.applySwing({ bp: 60 }),
            flag('swing_preset'),
            confidence(1, '이사회 소집'),
          ],
          expert: {
            rating: 66,
            rationale:
              '준비가 없던 펀드가 취할 수 있는 최선이다. 하루 늦지만 이후 모든 날에 도구가 생긴다. 그 하루의 희석은 회수되지 않는다는 점이 "위기 전에 결의해 두라"는 교훈의 값이다.',
            sourceRefs: [S.fsbOef, S.esma],
          },
          consequences:
            '임시 이사회가 임계 1%·스윙 60bp를 결의했습니다. 내일 기준가부터 적용됩니다.',
          feasibility: {
            basis: '임시 이사회 소집(당일 가능) + 중개 처리 1영업일',
            sourceRefs: [S.esma],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d2',
      text: '"누적 희석(bp)"을 보세요. 이 숫자는 나간 사람 대신 남은 사람이 낸 비용입니다.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: 'ETF 할인은 두 가지로 읽힙니다. 어느 쪽이든, 우리 기준가가 어제 가격이라면 오늘 나가는 사람이 이득을 봅니다.',
    },
    {
      level: 3,
      decisionId: 't2-d2',
      text: '스윙폭은 실제 조달 비용에 맞춥니다. 너무 작으면 희석이 남고, 너무 크면 환매자에게 부당하며 감독 조회를 부릅니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2020-03-16 (월) 16:00 ET "VIX 82.69"
// ---------------------------------------------------------------------------------------------
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2020년 3월 16일 (월) 16:00 ET',
  title: 'VIX 82.69',
  time: '2020-03-16T16:00:00-04:00',
  entryEffects: [
    {
      id: 't3-open',
      description:
        '3/15(일) 기준금리 0~0.25% + 대규모 매입 발표에도 3/16 S&P −11.98%, VIX 82.69 사상 최고. IG 283bp',
      effects: [
        fundFx.marketOpen({
          policyRateBp: 13,
          govt2yBp: 36,
          govt10yBp: 73,
          govt30yBp: 134,
          igBp: 283,
          hyBp: 870,
          volIndex: 82.69,
          equityIndex: 80.77,
          fundingStressBp: 78,
          bidAskIgBp: 78,
          etfDiscountPct: -4.2,
          treasuryOffRunBp: 18,
          label: '3/16 마감 시세',
        }),
        confidence(-9, '정책 대응에도 급락 지속'),
      ],
    },
    { id: 't3-swing-settle', description: '전일 결의 스윙 적용', effects: [fundFx.settleSwing()] },
    {
      id: 't3-gate-count',
      description: '환매 중단 지속일 집계',
      effects: [fundFx.countGateTurn()],
    },
  ],
  eachTick: [
    {
      id: 't3-flow',
      description: '3/16 환매 유입 1.9%',
      effects: [fundFx.markToMarket(), fundFx.redemptionStep({ basePct: REDEMPTION_BASE[3]! })],
    },
  ],
  events: [
    {
      id: 't3-news-fomc',
      kind: 'newswire',
      outlet: 'Federal Reserve',
      time: '2020-03-15 17:00',
      headline:
        '연준, 기준금리 0~0.25%로 인하 — 국채 최소 $500bn·MBS 최소 $200bn 매입, 재할인창구 1차신용 0.25%·최장 90일',
      body: '일요일 저녁 긴급 발표다. 지급준비율을 0%로 낮추고, 재할인창구 이용을 장려하며, 주요국 중앙은행과의 기존 통화스와프 가격을 인하했다. 성명은 "가계와 기업에 대한 신용 흐름을 지원한다"고 밝혔다.',
      severity: 'critical',
      sourceRefs: [S.pr0315],
    },
    {
      id: 't3-news-cb3',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '09:31',
      headline: '세 번째 서킷브레이커 — S&P 500 −11.98%, VIX 82.69로 사상 최고 마감',
      body: '일요일 정책 발표가 오히려 위기의 심각성을 확인시켰다는 해석이 돌았다. 회사채 시장에서는 IG 물량조차 호가가 넓어졌고, 온·오프더런 국채 격차가 18bp까지 벌어졌다.',
      severity: 'critical',
      sourceRefs: [S.vix, S.h15],
    },
    {
      id: 't3-data-ladder',
      kind: 'data',
      time: '16:15',
      title: '유동성 사다리 현황',
      rows: [
        { label: '현금·1일 유동성', value: '{{metric:cashBufferPct}}' },
        { label: '1주 유동성(누적)', value: '{{metric:weeklyLiquidityPct}}' },
        { label: '비유동 비중', value: '{{metric:illiquidSharePct}}' },
        { label: '누적 환매', value: '{{metric:redemptionsCumulativePct}}' },
        { label: '누적 희석', value: '{{metric:dilutionBp}}bp' },
        { label: 'IG 왕복 거래비용', value: '78bp (블록은 그 두 배)' },
      ],
      severity: 'warning',
      sourceRefs: [S.ohara],
      relatedMetrics: ['cashBufferPct', 'weeklyLiquidityPct', 'illiquidSharePct', 'dilutionBp'],
    },
    {
      id: 't3-memo-treasury-desk',
      kind: 'memo',
      time: '15:45',
      from: '국채 데스크',
      to: '포트폴리오매니저',
      subject: '국채 유동성 악화 — 온·오프더런 격차 18bp',
      body: `- 오프더런 10년물 호가가 벌어지고 사이즈가 줄었습니다. 평소 $50M 블록이 한 번에 체결되던 자리에서 지금은 $10M씩 나눠야 합니다.
- 선물·현물 베이시스가 벌어지며 레버리지 투자자의 포지션 축소 물량이 국채 시장으로 나오고 있습니다.
- 국채는 여전히 우리 사다리의 맨 윗칸이지만, "아무 비용 없이 파는 칸"은 더 이상 아닙니다.`,
      severity: 'warning',
      sourceRefs: [S.bis, S.ofr],
      relatedMetrics: ['market.treasuryOffRunBp'],
    },
    {
      id: 't3-memo-board',
      kind: 'board',
      time: '17:30',
      headline: '이사회 의장 메모 — 도구와 한도를 정리해 달라',
      body: '독립이사 두 분이 "환매 중단(게이트)이 우리 정관상 가능한지, 가능하다면 어떤 절차인지"를 물었습니다. 다음 회의 전에 사용 가능한 도구 목록과 각각의 결과를 한 장으로 정리해 주십시오.',
      severity: 'warning',
      sourceRefs: [S.esma, S.fsbOef],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '국채까지 비싸졌다 — 이번 주 조달 계획',
      prompt:
        '거래비용이 78bp까지 오른 시장에서 이번 주 환매 조달을 어떻게 하시겠습니까? (최대 2개 · A는 단독)',
      context:
        '현금 구간이 얼마 남았는지, 비유동 비중이 어디까지 올라갔는지 보십시오. 오늘의 선택이 3월 18일에 무엇을 팔 수 있는지를 정합니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t3-d1-a', 't3-d1-b'],
        ['t3-d1-a', 't3-d1-c'],
        ['t3-d1-a', 't3-d1-d'],
        ['t3-d1-a', 't3-d1-e'],
        ['t3-d1-b', 't3-d1-c'],
      ],
      dimensions: ['liquidity', 'marketRisk', 'timeliness'],
      options: [
        {
          id: 't3-d1-a',
          label: '현금·국채를 방어선으로 동결하고 회사채만 매도',
          description:
            '남은 현금과 국채는 "마지막 방어선"으로 묶어두고, 환매는 IG·HY 매도로만 충당한다. 실행가능성: 내부 정책 결정이며 즉시 적용 가능하다.',
          effects: [fundFx.ringfenceLiquid({ on: true }), counter('ringfenced', 1)],
          expert: {
            rating: 18,
            rationale:
              '직관적으로는 신중해 보이지만 유동성 위기에서는 가장 위험한 규칙이다. 회사채 구간에는 당일 처분 한도가 있고(월간 8%·비유동 2.5%에 스트레스 계수), 방어선을 묶으면 그 한도를 다 써도 지급하지 못하는 날이 온다. FSB가 정리한 3월 국면의 실패 경로가 정확히 이것이다 — 팔 수 있는 것을 팔지 않다가 팔 수 없는 것만 남는 상태.',
            sourceRefs: [S.fsb, S.ohara],
          },
          consequences:
            '현금·국채 구간이 동결되었습니다. 이제 환매는 회사채 처분 한도 안에서만 지급할 수 있습니다.',
          trap: true,
          trapExplanation:
            '"최후의 방어선을 남긴다"는 표현은 은행의 담보 관리에서는 옳지만 개방형 펀드에서는 반대다. 방어선은 지키는 순간 쓸 수 없게 되고, 처분 한도에 걸리면 게이트 외에 선택지가 없다.',
          irreversible: true,
          feasibility: { basis: '내부 운용 정책 변경', sourceRefs: [S.fsb] },
        },
        {
          id: 't3-d1-b',
          label: '비례 매도를 유지하고 구간 비중을 지킨다',
          description:
            '비용이 올랐어도 네 구간에서 비례로 판다. 비유동 구간은 처분 한도까지 소화한다. 실행가능성: 처분 한도 안에서 가능.',
          effects: [
            fundFx.setSlicing({ policy: 'vertical' }),
            flag('vertical_policy'),
            counter('verticalHeld', 1),
          ],
          expert: {
            rating: 85,
            rationale:
              'Ma·Xiao·Zeng가 보인 "유동자산 우선 매도"의 귀결은 잔존 포트폴리오의 열화다. 비용이 올랐다는 이유로 비례를 포기하면 바로 그 경로에 들어간다. 스윙이 적용되어 있다면 오른 비용도 환매자가 부담한다.',
            sourceRefs: [S.maxz, S.fsbOef],
          },
          consequences: '비례 매도를 유지했습니다. 비용은 컸지만 구간 비중이 지켜졌습니다.',
          feasibility: { basis: '구간별 당일 처분 한도 내', sourceRefs: [S.ohara] },
        },
        {
          id: 't3-d1-c',
          label: '수평 매도로 전환 — 오늘 비용을 최소화',
          description:
            '남은 현금·국채를 먼저 쓰고 회사채는 뒤로 미룬다. 오늘 비용이 가장 싸다. 실행가능성: 항상 가능.',
          effects: [
            fundFx.setSlicing({ policy: 'horizontal' }),
            flag('horizontal_policy'),
            counter('horizontalTurn', 1),
          ],
          expert: {
            rating: 34,
            rationale:
              '오늘의 비용만 보면 옳다. 그러나 78bp 시장에서 남은 현금은 가장 값진 자산이고, 그것을 오늘 써버리면 3월 18일 — 국채마저 팔리지 않던 날 — 에 쓸 것이 없다.',
            historicalNote: '다수 펀드가 이 시점에도 수평 매도를 계속했다.',
            sourceRefs: [S.maxz, S.fsb],
          },
          consequences: '현금·국채로 충당했습니다. 오늘 비용은 적었고 현금 비중은 더 내려갔습니다.',
          historical: true,
          feasibility: { basis: '항상 가능', sourceRefs: [S.maxz] },
        },
        {
          id: 't3-d1-d',
          label: '현물 바스켓 설정으로 $500M 조달',
          description:
            'AP에 회사채 바스켓을 인도해 ETF 지분을 받고 매도한다. 처분 한도를 우회하고 블록 호가를 찾지 않는다. 비용은 할인폭 + 수수료. 실행가능성: AP 계약 기체결.',
          effects: [fundFx.sellViaEtfCreation({ amount: 500, feeBp: 25 })],
          expert: {
            rating: 78,
            rationale:
              '이 국면에서 비유동 구간을 실제로 줄일 수 있는 거의 유일한 경로다. 처분 한도를 우회하면서 비유동 비중을 낮추므로 이후 며칠의 선택지를 늘린다. 비용은 ETF 할인폭이며, 그 자체가 시장가에 가깝다.',
            sourceRefs: [S.etfPrimary, S.fimsac],
          },
          consequences:
            '$500M 바스켓을 인도했습니다. 현금 구간이 채워지고 비유동 비중이 내려갔습니다.',
          feasibility: { basis: 'AP 현물 설정 계약', sourceRefs: [S.etfPrimary] },
        },
        {
          id: 't3-d1-e',
          label: '크레딧라인 $200M 추가 인출로 시간 벌기',
          description:
            '라인을 인출해 이번 주 매도 압력을 줄인다. 실행가능성: 약정 한도 내 당일 인출.',
          effects: [fundFx.drawCreditLine({ amount: 200 })],
          expert: {
            rating: 52,
            rationale:
              '파이어세일을 늦추는 정당한 수단이지만, 3월 중순은 기업 리볼버 인출이 몰려 은행 대차대조표가 압박받던 시기다(리볼버 인출 $284bn). 라인 인출이 알려지면 "자산을 팔 수 없는 펀드"라는 신호가 되며, 상환 시점은 여전히 미정이다.',
            sourceRefs: [S.fsr, S.fsb],
          },
          consequences: '$200M을 인출했습니다. 차입 잔액이 늘었고 현금 구간이 채워졌습니다.',
          feasibility: { basis: '약정 한도 내 당일 인출', sourceRefs: [S.fsr] },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '"1주 유동성 비중"이 20%에서 얼마나 내려왔는지 보세요. 이것이 다음 이틀의 여력입니다.',
    },
    {
      level: 2,
      decisionId: 't3-d1',
      text: '구간마다 당일 처분 한도가 있습니다(주간 30% · 월간 8% · 비유동 2.5%, 여기에 시장 스트레스 계수를 곱합니다). 한도를 다 써도 모자라면 그날 환매를 지급할 수 없습니다.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: '현물 바스켓(D)은 처분 한도를 우회하면서 비유동 비중을 낮추는 유일한 경로입니다. A(방어선 동결)는 함정입니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3]
