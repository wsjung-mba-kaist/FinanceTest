import type { DebriefSpec } from '../../engine/types'

export const ltcmDebrief: DebriefSpec = {
  historical: {
    summary:
      '1998년 8월 17일 러시아가 루블의 실질 평가절하와 채무 모라토리엄을 선언하자 세계적인 안전자산 선호가 시작됐다. LTCM이 의존하던 분산은 작동하지 않았다 — 스왑 스프레드, 국채 온·오프더런 베이시스, 신흥국 베이시스, 주가지수 변동성이 같은 방향으로 동시에 벌어졌다. 8월 한 달 손실 $1.8B(−44%)로 자본은 $2.3B가 되었고, 9월 2일 파트너들이 투자자에게 보낸 서한이 연초 대비 −52%를 인정하면서 상태가 시장에 알려졌다. 증자는 성사되지 않았다. 거래상대들은 일일 마진 프로세스를 조였고 상당수는 마크에 청산가치를 적용했다. 9월 21일 프라임브로커가 결제 관련 잠재 익스포저에 대한 담보를 요구하면서 펀드의 유동성 여력은 바닥에 가까워졌다. 9월 22일 아침 뉴욕연준은 사안을 가장 잘 아는 세 곳(골드만삭스·메릴린치·J.P.모건)을 불렀고, 곧 UBS가 더해졌다. 세 개의 작업반 중 포지션을 한 회사가 인수하는 두 안은 불가능하다는 결론이 났고, 세 번째 안인 공동 출자만 남았다. 그날 밤 13개사가 회합했다. 9월 23일 오전 외부 투자자 그룹의 인수 제안이 전달되었으나 12시 30분 시한까지 수락되지 않았고, 오후 다섯 시간의 논의 끝에 14개사가 $3.625B를 출자해 지분 90%와 운영 통제권을 가져가기로 합의했다. 두 곳(베어스턴스·크레디아그리콜)은 불참했다. 출자금은 9월 28일에 집행되었다. 연준의 자금은 한 푼도 들어가지 않았다.',
    timeline: [
      {
        turnId: 't0',
        note: '8/17 러시아 모라토리엄. 10년 국채 5.40%, Baa−10년 174bp, VIX 31.86, TED 76bp. 이 시점에 LTCM의 담보 조건을 바꾼 딜러는 없었다 — 경쟁 압력이 헤어컷을 없앤 상태였다.',
        sourceRefs: [
          'frbny-mcdonough-1998-10-01',
          'pwg-hedge-funds-1999',
          'fred-moodys-baa-aaa-1998',
        ],
      },
      {
        turnId: 't1',
        note: '9/2 투자자 서한: 연초 대비 −52%, 8월 손실 $1.8B(−44%), 자본 $2.3B, 총자산 >$125B(레버리지 25:1 초과). 거래상대들이 일일 마진을 조이기 시작했다.',
        sourceRefs: ['frbny-mcdonough-1998-10-01', 'pwg-hedge-funds-1999', 'fed-history-ltcm'],
      },
      {
        turnId: 't2',
        note: '9/18 증자 실패. McDonough가 월가에 연쇄 통화를 했고 "Everyone I spoke to that day volunteered concern". 같은 날 LTCM도 뉴욕연준에 접촉했다. 이 시점에도 합산 익스포저를 가진 주체는 없었다.',
        sourceRefs: [
          'frbny-mcdonough-1998-10-01',
          'gao-ggd-00-67r',
          'greenspan-testimony-1998-10-01',
        ],
      },
      {
        turnId: 't3',
        note: '9/21 "the LTCM Fund\'s liquidity situation was bleak." 프라임브로커가 결제 잠재 익스포저의 담보를 요구했고, 레포·OTC 거래상대들은 "possible liquidation values"를 마크에 적용하며 가능한 한 많은 담보를 요구했다. 그럼에도 LTCM은 모든 콜을 제때 이행했다.',
        sourceRefs: ['pwg-hedge-funds-1999'],
      },
      {
        turnId: 't4',
        note: '9/22 07:00 코어그룹 3사 조찬(+UBS), 세 작업반(채권 리프팅·주식 리프팅·컨소시엄) 가동. 앞의 둘은 불가 판정. 19:00 4사 텀시트, 20:30 13개사 회합. 다음 날 10:00 재소집 합의.',
        sourceRefs: ['frbny-mcdonough-1998-10-01', 'pwg-hedge-funds-1999'],
      },
      {
        turnId: 't5',
        note: '9/23 10:00 직전 외부 투자자 제안(회신 시한 12:30) → 10:50 정회 → 12:30 미수락·연장 없음 → 13:00 속개 → 다섯 시간 논의 → 14개사 $3.625B, 지분 90%. 두 곳 불참. 9/28 집행. 10/15 연준은 정례 회의 밖에서 FF 목표를 5.00%로 내렸다.',
        sourceRefs: [
          'frbny-mcdonough-1998-10-01',
          'gao-ggd-00-67r',
          'fed-history-ltcm',
          'fed-pr-1998-10-15',
        ],
      },
    ],
    outcome:
      '질서 있는 청산. 14개사가 $3.625B를 출자해 순자산의 90%와 운영 통제권을 인수했고, 포지션은 시간을 두고 정리되어 1999년 말~2000년 초에 펀드가 청산되었다. 무질서한 동시 청산이 일어났다면 LTCM 자체 추정으로 상위 17개 카운터파티가 합계 $3B~$5B, 일부 개별사는 $300M~$500M의 손실을 보았을 것이다. 연준은 자금을 대지 않았고 어떤 회사도 압박받지 않았다(Greenspan). 대가는 남았다 — Furfine(BIS WP 103)은 구제에 참여하지 않은 대형은행의 조달금리가 사후에 오히려 낮아진 것을 "too-big-to-fail" 인식의 강화로 해석한다.',
  },
  expert: {
    summary:
      '전문가 경로는 8월 17일에 두 가지를 먼저 한다. 신규 거래에 초기증거금을 도입해 담보가 **현재 대체원가만** 덮는 구조를 깨고(B), 주요 딜러와 총량 기준 익스포저 교환 채널을 연다(D). 9월 2일에는 되돌림에 걸지 않고 중간값 마크로 일일 재산정을 시작한다. 9월 18일에는 딜러 간 교환을 한 번 더 돌리고 뉴욕연준 통화에 우리 숫자를 그대로 전달한다. 9월 21일에는 청산가치 마크로 밀어붙이는 대신 중간값 마크로 부르되 **유예의 대가로 포지션·거래상대 명세를 받아** 합산을 확보하고, 같은 날 자기 수렴 북을 절반으로 줄인다. 9월 22일에는 연준 회합에 자료를 들고 나가고 컨소시엄 작업반에 인력을 파견한다. 9월 23일에는 균등 분담 원칙으로 표준 분담액을 제시하고 즉시 서명하며 질서 있는 청산 일정에 합의한다. 결과는 역사와 같다 — 컨소시엄은 성립하고 펀드는 질서 있게 정리된다. 다른 것은 그 과정에서 우리가 한 번도 무담보였던 적이 없고, 합산을 9월 21일에 이미 알고 있었으며, 회의실에서 다른 참가사가 우리를 기준으로 움직였다는 점이다.',
    rationale:
      '이 시나리오의 결론은 "다르게 했으면 살았다"가 아니다 — 역사 경로에서도 회사는 살아남는다. 다르게 할 수 있었던 것은 **얼마나 모른 채로 그 결정을 내렸는가**다. PWG는 "none of its investors, creditors, or counterparties provided an effective check on its overall activities"라고 적었고 Greenspan은 채권자들이 "underestimated the size and scope of the market bets"였다고 말했다. 전문가 경로가 바꾸는 것은 손실의 크기가 아니라 정보의 시점이다. 그리고 BCBS 46이 1999년 1월에 권고한 내용은 정확히 이 경로다: 시가평가 담보에 대한 과도한 의존을 줄이고, 심층 신용분석과 현재·미래 익스포저의 실효적 측정을 회복하라.',
    caveats: [
      '전문가 경로도 손실을 피하지 못한다. 자기 수렴 북을 9/21에 절반으로 줄이면 **컨소시엄이 성립한 세계에서는 그 보험이 쓰이지 않고 비용만 남는다** — 이 시나리오에서 전문가 경로의 누적 손실이 역사 경로보다 클 수 있는 이유이며, 의도된 결과다. 리스크 관리는 사후에 항상 비싸 보인다.',
      '딜러 간 총량 익스포저 교환(T0.D · T2.B)은 **반사실**이다. 1998년에 그런 채널이 작동한 기록은 없고, LTCM 이후 BCBS 45·46과 각국 감독 실무로 제도화되었다. 반독점·비밀유지 문제도 실제로는 이 시나리오가 가정한 것보다 까다로웠을 수 있다.',
      '베어스턴스와 크레디아그리콜의 불참은 이 시나리오에서 플레이어가 바꿀 수 없다(타 딜러 협조도의 상한을 90으로 둔 이유다). 두 기관이 참여하는 분기는 만들지 않았다.',
      '타 딜러의 참여 임계값(reluctance)은 **게임 보정값**이다. 실제 각 사의 내부 판단 기준은 공개되지 않았고, 확인되는 것은 결과(11사 균등 분담 + 소액 3사 + 불참 2사)뿐이다.',
      'LTCM의 자본 경로 가운데 문서로 확정된 것은 \'97말 $4.8B, 7/31 $4.1B, 8/31 $2.3B뿐이다. 9/18·9/21·9/22 값은 보간이고, 9/23의 ≈$0.4B는 GAO의 "90 percent of the net asset value"에서 역산한 값이다.',
      '수렴 스프레드 종합지수는 합성 지표다. 검증 가능한 앵커는 무디스 Baa−Aaa 품질 스프레드(8/17 61bp → 9/23 70bp → 10/15 81bp)뿐이고, 10년 스왑 스프레드와 온·오프더런 스프레드의 일별 수치는 미확인이다 — CGFS Papers 12의 Chart 8·12가 형상의 근거다.',
      '**모든 대화와 전화는 공개 기록을 바탕으로 한 재구성이며 녹취·속기록이 아니다.** 9/22 코어그룹 회합과 9/23 회의의 시각·참석 규모·결과는 McDonough 증언으로 확인되지만 문구는 각색이다. 자기매매 데스크와 타 딜러 리스크 총괄은 합성 상대다. 출자 제시액($100M / $250M / $350M)은 균등 분담 $300M을 기준으로 만든 선택지이지 실제 협상에서 오간 숫자가 아니다.',
      '9/21·9/22·9/23의 일중 경로(틱)는 양식화다. 공개된 것은 그날의 종가와 회의 시각뿐이며, 틱은 "잔액이 아니라 시각이 구속한다"는 구조를 보이기 위한 장치다. 9/23의 합의는 실제로 오후 6시경이었으나 5틱 안에서는 마지막 틱(16:00 시장 마감)으로 압축했다.',
      '외부 투자자 그룹의 **구성과 금액**은 1차 사후평가에 없다. 제안의 존재와 12시 30분 시한만 McDonough 증언과 Fed History로 확인된다 — 흔히 인용되는 구성은 2차 정보이므로 이 시나리오는 주체를 특정하지 않는다.',
    ],
  },
  lessons: [
    {
      id: 'l1',
      title: '명목과 순익스포저는 자릿수가 다르고, 위험은 그 사이에 있다',
      body: 'LTCM의 8월말 명목 파생은 선물 >$500B, 스왑 >$750B, 옵션·기타 OTC >$150B로 합계 약 $1.4조였다(널리 인용되는 $1.25조는 PWG 수치가 아니다). 같은 시점 한 대형 딜러의 순대체원가는 수억 달러였고, 담보를 매일 받으면 순익스포저는 0에 가까웠다. 그런데 LTCM 자체 추정으로 상위 17개 카운터파티의 동시 청산 손실은 합계 $3B~$5B, 일부 개별사는 $300M~$500M이었다. 명목은 위험이 아니고 순익스포저도 위험의 전부가 아니다 — 위험은 **청산해야 할 때 시장이 얼마나 움직이는가**이며, 그 크기는 명목에서 나오고 담보로는 덮이지 않는다. [출처: pwg-hedge-funds-1999, frbny-mcdonough-1998-10-01]',
      sourceRefs: ['pwg-hedge-funds-1999', 'frbny-mcdonough-1998-10-01'],
      cardRefs: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
    },
    {
      id: 'l2',
      title: '각자 자기 몫만 보면 합산은 아무 데도 존재하지 않는다',
      body: 'PWG의 진단은 한 문장이다: "Although individual counterparties imposed bilateral trading limits on their own activities with LTCM, none of its investors, creditors, or counterparties provided an effective check on its overall activities." 각 딜러의 한도는 각자 합리적이었고, 그 합은 아무도 계산하지 않았다. Greenspan도 채권자들이 "underestimated the size and scope of the market bets"였다고 말했다. 청산 손실 추정치는 "동시에 몇 곳이 파는가"에 달려 있는데, 그 숫자는 자기 시스템 안에 없다. 자기 익스포저를 아무리 정교하게 관리해도 모르는 분모로 나눈 값은 틀린다. [출처: pwg-hedge-funds-1999, greenspan-testimony-1998-10-01]',
      sourceRefs: ['pwg-hedge-funds-1999', 'greenspan-testimony-1998-10-01', 'bcbs-45'],
      cardRefs: ['economic-vs-regulatory-capital', 'crisis-communication'],
    },
    {
      id: 'l3',
      title: '담보는 고객이 살아 있을 때만 담보다',
      body: '1998년 관행은 초기증거금 없이 현재 대체원가만 담보로 받는 것이었다 — PWG는 "Competitive pressures, however generally led to banks\' reducing, or eliminating such haircuts, and thus sometimes banks have provided 100% financing"고 적는다. BCBS 46은 그 결과를 "an over reliance on collateralisation of mark-to-market exposures"로 판정했다. 담보를 부르지 않으면 벌어진 만큼이 무담보로 남고, 너무 세게 부르면 고객의 현금이 마르며, 마른 고객의 디폴트는 방금 받은 담보보다 큰 손실을 만든다. 9월 21일에 LTCM은 아직 모든 콜을 제때 이행할 수 있었다 — 낼 수 있을 때 받지 않으면 낼 수 없게 된 뒤에는 받을 수 없다. [출처: pwg-hedge-funds-1999, bcbs-46]',
      sourceRefs: ['pwg-hedge-funds-1999', 'bcbs-46'],
      cardRefs: ['hqla-and-haircuts'],
    },
    {
      id: 'l4',
      title: '동시 청산의 손실은 포지션이 아니라 속도가 만든다',
      body: 'McDonough의 판단은 이것이었다: "if many firms had rushed to close-out hundreds of billions of dollars in transactions simultaneously, they would have been unable to liquidate collateral or establish offsetting positions at the previously-existing prices. Markets would have moved sharply and losses would have been exaggerated." 컨소시엄이 $3.625B로 산 것은 지분이 아니라 **시간**이었다. 지분 90%와 운영 통제권을 가져간 이유는 포지션을 천천히 풀기 위해서였고, 실제로 펀드는 그렇게 정리되었다. 같은 논리가 자기 북에도 적용된다 — 먼저 파는 쪽이 이기는 것은 혼자 팔 때뿐이다. [출처: frbny-mcdonough-1998-10-01, cgfs-12-autumn-1998]',
      sourceRefs: ['frbny-mcdonough-1998-10-01', 'cgfs-12-autumn-1998', 'gao-ggd-00-67r'],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 'l5',
      title: '집단행동은 자금이 아니라 자리에서 나온다 — 그리고 무임승차는 배가 뜰 때만 가능하다',
      body: '연준은 한 푼도 대지 않았다(Greenspan: "no Federal Reserve funds were put at risk, no promises were made by the Federal Reserve, and no individual firms were pressured to participate"). 뉴욕연준이 제공한 것은 회의실과 시간, 그리고 각자 자기 숫자만 알고 있다는 사실을 서로 보게 만든 자리였다. 두 기관은 끝까지 불참했고 합의는 성립했으므로 그들의 계산은 맞았다 — Furfine은 참여하지 않은 대형은행의 조달금리가 오히려 낮아졌음을 보인다. 그러나 그 계산이 맞는 것은 **다른 참가사가 충분히 들어왔을 때뿐**이다. 코어그룹 참가사가 같은 계산을 하면 총액이 성립선에 닿지 않고, 그때의 손실은 빠진 쪽에도 똑같이 온다. [출처: greenspan-testimony-1998-10-01, bis-wp-103-furfine]',
      sourceRefs: [
        'greenspan-testimony-1998-10-01',
        'bis-wp-103-furfine',
        'frbny-mcdonough-1998-10-01',
      ],
      cardRefs: ['fdic-resolution-weekend', 'crisis-communication'],
    },
    {
      id: 'l6',
      title: '되돌림에 거는 것은 전략이 아니라 포지션이다',
      body: '"스프레드는 늘 되돌아왔다"는 것이 수렴 거래의 전제이고 1998년 9월에도 영업 회의실에서 가장 자주 나온 말이었다. 실제로 스프레드는 되돌아왔다 — 컨소시엄이 성립하고 연준이 10월 15일 정례 회의 밖에서 금리를 내린 뒤에. CGFS는 그 사이의 연쇄를 "시가평가·손절·마진콜 → 디레버리징 → 타 시장 전이 → 유동성 고갈 → 신용·시장 리스크 상승"으로 정리하고, 담보부 조달의 일일 시가평가가 사실상 "a global margin call"로 작동했다고 적는다. 평균회귀는 그 연쇄를 버틸 수 있는 규모에서만 전략이다. [출처: cgfs-12-autumn-1998, fed-pr-1998-10-15]',
      sourceRefs: ['cgfs-12-autumn-1998', 'fed-pr-1998-10-15', 'greenspan-fmc-1999-10-19'],
      cardRefs: ['economic-vs-regulatory-capital', 'hqla-and-haircuts'],
    },
  ],
  quiz: [
    {
      id: 'q1',
      type: 'numeric',
      prompt:
        "President's Working Group(1999)이 기록한 1998년 8월말 LTCM의 명목 파생 총액은 약 몇 조 달러입니까? (선물·스왑·옵션 합계, 단위: 조 달러)",
      answer: 1.4,
      tolerance: 0.1,
      unit: '조 달러',
      explanation:
        "선물 >$500B + 스왑 >$750B + 옵션·기타 OTC >$150B ≈ $1.4조다. 널리 인용되는 $1.25조는 PWG의 수치가 아니다. 참고로 PWG는 **OTC 파생만** 따로 '97말 $1.3조, '98말 $1.5조로 적는데, 이는 거래소 선물을 제외한 다른 기준이므로 $1.4조와 섞어 쓰면 안 된다.",
      sourceRefs: ['pwg-hedge-funds-1999'],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 'q2',
      type: 'single',
      prompt: '1998년 9월 23일 컨소시엄에 대해 공식 기록이 확인하는 것은 무엇입니까?',
      choices: [
        {
          id: 'a',
          text: '14개사가 약 $3.6B를 출자해 지분 90%와 운영 통제권을 가져갔고, 2개사는 불참했다',
        },
        { id: 'b', text: '16개사가 $3.6B를 출자했고 연준이 그중 $1B를 부담했다' },
        { id: 'c', text: '연준이 13(3)조를 발동해 LTCM에 직접 대출했다' },
        { id: 'd', text: '외부 투자자 그룹의 인수 제안이 수락되어 컨소시엄은 무산되었다' },
      ],
      answer: ['a'],
      explanation:
        'Fed History는 "fourteen firms put up $3.625 billion in capital in exchange for 90 percent of the fund\'s ownership", GAO는 9/28 집행액을 "about $3.6 billion, representing 90 percent of the net asset value"로 적고 불참 2개사(베어스턴스·크레디아그리콜)를 명시한다. Greenspan은 "no Federal Reserve funds were put at risk"를 확인한다. 외부 투자자 제안은 12시 30분 시한까지 수락되지 않았다.',
      sourceRefs: ['fed-history-ltcm', 'gao-ggd-00-67r', 'greenspan-testimony-1998-10-01'],
      cardRefs: ['fdic-resolution-weekend'],
    },
    {
      id: 'q3',
      type: 'true_false',
      prompt: 'LTCM은 9월 하순 거래상대들의 담보 요구를 이행하지 못해 마진콜 미납으로 디폴트했다.',
      answer: false,
      explanation:
        '틀렸다. PWG는 "Despite its losses, LTCM was able to meet every margin and collateral call on a timely basis"라고 명시한다. 위기는 미납이 아니라 **다음 콜을 낼 현금이 곧 없어진다는 전망**에서 왔다 — "By September 21, the LTCM Fund\'s liquidity situation was bleak"이고, 추가 유동성이 없으면 "a default as soon as Wednesday, September 23"이 가능했다. 담보를 받아내는 것과 고객을 살려 두는 것 사이의 긴장이 여기에 있다.',
      sourceRefs: ['pwg-hedge-funds-1999'],
      cardRefs: ['hqla-and-haircuts'],
    },
    {
      id: 'q4',
      type: 'single',
      prompt:
        '"시장이 곧 되돌아온다고 보고 담보를 느슨하게 유지하며 관계를 지키는" 선택이 1998년 9월에 특히 매력적으로 보였던 이유와, 그것이 틀린 이유를 가장 잘 설명한 것은?',
      choices: [
        {
          id: 'a',
          text: '스프레드가 실제로 되돌아왔기 때문에 매력적이었고, 되돌아오기 전에 고객이 버티지 못하면 담보 없는 익스포저를 전부 떠안기 때문에 틀렸다',
        },
        {
          id: 'b',
          text: '담보를 부르면 계약 위반이기 때문에 매력적이었고, 감독당국이 금지했기 때문에 틀렸다',
        },
        {
          id: 'c',
          text: '담보 요구가 수수료를 줄이기 때문에 매력적이었고, 세금 효과 때문에 틀렸다',
        },
        {
          id: 'd',
          text: '다른 딜러가 모두 느슨했기 때문에 매력적이었고, 실제로는 아무 문제가 없었다',
        },
      ],
      answer: ['a'],
      explanation:
        '수렴 스프레드는 결국 되돌아왔다 — 컨소시엄이 성립하고 연준이 10월 15일 금리를 내린 뒤에. 문제는 그 사이의 시간이다. 담보를 부르지 않으면 벌어진 차이가 전부 무담보 익스포저로 남고, 그 상태에서 고객이 디폴트하면 회수할 것이 없다. PWG는 거래상대들이 담보 약정만 믿고 "lulled into a false sense of security"였는지를 문제로 제기하며, BCBS 46은 그 의존을 명시적 결함으로 판정했다.',
      sourceRefs: ['pwg-hedge-funds-1999', 'bcbs-46', 'cgfs-12-autumn-1998'],
      cardRefs: ['hqla-and-haircuts'],
    },
    {
      id: 'q5',
      type: 'numeric',
      prompt:
        'LTCM 자체 추정으로, 무질서한 동시 청산이 일어났다면 **일부 개별 참가사**가 입었을 손실의 상한은 얼마입니까? (단위: 백만 달러)',
      answer: 500,
      tolerance: 0.2,
      unit: '백만 달러',
      explanation:
        'PWG: "The firms in the consortium saw that their losses could be serious, with potential losses to some firms amounting to $300 million to $500 million each." 상위 17개 카운터파티 합계로는 $3B~$5B였다. 이 숫자와 개별사 분담액($300M)을 나란히 놓고 보는 것이 9월 23일 회의실의 계산이었다 — 출자는 비용이 아니라 더 큰 손실을 피하는 값이었다.',
      sourceRefs: ['pwg-hedge-funds-1999'],
      cardRefs: ['fdic-resolution-weekend', 'economic-vs-regulatory-capital'],
    },
    {
      id: 'q6',
      type: 'multi',
      prompt:
        '1998년 LTCM 사태 이후 BCBS가 은행-고레버리지기관 거래에서 결함으로 지적한 것을 모두 고르십시오.',
      choices: [
        { id: 'a', text: '시가평가 익스포저의 담보화에 대한 과도한 의존' },
        { id: 'b', text: '상대방에 대한 심층 신용분석의 부족' },
        { id: 'c', text: '현재·미래 익스포저의 실효적 측정과 관리의 미흡' },
        { id: 'd', text: '중앙청산소를 통한 거래 의무화의 부재' },
      ],
      answer: ['a', 'b', 'c'],
      explanation:
        'BCBS 46(1999-01-28)은 신용리스크 관리 요소 간 균형이 깨져 "an over reliance on collateralisation of mark-to-market exposures"였고, 심층 신용분석과 익스포저의 실효적 측정·관리에 둔 비중이 부족했다고 판정했다. 중앙청산 의무화는 2008년 이후 G20 의제로, 1999년 권고에는 없다.',
      sourceRefs: ['bcbs-46', 'bcbs-45'],
      cardRefs: ['hqla-and-haircuts', 'economic-vs-regulatory-capital'],
    },
  ],
}
