import type { CentralBankState, Interrupt, Turn } from '../../engine/types'
import { confidence, counter, flag, regulator } from '../../engine/fx/common'
import { imfFx } from './fx'

/**
 * T0~T4 (1997-10-22 ~ 1997-11-20).
 *
 * ── 대사에 대한 고지 ──
 * 등장하는 기관(재정경제원, 한국은행, 국제통화기금, 종합금융회사, 해외 채권은행)은 모두 실재한다.
 * 그러나 이 시나리오의 **모든 발언·전화·회의 대사는 기록에 남은 사실관계에 기초한 개연성 있는 재구성**
 * 이며, 어떤 것도 실제 발언의 인용이나 속기록이 아니다. 실명 인물의 말로 제시된 문장은 하나도 없고,
 * 화자는 직책으로만 표기한다. 같은 고지를 디브리핑(debrief.ts)에도 담았다.
 *
 * ── 사후정보 규칙 ──
 * 각 턴의 텍스트에는 그 턴의 마지막 날짜까지 공표된 사실만 등장한다. 1998년 2월 이후(종금사 인가취소,
 * 감사원 특별감사, 공적자금, 국민의 금 모으기 총액, 1998년 실업률)는 엔딩과 디브리핑 전용이다.
 */

type T = Turn<CentralBankState>

/** 출처 id 축약 (sources.ts). */
export const S = {
  res: 'bok-fx-reserves-1997',
  rate: 'bok-fx-rate-1997',
  bok: 'bok-annual-report-1997',
  debt: 'mofe-external-debt-1997',
  band: 'mofe-fx-band-1997',
  stab: 'mofe-stabilisation-1997-11-19',
  susp: 'mofe-merchant-bank-suspension-1997-12',
  guar: 'mofe-bank-debt-guarantee-1997-12-22',
  bokAct: 'bok-act',
  sba: 'imf-sba-korea-1997-12-04',
  loi3: 'imf-loi-1997-12-03',
  loi24: 'imf-loi-1997-12-24',
  ieo: 'imf-ieo-capital-account-2003',
  ara: 'imf-ara-2015',
  audit: 'audit-fx-crisis-1998',
  hearing: 'nars-fx-crisis-hearing-1999',
  nak1: 'nak-record-006125',
  nak2: 'nak-record-003566',
  kdi: 'kdi-fx-crisis-1317',
  crs: 'crs-korea-1998',
  malaysia: 'malaysia-capital-controls-1998',
  bloomberg: 'bloomberg-usable-reserves-1997-11-05',
  herald: 'koreaherald-1997-12',
  moodys: 'moodys-korea-ba1-1997-12-21',
  ny: 'ny-debt-talks-1998-01-28',
}

