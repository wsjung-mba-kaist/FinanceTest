import type { DebriefSpec } from '../../engine/types'

export const lehmanDebrief: DebriefSpec = {
  historical: {
    summary:
      '9월 9일 화요일 산업은행 협상 결렬 보도로 주가가 45% 급락했다. 수요일 리먼은 3분기 손실 $3.9B와 유동성 풀 $42B, 부동산 스핀오프·자산운용 지분 매각 "계획"을 선공개했지만 확정된 거래는 없었다. 목요일 주가는 42% 더 떨어졌고 레포 카운터파티가 비유동 담보의 롤오버를 거부했으며 청산은행 JPMorgan은 추가 담보 $5B를 요구했다. 금요일 저녁 뉴욕연준이 월가 CEO들을 소집해 민간 해법을 모색했다. 토요일 BofA는 메릴린치로 돌아섰고, 일요일 FSA는 바클레이스의 주주투표 면제를 거부했다. 연준은 일요일 저녁 PDCF 담보를 확대했지만 지주회사에는 대출하지 않았다. 9월 15일 01:45 ET 리먼 지주는 Chapter 11을 신청했다.',
    timeline: [
      {
        turnId: 't0',
        note: '9/9 KDB 협상 결렬 보도, 주가 −45%. 유동성 풀에 청산은행 담보 ≈$5.5B·씨티 comfort deposit $2B 포함(비공시).',
        sourceRefs: ['press-kdb-2008-09-09', 'valukas-report-2010'],
      },
      {
        turnId: 't1',
        note: '9/10 8-K: 순손실 $3.9B(순 MTM $5.6B), 유동성 풀 $42B(추정), CRE $32.6B, REI Global 스핀오프(2009 1분기), IMD 지분 55% 매각 계획, 배당 $0.05.',
        sourceRefs: ['lehman-8k-2008-09-10'],
      },
      {
        turnId: 't2',
        note: '9/11 주가 −42%. 레포 카운터파티 비유동 담보 롤오버 거부, JPM 추가 담보 $5B 요구, 헤지펀드 PB 잔고 이탈·노베이션.',
        sourceRefs: ['fcic-report-2011', 'valukas-report-2010', 'nyfed-sr506'],
      },
      {
        turnId: 't3',
        note: '9/12(금) JPM 2차 담보 콜 $5B 현금 이행; 즉시 현금화 가능 자산 $2.4B(보고유동성 $32.5B 중 $30.1B가 저현금화, Examiner Vol.4). 18:00 뉴욕연준 소집, "공적 자금 없음". BofA·바클레이스 실사.',
        sourceRefs: ['valukas-report-2010', 'fcic-report-2011', 'fed-history-support-institutions'],
      },
      {
        turnId: 't4',
        note: '9/13(토) 컨소시엄 bad-bank(부동산 ≈$30B) + 바클레이스 잔여 인수 잠정 구조. BofA→메릴린치.',
        sourceRefs: ['fcic-report-2011'],
      },
      {
        turnId: 't5',
        note: '9/14(일) FSA 주주투표 면제 거부, ISDA 특별 세션, 연준 PDCF 담보 확대(트라이파티 적격 전체) — 지주 대출·보증 불가.',
        sourceRefs: ['fed-pr-2008-09-14', 'bernanke-fcic-2010-04-20', 'fcic-report-2011'],
      },
      {
        turnId: 't6',
        note: '9/15 01:45 Chapter 11(자산 $639B, 부채 $613B, 5/31 기준). 브로커딜러 저녁 PDCF $28B 차입. 런던 법인 관리 절차, 고객 자산 동결.',
        sourceRefs: [
          'lehman-10q-2q08',
          'fed-history-support-institutions',
          'fdic-quarterly-2011-lehman',
        ],
      },
      {
        turnId: 't7',
        note: '9/16 AIG $85B(LIBOR+850bp, 79.9%), Reserve Primary Fund NAV $0.97; 9/19 재무부 MMF 보증(ESF $50B)·AMLF; 9/29 뉴버거 $2.15B 매각; 10/10 TED 4.58%.',
        sourceRefs: [
          'fed-pr-2008-09-16-aig',
          'treasury-hp1147',
          'fed-pr-2008-09-19-amlf',
          'lehman-8k-2008-09-29',
        ],
      },
    ],
    outcome:
      '무질서한 파산. 지주회사의 신청이 브로커딜러·해외 법인·파생 카운터파티와 조율되지 않아 런던 법인 고객 자산이 동결되고 MMF 런(Reserve Primary)이 촉발되었다. FDIC(2011)는 사전 조율된 정리(Title II OLA)라면 시스템 안정과 채권자 회수 모두 "vastly superior"였을 것이라 평가한다. 파산 관리 수수료만 2011.2까지 $1.2B 이상. 유동성 풀 $42B는 금요일에 $2B 미만이 되었다.',
  },
  expert: {
    summary:
      '전문가 경로는 T0에서 PDCF 적격 담보를 브로커딜러 앞으로 사전 예치하고(B), 자산운용 자회사를 확정 계약으로 팔며(C), 유동성 풀을 담보 예치분과 구분해 정직하게 공개한다(D). 수요일에는 손실을 확정 매각과 함께 공시하고 PB 이전은 정시 처리한다. 목요일 청산은행 담보 콜은 PDCF 차입으로 응하고, 비유동 담보 레포는 검증 가능한 담보 목록과 함께 질서 있게 줄인다. 금요일에는 연준에 조기 접촉하고 보증을 요청하며 PDCF 여력을 차입한다. 토요일에는 부동산 bad-bank를 확정하고 고객 자산 분리·담보 목록을 준비한다. 일요일 밤에는 사전 조율된(pre-packaged) Chapter 11을 택한다 — 브로커딜러는 결제를 유지하고, 해외 법인·고객 자산·ISDA 상계 순서를 맞춘 질서 있는 실패다.',
    rationale:
      '도시에는 리먼의 독립 생존을 지지하지 않는다. 지주회사는 연준 창구의 적격 차입자가 아니었고, 보증 권한은 없었으며, 인수자는 규제 승인과 손실 보증 없이 서명하지 않았다. 따라서 당시 가능했던 최선은 "질서 있는 실패"였다: 준비된 담보로 브로커딜러 결제를 지키고, 검증 가능한 숫자만 말하고, 팔 수 있는 자산을 살 사람이 있을 때 팔고, 파산이 불가피해진 순간 조율된 순서로 신청하는 것이다. 이 경로는 생존하지 못하지만 역사 경로보다 높은 점수를 받는다.',
    caveats: [
      '전문가 경로는 질서 있는 실패(pre-packaged Chapter 11)로 끝난다. 점수 상한은 62(무질서 40)이며, 이는 설계된 결과다 — "최선을 다해도 실패할 수 있었다"는 사실 자체가 교훈이다.',
      '2008년에는 Title II OLA가 없었다. "사전 조율된 Chapter 11"은 당시 법제 하에서 순서 조율이 가능했다는 가정이며, FDIC(2011) 시뮬레이션이 그 근거다.',
      '엔진에는 독립 생존 분기(T5.E)와 정부 지원부 매각 분기(T5.D)가 존재한다. 둘 다 반사실이다. 독립 생존은 Ball(2016)의 "PDCF $88B 차입 가능" 반론에만 기대며, 지주의 만기·파생 담보가 창구 밖이라는 사실은 그대로다. 이 분기의 점수는 낙관적 상한으로 읽어야 한다.',
      '뉴버거버먼의 2일 종결($7B)은 양식화다. 실제 파산 전 제안가 ≈$7B는 언론 보도[VERIFY]이고, 파산 후 매각가 $2.15B만 1차 출처다 — 파산 조사관 보고서 Vol. 2에도 제안 금액은 없다.',
      '컨소시엄이 인수자 없이 bad-bank에 자금을 댔을지(T4.B)는 반사실이다.',
      '세그먼트 유출률·레포 롤오프 비율은 베어(SEC 서한: 3/10 $18.1B → 3/13 ≈$2B)와 리먼(9/12 <$2B)의 풀 붕괴를 재현하도록 보정한 값이며, PB 잔고·CP·파생 담보의 실제 일별 분해는 공개되지 않았다.',
      '생존 분기에서 AIG·Reserve Primary·MMF 보증은 외생으로 유지된다. 실제 Reserve Primary의 손실은 리먼 CP에서 왔으므로, 메리디언이 생존한 세계에서 같은 사건이 같은 날 일어났을지는 가정이다.',
      '9/11·9/12의 장중 시각(트라이파티 언와인드 07:00, 청산은행 요구, 저녁 소집)과 유출의 시간대별 분포는 양식화다. 공개된 것은 그날의 합계뿐이며, 틱은 "잔액이 아니라 시각이 구속한다"는 구조를 보이기 위한 장치다.',
      '**중간에 걸려 오는 전화(인터럽트)와 주말 협상 대화의 모든 대사는 공개 기록을 바탕으로 한 재구성이며 녹취·속기록이 아니다.** 헤지펀드 COO·청산은행 트라이파티 데스크는 합성 상대이고, 뉴욕연준 소집은 통화의 존재와 시각(9/12 저녁 6시)만 FCIC 기록에 근거하며 문구는 각색이다. 컨소시엄 출자 규모($10/20/30B)는 분리 대상 부동산 북 $25~30B를 기준으로 만든 선택지이지 실제 협상에서 오간 숫자가 아니다.',
      '자사 5년 CDS 궤적(9/9 475 → 9/11 700 → 9/12 775bp)은 미확인이다[VERIFY]. BIS Quarterly Review 2008-12는 9월 초를 327 → 360/370bp로 적지만 그것은 KDB 협상 결렬(9/9) **이전**의 관측이다. 확정하려면 FCIC 자료실의 위원회 수집 Markit CDS 계열이 필요하다 — 파산 조사관 보고서 본문에는 bp 수치가 없다. TED·VIX·국채 금리는 FRED에서 직접 확인한 종가다.',
    ],
  },
  lessons: [
    {
      id: 'l1',
      title: '트라이파티 레포의 일중 신용이 증권사의 하루를 결정한다',
      body: '청산은행은 매일 아침 언와인드로 딜러에게 일중 신용을 주고, 저녁에 새 레포가 체결될 때까지 담보를 되돌려 준다. 청산은행이 추가 담보를 요구하거나 언와인드를 거부하면 딜러는 그날 결제를 할 수 없다. 베어와 리먼의 실패는 이 병목에서 일어났다. [출처: fcic-report-2011, nyfed-epr-triparty-2012]',
      sourceRefs: ['fcic-report-2011', 'nyfed-epr-triparty-2012', 'nyfed-sr506'],
      cardRefs: ['tri-party-repo-run'],
    },
    {
      id: 'l2',
      title: '보증 없는 최종대부자는 런을 멈추지 못한다',
      body: '노던록(2007.9.14)의 BoE 지원 발표는 보증 없이 이루어져 런을 촉발했고 9/17 정부 보증으로만 끝났다. 리먼의 경우 창구는 브로커딜러에만 열렸고 지주에는 대출도 보증도 없었다. 기관별 대출은 런을 못 막고, 시스템 보증(9/19 MMF 보증)이 막았다. [출처: hc-treasury-run-on-the-rock-2008, treasury-hp1147]',
      sourceRefs: [
        'hc-treasury-run-on-the-rock-2008',
        'treasury-hp1147',
        'fed-pr-2008-09-19-amlf',
        'bernanke-fcic-2010-04-20',
      ],
      cardRefs: ['discount-window-fhlb-btfp', 'bank-run-dynamics'],
    },
    {
      id: 'l3',
      title: '무담보 자금이 가장 먼저 사라진다',
      body: 'CP·MTN·은행 신용라인은 만기 시 100% 미갱신이 기본값이다(LCR 기타 법인 유출률 100%). 리먼이 씨티·BofA에 신용라인을 요청했을 때 답은 "담보 없이는 불가"였다. 위기의 조달 계획은 담보와 창구 적격성 위에만 세울 수 있다. [출처: fcic-report-2011, bcbs-144]',
      sourceRefs: ['fcic-report-2011', 'bcbs-144'],
      cardRefs: ['contingency-funding-plan', 'hqla-and-haircuts'],
    },
    {
      id: 'l4',
      title: '유동성 풀에 담보로 잡힌 자산을 넣지 마라',
      body: '리먼의 $42B에는 청산은행 담보 ≈$5.5B와 comfort deposit $2B가 들어 있었고, 금요일 즉시 현금화 가능 자산은 $2B 미만이었다. 공표 수치와 가용 수치의 차이는 첫 담보 콜에서 드러난다. 검증 가능한 숫자만 말한다. [출처: valukas-report-2010, valukas-testimony-2011]',
      sourceRefs: ['valukas-report-2010', 'valukas-testimony-2011', 'sec-cox-basel-2008-03-20'],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 'l5',
      title: '헤어컷 스파이럴: 비유동 담보로는 롤오버를 살 수 없다',
      body: '헤어컷은 카운터파티의 두려움의 가격이다. 헤어컷을 받아들이며 CMBS 레포를 유지하려 하면 같은 롤오프에 현금만 더 쓴다. NY Fed 연구는 2008.9 리먼의 트라이파티 조달이 헤어컷 조정이 아니라 조달 규모 자체의 급감으로 무너졌음을 보였다. 비유동 북은 투매가 아니라 분리·담보의 대상이다. [출처: cgfs-36, nyfed-sr506]',
      sourceRefs: ['cgfs-36', 'nyfed-sr506'],
      cardRefs: ['hqla-and-haircuts', 'tri-party-repo-run'],
    },
    {
      id: 'l6',
      title: '질서 있는 실패 vs 무질서한 실패 — Title II OLA',
      body: '리먼의 지주 단독 신청은 브로커딜러·런던 법인·파생 카운터파티와 조율되지 않아 고객 자산 동결과 MMF 런을 낳았다. FDIC(2011)는 사전 조율된 정리라면 시스템 안정과 채권자 회수 모두 우월했을 것이라 평가하고, 도드-프랭크 Title II 정리권한(OLA)이 그 답이 되었다. 실패가 확정되었다면 질서 있게 실패하라. [출처: fdic-quarterly-2011-lehman]',
      sourceRefs: ['fdic-quarterly-2011-lehman', 'fed-history-support-institutions'],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 'l7',
      title: '창구 적격성은 법인 단위다 — 지주의 만기는 창구 밖이다',
      body: 'PDCF·TSLF는 프라이머리 딜러(브로커딜러) 앞 창구다. 9/14 담보 확대 후에도 지주회사는 차입할 수 없었다. Ball은 담보가 충분했다고 반박하지만, 연준의 "금요일 기준"과 지주 부적격은 그대로였다. CFP에 법인별 창구 적격성과 담보 위치를 명시하라. [출처: fed-pr-2008-03-16, fed-pr-2008-09-14, ball-nber-w22410]',
      sourceRefs: ['fed-pr-2008-03-16', 'fed-pr-2008-09-14', 'ball-nber-w22410'],
      cardRefs: ['discount-window-fhlb-btfp', 'contingency-funding-plan'],
    },
    {
      id: 'l8',
      title: '팔 수 있는 자산은 살 사람이 있을 때 판다',
      body: '자산운용 자회사는 파산 전 ≈$7B의 제안이 있었고, 파산 후 $2.15B에 팔렸다. 확정 거래가 없는 "계획"은 손실 공개의 충격을 흡수하지 못한다. 손실 공개는 자금이 확정된 뒤에. [출처: lehman-8k-2008-09-29, lehman-8k-2008-09-10]',
      sourceRefs: ['lehman-8k-2008-09-29', 'lehman-8k-2008-09-10'],
      cardRefs: ['capital-raise-sequencing'],
    },
  ],
  quiz: [
    {
      id: 'q1',
      type: 'single',
      prompt: '트라이파티 레포에서 청산은행이 "언와인드"를 거부하면 딜러에게 어떤 일이 생기는가?',
      choices: [
        { id: 'a', text: '헤어컷이 소폭 오르지만 결제는 정상 진행된다' },
        {
          id: 'b',
          text: '딜러는 그날 일중 신용을 받지 못해 담보를 되찾지 못하고 당일 결제를 할 수 없다',
        },
        { id: 'c', text: '연준이 자동으로 PDCF 대출을 집행한다' },
        { id: 'd', text: '현금 대여자(MMF)가 담보를 직접 처분해야 한다' },
      ],
      answer: ['b'],
      explanation:
        '청산은행은 아침 언와인드로 딜러에게 일중 신용을 제공한다. 이를 거부하면 딜러는 담보도 현금도 없이 하루를 맞는다 — 베어·리먼 실패의 병목(FCIC ch.15/18; NY Fed EPR 2012).',
      sourceRefs: ['fcic-report-2011', 'nyfed-epr-triparty-2012'],
      cardRefs: ['tri-party-repo-run'],
    },
    {
      id: 'q2',
      type: 'multi',
      prompt:
        '리먼이 공표한 유동성 풀 $42B(9/10)와 관련해 파산 조사관이 지적한 사실 두 가지를 고르시오.',
      choices: [
        { id: 'a', text: '풀에 청산은행 담보 ≈$5.5B와 씨티 comfort deposit $2B가 포함되어 있었다' },
        { id: 'b', text: '9/12(금) 즉시 현금화 가능한 자산은 $2B 미만이었다' },
        { id: 'c', text: '풀 전액이 연준 계좌의 지준이었다' },
        { id: 'd', text: '풀은 9/12에도 $40B 이상 유지되었다' },
      ],
      answer: ['a', 'b'],
      explanation:
        'Valukas 보고서: 담보로 잡힌 자산이 풀에 포함되어 비공시였고, 금요일 가용 자산은 $2B 미만이었다. 검증 불가능한 숫자는 첫 담보 콜에서 모순이 드러난다.',
      sourceRefs: ['valukas-report-2010', 'valukas-testimony-2011'],
      cardRefs: ['crisis-communication'],
    },
    {
      id: 'q3',
      type: 'single',
      prompt:
        '2008년 9월 14일 연준의 PDCF 담보 확대 이후에도 리먼 지주회사가 연준에서 차입할 수 없었던 이유는?',
      choices: [
        { id: 'a', text: '지주회사가 보유한 담보가 모두 국채였기 때문' },
        {
          id: 'b',
          text: 'PDCF는 프라이머리 딜러(브로커딜러) 앞 창구이며 지주회사는 적격 차입자가 아니었기 때문',
        },
        { id: 'c', text: '연준이 9/14에 PDCF를 폐쇄했기 때문' },
        { id: 'd', text: 'FSA가 미국 연준의 대출을 금지했기 때문' },
      ],
      answer: ['b'],
      explanation:
        'PDCF(3/16)는 프라이머리 딜러 전용이다. 9/14 확대는 담보 범위를 넓혔을 뿐 차입자 범위를 넓히지 않았다. 창구 적격성은 법인 단위다.',
      sourceRefs: ['fed-pr-2008-03-16', 'fed-pr-2008-09-14'],
      cardRefs: ['discount-window-fhlb-btfp'],
    },
    {
      id: 'q4',
      type: 'single',
      prompt:
        '"헤어컷 인상을 받아들이며 CMBS 담보 레포 롤오버를 유지한다"는 선택이 함정인 이유로 가장 적절한 것은?',
      choices: [
        {
          id: 'a',
          text: '헤어컷 인상분을 현금으로 메워야 하고, 카운터파티의 두려움은 헤어컷으로 사라지지 않아 결국 같은 롤오프에 현금만 더 쓰기 때문',
        },
        { id: 'b', text: 'CMBS는 연준이 담보로 받지 않아 불법이기 때문' },
        { id: 'c', text: '헤어컷이 오르면 자동으로 신용등급이 상향되기 때문' },
        { id: 'd', text: '레포는 만기가 1년이라 롤오버가 필요 없기 때문' },
      ],
      answer: ['a'],
      explanation:
        'CGFS 36의 헤어컷 경기순응성과 NY Fed(Copeland·Martin·Walker)의 관찰: 리먼의 트라이파티 조달은 헤어컷 조정이 아니라 조달 규모의 급감으로 무너졌다. 비유동 담보 레포는 어차피 사라진다.',
      sourceRefs: ['cgfs-36', 'nyfed-sr506'],
      cardRefs: ['hqla-and-haircuts'],
    },
    {
      id: 'q5',
      type: 'numeric',
      prompt:
        '2008년 9월 19일 재무부 MMF 임시 보증 프로그램의 외환안정기금(ESF) 백스톱 규모는 얼마인가? (단위 $B, ±10%)',
      answer: 50,
      tolerance: 5,
      unit: '$B',
      explanation:
        '재무부는 공모 MMF(소매·기관)를 1년간 보증하며 ESF에서 최대 $50B를 배정했다. 기관별 대출(AIG $85B)이 막지 못한 MMF 런을 시스템 보증이 멈추었다.',
      sourceRefs: ['treasury-hp1147', 'fed-pr-2008-09-19-amlf'],
      cardRefs: ['bank-run-dynamics'],
    },
  ],
}
