# 2021 아케고스(Archegos) 사태 (archegos-2021)

> 원 출처: 구현 계획서 부록 B-3.

## 역할 / 기관
- 플레이어 역할: 프라임브로커(Prime Broker, PB) 리스크 헤드
- 등장 기관: 아케고스 캐피털(Archegos Capital Management), CS(Credit Suisse), 노무라(Nomura), MS(Morgan Stanley), GS(Goldman Sachs), UBS, ViacomCBS, Paul Weiss(CS 외부 조사), SEC/DOJ, Fed/PRA/FINMA

## 타임라인(검증)
| 일자 | 사건 |
|---|---|
| 2019 | CS 스왑 마진 ~20%→7.5% |
| 2020.4 | CS PE(Potential Exposure) 한도 $20m 10배 초과 |
| 2020.8 | PE $530m — 디리스킹 없음 |
| 2020.9 | CS 스왑 마진 <6%(표준 15~25%) |
| 2021.3 | 정점 NAV >$36bn, 총익스포저 $160bn(TRS(Total Return Swap), 복수 PB, 집중도 은폐) |
| 3/22 | ViacomCBS $3bn 증자 발표 |
| 3/24~25 | 마진콜 |
| **3/25** | 디폴트; MS 당일 밤 ~$5bn 매도 |
| 3/26 | GS ~$10.5bn 블록 매도, 총 ~$19~20bn |
| 3/29 | 노무라·CS 손실 경고 |
| 7/29 | Paul Weiss 보고서(23명 징계, $70m 환수) |
| 11월 | CS 프라임 서비스 철수 |
| 2022.4.27 | SEC/DOJ 기소 |
| 2023.7.24 | Fed $268.5m, PRA £87m, FINMA 시정조치 |

## 핵심 정량지표
| 지표 | 값 |
|---|---|
| CS 스왑 마진 | ~20%(2019 이전) → 7.5%(2019) → <6%(2020.9); 표준 15~25% |
| CS PE 한도 / 실제 | $20m / 10배 초과(2020.4), $530m(2020.8) |
| 정점 NAV | >$36bn(2021.3) |
| 총익스포저 | $160bn(TRS, 복수 PB) |
| 3/25~26 청산 규모 | MS ~$5bn + GS ~$10.5bn 블록, 총 ~$19~20bn |
| 손실 | **CS $5.5bn, 노무라 ~$2.9bn, MS $911m, UBS $774m, 총 >$10.4bn** |
| 제재 | Fed $268.5m, PRA £87m, FINMA 시정(2023.7.24) |
| CS 내부 징계 | 23명, $70m 환수(Paul Weiss 2021.7.29) |

## 의사결정 지점
1. **마진 조건** — 정적(static) vs 동적(dynamic) + 집중도 가산
2. **한도 초과 대응** — 에스컬레이션 vs 최우수 고객 수용(5개월 유예)
3. **카운터파티 투명성** — 타 PB 노출 집계 요구 vs 상한
4. **3/25 죄수의 딜레마** — 질서 있는 청산 조율 vs 선매도: GS/MS 선매도 → 손실 미미, CS/노무라 대기 → 대손실
5. **프라임브로커리지 잔류 여부** — CS 11월 철수

## 교훈 및 공식 사후평가 출처
- **Paul Weiss 2021.7.29**: "경영·통제의 근본적 실패"
- **Fed/PRA/FINMA 2023 제재**
- **SEC PR 2022-70**
- **FSB NBFI(Non-Bank Financial Intermediation) 레버리지** 보고
- **BdE(Banco de España) FSR 41**

## 미확인 항목 (구현 시 재검증)
- 부록 B-3에 명시적 [미확인]·[2차] 표기 항목은 없음
- 근사치(~) 표기 항목(MS ~$5bn, GS ~$10.5bn, 총 ~$19~20bn, 노무라 ~$2.9bn, 마진 ~20%)은 게임 데이터 사용 시 1차 출처 수치로 고정 필요

## 출처
- Paul, Weiss, Rifkind, Wharton & Garrison LLP, Credit Suisse Archegos 조사 보고서(2021.7.29)
- Federal Reserve Board 제재 발표(2023.7.24), PRA 제재, FINMA 시정조치
- SEC Press Release 2022-70(2022.4.27), DOJ 기소
- FSB, NBFI 레버리지 관련 보고
- Banco de España, Financial Stability Review 41

