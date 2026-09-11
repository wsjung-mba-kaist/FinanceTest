---
id: discount-window-fhlb-btfp
title: 재할인창구·FHLB·BTFP — 담보차입의 실무
titleEn: Discount Window, FHLB Advances and the BTFP
tags: [liquidity, central-bank, funding, bank, collateral]
level: core
relatedMetrics: [facilityHeadroom, facilityPending, cbAdvances, liquidityAvailable, survivalDays]
sources: [fed-btfp-term-sheet-2023, interagency-cfp-addendum-2023, fdic-oig-signature-2023, fdic-frc-supervision-2023, fed-svb-review-2023, dfpi-svb-order-2023, bcbs-144]
---

## 정의

미국 은행의 담보차입 창구는 세 층이다. 연방주택대출은행(Federal Home Loan Bank, FHLB) advance는 회원 은행이 사전 예치한 담보로 빌리는 도매 조달이며, 연준 재할인창구(discount window)는 최종대부자 창구로 1차 신용(primary credit)과 문제은행용 2차 신용(secondary credit)으로 나뉜다. 은행기간조달프로그램(Bank Term Funding Program, BTFP)은 2023.3.12 저녁 창설된 임시 시설로, 적격 증권을 시가가 아닌 액면(par)으로 평가해 최장 1년 대출했다 [출처: fed-btfp-term-sheet-2023].

## 공식

```
FHLB 여력  = Σ 사전 예치 담보 시가 × (1 − 헤어컷); 당일 컷오프 이전만 실행
창구 여력  = Σ 연준 예치 담보 × (1 − 마진); 미예치 담보는 ≥1영업일, FHLB 리엔 해제 선행
BTFP 여력  = Σ 적격 증권(2023.3.12 보유분) × 액면 100%; 금리 = 1년 OIS + 10bp 고정, 최장 1년
```

게임 보정값(저작 가이드): FHLB 헤어컷 국채 ~3% / MBS 7~10% / 주택담보 15~25% / CRE 30~40%; 창구 마진 국채 1~3% / MBS 3~6% / 대출 10~50%; 2차 신용 +50bp; 비시스템 상황의 창구 낙인 ΔCI −3.

## 위기에서 왜 중요한가

담보차입은 매각과 달리 손실을 실현하지 않고 테인팅도 일으키지 않는다. 문제는 운영이다. 담보는 미리 예치·평가되어 있어야 하고, FHLB가 선순위 리엔을 가진 담보는 연준에 바로 쓸 수 없으며, 창구 차입은 "문제 은행"이라는 낙인(stigma) 우려 때문에 늦춰지기 쉽다. 2023.7.28 인터에이전시 부록은 재할인창구를 CFP에 포함하고 주기적 테스트 거래로 운영 준비를 유지하라고 명시했다 [출처: interagency-cfp-addendum-2023]. BTFP는 수수료 없음·조기상환 가능·외환안정기금(ESF) $25B 백스톱 조건으로 낙인을 낮추도록 설계됐다 [출처: fed-btfp-term-sheet-2023].

한국의 대응물은 한국은행 RP 거래와 한은법 65조 긴급여신이며, 새마을금고는 2023.7 사태 당시 한은 RP 대상기관이 아니어서 은행 RP(6~6.2조)로 우회했고 2024.8에야 편입됐다.

## 역사적 사례

- **SVB(3/9)**: 담보를 FHLB에서 연준으로 이전하지 못해 cash letter 미결제, 마감 시 연준 계좌 −$958M [출처: dfpi-svb-order-2023]. 재할인창구 담보는 "$5B 남짓"[2차]이었다 [출처: fed-svb-review-2023].
- **시그니처(3/10)**: FHLB가 담보를 후순위화해 준 뒤 뉴욕연준 창구로 $3.4B 결제. 주말에는 담보 실사 미충족으로 $7.9B 송금을 감당하지 못했다 [출처: fdic-oig-signature-2023].
- **3/15**: 재할인창구 잔액 $152.9B(사상 최대), BTFP $11.9B.
- **퍼스트리퍼블릭(4/28)**: 문제은행 등급으로 2차 신용 전환 — 재할인창구가 사실상 차단되며 5/1 폐쇄 [출처: fdic-frc-supervision-2023].

## 실무 체크포인트

- 담보를 "FHLB 예치 / 연준 예치 / 미예치"로 나누어 당일 여력과 T+1 여력을 분리 보고한다.
- FHLB→연준 리엔 해제 절차를 문서화하고 소요 시간을 실제 테스트로 확인한다.
- 창구 차입을 CFP 2~3단계에 명시해 "낙인 때문에 안 쓴다"는 결정을 사후 검증 가능하게 한다.
- 등급 강등 시 2차 신용 전환·금리 상승을 시나리오에 반영하고, 강등 전에 필요한 규모를 확보한다.
- 임시 시설(BTFP형)은 발표 전에는 계획에 넣을 수 없다 — 존재하는 창구만으로 생존 일수를 계산한다.

## 관련 개념

[재할인창구](term:discount-window) · [FHLB](term:fhlb) · [BTFP](term:btfp) · [최종대부자](term:lolr) · [낙인](term:stigma) · [헤어컷](term:haircut) · [한은법 65조](term:bok-act-article-65) · [HTM 테인팅](term:htm-tainting)
