import type { DebriefSpec } from '../../engine/types'

export const svbDebrief: DebriefSpec = {
  historical: {
    summary:
      '3월 8일 수요일 장 마감 후 SVB는 AFS $21B 매각(세후 손실 $1.8B)과 $2.25B 증자를 동시에 발표했다. 같은 날 저녁 실버게이트가 청산을 발표했다. 목요일 예금 $42B가 빠져나갔고 마감 시 연준 계좌는 −$958M이었다. 금요일 아침 $100B의 추가 인출 요청이 쌓인 가운데 캘리포니아 DFPI가 은행을 인수하고 FDIC를 관재인으로 지정했다. 일요일 저녁 재무부·연준·FDIC는 시스템리스크 예외로 전 예금을 보호하고 BTFP를 신설했다.',
    timeline: [
      {
        turnId: 't0',
        note: '2/24 10-K 공시: HTM 미실현손실 ≈$15B, 무보험예금 94%(콜리포트 기준). 2022년 중 헤지 해제, ILST 가정 변경.',
        sourceRefs: ['svb-10k-2022', 'fed-svb-review-2023'],
      },
      {
        turnId: 't1',
        note: '3/8 8-K: AFS ≈$21B 매각, 세후 손실 ≈$1.8B, $2.25B 증자(GA $0.5B 앵커). 실버게이트 청산 발표.',
        sourceRefs: ['svb-8k-2023-03-08'],
      },
      {
        turnId: 't3',
        note: '3/9 주가 −60%. VC의 인출 권고 확산. 담보를 재할인창구로 이동시키지 못함.',
        sourceRefs: ['fed-svb-review-2023', 'nyfed-sr1104'],
      },
      {
        turnId: 't5',
        note: '3/9 마감: 예금 유출 $42B(≈25%), 연준 계좌 −$958M, cash letter 미결제.',
        sourceRefs: ['dfpi-order-2023-03-10', 'fed-svb-review-2023'],
      },
      {
        turnId: 't6',
        note: '3/10 오전: 추가 $100B 요청 대기. DFPI 인수, FDIC DINB 설립. 총자산 $209.0B, 예금 $175.4B.',
        sourceRefs: ['fdic-pr-16-2023', 'fed-svb-review-2023'],
      },
      {
        turnId: 't7',
        note: '3/12 18:15 ET: 시스템리스크 예외(SVB·시그니처), BTFP(액면 담보, 1년 OIS+10bp). 시그니처 폐쇄.',
        sourceRefs: ['fdic-pr-17-2023', 'fed-btfp-2023-03-12'],
      },
      {
        turnId: 't8',
        note: '3/13 브릿지뱅크 개점. FRC −62%. 3/15 재할인창구 $152.9B 사상 최대. 3/26 퍼스트시티즌스 인수.',
        sourceRefs: ['fdic-pr-19-2023', 'bcbs-d555'],
      },
    ],
    outcome:
      '폐쇄. FDIC 예금보험기금 손실 추정 ≈$16B(수정치). 주주와 일부 무담보채권자는 보호받지 못했다. 연준 사후검토는 경영 실패와 감독 미흡, 2019년 규제 완화를 원인으로 꼽았다.',
  },
  expert: {
    summary:
      '전문가 경로는 T0에서 담보 사전 예치(B)와 백스톱 증자 협상(C), 분할 매각(E)을 택하고, 3월 8일 "빅뱅" 발표 대신 조용한 경로 또는 확정 증자 동반 공시를 선택한다. 3월 9일에는 기설정 담보를 즉시 인출하고 검증 가능한 유동성 수치로 소통하며 감독당국과 조기에 접촉한다. 주말에는 BTFP를 최대한 활용하고 징벌적 가격에라도 자본을 보강한다.',
    rationale:
      '이 경로의 핵심은 3월 9일의 대응이 아니라 2월의 준비다. 사전 예치된 담보만이 당일 자금이 되고(연준 검토 p.74), 자금이 확정된 증자만이 런 상태를 바꾼다. 검증 가능한 수치가 뒷받침될 때만 커뮤니케이션이 작동한다(FSB 2024).',
    caveats: [
      '경제적으로 HTM 손실 ≈ 유형자기자본이므로 생존해도 징벌적 가격의 신자본이 필요하다.',
      '퍼스트리퍼블릭 반례: $30B 컨소시엄 예금과 $70B 창구 여력에도 5월 1일 실패했다. 유동성은 시간을 벌 뿐 지급능력 우려를 해소하지 못한다.',
      '엔진에서는 T0.B(담보 사전 예치) 없이 T3 이후 생존 경로가 사실상 없다 — 이는 설계가 아니라 보정의 결과다.',
      '엔진의 전문가 경로는 신뢰지수가 회복되며 예금 유출이 수 %에 그친다. 실제로 준비된 은행이라도 2023년 3월의 부문 전체 인출 압력(FRC 1분기 −40%)을 겪었을 가능성이 크므로, 이 결과는 낙관적 상한으로 읽어야 한다.',
      '무디스의 등급 시계는 실재했다. 백스톱 증자 협상(2~4주)이 강등보다 늦을 수 있다.',
      '$42B의 일중 분포(오전 55%/오후 45%)와 예금 세그먼트는 양식화된 것이다.',
    ],
  },
  lessons: [
    {
      id: 'l1',
      title: '담보 준비는 위기 전에 끝나 있어야 한다',
      body: '당일 자금은 사전 예치된 담보에서만 나온다. SVB는 재할인창구 담보를 이동시키지 못했고 테스트 거래도 하지 않았다. 2023년 7월 인터에이전시 가이던스는 창구 운영 준비와 주기적 테스트 거래를 요구한다. [출처: fed-svb-review-2023, interagency-cfp-2023-07-28]',
      sourceRefs: ['fed-svb-review-2023', 'interagency-cfp-2023-07-28', 'barr-speech-2023-12-01'],
      cardRefs: ['discount-window-fhlb-btfp', 'contingency-funding-plan'],
    },
    {
      id: 'l2',
      title: '손실 공개와 증자의 순서가 런을 만든다',
      body: '백스톱 없는 증자 발표는 실패하면 증폭기가 된다. 자금이 확정된 뒤 공시하라(CS 2022년 10월). [출처: fed-svb-review-2023, metrick-jep-2024]',
      sourceRefs: ['fed-svb-review-2023', 'metrick-jep-2024', 'finma-cs-lessons-2023'],
      cardRefs: ['capital-raise-sequencing'],
    },
    {
      id: 'l3',
      title: '무보험 집중 + 디지털 조율 = 하루 25%',
      body: '2023년의 런은 하루 20~30%로, 과거의 1%/일과 다른 차원이다. 30일 LCR 가정은 하루 만에 소진된다. [출처: fsb-depositor-2024, nyfed-sr1104]',
      sourceRefs: ['fsb-depositor-2024', 'nyfed-sr1104', 'nber-w31138'],
      cardRefs: ['uninsured-deposits-and-run-speed', 'bank-run-dynamics'],
    },
    {
      id: 'l4',
      title: '규제자본이 양호해도 경제자본은 0일 수 있다',
      body: 'AOCI 옵트아웃으로 미실현손실은 CET1에 반영되지 않았지만 예금자는 경제적 자기자본을 본다. [출처: fed-svb-review-2023, nber-w31048]',
      sourceRefs: ['fed-svb-review-2023', 'nber-w31048'],
      cardRefs: ['economic-vs-regulatory-capital', 'afs-htm-aoci'],
    },
    {
      id: 'l5',
      title: 'HTM은 담보이지 매각 대상이 아니다',
      body: 'HTM 매각은 전체 포트폴리오를 시가로 바꾼다(ASC 320 tainting). 담보로 쓰면 현금이 되고, 팔면 자본이 사라진다. [출처: deloitte-fra-23-2]',
      sourceRefs: ['deloitte-fra-23-2'],
      cardRefs: ['htm-tainting'],
    },
    {
      id: 'l6',
      title: '커뮤니케이션은 검증 가능한 여력이 있을 때만 작동한다',
      body: '"건전하다"는 말은 소음이다. "송금이 정시에 나가고 있고 여력이 무보험예금의 X%"라는 검증 가능한 사실만이 신뢰를 만든다. [출처: fsb-depositor-2024, bcbs-d555]',
      sourceRefs: ['fsb-depositor-2024', 'bcbs-d555'],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 'l7',
      title: '질서 있는 실패는 무질서한 실패보다 낫다',
      body: '금요일 정오 폐쇄는 전례 없고 무질서했다. 생존 가능성이 없다면 목요일 밤 자발적 관리가 예금자와 정리 절차 모두에 낫다. [출처: gao-23-106736]',
      sourceRefs: ['gao-23-106736', 'fdic-pr-16-2023'],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 'l8',
      title: '정책 대응 설계: 액면 담보 창구',
      body: 'BTFP는 담보를 액면으로 평가해 미실현손실을 차입 여력으로 바꿨다. 이후 재할인창구 차입은 사상 최대($152.9B)를 기록했다. [출처: fed-btfp-2023-03-12, bcbs-d555]',
      sourceRefs: ['fed-btfp-2023-03-12', 'bcbs-d555'],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
  ],
  quiz: [
    {
      id: 'q1',
      type: 'single',
      prompt:
        '규제자본비율이 요건을 상회했음에도 3월 8일 발표(AFS $21B 매각 + $2.25B 증자)가 런을 촉발한 이유로 가장 적절한 것은?',
      choices: [
        { id: 'a', text: '매각 손실로 CET1 비율이 최저 요건 아래로 떨어졌기 때문' },
        {
          id: 'b',
          text: '무보험 예금자에게 "자본이 필요할 만큼 상황이 나쁘다"는 신호가 되었고, 백스톱 없는 증자는 실패 시 증폭기가 되기 때문',
        },
        { id: 'c', text: '연준이 즉시 재할인창구 접근을 차단했기 때문' },
        { id: 'd', text: 'HTM 포트폴리오가 tainting되어 재분류되었기 때문' },
      ],
      answer: ['b'],
      explanation:
        '연준 사후검토와 Metrick(2024)은 손실 공개와 미백스톱 증자의 동시 발표가 실버게이트 청산과 겹치며 무보험 예금자의 인출을 촉발했다고 본다. CET1은 요건을 상회했고 HTM은 매각되지 않았다.',
      sourceRefs: ['fed-svb-review-2023', 'metrick-jep-2024'],
      cardRefs: ['capital-raise-sequencing'],
    },
    {
      id: 'q2',
      type: 'multi',
      prompt: '3월 9일 SVB가 충분히 차입하지 못한 운영상 사실 두 가지를 고르시오.',
      choices: [
        {
          id: 'a',
          text: '재할인창구에 사전 예치된 담보가 극히 적었고 테스트 거래를 한 적이 없었다',
        },
        { id: 'b', text: '커스터디은행·FHLB에서 연준으로 담보를 당일 이동시키지 못했다' },
        { id: 'c', text: '연준이 지역은행에는 재할인창구를 개방하지 않았다' },
        { id: 'd', text: 'FHLB가 SVB의 모든 차입 요청을 거부했다' },
      ],
      answer: ['a', 'b'],
      explanation:
        '연준 사후검토 p.74: "레포 접근을 충분히 준비하지 않았고, 재할인창구 담보가 제한적이었으며, 테스트 거래를 하지 않았고, 담보를 신속히 이동시킬 수 없었다."',
      sourceRefs: ['fed-svb-review-2023'],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 'q3',
      type: 'single',
      prompt: 'HTM(만기보유) 증권 일부를 매각하면 대차대조표에 어떤 일이 일어나는가?',
      choices: [
        { id: 'a', text: '매각분의 손실만 실현되고 나머지 HTM은 그대로 상각원가로 유지된다' },
        {
          id: 'b',
          text: '전체 HTM 포트폴리오가 "오염"되어 AFS로 재분류되고 미실현손실이 자본(AOCI/경제적 자기자본)에 가시화된다',
        },
        { id: 'c', text: '규제자본에는 영향이 없고 유동성만 개선된다' },
        { id: 'd', text: 'HTM은 회계상 매각이 금지되어 있다' },
      ],
      answer: ['b'],
      explanation:
        'ASC 320-10-25-6의 tainting 규칙. 자행에 대한 런은 예외 사유가 될 수 있으나 일반적으로 잔여 포트폴리오 전체가 재분류된다.',
      sourceRefs: ['deloitte-fra-23-2'],
      cardRefs: ['htm-tainting'],
    },
    {
      id: 'q4',
      type: 'multi',
      prompt: 'BTFP가 재할인창구와 다른 조건을 두 가지 고르시오.',
      choices: [
        { id: 'a', text: '담보를 시가가 아닌 액면가로 평가한다' },
        { id: 'b', text: '만기가 최장 1년이다(재할인창구 1차 신용은 90일)' },
        { id: 'c', text: '회사채와 지방채도 담보로 받는다' },
        { id: 'd', text: '금리가 변동금리로 매일 재산정된다' },
      ],
      answer: ['a', 'b'],
      explanation:
        'BTFP 텀시트: 적격 담보(UST·기관채·기관 MBS)를 액면 평가, 최장 1년, 1년 OIS+10bp 고정, 수수료 없음, 조기상환 가능.',
      sourceRefs: ['fed-btfp-2023-03-12'],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 'q5',
      type: 'single',
      prompt:
        '3월 16일 11개 대형은행이 $30B를 예치했음에도 퍼스트리퍼블릭이 5월 1일 실패한 이유로 가장 적절한 것은?',
      choices: [
        { id: 'a', text: '예치금이 120일 뒤 회수되었기 때문' },
        {
          id: 'b',
          text: '1분기 실적 공시로 $100B 이상의 예금 유출이 드러나 런이 재점화되었고, 등급 강등으로 재할인창구 1차 신용 접근이 막혔으며, 지급능력(자본) 문제가 해결되지 않았기 때문',
        },
        { id: 'c', text: 'FDIC가 예금보험한도를 낮췄기 때문' },
        { id: 'd', text: 'BTFP가 3월 말에 종료되었기 때문' },
      ],
      answer: ['b'],
      explanation:
        '4월 24일 1분기 공시 후 유출이 재개되었고 4월 28일 문제은행 등급으로 2차 신용에 묶였다. 유동성 지원은 시간을 벌었지만 자본 문제를 해결하지 못했다.',
      sourceRefs: ['fdic-pr-34-2023', 'treasury-jy1349'],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
  ],
}
