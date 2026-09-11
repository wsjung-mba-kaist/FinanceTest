import type { CentralBankState, DialogueStep, Interrupt, Option, Turn } from '../../engine/types'
import { commitReplies } from '../../engine'
import { confidence, flag, op, regulator, setCounter } from '../../engine/fx/common'
import { csFx } from './fx'
import { S } from './turnsA'

type T = Turn<CentralBankState>
type O = Option<CentralBankState>

/** turnsA.ts 상단의 대사 고지가 이 파일에도 그대로 적용된다 — 모든 대사는 재구성이다. */

// ---------------------------------------------------------------------------------------------
// T3 — 2023-03-17 (금) "정오의 지급불능"
// ---------------------------------------------------------------------------------------------
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '2023년 3월 17일 (금) 08:00 CET',
  title: '정오의 지급불능',
  time: '2023-03-17T08:00:00+01:00',
  entryEffects: [
    {
      id: 't3-market',
      description: '3월 17일 시세 — 주가 −8%대, CDS 1,100bp, Baa−10년 221bp',
      effects: [
        csFx.equityMove({ pct: -0.082, reason: '3/17 종가' }),
        csFx.cdsMove({ to: 1100, reason: '코레스은행 이탈' }),
        op('market.creditSpreadIgBp', 'set', 221, '3/17 Baa 5.60% − 10년 3.39%'),
        op('market.govt2yBp', 'set', 381, '3/17 미 국채 2년 3.81%'),
        op('market.volIndex', 'set', 25.51, '3/17 VIX 종가'),
        op('market.equityIndex', 'mul', 0.985, '유럽 은행 주가지수 −1.5%'),
      ],
    },
    {
      id: 't3-outflow',
      description: '3월 17일 고객자금 유출 101억 프랑',
      effects: [csFx.runoffStep({ total: 10.1, profile: [1], label: '3/17 고객자금 유출' })],
    },
    {
      id: 't3-infrastructure',
      description:
        '결제·청산 인프라 이탈 — 국제예탁결제기관의 스위스프랑 코레스 해지, 한도 전면 축소, 선납 요구 220억 프랑',
      effects: [
        csFx.pressureDrain({
          amount: 22,
          reason: '코레스 해지·한도 축소·결제 선납 요구',
        }),
        confidence(-6, '결제 인프라 이탈'),
      ],
    },
  ],
  events: [
    {
      id: 't3-news-euroclear',
      kind: 'newswire',
      outlet: 'Reuters',
      time: '14:30',
      headline: '국제예탁결제기관, 크레디트스위스를 스위스프랑 현금 코레스은행에서 즉시 해제',
      body: '금요일 오후 한 국제예탁결제기관이 회원사들에 크레디트스위스를 스위스프랑 현금 코레스은행 자격에서 즉시 해제했다고 통보했다. 거래상대방들은 담보를 더 요구하거나 한도를 줄이고 있고, 일부는 거래 관계를 완전히 끝냈다.',
      severity: 'critical',
      sourceRefs: [S.finma],
      relatedMetrics: ['csLiquidity'],
    },
    {
      id: 't3-memo-noon',
      kind: 'memo',
      time: '11:40',
      from: 'SNB 금융안정국 · FINMA 은행감독국',
      to: '합동 정책담당',
      subject: '오늘 정오 — 추가 지원 요청',
      body: `- 은행이 200억 프랑의 추가 유동성지원대출(ELA+)을 신청했습니다. 신청서의 문구는 어제와 같습니다: 자금·자본시장에서든 다른 어떤 방법으로든 필요한 유동성을 조달할 수 없다.
- 신청 사유는 "결제를 계속하기 위해서"입니다. 대리은행과 결제·청산기관, 그리고 고객에게 더 이상의 경보를 만들지 않으려면 즉시 보유 유동성을 늘려야 한다는 것입니다.
- **저희 계산으로는 이 지원이 없으면 오늘 정오에 즉시 지급불능입니다.** 그룹만이 아니라 스위스 법인도 마찬가지입니다.
- ELA+는 어젯밤 긴급명령이 있어야만 지급할 수 있습니다. 명령이 없다면 오늘 통상 창구로 내줄 수 있는 금액은 대시보드의 "SNB 즉시 공여 여력"뿐입니다.`,
      severity: 'critical',
      sourceRefs: [S.finma, S.snbFsr, S.ord135],
      cardRefs: ['discount-window-fhlb-btfp', 'regulator-escalation-ladder'],
      relatedMetrics: ['csLiquidity', 'usableReserves'],
    },
    {
      id: 't3-memo-weekend',
      kind: 'memo',
      time: '16:00',
      from: 'FINMA 정리국 · 연방재무부',
      to: '합동 정책담당',
      subject: '주말에 열어 둘 트랙',
      body: `- 월요일 아시아 개장까지 약 55시간입니다. 그 안에 끝나지 않는 것은 선택지가 아닙니다.
- 네 갈래를 준비해 두었습니다. ① UBS에 의한 흡수합병 ② FINMA 명령에 의한 정리 — 주식 전액 상각, AT1 전액 상각, 베일인 채권의 주식 전환, 자본 약 730억 프랑 증가 ③ 연방정부 국유화 ④ 그룹 파산 + 스위스 긴급계획 발동.
- ②의 결정문·정리계획·정리인 선임 결정문은 서명 가능한 상태입니다. ④의 파산 결정문과 파산관재인 선임 결정문도 준비되어 있습니다.
- **어느 갈래든 SNB의 대규모 유동성이 필요합니다.** 정리는 자본을 만들지만 유동성을 만들지 못합니다.
- ②를 실행하려면 위기관리그룹의 외국 당국이 같은 시각에 인정해야 합니다. 세계적 시스템 중요 은행의 정리는 어디에서도 실행된 적이 없습니다 — 그것이 위험이자, 동시에 이 제도를 만든 이유입니다.`,
      severity: 'critical',
      sourceRefs: [S.finma],
      cardRefs: ['fdic-resolution-weekend'],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '금요일의 추가 지원',
      prompt: '오늘 정오의 요청에 어떻게 답하시겠습니까?',
      context:
        '이 지원이 없으면 오늘 정오에 지급불능입니다. 이 지원이 있어도 주말을 넘길 구조적 해법은 생기지 않습니다.',
      requiredConcepts: ['discount-window-fhlb-btfp'],
      dimensions: ['liquidity', 'policy'],
      options: [
        {
          id: 't3-d1-elaplus',
          label: 'ELA+ 200억 프랑을 공여한다',
          description:
            '긴급명령에 근거한 추가 유동성지원대출 200억 프랑을 즉시 공여한다. 파산 시 우선변제권이 붙는다.',
          requires: { flag: 'emergency_ordinance' },
          unavailableReason:
            'ELA+는 연방평의회의 긴급명령이 있어야만 존재하는 창구입니다. 어젯밤 명령을 제정하지 않았다면 오늘 이 돈은 법적으로 존재하지 않습니다.',
          effects: [
            csFx.provideLiquidity({ amount: 20, facility: 'elaPlus', label: 'ELA+ 200억 공여' }),
            confidence(4, '추가 유동성 공여'),
            regulator({ set: 3 }, '정리 준비 단계'),
            flag('ela_plus_granted'),
          ],
          expert: {
            rating: 78,
            rationale:
              '이 200억이 정오의 지급불능을 막았다는 것은 FINMA 보고서가 명시한 사실이다. 동시에 이것은 구조적 해법이 아니라 주말까지 시간을 사는 값이다 — 그 사실을 알고 사는 것과 모르고 사는 것이 다르다.',
            historicalNote:
              'SNB는 3월 17일 ELA+ 200억 프랑을 공여했다. FINMA: "Without this further support, CS would have become immediately insolvent by midday on Friday, 17 March 2023."',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '200억 프랑이 정오 직전에 집행되었습니다. 결제는 멈추지 않았습니다. 주말 협상까지 남은 것은 시간뿐입니다.',
          historical: true,
          feasibility: {
            basis: '긴급명령 발효 후 ELA+는 FINMA의 자체조달 불가 확인으로 당일 집행 가능',
            sourceRefs: [S.ord135],
          },
          preview: [{ metric: 'csLiquidity', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't3-d1-elaplus-prepared',
          label: 'ELA+ 200억을 공여하되 주말 절차 협조를 조건으로 건다',
          description:
            '같은 200억을 내주되, 인수 후보에 대한 실사 자료 제공, 정리 결정문 수령 준비, 이사회의 주말 상시 대기를 공여 조건으로 명시한다. 감독처분으로 당일 가능하다.',
          requires: { flag: 'emergency_ordinance' },
          unavailableReason: 'ELA+는 연방평의회의 긴급명령이 있어야만 존재하는 창구입니다.',
          effects: [
            csFx.provideLiquidity({
              amount: 20,
              facility: 'elaPlus',
              label: 'ELA+ 200억 공여(조건부)',
            }),
            confidence(5, '조건을 동반한 추가 공여'),
            regulator({ set: 3 }, '정리 준비 단계'),
            flag('ela_plus_granted'),
            flag('weekend_prepared'),
          ],
          expert: {
            rating: 90,
            rationale:
              '같은 돈으로 주말의 시간을 산다. 실사 자료가 금요일 밤에 준비되어 있으면 토요일의 협상은 가격에서 시작하고, 없으면 자료 요청에서 시작한다. FINMA는 2022년 10월 이후 실제로 가상 데이터룸을 요구해 두었는데, 이 조건은 그 준비를 주말 직전에 한 번 더 강제한다.',
            sourceRefs: [S.finma],
          },
          consequences:
            '200억이 집행되었고, 실사 자료가 오늘 밤 안에 데이터룸에 올라갑니다. 이사회는 주말 내내 대기합니다.',
          calibrationNote: 'weekend_prepared 플래그가 T4 협상 결과를 개선한다 (calibration.md §6)',
          feasibility: {
            basis: '공여 조건 부과는 금융시장감독법상 감독처분',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'csLiquidity', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't3-d1-residual',
          label: '통상 창구의 잔여 담보 한도 안에서만 공여한다',
          description:
            '긴급권한을 쓰지 않고 남은 적격담보 범위(최대 50억 프랑) 안에서만 내준다. 담보가 남아 있지 않으면 나가는 돈도 없다.',
          effects: [
            csFx.provideLiquidity({ amount: 5, facility: 'ela', label: 'ELA 잔여 한도 공여' }),
            confidence(-8, '요청액에 크게 못 미치는 공여'),
            csFx.adjustDrain({ factor: 1.3, reason: '지원 부족이 드러남' }),
          ],
          expert: {
            rating: 25,
            rationale:
              '법적으로는 가장 깨끗하다. 그러나 요청액의 4분의 1 이하를 내주면 시장은 상한이 어디인지 알게 되고, 그 상한이 남은 유출보다 작다는 것도 함께 알게 된다.',
            sourceRefs: [S.finma],
          },
          consequences:
            '잔여 담보 범위에서만 집행되었습니다. 은행의 재무부서는 "월요일까지 필요한 금액은 이보다 한 자릿수 큽니다"라고 회신했습니다.',
          preview: [{ metric: 'csLiquidity', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't3-d1-refuse',
          label: '공여를 거부한다',
          description:
            '유동성 지원이 문제를 미룰 뿐이라면 오늘 끝낸다. 다만 오늘 정오에 결제가 멈춘다.',
          effects: [
            confidence(-20, '최종대부자 공여 거부'),
            csFx.pressureDrain({
              amount: 18,
              reason: '공여 거부 직후 코레스은행 전면 이탈·결제 선납 요구',
            }),
            regulator({ set: 4 }, '지급불능 선언 절차'),
            flag('support_refused_friday'),
          ],
          expert: {
            rating: 5,
            rationale:
              '최종대부자가 담보와 법적 근거가 있는 상태에서 공여를 거부하면 그 자체가 지급불능의 방아쇠가 된다. FINMA 보고서의 반사실은 명확하다 — 이 지원이 없었다면 금요일 정오에 즉시 지급불능이었다. 정리를 원한다면 정리를 명해야지 결제를 멈추게 두어서는 안 된다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '공여를 거부했습니다. 정오를 지나면서 결제 대기열이 해소되지 않았고, 스위스 법인의 지급이 멈췄습니다.',
          irreversible: true,
          preview: [{ metric: 'csLiquidity', direction: 'down', magnitude: 3 }],
        },
      ],
    },
    {
      id: 't3-d2',
      title: '주말 트랙',
      prompt: '주말에 어떤 트랙을 열어 두시겠습니까?',
      context:
        '월요일 아시아 개장까지 약 55시간입니다. 트랙을 하나만 열면 협상은 단순해지고 협상력은 사라집니다.',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'timeliness'],
      options: [
        {
          id: 't3-d2-merger',
          label: '인수 후보와의 매각 협상 단일 트랙으로 간다',
          description:
            '민간 해법을 우선한다. 인수 후보 은행에 실사를 열고 토요일 아침 협상을 시작한다. 정리 문서는 서랍에 둔다.',
          effects: [flag('track_merger'), confidence(2, '민간 해법 우선')],
          expert: {
            rating: 60,
            rationale:
              '일반적으로 민간 해법이 정부 조치보다 적절하고 표적화되어 있으며 비례적이라는 FINMA의 판단은 타당하다. 다만 단일 트랙은 상대에게 "다른 선택지가 없다"는 사실을 알려 준다 — 그것이 토요일 밤의 가격에 그대로 나타난다.',
            historicalNote:
              '정리 결정문은 3월 19일에 서명 가능한 상태였으나 협상 테이블에서 실제로 쓰이지는 않았다.',
            sourceRefs: [S.finma],
          },
          consequences: '실사가 열렸습니다. 인수 후보는 토요일 아침 자문단을 취리히로 보냅니다.',
          historical: true,
          feasibility: {
            basis: '비밀유지계약과 데이터룸은 2022년 10월 이후 준비되어 있었다',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't3-d2-dual',
          label: '매각과 정리를 같은 무게로 병행한다',
          description:
            '실사를 열되 정리 결정문·정리인 선임 결정문을 같은 방에 두고, 위기관리그룹의 외국 당국에 두 갈래를 모두 통보한다. 인수 후보도 이 사실을 안다.',
          effects: [
            flag('track_merger'),
            flag('track_dual'),
            confidence(3, '양 트랙 병행'),
            op('confidence.regulators', 'add', 8, '국제 인정 절차 병행 준비'),
          ],
          expert: {
            rating: 92,
            rationale:
              '정리계획이 존재했는데 쓰이지 않았다는 것이 이 사건의 핵심 교훈이다. 병행 트랙은 정리를 반드시 하겠다는 뜻이 아니라, 정리가 실행 가능한 상태로 테이블 위에 있다는 사실을 상대가 알게 하는 것이다. 그 사실만으로 대가와 보증의 균형이 달라진다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '두 트랙이 동시에 열렸습니다. 위기관리그룹 회선이 상시 연결되었고, 인수 후보의 자문단은 옆방에 정리팀이 있다는 것을 압니다.',
          calibrationNote: 'track_dual 플래그가 협상 결과와 정리 경로의 성공 조건을 개선 [CAL]',
          feasibility: {
            basis: '정리 결정문은 서명 가능 상태였고 위기관리그룹은 상시 소집 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't3-d2-resolution',
          label: '정리 단일 트랙으로 간다',
          description:
            '민간 매각을 배제하고 FINMA 명령에 의한 정리를 준비한다. 주식 전액 상각, AT1 전액 상각, 베일인 채권의 주식 전환.',
          effects: [
            flag('track_resolution'),
            confidence(-2, '정리 준비의 가시화'),
            op('confidence.regulators', 'add', 5, '국제 인정 절차 착수'),
          ],
          expert: {
            rating: 58,
            rationale:
              '제도의 설계대로 가는 길이며, 서열이 뒤집히지 않는 유일한 길이기도 하다. 다만 세계적 시스템 중요 은행의 정리는 실행된 전례가 없고 외국 인정 절차가 관건이다. 민간 해법을 아예 닫아 버리는 것은 FINMA가 실제로 내린 판단과 반대이며, 실패하면 남는 것은 파산뿐이다.',
            sourceRefs: [S.finma, S.fsi21],
          },
          consequences:
            '정리 트랙이 단독으로 열렸습니다. 외국 당국에 인정 절차 개시가 통보되었고, 인수 후보에게는 협상이 없다고 알렸습니다.',
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
        },
        {
          id: 't3-d2-none',
          label: '주말에 판단하기로 하고 트랙을 정하지 않는다',
          description: '토요일 상황을 보고 결정한다.',
          effects: [
            confidence(-10, '주말 준비 부재'),
            csFx.adjustDrain({ factor: 1.2, reason: '주말 준비 부재' }),
            flag('track_none'),
          ],
          expert: {
            rating: 8,
            rationale:
              '55시간 안에 세계적 시스템 중요 은행의 운명을 정해야 하는데, 그 시간의 절반을 트랙을 고르는 데 쓰면 남는 것은 상대가 제시한 조건뿐이다. 준비되지 않은 정리는 실행되지 않고, 준비되지 않은 매각은 가격을 방어하지 못한다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '트랙을 정하지 않았습니다. 금요일 밤 인수 후보의 자문단은 아직 취리히로 출발하지 않았습니다.',
          trap: true,
          trapExplanation:
            '"주말에 상황을 보고 결정한다"는 유연해 보인다. 그러나 주말은 결정하는 시간이 아니라 이미 준비된 것을 실행하는 시간이다.',
          remediationCard: 'fdic-resolution-weekend',
          preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 2 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't3-d1',
      text: '"CS 가용 유동성"이 지금 얼마입니까. 음수가 되면 그 시점이 지급불능입니다.',
    },
    {
      level: 2,
      decisionId: 't3-d1',
      text: 'ELA+는 어젯밤 긴급명령을 제정한 경우에만 존재합니다. 제정하지 않았다면 오늘 내줄 수 있는 것은 잔여 담보뿐입니다.',
    },
    {
      level: 3,
      decisionId: 't3-d2',
      text: '협상에서 가격을 정하는 것은 상대가 아는 나의 대안입니다. 정리 결정문이 서명 가능한 상태라는 사실을 상대가 아는지 여부가 토요일 밤의 조건을 바꿉니다.',
    },
  ],
  relatedCards: ['discount-window-fhlb-btfp', 'fdic-resolution-weekend'],
}

// ---------------------------------------------------------------------------------------------
// T4 — 2023-03-18~19 (토·일) "취리히의 주말" — 틱 5
// ---------------------------------------------------------------------------------------------

// ── 대화 1: 정리 방식의 선택 (강제 매각 협상) ──────────────────────────────────────────────

const routeOpenStep: DialogueStep<CentralBankState> = {
  id: 't4-d1-open',
  lines: [
    {
      speaker: '연방재무장관',
      text: '인수 후보가 관심을 밝혔습니다. 다만 실사 없이는 가격을 말하지 않겠다고 합니다. 어느 트랙으로 갑니까.',
    },
    {
      speaker: 'FINMA 정리국장',
      text: '정리 결정문은 지금 서명할 수 있습니다. 주식 전액 상각, AT1 전액 상각, 베일인 채권의 주식 전환으로 자본이 약 730억 프랑 늘어납니다. 다만 유동성은 어느 쪽이든 저희가 대야 합니다.',
    },
  ],
  note: '여기서 고른 트랙이 이 주말의 나머지를 정합니다.',
  replies: [
    {
      id: 'r-open-sale',
      label: '매각 협상을 진행한다 — 가격과 조건을 받아 본다',
      next: 't4-d1-price',
      expert: {
        rating: 78,
        rationale:
          '민간 해법이 일반적으로 더 적절하고 비례적이다. 조건을 받아 보는 것 자체는 다른 트랙을 닫지 않는다.',
      },
    },
    {
      id: 'r-open-resolution',
      label: '정리 결정문에 서명한다 — 제도가 설계된 대로 간다',
      resolvesTo: 't4-d1-resolution',
      expert: {
        rating: 82,
        rationale:
          '서열이 뒤집히지 않는 유일한 길이며 제도가 이 상황을 위해 만들어졌다. 대신 세계적 시스템 중요 은행의 첫 정리이고 외국 인정 절차가 관건이다.',
      },
    },
    {
      id: 'r-open-nationalise',
      label: '연방이 단독 주주가 되는 국유화를 지시한다',
      resolvesTo: 't4-d1-nationalisation',
      expert: {
        rating: 42,
        rationale:
          '실행은 확실하지만 은행의 모든 위험을 납세자가 떠안는다. 규제·법률·리스크 어느 쪽에서도 우선순위가 아니었다.',
      },
    },
    {
      id: 'r-open-liquidity',
      label: '유동성을 더 넣고 이번 주말은 넘긴다',
      resolvesTo: 't4-d1-standalone',
      expert: {
        rating: 12,
        rationale:
          '이틀 전에 480억을 넣은 날 유출이 더 커졌다. 같은 수단을 더 크게 쓰는 것은 같은 결과를 더 비싸게 사는 일이다.',
      },
      trap: true,
      trapExplanation:
        '유동성 지원만으로 주말을 넘길 수 있다는 판단은 주말 내내 가장 매력적인 오답이다. 돈은 있고(긴급명령이 열어 두었다), 구조 조치는 되돌릴 수 없으며, 월요일이면 시장이 진정될지도 모른다. 틀린 이유는 대시보드에 이미 있다 — 지원한 날의 유출이 지원하지 않은 날보다 컸다.',
    },
  ],
}

const routePriceStep: DialogueStep<CentralBankState> = {
  id: 't4-d1-price',
  lines: [
    {
      speaker: '인수 후보 최고재무책임자',
      text: '실사를 마쳤습니다. 정리 대상 자산의 가치를 저희 힘만으로는 확정할 수 없습니다. 연방정부의 손실보전 보증이 없으면 이 거래는 없습니다. 얼마까지 가능합니까.',
    },
  ],
  note: '여기서 약속한 보증 규모는 월요일에 이행 여부로 평가됩니다.',
  replies: commitReplies<CentralBankState>('lossGuaranteeBn', [0, 9, 25], {
    idPrefix: 't4-d1-guarantee',
    unit: '십억 프랑',
    label: (v) => (v === 0 ? '손실보전 보증은 없다' : `손실보전 보증 ${v}0억 프랑까지 가능하다`),
    next: (v) => (v === 0 ? 't4-d1-walkaway' : 't4-d1-terms'),
    expert: (v) => ({
      rating: v === 0 ? 25 : v === 9 ? 85 : 50,
      rationale:
        v === 0
          ? '보증 없이 매각을 요구하면 인수 후보는 협상장을 떠난다. 그 자체가 나쁜 선택은 아니지만, 남는 트랙이 무엇인지 준비되어 있어야 한다.'
          : v === 9
            ? '인수자가 먼저 확정손실 50억 프랑을 부담한 뒤에야 지급되는 90억 프랑의 보증은 납세자 위험을 후순위·상한부로 묶는다. 실제로 채택된 구조다.'
            : '250억 프랑은 거래를 확실히 성사시키지만 납세자 위험을 상대의 협상력에 맞춰 늘린다. 정치적 비용은 월요일이 아니라 이후 몇 년에 걸쳐 청구된다.',
    }),
    trap: (v) => v === 25,
    trapExplanation: (v) =>
      v === 25
        ? '거래를 확실히 성사시키기 위해 보증을 올리는 것은 토요일 밤에 가장 쉬운 선택이다. 그러나 보증의 크기는 상대가 요구한 만큼이 아니라 자기 자본으로 감당하지 못하는 만큼이어야 한다 — 그 선을 협상 상대가 정하게 두면 안 된다.'
        : undefined,
  }),
}

const routeWalkawayStep: DialogueStep<CentralBankState> = {
  id: 't4-d1-walkaway',
  lines: [
    {
      speaker: '인수 후보 회장',
      text: '보증이 없다면 저희 주주에게 설명할 수 없습니다. 협상을 여기서 끝내겠습니다. 일요일 저녁까지 다른 방법을 찾으시기 바랍니다.',
    },
    {
      speaker: 'FINMA 정리국장',
      text: '그러면 남은 것은 세 가지입니다. 정리, 국유화, 그리고 파산입니다. 셋 다 오늘 밤 안에 서명해야 합니다.',
    },
  ],
  replies: [
    {
      id: 'r-walk-resolution',
      label: '정리 결정문에 서명한다',
      resolvesTo: 't4-d1-resolution',
      expert: {
        rating: 80,
        rationale:
          '매각이 없을 때 제도가 상정한 답이 바로 이것이다. 주식이 먼저 상각되므로 서열도 뒤집히지 않는다.',
      },
    },
    {
      id: 'r-walk-nationalise',
      label: '국유화한다',
      resolvesTo: 't4-d1-nationalisation',
      expert: {
        rating: 45,
        rationale:
          '확실하지만 모든 위험이 납세자에게 간다. 준비된 정리계획이 있는데 쓰지 않는 선택이다.',
      },
    },
    {
      id: 'r-walk-bankruptcy',
      label: '그룹을 파산시키고 스위스 긴급계획을 발동한다',
      resolvesTo: 't4-d1-bankruptcy',
      expert: {
        rating: 10,
        rationale:
          '정리가 성공할 가능성이 없을 때의 마지막 수단이다. 긴급계획으로 국내 시스템 기능은 유지되더라도 금융중심지와 국가 신인도의 손상은 막대하다.',
      },
      trap: true,
      trapExplanation:
        '"규율은 실패를 허용해야 한다"는 원칙은 옳다. 그러나 정리 결정문이 서명 가능한 상태로 같은 방에 있는데 파산을 고르는 것은 원칙이 아니라 준비의 포기다.',
    },
  ],
}

const routeTermsStep: DialogueStep<CentralBankState> = {
  id: 't4-d1-terms',
  lines: [
    {
      speaker: '연방재무장관',
      text: '보증 규모는 정해졌습니다. 남은 것은 유동성입니다. 인수자는 월요일 아침에 두 은행 몫의 결제를 모두 감당해야 합니다.',
    },
    {
      speaker: 'SNB 총재',
      text: '재무부의 조사에서 은행은 다음 주를 문제 없이 시작하려면 여러 통화로 약 1,000억 프랑이 필요하다고 보고했습니다.',
    },
  ],
  replies: [
    {
      id: 'r-terms-plb',
      label: '연방 이행보증부 백스톱까지 함께 연다',
      setFlags: { plb_committed: true },
      resolvesTo: 't4-d1-merger',
      expert: {
        rating: 88,
        rationale:
          '유동성 약정이 발표에 함께 담겨야 월요일 개장이 성립한다. 실제로 SNB는 우선변제권부 1,000억과 연방 이행보증부 1,000억을 함께 열었다.',
      },
    },
    {
      id: 'r-terms-ela-only',
      label: '추가 대출만 열고 연방 이행보증은 미룬다',
      resolvesTo: 't4-d1-merger',
      expert: {
        rating: 45,
        rationale:
          '보증을 미루면 담보가 떨어지는 순간 다시 같은 자리로 돌아온다. 발표의 신뢰도는 그 안에 담긴 유동성 약정의 크기로 측정된다.',
      },
    },
  ],
}

const routeOptions: O[] = [
  {
    id: 't4-d1-merger',
    label: '인수 후보 은행에 의한 흡수합병으로 간다',
    description:
      '전량 주식교환으로 흡수합병한다. 주주에게는 대가가 지급되고, 연방정부는 손실보전 보증을, SNB는 대규모 유동성을 댄다. 합병법 특례가 있어야 주주총회 없이 성립한다.',
    effects: [
      csFx.chooseRoute({ route: 'merger', label: '흡수합병' }),
      csFx.setConsideration({ amount: 3, label: '주주 대가 30억 프랑(주당 0.76프랑)' }),
      csFx.lossGuarantee({ amount: 100, reason: 'PLB 이행보증 약정' }),
      csFx.lossGuaranteeFromCounter({
        counter: 'lossGuaranteeBn',
        fallback: 9,
        reason: '손실보전 보증',
      }),
      csFx.commitFacility({
        amount: 100,
        flagKey: 'plb_committed',
        flagAmount: 200,
        label: '유동성 약정 확정',
      }),
      flag('route_committed'),
    ],
    delayedEffects: [
      {
        afterTurns: 1,
        when: { counter: 'lossGuaranteeBn', lt: 9 },
        description:
          '약속한 손실보전 보증이 인수자의 최소선에 못 미쳐 월요일 아침에 조건 재협상이 열린다',
        effects: [
          confidence(-8, '합병 조건 재협상'),
          csFx.adjustDrain({ factor: 1.2, reason: '조건 재협상' }),
        ],
      },
      {
        afterTurns: 1,
        when: { counter: 'lossGuaranteeBn', gte: 25 },
        description: '보증 규모가 과도해 의회와 여론의 반발이 즉시 나타난다',
        effects: [
          op('confidence.board', 'add', -14, '납세자 부담에 대한 정치적 반발'),
          confidence(-4, '보증 규모 논란'),
        ],
      },
    ],
    expert: {
      rating: 76,
      rationale:
        'FINMA는 네 갈래를 견준 끝에 이 길을 골랐다 — 민간 해법이 더 적절하고 비례적이며, 시장의 신뢰를 즉시 회복시킬 가능성이 크고, 실패하더라도 정리용 자본이 남아 채권자 보호가 유지된다는 이유였다. 반면 이 선택은 주주에게 대가가 가면서 AT1이 전액 상각되는 순서 역전을 낳았고, 그 법적 근거는 이후 계속 다투어지고 있다. 논쟁 중인 쟁점이므로 단정하지 않는다.',
      historicalNote:
        '실제 선택. 2023년 3월 19일 저녁 합병 합의, 대가 30억 프랑(CS 22.48주당 UBS 1주), 연방 손실보전 보증 최대 90억 프랑, SNB 유동성 최대 2,000억 프랑.',
      sourceRefs: [S.finma, S.merger, S.finma319],
    },
    consequences:
      '일요일 저녁 기자회견에서 합병이 발표되었습니다. 대가는 30억 프랑, 연방 손실보전 보증과 대규모 유동성 약정이 함께 공표되었습니다.',
    historical: true,
    irreversible: true,
    feasibility: {
      basis: '합병법 특례와 손실보전 보증의 근거는 긴급명령 개정으로 같은 날 마련되었다',
      sourceRefs: [S.ord136],
    },
    calibrationNote: '대가 3.0 · 보증 100 + 카운터(기본 9) = 109 [calibration.md §7]',
    preview: [{ metric: 'confidence', direction: 'up', magnitude: 3 }],
  },
  {
    id: 't4-d1-resolution',
    label: '정리계획에 따라 베일인을 명령한다',
    description:
      'FINMA가 정리를 명한다. 주식 전액 상각, AT1 전액 상각, 베일인 채권의 주식 전환으로 자본이 약 730억 프랑 늘어나고, 이사회 의장이 교체되며 정리인이 선임된다. 유동성은 SNB가 댄다.',
    effects: [
      csFx.chooseRoute({ route: 'resolution', label: '정리(베일인)' }),
      csFx.setConsideration({ amount: 0, label: '주주 대가 없음 — 주식 전액 상각' }),
      csFx.lossGuarantee({ amount: 100, reason: 'PLB 이행보증 약정' }),
      csFx.commitFacility({ amount: 200, label: '유동성 약정 확정' }),
      flag('route_committed'),
      flag('hierarchy_respected'),
    ],
    delayedEffects: [
      {
        afterTurns: 1,
        when: { notFlag: 'track_dual' },
        description:
          '외국 당국의 인정 절차가 준비되지 않아 월요일 아침 해외 법인에서 계약 해지가 잇따른다',
        effects: [
          confidence(-10, '국제 인정 절차 지연'),
          csFx.adjustDrain({ factor: 1.35, reason: '인정 절차 지연' }),
        ],
      },
      {
        afterTurns: 1,
        when: { flag: 'track_dual' },
        description: '병행 준비 덕분에 외국 당국이 같은 시각에 정리를 인정한다',
        effects: [
          confidence(6, '국제 인정 동시 확보'),
          op('confidence.regulators', 'add', 10, '정리 인정'),
        ],
      },
    ],
    expert: {
      rating: 72,
      rationale:
        '이 시나리오의 핵심 반사실이다. 정리를 택하면 서열이 지켜진다 — 주식이 먼저 전액 상각되고 그 다음에 AT1이 상각되므로 유럽 당국이 다음 날 별도 성명을 낼 필요도, AT1 시장이 계약 조항을 다시 읽을 필요도 없었을 것이다. 값은 실행 위험이다: 세계적 시스템 중요 은행의 정리는 어디에서도 실행된 적이 없고, 실패하면 남는 것은 파산뿐이며, 외국 관할의 인정이 같은 시각에 이루어져야 한다. FINMA는 그 위험이 합병의 위험보다 크다고 판단했다. 그 판단 자체가 이 사건에서 가장 오래 다투어지는 지점이다.',
      sourceRefs: [S.finma, S.fsi21, S.eu320],
    },
    consequences:
      '일요일 저녁 정리명령이 발효했습니다. 주식은 전액 상각되었고, AT1도 전액 상각되었으며, 베일인 채권이 주식으로 전환되었습니다. 이사회 의장이 교체되고 정리인이 선임되었습니다.',
    irreversible: true,
    feasibility: {
      basis:
        '은행법 제26조 이하의 정리 절차. 결정문·정리계획·정리인 선임 결정문은 서명 가능 상태였다',
      sourceRefs: [S.finma],
    },
    calibrationNote: '자본 +730억, 주주 대가 0, 서열 준수 플래그 [finma-cs-report-2023]',
    preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
  },
  {
    id: 't4-d1-nationalisation',
    label: '연방정부가 단독 주주가 되는 국유화를 명한다',
    description:
      '긴급명령에 근거해 연방이 은행의 단독 주주가 된다. 경영과 모든 위험을 국가가 떠안는다. 특별한 정부 지원이므로 AT1의 계약상 존립사유는 그대로 충족된다.',
    effects: [
      csFx.chooseRoute({ route: 'nationalisation', label: '국유화' }),
      csFx.setConsideration({ amount: 0, label: '주주 대가 없음 — 지분의 강제 이전' }),
      csFx.lossGuarantee({ amount: 200, reason: '국가가 전 위험을 인수' }),
      csFx.commitFacility({ amount: 200, label: '유동성 약정 확정' }),
      flag('route_committed'),
    ],
    expert: {
      rating: 40,
      rationale:
        'FINMA 보고서는 이 선택지를 실제로 검토했고 주말에 다시 한 번 준비까지 했다고 적는다. 실행은 확실하지만 국가가 대형 은행의 경영과 모든 위험을 떠안게 되어 규제·법률·리스크 어느 관점에서도 우선순위가 아니었다. 국유화 역시 특별한 정부 지원이므로 AT1의 계약상 상각은 마찬가지로 발동된다.',
      sourceRefs: [S.finma],
    },
    consequences:
      '국유화 명령이 발효했습니다. 연방이 단독 주주가 되었고, 은행의 모든 위험이 연방 재정에 들어왔습니다.',
    irreversible: true,
    feasibility: {
      basis: '연방헌법상 긴급권한에 근거한 지분 인수. 연방평의회 의결로 가능',
      sourceRefs: [S.finma, S.ord136],
    },
    preview: [{ metric: 'federalGuarantee', direction: 'up', magnitude: 3 }],
  },
  {
    id: 't4-d1-bankruptcy',
    label: '그룹을 파산시키고 스위스 긴급계획을 발동한다',
    description:
      '그룹의 질서 있는 파산을 진행하고 스위스 법인의 시스템적 중요 기능만 긴급계획으로 유지한다. 파산 결정문과 파산관재인 선임 결정문은 준비되어 있다.',
    effects: [
      csFx.chooseRoute({ route: 'bankruptcy', label: '파산 + 긴급계획' }),
      csFx.setConsideration({ amount: 0, label: '주주 대가 없음' }),
      csFx.commitFacility({ amount: 0, label: '유동성 약정 없음' }),
      flag('route_committed'),
    ],
    expert: {
      rating: 8,
      rationale:
        '정리가 성공할 가능성이 없을 때만 남는 선택지다. 긴급계획이 성공적으로 발동된다고 가정하더라도 경제·금융중심지·국가 신인도의 손상은 막대하며, FINMA는 이를 명시적으로 최후 수단으로 분류했다.',
      sourceRefs: [S.finma],
    },
    consequences:
      '파산 결정문이 발효했습니다. 스위스 긴급계획이 발동되어 국내 결제와 예금은 유지되지만, 그룹의 해외 사업은 각국 도산 절차로 흩어졌습니다.',
    irreversible: true,
    feasibility: {
      basis: '은행법상 파산 절차. 결정문과 관재인 선임 결정문이 준비되어 있었다',
      sourceRefs: [S.finma],
    },
    preview: [{ metric: 'confidence', direction: 'down', magnitude: 3 }],
  },
  {
    id: 't4-d1-standalone',
    label: '유동성을 더 넣고 독립 유지로 간다',
    description:
      '구조 조치 없이 긴급명령의 창구를 최대한 열어 월요일을 넘긴다. 다음 주에 다시 판단한다.',
    effects: [
      csFx.chooseRoute({ route: 'standalone', label: '유동성만으로 독립 유지' }),
      csFx.provideLiquidity({ amount: 50, facility: 'elaPlus', label: 'ELA+ 500억 추가 공여' }),
      csFx.commitFacility({ amount: 50, label: '유동성 약정 확정' }),
      flag('route_committed'),
    ],
    expert: {
      rating: 10,
      rationale:
        '이 시나리오의 함정이다. 이틀 전 480억을 넣은 날 유출은 171억으로 오히려 커졌다. 신뢰 위기에서 유동성은 시간을 살 뿐 구조를 바꾸지 못하며, 월요일 개장에 필요한 현금은 약 1,000억 프랑이다. FINMA의 표현대로 은행은 이미 "스스로 신뢰를 회복할 수 없는" 상태였다.',
      sourceRefs: [S.finma, S.finma319],
    },
    consequences:
      '구조 조치 없이 창구만 더 열었습니다. 일요일 저녁 기자회견은 취소되었고, 아시아가 열립니다.',
    trap: true,
    trapExplanation:
      '토요일 밤에는 이것이 가장 안전해 보인다 — 돈은 있고, 구조 조치는 되돌릴 수 없으며, 하루만 더 보면 시장이 진정될 수도 있다. 틀린 이유는 목요일에 이미 증명되었다. 유동성으로 살 수 있는 것은 시간이지 신뢰가 아니다.',
    remediationCard: 'bank-run-dynamics',
    preview: [{ metric: 'csLiquidity', direction: 'up', magnitude: 2 }],
  },
]

// ── 대화 2: AT1 처리 방침 ────────────────────────────────────────────────────────────────────

const at1BuyerStep: DialogueStep<CentralBankState> = {
  id: 't4-d2-buyer',
  lines: [
    {
      speaker: '인수 후보 최고재무책임자',
      text: '저희가 떠안는 대차대조표를 보면 자본이 더 필요합니다. AT1 160억 프랑이 보통주자본으로 전환되지 않으면 이 가격에는 서명할 수 없습니다.',
    },
    {
      speaker: '연방재무부 법무실장',
      text: '조건서를 확인했습니다. 이 상품들은 계약상 존립사유 — 특히 특별한 정부 지원이 제공되는 경우 — 에 전액 상각되도록 발행되어 있습니다.',
    },
  ],
  note: '여기서 정한 방침은 월요일 아침 유럽 AT1 시장 전체가 읽습니다.',
  replies: [
    {
      id: 'r-at1-accept',
      label: '계약 조항에 따른 전액 상각을 검토한다',
      next: 't4-d2-legal',
      expert: {
        rating: 72,
        rationale:
          '조항은 실제로 그렇게 쓰여 있고, 이행보증부 특별 지원이 그 조항의 요건을 충족한다는 것이 당국의 해석이다. 다음 단계에서 근거를 어디에 둘지가 남는다.',
      },
    },
    {
      id: 'r-at1-equity-zero',
      label: '상각하되 주주 대가도 0으로 맞춘다',
      resolvesTo: 't4-d2-equity-zero',
      expert: {
        rating: 62,
        rationale:
          '서열을 지키는 가장 단순한 방법이다. 다만 대가가 0이면 사실상 정리이며, 인수 후보가 사법 위험을 이유로 이탈할 수 있다.',
      },
    },
    {
      id: 'r-at1-refuse',
      label: '상각하지 않는다 — 자본은 대가 조정으로 맞춘다',
      resolvesTo: 't4-d2-no-writeoff',
      expert: {
        rating: 35,
        rationale:
          'AT1의 계속기업 손실흡수 기능을 포기하는 대신 서열 논란을 피한다. 그 대가는 인수 조건의 재협상이며 시간이 없다.',
      },
    },
  ],
}

const at1LegalStep: DialogueStep<CentralBankState> = {
  id: 't4-d2-legal',
  lines: [
    {
      speaker: 'FINMA 법무실장',
      text: '상각의 법적 근거를 무엇에 둘지 정해야 합니다. 계약 조항만으로 갈 수도 있고, 긴급명령에 상각 명령 권한을 명시적으로 넣을 수도 있습니다. 뒤의 것이 더 튼튼하지만 긴급권한의 범위를 넓힙니다.',
    },
  ],
  replies: [
    {
      id: 'r-legal-contract',
      label: '계약 조항만을 근거로 상각을 요구한다',
      next: 't4-d2-comms',
      expert: {
        rating: 55,
        rationale:
          '발행조건에 이미 있는 권리를 행사하는 것이므로 개입의 폭이 가장 좁다. 다만 존립사유의 충족 여부를 두고 다툼이 남는다.',
      },
    },
    {
      id: 'r-legal-ordinance',
      label: '긴급명령에 상각 명령 권한을 명시하고 그에 근거한다',
      setFlags: { at1_ordinance_basis: true },
      next: 't4-d2-comms',
      expert: {
        rating: 75,
        rationale:
          '집행의 확실성이 가장 높다. 실제로 채택된 구조이며, 동시에 긴급권한으로 제3자의 재산권을 소멸시킨다는 점에서 이후 가장 길게 다투어지는 지점이 된다.',
      },
    },
    {
      id: 'r-legal-none',
      label: '근거를 확정하지 않고 발표부터 한다',
      resolvesTo: 't4-d2-no-writeoff',
      expert: {
        rating: 15,
        rationale:
          '근거 없는 처분은 집행되지 않는다. 상각을 전제로 한 인수 조건이 월요일에 무너진다.',
      },
      trap: true,
      trapExplanation:
        '시간이 없을 때 "근거는 나중에 정리하자"는 유혹이 가장 크다. 그러나 재산권을 소멸시키는 처분에서 근거의 공백은 미뤄지는 것이 아니라 몇 년간 남는다.',
    },
  ],
}

const at1CommsStep: DialogueStep<CentralBankState> = {
  id: 't4-d2-comms',
  lines: [
    {
      speaker: '연방재무부 공보실장',
      text: '발표 문안입니다. 상각 사실만 적을 수도 있고, 계약 조항과 법적 근거, 그리고 이것이 일반적 서열의 변경이 아니라는 점까지 같은 시각에 적을 수도 있습니다.',
    },
    {
      speaker: 'FINMA 국제협력실장',
      text: '유럽 당국이 오늘 오후에도 서열을 물었습니다. 저쪽과 문안을 맞추면 같은 시각에 함께 낼 수 있습니다.',
    },
  ],
  replies: [
    {
      id: 'r-comms-result',
      label: '상각 사실만 발표한다',
      resolvesTo: 't4-d2-writeoff-silent',
      expert: {
        rating: 32,
        rationale:
          '가장 짧고 가장 비싼 문안이다. 주주가 대가를 받는데 AT1이 0이 되는 결과만 남으면, 시장은 스위스의 계약 조항이 아니라 유럽 전체의 서열을 다시 읽는다.',
      },
      trap: true,
      trapExplanation:
        '발표 시각까지 남은 시간이 짧을수록 "결과만 적자"가 옳아 보인다. 그러나 설명 없는 결과는 설명을 다른 사람이 쓰게 만든다 — 다음 날 아침 유럽 감독·정리 당국이 서열을 재확인하는 성명을 따로 내야 했던 것이 그 비용이다.',
    },
    {
      id: 'r-comms-explain',
      label: '계약 조항과 법적 근거를 같은 시각에 함께 공표한다',
      resolvesTo: 't4-d2-writeoff-explained',
      expert: {
        rating: 85,
        rationale:
          '조항은 공개된 발행조건이고 근거는 공포된 명령이다. 결과와 함께 내놓으면 시장은 "서열이 바뀌었다"가 아니라 "이 상품의 조건이 원래 그렇다"로 읽는다.',
      },
    },
    {
      id: 'r-comms-explain-eu',
      label: '유럽 당국과 문안을 맞추어 같은 시각에 함께 낸다',
      setFlags: { at1_eu_coordinated: true },
      resolvesTo: 't4-d2-writeoff-explained',
      expert: {
        rating: 92,
        rationale:
          '스위스의 처분이 유럽의 서열 원칙을 바꾸는 것이 아니라는 점을 각 관할의 당국이 같은 시각에 자기 시장을 향해 말하게 한다. 실제로는 이 성명이 스위스 발표 다음 날 아침에 따로 나왔고, 그 하룻밤이 유럽 AT1 시장의 가격에 그대로 찍혔다.',
      },
    },
  ],
}

const at1Options: O[] = [
  {
    id: 't4-d2-writeoff-silent',
    label: 'AT1 160억 프랑을 전액 상각하고 결과만 공표한다',
    description:
      '계약상 존립사유에 따른 전액 상각을 명령하고, 발표에는 상각 사실과 그것이 보통주자본을 늘린다는 점만 적는다. 주주에게는 합병 대가가 그대로 지급된다.',
    effects: [
      csFx.at1Writedown({ amount: 16, explained: false, label: 'AT1 160억 전액 상각(설명 없음)' }),
      flag('at1_order_inverted'),
    ],
    delayedEffects: [
      {
        afterTurns: 1,
        description:
          '유럽 감독·정리 당국이 서열을 재확인하는 별도 성명을 내고, 유럽 AT1 시장 전체가 다시 가격을 매긴다',
        effects: [
          op('confidence.investors', 'add', -10, '유럽 AT1 시장 재가격'),
          confidence(-4, 'AT1 서열 논란의 국제 확산'),
        ],
      },
    ],
    expert: {
      rating: 38,
      rationale:
        '계약상 가능했다는 점은 FINMA가 조항을 들어 설명한 그대로다 — 스위스 AT1은 특별한 정부 지원이 제공되는 경우 전액 상각되도록 발행되어 있었다. 문제는 그 설명이 나흘 뒤에야 나왔다는 것이다. 주주가 30억 프랑을 받는데 AT1 160억이 0이 되는 결과만 먼저 알려지자 유럽 AT1 시장 전체가 자기 조항을 다시 읽었고, 다음 날 아침 유럽 당국이 "보통주가 먼저 손실을 흡수하고 그 다음이 AT1"이라는 원칙을 재확인하는 공동성명을 내야 했다.',
      historicalNote:
        'FINMA는 3월 19일 상각을 발표했고, 법적 근거에 관한 설명은 3월 23일에 별도로 냈다.',
      sourceRefs: [S.finma319, S.finmaAt1, S.eu320],
    },
    consequences:
      'AT1 160억 프랑이 0이 되었습니다. 발표문에는 상각 사실과 자본 증가만 적혔습니다. 아시아가 열리기 전부터 유럽 AT1 호가가 무너지고 있습니다.',
    historical: true,
    irreversible: true,
    feasibility: {
      basis: '발행조건의 존립사유 조항과 긴급명령 제5a조',
      sourceRefs: [S.finmaAt1, S.ord136],
    },
    calibrationNote: 'at1MarketDamage = 상각액 × 1.0 [CAL, calibration.md §8]',
    preview: [{ metric: 'confidence', direction: 'down', magnitude: 2 }],
  },
  {
    id: 't4-d2-writeoff-explained',
    label: '전액 상각하되 근거와 예외성을 같은 시각에 공표한다',
    description:
      '같은 상각을 명령하되, 발행조건의 존립사유 조항, 긴급명령의 상각 명령 권한, 그리고 이것이 일반적 채권자 서열의 변경이 아니라 이 상품 조건의 결과라는 점을 같은 보도자료에 담는다.',
    effects: [
      csFx.at1Writedown({
        amount: 16,
        explained: true,
        label: 'AT1 160억 전액 상각(근거 동시 공표)',
      }),
      flag('at1_order_inverted'),
      flag('at1_basis_published'),
    ],
    delayedEffects: [
      {
        afterTurns: 1,
        when: { flag: 'at1_eu_coordinated' },
        description: '유럽 당국이 같은 시각에 서열 원칙을 재확인해 AT1 시장의 충격이 제한된다',
        effects: [
          op('confidence.investors', 'add', 6, '국제 공동 설명'),
          confidence(3, 'AT1 서열 논란의 조기 진화'),
        ],
      },
    ],
    expert: {
      rating: 84,
      rationale:
        '상각 자체는 계약상 가능했다 — 그 점은 다투어지지 않는다. 다투어진 것은 근거와 순서의 설명이었고, 그 설명은 결과와 같은 시각에 나와야 값이 싸다. 국제결제은행 금융안정연구소의 사후 분석도 결론이 같다: 문제는 AT1이 상각되었다는 사실이 아니라, 보통주가 남은 채로 상각되는 것이 가능하다는 사실을 시장이 그 순간에야 알게 되었다는 것이다.',
      sourceRefs: [S.finmaAt1, S.fsi21, S.eu320],
    },
    consequences:
      'AT1 160억 프랑이 0이 되었고, 같은 보도자료에 계약 조항과 명령 조문이 인용되었습니다. 유럽 쪽 문의가 발표 직후 들어오기 시작했습니다.',
    irreversible: true,
    feasibility: {
      basis: '조항 인용과 근거 공표는 같은 보도자료에 담을 수 있다',
      sourceRefs: [S.finmaAt1],
    },
    calibrationNote: 'at1MarketDamage = 상각액 × 0.35 [CAL, calibration.md §8]',
    preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
  },
  {
    id: 't4-d2-equity-zero',
    label: 'AT1을 상각하되 주주 대가도 0으로 맞춘다',
    description:
      '서열을 지킨다. 주식을 먼저 전액 상각하고 그 다음에 AT1을 상각한다. 대가가 없으므로 사실상 정리에 가까워지고, 인수 후보가 사법 위험을 이유로 조건을 다시 요구할 수 있다.',
    effects: [
      csFx.at1Writedown({ amount: 16, explained: true, label: 'AT1 상각 — 주식 선순위 상각 후' }),
      csFx.setConsideration({ amount: 0, label: '주주 대가 0 — 서열 준수' }),
      flag('hierarchy_respected'),
    ],
    delayedEffects: [
      {
        afterTurns: 1,
        when: { chose: { decision: 't4-d1', option: 't4-d1-merger' } },
        description: '대가가 사라지자 인수자가 사법 위험을 이유로 보증 확대를 요구한다',
        effects: [
          csFx.lossGuarantee({ amount: 15, reason: '대가 소멸에 따른 사법 위험 보전' }),
          op('confidence.board', 'add', -6, '추가 보증'),
        ],
      },
    ],
    expert: {
      rating: 66,
      rationale:
        '순서 역전을 없애는 가장 직접적인 방법이며 유럽 당국이 다음 날 재확인한 원칙과도 일치한다. 값은 거래 구조다 — 대가가 0인 사적 합병은 성립하기 어렵고, 실질적으로는 정리에 가까워진다. 그래서 이 선택은 정리 경로에서는 자연스럽고 매각 경로에서는 비싸다.',
      sourceRefs: [S.eu320, S.fsi21],
    },
    consequences:
      '주식이 먼저 전액 상각되었고 AT1이 그 뒤에 상각되었습니다. 인수자의 법무팀이 밤사이 추가 보증을 요구하고 있습니다.',
    irreversible: true,
    feasibility: {
      basis:
        '정리 절차에서는 표준이며, 합병에서는 대가 없는 지분 이전이 되어 긴급명령 근거가 필요하다',
      sourceRefs: [S.finma, S.ord136],
    },
    preview: [{ metric: 'federalGuarantee', direction: 'up', magnitude: 1 }],
  },
  {
    id: 't4-d2-no-writeoff',
    label: 'AT1을 상각하지 않고 대가 조정으로 자본을 맞춘다',
    description:
      '상각을 명령하지 않는다. 필요한 자본은 인수 대가를 낮추거나 연방 보증을 늘려 맞춘다. 서열 논란은 생기지 않는다.',
    effects: [
      csFx.setConsideration({ amount: 0.5, label: '대가 인하 — 상각 대신' }),
      csFx.lossGuarantee({ amount: 20, reason: 'AT1 미상각에 따른 자본 보전' }),
      confidence(-6, '자본 보강 수단의 불확실성'),
      flag('at1_preserved'),
    ],
    expert: {
      rating: 40,
      rationale:
        'AT1 시장의 서열 충격은 피한다. 그러나 AT1은 위기에 자본으로 바뀌라고 만든 상품이고, 정작 그 위기에 쓰지 않으면 상품의 존재 이유가 사라진다 — 국제결제은행의 사후 분석이 던지는 질문이 정확히 이것이다. 게다가 부족한 자본은 결국 납세자의 보증으로 메워진다.',
      sourceRefs: [S.fsi21, S.finma],
    },
    consequences:
      'AT1은 그대로 남았습니다. 대가가 낮아지고 연방 보증이 늘었습니다. AT1 호가는 회복되었지만 재무부는 추가 위험을 떠안았습니다.',
    feasibility: {
      basis: '상각을 명하지 않는 것은 언제나 가능하며, 부족 자본은 보증이나 대가로 조정한다',
      sourceRefs: [S.finma],
    },
    preview: [{ metric: 'federalGuarantee', direction: 'up', magnitude: 2 }],
  },
]

/** 인수 후보 은행 회장의 전화. 조건 제시 시각에 걸려 온다. 대사는 재구성이다. */
const t4BuyerCall: Interrupt<CentralBankState> = {
  id: 't4-i1-buyer',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 60,
  defaultOptionId: 't4-i1-defer',
  scoreWeight: 0.5,
  required: false,
  title: '인수 후보 은행 회장 통화',
  prompt: '회장이 보증 확대를 요구합니다. 어떻게 답하시겠습니까?',
  context: '발표 시한까지 남은 것은 하루가 되지 않습니다. 상대도 그것을 알고 있습니다.',
  source: { kind: 'call', caller: '인수 후보 은행 회장', tone: 'urgent' },
  lines: [
    {
      speaker: '인수 후보 은행 회장',
      text: '저희 이사회가 방금 모였습니다. 실사에서 본 자산으로는 지금 조건에 서명할 수 없습니다. 손실보전 보증을 250억으로 올려 주시면 오늘 밤 서명하겠습니다. 아니면 저희는 빠지겠습니다.',
    },
  ],
  dimensions: ['policy', 'communication'],
  cardRefs: ['fdic-resolution-weekend'],
  options: [
    {
      id: 't4-i1-firm',
      label: '조건을 유지하고 정리 결정문이 준비되어 있음을 알린다',
      description:
        '보증 규모는 그대로 두고, 정리 결정문이 서명 가능한 상태로 같은 건물에 있다는 사실을 알린다. 협박이 아니라 사실의 고지다.',
      effects: [flag('negotiation_leverage'), op('confidence.board', 'add', 6, '협상 조건 방어')],
      expert: {
        rating: 86,
        rationale:
          '협상에서 가격을 정하는 것은 상대가 아는 나의 대안이다. 정리가 실행 가능한 상태라는 사실은 비밀이 아니라 지렛대이며, 이것이 없으면 보증 규모는 상대가 정한다.',
        sourceRefs: [S.finma],
      },
      consequences:
        '회장은 20분 뒤 다시 전화해 "이사회를 다시 소집하겠다"고 했습니다. 조건은 그대로입니다.',
      preview: [{ metric: 'federalGuarantee', direction: 'flat', magnitude: 1 }],
    },
    {
      id: 't4-i1-raise',
      label: '손실보전 보증을 250억 프랑으로 올린다',
      description: '거래를 확실히 성사시키기 위해 상대가 요구한 금액을 받아들인다.',
      effects: [
        setCounter<CentralBankState>('lossGuaranteeBn', 25),
        op('confidence.board', 'add', -10, '납세자 부담 확대'),
      ],
      expert: {
        rating: 28,
        rationale:
          '거래는 확실해지지만 보증의 크기를 협상 상대가 정하게 된다. 실제 구조는 인수자가 확정손실 50억 프랑을 먼저 부담한 뒤에야 최대 90억이 지급되는 후순위·상한부 보증이었고, 그 선을 지킨 것이 이 주말의 몇 안 되는 방어 지점이다.',
        sourceRefs: [S.ord136, S.puk],
      },
      consequences:
        '보증 한도가 250억으로 올라갔습니다. 회장은 "그럼 오늘 밤에 뵙겠습니다"라고 답했습니다.',
      trap: true,
      trapExplanation:
        '시한이 다가올수록 "얼마면 끝나는가"라는 질문이 유일한 질문처럼 보인다. 그러나 그 답을 상대가 쓰게 두면, 금액은 필요한 만큼이 아니라 요구할 수 있는 만큼이 된다.',
      preview: [{ metric: 'federalGuarantee', direction: 'up', magnitude: 2 }],
    },
    {
      id: 't4-i1-defer',
      label: '재무부와 협의한 뒤 회신하겠다고 답한다',
      description: '즉답하지 않고 연방재무부·SNB와 협의한 뒤 답한다.',
      effects: [op('confidence.counterparties', 'add', -2, '회신 지연')],
      expert: {
        rating: 50,
        rationale:
          '보증 규모는 재무부와 재정대표단의 권한이므로 즉답하지 않는 것이 절차적으로 옳다. 다만 시한이 가까울수록 지연은 상대에게 시간을 주는 것이기도 하다.',
        sourceRefs: [S.finma],
      },
      consequences: '회신을 미뤘습니다. 회장은 "저희는 밤 10시까지 기다립니다"라고 답했습니다.',
      historical: true,
      preview: [{ metric: 'confidence', direction: 'flat', magnitude: 1 }],
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2023년 3월 18~19일 (토·일)',
  title: '취리히의 주말',
  time: '2023-03-18T09:00:00+01:00',
  ticks: 5,
  tickLabels: [
    '토 09:00 협상 개시',
    '토 14:00 실사',
    '토 20:00 조건 제시',
    '일 19:30 발표 시한',
    '일 23:00 아시아 개장',
  ],
  entryEffects: [
    {
      id: 't4-no-window',
      description: '주말 — 송금 창구가 없다. 당일 유출 0',
      effects: [csFx.resetDailyOutflow()],
    },
    {
      id: 't4-prefunding',
      description: '대리은행·청산기관의 주말 선납 요구 50억 프랑',
      effects: [csFx.pressureDrain({ amount: 5, reason: '대리은행·청산기관 선납 요구' })],
    },
    {
      id: 't4-monday-requirement',
      description: '은행 재무부서가 월요일 개장에 필요한 현금을 약 1,000억 프랑으로 보고',
      effects: [
        op('institution.custom.mondayCashRequirement', 'set', 100, '월요일 개장 소요 현금'),
        csFx.refresh('주말 지표 갱신'),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't4-asia-open',
      atTick: 4,
      description: '아시아 개장 — 월요일 개장 요건 점검',
      effects: [csFx.mondayOpen({ requirement: 100, label: '월요일 개장 요건 점검' })],
    },
  ],
  interrupts: [t4BuyerCall],
  events: [
    {
      id: 't4-memo-saturday',
      kind: 'memo',
      atTick: 0,
      time: '토 09:00',
      from: 'FINMA 정리국',
      to: '합동 정책담당',
      subject: '토요일 아침 — 남은 시간과 남은 선택지',
      body: `- 아시아 개장까지 약 38시간입니다. 발표는 일요일 저녁 19시 30분을 넘길 수 없습니다.
- 네 갈래의 문서가 모두 준비되어 있습니다. 합병 계약 초안, 정리명령·정리계획·정리인 선임 결정문, 국유화 의결 초안, 파산 결정문·파산관재인 선임 결정문.
- 어느 갈래든 **월요일 아침에 약 1,000억 프랑의 현금이 필요합니다.** 은행 재무부서의 추정이며, 대리은행 선납·현지 감독당국의 현금 보유 요구·월·화·수 사흘치 고객자금 유출을 더한 값입니다.
- 정리를 택하면 위기관리그룹의 외국 당국이 같은 시각에 인정해야 합니다. 어제 트랙을 하나만 열어 두었다면 그 준비가 없습니다.`,
      severity: 'critical',
      sourceRefs: [S.finma],
      cardRefs: ['fdic-resolution-weekend'],
      relatedMetrics: ['mondayCashRequirement', 'csLiquidity'],
    },
    {
      id: 't4-dialogue-dd',
      kind: 'dialogue',
      atTick: 1,
      time: '토 14:00',
      title: '실사 — 정리 대상 자산',
      lines: [
        {
          speaker: '인수 후보 실사팀장',
          text: '문제는 대차대조표 전체가 아니라 한 덩어리입니다. 매각·청산 대상 자산의 가치를 저희 방법으로는 확정할 수 없습니다. 이 부분에 대한 보전이 없으면 가격을 부를 수 없습니다.',
        },
        {
          speaker: 'FINMA 감독관',
          text: '그 자산의 장부가와 최근 평가 이력은 데이터룸에 있습니다. 보전 여부는 연방재무부의 권한입니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.ord136, S.finma],
    },
    {
      id: 't4-memo-swap',
      kind: 'memo',
      atTick: 3,
      time: '일 17:00',
      from: 'SNB 국제국',
      to: '합동 정책담당',
      subject: '주요 중앙은행 공동조치 제안 — 달러 스와프 라인',
      body: `- 여섯 개 중앙은행이 상설 미달러 스와프 라인의 7일물 운영 빈도를 **주 1회에서 매일로** 확대하는 공동조치를 제안해 왔습니다.
- 시행은 내일(월요일)부터, 최소 4월 말까지입니다. 발표는 오늘 저녁 각국이 같은 시각에 냅니다.
- 우리가 동참하면 발표는 "스위스 한 나라의 문제"가 아니라 "국제적으로 관리되는 상황"으로 읽힙니다. 동참하지 않으면 그 반대로 읽힙니다.`,
      severity: 'info',
      sourceRefs: [S.swap],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 't4-memo-agm',
      kind: 'memo',
      atTick: 2,
      time: '토 20:30',
      from: '연방재무부 법무실',
      to: '합동 정책평의회',
      subject: '주주총회 결의를 생략할 수 있는가',
      body: `- 합병법에 따른 흡수합병에는 원칙적으로 양 회사 주주총회의 결의가 필요합니다. 소집·공고 기간을 지키면 **몇 주가 걸립니다.**
- 긴급명령을 개정해 시스템적 중요 은행 간 거래에 한해 "FINMA와 조율한 경우 주주총회 결의를 요하지 않는다"고 정할 수 있습니다. 합병법의 일부 조항도 적용을 배제할 수 있습니다.
- **속도와 정당성이 정면으로 부딪칩니다.** 주주의 의결권은 재산권의 핵심이고, 그것을 명령으로 생략하는 것은 전례가 없습니다.
- 대안은 주주총회를 소집하되 합병 발효를 그때까지 유예하는 것입니다. 그러면 월요일 아침에 발효되는 것은 아무것도 없습니다.`,
      severity: 'critical',
      sourceRefs: [S.ord136],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '정리 방식의 선택',
      prompt: '이 주말을 어떻게 끝내시겠습니까?',
      context:
        '네 갈래의 문서가 모두 준비되어 있습니다. 일요일 저녁 19시 30분까지 하나를 골라야 하고, 어느 갈래든 월요일 아침에 약 1,000억 프랑이 필요합니다.',
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't4-d1-merger',
      select: { min: 1, max: 1 },
      requiredConcepts: ['fdic-resolution-weekend', 'bank-run-dynamics'],
      dimensions: ['policy', 'solvency', 'liquidity'],
      steps: [routeOpenStep, routePriceStep, routeWalkawayStep, routeTermsStep],
      options: routeOptions,
    },
    {
      id: 't4-d2',
      title: 'AT1 처리 방침',
      prompt: 'AT1 160억 프랑을 어떻게 처리하시겠습니까?',
      context:
        '조건서에는 특별한 정부 지원이 제공되면 전액 상각된다고 쓰여 있습니다. 유럽의 일반적 서열에서는 보통주가 먼저입니다. 두 문장이 같은 은행에 동시에 적용됩니다.',
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't4-d2-writeoff-silent',
      select: { min: 1, max: 1 },
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['policy', 'compliance', 'communication'],
      steps: [at1BuyerStep, at1LegalStep, at1CommsStep],
      options: at1Options,
    },
    {
      id: 't4-d3',
      title: '긴급명령의 범위와 국제 공조',
      prompt: '일요일 저녁에 무엇을 함께 발효·발표하시겠습니까? (최대 2개)',
      context:
        '주주총회를 생략하면 월요일 아침에 합병이 발효하고, 소집하면 몇 주가 걸립니다. 같은 저녁에 여섯 중앙은행의 공동조치도 나갑니다.',
      availableFrom: 2,
      deadlineTick: 3,
      defaultOptionId: 't4-d3-skip-agm',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t4-d3-skip-agm', 't4-d3-agm'],
        ['t4-d3-skip-agm', 't4-d3-none'],
        ['t4-d3-agm', 't4-d3-none'],
        ['t4-d3-swap-lines', 't4-d3-none'],
      ],
      dimensions: ['compliance', 'policy', 'communication'],
      options: [
        {
          id: 't4-d3-skip-agm',
          label: '긴급명령을 개정해 주주총회 결의를 생략한다',
          description:
            '시스템적 중요 은행 간 거래에 한해 FINMA와 조율한 경우 주주총회 결의를 요하지 않는다고 정하고, 합병법의 일부 조항 적용을 배제한다. 오늘 저녁 발효한다.',
          effects: [
            flag('agm_waived'),
            confidence(4, '월요일 아침 발효 가능'),
            op('confidence.investors', 'add', -8, '주주 의결권의 명령에 의한 배제'),
            regulator({ set: 4 }, '긴급명령에 의한 합병 특례'),
          ],
          expert: {
            rating: 70,
            rationale:
              '속도 없이는 이 거래가 성립하지 않는다. 주주총회 소집·공고에는 몇 주가 걸리고 은행에는 며칠이 없다. 동시에 이것은 주주 의결권을 명령으로 소멸시킨 전례 없는 조치이고, 그 정당성은 의회 조사와 소송으로 오래 다투어진다. 속도의 값을 정당성으로 치른 대표적 사례이므로 단정하지 않고 양쪽을 모두 기록한다.',
            historicalNote:
              '긴급명령 개정(제10a조)이 2023년 3월 19일 20시에 발효했다: 시스템적 중요 은행 간 거래에는 "참여 회사 주주총회의 결의가 필요하지 않다".',
            sourceRefs: [S.ord136, S.puk],
          },
          consequences:
            '개정 명령이 저녁 8시에 발효했습니다. 주주총회 없이 합병이 성립합니다. 주주단체가 즉시 성명을 냈습니다.',
          historical: true,
          irreversible: true,
          feasibility: {
            basis: '연방헌법상 긴급권한에 근거한 명령 개정, 연방평의회 의결로 즉시 발효',
            sourceRefs: [S.ord136],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't4-d3-swap-lines',
          label: '주요 중앙은행 달러 스와프 라인 공동조치에 동참한다',
          description:
            '여섯 중앙은행이 상설 미달러 스와프 라인의 7일물 운영 빈도를 주 1회에서 매일로 확대한다. 내일부터 최소 4월 말까지 시행하며, 각국이 같은 시각에 발표한다.',
          effects: [
            flag('swap_lines_daily'),
            confidence(5, '주요 중앙은행 공동조치'),
            op('confidence.regulators', 'add', 10, '국제 공조'),
            op('market.fundingStressBp', 'add', -12, '달러 조달 스트레스 완화'),
          ],
          expert: {
            rating: 88,
            rationale:
              '스위스의 발표를 "한 나라의 사고"가 아니라 "국제적으로 관리되는 상황"으로 읽히게 만드는 장치다. 달러 조달 스트레스가 실제로 완화되었고, 같은 일요일 저녁에 나왔다는 사실 자체가 조율의 증거였다.',
            sourceRefs: [S.swap],
          },
          consequences:
            '여섯 중앙은행의 공동 보도자료가 같은 시각에 나갔습니다. 내일부터 7일물이 매일 공급됩니다.',
          feasibility: {
            basis: '상설 스와프 라인의 운영 빈도 조정은 중앙은행 간 합의로 즉시 가능',
            sourceRefs: [S.swap],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't4-d3-agm',
          label: '주주총회를 소집하고 그때까지 합병 발효를 유예한다',
          description:
            '법적 정당성을 우선한다. 합병법의 정규 절차를 지키고, 주주총회 결의 전까지는 합병이 발효하지 않는다.',
          effects: [
            flag('agm_convened'),
            op('confidence.investors', 'add', 8, '주주 의결권 존중'),
            confidence(-14, '월요일 아침에 발효하는 것이 없다'),
            csFx.adjustDrain({ factor: 1.4, reason: '해법의 발효 지연' }),
          ],
          expert: {
            rating: 22,
            rationale:
              '정당성의 논거는 가장 강하다. 그러나 소집·공고 기간이 몇 주이고 은행에는 며칠이 없다. 발표는 있는데 발효하는 것이 없으면 월요일 아침 시장은 발표를 믿지 않는다.',
            sourceRefs: [S.ord136, S.finma],
          },
          consequences:
            '주주총회 소집 공고가 나갔습니다. 합병은 몇 주 뒤에야 발효합니다. 그 사이의 유동성은 전부 SNB가 댑니다.',
          preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't4-d3-none',
          label: '통상 절차를 유지하고 추가 조치 없이 발표만 한다',
          description: '긴급명령 개정도, 국제 공동조치도 하지 않는다.',
          effects: [
            confidence(-12, '발표만 있고 발효할 수단이 없다'),
            csFx.adjustDrain({ factor: 1.3, reason: '제도적 뒷받침 부재' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '발표는 그 자체로 아무것도 바꾸지 않는다. 발효 근거가 없고 국제 조율도 없으면 월요일 아침에 남는 것은 문장뿐이다.',
            sourceRefs: [S.ord136, S.swap],
          },
          consequences:
            '보도자료만 나갔습니다. 발효 시점을 묻는 질문에 답변이 준비되어 있지 않았습니다.',
          trap: true,
          trapExplanation:
            '"법을 건드리지 않는 것이 가장 안전하다"는 판단은 평시에는 옳다. 그러나 이 주말에는 건드리지 않은 법이 곧 발효하지 않는 해법이 된다.',
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 2 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '"월요일 개장 소요 현금" 1,000억과 "CS 가용 유동성" + "SNB 즉시 공여 여력"을 비교하십시오.',
    },
    {
      level: 2,
      decisionId: 't4-d2',
      text: '계약 조항은 그렇게 쓰여 있고, 유럽의 일반 서열은 반대입니다. 두 사실을 같은 시각에 말하는 것과 나중에 말하는 것의 차이가 이 결정의 전부입니다.',
    },
    {
      level: 3,
      decisionId: 't4-d1',
      text: '정리계획은 서명 가능한 상태로 존재합니다. 고르지 않더라도, 상대가 그 사실을 아는지 여부가 보증 규모를 정합니다.',
    },
  ],
  relatedCards: [
    'fdic-resolution-weekend',
    'economic-vs-regulatory-capital',
    'crisis-communication',
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2023-03-20 (월) "월요일 아침"
// ---------------------------------------------------------------------------------------------
export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2023년 3월 20일 (월) 07:00 CET',
  title: '월요일 아침',
  time: '2023-03-20T07:00:00+01:00',
  entryEffects: [
    {
      id: 't5-market-common',
      description: '3월 20일 시세 — Baa−10년 219bp, 미 국채 2년 3.92%, VIX 24.15',
      effects: [
        op('market.creditSpreadIgBp', 'set', 219, '3/20 Baa 5.66% − 10년 3.47%'),
        op('market.govt2yBp', 'set', 392, '3/20 미 국채 2년 3.92%'),
        op('market.volIndex', 'set', 24.15, '3/20 VIX 종가'),
      ],
    },
    {
      id: 't5-merger-draw',
      when: { flag: 'route_merger' },
      description:
        '합병 발표 후 남은 유동성 약정을 인출 — ELA+ 300억 + PLB 700억, SNB 지원 누계 1,680억',
      effects: [
        csFx.provideLiquidity({ amount: 30, facility: 'elaPlus', label: 'ELA+ 300억 추가 인출' }),
        csFx.provideLiquidity({ amount: 70, facility: 'plb', label: 'PLB 700억 인출' }),
        csFx.runoffStep({ total: 2, profile: [1], label: '3/20 고객자금 유출' }),
        csFx.equityMove({ pct: -0.557, reason: '인수 대가 주당 0.76프랑 반영' }),
        csFx.cdsMove({ to: 250, reason: '합병 발표 후 CDS 급락' }),
        confidence(8, '합병 발표 후 시장 안정'),
        op('market.equityIndex', 'mul', 1.005, '유럽 은행 주가지수 소폭 반등'),
      ],
    },
    {
      id: 't5-resolution-draw',
      when: { flag: 'route_resolution' },
      description: '정리 실행 후 유동성 약정을 인출 — ELA+ 300억 + PLB 700억',
      effects: [
        csFx.provideLiquidity({ amount: 30, facility: 'elaPlus', label: 'ELA+ 300억 추가 인출' }),
        csFx.provideLiquidity({ amount: 70, facility: 'plb', label: 'PLB 700억 인출' }),
        csFx.runoffStep({ total: 4, profile: [1], label: '3/20 고객자금 유출' }),
        csFx.equityMove({ pct: -0.99, reason: '주식 전액 상각' }),
        csFx.cdsMove({ to: 420, reason: '정리 실행 — 베일인 후 재출발' }),
        confidence(3, '정리 실행 — 서열은 지켜졌으나 전례가 없다'),
        op('market.equityIndex', 'mul', 0.98, '유럽 은행 주가지수 약세'),
      ],
    },
    {
      id: 't5-nationalisation-draw',
      when: { flag: 'route_nationalisation' },
      description: '국유화 후 유동성 약정을 인출',
      effects: [
        csFx.provideLiquidity({ amount: 30, facility: 'elaPlus', label: 'ELA+ 300억 추가 인출' }),
        csFx.provideLiquidity({ amount: 70, facility: 'plb', label: 'PLB 700억 인출' }),
        csFx.runoffStep({ total: 3, profile: [1], label: '3/20 고객자금 유출' }),
        csFx.equityMove({ pct: -0.95, reason: '지분의 강제 이전' }),
        csFx.cdsMove({ to: 200, reason: '국가가 전 위험을 인수' }),
        confidence(5, '국유화 — 확실하지만 비싸다'),
      ],
    },
    {
      id: 't5-standalone-monday',
      when: { flag: 'route_standalone' },
      description: '구조 조치 없는 월요일 — 유출이 다시 커진다',
      effects: [
        csFx.runoffStep({ total: 28, profile: [1], label: '3/20 고객자금 유출' }),
        csFx.equityMove({ pct: -0.45, reason: '해법 부재' }),
        csFx.cdsMove({ to: 1600, reason: '해법 부재' }),
        confidence(-14, '주말에 아무것도 정해지지 않았다'),
        op('market.equityIndex', 'mul', 0.95, '유럽 은행 주가지수 급락'),
      ],
    },
    {
      id: 't5-no-route',
      when: { notFlag: 'route_committed' },
      description: '어떤 경로도 확정되지 않은 채 아시아가 열린다',
      effects: [
        csFx.runoffStep({ total: 35, profile: [1], label: '3/20 고객자금 유출' }),
        confidence(-20, '해법 부재'),
        csFx.cdsMove({ to: 2000, reason: '해법 부재' }),
      ],
    },
    {
      id: 't5-at1-shock',
      when: { all: [{ flag: 'at1_written_off' }, { notFlag: 'at1_basis_published' }] },
      description: '설명 없는 상각 — 유럽 AT1 시장 전체가 다시 가격을 매긴다',
      effects: [
        confidence(-5, 'AT1 서열 논란'),
        op('confidence.investors', 'add', -8, '유럽 AT1 시장 재가격'),
        op('market.creditSpreadIgBp', 'add', 6, 'AT1·후순위 스프레드 확대의 파급'),
      ],
    },
    {
      id: 't5-refresh',
      description: '지표 갱신',
      effects: [csFx.refresh('월요일 지표 갱신')],
    },
  ],
  events: [
    {
      id: 't5-news-eu',
      kind: 'regulator',
      agency: '유럽 정리·감독 당국 공동',
      time: '08:00',
      headline: '유럽 당국 "보통주가 먼저 손실을 흡수하고 그 다음이 AT1" — 서열 원칙 재확인',
      body: '유럽의 정리당국과 은행감독 당국이 공동성명을 내고, 자신들의 체계에서는 보통주가 가장 먼저 손실을 흡수하며 그것이 완전히 소진된 뒤에야 기타기본자본(AT1)의 상각이 요구된다는 점을 재확인했다. 이 접근은 과거 사례에서도 일관되게 적용되었고 앞으로의 위기 대응도 규율할 것이라고 밝혔다.',
      tone: 'concerned',
      severity: 'critical',
      sourceRefs: [S.eu320],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't5-news-swap',
      kind: 'newswire',
      outlet: '6개 중앙은행 공동 보도자료',
      time: '07:30',
      headline: '주요 중앙은행, 달러 스와프 라인 7일물 운영을 오늘부터 매일로 확대',
      body: '캐나다·영국·일본·유로존·미국·스위스의 중앙은행이 상설 미달러 스와프 라인의 7일물 운영 빈도를 주 1회에서 매일로 늘린다고 발표했다. 오늘부터 최소 4월 말까지 이어진다. 이 스와프망은 글로벌 자금조달 시장의 긴장을 완화하는 유동성 백스톱 역할을 한다.',
      severity: 'positive',
      sourceRefs: [S.swap],
    },
    {
      id: 't5-data-monday',
      kind: 'data',
      time: '09:00',
      title: '월요일 개장 (감독국 집계)',
      rows: [
        { label: 'SNB 지원 누계', value: '대시보드 참조' },
        { label: '연방 보증 노출', value: '대시보드 참조' },
        { label: 'AT1 상각액', value: '대시보드 참조' },
        { label: '주주 대가', value: '대시보드 참조' },
        { label: '유럽 은행 AT1 지수', value: '큰 폭 하락 — 조항 재해석' },
      ],
      severity: 'warning',
      sourceRefs: [S.finma, S.eu320],
      relatedMetrics: ['supportDrawn', 'federalGuarantee', 'at1WrittenOff'],
    },
    {
      id: 't5-memo-at1',
      kind: 'memo',
      time: '10:30',
      from: 'FINMA 법무실',
      to: '합동 정책담당',
      subject: 'AT1 상각에 관한 문의 — 이미 들어온 것들',
      body: `- 오늘 아침까지 들어온 문의는 세 종류입니다. ① 왜 주주가 대가를 받는데 AT1이 0인가 ② 상각의 법적 근거가 계약인가 명령인가 ③ 이것이 다른 관할의 AT1에도 적용되는 해석인가.
- ①은 상품의 조건과 거래 구조가 다르기 때문이라는 답이 가능합니다. 이 상품들은 특별한 정부 지원이 제공되면 전액 상각되도록 발행되어 있고, 합병의 대가는 사적 계약의 결과입니다.
- ②에 대해서는 저희가 **계약 조항과 긴급명령의 상각 명령 권한 두 가지를 모두** 근거로 삼았다는 점을 밝혀야 합니다.
- ③은 각 관할의 조건서가 다르다는 사실만 말할 수 있습니다. 그러나 시장은 이미 자기 조건서를 다시 읽고 있습니다.
- 보유자 측 대리인들이 행정소송 준비를 알려 왔습니다.`,
      severity: 'warning',
      sourceRefs: [S.finmaAt1, S.fsi21],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: 'AT1 서열 논란에 대한 대응',
      prompt: '오늘 무엇을 말하시겠습니까?',
      context:
        '유럽 당국이 아침에 서열 원칙을 재확인했습니다. 그 성명은 스위스를 지목하지 않았지만 모두가 무엇을 두고 한 말인지 압니다.',
      requiredConcepts: ['economic-vs-regulatory-capital', 'crisis-communication'],
      dimensions: ['communication', 'policy'],
      options: [
        {
          id: 't5-d1-explain-later',
          label: '이번 주 중에 법적 근거를 설명하는 자료를 낸다',
          description:
            '계약상 존립사유 조항과 긴급명령의 상각 명령 권한을 정리한 보도자료를 준비해 며칠 안에 낸다.',
          effects: [confidence(3, '법적 근거 설명 예고'), flag('at1_explained_late')],
          expert: {
            rating: 52,
            rationale:
              '내용은 옳다. 시점이 늦다. 설명이 나오기까지의 며칠 동안 시장은 스스로 설명을 만들고, 그 설명이 표준이 된다.',
            historicalNote:
              'FINMA는 2023년 3월 23일 상각의 법적 근거를 정리한 자료를 냈고, 영향을 받은 상품을 개별로 열거했다.',
            sourceRefs: [S.finmaAt1],
          },
          consequences: '자료 준비를 지시했습니다. 오늘은 아무 설명도 나가지 않습니다.',
          historical: true,
          feasibility: { basis: '보도자료는 며칠 안에 준비 가능', sourceRefs: [S.finmaAt1] },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't5-d1-explain-now',
          label: '오늘 아침 법적 근거와 예외성을 설명하고 유럽 당국과 공동으로 확인한다',
          description:
            '개장 전에 계약 조항과 명령 조문을 인용한 설명 자료를 내고, 유럽 당국과 함께 "이것이 일반적 서열의 변경이 아니다"라는 점을 확인한다.',
          effects: [
            confidence(8, '즉시 설명 + 국제 공동 확인'),
            op('confidence.investors', 'add', 10, '근거 즉시 공표'),
            flag('at1_explained_now'),
          ],
          expert: {
            rating: 88,
            rationale:
              '설명은 결과와 가까울수록 싸다. 국제결제은행 금융안정연구소의 사후 분석도 같은 결론에 이른다 — 문제는 상각 자체가 아니라 그것이 가능하다는 사실을 시장이 그 순간에야 알게 되었다는 점이며, 해법은 조건의 투명성이다.',
            sourceRefs: [S.fsi21, S.eu320, S.finmaAt1],
          },
          consequences:
            '개장 전에 설명이 나갔습니다. 유럽 당국의 성명과 문안이 맞물렸고, AT1 호가의 하락 폭이 제한되었습니다.',
          feasibility: {
            basis: '조항 인용과 근거 공표는 하룻밤에 준비 가능하며 공동 문안은 전날 조율되어 있다',
            sourceRefs: [S.finmaAt1, S.eu320],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't5-d1-silent',
          label: '개별 처분에 관해서는 논평하지 않는다',
          description: '행정소송이 예고된 사안이므로 법정에서 다투겠다고만 답한다.',
          effects: [
            confidence(-6, '설명 부재'),
            op('confidence.investors', 'add', -8, '당국의 침묵'),
          ],
          expert: {
            rating: 18,
            rationale:
              '소송 중 사안에 신중한 것은 이해할 수 있다. 그러나 공표된 처분의 근거를 설명하지 않으면, 그 처분이 무엇을 근거로 한 것인지가 시장에서 추측으로 정해진다.',
            sourceRefs: [S.finmaAt1, S.fsi21],
          },
          consequences: '논평을 거절했습니다. 오후에 유럽 AT1 지수가 추가로 내렸습니다.',
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 2 }],
        },
        {
          id: 't5-d1-reverse',
          label: '상각을 재검토할 수 있다고 시사한다',
          description: '시장을 달래기 위해 상각의 일부 철회 가능성을 언급한다.',
          effects: [
            confidence(-12, '확정된 처분의 번복 시사'),
            op('confidence.counterparties', 'add', -10, '자본 구조의 불확실성'),
            flag('writeoff_wobble'),
          ],
          expert: {
            rating: 5,
            rationale:
              '이미 발효한 처분과 그 위에 성립한 합병의 자본 구조를 동시에 흔든다. 인수자의 자본 계획이 무너지고, 상각을 전제로 계산된 대가도 다시 열린다. 시장이 얻는 것은 안심이 아니라 불확실성이다.',
            sourceRefs: [S.finmaAt1, S.finma],
          },
          consequences:
            '재검토 가능성이 언급되었습니다. 인수자 측이 즉시 "조건의 전제가 흔들린다"고 통보해 왔습니다.',
          trap: true,
          trapExplanation:
            '비판이 거셀 때 "재검토하겠다"는 말은 가장 싸게 시간을 버는 것처럼 보인다. 그러나 확정된 처분을 흔들면 그 위에 세운 것이 모두 함께 흔들린다.',
          remediationCard: 'crisis-communication',
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 3 }],
        },
      ],
    },
    {
      id: 't5-d2',
      title: '제도 개선 권고',
      prompt: '이번 주에 무엇을 착수하시겠습니까? (최대 2개)',
      context:
        '긴급명령으로 만든 수단은 명령이 실효하면 사라집니다. 이번에 쓴 것 중 무엇을 법으로 남길지가 다음 위기의 선택지를 정합니다.',
      select: { min: 1, max: 2 },
      exclusive: [
        ['t5-d2-none', 't5-d2-plb-law'],
        ['t5-d2-none', 't5-d2-at1-terms'],
        ['t5-d2-none', 't5-d2-supervision'],
      ],
      dimensions: ['policy', 'compliance'],
      options: [
        {
          id: 't5-d2-plb-law',
          label: '공적유동성백스톱을 법률로 상설화하는 작업에 착수한다',
          description:
            '긴급명령으로 만든 ELA+·PLB를 은행법 개정으로 상설화하는 협의 절차를 시작한다. 다음 위기에는 헌법상 긴급권한이 필요 없게 만든다.',
          effects: [flag('plb_permanent'), op('confidence.board', 'add', 8, '제도 정비 착수')],
          expert: {
            rating: 85,
            rationale:
              'FINMA 스스로 "3월 중순 시점에 대마불사 규제는 여전히 미완성이었고, 그래서 정리를 택했더라도 긴급법의 적용이 똑같이 필요했을 것"이라고 적었다. 다음 위기에 같은 헌법 조항을 다시 꺼내야 한다면 그 자체가 제도의 결함이다.',
            historicalNote: '연방평의회는 이 방향의 은행법 개정 협의 절차를 곧 시작했다.',
            sourceRefs: [S.finma, S.ord135],
          },
          consequences: '협의 절차 개시가 결정되었습니다.',
          historical: true,
          feasibility: {
            basis: '법 개정 협의 절차는 연방평의회 결정으로 개시 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't5-d2-at1-terms',
          label: 'AT1 상품 조건의 표준화와 공시 강화를 국제 논의에 제안한다',
          description:
            '상각의 방아쇠와 서열이 관할마다 다르다는 사실이 이번 주말에 드러났다. 조건서의 핵심 조항을 표준 서식으로 공시하게 하는 논의를 국제 기준 설정기구에 제안한다.',
          effects: [
            flag('at1_transparency_push'),
            op('confidence.investors', 'add', 10, 'AT1 조건 투명성 추진'),
            confidence(3, '국제 기준 논의 착수'),
          ],
          expert: {
            rating: 86,
            rationale:
              '국제결제은행 금융안정연구소의 권고와 정확히 같은 방향이다. 이번 사건의 손실은 상각이 일어났다는 사실이 아니라, 보통주가 남은 채로 상각될 수 있다는 사실을 시장이 그 순간에야 알게 되었다는 데서 나왔다. 그렇다면 답은 조항을 바꾸는 것이 아니라 조항을 먼저 읽히게 하는 것이다.',
            sourceRefs: [S.fsi21, S.eu320],
          },
          consequences: '제안서가 국제 기준 설정기구의 다음 회기 의제로 접수되었습니다.',
          feasibility: {
            basis: '기준 설정기구에 대한 의제 제안은 회원 당국의 권한',
            sourceRefs: [S.fsi21],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't5-d2-supervision',
          label: '감독 권한 강화와 절차 공개 확대를 추진한다',
          description:
            '고액 과징금 권한, 경영진 책임 제도, 감독 절차의 선택적 공개를 담은 감독법 개정을 추진한다.',
          effects: [
            flag('supervision_reform'),
            op('confidence.regulators', 'add', 8, '감독 권한 강화'),
            confidence(2, '감독 제도 개편 착수'),
          ],
          expert: {
            rating: 78,
            rationale:
              '이 은행은 여러 해 동안 감독당국의 수많은 개입에도 방향을 바꾸지 않았다. 감독이 집중적으로 이루어졌는데도 효과가 거의 없었다면 문제는 감독의 강도가 아니라 수단이다. 이후의 공식 검토들이 공통적으로 지적한 지점이다.',
            sourceRefs: [S.puk, S.finma],
          },
          consequences: '개정 방향이 정해졌습니다. 업계와 의회의 반발이 예상됩니다.',
          feasibility: { basis: '감독법 개정 추진은 연방평의회 결정 사항', sourceRefs: [S.puk] },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't5-d2-none',
          label: '제도 개편은 사후 검토가 끝난 뒤로 미룬다',
          description: '지금은 집행에 집중하고, 무엇을 바꿀지는 검토 보고서가 나온 뒤에 정한다.',
          effects: [confidence(-4, '제도 개편 보류')],
          expert: {
            rating: 25,
            rationale:
              '사후 검토를 기다리는 것 자체는 신중하다. 그러나 긴급명령으로 만든 수단은 명령이 실효하면 사라지고, 다음 위기에 다시 헌법 조항부터 꺼내야 한다. 이번에 쓴 것을 법으로 남기는 일은 검토를 기다릴 필요가 없다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences: '개편 논의는 보류되었습니다.',
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '대시보드의 "AT1 상각액"과 "주주 대가"를 나란히 보십시오. 시장이 오늘 아침에 본 것이 그 두 숫자입니다.',
    },
    {
      level: 2,
      decisionId: 't5-d1',
      text: '설명은 결과와 가까울수록 쌉니다. 며칠 뒤에 나오는 설명은 이미 만들어진 해석을 뒤집어야 합니다.',
    },
    {
      level: 3,
      decisionId: 't5-d2',
      text: '긴급명령으로 만든 수단은 명령이 실효하면 사라집니다. 이번에 쓴 것을 법으로 남길지가 다음 위기의 선택지를 정합니다.',
    },
  ],
  relatedCards: [
    'economic-vs-regulatory-capital',
    'crisis-communication',
    'fdic-resolution-weekend',
  ],
}

export const turnsB: T[] = [t3, t4, t5]