---

## 2026-09 정확도 점검 — `[VERIFY]` 해소 기록

`src/scenarios/archegos-2021`의 `[VERIFY]` 15건을 1차 출처에 대조했다. 1건이 닫혔고, 14건은
`[VERIFY]`로 남되 **해소 문서를 실제로 존재하는 것으로 바꾸었다**(종전 주석이 지목하던 문서 하나는
존재하지 않음을 확인했다). 값이 바뀐 행은 없다.

### 닫힌 항목

| 항목 | 결과 | 원문 |
|---|---|---|
| MUFG 실현 손실 $270m | 확인 (값 변동 없음) | 미쓰비시UFJ증권홀딩스(MUSHD) 2021-03-31 공시 "Progress report: Potential Loss Arising from Business Activities" — "our final potential loss will be approximately **USD 270million**" (`https://www.hd.sc.mufg.jp/english/news/000019905.pdf`). 전날 3/30 공시는 "approximately USD 300 million"을 초기 추정으로 적는다(`…/000019897.pdf`). 두 공시 모두 "Archegos"를 명시하지 않고 "a US client"로만 적는다. **MUFG 20-F에는 "Archegos" 언급이 없음을 EDGAR 전문검색으로 확인**했으므로, 종전 주석이 지목하던 영국 Companies House 연차보고서보다 이 공시가 직접적이다 |

### 종전 해소 문서의 오류 하나

`anchor.viac.close0324`·`close0325`·`disca.close0325`의 주석은 **"ViacomCBS 2021 Form 10-K의 분기
주가 범위 표"** 를 해소 문서로 지목하고 있었다. **그 표는 존재하지 않는다** — FAST Act 현대화(2019)로
Regulation S-K Item 201(c)의 분기 고저가 표 요건이 폐지되었고, `viac-20211231.htm` 본문 검색으로도
없음을 확인했다. EDGAR 전문검색 결과 ViacomCBS의 2021년 제출물 중 "last reported sale price"를 담은
것은 **3/23 종가 $91.25**(424B5 2건 · FWP 1건 · 8-K 별첨 2건)뿐이다. 세 행의 해소 문서를
**Nasdaq Global Select Market 공식 종가(NOCP) 기록 또는 CRSP 일별 주식 파일(WRDS)** 로 교체했다.

### 새로 확인한 1차 자료

- **SEC v. Hwang 소장**(S.D.N.Y. 1:22-cv-03402, 2022-04-27). ¶163이 `anchor.ms.blockNotional0325`의
  **거래 존재와 시점**을 확인한다 — "After market close on March 25, Archegos worked with CP6 to
  execute a block trade to obtain further liquidity to satisfy outstanding margin calls; the block's
  discount further added to Archegos's losses." 카운터파티는 CP6으로 익명 처리되고 **금액은 없다**.
  자본 경로도 날짜별로 적는다: 3/22 $36bn 초과 → 3/23 $36.2 → $32.7bn → 3/24 $16.9bn(−48%) →
  3/25 $9.2bn(−46%). 개별 종목의 일별 종가는 $100.34 외에는 없다.
- **SEC MIDAS "Metrics by Individual Security" 2021Q1**
  (`individual_security_2021_q1.zip` 안 `q1_2021_all.csv`). 종목·일자별 체결주식수(주문형 거래소
  합계, 장외 TRF 미포함). 직접 내려받아 계산한 값:

  | | 2/1~2/28 평균 | 3/22까지 20영업일 평균 | 3/22 | 3/23 | 3/24 | 3/25 | 3/26 |
  |---|---|---|---|---|---|---|---|
  | VIAC | 5.38M | **8.48M** | 5.79M | 17.74M | 36.61M | 19.93M | 98.98M |
  | DISCA | 3.56M | **4.71M** | 4.96M | 5.23M | 8.48M | 7.45M | 57.53M |

  3/22의 VIAC 거래량이 직전 2주 중 최저였다가 3/23에 세 배로 뛰는 모양은, **공모 발표 충격이
  3/23에 들어왔다**는 424B5·SEC 소장의 서술과 정합한다(아래 Paul Weiss 불일치 참조).
  이 파일에는 **외국 발행인 ADR이 수록되지 않는다** — 수록 종목 6,371개 중 BIDU·TME·VIPS·GSX는 없다.
