import type { BankState, Interrupt } from '../../engine/types'
import { confidence, counter, flag, op, regulator } from '../../engine/fx/common'
import { pfFx } from './fx'
import { S, type T } from './turnsA'

/**
 * turnsB — T4(2024-03-13) ~ T7(2024-05-30).
 *
 * T4는 실사 결과와 사업장 옥석 가리기(3틱), T5는 기업개선계획 의결(4틱)이다. T6에서 금융감독원의
 * 사업성 평가 4단계 기준이 발표되고, 같은 시점에 경기대응완충자본 1%가 적용되어 규제 최저 CET1이
 * 7.0%에서 8.0%로 올라간다 — 충당금과 자본의 상충이 가장 날카로워지는 구간이다.
 */

// ---------------------------------------------------------------------------------------------
// T4 — 2024-03-13 (수) "실사 결과와 사업장 옥석 가리기" (3틱)
// ---------------------------------------------------------------------------------------------

const t4LienCall: Interrupt<BankState> = {
  id: 't4-i1',
  interrupt: true,
  atTick: 1,
  timeoutSec: 45,
  defaultOptionId: 't4-i1-c',
  scoreWeight: 0.5,
  required: false,
  title: '현장 유치권 행사 통지',
  prompt: '본PF 사업장 두 곳에서 하도급 업체가 유치권을 행사했습니다. 어떻게 대응하시겠습니까?',
  context:
    '유치권이 걸린 현장은 공사가 멈추고 분양 일정이 밀립니다. 두 사업장의 익스포저 합계는 0.24조원이며 평균 공정률은 58%입니다.',
  source: { kind: 'desk', caller: '부동산금융부 현장관리팀', tone: 'urgent' },
  lines: [
    {
      speaker: '부동산금융부 현장관리팀',
      text: '하도급 3개사가 미지급 공사대금 620억을 이유로 현장에 유치권을 걸었습니다. 출입이 통제되고 있습니다. 오늘 중 방침을 주셔야 내일 공정을 재개할 수 있습니다.',
    },
  ],
  dimensions: ['marketRisk', 'compliance'],
  cardRefs: ['crisis-communication'],
  options: [
    {
      id: 't4-i1-a',
      label: '하도급 대금을 직불로 지급하고 공정을 재개',
      description:
        '발주처·시공사·하도급 3자 직불합의로 미지급 대금을 직접 지급한다. 현금이 나가지만 공정이 멈추지 않는다.',
      effects: [
        op('institution.cash', 'add', -0.062, '하도급 대금 직불'),
        op('institution.loans.corporate', 'add', 0.062, '직불 대금의 구상채권'),
        flag('trade_payables_honoured'),
        confidence(3, '현장 정상화'),
      ],
      expert: {
        rating: 82,
        rationale:
          '상거래채권은 기촉법상 금융채권이 아니어서 유예 대상이 아니고, 정부 합동브리핑도 협력업체 대금의 정상 지급과 계속 시공을 우선한다고 밝혔다. 공정률 58%에서 공사가 멈추면 분양보증과 회수가치가 함께 흔들린다.',
        sourceRefs: [S.brief, S.crpa],
      },
      preview: [{ metric: 'cash', direction: 'down', magnitude: 1 }],
      consequences: '직불이 집행되어 유치권이 해제되었고 내일부터 공정이 재개됩니다.',
    },
    {
      id: 't4-i1-b',
      label: '유치권 부존재 확인의 소를 제기',
      description:
        '유치권 성립 요건을 다투며 소송으로 간다. 현금은 나가지 않지만 판결까지 현장이 멈춘다.',
      effects: [counter('lienLitigation', 1), confidence(-5, '현장 분쟁 장기화')],
      delayedEffects: [
        {
          afterTurns: 1,
          description: '소송 기간 중 공정이 멈춰 해당 사업장의 회수가치가 떨어진다',
          effects: [pfFx.deferDecay({ bridgeRate: 0.02, mainRate: 0.02, label: '현장 중단 손실' })],
        },
      ],
      expert: {
        rating: 32,
        rationale:
          '법적으로 다툴 여지가 있는 것은 사실이다. 그러나 공정률 58%의 현장에서 몇 달을 멈추는 비용이 미지급 대금 620억보다 크고, 협력업체 연쇄 부도는 다른 현장으로도 번진다.',
        sourceRefs: [S.brief, S.nice],
      },
      consequences: '소송이 제기되었습니다. 두 현장의 출입 통제가 계속됩니다.',
      trap: true,
      trapExplanation:
        '현금을 아끼는 선택으로 보이지만, 담보의 가치가 공정률에서 나오는 자산에서는 공사 중단이 곧 담보 훼손이다.',
    },
    {
      id: 't4-i1-c',
      label: '시공사가 자체적으로 해결하도록 통보',
      description: '워크아웃 중이라도 하도급 관리는 시공사 책임이라고 통보한다.',
      effects: [counter('lienDeferred', 1)],
      expert: {
        rating: 45,
        rationale:
          '계약상 맞는 말이다. 다만 워크아웃 중인 시공사는 지급 여력이 없으므로 통보는 사실상 방치이고, 채권단이 결국 같은 비용을 나중에 더 크게 치른다.',
        sourceRefs: [S.brief],
      },
      consequences: '시공사에 통보했습니다. 현장 상황은 달라지지 않았습니다.',
      historical: true,
    },
  ],
}