// =================================================================================================
// T0 — 1997-10-22(수) ~ 10-24(금) "기아, 그리고 종금사 장부"
// =================================================================================================
export const t0: T = {
  id: 't0',
  label: 'T0',
  timeLabel: '1997년 10월 22일(수) ~ 24일(금) · 3영업일 · KST',
  title: '프롤로그: 기아, 그리고 종금사 장부',
  time: '1997-10-22T09:00:00+09:00',
  entryEffects: [
    {
      id: 't0-x1-stress',
      effects: [
        imfFx.setExternalStress({
          rolloverPct: 92,
          dueThisMonth: 85,
          shortTermDebt: 900,
          label: '단기외채 현황 갱신(10월 하순)',
        }),
      ],
      description: '단기외채 만기 구조 갱신',
    },
    {
      id: 't0-x2-drain',
      effects: [imfFx.runoffStep({ total: 0.2, profile: [1], label: '무역결제·단기외채 순상환' })],
      description: '대외 유출(3영업일)',
    },
    {
      id: 't0-x3-market',
      effects: [
        imfFx.marketMove({ equityPct: -6.5, spreadBp: 20, fundingStressBp: 30 }),
        confidence(-4, '기아자동차 법정관리 신청 — 5대 재벌의 연쇄 부실이 현실이 되었다'),
      ],
      description: '주가 하락·한국물 가산금리 상승',
    },
  ],
  events: [
    {
      id: 't0-news-kia',
      kind: 'newswire',
      outlet: '연합뉴스 · 서울경제',
      time: '10/22 08:30',
      headline: '기아자동차 법정관리 신청 — 7월 부도유예협약 이후 석 달, 결국 법원으로',
      body: '7월 15일 부도유예협약 대상이 된 기아그룹이 법정관리를 신청했다. 협력업체와 채권 금융기관의 손실이 확정 절차에 들어간다. 올해 들어 한보·삼미·진로·대농·기아로 이어진 대기업 부도의 청구서는 은행과 종합금융회사의 장부에 있다.',
      severity: 'critical',
      sourceRefs: [S.kdi, S.herald],
      relatedMetrics: ['distressedBanks'],
    },
    {
      id: 't0-memo-reserves',
      kind: 'memo',
      time: '10/22 09:10',
      from: '한국은행 외환국',
      to: '재정경제원 금융정책실 · 한국은행 정책담당',
      subject: '외환보유액 현황 — 공표치와 가용분의 차이',
      body: `10월 21일 기준입니다.

- **총외환보유액 305.1억달러.** 매월 공표되는 숫자입니다.
- **가용외환보유액 223.0억달러.** 오늘 결제에 쓸 수 있는 숫자입니다.
- 차이 **82.1억달러**는 대부분 국내은행 해외점포에 예치된 외화입니다. 장부상 보유액이지만 회수하면 그 점포가 바로 지급불능이 됩니다.

두 숫자의 차이가 지난 1년 사이 꾸준히 커졌습니다. 시장과 언론은 305억달러를 보고 있고, 우리는 223억달러로 방어하고 있습니다.

참고로 **1개월 내 만기가 돌아오는 단기외채가 85억달러**입니다. 총단기외채는 900억달러 안팎(총외채의 약 59%)입니다.`,
      severity: 'critical',
      sourceRefs: [S.res, S.hearing, S.debt],
      cardRefs: ['korea-crisis-toolkit', 'contingency-funding-plan'],
      relatedMetrics: ['usableReserves', 'grossReserves', 'reserveGap', 'guidottiRatio'],
    },
    {
      id: 't0-memo-merchant',
      kind: 'memo',
      time: '10/22 11:00',
      from: '재정경제원 금융정책실 종합금융과',
      to: '정책담당',
      subject: '종합금융회사 외화자금 실태 (내부)',
      body: `- 종금사 30개사의 **외화조달 잔액 약 200억달러**, 그중 단기 비중이 60% 안팎입니다.
- 단기로 빌려 장기로 굴렸습니다. 동남아 채권·국내 대기업 여신에 들어가 있어 만기에 맞춰 회수할 수 없습니다.
- 기아·한보 여신으로 자기자본이 사실상 잠식된 곳이 **12개사**로 집계됩니다.
- 외국 은행들이 9월부터 종금사 신용공여 한도를 줄이기 시작했습니다. 아직 롤오버율은 90%대입니다.`,
      severity: 'critical',
      sourceRefs: [S.debt, S.kdi],
      relatedMetrics: ['merchantBankFxDebt', 'rolloverRatePct', 'distressedBanks'],
    },
    {
      id: 't0-news-hongkong',
      kind: 'newswire',
      outlet: 'Reuters (홍콩)',
      time: '10/23 17:20',
      headline: '항셍지수 하루 10% 넘게 급락 — 홍콩 금융관리국, 페그 방어 위해 단기금리 인상',
      body: '대만이 지난주 환율 방어를 포기한 뒤 투기 압력이 홍콩으로 옮겨 왔다. 홍콩 당국은 페그를 지키기 위해 단기 자금시장 금리를 끌어올렸고, 주식시장은 그 대가를 치렀다. 아시아 전역의 통화가 다시 압박받고 있다.',
      severity: 'critical',
      sourceRefs: [S.herald, S.crs],
      relatedMetrics: ['fxSpot'],
      reliability: 'confirmed',
    },
    {
      id: 't0-market',
      kind: 'market',
      time: '10/22 09:00',
      headline: '개장 시세',
      items: [
        { label: '원/달러(종가)', value: '924.4', change: '7월 2일 887.2 대비 +4.2%' },
        { label: '일일변동폭', value: '±2.25%', change: '시장평균환율제' },
        { label: '종합주가지수', value: '566.85', change: '' },
        { label: '콜금리', value: '12.75%', change: '' },
        { label: '한국물 가산금리', value: '130bp', change: '' },
      ],
      sourceRefs: [S.rate, S.bok],
    },
  ],
  decisions: [
    {
      id: 't0-d1',
      title: '기아 처리와 종금사 부실 공개 범위',
      prompt: '기아 법정관리를 받아들이면서, 금융권 부실에 대해 무엇을 어디까지 말하겠습니까?',
      context:
        '지금 시장이 궁금해하는 것은 기아가 아니라 "기아 다음"입니다. 종금사 30개사의 외화조달 200억달러와 자기자본 잠식 12개사는 아직 우리 서랍 안에 있습니다.',
      dimensions: ['policy', 'communication'],
      requiredConcepts: ['crisis-communication', 'korea-crisis-toolkit'],
      options: [
        {
          id: 't0-d1-a',
          label: '법정관리 수용, 금융권 부실은 "관리 가능" 수준으로만 언급',
          description:
            '기아의 법정관리는 예정된 절차로 설명하고, 금융기관 건전성은 "충분히 관리 가능한 범위"라고만 밝힌다. 종금사 개별 수치는 공개하지 않는다. 당일 실행 가능하다.',
          effects: [
            flag('merchant_banks_undisclosed'),
            confidence(-3, '수치 없는 안심 발언 — 보정 규칙 §6.1'),
          ],
          expert: {
            rating: 35,
            rationale:
              '수치 없는 "관리 가능"은 보정 규칙표의 −3짜리 발언이다. 정보 공백은 외국 채권은행이 최악을 가정하게 만들고, 두 달 뒤 종금사 14개사를 한꺼번에 정지시킬 때 그 공백이 배신으로 읽힌다. IMF 사후평가(IEO)도 한국 사례의 핵심을 정보 비대칭으로 꼽았다.',
            historicalNote:
              '실제로 종금사 부실 실태는 개별적으로 공개되지 않았고, 12월 2일 9개사 업무정지가 첫 공개 조치가 되었다.',
            sourceRefs: [S.ieo, S.kdi],
          },
          consequences:
            '브리핑이 나갔습니다. 기자들이 "관리 가능하다는 근거가 무엇이냐"고 묻자 대변인은 구체적 수치를 제시하지 못했습니다.',
          historical: true,
          feasibility: {
            basis: '재정경제원의 통상적 브리핑 권한 범위, 당일 실행 가능',
            sourceRefs: [S.kdi],
          },
        },
        {
          id: 't0-d1-b',
          label: '종금사 전수조사 결과와 외화차입 잔액을 수치로 공개',
          description:
            '30개 종금사의 외화조달 200억달러, 단기 비중 60%, 자기자본 잠식 12개사를 공개하고 정리 일정을 함께 제시한다. 감독 자료는 이미 있으므로 3영업일 안에 발표 가능하다.',
          effects: [
            flag('merchant_banks_disclosed'),
            flag('reserves_disclosed'),
            confidence(-6, '부실 규모 공개 — 단기 충격'),
            imfFx.adjustRollover({ deltaPct: 3, reason: '검증 가능한 정보 공개' }),
            imfFx.adjustDrain({ factor: 0.94, reason: '채권은행의 불확실성 축소' }),
          ],
          expert: {
            rating: 80,
            rationale:
              '단기적으로는 신뢰가 더 떨어지지만, 검증 가능한 수치가 있는 쪽이 롤오버 붕괴를 늦춘다. IMF 사후평가는 한국 프로그램의 초기 실패 원인으로 가용보유액·단기외채 정보의 불투명성을 지목했고, 정보가 공개된 뒤에야 채권은행 협상이 가능해졌다고 평가했다.',
            sourceRefs: [S.ieo, S.ny],
          },
          consequences:
            '수치가 나갔습니다. 주가는 더 떨어졌지만, 외국 은행 서울지점장들이 처음으로 "이제 무엇을 보고 판단할지 알겠다"고 말했습니다.',
          calibrationNote: 'ΔCI −6, 롤오버 +3%p, 유출 계수 ×0.94 [CAL: 검증 가능 정보 공개]',
          feasibility: {
            basis: '감독 검사 자료가 이미 존재하며 공표에 법적 제약이 없다',
            sourceRefs: [S.kdi],
          },
        },
        {
          id: 't0-d1-c',
          label: '부실 종금사 12개사 선제 정리계획을 발표하고 가교기관 설립 착수',
          description:
            '자기자본이 잠식된 12개사를 명시해 정리 대상으로 지정하고, 예금·외화채무를 승계할 가교 금융기관 설립을 준비한다. 법 개정 없이 인가 조건 부과로 가능하나 정치적 저항이 크다.',
          effects: [
            flag('merchant_banks_disclosed'),
            flag('resolution_plan_early'),
            flag('reserves_disclosed'),
            confidence(-6, '정리 대상 지정 — 해당 종금사 즉시 자금난'),
            imfFx.adjustRollover({ deltaPct: 5, reason: '정리 원칙 사전 제시' }),
            imfFx.adjustDrain({ factor: 0.88, reason: '부실 전이 경로 차단' }),
            counter('earlyResolution', 1),
          ],
          expert: {
            rating: 88,
            rationale:
              '실제로는 두 달 뒤에야 이루어진 일을 두 달 먼저 하는 선택이다. 12월 2일과 12월 10일의 일괄 업무정지는 해외 채권은행의 롤오버 거부를 가속했는데, 그 충격의 상당 부분은 "예고 없이 한꺼번에" 때문이었다. 정리 원칙과 승계 기구를 먼저 세워 두면 같은 조치가 훨씬 싸진다. 다만 10월 시점에 정치적으로 관철하기는 매우 어려웠다.',
            sourceRefs: [S.susp, S.ieo, S.kdi],
          },
          consequences:
            '12개사 명단이 나가자 해당 종금사의 콜 차입선이 당일 막혔습니다. 한편 외국 은행들은 "나머지 18개사는 괜찮다는 뜻이냐"고 되묻기 시작했습니다.',
          irreversible: true,
          feasibility: {
            basis: '종합금융회사 인가 조건 부과와 한국은행법상 유동성 지원으로 가교기관 운영 가능',
            sourceRefs: [S.bokAct, S.susp],
          },
        },
        {
          id: 't0-d1-d',
          label: '기아 부도유예를 재연장하고 채권단 자율협약에 맡긴다',
          description:
            '법정관리를 미루고 채권 금융기관 자율협약으로 처리한다. 당장의 손실 확정을 늦출 수 있다.',
          effects: [
            flag('kia_deferred'),
            confidence(-6, '부실 처리 지연 — 시장은 은폐로 읽는다'),
            imfFx.adjustRollover({ deltaPct: -4, reason: '손실 인식 지연' }),
            imfFx.adjustDrain({ factor: 1.1, reason: '부실 규모 불확실성 확대' }),
          ],
          expert: {
            rating: 12,
            rationale:
              '7월 부도유예협약이 이미 실패한 방식이다. 손실을 인식하지 않으면 부실은 금융기관 장부에 남아 외화 차입선을 갉아먹는다. IMF 사후평가와 KDI 모두 손실 인식 지연을 위기 심화의 주요 경로로 지목했다.',
            sourceRefs: [S.ieo, S.kdi],
          },
          consequences:
            '부도유예가 연장되었습니다. 채권 금융기관들은 충당금을 쌓지 않아도 되지만, 외국 은행들은 "한국은 아직 손실을 인정하지 않는다"고 본사에 보고했습니다.',
          trap: true,
          trapExplanation:
            '시간을 벌어 보인다는 점이 함정이다. 실제로 벌리는 것은 시간이 아니라 부실의 크기이며, 그 사이 종금사의 외화 차입선이 먼저 끊긴다.',
          remediationCard: 'korea-crisis-toolkit',
        },
      ],
    },
    {
      id: 't0-d2',
      title: '원화 방어 강도',
      prompt: '이번 주 외환시장 개입 규모를 결정하십시오.',
      context:
        '대만이 지난주 방어를 포기했고 홍콩이 금리로 버티고 있습니다. 원화에도 같은 압력이 옵니다. 일일변동폭은 ±2.25%이고, 가용외환보유액은 223억달러입니다.',
      dimensions: ['marketRisk', 'liquidity'],
      requiredConcepts: ['korea-crisis-toolkit'],
      options: [
        {
          id: 't0-d2-a',
          label: '전면 방어 — 22억달러를 투입해 920원대를 지킨다',
          description:
            '현물환 매도로 절하 속도를 늦춘다. 매도분의 약 60%는 스왑·차입으로 조달하므로 공표 보유액은 40%만 줄어든다. 당일 집행 가능하다.',
          effects: [
            imfFx.intervene({ amount: 22.0, label: '현물환 개입 22억달러' }),
            imfFx.fxStep({ close: 929.5, baseline: 22.0, bandDays: 3, freeFloatPremiumPct: 3 }),
          ],
          expert: {
            rating: 40,
            rationale:
              '주간 22억달러는 당시 기준으로 큰 금액이 아니었고 시장도 이를 예상했다. 문제는 이 방식이 10~11월에 약 151억달러를 소진할 때까지 멈추지 않았다는 것이다. 개입의 60%가 스왑으로 조달되었기 때문에 공표 보유액은 천천히 줄었고, 그래서 멈출 계기가 오지 않았다.',
            historicalNote: '실제로 10~11월 두 달간 약 151억달러가 환율방어에 소진되었다.',
            sourceRefs: [S.bok, S.audit],
          },
          consequences:
            '원/달러는 929.5원에서 마감했습니다. 이번 주 매도분의 60%는 스왑으로 되메웠으므로 공표 보유액은 8.8억달러만 줄어듭니다. 가용은 22억달러가 통째로 빠졌습니다.',
          historical: true,
          calibrationNote:
            '개입 1억달러당 압력 0.06%p 완화 [CAL]; 스왑 조달 비중 60% [CAL, 앵커 61/151]',
          feasibility: {
            basis: '한국은행 외환시장 개입은 일상적 권한이며 당일 집행된다',
            sourceRefs: [S.bok],
          },
        },
        {
          id: 't0-d2-b',
          label: '제한 개입 — 8억달러로 변동성만 완화하고 절하를 허용',
          description:
            '일방적 쏠림이 있을 때만 개입하고, 변동폭 안에서의 절하는 받아들인다. 가용보유액을 아낀다.',
          effects: [
            imfFx.intervene({ amount: 8.0, label: '현물환 개입 8억달러(변동성 완화)' }),
            imfFx.fxStep({ close: 929.5, baseline: 22.0, bandDays: 3, freeFloatPremiumPct: 3 }),
            flag('defence_limited'),
          ],
          expert: {
            rating: 78,
            rationale:
              '10월 하순은 아직 가용보유액이 223억달러 있던 시점이다. 이때 절하를 받아들였다면 11월에 62억달러를 쓰지 않아도 되었다. IMF 사후평가는 한국·인도네시아·브라질 사례에서 공통적으로 "보유액을 지키고 환율을 움직이는 쪽"이 나았다고 평가한다.',
            sourceRefs: [S.ieo, S.ara],
          },
          consequences:
            '원/달러는 방어를 줄인 만큼 더 밀려 마감했습니다. 대신 가용보유액 14억달러가 남았습니다.',
          calibrationNote: '개입 부족분 14억달러 × 0.06%p = 환율 +0.84%',
          feasibility: { basis: '개입 규모는 한국은행 재량', sourceRefs: [S.bok] },
        },
        {
          id: 't0-d2-c',
          label: '개입을 중단하고 일일변동폭을 ±10%로 선제 확대',
          description:
            '변동폭 확대는 재정경제원 고시로 가능하다. 개입 없이 시장이 환율을 찾게 하고 보유액을 전부 남긴다. 수출기업에는 유리하나 원화 표시 외화부채를 진 기업에는 즉시 손실이다.',
          effects: [
            imfFx.setBand({ pct: 10, label: '일일변동폭 ±2.25% → ±10%' }),
            imfFx.fxStep({ close: 929.5, baseline: 22.0, bandDays: 3, freeFloatPremiumPct: 3 }),
            confidence(-5, '변동폭 확대 — 방어 포기 신호로 읽힌다'),
            imfFx.adjustRollover({ deltaPct: -3, reason: '급격한 절하 우려' }),
            flag('band_widened_early'),
          ],
          expert: {
            rating: 70,
            rationale:
              '보유액을 보존한다는 점에서 옳은 방향이지만, 10월에 단독으로 하면 "한국이 포기했다"는 신호가 되어 롤오버가 먼저 무너진다. 실제로 변동폭 확대(11월 19일)는 예금 전액보장과 함께 패키지로 나왔다. 제도 변경은 그 자체로는 중립이고, 동반되는 메시지가 효과를 정한다.',
            sourceRefs: [S.band, S.stab, S.ieo],
          },
          consequences:
            '고시가 나갔습니다. 환율은 크게 밀렸고 보유액은 한 푼도 쓰지 않았습니다. 외국 은행 본점들이 서울지점에 한도 재검토를 지시했다는 이야기가 들립니다.',
          feasibility: {
            basis:
              '일일변동폭은 재정경제원 고시 사항 — 1997-11-19와 12-16에 실제로 그렇게 변경되었다',
            sourceRefs: [S.band],
          },
        },
        {
          id: 't0-d2-d',
          label: '920원 사수를 공개 선언하고 무제한 방어를 천명',
          description:
            '방어선을 명시적으로 밝혀 투기를 억제한다. 선언 자체에는 비용이 들지 않는다.',
          effects: [
            imfFx.intervene({ amount: 30.0, label: '방어선 공개 후 개입 30억달러' }),
            imfFx.fxStep({ close: 929.5, baseline: 22.0, bandDays: 3, freeFloatPremiumPct: 3 }),
            flag('defence_line_announced'),
            confidence(2, '선언 직후의 일시적 안정'),
            imfFx.adjustDrain({ factor: 1.15, reason: '방어선 공개 — 투기 세력에 목표 제공' }),
          ],
          expert: {
            rating: 15,
            rationale:
              '방어선을 공개하면 상대에게 정확한 과녁을 주는 것이다. 영국(1992), 태국(1997), 대만(1997) 모두 같은 순서로 실패했다. 게다가 우리는 총 305억달러가 아니라 가용 223억달러로 싸우고 있고, 그 사실은 아직 시장이 모른다 — 알려지는 순간 방어선은 의미가 없어진다.',
            sourceRefs: [S.ieo, S.crs],
          },
          consequences:
            '"920원은 지킨다"는 발언이 나갔습니다. 이틀간 환율은 안정되었고, 홍콩과 싱가포르의 역외 원화 선물환 거래량이 급증했습니다.',
          trap: true,
          trapExplanation:
            '선언은 공짜로 보이지만 가장 비싼 개입이다. 방어선이 공개되면 시장은 그 선까지의 거리를 계산해 정확히 그만큼 팔고, 당국은 선을 지키기 위해 원래 계획보다 많이 쓰게 된다.',
          remediationCard: 'crisis-communication',
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '대시보드의 두 보유액 숫자를 나란히 보십시오. 총외환보유액과 가용외환보유액의 차이가 이 시나리오의 주제입니다.',
      decisionId: 't0-d2',
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      level: 2,
      text: '단기외채 커버리지(가용/단기외채)를 보십시오. Greenspan-Guidotti 기준은 100%인데 지금은 25% 안팎입니다. 방어에 쓸 돈과 갚아야 할 돈을 같은 지갑에서 꺼내고 있습니다.',
      decisionId: 't0-d2',
      cardRefs: ['contingency-funding-plan'],
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'contingency-funding-plan', 'crisis-communication'],
}

// =================================================================================================
// T1 — 1997-10-27(월) ~ 10-31(금) "홍콩이 두 번째로 무너진 주"
// =================================================================================================
export const t1: T = {
  id: 't1',
  label: 'T1',
  timeLabel: '1997년 10월 27일(월) ~ 31일(금) · 5영업일 · KST',
  title: '홍콩이 두 번째로 무너진 주',
  time: '1997-10-27T09:00:00+09:00',
  entryEffects: [
    {
      id: 't1-x1-stress',
      effects: [imfFx.setExternalStress({ rolloverPct: 88, dueThisMonth: 90, shortTermDebt: 900 })],
      description: '롤오버율 88%로 하락',
    },
    {
      id: 't1-x2-drain',
      effects: [imfFx.runoffStep({ total: 0.2, profile: [1], label: '대외 유출(5영업일)' })],
      description: '대외 유출',
    },
    {
      id: 't1-x3-market',
      effects: [
        imfFx.marketMove({ equityPct: -12, spreadBp: 35, fundingStressBp: 40 }),
        confidence(-5, '홍콩 2차 급락과 뉴욕 폭락 — 아시아 전역의 자금 회수'),
        imfFx.ratingAction({
          to: 'A+',
          notches: 1,
          label: '국가신용등급 AA− → A+ (1노치)',
        }),
      ],
      description: '홍콩·뉴욕 급락, 국가신용등급 1노치 강등',
    },
  ],
  events: [
    {
      id: 't1-news-hangseng',
      kind: 'newswire',
      outlet: 'Reuters (홍콩·뉴욕)',
      time: '10/28 17:00',
      headline:
        '항셍지수 하루 13% 넘게 폭락, 뉴욕 다우지수도 사상 최대폭 하락 — 아시아 자금 일제 회수',
      body: '홍콩의 2차 급락이 뉴욕으로 번졌다. 미국·유럽 금융기관이 아시아 신흥국 익스포저를 일괄 축소하고 있으며, 한국도 예외가 아니다. 서울 소재 외국은행 지점들은 본점으로부터 한도 재검토 지시를 받았다고 전해진다.',
      severity: 'critical',
      sourceRefs: [S.herald, S.crs],
      relatedMetrics: ['equityIndex', 'rolloverRatePct'],
    },
    {
      id: 't1-regulator-rating',
      kind: 'regulator',
      agency: '국제 신용평가사',
      time: '10/29 22:00',
      headline: '한국 국가신용등급 AA− → A+ 강등, 전망 부정적',
      body: '대기업 연쇄 부도와 금융기관 자산건전성 악화, 단기외채 구조를 이유로 들었다. 전망은 부정적으로 유지되어 추가 강등 가능성이 열려 있다.',
      tone: 'concerned',
      severity: 'critical',
      sourceRefs: [S.crs, S.herald],
      relatedMetrics: ['sovereignSpreadBp'],
    },
    {
      id: 't1-call-merchant-assoc',
      kind: 'call',
      caller: '종합금융협회 회장',
      callee: '재정경제원 금융정책실장',
      agency: '종합금융협회',
      tone: 'urgent',
      time: '10/30 15:40',
      lines: [
        {
          speaker: '종합금융협회 회장',
          text: '이번 주에만 회원사 외화 차입 만기가 열두 건 돌아왔는데 넷이 연장 거절입니다. 롤오버율이 90%에서 80% 아래로 떨어지면 회원사 절반이 못 버팁니다.',
        },
        {
          speaker: '재정경제원 금융정책실장',
          text: '연장 거절의 사유가 무엇입니까. 개별 회사 신용입니까, 한국 전체입니까.',
        },
        {
          speaker: '종합금융협회 회장',
          text: '본점 방침이라고만 합니다. 한국 익스포저 전체를 줄이라는 지시라는 이야기입니다. 한국은행이 해외점포에 외화를 넣어 주시면 당장은 막을 수 있습니다.',
        },
      ],
      severity: 'critical',
      sourceRefs: [S.debt, S.hearing],
      relatedMetrics: ['rolloverRatePct', 'reserveGap'],
    },
    {
      id: 't1-market',
      kind: 'market',
      time: '10/31 15:30',
      headline: '주간 시세',
      items: [
        { label: '종합주가지수', value: '474', change: '주간 −12%' },
        { label: '단기외채 롤오버율', value: '88%', change: '전주 92%' },
        { label: '1개월 내 만기 단기외채', value: '90억달러', change: '' },
      ],
      sourceRefs: [S.debt, S.herald],
    },
  ],
  decisions: [
    {
      id: 't1-d1',
      title: '종금사 외화 만기 대응',
      prompt: '연장이 거절된 종금사 외화 차입을 어떻게 처리하시겠습니까?',
      context:
        '해외점포에 외화를 예치하면 총외환보유액은 그대로이고 가용만 줄어듭니다. 직접 지원하면 둘 다 줄어듭니다. 거절하면 종금사 한 곳이 대외 채무불이행에 들어갑니다.',
      dimensions: ['liquidity', 'policy'],
      requiredConcepts: ['korea-crisis-toolkit', 'contingency-funding-plan'],
      options: [
        {
          id: 't1-d1-a',
          label: '해외점포 예치를 늘려 종금사 외화 만기를 막는다',
          description:
            '한국은행이 국내은행·종금사 해외점포에 외화를 예치해 그 점포가 만기를 갚게 한다. 총외환보유액 공표치에는 그대로 남는다. 한국은행법상 외화자산 운용으로 즉시 가능하다.',
          effects: [
            imfFx.depositAtBranches({
              amount: 1.5,
              reason: '종금사 해외점포 만기 대응',
              label: '해외점포 외화예치 1.5억달러',
            }),
            flag('branch_deposit_policy'),
          ],
          expert: {
            rating: 30,
            rationale:
              '실제로 선택된 경로이고, 1997년의 가용·총액 괴리를 키운 바로 그 행위다. 공표 보유액이 줄지 않으므로 정책의 비용이 보이지 않고, 그래서 멈출 계기가 생기지 않는다. 국회 청문회에서 이 예치 규모와 성격이 핵심 쟁점이 되었다.',
            historicalNote:
              '10월말 기준 총외환보유액과 가용외환보유액의 차이 82억달러 대부분이 이 예치금이었다.',
            sourceRefs: [S.hearing, S.audit],
          },
          consequences:
            '해당 종금사 해외점포가 만기를 막았습니다. 공표 보유액은 변하지 않았습니다. 가용외환보유액만 1.5억달러 줄었고, 괴리는 그만큼 커졌습니다.',
          historical: true,
          calibrationNote: '가용 −1.5, 총액 불변 — 괴리 +1.5 [CAL]',
          feasibility: {
            basis: '한국은행의 외화자산 운용(해외점포 예치)은 1997년 당시 상시 수단이었다',
            sourceRefs: [S.bokAct, S.hearing],
          },
        },
        {
          id: 't1-d1-b',
          label: '직접 외화대출로 지원하되 총액·가용 모두 공표한다',
          description:
            '해외점포 예치 대신 한국은행 외화대출로 지원하고, 지원 규모를 보유액 통계에 반영해 공표한다. 보유액이 줄어드는 것이 보이므로 정책의 비용이 드러난다.',
          effects: [
            imfFx.supportMerchantBanks({
              amount: 1.5,
              viaBranches: false,
              drainFactor: 0.95,
              label: '한국은행 외화대출 1.5억달러(공표)',
            }),
            flag('reserves_disclosed'),
            confidence(-2, '보유액 감소 공표 — 단기 충격'),
            imfFx.adjustRollover({ deltaPct: 2, reason: '지원 경로 투명화' }),
          ],
          expert: {
            rating: 82,
            rationale:
              '같은 돈을 쓰더라도 그 비용이 보이는 쪽을 골라야 한다. 공표 보유액이 함께 줄면 정책 결정자와 시장이 동시에 한계를 인식하게 되고, 그것이 11월에 62억달러를 더 쓰지 않게 만드는 유일한 장치다. 감사원 특별감사가 지적한 "대응 지연"의 근인이 바로 이 계기의 부재였다.',
            sourceRefs: [S.audit, S.hearing],
          },
          consequences:
            '지원과 함께 보유액 감소가 공표되었습니다. 시장은 놀랐지만, 처음으로 우리 자신도 남은 실탄을 정확히 세고 있습니다.',
          feasibility: {
            basis: '한국은행법상 금융기관 외화대출과 보유액 통계 기준 변경 모두 당국 재량',
            sourceRefs: [S.bokAct],
          },
        },
        {
          id: 't1-d1-c',
          label: '지원 거절 — 해당 종금사를 정리 절차로 보낸다',
          description:
            '외화 채무불이행을 감수하고 해당 종금사를 정리한다. 보유액은 한 푼도 쓰지 않는다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 1,
              rolloverShockPct: 6,
              drainFactor: 1.15,
              label: '종금사 1개사 정리 — 대외 채무불이행 발생',
            }),
            confidence(-8, '한국 금융기관의 첫 대외 채무불이행'),
            regulator({ set: 2 }, '대외 채무불이행 발생 — 신인도 경보 상향'),
          ],
          expert: {
            rating: 22,
            rationale:
              '보유액을 아끼는 것은 맞지만, 한국 금융기관의 첫 대외 채무불이행은 나머지 29개사의 차입선을 동시에 닫는다. 정리 자체가 틀린 것이 아니라 **승계 기구 없이 하는 정리**가 틀렸다. 12월 2일의 9개사 일괄 정지가 롤오버 붕괴를 가속한 것과 같은 구조다.',
            sourceRefs: [S.susp, S.kdi],
          },
          consequences:
            '해당 종금사가 외화 채무를 이행하지 못했습니다. 다음 날 아침 외국 은행 세 곳이 다른 종금사에 대한 한도를 전면 취소했습니다.',
          irreversible: true,
          feasibility: {
            basis: '종합금융회사 업무정지는 재정경제원 처분 사항',
            sourceRefs: [S.susp],
          },
        },
      ],
    },
    {
      id: 't1-d2',
      title: '원화 방어 강도 (2주차)',
      prompt: '홍콩·뉴욕 급락 주간의 개입 규모를 결정하십시오.',
      context:
        '변동폭 상한에 이틀 연속 닿았습니다. 가용외환보유액은 이제 200억달러 아래입니다. 1개월 내 만기 단기외채는 90억달러입니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't1-d2-a',
          label: '방어 강화 — 26억달러 투입',
          description:
            '아시아 전역의 쏠림이므로 여기서 밀리면 원화만 표적이 된다고 보고 개입을 늘린다.',
          effects: [
            imfFx.intervene({ amount: 26.0, label: '현물환 개입 26억달러' }),
            imfFx.fxStep({ close: 964.6, baseline: 26.0, bandDays: 5, freeFloatPremiumPct: 3 }),
          ],
          expert: {
            rating: 32,
            rationale:
              '두 주 만에 누적 48억달러다. 가용보유액의 5분의 1이 나갔는데 환율은 924원에서 965원으로 밀렸다. 방어의 효율이 이미 나빠지고 있다는 신호였고, 이 시점의 계기를 놓친 것이 감사원이 지적한 "대응 지연"의 실질적 내용이다.',
            historicalNote: '실제로 10월 말까지 방어가 계속되었다.',
            sourceRefs: [S.audit, S.bok],
          },
          consequences:
            '원/달러 964.6원 마감. 누적 개입 48억달러. 가용외환보유액은 173억달러대로 내려왔습니다.',
          historical: true,
        },
        {
          id: 't1-d2-b',
          label: '개입을 절반으로 줄이고 변동폭 상단 절하를 허용',
          description:
            '13억달러만 쓰고 나머지는 시장에 맡긴다. 절하 속도는 빨라지지만 실탄이 남는다.',
          effects: [
            imfFx.intervene({ amount: 13.0, label: '현물환 개입 13억달러' }),
            imfFx.fxStep({ close: 964.6, baseline: 26.0, bandDays: 5, freeFloatPremiumPct: 3 }),
            flag('defence_limited'),
          ],
          expert: {
            rating: 76,
            rationale:
              '보유액을 절반만 쓰고 절하를 받아들이는 쪽이 11월의 선택지를 넓힌다. 다만 변동폭이 ±2.25%로 유지되는 한 절하가 하루치 상한에 막혀 시장이 청산되지 않는다 — 제도 변경과 함께 가야 완성된다.',
            sourceRefs: [S.ieo, S.band],
          },
          consequences:
            '환율은 변동폭 상단에 닿은 채 마감했습니다. 매도 주문 잔량이 남았습니다. 가용보유액 13억달러를 아꼈습니다.',
        },
        {
          id: 't1-d2-c',
          label: '개입 중단 + 일일변동폭 ±10% 확대를 동시 발표',
          description:
            '변동폭 확대 고시와 개입 중단을 한 자료에 담고, 가용·총액 보유액 수치를 함께 공개한다. 3영업일 안에 준비 가능하다.',
          effects: [
            imfFx.setBand({ pct: 10, label: '일일변동폭 ±10% 확대' }),
            imfFx.fxStep({ close: 964.6, baseline: 26.0, bandDays: 5, freeFloatPremiumPct: 3 }),
            flag('reserves_disclosed'),
            confidence(-6, '방어 포기와 보유액 공개의 동시 충격'),
            imfFx.adjustRollover({ deltaPct: 2, reason: '수치를 동반한 제도 변경' }),
          ],
          expert: {
            rating: 72,
            rationale:
              '실제로 11월 19일에 나온 조치를 3주 앞당기는 것이다. 가용보유액이 200억달러 남아 있을 때 하는 변동폭 확대와 72억달러 남았을 때 하는 변동폭 확대는 전혀 다른 조치다. 다만 IMF 프로그램 없이 단독으로 하면 절하 폭을 스스로 멈출 수단이 없다는 것이 위험이다.',
            sourceRefs: [S.band, S.stab, S.ieo],
          },
          consequences:
            '변동폭이 ±10%로 확대되었습니다. 환율은 크게 밀렸고 보유액은 보전되었습니다. 수출업계는 환영했고, 외화부채가 있는 대기업 재무담당들의 전화가 빗발칩니다.',
          feasibility: {
            basis: '변동폭은 재정경제원 고시 — 실제로 1997-11-19에 같은 방식으로 확대되었다',
            sourceRefs: [S.band],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      text: '해외점포 예치는 공표 보유액을 줄이지 않습니다. 그래서 편하고, 그래서 위험합니다. 괴리 지표를 보십시오.',
      decisionId: 't1-d1',
      cardRefs: ['korea-crisis-toolkit'],
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'contingency-funding-plan'],
}

// =================================================================================================
// T2 — 1997-11-05(수) "가용 20억달러" 보도 — 일중 4틱
// =================================================================================================
const t2Interrupt: Interrupt<CentralBankState> = {
  id: 't2-i1',
  interrupt: true,
  atTick: 1,
  deadlineTick: 2,
  timeoutSec: 45,
  defaultOptionId: 't2-i1-defer',
  scoreWeight: 0.5,
  required: false,
  title: '종합금융회사 사장 직통 전화',
  prompt: '오늘 밤 만기인 외화 CP 2억달러를 막지 못한다는 전화입니다. 어떻게 답하겠습니까?',
  source: {
    kind: 'call',
    caller: '대형 종합금융회사 사장',
    agency: '종합금융회사',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '종합금융회사 사장',
      text: '오늘 뉴욕 마감 전에 2억달러를 막아야 합니다. 아침 보도 때문에 라인이 전부 닫혔습니다. 열 군데에 전화했는데 한 군데도 받지 않습니다.',
    },
    {
      speaker: '종합금융회사 사장',
      text: '우리가 못 갚으면 한국 금융기관의 첫 대외 부도입니다. 그다음은 아실 겁니다. 결정해 주십시오.',
    },
  ],
  dimensions: ['liquidity', 'policy'],
  options: [
    {
      id: 't2-i1-branch',
      label: '해외점포 예치로 즉시 막는다',
      description: '한국은행이 해당 종금사 해외점포에 1.5억달러를 예치해 오늘 밤 만기를 막는다.',
      effects: [
        imfFx.depositAtBranches({
          amount: 1.5,
          reason: '종금사 외화 CP 만기',
          label: '해외점포 외화예치 1.5억달러',
        }),
        counter('interruptBranchSupport', 1),
      ],
      expert: {
        rating: 35,
        rationale:
          '오늘 밤의 부도는 막지만 가용보유액만 줄고 공표 보유액은 그대로여서 아무도 비용을 보지 못한다. 이 전화가 두 달간 반복되면서 괴리가 만들어졌다.',
        sourceRefs: [S.hearing],
      },
      consequences: '만기를 막았습니다. 사장은 다음 주에 또 전화하겠다고 했습니다.',
      historical: true,
    },
    {
      id: 't2-i1-conditional',
      label: '지원하되 자구계획·합병 각서를 조건으로 건다',
      description:
        '같은 1.5억달러를 지원하되 2주 내 자구계획 제출과 합병 협의 개시를 서면 조건으로 붙인다.',
      effects: [
        imfFx.depositAtBranches({
          amount: 1.5,
          reason: '종금사 외화 CP 만기(조건부)',
          label: '조건부 해외점포 예치 1.5억달러',
        }),
        flag('conditional_support'),
        counter('conditionalSupport', 1),
        imfFx.adjustDrain({ factor: 0.96, reason: '지원에 조건을 붙여 도덕적 해이 억제' }),
      ],
      expert: {
        rating: 72,
        rationale:
          '지원 자체는 불가피했더라도 조건 없는 지원은 다음 전화를 부른다. 조건을 붙이면 같은 돈으로 정리 준비가 함께 진행된다.',
        sourceRefs: [S.loi3, S.kdi],
      },
      consequences:
        '각서에 서명을 받고 지원했습니다. 사장은 "이건 사실상 정리 통보 아니냐"고 물었습니다.',
    },
    {
      id: 't2-i1-defer',
      label: '오늘은 답하지 않고 실태 파악 후 회신한다',
      description: '즉답을 피하고 감독 부서의 실태 파악 뒤 결정하겠다고 답한다.',
      effects: [
        counter('interruptDeferred', 1),
        confidence(-3, '지원 여부 불확실 — 종금사 차입선 추가 축소'),
        imfFx.adjustRollover({ deltaPct: -2, reason: '지원 방침 불확실' }),
      ],
      expert: {
        rating: 25,
        rationale:
          '오늘 밤 만기에 "내일 답하겠다"는 답은 거절과 같다. 정보 공백은 채권은행이 최악을 가정하게 만든다(보정 규칙 §6.4 정보 공백 ×1.2).',
        sourceRefs: [S.ieo],
      },
      consequences:
        '회신을 미뤘습니다. 해당 종금사는 다른 종금사에서 콜을 끌어와 겨우 막았고, 그 사실이 시장에 퍼졌습니다.',
    },
    {
      id: 't2-i1-refuse',
      label: '지원을 거절하고 정리 원칙을 통보한다',
      description: '한 곳도 예외 없이 정리 원칙을 적용하겠다고 밝힌다.',
      effects: [
        imfFx.suspendMerchantBanks({
          count: 1,
          rolloverShockPct: 7,
          drainFactor: 1.2,
          label: '종금사 1개사 정리 — 대외 부도',
        }),
        confidence(-10, '한국 금융기관의 첫 대외 채무불이행'),
      ],
      expert: {
        rating: 18,
        rationale:
          '원칙은 옳지만 시점이 최악이다. 가용보유액이 아직 170억달러 남았고 승계 기구도 없는 상태에서의 첫 대외 부도는 나머지 종금사의 라인을 같은 날 닫는다.',
        sourceRefs: [S.susp, S.kdi],
      },
      consequences:
        '해당 종금사가 만기를 이행하지 못했습니다. 뉴욕 시장이 열리자마자 한국물 가산금리가 크게 벌어졌습니다.',
      irreversible: true,
    },
  ],
}

export const t2: T = {
  id: 't2',
  label: 'T2',
  timeLabel: '1997년 11월 5일(수) · 일중 · KST',
  title: '"가용 20억달러" — 보도가 먼저 도착한 날',
  time: '1997-11-05T09:00:00+09:00',
  ticks: 4,
  tickLabels: ['09:30 개장', '11:20', '14:00', '16:00 종가'],
  entryEffects: [
    {
      id: 't2-x1-stress',
      effects: [imfFx.setExternalStress({ rolloverPct: 85, dueThisMonth: 95, shortTermDebt: 895 })],
      description: '롤오버율 85%',
    },
    {
      id: 't2-x2-market',
      effects: [
        imfFx.marketMove({ spreadBp: 40, fundingStressBp: 35 }),
        confidence(-8, '가용외환보유액 보도 — 당국이 숨긴 숫자가 있다는 인식'),
      ],
      description: '보도 충격',
    },
  ],
  eachTick: [
    {
      id: 't2-tick-drain',
      effects: [
        imfFx.runoffStep({
          total: 0.1,
          profile: [0.4, 0.25, 0.2, 0.15],
          label: '일중 대외 유출',
        }),
      ],
      description: '대외 유출(일중 배분)',
    },
  ],
  tickEffects: [
    {
      id: 't2-tick0-morning',
      atTick: 0,
      effects: [imfFx.intervene({ amount: 8.0, label: '오전 방어 개입 8억달러' })],
      description: '개장 직후 오전 방어(외환시장과의 상시 대응)',
    },
    {
      id: 't2-tick3-close',
      atTick: 3,
      effects: [imfFx.fxSettle({ close: 969.7, baseline: 10.0, bandDays: 1 })],
      description: '종가 확정',
    },
  ],
  ticker: {
    series: [
      { path: 'institution.fx.spot', mode: 'absolute', values: [964.6, 966.5, 968.4, 968.4] },
      { path: 'market.fxUsdLocal', mode: 'absolute', values: [964.6, 966.5, 968.4, 968.4] },
      { path: 'market.equityIndex', mode: 'relative', values: [474, 462, 452, 449] },
      { path: 'institution.sovereign.spreadBp', mode: 'absolute', values: [0, 12, 22, 28] },
    ],
  },
  events: [
    {
      id: 't2-news-bloomberg',
      kind: 'newswire',
      outlet: 'Bloomberg',
      time: '09:05',
      headline: '"한국의 가용외환보유액이 20억달러 수준일 수 있다" — 당국은 확인 거부',
      body: '통신은 익명의 소식통을 인용해 한국의 즉시 사용 가능한 외환보유액이 공표치 300억달러대와 크게 다를 수 있다고 보도했다. 재정경제원과 한국은행은 확인을 거부했다. 보도된 20억달러라는 수치의 산출 근거는 제시되지 않았다.',
      severity: 'critical',
      reliability: 'unconfirmed',
      atTick: 0,
      sourceRefs: [S.bloomberg],
      relatedMetrics: ['usableReserves', 'grossReserves', 'reserveGap'],
    },
    {
      id: 't2-data-internal',
      kind: 'data',
      time: '09:40',
      atTick: 0,
      title: '내부 확인 — 보도와 실제',
      rows: [
        { label: '보도된 수치(미확인)', value: '가용 20억달러' },
        { label: '실제 가용외환보유액', value: '약 173억달러' },
        { label: '총외환보유액(공표 기준)', value: '약 285억달러' },
        { label: '괴리(해외점포 예치 등)', value: '약 112억달러' },
        { label: '1개월 내 만기 단기외채', value: '95억달러' },
      ],
      severity: 'critical',
      sourceRefs: [S.hearing, S.res, S.debt],
    },
    {
      id: 't2-dialogue-desk',
      kind: 'dialogue',
      time: '11:05',
      atTick: 1,
      title: '외환시장 데스크 보고 (재구성)',
      lines: [
        {
          speaker: '한국은행 외환시장팀',
          text: '오전에 8억달러를 팔았습니다. 호가가 얇습니다. 역외에서 들어오는 매수가 계속됩니다.',
        },
        {
          speaker: '정책담당',
          text: '보도 때문입니까.',
        },
        {
          speaker: '한국은행 외환시장팀',
          text: '보도 자체보다, 우리가 부인도 확인도 하지 않는다는 점 때문입니다. 딜러들이 "숫자가 있으면 왜 안 보여 주느냐"고 합니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.bloomberg],
    },
    {
      id: 't2-memo-afternoon',
      kind: 'memo',
      time: '13:30',
      atTick: 2,
      from: '한국은행 외환국',
      to: '정책담당',
      subject: '오후 개입 판단 요청',
      body: '오전 8억달러로 968원 부근을 지켰습니다. 오후에도 같은 강도로 가면 추가 6~8억달러가 필요합니다. 개입을 멈추면 오늘 변동폭 상한(986.3원)까지 밀릴 수 있습니다. 상한에 닿으면 거래가 성립하지 않고 매도 잔량이 다음 날로 넘어갑니다.',
      severity: 'warning',
      sourceRefs: [S.bok, S.band],
      relatedMetrics: ['usableReserves', 'fxSpot'],
    },
  ],
  decisions: [
    {
      id: 't2-d1',
      title: '가용외환보유액 공개 여부',
      prompt: '보도에 어떻게 대응하시겠습니까?',
      context:
        '보도된 20억달러는 사실이 아닙니다. 실제 가용은 약 173억달러입니다. 그러나 공표치 285억달러와도 다릅니다. 무엇을 말하든 "다른 숫자가 있었다"는 사실은 드러납니다.',
      dimensions: ['communication', 'policy'],
      requiredConcepts: ['crisis-communication'],
      options: [
        {
          id: 't2-d1-a',
          label: '총외환보유액만 재확인하고 보도는 근거 없다고 반박',
          description:
            '공표 보유액 285억달러를 다시 밝히고 보도를 부인한다. 가용 개념은 언급하지 않는다.',
          effects: [confidence(-3, '부인만 하고 수치를 제시하지 못함'), flag('denial_only')],
          expert: {
            rating: 30,
            rationale:
              '보도의 수치는 틀렸지만 보도의 문제의식은 옳았다. 공표치만 되풀이하는 부인은 "가용이라는 개념 자체가 있다"는 사실만 확인시켜 준다. 실제로 이후 모든 발표의 신뢰가 여기서 깎였다.',
            historicalNote: '당국은 보도를 확인하지 않았고 가용 계열도 공표하지 않았다.',
            sourceRefs: [S.bloomberg, S.ieo],
          },
          consequences:
            '부인 성명이 나갔습니다. 오후 딜링룸에서는 "그럼 진짜 숫자는 얼마냐"는 질문만 남았습니다.',
          historical: true,
        },
        {
          id: 't2-d1-b',
          label: '가용과 총액을 모두 정의와 함께 공개한다',
          description:
            '총외환보유액 285억달러, 가용외환보유액 173억달러, 차이의 성격(해외점포 예치)을 정의와 함께 공개하고 이후 주간 단위로 계속 공표하겠다고 밝힌다.',
          effects: [
            flag('reserves_disclosed'),
            confidence(-5, '괴리 공개의 즉각적 충격'),
            imfFx.adjustRollover({ deltaPct: 4, reason: '가용 개념 공개 — 검증 가능성 확보' }),
            imfFx.adjustDrain({ factor: 0.92, reason: '정보 비대칭 해소' }),
            counter('transparencySteps', 1),
          ],
          expert: {
            rating: 85,
            rationale:
              '이 시나리오에서 가장 중요한 한 수다. 당일에는 신뢰가 더 떨어지지만, 가용 개념이 공개된 순간부터 정책 결정자 자신이 남은 실탄을 세게 된다 — 11월에 62억달러를 더 쓰는 선택이 내부적으로 통과되기 어려워진다. IMF 사후평가는 한국 위기에서 보유액 정보 비대칭이 프로그램 실패의 초기 원인이었다고 명시했고, 감사원 특별감사도 같은 지점을 지적했다.',
            sourceRefs: [S.ieo, S.audit, S.hearing],
          },
          consequences:
            '가용 173억달러가 공개되었습니다. 환율은 더 밀렸고 주가는 더 떨어졌습니다. 그러나 오후에 외국 은행 서울지점장 세 명이 "이제 본점을 설득할 자료가 생겼다"고 연락해 왔습니다.',
          calibrationNote: 'ΔCI −5, 롤오버 +4%p, 유출 계수 ×0.92 [CAL: 검증 가능 정보 공개]',
          feasibility: {
            basis: '보유액 통계 공표 기준은 당국 재량 — IMF 특별자료공표기준(SDDS) 이전 시점',
            sourceRefs: [S.res, S.ara],
          },
        },
        {
          id: 't2-d1-c',
          label: '"보유액은 충분하며 어떤 상황에도 대응 가능하다"고 강한 어조로 발표',
          description:
            '수치를 제시하지 않고 대응 능력을 강조한다. 준비 시간이 필요 없고 즉시 낼 수 있다.',
          effects: [
            confidence(-6, '수치 없는 강한 안심 발언 — 모순 시 증폭'),
            flag('unqualified_reassurance'),
            imfFx.adjustDrain({ factor: 1.12, reason: '검증 불가능한 안심 발언' }),
            imfFx.adjustRollover({ deltaPct: -3, reason: '발언과 시장 관측의 불일치' }),
          ],
          expert: {
            rating: 12,
            rationale:
              '보정 규칙표에서 "수치 없는 안심 발언"은 −3이고, 이후 사실과 모순되면 증폭 ×1.5가 붙는다. 6주 뒤 IMF에 손을 내미는 순간 이 발언이 모든 후속 발표의 신뢰를 무너뜨린다. 2011년 저축은행의 "추가 영업정지 없다"와 같은 구조의 실수다.',
            sourceRefs: [S.ieo, S.audit],
          },
          consequences:
            '강한 어조의 발표가 나갔습니다. 오후 한때 환율이 진정되었습니다. 이 문장은 12월에 여러 번 다시 인용됩니다.',
          trap: true,
          trapExplanation:
            '"충분하다"는 말은 오늘 가장 싸고 6주 뒤 가장 비싸다. 검증할 수 없는 안심은 사실과 충돌하는 날 증폭기로 바뀐다.',
          remediationCard: 'crisis-communication',
        },
      ],
    },
    {
      id: 't2-d2',
      title: '오후 개입 판단',
      prompt: '오후장에서 개입을 계속하시겠습니까? (14:00까지 결정)',
      context:
        '오전에 8억달러를 썼습니다. 오늘 변동폭 상한은 986.8원입니다. 상한에 닿으면 거래가 성립하지 않습니다.',
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't2-d2-stop',
      timeLimitSec: 120,
      dimensions: ['marketRisk', 'timeliness'],
      options: [
        {
          id: 't2-d2-add',
          label: '오후에 2억달러를 추가 투입해 970원선을 지킨다',
          description: '오전과 같은 강도를 유지하지 않고 마감 무렵에만 개입한다.',
          effects: [imfFx.intervene({ amount: 2.0, label: '오후 개입 2억달러' })],
          expert: {
            rating: 45,
            rationale:
              '하루 10억달러는 당시 기준으로 통상적이었다. 문제는 이 하루가 40일 동안 반복되었다는 것이다.',
            historicalNote: '11월 5일의 개입은 통상 수준이었다.',
          },
          consequences: '969.7원에서 마감했습니다. 오늘 하루 10억달러를 썼습니다.',
          historical: true,
        },
        {
          id: 't2-d2-heavy',
          label: '오후에 8억달러를 더 투입해 보도를 정면으로 반박한다',
          description: '보유액이 넉넉하다는 것을 행동으로 보여 준다.',
          effects: [
            imfFx.intervene({ amount: 8.0, label: '오후 대규모 개입 8억달러' }),
            counter('showOfForce', 1),
          ],
          expert: {
            rating: 18,
            rationale:
              '보도에 개입으로 답하는 것은 "우리가 쓸 수 있는 돈이 얼마인지 세어 보라"는 초대장이다. 역외 딜러들은 당일 개입 규모를 추정해 가용보유액을 역산한다.',
            sourceRefs: [S.bloomberg, S.ieo],
          },
          consequences:
            '환율은 966원까지 되밀렸습니다. 저녁 역외 시장에서 "오늘 서울이 16억달러를 썼다"는 추정이 돌았습니다.',
          trap: true,
          trapExplanation:
            '보도를 행동으로 반박하면 반박의 크기가 곧 남은 실탄의 힌트가 된다. 방어는 조용할 때만 효과가 있다.',
        },
        {
          id: 't2-d2-stop',
          label: '오후 개입을 중단하고 변동폭 상한까지 밀리도록 둔다',
          description: '오늘 남은 시간은 시장에 맡긴다. 상한에 닿으면 닿는 대로 둔다.',
          effects: [flag('afternoon_no_intervention'), counter('restraintDays', 1)],
          expert: {
            rating: 70,
            rationale:
              '보유액을 아끼는 쪽이 옳다. 다만 ±2.25% 변동폭 아래에서는 상한에 닿아도 시장이 청산되지 않고 매도 잔량만 다음 날로 넘어간다 — 제도를 바꾸지 않는 한 절반의 조치다.',
            sourceRefs: [S.band, S.ieo],
          },
          consequences:
            '환율은 상한 부근에서 마감했습니다. 매도 잔량이 남았고, 가용보유액 2억달러를 아꼈습니다.',
        },
      ],
    },
  ],
  interrupts: [t2Interrupt],
  advisorHints: [
    {
      level: 3,
      text: '보도된 20억달러는 틀렸지만 "가용"이라는 개념이 존재한다는 지적은 맞습니다. 틀린 수치를 부인하는 것과 맞는 수치를 공개하는 것은 다른 일입니다.',
      decisionId: 't2-d1',
      cardRefs: ['crisis-communication'],
    },
  ],
  relatedCards: ['crisis-communication', 'korea-crisis-toolkit'],
}

// =================================================================================================
// T3 — 1997-11-10(월) ~ 11-17(월) "1,000원"
// =================================================================================================
export const t3: T = {
  id: 't3',
  label: 'T3',
  timeLabel: '1997년 11월 10일(월) ~ 17일(월) · 6영업일 · KST',
  title: '1,000원 — 방어선과 만기의 경주',
  time: '1997-11-10T09:00:00+09:00',
  entryEffects: [
    {
      id: 't3-x1-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 78, dueThisMonth: 110, shortTermDebt: 890 }),
      ],
      description: '롤오버율 78%, 1개월 만기 110억달러로 증가',
    },
    {
      id: 't3-x2-drain',
      effects: [imfFx.runoffStep({ total: 0.2, profile: [1], label: '대외 유출(6영업일)' })],
      description: '대외 유출',
    },
    {
      id: 't3-x3-market',
      effects: [
        imfFx.marketMove({ equityPct: -8, spreadBp: 50, fundingStressBp: 60 }),
        confidence(-6, '1,000원선 접근과 롤오버율 급락'),
      ],
      description: '시장 악화',
    },
  ],
  events: [
    {
      id: 't3-data-crossover',
      kind: 'data',
      time: '11/10 09:00',
      title: '경고 — 가용외환보유액과 1개월 만기 단기외채',
      rows: [
        { label: '가용외환보유액', value: '약 161억달러' },
        { label: '1개월 내 만기 단기외채', value: '110억달러' },
        { label: '단기외채 롤오버율', value: '78% (2주 전 88%)' },
        { label: '이번 달 예상 순상환액', value: '약 24억달러 (110 × 22%)' },
        { label: '총외환보유액(공표)', value: '약 281억달러' },
      ],
      severity: 'critical',
      sourceRefs: [S.debt, S.hearing, S.ara],
      relatedMetrics: ['usableReserves', 'stDebtDue30d', 'guidottiRatio', 'rolloverRatePct'],
    },
    {
      id: 't3-memo-bok-warning',
      kind: 'memo',
      time: '11/11 08:30',
      from: '한국은행 부총재보',
      to: '재정경제원 차관 · 정책담당',
      subject: '[대외비] 가용외환보유액 추이와 대외지원 검토 필요성',
      body: `지난 8월 이후 같은 내용을 반복해 보고드립니다.

1. 가용외환보유액이 10월 21일 223억달러에서 오늘 161억달러로 줄었습니다. 4주에 62억달러입니다.
2. 같은 기간 총외환보유액은 305억달러에서 281억달러로 24억달러 줄었습니다. **우리가 쓴 돈의 3분의 1만 공표치에 나타납니다.**
3. 현재 속도가 유지되면 12월 중순에 가용이 한 자릿수대에 들어갑니다.
4. 국제통화기금 대기성차관은 요청에서 이사회 승인까지 통상 2~4주가 걸립니다. **지금 요청해도 12월 초입니다.**

방어를 계속할지 여부와 무관하게, 대외지원 요청 준비는 지금 시작해야 합니다.`,
      severity: 'critical',
      sourceRefs: [S.audit, S.hearing, S.sba],
      cardRefs: ['contingency-funding-plan', 'regulator-escalation-ladder'],
      relatedMetrics: ['usableReserves', 'reserveGap'],
    },
    {
      id: 't3-news-1000',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '11/17 15:40',
      headline: '원/달러 1,000원 돌파 — 변동폭 상한에서 거래 마감',
      body: '원/달러 환율이 1,008.6원으로 마감하며 1,000원선이 무너졌다. 시장에서는 당국이 방어를 중단한 것으로 받아들이고 있다. 일일변동폭 상한에 닿아 매도 잔량이 남은 채 거래가 끝났다.',
      severity: 'critical',
      sourceRefs: [S.rate, S.herald],
      relatedMetrics: ['fxSpot'],
    },
  ],
  decisions: [
    {
      id: 't3-d1',
      title: '국제통화기금 지원 요청 시점',
      prompt:
        '한국은행이 대외지원 요청 준비를 건의했습니다. 지금 움직이시겠습니까? (이 결정의 핵심은 내용이 아니라 시점입니다)',
      context:
        '요청에서 이사회 승인까지 2~4주입니다. 오늘 요청하면 12월 초, 2주 뒤 요청하면 12월 중순에 첫 자금이 들어옵니다. 가용외환보유액은 161억달러이고 12월 만기는 그보다 큽니다.',
      dimensions: ['policy', 'timeliness'],
      requiredConcepts: ['korea-crisis-toolkit', 'regulator-escalation-ladder'],
      options: [
        {
          id: 't3-d1-a',
          label: '아직 요청하지 않는다 — 자체 대책과 양자 협의를 먼저 시도',
          description:
            '국제통화기금 요청은 주권적·정치적 비용이 크다고 보고, 미국·일본과의 양자 협의와 국내 대책을 먼저 추진한다.',
          effects: [
            flag('imf_deferred'),
            counter('bilateralAttempts', 1),
            confidence(-2, '대외지원 방침 부재'),
          ],
          expert: {
            rating: 25,
            rationale:
              '실제 선택이며, 11월 21일까지 열흘이 더 걸렸다. 그 열흘 동안 가용보유액이 약 88억달러 줄었다. 양자 지원은 결국 국제통화기금 프로그램의 2선(233억달러)으로 들어왔을 뿐 프로그램보다 먼저 오지 않았다. IMF 사후평가는 요청 지연이 프로그램 규모를 키우고 조건을 가혹하게 만들었다고 본다.',
            historicalNote: '실제 구제금융 신청은 1997년 11월 21일이었다.',
            sourceRefs: [S.ieo, S.audit, S.sba],
          },
          consequences:
            '요청을 미뤘습니다. 재무장관 회담 일정을 조율하는 동안 롤오버율은 계속 내려갑니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '"조금 더 버티면 안 해도 될지 모른다"는 것이 이 지연의 논리였다. 그러나 지연의 비용은 매일 가용보유액으로 지불되었고, 협상력은 보유액과 함께 줄었다. 이 시나리오의 두 타이밍 교훈 중 첫 번째다.',
          remediationCard: 'regulator-escalation-ladder',
        },
        {
          id: 't3-d1-b',
          label: '지금 국제통화기금에 대기성차관을 공식 요청한다',
          description:
            '오늘 요청 의사를 전달하고 실무 협의를 시작한다. 12월 초 이사회 승인을 목표로 한다. 요청 사실은 공개한다.',
          effects: [
            imfFx.imfStage({ stage: 'requested', label: '국제통화기금 대기성차관 요청' }),
            confidence(4, '대외지원 경로 확보 — 불확실성 축소'),
            imfFx.adjustRollover({ deltaPct: 6, reason: '프로그램 요청 공개' }),
            imfFx.adjustDrain({ factor: 0.88, reason: '지원 도래 예상' }),
            regulator({ set: 2 }, '국제통화기금 프로그램 요청'),
          ],
          expert: {
            rating: 90,
            rationale:
              '일주일 먼저 요청하는 것만으로 가용보유액 수십억달러가 남고, 그만큼 협상에서 조건을 다툴 여지가 생긴다. IMF 사후평가의 결론이 정확히 이것이다 — 늦게 온 나라일수록 조건이 가혹했다. 정치적 비용은 실재했지만, 12월 3일 합의서의 조건이 그 비용보다 컸다.',
            sourceRefs: [S.ieo, S.sba, S.audit],
          },
          consequences:
            '요청 사실이 공개되었습니다. 주가는 하루 더 떨어졌지만 외국 은행들의 한도 축소 속도가 눈에 띄게 느려졌습니다.',
          calibrationNote: '롤오버 +6%p, 유출 계수 ×0.88 [CAL: 프로그램 요청의 발표 효과]',
          feasibility: {
            basis: '대기성차관 요청은 회원국 재무장관·중앙은행 총재 명의 서한으로 즉시 가능',
            sourceRefs: [S.sba],
          },
        },
        {
          id: 't3-d1-c',
          label: '요청 준비만 비공개로 진행하고 발표는 미룬다',
          description:
            '실무진을 워싱턴에 보내되 요청 사실은 공개하지 않는다. 시장 충격을 피하면서 시간을 번다.',
          effects: [
            flag('imf_prepared_quietly'),
            counter('quietPrep', 1),
            imfFx.adjustDrain({ factor: 0.97, reason: '내부 준비 착수' }),
          ],
          expert: {
            rating: 58,
            rationale:
              '준비를 시작한다는 점에서 아무것도 하지 않는 것보다 낫다. 그러나 발표 효과가 없으므로 롤오버는 계속 떨어지고, 비공개 실무 협의가 언론에 새면 "숨겼다"는 프레임이 추가된다. 실제로 11월 중순의 협의설은 계속 보도되었다.',
            sourceRefs: [S.ieo, S.herald],
          },
          consequences:
            '실무진이 조용히 출발했습니다. 이틀 뒤 한 통신사가 "한국이 국제통화기금과 접촉 중"이라고 보도했고, 당국은 이를 부인했습니다.',
        },
      ],
    },
    {
      id: 't3-d2',
      title: '종금사 외화 만기 집중 대응',
      prompt: '이번 주 종금사 외화 만기가 집중됩니다. 어떻게 하시겠습니까?',
      context:
        '롤오버율이 78%로 떨어졌습니다. 종금사 외화조달 200억달러 중 단기가 60%이므로 이번 달 만기만 약 40억달러입니다.',
      dimensions: ['liquidity', 'policy'],
      options: [
        {
          id: 't3-d2-a',
          label: '해외점포 예치를 계속 늘려 전부 막는다',
          description: '지금까지의 방식을 유지한다. 공표 보유액은 줄지 않는다.',
          effects: [
            imfFx.supportMerchantBanks({
              amount: 4.0,
              viaBranches: true,
              drainFactor: 1.0,
              label: '해외점포 예치 4억달러',
            }),
            flag('branch_deposit_policy'),
          ],
          expert: {
            rating: 28,
            rationale:
              '가용보유액이 160억달러 남짓인데 그중 4억달러를 다시 보이지 않는 곳에 넣는다. 12월 중순 39억달러의 상당 부분이 이 결정들의 누적이다.',
            sourceRefs: [S.hearing, S.audit],
          },
          consequences:
            '이번 주 만기는 넘겼습니다. 괴리가 더 벌어졌고, 대시보드의 두 숫자 차이는 이제 120억달러를 넘습니다.',
          historical: true,
        },
        {
          id: 't3-d2-b',
          label: '부실 종금사 8개사를 선별 정지하고 나머지에만 지원을 집중',
          description:
            '자기자본 잠식 종금사를 정지시키고 예금·외화채무 승계 방침을 함께 발표한다. 남은 종금사에는 지원을 집중한다.',
          effects: [
            imfFx.suspendMerchantBanks({
              count: 8,
              rolloverShockPct: 8,
              drainFactor: 0.78,
              label: '종금사 8개사 선별 업무정지(승계 방침 동반)',
            }),
            imfFx.supportMerchantBanks({
              amount: 2.0,
              viaBranches: false,
              drainFactor: 0.95,
              label: '잔존 종금사 외화 지원 2억달러(공표)',
            }),
            confidence(-4, '종금사 정지 — 단기 충격'),
            flag('selective_resolution'),
            counter('earlyResolution', 1),
          ],
          expert: {
            rating: 84,
            rationale:
              '실제로 12월 2일과 12월 10일에 한 일을 3주 먼저, 승계 방침과 함께 하는 것이다. 정지의 충격은 같지만 (a) 가용보유액이 아직 161억달러 남아 있을 때이고, (b) 승계 방침이 동반되면 롤오버 거부의 범위가 정지 대상에 한정된다. 12월에는 이 두 조건이 모두 없었다.',
            sourceRefs: [S.susp, S.kdi, S.ieo],
          },
          consequences:
            '8개사가 정지되었습니다. 해당 사의 외화채무는 승계 기구가 인수한다고 발표했습니다. 나머지 22개사의 차입선은 유지되었습니다.',
          irreversible: true,
          feasibility: {
            basis: '종합금융회사 업무정지는 재정경제원 처분 사항이며 12월에 실제로 집행되었다',
            sourceRefs: [S.susp],
          },
        },
        {
          id: 't3-d2-c',
          label: '종금사 외화채무 전액에 국가보증을 선언한다',
          description:
            '200억달러 전체에 정부 보증을 붙여 롤오버를 되살린다. 국회 동의가 필요하므로 실제 효력은 시차가 있다.',
          effects: [
            flag('blanket_guarantee_early'),
            imfFx.adjustRollover({ deltaPct: 12, reason: '전면 국가보증 선언' }),
            imfFx.adjustDrain({ factor: 0.7, reason: '보증에 따른 롤오버 회복' }),
            confidence(-4, '우발채무 200억달러 — 국가신용 직접 노출'),
            counter('contingentLiability', 200),
          ],
          expert: {
            rating: 48,
            rationale:
              '롤오버는 실제로 되살아난다. 그러나 가용보유액 161억달러인 나라가 200억달러 우발채무를 떠안으면 국가신용등급이 먼저 무너진다 — 실제 12월 22일의 보증은 은행 외화채무에 한정되었고, 그것도 IMF 프로그램이 이미 있는 상태였다. 프로그램 없이 하는 전면 보증은 보증인의 신용을 시험한다.',
            sourceRefs: [S.guar, S.crs],
          },
          consequences:
            '보증 방침이 발표되었습니다. 롤오버율이 하루 만에 반등했습니다. 같은 날 저녁 신용평가사 두 곳이 등급 검토에 착수했다고 통보해 왔습니다.',
        },
      ],
    },
    {
      id: 't3-d3',
      title: '1,000원 방어선',
      prompt: '이번 주 개입 규모를 결정하십시오. 이번 결정이 이 시나리오에서 가장 비쌉니다.',
      context:
        '가용외환보유액 161억달러, 1개월 내 만기 단기외채 110억달러. 방어에 쓸 돈이 갚을 돈보다 겨우 51억달러 많습니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't3-d3-a',
          label: '1,000원을 사수한다 — 58억달러 투입',
          description:
            '6영업일 동안 매일 개입해 1,000원선을 지키다가, 막바지에 방어를 중단한다. 당시 외환시장에서 실행 가능한 최대 강도다.',
          effects: [
            imfFx.intervene({ amount: 58.0, label: '1,000원 방어 개입 58억달러' }),
            imfFx.fxStep({ close: 1008.6, baseline: 58.0, bandDays: 6, freeFloatPremiumPct: 4 }),
            counter('defenceOfLevel', 1),
          ],
          expert: {
            rating: 15,
            rationale:
              '가용보유액의 3분의 1을 한 주에 쓰고도 1,000원은 결국 무너졌다. 이 주간이 끝났을 때 가용은 100억달러 아래로 내려가 1개월 만기(110억달러)보다 적어졌다 — 즉 **방어에 쓸 돈이 그달에 갚을 돈보다 적어진 상태에서 방어를 계속한 것**이다. 감사원 특별감사가 지목한 대응 지연의 핵심 구간이며, IMF 사후평가도 같은 판단이다.',
            historicalNote:
              '11월 17일 1,008.6원 마감으로 1,000원선 방어가 끝났다. 10~11월 누적 환율방어 소진액은 약 151억달러였다.',
            sourceRefs: [S.audit, S.ieo, S.bok],
          },
          consequences:
            '1,000원선은 결국 11월 17일에 무너졌습니다. 가용외환보유액은 100억달러 아래로 내려가, 1개월 내 만기 단기외채 110억달러보다 적어졌습니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '이것이 이 시나리오의 핵심 함정입니다. 당시에는 가장 합리적인 선택으로 보였습니다 — 공표 보유액은 281억달러였고, 1,000원은 상징적인 선이었으며, 아시아 전체가 같은 압력을 받고 있었습니다. 그러나 방어의 재원은 공표 보유액이 아니라 가용보유액이었고, 가용은 이미 그달에 갚아야 할 외채보다 적어지고 있었습니다. 대시보드의 두 숫자를 나란히 보고 있었다면 이 선택은 훨씬 어려웠을 것입니다.',
          remediationCard: 'contingency-funding-plan',
        },
        {
          id: 't3-d3-b',
          label: '방어를 중단하고 변동폭을 ±10%로 확대한다',
          description:
            '개입을 멈추고 변동폭 확대 고시를 낸다. 환율은 크게 밀리지만 가용보유액 전체가 남는다.',
          effects: [
            imfFx.setBand({ pct: 10, label: '일일변동폭 ±10% 확대' }),
            imfFx.intervene({ amount: 6.0, label: '변동성 완화 개입 6억달러' }),
            imfFx.fxStep({ close: 1008.6, baseline: 58.0, bandDays: 6, freeFloatPremiumPct: 4 }),
            confidence(-5, '방어 포기 — 절하 가속'),
            flag('defence_abandoned'),
          ],
          expert: {
            rating: 86,
            rationale:
              '보유액 52억달러를 남긴다. 환율은 더 밀리지만, 12월에 39억달러가 아니라 90억달러 이상을 손에 쥐고 협상에 들어갈 수 있다. 실제로 변동폭 확대는 이틀 뒤(11월 19일)에 나왔다 — 이틀 차이로 58억달러를 더 쓴 셈이다. 이것이 두 번째 타이밍 교훈이다.',
            sourceRefs: [S.band, S.ieo, S.ara],
          },
          consequences:
            '변동폭이 확대되었고 환율은 크게 밀렸습니다. 가용외환보유액은 150억달러 넘게 남았습니다. 수출업계는 환영했고, 외화부채가 있는 대기업들의 항의가 이어집니다.',
          calibrationNote: '개입 6억 vs 기준 58억 → 환율 +3.12% [CAL: 0.06%p/억달러]',
        },
        {
          id: 't3-d3-c',
          label: '방어를 계속하되 해외점포 예치금을 회수해 실탄을 보충한다',
          description:
            '해외점포에 예치된 외화를 회수해 개입 재원으로 쓴다. 회수하면 해당 점포가 자금난에 빠진다.',
          effects: [
            imfFx.releaseBranchDeposits({ amount: 20.0, label: '해외점포 예치금 20억달러 회수' }),
            imfFx.intervene({ amount: 58.0, label: '1,000원 방어 개입 58억달러' }),
            imfFx.fxStep({ close: 1008.6, baseline: 58.0, bandDays: 6, freeFloatPremiumPct: 4 }),
            imfFx.adjustRollover({ deltaPct: -10, reason: '해외점포 자금난 노출' }),
            imfFx.adjustDrain({ factor: 1.35, reason: '해외점포 부도 위험 현실화' }),
            confidence(-10, '해외점포 자금 회수가 알려짐'),
          ],
          expert: {
            rating: 8,
            rationale:
              '가용보유액을 늘리는 유일한 방법처럼 보이지만, 예치금은 이미 해외점포의 지급준비로 쓰이고 있다. 회수하면 그 점포가 즉시 못 갚고, 한국 금융기관 전체의 차입선이 같은 날 닫힌다. 괴리를 만든 것이 실수였다면 그것을 급하게 되돌리는 것은 더 큰 실수다.',
            sourceRefs: [S.hearing, S.audit],
          },
          consequences:
            '예치금 20억달러를 회수했습니다. 이틀 뒤 해당 점포 두 곳이 현지 감독당국에 유동성 부족을 신고했고, 그 사실이 즉시 알려졌습니다.',
          trap: true,
          trapExplanation:
            '"우리 돈이니 되찾아 오면 된다"는 착각. 예치금은 회수 가능한 자산이 아니라 이미 소진된 지원이며, 회수 시도 자체가 부실을 공개하는 행위다.',
          irreversible: true,
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      text: '단기외채 커버리지 지표를 보십시오. 100% 미만이면 보유액으로 1년치 단기외채를 갚을 수 없다는 뜻입니다.',
      decisionId: 't3-d3',
      cardRefs: ['contingency-funding-plan'],
    },
    {
      level: 3,
      text: '가용외환보유액이 1개월 내 만기 단기외채보다 적어지는 순간, 환율 방어는 수단이 아니라 도박이 됩니다. 이번 주 안에 그 선을 넘습니다.',
      decisionId: 't3-d3',
    },
  ],
  relatedCards: ['contingency-funding-plan', 'korea-crisis-toolkit', 'regulator-escalation-ladder'],
}

// =================================================================================================
// T4 — 1997-11-19(수) ~ 11-20(목) 금융시장 안정대책 — 일중 5틱
// =================================================================================================
const t4Interrupt: Interrupt<CentralBankState> = {
  id: 't4-i1',
  interrupt: true,
  atTick: 2,
  deadlineTick: 3,
  timeoutSec: 60,
  defaultOptionId: 't4-i1-consider',
  scoreWeight: 0.5,
  required: false,
  title: '국제통화기금 아시아태평양국 협의단장 전화',
  prompt: '워싱턴에서 직접 전화가 왔습니다. 오늘 저녁까지 답을 달라고 합니다.',
  source: {
    kind: 'call',
    caller: '국제통화기금 협의단장',
    agency: 'International Monetary Fund',
    tone: 'urgent',
  },
  lines: [
    {
      speaker: '국제통화기금 협의단장',
      text: '오늘 발표하신 대책은 봤습니다. 예금 보장과 변동폭 확대는 방향이 맞습니다. 그런데 재원이 어디에 있습니까.',
    },
    {
      speaker: '정책담당',
      text: '외환보유액은 충분합니다.',
    },
    {
      speaker: '국제통화기금 협의단장',
      text: '공표치 말씀이시죠. 저희도 해외점포 예치 관행은 압니다. 지금 요청하시면 12월 첫 주 이사회에 올릴 수 있습니다. 다음 이사회는 12월 중순입니다. 오늘 저녁까지 알려 주십시오.',
    },
  ],
  dimensions: ['policy', 'timeliness'],
  options: [
    {
      id: 't4-i1-request',
      label: '오늘 저녁 공식 요청하겠다고 답한다',
      description: '대기성차관 요청 의사를 즉시 전달하고 12월 첫 주 이사회를 목표로 한다.',
      effects: [
        imfFx.imfStage({ stage: 'requested', label: '국제통화기금 대기성차관 요청(11/19)' }),
        imfFx.adjustRollover({ deltaPct: 4, reason: '프로그램 요청' }),
        counter('imfEarlyRequest', 1),
      ],
      expert: {
        rating: 88,
        rationale:
          '이틀 먼저 요청하는 것만으로 12월 초 이사회 일정에 여유가 생기고, 그 사이 가용보유액 수십억달러가 보전된다. IMF 사후평가의 핵심 권고가 "위기국은 늦게 오기 때문에 조건이 가혹해진다"는 것이다.',
        sourceRefs: [S.ieo, S.sba],
      },
      consequences: '요청 의사를 전달했습니다. 협의단이 주말에 서울에 도착합니다.',
    },
    {
      id: 't4-i1-consider',
      label: '대책의 효과를 며칠 지켜본 뒤 답하겠다고 한다',
      description: '오늘 발표한 대책이 시장에서 작동하는지 확인한 뒤 판단하겠다고 답한다.',
      effects: [counter('imfDelayed', 1), confidence(-2, '대외지원 방침 미정')],
      expert: {
        rating: 30,
        rationale:
          '실제로 답은 이틀 뒤(11월 21일)에 나왔다. 대책의 효과를 기다리는 동안 가용보유액은 매일 줄었고 이사회 일정도 밀렸다.',
        historicalNote: '구제금융 신청은 11월 21일에 발표되었다.',
        sourceRefs: [S.ieo],
      },
      consequences:
        '며칠 여유를 요청했습니다. 협의단장은 "그 며칠이 조건을 정합니다"라고 말하고 전화를 끊었습니다.',
      historical: true,
    },
    {
      id: 't4-i1-bilateral',
      label: '먼저 양자 지원을 타진하겠다고 답한다',
      description: '미국·일본과의 양자 지원을 먼저 타진하겠다고 밝힌다.',
      effects: [
        counter('bilateralAttempts', 1),
        imfFx.adjustRollover({ deltaPct: -3, reason: '지원 경로 불확실' }),
        confidence(-3, '프로그램 없이 양자 지원 시도'),
      ],
      expert: {
        rating: 20,
        rationale:
          '양자 지원은 결국 프로그램의 2선(233억달러)으로만 왔고, 프로그램 없이 단독으로 오지 않았다. 양자 타진에 쓴 시간이 그대로 지연 비용이 되었다.',
        sourceRefs: [S.sba, S.crs],
      },
      consequences:
        '양자 채널을 두드렸습니다. 상대국들의 답은 한결같이 "국제통화기금 프로그램이 먼저"였습니다.',
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '1997년 11월 19일(수) ~ 20일(목) · 일중 · KST',
  title: '금융시장 안정대책 — 그리고 경제팀 경질',
  time: '1997-11-19T09:00:00+09:00',
  ticks: 5,
  tickLabels: [
    '11/19 09:00',
    '11/19 14:00 대책 발표',
    '11/19 18:00',
    '11/20 09:00 개장',
    '11/20 15:00 종가',
  ],
  entryEffects: [
    {
      id: 't4-x1-stress',
      effects: [
        imfFx.setExternalStress({ rolloverPct: 70, dueThisMonth: 120, shortTermDebt: 880 }),
      ],
      description: '롤오버율 70%, 1개월 만기 120억달러',
    },
    {
      id: 't4-x2-market',
      effects: [imfFx.marketMove({ equityPct: 3, spreadBp: 30 })],
      description: '대책 기대에 따른 주가 반등',
    },
  ],
  eachTick: [
    {
      id: 't4-tick-drain',
      effects: [
        imfFx.runoffStep({
          total: 0.1,
          profile: [0.3, 0.2, 0.15, 0.2, 0.15],
          label: '대외 유출(일중 배분)',
        }),
      ],
      description: '대외 유출',
    },
  ],
  tickEffects: [
    {
      id: 't4-tick2-reshuffle',
      atTick: 2,
      effects: [
        confidence(-4, '부총리·경제수석 경질 — 정책 연속성에 대한 의문'),
        flag('economic_team_replaced'),
      ],
      description: '경제팀 경질 발표',
    },
    {
      id: 't4-tick4-close',
      atTick: 4,
      effects: [imfFx.fxSettle({ close: 1139.0, baseline: 26.6, bandDays: 2 })],
      description: '종가 확정',
    },
  ],
  ticker: {
    series: [
      {
        path: 'institution.fx.spot',
        mode: 'absolute',
        values: [1008.6, 1016.0, 1030.0, 1095.0, 1095.0],
      },
      {
        path: 'market.fxUsdLocal',
        mode: 'absolute',
        values: [1008.6, 1016.0, 1030.0, 1095.0, 1095.0],
      },
      { path: 'market.equityIndex', mode: 'relative', values: [408, 415, 412, 400, 396] },
      { path: 'institution.sovereign.spreadBp', mode: 'absolute', values: [0, -8, 5, 20, 30] },
    ],
  },
  events: [
    {
      id: 't4-regulator-package',
      kind: 'regulator',
      agency: '재정경제원',
      time: '11/19 14:00',
      atTick: 1,
      headline: '금융시장 안정 및 금융산업 구조조정 종합대책 발표',
      body: '정부는 (1) 2000년 말까지 금융기관 예금의 전액 보장, (2) 환율 일일변동폭의 ±2.25%에서 ±10%로 확대, (3) 부실채권 정리기금 확충을 담은 종합대책을 발표했다. 같은 날 부총리 겸 재정경제원 장관과 청와대 경제수석이 교체되었다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.stab, S.band],
      relatedMetrics: ['fxSpot'],
    },
    {
      id: 't4-data-reserves',
      kind: 'data',
      time: '11/19 09:00',
      atTick: 0,
      title: '보유액 현황 (11월 18일 기준)',
      rows: [
        { label: '총외환보유액', value: '약 256억달러' },
        { label: '가용외환보유액', value: '약 99억달러' },
        { label: '괴리', value: '약 157억달러' },
        { label: '1개월 내 만기 단기외채', value: '120억달러' },
        { label: '단기외채 롤오버율', value: '70%' },
      ],
      severity: 'critical',
      sourceRefs: [S.res, S.hearing, S.debt],
      relatedMetrics: ['usableReserves', 'grossReserves', 'reserveGap', 'guidottiRatio'],
    },
    {
      id: 't4-news-limitup',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '11/20 15:10',
      atTick: 4,
      headline: '변동폭 ±10% 시행 첫날, 원/달러 상한가 — 1,139원 마감',
      body: '확대된 변동폭 시행 첫날 원/달러 환율은 상한까지 밀린 뒤 1,139.0원에 마감했다. 하루 만에 130원이 올랐다. 외화부채를 진 기업들의 평가손실이 급증하고 있다.',
      severity: 'critical',
      sourceRefs: [S.rate, S.band],
      relatedMetrics: ['fxSpot'],
    },
  ],
  decisions: [
    {
      id: 't4-d1',
      title: '안정대책 패키지 구성',
      prompt: '오늘 발표할 대책에 무엇을 담겠습니까? (2~3개 선택)',
      context:
        '패키지의 구성은 되돌리기 어렵습니다. 예금 전액보장은 2000년까지 유지되고, 변동폭 변경은 고시 한 줄로 가능하지만 되돌리면 신뢰를 잃습니다.',
      select: { min: 2, max: 3 },
      exclusive: [['t4-d1-band10', 't4-d1-bandkeep']],
      dimensions: ['policy', 'communication'],
      requiredConcepts: ['korea-crisis-toolkit'],
      options: [
        {
          id: 't4-d1-deposit',
          label: '2000년 말까지 예금 전액보장을 선언한다',
          description:
            '금융기관 예금 전액을 2000년 말까지 정부가 보장한다. 국내 예금 이탈을 멈추는 가장 강한 수단이며 당일 발표로 효력이 생긴다.',
          effects: [
            flag('deposit_guarantee'),
            confidence(6, '예금 전액보장 — 국내 예금 이탈 차단'),
            counter('moralHazardCost', 1),
          ],
          expert: {
            rating: 75,
            rationale:
              '국내 예금 런은 실제로 막혔다. 대가는 도덕적 해이와 이후 구조조정 비용의 증가였지만, 1997년 11월에 국내 런까지 겹쳤다면 선택지가 없었다. 보정 규칙표의 "전면 보증 +40"에 해당하되, 외화 부문에는 효과가 없다는 점이 중요하다.',
            historicalNote: '1997년 11월 19일 대책에 포함되었다.',
            sourceRefs: [S.stab],
          },
          consequences:
            '예금 전액보장이 선언되었습니다. 은행 창구는 조용해졌습니다. 외화 쪽에는 아무 변화가 없습니다.',
          historical: true,
          irreversible: true,
          feasibility: {
            basis: '정부 보증 선언은 대책 발표로 즉시 효력, 후속 입법으로 뒷받침',
            sourceRefs: [S.stab],
          },
        },
        {
          id: 't4-d1-band10',
          label: '환율 일일변동폭을 ±10%로 확대한다',
          description:
            '고시 한 줄로 가능하며 다음 영업일부터 시행된다. 환율이 시장에서 청산되기 시작한다.',
          effects: [
            imfFx.setBand({ pct: 10, label: '일일변동폭 ±2.25% → ±10%' }),
            confidence(-3, '방어 포기 신호'),
          ],
          expert: {
            rating: 72,
            rationale:
              '늦었지만 옳은 방향이다. ±2.25%에서는 상한에 닿아도 거래가 성립하지 않아 무역결제가 막힌다. 다만 11월 19일의 확대는 가용보유액이 99억달러까지 줄어든 뒤에 나왔다 — 같은 조치를 3주 전에 했다면 62억달러를 쓰지 않았다.',
            historicalNote: '11월 19일 대책에 포함, 11월 20일부터 시행되었다.',
            sourceRefs: [S.band, S.stab],
          },
          consequences:
            '변동폭이 확대되었습니다. 다음 날 환율은 상한까지 밀렸지만 거래는 성립했습니다.',
          historical: true,
          feasibility: { basis: '재정경제원 고시 사항', sourceRefs: [S.band] },
        },
        {
          id: 't4-d1-bandkeep',
          label: '변동폭은 ±2.25%로 유지하고 개입으로 방어를 계속한다',
          description:
            '제도를 건드리지 않고 지금까지의 방식을 유지한다. 절하 속도를 통제할 수 있는 것처럼 보인다.',
          effects: [
            flag('band_kept_narrow'),
            imfFx.intervene({ amount: 15.0, label: '변동폭 유지 방어 개입 15억달러' }),
          ],
          expert: {
            rating: 10,
            rationale:
              '±2.25% 상한에 연일 닿으면 거래가 성립하지 않는다. 환율이 "안정적으로" 보이는 이유는 시장이 멈췄기 때문이고, 그 사이 무역금융과 수입결제가 막힌다. 실제 정책은 정반대 방향(확대 → 폐지)으로 갔다.',
            sourceRefs: [S.band, S.ieo],
          },
          consequences:
            '변동폭이 유지되었습니다. 다음 날 환율은 상한에서 거래 불성립으로 끝났고, 매도 잔량이 그대로 넘어갔습니다.',
          trap: true,
          trapExplanation:
            '변동폭을 좁게 유지하면 화면의 환율이 안정적으로 보인다. 실제로 안정된 것은 환율이 아니라 거래량이며, 그 대가는 무역결제 중단과 롤오버율 추가 하락이다.',
          remediationCard: 'korea-crisis-toolkit',
        },
        {
          id: 't4-d1-npl',
          label: '부실채권 정리기금을 확충하고 금융기관 구조조정 일정을 제시한다',
          description:
            '부실채권 매입 재원을 확충하고 자기자본 미달 금융기관의 처리 일정을 공표한다. 재원 마련에 시차가 있다.',
          effects: [flag('npl_fund'), confidence(2, '구조조정 계획 제시')],
          expert: {
            rating: 70,
            rationale:
              '외국 채권은행이 실제로 묻던 질문("부실을 누가 어떻게 떠안느냐")에 답하는 유일한 항목이다. 다만 재원 없이 일정만 제시하면 다음 달에 다시 물어본다.',
            historicalNote: '11월 19일 대책에 부실채권 정리기금 확충이 포함되었다.',
            sourceRefs: [S.stab, S.kdi],
          },
          consequences:
            '정리기금 확충 방침이 발표되었습니다. 외국 은행들은 "재원의 규모와 출처"를 물어 왔습니다.',
          historical: true,
        },
        {
          id: 't4-d1-rate',
          label: '콜금리를 20%로 인상해 자본 유출을 억제한다',
          description:
            '금리를 올려 원화 자산 보유 유인을 높인다. 홍콩이 페그를 지킨 방식이며, 국내 기업 부도는 가속된다.',
          effects: [
            imfFx.setPolicyRate({ pct: 20, baselinePct: 14.6, label: '콜금리 14.6% → 20%' }),
            confidence(-3, '고금리 충격 — 국내 기업 연쇄 부도 우려'),
          ],
          expert: {
            rating: 55,
            rationale:
              '자본 유출 억제 효과는 실재하지만, 대기업 연쇄 부도가 이미 진행 중인 상태에서의 20%는 금융기관 부실을 더 키운다. 실제로 금리 인상은 12월 프로그램의 조건으로 왔고(12/5 21%), IMF 사후평가는 그 초기 금리 수준이 과도했다고 본다.',
            sourceRefs: [S.ieo, S.crs],
          },
          consequences:
            '콜금리가 20%로 올랐습니다. 자본 유출 속도는 느려졌고, 회사채 시장은 사실상 닫혔습니다.',
        },
      ],
    },
    {
      id: 't4-d2',
      title: '가용외환보유액 공표 여부',
      prompt: '대책과 함께 보유액 실태를 공개하시겠습니까?',
      context:
        '오늘 대책의 신뢰는 재원의 신뢰에 달려 있습니다. 가용 99억달러를 공개하면 대책의 한계가 드러나고, 공개하지 않으면 대책의 근거가 없습니다.',
      dimensions: ['communication', 'compliance'],
      options: [
        {
          id: 't4-d2-a',
          label: '총외환보유액만 언급하고 가용은 공개하지 않는다',
          description: '기존 공표 기준을 유지한다.',
          effects: [flag('reserves_withheld'), counter('withheldDisclosure', 1)],
          expert: {
            rating: 28,
            rationale:
              '대책이 발표되었는데 재원을 보여 주지 않으면 외국 채권은행은 최악을 가정한다. 11월 20일 이후 롤오버율이 더 빠르게 떨어진 이유 중 하나다.',
            historicalNote: '가용외환보유액 계열은 끝내 공표되지 않았다.',
            sourceRefs: [S.hearing, S.ieo],
          },
          consequences:
            '공표 기준은 유지되었습니다. 외신들은 "한국이 여전히 진짜 숫자를 내놓지 않는다"고 썼습니다.',
          historical: true,
        },
        {
          id: 't4-d2-b',
          label: '가용 99억달러와 괴리의 성격을 대책과 함께 공개한다',
          description:
            '보유액 실태를 공개하고, 그래서 국제통화기금 프로그램이 필요하다는 결론까지 같은 자료에 담는다.',
          effects: [
            flag('reserves_disclosed'),
            confidence(-5, '가용 99억달러 공개의 충격'),
            imfFx.adjustRollover({ deltaPct: 5, reason: '실태 공개 + 해결 경로 제시' }),
            imfFx.adjustDrain({ factor: 0.9, reason: '정보 비대칭 해소' }),
            counter('transparencySteps', 1),
          ],
          expert: {
            rating: 82,
            rationale:
              '나쁜 수치를 공개하되 그에 대한 답(프로그램 요청)을 같이 내놓는 것이 위기 커뮤니케이션의 기본 순서다. 수치만 공개하면 공포가 되고, 답만 내놓으면 근거가 없다. 감사원 특별감사는 실태가 정책 결정에 반영되지 않은 점을 지적했다.',
            sourceRefs: [S.audit, S.ieo],
          },
          consequences:
            '가용 99억달러가 공개되었습니다. 환율은 상한까지 밀렸습니다. 그러나 워싱턴과 뉴욕에서는 "이제 한국이 문제를 인정했다"는 반응이 나왔습니다.',
        },
      ],
    },
    {
      id: 't4-d3',
      title: '11월 마지막 개입',
      prompt: '변동폭 확대 시행일의 개입 규모를 결정하십시오.',
      context: '가용외환보유액은 99억달러입니다. 이번 달 만기 단기외채는 120억달러입니다.',
      dimensions: ['marketRisk', 'liquidity'],
      options: [
        {
          id: 't4-d3-a',
          label: '상한가 부근에서 26.6억달러를 투입해 속도를 늦춘다',
          description:
            '확대된 변동폭 안에서도 절하 속도를 관리한다. 당시 외환시장 관행상 가능한 개입이다.',
          effects: [imfFx.intervene({ amount: 26.6, label: '현물환 개입 26.6억달러' })],
          expert: {
            rating: 20,
            rationale:
              '가용 99억달러 중 26.6억달러를, 그달 만기 120억달러를 앞두고 쓴다. 10~11월 누적 소진 약 151억달러의 마지막 조각이며, 이 결정 이후 가용은 72.6억달러가 된다. 변동폭을 확대해 놓고 같은 날 개입하는 것은 제도 변경의 의미를 스스로 지우는 일이기도 하다.',
            historicalNote: '11월 말 가용외환보유액은 72.6억달러, 총외환보유액은 244억달러였다.',
            sourceRefs: [S.bok, S.res, S.hearing],
          },
          consequences:
            '11월 말 가용외환보유액은 72.6억달러가 되었습니다. 공표 보유액은 244억달러입니다. 두 숫자의 차이는 171억달러입니다.',
          historical: true,
          trap: true,
          trapExplanation:
            '변동폭을 넓힌 날 개입하는 것은 두 정책을 서로 상쇄시키는 일이다. 환율이 시장에서 청산되게 하려고 제도를 바꿔 놓고, 같은 날 그 청산을 막는 데 가용보유액의 4분의 1을 썼다.',
        },
        {
          id: 't4-d3-b',
          label: '개입하지 않고 확대된 변동폭 안에서 시장에 맡긴다',
          description:
            '변동폭을 확대한 취지대로 시장이 환율을 찾게 둔다. 가용보유액 전액이 보전된다.',
          effects: [flag('no_intervention_after_band'), counter('restraintDays', 2)],
          expert: {
            rating: 85,
            rationale:
              '제도 변경과 행동을 일치시키는 선택이다. 26.6억달러는 12월 중순 가용보유액의 3분의 2에 해당하는 금액이며, 이 돈이 남아 있었다면 12월의 협상 조건이 달라졌을 것이다.',
            sourceRefs: [S.ieo, S.ara],
          },
          consequences:
            '개입 없이 마감했습니다. 환율은 상한까지 밀렸고, 가용외환보유액은 99억달러가 그대로 남았습니다.',
        },
        {
          id: 't4-d3-c',
          label: '해외점포 예치를 늘려 은행 외화결제를 우선 보전한다',
          description:
            '개입 대신 국내은행 해외점포 외화결제를 지원한다. 공표 보유액은 줄지 않는다.',
          effects: [
            imfFx.depositAtBranches({
              amount: 12.0,
              reason: '국내은행 해외점포 외화결제 보전',
              label: '해외점포 예치 12억달러',
            }),
            imfFx.adjustDrain({ factor: 0.9, reason: '해외점포 결제 보전' }),
          ],
          expert: {
            rating: 32,
            rationale:
              '결제를 막는다는 점에서 개입보다 낫지만, 가용보유액에서 12억달러가 다시 보이지 않는 곳으로 간다. 12월 중순 39억달러의 구성 요소가 바로 이런 결정들이다.',
            sourceRefs: [S.hearing],
          },
          consequences:
            '해외점포 결제가 보전되었습니다. 총외환보유액은 그대로이고, 가용은 87억달러로 줄었습니다.',
        },
      ],
    },
  ],
  interrupts: [t4Interrupt],
  advisorHints: [
    {
      level: 2,
      text: '예금 전액보장은 원화 예금에 대한 조치입니다. 지금 빠져나가는 것은 달러입니다. 두 문제를 같은 대책으로 풀 수 없습니다.',
      decisionId: 't4-d1',
    },
  ],
  relatedCards: ['korea-crisis-toolkit', 'crisis-communication', 'regulator-escalation-ladder'],
}

export const turnsA: T[] = [t0, t1, t2, t3, t4]