- **Paul Weiss 보고서 EDGAR 사본**(CS Form 6-K Ex. 99.2, 2021-07-29, CIK 1053092). 3/25 저녁
  공동 통화의 자기자본 구간을 직접 적는다 — "while it still had $9 to $10 billion in equity …, it had
  $120 billion in gross exposure ($70 billion [long] …)". `anchor.archegos.equityDisclosed0325`의
  종전 주석("보도 기반이며 1차 문서로 확인되지 않았다")은 사실과 달라 정정했고, 중간값 9.5는
  관측값이 아니므로 `[STYLIZED]` → `[CAL]`로 옮겼다.

### 발견한 불일치 하나 (미해소)

Paul Weiss 보고서는 "ViacomCBS stock … dropping **6.7% on March 22** alone"이라고 적는다. 이는
시나리오가 쓰는 경로(3/22 종가 $100.34 = 사상 최고, 3/23 −9.06% → $91.25)와 맞지 않는다.
반대편 근거가 더 강하다 — (a) 424B5·FWP가 "Last Reported Sale Price … on **March 23, 2021: $91.25**"를
명시하고, (b) SEC 소장 ¶148이 "After market close on Monday, March 22 … announced a $3 billion
secondary offering …, precipitating an approximately 10% drop in its share price **the next trading
day**"라고 적으며, (c) MIDAS 거래량이 3/22 저조 → 3/23 급증을 보인다. 시나리오 값은 그대로 두고
이 불일치만 기록한다. Paul Weiss의 6.7%가 장중 고가 대비인지 CS 내부 마크 기준일인지는 확정하지 못했다.

### 남은 `[VERIFY]` 14건과 해소 문서

| 항목 | 해소 문서 |
|---|---|
| 종목별 일평균거래**대금** 6건 | VIAC·DISCA는 SEC MIDAS 2021Q1에 일별 체결주식수가 있으나 **금액 환산에 같은 창의 일별 종가가 더 필요**하다 → CRSP 일별 주식 파일(WRDS). ADR 4종(BIDU·TME·VIPS·GSX)은 MIDAS에 없으므로 CRSP 또는 NYSE·Nasdaq 공식 기록 |
| VIAC 3/24 $70.10 · 3/25 $66.35, DISCA 3/25 $57.75 | Nasdaq Global Select Market 공식 종가(NOCP) 기록 또는 CRSP 일별 주식 파일 |
| `turns.t3.viacMove` −23.18% · `turns.t4.viacMove` −5.35% | 위 종가와 같은 문서(양 끝이 미확인 종가다) |
| 모건스탠리 3/25 야간 선매도 ≈$5bn | 미 상원 은행위 2021-04-07 서한에 대한 각 은행 회신 공개본(회신 기한 2021-04-22), 또는 Tan v. Goldman Sachs Group Inc.(S.D.N.Y. 1:21-cv-08413) 제2차 수정 소장의 피고별 매도 명세 |
| 2020-04-01 IG OAS 303bp · HY OAS 880bp | 무료 FRED API 키로 `BAMLC0A0CM`·`BAMLH0A0HYM2`를 `observation_date=2020-04-01`로 조회. 공개 계열 교차 확인은 직접 수행 — DBAA 4.59 · DAAA 2.76 · DGS10 0.62 → Baa−10y 397bp, Aaa−10y 214bp로 303bp는 그 사이에 든다 |

T2가 세우는 2021-03-23의 IG OAS 92bp는 같은 날 Aaa−10y 140bp(DAAA 3.03 − DGS10 1.63)보다 **낮다**.
무디스 계열이 만기 20~30년 장기채라 곡선이 가파른 국면에서는 "감싸기" 교차 확인이 성립하지 않기
때문이며, 수준은 FRED API 키로 확정해야 한다.

### 체크포인트 이동 — 없음

값이 바뀐 행이 없으므로 체크포인트도 움직이지 않았다(7개 체크포인트 전부 재현 확인).
