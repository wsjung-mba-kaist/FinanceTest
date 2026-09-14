import type { CentralBankState, Interrupt, Turn } from '../../engine/types'
import { confidence, flag, op, regulator } from '../../engine/fx/common'
import { csFx } from './fx'

type T = Turn<CentralBankState>

/**
 * ── 이 파일의 대사에 관한 고지 ──
 * FINMA·스위스국립은행(SNB)·크레디트스위스·UBS·사우디국립부는 **실재하는 기관**이므로 합성 이름을 쓰지
 * 않는다. 그러나 **전화·회의·협상의 모든 대사는 공개 기록(FINMA 2023.12 보고서, 보도자료, 연방 관보,
 * 의회 조사위원회 보고서, 당시 보도)에 기초한 개연성 있는 재구성이며 녹취·속기록의 인용이 아니다.**
 * 화자는 직책으로만 표기한다. 논쟁 중인 쟁점(AT1 상각의 법적 근거 등)은 단정하지 않고 각 당사자의
 * 입장으로 귀속시킨다. calibration.md §9와 디브리핑 단순화 노트에 같은 고지를 둔다.
 */

/** 출처 id 축약 (sources.ts). 사후 출처(2023.12 이후)는 턴 텍스트에서 인용하지 않는다. */
export const S = {
  finma: 'finma-cs-report-2023',
  finma319: 'finma-pr-2023-03-19',
  finmaAt1: 'finma-pr-2023-03-23-at1',
  joint315: 'finma-snb-statement-2023-03-15',
  snb319: 'snb-pr-2023-03-19',
  snbFsr: 'snb-fsr-2023',
  ord135: 'plb-eo-2023-135',
  ord136: 'plb-eo-2023-136',
  council: 'federal-council-2023-03-19',
  ar2022: 'cs-ar-2022',
  q422: 'cs-4q22-earnings',
  cs316: 'cs-pr-2023-03-16',
  merger: 'ubs-cs-merger-2023-03-19',
  eu320: 'srb-eba-ecb-2023-03-20',
  swap: 'central-banks-swap-2023-03-19',
  fsi21: 'bis-fsi-briefs-21',
  puk: 'puk-cs-2024',
  bvger: 'bvger-at1-2025',
  finmaAppeal: 'finma-at1-appeal-2025',
  dbaa: 'fred-dbaa',
  dgs: 'fred-dgs',
  reuters315: 'press-snb-chairman-2023-03-15',
  share: 'press-cs-share-2023-03',
}

/** 3월 15일 일중 유출 배분 [STYLIZED] — 근거는 calibration.md §4. */
const T1_PROFILE = [0.18, 0.24, 0.22, 0.2, 0.16]
/** 3월 16일 일중 유출 배분 [STYLIZED]. */
const T2_PROFILE = [0.25, 0.22, 0.2, 0.18, 0.15]

