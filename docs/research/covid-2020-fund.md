# 2020년 3월 코로나 '현금 확보 쇄도'(dash for cash) (covid-2020-fund)

> 원 출처: 구현 계획서 부록 B-2.
> 원 요청 대비 수정: 2020년 3월 베이시스 트레이드 "$1T+"는 2023~24 추정치(2020년 2월은 ≈$664B).

## 역할 / 기관
- 플레이어 역할: 채권펀드 PM(Portfolio Manager)
- 대안 역할: 기업 재무담당(Corporate Treasurer)
- 등장 기관: 연준(Federal Reserve), 미 재무부, SEC, FSB(Financial Stability Board), CCP(Central Counterparty, 중앙청산소; CME 등), 프라임 MMF(Money Market Fund), 회사채 ETF(LQD), 한국은행(통화스와프 상대)

## 타임라인(검증)
| 일자 | 사건 |
|---|---|
| 3/3 | 연준 긴급 50bp 인하 |
| 3/9 | 첫 서킷브레이커, S&P −7.6%, 미 10년 0.54% 저점 |
| 3/12 | 2차 서킷브레이커, LQD NAV 대비 ~−5%(최대 −5.35%) |
| 3/15 | 기준금리 0~0.25% + 국채 ≥$500bn·MBS ≥$200bn 매입 |
| **3/16** | 3차 서킷브레이커, S&P −11.98%, VIX 82.69 사상 최고 |
| 3/17 | CPFF(Commercial Paper Funding Facility)·PDCF(Primary Dealer Credit Facility) |
| 3/18 | MMLF(Money Market Mutual Fund Liquidity Facility), 4차 서킷브레이커, 10년 1.18%(국채-주식 동반 매도, 베이시스 트레이드 청산) |
| 3/19 | 9개국 통화스와프(한국 $60bn) |
| 3/23 | 무제한 QE + PMCCF/SMCCF/TALF; IG/HY 스프레드 정점 |
| 3/31 | FIMA 레포(Foreign and International Monetary Authorities Repo Facility) |
| 4/9 | 최대 $2.3tn(Main Street $600bn, 회사채 프로그램 $850bn, MLF(Municipal Liquidity Facility) $500bn, 추락천사(fallen angel) HY 포함) |
| 4/20 | WTI 5월물 −$37.63 |

## 핵심 정량지표
| 구분 | 지표 | 값 | 검증 |
|---|---|---|---|
| 유동성 | IG 거래비용 | 30→90bp | ✔ |
| 유동성 | 블록 거래비용 | 24→150bp+ | ✔ |
| 펀드 유출 | 채권 뮤추얼펀드 3월 유출 | >$250bn(~5% AUM) | ✔ |
| 펀드 유출 | 회사채 펀드+ETF 2주 | $174bn | ✔ |
| 펀드 유출 | 기관 프라임 MMF(3/6~26) | ≈$100bn(3주 내 16% AUM) | ✔ |
| 기업 | 리볼버(revolver) 인출(3~4월) | $284bn(IG 과반) | ✔ |
| 레버리지 | 베이시스 트레이드(2월) | ≈$664bn, 3월 −$127bn | ✔ |
| 마진 | CCP 개시증거금(IM) | +$300bn(+40%) | ✔ |
| 마진 | 3/9 변동증거금(VM) | $140bn | ✔ |
| 마진 | CME E-mini IM | $6,600→$12,000 | ✔ |
| 발행 | 3/23 이후 IG 발행(~5/20) | $625bn | ✔ |
| 스프레드 | IG OAS 정점 | ~373bp(Bloomberg) / ~401bp(ICE) | △ |
| 스프레드 | HY 정점 | ~1,100bp | [미확인] |
| ETF | LQD NAV 괴리 | −5.35%(2020.3) | ✔ |
| 시장 | VIX(3/16) | 82.69(사상 최고) | ✔ |
| 시장 | S&P(3/16) | −11.98% | ✔ |
| 시장 | 미 10년 | 0.54%(3/9) → 1.18%(3/18) | ✔ |