export const t4: T = {
  id: 't4',
  label: 'T4',
  timeLabel: '2024년 3월 13일 (수) 09:00 KST',
  title: '실사 결과와 사업장 옥석 가리기',
  time: '2024-03-13T09:00:00+09:00',
  ticks: 3,
  tickLabels: ['09:00 실사보고 접수', '13:00 사업장 심사', '17:00 채권단 통보'],
  entryEffects: [
    {
      id: 't4-market-anchor',
      description: '시장 앵커를 2024-03-12 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 327.3, '국고채 3년 3.273%'),
        op('market.custom.corpAA3y', 'set', 391.7, '회사채 AA- 3년 3.917%'),
        op('market.custom.corpBBB3y', 'set', 1021.4, '회사채 BBB- 3년 10.214%'),
        op('market.creditSpreadIgBp', 'set', 64.4, 'AA- − 국고 3년 (3/12 종가)'),
        op('market.creditSpreadHyBp', 'set', 694.1, 'BBB- − 국고 3년'),
        op('market.fxUsdLocal', 'set', 1311, '원/달러 종가 1,311.0 (3/12)'),
        op('market.custom.constructionPfSpreadBp', 'set', 415, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
    {
      id: 't4-due-diligence',
      description:
        '실사 결과: 계속기업가치가 청산가치를 웃돌지만 자본잠식이 확인되고, 사업장 60곳이 브릿지론 20 / 본PF 40으로 재분류되었다',
      effects: [
        op('institution.custom.pfBridge', 'set', 1.3, '브릿지론 20곳으로 재분류'),
        op('institution.custom.pfMain', 'set', 3.3, '본PF 40곳으로 재분류'),
        flag('dd_complete'),
        confidence(-4, '자본잠식 확인'),
      ],
    },
  ],
  ticker: {
    series: [
      // AA- − 국고 3년: 3/12 종가 64.4bp → 3/13 종가 64.8bp. 일중 분포는 [STYLIZED]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [64.4, 65.1, 64.8] },
      { path: 'market.custom.constructionPfSpreadBp', mode: 'absolute', values: [415, 409, 402] },
    ],
  },
  interrupts: [t4LienCall],
  events: [
    {
      id: 't4-data-dd',
      kind: 'data',
      time: '09:00',
      title: '실사 결과 요약 (회계법인 최종보고)',
      rows: [
        { label: '계속기업가치 / 청산가치', value: '계속기업가치 우위' },
        { label: '자본', value: '완전자본잠식 (별도기준)' },
        { label: 'PF 사업장', value: '60곳 — 브릿지론 20 / 본PF 40' },
        { label: '본PF 중 준공 임박', value: '4곳' },
        { label: '본PF 중 정상진행 가능', value: '28곳' },
        { label: '본PF 중 시공사 교체 필요', value: '7곳' },
        { label: '본PF 중 사업 청산 권고', value: '1곳' },
        { label: '브릿지론 중 사업 진행 가능', value: '1곳' },
        { label: '브릿지론 중 시공사 교체 필요', value: '10곳' },
        { label: '브릿지론 중 경·공매 권고', value: '9곳' },
      ],
      severity: 'warning',
      sourceRefs: [S.plan, S.brief],
      relatedMetrics: ['pfBridge', 'pfMain', 'pfExposure'],
    },
    {
      id: 't4-memo-triage',
      kind: 'memo',
      time: '09:40',
      from: '부동산금융부장',
      to: '여신담당 부행장',
      subject: '옥석 가리기 — 정리하면 오늘 확정되고, 끌면 커집니다',
      body: `| | 브릿지론 (1.30조 · 20곳) | 본PF (3.30조 · 40곳) |
|---|---|---|
| 담보 | 토지 | 토지 + 공정 + 분양대금 |
| 경·공매 회수율 | **45%** (사전 재평가를 해 둔 경우 50%) | **72%** |
| 끌었을 때 | 금융비용이 토지가치를 잠식 — 분기마다 회수율 하락 | 공정·분양이 이어지면 회수율 유지 |

**브릿지론을 정리하면 오늘 손실이 확정되고, 끌면 손실이 커집니다.** 중소금융 토지담보대출 연체율이 '23.12말 7.15%에서 계속 오르고 있다는 통계가 그 경로를 보여 줍니다.

재구조화(시공사 교체)로 넘기면 이번 분기 손실은 작지만, 이연된 익스포저는 다음 분기마다 추가 충당 요인이 됩니다.`,
      severity: 'warning',
      relatedMetrics: ['pfBridge', 'pfMain', 'provisionsCum'],
      sourceRefs: [S.fsr24, S.nice, S.kdi],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't4-memo-classification',
      kind: 'memo',
      atTick: 1,
      time: '13:00',
      from: '여신관리부장',
      to: '여신담당 부행장',
      subject: '자산건전성 재분류와 대손충당금 최저적립률',
      body: `은행업감독규정 제29조제1항제1호상 기업여신 대손충당금 최저적립률은 **정상 0.85% · 요주의 7% · 고정 20% · 회수의문 50% · 추정손실 100%** 입니다. 다만 같은 호 단서에 따라 **건설업·도소매업·숙박음식업·부동산임대업 차주는 정상이 0.9%** 이고, 대현건설그룹 익스포저는 전부 여기에 해당합니다.

- 그룹 무담보채권 0.42조: 회수 전망에 따라 고정(0.084조) 또는 회수의문(0.21조)
- 그룹 담보부채권 0.86조: 담보 감정가를 반영하면 요주의(0.060조)가 기준
- 브릿지론 잔여분: 경·공매 권고 사업장을 남겨 두면 고정 이하가 원칙

**분류는 연체 여부가 아니라 채무상환능력으로 판단합니다.** 만기를 연장해 연체를 없애더라도 상환능력이 달라지지 않았다면 분류는 그대로 내려가야 합니다.`,
      severity: 'warning',
      sourceRefs: [S.bankReg],
      relatedMetrics: ['cet1Ratio', 'provisionsCum'],
      cardRefs: ['economic-vs-regulatory-capital', 'regulator-escalation-ladder'],
    },
    {
      id: 't4-news-market',
      kind: 'newswire',
      atTick: 2,
      outlet: '연합인포맥스',
      time: '17:00',
      headline: '회사채 스프레드 축소 지속 — AA- 3년 64bp대',
      body: '연초 75bp 안팎이던 회사채 AA- 3년 스프레드가 64bp대로 좁혀졌다. 우량 등급의 조달 여건은 개선되고 있으나 건설·부동산 관련 등급의 격차는 그대로라는 분석이 나온다.',
      sourceRefs: [S.ecosRate],
    },
  ],
  decisions: [
    {
      id: 't4-d2',
      title: '자산건전성 재분류와 충당금',
      prompt: '실사 결과를 반영해 그룹 익스포저를 어떻게 분류하시겠습니까?',
      context:
        '보수적으로 쌓으면 오늘 자본이 깎이고, 미루면 감독당국의 재분류 지시가 옵니다. 이미 쌓은 만큼은 다시 쌓지 않으므로 결국 총액은 같고 시점만 다릅니다 — 다만 미룬 쪽에는 가산이 붙습니다.',
      availableFrom: 0,
      deadlineTick: 1,
      defaultOptionId: 't4-d2-b',
      timeLimitSec: 240,
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['solvency', 'compliance'],
      options: [
        {
          id: 't4-d2-a',
          label: '보수적 분류: 무담보 회수의문, 담보부·브릿지 고정',
          description:
            '그룹 무담보채권을 회수의문(50%), 담보부채권과 잔여 브릿지론을 고정(20%)으로 분류한다. 오늘 자본이 가장 많이 깎이지만 이후 재분류 여지가 없다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 1, bucket: 'doubtful' }),
            pfFx.provision({ pool: 'groupSecured', share: 1, bucket: 'substandard' }),
            pfFx.provision({ pool: 'pfBridge', share: 1, bucket: 'substandard' }),
            flag('conservative_classification'),
          ],
          expert: {
            rating: 85,
            rationale:
              '실사로 완전자본잠식이 확인된 채무자의 무담보채권은 회수의문이 실질에 맞다. 먼저 쌓으면 감독당국의 재분류 지시를 받을 여지가 없고, 두 달 뒤 사업성 평가 기준이 강화되어도 추가 부담이 작다. 자본은 오늘 깎이지만 예측 가능해진다.',
            sourceRefs: [S.bankReg, S.pfPolicy],
          },
          consequences:
            '보수적 분류가 확정되었습니다. CET1이 눈에 띄게 내려갔지만 숨은 부실은 남지 않았습니다.',
          feasibility: {
            basis: '은행업감독규정 제27조·제29조 — 채무상환능력 기준 분류는 은행의 의무',
            sourceRefs: [S.bankReg],
          },
          calibrationNote: '적립률은 은행업감독규정 별표 최저적립률 그대로 [bank-supervision-reg]',
        },
        {
          id: 't4-d2-b',
          label: '기준대로 분류: 무담보 고정, 담보부·브릿지 요주의',
          description:
            '그룹 무담보채권을 고정(20%), 담보부채권과 브릿지론을 요주의(7%)로 분류한다. 감독규정 최저선을 지키면서 자본 충격을 줄인다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 1, bucket: 'substandard' }),
            pfFx.provision({ pool: 'groupSecured', share: 1, bucket: 'watch' }),
            pfFx.provision({ pool: 'pfBridge', share: 1, bucket: 'watch' }),
          ],
          expert: {
            rating: 66,
            rationale:
              '감독규정 위반은 아니고 업계 관행에 가깝다. 다만 두 달 뒤 사업성 평가 기준이 강화되면 같은 익스포저를 다시 내려야 하고, 그때는 자본 여력이 지금보다 얇다.',
            historicalNote:
              '실제 은행권의 2024년 1분기 대응도 대체로 이 수준이었고, 대규모 추가 적립은 사업성 평가가 시행된 2024년 하반기에 이루어졌다.',
            sourceRefs: [S.bankReg, S.pfEval],
          },
          consequences: '기준대로 분류했습니다. 자본 충격은 제한적입니다.',
          historical: true,
          feasibility: {
            basis: '은행업감독규정 최저적립률 충족 — 은행 자체 판단 범위',
            sourceRefs: [S.bankReg],
          },
        },
        {
          id: 't4-d2-c',
          label: '분류 유지: 채권행사 유예 중이므로 정상·요주의',
          description:
            '기촉법상 채권행사가 유예 중이고 연체가 발생하지 않았으므로 기존 분류를 유지한다. 이번 분기 충당금 부담이 거의 없다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 1, bucket: 'watch' }),
            pfFx.freezeClassification({ months: 3, label: '유예 중 분류 유지' }),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { flag: 'classification_frozen' },
              description:
                '감독당국이 분류 동결을 지적하고 재분류를 지시 — 미뤄 둔 충당금이 가산과 함께 적립된다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['groupUnsecured', 'groupSecured', 'pfBridge'],
                  bucket: 'substandard',
                  share: 1,
                  surcharge: 0.4,
                  label: '재분류 지시(동결 가산 40%)',
                }),
              ],
            },
          ],
          expert: {
            rating: 20,
            rationale:
              '연체가 없다는 것은 유예했기 때문이지 갚을 수 있기 때문이 아니다. 감독규정은 분류를 채무상환능력으로 판단하라고 정하고 있고, 실사로 완전자본잠식이 확인된 채무자를 정상·요주의로 두는 것은 그 규정에 정면으로 어긋난다.',
            sourceRefs: [S.bankReg, S.pfPolicy],
          },
          consequences:
            '분류를 유지했습니다. 이번 분기 CET1은 거의 그대로입니다. 감독당국에 분기 보고가 나갑니다.',
          trap: true,
          trapExplanation:
            '충당금을 미루면 이번 분기 자본비율이 지켜지고, 그 사이 자구안이 도착하면 영영 쌓지 않아도 될 것 같다. 그러나 자구안은 늦고 감독당국은 빠르다 — 재분류 지시가 오면 미뤄 둔 금액에 가산까지 붙는다.',
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis: '물리적으로 가능하나 은행업감독규정 제27조의 판단 기준에 어긋난다',
            sourceRefs: [S.bankReg],
          },
        },
        {
          id: 't4-d2-d',
          label: '초과 적립: 전 PF 익스포저에 추가 충당',
          description:
            '그룹 익스포저를 넘어 PF 본PF·채무보증까지 고정 수준으로 일괄 적립한다. 가장 보수적이지만 신규자금 여력을 잃는다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 1, bucket: 'doubtful' }),
            pfFx.provision({ pool: 'groupSecured', share: 1, bucket: 'substandard' }),
            pfFx.provision({ pool: 'pfBridge', share: 1, bucket: 'substandard' }),
            pfFx.provision({ pool: 'pfMain', share: 1, bucket: 'substandard' }),
            pfFx.provision({ pool: 'pfGuarantee', share: 1, bucket: 'substandard' }),
            flag('over_provisioned'),
          ],
          expert: {
            rating: 44,
            rationale:
              '보수성 자체는 흠이 아니지만, 정상진행 중인 본PF 28곳까지 고정으로 내리는 것은 실질에 맞지 않는다. 위험가중자산이 함께 올라 CET1 비율이 두 방향에서 눌리고, 두 달 뒤 신규자금을 분담할 여력이 사라진다.',
            sourceRefs: [S.bankReg, S.fsr24],
          },
          consequences:
            '전 PF 익스포저에 고정 수준 충당금이 적립되었습니다. CET1 비율이 크게 내려갔습니다.',
          feasibility: { basis: '최저적립률을 초과하는 적립은 은행 재량', sourceRefs: [S.bankReg] },
        },
      ],
    },
    {
      id: 't4-d1',
      title: '사업장 옥석 가리기',
      prompt: '60개 사업장을 어떻게 나누시겠습니까?',
      context:
        '경·공매로 넘기면 오늘 손실이 확정됩니다. 시공사 교체·재구조화로 넘기면 오늘 손실은 작지만 이연된 익스포저는 분기마다 회수율이 떨어집니다. 브릿지론과 본PF는 성격이 다릅니다.',
      availableFrom: 1,
      deadlineTick: 1,
      defaultOptionId: 't4-d1-b',
      timeLimitSec: 300,
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['solvency', 'marketRisk', 'timeliness'],
      options: [
        {
          id: 't4-d1-a',
          label: '보수적 정리: 브릿지 다수 경·공매, 본PF는 선별',
          description:
            '브릿지론 익스포저의 70%(14곳)와 본PF 1곳을 즉시 경·공매로 넘기고, 나머지 중 일부만 시공사 교체로 재구조화한다. 오늘 손실이 가장 크게 확정된다.',
          effects: [
            pfFx.siteTriage({
              bridgeAuction: 0.7,
              mainAuction: 0.03,
              bridgeRestructure: 0.6,
              mainRestructure: 0.12,
              sitesAuction: 15,
              sitesRestructure: 14,
              label: '보수적 정리',
            }),
            flag('triage_done'),
            pfFx.refreshDelinquency(),
          ],
          expert: {
            rating: 86,
            rationale:
              '브릿지론은 시간이 가치를 만들지 않는 자산이다 — 금융비용이 토지 가치를 잠식하므로 회수율은 분기마다 떨어진다. 중소금융 토지담보대출 연체율이 2023년말 7.15%에서 2025년 3월말 28.05%까지 오른 경로가 그 증거다. 오늘 확정한 손실이 2년 뒤의 손실보다 작다.',
            sourceRefs: [S.pfPolicy, S.kdi, S.fsr24],
          },
          consequences:
            '브릿지론 대부분이 경·공매 절차에 들어갔습니다. 손실이 확정되었고 익스포저가 줄었습니다.',
          feasibility: {
            basis: '경·공매 개시는 담보권자의 권리 — 협의회 결의로 사업장 처리방안 확정 가능',
            sourceRefs: [S.crpa, S.pfPolicy],
          },
          calibrationNote:
            '회수율 브릿지 45%(사전 재평가 시 50%) / 본PF 72% [CAL] calibration.md §6',
        },
        {
          id: 't4-d1-b',
          label: '균형: 브릿지 절반 경·공매, 나머지 시공사 교체',
          description:
            '브릿지론 익스포저의 45%(9곳)와 본PF 1곳을 경·공매로 정리하고, 17곳은 시공사를 교체해 사업을 계속한다. 실사 권고안 그대로다.',
          effects: [
            pfFx.siteTriage({
              bridgeAuction: 0.45,
              mainAuction: 0.025,
              bridgeRestructure: 0.85,
              mainRestructure: 0.17,
              sitesAuction: 10,
              sitesRestructure: 17,
              label: '실사 권고안',
            }),
            flag('triage_done'),
            pfFx.refreshDelinquency(),
          ],
          expert: {
            rating: 68,
            rationale:
              '실사 권고안이자 실제로 채택된 안이다 — 본PF 40곳 중 준공 4·정상진행 28·시공사 교체 7·청산 1, 브릿지론 20곳 중 진행 1·시공사 교체 10·경공매 9. 분양계약자와 협력업체를 고려하면 합리적이지만, 시공사 교체로 넘긴 브릿지론의 회수율은 계속 떨어진다.',
            historicalNote:
              '실제 기업개선계획의 사업장 처리방안은 정상·준공 33곳, 시공사 교체 17곳, 청산·경공매 10곳이었다.',
            sourceRefs: [S.plan, S.brief],
          },
          consequences:
            '실사 권고안대로 처리방안이 확정되었습니다. 경·공매 10곳, 시공사 교체 17곳입니다.',
          historical: true,
          feasibility: {
            basis: '실사 결과에 따른 사업장 처리방안 — 협의회 의결 사항',
            sourceRefs: [S.crpa, S.plan],
          },
        },
        {
          id: 't4-d1-c',
          label: '정리 없이 전 사업장 만기연장',
          description:
            '경·공매 없이 60곳 전부를 만기연장으로 넘긴다. 오늘 확정되는 손실이 없고 분양계약자 민원도 없다.',
          effects: [
            pfFx.siteTriage({
              bridgeAuction: 0,
              mainAuction: 0,
              bridgeRestructure: 1,
              mainRestructure: 0.8,
              sitesAuction: 0,
              sitesRestructure: 48,
              label: '전면 만기연장',
            }),
            pfFx.freezeClassification({ months: 12, label: '전 사업장 만기연장' }),
            pfFx.refreshDelinquency(),
          ],
          delayedEffects: [
            {
              afterTurns: 2,
              when: { flag: 'classification_frozen' },
              description:
                '사업성 평가 기준이 강화되면서 만기연장 사업장이 일괄 재분류된다 — 미뤄 둔 충당금이 가산과 함께 온다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['pfBridge', 'pfMain'],
                  bucket: 'substandard',
                  share: 0.6,
                  surcharge: 0.3,
                  label: '만기연장 사업장 재분류',
                }),
              ],
            },
          ],
          expert: {
            rating: 20,
            rationale:
              '가장 편한 선택이고 오늘은 아무도 손해를 보지 않는다. 그러나 2024년 5월 사업성 평가 기준이 "만기연장 3회 이상"을 1차 평가 대상으로 지목한 이유가 바로 이 관행이었다. 연장은 사업성을 바꾸지 않고 부실을 이연할 뿐이다.',
            sourceRefs: [S.pfPolicy, S.pfEval, S.kdi],
          },
          consequences: '전 사업장 만기가 연장되었습니다. 오늘 확정된 손실은 없습니다.',
          trap: true,
          trapExplanation:
            '만기연장은 지표를 좋게 만든다 — 연체가 사라지고 충당금이 없으며 민원도 없다. 그래서 업계 전체가 이 길을 갔고, 감독당국은 2024년 5월 "만기연장 3회 이상"을 부실 징후로 명시해 1차 평가 대상에 넣었다.',
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis:
              '대주단 협약상 만기연장은 채권액 3분의 2 동의로 가능 (2024.6.27 개정으로 4분의 3 상향)',
            sourceRefs: [S.accord],
          },
        },
        {
          id: 't4-d1-d',
          label: '전면 경·공매: 브릿지·본PF 모두 즉시 정리',
          description:
            '브릿지론 전부와 본PF 익스포저의 45%를 즉시 경·공매로 넘긴다. 익스포저가 가장 빨리 줄지만 회수가치도 함께 파괴된다.',
          effects: [
            pfFx.siteTriage({
              bridgeAuction: 1,
              mainAuction: 0.45,
              bridgeRestructure: 0,
              mainRestructure: 0.2,
              sitesAuction: 38,
              sitesRestructure: 8,
              label: '전면 경·공매',
            }),
            flag('triage_done'),
            confidence(-8, '전면 경·공매에 따른 시장 충격'),
            pfFx.refreshDelinquency(),
          ],
          expert: {
            rating: 38,
            rationale:
              '정리 자체가 틀린 것은 아니지만, 공정률 42%·분양률 61%의 본PF를 경·공매로 넘기면 이미 들어간 공사비와 분양대금이 회수가치에서 사라진다. 같은 시점에 업권 전체가 물량을 쏟아내면 경·공매 낙찰가가 더 떨어지는 되먹임도 있다.',
            sourceRefs: [S.pfPolicy, S.fsr24],
          },
          consequences:
            '대부분의 사업장이 경·공매로 넘어갔습니다. 익스포저는 줄었지만 손실이 크게 확정되었습니다.',
          feasibility: {
            basis: '담보권 실행은 가능하나 분양계약자가 있는 사업장은 분양보증 이행 절차가 선행',
            sourceRefs: [S.brief, S.pfPolicy],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't4-d1',
      text: '브릿지론과 본PF의 회수율 차이(45% vs 72%)를 먼저 보세요. 어느 쪽을 끌어야 하는지가 거기서 나옵니다.',
    },
    {
      level: 3,
      decisionId: 't4-d2',
      text: '분류를 유지하면(C) 이번 분기 CET1은 지켜집니다. 그러나 감독당국의 재분류 지시에는 가산이 붙고, 두 달 뒤 사업성 평가 기준이 강화됩니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T5 — 2024-04-30 (화) "기업개선계획 의결" (4틱)
// ---------------------------------------------------------------------------------------------

/** 계획 의결 당일의 부동표 확정 분포 [STYLIZED]. */
export const T5_CONSENT_PROFILE = [0.2, 0.3, 0.3, 0.2]
/** 계획 의결 당일 확정되는 부동표 합계(%p) [CAL]. */
export const T5_CONSENT_TOTAL = 6.2

const t5SupervisorCall: Interrupt<BankState> = {
  id: 't5-i1',
  interrupt: true,
  atTick: 1,
  timeoutSec: 60,
  defaultOptionId: 't5-i1-c',
  scoreWeight: 0.5,
  required: false,
  title: '금융감독원 담당 국장 전화',
  prompt: '금감원 담당 국장이 분류와 충당금 계획을 묻습니다. 어떻게 답하시겠습니까?',
  context:
    '금감원은 은행별 부동산 PF 익스포저와 건전성 분류를 상시 점검하고 있습니다. 여기서 한 답은 이후 검사에서 그대로 대조됩니다.',
  source: {
    kind: 'regulator',
    caller: '담당 국장',
    agency: '금융감독원',
    tone: 'concerned',
  },
  lines: [
    {
      speaker: '금융감독원 담당 국장',
      text: '오늘 계획 의결하시는 건 알고 있습니다. 그런데 귀행의 해당 익스포저 분류가 다른 은행보다 한 단계 위에 있더군요. 실사에서 완전자본잠식이 나왔는데 근거가 무엇입니까?',
    },
  ],
  dimensions: ['compliance', 'communication'],
  cardRefs: ['regulator-escalation-ladder'],
  options: [
    {
      id: 't5-i1-a',
      label: '현재 분류와 충당금 계획을 수치로 보고',
      description:
        '익스포저별 분류 단계, 적립액, 추가 적립 일정을 그대로 답한다. 불리한 수치도 먼저 말한다.',
      effects: [flag('supervisor_briefed'), confidence(2, '감독당국 선제 보고')],
      expert: {
        rating: 85,
        rationale:
          '감독당국은 업무보고로 이미 은행별 분류를 비교하고 있다. 먼저 정확히 말하는 쪽이 재분류 지시가 아니라 협의의 대상이 되며, 감독 단계도 오르지 않는다.',
        sourceRefs: [S.bankReg, S.pfPolicy],
      },
      consequences:
        '수치를 그대로 보고했습니다. 국장은 추가 적립 일정을 확인하고 통화를 마쳤습니다.',
    },
    {
      id: 't5-i1-b',
      label: '채권행사 유예 중이라 분류 변경은 없다고 답변',
      description: '기촉법상 유예 중이므로 연체가 없고 분류를 바꿀 이유가 없다고 답한다.',
      effects: [regulator({ add: 1 }, '분류 근거 부실'), confidence(-4, '감독당국 신뢰 저하')],
      delayedEffects: [
        {
          afterTurns: 1,
          description: '금감원이 해당 익스포저의 분류 근거 자료 제출을 요구하고 현장 점검을 예고',
          effects: [regulator({ add: 1 }, '분류 근거 자료 제출 요구')],
        },
      ],
      expert: {
        rating: 25,
        rationale:
          '유예는 채권 행사를 미루는 것이지 상환능력을 회복시키는 것이 아니다. 은행업감독규정은 분류를 채무상환능력으로 판단하라고 정하고 있으므로, 이 답변은 규정을 잘못 읽었다고 스스로 밝히는 것이다.',
        sourceRefs: [S.bankReg],
      },
      consequences:
        '국장이 "그건 연체 기준 아닙니까"라고 되물었습니다. 자료 제출 요구가 예고되었습니다.',
      trap: true,
      trapExplanation:
        '"유예 중이라 연체가 없다"는 사실관계는 맞다. 그러나 분류 기준은 연체가 아니라 상환능력이므로, 맞는 사실로 틀린 답을 하는 셈이다.',
      remediationCard: 'regulator-escalation-ladder',
    },
    {
      id: 't5-i1-c',
      label: '실사 최종본 확정 후 정리해 보고하겠다고 답변',
      description: '오늘 의결이 끝난 뒤 정리해서 보고하겠다고 답한다.',
      effects: [counter('supervisorDeferred', 1)],
      expert: {
        rating: 50,
        rationale:
          '무리한 답은 아니지만, 감독당국이 먼저 물었다는 것은 이미 비교표를 보고 있다는 뜻이다. 미룬 만큼 다음 접촉의 강도가 올라간다.',
        historicalNote: '실무에서 가장 흔한 답변이다.',
        sourceRefs: [S.bankReg],
      },
      consequences: '보고를 미뤘습니다. 국장은 "다음 주에 다시 연락하겠다"고 했습니다.',
      historical: true,
    },
  ],
}

export const t5: T = {
  id: 't5',
  label: 'T5',
  timeLabel: '2024년 4월 30일 (화) 09:00 KST',
  title: '기업개선계획 의결',
  time: '2024-04-30T09:00:00+09:00',
  ticks: 4,
  tickLabels: ['09:00 계획안 배포', '11:00 채권단 질의', '14:00 수정안 제시', '16:00 의결 마감'],
  entryEffects: [
    {
      id: 't5-market-anchor',
      description: '시장 앵커를 2024-04-29 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 355.2, '국고채 3년 3.552%'),
        op('market.custom.corpAA3y', 'set', 402.4, '회사채 AA- 3년 4.024%'),
        op('market.custom.corpBBB3y', 'set', 1024.4, '회사채 BBB- 3년 10.244%'),
        op('market.creditSpreadIgBp', 'set', 47.2, 'AA- − 국고 3년 (4/29 종가)'),
        op('market.creditSpreadHyBp', 'set', 669.2, 'BBB- − 국고 3년'),
        op('market.custom.cd91', 'set', 357, 'CD(91일) 3.57%'),
        op('market.custom.cp91', 'set', 422, 'CP(91일) 4.22%'),
        op('market.fxUsdLocal', 'set', 1377, '원/달러 종가 1,377.0 (4/29)'),
        op('market.custom.constructionPfSpreadBp', 'set', 352, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
    {
      id: 't5-sector-data',
      description:
        "금융위·금감원 「'23.12말 기준 금융권 부동산PF 대출 현황」(2024-03-22 공표)이 반영된다",
      effects: [
        pfFx.setSectorData({
          loanTn: 135.6,
          delinqPct: 2.7,
          securitiesPct: 13.73,
          savingsPct: 6.94,
          label: '업권 PF 공표치',
        }),
      ],
    },
    {
      id: 't5-defer-decay',
      description: '재구조화로 넘긴 사업장의 회수율 저하가 1분기분 반영된다',
      effects: [
        pfFx.deferDecay({ bridgeRate: 0.18, mainRate: 0.05, label: '이연 회수율 저하(1분기)' }),
      ],
    },
    {
      id: 't5-reopen-consent',
      description:
        '계획 의결은 손실 배분을 확정하는 결의여서 개시 의결의 표가 그대로 오지 않는다 — 동의를 다시 묻는다',
      effects: [
        pfFx.reopenConsent({
          adjust: { Nbfi: -0.14, Securities: -0.1, Insurance: -0.08, Other: -0.16 },
          label: '계획 의결 동의 재집계',
        }),
      ],
    },
  ],
  eachTick: [
    {
      id: 't5-consent-accrual',
      description: '계획안 설명과 수정안 제시에 따라 현장에서 확정되는 부동표',
      effects: [
        pfFx.accrueConsent({
          total: T5_CONSENT_TOTAL,
          profile: T5_CONSENT_PROFILE,
          label: '현장 부동표 확정',
        }),
      ],
    },
  ],
  tickEffects: [
    {
      id: 't5-plan-vote',
      atTick: 3,
      description:
        '16:00 계획 의결 마감 — 총 금융채권액 4분의 3(제24조제2항)과 담보채권 총액 4분의 3(제17조제2항)을 함께 본다',
      effects: [
        pfFx.workoutVote({
          kind: 'plan',
          threshold: 75,
          securedThreshold: 75,
          label: '기업개선계획 의결',
        }),
      ],
    },
    {
      id: 't5-plan-fallout',
      atTick: 3,
      when: { flag: 'plan_rejected' },
      description: '계획 부결 — 유예기간 내 미의결로 공동관리절차가 중단되고 회생절차로 간다',
      effects: [
        pfFx.courtReceivership({
          securedRecovery: 0.52,
          sectorLoss: 0.09,
          label: '계획 부결 → 회생절차',
        }),
      ],
    },
  ],
  ticker: {
    series: [
      // AA- − 국고 3년: 4/29 종가 47.2bp → 4/30 종가 46.6bp. 일중 분포는 [STYLIZED]
      { path: 'market.creditSpreadIgBp', mode: 'absolute', values: [47.2, 48.0, 47.1, 46.6] },
      {
        path: 'market.custom.constructionPfSpreadBp',
        mode: 'absolute',
        values: [352, 356, 350, 344],
      },
    ],
  },
  interrupts: [t5SupervisorCall],
  events: [
    {
      id: 't5-plan-agenda',
      kind: 'memo',
      time: '09:00',
      from: '구조조정팀장',
      to: '여신담당 부행장',
      subject: '기업개선계획 의결 — 문이 두 개입니다',
      body: `기업구조조정 촉진법상 기업개선계획 의결에는 요건이 **두 개** 있습니다.

1. **총 금융채권액의 4분의 3**(제24조제2항) — 현재 {{metric:consentPct}}%
2. **담보채권 총액의 4분의 3을 보유한 금융채권자의 찬성**(제17조제2항) — 채무조정이 포함된 계획에만 적용됩니다. 현재 {{metric:securedConsentPct}}%

담보를 많이 쥔 은행권·보험이 이탈하면 총액 기준을 넘고도 부결됩니다. 유예기간 내에 의결되지 않으면 그 다음 날부터 공동관리절차가 중단된 것으로 봅니다(제13조제3항).

- 자구안 약정 {{metric:selfRescuePledged}}조 중 도착 {{metric:selfRescueDelivered}}조
- 오늘 의결 마감은 **16:00** 입니다.`,
      severity: 'critical',
      relatedMetrics: [
        'consentPct',
        'securedConsentPct',
        'selfRescuePledged',
        'selfRescueDelivered',
      ],
      sourceRefs: [S.crpa, S.plan],
      cardRefs: ['korea-crisis-toolkit'],
    },
    {
      id: 't5-data-sector',
      kind: 'data',
      time: '09:20',
      title: "금융권 부동산PF 대출 현황 ('23.12말, 2024-03-22 공표)",
      rows: [
        { label: '금융권 합계', value: '135.6조원 · 연체율 2.70%' },
        { label: '은행', value: '46.1조원 · 0.35%' },
        { label: '보험', value: '42.0조원 · 1.02%' },
        { label: '여신전문', value: '25.8조원 · 4.65%' },
        { label: '저축은행', value: '9.6조원 · 6.94%' },
        { label: '증권', value: '7.8조원 · 13.73%' },
        { label: '상호금융', value: '4.4조원 · 3.12%' },
      ],
      severity: 'warning',
      sourceRefs: [S.pfStatus],
      relatedMetrics: ['market.pfSectorLoanTn', 'market.pfSectorDelinqPct'],
    },
    {
      id: 't5-plan-draft',
      kind: 'dialogue',
      atTick: 1,
      time: '11:00',
      title: '계획안 질의 — 채권단 질의응답',
      lines: [
        {
          speaker: '보험사 채권관리 담당',
          text: '무담보채권 절반을 출자전환하라는 것은 그 절반을 포기하라는 뜻입니다. 대주주는 무엇을 내놓습니까?',
        },
        {
          speaker: '구조조정팀장',
          text: '대주주 지분은 100대 1 무상감자, 일반주주는 2대 1 차등감자입니다. 지주는 워크아웃 신청 전 대여금을 전액 출자전환하고, 개시 이후 지원한 대여금은 전액 영구채로 전환합니다.',
        },
        {
          speaker: '저축은행 여신담당 임원',
          text: '신규자금은 누가 어떤 순위로 넣습니까? 그 순위가 정해지지 않으면 저희는 찬성할 수 없습니다.',
        },
      ],
      severity: 'warning',
      sourceRefs: [S.plan, S.crpa],
    },
    {
      id: 't5-news-close',
      kind: 'newswire',
      atTick: 3,
      outlet: '연합뉴스',
      time: '16:10',
      headline: '대현건설 기업개선계획 의결 마감 — 감자·출자전환 포함',
      body: '금융채권자협의회가 대현건설 기업개선계획을 의결에 부쳤다. 계획에는 대주주 100대 1 무상감자와 일반주주 2대 1 차등감자, 지주의 대여금 출자전환과 영구채 전환, 금융채권자 무담보채권의 출자전환이 포함됐다.',
      sourceRefs: [S.plan, S.pressPlan],
    },
  ],
  decisions: [
    {
      id: 't5-d1',
      title: '기업개선계획 구조',
      prompt: '무담보 금융채권을 어떻게 처리하는 계획을 상정하시겠습니까?',
      context:
        '출자전환은 손실을 오늘 확정하고 자본을 채웁니다. 만기연장은 손실을 미루지만 자본은 채우지 못합니다. 자구안 도착액이 적을수록 채권단이 메워야 할 몫이 커집니다.',
      availableFrom: 0,
      deadlineTick: 2,
      defaultOptionId: 't5-d1-b',
      timeLimitSec: 300,
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['solvency', 'policy', 'compliance'],
      options: [
        {
          id: 't5-d1-a',
          label: '무담보채권 100% 출자전환',
          description:
            '무담보 금융채권 전액을 출자전환한다. 채무자의 자본은 가장 두텁게 채워지지만 채권단 손실이 오늘 전액 확정된다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 1, bucket: 'loss' }),
            pfFx.pledgeConsent({ add: { Bank: -0.04, Nbfi: -0.1, Insurance: -0.06 } }),
            flag('debt_to_equity_full'),
          ],
          expert: {
            rating: 52,
            rationale:
              '자본확충 효과는 가장 크지만 손실을 전액 오늘 인식하므로 채권단의 반대가 커지고, 담보채권 기준 동의율까지 함께 내려간다. 계획을 통과시키지 못하는 최선안은 최선이 아니다.',
            sourceRefs: [S.crpa, S.plan],
          },
          consequences: '전액 출자전환안이 상정되었습니다. 반대 의사가 늘고 있습니다.',
          feasibility: {
            basis: '출자전환은 기업개선계획의 채무조정 수단 — 제17조제2항의 담보채권 요건 적용',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't5-d1-b',
          label: '무담보 50% 출자전환 + 50% 3년 유예, 대주주 100:1 감자',
          description:
            '무담보 금융채권의 절반을 출자전환하고 나머지 절반은 3년간 상환을 유예한다. 대주주는 100대 1 무상감자, 일반주주는 2대 1 차등감자, 지주는 대여금 출자전환과 영구채 전환으로 참여한다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 0.5, bucket: 'loss' }),
            pfFx.pledgeConsent({ add: { Bank: 0.03, Nbfi: 0.06, Insurance: 0.05, Other: 0.05 } }),
            flag('debt_to_equity_half'),
            confidence(3, '대주주 감자 포함'),
          ],
          expert: {
            rating: 78,
            rationale:
              '실제로 의결된 구조다. 채권단 손실을 절반만 확정하면서 대주주 감자로 손실 분담의 형평을 맞춰 담보채권 기준 동의까지 확보한다. 자본확충 규모는 지주 대여금 출자전환·영구채와 합쳐 약 1조원이었다.',
            historicalNote:
              '실제 기업개선계획은 대주주 100대 1·일반주주 2대 1 무상감자, 지주 대여금 전액 출자전환과 개시 후 지원 대여금 3,349억원의 영구채 전환, 금융채권자 무담보채권 50% 출자전환·50% 3년 유예로 구성되었다.',
            sourceRefs: [S.plan, S.crpa],
          },
          consequences:
            '절반 출자전환안이 상정되었습니다. 대주주 감자가 포함되면서 형평성 시비가 줄었습니다.',
          historical: true,
          feasibility: {
            basis: '무상감자·출자전환·상환유예는 기업개선계획의 표준 채무조정 수단',
            sourceRefs: [S.crpa, S.plan],
          },
        },
        {
          id: 't5-d1-c',
          label: '출자전환 없이 전액 3년 만기연장',
          description:
            '무담보채권도 출자전환 없이 전액 3년 연장한다. 채권단의 손실 인식이 오늘 없고 회계상 채권은 그대로 남는다.',
          effects: [
            pfFx.freezeClassification({ months: 36, label: '무담보채권 전액 만기연장' }),
            pfFx.pledgeConsent({ add: { Bank: -0.1, Insurance: -0.12, Securities: -0.06 } }),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { flag: 'classification_frozen' },
              description:
                '자본이 채워지지 않은 채무자의 채권을 연장만 한 것이 지적되어 재분류 지시가 내려온다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['groupUnsecured', 'groupSecured'],
                  bucket: 'doubtful',
                  share: 1,
                  surcharge: 0.25,
                  label: '무담보채권 재분류 지시',
                }),
              ],
            },
          ],
          expert: {
            rating: 20,
            rationale:
              '기업개선계획의 목적은 채무자의 자본구조를 고치는 것이다. 출자전환 없이 만기만 늘리면 부채비율이 그대로여서 정상화가 일어나지 않고, 채권단은 손실을 인식하지 않은 채 같은 위험을 3년 더 지게 된다. 감독당국의 재분류 대상이 되는 전형적인 형태다.',
            sourceRefs: [S.crpa, S.bankReg, S.pfPolicy],
          },
          consequences:
            '전액 연장안이 상정되었습니다. 오늘 인식되는 손실은 없습니다. 담보권자들이 계획의 실효성을 문제 삼습니다.',
          trap: true,
          trapExplanation:
            '만기연장은 이 시나리오 내내 가장 매력적인 선택으로 돌아온다 — 오늘 손실이 없고 채권은 장부에 남는다. 그러나 자본을 채우지 않은 정상화 계획은 3년 뒤 같은 자리로 돌아오며, 그때의 손실은 오늘보다 크다.',
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: {
            basis: '상환유예만으로 구성된 계획도 의결은 가능하나 자본구조 개선 효과가 없다',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't5-d1-d',
          label: '50% 출자전환 + 자구안 이행에 연동한 조건부 유예',
          description:
            '절반을 출자전환하고, 나머지 절반의 유예 조건을 자구안 이행률에 연동한다. 자산매각 이행률이 기준에 미달하면 유예가 자동 해제되고 담보 지분 처분권이 발동한다.',
          effects: [
            pfFx.provision({ pool: 'groupUnsecured', share: 0.5, bucket: 'loss' }),
            pfFx.pledgeConsent({
              add: { Bank: 0.06, Nbfi: 0.08, Insurance: 0.08, Securities: 0.04, Other: 0.08 },
            }),
            flag('debt_to_equity_half'),
            flag('plan_linked_to_selfrescue'),
            confidence(5, '이행 연동 조건부 계획'),
          ],
          expert: {
            rating: 88,
            rationale:
              '실제 사례가 남긴 가장 큰 교훈이 자구안 이행의 강제력이었다 — 약정 2년 뒤에도 자산매각 이행률은 절반 남짓이었고 이행평가는 B에 머물렀다. 유예를 이행률에 연동하면 자구안의 시차가 채무자 쪽에 남고, 담보채권자들도 같은 이유로 찬성한다.',
            sourceRefs: [S.mou, S.plan, S.crpa],
          },
          consequences:
            '이행 연동 조건부 계획이 상정되었습니다. 담보채권자들이 조건부 해제 조항을 이유로 찬성으로 돌아섰습니다.',
          feasibility: {
            basis: '기업개선계획에 이행 조건과 해제 트리거를 넣는 것은 협의회 의결 사항',
            sourceRefs: [S.crpa, S.mou],
          },
        },
      ],
    },
    {
      id: 't5-d2',
      title: '신규자금 분담',
      prompt: '사업 계속에 필요한 신규자금을 어떻게 조달하시겠습니까?',
      context:
        '정상진행 사업장의 공사를 이어가려면 신규자금이 필요합니다. 기촉법 제18조제2항은 신규 신용공여 채권을 법정담보권 다음 순위로 다른 금융채권에 우선 변제하도록 정합니다 — 이 순위를 계획에 명문화하면 다른 채권자도 분담에 참여할 유인이 생깁니다.',
      availableFrom: 1,
      deadlineTick: 2,
      defaultOptionId: 't5-d2-b',
      timeLimitSec: 240,
      dimensions: ['liquidity', 'policy', 'marketRisk'],
      options: [
        {
          id: 't5-d2-a',
          label: '주채권은행이 단독으로 0.35조 공급',
          description:
            '다른 채권자를 기다리지 않고 주채권은행이 전액을 넣는다. 속도는 가장 빠르지만 위험이 집중된다.',
          effects: [pfFx.newMoney({ amount: 0.35, senior: false, label: '단독 신규자금' })],
          expert: {
            rating: 42,
            rationale:
              '사업장은 살릴 수 있으나 신규 위험을 주채권은행이 혼자 진다. 우선변제권을 결의에 넣지 않으면 이 자금은 기존 채권과 같은 순위로 취급되고, 다른 채권자에게는 "주채권은행이 알아서 하겠다"는 신호가 된다.',
            sourceRefs: [S.crpa],
          },
          consequences: '단독 신규자금이 집행되었습니다. 위험이 자행에 집중되었습니다.',
          feasibility: {
            basis: '주채권은행 단독 신용공여는 내부 여신한도 내 가능',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't5-d2-b',
          label: '채권은행 6곳 신디케이트 + 우선변제권 명문화',
          description:
            '채권은행 6곳이 0.18조를 분담하고, 기촉법 제18조제2항의 우선변제권을 협의회 결의에 명문화한다. 보증기관의 신규 보증한도도 함께 요청한다.',
          effects: [
            pfFx.newMoney({ amount: 0.18, senior: true, label: '신디케이트 분담' }),
            pfFx.pledgeConsent({ add: { Nbfi: 0.06, Other: 0.08, Securities: 0.04 } }),
            flag('syndicate_formed'),
          ],
          expert: {
            rating: 84,
            rationale:
              '실제 계획도 채권은행 6곳의 신규자금과 보증기관의 신규 보증한도로 구성되었다. 분담은 위험을 나누고, 우선변제권 명문화는 후순위 채권자의 반대 이유를 없애 계획 의결의 동의율을 함께 끌어올린다.',
            historicalNote:
              '실제 기업개선계획에는 채권은행의 신규자금과 보증기관의 신규 보증한도가 포함되었다.',
            sourceRefs: [S.plan, S.crpa],
          },
          consequences:
            '신디케이트가 구성되고 우선변제권이 결의에 명문화되었습니다. 제2금융권의 태도가 누그러졌습니다.',
          historical: true,
          feasibility: {
            basis: '기촉법 제18조제2항 — 신규 신용공여의 우선변제 순위는 법정',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't5-d2-c',
          label: '신규자금 없이 자구안 도착분으로만 충당',
          description:
            '신규자금을 넣지 않고 자구안 도착액으로 공사비를 충당한다. 자구안이 실제로 도착했다면 가능하다.',
          effects: [counter('noNewMoney', 1)],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { path: 'institution.custom.selfRescueDelivered', lt: 0.5 },
              description:
                '자구안 도착액이 공사비에 미치지 못해 정상진행 사업장의 공정이 멈춘다 — 이연 손실 확대',
              effects: [
                pfFx.deferDecay({ bridgeRate: 0.05, mainRate: 0.04, label: '공사비 부족' }),
                confidence(-6, '정상진행 사업장 공정 중단'),
              ],
            },
          ],
          expert: {
            rating: 46,
            rationale:
              '자구안이 실제로 도착했다면 합리적이다. 도착하지 않았다면 정상진행 사업장까지 멈추고, 그때의 손실은 신규자금보다 크다. 이 선택의 정답은 대시보드의 자구안 도착액에 적혀 있다.',
            sourceRefs: [S.plan, S.mou],
          },
          consequences: '신규자금 없이 자구안 도착분으로 공사비를 충당합니다.',
          feasibility: { basis: '신규자금은 의무가 아니다', sourceRefs: [S.crpa] },
        },
        {
          id: 't5-d2-d',
          label: '증권사 매입확약 물량을 은행이 인수',
          description:
            '차환이 막힌 증권사 매입확약 물량을 은행이 대출로 인수한다. 증권사의 우발채무가 사라지고 그만큼 은행 익스포저가 는다.',
          effects: [
            pfFx.newMoney({ amount: 0.28, senior: false, label: '매입확약 물량 인수' }),
            op('institution.custom.pfGuarantee', 'add', 0.2, '증권사 물량 인수'),
            pfFx.pledgeConsent({ add: { Securities: 0.2 } }),
          ],
          expert: {
            rating: 34,
            rationale:
              '증권사의 표를 확실히 얻고 유동화 구조의 차환 위험도 없앤다. 그러나 신디케이트 안의 이해 상충을 은행이 통째로 떠안는 거래다 — 매입확약은 증권사가 수수료를 받고 판 위험이며, 그 위험을 은행이 우선변제권도 없이 인수할 이유는 없다.',
            sourceRefs: [S.crpa, S.fsr24],
          },
          consequences:
            '증권사 매입확약 물량을 인수했습니다. 증권사는 찬성으로 돌아섰고 자행 익스포저가 늘었습니다.',
          trap: true,
          trapExplanation:
            '표를 사는 가장 비싼 방법이다. 우발채무를 실제 대출로 바꾸면 위험가중자산과 충당금이 함께 늘고, 같은 사업장에서 증권사만 빠져나간다.',
          feasibility: {
            basis: '유동화증권의 대출 전환은 2023년 이후 실제로 이루어진 방식',
            sourceRefs: [S.fsr24],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 1,
      decisionId: 't5-d1',
      text: '대시보드의 동의율과 담보채권 기준 동의율을 함께 보세요. 요건이 두 개입니다.',
    },
    {
      level: 3,
      decisionId: 't5-d2',
      text: '신규자금을 넣기 전에 자구안 도착액을 확인하세요. 도착액이 0.5조에 못 미치면 신규자금 없이는 정상진행 사업장도 멈춥니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T6 — 2024-05-14 (화) "사업성 평가 4단계"
// ---------------------------------------------------------------------------------------------

export const t6: T = {
  id: 't6',
  label: 'T6',
  timeLabel: '2024년 5월 14일 (화) 09:00 KST',
  title: '사업성 평가 4단계',
  time: '2024-05-14T09:00:00+09:00',
  entryEffects: [
    {
      id: 't6-market-anchor',
      description: '시장 앵커를 2024-05-13 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 345.2, '국고채 3년 3.452%'),
        op('market.custom.corpAA3y', 'set', 390.4, '회사채 AA- 3년 3.904%'),
        op('market.custom.corpBBB3y', 'set', 1009.7, '회사채 BBB- 3년 10.097%'),
        op('market.creditSpreadIgBp', 'set', 45.2, 'AA- − 국고 3년 (5/13 종가)'),
        op('market.creditSpreadHyBp', 'set', 664.5, 'BBB- − 국고 3년'),
        op('market.custom.constructionPfSpreadBp', 'set', 336, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
    {
      id: 't6-ccyb',
      description:
        '2024년 5월 1일부터 경기대응완충자본 1%가 적용되어 규제 최저 CET1이 7.0%에서 8.0%로 올라간다',
      effects: [flag('ccyb_applied')],
    },
    {
      id: 't6-defer-decay',
      description: '재구조화로 넘긴 사업장의 회수율 저하가 1분기분 더 반영된다',
      effects: [
        pfFx.deferDecay({ bridgeRate: 0.18, mainRate: 0.05, label: '이연 회수율 저하(2분기)' }),
      ],
    },
  ],
  events: [
    {
      id: 't6-regulator-policy',
      kind: 'regulator',
      agency: '금융위원회·금융감독원',
      time: '08:00',
      headline: '부동산 PF의 "질서있는 연착륙"을 위한 향후 정책 방향 — 사업성 평가 4단계 도입',
      body: '정부는 부동산 PF 사업성 평가 기준을 3단계에서 4단계(양호·보통·유의·부실우려)로 세분화하고, 평가 대상에 토지담보대출과 채무보증 약정을 새로 포함하며 새마을금고를 대상 기관에 추가한다고 밝혔다. 확대 결과 평가 대상 규모는 약 230조원이다. 유의 등급은 재구조화 또는 자율매각을, 부실우려 등급은 상각 또는 경·공매를 통한 매각을 추진하도록 하고, 부실우려는 충당금을 회수의문 수준으로 적립하도록 했다. 새 기준은 6월 중 업권별 모범규준 개정을 거쳐 확정되며 1차 평가 기준일은 2024년 6월말이다.',
      tone: 'urgent',
      severity: 'critical',
      sourceRefs: [S.pfPolicy],
      cardRefs: ['korea-crisis-toolkit', 'regulator-escalation-ladder'],
    },
    {
      id: 't6-memo-capital',
      kind: 'memo',
      time: '09:30',
      from: '재무기획부장',
      to: '여신담당 부행장',
      subject: '충당금과 자본 — 규제 최저선이 이번 달부터 올라갔습니다',
      body: `- 경기대응완충자본 1%가 **2024년 5월 1일부터** 적용됩니다. 규제 최저 CET1은 4.5% + 자본보전완충 2.5% + 경기대응완충 1.0% = **8.0%** 입니다.
- 현재 CET1 **{{metric:cet1Ratio}}%**, 누적 충당금 {{metric:provisionsCum}}조원.
- 사업성 평가에서 **유의 = 고정(20%)**, **부실우려 = 회수의문(50%)** 수준으로 적립해야 합니다(은행 기준). 증권·저축은행은 각각 30%·75%로 더 높습니다.
- 자본을 지키는 길은 셋입니다: 충당금을 미루거나(재분류 지시의 대상), 자본을 늘리거나(후순위채는 총자본만 올립니다), 위험가중자산을 줄이는 것(여신 매각은 매각손을 냅니다).`,
      severity: 'critical',
      relatedMetrics: ['cet1Ratio', 'provisionsCum', 'pfCdSharePct'],
      sourceRefs: [S.ccyb, S.pfPolicy, S.bankReg],
      cardRefs: ['economic-vs-regulatory-capital'],
    },
    {
      id: 't6-news-sector',
      kind: 'newswire',
      outlet: '연합인포맥스',
      time: '11:00',
      headline: '업권별 PF 충당금 적립률 격차 — 은행 20/50%, 증권·저축은행 30/75%',
      body: '사업성 평가 4단계 도입으로 업권별 충당금 부담 격차가 드러날 전망이다. 고정·회수의문 단계의 최저적립률은 은행이 20%·50%인 반면 증권과 저축은행은 30%·75%로 더 높다. 같은 사업장을 두고도 업권별로 손실 인식 속도가 달라 신디케이트 내 이해 상충이 커질 수 있다는 분석이 나온다.',
      severity: 'warning',
      sourceRefs: [S.pfProvision, S.pfPolicy],
    },
  ],
  decisions: [
    {
      id: 't6-d1',
      title: '사업성 평가 대응',
      prompt: '새 평가 기준을 어떻게 적용하시겠습니까?',
      context:
        '1차 평가 기준일은 6월말이지만 기준은 오늘 나왔습니다. 먼저 적용하면 오늘 자본이 깎이고, 미루면 감독당국이 6월말 기준으로 일괄 적용합니다.',
      requiredConcepts: ['regulator-escalation-ladder'],
      dimensions: ['compliance', 'solvency', 'timeliness'],
      options: [
        {
          id: 't6-d1-a',
          label: '선제 적용: 이연 사업장을 유의 등급으로 자체 분류',
          description:
            '6월말을 기다리지 않고 재구조화로 넘긴 사업장 전부를 유의 등급(고정 20%)으로 분류한다. 오늘 자본이 깎이지만 감독당국의 지시를 받을 여지가 없다.',
          effects: [
            pfFx.evaluateSites({ bucket: 'substandard', coverage: 1, label: '선제 유의 분류' }),
            flag('early_evaluation'),
            confidence(3, '선제 재분류'),
          ],
          expert: {
            rating: 86,
            rationale:
              '평가 기준일은 6월말이지만 기준은 이미 공개되었고, 만기연장 3회 이상·연체 사업장이 1차 평가 대상이라는 점도 명시되었다. 먼저 적용하면 감독당국과 다툴 일이 없고, 사업성 평가 결과 발표(8월) 때 추가 부담도 없다.',
            sourceRefs: [S.pfPolicy, S.pfEval],
          },
          consequences:
            '이연 사업장이 유의 등급으로 자체 분류되었습니다. CET1이 내려갔지만 6월말 평가에서 추가 부담은 없습니다.',
          feasibility: {
            basis: '자체 선제 분류는 은행 재량 — 감독규정 최저적립률 이상',
            sourceRefs: [S.bankReg, S.pfPolicy],
          },
        },
        {
          id: 't6-d1-b',
          label: '기준대로 6월말 기준일에 평가',
          description:
            '업권별 모범규준 개정을 기다려 6월말 기준으로 평가한다. 절차상 가장 무난하다.',
          effects: [
            pfFx.evaluateSites({ bucket: 'substandard', coverage: 0.7, label: '기준일 평가' }),
          ],
          expert: {
            rating: 70,
            rationale:
              '제도가 정한 일정 그대로다. 다만 그 사이 이연 사업장의 회수율은 계속 떨어지고, 평가 결과가 나온 뒤에는 선택의 여지 없이 지시받은 대로 쌓게 된다.',
            historicalNote:
              '실제로 새 기준은 6월 7일 확정되어 6월말 기준으로 1차 평가가 이루어졌고, 8월 29일 발표에서 유의·부실우려 여신이 21.0조원(전체 익스포저 216.5조원의 9.7%)으로 집계되었다.',
            sourceRefs: [S.pfPolicy, S.pfEval],
          },
          consequences: '6월말 기준 평가 일정이 확정되었습니다.',
          historical: true,
          feasibility: {
            basis: '금융감독원이 정한 1차 평가 기준일은 2024년 6월말',
            sourceRefs: [S.pfPolicy],
          },
        },
        {
          id: 't6-d1-c',
          label: '기존 분류 유지하고 평가 기준에 이의 제기',
          description:
            '자행 사업장은 워크아웃 절차 안에 있어 일률적 평가 대상이 아니라고 주장하며 기존 분류를 유지한다.',
          effects: [
            pfFx.freezeClassification({ months: 6, label: '평가 기준 이의' }),
            regulator({ add: 1 }, '평가 기준 이의 제기'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { flag: 'classification_frozen' },
              description: '이의가 받아들여지지 않고 재분류가 지시된다 — 가산이 붙는다',
              effects: [
                pfFx.supervisorReclassify({
                  pools: ['pfBridge', 'pfMain', 'pfGuarantee'],
                  bucket: 'substandard',
                  share: 0.55,
                  surcharge: 0.35,
                  label: '평가 기준 일괄 적용',
                }),
              ],
            },
          ],
          expert: {
            rating: 22,
            rationale:
              '구조조정 절차 중인 사업장에 예외를 두는 논리는 실제로 일부 반영되었다(본PF·구조조정 대상 업체 사업장은 일률적 경공매에서 제외). 그러나 그것은 처리 방식의 예외이지 분류·충당금의 예외가 아니다. 이의는 시간을 벌지만 가산을 부른다.',
            sourceRefs: [S.pfPolicy, S.bankReg],
          },
          consequences: '이의가 접수되었습니다. 기존 분류가 유지되고 있습니다.',
          trap: true,
          trapExplanation:
            '"우리 사업장은 이미 워크아웃 안에 있다"는 주장은 절반만 맞다. 처리 방식에는 예외가 있지만 건전성 분류에는 없다.',
          remediationCard: 'regulator-escalation-ladder',
          feasibility: {
            basis: '이의 제기는 가능하나 분류 의무는 그대로',
            sourceRefs: [S.bankReg],
          },
        },
        {
          id: 't6-d1-d',
          label: '전면 부실우려 분류',
          description:
            '이연 사업장 전부를 부실우려(회수의문 50%)로 분류한다. 가장 보수적이지만 자본 충격이 크다.',
          effects: [
            pfFx.evaluateSites({ bucket: 'doubtful', coverage: 1, label: '전면 부실우려 분류' }),
            flag('early_evaluation'),
          ],
          expert: {
            rating: 44,
            rationale:
              '부실우려는 "추가 사업 진행이 곤란한" 사업장에 매기는 등급이다. 시공사 교체로 사업이 이어지는 사업장까지 부실우려로 내리면 실질에 맞지 않고, 자본이 규제 최저선에 다가가 신규자금 여력도 사라진다.',
            sourceRefs: [S.pfPolicy, S.bankReg],
          },
          consequences: '전면 부실우려 분류가 적용되었습니다. CET1이 크게 내려갔습니다.',
          feasibility: { basis: '최저적립률 초과 적립은 재량', sourceRefs: [S.bankReg] },
        },
      ],
    },
    {
      id: 't6-d2',
      title: '충당금과 자본의 상충',
      prompt: '내려간 CET1 비율을 어떻게 회복하시겠습니까?',
      context:
        '경기대응완충자본 1% 적용으로 규제 최저 CET1이 8.0%가 되었습니다. 자본을 늘리는 수단과 위험가중자산을 줄이는 수단은 효과가 다릅니다 — 후순위채는 총자본만 올리고 CET1은 올리지 않습니다.',
      requiredConcepts: ['economic-vs-regulatory-capital'],
      dimensions: ['solvency', 'marketRisk', 'policy'],
      options: [
        {
          id: 't6-d2-a',
          label: '배당을 축소하고 이익잉여금으로 자본을 쌓는다',
          description:
            '중간배당을 축소해 CET1에 직접 쌓는다. 주주 반발이 있지만 규제자본에 가장 직접적으로 반영된다.',
          effects: [
            op('institution.capital.cet1', 'add', 0.22, '배당 축소분 내부유보'),
            flag('dividend_cut'),
            confidence(-3, '배당 축소'),
          ],
          expert: {
            rating: 84,
            rationale:
              '자본보전완충자본과 경기대응완충자본의 설계 목적이 바로 이것이다 — 완충자본이 얇아지면 배당·성과급을 제한해 자본을 보전한다. 규제가 요구하기 전에 스스로 하면 감독 단계가 오르지 않는다.',
            sourceRefs: [S.ccyb, S.bankReg],
          },
          consequences: '중간배당이 축소되었고 CET1이 회복되었습니다.',
          feasibility: {
            basis: '배당 결정은 이사회 권한 — 분기 중 조정 가능',
            sourceRefs: [S.ccyb],
          },
        },
        {
          id: 't6-d2-b',
          label: '후순위채 0.4조를 발행해 총자본을 보강',
          description:
            '후순위채를 발행해 총자본비율을 올린다. 조달은 빠르지만 CET1 비율은 달라지지 않는다.',
          effects: [pfFx.raiseTier2({ amount: 0.4, costBp: 180, label: '후순위채 발행' })],
          expert: {
            rating: 58,
            rationale:
              '총자본비율은 오르지만 CET1 비율은 그대로다. 경기대응완충자본을 포함한 완충자본 요건은 **보통주자본으로** 충족해야 하므로, 이 선택은 겉보기 지표만 고친다.',
            historicalNote: '2024년 상반기 은행권은 실제로 후순위채·신종자본증권 발행을 늘렸다.',
            sourceRefs: [S.ccyb, S.bankReg],
          },
          consequences:
            '후순위채가 발행되었습니다. 총자본비율은 올랐지만 CET1 비율은 그대로입니다.',
          historical: true,
          feasibility: { basis: '후순위채 발행은 이사회 결의로 가능', sourceRefs: [S.bankReg] },
        },
        {
          id: 't6-d2-c',
          label: '여신 2.2조를 매각해 위험가중자산을 줄인다',
          description:
            '비핵심 기업여신을 매각해 위험가중자산을 줄인다. 매각손이 나지만 분모가 줄어 CET1 비율이 오른다.',
          effects: [pfFx.shrinkRwa({ amount: 2.2, lossRate: 0.035, label: '비핵심 여신 매각' })],
          expert: {
            rating: 72,
            rationale:
              '분모를 줄이는 것도 자본비율을 올리는 정당한 방법이고, 매각손 3.5%는 우량 기업여신의 현실적인 수준이다. 다만 수익 기반이 함께 줄고, 같은 시기에 업권 전체가 같은 일을 하면 매각가가 떨어진다.',
            sourceRefs: [S.bankReg, S.fsr24],
          },
          consequences: '여신 매각이 완료되어 위험가중자산이 줄었습니다.',
          feasibility: { basis: '여신 매각은 대출채권 양도 절차로 분기 내 실행 가능' },
        },
        {
          id: 't6-d2-d',
          label: '충당금 적립을 다음 분기로 미루고 배당은 유지',
          description:
            '추가 적립을 다음 분기로 넘기고 예정된 배당을 그대로 집행한다. 이번 분기 지표가 가장 좋아 보인다.',
          effects: [
            op('institution.capital.cet1', 'add', -0.3, '예정 배당 집행'),
            pfFx.freezeClassification({ months: 3, label: '충당금 이연' }),
            flag('dividend_paid'),
          ],
          delayedEffects: [
            {
              afterTurns: 1,
              when: { flag: 'classification_frozen' },
              description:
                '완충자본이 얇아진 상태에서 배당을 집행한 것이 지적되어 자본관리계획 제출이 요구된다',
              effects: [
                regulator({ add: 2 }, '완충자본 미달 중 배당 집행'),
                confidence(-8, '자본관리 신뢰 저하'),
                pfFx.supervisorReclassify({
                  pools: ['pfBridge', 'pfMain'],
                  bucket: 'substandard',
                  share: 0.5,
                  surcharge: 0.3,
                  label: '재분류 지시',
                }),
              ],
            },
          ],
          expert: {
            rating: 14,
            rationale:
              '완충자본 제도의 핵심은 완충자본이 얇아지면 배당이 제한된다는 것이다. 그 상태에서 배당을 집행하면 감독당국의 자본관리계획 요구와 재분류 지시가 함께 온다 — 충당금과 자본 모두를 잃는 유일한 선택이다.',
            sourceRefs: [S.ccyb, S.bankReg],
          },
          consequences: '배당이 집행되었습니다. CET1 비율이 더 내려갔습니다.',
          trap: true,
          trapExplanation:
            '배당을 유지하면 주주와 시장은 "문제없다"고 읽는다. 그러나 감독당국은 완충자본 수준을 먼저 보고, 배당은 그 수준의 결과여야지 신호 관리 수단이 아니다.',
          remediationCard: 'economic-vs-regulatory-capital',
          feasibility: {
            basis: '배당 집행은 이사회 권한이나 완충자본 미달 시 제한된다',
            sourceRefs: [S.ccyb],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 2,
      decisionId: 't6-d2',
      text: '완충자본 요건은 보통주자본(CET1)으로 충족해야 합니다. 후순위채는 총자본비율만 올립니다.',
    },
  ],
}

// ---------------------------------------------------------------------------------------------
// T7 — 2024-05-30 (목) "약정 체결과 사업 계속 여부"
// ---------------------------------------------------------------------------------------------

export const t7: T = {
  id: 't7',
  label: 'T7',
  timeLabel: '2024년 5월 30일 (목) 09:00 KST',
  title: '약정 체결과 사업 계속 여부',
  time: '2024-05-30T09:00:00+09:00',
  entryEffects: [
    {
      id: 't7-market-anchor',
      description: '시장 앵커를 2024-05-30 종가로 맞춘다 [ecos-817Y002]',
      effects: [
        op('market.custom.govt3y', 'set', 344.0, '국고채 3년 3.440%'),
        op('market.custom.corpAA3y', 'set', 386.7, '회사채 AA- 3년 3.867%'),
        op('market.custom.corpBBB3y', 'set', 1001.5, '회사채 BBB- 3년 10.015%'),
        op('market.creditSpreadIgBp', 'set', 42.7, 'AA- − 국고 3년 (5/30 종가)'),
        op('market.creditSpreadHyBp', 'set', 657.5, 'BBB- − 국고 3년'),
        op('market.custom.cd91', 'set', 360, 'CD(91일) 3.60%'),
        op('market.fxUsdLocal', 'set', 1379.4, '원/달러 종가 1,379.4'),
        op('market.custom.constructionPfSpreadBp', 'set', 328, '건설사 보증 PF 유동화증권 [CAL]'),
      ],
    },
    {
      id: 't7-defer-decay',
      description: '재구조화로 넘긴 사업장의 회수율 저하가 반영된다',
      effects: [
        pfFx.deferDecay({ bridgeRate: 0.18, mainRate: 0.05, label: '이연 회수율 저하(3분기)' }),
      ],
    },
    { id: 't7-refresh', description: '자사 PF 연체율 갱신', effects: [pfFx.refreshDelinquency()] },
  ],
  events: [
    {
      id: 't7-news-mou',
      kind: 'newswire',
      outlet: '연합뉴스',
      time: '10:00',
      headline: '대현건설, 기업개선계획 이행약정 체결 — 채권행사 유예 3년 연장',
      body: '주채권은행과 대현건설이 기업개선계획 이행을 위한 약정을 체결했다. 약정에 따라 채권행사 유예 기간은 3년 뒤까지 연장되며, 회사는 자산매각과 재무구조 개선 목표를 분기별로 이행평가받는다.',
      severity: 'positive',
      sourceRefs: [S.mou],
    },
    {
      id: 't7-memo-syndicate',
      kind: 'memo',
      time: '09:30',
      from: '구조조정팀장',
      to: '여신담당 부행장',
      subject: '신디케이트 내 이해 상충 — 정리하고 갈 것과 남길 것',
      body: `약정은 체결되지만 채권단 안의 셈은 아직 다릅니다.

- **선순위 vs 후순위**: 브릿지론 후순위는 경·공매 결과에 따라 회수가 0이 될 수 있습니다. 남은 사업장의 처리 순서가 곧 이들의 손실입니다.
- **은행 vs 제2금융권**: 같은 사업장을 두고도 충당금 최저적립률이 다릅니다(은행 고정 20%·회수의문 50%, 증권·저축은행 30%·75%). 손실 인식 속도가 다르면 매각·연장에 대한 선호도 갈립니다.
- **매입확약을 준 증권사**: 차환이 막히면 우발채무가 현금 유출로 바뀝니다. 사업장을 빨리 정리하려는 유인이 가장 큽니다.

약정 체결로 절차는 마무리되지만, 이 셋의 순위를 문서로 정해 두지 않으면 다음 분기마다 같은 논쟁이 반복됩니다.`,
      severity: 'warning',
      sourceRefs: [S.pfProvision, S.crpa, S.fsr24],
      cardRefs: ['pf-abcp-commitment-ncr'],
    },
    {
      id: 't7-data-status',
      kind: 'data',
      time: '11:00',
      title: '약정 체결 시점 현황',
      rows: [
        { label: '채권단 동의율', value: '{{metric:consentPct}}%' },
        { label: 'CET1 비율', value: '{{metric:cet1Ratio}}%' },
        { label: '누적 충당금', value: '{{metric:provisionsCum}}조원' },
        { label: '부동산 PF 익스포저', value: '{{metric:pfExposure}}조원' },
        {
          label: '자구안 약정 / 도착',
          value: '{{metric:selfRescuePledged}} / {{metric:selfRescueDelivered}}조원',
        },
      ],
      relatedMetrics: ['consentPct', 'cet1Ratio', 'provisionsCum', 'pfExposure'],
      sourceRefs: [S.mou],
    },
  ],
  decisions: [
    {
      id: 't7-d1',
      title: '이행약정 조건',
      prompt: '이행약정을 어떤 조건으로 체결하시겠습니까?',
      context:
        '약정은 절차의 끝이 아니라 관리의 시작입니다. 이행평가 주기와 미이행 시의 효과를 어떻게 정하느냐가 이후 3년의 회수를 결정합니다.',
      dimensions: ['policy', 'compliance', 'timeliness'],
      options: [
        {
          id: 't7-d1-a',
          label: '3년 약정 + 분기 이행평가 + 자산매각 이행률 목표',
          description:
            '채권행사 유예를 3년 연장하고 분기마다 이행평가를 받게 한다. 자산매각 이행률 목표를 약정에 명시하되 미이행 시의 효과는 별도로 정하지 않는다.',
          effects: [flag('mou_signed'), confidence(4, '이행약정 체결')],
          expert: {
            rating: 74,
            rationale:
              '실제로 체결된 형태다. 분기 이행평가는 관리 수단으로 작동하지만, 미이행 시 자동으로 발동하는 장치가 없으면 평가 등급만 남는다 — 실제 사례에서도 약정 2년 뒤 자산매각 이행률은 절반 남짓에 머물렀다.',
            historicalNote:
              '실제 약정은 2024년 5월 30일 체결되어 2027년 5월 30일까지이며, 이후 이행평가와 자산매각 이행률이 계속 쟁점이 되었다.',
            sourceRefs: [S.mou, S.crpa],
          },
          consequences: '3년 이행약정이 체결되었습니다. 분기마다 이행평가가 이루어집니다.',
          historical: true,
          feasibility: {
            basis: '기업개선계획 이행을 위한 약정 — 기촉법상 주채권은행과 기업이 체결',
            sourceRefs: [S.crpa, S.mou],
          },
        },
        {
          id: 't7-d1-b',
          label: '1년 단기 약정 후 재평가',
          description:
            '약정 기간을 1년으로 짧게 잡고 재평가한다. 통제력은 커지지만 사업장의 시계가 짧아진다.',
          effects: [flag('mou_signed'), counter('shortMou', 1)],
          expert: {
            rating: 50,
            rationale:
              '통제력은 커지지만 PF 사업장의 준공·분양 주기는 1년보다 길다. 약정이 곧 끝난다는 사실 자체가 시공사 교체 협상과 신규 분양의 걸림돌이 된다.',
            sourceRefs: [S.crpa, S.nice],
          },
          consequences: '1년 약정이 체결되었습니다. 사업장 협상에서 기간이 문제로 제기됩니다.',
          feasibility: { basis: '약정 기간은 협의회가 정한다', sourceRefs: [S.crpa] },
        },
        {
          id: 't7-d1-c',
          label: '약정 없이 개별 여신 관리로 전환',
          description:
            '공동관리절차를 종료하고 각 채권자가 개별 여신으로 관리한다. 협의 부담이 사라진다.',
          effects: [
            confidence(-10, '공동관리 종료'),
            pfFx.deferDecay({ bridgeRate: 0.06, mainRate: 0.03, label: '조율 실패에 따른 손실' }),
          ],
          expert: {
            rating: 22,
            rationale:
              '약정 없이 절차를 끝내면 채권행사 유예도 함께 끝난다. 개별 회수 경쟁이 다시 시작되고 사업장 회수가치가 먼저 파괴된다 — 이 시나리오가 첫 턴에 피했던 상황으로 돌아가는 것이다.',
            sourceRefs: [S.crpa, S.fsr24],
          },
          consequences: '공동관리절차가 종료되었습니다. 개별 회수가 다시 시작됩니다.',
          trap: true,
          trapExplanation:
            '절차가 마무리 단계에 오면 관리 비용이 커 보이고 약정은 형식처럼 느껴진다. 그러나 약정이 유예의 근거이므로 약정을 끝내면 유예도 끝난다.',
          feasibility: { basis: '공동관리절차 종료는 협의회 의결로 가능', sourceRefs: [S.crpa] },
        },
        {
          id: 't7-d1-d',
          label: '3년 약정 + 미이행 시 자동 발동 조항',
          description:
            '3년 약정에 자산매각 이행률·재무비율 목표를 넣고, 미달 시 담보 지분 처분권과 유예 해제가 자동으로 발동하도록 한다.',
          effects: [
            flag('mou_signed'),
            flag('mou_trigger'),
            confidence(5, '이행 트리거 포함 약정'),
          ],
          expert: {
            rating: 88,
            rationale:
              '실제 사례가 남긴 가장 분명한 교훈이다. 약정은 있었지만 미이행 시 자동으로 발동하는 장치가 없었고, 2년이 지나도록 자산매각 이행률은 절반 남짓, 이행평가는 B에 머물렀다. 트리거가 있어야 이행 여부가 채무자의 문제로 남는다.',
            sourceRefs: [S.mou, S.crpa, S.kdi],
          },
          consequences:
            '이행 트리거가 포함된 3년 약정이 체결되었습니다. 자산매각 목표 미달 시 유예가 자동 해제됩니다.',
          feasibility: {
            basis: '약정의 해제 조건·담보 처분권 특약은 당사자 합의로 가능',
            sourceRefs: [S.crpa, S.mou],
          },
        },
      ],
    },
    {
      id: 't7-d2',
      title: '신디케이트 내 이해 상충 정리',
      prompt: '채권단 안의 서로 다른 셈을 어떻게 정리하시겠습니까?',
      context:
        '선순위와 후순위, 은행과 제2금융권, 매입확약을 준 증권사의 이해가 다릅니다. 같은 사업장에서도 충당금 최저적립률이 업권마다 달라 손실 인식 속도가 갈립니다.',
      dimensions: ['policy', 'communication', 'marketRisk'],
      options: [
        {
          id: 't7-d2-a',
          label: '선·후순위 원칙대로 배분하고 매입확약은 계약대로 이행 요구',
          description:
            '약정된 순위대로 회수를 배분하고 증권사 매입확약은 계약대로 이행을 요구한다. 분쟁 소지는 남지만 원칙이 명확하다.',
          effects: [flag('seniority_respected')],
          expert: {
            rating: 72,
            rationale:
              '계약과 법정 순위를 지키는 것이 기본이다. 다만 업권별 충당금 적립률 차이 때문에 같은 제안에 대한 선호가 계속 갈리고, 분기마다 같은 논쟁이 반복된다.',
            historicalNote: '실제로도 채권단 내 이해 상충은 약정 이후에도 계속 쟁점이었다.',
            sourceRefs: [S.crpa, S.pfProvision],
          },
          consequences: '원칙대로 배분하기로 했습니다. 이견은 남았지만 기준은 명확합니다.',
          historical: true,
          feasibility: { basis: '약정된 순위에 따른 배분', sourceRefs: [S.crpa] },
        },
        {
          id: 't7-d2-b',
          label: '제2금융권 채권을 매입해 채권단을 단일화',
          description:
            '제2금융권 채권 0.6조를 액면의 72%에 매입해 의사결정을 단순화한다. 협의 비용이 사라지지만 위험이 집중된다.',
          effects: [
            pfFx.buyoutDissenters({
              group: 'Nbfi',
              amount: 0.6,
              priceRatio: 0.72,
              label: '제2금융권 채권 매입',
            }),
          ],
          expert: {
            rating: 46,
            rationale:
              '의사결정은 빨라지지만 위험이 한 기관에 모인다. 매입 가격이 실제 회수가치보다 높으면 그 차이가 그대로 손실이며, 이미 규제 최저선이 8.0%로 올라간 상태에서 위험가중자산을 늘리는 선택이다.',
            sourceRefs: [S.crpa, S.ccyb],
          },
          consequences: '제2금융권 채권을 매입했습니다. 채권단은 단순해졌고 익스포저는 늘었습니다.',
          feasibility: { basis: '채권 양수는 당사자 합의로 가능', sourceRefs: [S.crpa] },
        },
        {
          id: 't7-d2-c',
          label: '후순위 채권자에게 추가 양보로 분쟁을 마무리',
          description:
            '후순위 채권자의 회수 순위를 끌어올려 분쟁을 끝낸다. 당장 조용해지지만 선순위의 근거가 무너진다.',
          effects: [
            pfFx.pledgeConsent({ add: { Nbfi: 0.08, Bank: -0.1, Insurance: -0.12 } }),
            confidence(-6, '순위 원칙 훼손'),
            regulator({ add: 1 }, '채권자 형평성 문제'),
          ],
          expert: {
            rating: 26,
            rationale:
              '순위는 계약과 법으로 정해진 것이고 협상으로 바꾸면 선례가 된다. 다음 사업장에서 같은 요구가 반복되고, 담보를 쥔 채권자들이 협의 자체에서 이탈한다.',
            sourceRefs: [S.crpa],
          },
          consequences:
            '후순위에게 추가 양보가 이루어졌습니다. 선순위 채권자들이 문제를 제기합니다.',
          trap: true,
          trapExplanation:
            '분쟁을 끝내는 가장 빠른 방법은 요구를 들어주는 것이다. 그러나 순위를 협상 대상으로 만들면 이후 모든 사업장에서 같은 협상이 반복된다.',
          feasibility: {
            basis: '순위 변경은 협의회 의결 사항이나 형평성 원칙의 제약을 받는다',
            sourceRefs: [S.crpa],
          },
        },
        {
          id: 't7-d2-d',
          label: '사업장별 대주단 협약으로 재편하고 순위를 문서화',
          description:
            '남은 사업장마다 대주단 협약을 새로 맺어 선·후순위, 신규자금 우선변제, 처분 절차를 문서로 확정한다. 업권별 충당금 차이를 인정하고 처리 시한을 함께 정한다.',
          effects: [
            flag('seniority_respected'),
            flag('site_accords'),
            pfFx.pledgeConsent({ add: { Nbfi: 0.05, Securities: 0.06, Other: 0.06 } }),
            confidence(4, '사업장별 순위 문서화'),
          ],
          expert: {
            rating: 86,
            rationale:
              '이해 상충은 없앨 수 없고 관리할 수 있을 뿐이다. 사업장 단위로 순위와 처리 시한을 문서화하면 업권별 손실 인식 속도가 달라도 다툼이 절차 안에서 끝난다. 2024년 6월 개정된 대주단 협약이 2회 이상 만기연장 시 외부 사업성 평가를 의무화하고 동의 요건을 3분의 2에서 4분의 3으로 올린 것도 같은 방향이다.',
            sourceRefs: [S.accord2024, S.crpa, S.pfPolicy],
          },
          consequences:
            '사업장별 대주단 협약이 재편되었습니다. 순위와 처리 시한이 문서로 확정되었습니다.',
          feasibility: {
            basis:
              '사업장별 대주단 협약 체결은 채권금융기관 간 합의로 가능 (3개 이상 기관·총채권 100억 이상)',
            sourceRefs: [S.accord, S.accord2024],
          },
        },
      ],
    },
  ],
  advisorHints: [
    {
      level: 3,
      decisionId: 't7-d1',
      text: '약정에 목표만 넣고 미이행 시의 효과를 넣지 않으면 이행평가 등급만 남습니다.',
    },
  ],
}

export const turnsB: T[] = [t4, t5, t6, t7]