// ---------------------------------------------------------------------------------------------
// T0 — 2023-03-14 (화) "연차보고서"
// ---------------------------------------------------------------------------------------------
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '2023년 3월 14일 (화) 08:00 CET',
  title: '프롤로그: 내부통제 중대 결함',
  time: '2023-03-14T08:00:00+01:00',
  entryEffects: [
    {
      id: 't0-market-anchor',
      description: '3월 14일 종가로 시장 앵커를 맞춘다 (Baa−10년 211bp, 미 국채 2년 4.20%)',
      effects: [
        op('market.creditSpreadIgBp', 'set', 211, '3/14 Baa 5.75% − 10년 3.64%'),
        op('market.govt2yBp', 'set', 420, '3/14 미 국채 2년 4.20%'),
        op('market.volIndex', 'set', 23.73, '3/14 VIX 종가'),
        csFx.equityMove({ pct: -0.02, reason: '연차보고서 공시일 약세' }),
        op('market.equityIndex', 'mul', 0.99, '유럽 은행 주가지수 −1%'),
        csFx.cdsMove({ to: 550, reason: '내부통제 중대 결함 공시' }),
      ],
    },
    {
      id: 't0-outflow',
      description: '3월 14일 고객자금 유출 27억 프랑',
      effects: [csFx.runoffStep({ total: 2.7, profile: [1], label: '3/14 고객자금 유출' })],
    },
    {
      id: 't0-annual-report',
      description: '연차보고서의 내부통제 중대 결함 공시 → 신뢰지수 −6',
      effects: [confidence(-6, '재무보고 내부통제 중대 결함 공시')],
    },
  ],
  events: [
    {
      id: 't0-news-us',
      kind: 'newswire',
      outlet: 'Reuters / Bloomberg',
      time: '07:30',
      headline: '미국에서 나흘 새 두 은행이 문을 닫다 — 실리콘밸리은행 3/10, 시그니처은행 3/12',
      body: '실리콘밸리은행은 3월 8일 채권 210억 달러를 18억 달러 손실로 매각하고 22.5억 달러 증자를 예고한 직후 인출이 폭증해 3월 10일 폐쇄되었다. 3월 12일에는 뉴욕주 금융서비스국이 시그니처은행을 폐쇄했다. 유럽 은행주가 이틀째 하락하고 있으며, 자본이 아니라 자금조달 구조가 시장의 질문이 되었다.',
      severity: 'warning',
      sourceRefs: [S.finma],
      cardRefs: ['bank-run-dynamics', 'uninsured-deposits-and-run-speed'],
    },
    {
      id: 't0-news-ar',
      kind: 'newswire',
      outlet: 'Credit Suisse 공시 / 복수 언론',
      time: '08:00',
      headline:
        '크레디트스위스 연차보고서 공시 — 재무보고 내부통제에 "중대 결함", 감사인의 내부통제 부적정 의견',
      body: '당초 3월 9일 예정이던 2022년 연차보고서가 3월 14일에 나왔다. 미국 증권거래위원회가 2019·2020년 현금흐름표에 관해 질의한 것이 지연 사유였다. 보고서는 2022년 12월 31일과 2021년 12월 31일 기준 재무보고 내부통제가 유효하지 않다고 결론지었고, 감사인은 내부통제에 대해 부적정 의견을 냈다. 자본비율(CET1 14.1%)과 유동성커버리지비율(144%)은 규제 요건을 충족한다.',
      severity: 'critical',
      sourceRefs: [S.ar2022, S.q422],
      relatedMetrics: ['csCet1Pct'],
    },
    {
      id: 't0-data-4q22',
      kind: 'data',
      time: '08:20',
      title: '크레디트스위스 — 2022년 4분기 (감독국 요약)',
      rows: [
        { label: '총자산 (2022-12-31)', value: '5,314억 프랑' },
        { label: 'CET1 비율', value: '14.1% — 요건 충족' },
        { label: '유동성커버리지비율 (3개월 평균)', value: '144% — 요건 충족' },
        { label: '4분기 고객예금 감소', value: '1,380억 프랑' },
        { label: '2022년 10월 예금유출', value: '약 920억 프랑 (LCR 모형 910억)' },
        { label: '2022년 순손실', value: '72.9억 프랑' },
        { label: 'AT1 명목 잔액', value: '약 160억 프랑' },
      ],
      severity: 'warning',
      sourceRefs: [S.q422, S.finma],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't0-memo-liquidity',
      kind: 'memo',
      time: '08:45',
      from: 'FINMA 은행감독국 · SNB 금융안정국',
      to: 'FINMA·SNB·연방재무부 합동 정책담당',
      subject: '크레디트스위스 일별 자금 유출 (3/13~3/14)',
      body: `- 3월 13일 16억 프랑, 오늘 3월 14일 27억 프랑. 아직 작습니다. 그러나 방향이 한쪽입니다.
- 2022년 4분기에 이미 예금 1,380억 프랑을 잃은 은행입니다. 정기예금의 51%가 한 분기에 빠져나갔고, 투자은행 부문은 예금의 81%를 잃었습니다.
- **지금 문제는 자본이 아닙니다.** CET1 14.1%, LCR 144%로 규제 요건을 모두 충족합니다. 문제는 신뢰이고, 신뢰는 규제비율로 방어되지 않습니다.
- 긴급유동성지원(ELA)은 **적격담보가 SNB 계좌에 미리 가 있어야** 당일에 나갑니다. 담보 실사와 이동에 하루가 걸립니다.
- 통상법에는 무담보 지원 창구가 없습니다. 담보가 떨어지면 그 뒤에는 아무것도 없습니다.`,
      severity: 'warning',
      sourceRefs: [S.finma, S.q422],
      cardRefs: ['contingency-funding-plan', 'hqla-and-haircuts'],
      relatedMetrics: ['csLiquidity', 'usableReserves', 'dailyOutflow'],
    },
    {
      id: 't0-memo-rrp',
      kind: 'memo',
      time: '09:30',
      from: 'FINMA 정리국',
      to: '합동 정책담당',
      subject: '정리계획(RRP) 실행 태세 — 서명 가능 상태까지 남은 것',
      body: `- 2022년 10월의 인출 사태 이후 저희는 단일진입점(SPE) 전략에 따른 정리계획을 갱신해 왔습니다. 정리명령·정리계획·정리인 선임 결정문의 초안이 있습니다.
- 정리를 명하면 세 묶음의 조치가 함께 나갑니다. ① 사업 재편 ② **자본조치 — 주식 전액 상각, AT1 전액 상각, 베일인 채권의 주식 전환, 합계 약 730억 프랑의 자본 증가** ③ 지배구조 조치 — 이사회 의장 교체, 정리인 선임, 주주권 일시 정지.
- **정리는 자본을 만들지만 유동성을 만들지는 못합니다.** 정리를 하더라도 SNB의 대규모 유동성 공급이 필요하고, 그 유동성은 현행법에 근거가 없습니다.
- 국제 인정 절차가 관건입니다. 위기관리그룹(CMG)의 외국 당국이 같은 시각에 같은 조치를 인정해야 합니다. 세계적 시스템 중요 은행의 정리는 **어디에서도 실행된 적이 없습니다.**`,
      severity: 'info',
      sourceRefs: [S.finma],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '09:00',
      headline: '개장 시세',
      items: [
        { label: 'SNB 정책금리', value: '1.00%', change: '2022-09 이후 동결' },
        { label: '미 국채 2년', value: '4.20%', change: '3/8 5.07%에서 급락' },
        { label: '투자등급 스프레드(Baa−10년)', value: '211bp', change: '+3bp' },
        { label: 'VIX', value: '23.7', change: '' },
        { label: 'CS 5년 CDS', value: '550bp', change: '+100bp' },
      ],
      sourceRefs: [S.dgs, S.dbaa],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '감독 대응 수위',
      prompt: '오늘 어느 수준까지 개입하시겠습니까?',
      context:
        '규제비율은 모두 충족합니다. 공개적으로 무슨 말을 하든 그 자체가 신호가 됩니다. 아무 말도 하지 않는 것 역시 신호입니다.',
      requiredConcepts: ['regulator-escalation-ladder', 'crisis-communication'],
      dimensions: ['compliance', 'communication'],
      options: [
        {
          id: 't0-d1-daily',
          label: '일일 유동성 보고를 의무화하고 공개 언급은 하지 않는다',
          description:
            '감독 강도만 올린다. 은행에 일중·일별 유동성 포지션을 매일 보고하도록 명하고, 시장에는 아무 말도 하지 않는다. 감독법상 즉시 가능한 조치다.',
          effects: [
            regulator({ set: 2 }, '일일 유동성 보고 명령'),
            confidence(-2, '당국의 침묵 — 시장이 공백을 추측으로 채운다'),
            flag('daily_reporting'),
          ],
          expert: {
            rating: 55,
            rationale:
              '감독으로서는 정상적이고 필요한 조치다. 다만 이 국면에서 당국의 침묵은 중립이 아니다 — 미국에서 두 은행이 문을 닫은 주에 감독당국이 아무 말도 하지 않으면 시장은 최악을 가정한다.',
            historicalNote:
              'FINMA는 여러 달 전부터 CS를 집중 감시하고 있었고 공개 언급은 3월 15일 저녁 공동성명이 처음이었다.',
            sourceRefs: [S.finma],
          },
          consequences:
            '일일 보고 명령이 나갔습니다. 은행은 오늘 저녁부터 일중 포지션을 보고합니다. 시장에는 아무 발표도 없었습니다.',
          historical: true,
          feasibility: {
            basis: '금융시장감독법상 보고 요구는 감독처분으로 당일 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
        },
        {
          id: 't0-d1-prepare',
          label: '일일 보고에 더해 정리·매각·긴급명령 준비를 동시에 지시',
          description:
            '보고 명령과 함께 세 가지를 오늘 안에 착수한다. 정리계획 결정문을 서명 가능 상태로 갱신, 인수 후보 은행과의 비밀유지계약 체결, 연방재무부에 긴급명령 초안 작성 요청. 모두 비공개로 가능하다.',
          effects: [
            regulator({ set: 2 }, '일일 보고 + 정리·매각·긴급명령 병행 준비'),
            flag('daily_reporting'),
            flag('prep_early'),
            confidence(-1, '당국의 침묵(준비는 비공개)'),
          ],
          expert: {
            rating: 88,
            rationale:
              '주말에 쓸 수 있는 선택지는 그 전에 만들어 두어야 한다. FINMA는 2022년 10월 인출 사태 이후 실제로 가상 데이터룸과 스트레스 하의 매각 절차를 준비시켰고, 정리 결정문은 3월 19일에 서명 가능한 상태였다. 하루 먼저 시작하면 주말의 협상력이 달라진다. 긴급명령 초안은 3월 16일 밤에 실제로 필요해진다.',
            sourceRefs: [S.finma, S.ord135],
          },
          consequences:
            '세 가지 준비가 동시에 시작되었습니다. 정리국은 결정문 갱신에, 재무부는 명령 초안에 착수했고, 인수 후보 은행 두 곳과 비밀유지계약을 맺었습니다. 어느 것도 외부에 알려지지 않았습니다.',
          calibrationNote:
            '준비 플래그는 T3 주말 트랙과 T4 협상의 선택지를 연다 (calibration.md §6)',
          feasibility: {
            basis: '정리계획 갱신·비밀유지계약·명령 초안은 모두 비공개 행정행위로 당일 착수 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'regulatorLevel', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't0-d1-statement',
          label: '자본·유동성 요건 충족을 확인하는 공개 성명을 오늘 낸다',
          description:
            '감독당국이 먼저 나서서 CET1 14.1%·LCR 144%를 확인한다. 사실이며 검증 가능하다. 다만 지원 의사는 언급하지 않는다.',
          effects: [
            regulator({ set: 2 }, '공개 성명 + 감시 강화'),
            confidence(3, '검증 가능한 수치 공표'),
            flag('early_statement'),
          ],
          expert: {
            rating: 45,
            rationale:
              '검증 가능한 수치를 내놓는 것 자체는 옳다. 그러나 유동성 지원 의사 없이 건전성만 확인하는 성명은 하루 만에 소진된다 — 3월 15일 저녁의 공동성명이 "요건 충족"과 "필요 시 유동성 공급"을 함께 담고도 다음 날 유출을 막지 못한 것이 그 증거다. 게다가 감독당국이 먼저 말을 꺼내면 "왜 지금 말하는가"라는 질문이 따라온다.',
            sourceRefs: [S.joint315, S.finma],
          },
          consequences:
            '성명이 오후에 나갔습니다. 주가는 잠시 되돌렸고, 기자단의 첫 질문은 "무엇이 있길래 오늘 말하는가"였습니다.',
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't0-d1-none',
          label: '추가 조치 없이 통상 감시를 유지',
          description: '규제 요건을 모두 충족하는 은행이다. 시장이 스스로 정리하도록 둔다.',
          effects: [
            confidence(-8, '감독 부재 인식'),
            csFx.adjustDrain({ factor: 1.15, reason: '감독 공백' }),
          ],
          expert: {
            rating: 8,
            rationale:
              '요건 충족은 런을 막지 못한다. 2022년 10월 CS의 실제 유출 920억 프랑은 LCR 모형이 상정한 910억과 거의 같았다 — 규제 최저기준을 이미 하루 이틀에 소진하는 은행이었다는 뜻이다. 감독 부재는 다음 날의 유출률을 직접 키운다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '아무 조치도 취하지 않았습니다. 저녁에 은행의 자금부서가 SNB에 담보 여력을 문의했다는 보고가 들어왔습니다.',
          trap: true,
          trapExplanation:
            '"규제비율을 다 지키는 은행에 감독당국이 왜 개입하는가"는 평시의 올바른 질문이다. 그러나 런은 비율로 오지 않는다. 이 옵션이 매력적인 이유는 개입 자체가 낙인이 될 수 있기 때문이며, 틀린 이유는 이 은행이 이미 넉 달 전에 규제 모형이 상정한 30일치 유출을 한 달에 겪었기 때문이다.',
          remediationCard: 'regulator-escalation-ladder',
          preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 2 }],
        },
      ],
    },
    {
      id: 't0-d2',
      title: '적격담보 태세',
      prompt: '긴급유동성지원(ELA)의 담보를 지금 어떻게 다루시겠습니까?',
      context:
        'ELA는 담보 없이 나가지 않습니다. 담보 목록만 받아 두는 것과 담보를 실제로 SNB 계좌에 옮겨 두는 것은 하루 차이이고, 그 하루가 목요일의 공여 규모를 정합니다.',
      requiredConcepts: ['hqla-and-haircuts', 'contingency-funding-plan'],
      dimensions: ['liquidity', 'timeliness'],
      options: [
        {
          id: 't0-d2-list',
          label: '담보 목록과 평가자료만 제출받는다',
          description:
            '관행대로 담보 목록·평가·헤어컷 산정 자료를 받아 검토한다. 실제 이전은 필요해질 때 한다.',
          effects: [flag('collateral_listed')],
          expert: {
            rating: 45,
            rationale:
              '평시의 정상 절차다. 그러나 목록은 담보가 아니다 — 이전·등록·평가가 끝나야 돈이 나간다. 2023년 3월의 교훈 중 운영상 가장 반복되는 것이 이것이다.',
            historicalNote:
              '3월 16일에 실제로 나간 480억 프랑은 이미 적격담보로 뒷받침되던 부분이다.',
            sourceRefs: [S.finma],
          },
          consequences: '담보 목록이 접수되었습니다. 평가에 하루가 더 필요합니다.',
          historical: true,
          feasibility: { basis: 'SNB의 통상 ELA 담보 절차', sourceRefs: [S.finma] },
          preview: [{ metric: 'usableReserves', direction: 'flat', magnitude: 1 }],
        },
        {
          id: 't0-d2-preposition',
          label: '적격담보를 오늘 중 SNB 계좌로 사전 배치하도록 명한다',
          description:
            '스위스 국채·모기지 채권·대출채권 풀을 오늘 안에 SNB 계좌로 옮기고 등록까지 마치도록 명한다. 감독처분으로 가능하며, 비공개로 처리된다. 공여 여력이 150억 프랑 늘어난다.',
          effects: [
            csFx.prePositionCollateral({ amount: 15, label: '적격담보 사전 배치 +150억' }),
            flag('collateral_prepositioned'),
          ],
          expert: {
            rating: 85,
            rationale:
              '사전 배치된 담보만이 당일 자금이 된다. 바젤 유동성 원칙 11과 위기자금조달계획(CFP)의 표준 요구이며, 3월 17일 정오에 200억 프랑이 필요해졌을 때 그 돈이 통상 창구에서 나올 수 있었는지가 바로 이 결정에 달려 있다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '담보 이전이 오늘 밤 마감 전에 완료되었습니다. 즉시 공여 여력이 650억 프랑으로 늘었습니다. 시장은 모릅니다.',
          calibrationNote: 'usable 50 → 65 [CAL, calibration.md §3]',
          feasibility: {
            basis: '담보 이전·등록은 감독처분으로 당일 지시 가능(결제 마감 전)',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'usableReserves', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't0-d2-none',
          label: '담보 문제는 은행의 자금부서에 맡긴다',
          description: '감독당국이 담보 운영까지 지시하지는 않는다.',
          effects: [
            csFx.prePositionCollateral({ amount: -10, label: '담보 준비 지연 −100억' }),
            flag('collateral_neglected'),
          ],
          expert: {
            rating: 15,
            rationale:
              '담보 준비는 은행의 일이지만, 최종대부자의 여력은 감독당국이 미리 알아야 하는 숫자다. 준비를 방치하면 정작 필요한 날 공여 가능액이 모자란다 — 그날의 부족분이 곧 정리 개시 사유가 된다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '담보 관련 지시는 내리지 않았습니다. SNB 결제국은 "지금 상태로는 즉시 공여 가능액을 400억 프랑 정도로 본다"고 보고했습니다.',
          preview: [{ metric: 'usableReserves', direction: 'down', magnitude: 2 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't0-d1',
      text: '대시보드의 "SNB 즉시 공여 여력"을 보십시오. 이 숫자가 목요일에 내줄 수 있는 돈의 상한입니다.',
    },
    {
      level: 2,
      decisionId: 't0-d2',
      text: '최종대부자의 실효 여력 = 사전 배치된 적격담보 × (1 − 헤어컷). 목록은 담보가 아닙니다.',
    },
    {
      level: 3,
      decisionId: 't0-d1',
      text: '주말에 쓸 선택지는 화요일에 만들어야 합니다. 준비는 비공개이고 비용이 거의 없으며, 이후 모든 턴의 선택지를 살립니다.',
    },
  ],
  relatedCards: ['bank-run-dynamics', 'contingency-funding-plan', 'fdic-resolution-weekend'],
}

// ---------------------------------------------------------------------------------------------
// T1 — 2023-03-15 (수) "최대주주의 한 문장" — 틱 5
// ---------------------------------------------------------------------------------------------

/**
 * AT1 보유 기관투자자의 전화. 3월 15일 오전 AT1 일부가 액면의 23%에 거래되었다는 것은 FINMA 보고서로
 * 확인되는 사실이며, 이 통화 자체는 재구성이다.
 */
const t1At1Call: Interrupt<CentralBankState> = {
  id: 't1-i1-at1',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't1-i1-noComment',
  scoreWeight: 0.5,
  required: false,
  title: 'AT1 보유 기관투자자 통화',
  prompt: 'AT1 서열에 관한 당국의 입장을 지금 말해 줄 수 있는지 묻습니다. 어떻게 답하시겠습니까?',
  context:
    '유럽 대형 자산운용사의 채권 운용책임자입니다. 그쪽이 들고 있는 것은 크레디트스위스 AT1만이 아니라 유럽 은행 AT1 시장 전체입니다.',
  source: { kind: 'call', caller: '유럽 자산운용사 채권 운용책임자', tone: 'concerned' },
  lines: [
    {
      speaker: '채권 운용책임자',
      text: '오늘 아침 이 은행 AT1 일부가 액면의 23%에 거래됐습니다. 저희가 알고 싶은 건 가격이 아니라 순서입니다. 스위스에서는 주주보다 AT1이 먼저 없어질 수도 있습니까?',
    },
  ],
  dimensions: ['communication', 'policy'],
  cardRefs: ['economic-vs-regulatory-capital'],
  options: [
    {
      id: 't1-i1-contract',
      label: '계약 조항을 그대로 설명한다',
      description:
        '스위스 AT1은 계약상 존립사유(viability event) — 특히 특별한 정부 지원이 제공되는 경우 — 에 전액 상각되도록 발행되어 있다는 사실을 있는 그대로 말한다. 상각 여부를 시사하지는 않는다.',
      effects: [flag('at1_terms_disclosed'), confidence(1, '계약 조건의 사실 확인')],
      expert: {
        rating: 80,
        rationale:
          '조항은 공개된 발행조건이다. 감독당국이 이를 확인해 주는 것은 새로운 정보를 흘리는 것이 아니라 이미 있는 정보를 정확하게 만드는 일이며, 나중에 상각이 실제로 일어났을 때 "예고 없이 서열이 뒤집혔다"는 반응을 줄인다.',
        sourceRefs: [S.finmaAt1, S.fsi21],
      },
      consequences:
        '조항을 그대로 읽어 주었습니다. 상대는 "그러면 유럽 발행물과 조건이 다르다는 뜻이군요"라고 확인하고 전화를 끊었습니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
    },
    {
      id: 't1-i1-hierarchy',
      label: '"주주가 먼저"라는 일반 원칙만 확인한다',
      description:
        '유럽 정리체계의 일반 서열(보통주가 먼저 손실을 흡수하고 그 다음이 AT1)을 확인해 준다. 스위스 발행조건의 차이는 언급하지 않는다.',
      effects: [flag('hierarchy_promised'), confidence(2, '원칙 확인')],
      expert: {
        rating: 20,
        rationale:
          '지금은 안심시키지만 나흘 뒤에 정확히 뒤집힌다. 감독당국이 확인해 준 원칙이 자신의 처분으로 깨지면, 그 뒤의 어떤 설명도 사후 변명으로 읽힌다. 실제로 스위스 발표 다음 날 유럽 감독·정리 당국이 서열을 재확인하는 공동성명을 내야 했다.',
        sourceRefs: [S.eu320, S.fsi21],
      },
      consequences:
        '"보통주가 먼저"라고 답했습니다. 상대는 안도했고, 그 통화 내용은 오후에 데스크들 사이에 돌았습니다.',
      trap: true,
      trapExplanation:
        '일반 원칙을 말하는 것은 안전해 보인다. 그러나 스위스 AT1의 계약 조항은 그 원칙과 다르게 쓰여 있고, 당국은 그 사실을 알고 있다. 알면서 일반론으로 답하는 것은 나흘 뒤에 신뢰를 두 번 잃는 선택이다.',
      remediationCard: 'economic-vs-regulatory-capital',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1, note: '지금만' }],
    },
    {
      id: 't1-i1-noComment',
      label: '개별 기관에 관해서는 언급하지 않는다',
      description: '감독당국의 통상 답변. 개별 금융기관의 사안은 논평하지 않는다.',
      effects: [confidence(-1, '정보 공백')],
      expert: {
        rating: 40,
        rationale:
          '위법도 부정확도 아니며 감독당국의 표준 답변이다. 다만 공백은 그대로 남고, 상대는 발행조건을 스스로 읽은 뒤 최악을 가정한다.',
        sourceRefs: [S.finma],
      },
      consequences: '논평을 거절했습니다. 상대는 "그럼 조건서를 직접 읽겠습니다"라고 답했습니다.',
      historical: true,
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
    },
  ],
}

export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '2023년 3월 15일 (수) 09:00 CET',
  title: '최대주주의 한 문장',
  time: '2023-03-15T09:00:00+01:00',
  ticks: 5,
  tickLabels: ['09:00', '11:00', '13:30', '15:30', '17:30'],
  entryEffects: [
    {
      id: 't1-shareholder',
      description:
        '최대주주가 규제상의 이유로 추가 출자가 불가능하다고 밝힌다 → 신뢰지수 −10, 투자자 신뢰 급락',
      effects: [
        confidence(-10, '최대주주의 추가 출자 거부'),
        op('confidence.investors', 'add', -12, '자본 조달 경로가 닫힘'),
      ],
    },
  ],
  eachTick: [
    {
      id: 't1-outflow-tick',
      description: '3월 15일 고객자금 유출 132억 프랑을 일중 배분',
      effects: [csFx.runoffStep({ total: 13.2, profile: T1_PROFILE, label: '3/15 고객자금 유출' })],
    },
  ],
  tickEffects: [
    {
      id: 't1-collateral-calls',
      atTick: 3,
      description: '거래상대방의 추가 담보 요구 30억 프랑',
      effects: [csFx.pressureDrain({ amount: 3, reason: '거래상대방 추가 담보 요구' })],
    },
  ],
  ticker: {
    series: [
      // 3/14 종가 대비 −24%대. 3/13 종가 = 100 기준으로는 74.3까지 내려온다 [press-cs-share-2023-03]
      { path: 'market.ownStock', mode: 'relative', values: [100, 92, 86, 80, 75.8] },
      // CDS는 이날 1,000bp를 넘었다 [finma-cs-report-2023]
      { path: 'market.ownCdsBp', mode: 'absolute', values: [550, 700, 850, 980, 1010] },
      // 지표·체크포인트용 사본. 표시 경로와 같은 값을 갖는다 (calibration.md §5)
      { path: 'institution.custom.csCdsBp', mode: 'absolute', values: [550, 700, 850, 980, 1010] },
      // 유럽 은행 주가지수 [STYLIZED]
      { path: 'market.equityIndex', mode: 'relative', values: [100, 98.5, 97.6, 96.7, 96.0] },
      // Baa − 10년 국채: 3/14 211bp → 3/15 222bp [fred-dbaa, fred-dgs]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [211, 214, 217, 220, 222] },
    ],
  },
  interrupts: [t1At1Call],
  events: [
    {
      id: 't1-news-shareholder',
      kind: 'newswire',
      outlet: 'Reuters',
      atTick: 1,
      time: '10:40',
      headline: '최대주주 "규제상의 이유로 추가 출자는 없다" — 크레디트스위스 주가 급락',
      body: '지난해 증자에 참여해 최대주주가 된 기관의 회장이 인터뷰에서 추가 출자 가능성을 부정했다. 지분율을 더 높이면 다른 규제 체계가 적용된다는 이유였다. 시장은 이 문장을 "자본 조달 경로가 닫혔다"로 읽었고, 주가는 사상 최저치를 다시 경신했다.',
      severity: 'critical',
      sourceRefs: [S.reuters315, S.finma],
      relatedMetrics: ['ownStock', 'csCdsBp'],
    },
    {
      id: 't1-data-at1',
      kind: 'data',
      atTick: 2,
      time: '13:00',
      title: '장중 호가 (감독국 집계)',
      rows: [
        { label: 'CS 주가', value: '사상 최저 — 장중 −30%대' },
        { label: 'CS 5년 CDS', value: '1,000bp 돌파' },
        { label: 'AT1 일부 종목', value: '액면의 23%' },
        { label: '오늘 누적 유출(13:30 현재)', value: '대시보드 참조' },
      ],
      severity: 'critical',
      sourceRefs: [S.finma],
      cardRefs: ['economic-vs-regulatory-capital'],
      relatedMetrics: ['csCdsBp', 'ownStock'],
    },
    {
      id: 't1-call-cs',
      kind: 'call',
      atTick: 3,
      time: '15:40',
      caller: '크레디트스위스 최고재무책임자',
      callee: 'FINMA 은행감독국장',
      tone: 'urgent',
      lines: [
        {
          speaker: '최고재무책임자',
          text: '오늘만 100억 프랑을 넘겼습니다. 거래상대방들이 담보를 더 요구하고 한도를 줄이고 있습니다. 저희가 규제 요건을 충족한다는 사실을 당국이 확인해 주실 수 있습니까.',
        },
        {
          speaker: 'FINMA 은행감독국장',
          text: '수치는 저희가 매일 받고 있습니다. 확인해 드릴 수 있는 것과 약속할 수 있는 것은 다릅니다. 오늘 저녁까지 답을 드리겠습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.finma, S.joint315],
    },
    {
      id: 't1-memo-ela',
      kind: 'memo',
      atTick: 3,
      time: '16:10',
      from: 'SNB 금융안정국',
      to: '합동 정책담당',
      subject: '통상 창구로 내줄 수 있는 금액',
      body: `- 현재 적격담보로 뒷받침되는 즉시 공여 여력은 대시보드의 "SNB 즉시 공여 여력"입니다.
- 통상법상 창구는 긴급유동성지원(ELA)과 유동성부족자금조달창구(LSFF)뿐이고 **둘 다 담보가 있어야 합니다.**
- 담보가 떨어진 뒤에 쓸 수 있는 수단은 현행법에 없습니다. 무담보 지원이나 정부 보증부 대출을 하려면 **연방평의회의 긴급명령이 필요합니다.** 헌법 제184조 제3항과 제185조 제3항이 근거가 될 수 있습니다.
- 초안 작성에 하룻밤이 걸립니다. 지금 착수하면 내일 발효가 가능합니다.`,
      severity: 'warning',
      sourceRefs: [S.ord135, S.finma],
      cardRefs: ['discount-window-fhlb-btfp'],
      relatedMetrics: ['usableReserves'],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '오늘 저녁의 공동성명',
      prompt: 'FINMA와 SNB가 오늘 저녁 무엇을 발표하시겠습니까?',
      context:
        '장이 닫혔고 아시아가 열리기까지 몇 시간 남았습니다. 무엇을 말하든 내일 아침의 출발점이 됩니다.',
      availableFrom: 3,
      deadlineTick: 3,
      defaultOptionId: 't1-d1-joint',
      requiredConcepts: ['crisis-communication'],
      dimensions: ['communication', 'policy'],
      options: [
        {
          id: 't1-d1-joint',
          label: '요건 충족 확인 + 필요 시 유동성 공급 의사를 함께 발표',
          description:
            'FINMA는 확보된 주요 수치를 근거로 CS가 시스템적 중요 은행에 부과된 특별 자본·유동성 요건을 충족한다고 확인하고, SNB는 필요 시 유동성을 공급하겠다고 밝힌다. 금액과 조건은 말하지 않는다.',
          effects: [confidence(6, 'FINMA·SNB 공동성명'), flag('joint_statement')],
          expert: {
            rating: 62,
            rationale:
              '두 축(건전성 확인 + 최종대부자 의사)을 같은 문장에 담은 점은 정석이다. 그러나 금액도 조건도 없는 지원 의사는 하루를 벌 뿐이었다 — 다음 날 유출은 오히려 171억 프랑으로 커졌다.',
            historicalNote:
              '실제 3월 15일 저녁 공동성명. 미국 은행권 혼란이 스위스 기관에 직접적 전염 위험을 주지 않는다는 판단도 함께 담겼다.',
            sourceRefs: [S.joint315, S.finma],
          },
          consequences:
            '공동성명이 저녁에 나갔습니다. 아시아 개장에서 주가는 일부 되돌렸습니다. 은행은 밤사이 이 창구를 쓰겠다고 통보해 왔습니다.',
          historical: true,
          feasibility: {
            basis: 'FINMA·SNB 공동 보도자료는 당일 발표 가능',
            sourceRefs: [S.joint315],
          },
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't1-d1-numbers',
          label: '같은 성명에 공급 규모와 담보 조건을 수치로 명시',
          description:
            '"필요 시"가 아니라 "얼마까지, 어떤 담보로"를 밝힌다. 즉시 공여 가능액과 적격담보 범위를 숫자로 공표하고, 은행에는 그 조건의 이행을 요구한다. 사실인 숫자만 말한다.',
          effects: [
            confidence(9, '검증 가능한 수치를 동반한 공동성명'),
            csFx.adjustDrain({ factor: 0.85, reason: '검증 가능한 지원 규모 공표' }),
            flag('joint_statement'),
            flag('statement_with_numbers'),
          ],
          expert: {
            rating: 84,
            rationale:
              '검증 가능한 수치를 동반한 공표만이 완화로 작동한다는 것이 2023년 3월의 반복된 교훈이다. 수치 없는 "필요 시 지원"은 시장이 상한을 스스로 추정하게 만들고, 그 추정치는 거의 항상 실제보다 작다. 다만 낙인 위험은 커진다 — 그래서 조건을 함께 붙여야 한다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '성명에 금액과 담보 조건이 들어갔습니다. 한 기자가 "그 금액이 상한이냐"고 물었고, 답변은 "적격담보가 있는 한 상한이 아니다"였습니다.',
          calibrationNote: '검증 가능 수치 공표 → 유출 계수 ×0.85 [CAL, calibration.md §6]',
          feasibility: {
            basis: '공여 가능액은 담보 실사 결과로 당일 산출 가능',
            sourceRefs: [S.finma],
          },
          preview: [
            { metric: 'confidence', direction: 'up', magnitude: 3 },
            { metric: 'dailyOutflow', direction: 'down', magnitude: 1, note: '내일부터' },
          ],
        },
        {
          id: 't1-d1-prudential',
          label: '건전성 확인만 발표하고 유동성 지원은 언급하지 않는다',
          description:
            '요건 충족 사실만 확인한다. 최종대부자 의사를 밝히면 그 자체가 낙인이 된다고 본다.',
          effects: [confidence(2, '건전성 확인만')],
          expert: {
            rating: 35,
            rationale:
              '낙인 우려는 실재한다. 그러나 이미 CDS가 1,000bp를 넘고 AT1이 액면의 23%에 거래되는 은행에 대해 "건전하다"고만 말하면, 시장은 그 문장이 유동성에 대해 침묵한다는 사실을 읽는다.',
            sourceRefs: [S.finma, S.joint315],
          },
          consequences:
            '건전성 확인만 나갔습니다. 통신사의 첫 해설 문장은 "유동성에 관해서는 아무 말도 없었다"였습니다.',
          preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't1-d1-silent',
          label: '공개 발표 없이 은행과 비공개로만 소통',
          description: '발표 자체가 사태를 확인해 준다고 보고, 비공개 채널만 유지한다.',
          effects: [
            confidence(-8, '정보 공백'),
            csFx.adjustDrain({ factor: 1.25, reason: '당국의 침묵' }),
          ],
          expert: {
            rating: 12,
            rationale:
              '오늘 오전 한 문장이 은행의 자본 조달 경로를 닫았다. 그 문장에 대해 당국이 아무 말도 하지 않으면 공백은 소문이 채운다. 정보 공백은 보정 규칙에서도 증폭 계수다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '발표하지 않았습니다. 밤사이 아시아에서 이 은행 채권의 호가가 사라졌다는 보고가 들어왔습니다.',
          trap: true,
          trapExplanation:
            '"발표가 곧 낙인"이라는 논리는 평시에는 맞다. 그러나 시장이 이미 상각을 가격에 반영하고 있을 때 침묵은 낙인을 피하는 것이 아니라 확인해 주는 것이다.',
          remediationCard: 'crisis-communication',
          preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 2 }],
        },
      ],
    },
    {
      id: 't1-d2',
      title: '일중 감시 강도',
      prompt: '내일을 대비해 오늘 무엇을 더 요구하시겠습니까?',
      context:
        '내일 아침이면 은행은 창구를 쓰겠다고 할 것입니다. 그때 필요한 것은 결심이 아니라 담보와 숫자입니다.',
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't1-d2-intraday',
      dimensions: ['liquidity', 'compliance'],
      options: [
        {
          id: 't1-d2-intraday',
          label: '일중 유동성 포지션을 시간 단위로 보고받는다',
          description:
            '일별 보고를 시간 단위로 올린다. 결제·청산 잔고와 코레스은행 라인의 변화를 실시간으로 본다.',
          effects: [regulator({ set: 3 }, '일중 감시 — 정리 준비 단계'), flag('intraday_watch')],
          expert: {
            rating: 60,
            rationale:
              '유출이 하루 단위가 아니라 시간 단위로 움직이는 국면에서 일별 보고는 이미 늦다. 다만 보고를 받는 것만으로 여력이 늘지는 않는다.',
            sourceRefs: [S.finma],
          },
          consequences: '시간 단위 보고가 오늘 저녁부터 시작됩니다.',
          historical: true,
          feasibility: { basis: '감독처분으로 즉시 가능', sourceRefs: [S.finma] },
          preview: [{ metric: 'regulatorLevel', direction: 'up', magnitude: 1 }],
        },
        {
          id: 't1-d2-collateral',
          label: '일중 보고 + 남은 적격담보를 오늘 밤 안에 전부 이전하게 한다',
          description:
            '시간 단위 보고에 더해, 아직 이전되지 않은 적격담보(스위스 국채·모기지 채권·대출채권 풀)를 오늘 밤 결제 마감 전까지 SNB 계좌로 옮기게 한다. 공여 여력이 120억 프랑 늘어난다.',
          effects: [
            regulator({ set: 3 }, '일중 감시 + 담보 전량 이전'),
            csFx.prePositionCollateral({ amount: 12, label: '잔여 적격담보 이전 +120억' }),
            flag('intraday_watch'),
            flag('collateral_prepositioned'),
          ],
          expert: {
            rating: 86,
            rationale:
              '내일 내줄 수 있는 금액은 오늘 밤 담보 이전이 끝난 만큼이다. 3월 17일 정오에 200억 프랑이 더 필요해졌을 때 통상 창구에 남은 담보가 있었는지가 이 사건의 분기점 중 하나였다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '담보 이전이 밤 사이 완료됩니다. 즉시 공여 여력이 늘었고, 이 사실은 공표되지 않습니다.',
          calibrationNote: 'usable +12 [CAL, calibration.md §3]',
          feasibility: {
            basis: '결제 마감 전 담보 이전은 당일 실행 가능',
            sourceRefs: [S.finma],
          },
          preview: [{ metric: 'usableReserves', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't1-d2-nothing',
          label: '현행 일일 보고를 유지한다',
          description: '추가 요구는 은행의 부담만 키운다고 본다.',
          effects: [confidence(-3, '감시 강도 미조정')],
          expert: {
            rating: 20,
            rationale:
              '오늘 하루에 132억 프랑이 빠진 은행에 대해 일별 보고를 유지하는 것은, 내일 무슨 일이 일어나는지를 모레 아는 것과 같다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences: '보고 주기는 그대로입니다.',
          preview: [{ metric: 'csLiquidity', direction: 'flat', magnitude: 1 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't1-d1',
      text: '오늘 유출이 어제의 5배입니다. 대시보드의 "CS 가용 유동성"이 내일 하루를 버틸 수 있는지 보십시오.',
    },
    {
      level: 2,
      decisionId: 't1-d1',
      text: '검증 가능한 수치를 동반한 공표만 완화로 작동합니다. 수치 없는 "필요 시 지원"은 시장이 상한을 스스로(대개 낮게) 추정하게 만듭니다.',
    },
    {
      level: 3,
      decisionId: 't1-d2',
      text: '내일 내줄 수 있는 금액 = 오늘 밤까지 SNB 계좌에 도착한 적격담보. 이 결정은 목요일의 공여 규모를 정합니다.',
    },
  ],
  relatedCards: ['crisis-communication', 'hqla-and-haircuts', 'economic-vs-regulatory-capital'],
}

// ---------------------------------------------------------------------------------------------
// T2 — 2023-03-16 (목) "500억 프랑" — 틱 5
// ---------------------------------------------------------------------------------------------

/** 유럽 감독·정리 당국의 조율 요청. 위기관리그룹(CMG) 협의는 기록이고, 대사는 재구성이다. */
const t2EuCall: Interrupt<CentralBankState> = {
  id: 't2-i1-eu',
  interrupt: true,
  atTick: 2,
  jitter: 1,
  timeoutSec: 45,
  defaultOptionId: 't2-i1-brief',
  scoreWeight: 0.5,
  required: false,
  title: '유럽 감독·정리 당국 조율 요청',
  prompt: '유럽 쪽이 조율의 수준을 묻습니다. 어디까지 함께 하시겠습니까?',
  context:
    '이 은행은 세계적 시스템 중요 은행입니다. 어떤 조치를 하든 유럽·영국·미국에서 같은 시각에 인정받아야 효력이 있습니다.',
  source: {
    kind: 'regulator',
    caller: '유럽 정리당국 의장',
    agency: 'Single Resolution Board · ECB Banking Supervision',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '유럽 정리당국 의장',
      text: '위기관리그룹 회선을 열어 두겠습니다. 스위스가 무엇을 하든 우리 관할에서 인정 절차가 필요합니다. 주말 전에 선택지를 공유해 주실 수 있습니까.',
    },
    {
      speaker: '유럽 감독당국 대표',
      text: '한 가지만 미리 말씀드립니다. 저희 체계에서는 보통주가 먼저 손실을 흡수하고 그 다음이 AT1입니다. 그 순서가 달라지면 저희 쪽 시장이 같이 흔들립니다.',
    },
  ],
  dimensions: ['policy', 'compliance'],
  cardRefs: ['fdic-resolution-weekend'],
  options: [
    {
      id: 't2-i1-full',
      label: '선택지 전부를 공유하고 공동 공표 문안까지 사전 조율한다',
      description:
        '합병·정리·국유화·파산 네 갈래와 각 갈래에서 AT1·주식이 어떻게 되는지를 위기관리그룹에 공유하고, 각국이 같은 시각에 낼 보도자료 문안을 미리 맞춘다.',
      effects: [
        flag('cmg_full_coordination'),
        op('confidence.regulators', 'add', 10, '국제 조율'),
        confidence(2, '국제 공조'),
      ],
      expert: {
        rating: 88,
        rationale:
          'FINMA 보고서 스스로 "정리 조치는 국제 파트너 당국과의 긴밀한 협력 속에서만 설계될 수 있다"고 적는다. 실제로 3월 19일 기자회견 뒤에야 외국 당국에 상세 설명이 이루어졌고, 다음 날 아침 유럽 당국은 서열을 재확인하는 별도 성명을 내야 했다. 그 성명이 사전에 조율되었다면 AT1 시장의 반응은 달랐을 것이다.',
        sourceRefs: [S.finma, S.eu320],
      },
      consequences:
        '네 갈래와 각 갈래의 자본구조 처리가 위기관리그룹에 공유되었습니다. 공동 문안 초안이 밤사이 회람됩니다.',
      preview: [{ metric: 'confidence', direction: 'up', magnitude: 1 }],
    },
    {
      id: 't2-i1-brief',
      label: '진행 상황만 통보하고 선택지는 공유하지 않는다',
      description: '위기관리그룹 회선은 유지하되, 검토 중인 선택지는 결정 전까지 공개하지 않는다.',
      effects: [op('confidence.regulators', 'add', 2, '통상 통보')],
      expert: {
        rating: 45,
        rationale:
          '누설 위험을 줄이는 정상적 판단이다. 다만 인정 절차는 준비 시간을 요구하고, 결정 후에 통보하면 각국은 자기 시장을 향해 각자 말하게 된다.',
        historicalNote:
          '위기관리그룹 구성원들은 3월 18일에 조치 내용을 통보받았고 공동 공표를 준비할 수 있었으나, AT1 서열에 관한 유럽 당국의 성명은 스위스 발표 다음 날 별도로 나왔다.',
        sourceRefs: [S.finma, S.eu320],
      },
      consequences:
        '진행 상황만 전달했습니다. 상대는 "선택지를 늦게 받을수록 인정이 늦어진다"고 답했습니다.',
      historical: true,
      preview: [{ metric: 'confidence', direction: 'flat', magnitude: 1 }],
    },
    {
      id: 't2-i1-none',
      label: '국내 사안이라며 조율을 미룬다',
      description: '스위스 법에 따른 처분이므로 외국 당국의 사전 관여는 필요하지 않다고 답한다.',
      effects: [
        op('confidence.regulators', 'add', -12, '국제 조율 거부'),
        confidence(-3, '국제 공조 실패'),
        flag('cmg_refused'),
      ],
      expert: {
        rating: 10,
        rationale:
          '세계적 시스템 중요 은행의 정리는 외국 관할에서 인정되지 않으면 집행되지 않는다. 조율을 미루는 것은 정리 선택지 자체를 스스로 지우는 일이다.',
        sourceRefs: [S.finma, S.eu320],
      },
      consequences:
        '조율을 미뤘습니다. 상대는 "그러면 저희는 저희 시장을 향해 따로 말하겠습니다"라고 답했습니다.',
      trap: true,
      trapExplanation:
        '주권 관할의 논리는 형식적으로 옳다. 그러나 이 은행의 자산과 계약은 여러 관할에 흩어져 있고, 정리는 인정받지 못하면 종이에 불과하다.',
      preview: [{ metric: 'confidence', direction: 'down', magnitude: 1 }],
    },
  ],
}

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '2023년 3월 16일 (목) 08:00 CET',
  title: '500억 프랑',
  time: '2023-03-16T08:00:00+01:00',
  ticks: 5,
  tickLabels: ['08:00', '10:00', '13:00', '15:00', '17:30'],
  entryEffects: [
    {
      id: 't2-cs-announcement',
      description: '은행이 밤사이 "최대 약 500억 프랑" 이용 의사를 공표 → 신뢰지수 +4',
      effects: [confidence(4, '유동성 창구 이용 공표'), flag('cs_announced_draw')],
    },
  ],
  eachTick: [
    {
      id: 't2-outflow-tick',
      description: '3월 16일 고객자금 유출 171억 프랑을 일중 배분',
      effects: [csFx.runoffStep({ total: 17.1, profile: T2_PROFILE, label: '3/16 고객자금 유출' })],
    },
  ],
  tickEffects: [
    {
      id: 't2-limits',
      atTick: 3,
      description: '거래상대방 한도 축소·추가 담보 요구 80억 프랑',
      effects: [csFx.pressureDrain({ amount: 8, reason: '한도 축소·추가 담보 요구' })],
    },
    {
      id: 't2-support-failed',
      atTick: 4,
      description: '지원 당일 유출이 오히려 커졌다는 사실이 마감 후 확인된다 → 신뢰지수 −8',
      effects: [confidence(-8, '지원에도 유출이 커짐')],
    },
  ],
  ticker: {
    series: [
      // 3/16 개장 +30%, 종가 +18.8% [press-cs-share-2023-03]
      { path: 'market.ownStock', mode: 'relative', values: [74.3, 86, 90, 89, 88.3] },
      { path: 'market.ownCdsBp', mode: 'absolute', values: [1010, 980, 950, 940, 950] },
      { path: 'institution.custom.csCdsBp', mode: 'absolute', values: [1010, 980, 950, 940, 950] },
      { path: 'market.equityIndex', mode: 'relative', values: [96.0, 97.0, 97.6, 97.9, 98.0] },
      // Baa − 10년 국채: 3/16 216bp [fred-dbaa, fred-dgs]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [222, 220, 218, 217, 216] },
    ],
  },
  interrupts: [t2EuCall],
  events: [
    {
      id: 't2-news-draw',
      kind: 'newswire',
      outlet: 'Credit Suisse 공시 / SEC Form 6-K',
      atTick: 0,
      time: '02:00',
      headline:
        '크레디트스위스, SNB 담보부대출창구와 단기 유동성창구에서 최대 약 500억 프랑 이용 의사',
      body: '은행은 밤사이 공시를 내고 담보부대출창구(Covered Loan Facility)와 단기 유동성창구를 합쳐 최대 약 500억 프랑까지 이용하겠다고 밝혔다. 동시에 미달러 선순위채 10종(최대 25억 달러)과 유로 선순위채 4종(최대 5억 유로)에 대한 현금 공개매수도 발표했다. 개장 직후 주가는 30% 넘게 올랐다.',
      severity: 'positive',
      sourceRefs: [S.cs316],
      relatedMetrics: ['ownStock'],
    },
    {
      id: 't2-memo-collateral',
      kind: 'memo',
      atTick: 0,
      time: '08:10',
      from: 'SNB 결제·담보국',
      to: '합동 정책담당',
      subject: '오늘 공여 가능액과 그 한계',
      body: `- 은행이 요청한 금액은 "최대 약 500억 프랑"입니다. 저희가 담보로 뒷받침할 수 있는 금액은 대시보드의 "SNB 즉시 공여 여력"입니다.
- 은행은 오늘 공식 확인서를 보냈습니다. 요지: **자금·자본시장에서든 다른 어떤 방법으로든 필요한 유동성을 조달할 수 없고, 현금 예금 인출에 직면해 있으며, 진행 중인 조달 시도로는 충분하지 않을 것으로 본다.**
- 이 확인서가 있으면 긴급유동성지원(ELA)의 요건은 충족됩니다. 문제는 **담보가 어디까지 버티느냐**입니다.
- 오늘 담보를 다 쓰면 내일은 통상법으로 내줄 수 있는 것이 없습니다.`,
      severity: 'critical',
      sourceRefs: [S.finma, S.snbFsr],
      cardRefs: ['hqla-and-haircuts', 'discount-window-fhlb-btfp'],
      relatedMetrics: ['usableReserves', 'csLiquidity'],
    },
    {
      id: 't2-memo-ordinance',
      kind: 'memo',
      atTick: 1,
      time: '10:30',
      from: '연방재무부 법무실',
      to: '합동 정책담당 · 연방평의회',
      subject: '긴급명령 초안 — 추가 유동성지원대출(ELA+)과 공적유동성백스톱(PLB)',
      body: `- 연방헌법 제184조 제3항·제185조 제3항에 근거한 긴급명령 초안이 준비되었습니다. 두 가지를 창설합니다.
  1. **ELA+** — 담보 요건을 완화한 추가 유동성지원대출. 파산 시 우선변제권이 붙습니다.
  2. **PLB** — SNB의 유동성지원대출에 대한 연방정부 이행보증. 같은 우선변제권이 붙습니다.
- 두 수단 모두 **차입자가 자체 조달 수단을 전부 소진한 뒤에야** 지급될 수 있고, FINMA가 그 사실을 연방재무부에 확인해야 합니다. PLB의 첫 지급에는 SNB가 "담보로 쓸 수 있는 것이 남아 있지 않고 ELA+도 소진되었다"고 확인해야 합니다.
- 명령은 연방평의회 의결로 즉시 발효할 수 있습니다. 의회 의결은 필요하지 않으나, 약정 신용은 사후에 **재정대표단(FinDel)**의 긴급 승인을 받아야 합니다.
- **정리를 택하더라도 이 명령은 필요합니다.** 정리는 자본을 만들지만 유동성을 만들지 못합니다.`,
      severity: 'critical',
      sourceRefs: [S.ord135, S.finma],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 't2-data-intraday',
      kind: 'data',
      atTick: 3,
      time: '15:20',
      title: '일중 유출 (시간 단위 보고)',
      rows: [
        { label: '어제(3/15) 하루', value: '132억 프랑' },
        { label: '오늘 15:00 현재', value: '이미 어제 수준을 넘었습니다' },
        { label: '스위스 법인(CS Schweiz)', value: '유출이 그룹보다 빠르게 진행 중' },
        { label: '코레스은행 한도', value: '복수 기관이 축소 통보' },
      ],
      severity: 'critical',
      sourceRefs: [S.finma],
      relatedMetrics: ['dailyOutflow', 'csLiquidity'],
    },
    {
      id: 't2-memo-close',
      kind: 'memo',
      atTick: 4,
      time: '18:30',
      from: 'FINMA 은행감독국',
      to: '합동 정책담당',
      subject: '오늘 마감 집계 — 지원이 유출을 멈추지 못했습니다',
      body: `- 오늘 하루 유출은 171억 프랑입니다. **480억 프랑을 공여한 바로 그날입니다.**
- 어제보다 큽니다. 주가는 올랐고 유출은 커졌습니다. 두 숫자가 다른 이야기를 하고 있습니다.
- 스위스 법인의 유출이 특히 빠릅니다. 그룹만이 아니라 스위스 법인 자체의 즉시 지급불능 가능성을 주말 안에 검토해야 합니다.
- 내일 아침 다시 요청이 올 것으로 봅니다. 통상 창구에 남은 담보로는 감당하기 어렵습니다.`,
      severity: 'critical',
      sourceRefs: [S.finma],
      relatedMetrics: ['dailyOutflow', 'csLiquidity', 'usableReserves'],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '유동성 지원의 조건과 규모',
      prompt: '오늘 얼마를, 어떤 조건으로, 어떻게 알리시겠습니까?',
      context:
        '은행은 "최대 약 500억"을 공표했습니다. 담보가 뒷받침하는 금액은 그보다 작을 수 있습니다. 공표하면 낙인이 되고, 공표하지 않으면 공백이 됩니다.',
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't2-d1-full',
      requiredConcepts: ['discount-window-fhlb-btfp', 'hqla-and-haircuts'],
      dimensions: ['liquidity', 'policy'],
      options: [
        {
          id: 't2-d1-full',
          label: 'ELA 380억 + LSFF 100억을 공여하고 은행의 공표를 확인한다',
          description:
            '담보가 뒷받침하는 최대치를 두 창구로 나누어 내준다. 은행의 "최대 약 500억" 공표는 부인하지도 정정하지도 않는다.',
          effects: [
            csFx.provideLiquidity({ amount: 38, facility: 'ela', label: 'ELA 380억 공여' }),
            csFx.provideLiquidity({ amount: 10, facility: 'lsff', label: 'LSFF 100억 공여' }),
            confidence(5, '대규모 유동성 지원 공여'),
            flag('support_48'),
          ],
          expert: {
            rating: 66,
            rationale:
              '담보로 뒷받침되는 최대치를 즉시 내주는 것은 최종대부자의 정석이다. 그리고 이 정석이 유출을 멈추지 못했다는 것이 이 시나리오의 중심 사실이다 — 같은 날 유출은 171억 프랑으로 오히려 커졌다. 유동성은 신뢰를 사지 못한다.',
            historicalNote:
              'SNB는 3월 16일 ELA 380억 프랑과 LSFF 100억 프랑, 합계 480억 프랑을 공여했다.',
            sourceRefs: [S.finma, S.snbFsr],
          },
          consequences:
            '480억 프랑이 나갔습니다. 개장 직후 주가는 30% 넘게 올랐고, 마감 집계에서 오늘 유출은 어제보다 컸습니다.',
          historical: true,
          calibrationNote: 'ELA 38 + LSFF 10 [finma-cs-report-2023]',
          feasibility: {
            basis: '적격담보와 은행의 자체조달 불가 확인서가 갖추어진 통상법상 창구',
            sourceRefs: [S.finma],
          },
          preview: [
            { metric: 'csLiquidity', direction: 'up', magnitude: 3 },
            { metric: 'usableReserves', direction: 'down', magnitude: 3 },
          ],
        },
        {
          id: 't2-d1-conditional',
          label: '같은 480억을 공여하되 조건을 붙이고 조건까지 공표한다',
          description:
            '금액은 같다. 대신 자산 감축 계획 제출, 배당·자사주·상여 지급 정지, 주말 매각·정리 절차에 대한 전면 협조를 공여 조건으로 붙이고, 금액과 조건을 함께 공표한다.',
          effects: [
            csFx.provideLiquidity({ amount: 38, facility: 'ela', label: 'ELA 380억 공여(조건부)' }),
            csFx.provideLiquidity({
              amount: 10,
              facility: 'lsff',
              label: 'LSFF 100억 공여(조건부)',
            }),
            confidence(7, '조건을 동반한 공여의 공표'),
            csFx.adjustDrain({ factor: 0.9, reason: '조건부 공여 — 낙인 완화' }),
            regulator({ set: 3 }, '공여 조건 부과'),
            flag('support_48'),
            flag('support_conditional'),
          ],
          expert: {
            rating: 86,
            rationale:
              '조건은 낙인을 만드는 것이 아니라 낙인을 관리한다. 조건 없는 공여는 "당국이 얼마나 겁먹었는가"로 읽히고, 조건부 공여는 "당국이 무엇을 통제하고 있는가"로 읽힌다. 게다가 조건이 주말 협조 의무를 미리 만들어 두므로 토요일의 협상 시간이 줄어든다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '480억과 조건이 함께 공표되었습니다. 은행 이사회는 배당·상여 정지에 동의했고, 주말 절차 협조 각서에 서명했습니다.',
          calibrationNote: '조건부 공여 → 유출 계수 ×0.90 [CAL, calibration.md §6]',
          feasibility: {
            basis: '금융시장감독법상 감독처분으로 공여에 조건을 붙일 수 있다',
            sourceRefs: [S.finma],
          },
          preview: [
            { metric: 'csLiquidity', direction: 'up', magnitude: 3 },
            { metric: 'dailyOutflow', direction: 'down', magnitude: 1 },
          ],
        },
        {
          id: 't2-d1-quiet',
          label: '480억을 비공개로 공여하고 은행의 공표를 정정하게 한다',
          description:
            '낙인을 피하기 위해 지원 사실을 공표하지 않고, 은행에도 규모를 밝히지 말라고 요구한다.',
          effects: [
            csFx.provideLiquidity({ amount: 38, facility: 'ela', label: 'ELA 380억 비공개 공여' }),
            csFx.provideLiquidity({
              amount: 10,
              facility: 'lsff',
              label: 'LSFF 100억 비공개 공여',
            }),
            confidence(-6, '지원 사실의 비공개 — 공표 번복'),
            csFx.adjustDrain({ factor: 1.3, reason: '공표 번복에 따른 불신' }),
            flag('support_48'),
            flag('support_undisclosed'),
          ],
          expert: {
            rating: 22,
            rationale:
              '은행이 이미 공표한 사실을 당국이 되돌리게 하면 시장은 두 개의 서로 다른 이야기를 듣는다. 보정 규칙에서 "공표 후 모순"은 완화가 아니라 증폭(×1.5)이다. 낙인은 피할 수 없고 신뢰만 잃는다.',
            sourceRefs: [S.finma, S.cs316],
          },
          consequences:
            '정정 공시가 나갔습니다. 한 시간 뒤 통신사 제목은 "스위스, 지원 규모 함구"였습니다.',
          trap: true,
          trapExplanation:
            '낙인을 피하려는 본능은 정당하다. 그러나 은행이 이미 금액을 말한 뒤에 당국이 침묵을 요구하면, 그것은 낙인을 지우는 것이 아니라 은폐로 보이게 만든다.',
          remediationCard: 'crisis-communication',
          preview: [{ metric: 'dailyOutflow', direction: 'up', magnitude: 2 }],
        },
        {
          id: 't2-d1-partial',
          label: '30억 프랑만 공여하고 민간 해법을 압박한다',
          description:
            '최소한만 내주어 시간을 벌고, 은행이 스스로 자본을 조달하거나 매각 협상을 서두르게 만든다.',
          effects: [
            csFx.provideLiquidity({ amount: 3, facility: 'ela', label: 'ELA 30억 공여' }),
            confidence(-10, '지원 규모가 요청에 크게 못 미침'),
            csFx.adjustDrain({ factor: 1.4, reason: '지원 부족이 드러남' }),
            flag('support_partial'),
          ],
          expert: {
            rating: 12,
            rationale:
              '부분 지원은 최악의 조합이다. 낙인은 전부 지고 방어는 하지 못한다. 요청액에 크게 못 미치는 공여는 "당국이 이 은행을 포기했다"는 신호로 읽혀 다음 날 유출을 키운다.',
            sourceRefs: [S.finma],
          },
          consequences: '30억이 나갔습니다. 오후에 복수의 코레스은행이 한도를 전면 축소했습니다.',
          preview: [
            { metric: 'csLiquidity', direction: 'up', magnitude: 1 },
            { metric: 'dailyOutflow', direction: 'up', magnitude: 3 },
          ],
        },
        {
          id: 't2-d1-refuse',
          label: '공여를 거부하고 즉시 정리 절차를 개시한다',
          description:
            '유동성 지원이 시간만 벌 뿐이라면 오늘 정리로 넘어간다. 다만 정리에도 유동성이 필요하고, 그 근거가 될 긴급명령은 아직 없다.',
          effects: [
            confidence(-18, '최종대부자 공여 거부'),
            csFx.adjustDrain({ factor: 1.6, reason: '지원 거부' }),
            regulator({ set: 4 }, '정리 절차 개시'),
            flag('support_refused'),
          ],
          expert: {
            rating: 8,
            rationale:
              '방향 자체는 이 사건의 가장 큰 논점(정리계획이 있었는데 쓰이지 않았다)을 정면으로 다룬다. 그러나 시점이 틀렸다. 국제 인정 절차와 긴급명령 없이 목요일에 정리를 개시하면 유동성이 먼저 끊어진다 — FINMA 스스로 "정리는 자본을 만들지만 유동성을 만들지 못한다"고 적었다.',
            sourceRefs: [S.finma],
          },
          consequences:
            '공여를 거부했습니다. 오후에 결제 대기열이 쌓이기 시작했고, 스위스 법인의 지급 가능 시간이 시간 단위로 계산되고 있습니다.',
          irreversible: true,
          preview: [{ metric: 'csLiquidity', direction: 'down', magnitude: 3 }],
        },
      ],
    },
    {
      id: 't2-d2',
      title: '긴급명령',
      prompt: '연방평의회가 오늘 밤 긴급명령을 제정하시겠습니까?',
      context:
        '통상법으로 내줄 수 있는 것은 담보가 있는 만큼입니다. 그 너머는 헌법 제184조·제185조의 긴급권한밖에 없습니다.',
      availableFrom: 1,
      deadlineTick: 3,
      defaultOptionId: 't2-d2-enact',
      requiredConcepts: ['fdic-resolution-weekend'],
      dimensions: ['policy', 'compliance', 'timeliness'],
      options: [
        {
          id: 't2-d2-enact',
          label: '긴급명령을 오늘 제정해 ELA+와 PLB를 창설한다',
          description:
            '연방헌법 제184조 제3항·제185조 제3항에 근거해 추가 유동성지원대출(ELA+)과 연방정부 이행보증부 대출(PLB)을 창설하고 두 수단에 파산 시 우선변제권을 붙인다. 각 1,000억 프랑까지 열린다.',
          effects: [
            csFx.enactOrdinance({ label: '긴급명령 제정 — ELA+·PLB 창설' }),
            confidence(3, '긴급명령으로 지원 여력 확대'),
          ],
          expert: {
            rating: 85,
            rationale:
              '이것이 없으면 금요일 정오에 은행은 지급불능이 된다. 동시에 이것은 "너무 크면 법이 바뀐다"는 사실을 제도로 확인해 주는 순간이기도 하다 — 헌법상 긴급권한으로 만든 창구는 명령이 실효하면 함께 사라지고, 그 정당성은 오래 다투어진다.',
            historicalNote:
              '연방평의회는 2023년 3월 16일 이 명령을 제정했고(AS 2023 135), 3월 19일 20시에 개정판(AS 2023 136)이 발효했다.',
            sourceRefs: [S.ord135, S.finma],
          },
          consequences:
            '명령이 오늘 밤 발효했습니다. ELA+와 PLB가 창설되었고, 두 수단에는 파산 시 우선변제권이 붙습니다. 지금은 공표하지 않습니다.',
          historical: true,
          calibrationNote: 'gross·usable +200 (ELA+ 100 + PLB 100) [plb-eo-2023-135]',
          feasibility: {
            basis:
              '연방헌법 제184조 제3항·제185조 제3항에 따른 긴급명령은 연방평의회 의결로 즉시 발효',
            sourceRefs: [S.ord135],
          },
          preview: [{ metric: 'usableReserves', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't2-d2-enact-resolution',
          label: '긴급명령에 정리·합병 조항까지 함께 넣는다',
          description:
            'ELA+·PLB에 더해, 주말에 필요해질 조항 — AT1 상각 명령 권한, 시스템적 중요 은행 간 합병의 절차 특례, 손실보전 보증의 근거 — 을 같은 명령에 미리 넣는다. 아직 발동하지 않고 근거만 만든다.',
          effects: [
            csFx.enactOrdinance({ label: '긴급명령 제정 — ELA+·PLB + 정리·합병 조항' }),
            confidence(3, '긴급명령으로 지원 여력 확대'),
            flag('ordinance_full'),
          ],
          expert: {
            rating: 90,
            rationale:
              '실제로는 3월 16일 명령에 없던 조항들(AT1 상각 명령 권한 제5a조, 합병법 특례 제10a조, 손실보전 보증 제14a조)이 3월 19일 20시 개정으로 뒤늦게 들어갔다. 근거를 주말 협상 **중에** 만들면 그 근거의 정당성이 내내 다투어진다. 사흘 앞서 같은 조항을 두는 것은 법적 안정성의 차이를 만든다.',
            sourceRefs: [S.ord136, S.bvger],
          },
          consequences:
            '명령이 발효했습니다. 상각 명령 권한, 합병 절차 특례, 손실보전 보증의 근거가 모두 들어갔습니다. 아무것도 발동하지 않았습니다.',
          calibrationNote: 'gross·usable +200, 추가로 ordinance_full 플래그 [plb-eo-2023-136]',
          feasibility: {
            basis: '같은 헌법 조항에 근거하므로 조문 추가는 초안 작업량의 문제일 뿐',
            sourceRefs: [S.ord136],
          },
          preview: [{ metric: 'usableReserves', direction: 'up', magnitude: 3 }],
        },
        {
          id: 't2-d2-wait',
          label: '제정하지 않고 통상 창구 안에서만 대응한다',
          description:
            '480억이 나갔다. 오늘의 지원으로 주말을 넘길 수 있다고 보고, 헌법상 긴급권한은 최후의 순간까지 아낀다.',
          effects: [confidence(-2, '지원 여력 확대 보류'), flag('ordinance_deferred')],
          expert: {
            rating: 10,
            rationale:
              '**이 시나리오의 함정이다.** 목요일 저녁에는 이것이 가장 합리적으로 보인다 — 480억이 나갔고, 주가는 올랐으며, 헌법상 긴급권한은 남용해서는 안 되는 수단이다. 그러나 같은 날 유출은 171억으로 커졌고, 금요일에는 200억이 더 필요해졌다. 그 200억은 긴급명령 없이는 존재하지 않는 돈이다.',
            sourceRefs: [S.finma, S.ord135],
          },
          consequences:
            '명령은 제정하지 않았습니다. 재무부 법무실은 초안을 서랍에 넣어 두었습니다.',
          trap: true,
          trapExplanation:
            '유동성 지원만으로 주말을 넘길 수 있다는 판단이 이 사건에서 가장 매력적인 오답이다. 480억은 큰 돈이고, 주가는 올랐고, 긴급권한을 아끼는 것은 법치의 미덕이다. 틀린 이유는 하나뿐이다 — 같은 날 유출이 더 커졌다는 사실이 이미 대시보드에 있었다.',
          remediationCard: 'fdic-resolution-weekend',
          preview: [{ metric: 'usableReserves', direction: 'flat', magnitude: 1 }],
        },
        {
          id: 't2-d2-parliament',
          label: '긴급명령 대신 의회를 소집해 입법으로 처리한다',
          description: '헌법상 긴급권한 대신 정식 입법 절차를 밟는다. 민주적 정당성은 가장 높다.',
          effects: [
            confidence(-6, '지원 여력 확대 지연'),
            op('confidence.board', 'add', 6, '의회 절차 존중'),
            flag('parliament_route'),
          ],
          expert: {
            rating: 15,
            rationale:
              '정당성의 논거는 가장 강하고 시간표는 가장 틀렸다. 임시국회 소집과 의결에는 최소 며칠이 걸리며, 은행은 금요일 정오에 지급불능이 된다. 실제로는 약정 신용에 대한 재정대표단(FinDel)의 긴급 승인이 연방의회 의결을 대신했다.',
            sourceRefs: [S.finma, S.puk],
          },
          consequences:
            '소집 요청이 접수되었습니다. 사무국은 "가장 빨라도 다음 주"라고 답했습니다.',
          preview: [{ metric: 'usableReserves', direction: 'flat', magnitude: 1 }],
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't2-d1',
      text: '"SNB 즉시 공여 여력"이 오늘 내줄 수 있는 상한입니다. 은행이 말한 500억과 이 숫자를 비교하십시오.',
    },
    {
      level: 2,
      decisionId: 't2-d2',
      text: '오늘 담보를 다 쓰면 내일 통상법으로 내줄 수 있는 것은 0입니다. 긴급명령은 내일의 선택지를 오늘 만드는 일입니다.',
    },
    {
      level: 3,
      decisionId: 't2-d2',
      text: '오늘 유출이 어제보다 큰지 마감 집계를 보십시오. 크다면 "지원으로 주말을 넘긴다"는 가정은 이미 틀렸습니다.',
    },
  ],
  relatedCards: ['discount-window-fhlb-btfp', 'fdic-resolution-weekend', 'bank-run-dynamics'],
}

export const turnsA: T[] = [t0, t1, t2]