## 의사결정 지점
1. **기업 재무: 리볼버 인출 여부** — 은행 B/S 압박·신호 효과 vs 접근 상실
2. **자산운용: 환매 충당 매도 순서** — 유동성 있는 것 먼저 vs 비례; 스윙프라이싱(swing pricing)·희석방지
3. **프라임 MMF: 30% WLA(Weekly Liquid Assets) 게이트 접근** — 선제 런 유발
4. **베이시스 트레이더: 청산 vs 유지**
5. **개방형 펀드(OEF, Open-Ended Fund) 게이트**

## 교훈 및 공식 사후평가 출처
- **FSB Holistic Review 2020**
- **Fed FSR(Financial Stability Report) 2020.5**
- **FEDS Note 2020.10**
- **BCBS-CPMI-IOSCO 마진 검토(d526)**
- **SEC 2023 MMF 개혁**: 게이트 폐지, DLA 25%/WLA 50%, 일일 순환매 >5% 시 의무 유동성 수수료
- **FSB OEF 2023.12**: 희석방지 도구 우선

## 미확인 항목 (구현 시 재검증)
- HY 스프레드 정점 ~1,100bp [미확인]
- IG OAS 정점 ~373bp(Bloomberg)/~401bp(ICE) — 출처별 상이(계획서 정확성 리뷰 항목: "IG OAS 373bp")
- 베이시스 트레이드 규모: 2020.2 ≈$664B 사용, "$1T+"는 2023~24 추정치이므로 미사용

## 출처
- FSB, Holistic Review of the March Market Turmoil(2020)
- Federal Reserve, Financial Stability Report(2020.5)
- FEDS Notes(2020.10)
- BCBS-CPMI-IOSCO, Review of margining practices(d526)
- SEC, Money Market Fund Reforms(2023)
- FSB, Open-Ended Funds 권고(2023.12)
- Bloomberg / ICE 지수(IG OAS)

## 정확성 검증 결과 (2026-09) — 접근 경로와 반증

### 1. 회사채 ETF의 NAV 대비 괴리는 발행사 공시로 닫힌다

SEC **Rule 6c-11(c)(1)(ii)**는 ETF에 프리미엄/할인을 웹사이트로 공시하게 하고, 그 대신 연차보고서(N-CSR)의
빈도표 의무를 면제한다. 그래서 LQD의 2020년 괴리 계열은 **SEC 공시가 아니라 iShares 웹페이지**에 있다.
현행 페이지는 최근 기간만 노출하므로 아카이브본을 쓴다:

```
https://web.archive.org/web/20210115084252id_/https://www.ishares.com/us/products/239566/
  ishares-iboxx-investment-grade-corporate-bond-etf/1467271812595.ajax?tab=premium-discount-chart
```

응답 본문에 `Date.UTC(2020,2,19),y:Number((-5.080372257341182).toFixed(2))` 형태로 일별 값이 그대로 들어
있다. 2020년 3월: 3/11 −3.2943 · **3/12 −5.0239** · 3/13 −0.4550 · 3/16 −1.6425 · 3/17 −2.2708 ·
3/18 −2.2528 · **3/19 −5.0804(연중 최대 할인)** · 3/20 −2.7798 · 3/23 +2.9341 · 3/24 +2.8127 ·
**3/25 +5.0396(연중 최대 프리미엄)**. 같은 아카이브본의 NAV 계열(3/12 124.178582 · 3/19 110.672579)로도
재현된다.

