import type { BankState, Turn } from '../../engine/types'
import { bankFx } from '../../engine/fx/bank'
import {
  confidence,
  counter,
  flag,
  fnEffect,
  op,
  ownStockMove,
  regulator,
} from '../../engine/fx/common'
import { clamp } from '../../engine/core/paths'
import { uninsuredDeposits } from '../../metrics/runoff'

type T = Turn<BankState>

const S = {
  fed: 'fed-svb-review-2023',
  gao: 'gao-23-106736',
  dfpi: 'dfpi-order-2023-03-10',
  k8: 'svb-8k-2023-03-08',
  k10: 'svb-10k-2022',
  bcbs: 'bcbs-d555',
  metrick: 'metrick-jep-2024',
  nyfed: 'nyfed-sr1104',
  finma: 'finma-cs-lessons-2023',
  sig: 'fdic-oig-signature-2023',
  deloitte: 'deloitte-fra-23-2',
  barr: 'barr-speech-2023-12-01',
  cfp: 'interagency-cfp-2023-07-28',
  frc: 'fdic-pr-34-2023',
  fsb: 'fsb-depositor-2024',
}

// ---------------------------------------------------------------------------------------------
// T0 — 2023-02-27 (월) 09:00 PT "무디스의 경고"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2023년 2월 27일 (월) 09:00 PT',
  title: '프롤로그: 무디스의 경고',
  time: '2023-02-27T09:00:00-08:00',
  events: [
    {
      id: 't0-news-10k',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '08:40',
      headline: '퍼시픽밸리은행, 2022 연차보고서 공시 — HTM 미실현손실 $15B, AFS $2.5B',
      body: '지난 금요일 공시된 10-K에 따르면 만기보유(HTM) 증권 $91B의 공정가치는 $76B로, 미실현손실이 보통주자본을 넘어선다. 회사는 "규제자본비율은 요건을 크게 상회한다"고 밝혔다.',
      severity: 'warning',
      sourceRefs: [S.k10],
      relatedMetrics: ['unrealizedLoss', 'economicTce'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: 'FF 목표범위', value: '4.50–4.75%', change: '2/1 +25bp' },
        { label: 'UST 2Y', value: '4.80%', change: '연초 대비 +40bp' },
        { label: 'PVB 주가(지수)', value: '100', change: '52주 저점 부근' },
      ],
      sourceRefs: ['fred-dgs2'],
    },
    {
      id: 't0-memo-treasury',
      kind: 'memo',
      time: '09:10',
      from: '자금부장',
      to: 'CRO/Treasurer',
      subject: '2월 예금 동향 및 유동성 현황',
      body: `- 1~2월 예금 순유출 약 $8B(추세). VC 투자 둔화로 고객 현금 소진(cash burn) 지속.
- 현금·지준 $14B, FHLB 차입 $15B(작년 0 → 급증). **연준 재할인창구에 사전 예치된 담보는 없음.**
- AFS 헤지 잔액 $0.6B (2021년 말 $10B 초과에서 대부분 해제).
- 2022년 내부 유동성 스트레스테스트(ILST) 30일 부족이 반복돼 가정(예금 지속성)을 조정한 상태.`,
      severity: 'warning',
      sourceRefs: [S.fed, S.k10],
      cardRefs: ['contingency-funding-plan', 'discount-window-fhlb-btfp'],
    },
    {
      id: 't0-call-moodys',
      kind: 'call',
      time: '10:30',
      caller: '무디스 애널리스트',
      callee: 'CFO',
      tone: 'concerned',
      lines: [
        {
          speaker: '무디스',
          text: '현재 등급을 검토 중입니다. 미실현손실 규모와 예금 추세를 감안하면 다노치 강등 가능성을 배제할 수 없습니다.',
        },
        { speaker: 'CFO', text: '자본 재편 계획을 검토 중입니다. 결정 전에 다시 협의하겠습니다.' },
      ],
      severity: 'critical',
      sourceRefs: [S.k8],
    },
    {
      id: 't0-memo-gs',
      kind: 'memo',
      time: '14:00',
      from: '골드만삭스 자문팀',
      to: 'CEO/CFO/CRO',
      subject: '자본 재편 대안 (사전 검토)',
      body: `1) AFS $21B 일괄 매각 + $2.25B 증자(보통주 $1.25B, 전환우선주 $0.5B, General Atlantic $0.5B)로 듀레이션 축소·수익성 개선을 동시 발표.
2) 완전 백스톱(bought deal/앵커 사모) 방식은 인수단 실사에 2~4주 소요.
3) 분할 매각은 신호를 줄이지만 무디스 일정에 맞추기 어려움.`,
      sourceRefs: [S.k8, S.metrick],
      cardRefs: ['capital-raise-sequencing'],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '선제적 대응 패키지 선택',
      prompt:
        '무디스의 등급 결정 전 2주 동안 무엇을 준비하시겠습니까? (최대 3개, A·F는 다른 항목과 함께 선택 불가)',
      context:
        '지금은 시장이 조용합니다. 준비 조치는 눈에 띄지 않지만, 3월 8일 이후의 모든 선택지는 오늘 무엇을 해두었는지에 달려 있습니다.',
      select: { min: 1, max: 3 },
      exclusive: [
        ['t0-a', 't0-b'],
        ['t0-a', 't0-c'],
        ['t0-a', 't0-d'],
        ['t0-a', 't0-e'],
        ['t0-a', 't0-f'],
        ['t0-f', 't0-b'],
        ['t0-f', 't0-c'],
        ['t0-f', 't0-d'],
        ['t0-f', 't0-e'],
      ],
      requiredConcepts: ['discount-window-fhlb-btfp', 'capital-raise-sequencing'],
      dimensions: ['liquidity', 'solvency', 'marketRisk', 'timeliness'],
      options: [
        {
          id: 't0-a',
          label: '"빅뱅" 리스크 축소: AFS $21B 일괄 매각과 $2.25B 증자를 무디스 결정 전 실행',
          description:
            '골드만 안 1번. 3월 8일 장 마감 후 매각·손실·증자를 동시에 발표한다. 증자 앵커는 GA $0.5B(22%)뿐이다.',
          effects: [flag('plan_bigbang'), counter('backstopPct', 22)],
          expert: {
            rating: 20,
            rationale:
              '손실 공개와 미백스톱 증자를 동시에 발표하는 순서는 예금자에게 "자본이 필요할 만큼 상황이 나쁘다"는 신호가 된다. 연준 사후검토와 Metrick(2024)은 이 발표가 실버게이트 청산과 겹치며 런을 촉발했다고 본다.',
            historicalNote: 'SVB가 실제로 선택한 경로. 3월 8일 발표 → 3월 9일 $42B 유출.',
            sourceRefs: [S.fed, S.metrick],
          },
          consequences:
            '골드만이 3월 첫째 주 실행을 준비합니다. 자금부는 발표 후 반응을 예측하기 어렵다고 보고했습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '규제자본이 양호하므로 "투명하게 정리하고 넘어가자"는 판단은 합리적으로 보인다. 그러나 무보험 예금 94%의 은행에서 손실 공개는 자본 문제가 아니라 유동성 문제를 만든다. 백스톱 없는 증자 발표는 실패 시 증폭기(×2.0)가 된다.',
          feasibility: { basis: '골드만 자문 및 8-K 실제 구조', sourceRefs: [S.k8] },
        },
        {
          id: 't0-b',
          label:
            '담보 사전 예치: HTM·대출을 연준 재할인창구에 설정하고 FHLB 한도를 확대, 테스트 차입 실시',
          description:
            '법적 서류·담보 이전·소액 실차입 테스트를 완료해 당일 인출 가능한 담보차입 여력을 $50B 이상 확보한다. 비용은 운영 비용뿐이며 시장에 알려지지 않는다.',
          effects: [
            bankFx.pledgeCollateral({ immediate: 55, label: '재할인창구·FHLB 담보 사전 예치' }),
            flag('collateral_prepositioned'),
          ],
          expert: {
            rating: 90,
            rationale:
              '연준 사후검토(p.74)는 SVB가 "담보를 커스터디은행·FHLB에서 재할인창구로 신속히 이동시킬 수 없었고 테스트 거래도 하지 않았다"고 지적한다. 2023년 7월 인터에이전시 가이던스는 창구 운영 준비와 주기적 테스트 거래를 명시적으로 요구하게 되었다.',
            sourceRefs: [S.fed, S.cfp, S.barr],
          },
          consequences:
            '3월 8일까지 담보 설정이 완료됩니다. 당일 인출 가능한 담보차입 여력이 크게 늘었습니다.',
          feasibility: {
            basis: '재할인창구 담보 설정은 법적 서류와 담보 이전으로 1~2주 내 가능',
            sourceRefs: [S.cfp],
          },
          calibrationNote:
            '0.95 × HTM 공정가치(미담보) ≈ $72B 중 실무상 2주 내 이동 가능분 $55B [CAL]',
        },
        {
          id: 't0-c',
          label:
            '완전 백스톱 증자를 사전 협상: $2.5B bought deal 또는 앵커 사모, 자금 확정 후 공시',
          description:
            '골드만 안 2번. 인수단이 전액 인수(백스톱 100%)하는 구조로 협상한다. 할인율 약 20%, 희석 약 16%. 2~4주 소요된다.',
          effects: [flag('backstop_arranged'), counter('backstopPct', 100)],
          expert: {
            rating: 80,
            rationale:
              '자금이 확정된 증자만 런 상태를 바꾼다(보정 규칙: 완전 백스톱 증자 종결 시 완화 ×0.7). CS의 2022년 10월 CHF 4B 증자는 앵커가 확정된 상태에서 발표돼 완료되었다. 캐비앳: 무디스 시계보다 느릴 수 있다.',
            sourceRefs: [S.fed, S.finma],
          },
          consequences:
            '앵커 투자자와 인수단이 확약서에 서명했습니다. 3월 8일 이후 필요 시 즉시 집행할 수 있습니다.',
          feasibility: { basis: '사모·bought deal은 2~4주 실사 필요', sourceRefs: [S.finma] },
          calibrationNote: '희석 = 2.5/(16×0.8+2.5) ≈ 16% [STYLIZED 시총 $16B]',
        },
        {
          id: 't0-d',
          label: '헤지 복원: AFS $12B pay-fixed 스왑으로 듀레이션 축소, HTM 레이어 헤지 개시',
          description:
            '2022년에 해제한 금리 헤지를 복원한다. 네거티브 캐리(스왑 4.9% − 자산 1.8%)가 발생하며, 3월 중순 금리 급락 시 헤지 손실이 난다.',
          effects: [
            op('institution.securities.afs.modDuration', 'set', 1.1, 'AFS 듀레이션 3.6→1.1y'),
            counter('hedgeNotional', 12),
          ],
          delayedEffects: [
            {
              afterTurns: 8,
              description:
                '3월 13일 2년물 −60bp 랠리로 신규 pay-fixed 헤지에서 평가손실 발생(≈$0.36B)',
              effects: [op('institution.capital.cet1', 'add', -0.36, '헤지 평가손실')],
            },
          ],
          expert: {
            rating: 55,
            rationale:
              '금리리스크 관리로는 옳다(연준 검토는 2022년 헤지 해제를 비판). 그러나 3월의 사건은 유동성 사건이며 헤지는 예금 유출을 막지 못한다. 학습 포인트: 올바른 조치가 항상 지금 필요한 조치는 아니다.',
            sourceRefs: [S.fed, S.k10],
          },
          consequences:
            '스왑 체결로 AFS 듀레이션이 1.1년으로 낮아졌습니다. 캐리 비용이 분기 실적에 반영될 예정입니다.',
          calibrationNote: '헤지 P&L: 2년물 −60bp × $12B × D≈1.5 ≈ −$0.36B [CAL, S16]',
        },
        {
          id: 't0-e',
          label: '분할 매각: AFS를 주당 $3~5B씩 6주간 정기 공시하며 매각, T-bill 재투자',
          description:
            '일괄 매각의 신호를 줄인다. 첫 매각분 $5B의 세후 손실은 약 $0.4B. 무디스 1노치 강등은 여전히 가능하다.',
          effects: [flag('staggered_sale')],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '분할 매각 1차분 AFS $5B 체결 — 세후 손실 약 $0.4B, 신뢰지수 −3',
              effects: [
                bankFx.sellSecurities({ book: 'afs', amount: 5, label: '분할 매각 1차' }),
                confidence(-3, '분할 매각 공시'),
              ],
            },
          ],
          expert: {
            rating: 65,
            rationale:
              '손실 실현을 분산하고 "빅뱅" 신호를 피한다. BCBS 2023년 보고서는 시장이 미실현손실을 이미 알고 있는 상황에서 갑작스러운 대규모 실현이 촉매가 되었다고 평가한다.',
            sourceRefs: [S.bcbs, S.k8],
          },
          consequences: '매각 일정이 확정되었습니다. 첫 회차는 3월 8일 체결됩니다.',
        },
        {
          id: 't0-f',
          label: '유동성·EVE 스트레스 가정 완화(예금 지속성 상향)로 내부 한도 충족',
          description:
            '내부 모형의 예금 지속성 가정을 높여 ILST·EVE 한도 위반을 해소한다. 실제 유동성은 변하지 않는다.',
          effects: [flag('ilst_assumptions_relaxed')],
          delayedEffects: [
            {
              afterTurns: 3,
              description: '감독당국이 가정 변경을 인지 — 감독 단계 상향',
              effects: [regulator({ add: 1 }, 'ILST 가정 변경 인지')],
            },
          ],
          expert: {
            rating: 5,
            rationale:
              '연준 사후검토는 SVB가 2022년에 정확히 이 행동(가정 변경으로 한도 충족)을 했다고 기록한다. 지표는 좋아 보이지만 3월 9일에 아무것도 바꾸지 못한다.',
            sourceRefs: [S.fed],
          },
          consequences:
            '내부 보고서의 한도 위반 표시가 사라졌습니다. 담보 여력과 현금은 그대로입니다.',
          trap: true,
          trapExplanation:
            '"지표를 고치면 문제가 사라진다"는 유혹. 유동성 위기는 모형이 아니라 결제 계좌 잔고에서 발생한다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "담보차입 여력(당일)"과 "경제적 유형자기자본비율"을 보세요. 규제자본은 양호하지만, 미실현손실을 빼면 자기자본은 거의 0입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d1',
      text: '비상자금조달계획(CFP) 원칙: 조치는 "즉시 가용하고 유연하게 배치 가능"해야 합니다. 발표 순서 원칙: 손실 공개는 자금이 확정된 뒤에.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: '담보 사전 예치(B)는 비용이 거의 없고 눈에 띄지 않으며, 3월 9일의 모든 선택지를 살립니다. 백스톱 증자 협상(C)과 함께 고려하세요.',
    },
  ],
  relatedCards: ['economic-vs-regulatory-capital', 'afs-htm-aoci'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2023-03-08 (수) 06:00 PT "실행일"
// ---------------------------------------------------------------------------------------------
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2023년 3월 8일 (수) 06:00 PT',
  title: '실행일',
  time: '2023-03-08T06:00:00-08:00',
  entryEffects: [
    {
      id: 't1-trend',
      description: '1~2월 추세 유출 반영: 예금 −$8B, 현금 −$2B; 2년물 5.07%(16년 최고)',
      effects: [
        op('institution.deposits.1.balance', 'add', -8, '추세 유출(D2)'),
        op('institution.cash', 'add', -2, '추세 유출 결제'),
        op('market.govt2yBp', 'set', 507),
        bankFx.rateShock({ deltaBp: 27, label: '2년물 +27bp' }),
      ],
    },
  ],
  events: [
    {
      id: 't1-news-powell',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '05:30',
      headline: '파월 의회 증언 여파로 2년물 5.07% — 2007년 이후 최고',
      body: '연준 의장이 "최종 금리가 예상보다 높을 수 있다"고 발언한 뒤 단기물이 급등했다. 은행 보유 채권의 평가손실이 다시 확대되고 있다.',
      severity: 'warning',
      sourceRefs: ['fred-dgs2'],
    },
    {
      id: 't1-news-silvergate',
      kind: 'newswire',
      outlet: 'WSJ',
      time: '06:00',
      headline: '실버게이트, 10-K 제출 지연 후 존속 능력 의문 — 암호화폐 예금 이탈 지속',
      body: '3월 1일 연차보고서 제출을 연기한 실버게이트캐피털은 "지속기업으로서의 능력"을 재평가 중이라고 밝혔다. 오늘 저녁 추가 발표가 있을 것이라는 관측이 나온다.',
      severity: 'warning',
      sourceRefs: [S.metrick],
    },
    {
      id: 't1-memo-execution',
      kind: 'memo',
      time: '06:15',
      from: '자금부장',
      to: 'CRO/Treasurer',
      subject: '오늘의 실행 준비 상태',
      body: `- 골드만: AFS 블록($21B) 입찰 준비 완료, 장 마감 후 체결 가능.
- General Atlantic $0.5B 확약 서명 완료.
- 예금 잔액 $165B. 현금 $12B. FHLB 당일 인출 가능 여력은 대시보드 참조.
- 무디스 결정 임박. 언론 문의 3건.`,
      sourceRefs: [S.k8],
    },
    {
      id: 't1-memo-collateral-ok',
      kind: 'memo',
      when: { flag: 'collateral_prepositioned' },
      time: '06:20',
      from: '결제·담보팀',
      to: 'CRO/Treasurer',
      subject: '재할인창구·FHLB 담보 설정 완료 보고',
      body: '지난 2주간 HTM 및 대출 담보 이전과 테스트 차입을 완료했습니다. 당일 인출 가능한 담보차입 여력이 확보되어 있습니다.',
      severity: 'positive',
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '계획 실행 또는 수정',
      prompt: '오늘 무엇을 실행하시겠습니까?',
      context:
        '실버게이트는 오늘 저녁 청산을 발표할 가능성이 높습니다(아직 모릅니다). 발표 순서가 예금자의 해석을 결정합니다.',
      requiredConcepts: ['capital-raise-sequencing', 'crisis-communication'],
      dimensions: ['solvency', 'communication', 'timeliness'],
      options: [
        {
          id: 't1-a',
          label:
            'AFS $21B 매각 실행, 세후 손실 $1.8B와 $2.25B 증자(백스톱 22%)를 장 마감 후 동시 공시',
          description:
            '8-K에 매각·손실·증자 구조를 모두 담는다. 증자는 북빌딩 방식으로 내일 진행된다.',
          effects: [
            bankFx.sellSecurities({ book: 'afs', amount: 21, label: 'AFS $21B 일괄 매각' }),
            flag('raise_announced'),
            flag('loss_disclosed'),
            counter('backstopPct', 22),
            fnEffect<BankState>('setBackstop', { pct: 22 }, (d) => {
              d.counters.backstopPct = 22
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '시장 반응: 손실 공개 + 미백스톱 증자 발표 → 신뢰지수 −25',
              effects: [confidence(-25, '손실 공개 + 미백스톱 증자 발표')],
            },
          ],
          expert: {
            rating: 25,
            rationale:
              '연준 사후검토: 발표가 실버게이트 청산과 겹치며 백스톱 없는 증자가 런을 촉발했다. 보정 규칙 ΔCI −25(SVB 3/8→9 앵커).',
            historicalNote: '실제 SVB의 3월 8일 8-K. 다음 날 주가 −60%, 예금 $42B 유출.',
            sourceRefs: [S.fed, S.k8, S.metrick],
          },
          consequences:
            '장 마감 후 8-K가 공시되었습니다. 골드만이 블록을 인수했고 현금이 들어왔습니다. 세후 손실이 자본에 반영되었습니다.',
          historical: true,
          calibrationNote:
            'AFS 장부가/시가 비율 28.9/26 → $21B 매각 시 세전 손실 ≈$2.3B, 세후 ≈$1.75B [S3 $1.8B]',
        },
        {
          id: 't1-b',
          label:
            'AFS $21B 매각만 실행하고 증자는 완전 백스톱 확보 전까지 미공시(8-K는 매각·손실만)',
          description:
            '손실은 공개하되 "자본이 필요하다"는 신호는 보류한다. 증자는 조건이 갖춰진 뒤 별도 발표한다.',
          effects: [
            bankFx.sellSecurities({ book: 'afs', amount: 21, label: 'AFS $21B 매각' }),
            flag('loss_disclosed'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '시장 반응: 손실 공개(증자 없음) → 신뢰지수 −15, 무디스 1노치 강등 −5',
              effects: [confidence(-15, '손실 공개'), confidence(-5, '무디스 1노치 강등')],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '손실 공개만으로도 불안을 유발하지만 "증자 실패"라는 증폭 경로를 제거한다. 그러나 8-K Item 2.06(중요 손상) 공시 의무로 손실은 4영업일 내 공개해야 한다.',
            sourceRefs: [S.fed, S.metrick],
          },
          consequences: '매각이 체결되고 손실이 공시되었습니다. 증자 계획은 언급하지 않았습니다.',
        },
        {
          id: 't1-c',
          label:
            '일괄 매각 취소: AFS $5B만 매각, FHLB 기간대출 $10B 인출로 현금 확보, 무디스 강등 수용',
          description:
            '눈에 띄는 손실 실현 대신 담보차입으로 현금을 늘린다. 1~2노치 강등을 감수한다.',
          effects: [
            bankFx.sellSecurities({ book: 'afs', amount: 5, label: 'AFS $5B 매각' }),
            bankFx.drawFacility({ amount: 10, source: 'FHLB 기간대출', rateBp: 500 }),
            flag('quiet_path'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '무디스 1~2노치 강등 → 신뢰지수 −8',
              effects: [confidence(-8, '무디스 강등')],
            },
          ],
          expert: {
            rating: 70,
            rationale:
              '위기 신호를 피하면서 유동성을 늘린다. 런 상태는 피어 실패가 증폭하지 않는 한 S1 이하에 머문다. 캐비앗: 2노치 강등은 D2(운영성 예금) 이탈을 자극할 수 있다.',
            sourceRefs: [S.fed, S.bcbs],
          },
          consequences:
            'FHLB 기간대출이 실행되었습니다. 소규모 매각 손실이 반영되었고, 무디스 결정을 기다리고 있습니다.',
          calibrationNote:
            'FHLB 인출은 기설정 담보 여력 한도 내에서만 체결됨(사전 예치 여부에 따라 실제 금액이 달라짐)',
        },
        {
          id: 't1-d',
          label: '매각 실행 + 증자를 골드만 bought deal(할인 18%)과 GA로 "자금 확정" 형태로 발표',
          description:
            '백스톱 100% 증자를 손실 공개와 함께 발표한다. 시장은 "자본이 이미 들어왔다"고 읽는다.',
          requires: { flag: 'backstop_arranged' },
          unavailableReason:
            '완전 백스톱 인수단이 없습니다 (T0에서 사전 협상하지 않음). 인수 실사에는 2~4주가 걸립니다.',
          effects: [
            bankFx.sellSecurities({ book: 'afs', amount: 21, label: 'AFS $21B 매각' }),
            bankFx.raiseEquity({ amount: 2.5, backstopPct: 100, discount: 0.18, marketCap: 16 }),
            flag('loss_disclosed'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '시장 반응: 손실 공개 + 완전 백스톱 증자 → 신뢰지수 −10',
              effects: [confidence(-10, '손실 공개(백스톱 증자 동반)')],
            },
          ],
          expert: {
            rating: 75,
            rationale:
              'CS 2022년 10월 사례처럼 자금이 확정된 증자는 손실 공개의 충격을 흡수한다. 희석(≈16%)은 비용이지만 런보다 싸다.',
            sourceRefs: [S.finma, S.fed],
          },
          consequences: '매각과 확정 증자가 함께 공시되었습니다. 자본이 즉시 유입되었습니다.',
        },
        {
          id: 't1-e',
          label: '매각·증자 발표에 더해 아직 설정되지 않은 "$15B FHLB·연준 유동성 백스톱"을 공표',
          description: '시장을 안심시키기 위해 확보하지 못한 유동성 여력을 발표한다.',
          effects: [
            bankFx.sellSecurities({ book: 'afs', amount: 21, label: 'AFS $21B 매각' }),
            flag('raise_announced'),
            flag('loss_disclosed'),
            flag('false_backstop'),
            fnEffect<BankState>('setBackstop', { pct: 22 }, (d) => {
              d.counters.backstopPct = 22
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              description: '시장 반응: 손실 공개 + 미백스톱 증자 발표 → 신뢰지수 −20',
              effects: [confidence(-20, '손실 공개 + 증자 발표')],
            },
          ],
          expert: {
            rating: 10,
            rationale:
              '검증 불가능한 유동성 약속은 모순이 드러나는 순간 "가시적 실패"가 되어 증폭기(×1.5)로 작동한다. 시그니처의 주말 담보 실사 실패가 유사한 사례다.',
            sourceRefs: [S.sig, S.fsb],
          },
          consequences:
            '발표문에 "$15B 유동성 백스톱"이 포함되었습니다. 자금부는 실제 여력이 그에 미치지 못한다고 우려합니다.',
          trap: true,
          trapExplanation:
            '안심 메시지는 검증 가능한 수치에 기반해야 한다. 존재하지 않는 여력을 발표하면 첫 송금 지연에서 거짓이 드러나고 런이 가속된다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '오늘 저녁 발표될 정보의 조합(손실 + 증자 + 백스톱 비율)이 내일 아침 예금자의 행동을 결정합니다.',
    },
    {
      level: 2,
      decisionId: 't1-d1',
      text: '보정 규칙: 손실 공개+미백스톱 증자 −25, 손실 공개만 −15, 완전 백스톱 동반 −10, 조용한 경로 −8(강등).',
    },
    {
      level: 3,
      decisionId: 't1-d1',
      text: '백스톱이 없다면 C(조용한 경로)가 신호를 가장 줄입니다. 백스톱을 확보했다면 D가 최선입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2023-03-08 (수) 16:30 PT "발표 후 첫 밤"
// ---------------------------------------------------------------------------------------------
export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2023년 3월 8일 (수) 16:30 PT',
  title: '발표 후 첫 밤',
  time: '2023-03-08T16:30:00-08:00',
  entryEffects: [
    {
      id: 't2-silvergate',
      description: '실버게이트 자발적 청산 발표(동종 피어 실패 <48h) → 신뢰지수 −5',
      effects: [confidence(-5, '실버게이트 청산(피어 실패)')],
    },
    {
      id: 't2-afterhours',
      when: { flag: 'raise_announced' },
      description: '시간외 주가 하락(발표 반응)',
      effects: [ownStockMove(-0.15, '시간외 반응')],
    },
  ],
  events: [
    {
      id: 't2-news-silvergate',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '16:05',
      headline: '실버게이트캐피털, 은행 영업 종료 및 자발적 청산 발표',
      body: '암호화폐 업계 은행 실버게이트가 "모든 예금을 전액 상환"하며 청산하겠다고 밝혔다. 미국 은행이 예금 이탈로 문을 닫는 첫 사례가 되었다.',
      severity: 'critical',
      sourceRefs: [S.metrick],
      cardRefs: ['bank-run-dynamics'],
    },
    {
      id: 't2-news-pvb',
      kind: 'newswire',
      when: { flag: 'loss_disclosed' },
      outlet: 'Reuters',
      time: '16:20',
      headline: '퍼시픽밸리은행, 채권 매각으로 $1.8B 손실 — 자본 확충 추진',
      body: '장 마감 후 공시에서 은행은 유가증권 매각과 대차대조표 재편을 발표했다. 시간외 거래에서 주가가 급락하고 있다.',
      severity: 'critical',
      sourceRefs: [S.k8],
    },
    {
      id: 't2-news-quiet',
      kind: 'newswire',
      when: { flag: 'quiet_path' },
      outlet: 'Reuters',
      time: '16:20',
      headline: '무디스, 퍼시픽밸리은행 등급 하향 — 미실현손실·예금 추세 반영',
      body: '은행은 소규모 자산 매각과 FHLB 차입으로 유동성을 보강했다고 밝혔다. 시장 반응은 제한적이다.',
      severity: 'warning',
    },
    {
      id: 't2-memo-clients',
      kind: 'memo',
      time: '18:40',
      from: 'RM 총괄',
      to: 'CRO/Treasurer',
      subject: '고객 문의 급증',
      body: `- 저녁 6시 이후 VC 파트너 및 포트폴리오 CFO로부터 문의 47건. 대부분 "예금이 안전한가"라는 질문.
- 트위터·슬랙에 오늘 발표문이 확산 중. 일부 VC가 "내일 아침 잔액을 옮기라"고 조언한다는 소문.
- 송금 창구는 닫혀 있어 아직 실제 인출은 없음.`,
      severity: 'warning',
      sourceRefs: [S.nyfed],
      cardRefs: ['uninsured-deposits-and-run-speed'],
    },
    {
      id: 't2-data-book',
      kind: 'data',
      when: { flag: 'raise_announced' },
      time: '19:30',
      title: '골드만 북빌딩 초기 반응',
      rows: [
        { label: '앵커 확약', value: 'GA $0.5B (22%)' },
        { label: '기관 관심 표명', value: '약함 — 손실 규모와 실버게이트 뉴스로 관망' },
        { label: '가격 가이던스', value: '할인 확대 요구' },
      ],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '향후 12시간 커뮤니케이션',
      prompt: '내일 아침 송금 창구가 열리기 전, 무엇을 누구에게 말하시겠습니까? (최대 2개)',
      select: { min: 1, max: 2 },
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'timeliness'],
      options: [
        {
          id: 't2-a',
          label:
            '표준 대응: 보도자료·8-K·IR 덱, CEO 고객 서한("재무 건전성 견고"), 목요일 고객 콜 예정',
          description:
            '규제자본비율과 사업 펀더멘털을 강조하는 안심 메시지. 구체적 유동성 수치는 포함하지 않는다.',
          effects: [confidence(-5, '수치 없는 안심 메시지')],
          expert: {
            rating: 30,
            rationale:
              '연준 사후검토와 Metrick(2024)은 수치 없는 안심 메시지가 유출을 늦추지 못했다고 본다. 디지털 런에서 "건전하다"는 말은 검증 가능한 여력이 없으면 소음이다.',
            historicalNote:
              'SVB의 실제 대응. 3월 9일 CEO 콜에서도 구체적 유동성 수치는 제시되지 않았다.',
            sourceRefs: [S.fed, S.metrick],
          },
          consequences: '서한이 발송되었습니다. RM들은 고객이 "구체적 숫자"를 묻는다고 보고합니다.',
          historical: true,
        },
        {
          id: 't2-b',
          label:
            '유동성 사실 공개: 즉시 가용 현금 + 설정된 담보차입 한도를 무보험예금 대비 %로 공개, RM이 상위 100개 예금주에 동일 수치 전달',
          description:
            '검증 가능한 여력을 숫자로 말한다. 수치가 무보험예금의 50% 이상이면 신뢰를 얻고, 미달이면 오히려 불안을 확인시킨다.',
          effects: [
            fnEffect<BankState>('discloseCapacity', {}, (d, ctx) => {
              const b = d.institution
              const capacity = b.cash + b.wholesale.cbFacilityCapacity
              const uninsured = uninsuredDeposits(b)
              if (capacity >= 0.5 * uninsured) {
                d.counters.dampener = (d.counters.dampener || 1) * 0.85
                d.confidence.index = clamp(d.confidence.index + 10, 0, 100)
                d.flags.capacity_disclosed = true
                d.flagTurns.capacity_disclosed ??= d.turnIndex
                ctx.log(
                  `유동성 공개: 여력 ${capacity.toFixed(1)} ≥ 무보험 50%(${(0.5 * uninsured).toFixed(1)}) → 완화 ×0.85, ΔCI +10`,
                )
              } else {
                d.counters.amplifier = (d.counters.amplifier || 1) * 1.5
                d.confidence.index = clamp(d.confidence.index - 5, 0, 100)
                d.flags.capacity_shortfall_exposed = true
                d.flagTurns.capacity_shortfall_exposed ??= d.turnIndex
                ctx.log(
                  `유동성 공개: 여력 ${capacity.toFixed(1)} < 무보험 50% → 부족이 드러남, 증폭 ×1.5, ΔCI −5`,
                )
              }
            }),
          ],
          expert: {
            rating: 70,
            rationale:
              'FRC의 3월 12일 "$70B 가용 유동성" 공표(연준·JPM 확인)가 원형. 커뮤니케이션은 검증 가능한 여력이 뒷받침될 때만 작동한다(보정 규칙: 완화 ×0.7~0.85, 모순 시 ×1.5). 가치는 T0에서 무엇을 준비했는지에 달려 있다.',
            sourceRefs: [S.bcbs, S.fsb, 'treasury-jy1349'],
          },
          consequences:
            '유동성 수치가 공개되었습니다. 결과는 여력이 충분했는지에 따라 달라집니다(로그 참조).',
        },
        {
          id: 't2-c',
          label: '침묵: 공정공시(Reg FD) 우려로 RM에게 언급 금지',
          description: '법무팀 권고에 따라 추가 정보를 내지 않는다.',
          effects: [bankFx.addAmplifier(1.2, '정보 공백')],
          expert: {
            rating: 20,
            rationale:
              '정보 공백은 VC 네트워크의 추측으로 채워진다(뉴욕연준 SR 1104: 소셜 네트워크가 런을 조율). 공정공시는 8-K로 해결할 수 있다.',
            sourceRefs: [S.nyfed],
          },
          consequences: 'RM들이 문의에 답하지 못하고 있습니다. 슬랙에서 추측이 확산됩니다.',
        },
        {
          id: 't2-d',
          label: '주요 VC 10곳에 공개 지지 성명 요청',
          description:
            '대형 VC가 "포트폴리오 회사에 예금 유지를 권고"한다고 밝히도록 설득한다. 신뢰가 이미 무너졌다면 거절당한다.',
          effects: [
            fnEffect<BankState>('vcStatement', {}, (d, ctx) => {
              if (d.confidence.index >= 40) {
                d.counters.dampener = (d.counters.dampener || 1) * 0.8
                d.flags.vc_support = true
                d.flagTurns.vc_support ??= d.turnIndex
                ctx.log('VC 5곳 이상 지지 성명 동의 → 완화 ×0.8')
              } else {
                ctx.log('VC 대부분이 성명을 거절 (CI < 40)')
              }
            }),
          ],
          expert: {
            rating: 60,
            rationale:
              '네트워크 조율은 양방향이다. 실제로는 3월 10~11일에야 300여 VC의 지지 성명이 나와 너무 늦었다. 조기 동원만이 효과가 있다.',
            sourceRefs: [S.nyfed, S.metrick],
          },
          consequences:
            'VC 파트너들과 통화했습니다. 동의 여부는 현재 신뢰 수준에 달려 있습니다(로그 참조).',
        },
        {
          id: 't2-e',
          label: '잔존 예금에 +200bp 우대금리 제시',
          description: '가격으로 예금을 붙잡는다. NIM 비용이 발생한다.',
          effects: [
            fnEffect<BankState>('depositRateDefense', { bp: 200 }, (d, ctx) => {
              d.counters.nimCost = (d.counters.nimCost ?? 0) + 0.3
              if (d.confidence.index >= 50) {
                d.counters.dampener = (d.counters.dampener || 1) * 0.95
                ctx.log('우대금리: S1 상태에서만 소폭 완화 ×0.95')
              } else ctx.log('우대금리: 런 상태에서는 효과 없음')
            }),
          ],
          expert: {
            rating: 25,
            rationale:
              '지급능력 우려로 시작된 런은 가격으로 멈추지 않는다(FRC·PacWest 2023). 우려 단계(S1)에서만 미미한 효과.',
            sourceRefs: [S.frc, S.fsb],
          },
          consequences: '우대금리 안내가 나갔습니다. 반응은 미미합니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '대시보드의 "즉시 가용 유동성"을 무보험예금과 비교해 보세요. 공개할 수 있는 숫자인지가 핵심입니다.',
    },
    {
      level: 2,
      decisionId: 't2-d1',
      text: '보정 규칙: 검증 가능한 여력 공표(≥ 무보험의 50%) 완화 ×0.7~0.85; 모순되면 증폭 ×1.5. 정보 공백은 ×1.2.',
    },
    {
      level: 3,
      decisionId: 't2-d1',
      text: '여력이 충분하면 B. 부족하다면 B는 역효과이니 D(네트워크 동원)를 먼저 시도하세요.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T3 — 2023-03-09 (목) 07:00 PT "개장"
// ---------------------------------------------------------------------------------------------
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2023년 3월 9일 (목) 07:00 PT',
  title: '개장',
  time: '2023-03-09T07:00:00-08:00',
  entryEffects: [
    {
      id: 't3-stock-bigbang',
      when: { all: [{ flag: 'raise_announced' }, { counter: 'backstopPct', lt: 50 }] },
      description: '프리마켓: 손실 + 미백스톱 증자 반응 −45%',
      effects: [ownStockMove(-0.45, '프리마켓')],
    },
    {
      id: 't3-stock-lossonly',
      when: {
        all: [
          { flag: 'loss_disclosed' },
          { notFlag: 'raise_announced' },
          { notFlag: 'raise_closed' },
        ],
      },
      description: '프리마켓: 손실 공개 반응 −35%',
      effects: [ownStockMove(-0.35, '프리마켓')],
    },
    {
      id: 't3-stock-backstopped',
      when: { flag: 'raise_closed' },
      description: '프리마켓: 확정 증자 동반 −15%',
      effects: [ownStockMove(-0.15, '프리마켓')],
    },
    {
      id: 't3-stock-quiet',
      when: { flag: 'quiet_path' },
      description: '프리마켓: 강등 반응 −12%',
      effects: [ownStockMove(-0.12, '프리마켓')],
    },
    {
      id: 't3-false-backstop',
      when: { all: [{ flag: 'false_backstop' }, { metric: 'facilityHeadroom', lt: 15 }] },
      description: '공표한 "$15B 백스톱"이 실제 여력과 모순 → 증폭 ×1.5, 신뢰지수 −20',
      effects: [bankFx.addAmplifier(1.5, '거짓 백스톱 노출'), confidence(-20, '거짓 백스톱 노출')],
    },
    {
      id: 't3-founders',
      description: 'Founders Fund 등 VC가 포트폴리오 기업에 인출 권고(네트워크 조율) → 신뢰지수 −5',
      effects: [confidence(-5, 'VC 네트워크 인출 권고')],
    },
    {
      id: 't3-runoff',
      description: '송금 창구 개장 — 오전 창구(당일의 55%) 유출 발생',
      effects: [bankFx.runoffStep({ windowFraction: 0.55, label: '오전 유출' })],
    },
  ],
  events: [
    {
      id: 't3-market-open',
      kind: 'market',
      time: '06:30',
      headline: '프리마켓',
      items: [
        { label: 'PVB', value: '대시보드 참조', change: '프리마켓 급락' },
        { label: 'KBW 은행지수', value: '−3.5%', change: '실버게이트 여파' },
        { label: 'UST 2Y', value: '4.87%', change: '−20bp (안전자산 선호)' },
      ],
      sourceRefs: ['fred-dgs2'],
    },
    {
      id: 't3-news-founders',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '08:15',
      headline: 'Founders Fund, 포트폴리오 기업에 퍼시픽밸리은행 예금 인출 권고 — 복수 VC 동참',
      body: '피터 틸의 Founders Fund가 투자 기업들에 자금 이전을 권고했다고 복수의 소식통이 전했다. 다른 VC들도 "위험을 감수할 이유가 없다"며 같은 조언을 하고 있다.',
      severity: 'critical',
      sourceRefs: [S.nyfed, S.metrick],
      cardRefs: ['uninsured-deposits-and-run-speed'],
    },
    {
      id: 't3-memo-wires',
      kind: 'memo',
      time: '09:30',
      from: '결제팀',
      to: 'CRO/Treasurer',
      subject: '송금 대기열 실시간 보고',
      body: `- 개장 후 90분간 송금 요청이 평소의 40배. 대기열이 시간당 $1B 이상으로 늘고 있습니다.
- 현재 현금·지준 잔고와 예상 일일 유출은 대시보드 참조.
- FHLB SF: 기설정 담보 대비 당일 인출 가능. 추가 담보는 이전에 1영업일 이상 소요.
- 연준 재할인창구: 예치 담보 상태에 따라 즉시 차입 가능/불가.`,
      severity: 'critical',
      sourceRefs: [S.fed, S.dfpi],
      relatedMetrics: ['cash', 'facilityHeadroom', 'survivalDays'],
    },
    {
      id: 't3-dialogue-gs',
      kind: 'dialogue',
      when: { flag: 'raise_announced' },
      time: '10:00',
      title: '골드만 ECM 콜',
      lines: [
        {
          speaker: '골드만',
          text: '북이 얇습니다. 앵커 22% 외에는 확정 주문이 거의 없고, 주가 급락으로 가격 가이던스가 무의미해졌습니다.',
        },
        { speaker: 'CFO', text: '오후까지 계속 갈 수 있습니까?' },
        {
          speaker: '골드만',
          text: '가능은 하지만, 실패가 공개되면 상황이 더 나빠집니다. 대안을 준비하십시오.',
        },
      ],
      severity: 'critical',
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '유동성 동원',
      prompt: '오늘 장 마감 전 어떤 자금을 어떻게 확보하시겠습니까? (최대 2개)',
      context:
        '송금 요청은 실시간으로 결제됩니다. 마감 시 연준 계좌 잔고가 음수면 감독당국은 다음 날 아침 문을 닫을 수 있습니다.',
      select: { min: 1, max: 2 },
      requiredConcepts: ['discount-window-fhlb-btfp', 'htm-tainting'],
      dimensions: ['liquidity', 'timeliness'],
      timeLimitSec: 120,
      defaultOptionId: 't3-b',
      options: [
        {
          id: 't3-a',
          label: 'FHLB SF에 기설정 담보 대비 당일 최대 인출 요청',
          description:
            '이미 설정된 담보 한도 내에서 당일 자금을 받는다. 미예치 담보로는 오늘 차입할 수 없다.',
          effects: [bankFx.drawFacility({ amount: 10, source: 'FHLB SF 당일 인출', rateBp: 500 })],
          expert: {
            rating: 85,
            rationale:
              '당일 자금은 사전 예치 담보에서만 나온다 — 2023년의 운영상 교훈(연준 검토 p.74, GAO). 요청 금액이 여력을 넘으면 여력만큼만 체결된다.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences:
            'FHLB 인출이 체결되었습니다. 체결액은 기설정 여력에 달려 있습니다(로그 참조).',
        },
        {
          id: 't3-b',
          label: 'HTM 담보를 FHLB에서 연준 재할인창구로 이전 개시',
          description:
            '올바른 조치지만 리엔 해제와 담보 이전에 하루 이상 걸린다. 오늘은 쓸 수 없다.',
          effects: [
            fnEffect<BankState>('startCollateralTransfer', {}, (d, ctx) => {
              const b = d.institution
              if (d.flags.collateral_prepositioned) {
                ctx.log('담보는 이미 연준에 예치되어 있음 — 추가 이전 불필요')
                return
              }
              const pending = Math.max(
                0,
                0.95 * b.securities.htm.marketValue * (1 - (b.securities.htm.pledgedShare ?? 0)) -
                  b.wholesale.cbFacilityCapacity,
              )
              b.wholesale.cbFacilityPending += Math.min(60, pending)
              ctx.log(
                `담보 이전 개시: 익일 여력 +${Math.min(60, pending).toFixed(1)} (오늘은 사용 불가)`,
              )
            }),
            flag('collateral_transfer_started'),
          ],
          expert: {
            rating: 70,
            rationale:
              '방향은 맞지만 하루 늦었다. SVB는 실제로 이 이전을 시도했으나 마감 전에 완료하지 못했다(DFPI 명령: cash letter 미결제).',
            historicalNote: '실제 SVB의 3월 9일 오후 대응.',
            sourceRefs: [S.fed, S.dfpi],
          },
          consequences: '담보 이전 절차가 시작되었습니다. 여력은 내일 아침에야 반영됩니다.',
          historical: true,
        },
        {
          id: 't3-c',
          label: 'HTM $25B를 시장에 매각해 현금 확보',
          description:
            '만기보유 증권을 팔면 전체 HTM이 "오염"되어 AFS로 재분류되고 $15B 미실현손실이 자본에 가시화된다.',
          effects: [
            bankFx.sellSecurities({ book: 'htm', amount: 25, label: 'HTM $25B 긴급 매각' }),
          ],
          expert: {
            rating: 5,
            rationale:
              '"현금이 급하니 판다"는 판단은 자기자본 스토리를 파괴한다. ASC 320 tainting으로 잔여 HTM 전체가 시가 평가되고, 신뢰지수 −30, 등급은 정크로 간다. 어떤 사후평가도 이 선택을 권하지 않는다.',
            sourceRefs: [S.deloitte, S.fed],
          },
          consequences:
            'HTM 매각이 체결되었습니다. 회계팀: "전체 HTM 포트폴리오가 재분류됩니다." 시장이 즉시 반응합니다.',
          trap: true,
          trapExplanation:
            'HTM은 "팔 수 없는 자산"이 아니라 "팔면 전부 시가로 바뀌는 자산"이다. 담보로 쓰면 현금이 되지만, 팔면 자본이 사라진다.',
          irreversible: true,
        },
        {
          id: 't3-d',
          label: '브로커 예금·FF 매입으로 $5~10B 조달 시도',
          description: '무담보 도매 자금. 주가가 −30% 이상 빠진 날에는 공급자가 사라진다.',
          effects: [
            fnEffect<BankState>('brokeredDeposits', {}, (d, ctx) => {
              if (d.confidence.index >= 40) {
                d.institution.cash += 2
                d.institution.wholesale.unsecuredShort += 2
                ctx.log('브로커 예금 $2B 체결 (CI ≥ 40)')
              } else ctx.log('브로커 예금 체결 실패: 무담보 라인 회수')
            }),
          ],
          expert: {
            rating: 30,
            rationale:
              '무담보 도매 자금은 필요할 때 가장 먼저 사라진다(BCBS 2023). 소액만 가능하며 런 상태에서는 0.',
            sourceRefs: [S.bcbs],
          },
          consequences: '브로커·딜러에 조달을 타진했습니다. 결과는 로그를 확인하세요.',
        },
        {
          id: 't3-e',
          label: '연준 재할인창구에서 사전 예치 담보 한도까지 즉시 차입',
          description: '연준에 이미 예치된 담보가 있다면 당일 결제로 차입할 수 있다.',
          requires: { flag: 'collateral_prepositioned' },
          unavailableReason:
            '연준 재할인창구에 사전 예치된 담보가 없습니다 (T0에서 준비하지 않음).',
          effects: [
            bankFx.drawFacility({ amount: 999, source: '연준 재할인창구(1차 신용)', rateBp: 475 }),
          ],
          expert: {
            rating: 80,
            rationale:
              '가치는 전적으로 사전 예치에 달려 있다 — 학습목표 1을 구체화하는 선택지. 시스템 사건 중에는 낙인 효과가 없다(3/15 창구 차입 $152.9B 사상 최대).',
            sourceRefs: [S.fed, S.barr],
          },
          consequences: '재할인창구 차입이 당일 결제되었습니다.',
        },
      ],
    },
    {
      id: 't3-d2',
      title: '증자 처리',
      prompt: '진행 중인 자본 조달을 어떻게 하시겠습니까?',
      when: {
        any: [
          { flag: 'raise_announced' },
          { flag: 'backstop_arranged' },
          { flag: 'loss_disclosed' },
        ],
      },
      dimensions: ['solvency', 'communication'],
      options: [
        {
          id: 't3-d2-a',
          label: '북빌딩 계속 (골드만)',
          description:
            '오늘 13:00까지 주문을 모은다. 신뢰지수 45 이상이고 백스톱 50% 이상이면 성공한다.',
          effects: [
            fnEffect<BankState>('bookbuild', {}, (d, ctx) => {
              const ci = d.confidence.index
              const backstop = d.counters.backstopPct ?? 0
              if (ci >= 45 && backstop >= 50) {
                d.institution.capital.cet1 += 2.25
                d.institution.cash += 2.25
                d.institution.leverageExposure += 2.25
                d.counters.dampener = (d.counters.dampener || 1) * 0.7
                d.flags.raise_closed = true
                d.flagTurns.raise_closed ??= d.turnIndex
                ctx.log('북빌딩 성공: $2.25B 유입, 완화 ×0.7')
              } else {
                d.flags.raise_failed = true
                d.flagTurns.raise_failed ??= d.turnIndex
                ctx.log(
                  `북빌딩 실패 (CI ${ci.toFixed(0)}, 백스톱 ${backstop}%) — 실패는 내일 아침 공개됨`,
                )
              }
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { flag: 'raise_failed' },
              description: '증자 실패가 공개됨 → 신뢰지수 −25 (붕괴 상태 진입)',
              effects: [confidence(-25, '증자 실패 공개')],
            },
          ],
          expert: {
            rating: 30,
            rationale:
              '가시적으로 실패하는 북빌딩을 계속하는 것은 실패 신호를 최대화한다. 보정 규칙: 증자 실패 → ΔCI −25, 런 상태 S3.',
            historicalNote:
              'SVB는 3월 9일 북빌딩을 계속했고 완료하지 못했다. 3월 10일 아침 증자 포기가 알려졌다.',
            sourceRefs: [S.fed, S.metrick],
          },
          consequences: '북빌딩이 계속됩니다. 결과는 로그에 기록되었습니다.',
          historical: true,
        },
        {
          id: 't3-d2-b',
          label: 'GA 등과 즉시 완전 백스톱 사모(할인 35%)로 전환',
          description: '북빌딩을 접고 확정 자금으로 바꾼다. 희석은 크지만 확실하다.',
          requires: { all: [{ flag: 'backstop_arranged' }, { confidence: { gte: 35 } }] },
          unavailableReason:
            '완전 백스톱 인수단이 없거나(T0.C 미선택) 신뢰지수가 35 미만이라 사모 전환이 불가능합니다.',
          effects: [
            bankFx.raiseEquity({ amount: 2.5, backstopPct: 100, discount: 0.35, marketCap: 8 }),
          ],
          expert: {
            rating: 60,
            rationale:
              '완전 백스톱 증자만이 런 상태를 바꾼다(완화 ×0.7). 희석 25%는 폐쇄보다 싸다.',
            sourceRefs: [S.finma, S.fed],
          },
          consequences: '사모 증자가 종결되어 자본이 유입되었습니다.',
        },
        {
          id: 't3-d2-c',
          label: '증자 철회 + 매각(전략적 대안) 절차 공표',
          description:
            '정직하지만 위기 신호다. 인수자 관심은 유동성 일수와 유형자기자본에 달려 있다.',
          effects: [confidence(-15, '증자 철회·매각 절차 공표'), flag('sale_process')],
          delayedEffects: [
            {
              afterTurns: 2,
              when: {
                all: [
                  { metric: 'survivalDays', gte: 1 },
                  { metric: 'economicTce', gt: 3 },
                ],
              },
              description: '인수 후보가 실사를 요청 — 인수자 관심 확인',
              effects: [flag('acquirer_interest'), confidence(5, '인수자 관심')],
            },
          ],
          expert: {
            rating: 45,
            rationale:
              '3월 10일 아침 SVB가 실제로 추진한 경로. 매수자는 런이 허용하는 시간보다 더 긴 시간을 필요로 했다.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences: '증자 철회와 전략적 대안 검토가 공표되었습니다.',
        },
        {
          id: 't3-d2-d',
          label: '조용히 철회, 무공시',
          description: '북빌딩을 중단하되 발표하지 않는다.',
          effects: [bankFx.addAmplifier(1.3, '소문: 증자 무산')],
          expert: {
            rating: 15,
            rationale: '골드만 북의 실패는 시장에 즉시 새어 나간다. 소문이 공백을 채운다.',
            sourceRefs: [S.nyfed],
          },
          consequences: '북빌딩이 중단되었습니다. 트레이딩 데스크에서 "증자 무산" 소문이 돕니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '"담보차입 여력(당일)"과 "예상 일일 순유출"을 비교하세요. 오늘 쓸 수 있는 것은 이미 설정된 담보뿐입니다.',
    },
    {
      level: 2,
      decisionId: 't3-d1',
      text: 'CFP 워터폴: 현금 → 담보차입(기설정) → 담보 이전(익일) → 자산 매각(AFS) → HTM은 담보로만. HTM 매각은 tainting.',
    },
    {
      level: 3,
      decisionId: 't3-d1',
      text: 'A(FHLB 당일 인출)는 항상 옳고, E(연준 창구)는 사전 예치가 있을 때만 열립니다. C(HTM 매각)는 함정입니다.',
    },
    {
      level: 1,
      decisionId: 't3-d2',
      text: '북빌딩 성공 조건은 신뢰지수 45 이상 + 백스톱 50% 이상입니다. 대시보드의 신뢰지수를 확인하세요.',
    },
    {
      level: 3,
      decisionId: 't3-d2',
      text: '조건이 안 되면 계속하는 것(A)이 최악입니다. 백스톱이 있다면 B, 없다면 C가 그나마 정직한 선택입니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T4 — 2023-03-09 (목) 12:00 PT "네트워크 런"
// ---------------------------------------------------------------------------------------------
export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2023년 3월 9일 (목) 12:00 PT',
  title: '네트워크 런',
  time: '2023-03-09T12:00:00-08:00',
  entryEffects: [
    {
      id: 't4-runoff',
      description: '오후 창구(당일의 45%) 유출',
      effects: [bankFx.runoffStep({ windowFraction: 0.45, label: '오후 유출' })],
    },
    {
      id: 't4-visible-outflow',
      when: { metric: 'cumulativeOutflowPct', gt: 10 },
      description: '가시적 유출(>10%/일)이 시장에 알려짐 → 신뢰지수 −15',
      effects: [confidence(-15, '가시적 대규모 유출')],
    },
    {
      id: 't4-stock',
      when: { metric: 'cumulativeOutflowPct', gt: 10 },
      description: '주가 추가 하락 −25%',
      effects: [ownStockMove(-0.25, '정오')],
    },
  ],
  events: [
    {
      id: 't4-market',
      kind: 'market',
      time: '12:00',
      headline: '정오 시세',
      items: [
        { label: 'PVB', value: '대시보드 참조', change: '거래량 사상 최대' },
        { label: 'KRE 지역은행 ETF', value: '−7.7%', change: '동반 급락' },
        { label: 'UST 2Y', value: '4.90%', change: '' },
      ],
    },
    {
      id: 't4-news-network',
      kind: 'newswire',
      outlet: 'The Information',
      time: '11:40',
      headline:
        '"지금 옮겨라": VC 그룹채팅에서 퍼시픽밸리은행 인출 조언 확산 — 스타트업 CFO들 대기열',
      body: 'Y Combinator·Coatue 등 복수 VC가 포트폴리오 기업에 "필요한 만큼만 남기고 분산하라"고 조언했다. 일부 기업은 급여 계좌까지 옮기고 있다.',
      severity: 'critical',
      sourceRefs: [S.nyfed],
    },
    {
      id: 't4-memo-fed-account',
      kind: 'memo',
      time: '13:10',
      from: '결제팀',
      to: 'CRO/Treasurer',
      subject: '연준 계좌 잔고 추이 및 마감 전망',
      body: `- 현재 잔고와 예상 일일 유출은 대시보드 참조. 이 속도면 마감 시 잔고가 음수가 될 수 있습니다.
- 연준 cash letter 결제는 마감 시 잔고로 처리됩니다. 음수 마감은 감독당국에 즉시 통보됩니다.
- 담보 이전 상태: 진행 중인 건은 내일 아침 반영.`,
      severity: 'critical',
      sourceRefs: [S.dfpi],
      relatedMetrics: ['cash', 'projectedDailyOutflow'],
    },
    {
      id: 't4-memo-gs-fail',
      kind: 'memo',
      when: { flag: 'raise_failed' },
      time: '13:30',
      from: '골드만 ECM',
      to: 'CFO',
      subject: '공모 진행 불가',
      body: '현 주가와 수요로는 공모를 완료할 수 없습니다. 오늘 밤 전략적 대안(매각) 협의를 권고합니다.',
      severity: 'critical',
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '고객 커뮤니케이션',
      prompt: '오후 고객 콜에서 무엇을 말하시겠습니까?',
      dimensions: ['communication', 'compliance'],
      timeLimitSec: 90,
      defaultOptionId: 't4-a',
      options: [
        {
          id: 't4-a',
          label:
            'CEO가 주요 VC·고객 콜에서 "침착해 달라, 우리가 여러분을 지원했듯 지원해 달라"고 호소',
          description: '감정에 호소하는 메시지. 유동성 수치는 제시하지 않는다.',
          effects: [bankFx.addAmplifier(1.1, '수치 없는 호소'), confidence(-3, '수치 없는 CEO 콜')],
          expert: {
            rating: 20,
            rationale:
              '보도에 따르면 이 콜은 오히려 인출을 가속했다. 검증 가능한 수치 없는 호소는 "숫자를 말할 수 없다"는 신호로 읽힌다.',
            historicalNote: 'SVB CEO의 3월 9일 콜.',
            sourceRefs: [S.metrick, S.fsb],
          },
          consequences:
            '콜이 끝났습니다. 참석한 VC 중 일부가 곧바로 인출을 지시했다는 보고가 들어옵니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"관계"에 호소하는 것은 평시의 자산이지만 런 중에는 "숫자가 없다"는 고백이 된다.',
        },
        {
          id: 't4-b',
          label: '정확한 유동성 포지션 공개 + 모든 송금 정시 처리 확인 + 상위 200 고객 RM 접촉',
          description:
            '실제로 송금이 정시 처리되고 있다면 가장 신뢰할 수 있는 메시지. 처리가 지연되고 있다면 역효과.',
          effects: [
            fnEffect<BankState>('verifiableComms', {}, (d, ctx) => {
              if (d.institution.cash >= 0) {
                d.counters.dampener = (d.counters.dampener || 1) * 0.9
                d.confidence.index = clamp(d.confidence.index + 5, 0, 100)
                ctx.log('정시 처리 확인 가능 → 완화 ×0.9, ΔCI +5')
              } else {
                d.counters.amplifier = (d.counters.amplifier || 1) * 1.5
                d.confidence.index = clamp(d.confidence.index - 10, 0, 100)
                ctx.log('송금 지연 중 → 메시지가 모순됨, 증폭 ×1.5, ΔCI −10')
              }
            }),
          ],
          expert: {
            rating: 65,
            rationale:
              '디지털 런에서 유일하게 신뢰받는 메시지는 "송금이 정시에 나가고 있다"는 검증 가능한 사실이다(FSB 2024: 일관되고 조율된 메시지).',
            sourceRefs: [S.fsb, S.bcbs],
          },
          consequences:
            '유동성 포지션과 처리 현황이 공개되었습니다. 효과는 실제 처리 상태에 달려 있습니다(로그 참조).',
        },
        {
          id: 't4-c',
          label: '"대형 은행·전략적 파트너와 협의 중" 발표',
          description: '매각 절차가 실제로 진행 중이면 신뢰를 얻고, 아니면 거짓 백스톱이 된다.',
          effects: [
            fnEffect<BankState>('partnerTalksStatement', {}, (d, ctx) => {
              if (d.flags.sale_process) {
                d.counters.dampener = (d.counters.dampener || 1) * 0.8
                ctx.log('매각 절차 존재 → 완화 ×0.8')
              } else {
                d.flags.false_statement = true
                d.flagTurns.false_statement ??= d.turnIndex
                ctx.log('절차 없는 발표 → 내일 모순 노출 예정')
              }
            }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { flag: 'false_statement' },
              description: '"파트너 협의" 발표가 사실이 아님이 드러남 → 증폭 ×1.5, 신뢰지수 −10',
              effects: [
                bankFx.addAmplifier(1.5, '거짓 발표 노출'),
                confidence(-10, '거짓 발표 노출'),
              ],
            },
          ],
          expert: {
            rating: 50,
            rationale:
              '절차가 존재할 때만 진실이다. 그렇지 않으면 조작된 백스톱이며 감독당국의 불건전 행위 판단 대상이 된다.',
            sourceRefs: [S.gao],
          },
          consequences: '발표가 나갔습니다.',
        },
        {
          id: 't4-d',
          label: '송금 처리를 "운영 점검"으로 지연',
          description: '시스템 점검을 이유로 대형 송금을 늦춘다.',
          effects: [regulator({ set: 4 }, '인출 거부·지연(불건전 행위)'), flag('unsafe_act')],
          expert: {
            rating: 0,
            rationale:
              '인출 거부·지연은 폐쇄 사유가 된다(DFPI 명령의 "불안전·불건전" 판단). 어떤 상황에서도 선택지가 아니다.',
            sourceRefs: [S.dfpi, S.gao],
          },
          consequences: '송금 지연이 감지되었습니다. 감독당국이 즉시 개입합니다.',
          trap: true,
          trapExplanation:
            '시간을 벌려는 시도는 은행의 존속 근거(예금의 요구불성)를 스스로 부정하는 것이다.',
          illegal: true,
          irreversible: true,
        },
      ],
    },
    {
      id: 't4-d2',
      title: '감독당국 대응',
      prompt: '감독당국에 어떻게 대응하시겠습니까?',
      dimensions: ['compliance', 'timeliness'],
      options: [
        {
          id: 't4-d2-a',
          label: 'FRB SF·DFPI·FDIC에 선제 보고 + 재할인창구·연장 결제 요청',
          description: '오늘 중 감독당국과 마감 전 지원(야간 창구·일중 초과인출)을 논의한다.',
          effects: [regulator({ add: 1 }, '선제 보고'), flag('regulator_engaged')],
          expert: {
            rating: 85,
            rationale:
              '조기 접촉이 야간 지원을 가능하게 한다. SVB의 늦은 오후 접근은 담보 이동을 완료하지 못했다. 감독 단계는 오르지만 그것이 정상이다.',
            sourceRefs: [S.fed, S.gao],
          },
          consequences: '감독당국과 통화했습니다. 야간 지원 채널이 열렸습니다.',
        },
        {
          id: 't4-d2-b',
          label: '법정 보고만',
          description: '규정상 요구되는 보고 외에는 접촉하지 않는다.',
          effects: [],
          expert: {
            rating: 35,
            rationale: '위반은 아니지만 마감 후 지원을 요청할 채널이 없다.',
            historicalNote: 'SVB는 오후 늦게야 적극적으로 접근했다.',
            sourceRefs: [S.fed],
          },
          consequences: '정기 보고만 제출했습니다.',
          historical: true,
        },
        {
          id: 't4-d2-c',
          label: '감독당국 접촉 회피',
          description: '개입을 늦추기 위해 연락을 피한다.',
          effects: [],
          delayedEffects: [
            {
              afterTurns: 1,
              description:
                '결제 데이터로 상황을 파악한 감독당국이 강하게 개입 — 단계 +2, 신뢰지수 −5',
              effects: [
                regulator({ add: 2 }, '접촉 회피 후 개입'),
                confidence(-5, '감독당국 강제 개입'),
              ],
            },
          ],
          expert: {
            rating: 5,
            rationale: '감독당국은 결제 데이터로 이미 알고 있다. 회피는 신뢰만 잃는다.',
            sourceRefs: [S.dfpi, S.gao],
          },
          consequences: '연락을 피했습니다. 감독당국이 결제 데이터를 모니터링 중입니다.',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '지금 송금이 정시에 나가고 있습니까? 대시보드의 현금 잔고가 양수인지 확인하세요.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: '현금이 양수면 B(검증 가능한 메시지). 음수면 어떤 메시지도 도움이 되지 않으며, D(지연)는 폐쇄 사유입니다.',
    },
    {
      level: 2,
      decisionId: 't4-d2',
      text: '감독당국 단계(R)가 오르는 것은 비용이지만, 야간 지원(T5)은 사전 접촉 없이는 열리지 않습니다.',
    },
  ],
}

export const turnsA: T[] = [t0, t1, t2, t3, t4]