**세 숫자를 구분한다.** −5.08%는 **LQD 자신의 NAV 기준 3/19** 값이다. 널리 인용되는 **−5.35%는 같은
3/19을 ICE 평가가격 기준으로 잰 값**(ICE Market Pulse, "Exchange traded funds in volatile markets")이고,
언론의 **−4.5%는 3/12을 "fair value" 기준으로** 적은 값이다. BIS Bulletin No 6(2020-04-14) p.4가
"some of the largest ETFs in both the IG and HY segments recorded NAV discounts in excess of 5%"로
규제기관 교차확인을 준다(Graph 2 범례에 LQD 명시). 같은 쪽의 **5.3%는 IG ETF 횡단면 평균**이므로
LQD 값과 혼동하지 않는다. ICI 보고서의 **365bp**는 IG 채권 ETF 자산가중 평균이다.

### 2. "회사채 펀드+ETF 2주간 $174bn"은 FSB Holistic Review에 없다

전문(60쪽)을 기계 판독한 결과 "174"는 각주의 트위터 URL 조각 외에 등장하지 않으며, 회사채 펀드+ETF의
2주간 유출액이라는 항목 자체가 없다. 보고서가 싣는 값은 §4.2(인쇄본 p.21)의
*"in mid-March, weekly outflows from bond funds reached record levels (US$109 billion)"* 이다(EPFR·FSB 계산).
규모 정합성: ICI는 3/18·3/25 종료 2주간 IG 채권 ETF 순유출을 약 **$23bn**으로, FSOC 2020 연차보고서는
3월 한 달 채권 뮤추얼펀드 유출을 **$255bn**으로 적는다 — $174bn을 "2주"에 놓으면 자리가 없다.

### 3. FRA-OIS는 공표 문헌에 값이 없다 — LIBOR-OIS를 대용하지 말 것

FRA-OIS를 **이름으로만** 쓰는 1차 문헌: 뉴욕연준·재무부 『Treasury and Federal Reserve Foreign Exchange
Operations, Q1 2020』 p.5, IMF GFSR 2020-04 Fig 1.1(값 없는 변화폭 막대). BIS QR 2020-06 · 연준 FSR
2020-05 · 2020-03-15 FOMC 의사록에는 "FRA"라는 단어가 없다. 값이 필요하면 블룸버그 `USFOSC1 BGN Curncy`
(3x6 USD LIBOR FRA − 대응 선도 OIS)이고, 무료 경로는 CME 유로달러(GE) 정산가 − 30일 연방기금선물(ZQ)
OIS 스트립 재구성이다.

**인접 계열은 확보했다.** 연준 FEDS Notes 2020-06-29 "How Correlated is LIBOR with Bank Funding Costs?"
**Figure 1의 접근성(accessible) 버전**이 3개월 LIBOR-OIS 일별 표를 그대로 공표한다 —
2020-02-27 16.12 · **2020-02-28 26.60** · 03-02 17.27 · 03-23 111.39 · **03-31 138.17(3월 최대)** bp.
다만 2020-02-28은 시장이 긴급 인하를 선반영해 현물·선도 지표가 갈라진 날이므로 FRA-OIS 대용이 될 수 없다
(3/3 51.53 → 3/4 23.52의 급등락은 회의간 인하에 따른 현물 고시 artefact다).

### 4. ICE BofA OAS의 3년 제한은 라이선스 제약임이 확인되었다

2026-09 재확인: `fredgraph.csv?id=BAMLC0A0CM,BAMLH0A0HYM2`는 2023-09-12 이후 795건만 반환하고,
`cosd`·`coed`를 붙여도 **바이트 단위로 동일한 파일**이 온다. 같은 요청에 `DGS10`을 섞으면 DGS10만 1962년부터
16,877건이 온다 — 즉 다운로드 상한이 아니라 ICE 계열에 붙은 제약이다. 연준 FSR 2020-11도 이 계열에 대해서는
"Source: ICE Data Indices, LLC, used with permission"만 달고 값을 싣지 않는다. FEDS Note 2020-10-07
Figure 1 접근성 버전의 서술이 최선의 공개 앵커다: IG "around 1% in February" → 3/23 4%, HY "4% in February"
→ 3/23 약 11%.
